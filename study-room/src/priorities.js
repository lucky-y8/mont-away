// Independent evidence index: community edits never overwrite the source bank.
// 独立考点索引；题干或选项变化后暂停评级，避免旧证据套到新题。
import data from "../data/focus-priorities.json" with { type: "json" };

export const focusData = data;
export const topicById = Object.fromEntries(data.topics.map(topic => [topic.id, topic]));
export const starLabels = Object.fromEntries(data.rules.map(rule => [rule.stars, rule.label]));
export function fingerprint(q) {
  const text = JSON.stringify([q.type, q.stem, q.options]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash.toString(16).padStart(8, "0");
}
export function assessQuestion(q) {
  const entry = data.questions[q.id];
  if (q.origin === "upload" || !entry) return { status: "new", stars: 0, topics: [] };
  if (entry.fingerprint !== fingerprint(q)) return { status: "changed", stars: 0, topics: [] };
  const topics = entry.topics.map(id => topicById[id]).filter(Boolean)
    .sort((a, b) => b.stars - a.stars || b.examTerms.length - a.examTerms.length);
  return { status: topics.length ? "rated" : "unmatched", stars: Math.max(0, ...topics.map(t => t.stars)), topics };
}
export function matchesFocus(assessment, level = "all", topic = "") {
  if (topic && !assessment.topics.some(t => t.id === topic)) return false;
  if (level === "all") return true;
  if (level === "unrated") return assessment.stars === 0;
  return level.endsWith("+") ? assessment.stars >= Number(level.slice(0, -1)) : assessment.stars === Number(level);
}
export function compareFocus(a, b) {
  return b.stars - a.stars || (b.topics[0]?.examTerms.length || 0) - (a.topics[0]?.examTerms.length || 0);
}
export function formatPages(spans, offset = 0) {
  return spans.map(([start, end]) => start === end ? `${start + offset}` : `${start + offset}–${end + offset}`).join("、");
}
export function termLabel(term) { const [year, month] = term.split("-"); return `${year} 年 ${Number(month)} 月`; }
