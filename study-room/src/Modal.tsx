import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const el = ref.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={`modal ${wide ? "modal-wide" : ""}`} onCancel={event => { event.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-head"><div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="关闭窗口" onClick={onClose}><X size={20} /></button></div>{children}
  </dialog>;
}
