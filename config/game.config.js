// config/game.config.js — 全局配置（唯一数值来源，代码里禁止再散落魔法数）
export const GAME = {
  id: "crumble-count",
  name: "Crumble Count",
  nameZh: "碎块归零",
  slug: "crumble-count",
  version: "1.0.0",

  // 画面固定配置：横屏全屏渲染，禁止 9:16 竖屏。
  // 1280×720 是「逻辑坐标系」，不是固定显示像素：碰撞/摆位/生成范围都在里面算，
  // 真实视口由 src/core/viewport.js 做等比映射（自适应发生在这层）。
  design: {
    width: 1280,
    height: 720,
    // bleed   背景出血铺满整屏，玩法层居中不裁（推荐：宽屏手机/带鱼屏不掉黑边）
    // contain 整幅可见，留白由背景光晕兜底（玩法安全，但非 16:9 会有边）
    // cover   铺满裁边，HUD 与玩法元素必须落在 viewport.safe 里
    fit: "bleed",
    safe: 0.05,           // 安全区内缩比例
    maxPixelRatio: 3      // 画布后备分辨率上限；写死 2 会在 4K/2.75 倍屏上发虚
  },

  // UI 世界观：与画面美术同源（糖果玩具世界）
  theme: { world: "toy", hue: 12 },

  // 美术风格声明：2D 卡通风（厚描边 + 硬底阴影 + 糖果配色），逐帧条带同源
  art: { style: "2d-cartoon", framing: "side" },

  // 逐帧资产：manifest 是唯一事实来源（产图 / 运行时 / 校验三方共用）
  frames: {
    dir: "assets/images/frames/",
    manifest: "assets/images/frame-manifest.json",
    canvas: 512,        // 切帧画布边长
    baseline: 20,       // 脚底基准线距画布底部像素
    ext: "webp"         // 交付图统一 WebP
  },

  // 静态背景（按关卡区间切换，渲染层靠 tint 出变体）
  images: {
    dir: "assets/images/",
    backgrounds: ["bg_day.webp", "bg_dusk.webp", "bg_night.webp"]
  },

  audio: {
    dir: "assets/audio/",
    master: 0.8,
    bgm: "bgm_main.wav",
    // 键名 = 语义名（src/core/audio.js 按名播放）
    files: {
      click: "sfx_click.wav",
      hop: "sfx_hop.wav",
      hit: "sfx_hit.wav",
      break: "sfx_break.wav",
      push: "sfx_push.wav",
      spring: "sfx_spring.wav",
      flip: "sfx_flip.wav",
      gem: "sfx_gem.wav",
      blast: "sfx_blast.wav",
      fail: "sfx_fail.wav",
      win: "sfx_win.wav"
    }
  },

  // SDK 广告位（placement 名必须与 pipysdk 指南第 2 节一致）
  ads: {
    revive: "revive",            // 激励视频：原地复活（每局 1 次）
    doubleCoins: "doubleCoins",  // 激励视频：结算金币翻倍（每局 1 次）
    stageClear: "stageClear",    // 插屏：过关间隔
    gameOver: "gameOver"         // 插屏：失败
  },

  // 玩法数值基线
  play: {
    cell: 64,                 // 棋盘格边长（逻辑像素）
    boardGap: 4,              // 格子内缩，做出块与块之间的缝
    moveDur: { walk: 0.11, hop: 0.20, fall: 0.055, chip: 0.13, pop: 0.18 },
    // 三星判定：以 BFS 最优步数（par）为基准的宽容度
    starSlack: [3, 9],        // ≤ par+3 → 3 星；≤ par+9 → 2 星；否则 1 星
    moveSlack: 14,            // 步数上限 = par + 14（用完即失败，复活 +8）
    reviveBonus: 8,           // 看广告复活补的步数
    coinPerStar: 15,
    coinPerGem: 25,
    startGems: 0,
    // 关卡换背景的时间段（按关卡 id 区间）
    bgByLevel: [[1, 20, 0], [21, 33, 1], [34, 40, 2]]
  }
};
