// hub/records.jsxより分割（Step13第7弾）：キャリア通算成績＋実績＋年度別記録セクション。
// 中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { Eyebrow } from "../../../../components/ui.jsx";
import { C, FONT_D, FONT_M } from "../../../../data/theme.js";
import { SEASON_ACHIEVEMENTS, computeSeasonAchievements, formatAchievementReward } from "../../../../logic/support.js";

export function renderRecordsCareerSection(ctx) {
  const { g } = ctx;
  const cs = g.careerStats;
  const history = [...g.careerHistory].reverse();
  return (
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
        </div>
  );
}
