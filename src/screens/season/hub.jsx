// season.jsx より分割（Step8）：メイン画面（home/riders/shop/career/help の5タブ）
import React from "react";
import { loadMlLegends, mlBreedBonus } from "../../breeding/breeding.js";
import { AbilityFileList, AbilityGrid, BlurGrid, CondFc, CourseRecordsPanel, DisciplineGrid, FatigueBar, PersonaLine, SubStatLine, TitlesPanel, TraitLine } from "../../components/panels.jsx";
import { Btn, Eyebrow } from "../../components/ui.jsx";
import { overall } from "../../core/core.js";
import { ABILITIES, AB_KEYS, AB_LABEL, COND_ARROW, COND_COLOR, GROWTH, POW, TYPES } from "../../data/abilities.js";
import { CHASE_MODES, HOME_ABILITY_BONUS, MONTHS, ROLES, SEG_COLOR } from "../../data/course.js";
import { EQUIPS, EQUIP_COST, ITEMS } from "../../data/items.js";
import { CLASSES, DIFFICULTIES } from "../../data/progression.js";
import { C, FONT_B, FONT_D, FONT_M } from "../../data/theme.js";
import { CHEMISTRY_TIERS, GRADE_MUL, OB_COACH_SALARY, PRIZES, PTS, SCOUT_POLICIES, SEASON_ACHIEVEMENTS, SLOT_LABEL, STAFF_ROLES, STAFF_SALARY_PER_LV, TYPE_COACH_ABILITY, WEATHER, buildSim, clearSaveGame, computeSeasonAchievements, formatAchievementReward, growthPhase, loadAbilityFile, mlGradeColor, objectiveStatusText, potentialHint, raceIsHome, riderFlavorText, rivalNews, seasonTitleRace, STAFF_META, staffEffectText, staffMemberName, staffSalaryTotal, teamChemistryTier } from "../../logic/support.js";
import { PARTS, PART_SLOTS } from "../../sim/race.js";
import { initGame, riderCareerSummary, riderNickname, saveGame } from "../../state/state.js";

