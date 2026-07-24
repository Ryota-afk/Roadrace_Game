// レース演出（RaceView）＋エラーバウンダリ＋2D可視化ヘルパー・定数。Phase 3で分離。
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FINISH_COMMENTARY, SEG_COMMENTARY } from "../data/course.js";
import { C, FONT_D, FONT_M } from "../data/theme.js";
import { Btn, Eyebrow } from "./ui.jsx";
import { fmtGap, fmtTime, hasAbility, strHash } from "../core/core.js";
import { TICK_SEC, riderHash01, resumeSim } from "../sim/race.js";

// v39(A案): レース中の「判断カード」スロット定義。注目選手のコース進捗(frac)が at を越えた／
// 状況条件 cond を満たした瞬間に再生を止め、その時点の状況(ctx)に応じて composeCard で選択肢を
// 組み立てて提示する。選んだ move は resumeSim でその地点から結果へ反映される。teamTT等の履歴が
// 無いsimでは出さない。mid/finale は必ず、react は「逃げている／脚が売り切れかけ」の時だけ発火。
export function buildDecisions(course, focusEnt) {
  if (!focusEnt || !focusEnt.posHist || focusEnt.posHist.length < 60) return [];
  const finalStart = (course.cumFrac && course.finalIdx > 0) ? course.cumFrac[course.finalIdx - 1] : 0.85;
  const atFin = Math.min(0.80, Math.max(0.58, finalStart - 0.03));
  const atMid = Math.min(0.5, atFin - 0.15);
  return [
    { id: "mid", at: atMid, kind: "mid" },
    { id: "finale", at: atFin, kind: "finale" },
    // 状況発火：先頭で抜け出している or 脚が売り切れかけの時だけ、専用の一枚を差し込む
    { id: "react", kind: "react", cond: (c) => (c.inBreak && c.frac > 0.5 && c.frac < atFin - 0.02) || (c.energy < 38 && c.frac > 0.45 && c.frac < atFin - 0.02) },
  ];
}

