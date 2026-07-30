// クラブハウス内の持ち場（什器）1つぶんの描画。Wave E-2 redoで新設。
// 「大きな室内にそれぞれ対応した場所（机とか）がある」というユーザーのスケッチに基づき、
// トレーニング/メカニック/メディカル/スカウトの4持ち場それぞれに、ひと目で何の場所か
// 分かる什器のシルエットを置く。什器の種類・数を施設Lvに応じて増やすのはWave E-3で行う
// （現時点ではkindごとに固定1つ）。
import React from "react";
import { isoBoxFaces } from "../../domain/season/baseViewLayout.js";

const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

// 天板が水平な低い箱（机・作業台・診察台の共通形状）。暗い面→明るい面→天面の順。
function tableBox(w, l, hw, hl, h, proj, legColor, topColor) {
  const f = isoBoxFaces(w, l, hw, hl, h, proj);
  return (
    <>
      <polygon points={poly([f.botLeft, f.botFront, f.topFront, f.topLeft])} fill={legColor} stroke="#00000030" strokeWidth="0.5" />
      <polygon points={poly([f.botFront, f.botRight, f.topRight, f.topFront])} fill={legColor} stroke="#00000030" strokeWidth="0.5" />
      <polygon points={poly([f.top.N, f.top.E, f.top.S, f.top.W])} fill={topColor} stroke="#00000030" strokeWidth="0.5" />
    </>
  );
}

function shadow(w, l, hw, hl, proj) {
  const c = isoBoxFaces(w + 0.05, l - 0.05, hw, hl, 0, proj).corners;
  return <polygon points={poly([c.N, c.E, c.S, c.W])} fill="#000" opacity="0.16" />;
}

// ローラー台：低い台＋前輪を固定するローラー2本（円で表現）。
function RollerFurniture({ w, l, proj }) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N; // 中心のscene座標として流用
  return (
    <g>
      {shadow(w, l, 0.55, 0.32, proj)}
      {tableBox(w, l, 0.5, 0.28, 7, proj, "#5a6068", "#7a828c")}
      <circle cx={p.x - 10} cy={p.y - 4} r="4.2" fill="none" stroke="#2a2e33" strokeWidth="1.6" />
      <circle cx={p.x + 10} cy={p.y - 4} r="4.2" fill="none" stroke="#2a2e33" strokeWidth="1.6" />
    </g>
  );
}

// 作業台：天板＋自転車フレームらしき斜めの線＋工具箱。
function WorkbenchFurniture({ w, l, proj }) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  return (
    <g>
      {shadow(w, l, 0.5, 0.42, proj)}
      {tableBox(w, l, 0.46, 0.38, 10, proj, "#6b5636", "#a3814f")}
      <line x1={p.x - 8} y1={p.y - 12} x2={p.x + 8} y2={p.y - 16} stroke="#c9ced4" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx={p.x - 8} cy={p.y - 12} r="2.6" fill="none" stroke="#c9ced4" strokeWidth="1.3" />
      <circle cx={p.x + 8} cy={p.y - 16} r="2.6" fill="none" stroke="#c9ced4" strokeWidth="1.3" />
      <rect x={p.x - 12} y={p.y - 8} width="6" height="4" fill="#c9463c" />
    </g>
  );
}

// 診察台：白い長いベッド＋横の小さなワゴン。
function MedicalFurniture({ w, l, proj }) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  return (
    <g>
      {shadow(w, l, 0.62, 0.30, proj)}
      {tableBox(w, l, 0.58, 0.26, 8, proj, "#c7d3d8", "#eef4f6")}
      <rect x={p.x + 10} y={p.y - 12} width="7" height="9" rx="1" fill="#dfe6e9" stroke="#00000030" strokeWidth="0.6" />
    </g>
  );
}

// スカウト用のデスク：天板＋ノートPC状の板＋書類の山。
function DeskFurniture({ w, l, proj }) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  return (
    <g>
      {shadow(w, l, 0.46, 0.34, proj)}
      {tableBox(w, l, 0.42, 0.3, 9, proj, "#5c4a68", "#8a6fa0")}
      <rect x={p.x - 6} y={p.y - 15} width="10" height="6" rx="0.8" fill="#2a2c31" />
      <rect x={p.x + 6} y={p.y - 11} width="5" height="4" fill="#e8dfc8" />
    </g>
  );
}

const FURNITURE = { roller: RollerFurniture, workbench: WorkbenchFurniture, medical: MedicalFurniture, desk: DeskFurniture };

export function Station({ s, proj, selected }) {
  const Furniture = FURNITURE[s.kind] || DeskFurniture;
  const label = isoBoxFaces(s.w, s.l, 0, 0, 0, proj).corners.N;
  return (
    <g opacity={selected ? 1 : 0.98}>
      <Furniture w={s.w} l={s.l} proj={proj} />
      <g transform={`translate(${label.x.toFixed(1)},${(label.y - 24).toFixed(1)})`}>
        <rect x="-8" y="-9" width="16" height="14" rx="3" fill={s.accent} opacity="0.92" />
        <text x="0" y="1.5" textAnchor="middle" fontSize="9" style={{ pointerEvents: "none" }}>{s.icon}</text>
      </g>
      {selected && <circle cx={label.x} cy={label.y - 4} r="16" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.5" />}
    </g>
  );
}
