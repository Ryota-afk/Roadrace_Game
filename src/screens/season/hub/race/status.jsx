// hub/home.jsxより分割（Step13第7弾）：シーズン状況（資金・スポンサー目標・タイトル争い・
// 他チーム動向・チーム状態）＋チームログセクション。中身は一切変更していない
// （byte-for-byte照合済み）。
import React from "react";
import { Eyebrow } from "../../../../components/ui.jsx";
import { Section, Item } from "../../../../components/mlUi.jsx";
import { MONTHS } from "../../../../data/course.js";
import { C, FONT_D, FONT_M, T } from "../../../../data/theme.js";
import { OB_COACH_SALARY } from "../../../../data/economy.js";
import { SCOUT_POLICIES, objectiveStatusText, rivalNews, seasonTitleRace, staffSalaryTotal } from "../../../../logic/support.js";
import { teamPayroll } from "../../../../domain/season/salary.js";

// 第13弾Phase3-D-4-a: SeasonHeaderから移設したスポンサー詳細・支出内訳・ダイナスティ周回の受け皿。
// ヘッダは常時参照する7項目だけに絞ったため、月1回程度しか参照しないこれらの値はここへ集約した
// （消したのではなく移設。詳細はdevlog/wave13.md）。
function SponsorAndSpendingSections({ g }) {
  const staffTotal = staffSalaryTotal(g.staff);
  const payroll = teamPayroll(g.roster, g.salaryDiscountMul || 1);
  const extra = staffTotal + (g.obCoach ? OB_COACH_SALARY : 0);
  const s = g.sponsor;
  return (
    <>
      {s && (
        <Section title="スポンサー契約">
          <Item first label="スポンサー" value={s.name} />
          <Item label="月収" value={`+${s.monthly}万`} valueColor={T.color.accent} />
          <Item label="ノルマ" value={`${s.norma}pt`} />
          <Item label="未達時" value={`-${s.penalty}万`} valueColor={T.color.bad} />
          <Item label="指定レース" value={`${s.mandatesMet}/${s.mandates}済`}
            detail={s.mandatesMissed > 0 ? `見送り${s.mandatesMissed}件` : null} />
        </Section>
      )}
      <Section title="今月の支出">
        <Item first label="選手年俸" value={`-${payroll}万/月`} detail={`${g.roster.length}名`} />
        {staffTotal > 0 && <Item label="スタッフ" value={`-${staffTotal}万/月`} />}
        {g.obCoach && <Item label="OBコーチ" value={`-${OB_COACH_SALARY}万/月`} />}
        {extra > 0 && <Item label="合計" value={`-${payroll + extra}万/月`} valueColor={T.color.bad} />}
      </Section>
      {g.dynastyLevel > 0 && (
        <Section title="ダイナスティ">
          <Item first label="周回" value={`${g.dynastyLevel}周目`} />
        </Section>
      )}
    </>
  );
}

export function renderRaceStatusSection(ctx) {
  const { g, healthy, setG } = ctx;
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
                  <Eyebrow color={col}>中期目標 — {om.icon} {om.label}</Eyebrow>
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
          <SponsorAndSpendingSections g={g} />
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
          {g.log.length > 0 && (
            <div style={{ background: C.panel2, borderRadius: 10, padding: "8px 12px" }}>
              <Eyebrow color={C.sub}>チームの記録</Eyebrow>
              {g.log.slice(-4).map((l, i) => <div key={i} style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>{l}</div>)}
            </div>
          )}
        </div>
  );
}
