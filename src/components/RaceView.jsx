// レース演出（RaceView）＋エラーバウンダリ。Phase 3で分離、第14弾Dでさらに5ファイルへ分割
// （判断カードのデータ組み立て→domain/shared/raceDecisions.js、simデータ読み取りヘルパー→
// domain/shared/raceViewModel.js、カメラ・隊列の定数群→components/race/raceViewConstants.js、
// 最終直線の演出→components/race/FinalSprintCinematic.jsx。本体はRaceView・RaceErrorBoundaryのみ）。
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FINISH_COMMENTARY, SEG_COMMENTARY } from "../data/course.js";
import { FONT_DOT, T } from "../data/theme.js";
import { ChipRow, PrimaryBtn, QuietBtn } from "./kit.jsx";
import { DecisionCard } from "./DecisionCard.jsx";
import { fmtGap, fmtTime, hasAbility, strHash } from "../core/core.js";
import { TICK_SEC, riderHash01, resumeSim } from "../sim/race.js";
import { smoothRaceCamera } from "../domain/shared/raceCamera.js";
import { viewWander } from "../domain/shared/viewHash.js";
import { buildDecisions, composeCard } from "../domain/shared/raceDecisions.js";
import { groupAt, interpFrac, modeAt, modeStreakAt, nextPullerAt, slotAt, tagAt } from "../domain/shared/raceViewModel.js";
import {
  ATTACK_EXAGGERATION, ATTACK_VISUAL_TICKS, CINEMATIC_TIME_RATIO, DROP_EXTRA_DX_RATIO, DROP_EXTRA_LANE,
  DROP_TRANSITION_TICKS, ELONGATION_BY_SEG, FINAL_SEG_TIME_RATIO, LAUNCH_TIME_RATIO, LEAD_GROUP_FRAC,
  MAP_BLEED, MAP_PAD, MAP_W, MAX_VIEW_FRAC, MIN_VIEW_FRAC, PACK_BIAS_EASE, PACK_ELONG_EASE, PACK_LEN_BASE,
  PACK_LEN_PER_MEMBER, PACK_MAX_MEMBERS_FOR_SCALE, PACK_TILT_MAX_RAD, PACK_WANDER_FREQ_X, PACK_WANDER_FREQ_Y,
  PACK_WIDTH_BASE, PACK_WIDTH_PER_MEMBER, SIDE_H, SPRINT_CONTENDER_GAP_SEC, SPRINT_MAX_CONTENDERS,
  SPRINT_MIN_VIEW_FRAC, TOP_H, VIEW_LEAD_BIAS, buildSidePath, buildTopPath, mapX,
} from "./race/raceViewConstants.js";
import { FinalSprintCinematic, RiderNameTag, mapTagKind, riderTagIcon } from "./race/FinalSprintCinematic.jsx";

export class RaceErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { crashed: false }; }
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(err) {
    // 自動復帰：次のティックで結果画面へ進める（描画中のsetState連鎖を避けて遅延実行）
    if (this.props.onRecover) setTimeout(() => { try { this.props.onRecover(); } catch (e) {} }, 400);
  }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ display: "grid", gap: 12, padding: 16, background: T.color.surface, borderRadius: 12, border: `1px solid ${T.color.rule}` }}>
          <div style={{ fontFamily: FONT_DOT, fontSize: 15, color: T.color.accent, fontWeight: 700 }}>レースは終了しました</div>
          <div style={{ fontSize: 12.5, color: T.color.sub, lineHeight: 1.6 }}>
            レース中継の描画で問題が発生しましたが、着順・記録はすでに確定しています。
            そのまま結果画面へお進みください（進行への影響はありません）。
          </div>
          <PrimaryBtn onClick={this.props.onRecover}>結果を見る →</PrimaryBtn>
        </div>
      );
    }
    return this.props.children;
  }
}

