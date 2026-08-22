// 互換シム（第16弾D）。sim/race.jsは1,089行に肥大化していたため5ファイルへ分割した：
// data/parts.js（機材データ）、sim/effects.js（能力計算）、sim/course.js（コース生成）、
// sim/ticks.js（tickシミュレーション本体）、sim/finish.js（決着処理）。
// 依存は data/parts → sim/effects/course → sim/ticks → sim/finish の一方向。
// 外部の呼び出し側（19ファイル）は本ファイル経由のimportのまま無改修で動く。
export { PART_SLOTS, PARTS } from "../data/parts.js";
export { rollWeather, rainMul, MONUMENT_ABILITY, monumentMul, effAbilities, typeAffinityBonus, segmentAbility } from "./effects.js";
export { generateCourse, climbWeightFor, terrainSpeedMul } from "./course.js";
export {
  TICK_SEC, AI_STYLES, DRAIN_K, energyPenaltyMul, tickSpeedFactor, tickDistance,
  roleTerrainMismatchMul, groupShelterMul, ENERGY_REGEN_BASE, canPull, assignAIRoles, simulateTicks,
  legsLeft01, RACE_MOVES, MAX_GAP_MUL, TAIL_BAND_MUL, capExcessiveGaps, riderHash01, riderWander,
} from "./ticks.js";
export {
  MOVE_EFF_BY_DIFF, resumeSim, finishAbility, resolveFinishClusters,
  teamTTPower, teamTTTime, computeTeamTT, rankSim,
} from "./finish.js";
