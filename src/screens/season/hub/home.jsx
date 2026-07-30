// hub.jsxより分割（Step13第1弾）：主画面の「今月の行動」セクション（旧homeタブ）。
// カイロソフト式動線移行の第1歩として、hub.jsxをカテゴリ単位のセクション関数へ機械分解した。
// 中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { Btn, Eyebrow } from "../../../components/ui.jsx";
import { TYPES } from "../../../data/abilities.js";
import { HOME_ABILITY_BONUS, MONTHS, SEG_COLOR } from "../../../data/course.js";
import { CLASSES } from "../../../data/progression.js";
import { C, FONT_D, FONT_M } from "../../../data/theme.js";
import { GRADE_MUL, PRIZES, PTS, SCOUT_POLICIES, WEATHER, buildSim, objectiveStatusText, raceIsHome, rivalNews, seasonTitleRace } from "../../../logic/support.js";
import { saveGame } from "../../../state/state.js";

export function renderHomeSection(ctx) {
  const { advanceMonth, askConfirm, g, healthy, setG, setSuperMode } = ctx;
  const isMandateMonth = g.sponsor && g.sponsor.mandateMonths.includes(g.month);
  return (
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
