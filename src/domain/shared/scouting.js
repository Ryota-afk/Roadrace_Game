// 相手選手の能力を「査定値」として見せるための純ロジック。両モード共通。第11弾Phase3。
// v51(第11弾Phase3・3-A): 相手選手の能力値はそもそも永続化されていない（毎レースAI生成時に
// power(その場の文脈)+baseline(選手固有)から都度生成される）。アーキテクチャは変えず、
// 基準文脈（クラス・★2・現在の年・現在の難易度）で計算した値を「査定値」として提示する。
// power式そのものは buildSim（logic/support.js）・buildMyLifeSim（state/state.js）にも
// 存在するため、係数（クラス補正9・グレード補正4）を持つ部分だけをここへ集約し、
// 3箇所が同じ式を共有する（写経して増やさない）。
import { newRider, idYearSeed, overall } from "../../core/core.js";

// base: モードごとの基準値（Season=52、MyLife=50。history: buildSim/buildMyLifeSimの既存値を
// そのまま踏襲。統一すると両モードのAI強度設計を作り直すことになるため、baseは意図して残す）。
// extra: チャンピオンシップ・ダイナスティ等、モード固有の追加補正（無ければ0）。
export function aiPowerFor(base, classIdx, grade, diffAiMul, extra = 0) {
  return (base + classIdx * 9 + (grade - 1) * 4 + extra) * diffAiMul;
}

// マイライフのAI能力上限は難易度で個別に引き上げる（buildMyLifeSimの既存ロジックを集約）。
// シーズン側はdiffDef.abilCapをそのまま使う（buildSimの既存ロジックのまま、ここには無い）。
export function mlAiCapFor(difficultyId, fallbackAbilCap) {
  return ({ easy: 92, normal: 96, hard: 102, oni: 112 })[difficultyId] ?? (fallbackAbilCap ?? 94);
}

// rider: worldRosters/rivalRostersに入っている永続選手（id, type, baselineを持つ）。
// power: aiPowerForで計算した値。year: idYearSeedに渡す年。cap: 能力上限。
// 第31弾: capOffset（ML_TYPE_CAP_OFFSET相当の表）を渡すと能力別上限になる。査定値は
// 実際のレース生成（buildMyLifeSim）と同じ式である契約なので、呼び出し側が実際に
// 使うcapOffsetと必ず揃えること（省略時はシーズン側と同じ従来どおり）。
export function scoutedAbilities(rider, power, year, cap, capOffset) {
  const st = newRider(power + (rider.baseline || 0), idYearSeed(rider.id, year), { type: rider.type, cap, capOffset, banned: new Set() });
  return { flat: st.flat, climb: st.climb, sprint: st.sprint, stamina: st.stamina, solo: st.solo, ovr: overall(st) };
}

// v51(3-B): 段階的開示。シーズン＝スタッフのスカウトLv(0-3)、マイライフ＝対戦経験（riderStats[id].races）。
export function scoutStageFromLv(scoutLv) {
  return Math.max(0, Math.min(3, scoutLv || 0));
}
export function scoutStageFromRaces(races) {
  const r = races || 0;
  if (r >= 6) return 3;
  if (r >= 3) return 2;
  if (r >= 1) return 1;
  return 0;
}

// stage1（OVR帯）の表示用ラベル。「およそ60台」のような粗い帯で見せ、無駄な精度を出さない。
export function ovrBandLabel(ovr) {
  return `${Math.floor(ovr / 10) * 10}台`;
}
