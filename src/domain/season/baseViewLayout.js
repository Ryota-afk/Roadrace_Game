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

// visibleFacePairの鏡像：4頂点のうち画面Y座標が最小＝カメラから最も遠い頂点(back)とその
// 両隣を返す。back頂点に接する2面はvisibleFacePairの「奥に隠れる不可視面」と同一だが、
// カイロソフト式のカットアウト部屋（Wave E-2）ではこの2面こそが「見せたい奥の壁」になる
// （手前2面は開けたままにして中を見せる）。
export function backFacePair(corners) {
  let back = "N";
  for (const k of DIAMOND_CYCLE) if (corners[k].y < corners[back].y) back = k;
  const i = DIAMOND_CYCLE.indexOf(back);
  const nbrs = [DIAMOND_CYCLE[(i + 3) % 4], DIAMOND_CYCLE[(i + 1) % 4]];
  const [left, right] = corners[nbrs[0]].x <= corners[nbrs[1]].x ? nbrs : [nbrs[1], nbrs[0]];
  return { back, left, right };
}

// 部屋のfloor四角形（world座標系のscene投影・[N,E,S,W]の順）。タップの当たり判定
// （pointInQuad）にそのまま渡せる。JSXを持たないためNode単体テスト・BaseView両方から
// 同じ計算を参照できる（旧実装はcomponents/base/Room.jsxに置いていたが、JSXを含む
// ファイルはNodeから直接importできずテストできなかったため、こちらへ移設した）。
export function roomFloorQuad(b, proj) {
  const { corners } = isoBoxFaces(b.w, b.l, b.hw, b.hl, 0, proj);
  return [corners.N, corners.E, corners.S, corners.W];
}

// クラブハウス内の持ち場（什器）1つぶんの当たり判定用の小さな四角形（[N,E,S,W]の順）。
// Wave E-2 redo：5棟の建物ではなく単一の大部屋＋持ち場という構図に変更したことに伴い新設。
// roomFloorQuadと同じ考え方だが、部屋全体ではなく什器1つぶんの小さな範囲を対象にする
// （BaseView側でまずstationQuadを判定し、当たらなければ部屋全体のroomFloorQuadへ
// フォールバックする＝什器のピンポイントタップを部屋全体より優先する）。
export function stationQuad(s, size, proj) {
  const { corners } = isoBoxFaces(s.w, s.l, size, size, 0, proj);
  return [corners.N, corners.E, corners.S, corners.W];
}

// 点pが凸四角形quad(4頂点・順序通りに並んでいること)の内側かどうか。
// 全ての辺についてpが同じ側にあるかを外積の符号で判定する（辺上=符号0は許容）。
// 部屋タップの当たり判定に使う（floor四角形はisoProjectの線形写像で必ず凸になる）。
export function pointInQuad(p, quad) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const s = Math.sign(cross);
    if (s !== 0) {
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

// 立方体（world座標のダイヤ形footprint＋高さ）の可視2面＋天面の頂点をまとめて返す共通関数。
// 建物・チームカー・ベンチ・自転車ラックなど「箱状のもの」は全てこれを使って描くことで、
// 必ずアイソメ格子に乗る（Wave Dでは小物をスクリーン座標の矩形で描いており、斜めの角度が
// 周囲と合わない＝「角度が変」の原因になっていた。詳細はDEVLOG §10）。
// footprintは **world軸に平行な矩形**（w∈[w±hw], l∈[l±hl]）である必要がある。
// Wave D2初版は N=(-hw,0)/E=(0,hl)/S=(hw,0)/W=(0,-hl) という「world空間で45°回転した菱形」
// を使っていた。これを2:1投影すると画面軸に平行な長方形になってしまい（hw=hlなら完全な
// 長方形）、可視2面の画面上の幅が44px対7.8pxと極端に非対称になる＝アイソメに見えない、
// というのがユーザー指摘「建物その他の斜めの角度が変」の根因だった。
// world軸平行の矩形なら投影後は必ず正しい菱形になり、hw=hlのとき2面の幅も一致する。
export function isoBoxFaces(w, l, hw, hl, height, proj) {
  const N = isoProject(w - hw, l + hl, 0, proj); // 奥（画面上）
  const E = isoProject(w + hw, l + hl, 0, proj); // 右
  const S = isoProject(w + hw, l - hl, 0, proj); // 手前（画面下）
  const W = isoProject(w - hw, l - hl, 0, proj); // 左
  const corners = { N, E, S, W };
  const { front, left, right } = visibleFacePair(corners);
  const lift = (p) => ({ x: p.x, y: p.y - height });
  const top = { N: lift(N), E: lift(E), S: lift(S), W: lift(W) };
  return {
    corners, top, front, left, right,
    top4: [top.N, top.E, top.S, top.W], // 天面を多角形として描くための順序付き4頂点
    botFront: corners[front], botLeft: corners[left], botRight: corners[right],
    topFront: top[front], topLeft: top[left], topRight: top[right],
  };
}

// world座標のw/l矩形の内側かどうか（プラザ等の領域判定）。
export function inWorldRect(w, l, rect) {
  return w >= rect.wMin && w <= rect.wMax && l >= rect.lMin && l <= rect.lMax;
}

// 芝の装飾を決定論的に散らすための点列。Math.randomを使わずriderHash01でふるい分けと
// ゆらぎを与えるため、同じ引数なら常に同じ配置になる（毎フレーム位置が動かない）。
export function scatterPoints(bounds, step, salt, keepRatio) {
  const pts = [];
  let i = 0;
  for (let w = bounds.wMin; w <= bounds.wMax + 1e-6; w += step) {
    for (let l = bounds.lMin; l <= bounds.lMax + 1e-6; l += step) {
      i++;
      const h = riderHash01(i, salt);
      if (h > keepRatio) continue;
      pts.push({
        w: w + (riderHash01(i, salt + 7) - 0.5) * step * 0.8,
        l: l + (riderHash01(i, salt + 13) - 0.5) * step * 0.8,
        h,
      });
    }
  }
  return pts;
}

// 壁面の4頂点（botA-botB-topB-topA）上の任意の点をバイリニア補間で求める。
// u∈[0,1]：botA→botB方向（壁の横方向）、v∈[0,1]：床(0)→天井(1)方向。
// 窓・扉など「壁面に貼り付く矩形」を頂点座標だけから機械的に配置するための共通関数。
export function wallPoint(botA, botB, topA, topB, u, v) {
  const bx = botA.x + (botB.x - botA.x) * u, by = botA.y + (botB.y - botA.y) * u;
  const tx = topA.x + (topB.x - topA.x) * u, ty = topA.y + (topB.y - topA.y) * u;
  return { x: bx + (tx - bx) * v, y: by + (ty - by) * v };
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

// 選手の進行方向がスクリーン上で左向きか（＝スプライトを水平反転すべきか）を返す。
// IsoRiderは常に右向きに描かれる固定スプライトのため、周回路の左側の直線では逆走して
// 見えていた（Wave Dの積み残し）。わずかに先の位置との screen x の差で判定する。
export function riderFacesLeft(riderId, tSec, speed, pathW, pathL, cornerR, proj) {
  const dt = 0.05;
  const a = riderLoopPoint(riderId, tSec, speed, pathW, pathL, cornerR);
  const b = riderLoopPoint(riderId, tSec + dt, speed, pathW, pathL, cornerR);
  return isoProject(b.w, b.l, 0, proj).x < isoProject(a.w, a.l, 0, proj).x;
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
