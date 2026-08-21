// hub/records.jsxより分割（Step13第7弾）：キャリア通算成績＋実績＋年度別記録セクション。
// 第13弾Phase3-D-4-b: Section/Itemへ移行。実績の絵文字（22px）を撤去し、達成/未達成は
// 文字色とopacityで表現（R3）。年度別記録は固定幅列へ（R2、詳細はdevlog/wave13.md）。
import React from "react";
import { Item, Section } from "../../../../components/kit.jsx";
import { T } from "../../../../data/theme.js";
import { SEASON_ACHIEVEMENTS, computeSeasonAchievements, formatAchievementReward } from "../../../../logic/support.js";

export function renderRecordsCareerSection(ctx) {
  const { g } = ctx;
  const cs = g.careerStats;
  const history = [...g.careerHistory].reverse();
  const achievements = computeSeasonAchievements(g);
  return (
    <>
      <Section title="キャリア通算成績">
        <Item first label="通算出走レース" value={cs.totalRaces} />
        <Item label="通算優勝" value={cs.totalWins} valueColor={T.color.accent} />
        <Item label="通算表彰台" value={cs.totalPodiums} valueColor={T.color.accent} />
        <Item label="自己ベスト着順" value={cs.bestFinish ? `${cs.bestFinish}位` : "—"} />
        <Item label="通算獲得賞金" value={`${cs.totalPrize}万円`} />
      </Section>
      <Section title="実績" right={`${achievements.filter(a => a.achieved).length} / ${SEASON_ACHIEVEMENTS.length}達成`}>
        {achievements.map((a, i) => (
          <div key={a.id} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}`, opacity: a.achieved ? 1 : 0.5 }}>
            <div style={{ fontSize: T.size.head, color: a.achieved ? T.color.accent : T.color.text }}>{a.label}</div>
            <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{a.desc}</div>
            {formatAchievementReward(a) && <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: 1 }}>{formatAchievementReward(a)}</div>}
          </div>
        ))}
      </Section>
      <Section title="年度別記録">
        {history.length === 0 && <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px 0` }}>まだ年度を終えていません。3月のチャンピオンシップを終えると記録が積み重なります。</div>}
        {history.map((h, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: `${T.space.xs}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}`, fontSize: T.size.caption }}>
            <span style={{ color: T.color.text, flex: 1 }}>{h.year}年目・{h.classLabel}</span>
            <span style={{ color: T.color.sub, flex: "none", fontVariantNumeric: "tabular-nums" }}>{h.points}pt{h.champBest ? `・${h.champBest}位` : ""}</span>
            <span style={{ color: h.promoted ? T.color.good : h.relegated ? T.color.bad : T.color.sub, flex: "none", width: 60, textAlign: "right" }}>
              {h.promoted ? "昇格" : h.relegated ? "降格" : "残留"}
            </span>
          </div>
        ))}
      </Section>
    </>
  );
}
