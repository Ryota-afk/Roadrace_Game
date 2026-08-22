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

// 間仕切り壁1枚の描画用4点（下端2点・上端2点）。footprintの4頂点に縛られる外壁
// （isoBoxFaces）とは異なり、任意の線分＋高さから壁面を作る汎用ヘルパー。
export function wallPanel(w1, l1, w2, l2, height, proj) {
  const botA = isoProject(w1, l1, 0, proj), botB = isoProject(w2, l2, 0, proj);
  const topA = { x: botA.x, y: botA.y - height }, topB = { x: botB.x, y: botB.y - height };
  return { botA, botB, topA, topB };
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

// Wave H-2: 部屋の「内装グレード」(0〜3・見た目のみ・能力値への影響なし)を導出する。
// buildingLevels(g)の「設備Lv」（実効果あり）とは独立した別軸。
// - 4つの持ち場(training/mechanic/medical/scout)：g.roomLvへの購入(controllers/season/
//   shop.jsのbuyRoomUpgrade)で0〜3が決まる。旧セーブにroomLv自体が存在しないケースに
//   備え、Wave F-1のgrounds(equip.grounds)と同じ`|| 0`ガードを踏襲する。
// - 廊下・納戸(corridor/spare1/spare2)：購入対象ではなく、クラブハウスのクラス(classIdx)
//   に連動して自動で上がる（0〜2の3段階＝クラス数と一致）。「昇格するほど拠点全体が
//   格上げされる」という体験にするため。
export function roomGrade(g, roomKey) {
  // 第20弾: 購入対象は従来どおり4持ち場のみ。それ以外（玄関ホール・縦横廊下・
  // 条件解禁の奥3部屋）はクラブハウスのクラス(classIdx)連動で自動的に上がる。
  const purchasable = roomKey === "training" || roomKey === "mechanic"
    || roomKey === "medical" || roomKey === "scout";
  if (!purchasable) return Math.max(0, Math.min(2, g.classIdx || 0));
  const lv = ((g.roomLv || {})[roomKey]) || 0;
  return Math.max(0, Math.min(3, lv));
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

// ---- 任意多角形＋丸め角の周回路（第20弾） ----
// loop: { points: [{w,l},...], cornerR, trackHalfWidth }。時計回り/反時計回りどちらでも良い。
// 各角を半径cornerR（隣接辺長の45%まで自動クランプ）の円弧で丸め、全周を弧長で
// パラメータ化する。旧・角丸オーバル（roundedLoopPoint系）の一般化で、L字などの
// 凹み角も扱える。事前計算はWeakMapでloopオブジェクトごとに1回だけ行う。
const POLY_LOOP_CACHE = new WeakMap();
function buildPolyLoop(loop) {
  const cached = POLY_LOOP_CACHE.get(loop);
  if (cached) return cached;
  const pts = loop.points;
  const n = pts.length;
  const segs = [];
  // 各角の丸めを構成：接点T1(手前辺側)・T2(次辺側)・中心C・回転方向
  const corners = pts.map((P, i) => {
    const A = pts[(i - 1 + n) % n], B = pts[(i + 1) % n];
    const e1 = { w: P.w - A.w, l: P.l - A.l }, e2 = { w: B.w - P.w, l: B.l - P.l };
    const L1 = Math.hypot(e1.w, e1.l), L2 = Math.hypot(e2.w, e2.l);
    const u1 = { w: e1.w / L1, l: e1.l / L1 }, u2 = { w: e2.w / L2, l: e2.l / L2 };
    const cross = u1.w * u2.l - u1.l * u2.w;
    const dot = u1.w * u2.w + u1.l * u2.l;
    const turn = Math.atan2(cross, dot); // 曲がり角（符号つき）
    const r = Math.min(loop.cornerR || 0, 0.45 * L1, 0.45 * L2);
    const tanHalf = Math.abs(Math.tan(turn / 2));
    const d = r * tanHalf; // 接点までの後退距離
    const T1 = { w: P.w - u1.w * d, l: P.l - u1.l * d };
    const T2 = { w: P.w + u2.w * d, l: P.l + u2.l * d };
    const s = Math.sign(turn) || 1;
    const n1 = { w: -u1.l * s, l: u1.w * s }; // 曲がる側の法線
    const C = { w: T1.w + n1.w * r, l: T1.l + n1.l * r };
    const a1 = Math.atan2(T1.l - C.l, T1.w - C.w);
    return { T1, T2, C, r, a1, sweep: turn };
  });
  let total = 0;
  for (let i = 0; i < n; i++) {
    const from = corners[i].T2, to = corners[(i + 1) % n].T1;
    const len = Math.hypot(to.w - from.w, to.l - from.l);
    segs.push({ kind: "line", from, to, len });
    total += len;
    const c = corners[(i + 1) % n];
    const arcLen = Math.abs(c.sweep) * c.r;
    if (arcLen > 1e-9) { segs.push({ kind: "arc", c, len: arcLen }); total += arcLen; }
  }
  const built = { segs, total, pts };
  POLY_LOOP_CACHE.set(loop, built);
  return built;
}

export function loopPointAt(loop, t) {
  const { segs, total } = buildPolyLoop(loop);
  let s = (((t % 1) + 1) % 1) * total;
  for (const seg of segs) {
    if (s <= seg.len || seg === segs[segs.length - 1]) {
      const u = seg.len > 1e-9 ? Math.min(1, s / seg.len) : 0;
      if (seg.kind === "line") {
        return { w: seg.from.w + (seg.to.w - seg.from.w) * u, l: seg.from.l + (seg.to.l - seg.from.l) * u };
      }
      const { c } = seg;
      const a = c.a1 + c.sweep * u;
      return { w: c.C.w + c.r * Math.cos(a), l: c.C.l + c.r * Math.sin(a) };
    }
    s -= seg.len;
  }
  return { ...segs[0].from };
}

export function loopNearestT(loop, target) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < 240; i++) {
    const t = i / 240;
    const p = loopPointAt(loop, t);
    const d = (p.w - target.w) ** 2 + (p.l - target.l) ** 2;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

export function loopCenterlinePts(loop, n) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(loopPointAt(loop, i / n));
  return pts;
}

// 多角形（丸め前の生の頂点）に対する内外判定。infield判定・リボンの内外判定に使う。
export function loopContains(loop, w, l) {
  const pts = loop.points;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.l > l) !== (b.l > l) && w < (b.w - a.w) * (l - a.l) / (b.l - a.l) + a.w) inside = !inside;
  }
  return inside;
}

