// 移籍市場の純ロジック（生成器）。Phase 4-1後の state.js/logic/support.js から分離（Step5: domain抽出）。
// レジェンド招聘・引き抜き（攻め/受け）・FA市場・トレード。main.jsx のハンドラ（controllers相当）から呼ばれる。
import { mulberry, newRider, overall, ridState } from "../../core/core.js";
import { CLASSES } from "../../data/progression.js";
import { RIVAL_TEAMS } from "../../data/teams.js";

// v38(#9 A-2): 引退した殿堂選手（マイライフで育てた名選手）を、シーズンの自チームの選手として
// 迎え入れるためのブリッジ。最終能力から少し衰えた（全盛期を過ぎて加入する）ベテランとして生成し、
// 名前・脚質・特能・二つ名を引き継ぐ。「選手として育てた英雄を、監督として率いる」A案の核心ループ。
export function legendToSeasonRider(leg) {
  if (!leg || !leg.finalAbilities) return null;
  const fa = leg.finalAbilities, fs = leg.finalSubStats || {};
  const decay = 0.94; // 全盛期をやや過ぎて加入
  const r = {
    id: ridState.value++, name: leg.name, type: leg.type || "RUL",
    flat: Math.round((fa.flat || 60) * decay), climb: Math.round((fa.climb || 60) * decay),
    sprint: Math.round((fa.sprint || 60) * decay), stamina: Math.round((fa.stamina || 60) * decay),
    solo: Math.round((fa.solo || 60) * decay),
    accel: Math.round((fs.accel ?? 55) * decay), build: fs.build ?? 55, mental: Math.round((fs.mental ?? 58)),
    age: 31, growth: "normal", growthPow: leg.growthPow || "B",
    abilities: [...(leg.specialAbilities || [])], goldAbilities: [], personality: "normal",
    fatigue: 20, cond: 3, condForecast: 0, injury: 0, streak: 0,
    focus: "flat", joinOvr: 0, parts: { frame: null, tire: null, wheels: null, nutrition: null },
    raceLog: [], favorite: true, tenure: 0,
    isLegendRecruit: true, legendNickname: leg.nickname || null, lineageName: leg.lineageName || null,
  };
  r.joinOvr = overall(r);
  return r;
}

// ── v41 移籍市場の駆け引き（引き抜き）─────────────────────────────
// 世界ロースターの選手は baseline 方式（実能力を持たない）。buildSim の相手生成と同じ電力式
// （power = 52 + classIdx*9 + baseline）で newRider を回して実能力へ実体化する。identity（名前・脚質・
// 特性）は元選手のものを維持。引き抜き成功時にプレイヤーのロースターへ加える1名を作る。
export function worldRiderToRosterRider(wr, classIdx, seed) {
  const rng = mulberry((seed >>> 0) || 1);
  const power = 52 + classIdx * 9 + (wr.baseline || 0);
  const r = newRider(power, rng, { type: wr.type, age: wr.age });
  r.name = wr.name; r.type = wr.type;
  r.personality = wr.personality || r.personality;
  if (wr.abilities) r.abilities = [...wr.abilities];
  r.goldAbilities = [...(wr.goldAbilities || [])];
  r.growthPow = wr.growthPow || r.growthPow;
  if (wr.age != null) r.age = wr.age;
  r.favorite = false; r.tenure = 0; r.fatigue = 20; r.cond = 3;
  r.joinOvr = overall(r);
  return r;
}

// 引き抜き先候補の意欲（＝引き抜き料の係数）。決定論的にラベルと倍率を返す。
const POACH_WILLINGNESS = [
  { key: "eager", label: "移籍に前向き", mul: 0.8 },
  { key: "neutral", label: "標準", mul: 1.0 },
  { key: "banner", label: "チームの看板", mul: 1.45 },
];

