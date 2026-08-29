// レースの能力計算（天候・モニュメント適性・実戦値・地形別能力）。sim/race.jsから分離（第16弾D）。
import { AB_KEYS, TYPES } from "../data/abilities.js";
import { badgeTier, condMul, hasAbility, hasGoldAbility, tierValue } from "../core/core.js";
import { ML_PART_LV_MUL } from "../data/gear.js";
import { PART_SLOTS, resolvePart } from "../data/parts.js";
import { climbWeightFor } from "./course.js";

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
  // 第17弾：石畳タイヤの石畳ボーナスはmonumentMulと同じ乗算枠に合流させる（乗算なので初期値1）
  let paveMulExtra = 1;
  if (r.parts) {
    PART_SLOTS.forEach(slot => {
      const pid = r.parts[slot];
      const p = pid && resolvePart(r.customParts, pid);
      if (!p) return;
      // v51(第12弾12-B): マイライフ限定のパーツ強化Lv（Season選手はr.partLvが存在せず常に0＝無影響）
      const lv = (r.partLv && r.partLv[slot]) || 0;
      const mul = 1 + ML_PART_LV_MUL * lv;
      Object.entries(p.ab).forEach(([k, v]) => { e[k] += v * mul; });
      // 第17弾：天候・地形の条件付き効果（強化Lvはかけない＝マイナスが深くなるのを防ぐ）
      if (weather !== "rain" && p.dry) Object.entries(p.dry).forEach(([k, v]) => { e[k] += v; });
      if (weather === "heat" && p.heat && p.heat.stamina) e.stamina += p.heat.stamina;
      if (monument === "pave" && p.pave) paveMulExtra *= p.pave.mul;
      if (monument !== "pave" && p.offPave) Object.entries(p.offPave).forEach(([k, v]) => { e[k] += v; });
    });
  }
  // v28: 大舞台適性。big=★3で+6%、nervous(悪特性)=★3で-5%
  // v29: メンタルも★3で能力に反映（±約8%）。特性big/nervousと重ねる
  const mental = r.mental ?? 50;
  const mentalBig = grade === 3 ? 1 + (mental - 50) / 600 : 1;
  // v37(第2弾): 大舞台の申し子＝★3/★4で+7%（世界選手権・五輪でも発揮）。既存bigは★3のみ+6%。
  // 第45弾: 4段階化（銅1.07/銀1.085/金1.10/虹1.12）。
  const bigheartMul = (grade >= 3 && hasAbility(r, "bigheart")) ? tierValue(1.07, 1.10, badgeTier(r, "bigheart")) : 1;
  const bigMul = (grade === 3 ? (hasAbility(r, "big") ? 1.06 : hasAbility(r, "nervous") ? 0.95 : 1) : 1) * mentalBig * bigheartMul;
  // 第17弾：雨天用タイヤ／シーズンの雨仕様セットアップは雨ペナルティを緩和する
  // （最大でも0.99止まり＝雨のマイナスを完全には消さない）
  let wMul = rainMul(r, weather);
  if (weather === "rain") {
    let shift = 0;
    const tirePid = r.parts && r.parts.tire;
    const tirePart = tirePid && resolvePart(r.customParts, tirePid);
    if (tirePart && tirePart.rain) shift += tirePart.rain.mulShift;
    if (itemBoost && itemBoost.setup === "rain") shift += 0.04;
    if (shift > 0) wMul = Math.min(0.99, wMul + shift);
  }
  const mMul = monumentMul(r, monument) * paveMulExtra; // v34(C-2): 古典適性（石畳巧者）＋第17弾の石畳タイヤ
  // 第15弾: 血脈レシピ「宿願成就」は大舞台（★3以上）でさらに能力+5%
  const destinyMul = (grade >= 3 && hasAbility(r, "destiny")) ? 1.05 : 1;
  AB_KEYS.forEach(k => { e[k] = e[k] * cm * fatPen * bigMul * wMul * formMul * mMul * destinyMul; });
  // v28: オールラウンダーは全能力を控えめに底上げ（脚質を選ばない万能型）
  // 第45弾: 4段階化（銅+2/銀+3/金+4/虹+5.5）。
  if (hasAbility(r, "allrounder_sp")) { const v = tierValue(2, 4, badgeTier(r, "allrounder_sp")); AB_KEYS.forEach(k => { e[k] += v; }); }
  // v31.2: 配合限定特能。系統の申し子＝全能力+3、覇道の血脈＝全能力+2かつスタミナ+3
  if (hasAbility(r, "sireline")) AB_KEYS.forEach(k => { e[k] += 3; });
  if (hasAbility(r, "dynasty")) { AB_KEYS.forEach(k => { e[k] += 2; }); e.stamina += 3; }
  // v35(バランス): 二刀流（配合限定）は従来 segmentAbility の丘/登/山/スプに+5だけで、
  // 決着（finishAbilityは素のclimb/sprint参照）や平坦に届かず、+3全能力の系統の申子に見劣りしていた。
  // 二本柱である登坂とスプリントの素地を底上げ（+2/+2）し、フィニッシュにも効く二刀流に。
  if (hasAbility(r, "hybrid")) { e.climb += 2; e.sprint += 2; }
  // 第15弾: 血脈レシピ達成の伝説特能（配合限定のさらに上位）。全能力への一律上乗せ分
  if (hasAbility(r, "revenant")) AB_KEYS.forEach(k => { e[k] += 4; });
  if (hasAbility(r, "twinsoul")) AB_KEYS.forEach(k => { e[k] += 3; });
  if (hasAbility(r, "destiny")) AB_KEYS.forEach(k => { e[k] += 5; });
  if (hasAbility(r, "unfallen")) AB_KEYS.forEach(k => { e[k] += 4; });
  if (hasAbility(r, "sovereign")) AB_KEYS.forEach(k => { e[k] += 6; });
  // v29: 体格（パワーウェイト）。軽いほど登坂有利・重いほど平坦/独走有利
  const build = r.build ?? 50;
  e.climb *= 1 + (50 - build) / 300;
  e.flat *= 1 + (build - 50) / 350;
  e.solo *= 1 + (build - 50) / 450;
  e.flat *= (1 + equip.frame * 0.06) * (itemBoost.suit ? 1.15 : 1);
  e.climb *= (1 + equip.wheels * 0.06) * (itemBoost.wheel ? 1.15 : 1);
  // 第17弾：シーズンのレース前「機材セットアップ」選択（無料・ChipRow）。標準/雨/冷却は
  // ここでは能力に影響しない（雨仕様の効果は上のwMul、冷却仕様はレース後の疲労軽減のみ）
  if (itemBoost && itemBoost.setup === "light") { e.climb *= 1.05; e.flat *= 0.97; }
  else if (itemBoost && itemBoost.setup === "aero") { e.flat *= 1.05; e.climb *= 0.97; }
  // v29バグ修正: 万一いずれかの能力値が欠損（旧セーブ等でundefined）していると
  // NaNがシミュレーション全体（finishTime等）に伝播し、最終的にレース描画がクラッシュして
  // 画面が真っ暗になる恐れがあった。非有限値は安全な既定値(50)に丸めて必ず有限にする
  AB_KEYS.forEach(k => { e[k] = Number.isFinite(e[k]) ? Math.min(135, e[k]) : 50; });
  // 第48弾バグ修正: goldAbilitiesしかコピーしておらず、badgeTier(e,id)がエントラント上では
  // 銀→銅・虹→金に潰れていた（4段階化した16種のうち区間補正で参照する16種が対象。
  // 大舞台の申し子/オールラウンダー/吸収の天才は選手オブジェクト(r)を直接見るため無事だった）。
  e.type = r.type; e.abilities = r.abilities; e.goldAbilities = r.goldAbilities;
  e.silverAbilities = r.silverAbilities; e.rainbowAbilities = r.rainbowAbilities;
  // v29: 副ステータスをエントラントにも持たせ、tick計算・最終区間で参照する
  e.accel = r.accel ?? 50; e.mental = mental; e.build = build;
  // v52(第14弾C): 安定感（stability）をsimへ接続。TTのペース配分ゆらぎ（ttPacing）の
  // 振れ幅を選手ごとに調整するために使う（simulateTicks参照）。
  e.stability = r.stability ?? 50;
  return e;
}

