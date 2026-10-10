"""Separate study persistence and travel regression. / 刷题隔离与山遥路由回归。"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import pytest
from fastapi.testclient import TestClient
from app.config import settings, PROJECT_ROOT
from app.main import app
from app.study_room import store

@pytest.fixture
def study(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'study_database_path', str(tmp_path / 'study.sqlite3'))
    with TestClient(app) as client:
        yield client

def draft(q, **updates):
    return {**q, 'editor': '接口验证', **updates}

def test_assets_question_bank_and_both_entrypoints(study):
    rows = study.get('/api/study/questions').json()['questions']
    assert len(rows) == len({q['id'] for q in rows}) == 361
    assert len({q['chapter'] for q in rows}) == 12
    for q in rows:
        assert q['answer'] and q['explanation']
        for url in [q['sourceUrl'], *q['figures']]:
            assert (PROJECT_ROOT / 'study-room/public' / url.lstrip('/').split('#')[0]).is_file()
    # Build is required for production entry verification. / 页面检查以生产构建产物为准。
    study_page = study.get('/')
    assert study_page.status_code == 200 and '知网自习室' in study_page.text
    travel = study.get('/shanyao/')
    assert travel.status_code == 200 and '山遥｜发现' in travel.text and '知网自习室' not in travel.text
    assert study.get('/study-assets/sources/ch00.pdf').headers['content-type'] == 'application/pdf'
    assert study.get('/api/v1/posts').status_code == 200
    assert study.get('/api/study/unknown').status_code == 404
    assert study.get('/study-room/runtime/study.sqlite3').status_code == 404
    assert study.get('/.env').status_code == 404

def test_anonymous_save_history_conflict_and_restore(study):
    q = study.get('/api/study/questions').json()['questions'][0]
    url = '/api/study/questions/' + q['id']
    saved = study.put(url, json=draft(q, answer='测试答案', sourceUrl='/evil', chapter=999)).json()['question']
    assert saved['revision'] == 1 and saved['answerSource'] == 'community'
    assert saved['sourceUrl'] == q['sourceUrl'] and saved['chapter'] == q['chapter']
    assert study.get('/api/study/questions').json()['questions'][0]['answer'] == '测试答案'
    assert study.put(url, json=draft(q)).status_code == 409
    assert [r['revision'] for r in study.get(url).json()['history']] == [1, 0]
    restored = study.put(url, json=draft(q, revision=1)).json()['question']
    assert restored['answer'] == q['answer'] and restored['revision'] == 2
    assert [r['revision'] for r in study.get(url).json()['history']] == [2, 1, 0]
    # New client/process sees the same durable database. / 新连接读取同一持久数据库。
    with TestClient(app) as other:
        assert other.get(url).json()['history'][0]['revision'] == 2

@pytest.mark.parametrize('payload', [None, [], {}, {'revision': True}, {'type': []}])
def test_malformed_payloads(study, payload):
    assert study.put('/api/study/questions/ch00-q001', content=json.dumps(payload), headers={'Content-Type':'application/json'}).status_code == 400

def test_validation_origin_and_transaction(study):
    q = study.get('/api/study/questions').json()['questions'][0]
    url = '/api/study/questions/' + q['id']
    for updates in [{'stem': ''}, {'type':'bad'}, {'options':['only']}, {'editor':32}, {'answer':'x'*8001}, {'revision':True}]:
        assert study.put(url, json=draft(q, **updates)).status_code == 400
    assert study.put(url, json=draft(q), headers={'Origin':'https://evil.example'}).status_code == 403
    assert study.put(url, content='{', headers={'Content-Type':'application/json'}).status_code == 400
    assert study.put(url, content='x'*160001, headers={'Content-Type':'application/json'}).status_code == 413
    assert study.put(url, content='x').status_code == 415
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda value: study.put(url, json=draft(q, answer=value), headers={'Origin':'http://testserver'}).status_code, ['first','second']))
    assert sorted(statuses) == [200,409]
    assert len(study.get(url).json()['history']) == 2

def test_travel_prefix_redirects_and_callback_links(study):
    for old in ['/map', '/en/posts/example', '/ja/places/example', '/auth/verify?token=test', '/profile']:
        response = study.get(old, follow_redirects=False)
        assert response.status_code == 308 and response.headers['location'] == '/shanyao' + old
    assert study.get('/shanyao', follow_redirects=False).headers['location'] == '/shanyao/'
    assert 'Mont Away' in study.get('/shanyao/en/').text
    assert 'noindex,nofollow' in study.get('/shanyao/auth/reset-password?token=test').text
    assert settings.shanyao_frontend_url.endswith('/shanyao')
    assert 'study-sitemap.xml' in study.get('/sitemap.xml').text
    assert '/shanyao/sitemap.xml' in study.get('/sitemap.xml').text


def test_email_links_keep_travel_prefix(monkeypatch):
    import asyncio
    from app.services import email
    sent = []
    async def capture(recipient, url, locale, purpose):
        sent.append(url)
    monkeypatch.setattr(email, '_send_action_email', capture)
    for frontend in ['https://example.com', 'https://example.com/shanyao/']:
        monkeypatch.setattr(settings, 'frontend_url', frontend)
        asyncio.run(email.send_verification_email('test@example.com', 'dummy', 'zh-CN'))
        asyncio.run(email.send_password_reset_email('test@example.com', 'dummy', 'zh-CN'))
    assert sent == ['https://example.com/shanyao/auth/verify?token=dummy', 'https://example.com/shanyao/auth/reset-password?token=dummy'] * 2
