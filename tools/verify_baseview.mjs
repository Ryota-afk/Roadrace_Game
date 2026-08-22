// 第20弾: 拠点レイアウトと選手の導線の機械検証。
//  1. 部屋の敷き詰め（重なりゼロ・面積合計=footprint）
//  2. 什器・持ち場・スタッフ・納戸が自室の矩形内にあること
//  3. 徒歩ルート（routeToStation×4部屋）が壁と交差しないこと
//  4. 徒歩ルート・屋外の乗り入れ動線が什器・小物と十分なクリアランスを持つこと
//  5. コース中心線がクラブハウス・前庭に入らないこと
// npm運用: `node tools/verify_baseview.mjs`。違反があれば一覧を出して終了コード1。
import {
  BASE_VIEW_CLUBHOUSE, BASE_VIEW_ROOMS, BASE_VIEW_PARTITIONS, BASE_VIEW_STATIONS,
  BASE_VIEW_FIXTURES, BASE_VIEW_STAFF, BASE_VIEW_LOCKED_ROOMS, BASE_VIEW_LOOP,
  BASE_VIEW_PROPS, BASE_VIEW_GROUNDS_DECOR, BASE_VIEW_PLAZA, BASE_VIEW_GROUND,
} from "../src/data/baseViewBuildings.js";
import { routeToStation, workSpotFor } from "../src/domain/season/riderActivity.js";
import { loopPointAt, loopNearestT, loopDistanceTo } from "../src/domain/season/baseViewLayout.js";
import { OBJ_SPRITES } from "../src/components/sprites/pixelObjectData.js";

const errs = [];
const CH = BASE_VIEW_CLUBHOUSE;

// ---- 1. 部屋の敷き詰め ----
const rects = BASE_VIEW_ROOMS.map(r => ({ key: r.key, w0: r.w - r.hw, w1: r.w + r.hw, l0: r.l - r.hl, l1: r.l + r.hl }));
for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
  const a = rects[i], b = rects[j];
  const ow = Math.min(a.w1, b.w1) - Math.max(a.w0, b.w0);
  const ol = Math.min(a.l1, b.l1) - Math.max(a.l0, b.l0);
  if (ow > 1e-6 && ol > 1e-6) errs.push(`部屋の重なり: ${a.key} × ${b.key} (${ow.toFixed(2)}×${ol.toFixed(2)})`);
}
const area = rects.reduce((s, r) => s + (r.w1 - r.w0) * (r.l1 - r.l0), 0);
const chArea = 2 * CH.hw * 2 * CH.hl;
if (Math.abs(area - chArea) > 1e-6) errs.push(`部屋面積合計 ${area} ≠ footprint ${chArea}`);

// ---- 2. 収容チェック ----
const roomOf = Object.fromEntries(rects.map(r => [r.key, r]));
const inRoom = (key, w, l, label) => {
  const r = roomOf[key];
  if (!r) { errs.push(`${label}: 部屋${key}が存在しない`); return; }
  if (w < r.w0 + 0.25 || w > r.w1 - 0.25 || l < r.l0 + 0.25 || l > r.l1 - 0.25) {
    errs.push(`${label}: (${w},${l}) が部屋${key}(${r.w0}..${r.w1}, ${r.l0}..${r.l1})の内側(壁から0.25)に無い`);
  }
};
for (const f of BASE_VIEW_FIXTURES) inRoom(f.room, f.w, f.l, `什器${f.key}`);
for (const s of BASE_VIEW_STATIONS) inRoom(s.room, s.w, s.l, `持ち場${s.key}`);
for (const s of BASE_VIEW_STAFF) inRoom(s.room, s.w, s.l, `スタッフ${s.key}`);
for (const s of BASE_VIEW_LOCKED_ROOMS) inRoom(s.room, s.w, s.l, `納戸${s.key}`);

