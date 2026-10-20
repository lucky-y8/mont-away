import { ArrowUpRight, ChevronRight, FileText, Layers3, ListChecks, Target } from 'lucide-react';
import type { Question } from '../types';
import { termLabel } from '../priorities.js';
import { predictionData, predictionTypes, predictionTopicById, predictionEntry, predictionCoverage } from './predictions.js';
import './prediction.css';
import { aprilPlan } from './april-plan.js';
import { AprilPatternGuide, AprilPatternReason } from './AprilPattern';

export function PredictionPlan({ counts, loaded, range, type, onRange, onType, onQuestion }: {
  counts: Record<string, {id:string; type:string}[]>; loaded: boolean; range: string; type: string; onRange: (value: string) => void;
  onType: (value: string) => void; onQuestion: (id: string) => void;
}) {
  const core = counts.paper, extended = counts.extended;
  const isApril = range === aprilPlan.id;
  const selected = counts[range] || [];
  const missing = isApril ? aprilPlan.items.length - selected.length : predictionData.items.length - extended.length;
  const mainCoverage = predictionCoverage(), allCoverage = predictionCoverage(true);
  const available = new Set(extended.map(q => q.id));
  return <section className="prediction-plan" aria-label="押题计划">
    <div className="prediction-heading"><span className="prediction-icon"><Target size={23} /></span><div><span className="prediction-eyebrow">EXAM FOCUS · {isApril ? aprilPlan.version : predictionData.version}</span><h3>{isApril ? aprilPlan.title : `${predictionData.target} · 押题练习`}</h3><p>{isApril ? '按最新收录考期的结构，练习新的问法与数值。' : '只看 4 套完整真题，练熟反复出现的考点与问法。'}</p></div><span className="prediction-source-tag">{isApril ? "AI 模拟变式" : "历年真题精选"}</span></div>
    <div className="prediction-range" role="group" aria-label="押题范围">
      <button aria-pressed={range === 'paper'} onClick={() => onRange('paper')}><ListChecks size={18} /><span><strong>31 题押题卷</strong><small>15 选择 · 10 填空 · 4 简答 · 2 综合</small></span><b>{core.length}</b></button>
      <button aria-pressed={range === 'extended'} onClick={() => onRange('extended')}><Layers3 size={18} /><span><strong>60 题扩展题单</strong><small>补充备选考点，覆盖综合题六种模板</small></span><b>{extended.length}</b></button>
      <button className="april-range-button" aria-pressed={isApril} onClick={() => onRange(aprilPlan.id)}><FileText size={18} /><span><strong>2026 年 4 月规律扩展卷</strong><small>新增 31 道模拟题 · 100 分 · 含解析与助记</small></span><b>{(counts[aprilPlan.id] || []).length}</b></button>
    </div>
    <div className="prediction-type-heading"><span>按题型练习</span><button className={type === 'all' ? 'selected' : ''} aria-pressed={type === 'all'} onClick={() => onType('all')}>全部 {selected.length} 题</button></div>
    <div className="prediction-types" role="group" aria-label="押题题型">{Object.entries(predictionTypes).map(([key, label], i) => <button key={key} aria-pressed={type === key} onClick={() => onType(key)}><small>0{i + 1}</small><strong>{label}</strong><span>{selected.filter(q => q.type === key).length} 题{key === 'calculation' ? ' · 每题 15 分' : ''}</span><ChevronRight size={15} /></button>)}</div>
    {loaded && missing > 0 && <p className="prediction-change-note" role="status">{missing} 道精选题已被修订或暂不可用，已暂停其押题关联；当前数量以上方实际可用题数为准。</p>}
    {isApril ? <AprilPatternGuide /> : <details className="prediction-method"><summary><FileText size={15} />押题依据与历史覆盖<ChevronRight size={15} /></summary><div className="prediction-method-body">
      <p>样本：{predictionData.examTerms.map(termLabel).join('、')}，共 {predictionData.examQuestionCount} 道题。选题只参考试卷，不使用教材权重；答案、解析与助记沿用题库的来源标注。</p>
      <div className="prediction-coverage"><div><small>综合题 · 主押子网与编码</small><strong>{mainCoverage.covered}/{mainCoverage.total}<span>历史题目覆盖</span></strong><p>{mainCoverage.percent}% · {mainCoverage.fullPapers}/4 套两道均覆盖</p></div><div><small>综合题 · 加入 HTTP 备选</small><strong>{allCoverage.covered}/{allCoverage.total}<span>历史题目覆盖</span></strong><p>{allCoverage.percent}% · {allCoverage.fullPapers}/4 套两道均覆盖</p></div><div><small>{predictionData.target} · 实际命中</small><strong className="prediction-pending">待考后核对</strong><p>选题版本冻结于 {predictionData.frozenAt}</p></div></div>
      <p className="prediction-limit">75% / 100% 是归纳这四套卷后的历史覆盖，不是下一次考试的命中率。考点出现也不代表原题重考或能拿满分。</p>
      <div className="prediction-template-heading"><strong>综合题 · 六种模板</strong><span>点击进入对应真题</span></div>
      <div className="prediction-templates">{predictionData.templates.map(item => <button key={item.title} disabled={!available.has(item.questionId)} onClick={() => onQuestion(item.questionId)}><span>{item.tier}</span><div><strong>{item.title}</strong><p>{item.text}</p></div><ChevronRight size={15} /></button>)}</div>
      <p>小题优先 UDP、通信方式、密码分类、内容安全；简答主押入侵检测、UDP 应用选择、协议三要素、移动 IP。扩展题单加入最新一期的邮件、密码五要素和拥塞原因等备选。</p>
      <div className="prediction-source-links">{predictionData.examSources.map(source => <a key={source.id} href={source.sourceUrl} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={12} /></a>)}</div>
    </div></details>}
  </section>;
}

export function PredictionReason({ q }: { q: Question }) {
  if (q.practicePaper === aprilPlan.id) return <AprilPatternReason q={q} />;
  const entry = predictionEntry(q);
  if (!entry) return null;
  const topics = entry.topics.map(id => predictionTopicById[id]);
  return <details className="prediction-reason"><summary><Target size={14} /><span className="prediction-tier">{entry.tier === 'main' ? '主卷精选' : '扩展练习'}</span><span>{topics.map(t => t.title).join(' / ')}</span><span className="prediction-reason-label">为什么选这题</span><ChevronRight size={14} /></summary><div><p>{entry.reason}</p>{topics.map(topic => <section key={topic.id}><strong>{topic.title} · {topic.examTerms.length}/4 个考期出现</strong><div className="prediction-source-links">{topic.evidence.map(e => <a key={e.id} href={`${e.sourceUrl}#page=${e.page}`} target="_blank" rel="noreferrer">{termLabel(e.term)} · 第 {e.number} 题<ArrowUpRight size={11} /></a>)}</div></section>)}<small>次数统计针对考点，多个同考期题目只记一个考期；不换算未来命题概率。</small></div></details>;
}
