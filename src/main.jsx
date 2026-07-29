import { createRoot } from "react-dom/client";
import React, { useState, useRef, useEffect, useMemo } from "react";

// ---- 静的データ（src/data/*）----
import { C, FONT_D, FONT_B, FONT_M } from "./data/theme.js";
import { TYPES } from "./data/abilities.js";
import { CLASSES, DIFFICULTIES } from "./data/progression.js";
import { MONTHS, ROSTER_MAX_BY_CLASS, UPKEEP_PER_RIDER } from "./data/course.js";

// ---- コンポーネント（Phase 3）----
import { Btn, Eyebrow } from "./components/ui.jsx";

// ---- 純ロジック（src/core, sim, breeding, world, state）----
import { overall } from "./core/core.js";
import { PART_SLOTS, rankSim } from "./sim/race.js";
import { loadMlLegends, mlRecordLegend } from "./breeding/breeding.js";
import { mlWorldStarsForYear } from "./world/world.js";
import { buildMyLifeSim, computeAchievements, computePrestige, initGame, initMyLife, loadMeta, advanceWorldYear, loadWorldMeta, CP_SHOP, cpBalance, cpBuy, cpOwned, recordTitle, saveGame, saveMeta, saveMyLife } from "./state/state.js";

// ---- App から使う表示層（Phase 4-1）----
import { ML_STOCK_ITEMS, STAFF_MAX_BY_CLASS, buildSim, computeClearPoints, computeMyLifeClearPoints, cpUnlockRows, computeSeasonAchievements, mlLivingCost, mlFactorCollection, mlLineageForest, protegeState, noteAbilityDiscovery, persistCourseRecord, seasonRank, staffSalaryTotal } from "./logic/support.js";
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
import { prepareRaceInputs, prepareNextStageSquad, beginNextStage } from "./controllers/season/raceStart.js";
import { resolveNationalRole, buildLastRaceMeta } from "./controllers/mylife/raceStart.js";
import { mlCreateChar as domainMlCreateChar } from "./domain/mylife/createChar.js";
import {
  mlBecomeMentor as mcBecomeMentor, mlChooseTeam as mcChooseTeam,
  mlRetireAdviceContinue as mcRetireAdviceContinue, mlRetireAdviceReduceRole as mcRetireAdviceReduceRole,
  mlRetireAdviceAccept as mcRetireAdviceAccept, mlResolveOffseason as mcResolveOffseason,
  mlContinueAfterOffseason as mcContinueAfterOffseason, mlResolveCrossroads as mcResolveCrossroads,
  mlContinueAfterCrossroads as mcContinueAfterCrossroads,
} from "./controllers/mylife/career.js";
import {
  mlResolveProtegeEvent as meResolveProtegeEvent, mlResolveRivalScene as meResolveRivalScene,
  mlRivalSceneContinue as meRivalSceneContinue, mlTriggerEvent as meTriggerEvent,
  mlTriggerSponsorGig as meTriggerSponsorGig, mlResolveEvent as meResolveEvent,
} from "./controllers/mylife/event.js";

