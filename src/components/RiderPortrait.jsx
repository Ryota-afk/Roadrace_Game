// 選手のドット絵を静止画として表示する（第13弾Phase2・ホーム画面のヒーロー領域用）。
// PixelBike（レース中のアニメーション描画用）を、動かさず1コマだけ使う薄いラッパー。
import React from "react";
import { PixelBike, BIKE_PX } from "./sprites/pixelBike.jsx";

// normal_SEフレーム（37×50マス）がちょうど収まるアンカー位置。PixelBikeの座標系は
// 「接地点（車輪の下端中央）」が原点なので、そこから逆算した値（pixelBike.jsx側の
// originCol/originRow=frame[0].length/2, frame.length の計算に対応）。
const W = 37 * BIKE_PX, H = 50 * BIKE_PX;

export function RiderPortrait({ color, size = 72 }) {
  return (
    <svg width={size} height={size * (H / W)} viewBox={`-0.2 -0.2 ${W + 0.4} ${H + 0.4}`} style={{ display: "block", overflow: "visible" }}>
      <PixelBike x={W / 2 + 0.1} y={H + 0.1} color={color} posture="normal" dir="SE" t={0} phase={0} />
    </svg>
  );
}
