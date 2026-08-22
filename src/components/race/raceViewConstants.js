// レース観戦（RaceView.jsx）のカメラ・地図・隊列描画で使う定数群と、それを使う純粋な
// ジオメトリ計算ヘルパー（RaceView.jsxから分離。第14弾D）。JSXを持たない。
import { topLateral } from "../../domain/shared/raceViewModel.js";

export const MAP_W = 660, TOP_H = 280, SIDE_H = 150, MAP_PAD = 18;

export const MAP_BLEED = { width: "calc(100% + 28px)", marginLeft: -14, marginRight: -14 };

export const MIN_VIEW_FRAC = 0.035;  // 最大ズーム時に見えるコース幅（集団が固まっている時。v11でさらに拡大）

export const MAX_VIEW_FRAC = 0.4;   // 最大ズームアウト時に見えるコース幅（逃げ等で大きく広がった時）

export const VIEW_LEAD_BIAS = 0.47;  // 集団の中心を画面の何%の位置に置くか（0.5=中央、小さいほど前方の余白が広がる）

export const SPRINT_MIN_VIEW_FRAC = 0.018; // 最終区間突入後のズーム上限（通常のMIN_VIEW_FRACよりさらに狭い）

// v46(#30): 俯瞰マップのカメラ枠を先頭集団に絞るしきい値（frac差）。従来はレースの大半で
// 最後尾まで収めようとして画面が横に伸び過ぎていた（最終区間だけgidベースで絞っていたが、
// それより手前は無条件で全走行中選手が対象だった）。gidではなくfrac差で判定するのは、
// 個人TT等gidが選手ごとに全員バラバラな競技ではgid基準だと1名だけに潰れてしまうため。
export const LEAD_GROUP_FRAC = 0.06;

export const FINAL_SEG_TIME_RATIO = 0.045;

export const CINEMATIC_TIME_RATIO = 0.012;

export const LAUNCH_TIME_RATIO = 0.02;

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

export const SPRINT_CONTENDER_GAP_SEC = 30;  // この秒差以内の選手をスプリント演出の対象にする（v39.2: 拡大。
// 演出の母集団は「直前までカメラが映していた先頭集団(cameraFramingRef)」なので、その集団を厳しく着差で
// 削らず丸ごと見せることで、俯瞰マップで見えていた団子がそのまま最終直線に雪崩れ込む＝集団スプリント感を出す）

export const SPRINT_MAX_CONTENDERS = 22;     // 演出に登場させる選手数の上限（集団スプリントを"団子"に見せるため拡大）

export function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
