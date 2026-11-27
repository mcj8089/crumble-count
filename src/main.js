// src/main.js — 启动编排：域名锁 → 主题 → 词条 → 预载（真实百分比）→ SDK → 游戏 → 输入/UI 绑定
import { GAME } from "config/game.config.js";
import { LEVELS } from "config/levels.js";
import { applyTheme } from "art/theme.js";
import { enforceDomainLock } from "core/domainlock.js";
import { applyStatic, t } from "core/i18n.js";
import { preloadArt } from "core/assets.js";
import { createViewport } from "core/viewport.js";
import { Animator } from "core/animator.js";
import { GameAudio } from "core/audio.js";
import { Ads } from "core/ads.js";
import { UI } from "ui/ui.js";
import { Game } from "game/main.js";
import { Input, isTouchDevice } from "game/input.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 视口适配：逻辑坐标固定 1280×720，映射层自适应（contain/cover + 真实像素比 + 安全区） */
let viewport = null;
function fitStage() {
  viewport = createViewport(GAME.design, {
    fit: GAME.design.fit,
    safe: GAME.design.safe,
    maxPixelRatio: GAME.design.maxPixelRatio
  });
  return viewport;
}

async function loadManifest() {
  try {
    const res = await fetch(GAME.frames.manifest, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch (err) {
    console.warn("[boot] 帧清单读取失败，按空清单启动：", err?.message || err);
    return { dir: GAME.frames.dir, ext: GAME.frames.ext, characters: {}, fx: {} };
  }
}

async function boot() {
  fitStage();

  applyTheme(GAME.theme);
  applyStatic(document);

  const ui = new UI();
  ui.setBoot(0);
  ui.setTitle(t("brand.name"));

  // 域名锁：未授权域名 3 秒后跳 pipygames.com，期间给可见提示（不阻断初始化）
  enforceDomainLock(() => {
    ui.toast(t("toast.redirect"), 3200);
  });

  const started = performance.now();
  const manifest = await loadManifest();
  const { images, missing } = await preloadArt(GAME, manifest, (p) => ui.setBoot(p));
  if (missing.length) console.info(`[boot] ${missing.length} 个资源未就绪（占位或未生成）`);

  const audio = new GameAudio(GAME.audio).build();
  const ads = new Ads(GAME.ads);
  const sdkOk = await ads.init();
  if (!sdkOk) console.info("[boot] pipysdk 未就绪，广告入口自动隐藏");

  const animator = new Animator({ images, manifest });
  const animCount = animator.createAnims();   // 逐帧帧表开局一次性建好
  console.info(`[boot] ${animCount} 个逐帧动作已就绪`);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", GAME.name);
  document.getElementById("game-root").appendChild(canvas);

  const touch = isTouchDevice();
  const game = new Game({ canvas, ui, audio, ads, animator, isTouch: touch, viewport });
  viewport.onChange(() => game.resize());

  const input = new Input(document.getElementById("stage"), {
    onMove: (dir) => game.onMove(dir),
    onPause: () => game.togglePause(),
    onFirstAction: () => audio.unlock()
  });
  game.input = input;

  if (touch) {
    ui.setTouch(true);
    input.bindPad(document.getElementById("pad-left"), -1);
    input.bindPad(document.getElementById("pad-right"), 1);
  }

  // 首次交互解锁音频（自动播放策略）
  const unlock = () => {
    audio.unlock();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  // 广告期间暂停 + 静音，结束后恢复
  ads.onStart(() => {
    audio.suspend();
    if (game.mode === "play") { game.pause(); game._resumeAfterAd = true; }
  });
  ads.onEnd(() => {
    audio.restore();
    if (game._resumeAfterAd) { game._resumeAfterAd = false; game.resume(); }
  });

  // ---------------------------------------------------------------- 菜单
  const refreshMenu = () => {
    const next = Math.min(Math.max(1, game.save.unlocked), LEVELS.length);
    ui.setPlayLabel(next > 1 ? t("menu.continue") : t("menu.play"));
    ui.setMenuCoins(game.save.coins);
  };

  const goHome = () => {
    audio.play("click");
    game.mode = "menu";
    game.seq.clear();
    game._resolve = null;
    ui.hideAll();
    ui.showHud(false);
    ui.keybar(false);
    ui.hint(false);
    ui.setObjective("");
    refreshMenu();
    ui.showMenu(true);
  };

  // ---------------------------------------------------------------- UI → 游戏
  ui.on("play", () => {
    audio.play("click");
    const next = Math.min(Math.max(1, game.save.unlocked), LEVELS.length);
    game.startLevel(next - 1);
  });

  ui.on("levels", () => {
    audio.play("click");
    ui.buildLevels(LEVELS, game.save);
    ui.showMenu(false);
    ui.showLevels(true);
  });

  ui.on("levelsBack", () => {
    audio.play("click");
    ui.showLevels(false);
    ui.showMenu(true);
  });

  ui.on("pick", (idx) => {
    audio.play("click");
    ui.showLevels(false);
    game.startLevel(idx);
  });

  ui.on("next", () => {
    audio.play("click");
    if (game.levelIdx + 1 < LEVELS.length) game.startLevel(game.levelIdx + 1);
    else goHome();
  });

  ui.on("replay", () => { audio.play("click"); game.startLevel(game.levelIdx); });
  ui.on("retry", () => { audio.play("click"); game.startLevel(game.levelIdx); });
  ui.on("home", goHome);
  ui.on("pause", () => { audio.play("click"); game.pause(); });
  ui.on("resume", () => { audio.play("click"); game.resume(); });

  // 激励视频：只有 showRewarded === true 才发奖励，其余一律提示、绝不白送
  ui.on("revive", async () => {
    audio.play("click");
    if (!ads.canShow(GAME.ads.revive)) { ui.toast(t("toast.adFail"), 1800); return; }
    const ok = await ads.rewarded(GAME.ads.revive);
    if (!ok) { ui.toast(t("toast.adFail"), 1800); return; }
    game.revive();
  });

  ui.on("double", async () => {
    audio.play("click");
    if (!ads.canShow(GAME.ads.doubleCoins)) { ui.toast(t("toast.adFail"), 1800); return; }
    await game.doubleCoins();
  });

  ui.on("sound", () => {
    const muted = audio.toggleMute();
    ui.setMuted(muted);
    ui.toast(muted ? t("toast.audioOff") : t("toast.audioOn"), 1200);
    if (!muted) audio.play("click");
  });
  ui.setMuted(audio.muted);

  // 切后台自动暂停
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.mode === "play") game.pause();
  });

  // 主循环：performance.now 驱动（后台节流不影响状态机一致性）
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // 菜单背后先摆一关，避免开屏之后是一片空场（不弹关卡横幅，菜单会把它压住）
  game.startLevel(Math.min(Math.max(1, game.save.unlocked), LEVELS.length) - 1, { announce: false });
  game.mode = "menu";
  ui.showHud(false);
  ui.hideAll();
  ui.keybar(false);
  ui.hint(false);
  ui.setObjective("");

  // 开屏至少停留 600ms，避免 0→100 闪一下就消失
  await sleep(Math.max(0, 600 - (performance.now() - started)));
  ui.setBoot(1);
  ui.bootDone();
  refreshMenu();
  ui.showMenu(true);

  // 调试/平台可用：window.PipyGame
  window.PipyGame = { game, ui, audio, ads, manifest, viewport, levels: LEVELS };
}

boot().catch((err) => {
  console.error("[boot] 启动失败", err);
  const tip = document.getElementById("boot-tip");
  if (tip) tip.textContent = "Load failed";
});