// ---------- メインアプリ ----------
function App() {
  const [g, setG] = useState(initGame);
  // v14: マイライフモードはシーズンモードとは完全に別の状態を持つ（タイトル画面で選択）。
  // superMode: null=モード未選択（タイトル）／"season"=既存のチーム運営／"mylife"=新モード
  const [superMode, setSuperMode] = useState(null);
  const [uiTick, setUiTick] = useState(0); // v37: CPショップ購入後の再描画トリガー
  const buyCpItem = (id) => { const meta = loadMeta(); const next = cpBuy(meta, id); if (next !== meta) { saveMeta(next); setUiTick(t => t + 1); } };
  const [ml, setMl] = useState(initMyLife);
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
  // v41(§Step7第4弾): コースレコードの実書き込み（persistCourseRecord）。以前はfinishRace/
  // mlRaceFinishのreducer内でrecordCourseResultが読み取りと書き込みを同時に行っていた。
  // reducerはpeekCourseRecord（読み取りのみ）に差し替え済みなので、"result"/"mylife_result"
  // 画面への遷移を検知し、courseRecord.isNewが立っている時だけ1回書き込む。
  const courseRecordRef = useRef(false);
  useEffect(() => {
    if (g.screen === "result" && !courseRecordRef.current) {
      courseRecordRef.current = true;
      if (g.prizeInfo && g.prizeInfo.courseRecord) persistCourseRecord(g.prizeInfo.courseRecord, g.year);
    }
    if (g.screen !== "result") courseRecordRef.current = false;
  }, [g.screen]);
  const mlCourseRecordRef = useRef(false);
  useEffect(() => {
    if (ml.screen === "mylife_result" && !mlCourseRecordRef.current) {
      mlCourseRecordRef.current = true;
      if (ml.resultInfo && ml.resultInfo.courseRecord) persistCourseRecord(ml.resultInfo.courseRecord, ml.year);
    }
    if (ml.screen !== "mylife_result") mlCourseRecordRef.current = false;
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
  // v41(§Step7第5弾): 入力組み立て（squad/aceId/itemBoost/directiveの算出）のみ
  // controllers/season/raceStart.js の純関数へ抽出。
  // v41(§Step7第8弾): startRaceには連打防止ガードが元から無く、コミット前（1レンダー分）に
  // 2連打するとsetG(u1)/setG(u2)が両方キューされ、inv.wheel/suitの二重消費に加え、
  // setTimeoutも2回スケジュールされてfinishRaceが2回走り賞金・ポイントが二重加算される
  // 実バグがあった（PROセーブ注入で高速2連打し実機で再現・確認済み）。setTimeout(0)を廃止し、
  // setGのupdaterに「screenが"lineup"のままでなければno-op」というガードを追加。連打の
  // 2発目のupdaterはこのガードでno-opになる。結果確定（旧setTimeout→finishRace）は
  // "result_pending"画面への遷移を検知する下のuseEffectへ委譲した。
  function startRace(watch) {
    const race = g.races.find(r => r.id === g.sel.raceId);
    const { squad, aceId, itemBoost, directive } = prepareRaceInputs(race, g.roster, g.sel, g.homeRegion);
    // v29: 出走表用に事前生成した相手チーム布陣があればそれを使い、顔ぶれを一致させる
    const { sim, aiTeams } = buildSim(race, squad, aceId, g.sel.roles, g.equip, itemBoost, g.classIdx, g.pendingAiTeams, race.stageRace ? "day1" : undefined, directive, g.difficulty, g.rivalAlumni, g.dynastyLevel, g.teamName, g.rivalRosters, g.year);
    // v35(チームTT): チームTTはペロトン演出を持たないため、観戦を選んでも結果画面へ直行する
    const effWatch = race.tmpl.teamTT ? false : watch;
    setG(s => s.screen !== "lineup" ? s : ({
      ...s, result: sim,
      gc: race.stageRace ? { race, aceId, roles: s.sel.roles, starters: s.sel.starters, aiTeams, watch: effWatch, stage: 1, directive, stageTimes: {}, dayLogs: [] } : s.gc,
      inv: { ...s.inv, wheel: s.inv.wheel - (itemBoost.wheel ? 1 : 0), suit: s.inv.suit - (itemBoost.suit ? 1 : 0) },
      screen: effWatch ? "race" : "result_pending",
    }));
  }

  // v41(§Step7第7弾): startNextStageの二相化。以前はuseRefロック（stage2LockRef）＋
  // setGのupdater内でのbuildSim呼び出し＋simResult/raceRefのクロージャ変数への「密輸」で
  // 次ステージ開始後のsetTimeoutにsim/raceを渡していたが、useRefロックはレンダーと無関係に
  // 生存するため解除漏れが起きやすく（第6弾で実際にバグを踏んだ）、密輸パターンもupdaterが
  // 複数回呼ばれ得ることを前提にすると本質的に脆い。フェーズ1（本関数）はgc.pendingStage等の
  // 「意図」を確定するだけの純粋なsetGとし、実際のbuildSim呼び出しと結果確定は、その意図を
  // 観測する下のuseEffect（フェーズ2）に一本化した。ロックはgc.pendingStageの有無そのものが
  // 兼ねるため、useRefという別チャンネルの状態を持つ必要がなくなった。
  const startNextStage = () => setG(beginNextStage);

  // v41(§Step7第7弾): startNextStageのフェーズ2。gc.pendingStageが確定した直後にのみ発火し、
  // 常に最新のg（レンダー確定済みの値）からbuildSimを呼ぶため、stale closureの心配がない。
  // buildSimが例外を投げた場合はここでは握り潰さず、そのまま外へ伝播させる（pendingStageが
  // 残ったままになるが、それは「壊れている」ことが画面上も分かる形で止まるほうが、中途半端な
  // 状態を握り潰して次の操作を誤動作させるより安全という判断）。
  // v41(§Step7第8弾): スキップ経路の結果確定（旧：ここでの直接finishRace呼び出し）は、
  // startRaceと同じく"result_pending"画面への遷移を検知する下のuseEffectへ委譲した
  // （2箇所に分かれていたfinishRace呼び出しを1箇所に統合）。
  useEffect(() => {
    const gc = g.gc;
    if (!gc || !gc.pendingStage) return;
    const nextStage = gc.pendingStage;
    // v41(§Step7第7弾): aceId/rolesは既にフェーズ1（beginNextStage）でgc.pendingAceId/pendingRolesとして
    // 確定済みのため、prepareNextStageSquadが返すaceId/rolesは使わず、roster2/squad（疲労反映済みの
    // ロスター）だけを再利用する
    const { roster2, squad } = prepareNextStageSquad(g, gc);
    // v13: 各日ともステージ1で選んだ作戦（gc.directive）をそのまま引き継ぐ
    const { sim } = buildSim(gc.race, squad, gc.pendingAceId, gc.pendingRoles, g.equip, { wheel: false, suit: false }, g.classIdx, gc.aiTeams, `day${nextStage}`, gc.directive, g.difficulty, undefined, g.dynastyLevel, g.teamName, g.rivalRosters, g.year);
    setG(s => ({
      ...s, roster: roster2, result: sim,
      gc: { ...s.gc, stage: nextStage, aceId: gc.pendingAceId, roles: gc.pendingRoles, pendingStage: null, pendingAceId: null, pendingRoles: null },
      screen: gc.watch ? "race" : "result_pending",
    }));
  }, [g.gc?.pendingStage]);

  // v41(§Step7第8弾): スキップ経路（結果だけ見る）の結果確定を"result_pending"画面への
  // 遷移そのものへ一本化した。以前はstartRace側のsetTimeout(0)とstartNextStageのフェーズ2の
  // 2箇所でそれぞれfinishRaceを直接呼んでいたが、setTimeoutはsetGのupdaterガードの外側で
  // 無条件にスケジュールされるため連打時に二重実行され得た（詳細は各関数のコメント参照）。
  // "result_pending"はスキップ経路専用の中間画面としてすでに存在するため、その画面への
  // 遷移を1回検知して1回だけfinishRaceを呼ぶ形にすれば、呼び出し元がstartRace／
  // startNextStageのどちらでも二重発火の心配がなくなる。srFinishRace側でsim.teamTTを見て
  // finishTeamTTへ委譲する既存の分岐があるため、チームTTもこの経路でそのまま処理される。
  // 注意：g.gcはステージレース終了後（gc_final到達後）もクリアされず残留するため、
  // 「ステージレースかどうか」の判定にg.gcの有無やg.gc.raceを使うと、グランツール完走後に
  // 単発レースを始めた場合に古いgcを誤って参照する（旧startRaceのsetTimeoutは呼び出し時に
  // 捕捉したraceのローカル変数を使っていたためこの問題が無かった）。raceMeta.stageRaceは
  // 常に「今まさに確定させようとしているレースそのもの」の性質なので、これだけを判定に使い、
  // g.gc.stageは「raceMeta.stageRaceがtrueの場合に限り」参照する（この場合はstartRace／
  // startNextStageフェーズ2のどちらも必ずgc.race===raceMetaを保って更新するため安全）。
  useEffect(() => {
    if (g.screen !== "result_pending") return;
    const race = g.result.raceMeta;
    finishRace(g.result, race, race.stageRace ? g.gc.stage : undefined);
  }, [g.screen]);

  // stageOverride: skip経路（結果だけ見る）はステージ番号を明示で渡し、
  // setG後にgが更新前のまま参照される（stale closure）事故を避ける
  // v41(§Step7第3弾): レース結果確定は controllers/season/result.js の純関数に集約。
  // finishStage内のrecordTitle("grandTour")は呼ばず、返り値gc.justWonGrandTourフラグを見た
  // useEffectへ移した（詳細はDEVLOG §9参照）。
  // v41(§Step7第5弾・退行修正): rankSim(sim)はsimを破壊的に変更しMath.random()でジッターを掛けるため、
  // setGのupdater内で呼ぶと再実行時に着順が変わり得る。第3弾のreducer化でうっかりupdater内へ
  // 移動していたのを、元の位置（setGを呼ぶ前に1回だけ）へ戻した。
  const finishRace = (sim, race, stageOverride) => {
    rankSim(sim);
    setG(s => srFinishRace(s, sim, race, stageOverride));
  };
  const finishTeamTT = (sim, race) => setG(s => srFinishTeamTT(s, sim, race));
  const finishStage = (sim, race, stageOverride) => setG(s => srFinishStage(s, sim, race, stageOverride));

  const raceFinishHandler = () => {
    if (g.gc && g.gc.race.stageRace) finishStage(g.result, g.gc.race, g.gc.stage);
    else finishRace(g.result, g.result.raceMeta);
  };

  // ==== v14: マイライフモード専用ハンドラ ====
  // v41(§Step7第3弾): mlGenRace（月次レース生成）は domain/mylife/race.js へ移動（複数箇所から
  // 参照される純粋なジェネレータのため controllers/ ではなく domain/ に置いた）。
  const ML_MILESTONE_LABEL = { worlds: { eyebrow: "🌍 世界選手権", color: C.blue }, olympics: { eyebrow: "🥇 オリンピック", color: C.yellow } };
  // v41(§Step7第9弾): mlCreateChar本体（237行）を domain/mylife/createChar.js へ抽出。
  // loadMeta()（生涯CP特典の読み取り）はApp側で呼び、cpMetaとして純関数へ引数で渡す
  // （呼び出し側だけがlocalStorageに触れる形に統一。第5弾のprepareRaceInputsと同じ型）。
  function mlCreateChar(type, background, master, partner) {
    mlCreateArgsRef.current = { type, background, master, partner }; // v36(#5): 引き直し用に保持
    const cpMeta = loadMeta();
    setMl(s => domainMlCreateChar(s, type, background, master, partner, cpMeta));
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
  // v41(§Step7第9弾): メンター就任・弟子イベント・ライバル対話は controllers/mylife/event.js
  // （mlResolveProtegeEvent/mlResolveRivalScene/mlRivalSceneContinue）と
  // controllers/mylife/career.js（mlBecomeMentor）の純関数に集約。main.jsx側は
  // setMlに接続する薄いラッパーのみを持つ（詳細はDEVLOG §9参照）。
  const mlBecomeMentor = () => setMl(mcBecomeMentor);
  const mlResolveProtegeEvent = (choiceIdx) => setMl(s => meResolveProtegeEvent(s, choiceIdx));
  const mlResolveRivalScene = (choiceIdx) => setMl(s => meResolveRivalScene(s, choiceIdx));
  const mlRivalSceneContinue = () => setMl(meRivalSceneContinue);
  // v41(§Step7第5弾): 入力組み立て（代表役割の解決・ラストレースmeta構築）のみ
  // controllers/mylife/raceStart.js の純関数へ抽出。
  // v41(§Step7第8弾): mlRaceLockRef（useRefロック）を廃止し、「ロックがtrueの間＝
  // screenがmylife_main以外」という不変条件（開始ボタんは両方ともmylife_main画面にしか
  // 無いため常に成立する）に基づき、画面そのものをガードとして使う二段構えに変更した。
  // 関数先頭のガードは無駄なsim構築を避けるだけの早期リターンで、二重発火防止の本命は
  // setMlのupdater内での再チェック（updaterは常に最新のsを受け取るため、連打の2発目は
  // ここでno-opになる）。setMlは1回に統合した（以前はraces更新とresult更新で2回呼んでいた）。
  function mlStartRace() {
    if (ml.screen !== "mylife_main") return;
    const baseDirectiveKey = ml.directive ? ml.directive.key : null;
    const { race, directiveKey } = resolveNationalRole(ml.races[0], ml.managerEval, baseDirectiveKey);
    const worldStars = mlWorldStarsForYear(ml.worldSeed, ml.year, loadMlLegends());
    const protegeForRace = ml.protege ? { ...ml.protege, curOvr: protegeState(ml.protege, ml.year).ovr } : null;
    const sim = buildMyLifeSim(race, ml.player, ml.team, ml.classIdx, ml.difficulty || "easy", undefined, directiveKey, ml.rival, ml.year, ml.rival2, ml.teammates, ml.tactic, worldStars, ml.worldRosters, protegeForRace);
    // v29: 出走表を挟んでからレース本番へ（顔ぶれを確認できる）
    setMl(s => s.screen !== "mylife_main" ? s : ({
      ...s, races: race !== ml.races[0] ? [race, ...s.races.slice(1)] : s.races,
      result: sim, screen: "mylife_startlist",
    }));
  }
  function mlStartLastRace() {
    if (ml.screen !== "mylife_main") return;
    const meta = buildLastRaceMeta(ml.player, ml.year, ml.classIdx);
    const protegeForRace = ml.protege ? { ...ml.protege, curOvr: protegeState(ml.protege, ml.year).ovr } : null;
    const sim = buildMyLifeSim(meta, ml.player, ml.team, ml.classIdx, ml.difficulty || "easy", undefined, "ace", ml.rival, ml.year, ml.rival2, ml.teammates, "aggressive", undefined, ml.worldRosters, protegeForRace);
    setMl(s => s.screen !== "mylife_main" ? s : ({ ...s, result: sim, inLastRace: true, screen: "mylife_race" }));
  }
  // v41(§Step7第3弾): マイライフのレース結果確定は controllers/mylife/result.js の純関数に集約。
  // mlLastRaceFinish内のmlRecordLegend、mlRaceFinish内のrecordTitle(race.milestone)は呼ばず、
  // 各々のuseEffectへ移した（下記・詳細はDEVLOG §9参照）。
  const mlLastRaceFinish = () => setMl(mrLastRaceFinish);
  const mlRaceFinish = () => setMl(mrRaceFinish);
  // v41(§Step7第3弾): マイライフの月次アクション・年度末処理は controllers/mylife/month.js の
  // 純関数に集約。非冪等なlocalStorage書き込み（advanceWorldYear）は呼ばず、ml.yearの変化を
  // 検知するuseEffectへ移した（下記・詳細はDEVLOG §9参照）。
  const mlAdvanceMonth = (mode) => setMl(s => mmAdvanceMonth(s, mode));
  // v41(§Step7第9弾): 引退勧告・移籍先選択・オフシーズン・人生の岐路は
  // controllers/mylife/career.js の純関数に集約。main.jsx側はsetMlに接続する
  // 薄いラッパーのみを持つ（詳細はDEVLOG §9参照）。
  const mlRetireAdviceContinue = () => setMl(mcRetireAdviceContinue);
  const mlRetireAdviceReduceRole = () => setMl(mcRetireAdviceReduceRole);
  const mlRetireAdviceAccept = () => setMl(mcRetireAdviceAccept);
  const mlChooseTeam = (offer) => setMl(s => mcChooseTeam(s, offer));
  const mlResolveOffseason = (choiceIdx) => setMl(s => mcResolveOffseason(s, choiceIdx));
  const mlContinueAfterOffseason = () => setMl(mcContinueAfterOffseason);
  const mlResolveCrossroads = (choiceIdx) => setMl(s => mcResolveCrossroads(s, choiceIdx));
  const mlContinueAfterCrossroads = () => setMl(mcContinueAfterCrossroads);
  // v41(§Step7第9弾): 私生活・取材イベント／個人スポンサー依頼は controllers/mylife/event.js
  // の純関数に集約。main.jsx側はsetMlに接続する薄いラッパーのみを持つ。
  const mlTriggerEvent = () => setMl(meTriggerEvent);
  const mlTriggerSponsorGig = () => setMl(meTriggerSponsorGig);
  const mlResolveEvent = (choiceIdx) => setMl(s => meResolveEvent(s, choiceIdx));
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
  const ctx = { ML_MILESTONE_LABEL, acceptTrade, advanceMonth, askConfirm, availParts, breedYouthSel, buyEquip, buyItem, buyPart, cls, declineTrade, diffChoice, dismissObCoach, equipMax, expandedRiderId, g, grantTransferRequest, growthCap, healthy, hireObCoach, hireStaff, ml, mlAdvanceMonth, mlBecomeMentor, mlBuyCar, mlBuyGear, mlBuyHouse, mlBuyPart, mlBuyStock, mlChooseTeam, mlConfirmCandidate, mlContinueAfterCrossroads, mlContinueAfterOffseason, mlCreateChar, mlRerollCandidate, mlGenRace, mlLastRaceFinish, mlPrivateCamp, mlRaceFinish, mlResolveCrossroads, mlResolveEvent, mlResolveProtegeEvent, mlResolveRivalScene, mlRivalSceneContinue, mlResolveOffseason, mlRetireAdviceAccept, mlRetireAdviceContinue, mlRetireAdviceReduceRole, mlSetFocus, mlSetPart, mlStartLastRace, mlStartRace, mlTriggerEvent, mlTriggerSponsorGig, mlUseStockConfirm, mlWrap, openRename, raceFinishHandler, releaseRider, resolveEvent, retainRider, poachRetain, poachAccept, poachSign, rosterMax, setBreedYouthSel, setCaptain, setDiffChoice, setExpandedRiderId, setFocus, setG, setMl, setPart, setSuperMode, setTeamNameChoice, signBredYouth, signFa, signScout, signYouthProspect, staffMax, startNextStage, startRace, teamNameChoice, toggleFavorite, useCamp, useSupp, useTune, wrap };

  if (superMode === "mylife") return renderMyLifeScreens(ctx);

  // ================= 画面（シーズンモード） =================
  return renderSeasonScreens(ctx);
}


export default App;
createRoot(document.getElementById("root")).render(<App />);
