import { createRoot } from "react-dom/client";
import React, { useState, useRef, useEffect, useMemo } from "react";

// ---- 静的データ（src/data/*）----
import { C, FONT_D, FONT_B, FONT_M } from "./data/theme.js";
import { TYPES, TYPE_ROLE_FIT, AB_KEYS, AB_LABEL, AB_COLOR, GROWTH, POW, ABILITIES, PERSONALITIES, COND_ARROW, COND_COLOR, COND_FC_ARROW, COND_FC_COLOR, COND_FC_LABEL } from "./data/abilities.js";
import { CLASSES, DIFFICULTIES, TITLE_DEFS } from "./data/progression.js";
import { TYPE_ABKEYS, TEACH_KEYS, PROTEGE_TEACHINGS, ARCH_BREED, ML_SPECIAL_MATINGS, BREED_NICKS } from "./data/breeding.js";
import { MONTHS, RELEGATE_LINE, ROSTER_MAX_BY_CLASS, SCOUT_COUNT_BY_CLASS, PRODIGY_CHANCE_BY_CLASS, UPKEEP_PER_RIDER, ROLES, CHASE_MODES, SEG_COMMENTARY, FINISH_COMMENTARY, TEMPLATES, UNLOCK_TEMPLATES, ML_MONUMENTS, VENUES, REGIONS, VENUE_REGION, HOME_ABILITY_BONUS, OVERSEAS_VENUES, GRAND_TOURS, SEG_LABEL, SEG_COLOR, SEG_AB } from "./data/course.js";
import { ITEMS, EQUIPS, EQUIP_COST } from "./data/items.js";

// ---- コンポーネント（Phase 3）----
import { Btn, Eyebrow } from "./components/ui.jsx";
import { RaceView, RaceErrorBoundary } from "./components/RaceView.jsx";

// ---- 純ロジック（src/core, sim, breeding, world, state）----
import { ASSIST_ROLES, GOLD_CONDITIONS, SUB_STAT_KEYS, countRoleUses, countWins, fmtGap, fmtTime, hasAbility, mulberry, newRider, overall, pickRiderName, ridState, rollAbilities, strHash } from "./core/core.js";
import { AI_STYLES, PARTS, PART_SLOTS, TICK_SEC, assignAIRoles, effAbilities, generateCourse, rankSim, riderHash01, rollWeather, simulateTicks } from "./sim/race.js";
import { legendAncestorSet, legendBloodId, loadBloodlines, loadMlLegends, mlBloodlineBonus, mlBloodlineFactor, mlBloodlineTier, mlBreedBonus, mlRecordLegend, protegeInherit, saveMlLegends } from "./breeding/breeding.js";
import { mlWorldStarsForYear } from "./world/world.js";
import { ML_ACHIEVEMENTS, ML_AMBITION_PATHS, ML_SAVE_KEY, ML_TACTICS, MYLIFE_TEAMS, RIVAL_TEAMS, SAVE_KEY, buildMyLifeSim, computeAchievements, computePrestige, genFaPool, genMonthRaces, genScouts, genSponsors, genTradeOffers, genPoachTargets, makePoachOffer, initGame, initMyLife, loadGame, loadMeta, loadMyLifeGame, loadTitles, mlAmbitionCleared, mlAmbitionMetricValue, mlCareerArchetype, mlFirstUnmetRung, mlGenTeammates, genWorldRosters, ageWorldRosters, sharedWorldRosters, advanceWorldYear, loadWorldMeta, cpShopMylifePerks, CP_SHOP, cpBalance, cpBuy, cpOwned, recordTitle, riderCareerSummary, riderNickname, saveGame, saveMeta, saveMyLife, totalTitleCount, unlockedTemplates } from "./state/state.js";

