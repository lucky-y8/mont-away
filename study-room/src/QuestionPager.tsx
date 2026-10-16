import { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './pagination.css';

export default function QuestionPager({ index, total, onNavigate }: {
  index: number; total: number; onNavigate: (index: number) => void;
}) {
  const [value, setValue] = useState(String(index + 1));
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  useEffect(() => { setValue(String(index + 1)); setError(''); }, [index, total]);

  function jump(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = value.trim();
    const page = Number(text);
    // Validate against the current filtered result, then load only the target batch.
    // 按当前筛选结果校验，直接取目标批次，不顺序加载中间题目。
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(page) || page < 1 || page > total) {
      setError(`请输入 1～${total} 之间的整数页码。`);
      input.current?.focus();
      return;
    }
    setError('');
    setValue(String(page));
    onNavigate(page - 1);
  }

  return <nav className="question-pagination" aria-label="题目分页">
    <div className="question-pager">
      <button className="secondary-button" disabled={index === 0} onClick={() => onNavigate(index - 1)}><ChevronLeft size={17} />上一题</button>
      <span aria-live="polite">第 <strong>{index + 1}</strong> / {total} 题</span>
      <button className="primary-button" disabled={index >= total - 1} onClick={() => onNavigate(index + 1)}>下一题<ChevronRight size={17} /></button>
    </div>
    <form className="page-jump" onSubmit={jump} noValidate>
      <label htmlFor={fieldId}>跳至</label>
      <input ref={input} id={fieldId} aria-label="跳转页码" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
        type="text" inputMode="numeric" autoComplete="off" maxLength={10} value={value}
        onFocus={event => event.currentTarget.select()} onChange={event => { setValue(event.target.value); setError(''); }} />
      <span>页</span>
      <button className="secondary-button" type="submit">跳转</button>
      <small>每页 1 题</small>
    </form>
    {error && <p id={errorId} className="page-jump-error" role="alert">{error}</p>}
  </nav>;
}
