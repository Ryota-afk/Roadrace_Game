// カイロソフト式敷地画面（BaseView）の純粋なレイアウト計算。JSXを持たない。Step13第3弾。
// FinalSprintCinematic（components/RaceView.jsx）の2:1ディメトリック投影を、固定カメラ・
// 周回路という敷地画面向けの形に一般化した。riderHash01で選手ごとの初期位相を決定論的に
// 割り振るため、同じ選手構成なら常に同じ配置から動き始める（Math.random不使用）。
import { riderHash01 } from "../../sim/race.js";

// world座標(w=奥行き, l=横方向)を2:1ディメトリック投影でSVG画面座標へ変換する。
// FinalSprintCinematicと異なりBaseViewはカメラを動かさないため、camWは呼び出し側が
// 固定値（通常0）を渡す想定（将来のカメラ移動演出に備えて引数として残す）。
export function isoProject(w, l, camW, proj) {
  const { cx0, cy0, Px, Py, Lx, Ly } = proj;
  return { x: cx0 + (w - camW) * Px + l * Lx, y: cy0 + (w - camW) * Py + l * Ly };
}

// 選手が周回する矩形の周回路。t∈[0,1)でループ1周分の位置(w,l)を返す（4辺を均等割り）。
export function loopPathPoint(t, pathW, pathL) {
  const tt = ((t % 1) + 1) % 1; // 負のtも0..1へ正規化
  const seg = Math.min(3, Math.floor(tt * 4));
  const f = tt * 4 - seg;
  if (seg === 0) return { w: -pathW + f * 2 * pathW, l: -pathL }; // 奥辺（左→右）
  if (seg === 1) return { w: pathW, l: -pathL + f * 2 * pathL };   // 右辺（奥→手前）
  if (seg === 2) return { w: pathW - f * 2 * pathW, l: pathL };    // 手前辺（右→左）
  return { w: -pathW, l: pathL - f * 2 * pathL };                  // 左辺（手前→奥）
}

// 選手ごとに位相をずらした周回位置。riderHash01(id,41)で初期位相(0〜1)を決定論的に割り振り、
// 経過秒数tSec×speedだけ進める。同じ選手構成なら常に同じ隊列間隔になる。
export function riderLoopPoint(riderId, tSec, speed, pathW, pathL) {
  const phase = riderHash01(riderId, 41);
  return loopPathPoint(phase + tSec * speed, pathW, pathL);
}

// 施設Lv(0〜max)を建物の表示スケール(0.35〜1.0)へ変換する簡易カーブ。Lv0でも豆粒にはしない。
export function levelScale(lv, max = 5) {
  const clamped = Math.max(0, Math.min(max, lv || 0));
  return 0.35 + (clamped / max) * 0.65;
}

// シーズン状態(g)から各建物スロットのLvを導出する。g自体は変更しない読み取り専用の導出。
export function buildingLevels(g) {
  const equip = g.equip || {};
  const staff = g.staff || {};
  return {
    clubhouse: g.classIdx || 0,                                   // 0=B1 / 1=A / 2=PRO
    training: equip.facility || 0,                                 // 0〜5
    mechanic: Math.max(equip.frame || 0, equip.wheels || 0),       // 0〜5
    medical: Math.max(staff.doctor || 0, staff.manager || 0),      // 0〜3
    scout: staff.scout || 0,                                       // 0〜3
  };
}

// 矩形の周回路の輪郭付近かどうか（地面タイルを「園路」色にするための判定）。
export function isPathTile(w, l, pathW, pathL, band = 0.6) {
  const onVerticalEdge = Math.abs(Math.abs(w) - pathW) <= band && Math.abs(l) <= pathL + band;
  const onHorizontalEdge = Math.abs(Math.abs(l) - pathL) <= band && Math.abs(w) <= pathW + band;
  return onVerticalEdge || onHorizontalEdge;
}
