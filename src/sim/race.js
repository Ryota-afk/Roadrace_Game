// レースシミュレーション（コース生成・ティック計算・着順確定）。Phase 2で分離。
import { AB_KEYS, TYPES } from "../data/abilities.js";
import { SEG_LABEL } from "../data/course.js";
import { condMul, hasAbility, hasGoldAbility, mulberry, strHash } from "../core/core.js";

export const PART_SLOTS = ["frame", "tire", "wheels", "nutrition"];

export const PARTS = {
  fr_sprint: { slot: "frame", tier: 1, label: "スプリントフレーム", ab: { sprint: 6 }, price: 28 },
  fr_aero:   { slot: "frame", tier: 1, label: "エアロロードフレーム", ab: { flat: 6 }, price: 28 },
  fr_light:  { slot: "frame", tier: 1, label: "超軽量クライムフレーム", ab: { climb: 6 }, price: 28 },
  ti_endure: { slot: "tire", tier: 1, label: "耐久タイヤ", ab: { stamina: 6 }, price: 22 },
  ti_tt:     { slot: "tire", tier: 1, label: "TTタイヤ", ab: { solo: 6 }, price: 22 },
  ti_grip:   { slot: "tire", tier: 1, label: "グリップタイヤ", ab: { sprint: 4, climb: 3 }, price: 22 },
  wh_light:  { slot: "wheels", tier: 1, label: "軽量ホイール", ab: { climb: 5 }, price: 24 },
  wh_aero:   { slot: "wheels", tier: 1, label: "エアロホイール", ab: { flat: 5 }, price: 24 },
  nu_gel:    { slot: "nutrition", tier: 1, label: "エナジージェル", ab: { stamina: 5 }, price: 18 },
  nu_bar:    { slot: "nutrition", tier: 1, label: "カフェインジェル", ab: { sprint: 3, stamina: 3 }, price: 18 },
  fr_sprint2:{ slot: "frame", tier: 2, label: "スプリントフレームPro", ab: { sprint: 10 }, price: 48 },
  fr_aero2:  { slot: "frame", tier: 2, label: "エアロフレームPro", ab: { flat: 10 }, price: 48 },
  fr_light2: { slot: "frame", tier: 2, label: "クライムフレームPro", ab: { climb: 10 }, price: 48 },
  ti_race:   { slot: "tire", tier: 2, label: "レーシングタイヤ", ab: { sprint: 5, solo: 5 }, price: 40 },
  wh_race:   { slot: "wheels", tier: 2, label: "レーシングホイール", ab: { flat: 5, climb: 5 }, price: 44 },
  nu_pro:    { slot: "nutrition", tier: 2, label: "プロ仕様補給食", ab: { stamina: 8 }, price: 36 },
  fr_ult:    { slot: "frame", tier: 3, label: "モノコックUltimate", ab: { flat: 4, climb: 4, sprint: 4, stamina: 4, solo: 4 }, price: 90 },
  ti_ult:    { slot: "tire", tier: 3, label: "レーシングプロトUltimate", ab: { sprint: 4, solo: 8 }, price: 70 },
  wh_ult:    { slot: "wheels", tier: 3, label: "エアロクライムUltimate", ab: { flat: 6, climb: 6 }, price: 80 },
  nu_ult:    { slot: "nutrition", tier: 3, label: "アルティメット補給食", ab: { stamina: 6, sprint: 4 }, price: 60 },
};

export function rollWeather(rng) {
  const r = rng();
  if (r < 0.14) return "rain";
  if (r < 0.24) return "heat";
  return "clear";
}

export function rainMul(r, weather) {
  if (weather !== "rain") return 1;
  return hasAbility(r, "rain_sp") ? 0.97 : 0.93;
}

// v34 (C-2): モニュメント（古典）適性。各モニュメント（石畳/丘陵/山岳）にはそれぞれ専用の
// 古典適性があり、対応する古典のときだけ全能力が底上げされる（脚質別適性）。銅で約+5%、金特で約+9%。
// monument が偽（通常レース・シーズンモード）や、対応特能を持たなければ 1.0 で無影響。
export const MONUMENT_ABILITY = { pave: "pave_sp", ardennes: "ardennes_sp", autumn: "autumn_sp" };
export function monumentMul(r, monument) {
  const ab = MONUMENT_ABILITY[monument];
  if (!ab || !hasAbility(r, ab)) return 1;
  return hasGoldAbility(r, ab) ? 1.09 : 1.05;
}

