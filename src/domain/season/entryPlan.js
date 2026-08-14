// v50(第11弾Phase1・1-B): AIチームの「その月どのレースに出るか」を決める出走登録。
// JSX/React非依存の純関数のみ（Node単体テスト可能）。domain/season/standings.js・
// logic/support.js（buildSim）・controllers/season/month.jsから使われる。
//
// 設計意図（devlog/wave11.md参照）：ユーザーの要望「一つのレースに全チームが集結するのは
// あんまり。競合を避けて星1のレースで表彰台独占を狙う戦略があっても面白い」を受け、
// 明示のルールとして書くのではなく「強いチームから順に、混雑度を見ながら最良のレースを選ぶ」
// 逐次選択の副産物として創発させる。強豪が★3に集まれば、後から選ぶ弱小チームには
// ★1が空いて見えるので自然にそちらへ流れる。
import { mulberry } from "../../core/core.js";
import { GRADE_MUL } from "../../data/economy.js";

// チームの「地力」＝ロースター上位選手のbaseline合計（squadの厚みをざっくり近似）。
// 出走登録はレースごとの実際のsquad選抜とは独立の大まかな指標でよい。
const STRENGTH_TOP_N = 6;
function teamStrength(rosters, teamName) {
  const roster = (rosters && rosters[teamName]) || [];
  return roster.slice(0, STRENGTH_TOP_N).reduce((sum, r) => sum + (r.baseline || 0), 0);
}

// v50: raceEntryPlan(races, teams, classIdx, rosters, year, month)
// → { [raceId]: [teamName, ...] }（各チームは必ずどこか1レースに登録される＝AIも月1戦）
// year・monthからのみシードする決定論的な関数（Date.now()等は使わない）。
// プレイヤーが選ぶ前に確定し、選んだ後も動かないことがこの遊びの前提。
export function raceEntryPlan(races, teams, classIdx, rosters, year, month) {
  const plan = {};
  const eligibleRaces = (races || []).filter(r => r.cls === classIdx && !r.locked);
  if (eligibleRaces.length === 0 || !teams || teams.length === 0) return plan;
  eligibleRaces.forEach(r => { plan[r.id] = []; });

  const rng = mulberry(((year || 1) * 1009 + (month || 0) * 97 + 3001) >>> 0);
  // 強さで降順ソート。同点はシードした揺らぎでタイブレークする（毎回同じ結果になるよう
  // 揺らぎ自体もyear+monthからのみ決まる決定論的な値）。
  const ordered = teams
    .map(t => ({ team: t, strength: teamStrength(rosters, t.name) + rng() * 0.01 }))
    .sort((a, b) => b.strength - a.strength);

  const congestion = {}; // raceId -> 既に登録済みチームの地力合計
  eligibleRaces.forEach(r => { congestion[r.id] = 0; });

  // v50: 混雑度の割り算定数（実測で較正・scratchpad/entryplan_tune.mjs）。40だと弱すぎて
  // グレード3のレースに半数超が居座り続けた。10にすると平均最大クラスターが9チーム中4.7に
  // 収まり、格上を避けて空いているレースへ流れる挙動が実際に出る。
  const CONGESTION_DIVISOR = 10;
  ordered.forEach(({ team, strength }) => {
    let bestRace = null, bestScore = -Infinity;
    eligibleRaces.forEach(r => {
      const gradeMul = GRADE_MUL[r.grade] || 1;
      const specMatch = (team.spec && r.tmpl && r.tmpl.favors === team.spec) ? 1.4 : 1.0;
      const score = (gradeMul * specMatch) / (1 + congestion[r.id] / CONGESTION_DIVISOR);
      if (score > bestScore) { bestScore = score; bestRace = r; }
    });
    if (!bestRace) return;
    plan[bestRace.id].push(team.name);
    congestion[bestRace.id] += Math.max(0, strength);
  });

  return plan;
}
