"""Incremental transport and server filtering regression checks."""
import json
import pytest
from fastapi.testclient import TestClient
from app.config import settings
from app.main import app
from app.study_room import catalog, store

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'study_database_path', str(tmp_path/'study.sqlite3'))
    with TestClient(app) as value: yield value

def cursor(client): return client.get('/api/study/sync').json()['cursor']
def delta(client, previous): return client.get('/api/study/sync', params={'cursor':previous})
def query(client, **filters):
    response=client.post('/api/study/query', json=filters)
    assert response.status_code==200, response.text
    return response.json()

def test_bounded_loading_and_small_idle_response(client):
    initial=client.get('/api/study/sync').json()
    assert initial['reset'] and not initial['changed']
    idle=delta(client, initial['cursor'])
    assert idle.status_code==204 and idle.content==b''
    assert idle.headers['cache-control']=='no-store'
    index=query(client)
    assert len(index['ids'])==index['summary']['total']==1321
    assert not {'questions','answer','stem'} & index.keys()
    assert index['version']==initial['cursor']
    page=client.post('/api/study/batch', json={'ids':index['ids'][:20]}).json()
    assert len(page['questions'])==20 and not page['missing']
    assert len(json.dumps(page,ensure_ascii=False).encode())<50000
    assert client.post('/api/study/batch',json={'ids':index['ids'][:21]}).status_code==400
    assert client.post('/api/study/batch',json={'ids':['missing']}).json()['missing']==['missing']
    legacy=client.get('/api/study/questions').json()
    assert len(legacy['questions'])==20 and legacy['nextOffset']==20
    assert client.get('/api/study/questions?limit=101').status_code==422
    assert client.get('/api/study/questions?offset=-1').status_code==422

def test_search_full_bank_personal_and_prediction_metadata(client):
    assert query(client,query='exam-2026-04-q031')['ids']==['exam-2026-04-q031']
    assert query(client,scope='favorites')['ids']==[]
    assert query(client,scope='favorites',ids=['exam-2026-04-q031','missing'])['ids']==['exam-2026-04-q031']
    result=query(client,chapter=20,type='calculation',mastered=['missing','ch00-q001'])
    assert result['ids']==['exam-2026-04-q030','exam-2026-04-q031']
    assert result['summary']['mastered']==1
    assert result['summary']['chapters']['20']==31
    assert len(result['summary']['prediction']['paper'])==31
    assert len(result['summary']['prediction']['extended'])==60
    assert len(query(client,prediction='paper')['ids'])==31
    assert len(query(client,prediction='extended',type='calculation')['ids'])==8
    _, focus, prediction=catalog.resources()
    originals=store.originals()
    for id, entry in focus['questions'].items(): assert catalog.fingerprint(originals[id])==entry['fingerprint'],id
    for topic in focus['topics']:
        expected=[id for id, entry in focus['questions'].items() if topic['id'] in entry['topics']]
        assert set(query(client,focusTopic=topic['id'])['ids'])==set(expected)
    expected=[id for id, entry in focus['questions'].items() if any(t['id'] in entry['topics'] and t['stars']==5 for t in focus['topics'])]
    assert set(query(client,focusLevel='5')['ids'])==set(expected)

def test_edits_atomic_cursor_dedup_conflict_and_teaching_guard(client):
    previous=cursor(client)
    id='exam-2026-04-q031'
    q=client.post('/api/study/batch',json={'ids':[id]}).json()['questions'][0]
    assert q['learning']['id']==id
    one=client.put('/api/study/questions/'+id,json={**q,'answer':'new answer'}).json()['question']
    assert one['revision']==1
    two=client.put('/api/study/questions/'+id,json={**one,'answer':'newer answer'}).json()['question']
    changes=delta(client,previous).json()
    assert changes['changed']==[id] and not changes['reset']
    assert 'answer' not in changes and len(json.dumps(changes))<300
    assert delta(client,changes['cursor']).status_code==204
    assert client.put('/api/study/questions/'+id,json=q).status_code==409
    assert delta(client,changes['cursor']).status_code==204
    loaded=client.post('/api/study/batch',json={'ids':[id]}).json()['questions'][0]
    assert loaded['answer']==two['answer'] and loaded['revision']==2
    assert loaded['answer']!=loaded['learning']['baseline']['answer']
    assert id in query(client,prediction='extended')['ids']
    client.put('/api/study/questions/'+id,json={**two,'stem':'changed stem'})
    assert id not in query(client,prediction='extended')['ids']
    assert id in query(client,focusLevel='unrated')['ids']

def test_multiple_change_pages_deletion_rollback_and_reset(client, monkeypatch):
    before=cursor(client)
    originals=list(store.originals().values())[:205]
    with store.database() as db:
        db.execute('BEGIN IMMEDIATE')
        for q in originals:
            db.execute('INSERT INTO question_edits VALUES (?,?,?,?,?)',(q['id'],json.dumps({'answer':'updated'}),1,'test','now'))
        db.commit()
    page=delta(client,before).json();assert len(page['changed'])==100 and page['hasMore']
    second=delta(client,page['cursor']).json();assert len(second['changed'])==100 and second['hasMore']
    last=delta(client,second['cursor']).json();assert len(last['changed'])==5 and not last['hasMore']
    assert set(page['changed']+second['changed']+last['changed'])=={q['id'] for q in originals}
    with store.database() as db:
        db.execute('BEGIN IMMEDIATE');db.execute('DELETE FROM question_edits');db.rollback()
    assert delta(client,last['cursor']).status_code==204
    with store.database() as db: db.execute('DELETE FROM question_edits WHERE question_id=?',(originals[0]['id'],))
    assert delta(client,last['cursor']).json()['changed']==[originals[0]['id']]
    for invalid in ['invalid',before.rsplit('.',1)[0]+'.999999',before.rsplit('.',1)[0]+'.-1']:
        assert delta(client,invalid).json()['reset']
    old=catalog.resources()
    monkeypatch.setattr(catalog,'resources',lambda:('new-source-version',*old[1:]))
    assert delta(client,before).json()['reset']

def test_uploads_and_idempotency_are_incremental(client):
    before=cursor(client)
    row={'chapter':12,'type':'fill','stem':'test ____','options':[],'answer':'a','explanation':'b','editor':'test','images':[]}
    body={'requestId':'incremental-upload-1234','questions':[row]}
    response=client.post('/api/study/questions',json=body)
    assert response.status_code==201,response.text
    id=response.json()['questions'][0]['id']
    changed=delta(client,before).json()
    assert changed['changed']==[id]
    assert query(client,scope='uploads')['ids']==[id]
    assert query(client)['summary']['total']==1322
    assert client.post('/api/study/questions',json=body).status_code==201
    assert delta(client,changed['cursor']).status_code==204

@pytest.mark.parametrize('body',[[],None,{'ids':[[]]},{'chapter':True},{'type':{}},{'query':12},{'mastered':['x','x']}])
def test_bad_query_payloads(client,body):
    assert client.post('/api/study/query',json=body).status_code==400
