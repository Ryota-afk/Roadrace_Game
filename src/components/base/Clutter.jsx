// クラブハウス各部屋の小道具（Wave F-2 redo 追補・再改良版）。
// ユーザー指摘「部屋の間取り的に人が生活してる感がない。ショールームみたいに感じる」
// への1回目の対応（isoProjectの地面点から手加減のpxオフセットで小物を浮かせて描く方式）
// が、「それっぽく見えない、レイヤーもミスってる」と再度の却下を受けた。実機スクショで
// 確認したところ、支える箱も影も持たない小物（予備ホイールの輪・丸めたマット・
// コルクボード）が宙に浮いて見え、しかもクラブハウス全体の見出しバッジ（奥角の🏠）と
// 位置が重なっていた。
// **今回の方針**：どの小物も必ず`isoBox`（実什器と同じ箱＋影）を土台に持たせ、装飾は
// その箱の天面（`isoBoxFaces(...).top.N`＝実際に計算された天面座標）へ乗せる。
// 土台の無い"浮遊アイコン"は作らない。ユーザー要望のホワイトボード・椅子も追加した。
import React from "react";
import { isoBoxFaces } from "../../domain/season/baseViewLayout.js";

const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

function isoBox(w, l, hw, hl, h, proj, colDark, colLight, colTop) {
  const f = isoBoxFaces(w, l, hw, hl, h, proj);
  return (
    <>
      <polygon points={poly([f.botLeft, f.botFront, f.topFront, f.topLeft])} fill={colDark} stroke="#00000030" strokeWidth="0.4" />
      <polygon points={poly([f.botFront, f.botRight, f.topRight, f.topFront])} fill={colLight} stroke="#00000030" strokeWidth="0.4" />
      <polygon points={poly([f.top.N, f.top.E, f.top.S, f.top.W])} fill={colTop} stroke="#00000030" strokeWidth="0.4" />
    </>
  );
}

function shadow(w, l, hw, hl, proj) {
  const c = isoBoxFaces(w + 0.04, l - 0.04, hw, hl, 0, proj).corners;
  return <polygon points={poly([c.N, c.E, c.S, c.W])} fill="#000" opacity="0.14" />;
}

// トレーニング室：低い棚＋その天面に載せたウェイトプレート（天面座標に直接アンカーする）
function weightRackNode(w, l, proj, key) {
  const hw = 0.22, hl = 0.16, h = 5;
  const top = isoBoxFaces(w, l, hw, hl, h, proj).top.N;
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#6b5636", "#8a6f48", "#a3814f")}
      <ellipse cx={(top.x - 2.4).toFixed(1)} cy={(top.y - 0.6).toFixed(1)} rx="2.8" ry="1.3" fill="#3a3f46" stroke="#00000040" strokeWidth="0.4" />
      <ellipse cx={(top.x + 1.6).toFixed(1)} cy={(top.y - 1.1).toFixed(1)} rx="2.4" ry="1.1" fill="#4a4f58" stroke="#00000040" strokeWidth="0.4" />
    </g>
  );
}

// トレーニング室：低いテーブル＋その天面に載せたボトルとタオル
function waterTableNode(w, l, proj, key) {
  const hw = 0.2, hl = 0.16, h = 6;
  const top = isoBoxFaces(w, l, hw, hl, h, proj).top.N;
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#a89572", "#c9b48a", "#e0cda0")}
      <rect x={(top.x - 3.5).toFixed(1)} y={(top.y - 1.6).toFixed(1)} width="6.5" height="2" rx="0.8" fill="#e8ede8" opacity="0.92" />
      <rect x={(top.x + 1.6).toFixed(1)} y={(top.y - 6.4).toFixed(1)} width="2.2" height="5.4" rx="1" fill="#5aa3c9" />
      <rect x={(top.x + 2).toFixed(1)} y={(top.y - 7.4).toFixed(1)} width="1.4" height="1.2" fill="#2a5c78" />
    </g>
  );
}

// メカニック室：低い置き台＋その天面に立てかけた予備ホイール2本（宙に浮かせない）
function wheelRackNode(w, l, proj, key) {
  const hw = 0.18, hl = 0.16, h = 4;
  const top = isoBoxFaces(w, l, hw, hl, h, proj).top.N;
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#5a626c", "#7a828c", "#9aa0a6")}
      <circle cx={(top.x - 2).toFixed(1)} cy={(top.y - 6).toFixed(1)} r="5.4" fill="none" stroke="#2a2e33" strokeWidth="1.8" />
      <circle cx={(top.x + 3).toFixed(1)} cy={(top.y - 5).toFixed(1)} r="5.4" fill="none" stroke="#3a3f46" strokeWidth="1.8" />
    </g>
  );
}

// メカニック室：パーツ用クレート＋天面に置いた小部品
function partsCrateNode(w, l, proj, key) {
  const hw = 0.24, hl = 0.2, h = 6;
  const top = isoBoxFaces(w, l, hw, hl, h, proj).top.N;
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#6b5636", "#8a6f48", "#a3814f")}
      <circle cx={(top.x - 1.6).toFixed(1)} cy={top.y.toFixed(1)} r="1.4" fill="#8a8f99" />
      <circle cx={(top.x + 1.8).toFixed(1)} cy={(top.y - 0.6).toFixed(1)} r="1.1" fill="#8a8f99" />
    </g>
  );
}

