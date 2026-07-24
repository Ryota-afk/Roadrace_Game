// レース演出（RaceView）＋エラーバウンダリ＋2D可視化ヘルパー・定数。Phase 3で分離。
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FINISH_COMMENTARY, SEG_COMMENTARY } from "../data/course.js";
import { C, FONT_D, FONT_M } from "../data/theme.js";
import { Btn, Eyebrow } from "./ui.jsx";
import { fmtGap, fmtTime, strHash } from "../core/core.js";
import { TICK_SEC, riderHash01, resumeSim } from "../sim/race.js";

// v39(A案): レース中の「判断カード」定義。注目選手のコース進捗(frac)が at を越えた瞬間に再生を止め、
// プレイヤーに選択を提示する。選んだ move は resumeSim でその地点から結果へ反映される。
// 最終区間より手前で発火するよう at をコース形状に合わせて調整し、teamTT等の履歴が無いsimでは出さない。
export function buildDecisions(course, focusEnt) {
  if (!focusEnt || !focusEnt.posHist || focusEnt.posHist.length < 60) return [];
  const finalStart = (course.cumFrac && course.finalIdx > 0) ? course.cumFrac[course.finalIdx - 1] : 0.85;
  const at2 = Math.min(0.80, Math.max(0.58, finalStart - 0.03));
  const at1 = Math.min(0.5, at2 - 0.15);
  return [
    {
      id: "mid", at: at1, title: "⚡ 中盤の判断", sub: "隊列が動き出した。ここでどう動く？",
      choices: [
        { move: "attack", label: "⚡ 仕掛ける", desc: "単独で飛び出す。決まれば独走、脚を使い切れば失速も" },
        { move: "conserve", label: "🛡 脚を溜める", desc: "集団後方で温存し、勝負所に脚を残す" },
        { move: "hold", label: "🚴 流れに任せる", desc: "展開に乗って様子を見る" },
      ],
    },
    {
      id: "finale", at: at2, title: "🔥 勝負所の判断", sub: "ゴールが近い。仕掛けどころだ",
      choices: [
        { move: "send", label: "🔥 早駆け", desc: "一気に抜け出してゴールまで踏み切る" },
        { move: "kick", label: "⏳ 差しにかける", desc: "ギリギリまで待ち、最終直線で鋭く伸びる" },
        { move: "hold", label: "🚴 集団で勝負", desc: "無理せず集団のスプリントに合わせる" },
      ],
    },
  ];
}

export function interpFrac(en, rt, course) {
  const idx = rt / TICK_SEC;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  const len = en.posHist.length;
  if (len === 0) return 0;
  const pos = (en.finished && lo >= len - 1)
    ? course.length
    : (() => {
        const a = en.posHist[Math.min(lo, len - 1)];
        const b = en.posHist[Math.min(hi, len - 1)];
        const t = idx - lo;
        return a + (b - a) * t;
      })();
  return course.fracAtPos(pos);
}

export function modeAt(en, rt) {
  const idx = Math.min(en.modeHist.length - 1, Math.floor(rt / TICK_SEC));
  return idx >= 0 ? en.modeHist[idx] : "draft";
}

export function groupAt(en, rt) {
  const idx = Math.min(en.groupHist.length - 1, Math.floor(rt / TICK_SEC));
  return idx >= 0 ? en.groupHist[idx] : en.id;
}

export function slotAt(en, rt) {
  const idx = Math.min((en.slotHist || []).length - 1, Math.floor(rt / TICK_SEC));
  return idx >= 0 ? (en.slotHist[idx] || 0) : 0;
}

export function modeStreakAt(en, rt, mode, cap) {
  const idx = Math.min(en.modeHist.length - 1, Math.floor(rt / TICK_SEC));
  if (idx < 0 || en.modeHist[idx] !== mode) return 0;
  let n = 0;
  for (let i = idx; i >= 0 && i > idx - cap && en.modeHist[i] === mode; i--) n++;
  return n;
}

export function topLateral(course, frac) {
  return Math.sin(frac * Math.PI * course.f1 + course.ph1) * course.amp1 + Math.sin(frac * course.f2 + course.ph2) * course.amp2;
}

export const MAP_W = 660, TOP_H = 280, SIDE_H = 150, MAP_PAD = 18;

export const MAP_BLEED = { width: "calc(100% + 28px)", marginLeft: -14, marginRight: -14 };

export const MIN_VIEW_FRAC = 0.035;  // 最大ズーム時に見えるコース幅（集団が固まっている時。v11でさらに拡大）

export const MAX_VIEW_FRAC = 0.4;   // 最大ズームアウト時に見えるコース幅（逃げ等で大きく広がった時）

export const VIEW_LEAD_BIAS = 0.42;  // 集団の中心を画面の何%の位置に置くか（0.5=中央、小さいほど前方の余白が広がる）