// v38(改善#1): 観戦の再生速度をレースをまたいで記憶する（毎回×1にリセットされる退屈を解消）。
// モジュールレベルの変数なのでRaceViewの再マウント（次のレース）でも保持される。
let lastRaceSpeed = 1;
export function RaceView({ sim, onFinish }) {
  // v37: マイライフは自チーム選手も team==="PLAYER" に統一したため、「操作アバター＝あなた本人」は
  // isPlayerChar で判定する（シーズンは単一アバターが無いので従来どおり team==="PLAYER"＝自チーム）。
  const hasAvatar = sim.entrants.some(e => e.isPlayerChar);
  const isAvatar = (e) => hasAvatar ? !!e.isPlayerChar : (e.team === "PLAYER");
  const [hud, setHud] = useState({ top: [], seg: "", clock: 0, done: false, comment: "", gap: null });
  const [ridersUi, setRidersUi] = useState([]);
  const [cam, setCam] = useState({ start: 0, end: MIN_VIEW_FRAC });
  const camSmoothRef = useRef(null); // v39.7: 俯瞰カメラのズーム/パンを毎フレーム補間して滑らかにする
  const [camMode, setCamMode] = useState("lead"); // v11: "lead" または自チーム選手id（選手フィーチャー）
  const camModeRef = useRef("lead");
  // v12: 無線指示（追走強化/静観/エース早期発射）は出走前の「作戦」選択に一本化し廃止。
  // 観戦画面はカメラ操作のみの純粋な観戦専用画面になった
  const [finalSeg, setFinalSeg] = useState(false); // 最終区間突入フラグ（カメラの超ズーム・スロー演出のトリガー）
  const [cinematic, setCinematic] = useState(null); // v12: 最終直線シネマティック演出のスナップショット（一度だけ計算）
  const speedRef = useRef(lastRaceSpeed);
  const [speedUi, setSpeedUi] = useState(lastRaceSpeed);
  const skipRef = useRef(false);
  const tickRef = useRef(null);
  const rtRef = useRef(0);
  const totalRef = useRef(1);
  const finalSegRef = useRef(false);
  const cinematicRef = useRef(false);
  const cameraFramingRef = useRef(null); // v14.13: 直近のカメラ枠決めで実際に映していた選手集団（シネマティックの対象選手選定に再利用）
  const [launching, setLaunching] = useState(false); // v12（簡易リードアウト演出）：エース発射の光るリング表示フラグ
  const launchingRef = useRef(false);
  const liveRef = useRef({ text: "", until: 0 });
  // v39.3(演出): ドラマの山場(beat)＝一時的にスロー＋当該選手へズームして「決定的瞬間」を強調する。
  // until までの間 slow を clock 進行に掛け、focusId があればカメラをその選手の集団へ寄せる。
  const beatRef = useRef({ until: 0, slow: 1, focusId: null });
  const flammeRef = useRef(false); // 「残り1km（フラムルージュ）」の一度きり演出フラグ
  const PLAY_DUR = 56;  // v39.11: 展開（先頭交代・逃げ・判断の効果）を見やすくするため再生を長めに
  const course = sim.course;
  // v39.3(演出): 実況ラインのバリエーション。区間・展開ごとに複数から決定的/準ランダムに選ぶ。
  const flammeFrac = (course.cumFrac && course.finalIdx > 0) ? Math.max(0.5, course.cumFrac[course.finalIdx - 1] - 0.045) : 0.9;

  // v39(A案): レース中の判断カード。注目選手（マイライフ＝本人／シーズン＝エース）の展開に
  // 割り込んで再生を止め、選択を結果へ反映する。paused中はclockを進めず、選択後に resumeSim で
  // fromTick以降を作り直してから再生を継続する（rtが飛ばないよう clock を張り直す）。
  const focusEnt = useMemo(() =>
    sim.entrants.find(e => e.isPlayerChar)
    || sim.entrants.find(e => e.team === "PLAYER" && e.isAce)
    || sim.entrants.find(e => e.team === "PLAYER"), [sim]);
  const decisions = useMemo(() => buildDecisions(course, focusEnt, !hasAvatar), [sim]);
  const [decision, setDecision] = useState(null);
  const decisionRef = useRef(null);
  const pausedRef = useRef(false);
  const clockRef = useRef(0);
  const firedRef = useRef(new Set());
  const [resimBusy, setResimBusy] = useState(false);

  const resolveDecision = (moveId) => {
    const d = decisionRef.current;
    if (!d) return;
    setResimBusy(true);
    // 再計算はやや重いので、カードのボタン押下→UI反映を挟んでから実行する
    setTimeout(() => {
      resumeSim(sim, d.fromTick, focusEnt.id, moveId);
      totalRef.current = Math.max(...sim.entrants.map(e => e.finishTime), 1);
      const rtNow = d.fromTick * TICK_SEC;
      clockRef.current = Math.min(PLAY_DUR, (rtNow / totalRef.current) * PLAY_DUR);
      const chosen = d.choices.find(c => c.move === moveId);
      const who = focusEnt ? focusEnt.name.split(" ")[0] : "";
      const nowP = performance.now();
      // v39.3(演出): 選択に応じた実況＋「山場」演出。攻めの一手はスロー＆当該選手ズームで見せ場に。
      const AGGR = { attack: `${who}、ここで仕掛けた！単独で飛び出す！`, send: `${who}、勝負を賭けた！一気に踏み込む！` };
      const CALM = {
        tempo: `${who}がペースを上げた！集団を絞り込みにかかる`,
        conserve: `${who}は脚を溜める。勝負所に賭ける構えだ`,
        hangOn: `${who}、歯を食いしばって食らいつく！`,
        kick: `${who}はギリギリまで待つ。差しにかける狙いだ`,
        kickBig: `${who}、会心の差し脚を狙う！`,
        sprintWait: `${who}は番手をキープ。ゴールスプリントに懸ける`,
        assistLaunch: `${who}がエースを勝負所へ運ぶ！`,
        hold: `${who}は無理をせず展開に乗る`,
      };
      const line = AGGR[moveId] || CALM[moveId] || `${who}の判断：「${chosen ? chosen.label : "—"}」`;
      liveRef.current = { text: line, until: nowP + 3400 };
      if (moveId === "attack" || moveId === "send") {
        beatRef.current = { until: nowP + 3200, slow: 0.30, focusId: focusEnt ? focusEnt.id : null };
      }
      decisionRef.current = null;
      setDecision(null);
      setResimBusy(false);
      pausedRef.current = false;
      if (tickRef.current) tickRef.current();
    }, 30);
  };

  // v11: カメラの選手フィーチャー切替（自チーム選手のみ対象、結果ロック後も切替は常に可能）
  const playerRoster = useMemo(() => sim.entrants.filter(e => e.team === "PLAYER"), [sim]);
  // v39.12(俯瞰マップ強化): コース上の見どころ標識（KOM＝登坂/山岳の頂上、中間スプリント）と、
  // 沿道の距離ポスト（10%刻み）。fracで固定されカメラに合わせて流れる（＝沿道スクロールの疾走感）。
  const courseMarkers = useMemo(() => {
    const m = [];
    const last = course.segs.length - 1;
    course.segs.forEach((s, j) => {
      const endFrac = course.cumFrac[j];
      if ((s.type === "climb" || s.type === "mtn") && j < last) m.push({ frac: endFrac, label: "KOM", color: "#e0824f" });
      else if (s.type === "sprint" && j < last) m.push({ frac: endFrac, label: "中間", color: "#4fb0e0" });
    });
    return m;
  }, [sim]);
  const distPosts = useMemo(() => Array.from({ length: 9 }, (_, i) => (i + 1) / 10), [sim]);
  const selectCam = (mode) => {
    if (mode === camMode) return;
    camModeRef.current = mode;
    setCamMode(mode);
  };

  const { path: topPath, yAt: topRoadYAt } = useMemo(() => buildTopPath(course, cam.start, cam.end), [sim, cam.start, cam.end]);
  const sidePath = useMemo(() => buildSidePath(course, cam.start, cam.end), [sim, cam.start, cam.end]);
  // v14.9: 選手を道のカーブに軽く追従させ、道が曲がっているのに選手が直線的に
  // 横切って見える違和感を緩和する。1.0にすると道の曲がりに完全一致するが、
  // それだと以前（v11以前）の「選手が斜めに動いて不自然」という問題が再発するため、
  // 控えめな追従量に留める
  const RIDER_CURVE_FOLLOW = 0.4;
  const riderTopY = (frac, dy) => TOP_H / 2 + (topRoadYAt(frac) - TOP_H / 2) * RIDER_CURVE_FOLLOW + dy;
  // v12: フィニッシュフラグは道の曲がりとは独立に、常に固定の水平帯（TOP_H/2）上に描く
  const sideYAt = (f) => { const maxElev = Math.max(1, ...course.elevationProfile.map(p => p.elev)); return SIDE_H - 16 - (course.yAt(f) / maxElev) * (SIDE_H - 32); };

  // v12: 集団の隊列シェイプを毎レンダー計算する。各選手は共有の軌道をなぞるのではなく、
  // 選手ごとに周波数・位相が異なる独立した揺らぎで集団の中を漂う（他の選手と同期しない）。
  // 前後のだいたいの位置取り（誰が前寄りか）だけはslotから緩やかに追従するbiasXに従う
  const packTSec = performance.now() / 1000;
  const packGroupSize = {};
  ridersUi.forEach(r => { packGroupSize[r.gid] = (packGroupSize[r.gid] || 0) + 1; });
  const packShape = {};
  ridersUi.forEach(r => {
    const n = packGroupSize[r.gid] || 1;
    const dropRatio = r.dropStreak > 0 ? Math.min(1, r.dropStreak / DROP_TRANSITION_TICKS) : 0;
    if (n <= 1 || r.mode === "attack" || r.frac >= 1) { packShape[r.id] = { dx: 0, dy: 0 }; return; }
    // v12バグ修正: 区間タイプから生で計算するのではなく、tickループ側で毎フレーム緩やかに
    // 追従させたr.elong/r.tiltを使う（山岳突入などの瞬間にワープしないようにするため）
    const elong = r.elong ?? ELONGATION_BY_SEG.flat;
    const tilt = r.tilt ?? 0;
    const span = cam.end - cam.start;
    const nCap = Math.min(n, PACK_MAX_MEMBERS_FOR_SCALE);
    const L = (PACK_LEN_BASE + nCap * PACK_LEN_PER_MEMBER) * (1 + elong * 2.2) * span;
    const W = (PACK_WIDTH_BASE + nCap * PACK_WIDTH_PER_MEMBER) * (1 - elong * 0.5);
    // 選手固有の独立した揺らぎ（前後・左右とも他の選手とは違う周波数・位相）。
    // v46(#32修正): riderWander（sim側riderHash01ベース）は演出に使うと「楕円軌道」状の
    // 規則的なジッターに見えるため、演出専用のviewWander（viewHash01ベース）に差し替え。
    const wanderX = viewWander(r.id, 1, packTSec, PACK_WANDER_FREQ_X);
    const wanderY = viewWander(r.id, 5, packTSec, PACK_WANDER_FREQ_Y);
    const ex = L * Math.max(-1, Math.min(1, r.biasX * 0.55 + wanderX * 0.6));
    const ey = W * wanderY;
    // v12バグ修正: exはコース位置（frac）単位、eyは画面ピクセル単位で、そのままではスケールが
    // 全く異なる（exは0.03前後、eyは数〜十数px）。横風のtilt回転で両者を直接混ぜると、
    // dx（frac単位のまま後でmapXにより数百px/fracに再拡大される）にピクセル単位の値が
    // 漏れ込み、画面外まで吹き飛ぶ選手が出るバグになっていた。回転はピクセル単位に揃えてから行い、
    // 結果のx成分だけをfrac単位に戻す
    const pxPerFrac = (MAP_W - MAP_PAD * 2) / Math.max(span, 1e-4);
    const exPx = ex * pxPerFrac;
    let dxPx = exPx * Math.cos(tilt) - ey * Math.sin(tilt);
    let dy = exPx * Math.sin(tilt) + ey * Math.cos(tilt);
    let dx = dxPx / pxPerFrac;
    // 千切れかけの選手は揺らぎを徐々にフェードアウトしつつ後方へドリフトし、単独走に見せる
    dx = dx * (1 - dropRatio) - dropRatio * DROP_EXTRA_DX_RATIO * span;
    dy = dy * (1 - dropRatio) + dropRatio * DROP_EXTRA_LANE;
    packShape[r.id] = { dx, dy };
  });
  // v12: 俯瞰マップ上の実際の画面座標（簡易リードアウト演出の牽引線描画に使う）
  const packPoint = (r) => {
    const { dx, dy } = packShape[r.id] || { dx: 0, dy: 0 };
    const attackBonus = r.attackStreak > 0 ? (1 - r.attackStreak / ATTACK_VISUAL_TICKS) * ATTACK_EXAGGERATION : 0;
    const drawFrac = Math.min(1, r.frac + attackBonus);
    return { x: mapX(drawFrac + dx, cam.start, cam.end), y: riderTopY(drawFrac + dx, dy) };
  };
  // v12（簡易リードアウト演出）：自チームのエースを、同じ集団内で牽引中の自チームアシストが
  // いれば「牽引中」として線で結び、牽引が外れた瞬間（エースがdraft以外になった瞬間）に
  // 最終区間内であれば「発射」の光るリングを出す。実データ（finishTime等）には無関係の
  // 見た目専用演出
  const playerAce = ridersUi.find(r => r.isPlayer && r.isAce);
  const playerLeadout = playerAce && playerAce.mode === "draft"
    ? ridersUi.find(r => r.isPlayer && !r.isAce && r.mode === "pull" && r.gid === playerAce.gid)
    : null;
  // v37: 観戦マップの名前ラベル対象＝先頭3名＋自分／自チーム／ライバル（識別できる面々）。
  // 混雑を避けて数名に絞る。姓（名前の先頭トークン）だけ表示する。
  const labelIds = (() => {
    const set = new Set();
    [...ridersUi].sort((a, b) => b.frac - a.frac).slice(0, 3).forEach(r => set.add(r.id));
    ridersUi.forEach(r => { if (r.isPlayer || r.isRival || r.isLegend || (r.isMyTeam && r.isAce)) set.add(r.id); });
    return set;
  })();

  useEffect(() => {
    const riders = sim.entrants.map((e) => ({
      e, frac: 0, mode: "draft", gid: e.id, slot: 0, dropStreak: 0, attackStreak: 0,
      // v12: エースのみ黄色を使い、他のAI含む何色とも被らないようにする。
      // 自チームのアシストは白系（他チームは赤/青/紫/橙）で「自分のチーム」だと一目でわかるようにする
      color: e.team === "PLAYER" ? (e.isAce ? T.color.accent : "#eef1f6") : e.color,
      biasX: -0.3, // v12: 前後バイアス（誰が前寄りか）。slotに応じて緩やかに追従する永続値
      elong: ELONGATION_BY_SEG.flat, tilt: 0, // v12バグ修正: 隊列の伸び・傾きも同様に緩やかに追従させる
    }));

    totalRef.current = Math.max(...sim.entrants.map(e => e.finishTime));
    const baseEvents = [];
    course.segs.forEach((s, j) => {
      const fracStart = j === 0 ? 0 : course.cumFrac[j - 1];
      if (s.wind) {
        baseEvents.push({ t: fracStart, text: `${s.label}：横風区間！エシュロンで集団が分断されるか` });
        return;
      }
      // v27: 区間タイプごとの実況パターンから決定的に1つ選ぶ（区間indexで循環）
      const pool = SEG_COMMENTARY[s.type];
      const line = pool ? pool[j % pool.length] : `${s.label}へ突入！`;
      baseEvents.push({ t: fracStart, text: `${line}` });
    });
    baseEvents.push({ t: 0.985, text: FINISH_COMMENTARY[Math.floor(strHash(sim.raceMeta.name || "x") % FINISH_COMMENTARY.length)] });
    // v27: 実況の動的イベント検知用の状態（逃げとメインのギャップ変化を追う）
    let prevGapSec = null, lastDynCommentAt = 0;
    // v35(UI): 注目選手（マイライフ＝プレイヤー本人／シーズン＝自チームのエース）を名指しで実況する。
    // 順位の急変・先頭浮上・遅れを検知して、レースを「自分の物語」として盛り上げる。
    const focusId = focusEnt ? focusEnt.id : null;
    const focusName = focusEnt ? focusEnt.name.split(" ")[0] : null;
    let prevFocusRank = null, lastFocusSampleAt = 0, lastBeatAt = -9999;
    // v39.12(アクションカム): 道中の見せ場（先頭浮上・逃げ拡大）で軽くズーム＋スロー。連発を防ぐクールダウン付き。
    const actionCam = (focusIdForCam, nowT) => { if (nowT - lastBeatAt > 6500 && !finalSegRef.current) { beatRef.current = { until: nowT + 2500, slow: 0.42, focusId: focusIdForCam }; lastBeatAt = nowT; } };
    // v39.3(演出): 実況ラインを複数から回して選ぶ（毎回同じ台詞の単調さを解消）
    let commentPick = 0;
    const pick = (arr) => arr[(commentPick++) % arr.length];

    clockRef.current = 0;
    firedRef.current = new Set();
    camSmoothRef.current = null;
    pausedRef.current = false;
    decisionRef.current = null;
    let prev = performance.now(), done = false, lastHud = 0, intervalId = null;
    const tick = () => {
      if (done) return;
      const now = performance.now();
      // v39(A案): 判断カード提示中は再生を凍結（clockを進めない）。dtスパイクを避けるためprevは更新する
      if (pausedRef.current) { prev = now; return; }
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      let clock = clockRef.current;
      if (skipRef.current) clock = PLAY_DUR;
      else {
        // v39.10(演出): ズームインとスロー再生をセットに。カメラが寄る（spanが小さい）ほど再生を遅く
        // する＝ズームインが緩やかに進むにつれてスローも徐々に効き、ゴール前がドラマチックに。山場(beat)も併用。
        const spanNow = camSmoothRef.current ? (camSmoothRef.current.end - camSmoothRef.current.start) : 0.2;
        // v39.15: ズーム連動スローをさらに強く＋効き始めを早く（寄り始めた時点から体感できるように）
        const zoomT = Math.max(0, Math.min(1, (0.20 - spanNow) / (0.20 - SPRINT_MIN_VIEW_FRAC)));
        const zoomSlow = 1 - 0.76 * zoomT;
        const beatSlow = beatRef.current.until > now ? beatRef.current.slow : 1;
        const slowFactor = Math.min(zoomSlow, beatSlow);
        clock = Math.min(PLAY_DUR, clock + dt * speedRef.current * slowFactor);
      }
      clockRef.current = clock;
      const rt = (clock / PLAY_DUR) * totalRef.current;
      rtRef.current = rt;
      let leadFrac = 0;
      riders.forEach((r) => {
        r.frac = interpFrac(r.e, rt, course);
        r.gid = groupAt(r.e, rt);
        r.mode = modeAt(r.e, rt);
        r.slot = slotAt(r.e, rt);
        r.nextPuller = nextPullerAt(r.e, rt);
        r.tag = tagAt(r.e, rt);
        // v12: 前後バイアス（誰が前寄りか）はslot/modeから決まる目標値へ毎フレーム緩やかに
        // 追従させる（瞬間移動を避けるため）。実際に集団の中を漂う揺らぎは描画時に加える
        const targetBiasX = r.mode === "pull" ? 0.85 : Math.max(-0.85, 0.7 - r.slot * 0.4);
        r.biasX += (targetBiasX - r.biasX) * PACK_BIAS_EASE;
        // v12バグ修正: 隊列の伸び・傾きも地形の変わり目でワープしないよう、目標値へ
        // 毎フレーム緩やかに追従させる（描画側では生の区間タイプから直接計算しない）
        const segInfoNow = course.segTypeAt(r.frac * course.length);
        const targetElong = Math.min(1, (ELONGATION_BY_SEG[segInfoNow.type] ?? 0.15) + (segInfoNow.wind ? 0.25 : 0));
        const targetTilt = segInfoNow.wind ? segInfoNow.windDir * PACK_TILT_MAX_RAD : 0;
        r.elong += (targetElong - r.elong) * PACK_ELONG_EASE;
        r.tilt += (targetTilt - r.tilt) * PACK_ELONG_EASE;
        r.dropStreak = modeStreakAt(r.e, rt, "solo", DROP_TRANSITION_TICKS);
        r.attackStreak = modeStreakAt(r.e, rt, "attack", ATTACK_VISUAL_TICKS);
        if (r.frac > leadFrac) leadFrac = r.frac;
      });
      // v39(A案): 判断カードの発火判定。注目選手がまだ走っていて（未ゴール）、最終区間より手前、
      // スキップ中でなく、しきい値frac／状況条件を満たした最初のカードを、その瞬間の状況(ctx)に応じて
      // 組み立てて提示し、再生を止める。
      // v39.13: allowFinal（最終スプリントの一手）は最終区間でも発火可。それ以外は最終区間より手前のみ。
      if (!pausedRef.current && !skipRef.current && focusId != null && decisions.length) {
        const focusR = riders.find(r => r.e.id === focusId);
        if (focusR && rt < focusR.e.finishTime) {
          const fromTick = Math.max(1, Math.min(focusR.e.posHist.length - 1, Math.floor(rt / TICK_SEC)));
          const ctx = {
            frac: focusR.frac,
            segType: course.segTypeAt(focusR.frac * course.length).type,
            energy: focusR.e.energyHist[Math.min(fromTick - 1, focusR.e.energyHist.length - 1)] ?? 100,
            inBreak: focusR.mode === "solo" || focusR.mode === "attack",
            groupSize: riders.filter(r => r.gid === focusR.gid && rt < r.e.finishTime).length,
            isLeader: riders.every(r => r.e.id === focusR.e.id || r.frac <= focusR.frac + 1e-6),
            // v39.22: シーズン（操作アバター不在＝監督視点）では指示カードに切り替える
            manager: !hasAvatar,
            mates: riders.filter(r => r.e.team === "PLAYER" && r.e.id !== focusR.e.id && rt < r.e.finishTime).length,
          };
          const d = decisions.find(dc => !firedRef.current.has(dc.id) && (dc.allowFinal || !finalSegRef.current) && (dc.at != null ? focusR.frac >= dc.at : (dc.cond && dc.cond(ctx))));
          if (d) {
            firedRef.current.add(d.id);
            const card = composeCard(d.kind, focusR.e, ctx);
            // v46(#27): 一手の威力が残脚で決まるようになったため、判断の material として残脚を渡す
            decisionRef.current = { id: d.id, fromTick, energy: ctx.energy, ...card };
            pausedRef.current = true;
            setDecision(decisionRef.current);
            return; // このフレームは凍結（カメラ/HUD更新もスキップ）
          }
        }
      }
      // v10: カメラズーム。ゴール済みの選手は枠決めの対象から外し、まだ走っている選手の
      // 広がりに合わせてズーム幅を自動調整する（先頭に少し前方の余白を持たせる）
      // v11: 「ゴール済み」は静的なen.finished（precompute直後は常にtrue）ではなく、
      // 現在の再生時刻rtがfinishTimeを過ぎたかどうかで判定する（実際にライブで通過したか）
      // v14.13: このブロックで決めた「今カメラが映している集団」をcameraFramingRefに
      // 保存し、後段のシネマティック演出（下のfinalSegRef.current && !cinematicRef.current）
      // が同じ集団を参照できるようにする。以前はシネマティック側が全選手からタイム差だけで
      // 独自に対象選手を選び直していたため、俯瞰マップで追っていた選手（先頭集団や
      // フィーチャー中の選手の集団）と、切り替わった演出に映る選手が食い違うことがあった
      {
        const liveFinished = (en) => rt >= en.finishTime;
        const unfinished = riders.filter(r => !liveFinished(r.e));
        let framing = unfinished.length > 0 ? unfinished : riders;
        // v11: 選手フィーチャー中は、その選手と同じ集団だけで枠を決める
        if (camModeRef.current !== "lead") {
          const focus = riders.find(r => r.e.id === camModeRef.current);
          if (!focus || liveFinished(focus.e)) {
            if (camModeRef.current !== "lead") {
              camModeRef.current = "lead";
              setCamMode("lead");
              liveRef.current = { text: "フィーチャー選手がゴール、先頭集団表示に切替", until: performance.now() + 3000 };
            }
          } else {
            const sameGroup = riders.filter(r => r.gid === focus.gid);
            if (sameGroup.length > 0) framing = sameGroup;
          }
        }
        // v46(#30修正): 先頭集団追従モードでは常に先頭集団へ絞る（従来は最終区間だけ絞っており、
        // それより手前はレースの大半で最後尾まで収めようとして画面が横に伸び過ぎていた）。
        // gidではなくfrac差で判定する。個人TT等、全員が別集団（gidバラバラ）で走る競技では
        // gid基準だと先頭1名だけに潰れてしまうため。先頭自身は差0でしきい値を満たすので
        // 空集合にはならない。
        if (camModeRef.current === "lead") {
          const leadF = Math.max(...framing.map(r => r.frac));
          const leadGroup = framing.filter(r => leadF - r.frac <= LEAD_GROUP_FRAC);
          if (leadGroup.length > 0) framing = leadGroup;
        }
        // v11: 最終区間突入後、先頭集団追従モードに限り先頭集団（最高fracと同じgid）だけに絞り、
        // スプリント勝負に寄せる（選手フィーチャー中はその選手の集団のまま）
        if (finalSegRef.current && camModeRef.current === "lead") {
          const leadGid = framing.reduce((best, r) => (r.frac > best.frac ? r : best), framing[0]).gid;
          const leadOnly = framing.filter(r => r.gid === leadGid);
          if (leadOnly.length > 0) framing = leadOnly;
        }
        // v39.3(演出): 山場(beat)の間は当該選手の集団へカメラを寄せる（決定的瞬間のクローズアップ）
        const beatOn = beatRef.current.until > now;
        if (beatOn && beatRef.current.focusId != null) {
          const bf = riders.find(r => r.e.id === beatRef.current.focusId);
          if (bf && rt < bf.e.finishTime) {
            const g = riders.filter(r => r.gid === bf.gid && rt < r.e.finishTime);
            if (g.length > 0) framing = g;
          }
        }
        const fracs = framing.map(r => r.frac);
        const maxF = Math.max(...fracs), minF = Math.min(...fracs);
        const spreadF = maxF - minF;
        const center = (maxF + minF) / 2;
        let span = Math.min(MAX_VIEW_FRAC, Math.max(MIN_VIEW_FRAC, spreadF * 1.6));
        if (finalSegRef.current) span = Math.min(span, SPRINT_MIN_VIEW_FRAC);
        // v39.3(演出): 山場の間はさらに寄せる（クローズアップ感）
        // v46: 0.44→0.62。寄せ量を穏やかにし、ズームの往復が目立ちすぎないようにした
        if (beatOn) span = Math.max(MIN_VIEW_FRAC * 0.62, span * 0.62);
        // v12バグ修正: 逃げとメイン集団の差が開きMAX_VIEW_FRAC（最大ズームアウト幅）を
        // 超えると、上のMath.minでspanが実際に必要な幅より狭く決まってしまい、
        // 「先頭集団」カメラで追っているはずの選手がキャンバス範囲外（画面右側など）に
        // 押し出されて見えなくなるバグがあった。安全マージンを削ってでも全員が必ず
        // 表示範囲に収まるよう、実際の広がりを下回らない値まで引き上げる
        // v39.10: 先頭が右端に張り付かないよう余白を増やす（従来は spread+0.01 でギリギリ＝端寄り）
        span = Math.max(span, spreadF * 1.4 + 0.02);
        let start = center - span * VIEW_LEAD_BIAS;
        let end = start + span;
        if (start < 0) { start = 0; end = Math.min(1, span); }
        // v39.10: パン（中心）は機敏に追従、ズーム（span）だけをなめらかに。さらにズームインは緩やか・
        // ズームアウトは速く戻す非対称補間。これで倍率がだんだん変わり、位置は遅れず右端に寄らない。
        const targetC = (start + end) / 2, targetSpan = end - start;
        // v46: カメラ平滑化の計算をdomain/shared/raceCamera.jsへ抽出（Node単体テスト可能に）。
        // ズームイン/アウトの収束速度をゆっくりめに調整（1.2秒/370ms）。
        const { start: ns, end: ne } = smoothRaceCamera({ targetC, targetSpan, prev: camSmoothRef.current, maxF, minF });
        camSmoothRef.current = { start: ns, end: ne };
        setCam({ start: ns, end: ne });
        cameraFramingRef.current = framing;
      }
      // v39.3(演出): フラムルージュ（残り1km相当）。最終区間の少し手前で一度だけ、スロー＋
      // バナーで「勝負が動く直前」の緊張を作る。先頭が flammeFrac を越えた瞬間に発火。
      if (!flammeRef.current && !finalSegRef.current && leadFrac >= flammeFrac) {
        flammeRef.current = true;
        beatRef.current = { until: now + 2800, slow: 0.38, focusId: null };
        liveRef.current = { text: "フラムルージュ！残り1km、いよいよ勝負が動く", until: now + 2800 };
      }
      // 最終区間突入判定
      // v12: 位置ベース（最終区間に実際に入ったか）に加えて時間ベースの判定もOR条件で追加。
      // MAX_TICKS到達により、山岳など遅いレースでは選手の位置が実際には最終区間まで
      // 到達しないままfinishTimeが外挿で確定してしまうことがあり、位置ベースの判定だけでは
      // 山岳ゴール等で最終区間演出が一度も発火しない不具合があったための対策
      if (!finalSegRef.current) {
        const posBasedFinal = riders.some(r => course.segTypeAt(r.frac * course.length).idx >= course.finalIdx);
        const winnerFinishTime = Math.min(...riders.map(r => r.e.finishTime));
        const timeBasedFinal = rt >= winnerFinishTime * (1 - FINAL_SEG_TIME_RATIO);
        const anyInFinal = posBasedFinal || timeBasedFinal;
        if (anyInFinal) {
          finalSegRef.current = true; setFinalSeg(true);
          // v11: 最終区間突入をはっきり体感できるよう、切り替わりの瞬間にバナー表示する
          liveRef.current = { text: "ラストスパート突入！カメラをズームして追跡します", until: now + 3000 };
        }
      }
      // v12: シネマティックへの切り替えは最終区間突入よりさらに後（ゴール直前）に遅らせる。
      // 同時に発火させると、通常の俯瞰マップで見えるリードアウト演出（牽引線・エース発射）が
      // 表示される間もなくシネマティックに切り替わってしまうため
      // v12（簡易リードアウト演出）：エース発射の光るリング。実際のmodeは一斉スプリントだと
      // 終始draftのままなので、mode変化ではなく時間ベースでこのタイミングを演出する
      if (finalSegRef.current && !launchingRef.current) {
        const winnerFinishTime = Math.min(...riders.map(r => r.e.finishTime));
        if (rt >= winnerFinishTime * (1 - LAUNCH_TIME_RATIO)) {
          launchingRef.current = true; setLaunching(true);
        }
      }
      if (finalSegRef.current && !cinematicRef.current) {
        const winnerFinishTime = Math.min(...riders.map(r => r.e.finishTime));
        if (rt >= winnerFinishTime * (1 - CINEMATIC_TIME_RATIO)) {
          cinematicRef.current = true;
          // v12: 最終直線シネマティック演出用に、結果が既に確定済みの着順・着差をスナップショットする
          // （実際のfinishTimeから逆算するだけで、シミュレーション自体には一切手を加えない）
          // v14.13: 対象選手は全選手からタイム差で選び直すのではなく、直前まで俯瞰マップの
          // カメラが実際に映していた集団（cameraFramingRef）を母集団にする（先頭集団を追っていれば
          // その集団、選手フィーチャー中ならその選手の集団＝演出に切り替わっても顔ぶれが変わらない）。
          // v39.2: 「集団スプリントなのに数人しか映らない」違和感の解消。従来はこの母集団を着差12秒・
          // 上限8名で厳しく削っていたため、団子で雪崩れ込んでも最終直線が急にスカスカになっていた。
          // カメラが映していた集団を厳しく削らず（着差フィルタ緩め・上限22名）そのまま最終直線に流す。
          // さらに、最終区間でカメラが先頭gidのみに絞られていても、そのすぐ後ろで一緒に雪崩れ込む
          // 僅差(位置がごく近い)の選手は集団の一部として母集団に加える（gidの分かれ目に依存しない）。
          const camGroup = (cameraFramingRef.current && cameraFramingRef.current.length > 0) ? cameraFramingRef.current : riders;
          const camIds = new Set(camGroup.map(r => r.e.id));
          const camMaxFrac = Math.max(...camGroup.map(r => r.frac));
          const camMinFrac = Math.min(...camGroup.map(r => r.frac));
          const nearBunch = riders.filter(r => !camIds.has(r.e.id) && r.frac <= camMaxFrac && r.frac >= camMinFrac - 0.02);
          const pool = [...camGroup, ...nearBunch];
          const sortedByFinish = [...pool].sort((a, b) => a.e.finishTime - b.e.finishTime);
          const winnerTime = sortedByFinish[0].e.finishTime;
          const contenders = sortedByFinish
            .filter(r => r.e.finishTime - winnerTime < SPRINT_CONTENDER_GAP_SEC)
            .slice(0, SPRINT_MAX_CONTENDERS)
            .map(r => {
              // v39.7(演出): スプリントの駆け引きを可視化するため、各選手の「動き方」を数値化する。
              // kick>0＝後方から伸びる差し脚（ごぼう抜き）、kick<0＝先行して垂れるリードアウト/アシスト、
              // ≒0＝淡々。逃げ切り(単独で大きく先行)は別途 render 側で検出して独走に見せる。
              const sp = r.e.sprint || 60;
              let kick;
              if (r.e.isAssisting || r.e.leadoutFor != null) kick = -0.9;
              else if (hasAbility(r.e, "finisher") || hasAbility(r.e, "kicker")) kick = 1;
              else kick = Math.max(-0.5, Math.min(0.9, (sp - 72) / 24));
              return { id: r.e.id, name: r.e.name, color: r.color, isAce: r.e.isAce, isPlayer: isAvatar(r.e), isMyTeam: r.e.team === "PLAYER", gapSec: r.e.finishTime - winnerTime, kick };
            });
          setCinematic({ contenders });
        }
      }
      setRidersUi(riders.map(r => ({
        id: r.e.id, frac: r.frac, mode: r.mode, color: r.color, isAce: r.e.isAce, isPlayer: isAvatar(r.e),
        gid: r.gid, slot: r.slot, tag: r.tag, dropStreak: r.dropStreak, attackStreak: r.attackStreak, biasX: r.biasX,
        elong: r.elong, tilt: r.tilt,
        // v37: 観戦マップに名前ラベルを出すため、選手名と識別フラグを持たせる
        // v45: 殿堂選手（isLegend＝引退後に衰えて後年に再登場する歴代選手）もタグ対象に追加
        name: r.e.name, isRival: !!(r.e.isRival || r.e.isRival2), isMyTeam: r.e.team === "PLAYER", isLegend: !!r.e.isLegend,
      })));
      if (now - lastHud > 300 || clock >= PLAY_DUR) {
        lastHud = now;
        const sorted = [...riders].sort((a, b) => b.frac - a.frac);
        // v38(改善#2): ライブ順位表のギャップを「距離」ではなく「タイム差（秒）」で出す。従来は距離を
        // そのまま fmtGap(秒扱い) に渡していたため、終盤で集団になると先頭数名が全員「TOP」になり誰が
        // 勝っているか読めなかった。先頭の到達進捗と経過時間からペースを逆算して秒差に変換する。
        const leadFracNow = sorted[0].frac || 1e-6;
        const paceFracPerSec = leadFracNow / Math.max(1, rt); // 先頭のフラク進行/秒
        const top = sorted.slice(0, 5).map((r, i) => ({
          name: r.e.name, team: r.e.team, isPlayer: isAvatar(r.e),
          gap: i === 0 ? 0 : (leadFracNow - r.frac) / Math.max(1e-6, paceFracPerSec),
        }));
        let segLabel = course.segs[course.segs.length - 1].label;
        let segTypeNow = course.segs[course.segs.length - 1].type;
        for (let j = 0; j < course.segs.length; j++) { if (leadFrac <= course.cumFrac[j] + 1e-6) { segLabel = course.segs[j].label; segTypeNow = course.segs[j].type; break; } }
        // v39.11: 現在地形のおおまかな勾配%（course.steepnessで強弱）。俯瞰マップのHUDに出す。
        const gradeBase = { climb: 7, mtn: 10, hill: 3.5, flat: 0, sprint: 0, tt: 0 }[segTypeNow] || 0;
        const segSteep = gradeBase > 0 ? Math.round(gradeBase * (course.steepness || 1) * 10) / 10 : 0;
        // ライブギャップ表示（逃げ集団 vs 追走）：先頭グループと2番手グループの位置差を秒換算
        let gapText = null;
        const gidSet = [...new Set(sorted.map(r => r.gid))];
        let curGapSec = null;
        if (sim.groupMode !== "solo" && gidSet.length > 1) {
          const leadG = sorted[0].gid;
          const chaseR = sorted.find(r => r.gid !== leadG);
          if (chaseR) {
            curGapSec = Math.max(0, Math.round((sorted[0].frac - chaseR.frac) * totalRef.current));
            // 第60弾(devlog/wave60.md): 「約396秒」のような秒のまま出す表示は読みづらい。
            // 60秒以上は分単位も添える（例：約6分36秒）。
            const gapReadable = curGapSec < 60 ? `${curGapSec}秒` : `${Math.floor(curGapSec / 60)}分${curGapSec % 60}秒`;
            gapText = `逃げとメインのギャップ：約${gapReadable}`;
          }
        }
        // v35(UI): 注目選手（プレイヤー／自チームのエース）を名指しで実況。順位の急変・先頭浮上・
        // 遅れを拾う。最終区間はラストスパート演出が優先されるため対象外。ギャップ実況と枠を共有し
        // （4秒間隔）、より物語性の高い注目選手の実況を優先する。
        // 注目選手の順位を約2.5秒ごとにサンプリングし、その窓での動きを実況にする
        let focusFired = false;
        if (!finalSegRef.current && focusId != null && now - lastFocusSampleAt > 2500) {
          const fr = sorted.findIndex(r => r.e.id === focusId);
          const focusRank = fr >= 0 ? fr + 1 : null;
          const focusR = riders.find(r => r.e.id === focusId);
          const segT = focusR ? course.segTypeAt(focusR.frac * course.length).type : "flat";
          const terr = ["climb", "mtn"].includes(segT) ? "登りで" : segT === "hill" ? "丘で" : segT === "sprint" ? "スプリントで" : "";
          const soloBreak = focusR && (focusR.mode === "attack" || focusR.mode === "solo") && focusRank === 1;
          if (focusRank != null) {
            if (prevFocusRank != null && now - lastDynCommentAt > 3500) {
              const up = prevFocusRank - focusRank; // 正＝順位を上げた
              if (soloBreak && (beatRef.current.until <= now)) {
                liveRef.current = { text: pick([`${focusName}、独走態勢だ！後続を突き放しにかかる`, `${focusName}が抜け出した！このまま逃げ切れるか`, `${focusName}、一人旅！集団は反応できるか`]), until: now + 2600 }; lastDynCommentAt = now; focusFired = true; actionCam(focusId, now);
              } else if (focusRank === 1 && prevFocusRank > 1) {
                liveRef.current = { text: pick([`${focusName}が${terr}先頭に立った！`, `${focusName}、ついに先頭に躍り出た！`, `先頭は${focusName}だ！`]), until: now + 2600 }; lastDynCommentAt = now; focusFired = true; actionCam(focusId, now);
              } else if (up >= 4 && focusRank <= 10) {
                liveRef.current = { text: pick([`${focusName}が${terr}集団を縫って上がってきた！`, `${focusName}、ぐんぐん順位を上げる！`, `${focusName}が${terr}前方へポジションを押し上げる`]), until: now + 2600 }; lastDynCommentAt = now; focusFired = true;
              } else if (up <= -5) {
                liveRef.current = { text: pick([`${focusName}が${terr}遅れ始めた…苦しい展開だ`, `${focusName}、ペースに乗れず後退…`, `${focusName}が${terr}千切れかけている！粘れるか`]), until: now + 2600 }; lastDynCommentAt = now; focusFired = true;
              }
            }
            prevFocusRank = focusRank;
            lastFocusSampleAt = now;
          }
        }
        // v27: 実況の動的イベント。逃げとメインのギャップが大きく動いた瞬間に実況を差し込む
        // （最終区間はラストスパート演出が優先されるため対象外。過度な連発を避けて4秒間隔で抑制）
        if (!focusFired && !finalSegRef.current && curGapSec != null && prevGapSec != null && now - lastDynCommentAt > 4000) {
          const d = curGapSec - prevGapSec;
          if (curGapSec < 1.5 && prevGapSec >= 3) {
            liveRef.current = { text: pick(["逃げ吸収！集団は再び一つにまとまった", "メイン集団が逃げを飲み込んだ！振り出しに戻る", "ついに追いついた！集団はひとかたまりに"]), until: now + 2600 }; lastDynCommentAt = now;
          } else if (d >= 4) {
            liveRef.current = { text: pick(["逃げがリードを広げる！メイン集団は反応できるか", "前を行く逃げがぐんぐんタイム差を稼ぐ！", "逃げ切りが見えてきたか、リードは広がる一方だ"]), until: now + 2600 }; lastDynCommentAt = now; actionCam(null, now);
          } else if (d <= -4 && curGapSec > 2) {
            liveRef.current = { text: pick(["メイン集団がペースを上げ、逃げを引き戻しにかかる", "集団が本気だ！タイム差が見る間に縮まる", "追走のペースアップ！逃げグループを射程に捉える"]), until: now + 2600 }; lastDynCommentAt = now;
          }
        }
        if (curGapSec != null) prevGapSec = curGapSec;
        let comment = "";
        if (liveRef.current.until > now) comment = liveRef.current.text;
        else {
          const ev = [...baseEvents].reverse().find(e => e.t <= leadFrac + 1e-4);
          comment = ev ? ev.text : "";
        }
        const isDone = clock >= PLAY_DUR;
        const lap = course.laps > 1 ? course.lapAtFrac(leadFrac) : null;
        setHud({ top, seg: segLabel, segType: segTypeNow, segSteep, remain: Math.max(0, Math.round((1 - leadFrac) * 100)), clock: rt, done: isDone, comment, gap: gapText, lap });
        if (isDone && !done) { done = true; if (intervalId) clearInterval(intervalId); return; }
      }
    };
    // requestAnimationFrameはタブが非表示/非フォーカス時にブラウザが完全停止させることがあり、
    // その場合スキップボタンも巻き添えで無反応になってしまう。setIntervalは強くスロットルされることは
    // あっても完全停止はしないため、進行不能を避けるためこちらを使う。
    // さらに、tickRef経由でスキップボタンからtick()を直接同期呼び出しできるようにし、
    // ブラウザの長時間バックグラウンド時のタイマー完全凍結にも耐えられるようにする
    tickRef.current = tick;
    intervalId = setInterval(tick, 33);
    return () => {
      tickRef.current = null;
      clearInterval(intervalId);
    };
  }, [sim]);

  // v39.11: 現在の地形で俯瞰/側面マップの地の色を変え、走っている場所の性格を伝える。
  const TERRAIN_BG = { climb: "#4a3d2f", mtn: "#3b3e45", hill: "#43502e", sprint: "#33414c", flat: "#3f5a3a", tt: "#39544f" };
  const TERRAIN_BG_SIDE = { climb: "#2b2419", mtn: "#22242a", hill: "#27301b", sprint: "#1e2830", flat: "#232a20", tt: "#203230" };
  const terrainBg = TERRAIN_BG[hud.segType] || "#3f5a3a";
  const terrainBgSide = TERRAIN_BG_SIDE[hud.segType] || "#232a20";
  return (
    <div style={{ display: "grid", gap: T.space.sm }}>
      <div style={{ display: "flex", gap: T.space.sm, flexWrap: "wrap" }}>
        <div style={{ background: T.color.surfaceUp, padding: T.space.sm, flex: 1, minWidth: 140 }}>
          <div style={{ fontFamily: FONT_DOT, fontSize: T.size.caption, color: T.color.accent }}>{hud.seg}{hud.lap ? `（${hud.lap}/${sim.course.laps}周）` : ""}{hud.segSteep ? ` ▲${hud.segSteep}%` : ""}</div>
          <div style={{ fontFamily: FONT_DOT, fontSize: T.size.head, color: T.color.text, marginTop: 2 }}>{fmtTime(hud.clock)}{hud.remain != null ? <span style={{ fontSize: T.size.caption, color: T.color.sub, marginLeft: T.space.xs }}>残り{hud.remain}%</span> : null}</div>
          {hud.gap && <div style={{ fontFamily: FONT_DOT, fontSize: T.size.caption, color: T.color.good, marginTop: 2 }}>{hud.gap}</div>}
        </div>
        <div style={{ background: T.color.surfaceUp, padding: T.space.sm, flex: 1.3, minWidth: 165 }}>
          {/* v45.1: 最終スプリント演出中はhud.top（進行率frac差からの秒換算）が使えない。
              終盤に集団がfracでほぼ収束し、差がゼロ＝fmtGap(0)で全員「TOP」になってしまうため。
              cinematicは既にfinishTime確定後のgapSecを持つスナップショットなので、演出中は
              そちらへ丸ごと差し替える（シミュレーション・順位表ロジック自体には手を入れない）。 */}
          {(cinematic
            ? [...cinematic.contenders].sort((a, b) => a.gapSec - b.gapSec).slice(0, 5)
                .map(c => ({ name: c.name, isPlayer: c.isPlayer, team: c.isMyTeam ? "PLAYER" : undefined, gap: c.gapSec }))
            : hud.top
          ).map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: T.space.sm, fontSize: T.size.caption }}>
              <span style={{ color: r.isPlayer ? T.color.accent : (r.team === "PLAYER" ? "#bfe3ff" : T.color.text) }}>{i + 1}. {r.name}</span>
              <span style={{ fontFamily: FONT_DOT, color: r.isPlayer ? T.color.accent : T.color.sub }}>{fmtGap(r.gap)}</span>
            </div>
          ))}
        </div>
      </div>
      {/* v39(A案): レース中の判断カード。表示中は再生が止まり、選ぶと結果に反映される */}
      {/* v48(第9弾): カードUIはDecisionCard.jsxへ切り出し（レア度演出・2段レイアウト） */}
      <DecisionCard decision={decision} focusName={focusEnt?.name} resimBusy={resimBusy} onChoose={resolveDecision} />
      {!cinematic && !decision && (
        <ChipRow value={camMode} onChange={selectCam}
          options={[{ value: "lead", label: "先頭集団" }, ...playerRoster.map(e => ({ value: e.id, label: `${e.name.split(" ")[0]}${e.isAce ? "・エース" : ""}` }))]} />
      )}
      {cinematic ? (
        <div>
          <div style={{ fontSize: T.size.caption, color: T.color.bad }}>{cinematic.contenders.length > 1 ? (cinematic.contenders.length >= 10 ? "大集団のゴールスプリント — 最終直線" : "ゴールスプリント — 最終直線") : "単独ゴール — 最終直線"}</div>
          <FinalSprintCinematic contenders={cinematic.contenders} />
        </div>
      ) : (
        <>
          <div>
            <div style={{ fontSize: T.size.caption, color: finalSeg ? T.color.bad : T.color.sub }}>{finalSeg ? "ラストスパートズーム — 俯瞰マップ" : "俯瞰マップ（コースの左右の揺れ）"}</div>
            <svg viewBox={`0 0 ${MAP_W} ${TOP_H}`} preserveAspectRatio="none" style={{ ...MAP_BLEED, boxSizing: "border-box", aspectRatio: `${MAP_W} / ${TOP_H}`, background: terrainBg, borderRadius: 8, marginTop: 4, border: finalSeg ? `2px solid ${T.color.bad}` : "2px solid transparent", transition: "background-color 0.6s, border-color 0.2s" }}>
              {/* v12: 集団の2次元的な広がり（団子状〜エシュロン時の斜め隊列）に対して
                  道幅が狭すぎて選手がはみ出て見える問題を修正するため大幅に拡張。
                  さらに拡張してほしいという追加フィードバックを繰り返し受け再拡大。
                  v14.4: 固定height指定とviewBoxの縦横比が食い違い、画面幅次第で
                  横方向に伸縮するアスペクト比崩れが発生していたため、CSSのaspect-ratio
                  でviewBoxと同じ比率を強制する形に修正（あわせて道幅もさらに拡大） */}
              <polyline points={topPath} fill="none" stroke="#8a8f98" strokeWidth="190" strokeLinecap="round" />
              <polyline points={topPath} fill="none" stroke="#7a7f88" strokeWidth="1" strokeDasharray="6,5" opacity="0.5" />
              <circle cx={mapX(1, cam.start, cam.end)} cy={riderTopY(1, 0)} r="4" fill={T.color.bad} />
              {/* v39.17: 沿道の並木/柵を細かい間隔で置き、カメラが集団を追って進むほど高速に流れる＝
                  俯瞰マップにもスピード感を出す（選手は画面上ほぼ静止するので、速度は背景の流れで見せる）。 */}
              {(() => {
                // v39.18: 道はカーブしているので、柵は画面と平行ではなく「道の法線方向」に置き、
                // 道の傾きに合わせて回転させる（＝道に沿って並んで見える）。
                const step = 0.004;                                   // コース全長の0.4%ごと
                const a0f = Math.floor(cam.start / step) * step;
                const items = [];
                const HALF = 96;                                       // 道の半幅（描画strokeWidth190に対応）
                for (let f = a0f; f <= cam.end + step; f += step) {
                  if (f < 0 || f > 1) continue;
                  const x = mapX(f, cam.start, cam.end);
                  if (x < -10 || x > MAP_W + 10) continue;
                  // 画面座標での道の向き（微小前進の差分から求める）
                  const df = (cam.end - cam.start) * 0.004;
                  const x2 = mapX(f + df, cam.start, cam.end), y2 = topRoadYAt(f + df);
                  const y1 = topRoadYAt(f);
                  const dx = x2 - x, dy = y2 - y1;
                  const len = Math.hypot(dx, dy) || 1;
                  const nx = -dy / len, ny = dx / len;                 // 法線（道に直交）
                  const deg = Math.atan2(dy, dx) * 180 / Math.PI;
                  const k = Math.round(f / step);
                  const col = k % 2 ? "#6d8471" : "#4e6455";
                  const post = (sign) => {
                    const px = x + nx * HALF * sign, py = y1 + ny * HALF * sign;
                    return <rect x={-1.2} y={-4.5} width="2.4" height="9" fill={col} opacity="0.85" transform={`translate(${px.toFixed(1)},${py.toFixed(1)}) rotate(${deg.toFixed(1)})`} />;
                  };
                  items.push(<g key={"rp" + k}>{post(1)}{post(-1)}</g>);
                }
                return <g>{items}</g>;
              })()}
              {/* v39.12: 距離ポスト（10%刻み・沿道スクロール）＋KOM/中間スプリント標識。カメラ範囲内のみ */}
              {distPosts.map((f, i) => (f < cam.start - 0.02 || f > cam.end + 0.02) ? null : (
                <g key={"dp" + i}>
                  <line x1={mapX(f, cam.start, cam.end)} y1={TOP_H * 0.12} x2={mapX(f, cam.start, cam.end)} y2={TOP_H * 0.88} stroke="#ffffff" strokeWidth="1" strokeDasharray="3,7" opacity="0.1" />
                  <text x={mapX(f, cam.start, cam.end)} y={TOP_H * 0.09} textAnchor="middle" fontSize="7.5" fill="#ffffff" opacity="0.32">残り{100 - Math.round(f * 100)}%</text>
                </g>
              ))}
              {courseMarkers.map((m, i) => (m.frac < cam.start - 0.02 || m.frac > cam.end + 0.02) ? null : (
                <g key={"cm" + i} transform={`translate(${mapX(m.frac, cam.start, cam.end)},0)`}>
                  <line x1="0" y1={TOP_H * 0.14} x2="0" y2={TOP_H * 0.86} stroke={m.color} strokeWidth="1.6" strokeDasharray="5,4" opacity="0.5" />
                  <rect x="-17" y={TOP_H * 0.05} width="34" height="15" rx="3" fill="#0E0E10" opacity="0.82" />
                  <text x="0" y={TOP_H * 0.05 + 11} textAnchor="middle" fontSize="9" fill={m.color} fontWeight="700">{m.label}</text>
                </g>
              ))}
              {/* v39.19: 集団の役割ラベル（逃げ集団／追走集団／ペロトン／遅れ）。ロードレースの
                  展開用語で「今どういう構図か」を読み取れるようにする。最大人数の塊＝ペロトン。 */}
              {(() => {
                if (ridersUi.length < 2) return null;
                const byG = {};
                ridersUi.forEach(r => { (byG[r.gid] = byG[r.gid] || []).push(r); });
                const groups = Object.values(byG).map(m => ({
                  m, n: m.length,
                  front: Math.max(...m.map(r => r.frac)),
                  cx: m.reduce((s, r) => s + r.frac, 0) / m.length,
                }));
                if (groups.length < 2) return null;
                groups.sort((a, b) => b.front - a.front);
                const pelotonN = Math.max(...groups.map(g => g.n));
                const labelOf = (g, i) => {
                  if (g.n === pelotonN && g.n >= 5) return { t: "ペロトン", c: "#cfd6e4" };
                  if (i === 0) return { t: g.n === 1 ? "独走" : "逃げ集団", c: "#ffd23f" };
                  if (g.front < groups[0].front && g.n >= 1 && i < groups.length - 1) return { t: "追走集団", c: "#7fd6a0" };
                  return { t: "遅れた集団", c: "#9aa3b5" };
                };
                return (
                  <g>
                    {groups.slice(0, 4).map((g, i) => {
                      if (g.cx < cam.start - 0.01 || g.cx > cam.end + 0.01) return null;
                      const lab = labelOf(g, i);
                      const x = mapX(g.cx, cam.start, cam.end), y = riderTopY(g.cx, 0) - 30;
                      const w = lab.t.length * 9 + 20;
                      return (
                        <g key={"gl" + i}>
                          <rect x={x - w / 2} y={y - 11} width={w} height="15" rx="7" fill="#0E0E10" opacity="0.72" />
                          <text x={x} y={y} textAnchor="middle" fontSize="9.5" fill={lab.c} fontWeight="700">{lab.t} {g.n}名</text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}
              {/* v39.12: グループ間ギャップの可視化（先頭集団の最後尾 ↔ 追走の先頭を結び、秒差を表示） */}
              {sim.groupMode !== "solo" && (() => {
                if (ridersUi.length < 2) return null;
                const leadGid = ridersUi.reduce((a, b) => (b.frac > a.frac ? b : a), ridersUi[0]).gid;
                const lead = ridersUi.filter(r => r.gid === leadGid);
                const chase = ridersUi.filter(r => r.gid !== leadGid);
                if (!lead.length || !chase.length) return null;
                const leadRear = lead.reduce((a, b) => (b.frac < a.frac ? b : a), lead[0]);
                const chaseFront = chase.reduce((a, b) => (b.frac > a.frac ? b : a), chase[0]);
                const gapFrac = leadRear.frac - chaseFront.frac;
                if (gapFrac <= 0.004) return null;
                const p1 = packPoint(leadRear), p2 = packPoint(chaseFront);
                const sec = Math.max(1, Math.round(gapFrac * totalRef.current));
                const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
                return (
                  <g>
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#ffd23f" strokeWidth="2" strokeDasharray="4,4" opacity="0.6" />
                    <rect x={mx - 17} y={my - 8} width="34" height="14" rx="3" fill="#0E0E10" opacity="0.8" />
                    <text x={mx} y={my + 2.5} textAnchor="middle" fontSize="9.5" fill="#ffd23f" fontWeight="700">▲{sec}秒</text>
                  </g>
                );
              })()}
              {/* v39.12: 自チームの隊列（同一集団の自チーム選手を線で結び、チームで動いている様子を可視化） */}
              {(() => {
                const team = ridersUi.filter(r => r.isMyTeam).sort((a, b) => a.frac - b.frac);
                if (team.length < 2) return null;
                const lines = [];
                for (let i = 0; i < team.length - 1; i++) {
                  if (team[i].gid === team[i + 1].gid) {
                    const p1 = packPoint(team[i]), p2 = packPoint(team[i + 1]);
                    lines.push(<line key={"tl" + i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#7db8ff" strokeWidth="1.3" opacity="0.4" />);
                  }
                }
                return <g>{lines}</g>;
              })()}
              {/* v12（簡易リードアウト演出）：自チームのアシストがエースを牽引中なら線で結ぶ */}
              {playerLeadout && (() => {
                const p1 = packPoint(playerLeadout), p2 = packPoint(playerAce);
                return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={T.color.accent} strokeWidth="1.2" strokeDasharray="3,2" opacity="0.65" />;
              })()}
              {ridersUi.map(r => {
                // v12: 隊列シェイプ（楕円軌道）由来の2次元オフセット。千切れ演出・アタック誇張は
                // packShape計算に統合済み（アタック中はdx=dy=0で、前方誇張はdrawFrac側で処理）
                const { dx, dy } = packShape[r.id] || { dx: 0, dy: 0 };
                const attackBonus = r.attackStreak > 0 ? (1 - r.attackStreak / ATTACK_VISUAL_TICKS) * ATTACK_EXAGGERATION : 0;
                const drawFrac = Math.min(1, r.frac + attackBonus);
                // v12（簡易リードアウト演出）：最終区間の終盤（シネマティック直前）を
                // 自チームエース「発射」の瞬間として光らせる。一斉スプリントだと実際の
                // modeは終始draftのままなので、mode変化ではなく時間ベースの演出にしている。
                // ただし、エースが千切れて先頭集団のカメラ枠外にいる場合は「発射」の意味がない
                // （画面外に光るリングが出てしまう）ため、現在の表示範囲内にいる時だけ光らせる
                const isLaunching = launching && r.isPlayer && r.isAce
                  && drawFrac >= cam.start - 0.01 && drawFrac <= cam.end + 0.01;
                return (
                  <g key={r.id} transform={`translate(${mapX(drawFrac + dx, cam.start, cam.end)},${riderTopY(drawFrac + dx, dy)})`}>
                    {camMode === r.id && <circle r="10" fill="none" stroke={T.color.good} strokeWidth="1.5" opacity="0.9" />}
                    {isLaunching && (
                      <circle r="9" fill="none" stroke={T.color.accent} strokeWidth="2" opacity="0.9">
                        <animate attributeName="r" values="7;11;7" dur="0.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.9;0.3;0.9" dur="0.8s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {r.mode === "attack" && <circle r="8" fill="none" stroke={T.color.bad} strokeWidth="1.5" opacity="0.85" />}
                    {r.nextPuller && r.mode === "draft" && <circle r={r.isAce ? 7.5 : 6} fill="none" stroke={T.color.accent} strokeWidth="1" strokeDasharray="2,2" opacity="0.7" />}
                    {/* v29バグ修正: 自分がエースでない（白マーカー）ときにアシスト仲間と見分けが
                        つかないという指摘に対応。自分の印には常に水色の識別リングを重ね、
                        エースかどうかに関わらず一目で自分だとわかるようにする */}
                    {r.isPlayer && <circle r={r.isAce ? 8 : 6.5} fill="none" stroke="#27d3ff" strokeWidth="1.8" />}
                    {/* v39.12: 俯瞰マーカーを真上から見た自転車アイコンに（フレーム＋前後輪＋ジャージ） */}
                    <g>
                      <rect x="-5.4" y="-1" width="10.8" height="2" rx="1" fill="#0E0E10" opacity="0.9" />
                      <circle cx="-4.4" cy="0" r="1.5" fill="#0E0E10" />
                      <circle cx="4.4" cy="0" r="1.5" fill="#0E0E10" />
                      <ellipse rx={r.isAce ? 4 : 3.3} ry={r.isAce ? 3 : 2.6} fill={r.color} stroke={r.mode === "pull" ? "#fff" : "#0E0E10"} strokeWidth={r.mode === "pull" ? 1.6 : 0.6} />
                      {r.isPlayer && <circle r="1.5" fill="#0E0E10" />}
                    </g>
                    {/* v39.19: 役割バッジ。牽引（先頭交代の当番）／リードアウト／前待ち を用語で明示 */}
                    {(() => {
                      // v39.20: sim側の展開タグを優先（トレイン/発射/前待ち/リードアウト/ピールオフ）
                      const TAG = {
                        train: { t: "トレイン", c: "#7db8ff" },
                        leadout: { t: "リードアウト", c: "#ffd23f" },
                        launch: { t: "発射！", c: "#ff8a3d" },
                        front: { t: "前待ち", c: "#7fd6a0" },
                        peel: { t: "力尽き後退", c: "#9aa3b5" },
                        shelter: { t: "援護中", c: "#5aa9e6" },
                      };
                      const badge = TAG[r.tag]
                        || (r.mode === "pull" ? { t: "牽引", c: "#ffffff" }
                          : (r.nextPuller && r.mode === "draft") ? { t: "次に牽引", c: "#ffd23f" } : null);
                      if (!badge || (!r.isMyTeam && !r.isPlayer && r.mode !== "pull")) return null;
                      return (
                        <g>
                          <rect x={-badge.t.length * 4.5 - 3} y={7} width={badge.t.length * 9 + 6} height="11" rx="5" fill="#0E0E10" opacity="0.7" />
                          <text y={15.5} textAnchor="middle" fontSize="8" fill={badge.c} fontWeight="700">{badge.t}</text>
                        </g>
                      );
                    })()}
                    {/* v37: 観戦マップの名前ラベル（先頭・自分・ライバル・自チームエースのみ）。
                        v45: 最終スプリント演出と同じ「引き出し線＋タグ」方式に統一（判断⑤参照）。 */}
                    {labelIds.has(r.id) && (
                      <RiderNameTag x={0} y={-9} dx={13 + (riderHash01(r.id, 41) - 0.5) * 5} dy={-14 - riderHash01(r.id, 43) * 8}
                        kind={mapTagKind(r)} label={riderTagIcon(mapTagKind(r)) + (r.name ? r.name.split(" ")[0] : "")} scale={1.1} />
                    )}
                  </g>
                );
              })}
            </svg>
            {/* v39.13: コース全体の進捗バー＝縮尺の基準。全長0→100%に対し、今マップが映している範囲(黄枠)と
                先頭/自分/追走の位置を示す。ズームで倍率が変わっても全体のどこを見ているか一目で分かる。 */}
            {(() => {
              const BW = MAP_W, BH = 22, pad = MAP_PAD, w = BW - pad * 2;
              const fx = (f) => pad + Math.max(0, Math.min(1, f)) * w;
              const leadF = ridersUi.length ? Math.max(...ridersUi.map(r => r.frac)) : 0;
              const meR = ridersUi.find(r => r.isPlayer);
              const viewA = fx(cam.start), viewB = fx(Math.min(1, cam.end));
              return (
                <svg viewBox={`0 0 ${BW} ${BH}`} preserveAspectRatio="none" style={{ width: "100%", aspectRatio: `${BW} / ${BH}`, display: "block", marginTop: 3 }}>
                  <rect x={pad} y={BH / 2 - 3} width={w} height="6" rx="3" fill="#2b2f36" />
                  {courseMarkers.map((m, i) => <rect key={"pm" + i} x={fx(m.frac) - 1} y={BH / 2 - 5} width="2" height="10" fill={m.color} opacity="0.8" />)}
                  <rect x={viewA} y="1" width={Math.max(3, viewB - viewA)} height={BH - 2} rx="2" fill="none" stroke={T.color.accent} strokeWidth="1.2" opacity="0.85" />
                  <circle cx={fx(0)} cy={BH / 2} r="2.4" fill="#8a8f98" />
                  <rect x={fx(1) - 1.5} y={BH / 2 - 5} width="3" height="10" fill="#eef1f6" />
                  <circle cx={fx(leadF)} cy={BH / 2} r="3" fill="#ff6b6b" />
                  {meR && <circle cx={fx(meR.frac)} cy={BH / 2} r="3" fill="#27d3ff" stroke="#0E0E10" strokeWidth="0.8" />}
                </svg>
              );
            })()}
          </div>
          <div>
            <div style={{ fontSize: T.size.caption, color: finalSeg ? T.color.bad : T.color.sub }}>{finalSeg ? "ラストスパートズーム — 側面マップ" : "側面マップ（コースの上下の起伏）"}</div>
            <svg viewBox={`0 0 ${MAP_W} ${SIDE_H}`} preserveAspectRatio="none" style={{ ...MAP_BLEED, boxSizing: "border-box", aspectRatio: `${MAP_W} / ${SIDE_H}`, background: terrainBgSide, borderRadius: 8, marginTop: 4, border: finalSeg ? `2px solid ${T.color.bad}` : "2px solid transparent", transition: "background-color 0.6s, border-color 0.2s" }}>
              <polyline points={`${MAP_PAD},${SIDE_H - 4} ${sidePath} ${MAP_W - MAP_PAD},${SIDE_H - 4}`} fill="rgba(255,210,63,0.12)" stroke="none" />
              <polyline points={sidePath} fill="none" stroke="#8a8f98" strokeWidth="16" />
              {ridersUi.map(r => {
                const { dx, dy } = packShape[r.id] || { dx: 0, dy: 0 };
                const attackBonus = r.attackStreak > 0 ? (1 - r.attackStreak / ATTACK_VISUAL_TICKS) * ATTACK_EXAGGERATION : 0;
                const drawFrac = Math.min(1, r.frac + attackBonus);
                return (
                  <g key={r.id} transform={`translate(${mapX(drawFrac + dx, cam.start, cam.end)},${sideYAt(drawFrac) - Math.abs(dy) * 0.6})`}>
                    {camMode === r.id && <circle r="9" fill="none" stroke={T.color.good} strokeWidth="1.5" opacity="0.9" />}
                    {r.mode === "attack" && <circle r="7" fill="none" stroke={T.color.bad} strokeWidth="1.5" opacity="0.85" />}
                    {r.nextPuller && r.mode === "draft" && <circle r={r.isAce ? 6.5 : 5} fill="none" stroke={T.color.accent} strokeWidth="1" strokeDasharray="2,2" opacity="0.7" />}
                    {r.isPlayer && <circle r={r.isAce ? 7 : 5.5} fill="none" stroke="#27d3ff" strokeWidth="1.6" />}
                    <circle r={r.isAce ? 5 : 3.5} fill={r.color} stroke={r.mode === "pull" ? "#fff" : "#0E0E10"} strokeWidth={r.mode === "pull" ? 1.8 : 0.6} />
                    {r.isPlayer && <circle r="1.5" fill="#0E0E10" />}
                    {/* v45: 側面マップにも上と同じ引き出し線タグを追加（従来はラベル自体が無かった） */}
                    {labelIds.has(r.id) && (
                      <RiderNameTag x={0} y={0} dx={13 + (riderHash01(r.id, 41) - 0.5) * 5} dy={-16 - riderHash01(r.id, 43) * 8}
                        kind={mapTagKind(r)} label={riderTagIcon(mapTagKind(r)) + (r.name ? r.name.split(" ")[0] : "")} scale={1.1} />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          {/* v46(UI): 凡例が10px・10項目に膨れ、マップ上に既にテキストで出ている情報まで
              文章で二重に説明していた（CLAUDE.md §7(c)）。「牽引中」「次に牽引」「発射！」等の
              役割は選手のすぐ下に役割バッジとして描かれているので凡例からは削除。集団の
              振る舞いを説明する一文も、見れば分かる内容なので削除した。残したのは
              「どの印が誰か」という、絵だけでは決して分からない対応関係だけ。 */}
          <div style={{ fontSize: T.size.caption, color: T.color.sub, display: "flex", gap: T.space.sm, flexWrap: "wrap" }}>
            <span><span style={{ color: T.color.accent }}>●</span> エース</span>
            <span>○ 自チーム</span>
            <span style={{ color: "#27d3ff" }}>◎ あなた</span>
            <span style={{ color: T.color.bad }}>◎ アタック中</span>
            <span style={{ color: T.color.good }}>◎ カメラ追跡中</span>
          </div>
        </>
      )}
      {hud.comment && (
        <div style={{ background: T.color.surfaceUp, padding: T.space.sm, fontSize: T.size.body, color: T.color.text }}>
          <span style={{ fontSize: T.size.caption, color: T.color.accent }}>実況　</span>{hud.comment}
        </div>
      )}
      {!hud.done && !decision && (
        <div style={{ display: "flex", gap: T.space.sm, alignItems: "center" }}>
          <ChipRow value={speedUi} onChange={nx => { speedRef.current = nx; setSpeedUi(nx); lastRaceSpeed = nx; }}
            options={[0.5, 1, 2, 4, 8].map(v => ({ value: v, label: `×${v}` }))} />
          <div style={{ flex: 1 }}>
            <QuietBtn onClick={() => { skipRef.current = true; if (tickRef.current) tickRef.current(); }}>スキップ</QuietBtn>
          </div>
        </div>
      )}
      {hud.done && <PrimaryBtn onClick={onFinish}>結果を見る</PrimaryBtn>}
    </div>
  );
}
