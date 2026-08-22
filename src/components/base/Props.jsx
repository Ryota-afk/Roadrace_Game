// BaseView（敷地画面）の小物。Wave Dで新設 → Wave D2で全てアイソメ格子に乗せ直した。
//
// Wave D2の見直し（詳細はDEVLOG §10）：Wave Dの小物はスクリーン座標の矩形・円で描いており
// （例：チームカーが軸平行の長方形）、周囲の建物・地面のアイソメ格子と角度が合わず
// ユーザー指摘の「斜めの角度が変」の直接原因になっていた。箱状のものは全て共通の
// isoBoxFaces()で描き、木も輪郭と陰影を持つ構造（幹＋3層の樹冠）へ作り直した。
import React from "react";
import { isoProject, isoBoxFaces } from "../../domain/season/baseViewLayout.js";
import { pixelObjectNode, treeSpriteNode } from "../sprites/pixelObject.jsx";
import { OBJ_SPRITES } from "../sprites/pixelObjectData.js";

const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

// 箱状の小物（車・ベンチ・ラック等）の共通描画。暗い面→明るい面→天面の順。
function isoBox(w, l, hw, hl, h, proj, colDark, colLight, colTop) {
  const f = isoBoxFaces(w, l, hw, hl, h, proj);
  return (
    <>
      <polygon points={poly([f.botLeft, f.botFront, f.topFront, f.topLeft])} fill={colDark} stroke="#00000035" strokeWidth="0.5" />
      <polygon points={poly([f.botFront, f.botRight, f.topRight, f.topFront])} fill={colLight} stroke="#00000035" strokeWidth="0.5" />
      <polygon points={poly([f.top.N, f.top.E, f.top.S, f.top.W])} fill={colTop} stroke="#00000035" strokeWidth="0.5" />
    </>
  );
}

function shadowDiamond(w, l, hw, hl, proj) {
  const c = isoBoxFaces(w + 0.08, l - 0.08, hw, hl, 0, proj).corners;
  return <polygon points={poly([c.N, c.E, c.S, c.W])} fill="#000" opacity="0.16" />;
}

// 第19弾: ドット絵化（sprites/pixelObjectData.jsの静的rows）。季節パレット・冠雪差分は
// treeSpriteNode側でlegendを動的に組む。影もスプライト側ヘルパーが敷く。
function treeNode(w, l, proj, palette, key) {
  const base = isoProject(w, l, 0, proj);
  return treeSpriteNode({ x: base.x, y: base.y, palette, key });
}

function benchNode(w, l, proj, key) {
  return <g key={key}>{shadowDiamond(w, l, 0.30, 0.16, proj)}{isoBox(w, l, 0.28, 0.12, 5, proj, "#7c5c39", "#a07a4d", "#b98d59")}</g>;
}

function lampNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      {shadowDiamond(w, l, 0.14, 0.10, proj)}
      <polygon points={`${(p.x - 1.4).toFixed(1)},${p.y.toFixed(1)} ${(p.x + 1.4).toFixed(1)},${p.y.toFixed(1)} ${(p.x + 0.9).toFixed(1)},${(p.y - 24).toFixed(1)} ${(p.x - 0.9).toFixed(1)},${(p.y - 24).toFixed(1)}`} fill="#6a707a" />
      <ellipse cx={p.x} cy={(p.y - 26).toFixed(1)} rx="3.6" ry="2.8" fill="#ffe9a8" stroke="#8a8f99" strokeWidth="0.8" />
    </g>
  );
}

function bikeRackNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      {shadowDiamond(w, l, 0.34, 0.18, proj)}
      {[-0.22, 0, 0.22].map((d, i) => {
        const a = isoProject(w + d, l - 0.14, 0, proj), b = isoProject(w + d, l + 0.14, 0, proj);
        return <g key={i}>
          <line x1={a.x.toFixed(1)} y1={a.y.toFixed(1)} x2={a.x.toFixed(1)} y2={(a.y - 9).toFixed(1)} stroke="#8a929c" strokeWidth="1.6" />
          <line x1={b.x.toFixed(1)} y1={b.y.toFixed(1)} x2={b.x.toFixed(1)} y2={(b.y - 9).toFixed(1)} stroke="#8a929c" strokeWidth="1.6" />
          <line x1={a.x.toFixed(1)} y1={(a.y - 9).toFixed(1)} x2={b.x.toFixed(1)} y2={(b.y - 9).toFixed(1)} stroke="#8a929c" strokeWidth="1.6" />
        </g>;
      })}
    </g>
  );
}

// チームカー（第19弾: ドット絵化）。ルーフキャリアのスペアホイール2本＝ロードレースの
// チームカーの記号として追加。
function teamCarNode(w, l, proj, key) {
  const base = isoProject(w, l, 0, proj);
  return pixelObjectNode({
    x: base.x, y: base.y, data: OBJ_SPRITES.teamCar, key,
    cacheKey: "obj-teamCar", shadowRx: 29.5, shadowRy: 14.5,
  });
}

// Wave F-1: 敷地整備（g.equip.grounds、施設ショップの新規購入枠）で段階的に解禁される
// 屋外装飾。data/baseViewBuildings.jsのBASE_VIEW_GROUNDS_DECORのkindごとに描く。

function pondNode(w, l, proj, key) {
  const outer = isoBoxFaces(w, l, 1.1, 0.85, 0, proj).corners;
  const inner = isoBoxFaces(w, l, 0.85, 0.62, 0, proj).corners;
  const c = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      <polygon points={poly([outer.N, outer.E, outer.S, outer.W])} fill="#3a7a9e" stroke="#2a5c78" strokeWidth="1" />
      <polygon points={poly([inner.N, inner.E, inner.S, inner.W])} fill="#5aa3c9" opacity="0.85" />
      <ellipse cx={c.x} cy={c.y} rx="9" ry="3.6" fill="#c9ecfa" opacity="0.5" />
    </g>
  );
}

function hedgeNode(w, l, proj, key) {
  const offs = [[-0.32, -0.18], [0.32, -0.12], [0, 0.26]];
  return (
    <g key={key}>
      {shadowDiamond(w, l, 0.55, 0.42, proj)}
      {offs.map(([dw, dl], i) => <g key={i}>{isoBox(w + dw, l + dl, 0.24, 0.22, 7, proj, "#3d7a3f", "#569c58", "#72bb74")}</g>)}
    </g>
  );
}

function gymNode(w, l, proj, key) {
  const a = isoProject(w - 0.32, l, 0, proj), b = isoProject(w + 0.32, l, 0, proj);
  return (
    <g key={key}>
      {shadowDiamond(w, l, 0.42, 0.22, proj)}
      <line x1={a.x.toFixed(1)} y1={a.y.toFixed(1)} x2={a.x.toFixed(1)} y2={(a.y - 22).toFixed(1)} stroke="#5a626c" strokeWidth="2.4" strokeLinecap="round" />
      <line x1={b.x.toFixed(1)} y1={b.y.toFixed(1)} x2={b.x.toFixed(1)} y2={(b.y - 22).toFixed(1)} stroke="#5a626c" strokeWidth="2.4" strokeLinecap="round" />
      <line x1={a.x.toFixed(1)} y1={(a.y - 22).toFixed(1)} x2={b.x.toFixed(1)} y2={(b.y - 22).toFixed(1)} stroke="#5a626c" strokeWidth="2.4" strokeLinecap="round" />
      <line x1={a.x.toFixed(1)} y1={(a.y - 12).toFixed(1)} x2={b.x.toFixed(1)} y2={(b.y - 12).toFixed(1)} stroke="#7a828c" strokeWidth="1.8" />
    </g>
  );
}

