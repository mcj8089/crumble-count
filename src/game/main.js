// src/game/main.js — 玩法主循环：关卡流程 / 事件动画 / 渲染 / 引导 / 广告节点
//
// 分层：
//   规则   → src/game/grid.js（纯函数，Node 可跑，tools/verify_levels.mjs 逐关验证可解）
//   参数   → src/game/mechanics.js（关卡表里的 newMechanic 在这里有实现入口）
//   表现   → 本文件（事件 → 时间轴 → Canvas）
// 一次输入 = 一次 step()，返回一串有先后顺序的事件；本文件把这些事件翻译成动画，
// 播完才结算（过关 / 坠落），保证「看到的」和「判定的」永远一致。
import { GAME } from "config/game.config.js";
import { LEVELS } from "config/levels.js";
import { CELL, parseLevel, cloneState, step, countLeft } from "game/grid.js";
import { mechFor } from "game/mechanics.js";
import { Sprite } from "core/animator.js";
import { Seq, Ease, lerp, clamp } from "game/anim.js";
import { t } from "core/i18n.js";
import {
  drawBackground, drawBlock, drawWall, drawCrate, drawSpring,
  drawRock, drawPlate, drawGate, drawFlip, drawBomb, drawGem, drawGemHint
} from "art/board.js";

const SAVE_KEY = "crumble-count:save";

function loadSave() {
  const def = { unlocked: 1, stars: {}, best: {}, coins: 0, gems: 0 };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return def;
    return Object.assign(def, JSON.parse(raw));
  } catch (_) {
    return def;
  }
}

export class Game {
  constructor({ canvas, ui, audio, ads, animator, isTouch, viewport }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ui = ui;
    this.audio = audio;
    this.ads = ads;
    this.animator = animator;
    this.isTouch = isTouch;
    this.viewport = viewport;

    this.save = loadSave();
    this.levelIdx = 0;
    this.level = LEVELS[0];
    this.state = null;
    this.mode = "menu";          // menu | play | pause | clear | fail
    this.clock = 0;
    this.moves = 0;
    this.maxMoves = 0;           // 步数上限 = par + moveSlack（用完即失败）
    this.revived = false;        // 每关只允许看一次广告复活
    this.failKind = "out";       // out 步数用完 / stuck 左右都走不动 / fell 掉出棋盘
    this.gemsTaken = 0;
    this.left0 = 1;
    this.seq = new Seq();
    this.view = { px: 0, py: 0, hop: 0 };
    this.cellFx = [];
    this.parts = [];
    this.shake = 0;
    this.flipT = 0;
    this.flipDur = 0.42;
    this.flipPrevGrid = null;
    this.pendingDir = 0;
    this._resolve = null;
    this._snapshot = null;
    this.guide = { stage: 0, moves: 0, done: false };
    this.actionTimer = 0;
    this.doubled = false;
    this.clearReward = 0;
    this.layout = { cell: GAME.play.cell, x0: 0, y0: 0, W: 10, H: 6 };

    this.sprite = new Sprite(animator, "gummy", "idle");
    this.resize();
  }

  // ---------------------------------------------------------------- 视口
  resize() {
    const s = this.viewport.state;
    const pr = s.pixelRatio;
    this.canvas.width = Math.max(1, Math.round(s.vw * pr));
    this.canvas.height = Math.max(1, Math.round(s.vh * pr));
    this._view = { pr, scale: s.scale, ox: s.ox, oy: s.oy };
    this._vis = s.vis;
  }

  // ---------------------------------------------------------------- 关卡
  get worldIndex() {
    const id = this.level.id;
    for (const range of GAME.play.bgByLevel) {
      if (id >= range[0] && id <= range[1]) return range[2];
    }
    return 0;
  }

  bgImage() {
    const name = GAME.images.backgrounds[this.worldIndex] || GAME.images.backgrounds[0];
    return this.animator.images.get(GAME.images.dir + name) || null;
  }

