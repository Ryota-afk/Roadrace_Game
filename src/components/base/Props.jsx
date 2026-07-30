// BaseView（敷地画面）の小物（木・ベンチ・街灯・自転車ラック・チームカー）。
// Wave D（磨き込み）で新設。「広い芝に建物5棟だけが点在」する密度不足を解消するための
// 充填要素。data/baseViewBuildings.jsのBASE_VIEW_PROPSに固定配置され、他の描画要素
// （建物・選手）と同じ奥行きソート(sortY)の対象になるようpropItems()が{sortY,node}の
// 配列を返す。
import React from "react";
import { isoProject } from "../../domain/season/baseViewLayout.js";

function treeNode(p, palette, key) {
  const snow = !!palette.snow;
  return (
    <g key={key}>
      <ellipse cx={p.x} cy={p.y + 1} rx="5" ry="1.6" fill="#000" opacity="0.18" />
      <rect x={p.x - 1} y={p.y - 6} width="2" height="6" fill="#5a4632" />
      <circle cx={p.x} cy={p.y - 10} r="6" fill={palette.treeLeaf} />
      <circle cx={p.x - 4} cy={p.y - 7} r="4.2" fill={palette.treeLeaf2} />
      <circle cx={p.x + 4} cy={p.y - 7} r="4.2" fill={palette.treeLeaf2} />
      {snow && <ellipse cx={p.x} cy={p.y - 13} rx="4.2" ry="2.4" fill={palette.snow} opacity="0.85" />}
    </g>
  );
}
function benchNode(p, key) {
  return (
    <g key={key}>
      <rect x={p.x - 6} y={p.y - 4} width="12" height="2" fill="#8a6a45" />
      <rect x={p.x - 5} y={p.y - 2} width="1.4" height="3" fill="#4a3a28" />
      <rect x={p.x + 3.6} y={p.y - 2} width="1.4" height="3" fill="#4a3a28" />
    </g>
  );
}
function lampNode(p, key) {
  return (
    <g key={key}>
      <line x1={p.x} y1={p.y} x2={p.x} y2={p.y - 14} stroke="#6a6f78" strokeWidth="1" />
      <circle cx={p.x} cy={p.y - 15} r="2.2" fill="#ffe9a8" opacity="0.9" />
    </g>
  );
}
function bikeRackNode(p, key) {
  return (
    <g key={key}>
      <rect x={p.x - 5} y={p.y - 6} width="8" height="1" fill="#7a828c" />
      {[-4, -1, 2].map((dx, i) => <rect key={i} x={p.x + dx} y={p.y - 5} width="1" height="5" fill="#7a828c" />)}
    </g>
  );
}
function teamCarNode(p, key) {
  return (
    <g key={key}>
      <ellipse cx={p.x} cy={p.y + 1} rx="10" ry="2" fill="#000" opacity="0.2" />
      <rect x={p.x - 9} y={p.y - 7} width="18" height="7" rx="1.5" fill="#3a6fd8" />
      <rect x={p.x - 4} y={p.y - 11} width="9" height="5" rx="1" fill="#3a6fd8" />
      <circle cx={p.x - 5} cy={p.y} r="2" fill="#181a1e" />
      <circle cx={p.x + 5} cy={p.y} r="2" fill="#181a1e" />
    </g>
  );
}

export function propItems(proj, props, palette) {
  const items = [];
  const push = (w, l, render) => { const p = isoProject(w, l, 0, proj); items.push({ sortY: p.y, node: render(p) }); };
  (props.trees || []).forEach((t, i) => push(t.w, t.l, (p) => treeNode(p, palette, `tree${i}`)));
  (props.benches || []).forEach((b, i) => push(b.w, b.l, (p) => benchNode(p, `bench${i}`)));
  (props.lamps || []).forEach((l, i) => push(l.w, l.l, (p) => lampNode(p, `lamp${i}`)));
  if (props.bikeRack) push(props.bikeRack.w, props.bikeRack.l, (p) => bikeRackNode(p, "bikerack"));
  if (props.teamCar) push(props.teamCar.w, props.teamCar.l, (p) => teamCarNode(p, "teamcar"));
  return items;
}
