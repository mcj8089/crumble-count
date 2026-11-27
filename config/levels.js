// config/levels.js — 40 关关卡表（8 章，每章 teach → practice → twist → test → breath；第 40 关为终局考核）
//
// 关卡节奏（写关卡前先读这一段）：
//   第 1 章 学会走：走、踩碎后继续落、3 要踩三下、走边缘、掉洞。
//   第 2 章 搬东西：箱子填空、箱子下台、箱子当台阶、两层楼、弹簧初现。
//   第 3 章 弹与门：横弹、连弹、弹上一排 3、压力板+门、常开门。
//   第 4 章 箱子与门：箱子压板、门下是洞、双门、翻转、天花板。
//   第 5 章 爆破：炸药桶、连锁、硬砖、一炸两边、宝石。
//   第 6 章 翻转组合：宝石滑行、弹簧+翻转、箱子+翻转、门+翻转、竖井。
//   第 7 章 组合加压：双坑双箱、弹上去再走下来、串门、炸开堵口、反向清场。
//   第 8 章 终局：一坠穿两层、步步踩实、塌方带宝石、先上后下、全能关。
//
// 字符表（与 src/game/grid.js 的 parseLevel 一一对应）：
//   .  空          #  墙          P  玩家（有且只有一个）
//   1-5 数字堆（踩一次 −1，到 0 就碎）  c  箱子（可推、会掉）
//   s  弹簧（按输入方向弹射）            x  硬砖（只能被炸碎）
//   _  压力板（站上去 / 压箱子）         |  门（3 格高，字符本身是最下格）
//   f  翻转砖（整盘上下镜像）            *  炸药桶（落地就爆）
// gems: [x, y, dir, ...] 平铺三元组（y = 0 是最后一行）。宝石藏在该格的数字堆里，
//       块碎后才掉出来，落地后沿 dir 滑一格，走过去自动收。
//
// 字段（check_delivery 逐条校验）：
//   chapter 1-8 / pacing teach|practice|twist|test|breath / twistAxis count|speed|time|resource|space|rule|enemy|info
//   family move|aim|timing|build|resource|space|enemy|rule / twist 本关与上关的差异 / fun 一句话体验假设
//   第 1 关必须 tutorial:true + failSafe:true + teachSteps:3 + pacing:"teach" + 难度全局最低。
//
// 摆图口径（tools/verify_levels.mjs 逐关验可解，改图后必须重跑）：
//   ① 想站上去的块，正上方那格必须是空的；人两侧被墙夹住时跳不起来（1 格高走廊只能走）；
//   ② 门占 3 格，字符上方两格必须是空的；
//   ③ 数字块不会掉：要么坐在实心格上，要么整块嵌在同一行的墙里（"塞子"写法，踩空就掉下去）；
//   ④ 弹簧要落在另一个弹簧上，两段都要留 2 格竖直净空 + 2 格横向净空；
//   ⑤ 翻转关要留天花板（y 最大那行是墙），否则翻过来人直接从底边掉出去。
export const LEVELS = [
  {
    id: 1, chapter: 1, pacing: "teach", failSafe: true, teachSteps: 3,
    tutorial: true, newMechanic: "hop_basic", focus: "基础操作：走过去撞块，人就跳上去踩一脚", difficulty: 0.15, par: 4, hintKey: "hint.l1", reuse: [],
    verb: "hop_basic", family: "move", twistAxis: "space", twist: "空场只有两块，走到块前跳上去就完事", fun: "第一次把一块数字踩没",
    map: [
          "........",
          "#......#",
          "#P.1.1.#",
          "########"]
  },
  {
    id: 2, chapter: 1, pacing: "practice", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "cascade_crack", focus: "块碎了不会停：人会继续往下掉，落到下一块上", difficulty: 0.24, par: 9, hintKey: "hint.l2", reuse: ["hop_basic"],
    verb: "cascade_crack", family: "space", twistAxis: "rule", twist: "块碎之后人不会停，继续落到下面那一块上", fun: "踩空的瞬间以为要掉下去，结果砸中下一块",
    map: [
          "..........",
          "#........#",
          "#P.......#",
          "####1#####",
          "#........#",
          "#.......2#",
          "##########"]
  },
  {
    id: 3, chapter: 1, pacing: "twist", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "stack_three", focus: "写着 3 的块要踩三下：踩完走开再跳回来", difficulty: 0.33, par: 8, hintKey: "hint.l3", reuse: ["hop_basic", "cascade_crack"],
    verb: "stack_three", family: "resource", twistAxis: "count", twist: "同一块要踩三下，必须走开再跳回来", fun: "数着 3 变 2 变 1 的那三下",
    map: [
          "........",
          "#......#",
          "#P.3.1.#",
          "########"]
  },
  {
    id: 4, chapter: 1, pacing: "test", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "ledge_walk", focus: "走出台面边缘也是移动，掉下去能砸到下面的块", difficulty: 0.42, par: 7, hintKey: "hint.l4", reuse: ["hop_basic", "cascade_crack", "stack_three"],
    verb: "ledge_walk", family: "move", twistAxis: "space", twist: "台面会走到头，从边缘掉到下层继续清", fun: "主动走空一步反而更快",
    map: [
          "...........",
          "#.........#",
          "#P.1......#",
          "#####.....#",
          "#.....1.1.#",
          "###########"]
  },
  {
    id: 5, chapter: 1, pacing: "breath", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "pit_descent", focus: "地板上有个洞：从洞口下去，这一走就不回头了", difficulty: 0.51, par: 10, hintKey: "hint.l5", reuse: ["hop_basic", "cascade_crack", "stack_three", "ledge_walk"],
    verb: "pit_descent", family: "rule", twistAxis: "rule", twist: "地板上的洞是单向的，下去就回不来", fun: "顺着洞口一落到底的失重感",
    map: [
          "..........",
          "#P.......#",
          "####.#####",
          "#........#",
          "#..1.2.1.#",
          "##########"]
  },
  {
    id: 6, chapter: 2, pacing: "teach", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "crate_push", focus: "撞箱子它就走一格。把它推进缺口，路就接上了", difficulty: 0.60, par: 7, hintKey: "hint.l6", reuse: ["hop_basic", "cascade_crack", "stack_three", "ledge_walk", "pit_descent"],
    verb: "crate_push", family: "build", twistAxis: "space", twist: "箱子推进地板缺口，断掉的路重新接上", fun: "箱子刚好卡进缺口的那一声",
    map: [
          "...........",
          "#.........#",
          "#P.c....1.#",
          "#####.#####",
          "###########"]
  },
  {
    id: 7, chapter: 2, pacing: "practice", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "crate_drop", focus: "把箱子从台子上推下去，它在底下就是一级台阶", difficulty: 0.69, par: 9, hintKey: "hint.l7", reuse: ["crate_push", "ledge_walk", "hop_basic", "cascade_crack", "stack_three"],
    verb: "crate_drop", family: "space", twistAxis: "space", twist: "箱子从台上被推下去，落到下层当台阶", fun: "看着箱子先掉下去，自己再踩它",
    map: [
          "............",
          "#..........#",
          "#P.1c......#",
          "#######.####",
          "#..........#",
          "#.......2..#",
          "#.......#..#",
          "############"]
  },
  {
    id: 8, chapter: 2, pacing: "twist", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "crate_step", focus: "两格高的台子，只能踩箱子再上去", difficulty: 0.78, par: 8, hintKey: "hint.l8", reuse: ["crate_push", "hop_basic", "cascade_crack", "stack_three", "ledge_walk"],
    verb: "crate_step", family: "build", twistAxis: "rule", twist: "两格高的台子，只能先踩箱子再上去", fun: "用箱子搭出一级不存在的楼梯",
    map: [
          "............",
          "#..........#",
          "#........1.#",
          "#......###.#",
          "#P.c...###.#",
          "############"]
  },
  {
    id: 9, chapter: 2, pacing: "test", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "two_lane", focus: "上下两层都有块：先清上层，再走到底掉下去", difficulty: 0.87, par: 17, hintKey: "hint.l9", reuse: ["ledge_walk", "stack_three", "hop_basic", "cascade_crack", "pit_descent"],
    verb: "two_lane", family: "space", twistAxis: "space", twist: "上下两层都有块，走到底只能从另一头下去", fun: "先在上层把顺序算好再跳",
    map: [
          "...........",
          "#.........#",
          "#P...2....#",
          "#########.#",
          "#.........#",
          "#...2..1..#",
          "###########"]
  },
  {
    id: 10, chapter: 2, pacing: "breath", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "spring_launch", focus: "弹簧朝你按的方向弹：上 2 格、横 1 格", difficulty: 0.96, par: 8, hintKey: "hint.l10", reuse: ["hop_basic", "cascade_crack", "stack_three", "ledge_walk", "pit_descent"],
    verb: "spring_launch", family: "aim", twistAxis: "count", twist: "弹簧第一次出现：上 2 格、横 1 格", fun: "被弹簧顶起来的那一下",
    map: [
          "...........",
          "...........",
          "#....1....#",
          "###.#####..",
          "#.........#",
          "#P.s....1.#",
          "###########"]
  },
  {
    id: 11, chapter: 3, pacing: "teach", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "spring_reach", focus: "这个弹簧横距 2 格，专门够对面的台子", difficulty: 1.05, par: 8, hintKey: "hint.l11", reuse: ["spring_launch", "ledge_walk", "hop_basic", "cascade_crack", "stack_three"],
    verb: "spring_reach", family: "space", twistAxis: "space", twist: "弹簧横距加到 2 格，正好跨过缺口", fun: "跨过缺口的那一小段飞行",
    map: [
          ".............",
          ".............",
          ".............",
          "#.....1..2..#",
          "###..#######.",
          "#...........#",
          "#P.s........#",
          "#############"]
  },
  {
    id: 12, chapter: 3, pacing: "practice", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "spring_chain", focus: "第一下落在另一个弹簧上，连弹两次才上得去", difficulty: 1.14, par: 8, hintKey: "hint.l12", reuse: ["spring_launch", "spring_reach", "hop_basic", "cascade_crack", "stack_three"],
    verb: "spring_chain", family: "aim", twistAxis: "rule", twist: "第一下的落点是另一个弹簧，连弹两次", fun: "被两个弹簧接力扔上去",
    map: [
          ".............",
          ".............",
          "#........1.2#",
          "####...#####.",
          "#...........#",
          "###..s#######",
          "#...........#",
          "#P.s........#",
          "#############"]
  },
  {
    id: 13, chapter: 3, pacing: "twist", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "spring_aim", focus: "弹上台面还没完，台面上那块 3 要连着踩三下", difficulty: 1.23, par: 16, hintKey: "hint.l13", reuse: ["spring_reach", "stack_three", "hop_basic", "cascade_crack", "ledge_walk"],
    verb: "spring_aim", family: "resource", twistAxis: "count", twist: "弹上台面是一排 3，要来回踩很多趟", fun: "在窄台面上来回跑着数数",
    map: [
          ".............",
          "#...........#",
          "#...........#",
          "#...........#",
          "###.#3##2####",
          "#...........#",
          "#P.s........#",
          "#############"]
  },
  {
    id: 14, chapter: 3, pacing: "test", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "plate_gate", focus: "跳上压力板，门才开；门后面还有块", difficulty: 1.32, par: 7, hintKey: "hint.l14", reuse: ["hop_basic", "cascade_crack", "stack_three", "ledge_walk", "pit_descent"],
    verb: "plate_gate", family: "rule", twistAxis: "rule", twist: "压力板和门：站上板门才开", fun: "门在身后关上的那一刻",
    map: [
          "............",
          "#..........#",
          "#..........#",
          "#P.._|..1..#",
          "############",
          "############"]
  },
  {
    id: 15, chapter: 3, pacing: "breath", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "gate_latch", focus: "这种门压过一次就一直开着，可以慢慢走过去", difficulty: 1.41, par: 11, hintKey: "hint.l15", reuse: ["plate_gate", "ledge_walk", "hop_basic", "cascade_crack", "stack_three"],
    verb: "gate_latch", family: "space", twistAxis: "time", twist: "这种门压过一次就常开，可以慢慢走", fun: "不用赶时间地穿过一道门",
    map: [
          ".............",
          "#...........#",
          "#P.._.|...2.#",
          "#############",
          "#############",
          "#############"]
  },
  {
    id: 16, chapter: 4, pacing: "teach", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "gate_crate", focus: "箱子能压住板子，人就可以腾出手走过去", difficulty: 1.50, par: 16, hintKey: "hint.l16", reuse: ["plate_gate", "crate_push", "hop_basic", "cascade_crack", "stack_three"],
    verb: "gate_crate", family: "build", twistAxis: "space", twist: "箱子压住板子，人腾出手去穿门", fun: "让箱子替自己站着",
    map: [
          "..............",
          "#............#",
          "#............#",
          "#.._..c.P.|.2#",
          "##############",
          "##############"]
  },
  {
    id: 17, chapter: 4, pacing: "practice", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "gate_hole", focus: "门开之后不是路，是门后面那个洞", difficulty: 1.59, par: 10, hintKey: "hint.l17", reuse: ["gate_latch", "two_lane", "hop_basic", "cascade_crack", "stack_three"],
    verb: "gate_hole", family: "rule", twistAxis: "rule", twist: "门后面不是路，是往下掉的洞", fun: "开门不是为了走过去，是为了掉下去",
    map: [
          "..............",
          "#............#",
          "#............#",
          "#P.._.|......#",
          "#######.######",
          "#............#",
          "#....1..1....#",
          "##############"]
  },
  {
    id: 18, chapter: 4, pacing: "twist", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "gate_double", focus: "两道门两把板，得一道一道开", difficulty: 1.68, par: 13, hintKey: "hint.l18", reuse: ["plate_gate", "gate_latch", "hop_basic", "cascade_crack", "stack_three"],
    verb: "gate_double", family: "resource", twistAxis: "count", twist: "两道门两把板，一次只能开一道", fun: "记住哪块板对应哪扇门",
    map: [
          "..............",
          "#............#",
          "#............#",
          "#P._.|.._.|.2#",
          "##############",
          "##############"]
  },
  {
    id: 19, chapter: 4, pacing: "test", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "flip_first", focus: "踩上翻转砖，整个房间上下颠倒", difficulty: 1.77, par: 15, hintKey: "hint.l19", reuse: ["hop_basic", "ledge_walk", "cascade_crack", "stack_three", "pit_descent"],
    verb: "flip_first", family: "rule", twistAxis: "rule", twist: "踩上翻转砖，整个房间上下颠倒", fun: "天和地互换的一瞬间",
    map: [
          "##############",
          "#..1......1..#",
          "#............#",
          "#............#",
          "#............#",
          "#P....f......#",
          "##############"]
  },
  {
    id: 20, chapter: 4, pacing: "breath", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "flip_twice", focus: "贴在天花板上的块，翻过来才够得着", difficulty: 1.86, par: 31, hintKey: "hint.l20", reuse: ["flip_first", "two_lane", "hop_basic", "cascade_crack", "stack_three"],
    verb: "flip_twice", family: "space", twistAxis: "space", twist: "贴在天花板上的块，翻过来才够得着", fun: "等翻转把块送到脚边",
    map: [
          "##############",
          "#...3.....2..#",
          "#............#",
          "#............#",
          "#............#",
          "#............#",
          "#P..2.....3.f#",
          "##############"]
  },
  {
    id: 21, chapter: 5, pacing: "teach", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "bomb_pop", focus: "炸药桶落地就爆，把左右两格各敲掉一层", difficulty: 1.95, par: 11, hintKey: "hint.l21", reuse: ["hop_basic", "cascade_crack", "stack_three", "ledge_walk", "pit_descent"],
    verb: "bomb_pop", family: "rule", twistAxis: "count", twist: "炸药桶落地就爆，左右各削掉一层", fun: "一炸两块的连锁",
    map: [
          "............",
          "#P.........#",
          "#####.######",
          "#..........#",
          "#..........#",
          "#...3*3....#",
          "############"]
  },
  {
    id: 22, chapter: 5, pacing: "practice", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "bomb_chain", focus: "炸药桶能把旁边的炸药桶也点着", difficulty: 2.04, par: 10, hintKey: "hint.l22", reuse: ["bomb_pop", "hop_basic", "cascade_crack", "stack_three", "ledge_walk"],
    verb: "bomb_chain", family: "resource", twistAxis: "rule", twist: "一个桶能把旁边的桶也点着", fun: "看着引线一路烧过去",
    map: [
          ".............",
          "#...........#",
          "#...........#",
          "#...........#",
          "#P.1**33....#",
          "#############"]
  },
  {
    id: 23, chapter: 5, pacing: "twist", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "rock_break", focus: "硬砖踩不碎，只有爆炸能拆掉", difficulty: 2.13, par: 11, hintKey: "hint.l23", reuse: ["bomb_pop", "hop_basic", "cascade_crack", "stack_three", "ledge_walk"],
    verb: "rock_break", family: "rule", twistAxis: "rule", twist: "硬砖踩不碎，只有爆炸能拆", fun: "脚踩没用，只能炸",
    map: [
          "............",
          "#..........#",
          "#....x.....#",
          "#....x.....#",
          "#P.*x...2.1#",
          "############"]
  },
  {
    id: 24, chapter: 5, pacing: "test", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "bomb_lift", focus: "一次爆炸能同时削掉两边的块，别用在空的旁边", difficulty: 2.22, par: 14, hintKey: "hint.l24", reuse: ["bomb_pop", "bomb_chain", "hop_basic", "cascade_crack", "stack_three"],
    verb: "bomb_lift", family: "resource", twistAxis: "count", twist: "一次爆炸把左右两边一起削薄", fun: "算好落点让一炸顶两次",
    map: [
          "............",
          "#P.........#",
          "###.########",
          "#..........#",
          "#..........#",
          "#.3*3..1.1.#",
          "############"]
  },
  {
    id: 25, chapter: 5, pacing: "breath", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "gem_first", focus: "宝石藏在块里，块碎了才掉出来", difficulty: 2.31, par: 7, hintKey: "hint.l25", reuse: ["hop_basic", "cascade_crack", "stack_three", "ledge_walk", "pit_descent"],
    verb: "gem_first", family: "space", twistAxis: "space", twist: "宝石藏在块里，块碎才掉出来", fun: "块碎时宝石滚出来的那一下",
    map: [
          "...........",
          "#.........#",
          "#.........#",
          "#.........#",
          "#P.12.1...#",
          "###########"],
    gems: [3, 1, 1]
  },
  {
    id: 26, chapter: 6, pacing: "teach", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "gem_slide", focus: "宝石落地还会滑一格，走过去才算收下", difficulty: 2.40, par: 9, hintKey: "hint.l26", reuse: ["gem_first", "cascade_crack", "hop_basic", "stack_three", "ledge_walk"],
    verb: "gem_slide", family: "rule", twistAxis: "space", twist: "宝石落地还会滑一格，要走过去收", fun: "追着宝石多走一步",
    map: [
          "............",
          "#..........#",
          "#P.........#",
          "#####1######",
          "#..........#",
          "#.......2..#",
          "############"],
    gems: [5, 3, 1]
  },
  {
    id: 27, chapter: 6, pacing: "practice", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "flip_spring", focus: "弹簧送上台面，台面尽头是翻转砖：天花板上的块会掉下来", difficulty: 2.49, par: 12, hintKey: "hint.l27", reuse: ["flip_first", "spring_launch", "hop_basic", "cascade_crack", "stack_three"],
    verb: "flip_spring", family: "aim", twistAxis: "rule", twist: "弹簧送上高台，台子尽头是翻转砖", fun: "先被弹上去，再把世界翻过来",
    map: [
          "#############",
          "#..1.....1..#",
          "#...........#",
          "#...........#",
          "#...........#",
          "#...#####f..#",
          "#...........#",
          "#P.s........#",
          "#############"]
  },
  {
    id: 28, chapter: 6, pacing: "twist", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "flip_crate", focus: "翻转的时候箱子也跟着颠倒，落点会变", difficulty: 2.58, par: 14, hintKey: "hint.l28", reuse: ["flip_first", "crate_push", "hop_basic", "cascade_crack", "stack_three"],
    verb: "flip_crate", family: "build", twistAxis: "space", twist: "翻转的时候箱子跟着颠倒", fun: "猜箱子会落在哪",
    map: [
          "#############",
          "#..2........#",
          "#...........#",
          "#...........#",
          "#...........#",
          "#P.c....f...#",
          "#############"]
  },
  {
    id: 29, chapter: 6, pacing: "test", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "flip_gate", focus: "先开门下楼，再从下面翻回来", difficulty: 2.67, par: 18, hintKey: "hint.l29", reuse: ["flip_first", "gate_latch", "hop_basic", "cascade_crack", "stack_three"],
    verb: "flip_gate", family: "rule", twistAxis: "rule", twist: "先开门下楼，再从下面把房间翻回来", fun: "同一条路走两遍，第二遍是倒着的",
    map: [
          "#############",
          "#....1.....2#",
          "#...........#",
          "#...........#",
          "#P._.|...f..#",
          "#############",
          "#...........#",
          "#############"]
  },
  {
    id: 30, chapter: 6, pacing: "breath", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "shaft_down", focus: "一格宽的竖井，一路直落到底", difficulty: 2.76, par: 14, hintKey: "hint.l30", reuse: ["pit_descent", "cascade_crack", "hop_basic", "stack_three", "ledge_walk"],
    verb: "shaft_down", family: "space", twistAxis: "space", twist: "一格宽的竖井，一路直落到底", fun: "直落三层只踩碎一块",
    map: [
          "############",
          "#P.........#",
          "#####.######",
          "#..........#",
          "######.#####",
          "#..........#",
          "#..1..1..1.#",
          "############"]
  },
  {
    id: 31, chapter: 7, pacing: "teach", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "pit_bridge", focus: "两个缺口两个箱子，一个也别浪费", difficulty: 2.85, par: 15, hintKey: "hint.l31", reuse: ["crate_drop", "stack_three", "hop_basic", "cascade_crack", "ledge_walk"],
    verb: "pit_bridge", family: "build", twistAxis: "count", twist: "两个缺口两个箱子，一个都不能浪费", fun: "每一次推都要算好",
    map: [
          "..............",
          "#............#",
          "#P.c...c...13#",
          "####.#####.###",
          "##############"]
  },
  {
    id: 32, chapter: 7, pacing: "practice", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "spring_drop", focus: "弹上高台清完，再从台子另一头走下去", difficulty: 2.94, par: 12, hintKey: "hint.l32", reuse: ["spring_reach", "two_lane", "hop_basic", "cascade_crack", "stack_three"],
    verb: "spring_drop", family: "aim", twistAxis: "space", twist: "弹上高台清完，再从台子另一头走下去", fun: "从高台边缘走出去",
    map: [
          "............",
          "............",
          "#....1..2..#",
          "###.######..",
          "#..........#",
          "#P.s....1..#",
          "############"]
  },
  {
    id: 33, chapter: 7, pacing: "twist", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "gate_ladder", focus: "两道门串在一条路上，顺序错了就过不去", difficulty: 3.03, par: 13, hintKey: "hint.l33", reuse: ["plate_gate", "gate_latch", "hop_basic", "cascade_crack", "stack_three"],
    verb: "gate_ladder", family: "rule", twistAxis: "rule", twist: "两道门串在一条路上，顺序错了就过不去", fun: "顺序错了就得整关重来",
    map: [
          "..............",
          "#............#",
          "#............#",
          "#P._.|._.|..2#",
          "##############",
          "##############"]
  },
  {
    id: 34, chapter: 7, pacing: "test", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "bomb_plug", focus: "硬砖堵死了唯一的落口，只能炸开", difficulty: 3.12, par: 11, hintKey: "hint.l34", reuse: ["bomb_pop", "ledge_walk", "hop_basic", "cascade_crack", "stack_three"],
    verb: "bomb_plug", family: "space", twistAxis: "count", twist: "硬砖堵死唯一的落口，只能炸开", fun: "炸开唯一的出口",
    map: [
          "############",
          "#P.........#",
          "#####.######",
          "#..........#",
          "#..........#",
          "#...*x.....#",
          "#..........#",
          "#..1.1..1..#",
          "############"]
  },
  {
    id: 35, chapter: 7, pacing: "breath", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "reverse_run", focus: "这次从最右边出发，一路往左清", difficulty: 3.21, par: 18, hintKey: "hint.l35", reuse: ["hop_basic", "stack_three", "cascade_crack", "ledge_walk", "pit_descent"],
    verb: "reverse_run", family: "move", twistAxis: "space", twist: "从最右边出发，一路往左清", fun: "反过来走一遍熟悉的地形",
    map: [
          "............",
          "#..........#",
          "#..1...3..P#",
          "##.#########",
          "#..........#",
          "#..1....1..#",
          "############"]
  },
  {
    id: 36, chapter: 8, pacing: "teach", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "long_chain", focus: "一次坠落能连着砸穿两层地板", difficulty: 3.30, par: 12, hintKey: "hint.l36", reuse: ["cascade_crack", "two_lane", "hop_basic", "stack_three", "ledge_walk"],
    verb: "long_chain", family: "space", twistAxis: "space", twist: "一次坠落连着砸穿两层地板", fun: "一次落地碎两块",
    map: [
          "#############",
          "#P..........#",
          "#####.#######",
          "#...........#",
          "#####1#######",
          "#...........#",
          "#...........#",
          "#..1..1..1..#",
          "#############"]
  },
  {
    id: 37, chapter: 8, pacing: "practice", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "tight_clear", focus: "每一步都要踩在块上，空走一步就赢不了", difficulty: 3.39, par: 30, hintKey: "hint.l37", reuse: ["stack_three", "two_lane", "hop_basic", "cascade_crack", "ledge_walk"],
    verb: "tight_clear", family: "resource", twistAxis: "count", twist: "四个 3，每一步都要踩在块上", fun: "一步都不能浪费的紧张",
    map: [
          "............",
          "#P.3...3...#",
          "#########.##",
          "#..........#",
          "#..3....3..#",
          "############"]
  },
  {
    id: 38, chapter: 8, pacing: "twist", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "cascade_gem", focus: "塌下去的那一下顺便把宝石带下来", difficulty: 3.48, par: 11, hintKey: "hint.l38", reuse: ["cascade_crack", "gem_slide", "hop_basic", "stack_three", "ledge_walk"],
    verb: "cascade_gem", family: "space", twistAxis: "rule", twist: "塌方会把宝石一起带下去", fun: "追着塌下去的宝石跑",
    map: [
          "############",
          "#P.........#",
          "#####.######",
          "#..........#",
          "#####1######",
          "#..........#",
          "#..........#",
          "#..1....1..#",
          "############"],
    gems: [5, 4, 1]
  },
  {
    id: 39, chapter: 8, pacing: "test", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "precision", focus: "先把上层清干净再下楼，掉早了就回不去", difficulty: 3.57, par: 24, hintKey: "hint.l39", reuse: ["tight_clear", "ledge_walk", "hop_basic", "cascade_crack", "stack_three"],
    verb: "precision", family: "resource", twistAxis: "time", twist: "先清上层再下楼，掉早了就回不去", fun: "先看清楚再决定从哪掉",
    map: [
          ".............",
          "#P..2...3...#",
          "##########.##",
          "#...........#",
          "#..2....1...#",
          "#############"]
  },
  {
    id: 40, chapter: 8, pacing: "test", failSafe: false, teachSteps: 0,
    tutorial: false, newMechanic: "grand_finale", focus: "终局：推箱压板、开门、下楼、拿宝石，一次做完", difficulty: 3.66, par: 19, hintKey: "hint.l40", reuse: ["gate_latch", "crate_push", "gem_slide", "bomb_pop", "hop_basic"],
    verb: "grand_finale", family: "build", twistAxis: "rule", twist: "终局：推箱、压板、开门、拿宝石一次做完", fun: "把学过的串成一条线",
    map: [
          "##############",
          "#............#",
          "#............#",
          "#....c.P2|...#",
          "##_#######.###",
          "#............#",
          "#............#",
          "#...1.1.1....#",
          "##############"],
    gems: [4, 1, 1]
  }
];
