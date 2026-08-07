// hub/riders.jsxより分割（Step13第7弾）：ユース選手獲得・血統ユース（配合）セクション。
// 中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { loadMlLegends, mlBreedBonus } from "../../../../breeding/breeding.js";
import { Btn } from "../../../../components/ui.jsx";
import { ABILITIES, TYPES } from "../../../../data/abilities.js";
import { C, FONT_D, FONT_M } from "../../../../data/theme.js";
import { mlGradeColor } from "../../../../logic/support.js";

export function renderRidersYouthSection(ctx) {
  const { askConfirm, breedYouthSel, g, rosterMax, setBreedYouthSel, signBredYouth, signYouthProspect } = ctx;
  return (
        <div style={{ display: "grid", gap: 10 }}>
          {!g.youthUsed && g.roster.length < rosterMax && g.budget >= 15 && (
            <Btn small outline color={C.green} onClick={() => askConfirm("ユース候補を1名確保しますか？契約金15万円。現在の能力は控えめですが、成長力A以上が保証された16〜17歳の若手です。", signYouthProspect)}>
              🌱 ユース選手を獲得する（契約金15万円・年1回限り）
            </Btn>
          )}
          {/* v31.1: 血統ユース（配合）。マイライフ殿堂の2名を親に選び、配合の原石を確保する */}
          {!g.youthUsed && g.roster.length < rosterMax && (() => {
            const legends = loadMlLegends();
            if (legends.length < 2) return null;
            const sel = breedYouthSel;
            const legA = sel ? legends[sel.a] : null;
            const legB = sel && sel.b !== sel.a ? legends[sel.b] : null;
            const breed = (legA && legB) ? mlBreedBonus(legA, legB) : null;
            return (
              <div style={{ background: "linear-gradient(180deg,#2a2436,#22202f)", borderRadius: 10, padding: "10px 12px", border: `1px solid #e56cc8` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: FONT_D, fontSize: 12.5, fontWeight: 700, color: "#e56cc8" }}>🧬 血統ユース（配合・契約金40万）</span>
                  <Btn small outline color={"#e56cc8"} onClick={() => setBreedYouthSel(sel ? null : { a: 0, b: legends.length > 1 ? 1 : 0 })}>{sel ? "閉じる" : "親を選ぶ"}</Btn>
                </div>
                <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>マイライフの殿堂選手2名を親に選び、その血を引く原石を確保します。</div>
                {sel && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {[["a", "親A"], ["b", "親B"]].map(([key, lbl]) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: C.sub, width: 32 }}>{lbl}</span>
                        <select value={sel[key]} onChange={e => { const v = parseInt(e.target.value); setBreedYouthSel(s => ({ ...s, [key]: v })); }}
                          style={{ flex: 1, background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 6px", fontSize: 12 }}>
                          {legends.map((l, i) => <option key={i} value={i}>{l.name}（{TYPES[l.type]?.label || "？"}{(l.generation || 0) > 0 ? `・${l.generation}代目+${l.plusValue || 0}` : ""}）</option>)}
                        </select>
                      </div>
                    ))}
                    {sel.a === sel.b && <div style={{ fontSize: 10.5, color: C.red }}>※ 異なる2名を選んでください</div>}
                    {breed && (
                      <div style={{ background: C.panel2, borderRadius: 8, padding: "7px 9px", fontSize: 11, color: C.text, lineHeight: 1.7 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: C.sub }}>配合評価</span>
                          <span style={{ fontFamily: FONT_M, fontWeight: 800, fontSize: 15, color: mlGradeColor(breed.matingGrade) }}>{breed.matingGrade}</span>
                          <span style={{ fontSize: 10, color: C.sub }}>爆発力 <span style={{ fontFamily: FONT_M, color: C.yellow }}>{breed.bakuhatsu}</span></span>
                          {(breed.growthSteps > 0 || breed.talentCap > 0) && <span style={{ fontSize: 10, color: "#9ae6b4" }}>{breed.growthSteps > 0 ? `成長力+${breed.growthSteps}` : ""}{breed.growthSteps > 0 && breed.talentCap > 0 ? "・" : ""}{breed.talentCap > 0 ? `才能+${breed.talentCap}` : ""}</span>}
                        </div>
                        {breed.special && <div style={{ color: breed.special.color, fontWeight: 800 }}>🌟 特殊配合『{breed.special.title}』</div>}
                        {breed.danger > 0 && <div style={{ color: breed.danger >= 38 ? C.red : "#e8a13c", fontSize: 10.5 }}>⚠️ 危険度 {breed.dangerLabel}（約{breed.danger}%）：稀に「ガラスの体」を持って生まれる{breed.healthMit > 0 ? "／健康な血で軽減済" : ""}</div>}
                        <div>相性 <span style={{ color: breed.nick.rank === "◎" ? C.yellow : breed.nick.rank === "○" ? C.green : C.sub, fontWeight: 700 }}>{breed.nick.rank} {breed.nick.label}</span></div>
                        <div>累代ボーナス <span style={{ color: C.yellow }}>+{breed.plusPer}</span>{breed.inbreed.count > 0 && <span style={{ color: C.red }}>・🩸インブリード×{breed.inbreed.count}</span>}{breed.goldInherit && breed.goldInherit.length > 0 && <span style={{ color: C.yellow }}>・✨金の特殊能力</span>}{breed.exclusive && breed.exclusive.length > 0 && <span style={{ color: "#e56cc8" }}>・💎{breed.exclusive.map(id => ABILITIES[id] ? ABILITIES[id].label : "？").join("・")}</span>}</div>
                        <div style={{ color: C.sub }}>継承特能：{breed.extraAbilities.length ? breed.extraAbilities.map(id => ABILITIES[id] ? ABILITIES[id].label : "？").join("・") : "—"}</div>
                        {breed.archNotes && breed.archNotes.length > 0 && <div style={{ color: "#e8a13c" }}>血の格：{breed.archNotes.join("・")}</div>}
                      </div>
                    )}
                    <Btn small color={"#e56cc8"} disabled={!breed || g.budget < 40} onClick={() => askConfirm(`${legA.name}×${legB.name}の配合で血統ユースを確保しますか？契約金40万円（年1回のユース枠を消費）。`, () => signBredYouth(legA, legB))}>
                      {g.budget < 40 ? "資金不足（40万円必要）" : "🧬 この配合で確保する（40万円）"}
                    </Btn>
                  </div>
                )}
              </div>
            );
          })()}
          {g.youthUsed && <div style={{ fontSize: 11, color: C.sub }}>🌱 ユース育成枠は今年度使用済み（来年4月にリセット）</div>}
        </div>
  );
}
