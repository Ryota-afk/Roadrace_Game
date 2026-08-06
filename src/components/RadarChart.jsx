// 可変軸レーダーチャート（Phase 1・柱: 突破力/安定感の可視化のため新設）。
// 軸数はaxes配列の長さに追従する（5角形→将来のスピリット/運追加時に7角形へ拡張しても改修不要）。
import React from "react";
import { AB_COLOR, AB_KEYS, AB_LABEL } from "../data/abilities.js";
import { C, FONT_M } from "../data/theme.js";

// axes: [{ label, value, max, color? }]。maxは軸ごとに指定でき、基礎能力のように
// 「外周＝成長上限」としたい場合は全軸に同じcapを渡す（＝外周に張り付く＝限界突破）。
export function RadarChart({ axes, size = 168, color = C.blue, fillOpacity = 0.28, showValues = false, atMaxColor = C.yellow }) {
  if (!axes || axes.length < 3) return null;
  const n = axes.length;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 34; // ラベル＋数値の2行ぶんのマージン
  const angleFor = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointFor = (i, frac) => {
    const a = angleFor(i);
    return [cx + Math.cos(a) * r * frac, cy + Math.sin(a) * r * frac];
  };
  const fracFor = (ax) => Math.max(0, Math.min(1, (ax.value ?? 0) / (ax.max ?? 100)));
  const dataPoints = axes.map((ax, i) => pointFor(i, fracFor(ax)));
  const dataPath = dataPoints.map(p => p.join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible", display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map((lv, i) => (
        <polygon key={i} points={axes.map((_, ai) => pointFor(ai, lv).join(",")).join(" ")}
          fill="none" stroke={C.line} strokeWidth={i === 3 ? 1.4 : 1} opacity={i === 3 ? 0.9 : 0.5} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pointFor(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.line} strokeWidth={1} opacity={0.5} />;
      })}
      <polygon points={dataPath} fill={color} fillOpacity={fillOpacity} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill={axes[i].color || color} />
      ))}
      {axes.map((ax, i) => {
        const [lx, ly] = pointFor(i, 1.3);
        // 上下の軸はラベルと数値が中心寄りに来て潰れやすいので、数値を出す側へ少し逃がす
        const atMax = fracFor(ax) >= 1;
        return (
          <g key={i}>
            <text x={lx} y={showValues ? ly - 5 : ly} textAnchor="middle" dominantBaseline="middle"
              fontSize={9.5} fontFamily={FONT_M} fill={ax.color || C.sub}>{ax.label}</text>
            {showValues && (
              <text x={lx} y={ly + 6} textAnchor="middle" dominantBaseline="middle"
                fontSize={11} fontWeight={700} fontFamily={FONT_M} fill={atMax ? atMaxColor : C.text}>
                {Math.round(ax.value ?? 0)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// 基礎能力5軸（平坦・登坂・スプリント・スタミナ・独走）のレーダー。
// v43(UI): 軸の最大値に成長上限(cap)を渡すことで「外周＝伸びしろの天井」を表現する
// （AbilityGridの薄い伸びしろ帯・上限マーカーと同じ情報をレーダー側で担う）。
export function AbilityRadarChart({ r, cap = 88, size = 168, color = C.green }) {
  if (!r) return null;
  const axes = AB_KEYS.map(k => ({ label: AB_LABEL[k], value: r[k] ?? 0, max: cap, color: AB_COLOR[k] }));
  return <RadarChart axes={axes} size={size} color={color} showValues />;
}

// 選手のサブステータス6軸（加速力・体格・メンタル・突破力・安定感・運）を表示する専用ラッパー。
// v43(Phase 2): 運を追加し6角形化。スピリットが実装される将来フェーズ（Phase 3）でも、
// axesを7つに増やすだけでこの呼び出し側は無改修で対応できる（可変軸設計の狙い通り）。
export function RiderRadarChart({ r, size = 168, color = C.blue, showValues = true }) {
  if (!r) return null;
  const axes = [
    { label: "加速力", value: r.accel ?? 50, max: 100 },
    { label: "体格", value: r.build ?? 50, max: 100 },
    { label: "メンタル", value: r.mental ?? 50, max: 100 },
    { label: "突破力", value: r.breakthrough ?? 50, max: 100 },
    { label: "安定感", value: r.stability ?? 50, max: 100 },
    { label: "運", value: r.luck ?? 50, max: 100 },
  ];
  return <RadarChart axes={axes} size={size} color={color} showValues={showValues} />;
}
