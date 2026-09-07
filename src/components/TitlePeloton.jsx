// タイトル画面専用：選手3体を大きさ違いで重ねた集団の絵（第100弾・devlog/wave100.md）。
// RiderPortrait.jsxと同じくPixelBikeを静止1コマだけ使うが、こちらは複数体・下端揃えの
// シーンなので別コンポーネントとして分ける。
import React from "react";
import { PixelBike, BIKE_PX } from "./sprites/pixelBike.jsx";
import { TYPES } from "../data/abilities.js";

const W = 37 * BIKE_PX, H = 50 * BIKE_PX; // PixelBike 1体ぶんの自然サイズ（RiderPortraitと同じ値）
const VB_W = 398, VB_H = 280, GROUND_Y = VB_H - 30;

// 表示幅・左端位置・不透明度は第100弾の合意案（3体を大きさ違いで重ね、下端を揃える）。
// 色は実データTYPES[].colorから取る（ハードコードしない）。
const RIDERS = [
  { type: "SPR", w: 150, left: 0 },
  { type: "PUN", w: 176, left: 92 },
  { type: "CLM", w: 204, left: 194 },
];

export function TitlePeloton() {
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMax meet"
      style={{ display: "block", position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
      {RIDERS.map((r, i) => {
        const s = r.w / W;
        const tx = r.left + r.w / 2;
        return (
          <g key={r.type} transform={`translate(${tx.toFixed(1)},${GROUND_Y}) scale(${s.toFixed(4)})`} opacity={i === RIDERS.length - 1 ? 1 : 0.5 + i * 0.28}>
            <PixelBike x={0} y={0} color={TYPES[r.type].color} posture="normal" dir="SE" t={0} phase={0} />
          </g>
        );
      })}
    </svg>
  );
}
