import { createRoot } from "react-dom/client";
import React, { useState, useRef, useEffect, useMemo } from "react";

// ---- 静的データ（src/data/*）----
import { C, FONT_D, FONT_B, FONT_M } from "./data/theme.js";
import { TYPES, TYPE_ROLE_FIT, AB_KEYS, AB_LABEL, AB_COLOR, GROWTH, ABILITIES, PERSONALITIES, COND_ARROW, COND_COLOR, COND_FC_ARROW, COND_FC_COLOR, COND_FC_LABEL } from "./data/abilities.js";
import { CLASSES, DIFFICULTIES, TITLE_DEFS } from "./data/progression.js";
import { TYPE_ABKEYS, TEACH_KEYS, PROTEGE_TEACHINGS, ARCH_BREED, ML_SPECIAL_MATINGS, BREED_NICKS } from "./data/breeding.js";
import { MONTHS, ROSTER_MAX_BY_CLASS, SCOUT_COUNT_BY_CLASS, PRODIGY_CHANCE_BY_CLASS, UPKEEP_PER_RIDER, ROLES, CHASE_MODES, SEG_COMMENTARY, FINISH_COMMENTARY, TEMPLATES, UNLOCK_TEMPLATES, REGIONS, VENUE_REGION, HOME_ABILITY_BONUS, OVERSEAS_VENUES, GRAND_TOURS, SEG_LABEL, SEG_COLOR } from "./data/course.js";
import { ITEMS, EQUIPS, EQUIP_COST } from "./data/items.js";

// ---- コンポーネント（Phase 3）----
import { Btn, Eyebrow } from "./components/ui.jsx";
import { RaceView, RaceErrorBoundary } from "./components/RaceView.jsx";

// ---- 純ロジック（src/core, sim, breeding, world, state）----
import { ASSIST_ROLES, GOLD_CONDITIONS, SUB_STAT_KEYS, countRoleUses, countWins, fmtGap, fmtTime, mulberry, newRider, overall, pickRiderName, ridState, rollAbilities, strHash } from "./core/core.js";
import { AI_STYLES, PARTS, PART_SLOTS, TICK_SEC, assignAIRoles, effAbilities, generateCourse, riderHash01, simulateTicks } from "./sim/race.js";
import { legendAncestorSet, legendBloodId, loadBloodlines, loadMlLegends, mlBloodlineBonus, mlBloodlineFactor, mlBloodlineTier, mlBreedBonus, mlRecordLegend, protegeInherit, saveMlLegends } from "./breeding/breeding.js";
import { mlWorldStarsForYear } from "./world/world.js";
import { ML_ACHIEVEMENTS, ML_AMBITION_PATHS, ML_SAVE_KEY, MYLIFE_TEAMS, SAVE_KEY, buildMyLifeSim, computeAchievements, computePrestige, initGame, initMyLife, loadGame, loadMeta, loadMyLifeGame, loadTitles, mlAmbitionMetricValue, mlCareerArchetype, mlFirstUnmetRung, mlGenTeammates, genWorldRosters, sharedWorldRosters, advanceWorldYear, loadWorldMeta, cpShopMylifePerks, CP_SHOP, cpBalance, cpBuy, cpOwned, recordTitle, riderCareerSummary, riderNickname, saveGame, saveMeta, saveMyLife, totalTitleCount } from "./state/state.js";

// ---- App から使う表示層（Phase 4-1）----
import { AbilityFileList, AbilityGrid, BlurGrid, CondFc, CourseRecordsPanel, DisciplineGrid, ElevationChart, FatigueBar, MultiStageCourseView, PersonaLine, StartListPanel, SubStatLine, TitlesPanel, TraitLine } from "./components/panels.jsx";
import { CLASS_TIER_COLOR, CP_MILESTONES, DISCIPLINES, FAVORS_TO_DISCIPLINE, GROWTHPOW_ORDER, MANAGER_DIRECTIVES, ML_AMBITION_PATH_KEYS, ML_BACKGROUNDS, ML_CROSSROADS, ML_EVENTS, ML_PERSONALITY_EVENTS, ML_OFFSEASON_CHOICES, ML_SPONSOR_GIGS, ML_STOCK_ITEMS, SCOUT_POLICIES, SEASON_ACHIEVEMENTS, SLOT_LABEL, STAFF_MAX_BY_CLASS, STAFF_ROLES, STAFF_SALARY_PER_LV, SUB_STAT_LABEL, WEATHER, addAb, applyCpMilestones, bloodIdToName, breedNickTableRows, buildBloodMap, buildSim, bumpGrowthPow, clearMyLifeSave, clearSaveGame, computeClearPoints, computeMyLifeClearPoints, cpUnlockRows, mlCpPerks, computeSeasonAchievements, computeStandings, disciplineScore, formatAchievementReward, groupModeFor, growSub, hasMyLifeSave, hasSaveGame, loadAbilityFile, managerEvalTier, mlAmbitionPath, mlAmbitionProgressText, mlAutobiographyOptions, mlCreateRival, mlEpilogueAway, mlEpilogueDirector, mlGenDirective, mlGradeColor, mlGrowthCap, mlLivingCost, mlFactorCollection, mlLineageForest, protegeState, mlRollCrossroads, mlSetAutobiography, mlSetEpilogue, mlWorldBoard, mlWorldNews, noteAbilityDiscovery, pickMandateMonths, potentialHint, raceIsHome, riderFlavorText, rivalNews, rivalHeatTier, seasonRank, staffSalaryTotal, t_label, worldRankTier } from "./logic/support.js";
// ---- 画面ディスパッチ（Phase 4-2）----
import { renderMyLifeScreens } from "./screens/mylife.jsx";
import { renderSeasonScreens } from "./screens/season.jsx";
// ---- controllers（Step7）：状態遷移の純関数。setGへの薄い接続はApp()内で行う ----
import {
  retainRider as tfRetainRider, grantTransferRequest as tfGrantTransferRequest,
  poachRetain as tfPoachRetain, poachAccept as tfPoachAccept, poachSign as tfPoachSign,
  acceptTrade as tfAcceptTrade, declineTrade as tfDeclineTrade,
} from "./controllers/season/transfer.js";
import {
  buyItem as shBuyItem, buyPart as shBuyPart, setPart as shSetPart, buyEquip as shBuyEquip,
  hireStaff as shHireStaff, hireObCoach as shHireObCoach, dismissObCoach as shDismissObCoach,
} from "./controllers/season/shop.js";
import {
  signScout as rsSignScout, signFa as rsSignFa, useSupp as rsUseSupp, useTune as rsUseTune,
  setFocus as rsSetFocus, useCamp as rsUseCamp, toggleFavorite as rsToggleFavorite,
  setCaptain as rsSetCaptain, releaseRider as rsReleaseRider, signYouthProspect as rsSignYouthProspect,
  signBredYouth as rsSignBredYouth,
} from "./controllers/season/roster.js";
import {
  mlBuyPart as mshBuyPart, mlSetPart as mshSetPart, mlBuyGear as mshBuyGear, mlBuyStock as mshBuyStock,
  mlUseStock as mshUseStock, mlPrivateCamp as mshPrivateCamp, mlBuyCar as mshBuyCar, mlBuyHouse as mshBuyHouse,
  mlSetFocus as mshSetFocus,
} from "./controllers/mylife/shop.js";
import { resolveEvent as seResolveEvent } from "./controllers/season/event.js";
import { advanceMonth as smAdvanceMonth } from "./controllers/season/month.js";
import { finishRace as srFinishRace, finishTeamTT as srFinishTeamTT, finishStage as srFinishStage } from "./controllers/season/result.js";
import { mlAdvanceMonth as mmAdvanceMonth } from "./controllers/mylife/month.js";
import { mlRaceFinish as mrRaceFinish, mlLastRaceFinish as mrLastRaceFinish } from "./controllers/mylife/result.js";
import { mlGenRace } from "./domain/mylife/race.js";

