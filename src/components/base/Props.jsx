// BaseView（敷地画面）の小物。Wave Dで新設 → Wave D2で全てアイソメ格子に乗せ直した。
//
// Wave D2の見直し（詳細はDEVLOG §10）：Wave Dの小物はスクリーン座標の矩形・円で描いており
// （例：チームカーが軸平行の長方形）、周囲の建物・地面のアイソメ格子と角度が合わず
// ユーザー指摘の「斜めの角度が変」の直接原因になっていた。箱状のものは全て共通の
// isoBoxFaces()で描き、木も輪郭と陰影を持つ構造（幹＋3層の樹冠）へ作り直した。
import React from "react";
import { isoProject } from "../../domain/season/baseViewLayout.js";
import { pixelObjectNode, treeSpriteNode } from "../sprites/pixelObject.jsx";
import { OBJ_SPRITES } from "../sprites/pixelObjectData.js";

// 第19弾: ドット絵化（sprites/pixelObjectData.jsの静的rows）。季節パレット・冠雪差分は
// treeSpriteNode側でlegendを動的に組む。影もスプライト側ヘルパーが敷く。
function treeNode(w, l, proj, palette, key) {
  const base = isoProject(w, l, 0, proj);
  return treeSpriteNode({ x: base.x, y: base.y, palette, key });
}


// 第19弾: ベンチ・外灯・駐輪ラックも参考画像から抽出したドット絵へ差し替え。
function benchNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return pixelObjectNode({ x: p.x, y: p.y, data: OBJ_SPRITES.bench, key, cacheKey: "obj-bench" });
}

function lampNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return pixelObjectNode({ x: p.x, y: p.y, data: OBJ_SPRITES.lamp, key, cacheKey: "obj-lamp", shadowW: 0.13, shadowL: 0.13 });
}

function bikeRackNode(w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return pixelObjectNode({ x: p.x, y: p.y, data: OBJ_SPRITES.bikeRack, key, cacheKey: "obj-bikeRack" });
}

// チームカー（第19弾: ドット絵化）。ルーフキャリアのスペアホイール2本＝ロードレースの
// チームカーの記号として追加。
function teamCarNode(w, l, proj, key) {
  const base = isoProject(w, l, 0, proj);
  // 車は+l方向（画面右上がり）に長い。footprintを実車比（幅0.45×長さ0.95ユニット）で指定。
  return pixelObjectNode({
    x: base.x, y: base.y, data: OBJ_SPRITES.teamCar, key,
    cacheKey: "obj-teamCar", shadowW: 0.45, shadowL: 0.95,
  });
}

// Wave F-1: 敷地整備（g.equip.grounds、施設ショップの新規購入枠）で段階的に解禁される
// 屋外装飾。第19弾でreference/F.pngから抽出したドット絵へ全面差し替え（手続きSVG全廃）。
// 池・生け垣・ジム・アーチ・噴水はいずれも接地面いっぱいの造形なので足元の影楕円は敷かない
// （noShadow。敷くと水面・土台の下に黒い縁が覗いて汚れて見える）。
function decorNode(kind, w, l, proj, key) {
  const p = isoProject(w, l, 0, proj);
  return pixelObjectNode({ x: p.x, y: p.y, data: OBJ_SPRITES[kind], key, cacheKey: `obj-${kind}`, noShadow: true });
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
  (props.groundsDecor || []).forEach((d) => {
    if (OBJ_SPRITES[d.kind]) push(d.w, d.l, () => decorNode(d.kind, d.w, d.l, proj, d.key));
  });
  return items;
}