// 丸め後の周回路中心線までの最短距離（サンプル近似）。地面ゾーン判定に使う。
export function loopDistanceTo(loop, w, l) {
  let best = Infinity;
  for (let i = 0; i < 160; i++) {
    const p = loopPointAt(loop, i / 160);
    const d = Math.hypot(p.w - w, p.l - l);
    if (d < best) best = d;
  }
  return best;
}

// 周回路リボンの外側/内側エッジ。内側の向きは多角形の符号付き面積（巻き方向）から
// 一括で決める：CCW（面積>0）なら進行方向の左法線(-dl,dw)が常に内側。
// 旧実装（サンプル点ごとのloopContains判定）は角の円弧付近＝丸めが生の頂点の外に
// 膨らむ区間で判定が反転し、リボンが蝶ネクタイ状に潰れる不具合があった（第20弾で実測）。
export function loopRibbonPts(loop, n, halfWidth) {
  const eps = 1e-4;
  const pts = loop.points;
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area2 += a.w * b.l - b.w * a.l;
  }
  const innerSign = area2 > 0 ? 1 : -1; // CCWなら左法線が内側
  const outer = [], inner = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const p0 = loopPointAt(loop, t - eps), p1 = loopPointAt(loop, t + eps);
    let dw = p1.w - p0.w, dl = p1.l - p0.l;
    const len = Math.hypot(dw, dl) || 1;
    dw /= len; dl /= len;
    const nw = -dl * innerSign, nl = dw * innerSign;
    const center = loopPointAt(loop, t);
    inner.push({ w: center.w + nw * halfWidth, l: center.l + nl * halfWidth });
    outer.push({ w: center.w - nw * halfWidth, l: center.l - nl * halfWidth });
  }
  return { outer, inner };
}

// 第20弾: 条件解禁の部屋（食堂・ロッカールーム・トロフィールーム）。gは読み取り専用。
// 解禁前は納戸の見た目（BaseView側でst_emptyを描く）。
export function roomUnlocks(g) {
  const staffCount = Object.values(g.staff || {}).filter(v => v > 0).length;
  const rosterCount = (g.roster || []).length;
  const hasTitle = g.cleared || g.champBest === 1
    || (g.careerHistory || []).some(h => h && h.champBest === 1);
  return {
    diner: staffCount >= 2,
    locker: rosterCount >= 8,
    trophy: !!hasTitle,
  };
}

// 旧・角丸オーバル周回路（roundedLoopPoint/nearestLoopT/riderLoopPoint/riderFacesLeft/
// trackCenterline/groundZone/trackRibbon）は第20弾の多角形周回路（上記buildPolyLoop系）へ
// 一般化して置き換え、参照ゼロになったため削除した（git履歴から復元可能）。
