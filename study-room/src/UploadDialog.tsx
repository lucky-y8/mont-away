import { useEffect, useRef, useState } from "react";
import { Check, Download, FileUp, ImagePlus, Upload, X } from "lucide-react";
import Modal from "./Modal";
import materials from "../data/materials.json";
import Select from "./Select";
import { Question, QuestionType, typeNames } from "./types";

type Draft = { stem: string; type: QuestionType; chapter: number; options: string; answer: string; explanation: string; editor: string; reviewed: boolean };
type RecordInput = Omit<Draft, "options"> & { options: string[]; images: string[] };
type ImageDraft = { name: string; data: string };
type Preview = { questions: RecordInput[]; errors: string[]; total: number };
const KEY = "network-study-room:upload-draft:v1";
const blank: Draft = { stem: "", type: "short", chapter: 12, options: "", answer: "", explanation: "", editor: "", reviewed: false };
function readDraft(): Draft {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!value || typeof value !== "object") return blank;
    return { ...blank, ...Object.fromEntries(Object.entries(blank).filter(([key, sample]) => typeof value[key] === typeof sample).map(([key]) => [key, value[key]])),
      type: Object.hasOwn(typeNames, value.type) ? value.type : "short",
      chapter: Number.isInteger(value.chapter) && (value.chapter === 12 || materials.some(m => m.chapter === value.chapter)) ? value.chapter : 12 };
  } catch { return blank; }
}
function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("图片读取失败，请重新选择"));
    reader.readAsDataURL(file);
  });
}

