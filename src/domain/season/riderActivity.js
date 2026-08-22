// 選手の「拠点での過ごし方」を**時刻の純関数**として表す（Step13 Wave F-3a）。
// JSXを持たないためNode単体テストから直接importできる。
//
// 設計の核（ユーザー合意済み・詳細はDEVLOG §11）：
// Reactのstateも`useEffect`のタイマーも一切使わず、`riderActivityAt(rider, tSec, ctx)`が
// 時刻だけから位置・ポーズを決める。既存の`riderLoopPoint(id, tSec, ...)`と同じ流儀。
//  - メニューを開くと`elapsed`が止まるので、ポーズも自然に静止する（既存の一時停止機構が
//    そのまま効く。個別に「止める」処理を書かなくてよい）
//  - 「t=37.5秒の選手2は廊下のどこにいるか」をNodeで機械的に検算できる
//  - Math.random()不使用の既存方針を維持（位相は`riderHash01`）
//
// 歩行ルートは**壁データ(BASE_VIEW_PARTITIONS)の「壁が無い区間」＝扉から機械的に導出**する。
// 間仕切りを動かせばルートも自動で追従し、壁を通り抜ける経路が原理的に発生しない。
import { riderHash01, riderWander } from "../../sim/race.js";
import { isoProject, loopPointAt, loopNearestT, inWorldRect } from "./baseViewLayout.js";

// 1サイクルの構成（秒）。周回に最も長く時間を割り当てることで、実行時のカウンタを持たずに
// 「常に一定割合だけが屋内にいる」状態が自動的に生まれる（純関数のまま人数バランスが取れる）。
export const ACTIVITY_SEGMENTS = [
  { mode: "ride", dur: 50 },      // 周回（自転車）
  { mode: "approach", dur: 4 },   // コース→ラック（自転車のまま）
  { mode: "walkIn", dur: 10 },    // ラック→玄関→廊下→部屋（徒歩・自転車なし）
  { mode: "work", dur: 18 },      // 持ち場で作業（座る/立つ）
  { mode: "walkOut", dur: 10 },   // 部屋→玄関→ラック（徒歩）
  { mode: "depart", dur: 4 },     // ラック→コース（自転車）
];
export const ACTIVITY_CYCLE = ACTIVITY_SEGMENTS.reduce((s, x) => s + x.dur, 0); // 96秒

// 壁(w=wallW固定の縦の間仕切り)のうち、線分で覆われていない区間＝扉の開口部を返す。
// Wave F-2のNode単体テストで書いた被覆区間の算出をdomain層へ昇格させたもの
// （テストと本番が同じ計算を共有する＝テストが本物の保証になる）。
export function wallGaps(partitions, wallW, lMin, lMax) {
  const segs = partitions
    .filter(p => Math.abs(p.w1 - wallW) < 1e-6 && Math.abs(p.w2 - wallW) < 1e-6)
    .map(p => [Math.min(p.l1, p.l2), Math.max(p.l1, p.l2)])
    .sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let cursor = lMin;
  for (const [a, b] of segs) {
    if (a > cursor + 1e-6) gaps.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < lMax - 1e-6) gaps.push([cursor, lMax]);
  return gaps;
}

// 部屋と廊下を隔てる壁のうち、その部屋に面した扉の中心座標。
export function doorFor(room, corridor, partitions, clubhouse) {
  const wallW = room.w < corridor.w ? corridor.w - corridor.hw : corridor.w + corridor.hw;
  const gaps = wallGaps(partitions, wallW, clubhouse.l - clubhouse.hl, clubhouse.l + clubhouse.hl);
  const rMin = room.l - room.hl, rMax = room.l + room.hl;
  const g = gaps.find(([a, b]) => a < rMax - 1e-6 && rMin < b - 1e-6);
  if (!g) return { w: wallW, l: room.l };
  return { w: wallW, l: (Math.max(g[0], rMin) + Math.min(g[1], rMax)) / 2 };
}