// ---- App から使う表示層（Phase 4-1）----
import { AbilityFileList, AbilityGrid, BlurGrid, CondFc, CourseRecordsPanel, DisciplineGrid, ElevationChart, FatigueBar, MultiStageCourseView, PersonaLine, StartListPanel, SubStatLine, TitlesPanel, TraitLine } from "./components/panels.jsx";
import { CLASS_TIER_COLOR, CP_MILESTONES, DISCIPLINES, EVENTS, EVENT_CHANCE, FAVORS_TO_DISCIPLINE, GRADE_MUL, GROWTHPOW_ORDER, GROWTH_ORDER, MANAGER_DIRECTIVES, ML_AB_COACH_KEY, ML_AMBITION_PATH_KEYS, ML_BACKGROUNDS, ML_CARS, ML_CROSSROADS, ML_EVENTS, ML_PERSONALITY_EVENTS, ML_GEAR, ML_HOUSES, ML_OFFSEASON_CHOICES, ML_SPECIAL_TRAINING, ML_SPONSOR_GIGS, ML_STOCK_ITEMS, OB_COACH_SALARY, POP_MILESTONES, PRIZES, PTS, SCOUT_POLICIES, SEASON_ACHIEVEMENTS, SLOT_LABEL, STAFF_MAX_BY_CLASS, STAFF_ROLES, STAFF_SALARY_PER_LV, SUB_STAT_LABEL, TYPE_COACH_ABILITY, WEATHER, acquireNewAbility, addAb, applyAmbitionReward, applyCpMilestones, applyEventEffects, bloodIdToName, breedNickTableRows, buildBloodMap, buildSim, bumpCareerStats, bumpGrowthPow, champPromoteCut, clearMyLifeSave, clearSaveGame, computeClearPoints, computeMyLifeClearPoints, cpUnlockRows, mlCpPerks, computePickupChance, computeSeasonAchievements, computeStandings, computeWorldRank, disciplineScore, formatAchievementReward, groupModeFor, growSub, growthPhase, hasMyLifeSave, hasSaveGame, isHallOfFameWorthy, loadAbilityFile, managerEvalTier, mlAmbitionPath, mlAmbitionProgressText, mlAutobiographyOptions, mlCreateRival, mlCurrentAmbition, mlEpilogueAway, mlEpilogueDirector, mlGenDirective, mlGradeColor, mlGrowthCap, mlLivingCost, mlNewspaper, mlPrivateCampCost, ML_PROTEGE_EVENTS, mlUpdateRiderStats, mlWorldRaceLite, mlFactorCollection, mlLineageForest, protegeMilestoneNews, protegeState, mlRollCrossroads, mlSetAutobiography, mlSetEpilogue, mlTeamTier, mlWorldBoard, mlWorldNews, noteAbilityDiscovery, persMul, pickMandateMonths, advanceObjective, expireObjective, raceObjectiveEvent, potentialHint, raceForecast, raceIsHome, recordCourseResult, riderFlavorText, rivalNews, rivalDrama, rivalDialogue, rivalScene, rivalMeetingHeat, rivalHeatTier, rollCondDir, seasonPersonalityEvent, seasonRank, staffSalaryTotal, standingsRankReward, t_label, teamChemistryTier, upgradeGoldAbilities, worldPointsForFinish, worldRankTier } from "./logic/support.js";
// ---- 画面ディスパッチ（Phase 4-2）----
import { renderMyLifeScreens } from "./screens/mylife.jsx";
import { renderSeasonScreens } from "./screens/season.jsx";

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
  useEffect(() => {
    if (g.screen === "clear" && !clearAwardedRef.current) {
      clearAwardedRef.current = true;
      const earned = computeClearPoints(g.year, g.difficulty);
      const meta = loadMeta();
      saveMeta({ ...meta, totalEarnedCP: meta.totalEarnedCP + earned });
    }
    if (g.screen !== "clear") clearAwardedRef.current = false;
  }, [g.screen]);
  // v37: マイライフのキャリア終了（引退）でも生涯CPを付与する（メタ進行の統合）。
  // 引退画面に入った瞬間に一度だけ計算・加算し、獲得内訳を表示用に保持する。
  const mlClearAwardedRef = useRef(false);
  useEffect(() => {
    if (ml.screen === "mylife_retired" && !mlClearAwardedRef.current) {
      mlClearAwardedRef.current = true;
      const res = computeMyLifeClearPoints(ml);
      if (res.total > 0) { const meta = loadMeta(); saveMeta({ ...meta, totalEarnedCP: meta.totalEarnedCP + res.total }); }
      setMl(s => ({ ...s, awardedCP: res }));
    }
    if (ml.screen !== "mylife_retired") mlClearAwardedRef.current = false;
  }, [ml.screen]);

  const equippedCount = (pid) => g.roster.reduce((s, r) => s + (PART_SLOTS.reduce((n, sl) => n + (r.parts[sl] === pid ? 1 : 0), 0)), 0);
  const availParts = (pid) => (g.partsInv[pid] || 0) - equippedCount(pid);

  // ---- 月次更新 ----
  function monthlyUpdate(state, raceInfo) {
    const starterIds = raceInfo ? raceInfo.starters : null;
    // v14.7: グランツールは複数日にわたって走り切る大会のため、ワンデーレースと
    // 同じ疲労蓄積では実態に合わない。ただしステージレースは中日ごとに-20の回復が
    // 別途入る（startNextStage）ため、素朴に係数を掛けただけだとその回復分で
    // ほぼ相殺されてしまう。かといって係数を上げすぎると、疲労は0未満に下がらない
    // （中日回復は0で頭打ち）ため、開幕直後の疲労が低い選手でも常に上限100に
    // 張り付いてしまい「グランツール＝常に即MAX」という芸のない結果になる。
    // 3日間なら中日回復-40を踏まえてもワンデーレースよりはっきり多く疲労が残りつつ、
    // 低疲労状態からのスタートなら100に張り付かない程度の係数に留める
    const stageFatigueMul = (raceInfo && raceInfo.grandTour) ? 1 + ((raceInfo.stageCount || 3) - 1) / 3 : 1;
    // v13: 難易度別の成長ソフトキャップ閾値（易しいほど高い閾値まで伸びる）
    const growthCap = (DIFFICULTIES.find(d => d.id === state.difficulty) || DIFFICULTIES[0]).growthCap;
    // v17: キャプテン制度。主将より2歳以上若い選手は、主将の指導を受けて練習効果+10%になる。
    // v18バランス調整: 指導に時間を割く分、主将自身の練習効果はわずかに落ちる（-5%）ようにし、
    // 「誰でも無条件に任命した方が得」にならないよう小さなトレードオフを持たせた
    const captain = state.roster.find(r => r.id === state.captainId);
    const captainMentorMul = (n) => {
      if (!captain) return 1;
      if (n.id === captain.id) return 0.95;
      return n.age < captain.age - 2 ? 1.1 : 1;
    };
    const roster = state.roster.map(r => {
      const n = { ...r, parts: { ...r.parts } };
      // v17: チームケミストリー用に、在籍月数を毎月加算する
      n.tenure = (n.tenure || 0) + 1;
      const injMul = hasAbility(n, "glass") ? 2 : hasAbility(n, "tough") ? 0.5 : 1;
      const injExtra = hasAbility(n, "glass") ? 1 : 0;
      if (n.injury > 0) {
        n.injury -= 1;
        n.fatigue = Math.max(0, n.fatigue - 30);
        n.streak = 0;
      } else {
        if (n.focus === "rest") {
          n.fatigue = Math.max(0, n.fatigue - 15);
        } else {
          const ph = growthPhase(n);
          const winter = state.month === 8 || state.month === 9;
          // v9: 基礎成長量をさらに引き下げ（2.2→1.5）。「将来性一択」問題への対処
          const gain = 1.5 * ph.gain * POW[n.growthPow].mul
            * (winter ? 1.3 : 1) * (state.camp ? 2 : 1)
            * (1 + state.equip.facility * 0.15)
            * (1 + (state.staff?.trainer || 0) * 0.12)
            * (hasAbility(n, "trainer") ? 1.2 : hasAbility(n, "lazy_sp") ? 0.8 : 1)
            * (hasAbility(n, "lateblow_sp") && n.age >= 28 ? 1.15 : 1)
            * captainMentorMul(n);
          // v27: OBコーチが在籍していれば、その担当能力の練習効果を全選手+25%する
          const obAb = state.obCoach ? state.obCoach.ab : null;
          const obMul = (k) => (obAb && k === obAb ? 1.25 : 1);
          // 指定能力の成長にトレードオフ（×0.9）。指定外はさらに絞って14%
          addAb(n, n.focus, gain * 0.9 * persMul(n, n.focus) * obMul(n.focus), growthCap);
          AB_KEYS.filter(k => k !== n.focus).forEach(k => addAb(n, k, gain * 0.14 * persMul(n, k) * obMul(k), growthCap));
          // v29: シーズンでも練習で加速力・メンタルがわずかに伸びる（focusがsprint/flatなら加速に厚め）
          const subG = 0.24 * ph.gain * POW[n.growthPow].mul;
          growSub(n, "accel", subG * (n.focus === "sprint" || n.focus === "flat" ? 1.3 : 0.7));
          growSub(n, "mental", subG * 0.6);
          n.fatigue = Math.min(100, n.fatigue + 6);
        }
        const ph2 = growthPhase(n);
        if (ph2.dec > 0) AB_KEYS.forEach(k => { n[k] = Math.max(20, n[k] - ph2.dec); });
      }
      if (starterIds && starterIds.includes(n.id)) {
        // v28: 出走した選手はベンチ月数（起用されない不満の蓄積）をリセットする
        n.benchMonths = 0;
        // v25: 天候の悪化。猛暑は出走後の疲労蓄積を増やす（悪天候巧者による軽減はなし＝純粋な体力勝負）
        const heatMul = raceInfo.weather === "heat" ? 1.15 : 1;
        n.fatigue = Math.min(100, n.fatigue + (hasAbility(n, "iron") ? 32 : 45) * stageFatigueMul * heatMul);
        n.streak += 1;
        const ph = growthPhase(n);
        // v25: 出走経験による成長が練習に比べて弱く、レースに出る意味が薄いという指摘を受け強化。
        // 基礎係数を引き上げた上、格上のレース（グレードが高い）ほど得るものが大きくなるようにした
        const raceGradeMul = GRADE_MUL[raceInfo.grade] || 1;
        raceInfo.expKeys.forEach(k => addAb(n, k, 1.0 * raceGradeMul * Math.max(0.2, ph.gain) * POW[n.growthPow].mul * persMul(n, k), growthCap));
        // v29: メンタルは大舞台の経験で育つ（格上ほど大きく）
        growSub(n, "mental", 0.3 * raceGradeMul * Math.max(0.25, ph.gain));
        // v11: ドクター（staff.doctor）は故障の発生率を下げ、発生した場合も期間を短縮する
        // v29バグ修正: 効果が体感しづらいという指摘を受け、発生率減・期間短縮ともに強化
        const doctorLv = state.staff?.doctor || 0;
        const injCut = Math.round(doctorLv * 0.8); // 故障期間の短縮量（Lv3で3ヶ月短縮）
        if (n.streak >= 3) {
          n.injury = Math.max(1, 1 + (Math.random() < 0.5 ? 1 : 0) + injExtra - injCut);
          n.streak = 0;
          state._injured.push(`${n.name} が3連闘の無理がたたり故障（${n.injury}ヶ月離脱）`);
        } else if (n.fatigue > 90) {
          const p = (0.3 + (n.fatigue - 90) * 0.04) * injMul * Math.max(0.1, 1 - doctorLv * 0.22);
          if (Math.random() < p) {
            n.injury = Math.max(1, 1 + (Math.random() < 0.4 ? 1 : 0) + injExtra - injCut);
            n.streak = 0;
            state._injured.push(`${n.name} が疲労の蓄積で故障（${n.injury}ヶ月離脱）`);
          }
        } else if (raceInfo.weather === "rain" && Math.random() < (hasAbility(n, "rain_sp") ? 0.02 : 0.06) * Math.max(0.1, 1 - doctorLv * 0.22)) {
          // v25: 雨天レースは悪天候巧者を持たない選手に一定確率で落車リスクを上乗せする
          n.injury = Math.max(1, 1 + (Math.random() < 0.3 ? 1 : 0) + injExtra - injCut);
          n.streak = 0;
          state._injured.push(`${n.name} が雨天のレースで落車、負傷離脱（${n.injury}ヶ月）`);
        }
      } else if (n.injury === 0) {
        n.fatigue = Math.max(0, n.fatigue - (starterIds ? 30 : 50));
        n.streak = 0;
        // v28: レースが行われた月に起用されなかった選手は「ベンチ月数」が積み上がる（移籍志願の判定に使う）
        if (starterIds) n.benchMonths = (n.benchMonths || 0) + 1;
      }
      if (hasAbility(n, "recover")) n.fatigue = Math.max(0, n.fatigue - 15);
      if (hasAbility(n, "recover2")) n.fatigue = Math.max(0, n.fatigue - 25); // v37(第2弾): 超回復
      // v27: コンディション予報。前月に予報した向きを実際の変動として適用し、翌月の予報を新たに引く
      const swing = hasAbility(n, "moody") ? 2 : hasAbility(n, "steady_sp") ? 0.5 : 1;
      const dir = (n.condForecast != null) ? n.condForecast : rollCondDir();
      n.cond = Math.max(1, Math.min(5, n.cond + dir * swing));
      n.condForecast = rollCondDir();
      // v15フェーズ2: 金特化の判定（勝利数・役割出走数の条件を満たしたら毎月チェック）
      let updated = n;
      const upgraded = upgradeGoldAbilities(updated);
      if (upgraded !== updated) {
        upgraded.goldAbilities.filter(id => !(updated.goldAbilities || []).includes(id))
          .forEach(id => state._injured.push(`${n.name}の特殊能力「${ABILITIES[id].label}」が金特に覚醒した！`));
        updated = upgraded;
      }
      // v17: 特殊能力の後天的獲得判定
      const acquired = acquireNewAbility(updated);
      if (acquired !== updated) {
        const newId = acquired.abilities[acquired.abilities.length - 1];
        state._injured.push(`${n.name}が新たな特殊能力「${ABILITIES[newId].label}」を身につけた！`);
        updated = acquired;
      }
      return updated;
    });
    return roster;
  }

  function advanceMonth(raceInfo) {
    setG(s => {
      const st = { ...s, _injured: [] };
      const roster = monthlyUpdate(st, raceInfo);
      const income = s.sponsor ? s.sponsor.monthly : 0;
      const log = [...s.log, ...st._injured.map(t => `【${MONTHS[s.month]}】${t}`)];
      // v35(シーズン深掘り): チームケミストリーが上のティアへ上がった瞬間を「絆」の節目としてログに刻む
      const prevChem = teamChemistryTier(s.roster), newChem = teamChemistryTier(roster);
      if (newChem.min > prevChem.min && newChem.min > 0) {
        log.push(`【${MONTHS[s.month]}】🤝 長く共に走った絆が実り、チームは「${newChem.label}」に到達（レース中のドラフト消耗 -${Math.round((1 - newChem.mul) * 100)}%）`);
      }
      // v35(シーズン深掘り): 育成の手応え。練習・出走の成長でOVRの節目(70/80/90)を越えた選手を祝う
      roster.forEach(nr => {
        const old = s.roster.find(r => r.id === nr.id);
        if (!old) return;
        const oOld = overall(old), oNew = overall(nr);
        [70, 80, 90].forEach(th => {
          if (oOld < th && oNew >= th) {
            const young = (nr.age || 25) <= 23;
            log.push(`【${MONTHS[s.month]}】📈 ${nr.name} がOVR${th}の壁を突破！${young ? "若き才能が確かに開花しつつある。" : "円熟の走りにさらなる凄みが増した。"}`);
          }
        });
      });
      let sponsor = s.sponsor;
      const mandateRace = s.races.find(r => r.sponsorMandate);
      if (sponsor && mandateRace && !(raceInfo && raceInfo.raceId === mandateRace.id)) {
        sponsor = { ...sponsor, mandatesMissed: sponsor.mandatesMissed + 1 };
        log.push(`【${MONTHS[s.month]}】${sponsor.name}の指定レースを見送った（違約金が加算されます）`);
      }
      // v40（第1候補②）：中期目標の期限切れ判定。期限月を過ぎて未達なら失敗＝違約金をその場で計上する
      let objectivePenalty = 0;
      if (sponsor && sponsor.objective) {
        const exp = expireObjective(sponsor.objective, s.month, MONTHS[s.month]);
        if (exp.log) { sponsor = { ...sponsor, objective: exp.objective }; objectivePenalty = exp.penalty; log.push(exp.log); }
      }
      if (s.month === 11) {
        let classIdx = s.classIdx;
        // v34（バランス）：シーズン順位を実効化。年間の順位で本番の昇格ボーダーが緩み、順位で賞金も出る。
        const sr = seasonRank(s);
        const promoteCut = s.classIdx < 2 ? champPromoteCut(sr.rank) : 3;
        const standingsMoney = standingsRankReward(sr.rank, s.classIdx);
        const info = { promoted: false, relegated: false, retired: [], retiredRiders: [], cleared: false, champBest: s.champBest, sponsorResult: null, standingsRank: sr.rank, standingsTotal: sr.total, promoteCut, standingsMoney };
        if (s.champBest !== null && s.champBest <= promoteCut) {
          if (s.classIdx === 2 && s.champBest === 1) { info.cleared = true; recordTitle("grandFinal"); }
          else { classIdx = Math.min(2, s.classIdx + 1); info.promoted = true; }
        } else if (s.points < RELEGATE_LINE && s.classIdx > 0) {
          classIdx = s.classIdx - 1; info.relegated = true;
        }
        let delta = 0;
        if (sponsor) {
          const achieved = s.points >= sponsor.norma;
          const mandatePenalty = sponsor.mandatesMissed * 15;
          delta = (achieved ? sponsor.bonus : -sponsor.penalty) - mandatePenalty;
          info.sponsorResult = {
            name: sponsor.name, achieved, bonus: sponsor.bonus, penalty: sponsor.penalty, norma: sponsor.norma, pts: s.points,
            mandatesMet: sponsor.mandatesMet, mandatesMissed: sponsor.mandatesMissed, mandatePenalty,
            objective: sponsor.objective || null,
          };
        }
        const survivors = [];
        roster.forEach(r => {
          const n = { ...r, age: r.age + 1 };
          const retire = n.age >= 36 || (n.age >= 33 && overall(n) < n.joinOvr * 0.8);
          if (retire) { info.retired.push(`${n.name}（${n.age}歳）が引退`); info.retiredRiders.push(n); }
          else survivors.push(n);
        });
        const year = s.year + 1;
        // v38: ライバルチームも年次で世代交代（加齢→成長/衰え→引退→新人補充）。
        // これで周回の相手が固定強度で止まらず、若手台頭とベテラン引退の流れが生まれる。
        const agedRivals = ageWorldRosters(s.rivalRosters, mulberry((year * 2246822519) >>> 0), year, RIVAL_TEAMS);
        advanceWorldYear(); // v38(#9 A-3): 共有ワールドも1年進める（世界が周回・両モードをまたいで年を取る）
        agedRivals.retired.slice(0, 3).forEach(r => {
          const debut = agedRivals.debuted.find(d => d.team === r.team);
          log.push(`【${s.year}年目 世代交代】🌍 ${r.team}の${r.name}（${r.age}歳）が引退。${debut ? `新星${debut.name}（${debut.age}歳）が加入した` : ""}`);
        });
        const upkeep = survivors.length * UPKEEP_PER_RIDER;
        const staffSalary = staffSalaryTotal(s.staff) + (s.obCoach ? OB_COACH_SALARY : 0);
        const managerLv = s.staff?.manager || 0;
        const nextOffers = genSponsors(classIdx, year).map(o => ({
          ...o,
          // v29バグ修正: 監督スタッフの効果が体感しづらいという指摘を受け、契約条件への
          // 反映を強化（月収・成功報酬UP／ノルマ・失敗ペナルティ減）
          monthly: Math.round(o.monthly * (1 + managerLv * 0.12)),
          norma: Math.max(5, Math.round(o.norma * (1 - managerLv * 0.08))),
          bonus: Math.round((o.bonus || 0) * (1 + managerLv * 0.10)),
          penalty: Math.max(0, Math.round((o.penalty || 0) * (1 - managerLv * 0.10))),
        }));
        // v13: 年度の総括を歴史記録として1件積む（クラス・最終ポイント・昇格/降格・
        // チャンピオンシップ最高位）
        const careerHistory = [...s.careerHistory, {
          year: s.year, classLabel: CLASSES[s.classIdx].label, points: s.points,
          promoted: info.promoted, relegated: info.relegated, champBest: s.champBest,
        }];
        // v13.1: ライバルチームに拾われた元選手も年齢を重ね、同じ引退条件を満たせば
        // 殿堂入り判定（実績かお気に入りがあれば記録に残る）を経て名鑑へ、
        // 満たさなければ静かに記録から外れる。生き残った選手はrivalAlumniに残り続ける
        const survivingAlumni = [];
        const retiredAlumniHof = [];
        (s.rivalAlumni || []).forEach(r => {
          const n = { ...r, age: r.age + 1 };
          const retire = n.age >= 36 || (n.age >= 33 && overall(n) < n.joinOvr * 0.8);
          if (retire) { if (isHallOfFameWorthy(n)) retiredAlumniHof.push({ ...n, farewellYear: year, farewellReason: "rival_retired" }); }
          else survivingAlumni.push(n);
        });
        // v13.1: 引退した選手は、殿堂入り条件（実績かお気に入り）を満たした場合のみ記録に残す
        const hallOfFame = [
          ...s.hallOfFame,
          ...info.retiredRiders.filter(isHallOfFameWorthy).map(n => ({ ...n, farewellYear: s.year, farewellReason: "retired" })),
          ...retiredAlumniHof,
        ];
        return {
          ...s, roster: survivors, classIdx, points: 0, year, month: 0,
          budget: s.budget + income + delta + standingsMoney - upkeep - staffSalary - objectivePenalty,
          sponsor: null, sponsorOffers: nextOffers,
          scouts: genScouts(classIdx, year * 771 + 13, s.scoutPolicy, survivors.map(r => r.name), s.staff?.scout || 0),
          faMarket: genFaPool(classIdx, year * 613 + 29, survivors.map(r => r.name)),
          tradeOffers: genTradeOffers(classIdx, year * 1471 + 37, survivors),
          races: genMonthRaces(year, 0, classIdx, 0, null, []),
          camp: false, champBest: null, gc: null,
          sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false, chaseMode: "normal", aceEarly: false },
          // v14.8: 年が変わるのでグランツール制覇状況もリセットする
          gtWins: [],
          // v25: ユース育成枠も年度が変わるたびにリセットする
          youthUsed: false,
          yearendInfo: info, cleared: info.cleared, log, careerHistory, hallOfFame, rivalAlumni: survivingAlumni,
          rivalRosters: agedRivals.worldRosters,
          // v41: 引き抜き市場を来季の（年を取った）ライバル主力で更新し、年1回の引き抜き枠をリセット
          poachTargets: genPoachTargets(classIdx, year, year * 331 + 47, agedRivals.worldRosters),
          poachDoneThisYear: false,
          screen: info.cleared ? "clear" : "yearend", tab: "home",
        };
      }
      const month = s.month + 1;
      const upkeep = roster.length * UPKEEP_PER_RIDER;
      const staffSalary = staffSalaryTotal(s.staff) + (s.obCoach ? OB_COACH_SALARY : 0);
      const base = {
        ...s, roster, month, camp: false,
        budget: s.budget + income - upkeep - staffSalary - objectivePenalty,
        sponsor,
        faMarket: genFaPool(s.classIdx, s.year * 1013 + month * 37 + 7, roster.map(r => r.name)),
        tradeOffers: genTradeOffers(s.classIdx, s.year * 1231 + month * 59 + 17, roster),
        races: genMonthRaces(s.year, month, s.classIdx, s.points, sponsor, s.gtWins),
        sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false, chaseMode: "normal", aceEarly: false },
        gc: null,
        screen: "main", log,
      };
      // v41: 被引き抜き。ライバルが自チームの主力を引き抜きに来る（主将以外・健康・OVR66以上の最上位）。
      // 引き止める（費用を払って残留）か、放出して移籍金を得るか＝チーム運営の駆け引き。移籍志願より優先。
      if (month !== 0 && Math.random() < 0.16) {
        const offer = makePoachOffer({ roster, captainId: s.captainId, classIdx: s.classIdx }, Math.random);
        if (offer) return { ...base, poachOffer: offer, screen: "poachOffer" };
      }
      // v28: 選手の移籍志願。長期間ベンチに置かれた実力者（能力55以上）が不満を募らせ、
      // 退団を申し出ることがある。主将は対象外。慰留か放出かをプレイヤーが選ぶ
      const requester = roster.find(r => r.injury === 0 && (r.benchMonths || 0) >= 4 && overall(r) >= 55 && r.id !== s.captainId);
      if (month !== 0 && requester && roster.length > 1 && Math.random() < 0.25) {
        return { ...base, transferRequest: { riderId: requester.id, name: requester.name }, screen: "transferRequest" };
      }
      // v8: 月替わりでランダムに選択肢付きイベントが発生（春先の解禁月は除く）
      // v36(#9): 半々で「性格ベースのチームイベント」（ロースターの誰かの個性にスポットを当てる）を差し込む
      if (month !== 0 && Math.random() < EVENT_CHANCE) {
        const pe = Math.random() < 0.5 ? seasonPersonalityEvent(roster) : null;
        const ev = pe || EVENTS[Math.floor(Math.random() * EVENTS.length)];
        return { ...base, pendingEvent: ev, screen: "event" };
      }
      return base;
    });
  }
  // v28: 移籍志願への対応。慰留＝引き止め費用を払って残ってもらう／放出＝退団（他チームに拾われうる）
  const retainRider = () => {
    setG(s => {
      const req = s.transferRequest;
      if (!req) return s;
      const cost = 30;
      return {
        ...s, budget: s.budget - cost, transferRequest: null, screen: "main",
        roster: s.roster.map(r => r.id === req.riderId ? { ...r, benchMonths: 0, cond: Math.min(5, r.cond + 1) } : r),
        log: [...s.log, `【${MONTHS[s.month]}】${req.name}を慰留（引き止め費用-${cost}万・本人は納得して残留）`],
      };
    });
  };
  const grantTransferRequest = () => {
    setG(s => {
      const req = s.transferRequest;
      if (!req) return s;
      const r = s.roster.find(x => x.id === req.riderId);
      if (!r) return { ...s, transferRequest: null, screen: "main" };
      const roster = s.roster.filter(x => x.id !== req.riderId);
      const captainId = s.captainId === req.riderId ? null : s.captainId;
      // 志願しての退団なので、他チームに拾われやすい（能力・将来性に応じて）
      const pickedUp = Math.random() < Math.max(0.5, computePickupChance(r));
      if (pickedUp) {
        const signedTeam = RIVAL_TEAMS[Math.floor(Math.random() * RIVAL_TEAMS.length)].name;
        return {
          ...s, roster, captainId, transferRequest: null, screen: "main",
          rivalAlumni: [...s.rivalAlumni, { ...r, signedTeam, signedYear: s.year }],
          log: [...s.log, `【${MONTHS[s.month]}】${r.name}の移籍志願を受け入れた → ${signedTeam}へ移籍`],
        };
      }
      const hallOfFame = isHallOfFameWorthy(r) ? [...s.hallOfFame, { ...r, farewellYear: s.year, farewellReason: "released" }] : s.hallOfFame;
      return { ...s, roster, captainId, hallOfFame, transferRequest: null, screen: "main", log: [...s.log, `【${MONTHS[s.month]}】${r.name}の移籍志願を受け入れ、円満に送り出した`] };
    });
  };
  // v41: 被引き抜きへの対応。引き止める＝費用を払い残留（本人は奮起＝調子+1）。
  const poachRetain = () => {
    setG(s => {
      const o = s.poachOffer;
      if (!o) return { ...s, poachOffer: null, screen: "main" };
      if (s.budget < o.retainCost) return s; // 資金不足なら操作無効（ボタン側でも抑止）
      return {
        ...s, budget: s.budget - o.retainCost, poachOffer: null, screen: "main",
        roster: s.roster.map(r => r.id === o.riderId ? { ...r, cond: Math.min(5, r.cond + 1) } : r),
        log: [...s.log, `【${MONTHS[s.month]}】${o.team}による${o.name}の引き抜きを退けた（引き止め費用-${o.retainCost}万・本人は奮起して調子+1）`],
      };
    });
  };
  // v41: 被引き抜きの受諾。移籍金を受け取り主力を放出。相手チームの一員として走り続ける（rivalAlumni）。
  const poachAccept = () => {
    setG(s => {
      const o = s.poachOffer;
      if (!o) return { ...s, poachOffer: null, screen: "main" };
      const r = s.roster.find(x => x.id === o.riderId);
      if (!r) return { ...s, poachOffer: null, screen: "main" };
      const roster = s.roster.filter(x => x.id !== o.riderId);
      const captainId = s.captainId === o.riderId ? null : s.captainId;
      return {
        ...s, roster, captainId, budget: s.budget + o.fee, poachOffer: null, screen: "main",
        rivalAlumni: [...(s.rivalAlumni || []), { ...r, signedTeam: o.team, signedYear: s.year }],
        log: [...s.log, `【${MONTHS[s.month]}】${o.name}を${o.team}へ放出（移籍金+${o.fee}万）。今後は${o.team}の一員として自チームの前に立ちはだかる`],
      };
    });
  };
  // v41: 引き抜き（こちらが他チームの主力を獲得）。年1回まで・資金と枠が必要。成立すると相手の
  // ロースターから外れ（世界に反映）、自チームへ加入。移籍金は candidate の実効OVRで算定済み。
  const poachSign = (targetId) => {
    setG(s => {
      const t = (s.poachTargets || []).find(x => x.id === targetId);
      if (!t) return s;
      if (s.poachDoneThisYear) return s;
      if (s.budget < t.fee) return s;
      if (s.roster.length >= rosterMax) return s;
      // 相手ロースターから引き抜いた選手を外す（世界に反映＝以後その相手として出走しない）
      const rivalRosters = { ...(s.rivalRosters || {}) };
      if (rivalRosters[t.team]) rivalRosters[t.team] = rivalRosters[t.team].filter(wr => wr.id !== t.wrId);
      const recruit = { ...t.candidate, poachedFrom: t.team };
      return {
        ...s, budget: s.budget - t.fee, roster: [...s.roster, recruit],
        rivalRosters, poachDoneThisYear: true,
        poachTargets: (s.poachTargets || []).filter(x => x.id !== targetId),
        screen: "main",
        log: [...s.log, `【${MONTHS[s.month]}】${t.team}の主力 ${t.candidate.name}（OVR${overall(t.candidate)}）を引き抜き獲得！ 移籍金-${t.fee}万`],
      };
    });
  };

  function resolveEvent(choiceIdx) {
    setG(s => {
      const ev = s.pendingEvent;
      if (!ev) return s;
      const choice = ev.choices[choiceIdx];
      const applied = applyEventEffects(s, choice.effects);
      // v12: 個人targetの効果は誰が対象だったかを__eventNoteに乗せて返してくるので、
      // 結果テキストの末尾に添えてから消す（保存対象にも含まれない一時フィールド）
      const { __eventNote, ...rest } = applied;
      const text = __eventNote ? `${choice.result}\n\n${__eventNote}` : choice.result;
      return { ...rest, pendingEvent: null, eventResult: { title: ev.title, text }, screen: "event_result" };
    });
  }

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
  function finishRace(sim, race, stageOverride) {
    rankSim(sim);
    // v35(チームTT): チーム単位の合算タイム。チーム順位で得点・賞金を確定する
    if (sim.teamTT) { finishTeamTT(sim, race); return; }
    if (race.stageRace) {
      finishStage(sim, race, stageOverride);
      return;
    }
    const playerRs = sim.ranked.filter(e => e.team === "PLAYER");
    const best = playerRs[0];
    // v27: コースレコード。勝者のフィニッシュタイムからコース種別ごとの最速記録を更新する
    const winner = sim.ranked[0];
    const courseRecord = recordCourseResult(race.tmpl.kind, sim.course.length, winner.finishTime, winner.name, winner.team === "PLAYER", g.year);
    const mul = CLASSES[g.classIdx].prizeMul * GRADE_MUL[race.grade];
    const prize = Math.round(playerRs.reduce((s2, e) => s2 + (PRIZES[e.rank - 1] || 1), 0) * mul);
    const mandateHit = !race.championship && !!race.sponsorMandate;
    let pts = Math.round((PTS[best.rank - 1] || 0) * GRADE_MUL[race.grade]);
    if (mandateHit) pts = Math.round(pts * 1.3);
    // v13: 選手名鑑用に、出走した自チーム選手それぞれの着順を各選手のraceLogへ記録する
    const rankById = {}; playerRs.forEach(e => { rankById[e.id] = e.rank; });
    // v14.6: フレーバーテキストで「そのレースでどんな役割だったか」を語れるよう、
    // 着順と一緒に役割（エースならace、それ以外はROLESのキー）も記録する
    const roleById = {}; playerRs.forEach(e => { roleById[e.id] = e.isAce ? "ace" : e.role; });
    // v13.1: ライバルチームに拾われた元選手が出走していれば、そちらのraceLogも伸ばす
    const alumniRankById = {}; sim.ranked.filter(e => e.isAlumnus).forEach(e => { alumniRankById[e.id] = e.rank; });
    const alumniRoleById = {}; sim.ranked.filter(e => e.isAlumnus).forEach(e => { alumniRoleById[e.id] = e.isAce ? "ace" : e.role; });
    setG(s => {
      const roster = s.roster.map(r => rankById[r.id] != null
        ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: rankById[r.id], role: roleById[r.id] }] }
        : r);
      const rivalAlumni = (s.rivalAlumni || []).map(r => alumniRankById[r.id] != null
        ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: alumniRankById[r.id], role: alumniRoleById[r.id] }] }
        : r);
      // v40（第1候補②）：シーズン中期目標の進捗。達成した瞬間に資金＋ノルマptを付与する
      let sponsor = (s.sponsor && mandateHit) ? { ...s.sponsor, mandatesMet: s.sponsor.mandatesMet + 1 } : s.sponsor;
      const objRes = advanceObjective(sponsor && sponsor.objective, raceObjectiveEvent(race, best.rank, best.age), MONTHS[s.month]);
      if (sponsor && sponsor.objective) sponsor = { ...sponsor, objective: objRes.objective };
      return {
        ...s, roster, rivalAlumni, sponsor,
        log: objRes.log ? [...s.log, objRes.log] : s.log,
        budget: s.budget + prize + objRes.budgetDelta,
        points: race.championship ? s.points : s.points + pts + objRes.pointsDelta,
        champBest: race.championship ? best.rank : s.champBest,
        careerStats: bumpCareerStats(s.careerStats, best.rank, prize),
        prizeInfo: { race, prize, pts: race.championship ? 0 : pts, best, mandateHit, breakSurvived: sim.breakSurvived, hadBreak: sim.hadBreak, courseRecord, objectiveResult: objRes.log ? objRes.objective : null, objectiveDone: objRes.justDone },
        screen: "result",
      };
    });
  }

  // v35(チームTT): チームTTの結果確定。チーム順位で得点・賞金を付与し、出走選手にチーム着順を記録
  function finishTeamTT(sim, race) {
    const teams = sim.teamTT;
    const playerTeam = teams.find(t => t.isPlayer);
    const teamRank = playerTeam ? playerTeam.rank : teams.length;
    const totalTeams = teams.length;
    const mul = CLASSES[g.classIdx].prizeMul * GRADE_MUL[race.grade];
    // チーム1つの結果なので、個人レースの複数入賞相当に賞金を厚めに換算
    const prize = Math.round((PRIZES[teamRank - 1] || 1) * mul * 2.4);
    const mandateHit = !race.championship && !!race.sponsorMandate;
    let pts = Math.round((PTS[teamRank - 1] || 0) * GRADE_MUL[race.grade]);
    if (mandateHit) pts = Math.round(pts * 1.3);
    const starterIds = new Set((playerTeam ? playerTeam.riders : []).map(r => r.id));
    setG(s => {
      const roster = s.roster.map(r => starterIds.has(r.id)
        ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: teamRank, role: "tt" }] }
        : r);
      // v40（第1候補②）：チームTTでも中期目標の進捗を判定（チーム着順を最上位着順とみなす。エース年齢は無し）
      let sponsor = (s.sponsor && mandateHit) ? { ...s.sponsor, mandatesMet: s.sponsor.mandatesMet + 1 } : s.sponsor;
      const objRes = advanceObjective(sponsor && sponsor.objective, raceObjectiveEvent(race, teamRank, null), MONTHS[s.month]);
      if (sponsor && sponsor.objective) sponsor = { ...sponsor, objective: objRes.objective };
      return {
        ...s, roster, sponsor,
        log: objRes.log ? [...s.log, objRes.log] : s.log,
        budget: s.budget + prize + objRes.budgetDelta,
        points: race.championship ? s.points : s.points + pts + objRes.pointsDelta,
        careerStats: bumpCareerStats(s.careerStats, teamRank, prize),
        prizeInfo: { race, prize, pts: race.championship ? 0 : pts, teamTT: teams, teamRank, totalTeams, mandateHit, objectiveResult: objRes.log ? objRes.objective : null, objectiveDone: objRes.justDone },
        screen: "result",
      };
    });
  }

  function finishStage(sim, race, stageOverride) {
    const times = {}; sim.entrants.forEach(en => { times[en.id] = en.finishTime; });
    const stage = stageOverride || (g.gc ? g.gc.stage : 1);
    const totalStages = race.stageCount || 2;
    // v14.8: ステージごとに役割を変更できるようになったため、フレーバーテキスト用に
    // 「その日単独の着順・役割」もdayLogとして日ごとに記録しておく（GC総合成績とは別枠）
    const dayOrder = [...sim.entrants].sort((a, b) => a.finishTime - b.finishTime);
    const dayRankById = {}; dayOrder.forEach((en, i) => { dayRankById[en.id] = i + 1; });
    const dayRoleById = {}; sim.entrants.forEach(en => { dayRoleById[en.id] = en.isAce ? "ace" : en.role; });
    const dayLog = { day: stage, rankById: dayRankById, roleById: dayRoleById };
    if (stage < totalStages) {
      stage2LockRef.current = false;
      setG(s => ({ ...s, gc: { ...s.gc, stageTimes: { ...s.gc.stageTimes, [stage]: times }, dayLogs: [...(s.gc.dayLogs || []), dayLog] }, screen: "gc_stage" }));
    } else {
      setG(s => {
        const dayLogs = [...(s.gc.dayLogs || []), dayLog];
        const allStageTimes = { ...s.gc.stageTimes, [stage]: times };
        const gcTimes = {};
        Object.keys(times).forEach(id => {
          gcTimes[id] = Object.values(allStageTimes).reduce((sum2, st) => sum2 + (st[id] || 0), 0);
        });
        const order = Object.entries(gcTimes).sort((a, b) => a[1] - b[1]);
        const idToEntrant = {}; sim.entrants.forEach(en => { idToEntrant[en.id] = en; });
        const playerRanks = order.map(([id], i) => ({ id, rank: i + 1 })).filter(o => idToEntrant[o.id]?.team === "PLAYER");
        const bestRank = playerRanks.length ? Math.min(...playerRanks.map(o => o.rank)) : order.length;
        const prize = Math.round((PRIZES[bestRank - 1] || 1) * CLASSES[s.classIdx].prizeMul * 2.2);
        // v13: 昇格戦（championship）は年度末に近くポイントがどのみちリセットされるため対象外。
        // グランツールなど通常カレンダー上のステージレースは、複数日にわたる大会である
        // ことを踏まえ通常レースよりポイント倍率を優遇する
        const pts = race.championship ? 0 : Math.round((PTS[bestRank - 1] || 0) * GRADE_MUL[race.grade] * 1.3);
        // v13: 選手名鑑用に、ステージレース全体の総合着順を各選手のraceLogへ記録する
        // （各日のステージ結果ではなく、最終確定した総合成績のみを1件記録する）
        const rankById = {}; playerRanks.forEach(o => { rankById[o.id] = o.rank; });
        // v14.6: フレーバーテキストでの役割参照用（最終日時点の役割を代表値として使う）
        const roleOf = (id) => { const en = idToEntrant[id]; return en ? (en.isAce ? "ace" : en.role) : undefined; };
        // v14.8: ステージレースなら日ごとの内訳（役割・その日の着順）もraceLogに添えて記録する
        const stageBreakdownFor = (id) => race.stageRace
          ? dayLogs.map(dl => ({ day: dl.day, role: dl.roleById[id], rank: dl.rankById[id] })).filter(d => d.rank != null)
          : undefined;
        const roster = s.roster.map(r => rankById[r.id] != null
          ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: rankById[r.id], role: roleOf(r.id), stageBreakdown: stageBreakdownFor(r.id) }] }
          : r);
        // v13.1: ライバルチームに拾われた元選手のGC総合成績もraceLogへ記録する
        const alumniRanks = order.map(([id], i) => ({ id, rank: i + 1 })).filter(o => idToEntrant[o.id]?.isAlumnus);
        const alumniRankById = {}; alumniRanks.forEach(o => { alumniRankById[o.id] = o.rank; });
        const rivalAlumni = (s.rivalAlumni || []).map(r => alumniRankById[r.id] != null
          ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: alumniRankById[r.id], role: roleOf(r.id), stageBreakdown: stageBreakdownFor(r.id) }] }
          : r);
        // v14.8: グランツールで自チーム総合優勝ならそのgtIndexを勝利記録に加える（重複防止）
        const gtNewWin = race.grandTour && bestRank === 1 && race.gtIndex != null && !(s.gtWins || []).includes(race.gtIndex);
        const gtWins = gtNewWin ? [...(s.gtWins || []), race.gtIndex] : (s.gtWins || []);
        // v28: 通算タイトル記録（グランツール総合優勝）
        if (gtNewWin) recordTitle("grandTour");
        // v18: グランツールの副次クラシフィケーション（ポイント賞・山岳賞・新人賞）。
        // 実際のGCタイムとは別に、各ステージの着順を日ごとの地形（favors）で重み付けして
        // 集計する。新人賞は26歳未満の選手の中でのGC最高位。自チームの選手が獲得すれば
        // ボーナス賞金を上乗せする
        const STAGE_JERSEY_POINTS = [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        let jerseyBonus = 0;
        let jerseyInfo = null;
        if (race.grandTour) {
          const pointsScore = {}, komScore = {};
          dayLogs.forEach(dl => {
            const dayTmpl = race.stageTmpls ? race.stageTmpls[dl.day - 1] : race.tmpl;
            const favors = dayTmpl ? dayTmpl.favors : race.tmpl.favors;
            const pointsMul = favors === "SPR" ? 1.5 : favors === "PUN" ? 1.0 : favors === "CLM" ? 0.6 : 1.0;
            const komMul = favors === "CLM" ? 1.5 : favors === "PUN" ? 0.6 : 0.2;
            Object.entries(dl.rankById).forEach(([id, rank]) => {
              const base = STAGE_JERSEY_POINTS[rank - 1] || 0;
              pointsScore[id] = (pointsScore[id] || 0) + base * pointsMul;
              komScore[id] = (komScore[id] || 0) + base * komMul;
            });
          });
          const byScoreDesc = (score) => Object.keys(score).sort((a, b) => score[b] - score[a]);
          const pointsLeaderId = byScoreDesc(pointsScore)[0] || null;
          const komLeaderId = byScoreDesc(komScore)[0] || null;
          const youthOrder = order.filter(([id]) => idToEntrant[id] && idToEntrant[id].age <= 25);
          const youthLeaderId = youthOrder.length ? youthOrder[0][0] : null;
          const isPlayer = (id) => id != null && idToEntrant[id]?.team === "PLAYER";
          const pointsLeaderIsPlayer = isPlayer(pointsLeaderId);
          const komLeaderIsPlayer = isPlayer(komLeaderId);
          const youthLeaderIsPlayer = isPlayer(youthLeaderId);
          jerseyBonus = (pointsLeaderIsPlayer ? 50 : 0) + (komLeaderIsPlayer ? 50 : 0) + (youthLeaderIsPlayer ? 30 : 0);
          jerseyInfo = {
            pointsLeaderId, pointsLeaderName: pointsLeaderId ? idToEntrant[pointsLeaderId].name : null, pointsLeaderIsPlayer,
            komLeaderId, komLeaderName: komLeaderId ? idToEntrant[komLeaderId].name : null, komLeaderIsPlayer,
            youthLeaderId, youthLeaderName: youthLeaderId ? idToEntrant[youthLeaderId].name : null, youthLeaderIsPlayer,
          };
        }
        const jerseyWinCounts = { ...(s.jerseyWinCounts || { points: 0, mountains: 0, youth: 0 }) };
        if (jerseyInfo?.pointsLeaderIsPlayer) jerseyWinCounts.points += 1;
        if (jerseyInfo?.komLeaderIsPlayer) jerseyWinCounts.mountains += 1;
        if (jerseyInfo?.youthLeaderIsPlayer) jerseyWinCounts.youth += 1;
        // v40（第1候補②）：ステージレース（グランツール等）でも中期目標の進捗を判定
        const bestEntry = playerRanks.find(o => o.rank === bestRank);
        const aceAge = bestEntry ? (idToEntrant[bestEntry.id]?.age ?? null) : null;
        let sponsor = s.sponsor;
        const objRes = advanceObjective(sponsor && sponsor.objective, raceObjectiveEvent(race, bestRank, aceAge), MONTHS[s.month]);
        if (sponsor && sponsor.objective) sponsor = { ...sponsor, objective: objRes.objective };
        return {
          ...s, roster, rivalAlumni, sponsor, budget: s.budget + prize + jerseyBonus + objRes.budgetDelta,
          points: race.championship ? s.points : s.points + pts + objRes.pointsDelta, champBest: bestRank,
          log: objRes.log ? [...s.log, objRes.log] : s.log,
          careerStats: bumpCareerStats(s.careerStats, bestRank, prize + jerseyBonus),
          gc: { ...s.gc, gcOrder: order, idToEntrant, bestRank, prize: prize + jerseyBonus, pts, jerseyInfo, jerseyBonus, objectiveResult: objRes.log ? objRes.objective : null, objectiveDone: objRes.justDone },
          gtWins, jerseyWinCounts,
          screen: "gc_final",
        };
      });
    }
  }

  const raceFinishHandler = () => {
    if (g.gc && g.gc.race.stageRace) finishStage(g.result, g.gc.race, g.gc.stage);
    else finishRace(g.result, g.result.raceMeta);
  };

  // ==== v14: マイライフモード専用ハンドラ ====
  // v15: 節目の大会。通常の月次カレンダーとは別枠で、特定の月・クラス到達時にのみ登場する
  // 最高格付け（グレード4）の一発勝負。世界選手権は毎年9月・クラスA以上で選出、
  // オリンピックは4年に一度7月・PROクラスでのみ選出される。ライバルも代表入りし、
  // 大舞台での因縁の対決になる
  function mlGenRace(year, month, classIdx) {
    if (month === 5 && classIdx >= 1) {
      const wrng = mulberry(year * 401 + month * 7 + 501);
      return { id: `ml-worlds-${year}`, name: `${year}年目 世界選手権ロードレース`, tmpl: TEMPLATES[2], grade: 4, cls: classIdx, milestone: "worlds", rivalPresent: true, rival2Present: true, weather: rollWeather(wrng) };
    }
    if (month === 3 && classIdx >= 2 && (year - 1) % 4 === 0) {
      const wrng = mulberry(year * 401 + month * 7 + 502);
      return { id: `ml-olympics-${year}`, name: `${year}年目 オリンピック ロードレース`, tmpl: TEMPLATES[3], grade: 4, cls: classIdx, milestone: "olympics", rivalPresent: true, rival2Present: true, weather: rollWeather(wrng) };
    }
    // v33.11: モニュメント（クラシック）。特定の月は格式高いワンデー古典が開催される
    const mon = ML_MONUMENTS.find(m => m.month === month);
    if (mon) {
      const mrng = mulberry(year * 401 + month * 7 + 613);
      return { id: `ml-mon-${mon.id}-${year}`, name: `${year}年目 ${mon.name}`, tmpl: mon.tmpl, grade: mon.grade, cls: classIdx, monument: mon.id, monumentName: mon.name, rivalPresent: true, rival2Present: mrng() < 0.5, weather: rollWeather(mrng) };
    }
    const rng = mulberry(year * 3001 + month * 97 + classIdx * 17);
    const pool = unlockedTemplates();
    const t = pool[Math.floor(rng() * pool.length)];
    const grade = month === 11 ? 3 : 1 + Math.floor(rng() * 3);
    // v15: 約45%の確率でその月のレースにライバルが出走してくる（rival自体はキャラ作成時に固定生成済み）
    const rivalPresent = rng() < 0.45;
    // v26: 2人目のライバル（好敵手）も独立した確率で出走してくる
    const rival2Present = rng() < 0.45;
    return { id: `ml-${year}-${month}`, name: `${VENUES[Math.floor(rng() * VENUES.length)]}${t.kind}`, tmpl: t, grade, cls: classIdx, rivalPresent, rival2Present, weather: rollWeather(rng) };
  }
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
  function mlSetFocus(key) {
    setMl(s => ({ ...s, player: { ...s.player, focus: key } }));
  }
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
  function mlLastRaceFinish() {
    mlRaceLockRef.current = false;
    const sim = ml.result;
    const me = sim.ranked.find(e => e.isPlayerChar);
    const rank = me ? me.rank : sim.ranked.length;
    const total = sim.ranked.length;
    const flavor = rank === 1 ? "最後のレースを、なんと勝利で締めくくった！最高の花道だ。"
      : rank <= 3 ? "最後のレースで堂々の表彰台。見事な有終の美を飾った。"
      : rank <= 10 ? "最後まで集団に食らいつき、力を出し切って走り抜けた。"
      : "結果は振るわなかったが、最後まで自分の走りを貫いた。悔いはない。";
    setMl(s => {
      // ラストレースの戦績も通算記録に含めてから殿堂入りさせる
      const player = { ...s.player, raceLog: [...(s.player.raceLog || []), { year: s.year, month: s.month, name: sim.raceMeta.name, rank, role: "ace" }] };
      const finalState = { ...s, player };
      mlRecordLegend(finalState);
      return {
        ...finalState, inLastRace: false, result: null,
        lastRaceResult: { rank, total, flavor, name: sim.raceMeta.name },
        screen: "mylife_retired",
        log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】ラストレースで${rank}位。${player.age}歳で現役を退いた`],
      };
    });
  }
  // v37: マイライフのチームTTは「チームの順位」で結果を出す（個人simへ落とさない）。
  function mlFinishTeamTT(sim, race) {
    const teams = sim.teamTT;
    const playerTeam = teams.find(t => t.isPlayer);
    const teamRank = playerTeam ? playerTeam.rank : teams.length;
    const totalTeams = teams.length;
    const pts = Math.round((PTS[teamRank - 1] || 0) * GRADE_MUL[race.grade]);
    const prize = Math.round((PRIZES[teamRank - 1] || 1) * (0.4 + ml.classIdx * 0.25) * 2.4);
    const baseTime = teams[0].time;
    const teamStandings = teams.map(t => ({
      rank: t.rank, name: t.teamName || t.team, isPlayer: !!t.isPlayer,
      time: t.time, gap: t.time - baseTime,
      riders: (t.riders || []).map(r => r.name),
    }));
    setMl(s => {
      const player = { ...s.player, raceLog: [...(s.player.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: teamRank, role: "tt" }] };
      const wpGain = worldPointsForFinish(teamRank, race.grade);
      const worldPoints = (s.worldPoints || 0) + wpGain;
      const worldRank = computeWorldRank(worldPoints, s.year);
      const worldRankBest = s.worldRankBest == null ? worldRank : Math.min(s.worldRankBest, worldRank);
      const careerPodiums = (s.careerPodiums || 0) + (teamRank <= 3 ? 1 : 0);
      return {
        ...s, player, points: s.points + pts, money: s.money + prize,
        worldPoints, worldRank, worldRankBest, careerPodiums,
        resultInfo: { race, teamTT: true, teamRank, totalTeams, pts, prize, teamStandings, wpGain, worldRank, worldRankPrev: s.worldRank },
        screen: "mylife_result",
      };
    });
  }
  function mlRaceFinish() {
    mlRaceLockRef.current = false;
    const sim = ml.result;
    const race = ml.races[0];
    if (sim.teamTT) { mlFinishTeamTT(sim, race); return; }
    const me = sim.ranked.find(e => e.isPlayerChar);
    const pts = Math.round((PTS[me.rank - 1] || 0) * GRADE_MUL[race.grade]);
    // v14.3: 監督指示を全うできたかどうかで監督評価が増減する。賞金はクラス倍率に応じて即時支給
    // v33.5: セーブから復元した監督指示はJSONでcheck関数が失われているため、キーで正規テーブルから引き直す
    const directive = ml.directive ? (MANAGER_DIRECTIVES[ml.directive.key] || ml.directive) : null;
    // v33.6: 「アシストに徹する」を選んだ場合は監督指示ではなく献身の走りとして評価する。
    // 献身は自らの着順を犠牲にする行為なので、監督評価は下げず（むしろ小幅加点）運ゲーにしない
    const assistChosen = !!(ML_TACTICS[ml.tactic] && ML_TACTICS[ml.tactic].playerAssist);
    const fulfilled = assistChosen ? true : ((directive && typeof directive.check === "function") ? directive.check(me.rank, sim.ranked.length) : false);
    const evalDelta = assistChosen ? 3 : (directive ? (fulfilled ? directive.evalGain : -directive.evalPenalty) : 0);
    const prize = Math.round((PRIZES[me.rank - 1] || 0) * (0.4 + ml.classIdx * 0.25));
    // v15: このレースにライバルが出走していれば、着順を比較して通算のライバル戦績を更新する
    const rivalEntrant = sim.ranked.find(e => e.isRival);
    // v26: 複数ライバル制。2人目の好敵手も同様に戦績を追跡する
    const rival2Entrant = sim.ranked.find(e => e.isRival2);
    // v27: コースレコード。勝者のフィニッシュタイムからコース種別ごとの最速記録を更新する
    const winner = sim.ranked[0];
    const courseRecord = recordCourseResult(race.tmpl.kind, sim.course.length, winner.finishTime, winner.name, !!winner.isPlayerChar, ml.year);
    // v37: レース結果に「全順位表」を添える（着順・選手名・チーム名・トップとの秒差）。
    // これで自分以外の選手も識別でき、観戦→結果の一貫した見え方になる。
    const winTime = winner.finishTime;
    const standings = sim.ranked.map(e => ({
      rank: e.rank, name: e.name,
      team: e.teamName || (e.team === "PLAYER" ? ml.team : e.team) || "—",
      gap: Number.isFinite(e.finishTime) && Number.isFinite(winTime) ? e.finishTime - winTime : null,
      isPlayer: !!e.isPlayerChar, isMyTeam: e.team === "PLAYER",
      isRival: !!(e.isRival || e.isRival2), isAce: !!e.isAce,
      worldRank: e.worldRank || null,
    }));
    // v28: 通算タイトル記録（世界選手権・オリンピックで優勝したら）
    if (me.rank === 1 && race.milestone) recordTitle(race.milestone);
    // v28: 代表チームでの立場。世界選手権・オリンピックには代表監督から役割（エース/アシスト）が
    // 与えられる。役割を全うすると名声（人気度）が大きく上がる
    const natRole = race.nationalRole || null;
    const natFulfilled = natRole ? (natRole === "ace" ? me.rank <= 3 : me.rank <= 10) : false;
    const natPopBonus = natRole ? (natFulfilled ? (natRole === "ace" ? 8 : 5) : 0) : 0;
    setMl(s => {
      // v14.6: マイライフでは監督指示のキー自体がその一戦での役割を表すので、そのまま記録する
      // v33.6: ただし「アシストに徹する」を選んだ場合は監督指示に関わらず献身役として記録し、
      // 献身の道（アンビション）へ確実にカウントされるようにする（監督指示待ちの運ゲーを解消）
      const role = assistChosen ? "support" : (directive ? directive.key : (me.isAce ? "ace" : "support"));
      // v25: 個人スポンサー・メディア人気度。着順が良いほど、また規模の大きいレースほど伸びる
      // v28: 代表の役割を全うすれば名声（人気度）が上乗せされる
      const popGain = (me.rank === 1 ? 3 : me.rank <= 3 ? 1.5 : me.rank <= 10 ? 0.5 : 0.1) * GRADE_MUL[race.grade] + natPopBonus;
      const popMilestones = s.player.popMilestones || [];
      const newPopularity = Math.max(0, Math.min(100, (s.player.popularity || 0) + popGain));
      let popBonus = 0;
      const newlyHit = [];
      POP_MILESTONES.forEach(m => {
        if (newPopularity >= m.th && !popMilestones.includes(m.th)) { popBonus += m.bonus; newlyHit.push(m.th); }
      });
      const player = {
        ...s.player,
        raceLog: [...(s.player.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: me.rank, role, monument: race.monument || undefined }],
        popularity: newPopularity,
        popMilestones: [...popMilestones, ...newlyHit],
      };
      let rivalRecord = s.rivalRecord;
      let rivalOutcome = null;
      if (rivalEntrant) {
        const beat = me.rank < rivalEntrant.rank;
        // v35(D 物語): 因縁が育つライバル。接戦ほど因縁度が燃え、決定的瞬間の一文を生成する
        const gapSec = Math.abs((me.finishTime || 0) - (rivalEntrant.finishTime || 0));
        const heatBefore = rivalRecord?.heat ?? rivalRecord?.meetings ?? 0;
        const heatAfter = heatBefore + rivalMeetingHeat(gapSec);
        rivalRecord = {
          meetings: (rivalRecord?.meetings || 0) + 1,
          wins: (rivalRecord?.wins || 0) + (beat ? 1 : 0),
          losses: (rivalRecord?.losses || 0) + (beat ? 0 : 1),
          heat: heatAfter,
        };
        const drama = rivalDrama({ beat, gapSec, rivalName: rivalEntrant.name, rivalRank: rivalEntrant.rank, myRank: me.rank, heatBefore, heatAfter });
        // v36(#6): 性格ベースの会話ドラマ（紙芝居/VN風）。ライバルの性格で掛け合いを生成
        const dialogue = rivalDialogue({ rival: s.rival, beat, gapSec, heatAfter, playerName: s.player.name, seed: s.year * 137 + s.month * 7 + me.rank });
        // v36修正: 接戦（8秒未満）か因縁が深まった時（heat≥4）だけ、返答を選べる双方向の対話シーンを用意。
        // 毎戦だと冗長なので"見せ場"に限定する。
        const sceneWorthy = Math.abs(gapSec) < 8 || heatAfter >= 4;
        const scene = sceneWorthy ? rivalScene({ rival: s.rival, beat, gapSec, heatAfter, playerName: s.player.name, seed: s.year * 137 + s.month * 7 + me.rank, record: s.rivalRecord, big: !!(race.milestone || race.monument || race.grade >= 4) }) : null;
        rivalOutcome = { name: rivalEntrant.name, rank: rivalEntrant.rank, beat, line: drama.line, promoted: drama.promoted, tierLabel: drama.tier.label, tierColor: drama.tier.color, dialogue, scene };
      }
      // v26: 複数ライバル制。2人目の好敵手は初対戦時だけ「新たな好敵手が現れた」という
      // 紹介フレーバーを付ける
      let rivalRecord2 = s.rivalRecord2;
      let rivalOutcome2 = null;
      let rival2Intro = false;
      if (rival2Entrant) {
        const isFirstMeeting = (rivalRecord2?.meetings || 0) === 0;
        const beat2 = me.rank < rival2Entrant.rank;
        const gap2 = Math.abs((me.finishTime || 0) - (rival2Entrant.finishTime || 0));
        const heat2Before = rivalRecord2?.heat ?? rivalRecord2?.meetings ?? 0;
        const heat2After = heat2Before + rivalMeetingHeat(gap2);
        rivalRecord2 = {
          meetings: (rivalRecord2?.meetings || 0) + 1,
          wins: (rivalRecord2?.wins || 0) + (beat2 ? 1 : 0),
          losses: (rivalRecord2?.losses || 0) + (beat2 ? 0 : 1),
          heat: heat2After,
        };
        const drama2 = rivalDrama({ beat: beat2, gapSec: gap2, rivalName: rival2Entrant.name, rivalRank: rival2Entrant.rank, myRank: me.rank, heatBefore: heat2Before, heatAfter: heat2After });
        const dialogue2 = rivalDialogue({ rival: s.rival2, beat: beat2, gapSec: gap2, heatAfter: heat2After, playerName: s.player.name, seed: s.year * 149 + s.month * 11 + me.rank });
        rivalOutcome2 = { name: rival2Entrant.name, rank: rival2Entrant.rank, beat: beat2, line: drama2.line, promoted: isFirstMeeting ? null : drama2.promoted, tierLabel: drama2.tier.label, tierColor: drama2.tier.color, dialogue: dialogue2 };
        rival2Intro = isFirstMeeting;
      }
      let log = newlyHit.length > 0
        ? [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】人気度が${newlyHit.join("・")}に到達し、個人スポンサー契約で+${popBonus}万円`]
        : s.log;
      if (rival2Intro) log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】${rival2Entrant.teamName}の${rival2Entrant.name}と初めて同じレースで相まみえた。新たな好敵手になりそうだ`];
      // v35(D 物語): 因縁度が上がった瞬間はログにも刻む（決定的な一戦の記録）
      if (rivalOutcome && rivalOutcome.promoted) log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】${rivalOutcome.promoted.replace(/^——/, "")}`];
      if (rivalOutcome2 && rivalOutcome2.promoted) log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】${rivalOutcome2.promoted.replace(/^——/, "")}`];
      // v30: 世界ランキング更新＆キャリア・アンビション判定
      const wpGain = worldPointsForFinish(me.rank, race.grade);
      const worldPoints = (s.worldPoints || 0) + wpGain;
      const worldRank = computeWorldRank(worldPoints, s.year);
      const worldRankBest = s.worldRankBest == null ? worldRank : Math.min(s.worldRankBest, worldRank);
      const careerWins = (s.careerWins || 0) + (me.rank === 1 ? 1 : 0);
      const careerPodiums = (s.careerPodiums || 0) + (me.rank <= 3 ? 1 : 0);
      const careerBigWins = (s.careerBigWins || 0) + (me.rank === 1 && race.grade >= 3 ? 1 : 0);
      const careerTitles = (s.careerTitles || 0) + (me.rank === 1 && race.milestone ? 1 : 0);
      const careerClassics = (s.careerClassics || 0) + (me.rank === 1 && race.monument ? 1 : 0); // v33.11: モニュメント制覇数
      let ambitionIdx = s.ambitionIdx || 0;
      let ambitionDone = s.ambitionDone || [];
      let ambitionCleared = null;
      let ambMoney = 0;
      // 判定は更新後の到達値で行う（順位・通算勝利・アシスト出走数等を反映した一時ビュー）
      const progressedMl = { ...s, player, worldRank, careerWins, careerPodiums, careerBigWins, careerTitles };
      const curAmb = mlCurrentAmbition(progressedMl); // 現在の路線・段の目標
      if (curAmb && mlAmbitionCleared(progressedMl, curAmb)) {
        const rw = applyAmbitionReward(curAmb.reward, player, 0);
        ambMoney = rw.money;
        ambitionCleared = { label: curAmb.label, rewardText: rw.text };
        ambitionIdx = ambitionIdx + 1;
        ambitionDone = [...ambitionDone, curAmb.key];
        log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】🎯アンビション「${curAmb.label}」を達成！（${rw.text}）`];
      }
      // v33.8: 献身の走りの成果。支えたエースが上位に入れば名アシストとして評価・人気・報酬が上乗せされる
      let assistOutcome = null, assistPop = 0, assistEval = 0, assistMoney = 0;
      if (sim.assistedAce) {
        // v39.4修正: エースの着順は最終ランキング（判断カードの再計算後）から引き直す。
        // 従来は buildMyLifeSim 時点のsnapshot rankを使っており、レース中の判断で順位が変わると
        // 「アシストの自分が1位なのにエースも1位」等の食い違いが起きていた。
        const aceEntrant = sim.ranked.find(e => e.id === sim.assistedAce.id);
        const ar = aceEntrant ? aceEntrant.rank : sim.assistedAce.rank;
        const success = ar <= 3;
        assistOutcome = { name: sim.assistedAce.name, rank: ar, success };
        if (success) {
          assistPop = ar === 1 ? 2.5 : 1.5; assistEval = ar === 1 ? 4 : 2; assistMoney = ar === 1 ? 30 : 15;
          log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】🤝 あなたの献身の牽引でエース${sim.assistedAce.name}が${ar}位！名アシストとして称えられた（人気+${assistPop}・評価+${assistEval}・+${assistMoney}万円）`];
        } else {
          log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】🤝 エース${sim.assistedAce.name}を最後まで牽引したが${ar}位。報われない走りになった`];
        }
      }
      if (assistPop) player.popularity = Math.max(0, Math.min(100, player.popularity + assistPop));
      // v36(#7): 大勝・連勝を「号外」として演出（値するときだけnon-null）
      const newspaper = mlNewspaper({ player, race, rank: me.rank, careerWins, worldRank, year: s.year, month: s.month });
      return {
        ...s, player, points: s.points + pts, log,
        managerEval: Math.max(0, Math.min(100, s.managerEval + evalDelta + assistEval)),
        money: s.money + prize + popBonus + ambMoney + assistMoney, rivalRecord, rivalRecord2,
        worldPoints, worldRank, worldRankBest, careerWins, careerPodiums, careerBigWins, careerTitles, careerClassics,
        ambitionIdx, ambitionDone,
        // v37: 永続キャラ（ライバル／チームメイト）の成績台帳を更新
        riderStats: mlUpdateRiderStats(s.riderStats, sim.ranked, new Set([...(s.teammates || []).map(t => t.id), ...(s.protege ? [s.protege.id] : [])]), s.year),
        resultInfo: { race, rank: me.rank, total: sim.ranked.length, pts, directive, fulfilled, evalDelta, prize, rivalOutcome, rivalOutcome2, rival2Intro, popGain: Math.round(popGain * 10) / 10, popBonus, courseRecord, natRole, natFulfilled, natPopBonus, wpGain, worldRank, worldRankPrev: s.worldRank, ambitionCleared, assistOutcome,
          // v34(UI): レース後サマリーの整理。フィニッシュタイム・トップとの差・下馬評の答え合わせ。
          finishTime: me.finishTime, gapSec: me.rank === 1 ? 0 : (me.finishTime - winner.finishTime),
          forecast: (() => { const fc = raceForecast(sim.entrants, race.tmpl?.favors); const my = fc.get(me); return my ? { rank: my.rank, mark: my.mark ? my.mark.label : "無印", markColor: my.mark ? my.mark.color : "#9aa3b5" } : null; })(),
          newspaper, standings },
        screen: "mylife_result",
      };
    });
  }
  // v14.2: 月次アクションを「レース／練習」の2択から拡張。練習・休養・イベントで
  // 選手への効果を出し分ける（順位・ポイント・賞金は既にmlRaceFinish側で反映済みのため
  // ここでは疲労・出走経験による能力成長を扱う）。
  // v14.3: 永続トレーニング用品（ローラー台・パワーメーター）と車（レース疲労軽減）の
  // 恒常効果もここで反映する
  function mlApplyMonthEffect(player0, mode, ctx) {
    const player = { ...player0 };
    // v38(#9 B-2): 活力（バイタリティ）。疲労が短期の"その月の重さ"なのに対し、活力は長期の
    // "伸びしろの芯・鮮度"。走り込むほど（特に格上レース）少しずつ減り、完全休養やオフで回復する。
    // 活力が高いほど成長が満額に近く、低いと伸びが鈍る＝「休ませて育てる」戦略性が生まれる。
    if (player.vitality == null) player.vitality = 100;
    const vitMul = 0.55 + 0.45 * Math.min(1, Math.max(0, player.vitality) / 70); // 活力70+で満額、低いほど鈍化
    const gear = (ctx && ctx.gear) || {};
    const carLv = ctx ? ctx.carLv : -1;
    const houseLv = ctx ? ctx.houseLv : -1;
    const flags = (ctx && ctx.flags) || {};
    // v39.14(バランス): 難易度で成長上限を変える。従来は難易度がAIの強さにしか効かず、どの難易度でも
    // 2年ほどでカンストして「成長の楽しみ」が消えていた。上位難易度ほど天井が低く、伸ばし切るには
    // 長いキャリアと良い育成（活力・コーチ・特能）が要る＝難易度が育成そのものの手応えに直結する。
    const diffCapAdj = ({ easy: 4, normal: 0, hard: -5, oni: -10 })[(ctx && ctx.difficulty) || "easy"] ?? 0;
    const growthCap = mlGrowthCap(ctx && ctx.year, player) + diffCapAdj;
    // v35(バランス): マイライフには選手本人の故障システムが無く、「ガラスの体」（危険度＝濃い配合の代償）が
    // 完全に無効化されていた（＝インブリードがノーリスクで爆発力を得られる抜け穴）。故障システムを新設せず、
    // 脆い体を「疲労が溜まりやすく抜けにくい」形で表現し、健康管理（休養の頻度）に実コストを課す。
    const glassBody = hasAbility(player, "glass");
    if (mode === "race") {
      const carCut = carLv >= 0 ? (1 - ML_CARS[carLv].raceFatigueCut) : 1;
      const chefCut = gear.chef ? 0.9 : 1;
      // v15: 「鉄人」を持つ選手は出走疲労が軽減される（シーズンモードの45→32と同じ比率）
      const ironCut = hasAbility(player, "iron") ? 32 / 45 : 1;
      // v35: ガラスの体は逆に出走疲労が増える（脆く、消耗しやすい）
      const glassMul = glassBody ? 1.35 : 1;
      // v25: 天候の悪化。猛暑は出走後の疲労蓄積を増やす
      const raceWeather = ctx && ctx.raceWeather;
      const heatMul = raceWeather === "heat" ? 1.15 : 1;
      // v28: 役割を縮小して現役続行を選んだベテランは、レース負荷が軽くなり疲労蓄積が減る
      const roleCut = flags.reducedRole ? 0.85 : 1;
      player.fatigue = Math.min(100, player.fatigue + 40 * carCut * chefCut * ironCut * glassMul * heatMul * roleCut);
      player.streak = (player.streak || 0) + 1;
      // v25: シーズンモード同様、出走した種目に応じた能力成長（出走経験）を追加。
      // 格上のレース（グレードが高い）ほど得るものが大きい
      const raceExpKeys = (ctx && ctx.raceExpKeys) || [];
      const raceGradeMul = (ctx && ctx.raceGrade) ? (GRADE_MUL[ctx.raceGrade] || 1) : 1;
      // v25: 新人時代に恩師の指導を受けている間は、出走経験の伸びにもボーナスがかかる
      // v28: 「天才肌」は25歳以下の伸びが+15%
      const mentorMul = (flags.mentorActive ? 1.15 : 1) * (hasAbility(player, "genius_sp") && player.age <= 25 ? 1.15 : 1)
        * (hasAbility(player, "sponge") ? 1.25 : 1) // v37: 吸収の天才＝出走経験の伸び+25%
        * vitMul; // v38(#9 B-2): 活力が低いと出走経験の伸びも鈍る
      const ph = growthPhase(player);
      raceExpKeys.forEach(k => addAb(player, k, 1.0 * raceGradeMul * mentorMul * Math.max(0.2, ph.gain) * POW[player.growthPow].mul * persMul(player, k), growthCap));
      // v38(#9 B-2): レースで活力を消耗（格上ほど大きい）。走らせすぎると伸びの芯が細る
      player.vitality = Math.max(0, player.vitality - (5 + (ctx && ctx.raceGrade ? ctx.raceGrade : 1) * 2));
      // v29: メンタルは「大舞台の経験」で育つ。格上のレースほど大きく伸びる
      growSub(player, "mental", 0.35 * raceGradeMul * Math.max(0.25, ph.gain));
      // v25: 雨天レースは悪天候巧者を持たない選手に落車リスク（疲労急増＋わずかな能力の目減り）を上乗せする
      if (raceWeather === "rain" && Math.random() < (hasAbility(player, "rain_sp") ? 0.02 : 0.06)) {
        player.fatigue = Math.min(100, player.fatigue + 15);
        AB_KEYS.forEach(k => { player[k] = Math.max(20, player[k] - 2); });
        player.__weatherCrash = true;
      }
    } else if (mode === "train") {
      const ph = growthPhase(player);
      // v15: 「練習の虫」「練習嫌い」「遅咲き」の特殊能力を練習効果に反映
      // v17: 育児をパートナーに任せて競技優先を選んだ場合、練習効果がわずかに上乗せされる
      const abMul = (hasAbility(player, "trainer") ? 1.2 : hasAbility(player, "lazy_sp") ? 0.8 : 1)
        * (hasAbility(player, "lateblow_sp") && player.age >= 28 ? 1.15 : 1)
        // v28: 「天才肌」は25歳以下の練習効果+15%（遅咲きの逆で若手向け）
        * (hasAbility(player, "genius_sp") && player.age <= 25 ? 1.15 : 1)
        * (flags.childFocusedCareer ? 1.05 : 1)
        // v25: 新人時代に恩師の指導を受けている間は練習効果+15%
        * (flags.mentorActive ? 1.15 : 1)
        * vitMul; // v38(#9 B-2): 活力が低いと練習効果も鈍る
      const gain = 1.5 * ph.gain * POW[player.growthPow].mul * (gear.roller ? 1.15 : 1) * abMul;
      const focusMul = gear.monitor ? 1.10 : 1;
      // v15フェーズ2: 種目別専門コーチは、狙っている能力かどうかに関わらずそのアビリティの伸びを底上げする
      const coachMul = (k) => (gear[ML_AB_COACH_KEY[k]] ? 1.25 : 1);
      addAb(player, player.focus, gain * 0.9 * persMul(player, player.focus) * focusMul * coachMul(player.focus), growthCap);
      AB_KEYS.filter(k => k !== player.focus).forEach(k => addAb(player, k, gain * 0.14 * persMul(player, k) * coachMul(k), growthCap));
      const ph2 = growthPhase(player);
      if (ph2.dec > 0) AB_KEYS.forEach(k => { player[k] = Math.max(20, player[k] - ph2.dec); });
      // v29: 通常練習でも加速力・メンタルがわずかに伸びる（focusがsprint/flatなら加速に厚め）
      const subG = 0.28 * ph.gain * POW[player.growthPow].mul;
      growSub(player, "accel", subG * (player.focus === "sprint" || player.focus === "flat" ? 1.3 : 0.7));
      growSub(player, "mental", subG * 0.6);
      player.fatigue = Math.max(0, player.fatigue - 15 * (glassBody ? 0.75 : 1));
      player.vitality = Math.max(0, player.vitality - 3); // v38(#9 B-2): 練習でも活力を少し使う
      player.streak = 0;
    } else if (mode === "rest") {
      // v35: ガラスの体は回復も鈍い（休んでも抜けきらない＝より頻繁な休養を強いる）
      player.fatigue = Math.max(0, player.fatigue - 35 * (glassBody ? 0.78 : 1));
      // v36(#8): 完全休養を「疲労を抜くだけ」から意味のある回復へ。休むと心も整い（メンタル微増）、
      // フォームに上向きの偏り（フレッシュな脚＝後段のフォーム計算でrest分岐が下振れを消す）が付く。
      growSub(player, "mental", 0.5);
      player.vitality = Math.min(100, player.vitality + 22); // v38(#9 B-2): 完全休養で活力を大きく回復
      player.streak = 0;
    } else if (mode === "event") {
      player.fatigue = Math.max(0, player.fatigue - 5);
    } else if (mode === "peak") {
      // v29: ピーキング。レースに向けたコンディション調整。フォームを高め疲労も少し抜ける
      // （能力の成長は無く、あくまで「仕上げ」）
      player.fatigue = Math.max(0, player.fatigue - 12);
      player.streak = 0;
    } else if (ML_SPECIAL_TRAINING[mode]) {
      // v28: 専門トレーニング。対象2能力を強めに伸ばし、疲労を大きく消費する。
      // メンタル強化（対象能力なし）は全能力をわずかに底上げしつつ調子を整える枠
      const spec = ML_SPECIAL_TRAINING[mode];
      const ph = growthPhase(player);
      const abMul = (hasAbility(player, "trainer") ? 1.2 : hasAbility(player, "lazy_sp") ? 0.8 : 1)
        * (flags.mentorActive ? 1.15 : 1);
      const base = 1.5 * ph.gain * POW[player.growthPow].mul * (gear.roller ? 1.15 : 1) * abMul * spec.gainMul;
      const coachMul = (k) => (gear[ML_AB_COACH_KEY[k]] ? 1.25 : 1);
      if (spec.keys.length > 0) {
        spec.keys.forEach(k => addAb(player, k, base * 0.65 * persMul(player, k) * coachMul(k), growthCap));
        AB_KEYS.filter(k => !spec.keys.includes(k)).forEach(k => addAb(player, k, base * 0.08 * persMul(player, k) * coachMul(k), growthCap));
      } else {
        AB_KEYS.forEach(k => addAb(player, k, base * 0.18 * persMul(player, k) * coachMul(k), growthCap));
      }
      // v29: 専門トレの副ステータス育成。スプリント特訓＝加速力、メンタル強化＝メンタルを重点的に鍛える
      const subBase = ph.gain * POW[player.growthPow].mul;
      if (mode === "sprintcamp") growSub(player, "accel", 1.6 * subBase);
      if (mode === "mental") growSub(player, "mental", 1.8 * subBase);
      const ph2 = growthPhase(player);
      if (ph2.dec > 0) AB_KEYS.forEach(k => { player[k] = Math.max(20, player[k] - ph2.dec); });
      player.fatigue = Math.min(100, player.fatigue + spec.fatigue);
      if (spec.cond) player.form = Math.min(100, (player.form ?? 50) + spec.cond * 8); // v31.3: 調子→フォームに統合
      player.streak = 0;
    }
    if (houseLv >= 0) player.fatigue = Math.max(0, player.fatigue - ML_HOUSES[houseLv].fatigueBonus);
    // v15: 「回復力」を持つ選手は毎月さらに疲労-15（シーズンモードと同じ効果）
    if (hasAbility(player, "recover")) player.fatigue = Math.max(0, player.fatigue - 15);
    if (hasAbility(player, "recover2")) player.fatigue = Math.max(0, player.fatigue - 25); // v37(第2弾): 超回復
    // v15: 人生の岐路イベントで得た恒常効果（結婚による生活の安定／無理な怪我復帰の後遺症）
    if (flags.married) player.fatigue = Math.max(0, player.fatigue - 4);
    if (flags.rushedInjuryComeback) player.fatigue = Math.min(100, player.fatigue + 3);
    // v17: 育児に積極的に関わる道を選んだ場合、家庭のサポートでさらに疲労が抜けやすくなる
    if (flags.hasChild && !flags.childFocusedCareer) player.fatigue = Math.max(0, player.fatigue - 3);
    // v18: 若手のメンターになると、後進を気にかける充実感から疲労がわずかに抜けやすくなる
    if (flags.mentor) player.fatigue = Math.max(0, player.fatigue - 3);
    // v31.3: 「調子(cond)」と「フォーム(form)」は、どちらも当日の能力を上下させる二重の指標で
    // 分かりづらいという指摘を受け、マイライフではフォーム(0-100)に一本化した。調子は中立(3)に
    // 固定して能力への二重補正を止め、月々の好不調の波・予報・ピーキングをすべてフォームに集約する。
    player.cond = 3;
    const mentalSteady = Math.max(0.6, Math.min(1.4, 1 - ((player.mental ?? 50) - 50) / 250));
    // 毎月の波の大きさ（moodyは激しく、精密機械/steady_spは小さく、メンタルが高いほど安定）
    const swingMag = (hasAbility(player, "moody") ? 10 : hasAbility(player, "steady_sp") ? 3 : 6) * mentalSteady;
    const dir = (player.formForecast != null) ? player.formForecast : rollCondDir();
    const curForm = player.form ?? 50;
    // ピーキング調整の月はフォームが大きく上がる。それ以外は基準値(48)へ戻りつつ月々の波が乗る
    // ＝ピークは維持し続けられず、大レースに合わせて仕上げる駆け引きになる
    const nextForm = mode === "peak"
      ? curForm + 24
      // v36(#8): 完全休養はフレッシュな脚。基準を少し上（52）に引き上げ、月々の下振れを消して
      // 小さな上げ底（+4）を付ける＝大レース前に「休んで整える」戦術的価値を持たせる。
      : mode === "rest"
        ? curForm + (52 - curForm) * 0.35 + Math.abs(dir) * swingMag * 0.5 + 4
        : curForm + (48 - curForm) * 0.30 + dir * swingMag;
    player.form = Math.max(0, Math.min(100, Math.round(nextForm)));
    player.formForecast = rollCondDir(); // 翌月の波の向きを予報
    return player;
  }
  function mlAdvanceMonth(mode) {
    setMl(s => {
      // v25: シーズンモードと同様、マイライフでも出走した種目に応じた「出走経験」で能力が伸びるようにする
      // （従来は出走しても疲労とストリークが変化するだけで能力は一切伸びなかった）
      const raceExpKeys = (mode === "race" && s.result && s.result.course)
        ? [...new Set(s.result.course.segs.map(seg => SEG_AB[seg.type]))] : [];
      const raceGrade = (mode === "race" && s.resultInfo) ? s.resultInfo.race.grade : null;
      const raceWeather = (mode === "race" && s.resultInfo) ? s.resultInfo.race.weather : null;
      const ctx = { gear: s.gear, houseLv: s.houseLv, carLv: s.carLv, flags: s.flags, year: s.year, difficulty: s.difficulty, raceExpKeys, raceGrade, raceWeather };
      // v38(改善:育成の手応え): 月次アクション前の能力・OVR・活力を控えておき、後で「今月の成長」を可視化する
      const _preAb = {}; AB_KEYS.forEach(k => { _preAb[k] = s.player[k] || 0; });
      const _preSub = { accel: s.player.accel || 0, mental: s.player.mental || 0 };
      const _preOvr = overall(s.player);
      const _preVit = s.player.vitality == null ? 100 : s.player.vitality;
      let player = mlApplyMonthEffect(s.player, mode, ctx);
      const log = [...s.log];
      if (ML_SPECIAL_TRAINING[mode]) log.push(`【${s.year}年目 ${MONTHS[s.month]}】${ML_SPECIAL_TRAINING[mode].label}を実施した`);
      if (player.__weatherCrash) {
        log.push(`【${s.year}年目 ${MONTHS[s.month]}】雨天のレースで危うく転倒しかけ、ヒヤッとした…`);
        player = { ...player, __weatherCrash: undefined };
      }
      // v15フェーズ2: 金特化の判定
      const upgradedPlayer = upgradeGoldAbilities(player);
      if (upgradedPlayer !== player) {
        upgradedPlayer.goldAbilities.filter(id => !(player.goldAbilities || []).includes(id))
          .forEach(id => log.push(`【${s.year}年目 ${MONTHS[s.month]}】特殊能力「${ABILITIES[id].label}」が金特に覚醒した！`));
        player = upgradedPlayer;
      }
      // v17: 特殊能力の後天的獲得判定
      const acquiredPlayer = acquireNewAbility(player);
      if (acquiredPlayer !== player) {
        const newId = acquiredPlayer.abilities[acquiredPlayer.abilities.length - 1];
        log.push(`【${s.year}年目 ${MONTHS[s.month]}】特殊能力「${ABILITIES[newId].label}」を新たに身につけた！`);
        player = acquiredPlayer;
      }
      // v14.3: 毎月、練習を積んだり生活基盤（一戸建て）が整っていると監督評価がじわじわ上がる。
      // 年俸は毎月1/12ずつ資金として振り込まれる
      const passiveEvalDelta = (mode === "train" ? 0.4 : 0) + (s.houseLv >= 2 ? 0.3 : 0) + (s.houseLv >= 3 ? 0.2 : 0) + (s.flags?.mentor ? 0.3 : 0);
      const managerEval = Math.max(0, Math.min(100, s.managerEval + passiveEvalDelta));
      // v25: 個人スポンサー収入。人気度10ごとに月+2万円の継続収入が入る（チーム年俸とは別枠）
      const popIncome = Math.floor((s.player.popularity || 0) / 10) * 2;
      // v27: 生活費・税負担。年俸が上がるほど生活水準・税負担も増し、手元に残る額は
      // 頭打ちになる。高級車・住居のグレードにも維持費がかかる。これによりキャリア後半に
      // 資金がダブついて緊張感が失われる（＝ヌルゲー化）のを抑える
      const livingCost = mlLivingCost(s);
      const money = Math.max(0, s.money + Math.round(s.salary / 12) + popIncome - livingCost);
      if (s.month === 11) {
        player.age += 1;
        // v38(#9 B-2): オフシーズンで活力が回復（走り込んだ体もひと冬でリフレッシュ）。若いほど戻りが良い。
        player.vitality = Math.min(100, (player.vitality == null ? 100 : player.vitality) + (player.age <= 27 ? 40 : player.age <= 32 ? 30 : 20));
        // v38: ワールド選手の世代交代。年度替わりに全チームの選手を1歳加齢させ、
        // ピーク前は成長・ピーク後は衰えを反映。高齢者は引退して新人ルーキーに置き換わる。
        // これで「同じ顔ぶれが永遠に同じ強さ」ではなく、若手台頭とベテラン引退の流れが生まれる。
        const agerng = mulberry(((s.year + 1) * 2246822519) >>> 0);
        const aged = ageWorldRosters(s.worldRosters, agerng, s.year + 1);
        advanceWorldYear(); // v38(#9 A-3): 共有ワールドも1年進める（世界が周回・両モードをまたいで年を取る）
        aged.retired.slice(0, 3).forEach(r => {
          const debut = aged.debuted.find(d => d.team === r.team);
          log.push(`【${s.year}年目 3月】🌍 世代交代：${r.team}の${r.name}（${r.age}歳）が引退。${debut ? `新星${debut.name}（${debut.age}歳）が加入した` : "後継者の台頭が待たれる"}`);
        });
        // v36(弟子深化): 弟子がこの年度替わりでOVRの節目(70/80/90)を越えたら祝いのニュースを記録
        if (s.protege) {
          const news = protegeMilestoneNews(s.protege, s.year, s.year + 1);
          if (news) log.push(`【${s.year}年目 3月】${news}`);
        }
        // v35: 強制引退を廃止。何の前触れもなく引退させられる不満を解消し、ベテランは毎年3月の
        // 契約更改で「現役続行／役割縮小／引退」を必ず自分で選べる。衰え期で戦力が落ちていれば
        // 「引退勧告」トーン、まだ戦えるなら「契約更改」トーンで提示する（判定はadviceInfo.declining）。
        const phase = growthPhase(player).tag;
        const declining = phase === "衰え期" && overall(player) < player.joinOvr;
        const retireChoice = player.age >= 33 || (player.age >= 31 && declining);
        // v17: 引退以外でキャリアが続く年は、必ずオフシーズンの過ごし方を選ばせる。
        // 人生の岐路イベントの判定はオフシーズンの選択を終えたあと（mlContinueAfterOffseason）で行う
        const finalizeYearEnd = (nextState) => {
          // v30: 世界ランキングの持ち点は年ごとに一部減衰し、翌年の（強くなった）基準で
          // 順位を引き直す。休むと順位が落ちるため、上位維持には走り続ける必要がある
          const decayedWP = Math.round((s.worldPoints || 0) * 0.72);
          // v32（キャリアグラフ）：この年の到達値を年次記録に積む（OVR・世界ランク・通算成績の推移）
          const histEntry = { year: s.year, ovr: overall(player), worldRank: s.worldRank, worldBest: s.worldRankBest, wins: s.careerWins || 0, podiums: s.careerPodiums || 0 };
          nextState = { ...nextState, worldPoints: decayedWP, worldRank: computeWorldRank(decayedWP, nextState.year), careerHistory: [...(s.careerHistory || []), histEntry] };
          const offseasonState = { ...s, screen: "mylife_offseason", pendingOffseason: nextState };
          if (retireChoice) {
            return { ...s, screen: "mylife_retire_advice", pendingAdvice: offseasonState, player, money, managerEval,
              adviceInfo: { age: player.age, ovr: overall(player), joinOvr: player.joinOvr, declining, reducedRole: !!s.flags?.reducedRole }, log };
          }
          return offseasonState;
        };
        const qualified = s.points >= CLASSES[s.classIdx].need;
        // v38: 降格を実装（従来は昇格のみで「クラスの上下」が形骸化していた）。年間ポイントが
        // クラス維持ラインを大きく下回ると1つ降格する（B1は最下位なので降格なし）。これにより
        // 昇格の価値が生まれ、上位クラスで結果を出し続けるプレッシャーが働く。
        const mlRelegateLine = Math.round(CLASSES[s.classIdx].need * 0.4);
        let classIdx = s.classIdx;
        if (qualified) classIdx = Math.min(2, s.classIdx + 1);
        else if (s.classIdx > 0 && s.points < mlRelegateLine) classIdx = s.classIdx - 1;
        if (classIdx > s.classIdx) log.push(`【${s.year}年目 3月】${CLASSES[classIdx].label}に昇格！`);
        else if (classIdx < s.classIdx) log.push(`【${s.year}年目 3月】不振により${CLASSES[classIdx].label}へ降格…雪辱を期す`);
        // v14.3: 年俸改定。その年のポイント・勝利・表彰台に応じて年俸が上がる
        const yearRaces = (player.raceLog || []).filter(e => e.year === s.year);
        const yearWins = yearRaces.filter(e => e.rank === 1).length;
        const yearPodiums = yearRaces.filter(e => e.rank <= 3).length;
        const salaryGain = Math.round(s.points * 2.2 + yearWins * 18 + yearPodiums * 7);
        const salary = s.salary + salaryGain;
        if (salaryGain > 0) log.push(`【${s.year}年目 3月】戦績が評価され年俸+${salaryGain}万円（年俸${salary}万円に）`);
        // v14: 好成績を残すと移籍オファーが来る（簡易な移籍システム）
        // v15: オファーはチーム名だけでなく、年俸倍率・契約金・エース確約の有無が
        // チームごとに異なる。残留オファーは条件を上乗せしない基準線として提示し、
        // 移籍オファーはそれより魅力的な条件を出すことで「引き抜き」らしさを出す
        // v16: オファーには移籍先チームのtier（B1/A/PRO）を持たせ、契約するとその
        // tierがそのままプレイヤーの新classIdxになる。一度の移籍で飛び級しすぎない
        // よう、現在のclassIdxから±1tierの範囲のチームだけを候補にする
        const interest = s.points / Math.max(1, CLASSES[s.classIdx].need);
        if (interest >= 0.8 && Math.random() < 0.6) {
          const others = MYLIFE_TEAMS.filter(t => t.name !== s.team);
          const nearTier = others.filter(t => Math.abs(t.tier - classIdx) <= 1);
          const pool = nearTier.length >= 2 ? nearTier : others;
          // v27: 移籍時の争奪戦。昇格ラインを大きく超える好成績（interest>=1.2）を残した年は、
          // 複数チームが競って条件を吊り上げる。オファー数が増え、年俸倍率・契約金・エース確約が
          // 通常より豪華になり、契約画面に「争奪戦」の演出が表示される
          const biddingWar = interest >= 1.2;
          const offerN = biddingWar ? Math.min(3, pool.length) : 2;
          const offerTeams = [...pool].sort(() => Math.random() - 0.5).slice(0, offerN).map(t => ({
            team: t.name,
            tier: t.tier,
            salaryMul: Math.round(((biddingWar ? 1.2 : 1.05) + Math.random() * (biddingWar ? 0.4 : 0.25)) * 100) / 100,
            bonus: Math.round((biddingWar ? 60 : 20) + Math.random() * (biddingWar ? 140 : 80)),
            aceGuarantee: Math.random() < (biddingWar ? 0.7 : 0.4),
          }));
          const stayOffer = { team: s.team, tier: mlTeamTier(s.team), salaryMul: biddingWar ? 1.1 : 1, bonus: biddingWar ? 40 : 0, aceGuarantee: false };
          return finalizeYearEnd({
            ...s, player, classIdx, points: 0, year: s.year + 1, month: 0,
            races: [mlGenRace(s.year + 1, 0, classIdx)],
            directive: mlGenDirective(s.year + 1, 0, classIdx, managerEval),
            contractOffers: [stayOffer, ...offerTeams], biddingWar,
            salary, money, managerEval, worldRosters: aged.worldRosters,
            screen: "mylife_contract", log,
          });
        }
        return finalizeYearEnd({
          ...s, player, classIdx, points: 0, year: s.year + 1, month: 0,
          races: [mlGenRace(s.year + 1, 0, classIdx)],
          directive: mlGenDirective(s.year + 1, 0, classIdx, managerEval),
          salary, money, managerEval, worldRosters: aged.worldRosters,
          screen: "mylife_main", log,
        });
      }
      const month = s.month + 1;
      // v37: 自分が出走しなかった月（練習・休養・イベント等）は、その月のレースをワールドの選手だけで
      // 軽量に決着させ、成績台帳に積む（自分が出ていないレースの成績も溜まる）。
      let riderStats = s.riderStats;
      if (mode !== "race" && s.worldRosters && Object.keys(s.worldRosters).length) {
        const worldLite = mlWorldRaceLite(s, s.year * 1000 + s.month * 17 + 3);
        riderStats = mlUpdateRiderStats(s.riderStats, worldLite, new Set(), s.year);
      }
      // v38(改善:育成の手応え): 「今月の成長」レポート。伸びた能力（丸め後で+1以上、または生の伸びが
      // 大きいもの）とOVR・活力の増減をまとめ、主画面に出す。毎月の積み上げを目に見える手応えにする。
      const growthDeltas = AB_KEYS.map(k => {
        const beforeR = Math.round(_preAb[k]); const afterR = Math.round(player[k] || 0);
        return { key: k, label: AB_LABEL[k], before: beforeR, after: afterR, raw: (player[k] || 0) - _preAb[k], up: afterR - beforeR };
      }).filter(d => d.up > 0).sort((a, b) => b.up - a.up || b.raw - a.raw);
      const subDeltas = [];
      { const a = Math.round(player.accel || 0) - Math.round(_preSub.accel); if (a > 0) subDeltas.push({ label: "加速力", up: a }); }
      { const m = Math.round(player.mental || 0) - Math.round(_preSub.mental); if (m > 0) subDeltas.push({ label: "メンタル", up: m }); }
      const ovrAfter = overall(player);
      // OVRが10の節目（60/70/80/90…）を越えたら祝う＝成長のピークを演出
      const ovrMilestone = (ovrAfter >= 50 && Math.floor(ovrAfter / 10) > Math.floor(_preOvr / 10)) ? Math.floor(ovrAfter / 10) * 10 : null;
      if (ovrMilestone) log.push(`【${s.year}年目 ${MONTHS[s.month]}】📈 総合力（OVR）が${ovrMilestone}に到達した！`);
      const growthReport = {
        mode, deltas: growthDeltas, subDeltas, ovrMilestone,
        ovrBefore: _preOvr, ovrAfter, ovrUp: ovrAfter - _preOvr,
        vitBefore: Math.round(_preVit), vitAfter: Math.round(player.vitality == null ? 100 : player.vitality),
        month: s.month, year: s.year,
      };
      const base = {
        ...s, player, month, races: [mlGenRace(s.year, month, s.classIdx)],
        directive: mlGenDirective(s.year, month, s.classIdx, managerEval),
        money, managerEval, riderStats, growthReport,
        screen: "mylife_main", log,
      };
      // v36(弟子深化): 弟子がいる間は、毎月ごく稀に指導イベントが発生する。関わり方で
      // 弟子の伸びや個性が変わり、"年1回数字が変わるだけ"だった弟子育成に手触りを与える。
      if (s.protege && Math.random() < 0.2) {
        const ev = ML_PROTEGE_EVENTS[Math.floor(Math.random() * ML_PROTEGE_EVENTS.length)];
        return { ...base, pendingProtegeEvent: ev, screen: "mylife_protege_event" };
      }
      return base;
    });
  }
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
  function mlRetireAdviceAccept() {
    setMl(s => {
      const retiredState = { ...s, pendingAdvice: null, adviceInfo: null };
      mlRecordLegend(retiredState);
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
  function mlBuyPart(pid) {
    setMl(s => {
      const p = PARTS[pid];
      if (!p || s.money < p.price || p.tier > s.classIdx + 1) return s;
      return { ...s, money: s.money - p.price, partsInv: { ...s.partsInv, [pid]: (s.partsInv[pid] || 0) + 1 } };
    });
  }
  function mlSetPart(slot, pid) {
    setMl(s => ({ ...s, player: { ...s.player, parts: { ...s.player.parts, [slot]: pid || null } } }));
  }
  function mlBuyGear(k) {
    setMl(s => {
      const it = ML_GEAR[k];
      if (!it || s.gear[k] || s.money < it.price) return s;
      return { ...s, money: s.money - it.price, gear: { ...s.gear, [k]: true } };
    });
  }
  function mlBuyStock(k) {
    setMl(s => {
      const it = ML_STOCK_ITEMS[k];
      if (!it || s.money < it.price) return s;
      return { ...s, money: s.money - it.price, stock: { ...s.stock, [k]: (s.stock[k] || 0) + 1 } };
    });
  }
  function mlUseStock(k) {
    setMl(s => {
      if ((s.stock[k] || 0) <= 0) return s;
      const it = ML_STOCK_ITEMS[k];
      const player = { ...s.player };
      if (it.fatigueDelta) player.fatigue = Math.max(0, Math.min(100, player.fatigue + it.fatigueDelta));
      if (it.formDelta) player.form = Math.max(0, Math.min(100, (player.form ?? 50) + it.formDelta));
      // v15フェーズ2: 成長力・成長タイプを1段階アップさせる消耗品
      if (it.growthPowUp) {
        const idx = GROWTHPOW_ORDER.indexOf(player.growthPow);
        if (idx >= 0 && idx < GROWTHPOW_ORDER.length - 1) player.growthPow = GROWTHPOW_ORDER[idx + 1];
      }
      if (it.growthShiftUp) {
        const idx = GROWTH_ORDER.indexOf(player.growth);
        if (idx >= 0 && idx < GROWTH_ORDER.length - 1) player.growth = GROWTH_ORDER[idx + 1];
      }
      return { ...s, player, stock: { ...s.stock, [k]: s.stock[k] - 1 } };
    });
  }
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
  // v27: 私設強化合宿。潤沢な資金を注ぎ込んで狙った能力（focus）を一気に引き上げる、
  // 繰り返し利用できる資金の使い道。成長キャップは通常の練習と共通なので、伸びしろが
  // 尽きた選手には効きにくい。疲労も溜まるので連打は難しい
  function mlPrivateCamp() {
    setMl(s => {
      const cost = mlPrivateCampCost(s);
      if (s.money < cost) return s;
      const growthCap = mlGrowthCap(s.year, s.player);
      const player = { ...s.player };
      const before = player[player.focus];
      addAb(player, player.focus, 6, growthCap);
      AB_KEYS.filter(k => k !== player.focus).forEach(k => addAb(player, k, 2, growthCap));
      player.fatigue = Math.min(100, player.fatigue + 12);
      const gained = Math.round((player[player.focus] - before) * 10) / 10;
      return {
        ...s, player, money: s.money - cost,
        log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】私設強化合宿を実施（-${cost}万円）。${AB_LABEL[player.focus]}を中心に鍛え上げた（${AB_LABEL[player.focus]}+${gained}）`],
      };
    });
  }
  function mlBuyCar() {
    setMl(s => {
      const next = s.carLv + 1;
      if (next >= ML_CARS.length || s.money < ML_CARS[next].price) return s;
      return { ...s, money: s.money - ML_CARS[next].price, carLv: next };
    });
  }
  function mlBuyHouse() {
    setMl(s => {
      const next = s.houseLv + 1;
      if (next >= ML_HOUSES.length || s.money < ML_HOUSES[next].price) return s;
      return { ...s, money: s.money - ML_HOUSES[next].price, houseLv: next };
    });
  }

  // ---- 購入・装備・アイテム ----
  const buyItem = (k) => { if (g.budget < ITEMS[k].price) return; setG(s => ({ ...s, budget: s.budget - ITEMS[k].price, inv: { ...s.inv, [k]: s.inv[k] + 1 } })); };
  const buyPart = (pid) => {
    if (g.budget < PARTS[pid].price || PARTS[pid].tier > g.classIdx + 1) return;
    setG(s => ({ ...s, budget: s.budget - PARTS[pid].price, partsInv: { ...s.partsInv, [pid]: (s.partsInv[pid] || 0) + 1 } }));
  };
  const setPart = (rid, slot, pid) => { setG(s => ({ ...s, roster: s.roster.map(r => r.id === rid ? { ...r, parts: { ...r.parts, [slot]: pid || null } } : r) })); };
  const buyEquip = (k) => {
    const lv = g.equip[k];
    if (lv >= equipMax || g.budget < EQUIP_COST[lv]) return;
    setG(s => ({ ...s, budget: s.budget - EQUIP_COST[lv], equip: { ...s.equip, [k]: lv + 1 } }));
  };
  // v11: スタッフは買い切りではなく月給制。レベルを上げると翌月から月給が増える（即時の費用はない）
  const hireStaff = (k) => {
    const lv = g.staff[k] || 0;
    if (lv >= staffMax) return;
    setG(s => ({ ...s, staff: { ...s.staff, [k]: (s.staff[k] || 0) + 1 } }));
  };
  // v27: 引退選手のスタッフ登用。殿堂入りOBを月給制で専属コーチに迎える（1名まで）
  const hireObCoach = (hof) => {
    setG(s => ({
      ...s,
      obCoach: { id: hof.id, name: hof.name, type: hof.type, ab: TYPE_COACH_ABILITY[hof.type] || "flat" },
      log: [...s.log, `【${MONTHS[s.month]}】${hof.name}をOBコーチに迎えた（${AB_LABEL[TYPE_COACH_ABILITY[hof.type] || "flat"]}の練習効果+25%／月給-${OB_COACH_SALARY}万）`],
    }));
  };
  const dismissObCoach = () => {
    setG(s => ({ ...s, obCoach: null, log: [...s.log, `【${MONTHS[s.month]}】OBコーチとの契約を解消した`] }));
  };
  const signScout = (sc) => {
    if (g.budget < sc.price || g.roster.length >= rosterMax) return;
    setG(s => ({
      ...s, budget: s.budget - sc.price, roster: [...s.roster, { ...sc.rider }],
      scouts: s.scouts.filter(x => x.rider.id !== sc.rider.id),
      log: [...s.log, `【${MONTHS[s.month]}】${sc.rider.name} が入団（${sc.tag}）— 真の能力が判明！`],
    }));
  };
  // v11: FA移籍市場。即決購入方式（新人スカウトと異なり能力は伏せず即座に表示）
  const signFa = (fa) => {
    if (g.budget < fa.price || g.roster.length >= rosterMax) return;
    setG(s => ({
      ...s, budget: s.budget - fa.price, roster: [...s.roster, { ...fa.rider }],
      faMarket: s.faMarket.filter(x => x.rider.id !== fa.rider.id),
      log: [...s.log, `【${MONTHS[s.month]}】${fa.rider.name}（${fa.age}歳）がFA移籍で入団`],
    }));
  };
  const useSupp = (rid) => { if (g.inv.supp <= 0) return; setG(s => ({ ...s, inv: { ...s.inv, supp: s.inv.supp - 1 }, roster: s.roster.map(r => r.id === rid ? { ...r, fatigue: Math.max(0, r.fatigue - 40) } : r) })); };
  const useTune = (rid) => { if (g.inv.tune <= 0) return; setG(s => ({ ...s, inv: { ...s.inv, tune: s.inv.tune - 1 }, roster: s.roster.map(r => r.id === rid ? { ...r, cond: Math.min(5, r.cond + 2) } : r) })); };
  const setFocus = (rid, focus) => setG(s => ({ ...s, roster: s.roster.map(r => r.id === rid ? { ...r, focus } : r) }));
  const useCamp = () => {
    if (g.inv.camp <= 0 || g.camp) return;
    // v22: クールダウンによる利用間隔の制限では「空けばすぐ使う」が最適解になり続けて
    // 「毎月使うのが前提」という印象は変わらなかったため、タイマーではなく実質的な負荷で
    // ブレーキをかける方式に変更。キャンプは全員の疲労を大きく消耗させる（+25）ため、
    // 連発するとレース前に疲労90超＝故障リスクゾーンへ突入しやすくなる。「今は無理をしても
    // いい月か」をプレイヤー自身が毎回判断する、意味のある選択にする
    setG(s => ({
      ...s, camp: true, inv: { ...s.inv, camp: s.inv.camp - 1 },
      roster: s.roster.map(r => ({ ...r, fatigue: Math.min(100, r.fatigue + 25) })),
    }));
  };
  // v13.1: お気に入り登録した選手は、殿堂入り条件（実績）を満たしていなくても必ず記録に残る
  const toggleFavorite = (rid) => {
    setG(s => ({ ...s, roster: s.roster.map(r => r.id === rid ? { ...r, favorite: !r.favorite } : r) }));
  };
  // v17: キャプテン制度。同じ選手をもう一度指名すると解任になる（1名まで）
  const setCaptain = (rid) => {
    setG(s => ({ ...s, captainId: s.captainId === rid ? null : rid }));
  };
  const releaseRider = (rid) => {
    if (g.month !== 0) return;
    setG(s => {
      if (s.roster.length <= 1) return s;
      const r = s.roster.find(x => x.id === rid);
      if (!r) return s;
      const roster = s.roster.filter(x => x.id !== rid);
      const captainId = s.captainId === rid ? null : s.captainId;
      // v13.1: 能力・将来性次第でライバルチームに拾われる。拾われた場合は殿堂入りさせず
      // rivalAlumniで追跡し、そのチームで出走を続けさせる（いずれ引退した時点で改めて判定）
      const pickedUp = Math.random() < computePickupChance(r);
      if (pickedUp) {
        const signedTeam = RIVAL_TEAMS[Math.floor(Math.random() * RIVAL_TEAMS.length)].name;
        const rivalAlumni = [...s.rivalAlumni, { ...r, signedTeam, signedYear: s.year }];
        return {
          ...s, roster, rivalAlumni, captainId,
          log: [...s.log, `【${MONTHS[s.month]}】${r.name} を解雇 → ${signedTeam}が獲得したとの噂`],
        };
      }
      // v13.1: 殿堂入りは一定の実績かお気に入り登録がある選手のみ（無条件だとキリがない）
      const hallOfFame = isHallOfFameWorthy(r)
        ? [...s.hallOfFame, { ...r, farewellYear: s.year, farewellReason: "released" }]
        : s.hallOfFame;
      return { ...s, roster, hallOfFame, captainId, log: [...s.log, `【${MONTHS[s.month]}】${r.name} を解雇した`] };
    });
  };
  // v25: ユース育成枠。4月のスカウト候補とは別に、年1回だけ安価な契約金で
  // 16〜17歳の若手を確保できる。現在の能力は低いが成長力（growthPow）はA以上を保証し、
  // 長期育成前提の「原石」枠として機能させる
  const signYouthProspect = () => {
    setG(s => {
      if (s.youthUsed || s.budget < 15) return s;
      const rng = mulberry(Date.now() % 999983 + s.roster.length * 4111);
      const banned = new Set(s.roster.map(r => r.name));
      const growthPow = rng() < 0.4 ? "S" : "A";
      const rookie = newRider(34, rng, { banned, age: 16 + Math.floor(rng() * 2), growthPow });
      return {
        ...s, roster: [...s.roster, rookie], budget: s.budget - 15, youthUsed: true,
        log: [...s.log, `【${MONTHS[s.month]}】ユース育成枠で${rookie.name}（${rookie.age}歳・成長力${growthPow}）を確保した`],
      };
    });
  };
  // v31.1: 血統ユース（配合）。マイライフ殿堂の2名を親に選び、配合の原石をユース枠で確保する。
  // 通常ユース（15万）より高価（40万）だが、相性・血の濃さ・累代+値・金特クロスの恩恵が乗る
  const signBredYouth = (legA, legB) => {
    setG(s => {
      if (s.youthUsed || s.budget < 40 || s.roster.length >= ROSTER_MAX_BY_CLASS[s.classIdx] || !legA || !legB) return s;
      const rng = mulberry(Date.now() % 999983 + s.roster.length * 7333);
      const banned = new Set(s.roster.map(r => r.name));
      const growthPow = rng() < 0.5 ? "S" : "A";
      const rookie = newRider(34, rng, { banned, age: 16 + Math.floor(rng() * 2), growthPow, type: legA.type });
      const breed = mlBreedBonus(legA, legB);
      AB_KEYS.forEach(k => { if (breed.abBonus[k]) rookie[k] = Math.min(96, (rookie[k] || 0) + breed.abBonus[k]); });
      SUB_STAT_KEYS.forEach(k => { if (breed.subBonus[k]) rookie[k] = Math.max(20, Math.min(95, (rookie[k] ?? 50) + breed.subBonus[k])); });
      let abils = [...(breed.goldInherit || []), ...(breed.exclusive || []), ...(rookie.abilities || [])];
      breed.extraAbilities.forEach(id => { if (id && ABILITIES[id] && !abils.includes(id)) abils.push(id); });
      abils = abils.filter((id, i) => abils.indexOf(id) === i);
      rookie.abilities = abils.slice(0, 5);
      if (breed.goldInherit && breed.goldInherit.length) { rookie.goldAbilities = [...(rookie.goldAbilities || [])]; breed.goldInherit.forEach(id => { if (rookie.abilities.includes(id) && !rookie.goldAbilities.includes(id)) rookie.goldAbilities.push(id); }); }
      // v33: 爆発力は伸びしろへ。ユースは元々成長力A/S＋才能キャップで大器化する
      if (breed.growthSteps) rookie.growthPow = bumpGrowthPow(rookie.growthPow, breed.growthSteps);
      else if (breed.growthBump) rookie.growthPow = bumpGrowthPow(rookie.growthPow, 1);
      rookie.talentCap = breed.talentCap || 0;
      rookie.bakuhatsu = breed.bakuhatsu || 0;
      rookie.matingGrade = breed.matingGrade || "D";
      // v33.4: 特殊配合。唯一無二の名血を確定発現
      let specialNote = "";
      if (breed.special) {
        const sm = breed.special;
        rookie.specialMating = { key: sm.key, title: sm.title, color: sm.color };
        rookie.talentCap = (rookie.talentCap || 0) + (sm.talent || 0);
        if (sm.growth) rookie.growthPow = bumpGrowthPow(rookie.growthPow, sm.growth);
        const goldId = sm.gold || (sm.factorGold ? ({ climb: "mount", sprint: "finisher", flat: "flatlander", solo: "soloist" }[legA.focus] || "engine") : null);
        if (sm.extra && ABILITIES[sm.extra] && !rookie.abilities.includes(sm.extra) && rookie.abilities.length < 6) rookie.abilities = [...rookie.abilities, sm.extra];
        if (goldId && ABILITIES[goldId]) {
          if (!rookie.abilities.includes(goldId) && rookie.abilities.length < 6) rookie.abilities = [...rookie.abilities, goldId];
          if (rookie.abilities.includes(goldId)) { rookie.goldAbilities = [...(rookie.goldAbilities || [])]; if (!rookie.goldAbilities.includes(goldId)) rookie.goldAbilities.push(goldId); }
        }
        specialNote = `・🌟${sm.title}`;
      }
      // v33.2: 危険度。濃い血の代償で稀にガラスの体を持って生まれる（頑丈を継いでいれば発症しない）
      rookie.matingDanger = breed.danger || 0;
      let fragileNote = "";
      if (breed.danger > 0 && !rookie.abilities.includes("tough") && !rookie.abilities.includes("glass") && rng() * 100 < breed.danger) {
        rookie.abilities = [...rookie.abilities, "glass"];
        rookie.fragileBorn = true;
        fragileNote = "・⚠️ガラスの体";
      }
      // v33.3: 系統確立ボーナス。名門系統を継ぐユースは因子（伸びしろ＋系統特能）を受け取る
      rookie.lineageName = legA.lineageName || `${legA.name}系`;
      let lineNote = "";
      const yblb = mlBloodlineBonus(rookie.lineageName);
      if (yblb) {
        rookie.bloodlineTier = yblb.tier;
        rookie.talentCap = (rookie.talentCap || 0) + yblb.talentCap;
        if (yblb.growthSteps) rookie.growthPow = bumpGrowthPow(rookie.growthPow, yblb.growthSteps);
        if (yblb.factor && ABILITIES[yblb.factor]) {
          if (!rookie.abilities.includes(yblb.factor) && rookie.abilities.length < 5) rookie.abilities = [...rookie.abilities, yblb.factor];
          if (yblb.factorGold && rookie.abilities.includes(yblb.factor)) { rookie.goldAbilities = [...(rookie.goldAbilities || [])]; if (!rookie.goldAbilities.includes(yblb.factor)) rookie.goldAbilities.push(yblb.factor); }
        }
        lineNote = `・🏛${yblb.label}`;
      }
      const goldNote = (breed.goldInherit && breed.goldInherit.length) ? `・✨金特クロス` : "";
      return {
        ...s, roster: [...s.roster, rookie], budget: s.budget - 40, youthUsed: true,
        log: [...s.log, `【${MONTHS[s.month]}】🧬 血統ユース：${legA.name}×${legB.name}の配合で${rookie.name}（${rookie.age}歳・成長力${rookie.growthPow}）を確保（${breed.nick.rank} ${breed.nick.label}${goldNote}${fragileNote}${lineNote}${specialNote}）`],
      };
    });
    setBreedYouthSel(null);
  };
  // v17: 選手間トレード。受け入れると自チームの該当選手が抜け、相手が提示した選手が加入する
  const acceptTrade = (offerId) => {
    setG(s => {
      const offer = (s.tradeOffers || []).find(o => o.id === offerId);
      if (!offer) return s;
      const outgoing = s.roster.find(r => r.id === offer.wantRiderId);
      if (!outgoing) return s;
      const incoming = { ...offer.offeredRider, id: ridState.value++, tenure: 0, favorite: false, raceLog: [] };
      const roster = s.roster.filter(r => r.id !== offer.wantRiderId).concat(incoming);
      const captainId = s.captainId === offer.wantRiderId ? null : s.captainId;
      return {
        ...s, roster, captainId,
        tradeOffers: s.tradeOffers.filter(o => o.id !== offerId),
        log: [...s.log, `【${MONTHS[s.month]}】${offer.team}と選手交換トレード成立：${outgoing.name} → ${incoming.name}が加入`],
      };
    });
  };
  const declineTrade = (offerId) => {
    setG(s => ({ ...s, tradeOffers: (s.tradeOffers || []).filter(o => o.id !== offerId) }));
  };

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
