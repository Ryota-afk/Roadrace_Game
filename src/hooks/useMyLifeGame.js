// マイライフモードの状態(ml)・useEffect・ハンドラを1つにまとめたフック。Step7第10弾。
// 外部依存はsuperMode（自動保存/実績付与の画面ガード用）とaskConfirm（mlUseStockConfirmの
// 確認ダイアログ）の2つのみ（詳細はDEVLOG §9参照）。
import { useEffect, useRef, useState } from "react";
import { T } from "../data/theme.js";
import { ML_STOCK_ITEMS, computeMyLifeClearPoints, noteAbilityDiscovery, persistCourseRecord, protegeState } from "../logic/support.js";
import { mlRecordLegend } from "../breeding/breeding.js";
import { buildMyLifeSim, computeAchievements, advanceWorldYear, initMyLife, loadMeta, recordTitle, saveMeta, saveMyLife } from "../state/state.js";
import { mlGenRace, mlGenRaceCandidates, mlSelectedRace } from "../domain/mylife/race.js";
import { mlCreateChar as domainMlCreateChar } from "../domain/mylife/createChar.js";
import { resolveNationalRole, buildLastRaceMeta } from "../controllers/mylife/raceStart.js";
import { mlAdvanceMonth as mmAdvanceMonth } from "../controllers/mylife/month.js";
import { mlRaceFinish as mrRaceFinish, mlLastRaceFinish as mrLastRaceFinish } from "../controllers/mylife/result.js";
import {
  mlBuyPart as mshBuyPart, mlSetPart as mshSetPart, mlUpgradePart as mshUpgradePart, mlBuyGear as mshBuyGear, mlBuyStock as mshBuyStock,
  mlUseStock as mshUseStock, mlPrivateCamp as mshPrivateCamp, mlBuyCar as mshBuyCar, mlBuyHouse as mshBuyHouse,
  mlSetFocus as mshSetFocus, mlBuyGrowthPowUp as mshBuyGrowthPowUp, mlBuyGrowthShift as mshBuyGrowthShift,
  mlHireCoach as mshHireCoach, mlDismissCoach as mshDismissCoach, mlAcquireBadge as mshAcquireBadge,
  mlUnequipBadge as mshUnequipBadge,
} from "../controllers/mylife/shop.js";
import {
  mlBecomeMentor as mcBecomeMentor, mlChooseTeam as mcChooseTeam,
  mlRetireAdviceContinue as mcRetireAdviceContinue, mlRetireAdviceReduceRole as mcRetireAdviceReduceRole,
  mlRetireAdviceAccept as mcRetireAdviceAccept, mlResolveOffseason as mcResolveOffseason,
  mlContinueAfterOffseason as mcContinueAfterOffseason, mlResolveCrossroads as mcResolveCrossroads,
  mlContinueAfterCrossroads as mcContinueAfterCrossroads,
} from "../controllers/mylife/career.js";
import { mlEpilogueDirector, mlEpilogueAway, mlSetEpilogue } from "../domain/mylife/career.js";
import {
  mlResolveProtegeEvent as meResolveProtegeEvent, mlResolveRivalScene as meResolveRivalScene,
  mlRivalSceneContinue as meRivalSceneContinue,
  mlTriggerSponsorGig as meTriggerSponsorGig, mlResolveEvent as meResolveEvent,
} from "../controllers/mylife/event.js";

