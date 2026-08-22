// 血脈レシピ（順序を含む隠し配合、第15弾）。「血の印（bloodMarks）」の累積・旧セーブ互換の
// 導出・レシピの判定を扱う。breeding.jsとは別ファイル（breeding.jsは既に447行）。
import { ML_SPECIAL_MATINGS } from "../data/breeding.js";
import { legendArchetypeKey } from "./breeding.js";

// 血の印：各世代がどんな血だったかを { gen, mark } の配列として選手自身に累積させる。
// ancestorBloodIds（殿堂のbloodIdを引く方式）は殿堂を手動削除できるため祖先を辿れなくなり得るが、
// bloodMarksは選手自身が世代ごとに持ち歩くため殿堂の状態に依存しない。
// mark の形式：careerArchetypeKey（"world1"/"emperor"/"nearly"等）、または
// 特殊配合が成立していれば "sm:" + 特殊配合key（例："sm:absolute_king"）。

// 旧セーブ互換：bloodMarksを持たない既存の殿堂選手（第15弾より前に引退した選手）は、
// 既存フィールド（careerArchetypeKey/specialMatingTitle）からその場で導出する。
export function deriveBloodMarks(leg) {
  if (!leg) return [];
  if (Array.isArray(leg.bloodMarks) && leg.bloodMarks.length) return leg.bloodMarks;
  const marks = [];
  const key = legendArchetypeKey(leg);
  if (key) marks.push({ gen: leg.generation || 0, mark: key });
  if (leg.specialMatingTitle) {
    const sm = ML_SPECIAL_MATINGS.find(x => x.title === leg.specialMatingTitle);
    if (sm) marks.push({ gen: leg.generation || 0, mark: "sm:" + sm.key });
  }
  return marks;
}

// v52(第15弾B): 血脈レシピ本体。血の印の並び（世代を連番でたどるパターン）が揃うと成立する、
// 順序を含む隠し配合。
//
// 設計時の制約（実装して判明・devlog/wave15.mdの初期案から修正）：
// bloodMarksが記録するのは careerArchetypeKey と 特殊配合key（"sm:"）だけで、脚質(type)や
// 個別の特殊能力（二刀流="hybrid"・金特化した山の申し子="mount"等）は記録していない。
// 初期案のR2「かつ2代目がhybrid保持」・R4「gen3がmount金特を保持」は記録されていないデータへの
// 参照だったため実装できず、印の並びだけで判定できる条件へ差し替えた（R2は登坂系→平坦系の
// specialist連鎖のみに、R4はironman→specialist_CLMの連鎖を1代分伸ばして3代の登坂の血に）。
//
// パターンの各要素は文字列（単一markに一致）・文字列配列（いずれかに一致）・関数（mark文字列を
// 受け取り真偽を返す述語、"sm:"接頭辞の有無判定などに使う）のいずれか。
// 「順番」は連続する世代番号(gen, gen+1, gen+2, ...)への一致で表す。bloodMarksは両親双方の
// 履歴を合流させた1本の配列（厳密な家系ツリーではない）ため、たまたま別系統の印が同じ連番へ
// 並んで誤成立する可能性はゼロではないが、これは合流方式そのものが持つ既知の近似（設計時に
// 合意済み）として許容する。
const world1OrEmperor = ["world1", "emperor"];
const heroAny = ["hero", "heroMulti"];
const climbSpecialist = ["specialist_CLM", "specialist_PUN"];
const flatSpecialist = ["specialist_SPR", "specialist_RUL"];
const anySpecialMating = (mark) => typeof mark === "string" && mark.startsWith("sm:");

