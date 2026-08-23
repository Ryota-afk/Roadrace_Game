// 表示ヘルパー関数＋残存データ定数（Phase 4-1で main.jsx から分離）。
// v41(§Step3): 静的データ定数（export const の大半）は data/economy.js, data/events.js,
// data/directives.js, data/gear.js, data/progression.js へ移送済み。ここでは import して
// 内部利用しつつ再エクスポートし、main.jsx/screens/*.jsx 側の既存 import 文（"./logic/support.js"）
// を変更せずに済むようにしている（＝互換シム。将来的に呼び出し側を data/* への直接importへ
// 揃えれば、このファイルの再エクスポート行は削除できる）。
// v52(第13弾Phase0): 本ファイルが1844行・100件超のexportを抱える巨大ファイルになっていたため、
// 機能ごとに src/domain/・src/state/・src/sim/ 配下へ再配置した（分割方針・対応表はdevlog/wave13.md
// 参照）。本ファイル自体は37箇所の既存import文（"./logic/support.js"）を無変更で動かすための
// 互換シムとして残す。呼び出し側を直接importへ揃えるのは後日の別タスク。
import { EVENT_CHANCE, GRADE_MUL, MLCP_DIFF_MUL, ML_CP_MILESTONES, OB_COACH_SALARY, POP_MILESTONES, PRIZES, PTS, SCOUT_POLICIES, SLOT_LABEL, STAFF_MAX_BY_CLASS, STAFF_META, STAFF_ROLES, STAFF_SALARY_PER_LV, TYPE_COACH_ABILITY, WEATHER } from "../data/economy.js";
import { EVENTS, ML_BACKGROUNDS, ML_EVENTS, ML_PERSONALITY_EVENTS, ML_SPONSOR_GIGS } from "../data/events.js";
import { MANAGER_DIRECTIVES, SEASON_OBJECTIVES } from "../data/directives.js";
import { ML_AB_COACH_KEY, ML_CARS, ML_GEAR, ML_HOUSES, ML_SPECIAL_TRAINING, ML_STOCK_ITEMS } from "../data/gear.js";
import { ABILITY_CATEGORY_ORDER, APT_GRADE_COLOR, CHEMISTRY_TIERS, CLASS_TIER_COLOR, DIFFICULTIES, DISCIPLINES, DISCIPLINE_KEYS, FAVORS_TO_DISCIPLINE, GROWTHPOW_ORDER, GROWTH_ORDER, GROWTH_POW_LADDER, ML_AMBITION_PATH_KEYS, SUB_STAT_LABEL } from "../data/progression.js";
import { riderFlavorText } from "../view/flavor.js";
import { mlNewspaper, mlBuildWorldNews, seasonWorldNews } from "../view/news.js";
import { computePickupChance } from "../domain/season/transfer.js";
import { genSeasonObjective, raceObjectiveEvent, advanceObjective, expireObjective, objectiveStatusText } from "../domain/season/sponsor.js";
import { computeStandings, seasonRank, seasonTitleRace, standingsRankReward, champPromoteCut } from "../domain/season/standings.js";
import { raceForecast } from "../domain/shared/forecast.js";
import { aiPowerFor, mlAiCapFor, scoutedAbilities, scoutStageFromLv, scoutStageFromRaces, ovrBandLabel } from "../domain/shared/scouting.js";
import { teamsForClass } from "../state/state.js";

// data/* ・ view/* ・ domain/* へ移送した定数・関数の再エクスポート（呼び出し側の import 文を変更しないための互換シム）
export {
  EVENT_CHANCE, GRADE_MUL, MLCP_DIFF_MUL, ML_CP_MILESTONES, OB_COACH_SALARY, POP_MILESTONES, PRIZES, PTS,
  SCOUT_POLICIES, SLOT_LABEL, STAFF_MAX_BY_CLASS, STAFF_META, STAFF_ROLES, STAFF_SALARY_PER_LV, TYPE_COACH_ABILITY, WEATHER,
  EVENTS, ML_BACKGROUNDS, ML_EVENTS, ML_PERSONALITY_EVENTS, ML_SPONSOR_GIGS,
  MANAGER_DIRECTIVES, SEASON_OBJECTIVES,
  ML_AB_COACH_KEY, ML_CARS, ML_GEAR, ML_HOUSES, ML_SPECIAL_TRAINING, ML_STOCK_ITEMS,
  ABILITY_CATEGORY_ORDER, APT_GRADE_COLOR, CHEMISTRY_TIERS, CLASS_TIER_COLOR, DISCIPLINES, DISCIPLINE_KEYS,
  FAVORS_TO_DISCIPLINE, GROWTHPOW_ORDER, GROWTH_ORDER, GROWTH_POW_LADDER, ML_AMBITION_PATH_KEYS, SUB_STAT_LABEL,
  riderFlavorText, mlNewspaper, mlBuildWorldNews, seasonWorldNews,
  computePickupChance,
  genSeasonObjective, raceObjectiveEvent, advanceObjective, expireObjective, objectiveStatusText,
  computeStandings, seasonRank, seasonTitleRace, standingsRankReward, champPromoteCut,
  raceForecast,
  teamsForClass,
  aiPowerFor, mlAiCapFor, scoutedAbilities, scoutStageFromLv, scoutStageFromRaces, ovrBandLabel,
};

