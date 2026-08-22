// シーズンモードの状態(g)・派生値・useEffect・ハンドラを1つにまとめたフック。Step7第10弾。
// 外部依存は無し（mylife/shell側の状態やsetterを一切参照しない。詳細はDEVLOG §9参照）。
import { useEffect, useRef, useState } from "react";
import { CLASSES, DIFFICULTIES } from "../data/progression.js";
import { ROSTER_MAX_BY_CLASS } from "../data/course.js";
import { PART_SLOTS } from "../sim/race.js";
import { buildSim, STAFF_MAX_BY_CLASS, computeClearPoints, computeSeasonAchievements, noteAbilityDiscovery, persistCourseRecord } from "../logic/support.js";
import { advanceWorldYear, initGame, loadMeta, recordTitle, saveGame, saveMeta } from "../state/state.js";
import {
  retainRider as tfRetainRider, grantTransferRequest as tfGrantTransferRequest,
  poachRetain as tfPoachRetain, poachAccept as tfPoachAccept, poachSign as tfPoachSign,
  acceptTrade as tfAcceptTrade, declineTrade as tfDeclineTrade,
} from "../controllers/season/transfer.js";
import {
  buyItem as shBuyItem, buyPart as shBuyPart, setPart as shSetPart, buyEquip as shBuyEquip,
  buyRoomUpgrade as shBuyRoomUpgrade,
  hireStaff as shHireStaff, hireObCoach as shHireObCoach, dismissObCoach as shDismissObCoach,
} from "../controllers/season/shop.js";
import {
  signScout as rsSignScout, signFa as rsSignFa, useSupp as rsUseSupp, useTune as rsUseTune,
  setFocus as rsSetFocus, useCamp as rsUseCamp, toggleFavorite as rsToggleFavorite,
  setCaptain as rsSetCaptain, releaseRider as rsReleaseRider, signYouthProspect as rsSignYouthProspect,
  signBredYouth as rsSignBredYouth,
} from "../controllers/season/roster.js";
import { resolveEvent as seResolveEvent } from "../controllers/season/event.js";
import { advanceMonth as smAdvanceMonth } from "../controllers/season/month.js";
import { finishRace as srFinishRace, finishTeamTT as srFinishTeamTT, finishStage as srFinishStage } from "../controllers/season/result.js";
import { prepareRaceInputs, prepareNextStageSquad, beginNextStage } from "../controllers/season/raceStart.js";