export function effAbilities(r, equip, itemBoost, grade, weather, monument) {
  const fatPen = 1 - Math.max(0, (r.fatigue || 0) - 50) * 0.003;
  const cm = condMul(r.cond || 3);
  // v29: ピーキング（フォーム）。狙って仕上げた選手はレース当日に能力が底上げされる（±約17%）。
  // マイライフ専用の概念で、フォーム未設定の選手（AI・シーズン）は50=1.0で無影響
  const formMul = 1 + ((r.form ?? 50) - 50) / 300;
  const e = {};
  AB_KEYS.forEach(k => { e[k] = r[k]; });
  if (r.parts) {
    PART_SLOTS.forEach(slot => {
      const pid = r.parts[slot];
      if (pid && PARTS[pid]) Object.entries(PARTS[pid].ab).forEach(([k, v]) => { e[k] += v; });
    });
  }
  // v28: 大舞台適性。big=★3で+6%、nervous(悪特性)=★3で-5%
  // v29: メンタルも★3で能力に反映（±約8%）。特性big/nervousと重ねる
  const mental = r.mental ?? 50;
  const mentalBig = grade === 3 ? 1 + (mental - 50) / 600 : 1;
  const bigMul = (grade === 3 ? (hasAbility(r, "big") ? 1.06 : hasAbility(r, "nervous") ? 0.95 : 1) : 1) * mentalBig;
  const wMul = rainMul(r, weather);
  const mMul = monumentMul(r, monument); // v34(C-2): 古典適性（石畳巧者）
  AB_KEYS.forEach(k => { e[k] = e[k] * cm * fatPen * bigMul * wMul * formMul * mMul; });
  // v28: オールラウンダーは全能力を控えめに底上げ（脚質を選ばない万能型）
  if (hasAbility(r, "allrounder_sp")) AB_KEYS.forEach(k => { e[k] += hasGoldAbility(r, "allrounder_sp") ? 4 : 2; });
  // v31.2: 配合限定特能。系統の申し子＝全能力+3、覇道の血脈＝全能力+2かつスタミナ+3
  if (hasAbility(r, "sireline")) AB_KEYS.forEach(k => { e[k] += 3; });
  if (hasAbility(r, "dynasty")) { AB_KEYS.forEach(k => { e[k] += 2; }); e.stamina += 3; }
  // v29: 体格（パワーウェイト）。軽いほど登坂有利・重いほど平坦/独走有利
  const build = r.build ?? 50;
  e.climb *= 1 + (50 - build) / 300;
  e.flat *= 1 + (build - 50) / 350;
  e.solo *= 1 + (build - 50) / 450;
  e.flat *= (1 + equip.frame * 0.06) * (itemBoost.suit ? 1.15 : 1);
  e.climb *= (1 + equip.wheels * 0.06) * (itemBoost.wheel ? 1.15 : 1);
  // v29バグ修正: 万一いずれかの能力値が欠損（旧セーブ等でundefined）していると
  // NaNがシミュレーション全体（finishTime等）に伝播し、最終的にレース描画がクラッシュして
  // 画面が真っ暗になる恐れがあった。非有限値は安全な既定値(50)に丸めて必ず有限にする
  AB_KEYS.forEach(k => { e[k] = Number.isFinite(e[k]) ? Math.min(135, e[k]) : 50; });
  e.type = r.type; e.abilities = r.abilities; e.goldAbilities = r.goldAbilities;
  // v29: 副ステータスをエントラントにも持たせ、tick計算・最終区間で参照する
  e.accel = r.accel ?? 50; e.mental = mental; e.build = build;
  return e;
}

export function typeAffinityBonus(type, segType) {
  return (TYPES[type]?.affinity?.[segType]) || 0;
}

