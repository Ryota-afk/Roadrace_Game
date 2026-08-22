// 拠点画面の什器・プロップをドット絵（<image>1ノード）で描く共通ヘルパー（第19弾）。
// PixelPerson/PixelBikeと同じ仕組み：legend形式のrowsをrasterize.jsでcanvasに1回焼き、
// 以後は同一参照のdata URLを<image>で置くだけ。アンカーは接地点（足元中央）。
// 1セル=OBJ_PX(0.5)スクリーンpx＝PixelPersonの0.49と粒度を揃えてある（PixelBike導入時に
// 「1マスの実寸が違うと安っぽく見える」と判明済みのため、以後の什器も全てこの粒度に固定する）。
import React from "react";
import { spriteImageUrl } from "./rasterize.js";
import { shade } from "./kit.jsx";
import { OBJ_SPRITES, OBJ_LEGEND } from "./pixelObjectData.js";

export const OBJ_PX = 0.5;

// data: OBJ_SPRITESのエントリ。x,y: 接地点のスクリーン座標。
// shadowRx/Ry: 足元の影楕円（従来の各Nodeが自前で敷いていた影の置き換え。省略で影なし）。
export function pixelObjectNode({ x, y, data, legend, cacheKey, key, shadowRx = 0, shadowRy = 0 }) {
  const s = spriteImageUrl(data.rows, legend || data.legend || OBJ_LEGEND, cacheKey);
  const w = +(s.w * OBJ_PX).toFixed(2), h = +(s.h * OBJ_PX).toFixed(2);
  const ox = +(-data.anchorCol * OBJ_PX).toFixed(2);
  const oy = +(-(data.anchorRow + 1) * OBJ_PX).toFixed(2);
  return (
    <g key={key} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      {shadowRx > 0 && <ellipse cx="0" cy="0" rx={shadowRx} ry={shadowRy} fill="#000" opacity="0.14" />}
      <image href={s.url} x={ox} y={oy} width={w} height={h} style={{ imageRendering: "pixelated" }} />
    </g>
  );
}

// 木：葉の色は季節パレット（palette.treeDark/treeMid/treeLeaf）から動的に組む。
// 冬（palette.snow）は冠雪差分のrows（treeSnow）を使い、雪の文字Sをpalette.snowで塗る。
export function treeSpriteNode({ x, y, palette, key }) {
  const data = palette.snow ? OBJ_SPRITES.treeSnow : OBJ_SPRITES.tree;
  // 抽出データの静的色（幹など）に季節の葉色を重ねる
  const legend = {
    ...data.legend,
    t: palette.treeDark, u: palette.treeMid, v: palette.treeLeaf,
    V: shade(palette.treeLeaf, 1.18),
    S: palette.snow || "#ffffff",
  };
  return pixelObjectNode({
    x, y, data, legend, key,
    cacheKey: `objtree-${palette.treeLeaf}-${palette.snow ? "s" : "n"}`,
    shadowRx: 13.5, shadowRy: 6.8,
  });
}