// v41: 各ライバルチームの主力（baseline最上位）を引き抜き市場の候補として生成する。
// 年に一度（初期化・年度末）だけ更新して顔ぶれを固定＝「今年狙う相手」を腰を据えて選べる。
// 返り値：[{ id, wrId, team, teamColor, willLabel, candidate(実体化済み選手), fee }]
export function genPoachTargets(classIdx, year, seed, rivalRosters, teams = RIVAL_TEAMS) {
  if (!rivalRosters) return [];
  const rng = mulberry((seed >>> 0) || 7);
  const out = [];
  teams.forEach((d, ti) => {
    const roster = rivalRosters[d.name];
    if (!roster || roster.length === 0) return;
    // チームの主力（baseline最上位＝エース）を候補に
    const wr = [...roster].sort((a, b) => (b.baseline || 0) - (a.baseline || 0))[0];
    if (!wr) return;
    const will = POACH_WILLINGNESS[Math.floor(rng() * POACH_WILLINGNESS.length)];
    const candidate = worldRiderToRosterRider(wr, classIdx, (wr.id * 2654435761) ^ (year * 40503));
    const ovr = overall(candidate);
    // 引き抜き料：概算OVRに比例＋意欲係数。FA（overall*1.6）より高い＝主力強奪はコスト大。
    const fee = Math.max(60, Math.round(ovr * 3.4 * will.mul * CLASSES[classIdx].prizeMul));
    out.push({ id: `poach-${wr.id}-${year}`, wrId: wr.id, team: d.name, teamColor: d.color, willLabel: will.label, candidate, fee });
  });
  out.sort((a, b) => overall(b.candidate) - overall(a.candidate));
  return out;
}

// v41: 被引き抜き（ライバルが自チームの主力を引き抜きに来る）オファーを1件組む。
// 対象＝キャプテン以外・健康・OVR最上位の主力。移籍金（受け取れる額）と引き止め費用を返す。
// 返り値：null（対象なし）or { riderId, name, ovr, team, teamColor, fee, retainCost }
export function makePoachOffer(g, rng) {
  const eligible = (g.roster || []).filter(r => r.injury === 0 && r.id !== g.captainId);
  if (eligible.length < 2) return null; // ロースターが薄い時は来ない（放出で崩壊させない）
  const star = eligible.sort((a, b) => overall(b) - overall(a))[0];
  const ovr = overall(star);
  if (ovr < 66) return null; // 主力級のみが引き抜き対象
  const team = RIVAL_TEAMS[Math.floor(rng() * RIVAL_TEAMS.length)];
  // 移籍金＝主力を手放す見返り（FA購入相当＋強奪プレミアム）。引き止め費用はその約4割。
  const fee = Math.max(80, Math.round(ovr * 3.0 * CLASSES[g.classIdx].prizeMul));
  const retainCost = Math.max(30, Math.round(fee * 0.4));
  return { riderId: star.id, name: star.name, ovr, team: team.name, teamColor: team.color, fee, retainCost };
}

export const FA_POOL_COUNT_BY_CLASS = [4, 5, 7];

export function genFaPool(classIdx, seed, existingNames) {
  const rng = mulberry(seed);
  const base = CLASSES[classIdx].scout;
  const count = FA_POOL_COUNT_BY_CLASS[classIdx];
  const nameBanned = new Set(existingNames || []);
  const out = [];
  for (let i = 0; i < count; i++) {
    const age = 23 + Math.floor(rng() * 8); // 23〜30歳
    const mul = 0.85 + rng() * 0.45; // 新人スカウトよりブレ幅を広く（即戦力〜掘り出し物まで）
    const r = newRider(base * mul, rng, { age, banned: nameBanned });
    const ageFactor = age <= 25 ? 1.2 : age <= 28 ? 1.0 : age <= 30 ? 0.85 : 0.65;
    const price = Math.max(20, Math.round(overall(r) * 1.6 * ageFactor));
    out.push({ rider: r, age, price });
  }
  return out;
}

export function genTradeOffers(classIdx, seed, roster) {
  if (!roster || roster.length <= 1) return [];
  const rng = mulberry(seed);
  const base = CLASSES[classIdx].scout;
  const nameBanned = new Set(roster.map(r => r.name));
  const wanted = [...roster].sort(() => rng() - 0.5).slice(0, Math.min(2, roster.length));
  return wanted.map(r => {
    const team = RIVAL_TEAMS[Math.floor(rng() * RIVAL_TEAMS.length)];
    const power = Math.max(base * 0.6, overall(r) + (rng() - 0.5) * 12);
    const offeredRider = newRider(power, rng, { banned: nameBanned });
    return { id: `trade-${r.id}-${Math.floor(rng() * 999999)}`, team: team.name, teamColor: team.color, wantRiderId: r.id, offeredRider };
  });
}

export function computePickupChance(r) {
  const ovr = overall(r);
  let chance = 0.05;
  if (ovr >= 75) chance += 0.5;
  else if (ovr >= 65) chance += 0.25;
  else if (ovr >= 55) chance += 0.1;
  if (r.growthPow === "S") chance += 0.3;
  else if (r.growthPow === "A") chance += 0.15;
  if (r.prodigy) chance += 0.2;
  return Math.min(0.9, chance);
}