export function generateCourse(raceMeta, dayTag) {
  // v13: グランツールなど、日ごとに異なるコース性格を持つステージレース用に
  // stageTmpls（日別テンプレート配列）があればそちらを優先して使う
  const stageMatch = dayTag && /^day(\d+)$/.exec(dayTag);
  const tmpl = (raceMeta.stageTmpls && stageMatch) ? raceMeta.stageTmpls[Number(stageMatch[1]) - 1] || raceMeta.tmpl : raceMeta.tmpl;
  // v8: dayTagを混ぜることで、2日間ステージレースの各日で別コースになるようにする（同一レースIDの使い回し対策）
  const crng = mulberry(strHash(raceMeta.id + raceMeta.name + (dayTag || "")));
  const LEN = 300 + crng() * 120;
  const amp1 = 20 + crng() * 26, f1 = 2.2 + crng() * 2.2, ph1 = crng() * Math.PI * 2;
  const amp2 = 4 + crng() * 9, f2 = 8 + crng() * 8, ph2 = crng() * Math.PI * 2;
  const steepness = 0.75 + crng() * 0.6; // 0.75〜1.35：この山/丘がきついかどうか
  // v13: 周回コース（laps指定時、1周分のsegsをそのままlaps回繰り返して全体コースを構成する）
  const laps = tmpl.laps || 1;
  const lapSegDefs = laps > 1 ? Array.from({ length: laps }, () => tmpl.segs).flat() : tmpl.segs;
  const segs = lapSegDefs.map(([type, base, dist]) => ({ type, base, dist, label: SEG_LABEL[type] }));
  // v12: 天候・横風エシュロン。平坦・丘陵区間の一部にランダムで横風フラグを立てる
  segs.forEach(s => {
    s.wind = (s.type === "flat" || s.type === "hill") && crng() < 0.28;
    if (s.wind) s.windDir = crng() < 0.5 ? 1 : -1;
  });
  const totalW = segs.reduce((s, x) => s + x.dist, 0);
  const cumFrac = []; let acc = 0;
  segs.forEach(s => { acc += s.dist / totalW; cumFrac.push(acc); });
  const elevTarget = { flat: 0, hill: 9, climb: 22, sprint: 0, mtn: 26, tt: 0 };
  const boundElev = [0];
  segs.forEach(s => boundElev.push(elevTarget[s.type] * steepness));
  const yAt = (frac) => {
    let j = 0;
    for (; j < segs.length; j++) { if (frac <= cumFrac[j] + 1e-6) break; }
    j = Math.min(j, segs.length - 1);
    const prev = j === 0 ? 0 : cumFrac[j - 1];
    const local = (frac - prev) / (cumFrac[j] - prev);
    return boundElev[j] + (boundElev[j + 1] - boundElev[j]) * local;
  };
  const segTypeAtFrac = (frac) => {
    for (let j = 0; j < segs.length; j++) { if (frac <= cumFrac[j] + 1e-6) return { type: segs[j].type, idx: j, wind: !!segs[j].wind, windDir: segs[j].windDir || 0 }; }
    const last = segs[segs.length - 1];
    return { type: last.type, idx: segs.length - 1, wind: !!last.wind, windDir: last.windDir || 0 };
  };
  // 標高プロファイル（グラフ表示用・30点）
  const elevationProfile = [];
  for (let i = 0; i <= 30; i++) { const f = i / 30; elevationProfile.push({ frac: f, elev: yAt(f) }); }
  let totalElevationGain = 0;
  for (let i = 1; i < elevationProfile.length; i++) { const d = elevationProfile[i].elev - elevationProfile[i - 1].elev; if (d > 0) totalElevationGain += d; }
  const climbCount = segs.filter(s => ["climb", "mtn"].includes(s.type)).length;
  const raceDifficultyRating = Math.round((totalElevationGain * 1.2 + climbCount * 15 + LEN * 0.15) * steepness);
  return {
    length: LEN, segs, cumFrac, steepness, finalIdx: segs.length - 1,
    posAtFrac: (frac) => frac * LEN,
    fracAtPos: (pos) => Math.max(0, Math.min(1, pos / LEN)),
    segTypeAt: (pos) => segTypeAtFrac(pos / LEN),
    yAt, elevationProfile, totalElevationGain, climbCount, raceDifficultyRating,
    amp1, f1, ph1, amp2, f2, ph2,
    laps, lapAtFrac: (frac) => Math.min(laps, Math.floor(Math.max(0, Math.min(1, frac)) * laps) + 1),
  };
}

export function climbWeightFor(segType, steepness) {
  const base = { flat: 0, hill: 0.4, climb: 0.85, mtn: 0.9, sprint: 0, tt: 0 }[segType] || 0;
  return Math.min(1, base * steepness);
}

export function terrainSpeedMul(segType, steepness) {
  const base = { flat: 1, hill: 0.85, climb: 0.65, mtn: 0.6, sprint: 1, tt: 0.95 }[segType] ?? 1;
  if (segType === "climb" || segType === "mtn") return Math.max(0.35, base - (steepness - 1) * 0.3);
  return base;
}

export function segmentAbility(segType, e, steepness) {
  let ab;
  if (segType === "sprint") ab = e.sprint;
  else if (segType === "tt") ab = e.solo * 0.6 + e.flat * 0.4;
  else if (segType === "mtn") ab = e.climb * 0.7 + e.sprint * 0.3;
  else { const w = climbWeightFor(segType, steepness); ab = e.flat * (1 - w) + e.climb * w; }
  ab += typeAffinityBonus(e.type, segType);
  // v15: 特殊能力による区間タイプ別の能力補正（金特なら効果2倍）
  if (hasAbility(e, "mount") && ["climb", "mtn"].includes(segType)) ab += hasGoldAbility(e, "mount") ? 8 : 4;
  if (hasAbility(e, "puncheur") && segType === "hill") ab += hasGoldAbility(e, "puncheur") ? 8 : 4;
  if (hasAbility(e, "flatlander") && segType === "flat") ab += hasGoldAbility(e, "flatlander") ? 8 : 4;
  if (hasAbility(e, "sprinter_sp") && segType === "sprint") ab += hasGoldAbility(e, "sprinter_sp") ? 8 : 4;
  if (hasAbility(e, "soloist") && segType === "tt") ab += hasGoldAbility(e, "soloist") ? 8 : 4;
  if (hasAbility(e, "closer") && (segType === "sprint" || segType === "mtn")) ab += hasGoldAbility(e, "closer") ? 8 : 4;
  // v31.2: 配合限定「二刀流」。丘陵・山岳・スプリントの各区間で+5（登坂型とスプリント型の血を併せ持つ証）
  if (hasAbility(e, "hybrid") && ["hill", "climb", "mtn", "sprint"].includes(segType)) ab += 5;
  return ab;
}

