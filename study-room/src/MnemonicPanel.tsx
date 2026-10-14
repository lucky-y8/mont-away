import { useMemo, useState } from 'react';
import { BookOpen, CircleAlert, Sparkles } from 'lucide-react';
import { Question } from './types';
import { mnemonicDetails } from './mnemonics.js';
import './mnemonics.css';

const pages = (range: number[]) => range[0] === range[1] ? String(range[0]) : range.join('–');

export default function MnemonicPanel({ q }: { q: Question }) {
  const details = useMemo(() => mnemonicDetails(q), [q]);
  const [selected, setSelected] = useState('');
  const cards = details.cards.map((card, i) => ({ ...card, key: `${details.ruleId || 'answer'}-${i}`, label: card.kind }));
  const active = cards.find(card => card.key === selected) || cards[0];
  const reference = details.reference;
  const original = q.origin !== 'upload' && q.sourceUrl?.startsWith('/study-assets/') && q.pages?.length;
  return <section id={`mnemonic-${q.id}`} className="mnemonic-panel" aria-label="助记提示">
    <div className="panel-caption"><Sparkles size={16} /><strong>助记提示</strong><span>{details.custom ? '同学共同完善' : reference ? '结合教材整理' : '根据当前答案整理'}</span></div>
    {details.warning && <p className="mnemonic-warning"><CircleAlert size={14} /><span>{details.warning}</span></p>}
    {cards.length > 1 && <div className="mnemonic-methods" role="group" aria-label="助记方式">{cards.map(card => <button type="button" key={card.key} aria-pressed={card.key === active.key} aria-controls={`mnemonic-content-${q.id}`} onClick={() => setSelected(card.key)}>{card.label}</button>)}</div>}
    <div id={`mnemonic-content-${q.id}`} className="mnemonic-content" aria-live="polite" aria-atomic="true">
      {active.cue && <p className="mnemonic-cue">{active.cue}</p>}
      <p className="text-content">{active.meaning}</p>
      {active.note && <p className="mnemonic-note"><strong>记准一点</strong>{active.note}</p>}
    </div>
    {!details.custom && <div className="mnemonic-footer">
      {reference && <details className="mnemonic-reference"><summary><BookOpen size={13} /><span>教材依据 · 第 {pages(reference.pages)} 页</span></summary><p>{reference.book}<br />{reference.title} · PDF 第 {pages(reference.pdfPages)} 页<br />口诀和联想为辅助记忆的改写，不是教材原句。</p></details>}
      <div className="mnemonic-source-line"><span>{reference ? '先记线索，再还原知识点' : '关键词随答案更新'}{q.needsReview ? ' · 答案待核对' : ''}</span>{original && <a href={`${q.sourceUrl}#page=${q.pages[0]}`} target="_blank" rel="noreferrer">对照本题资料 ↗</a>}</div>
    </div>}
  </section>;
}