  computeLayout(W, H) {
    // 格子大小跟着棋盘尺寸走：小棋盘（8×4）放大到 108，大棋盘（14×7）压到 ~76，
    // 保证任何一关都占满舞台中部，不会出现「一块小地砖浮在画面下沿」。
    const fitW = Math.floor(1120 / Math.max(1, W));
    const fitH = Math.floor(540 / Math.max(1, H));
    const cell = clamp(Math.min(GAME.play.cell * 1.7, fitW, fitH), 52, 108);
    const x0 = Math.round((GAME.design.width - W * cell) / 2);
    const y0 = clamp(Math.round(430 - (H * cell) / 2), 146, 470);
    return { cell, x0, y0, W, H };
  }

  startLevel(idx, { announce = true } = {}) {
    const next = clamp(idx, 0, LEVELS.length - 1);
    const lv = LEVELS[next];
    this.levelIdx = next;
    this.level = lv;
    this.state = parseLevel(lv, mechFor(lv));
    this.layout = this.computeLayout(this.state.W, this.state.H);
    this.moves = 0;
    // 步数上限：以 BFS 最优步数为基准加宽容量，保证「能过但会紧」
    this.maxMoves = (lv.par || 10) + GAME.play.moveSlack;
    this.revived = false;
    this.failKind = "out";
    this.gemsTaken = 0;
    this.left0 = Math.max(1, countLeft(this.state));
    this.view.px = this.state.px;
    this.view.py = this.state.py;
    this.view.hop = 0;
    this.cellFx.length = 0;
    this.parts.length = 0;
    this.seq.clear();
    this._resolve = null;
    this._snapshot = null;
    this.shake = 0;
    this.flipT = 0;
    this.doubled = false;
    this.clearReward = 0;
    this.pendingDir = 0;
    this.mode = "play";
    this.guide = { stage: 0, moves: 0, done: false };
    this.sprite.set("idle", { force: true });
    this.actionTimer = 0;
    this.ads.newRun();

    this.ui.hideAll();
    this.ui.showHud(true);
    this.updateHud();
    this.ui.setObjective(lv.id === 1 ? "" : t(lv.hintKey));
    this.ui.setTouch(this.isTouch);

    // 第 1 关：底部按键图例 + 场内指点（玩家照做后自动推进并退出）
    // 这一关不弹关卡横幅：横幅和手势提示都在顶部同一窄带里，会互相压住
    if (lv.id === 1) {
      this.ui.keybar(true);
      this.ui.hint(true, t("guide.move"), this.hintPos());
    } else {
      this.ui.keybar(false);
      this.ui.hint(false);
      if (announce) this.ui.banner(t("banner.level", { n: lv.id }), 1300);
    }
  }

  restart() {
    this.startLevel(this.levelIdx);
  }

  hintPos() {
    const L = this.layout;
    // 提示浮在棋盘上方：既不挡角色，也不挡块（新手关需要看见自己的脚）
    return { x: Math.round(GAME.design.width / 2), y: clamp(L.y0 - 52, 196, 540) };
  }

  // ---------------------------------------------------------------- 输入
  onMove(dir) {
    if (this.mode !== "play") return;
    if (this.seq.busy) { this.pendingDir = dir; return; }
    this.doMove(dir);
  }