export const TICK_SEC = 1;
const GROUP_GAP_DIST = 0.22;      // これ以内の位置差なら同一グループ
const ROTATION_PERIOD_TICKS = 20; // 20秒ごとに先頭交代
// v12: AIチームごとの隠しの戦略スタイル（プレイヤーの事前作戦とは独立）。
// aggressive=push相当・conservative=hold相当のローテーションペースになる
export const AI_STYLES = ["aggressive", "balanced", "conservative"];

export const DRAIN_K = 0.85;
// v12バグ修正: エネルギーは減る一方で回復する仕組みがなく、下限も無かったため、
// 長いレースでは選手のエネルギーが際限なく（-1000を超えるほど）マイナスに膨らみ続けていた。
// energyPenaltyMul()はenergy<=-90あたりで既に速度低下が頭打ち（0.55倍）になるため、
// それより下はゲーム的な意味を持たない数値の暴走に過ぎない。下限を設けて無意味な
// 桁あふれを防ぐ（energyPenaltyMulの頭打ち地点より十分下なので、既存の速度・結果には影響しない）
const ENERGY_FLOOR = -100;
const BASE_TICK_DIST = 0.26;      // 能力70・エネルギー満タン時の基準移動量/tick
const ATTACK_TICKS = 25;          // アタック持続（25秒）
// v14.10: 逃げ要員（breakaway）ロールの選手が実際に飛び出すための持続時間。
// エースの早期発射（ATTACK_TICKS）よりやや長めにし、集団から確実に離れる間合いを作る
const BREAKAWAY_ATTACK_TICKS = 30;
const MAX_TICKS = 2500;

function effortCost(mode, segType, steepness) {
  if (mode === "pull") return 1.0;
  if (mode === "draft") return { flat: 0.5, tt: 0.5, sprint: 0.5, hill: 0.7 }[segType] ?? (0.85 - (steepness - 1) * 0.1);
  if (mode === "solo") return 1.3;
  return 1.6; // attack
}

export function energyPenaltyMul(energy) {
  if (energy > 20) return 1;
  if (energy > 0) return 0.85 + (energy / 20) * 0.15;
  // v10: 下限0.35→0.55（深いエネルギー枯渇時の失速緩和。千切れ選手の遅れ過大バグ対策）
  return Math.max(0.55, 1 + (energy / 100) * 0.5);
}

export function tickSpeedFactor(en, segType, mode, steepness) {
  let ab = segmentAbility(segType, en, steepness);
  // v15: 展開依存の特殊能力（逃げ屋・献身のアシスト）は、能力算出時点ではmodeを
  // 知らないsegmentAbilityではなくここで加算する
  if (hasAbility(en, "escape") && mode === "attack") ab += hasGoldAbility(en, "escape") ? 8 : 4;
  if (hasAbility(en, "domestique") && mode === "pull") ab += hasGoldAbility(en, "domestique") ? 6 : 3;
  // v29: 加速力はアタック（飛び出し・ギャップ埋め）の鋭さに効く
  if (mode === "attack") ab += ((en.accel ?? 50) - 50) * 0.2;
  let f = 1 + (ab - 70) / 260;
  if (mode === "attack") f *= 1.15;
  f *= energyPenaltyMul(en.energy);
  // v8: 微小なゆらぎ（±3%）。純粋な決定論だと同一条件のレースが毎回ほぼ同じ結果になってしまうため
  f *= 1 + (Math.random() - 0.5) * 0.06;
  return Math.max(0.15, f);
}

export function tickDistance(en, segType, mode, steepness) {
  return BASE_TICK_DIST * tickSpeedFactor(en, segType, mode, steepness) * terrainSpeedMul(segType, steepness);
}

export function roleTerrainMismatchMul(role, segType) {
  if (role === "flat" && (segType === "climb" || segType === "mtn")) return 1.6;
  if (role === "mountain" && (segType === "flat" || segType === "sprint")) return 1.3;
  return 1;
}

export function groupShelterMul(n) {
  return Math.max(0.55, 1 - Math.min(1, (n - 1) / 14) * 0.45);
}

