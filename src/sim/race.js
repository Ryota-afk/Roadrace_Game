// レースシミュレーション（コース生成・ティック計算・着順確定）。Phase 2で分離。
import { AB_KEYS, TYPES } from "../data/abilities.js";
import { SEG_LABEL } from "../data/course.js";
import { condMul, hasAbility, hasGoldAbility, mulberry, strHash } from "../core/core.js";
import { ML_PART_LV_MUL } from "../data/gear.js";

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
      if (!pid || !PARTS[pid]) return;
      // v51(第12弾12-B): マイライフ限定のパーツ強化Lv（Season選手はr.partLvが存在せず常に0＝無影響）
      const lv = (r.partLv && r.partLv[slot]) || 0;
      const mul = 1 + ML_PART_LV_MUL * lv;
      Object.entries(PARTS[pid].ab).forEach(([k, v]) => { e[k] += v * mul; });
    });
  }
  // v28: 大舞台適性。big=★3で+6%、nervous(悪特性)=★3で-5%
  // v29: メンタルも★3で能力に反映（±約8%）。特性big/nervousと重ねる
  const mental = r.mental ?? 50;
  const mentalBig = grade === 3 ? 1 + (mental - 50) / 600 : 1;
  // v37(第2弾): 大舞台の申し子＝★3/★4で+7%（世界選手権・五輪でも発揮）。既存bigは★3のみ+6%。
  const bigheartMul = (grade >= 3 && hasAbility(r, "bigheart")) ? (hasGoldAbility(r, "bigheart") ? 1.10 : 1.07) : 1;
  const bigMul = (grade === 3 ? (hasAbility(r, "big") ? 1.06 : hasAbility(r, "nervous") ? 0.95 : 1) : 1) * mentalBig * bigheartMul;
  const wMul = rainMul(r, weather);
  const mMul = monumentMul(r, monument); // v34(C-2): 古典適性（石畳巧者）
  AB_KEYS.forEach(k => { e[k] = e[k] * cm * fatPen * bigMul * wMul * formMul * mMul; });
  // v28: オールラウンダーは全能力を控えめに底上げ（脚質を選ばない万能型）
  if (hasAbility(r, "allrounder_sp")) AB_KEYS.forEach(k => { e[k] += hasGoldAbility(r, "allrounder_sp") ? 4 : 2; });
  // v31.2: 配合限定特能。系統の申し子＝全能力+3、覇道の血脈＝全能力+2かつスタミナ+3
  if (hasAbility(r, "sireline")) AB_KEYS.forEach(k => { e[k] += 3; });
  if (hasAbility(r, "dynasty")) { AB_KEYS.forEach(k => { e[k] += 2; }); e.stamina += 3; }
  // v35(バランス): 二刀流（配合限定）は従来 segmentAbility の丘/登/山/スプに+5だけで、
  // 決着（finishAbilityは素のclimb/sprint参照）や平坦に届かず、+3全能力の系統の申子に見劣りしていた。
  // 二本柱である登坂とスプリントの素地を底上げ（+2/+2）し、フィニッシュにも効く二刀流に。
  if (hasAbility(r, "hybrid")) { e.climb += 2; e.sprint += 2; }
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
  // v37(第2弾): 岳人＝丘/登/山で+4、重量級（悪特性）＝登/山で-4
  if (hasAbility(e, "allclimber") && ["hill", "climb", "mtn"].includes(segType)) ab += hasGoldAbility(e, "allclimber") ? 8 : 4;
  if (hasAbility(e, "heavy") && ["climb", "mtn"].includes(segType)) ab -= 4;
  return ab;
}

