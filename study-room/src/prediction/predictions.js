// This frozen selection uses exam evidence only; textbook ratings never rank it.
// 押题索引独立冻结；只用试卷证据，不读取教材星级来决定入选。
import data from '../../data/predictions.json' with { type: 'json' };
import { fingerprint } from '../priorities.js';
import { aprilPlan, aprilEntry } from './april-plan.js';
export const predictionData = data;
export const predictionById = Object.fromEntries(data.items.map(item => [item.id, item]));
export const predictionTopicById = Object.fromEntries(data.topics.map(topic => [topic.id, topic]));
export const predictionTypes = { single: '选择题', fill: '填空题', short: '简答题', calculation: '综合题' };
export const predictionRanges = ['paper', 'extended', aprilPlan.id];
export function predictionEntry(q) {
  const entry = predictionById[q.id];
  return entry && !q.origin && entry.fingerprint === fingerprint(q) ? entry : null;
}
export function selectPredictionQuestions(questions, range = 'paper') {
  const byId = new Map(questions.map(q => [q.id, q]));
  const ids = range === aprilPlan.id ? aprilPlan.items.map(item => item.id) : range === 'extended' ? data.items.map(item => item.id) : data.paperIds;
  return ids.map(id => byId.get(id)).filter(q => q && (range === aprilPlan.id ? aprilEntry(q) : predictionEntry(q)));
}
export function predictionCoverage(includeBackup = false) {
  const topics = new Set(includeBackup ? ['subnet', 'line-code', 'http'] : ['subnet', 'line-code']);
  const papers = data.calculationHistory.map(paper => ({ term: paper.term, total: paper.questions.length,
    covered: paper.questions.filter(q => q.topics.some(topic => topics.has(topic))).length }));
  const covered = papers.reduce((n, p) => n + p.covered, 0), total = papers.reduce((n, p) => n + p.total, 0);
  return { covered, total, percent: total ? Math.round(covered / total * 100) : 0,
    fullPapers: papers.filter(p => p.covered === p.total).length, papers };
}