export default function UploadDialog({ chapters, onClose, onCreated }: {
  chapters: { id: number; title: string }[]; onClose: () => void; onCreated: (questions: Question[]) => void;
}) {
  const [tab, setTab] = useState<"manual" | "batch">("manual");
  const [draft, setDraft] = useState<Draft>(readDraft);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const submission = useRef<{ payload: string; id: string } | null>(null);
  const locked = busy || reading;
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch {} }, [draft]);
  const close = () => { if (!locked) onClose(); };
  const field = (key: keyof Draft, value: string | number | boolean) => setDraft(current => ({ ...current, [key]: value }));

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    setImageError("");
    const selected = Array.from(files);
    if (images.length + selected.length > 4) { setImageError("每道题最多上传 4 张图片"); return; }
    if (selected.some(file => !["image/png", "image/jpeg", "image/webp"].includes(file.type))) { setImageError("请选择 PNG、JPG 或 WebP 图片"); return; }
    if (selected.some(file => file.size > 5 * 1024 * 1024)) { setImageError("每张图片不能超过 5 MB"); return; }
    setReading(true);
    try {
      const added = await Promise.all(selected.map(async file => ({ name: file.name, data: await readImage(file) })));
      setImages(current => [...current, ...added]);
    } catch (err) { setImageError(err instanceof Error ? err.message : "图片读取失败"); }
    finally { setReading(false); }
  }

  async function publish(records: RecordInput[]) {
    if (locked) return;
    setBusy(true); setError("");
    const payload = JSON.stringify(records);
    try {
      if (submission.current?.payload !== payload) submission.current = { payload, id: crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("") };
      const response = await fetch("/api/study/questions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: records, requestId: submission.current.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败，请重试");
      if (!Array.isArray(data.questions) || !data.questions.length) throw new Error("保存结果异常，请重试");
      if (tab === "manual") { try { localStorage.removeItem(KEY); } catch {} }
      onCreated(data.questions);
    } catch (err) { setError(err instanceof Error ? err.message : "网络连接失败，请重试；本次内容仍然保留。"); }
    finally { setBusy(false); }
  }

  function submitManual(event: React.FormEvent) {
    event.preventDefault();
    const options = draft.options.split("\n").map(option => option.trim()).filter(Boolean);
    if (["single", "multiple"].includes(draft.type) && options.length < 2) { setError("选择题至少填写两个选项"); return; }
    if (!draft.stem.trim()) { setError("请填写题干；图片题也请填写简短标题"); return; }
    void publish([{ ...draft, options, images: images.map(image => image.data) }]);
  }

  async function readBatch(file?: File) {
    if (!file) return;
    setPreview(null); setFilename(file.name); setError("");
    if (!/\.(csv|json)$/i.test(file.name)) { setError("请选择 CSV 或 JSON 文件"); return; }
    if (file.size > 2 * 1024 * 1024) { setError("文件不能超过 2 MB，请分批导入"); return; }
    setReading(true);
    try {
      const response = await fetch(`/api/study/import/preview?filename=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "文件校验失败");
      setPreview(data);
    } catch (err) { setError(err instanceof Error ? err.message : "文件读取失败，请重试"); }
    finally { setReading(false); }
  }

  return <Modal title="上传题目" subtitle="免登录 · 保存后所有人可见 · 支持共同编辑与历史版本" onClose={close} wide>
    <div className="upload-tabs" role="tablist" aria-label="上传方式">
      <button id="manual-tab" type="button" role="tab" aria-selected={tab === "manual"} aria-controls="manual-panel" disabled={locked} onClick={() => { setTab("manual"); setError(""); }}><ImagePlus size={17} />手动录入与图片</button>
      <button id="batch-tab" type="button" role="tab" aria-selected={tab === "batch"} aria-controls="batch-panel" disabled={locked} onClick={() => { setTab("batch"); setError(""); }}><FileUp size={17} />批量导入</button>
    </div>
    {tab === "manual" ? <form id="manual-panel" role="tabpanel" aria-labelledby="manual-tab" className="editor-form upload-form" onSubmit={submitManual}>
      <fieldset disabled={locked}>
        <div className="form-row"><label>题目类型<Select label="题目类型" value={draft.type} options={Object.entries(typeNames).map(([value, label]) => ({ value, label }))} onChange={value => field("type", value)} disabled={locked} /></label><label>所属章节<Select label="所属章节" value={String(draft.chapter)} options={[{ value: "12", label: "自建题目" }, ...chapters.map(chapter => ({ value: String(chapter.id), label: chapter.title }))]} onChange={value => field("chapter", Number(value))} disabled={locked} /></label></div>
        <label>题干 <span>必填；图片题可填写简短标题</span><textarea required rows={3} maxLength={12000} value={draft.stem} placeholder="输入题目，或写下图片题的标题…" onChange={event => field("stem", event.target.value)} /></label>
        <div className="upload-images">
          <label className="file-picker"><ImagePlus size={22} /><strong>添加题目图片</strong><span>PNG、JPG、WebP · 最多 4 张 · 每张 5 MB 以内</span><input type="file" aria-label="添加题目图片" accept="image/png,image/jpeg,image/webp" multiple onChange={event => { void addImages(event.target.files); event.target.value = ""; }} /></label>
          {images.length > 0 && <div className="image-previews">{images.map((image, index) => <div key={index}><img src={image.data} alt={image.name} /><span>{image.name}</span><button type="button" aria-label={`移除图片 ${index + 1}`} onClick={() => setImages(current => current.filter((_, i) => i !== index))}><X size={15} /></button></div>)}</div>}
          {imageError && <div className="form-error" role="alert">{imageError}</div>}
        </div>
        <label>选项 <span>每行一个选项，选择题至少两项，其他题型可留空</span><textarea rows={3} value={draft.options} maxLength={24012} placeholder={"选项 A 的内容\n选项 B 的内容"} onChange={event => field("options", event.target.value)} /></label>
        <div className="form-row"><label>参考答案 <span>选填</span><textarea rows={4} maxLength={8000} value={draft.answer} onChange={event => field("answer", event.target.value)} /></label><label>答案解析 <span>选填</span><textarea rows={4} maxLength={16000} value={draft.explanation} onChange={event => field("explanation", event.target.value)} /></label></div>
        <label>署名 <span>选填</span><input maxLength={30} placeholder="匿名同学" value={draft.editor} onChange={event => field("editor", event.target.value)} /></label>
        <label className="checkbox-label"><input type="checkbox" checked={draft.reviewed} onChange={event => field("reviewed", event.target.checked)} />我已对照课件或可靠资料核对本题</label>
      </fieldset>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-footer"><span>文字草稿自动保留；关闭窗口后需重新选择图片</span><button type="button" className="secondary-button" disabled={locked} onClick={close}>稍后继续</button><button type="submit" className="primary-button" disabled={locked}><Upload size={16} />{busy ? "正在保存…" : reading ? "正在读取…" : "保存并公开"}</button></div>
    </form> : <div id="batch-panel" role="tabpanel" aria-labelledby="batch-tab" className="editor-form batch-form">
      <div className="template-guide"><div><strong>先下载模板，再导入题目</strong><p>支持 CSV 与 JSON，一次 1–200 道、文件不超过 2 MB。CSV 请保存为 UTF-8；多条选项用 | 分隔。章节可填 0–11；新资料编号为 13–17，也可填“自建题目”。图片题请使用手动录入。</p></div><div className="template-links"><a href="/study-assets/templates/questions.csv" download><Download size={15} />CSV 模板</a><a href="/study-assets/templates/questions.json" download><Download size={15} />JSON 模板</a></div></div>
      <label className="file-picker"><FileUp size={25} /><strong>{reading ? "正在校验文件…" : "选择要导入的文件"}</strong><span>{filename || "上传后先预览，确认后才会公开保存"}</span><input type="file" aria-label="选择批量导入文件" accept=".csv,.json" disabled={locked} onChange={event => { void readBatch(event.target.files?.[0]); event.target.value = ""; }} /></label>
      {preview && (preview.errors.length > 0 ? <div className="form-error" role="alert"><strong>发现 {preview.errors.length} 处问题，本次尚未导入</strong><ul>{preview.errors.map((message, index) => <li key={index}>{message}</li>)}</ul><p>请修正文件后重新选择，全部通过后才能保存。</p></div> : <div className="import-preview"><div className="import-summary"><Check size={17} /><strong>校验通过 · 共 {preview.total} 道题</strong><span>等待确认</span></div><div className="import-rows">{preview.questions.map((question, index) => <details key={index}><summary><span>{index + 1}</span><strong>{question.stem}</strong><small>{typeNames[question.type]}</small></summary><div>{question.options.length > 0 && <p>{question.options.join("\n")}</p>}<p><b>答案：</b>{question.answer || "待补充"}</p><p><b>解析：</b>{question.explanation || "待补充"}</p></div></details>)}</div></div>)}
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-footer"><span>整批校验通过后统一保存</span><button className="secondary-button" disabled={locked} onClick={close}>取消</button><button className="primary-button" disabled={locked || !preview?.questions.length || !!preview.errors.length} onClick={() => preview && void publish(preview.questions)}><Upload size={16} />{busy ? "正在导入…" : `确认导入${preview?.questions.length ? ` ${preview.questions.length} 道题` : ""}`}</button></div>
    </div>}
  </Modal>;
}