// 持ち場での立ち位置とポーズ。同じ部屋に椅子(BASE_VIEW_FIXTURESのkind==="chair")があれば
// **その椅子に実際に座る**、トレーニング室ならローラー台に跨がって漕ぐ、それ以外は
// 什器の手前に立つ（メカニック室はこの「棒立ち」のまま——ドット絵化ウェーブでの
// 作業ポーズ追加に合わせて解消する予定。ユーザー判断①）。
// 立つ場合の手前＝screen yが大きい側＝(w - l)が大きい側に置くことで、什器より後に
// 描かれる＝什器の前に立って見える（Wave E-2で踏んだ「不透明な床/什器に埋もれる」問題の予防）。
export function workSpotFor(roomKey, station, clutter) {
  const chair = (clutter || []).find(c => c.room === roomKey && c.kind === "chair");
  if (chair) return { w: chair.w, l: chair.l, pose: "sit" };
  // Wave H-3: 「ぼっ立ち」修正の第1弾。トレーニング室の主要什器はローラー台そのものなので、
  // 実際のロード選手と同じく自転車ごとローラーに乗せる（新規ドット絵不要でPixelBikeを流用）。
  // 第20弾: st_rollerスプライトは「ローラー台(左)＋机(右)＋青マット(手前)」のセットで、
  // アンカー(bbox下端中央)は台の中心からずれている。台の中心（アンカーからscreen(-4,-9)px
  // ＝world(-0.42,+0.27)）へオフセットし、自転車が台の真上に乗るようにする
  // （2026-08ユーザー指摘「ローラーの向き」：台の脇のマット上に台とは別の向きで立っていた）。
  if (roomKey === "training") return { w: station.w - 0.42, l: station.l + 0.27, pose: "roller" };
  return { w: station.w, l: station.l - 0.6, pose: "stand" };
}

// ラック→玄関→廊下→扉→持ち場 の折れ線。
export function routeToStation(ctx, roomKey) {
  const { rack, clubhouse, corridor, rooms, partitions, stations, clutter } = ctx;
  const room = rooms.find(r => r.key === roomKey);
  const station = stations.find(s => s.room === roomKey);
  if (!room || !station) return null;
  const door = doorFor(room, corridor, partitions, clubhouse);
  const spot = workSpotFor(roomKey, station, clutter);
  const frontL = clubhouse.l - clubhouse.hl; // 玄関のある辺
  return [
    { w: rack.w, l: rack.l },
    { w: clubhouse.w, l: frontL - 0.8 },  // 玄関前のアプローチ
    { w: clubhouse.w, l: frontL + 0.15 }, // 敷居をまたぐ
    { w: corridor.w, l: door.l },         // 廊下を目的の扉の高さまで進む
    { w: door.w, l: door.l },             // 扉を抜ける
    { w: spot.w, l: spot.l },
  ];
}

// 折れ線上の位置（区間長で按分するので、長い区間ほど時間がかかる＝速度が一定に見える）。
export function polylineAt(pts, u) {
  if (!pts || pts.length === 0) return { w: 0, l: 0 };
  if (pts.length === 1) return { ...pts[0] };
  const segs = [];
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const d = Math.hypot(pts[i + 1].w - pts[i].w, pts[i + 1].l - pts[i].l);
    segs.push(d);
    total += d;
  }
  if (total <= 1e-9) return { ...pts[0] };
  let s = Math.max(0, Math.min(1, u)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (s <= segs[i] || i === segs.length - 1) {
      const f = segs[i] > 1e-9 ? s / segs[i] : 0;
      return { w: pts[i].w + (pts[i + 1].w - pts[i].w) * f, l: pts[i].l + (pts[i + 1].l - pts[i].l) * f };
    }
    s -= segs[i];
  }
  return { ...pts[pts.length - 1] };
}

