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