// abilityId: 成立時にdomain/mylife/createChar.jsが付与する伝説特能（data/abilities.js参照）。
// color: 称号表示用のアクセント色（現状のUI規約ではT.color.accentで代用するため未使用。
//   既存のML_SPECIAL_MATINGSのcolorフィールドと同じ位置づけ）。
// steps: 段階的ヒントUI（screens/mylife/create.jsx）が「何代目に何の血が必要か」を
//   一致した分だけ開示するための、世代ごとの人間可読ラベル。patternと同じ長さ・同じ順序。
export const ML_BLOOD_RECIPES = [
  {
    key: "revenge", title: "雪辱の血脈", depth: 2, abilityId: "revenant", color: "#ff6b6b",
    pattern: ["nearly", world1OrEmperor], steps: ["雪辱の血", "頂点の血"],
    note: "勝てなかった選手の無念を、その血を継いだ子が頂点で晴らす",
  },
  {
    key: "twin_edge", title: "二刀の血統", depth: 2, abilityId: "twinsoul", color: "#4fd1c5",
    pattern: [climbSpecialist, flatSpecialist], steps: ["登坂の血", "平坦の血"],
    note: "登坂と平坦、相反する才能が二代を経て一人に融合する",
  },
  {
    key: "three_gen", title: "三代の悲願", depth: 3, abilityId: "destiny", color: "#f6ad55",
    pattern: ["nearly", "nearly", "world1"], steps: ["雪辱の血", "雪辱の血", "頂点の血"],
    note: "二代続けて手が届かなかった頂点に、三代目がついに立つ",
  },
  {
    key: "iron_peak", title: "不落の山嶺", depth: 3, abilityId: "unfallen", color: "#a0aec0",
    pattern: ["ironman", "specialist_CLM", "specialist_CLM"], steps: ["鉄人の血", "登坂の血", "登坂の血"],
    note: "鉄の肉体の上に、三代にわたって山の血が積み重なる",
  },
  {
    key: "supremacy", title: "覇道極まれり", depth: 4, abilityId: "sovereign", color: "#ffd700",
    pattern: ["emperor", heroAny, "world1", anySpecialMating], steps: ["帝王の血", "英雄の血", "頂点の血", "特別な配合の血"],
    note: "帝王・英雄・世界の頂点、そして特別な血の交わりを経て覇道が極まる",
  },
];

function markMatches(want, mark) {
  if (typeof want === "function") return want(mark);
  if (Array.isArray(want)) return want.includes(mark);
  return want === mark;
}

// パターン全体が、何らかの開始世代baseから連番で揃っているかを調べる。
function chainPresentFrom(bloodMarks, pattern, base) {
  return pattern.every((want, i) => bloodMarks.some(m => m.gen === base + i && markMatches(want, m.mark)));
}

// 与えられたbloodMarksに対し、成立している血脈レシピを1件返す。未成立ならnull。
// 複数成立時（例：3代パターンR3が2代パターンR1の条件も部分的に満たす）は、
// より深い（pattern.length が長い＝より珍しい）レシピを優先する。同じ深さなら定義順。
export function matchBloodRecipe(bloodMarks, recipes = ML_BLOOD_RECIPES) {
  if (!Array.isArray(bloodMarks) || !bloodMarks.length) return null;
  const gens = [...new Set(bloodMarks.map(m => m.gen))];
  const matched = recipes.filter(r => gens.some(base => chainPresentFrom(bloodMarks, r.pattern, base)));
  if (!matched.length) return null;
  return matched.reduce((best, r) => (r.pattern.length > best.pattern.length ? r : best), matched[0]);
}

// 段階的ヒント用：各レシピについて「どこまで満たしているか」を返す。
// 戻り値: { recipe, bestBase, matchedCount, total } の配列（matchedCount>=1のレシピのみ）。
// bestBaseは最も長く連続一致した開始世代（表示側が「n代目まで一致」を出すのに使う）。
export function bloodRecipeProgress(bloodMarks, recipes = ML_BLOOD_RECIPES) {
  if (!Array.isArray(bloodMarks) || !bloodMarks.length) return [];
  const gens = [...new Set(bloodMarks.map(m => m.gen))];
  const out = [];
  for (const r of recipes) {
    let best = 0, bestBase = null;
    for (const base of gens) {
      let n = 0;
      while (n < r.pattern.length && bloodMarks.some(m => m.gen === base + n && markMatches(r.pattern[n], m.mark))) n++;
      if (n > best) { best = n; bestBase = base; }
    }
    if (best > 0) out.push({ recipe: r, bestBase, matchedCount: best, total: r.pattern.length });
  }
  return out;
}

// 段階的ヒントUI（screens/mylife/create.jsx・候補C「最有力1件のみ強調」）用：
// bloodRecipeProgress()の戻り値から、最も進んでいる1件を選ぶ。
// 優先順位：達成率(matchedCount/total)が高い → matchedCountが多い → ML_BLOOD_RECIPES定義順
//（Array.sortは安定ソートのため、同率はprogressの元の並び＝定義順がそのまま保たれる）。
export function bestBloodRecipeProgress(progress) {
  if (!Array.isArray(progress) || !progress.length) return null;
  return [...progress].sort((a, b) => {
    const ra = a.matchedCount / a.total, rb = b.matchedCount / b.total;
    if (rb !== ra) return rb - ra;
    return b.matchedCount - a.matchedCount;
  })[0];
}
