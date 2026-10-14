import { useMemo, useState } from "react";
import { Star, ChevronRight, ArrowUpRight, BookOpen, Info } from "lucide-react";
import type { Question } from "./types";
import { typeNames } from "./types";
import Modal from "./Modal";
import Select from "./Select";
import { assessQuestion, focusData, starLabels, formatPages, termLabel } from "./priorities.js";
import "./focus.css";

export function Stars({ value }: { value: number }) {
  return <span className="priority-stars" role="img" aria-label={`${value} 星，共 5 星`}>
    {[1, 2, 3, 4, 5].map(n => <Star key={n} size={14} aria-hidden="true" className={n <= value ? "filled" : "empty"} fill={n <= value ? "currentColor" : "none"} />)}
  </span>;
}

function Evidence({ topic }: { topic: typeof focusData.topics[number] }) {
  return <section className="focus-evidence">
    <div className="focus-evidence-heading"><h3>{topic.title}</h3><Stars value={topic.stars} /></div>
    <p>{topic.importance === "core" ? "教材 / 大纲重点" : topic.importance === "general" ? "一般考核内容" : "教材拓展内容"} · {topic.level}</p>
    <div className="focus-page-ref"><BookOpen size={15} /><span>教材第 {topic.chapter} 章 · 第 {formatPages(topic.bookPages)} 页<br /><small>电子书 PDF 第 {formatPages(topic.bookPages, focusData.book.pdfPageOffset)} 页；书内大纲第 {topic.syllabusPages.join("–")} 页。</small></span></div>
    <strong className="focus-evidence-count">已收录 {focusData.examTerms.length} 个考期中，{topic.examTerms.length} 个考期出现此考点</strong>
    {topic.evidence.length ? <div className="focus-exam-links">{topic.evidence.map(item => <a key={item.id} href={`${item.sourceUrl}#page=${item.page}`} target="_blank" rel="noreferrer">{termLabel(item.term)} · 第 {item.number} 题 · {typeNames[item.type]}<ArrowUpRight size={12} /></a>)}</div> : <p className="focus-no-evidence">尚无完整真题样本支持；星级来自教材与大纲要求。</p>}
    <p className="focus-advice"><strong>复习方向</strong>{topic.advice}</p>
  </section>;
}

export function FocusBadge({ q }: { q: Question }) {
  const [open, setOpen] = useState(false);
  const assessment = useMemo(() => assessQuestion(q), [q]);
  return <div className="question-priority">
    <button className={`priority-badge ${assessment.stars ? "" : "unrated"}`} onClick={() => setOpen(true)} aria-label={`查看星级依据：${assessment.stars ? `${assessment.stars} 星，${starLabels[assessment.stars]}` : "待评估"}`}>
      <Stars value={assessment.stars} /><span>{assessment.stars ? starLabels[assessment.stars] : "待评估"}</span><span className="priority-detail-label">星级依据</span><ChevronRight size={13} />
    </button>
    {open && <Modal title="这道题为什么标这些星？" subtitle={`${focusData.target} · AI 辅助划分复习优先级，不代表原题重考概率。`} wide onClose={() => setOpen(false)}>
      <div className="focus-dialog-content">
        {assessment.status !== "rated" ? <div className="focus-pending"><Info size={20} /><p>{assessment.status === "changed" ? "这道题的题干、选项或题型已修改，原有考点评级暂停显示，等待重新核对。" : "这道题尚未纳入教材与真题考点核对，暂不赋予星级。"}待评估不表示不重要。</p></div> : <>
          <p className="focus-short-rule">{focusData.rules.find(rule => rule.stars === assessment.stars)?.description} 涉及多个考点时，采用其中最高星级。</p>
          {q.materialId === "calculation" && <p className="focus-short-rule">本题来自 04741 专项资料，仅作为相同考点的迁移练习；其历史年份不计入 13017 真题频次。</p>}
          {assessment.topics.map(topic => <Evidence topic={topic} key={topic.id} />)}
        </>}
        <p className="focus-source-note">依据：{focusData.book.author}《{focusData.book.title}》{focusData.book.edition}及书内大纲。样本截至 {termLabel([...focusData.examTerms].sort().at(-1)!)}，共 {focusData.examTerms.length} 套完整真题；汇总资料中的重复题不重复计数。</p>
      </div>
    </Modal>}
  </div>;
}

