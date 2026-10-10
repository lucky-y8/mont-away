import { useEffect, useState, type CSSProperties } from "react";
import { Check, Moon, RotateCcw, Sun } from "lucide-react";
import Modal from "./Modal";

type Theme = { color: string; mode: "light" | "dark" };
const KEY = "network-study-room:theme:v1";
const DEFAULT: Theme = { color: "#ffffff", mode: "light" };
const validColor = (color: unknown): color is string => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color);
const validTheme = (theme: unknown): theme is Theme => !!theme && typeof theme === "object" &&
  validColor((theme as Theme).color) && ["light", "dark"].includes((theme as Theme).mode);
const presets = [
  { name: "纯白", color: DEFAULT.color }, { name: "青绿", color: "#24745e" },
  { name: "海蓝", color: "#3669b1" },
  { name: "鸢紫", color: "#8055aa" }, { name: "暖橙", color: "#a7632c" },
  { name: "玫瑰", color: "#a14d70" }, { name: "石墨", color: "#596575" },
];
const channels = (color: string) => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
function mix(first: string, second: string, amount: number) {
  const target = channels(second);
  return "#" + channels(first).map((value, i) => Math.round(value * (1 - amount) + target[i] * amount).toString(16).padStart(2, "0")).join("");
}
function luminance(color: string) {
  const rgb = channels(color).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
function contrast(first: string, second: string) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
function readable(color: string, surfaces: string[], dark: boolean) {
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(color, dark ? "#ffffff" : "#000000", step / 20);
    if (surfaces.every(surface => contrast(candidate, surface) >= 4.5)) return candidate;
  }
  return dark ? "#ffffff" : "#000000";
}

export function themeStyle({ color, mode }: Theme): CSSProperties {
  const dark = mode === "dark";
  const white = color.toLowerCase() === "#ffffff" && !dark;
  const primary = white ? "#26313b" : color;
  const bg = mix(color, dark ? "#101316" : "#ffffff", dark ? .95 : .965);
  const surface = dark ? mix(color, "#191e22", .91) : "#ffffff";
  const subtle = white ? "#fafbfc" : mix(color, dark ? "#1d252d" : "#ffffff", dark ? .88 : .975);
  const soft = white ? "#f0f2f4" : mix(color, dark ? "#26313c" : "#ffffff", dark ? .81 : .91);
  const onAccent = contrast(primary, "#ffffff") >= contrast(primary, "#111820") ? "#ffffff" : "#111820";
  const accentInk = readable(primary, [surface, subtle, soft, bg], dark);
  const muted = readable(dark ? "#b3c0cb" : mix(color, "#52615f", .83), [surface, subtle, soft, bg], dark);
  return {
    backgroundColor: bg, color: dark ? "#e9eef3" : mix(color, "#19232d", .88), colorScheme: mode,
    "--bg": bg, "--surface": surface, "--surface-alt": subtle,
    "--ink": dark ? "#e9eef3" : mix(color, "#19232d", .88),
    "--text": dark ? "#d5dfe8" : mix(color, "#35434b", .88),
    "--muted": muted, "--green": primary, "--green-dark": mix(primary, onAccent === "#ffffff" ? "#000000" : "#ffffff", .13),
    "--on-accent": onAccent, "--accent-ink": accentInk, "--accent-soft": soft,
    "--accent-hover": white ? "#f5f6f7" : mix(color, dark ? "#26313c" : "#ffffff", dark ? .89 : .95),
    "--accent-border": white ? "#b8c0c8" : mix(color, dark ? "#526575" : "#ffffff", dark ? .52 : .57),
    "--line": white ? "#e3e7eb" : mix(color, dark ? "#3b4752" : "#ffffff", dark ? .87 : .84),
    "--mint": soft, "--study-on-bg": dark ? "#e9eef3" : mix(color, "#19232d", .88),
    "--study-muted-bg": muted, "--warning-bg": dark ? "#352c1f" : "#fbf4e7",
    "--warning-ink": dark ? "#ecd09b" : "#89602e", "--warning-line": dark ? "#625034" : "#ecdec0",
    "--error-bg": dark ? "#3b2727" : "#fbefec", "--error-ink": dark ? "#f0b4ad" : "#994d43",
  } as CSSProperties;
}

function initialTheme(): Theme {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (validTheme(saved)) return { color: saved.color.toLowerCase(), mode: saved.mode };
    // Keep the intent of earlier background preferences. / 兼容之前保存的背景设置。
    const previous = localStorage.getItem("network-study-room:background:v1")?.toLowerCase();
    if (previous === "#242f2c") return { color: "#24745e", mode: "dark" };
    const legacy: Record<string, string> = { "#f6f8f5": "#24745e", "#faf3e6": "#a7632c", "#edf3fa": "#3669b1", "#f3eef8": "#8055aa", "#ffffff": "#ffffff" };
    if (previous && legacy[previous]) return { color: legacy[previous], mode: "light" };
    if (validColor(previous)) return { color: previous, mode: luminance(previous) < .15 ? "dark" : "light" };
  } catch {}
  return DEFAULT;
}

export function useTheme(): [Theme, (theme: Theme) => void, CSSProperties] {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(theme)); } catch {} }, [theme]);
  return [theme, value => { if (validTheme(value)) setTheme({ ...value, color: value.color.toLowerCase() }); }, themeStyle(theme)];
}

export default function ThemeSettings({ theme, onChange, onClose }: { theme: Theme; onChange: (theme: Theme) => void; onClose: () => void }) {
  return <Modal title="主题颜色" subtitle="按钮、导航与页面同步配色 · 自动保存在当前浏览器" onClose={onClose}>
    <div className="theme-settings">
      <div className="theme-modes" role="group" aria-label="外观模式">
        <button aria-pressed={theme.mode === "light"} onClick={() => onChange({ ...theme, mode: "light" })}><Sun size={16} />浅色</button>
        <button aria-pressed={theme.mode === "dark"} onClick={() => onChange({ ...theme, mode: "dark" })}><Moon size={16} />深色</button>
      </div>
      <div className="color-presets">{presets.map(preset => <button key={preset.color} className={theme.color === preset.color ? "color-preset selected" : "color-preset"} aria-label={preset.name} aria-pressed={theme.color === preset.color} onClick={() => onChange({ ...theme, color: preset.color })}>
        <span className="theme-swatch" style={themeStyle({ color: preset.color, mode: theme.mode })}><i /><b /><span className="swatch-pill" />{theme.color === preset.color && <Check size={15} />}</span><span>{preset.name}</span>
      </button>)}</div>
      <label className="custom-color"><div><strong>自选主题色</strong><span>以主色自动搭配整页颜色</span></div><code>{theme.color.toUpperCase()}</code><input type="color" aria-label="自选主题颜色" value={theme.color} onChange={event => onChange({ ...theme, color: event.target.value })} /></label>
      <div className="theme-preview"><span className="theme-preview-caption">主题预览</span><div className="theme-preview-card"><span className="type-badge">每日一题</span><strong>让专注，有自己的颜色。</strong><span className="theme-preview-copy">清晰的题目，熟悉的学习节奏。</span><div><span className="primary-button">查看答案</span><span className="secondary-button">答案解析</span></div></div></div>
      <div className="form-footer"><button type="button" className="secondary-button" onClick={() => onChange(DEFAULT)}><RotateCcw size={15} />恢复默认</button><button className="primary-button" onClick={onClose}>完成</button></div>
    </div>
  </Modal>;
}
