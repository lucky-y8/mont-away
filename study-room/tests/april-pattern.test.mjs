import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aprilPlan, aprilEntry } from '../src/prediction/april-plan.js';
import { selectPredictionQuestions, predictionRanges } from '../src/prediction/predictions.js';
import { predictionLesson, predictionMnemonic } from '../src/prediction/learning.js';
import { gradeResponse } from '../src/grading.js';

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const source = read('questions.json'), questions = read('april-2026/questions.json'), focus = read('focus-priorities.json');
const topics = Object.fromEntries(focus.topics.map(t=>[t.id,t]));
const original = source.filter(q=>q.id.startsWith('exam-2026-04-'));

test('31 new questions match the April paper slot by slot and total exactly 100 points',()=>{
  assert.equal(questions.length,31);
  assert.equal(new Set(questions.map(q=>q.id)).size,31);
  assert.equal(new Set([...source,...questions].map(q=>q.id)).size,source.length+31);
  assert.equal(aprilPlan.items.reduce((n,i)=>n+i.points,0),100);
  for(const [i,q] of questions.entries()){
    const ref=original[i], item=aprilPlan.items[i];
    const chapters=[...new Set(focus.questions[ref.id].topics.map(id=>topics[id].chapter))];
    assert.deepEqual(chapters,[q.chapter]);
    assert.equal(q.type,ref.type);
    assert.equal(item.referenceId,ref.id);
    assert.equal(item.points,i<25?2:i<29?5:15);
    assert.equal(item.number,i+1);
    assert.ok(!source.some(old=>old.stem===q.stem));
    assert.equal(q.answerSource,'ai');
    assert.equal(q.practicePaper,'april-2026');
    assert.ok(aprilEntry(q));
  }
  assert.deepEqual(questions.slice(25,29).map(q=>q.chapter),[6,2,8,4]);
  assert.deepEqual(questions.slice(29).map(q=>q.chapter),[4,2]);
});

test('paper selection stays isolated, ordered, and guards public stem edits',()=>{
  assert.ok(predictionRanges.includes(aprilPlan.id));
  const all=[...source,...questions];
  assert.equal(selectPredictionQuestions(all).length,31);
  assert.equal(selectPredictionQuestions(all,'extended').length,60);
  assert.deepEqual(selectPredictionQuestions([...all].reverse(),aprilPlan.id).map(q=>q.id),questions.map(q=>q.id));
  const q=questions[0];
  assert.ok(aprilEntry({...q,answer:'共同修改'}));
  assert.equal(aprilEntry({...q,stem:'其他内容'}),null);
  assert.equal(aprilEntry({...q,origin:'upload'}),null);
  assert.equal(selectPredictionQuestions(all.map(x=>x.id===q.id?{...x,stem:'修改'}:x),aprilPlan.id).length,30);
});

test('each lesson has question-specific explanations, recall and transfer; changes cannot reuse old teaching',()=>{
  for(const q of questions){
    const l=predictionLesson(q);
    assert.ok(l,q.id);
    assert.ok(l.trigger && l.memoryScene,q.id);
    if(q.type==='single') assert.equal(l.optionAnalysis.length,4);
    if(['short','calculation'].includes(q.type)) assert.ok(l.answerFrame.length>=3);
    assert.ok(l.steps.length>=3 && l.mapping.length>=2 && l.pitfalls.length>=2,q.id);
    assert.ok(l.cue.length>=8 && l.cue.length<=60,q.id);
    assert.notEqual(l.recall.prompt,l.extension.prompt);
    assert.ok(l.recall.answer && l.extension.answer);
    for(const field of ['answer','explanation','stem']) assert.equal(predictionLesson({...q,[field]:q[field]+'更改'}),null);
    assert.equal(predictionMnemonic({...q,mnemonic:'自定义口诀'}),null);
  }
});

test('choice keys and fill variants can be graded without a submit button',()=>{
  for(const q of questions.slice(0,15)){
    assert.equal(q.options.length,4);
    assert.equal(gradeResponse(q,[q.answer]).status,'correct');
    assert.equal(gradeResponse(q,[q.answer==='A'?'B':'A']).status,'incorrect');
  }
  const answers=['电路','learn.example.edu.cn','端口','0.0.0.0/0','冲突检测','半双工','私钥','-E','个人','信息技术'];
  for(const [i,answer] of answers.entries()) assert.equal(gradeResponse(questions[15+i],[],[answer]).status,'correct',questions[15+i].id);
  assert.equal(gradeResponse(questions[19],[],['碰撞检测']).status,'correct');
  assert.equal(gradeResponse(questions[20],[],['双向交替']).status,'correct');
  assert.equal(gradeResponse(questions[22],[],['−E']).status,'correct');
  for(const q of questions.slice(25)) assert.equal(gradeResponse(q).status,'review');
});

test('calculation explanations retain exact assumptions and independently recomputed HTTP times',()=>{
  const q=questions[30], times=[2*(8+1),2+2*Math.ceil(8/3),3].map(n=>`${n*60}ms`);
  assert.deepEqual(q.learning.table.rows.map(r=>r[2]),times);
  assert.match(q.stem,/只有收到HTML后/);
  assert.match(q.stem,/明确启用流水线/);
  assert.match(q.learning.extension.answer,/10RTT=600ms/);
  assert.match(questions[2].explanation,/4096−1024=3072/);
  assert.match(questions[12].explanation,/8000×2=16000/);
});
