import { useEffect, useState, type CSSProperties } from "react";
import { Check, RotateCcw } from "lucide-react";
import Modal from "./Modal";

const KEY = "network-study-room:background:v1";
const DEFAULT = "#f6f8f5";
const valid = (color: unknown): color is string => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color);
const presets = [
  { name: "薄荷白", color: DEFAULT }, { name: "暖米色", color: "#faf3e6" },
  { name: "雾蓝色", color: "#edf3fa" }, { name: "浅紫色", color: "#f3eef8" },
  { name: "纯白色", color: "#ffffff" }, { name: "夜间灰", color: "#242f2c" },
];

function luminanceOf(color: string) {
  const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}

export function useBackground(): [string, (color: string) => void, CSSProperties] {
  const [color, setColor] = useState(() => {
    try { const saved = localStorage.getItem(KEY); return valid(saved) ? saved : DEFAULT; } catch { return DEFAULT; }
  });
  useEffect(() => { try { localStorage.setItem(KEY, color); } catch {} }, [color]);
  const luminance = luminanceOf(color);
  const readable = (preferred: string[]) => preferred.find(candidate => {
    const foreground = luminanceOf(candidate);
    return (Math.max(luminance, foreground) + .05) / (Math.min(luminance, foreground) + .05) >= 4.5;
  }) || (luminance > .179 ? "#000000" : "#ffffff");
  const style = {
    backgroundColor: color, "--bg": color,
    "--study-on-bg": readable(["#294c3e", "#f3f7ef"]),
    "--study-muted-bg": readable(["#65765d", "#d2dccb"]),
  } as CSSProperties;
  return [color, value => { if (valid(value)) setColor(value.toLowerCase()); }, style];
}

export default function BackgroundSettings({ color, onChange, onClose }: { color: string; onChange: (value: string) => void; onClose: () => void }) {
  return <Modal title="背景颜色" subtitle="为学习空间挑一种颜色 · 自动保存在当前浏览器" onClose={onClose}>
    <div className="background-settings">
      <div className="color-presets">{presets.map(preset => <button key={preset.color} className={color === preset.color ? "color-preset selected" : "color-preset"} aria-label={preset.name} aria-pressed={color === preset.color} onClick={() => onChange(preset.color)}>
        <span className="color-swatch" style={{ background: preset.color }}>{color === preset.color && <Check size={19} />}</span><span>{preset.name}</span>
      </button>)}</div>
      <label className="custom-color"><div><strong>自选颜色</strong><span>点击色块，选择喜欢的背景</span></div><code>{color.toUpperCase()}</code><input type="color" aria-label="自选背景颜色" value={color} onChange={event => onChange(event.target.value)} /></label>
      <div className="background-preview" style={{ background: color }}><div><span />题目卡片保持清晰易读<span /></div></div>
      <div className="form-footer"><button type="button" className="secondary-button" onClick={() => onChange(DEFAULT)}><RotateCcw size={15} />恢复默认</button><button className="primary-button" onClick={onClose}>完成</button></div>
    </div>
  </Modal>;
}
