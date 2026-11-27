// src/game/mechanics.js — 机制注册表（关卡表里的 newMechanic 必须在这里有实现入口）
//
// 每个钩子做两件事：
//   ① 把「本关真正要用到的可调参数」写进 mech（弹簧横距、门是否锁定、翻转次数上限…）；
//   ② 打开对应的表现开关（渲染层/UI 依据这些开关决定要不要画门的铰链、宝石的光、翻转载荷…）。
// 玩法能不能成立由关卡地图本身决定（grid.js 只认格子），钩子是「这一关允许什么」的显式声明。
import { DEFAULT_MECH } from "./grid.js";

const set = (mech, patch) => Object.assign(mech, patch);

export const MECHANIC_HOOKS = {
  hop_basic: (m) => set(m, { canHop: true }),
  cascade_crack: (m) => set(m, { cascade: true }),
  stack_three: (m) => set(m, { maxStack: 3 }),
  ledge_walk: (m) => set(m, { ledgeDrop: true }),
  pit_descent: (m) => set(m, { shaft: true }),
  crate_push: (m) => set(m, { pushEnabled: true }),
  crate_drop: (m) => set(m, { crateFalls: true }),
  crate_step: (m) => set(m, { crateClimb: true }),
  two_lane: (m) => set(m, { twoLane: true }),
  spring_launch: (m) => set(m, { springUp: 2, springAcross: 1 }),
  spring_reach: (m) => set(m, { springAcross: 2 }),
  spring_chain: (m) => set(m, { springLoops: 3, springAcross: 2 }),
  spring_aim: (m) => set(m, { springAcross: 2, springPrecise: true }),
  plate_gate: (m) => set(m, { gates: true }),
  gate_latch: (m) => set(m, { gates: true, gateLatch: true }),
  gate_crate: (m) => set(m, { gates: true, plateCrate: true }),
  gate_hole: (m) => set(m, { gates: true, gateLatch: true, gateHole: true }),
  gate_double: (m) => set(m, { gates: true, gatePairs: 2 }),
  flip_first: (m) => set(m, { flipLoops: 1 }),
  flip_twice: (m) => set(m, { flipLoops: 3 }),
  bomb_pop: (m) => set(m, { bombEnabled: true, bombRadius: 1 }),
  bomb_chain: (m) => set(m, { bombEnabled: true, bombChain: true }),
  rock_break: (m) => set(m, { bombEnabled: true, rockBreak: true }),
  bomb_lift: (m) => set(m, { bombEnabled: true, bombRadius: 1, bombChain: true }),
  gem_first: (m) => set(m, { gemEnabled: true }),
  gem_slide: (m) => set(m, { gemEnabled: true, gemSlide: true }),
  flip_spring: (m) => set(m, { flipLoops: 2, springAcross: 2 }),
  flip_crate: (m) => set(m, { flipLoops: 2, pushEnabled: true }),
  flip_gate: (m) => set(m, { flipLoops: 2, gates: true }),
  shaft_down: (m) => set(m, { shaft: true, cascade: true }),
  two_towers: (m) => set(m, { twoLane: true, springAcross: 2 }),
  spring_gate: (m) => set(m, { gates: true, springAcross: 2 }),
  gate_ladder: (m) => set(m, { gates: true, gatePairs: 2, gateLatch: true }),
  bomb_gate: (m) => set(m, { bombEnabled: true, gates: true }),
  reverse_run: (m) => set(m, { reverse: true }),
  long_chain: (m) => set(m, { cascade: true, longChain: true }),
  tight_clear: (m) => set(m, { maxStack: 3, tight: true }),
  spring_flip_bomb: (m) => set(m, { springAcross: 2, flipLoops: 2, bombEnabled: true }),
  precision: (m) => set(m, { gateLatch: true, springAcross: 2, precise: true }),
  pit_bridge: (m) => set(m, { pushEnabled: true, maxStack: 3, crateFalls: true }),
  spring_drop: (m) => set(m, { springAcross: 2, springUp: 2, ledgeDrop: true }),
  cascade_gem: (m) => set(m, { cascade: true, gemEnabled: true, gemSlide: true }),
  bomb_plug: (m) => set(m, { bombEnabled: true, rockBreak: true }),
  grand_finale: (m) => set(m, { gateLatch: true, springAcross: 2, flipLoops: 2, bombEnabled: true, gemSlide: true })
};

/** 按关卡表组装本关的机制参数（未声明的键保留默认值） */
export function mechFor(level) {
  const mech = Object.assign({}, DEFAULT_MECH);
  const list = [...(level.reuse || []), level.newMechanic].filter(Boolean);
  for (const name of list) {
    const hook = MECHANIC_HOOKS[name];
    if (hook) hook(mech, level);
  }
  return mech;
}