// v39(A案): 判断カードの選択肢を、注目選手の脚質・特性・役割と、その瞬間の地形・状況から組み立てる。
// 「その選手ならでは」の一手（登坂型は登りで、逃げ屋は逃げ、差し脚は最終直線…）を出して race を
// 自分の物語にする。move は RACE_MOVES のキーに対応。選択肢は最大4つに抑える。
export function composeCard(kind, focus, ctx) {
  const A = (id) => hasAbility(focus, id);
  const t = focus.type;
  const onClimb = ["climb", "mtn"].includes(ctx.segType);
  const onHill = ctx.segType === "hill";
  const isAssist = !!focus.isAssisting;
  let title = "", sub = "", choices = [];
  if (kind === "react" && ctx.inBreak) {
    title = "🚀 逃げの選択";
    sub = "先頭で抜け出している——ここからどうする？";
    choices = [
      { move: "attack", label: "🚀 このまま踏み倒す", desc: "逃げ切りを狙い、全開で回し続ける" },
      { move: "conserve", label: "🛡 一度緩めて脚を溜める", desc: "ペースを落として最後まで脚を残す" },
      { move: "hold", label: "🏳 集団に戻す", desc: "無理をやめて集団のペースに戻る" },
    ];
    return { title, sub, choices };
  }
  if (kind === "react") {
    title = "😤 苦しい局面";
    sub = "脚が売り切れかけている——粘るか、立て直すか";
    choices = [
      { move: "hangOn", label: "🦴 食いしばって残る", desc: A("grinder") ? "食らいつく脚で集団にしがみつく" : "歯を食いしばって集団に残る" },
      { move: "conserve", label: "🛡 緩めて立て直す", desc: "一度ペースを落として脚の回復を待つ" },
      { move: "hold", label: "🏳 自分のペースで", desc: "無理をやめて淡々と進む" },
    ];
    return { title, sub, choices };
  }
  if (kind === "mid") {
    title = "⚡ 中盤の判断";
    sub = onClimb ? "登りが牙を剥く。ここが勝負の分かれ目だ" : onHill ? "うねる丘で隊列が動き出した" : "隊列が動き出した。ここでどう動く？";
    // 攻めの一手（地形×脚質×特性で味付け）
    if (onClimb && (t === "CLM" || A("mount") || A("allclimber") || A("climbengine") || A("autumn_sp")))
      choices.push({ move: "attack", label: "⛰ 登りで抜け出す", desc: "登坂適性を武器に単独で飛び出す" });
    else if (onHill && (t === "PUN" || A("puncheur") || A("ardennes_sp")))
      choices.push({ move: "attack", label: "⛰ 丘でアタック", desc: "丘の申し子、パンチ力で抜け出す" });
    else if (A("escape"))
      choices.push({ move: "attack", label: "🚀 得意の逃げに持ち込む", desc: "逃げ屋の脚で集団を突き放す" });
    else
      choices.push({ move: "attack", label: "⚡ 仕掛ける", desc: "単独で飛び出す。決まれば独走、脚を使い切れば失速も" });
    if (A("grinder")) choices.push({ move: "hangOn", label: "🦴 食らいついて粘る", desc: "食らいつく脚で集団に残り、脚を温存する" });
    choices.push({ move: "conserve", label: "🛡 脚を溜める", desc: "集団後方で温存し、勝負所に備える" });
    if (isAssist) choices.push({ move: "assistLaunch", label: "🤝 エースの前で牽く", desc: "自分の脚を使ってエースを勝負所へ運ぶ" });
    else choices.push({ move: "hold", label: "🚴 流れに任せる", desc: "展開に乗って様子を見る" });
    return { title, sub, choices: choices.slice(0, 4) };
  }
  // finale
  title = "🔥 勝負所の判断";
  sub = "ゴールが近い。ここが仕掛けどころだ";
  if (A("kicker") || A("finisher") || A("closer"))
    choices.push({ move: "kickBig", label: "🗡 会心の差し脚", desc: "最終直線、豪脚の切れ味で差し切る" });
  else if (t === "SPR" || A("sprinter_sp"))
    choices.push({ move: "sprintWait", label: "🏁 スプリント勝負", desc: "番手をキープし、集団スプリントで爆発させる" });
  else
    choices.push({ move: "kick", label: "⏳ 差しにかける", desc: "ギリギリまで待ち、最終直線で鋭く伸びる" });
  if (onClimb && (t === "CLM" || A("mount") || A("allclimber")))
    choices.push({ move: "send", label: "🔥 登りで抜け出す", desc: "最後の登りで一気に踏んで独走へ" });
  else if (A("escape"))
    choices.push({ move: "send", label: "🔥 早駆け", desc: "一気に抜け出してゴールまで踏み切る" });
  else
    choices.push({ move: "send", label: "🔥 一気に踏む", desc: "ここから踏み倒して抜け出す" });
  if (isAssist) choices.push({ move: "assistLaunch", label: "🤝 エースを射出", desc: "最終局面、エースのスプリントを援護する" });
  else choices.push({ move: "hold", label: "🚴 集団で勝負", desc: "無理せず集団の決着に合わせる" });
  return { title, sub, choices: choices.slice(0, 4) };
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

export const SPRINT_CONTENDER_GAP_SEC = 30;  // この秒差以内の選手をスプリント演出の対象にする（v39.2: 拡大。
// 演出の母集団は「直前までカメラが映していた先頭集団(cameraFramingRef)」なので、その集団を厳しく着差で
// 削らず丸ごと見せることで、俯瞰マップで見えていた団子がそのまま最終直線に雪崩れ込む＝集団スプリント感を出す）

export const SPRINT_MAX_CONTENDERS = 22;     // 演出に登場させる選手数の上限（集団スプリントを"団子"に見せるため拡大）

export const SPRINT_CINEMATIC_MS = 4200;     // 演出の所要時間（実時間ミリ秒）

export const SPRINT_MAX_SPREAD = 0.42;       // 最大着差の選手がゴールライン手前どこまでで止まるか（0=ライン上、1=スタート地点）

export function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// v39.6: スクロール背景用の剰余ヘルパー（負値でも0..mに収める）
export const cycMod = (v, m) => ((v % m) + m) % m;

// v39.8: カイロソフト風のディメトリック(2:1アイソメ)視点で立って見える1選手スプライト。識別色はジャージ。
// 呼び出し側で足元(接地点)の画面座標(x,y)を渡す。遠近スケールはしない（アイソメ＝どこでも同じ大きさ）。
function IsoRider({ x, y, color, isPlayer, isAce, surging }) {
  const s = isAce ? 1.12 : 1;
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      <ellipse cx="0" cy="0" rx={6.4 * s} ry="2.5" fill="#000" opacity="0.24" />
      {surging && <line x1="8" y1="-5" x2="17" y2="-5" stroke="#fff" strokeWidth="1.3" opacity="0.35" strokeLinecap="round" />}
      {surging && <line x1="8" y1="-9" x2="15" y2="-9" stroke="#fff" strokeWidth="1.1" opacity="0.22" strokeLinecap="round" />}
      <ellipse cx="0" cy="-2.2" rx={6.5 * s} ry="2.4" fill="#1b1e24" />
      <circle cx={-4.6 * s} cy="-2.2" r="2.1" fill="none" stroke="#0e1013" strokeWidth="1.3" />
      <circle cx={4.6 * s} cy="-2.2" r="2.1" fill="none" stroke="#0e1013" strokeWidth="1.3" />
      {isPlayer && <rect x={-5.4 * s} y={-15.5 * s} width={10.8 * s} height={13 * s} rx="4.5" fill="none" stroke="#27d3ff" strokeWidth="1.7" />}
      <rect x={-4.2 * s} y={-14.5 * s} width={8.4 * s} height={11 * s} rx="3.6" fill={color} stroke="#14171d" strokeWidth="1" />
      <circle cx="0" cy={-16.6 * s} r={3 * s} fill="#f2d2a8" stroke="#14171d" strokeWidth="0.8" />
      <path d={`M${-3 * s},${-17.4 * s} a${3 * s},${3 * s} 0 0 1 ${6 * s},0`} fill="#d94f4f" stroke="#14171d" strokeWidth="0.7" />
    </g>
  );
}

