import { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, CircleAlert, RotateCcw, X } from 'lucide-react';
import type { Question } from './types';
import { fillCount, gradeResponse, immediateChoiceResult, responseOptions } from './grading.js';

export default function AnswerExercise({ q, active, choice, onChoice, onReveal, onWrong }: {
  q: Question; active: boolean; choice: string[];
  onChoice: (letters: string[]) => void; onReveal: (show: boolean) => void; onWrong: () => void;
}) {
  const [responses, setResponses] = useState<string[]>([]);
  const [result, setResult] = useState<ReturnType<typeof gradeResponse> | null>(null);
  const [checkedBlanks, setCheckedBlanks] = useState<Array<ReturnType<typeof gradeResponse>['blanks'][number] | undefined>>([]);
  const [selfAssessed, setSelfAssessed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composing = useRef(false);
  const latestResponses = useRef<string[]>([]);
  const options = responseOptions(q);
  const objective = ['single', 'multiple', 'truefalse'].includes(q.type) && options.length > 0;
  const slots = q.type === 'fill' ? fillCount(q) : 1;

  function cancelPending() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }
  useEffect(() => () => cancelPending(), []);

  function showResult(next: ReturnType<typeof gradeResponse> | null) {
    setResult(next); setSelfAssessed(false);
    if (next) {
      onReveal(true);
      if (next.status === 'incorrect') onWrong();
    }
  }

  function checkWritten(values = latestResponses.current) {
    cancelPending();
    if (!active || composing.current) return;
    const complete = Array.from({ length: slots }, (_, i) => i).every(i => values[i]?.trim());
    const next = gradeResponse(q, [], values);
    if (q.type === 'fill' && next.blanks.length) {
      const checked = next.blanks.map((blank, i) => values[i]?.trim() ? blank : undefined);
      setCheckedBlanks(checked);
      if (!complete && checked.some(blank => blank && !blank.correct)) onWrong();
    }
    showResult(complete ? next : null);
  }

  function writeResponse(index: number, value: string) {
    const next = [...latestResponses.current]; next[index] = value;
    latestResponses.current = next; setResponses(next);
    setResult(null); setSelfAssessed(false);
    setCheckedBlanks(previous => previous.map((blank, i) => i === index ? undefined : blank));
    cancelPending();
    // Wait for a pause, never grade an unfinished IME composition. / 停顿后核对，中文组词期间不判题。
    if (!composing.current) timer.current = setTimeout(() => checkWritten(next), 800);
  }

  function retry() {
    cancelPending(); latestResponses.current = []; composing.current = false;
    setResult(null); setSelfAssessed(false); setResponses([]); setCheckedBlanks([]); onChoice([]); onReveal(false);
  }

  function assess(correct: boolean) {
    setResult({ status: correct ? 'correct' : 'incorrect', expectedOptions: [], blanks: [] });
    setSelfAssessed(true);
    if (!correct) onWrong();
  }

  return <div className="answer-exercise">
    {options.length > 0 && <div className="options" role="group" aria-label="选择你的答案">{options.map((option, i) => {
      const letter = String.fromCharCode(65 + i), selected = choice.includes(letter);
      const correct = active && result?.expectedOptions.includes(letter);
      const wrong = active && result?.status === 'incorrect' && selected && !correct;
      return <button type="button" key={i} className={`option ${selected ? 'selected' : ''} ${correct ? 'answer-correct' : ''} ${wrong ? 'answer-incorrect' : ''}`} aria-pressed={selected} onClick={() => {
        const next = q.type === 'multiple' ? (selected ? choice.filter(v => v !== letter) : [...choice, letter].sort()) : selected && !active ? [] : [letter];
        onChoice(next);
        if (active && objective) showResult(immediateChoiceResult(q, next));
      }}><span className="option-letter">{letter}</span><span>{option.replace(/^[A-L][.．、:：)）]\s*/, '')}</span>{correct ? <span className="option-verdict"><Check size={16} />参考答案</span> : wrong ? <span className="option-verdict"><X size={16} />你的选择</span> : selected && <Check size={17} />}</button>;
    })}</div>}
    {options.length > 0 && <p className="answer-hint">{active ? q.type === 'multiple' ? '可选择多个选项；选齐或选错时自动提示。' : '点击选项立即核对，可以直接改选。' : `${q.type === 'multiple' ? '可选择多个选项' : '点击选项记录你的选择'}，可直接对照下方参考答案。`}</p>}
    {active && <>
      {!objective && <div className="written-answer">
        <div className="written-heading"><strong>我的答案</strong><span>{q.type === 'fill' ? '输入后自动核对，也可按回车' : '写下思路，停顿后自动展开参考答案'}</span></div>
        {q.type === 'fill' ? <div className="blank-inputs">{Array.from({ length: slots }, (_, i) => {
          const checked = checkedBlanks[i];
          return <label key={i} className={checked ? checked.correct ? 'blank-correct' : 'blank-incorrect' : ''}><span>第 {i + 1} 空</span><input name={`response-${i}`} aria-label={`第 ${i + 1} 空答案`} aria-invalid={checked ? !checked.correct : undefined} autoComplete="off" maxLength={1000} placeholder="输入答案" value={responses[i] || ''} onChange={event => writeResponse(i, event.target.value)} onBlur={() => checkWritten()} onCompositionStart={() => { composing.current = true; cancelPending(); }} onCompositionEnd={event => { composing.current = false; writeResponse(i, event.currentTarget.value); }} onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing && !composing.current && event.keyCode !== 229) { event.preventDefault(); checkWritten(); }
          }} />{checked && <small>{checked.correct ? <Check size={13} /> : <X size={13} />}{checked.correct ? '与参考答案一致' : `参考：${checked.expected}`}</small>}</label>;
        })}</div> : <textarea name="response-0" aria-label="我的答案或解题思路" rows={4} maxLength={8000} placeholder="可以先在纸上计算，再记下结果和主要步骤…" value={responses[0] || ''} onChange={event => writeResponse(0, event.target.value)} onBlur={() => checkWritten()} onCompositionStart={() => { composing.current = true; cancelPending(); }} onCompositionEnd={event => { composing.current = false; writeResponse(0, event.currentTarget.value); }} />}
      </div>}
      <div className="exercise-actions">{(result || choice.length > 0 || responses.some(Boolean)) && <button type="button" className="secondary-button" onClick={retry} onMouseDown={event => event.preventDefault()}><RotateCcw size={16} />重新作答</button>}<span>自动核对 · 答错加入本机错题本</span></div>
      {result && <div className={`answer-feedback feedback-${result.status}`} role="status" aria-live="polite" aria-atomic="true">
        <span className="feedback-symbol">{result.status === 'correct' ? <CheckCircle2 size={23} /> : <CircleAlert size={23} />}</span>
        <div><strong>{result.status === 'correct' ? selfAssessed ? '已记录：这道题答对了' : '回答正确，继续保持！' : result.status === 'incorrect' ? selfAssessed ? '已记录：这道题还需练习' : q.type === 'fill' ? '有空位与参考答案不一致' : '回答错误，再看一眼思路' : '答案已展开，请对照核对'}</strong>
          <p>{result.status === 'incorrect' ? '已加入错题本。可以直接修改作答，或查看下方答案与解析。' : result.status === 'correct' ? '答案已展开，也可以查看解析巩固思路。' : q.type === 'fill' ? '本题空位与参考答案无法逐一对应，请自行核对。' : objective ? '当前参考答案格式无法自动识别，请自行核对。' : '这道题需要结合完整答案或解题步骤自行判断。'}</p>
          {!selfAssessed && q.type === 'fill' && result.status !== 'review' && <p>按参考文字核对，忽略大小写、空格及全半角；同义表达可自行核对。</p>}
          {q.needsReview && !selfAssessed && <small>依据当前参考答案核对；资料或 AI 内容仍待复核。</small>}
          {result.status === 'review' && <div className="self-assessment"><button type="button" className="secondary-button" onClick={() => assess(true)}><Check size={15} />我答对了</button><button type="button" className="secondary-button" onClick={() => assess(false)}><RotateCcw size={15} />还需练习</button></div>}
        </div>
      </div>}
    </>}
  </div>;
}
