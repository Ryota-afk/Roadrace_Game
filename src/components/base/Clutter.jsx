// クラブハウス各部屋の小道具（Wave F-2 redo 追補）。ユーザー指摘「部屋の間取り的に
// 人が生活してる感がない。ショールームみたいに感じる」への対応。主要什器
// （components/base/Station.jsx）は各部屋に1つだけで、それ以外の床が空きすぎていたため、
// 機能に応じた小道具を壁際・隅に追加し「誰かが実際に使っている痕跡」を出す。
// Props.jsx/Station.jsxと同様、このファイルもisoBox等の描画ヘルパーを自前で持つ
// （小さな箱状の小物ごとにファイルを分けて共有化するより、各ファイルが完結している方が
// 見通しが良いという既存の方針を踏襲）。
import React from "react";
import { isoProject, isoBoxFaces } from "../../domain/season/baseViewLayout.js";

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

// トレーニング室：床に積んだ予備のウェイトプレート
function weightsNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      <ellipse cx={p.x - 6} cy={p.y} rx="3.4" ry="1.6" fill="#3a3f46" stroke="#00000040" strokeWidth="0.5" />
      <ellipse cx={p.x - 2} cy={p.y - 1} rx="3.0" ry="1.4" fill="#4a4f58" stroke="#00000040" strokeWidth="0.5" />
      <ellipse cx={p.x + 2} cy={p.y - 2} rx="2.6" ry="1.2" fill="#3a3f46" stroke="#00000040" strokeWidth="0.5" />
    </g>
  );
}

// トレーニング室：壁に立てかけた丸めたマット
function matRollNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      <rect x={(p.x - 2).toFixed(1)} y={(p.y - 16).toFixed(1)} width="4" height="16" rx="2" fill="#3a7a9e" opacity="0.92" />
      <ellipse cx={p.x.toFixed(1)} cy={(p.y - 16).toFixed(1)} rx="2" ry="1.3" fill="#5aa3c9" />
    </g>
  );
}

// トレーニング室：ボトル＋タオル
function bottleNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      <rect x={(p.x - 4).toFixed(1)} y={(p.y - 1).toFixed(1)} width="8" height="2.4" rx="1" fill="#e8ede8" opacity="0.9" />
      <rect x={(p.x + 3).toFixed(1)} y={(p.y - 7).toFixed(1)} width="2.6" height="7" rx="1" fill="#5aa3c9" />
      <rect x={(p.x + 3.6).toFixed(1)} y={(p.y - 8.4).toFixed(1)} width="1.4" height="1.6" fill="#2a5c78" />
    </g>
  );
}

// メカニック室：壁に立てかけた予備ホイール
function wheelsNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      <circle cx={(p.x - 3).toFixed(1)} cy={(p.y - 8).toFixed(1)} r="6" fill="none" stroke="#2a2e33" strokeWidth="2" />
      <circle cx={(p.x + 2).toFixed(1)} cy={(p.y - 7).toFixed(1)} r="6" fill="none" stroke="#3a3f46" strokeWidth="2" />
    </g>
  );
}

// メカニック室：パーツ用クレート
function toolCrateNode(w, l, proj, key) {
  return <g key={key}>{shadow(w, l, 0.24, 0.2, proj)}{isoBox(w, l, 0.24, 0.2, 6, proj, "#6b5636", "#8a6f48", "#a3814f")}</g>;
}

// メカニック室：作業台まわりに散らばったボルト
function boltsScatterNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key} opacity="0.85">
      <circle cx={(p.x - 4).toFixed(1)} cy={(p.y - 1).toFixed(1)} r="1" fill="#8a8f99" />
      <circle cx={(p.x + 2).toFixed(1)} cy={(p.y + 1).toFixed(1)} r="1" fill="#8a8f99" />
      <circle cx={(p.x - 1).toFixed(1)} cy={(p.y + 2).toFixed(1)} r="0.8" fill="#8a8f99" />
    </g>
  );
}