  doMove(dir) {
    if (this.moves >= this.maxMoves) return;
    const before = this.state;
    const res = step(before, dir);
    if (res.result === "blocked") {
      this.shake = 0.16;
      this.audio.play("click", { volume: 0.45 });
      // 撞一下也算「没路可走」的信息：左右都撞不通就直接判卡死，别让玩家空按
      if (this.isStuck(before)) this._resolve = "stuck";
      return;
    }
    this._snapshot = cloneState(before);
    this.state = res.state;
    this.moves += 1;
    this.buildAnim(before, res);
    this.updateHud();

    if (!this.guide.done) {
      this.guide.moves += 1;
      if (this.level.id === 1) {
        if (this.guide.stage === 0) {
          this.guide.stage = 1;
          this.ui.keybar(true, { dim: true });
          this.ui.hint(true, t("guide.hit"), { x: 640, y: 250 });
        }
        if (this.guide.moves >= 3) {
          this.guide.done = true;
          this.guide.stage = 2;
          this.ui.keybar(false);
          this.ui.hint(false);
          this.ui.toast(t("guide.done"), 2200);
        }
      } else {
        this.guide.done = true;
      }
    }
    if (this.guide.moves >= 1) this.ui.setObjective("");

    // 结算优先级：过关 > 坠出棋盘 > 步数用完 > 自己把自己锁死
    if (res.result === "win") this._resolve = "win";
    else if (res.result === "fell") this._resolve = "fell";
    else if (this.moves >= this.maxMoves) this._resolve = "out";
    else if (this.isStuck(this.state)) this._resolve = "stuck";
  }

  /** 左右两边都走不动 = 这局已经没救了（只有重开或大退） */
  isStuck(state) {
    if (!state) return false;
    return step(state, -1).result === "blocked" && step(state, 1).result === "blocked";
  }

  // ---------------------------------------------------------------- 事件 → 时间轴
  at(dur, snd, fn, onStart) {
    let started = false;
    this.seq.push(dur, (p) => {
      if (!started) {
        started = true;
        if (onStart) onStart();
        if (snd) this.audio.play(snd);
      }
      if (fn) fn(p);
    });
  }

  addFx(kind, x, y, extra) {
    this.cellFx.push(Object.assign({ kind, x, y, t: 0, dur: 0.18 }, extra || {}));
  }

  addPart(name, x, y, dur, scale) {
    this.parts.push({ name, x, y, t: 0, dur: dur || 0.34, scale: scale || 1 });
  }

  buildAnim(before, res) {
    const D = GAME.play.moveDur;
    const v = this.view;
    this.seq.clear();
    let fx = before.px;
    let fy = before.py;

    for (const ev of res.events) {
      switch (ev.t) {
        case "walk": {
          const x0 = fx;
          this.at(D.walk, null, (p) => {
            v.px = lerp(x0, ev.x, Ease.out(p));
            v.py = ev.y;
            v.hop = 0;
          });
          fx = ev.x;
          fy = ev.y;
          break;
        }
        case "hop": {
          const x0 = fx;
          const y0 = fy;
          // 帧内不做位移（否则 512 画布装不下、脑袋会被裁），跳跃高度全部由这里决定
          this.at(D.hop, "hop", (p) => {
            v.px = lerp(x0, ev.x, Ease.out(p));
            v.py = lerp(y0, ev.y, Ease.out(p));
            v.hop = Math.sin(Math.PI * p) * 0.62;
          }, () => this.playAction("hop"));
          fx = ev.x;
          fy = ev.y;
          break;
        }
        case "fall": {
          const y0 = fy;
          const dy = Math.abs(y0 - ev.y);
          this.at(clamp(0.055 * dy, 0.07, 0.26), dy > 1 ? "hit" : null, (p) => {
            v.px = ev.x;
            v.py = lerp(y0, ev.y, p * p);
            v.hop = 0;
          });
          fx = ev.x;
          fy = ev.y;
          break;
        }
        case "bounce": {
          const x0 = fx;
          const y0 = fy;
          this.at(0.26, "spring", (p) => {
            v.px = lerp(x0, ev.x, Ease.outCubic(p));
            v.py = lerp(y0, ev.y, Ease.outCubic(p));
            v.hop = Math.sin(Math.PI * p) * 0.66;
          }, () => this.playAction("hop"));
          this.addPart("dust", ev.sx, ev.sy, 0.3, 0.9);
          fx = ev.x;
          fy = ev.y;
          break;
        }
        case "sink": {
          const x0 = fx;
          const y0 = fy;
          this.at(0.5, "fail", (p) => {
            v.px = x0;
            v.py = lerp(y0, y0 - 2.4, Ease.in(p));
            v.hop = 0;
          }, () => this.playAction("dizzy", 1.2));
          break;
        }
        case "push": {
          this.addFx("slide", ev.tx, ev.ty, { dur: 0.13, fx: ev.x, fy: ev.y });
          this.at(0.13, "push", null, () => this.playAction("push"));
          break;
        }
        case "crateFall": {
          this.addFx("slide", ev.x, ev.ty, { dur: 0.16, fx: ev.x, fy: ev.y });
          this.at(0.16, "hit");
          break;
        }
        case "hit":
        case "last": {
          this.addFx("bump", ev.x, ev.y, { dur: 0.16 });
          this.at(0.08, "hit");
          break;
        }
        case "vanish": {
          this.addPart("pop", ev.x, ev.y, 0.32, 1);
          this.at(0.1, "break");
          break;
        }
        case "blast": {
          this.addPart("pop", ev.x, ev.y, 0.34, 1.15);
          this.shake = Math.max(this.shake, 0.2);
          this.at(0.12, "blast");
          break;
        }
        case "flip": {
          this.flipPrevGrid = before.g.slice();
          this.flipT = 0.0001;
          this.at(this.flipDur, "flip");
          break;
        }
        case "gate": {
          this.at(0.1, "click");
          break;
        }
        case "take": {
          this.gemsTaken += 1;
          this.addPart("spark", ev.x, ev.y, 0.4, 1);
          this.at(0.12, "gem");
          break;
        }
        case "gemDrop": {
          this.at(0.16, null);
          break;
        }
        default:
          break;
      }
    }
    // 收尾缓冲：让最后一帧落地动画看完再结算
    this.at(0.12, null);
  }

