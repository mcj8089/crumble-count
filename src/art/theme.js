// src/art/theme.js — 世界观主题注入：canvas 配色 + CSS UI token 同源
// theme.world 决定 UI 材质分支（styles.css 的 body[data-ui-theme]），theme.hue 决定整体色相。
const WORLDS = {
  toy:       { primary: "#ff7a5c", accent: "#4ecfa0", cream: "#fff6e6", ink: "#3a2438" },
  pixel:     { primary: "#f25f5c", accent: "#9ef01a", cream: "#f7f7f2", ink: "#14121f" },
  fantasy:   { primary: "#8e6cff", accent: "#ffd166", cream: "#f4eeff", ink: "#241b3a" },
  scifi:     { primary: "#00d1ff", accent: "#ff2e88", cream: "#eef7ff", ink: "#0b1522" },
  wasteland: { primary: "#d98324", accent: "#8ea604", cream: "#f6ede0", ink: "#2b2118" }
};

export function palette(theme = {}) {
  return WORLDS[theme.world] || WORLDS.toy;
}

export function applyTheme(theme = {}) {
  const world = WORLDS[theme.world] ? theme.world : "toy";
  const p = palette(theme);
  // data-ui-theme 是 styles.css 里材质/裁切/纹理分支的开关，也是 UI 与画面同源的唯一凭据
  document.body.dataset.uiTheme = world;
  document.body.dataset.world = world;

  const root = document.documentElement.style;
  root.setProperty("--ui-primary", p.primary);
  root.setProperty("--ui-accent", theme.accent || p.accent);
  root.setProperty("--ui-cream", p.cream);
  root.setProperty("--ui-ink", p.ink);
  if (Number(theme.hue)) root.setProperty("--ui-hue", String(Number(theme.hue)));

  return p;
}
