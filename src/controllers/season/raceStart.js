// レース開始（startRace/startNextStage）の入力組み立てのみを抽出した純関数。Step7第5弾。
// 注意：ロック（stage2LockRef）・setTimeout・setGのupdater内でのsimResult/raceRef密輸・
// buildSim自体（Date.now()シードのRNGを内包）には一切触れていない（v12でstale closureバグを
// 実際に踏んだ箇所のため、案A＝確実にテスト可能な部分だけを切り出す方針。詳細はDEVLOG §9参照）。
import { HOME_ABILITY_BONUS } from "../../data/course.js";
import { raceIsHome } from "../../logic/support.js";

// v28: ホームアドバンテージ。地元開催なら出走選手の全能力に小ボーナス（元のroster配列は不変）
export function prepareRaceInputs(race, roster, sel, homeRegion) {
  const squadRaw = roster.filter(r => sel.starters.includes(r.id));
  const isHome = raceIsHome(race, homeRegion);
  const squad = isHome
    ? squadRaw.map(r => ({ ...r, flat: r.flat + HOME_ABILITY_BONUS, climb: r.climb + HOME_ABILITY_BONUS, sprint: r.sprint + HOME_ABILITY_BONUS, stamina: r.stamina + HOME_ABILITY_BONUS, solo: r.solo + HOME_ABILITY_BONUS }))
    : squadRaw;
  const aceId = sel.starters.length === 1 ? sel.starters[0] : sel.ace;
  const itemBoost = { wheel: sel.useWheel, suit: sel.useSuit };
  // v12: 無線指示は廃止し、出走前に選んだ作戦をそのままシミュレーションへ渡す
  const directive = { chaseMode: sel.chaseMode || "normal", aceEarly: !!sel.aceEarly };
  return { squad, aceId, itemBoost, directive };
}

// v14.8: ステージごとに役割を変更できるようにしたため、初日から固定のgc.aceId/gc.rolesではなく、
// 直前の「作戦変更」画面（gc_role_setup）で更新したsel.ace/sel.rolesを都度反映する。
// 出走人数1名（solo）の場合は再設定画面自体を経由しないため、従来通りgc.aceIdを使う
export function prepareNextStageSquad(state, gc) {
  const roster2 = state.roster.map(r => gc.starters.includes(r.id) ? { ...r, fatigue: Math.max(0, r.fatigue - 20) } : r);
  const squad = roster2.filter(r => gc.starters.includes(r.id));
  const aceId = gc.starters.length === 1 ? gc.starters[0] : (state.sel.ace || gc.aceId);
  const roles = state.sel.roles || gc.roles;
  return { roster2, squad, aceId, roles };
}
