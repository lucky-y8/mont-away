import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { predictionData, predictionById, predictionEntry, selectPredictionQuestions, predictionCoverage } from '../src/prediction/predictions.js';
import { gradeResponse } from '../src/grading.js';
const bank = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(bank.map(q => [q.id, q]));
const counts = rows => rows.reduce((all, q) => ({ ...all, [q.type]: (all[q.type] || 0) + 1 }), {});

test('prediction paper and extended pool contain unique real exams in all four required sections', () => {
  const paper = selectPredictionQuestions(bank), extended = selectPredictionQuestions(bank, 'extended');
  assert.equal(paper.length, 31);
  assert.equal(extended.length, 60);
  assert.deepEqual(counts(paper), { single: 15, fill: 10, short: 4, calculation: 2 });
  assert.deepEqual(counts(extended), { single: 20, fill: 20, short: 12, calculation: 8 });
  assert.equal(new Set(extended.map(q => q.id)).size, 60);
  assert.ok(paper.every(q => predictionById[q.id].tier === 'main'));
  assert.ok(extended.every(q => q.materialId.startsWith('exam-') && predictionEntry(q)));
  assert.deepEqual(selectPredictionQuestions([...bank].reverse()).map(q => q.id), paper.map(q => q.id), 'paper order is frozen, independent of API order');
  assert.equal(gradeResponse(paper[0], ['C']).status, 'correct');
});

test('evidence is exam-only, resolves to real paper questions and does not double count a term', () => {
  assert.equal(predictionData.examQuestionCount, 124);
  assert.deepEqual(predictionData.examTerms, ['2024-10', '2025-04', '2025-10', '2026-04']);
  assert.equal(predictionData.resultStatus, 'pending');
  assert.equal(predictionData.version, '2026-10-v1');
  for (const topic of predictionData.topics) {
    assert.ok(!('importance' in topic) && !('stars' in topic) && !('bookPages' in topic));
    assert.deepEqual(topic.examTerms, [...new Set(topic.evidence.map(e => e.term))].sort());
    for (const e of topic.evidence) {
      const q = byId[e.id];
      assert.equal(q.materialId, `exam-${e.term}`);
      assert.equal(e.sourceUrl, `/study-assets${q.sourceUrl}`);
      assert.ok(q.pages.includes(e.page));
    }
  }
  for (const item of predictionData.items) assert.ok(item.topics.every(id => predictionData.topics.some(t => t.id === id)));
  for (const source of predictionData.examSources) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../public${source.sourceUrl}`, import.meta.url))).digest('hex'), source.sha256);
  }
});

test('history coverage uses only the eight actual calculation questions and is not a forecast result', () => {
  const main = predictionCoverage(), extended = predictionCoverage(true);
  assert.deepEqual([main.covered, main.total, main.percent, main.fullPapers], [6, 8, 75, 2]);
  assert.deepEqual([extended.covered, extended.total, extended.percent, extended.fullPapers], [8, 8, 100, 4]);
  const evidenceIds = predictionData.calculationHistory.flatMap(p => p.questions.map(q => q.id)).sort();
  const actualIds = bank.filter(q => q.materialId?.startsWith('exam-') && q.type === 'calculation').map(q => q.id).sort();
  assert.deepEqual(evidenceIds, actualIds);
  assert.equal(predictionData.templates.length, 6);
  assert.ok(predictionData.templates.every(t => byId[t.questionId].type === 'calculation' && predictionById[t.questionId]));
  assert.equal(predictionData.resultStatus, 'pending');
});

test('shared stem changes suspend selection while answer-only edits and personal progress stay compatible', () => {
  const q = byId[predictionData.paperIds[0]];
  assert.ok(predictionEntry({ ...q, answer: 'D', explanation: '共同修订', mnemonic: '自定义', revision: 2 }));
  assert.equal(predictionEntry({ ...q, stem: '已换成另一道题' }), null);
  assert.equal(predictionEntry({ ...q, options: ['新选项'] }), null);
  assert.equal(predictionEntry({ ...q, type: 'short' }), null);
  assert.equal(predictionEntry({ ...q, origin: 'upload' }), null);
  const updated = bank.map(item => item.id === q.id ? { ...item, stem: '另一道题' } : item);
  assert.equal(selectPredictionQuestions(updated).length, 30);
  assert.equal(selectPredictionQuestions(updated, 'extended').length, 59);
  assert.equal(selectPredictionQuestions(bank.filter(item => item.id !== q.id)).length, 30);
  assert.ok(!selectPredictionQuestions(updated).some(item => item.id === q.id));
});
