// v50(第11弾Phase1・1-C/1-D): シーズンのチーム別ポイント算定（純関数のみ・JSX非依存）。
// 「順位表を実際のレース結果から積み上げる」ための共通ロジック。
import { mulberry } from "../../core/core.js";
import { GRADE_MUL, PTS } from "../../data/economy.js";

// v50(1-D・ユーザー判断): ポイントは「そのチームの上位10位以内の全選手の合算」。
// 従来は自チームも最上位1人分だけだったが、賞金(PRIZES)は既に全選手合算なので
// むしろ整合を取る変更。1つのランク済みリスト（sim.ranked相当・{team, rank}を持つ配列）から
// チームごとの合計を返す。teamキーは"PLAYER"（自チーム）も含む実際のチーム識別子をそのまま使う。
export function teamPointsFromRanked(ranked, grade, extraMul = 1) {
  const gradeMul = (GRADE_MUL[grade] || 1) * extraMul;
  const raw = {};
  (ranked || []).forEach(e => {
    if (!e.rank || e.rank > 10) return;
    raw[e.team] = (raw[e.team] || 0) + (PTS[e.rank - 1] || 0);
  });
  const out = {};
  Object.keys(raw).forEach(k => { out[k] = Math.round(raw[k] * gradeMul); });
  return out;
}

// v50(1-C): プレイヤーが出走しなかった登録レースを、登録チームのロースターだけで軽量決着する。
// マイライフのmlWorldRaceLite()と同じ考え方（baseline＋地形適性＋ノイズでスコアリング）のSeason版。
// squadN＝レースに出す人数の近似（実際の出走選手選抜とは独立の簡略値でよい）。
const LITE_SQUAD_N = 5;
export function resolveLiteTeamRace(teamNames, rosters, favors, grade, seed) {
  const rng = mulberry((seed >>> 0) || 1);
  const entrants = [];
  (teamNames || []).forEach(teamName => {
    const roster = (rosters && rosters[teamName]) || [];
    roster.slice(0, LITE_SQUAD_N).forEach(wr => {
      const typeMatch = (favors && wr.type === favors) ? 8 : 0;
      entrants.push({ team: teamName, score: (wr.baseline || 0) + typeMatch + (rng() - 0.5) * 14 });
    });
  });
  entrants.sort((a, b) => b.score - a.score);
  entrants.forEach((e, i) => { e.rank = i + 1; });
  return teamPointsFromRanked(entrants, grade);
}

// v50(1-C): rivalPointsオブジェクトへ加算した新オブジェクトを返す（純関数・破壊的変更なし）。
export function addRivalPoints(rivalPoints, delta) {
  const out = { ...(rivalPoints || {}) };
  Object.entries(delta || {}).forEach(([team, pts]) => {
    if (team === "PLAYER") return; // 自チームの得点はg.pointsが別途持つ
    out[team] = (out[team] || 0) + pts;
  });
  return out;
}
