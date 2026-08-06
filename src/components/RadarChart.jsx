// 可変軸レーダーチャート（Phase 1・柱: 突破力/安定感の可視化のため新設）。
// 軸数はaxes配列の長さに追従する（5角形→将来のスピリット/運追加時に7角形へ拡張しても改修不要）。
import React from "react";
import { C, FONT_M } from "../data/theme.js";

export function RadarChart({ axes, size = 168, color = C.blue, fillOpacity = 0.28 }) {
  if (!axes || axes.length < 3) return null;
  const n = axes.length;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 30; // ラベル分のマージン
  const angleFor = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointFor = (i, frac) => {
    const a = angleFor(i);
    return [cx + Math.cos(a) * r * frac, cy + Math.sin(a) * r * frac];
  };
  const dataPoints = axes.map((ax, i) => pointFor(i, Math.max(0, Math.min(1, (ax.value ?? 0) / (ax.max ?? 100)))));
  const dataPath = dataPoints.map(p => p.join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
      {[0.25, 0.5, 0.75, 1].map((lv, i) => (
        <polygon key={i} points={axes.map((_, ai) => pointFor(ai, lv).join(",")).join(" ")}
          fill="none" stroke={C.line} strokeWidth={1} opacity={0.6} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pointFor(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.line} strokeWidth={1} opacity={0.6} />;
      })}
      <polygon points={dataPath} fill={color} fillOpacity={fillOpacity} stroke={color} strokeWidth={2} />
      {dataPoints.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} fill={color} />)}
      {axes.map((ax, i) => {
        const [lx, ly] = pointFor(i, 1.26);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={10.5} fontFamily={FONT_M} fill={C.sub}>
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
}

// 選手のサブステータス5軸（加速力・体格・メンタル・突破力・安定感）を表示する専用ラッパー。
// スピリット・運が実装される将来フェーズでは、axesを7つに増やすだけでこの呼び出し側は無改修で対応できる。
export function RiderRadarChart({ r, size = 168, color = C.blue }) {
  if (!r) return null;
  const axes = [
    { label: "加速力", value: r.accel ?? 50, max: 100 },
    { label: "体格", value: r.build ?? 50, max: 100 },
    { label: "メンタル", value: r.mental ?? 50, max: 100 },
    { label: "突破力", value: r.breakthrough ?? 50, max: 100 },
    { label: "安定感", value: r.stability ?? 50, max: 100 },
  ];
  return <RadarChart axes={axes} size={size} color={color} />;
}
