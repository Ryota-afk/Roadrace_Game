// BaseView（敷地画面）の練習コース。Wave Dで新設 → Wave D2で路肩の白線を追加。
// 角丸オーバルのリボン（内側に穴が空いた1本のpath）として描画し、中央破線・両端の白線・
// スタート帯を重ねる。選手も同じroundedLoopPointで周回するため、見た目と走行位置が常に一致する。
import React from "react";
import { isoProject, trackRibbon, trackCenterline } from "../../domain/season/baseViewLayout.js";

const chain = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");
const closed = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

export function Track({ proj, loop }) {
  const { pathW, pathL, cornerR, trackHalfWidth } = loop;
  const N = 72;
  const project = (p) => isoProject(p.w, p.l, 0, proj);
  const { outer, inner } = trackRibbon(N, pathW, pathL, cornerR, trackHalfWidth);
  const outerPx = outer.map(project), innerPx = inner.map(project);
  const centerPx = trackCenterline(N, pathW, pathL, cornerR).map(project);

  return (
    <g>
      {/* 路面（evenoddで内側をくり抜いた1本のリボン） */}
      <path d={`M ${chain(outerPx)} Z M ${chain(innerPx)} Z`} fill="#54565f" fillRule="evenodd" />
      {/* 路肩の白線（外側・内側） */}
      <polygon points={closed(outerPx)} fill="none" stroke="#eceadf" strokeWidth="1.6" opacity="0.75" />
      <polygon points={closed(innerPx)} fill="none" stroke="#eceadf" strokeWidth="1.6" opacity="0.75" />
      {/* センターの破線 */}
      <polygon points={closed(centerPx)} fill="none" stroke="#e9e2d4" strokeWidth="1" strokeDasharray="6,7" opacity="0.6" />
      {/* スタート/フィニッシュ帯 */}
      <polygon points={closed([outerPx[0], outerPx[1], innerPx[1], innerPx[0]])} fill="#f4f2ec" stroke="#22242a" strokeWidth="0.6" />
    </g>
  );
}
