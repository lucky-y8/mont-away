

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Layers3, Search, ChevronRight, ChevronLeft, ArrowUpRight, Shuffle, Bookmark, Check, CheckCheck, CircleAlert, FileText, Pencil, History, X, Menu, LayoutList, RectangleHorizontal, Sparkles, RefreshCw, ArrowLeft, RotateCcw, Maximize2, Network, GraduationCap, CheckCircle2, Eye, Lightbulb, Download, SlidersHorizontal, Clock3, Palette, Upload, Star } from "lucide-react";
import { Question, QuestionType, Revision, typeNames, sourceNames } from "./types";
import Modal from "./Modal";
import QuestionPager from "./QuestionPager";
import Select from "./Select";
import ThemeSettings, { useTheme } from "./ThemeSettings";
import UploadDialog from "./UploadDialog";
import AnswerExercise from "./AnswerExercise";
import { automaticMnemonic, mnemonicText } from "./mnemonics.js";
import MnemonicPanel from "./MnemonicPanel";
import { QuestionExplanation } from "./prediction/PredictionLearning";
import { useQuestionFeed } from "./question-feed/useQuestionFeed";
import materials from "../data/materials.json";
import { FocusBadge, FocusGuide } from "./FocusPriority";
import { focusData, topicById } from "./priorities.js";

import { PredictionPlan, PredictionReason } from "./prediction/PredictionMode";
import { predictionData, predictionTypes, predictionRanges } from "./prediction/predictions.js";

type StudyMode = "practice" | "answer" | "prediction";
type Scope = "all" | "favorites" | "wrong" | "uploads";
type Personal = { favorites: string[]; wrong: string[]; mastered: string[]; seen: string[]; choices: Record<string, string[]> };
type Draft = { stem: string; options: string; answer: string; explanation: string; mnemonic: string; type: QuestionType; revision: number; editor: string; reviewed: boolean };
const emptyPersonal: Personal = { favorites: [], wrong: [], mastered: [], seen: [], choices: {} };
const STORAGE = "network-study-room:v1";
const dateText = (date: string) => date ? new Date(date).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "课件整理时";

