// BaseView（敷地画面）の投影・クラブハウス・持ち場・周回路・地面・季節パレット・小物の
// 静的データ。Step13第3弾で新設 → Wave D（磨き込み）→ Wave D2（カイロソフト準拠の再設計）
// → Wave E（カメラ＋カットアウト部屋）。
//
// Wave D2で投影軸の非対称（w軸長26.83 / l軸長24.6で正しい菱形になっていなかった）を
// Px=Lx・Py=-Lyへ修正した（詳細はDEVLOG §10）。
// Wave E-1で固定キャンバス（旧BASE_VIEW_CANVAS）を廃止し、ResizeObserverで実ピクセルに
// viewBoxを一致させる方式へ変更した（`components/base/BaseView.jsx`参照）。
export const BASE_VIEW_PROJ = { cx0: 240, cy0: 600, Px: 26, Py: 13, Lx: 26, Ly: -13 };

// Wave E-2は「5棟の小さな建物」として実装したが、ユーザーの手描きスケッチの再確認により
// 「敷地全体を屋外(コース)/屋内(クラブハウス)の2つに大きく割り、屋内は単一の大部屋で、
// その中にトレーニング・メカニック・メディカル・スカウトそれぞれの持ち場（机など）が
// 点在する」という構図だったことが判明し、作り直した（Wave E-2 redo。詳細はDEVLOG §11）。
// クラブハウス（単一の大部屋）は周回路（world原点中心）から見て手前+右（w大きめ）に配置。
// カメラは固定のため、cutaway（床＋奥2壁だけを見せる手法）の「奥2壁／開放2辺」の判定は
// 部屋の世界座標上の位置に関わらず常にカメラから見て正しい向きになる
// （domain/season/baseViewLayout.jsのbackFacePair参照）。
export const BASE_VIEW_CLUBHOUSE = {
  key: "clubhouse", label: "クラブハウス", icon: "🏠",
  w: 9.5, l: 0.5, hw: 4.5, hl: 4.0, wallHeight: 40,
  wallLight: "#f0ebe0", wallDark: "#dcd5c4", floor: "#c9a876", accent: "#e05050",
};

// クラブハウス内の4つの持ち場（Wave E-3で什器の種類・数が施設Lvに応じて増える予定。
// 現時点では各持ち場に固定の什器を1つ置く）。levelKey/levelMaxは
// domain/season/baseViewLayout.jsのbuildingLevels(g)が返すキーと対応する。
// w/lはBASE_VIEW_CLUBHOUSEのfootprint（w:5〜14, l:-3.5〜4.5）内、壁際から
// 十分離した位置に配置。roomは下記BASE_VIEW_ROOMSのkeyと対応（どの部屋の什器かを示す。
// 座標が対応する部屋のfootprint内に収まっているかはNode単体テストで検算している）。
export const BASE_VIEW_STATIONS = [
  { key: "training", levelKey: "training", levelMax: 5, label: "トレーニング", icon: "💪",
    w: 7.0, l: -1.8, kind: "roller", accent: "#2f8f5c", room: "training" },
  { key: "mechanic", levelKey: "mechanic", levelMax: 5, label: "メカニック", icon: "🔧",
    w: 7.0, l: 2.8, kind: "workbench", accent: "#c9a23c", room: "mechanic" },
  { key: "medical", levelKey: "medical", levelMax: 3, label: "メディカル", icon: "⚕",
    w: 12.0, l: -1.8, kind: "medical", accent: "#4f8fe8", room: "medical" },
  { key: "scout", levelKey: "scout", levelMax: 3, label: "スカウト", icon: "🔍",
    w: 12.0, l: 2.8, kind: "desk", accent: "#c98bf0", room: "scout" },
];

