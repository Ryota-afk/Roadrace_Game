// hub/riders.jsxより分割（Step13第7弾）：ユース選手獲得・血統ユース（配合）セクション。
// 第13弾Phase3-D-4-b: Section/Itemへ移行。配合の「累代ボーナス／インブリード／金の特殊能力／
// 専用特能」が1行に連結されていた（R1違反）のをItemの行に分離。絵文字を撤去
// （詳細はdevlog/wave13.md）。
import React from "react";
import { loadMlLegends, mlBreedBonus } from "../../../../breeding/breeding.js";
import { Item, PrimaryBtn, QuietBtn, Section } from "../../../../components/kit.jsx";
import { ABILITIES, TYPES } from "../../../../data/abilities.js";
import { T } from "../../../../data/theme.js";
import { mlGradeColor } from "../../../../logic/support.js";

export function renderRidersYouthSection(ctx) {
  const { askConfirm, breedYouthSel, g, rosterMax, setBreedYouthSel, signBredYouth, signYouthProspect } = ctx;
  const legends = loadMlLegends();
  const canBreed = !g.youthUsed && g.roster.length < rosterMax && legends.length >= 2;
  const sel = breedYouthSel;
  const legA = sel ? legends[sel.a] : null;
  const legB = sel && sel.b !== sel.a ? legends[sel.b] : null;
  const breed = (legA && legB) ? mlBreedBonus(legA, legB) : null;
  return (
    <>
      {!g.youthUsed && g.roster.length < rosterMax && g.budget >= 15 && (
        <Section title="ユース選手を獲得" right="契約金15万円・年1回限り">
          <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px 0` }}>現在の能力は控えめですが、成長力A以上が保証された16〜17歳の若手です。</div>
          <PrimaryBtn onClick={() => askConfirm("ユース候補を1名確保しますか？契約金15万円。現在の能力は控えめですが、成長力A以上が保証された16〜17歳の若手です。", signYouthProspect)}>ユース選手を獲得する</PrimaryBtn>
        </Section>
      )}
      {canBreed && (
        <Section title="血統ユース（配合）" right="契約金40万">
          <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px 0` }}>マイライフの殿堂選手2名を親に選び、その血を引く原石を確保します。</div>
          <QuietBtn onClick={() => setBreedYouthSel(sel ? null : { a: 0, b: legends.length > 1 ? 1 : 0 })}>{sel ? "閉じる" : "親を選ぶ"}</QuietBtn>
          {sel && (
            <>
              {[["a", "親A"], ["b", "親B"]].map(([key, lbl]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: T.space.sm, marginTop: T.space.sm }}>
                  <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none" }}>{lbl}</span>
                  <select value={sel[key]} onChange={e => { const v = parseInt(e.target.value); setBreedYouthSel(s => ({ ...s, [key]: v })); }}
                    style={{ flex: 1, background: T.color.surfaceUp, color: T.color.text, border: "none", padding: `${T.space.xs}px ${T.space.sm}px`, fontSize: T.size.caption, fontFamily: "inherit" }}>
                    {legends.map((l, i) => <option key={i} value={i}>{l.name}（{TYPES[l.type]?.label || "？"}{(l.generation || 0) > 0 ? `・${l.generation}代目+${l.plusValue || 0}` : ""}）</option>)}
                  </select>
                </div>
              ))}
              {sel.a === sel.b && <div style={{ fontSize: T.size.caption, color: T.color.bad, marginTop: T.space.sm }}>異なる2名を選んでください</div>}
              {breed && (
                <>
                  <Item label="配合評価" value={breed.matingGrade} valueColor={mlGradeColor(breed.matingGrade)} detail={`爆発力 ${breed.bakuhatsu}`} />
                  {(breed.growthSteps > 0 || breed.talentCap > 0) && (
                    <Item label="配合ボーナス" value={[breed.growthSteps > 0 ? `成長力+${breed.growthSteps}` : null, breed.talentCap > 0 ? `才能+${breed.talentCap}` : null].filter(Boolean).join("・")} valueColor={T.color.accent} />
                  )}
                  {breed.special && <Item label="特殊配合" value={breed.special.title} valueColor={T.color.accent} />}
                  {breed.danger > 0 && <Item label="危険度" value={breed.dangerLabel} valueColor={breed.danger >= 38 ? T.color.bad : T.color.accent}
                    detail={`約${breed.danger}%で「ガラスの体」を持って生まれる${breed.healthMit > 0 ? "／健康な血で軽減済" : ""}`} />}
                  <Item label="相性" value={`${breed.nick.rank} ${breed.nick.label}`} />
                  <Item label="累代ボーナス" value={`+${breed.plusPer}`}
                    detail={[breed.inbreed.count > 0 ? `インブリード×${breed.inbreed.count}` : null, breed.goldInherit && breed.goldInherit.length > 0 ? "金の特殊能力を継承" : null, breed.exclusive && breed.exclusive.length > 0 ? breed.exclusive.map(id => ABILITIES[id] ? ABILITIES[id].label : "？").join("・") : null].filter(Boolean).join("・") || null} />
                  <Item label="継承特能" value={breed.extraAbilities.length ? breed.extraAbilities.map(id => ABILITIES[id] ? ABILITIES[id].label : "？").join("・") : "—"} />
                  {breed.archNotes && breed.archNotes.length > 0 && <Item label="血の格" value={breed.archNotes.join("・")} valueColor={T.color.accent} />}
                </>
              )}
              <div style={{ marginTop: T.space.sm }}>
                <PrimaryBtn disabled={!breed || g.budget < 40} onClick={() => askConfirm(`${legA.name}×${legB.name}の配合で血統ユースを確保しますか？契約金40万円（年1回のユース枠を消費）。`, () => signBredYouth(legA, legB))}>
                  {g.budget < 40 ? "資金不足（40万円必要）" : "この配合で確保する（40万円）"}
                </PrimaryBtn>
              </div>
            </>
          )}
        </Section>
      )}
      {g.youthUsed && <div style={{ fontSize: T.size.caption, color: T.color.sub }}>ユース育成枠は今年度使用済み（来年4月にリセット）</div>}
    </>
  );
}