export const ENERGY_REGEN_BASE = 0.5; // 集団後方（牽引順が回ってこない位置）での基礎回復量/tick
// v35(バランス): 勝負を賭けた逃げ（committedBreak）が単独で先頭に立っている間だけ、
// 選抜地形で消耗が軽減される（brk係数）。登坂・山岳で最も効き（集団が組織的に追えず、
// 登りでは集団のドラフト優位も縮む）、丘で中程度、平坦・スプリントでは無効＝吸収される。
// 集団に吸収されて draft/pull へ戻れば solo/attack ではなくなり自動的に無効化される。
function energyDrain(en, mode, segType, steepness) {
  // v28: 「無尽蔵のエンジン」はレース中のエネルギー消耗が軽い（金特で更に軽減）
  const engineMul = hasAbility(en, "engine") ? (hasGoldAbility(en, "engine") ? 0.80 : 0.88) : 1;
  const brk = en.committedBreak && (mode === "solo" || mode === "attack")
    ? ({ mtn: 0.55, climb: 0.6, hill: 0.78, flat: 1, sprint: 1, tt: 1 }[segType] ?? 1) : 1;
  return TICK_SEC * (1 - en.stamina / 150) * DRAIN_K * effortCost(mode, segType, steepness) * roleTerrainMismatchMul(en.role, segType) * engineMul * brk;
}

export function canPull(en, segType) {
  if (en.isAce) return false;
  if (en.energy <= 0) return false;
  if (en.role === "breakaway") return true;
  if (en.role === "lead") return true;
  if (en.role === "sub") return true;
  if (en.role === "mountain") return ["climb", "mtn"].includes(segType);
  if (en.role === "flat") return ["flat", "hill"].includes(segType);
  return false;
}

export function assignAIRoles(members, squadN) {
  const roles = {};
  members.forEach((r, i) => {
    if (i === 0 || squadN < 3) { roles[r.id] = "lead"; return; }
    const roll = Math.random();
    // スプリントがその選手の武器か弱点かを、他能力のピークとの差で測る。
    // sprintGap=0 → スプリントが最強（集団ゴール向き・ほぼ逃げない）
    // sprintGap大 → スプリントが弱点（集団ゴールで不利・早逃げに出やすい）
    const peak = Math.max(r.flat, r.climb, r.sprint, r.stamina, r.solo);
    const sprintGap = peak - r.sprint;
    const breakawayChance = Math.min(0.65, 0.06 + sprintGap * 0.022);
    if (roll < breakawayChance) { roles[r.id] = "breakaway"; return; }
    // 逃げないなら地形・脚質に応じた集団内の役割（ゴールスプリントに残る）
    if (r.type === "CLM") roles[r.id] = "mountain";
    else if (r.type === "SPR" || r.type === "RUL") roles[r.id] = "flat";
    else roles[r.id] = "sub";
  });
  if (squadN >= 3) {
    const hasLead = members.slice(1).some(r => roles[r.id] === "lead" || roles[r.id] === "sub" || roles[r.id] === "flat" || roles[r.id] === "mountain");
    if (!hasLead && members.length > 1) roles[members[1].id] = "lead";
  }
  return roles;
}

