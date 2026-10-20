"""April-pattern paper integration and independent numerical checks."""
import ipaddress
import json
from collections import Counter
import pytest
from fastapi.testclient import TestClient
from app.config import settings, PROJECT_ROOT
from app.main import app
from app.study_room import store

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings,'study_database_path',str(tmp_path/'study.sqlite3'))
    with TestClient(app) as client: yield client

def query(client, **filters):
    response=client.post('/api/study/query',json=filters)
    assert response.status_code==200,response.text
    return response.json()

def test_new_paper_is_bounded_searchable_and_does_not_change_original_pools(client):
    result=query(client,prediction='april-2026')
    expected=[f'practice-apr26-q{i:03}' for i in range(1,32)]
    assert result['ids']==expected
    assert result['summary']['total']==1321
    assert len(result['summary']['prediction']['paper'])==31
    assert len(result['summary']['prediction']['extended'])==60
    assert len(result['summary']['prediction']['april-2026'])==31
    assert all(set(item)=={'id','type'} for item in result['summary']['prediction']['april-2026'])
    assert len(query(client,prediction='april-2026',type='single')['ids'])==15
    assert len(query(client,prediction='april-2026',type='fill')['ids'])==10
    assert len(query(client,prediction='april-2026',type='short')['ids'])==4
    assert len(query(client,prediction='april-2026',type='calculation')['ids'])==2
    assert query(client,prediction='april-2026',query='最多允许3条')['ids']==[expected[-1]]
    assert client.post('/api/study/batch',json={'ids':expected}).status_code==400
    first=client.post('/api/study/batch',json={'ids':expected[:20]}).json()
    last=client.post('/api/study/batch',json={'ids':expected[20:]}).json()
    assert len(first['questions'])==20 and len(last['questions'])==11
    for q in first['questions']+last['questions']:
        assert q['learning']['id']==q['id']
        assert q['sourceUrl']=='/study-assets/sources/exam-2026-04.pdf'
        assert q['learning']['baseline']['answer']==q['answer']
    historical=[q for q in store.originals().values() if not q.get('practicePaper')]
    assert result['summary']['sourceCounts']=={str(k):v for k,v in Counter(q['chapter'] for q in historical).items()}

def test_edits_and_history_keep_generated_provenance_and_incremental_sync(client):
    id='practice-apr26-q030'
    before=client.get('/api/study/sync').json()['cursor']
    q=client.post('/api/study/batch',json={'ids':[id]}).json()['questions'][0]
    response=client.put('/api/study/questions/'+id,json={**q,'stem':'修改后的子网练习','editor':'test'})
    assert response.status_code==200,response.text
    edited=response.json()['question']
    assert edited['practicePaper']=='april-2026'
    assert edited['revision']==1
    assert id not in query(client,prediction='april-2026')['ids']
    assert id in query(client,query='修改后的子网练习')['ids']
    delta=client.get('/api/study/sync',params={'cursor':before}).json()
    assert delta['changed']==[id] and not delta['reset']
    assert client.get('/api/study/sync',params={'cursor':delta['cursor']}).status_code==204
    history=client.get('/api/study/questions/'+id).json()['history']
    assert [h['revision'] for h in history]==[1,0]
    assert history[-1]['question']['practicePaper']=='april-2026'

def test_subnet_answers_against_ipaddress():
    rows=json.loads((PROJECT_ROOT/'study-room/data/april-2026/questions.json').read_text('utf-8'))
    q=rows[29]
    hosts=[ipaddress.ip_interface(f'192.168.50.{n}/27') for n in [35,58,67,94,130]]
    groups={str(h.network) for h in hosts}
    assert groups=={'192.168.50.32/27','192.168.50.64/27','192.168.50.128/27'}
    for row in q['learning']['table']['rows']:
        network=ipaddress.ip_network(row[1])
        assert str(network.broadcast_address)==row[2]
        usable=list(network.hosts())
        assert row[3]==f'{int(usable[0])%256}～{int(usable[-1])%256}'
    f_candidates={int(h)%256 for h in hosts[1].network.hosts()}-{35,58}
    assert f_candidates==set(range(33,35))|set(range(36,58))|set(range(59,63))
    assert len(f_candidates)==28
    g=ipaddress.ip_interface('192.168.50.70/27')
    assert str(g.network.broadcast_address)=='192.168.50.95'
    assert [i for i,h in zip('ABCDE',hosts) if h.ip in g.network]==['C','D']
