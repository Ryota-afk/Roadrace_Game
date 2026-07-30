// hub.jsxより分割（Step13第1弾）：選手一覧・練習指定セクション（旧ridersタブ）。
// 中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { loadMlLegends, mlBreedBonus } from "../../../breeding/breeding.js";
import { AbilityGrid, CondFc, DisciplineGrid, FatigueBar, PersonaLine, SubStatLine, TraitLine } from "../../../components/panels.jsx";
import { Btn } from "../../../components/ui.jsx";
import { overall } from "../../../core/core.js";
import { ABILITIES, AB_KEYS, AB_LABEL, COND_ARROW, COND_COLOR, GROWTH, POW, TYPES } from "../../../data/abilities.js";
import { MONTHS } from "../../../data/course.js";
import { CHEMISTRY_TIERS, DIFFICULTIES } from "../../../data/progression.js";
import { C, FONT_D, FONT_M } from "../../../data/theme.js";
import { SLOT_LABEL, STAFF_META, growthPhase, mlGradeColor, potentialHint, riderFlavorText, staffMemberName, teamChemistryTier } from "../../../logic/support.js";
import { PARTS, PART_SLOTS } from "../../../sim/race.js";
import { riderNickname } from "../../../state/state.js";

export function renderRidersSection(ctx) {
  const { askConfirm, availParts, breedYouthSel, expandedRiderId, g, growthCap, openRename, releaseRider, rosterMax, setBreedYouthSel, setCaptain, setExpandedRiderId, setFocus, setG, setPart, signBredYouth, signYouthProspect, toggleFavorite, useCamp, useSupp, useTune } = ctx;
  const chem = teamChemistryTier(g.roster);
  return (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, color: C.sub }}>
            所属 {g.roster.length}/{rosterMax}名。<span style={{ color: C.yellow }}>能力{growthCap}以上＝限界突破</span>（金色表示・成長が大幅に鈍化。難易度「{(DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).label}」の成長上限）。練習指定能力の伸びはトレードオフ（×0.9）で指定外に一部融通されます。
          </div>
          {(() => {
            // v35(シーズン深掘り): ケミストリーの育ちを可視化。次のティアまでの進捗バー＋昇格後の効果
            const next = [...CHEMISTRY_TIERS].sort((a, b) => a.min - b.min).find(t => t.min > chem.min);
            const pct = next ? Math.max(0, Math.min(1, (chem.avgTenure - chem.min) / (next.min - chem.min))) : 1;
            return (
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 11.5, color: C.sub }}>🤝 チームケミストリー </span>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 13.5, color: C.green }}>{chem.label}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.sub }}>平均在籍{chem.avgTenure.toFixed(1)}ヶ月{chem.mul < 1 ? `／ドラフト消耗-${Math.round((1 - chem.mul) * 100)}%` : ""}</div>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: C.line, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ width: `${pct * 100}%`, height: "100%", background: C.green, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 10, color: C.sub, marginTop: 3 }}>
                  {next ? `次の絆「${next.label}」まで平均在籍あと${Math.max(0, next.min - chem.avgTenure).toFixed(1)}ヶ月（メンバーを固定して走り込むほど深まる）` : "最高の絆に到達。長く共に走った証だ。"}
                </div>
              </div>
            );
          })()}
          {/* v35(シーズン深掘り): スタッフ陣を一目で。雇用中の各スタッフを名前付きで並べる */}
          {(() => {
            const hired = Object.entries(g.staff || {}).filter(([, lv]) => lv > 0);
            if (hired.length === 0 && !g.obCoach) return null;
            return (
              <div style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.line}` }}>
                <span style={{ fontSize: 11, color: C.sub }}>🏳 スタッフ陣：</span>
                <span style={{ fontSize: 11.5, color: C.text }}>
                  {hired.length === 0 ? "（一般スタッフ未雇用）" : hired.map(([k, lv]) => `${(STAFF_META[k] || {}).icon || ""}${staffMemberName(g.teamName, k)}${(STAFF_META[k] || {}).title || k}Lv${lv}`).join("・")}
                  {g.obCoach && <span style={{ color: "#e8a13c" }}>{hired.length > 0 ? "・" : ""}🎓{g.obCoach.name}コーチ</span>}
                </span>
              </div>
            );
          })()}
          <div style={{ fontSize: 11, color: C.sub }}>🎖 各選手カードのマークで主将を1名任命できます。主将より2歳以上若い選手は練習効果+10%になります。</div>
          {g.inv.camp > 0 && !g.camp && <Btn small outline color={C.purple} onClick={() => askConfirm("キャンプを実施しますか？今月の練習効果が×2になりますが、選手全員の疲労が+25されます（連発すると故障リスクが高まります）。", useCamp)}>⛺ キャンプ券を使う（今月の練習効果×2・全員疲労+25）</Btn>}
          {g.camp && <div style={{ fontSize: 12, color: C.purple }}>⛺ 今月はトレーニングキャンプ実施中（練習効果×2）</div>}
          {!g.youthUsed && g.roster.length < rosterMax && g.budget >= 15 && (
            <Btn small outline color={C.green} onClick={() => askConfirm("ユース候補を1名確保しますか？契約金15万円。現在の能力は控えめですが、成長力（growthPow A以上）が保証された若手（16〜17歳）です。", signYouthProspect)}>
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
                <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>マイライフ殿堂の名選手2名を親に配合の原石を確保。相性・血の濃さ・累代+値・金特クロスの恩恵が乗ります。</div>
                {sel && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {[["a", "親A"], ["b", "親B"]].map(([key, lbl]) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: C.sub, width: 32 }}>{lbl}</span>
                        <select value={sel[key]} onChange={e => { const v = parseInt(e.target.value); setBreedYouthSel(s => ({ ...s, [key]: v })); }}
                          style={{ flex: 1, background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 6px", fontSize: 12 }}>
                          {legends.map((l, i) => <option key={i} value={i}>{l.name}（{TYPES[l.type]?.label || l.type}{(l.generation || 0) > 0 ? `・${l.generation}代目+${l.plusValue || 0}` : ""}）</option>)}
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
                        {breed.danger > 0 && <div style={{ color: breed.danger >= 38 ? C.red : "#e8a13c", fontSize: 10.5 }}>⚠️ 危険度 {breed.dangerLabel}（約{breed.danger}%）ガラスの体リスク{breed.healthMit > 0 ? "（健康な血で軽減）" : ""}</div>}
                        <div>相性 <span style={{ color: breed.nick.rank === "◎" ? C.yellow : breed.nick.rank === "○" ? C.green : C.sub, fontWeight: 700 }}>{breed.nick.rank} {breed.nick.label}</span></div>
                        <div>累代+値 <span style={{ color: C.yellow }}>+{breed.plusPer}</span>{breed.inbreed.count > 0 && <span style={{ color: C.red }}>・🩸インブリード×{breed.inbreed.count}</span>}{breed.goldInherit && breed.goldInherit.length > 0 && <span style={{ color: C.yellow }}>・✨金特クロス</span>}{breed.exclusive && breed.exclusive.length > 0 && <span style={{ color: "#e56cc8" }}>・🩸{breed.exclusive.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")}</span>}</div>
                        <div style={{ color: C.sub }}>継承特能：{breed.extraAbilities.length ? breed.extraAbilities.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・") : "—"}</div>
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
          {g.month === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>4月は選手の解雇が可能です（各選手カードの「解雇」ボタン）。</div>}
          {g.roster.map(r => {
            const t = TYPES[r.type], ph = growthPhase(r);
            return (
              <div key={r.id} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${r.injury > 0 ? C.red : C.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>{r.name}</span>
                    <button onClick={() => openRename("選手名を変更", r.name, v => setG(s => ({ ...s, roster: s.roster.map(x => x.id === r.id ? { ...x, name: v } : x) })))} title="名前を変更" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, marginLeft: 4, padding: 0, opacity: 0.7 }}>✏️</button>
                    {r.id === g.captainId && <span style={{ marginLeft: 5, fontSize: 10.5, color: "#14171d", background: C.yellow, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>🎖 主将</span>}
                    {r.age <= 18 && <span style={{ marginLeft: 5, fontSize: 10.5, color: "#14171d", background: C.green, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>🌱 ユース</span>}
                    {r.isLegendRecruit && <span style={{ marginLeft: 5, fontSize: 10.5, color: "#14171d", background: "#e56cc8", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }} title={r.legendNickname ? `「${r.legendNickname}」` : ""}>🌳 招聘レジェンド</span>}
                    <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color, border: `1px solid ${t.color}`, borderRadius: 4, padding: "1px 5px" }}>{t.label}</span>
                    <span style={{ marginLeft: 5, fontFamily: FONT_M, fontSize: 12, color: POW[r.growthPow].color }}>成長{r.growthPow}</span>
                    <span style={{ marginLeft: 5, fontSize: 11, color: potentialHint(r).color }}>{potentialHint(r).label}</span>
                    {/* v35(シーズン深掘り): 現在の成長フェーズを明示（育成の手応え） */}
                    <span style={{ marginLeft: 5, fontSize: 10.5, color: ph.tag === "成長期" ? C.green : ph.tag === "全盛期" ? C.yellow : "#e8734a" }}>
                      {ph.tag === "成長期" ? "☘ 成長期" : ph.tag === "全盛期" ? "⛰ 全盛期" : "🍂 衰え期"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => setCaptain(r.id)} title="主将に任命（自分より2歳以上若い選手の練習効果+10%）"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0, color: r.id === g.captainId ? C.yellow : C.sub }}>
                      🎖
                    </button>
                    <button onClick={() => toggleFavorite(r.id)} title="お気に入り登録（殿堂入りが確約されます）"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0, color: r.favorite ? C.yellow : C.sub }}>
                      {r.favorite ? "★" : "☆"}
                    </button>
                    <div style={{ fontFamily: FONT_M, fontSize: 14, color: C.yellow }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></div>
                    {g.month === 0 && <Btn small outline color={C.red} onClick={() => askConfirm(`${r.name}を解雇しますか？`, () => releaseRider(r.id))}>解雇</Btn>}
                  </div>
                </div>
                {riderNickname(r) && <div style={{ fontSize: 12, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{riderNickname(r)}」</div>}
                <PersonaLine p={r.personality} />
                <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.sub, margin: "4px 0", flexWrap: "wrap" }}>
                  <span>{r.age}歳・{GROWTH[r.growth].label}・<span style={{ color: ph.tag === "全盛期" ? C.yellow : ph.tag === "衰え期" ? C.red : C.green }}>{ph.tag}</span></span>
                  <span>調子 <span style={{ color: COND_COLOR[r.cond - 1], fontFamily: FONT_M }}>{COND_ARROW[r.cond - 1]}</span><CondFc dir={r.condForecast} /></span>
                  {r.streak > 0 && <span style={{ color: r.streak >= 2 ? C.red : "#e8a13c" }}>連闘{r.streak}{r.streak >= 2 ? "（次で故障！）" : ""}</span>}
                  {r.injury > 0 && <span style={{ color: C.red }}>🏥 故障 残{r.injury}ヶ月</span>}
                </div>
                <div style={{ fontSize: 10.5, color: C.sub }}>疲労（90超で故障リスク）</div>
                <FatigueBar v={r.fatigue} />
                <AbilityGrid r={r} cap={growthCap} />
                <SubStatLine r={r} />
                <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>種目別適性</div>
                <DisciplineGrid r={r} />
                <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: C.sub }}>練習:</span>
                  <select value={r.focus} onChange={e => setFocus(r.id, e.target.value)}
                    style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 6px", fontSize: 12 }}>
                    {AB_KEYS.map(k => <option key={k} value={k}>{AB_LABEL[k]}強化</option>)}
                    <option value="rest">休養（疲労-15）</option>
                  </select>
                  {g.inv.supp > 0 && r.fatigue > 30 && <Btn small outline color={C.green} onClick={() => useSupp(r.id)}>サプリ(-40)</Btn>}
                  {g.inv.tune > 0 && r.cond < 5 && <Btn small outline color={C.green} onClick={() => useTune(r.id)}>調律(調子+2)</Btn>}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                  {PART_SLOTS.map(slot => (
                    <span key={slot} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: C.purple }}>{SLOT_LABEL[slot]}:</span>
                      <select value={r.parts[slot] || ""} onChange={e => setPart(r.id, slot, e.target.value)}
                        style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 5px", fontSize: 11.5, maxWidth: 140 }}>
                        <option value="">— なし —</option>
                        {Object.entries(PARTS).filter(([pid, p]) => p.slot === slot && (availParts(pid) > 0 || r.parts[slot] === pid))
                          .map(([pid, p]) => <option key={pid} value={pid}>{p.label}</option>)}
                      </select>
                    </span>
                  ))}
                </div>
                {/* v30: フレーバーテキストは特能と能力値の間から、カード末尾の独立欄へ移動 */}
                <div style={{ fontSize: 11, color: C.sub, fontStyle: "italic", marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.line}`, lineHeight: 1.5 }}>{riderFlavorText(r)}</div>
                <Btn small outline color={C.sub} onClick={() => setExpandedRiderId(expandedRiderId === r.id ? null : r.id)}
                  style={{ marginTop: 8 }}>
                  {expandedRiderId === r.id ? "▲ 戦績を閉じる" : `▼ 戦績を見る（${(r.raceLog || []).length}戦）`}
                </Btn>
                {expandedRiderId === r.id && (
                  <div style={{ marginTop: 6, background: C.panel2, borderRadius: 8, padding: "6px 10px", maxHeight: 200, overflowY: "auto" }}>
                    {(!r.raceLog || r.raceLog.length === 0) && <div style={{ fontSize: 11.5, color: C.sub }}>まだ出走記録がありません。</div>}
                    {[...(r.raceLog || [])].reverse().map((e, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "3px 0", borderBottom: i < r.raceLog.length - 1 ? `1px solid ${C.line}` : "none" }}>
                        <span style={{ color: C.sub }}>{e.year}年目 {MONTHS[e.month]}</span>
                        <span style={{ color: C.text, flex: 1, margin: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                        <span style={{ fontFamily: FONT_M, color: e.rank === 1 ? C.yellow : e.rank <= 3 ? C.green : C.sub, fontWeight: 700 }}>{e.rank}位</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
  );
}
