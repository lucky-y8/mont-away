import json
from collections import Counter
from hashlib import sha256
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from app.config import PROJECT_ROOT, settings
from app.main import app

DATA = PROJECT_ROOT / 'study-room/data'
ASSETS = PROJECT_ROOT / 'study-room/public/study-assets'


def load(name):
    return json.loads((DATA / name).read_text(encoding='utf-8'))


def test_short_material_counts_original_preservation_and_page_coverage():
    rows = load('questions.json')
    audit = load('short-additions-20261013-report.json')
    new = [q for q in rows if q.get('materialId') in audit['materialCounts']]
    old = [q for q in rows if q['chapter'] < 18]
    assert len(rows) == len({q['id'] for q in rows}) == 1290
    assert len(old) == 1000
    assert sha256(json.dumps(old, ensure_ascii=False, sort_keys=True).encode()).hexdigest() == audit['original1000CanonicalSha256']
    assert Counter(q['materialId'] for q in new) == {'short-summary': 133, 'short-homework': 126}
    for q in new:
        assert q['type'] == 'short' and q['answer'] and q['explanation']
        assert q['figures'] and q['answerFigures'] and q['figuresContainAnswer'] is False
        assert not any(word in q['answer'] for word in ['禁止传播', '公众号：', 'Dno'])
        for url in [*q['figures'], *q['answerFigures']]:
            with Image.open(ASSETS / url.lstrip('/')) as image:
                assert image.width > 100 and image.height > 20
    for m in audit['materials']:
        page_count = 31 if m['materialId'] == 'short-summary' else 20
        assert [p['page'] for p in m['pageAudit']] == list(range(1, page_count + 1))
        seen = {q for p in m['pageAudit'] for q in p['questionIds']}
        assert seen == {q['id'] for q in new if q['materialId'] == m['materialId']}
    materials = load('materials.json')
    assert len(materials) == 20 and sum(m['pageCount'] for m in materials) == 549
    assert sum(m['questionCount'] for m in materials) == 1290
    for record in audit['sourceChecks']:
        assert record['originalUnchanged']
        assert sha256((ASSETS / 'sources' / (record['materialId'] + '.pdf')).read_bytes()).hexdigest() == record['readableSha256']


def test_short_question_numbers_cross_page_answers_and_review_notes():
    audit = load('short-additions-20261013-report.json')
    summary, homework = audit['materials']
    for section in summary['sectionAudit']:
        assert section['numbers'] == list(range(1, max(section['numbers']) + 1))
    expected = {
        1: [*range(1, 12), *range(16, 21)], 2: [1, 2, 4, 5, 6, 7, 8, 10, 11, 12, 14, 15],
        3: list(range(1, 11)), 4: [*range(1, 8), 11, 12, 14, 15, 16, 17, 18],
        5: [1, 2, 3, 6, 7, 8, 9, 11], 6: [1, 2, 3, 5, 7, 11, 12],
        7: [*range(1, 9), *range(11, 18)], 8: list(range(1, 6)),
        9: [1, 2, 3, *range(5, 16)], 10: list(range(1, 16)), 11: list(range(1, 11)),
    }
    assert {s['chapter']: s['numbers'] for s in homework['sectionAudit']} == expected
    rows = {q['id']: q for q in load('questions.json')}
    waveform = rows['short-summary-c06-s1-q004']
    assert waveform['pages'] == [19, 20] and len(waveform['answerFigures']) == 2
    assert waveform['answerFigures'][-1].endswith('-p020-answer.webp')
    assert rows['short-summary-c08-s3-q002']['pages'] == [25]
    assert '传输层' in rows['short-summary-c01-s1-q005']['answer']
    assert '迭代' in rows['short-homework-c02-s0-q005']['stem']
    assert 'Wklv lv dq hdvb sureohp' in rows['short-summary-c08-s1-q001']['answer']
    assert rows['short-summary-c08-s1-q002']['answerSource'] == 'ai'


def test_new_short_material_api_and_upload_chapter(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'study_database_path', str(tmp_path / 'study.sqlite3'))
    with TestClient(app) as client:
        q = client.get('/api/study/questions/short-summary-c06-s1-q004').json()['history'][0]['question']
        assert len(q['answerFigures']) == 2
        assert client.get(q['answerFigures'][1]).headers['content-type'] == 'image/webp'
        assert client.get('/study-assets/sources/short-homework.pdf').status_code == 200
        preview = client.post('/api/study/import/preview?filename=q.json', content=json.dumps([
            {'题干': '补充简答题', '题型': '简答题', '答案': '测试答案', '章节': 19, '助记': '测试助记'}
        ]).encode()).json()
        assert preview['errors'] == []
        created = client.post('/api/study/questions', json={'requestId': 'short-material-chapter-check', 'questions': preview['questions']})
        assert created.status_code == 201
        assert created.json()['questions'][0]['chapterTitle'] == '课后简答题总结'
