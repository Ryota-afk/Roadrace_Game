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

// data: OBJ_SPRITESのエントリ。x,y: 接地点のスクリーン座標。legend省略時はdata.legend。
//
// 影（2026-08ユーザー指摘で全面改修）：以前は水平の楕円をanchor（＝スプライト最下端＝
// 物体の手前の角）に置いていたため、影が本体の下ではなく手前下にはみ出し、什器・ベンチ・
// 駐輪ラックが「浮いて」見えた。現在は**地面平面に沿ったアイソメ楕円**を描く：
// ワールド単位の半径(shadowW: +w方向, shadowL: +l方向)を投影行列
// (+w→(26,13), +l→(26,-13)) ごと楕円に適用し、中心はanchorからfootprint中央
// （dx=26*(hl-hw), dy=-13*(hw+hl)）へ自動で戻す。省略時はスプライト幅から正方形
// footprintを推定。noShadow: trueで影なし（接地面いっぱいの造形＝池・装飾用）。
export function pixelObjectNode({ x, y, data, legend, cacheKey, key, shadowW, shadowL, shadowDx = 0, shadowDy = 0, noShadow }) {
  const s = spriteImageUrl(data.rows, legend || data.legend || OBJ_LEGEND, cacheKey);
  const w = +(s.w * OBJ_PX).toFixed(2), h = +(s.h * OBJ_PX).toFixed(2);
  const auto = +(w / 104 * 1.2).toFixed(3);
  const hw = shadowW == null ? auto : shadowW;
  const hl = shadowL == null ? auto : shadowL;
  const scx = +(26 * (hl - hw) + shadowDx).toFixed(1);
  const scy = +(-13 * (hw + hl) + shadowDy).toFixed(1);
  const shTf = `matrix(${(26 * hw).toFixed(2)},${(13 * hw).toFixed(2)},${(26 * hl).toFixed(2)},${(-13 * hl).toFixed(2)},${scx},${scy})`;
  const ox = +(-data.anchorCol * OBJ_PX).toFixed(2);
  const oy = +(-(data.anchorRow + 1) * OBJ_PX).toFixed(2);
  return (
    <g key={key} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      {!noShadow && hw > 0 && <ellipse cx="0" cy="0" rx="1" ry="1" fill="#000" opacity="0.13" transform={shTf} />}
      <image href={s.url} x={ox} y={oy} width={w} height={h} style={{ imageRendering: "pixelated" }} />
    </g>
  );
}

// 木：葉の色は季節パレット（palette.treeDark/treeMid/treeLeaf）から動的に組む。
// 冬（palette.snow）は冠雪差分のrows（treeSnow）を使い、雪の文字Sをpalette.snowで塗る。
// 幹・根元は抽出データの静的色のまま（季節で変わらない）。
export function treeSpriteNode({ x, y, palette, key }) {
  const data = palette.snow ? OBJ_SPRITES.treeSnow : OBJ_SPRITES.tree;
  const legend = {
    ...data.legend,
    t: palette.treeDark, u: palette.treeMid, v: palette.treeLeaf,
    V: shade(palette.treeLeaf, 1.18),
    S: palette.snow || "#ffffff",
  };
  return pixelObjectNode({
    x, y, data, legend, key,
    cacheKey: `objtree-${palette.treeLeaf}-${palette.snow ? "s" : "n"}`,
    shadowW: 0.38, shadowL: 0.38,
  });
}