export const TICK_SEC = 1;
const GROUP_GAP_DIST = 0.22;      // これ以内の位置差なら同一グループ
const ROTATION_PERIOD_TICKS = 20; // 20秒ごとに先頭交代
// v47(第8弾A案): 集団内の位置取り（slot＝0が先頭寄り）に応じてkeepThresh（千切れ判定の基準）を
// 傾ける幅。最後方(posShare=1)の選手はkeepThreshがこの分だけ厳しくなる＝千切れやすい。
// 既存のgrinder/holdOn補正（0.04〜0.06緩和）と同程度の大きさに揃えてある（詳細はDEVLOG §39参照）。
const POSITION_TIGHT_SPAN = 0.015;
// 判断カードの意思が位置取りの強さに与える補正（順位付けスコアへの加減算）。
const CONSERVE_BACK_BIAS = 0.10; // 「脚を溜める」は後方へ譲る（意図的な位置低下）
const HOLDON_FRONT_BIAS = 0.06;  // 「食らいついて粘る」は位置を死守しようとする
// v48(第10弾): チームドラフト。従来はshelterMul（消耗軽減）が集団の人数だけで決まり、
// 前を牽いているのが味方か敵かで計算結果が1ビットも変わらなかった＝「協力の実感が無い」の
// 実体（詳細はDEVLOG §41／devlog/wave10.md）。同じ集団内で自分より前にいる味方の人数・
// 牽引者が味方かどうかに応じてドラフトの消耗を軽減する（全チームに対称適用）。
const TEAM_SHELTER_PER_MATE = 0.05;   // 前にいる味方1人につき消耗-5%
const TEAM_SHELTER_PULL_BONUS = 0.08; // 牽引者が味方なら追加で-8%
const TEAM_SHELTER_FLOOR = 0.6;       // 下限（大所帯チームでも消耗ゼロにはしない）
// v48(第10弾): 「ついていける」基準（keepThresh）そのものへの緩和。消耗軽減（上）だけでは、
// 地力の劣る選手はその恩恵を受ける前に千切れてしまう（＝守る相手がそもそも集団に残らない）。
// grinder特性のkeepThresh緩和（0.04〜0.06）と同程度の大きさに揃えてある。
const TEAM_KEEP_RELIEF_PER_MATE = 0.015;
const TEAM_KEEP_RELIEF_PULL_BONUS = 0.02;
const TEAM_KEEP_RELIEF_MAX = 0.08;
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
// v38(#2): スタミナ管理AI。牽引役はエネルギーがこの下限を割ると牽引をやめて集団内に戻り
// （draft）回復し、上限まで戻るまで牽引に復帰しない（ヒステリシスでバタつき防止）。牽引しっぱなしの
// 自滅（＝アシスト大敗や早め逃げの燃え尽きの一因）を抑え、現実のローテーション（先頭交代→後方回復）を再現。
const PULL_MIN_ENERGY = 24;
const PULL_RESUME_ENERGY = 44;

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
// 登りでは集団のドラフト優位も縮む）、丘で中程度、平坦・スプリントでは軽め＝それでも吸収される。
// 集団に吸収されて draft/pull へ戻れば solo/attack ではなくなり自動的に無効化される。
// v48(第9弾): attack判断の実測診断で、仕掛け後に実際にsolo化する割合は85〜90%と機能してはいる
// ものの、平均で60〜90tickしか独走を維持できず集団に吸収され、しかもその間の消耗（brk旧値：
// 平坦/スプリント/TTは軽減なし=1.0倍）がそのまま終盤まで尾を引いて他の判断より明確に不利
// だった（実測：勝者との差が全区分でholdの2〜3倍）。まず「独走の持続時間を延ばす」方向を
// 試したが、attackモード中は集団判定を無視して強制的にsolo相当の高消耗（effortCost 1.6）を
// 払い続けるため、持続tickを大きく伸ばす（30→140）とエネルギーが壊滅的に枯渇し逆に大惨敗した
// （実測：平均着差が数十秒→100秒超に悪化）。持続時間はいじらず、消耗緩和（brk係数）だけを
// 全地形で強化する方向へ切り替えた。平坦・スプリント・TTにも緩和を与え（1.0→0.75/0.85/0.75）、
// 登坂・丘も併せて強化（0.55/0.6/0.78→0.4/0.45/0.55）。結果、勝率はほぼ変えずに敗着差・平均
// 順位が全区分で明確に改善（例：能力105・finale発火で着差14.5秒→11.7秒、平均順位9.0→5.5）。
// 「時々刺さるがリスクの高い一手」という設計意図に沿う形になった（詳細はDEVLOG §40）。
function energyDrain(en, mode, segType, steepness) {
  // v28: 「無尽蔵のエンジン」はレース中のエネルギー消耗が軽い（金特で更に軽減）
  const engineMul = hasAbility(en, "engine") ? (hasGoldAbility(en, "engine") ? 0.80 : 0.88)
    : hasAbility(en, "diesel") ? (hasGoldAbility(en, "diesel") ? 0.88 : 0.93) : 1; // v37(第2弾): 鉄の心肺＝汎用の消耗軽減
  // v37: 地形特化のエコラン（消耗軽減）。登坂＝山の吸血鬼、平坦＆独走/逃げ＝巡航機関。
  const climbEco = (hasAbility(en, "climbengine") && (segType === "climb" || segType === "mtn")) ? (hasGoldAbility(en, "climbengine") ? 0.78 : 0.85) : 1;
  // 巡航機関は平坦に加え、独走・逃げ（solo/attack）でも垂れにくい＝逃げ脚質・独走屋に効く
  const rouleurEco = (hasAbility(en, "rouleur") && (segType === "flat" || mode === "solo" || mode === "attack")) ? (hasGoldAbility(en, "rouleur") ? 0.78 : 0.85) : 1;
  const terrainEcoMul = climbEco * rouleurEco;
  const brk = en.committedBreak && (mode === "solo" || mode === "attack")
    ? ({ mtn: 0.4, climb: 0.45, hill: 0.55, flat: 0.75, sprint: 0.85, tt: 0.75 }[segType] ?? 1) : 1;
  // v35: 献身のアシストに徹する選手は、賢く脚を使って（無駄に踏み過ぎず）自滅を避ける。
  // 長丁場のクリテ等で牽引しすぎて千切れ、自分もエースも大敗する事故を防ぐ。
  const assistMul = en.isAssisting ? 0.78 : 1;
  return TICK_SEC * (1 - en.stamina / 150) * DRAIN_K * effortCost(mode, segType, steepness) * roleTerrainMismatchMul(en.role, segType) * engineMul * terrainEcoMul * brk * assistMul;
}