// v39.7: バンプ関数（x=0で0、x=Wbで最大1、その先は減衰）。ごぼう抜き/リードアウトの一過性の前後移動に使う。
function sprintBump(x, Wb) { return x > 0 ? (x / Wb) * Math.exp(1 - x / Wb) : 0; }

export function FinalSprintCinematic({ contenders }) {
  const [now, setNow] = useState(() => performance.now());
  const startRef = useRef(performance.now());
  const camRef = useRef(null); // v39.6: 追走カメラの平滑化用（先頭交代時のカメラ移動をなめらかに）
  useEffect(() => {
    let raf;
    const loop = () => { setNow(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  // v39.8(演出刷新): カイロソフト風のディメトリック(2:1アイソメ)視点。タイル状の地面が斜めに広がり、
  // 立ったキャラ(スプライト)が道を進む。カメラは先頭を画面中央に捉えて地面ごとスクロール（＝速度感）。
  // 各選手の kick で「後方から差す/先行して垂れる/独走」を、laneで集団内の位置取りを見せる。遠近拡縮なし。
  const W = 340, H = 178;
  const cx0 = W * 0.46, cy0 = H * 0.44;
  const Px = 23, Py = 11, Lx = 21, Ly = -11;        // アイソメの2軸（進行=右下、レーン=右上）
  const roadHL = 1.15, laneStep = 0.66;             // 道の半幅（レーン単位）／地面タイル1枚のレーン幅
  const n = contenders.length;
  const maxGap = Math.max(0.6, ...contenders.map(c => c.gapSec));
  const bunch = n >= 10;
  const close = maxGap <= 3.2;
  const soloWin = n >= 2 && contenders[1].gapSec >= 4;  // 逃げ切り/独走（2位まで4秒以上）
  const spanGap = Math.min(maxGap, 16);
  const vtStart = -Math.max(1.3, spanGap * 0.5);
  const vtCross = 0.5;
  const exitVt = spanGap + 5.5;
  const t1 = close ? 3.0 : 1.7, t2 = 2.8;
  const el = (now - startRef.current) / 1000;
  let vt, approaching;
  if (el <= t1) { const u = el / t1; vt = vtStart + (vtCross - vtStart) * (close ? easeOutCubic(u) : u); approaching = true; }
  else { const u = Math.min(1, (el - t1) / t2); vt = vtCross + (exitVt - vtCross) * u; approaching = false; }
  const fade = Math.max(0, 1 - el * 3.2);
  // 各選手の道沿い位置 w（大＝前方/ゴール通過側）と lane（道幅内の位置）。ゴールは w=0。gap秒に w=0を通過。
  const wOf = (c) => (vt - c.gapSec) - (c.kick || 0) * 1.0 * sprintBump(c.gapSec - vt, 1.3);
  const laneOf = (c) => {
    const rem = c.gapSec - vt;
    const base = (riderHash01(c.id, 3) - 0.5) * 1.7;
    const conv = 0.55 + 0.45 * Math.max(0, Math.min(1, rem / 2.5));
    const weave = Math.sin(vt * 2.3 + riderHash01(c.id, 9) * 7) * 0.09;
    const passLat = Math.sign(c.kick || 0) * sprintBump(rem, 1.4) * 0.30;   // 差し/リードアウトは横へ膨らんで抜く
    return Math.max(-1.05, Math.min(1.05, base * conv + weave + passLat));
  };
  const withW = contenders.map(c => ({ c, w: wOf(c) }));
  const cand = withW.filter(o => o.w <= 0.12);       // まだゴールを越えていない選手（追走対象の候補）
  const camWTarget = cand.length ? Math.max(...cand.map(o => o.w)) : Math.max(...withW.map(o => o.w));
  if (camRef.current == null) camRef.current = camWTarget;
  camRef.current += (camWTarget - camRef.current) * 0.14;  // 先頭交代時のカメラ移動を滑らかに
  const camW = camRef.current;
  const S = (w, l) => ({ x: cx0 + (w - camW) * Px + l * Lx, y: cy0 + (w - camW) * Py + l * Ly });
  // 地面タイル（芝＋道）をアイソメの菱形で敷き、カメラで無限スクロールさせる
  const a0 = Math.floor(camW) - 6;
  const tiles = [];
  for (let a = a0; a < a0 + 17; a++) for (let b = -3; b <= 3; b++) {
    const lc = b * laneStep; const c0 = S(a, lc);
    if (c0.x < -40 || c0.x > W + 40 || c0.y < -40 || c0.y > H + 40) continue;
    tiles.push({ a, b, lc, road: Math.abs(lc) <= roadHL, c0 });
  }
  const diamond = (w, l, hw = 0.5, hl = laneStep / 2) => {
    const p1 = S(w - hw, l), p2 = S(w, l + hl), p3 = S(w + hw, l), p4 = S(w, l - hl);
    return `${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p3.x.toFixed(1)},${p3.y.toFixed(1)} ${p4.x.toFixed(1)},${p4.y.toFixed(1)}`;
  };
  const finLanes = [-2, -1, 0, 1, 2].map(b => b * laneStep).filter(l => Math.abs(l) <= roadHL + 0.01);
  const gBaseL = S(0, -(roadHL + 0.12)), gBaseR = S(0, roadHL + 0.12);
  const gTopL = { x: gBaseL.x, y: gBaseL.y - 30 }, gTopR = { x: gBaseR.x, y: gBaseR.y - 30 };
  const rows = withW.map(({ c, w }) => ({ c, ...S(w, laneOf(c)), surging: (c.kick || 0) > 0.2 && (c.gapSec - vt) > 0.2 && (c.gapSec - vt) < 2.2 }))
    .filter(r => r.x > -30 && r.x < W + 30 && r.y < H + 40 && r.y > -40)
    .sort((a, b) => (a.y - b.y) || (a.c.isPlayer ? 1 : -1)); // 奥(上)→手前(下)、自分は最前面
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", aspectRatio: `${W} / ${H}`, borderRadius: 8, display: "block", background: "#2b3a30" }}>
        {/* 地面タイル */}
        {tiles.map(t => {
          const dark = (t.a + t.b) & 1;
          const fill = t.road ? (dark ? "#484d56" : "#50555e") : (dark ? "#33473a" : "#3a5040");
          return <polygon key={`t${t.a}_${t.b}`} points={diamond(t.a, t.lc)} fill={fill} stroke="#00000018" strokeWidth="0.5" />;
        })}
        {/* 沿道の柵（道の両脇・整数wごと） */}
        {Array.from({ length: 16 }, (_, i) => a0 + i).map(a => {
          const l = S(a, -(roadHL + 0.28)), r = S(a, roadHL + 0.28);
          if (l.y < -20 || l.y > H + 20) return null;
          return <g key={"fc" + a}><rect x={l.x - 1} y={l.y - 6} width="2" height="6" fill="#5a6f5e" /><rect x={r.x - 1} y={r.y - 6} width="2" height="6" fill="#5a6f5e" /></g>;
        })}
        {/* ゴール：路面の市松ライン＋門＋市松バナー */}
        {finLanes.map((l, i) => <polygon key={"fin" + i} points={diamond(0, l)} fill={i % 2 ? "#e9ecef" : "#14171d"} opacity="0.92" />)}
        <line x1={gBaseL.x} y1={gBaseL.y} x2={gTopL.x} y2={gTopL.y} stroke="#8a8f98" strokeWidth="2.4" />
        <line x1={gBaseR.x} y1={gBaseR.y} x2={gTopR.x} y2={gTopR.y} stroke="#8a8f98" strokeWidth="2.4" />
        {Array.from({ length: 11 }, (_, i) => {
          const t = i / 10, x = gTopL.x + (gTopR.x - gTopL.x) * t, y = gTopL.y + (gTopR.y - gTopL.y) * t;
          const bw = Math.abs(gTopR.x - gTopL.x) / 10 + 0.6;
          return <rect key={"gb" + i} x={x - 0.3} y={y - 5} width={bw} height="8" fill={i % 2 ? "#e9ecef" : "#14171d"} />;
        })}
        {/* 選手（立ったスプライト） */}
        {rows.map(r => <IsoRider key={r.c.id} x={r.x} y={r.y} color={r.c.color} isPlayer={r.c.isPlayer} isAce={r.c.isAce} surging={r.surging} />)}
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: fade, borderRadius: 8, pointerEvents: "none" }} />
      <div style={{ fontSize: 10.5, color: C.sub, textAlign: "center", marginTop: 4 }}>
        {soloWin ? "🏁 独走フィニッシュ" : n > 1 ? (bunch ? `🏁 大集団のゴールスプリント（${n}名）` : "🏁 ゴールスプリント") : "🏁 単独ゴール"}{close && approaching ? " — スロー再生" : ""}
      </div>
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
  const PLAY_DUR = 40;
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
      const who = focusEnt ? focusEnt.name.split(" ")[0] : "";
      const nowP = performance.now();
      // v39.3(演出): 選択に応じた実況＋「山場」演出。攻めの一手はスロー＆当該選手ズームで見せ場に。
      const AGGR = { attack: `⚡ ${who}、ここで仕掛けた！単独で飛び出す！`, send: `🔥 ${who}、勝負を賭けた！一気に踏み込む！` };
      const CALM = {
        conserve: `🛡 ${who}は脚を溜める。勝負所に賭ける構えだ`,
        hangOn: `🦴 ${who}、歯を食いしばって食らいつく！`,
        kick: `⏳ ${who}はギリギリまで待つ。差しにかける狙いだ`,
        kickBig: `🗡 ${who}、会心の差し脚を狙う！`,
        sprintWait: `🏁 ${who}は番手をキープ。ゴールスプリントに懸ける`,
        assistLaunch: `🤝 ${who}がエースを勝負所へ運ぶ！`,
        hold: `📻 ${who}は無理をせず展開に乗る`,
      };
      const line = AGGR[moveId] || CALM[moveId] || `📻 ${who}の判断：「${chosen ? chosen.label : "—"}」`;
      liveRef.current = { text: line, until: nowP + 3400 };
      if (moveId === "attack" || moveId === "send") {
        beatRef.current = { until: nowP + 2600, slow: 0.42, focusId: focusEnt ? focusEnt.id : null };
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
    const focusName = focusEnt ? focusEnt.name.split(" ")[0] : null;
    let prevFocusRank = null, lastFocusSampleAt = 0;
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
        // v11: 最終区間突入後はスプリント演出のため進行を追加で減速（スキップ時は対象外）
        // v39.3(演出): 山場(beat)の間はさらにスロー（決定的瞬間をたっぷり見せる）
        const beatSlow = beatRef.current.until > now ? beatRef.current.slow : 1;
        const slowFactor = (finalSegRef.current ? SPRINT_SLOWDOWN : 1) * beatSlow;
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
      // スキップ中でなく、しきい値frac／状況条件を満たした最初のカードを、その瞬間の状況(ctx)に応じて
      // 組み立てて提示し、再生を止める。
      if (!pausedRef.current && !skipRef.current && !finalSegRef.current && focusId != null && decisions.length) {
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
          };
          const d = decisions.find(dc => !firedRef.current.has(dc.id) && (dc.at != null ? focusR.frac >= dc.at : (dc.cond && dc.cond(ctx))));
          if (d) {
            firedRef.current.add(d.id);
            const card = composeCard(d.kind, focusR.e, ctx);
            decisionRef.current = { id: d.id, fromTick, ...card };
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
        if (beatOn) span = Math.max(MIN_VIEW_FRAC * 0.8, span * 0.6);
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
        // v39.7: ズーム/パンを毎フレーム目標へ補間して滑らかに（従来は倍率が段階的にカクッと切替わっていた）。
        // 追従が遅れて選手が枠外に出ないよう、補間後に選手の広がり[minF,maxF]を必ず含むよう補正する。
        const targetStart = start, targetEnd = end;
        const prev = camSmoothRef.current;
        let ns, ne;
        if (!prev) { ns = targetStart; ne = targetEnd; }
        else {
          const k = 0.16; // 補間の速さ（大きいほど機敏／小さいほどなめらか）
          ns = prev.start + (targetStart - prev.start) * k;
          ne = prev.end + (targetEnd - prev.end) * k;
          const margin = (ne - ns) * 0.04;
          if (minF < ns + margin) ns = minF - margin;
          if (maxF > ne - margin) ne = maxF + margin;
        }
        camSmoothRef.current = { start: ns, end: ne };
        setCam({ start: ns, end: ne });
        cameraFramingRef.current = framing;
      }
      // v39.3(演出): フラムルージュ（残り1km相当）。最終区間の少し手前で一度だけ、スロー＋
      // バナーで「勝負が動く直前」の緊張を作る。先頭が flammeFrac を越えた瞬間に発火。
      if (!flammeRef.current && !finalSegRef.current && leadFrac >= flammeFrac) {
        flammeRef.current = true;
        beatRef.current = { until: now + 2200, slow: 0.5, focusId: null };
        liveRef.current = { text: "🔴 フラムルージュ！残り1km、いよいよ勝負が動く", until: now + 2800 };
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
              return { id: r.e.id, name: r.e.name, color: r.color, isAce: r.e.isAce, isPlayer: isAvatar(r.e), gapSec: r.e.finishTime - winnerTime, kick };
            });
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
          const focusR = riders.find(r => r.e.id === focusId);
          const segT = focusR ? course.segTypeAt(focusR.frac * course.length).type : "flat";
          const terr = ["climb", "mtn"].includes(segT) ? "登りで" : segT === "hill" ? "丘で" : segT === "sprint" ? "スプリントで" : "";
          const soloBreak = focusR && (focusR.mode === "attack" || focusR.mode === "solo") && focusRank === 1;
          if (focusRank != null) {
            if (prevFocusRank != null && now - lastDynCommentAt > 3500) {
              const up = prevFocusRank - focusRank; // 正＝順位を上げた
              if (soloBreak && (beatRef.current.until <= now)) {
                liveRef.current = { text: pick([`🚀 ${focusName}、独走態勢だ！後続を突き放しにかかる`, `🚀 ${focusName}が抜け出した！このまま逃げ切れるか`, `🔥 ${focusName}、一人旅！集団は反応できるか`]), until: now + 2600 }; lastDynCommentAt = now; focusFired = true;
              } else if (focusRank === 1 && prevFocusRank > 1) {
                liveRef.current = { text: pick([`📻 ${focusName}が${terr}先頭に立った！`, `📻 ${focusName}、ついに先頭に躍り出た！`, `📻 先頭は${focusName}だ！`]), until: now + 2600 }; lastDynCommentAt = now; focusFired = true;
              } else if (up >= 4 && focusRank <= 10) {
                liveRef.current = { text: pick([`📻 ${focusName}が${terr}集団を縫って上がってきた！`, `📻 ${focusName}、ぐんぐん順位を上げる！`, `📻 ${focusName}が${terr}前方へポジションを押し上げる`]), until: now + 2600 }; lastDynCommentAt = now; focusFired = true;
              } else if (up <= -5) {
                liveRef.current = { text: pick([`📻 ${focusName}が${terr}遅れ始めた…苦しい展開だ`, `📻 ${focusName}、ペースに乗れず後退…`, `📻 ${focusName}が${terr}千切れかけている！粘れるか`]), until: now + 2600 }; lastDynCommentAt = now; focusFired = true;
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
            liveRef.current = { text: pick(["📻 逃げ吸収！集団は再び一つにまとまった", "📻 メイン集団が逃げを飲み込んだ！振り出しに戻る", "📻 ついに追いついた！集団はひとかたまりに"]), until: now + 2600 }; lastDynCommentAt = now;
          } else if (d >= 4) {
            liveRef.current = { text: pick(["📻 逃げがリードを広げる！メイン集団は反応できるか", "📻 前を行く逃げがぐんぐんタイム差を稼ぐ！", "📻 逃げ切りが見えてきたか、リードは広がる一方だ"]), until: now + 2600 }; lastDynCommentAt = now;
          } else if (d <= -4 && curGapSec > 2) {
            liveRef.current = { text: pick(["📻 メイン集団がペースを上げ、逃げを引き戻しにかかる", "📻 集団が本気だ！タイム差が見る間に縮まる", "📻 追走のペースアップ！逃げグループを射程に捉える"]), until: now + 2600 }; lastDynCommentAt = now;
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
          <Eyebrow color={C.red}>{cinematic.contenders.length > 1 ? (cinematic.contenders.length >= 10 ? "🏁 大集団のゴールスプリント — 最終直線" : "🏁 ゴールスプリント — 最終直線") : "🏁 単独ゴール — 最終直線"}</Eyebrow>
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
