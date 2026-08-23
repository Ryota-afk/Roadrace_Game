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
// corner: { label, value } を渡すと図の左下隅に控えめな注記を出す（上限値などを、
// 見出しや説明文を増やさずに図の中で示すため。v46。第30弾で右下→左下へ移動）。
// capRing: 各軸のfrac（0..1、axesと同じ順序）を渡すと、データ多角形の下に点線の
// 「上限シルエット」を重ねる（第30弾・判断③のオフセットを図の形として見せる案B）。
export function RadarChart({ axes, size = 168, color = T.color.accent, fillOpacity = 0.22, showValues = false, atMaxColor = T.color.accent, corner = null, capRing = null }) {
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
  const ringPath = capRing ? axes.map((_, i) => pointFor(i, capRing[i]).join(",")).join(" ") : null;
  // 第33弾: corner注記はy=size+16（=SVGの高さの外）に描いていたため、overflow:visibleで
  // 見えてはいてもレイアウト高さに含まれず、直後の要素（選手一覧の練習セレクト等）が
  // 上に重なっていた。注記があるときはSVG自体の高さを注記ぶん広げる。
  const svgH = corner ? size + 22 : size;
  return (
    <svg width={size} height={svgH} viewBox={`0 0 ${size} ${svgH}`} style={{ overflow: "visible", display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map((lv, i) => (
        <polygon key={i} points={axes.map((_, ai) => pointFor(ai, lv).join(",")).join(" ")}
          fill="none" stroke={T.color.rule} strokeWidth={i === 3 ? 1.4 : 1} opacity={i === 3 ? 0.9 : 0.5} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pointFor(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={T.color.rule} strokeWidth={1} opacity={0.5} />;
      })}
      {ringPath && (
        <polygon points={ringPath} fill="none" stroke={color} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.55} />
      )}
      <polygon points={dataPath} fill={color} fillOpacity={fillOpacity} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill={axes[i].color || color} />
      ))}
      {axes.map((ax, i) => {
        // 第30弾(甲改): 真上・真下に近い軸は中央揃え、それ以外は左右へ寄せて揃える
        // （軸数によらず中央付近でラベルが突き合わないようにする）。下側の軸だけ
        // 外周1.5倍の位置へ逃がす（他は1.3倍）。
        const angle = angleFor(i);
        const ux = Math.cos(angle), uy = Math.sin(angle);
        const nearVert = Math.abs(ux) < 0.25;
        const bottom = uy > 0.3;
        const [lx, ly] = pointFor(i, bottom ? 1.5 : 1.3);
        const anchor = nearVert ? "middle" : (ux > 0 ? "start" : "end");
        const dx = nearVert ? 0 : (ux > 0 ? -8 : 8);
        const atMax = fracFor(ax) >= 1;
        return (
          <g key={i}>
            <text x={lx + dx} y={showValues ? ly - 6 : ly} textAnchor={anchor} dominantBaseline="middle"
              fontSize={T.size.caption} fontFamily={FONT_DOT} fill={T.color.sub}>{ax.label}</text>
            {showValues && (
              <text x={lx + dx} y={ly + 7} textAnchor={anchor} dominantBaseline="middle"
                fontSize={T.size.body} fontFamily={FONT_DOT} fill={atMax ? atMaxColor : T.color.text}>
                {Math.round(ax.value ?? 0)}
              </text>
            )}
          </g>
        );
      })}
      {corner && (
        // 第30弾: 右下から左下へ移動（下側の軸のラベルとの接触を避けるため）。
        <g>
          <text x={-6} y={size + 16} textAnchor="start" fontSize={T.size.caption} fontFamily={FONT_DOT} fill={T.color.sub}>{corner.label}</text>
          <text x={28} y={size + 16} textAnchor="start" fontSize={T.size.body} fontFamily={FONT_DOT} fill={T.color.sub}>{corner.value}</text>
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
// 第29弾(判断③): capFor（能力キー→その能力の上限）を渡すと能力別の上限が使われる。
// 第30弾(案B): 外周の正規化を「値÷その能力の上限」から「値÷全軸中の最大上限」へ変更した。
// 前者は得意能力ほど分母も大きくなるため、判断③で作った主武器の突出が図の上で圧縮・
// 逆転する問題があった（実測：突出が63〜77%に圧縮、5.8%のケースで最強能力と図の最外が
// 食い違う。devlog/wave30.md参照）。全軸で分母を揃えることで図の形が能力の実際の
// 大小関係と一致するようにし、各能力の上限は点線シルエット（capRing）として重ねる
// ——実線と点線の隙間がそのまま伸びしろ、点線の形が脚質の個性になる。
// capForを渡さない（シーズン側）場合はmaxCap===cap・capRing===nullとなり従来どおり。
export function AbilityRadarChart({ r, cap = 88, size = 168, color = T.color.accent, capLabel = true, capFor = null }) {
  if (!r) return null;
  const caps = capFor ? AB_KEYS.map(k => capFor(k)) : null;
  const maxCap = caps ? Math.max(...caps) : cap;
  const axes = AB_KEYS.map(k => ({ label: AB_LABEL[k], value: r[k] ?? 0, max: maxCap }));
  const capRing = caps ? caps.map(c => c / maxCap) : null;
  return (
    <RadarChart axes={axes} size={size} color={color} showValues capRing={capRing}
      corner={capLabel ? { label: "上限", value: Math.round(maxCap) } : null} />
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
// 第32弾: 2枚の間の縦の仕切り線を削除（縦線は装飾・区切り目的で使用禁止・2026-08明示）。
// 区切りは余白のみで表現する。
export function AbilitySoshitsuRadarPair({ r, cap, size = 148, capFor = null }) {
  if (!r) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-around", alignItems: "stretch", gap: T.space.lg, marginTop: T.space.sm, flexWrap: "wrap", fontFamily: FONT_DOT }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.xs }}>能力</div>
        <AbilityRadarChart r={r} cap={cap} size={size} capFor={capFor} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.xs }}>素質</div>
        <RiderRadarChart r={r} size={size} />
      </div>
    </div>
  );
}
