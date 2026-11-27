// src/art/board.js — 棋盘渲染：格子材质 / 背景 / 宝石（纯 Canvas 2D，不依赖任何图片）
//
// 为什么格子用画而不是贴图：数字块会随时变号（5→4→3），贴图得为每个数字准备一套；
// 而「数字 + 描边 + 硬阴影」正是这套糖果玩具风的核心，程序化绘制反而更清晰、可无限缩放。
// 逐帧美术只用在角色与特效上（见 assets/images/frames/）。

export const PAL = {
  ink: "#3a2438",
  inkSoft: "rgba(58,36,56,.30)",
  cream: "#fff6e6",
  wallTop: "#a8825f",
  wallMid: "#8a6a4f",
  wallDark: "#6b4f3a",
  crate: "#e0a961",
  crateDark: "#b8813f",
  spring: "#ff6f61",
  springDark: "#c74a45",
  rock: "#8d93a3",
  rockDark: "#6a7080",
  plate: "#3fbfa0",
  gate: "#ff8fa3",
  flip: "#a98bff",
  flipDark: "#7c5be0",
  bomb: "#4a3b5c",
  gem: "#63e6ff"
};

// 数字块配色（顶亮 / 底深），1~5 与 grid.js 的 maxStack 对齐
const BLOCK = {
  1: ["#ffc2d1", "#f2628a"],
  2: ["#ffd8a8", "#f2921f"],
  3: ["#ffeaa0", "#f0c020"],
  4: ["#b7f0c2", "#42b96a"],
  5: ["#bcd9ff", "#4a86e8"],
  6: ["#d8c6ff", "#8560e0"],
  7: ["#ffc6b8", "#e0603f"],
  8: ["#c8f2f0", "#2fa0a8"],
  9: ["#f0c8f2", "#a444b0"]
};

const FONT = '"Segoe UI", "PingFang SC", system-ui, sans-serif';
const gradCache = new Map();

