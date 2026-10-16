"""Public uploads remain atomic, durable and isolated from travel data."""
import base64
import io
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from PIL import Image, PngImagePlugin

from app.config import settings, PROJECT_ROOT
from app.main import app
from app.study_room import store


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'study_database_path', str(tmp_path / 'study.sqlite3'))
    with TestClient(app) as value:
        yield value


def png():
    output = io.BytesIO()
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text('Comment', 'metadata removed before public display')
    Image.new('RGB', (48, 32), '#f3ebdb').save(output, format='PNG', pnginfo=metadata)
    return 'data:image/png;base64,' + base64.b64encode(output.getvalue()).decode()


def record(**updates):
    return {'stem': '自建题目：什么是网络协议？', 'answer': '通信双方共同遵守的规则。', 'images': [], **updates}


def post(client, rows, key='test-upload-request-01'):
    return client.post('/api/study/questions', json={'requestId': key, 'questions': rows})


def counts():
    with store.database() as db:
        return tuple(db.execute('SELECT count(*) FROM ' + table).fetchone()[0]
                     for table in ('question_uploads', 'question_images', 'question_submissions'))


def test_image_upload_shared_edit_and_history(client):
    response = post(client, [record(images=[png()], editor='测试同学')])
    assert response.status_code == 201
    q = response.json()['questions'][0]
    assert q['id'].startswith('custom-') and q['chapter'] == 12
    assert q['origin'] == 'upload' and q['revision'] == 0
    assert q['answerSource'] == 'community' and q['explanationSource'] == 'missing'
    image = client.get(q['figures'][0])
    assert image.status_code == 200 and image.headers['content-type'] == 'image/png'
    assert image.headers['x-content-type-options'] == 'nosniff'
    with Image.open(io.BytesIO(image.content)) as decoded:
        assert decoded.size == (48, 32) and 'Comment' not in decoded.info
    url = '/api/study/questions/' + q['id']
    saved = client.put(url, json={**q, 'answer':'新答案', 'editor':'另一位同学', 'figures':[], 'chapter':999}).json()['question']
    assert saved['revision'] == 1 and saved['figures'] == q['figures'] and saved['chapter'] == 12
    assert client.put(url, json=q).status_code == 409
    history = client.get(url).json()['history']
    assert [row['revision'] for row in history] == [1, 0]
    assert history[-1]['editor'] == '测试同学'
    restored = client.put(url, json={**q, 'revision':1}).json()['question']
    assert restored['answer'] == q['answer'] and restored['revision'] == 2
    with TestClient(app) as other:
        assert other.get(url).json()['history'][0]['revision'] == 2
        assert other.get(q['figures'][0]).content == image.content
        assert other.get('/api/study/questions').json()['total'] == len(store.originals()) + 1


def test_atomic_validation_no_orphan_images(client):
    response = post(client, [record(images=[png()]), record(stem='')])
    assert response.status_code == 400 and '第 2 道题' in response.json()['error']
    assert counts() == (0, 0, 0)
    assert post(client, [record(images=['data:image/png;base64,' + base64.b64encode(b'<svg/>').decode()])]).status_code == 400
    assert counts() == (0, 0, 0)
    assert post(client, [record(type='single', options=['one'])]).status_code == 400
    assert post(client, [record(images=[png()] * 5)]).status_code == 400
    assert post(client, [record(chapter=True)]).status_code == 400


@pytest.mark.parametrize('cold_start', range(5))
def test_create_is_idempotent_even_with_concurrent_retry(client, cold_start):
    # Each case uses a fresh database. / 每轮使用新数据库，覆盖并发首次初始化。
    rows = [record(images=[png()])]
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: post(client, rows), range(2)))
    assert [response.status_code for response in responses] == [201, 201]
    first, second = [response.json()['questions'][0] for response in responses]
    assert first['id'] == second['id'] and counts() == (1, 1, 1)
    assert post(client, [record(stem='不同的内容')]).status_code == 400
    saved = client.put('/api/study/questions/' + first['id'], json={**first,'answer':'后来修订'}).json()['question']
    assert post(client, rows).json()['questions'][0]['revision'] == saved['revision']
    assert counts() == (1, 1, 1)


@pytest.mark.parametrize('filename', ['questions.csv','questions.json'])
def test_templates_preview_then_batch_publish(client, filename):
    data = (PROJECT_ROOT / 'study-room/public/study-assets/templates' / filename).read_bytes()
    response = client.post('/api/study/import/preview', params={'filename':filename}, content=data)
    preview = response.json()
    assert response.status_code == 200 and preview['errors'] == [] and preview['total'] == 2
    assert preview['questions'][1]['options'] == ['TCP','IP','ARP','以太网']
    assert counts() == (0, 0, 0)
    created = post(client, preview['questions']).json()['questions']
    assert len(created) == 2 and counts() == (2, 0, 1)
    assert client.get('/study-assets/templates/' + filename).status_code == 200


def test_csv_quoting_and_batch_errors_leave_db_unchanged(client):
    data = '\ufeff题干,题型,答案\r\n"问题,带逗号\n第二行",简答题,答案\r\n'.encode()
    preview = client.post('/api/study/import/preview?filename=题目.csv', content=data).json()
    assert preview['questions'][0]['stem'] == '问题,带逗号\n第二行'
    invalid = json.dumps([record(),record(type='single',options=['only'])]).encode()
    preview = client.post('/api/study/import/preview?filename=q.json', content=invalid).json()
    assert len(preview['errors']) == 1 and preview['questions'] == [] and preview['total'] == 2
    assert counts() == (0, 0, 0)
    for data, name in [(b'{','q.json'), (b'answer\na','q.csv'), (b'x','q.xlsx'), (b'a' * (2*1024*1024+1),'q.csv')]:
        assert client.post('/api/study/import/preview',params={'filename':name},content=data).status_code in (400,413)


def test_upload_limits_origin_and_missing_images(client):
    assert client.post('/api/study/questions', json={'requestId':'bad','questions':[record()]}).status_code == 400
    assert post(client,[record()] * 201).status_code == 400
    assert post(client,[]).status_code == 400
    assert client.post('/api/study/questions',content='x').status_code == 415
    assert client.post('/api/study/questions',json={'questions':[record()]},headers={'Origin':'https://elsewhere.test'}).status_code == 403
    assert client.post('/api/study/import/preview?filename=q.json',content='[]',headers={'Origin':'https://elsewhere.test'}).status_code == 403
    assert client.get('/api/study/images/' + '0'*32).status_code == 404
    assert client.get('/api/study/images/invalid').status_code == 404
    assert counts() == (0, 0, 0)


def test_previous_database_upgrades_without_losing_edits(client):
    original = client.get('/api/study/questions').json()['questions'][0]
    response = client.put('/api/study/questions/' + original['id'], json={**original,'answer':'保留的旧答案'})
    assert response.status_code == 200
    with sqlite3.connect(settings.study_database_path) as db:
        for table in ('question_uploads','question_images','question_submissions'):
            db.execute('DROP TABLE ' + table)
    assert post(client,[record()]).status_code == 201
    old = client.get('/api/study/questions/' + original['id']).json()['history']
    assert [q['revision'] for q in old] == [1, 0] and old[0]['question']['answer'] == '保留的旧答案'