// Wave F-2 redo：クラブハウスの間取り。均等な3列×2行グリッドで機械的に割った初版を
// ユーザーの指摘（「出入り口と廊下を一切考慮していない」「均等に並べる必要は必ずしもない」
// 「現実的な間取りにして」）を受けて全面的に作り直した。玄関（Room.jsxの扉。footprintの
// 手前辺、w9.5付近の中央）を入ってすぐが廊下(corridor)で、廊下の左右に4つの持ち場、
// 廊下の突き当りに小さな空き部屋(納戸)2つを配置する、普通の建物に近い構成。
// 各部屋はfootprint（w:5〜14, l:-3.5〜4.5）内の矩形として手作業で配置してあり
// （面積の合計はfootprint全体と一致＝隙間なく敷き詰めてある）、既存4持ち場のw/lは
// Wave E-2 redo時点の座標から一切動かしていない（すべて対応する部屋の範囲内に収まる）。
export const BASE_VIEW_ROOMS = [
  { key: "training", w: 6.5, l: -1.6, hw: 1.5, hl: 1.9, floorTint: "#dcefd5" },     // 手前左
  { key: "mechanic", w: 6.5, l: 2.4, hw: 1.5, hl: 2.1, floorTint: "#f2e7c6" },      // 奥左
  { key: "medical", w: 12.25, l: -1.6, hw: 1.75, hl: 1.9, floorTint: "#dbe8f8" },   // 手前右
  { key: "scout", w: 12.25, l: 2.4, hw: 1.75, hl: 2.1, floorTint: "#ecdff8" },      // 奥右
  { key: "corridor", w: 9.25, l: -0.15, hw: 1.25, hl: 3.35, floorTint: "#cbb896" }, // 玄関〜納戸手前の廊下
  { key: "spare1", w: 8.625, l: 3.85, hw: 0.625, hl: 0.65, floorTint: "#e6e3da" },  // 廊下突き当りの納戸(左)
  { key: "spare2", w: 9.875, l: 3.85, hw: 0.625, hl: 0.65, floorTint: "#e6e3da" },  // 廊下突き当りの納戸(右)
];

// 部屋を隔てる壁（間仕切り）の線分。廊下と各持ち場を隔てる壁(w=8/w=10.5)には、対応する
// 持ち場ごとに出入り口の隙間を開けてあるため、1本の壁線が複数のセグメントに分かれている
// （隙間の区間には壁を描かない＝そこが扉）。training/mechanic間・medical/scout間・
// 納戸2部屋の間は単純な1本の間仕切り（扉なし＝廊下側からのみ出入りする部屋どうしの区切り）。
// 外壁（backFacePairが選ぶ2面＝w=5の辺とl=4.5の辺）とは異なる位置になるため重ならない。
export const BASE_VIEW_PARTITIONS = [
  // 廊下←→左側(training/mechanic)の壁。training入口(l:-2.2〜-1.0)・mechanic入口(l:1.8〜3.0)を開けてある。
  { w1: 8, l1: -3.5, w2: 8, l2: -2.2 },
  { w1: 8, l1: -1.0, w2: 8, l2: 1.8 },
  { w1: 8, l1: 3.0, w2: 8, l2: 3.2 },
  // 廊下←→右側(medical/scout)の壁。medical入口(l:-2.2〜-1.0)・scout入口(l:1.8〜3.0)を開けてある。
  { w1: 10.5, l1: -3.5, w2: 10.5, l2: -2.2 },
  { w1: 10.5, l1: -1.0, w2: 10.5, l2: 1.8 },
  { w1: 10.5, l1: 3.0, w2: 10.5, l2: 3.2 },
  // training/mechanicの間、medical/scoutの間、納戸2部屋の間（扉なし）
  { w1: 5, l1: 0.3, w2: 8, l2: 0.3 },
  { w1: 10.5, l1: 0.3, w2: 14, l2: 0.3 },
  { w1: 9.25, l1: 3.2, w2: 9.25, l2: 4.5 },
];

// 間仕切り壁の高さ（外壁 wallHeight:40 より低い＝上から中が見渡せる普通の間取りらしさを出す）。
export const BASE_VIEW_PARTITION_HEIGHT = 16;

// 「機能のない空き部屋」（後々の機能追加用に確保。ユーザー要望：バグに見えないよう最小限の
// 仮置きの意匠を入れる）。廊下の突き当り＝納戸2部屋(BASE_VIEW_ROOMSのspare1/spare2)。
export const BASE_VIEW_EMPTY_ROOMS = [
  { key: "spare1", room: "spare1", w: 8.625, l: 3.85, kind: "empty", icon: "🚧", accent: "#9aa0a6" },
  { key: "spare2", room: "spare2", w: 9.875, l: 3.85, kind: "empty", icon: "📋", accent: "#9aa0a6" },
];

// 練習コース（world原点中心）。クラブハウス（w:5〜14）と重ならない範囲に収めてある。
export const BASE_VIEW_LOOP = { pathW: 3.6, pathL: 2.6, cornerR: 1.1, trackHalfWidth: 0.42 };

// クラブハウスの入口前の舗装アプローチ（world座標のw/l範囲）。クラブハウスfootprint
// （w:4.5〜13.5〜手前に張り出す形）とコースの間の「敷地の通り道」を1枚の大きな
// ポリゴンとして描く。
export const BASE_VIEW_PLAZA = { wMin: 3.6, wMax: 14.5, lMin: -4.8, lMax: 5.8 };

