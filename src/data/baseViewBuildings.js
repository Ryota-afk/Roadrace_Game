// BaseView（敷地画面）の建物スロット定義。Step13第3弾。座標は固定レイアウト
// （プレイヤーは配置を変更できない＝セーブに座標を持つ必要がない）。
// levelKeyはdomain/season/baseViewLayout.jsのbuildingLevels(g)が返すキーと対応する。
// v1: hw/hl/baseHeightが小さすぎ、フルスケール(Lv最大)でも壁面がほぼ見えず「旗」のような
// 見た目になっていた実機確認済みの不具合を修正し、キャンバス(480x300)に対して十分な
// サイズへ引き上げた（詳細はDEVLOG §10参照）。
export const BASE_VIEW_BUILDINGS = [
  { key: "clubhouse", levelKey: "clubhouse", levelMax: 2, label: "クラブハウス", w: 0, l: -4.0, hw: 1.15, hl: 0.75, baseHeight: 36, wallL: "#5a6478", wallR: "#454e60", roof: "#e05050" },
  { key: "training", levelKey: "training", levelMax: 5, label: "トレーニング棟", w: -3.4, l: -3.6, hw: 0.9, hl: 0.6, baseHeight: 26, wallL: "#4d7a5e", wallR: "#365945", roof: "#2f8f5c" },
  { key: "mechanic", levelKey: "mechanic", levelMax: 5, label: "メカニック工房", w: 3.4, l: -3.6, hw: 0.9, hl: 0.6, baseHeight: 26, wallL: "#8a774f", wallR: "#5f5136", roof: "#c9a23c" },
  { key: "medical", levelKey: "medical", levelMax: 3, label: "メディカル/監督室", w: -3.4, l: 3.6, hw: 0.8, hl: 0.55, baseHeight: 22, wallL: "#4d6a7a", wallR: "#354a56", roof: "#4f8fe8" },
  { key: "scout", levelKey: "scout", levelMax: 3, label: "スカウト事務所", w: 3.4, l: 3.6, hw: 0.8, hl: 0.55, baseHeight: 22, wallL: "#7a4d8a", wallR: "#563660", roof: "#c98bf0" },
];

// 選手が周回する敷地内ループ路の半幅（w方向）・半奥行き（l方向）。BASE_VIEW_BUILDINGSの
// 外周（|l|=3.6〜4.0付近）より内側に収まるよう調整済み。
export const BASE_VIEW_LOOP = { pathW: 2.6, pathL: 2.1 };

// 地面タイルの描画範囲（world座標）。建物footprint（|w|,|l|最大4.8前後）を覆う広さに設定。
export const BASE_VIEW_GROUND = { wMin: -4.8, wMax: 4.8, lMin: -4.6, lMax: 4.6, tileStep: 0.7 };
