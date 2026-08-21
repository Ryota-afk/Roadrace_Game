// hub/records.jsxより分割（Step13第7弾）：殿堂入り選手名鑑セクション。
// 第13弾Phase3-D-4-b：RiderCardへ移行（詳細はdevlog/wave13.md）。
import React from "react";
import { Section } from "../../../../components/kit.jsx";
import { RiderCard } from "../../../../components/riderCard.jsx";
import { MONTHS } from "../../../../data/course.js";
import { T } from "../../../../data/theme.js";
import { riderFlavorText } from "../../../../logic/support.js";
import { riderCareerSummary, riderNickname } from "../../../../state/state.js";

export function renderRecordsHallSection(ctx) {
  const { expandedRiderId, g, setExpandedRiderId } = ctx;
  const hof = [...g.hallOfFame].reverse();
  return (
    <Section title="殿堂入り選手名鑑">
      {hof.length === 0 && <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px 0` }}>引退・退団した選手はまだいません。</div>}
      {hof.map((r, i) => {
        const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
        const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
        const rid = `hof-${r.id}-${i}`;
        const farewell = r.farewellReason === "retired" ? `${r.farewellYear}年目 引退`
          : r.farewellReason === "released" ? `${r.farewellYear}年目 退団`
          : r.farewellReason === "rival_retired" ? `${r.farewellYear}年目 引退（${r.signedTeam}）` : "";
        return (
          <RiderCard key={rid} r={r} first={i === 0}
            badge={r.favorite ? "お気に入り登録選手" : null}
            sub={farewell}
            expanded={expandedRiderId === rid}
            onToggleExpand={() => setExpandedRiderId(expandedRiderId === rid ? null : rid)}
            expandLabel="戦績を見る" collapseLabel="戦績を閉じる"
            expandedContent={
              <>
                {(!r.raceLog || r.raceLog.length === 0) && <div style={{ fontSize: T.size.caption, color: T.color.sub }}>出走記録がありません。</div>}
                {[...(r.raceLog || [])].reverse().map((e, j) => (
                  <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.caption, padding: "3px 0", borderBottom: j < r.raceLog.length - 1 ? `1px solid ${T.color.rule}` : "none" }}>
                    <span style={{ color: T.color.sub }}>{e.year}年目 {MONTHS[e.month]}</span>
                    <span style={{ color: T.color.text, flex: 1, margin: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                    <span style={{ color: e.rank === 1 ? T.color.accent : T.color.sub, fontVariantNumeric: "tabular-nums" }}>{e.rank}位</span>
                  </div>
                ))}
              </>
            }
          >
            {riderNickname(r) && <div style={{ fontSize: T.size.caption, color: T.color.sub, fontStyle: "italic" }}>「{riderNickname(r)}」</div>}
            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>{riderFlavorText(r)}</div>
            <div style={{ fontSize: T.size.caption, color: T.color.text, marginTop: T.space.sm, paddingTop: T.space.sm, borderTop: `1px solid ${T.color.rule}`, lineHeight: 1.6 }}>{riderCareerSummary(r)}</div>
            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>通算{(r.raceLog || []).length}戦・{wins}勝・表彰台{podiums}回</div>
          </RiderCard>
        );
      })}
    </Section>
  );
}
