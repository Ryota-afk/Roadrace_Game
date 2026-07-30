// BaseView（敷地画面）の地面ゾーニング。Wave D（磨き込み）で新設。
// Step13第3弾時点は「周回路の輪郭付近だけ色を僅かに変える」方式で、コースがどこにあるのか
// タイル配色からはほぼ読み取れなかった（実際のコース形状はTrackコンポーネントがリボンとして
// 別途はっきり描画する）。ここでは infield（芝の内側）／plaza（コースのすぐ外の舗装）／
// outer（それ以遠の外周の濃い芝）の3ゾーンに分け、季節パレットで色を切り替える。
import React from "react";
import { isoProject, groundZone } from "../../domain/season/baseViewLayout.js";

const diamond = (w, l, hw, hl, proj) => {
  const p1 = isoProject(w - hw, l, 0, proj), p2 = isoProject(w, l + hl, 0, proj);
  const p3 = isoProject(w + hw, l, 0, proj), p4 = isoProject(w, l - hl, 0, proj);
  return `${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p3.x.toFixed(1)},${p3.y.toFixed(1)} ${p4.x.toFixed(1)},${p4.y.toFixed(1)}`;
};

export function Ground({ proj, ground, loop, palette }) {
  const { wMin, wMax, lMin, lMax, tileStep } = ground;
  const { pathW, pathL, trackHalfWidth } = loop;
  const tiles = [];
  for (let w = wMin; w <= wMax + 1e-6; w += tileStep) {
    for (let l = lMin; l <= lMax + 1e-6; l += tileStep) {
      const zone = groundZone(w, l, pathW, pathL, trackHalfWidth, 0.9);
      if (zone === "track") continue; // Trackコンポーネントが上から確実に覆うので描かない
      tiles.push({ w, l, zone });
    }
  }
  const checker = (w, l) => (Math.round(w / tileStep) + Math.round(l / tileStep)) & 1;
  const colorOf = (zone, alt) => {
    if (zone === "infield") return alt ? palette.grassLight : palette.grassDark;
    if (zone === "plaza") return palette.plaza;
    return alt ? palette.grassDark : palette.grassLight;
  };
  return (
    <g>
      {tiles.map((t, i) => (
        <polygon key={`g${i}`} points={diamond(t.w, t.l, tileStep / 2, tileStep / 2, proj)}
          fill={colorOf(t.zone, !!checker(t.w, t.l))} stroke="#00000014" strokeWidth="0.4" />
      ))}
    </g>
  );
}
