// 第9弾：レース中の判断カードUI。RaceView.jsx（1595行）から切り出し。
// レア度（虹＝大勝負／金＝手堅い／通常＝無難／不発＝今は効かない）はdomain/shared/moveEdge.jsが
// simと同じ式（legsLeft01）で計算する。見た目はここだけの責務（CLAUDE.md §5）。
import React from "react";
import { C, FONT_D } from "../data/theme.js";
import { moveEdge } from "../domain/shared/moveEdge.js";

// v39.10以来この画面の演出は一貫してSVGのanimate（CSSの@keyframesは未使用）。
// カードの光り方もこれに揃える：出現の一瞬だけスイープ光が走り、虹／金は縁の発光が
// 「点いた状態」で収まる（常時明滅はしない＝fill="freeze"で最終値に留める）。
function CardGlow({ tier, delaySec }) {
  if (tier === "dud") return null;
  const gradId = `dcGrad`;
  const ringColor = tier === "rainbow" ? `url(#${gradId})` : tier === "gold" ? C.yellow : C.line;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {tier === "rainbow" && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={C.pink} />
            <stop offset="28%" stopColor={C.yellow} />
            <stop offset="52%" stopColor={C.green} />
            <stop offset="76%" stopColor={C.blue} />
            <stop offset="100%" stopColor={C.purple} />
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

function cardIconName(label) {
  const sp = label.indexOf(" ");
  return sp < 0 ? ["", label] : [label.slice(0, sp), label.slice(sp + 1)];
}

function CardButton({ choice, tier, delaySec, disabled, onChoose }) {
  const [icon, name] = cardIconName(choice.label);
  const dud = tier === "dud";
  return (
    <button disabled={disabled} onClick={() => onChoose(choice.move)} title={choice.desc}
      style={{
        position: "relative", overflow: "hidden", textAlign: "center", cursor: disabled ? "default" : "pointer",
        background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 9,
        padding: "10px 8px", minHeight: 60, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 3,
        opacity: disabled ? 0.5 : (dud ? 0.45 : 1), filter: dud ? "saturate(.3)" : "none",
      }}>
      <CardGlow tier={tier} delaySec={delaySec} />
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontFamily: FONT_D, fontSize: 12.5, fontWeight: 700, color: dud ? C.sub : C.text }}>{name}</span>
      {dud && (
        <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "2px 6px 3px", fontSize: 9.5, letterSpacing: "0.06em", color: C.sub, background: "rgba(0,0,0,0.35)", fontFamily: FONT_D }}>不発</span>
      )}
    </button>
  );
}

// 選択肢を「上段2枚＋下段中央1枚（3択）／2×2（4択）」の2段組みへ並べる（ユーザー指定レイアウト）。
function CardRows({ choices, energy, disabled, onChoose }) {
  const rows = [];
  for (let i = 0; i < choices.length; i += 2) rows.push(choices.slice(i, i + 2));
  return (
    <div style={{ display: "grid", gap: 7 }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{
          display: "grid", gap: 7,
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
// 判断の material として必ず見せる（数値ではなくバーと一語で瞬時に読めるようにする）
function LegsBar({ energy }) {
  if (energy == null) return null;
  const raw = Math.max(-100, Math.min(100, energy));
  const pct = (raw + 100) / 2;
  const tier = raw >= 40 ? { t: "十分", c: C.green }
    : raw >= 0 ? { t: "やや消耗", c: C.yellow }
      : raw >= -60 ? { t: "苦しい", c: "#e8a13c" }
        : { t: "売り切れ", c: C.red };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px" }}>
      <span style={{ fontSize: 11, color: C.sub, flexShrink: 0 }}>脚の残り</span>
      <div style={{ flex: 1, height: 8, background: C.panel2, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.line}` }}>
        <div style={{ width: `${pct}%`, height: "100%", background: tier.c, transition: "width .2s" }} />
      </div>
      <span style={{ fontSize: 11.5, fontFamily: FONT_D, fontWeight: 700, color: tier.c, flexShrink: 0 }}>{tier.t}</span>
    </div>
  );
}

export function DecisionCard({ decision, focusName, resimBusy, onChoose }) {
  if (!decision) return null;
  return (
    <div key={decision.id} style={{ background: "linear-gradient(180deg,#2a2018,#1c1712)", border: `2px solid ${C.yellow}`, borderRadius: 12, padding: "12px 14px", boxShadow: "0 4px 18px rgba(0,0,0,0.4)" }}>
      <div style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 800, color: C.yellow }}>{decision.title}</div>
      <div style={{ fontSize: 12, color: C.sub, marginTop: 2, marginBottom: 8 }}>{decision.sub}{focusName ? `　—　${focusName}` : ""}</div>
      <LegsBar energy={decision.energy} />
      <CardRows choices={decision.choices} energy={decision.energy} disabled={resimBusy} onChoose={onChoose} />
      {resimBusy && <div style={{ fontSize: 11, color: C.yellow, marginTop: 8 }}>結果を計算しています…</div>}
    </div>
  );
}