function QuestionCard({ q, index, total, studyMode, personal, onFavorite, onMark, onSeen, onChoice, onWrong, onEdit, onHistory, onImage }: {
  q: Question; index: number; total: number; studyMode: StudyMode; personal: Personal;
  onWrong: (id: string) => void;
  onFavorite: (id: string) => void; onMark: (id: string, kind: "wrong" | "mastered") => void;
  onSeen: (id: string) => void; onChoice: (id: string, letters: string[]) => void;
  onEdit: (q: Question) => void; onHistory: (q: Question) => void; onImage: (url: string) => void;
}) {
  const [answerOpen, setAnswerOpen] = useState(studyMode === "practice");
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [mnemonicOpen, setMnemonicOpen] = useState(studyMode === "practice");
  const answerPanel = useRef<HTMLElement>(null);
  const originalFigure = useRef<HTMLDetailsElement>(null);
  // 自动展开时只统计真正进入视口的答案。 / Count auto-opened answers only when visible.
  useEffect(() => {
    const panel = answerPanel.current;
    if (!answerOpen || !panel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { onSeen(q.id); observer.disconnect(); }
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [answerOpen, q.id, onSeen]);
  const favorite = personal.favorites.includes(q.id);
  const choice = personal.choices[q.id] || [];
  return <article className="question-card" id={`question-${q.id}`}>
    <div className="question-top"><div className="question-labels"><span className="type-badge">{studyMode === "prediction" && q.type === "calculation" ? "综合题 · 15 分" : typeNames[q.type]}</span><span className="question-number">{String(index + 1).padStart(2, "0")} <span>/ {total}</span></span>{personal.mastered.includes(q.id) && <span className="mastered-label"><CheckCircle2 size={13} /> 已掌握</span>}</div>
      <div className="card-tools"><button className={`icon-button ${favorite ? "is-favorite" : ""}`} aria-label={favorite ? "取消收藏" : "收藏题目"} title={favorite ? "取消收藏" : "收藏题目"} onClick={() => onFavorite(q.id)}><Bookmark size={18} fill={favorite ? "currentColor" : "none"} /></button><button className="icon-button" aria-label="编辑题目" title="编辑题目" onClick={() => onEdit(q)}><Pencil size={17} /></button><button className="icon-button" aria-label="历史版本" title="历史版本" onClick={() => onHistory(q)}><History size={18} /></button></div>
    </div>
    {studyMode === "prediction" ? <PredictionReason q={q} /> : <FocusBadge q={q} />}
    {q.practicePaper && studyMode !== "prediction" && <p className="learning-small">AI 模拟扩展题 · 第 {q.chapter} 章 · 参考2026年4月结构</p>}
    <div className="question-stem">{q.stem}</div>
    {q.figures.length > 0 && <details ref={originalFigure} className="original-figure" open={!(studyMode !== "practice" && q.figuresContainAnswer)}><summary><FileText size={14} /><span>{q.origin === "upload" ? "查看上传的题目图片" : q.figuresContainAnswer ? "对照原题图（含答案）" : "对照资料原题图"}</span><small>{q.figuresContainAnswer ? "原图含答案，作答后查看" : "公式与配图以原图为准"}</small><ChevronRight size={14} /></summary><div className="question-figures">{q.figures.map((url, i) => <button key={url} onClick={() => onImage(url)} className="figure-button" aria-label={`放大第 ${i + 1} 张原题图片`}><img src={url} alt={`原题配图 ${i + 1}`} loading="lazy" /><span><Maximize2 size={13} /> 放大原图</span></button>)}</div></details>}
    <AnswerExercise q={q} active={studyMode !== "practice"} choice={choice} onChoice={letters => onChoice(q.id, letters)} onWrong={() => onWrong(q.id)} onReveal={show => {
      setAnswerOpen(show);
      if (show) { onSeen(q.id); setMnemonicOpen(true); }
      else { setExplanationOpen(false); setMnemonicOpen(false); if (q.figuresContainAnswer && originalFigure.current) originalFigure.current.open = false; }
    }} />
    <div className="answer-actions"><button className={`primary-button ${answerOpen ? "button-active" : ""}`} aria-expanded={answerOpen} onClick={() => { setAnswerOpen(!answerOpen); if (!answerOpen) setMnemonicOpen(true); }}><Eye size={17} />{answerOpen ? "收起答案" : "查看答案"}</button><button className={`secondary-button ${explanationOpen ? "button-active" : ""}`} aria-expanded={explanationOpen} onClick={() => { setExplanationOpen(!explanationOpen); if (!explanationOpen) setMnemonicOpen(true); onSeen(q.id); }}><Lightbulb size={17} />{explanationOpen ? "收起解析" : "答案解析"}</button><button className={`secondary-button ${mnemonicOpen ? "button-active" : ""}`} aria-expanded={mnemonicOpen} aria-controls={`mnemonic-${q.id}`} onClick={() => setMnemonicOpen(!mnemonicOpen)}><Sparkles size={17} />{mnemonicOpen ? "收起助记" : "助记"}</button></div>
    {answerOpen && <section className="answer-panel" ref={answerPanel}><div className="panel-caption"><CheckCheck size={16} /><strong>参考答案</strong><span>{sourceNames[q.answerSource]}{q.needsReview && q.answerSource !== "course" ? " · 待核对" : ""}</span></div><div className="text-content">{q.answer || "这道题还没有答案，欢迎点击右上角编辑补充。"}</div>{q.answerFigures?.length > 0 && <div className="answer-figures"><span className="small-label">资料中的答案与解题过程</span>{q.answerFigures.map((url, i) => <button className="figure-button" key={url} onClick={() => onImage(url)} aria-label={`放大第 ${i + 1} 张答案原图`}><img src={url} alt={`答案原图 ${i + 1}`} loading="lazy" /><span><Maximize2 size={13} />放大答案原图</span></button>)}</div>}{choice.length > 0 && <div className="your-choice">我的选择：{choice.join("、")}</div>}</section>}
    {explanationOpen && <QuestionExplanation q={q} prediction={studyMode === "prediction"} />}
    {mnemonicOpen && <MnemonicPanel q={q} prediction={studyMode === "prediction"} />}
    <div className="question-bottom">{q.origin === "upload" ? <span className="source-link"><Upload size={14} />同学上传{q.editor ? ` · ${q.editor}` : ""}</span> : <a href={`${q.sourceUrl}#page=${q.pages[0]}`} target="_blank" rel="noreferrer" className="source-link" title={q.sourceFile}><FileText size={14} />{q.practicePaper ? `命题结构参考 · 第 ${q.sourceQuestion} 题` : `资料 · 第 ${q.pages.join("、")} 页`}<ArrowUpRight size={13} /></a>}<div className="self-mark"><button className={personal.wrong.includes(q.id) ? "marked-wrong" : ""} aria-pressed={personal.wrong.includes(q.id)} onClick={() => onMark(q.id, "wrong")}><CircleAlert size={15} />{personal.wrong.includes(q.id) ? "已入错题" : "加入错题"}</button><button className={personal.mastered.includes(q.id) ? "marked-mastered" : ""} aria-pressed={personal.mastered.includes(q.id)} onClick={() => onMark(q.id, "mastered")}><CheckCircle2 size={15} />{personal.mastered.includes(q.id) ? "已掌握" : "我掌握了"}</button></div></div>
  </article>;
}

function EditDialog({ q, restore, onClose, onSaved }: { q: Question; restore?: Question; onClose: () => void; onSaved: (q: Question) => void }) {
  const makeDraft = (source: Question): Draft => ({ stem: source.stem, options: source.options.join("\n"), answer: source.answer, explanation: source.explanation, mnemonic: source.mnemonic || "", type: source.type, revision: q.revision || 0, editor: "", reviewed: !source.needsReview });
  const [draft, setDraft] = useState<Draft>(() => makeDraft(restore || q));
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [conflict, setConflict] = useState<Question | null>(null); const [recovered, setRecovered] = useState(false);
  useEffect(() => { try { if (!restore) { const cached = localStorage.getItem(`${STORAGE}:draft:${q.id}`); if (cached) { const parsed = JSON.parse(cached); if (typeof parsed.stem === "string" && Number.isInteger(parsed.revision)) { setDraft({ ...makeDraft(q), ...parsed, mnemonic: typeof parsed.mnemonic === "string" ? parsed.mnemonic : q.mnemonic || "" }); setRecovered(true); } } } } catch {} setReady(true); }, [q.id, restore]);
  useEffect(() => { if (ready) try { localStorage.setItem(`${STORAGE}:draft:${q.id}`, JSON.stringify(draft)); } catch {} }, [draft, ready, q.id]);
  const field = (name: keyof Draft, value: string | boolean) => setDraft(d => ({ ...d, [name]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/study/questions/${q.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, options: draft.options.split("\n").map(v => v.trim()).filter(Boolean) }) });
      const data = await response.json() as { question: Question; current?: Question; error?: string };
      if (!response.ok) { if (response.status === 409 && data.current) setConflict(data.current); throw new Error(data.error || "保存失败"); }
      try { localStorage.removeItem(`${STORAGE}:draft:${q.id}`); } catch {}
      onSaved(data.question);
    } catch (err) { setError(err instanceof Error ? err.message : "网络连接失败，草稿已保留，请重试。"); }
    finally { setBusy(false); }
  }
  return <Modal title={restore ? "恢复历史内容" : "一起完善这道题"} subtitle="无需登录 · 保存后所有人可见 · 历史版本可恢复" onClose={onClose} wide>
    <form onSubmit={submit} className="editor-form">
      {recovered && <div className="inline-note">已恢复你上次未提交的草稿。<button type="button" onClick={() => { setDraft(makeDraft(q)); setRecovered(false); }}>重新载入当前题目</button></div>}
      {restore && <div className="inline-note">正在恢复所选版本的文字内容。保存会创建新版本，历史记录仍然保留。</div>}
      <div className="form-row"><label>题目类型<Select label="题目类型" value={draft.type} options={Object.entries(typeNames).map(([value, label]) => ({ value, label }))} onChange={value => field("type", value)} disabled={busy} /></label><label>署名 <span>选填</span><input maxLength={30} placeholder="匿名同学" value={draft.editor} onChange={e => field("editor", e.target.value)} /></label></div>
      <label>题干<textarea required rows={5} maxLength={12000} value={draft.stem} onChange={e => field("stem", e.target.value)} /></label>
      <label>选项 <span>每行一个选项，非选择题可留空</span><textarea rows={4} value={draft.options} onChange={e => field("options", e.target.value)} /></label>
      <label>参考答案<textarea rows={3} maxLength={8000} value={draft.answer} onChange={e => field("answer", e.target.value)} /></label>
      <label>答案解析<textarea rows={7} maxLength={16000} value={draft.explanation} onChange={e => field("explanation", e.target.value)} /></label>
      <label>助记 <span>选填；留空显示资料助记，可填写自己的口诀、联想或谐音</span><textarea rows={4} maxLength={4000} value={draft.mnemonic} placeholder={automaticMnemonic({ ...q, ...draft, options: draft.options.split("\n").filter(Boolean) })} onChange={e => field("mnemonic", e.target.value)} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={draft.reviewed} onChange={e => field("reviewed", e.target.checked)} />我已对照课件或可靠资料核对本题</label>
      {error && <div role="alert" className="form-error">{error}</div>}
      {conflict && <div className="conflict-panel"><h3>其他同学刚刚更新的内容（版本 {conflict.revision}）</h3><details open><summary>展开对照最新题目、答案和解析</summary><p className="text-content">{conflict.stem}</p><p className="text-content">{conflict.options.join("\n")}</p><p className="text-content">答案：{conflict.answer}</p><p className="text-content">解析：{conflict.explanation}</p><p className="text-content">助记：{mnemonicText(conflict)}</p></details><button type="button" className="secondary-button" onClick={() => { setDraft(d => ({ ...d, revision: conflict.revision || 0 })); setConflict(null); setError("请在上方合并需要保留的内容，再点击保存。"); }}>已对照，保留草稿继续合并</button></div>}
      <div className="form-footer"><span>原始题图和课件来源会保留</span><button type="button" className="secondary-button" onClick={onClose}>稍后继续</button><button className="primary-button" type="submit" disabled={busy || !!conflict}><Check size={17} />{busy ? "正在保存…" : "保存并公开"}</button></div>
    </form>
  </Modal>;
}

