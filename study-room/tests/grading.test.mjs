import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gradeResponse, expectedChoices, responseOptions, immediateChoiceResult } from '../src/grading.js';

const single = {type:'single', options:['编码','语义','语法','时序'], answer:'A'};
test('choice feedback handles correct, incorrect and invalid references', () => {
  assert.equal(gradeResponse(single, ['A']).status, 'correct');
  assert.equal(gradeResponse(single, ['C']).status, 'incorrect');
  assert.equal(gradeResponse(single, []).status, 'incorrect');
  assert.equal(gradeResponse({...single,answer:'需查看图中表格'}, ['A']).status, 'review');
  assert.equal(gradeResponse({...single,answer:'A 或 B，条件不同'}, ['A']).status, 'review');
  assert.equal(gradeResponse({...single,answer:'E'}, ['A']).status, 'review');
  assert.deepEqual(expectedChoices({...single,answer:'答案：Ａ'}), ['A']);
});
test('multiple choice requires the exact set and accepts any selection order', () => {
  const q={...single,type:'multiple',answer:'A、C'};
  assert.equal(gradeResponse(q, ['C','A']).status, 'correct');
  assert.equal(gradeResponse(q, ['A']).status, 'incorrect');
  assert.equal(gradeResponse(q, ['A','B','C']).status, 'incorrect');
  assert.equal(gradeResponse({...single,answer:'A、C'}, ['A']).status, 'review');
});
test('true or false can be answered even when the upload has no options', () => {
  const q={type:'truefalse', options:[], answer:'错误'};
  assert.deepEqual(responseOptions(q), ['正确','错误']);
  assert.equal(gradeResponse(q, ['B']).status, 'correct');
  assert.equal(gradeResponse(q, ['A']).status, 'incorrect');
  assert.equal(gradeResponse({...q,answer:'√'}, ['A']).status, 'correct');
});
test('fill checks each blank, normalizes presentation and accepts explicit alternatives', () => {
  const q={type:'fill',stem:'协议是________，又称________。',answer:'TCP；时序（或同步）'};
  const correct=gradeResponse(q, [], [' ｔｃｐ ', '同步']);
  assert.equal(correct.status, 'correct');
  const partial=gradeResponse(q, [], ['TCP','语法']);
  assert.equal(partial.status, 'incorrect');
  assert.deepEqual(partial.blanks.map(b=>b.correct), [true,false]);
  assert.equal(gradeResponse(q,[],['TCP/IP','同步']).status,'incorrect');
  assert.equal(gradeResponse({...q,stem:'________',answer:'Internet（或称因特网)'},[],['因特网']).status,'correct');
  assert.equal(gradeResponse({...q,stem:'________',answer:'基站（按课程资料表述）'},[],['基站']).status,'correct');
});
test('ambiguous blanks and free responses ask for self assessment', () => {
  assert.equal(gradeResponse({type:'fill',stem:'________和________',answer:'通信'},[],['通信','网络']).status,'review');
  assert.equal(gradeResponse({type:'fill',stem:'________',answer:''},[],['']).status,'review');
  assert.equal(gradeResponse({type:'calculation',stem:'求总时间',answer:'1s'},[],['1秒']).status,'review');
  assert.equal(gradeResponse({type:'short',stem:'什么是网络',answer:'网络…'},[],['另一种表述']).status,'review');
});
test('all existing choice answers remain gradable; known OCR mismatch is not marked wrong', () => {
  const bank=JSON.parse(readFileSync(new URL('../data/questions.json',import.meta.url),'utf8'));
  const choices=bank.filter(q=>q.type==='single');
  assert.equal(choices.length,316);
  for(const q of choices) assert.equal(gradeResponse(q,[q.answer]).status,'correct',q.id);
  const q=bank.find(q=>q.id==='blanks-p002-q005');
  assert.equal(gradeResponse(q,[],['ISP','互联网']).status,'review');
});


test('immediate feedback waits for correct multiple-choice subsets but catches wrong picks', () => {
  const q={...single,type:'multiple',answer:'A、C'};
  assert.equal(immediateChoiceResult(q,[]),null);
  assert.equal(immediateChoiceResult(q,['A']),null);
  assert.equal(immediateChoiceResult(q,['C']),null);
  assert.equal(immediateChoiceResult(q,['C','A']).status,'correct');
  assert.equal(immediateChoiceResult(q,['B']).status,'incorrect');
  assert.equal(immediateChoiceResult(q,['A','B']).status,'incorrect');
  assert.equal(immediateChoiceResult(single,['A']).status,'correct');
  assert.equal(immediateChoiceResult(single,['B']).status,'incorrect');
});