// ---------- メインアプリ ----------
function App() {
  const [g, setG] = useState(initGame);
  // v14: マイライフモードはシーズンモードとは完全に別の状態を持つ（タイトル画面で選択）。
  // superMode: null=モード未選択（タイトル）／"season"=既存のチーム運営／"mylife"=新モード
  const [superMode, setSuperMode] = useState(null);
  const [uiTick, setUiTick] = useState(0); // v37: CPショップ購入後の再描画トリガー
  const buyCpItem = (id) => { const meta = loadMeta(); const next = cpBuy(meta, id); if (next !== meta) { saveMeta(next); setUiTick(t => t + 1); } };
  const [ml, setMl] = useState(initMyLife);
  const mlRaceLockRef = useRef(false);
  const mlCreateArgsRef = useRef(null); // v36(#5): リセマラ引き直し用に直近の作成引数を保持
  // v12バグ修正: window.confirm()はモバイル端末（特にホーム画面追加時のPWA表示や
  // 一部のアプリ内ブラウザ）で表示されない・即falseを返すことがあり、その場合
  // 「最初から」等のボタンを押しても確認ダイアログがブロックされて何も起きない
  // （リセットできていないように見える）。ブラウザ標準のconfirm()に頼らず、
  // アプリ内で完結する確認モーダルに置き換える
  const [confirmDialog, setConfirmDialog] = useState(null);
  const askConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });
  // v29: 選手名の変更用モーダル（アプリ内完結のテキスト入力）
  const [renameState, setRenameState] = useState(null); // { title, value, onCommit }
  const openRename = (title, current, onCommit) => setRenameState({ title, value: current || "", onCommit });
  const stage2LockRef = useRef(false);
  // v28: 新規ゲーム開始時のチーム名入力
  const [teamNameChoice, setTeamNameChoice] = useState("");
  // v13: 新規ゲーム開始時の難易度選択（newgame_setup画面用。永続ボーナスは選択不要で自動適用）
  const [diffChoice, setDiffChoice] = useState("easy");
  const clearAwardedRef = useRef(false);
  // v13: 選手名鑑（戦績一覧）の展開状態。選手カードのトグルボタンで開閉する
  const [expandedRiderId, setExpandedRiderId] = useState(null);
  // v31.1: シーズンモードの血統ユース（配合）の選択状態（null=閉じている／{a,b}=親のindex）
  const [breedYouthSel, setBreedYouthSel] = useState(null);
  const cls = CLASSES[g.classIdx];
  const healthy = g.roster.filter(r => r.injury === 0);
  const equipMax = 3 + g.classIdx;
  const rosterMax = ROSTER_MAX_BY_CLASS[g.classIdx];
  const staffMax = STAFF_MAX_BY_CLASS[g.classIdx];
  // v14.11: 「限界突破」表示のしきい値は難易度ごとの成長上限（growthCap）と
  // 一致させる（以前は難易度に関わらず固定95だったため、上位難易度で実際の
  // ソフトキャップ〈102/112〉と表示上のしきい値〈95〉がズレていた）
  const growthCap = (DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).growthCap;

  // v10: main画面に到達するたびに自動保存
  useEffect(() => {
    if (g.screen === "main") { saveGame(g); noteAbilityDiscovery(g.roster); }
  }, [g]);

  // v14: マイライフモードも同様にmylife_main到達時点で自動保存（別のセーブキー）
  useEffect(() => {
    if (superMode === "mylife" && ml.screen === "mylife_main") { saveMyLife(ml); noteAbilityDiscovery([ml.player]); }
  }, [ml, superMode]);

  // v18: 実績を初めて達成したタイミングで自動的に報酬（資金・一部はクリアポイント）を付与する。
  // rewardedAchievementsに記録済みのidは対象から除外するので、次回以降のrender/effectでは
  // newlyが空になり安全に停止する（重複付与しない）
  useEffect(() => {
    if (g.screen !== "main") return;
    const newly = computeSeasonAchievements(g).filter(a => a.achieved && !(g.rewardedAchievements || []).includes(a.id));
    if (newly.length === 0) return;
    const moneyTotal = newly.reduce((sum, a) => sum + (a.reward?.money || 0), 0);
    const cpTotal = newly.reduce((sum, a) => sum + (a.reward?.cp || 0), 0);
    if (cpTotal > 0) { const meta = loadMeta(); saveMeta({ ...meta, totalEarnedCP: meta.totalEarnedCP + cpTotal }); }
    setG(s => ({
      ...s,
      budget: s.budget + moneyTotal,
      rewardedAchievements: [...(s.rewardedAchievements || []), ...newly.map(a => a.id)],
      log: [...s.log, ...newly.map(a => `【実績解除】${a.label}（+${a.reward?.money || 0}万円${a.reward?.cp ? `／CP+${a.reward.cp}` : ""}）`)],
    }));
  }, [g]);

  // v18: マイライフも同様に実績達成時に報酬を付与する
  useEffect(() => {
    if (superMode !== "mylife" || ml.screen !== "mylife_main" || !ml.player) return;
    const newly = computeAchievements(ml).filter(a => a.achieved && !(ml.rewardedAchievements || []).includes(a.id));
    if (newly.length === 0) return;
    const moneyTotal = newly.reduce((sum, a) => sum + (a.reward?.money || 0), 0);
    const cpTotal = newly.reduce((sum, a) => sum + (a.reward?.cp || 0), 0);
    if (cpTotal > 0) { const meta = loadMeta(); saveMeta({ ...meta, totalEarnedCP: meta.totalEarnedCP + cpTotal }); }
    setMl(s => ({
      ...s,
      money: s.money + moneyTotal,
      rewardedAchievements: [...(s.rewardedAchievements || []), ...newly.map(a => a.id)],
      log: [...s.log, ...newly.map(a => `【実績解除】${a.label}（+${a.reward?.money || 0}万円${a.reward?.cp ? `／CP+${a.reward.cp}` : ""}）`)],
    }));
  }, [ml, superMode]);

  // v13: グランファイナル制覇でクリアポイントを付与（周回プレイの起点）。
  // 通常のセーブデータとは別のlocalStorageキーに保存し、「最初から」でリセットしても
  // 消えない永続的な進行度にする。re-render時に重複加算しないようrefでガードする
  // v41(§Step7第3弾): 以前はadvanceMonthのreducer内でrecordTitle("grandFinal")を直接呼んでいたが、
  // setGのupdaterは（StrictMode等で）複数回呼ばれ得る契約のため、非冪等なlocalStorage書き込みを
  // updater内に置くのは休眠中のバグだった（現状StrictMode未使用のため実害は出ていない）。
  // このuseEffectは元々"clear"画面への遷移をrefガード付きで検知しており、
  // まさに同じ条件（info.cleared→screen:"clear"）を見ているため、ここに合流させた。
  useEffect(() => {
    if (g.screen === "clear" && !clearAwardedRef.current) {
      clearAwardedRef.current = true;
      const earned = computeClearPoints(g.year, g.difficulty);
      const meta = loadMeta();
      saveMeta({ ...meta, totalEarnedCP: meta.totalEarnedCP + earned });
      recordTitle("grandFinal");
    }
    if (g.screen !== "clear") clearAwardedRef.current = false;
  }, [g.screen]);
  // v37: マイライフのキャリア終了（引退）でも生涯CPを付与する（メタ進行の統合）。
  // 引退画面に入った瞬間に一度だけ計算・加算し、獲得内訳を表示用に保持する。
  // v41(§Step7第3弾): mlRecordLegend（殿堂記録）も同じ理由でここに合流させた。mlLastRaceFinish・
  // mlRetireAdviceAcceptのどちらの経路でも"mylife_retired"に遷移するため、遷移元を問わず
  // 一度だけ記録される。効果発火時点でmlは既に最終raceLogを含む確定済みstate。
  const mlClearAwardedRef = useRef(false);
  useEffect(() => {
    if (ml.screen === "mylife_retired" && !mlClearAwardedRef.current) {
      mlClearAwardedRef.current = true;
      const res = computeMyLifeClearPoints(ml);
      if (res.total > 0) { const meta = loadMeta(); saveMeta({ ...meta, totalEarnedCP: meta.totalEarnedCP + res.total }); }
      setMl(s => ({ ...s, awardedCP: res }));
      mlRecordLegend(ml);
    }
    if (ml.screen !== "mylife_retired") mlClearAwardedRef.current = false;
  }, [ml.screen]);
  // v41(§Step7第3弾): 年度末のadvanceWorldYear()（共有ワールドの年を進める・非冪等）も、
  // 以前はadvanceMonth/mlAdvanceMonthのreducer内で直接呼んでいた休眠中の地雷だった。
  // g.year/ml.yearの変化を検知し、実際に年が進んだ時だけ1回呼ぶ（season/mylifeは独立のref）。
  const seasonWorldYearRef = useRef(g.year);
  useEffect(() => {
    if (g.year !== seasonWorldYearRef.current) {
      seasonWorldYearRef.current = g.year;
      advanceWorldYear();
    }
  }, [g.year]);
  const mlWorldYearRef = useRef(ml.year);
  useEffect(() => {
    if (ml.year !== mlWorldYearRef.current) {
      mlWorldYearRef.current = ml.year;
      advanceWorldYear();
    }
  }, [ml.year]);
  // v41(§Step7第3弾): グランツール総合優勝のrecordTitle("grandTour")。以前はfinishStageの
  // reducer内で直接呼んでいた。"gc_final"画面への遷移を検知し、返り値のgc.justWonGrandTour
  // フラグが立っている時だけ1回記録する。
  const gtTitleRef = useRef(false);
  useEffect(() => {
    if (g.screen === "gc_final" && !gtTitleRef.current) {
      gtTitleRef.current = true;
      if (g.gc && g.gc.justWonGrandTour) recordTitle("grandTour");
    }
    if (g.screen !== "gc_final") gtTitleRef.current = false;
  }, [g.screen]);
  // v41(§Step7第3弾): 世界選手権・オリンピック優勝のrecordTitle(race.milestone)。以前は
  // mlRaceFinishのreducer内で直接呼んでいた。"mylife_result"画面への遷移を検知し、
  // 返り値のresultInfo.milestoneWinフラグが立っている時だけ1回記録する。
  const mlMilestoneTitleRef = useRef(false);
  useEffect(() => {
    if (ml.screen === "mylife_result" && !mlMilestoneTitleRef.current) {
      mlMilestoneTitleRef.current = true;
      if (ml.resultInfo && ml.resultInfo.milestoneWin) recordTitle(ml.resultInfo.milestoneWin);
    }
    if (ml.screen !== "mylife_result") mlMilestoneTitleRef.current = false;
  }, [ml.screen]);

  const equippedCount = (pid) => g.roster.reduce((s, r) => s + (PART_SLOTS.reduce((n, sl) => n + (r.parts[sl] === pid ? 1 : 0), 0)), 0);
  const availParts = (pid) => (g.partsInv[pid] || 0) - equippedCount(pid);

  // v41(§Step7第3弾): 月次更新・年度末処理は controllers/season/month.js の純関数に集約。
  // 非冪等なlocalStorage書き込み（recordTitle/advanceWorldYear）は呼ばず、g.yearの変化・
  // "clear"画面への遷移を検知するuseEffectへ移した（下記・詳細はDEVLOG §9参照）。
  const advanceMonth = (raceInfo) => setG(s => smAdvanceMonth(s, raceInfo));
  // v41(§Step7): 移籍・トレードの状態遷移は controllers/season/transfer.js の純関数（tf*）に集約。
  // ここでは setG に接続する薄いラッパーのみを持つ（ハンドラの実体はNode単体テスト可能）。
  const retainRider = () => setG(tfRetainRider);
  const grantTransferRequest = () => setG(tfGrantTransferRequest);
  const poachRetain = () => setG(tfPoachRetain);
  const poachAccept = () => setG(tfPoachAccept);
  const poachSign = (targetId) => setG(s => tfPoachSign(s, targetId));

  const resolveEvent = (choiceIdx) => setG(s => seResolveEvent(s, choiceIdx));

  // ---- レース ----
  function startRace(watch) {
    stage2LockRef.current = false;
    const race = g.races.find(r => r.id === g.sel.raceId);
    const squadRaw = g.roster.filter(r => g.sel.starters.includes(r.id));
    // v28: ホームアドバンテージ。地元開催なら出走選手の全能力に小ボーナス（元のroster配列は不変）
    const isHome = raceIsHome(race, g.homeRegion);
    const squad = isHome
      ? squadRaw.map(r => ({ ...r, flat: r.flat + HOME_ABILITY_BONUS, climb: r.climb + HOME_ABILITY_BONUS, sprint: r.sprint + HOME_ABILITY_BONUS, stamina: r.stamina + HOME_ABILITY_BONUS, solo: r.solo + HOME_ABILITY_BONUS }))
      : squadRaw;
    const aceId = g.sel.starters.length === 1 ? g.sel.starters[0] : g.sel.ace;
    const itemBoost = { wheel: g.sel.useWheel, suit: g.sel.useSuit };
    // v12: 無線指示は廃止し、出走前に選んだ作戦をそのままシミュレーションへ渡す
    const directive = { chaseMode: g.sel.chaseMode || "normal", aceEarly: !!g.sel.aceEarly };
    // v29: 出走表用に事前生成した相手チーム布陣があればそれを使い、顔ぶれを一致させる
    const { sim, aiTeams } = buildSim(race, squad, aceId, g.sel.roles, g.equip, itemBoost, g.classIdx, g.pendingAiTeams, race.stageRace ? "day1" : undefined, directive, g.difficulty, g.rivalAlumni, g.dynastyLevel, g.teamName, g.rivalRosters, g.year);
    // v35(チームTT): チームTTはペロトン演出を持たないため、観戦を選んでも結果画面へ直行する
    const effWatch = race.tmpl.teamTT ? false : watch;
    setG(s => ({
      ...s, result: sim,
      gc: race.stageRace ? { race, aceId, roles: s.sel.roles, starters: s.sel.starters, aiTeams, watch: effWatch, stage: 1, directive, stageTimes: {}, dayLogs: [] } : s.gc,
      inv: { ...s.inv, wheel: s.inv.wheel - (itemBoost.wheel ? 1 : 0), suit: s.inv.suit - (itemBoost.suit ? 1 : 0) },
      screen: effWatch ? "race" : "result_pending",
    }));
    if (!effWatch) setTimeout(() => finishRace(sim, race, race.stageRace ? 1 : undefined), 0);
  }

  // v12: 以前はg（renderクロージャのstale値）からroster2/simを計算した後にsetGへ渡していたため、
  // 何らかの理由でgが更新される前に呼ばれる／連打で二重発火すると2日目のシミュレーションが
  // 食い違う・実行されない不具合があった。setGのfunctional updater内で毎回最新のsから
  // 計算するよう変更し、連打防止のロックも追加
  // v13: 2日間固定だったステージレースを任意日数（race.stageCount）に一般化。
  // 「2日目」だけを特別扱いしていたstartStage2を、現在のgc.stageから次の日を
  // 割り出すstartNextStageに置き換えた
  function startNextStage() {
    if (stage2LockRef.current) return;
    stage2LockRef.current = true;
    // v12バグ修正: watchFlagをsetGのfunctional updater内で代入し、その直後（同期的に）
    // if(!watchFlag)で参照していたため、Reactがupdaterをこの行より後（バッチ処理の
    // 反映時）に呼ぶ場合、常にwatchFlag=falseの初期値のまま判定されてしまい、観戦モードで
    // 開始したはずの次の日が毎回「結果だけ見る」経路に落ちて即座に確定してしまっていた
    // （日程が実行されないように見えるバグの原因）。gc.watchはステージレース開始時に
    // 一度決まったら変わらない値なので、setGを呼ぶ前に外側のgから同期的に読んで安全に使う
    const watchFlag = g.gc.watch;
    const nextStage = g.gc.stage + 1;
    let simResult = null, raceRef = null;
    setG(s => {
      const gc = s.gc;
      const roster2 = s.roster.map(r => gc.starters.includes(r.id) ? { ...r, fatigue: Math.max(0, r.fatigue - 20) } : r);
      const squad = roster2.filter(r => gc.starters.includes(r.id));
      // v14.8: ステージごとに役割を変更できるようにしたため、初日から固定のgc.aceId/gc.rolesではなく、
      // 直前の「作戦変更」画面（gc_role_setup）で更新したg.sel.ace/g.sel.rolesを都度反映する。
      // 出走人数1名（solo）の場合は再設定画面自体を経由しないため、従来通りgc.aceIdを使う
      const aceId = gc.starters.length === 1 ? gc.starters[0] : (s.sel.ace || gc.aceId);
      const roles = s.sel.roles || gc.roles;
      // v13: 各日ともステージ1で選んだ作戦（gc.directive）をそのまま引き継ぐ
      const { sim } = buildSim(gc.race, squad, aceId, roles, s.equip, { wheel: false, suit: false }, s.classIdx, gc.aiTeams, `day${nextStage}`, gc.directive, s.difficulty, undefined, s.dynastyLevel, s.teamName, s.rivalRosters, s.year);
      simResult = sim; raceRef = gc.race;
      return {
        ...s, roster: roster2, result: sim,
        gc: { ...s.gc, stage: nextStage, aceId, roles },
        screen: watchFlag ? "race" : "result_pending",
      };
    });
    if (!watchFlag) setTimeout(() => finishRace(simResult, raceRef, nextStage), 0);
  }

  // stageOverride: skip経路（結果だけ見る）はステージ番号を明示で渡し、
  // setG後にgが更新前のまま参照される（stale closure）事故を避ける
  // v41(§Step7第3弾): レース結果確定は controllers/season/result.js の純関数に集約。
  // finishStage内のrecordTitle("grandTour")は呼ばず、返り値gc.justWonGrandTourフラグを見た
  // useEffectへ移した（下記・詳細はDEVLOG §9参照）。stage2LockRef のリセットは、最終ステージか
  // 否かに関わらずここで行っても実害はない（startRace自身が次回開始時に必ず再リセットするため）。
  const finishRace = (sim, race, stageOverride) => setG(s => srFinishRace(s, sim, race, stageOverride));
  const finishTeamTT = (sim, race) => setG(s => srFinishTeamTT(s, sim, race));
  const finishStage = (sim, race, stageOverride) => {
    stage2LockRef.current = false;
    setG(s => srFinishStage(s, sim, race, stageOverride));
  };

  const raceFinishHandler = () => {
    if (g.gc && g.gc.race.stageRace) finishStage(g.result, g.gc.race, g.gc.stage);
    else finishRace(g.result, g.result.raceMeta);
  };

  // ==== v14: マイライフモード専用ハンドラ ====
  // v41(§Step7第3弾): mlGenRace（月次レース生成）は domain/mylife/race.js へ移動（複数箇所から
  // 参照される純粋なジェネレータのため controllers/ ではなく domain/ に置いた）。
  const ML_MILESTONE_LABEL = { worlds: { eyebrow: "🌍 世界選手権", color: C.blue }, olympics: { eyebrow: "🥇 オリンピック", color: C.yellow } };
  function mlCreateChar(type, background, master, partner) {
    mlCreateArgsRef.current = { type, background, master, partner }; // v36(#5): 引き直し用に保持
    const rng = mulberry(Date.now() % 999983);
    // v38: 所属チームの割り当てを見直し。従来は全チームから完全ランダムで、B1デビューなのに
    // PRO강호に所属して始まる不整合があり、また脚質と無関係で「毎回ほぼ同じ」に感じられた。
    // 開始クラス（B1）相応の下位〜中堅チーム（tier<=1）に限定し、自分の脚質に合うチームを
    // 当たりやすく重み付け＝キャリアごとに顔ぶれが変わりつつ、脚質に沿った所属先になる。
    const startPool = MYLIFE_TEAMS.filter(t => t.tier <= 1);
    const weightedPool = [...startPool, ...startPool.filter(t => t.spec === type)];
    const team = weightedPool[Math.floor(Math.random() * weightedPool.length)];
    const bg = ML_BACKGROUNDS[background];
    // v27: 教え子（プロテジェ）。師匠を選んでいれば、その最終能力・特殊能力・成長力を
    // 一部引き継いだ状態でデビューする
    const inh = master ? protegeInherit(master) : null;
    const player = newRider(bg.powerBase, rng, { type, age: bg.age, growth: bg.growth, powDist: bg.powDist, banned: new Set(), abBonus: inh ? inh.abBonus : undefined });
    player.background = background;
    player.vitality = 100; // v38(#9 B-2): 活力（長期の伸びしろの芯）。満タンでデビュー
    // v36(#4): 経歴ごとの固有メリット。高校卒＝成長力アップ抽選、大学卒／実業団卒＝出自らしい
    // 特殊能力を持ってデビュー（人気・評価・資金の初期ボーナスは後段の state 初期化で反映）。
    const perk = bg.perk || {};
    // v37: 生涯CPによるマイライフ特典（支度金・人気・評価・成長力抽選・当たり特能抽選の強化）。
    const cpMeta = loadMeta();
    const cpPerks = mlCpPerks(cpMeta.totalEarnedCP);
    const cpShop = cpShopMylifePerks(cpMeta); // v37: CPショップで購入済みの特典
    const growthLottery = (perk.growthLottery || 0) + cpPerks.growthLottery;
    if (growthLottery && rng() < growthLottery) player.growthPow = bumpGrowthPow(player.growthPow, 1);
    if (cpShop.growthUp) player.growthPow = bumpGrowthPow(player.growthPow, 1); // ショップ：成長力+1確定
    if (cpShop.statBoost) AB_KEYS.forEach(k => { player[k] = Math.min(94, (player[k] || 0) + cpShop.statBoost); }); // ショップ：初期能力+6
    if (perk.startAbility && ABILITIES[perk.startAbility] && !(player.abilities || []).includes(perk.startAbility)) {
      player.abilities = [...(player.abilities || []), perk.startAbility];
    }
    // v36(#5リセマラ): デビュー素質の当たり抽選。稀に「天啓（金特）」「天賦の才（特能+1）」
    // 「才能の片鱗（成長力+1）」を持って生まれ、リセマラで狙う価値を作る。配合キャラは後段で
    // 特能枠を使い切るため素質ボーナスは配合なしのときのみ（生い立ちの素質＝叩き上げの物語）。
    let debutBoon = null;
    if (!(master && partner)) {
      const goodPool = Object.keys(ABILITIES).filter(id => {
        const a = ABILITIES[id];
        return a && !a.bad && !a.breedOnly && !(player.abilities || []).includes(id);
      });
      const br = rng();
      const bb = cpPerks.boonBonus + cpShop.boonBonus; // v37: CP（自動＋ショップ）で当たり特能の抽選窓を広げる
      if (br < 0.04 + bb * 0.4 && (player.abilities || []).some(id => ABILITIES[id] && !ABILITIES[id].bad)) {
        const goodId = (player.abilities || []).find(id => ABILITIES[id] && !ABILITIES[id].bad && !(player.goldAbilities || []).includes(id));
        if (goodId) {
          player.goldAbilities = [...(player.goldAbilities || []), goodId];
          debutBoon = { label: "🌟 天啓", note: `ひらめきを得て「${ABILITIES[goodId].label}」が金特で開花している` };
        }
      } else if (br < 0.13 + bb && goodPool.length && (player.abilities || []).length < 4) {
        const id = goodPool[Math.floor(rng() * goodPool.length)];
        player.abilities = [...(player.abilities || []), id];
        debutBoon = { label: "✨ 天賦の才", note: `生まれ持った才能で特殊能力「${ABILITIES[id].label}」を余分に宿している` };
      } else if (br < 0.26) {
        const before = player.growthPow;
        player.growthPow = bumpGrowthPow(player.growthPow, 1);
        if (player.growthPow !== before) debutBoon = { label: "🌱 才能の片鱗", note: `秘めた伸びしろを感じさせる（成長力${before}→${player.growthPow}）` };
      }
    }
    if (debutBoon) player.debutBoon = debutBoon;
    // v37: CPショップ「デビュー時 金特1つ確定」＝良特能を1つ金特化（無ければ差し脚を付与して金特化）
    if (cpShop.debutGold) {
      let goldId = (player.abilities || []).find(id => ABILITIES[id] && !ABILITIES[id].bad && !(player.goldAbilities || []).includes(id));
      if (!goldId) { goldId = "kicker"; if (!(player.abilities || []).includes(goldId)) player.abilities = [...(player.abilities || []), goldId]; }
      player.goldAbilities = [...(player.goldAbilities || [])];
      if (!player.goldAbilities.includes(goldId)) player.goldAbilities.push(goldId);
      if (!player.debutBoon) player.debutBoon = { label: "🌟 英才の証", note: `CP特典で「${ABILITIES[goldId].label}」を金特で持ってデビュー` };
    }
    player.joinOvr = overall(player);
    if (inh) {
      if (inh.growthPowBump) {
        const gi = GROWTHPOW_ORDER.indexOf(player.growthPow);
        if (gi >= 0 && gi < GROWTHPOW_ORDER.length - 1) player.growthPow = GROWTHPOW_ORDER[gi + 1];
      }
      // v28: 「師の教え」の看板特性(lineage)＋師本人の良特性(inheritAbility)を継承。
      // 教え子は継承分により特殊能力を最大4つまで持てる（通常上限3より1多い＝メンターの恩恵）
      let abils = [...(player.abilities || [])];
      [inh.lineageTrait, inh.inheritAbility].forEach(id => { if (id && !abils.includes(id)) abils.push(id); });
      player.abilities = abils.slice(0, 4);
      // v29: 師の教えに応じた副ステータス補正
      if (inh.subBonus) SUB_STAT_KEYS.forEach(k => { if (inh.subBonus[k]) player[k] = Math.max(20, Math.min(95, (player[k] ?? 50) + inh.subBonus[k])); });
      player.master = master.name;
      player.teaching = inh.teaching.label;
      player.joinOvr = overall(player);
    }
    // v31: 配合（血統）。2人目の親（配合相手）が選ばれていれば、両方の血を引く教え子にする
    let breed = null;
    if (master && partner) {
      breed = mlBreedBonus(master, partner);
      AB_KEYS.forEach(k => { if (breed.abBonus[k]) player[k] = Math.min(96, (player[k] || 0) + breed.abBonus[k]); });
      SUB_STAT_KEYS.forEach(k => { if (breed.subBonus[k]) player[k] = Math.max(20, Math.min(95, (player[k] ?? 50) + breed.subBonus[k])); });
      // v33: 爆発力（配合評価）は初期能力ではなく「伸びしろ」に還元する。生まれた瞬間は普通でも育てると化ける
      if (breed.growthSteps) player.growthPow = bumpGrowthPow(player.growthPow, breed.growthSteps);
      else if (breed.growthBump) player.growthPow = bumpGrowthPow(player.growthPow, 1);
      player.talentCap = breed.talentCap || 0;
      player.bakuhatsu = breed.bakuhatsu || 0;
      player.matingGrade = breed.matingGrade || "D";
      // 金特クロス・配合限定特能は最優先で保持する（枠上限で溢れないように先頭へ）
      let abils2 = [...(breed.goldInherit || []), ...(breed.exclusive || []), ...(player.abilities || [])];
      breed.extraAbilities.forEach(id => { if (id && ABILITIES[id] && !abils2.includes(id)) abils2.push(id); });
      abils2 = abils2.filter((id, i) => abils2.indexOf(id) === i);
      player.abilities = abils2.slice(0, 5); // 配合は特能を最大5つまで受け継げる
      // 金特クロス：受け継いだ金特のうち、実際に特能枠へ残ったものを金特フラグ化
      if (breed.goldInherit && breed.goldInherit.length) {
        player.goldAbilities = [...(player.goldAbilities || [])];
        breed.goldInherit.forEach(id => { if (player.abilities.includes(id) && !player.goldAbilities.includes(id)) player.goldAbilities.push(id); });
      }
      // v33.4: 特殊配合。特定の血の組み合わせで、唯一無二の名血（金枠）を確定発現する
      if (breed.special) {
        const sm = breed.special;
        player.specialMating = { key: sm.key, title: sm.title, color: sm.color, note: sm.note, factorGold: !!sm.factorGold };
        player.talentCap = (player.talentCap || 0) + (sm.talent || 0);
        if (sm.growth) player.growthPow = bumpGrowthPow(player.growthPow, sm.growth);
        if (sm.extra && ABILITIES[sm.extra] && !(player.abilities || []).includes(sm.extra) && (player.abilities || []).length < 6) player.abilities = [...(player.abilities || []), sm.extra];
        if (sm.gold && ABILITIES[sm.gold]) {
          if (!(player.abilities || []).includes(sm.gold) && (player.abilities || []).length < 6) player.abilities = [...(player.abilities || []), sm.gold];
          if ((player.abilities || []).includes(sm.gold)) { player.goldAbilities = [...(player.goldAbilities || [])]; if (!player.goldAbilities.includes(sm.gold)) player.goldAbilities.push(sm.gold); }
        }
      }
      // v33.2: 危険度。濃い血の代償として、稀に「ガラスの体」を持って生まれる（頑丈を継いでいれば発症しない）
      player.matingDanger = breed.danger || 0;
      if (breed.danger > 0 && !player.abilities.includes("tough") && !player.abilities.includes("glass") && Math.random() * 100 < breed.danger) {
        player.abilities = [...player.abilities, "glass"]; // 呪いは通常枠と別枠で背負う
        player.fragileBorn = true;
      }
      player.partner = partner.name;
      player.plusValue = breed.plusValue;
      player.generation = breed.generation;
      player.parentBloodIds = [legendBloodId(master), legendBloodId(partner)].filter(Boolean);
      const anc = new Set(player.parentBloodIds);
      legendAncestorSet(master).forEach(a => anc.add(a));
      legendAncestorSet(partner).forEach(a => anc.add(a));
      player.ancestorBloodIds = [...anc].slice(0, 12);
      player.joinOvr = overall(player);
    }
    // v31.2: 系統名（血統の系統）。師匠／親の系統を継ぎ、いなければ自分が始祖となって新系統を興す
    player.lineageName = master ? (master.lineageName || `${master.name}系`) : `${player.name}系`;
    // v33.3: 系統確立ボーナス（因子）。確立した系統を継ぐ子孫は伸びしろ＋系統特能を受け取る
    let bloodlineNote = null;
    const blb = mlBloodlineBonus(player.lineageName);
    if (blb) {
      player.bloodlineTier = blb.tier;
      player.talentCap = (player.talentCap || 0) + blb.talentCap;
      if (blb.growthSteps) player.growthPow = bumpGrowthPow(player.growthPow, blb.growthSteps);
      let gotFactor = false;
      if (blb.factor && ABILITIES[blb.factor]) {
        if (!(player.abilities || []).includes(blb.factor) && (player.abilities || []).length < 5) {
          player.abilities = [...(player.abilities || []), blb.factor];
          gotFactor = true;
        }
        // 大系統は系統因子を金特へ昇華する（既に持っていても金特化）
        if (blb.factorGold && (player.abilities || []).includes(blb.factor)) {
          player.goldAbilities = [...(player.goldAbilities || [])];
          if (!player.goldAbilities.includes(blb.factor)) { player.goldAbilities.push(blb.factor); gotFactor = true; }
        }
      }
      bloodlineNote = { tier: blb.tier, label: blb.label, factor: gotFactor ? blb.factor : null, gold: blb.factorGold && (player.abilities || []).includes(blb.factor) };
    }
    // v33.4: 純血の極み（特殊配合）は系統因子を金特へ昇華する。系統因子が無ければ得意脚質特能を金特化
    if (player.specialMating && player.specialMating.factorGold) {
      const fac = (blb && blb.factor) || { climb: "mount", sprint: "finisher", flat: "flatlander", solo: "soloist" }[master ? master.focus : player.focus];
      if (fac && ABILITIES[fac]) {
        if (!(player.abilities || []).includes(fac) && (player.abilities || []).length < 6) player.abilities = [...(player.abilities || []), fac];
        if ((player.abilities || []).includes(fac)) { player.goldAbilities = [...(player.goldAbilities || [])]; if (!player.goldAbilities.includes(fac)) player.goldAbilities.push(fac); }
      }
    }
    player.focus = type === "CLM" ? "climb" : type === "SPR" ? "sprint" : "flat";
    // v25: 個人スポンサー・メディア人気度。チーム年俸とは別枠で、戦績に応じて上がる
    // 知名度が個人スポンサー収入（月極＋節目の一時金）に反映される
    player.popularity = (perk.popBonus || 0) + cpPerks.pop; // v36(#4)/v37: 出自メリット＋生涯CP特典
    player.form = 50; // v29: ピーキング用のフォーム（50=平常）
    player.popMilestones = [];
    // v14.3: 経歴ごとの初任給（万円/年）。年俸・監督評価・資産はキャリア開始時に初期化する
    const initialSalary = { highschool: 220, university: 280, corporate: 360 }[background] || 260;
    const rival = mlCreateRival(rng, player.name, team.name);
    // v26: 複数ライバル制。2人目の好敵手も別チームに固定生成しておくが、最初の対戦まで
    // 本人には明かされず、レースで実際に相まみえた瞬間に「新たな好敵手」として紹介される
    const rival2 = mlCreateRival(rng, player.name, team.name, [rival.name], [rival.team]);
    // v25: 新人時代に指導してくれる恩師を1名設定する。在籍から3年目を迎えるまでの間、
    // 練習・出走経験の伸びにボーナスがかかり、3年目に「人生の岐路」として一区切りを迎える
    // v27: 師匠（プロテジェの師）を選んでいれば、その名選手本人が恩師として指導につく
    const mentorName = master ? master.name : pickRiderName(rng, new Set([player.name, rival.name, rival2.name]));
    const initLog = [
      `【1年目 4月】${bg.label}として${team.name}に新人選手加入`,
      `【1年目 4月】${rival.team}の${rival.name}が、これから長く続くライバルになりそうだ`,
    ];
    // v36(#4): 経歴ごとのメリットをログで明示（出自の選択に意味が出るように）
    if (bg.meritLabel) initLog.push(`【1年目 4月】${bg.meritLabel}：${bg.merit}`);
    if (master) {
      initLog.push(`【1年目 4月】かつての名選手・${master.name}の教え子としてデビュー。師の教え「${inh.teaching.label}」を授かり、${AB_LABEL[inh.keys[0]]}を受け継いだ`);
      initLog.push(`【1年目 4月】継承特性「${ABILITIES[inh.lineageTrait].label}」を身につけている（${inh.teaching.desc}）`);
      if (inh.inheritAbility) initLog.push(`【1年目 4月】さらに師匠直伝の特殊能力「${ABILITIES[inh.inheritAbility].label}」も受け継いだ`);
      if (breed) {
        initLog.push(`【1年目 4月】🧬 配合：${master.name}と${partner.name}、二人の血を引く逸材（${breed.nick.rank} ${breed.nick.label}／累代+${breed.plusPer}）`);
        if (breed.inbreed.count > 0) initLog.push(`【1年目 4月】🩸 共通の祖先を持つ濃い血のクロス（インブリード×${breed.inbreed.count}）。血が結晶し「${ABILITIES[breed.inbreedAb]?.label || breed.inbreedAb}」を宿す`);
        (breed.goldInherit || []).forEach(id => { if (player.abilities.includes(id)) initLog.push(`【1年目 4月】✨ 金特クロス！両親の血が重なり、特殊能力「${ABILITIES[id]?.label || id}」を最初から金特で受け継いだ`); });
        (breed.exclusive || []).forEach(id => { if (player.abilities.includes(id)) initLog.push(`【1年目 4月】🩸 配合限定特能「${ABILITIES[id]?.label || id}」を血に宿して誕生した`); });
        if (player.fragileBorn) initLog.push(`【1年目 4月】⚠️ 濃すぎる血の代償か、生まれつき体が脆く「ガラスの体」を抱えている…健康管理が鍵になる`);
      }
      if (player.lineageName) initLog.push(`【1年目 4月】この血統は「${player.lineageName}」と呼ばれている`);
      if (bloodlineNote) {
        initLog.push(`【1年目 4月】🏛 「${player.lineageName}」は${bloodlineNote.label}した名門血統。その因子を受け継いで生まれた（伸びしろ上昇）`);
        if (bloodlineNote.factor) initLog.push(`【1年目 4月】🧬 系統因子「${ABILITIES[bloodlineNote.factor]?.label || bloodlineNote.factor}」${bloodlineNote.gold ? "を金特で" : "を"}発現している`);
      }
      if (player.specialMating) initLog.push(`【1年目 4月】🌟 特殊配合『${player.specialMating.title}』発動！${player.specialMating.note}`);
    } else {
      initLog.push(`【1年目 4月】チームの${mentorName}が新人指導を買って出てくれた。しばらくは練習・出走の伸びに手心を加えてもらえそうだ`);
    }
    setMl(s => ({
      ...s, player, team: team.name, classIdx: 0, year: 1, month: 0, points: 0,
      difficulty: s.mlDiffChoice || "easy", // v38(#6): マイライフの難易度（相手強さ・CP倍率）
      races: [mlGenRace(1, 0, 0)],
      directive: mlGenDirective(1, 0, 0, 30),
      managerEval: 30 + (perk.evalBonus || 0) + cpPerks.eval, salary: initialSalary, money: (perk.moneyBonus || 0) + cpPerks.money + cpShop.money,
      partsInv: {}, stock: { drink: 0, supp: 0, tune: 0 },
      gear: { roller: false, monitor: false, chef: false, flatCoach: false, climbCoach: false, sprintCoach: false, staminaCoach: false, soloCoach: false },
      houseLv: -1, carLv: -1,
      rival, rivalRecord: { meetings: 0, wins: 0, losses: 0 },
      rival2, rivalRecord2: { meetings: 0, wins: 0, losses: 0 },
      flags: { ...s.flags, mentorName, mentorActive: true, master: master ? master.name : null },
      // v30: 世界ランキング＆アンビションを新規キャリア用に初期化
      worldPoints: 0, worldRank: null, worldRankBest: null,
      worldSeed: (Math.floor(Math.random() * 1e9) >>> 0) || 777, // v33.9: 生きた世界のシード
      ambitionIdx: 0, ambitionDone: [], ambitionPath: "victory",
      careerWins: 0, careerPodiums: 0, careerBigWins: 0, careerTitles: 0,
      // v32: 固定チームメイト・作戦・キャリア記録
      teammates: mlGenTeammates(rng, team.name, 5, [player.name, rival.name, rival2.name], 1),
      // v37: 永続ワールドロースター（各AIチーム固定の選手団）。毎レース同じ顔ぶれが出走する
      // v38(#9 A-3): 共有ワールドから取得＝新キャリアでも前回・シーズンと同じ世界（年を取った状態）で始まる
      worldRosters: sharedWorldRosters(),
      tactic: "balanced", careerHistory: [],
      log: initLog,
      // v36(#5リセマラ): デビュー前に素質を確認できる「素質診断」画面へ。引き直し（リセマラ）が
      // ここで完結する。確定するまで自動セーブは走らない（mylife_main のときだけ保存されるため）。
      screen: "mylife_scout",
    }));
  }
  // v36(#5リセマラ): 素質診断からの引き直し。直近の作成引数で再ロールし、素質診断に留まる。
  function mlRerollCandidate() {
    const a = mlCreateArgsRef.current;
    if (!a) return;
    mlCreateChar(a.type, a.background, a.master, a.partner);
  }
  // v36(#5リセマラ): この素質でデビュー確定。mylife_main へ遷移して初めて自動セーブが走る。
  function mlConfirmCandidate() {
    setMl(s => ({ ...s, screen: "mylife_main" }));
  }
  const mlSetFocus = (key) => setMl(s => mshSetFocus(s, key));
  // v18: シーズンモードのキャプテン制度に対応するマイライフ側の役割。30歳以降、
  // チームの精神的支柱（メンター）になることを選べる。一度なると解除はできない
  function mlBecomeMentor() {
    setMl(s => {
      if (s.protege) return s;
      // v35(逆メンター): メンターになると、有望な若手を1人「弟子」に取る。弟子は師（あなた）の
      // 地力に導かれ、年を追うごとに育っていく（protegeState で経過年数から算出）。
      const rng = mulberry(Date.now() % 999983 + 61);
      const types = ["SPR", "CLM", "RUL", "PUN", "TT"];
      const type = types[Math.floor(rng() * types.length)];
      const growthPow = rng() < 0.45 ? "S" : "A";
      const name = pickRiderName(rng, new Set([s.player?.name, s.rival?.name, s.rival2?.name].filter(Boolean)));
      const age0 = 17 + Math.floor(rng() * 3);
      const ovr0 = 46 + Math.floor(rng() * 10);
      const protege = { id: ridState.value++, name, type, age0, ovr0, growthPow, joinYear: s.year, mentorOvr: overall(s.player), bond: 20, guideBonus: 0, ovrBonus: 0, abilities: rollAbilities(rng), personality: "normal" };
      return {
        ...s, flags: { ...s.flags, mentor: true }, protege,
        log: [...s.log,
          `【${s.year}年目 ${MONTHS[s.month]}】チームの精神的支柱としてメンター役を引き受けた`,
          `【${s.year}年目 ${MONTHS[s.month]}】将来有望な若手 ${name}（${age0}歳・${TYPES[type].label}／成長力${growthPow}）を弟子に取り、指導を始めた`,
        ],
      };
    });
  }
  // v36(弟子深化): 弟子の指導イベントへの応答。選択に応じて弟子の絆(bond)・鍛錬(guideBonus)・
  // 即時加点(ovrBonus)と、師（プレイヤー）の疲労・評価・地力を反映し、結果画面へ。
  function mlResolveProtegeEvent(choiceIdx) {
    setMl(s => {
      const ev = s.pendingProtegeEvent;
      if (!ev || !s.protege) return { ...s, pendingProtegeEvent: null, screen: "mylife_main" };
      const ch = ev.choices[choiceIdx];
      const pd = ch.protege || {}, md = ch.mentor || {};
      const protege = {
        ...s.protege,
        bond: Math.min(100, (s.protege.bond || 0) + (pd.bond || 0)),
        guideBonus: Math.min(0.4, (s.protege.guideBonus || 0) + (pd.guideBonus || 0)),
        ovrBonus: (s.protege.ovrBonus || 0) + (pd.ovrBonus || 0),
      };
      let player = s.player;
      if (md.abBoost) { const cap = mlGrowthCap(s.year, player); player = { ...player }; AB_KEYS.forEach(k => { player[k] = Math.min(cap, (player[k] || 0) + md.abBoost); }); }
      const fatigue = Math.max(0, Math.min(100, (player.fatigue || 0) + (md.fatigueDelta || 0)));
      player = { ...player, fatigue };
      const managerEval = Math.max(0, Math.min(100, s.managerEval + (md.evalDelta || 0)));
      return { ...s, protege, player, managerEval, pendingProtegeEvent: null,
        eventResultText: ch.result, eventAdvanced: true,
        screen: "mylife_event_result" };
    });
  }
  // v36修正: レース後のライバル対話シーン。返答を選ぶと心情（メンタル）・人気・因縁度(heat)に反映し、
  // ライバルの反応（reply）を表示する。続けると号外（あれば）→翌月へ進む。
  function mlResolveRivalScene(choiceIdx) {
    setMl(s => {
      const scene = s.resultInfo && s.resultInfo.rivalOutcome && s.resultInfo.rivalOutcome.scene;
      if (!scene) return { ...s, screen: "mylife_result" };
      const resp = scene.responses[choiceIdx];
      const eff = resp.effects || {};
      let player = { ...s.player };
      if (eff.mentalDelta) growSub(player, "mental", eff.mentalDelta);
      if (eff.popularityDelta) player.popularity = Math.max(0, Math.min(100, (player.popularity || 0) + eff.popularityDelta));
      let rivalRecord = s.rivalRecord;
      if (eff.heatDelta) rivalRecord = { ...rivalRecord, heat: (rivalRecord && rivalRecord.heat || 0) + eff.heatDelta };
      return { ...s, player, rivalRecord, rivalSceneReply: resp };
    });
  }
  // 対話シーンを閉じて次へ（号外があればそちらへ、なければ翌月へ）
  function mlRivalSceneContinue() {
    const hasNewspaper = !!(ml.resultInfo && ml.resultInfo.newspaper);
    if (hasNewspaper) { setMl(s => ({ ...s, rivalSceneReply: null, screen: "mylife_newspaper" })); return; }
    setMl(s => ({ ...s, rivalSceneReply: null }));
    mlAdvanceMonth("race");
  }
  function mlStartRace() {
    if (mlRaceLockRef.current) return;
    mlRaceLockRef.current = true;
    let race = ml.races[0];
    // v28: 代表チームでの立場。世界選手権・オリンピックでは代表監督から役割が与えられる。
    // 監督評価が高い（信頼されている）ほどエースを任され、そうでなければアシスト役になる。
    // 役割はそのままレースでの立ち回り（directive）に反映される
    let directiveKey = ml.directive ? ml.directive.key : null;
    if (race.milestone && !race.nationalRole) {
      const natRole = ml.managerEval >= 55 ? "ace" : "support";
      race = { ...race, nationalRole: natRole };
      directiveKey = natRole;
      setMl(s => ({ ...s, races: [race, ...s.races.slice(1)] }));
    } else if (race.milestone && race.nationalRole) {
      directiveKey = race.nationalRole;
    }
    const worldStars = mlWorldStarsForYear(ml.worldSeed, ml.year, loadMlLegends());
    const protegeForRace = ml.protege ? { ...ml.protege, curOvr: protegeState(ml.protege, ml.year).ovr } : null;
    const sim = buildMyLifeSim(race, ml.player, ml.team, ml.classIdx, ml.difficulty || "easy", undefined, directiveKey, ml.rival, ml.year, ml.rival2, ml.teammates, ml.tactic, worldStars, ml.worldRosters, protegeForRace);
    // v29: 出走表を挟んでからレース本番へ（顔ぶれを確認できる）
    setMl(s => ({ ...s, result: sim, screen: "mylife_startlist" }));
  }
  // v27: ラストレース演出。引退前に「最後のレース」を特別に用意し、有終の美を飾れるようにする。
  // 脚質に合ったコースのグレード4エキシビションとして、両ライバルも駆けつける最高の舞台にする
  function mlStartLastRace() {
    if (mlRaceLockRef.current) return;
    mlRaceLockRef.current = true;
    const tmplByType = { SPR: TEMPLATES[0], CLM: TEMPLATES[3], RUL: TEMPLATES[2], PUN: TEMPLATES[2], TT: TEMPLATES[5] };
    const tmpl = tmplByType[ml.player.type] || TEMPLATES[2];
    const meta = { id: `ml-lastrace-${ml.year}`, name: `${ml.player.name} 引退記念ラストレース`, tmpl, grade: 4, cls: ml.classIdx, rivalPresent: true, rival2Present: true, weather: "clear", isLastRace: true };
    const protegeForRace = ml.protege ? { ...ml.protege, curOvr: protegeState(ml.protege, ml.year).ovr } : null;
    const sim = buildMyLifeSim(meta, ml.player, ml.team, ml.classIdx, ml.difficulty || "easy", undefined, "ace", ml.rival, ml.year, ml.rival2, ml.teammates, "aggressive", undefined, ml.worldRosters, protegeForRace);
    setMl(s => ({ ...s, result: sim, inLastRace: true, screen: "mylife_race" }));
  }
  // v41(§Step7第3弾): マイライフのレース結果確定は controllers/mylife/result.js の純関数に集約。
  // mlLastRaceFinish内のmlRecordLegend、mlRaceFinish内のrecordTitle(race.milestone)は呼ばず、
  // 各々のuseEffectへ移した（下記・詳細はDEVLOG §9参照）。mlRaceLockRef のリセットは元の位置
  // （setMl呼び出し前）を保つ。
  const mlLastRaceFinish = () => {
    mlRaceLockRef.current = false;
    setMl(mrLastRaceFinish);
  };
  const mlRaceFinish = () => {
    mlRaceLockRef.current = false;
    setMl(mrRaceFinish);
  };
  // v41(§Step7第3弾): マイライフの月次アクション・年度末処理は controllers/mylife/month.js の
  // 純関数に集約。非冪等なlocalStorage書き込み（advanceWorldYear）は呼ばず、ml.yearの変化を
  // 検知するuseEffectへ移した（下記・詳細はDEVLOG §9参照）。
  const mlAdvanceMonth = (mode) => setMl(s => mmAdvanceMonth(s, mode));
  // v28: 引退勧告への応答。pendingAdviceに次年度以降の続行state（オフシーズン画面）が
  // 既に格納済みなので、選択に応じてそこへ進む／役割縮小フラグを注入する／引退する
  function mlRetireAdviceContinue() {
    setMl(s => ({ ...s.pendingAdvice, pendingAdvice: null, adviceInfo: null,
      log: [...(s.pendingAdvice.log || s.log), `【${s.year}年目 3月】引退勧告を退け、現役続行を選んだ`] }));
  }
  function mlRetireAdviceReduceRole() {
    setMl(s => {
      const cont = s.pendingAdvice;
      const po = cont.pendingOffseason;
      // 次年度以降の状態へreducedRoleフラグを立てる（レース負荷が軽くなり現役を延命できる）
      const nextPO = { ...po, flags: { ...po.flags, reducedRole: true } };
      return { ...cont, pendingOffseason: nextPO, pendingAdvice: null, adviceInfo: null,
        flags: { ...s.flags, reducedRole: true },
        log: [...(cont.log || s.log), `【${s.year}年目 3月】役割を縮小してもう一年。レース負荷を抑えて現役を続ける`] };
    });
  }
  // v41(§Step7第3弾): mlRecordLegend（殿堂記録）はここで呼ばず、mlLastRaceFinishと同じく
  // "mylife_retired"画面への遷移を検知するuseEffect（mlClearAwardedRef）に一本化した。
  function mlRetireAdviceAccept() {
    setMl(s => {
      const retiredState = { ...s, pendingAdvice: null, adviceInfo: null };
      return { ...retiredState, screen: "mylife_retired",
        log: [...s.log, `【${s.year}年目 3月】チームの勧告を受け入れ、${s.player.age}歳で現役を退いた`] };
    });
  }
  // v15: 選んだオファーの条件（年俸倍率・契約金・エース確約）を実際に反映して契約を結ぶ
  // v16: 移籍先チームのtierがそのままプレイヤーの新classIdxになる（機材解放条件に直結）。
  // classIdxが変わる場合はそのtierに合わせてrace/directiveも生成し直す
  function mlChooseTeam(offer) {
    setMl(s => {
      const salary = Math.round(s.salary * offer.salaryMul);
      const money = s.money + offer.bonus;
      const classIdx = offer.tier != null ? offer.tier : s.classIdx;
      const classChanged = classIdx !== s.classIdx;
      const races = classChanged ? [mlGenRace(s.year, s.month, classIdx)] : s.races;
      const managerEval = s.managerEval;
      const directive = offer.aceGuarantee
        ? MANAGER_DIRECTIVES.ace
        : (classChanged ? mlGenDirective(s.year, s.month, classIdx, managerEval) : s.directive);
      let log = offer.bonus > 0 || offer.salaryMul > 1
        ? [...s.log, `【${s.year}年目 4月】${offer.team}と契約（年俸${salary}万円${offer.bonus > 0 ? `／契約金+${offer.bonus}万円` : ""}）`]
        : [...s.log];
      if (classChanged) {
        log = [...log, classIdx > s.classIdx
          ? `${offer.team}への移籍に伴い${CLASSES[classIdx].label}に昇格した！`
          : `${offer.team}への移籍に伴い${CLASSES[classIdx].label}に降格となった`];
      }
      // v32: 移籍で所属が変わったら固定チームメイトも新チームの顔ぶれに一新する
      const newTeammates = offer.team !== s.team
        ? mlGenTeammates(mulberry(Date.now() % 999983 + s.year * 13), offer.team, 5, [s.player.name, s.rival?.name, s.rival2?.name].filter(Boolean), s.year)
        : s.teammates;
      return { ...s, team: offer.team, classIdx, races, directive, salary, money, teammates: newTeammates, contractOffers: null, biddingWar: false, screen: "mylife_main", log };
    });
  }
  // v17: オフシーズンの過ごし方を確定する。年度末処理はpendingOffseasonに既に計算済みなので、
  // 選んだ効果をそこへ重ねてから結果画面へ進む
  function mlResolveOffseason(choiceIdx) {
    setMl(s => {
      const po = s.pendingOffseason;
      if (!po) return s;
      const choice = ML_OFFSEASON_CHOICES[choiceIdx];
      const player = choice.apply(po.player, po.year);
      return {
        ...s,
        pendingOffseason: { ...po, player },
        offseasonResultText: choice.result,
        screen: "mylife_offseason_result",
      };
    });
  }
  // オフシーズンの選択を終えたあとに、人生の岐路イベントの判定へ続ける（発生すればそちらへ、
  // なければそのままpendingOffseasonが持っていた本来の遷移先へ進む）
  function mlContinueAfterOffseason() {
    setMl(s => {
      const po = s.pendingOffseason;
      if (!po) return s;
      // v25: 恩師卒業の判定は「年が明けたあと」の年数を見る必要があるため、
      // 更新前のsではなく年度更新済みのpo（年度末処理の計算結果）を渡す
      const cr = mlRollCrossroads(po, po.player);
      if (cr) return { ...s, pendingOffseason: null, offseasonResultText: null, screen: "mylife_crossroads", pendingCrossroads: { key: cr.key, resolvedState: po } };
      return { ...po, pendingOffseason: null, offseasonResultText: null };
    });
  }
  // v15: 人生の岐路イベントの選択を確定する。年度末処理はpendingCrossroads.resolvedStateに
  // 既に計算済みなので、選んだ効果をそこへ重ねてから結果画面へ進む（時間は二重に進めない）
  function mlResolveCrossroads(choiceIdx) {
    setMl(s => {
      const pc = s.pendingCrossroads;
      if (!pc) return s;
      const cr = ML_CROSSROADS[pc.key];
      const choice = cr.choices[choiceIdx];
      const prevPlayer = pc.resolvedState.player;
      const { player, flags } = choice.apply(prevPlayer, s.flags || {});
      const note = choice.resultNote ? choice.resultNote(player, prevPlayer) : "";
      return {
        ...s,
        pendingCrossroads: { ...pc, resolvedState: { ...pc.resolvedState, player, flags } },
        crossroadsResultText: note ? `${choice.result}\n\n${note}` : choice.result,
        screen: "mylife_crossroads_result",
      };
    });
  }
  function mlContinueAfterCrossroads() {
    setMl(s => {
      const pc = s.pendingCrossroads;
      if (!pc) return s;
      return { ...pc.resolvedState, pendingCrossroads: null, crossroadsResultText: null };
    });
  }
  // v14.2: 私生活・取材イベント（練習/休養以外の月次アクション）
  function mlApplyEventEffects(player0, effects, year) {
    const player = { ...player0 };
    if (effects.fatigueDelta) player.fatigue = Math.max(0, Math.min(100, player.fatigue + effects.fatigueDelta));
    if (effects.abBoost) AB_KEYS.forEach(k => addAb(player, k, effects.abBoost, mlGrowthCap(year)));
    // v27: 個人スポンサー依頼イベント用。人気度も増減させられるようにする
    if (effects.popularityDelta) player.popularity = Math.max(0, Math.min(100, (player.popularity || 0) + effects.popularityDelta));
    // v36(#8): 私生活イベントを有意義に。メンタル（フォーム安定・大舞台に効く副ステータス）を育てられる
    if (effects.mentalDelta) growSub(player, "mental", effects.mentalDelta);
    // v36(#8): フォーム（当日の仕上がり）を直接動かせる（気分転換で調子が上向く等）
    if (effects.formDelta) player.form = Math.max(0, Math.min(100, (player.form ?? 50) + effects.formDelta));
    return player;
  }
  // v36(#8): イベントの効果を「人気+6・メンタル+2・疲労-8」の形で結果文に添え、手応えを明示する
  function eventEffectSummary(effects) {
    if (!effects) return "";
    const parts = [];
    if (effects.popularityDelta) parts.push(`人気${effects.popularityDelta > 0 ? "+" : ""}${effects.popularityDelta}`);
    if (effects.managerEvalDelta) parts.push(`監督評価${effects.managerEvalDelta > 0 ? "+" : ""}${effects.managerEvalDelta}`);
    if (effects.mentalDelta) parts.push(`メンタル+${effects.mentalDelta}`);
    if (effects.abBoost) parts.push(`能力+${effects.abBoost}`);
    if (effects.formDelta) parts.push(`フォーム${effects.formDelta > 0 ? "+" : ""}${effects.formDelta}`);
    if (effects.moneyDelta) parts.push(`+${effects.moneyDelta}万円`);
    if (effects.fatigueDelta) parts.push(`疲労${effects.fatigueDelta > 0 ? "+" : ""}${effects.fatigueDelta}`);
    return parts.length ? `（${parts.join("・")}）` : "";
  }
  function mlTriggerEvent() {
    setMl(s => {
      // v36(#9): プレイヤーの性格に応じた私生活イベントを半々で差し込む（性格を持つ選手のみ）
      const persPool = ML_PERSONALITY_EVENTS[s.player?.personality];
      const usePers = persPool && persPool.length && Math.random() < 0.5;
      const ev = usePers ? persPool[Math.floor(Math.random() * persPool.length)] : ML_EVENTS[Math.floor(Math.random() * ML_EVENTS.length)];
      return { ...s, pendingEvent: ev, screen: "mylife_event" };
    });
  }
  // v27: 個人スポンサーの依頼イベント。現在の人気度に応じて報酬が大きくなる仕事を1件生成する
  function mlTriggerSponsorGig() {
    setMl(s => {
      const pop = s.player.popularity || 0;
      const g0 = ML_SPONSOR_GIGS[Math.floor(Math.random() * ML_SPONSOR_GIGS.length)];
      const money = Math.round(g0.baseMoney + pop * g0.moneyPerPop);
      const gig = {
        title: g0.title, text: g0.text,
        choices: [
          { label: `引き受ける（+${money}万円・人気度+${g0.pop}・疲労+${g0.fatigue}）`, result: g0.acceptResult, effects: { moneyDelta: money, popularityDelta: g0.pop, fatigueDelta: g0.fatigue } },
          { label: "今回は辞退する", result: "今は競技に集中したいと、丁重に辞退した。", effects: { fatigueDelta: -3 } },
        ],
      };
      return { ...s, pendingEvent: gig, screen: "mylife_event" };
    });
  }
  function mlResolveEvent(choiceIdx) {
    setMl(s => {
      const ev = s.pendingEvent;
      if (!ev) return s;
      const choice = ev.choices[choiceIdx];
      const player = mlApplyEventEffects(s.player, choice.effects, s.year);
      const managerEval = Math.max(0, Math.min(100, s.managerEval + (choice.effects.managerEvalDelta || 0)));
      // v27: スポンサー依頼イベントの報酬（お金）を即時反映する
      const money = s.money + (choice.effects.moneyDelta || 0);
      // v36(#8): 得た成果を結果文に明示（手応えのないイベントにしない）
      const resultText = choice.result + " " + eventEffectSummary(choice.effects);
      return { ...s, player, money, managerEval, pendingEvent: null, eventResultText: resultText, screen: "mylife_event_result" };
    });
  }
  // v14.3: マイライフ専用ショップ（年俸で得た資金を使う）。パーツはPARTS/PART_SLOTSを
  // 選手1名向けに流用し、それ以外（消耗品・トレーニング用品・車・家）はマイライフ専用データを使う
  // v41(§Step7第2弾): マイライフ側shop/アイテム系の状態遷移は controllers/mylife/shop.js の純関数
  // （msh*）に集約。main.jsx側は setMl に接続する薄いラッパーのみを持つ。
  const mlBuyPart = (pid) => setMl(s => mshBuyPart(s, pid));
  const mlSetPart = (slot, pid) => setMl(s => mshSetPart(s, slot, pid));
  const mlBuyGear = (k) => setMl(s => mshBuyGear(s, k));
  const mlBuyStock = (k) => setMl(s => mshBuyStock(s, k));
  const mlUseStock = (k) => setMl(s => mshUseStock(s, k));
  // v20: 疲労が既に十分低い状態で回復アイテムを使うと、上限クランプで一部が無駄になる。
  // 気づかず使ってしまうのを防ぐため、無駄になる場合は先に確認ダイアログを挟む
  function mlUseStockConfirm(k) {
    const it = ML_STOCK_ITEMS[k];
    const player = ml.player;
    if (player && it.fatigueDelta && player.fatigue + it.fatigueDelta < 0) {
      const wasted = Math.round(Math.abs(player.fatigue + it.fatigueDelta));
      askConfirm(`疲労は現在${Math.round(player.fatigue)}です。${it.label}を使うと回復量の一部（約${wasted}）が無駄になります。それでも使いますか？`, () => mlUseStock(k));
      return;
    }
    if (player && it.formDelta && (player.form ?? 50) >= 92) {
      askConfirm(`フォームは既にほぼピーク（${Math.round(player.form ?? 50)}）です。${it.label}を使っても大半が無駄になります。それでも使いますか？`, () => mlUseStock(k));
      return;
    }
    mlUseStock(k);
  }
  const mlPrivateCamp = () => setMl(mshPrivateCamp);
  const mlBuyCar = () => setMl(mshBuyCar);
  const mlBuyHouse = () => setMl(mshBuyHouse);

  // ---- 購入・装備・アイテム ----
  // v41(§Step7第2弾): season側shop/roster系の状態遷移は controllers/season/{shop,roster}.js の純関数
  // （sh*/rs*）に集約。main.jsx側は setG に接続する薄いラッパーのみを持つ（Step7の移籍ドメインと同型）。
  const buyItem = (k) => setG(s => shBuyItem(s, k));
  const buyPart = (pid) => setG(s => shBuyPart(s, pid));
  const setPart = (rid, slot, pid) => setG(s => shSetPart(s, rid, slot, pid));
  const buyEquip = (k) => setG(s => shBuyEquip(s, k));
  const hireStaff = (k) => setG(s => shHireStaff(s, k));
  const hireObCoach = (hof) => setG(s => shHireObCoach(s, hof));
  const dismissObCoach = () => setG(shDismissObCoach);
  const signScout = (sc) => setG(s => rsSignScout(s, sc));
  const signFa = (fa) => setG(s => rsSignFa(s, fa));
  const useSupp = (rid) => setG(s => rsUseSupp(s, rid));
  const useTune = (rid) => setG(s => rsUseTune(s, rid));
  const setFocus = (rid, focus) => setG(s => rsSetFocus(s, rid, focus));
  const useCamp = () => setG(rsUseCamp);
  const toggleFavorite = (rid) => setG(s => rsToggleFavorite(s, rid));
  const setCaptain = (rid) => setG(s => rsSetCaptain(s, rid));
  const releaseRider = (rid) => setG(s => rsReleaseRider(s, rid));
  const signYouthProspect = () => setG(rsSignYouthProspect);
  const signBredYouth = (legA, legB) => { setG(s => rsSignBredYouth(s, legA, legB)); setBreedYouthSel(null); };
  // v17: 選手間トレード。受け入れると自チームの該当選手が抜け、相手が提示した選手が加入する
  const acceptTrade = (offerId) => setG(s => tfAcceptTrade(s, offerId));
  const declineTrade = (offerId) => setG(s => tfDeclineTrade(s, offerId));

  // ---- 共通 ----
  const Header = () => (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Eyebrow>{cls.label} — {g.year}年目 {MONTHS[g.month]}{g.dynastyLevel > 0 ? ` ／ 🔁 ディナスティ${g.dynastyLevel}周目` : ""}</Eyebrow>
          <div style={{ fontFamily: FONT_D, fontSize: 18, fontWeight: 700, color: C.text }}>{g.teamName || "あなたのチーム"}</div>
          {g.sponsor && <div style={{ fontSize: 10.5, color: C.sub }}>SPONSOR: {g.sponsor.name}（月+{g.sponsor.monthly}万／ノルマ{g.sponsor.norma}pt／未達-{g.sponsor.penalty}万／指定レース{g.sponsor.mandatesMet}済{g.sponsor.mandatesMissed > 0 ? `・見送り${g.sponsor.mandatesMissed}` : ""}）</div>}
          <div style={{ fontSize: 10.5, color: C.sub }}>
            選手維持費 -{g.roster.length * UPKEEP_PER_RIDER}万/月（{g.roster.length}名）
            {staffSalaryTotal(g.staff) > 0 && <>／スタッフ月給 -{staffSalaryTotal(g.staff)}万/月</>}
            {g.obCoach && <>／OBコーチ -{OB_COACH_SALARY}万/月</>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: FONT_M, fontSize: 18, color: g.budget < 0 ? C.red : C.yellow }}>{g.budget}<span style={{ fontSize: 10 }}>万円{g.budget < 0 ? "（借金）" : ""}</span></div>
          <div style={{ fontFamily: FONT_M, fontSize: 12, color: C.green }}>{g.points}pt <span style={{ color: C.sub }}>/ 出場権{cls.need}pt</span></div>
          {(() => { const sr = seasonRank(g); return (
            <div style={{ fontFamily: FONT_M, fontSize: 11, color: sr.rank <= 3 ? "#e8a13c" : C.sub }}>
              🏆 順位 {sr.rank}/{sr.total}位{sr.rank <= 3 ? "（昇格ボーダー緩和圏）" : ""}
            </div>
          ); })()}
        </div>
      </div>
    </div>
  );
  const Nav = () => (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {[["home", "🏁 レース"], ["riders", "👥 選手・練習"], ["shop", "🛒 ショップ"], ["career", "📜 記録"], ["help", "📖 ヘルプ"]].map(([k, l]) => (
        <button key={k} onClick={() => setG(s => ({ ...s, tab: k }))}
          style={{
            flex: 1, padding: "9px 4px", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: FONT_D, cursor: "pointer",
            background: g.tab === k ? C.yellow : C.panel, color: g.tab === k ? "#14171d" : C.sub,
            border: `1px solid ${g.tab === k ? C.yellow : C.line}`,
          }}>{l}</button>
      ))}
    </div>
  );
  // v29: 選手名変更モーダル（wrap/mlWrap両方で表示する共用JSX）
  const commitRename = () => { const v = (renameState.value || "").trim(); if (v) renameState.onCommit(v); setRenameState(null); };
  const renameModal = renameState && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%", border: `1px solid ${C.line}` }}>
        <div style={{ color: C.text, fontSize: 14, marginBottom: 12 }}>{renameState.title}</div>
        <input type="text" autoFocus value={renameState.value} maxLength={12}
          onChange={e => setRenameState(s => ({ ...s, value: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter") commitRename(); }}
          style={{ width: "100%", boxSizing: "border-box", background: C.panel2, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FONT_B }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn small outline color={C.sub} onClick={() => setRenameState(null)}>キャンセル</Btn>
          <Btn small color={C.green} onClick={commitRename}>変更</Btn>
        </div>
      </div>
    </div>
  );
  const wrap = (children, withNav) => (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT_B }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "6px 14px 40px" }}>
        <Header />
        {withNav && <Nav />}
        {children}
      </div>
      {renameModal}
      {/* v12バグ修正: window.confirm()に頼らない、アプリ内完結の確認モーダル */}
      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%", border: `1px solid ${C.line}` }}>
            <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-wrap" }}>{confirmDialog.message}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn small outline color={C.sub} onClick={() => setConfirmDialog(null)}>キャンセル</Btn>
              <Btn small color={C.red} onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }}>OK</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ================= v14: モード選択（タイトル） =================
  const mlWrap = (children) => (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT_B }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "6px 14px 40px" }}>
        {ml.player && (
          <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 12 }}>
            <Eyebrow>MY LIFE — {CLASSES[ml.classIdx].label} {ml.year}年目 {MONTHS[ml.month]}</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 16, fontWeight: 700, color: C.text }}>{ml.player.name}（{ml.team}）</div>
            <div style={{ fontSize: 11, color: C.sub }}>{ml.points}pt / 昇格権{CLASSES[ml.classIdx].need}pt</div>
            <div style={{ fontSize: 11, color: C.sub }}>所持金{ml.money}万円・年俸{ml.salary}万円（生活費/税 -{mlLivingCost(ml)}万/月）</div>
          </div>
        )}
        {children}
      </div>
      {renameModal}
      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%", border: `1px solid ${C.line}` }}>
            <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-wrap" }}>{confirmDialog.message}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn small outline color={C.sub} onClick={() => setConfirmDialog(null)}>キャンセル</Btn>
              <Btn small color={C.red} onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }}>OK</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (superMode === null) return wrap(
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 18, border: `1px solid ${C.line}` }}>
        <Eyebrow>MODE SELECT — v14</Eyebrow>
        <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 21, margin: "6px 0 10px" }}>プレイモードを選んでください</h2>
        <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.7, margin: 0 }}>
          シーズンモードは6名のロースターを率いるチーム運営、マイライフモードは選手1人のキャリアをB1から歩む新モードです。
        </p>
      </div>
      <Btn onClick={() => setSuperMode("season")}>🏢 シーズンモード（チーム運営）</Btn>
      <Btn outline onClick={() => setSuperMode("mylife")}>🚴 マイライフモード（選手キャリア）</Btn>
      <Btn outline color={"#e8a13c"} onClick={() => setSuperMode("prestige")}>🏆 生涯評価を見る</Btn>
    </div>
  );

  // v26: 生涯評価（プレステージスコア）。周回プレイをまたいで蓄積された記録を1画面に集約する
  if (superMode === "prestige") {
    const p = computePrestige();
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 22, borderTop: `4px solid ${"#e8a13c"}`, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <h2 style={{ fontFamily: FONT_D, color: "#e8a13c", fontSize: 26, margin: "8px 0" }}>生涯評価スコア</h2>
          <div style={{ fontFamily: FONT_M, fontSize: 32, color: C.text, fontWeight: 700 }}>{p.score.toLocaleString()}</div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>シーズンモード・マイライフモード両方のプレイ履歴から算出されます</div>
        </div>
        <div>
          <Eyebrow color={"#e8a13c"}>通算タイトル</Eyebrow>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, marginTop: 8, fontSize: 12.5, color: C.text, lineHeight: 1.8 }}>
            主要タイトル獲得数：<span style={{ color: "#e8a13c", fontFamily: FONT_M }}>{p.titleCount}回</span>（グランツール・グランファイナル・世界選手権・オリンピック）
          </div>
        </div>
        <div>
          <Eyebrow color={C.blue}>シーズンモード（周回プレイ）</Eyebrow>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, marginTop: 8, fontSize: 12.5, color: C.text, lineHeight: 1.8 }}>
            生涯獲得クリアポイント：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.totalEarnedCP}pt</span>
          </div>
        </div>
        <div>
          <Eyebrow color={C.red}>マイライフモード（歴代選手）</Eyebrow>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, fontSize: 12.5, color: C.text }}>
              引退した選手数：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.legendCount}名</span>
            </div>
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, fontSize: 12.5, color: C.text }}>
              通算勝利数：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.mlWins}勝</span>／通算表彰台：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.mlPodiums}回</span>
            </div>
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, fontSize: 12.5, color: C.text }}>
              通算実績達成数：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.mlAchieved}</span>
            </div>
          </div>
        </div>
        {/* v37: 生涯CPで解禁される内容の一覧（コース／シーズン開幕特典／マイライフ特典） */}
        {(() => {
          const rows = cpUnlockRows(p.totalEarnedCP);
          const nextLocked = rows.find(r => !r.unlocked);
          const catColor = { "コース": C.green, "シーズン開幕": C.blue, "マイライフ": C.red };
          return (
            <div>
              <Eyebrow color={C.yellow}>🔓 クリアポイント解禁一覧</Eyebrow>
              {nextLocked && (
                <div style={{ background: C.panel2, borderRadius: 8, padding: "8px 12px", marginTop: 8, fontSize: 11.5, color: C.text }}>
                  次の解禁まであと <b style={{ color: C.yellow, fontFamily: FONT_M }}>{nextLocked.cp - p.totalEarnedCP}pt</b>：{nextLocked.label}
                </div>
              )}
              <div style={{ background: C.panel, borderRadius: 10, border: `1px solid ${C.line}`, marginTop: 8, maxHeight: 300, overflowY: "auto" }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: `1px solid ${C.bg}`, opacity: r.unlocked ? 1 : 0.55 }}>
                    <span style={{ width: 30, textAlign: "right", fontFamily: FONT_M, fontSize: 11, color: r.unlocked ? C.green : C.sub }}>{r.unlocked ? "✓" : `${r.cp}`}</span>
                    <span style={{ fontSize: 9.5, color: catColor[r.category] || C.sub, border: `1px solid ${catColor[r.category] || C.line}`, borderRadius: 5, padding: "0 5px", flexShrink: 0 }}>{r.category}</span>
                    <span style={{ flex: 1, fontSize: 11.5, color: r.unlocked ? C.text : C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        {/* v38(#9 A-1): 統合ダイナスティ・ハブ。殿堂・系統・因子・系譜は両モード＆周回をまたいで
            共有される「あなたの王朝」の背骨。生涯評価（両モード共通の画面）から辿れるようにする。 */}
        <div style={{ background: "linear-gradient(180deg,#233026,#1d2a22)", borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.green}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
            <Eyebrow color={C.green}>🌳 あなたのダイナスティ</Eyebrow>
            <span style={{ fontSize: 11, color: C.green, fontFamily: FONT_M }}>🌍 世界 {loadWorldMeta().year} 年目</span>
          </div>
          <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 8px", lineHeight: 1.6 }}>歴代の名選手・確立した系統・集めた因子、そして世界のペロトンは、シーズンとマイライフの両方＆全周回で受け継がれる<b style={{ color: C.green }}>1つの世界</b>の資産です。世界はあなたが年を進めるたびに歳を取り、世代交代していきます。</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn small outline color={C.green} onClick={() => setSuperMode("dynasty_lineage")}>🌳 系譜ツリー</Btn>
            <Btn small outline color={"#e56cc8"} onClick={() => setSuperMode("dynasty_factors")}>🧬 因子図鑑</Btn>
          </div>
        </div>
        <Btn color={C.yellow} onClick={() => setSuperMode("cpshop")}>🛒 CPショップで解禁を購入する</Btn>
        <Btn outline color={C.sub} onClick={() => setSuperMode(null)}>← モード選択に戻る</Btn>
      </div>
    );
  }

  // v38(#9 A-1): 統合ダイナスティ — 系譜ツリー（両モード共通・生涯評価から開く）
  if (superMode === "dynasty_lineage") {
    const forest = mlLineageForest();
    const totalLeg = loadMlLegends().length;
    const tierColor = ["#7c8aa5", "#6fbf73", "#4f8fe8", "#ffd23f"];
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: "linear-gradient(180deg,#233026,#1d2a22)", borderRadius: 12, padding: 16, borderTop: `4px solid ${C.green}` }}>
          <h2 style={{ fontFamily: FONT_D, color: C.green, fontSize: 20, margin: "0 0 4px" }}>🌳 系譜ツリー</h2>
          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>歴代選手（{totalLeg}名）を系統（血の流れ）ごとにまとめました。配合を重ねると世代（🧬N代目）が進み、系統が「確立→名門→大系統」へ育ちます。</div>
        </div>
        {totalLeg === 0 && <div style={{ fontSize: 12.5, color: C.sub, padding: 10 }}>まだ殿堂選手がいません。マイライフで選手を引退させると系譜が始まります。</div>}
        {forest.map(g => (
          <div key={g.lineageName} style={{ background: C.panel, borderRadius: 12, padding: "12px 14px", border: `1px solid ${tierColor[g.tier.tier]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>{g.lineageName}</span>
              <span style={{ fontSize: 11, color: tierColor[g.tier.tier], fontWeight: 700 }}>{g.tier.label}{g.tier.tier > 0 ? `（因子+${g.tier.tier}）` : ""}・{g.size}名</span>
            </div>
            <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
              {g.members.map((m, i) => (
                <div key={i} style={{ paddingLeft: Math.min(4, m.generation) * 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12.5 }}>
                    <span style={{ color: C.sub, fontFamily: FONT_M, fontSize: 10 }}>{m.generation > 0 ? "└" : "●"}</span>
                    <span style={{ fontFamily: FONT_D, color: C.text, fontWeight: 700 }}>{m.name}</span>
                    <span style={{ fontSize: 10, color: TYPES[m.type]?.color }}>{TYPES[m.type]?.label}</span>
                    {m.generation > 0 && <span style={{ fontSize: 10, color: "#e56cc8" }}>🧬{m.generation}代目{m.plusValue > 0 ? `+${m.plusValue}` : ""}</span>}
                    <span style={{ fontSize: 10, color: C.sub }}>OVR{m.overall}</span>
                  </div>
                  {m.nickname && <div style={{ fontSize: 10, color: C.purple, fontStyle: "italic", paddingLeft: 16 }}>「{m.nickname}」</div>}
                  {m.parents.length > 0 && <div style={{ fontSize: 9.5, color: C.sub, paddingLeft: 16 }}>親：{m.parents.join(" × ")}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
        <Btn outline color={C.sub} onClick={() => setSuperMode("prestige")}>← 生涯評価に戻る</Btn>
      </div>
    );
  }

  // v38(#9 A-1): 統合ダイナスティ — 因子図鑑（両モード共通・生涯評価から開く）
  if (superMode === "dynasty_factors") {
    const cats = mlFactorCollection();
    const totalLeg = loadMlLegends().length;
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: "linear-gradient(180deg,#2e2436,#241d2c)", borderRadius: 12, padding: 16, borderTop: `4px solid #e56cc8` }}>
          <h2 style={{ fontFamily: FONT_D, color: "#e56cc8", fontSize: 20, margin: "0 0 4px" }}>🧬 因子図鑑</h2>
          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>歴代の殿堂選手（{totalLeg}名）が残した「因子」の集まりです。★＝その因子を持つ選手の数。周回を重ねるほど因子が貯まり、系統を通じて配合・弟子継承に受け継がれます。</div>
        </div>
        {totalLeg === 0 && <div style={{ fontSize: 12.5, color: C.sub, padding: 10 }}>まだ殿堂選手がいません。マイライフで選手を引退させると因子が集まり始めます。</div>}
        {cats.map(cat => (
          <div key={cat.category} style={{ background: C.panel, borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.line}` }}>
            <Eyebrow color={C.purple}>{cat.icon} {cat.category}</Eyebrow>
            {cat.items.length === 0 && <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>まだこの種類の因子はありません。</div>}
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {cat.items.map(it => (
                <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: C.bg, borderRadius: 8 }}>
                  <span style={{ fontFamily: FONT_D, fontSize: 13, color: it.color, fontWeight: 700, minWidth: 92 }}>{it.label}</span>
                  <span style={{ fontFamily: FONT_M, fontSize: 12, color: "#ffd23f", letterSpacing: -1 }}>{"★".repeat(Math.min(6, it.count))}{it.count > 6 ? ` ×${it.count}` : ""}</span>
                  <span style={{ flex: 1, fontSize: 10, color: C.sub, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.members.slice(0, 3).join("・")}{it.members.length > 3 ? "…" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Btn outline color={C.sub} onClick={() => setSuperMode("prestige")}>← 生涯評価に戻る</Btn>
      </div>
    );
  }

  // v37: CPショップ。貯めたCP残高で恒久解禁を購入する（自動ミルストーンとは別のプレミアム枠）。
  if (superMode === "cpshop") {
    const meta = loadMeta();
    const bal = cpBalance(meta);
    const catColor = { "シーズン": C.blue, "マイライフ": C.red, "特別": C.yellow };
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: "linear-gradient(180deg, rgba(255,210,63,0.10), #201e26)", borderRadius: 12, padding: 16, borderTop: `4px solid ${C.yellow}`, textAlign: "center" }}>
          <div style={{ fontSize: 30 }}>🛒</div>
          <h2 style={{ fontFamily: FONT_D, color: C.yellow, fontSize: 20, margin: "4px 0" }}>CPショップ</h2>
          <div style={{ fontSize: 12, color: C.sub }}>使えるCP残高</div>
          <div style={{ fontFamily: FONT_M, fontSize: 26, color: C.yellow, fontWeight: 800 }}>{bal}<span style={{ fontSize: 13 }}>pt</span></div>
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>生涯獲得 {meta.totalEarnedCP}pt ／ 使用済み {meta.cpSpent || 0}pt。購入は恒久で、次のシーズン/新人に反映されます</div>
        </div>
        {CP_SHOP.map((it) => {
          const owned = cpOwned(meta, it.id);
          const affordable = bal >= it.cost;
          return (
            <div key={it.id} style={{ background: C.panel, borderRadius: 10, border: `1px solid ${owned ? C.green : C.line}`, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, opacity: owned ? 0.85 : 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9.5, color: catColor[it.category] || C.sub, border: `1px solid ${catColor[it.category] || C.line}`, borderRadius: 5, padding: "0 5px" }}>{it.category}</span>
                  <span style={{ fontFamily: FONT_D, fontSize: 13.5, color: C.text, fontWeight: 700 }}>{it.label}</span>
                </div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{it.desc}</div>
              </div>
              {owned
                ? <span style={{ fontSize: 12, color: C.green, fontWeight: 700, whiteSpace: "nowrap" }}>✓ 解禁済</span>
                : <Btn small color={affordable ? C.yellow : C.sub} outline={!affordable} onClick={() => affordable && buyCpItem(it.id)}>{it.cost}pt</Btn>}
            </div>
          );
        })}
        <Btn outline color={C.sub} onClick={() => setSuperMode("prestige")}>← 生涯評価に戻る</Btn>
      </div>
    );
  }

  // ================= v14: マイライフモード 画面群 =================
  const ctx = { ML_MILESTONE_LABEL, acceptTrade, advanceMonth, askConfirm, availParts, breedYouthSel, buyEquip, buyItem, buyPart, cls, declineTrade, diffChoice, dismissObCoach, equipMax, expandedRiderId, g, grantTransferRequest, growthCap, healthy, hireObCoach, hireStaff, ml, mlAdvanceMonth, mlBecomeMentor, mlBuyCar, mlBuyGear, mlBuyHouse, mlBuyPart, mlBuyStock, mlChooseTeam, mlConfirmCandidate, mlContinueAfterCrossroads, mlContinueAfterOffseason, mlCreateChar, mlRerollCandidate, mlGenRace, mlLastRaceFinish, mlPrivateCamp, mlRaceFinish, mlRaceLockRef, mlResolveCrossroads, mlResolveEvent, mlResolveProtegeEvent, mlResolveRivalScene, mlRivalSceneContinue, mlResolveOffseason, mlRetireAdviceAccept, mlRetireAdviceContinue, mlRetireAdviceReduceRole, mlSetFocus, mlSetPart, mlStartLastRace, mlStartRace, mlTriggerEvent, mlTriggerSponsorGig, mlUseStockConfirm, mlWrap, openRename, raceFinishHandler, releaseRider, resolveEvent, retainRider, poachRetain, poachAccept, poachSign, rosterMax, setBreedYouthSel, setCaptain, setDiffChoice, setExpandedRiderId, setFocus, setG, setMl, setPart, setSuperMode, setTeamNameChoice, signBredYouth, signFa, signScout, signYouthProspect, staffMax, startNextStage, startRace, teamNameChoice, toggleFavorite, useCamp, useSupp, useTune, wrap };

  if (superMode === "mylife") return renderMyLifeScreens(ctx);

  // ================= 画面（シーズンモード） =================
  return renderSeasonScreens(ctx);
}


export default App;
createRoot(document.getElementById("root")).render(<App />);