function archNode(w, l, proj, key) {
  const a = isoProject(w, l - 0.5, 0, proj), b = isoProject(w, l + 0.5, 0, proj);
  const topA = { x: a.x, y: a.y - 30 }, topB = { x: b.x, y: b.y - 30 };
  return (
    <g key={key}>
      {shadowDiamond(w, l, 0.15, 0.55, proj)}
      <line x1={a.x.toFixed(1)} y1={a.y.toFixed(1)} x2={topA.x.toFixed(1)} y2={topA.y.toFixed(1)} stroke="#8a6a45" strokeWidth="2.2" />
      <line x1={b.x.toFixed(1)} y1={b.y.toFixed(1)} x2={topB.x.toFixed(1)} y2={topB.y.toFixed(1)} stroke="#8a6a45" strokeWidth="2.2" />
      <line x1={topA.x.toFixed(1)} y1={topA.y.toFixed(1)} x2={topB.x.toFixed(1)} y2={topB.y.toFixed(1)} stroke="#8a6a45" strokeWidth="2.6" />
      <polygon points={`${topA.x.toFixed(1)},${topA.y.toFixed(1)} ${topB.x.toFixed(1)},${topB.y.toFixed(1)} ${((topA.x + topB.x) / 2).toFixed(1)},${((topA.y + topB.y) / 2 + 9).toFixed(1)}`} fill="#e05050" opacity="0.88" />
    </g>
  );
}

function fountainNode(w, l, proj, key) {
  const outer = isoBoxFaces(w, l, 1.0, 0.75, 0, proj).corners;
  const c = isoProject(w, l, 0, proj);
  return (
    <g key={key}>
      <polygon points={poly([outer.N, outer.E, outer.S, outer.W])} fill="#3a7a9e" stroke="#2a5c78" strokeWidth="1" />
      <ellipse cx={c.x} cy={c.y} rx="8" ry="3.2" fill="#c9ecfa" opacity="0.55" />
      {isoBox(w, l, 0.18, 0.18, 10, proj, "#8a8f99", "#a9aeb8", "#c3c8d1")}
      <line x1={c.x.toFixed(1)} y1={(c.y - 10).toFixed(1)} x2={(c.x - 4).toFixed(1)} y2={(c.y - 22).toFixed(1)} stroke="#c9ecfa" strokeWidth="1.4" opacity="0.85" />
      <line x1={c.x.toFixed(1)} y1={(c.y - 10).toFixed(1)} x2={(c.x + 4).toFixed(1)} y2={(c.y - 22).toFixed(1)} stroke="#c9ecfa" strokeWidth="1.4" opacity="0.85" />
      <circle cx={c.x.toFixed(1)} cy={(c.y - 24).toFixed(1)} r="2" fill="#c9ecfa" opacity="0.85" />
    </g>
  );
}

const GROUNDS_DECOR_RENDER = { pond: pondNode, hedge: hedgeNode, gym: gymNode, arch: archNode, fountain: fountainNode };

export function propItems(proj, props, palette) {
  const items = [];
  const push = (w, l, render) => { items.push({ sortY: isoProject(w, l, 0, proj).y, node: render() }); };
  (props.backTrees || []).forEach((t, i) => push(t.w, t.l, () => treeNode(t.w, t.l, proj, palette, `btree${i}`)));
  (props.trees || []).forEach((t, i) => push(t.w, t.l, () => treeNode(t.w, t.l, proj, palette, `tree${i}`)));
  (props.benches || []).forEach((b, i) => push(b.w, b.l, () => benchNode(b.w, b.l, proj, `bench${i}`)));
  (props.lamps || []).forEach((l, i) => push(l.w, l.l, () => lampNode(l.w, l.l, proj, `lamp${i}`)));
  if (props.bikeRack) push(props.bikeRack.w, props.bikeRack.l, () => bikeRackNode(props.bikeRack.w, props.bikeRack.l, proj, "rack"));
  if (props.teamCar) push(props.teamCar.w, props.teamCar.l, () => teamCarNode(props.teamCar.w, props.teamCar.l, proj, "car"));
  (props.groundsDecor || []).forEach((d) => {
    const render = GROUNDS_DECOR_RENDER[d.kind];
    if (render) push(d.w, d.l, () => render(d.w, d.l, proj, d.key));
  });
  return items;
}