  // ---------------------------------------------------------------- 结算
  onLevelClear() {
    const lv = this.level;
    const par = lv.par || this.moves;
    const slack = GAME.play.starSlack;
    const stars = this.moves <= par + slack[0] ? 3 : (this.moves <= par + slack[1] ? 2 : 1);
    const coins = stars * GAME.play.coinPerStar + this.gemsTaken * GAME.play.coinPerGem;

    this.save.stars[lv.id] = Math.max(this.save.stars[lv.id] || 0, stars);
    const prevBest = this.save.best[lv.id];
    this.save.best[lv.id] = prevBest ? Math.min(prevBest, this.moves) : this.moves;
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVELS.length, lv.id + 1));
    this.save.coins += coins;
    this.save.gems += this.gemsTaken;
    this.persist();

    this.clearReward = coins;
    this.mode = "clear";
    this.playAction("cheer", 1.4);
    this.addPart("spark", this.view.px, this.view.py - 0.3, 0.5, 1.3);
    this.audio.play("win");
    this.updateHud();
    this.ui.showClear({
      stars,
      moves: this.moves,
      best: this.save.best[lv.id],
      coins,
      hasNext: lv.id < LEVELS.length,
      canDouble: this.ads.canShow(GAME.ads.doubleCoins) && coins > 0
    });
    this.ads.levelCleared({ level: lv.id, moves: this.moves, stars });
    if (lv.id % 3 === 0) this.ads.interstitial(GAME.ads.stageClear);
  }

  onFail(kind = "out") {
    this.failKind = kind;
    this.mode = "fail";
    this.pendingDir = 0;
    this.seq.clear();
    this.audio.play("fail");
    this.ads.gameOver({ level: this.level.id, moves: this.moves });
    // 卡死给广告也没用（补步数不等于能走），所以那种情况不显示复活
    const canRevive = kind !== "stuck" && !this.revived && this.ads.canShow(GAME.ads.revive);
    this.ui.showFail({ canRevive, kind });
    this.ui.keybar(false);
    this.ui.hint(false);
    this.ui.setObjective("");
    // SDK 的广告位配置是异步到位的：开局几秒内可能还查不到，面板打开后继续补查
    if (!canRevive && kind !== "stuck" && !this.revived) this.armReviveProbe();
  }

  /** 失败面板停留期间持续补查复活位（查到就补显，绝不因为查询早失败而少一个广告入口） */
  armReviveProbe() {
    let tries = 0;
    const tick = () => {
      if (this.mode !== "fail" || this.revived) return;
      if (this.ads.canShow(GAME.ads.revive)) { this.ui.showRevive(true); return; }
      tries += 1;
      if (tries < 5) setTimeout(tick, 900);
    };
    setTimeout(tick, 700);
  }

  /**
   * 看广告复活 = 步数上限 +8，继续这一局。
   * 坠出棋盘时额外把最后那一手撤回来（否则人还在棋盘外面）。
   */
  revive() {
    if (this.mode !== "fail") return false;
    this.maxMoves += GAME.play.reviveBonus;
    if (this.failKind === "fell" && this._snapshot) {
      this.state = this._snapshot;
      this.moves = Math.max(0, this.moves - 1);
    }
    this._snapshot = null;
    this.revived = true;
    this.view.px = this.state.px;
    this.view.py = this.state.py;
    this.view.hop = 0;
    this.cellFx.length = 0;
    this.parts.length = 0;
    this.flipT = 0;
    this.flipPrevGrid = null;
    this.seq.clear();
    this._resolve = null;
    this.pendingDir = 0;
    this.mode = "play";
    this.sprite.set("idle", { force: true });
    this.ui.hideAll();
    this.ui.showHud(true);
    this.updateHud();
    this.ui.toast(t("toast.revived"), 1600);
    return true;
  }

  async doubleCoins() {
    if (this.doubled || this.clearReward <= 0) return false;
    const ok = await this.ads.rewarded(GAME.ads.doubleCoins);
    if (!ok) {
      this.ui.toast(t("toast.adFail"), 1800);
      return false;
    }
    this.doubled = true;
    this.save.coins += this.clearReward;
    this.persist();
    this.updateHud();
    this.ui.setClearCoins(this.clearReward * 2, false);
    return true;
  }

  persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (_) { /* 隐私模式忽略 */ }
  }

  updateHud() {
    this.ui.setHud({
      level: this.level.id,
      moves: this.moves,
      max: this.maxMoves,
      left: this.state ? countLeft(this.state) : 0,
      total: this.left0,
      coins: this.save.coins
    });
  }

  // ---------------------------------------------------------------- 暂停
  pause() {
    if (this.mode !== "play") return;
    this.mode = "pause";
    this.ui.showPause(true);
  }

  resume() {
    if (this.mode !== "pause") return;
    this.mode = "play";
    this.ui.showPause(false);
  }

  togglePause() {
    if (this.mode === "play") this.pause();
    else if (this.mode === "pause") this.resume();
  }

  // ---------------------------------------------------------------- 动作
  playAction(name, hold) {
    if (!this.animator.has("gummy", name)) return;
    this.sprite.set(name, { force: true });
    const frames = (this.animator.def("gummy")?.actions?.[name]?.frames) || 4;
    const fps = this.animator.fps("gummy", name) || 12;
    this.actionTimer = hold || frames / fps + 0.08;
  }

  // ---------------------------------------------------------------- 主循环
  update(dt) {
    this.clock += dt;
    if (this.mode === "play" || this.mode === "clear" || this.mode === "fail") {
      this.seq.update(dt);
      this.sprite.update(dt);
    }
    if (this.actionTimer > 0) {
      this.actionTimer -= dt;
      if (this.actionTimer <= 0 && this.mode === "play") this.sprite.set("idle");
    }

    if (!this.seq.busy && this._resolve) {
      const r = this._resolve;
      this._resolve = null;
      if (r === "win") this.onLevelClear();
      else this.onFail(r);
    }

    if (!this.seq.busy && this.pendingDir && this.mode === "play") {
      const d = this.pendingDir;
      this.pendingDir = 0;
      this.doMove(d);
    }

    for (let i = this.cellFx.length - 1; i >= 0; i -= 1) {
      const f = this.cellFx[i];
      f.t += dt;
      if (f.t >= f.dur) this.cellFx.splice(i, 1);
    }
    for (let i = this.parts.length - 1; i >= 0; i -= 1) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.dur) this.parts.splice(i, 1);
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.flipT > 0) {
      this.flipT += dt;
      if (this.flipT >= this.flipDur) this.flipT = 0;
    }
  }

  // ---------------------------------------------------------------- 渲染
  cellOf(grid, x, y) {
    if (!grid) return CELL.EMPTY;
    const W = this.state.W;
    if (x < 0 || x >= W || y < 0 || y >= this.state.H) return CELL.EMPTY;
    return grid[y * W + x];
  }

  render() {
    const ctx = this.ctx;
    const vw = this._view;

    ctx.setTransform(vw.pr * vw.scale, 0, 0, vw.pr * vw.scale, vw.pr * vw.ox, vw.pr * vw.oy);
    ctx.clearRect(this._vis.x0 - 8, this._vis.y0 - 8,
      this._vis.x1 - this._vis.x0 + 16, this._vis.y1 - this._vis.y0 + 16);

    drawBackground(ctx, this.bgImage(), { drift: 0, tint: null }, this._vis);
    if (!this.state) return;

    const L = this.layout;
    ctx.save();
    if (this.shake > 0) {
      const k = this.shake / 0.16;
      ctx.translate(Math.sin(this.clock * 92) * 7 * k, 0);
    }

    const bw = L.W * L.cell;
    const bh = L.H * L.cell;

    const flipP = this.flipT > 0 ? this.flipT / this.flipDur : 0;
    if (flipP > 0) {
      const cx = L.x0 + bw / 2;
      const cy = L.y0 + bh / 2;
      const k = Math.max(0.03, Math.abs(Math.cos(flipP * Math.PI)));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, k);
      ctx.translate(-cx, -cy);
      this.paintWorld(flipP < 0.5 && this.flipPrevGrid ? this.flipPrevGrid : this.state.g);
      ctx.restore();
    } else {
      this.paintWorld(this.state.g);
    }
    ctx.restore();

    // 场外特效（碎块 / 闪光 / 扬尘）
    for (const p of this.parts) {
      const img = this.animator.images.get(
        `${this.animator.dir}fx/${p.name}_${String(this.fxIndex(p)).padStart(2, "0")}.${this.animator.ext}`
      );
      if (!img) continue;
      const x = L.x0 + (p.x + 0.5) * L.cell;
      const y = L.y0 + (L.H - p.y - 0.5) * L.cell;
      const size = L.cell * 1.5 * p.scale;
      const k = p.t / p.dur;
      ctx.globalAlpha = k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      ctx.globalAlpha = 1;
    }
  }

  fxIndex(p) {
    const total = this.animator.manifest.fx?.[p.name]?.frames || 5;
    return clamp(Math.floor((p.t / p.dur) * total) + 1, 1, total);
  }

  paintWorld(grid) {
    this.paintCells(grid);
    this.paintGems();
    this.paintPlayer();
  }

  paintCells(grid) {
    const ctx = this.ctx;
    const L = this.layout;
    const s = L.cell;
    const fxMap = new Map();
    for (const f of this.cellFx) fxMap.set(`${f.x},${f.y}`, f);

    // 门：按列合并成整扇（3 格高，同开同关）
    const gates = [];
    for (let x = 0; x < L.W; x += 1) {
      let y = 0;
      while (y < L.H) {
        if (this.cellOf(grid, x, y) === CELL.GATE) {
          const base = y;
          let h = 0;
          while (y < L.H && this.cellOf(grid, x, y) === CELL.GATE) { h += 1; y += 1; }
          gates.push({ x, y: base, h });
        } else y += 1;
      }
    }

    for (let y = 0; y < L.H; y += 1) {
      for (let x = 0; x < L.W; x += 1) {
        const v = this.cellOf(grid, x, y);
        if (v === CELL.EMPTY || v === CELL.GATE) continue;
        const px = L.x0 + x * s;
        const py = L.y0 + (L.H - 1 - y) * s;
        const f = fxMap.get(`${x},${y}`);
        ctx.save();
        if (f && f.kind === "slide") {
          const e = 1 - Math.pow(1 - clamp(f.t / f.dur, 0, 1), 3);
          ctx.translate((f.fx - f.x) * (1 - e) * s, -(f.fy - f.y) * (1 - e) * s);
        } else if (f && f.kind === "bump") {
          const k = clamp(f.t / f.dur, 0, 1);
          const b = 1 + Math.sin(k * Math.PI) * 0.14;
          ctx.translate(px + s / 2, py + s);
          ctx.scale(1 + (1 - b) * 0.55, b);
          ctx.translate(-(px + s / 2), -(py + s));
        }
        ctx.translate(px, py);
        if (v === CELL.WALL) {
          drawWall(ctx, s, this.cellOf(grid, x, y + 1) !== CELL.WALL);
        } else if (v === CELL.BOMB) {
          // 必须排在 v > 0 之前：BOMB 的枚举值是 99，落到数值分支会被画成「99」数字块
          drawBomb(ctx, s, this.clock);
        } else if (v >= 1 && v <= 9) {
          drawBlock(ctx, v, s);
          if (this.gemHiddenAt(x, y)) drawGemHint(ctx, s, this.clock + x * 0.7);
        } else if (v === CELL.CRATE) {
          drawCrate(ctx, s);
        } else if (v === CELL.SPRING) {
          drawSpring(ctx, s, this.clock);
        } else if (v === CELL.ROCK) {
          drawRock(ctx, s);
        } else if (v === CELL.FLIP) {
          drawFlip(ctx, s, this.clock);
        } else if (v === CELL.PLATE) {
          const down = (this.state.px === x && this.state.py === y + 1)
            || this.cellOf(grid, x, y + 1) === CELL.CRATE;
          drawPlate(ctx, s, down);
        }
        ctx.restore();
      }
    }

    for (const gate of gates) {
      ctx.save();
      ctx.translate(L.x0 + gate.x * s, L.y0 + (L.H - gate.y - gate.h) * s);
      drawGate(ctx, s, gate.h * s);
      ctx.restore();
    }
  }

  gemHiddenAt(x, y) {
    for (const gem of this.state.gems) {
      if (gem.st === "hidden" && gem.x === x && gem.y === y) return true;
    }
    return false;
  }

  paintGems() {
    const ctx = this.ctx;
    const L = this.layout;
    for (const gem of this.state.gems) {
      if (gem.st !== "out") continue;
      ctx.save();
      ctx.translate(L.x0 + gem.x * L.cell, L.y0 + (L.H - 1 - gem.y) * L.cell);
      drawGem(ctx, L.cell, this.clock + gem.x);
      ctx.restore();
    }
  }

  paintPlayer() {
    const ctx = this.ctx;
    const L = this.layout;
    const canvasSize = this.animator.manifest.canvas || 512;
    const px = L.x0 + (this.view.px + 0.5) * L.cell;
    const py = L.y0 + (L.H - this.view.py) * L.cell - this.view.hop * L.cell;
    this.sprite.scale = (L.cell * 1.62) / canvasSize;
    this.sprite.flip = false;
    this.sprite.draw(ctx, px, py);
  }
}
