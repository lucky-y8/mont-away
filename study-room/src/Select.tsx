import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: string };
export default function Select({ label, value, options, onChange, disabled = false }: {
  label: string; value: string; options: Option[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});
  const selected = Math.max(0, options.findIndex(option => option.value === value));

  function show(index = selected) {
    if (disabled || !trigger.current || !options.length) return;
    const rect = trigger.current.getBoundingClientRect();
    const height = Math.min(256, options.length * 36 + 8);
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const upwards = below < height && above > below;
    const width = Math.min(Math.max(rect.width, 208), window.innerWidth - 24);
    setPosition({ width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: upwards ? undefined : rect.bottom + 5,
      bottom: upwards ? window.innerHeight - rect.top + 5 : undefined,
      maxHeight: Math.max(72, Math.min(height, upwards ? above : below)) });
    setActive(index); setOpen(true);
  }
  function choose(index: number) {
    onChange(options[index].value); setOpen(false); trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const scroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const resize = () => setOpen(false);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  useEffect(() => {
    if (open) menu.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const { key } = event;
    if (key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
    if (key === "Tab") { setOpen(false); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      event.preventDefault();
      const next = key === "Home" ? 0 : key === "End" ? options.length - 1 : Math.max(0, Math.min(options.length - 1, active + (key === "ArrowDown" ? 1 : -1)));
      if (open) setActive(next); else show(key === "Home" || key === "End" ? next : selected);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      if (open) choose(active); else show();
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing) {
      const found = options.findIndex(option => option.label.toLowerCase().startsWith(key.toLowerCase()));
      if (found >= 0) { event.preventDefault(); if (open) setActive(found); else show(found); }
    }
  }

  return <span ref={root} className="study-select">
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-haspopup="listbox"
      aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open ? id + "-" + active : undefined}
      disabled={disabled} className="select-trigger" onKeyDown={keyDown}
      onBlur={() => setOpen(false)} onClick={() => open ? setOpen(false) : show()}>
      <span>{options[selected]?.label}</span><ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && <span ref={menu} id={id} role="listbox" aria-label={label} className="select-menu" style={position}>
      {options.map((option, index) => <span id={id + "-" + index} key={option.value} role="option" aria-selected={option.value === value}
        className={`select-option ${index === active ? "is-active" : ""}`}
        onPointerDown={event => event.preventDefault()} onPointerMove={() => setActive(index)}
        onClick={event => { event.preventDefault(); choose(index); }}>
        <span>{option.label}</span>{option.value === value && <Check size={14} aria-hidden="true" />}
      </span>)}
    </span>}
  </span>;
}
