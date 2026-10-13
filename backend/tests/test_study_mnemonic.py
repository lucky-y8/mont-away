"""Mnemonic editing, legacy-client compatibility and import durability."""
import json
import pytest
from fastapi.testclient import TestClient
from app.config import settings
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'study_database_path', str(tmp_path / 'study.sqlite3'))
    with TestClient(app) as value:
        yield value


def test_mnemonic_history_conflict_legacy_save_and_clear(client):
    original = client.get('/api/study/questions').json()['questions'][0]
    url = '/api/study/questions/' + original['id']
    saved = client.put(url, json={**original, 'mnemonic': '  法义序：格式、含义、先后  '}).json()['question']
    assert saved['mnemonic'] == '法义序：格式、含义、先后' and saved['revision'] == 1
    assert client.put(url, json={**original, 'mnemonic': '旧版本覆盖'}).status_code == 409
    legacy = {key: value for key, value in saved.items() if key != 'mnemonic'}
    revised = client.put(url, json={**legacy, 'explanation': '另一个客户端修改解析'}).json()['question']
    assert revised['mnemonic'] == saved['mnemonic'] and revised['revision'] == 2
    cleared = client.put(url, json={**revised, 'mnemonic': ''}).json()['question']
    assert cleared['mnemonic'] == ''
    history = client.get(url).json()['history']
    assert [row['question'].get('mnemonic', '') for row in history] == ['', saved['mnemonic'], saved['mnemonic'], '']
    restored = client.put(url, json={**history[1]['question'], 'revision': cleared['revision']}).json()['question']
    with TestClient(app) as other:
        assert other.get(url).json()['history'][0]['question']['mnemonic'] == restored['mnemonic'] == saved['mnemonic']
    for invalid in [None, 123, [], 'x' * 4001]:
        assert client.put(url, json={**restored, 'mnemonic': invalid}).status_code == 400


@pytest.mark.parametrize('filename,content', [
    ('q.csv', '题干,题型,答案,助记\n组成包括________和________。,填空题,甲；乙,先甲后乙\n'),
    ('q.json', json.dumps([{'stem':'组成包括________和________。','type':'fill','answer':'甲；乙','mnemonic':'先甲后乙'}], ensure_ascii=False)),
])
def test_mnemonic_import_and_upload(client, filename, content):
    preview = client.post('/api/study/import/preview', params={'filename': filename}, content=content.encode()).json()
    assert preview['errors'] == [] and preview['questions'][0]['mnemonic'] == '先甲后乙'
    response = client.post('/api/study/questions', json={'requestId':'mnemonic-batch-import', 'questions': preview['questions']})
    assert response.status_code == 201
    q = response.json()['questions'][0]
    assert client.get('/api/study/questions/' + q['id']).json()['history'][0]['question']['mnemonic'] == '先甲后乙'
    invalid = {**preview['questions'][0], 'mnemonic': 'x' * 4001}
    assert client.post('/api/study/questions', json={'requestId':'mnemonic-invalid-upload', 'questions':[invalid]}).status_code == 400