export function simulateTicks(course, riders, fromTick, directive, noGroup) {
  if (fromTick === 0) {
    riders.forEach(en => {
      en.pos = 0; en.energy = 100; en.finished = false; en.finishTime = null;
      // v12: エース早期発射は無線指示の廃止に伴い出走前の作戦選択になったため、
      // レース開始（fromTick===0）の時点から適用する
      // v14.10: 逃げ要員ロールは牽引適性が上がるだけで実際に飛び出す処理が無く、
      // 「逃げてくれない」不具合になっていた。ロールを持つ選手はレース開始と同時に
      // 自動でアタック（attackモード）に入り、実際に集団から離れる動きをするようにする
      en.attackLeft = (directive.aceEarly && en.isAce) ? ATTACK_TICKS
        : (en.role === "breakaway" ? BREAKAWAY_ATTACK_TICKS : 0);
      // v35(バランス): シーズンのエース早期発射＝「勝負を賭けた逃げ」。単独で飛び出したエースは
      // 選抜地形（登坂・丘）では集団が組織的に追えず（登りでは集団のドラフト優位も縮む）、
      // ギャップ維持の消耗が軽くなる（committedBreak）。平坦・スプリントでは恩恵ゼロ＝吸収される。
      en.committedBreak = !!(directive.aceEarly && en.isAce);
      en.posHist = []; en.energyHist = []; en.modeHist = []; en.groupHist = []; en.slotHist = [];
    });
  } else {
    riders.forEach(en => {
      const idx = Math.min(fromTick - 1, en.posHist.length - 1);
      en.pos = en.posHist[idx]; en.energy = en.energyHist[idx];
      en.posHist = en.posHist.slice(0, fromTick); en.energyHist = en.energyHist.slice(0, fromTick);
      en.modeHist = en.modeHist.slice(0, fromTick); en.groupHist = en.groupHist.slice(0, fromTick);
      en.slotHist = en.slotHist.slice(0, fromTick);
      if (directive.aceEarly && en.isAce) { en.attackLeft = ATTACK_TICKS; en.committedBreak = true; }
    });
  }
  let tick = fromTick;
  while (tick < MAX_TICKS) {
    const active = riders.filter(en => !en.finished);
    if (active.length === 0) break;
    // 1. グループ判定（位置の近さのみ。吸収・千切れは自然発生）
    if (noGroup) {
      active.forEach((en, i) => { en.groupId = en.id; });
    } else {
      active.sort((a, b) => b.pos - a.pos);
      let gid = 0;
      active.forEach((en, i) => {
        if (i === 0) { en.groupId = gid; return; }
        if (active[i - 1].pos - en.pos <= GROUP_GAP_DIST) en.groupId = active[i - 1].groupId;
        else { gid++; en.groupId = gid; }
      });
    }
    // 2. モード決定（pull/draft/solo/attack）：ロール・ローテーション周期・無線指示から
    const groups = {};
    active.forEach(en => { (groups[en.groupId] = groups[en.groupId] || []).push(en); });
    Object.values(groups).forEach(members => {
      if (members.length === 1) {
        const en = members[0];
        en.mode = en.attackLeft > 0 ? "attack" : "solo";
        en.slot = 0;
        if (en.attackLeft > 0) en.attackLeft--;
        return;
      }
      const segType = course.segTypeAt(members[0].pos).type;
      let eligible = members.filter(en => canPull(en, segType));
      let rotSpan = ROTATION_PERIOD_TICKS;
      // v12: 自チームが関与するグループはプレイヤーの事前作戦（directive.chaseMode）に従う。
      // AIチームのみのグループは、そのグループの多数派チームが持つ隠しスタイル
      // （aiStyle）に応じたペースになる（プレイヤーの作戦とは独立）
      if (members.some(en => en.team === "PLAYER")) {
        if (directive.chaseMode === "push") rotSpan = Math.max(2, ROTATION_PERIOD_TICKS - 2);
        if (directive.chaseMode === "hold") rotSpan = ROTATION_PERIOD_TICKS + 3;
      } else {
        const styleCounts = {};
        members.forEach(en => { if (en.aiStyle) styleCounts[en.aiStyle] = (styleCounts[en.aiStyle] || 0) + 1; });
        const domStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (domStyle === "aggressive") rotSpan = Math.max(2, ROTATION_PERIOD_TICKS - 2);
        if (domStyle === "conservative") rotSpan = ROTATION_PERIOD_TICKS + 3;
      }
      const rotIdx = Math.floor(tick / rotSpan);
      let puller = eligible.length ? eligible[rotIdx % eligible.length] : null;
      // v12バグ修正: canPullにエネルギー切れの判定を追加したことで、集団全員が消耗しきっている
      // 極端な状況では牽引適性者が誰もいなくなり得る。誰も牽引しないと集団全体がそのtickで
      // 完全に停止してしまうため、非常時のフォールバックとして（エースを除く）最もエネルギーが
      // 残っている選手に牽引を任せる（消耗はするが、集団が立ち止まるよりは自然）
      if (!puller) {
        const fallbackPool = members.filter(en => !en.isAce);
        if (fallbackPool.length > 0) puller = fallbackPool.reduce((best, en) => (en.energy > best.energy ? en : best), fallbackPool[0]);
      }
      // v10: 見た目専用のローテーション待ち順（0=牽引中、1,2,...=次に牽引予定、
      // ローテーションに参加しない選手は集団後方扱い）。finishTime等の実データには無関係
      members.forEach(en => {
        if (en.attackLeft > 0) { en.mode = "attack"; en.slot = 0; en.attackLeft--; return; }
        en.mode = (puller && en === puller) ? "pull" : "draft";
        const eIdx = eligible.indexOf(en);
        en.slot = eIdx === -1 ? eligible.length : ((eIdx - rotIdx) % eligible.length + eligible.length) % eligible.length;
      });
    });
    // 3. 移動：先にpull/solo/attackを確定、その後draftが「ついていけるか」を判定
    active.forEach(en => {
      if (en.mode === "draft") return;
      const segType = course.segTypeAt(en.pos).type;
      let dist = tickDistance(en, segType, en.mode, course.steepness);
      // v12バグ修正: 牽引中の選手が自チームのエースと同じ集団にいる場合でも、
      // 牽引ペースは牽引者自身の最大出力（自然な走力）で決まっていたため、
      // 脚力の強いアシストがエース本人が付いていけるペースより速く牽引してしまい、
      // 「アシストがエースを置いていく」形でエースだけ千切れてしまうことがあった。
      // エースが同じ集団にいる時は、エースが牽引した場合の到達距離を上限にして
      // ペースを合わせる（エースを守るための牽引、という前提に合わせる）
      if (en.mode === "pull") {
        const ace = active.find(o => o.team === en.team && o.isAce && o.groupId === en.groupId);
        if (ace) dist = Math.min(dist, tickDistance(ace, segType, "pull", course.steepness));
      }
      en.lastOwnDist = dist;
      en.pos = Math.min(course.length, en.pos + dist);
      en.energy = Math.max(ENERGY_FLOOR, en.energy - energyDrain(en, en.mode, segType, course.steepness));
    });
    Object.values(groups).forEach(members => {
      const puller = members.find(en => en.mode === "pull");
      if (!puller) return;
      members.filter(en => en.mode === "draft").forEach(en => {
        const segInfo = course.segTypeAt(en.pos);
        const segType = segInfo.type;
        // v12: 横風区間は道幅の関係で全員がシェルターを得られず、千切れやすくなる
        // （集団についていける基準を厳しくし、ドラフトのコストも上げる）
        const windActive = !!segInfo.wind;
        const groupDist = puller.lastOwnDist;
        const ownCapable = tickDistance(en, segType, "pull", course.steepness);
        let dist;
        if (ownCapable >= groupDist * (windActive ? 0.80 : 0.9)) {
          // v12バグ修正: ゴールスプリント区間で集団のドラフト勢が全員groupDistと完全に
          // 同一の距離だけ進む仕様だと、同じ集団の選手が毎ティック寸分違わず横並びになり、
          // ゴールタイムが不自然なほど大量に完全一致してしまう（差が均質すぎる問題）。
          // スプリント区間に限り、各選手自身のスプリント適性（ownCapable/groupDistの比）と
          // 小さな運要素を反映した微差を加え、集団のままでも着差にばらつきが出るようにする
          const isFinalSeg = segInfo.idx === course.finalIdx;
          if (isFinalSeg) {
            // v28: 最終区間（カメラが切り替わる勝負どころ）は、そこまで生き残った選手同士の
            // ゴール前の掛け合いをスプリント能力で決める。山頂フィニッシュなどスプリント以外で
            // 終わるコースでも、地形適性（ownCapable＝登坂等）で集団に残れるかは従来通り決まり、
            // 残った選手の中ではスプリント力の finishing kick が着差になる。
            // 登坂力が無ければ最終区間の手前（climb区間）で千切れて集団に残れない
            const terrainEdge = ownCapable / groupDist - 1;
            // sprint区間はownCapableが既にスプリントなので二重計上を避け係数を半分に
            const sprintEdge = (segType === "sprint" ? 0.5 : 1) * (en.sprint - 70) / 260;
            const edgeMul = segType === "sprint" ? 1.7 : 0.9;
            // v28: 「豪脚のラストスパート」は最終区間の追い込みが上乗せされる
            const finishKick = hasAbility(en, "finisher") ? (hasGoldAbility(en, "finisher") ? 0.06 : 0.035) : 0;
            // v29: 加速力=飛び出しの鋭さ、メンタル=勝負どころの粘りも最終区間の着差に効く
            const accelKick = ((en.accel ?? 50) - 50) / 900;
            const mentalKick = ((en.mental ?? 50) - 50) / 1500;
            const luck = (riderHash01(en.id, tick + 4409) - 0.5) * 0.035;
            dist = groupDist * Math.max(0.85, Math.min(1.19, 1 + terrainEdge * edgeMul + sprintEdge + finishKick + accelKick + mentalKick + luck));
          } else if (segType === "sprint") {
            // 周回途中などの非最終スプリント区間は従来の弱めの着差
            const abilityEdge = ownCapable / groupDist - 1;
            const luck = (riderHash01(en.id, tick + 4409) - 0.5) * 0.05;
            dist = groupDist * Math.max(0.94, Math.min(1.06, 1 + abilityEdge * 0.6 + luck));
          } else {
            dist = groupDist;
          }
        }
        else { dist = ownCapable; en.mode = "solo"; }
        en.pos = Math.min(course.length, en.pos + dist);
        // v12: 集団の人数が多いほどドラフト勢の消耗が緩み（風除け効果）、ローテーションの
        // 牽引順が回ってこない集団後方の位置にいるほど少しずつスタミナが回復する。
        // 千切れて単独走になった選手（en.mode==="solo"）はこの恩恵を受けない
        const sheltered = en.mode === "draft";
        const shelterMul = sheltered ? groupShelterMul(members.length) : 1;
        const backRatio = sheltered ? Math.min(1, (en.slot || 0) / Math.max(1, members.length - 1)) : 0;
        const regen = sheltered ? ENERGY_REGEN_BASE * backRatio * (windActive ? 0.5 : 1) : 0;
        // v15: 横風耐性を持つ選手は横風区間でのドラフト消耗ペナルティが軽減される（1.25→1.1）
        const windPenalty = windActive && en.mode === "draft" ? (hasAbility(en, "crosswind_sp") ? 1.1 : 1.25) : 1;
        // v17: チームケミストリー（squad構築時にchemMulを付与。未設定なら1で無効果）
        const drain = energyDrain(en, en.mode === "solo" ? "solo" : "draft", segType, course.steepness) * windPenalty * shelterMul * (en.chemMul || 1);
        en.energy = Math.min(100, Math.max(ENERGY_FLOOR, en.energy - drain + regen));
      });
    });
    // 4. 履歴記録・ゴール判定
    active.forEach(en => {
      en.posHist[tick] = en.pos; en.energyHist[tick] = en.energy;
      en.modeHist[tick] = en.mode; en.groupHist[tick] = en.groupId; en.slotHist[tick] = en.slot || 0;
      if (en.pos >= course.length && !en.finished) { en.finished = true; en.finishTime = tick * TICK_SEC; }
    });
    tick++;
  }
  // MAX_TICKS到達時点で未ゴールの選手はペースから残り距離を推定して確定
  riders.forEach(en => {
    if (!en.finished) {
      const lastDist = Math.max(0.2, en.lastOwnDist || 0.3);
      const remain = course.length - en.pos;
      en.finishTime = MAX_TICKS * TICK_SEC + (remain / lastDist) * TICK_SEC;
    }
  });
  return tick;
}