export const SPRINT_MIN_VIEW_FRAC = 0.018; // 最終区間突入後のズーム上限（通常のMIN_VIEW_FRACよりさらに狭い）

export const FINAL_SEG_TIME_RATIO = 0.045;

export const CINEMATIC_TIME_RATIO = 0.012;

export const LAUNCH_TIME_RATIO = 0.02;

export const SPRINT_SLOWDOWN = 0.4;        // 最終区間突入後、clock進行に掛ける追加の減速係数

export function mapX(f, start, end) { return MAP_PAD + ((f - start) / (end - start)) * (MAP_W - MAP_PAD * 2); }

export const TOP_CURVE_MAX_ANGLE = 0.5; // 道の見た目上の最大傾き（ラジアン）

export function courseAngleAt(course, frac) {
  const range = course.amp1 + course.amp2 || 1;
  return (topLateral(course, frac) / range) * TOP_CURVE_MAX_ANGLE;
}

export function buildTopPath(course, start, end) {
  const N = 60;
  const step = (end - start) / N;
  const pxPerStep = (MAP_W - MAP_PAD * 2) / N;
  const raw = [{ x: 0, y: 0 }];
  let x = 0, y = 0;
  for (let i = 1; i <= N; i++) {
    const f = start + i * step;
    const angle = courseAngleAt(course, f);
    x += Math.cos(angle) * pxPerStep;
    y += Math.sin(angle) * pxPerStep;
    raw.push({ x, y });
  }
  // 画面中央（表示範囲の中点）を基準点とし、そこが選手たちの固定水平帯（TOP_H/2）の
  // ちょうど画面中央に来るよう全体を平行移動する
  const anchorIdx = Math.round(N / 2);
  const anchor = raw[anchorIdx];
  const anchorScreenX = mapX((start + end) / 2, start, end);
  // 縦方向の累積が表示枠からはみ出さないよう、必要な場合のみ一様に縮めて収める
  const allowedY = TOP_H / 2 - 20;
  const maxAbsY = Math.max(1, ...raw.map(p => Math.abs(p.y - anchor.y)));
  const yScale = Math.min(1, allowedY / maxAbsY);
  const path = raw.map(p => `${(anchorScreenX + (p.x - anchor.x)).toFixed(1)},${(TOP_H / 2 + (p.y - anchor.y) * yScale).toFixed(1)}`).join(" ");
  const yAt = (frac) => {
    const clamped = Math.min(end, Math.max(start, frac));
    const idxF = (clamped - start) / step;
    const i0 = Math.max(0, Math.min(N, Math.floor(idxF)));
    const i1 = Math.min(N, i0 + 1);
    const t = idxF - i0;
    const yInterp = raw[i0].y + (raw[i1].y - raw[i0].y) * t;
    return TOP_H / 2 + (yInterp - anchor.y) * yScale;
  };
  return { path, yAt };
}

