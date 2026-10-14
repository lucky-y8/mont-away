"""Regression checks for the full April 2026 source and reference solutions."""
import json
from collections import Counter
from hashlib import sha256
from ipaddress import IPv4Network, IPv4Address
from fastapi.testclient import TestClient
from PIL import Image
from app.config import PROJECT_ROOT, settings
from app.main import app

DATA = PROJECT_ROOT / 'study-room/data'
ASSETS = PROJECT_ROOT / 'study-room/public/study-assets'

def load(name):
    return json.loads((DATA / name).read_text(encoding='utf-8'))

def test_april_exam_preserves_earlier_bank_and_covers_all_source_questions():
    rows = load('questions.json')
    audit = load('exam-202604-report.json')
    new = [q for q in rows if q.get('materialId') == 'exam-2026-04']
    old = [q for q in rows if q not in new]
    assert len(old) == 1259 and len(rows) == len({q['id'] for q in rows}) == 1290
    assert sha256(json.dumps(old, ensure_ascii=False, sort_keys=True).encode()).hexdigest() == audit['original1259CanonicalSha256']
    assert [q['id'] for q in new] == [f'exam-2026-04-q{n:03}' for n in range(1, 32)]
    assert Counter(q['type'] for q in new) == {'single': 15, 'fill': 10, 'short': 4, 'calculation': 2}
    assert {qid for p in audit['pageAudit'] for qid in p['questionIds']} == {q['id'] for q in new}
    assert audit['sourcePdfPageCount'] == 2 and audit['printedPageCount'] == 4
    assert audit['sourceHasAnswers'] is False
    assert sha256((ASSETS / 'sources/exam-2026-04.pdf').read_bytes()).hexdigest() == audit['sourceSha256']
    for n, q in enumerate(new, 1):
        assert q['pages'] == [1 if n <= 15 else 2]
        assert q['answerSource'] == q['explanationSource'] == 'ai'
        assert q['needsReview'] and not q['figuresContainAnswer']
        assert q['answer'] and '教材定位' in q['explanation'] and '待核对' in q['explanation']
        with Image.open(ASSETS / q['figures'][0].lstrip('/')) as im:
            assert im.width >= 1000 and im.height >= 40

def test_april_reference_calculations_have_valid_subnet_boundaries_and_rtt_assumptions():
    by_id = {q['id']: q for q in load('questions.json')}
    q = by_id['exam-2026-04-q030']
    networks = [IPv4Network(f'202.103.116.{host}/28', strict=False) for host in [19, 150, 158, 163, 174]]
    for network in networks:
        assert str(network) in q['answer']
    assert networks[1] == networks[2] and networks[3] == networks[4]
    available = set(networks[2].hosts()) - {IPv4Address('202.103.116.150'), IPv4Address('202.103.116.158')}
    assert available == {IPv4Address(f'202.103.116.{n}') for n in [*range(145, 150), *range(151, 158)]}
    assert '145～149' in q['answer'] and '151～157' in q['answer']
    assert str(networks[3].broadcast_address) in q['answer']
    http = by_id['exam-2026-04-q031']
    assert all(f'{rtt}RTTₕ' in http['answer'] for rtt in [14, 4, 3])
    assert '不计域名解析时间' in http['explanation']
    assert '忽略' in http['explanation'] and '发送时间' in http['explanation']

def test_april_questions_and_source_assets_are_available_through_api(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'study_database_path', str(tmp_path / 'study.sqlite3'))
    with TestClient(app) as client:
        result = client.get('/api/study/questions').json()['questions']
        assert len([q for q in result if q.get('materialId') == 'exam-2026-04']) == 31
        q = client.get('/api/study/questions/exam-2026-04-q030').json()['history'][0]['question']
        assert q['chapter'] == 20 and q['chapterTitle'] == '2026年04月真题'
        assert client.get(q['figures'][0]).headers['content-type'] == 'image/webp'
        pdf = client.get('/study-assets/sources/exam-2026-04.pdf')
        assert pdf.status_code == 200 and pdf.headers['content-type'] == 'application/pdf'
        assert sha256(pdf.content).hexdigest() == load('exam-202604-report.json')['sourceSha256']
