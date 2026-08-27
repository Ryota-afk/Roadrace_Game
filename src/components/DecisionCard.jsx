// 第9弾：レース中の判断カードUI。RaceView.jsx（1595行）から切り出し。
// レア度（虹＝大勝負／金＝手堅い／通常＝無難）はdomain/shared/moveEdge.jsが
// simと同じ式（legsLeft01）で計算する。見た目はここだけの責務（CLAUDE.md §5）。
// 第13弾Phase3-E：kit.jsxへ移行。争点E2・案A「文字のみ」——選択肢アイコン（約15種の絵文字）を
// 撤去し文言だけに。レア度発光と「脚の残り」バーはデータ層の情報として維持（詳細はdevlog/wave13.md）。
// 第57弾(devlog/wave57.md): 「不発」グレーアウトを撤去。脚依存の一手（legsScaled）には
// 代わりに残量の小さなバーを添え、鈍っているが押せることを示す。
import React from "react";
import { FONT_DOT, RAINBOW_STOPS, T } from "../data/theme.js";
import { moveEdge } from "../domain/shared/moveEdge.js";

// 「脚の残り」の4段階（十分／やや消耗／苦しい／限界）。LegsBarと選択肢の残量バーの
// 両方が使うため、ここに1箇所だけ定義する（CLAUDE.md §5・色段階の二重管理を避ける）。
function legsTier(energy) {
  const raw = Math.max(-100, Math.min(100, energy ?? 100));
  return raw >= 40 ? { t: "十分", c: T.color.good }
    : raw >= 0 ? { t: "やや消耗", c: T.color.accent }
      : raw >= -60 ? { t: "苦しい", c: "#e8a13c" }
        : { t: "限界", c: T.color.bad };
}

// v39.10以来この画面の演出は一貫してSVGのanimate（CSSの@keyframesは未使用）。
// カードの光り方もこれに揃える：出現の一瞬だけスイープ光が走り、虹／金は縁の発光が
// 「点いた状態」で収まる（常時明滅はしない＝fill="freeze"で最終値に留める）。
function CardGlow({ tier, delaySec }) {
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

function CardButton({ choice, tier, g, legsScaled, energy, delaySec, disabled, onChoose }) {
  return (
    <button disabled={disabled} onClick={() => onChoose(choice.move)} title={choice.desc}
      style={{
        position: "relative", overflow: "hidden", textAlign: "center", cursor: disabled ? "default" : "pointer",
        background: T.color.surfaceUp, color: T.color.text, border: "none",
        padding: `${T.space.sm}px ${T.space.xs}px`, minHeight: 52, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 4,
        opacity: disabled ? 0.5 : 1,
      }}>
      <CardGlow tier={tier} delaySec={delaySec} />
      <span style={{ fontFamily: FONT_DOT, fontSize: T.size.body, color: T.color.text }}>{choice.label}</span>
      {legsScaled && (
        <div style={{ width: "70%", height: 3, background: T.color.surface, overflow: "hidden" }}>
          <div style={{ width: `${g * 100}%`, height: "100%", background: legsTier(energy).c }} />
        </div>
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
            const { tier, g, legsScaled } = moveEdge(c.move, energy);
            return <CardButton key={c.move} choice={c} tier={tier} g={g} legsScaled={legsScaled} energy={energy} delaySec={idx * 0.08} disabled={disabled} onChoose={onChoose} />;
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
  const tier = legsTier(energy);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: T.space.sm, margin: `0 0 ${T.space.sm}px` }}>
      <span style={{ fontSize: T.size.caption, color: T.color.sub, flexShrink: 0 }}>脚の残り</span>
      <div style={{ flex: 1, height: 6, background: T.color.sunken, overflow: "hidden" }}>
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