// 第21弾: 屋外の行き先（ベンチ・ジム・散歩）を組み込んだ「行き先」の重み表。
// 疲労が高い選手ほどメディカル室、若手はトレーニング室やジム、パワー系の脚質
// （SPR/RUL/PUN）はジムを好む、といった既存の「装飾ではなく情報」という思想の拡張。
// gymは敷地整備Lv3で解禁されるまでカテゴリ自体が候補に入らない（ctx.hasGymで制御）。
// 全て既存フィールド（fatigue/type/age）だけを参照し、選択はriderHash01で決定論的。
const OUTDOOR_CATEGORY_WEIGHT = {
  medical: (r) => 1.0 + Math.max(0, Math.min(1, ((r.fatigue || 0) - 35) / 50)) * 5.0,
  training: (r) => (r.age <= 22 ? 1.6 : 1.0),
  mechanic: () => 1.0,
  scout: () => 1.0,
  bench: (r) => {
    const f = r.fatigue || 0;
    let w = 1.5;
    if (f >= 30 && f <= 60) w *= 1.6;
    else if (f >= 85) w *= 0.4;
    return w;
  },
  gym: (r) => {
    let w = 1.2;
    if (r.type === "SPR" || r.type === "RUL" || r.type === "PUN") w *= 1.8;
    if (r.age <= 22) w *= 1.3;
    return w;
  },
  stroll: () => 1.0,
};
const BENCH_KEYS = ["bench-plaza0", "bench-plaza1", "bench-home0", "bench-home1"];

// 行き先の決定（ユーザー選択：屋外の行き先も含めゲーム状態に連動させる）。gは読み取りのみ
// （状態を変更しない）。riderIndex（ロースター内の並び順）はベンチ・ジムの席割り当てに使う
// （他の選手を見ない純関数のまま、同じ席に複数人が重ならないようにする）。
export function destinationFor(rider, riderIndex, cycleIndex, ctx) {
  const categories = ["medical", "training", "mechanic", "scout", "bench"];
  if (ctx.hasGym) categories.push("gym");
  categories.push("stroll");
  const weights = categories.map(c => OUTDOOR_CATEGORY_WEIGHT[c](rider));
  const total = weights.reduce((a, b) => a + b, 0);
  let x = riderHash01(rider.id * 31 + cycleIndex, 71) * total;
  let category = categories[categories.length - 1];
  for (let i = 0; i < categories.length; i++) {
    if (x < weights[i]) { category = categories[i]; break; }
    x -= weights[i];
  }
  if (category === "bench") return BENCH_KEYS[(riderIndex + cycleIndex) % BENCH_KEYS.length];
  if (category === "gym") return `gym${(riderIndex + cycleIndex) % 3}`;
  return category; // room key（training/mechanic/medical/scout）またはstroll
}

// 第21弾: BASE_VIEW_OUTDOOR_SPOTS（ベンチ・ジム・散歩）から、ラックを起点とする
// [rack, ...waypoints, spot]の折れ線とポーズを組み立てる。ジムは3スロット分を
// gym0/gym1/gym2として展開する。groundsLv未満のkindを持つ行き先（現状ジムのみ）は
// 除外する＝ACTIVITY_CTXがゲーム状態（敷地整備Lv）に依存する理由（第20弾までは
// モジュール読み込み時の静的構築だったが、この行き先解禁のため状態依存へ変更した）。
export function buildOutdoorRoutes(rack, outdoorSpots, groundsLv) {
  const routes = {}, poses = {};
  for (const s of outdoorSpots || []) {
    if (s.minLevel != null && (groundsLv || 0) < s.minLevel) continue;
    if (s.kind === "gym") {
      s.slots.forEach((slot, i) => {
        const key = `${s.key}${i}`;
        routes[key] = [{ ...rack }, ...s.waypoints, slot];
        poses[key] = s.pose;
      });
    } else {
      routes[s.key] = [{ ...rack }, ...s.waypoints, s.spot];
      poses[s.key] = s.pose;
    }
  }
  return { routes, poses };
}

const lerpPt = (a, b, u) => ({ w: a.w + (b.w - a.w) * u, l: a.l + (b.l - a.l) * u });

// 周回路パラメータ(t)を、mod 1で最短経路になる向きへ補間する（周回路沿いの移動に使う）。
function lerpLoopT(ta, tb, u) {
  let d = tb - ta;
  d -= Math.round(d);
  return ((ta + d * u) % 1 + 1) % 1;
}

