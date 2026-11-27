// src/ui/ui.js — 全部 UI 组件（HUD / 开屏 / 覆盖层 / 引导 / 提示 / 选关）
// 原则：结构在 index.html，文字全部走 t()（禁止 innerHTML 拼动态文案），样式全在 styles.css。
import { t, applyStatic } from "core/i18n.js";

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      boot: $("boot"), bootFill: $("boot-fill"), bootPct: $("boot-pct"), bootTip: $("boot-tip"),
      hud: $("hud"), level: $("hud-level"), moves: $("hud-moves"), coins: $("hud-coins"),
      movesMax: $("hud-moves-max"), chipMoves: $("chip-moves"), gaugeBox: $("hud-gauge"),
      gauge: $("hud-gauge-fill"),
      objective: $("objective"), objectiveText: $("objective-text"),
      keybar: $("keybar"), keyMove: $("keybar-move"),
      hint: $("hint"), hintText: $("hint-text"),
      touch: $("touch"), padLeft: $("pad-left"), padRight: $("pad-right"),
      toast: $("toast"), banner: $("banner"),
      menu: $("ov-menu"), levels: $("ov-levels"), pause: $("ov-pause"),
      clear: $("ov-clear"), fail: $("ov-fail"),
      failTitle: $("fail-title"), failDesc: $("fail-desc"),
      menuTitle: $("menu-title"), menuCoins: $("menu-coins"),
      grid: $("level-grid"),
      stars: $("clear-stars"), clearMoves: $("clear-moves"),
      clearPar: $("clear-par"), clearCoins: $("clear-coins"),
      btnPlay: $("btn-play"), btnLevels: $("btn-levels"), btnLevelsBack: $("btn-levels-back"),
      btnResume: $("btn-resume"), btnRestart: $("btn-restart"), btnPauseHome: $("btn-pause-home"),
      btnNext: $("btn-next"), btnReplay: $("btn-replay"), btnClearHome: $("btn-clear-home"),
      btnDouble: $("btn-double"),
      btnRetry: $("btn-retry"), btnFailHome: $("btn-fail-home"), btnRevive: $("btn-revive"),
      btnPause: $("btn-pause"), btnSound: $("btn-sound")
    };
    this._handlers = new Map();
    this._bannerTimer = 0;
    this._toastTimer = 0;
    applyStatic(document);
    this._bind();
  }

  on(name, fn) {
    if (!this._handlers.has(name)) this._handlers.set(name, []);
    this._handlers.get(name).push(fn);
  }

  _emit(name, data) {
    for (const fn of this._handlers.get(name) || []) fn(data);
  }

  _bind() {
    const click = (el, name) => {
      if (!el) return;
      el.addEventListener("click", (e) => { e.preventDefault(); this._emit(name); });
    };
    click(this.el.btnPlay, "play");
    click(this.el.btnLevels, "levels");
    click(this.el.btnLevelsBack, "levelsBack");
    click(this.el.btnResume, "resume");
    click(this.el.btnRestart, "replay");
    click(this.el.btnPauseHome, "home");
    click(this.el.btnNext, "next");
    click(this.el.btnReplay, "replay");
    click(this.el.btnClearHome, "home");
    click(this.el.btnDouble, "double");
    click(this.el.btnRetry, "retry");
    click(this.el.btnFailHome, "home");
    click(this.el.btnRevive, "revive");
    click(this.el.btnPause, "pause");
    click(this.el.btnSound, "sound");
  }

  // ---------------------------------------------------------------- 开屏
  /** 真实进度：0..1 → 数字百分比 + 进度条（禁止静态假进度） */
  setBoot(p) {
    const pct = Math.max(0, Math.min(1, Number(p) || 0));
    const n = Math.round(pct * 100);
    if (this.el.bootPct) this.el.bootPct.textContent = String(n);
    if (this.el.bootFill) this.el.bootFill.style.width = `${n}%`;
  }

  bootDone() {
    if (!this.el.boot) return;
    this.el.boot.classList.add("is-done");
    setTimeout(() => { this.el.boot.hidden = true; }, 500);
  }

  // ---------------------------------------------------------------- HUD
  showHud(on = true) {
    if (this.el.hud) this.el.hud.hidden = !on;
  }

  /** moves/max：步数上限是玩法核心，必须一直可见（HP 条式的心理压力） */
  setHud({ level = 1, moves = 0, max = 0, left = 0, total = 1, coins = 0 } = {}) {
    if (this.el.level) this.el.level.textContent = String(level);
    if (this.el.moves) this.el.moves.textContent = String(moves);
    if (this.el.movesMax) this.el.movesMax.textContent = max > 0 ? `/${max}` : "";
    if (this.el.chipMoves) {
      const low = max > 0 && max - moves <= 3;
      this.el.chipMoves.classList.toggle("is-low", low);
    }
    if (this.el.coins) this.el.coins.textContent = String(coins);
    if (this.el.gauge) {
      const p = Math.max(0, Math.min(1, left / Math.max(total, 1)));
      this.el.gauge.style.width = `${p * 100}%`;
      // 余量告急：填充换色（不是闪一下），让"还剩几块"有颜色读数
      if (this.el.gaugeBox) this.el.gaugeBox.classList.toggle("is-low", p <= 0.25);
    }
  }

  setObjective(text) {
    if (!this.el.objective) return;
    if (this.el.objectiveText) this.el.objectiveText.textContent = text || "";
    this.el.objective.classList.toggle("is-open", !!text);
  }

  // ---------------------------------------------------------------- 覆盖层
  _open(el, on) {
    if (el) el.classList.toggle("is-open", !!on);
  }

  /** 结界面板一打开，吐司/手势提示/按键图例必须一起收：它们会浮在面板下沿外面 */
  clearTransient() {
    clearTimeout(this._toastTimer);
    clearTimeout(this._bannerTimer);
    if (this.el.toast) this.el.toast.classList.remove("is-open");
    if (this.el.banner) this.el.banner.classList.remove("is-open");
    if (this.el.hint) this.el.hint.classList.remove("is-open");
    if (this.el.keybar) this.el.keybar.classList.remove("is-open", "is-dim");
  }

  showMenu(on) { this._open(this.el.menu, on); }
  showLevels(on) { this._open(this.el.levels, on); }
  showPause(on) { this._open(this.el.pause, on); }
  hideAll() {
    this.showMenu(false);
    this.showLevels(false);
    this.showPause(false);
    this._open(this.el.clear, false);
    this._open(this.el.fail, false);
  }

  setPlayLabel(text) {
    if (this.el.btnPlay) this.el.btnPlay.textContent = text;
  }

  setMenuCoins(n) {
    if (this.el.menuCoins) this.el.menuCoins.textContent = String(n);
  }

  setTitle(text) {
    if (this.el.menuTitle) this.el.menuTitle.textContent = text;
  }

  // ---------------------------------------------------------------- 选关
  buildLevels(levels, save) {
    const grid = this.el.grid;
    if (!grid) return;
    grid.textContent = "";
    // 按章分行：40 个一模一样的方块看不出进度感，每行 = 一章（章名 + 该章 5 关）
    const rows = new Map();
    for (const lv of levels) {
      const ch = lv.chapter || 1;
      if (!rows.has(ch)) {
        const row = document.createElement("div");
        row.className = "level-chap";
        const head = document.createElement("div");
        head.className = "level-chap__head";
        const no = document.createElement("span");
        no.className = "level-chap__no";
        no.textContent = t("chapter.label", { n: ch });
        const name = document.createElement("span");
        name.className = "level-chap__name";
        name.textContent = t(`chapter.${ch}`);
        head.appendChild(no);
        head.appendChild(name);
        row.appendChild(head);
        grid.appendChild(row);
        rows.set(ch, row);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "level-btn";
      btn.textContent = String(lv.id);

      const stars = (save.stars && save.stars[lv.id]) || 0;
      if (stars > 0) {
        const dots = document.createElement("span");
        dots.className = "level-btn__dots";
        for (let i = 0; i < 3; i += 1) {
          const dot = document.createElement("i");
          if (i < stars) dot.className = "is-on";
          dots.appendChild(dot);
        }
        btn.appendChild(dots);
      }
      if (lv.id > save.unlocked) {
        btn.classList.add("is-locked");
        btn.disabled = true;
        btn.title = t("levels.locked");
      } else if (stars > 0) {
        btn.classList.add("is-done");
      }
      if (lv.id === Math.min(save.unlocked, levels.length)) btn.classList.add("is-current");
      rows.get(ch).appendChild(btn);
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        this._emit("pick", lv.id - 1);
      });
    }
  }

  // ---------------------------------------------------------------- 结算
  showClear({ stars = 1, moves = 0, best = 0, coins = 0, hasNext = true, canDouble = false } = {}) {
    this.clearTransient();
    if (this.el.stars) {
      [...this.el.stars.children].forEach((s, i) => s.classList.toggle("is-on", i < stars));
    }
    if (this.el.clearMoves) this.el.clearMoves.textContent = String(moves);
    if (this.el.clearPar) this.el.clearPar.textContent = String(best);
    if (this.el.clearCoins) this.el.clearCoins.textContent = String(coins);
    if (this.el.btnNext) {
      this.el.btnNext.hidden = !hasNext;
      this.el.btnNext.textContent = hasNext ? t("btn.next") : t("btn.home");
    }
    this._open(this.el.clear, true);
    this.setClearCoins(coins, canDouble);
  }

  setClearCoins(coins, canDouble) {
    if (this.el.clearCoins) this.el.clearCoins.textContent = String(coins);
    if (this.el.btnDouble) this.el.btnDouble.hidden = !canDouble;
  }

  /** kind: "out"（步数用完）| "stuck"（左右都走不动） */
  showFail({ canRevive = false, kind = "out" } = {}) {
    this.clearTransient();
    if (this.el.failTitle) this.el.failTitle.textContent = t(kind === "stuck" ? "fail.stuck" : "fail.title");
    if (this.el.failDesc) this.el.failDesc.textContent = t(kind === "stuck" ? "fail.descStuck" : "fail.desc");
    if (this.el.btnRevive) this.el.btnRevive.hidden = !canRevive;
    this._open(this.el.fail, true);
  }

  /** SDK 的广告配置是异步到位的：面板已经打开时也能补显复活入口 */
  showRevive(on) {
    if (this.el.btnRevive) this.el.btnRevive.hidden = !on;
  }

  // ---------------------------------------------------------------- 提示
  banner(text, ms = 1500) {
    if (!this.el.banner) return;
    this.el.banner.textContent = text;
    this.el.banner.classList.add("is-open");
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => this.el.banner.classList.remove("is-open"), ms);
  }

  toast(text, ms = 1800) {
    if (!this.el.toast) return;
    this.el.toast.textContent = text;
    this.el.toast.classList.add("is-open");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.el.toast.classList.remove("is-open"), ms);
  }

  // ---------------------------------------------------------------- 新手引导
  keybar(on, { dim = false } = {}) {
    if (!this.el.keybar) return;
    this.el.keybar.classList.toggle("is-open", !!on);
    this.el.keybar.classList.toggle("is-dim", !!dim);
    if (this.el.keyMove) this.el.keyMove.textContent = t("key.left");
  }

  hint(on, text = "", { x = 640, y = 470 } = {}) {
    if (!this.el.hint) return;
    if (text && this.el.hintText) this.el.hintText.textContent = text;
    this.el.hint.style.left = `${x}px`;
    this.el.hint.style.top = `${y}px`;
    this.el.hint.classList.toggle("is-open", !!on);
  }

  setTouch(on) {
    if (this.el.touch) this.el.touch.classList.toggle("is-on", !!on);
  }

  setMuted(muted) {
    document.body.classList.toggle("is-muted", !!muted);
    if (this.el.btnSound) {
      this.el.btnSound.setAttribute("aria-label", muted ? t("btn.soundOn") : t("btn.soundOff"));
    }
  }
}
