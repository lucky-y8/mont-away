import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assessQuestion, compareFocus, matchesFocus, focusData, topicById } from '../src/priorities.js';
const bank = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(bank.map(q => [q.id, q]));

test('every original question has a matching content fingerprint and supported topic', () => {
  assert.equal(bank.length, 1259);
  assert.deepEqual(new Set(Object.keys(focusData.questions)), new Set(bank.map(q => q.id)));
  for (const q of bank) {
    const a = assessQuestion(q);
    assert.equal(a.status, 'rated', q.id);
    assert.ok(a.stars >= 1 && a.stars <= 5, q.id);
    assert.ok(a.topics.length > 0 && a.topics.every(t => topicById[t.id]), q.id);
  }
});
test('evidence covers exactly 93 full-paper questions, never summary duplicates or 04741', () => {
  const allRefs = new Set();
  for (const topic of focusData.topics) {
    assert.equal(new Set(topic.evidence.map(e => e.id)).size, topic.evidence.length);
    assert.deepEqual(topic.examTerms, [...new Set(topic.evidence.map(e => e.term))].sort());
    for (const e of topic.evidence) {
      const q = byId[e.id];
      assert.ok(q && q.materialId === `exam-${e.term}`);
      assert.ok(focusData.questions[e.id].topics.includes(topic.id), `${e.id}: ${topic.id}`);
      assert.equal(e.sourceUrl, `/study-assets${q.sourceUrl}`);
      assert.ok(q.pages.includes(e.page));
      assert.equal(e.type, q.type);
      assert.ok(existsSync(fileURLToPath(new URL(`../public${e.sourceUrl}`, import.meta.url))));
      allRefs.add(e.id);
    }
  }
  assert.equal(allRefs.size, 93);
  assert.deepEqual([...allRefs].sort(), bank.filter(q => q.materialId?.startsWith('exam-')).map(q => q.id).sort());
  assert.equal(topicById['network-congestion'].examTerms.length, 0, 'secondary 2026 summary does not become a full paper');
});
test('ratings are determined by distinct terms and syllabus importance, not question count', () => {
  for (const t of focusData.topics) {
    const count = new Set(t.evidence.map(e => e.term)).size;
    const expected = t.importance === 'core' ? Math.min(5, 3 + count) : t.importance === 'general' ? Math.min(4, 2 + count) : 1;
    assert.equal(t.stars, expected, t.id);
  }
  assert.equal(topicById.subnet.stars, 5);
  assert.equal(topicById['line-code'].examTerms.length, 3);
  assert.equal(topicById.http.stars, 4, 'two HTTP questions in one term still count as one term');
  assert.equal(topicById.window.stars, 3, 'past 04741 calculations do not inflate 13017 frequency');
});
test('book references stay within verified printed sections and PDF offset', () => {
  assert.equal(focusData.book.pdfPageOffset, 7);
  assert.equal(focusData.book.pageCount, 450);
  assert.match(focusData.book.sha256, /^[a-f0-9]{64}$/);
  for (const t of focusData.topics) {
    assert.ok(t.chapter >= 1 && t.chapter <= 11);
    for (const [a, b] of t.bookPages) assert.ok(a >= 32 && b >= a && b + 7 <= 450, t.id);
    assert.ok(t.syllabusPages[0] >= 6 && t.syllabusPages[1] <= 19);
  }
});
test('answer-only edits retain ratings; changed questions and uploads require reassessment', () => {
  const q = byId['ch00-q001'];
  assert.equal(assessQuestion({ ...q, answer: '共同修订答案', explanation: '新解析', mnemonic: '新助记', revision: 4 }).stars, 5);
  assert.equal(assessQuestion({ ...q, stem: '另一道题' }).status, 'changed');
  assert.equal(assessQuestion({ ...q, options: ['不同选项'] }).stars, 0);
  assert.equal(assessQuestion({ ...q, type: 'fill' }).stars, 0);
  assert.equal(assessQuestion({ ...q, id: 'upload-test', origin: 'upload' }).status, 'new');
});
test('star/topic filters compose and priority ordering preserves original ties', () => {
  const list = bank.map(q => ({q, a:assessQuestion(q)}));
  const result = list.filter(({a}) => matchesFocus(a, '4+', 'subnet'));
  assert.ok(result.length > 0);
  assert.ok(result.every(({a}) => a.stars >= 4 && a.topics.some(t => t.id === 'subnet')));
  assert.ok(list.filter(({a}) => matchesFocus(a, '2')).every(({a}) => a.stars === 2));
  const unrated = assessQuestion({...bank[0], id: 'new'});
  assert.equal(matchesFocus(unrated, '4+'), false);
  assert.equal(matchesFocus(unrated, 'unrated'), true);
  assert.equal(matchesFocus(unrated, 'all', 'subnet'), false);
  assert.equal(compareFocus(assessQuestion(byId['ch00-q001']), assessQuestion(byId['ch01-q002'])), 0);
  const sorted = [...list, {a:unrated}].sort((a,b) => compareFocus(a.a,b.a));
  assert.equal(sorted.at(-1).a.stars, 0);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i-1].a.stars >= sorted[i].a.stars);
});
test('reviewed ambiguous wording does not inherit incidental high-frequency topics', () => {
  for (const [id, topics] of Object.entries({
    'calculation-p011':['performance'], 'calculation-p041':['app-communication'],
    'calculation-p055':['window'], 'calculation-p101':['route-algorithm'],
    'ch06-q004':['capacity'], 'ch11-q006':['laws'], 'ch01-q075':['history'],
    'exam-2024-10-q025':['content'], 'exam-2024-10-q006':['communication'],
  })) assert.deepEqual(focusData.questions[id].topics, topics, id);
});
