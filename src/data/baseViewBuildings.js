// BaseView（敷地画面）の投影・建物・周回路・地面・季節パレット・小物の静的データ。
// Step13第3弾で新設 → Wave D（磨き込み）→ Wave D2（カイロソフト準拠の再設計）。
//
// Wave D2で見直した点（実機スクショに基づく診断・詳細はDEVLOG §10）：
//  ・投影軸が非対称（w軸長26.83 / l軸長24.6）で正しい菱形になっていなかった → Px=Lx・Py=-Lyへ
//  ・屋根が巨大な原色の平面菱形で建物が「色板」に見えていた → 階高を10-14px→26pxへ引き上げ、
//    屋根は壁色から導く暗色＋軒の張り出しにして主張を弱めた
//  ・キャンバスが横長(480x300)でスマホの画面高の27%しか占めていなかった → 480x720の縦長へ
// キャンバス比はスマホ実機(390x844→SVG領域362x692・比0.523)に近い0.558にしてある。
// preserveAspectRatio="xMidYMid slice" は「はみ出す方向を切り落として敷き詰める」ため、
// viewBox比が実機比から離れるほど左右が大きく欠ける（480x720では左右計103px＝端の建物が
// 半分見切れていた）。0.558なら欠けは左右計30px程度に収まる。
export const BASE_VIEW_PROJ = { cx0: 240, cy0: 600, Px: 26, Py: 13, Lx: 26, Ly: -13 };
export const BASE_VIEW_CANVAS = { W: 480, H: 860 };

// 建物5棟。screen y が一定になる直線（w-l が一定）上に等間隔で並べ、手前の周回路を主役にする。
// w = 1.75k - 11, l = 1.75k + 11 （k=-2..2）で w-l=-22 固定 → 全棟が screen y=314 に揃い、
// 横方向は screen x = 240 + 91k（＝footprint幅88pxとほぼ等間隔で隣接）。
// wallLight=光の当たる面(+l側)、wallDark=陰の面(-l側)、roof=軒の暗色、accent=看板帯。
const mk = (k, rest) => ({ w: 1.75 * k - 11, l: 1.75 * k + 11, ...rest });
export const BASE_VIEW_BUILDINGS = [
  mk(-2, { key: "training", levelKey: "training", levelMax: 5, label: "トレーニング棟", icon: "💪",
    hw: 0.85, hl: 0.85, floorHeight: 26, wallLight: "#7fb894", wallDark: "#54876a", roof: "#2f4a3c", accent: "#2f8f5c" }),
  mk(-1, { key: "mechanic", levelKey: "mechanic", levelMax: 5, label: "メカニック工房", icon: "🔧",
    hw: 0.85, hl: 0.85, floorHeight: 26, wallLight: "#d8bd83", wallDark: "#a68f5d", roof: "#4c3f28", accent: "#c9a23c" }),
  mk(0, { key: "clubhouse", levelKey: "clubhouse", levelMax: 2, label: "クラブハウス", icon: "🏠",
    hw: 0.98, hl: 0.98, floorHeight: 28, wallLight: "#e6e0d2", wallDark: "#b8b2a4", roof: "#7a3733", accent: "#e05050" }),
  mk(1, { key: "medical", levelKey: "medical", levelMax: 3, label: "メディカル/監督室", icon: "⚕",
    hw: 0.85, hl: 0.85, floorHeight: 26, wallLight: "#a9c8dd", wallDark: "#7b9bb2", roof: "#2c4152", accent: "#4f8fe8" }),
  mk(2, { key: "scout", levelKey: "scout", levelMax: 3, label: "スカウト事務所", icon: "🔍",
    hw: 0.85, hl: 0.85, floorHeight: 26, wallLight: "#c9a8d8", wallDark: "#9b7dab", roof: "#432f4f", accent: "#c98bf0" }),
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