export function buildSidePath(course, start, end) {
  const maxElev = Math.max(1, ...course.elevationProfile.map(p => p.elev));
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const f = start + t * (end - start);
    const y = SIDE_H - 16 - (course.yAt(f) / maxElev) * (SIDE_H - 32);
    pts.push(`${(MAP_PAD + t * (MAP_W - MAP_PAD * 2)).toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

export const DROP_TRANSITION_TICKS = 6; // 千切れ直後、集団後方へ寄っていく演出の長さ（tick数）

export const DROP_EXTRA_LANE = 7;       // 千切れ演出の最大オフセット（横方向、SVG px）

export const DROP_EXTRA_DX_RATIO = 0.03; // 千切れ演出の最大オフセット（前後方向、現在のカメラ幅spanに対する比率）

export const ATTACK_VISUAL_TICKS = 8;   // アタック開始直後、前方への誇張演出の長さ（tick数）

export const ATTACK_EXAGGERATION = 0.014; // アタック演出の最大frac誇張量

export const PACK_LEN_BASE = 0.028;      // 縦方向の広がりの基準値（現在のカメラ幅spanに対する比率）

export const PACK_LEN_PER_MEMBER = 0.003; // 縦方向の広がり：グループの人数1人あたりの増分（比率）

export const PACK_WIDTH_BASE = 6;       // 横方向の広がりの基準値（SVG px）

export const PACK_WIDTH_PER_MEMBER = 1.1; // 横方向の広がり：グループの人数1人あたりの増分（SVG px）

export const PACK_MAX_MEMBERS_FOR_SCALE = 10; // 広がりの拡大が頭打ちになる人数

export const ELONGATION_BY_SEG = { flat: 0.15, hill: 0.45, climb: 0.7, mtn: 0.8, sprint: 0.85, tt: 0.6 };

export const PACK_TILT_MAX_RAD = 0.7; // 横風エシュロン時の隊列の傾き（約40度）

export const PACK_BIAS_EASE = 0.06;    // 前後バイアス（誰が前寄りか）が新しいslotへ追従する速さ（毎フレーム）

export const PACK_ELONG_EASE = 0.035;

export const PACK_WANDER_FREQ_X = 0.16; // 独立揺らぎの基準周波数（Hz、前後方向）

export const PACK_WANDER_FREQ_Y = 0.12; // 独立揺らぎの基準周波数（Hz、左右方向）

export function riderWander(id, salt, tSec, baseFreq) {
  const h1 = riderHash01(id, salt), h2 = riderHash01(id, salt + 1);
  const f1 = baseFreq * (0.6 + h1 * 0.8);
  const f2 = f1 * (1.7 + h2 * 0.6);
  return 0.65 * Math.sin(tSec * f1 * Math.PI * 2 + h1 * Math.PI * 2)
       + 0.35 * Math.sin(tSec * f2 * Math.PI * 2 + h2 * Math.PI * 2);
}

export const SPRINT_CONTENDER_GAP_SEC = 12;  // この秒差以内の選手をスプリント演出の対象にする

export const SPRINT_MAX_CONTENDERS = 8;      // 演出に登場させる選手数の上限

export const SPRINT_CINEMATIC_MS = 4200;     // 演出の所要時間（実時間ミリ秒）

export const SPRINT_MAX_SPREAD = 0.42;       // 最大着差の選手がゴールライン手前どこまでで止まるか（0=ライン上、1=スタート地点）

export function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

export function FinalSprintCinematic({ contenders }) {
  const [now, setNow] = useState(() => performance.now());
  const startRef = useRef(performance.now());
  useEffect(() => {
    let raf;
    const loop = () => { setNow(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const t = Math.min(1, (now - startRef.current) / SPRINT_CINEMATIC_MS);
  const eased = easeOutCubic(t);
  const maxGap = Math.max(0.5, ...contenders.map(c => c.gapSec));
  const W = 200, H = 300, topY = 34, bottomY = H - 18;
  const fadeOpacity = Math.max(0, 1 - t * 5); // 冒頭の暗転からのフェードイン
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 300, background: "linear-gradient(#3f5a3a,#26361f)", borderRadius: 8, display: "block" }}>
        <line x1={W / 2} y1={topY - 14} x2={W / 2} y2={H} stroke="#8a8f98" strokeWidth="70" strokeLinecap="round" />
        <line x1={W / 2 - 44} y1={topY} x2={W / 2 + 44} y2={topY} stroke="#fff" strokeWidth="4" strokeDasharray="6,4" />
        <text x={W / 2} y={topY - 18} textAnchor="middle" fontSize="16">🏁</text>
        {contenders.map((c, i) => {
          const finalPos = 1 - Math.min(1, c.gapSec / maxGap) * SPRINT_MAX_SPREAD;
          const y = bottomY - finalPos * eased * (bottomY - topY);
          const wobble = Math.sin(now / 260 + i * 1.7) * (1 - eased) * 9;
          const x = W / 2 + (i - (contenders.length - 1) / 2) * 11 + wobble;
          return (
            <g key={c.id} transform={`translate(${x},${y})`}>
              {c.isPlayer && <circle r={c.isAce ? 10.5 : 8.5} fill="none" stroke="#27d3ff" strokeWidth="2" />}
              <circle r={c.isAce ? 8 : 6} fill={c.color} stroke="#14171d" strokeWidth="1.5" />
              {c.isPlayer && <circle r="2.2" fill="#14171d" />}
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: fadeOpacity, borderRadius: 8, pointerEvents: "none" }} />
      <div style={{ fontSize: 10.5, color: C.sub, textAlign: "center", marginTop: 4 }}>{contenders.length > 1 ? "🏁 ゴールスプリント" : "🏁 単独ゴール"}</div>
    </div>
  );
}

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
        <div style={{ display: "grid", gap: 12, padding: 16, background: C.panel, borderRadius: 12, border: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: FONT_D, fontSize: 15, color: C.yellow, fontWeight: 700 }}>🏁 レースは終了しました</div>
          <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6 }}>
            レース中継の描画で問題が発生しましたが、着順・記録はすでに確定しています。
            そのまま結果画面へお進みください（進行への影響はありません）。
          </div>
          <Btn onClick={this.props.onRecover}>結果を見る →</Btn>
        </div>
      );
    }
    return this.props.children;
  }
}

// v38(改善#1): 観戦の再生速度をレースをまたいで記憶する（毎回×1にリセットされる退屈を解消）。
// モジュールレベルの変数なのでRaceViewの再マウント（次のレース）でも保持される。
let lastRaceSpeed = 2;
export function RaceView({ sim, onFinish }) {
  // v37: マイライフは自チーム選手も team==="PLAYER" に統一したため、「操作アバター＝あなた本人」は
  // isPlayerChar で判定する（シーズンは単一アバターが無いので従来どおり team==="PLAYER"＝自チーム）。
  const hasAvatar = sim.entrants.some(e => e.isPlayerChar);
  const isAvatar = (e) => hasAvatar ? !!e.isPlayerChar : (e.team === "PLAYER");
  const [hud, setHud] = useState({ top: [], seg: "", clock: 0, done: false, comment: "", gap: null });
  const [ridersUi, setRidersUi] = useState([]);
  const [cam, setCam] = useState({ start: 0, end: MIN_VIEW_FRAC });
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
  const PLAY_DUR = 40;
  const course = sim.course;

  // v39(A案): レース中の判断カード。注目選手（マイライフ＝本人／シーズン＝エース）の展開に
  // 割り込んで再生を止め、選択を結果へ反映する。paused中はclockを進めず、選択後に resumeSim で
  // fromTick以降を作り直してから再生を継続する（rtが飛ばないよう clock を張り直す）。
  const focusEnt = useMemo(() =>
    sim.entrants.find(e => e.isPlayerChar)
    || sim.entrants.find(e => e.team === "PLAYER" && e.isAce)
    || sim.entrants.find(e => e.team === "PLAYER"), [sim]);
  const decisions = useMemo(() => buildDecisions(course, focusEnt), [sim]);
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
      liveRef.current = { text: `📻 あなたの判断：「${chosen ? chosen.label.replace(/^[^ぁ-んァ-ヶ一-龠]+/, "").trim() || chosen.label : "—"}」`, until: performance.now() + 3200 };
      decisionRef.current = null;
      setDecision(null);
      setResimBusy(false);
      pausedRef.current = false;
      if (tickRef.current) tickRef.current();
    }, 30);
  };

  // v11: カメラの選手フィーチャー切替（自チーム選手のみ対象、結果ロック後も切替は常に可能）
  const playerRoster = useMemo(() => sim.entrants.filter(e => e.team === "PLAYER"), [sim]);
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
    // 選手固有の独立した揺らぎ（前後・左右とも他の選手とは違う周波数・位相）
    const wanderX = riderWander(r.id, 1, packTSec, PACK_WANDER_FREQ_X);
    const wanderY = riderWander(r.id, 5, packTSec, PACK_WANDER_FREQ_Y);
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
    ridersUi.forEach(r => { if (r.isPlayer || r.isRival || (r.isMyTeam && r.isAce)) set.add(r.id); });
    return set;
  })();

  useEffect(() => {
    const riders = sim.entrants.map((e) => ({
      e, frac: 0, mode: "draft", gid: e.id, slot: 0, dropStreak: 0, attackStreak: 0,
      // v12: エースのみ黄色を使い、他のAI含む何色とも被らないようにする。
      // 自チームのアシストは白系（他チームは赤/青/紫/橙）で「自分のチーム」だと一目でわかるようにする
      color: e.team === "PLAYER" ? (e.isAce ? C.yellow : "#eef1f6") : e.color,
      biasX: -0.3, // v12: 前後バイアス（誰が前寄りか）。slotに応じて緩やかに追従する永続値
      elong: ELONGATION_BY_SEG.flat, tilt: 0, // v12バグ修正: 隊列の伸び・傾きも同様に緩やかに追従させる
    }));

    totalRef.current = Math.max(...sim.entrants.map(e => e.finishTime));
    const baseEvents = [];
    course.segs.forEach((s, j) => {
      const fracStart = j === 0 ? 0 : course.cumFrac[j - 1];
      if (s.wind) {
        baseEvents.push({ t: fracStart, text: `🌬 ${s.label}：横風区間！エシュロンで集団が分断されるか` });
        return;
      }
      // v27: 区間タイプごとの実況パターンから決定的に1つ選ぶ（区間indexで循環）
      const pool = SEG_COMMENTARY[s.type];
      const line = pool ? pool[j % pool.length] : `${s.label}へ突入！`;
      baseEvents.push({ t: fracStart, text: `🎙 ${line}` });
    });
    baseEvents.push({ t: 0.985, text: FINISH_COMMENTARY[Math.floor(strHash(sim.raceMeta.name || "x") % FINISH_COMMENTARY.length)] });
    // v27: 実況の動的イベント検知用の状態（逃げとメインのギャップ変化を追う）
    let prevGapSec = null, lastDynCommentAt = 0;
    // v35(UI): 注目選手（マイライフ＝プレイヤー本人／シーズン＝自チームのエース）を名指しで実況する。
    // 順位の急変・先頭浮上・遅れを検知して、レースを「自分の物語」として盛り上げる。
    const focusId = focusEnt ? focusEnt.id : null;
    const focusName = focusEnt ? focusEnt.name : null;
    let prevFocusRank = null, lastFocusSampleAt = 0;

    clockRef.current = 0;
    firedRef.current = new Set();
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
        // v11: 最終区間突入後はスプリント演出のため進行を追加で減速（スキップ時は対象外）
        const slowFactor = finalSegRef.current ? SPRINT_SLOWDOWN : 1;
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
      // スキップ中でなく、しきい値fracを越えた最初のカードを提示して再生を止める。
      if (!pausedRef.current && !skipRef.current && !finalSegRef.current && focusId != null && decisions.length) {
        const focusR = riders.find(r => r.e.id === focusId);
        if (focusR && rt < focusR.e.finishTime) {
          const d = decisions.find(dc => !firedRef.current.has(dc.id) && focusR.frac >= dc.at);
          if (d) {
            firedRef.current.add(d.id);
            const fromTick = Math.max(1, Math.min(focusR.e.posHist.length - 1, Math.floor(rt / TICK_SEC)));
            decisionRef.current = { ...d, fromTick };
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
              liveRef.current = { text: "📻 フィーチャー選手がゴール、先頭集団表示に切替", until: performance.now() + 3000 };
            }
          } else {
            const sameGroup = riders.filter(r => r.gid === focus.gid);
            if (sameGroup.length > 0) framing = sameGroup;
          }
        }
        // v11: 最終区間突入後、先頭集団追従モードに限り先頭集団（最高fracと同じgid）だけに絞り、
        // スプリント勝負に寄せる（選手フィーチャー中はその選手の集団のまま）
        if (finalSegRef.current && camModeRef.current === "lead") {
          const leadGid = framing.reduce((best, r) => (r.frac > best.frac ? r : best), framing[0]).gid;
          const leadOnly = framing.filter(r => r.gid === leadGid);
          if (leadOnly.length > 0) framing = leadOnly;
        }
        const fracs = framing.map(r => r.frac);
        const maxF = Math.max(...fracs), minF = Math.min(...fracs);
        const spreadF = maxF - minF;
        const center = (maxF + minF) / 2;
        let span = Math.min(MAX_VIEW_FRAC, Math.max(MIN_VIEW_FRAC, spreadF * 1.6));
        if (finalSegRef.current) span = Math.min(span, SPRINT_MIN_VIEW_FRAC);
        // v12バグ修正: 逃げとメイン集団の差が開きMAX_VIEW_FRAC（最大ズームアウト幅）を
        // 超えると、上のMath.minでspanが実際に必要な幅より狭く決まってしまい、
        // 「先頭集団」カメラで追っているはずの選手がキャンバス範囲外（画面右側など）に
        // 押し出されて見えなくなるバグがあった。安全マージンを削ってでも全員が必ず
        // 表示範囲に収まるよう、実際の広がりを下回らない値まで引き上げる
        span = Math.max(span, spreadF + 0.01);
        let start = center - span * VIEW_LEAD_BIAS;
        let end = start + span;
        if (start < 0) { start = 0; end = Math.min(1, span); }
        // v11: 意図的にend>1をクランプしない。MAX_TICKS到達により選手のfracは実際には
        // ちょうど1.0までは届かない（数%手前で打ち切られる）ため、endを無理に1へスナップさせると
        // 実際の先頭選手とゴールフラッグの間に不自然な空白ができてしまう。end>1のままにしておけば
        // フラッグは（実際の先頭選手との距離に応じて）自然に画面の内側寄りに表示される
        setCam({ start, end });
        cameraFramingRef.current = framing;
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
          liveRef.current = { text: "🏁 ラストスパート突入！カメラをズームして追跡します", until: now + 3000 };
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
          // カメラが実際に映していた集団（cameraFramingRef）に限定する。これにより、
          // 先頭集団を追っていればその先頭集団のまま、選手フィーチャー中ならその選手の
          // 集団のまま、演出に切り替わっても顔ぶれが変わらなくなる
          const pool = (cameraFramingRef.current && cameraFramingRef.current.length > 0) ? cameraFramingRef.current : riders;
          const sortedByFinish = [...pool].sort((a, b) => a.e.finishTime - b.e.finishTime);
          const winnerTime = sortedByFinish[0].e.finishTime;
          const contenders = sortedByFinish
            .filter(r => r.e.finishTime - winnerTime < SPRINT_CONTENDER_GAP_SEC)
            .slice(0, SPRINT_MAX_CONTENDERS)
            .map(r => ({ id: r.e.id, name: r.e.name, color: r.color, isAce: r.e.isAce, isPlayer: isAvatar(r.e), gapSec: r.e.finishTime - winnerTime }));
          setCinematic({ contenders });
        }
      }
      setRidersUi(riders.map(r => ({
        id: r.e.id, frac: r.frac, mode: r.mode, color: r.color, isAce: r.e.isAce, isPlayer: isAvatar(r.e),
        gid: r.gid, slot: r.slot, dropStreak: r.dropStreak, attackStreak: r.attackStreak, biasX: r.biasX,
        elong: r.elong, tilt: r.tilt,
        // v37: 観戦マップに名前ラベルを出すため、選手名と識別フラグを持たせる
        name: r.e.name, isRival: !!(r.e.isRival || r.e.isRival2), isMyTeam: r.e.team === "PLAYER",
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
        for (let j = 0; j < course.segs.length; j++) { if (leadFrac <= course.cumFrac[j] + 1e-6) { segLabel = course.segs[j].label; break; } }
        // ライブギャップ表示（逃げ集団 vs 追走）：先頭グループと2番手グループの位置差を秒換算
        let gapText = null;
        const gidSet = [...new Set(sorted.map(r => r.gid))];
        let curGapSec = null;
        if (sim.groupMode !== "solo" && gidSet.length > 1) {
          const leadG = sorted[0].gid;
          const chaseR = sorted.find(r => r.gid !== leadG);
          if (chaseR) {
            curGapSec = Math.max(0, Math.round((sorted[0].frac - chaseR.frac) * totalRef.current));
            gapText = `逃げとメインのギャップ：約${curGapSec}秒`;
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
          if (focusRank != null) {
            if (prevFocusRank != null && now - lastDynCommentAt > 3500) {
              const up = prevFocusRank - focusRank; // 正＝順位を上げた
              if (focusRank === 1 && prevFocusRank > 1) {
                liveRef.current = { text: `📻 ${focusName}が先頭に立った！`, until: now + 2600 }; lastDynCommentAt = now; focusFired = true;
              } else if (up >= 4 && focusRank <= 8) {
                liveRef.current = { text: `📻 ${focusName}が集団を縫って前へ上がってきた！`, until: now + 2600 }; lastDynCommentAt = now; focusFired = true;
              } else if (up <= -5) {
                liveRef.current = { text: `📻 ${focusName}が遅れ始めた…苦しい展開だ`, until: now + 2600 }; lastDynCommentAt = now; focusFired = true;
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
            liveRef.current = { text: "📻 逃げ吸収！集団は再び一つにまとまった", until: now + 2600 }; lastDynCommentAt = now;
          } else if (d >= 4) {
            liveRef.current = { text: "📻 逃げがリードを広げる！メイン集団は反応できるか", until: now + 2600 }; lastDynCommentAt = now;
          } else if (d <= -4 && curGapSec > 2) {
            liveRef.current = { text: "📻 メイン集団がペースを上げ、逃げを引き戻しにかかる", until: now + 2600 }; lastDynCommentAt = now;
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
        setHud({ top, seg: segLabel, clock: rt, done: isDone, comment, gap: gapText, lap });
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

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ background: C.panel2, borderLeft: `4px solid ${C.yellow}`, borderRadius: 6, padding: "6px 10px" }}>
          <div style={{ fontFamily: FONT_D, fontSize: 12, color: C.yellow }}>{hud.seg}{hud.lap ? `（${hud.lap}/${sim.course.laps}周）` : ""}</div>
          <div style={{ fontFamily: FONT_M, fontSize: 14, color: C.text }}>{fmtTime(hud.clock)}</div>
          {hud.gap && <div style={{ fontFamily: FONT_M, fontSize: 10.5, color: C.green, marginTop: 2 }}>{hud.gap}</div>}
        </div>
        <div style={{ background: C.panel2, borderRadius: 6, padding: "6px 10px", minWidth: 165 }}>
          {hud.top.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
              <span style={{ color: r.isPlayer ? C.yellow : (r.team === "PLAYER" ? "#bfe3ff" : C.text) }}>{i + 1}. {r.name}{r.isPlayer ? " 🚴" : (r.team === "PLAYER" ? " ●" : "")}</span>
              <span style={{ fontFamily: FONT_M, color: r.isPlayer ? C.yellow : C.sub }}>{fmtGap(r.gap)}</span>
            </div>
          ))}
        </div>
      </div>
      {/* v39(A案): レース中の判断カード。表示中は再生が止まり、選ぶと結果に反映される */}
      {decision && (
        <div style={{ background: "linear-gradient(180deg,#2a2018,#1c1712)", border: `2px solid ${C.yellow}`, borderRadius: 12, padding: "12px 14px", boxShadow: "0 4px 18px rgba(0,0,0,0.4)" }}>
          <div style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 800, color: C.yellow }}>{decision.title}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2, marginBottom: 10 }}>{decision.sub}{focusEnt ? `　—　${focusEnt.name}` : ""}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {decision.choices.map((c) => (
              <button key={c.move} disabled={resimBusy} onClick={() => resolveDecision(c.move)}
                style={{
                  textAlign: "left", padding: "9px 12px", borderRadius: 8, cursor: resimBusy ? "default" : "pointer",
                  background: C.panel2, color: C.text, border: `1px solid ${C.line}`, opacity: resimBusy ? 0.5 : 1,
                  display: "grid", gap: 2,
                }}>
                <span style={{ fontFamily: FONT_D, fontSize: 13.5, fontWeight: 700, color: C.text }}>{c.label}</span>
                <span style={{ fontSize: 11, color: C.sub }}>{c.desc}</span>
              </button>
            ))}
          </div>
          {resimBusy && <div style={{ fontSize: 11, color: C.yellow, marginTop: 8 }}>展開を再計算中…</div>}
        </div>
      )}
      {!cinematic && !decision && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[{ id: "lead", label: "🎥 先頭集団" }, ...playerRoster.map(e => ({ id: e.id, label: `🎥 ${e.name.split(" ")[0]}${e.isAce ? " 👑" : ""}` }))].map(o => (
          <button key={o.id} onClick={() => selectCam(o.id)}
            style={{
              padding: "4px 8px", borderRadius: 12, fontSize: 10.5, fontWeight: 700, fontFamily: FONT_D, cursor: "pointer",
              background: camMode === o.id ? C.yellow : C.panel2, color: camMode === o.id ? "#14171d" : C.sub,
              border: `1px solid ${camMode === o.id ? C.yellow : C.line}`,
            }}>{o.label}</button>
        ))}
      </div>}
      {cinematic ? (
        <div>
          <Eyebrow color={C.red}>{cinematic.contenders.length > 1 ? "🏁 ゴールスプリント — 最終直線" : "🏁 単独ゴール — 最終直線"}</Eyebrow>
          <FinalSprintCinematic contenders={cinematic.contenders} />
        </div>
      ) : (
        <>
          <div>
            <Eyebrow color={finalSeg ? C.red : C.sub}>{finalSeg ? "🏁 ラストスパートズーム — 俯瞰マップ" : "俯瞰マップ（コースの左右の揺れ）"}</Eyebrow>
            <svg viewBox={`0 0 ${MAP_W} ${TOP_H}`} preserveAspectRatio="none" style={{ ...MAP_BLEED, boxSizing: "border-box", aspectRatio: `${MAP_W} / ${TOP_H}`, background: "#3f5a3a", borderRadius: 8, marginTop: 4, border: finalSeg ? `2px solid ${C.red}` : "2px solid transparent", transition: "border-color 0.2s" }}>
              {/* v12: 集団の2次元的な広がり（団子状〜エシュロン時の斜め隊列）に対して
                  道幅が狭すぎて選手がはみ出て見える問題を修正するため大幅に拡張。
                  さらに拡張してほしいという追加フィードバックを繰り返し受け再拡大。
                  v14.4: 固定height指定とviewBoxの縦横比が食い違い、画面幅次第で
                  横方向に伸縮するアスペクト比崩れが発生していたため、CSSのaspect-ratio
                  でviewBoxと同じ比率を強制する形に修正（あわせて道幅もさらに拡大） */}
              <polyline points={topPath} fill="none" stroke="#8a8f98" strokeWidth="190" strokeLinecap="round" />
              <polyline points={topPath} fill="none" stroke="#7a7f88" strokeWidth="1" strokeDasharray="6,5" opacity="0.5" />
              <circle cx={mapX(1, cam.start, cam.end)} cy={riderTopY(1, 0)} r="4" fill={C.red} />
              {/* v12（簡易リードアウト演出）：自チームのアシストがエースを牽引中なら線で結ぶ */}
              {playerLeadout && (() => {
                const p1 = packPoint(playerLeadout), p2 = packPoint(playerAce);
                return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={C.yellow} strokeWidth="1.2" strokeDasharray="3,2" opacity="0.65" />;
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
                    {camMode === r.id && <circle r="10" fill="none" stroke={C.green} strokeWidth="1.5" opacity="0.9" />}
                    {isLaunching && (
                      <circle r="9" fill="none" stroke={C.yellow} strokeWidth="2" opacity="0.9">
                        <animate attributeName="r" values="7;11;7" dur="0.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.9;0.3;0.9" dur="0.8s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {r.mode === "attack" && <circle r="8" fill="none" stroke={C.red} strokeWidth="1.5" opacity="0.85" />}
                    {r.slot === 1 && r.mode === "draft" && <circle r={r.isAce ? 7.5 : 6} fill="none" stroke={C.yellow} strokeWidth="1" strokeDasharray="2,2" opacity="0.7" />}
                    {/* v29バグ修正: 自分がエースでない（白マーカー）ときにアシスト仲間と見分けが
                        つかないという指摘に対応。自分の印には常に水色の識別リングを重ね、
                        エースかどうかに関わらず一目で自分だとわかるようにする */}
                    {r.isPlayer && <circle r={r.isAce ? 8 : 6.5} fill="none" stroke="#27d3ff" strokeWidth="1.8" />}
                    <circle r={r.isAce ? 5.5 : 4} fill={r.color} stroke={r.mode === "pull" ? "#fff" : "#14171d"} strokeWidth={r.mode === "pull" ? 2 : 0.75} />
                    {r.isPlayer && <circle r="1.7" fill="#14171d" />}
                    {/* v37: 観戦マップの名前ラベル（先頭・自分・ライバル・自チームエースのみ） */}
                    {labelIds.has(r.id) && (
                      <text y={-9} textAnchor="middle" fontSize="9" paintOrder="stroke" stroke="#14171d" strokeWidth="2.4"
                        fill={r.isPlayer ? C.yellow : r.isRival ? "#ff6b6b" : r.isMyTeam ? "#7db8ff" : "#eef0f5"}
                        style={{ fontWeight: r.isPlayer ? 800 : 600 }}>
                        {(r.isPlayer ? "🚴" : r.isRival ? "🔥" : "") + (r.name ? r.name.split(" ")[0] : "")}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div>
            <Eyebrow color={finalSeg ? C.red : C.sub}>{finalSeg ? "🏁 ラストスパートズーム — 側面マップ" : "側面マップ（コースの上下の起伏）"}</Eyebrow>
            <svg viewBox={`0 0 ${MAP_W} ${SIDE_H}`} preserveAspectRatio="none" style={{ ...MAP_BLEED, boxSizing: "border-box", aspectRatio: `${MAP_W} / ${SIDE_H}`, background: "#232a20", borderRadius: 8, marginTop: 4, border: finalSeg ? `2px solid ${C.red}` : "2px solid transparent", transition: "border-color 0.2s" }}>
              <polyline points={`${MAP_PAD},${SIDE_H - 4} ${sidePath} ${MAP_W - MAP_PAD},${SIDE_H - 4}`} fill="rgba(255,210,63,0.12)" stroke="none" />
              <polyline points={sidePath} fill="none" stroke="#8a8f98" strokeWidth="16" />
              {ridersUi.map(r => {
                const { dx, dy } = packShape[r.id] || { dx: 0, dy: 0 };
                const attackBonus = r.attackStreak > 0 ? (1 - r.attackStreak / ATTACK_VISUAL_TICKS) * ATTACK_EXAGGERATION : 0;
                const drawFrac = Math.min(1, r.frac + attackBonus);
                return (
                  <g key={r.id} transform={`translate(${mapX(drawFrac + dx, cam.start, cam.end)},${sideYAt(drawFrac) - Math.abs(dy) * 0.6})`}>
                    {camMode === r.id && <circle r="9" fill="none" stroke={C.green} strokeWidth="1.5" opacity="0.9" />}
                    {r.mode === "attack" && <circle r="7" fill="none" stroke={C.red} strokeWidth="1.5" opacity="0.85" />}
                    {r.slot === 1 && r.mode === "draft" && <circle r={r.isAce ? 6.5 : 5} fill="none" stroke={C.yellow} strokeWidth="1" strokeDasharray="2,2" opacity="0.7" />}
                    {r.isPlayer && <circle r={r.isAce ? 7 : 5.5} fill="none" stroke="#27d3ff" strokeWidth="1.6" />}
                    <circle r={r.isAce ? 5 : 3.5} fill={r.color} stroke={r.mode === "pull" ? "#fff" : "#14171d"} strokeWidth={r.mode === "pull" ? 1.8 : 0.6} />
                    {r.isPlayer && <circle r="1.5" fill="#14171d" />}
                  </g>
                );
              })}
            </svg>
          </div>
          <div style={{ fontSize: 10, color: C.sub, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>● 黄色＝エース</span><span>○ 白＝自チームのアシスト</span><span style={{ color: "#27d3ff" }}>◎ 水色リング＝あなた</span><span>白縁＝牽引中</span><span style={{ color: C.red }}>◎ 赤丸＝アタック中</span>
            <span style={{ color: C.yellow }}>点線＝次に牽引予定</span><span style={{ color: C.green }}>◎ 緑丸＝カメラで追跡中の選手</span>
            <span style={{ color: C.yellow }}>黄線＝アシストがエースを牽引中</span><span style={{ color: C.yellow }}>点滅リング＝エース発射</span>
            <span>選手はそれぞれ独立して集団内を漂う（巡航時は団子状、高強度区間ほど縦に伸びる）／中心から離れて動かなくなったら千切れかけ</span>
          </div>
        </>
      )}
      {hud.comment && (
        <div style={{ background: C.panel2, borderRadius: 6, padding: "6px 10px", fontSize: 13, color: C.text }}>
          {hud.comment}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        {!hud.done && !decision && (<>
          <Btn small outline color={C.text} onClick={() => { const nx = speedUi >= 8 ? 1 : speedUi * 2; speedRef.current = nx; setSpeedUi(nx); lastRaceSpeed = nx; }}>×{speedUi}</Btn>
          <Btn small outline color={C.text} onClick={() => { skipRef.current = true; if (tickRef.current) tickRef.current(); }}>スキップ</Btn>
        </>)}
        {hud.done && <Btn small onClick={onFinish}>結果を見る →</Btn>}
      </div>
    </div>
  );
}