// 芝の装飾（草むら等）を散らす範囲。市松塗りは廃止したので、ここは「点在させる装飾の範囲」。
// Wave F-1でこの矩形を「所有敷地（陸地）」の外形としても兼用する（下記BASE_VIEW_PROPS
// コメント・BaseView.jsx参照）。敷地の外は海（palette.sky）になる。
export const BASE_VIEW_GROUND = { wMin: -9, wMax: 16, lMin: -8, lMax: 9, scatterStep: 1.6 };

// 季節ごとの配色（domain/season/baseViewLayout.jsのseasonOf(month)のキーと対応）。
// grassは一様な1色（Wave Dの明暗交互＝市松模様を廃止）、grassPatchは点在させる濃淡用。
export const BASE_VIEW_SEASON_PALETTE = {
  spring: { sky: "#8fc9e8", grass: "#7cc45c", grassPatch: "#6fb551", plaza: "#cfc6ad", plazaEdge: "#b3aa92", treeLeaf: "#f2a8c6", treeMid: "#e394b4", treeDark: "#c97a9b", snow: null },
  summer: { sky: "#79bfe0", grass: "#57ab45", grassPatch: "#4d9c3d", plaza: "#c8bfa6", plazaEdge: "#aca48c", treeLeaf: "#57b44a", treeMid: "#43963a", treeDark: "#33762d", snow: null },
  autumn: { sky: "#a8c8dc", grass: "#b8924c", grassPatch: "#a88443", plaza: "#c6b99b", plazaEdge: "#aa9e83", treeLeaf: "#e0873a", treeMid: "#c96f2a", treeDark: "#a5551d", snow: null },
  winter: { sky: "#c3d6e4", grass: "#e8eef0", grassPatch: "#d8e2e6", plaza: "#d2d8d8", plazaEdge: "#b9c1c2", treeLeaf: "#dfe8ea", treeMid: "#c2ced2", treeDark: "#9aa8ad", snow: "#f7fbff" },
};

// 小物の固定配置。木はコース周りに、車・自転車ラックはクラブハウスの入口前アプローチに置く
// （ローラー等のトレーニング機材は屋内の持ち場＝BASE_VIEW_STATIONSの"training"に含む）。
export const BASE_VIEW_PROPS = {
  backTrees: [
    { w: -6.5, l: -8.5 }, { w: -4.5, l: -9.5 }, { w: -2.5, l: -10.5 },
    { w: -0.5, l: -11.5 }, { w: 1.5, l: -12.5 }, { w: -8.5, l: -7.5 },
  ],
  trees: [
    { w: -6.5, l: 2.5 }, { w: -7.0, l: -2.5 }, { w: -1.0, l: 6.0 },
    { w: -1.5, l: -6.5 }, { w: 4.0, l: -6.0 }, { w: 4.5, l: 5.5 },
    { w: -3.5, l: 6.5 }, { w: -4.0, l: -6.0 },
  ],
  benches: [{ w: 4.2, l: -3.2 }, { w: 4.2, l: 3.6 }],
  lamps: [{ w: 3.9, l: 0.2 }, { w: -2.5, l: 3.0 }, { w: -2.5, l: -2.8 }],
  bikeRack: { w: 5.2, l: -4.2 },
  teamCar: { w: 5.8, l: 4.8 },
};

// Wave F-1: 敷地の見た目だけを変える購入枠（data/items.jsのEQUIPS.grounds、g.equip.grounds
// のLv0〜5）で段階的に解禁される屋外装飾のカタログ。既存のBASE_VIEW_PROPSと違い、
// 各項目にminLevelを持たせゲーム状態（g）に応じてBaseView側でフィルタする
// （`components/base/BaseView.jsx`参照）。位置はコース・クラブハウスのプラザ・既存の
// 小物のいずれとも重ならないよう選んである。
export const BASE_VIEW_GROUNDS_DECOR = [
  { key: "pond", minLevel: 1, kind: "pond", w: 1.5, l: 4.6 },
  { key: "hedge", minLevel: 2, kind: "hedge", w: -6.2, l: -5.0 },
  { key: "gym", minLevel: 3, kind: "gym", w: -6.5, l: 5.2 },
  { key: "arch", minLevel: 4, kind: "arch", w: 3.9, l: 0.3 },
  { key: "fountain", minLevel: 5, kind: "fountain", w: -1.8, l: -5.2 },
];