export function typeAffinityBonus(type, segType) {
  return (TYPES[type]?.affinity?.[segType]) || 0;
}

// 第50弾: バッジ由来の区間別ボーナスだけを切り出した（地形の基礎値・脚質相性は含まない）。
// segmentAbility()に合流させるのはもちろん、sim/finish.jsのfinishAbility()（僅差ゴール集団の
// 決着）にも同じ値を合流させる——決着ロジックが素の能力しか見ておらずバッジを無視していた
// 断絶を塞ぐための切り出し（devlog/wave50.md参照）。計算は必ずここ1箇所に保つ。
export function badgeSegmentBonus(segType, e) {
  let ab = 0;
  // v15: 特殊能力による区間タイプ別の能力補正（第45弾: 銅/銀/金/虹の4段階）
  if (hasAbility(e, "mount") && ["climb", "mtn"].includes(segType)) ab += tierValue(4, 8, badgeTier(e, "mount"));
  if (hasAbility(e, "puncheur") && segType === "hill") ab += tierValue(4, 8, badgeTier(e, "puncheur"));
  if (hasAbility(e, "flatlander") && segType === "flat") ab += tierValue(4, 8, badgeTier(e, "flatlander"));
  if (hasAbility(e, "sprinter_sp") && segType === "sprint") ab += tierValue(4, 8, badgeTier(e, "sprinter_sp"));
  if (hasAbility(e, "soloist") && segType === "tt") ab += tierValue(4, 8, badgeTier(e, "soloist"));
  if (hasAbility(e, "closer") && (segType === "sprint" || segType === "mtn")) ab += tierValue(4, 8, badgeTier(e, "closer"));
  // v31.2: 配合限定「二刀流」。丘陵・山岳・スプリントの各区間で+5（登坂型とスプリント型の血を併せ持つ証）
  if (hasAbility(e, "hybrid") && ["hill", "climb", "mtn", "sprint"].includes(segType)) ab += 5;
  // 第15弾: 血脈レシピ達成の伝説特能。万能の極致(twinsoul)＝全地形+4（二刀流の対象地形を拡張した上位互換）、
  // 不落の血(unfallen)＝登坂・山岳特化+6、絶対王者の血(sovereign)＝全地形+5
  if (hasAbility(e, "twinsoul")) ab += 4;
  if (hasAbility(e, "unfallen") && ["climb", "mtn"].includes(segType)) ab += 6;
  if (hasAbility(e, "sovereign")) ab += 5;
  // v37(第2弾): 岳人＝丘/登/山で+4、重量級（悪特性）＝登/山で-4（第45弾: 4段階化）
  if (hasAbility(e, "allclimber") && ["hill", "climb", "mtn"].includes(segType)) ab += tierValue(4, 8, badgeTier(e, "allclimber"));
  if (hasAbility(e, "heavy") && ["climb", "mtn"].includes(segType)) ab -= 4;
  return ab;
}

export function segmentAbility(segType, e, steepness) {
  let ab;
  if (segType === "sprint") ab = e.sprint;
  else if (segType === "tt") ab = e.solo * 0.6 + e.flat * 0.4;
  else if (segType === "mtn") ab = e.climb * 0.7 + e.sprint * 0.3;
  else { const w = climbWeightFor(segType, steepness); ab = e.flat * (1 - w) + e.climb * w; }
  ab += typeAffinityBonus(e.type, segType);
  ab += badgeSegmentBonus(segType, e);
  return ab;
}