// v52(第13弾Phase0): 以下、旧本ファイルの実装（成長計算・CP・血統・スタッフ・ライバル演出・実績・
// 世界ランク・キャリア年表・野望・セーブ入出力・buildSim等）を分割先から再エクスポートする。
export {
  upgradeGoldAbilities, ACQUIRE_CONDITIONS, acquireNewAbility, ABILITY_FILE_KEY,
  loadAbilityFile, saveAbilityFile, noteAbilityDiscovery, bumpRosterAbAll, bumpEquipLv, addProdigyRookie,
  CP_MILESTONES, applyCpMilestones, mlCpPerks, computeClearPoints, computeMyLifeClearPoints, cpUnlockRows,
  cpMilestoneSummary,
} from "../domain/mylife/cp.js";

export {
  persMul, BREAKTHROUGH_SENSITIVITY, breakthroughMul, softFactor, GROWTH_TAPER, GROWTH_AT_CAP, GROWTH_DECAY_DIV,
  growthFactor, addAb, growSub, rollCondDir, growthPhase, potentialHint, disciplineScore, buildDesc,
  aptGrade, riderAptitudes, t_label,
} from "../domain/shared/growth.js";

export {
  COURSE_REC_KEY, loadCourseRecords, saveCourseRecords, peekCourseRecord, persistCourseRecord,
} from "../domain/shared/courseRecords.js";

export {
  mlGradeColor, bloodIdToName, buildBloodMap, mlLineageForest, breedNickTableRows, mlFactorCollection,
} from "../domain/mylife/lineage.js";

export {
  mlSetEpilogue, mlSetAutobiography, mlAutobiographyOptions, mlEpilogueDirector, mlEpilogueAway,
  mlCareerTimeline, protegeState, mlTalentRank, ML_PROTEGE_EVENTS, protegeMilestoneNews,
} from "../domain/mylife/career.js";

export { staffMemberName, staffEffectText, staffSalaryTotal } from "../domain/season/staff.js";

export { EFFECT_APPLIERS, seasonPersonalityEvent, applyEventEffects } from "../domain/season/events.js";

export {
  isHallOfFameWorthy, mlTeamTier, rivalHeatTier, rivalMeetingHeat, rivalDrama, rivalScene, rivalDialogue,
  abilityDeltaSummary, seasonRivalDex, mlCreateRival, ageRival,
} from "../domain/season/rival.js";

export {
  ML_CROSSROADS, mlRollCrossroads, ML_OFFSEASON_CHOICES, SEASON_ACHIEVEMENTS, computeSeasonAchievements,
  formatAchievementReward, mlGenDirective, managerEvalTier, pickMandateMonths, bumpCareerStats,
} from "../domain/season/achievements.js";

export {
  mlAchievementBonus, mlGrowthCap, mlGrowthCapFor, ML_TYPE_CAP_OFFSET, weightedPick, pickMlEvent, mlGrowthPowRevealed, mlLivingCost, mlPrivateCampCost,
} from "../domain/mylife/growthCap.js";

export {
  worldPointsForFinish, mlUpdateRiderStats, decayRiderStatsWp, computeWorldRank, mlWorldRaceLite,
  mlRiderStatsRows, mlWorldTeamStats, mlMediaHeadline, worldRankTier, mlWorldBoard,
} from "../domain/mylife/worldRank.js";

export {
  mlAmbitionPath, mlCurrentAmbition, mlAmbitionProgressText, bumpGrowthPow, applyAmbitionReward,
} from "../domain/mylife/ambition.js";

export { mlGearFitHint } from "../domain/mylife/gearFit.js";

export { hasSaveGame, clearSaveGame, hasMyLifeSave, clearMyLifeSave } from "../state/saveGame.js";

export { groupModeFor, raceIsHome, teamChemistryTier, buildSim } from "../sim/buildSim.js";
