// src/core/audio.js — 音频：BGM 循环 + 短音效，首次交互解锁，静音持久化
// 素材按 references/游戏音效合成提示词手册.md 生成，归档到 local/audio/AI_GEN（见 SKILL Step 4）。
export class GameAudio {
  constructor(cfg) {
    this.cfg = cfg || {};
    this.dir = this.cfg.dir || "assets/audio/";
    this.files = this.cfg.files || {};
    this.master = typeof this.cfg.master === "number" ? this.cfg.master : 0.8;
    this.muted = false;
    this.unlocked = false;
    this.bgmEl = null;
    this.pool = new Map();
    try { this.muted = localStorage.getItem("pipy:muted") === "1"; } catch (_) { /* 忽略 */ }
  }

  /** 建立音频元素（不 await，不挡开屏：浏览器自动播放策略下它本就不会先播） */
  build() {
    const mk = (file, loop) => {
      if (!file) return null;
      const el = document.createElement("audio");
      el.src = this.dir + file;
      el.preload = "auto";
      el.loop = !!loop;
      el.volume = this.master;
      el.muted = this.muted;
      return el;
    };
    this.bgmEl = mk(this.cfg.bgm, true);
    for (const [name, file] of Object.entries(this.files)) {
      this.pool.set(name, mk(file, false));
    }
    return this;
  }

  /** 首次用户交互后调用（解锁 WebAudio / 允许 play） */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.music();
  }

  music() {
    if (!this.bgmEl || this.muted) return;
    this.bgmEl.muted = false;
    this.bgmEl.volume = this.master * 0.55;
    const p = this.bgmEl.play();
    if (p && p.catch) p.catch(() => { /* 自动播放被拦：等下次交互 */ });
  }

  play(name, opts = {}) {
    const el = this.pool.get(name);
    if (!el || this.muted) return;
    try {
      el.pause();
      el.currentTime = 0;
      el.volume = Math.min(1, this.master * (opts.volume ?? 1));
      const p = el.play();
      if (p && p.catch) p.catch(() => { /* 静默失败：音效缺失不阻断玩法 */ });
    } catch (_) { /* 忽略 */ }
  }

  setMuted(next) {
    this.muted = !!next;
    try { localStorage.setItem("pipy:muted", this.muted ? "1" : "0"); } catch (_) { /* 忽略 */ }
    for (const el of this.pool.values()) el.muted = this.muted;
    if (this.bgmEl) {
      this.bgmEl.muted = this.muted;
      if (this.muted) this.bgmEl.pause();
      else this.music();
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** 广告/失焦时统一静音，结束后恢复原状态 */
  suspend() { this._wasMuted = this.muted; this.setMuted(true); }
  restore() { this.setMuted(this._wasMuted ?? false); }
}
