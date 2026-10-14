import { useState } from 'react';
import { BookOpen, Eye, EyeOff, Lightbulb, Sparkles } from 'lucide-react';
import { Question, sourceNames } from '../types';
import { predictionLesson, hasLearningDraft, wavePoints } from './learning.js';
import './learning.css';

type Lesson = NonNullable<ReturnType<typeof predictionLesson>>;
function LearningSources({ q, lesson }: { q: Question; lesson: Lesson }) {
  const pageLabel = lesson.bookPages.length ? (lesson.bookPages[0] === lesson.bookPages[1] ? String(lesson.bookPages[0]) : lesson.bookPages.join('–')) : '';
  return <details className="learning-sources">
    <summary><BookOpen size={13} />核对依据与说明</summary>
    <p>本题原卷与当前参考答案是对应依据。口诀、推导与变式由 AI 整理；不代表官方评分答案。</p>
    {pageLabel && <p>教材定位：李全龙《计算机网络与信息安全》（2024 年版），书内第 {pageLabel} 页。口诀是辅助改写，教材定位不作为押题入选权重。</p>}
    <a href={`${q.sourceUrl}#page=${q.pages[0]}`} target="_blank" rel="noreferrer">对照本题原卷 ↗</a>
    {lesson.links?.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.title} ↗</a>)}
  </details>;
}

export function PredictionMnemonic({ q, lesson }: { q: Question; lesson: Lesson }) {
  const [hidden, setHidden] = useState(false);
  return <section id={`mnemonic-${q.id}`} className="mnemonic-panel prediction-mnemonic" aria-label="助记提示">
    <div className="panel-caption"><Sparkles size={16} /><strong>助记提示</strong><span>AI 逐题整理</span></div>
    <div className="learning-cue-header"><span>{lesson.title}</span><button type="button" className="learning-hide" aria-pressed={hidden} onClick={() => setHidden(v => !v)}>{hidden ? <Eye size={14} /> : <EyeOff size={14} />}{hidden ? '再看口诀' : '遮住口诀自测'}</button></div>
    {!hidden && <div className="mnemonic-content"><p className="mnemonic-cue">{lesson.cue}</p><ul className="learning-mapping">{lesson.mapping.map(line => <li key={line}>{line}</li>)}</ul></div>}
    {hidden && <p className="learning-cover" role="status">口诀已遮住。先用自己的话回答下面的问题，再展开核对。</p>}
    <div className="learning-recall"><span className="learning-eyebrow">快速回忆</span><p>{lesson.recall.prompt}</p><details key={String(hidden)}><summary>展开回忆答案</summary><p>{lesson.recall.answer}</p></details></div>
    <p className="learning-small">先记短句 → 还原正式术语 → 遮住自测。能独立说清，比只觉得熟悉更有用。</p>
    <LearningSources q={q} lesson={lesson} />
  </section>;
}

function Waveform({ wave }: { wave: NonNullable<Lesson['wave']> }) {
  const width = 40 + wave.levels.length * 36 + 20;
  return <figure className="learning-wave"><div className="learning-scroll" tabIndex={0} role="region" aria-label="逐位波形，可横向滚动"><svg viewBox={`0 0 ${width} 137`} width={width} role="img" aria-label={`${wave.label}；信息码 ${wave.bits}；电平 ${wave.levels.map(n => n > 0 ? '+E' : n < 0 ? '−E' : '0').join('、')}`}>
    {[48,76,104].map((y, i) => <g key={y}><line x1="35" x2={width-8} y1={y} y2={y} className="wave-axis" /><text x="3" y={y+4}>{['+E','0','−E'][i]}</text></g>)}
    {wave.bits.split('').map((bit,i) => <g key={i}><line x1={40+i*36} x2={40+i*36} y1="31" y2="115" className="wave-grid"/><text x={58+i*36} y="20" textAnchor="middle">{bit}</text><text x={58+i*36} y="132" textAnchor="middle" className="wave-index">{i+1}</text></g>)}
    <line x1={40+wave.levels.length*36} x2={40+wave.levels.length*36} y1="31" y2="115" className="wave-grid"/>
    <polyline points={wavePoints(wave.levels, wave.duty)} className="wave-signal" />
  </svg></div><figcaption>{wave.label}。上排是信息码，下排是位序；每格一个比特周期。{wave.duty < 1 ? '非零脉冲在半周期回零。' : '每个电平保持完整位周期。'}窄屏可左右滑动查看全部位序。</figcaption></figure>;
}

export function QuestionExplanation({ q, prediction }: { q: Question; prediction: boolean }) {
  const lesson = prediction ? predictionLesson(q) : null;
  const original = <><div className="panel-caption"><Sparkles size={16} /><strong>原有解析</strong><span>{sourceNames[q.explanationSource]}{q.needsReview && q.explanationSource !== 'course' ? ' · 待核对' : ''}</span></div><div className="text-content">{q.explanation || '解析待补充。你可以把自己的解题思路写进来。'}</div></>;
  return <section className="explanation-panel" aria-label="答案解析">
    {lesson ? <div className="prediction-learning">
      <div className="panel-caption"><Lightbulb size={16}/><strong>思路与解析</strong><span>AI 补充 · 可展开自测</span></div>
      <h3>{lesson.title}</h3><p className="learning-concept">{lesson.concept}</p>
      <h4>{q.type === 'calculation' ? '逐步推导与验算' : q.type === 'short' ? '答题要点，逐项展开' : '怎样得到答案'}</h4>
      <ol className="learning-steps">{lesson.steps.map(line => <li key={line}>{line}</li>)}</ol>
      {lesson.table && <div className="learning-scroll" tabIndex={0} role="region" aria-label="计算结果对照表，可横向滚动"><table className="learning-table"><caption>本题结果对照</caption><thead><tr>{lesson.table.headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{lesson.table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>}
      {lesson.wave && <Waveform wave={lesson.wave}/>}
      <details className="learning-expand"><summary>易错辨析 · {lesson.pitfalls.length} 个提醒</summary><ul>{lesson.pitfalls.map(line=><li key={line}>{line}</li>)}</ul></details>
      <details className="learning-expand"><summary>举一反三 · 变式自测</summary><p>{lesson.extension.prompt}</p><details className="learning-solution"><summary>展开变式答案与思路</summary><p>{lesson.extension.answer}</p></details></details>
      <details className="learning-expand learning-original"><summary>原有解析与来源</summary>{original}</details>
      <LearningSources q={q} lesson={lesson}/>
    </div> : <>
      <div className="panel-caption"><Sparkles size={16}/><strong>思路与解析</strong><span>{sourceNames[q.explanationSource]}{q.needsReview && q.explanationSource !== 'course' ? ' · 待核对' : ''}</span></div>
      <div className="text-content">{q.explanation || '解析待补充。你可以把自己的解题思路写进来。'}</div>
      {prediction && hasLearningDraft(q) && <p className="learning-small">本题内容已修改，旧的逐题学习补充暂不显示。请以当前答案和解析为准。</p>}
    </>}
  </section>;
}
