// BaseView（敷地画面）の小物。Wave Dで新設 → Wave D2で全てアイソメ格子に乗せ直した。
//
// Wave D2の見直し（詳細はDEVLOG §10）：Wave Dの小物はスクリーン座標の矩形・円で描いており
// （例：チームカーが軸平行の長方形）、周囲の建物・地面のアイソメ格子と角度が合わず
// ユーザー指摘の「斜めの角度が変」の直接原因になっていた。箱状のものは全て共通の
// isoBoxFaces()で描き、木も輪郭と陰影を持つ構造（幹＋3層の樹冠）へ作り直した。
import React from "react";
import { isoProject, isoBoxFaces } from "../../domain/season/baseViewLayout.js";

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

function treeNode(w, l, proj, palette, key) {
  const base = isoProject(w, l, 0, proj);
  const x = base.x, y = base.y;
  return (
    <g key={key}>
      {shadowDiamond(w, l, 0.30, 0.22, proj)}
      {/* 幹（下が太い台形） */}
      <polygon points={`${(x - 2.6).toFixed(1)},${y.toFixed(1)} ${(x + 2.6).toFixed(1)},${y.toFixed(1)} ${(x + 1.6).toFixed(1)},${(y - 11).toFixed(1)} ${(x - 1.6).toFixed(1)},${(y - 11).toFixed(1)}`} fill="#6b4f34" />
      {/* 樹冠：暗→中→明の3層で球の陰影を作り、輪郭線でシルエットを締める */}
      <ellipse cx={x} cy={y - 19} rx="11.5" ry="10" fill={palette.treeDark} stroke="#00000038" strokeWidth="0.8" />
      <ellipse cx={(x - 1.8).toFixed(1)} cy={(y - 21).toFixed(1)} rx="9" ry="7.8" fill={palette.treeMid} />
      <ellipse cx={(x - 3.6).toFixed(1)} cy={(y - 23.5).toFixed(1)} rx="5.2" ry="4.4" fill={palette.treeLeaf} />
      {palette.snow && <ellipse cx={(x - 2.6).toFixed(1)} cy={(y - 25.5).toFixed(1)} rx="6.4" ry="3" fill={palette.snow} opacity="0.92" />}
    </g>
  );
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

// チームカー：車体（l方向に長い箱）の上にキャビンを重ねる。キャビンは「地面から生えた
// より高く細い箱」として描き、車体に隠れる下半分は見えない＝結果的に屋根に見える。
// （transformで持ち上げるとアイソメの足元がズレるため、高さで表現する）
function teamCarNode(w, l, proj, key) {
  return (
    <g key={key}>
      {shadowDiamond(w, l, 0.42, 0.72, proj)}
      {isoBox(w, l, 0.34, 0.62, 9, proj, "#2c55a8", "#3f74d4", "#5289e4")}
      {isoBox(w, l - 0.06, 0.25, 0.30, 16, proj, "#24406f", "#33598f", "#8fb4e2")}
    </g>
  );
}

export function propItems(proj, props, palette) {
  const items = [];
  const push = (w, l, render) => { items.push({ sortY: isoProject(w, l, 0, proj).y, node: render() }); };
  (props.backTrees || []).forEach((t, i) => push(t.w, t.l, () => treeNode(t.w, t.l, proj, palette, `btree${i}`)));
  (props.trees || []).forEach((t, i) => push(t.w, t.l, () => treeNode(t.w, t.l, proj, palette, `tree${i}`)));
  (props.benches || []).forEach((b, i) => push(b.w, b.l, () => benchNode(b.w, b.l, proj, `bench${i}`)));
  (props.lamps || []).forEach((l, i) => push(l.w, l.l, () => lampNode(l.w, l.l, proj, `lamp${i}`)));
  if (props.bikeRack) push(props.bikeRack.w, props.bikeRack.l, () => bikeRackNode(props.bikeRack.w, props.bikeRack.l, proj, "rack"));
  if (props.teamCar) push(props.teamCar.w, props.teamCar.l, () => teamCarNode(props.teamCar.w, props.teamCar.l, proj, "car"));
  return items;
}
