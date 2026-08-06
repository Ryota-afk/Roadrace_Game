// mylife.jsx より分割（Step8）：キャラクター作成・スカウト（mylife_create/mylife_scout）
import React from "react";
import { loadBloodlines, loadMlLegends, mlBloodlineFactor, mlBloodlineTier, mlBreedBonus, protegeInherit } from "../../breeding/breeding.js";
import { AbilityGrid, TraitLine } from "../../components/panels.jsx";
import { Btn, Eyebrow } from "../../components/ui.jsx";
import { fmtRelTime, overall } from "../../core/core.js";
import { ABILITIES, AB_LABEL, POW, TYPES } from "../../data/abilities.js";
import { DIFFICULTIES } from "../../data/progression.js";
import { C, FONT_D, FONT_M } from "../../data/theme.js";
import { MLCP_DIFF_MUL, ML_BACKGROUNDS, SUB_STAT_LABEL, clearMyLifeSave, hasMyLifeSave, mlGradeColor, mlGrowthPowRevealed, mlTalentRank } from "../../logic/support.js";
import { loadMyLifeGame, myLifeSaveInfo } from "../../state/state.js";

export function renderMyLifeCreateScreens(ctx) {
  const { askConfirm, ml, mlConfirmCandidate, mlCreateChar, mlRerollCandidate, mlWrap, setMl, setSuperMode } = ctx;
    if (ml.screen === "mylife_create") {
      const typeOpts = Object.entries(TYPES);
      const bgOpts = Object.entries(ML_BACKGROUNDS);
      return mlWrap(
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 18, border: `1px solid ${C.line}` }}>
            <Eyebrow>MY LIFE — キャラクター作成</Eyebrow>
            <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.7, margin: "6px 0 0" }}>
              脚質と経歴を選んでB1のいずれかのチームに新人選手として加入します。
            </p>
          </div>
          {hasMyLifeSave() && (() => {
            const info = myLifeSaveInfo();
            return (
              <Btn onClick={() => { const loaded = loadMyLifeGame(); if (loaded) setMl(loaded); }}>
                💾 続きから
                {info && <span style={{ display: "block", fontSize: 10.5, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>{info.name}{info.age ? `（${info.age}歳）` : ""}・{info.classLabel}・{info.year}年目{info.savedAt ? ` — ${fmtRelTime(info.savedAt)}に保存` : ""}</span>}
              </Btn>
            );
          })()}
          <div>
            <Eyebrow>脚質</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {typeOpts.map(([k, t]) => (
                <button key={k} onClick={() => setMl(s => ({ ...s, typeChoice: k }))}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: ml.typeChoice === k ? "rgba(255,210,63,0.12)" : C.panel,
                    border: `1.5px solid ${ml.typeChoice === k ? C.yellow : C.line}`,
                  }}>
                  <span style={{ fontFamily: FONT_D, fontWeight: 700, color: t.color }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow>経歴（年齢・能力・伸びしろに影響）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {bgOpts.map(([k, b]) => (
                <button key={k} onClick={() => setMl(s => ({ ...s, bgChoice: k }))}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: ml.bgChoice === k ? "rgba(255,210,63,0.12)" : C.panel,
                    border: `1.5px solid ${ml.bgChoice === k ? C.yellow : C.line}`,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{b.label}</span>
                    <span style={{ fontSize: 11, color: C.sub }}>{b.age}歳スタート</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{b.desc}</div>
                  {b.merit && <div style={{ fontSize: 11, color: C.green, marginTop: 4, lineHeight: 1.5 }}><b>{b.meritLabel}</b> {b.merit}</div>}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow>難易度（相手の強さ・成長上限・クリアポイント倍率）</Eyebrow>
            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
              {DIFFICULTIES.map((d) => {
                const cpMul = MLCP_DIFF_MUL[d.id] ?? 1;
                const sel = (ml.mlDiffChoice || "easy") === d.id;
                return (
                  <button key={d.id} onClick={() => setMl(s => ({ ...s, mlDiffChoice: d.id }))}
                    style={{ textAlign: "left", padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                      background: sel ? "rgba(255,210,63,0.12)" : C.panel, border: `1.5px solid ${sel ? C.yellow : C.line}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{d.label}</span>
                      <span style={{ fontSize: 11, color: cpMul > 1 ? C.green : C.sub }}>CP ×{cpMul}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 2, lineHeight: 1.5 }}>{d.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
          {(() => {
            const legends = loadMlLegends();
            if (legends.length === 0) return null;
            const idx = ml.masterIdx ?? -1;
            const master = idx >= 0 ? legends[idx] : null;
            const inh = master ? protegeInherit(master) : null;
            return (
              <div>
                <Eyebrow color={C.purple}>師匠（歴代の名選手に師事・任意）</Eyebrow>
                <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 6px" }}>過去に殿堂入りした選手の教え子としてデビューできます。師の得意能力や特殊能力・成長力の一部を受け継ぎます。</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <button onClick={() => setMl(s => ({ ...s, masterIdx: -1 }))}
                    style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                      background: idx === -1 ? "rgba(255,210,63,0.12)" : C.panel, border: `1.5px solid ${idx === -1 ? C.yellow : C.line}` }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>師事しない（通常のデビュー）</span>
                  </button>
                  {legends.map((leg, i) => (
                    <button key={i} onClick={() => setMl(s => ({ ...s, masterIdx: i }))}
                      style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                        background: idx === i ? "rgba(201,139,240,0.14)" : C.panel, border: `1.5px solid ${idx === i ? C.purple : C.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{leg.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>（{TYPES[leg.type]?.label || leg.type}）</span></span>
                        <span style={{ fontSize: 10.5, color: C.sub }}>{leg.wins || 0}勝/{leg.podiums || 0}表彰台</span>
                      </div>
                      {leg.nickname && <div style={{ fontSize: 11, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{leg.nickname}」</div>}
                    </button>
                  ))}
                </div>
                {inh && (
                  <div style={{ background: C.panel2, borderRadius: 8, padding: "8px 10px", marginTop: 8, fontSize: 11.5, color: C.text, lineHeight: 1.7 }}>
                    <div><span style={{ color: C.purple, fontWeight: 700 }}>師の教え：</span>{inh.teaching.label}<span style={{ color: C.sub, fontSize: 10.5 }}>（{inh.teaching.desc}）</span></div>
                    <div>
                      <span style={{ color: C.purple, fontWeight: 700 }}>継承：</span>
                      {Object.entries(inh.abBonus).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join(" / ")}
                      {inh.subBonus && Object.entries(inh.subBonus).map(([k, v]) => `・${SUB_STAT_LABEL[k]}${v >= 0 ? "+" : ""}${v}`).join("")}
                      {inh.growthPowBump && "・成長力+1段階"}
                      <span style={{ color: C.yellow }}>・継承特性「{ABILITIES[inh.lineageTrait].label}」</span>
                      {inh.inheritAbility && `・特殊能力「${ABILITIES[inh.inheritAbility].label}」`}
                    </div>
                  </div>
                )}
                {/* v31: 配合相手（2人目の親）。師匠を選んでいる時だけ表示する */}
                {master && legends.length >= 2 && (() => {
                  const pIdx = ml.partnerIdx ?? -1;
                  const partner = (pIdx >= 0 && pIdx !== idx) ? legends[pIdx] : null;
                  const breed = partner ? mlBreedBonus(master, partner) : null;
                  const nickColor = breed ? (breed.nick.rank === "◎" ? C.yellow : breed.nick.rank === "○" ? C.green : C.sub) : C.sub;
                  return (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                      <Eyebrow color={"#e56cc8"}>🧬 配合相手（もう一人の親・任意）</Eyebrow>
                      <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 6px" }}>師匠に加えて2人目の親を選ぶと「配合」になり、両方の血を引く逸材が生まれます。脚質の相性（ニック◎○△）、共通の祖先による血の濃さ（インブリード）、代を重ねるほど蓄積する+値が乗ります。</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <button onClick={() => setMl(s => ({ ...s, partnerIdx: -1 }))}
                          style={{ textAlign: "left", padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                            background: pIdx === -1 ? "rgba(255,210,63,0.12)" : C.panel, border: `1.5px solid ${pIdx === -1 ? C.yellow : C.line}` }}>
                          <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>配合しない（師事のみ）</span>
                        </button>
                        {legends.map((leg, i) => i === idx ? null : (
                          <button key={i} onClick={() => setMl(s => ({ ...s, partnerIdx: i }))}
                            style={{ textAlign: "left", padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                              background: pIdx === i ? "rgba(229,108,200,0.16)" : C.panel, border: `1.5px solid ${pIdx === i ? "#e56cc8" : C.line}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{leg.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>（{TYPES[leg.type]?.label || leg.type}）</span></span>
                              <span style={{ fontSize: 10.5, color: C.sub }}>{(leg.generation || 0) > 0 ? `${leg.generation}代目・` : ""}+{leg.plusValue || 0}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      {breed && (
                        <div style={{ background: "linear-gradient(180deg,#2e2436,#241d2c)", borderRadius: 8, padding: "9px 11px", marginTop: 8, fontSize: 11.5, color: C.text, lineHeight: 1.7, border: `1px solid #e56cc8` }}>
                          {breed.special && (
                            <div style={{ background: "linear-gradient(90deg,#3a2f10,#2b2410)", border: `1px solid ${breed.special.color}`, borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
                              <div style={{ color: breed.special.color, fontWeight: 800, fontSize: 12.5 }}>🌟 特殊配合『{breed.special.title}』</div>
                              <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>{breed.special.note}</div>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: "#e56cc8" }}>配合評価</span>
                            <span style={{ fontFamily: FONT_M, fontWeight: 800, fontSize: 17, color: mlGradeColor(breed.matingGrade), textShadow: "0 0 6px rgba(0,0,0,.4)" }}>{breed.matingGrade}</span>
                            <span style={{ fontSize: 10.5, color: C.sub }}>爆発力 <span style={{ fontFamily: FONT_M, color: C.yellow }}>{breed.bakuhatsu}</span></span>
                          </div>
                          <div style={{ fontSize: 10.5, color: "#9ae6b4", marginBottom: 3 }}>
                            {breed.growthSteps > 0 && `成長力+${breed.growthSteps}段`}{breed.growthSteps > 0 && breed.talentCap > 0 && "・"}{breed.talentCap > 0 && `才能キャップ+${breed.talentCap}`}{(breed.growthSteps > 0 || breed.talentCap > 0) ? "（生まれた時は普通でも育てると化ける）" : "素質は平凡（配合の質を上げると化ける）"}
                          </div>
                          {breed.danger > 0 && (
                            <div style={{ fontSize: 10.5, color: breed.danger >= 38 ? C.red : "#e8a13c", marginBottom: 3 }}>
                              ⚠️ 危険度 <span style={{ fontWeight: 700 }}>{breed.dangerLabel}</span>（約{breed.danger}%）：稀に「ガラスの体」を持って生まれる{breed.healthMit > 0 ? "／健康な血で軽減済" : "。頑丈・鉄人の血を持つ親で軽減できる"}
                            </div>
                          )}
                          <div><span style={{ fontWeight: 700, color: "#e56cc8" }}>配合相性：</span><span style={{ color: nickColor, fontWeight: 700 }}>{breed.nick.rank} {breed.nick.label}</span></div>
                          <div><span style={{ fontWeight: 700, color: "#e56cc8" }}>血統ボーナス：</span>
                            累代+値 <span style={{ color: C.yellow }}>+{breed.plusPer}</span>
                            {breed.inbreed.count > 0 && <span style={{ color: C.red }}>・🩸インブリード×{breed.inbreed.count}（血が濃い！）</span>}
                            {breed.generation > 1 && `・${breed.generation}代目`}
                          </div>
                          <div><span style={{ fontWeight: 700, color: "#e56cc8" }}>受け継ぐ特能：</span>
                            {breed.extraAbilities.length > 0 ? breed.extraAbilities.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・") : "—"}
                          </div>
                          {breed.goldInherit && breed.goldInherit.length > 0 && (
                            <div style={{ color: C.yellow, fontWeight: 700 }}>✨ 金特クロス：{breed.goldInherit.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")}（最初から金特！）</div>
                          )}
                          {breed.exclusive && breed.exclusive.length > 0 && (
                            <div style={{ color: "#e56cc8", fontWeight: 700 }}>🩸 配合限定特能：{breed.exclusive.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")}</div>
                          )}
                          <div><span style={{ fontWeight: 700, color: "#e56cc8" }}>継承する系統：</span>{master.lineageName || `${master.name}系`}
                            {(() => { const rec = loadBloodlines()[master.lineageName || `${master.name}系`]; const t = rec ? mlBloodlineTier(rec) : null; if (!t || t.tier <= 0) return null; const fac = mlBloodlineFactor(rec); return <span style={{ color: "#e8a13c", fontWeight: 700 }}>　🏛{t.label}系統（因子：伸びしろ+{t.tier}{fac ? `・${ABILITIES[fac]?.label || fac}` : ""}{t.tier >= 3 ? "★金" : ""}）</span>; })()}
                          </div>
                          {breed.archNotes && breed.archNotes.length > 0 && (
                            <div style={{ color: "#e8a13c" }}>🩸 血の格：{breed.archNotes.join("・")}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}
          <Btn onClick={() => {
            const legends = loadMlLegends();
            const mIdx = ml.masterIdx ?? -1;
            const master = mIdx >= 0 ? legends[mIdx] : null;
            const pIdx = ml.partnerIdx ?? -1;
            const partner = (master && pIdx >= 0 && pIdx !== mIdx) ? legends[pIdx] : null;
            const doCreate = () => { clearMyLifeSave(); mlCreateChar(ml.typeChoice, ml.bgChoice, master, partner); };
            if (hasMyLifeSave()) askConfirm("保存データを消して新しい選手でキャリアを始めます。よろしいですか？", doCreate);
            else doCreate();
          }}>この内容でデビュー →</Btn>
          <Btn outline color={C.purple} onClick={() => setMl(s => ({ ...s, screen: "mylife_legends" }))}>🏛 歴代選手の殿堂を見る</Btn>
          <Btn outline color={C.sub} onClick={() => setSuperMode(null)}>← モード選択に戻る</Btn>
        </div>
      );
    }

    // v36(#5リセマラ): 素質診断。デビュー前に成長力・性格・特能・素質ランクを確認し、
    // 気に入るまで「引き直す」できる（確定するまでセーブされない）。
    if (ml.screen === "mylife_scout" && ml.player) {
      const r = ml.player;
      // v43(マイライフ難易度調整Phase 1・成長力マスク化): 成長力は3年目まで非公開。
      // 素質診断はこの時点(year=1)では常に非公開側で採点する（成長力込みのSSを狙うリセマラ潰し）。
      const powRevealed = mlGrowthPowRevealed(ml);
      const tr = mlTalentRank(r, powRevealed);
      const pw = POW[r.growthPow];
      const persLabel = tr.parts?.persLabel || "普通";
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "linear-gradient(180deg, rgba(255,210,63,0.08), #201e26)", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
            <Eyebrow color={C.yellow}>🔍 素質診断 — スカウトの評価</Eyebrow>
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "10px 0 6px" }}>
              <div style={{ minWidth: 62, textAlign: "center", background: "rgba(0,0,0,0.25)", border: `2px solid ${tr.color}`, borderRadius: 12, padding: "6px 8px" }}>
                <div style={{ fontSize: 9.5, color: C.sub }}>素質</div>
                <div style={{ fontFamily: FONT_D, fontWeight: 800, fontSize: 30, color: tr.color, lineHeight: 1 }}>{tr.rank}</div>
              </div>
              <div>
                <div style={{ fontFamily: FONT_D, fontSize: 17, color: C.text }}>{r.name}<span style={{ marginLeft: 6, fontSize: 11, color: TYPES[r.type].color }}>{TYPES[r.type].label}</span></div>
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{r.age}歳・{ML_BACKGROUNDS[r.background]?.label} ／ OVR <b style={{ color: C.yellow, fontFamily: FONT_M }}>{overall(r)}</b></div>
                <div style={{ fontSize: 11.5, marginTop: 2 }}>
                  {powRevealed
                    ? <span style={{ color: pw?.color || C.text, fontWeight: 700 }}>成長力 {r.growthPow}</span>
                    : <span style={{ color: C.sub, fontWeight: 700 }}>成長力 🔒???</span>}
                  <span style={{ color: C.sub }}> ・ 性格 </span><span style={{ color: r.personality === "genius" ? C.yellow : C.text }}>{persLabel}</span>
                </div>
              </div>
            </div>
            {r.debutBoon && (
              <div style={{ background: "rgba(255,122,192,0.10)", border: `1px solid #ff7ac0`, borderRadius: 8, padding: "7px 10px", margin: "6px 0" }}>
                <div style={{ fontSize: 12, color: "#ff7ac0", fontWeight: 700 }}>{r.debutBoon.label}</div>
                <div style={{ fontSize: 11, color: C.text, marginTop: 1 }}>{r.debutBoon.note}</div>
              </div>
            )}
            <div style={{ marginTop: 6 }}><TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} /></div>
            <div style={{ marginTop: 8 }}><AbilityGrid r={r} /></div>
          </div>
          <Btn onClick={mlConfirmCandidate}>この素質でデビュー →</Btn>
          <Btn outline color={C.blue} onClick={mlRerollCandidate}>🎲 素質を引き直す（リセマラ）</Btn>
          <div style={{ fontSize: 10.5, color: C.sub, textAlign: "center", lineHeight: 1.6 }}>
            性格・特殊能力・素質ランクは引き直すたびに変わります。<br />稀に「天啓（金特）」「天賦の才」「才能の片鱗」を持って生まれます。確定するまで保存されません。<br />
            <span style={{ color: "#e8a13c" }}>成長力（伸びやすさ）はデビュー3年目まで本人にも分かりません。</span>
          </div>
        </div>
      );
    }


}
