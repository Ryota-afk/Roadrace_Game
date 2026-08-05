// hub/riders.jsxより分割（Step13第7弾）：選手カード一覧（能力・練習指定・パーツ・戦績）。
// 中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { AbilityGrid, CondFc, DisciplineGrid, FatigueBar, PersonaLine, SubStatLine, TraitLine } from "../../../../components/panels.jsx";
import { Btn } from "../../../../components/ui.jsx";
import { overall } from "../../../../core/core.js";
import { AB_KEYS, AB_LABEL, COND_ARROW, COND_COLOR, GROWTH, POW, TYPES } from "../../../../data/abilities.js";
import { MONTHS } from "../../../../data/course.js";
import { DIFFICULTIES } from "../../../../data/progression.js";
import { C, FONT_D, FONT_M } from "../../../../data/theme.js";
import { SLOT_LABEL, growthPhase, potentialHint, riderFlavorText } from "../../../../logic/support.js";
import { PARTS, PART_SLOTS } from "../../../../sim/race.js";
import { riderNickname } from "../../../../state/state.js";

export function renderRidersListSection(ctx) {
  const { askConfirm, availParts, expandedRiderId, g, growthCap, openRename, releaseRider, rosterMax, setCaptain, setExpandedRiderId, setFocus, setG, setPart, toggleFavorite, useSupp, useTune } = ctx;
  return (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, color: C.sub }}>
            所属 {g.roster.length}/{rosterMax}名。<span style={{ color: C.yellow }}>能力{growthCap}以上＝限界突破</span>（金色表示・成長が大幅に鈍化。難易度「{(DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).label}」の成長上限）。練習指定能力の伸びはトレードオフ（×0.9）で指定外に一部融通されます。
          </div>
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
