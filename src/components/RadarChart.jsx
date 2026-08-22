// 可変軸レーダーチャート（Phase 1・柱: 突破力/安定感の可視化のため新設）。
// 軸数はaxes配列の長さに追従する（5角形→将来のスピリット/運追加時に7角形へ拡張しても改修不要）。
// 第13弾Phase3-A：図の形（レーダー）はそのままに、フォントと色だけ新トークンへ寄せた
// （ユーザー指示：「レーダーのままフォントのみ変更」）。軸ごとに別の色を振っていた点は
// 「アクセントは単色」の決定に反するため、データ多角形をアクセント1色へ統一している。
import React from "react";
import { AB_KEYS, AB_LABEL } from "../data/abilities.js";
import { FONT_DOT, T } from "../data/theme.js";

// axes: [{ label, value, max, color? }]。maxは軸ごとに指定でき、基礎能力のように
// 「外周＝成長上限」としたい場合は全軸に同じcapを渡す（＝外周に張り付く＝限界突破）。
// corner: { label, value } を渡すと図の右下隅に控えめな注記を出す（上限値などを、
// 見出しや説明文を増やさずに図の中で示すため。v46）。
export function RadarChart({ axes, size = 168, color = T.color.accent, fillOpacity = 0.22, showValues = false, atMaxColor = T.color.accent, corner = null }) {
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
          fill="none" stroke={T.color.rule} strokeWidth={i === 3 ? 1.4 : 1} opacity={i === 3 ? 0.9 : 0.5} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pointFor(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={T.color.rule} strokeWidth={1} opacity={0.5} />;
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
            <text x={lx} y={showValues ? ly - 6 : ly} textAnchor="middle" dominantBaseline="middle"
              fontSize={T.size.caption} fontFamily={FONT_DOT} fill={T.color.sub}>{ax.label}</text>
            {showValues && (
              <text x={lx} y={ly + 7} textAnchor="middle" dominantBaseline="middle"
                fontSize={T.size.body} fontFamily={FONT_DOT} fill={atMax ? atMaxColor : T.color.text}>
                {Math.round(ax.value ?? 0)}
              </text>
            )}
          </g>
        );
      })}
      {corner && (
        // 右下隅。軸ラベルは外周の1.3倍位置に出るので、そこと干渉しない角に置く。
        <g>
          <text x={size} y={size - 9} textAnchor="end" fontSize={T.size.caption} fontFamily={FONT_DOT} fill={T.color.sub}>{corner.label}</text>
          <text x={size} y={size + 4} textAnchor="end" fontSize={T.size.body} fontFamily={FONT_DOT} fill={T.color.sub}>{corner.value}</text>
        </g>
      )}
    </svg>
  );
}

// 基礎能力5軸（平坦・登坂・スプリント・スタミナ・独走）のレーダー。
// v43(UI): 軸の最大値に成長上限(cap)を渡すことで「外周＝伸びしろの天井」を表現する
// （AbilityGridの薄い伸びしろ帯・上限マーカーと同じ情報をレーダー側で担う）。
// v46(UI): 見出しに「（外周=88）」と書いていたのをやめ、上限の数字を図の右下隅へ控えめに
// 置いた（CLAUDE.md §7：説明文を足すのではなく、図そのもので伝える／「外周」は実装側の
// 語彙でユーザーには通じない）。capLabel=falseで数字なしにもできる。
export function AbilityRadarChart({ r, cap = 88, size = 168, color = T.color.accent, capLabel = true }) {
  if (!r) return null;
  const axes = AB_KEYS.map(k => ({ label: AB_LABEL[k], value: r[k] ?? 0, max: cap }));
  return (
    <RadarChart axes={axes} size={size} color={color} showValues
      corner={capLabel ? { label: "上限", value: Math.round(cap) } : null} />
  );
}

// 選手のサブステータス7軸（加速力・体格・メンタル・突破力・安定感・運・スピリット）を表示する専用ラッパー。
// 第18弾: スピリットを追加し7角形化（可変軸設計の狙い通り、呼び出し側の改修は不要だった）。
export function RiderRadarChart({ r, size = 168, color = T.color.accent, showValues = true }) {
  if (!r) return null;
  const axes = [
    { label: "加速力", value: r.accel ?? 50, max: 100 },
    { label: "体格", value: r.build ?? 50, max: 100 },
    { label: "メンタル", value: r.mental ?? 50, max: 100 },
    { label: "突破力", value: r.breakthrough ?? 50, max: 100 },
    { label: "安定感", value: r.stability ?? 50, max: 100 },
    { label: "運", value: r.luck ?? 50, max: 100 },
    { label: "スピリット", value: r.spirit ?? 50, max: 100 },
  ];
  return <RadarChart axes={axes} size={size} color={color} showValues={showValues} />;
}

// v46(UI): 「能力」「素質」のレーダー2枚横並びは、マイライフの選手カードとシーズンの
// 選手一覧に同じマークアップが重複していた（見出しの文言を直すのに2箇所を触る必要が
// あった）。CLAUDE.md §5に従い1つの部品へ集約する。
// 見出しからは「（外周=88）」「（生涯不変）」を撤去した：前者は上限としてレーダー内の
// 右下隅へ移し、後者は情報として不要（CLAUDE.md §7）。
export function AbilitySoshitsuRadarPair({ r, cap, size = 148 }) {
  if (!r) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-around", alignItems: "stretch", gap: T.space.xs, marginTop: T.space.sm, flexWrap: "wrap", fontFamily: FONT_DOT }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.xs }}>能力</div>
        <AbilityRadarChart r={r} cap={cap} size={size} />
      </div>
      <div style={{ width: 1, background: T.color.rule, margin: `${T.space.md}px 2px` }} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.xs }}>素質</div>
        <RiderRadarChart r={r} size={size} />
      </div>
    </div>
  );
}
