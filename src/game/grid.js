// src/game/grid.js — 棋盘规则内核（纯函数、零依赖）
//
// 为什么单独成文件：玩法判定是这套游戏唯一「不能靠手感糊过去」的部分。
// 这里不碰 DOM / canvas / 音频，Node 里可以直接 import 跑关卡验证（tools/verify_levels.mjs）。
//
// 坐标口径：
//   y = 0 是地图最后一行（低处），下落 = y 递减，出界 = 坠落失败。
//   索引 index = y * W + x。
//
// 一次 step() 的分支是互斥且有序的（与参考玩法一致）：
//   ① 目标格空           → 走
//   ② 目标格是箱子且后方空 → 推（箱子会掉到该列的落点，人进入箱子原格）
//   ③ 目标格被占，且自己与目标的上方都空 → 斜上跳一格（踩上 1 格高的障碍顶部）
//   ④ 都不成立           → 卡住（不消耗、只抖一下）
//
// 走完之后固定结算：清裂块 → 落地（脚下数字 −1）→ 弹簧 → 翻转 → 门/箱子重力。

export const CELL = {
  EMPTY: 0,
  WALL: -1,
  CRACK: -2,   // 刚砸碎、下一回合才消失的残块
  CRATE: -4,   // 可推、会掉的箱子
  SPRING: -5,  // 弹簧：按输入方向弹射
  ROCK: -6,    // 只能被炸碎的硬砖
  PLATE: -7,   // 压力板（人站上去或压箱子）
  GATE: -8,    // 门（3 格高，全部同开同关）
  FLIP: -9,    // 翻转砖：整盘上下镜像
  BOMB: 99     // 炸弹：落地即爆
};