// 時刻tSecにおける選手の位置・モード・ポーズ。ctxは静的データ（data/baseViewBuildings.js由来）。
// riderIndex（ロースター内の並び順・省略時0）はベンチ・ジムの席割り当てに使う（destinationFor参照）。
export function riderActivityAt(rider, tSec, ctx, riderIndex = 0) {
  const { loop, rack, speed, roomKeys } = ctx;
  const phase = riderHash01(rider.id, 53);
  const tt = tSec + phase * ACTIVITY_CYCLE;
  const cycleIndex = Math.floor(tt / ACTIVITY_CYCLE);
  const local = tt - cycleIndex * ACTIVITY_CYCLE;

  let acc = 0, seg = ACTIVITY_SEGMENTS[0], segStart = 0;
  for (const s of ACTIVITY_SEGMENTS) {
    if (local < acc + s.dur) { seg = s; segStart = acc; break; }
    acc += s.dur;
  }
  const u = seg.dur > 0 ? (local - segStart) / seg.dur : 0;

  // このサイクルの絶対時刻の基準点。approach端点(tRideEnd)を周回上の実際の位置に
  // 一致させ、ワープして見えないようにするために使う。
  const tCycleStart = (cycleIndex - phase) * ACTIVITY_CYCLE;
  const tRideEnd = tCycleStart + ACTIVITY_SEGMENTS[0].dur;

  // ラックに最も近い周回路上の点(nT)を、周回(ride)のt原点にする。このサイクルの開始
  // 時刻(tCycleStart)にnTを出発し、経過秒数×speedだけ進める形にすることで、選手が
  // 周回をスタート/フィニッシュする地点が常にラック隣接のスタート/フィニッシュ帯
  // （Track.jsx側もnearestLoopTで同じ点を使う）と一致する。以前は選手固有の位相
  // (riderHash01(id,41))で周回上の任意の点から始まっていたが、選手ごとに
  // tCycleStartがずれている（riderHash01(id,53)由来）ため、この変更後も選手同士が
  // 団子状態になることはない。
  const nT = loopNearestT(loop, rack);
  const loopT = (t) => ((nT + (t - tCycleStart) * speed) % 1 + 1) % 1;
  const onLoop = (t) => loopPointAt(loop, loopT(t));

  const roomKey = destinationFor(rider, riderIndex, cycleIndex, ctx);
  const route = ctx.routes[roomKey] || ctx.routes[roomKeys[0]];
  const spot = route[route.length - 1];
  const spotPose = ctx.poses[roomKey] || "stand";

  if (seg.mode === "ride") return { mode: "ride", pose: "ride", roomKey, ...onLoop(tSec) };
  if (seg.mode === "approach") {
    // 周回路沿いにラック近くまで進んでから(前半)、短距離でラックへ入る(後半)。
    if (u < 0.5) {
      const tOnLoop = lerpLoopT(loopT(tRideEnd), nT, u / 0.5);
      return { mode: "approach", pose: "ride", roomKey, ...loopPointAt(loop, tOnLoop) };
    }
    const nearPt = loopPointAt(loop, nT);
    return { mode: "approach", pose: "ride", roomKey, ...lerpPt(nearPt, rack, (u - 0.5) / 0.5) };
  }
  if (seg.mode === "depart") {
    // ラックからラック最寄り点(nT)まで直線で戻る。周回(ride)は必ずnTから始まる設計
    // （上のloopT参照）になったため、以前あった「周回上の未来位置へ先回りする」
    // 後半部分は不要（それどころか、cycleをまたいだtNextRideStartをこのcycleの
    // tCycleStart基準で評価してしまい、実際にride開始時に評価される位置とズレて
    // ワープして見えるバグになっていた。実機シミュレーションで発覚・修正）。
    const nearPt = loopPointAt(loop, nT);
    return { mode: "depart", pose: "ride", roomKey, ...lerpPt(rack, nearPt, u) };
  }
  if (seg.mode === "walkIn") return { mode: "walkIn", pose: "walk", roomKey, ...polylineAt(route, u) };
  if (seg.mode === "walkOut") return { mode: "walkOut", pose: "walk", roomKey, ...polylineAt(route, 1 - u) };
  return { mode: "work", pose: spotPose, roomKey, w: spot.w, l: spot.l };
}

