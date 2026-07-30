// BaseView（敷地画面）の投影・建物・周回路・地面・季節パレット・小物の静的データ。
// Step13第3弾で新設 → Wave D（磨き込み）→ Wave D2（カイロソフト準拠の再設計）
// → Wave E（カメラ＋カットアウト部屋）。
//
// Wave D2で投影軸の非対称（w軸長26.83 / l軸長24.6で正しい菱形になっていなかった）を
// Px=Lx・Py=-Lyへ修正した（詳細はDEVLOG §10）。
// Wave E-1で固定キャンバス（旧BASE_VIEW_CANVAS）を廃止し、ResizeObserverで実ピクセルに
// viewBoxを一致させる方式へ変更した（`components/base/BaseView.jsx`参照）。カメラの
// ズーム/パンが拡縮を全て担うため、preserveAspectRatioへの依存も無くなった。
export const BASE_VIEW_PROJ = { cx0: 240, cy0: 600, Px: 26, Py: 13, Lx: 26, Ly: -13 };

// 建物5棟＝5部屋。screen y が一定になる直線（w-l が一定）上に等間隔で並べ、手前の
// 周回路を主役にする。w = 1.75k - 11, l = 1.75k + 11 （k=-2..2）で w-l=-22 固定 →
// 全棟が screen y=314 に揃い、横方向は screen x = 240 + 91k（footprint幅88pxとほぼ等間隔）。
//
// Wave E-2でカイロソフト式の「床＋奥2壁だけのカットアウト部屋」へ全面変更。3D箱の外観
// （壁2面＋屋根＋窓＋屋上設備）は廃止し、`roof`/`floorHeight`（旧：施設Lvに応じた階数の
// 高さ）フィールドを削除、代わりに`floor`（床タイル色）と`wallHeight`（奥2壁の高さ・
// 固定値。カイロソフトの間仕切り壁のように、実際の建物の全高より低く据え置く）を追加した。
// 施設Lvに応じた表現は什器の数・種類（Wave E-3）に移す。
// wallLight/wallDark＝奥2壁の明/暗面、floor＝床タイル色、accent＝扉枠・見出しのアクセント色。
const mk = (k, rest) => ({ w: 1.75 * k - 11, l: 1.75 * k + 11, ...rest });
export const BASE_VIEW_BUILDINGS = [
  mk(-2, { key: "training", levelKey: "training", levelMax: 5, label: "トレーニング棟", icon: "💪",
    hw: 0.85, hl: 0.85, wallHeight: 34, wallLight: "#a8d4b8", wallDark: "#7fb894", floor: "#e8dcc0", accent: "#2f8f5c" }),
  mk(-1, { key: "mechanic", levelKey: "mechanic", levelMax: 5, label: "メカニック工房", icon: "🔧",
    hw: 0.85, hl: 0.85, wallHeight: 34, wallLight: "#e8d3a0", wallDark: "#d8bd83", floor: "#d9d1c2", accent: "#c9a23c" }),
  mk(0, { key: "clubhouse", levelKey: "clubhouse", levelMax: 2, label: "クラブハウス", icon: "🏠",
    hw: 0.98, hl: 0.98, wallHeight: 36, wallLight: "#f0ebe0", wallDark: "#e6e0d2", floor: "#c9a876", accent: "#e05050" }),
  mk(1, { key: "medical", levelKey: "medical", levelMax: 3, label: "メディカル/監督室", icon: "⚕",
    hw: 0.85, hl: 0.85, wallHeight: 34, wallLight: "#cfe2ee", wallDark: "#a9c8dd", floor: "#eef2f4", accent: "#4f8fe8" }),
  mk(2, { key: "scout", levelKey: "scout", levelMax: 3, label: "スカウト事務所", icon: "🔍",
    hw: 0.85, hl: 0.85, wallHeight: 34, wallLight: "#ddc4e8", wallDark: "#c9a8d8", floor: "#ded3c8", accent: "#c98bf0" }),
];

// 練習コース（world原点中心）。Wave Dの1.7倍程度に拡大し、縦長キャンバスの下半分の主役にする。
export const BASE_VIEW_LOOP = { pathW: 4.5, pathL: 3.0, cornerR: 1.4, trackHalfWidth: 0.5 };