const CH = { 0: "0", 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9" };
function cellChar(v) {
  if (v >= 0 && v <= 9) return CH[v];
  if (v === CELL.WALL) return "#";
  if (v === CELL.CRACK) return "~";
  if (v === CELL.CRATE) return "c";
  if (v === CELL.SPRING) return "s";
  if (v === CELL.ROCK) return "x";
  if (v === CELL.PLATE) return "_";
  if (v === CELL.GATE) return "|";
  if (v === CELL.FLIP) return "f";
  if (v === CELL.BOMB) return "b";
  return "?";
}

export const DEFAULT_MECH = {
  maxStack: 5,
  cascade: true,        // 数字到 0 立刻消失并继续坠落
  springUp: 2,
  springAcross: 1,
  springLoops: 6,
  flipLoops: 4,
  gateLatch: false,     // true = 压力板压过一次后门常开
  bombRadius: 1,
  gemSlide: true,
  pushEnabled: true
};

export function makeMech(patch) {
  return Object.assign({}, DEFAULT_MECH, patch || {});
}

// ---------------------------------------------------------------- 解析
export function parseLevel(level, mech) {
  const rows = level.map;
  const H = rows.length;
  const W = rows[0].length;
  const g = new Array(W * H).fill(CELL.EMPTY);
  let px = 0;
  let py = 0;
  let found = 0;

  for (let r = 0; r < H; r += 1) {
    const row = rows[r];
    if (row.length !== W) throw new Error(`${level.id}: 第 ${r} 行宽度不一致`);
    const y = H - 1 - r;
    for (let x = 0; x < W; x += 1) {
      const ch = row[x];
      const i = y * W + x;
      if (ch === "#") g[i] = CELL.WALL;
      else if (ch >= "1" && ch <= "9") g[i] = Number(ch);
      else if (ch === "c") g[i] = CELL.CRATE;
      else if (ch === "s") g[i] = CELL.SPRING;
      else if (ch === "x") g[i] = CELL.ROCK;
      else if (ch === "_") g[i] = CELL.PLATE;
      else if (ch === "|") {
        // 门永远 3 格高：字符本身占最下格，上面两格必须是空的
        for (let k = 1; k <= 2; k += 1) {
          if (y + k >= H || g[(y + k) * W + x] !== CELL.EMPTY) {
            throw new Error(`${level.id}: 门 (${x},${y}) 上方两格必须为空`);
          }
        }
        for (let k = 0; k < 3; k += 1) g[(y + k) * W + x] = CELL.GATE;
      }
      else if (ch === "f") g[i] = CELL.FLIP;
      else if (ch === "*") g[i] = CELL.BOMB;
      else if (ch === "P") { px = x; py = y; found += 1; }
      else if (ch !== ".") throw new Error(`${level.id}: 未知字符 "${ch}"`);
    }
  }
  if (found !== 1) throw new Error(`${level.id}: 必须且只能有一个 P（当前 ${found}）`);

  const s = {
    W, H, g, px, py,
    mech: mech || makeMech(),
    gems: [],
    latched: false,
    moves: 0,
    levelId: level.id
  };

  const flat = level.gems || [];
  for (let k = 0; k + 2 < flat.length; k += 3) {
    const gem = { x: flat[k], y: flat[k + 1], dir: flat[k + 2] || 1, st: "hidden" };
    const v = g[gem.y * W + gem.x];
    if (v > 0) gem.st = "hidden";
    else { gem.st = "out"; settleGem(s, gem, []); }
    s.gems.push(gem);
  }
  updateGates(s, []);
  return s;
}

export function cloneState(s) {
  return {
    W: s.W, H: s.H, g: s.g.slice(), px: s.px, py: s.py,
    mech: s.mech, gems: s.gems.map((g) => ({ ...g })),
    latched: s.latched, moves: s.moves, levelId: s.levelId
  };
}

const at = (s, x, y) => (x < 0 || x >= s.W || y < 0 || y >= s.H ? CELL.EMPTY : s.g[y * s.W + x]);
const put = (s, x, y, v) => { if (x >= 0 && x < s.W && y >= 0 && y < s.H) s.g[y * s.W + x] = v; };

/** 场上还剩多少个数字格（1..9；炸弹 99 是工具，不算待清目标） */
export function countLeft(s) {
  let n = 0;
  for (let i = 0; i < s.g.length; i += 1) {
    const v = s.g[i];
    if (v >= 1 && v <= 9) n += 1;
  }
  return n;
}

export function isWin(s) {
  return countLeft(s) === 0;
}

// ---------------------------------------------------------------- 门 / 板
export function scanPlates(s) {
  const out = [];
  for (let i = 0; i < s.g.length; i += 1) {
    if (s.g[i] === CELL.PLATE) out.push({ x: i % s.W, y: Math.floor(i / s.W) });
  }
  return out;
}

/** 门永远 3 格高：按列扫描连续的 GATE 段，取每段的最下格作为门的锚点 */
export function scanGates(s) {
  const out = [];
  for (let x = 0; x < s.W; x += 1) {
    let y = 0;
    while (y < s.H) {
      if (at(s, x, y) === CELL.GATE) {
        const base = y;
        let h = 0;
        while (y < s.H && at(s, x, y) === CELL.GATE) { h += 1; y += 1; }
        if (h === 3) out.push({ x, y: base });
      } else y += 1;
    }
  }
  return out;
}

function updateGates(s, events) {
  const gates = scanGates(s);
  if (!gates.length) return false;
  const plates = scanPlates(s);
  const down = plates.map((p) => (s.px === p.x && s.py === p.y + 1) || at(s, p.x, p.y + 1) === CELL.CRATE);
  const anyDown = down.some(Boolean);
  let opened = false;

  if (anyDown && !s.latched) {
    for (const gate of gates) {
      for (let k = 0; k < 3; k += 1) {
        if (at(s, gate.x, gate.y + k) === CELL.GATE) { put(s, gate.x, gate.y + k, CELL.EMPTY); opened = true; }
      }
    }
    if (s.mech.gateLatch) s.latched = true;
  } else if (!anyDown && !s.latched) {
    for (const gate of gates) {
      const cells = [0, 1, 2].map((k) => ({ x: gate.x, y: gate.y + k }));
      const free = cells.every((c) => at(s, c.x, c.y) === CELL.EMPTY && !(s.px === c.x && s.py === c.y));
      if (free) for (const c of cells) put(s, c.x, c.y, CELL.GATE);
    }
  }
  if (opened) events.push({ t: "gate", open: true, plates: plates.map((p, i) => ({ ...p, down: down[i] })) });
  else if (plates.length) events.push({ t: "gate", open: anyDown, plates: plates.map((p, i) => ({ ...p, down: down[i] })) });
  return opened;
}

// ---------------------------------------------------------------- 宝石
function settleGem(s, gem, events) {
  if (gem.st !== "out") return;
  let x = gem.x;
  let y = gem.y;
  while (at(s, x, y - 1) === CELL.EMPTY) {
    y -= 1;
    if (y < 0) { gem.st = "lost"; events.push({ t: "gemLost", x: gem.x, y: gem.y }); return; }
  }
  if (s.mech.gemSlide && Math.abs(gem.dir) === 1) {
    const nx = x + gem.dir;
    if (nx >= 0 && nx < s.W && at(s, nx, y) === CELL.EMPTY) x = nx;
  }
  if (x !== gem.x || y !== gem.y) events.push({ t: "gemDrop", x, y, fx: gem.x, fy: gem.y });
  gem.x = x;
  gem.y = y;
}

function releaseGems(s, x, y, events) {
  for (const gem of s.gems) {
    if (gem.st === "hidden" && gem.x === x && gem.y === y) {
      gem.st = "out";
      settleGem(s, gem, events);
    }
  }
}

function takeGems(s, events) {
  for (const gem of s.gems) {
    if (gem.st === "out" && gem.x === s.px && gem.y === s.py) {
      gem.st = "taken";
      events.push({ t: "take", x: gem.x, y: gem.y });
    }
  }
}

// ---------------------------------------------------------------- 重力
function settleCrates(s, events) {
  for (let y = 1; y < s.H; y += 1) {
    for (let x = 0; x < s.W; x += 1) {
      if (at(s, x, y) !== CELL.CRATE || at(s, x, y - 1) !== CELL.EMPTY) continue;
      let ty = y;
      while (ty > 0 && at(s, x, ty - 1) === CELL.EMPTY) ty -= 1;
      put(s, x, y, CELL.EMPTY);
      put(s, x, ty, CELL.CRATE);
      events.push({ t: "crateFall", x, y, ty });
    }
  }
}

/** 砸掉一格数字（blast 用），返回是否触发过关 */
function damage(s, x, y, events) {
  const v = at(s, x, y);
  if (v <= 0) return;
  const n = v - 1;
  if (n === 0) {
    put(s, x, y, CELL.EMPTY);
    events.push({ t: "vanish", x, y });
    releaseGems(s, x, y, events);
  } else {
    put(s, x, y, n);
    events.push({ t: "hit", x, y, v: n });
  }
}

function blast(s, x, y, events) {
  const queue = [[x, y]];
  const seen = new Set();
  while (queue.length) {
    const [bx, by] = queue.shift();
    const key = `${bx},${by}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const hits = [];
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
      const nx = bx + dx;
      const ny = by + dy;
      const v = at(s, nx, ny);
      if (v === CELL.BOMB) { put(s, nx, ny, CELL.EMPTY); queue.push([nx, ny]); hits.push({ x: nx, y: ny, v: 0 }); }
      else if (v === CELL.ROCK) { put(s, nx, ny, CELL.EMPTY); hits.push({ x: nx, y: ny, v: 0 }); }
      else if (v > 0) { damage(s, nx, ny, events); hits.push({ x: nx, y: ny, v: at(s, nx, ny) }); }
    }
    events.push({ t: "blast", x: bx, y: by, hits });
  }
}

// ---------------------------------------------------------------- 落地
function land(s, events) {
  // 最后一块碎掉时也要把人落稳：直接 return "win" 会让角色悬在半空，
  // 结算面板一弹出来就看见自己飘在格子上方。这里补一段「只落不判负」的下坠。
  const dropForWin = () => {
    while (s.py > 0 && at(s, s.px, s.py - 1) === CELL.EMPTY) {
      s.py -= 1;
      events.push({ t: "fall", x: s.px, y: s.py });
    }
    return "win";
  };
  for (let guard = 0; guard < 64; guard += 1) {
    let fell = false;
    while (at(s, s.px, s.py - 1) === CELL.EMPTY) {
      s.py -= 1;
      fell = true;
      if (s.py < 0) {
        events.push({ t: "sink", x: s.px, y: s.py });
        return "fell";
      }
    }
    if (fell) events.push({ t: "fall", x: s.px, y: s.py });

    const under = at(s, s.px, s.py - 1);
    if (under === CELL.BOMB) {
      put(s, s.px, s.py - 1, CELL.EMPTY);
      blast(s, s.px, s.py - 1, events);
      settleCrates(s, events);
      if (isWin(s)) return dropForWin();
      continue;
    }
    if (under > 0) {
      const n = under - 1;
      if (n === 0 && s.mech.cascade) {
        put(s, s.px, s.py - 1, CELL.EMPTY);
        events.push({ t: "vanish", x: s.px, y: s.py - 1 });
        releaseGems(s, s.px, s.py - 1, events);
        if (isWin(s)) return dropForWin();
        continue;                       // 碎掉后继续坠，落到下面那块
      }
      if (n === 0) {
        put(s, s.px, s.py - 1, CELL.CRACK);
        events.push({ t: "last", x: s.px, y: s.py - 1 });
      } else {
        put(s, s.px, s.py - 1, n);
        events.push({ t: "hit", x: s.px, y: s.py - 1, v: n });
      }
    }
    return isWin(s) ? "win" : "ok";
  }
  return "ok";
}

function mirror(s, events) {
  const g = s.g.slice();
  for (let y = 0; y < s.H; y += 1) {
    for (let x = 0; x < s.W; x += 1) {
      g[(s.H - 1 - y) * s.W + x] = s.g[y * s.W + x];
    }
  }
  s.g = g;
  s.py = s.H - 1 - s.py;
  s.latched = false;
  events.push({ t: "flip", px: s.px, py: s.py });
}

// ---------------------------------------------------------------- 一步
/**
 * @param {object} state 当前状态（不会被修改）
 * @param {number} dir -1 左 / +1 右
 * @returns {{state:object, events:Array, result:'ok'|'win'|'fell'|'blocked'}}
 */
export function step(state, dir) {
  const s = cloneState(state);
  const events = [];
  const mech = s.mech;
  const tx = s.px + dir;

  if (at(s, tx, s.py) === CELL.EMPTY && at(s, tx, s.py - 1) === CELL.GATE) {
    events.push({ t: "nudge", dir });
    return { state, events, result: "blocked" };
  }

  if (at(s, tx, s.py) === CELL.EMPTY) {
    s.px = tx;
    s.moves += 1;
    events.push({ t: "walk", x: s.px, y: s.py, dir });
  } else if (at(s, tx, s.py) === CELL.CRATE && mech.pushEnabled && tx + dir >= 0 && tx + dir < s.W
             && at(s, tx + dir, s.py) === CELL.EMPTY) {
    const cx = tx;
    let cy = s.py;
    put(s, s.py * s.W + tx, CELL.EMPTY);
    while (cy > 0 && at(s, cx + dir, cy - 1) === CELL.EMPTY) cy -= 1;
    put(s, cx + dir, cy, CELL.CRATE);
    events.push({ t: "push", x: cx, y: s.py, tx: cx + dir, ty: cy, dir });
    s.px = tx;
    s.moves += 1;
    events.push({ t: "walk", x: s.px, y: s.py, dir });
  } else if (at(s, tx, s.py) !== CELL.GATE && s.py + 1 < s.H
             && at(s, tx, s.py + 1) === CELL.EMPTY && at(s, s.px, s.py + 1) === CELL.EMPTY) {
    s.px = tx;
    s.py += 1;
    s.moves += 1;
    events.push({ t: "hop", x: s.px, y: s.py, dir });
  } else {
    events.push({ t: "nudge", dir });
    return { state, events, result: "blocked" };
  }

  // 上一回合砸碎、这一回合才消失的残块
  for (let i = 0; i < s.g.length; i += 1) {
    if (s.g[i] === CELL.CRACK) {
      const x = i % s.W;
      const y = Math.floor(i / s.W);
      s.g[i] = CELL.EMPTY;
      events.push({ t: "vanish", x, y });
      releaseGems(s, x, y, events);
    }
  }

  if (s.px < 0 || s.px >= s.W) {
    events.push({ t: "sink", x: s.px, y: -1 });
    return { state: s, events, result: "fell" };
  }

  let result = land(s, events);

  // 弹簧：按输入方向弹射
  for (let i = 0; result === "ok" && i < mech.springLoops && at(s, s.px, s.py - 1) === CELL.SPRING; i += 1) {
    let up = 0;
    while (up < mech.springUp && s.py + up + 1 < s.H && at(s, s.px, s.py + up + 1) === CELL.EMPTY) up += 1;
    let across = 0;
    while (up > 0 && across < mech.springAcross && at(s, s.px + dir * (across + 1), s.py + up) === CELL.EMPTY) across += 1;
    if (up === 0 || across === 0) break;
    const sx = s.px;
    const sy = s.py - 1;
    s.px += dir * across;
    s.py += up;
    if (s.px < 0 || s.px >= s.W) { events.push({ t: "sink", x: s.px, y: -1 }); return { state: s, events, result: "fell" }; }
    events.push({ t: "bounce", x: s.px, y: s.py, sx, sy, dir });
    result = land(s, events);
  }

  // 翻转砖：整盘上下镜像后重新落地
  for (let i = 0; result === "ok" && i < mech.flipLoops && at(s, s.px, s.py - 1) === CELL.FLIP; i += 1) {
    mirror(s, events);
    settleCrates(s, events);
    result = land(s, events);
  }

  // 门 / 板：打开后可以掉下去，再结算一次
  for (let i = 0; result === "ok" && i < 4; i += 1) {
    const opened = updateGates(s, events);
    if (!opened) break;
    settleCrates(s, events);
    result = land(s, events);
  }
  if (result === "ok" || result === "win") settleCrates(s, events);

  takeGems(s, events);
  if (result === "ok" && isWin(s)) result = "win";
  return { state: s, events, result };
}

// ---------------------------------------------------------------- 求解器
/** 状态压成字符串键（数字 → 单字符），用于 BFS 去重 */
function keyOf(s) {
  let out = "";
  for (let i = 0; i < s.g.length; i += 1) out += cellChar(s.g[i]);
  return `${out}|${s.px},${s.py}${s.latched ? "*" : ""}`;
}

/**
 * BFS 找一条能赢的走法。
 * @returns {{solvable:boolean, dir:number, depth:number, capped:boolean}}
 */
export function solve(state, { maxNodes = 60000 } = {}) {
  if (isWin(state)) return { solvable: true, dir: 0, depth: 0, capped: false };
  const seen = new Set([keyOf(state)]);
  let frontier = [{ s: state, first: 0 }];
  let depth = 0;
  let nodes = 1;
  while (frontier.length && depth < 400) {
    const next = [];
    for (const node of frontier) {
      for (const dir of [-1, 1]) {
        const r = step(node.s, dir);
        if (r.result === "blocked" || r.result === "fell") continue;
        const k = keyOf(r.state);
        if (seen.has(k)) continue;
        const first = node.first || dir;
        if (r.result === "win") return { solvable: true, dir: first, depth: depth + 1, capped: false };
        seen.add(k);
        nodes += 1;
        if (nodes > maxNodes) return { solvable: true, dir: first, depth: depth + 1, capped: true };
        next.push({ s: r.state, first });
      }
    }
    frontier = next;
    depth += 1;
  }
  return { solvable: false, dir: 0, depth, capped: false };
}