// ---- 3. ルート×壁の交差 ----
function segInt(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.w - a.w) * (c.l - a.l) - (b.l - a.l) * (c.w - a.w);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9))
    && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
}
const ctx = {
  rack: BASE_VIEW_PROPS.bikeRack, clubhouse: CH,
  corridor: BASE_VIEW_ROOMS.find(r => r.key === "corridor"),
  rooms: BASE_VIEW_ROOMS, partitions: BASE_VIEW_PARTITIONS,
  stations: BASE_VIEW_STATIONS, clutter: BASE_VIEW_FIXTURES,
};
const walls = BASE_VIEW_PARTITIONS.map(p => [{ w: p.w1, l: p.l1 }, { w: p.w2, l: p.l2 }]);
const routes = {};
for (const s of BASE_VIEW_STATIONS) {
  const route = routeToStation(ctx, s.room);
  routes[s.room] = route;
  for (let i = 0; i + 1 < route.length; i++) {
    for (const [wa, wb] of walls) {
      if (segInt(route[i], route[i + 1], wa, wb)) {
        errs.push(`ルート${s.room}: 区間${i}(${route[i].w},${route[i].l})→(${route[i + 1].w},${route[i + 1].l}) が壁(${wa.w},${wa.l})-(${wb.w},${wb.l})と交差`);
      }
    }
  }
}

// ---- 4. ルートのクリアランス ----
function distToSeg(p, a, b) {
  const dw = b.w - a.w, dl = b.l - a.l;
  const len2 = dw * dw + dl * dl;
  const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((p.w - a.w) * dw + (p.l - a.l) * dl) / len2)) : 0;
  return Math.hypot(p.w - (a.w + dw * t), p.l - (a.l + dl * t));
}
const CLEAR_IN = 0.55;
for (const s of BASE_VIEW_STATIONS) {
  const route = routes[s.room];
  const spot = workSpotFor(s.room, s, BASE_VIEW_FIXTURES);
  const obstacles = [
    ...BASE_VIEW_FIXTURES.filter(f => !(Math.abs(f.w - spot.w) < 1e-6 && Math.abs(f.l - spot.l) < 1e-6)),
    ...BASE_VIEW_STATIONS.filter(x => x.key !== s.key),
    ...BASE_VIEW_STAFF, ...BASE_VIEW_LOCKED_ROOMS,
  ];
  for (let i = 0; i + 1 < route.length; i++) {
    // 最終区間（扉→持ち場）は目的地周辺で近接するため終端0.3手前まで判定
    for (const o of obstacles) {
      const d = distToSeg(o, route[i], route[i + 1]);
      const nearGoal = i === route.length - 2 && Math.hypot(o.w - spot.w, o.l - spot.l) < 1.0;
      if (d < CLEAR_IN && !nearGoal) {
        errs.push(`ルート${s.room}: 区間${i}が ${o.key || o.kind}(${o.w},${o.l}) と近接 d=${d.toFixed(2)}`);
      }
    }
  }
}

// 屋外: コース最寄り点→ラック（乗り入れ）と ラック→玄関前→敷居（徒歩）
const rack = BASE_VIEW_PROPS.bikeRack;
const nearT = loopNearestT(BASE_VIEW_LOOP, rack);
const nearPt = loopPointAt(BASE_VIEW_LOOP, nearT);
const frontL = CH.l - CH.hl;
const outdoorSegs = [
  [nearPt, rack, "乗り入れ(コース→ラック)"],
  [rack, { w: CH.w, l: frontL - 0.8 }, "徒歩(ラック→玄関前)"],
  [{ w: CH.w, l: frontL - 0.8 }, { w: CH.w, l: frontL + 0.15 }, "徒歩(玄関前→敷居)"],
];
const outdoorObs = [
  ...BASE_VIEW_PROPS.trees.map(t => ({ ...t, key: "tree" })),
  ...BASE_VIEW_PROPS.backTrees.map(t => ({ ...t, key: "backTree" })),
  ...BASE_VIEW_PROPS.benches.map(t => ({ ...t, key: "bench" })),
  ...BASE_VIEW_PROPS.lamps.map(t => ({ ...t, key: "lamp" })),
  { ...BASE_VIEW_PROPS.teamCar, key: "teamCar" },
  { ...BASE_VIEW_PROPS.canal, key: "canal" },
  ...BASE_VIEW_GROUNDS_DECOR.filter(d => d.kind !== "arch").map(d => ({ ...d, key: d.key })),
  // archは意図的にゲートとして動線上に置く（くぐる演出）ため除外
];
const CLEAR_OUT = 0.7;
for (const [a, b, label] of outdoorSegs) {
  for (const o of outdoorObs) {
    const d = distToSeg(o, a, b);
    const isEndpoint = Math.hypot(o.w - rack.w, o.l - rack.l) < 1e-6;
    if (d < CLEAR_OUT && !isEndpoint) errs.push(`${label}: ${o.key}(${o.w},${o.l}) と近接 d=${d.toFixed(2)}`);
  }
}

