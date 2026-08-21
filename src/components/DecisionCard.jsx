// 第9弾：レース中の判断カードUI。RaceView.jsx（1595行）から切り出し。
// レア度（虹＝大勝負／金＝手堅い／通常＝無難／不発＝今は効かない）はdomain/shared/moveEdge.jsが
// simと同じ式（legsLeft01）で計算する。見た目はここだけの責務（CLAUDE.md §5）。
// 第13弾Phase3-E：kit.jsxへ移行。争点E2・案A「文字のみ」——選択肢アイコン（約15種の絵文字）を
// 撤去し文言だけに。レア度発光と「脚の残り」バーはデータ層の情報として維持（詳細はdevlog/wave13.md）。
import React from "react";
import { FONT_DOT, T } from "../data/theme.js";
import { moveEdge } from "../domain/shared/moveEdge.js";

// 虹（大勝負）は特定の意味色1つに割り当てられない「特別枠」の演出色なので、
// T.color（accent/action/good/bad）とは別枠の固定パレットを使う（COND_COLOR等と同じ扱い）。
const RAINBOW_STOPS = ["#e88bb0", "#F2C94C", "#7FB069", "#4f8fe8", "#A76ADC"];

// v39.10以来この画面の演出は一貫してSVGのanimate（CSSの@keyframesは未使用）。
// カードの光り方もこれに揃える：出現の一瞬だけスイープ光が走り、虹／金は縁の発光が
// 「点いた状態」で収まる（常時明滅はしない＝fill="freeze"で最終値に留める）。
function CardGlow({ tier, delaySec }) {
  if (tier === "dud") return null;
  const gradId = `dcGrad`;
  const ringColor = tier === "rainbow" ? `url(#${gradId})` : tier === "gold" ? T.color.accent : T.color.rule;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {tier === "rainbow" && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            {RAINBOW_STOPS.map((c, i) => <stop key={i} offset={`${Math.round(i / (RAINBOW_STOPS.length - 1) * 100)}%`} stopColor={c} />)}
          </linearGradient>
        </defs>
      )}
      <rect x="1" y="1" width="98" height="98" rx="10" ry="10" fill="none"
        stroke={ringColor} strokeWidth={tier === "normal" ? 1 : 2}
        opacity={tier === "normal" ? 0.5 : 0}>
        {tier !== "normal" && (
          <animate attributeName="opacity" values="0;1;0.85" dur="0.5s" begin={`${delaySec}s`} fill="freeze" />
        )}
      </rect>
      {/* 表示された瞬間だけ斜めに走るスイープ光。収まった後は残らない */}
      <polygon points="-14,112 8,-12 26,-12 4,112" fill="#ffffff" opacity="0.5">
        <animateTransform attributeName="transform" type="translate" values="-16 0;150 0" dur="0.46s" begin={`${delaySec}s`} fill="freeze" />
        <animate attributeName="opacity" values="0.5;0.5;0" dur="0.46s" begin={`${delaySec}s`} fill="freeze" />
      </polygon>
    </svg>
  );
}

function CardButton({ choice, tier, delaySec, disabled, onChoose }) {
  const dud = tier === "dud";
  return (
    <button disabled={disabled} onClick={() => onChoose(choice.move)} title={choice.desc}
      style={{
        position: "relative", overflow: "hidden", textAlign: "center", cursor: disabled ? "default" : "pointer",
        background: T.color.surfaceUp, color: T.color.text, border: "none",
        padding: `${T.space.sm}px ${T.space.xs}px`, minHeight: 52, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.5 : (dud ? 0.45 : 1), filter: dud ? "saturate(.3)" : "none",
      }}>
      <CardGlow tier={tier} delaySec={delaySec} />
      <span style={{ fontFamily: FONT_DOT, fontSize: T.size.body, color: dud ? T.color.sub : T.color.text }}>{choice.label}</span>
      {dud && (
        <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "2px 6px 3px", fontSize: 9.5, letterSpacing: "0.06em", color: T.color.sub, background: "rgba(0,0,0,0.35)", fontFamily: FONT_DOT }}>不発</span>
      )}
    </button>
  );
}

// 選択肢を「上段2枚＋下段中央1枚（3択）／2×2（4択）」の2段組みへ並べる（ユーザー指定レイアウト）。
function CardRows({ choices, energy, disabled, onChoose }) {
  const rows = [];
  for (let i = 0; i < choices.length; i += 2) rows.push(choices.slice(i, i + 2));
  return (
    <div style={{ display: "grid", gap: T.space.xs }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{
          display: "grid", gap: T.space.xs,
          gridTemplateColumns: row.length === 1 ? "1fr" : "1fr 1fr",
          padding: row.length === 1 ? "0 25%" : 0,
        }}>
          {row.map((c, ci) => {
            const idx = ri * 2 + ci;
            const { tier } = moveEdge(c.move, energy);
            return <CardButton key={c.move} choice={c} tier={tier} delaySec={idx * 0.08} disabled={disabled} onChoose={onChoose} />;
          })}
        </div>
      ))}
    </div>
  );
}

// v46(#27): 脚の残り。仕掛け系の一手はこの残量で威力が決まるため、
// 判断の material として必ず見せる（数値ではなくバーと一語で瞬時に読めるようにする）。
// 4段階の色は「脚の消耗度」というデータ自体が持つ意味色なので、accent/action/good/badの
// 意味役割とは別枠の専用パレット（#e8a13cのみ既存プロジェクト全体で使う警告色を流用）。
function LegsBar({ energy }) {
  if (energy == null) return null;
  const raw = Math.max(-100, Math.min(100, energy));
  const pct = (raw + 100) / 2;
  const tier = raw >= 40 ? { t: "十分", c: T.color.good }
    : raw >= 0 ? { t: "やや消耗", c: T.color.accent }
      : raw >= -60 ? { t: "苦しい", c: "#e8a13c" }
        : { t: "売り切れ", c: T.color.bad };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: T.space.sm, margin: `0 0 ${T.space.sm}px` }}>
      <span style={{ fontSize: T.size.caption, color: T.color.sub, flexShrink: 0 }}>脚の残り</span>
      <div style={{ flex: 1, height: 6, background: T.color.surfaceUp, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: tier.c, transition: "width .2s" }} />
      </div>
      <span style={{ fontSize: T.size.caption, fontFamily: FONT_DOT, color: tier.c, flexShrink: 0 }}>{tier.t}</span>
    </div>
  );
}

export function DecisionCard({ decision, focusName, resimBusy, onChoose }) {
  if (!decision) return null;
  return (
    <div key={decision.id} style={{ background: T.color.surface, padding: `${T.space.md}px ${T.space.lg}px` }}>
      <div style={{ fontFamily: FONT_DOT, fontSize: T.size.head, color: T.color.accent }}>{decision.title}</div>
      <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2, marginBottom: T.space.sm }}>{decision.sub}{focusName ? `　—　${focusName}` : ""}</div>
      <LegsBar energy={decision.energy} />
      <CardRows choices={decision.choices} energy={decision.energy} disabled={resimBusy} onChoose={onChoose} />
      {resimBusy && <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: T.space.sm }}>結果を計算しています…</div>}
    </div>
  );
}