export function useSeasonGame() {
  const [g, setG] = useState(initGame);
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
  const rosterMax = ROSTER_MAX_BY_CLASS[g.classIdx] + (g.rosterMaxBonus || 0);
  const staffMax = STAFF_MAX_BY_CLASS[g.classIdx] + (g.staffMaxBonus || 0);
  // v14.11: 「限界突破」表示のしきい値は難易度ごとの成長上限（growthCap）と
  // 一致させる（以前は難易度に関わらず固定95だったため、上位難易度で実際の
  // ソフトキャップ〈102/112〉と表示上のしきい値〈95〉がズレていた）
  const growthCap = (DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).growthCap;

  // v10: main画面に到達するたびに自動保存
  useEffect(() => {
    if (g.screen === "main") { saveGame(g); noteAbilityDiscovery(g.roster); }
  }, [g]);

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
  const equippedCount = (pid) => g.roster.reduce((s, r) => s + (PART_SLOTS.reduce((n, sl) => n + (r.parts[sl] === pid ? 1 : 0), 0)), 0);
  const availParts = (pid) => (g.partsInv[pid] || 0) - equippedCount(pid);

  // v41(§Step7第3弾): 月次更新・年度末処理は controllers/season/month.js の純関数に集約。
  // 非冪等なlocalStorage書き込み（recordTitle/advanceWorldYear）は呼ばず、g.yearの変化・
  // "clear"画面への遷移を検知するuseEffectへ移した（上記・詳細はDEVLOG §9参照）。
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
    // v46(#34): 個人TTも同様。駆け引きの無い競技で観戦の情報価値が薄いというユーザー判断に加え、
    // simがMAX_TICKS到達で打ち切られるレース（山岳系）で観戦が破綻する問題（§36参照）の
    // 露出も避けられる。
    const effWatch = (race.tmpl.teamTT || race.tmpl.soloTT) ? false : watch;
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
    // 第17弾C: 機材セットアップ（無料）はグランツールの初日に選んだものを全ステージへ引き継ぐ
    // （wheel/suitは1回限りの消耗品のため引き継がない・従来通り）
    const { sim } = buildSim(gc.race, squad, gc.pendingAceId, gc.pendingRoles, g.equip, { wheel: false, suit: false, setup: g.sel.setup || "std" }, g.classIdx, gc.aiTeams, `day${nextStage}`, gc.directive, g.difficulty, undefined, g.dynastyLevel, g.teamName, g.rivalRosters, g.year);
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
  // useEffectへ移した（上記・詳細はDEVLOG §9参照）。
  // v41(§Step7第12弾): rankSim(sim)は buildSim（sim/race.js・support.js）が末尾で既に1回
  // 呼んでいる。ここでもう1回呼ぶと、経路によってrankSim呼び出し回数が1回（観戦・ステージ経路。
  // raceFinishHandlerがfinishStageを直接呼ぶため）と2回（それ以外の3経路）で不揃いになり、
  // 2回目の呼び出し（resolveFinishClustersのMath.randomジッター再抽選）で観戦中にRaceViewが
  // 描いた着順と結果画面の着順がずれ得る実測済みの不整合があった（詳細はDEVLOG §9参照）。
  // 全経路をbuildSimの1回だけに統一し、rankSimの呼び出しを削除した。
  const finishRace = (sim, race, stageOverride) => setG(s => srFinishRace(s, sim, race, stageOverride));
  const finishTeamTT = (sim, race) => setG(s => srFinishTeamTT(s, sim, race));
  const finishStage = (sim, race, stageOverride) => setG(s => srFinishStage(s, sim, race, stageOverride));

  // v41(§Step7第12弾): 判定をg.gcからg.result.raceMetaへ移した。g.gcはグランツール完走後
  // （gc_final到達後）もadvanceMonthを通るまでクリアされないため、「gcがある＝ステージレース」
  // という判定は、gc設定中の画面（race/result_pending/gc_stage/gc_role_setup/gc_final）から
  // mainへ戻る導線が将来1本でも増えた瞬間に誤判定になる（現状はそのような導線が無いため
  // 到達不能だが、暗黙の大域不変条件に依存している）。raceMetaは「今まさに確定させようと
  // しているレースそのもの」の性質なので常に正しい（すぐ上のresult_pending用useEffectと
  // 同じ判定基準に揃えた）。buildSimはraceMeta引数を参照ごとsimへ格納するため、到達可能な
  // 全状態でg.result.raceMeta === g.gc.race（オブジェクト同一）であり、分岐先は変わらない。
  const raceFinishHandler = () => {
    const race = g.result.raceMeta;
    if (race.stageRace) finishStage(g.result, race, g.gc.stage);
    else finishRace(g.result, race);
  };

  // ---- 購入・装備・アイテム ----
  // v41(§Step7第2弾): season側shop/roster系の状態遷移は controllers/season/{shop,roster}.js の純関数
  // （sh*/rs*）に集約。main.jsx側は setG に接続する薄いラッパーのみを持つ（Step7の移籍ドメインと同型）。
  const buyItem = (k) => setG(s => shBuyItem(s, k));
  const buyPart = (pid) => setG(s => shBuyPart(s, pid));
  const setPart = (rid, slot, pid) => setG(s => shSetPart(s, rid, slot, pid));
  const buyEquip = (k) => setG(s => shBuyEquip(s, k));
  const buyRoomUpgrade = (k) => setG(s => shBuyRoomUpgrade(s, k));
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

  return {
    g, setG, teamNameChoice, setTeamNameChoice, diffChoice, setDiffChoice,
    expandedRiderId, setExpandedRiderId, breedYouthSel, setBreedYouthSel,
    cls, healthy, equipMax, rosterMax, staffMax, growthCap, availParts,
    advanceMonth, retainRider, grantTransferRequest, poachRetain, poachAccept, poachSign, resolveEvent,
    startRace, startNextStage, finishRace, finishTeamTT, finishStage, raceFinishHandler,
    buyItem, buyPart, setPart, buyEquip, buyRoomUpgrade, hireStaff, hireObCoach, dismissObCoach,
    signScout, signFa, useSupp, useTune, setFocus, useCamp, toggleFavorite, setCaptain,
    releaseRider, signYouthProspect, signBredYouth, acceptTrade, declineTrade,
  };
}
