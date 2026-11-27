// src/game/input.js — 键鼠 + 触屏统一输入（回合制：一次操作 = 一步）
// 规则：键盘、场地点按/滑动、触屏方向键三个来源都走同一个 onMove(dir)，
//      玩法层只认 -1 / +1，不关心输入设备。节流保证「按住不会一步跨三格」。
import { GAME } from "config/game.config.js";

const LEFT = new Set(["ArrowLeft", "a", "A"]);
const RIGHT = new Set(["ArrowRight", "d", "D"]);
const PAUSE = new Set(["Escape", "p", "P"]);
const REPEAT_MS = 120;      // 键盘连续触发的最小间隔
const SWIPE_MIN = 14;       // 小于这个位移算「点按」

export class Input {
  constructor(stageEl, { onMove, onPause, onFirstAction } = {}) {
    this.stage = stageEl;
    this.onMove = onMove;
    this.onPause = onPause;
    this.onFirstAction = onFirstAction;
    this.used = false;
    this._lastMove = 0;
    this._down = null;
    this._bind();
  }

  _move(dir) {
    const now = performance.now();
    if (now - this._lastMove < REPEAT_MS) return;
    this._lastMove = now;
    this._markUsed();
    if (this.onMove) this.onMove(dir);
  }

  _markUsed() {
    if (this.used) return;
    this.used = true;
    if (this.onFirstAction) this.onFirstAction();
  }

  _bind() {
    this._onKeyDown = (e) => {
      if (LEFT.has(e.key)) { this._move(-1); e.preventDefault(); }
      else if (RIGHT.has(e.key)) { this._move(1); e.preventDefault(); }
      else if (PAUSE.has(e.key)) { if (this.onPause) this.onPause(); e.preventDefault(); }
    };
    window.addEventListener("keydown", this._onKeyDown);

    const canvas = this.stage.querySelector("canvas") || this.stage;

    this._onDown = (e) => {
      if (e.target && e.target.closest && e.target.closest("button")) return;  // 不抢按钮点击
      this._down = { x: e.clientX, y: e.clientY };
      this._markUsed();
    };
    this._onUp = (e) => {
      if (!this._down) return;
      const dx = e.clientX - this._down.x;
      this._down = null;
      if (Math.abs(dx) >= SWIPE_MIN) {
        this._move(dx > 0 ? 1 : -1);
      } else {
        // 点按：点左边走左、点右边走右（横屏最省事的单手操作）
        const r = canvas.getBoundingClientRect();
        this._move(e.clientX - r.left < r.width / 2 ? -1 : 1);
      }
    };
    this._onCancel = () => { this._down = null; };

    canvas.addEventListener("pointerdown", this._onDown);
    window.addEventListener("pointerup", this._onUp);
    window.addEventListener("pointercancel", this._onCancel);
    this._canvas = canvas;
  }

  /** 触屏方向键：按下即走一步（按住会按节流连续走） */
  bindPad(btn, dir) {
    if (!btn) return;
    const step = () => {
      btn.classList.add("is-on");
      this._move(dir);
    };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      step();
      btn._timer = setInterval(step, REPEAT_MS + 40);
    });
    const off = () => {
      btn.classList.remove("is-on");
      if (btn._timer) { clearInterval(btn._timer); btn._timer = 0; }
    };
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointerleave", off);
    btn.addEventListener("pointercancel", off);
  }

  destroy() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("pointerup", this._onUp);
    window.removeEventListener("pointercancel", this._onCancel);
    if (this._canvas) this._canvas.removeEventListener("pointerdown", this._onDown);
  }
}

/** 触摸设备才显示方向键（PC 用键盘 / 点按左右半边） */
export function isTouchDevice() {
  return (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
}

export const DESIGN_WIDTH = GAME.design.width;