function HistoryDialog({ q, onClose, onRestore }: { q: Question; onClose: () => void; onRestore: (q: Question) => void }) {
  const [rows, setRows] = useState<Revision[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  async function reload() { setLoading(true); setError(""); try { const res = await fetch(`/api/study/questions/${q.id}`, { cache: "no-store" }); const data = await res.json() as { error?: string; history: Revision[] }; if (!res.ok) throw new Error(data.error); setRows(data.history); } catch (e) { setError(e instanceof Error ? e.message : "历史版本加载失败"); } finally { setLoading(false); } }
  useEffect(() => { void reload(); }, [q.id]);
  return <Modal title="每一次完善，都有记录" subtitle="可查看并恢复任意版本，原始题目始终保留。" onClose={onClose} wide><div className="history-body">{loading && <div className="loading-state">正在加载历史版本…</div>}{error && <div className="form-error">{error}<button onClick={reload}>重试</button></div>}{rows.map((row, i) => <details className="history-row" key={row.revision} open={i === 0}><summary><span className="history-dot" /><div><strong>{row.revision === 0 ? "初始版本" : `版本 ${row.revision}`}{i === 0 && <span className="current-label">当前</span>}</strong><p>{row.editor} · {dateText(row.editedAt)}</p></div><ChevronRight size={17} /></summary><div className="history-content"><span className="small-label">题干</span><p className="text-content">{row.question.stem}</p>{row.question.options.length > 0 && <p className="text-content">{row.question.options.join("\n")}</p>}<span className="small-label">答案与解析</span><p className="text-content">{row.question.answer}</p><p className="text-content">{row.question.explanation}</p><span className="small-label">助记</span><p className="text-content">{mnemonicText(row.question)}</p><button className="secondary-button" onClick={() => onRestore(row.question)}><RotateCcw size={15} />以此版本编辑恢复</button></div></details>)}</div></Modal>;
}

export default function StudyApp() {
  const [theme, setTheme, currentThemeStyle] = useTheme();
  const [themeOpen, setThemeOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>("practice");
  const [predictionRange, setPredictionRange] = useState("paper");
  const [personal, setPersonal] = useState<Personal>(emptyPersonal);
  const [chapter, setChapter] = useState<number | null>(null); const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState(""); const [type, setType] = useState("all"); const [mode, setMode] = useState<"single" | "list">("single");
  const [focusLevel, setFocusLevel] = useState("all"); const [focusSort, setFocusSort] = useState("original"); const [focusTopic, setFocusTopic] = useState(""); const [focusGuideOpen, setFocusGuideOpen] = useState(false);
  const [currentId, setCurrentId] = useState(""); const [listLimit, setListLimit] = useState(20);
  const [ready, setReady] = useState(false); const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<{ q: Question; restore?: Question } | null>(null); const [historyQ, setHistoryQ] = useState<Question | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false); const [image, setImage] = useState<string | null>(null); const [toast, setToast] = useState("");
  const filters = useMemo(() => ({ chapter, scope, type, query, focusLevel, focusSort, focusTopic,
    prediction: studyMode === "prediction" ? predictionRange : null,
    ids: scope === "favorites" || scope === "wrong" ? personal[scope] : [], mastered: personal.mastered,
  }), [chapter, scope, type, query, focusLevel, focusSort, focusTopic, studyMode, predictionRange, personal.favorites, personal.wrong, personal.mastered]);
  const { ids, index, summary, questions, loading, sync, refresh, accept } = useQuestionFeed({ready, filters, currentId, mode, listLimit});
  const current = questions.find(q => q.id === ids[index]);
  const visibleQuestions = ids.slice(0, listLimit).map(id => questions.find(q => q.id === id)).filter((q): q is Question => Boolean(q));
  const fileChapters = useMemo(() => materials.map(m => ({id:m.chapter, title:m.title, kind:m.kind, count:summary.chapters[m.chapter] || 0})), [summary]);
  const totalPages = materials.reduce((sum, m) => sum + m.pageCount, 0);
  const chapters = summary.chapters[12] ? [...fileChapters, {id:12, title:"自建题目", count:summary.chapters[12]}] : fileChapters;
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(STORAGE) || "null"); if (saved) { const p = saved.personal; if (p && ["favorites", "wrong", "mastered", "seen"].every(k => Array.isArray(p[k]))) setPersonal({ ...emptyPersonal, ...p }); if (saved.mode === "list") setMode("list"); if (["answer", "prediction"].includes(saved.studyMode)) setStudyMode(saved.studyMode); if (predictionRanges.includes(saved.predictionRange)) setPredictionRange(saved.predictionRange); if (Number.isInteger(saved.chapter) && (saved.chapter === 12 || materials.some(m => m.chapter === saved.chapter))) setChapter(saved.chapter); if (typeof saved.currentId === "string") setCurrentId(saved.currentId); if (["all", "favorites", "wrong", "uploads"].includes(saved.scope)) setScope(saved.scope); if (["all", "5", "4+", "3+", "2", "1", "unrated"].includes(saved.focusLevel)) setFocusLevel(saved.focusLevel); if (saved.focusSort === "priority") setFocusSort("priority"); if (topicById[saved.focusTopic]) setFocusTopic(saved.focusTopic); } } catch { setToast("本机记录无法读取，已使用默认设置。"); } setReady(true); }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(STORAGE, JSON.stringify({ personal, mode, studyMode, predictionRange, chapter, currentId, scope, focusLevel, focusSort, focusTopic })); } catch { setToast("浏览器未允许保存记录，当前进度将在关闭页面后丢失。"); } }, [ready, personal, mode, studyMode, predictionRange, chapter, currentId, scope, focusLevel, focusSort, focusTopic]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(""), 4500); return () => clearTimeout(timer); } }, [toast]);
  useEffect(() => { setListLimit(20); }, [chapter, scope, query, type, focusLevel, focusSort, focusTopic, studyMode, predictionRange]);
  const seen = useCallback((id: string) => setPersonal(p => p.seen.includes(id) ? p : { ...p, seen: [...p.seen, id] }), []);
  const favorite = (id: string) => setPersonal(p => ({ ...p, favorites: p.favorites.includes(id) ? p.favorites.filter(v => v !== id) : [...p.favorites, id] }));
  const mark = (id: string, kind: "wrong" | "mastered") => setPersonal(p => ({ ...p, [kind]: p[kind].includes(id) ? p[kind].filter(v => v !== id) : [...p[kind], id], ...(kind === "mastered" && !p.mastered.includes(id) ? { wrong: p.wrong.filter(v => v !== id) } : {}), ...(kind === "wrong" && !p.wrong.includes(id) ? { mastered: p.mastered.filter(v => v !== id) } : {}), seen: p.seen.includes(id) ? p.seen : [...p.seen, id] }));
  // Set membership, never toggle: retries must not remove earlier mistakes. / 重复答错仍保留在错题本。
  const recordWrong = (id: string) => setPersonal(p => ({ ...p, wrong: p.wrong.includes(id) ? p.wrong : [...p.wrong, id], mastered: p.mastered.filter(value => value !== id) }));
  const choose = (id: string, letters: string[]) => setPersonal(p => ({ ...p, choices: { ...p.choices, [id]: letters } }));
  const scrollToQuestion = (id: string) => { setTimeout(() => document.getElementById(`question-${id}`)?.scrollIntoView({ block: "start", behavior: "smooth" }), 50); };
  const navigate = (next: number) => { if (!ids[next]) return; setCurrentId(ids[next]); document.querySelector(".questions-column")?.scrollIntoView({ block: "start", behavior: "smooth" }); };
  const selectChapter = (id: number | null) => { if (studyMode === "prediction") { setStudyMode("practice"); setType("all"); setQuery(""); } setChapter(id); setCurrentId(""); setMenuOpen(false); };
  const selectScope = (next: Scope) => { if (studyMode === "prediction") setStudyMode("practice"); setScope(next); setChapter(null); setQuery(""); setType("all"); setFocusLevel("all"); setFocusTopic(""); setFocusSort("original"); setCurrentId(""); setMenuOpen(false); };
  const changeStudyMode = (next: StudyMode) => {
    // Enter a clean exam-only pool; preserve personal progress and shared edits.
    // 进入独立押题范围，保留个人进度及共享修改。
    if (next === "prediction" || studyMode === "prediction") {
      setScope("all"); setChapter(null); setQuery(""); setType("all");
      setFocusLevel("all"); setFocusTopic(""); setFocusSort("original"); setCurrentId("");
    }
    setStudyMode(next);
  };
  const choosePredictionQuestion = (id: string) => { setPredictionRange("extended"); setType("calculation"); setQuery(""); setMode("single"); setCurrentId(id); scrollToQuestion(id); };
  const chooseFocusTopic = (id: string) => { selectScope("all"); setFocusTopic(id); setFocusSort("priority"); setFocusGuideOpen(false); window.scrollTo({ top: 220, behavior: "smooth" }); };
  const startHighPriority = () => { selectScope("all"); setFocusLevel("4+"); setFocusSort("priority"); };
  const shuffle = () => { if (!ids.length) return; const candidates = ids.filter(id => id !== ids[index]); setCurrentId(candidates[Math.floor(Math.random() * candidates.length)] || ids[index]); setMode("single"); setToast("已为你随机选择一道题"); };
  const progress = summary.total ? Math.round(summary.mastered / summary.total * 100) : 0;
  const cardProps = { studyMode, personal, onFavorite: favorite, onMark: mark, onSeen: seen, onChoice: choose, onWrong: recordWrong, onEdit: (q: Question) => setEditing({ q }), onHistory: setHistoryQ, onImage: setImage };
  const heading = studyMode === "prediction" ? `${predictionData.target} · 押题练习` : scope === "favorites" ? "我的收藏" : scope === "wrong" ? "错题再练一次" : scope === "uploads" ? "同学上传题目" : chapter !== null ? chapters.find(ch => ch.id === chapter)?.title || "自建题目" : "今天，也向前一步。";

  return <div className="app-shell" style={currentThemeStyle}>
    {menuOpen && <button className="mobile-backdrop" aria-label="关闭导航" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <a className="brand" href="/" aria-label="13017刷题首页"><span className="brand-mark"><Network size={24} /></span><span><strong>13017刷题</strong><small>13017 PRACTICE</small></span></a>
      <div className="workspace-label">你的学习空间</div>
      <nav aria-label="题库导航" className="main-nav"><button className={scope === "all" ? "nav-active" : ""} onClick={() => selectScope("all")}><Layers3 size={18} /><span>全部题库</span><span className="nav-count">{summary.total}</span></button><button className={scope === "favorites" ? "nav-active" : ""} onClick={() => selectScope("favorites")}><Bookmark size={18} /><span>我的收藏</span><span className="nav-count">{personal.favorites.length}</span></button><button className={scope === "wrong" ? "nav-active" : ""} onClick={() => selectScope("wrong")}><CircleAlert size={18} /><span>错题本</span><span className="nav-count">{personal.wrong.length}</span></button><button className={scope === "uploads" ? "nav-active" : ""} onClick={() => selectScope("uploads")}><Upload size={18} /><span>同学上传</span><span className="nav-count">{summary.uploads}</span></button></nav>
      <div className="sidebar-materials">
      <div className="chapters-heading"><span>真题与专项总结</span><span>{fileChapters.filter(ch => ch.id >= 13).length}</span></div>
      <nav className="chapter-nav material-nav" aria-label="新增资料筛选">{fileChapters.filter(ch => ch.id >= 13).map(ch => <button key={ch.id} className={chapter === ch.id ? "chapter-selected" : ""} onClick={() => selectChapter(ch.id)} title={ch.title}><span className="chapter-symbol"><FileText size={14} /></span><span className="chapter-title">{ch.title}</span><span className="chapter-count">{ch.count}</span></button>)}</nav>
      <div className="chapters-heading"><span>按章节 / 资料练习</span><span>{chapters.length}</span></div>
      <nav className="chapter-nav" aria-label="章节筛选"><button className={chapter === null ? "chapter-selected" : ""} onClick={() => selectChapter(null)}><span className="chapter-symbol"><BookOpen size={15} /></span><span>全部章节与资料</span></button>{chapters.filter(ch => ch.id < 13).map(ch => <button key={ch.id} className={chapter === ch.id ? "chapter-selected" : ""} onClick={() => selectChapter(ch.id)} title={ch.title}><span className="chapter-symbol">{ch.id === 12 ? "+" : String(ch.id).padStart(2, "0")}</span><span className="chapter-title">{ch.title.replace(/^第[一二三四五六七八九十\d]+章\s*/, "")}</span><span className="chapter-count">{ch.count}</span></button>)}</nav>
      </div>
      <div className="sidebar-bottom"><a className="shanyao-link" href="/shanyao/">山遥 · 去发现旅行目的地 <ArrowUpRight size={15} /></a><div className="open-badge"><span className="status-dot" /><span>一个开放的共同题库</span></div><p>自由学习，也欢迎留下你的解题思路。</p><button onClick={() => { setLibraryOpen(true); setMenuOpen(false); }}><FileText size={16} />浏览全部资料<ArrowUpRight size={15} /></button></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="打开章节导航" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><GraduationCap size={18} /><span>计算机网络与信息安全</span><ChevronRight size={14} /><span className="breadcrumb-muted">练习空间</span></div><div className="topbar-right"><button className="toolbar-button" onClick={() => setThemeOpen(true)} aria-label="主题颜色"><Palette size={17} /><span>主题</span></button><button className="toolbar-button upload-entry" onClick={() => setUploadOpen(true)} aria-label="上传题目"><Upload size={17} /><span>上传题目</span></button><span className={`sync-label ${sync}`}><span className="status-dot" />{sync === "ok" ? "题库已同步" : sync === "loading" ? "正在同步" : "同步暂不可用"}</span><button className="avatar" title="无需登录，个人进度保存在本机" onClick={() => setToast("免登录使用。收藏、错题和进度保存在当前浏览器。")}>同学</button></div></header>
      <main className="main-content">
        <section className="welcome"><div><div className="eyebrow"><span />LEARN A LITTLE, EVERY DAY</div><h1>{heading}</h1><p>{scope === "favorites" ? "值得再看一遍的题目，都在这里。" : scope === "wrong" ? "把每一次卡住，变成下一次进步。" : "把知识连成网络，让每一道题都有收获。"}</p></div><div className="course-label"><span>自考课程</span><strong>{chapter === 17 ? "04741" : "13017"}</strong><span>{chapter === 17 ? "计算题专项练习" : "课件与真题练习"}</span></div></section>
        <section className="overview" aria-label="学习概况"><div><span className="stat-icon mint"><Layers3 size={20} /></span><div><span className="stat-title">共享题库</span><strong>{summary.total}<small>道题</small></strong></div></div><div><span className="stat-icon blue"><BookOpen size={20} /></span><div><span className="stat-title">全部资料</span><strong>{materials.length}<small>份 · {totalPages} 页</small></strong></div></div><div><span className="stat-icon amber"><CheckCheck size={20} /></span><div><span className="stat-title">我的已复习</span><strong>{personal.seen.length}<small>道题</small></strong></div><span className="progress-mini">慢慢来，也很快</span></div></section>
        {sync === "error" && <div className="sync-error" role="status"><CircleAlert size={16} /><span>共享题库暂时连接不上，当前显示已载入的内容。</span><button onClick={() => void refresh()}><RefreshCw size={14} />重新连接</button></div>}
        {studyMode !== "prediction" && <section className="focus-banner" aria-label="考点星级">
          <span className="focus-banner-icon"><Star size={21} /></span>
          <div className="focus-banner-copy"><strong>{focusData.target} · 重点复习</strong><p>{focusData.topics.length} 个考点 · {focusData.examTerms.length} 套完整真题 · 星越多，复习优先级越高，不代表命题概率</p></div>
          <div className="focus-banner-actions"><button className="secondary-button" onClick={() => setFocusGuideOpen(true)}>查看重点分布<ChevronRight size={14} /></button><button className="primary-button" onClick={startHighPriority}>先练高星题</button></div>
        </section>}
        <section className="practice-section">
          <div className="section-heading"><div><h2>{studyMode === "prediction" ? (predictionRange === "paper" ? "31 题押题卷" : predictionRange === "april-2026" ? "2026年4月规律扩展卷" : "扩展题单") : chapter === null ? "开始练习" : (chapter === 0 ? "导学课练习" : chapter === 12 ? "自建题目练习" : chapter >= 13 ? materials.find(m => m.chapter === chapter)?.title : `第 ${chapter} 章练习`)}</h2><span>{ids.length} 道题目</span></div><div className="view-switch" role="group" aria-label="题目显示方式"><button className={mode === "single" ? "selected" : ""} aria-pressed={mode === "single"} aria-label="单题显示" title="单题显示" onClick={() => setMode("single")}><RectangleHorizontal size={16} /><span>单题显示</span></button><button className={mode === "list" ? "selected" : ""} aria-pressed={mode === "list"} aria-label="列表显示" title="列表显示" onClick={() => setMode("list")}><LayoutList size={16} /><span>列表显示</span></button></div></div>
          <div className="study-mode-bar">
            <div className="study-mode-switch" role="group" aria-label="学习模式">
              <button aria-pressed={studyMode === "practice"} onClick={() => changeStudyMode("practice")}><BookOpen size={17} />练习模式</button>
              <button aria-pressed={studyMode === "answer"} onClick={() => changeStudyMode("answer")}><Pencil size={17} />答题模式</button>
              <button aria-pressed={studyMode === "prediction"} onClick={() => changeStudyMode("prediction")}><Sparkles size={17} />押题模式</button>
            </div>
            <p>{studyMode === "practice" ? "直接展示答案，边看边学" : studyMode === "prediction" ? "真题精选，先作答再看答案" : "点击或输入，自动核对答案"}</p>
          </div>
          {studyMode === "prediction" && <PredictionPlan counts={summary.prediction} loaded={summary.total > 0} range={predictionRange} type={type} onRange={value => { setPredictionRange(value); setType("all"); setCurrentId(""); setQuery(""); }} onType={value => { setType(value); setCurrentId(""); setQuery(""); }} onQuestion={choosePredictionQuestion} />}
          <div className="filter-bar"><label className="search-box"><Search size={18} /><input aria-label="搜索题目" placeholder="搜索题目、关键词…" value={query} onChange={e => { setQuery(e.target.value); setCurrentId(""); }} />{query && <button onClick={() => setQuery("")} aria-label="清除搜索"><X size={15} /></button>}</label><label className="type-select"><SlidersHorizontal size={15} /><Select label="筛选题型" value={type} options={[{ value: "all", label: "全部题型" }, ...Object.entries(studyMode === "prediction" ? predictionTypes : typeNames).map(([value, label]) => ({ value, label }))]} onChange={value => { setType(value); setCurrentId(""); }} /></label><button className="shuffle-button" onClick={shuffle} disabled={!ids.length}><Shuffle size={17} />随机一题</button></div>
          {studyMode !== "prediction" && <div className="focus-filters" aria-label="重点筛选">
            <span><Star size={14} />复习重点</span>
            <Select label="筛选星级" value={focusLevel} options={[{value:"all",label:"全部星级"},{value:"5",label:"★★★★★ 高频重点"},{value:"4+",label:"4 星及以上"},{value:"3+",label:"3 星及以上"},{value:"2",label:"★★ 基础覆盖"},{value:"1",label:"★ 拓展了解"},{value:"unrated",label:"待评估"}]} onChange={value => { setFocusLevel(value); setCurrentId(""); }} />
            <Select label="题目排序" value={focusSort} options={[{value:"original",label:"按资料顺序"},{value:"priority",label:"星级从高到低"}]} onChange={value => { setFocusSort(value); setCurrentId(""); }} />
            {focusTopic && <button className="focus-topic-chip" onClick={() => { setFocusTopic(""); setCurrentId(""); }} aria-label="清除考点筛选"><span>{topicById[focusTopic]?.title}</span><X size={13} /></button>}
            {(focusLevel !== "all" || focusTopic || focusSort !== "original") && <button className="focus-clear" onClick={() => { setFocusLevel("all"); setFocusTopic(""); setFocusSort("original"); setCurrentId(""); }}>清除重点筛选</button>}
          </div>}
          <div className="practice-layout"><div className="questions-column">
            {!ready ? <div className="loading-state">正在恢复学习设置…</div> : !ids.length && (loading || sync === "error") ? <div className="loading-state">{sync === "error" ? "题库加载失败，请点击上方重新连接。" : "正在加载题目目录…"}</div> : !ids.length ? <div className="empty-state"><Search size={32} /><h3>{scope === "favorites" ? "还没有收藏题目" : scope === "wrong" ? "错题本还是空的" : "这里还没有匹配的题目"}</h3><p>{scope === "favorites" ? "点击题目右上角的书签，下次就能快速找到。" : scope === "wrong" ? "遇到需要巩固的题目，点「加入错题」留给下次复习。" : "试试其他关键词、题型或章节。"}</p><button className="secondary-button" onClick={() => selectScope("all")}>回到全部题库<ChevronRight size={16} /></button></div> : mode === "single" && !current ? <div className="loading-state">{sync === "error" ? "这批题目暂未加载成功，请点击上方重新连接。" : "正在加载这一组题目…"}</div> : mode === "single" ? <><QuestionCard key={`${studyMode}-${current.id}-${current.revision || 0}`} q={current} index={index} total={ids.length} {...cardProps} /><QuestionPager index={index} total={ids.length} onNavigate={navigate} /></> : <><div className="list-note"><LayoutList size={15} />{studyMode === "practice" ? "连续浏览，答案已直接展示，解析可按需展开" : "连续作答，逐题查看答案与解析"}</div>{visibleQuestions.map((q, i) => <div key={q.id} onPointerDown={() => setCurrentId(q.id)}><QuestionCard key={`${studyMode}-${q.id}-${q.revision || 0}`} q={q} index={i} total={ids.length} {...cardProps} /></div>)}{loading && <div className="loading-state">正在加载题目…</div>}{listLimit < ids.length && <button className="load-more secondary-button" disabled={loading} onClick={() => setListLimit(n => n + 20)}>继续加载 {Math.min(20, ids.length - listLimit)} 道题<ChevronRight size={16} /></button>}</>}
          </div><aside className="study-rail"><div className="progress-card"><div className="rail-title"><span>一点一滴的进步</span><CheckCircle2 size={17} /></div><div className="progress-number">{progress}<span>%</span><small>已掌握</small></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><p>已掌握 {personal.mastered.length} 道 / 共 {summary.total} 道</p><div className="rail-divider" /><div className="rail-row"><span><Bookmark size={14} />我的收藏</span><strong>{personal.favorites.length}</strong></div><div className="rail-row"><span><CircleAlert size={14} />待巩固错题</span><strong>{personal.wrong.length}</strong></div><small className="local-note">进度与收藏保存在当前浏览器</small></div>
            <div className="community-card"><span className="community-icon"><Pencil size={18} /></span><h3>好题库，一起完善</h3><p>发现错字，或有更好的解法？<br />每位同学都能直接编辑。</p><div><span className="mini-avatar">你</span><span className="mini-avatar">我</span><span className="mini-avatar">他</span><span>每一份分享都有价值</span></div><small><History size={13} />所有修改均保留历史版本</small></div>
            <div className="study-tip"><Lightbulb size={18} /><div><strong>{studyMode === "practice" ? "对照答案，理解思路" : "先想一想，再看答案"}</strong><p>{studyMode === "practice" ? "答案已展开，遇到不理解的地方可打开解析。" : "点击或输入后自动核对，答错加入错题本。"}AI 补充内容会标注来源，欢迎对照课件核对。</p></div></div>
            <button className="library-link" onClick={() => setLibraryOpen(true)}><FileText size={17} /><span>打开原始资料</span><ArrowUpRight size={17} /></button>
          </aside></div>
        </section><footer className="page-footer"><span>13017刷题 <span>·</span> 让学习发生在每一天</span><span>公开访问 · 免登录共建</span></footer>
      </main>
    </div>
    {editing && <EditDialog key={editing.q.id + (editing.restore ? "-restore" : "")} {...editing} onClose={() => setEditing(null)} onSaved={q => { void accept([q]); setEditing(null); setToast("修改已保存，其他同学也能看到这次完善。"); }} />}
    {historyQ && <HistoryDialog q={historyQ} onClose={() => setHistoryQ(null)} onRestore={old => { setEditing({ q: questions.find(q => q.id === historyQ.id) || historyQ, restore: old }); setHistoryQ(null); }} />}
    {image && <Modal title="原题图片" subtitle="保留课件原图，便于核对公式、符号和配图。" wide onClose={() => setImage(null)}><div className="image-viewer"><img src={image} alt="放大的原题图片" /><a href={image} target="_blank" rel="noreferrer">打开完整分辨率<ArrowUpRight size={14} /></a></div></Modal>}
    {libraryOpen && <Modal title="学习资料库" subtitle={`全部 ${materials.length} 份资料 · 共 ${totalPages} 页`} wide onClose={() => setLibraryOpen(false)}><div className="library-grid">{materials.map(m => <a href={`/study-assets${m.sourceUrl}`} target="_blank" rel="noreferrer" key={m.id}><span className="pdf-icon"><FileText size={23} /><small>PDF</small></span><div><small>{m.kind === "course" ? (m.chapter === 0 ? "课程导学" : `第 ${m.chapter} 章`) : `${m.courseCode} · ${m.kind === "exam" ? "历年真题" : "专项总结"}`}</small><strong>{m.title}</strong><span>{summary.sourceCounts[m.chapter] || 0} 道题 · {m.pageCount} 页</span></div><ArrowUpRight size={18} /></a>)}</div></Modal>}
    {focusGuideOpen && <FocusGuide counts={summary.topics} onClose={() => setFocusGuideOpen(false)} onChoose={chooseFocusTopic} />}
    {themeOpen && <ThemeSettings theme={theme} onChange={setTheme} onClose={() => setThemeOpen(false)} />}
    {uploadOpen && <UploadDialog chapters={fileChapters} onClose={() => setUploadOpen(false)} onCreated={added => {
      void accept(added);
      setUploadOpen(false); if (studyMode === "prediction") setStudyMode("practice"); setScope("all"); setChapter(null); setQuery(""); setType("all"); setFocusLevel("all"); setFocusTopic(""); setFocusSort("original"); setMode("single"); setCurrentId(added[0].id); setMenuOpen(false); setToast(`已公开添加 ${added.length} 道题目`); window.scrollTo({ top: 0 });
    }} />}
    {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}<button aria-label="关闭提示" onClick={() => setToast("")}><X size={15} /></button></div>}
  </div>;
}
