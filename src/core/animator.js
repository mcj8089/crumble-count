// src/core/animator.js — 逐帧序列播放（禁止骨骼/补间/两图切换）
// 帧清单来自 assets/images/frame-manifest.json，路径约定见 src/core/assets.js。
import { frameUrl } from "core/assets.js";

export class Animator {
  constructor({ images, manifest }) {
    this.images = images || new Map();
    this.manifest = manifest || {};
    this.dir = this.manifest.dir || "assets/images/frames/";
    this.ext = this.manifest.ext || "webp";
    this.cache = new Map();          // "name:action" → 帧数组（一次解析，播放时零查找）
  }

  def(name) {
    return (this.manifest.characters || {})[name] || null;
  }

  has(name, action) {
    const d = this.def(name);
    const a = d && (d.actions || {})[action];
    return !!(a && Number(a.frames) > 0);
  }

  /**
   * 预建全部动作的帧序列（等价 Phaser 的 anims.create）。
   * 逐帧动画的帧表固定，开局建一次就够了，之后切动作只是换数组引用。
   */
  createAnims() {
    let n = 0;
    for (const [name, def] of Object.entries(this.manifest.characters || {})) {
      for (const action of Object.keys(def.actions || {})) {
        this.frames(name, action);
        n += 1;
      }
    }
    return n;
  }

  /** 取一组已解码的帧（原样按 manifest 顺序，不做镜像；朝向用水平翻转） */
  frames(name, action) {
    const key = `${name}:${action}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const d = this.def(name);
    const out = [];
    const a = d && (d.actions || {})[action];
    if (a) {
      for (let i = 1; i <= Number(a.frames || 0); i += 1) {
        const img = this.images.get(frameUrl(this.dir, d.reuseOf || name, action, i, this.ext));
        if (img) out.push(img);
      }
    }
    this.cache.set(key, out);
    return out;
  }

  fps(name, action) {
    const d = this.def(name);
    const a = d && (d.actions || {})[action];
    return Number(a?.fps) > 0 ? Number(a.fps) : 12;
  }

  loop(name, action) {
    const d = this.def(name);
    const a = d && (d.actions || {})[action];
    return a?.loop !== false;
  }
}

/** 一个可绘制的实体：持有当前动作、帧序号与朝向。 */
export class Sprite {
  constructor(animator, name, action = "idle", opts = {}) {
    this.a = animator;
    this.name = name;
    this.action = action;
    this.frames = animator.frames(name, action);
    this.fps = opts.fps || animator.fps(name, action);
    this.loop = opts.loop ?? animator.loop(name, action);
    this.scale = opts.scale || 1;
    this.flip = !!opts.flip;
    this.index = 0;
    this.time = 0;
    this.done = false;
  }

  set(action, { force = false } = {}) {
    if (!force && action === this.action) return;
    const frames = this.a.frames(this.name, action);
    if (!frames.length) return;
    this.action = action;
    this.frames = frames;
    this.fps = this.a.fps(this.name, action);
    this.loop = this.a.loop(this.name, action);
    this.index = 0;
    this.time = 0;
    this.done = false;
  }

  update(dt) {
    if (!this.frames.length || this.done) return;
    this.time += dt * this.fps;
    while (this.time >= 1) {
      this.time -= 1;
      this.index += 1;
      if (this.index >= this.frames.length) {
        if (this.loop) this.index = 0;
        else { this.index = this.frames.length - 1; this.done = true; break; }
      }
    }
  }

  /** 以 (x, y) 为「脚底中心」绘制，保持 manifest 一致的画布比例。 */
  draw(ctx, x, y) {
    const img = this.frames[this.index];
    if (!img) return;
    const w = img.naturalWidth * this.scale;
    const h = img.naturalHeight * this.scale;
    ctx.save();
    ctx.translate(x, y);
    if (this.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }
}
