// レース開始（startRace/startNextStage）の入力組み立てのみを抽出した純関数。Step7第5弾。
// 注意：startRace側のsetTimeout・buildSim自体（Date.now()シードのRNGを内包）には
// 一切触れていない（v12でstale closureバグを実際に踏んだ箇所のため、案A＝確実にテスト可能な
// 部分だけを切り出す方針。詳細はDEVLOG §9参照）。startNextStage側は第7弾でstage2LockRefを
// 廃止し、beginNextStage（下記）による二相化のフェーズ1に置き換えた。
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
  // 第17弾C: 機材セットアップ（無料・ChipRow）。自チーム全員に一律で効く
  const itemBoost = { wheel: sel.useWheel, suit: sel.useSuit, setup: sel.setup || "std" };
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

// Step7第7弾: startNextStageの二相化（フェーズ1＝意図の確定）。
// buildSim（重い計算・非冪等ではないがコストがかかる）はここでは呼ばず、
// 次に進むステージ番号・エース・役割の「意図」だけをgcへ確定する。実際の
// buildSim呼び出しとロスター疲労反映・結果確定は、この意図（gc.pendingStage）を
// 観測するuseEffect（フェーズ2）側で行う。stage2LockRef（useRefロック）の代わりに
// gc.pendingStageの有無そのものを二重発火防止のガードとして使うため、レンダーの
// たびに再生成されるuseRefと違い、状態遷移そのものに紐づいた安全なガードになる
export function beginNextStage(s) {
  const gc = s.gc;
  if (!gc || gc.pendingStage) return s;
  const aceId = gc.starters.length === 1 ? gc.starters[0] : (s.sel.ace || gc.aceId);
  const roles = s.sel.roles || gc.roles;
  return { ...s, gc: { ...gc, pendingStage: gc.stage + 1, pendingAceId: aceId, pendingRoles: roles } };
}
