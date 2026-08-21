// hub/home.jsxより分割（Step13第7弾）：シーズン状況（資金・スポンサー目標・タイトル争い・
// 他チーム動向・チーム状態）＋チームログセクション。
// 第13弾Phase3-D-4-a: SeasonHeaderから移設したスポンサー詳細・支出内訳・ダイナスティ周回の受け皿
// （SponsorAndSpendingSections）を新設。
// 第13弾Phase3-D-4-b: 残りのカードもSection/Itemへ移行。絵文字を撤去し、borderLeftの
// 色分け（緑/赤/紫/青）も撤去——ステータスの良し悪しはT.color.good/badの2色だけで表現する
// （詳細はdevlog/wave13.md）。
import React from "react";
import { Item, PrimaryBtn, QuietBtn, Section } from "../../../../components/kit.jsx";
import { MONTHS } from "../../../../data/course.js";
import { T } from "../../../../data/theme.js";
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
  const om = objectiveStatusText(g.sponsor && g.sponsor.objective);
  const obj = g.sponsor && g.sponsor.objective;
  const tr = seasonTitleRace(g);
  const news = rivalNews(g.year, g.month);
  const inj = g.roster.filter(r => r.injury > 0);
  const avgFat = Math.round(g.roster.reduce((s, r) => s + (r.fatigue || 0), 0) / Math.max(1, g.roster.length));
  const tired = g.roster.filter(r => r.injury === 0 && (r.fatigue || 0) >= 80).length;

  return (
    <>
      {g.budget < 0 && <div style={{ fontSize: T.size.caption, color: T.color.bad, marginBottom: T.space.sm }}>借金状態です。賞金とスポンサー収入で返済しましょう（返済まで買い物不可）。</div>}
      {isMandateMonth && <div style={{ fontSize: T.size.caption, color: T.color.bad, marginBottom: T.space.sm }}>今月はスポンサー指定月間です。指定レースに出場するとポイント+30%、見送ると違約金-15万が年度末に加算されます。</div>}

      {om && (
        <Section title="中期目標" right={om.status === "done" ? "達成" : om.status === "failed" ? "未達" : `${obj.progress} / ${obj.need}`}>
          <div style={{ fontSize: T.size.caption, color: T.color.text, padding: `${T.space.sm}px 0` }}>{om.label}・{om.desc}</div>
          {om.status === "active" && (
            <Item label="期限" value={`${MONTHS[om.deadline]}まで`} detail={`達成 +${obj.budget}万・ノルマ+${obj.points}pt／未達 -${obj.penalty}万`} />
          )}
        </Section>
      )}

      <SponsorAndSpendingSections g={g} />

      {g.month === 11 && (
        <Section title="チャンピオンシップ月間" right="来季スカウト方針の決定">
          <div style={{ display: "flex", gap: T.space.xs, padding: `${T.space.sm}px 0`, flexWrap: "wrap" }}>
            {Object.entries(SCOUT_POLICIES).map(([k, p]) => (
              g.scoutPolicy === k
                ? <PrimaryBtn key={k} onClick={() => setG(s => ({ ...s, scoutPolicy: k }))}>{p.label}</PrimaryBtn>
                : <QuietBtn key={k} onClick={() => setG(s => ({ ...s, scoutPolicy: k }))}>{p.label}</QuietBtn>
            ))}
          </div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>方針：{SCOUT_POLICIES[g.scoutPolicy].desc}（4月の候補5名に反映）</div>
        </Section>
      )}
      {g.month === 0 && <div style={{ fontSize: T.size.caption, color: T.color.text, marginBottom: T.space.sm }}>新人スカウト月間（方針：{SCOUT_POLICIES[g.scoutPolicy].label}）</div>}

      {tr && (
        <Section title="タイトル争い" right={`${tr.rank}位 / ${tr.total}`}>
          <div style={{ fontSize: T.size.caption, color: T.color.text, padding: `${T.space.sm}px 0` }}>{tr.line}</div>
          {tr.ahead && <Item label="追う相手" value={tr.ahead.name} detail={tr.ahead.trait} />}
          {tr.behind && <Item label="背後" value={tr.behind.name} detail={tr.behind.trait} />}
        </Section>
      )}

      <Section title="他チーム動向">
        <div style={{ fontSize: T.size.caption, color: T.color.text, padding: `${T.space.sm}px 0` }}>{news.text}</div>
      </Section>

      <Section title="今月のチーム状態">
        <Item first label="出走可能" value={`${healthy.length}/${g.roster.length}名`} valueColor={healthy.length > 0 ? T.color.good : T.color.bad} />
        <Item label="平均疲労" value={avgFat} valueColor={avgFat >= 70 ? T.color.bad : T.color.text}
          detail={[tired > 0 ? `疲労高 ${tired}名` : null, inj.length > 0 ? `故障 ${inj.map(r => `${r.name}(${r.injury}ヶ月)`).join("・")}` : null, g.camp ? "キャンプ実施中" : null].filter(Boolean).join("／") || null} />
      </Section>

      {g.log.length > 0 && (
        <Section title="チームの記録">
          {g.log.slice(-4).map((l, i) => <div key={i} style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.xs}px 0` }}>{l}</div>)}
        </Section>
      )}
    </>
  );
}
