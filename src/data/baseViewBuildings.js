// BaseView（敷地画面）の建物・周回路・地面・季節パレットの静的データ。
// Step13第3弾で新設・Wave D（磨き込み）で全面拡張。座標は固定レイアウト
// （プレイヤーは配置を変更できない＝セーブに座標を持つ必要がない）。
// levelKeyはdomain/season/baseViewLayout.jsのbuildingLevels(g)が返すキーと対応する。
//
// Wave D：施設Lvで「建物全体を縮小」する旧方式（footprintごと小さくなり豆粒化・壁面も
// 屋根に隠れて「旗」に見える不具合があった）をやめ、footprintは固定のまま階数(1〜3F)が
// 増える表現に変更した。5棟は画面奥に一列（screen y一定になるよう w,l を選定）に配置し、
// 手前の周回路（練習コース）を主役に据える構図にした（詳細な導出はDEVLOG §10参照）。
export const BASE_VIEW_BUILDINGS = [
  { key: "training", levelKey: "training", levelMax: 5, label: "トレーニング棟", icon: "💪",
    w: -4.10, l: 0.33, hw: 0.85, hl: 0.60, floorHeight: 10,
    wallL: "#4d7a5e", wallR: "#365945", roof: "#2f8f5c", trim: "#bfe8cf", winCols: 3 },
  { key: "mechanic", levelKey: "mechanic", levelMax: 5, label: "メカニック工房", icon: "🔧",
    w: -3.15, l: 1.36, hw: 0.85, hl: 0.60, floorHeight: 10,
    wallL: "#8a774f", wallR: "#5f5136", roof: "#c9a23c", trim: "#f3ddaa", winCols: 3 },
  { key: "clubhouse", levelKey: "clubhouse", levelMax: 2, label: "クラブハウス", icon: "🏠",
    w: -2.20, l: 2.40, hw: 1.10, hl: 0.75, floorHeight: 14,
    wallL: "#5a6478", wallR: "#454e60", roof: "#e05050", trim: "#ffd3d0", winCols: 4 },
  { key: "medical", levelKey: "medical", levelMax: 3, label: "メディカル/監督室", icon: "⚕",
    w: -1.25, l: 3.44, hw: 0.75, hl: 0.55, floorHeight: 8,
    wallL: "#4d6a7a", wallR: "#354a56", roof: "#4f8fe8", trim: "#cfe4ff", winCols: 2 },
  { key: "scout", levelKey: "scout", levelMax: 3, label: "スカウト事務所", icon: "🔍",
    w: -0.30, l: 4.47, hw: 0.75, hl: 0.55, floorHeight: 8,
    wallL: "#7a4d8a", wallR: "#563660", roof: "#c98bf0", trim: "#ecd6fb", winCols: 2 },
];

// 選手が周回する練習コース。半幅(w方向)pathW・半奥行き(l方向)pathL・4隅の丸め半径cornerR、
// 帯の半幅trackHalfWidth。cornerR/trackHalfWidthはpathW・pathLより小さい必要がある。
export const BASE_VIEW_LOOP = { pathW: 2.6, pathL: 1.6, cornerR: 0.9, trackHalfWidth: 0.32 };

// 地面タイルの描画範囲（world座標）。建物5棟の配置＋周回路＋手前の余白を覆う広さ。
export const BASE_VIEW_GROUND = { wMin: -5.6, wMax: 3.6, lMin: -3.2, lMax: 5.8, tileStep: 0.95 };

// 季節ごとの配色パレット（domain/season/baseViewLayout.jsのseasonOf(month)のキーと対応）。
export const BASE_VIEW_SEASON_PALETTE = {
  spring: { sky: "#cfe9c8", grassLight: "#8ccb6d", grassDark: "#7ebd62", plaza: "#d8cfae", treeLeaf: "#f6b8d0", treeLeaf2: "#8fcf6a", snow: null },
  summer: { sky: "#bfe3ee", grassLight: "#5cb24b", grassDark: "#52a542", plaza: "#d0c8a8", treeLeaf: "#3f9a3a", treeLeaf2: "#4a9c38", snow: null },
  autumn: { sky: "#f0dcb0", grassLight: "#c59952", grassDark: "#b78e49", plaza: "#d6c7a0", treeLeaf: "#d9762e", treeLeaf2: "#c9962f", snow: null },
  winter: { sky: "#e4edf5", grassLight: "#eaf1ef", grassDark: "#dfe8e5", plaza: "#dfe4e2", treeLeaf: "#e9f0ee", treeLeaf2: "#c8d6d2", snow: "#f7fbff" },
};

// 小物（木・フェンス・什器等）の固定配置。footprintと重ならない位置に手作業で配置。
export const BASE_VIEW_PROPS = {
  trees: [
    { w: 2.9, l: -2.7 }, { w: 1.6, l: -2.9 }, { w: 0.2, l: -3.0 }, { w: -1.2, l: -2.85 },
    { w: 3.1, l: 4.6 }, { w: 2.0, l: 5.4 }, { w: -3.0, l: -1.6 }, { w: -4.6, l: -0.9 },
    { w: 3.2, l: 1.2 }, { w: 2.8, l: -0.4 },
  ],
  benches: [{ w: 1.6, l: -1.5 }, { w: -0.6, l: -1.8 }],
  lamps: [{ w: 2.9, l: -1.1 }, { w: -1.6, l: -1.3 }, { w: 2.9, l: 3.0 }],
  bikeRack: { w: -1.6, l: 1.55 },
  teamCar: { w: 2.6, l: -2.1 },
};
