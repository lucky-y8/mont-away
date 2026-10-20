// Only the small plan is bundled; question bodies arrive through bounded batches.
// 前端只载入题单索引，题干与逐题解析仍按需增量获取。
import plan from '../../data/april-2026/plan.json' with { type: 'json' };
import { fingerprint } from '../priorities.js';

export const aprilPlan = plan;
const byId = Object.fromEntries(plan.items.map(item => [item.id, item]));
export function aprilEntry(q) {
  const item = byId[q.id];
  return item && q.practicePaper === plan.id && !q.origin && item.fingerprint === fingerprint(q) ? item : null;
}
