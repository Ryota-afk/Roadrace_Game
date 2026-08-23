// 拠点画面のスタッフ（監督・トレーナー・ドクター・スカウト）の描画。第33弾。
// 従来は選手と同じPixelPersonの色替え（ジャージ＋キャップ姿）で「スタッフの外見が
// 選手と全く同一」というユーザー指摘の原因だった。reference/Staff.pngから抽出した
// 職業ごとの専用スプライト（staffSprites.js・固定パレット）へ差し替える。
// 描画方式はPixelPersonと同じ：spriteImageUrlで1回ラスタライズ→<image>1ノード参照。
import React from "react";
import { PERSON_PX } from "./pixelPerson.jsx";
import { spriteImageUrl } from "./rasterize.js";
import { STAFF_SPRITES } from "./staffSprites.js";

// x,y: 足元中央のワールド座標。kind: STAFF_SPRITESのキー（staffKeyと同名）。
// スタッフは持ち場に常駐する動かない人なので、姿勢はstand1種のみ。
export function StaffPerson({ x, y, kind, flip }) {
  const def = STAFF_SPRITES[kind];
  if (!def) return null;
  const sprite = spriteImageUrl(def.rows, def.legend, `staff-${kind}`);
  const w = +(sprite.w * PERSON_PX).toFixed(2), h = +(sprite.h * PERSON_PX).toFixed(2);
  const ox = +(-(sprite.w / 2) * PERSON_PX).toFixed(2), oy = +(-sprite.h * PERSON_PX).toFixed(2);
  const img = <image href={sprite.url} x={ox} y={oy} width={w} height={h} style={{ imageRendering: "pixelated" }} />;
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      <ellipse cx="0" cy="0" rx="3.6" ry="1.5" fill="#000" opacity="0.2" />
      {flip ? <g transform="scale(-1,1)">{img}</g> : img}
    </g>
  );
}