export function FocusGuide({ questions, onClose, onChoose }: { questions: Question[]; onClose: () => void; onChoose: (id: string) => void }) {
  const [chapter, setChapter] = useState("all");
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const q of questions) for (const topic of assessQuestion(q).topics) result[topic.id] = (result[topic.id] || 0) + 1;
    return result;
  }, [questions]);
  const topics = [...focusData.topics].filter(t => chapter === "all" || t.chapter === Number(chapter))
    .sort((a, b) => b.stars - a.stars || b.examTerms.length - a.examTerms.length || a.chapter - b.chapter);
  return <Modal title="教材重点与真题分布" subtitle={`${focusData.target} · ${focusData.topics.length} 个考点 · 更新于 ${focusData.updatedAt}`} wide onClose={onClose}>
    <div className="focus-dialog-content">
      <p className="focus-intro">星越多，越值得优先复习。综合应用题优先练子网划分与基带编码，再补齐 HTTP / DNS、窗口协议、信道容量等大纲应用要求。</p>
      <details className="focus-method"><summary><Info size={15} />评分方法与资料范围<ChevronRight size={14} /></summary>
        <div className="focus-method-body">
          <p>以教材及大纲的重点要求为基础，再按出现过同一考点的不同考期加星。同一套卷内多题、汇总资料重复收录，均不额外加星；没有“很久没考就一定会考”的加分。</p>
          <div className="focus-rules">{focusData.rules.map(rule => <div key={rule.stars}><Stars value={rule.stars} /><p><strong>{rule.label}</strong> · {rule.description}</p></div>)}</div>
          <p>教材：{focusData.book.author}《{focusData.book.title}》，{focusData.book.publisher}，{focusData.book.edition}。{focusData.book.readScope}</p>
          <p>书内大纲第 20–21 页说明：重点内容分值一般不少于 60%；识记、领会、应用分值约为 20%、40%、40%。这是整卷内容要求，不是单题命中率。</p>
          <p>完整真题：{focusData.examTerms.map(termLabel).join("、")}，共 {focusData.examQuestionCount} 道题。{focusData.limitations[1]}</p>
          <p>{focusData.limitations[0]} {focusData.limitations[2]} {focusData.limitations[3]}</p>
          <a href={focusData.book.catalogueUrl} target="_blank" rel="noreferrer">核对官方教材目录<ArrowUpRight size={12} /></a><p>{focusData.book.catalogueNote}</p>
        </div>
      </details>
      <div className="focus-guide-toolbar"><strong>按考点开始练习</strong><Select label="筛选教材章节" value={chapter} options={[{ value: "all", label: "全部教材章节" }, ...Array.from({ length: 11 }, (_, i) => ({ value: String(i + 1), label: `教材第 ${i + 1} 章` }))]} onChange={setChapter} /></div>
      <div className="focus-topic-list">{topics.map(topic => <button key={topic.id} className="focus-topic-row" disabled={!counts[topic.id]} onClick={() => onChoose(topic.id)}>
        <span className="focus-topic-chapter">{String(topic.chapter).padStart(2, "0")}</span><span className="focus-topic-copy"><strong>{topic.title}</strong><small>教材第 {formatPages(topic.bookPages)} 页 · {topic.examTerms.length}/{focusData.examTerms.length} 个考期出现 · {counts[topic.id] || 0} 道关联题</small></span><Stars value={topic.stars} /><ChevronRight size={15} />
      </button>)}</div>
      <p className="focus-source-note">低星和未出现的考点仍需覆盖。题型、数字和问法可能变化，理解原理比记住原题更有用。</p>
    </div>
  </Modal>;
}