export function renderSeasonHubScreen(ctx) {
  const { acceptTrade, advanceMonth, askConfirm, availParts, breedYouthSel, buyEquip, buyItem, buyPart, cls, declineTrade, dismissObCoach, equipMax, expandedRiderId, g, growthCap, healthy, hireObCoach, hireStaff, openRename, releaseRider, rosterMax, setBreedYouthSel, setCaptain, setExpandedRiderId, setFocus, setG, setPart, setSuperMode, signBredYouth, signFa, signScout, signYouthProspect, staffMax, toggleFavorite, useCamp, useSupp, useTune, wrap } = ctx;
  if (g.screen === "main") {
    let body = null;
    if (g.tab === "home") {
      const isMandateMonth = g.sponsor && g.sponsor.mandateMonths.includes(g.month);
      body = (
        <div style={{ display: "grid", gap: 10 }}>
          {g.budget < 0 && <div style={{ background: "#2e2124", border: `1px solid ${C.red}`, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: C.red }}>💸 借金状態です。賞金とスポンサー収入で返済しましょう（返済まで買い物不可）。</div>}
          {isMandateMonth && (
            <div style={{ background: "#2e2124", border: `1px solid ${C.red}`, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: C.red }}>
              🎯 今月はスポンサー指定月間です。下の🎯マーク付きレースに出場するとポイント+30%、見送ると違約金-15万が年度末に加算されます。
            </div>
          )}
          {/* v40（第1候補②）：シーズン中期目標。複数レースにまたがるスポンサーの約束と進捗を常時表示 */}
          {(() => {
            const om = objectiveStatusText(g.sponsor && g.sponsor.objective);
            if (!om) return null;
            const obj = g.sponsor.objective;
            const col = om.status === "done" ? C.green : om.status === "failed" ? C.red : C.purple;
            const remain = om.status === "active" ? Math.max(0, om.deadline - g.month) : null;
            return (
              <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), transparent)", borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, borderLeft: `3px solid ${col}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Eyebrow color={col}>🎯 中期目標 — {om.icon} {om.label}</Eyebrow>
                  <span style={{ fontFamily: FONT_M, fontSize: 12, color: col, fontWeight: 700 }}>
                    {om.status === "done" ? "達成✓" : om.status === "failed" ? "未達" : `${obj.progress} / ${obj.need}`}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.text, marginTop: 3, lineHeight: 1.5 }}>{om.desc}</div>
                {om.status === "active" && (
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>
                    期限：{MONTHS[om.deadline]}まで（残り{remain}ヶ月）／達成報酬 <span style={{ color: C.green }}>+{obj.budget}万・ノルマ+{obj.points}pt</span> ／未達 <span style={{ color: C.red }}>-{obj.penalty}万</span>
                  </div>
                )}
              </div>
            );
          })()}
          {g.month === 11 && (
            <div style={{ background: "#2b2436", border: `1px solid ${C.purple}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 13, color: C.purple, fontWeight: 700 }}>3月 — チャンピオンシップ月間／来季スカウト方針の決定</div>
              <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                {Object.entries(SCOUT_POLICIES).map(([k, p]) => (
                  <button key={k} onClick={() => setG(s => ({ ...s, scoutPolicy: k }))} title={p.desc}
                    style={{
                      padding: "5px 9px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT_D,
                      background: g.scoutPolicy === k ? C.purple : C.panel, color: g.scoutPolicy === k ? "#14171d" : C.sub,
                      border: `1px solid ${g.scoutPolicy === k ? C.purple : C.line}`,
                    }}>{p.label}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>方針：{SCOUT_POLICIES[g.scoutPolicy].desc}（4月の候補5名に反映）</div>
            </div>
          )}
          {g.month === 0 && <div style={{ background: "#1f2b26", border: `1px solid ${C.green}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, color: C.green }}>4月 — 新人スカウト月間（方針：{SCOUT_POLICIES[g.scoutPolicy].label}）</div>}
          {/* v35(シーズン深掘り): タイトル争い。順位表を物語化し、シーズンを通した優勝争いの緊張感を出す */}
          {(() => {
            const tr = seasonTitleRace(g);
            if (!tr) return null;
            const col = tr.isLeader ? C.yellow : tr.rank <= 3 ? C.green : C.blue;
            return (
              <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), transparent)", borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, borderLeft: `3px solid ${col}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Eyebrow color={col}>🏆 タイトル争い</Eyebrow>
                  <span style={{ fontFamily: FONT_M, fontSize: 12, color: col, fontWeight: 700 }}>{tr.rank}位 / {tr.total}</span>
                </div>
                <div style={{ fontSize: 12, color: C.text, marginTop: 3, lineHeight: 1.5 }}>{tr.line}</div>
                {(tr.ahead || tr.behind) && (
                  <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {tr.ahead && <span>🎯 追う相手：{tr.ahead.name}{tr.ahead.trait ? `（${tr.ahead.trait}）` : ""}</span>}
                    {tr.behind && <span>👀 背後：{tr.behind.name}{tr.behind.trait ? `（${tr.behind.trait}）` : ""}</span>}
                  </div>
                )}
              </div>
            );
          })()}
          {(() => { const news = rivalNews(g.year, g.month); return (
            <div style={{ background: C.panel2, borderRadius: 10, padding: "8px 12px", borderLeft: `3px solid ${news.color}` }}>
              <Eyebrow color={C.sub}>📰 他チーム動向</Eyebrow>
              <div style={{ fontSize: 12, color: C.text, marginTop: 3 }}>{news.text}</div>
            </div>
          ); })()}
          {/* v34(UI): 今月のチーム状態をレース選びの直上に出し、タブ切替なしで「出場か休養か」を判断できるように */}
          {(() => {
            const inj = g.roster.filter(r => r.injury > 0);
            const avgFat = Math.round(g.roster.reduce((s, r) => s + (r.fatigue || 0), 0) / Math.max(1, g.roster.length));
            const tired = g.roster.filter(r => r.injury === 0 && (r.fatigue || 0) >= 80).length;
            const fatColor = avgFat >= 70 ? C.red : avgFat >= 45 ? "#e8a13c" : C.green;
            return (
              <div style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.line}`, display: "flex", flexWrap: "wrap", gap: "2px 14px", alignItems: "center", fontSize: 12 }}>
                <span style={{ color: C.sub }}>🚴 今月のチーム状態</span>
                <span style={{ color: C.text }}>出走可能 <b style={{ color: healthy.length > 0 ? C.green : C.red, fontFamily: FONT_M }}>{healthy.length}</b>/{g.roster.length}名</span>
                <span style={{ color: C.text }}>平均疲労 <b style={{ color: fatColor, fontFamily: FONT_M }}>{avgFat}</b></span>
                {tired > 0 && <span style={{ color: "#e8a13c" }}>疲労高 {tired}名</span>}
                {inj.length > 0 && <span style={{ color: C.red }}>🩹 故障 {inj.map(r => `${r.name}(${r.injury}ヶ月)`).join("・")}</span>}
                {g.camp && <span style={{ color: C.purple }}>⛺ キャンプ実施中</span>}
              </div>
            );
          })()}
          <Eyebrow>今月のレースカレンダー（出場は月1回）</Eyebrow>
          {g.homeRegion && <div style={{ fontSize: 11, color: C.sub }}>🏠 本拠地：<span style={{ color: C.green }}>{g.homeRegion}</span>（地元開催のレースは出走選手が地元の声援を受けて能力+{HOME_ABILITY_BONUS}）</div>}
          {g.races.map(r => {
            const mul = CLASSES[r.cls].prizeMul * GRADE_MUL[r.grade];
            const enough = healthy.length >= r.tmpl.squadMin;
            const squadLabel = r.tmpl.squadMin === r.tmpl.squadMax ? `${r.tmpl.squadMin}名` : `${r.tmpl.squadMin}〜${r.tmpl.squadMax}名`;
            return (
              <div key={r.id} style={{
                background: (r.championship || r.grandTour) ? "#2b2436" : C.panel, borderRadius: 10, padding: "10px 12px",
                border: `1.5px solid ${r.sponsorMandate ? C.red : (r.championship || r.grandTour) ? C.purple : C.line}`, opacity: r.locked ? 0.55 : 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>
                    {r.championship ? "👑 " : ""}{r.grandTour ? "🌍 " : ""}{r.sponsorMandate ? "🎯 " : ""}{raceIsHome(r, g.homeRegion) ? "🏠 " : ""}{r.name}
                  </div>
                  <div style={{ fontFamily: FONT_M, fontSize: 12, color: C.yellow }}>{r.weather && r.weather !== "clear" ? `${WEATHER[r.weather].icon} ` : ""}{"★".repeat(r.grade)}</div>
                </div>
                <div style={{ display: "flex", gap: 3, margin: "6px 0 4px" }}>
                  {r.tmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 6, borderRadius: 3, background: SEG_COLOR[s[0]] }} />)}
                </div>
                <div style={{ fontSize: 11.5, color: C.sub }}>
                  {r.tmpl.kind}・出走{squadLabel}・{TYPES[r.tmpl.favors].label}有利／優勝 約{Math.round(PRIZES[0] * mul)}万・{Math.round(PTS[0] * GRADE_MUL[r.grade])}pt
                  {raceIsHome(r, g.homeRegion) && <span style={{ color: C.green }}>／🏠 地元開催（出走選手 全能力+{HOME_ABILITY_BONUS}）</span>}
                  {r.sponsorMandate && <span style={{ color: C.red }}>／スポンサー指定レース</span>}
                  {r.stageRace && <span style={{ color: C.purple }}>／{r.stageCount || 2}日間ステージレース(総合)</span>}
                </div>
                <div style={{ marginTop: 8 }}>
                  {r.locked
                    ? <span style={{ fontSize: 12, color: C.red }}>🔒 {r.lockReason}</span>
                    : <Btn small disabled={!enough} onClick={() => setG(s => {
                        const defN = Math.max(r.tmpl.squadMin, Math.min(r.tmpl.squadMax, healthy.length));
                        // v29: 出走表用に相手チームの布陣を先に生成してキャッシュ。実際のレースでも
                        // このfixedAiTeamsを再利用するので、出走表と本番の顔ぶれが一致する
                        const { aiTeams } = buildSim(r, healthy, null, {}, s.equip, {}, s.classIdx, undefined, r.stageRace ? "day1" : undefined, { chaseMode: "normal", aceEarly: false }, s.difficulty, s.rivalAlumni, s.dynastyLevel, s.teamName, s.rivalRosters, s.year);
                        return { ...s, sel: { ...s.sel, raceId: r.id, starters: [], ace: null, roles: {}, squadN: defN }, pendingAiTeams: aiTeams, screen: "lineup" };
                      })}>
                        {enough ? "このレースに出場" : `出走可能${healthy.length}名（最低${r.tmpl.squadMin}名必要）`}
                      </Btn>}
                </div>
              </div>
            );
          })}
          <Btn outline color={C.sub} onClick={() => advanceMonth(null)}>翌月へ進む（今月は休養：全員の疲労-50）</Btn>
          {/* v28: 縦積みだった閲覧・管理系ボタンを折り返しの小ボタン群にまとめて縦の長さを圧縮 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Btn small outline color={C.blue} onClick={() => setG(s => ({ ...s, screen: "program" }))}>📅 年間プログラム</Btn>
            <Btn small outline color={C.purple} onClick={() => setG(s => ({ ...s, screen: "standings" }))}>📊 順位表</Btn>
            <Btn small outline color={"#e8a13c"} onClick={() => setG(s => ({ ...s, screen: "trophy" }))}>🏆 トロフィールーム</Btn>
            <Btn small outline color={C.green} onClick={() => {
              const ok = saveGame(g);
              setG(s => ({ ...s, log: [...s.log, ok ? `【${MONTHS[s.month]}】セーブしました` : "セーブに失敗しました（ブラウザの保存領域を確認してください）"] }));
            }}>💾 セーブ</Btn>
            <Btn small outline color={C.sub} onClick={() => {
              askConfirm("タイトルに戻ります。セーブ済みのデータは消えません。よろしいですか？", () => {
                setG(s => ({ ...s, screen: "intro" }));
                setSuperMode(null);
              });
            }}>🏠 タイトルに戻る</Btn>
          </div>
          {g.log.length > 0 && (
            <div style={{ background: C.panel2, borderRadius: 10, padding: "8px 12px" }}>
              <Eyebrow color={C.sub}>TEAM LOG</Eyebrow>
              {g.log.slice(-4).map((l, i) => <div key={i} style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>{l}</div>)}
            </div>
          )}
        </div>
      );
    }
    if (g.tab === "riders") {
      const chem = teamChemistryTier(g.roster);
      body = (
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
    if (g.tab === "shop") {
      body = (
        <div style={{ display: "grid", gap: 14 }}>
          <section>
            <Eyebrow color={C.yellow}>🏳 チーム名</Eyebrow>
            <input type="text" value={g.teamName || ""} maxLength={16} placeholder="あなたのチーム"
              onChange={e => { const v = e.target.value; setG(s => ({ ...s, teamName: v })); }}
              onBlur={e => { if (!e.target.value.trim()) setG(s => ({ ...s, teamName: "あなたのチーム" })); }}
              style={{ width: "100%", boxSizing: "border-box", marginTop: 6, background: C.panel2, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", fontSize: 14, fontFamily: FONT_B }} />
            <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>いつでも変更できます（16文字まで）。</div>
          </section>
          {g.month === 0 && (
            <section>
              <Eyebrow color={C.green}>APRIL DRAFT — 新人スカウト（方針：{SCOUT_POLICIES[g.scoutPolicy].label}）</Eyebrow>
              <div style={{ fontSize: 11.5, color: C.sub, margin: "4px 0 8px" }}>能力は推定レンジ表示。契約するまで真の値は分かりません。</div>
              <div style={{ display: "grid", gap: 8 }}>
                {g.scouts.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>今年の候補は全員契約済み、または見送りました。</div>}
                {g.scouts.map(sc => {
                  const r = sc.rider, t = TYPES[r.type];
                  return (
                    <div key={r.id} style={{ background: r.prodigy ? "#2b2410" : C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${r.prodigy ? C.yellow : C.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                        <div>
                          {r.prodigy && <span style={{ marginRight: 6, fontSize: 10.5, color: C.yellow, fontWeight: 700 }}>🌟逸材</span>}
                          <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 15 }}>{r.name}</span>
                          <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                        </div>
                        <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 13 }}>{sc.ovrMin}〜{sc.ovrMax}<span style={{ fontSize: 9, color: C.sub }}> OVR?</span></span>
                      </div>
                      <div style={{ fontSize: 11.5, color: C.sub, margin: "3px 0" }}>{sc.tag}・{r.age}歳・{GROWTH[r.growth].label}型・成長<span style={{ color: POW[r.growthPow].color }}>{r.growthPow}</span>・<span style={{ color: potentialHint(r).color }}>{potentialHint(r).label}</span></div>
                      <PersonaLine p={r.personality} />
                      <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                      <BlurGrid blur={sc.blur} />
                      <SubStatLine r={r} />
                      <div style={{ marginTop: 8 }}>
                        <Btn small color={C.green} disabled={g.budget < sc.price || g.roster.length >= rosterMax} onClick={() => signScout(sc)}>
                          {g.roster.length >= rosterMax ? "ロースター満員" : `${sc.price}万円で契約`}
                        </Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          <section>
            <Eyebrow color={C.green}>FA移籍市場（能力は公開済み・即決購入）</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, margin: "4px 0 8px" }}>新人スカウトと違い、既に実績のある選手を能力そのままで獲得できます。毎月全入れ替え。</div>
            <div style={{ display: "grid", gap: 8 }}>
              {g.faMarket.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>今月の候補は全員契約済みです。</div>}
              {g.faMarket.map(fa => {
                const r = fa.rider, t = TYPES[r.type];
                const full = g.roster.length >= rosterMax;
                return (
                  <div key={r.id} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <div>
                        <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 15 }}>{r.name}</span>
                        <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                      </div>
                      <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 13 }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></span>
                    </div>
                    <div style={{ fontSize: 11.5, color: C.sub, margin: "3px 0" }}>{fa.age}歳・{GROWTH[r.growth].label}型・成長<span style={{ color: POW[r.growthPow].color }}>{r.growthPow}</span></div>
                    <PersonaLine p={r.personality} />
                    <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                    <AbilityGrid r={r} cap={growthCap} />
                    <div style={{ marginTop: 8 }}>
                      <Btn small color={C.green} disabled={g.budget < fa.price || full} onClick={() => signFa(fa)}>
                        {full ? "ロースター満員（4月に解雇で空き作成）" : `${fa.price}万円で獲得`}
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={"#e8a13c"}>🎯 引き抜き市場（他チームの主力を獲得）</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, margin: "4px 0 8px" }}>
              ライバルの看板選手を移籍金で引き抜けます（年1回まで）。相手を弱体化させつつ自チームを強化する攻めの一手。
              {g.poachDoneThisYear && <span style={{ color: C.red }}> ／今季は使用済み</span>}
            </div>
            <Btn small color={"#e8a13c"} outline onClick={() => setG(s => ({ ...s, screen: "poachMarket" }))}>
              引き抜き市場を開く（候補{(g.poachTargets || []).length}名）→
            </Btn>
          </section>
          <section>
            <Eyebrow color={"#e8a13c"}>選手間トレード（毎月入れ替え）</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, margin: "4px 0 8px" }}>ライバルチームが自チームの選手に興味を示し、代わりの選手を提示してきています。受け入れると1対1で入れ替わります。</div>
            <div style={{ display: "grid", gap: 8 }}>
              {(g.tradeOffers || []).length === 0 && <div style={{ fontSize: 13, color: C.sub }}>今月のトレードオファーはありません。</div>}
              {(g.tradeOffers || []).map(offer => {
                const wantRider = g.roster.find(r => r.id === offer.wantRiderId);
                if (!wantRider) return null;
                const r = offer.offeredRider, t = TYPES[r.type];
                return (
                  <div key={offer.id} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${"#e8a13c"}` }}>
                    <div style={{ fontSize: 12, color: C.sub }}>{offer.team}が<span style={{ color: C.text, fontWeight: 700 }}>{wantRider.name}</span>（{TYPES[wantRider.type].label}・{overall(wantRider)} OVR）を欲しがっています</div>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", marginTop: 6 }}>
                      <div>
                        <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 15 }}>{r.name}</span>
                        <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                        <span style={{ marginLeft: 6, fontSize: 11, color: C.sub }}>{r.age}歳</span>
                      </div>
                      <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 13 }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></span>
                    </div>
                    <PersonaLine p={r.personality} />
                    <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                    <AbilityGrid r={r} cap={growthCap} />
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <Btn small color={"#e8a13c"} disabled={g.roster.length <= 1} onClick={() => askConfirm(`${wantRider.name}を放出し、${r.name}を獲得するトレードを成立させますか？`, () => acceptTrade(offer.id))}>このトレードを受け入れる</Btn>
                      <Btn small outline color={C.sub} onClick={() => declineTrade(offer.id)}>見送る</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={C.purple}>マシンパーツ（クラス昇格で上位解禁）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(PARTS).map(([pid, p]) => {
                const lockedByClass = p.tier > g.classIdx + 1;
                return (
                  <div key={pid} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, opacity: lockedByClass ? 0.5 : 1 }}>
                    <div>
                      <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                        {p.tier > 1 && <span style={{ color: p.tier === 3 ? C.yellow : C.green, fontSize: 10.5 }}>[{CLASSES[p.tier - 1].id}] </span>}
                        {p.label} <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.purple }}>所持{g.partsInv[pid] || 0}（空き{Math.max(0, availParts(pid))}）</span>
                      </div>
                      <div style={{ color: C.sub, fontSize: 11 }}>[{SLOT_LABEL[p.slot]}] {Object.entries(p.ab).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join(" / ")}</div>
                    </div>
                    {lockedByClass
                      ? <span style={{ fontSize: 11, color: C.red, whiteSpace: "nowrap" }}>🔒 {CLASSES[p.tier - 1].id}で解禁</span>
                      : <Btn small color={C.purple} disabled={g.budget < p.price} onClick={() => buyPart(pid)}>{p.price}万</Btn>}
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={C.purple}>消耗品（在庫制）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(ITEMS).map(([k, it]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{it.label} <span style={{ fontFamily: FONT_M, color: C.purple }}>×{g.inv[k]}</span></div>
                    <div style={{ color: C.sub, fontSize: 11.5 }}>{it.desc}</div>
                  </div>
                  <Btn small color={C.purple} disabled={g.budget < it.price} onClick={() => buyItem(k)}>{it.price}万</Btn>
                </div>
              ))}
              {g.inv.camp > 0 && !g.camp && <Btn small outline color={C.purple} onClick={() => askConfirm("キャンプを実施しますか？今月の練習効果が×2になりますが、選手全員の疲労が+25されます（連発すると故障リスクが高まります）。", useCamp)}>キャンプ券を使う（今月の練習×2・全員疲労+25）</Btn>}
              {g.camp && <div style={{ fontSize: 12, color: C.purple }}>⛺ 今月はトレーニングキャンプ実施中（練習効果×2）</div>}
            </div>
          </section>
          {/* v28: チーム施設のアップグレード段階可視化。機材・スタッフの現在レベルと累積効果を
              バーで一覧できるようにし、投資の進み具合と効果を直感的に把握できるようにする */}
          <section>
            <Eyebrow color={"#e8a13c"}>🏭 施設・投資の状況</Eyebrow>
            <div style={{ display: "grid", gap: 7, marginTop: 6 }}>
              {[
                { label: "エアロフレーム", lv: g.equip.frame, max: 5, effect: `平坦 +${g.equip.frame * 6}%`, color: C.blue },
                { label: "軽量ホイール", lv: g.equip.wheels, max: 5, effect: `登坂 +${g.equip.wheels * 6}%`, color: C.red },
                { label: "トレーニング設備", lv: g.equip.facility, max: 5, effect: `練習効果 +${g.equip.facility * 15}%`, color: C.green },
                { label: "監督", lv: g.staff.manager, max: 3, effect: g.staff.manager > 0 ? `月収+${g.staff.manager * 12}%・ノルマ-${g.staff.manager * 8}%・報酬+${g.staff.manager * 10}%` : "未雇用", color: C.yellow },
                { label: "トレーナー", lv: g.staff.trainer, max: 3, effect: g.staff.trainer > 0 ? `練習成長 +${g.staff.trainer * 12}%` : "未雇用", color: C.green },
                { label: "ドクター", lv: g.staff.doctor, max: 3, effect: g.staff.doctor > 0 ? `故障率 -${g.staff.doctor * 22}%・離脱-${Math.round(g.staff.doctor * 0.8)}ヶ月` : "未雇用", color: "#6fa8dc" },
                { label: "スカウト", lv: g.staff.scout || 0, max: 3, effect: (g.staff.scout || 0) > 0 ? `査定ブレ -${(g.staff.scout || 0) * 28}%・逸材率+${(g.staff.scout || 0) * 60}%` : "未雇用", color: C.purple },
              ].map((row, i) => (
                <div key={i} style={{ background: C.panel, borderRadius: 8, padding: "7px 10px", border: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>{row.label} <span style={{ fontFamily: FONT_M, color: C.sub, fontSize: 10.5 }}>Lv{row.lv}/{row.max}</span></span>
                    <span style={{ fontSize: 10.5, color: row.lv > 0 ? row.color : C.sub }}>{row.effect}</span>
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    {Array.from({ length: row.max }).map((_, j) => (
                      <div key={j} style={{ flex: 1, height: 6, borderRadius: 3, background: j < row.lv ? row.color : C.panel2 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {g.obCoach && <div style={{ fontSize: 11, color: "#e8a13c", marginTop: 6 }}>🎓 OBコーチ {g.obCoach.name}：{AB_LABEL[g.obCoach.ab]}の練習効果+25%</div>}
          </section>
          <section>
            <Eyebrow color={C.red}>チーム機材（Lv上限：{cls.id}＝{equipMax}）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(EQUIPS).map(([k, eq]) => {
                const lv = g.equip[k], cost = lv >= equipMax ? null : EQUIP_COST[lv];
                return (
                  <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{eq.label} <span style={{ fontFamily: FONT_M, color: C.yellow }}>Lv{lv}/{equipMax}</span></div>
                      <div style={{ color: C.sub, fontSize: 11.5 }}>{eq.desc}</div>
                    </div>
                    <Btn small color={C.red} disabled={lv >= equipMax || g.budget < cost} onClick={() => buyEquip(k)}>
                      {lv >= equipMax ? (g.classIdx < 2 ? "昇格で解禁" : "MAX") : `${cost}万`}
                    </Btn>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={C.red}>スタッフ（月給制・Lv上限：{cls.id}＝{staffMax}）</Eyebrow>
            {staffMax === 0 ? (
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>A昇格で雇用が解禁されます。</div>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                {Object.entries(STAFF_ROLES).map(([k, st]) => {
                  const lv = g.staff[k] || 0;
                  const meta = STAFF_META[k] || { icon: "🧑‍💼", title: st.label };
                  const hired = lv > 0;
                  const name = staffMemberName(g.teamName, k);
                  return (
                    <div key={k} style={{ background: hired ? "rgba(217,72,74,0.06)" : C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${hired ? "rgba(217,72,74,0.4)" : C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div>
                        <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>
                          {meta.icon} {hired ? `${name}${meta.title}` : st.label} <span style={{ fontFamily: FONT_M, color: C.yellow }}>Lv{lv}/{staffMax}</span>
                        </div>
                        <div style={{ color: hired ? C.red : C.sub, fontSize: 11.5 }}>{hired ? `現在の効果：${staffEffectText(k, lv)}` : st.desc}</div>
                      </div>
                      <Btn small color={C.red} disabled={lv >= staffMax} onClick={() => hireStaff(k)}>
                        {lv >= staffMax ? (g.classIdx < 2 ? "昇格で解禁" : "MAX") : hired ? `昇格 +${STAFF_SALARY_PER_LV}万` : `雇用 月給+${STAFF_SALARY_PER_LV}万`}
                      </Btn>
                    </div>
                  );
                })}
                <div style={{ fontSize: 10.5, color: C.sub }}>スタッフ月給合計 -{staffSalaryTotal(g.staff)}万/月</div>
              </div>
            )}
          </section>
          <section>
            <Eyebrow color={"#e8a13c"}>OBコーチ（引退選手の登用・月給{OB_COACH_SALARY}万）</Eyebrow>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>殿堂入りしたOBを専属コーチに迎えると、その選手の脚質に対応する能力の練習効果が全選手+25%になります（1名まで）。</div>
            {g.obCoach && (
              <div style={{ background: "rgba(232,161,60,0.1)", borderRadius: 10, padding: "10px 12px", border: `1.5px solid #e8a13c`, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>🎓 {g.obCoach.name}コーチ <span style={{ fontSize: 10.5, color: TYPES[g.obCoach.type].color }}>{TYPES[g.obCoach.type].label}</span></div>
                  <div style={{ color: "#e8a13c", fontSize: 11.5 }}>{AB_LABEL[g.obCoach.ab]}の練習効果+25%（全選手）</div>
                </div>
                <Btn small outline color={C.sub} onClick={dismissObCoach}>契約解消</Btn>
              </div>
            )}
            {!g.obCoach && (
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {g.hallOfFame.length === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>まだ殿堂入りOBがいません（引退・退団した実績ある選手が対象です）。</div>}
                {[...g.hallOfFame].reverse().slice(0, 6).map((h, i) => (
                  <div key={`ob-${h.id}-${i}`} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13 }}>{h.name}</span>
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: TYPES[h.type].color }}>{TYPES[h.type].label}</span>
                      <div style={{ fontSize: 10.5, color: C.sub }}>{AB_LABEL[TYPE_COACH_ABILITY[h.type] || "flat"]}の練習効果+25%</div>
                    </div>
                    <Btn small color={"#e8a13c"} onClick={() => hireObCoach(h)}>コーチに迎える</Btn>
                  </div>
                ))}
              </div>
            )}
          </section>
          <Btn outline color={C.sub} onClick={() => askConfirm("最初からやり直しますか？セーブデータも消えます。", () => { clearSaveGame(); setG(initGame()); })}>ゲームをリセット</Btn>
        </div>
      );
    }
    if (g.tab === "career") {
      const cs = g.careerStats;
      const history = [...g.careerHistory].reverse();
      const hof = [...g.hallOfFame].reverse();
      body = (
        <div style={{ display: "grid", gap: 12 }}>
          <Eyebrow color={C.yellow}>キャリア通算成績</Eyebrow>
          <div style={{ background: C.panel, borderRadius: 12, padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><div style={{ fontSize: 11, color: C.sub }}>通算出走レース</div><div style={{ fontFamily: FONT_M, fontSize: 20, color: C.text }}>{cs.totalRaces}</div></div>
            <div><div style={{ fontSize: 11, color: C.sub }}>通算優勝</div><div style={{ fontFamily: FONT_M, fontSize: 20, color: C.yellow }}>{cs.totalWins}</div></div>
            <div><div style={{ fontSize: 11, color: C.sub }}>通算表彰台（3位以内）</div><div style={{ fontFamily: FONT_M, fontSize: 20, color: C.green }}>{cs.totalPodiums}</div></div>
            <div><div style={{ fontSize: 11, color: C.sub }}>自己ベスト着順</div><div style={{ fontFamily: FONT_M, fontSize: 20, color: C.text }}>{cs.bestFinish ? `${cs.bestFinish}位` : "—"}</div></div>
            <div style={{ gridColumn: "1 / -1" }}><div style={{ fontSize: 11, color: C.sub }}>通算獲得賞金</div><div style={{ fontFamily: FONT_M, fontSize: 20, color: C.text }}>{cs.totalPrize}万円</div></div>
          </div>
          <Eyebrow color={C.yellow}>🏆 実績（{computeSeasonAchievements(g).filter(a => a.achieved).length} / {SEASON_ACHIEVEMENTS.length}達成）</Eyebrow>
          <div style={{ display: "grid", gap: 8 }}>
            {computeSeasonAchievements(g).map(a => (
              <div key={a.id} style={{
                background: a.achieved ? "rgba(255,210,63,0.1)" : C.panel, borderRadius: 10, padding: "10px 12px",
                border: `1.5px solid ${a.achieved ? C.yellow : C.line}`, opacity: a.achieved ? 1 : 0.55,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 22 }}>{a.achieved ? a.icon : "🔒"}</span>
                <div>
                  <div style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 13.5, color: a.achieved ? C.yellow : C.text }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>{a.desc}</div>
                  {formatAchievementReward(a) && <div style={{ fontSize: 10.5, color: C.green, marginTop: 1 }}>{formatAchievementReward(a)}</div>}
                </div>
              </div>
            ))}
          </div>
          <Eyebrow color={C.sub}>年度別記録</Eyebrow>
          {history.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>まだ年度を終えていません。3月のチャンピオンシップを終えると記録が積み重なります。</div>}
          <div style={{ background: C.panel, borderRadius: 12, padding: "8px 12px", display: "grid", gap: 6 }}>
            {history.map((h, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 4px", borderBottom: i < history.length - 1 ? `1px solid ${C.line}` : "none", fontSize: 12.5 }}>
                <span style={{ color: C.text }}>{h.year}年目・{h.classLabel}</span>
                <span style={{ color: C.sub, fontFamily: FONT_M }}>{h.points}pt{h.champBest ? `／CS ${h.champBest}位` : ""}</span>
                <span style={{ color: h.promoted ? C.green : h.relegated ? C.red : C.sub, fontWeight: 700 }}>
                  {h.promoted ? "🎉 昇格" : h.relegated ? "😞 降格" : "残留"}
                </span>
              </div>
            ))}
          </div>
          <Eyebrow color={C.purple}>🏛 殿堂入り選手名鑑</Eyebrow>
          {hof.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>引退・退団した選手はまだいません。</div>}
          <div style={{ display: "grid", gap: 8 }}>
            {hof.map((r, i) => {
              const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
              const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
              const rid = `hof-${r.id}-${i}`;
              return (
                <div key={rid} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.purple}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div>
                      <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 14.5 }}>{r.name}</span>
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: TYPES[r.type].color }}>{TYPES[r.type].label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: C.sub }}>
                      {r.farewellReason === "retired" && `${r.farewellYear}年目 引退`}
                      {r.farewellReason === "released" && `${r.farewellYear}年目 退団`}
                      {r.farewellReason === "rival_retired" && `${r.farewellYear}年目 引退（${r.signedTeam}）`}
                    </span>
                  </div>
                  {r.signedTeam && <div style={{ fontSize: 11, color: C.red, marginTop: 1 }}>🔀 解雇後、{r.signedTeam}に拾われて現役を続けた</div>}
                  {r.favorite && <div style={{ fontSize: 10.5, color: C.yellow, marginTop: 1 }}>★ お気に入り登録選手</div>}
                  {riderNickname(r) && <div style={{ fontSize: 12, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{riderNickname(r)}」</div>}
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{riderFlavorText(r)}</div>
                  <div style={{ fontSize: 11.5, color: C.text, marginTop: 5, padding: "6px 8px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.purple}`, lineHeight: 1.6 }}>
                    {riderCareerSummary(r)}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>通算{(r.raceLog || []).length}戦・{wins}勝・表彰台{podiums}回</div>
                  <Btn small outline color={C.sub} style={{ marginTop: 6 }} onClick={() => setExpandedRiderId(expandedRiderId === rid ? null : rid)}>
                    {expandedRiderId === rid ? "▲ 戦績を閉じる" : "▼ 戦績を見る"}
                  </Btn>
                  {expandedRiderId === rid && (
                    <div style={{ marginTop: 6, background: C.panel2, borderRadius: 8, padding: "6px 10px", maxHeight: 200, overflowY: "auto" }}>
                      {(!r.raceLog || r.raceLog.length === 0) && <div style={{ fontSize: 11.5, color: C.sub }}>出走記録がありません。</div>}
                      {[...(r.raceLog || [])].reverse().map((e, j) => (
                        <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "3px 0", borderBottom: j < r.raceLog.length - 1 ? `1px solid ${C.line}` : "none" }}>
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
          <Eyebrow color={"#e8a13c"}>👑 通算タイトル</Eyebrow>
          <TitlesPanel />
          <Eyebrow color={"#e8a13c"}>🏅 コースレコード</Eyebrow>
          <CourseRecordsPanel />
          <Eyebrow color={C.purple}>🗂 特殊能力図鑑</Eyebrow>
          <AbilityFileList file={loadAbilityFile()} />
        </div>
      );
    }
    if (g.tab === "help") {
      const roleRows = Object.entries(ROLES).map(([k, v]) => ({ key: k, ...v }));
      const ROLE_PROS_CONS = {
        lead: { pro: "エースを最後まで牽引。最も信頼できる基本役割", con: "脚質が合わなくても最後まで牽引を続けるため、コースと合わないと非効率になりがち" },
        sub: { pro: "第一アシストを後方から支援し、序盤の消耗を分散できる", con: "脚がなくなると早期に離脱し、そこから先の牽引には貢献できない" },
        mountain: { pro: "山岳・山頂フィニッシュ区間で牽引力を発揮。平坦区間は温存できる", con: "平坦・丘陵中心のコースでは牽引せず、実質的に消耗するだけの手駒になる" },
        flat: { pro: "平坦・丘陵区間の牽引に強く、山岳の少ないコースで安定して働く", con: "山岳区間に入ると牽引せず自然に遅れていく（そこから先は温存扱い）" },
        breakaway: { pro: "序盤に飛び出して逃げ集団を形成。エースの脚を使わずに得点機会を作れる", con: "メイン集団に吸収されるとポイントに繋がらないリスクがある" },
      };
      const CHASE_PROS_CONS = {
        normal: { pro: "脚の消耗を抑えた標準ペース", con: "特別な加速はしない" },
        push: { pro: "ローテーション頻度を上げてペースアップできる", con: "牽引役の脚の消耗が早まる" },
        hold: { pro: "牽引役の脚を温存できる", con: "ギャップの拡大を許容することになる" },
        ace_early: { pro: "エースが単独アタックし、一気にタイム差を作れる可能性がある", con: "エネルギー切れで終盤に大失速するリスクがある（1レース1回限り）" },
      };
      const benchAbility = 80;
      body = (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <Eyebrow color={C.green}>役割の得意・弱点</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {roleRows.map(r => (
                <div key={r.key} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13.5 }}>{r.label}</div>
                  <div style={{ fontSize: 11.5, color: C.green, marginTop: 3 }}>◎ {ROLE_PROS_CONS[r.key].pro}</div>
                  <div style={{ fontSize: 11.5, color: C.red, marginTop: 2 }}>▲ {ROLE_PROS_CONS[r.key].con}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow color={C.blue}>作戦の得意・弱点（出走前に1つ選択）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {Object.entries(CHASE_MODES).map(([k, v]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13.5 }}>🚩 {v.label}</div>
                  <div style={{ fontSize: 11.5, color: C.green, marginTop: 3 }}>◎ {CHASE_PROS_CONS[k].pro}</div>
                  <div style={{ fontSize: 11.5, color: C.red, marginTop: 2 }}>▲ {CHASE_PROS_CONS[k].con}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow color={C.yellow}>能力値のクラス別ベンチマーク</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4, lineHeight: 1.7 }}>
              新人の能力値は「クラスの基準値±11」＋「専門種目+14」で決まり、22〜94の範囲でばらつきます。
              同じ能力値でも、所属クラスが上がるほど相対的な希少価値は下がります（PROの80は「まずまずの主力」、B1の80は「相当な逸材」）。
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {CLASSES.map((c, i) => {
                const lo = c.scout - 11 + 14, hi = Math.min(94, c.scout + 11 + 14);
                const pct = Math.max(0, Math.min(100, Math.round(((hi - benchAbility) / (hi - lo)) * 100)));
                return (
                  <div key={c.id} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13 }}>{c.label}</span>
                    <span style={{ fontSize: 11.5, color: C.sub }}>専門種目の新人レンジ 約{Math.round(lo)}〜{Math.round(hi)}</span>
                    <span style={{ fontSize: 11.5, color: C.yellow }}>能力{benchAbility}は新人の上位約{pct}%相当</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <Eyebrow color={C.purple}>難易度・スコアリングの目安</Eyebrow>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                レースの★（グレード）は賞金・獲得ポイントの倍率です：★1=×1.0／★2=×1.5／★3=×2.0。
              </div>
              {CLASSES.map(c => {
                const perRace = (c.need / 11).toFixed(1);
                return (
                  <div key={c.id} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub }}>
                    <span style={{ color: C.text, fontFamily: FONT_D, fontWeight: 700 }}>{c.label}</span>：昇格に必要{c.need}pt ÷ シーズン11レース ＝ 平均<span style={{ color: C.yellow, fontFamily: FONT_M }}> {perRace}pt/レース</span>が目安（★1のレースなら概ね6〜7位以内の成績）
                  </div>
                );
              })}
            </div>
          </div>

          {/* v25: ヘルプを大幅拡充。基本の能力・成長システムから、細かな仕様まで一覧できるようにする */}
          <div>
            <Eyebrow color={C.green}>能力値と特殊能力の基本</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                能力値は<span style={{ color: C.text }}>平坦・登坂・スプリント・スタミナ・独走</span>の5種類（22〜135）。区間の種類ごとに使われる能力が決まり、丘陵は登坂55%＋平坦45%、山頂フィニッシュは登坂70%＋スプリント30%、TT区間は独走60%＋平坦40%というように複数の能力が混ざる区間もあります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                選手は<span style={{ color: C.text }}>特殊能力を0〜3個</span>保有します。地形適性・展開/役割・メンタル・フィジカル・成長の5カテゴリがあり、悪特性（バッドステータス）が混ざることもあります。一定の勝利数や役割出走数を満たすと保有能力が「金特」に強化され、逆に条件を満たせば未保有の能力を後天的に習得することもあります。発見済みの能力は「記録」タブの特殊能力図鑑で内容を確認できます（未発見のものは？？？で伏せられます）。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.yellow}>成長・練習の仕組み</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                選手にはそれぞれ<span style={{ color: C.text }}>成長タイプ</span>（早熟・普通・晩成・超早熟・超晩成）があり、年齢によって「成長期（伸び最大）」「全盛期（伸び半減）」「衰え期（能力が少しずつ下がる）」が切り替わります。ピーク年齢は早熟21〜25歳・普通24〜29歳・晩成28〜33歳・超早熟18〜21歳・超晩成32〜38歳です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                さらに<span style={{ color: C.text }}>成長力（C/B/A/S）</span>が練習・出走経験の伸び方に倍率をかけます（C×0.7・B×1.0・A×1.3・S×1.6）。練習では指定した1能力に90%、残り4能力に14%の伸びが配分されます（トレードオフ）。出走した場合は、レースで使った区間の種目に応じた「出走経験」でも能力が伸び、レースのグレードが高いほど伸びが大きくなります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                能力には難易度ごとの<span style={{ color: C.text }}>ソフトキャップ</span>があります（イージー88・ノーマル94・ハード102・鬼112）。この値未満なら伸びは全開ですが、超えると急激に伸びが鈍化します。上限を超えた金色表示の能力は「限界突破」状態です。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.red}>疲労・コンディション・故障</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                出走すると疲労が+45（「鉄人」持ちは+32）増えます。<span style={{ color: C.red }}>3ヶ月連続で出走（3連闘）すると確定で故障</span>、疲労が90を超えると確率で故障が発生します（ドクターの雇用で確率・離脱期間ともに軽減）。「頑丈」は故障率半減、「ガラスの体」は故障率2倍＆離脱+1ヶ月です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                調子は→（普通）／↗（好調）／↑↑（絶好調）／↘（やや不調）／↓↓（絶不調）の5段階で毎月ランダムに変動します（「ムラっ気」は変動幅が大きく、「精密機械」は小さい）。休養させると疲労が回復します（出走なしなら-50、故障中でも自然回復します）。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.blue}>チームケミストリー・キャプテン制度</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                ロースター平均在籍月数に応じて<span style={{ color: C.text }}>チームケミストリー</span>が「新体制／定着期／円熟したチーム／鉄壁の絆」の順に上がり、レース中のドラフト消耗が最大8%軽減されます。移籍・トレード・解雇が多いと在籍月数がリセットされるため、頻繁な入れ替えは足元のケミストリーを崩すコストがあります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                任命した<span style={{ color: C.text }}>キャプテン</span>より2歳以上若い選手は練習効果+10%になりますが、キャプテン自身の練習効果は-5%になります（誰でも任命した方が得、にはならないよう小さなトレードオフがあります）。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={"#6fa8dc"}>天候</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                レースごとに晴れ・🌧雨・🥵猛暑のいずれかが決まります（カレンダー・出走前画面に表示）。<span style={{ color: C.text }}>雨</span>は出走選手全員の能力を一律で下げ（「悪天候巧者」持ちは軽減）、持たない選手には落車による負傷離脱のリスクも上乗せされます。<span style={{ color: C.text }}>猛暑</span>は出走後の疲労蓄積が増えます。横風区間の影響（「横風耐性」で軽減）とは別の、レース全体にかかる要素です。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.purple}>キャンプ・機材・スタッフ</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                <span style={{ color: C.text }}>トレーニングキャンプ券</span>を使うとその月の練習効果が×2になりますが、選手全員の疲労が+25されます。クールダウンはありませんが、連発すると疲労90超＝故障リスクゾーンに入りやすくなるため、使いどころの見極めが重要です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                恒常装備：<span style={{ color: C.text }}>エアロフレーム</span>（平坦+6%/Lv）・<span style={{ color: C.text }}>軽量ホイール</span>（登坂+6%/Lv）・<span style={{ color: C.text }}>トレーニング設備</span>（練習効果+15%/Lv）は買い切りで恒常的に効果が続きます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                スタッフは月給制：<span style={{ color: C.text }}>監督</span>（スポンサー契約が有利に）・<span style={{ color: C.text }}>トレーナー</span>（練習効果が恒常アップ）・<span style={{ color: C.text }}>ドクター</span>（故障率と離脱期間を軽減）。雇用できるレベル上限はクラスが上がるほど増えます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                <span style={{ color: C.purple }}>🎯 中期目標</span>：スポンサー契約時に、複数レースにまたがる約束（例「山岳系で通算2勝」「大レースで表彰台」）が1つ提示されます。年間ノルマ（総pt）や単月の指定レースとは別枠で、<span style={{ color: C.text }}>期限月までに達成すれば臨時ボーナス（資金＋ノルマpt）、未達なら違約金</span>。どのレースにエースを送り込むか、シーズンを通した計画性が問われます。進捗は主画面のパネルで常時確認できます。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={"#e8a13c"}>グランツール・副次クラシフィケーション</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                PROクラス限定で年3回（春・夏・秋）、3日間ステージレースの<span style={{ color: C.text }}>グランツール</span>が開催されます。グランファイナルへの出場には、その年の3戦すべてで総合優勝することが条件です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                グランツールでは総合成績とは別に、🟢ポイント賞（各区間の着順ポイント合計）・🔴山岳賞（山岳区間の着順ポイント合計）・⚪新人賞（26歳未満限定）の<span style={{ color: C.text }}>副次クラシフィケーション</span>が争われ、自チームが獲得すると賞金ボーナスが入ります。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.green}>ディナスティ周回・ユース育成枠</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                グランファイナル制覇後、「新たなチームで最初から」ではなく<span style={{ color: C.text }}>この轍を継いでさらなる高みへ</span>を選ぶと、同じチームのまま周回を継続できます（ディナスティモード）。周回を重ねるたびに他チームの地力が底上げされ、歯応えが保たれます。クリアポイントは周回のたびに再獲得できます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                「選手・練習」タブでは年1回だけ、契約金15万円で<span style={{ color: C.text }}>ユース選手（16〜17歳・成長力A以上確定）</span>を確保できます。現在の能力は低いですが、長期育成向けの原石です。使用枠は4月の年度替わりでリセットされます。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.sub}>スカウト・移籍・トレード・実績</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                毎年4月は新人スカウト月間。事前に選んだ方針（おまかせ／スプリント重視／登坂力重視／将来性重視／即戦力重視）に応じて候補5名の傾向が変わります。年間を通じてFA市場・他チームからのトレード提案・選手解雇（4月のみ）も利用できます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                <span style={{ color: "#e8a13c" }}>🎯 引き抜き市場</span>：ショップの「引き抜き市場」から、ライバルチームの<span style={{ color: C.text }}>看板選手</span>を移籍金で獲得できます（<span style={{ color: C.text }}>1シーズンに1回まで</span>）。成立すると相手は主力を失い、その選手は以後あなたのチームで走ります。逆に、あなたの主力が強豪から狙われる<span style={{ color: "#e8a13c" }}>引き抜きオファー</span>が届くこともあります。引き止め費用を払って残すか、移籍金を受け取って放出するか——放出した選手はライバルの一員として自チームの前に立ちはだかります。移籍金は選手の実力と移籍意欲で決まります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                実績を達成すると報酬（賞金や恒常ボーナス）が入ります。詳細な一覧は「記録」タブで確認できます。解雇・引退した選手のうち、実績かお気に入り登録の条件を満たした選手だけが殿堂入りとして名鑑に残ります。
              </div>
            </div>
          </div>
        </div>
      );
    }
    return wrap(body, true);
  }


}
