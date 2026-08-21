// hub/home.jsxより分割（Step13第7弾）：今月のレースカレンダー＋翌月へ進むセクション。
// 第13弾Phase3-D-4-b: Section/新トークンへ移行。レース名の前に付いていた4つの絵文字
// 接頭辞（優勝/グランツール/指定/地元）は名前の下のcaption行に文字で示す。コース断面の
// セグメントバーと★グレードは、地形の起伏・レースの格を一目で示す記号として機能して
// いるため例外的に残す（詳細はdevlog/wave13.md）。
import React from "react";
import { Item, PrimaryBtn, QuietBtn, Section } from "../../../../components/kit.jsx";
import { TYPES } from "../../../../data/abilities.js";
import { HOME_ABILITY_BONUS, SEG_COLOR } from "../../../../data/course.js";
import { CLASSES } from "../../../../data/progression.js";
import { T } from "../../../../data/theme.js";
import { GRADE_MUL, PRIZES, PTS, WEATHER, buildSim, raceIsHome, teamsForClass } from "../../../../logic/support.js";

export function renderRaceCalendarSection(ctx) {
  const { advanceMonth, g, healthy, setG } = ctx;
  return (
    <Section title="今月のレースカレンダー" right="出場は月1回">
      {g.homeRegion && <Item label="本拠地" value={g.homeRegion} detail={`地元開催のレースは出走選手が地元の声援を受けて能力+${HOME_ABILITY_BONUS}`} />}
      {g.races.map((r, i) => {
        const mul = CLASSES[r.cls].prizeMul * GRADE_MUL[r.grade];
        const enough = healthy.length >= r.tmpl.squadMin;
        const squadLabel = r.tmpl.squadMin === r.tmpl.squadMax ? `${r.tmpl.squadMin}名` : `${r.tmpl.squadMin}〜${r.tmpl.squadMax}名`;
        const tags = [
          r.championship && "チャンピオンシップ", r.grandTour && "グランツール",
          r.sponsorMandate && "スポンサー指定レース", raceIsHome(r, g.homeRegion) && "地元開催",
        ].filter(Boolean);
        const registeredNames = (!r.locked && g.entryPlan) ? g.entryPlan[r.id] : null;
        const teams = registeredNames ? teamsForClass(g.classIdx).filter(t => registeredNames.includes(t.name)) : null;
        return (
          <div key={r.id} style={{ padding: `${T.space.md}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}`, opacity: r.locked ? 0.55 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: T.space.sm }}>
              <span style={{ fontSize: T.size.head, color: T.color.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              <span style={{ fontSize: T.size.caption, color: T.color.accent, flex: "none" }}>{r.weather && r.weather !== "clear" ? `${WEATHER[r.weather].label}・` : ""}{"★".repeat(r.grade)}</span>
            </div>
            {tags.length > 0 && <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: 2 }}>{tags.join("・")}</div>}
            <div style={{ display: "flex", gap: 3, margin: `${T.space.xs}px 0` }}>
              {r.tmpl.segs.map((s, j) => <div key={j} style={{ flex: s[2], height: 5, background: SEG_COLOR[s[0]] }} />)}
            </div>
            <div style={{ fontSize: T.size.caption, color: T.color.sub }}>
              {r.tmpl.kind}・出走{squadLabel}・{TYPES[r.tmpl.favors].label}有利／優勝 約{Math.round(PRIZES[0] * mul)}万・{Math.round(PTS[0] * GRADE_MUL[r.grade])}pt
              {r.stageRace && <>／{r.stageCount || 2}日間ステージレース(総合)</>}
            </div>
            {teams && (
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>
                参戦 {teams.length === 0 ? "空いている" : `${teams.length}チーム${teams.length >= 4 ? "・激戦" : teams.length <= 1 ? "・空いている" : ""}`}
              </div>
            )}
            <div style={{ marginTop: T.space.sm }}>
              {r.locked
                ? <span style={{ fontSize: T.size.caption, color: T.color.bad }}>{r.lockReason}</span>
                : <PrimaryBtn disabled={!enough} onClick={() => setG(s => {
                    const defN = Math.max(r.tmpl.squadMin, Math.min(r.tmpl.squadMax, healthy.length));
                    // v50(第11弾Phase1・1-B): このレースに実際に登録されたチーム（s.entryPlan）を
                    // team定義オブジェクトへ解決してbuildSimへ渡す。未登録（旧セーブ等）ならクラス
                    // 全体へフォールバックする（buildSim側のデフォルト任せ）。
                    const registered = (s.entryPlan && s.entryPlan[r.id]) || null;
                    const entryTeams = registered ? teamsForClass(s.classIdx).filter(t => registered.includes(t.name)) : undefined;
                    // v29: 出走表用に相手チームの布陣を先に生成してキャッシュ。実際のレースでも
                    // このfixedAiTeamsを再利用するので、出走表と本番の顔ぶれが一致する
                    const { aiTeams } = buildSim(r, healthy, null, {}, s.equip, {}, s.classIdx, undefined, r.stageRace ? "day1" : undefined, { chaseMode: "normal", aceEarly: false }, s.difficulty, s.rivalAlumni, s.dynastyLevel, s.teamName, s.rivalRosters, s.year, entryTeams);
                    return { ...s, sel: { ...s.sel, raceId: r.id, starters: [], ace: null, roles: {}, squadN: defN }, pendingAiTeams: aiTeams, screen: "lineup" };
                  })}>
                    {enough ? "このレースに出場" : `出走可能${healthy.length}名（最低${r.tmpl.squadMin}名必要）`}
                  </PrimaryBtn>}
            </div>
          </div>
        );
      })}
      <QuietBtn onClick={() => advanceMonth(null)}>翌月へ進む（今月は休養：全員の疲労-50）</QuietBtn>
    </Section>
  );
}
