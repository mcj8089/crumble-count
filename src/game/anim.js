// src/game/anim.js — 极简时间轴序列器 + 缓动
//
// 为什么不用现成补间库：这套玩法一次输入会产生一串「有先后顺序」的事件
// （走 → 跳 → 落地 → 碎 → 坠），需要的是「按顺序播完再结算」，不是一个属性动画系统。
// 这里的 Seq 只做一件事：把 (时长, 进度回调) 排队，update 时按时间推进，
// 保证动画时间与状态机结算严格先后（后台标签页节流也不会跳帧错位）。

export const Ease = {
  linear: (t) => t,
  out: (t) => 1 - (1 - t) * (1 - t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t,
  inCubic: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  back: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2)
};

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class Seq {
  constructor() {
    this.items = [];
    this.t = 0;
    this.timeScale = 1;
  }

  get busy() {
    return this.items.length > 0;
  }

  push(dur, fn) {
    this.items.push({ dur: Math.max(dur, 1e-4), fn });
    return this;
  }

  clear() {
    this.items.length = 0;
    this.t = 0;
  }

  /** @returns {boolean} 本帧是否真的推进了（用于「播完即结算」的判断） */
  update(dt) {
    if (!this.items.length) return false;
    let rest = dt * this.timeScale;
    let moved = false;
    let guard = 0;
    while (rest > 0 && this.items.length && guard < 64) {
      guard += 1;
      const it = this.items[0];
      const need = it.dur - this.t;
      const step = Math.min(rest, need);
      this.t += step;
      rest -= step;
      moved = true;
      it.fn(clamp(this.t / it.dur, 0, 1));
      if (this.t >= it.dur - 1e-6) {
        this.items.shift();
        this.t = 0;
      }
    }
    return moved;
  }
}
