// クラブハウス各部屋の二次什器（Wave E-3で施設Lv連動の段階解禁を導入）。
// 第19弾：手続きSVG（isoBox積みの18個のNode関数・約380行）を全廃し、ユーザー提供の
// 参考画像から抽出したドット絵（sprites/pixelObjectData.js）へ全面差し替えた。
// どのkindをどこに置くか・minLevelでの解禁は従来どおりdata/baseViewBuildings.jsの
// BASE_VIEW_FIXTURESが持ち、ここは「接地点にスプライトを置く」だけになった。
import { isoBoxFaces } from "../../domain/season/baseViewLayout.js";
import { pixelObjectNode } from "../sprites/pixelObject.jsx";
import { OBJ_SPRITES } from "../sprites/pixelObjectData.js";

// 第20弾: 描画ノードだけでなく接地点のscreen y（sortY）も返す。屋内の什器・持ち場・人物は
// BaseView側でsortYの昇順（奥→手前）に並べ替えて描く（固定のグループ順で描いていた旧実装は
// 「奥の椅子が手前の机の上に描かれる」「人物が常に最前面」の原因だった＝2026-08ユーザー指摘）。
export function fixtureItems(proj, list) {
  return (list || []).map((c) => {
    const data = OBJ_SPRITES[c.kind];
    if (!data) return null;
    const p = isoBoxFaces(c.w, c.l, 0, 0, 0, proj).corners.N;
    return { sortY: p.y, node: pixelObjectNode({ x: p.x, y: p.y, data, key: c.key, cacheKey: `obj-${c.kind}`, flip: c.flip }) };
  }).filter(Boolean);
}