// 周回中(pose==="ride")だけ描画位置に加える横ゆらぎ(riderWander)。BaseView.jsxの
// 描画位置計算(x,y)と、本ファイル内の向き判定(activityFacesLeft/activityDir)の
// 両方から同じ関数を呼ぶことで値のズレを構造的に防ぐ（以前は同じ式をBaseView.jsxに
// 別途書いていたため、向き判定だけゆらぎ抜きになっていた＝下のバグの原因）。
export function activityWobble(rider, act, tSec) {
  return act.pose === "ride" ? riderWander(rider.id, 7, tSec, 0.5) * 0.10 : 0;
}

// スプライトを水平反転すべきか（進行方向がscreen上で左向きか）。
// 既存のriderFacesLeftと同じ考え方だが、周回だけでなく歩行・作業も含む汎用版。
//
// 【重要】周回中はBaseView.jsxがriderWanderによる横ゆらぎを描画位置(l)に加えている。
// 以前はこの関数がゆらぎ抜きの位置だけで向きを判定していたため、カーブの頂点付近など
// 進行方向の画面上のx成分がもともと小さい区間では、ゆらぎの変化量が本来の移動量を
// 上回って実際の見た目の動きが逆転することがあり、「NEへ進もうとしているのにNW向きに
// 見える（逆もまた然り）」という間欠的なバグになっていた（実機でユーザーが発見）。
// 向き判定にも同じゆらぎを加えて実際の描画位置と一致させることで解消する。
export function activityFacesLeft(rider, tSec, ctx, proj, riderIndex = 0) {
  const a = riderActivityAt(rider, tSec, ctx, riderIndex);
  const b = riderActivityAt(rider, tSec + 0.12, ctx, riderIndex);
  const wa = activityWobble(rider, a, tSec), wb = activityWobble(rider, b, tSec + 0.12);
  const pa = isoProject(a.w, a.l + wa, 0, proj), pb = isoProject(b.w, b.l + wb, 0, proj);
  if (Math.abs(pb.x - pa.x) < 0.01) return false; // 静止中は向きを変えない
  return pb.x < pa.x;
}

// ドット絵スプライト(pixelBike.jsx)の向き判定。アイソメ投影では世界座標の単軸移動が
// 必ず画面上は斜め方向になる（dx=26*(dw+dl), dy=13*(dw-dl)）ため、画面yの増減だけで
// 「SE系（下向き）」か「NE系（上向き）」かが決まる。左右はactivityFacesLeftのflipが担当し、
// 本関数はその直交する軸（上下）を担当する。静止中・純水平移動中はSEをデフォルトにする。
// activityFacesLeftと同じ理由でriderWanderの横ゆらぎを加えてから判定する。
export function activityDir(rider, tSec, ctx, proj, riderIndex = 0) {
  const a = riderActivityAt(rider, tSec, ctx, riderIndex);
  const b = riderActivityAt(rider, tSec + 0.12, ctx, riderIndex);
  const wa = activityWobble(rider, a, tSec), wb = activityWobble(rider, b, tSec + 0.12);
  const pa = isoProject(a.w, a.l + wa, 0, proj), pb = isoProject(b.w, b.l + wb, 0, proj);
  if (Math.abs(pb.y - pa.y) < 0.01) return "SE";
  return pb.y >= pa.y ? "SE" : "NE";
}

// その位置がクラブハウスの中か（＝屋内グループで描くべきか）。
// 屋内の人物を独立して奥行きソートすると不透明な床に埋もれるため、BaseView側で
// クラブハウスのatomicな描画グループへ入れる判定に使う（Wave E-2で実際に踏んだ罠）。
export function isIndoors(w, l, clubhouse) {
  return inWorldRect(w, l, {
    wMin: clubhouse.w - clubhouse.hw, wMax: clubhouse.w + clubhouse.hw,
    lMin: clubhouse.l - clubhouse.hl, lMax: clubhouse.l + clubhouse.hl,
  });
}
