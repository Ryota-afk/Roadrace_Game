// コース断面図（第13弾Phase2）。data/course.js の tmpl.segs（[種別,base,距離km]の配列）から
// 実データで描く。平坦なレースでも枠は必ず確保する（ユーザー指示：「枠だけ確保」）。
import React from "react";
import { T } from "../data/theme.js";

// 種別ごとの傾き。標高そのものではなく断面の形を決めるための相対値。
const SLOPE = { flat: 0, sprint: 0, tt: 0, hill: 1, climb: 2.2, mtn: 3.4 };

// 論理座標は幅100の固定空間で組み、viewBox+width:100%で親要素の実幅に追従させる
// （呼び出し側でpxを推測しなくてよいようにするため）。
const VW = 100;

export function CourseProfile({ segs, height = 40 }) {
  if (!segs || !segs.length) return <div style={{ width: "100%", height, background: T.color.surfaceUp }} />;

  const totalKm = segs.reduce((a, s) => a + s[2], 0) || 1;
  const pts = [[0, 0]];
  let km = 0, ele = 0;
  segs.forEach(([type, , dist]) => { km += dist; ele += (SLOPE[type] || 0) * dist; pts.push([km, ele]); });
  const maxEle = Math.max(...pts.map(p => p[1]));
  const isFlat = maxEle <= 0;
  const px = k => +((k / totalKm) * VW).toFixed(1);
  const py = e => +(height - 2 - (isFlat ? 0 : (e / maxEle) * (height - 6))).toFixed(1);
  const line = pts.map(([k, e]) => `${px(k)},${py(e)}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${VW} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <polygon points={`0,${height} ${line} ${VW},${height}`} fill={T.color.surfaceUp} />
      <polyline points={line} fill="none" stroke={T.color.sub} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      {pts.slice(1, -1).map(([k], i) => (
        <line key={i} x1={px(k)} y1="0" x2={px(k)} y2={height} stroke={T.color.rule} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      ))}
      <rect x={px(last[0]) - 1} y={py(last[1]) - 1} width="2" height="2" fill={T.color.accent} />
    </svg>
  );
}