export function canPull(en, segType) {
  if (en.isAce) return false;
  // v48(第10弾): v36修正時は「献身のアシストは牽かない」だったが、その代わりに
  // エースへの能力値書き換えで恩恵を表現していた（第10弾で廃止・実効果のチームドラフトへ置換、
  // simulateTicks参照）。実際にチームへ風除けを供給できるのは牽引できてこそなので、
  // ここでの除外もあわせて撤廃する。自滅対策はv38(#2)のPULL_MIN/RESUME_ENERGYヒステリシス
  // （下のcommitted分岐）と既存のassistMul(energyDrain)がそのまま効く。
  if (en.energy <= 0) return false;
  // v38(#2): スタミナ管理。勝負を賭けた逃げ（breakaway/committedBreak）以外は、消耗したら
  // 牽引を降りて集団内で回復し、脚が戻ったら再び牽引に加わる。牽引の抱え込みによる自滅を防ぐ。
  const committed = en.role === "breakaway" || en.committedBreak;
  if (!committed) {
    if (en.recovering) {
      if (en.energy < PULL_RESUME_ENERGY) return false; // まだ回復中
      en.recovering = false;                            // 十分戻った→牽引復帰
    } else if (en.energy < PULL_MIN_ENERGY) {
      en.recovering = true; return false;               // 消耗→後方で回復へ
    }
  }
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
      en.posHist = []; en.energyHist = []; en.modeHist = []; en.groupHist = []; en.slotHist = []; en.tagHist = [];
      en.nextPullerHist = []; // v47(第8弾A案): 「次に牽引」表示用（slotとは別の履歴に分離）
      en.tag = null; en.trainOrder = null; en.launchLeft = 0;
      en.leadoutFor = null; en.isLeadingOut = false;
      // v39(A案): レース中の「判断カード」でプレイヤーが選ぶ動きの状態。conserveLeft>0の間は
      // 脚を溜める（牽引しない＋消耗軽減）、finaleSend（数値）は最終区間の追い込みの上乗せ、
      // holdOn>0の間は歯を食いしばって集団に食らいつく（keepThreshが下がる＝千切れにくい）。
      en.conserveLeft = 0; en.finaleSend = 0; en.holdOn = 0;
    });
    // v38: リードアウト指名。各チームでエース（＝射出される選手）に対し、平坦/スプリント寄りの
    // 非エース1名を「リードアウト役」に割り当てる。最終区間で同集団にいれば前を牽いてエースを
    // 射出し（エースにスリングショットの伸び）、脚を使い切ったら流して後方へ下がる（視認できる動き）。
    const _byTeam = {};
    riders.forEach(en => { (_byTeam[en.team] = _byTeam[en.team] || []).push(en); });
    Object.values(_byTeam).forEach(mem => {
      if (mem.length < 2) return;
      const ace = mem.find(e => e.isAce);
      if (!ace) return;
      const cand = mem.filter(e => !e.isAce && !e.isAssisting)
        .sort((a, b) => ((b.sprint || 0) + (b.flat || 0)) - ((a.sprint || 0) + (a.flat || 0)))[0];
      if (cand) cand.leadoutFor = ace.id;
    });
  } else {
    riders.forEach(en => {
      const idx = Math.min(fromTick - 1, en.posHist.length - 1);
      en.pos = en.posHist[idx]; en.energy = en.energyHist[idx];
      en.posHist = en.posHist.slice(0, fromTick); en.energyHist = en.energyHist.slice(0, fromTick);
      en.modeHist = en.modeHist.slice(0, fromTick); en.groupHist = en.groupHist.slice(0, fromTick);
      en.slotHist = en.slotHist.slice(0, fromTick);
      en.tagHist = (en.tagHist || []).slice(0, fromTick);
      en.nextPullerHist = (en.nextPullerHist || []).slice(0, fromTick);
      en.tag = null; en.trainOrder = null; en.launchLeft = 0;
      // v39(A案 bugfix): 完走済みの状態が持ち越されると active が空になり再開ループが即break（=再計算されない）。
      // fromTick時点でまだゴールしていない選手（pos<コース長）はレース続行として finished を解除する。
      if (en.pos < course.length) { en.finished = false; en.finishTime = null; }
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
    // v38(改善:集団スプリント抑制): 平坦系の終盤、大集団が保たれていると「集団スプリントで勝てない」
    // 非スプリンター型のAIが痺れを切らして飛び出す（早めに仕掛ける）。飛び出した本人だけがソロで前へ出て
    // 集団を1人ずつ抜けさせ隊列が伸びる＝30人団子ゴールが減る。プレイヤー本人は自分の作戦に従うので対象外。
    Object.values(groups).forEach(members => {
      if (members.length < 6) return;
      const seg0 = course.segTypeAt(members[0].pos);
      if (seg0.idx === course.finalIdx) return; // 最終直線ではもう遅い
      const prog = members[0].pos / course.length;
      if (prog < 0.40 || prog > 0.86) return;
      // v38(改善): 平坦系＋丘（丘陵クラシック等）で発動。丘は committedBreak に消耗軽減が付くため
      // 飛び出しが決まりやすく、隊列が伸びる。純登坂/山岳は自然選抜に任せて対象外。
      if (!["flat", "sprint", "tt", "hill"].includes(seg0.type)) return;
      const onHill = seg0.type === "hill";
      // 大集団のまま終盤に近づくと、集団スプリントで勝てない非スプリンターが痺れを切らして飛び出す。
      // 攻撃した本人だけがソロで前に出る（＝集団を1人ずつ抜けさせて隊列を伸ばす）。集団本体の消耗は
      // 増やさない＝プレイヤーが不当にふるい落とされて大敗するのを避けつつ、動きのあるレースにする。
      members.forEach(en => {
        if (en.isPlayerChar || en.isAce || en.attackLeft > 0 || en.committedBreak || en.mode === "solo" || en.energy < 42) return;
        const peak = Math.max(en.flat || 0, en.climb || 0, en.sprint || 0, en.stamina || 0, en.solo || 0);
        const sprintGap = peak - (en.sprint || 0); // スプリントが弱いほど大きい＝集団ゴールで不利
        if (sprintGap < 8) return; // スプリント型は集団ゴールを待つ
        // 丘では飛び出しが決まりやすい（消耗軽減）ので発動率を上げ、登り適性のある選手が仕掛ける
        const climbEdge = onHill ? Math.max(0, ((en.climb || 0) - (en.sprint || 0))) / 200 : 0;
        const chance = Math.min(0.06, 0.008 + (members.length - 6) * 0.0012 + (sprintGap - 8) * 0.0009 + (onHill ? 0.012 : 0) + climbEdge);
        if (Math.random() < chance) { en.attackLeft = BREAKAWAY_ATTACK_TICKS; en.committedBreak = true; }
      });
    });
    Object.values(groups).forEach(members => {
      if (members.length === 1) {
        const en = members[0];
        en.mode = en.attackLeft > 0 ? "attack" : "solo";
        en.slot = 0;
        if (en.attackLeft > 0) en.attackLeft--;
        return;
      }
      const segType = course.segTypeAt(members[0].pos).type;
      // v39(A案): 「脚を溜める」判断中の選手は前を牽かない（集団後方で温存する）
      let eligible = members.filter(en => canPull(en, segType) && !(en.conserveLeft > 0));
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
      // v47(第8弾A案): 旧slotは「牽引ローテ待ち順」（実力と無関係）と「集団内の前後位置」の
      // 2つの意味を兼ねていた。UIの「次に牽引」表示は前者、keepThresh/backRatioは後者を
      // 必要とするため分離する。ローテ待ち順はnextPullerへ、位置取りはこの後の
      // 「集団についていけるか」パスでownCapable・残脚・判断カードから作り直す
      // （詳細はDEVLOG §39参照）。
      const nextPullerRider = eligible.length > 1 ? eligible[(rotIdx + 1) % eligible.length] : null;
      members.forEach(en => {
        en.nextPuller = en === nextPullerRider;
        if (en.attackLeft > 0) { en.mode = "attack"; en.slot = 0; en.attackLeft--; return; }
        en.mode = (puller && en === puller) ? "pull" : "draft";
        if (en.mode === "pull") en.slot = 0; // draft側はこの後の位置取りパスで割り当て直す
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
      // v38: リードアウト検出。最終区間で、自エースと同集団にいてまだ脚が残るリードアウト役を
      // 「射出中」にする。エースはスリングショットの伸びを得る（slingshotAceIds）。
      const finalSegNow = course.segTypeAt(members[0].pos).idx === course.finalIdx;
      const slingshotAceIds = new Set();
      if (finalSegNow) {
        members.forEach(en => {
          const ace = en.leadoutFor != null ? members.find(a => a.id === en.leadoutFor && !a.finished) : null;
          const active = !!ace && en.energy > 30;
          // v39.20: 発射（launch）＝リードアウトが脚を使い切って役目を終えた瞬間。エースはここから独りで踏む。
          // エースが一時的に別集団になっただけの時に誤発火しないよう、「エースが同集団にいるのに脚が尽きた」
          // ケースに限定する。
          if (en.isLeadingOut && !active && ace) {
            ace.launchLeft = 12;
            en.tag = "peel";                       // 力尽きて後方へ下がる（ピールオフ）
          }
          en.isLeadingOut = active;
          if (active) { slingshotAceIds.add(en.leadoutFor); en.tag = "leadout"; }
        });
      }
      // v39.20(展開のリアリティ): トレイン＝終盤、同じ集団にいる自チームの面々がエースの前に縦一列で並び、
      // 順に牽いてエースを勝負所へ運ぶ。前待ち＝勝負所の手前で集団前方に位置取りする動き。どちらも
      // 「slot（前後の位置取り）」に反映されるため、俯瞰マップ上でも隊列として目に見える。
      {
        const progNow = members[0].pos / course.length;
        const trainZone = finalSegNow || progNow > 0.86;   // 終盤＝トレインを組む
        const frontZone = !trainZone && progNow > 0.72;    // 勝負所の手前＝前待ち
        if (trainZone || frontZone) {
          const byTeam = {};
          members.forEach(en => { (byTeam[en.team] = byTeam[en.team] || []).push(en); });
          Object.values(byTeam).forEach(mates => {
            if (mates.length < 2) return;
            const ace = mates.find(e => e.isAce);
            if (!ace) return;
            const helpers = mates.filter(e => !e.isAce && e.energy > 22 && e.attackLeft <= 0)
              .sort((a, b) => b.energy - a.energy);      // 脚が残る順に前へ（＝先に使い切る順に並ぶ）
            if (!helpers.length) return;
            if (trainZone) {
              helpers.forEach((e, i) => { e.slot = i; e.trainOrder = i + 1; if (!e.tag) e.tag = "train"; });
              ace.slot = helpers.length;                  // エースは列車の直後（風除けの中）
              ace.trainOrder = 0;
              if (!ace.tag) ace.tag = "train";
            } else {
              // 前待ち：エースと先頭のヘルパーだけ集団前方へ上げる（脚は使わない位置取り）
              ace.slot = Math.min(ace.slot ?? 3, 2);
              helpers[0].slot = Math.min(helpers[0].slot ?? 3, 1);
              if (!ace.tag) ace.tag = "front";
              if (!helpers[0].tag) helpers[0].tag = "front";
            }
          });
        }
      }
      const groupDist = puller.lastOwnDist;
      // v47(第8弾A案): 集団内の位置取り（slot）を、脚力・残脚・判断カードから作り直す。
      // ownCapableはMath.random()のtickジッターを含むため、順位付け用と移動判定用で
      // 2回呼ぶと食い違う。1回だけ計算してキャッシュし、両方で使い回す。
      const draftMembers = members.filter(en => en.mode === "draft");
      const draftCalc = draftMembers.map(en => {
        const segInfo = course.segTypeAt(en.pos);
        const segType = segInfo.type;
        const ownCapable = tickDistance(en, segType, "pull", course.steepness);
        return { en, segInfo, segType, ownCapable };
      });
      // trainZone/frontZoneで既に前方へ固定された選手（このtickでtagが付いている）はそのまま
      // 最前列を占有させ、残りを「地形適性(ownCapable/groupDist)＋判断カードの意思」で順位付けする。
      const pinned = draftCalc.filter(c => c.en.tag === "train" || c.en.tag === "front");
      const ranked = draftCalc.filter(c => !(c.en.tag === "train" || c.en.tag === "front"));
      const frontStrength = (c) => c.ownCapable / groupDist
        - (c.en.conserveLeft > 0 ? CONSERVE_BACK_BIAS : 0)
        + (c.en.holdOn > 0 ? HOLDON_FRONT_BIAS : 0);
      ranked.sort((a, b) => frontStrength(b) - frontStrength(a));
      let nextSlot = pinned.length;
      ranked.forEach(c => { c.en.slot = nextSlot++; });
      const totalDraft = Math.max(1, draftCalc.length - 1);

      draftCalc.forEach(({ en, segInfo, segType, ownCapable }) => {
        // v12: 横風区間は道幅の関係で全員がシェルターを得られず、千切れやすくなる
        // （集団についていける基準を厳しくし、ドラフトのコストも上げる）
        const windActive = !!segInfo.wind;
        let dist;
        // v37: 食らいつく脚＝集団に残る基準が緩む（千切れにくい）。ドラフトの「ついていける」閾値を下げる。
        // v38(#1): フィナーレの絞り込み。最終区間（ゴール勝負のストレート）だけ、勝負に向けて
        // ペースが上がり位置取り争いも激しくなるため、大集団ほど「ついていける」閾値が上がる＝実力が
        // 足りない選手から自然に絞られる。平坦系の「20秒以内に20人」の塊ゴールを抑える。
        // 最終区間限定にして、周回の長いクリテで残り25%全体に効いて千切れが複利的に増える（＝大敗
        // 多発）のを防ぐ（小集団の逃げ切りには影響小）。
        const finaleTight = (segInfo.idx === course.finalIdx) ? Math.min(0.045, 0.01 + members.length * 0.0009) : 0;
        // v38(改善): モニュメント/最上級グレードの選抜レースは、丘・登坂・最終で集団についていく基準が
        // 上がる＝実力上位だけが残る「select group」の決着に。極まった選手は残り、力の劣る選手はふるわれる。
        const selectiveTight = (course.selective && (["hill", "climb", "mtn"].includes(segType) || segInfo.idx === course.finalIdx)) ? 0.035 : 0;
        // v47(第8弾A案): 集団内の位置（0=先頭寄り〜1=最後方）に応じてkeepThreshを傾ける。
        // 先頭にいるほど千切れにくく、後方にいるほど千切れやすい（実際の集団分裂は前から
        // 割れずに後方から千切れていく現象を再現）。
        const posShare = Math.min(1, (en.slot || 0) / totalDraft);
        const positionTight = posShare * POSITION_TIGHT_SPAN;
        // v48(第10弾): チームドラフト。自分より前にいる味方の人数＋牽引者が味方かを見て、
        // 「ついていける」基準そのものを緩める（＝力の劣る味方でも千切れにくくなる）のと、
        // 実際についていけた後の消耗（drainのteamShelterMul、下）の両方に効かせる。
        // 前者が無いと、地力の劣るエースは風除けの恩恵を受ける前にkeepThreshで千切れてしまい
        // 「そもそも守る相手が集団に残っていない」状態になる（詳細はDEVLOG §41／devlog/wave10.md）。
        const teamAhead = members.filter(m => m !== en && m.team === en.team
          && (m.mode === "pull" || (m.mode === "draft" && (m.slot ?? 0) < (en.slot ?? 0)))).length;
        const pullerIsMate = !!(puller && puller.team === en.team);
        const teamKeepRelief = Math.min(TEAM_KEEP_RELIEF_MAX, teamAhead * TEAM_KEEP_RELIEF_PER_MATE + (pullerIsMate ? TEAM_KEEP_RELIEF_PULL_BONUS : 0));
        // v48(第10弾): 風除けを受けている選手に展開タグを立てる（train/front/leadout/peelが
        // 既に付いていればそちらを優先＝上書きしない）。これで「協力が効いている」ことが
        // 脚バーの減り方だけでなく画面上のタグとしても常時見える。
        if (!en.tag && (teamAhead > 0 || pullerIsMate)) en.tag = "shelter";
        // v47(第8弾Phase4): hangOnのkeepThresh緩和を0.05→HANGON_KEEPTHRESH_RELIEF(0.12)へ強化
        // （詳細は定数コメント参照）。
        const keepThresh = (windActive ? 0.80 : 0.9) + finaleTight + selectiveTight + positionTight - (hasAbility(en, "grinder") ? (hasGoldAbility(en, "grinder") ? 0.06 : 0.04) : 0) - (en.holdOn > 0 ? HANGON_KEEPTHRESH_RELIEF : 0) - teamKeepRelief;
        if (ownCapable >= groupDist * keepThresh) {
          // v12バグ修正: ゴールスプリント区間で集団のドラフト勢が全員groupDistと完全に
          // 同一の距離だけ進む仕様だと、同じ集団の選手が毎ティック寸分違わず横並びになり、
          // ゴールタイムが不自然なほど大量に完全一致してしまう（差が均質すぎる問題）。
          // スプリント区間に限り、各選手自身のスプリント適性（ownCapable/groupDistの比）と
          // 小さな運要素を反映した微差を加え、集団のままでも着差にばらつきが出るようにする
          const isFinalSeg = segInfo.idx === course.finalIdx;
          if (isFinalSeg && en.isLeadingOut && !en.isAce) {
            // v38: リードアウト役は最終区間で前を牽いて集団の頭に上がり（surge）、エースを射出する。
            // 脚が残る間だけ（energy>30）前に出て、使い切ったら isLeadingOut が外れて通常処理へ→
            // 自然に後方へ流れる（＝見た目のリードアウト→ピールオフ）。
            const luck = (riderHash01(en.id, tick + 4409) - 0.5) * 0.02;
            dist = groupDist * (1.05 + luck);
            en.leadoutSurging = true;
          } else if (isFinalSeg && en.isAssisting && !en.isAce) {
            // v36修正: 献身のアシストは最終直線で仕事を終え、勝負を譲って流す（スプリントしない）。
            // ＝先頭で競らず、集団の後方へ自然に下がる。これにより「アシストなのに自分がぶっちぎって
            // 先頭ゴール→リザルトでは2位」という観戦とリザルトの食い違いを、シミュレーション自体で
            // 解消する（着順を後から書き換えない＝アニメと結果が必ず一致）。
            const luck = (riderHash01(en.id, tick + 4409) - 0.5) * 0.02;
            dist = groupDist * (0.90 + luck);
          } else if (isFinalSeg) {
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
            const finishKick = (hasAbility(en, "finisher") ? (hasGoldAbility(en, "finisher") ? 0.06 : 0.035) : 0)
              // v37: 剛脚の差し脚＝最終直線の追い込みがさらに鋭い（finisherと重複可）／勝負弱い＝鈍る（悪特性）
              + (hasAbility(en, "kicker") ? (hasGoldAbility(en, "kicker") ? 0.05 : 0.03) : 0)
              - (hasAbility(en, "choke") ? 0.03 : 0)
              // v38: リードアウト役が同集団で射出してくれているエースは、風除け＋加速で伸びる（スリングショット）
              + (slingshotAceIds.has(en.id) ? 0.045 : 0)
              // v39(A案): 「全力で踏む／差し脚」判断＝最終直線で脚を残さず絞り出す（追い込みの上乗せ・数値）
              + (en.finaleSend || 0);
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
        const backRatio = sheltered ? Math.min(1, (en.slot || 0) / totalDraft) : 0;
        const regen = sheltered ? ENERGY_REGEN_BASE * backRatio * (windActive ? 0.5 : 1) : 0;
        const teamShelterMul = sheltered
          ? Math.max(TEAM_SHELTER_FLOOR, 1 - teamAhead * TEAM_SHELTER_PER_MATE - (pullerIsMate ? TEAM_SHELTER_PULL_BONUS : 0))
          : 1;
        // v15: 横風耐性を持つ選手は横風区間でのドラフト消耗ペナルティが軽減される（1.25→1.1）
        const windPenalty = windActive && en.mode === "draft" ? (hasAbility(en, "windguard") ? 1.03 : hasAbility(en, "crosswind_sp") ? 1.1 : 1.25) : 1;
        // v17: チームケミストリー（squad構築時にchemMulを付与。未設定なら1で無効果）
        // v38: リードアウトの射出は脚を激しく使う（前を牽くのでドラフト保護が薄い）＝surge中は消耗増。
        const leadoutDrainMul = en.leadoutSurging ? 2.2 : 1;
        // v38(改善): モニュメント等の選抜レースは、丘・登坂の消耗が大きく累積し、スタミナの劣る選手が
        // 繰り返しの登りで脱落していく＝均質に強い集団でもゴール前に「select group」へ絞られる。
        // ドラフトの風除け（shelterMul）を一部打ち消す係数なので、体力のある選手（＝極まった主人公）は残る。
        const selectiveDrainMul = (course.selective && ["hill", "climb", "mtn"].includes(segType)) ? 1.45 : 1;
        // v39(A案): 「脚を溜める」判断中は集団の中で賢く脚を使い、消耗が軽くなる（＝勝負所に脚を残せる）
        // v46(#27): 0.74→0.60。当時は残脚ゲート(legsLeft01)がLEGS_FULL=40の頭打ちで常に1.00に
        // 張り付いており実質機能していなかったため、conserveの効果を体感できる量まで強めていた。
        // v47(第8弾Phase4-bis): LEGS_EMPTY/LEGS_FULLの再較正でゲートが実際に機能するようになった今、
        // 0.60は過剰だった（中盤発火・持続tickを150まで削っても勝率93%と動かなかった＝tick数では
        // なくこの消費倍率そのものが支配的だったと実測で判明）。0.75へ緩和する。
        const conserveMul = en.conserveLeft > 0 ? 0.75 : 1;
        const drain = energyDrain(en, en.mode === "solo" ? "solo" : "draft", segType, course.steepness) * windPenalty * shelterMul * teamShelterMul * (en.chemMul || 1) * leadoutDrainMul * selectiveDrainMul * conserveMul;
        en.energy = Math.min(100, Math.max(ENERGY_FLOOR, en.energy - drain + regen));
        en.leadoutSurging = false;
      });
    });
    // 4. 履歴記録・ゴール判定
    active.forEach(en => {
      if (en.conserveLeft > 0) en.conserveLeft--; // v39(A案): 温存の残りtickを消化
      if (en.holdOn > 0) en.holdOn--;             // v39(A案): 食らいつく残りtickを消化
      en.posHist[tick] = en.pos; en.energyHist[tick] = en.energy;
      en.modeHist[tick] = en.mode; en.groupHist[tick] = en.groupId; en.slotHist[tick] = en.slot || 0;
      en.nextPullerHist[tick] = !!en.nextPuller;
      // v39.20: 展開タグ（トレイン/リードアウト/発射/前待ち/ピールオフ）を履歴に記録し、観戦で可視化する
      if (en.launchLeft > 0) { en.tag = "launch"; en.launchLeft--; }
      en.tagHist[tick] = en.tag || null;
      en.tag = null;
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

// v39(A案): レース中の「判断カード」でプレイヤーが選ぶ動きを、注目選手の状態に落とし込む定義。
// simulateTicks が解釈するフィールド（attackLeft/committedBreak/conserveLeft/finaleSend）を
// セットするだけの純関数。RACE_MOVES のキーが RaceView のカード選択肢と対応する。
// v46(バランス#27): 「脚が残っている時にだけ決まる」ゲート。
// 【実測でわかったこと】中盤の一手は脚が空だと自然に不発になる（残脚20未満での勝率0%）のに対し、
// 最終スプリントの一手は脚が空でも決まってしまう（同条件で勝率63.6%）。ゴールが近いと
// エネルギー欠乏が速度に効いてくる時間が残っておらず、さらに energyPenaltyMul は下限0.55で
// 既に飽和しているため、「energyを引く」という代償が抑止としてまったく機能していなかった。
// そこで代償に頼らず、踏み切れる量そのもの（バースト長・追い込み量）を残脚で決める。
// これによりv39.21が意図した「出力を上げれば脚は減る＝脚が残っている時にだけ決まる」が
// 初めて実際の挙動になり、同時に「脚を溜める」が後の一手を活かす布石として機能し始める。
//
// v47(第8弾Phase4-bis・再較正): 上記のコメントに残る「中盤93/勝負所-35/最終-76」という分布は
// §35時点（第7弾より前）の実測で、その後の第7弾（練習にコストを作る・年次インフレ廃止）と
// 第8弾A案（集団内の位置取りを実力ベースに）でレースのエネルギー経済が大きく変わったため、
// もはや実態と一致しない。旧LEGS_FULL=40は現在の分布に対して低すぎ、判断カードが出る瞬間の
// 残脚の大半（能力93以上・丘陵ロードで中盤72・勝負所28等）が「全開で踏み切れる」判定に
// 潰れてしまい、legsLeft01が常に1.00に張り付いて残脚ゲートが実質機能していなかった
// （scratchpad/legs_dist.mjsで丘陵/山岳/クリテの3コース×能力85/93/105×3発火点を実測）。
// LEGS_EMPTY=-45/LEGS_FULL=95へ引き直し、能力93〜105帯で発火点ごとに0.27〜0.89まで
// 開閉するようにした（詳細な分布はDEVLOG §39参照）。
const LEGS_EMPTY = -45; // これ以下は完全に売り切れ扱い
const LEGS_FULL = 95;   // これ以上あれば全開で踏み切れる
export function legsLeft01(en) {
  const e = en.energy ?? 100;
  return Math.max(0, Math.min(1, (e - LEGS_EMPTY) / (LEGS_FULL - LEGS_EMPTY)));
}
const SEND_MIN_TICKS = 4, SEND_MAX_TICKS = 18;      // 早駆けの持続（空:4秒 / 満:18秒）
// v47(第8弾Phase4): 早駆け(send)は脚を17も使う代償付きの一手なのに、無代償の差し脚(kick)より
// 上限が低く（旧0.07 vs kickの固定0.09）、リスクを取る意味が無かった。kickの旧上限0.09より
// 明確に上へ引き上げる。
const SEND_MIN_KICK = 0.03, SEND_MAX_KICK = 0.13;   // 早駆けの最終直線での上乗せ
const ATTACK_MIN_TICKS = 10;                        // 仕掛けの持続の下限（満はBREAKAWAY_ATTACK_TICKS）
// v47(第8弾Phase4): 差し脚系(kick/kickBig/sprintWait)は残脚に関係なく固定値の追い込みを
// 得ていたため、attack/sendだけが残脚ゲートの代償を背負う非対称になっていた（Phase 3実測で
// 発火点によらずkickが最強手として支配的だったのはこれが原因）。他の判断と同じく
// legsLeft01()に比例させ、「脚が残っていてこそ効く」という条件を揃える。
const KICK_MIN = 0.03, KICK_MAX = 0.11;
const KICKBIG_MIN = 0.05, KICKBIG_MAX = 0.17;
const SPRINTWAIT_MIN = 0.04, SPRINTWAIT_MAX = 0.13;
// v47(第8弾Phase4): conserveの持続はA案（位置取り）導入前にkeepThresh一律の時代の値
// （§35で80→500）。A案で後方ほど千切れやすくなった今は効きすぎ（Phase 3実測で中盤・格下の
// 勝率95%）だったため、位置取りとの相互作用込みで再較正する。
// v47(第8弾Phase4較正): 260でも中盤発火→ゴールの平均間隔(~865tick)の3割程度をカバーし、
// エネルギー温存がkeepThresh判定・最終着差の両方に波及して複利的に効きすぎた（実測：中盤・
// 格下で勝率96%）。150へ絞ったが、なお勝率93%で変化がほぼ無かった。
// v47(第8弾Phase4-bis): conserveMulを0.60→0.75に緩めても勝率が動かなかったため、真因を
// 切り分けた結果、支配的なのはconserveMul（消費倍率）ではなく「conserveLeft>0の間は
// 牽引ローテのeligibleプールから完全に除外される」効果だと判明した（他の判断はローテに
// 参加し続けるため150tick=約7.5サイクルの間に平均1〜2回は消費の大きいpullを割り当てられるが、
// conserveだけがそれを免除される）。conserveMulをいくら緩めてもこの効果は変わらないため、
// 免除される期間そのものを§35の元の値(80)に近い60まで縮める。
// v47(第8弾Phase4-bis 続): 60でも中盤・格下で勝率80%とkick(69%)よりなお高かった（「牽引免除」の
// 効果がまだ残っていた）。40まで追加で絞る。
const CONSERVE_TICKS = 40;
// v47(第8弾Phase4): hangOnは§35時点でほぼholdと同値という既知の課題だった（Phase 3実測でも
// 9区分すべてでholdとの差がほぼ無いことを確認）。keepThreshの緩和・持続を強化し、
// 「脚を使って位置を死守する」という代償付きの手として機能させる。
const HANGON_TICKS = 220;
// v47(第8弾Phase4較正): 0.12でもholdとの差がほぼ出なかった（実測：格上85でむしろhold優位）。
// 緩和を強化し、脚の消費コストは半減して純粋な効果を見えやすくする。
const HANGON_KEEPTHRESH_RELIEF = 0.20;
const HANGON_ENERGY_COST = 3;

export const RACE_MOVES = {
  // ⚡ 仕掛ける：単独で飛び出す。決まれば大きく前進、脚を使い切れば失速する諸刃の剣
  // 得意地形・逃げ屋のアタックは、脚質・特性による能力ブースト（escape/地形適性）がsim側で乗るため、
  // 同じ attack でも「その選手ならでは」の伸びになる（専用ムーブを増やさず必勝ボタン化を避ける）。
  // v39.21(バランス): 全開の一手には「脚を使う」代償を課す。従来は無コストだったため、終盤に
  // 踏み倒すだけ（send）が全脚質・全地形で最適解になっていた（丘陵クライマーで勝率0%→54%等）。
  // 出力を上げれば脚は減る＝脚が残っている時にだけ決まる、という当たり前の駆け引きに戻す。
  // v46(#27): 持続を残脚に比例させる（脚が空なら飛び出しても続かない）。
  attack: (r) => {
    const g = legsLeft01(r);
    r.attackLeft = Math.round(ATTACK_MIN_TICKS + (BREAKAWAY_ATTACK_TICKS - ATTACK_MIN_TICKS) * g);
    r.committedBreak = true; r.conserveLeft = 0; r.holdOn = 0; r.energy -= 9;
  },
  // 🛡 脚を溜める：集団後方で牽かず消耗を抑える。勝負所に脚を残す堅実策
  // v47(第8弾Phase4): 500→260tickへ再較正（詳細は定数コメント参照）。
  conserve: (r) => { r.conserveLeft = CONSERVE_TICKS; r.attackLeft = 0; r.committedBreak = false; r.holdOn = 0; },
  // 🦴 食らいついて粘る：歯を食いしばって集団に残る（千切れにくい・脚を消費する）。食らいつく脚と好相性
  // v47(第8弾Phase4): keepThreshの緩和・持続を強化し、脚を消費する代償付きの手にした（詳細は定数コメント参照）。
  hangOn: (r) => { r.holdOn = HANGON_TICKS; r.conserveLeft = 50; r.attackLeft = 0; r.committedBreak = false; r.energy -= HANGON_ENERGY_COST; },
  // 🚴 流れに任せる：特別な動きはせず展開に乗る（基準の挙動）
  hold: (r) => { r.attackLeft = 0; r.committedBreak = false; r.conserveLeft = 0; r.holdOn = 0; },
  // 🔥 早駆け：ここから一気に踏んで抜け出し、そのままゴールまで踏み切る
  // 早駆けは"ゴール前の全開"であって長距離逃げではない。持続を短くし、committedBreakの
  // 地形割引も付けない（＝終盤に踏み倒すだけで勝てる状態を解消）。代償として脚を大きく使う。
  // v46(#27): 持続・追い込み量とも残脚に比例させる。売り切れた脚での早駆けは不発に終わる。
  send: (r) => {
    const g = legsLeft01(r);
    r.attackLeft = Math.round(SEND_MIN_TICKS + (SEND_MAX_TICKS - SEND_MIN_TICKS) * g);
    r.committedBreak = false;
    r.finaleSend = SEND_MIN_KICK + (SEND_MAX_KICK - SEND_MIN_KICK) * g;
    r.conserveLeft = 0; r.energy -= 17;
  },
  // ⏳ 差しにかける：最終直線まで脚を溜め、そこで鋭く伸びる（最終区間の追い込みを上乗せ）
  // v47(第8弾Phase4): 固定値0.09→残脚比例。脚を使い切っていれば差し脚も不発になる（詳細は定数コメント参照）。
  kick: (r) => { const g = legsLeft01(r); r.finaleSend = KICK_MIN + (KICK_MAX - KICK_MIN) * g; r.attackLeft = 0; r.committedBreak = false; r.conserveLeft = 0; },
  // 🗡 会心の差し脚：差し脚・豪脚型が最終直線で最大の切れ味を出す（追い込み最大）
  kickBig: (r) => { const g = legsLeft01(r); r.finaleSend = KICKBIG_MIN + (KICKBIG_MAX - KICKBIG_MIN) * g; r.attackLeft = 0; r.committedBreak = false; r.conserveLeft = 0; },
  // 🏁 スプリント勝負：集団のゴールスプリントに合わせ、番手をキープして最後に爆発させる
  sprintWait: (r) => { const g = legsLeft01(r); r.finaleSend = SPRINTWAIT_MIN + (SPRINTWAIT_MAX - SPRINTWAIT_MIN) * g; r.attackLeft = 0; r.committedBreak = false; r.conserveLeft = 0; },
  // v39.22(シーズン): 監督指示＝チーム全体を動かす一手。focusはエース、riders経由で僚友を働かせる。
  // 🛡 エースを守れ：僚友が風除け・位置取りを担い、エースは脚を温存できる（僚友は脚を使う）
  teamShelter: (r, riders) => {
    r.conserveLeft = 140; r.attackLeft = 0; r.committedBreak = false; r.holdOn = 0;
    if (riders) riders.forEach(o => { if (o !== r && o.team === r.team && !o.isAce) { o.energy -= 7; o.conserveLeft = 0; } });
  },
  // 🔥 総動員で追え：僚友が飛び出して前を追い、集団のペースを引き上げる（消耗は大きい）
  teamChase: (r, riders) => {
    r.conserveLeft = 90; r.attackLeft = 0; r.committedBreak = false;
    if (riders) riders.forEach(o => { if (o !== r && o.team === r.team && !o.isAce && o.energy > 30) { o.attackLeft = 22; o.committedBreak = true; o.energy -= 12; } });
  },
  // 🤝 エースを射出：アシストが自分の脚を使ってエースの最終スプリントを援護する（自分の順位は二の次）
  assistLaunch: (r, riders) => {
    r.conserveLeft = 25; r.attackLeft = 0; r.committedBreak = false; r.finaleSend = 0; r.holdOn = 0;
    const ace = riders && riders.find(o => o.team === r.team && o.isAce && o.id !== r.id);
    if (ace) { ace.finaleSend = Math.max(ace.finaleSend || 0, 0.06); ace.conserveLeft = Math.max(ace.conserveLeft || 0, 40); }
  },
};

// v39(A案): レースを途中tickから「フォーク」して再計算する。注目選手にプレイヤーの選択(moveId)を
// 適用し、fromTick以降の履歴（posHist等）と着順を作り直す。posHist[0..fromTick]はそのまま残るので、
// 観戦アニメは判断の瞬間から地続きに続く（＝選択が結果を変える）。再開時は進行中の一時的な戦闘状態を
// 一旦リセットし、fromTickから自然に再展開させる（履歴に残らないattackLeft等の持ち越しを防ぐ）。
// v39.18(バランス): 難易度で「判断の効き」を変える。上位難易度ほど同じ一手でも決まりにくく、
// 仕掛けどころの見極め（地形・脚質・脚の残り）がシビアになる＝難易度が判断の駆け引きにも効く。
export const MOVE_EFF_BY_DIFF = { easy: 1.15, normal: 1.0, hard: 0.82, oni: 0.66 };

export function resumeSim(sim, fromTick, focusId, moveId) {
  const riders = sim.entrants;
  riders.forEach(en => {
    en.attackLeft = 0;
    en.committedBreak = false;
    en.isLeadingOut = false;
    en.leadoutSurging = false;
    // 注目選手以外の判断由来の状態はリセット（assistLaunchでエースに付けた分は下で再適用される）
    if (en.id !== focusId) { en.conserveLeft = 0; en.finaleSend = 0; en.holdOn = 0; }
  });
  const focus = riders.find(en => en.id === focusId);
  if (focus && RACE_MOVES[moveId]) {
    RACE_MOVES[moveId](focus, riders);
    // 難易度に応じて一手の効き（アタック持続・追い込み量・温存量）をスケールする
    const eff = MOVE_EFF_BY_DIFF[sim.difficulty] ?? 1;
    if (eff !== 1) {
      if (focus.attackLeft > 0) focus.attackLeft = Math.max(6, Math.round(focus.attackLeft * eff));
      if (focus.finaleSend) focus.finaleSend *= eff;
      if (focus.conserveLeft > 0) focus.conserveLeft = Math.round(focus.conserveLeft * eff);
      if (focus.holdOn > 0) focus.holdOn = Math.round(focus.holdOn * eff);
      riders.forEach(en => { if (en !== focus && en.finaleSend) en.finaleSend *= eff; }); // アシストの射出も同様
    }
  }
  simulateTicks(sim.course, riders, fromTick, sim.directive || { chaseMode: "normal", aceEarly: false }, sim.groupMode === "solo");
  rankSim(sim);
  return sim;
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
      // v38(#1/改善): 大集団のゴールスプリントは数珠つなぎに伸びる。クラスタが大きいほど先頭から
      // 最後尾までの着差が広がる（最大14秒）。さらに後方ほど間延びする（frac^1.25）＝集団の頭は
      // 詰まり、後ろは千切れ気味に流れ込む現実的な着差にし、「全員が10秒以内」の団子感を緩和する。
      const spread = Math.min(14.0, 0.5 * (scored.length - 1));
      scored.forEach((s, k) => {
        const frac = scored.length > 1 ? k / (scored.length - 1) : 0;
        s.en.finishTime = baseTime + Math.pow(frac, 1.25) * spread;
      });
    }
    i = j;
  }
}

// v35(チームTT): チームタイムトライアル。集団の駆け引きではなく、チーム単位の合算タイムで競う。
// 独走(solo)主体＋平坦(flat)＋スタミナのTT地力を、人数(ローテ効率)・連携(ケミストリー)・
// 「必要人数までの底上げ」で1つのチーム時間に集約する。下位~1/3は千切れて捨てられる（完走はK名）。
// ＝速い選手を並べるだけでなく、弱点の無い層の厚さと連携が効く新フォーマット。
export function teamTTPower(r) {
  return (r.solo || 0) * 0.5 + (r.flat || 0) * 0.3 + (r.stamina || 0) * 0.2;
}
export function teamTTTime(riders, chemMul) {
  const n = riders.length;
  if (n === 0) return { time: 9999, power: 0, K: 0 };
  const powers = riders.map(teamTTPower).sort((a, b) => b - a);
  const K = Math.max(1, Math.round(n * 0.66)); // 完走に必要な人数（下位~1/3は千切れ可）
  const kth = powers[K - 1];
  const topAvg = powers.slice(0, K).reduce((a, b) => a + b, 0) / K;
  const support = (topAvg - kth) * 0.5;                 // 強力な牽引役が最後尾の必要人員を引き上げる
  const sizeBonus = Math.min(1.12, 1 + (n - 1) * 0.02); // 人数が多いほどローテ効率↑
  const chemBonus = 1 + (1 - (chemMul || 1));           // ケミストリー(0.92〜1.0)→連携ボーナス
  const power = (kth + support) * sizeBonus * chemBonus;
  // 現実的なチームTTタイム（~48〜54分帯に収め、強弱差は数分に）。基準75で±約9秒/power。
  const time = Math.max(2400, Math.round(3060 - (power - 75) * 9));
  return { time, power, K };
}
export function computeTeamTT(sim, playerChemMul) {
  const byTeam = {};
  sim.entrants.forEach(e => { (byTeam[e.team] = byTeam[e.team] || []).push(e); });
  const teams = Object.entries(byTeam).map(([team, riders]) => {
    const isPlayer = team === "PLAYER";
    const { time, K } = teamTTTime(riders, isPlayer ? playerChemMul : 1);
    const jitter = (Math.random() - 0.5) * 24; // ±12秒程度のばらつき
    return { team, teamName: riders[0].teamName || team, color: riders[0].color, isPlayer, time: Math.round(time + jitter), K, riders };
  });
  teams.sort((a, b) => a.time - b.time);
  teams.forEach((t, i) => { t.rank = i + 1; t.riders.forEach((r, j) => { r.finishTime = t.time + j * 0.05; }); });
  sim.teamTT = teams;
  return teams;
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
// v36修正: 千切れた選手を1点にクランプすると「10人が全員同タイム＝横一線ゴール」になり不自然だった。
// 上限を超えた後方集団を、順位を保ったまま細い帯(TAIL_BAND_MUL)へ圧縮し、各自に異なるタイムを残す。
export const TAIL_BAND_MUL = 0.12;

export function capExcessiveGaps(entrants) {
  if (entrants.length === 0) return;
  const finite = entrants.filter(e => Number.isFinite(e.finishTime));
  if (!finite.length) return;
  const winnerTime = Math.min(...finite.map(e => e.finishTime));
  const cap = winnerTime * MAX_GAP_MUL;
  const over = finite.filter(e => e.finishTime > cap);
  if (!over.length) return;
  const maxOver = Math.max(...over.map(e => e.finishTime));
  if (maxOver <= cap) return;
  const band = winnerTime * TAIL_BAND_MUL;
  // 元のタイム順（＝実力順）を保ったまま [cap, cap+band] に写像し、
  // さらに順序ごとの微小オフセットで完全な同タイム（横一線）を防ぐ。
  over.sort((a, b) => a.finishTime - b.finishTime);
  over.forEach((e, i) => {
    const frac = (e.finishTime - cap) / (maxOver - cap); // 0..1（順序保存）
    e.finishTime = cap + frac * band + i * 0.05;
  });
}

export function riderHash01(id, salt) { return ((id * 2654435761 + salt * 40503) % 100000) / 100000; }

// 選手ごとに位相・周波数をずらした周期的な横ゆらぎ（Math.random不使用・決定論的）。
// RaceView（集団の隊列）とBaseView（拠点の周回）の両方から使う汎用ヘルパーなので、
// JSXを持たないこの層（sim/）に置く（domain層からも参照できるようにするため）。
export function riderWander(id, salt, tSec, baseFreq) {
  const h1 = riderHash01(id, salt), h2 = riderHash01(id, salt + 1);
  const f1 = baseFreq * (0.6 + h1 * 0.8);
  const f2 = f1 * (1.7 + h2 * 0.6);
  return 0.65 * Math.sin(tSec * f1 * Math.PI * 2 + h1 * Math.PI * 2)
       + 0.35 * Math.sin(tSec * f2 * Math.PI * 2 + h2 * Math.PI * 2);
}