// メディカル室：薬品棚（白い箱＋前面の赤十字）
function cabinetNode(w, l, proj, key) {
  const hw = 0.2, hl = 0.15, h = 11;
  const f = isoBoxFaces(w, l, hw, hl, h, proj);
  const cx = (f.botFront.x + f.topFront.x) / 2, cy = (f.botFront.y + f.topFront.y) / 2;
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#c7d3d8", "#eef4f6", "#ffffff")}
      <rect x={(cx - 1).toFixed(1)} y={(cy - 3).toFixed(1)} width="2" height="6" fill="#c9463c" />
      <rect x={(cx - 3).toFixed(1)} y={(cy - 1).toFixed(1)} width="6" height="2" fill="#c9463c" />
    </g>
  );
}

// メディカル室・スカウト室共通：椅子（背もたれは箱の天面から垂直に立てる）
function chairNode(w, l, proj, key) {
  const hw = 0.16, hl = 0.14, h = 5;
  const top = isoBoxFaces(w, l, hw, hl, h, proj).top.N;
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#7a5c3c", "#9c7a50", "#b89060")}
      <line x1={(top.x - 2.2).toFixed(1)} y1={top.y.toFixed(1)} x2={(top.x - 2.2).toFixed(1)} y2={(top.y - 6.5).toFixed(1)} stroke="#7a5c3c" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

// スカウト室：机の脇に立てるホワイトボード（2本脚＋パネル。archNode/gymNodeと同じ
// 「2本の脚＋その頂点を結ぶ形状」の実績のある描き方を踏襲）
function whiteboardNode(w, l, proj, key) {
  const proj0 = proj;
  const legA = isoBoxFaces(w, l - 0.35, 0, 0, 0, proj0).corners.N;
  const legB = isoBoxFaces(w, l + 0.35, 0, 0, 0, proj0).corners.N;
  const h = 15, panelH = 11;
  const topA = { x: legA.x, y: legA.y - h }, topB = { x: legB.x, y: legB.y - h };
  const botPanelA = { x: legA.x, y: legA.y - (h - panelH) }, botPanelB = { x: legB.x, y: legB.y - (h - panelH) };
  return (
    <g key={key}>
      <line x1={legA.x.toFixed(1)} y1={legA.y.toFixed(1)} x2={topA.x.toFixed(1)} y2={topA.y.toFixed(1)} stroke="#8a8f99" strokeWidth="1.4" />
      <line x1={legB.x.toFixed(1)} y1={legB.y.toFixed(1)} x2={topB.x.toFixed(1)} y2={topB.y.toFixed(1)} stroke="#8a8f99" strokeWidth="1.4" />
      <polygon points={poly([botPanelA, botPanelB, topB, topA])} fill="#f4f6f8" stroke="#8a8f99" strokeWidth="1" />
      <line x1={(topA.x + 2).toFixed(1)} y1={(topA.y + 3).toFixed(1)} x2={(topB.x - 2).toFixed(1)} y2={(topB.y + 7).toFixed(1)} stroke="#4f8fe8" strokeWidth="1" opacity="0.85" />
      <line x1={(topA.x + 2).toFixed(1)} y1={(topA.y + 7).toFixed(1)} x2={(topA.x + 6).toFixed(1)} y2={(topA.y + 5).toFixed(1)} stroke="#c9463c" strokeWidth="1" opacity="0.85" />
    </g>
  );
}

// スカウト室：床に置いた選手ファイルの束（低い箱として表現。浮遊する紙ではなく実体を持たせる）
function foldersNode(w, l, proj, key) {
  const hw = 0.26, hl = 0.22, h = 3;
  return <g key={key}>{shadow(w, l, hw, hl, proj)}{isoBox(w, l, hw, hl, h, proj, "#b89860", "#e8dfc8", "#f0e8d0")}</g>;
}

// 廊下：玄関そばの靴棚（低い台＋天面の靴）
function shoeRackNode(w, l, proj, key) {
  const hw = 0.34, hl = 0.14, h = 3.5;
  const top = isoBoxFaces(w, l, hw, hl, h, proj).top.N;
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#6b5636", "#8a6f48", "#a3814f")}
      <ellipse cx={(top.x - 4).toFixed(1)} cy={(top.y - 0.5).toFixed(1)} rx="2.4" ry="1.2" fill="#3a3f46" />
      <ellipse cx={(top.x + 3).toFixed(1)} cy={(top.y - 0.8).toFixed(1)} rx="2.4" ry="1.2" fill="#c9463c" />
    </g>
  );
}

const CLUTTER_RENDER = {
  weightRack: weightRackNode, waterTable: waterTableNode,
  wheelRack: wheelRackNode, partsCrate: partsCrateNode,
  cabinet: cabinetNode, chair: chairNode,
  whiteboard: whiteboardNode, folders: foldersNode,
  shoeRack: shoeRackNode,
};

export function clutterItems(proj, list) {
  return (list || []).map((c) => {
    const render = CLUTTER_RENDER[c.kind];
    return render ? render(c.w, c.l, proj, c.key) : null;
  }).filter(Boolean);
}