export function useMyLifeGame({ superMode, askConfirm }) {
  const [ml, setMl] = useState(initMyLife);
  const mlCreateArgsRef = useRef(null); // v36(#5): リセマラ引き直し用に直近の作成引数を保持

  // v14: マイライフモードも同様にmylife_main到達時点で自動保存（別のセーブキー）
  useEffect(() => {
    if (superMode === "mylife" && ml.screen === "mylife_main") { saveMyLife(ml); noteAbilityDiscovery([ml.player]); }
  }, [ml, superMode]);

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

  // v37: マイライフのキャリア終了（引退）でも生涯CPを付与する（メタ進行の統合）。
  // 引退画面に入った瞬間に一度だけ計算・加算し、獲得内訳を表示用に保持する。
  // v41(§Step7第3弾): mlRecordLegend（殿堂記録）も同じ理由でここに合流させた。mlLastRaceFinish・
  // mlRetireAdviceAcceptのどちらの経路でも"mylife_retired"に遷移するため、遷移元を問わず
  // 一度だけ記録される。効果発火時点でmlは既に最終raceLogを含む確定済みstate。
  //
  // v49(第11弾続き・バグ修正): 従来はメモリ上のuseRefだけで「一度だけ」を守っていたが、
  // "mylife_retired"へ遷移してもsaveMyLife()はここでは呼ばれず（自動保存は"mylife_main"
  // 到達時のみ）、この画面のままタスクキル→再読み込みするとセーブは引退前の状態に戻る。
  // 一方CP付与(saveMeta)と殿堂登録(mlRecordLegend)は別のlocalStorageキーへ即座に書き込み
  // 済みのため、「引退→CP/殿堂だけ確定させてタスクキル→引退前セーブに巻き戻る」を繰り返す
  // だけでCPと殿堂枠を無限に稼げてしまっていた。判定をメモリ上のrefではなく永続化される
  // ml.awardedCPの有無に変え、CP/殿堂を確定させたその場でsaveMyLife()も同期的に呼んで
  // 「付与済み」も同時にセーブへ焼き付けることで、どのタイミングでリロードしても
  // 再付与されないようにする（mlRecordLegend側にもriderId重複防止を保険として追加済み）。
  useEffect(() => {
    if (ml.screen === "mylife_retired" && !ml.awardedCP) {
      const res = computeMyLifeClearPoints(ml);
      if (res.total > 0) { const meta = loadMeta(); saveMeta({ ...meta, totalEarnedCP: meta.totalEarnedCP + res.total }); }
      mlRecordLegend(ml);
      // 第13弾Phase3-C: エピローグの選択制（「監督としてチームに残る」／「競技から静かに離れる」）を
      // 廃止し、弟子の有無で自動生成する。文章が変わるだけの選択肢と、実際にシーズンモードへ
      // 遷移する「監督として新チームを率いる」ボタンが並んで紛らわしかったため（ユーザー指摘）。
      const epilogueText = ml.protege ? mlEpilogueDirector(ml) : mlEpilogueAway(ml);
      mlSetEpilogue(epilogueText);
      const next = { ...ml, awardedCP: res, epilogueText };
      saveMyLife(next);
      setMl(() => next);
    }
  }, [ml.screen, ml.awardedCP]);
  // v41(§Step7第3弾): 年度末のadvanceWorldYear()（共有ワールドの年を進める・非冪等）も、
  // 以前はadvanceMonth/mlAdvanceMonthのreducer内で直接呼んでいた休眠中の地雷だった。
  // g.year/ml.yearの変化を検知し、実際に年が進んだ時だけ1回呼ぶ（season/mylifeは独立のref）。
  const mlWorldYearRef = useRef(ml.year);
  useEffect(() => {
    if (ml.year !== mlWorldYearRef.current) {
      mlWorldYearRef.current = ml.year;
      advanceWorldYear();
    }
  }, [ml.year]);
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
  const mlCourseRecordRef = useRef(false);
  useEffect(() => {
    if (ml.screen === "mylife_result" && !mlCourseRecordRef.current) {
      mlCourseRecordRef.current = true;
      if (ml.resultInfo && ml.resultInfo.courseRecord) persistCourseRecord(ml.resultInfo.courseRecord, ml.year);
    }
    if (ml.screen !== "mylife_result") mlCourseRecordRef.current = false;
  }, [ml.screen]);

  // ==== v14: マイライフモード専用ハンドラ ====
  // v41(§Step7第3弾): mlGenRace（月次レース生成）は domain/mylife/race.js へ移動（複数箇所から
  // 参照される純粋なジェネレータのため controllers/ ではなく domain/ に置いた）。
  const ML_MILESTONE_LABEL = { worlds: { eyebrow: "世界選手権", color: "#4f8fe8" }, olympics: { eyebrow: "オリンピック", color: T.color.accent } };
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
  // v36(#5リセマラ): この素質でデビュー確定。第41弾: mylife_mainへ直接ではなく、
  // 目標バッジ宣言（mylife_badge_goals）を挟んでから始まる。自動セーブはmylife_main到達時のまま。
  function mlConfirmCandidate() {
    setMl(s => ({ ...s, screen: "mylife_badge_goals" }));
  }
  // 第41弾: 目標バッジは強制力・ボーナスの無い「しおり」。上限3個到達後にさらに選ぶと
  // 最も古い選択を外して入れる（確認を挟まない・コストが無いため）。
  const mlToggleBadgeGoal = (id) => setMl(s => {
    const goals = s.badgeGoals || [];
    if (goals.includes(id)) return { ...s, badgeGoals: goals.filter(g => g !== id) };
    if (goals.length < 3) return { ...s, badgeGoals: [...goals, id] };
    return { ...s, badgeGoals: [...goals.slice(1), id] };
  });
  // 第43弾: 出走計画（climb/hill/sprint/solo/null）。宣言すると通常月の候補にその適性が
  // 必ず1本入る（devlog/wave43.md）。ホームの「レース作戦」と同じアコーディオンで
  // 選び直せる（mlSetFocusとは無関係の別概念——あちらは練習メニューの集中先）。
  const mlSetRaceFocus = (focus) => setMl(s => ({ ...s, raceFocus: focus }));
  const mlConfirmBadgeGoals = () => setMl(s => {
    if (!s.raceFocus) return { ...s, screen: "mylife_main" };
    // まだ1戦も走っていない初月のみ、選んだ出走計画を反映して候補を作り直す
    return {
      ...s, screen: "mylife_main",
      races: mlGenRaceCandidates(s.year, s.month, s.classIdx, s.raceFocus),
      sel: { ...s.sel, raceId: null },
    };
  });
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
  // screenがmylife_main以外」という不変条件（開始ボタンは両方ともmylife_main画面にしか
  // 無いため常に成立する）に基づき、画面そのものをガードとして使う二段構えに変更した。
  // 関数先頭のガードは無駄なsim構築を避けるだけの早期リターンで、二重発火防止の本命は
  // setMlのupdater内での再チェック（updaterは常に最新のsを受け取るため、連打の2発目は
  // ここでno-opになる）。setMlは1回に統合した（以前はraces更新とresult更新で2回呼んでいた）。
  function mlStartRace() {
    if (ml.screen !== "mylife_main") return;
    const baseDirectiveKey = ml.directive ? ml.directive.key : null;
    const selectedRace = mlSelectedRace(ml);
    const { race, directiveKey } = resolveNationalRole(selectedRace, ml.managerEval, baseDirectiveKey);
    const protegeForRace = ml.protege ? { ...ml.protege, curOvr: protegeState(ml.protege, ml.year).ovr } : null;
    const sim = buildMyLifeSim(race, ml.player, ml.team, ml.classIdx, ml.difficulty || "easy", undefined, directiveKey, ml.rival, ml.year, ml.rival2, ml.teammates, ml.tactic, ml.worldRosters, protegeForRace, ml.bonds);
    // v29: 出走表を挟んでからレース本番へ（顔ぶれを確認できる）
    // 第41弾: 複数候補から選んだレース（selectedRace）をresolveNationalRoleで解決した結果を
    // 該当idの位置へ書き戻す。sel.raceIdも明示的に固定し、以降の結果確定側（mlSelectedRace）が
    // 常にこの1本を指すようにする。
    setMl(s => s.screen !== "mylife_main" ? s : ({
      ...s,
      races: race !== selectedRace ? s.races.map(r => r.id === selectedRace.id ? race : r) : s.races,
      sel: { ...s.sel, raceId: race.id },
      result: sim, screen: "mylife_startlist",
    }));
  }
  // 第41弾: 通常月の3候補から選ぶ。特別月（候補1本）では使われない。
  const mlSelectRace = (raceId) => setMl(s => ({ ...s, sel: { ...s.sel, raceId } }));
  function mlStartLastRace() {
    if (ml.screen !== "mylife_main") return;
    const meta = buildLastRaceMeta(ml.player, ml.year, ml.classIdx);
    const protegeForRace = ml.protege ? { ...ml.protege, curOvr: protegeState(ml.protege, ml.year).ovr } : null;
    const sim = buildMyLifeSim(meta, ml.player, ml.team, ml.classIdx, ml.difficulty || "easy", undefined, "ace", ml.rival, ml.year, ml.rival2, ml.teammates, "aggressive", ml.worldRosters, protegeForRace, ml.bonds);
    setMl(s => s.screen !== "mylife_main" ? s : ({ ...s, result: sim, inLastRace: true, screen: "mylife_race" }));
  }
  // v41(§Step7第3弾): マイライフのレース結果確定は controllers/mylife/result.js の純関数に集約。
  // mlLastRaceFinish内のmlRecordLegend、mlRaceFinish内のrecordTitle(race.milestone)は呼ばず、
  // 各々のuseEffectへ移した（上記・詳細はDEVLOG §9参照）。
  const mlLastRaceFinish = () => setMl(mrLastRaceFinish);
  const mlRaceFinish = () => setMl(mrRaceFinish);
  // v41(§Step7第3弾): マイライフの月次アクション・年度末処理は controllers/mylife/month.js の
  // 純関数に集約。非冪等なlocalStorage書き込み（advanceWorldYear）は呼ばず、ml.yearの変化を
  // 検知するuseEffectへ移した（上記・詳細はDEVLOG §9参照）。
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
  // v43(Phase 2): 私生活イベントの手動トリガーは廃止（月次アクション後に受動発火するため
  // mlAdvanceMonth側で完結する）。mlTriggerSponsorGigは引き続き手動アクションとして残る。
  const mlTriggerSponsorGig = () => setMl(meTriggerSponsorGig);
  const mlResolveEvent = (choiceIdx) => setMl(s => meResolveEvent(s, choiceIdx));
  // v14.3: マイライフ専用ショップ（年俸で得た資金を使う）。パーツはPARTS/PART_SLOTSを
  // 選手1名向けに流用し、それ以外（消耗品・トレーニング用品・車・家）はマイライフ専用データを使う
  // v41(§Step7第2弾): マイライフ側shop/アイテム系の状態遷移は controllers/mylife/shop.js の純関数
  // （msh*）に集約。main.jsx側は setMl に接続する薄いラッパーのみを持つ。
  const mlBuyPart = (pid) => setMl(s => mshBuyPart(s, pid));
  const mlSetPart = (slot, pid) => setMl(s => mshSetPart(s, slot, pid));
  const mlUpgradePart = (slot) => setMl(s => mshUpgradePart(s, slot));
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
  // v43(マイライフ難易度調整Phase 1・柱0-b): 成長力アップ／成長タイプ変更は在庫消耗品から
  // 買い切り（mlBuyCar/mlBuyHouseと同型）に変更したための新規ラッパー。
  const mlBuyGrowthPowUp = () => setMl(mshBuyGrowthPowUp);
  const mlBuyGrowthShift = (dir) => setMl(s => mshBuyGrowthShift(s, dir));
  const mlHireCoach = (key) => setMl(s => mshHireCoach(s, key));
  const mlDismissCoach = (key) => setMl(s => mshDismissCoach(s, key));
  const mlAcquireBadge = (id, swapOutId) => setMl(s => mshAcquireBadge(s, id, swapOutId));
  const mlUnequipBadge = (id) => setMl(s => mshUnequipBadge(s, id));

  return {
    ml, setMl, mlCreateArgsRef, ML_MILESTONE_LABEL,
    mlCreateChar, mlRerollCandidate, mlConfirmCandidate, mlSetFocus,
    mlToggleBadgeGoal, mlConfirmBadgeGoals, mlSelectRace, mlSetRaceFocus,
    mlBecomeMentor, mlResolveProtegeEvent, mlResolveRivalScene, mlRivalSceneContinue,
    mlStartRace, mlStartLastRace, mlLastRaceFinish, mlRaceFinish, mlAdvanceMonth,
    mlRetireAdviceContinue, mlRetireAdviceReduceRole, mlRetireAdviceAccept,
    mlChooseTeam, mlResolveOffseason, mlContinueAfterOffseason, mlResolveCrossroads, mlContinueAfterCrossroads,
    mlTriggerSponsorGig, mlResolveEvent,
    mlBuyPart, mlSetPart, mlUpgradePart, mlBuyGear, mlBuyStock, mlUseStock, mlUseStockConfirm,
    mlPrivateCamp, mlBuyCar, mlBuyHouse, mlBuyGrowthPowUp, mlBuyGrowthShift, mlHireCoach, mlDismissCoach, mlAcquireBadge, mlUnequipBadge, mlGenRace,
  };
}
