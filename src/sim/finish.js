// レースの決着処理（判断カードの再計算・フィニッシュクラスタ・チームTT・順位確定）。
// sim/race.jsから分離（第16弾D）。
import { RACE_MOVES, TICK_SEC, capExcessiveGaps, simulateTicks } from "./ticks.js";

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


