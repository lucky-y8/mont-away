import { ArrowUpRight, ChevronRight, FileText, Target } from 'lucide-react';
import type { Question } from '../types';
import { aprilEntry, aprilPlan } from './april-plan.js';
import './april-pattern.css';

export function AprilPatternGuide() {
  return <div className="april-guide">
    <div className="april-guide-heading"><strong>按 2026 年 4 月结构扩展</strong><span>31 题 · 100 分</span></div>
    <p>改换情境、问法和数值，检验是否真正掌握同类考点。每题附答案、详细解析、助记与变式自测。</p>
    <dl className="april-outline">
      <div><dt>填空章节</dt><dd>1 → 2 → 3 → 4 → 5 → 6 → 8 → 6 → 10 → 11</dd></div>
      <div><dt>简答章节</dt><dd>6 → 2 → 8 → 4</dd></div>
      <div><dt>综合方向</dt><dd>第四章 · 子网计算；第二章 · HTTP 时间计算</dd></div>
    </dl>
    <details className="prediction-method"><summary><FileText size={15} />查看编排依据与分值<ChevronRight size={15} /></summary>
      <div className="prediction-method-body">
        <p>{aprilPlan.method}</p>
        <div className="april-table-scroll" tabIndex={0} role="region" aria-label="题型和章节分布表，可横向滚动"><table><thead><tr><th>题型</th><th>数量 / 分值</th><th>章节顺序</th></tr></thead><tbody>
          <tr><td>选择</td><td>15 题 / 30 分</td><td>1、2、3、4、5、6、7、8、9、10、1、2、6、9、11</td></tr>
          <tr><td>填空</td><td>10 题 / 20 分</td><td>1、2、3、4、5、6、8、6、10、11</td></tr>
          <tr><td>简答</td><td>4 题 / 20 分</td><td>6、2、8、4</td></tr>
          <tr><td>综合</td><td>2 题 / 30 分</td><td>4、2</td></tr>
        </tbody></table></div>
        <p>简答练习：通信方式、电子邮件、密码体系、拥塞原因。综合题使用新数据，并列出逐步验算。模拟卷小问分值为练习安排，非官方评分细则。</p>
        <p className="prediction-limit">这一结构仅在2026年4月样本中出现；沿用结构练习不代表下一次仍按相同章节命题。</p>
        <div className="prediction-source-links"><a href={aprilPlan.sourceUrl} target="_blank" rel="noreferrer">2026 年 4 月真题 · 结构参考<ArrowUpRight size={12} /></a></div>
      </div>
    </details>
  </div>;
}

export function AprilPatternReason({ q }: { q: Question }) {
  const entry = aprilEntry(q);
  if (!entry) return null;
  return <details className="prediction-reason april-reason"><summary><Target size={14} /><span className="prediction-tier">模拟扩展 · {entry.points} 分</span><span>第 {entry.chapter} 章 · {entry.title}</span><ChevronRight size={14} /></summary>
    <div><p>{entry.reason}</p><p>本卷原始题号：第 {entry.number} 题。当前列表序号会随题型筛选改变。</p><div className="prediction-source-links"><a href={`${aprilPlan.sourceUrl}#page=${entry.page}`} target="_blank" rel="noreferrer">结构参考 · 2026年4月第 {entry.number} 题<ArrowUpRight size={12} /></a></div><small>AI 辅助编写的练习题；不计入历史真题频次，参考答案可共同编辑。</small></div>
  </details>;
}
