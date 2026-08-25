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
//
// 第42弾（Phase 4）: 露出率を「0=無頓着 / 1=狙い続けた」の同じ尺度へ正規化し、
// 段階（金/銅）を実績（天井）×正規化スコア（現在値）で決める。devlog/wave42.md参照。
import { ASSIST_ROLES, hasGoldAbility } from "../../core/core.js";
import { SEG_LABEL } from "../../data/course.js";

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
// 第42弾: デフォルトを10→8に変更（devlog/wave42.mdの実測で確定した確定ウィンドウ幅）。
export function badgeExposure(player, id, n = 8) {
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

// 第42弾: base=無頓着に選んだ時の平均露出率、target=そのバッジを狙って選び続けた時の平均露出率。
// 12年×3クラス、N=8窓を全時点でサンプリングして実測（devlog/wave42.md）。
// ⚠️TEMPLATESや候補数（mlGenRaceCandidates）を変えたらこの表を測り直すこと。
// ⚠️heavyはbad特性でGOLD_REQSに金条件が存在しない（「金に戻る」が成立しない）ため、
// 段階制（このEXPOSURE_NORM）には含めない。TERRAIN_EXPOSUREでの露出計測自体は据え置く。
export const EXPOSURE_NORM = {
  mount:       { base: 0.234, target: 0.501 },
  puncheur:    { base: 0.236, target: 0.372 },
  flatlander:  { base: 0.358, target: 0.558 },
  sprinter_sp: { base: 0.057, target: 0.091 },
  soloist:     { base: 0.116, target: 0.327 },
  allclimber:  { base: 0.469, target: 0.710 },
  climbengine: { base: 0.234, target: 0.501 },
  // 役割系。作戦で完全に選べる（early=逃げ／assist=アシスト）。
  // escape/rouleurはresult.jsのbreakawayChosen修正が前提（修正前はroleがbreakawayにならず常に0）。
  escape:      { base: 0.000, target: 1.000 },
  rouleur:     { base: 0.000, target: 1.000 },
  // domestiqueは監督指示由来のsupport/experienceも数えるため無頓着でも0.489出る（実測・仕様どおり）。
  domestique:  { base: 0.489, target: 1.000 },
};

// 「0=無頓着 / 1=狙い続けた」の正規化スコア。EXPOSURE_NORM未定義（未分類・heavy含む）はnull。
export function badgeExposureScore(player, id, n = 8) {
  const norm = EXPOSURE_NORM[id];
  if (!norm) return null;
  const raw = badgeExposure(player, id, n);
  if (raw === null) return null;
  const { base, target } = norm;
  return Math.max(0, Math.min(1, (raw - base) / (target - base)));
}

// 段階（"金"|"銅"）＝実績（天井・r.goldAbilitiesに一度入ったら消えない）× 現在の正規化スコア>=0.5。
// EXPOSURE_NORM未定義のバッジ（体質12種・heavy・後続弾で分類予定の残り）は従来どおり実績のみで判定する。
export function badgeTier(player, id, n = 8) {
  if (!hasGoldAbility(player, id)) return "銅";
  const norm = EXPOSURE_NORM[id];
  if (!norm) return "金";
  const score = badgeExposureScore(player, id, n);
  return (score !== null && score >= 0.5) ? "金" : "銅";
}

// プレイヤーの実際のシミュレーション反映用: goldAbilitiesのうち「現在も金として発火させてよいもの」
// だけへ絞り込む。段階制の対象外（EXPOSURE_NORM未定義）の種はそのまま残す＝従来どおり永続金。
// AI・ライバル・レジェンドには適用しない（Phase 6でAIにも段階を配るまでの意図的な据え置き）。
export function liveGoldAbilities(player) {
  const all = (player && player.goldAbilities) || [];
  return all.filter(id => badgeTier(player, id) === "金");
}

// 地形系badgeの表示地形名（既存語彙のSEG_LABELをそのまま使う。山頂フィニッシュは山岳へ畳む）。
function terrainLabelFor(id) {
  const segs = TERRAIN_EXPOSURE[id];
  if (!segs) return null;
  const order = [];
  segs.forEach(seg => {
    const key = seg === "mtn" ? "climb" : seg;
    if (!order.includes(key)) order.push(key);
  });
  return order.map(k => SEG_LABEL[k]).join("・");
}

// 役割系badgeの表示名（既存のML_TACTICS表記に合わせる：早めに逃げる＝逃げ、アシストに徹する＝アシスト）。
const ROLE_LABEL = { escape: "逃げ", domestique: "アシスト", rouleur: "逃げ" };

// 「金に戻るまで {地形/役割} あと{n}回」のUI文言に使う地形/役割名。未対応idはnull。
export function badgeReturnLabel(id) {
  return terrainLabelFor(id) || ROLE_LABEL[id] || null;
}

// 状態C（実績は満たしているが現在の窓ではscore<0.5）専用: 現在の直近N件のうち、対象外の
// レースを「その地形/役割に100%該当するレース」へ古い順ではなく寄与の低い順に1件ずつ
// 置き換えるシミュレーションを行い、score>=0.5へ到達するのに必要な最小の置き換え回数を返す。
// 寄与が低い順に置き換えるのは、線形な合計しきい値に対して常に最少手数になるため（貪欲法が最適）。
// 既にscore>=0.5なら0。地形/役割どちらの窓も揃わない（データ不足）場合はnull。
export function swapsToRestoreGold(player, id, n = 8) {
  const norm = EXPOSURE_NORM[id];
  if (!norm) return null;
  const log = (player && player.raceLog) || [];
  if (log.length === 0) return null;
  const window = log.slice(-n);
  const { base, target } = norm;
  const scoreOf = raw => Math.max(0, Math.min(1, (raw - base) / (target - base)));

  const terrainSegs = TERRAIN_EXPOSURE[id];
  if (terrainSegs) {
    const withMix = window.filter(e => e.segMix);
    if (withMix.length === 0) return null;
    const contribs = withMix.map(e => terrainSegs.reduce((s, seg) => s + (e.segMix[seg] || 0), 0)).sort((a, b) => a - b);
    let sum = contribs.reduce((a, c) => a + c, 0);
    if (scoreOf(sum / contribs.length) >= 0.5) return 0;
    for (let i = 0; i < contribs.length; i++) {
      sum += 1 - contribs[i];
      if (scoreOf(sum / contribs.length) >= 0.5) return i + 1;
    }
    return contribs.length;
  }

  const rolePred = ROLE_EXPOSURE[id];
  if (rolePred) {
    const hits = window.map(e => (rolePred(e.role) ? 1 : 0));
    let sum = hits.reduce((a, c) => a + c, 0);
    if (scoreOf(sum / hits.length) >= 0.5) return 0;
    const misses = hits.filter(h => h === 0).length;
    for (let i = 1; i <= misses; i++) {
      sum += 1;
      if (scoreOf(sum / hits.length) >= 0.5) return i;
    }
    return misses;
  }

  return null;
}