// v35(バランス): フィニッシュクラスタ（僅差でゴールした集団）を決着させる決め手の能力。
// 従来は地形を問わず常にスプリント力で並べ替えていたため、山頂フィニッシュでも
// 強スプリンターが強クライマーを差す不自然な結果になり、脚質（登坂型）が着順に
// 反映されにくかった。フィニッシュ区間の地形に応じた「決め所の力」で決着させる。
export function finishAbility(en, segType) {
  const sp = en.sprint || 0, cl = en.climb || 0, fl = en.flat || 0, so = en.solo || 0;
  if (segType === "climb" || segType === "mtn") return cl * 0.75 + sp * 0.25; // 山頂決着＝登坂主体
  if (segType === "hill") return sp * 0.45 + cl * 0.35 + fl * 0.20;           // 丘のパンチ力
  if (segType === "tt") return so * 0.6 + fl * 0.4;                          // 独走決着
  return sp; // 平坦・スプリント区間の集団ゴール＝従来どおりスプリント
}

export function resolveFinishClusters(entrants, finishSegType) {
  const sorted = [...entrants].sort((a, b) => a.finishTime - b.finishTime);
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].finishTime - sorted[i].finishTime < TICK_SEC) j++;
    if (j - i > 1) {
      const cluster = sorted.slice(i, j);
      const baseTime = cluster[0].finishTime;
      const scored = cluster.map(en => {
        const jitter = 1 + (Math.random() - 0.5) * 0.16;
        const energyFactor = 0.85 + Math.max(0, Math.min(1, (en.energy + 20) / 120)) * 0.15;
        return { en, score: finishAbility(en, finishSegType) * energyFactor * jitter };
      }).sort((a, b) => b.score - a.score);
      const spread = Math.min(3.0, 0.3 * (scored.length - 1));
      scored.forEach((s, k) => {
        const frac = scored.length > 1 ? k / (scored.length - 1) : 0;
        s.en.finishTime = baseTime + frac * spread;
      });
    }
    i = j;
  }
}

export function rankSim(sim) {
  // v35(バランス): フィニッシュ区間の地形を決着ロジックへ渡す。course未設定の
  // 呼び出し（旧テスト等）は従来どおりスプリント決着（"sprint"）にフォールバック。
  const segs = sim.course && sim.course.segs;
  const finishSegType = segs && segs.length ? segs[sim.course.finalIdx].type : "sprint";
  resolveFinishClusters(sim.entrants, finishSegType);
  capExcessiveGaps(sim.entrants);
  sim.ranked = [...sim.entrants].sort((a, b) => a.finishTime - b.finishTime);
  sim.ranked.forEach((e, i) => e.rank = i + 1);
}


// --- Phase 2追補（取りこぼし関数を追加抽出）---
export const MAX_GAP_MUL = 1.35;

export function capExcessiveGaps(entrants) {
  if (entrants.length === 0) return;
  const winnerTime = Math.min(...entrants.map(e => e.finishTime));
  const cap = winnerTime * MAX_GAP_MUL;
  entrants.forEach(en => { if (en.finishTime > cap) en.finishTime = cap; });
}

export function riderHash01(id, salt) { return ((id * 2654435761 + salt * 40503) % 100000) / 100000; }
