// カイロソフト式敷地画面（BaseView）の純粋なレイアウト計算。JSXを持たない。
// Step13第3弾で新設・Wave D（磨き込み）で全面拡張。
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

// 建物footprint（ダイヤ形：N=(-hw,0) E=(0,+hl) S=(+hw,0) W=(0,-hl)、中心相対）を2:1投影した
// 4頂点(screen座標)のうち、画面Y座標が最大＝カメラに最も近い頂点とその両隣を返す。
// 隣り合う2頂点との間の面が「可視面（手前の壁）」になる（Wave D以前は逆の奥側2面を描画して
// おり、屋根の菱形に隠れてほぼ見えない＝「旗」に見える不具合があった。詳細はDEVLOG §10参照）。
// left/rightは screen x 座標の小さい方をleft・大きい方をrightとして機械的に決める
// （カメラ向きが変わっても常に正しく左右が決まる）。
const DIAMOND_CYCLE = ["N", "E", "S", "W"];
export function visibleFacePair(corners) {
  let front = "N";
  for (const k of DIAMOND_CYCLE) if (corners[k].y > corners[front].y) front = k;
  const i = DIAMOND_CYCLE.indexOf(front);
  const nbrs = [DIAMOND_CYCLE[(i + 3) % 4], DIAMOND_CYCLE[(i + 1) % 4]];
  const [left, right] = corners[nbrs[0]].x <= corners[nbrs[1]].x ? nbrs : [nbrs[1], nbrs[0]];
  return { front, left, right };
}

// 壁面の4頂点（botA-botB-topB-topA）上の任意の点をバイリニア補間で求める。
// u∈[0,1]：botA→botB方向（壁の横方向）、v∈[0,1]：床(0)→天井(1)方向。
// 窓・扉など「壁面に貼り付く矩形」を頂点座標だけから機械的に配置するための共通関数。
export function wallPoint(botA, botB, topA, topB, u, v) {
  const bx = botA.x + (botB.x - botA.x) * u, by = botA.y + (botB.y - botA.y) * u;
  const tx = topA.x + (topB.x - topA.x) * u, ty = topA.y + (topB.y - topA.y) * u;
  return { x: bx + (tx - bx) * v, y: by + (ty - by) * v };
}

// 施設Lv(0〜max)を階数(1〜3)へ変換する。Wave D以前は「建物全体を0.35〜1.0倍にスケール」して
// いたが、footprintごと縮むため小さいLvほど「豆粒」になり読みにくかった。footprintは固定のまま
// 階数を増やす表現へ変更した（クラブハウスはlevelKey=classIdxのため、B1/A/PROがそのまま
// 1階/2階/3階建てに対応する）。
export function buildingFloors(level, max) {
  const clamped = Math.max(0, Math.min(max, level || 0));
  const ratio = max > 0 ? clamped / max : 1;
  if (ratio >= 2 / 3) return 3;
  if (ratio >= 1 / 3) return 2;
  return 1;
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

// 月(MONTHSのindex 0=4月〜11=3月)から四季を導出する。3ヶ月ごとに均等分割：
// 0-2(4,5,6月)=春／3-5(7,8,9月)=夏／6-8(10,11,12月)=秋／9-11(1,2,3月)=冬。
export function seasonOf(month) {
  const m = ((month % 12) + 12) % 12;
  if (m <= 2) return "spring";
  if (m <= 5) return "summer";
  if (m <= 8) return "autumn";
  return "winter";
}

// ---- 角丸オーバル周回路 ----
// 矩形(w:±pathW, l:±pathL)の4隅をcornerRで丸めた周回路上の位置をt∈[0,1)で返す。
// cornerR=0なら旧来の矩形周回路と一致する（直線区間のみ・アークなし）。
function arcPoint(cw, cl, r, startAngle, u) {
  const a = startAngle + u * (Math.PI / 2);
  return { w: cw + r * Math.cos(a), l: cl + r * Math.sin(a) };
}
export function roundedLoopPoint(t, pathW, pathL, cornerR = 0) {
  const r = Math.max(0, Math.min(cornerR, pathW, pathL));
  const tt = ((t % 1) + 1) % 1;
  const sw = 2 * (pathW - r), sl = 2 * (pathL - r), arcLen = (Math.PI / 2) * r;
  const total = 2 * sw + 2 * sl + 4 * arcLen;
  let s = tt * total;
  const segs = [
    { len: sw, fn: (u) => ({ w: -(pathW - r) + u * sw, l: -pathL }) },                 // 奥辺(左→右)
    { len: arcLen, fn: (u) => arcPoint(pathW - r, -pathL + r, r, -Math.PI / 2, u) },   // 右奥コーナー
    { len: sl, fn: (u) => ({ w: pathW, l: -(pathL - r) + u * sl }) },                  // 右辺(奥→手前)
    { len: arcLen, fn: (u) => arcPoint(pathW - r, pathL - r, r, 0, u) },               // 右手前コーナー
    { len: sw, fn: (u) => ({ w: (pathW - r) - u * sw, l: pathL }) },                   // 手前辺(右→左)
    { len: arcLen, fn: (u) => arcPoint(-(pathW - r), pathL - r, r, Math.PI / 2, u) },  // 左手前コーナー
    { len: sl, fn: (u) => ({ w: -pathW, l: (pathL - r) - u * sl }) },                  // 左辺(手前→奥)
    { len: arcLen, fn: (u) => arcPoint(-(pathW - r), -(pathL - r), r, Math.PI, u) },   // 左奥コーナー
  ];
  for (const seg of segs) {
    if (seg.len <= 1e-9) continue;
    if (s <= seg.len) return seg.fn(s / seg.len);
    s -= seg.len;
  }
  const last = segs[segs.length - 1];
  return last.fn(1);
}

// 選手ごとに位相をずらした周回位置。riderHash01(id,41)で初期位相(0〜1)を決定論的に割り振り、
// 経過秒数tSec×speedだけ進める。同じ選手構成なら常に同じ隊列間隔になる。
export function riderLoopPoint(riderId, tSec, speed, pathW, pathL, cornerR = 0) {
  const phase = riderHash01(riderId, 41);
  return roundedLoopPoint(phase + tSec * speed, pathW, pathL, cornerR);
}

// 周回路をn分割した中心線サンプル列。
export function trackCenterline(n, pathW, pathL, cornerR) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(roundedLoopPoint(i / n, pathW, pathL, cornerR));
  return pts;
}

