import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import bank from '../data/questions.json' with { type: 'json' };
import { predictionLearning, predictionLesson, predictionMnemonic, wavePoints } from '../src/prediction/learning.js';
import { selectPredictionQuestions } from '../src/prediction/predictions.js';

const questions = selectPredictionQuestions(bank,'extended');
const get = suffix => bank.find(q=>q.id===`exam-${suffix}`);
test('60 selected questions all have a question-specific lesson, short cue and recall/transfer tasks',()=>{
  assert.equal(questions.length,60);
  assert.equal(predictionLearning.items.length,60);
  assert.equal(new Set(predictionLearning.items.map(x=>x.id)).size,60);
  for(const q of questions){
    const l=predictionLesson(q);
    assert.ok(l,q.id);
    assert.ok(l.cue.length>=8 && l.cue.length<=60,q.id);
    assert.ok(l.mapping.length>=2 && l.steps.length>=3,q.id);
    assert.ok(l.recall.prompt && l.recall.answer && l.extension.prompt && l.extension.answer,q.id);
    assert.notEqual(l.recall.prompt,l.extension.prompt,q.id);
    assert.ok(l.pitfalls.length>=2);
    assert.ok(!l.cue.includes('已知 → 所求 → 公式'));
  }
});
test('changes to a question, answer, explanation or options invalidate static learning; metadata does not',()=>{
  for(const q of questions){
    for(const key of ['stem','answer','explanation','type']) assert.equal(predictionLesson({...q,[key]:q[key]+'已改'}),null,`${q.id} ${key}`);
    assert.equal(predictionLesson({...q,options:[...q.options,'new']}),null);
    assert.equal(predictionLesson({...q,origin:'upload'}),null);
    assert.ok(predictionLesson({...q,revision:7,editor:'同学',needsReview:false}));
  }
});
test('community mnemonics take priority and clearing them restores reviewed guidance',()=>{
  const q=get('2026-04-q003');
  assert.equal(predictionMnemonic({...q,mnemonic:'我自己的助记'}),null);
  assert.ok(predictionMnemonic({...q,mnemonic:'  '}));
  assert.equal(predictionMnemonic({...q,answer:'A'}),null);
});
test('wrong topic matches and dangerous negative-option cues are replaced by the actual tested concepts',()=>{
  const lesson=s=>predictionLesson(get(s));
  assert.match(lesson('2026-04-q009').cue,/授权/);
  assert.doesNotMatch(lesson('2026-04-q009').cue,/核心是内容监管/);
  assert.match(lesson('2026-04-q029').cue,/存不下.*传不快.*算不动.*局部坏/);
  assert.match(lesson('2026-04-q017').cue,/主机/);
  assert.doesNotMatch(lesson('2026-04-q017').cue,/Cookie/);
  assert.match(lesson('2025-04-q024').cue,/加密.*签名.*完整.*信封.*双重签/);
  assert.deepEqual(lesson('2026-04-q021').bookPages,[250,251]);
  assert.match(lesson('2026-04-q012').pitfalls.join(''),/可选/);
  assert.match(lesson('2024-10-q030').pitfalls.join(''),/条件结果/);
});
test('all three coding diagrams match every source bit, including AMI polarity and half-width return',()=>{
  for(const id of ['2025-10-q031','2024-10-q031','2025-04-q031']){
    const w=predictionLesson(get(id)).wave;
    let sign=1;
    const expected=[...w.bits].map(bit=>{
      if(id==='2025-10-q031')return +bit;
      if(id==='2024-10-q031')return bit==='1'?1:-1;
      if(bit==='0')return 0;
      const value=sign;sign=-sign;return value;
    });
    assert.deepEqual(w.levels,expected);
    assert.equal(w.duty,id==='2025-04-q031'?0.5:1);
  }
  assert.equal(wavePoints([1,0,-1],.5),'40,76 40,48 58,48 58,76 76,76 76,76 94,76 94,76 112,76 112,104 130,104 130,76 148,76');
});
test('subnet result tables agree with independent address-block arithmetic',()=>{
  const rows=predictionLesson(get('2025-04-q030')).table.rows;
  assert.equal(rows.length,6);
  for(const [i,row] of rows.entries()){
    const network=i*2**5;
    assert.deepEqual(row,[`192.168.10.${network}/27`,`${network+1}～${network+30}`,`${network+31}`]);
  }
  const mask=240, network=x=>x & mask;
  assert.deepEqual([19,150,158,163,174,162].map(network),[16,144,144,160,160,160]);
  const l=predictionLesson(get('2026-04-q030'));
  assert.deepEqual(l.table.rows.map(r=>+r[2]),[31,159,175]);
  assert.match(l.steps.join(''),/\.145～\.149、\.151～\.157/);
  const prohibited=predictionLesson(get('2025-10-q030'));
  assert.deepEqual(prohibited.table.rows.map(r=>r[0]),['192.168.1.64/26','192.168.1.128/26']);
  assert.match(prohibited.steps.join(''),/2¹−2=0/);
});
test('HTTP formulas retain HTML dependency, parallel batches, DNS exclusion and model bounds',()=>{
  const l=predictionLesson(get('2026-04-q031'));
  assert.deepEqual(l.table.rows.map(r=>parseInt(r.at(-1))),[2*(6+1),2+2*Math.ceil(6/6),3]);
  assert.match(l.extension.answer,/8RTT/);
  assert.match(l.pitfalls.join(''),/不能当实际网页固定/);
  assert.match(l.steps.join(''),/不能额外加 DNS/);
  const dns=predictionLesson(get('2024-10-q030'));
  assert.match(dns.steps.join(''),/1 次本地往返＋4 次外部查询/);
});
test('teaching supplements never mutate the historical source bank or prediction selection',()=>{
  const bytes=fs.readFileSync(new URL('../data/questions.json',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'9e7d80d7e2a34777f28b37366ef3dddf91b9e2af39ec9460a37bfa2a3a396372');
  const before=JSON.stringify(bank);
  bank.forEach(predictionLesson);
  assert.equal(JSON.stringify(bank),before);
  assert.equal(selectPredictionQuestions(bank,'paper').length,31);
});
