// 系譜ツリー／因子図鑑の共通ビュー。生涯評価（screens/meta.jsx）とマイライフ殿堂
// （screens/mylife/career.jsx）の両方から呼ばれる、ほぼ同一だったJSXをStep7第11弾で統合した。
// 差分（見出し要素・空状態文言・戻るボタン等）はvariant/footerで吸収する。
import React from "react";
import { C, FONT_D, FONT_M } from "../data/theme.js";
import { TYPES } from "../data/abilities.js";
import { Eyebrow } from "./ui.jsx";

// 呼び出し元ごとの見た目差分。将来どちらかへ寄せる余地を残すための表。
const LINEAGE_VARIANT = {
  dynasty: { headingAsH2: true, descMarginTop: undefined, memberPosition: undefined, emptyText: "まだ殿堂選手がいません。マイライフで選手を引退させると系譜が始まります。" },
  mylife: { headingAsH2: false, descMarginTop: 4, memberPosition: "relative", emptyText: "まだ殿堂選手がいません。選手を引退させると系譜が始まります。" },
};
const FACTOR_VARIANT = {
  dynasty: { headingAsH2: true, descMarginTop: undefined, emptyText: "まだ殿堂選手がいません。マイライフで選手を引退させると因子が集まり始めます。" },
  mylife: { headingAsH2: false, descMarginTop: 4, emptyText: "まだ殿堂選手がいません。選手を引退させると因子が集まり始めます。" },
};

export function LineageForestView({ forest, totalLeg, variant, footer }) {
  const v = LINEAGE_VARIANT[variant];
  const tierColor = ["#7c8aa5", "#6fbf73", "#4f8fe8", "#ffd23f"];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "linear-gradient(180deg,#233026,#1d2a22)", borderRadius: 12, padding: 16, borderTop: `4px solid ${C.green}` }}>
        {v.headingAsH2
          ? <h2 style={{ fontFamily: FONT_D, color: C.green, fontSize: 20, margin: "0 0 4px" }}>🌳 系譜ツリー</h2>
          : <Eyebrow color={C.green}>🌳 系譜ツリー</Eyebrow>}
        <div style={{ fontSize: 12, color: C.sub, marginTop: v.descMarginTop, lineHeight: 1.6 }}>歴代選手（{totalLeg}名）を系統（血の流れ）ごとにまとめました。配合を重ねると世代（🧬N代目）が進み、系統が「確立→名門→大系統」へ育ちます。</div>
      </div>
      {totalLeg === 0 && <div style={{ fontSize: 12.5, color: C.sub, padding: 10 }}>{v.emptyText}</div>}
      {forest.map(g => (
        <div key={g.lineageName} style={{ background: C.panel, borderRadius: 12, padding: "12px 14px", border: `1px solid ${tierColor[g.tier.tier]}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>{g.lineageName}</span>
            <span style={{ fontSize: 11, color: tierColor[g.tier.tier], fontWeight: 700 }}>{g.tier.label}{g.tier.tier > 0 ? `（因子+${g.tier.tier}）` : ""}・{g.size}名</span>
          </div>
          <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
            {g.members.map((m, i) => (
              <div key={i} style={{ paddingLeft: Math.min(4, m.generation) * 14, position: v.memberPosition }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12.5 }}>
                  <span style={{ color: C.sub, fontFamily: FONT_M, fontSize: 10 }}>{m.generation > 0 ? "└" : "●"}</span>
                  <span style={{ fontFamily: FONT_D, color: C.text, fontWeight: 700 }}>{m.name}</span>
                  <span style={{ fontSize: 10, color: TYPES[m.type]?.color }}>{TYPES[m.type]?.label}</span>
                  {m.generation > 0 && <span style={{ fontSize: 10, color: "#e56cc8" }}>🧬{m.generation}代目{m.plusValue > 0 ? `+${m.plusValue}` : ""}</span>}
                  <span style={{ fontSize: 10, color: C.sub }}>OVR{m.overall}</span>
                </div>
                {m.nickname && <div style={{ fontSize: 10, color: C.purple, fontStyle: "italic", paddingLeft: 16 }}>「{m.nickname}」</div>}
                {m.parents.length > 0 && <div style={{ fontSize: 9.5, color: C.sub, paddingLeft: 16 }}>親：{m.parents.join(" × ")}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {footer}
    </div>
  );
}

export function FactorCollectionView({ cats, totalLeg, variant, footer }) {
  const v = FACTOR_VARIANT[variant];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "linear-gradient(180deg,#2e2436,#241d2c)", borderRadius: 12, padding: 16, borderTop: `4px solid #e56cc8` }}>
        {v.headingAsH2
          ? <h2 style={{ fontFamily: FONT_D, color: "#e56cc8", fontSize: 20, margin: "0 0 4px" }}>🧬 因子図鑑</h2>
          : <Eyebrow color={"#e56cc8"}>🧬 因子図鑑</Eyebrow>}
        <div style={{ fontSize: 12, color: C.sub, marginTop: v.descMarginTop, lineHeight: 1.6 }}>歴代の殿堂選手（{totalLeg}名）が残した「因子」の集まりです。★＝その因子を持つ選手の数。周回を重ねるほど因子が貯まり、系統{variant === "mylife" ? "（血統）" : ""}を通じて配合・弟子継承に受け継がれます。</div>
      </div>
      {totalLeg === 0 && <div style={{ fontSize: 12.5, color: C.sub, padding: 10 }}>{v.emptyText}</div>}
      {cats.map(cat => (
        <div key={cat.category} style={{ background: C.panel, borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.line}` }}>
          <Eyebrow color={C.purple}>{cat.icon} {cat.category}</Eyebrow>
          {cat.items.length === 0 && <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>まだこの種類の因子はありません。</div>}
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {cat.items.map(it => (
              <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: C.bg, borderRadius: 8 }}>
                <span style={{ fontFamily: FONT_D, fontSize: 13, color: it.color, fontWeight: 700, minWidth: 92 }}>{it.label}</span>
                <span style={{ fontFamily: FONT_M, fontSize: 12, color: "#ffd23f", letterSpacing: -1 }}>{"★".repeat(Math.min(6, it.count))}{it.count > 6 ? ` ×${it.count}` : ""}</span>
                <span style={{ flex: 1, fontSize: 10, color: C.sub, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.members.slice(0, 3).join("・")}{it.members.length > 3 ? "…" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {footer}
    </div>
  );
}
