// 第40弾（Phase 3）: バッジの使用量を「直近Nレースの露出率」(0..1)で測る純関数。
// devlog/wave40.mdの確定方針：①ウィンドウは直近Nレース②運依存（天候・古典）は対象外
// ③レース外の12種（体質。iron/recover/recover2/tough/glass/trainer/sponge/genius_sp/
//   lateblow_sp/lazy_sp/steady_sp/moody）はバッジではなく体質としてこの計装の対象外。
// ⚠️この弾では効果にもUIにも一切接続しない（計測のみ）。効果への接続はPhase 4で行う。
//
// 36種のうち、この弾で分類済みなのは「地形」8種・「展開・役割」2種のみ。残り26種
// （メンタル3・地形の古典3種・展開の残り・フィジカルの残り・配合限定5・血脈レシピ5）は
// 露出率の定義（何を"使用"とみなすか）が未決定のため、この弾ではnullを返す
// （devlog/wave40.md「残る判断」参照。後続弾で分類してから追加する）。
import { ASSIST_ROLES } from "../../core/core.js";

// id → 対象segType配列。露出率 = 直近Nレースのsegmix合計 ÷ 対象レース数（segMix欠落は除外）。
export const TERRAIN_EXPOSURE = {
  mount: ["climb", "mtn"],
  puncheur: ["hill"],
  flatlander: ["flat"],
  sprinter_sp: ["sprint"],
  soloist: ["tt"],
  allclimber: ["hill", "climb", "mtn"],
  climbengine: ["climb", "mtn"],
  heavy: ["climb", "mtn"], // bad特性だが同じ露出率の考え方で測れる
};

// id → 直近Nレースのうち、この役割で出走した割合。
export const ROLE_EXPOSURE = {
  escape: role => role === "breakaway",
  domestique: role => ASSIST_ROLES.has(role),
  rouleur: role => role === "breakaway", // GOLD_REQSの条件（逃げを打ち続けた鉄脚）に合わせた
};

// 直近N件（raceLog末尾からN件）を対象にする。旧セーブでsegMixが無いエントリは
// 地形系の分子・分母から除外する（無移行で保護。第36弾のコーチ実効Lvと同じ方針）。
export function badgeExposure(player, id, n = 10) {
  const log = (player && player.raceLog) || [];
  if (log.length === 0) return null;
  const window = log.slice(-n);

  const terrainSegs = TERRAIN_EXPOSURE[id];
  if (terrainSegs) {
    const withMix = window.filter(e => e.segMix);
    if (withMix.length === 0) return null;
    const sum = withMix.reduce((a, e) => a + terrainSegs.reduce((s, seg) => s + (e.segMix[seg] || 0), 0), 0);
    return sum / withMix.length;
  }

  const rolePred = ROLE_EXPOSURE[id];
  if (rolePred) {
    const hits = window.filter(e => rolePred(e.role)).length;
    return hits / window.length;
  }

  return null; // 未分類（後続弾で追加）
}
