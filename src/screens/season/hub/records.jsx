// hub.jsxより分割（Step13第1弾）：キャリア通算成績・実績・年度別記録・殿堂・タイトル・
// コースレコード・特能図鑑セクション（旧careerタブ）。中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { AbilityFileList, CourseRecordsPanel, TitlesPanel } from "../../../components/panels.jsx";
import { Btn, Eyebrow } from "../../../components/ui.jsx";
import { TYPES } from "../../../data/abilities.js";
import { MONTHS } from "../../../data/course.js";
import { C, FONT_D, FONT_M } from "../../../data/theme.js";
import { SEASON_ACHIEVEMENTS, computeSeasonAchievements, formatAchievementReward, loadAbilityFile, riderFlavorText } from "../../../logic/support.js";
import { riderCareerSummary, riderNickname } from "../../../state/state.js";

export function renderRecordsSection(ctx) {
  const { expandedRiderId, g, setExpandedRiderId } = ctx;
  const cs = g.careerStats;
  const history = [...g.careerHistory].reverse();
  const hof = [...g.hallOfFame].reverse();
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
