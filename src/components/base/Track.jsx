// BaseView（敷地画面）の練習コース。Wave D（磨き込み）で新設。
// Step13第3弾時点はコースの実体を描かず、地面タイルの色をわずかに変えるだけ（isPathTile）
// だったため「コースがどこにあるか読めない」問題があった。角丸オーバルのリボン（内側に
// infieldの穴が空いた1本のpath）として明確に描画し、中央破線・スタート帯を足す。
import React from "react";
import { isoProject, trackRibbon, trackCenterline } from "../../domain/season/baseViewLayout.js";

const toPx = (proj) => (p) => isoProject(p.w, p.l, 0, proj);
const fmt = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");

export function Track({ proj, loop }) {
  const { pathW, pathL, cornerR, trackHalfWidth } = loop;
  const N = 64;
  const { outer, inner } = trackRibbon(N, pathW, pathL, cornerR, trackHalfWidth);
  const project = toPx(proj);
  const outerPx = outer.map(project), innerPx = inner.map(project);
  const ribbonPath = `M ${fmt(outerPx)} Z M ${fmt(innerPx)} Z`;
  const centerPx = trackCenterline(N, pathW, pathL, cornerR).map(project);
  const centerPoly = centerPx.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  // スタート/フィニッシュ帯：t=0付近(index0→1)で外周-内周をまたぐ短冊
  const stripe = [outerPx[0], outerPx[1], innerPx[1], innerPx[0]].map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <g>
      <path d={ribbonPath} fill="#54565f" fillRule="evenodd" stroke="#2c2e34" strokeWidth="1" />
      <polygon points={centerPoly} fill="none" stroke="#e9e2d4" strokeWidth="0.8" strokeDasharray="3.5,4.5" opacity="0.55" />
      <polygon points={stripe} fill="#f4f2ec" stroke="#22242a" strokeWidth="0.6" />
    </g>
  );
}