// 地面タイルが属するゾーンを判定する（infield=周回路の内側の芝／track=周回路と重なる帯／
// plaza=周回路のすぐ外側の舗装／outer=それ以遠の外周）。矩形近似のため角丸コーナー付近は
// 粗いが、実際の周回路はTrack成分が別途リボンとして上から描画するため、このゾーン判定の
// 誤差はtrack帯の直下では見えなくなる（infield/plaza/outerの色分けだけが実際に見える）。
export function groundZone(w, l, pathW, pathL, trackHalfWidth, plazaPad) {
  const aw = Math.abs(w), al = Math.abs(l);
  const inTrackBand = aw <= pathW + trackHalfWidth && al <= pathL + trackHalfWidth
    && (aw >= pathW - trackHalfWidth || al >= pathL - trackHalfWidth);
  if (inTrackBand) return "track";
  if (aw < pathW - trackHalfWidth && al < pathL - trackHalfWidth) return "infield";
  if (aw <= pathW + trackHalfWidth + plazaPad && al <= pathL + trackHalfWidth + plazaPad) return "plaza";
  return "outer";
}

// 周回路を帯（リボン）として描くための外側/内側エッジ座標列。中心線の接線から法線方向へ
// halfWidthだけオフセットする。どちらが「外側」かは原点(周回路の中心)からの距離で機械的に
// 判定する（周回路は常に原点中心に配置される設計のため、距離が大きい方=外側という判定が
// 常に成立する。方向ベクトルの回転符号を手で決め打ちしない分、カメラや周回路の形が変わっても
// 崩れない）。
export function trackRibbon(n, pathW, pathL, cornerR, halfWidth) {
  const eps = 1e-4;
  const outer = [], inner = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const p0 = roundedLoopPoint(t - eps, pathW, pathL, cornerR);
    const p1 = roundedLoopPoint(t + eps, pathW, pathL, cornerR);
    let dw = p1.w - p0.w, dl = p1.l - p0.l;
    const len = Math.hypot(dw, dl) || 1;
    dw /= len; dl /= len;
    const nw = -dl, nl = dw; // 接線に垂直な単位法線（符号は下で距離判定して補正）
    const center = roundedLoopPoint(t, pathW, pathL, cornerR);
    const cand1 = { w: center.w + nw * halfWidth, l: center.l + nl * halfWidth };
    const cand2 = { w: center.w - nw * halfWidth, l: center.l - nl * halfWidth };
    const d1 = cand1.w * cand1.w + cand1.l * cand1.l, d2 = cand2.w * cand2.w + cand2.l * cand2.l;
    const [outerPt, innerPt] = d1 >= d2 ? [cand1, cand2] : [cand2, cand1];
    outer.push(outerPt); inner.push(innerPt);
  }
  return { outer, inner };
}