// ---- 5. コースがクラブハウス・前庭に入らない ----
for (let i = 0; i < 200; i++) {
  const p = loopPointAt(BASE_VIEW_LOOP, i / 200);
  const m = BASE_VIEW_LOOP.trackHalfWidth;
  if (p.w > CH.w - CH.hw - m && p.w < CH.w + CH.hw + m && p.l > CH.l - CH.hl - m && p.l < CH.l + CH.hl + m) {
    errs.push(`コースがクラブハウスに接触: t=${(i / 200).toFixed(2)} (${p.w.toFixed(2)},${p.l.toFixed(2)})`);
  }
  if (p.w > BASE_VIEW_PLAZA.wMin - m) {
    errs.push(`コースが前庭舗装に接触: t=${(i / 200).toFixed(2)} (${p.w.toFixed(2)},${p.l.toFixed(2)})`);
  }
  if (p.w < BASE_VIEW_GROUND.wMin + m || p.w > BASE_VIEW_GROUND.wMax - m
    || p.l < BASE_VIEW_GROUND.lMin + m || p.l > BASE_VIEW_GROUND.lMax - m) {
    errs.push(`コースが敷地からはみ出す: (${p.w.toFixed(2)},${p.l.toFixed(2)})`);
  }
}

// ---- 6. 屋外の大型スプライト（池3段階・小川）がコース帯に乗り上げないこと ----
// アンカー（接地点=下端中央）とスプライトのbbox幅から接地菱形を正方形近似で推定し
// （bbox幅px = (w辺+l辺)×26。anchor = 菱形中心から(+s/2,-s/2)、s=(w辺+l辺)/2）、
// 輪郭サンプルの中心線最短距離が 帯半幅+0.1 を下回ったら違反。2026-08にpond3が
// 実際にコースへ0.2ユニット乗り上げていた（点座標だけ見て実寸を見ていなかった穴）。
const bigSprites = [
  ...["pond", "pond2", "pond3"].map(k => [k, BASE_VIEW_GROUNDS_DECOR.find(d => d.key === "pond")]),
  ["canal", BASE_VIEW_PROPS.canal],
];
for (const [key, anchor] of bigSprites) {
  const spr = OBJ_SPRITES[key];
  if (!spr || !anchor) continue;
  const ext = (spr.rows[0].length * 0.5) / 26;   // w辺+l辺（world単位）
  const cw = anchor.w - ext / 4, cl = anchor.l + ext / 4;
  let worst = Infinity;
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    const d = loopDistanceTo(BASE_VIEW_LOOP, cw + Math.cos(t) * ext / 4, cl + Math.sin(t) * ext / 4);
    if (d < worst) worst = d;
  }
  if (worst < BASE_VIEW_LOOP.trackHalfWidth + 0.1) {
    errs.push(`大型スプライト${key}がコース帯に接近/重なり: 中心線まで${worst.toFixed(2)} (< ${(BASE_VIEW_LOOP.trackHalfWidth + 0.1).toFixed(2)})`);
  }
}

if (errs.length) {
  for (const e of errs) console.log("NG:", e);
  console.log(`検証NG ${errs.length}件`);
  process.exit(1);
}
console.log("導線・レイアウト検証OK（部屋の敷き詰め／収容／壁交差ゼロ／クリアランス／コース範囲／大型スプライト×コース）");
