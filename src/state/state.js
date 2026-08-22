// 互換シム（第15弾F）。state.jsは1,096行に肥大化していたため6ファイルへ分割した：
// state/prestige.js（生涯プレステージ・タイトル台帳）・state/worldRoster.js（永続ワールドロースター）・
// state/seasonState.js（シーズンの状態init/save/load）・state/mylifeState.js（マイライフの状態init/save/load）・
// sim/buildMyLifeSim.js（マイライフのレース構築。対になるbuildSimがsim/buildSim.jsにあるのに
// buildMyLifeSimだけstate層に残っていた非対称が第14弾37番のバグの遠因だったため、sim層へ移した）・
// state/meta.js（クリアポイント・CPショップ・タイトル台帳）。ML_TACTICSはsimレイヤーが
// stateレイヤーへ逆依存しないよう data/progression.js へ移設。
// 呼び出し側（29ファイル）のimport文を書き換えずに済むよう、ここで全シンボルを再exportする。
export { totalTitleCount, computePrestige, unlockedTemplates } from "./prestige.js";
export { genWorldRosters, ageWorldRosters, topUpWorldRosters, WORLD_KEY, loadWorldMeta, advanceWorldYear, sharedWorldRosters } from "./worldRoster.js";
export { genMonthRaces, initGame, SAVE_KEY, serializeState, saveGame, resyncRid, loadGame, saveGameInfo } from "./seasonState.js";
export {
  ML_AMBITION_PATHS, mlAmbitionMetricValue, mlFirstUnmetRung, mlAmbitionCleared, initMyLife,
  ML_SAVE_KEY, saveMyLife, loadMyLifeGame, myLifeSaveInfo, mlGenTeammates, ML_TEAMMATE_COUNT, mlTeammatesFromRoster,
} from "./mylifeState.js";
export { ML_TACTICS } from "../data/progression.js";
export { buildMyLifeSim } from "../sim/buildMyLifeSim.js";
export {
  META_KEY, loadMeta, cpBalance, CP_SHOP, cpOwned, cpBuy, cpShopSeasonPerks, cpShopMylifePerks,
  saveMeta, TITLES_KEY, loadTitles, recordTitle,
} from "./meta.js";

// v41(§Step5): 移籍市場の生成器（legendToSeasonRider/worldRiderToRosterRider/genPoachTargets/
// makePoachOffer/genFaPool/genTradeOffers）と RIVAL_TEAMS/MYLIFE_TEAMS は domain/season/transfer.js・
// data/teams.js へ移送済み。ここでは import して内部利用（initGame等）しつつ再エクスポートし、
// main.jsx/screens/*.jsx 側の既存import文（"./state/state.js"）を変更せずに済むようにしている。
// v41(§Step6): 選手の異名・キャリア総括・実績判定（ML_ACHIEVEMENTS/computeAchievements/
// mlCareerArchetype/riderCareerSummary/riderNickname）は breeding.js（mlLegendSnapshotの
// 唯一の呼び出し元）へ移送。従来 state.js⇄breeding.js が循環importだったのを、これで
// state.js→breeding.js の一方向に整理した（loadMlLegendsのみ引き続き必要）。
export { RIVAL_TEAMS, MYLIFE_TEAMS, teamsForClass } from "../data/teams.js";
export { legendToSeasonRider, worldRiderToRosterRider, genPoachTargets, makePoachOffer, genFaPool, genTradeOffers } from "../domain/season/transfer.js";
export { initRoster, genScouts } from "../domain/season/roster.js";
export { genSponsors } from "../domain/season/sponsor.js";
export { ML_ACHIEVEMENTS, computeAchievements, mlCareerArchetype, riderCareerSummary, riderNickname } from "../breeding/breeding.js";
export { raceEntryPlan } from "../domain/season/entryPlan.js";