// 建物が建つ舗装プラザ（world座標のw/l範囲。1枚の大きなポリゴンとして描く）。
// 建物footprint（w:-15.65〜-6.35 / l:6.7〜15.3）を完全に含み、左右の頂点は画面外
// （x=-98 / x=656）に出るため、画面内には上下の斜辺だけが見えて自然な敷地の縁になる。
export const BASE_VIEW_PLAZA = { wMin: -18, wMax: -3, lMin: 5, lMax: 19 };

// 芝の装飾（草むら等）を散らす範囲。市松塗りは廃止したので、ここは「点在させる装飾の範囲」。
// viewBox全域(x:0-480 / y:0-860)を world へ逆写像した範囲（w:-27.6〜14.6 / l:-14.6〜27.6）を
// 余裕をもって覆う。
export const BASE_VIEW_GROUND = { wMin: -30, wMax: 17, lMin: -17, lMax: 30, scatterStep: 2.0 };

// 季節ごとの配色（domain/season/baseViewLayout.jsのseasonOf(month)のキーと対応）。
// grassは一様な1色（Wave Dの明暗交互＝市松模様を廃止）、grassPatchは点在させる濃淡用。
export const BASE_VIEW_SEASON_PALETTE = {
  spring: { sky: "#8fc9e8", grass: "#7cc45c", grassPatch: "#6fb551", plaza: "#cfc6ad", plazaEdge: "#b3aa92", treeLeaf: "#f2a8c6", treeMid: "#e394b4", treeDark: "#c97a9b", snow: null },
  summer: { sky: "#79bfe0", grass: "#57ab45", grassPatch: "#4d9c3d", plaza: "#c8bfa6", plazaEdge: "#aca48c", treeLeaf: "#57b44a", treeMid: "#43963a", treeDark: "#33762d", snow: null },
  autumn: { sky: "#a8c8dc", grass: "#b8924c", grassPatch: "#a88443", plaza: "#c6b99b", plazaEdge: "#aa9e83", treeLeaf: "#e0873a", treeMid: "#c96f2a", treeDark: "#a5551d", snow: null },
  winter: { sky: "#c3d6e4", grass: "#e8eef0", grassPatch: "#d8e2e6", plaza: "#d2d8d8", plazaEdge: "#b9c1c2", treeLeaf: "#dfe8ea", treeMid: "#c2ced2", treeDark: "#9aa8ad", snow: "#f7fbff" },
};

// 小物の固定配置。以下は s=w+l（screen x を決める軸）・d=w-l（screen y を決める軸）で
// 設計し、w=(s+d)/2, l=(s-d)/2 に変換した値（screen x=240+26s, y=600+13d）。
//
// backTrees は d=-44（screen y=28）＝画面最上部の並木帯。Wave D2初版では建物列のすぐ奥
// （かつ建物と同じ間隔）に置いたため、各棟の真後ろから樹冠が顔を出して「屋根の上に木が
// 生えている」ように見えていた。建物(y=314)から十分離した最上部へ移動して解消した。
export const BASE_VIEW_PROPS = {
  backTrees: [
    { w: -25.5, l: 18.5 }, { w: -23.75, l: 20.25 }, { w: -22, l: 22 },
    { w: -20.25, l: 23.75 }, { w: -18.5, l: 25.5 }, { w: -16.75, l: 27.25 },
  ],
  trees: [
    { w: -4.25, l: 4.25 }, { w: 4.5, l: 4.5 }, { w: -8.6, l: 0.6 },
    { w: 3.15, l: -9.15 }, { w: 9.15, l: -3.15 }, { w: 7.75, l: -7.75 },
    { w: 7.0, l: -10.0 }, { w: 10.0, l: -7.0 }, { w: 8.0, l: -2.0 },
  ],
  benches: [{ w: -5.0, l: 10.0 }, { w: -13.5, l: 5.5 }],
  lamps: [{ w: -15.5, l: 8.5 }, { w: -8.0, l: 16.0 }, { w: -5.0, l: 5.0 }],
  bikeRack: { w: -10.0, l: 6.0 },
  teamCar: { w: -4.75, l: 6.75 },
};
