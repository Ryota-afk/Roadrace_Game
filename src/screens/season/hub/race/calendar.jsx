// hub/home.jsxより分割（Step13第7弾）：今月のレースカレンダー＋翌月へ進むセクション。
// 中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { Btn, Eyebrow } from "../../../../components/ui.jsx";
import { TYPES } from "../../../../data/abilities.js";
import { HOME_ABILITY_BONUS, SEG_COLOR } from "../../../../data/course.js";
import { CLASSES } from "../../../../data/progression.js";
import { C, FONT_D, FONT_M } from "../../../../data/theme.js";
import { GRADE_MUL, PRIZES, PTS, WEATHER, buildSim, raceIsHome } from "../../../../logic/support.js";

export function renderRaceCalendarSection(ctx) {
  const { advanceMonth, g, healthy, setG } = ctx;
  return (
        <div style={{ display: "grid", gap: 10 }}>
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
        </div>
  );
}
