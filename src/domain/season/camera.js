// BaseView（敷地画面）の2Dカメラ（ズーム/パン）の純粋計算。JSXもReactも持たない。Step13 Wave E-1。
//
// 座標系は3層ある：
//  1. world座標 (w,l) …… 敷地の論理座標
//  2. scene座標 (x,y) …… isoProject(w,l,0,PROJ) で得られる固定のSVG座標（カメラの影響を受けない）
//  3. view座標 …… 実際に画面に出るピクセル。scene→viewの変換だけをこのカメラが担う。
// こうしておくと、既存の投影・レイアウト計算（baseViewLayout.js）は一切変更せずに
// ズーム/パンを後付けできる。
import { isoProject } from "./baseViewLayout.js";

// 描画物が実際に占めるscene座標の範囲を求める。world矩形からではなく「実際に描く物」から
// 求めるのが要点：world軸に平行な矩形は2:1投影すると必ず横2:縦1の菱形になるため、
// world矩形をそのまま境界にすると極端に横長（縦長スマホでは上下が大きく余る）になってしまう。
// 実コンテンツ（プラザ・周回路・建物・小物）の和集合はおおむね正方形に近く、縦長画面に収まりやすい。
export function sceneContentBounds({ proj, plaza, loop, buildings, props }, pad = 70) {
  const xs = [], ys = [];
  const add = (w, l, lift = 0) => { const p = isoProject(w, l, 0, proj); xs.push(p.x); ys.push(p.y - lift); };

  if (plaza) {
    add(plaza.wMin, plaza.lMin); add(plaza.wMin, plaza.lMax);
    add(plaza.wMax, plaza.lMax); add(plaza.wMax, plaza.lMin);
  }
  if (loop) {
    const r = loop.pathW + loop.trackHalfWidth, s = loop.pathL + loop.trackHalfWidth;
    add(-r, -s); add(-r, s); add(r, s); add(r, -s);
  }
  for (const b of buildings || []) {
    const h = 3 * (b.floorHeight || 0); // 最大階数ぶんの高さを見込む
    add(b.w - b.hw, b.l - b.hl); add(b.w - b.hw, b.l + b.hl, h);
    add(b.w + b.hw, b.l + b.hl); add(b.w + b.hw, b.l - b.hl, h);
  }
  const propLists = [props?.backTrees, props?.trees, props?.benches, props?.lamps];
  for (const list of propLists) for (const o of list || []) add(o.w, o.l, 34);
  for (const o of [props?.bikeRack, props?.teamCar]) if (o) add(o.w, o.l, 20);

  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

// 全体がちょうど収まる倍率（contain）。これがズームアウトの下限になる。
export function fitScale(bounds, viewW, viewH) {
  if (!bounds.w || !bounds.h || !viewW || !viewH) return 1;
  return Math.min(viewW / bounds.w, viewH / bounds.h);
}

// 画面を完全に覆う倍率（cover）。初期表示に使う（余白の無い密な絵から始める）。
export function coverScale(bounds, viewW, viewH) {
  if (!bounds.w || !bounds.h || !viewW || !viewH) return 1;
  return Math.max(viewW / bounds.w, viewH / bounds.h);
}

// カメラ中心(scene座標)を、内容が画面外へ流れ去らないよう制限する。
// 倍率kで内容が画面より小さい軸は、動かさずに中央へ固定する（引いたときに絵が端に寄らない）。
export function clampCam(cam, k, bounds, viewW, viewH) {
  const halfW = viewW / (2 * k), halfH = viewH / (2 * k);
  const x = bounds.w * k <= viewW ? bounds.cx : Math.min(Math.max(cam.x, bounds.minX + halfW), bounds.maxX - halfW);
  const y = bounds.h * k <= viewH ? bounds.cy : Math.min(Math.max(cam.y, bounds.minY + halfH), bounds.maxY - halfH);
  return { x, y };
}

// SVGの<g transform>文字列。scene座標 → view座標への相似変換。
export function cameraTransform(cam, k, viewW, viewH) {
  const tx = viewW / 2 - cam.x * k, ty = viewH / 2 - cam.y * k;
  return `translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${k.toFixed(4)})`;
}

// view座標の点(px,py)を固定したまま倍率をkからnextKへ変えるときの、新しいカメラ中心。
// ピンチやホイールで「指/カーソルの下の一点が動かない」自然なズームになる。
export function zoomAbout(cam, k, nextK, px, py, viewW, viewH) {
  const sx = cam.x + (px - viewW / 2) / k, sy = cam.y + (py - viewH / 2) / k;
  return { x: sx - (px - viewW / 2) / nextK, y: sy - (py - viewH / 2) / nextK };
}

// view座標 → scene座標（タップ位置から対象を引き当てるのに使う）。
export function viewToScene(px, py, cam, k, viewW, viewH) {
  return { x: cam.x + (px - viewW / 2) / k, y: cam.y + (py - viewH / 2) / k };
}
