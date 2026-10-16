import test from 'node:test';
import assert from 'node:assert/strict';
import { QuestionFeed } from '../src/question-feed/feed.js';

function server(size=350){
  const rows=new Map(Array.from({length:size},(_,i)=>['q'+i,{id:'q'+i,stem:'Question '+i,options:[],revision:0}]));
  let seq=0,epoch='a',saved=null,fail=false;
  const changes=[],calls=[];
  const version=()=>`${epoch}.${seq}`;
  const update=id=>{rows.set(id,{...rows.get(id),revision:rows.get(id).revision+1});changes.push({id,seq:++seq});};
  const request=async(url,opts={})=>{
    const body=opts.body?JSON.parse(opts.body):null;calls.push({url,body});
    if(fail)throw new Error('offline');
    if(url.startsWith('/api/study/sync')){
      const cursor=new URL(url,'http://localhost').searchParams.get('cursor');
      if(cursor===version())return new Response(null,{status:204});
      const reset=!cursor||cursor.split('.')[0]!==epoch;
      return Response.json({cursor:version(),reset,changed:reset?[]:[...new Set(changes.filter(c=>c.seq>+cursor.split('.')[1]).map(c=>c.id))],hasMore:false});
    }
    if(url==='/api/study/query')return Response.json({version:version(),ids:[...rows.keys()],summary:{total:rows.size}});
    assert.equal(url,'/api/study/batch');assert.ok(body.ids.length<=20);
    if(api.beforeBatch)await api.beforeBatch(body);
    const result={version:version(),questions:body.ids.map(id=>rows.get(id)).filter(Boolean),missing:body.ids.filter(id=>!rows.has(id))};
    if(api.afterBatch)await api.afterBatch(body);
    return Response.json(result);
  };
  const storage={read:async()=>structuredClone(saved),write:async value=>{saved=structuredClone(value);}};
  const api={rows,calls,request,storage,update,reset:()=>{epoch='b';seq=0;},offline:value=>{fail=value;},batches:()=>calls.filter(c=>c.url==='/api/study/batch')};
  return api;
}
async function start(s){const f=new QuestionFeed(s.request,s.storage);await f.sync();await f.select({});return f;}
const ids=(start,end)=>Array.from({length:end-start},(_,i)=>'q'+(start+i));

test('initial 20, cache reuse, only next 20, reload cache and zero-body idle sync',async()=>{
  const s=server(),f=await start(s);
  assert.equal((await f.load(ids(0,20))).length,20);assert.equal(s.batches().length,1);
  await Promise.all([f.load(ids(0,20)),f.load(ids(0,40)),f.load(ids(0,40))]);
  assert.equal(s.batches().length,2);assert.deepEqual(s.batches()[1].body.ids,ids(20,40));
  const before=s.calls.length;assert.equal(await f.sync(),false);assert.equal(s.calls.length,before+1);
  const second=await start(s);await second.load(ids(0,20));assert.equal(s.batches().length,2);
});
test('an edit downloads only the changed visible question; unseen edits only invalidate',async()=>{
  const s=server(),f=await start(s);await f.load(ids(0,20));
  s.update('q5');s.update('q250');assert.equal(await f.sync(),true);
  const result=await f.load(ids(0,20));assert.equal(result[5].revision,1);
  assert.deepEqual(s.batches()[1].body.ids,['q5']);
  assert.ok(!s.batches().some(c=>c.body.ids.includes('q250')));
});
test('deployment reset invalidates cache without fetching a whole bank',async()=>{
  const s=server(),f=await start(s);await f.load(ids(0,20));s.reset();await f.sync();
  assert.equal(f.cache.size,0);await f.load(ids(30,50));assert.equal(s.batches().length,2);
});
test('race during a batch invalidates previously cached requested rows and retries consistently',async()=>{
  const s=server(),f=await start(s);await f.load(ids(0,20));
  s.beforeBatch=()=>{s.update('q3');s.beforeBatch=null;};
  const rows=await f.load(ids(0,40));
  assert.equal(rows.length,40);assert.equal(rows[3].revision,1);
  assert.ok(s.batches().some(c=>c.body.ids.includes('q3')&&c.body.ids.includes('q20')));
});
test('a later edit after a batch snapshot is picked up by the next sync',async()=>{
  const s=server(),f=await start(s);
  s.afterBatch=()=>{s.update('q3');s.afterBatch=null;};
  await f.load(ids(0,20));await f.sync();
  assert.equal((await f.load(ids(0,20)))[3].revision,1);
  assert.deepEqual(s.batches().at(-1).body.ids,['q3']);
});
test('long visible lists remain in memory without redownloading; persisted cache stays bounded',async()=>{
  const s=server(),f=await start(s);
  await f.load(ids(0,260));const count=s.batches().length;
  await f.load(ids(0,280));assert.equal(s.batches().length,count+1);
  assert.equal((await s.storage.read()).rows.length,240);
});
test('failed sync retains cache and cursor, retries recover and concurrent checks coalesce',async()=>{
  const s=server(),f=await start(s);await f.load(ids(0,20));const cursor=f.cursor;
  s.update('q0');s.offline(true);await assert.rejects(f.sync());assert.equal(f.cursor,cursor);assert.equal(f.cache.size,20);
  s.offline(false);const before=s.calls.length;await Promise.all([f.sync(),f.sync(),f.sync()]);assert.equal(s.calls.length,before+1);
  assert.equal((await f.load(['q0']))[0].revision,1);
});