// メディカル室：薬品棚（白い箱＋赤十字）
function cabinetNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      {shadow(w, l, 0.2, 0.14, proj)}
      {isoBox(w, l, 0.2, 0.14, 10, proj, "#c7d3d8", "#eef4f6", "#ffffff")}
      <rect x={(p.x - 1).toFixed(1)} y={(p.y - 9).toFixed(1)} width="2" height="6" fill="#c9463c" />
      <rect x={(p.x - 3).toFixed(1)} y={(p.y - 7).toFixed(1)} width="6" height="2" fill="#c9463c" />
    </g>
  );
}

// メディカル室・スカウト室共通：待合/来客用の小さな椅子
function chairNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      {shadow(w, l, 0.16, 0.14, proj)}
      {isoBox(w, l, 0.16, 0.14, 5, proj, "#7a5c3c", "#9c7a50", "#b89060")}
      <line x1={(p.x - 3).toFixed(1)} y1={(p.y - 5).toFixed(1)} x2={(p.x - 3).toFixed(1)} y2={(p.y - 11).toFixed(1)} stroke="#7a5c3c" strokeWidth="1.6" />
    </g>
  );
}

// メディカル室：処置の合間に使うサイドテーブル
function sideTableNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      {shadow(w, l, 0.2, 0.16, proj)}
      {isoBox(w, l, 0.2, 0.16, 6, proj, "#a89572", "#c9b48a", "#e0cda0")}
      <rect x={(p.x - 2.2).toFixed(1)} y={(p.y - 8).toFixed(1)} width="4.4" height="1.6" fill="#dfe6e9" />
    </g>
  );
}

// スカウト室：スカウト対象選手の写真を留めたコルクボード
function corkboardNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      <rect x={(p.x - 6).toFixed(1)} y={(p.y - 16).toFixed(1)} width="12" height="9" rx="1" fill="#c9a06a" stroke="#8a6a45" strokeWidth="1" />
      <circle cx={(p.x - 3).toFixed(1)} cy={(p.y - 12).toFixed(1)} r="1.4" fill="#f0e0c0" />
      <circle cx={p.x.toFixed(1)} cy={(p.y - 13).toFixed(1)} r="1.4" fill="#f0e0c0" />
      <circle cx={(p.x + 3).toFixed(1)} cy={(p.y - 11).toFixed(1)} r="1.4" fill="#f0e0c0" />
    </g>
  );
}

// スカウト室：床に積んだ書類・選手ファイルの束
function foldersNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      <rect x={(p.x - 5).toFixed(1)} y={(p.y - 3).toFixed(1)} width="10" height="3.4" rx="0.6" fill="#e8dfc8" stroke="#00000020" strokeWidth="0.4" />
      <rect x={(p.x - 4).toFixed(1)} y={(p.y - 5.5).toFixed(1)} width="8" height="2.8" rx="0.6" fill="#d8c9a8" />
    </g>
  );
}

// 廊下：玄関そばの靴棚
function shoeRackNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      <rect x={(p.x - 8).toFixed(1)} y={(p.y - 4).toFixed(1)} width="16" height="2" fill="#7a5c3c" />
      <ellipse cx={(p.x - 4).toFixed(1)} cy={(p.y - 1.5).toFixed(1)} rx="2.6" ry="1.3" fill="#3a3f46" />
      <ellipse cx={(p.x + 3).toFixed(1)} cy={(p.y - 1.5).toFixed(1)} rx="2.6" ry="1.3" fill="#c9463c" />
    </g>
  );
}

// 廊下：玄関前の小さな敷物
function rugNode(w, l, proj, key) {
  const c = isoBoxFaces(w, l, 0.6, 0.4, 0, proj).corners;
  return <polygon key={key} points={poly([c.N, c.E, c.S, c.W])} fill="#b06a4a" opacity="0.65" />;
}

const CLUTTER_RENDER = {
  weights: weightsNode, matRoll: matRollNode, bottle: bottleNode,
  wheels: wheelsNode, toolCrate: toolCrateNode, boltsScatter: boltsScatterNode,
  cabinet: cabinetNode, chair: chairNode, sideTable: sideTableNode,
  corkboard: corkboardNode, folders: foldersNode,
  shoeRack: shoeRackNode, rug: rugNode,
};

export function clutterItems(proj, list) {
  return (list || []).map((c) => {
    const render = CLUTTER_RENDER[c.kind];
    return render ? render(c.w, c.l, proj, c.key) : null;
  }).filter(Boolean);
}
