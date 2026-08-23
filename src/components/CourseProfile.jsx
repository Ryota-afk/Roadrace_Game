// コース断面図（第13弾Phase2）。data/course.js の tmpl.segs（[種別,base,距離km]の配列）から
// 実データで描く。平坦なレースでも枠は必ず確保する（ユーザー指示：「枠だけ確保」）。
// 第32弾（第2次UI改革）: 区間ごとにSEG_COLORで塗り分ける（脚質と同じ意味色。どこがどの
// 脚質に有利かを図そのもので伝える）。標高0の写像先をheight-5にし（ベースラインを5px
// 持ち上げる）、平坦区間でも路面の色帯が見えるようにする——塗りの上端だけをクランプする
// 旧実装は、標高が低い区間で稜線と塗りがズレて見えたため廃止（ユーザー指摘・2026-08）。
// 稜線と塗りの上端は常に同じpy()を使い、完全に一致させる。
// 区間境界の縦線は削除した（CLAUDE.md §8：縦線は装飾・区切り目的で使用禁止・2026-08明示）。
import React from "react";
import { SEG_COLOR } from "../data/course.js";
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
  const py = e => +(height - 5 - (isFlat ? 0 : (e / maxEle) * (height - 7))).toFixed(1);
  const line = pts.map(([k, e]) => `${px(k)},${py(e)}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${VW} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {segs.map(([type], i) => {
        const a = pts[i], b = pts[i + 1];
        const pointsStr = `${px(a[0])},${height} ${px(a[0])},${py(a[1])} ${px(b[0])},${py(b[1])} ${px(b[0])},${height}`;
        return <polygon key={i} points={pointsStr} fill={SEG_COLOR[type] || T.color.surfaceUp} opacity="0.5" />;
      })}
      <polyline points={line} fill="none" stroke={T.color.text} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <rect x={px(last[0]) - 1} y={py(last[1]) - 1} width="2" height="2" fill={T.color.accent} />
    </svg>
  );
}
