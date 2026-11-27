// src/core/assets.js — 图片预载 + 帧路径约定（开屏百分比由这里真实驱动）
// 帧命名：<名称>_<动作>_<两位序号>.<ext>，光效在 frames/fx/ 下。
export function frameUrl(dir, name, action, index, ext = "webp") {
  return `${dir}${name}_${action}_${String(index).padStart(2, "0")}.${ext}`;
}

export function fxUrl(dir, name, index, ext = "webp") {
  return `${dir}fx/${name}_${String(index).padStart(2, "0")}.${ext}`;
}

export function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve({ url, img, ok: true });
    img.onerror = () => resolve({ url, img: null, ok: false });
    img.src = url;
  });
}

/**
 * 预载队列：进度事件来自每一张图真实的 onload / onerror 回调，
 * 没有定时器假进度、没有「按文件数估算」的插值。
 * 用法：const load = createLoad(urls.length); load.on("progress", cb); load.tick(url);
 */
export function createLoad(total) {
  const handlers = { progress: [], done: [] };
  const state = { total: Math.max(1, total | 0), done: 0 };
  return {
    on(event, fn) {
      (handlers[event] || (handlers[event] = [])).push(fn);
      return this;
    },
    emit(event, payload) {
      for (const fn of handlers[event] || []) fn(payload);
    },
    /** 每完成一张图调用一次；percent 是 0..1 的真实完成比例 */
    tick(url) {
      state.done += 1;
      const percent = Math.min(1, state.done / state.total);
      this.emit("progress", { percent, done: state.done, total: state.total, url });
      if (state.done >= state.total) this.emit("done", { percent: 1 });
      return percent;
    },
    get percent() { return Math.min(1, state.done / state.total); }
  };
}

/**
 * 收集本次交付需要的全部图片 → 逐张解码 → 回调真实进度。
 * @returns {{images: Map<string, HTMLImageElement>, missing: string[]}}
 */
export async function preloadArt(GAME, manifest, onProgress) {
  const dir = manifest?.dir || GAME.frames.dir;
  const ext = manifest?.ext || GAME.frames.ext;
  const urls = [];

  for (const bg of GAME.images?.backgrounds || []) {
    urls.push(`${GAME.images.dir}${bg}`);
  }
  for (const [name, def] of Object.entries(manifest?.characters || {})) {
    if (def.reuseOf) continue;
    for (const [action, a] of Object.entries(def.actions || {})) {
      const n = Number(a.frames) || 0;
      for (let i = 1; i <= n; i += 1) urls.push(frameUrl(dir, name, action, i, ext));
    }
  }
  for (const [name, a] of Object.entries(manifest?.fx || {})) {
    const n = Number(a.frames) || 0;
    for (let i = 1; i <= n; i += 1) urls.push(fxUrl(dir, name, i, ext));
  }

  const images = new Map();
  const missing = [];
  const load = createLoad(urls.length);
  if (onProgress) load.on("progress", (e) => onProgress(e.percent, e.url));

  // 小并发：本地几百帧全并发会打满连接池，反而更慢
  const queue = urls.slice();
  const workers = Array.from({ length: Math.min(6, queue.length || 1) }, async () => {
    while (queue.length) {
      const url = queue.shift();
      const r = await loadImage(url);
      if (r.ok) images.set(url, r.img);
      else missing.push(url);
      load.tick(url);
    }
  });
  await Promise.all(workers);
  if (!urls.length && onProgress) onProgress(1, "");
  return { images, missing };
}