function blockGrad(ctx, v, s) {
  const key = `${v}|${s}`;
  let g = gradCache.get(key);
  if (g) return g;
  const c = BLOCK[v] || BLOCK[3];
  g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, c[0]);
  g.addColorStop(0.55, c[0]);
  g.addColorStop(1, c[1]);
  gradCache.set(key, g);
  return g;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, rr); return; }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r, fill) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRR(ctx, x, y, w, h, r, stroke, lw) {
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

// ------------------------------------------------------------------ 背景
/** 背景按 cover 铺满给定可见矩形（bleed 时该矩形超出设计稿），并按世界时段叠一层色调 */
export function drawBackground(ctx, img, world, rect) {
  const x0 = rect.x0;
  const y0 = rect.y0;
  const w = Math.max(1, rect.x1 - rect.x0);
  const h = Math.max(1, rect.y1 - rect.y0);
  ctx.save();
  if (img) {
    const iw = img.naturalWidth || img.width || 16;
    const ih = img.naturalHeight || img.height || 9;
    const k = Math.max(w / iw, h / ih);
    const dw = iw * k;
    const dh = ih * k;
    ctx.drawImage(img, x0 + (w - dw) / 2 + world.drift, y0 + (h - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, "#9fd8ff");
    g.addColorStop(1, "#fff2d9");
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, h);
  }
  if (world.tint) {
    ctx.fillStyle = world.tint;
    ctx.fillRect(x0, y0, w, h);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ 棋子
/** 数字块：顶亮底深的果冻砖 + 描边 + 硬底阴影，数字压在正中 */
export function drawBlock(ctx, v, s, opt = {}) {
  const pad = s * 0.055;
  const w = s - pad * 2;
  const cracked = v <= 1;

  ctx.save();
  // 硬底阴影
  fillRR(ctx, pad, pad + s * 0.07, w, w, s * 0.26, "rgba(58,36,56,.26)");
  // 砖体
  fillRR(ctx, pad, pad, w, w, s * 0.26, blockGrad(ctx, v, s));
  // 顶部高光
  ctx.globalAlpha = 0.55;
  fillRR(ctx, pad + w * 0.10, pad + w * 0.07, w * 0.80, w * 0.30, s * 0.16, "#ffffff");
  ctx.globalAlpha = 1;
  // 描边
  strokeRR(ctx, pad, pad, w, w, s * 0.26, PAL.ink, Math.max(2, s * 0.055));

  // 数字
  const fs = Math.round(s * 0.46);
  ctx.font = `900 ${fs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tx = s / 2;
  const ty = s / 2 + s * 0.02;
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.fillText(String(v), tx, ty - s * 0.03);
  ctx.fillStyle = PAL.ink;
  ctx.fillText(String(v), tx, ty);

  // 快碎了：加两道裂纹
  if (cracked) {
    ctx.strokeStyle = "rgba(58,36,56,.45)";
    ctx.lineWidth = Math.max(1.6, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(s * 0.30, s * 0.24);
    ctx.lineTo(s * 0.42, s * 0.40);
    ctx.lineTo(s * 0.34, s * 0.52);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.70, s * 0.76);
    ctx.lineTo(s * 0.60, s * 0.62);
    ctx.lineTo(s * 0.68, s * 0.52);
    ctx.stroke();
  }
  ctx.restore();
}

/** 墙 / 地面板：同一套材质，靠 openTop 决定要不要画顶面亮边 */
export function drawWall(ctx, s, openTop) {
  const y0 = 0;
  fillRR(ctx, 0, y0, s, s, 0, PAL.wallMid);
  // 内部纹理：棋盘格双色
  ctx.fillStyle = "rgba(255,255,255,.05)";
  ctx.fillRect(0, 0, s, s / 2);
  ctx.fillStyle = "rgba(0,0,0,.07)";
  ctx.fillRect(s / 2, 0, s / 2, s);
  if (openTop) {
    // 顶面（奶油糖霜边）
    ctx.fillStyle = PAL.wallTop;
    ctx.fillRect(0, 0, s, s * 0.20);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fillRect(0, 0, s, s * 0.07);
    ctx.fillStyle = "rgba(58,36,56,.35)";
    ctx.fillRect(0, s * 0.20, s, Math.max(1.5, s * 0.035));
  }
}

export function drawCrate(ctx, s) {
  const pad = s * 0.08;
  const w = s - pad * 2;
  ctx.save();
  fillRR(ctx, pad, pad + s * 0.07, w, w, s * 0.14, "rgba(58,36,56,.26)");
  fillRR(ctx, pad, pad, w, w, s * 0.14, PAL.crate);
  // 木条
  ctx.strokeStyle = "rgba(120,76,30,.55)";
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(pad + w * 0.14, pad + w * 0.14);
  ctx.lineTo(pad + w * 0.86, pad + w * 0.86);
  ctx.moveTo(pad + w * 0.86, pad + w * 0.14);
  ctx.lineTo(pad + w * 0.14, pad + w * 0.86);
  ctx.stroke();
  // 四角钉
  ctx.fillStyle = PAL.crateDark;
  for (const [dx, dy] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
    ctx.beginPath();
    ctx.arc(pad + w * dx, pad + w * dy, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeRR(ctx, pad, pad, w, w, s * 0.14, PAL.ink, Math.max(2, s * 0.055));
  ctx.restore();
}

export function drawSpring(ctx, s, phase) {
  const cx = s / 2;
  const bottom = s * 0.94;
  const squash = 1 + Math.sin(phase * 5) * 0.06;
  const coilH = s * 0.40 * squash;
  const topY = bottom - s * 0.13 - coilH;
  ctx.save();
  // 底座
  fillRR(ctx, s * 0.06, bottom - s * 0.13, s * 0.88, s * 0.13, s * 0.055, PAL.springDark);
  // 弹簧圈（三条横向弧线，够粗才看得出是弹簧）
  ctx.strokeStyle = PAL.spring;
  ctx.lineWidth = Math.max(4, s * 0.10);
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i += 1) {
    const t = (i + 0.5) / 3;
    const y = bottom - s * 0.13 - t * coilH;
    ctx.beginPath();
    ctx.ellipse(cx, y, s * 0.30, s * 0.10, 0, 0, Math.PI, i % 2 === 0);
    ctx.stroke();
  }
  // 顶盘
  fillRR(ctx, s * 0.05, topY, s * 0.90, s * 0.15, s * 0.075, "#ffe2dc");
  ctx.fillStyle = "rgba(255,255,255,.65)";
  fillRR(ctx, s * 0.14, topY + s * 0.02, s * 0.72, s * 0.05, s * 0.025, "#ffffff");
  strokeRR(ctx, s * 0.05, topY, s * 0.90, s * 0.15, s * 0.075, PAL.ink, Math.max(2, s * 0.055));
  ctx.restore();
}

export function drawRock(ctx, s) {
  const pad = s * 0.06;
  const w = s - pad * 2;
  ctx.save();
  fillRR(ctx, pad, pad + s * 0.06, w, w, s * 0.12, "rgba(58,36,56,.26)");
  fillRR(ctx, pad, pad, w, w, s * 0.12, PAL.rock);
  // 斜纹（硬砖：踩不碎）
  ctx.save();
  roundRect(ctx, pad, pad, w, w, s * 0.12);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,.20)";
  ctx.lineWidth = Math.max(3, s * 0.07);
  for (let i = -1; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(pad + i * w * 0.36, pad + w);
    ctx.lineTo(pad + i * w * 0.36 + w, pad);
    ctx.stroke();
  }
  ctx.restore();
  strokeRR(ctx, pad, pad, w, w, s * 0.12, PAL.ink, Math.max(2, s * 0.055));
  ctx.fillStyle = PAL.rockDark;
  for (const [dx, dy] of [[0.26, 0.26], [0.74, 0.26], [0.26, 0.74], [0.74, 0.74]]) {
    ctx.beginPath();
    ctx.arc(pad + w * dx, pad + w * dy, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPlate(ctx, s, down) {
  const cx = s / 2;
  // 压力板：整格宽的低台 + 中央指示灯，踩下去灯亮、台面下沉
  const w = s * 0.92;
  const h = s * (down ? 0.20 : 0.28);
  const x = cx - w / 2;
  const y = s - h - s * 0.05;
  ctx.save();
  fillRR(ctx, x, y, w, h, s * 0.08, PAL.plate);
  fillRR(ctx, x + w * 0.10, y + h * 0.14, w * 0.80, h * 0.34, s * 0.05, "rgba(255,255,255,.28)");
  strokeRR(ctx, x, y, w, h, s * 0.08, PAL.ink, Math.max(2, s * 0.06));
  // 中央灯：常态是暗绿小灯，压下去亮成薄荷白（光只打在本格，不做泛光）
  const ly = y + h * 0.60;
  ctx.beginPath();
  ctx.arc(cx, ly, s * 0.085, 0, Math.PI * 2);
  ctx.fillStyle = down ? "#e9fff6" : "rgba(12,58,48,.55)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, ly, s * 0.045, 0, Math.PI * 2);
  ctx.fillStyle = down ? "#5cf0c4" : "rgba(255,255,255,.28)";
  ctx.fill();
  ctx.restore();
}

/** 门：3 格高，糖果拐杖条纹 */
export function drawGate(ctx, s, h) {
  ctx.save();
  fillRR(ctx, s * 0.14, 0, s * 0.72, h, s * 0.16, "rgba(58,36,56,.20)");
  fillRR(ctx, s * 0.12, 0, s * 0.72, h, s * 0.16, PAL.gate);
  ctx.save();
  roundRect(ctx, s * 0.12, 0, s * 0.72, h, s * 0.16);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,.75)";
  ctx.lineWidth = s * 0.13;
  for (let y = -s; y < h + s; y += s * 0.34) {
    ctx.beginPath();
    ctx.moveTo(s * 0.12, y);
    ctx.lineTo(s * 0.84, y + s * 0.34);
    ctx.stroke();
  }
  ctx.restore();
  strokeRR(ctx, s * 0.12, 0, s * 0.72, h, s * 0.16, PAL.ink, Math.max(2.5, s * 0.055));
  ctx.restore();
}

export function drawFlip(ctx, s, phase) {
  ctx.save();
  const pad = s * 0.06;
  const w = s - pad * 2;
  fillRR(ctx, pad, pad + s * 0.06, w, w, s * 0.20, "rgba(58,36,56,.24)");
  fillRR(ctx, pad, pad, w, w, s * 0.20, PAL.flip);
  ctx.globalAlpha = 0.5;
  fillRR(ctx, pad + w * 0.10, pad + w * 0.07, w * 0.80, w * 0.26, s * 0.12, "#ffffff");
  ctx.globalAlpha = 1;
  strokeRR(ctx, pad, pad, w, w, s * 0.20, PAL.ink, Math.max(2, s * 0.055));
  // 上下箭头
  const cx = s / 2;
  const bob = Math.sin(phase * 3) * s * 0.02;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(3, s * 0.08);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx, s * 0.30 + bob);
  ctx.lineTo(cx, s * 0.70 + bob);
  ctx.moveTo(cx - s * 0.11, s * 0.40 + bob);
  ctx.lineTo(cx, s * 0.28 + bob);
  ctx.lineTo(cx + s * 0.11, s * 0.40 + bob);
  ctx.moveTo(cx - s * 0.11, s * 0.60 + bob);
  ctx.lineTo(cx, s * 0.72 + bob);
  ctx.lineTo(cx + s * 0.11, s * 0.60 + bob);
  ctx.stroke();
  ctx.restore();
}

export function drawBomb(ctx, s, phase) {
  const cx = s / 2;
  const cy = s * 0.56;
  const r = s * 0.30;
  ctx.save();
  // 引线火花
  ctx.strokeStyle = "#b98a52";
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.5, cy - r * 0.8);
  ctx.quadraticCurveTo(cx + r * 1.1, cy - r * 1.3, cx + r * 0.6, cy - r * 1.7);
  ctx.stroke();
  const fl = 0.7 + Math.sin(phase * 12) * 0.3;
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(cx + r * 0.6, cy - r * 1.75, s * 0.06 * fl, 0, Math.PI * 2);
  ctx.fill();
  // 球体
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.2, cx, cy, r);
  g.addColorStop(0, "#6a5580");
  g.addColorStop(1, PAL.bomb);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.stroke();
  // 眼睛
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx - r * 0.32, cy - r * 0.12, r * 0.24, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.34, cy - r * 0.12, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.ink;
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.10, r * 0.11, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.38, cy - r * 0.10, r * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawGem(ctx, s, phase) {
  const cx = s / 2;
  const cy = s * 0.52 + Math.sin(phase * 2.4) * s * 0.05;
  const w = s * 0.26;
  const h = s * 0.34;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.lineTo(cx + w, cy - h * 0.28);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(cx - w, cy - h * 0.28);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx, cy - h, cx, cy + h);
  g.addColorStop(0, "#d6fbff");
  g.addColorStop(0.55, PAL.gem);
  g.addColorStop(1, "#22a6c8");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = Math.max(1.8, s * 0.04);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, cy - h * 0.25);
  ctx.lineTo(cx, cy + h * 0.35);
  ctx.strokeStyle = "rgba(255,255,255,.75)";
  ctx.lineWidth = Math.max(1.4, s * 0.03);
  ctx.stroke();
  ctx.restore();
}

// 藏在数字块里的宝石：块右上角一点微光 + 呼吸，提示「这块里有东西」。
// 不加这个，宝石关第一次出现时玩家完全看不出该先踩哪一块。
export function drawGemHint(ctx, s, phase) {
  // 藏在数字块里的宝石：块内上沿一颗呼吸的星芒。用四角星而不是菱形，
  // 因为块面圆角半径有 0.26w，菱形放角上会被裁掉一半。
  const pulse = 0.72 + Math.sin(phase * 3.1) * 0.22;
  const cx = s * 0.5;
  const cy = s * 0.19;
  const r1 = Math.max(s * 0.1, 7.5);
  const r2 = r1 * 0.28;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.beginPath();
  for (let k = 0; k < 8; k += 1) {
    const r = k % 2 ? r2 : r1;
    const a = -Math.PI / 2 + (k * Math.PI) / 4;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.shadowColor = PAL.gem;
  ctx.shadowBlur = s * 0.12;
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = PAL.gem;
  ctx.lineWidth = Math.max(1.6, s * 0.03);
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}
