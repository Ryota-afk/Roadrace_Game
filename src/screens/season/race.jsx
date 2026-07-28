// season.jsx より分割（Step8）：出走〜結果〜GC（startlist/lineup/race/result/gc_stage/gc_role_setup/gc_final）
import React from "react";
import { RaceErrorBoundary, RaceView } from "../../components/RaceView.jsx";
import { AbilityGrid, CondFc, ElevationChart, FatigueBar, MultiStageCourseView, StartListPanel, TraitLine } from "../../components/panels.jsx";
import { Btn, Eyebrow } from "../../components/ui.jsx";
import { fmtGap, fmtTime, overall } from "../../core/core.js";
import { AB_LABEL, COND_ARROW, COND_COLOR, TYPES, TYPE_ROLE_FIT } from "../../data/abilities.js";
import { CHASE_MODES, ROLES, SEG_AB, SEG_COLOR } from "../../data/course.js";
import { C, FONT_D, FONT_M } from "../../data/theme.js";
import { DISCIPLINES, FAVORS_TO_DISCIPLINE, WEATHER, disciplineScore, groupModeFor, objectiveStatusText, t_label } from "../../logic/support.js";
import { effAbilities, generateCourse } from "../../sim/race.js";

export function renderSeasonRaceScreens(ctx) {
  const { advanceMonth, g, growthCap, healthy, raceFinishHandler, setG, startNextStage, startRace, wrap } = ctx;
  if (g.screen === "startlist") {
    const race = g.races.find(r => r.id === g.sel.raceId);
    const playerEntrants = g.roster.filter(r => (g.sel.starters || []).includes(r.id))
      .map(r => {
        // v34(UI): 下馬評用に自チーム選手も実効能力を持たせる（AIと同じeffAbilitiesで公平に比較）
        const meta = { id: r.id, name: r.name, type: r.type, teamName: g.teamName || "あなたのチーム", color: C.yellow, team: "PLAYER", isAce: r.id === g.sel.ace };
        return race ? { ...effAbilities(r, g.equip, {}, race.grade, race.weather, race.monument), ...meta } : meta;
      });
    const aiEntrants = (g.pendingAiTeams || []).flat();
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <Eyebrow color={C.purple}>🏁 出走表 — {race ? race.name : ""}</Eyebrow>
        {playerEntrants.length === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>まだ自チームの出走メンバーを選んでいません。相手の布陣を見て編成を決めましょう。</div>}
        <StartListPanel entrants={[...playerEntrants, ...aiEntrants]} favors={race && race.tmpl ? race.tmpl.favors : undefined} />
        <Btn onClick={() => setG(s => ({ ...s, screen: "lineup" }))}>← 編成に戻る</Btn>
      </div>
    );
  }

  if (g.screen === "lineup") {
    const race = g.races.find(r => r.id === g.sel.raceId);
    const N = g.sel.squadN || race.tmpl.squadMin;
    const groupMode = groupModeFor(N);
    const previewCourse = generateCourse(race);
    const setSquadN = (n) => setG(s => ({ ...s, sel: { ...s.sel, squadN: n, starters: [], ace: null, roles: {} } }));
    const toggle = (id) => setG(s => {
      const st = s.sel.starters;
      let starters, ace = s.sel.ace;
      if (st.includes(id)) { starters = st.filter(x => x !== id); if (ace === id) ace = null; }
      else if (st.length >= N) return s;
      else starters = [...st, id];
      return { ...s, sel: { ...s.sel, starters, ace } };
    });
    const sel = g.sel;
    const ready = sel.starters.length === N && (N === 1 || sel.ace);
    const roleOptions = groupMode === "pelotonOnly"
      ? Object.entries(ROLES).filter(([k]) => k !== "breakaway")
      : Object.entries(ROLES);
    const squadChoices = [];
    for (let n = race.tmpl.squadMin; n <= race.tmpl.squadMax; n++) squadChoices.push(n);
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 10, padding: "10px 14px", borderLeft: `4px solid ${C.yellow}` }}>
          <div style={{ fontFamily: FONT_D, fontSize: 16, fontWeight: 700, color: C.text }}>{race.championship ? "👑 " : ""}{race.sponsorMandate ? "🎯 " : ""}{race.name} {"★".repeat(race.grade)}</div>
          {race.weather && race.weather !== "clear" && (
            <div style={{ fontSize: 12, color: race.weather === "rain" ? C.blue : C.red, marginTop: 2 }}>
              {WEATHER[race.weather].icon} 天候：{WEATHER[race.weather].label}
              {race.weather === "rain" ? "（悪天候巧者以外は能力低下・落車リスク増）" : "（出走後の疲労蓄積が増える）"}
            </div>
          )}
          {!race.stageRace && (
            <div style={{ display: "flex", gap: 3, margin: "6px 0 3px" }}>
              {race.tmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 7, borderRadius: 3, background: SEG_COLOR[s[0]] }} />)}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: C.sub }}>{race.stageRace && race.stageTmpls ? "日替わりコース" : race.tmpl.kind}・<span style={{ color: C.yellow }}>出走{N}名</span>・{TYPES[race.tmpl.favors].label}有利</div>
          {squadChoices.length > 1 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>出走人数（少人数ほど手持ちの疲労を温存できるが、ローテーションや逃げの選択肢は減る）</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {squadChoices.map(n => {
                  const dis = healthy.length < n;
                  return (
                    <button key={n} disabled={dis} onClick={() => setSquadN(n)}
                      style={{
                        fontFamily: FONT_D, fontWeight: 700, fontSize: 12.5, padding: "5px 11px", borderRadius: 6, cursor: dis ? "default" : "pointer",
                        background: N === n ? C.yellow : C.panel2, color: N === n ? "#14171d" : dis ? "#5b6272" : C.sub,
                        border: `1px solid ${N === n ? C.yellow : C.line}`, opacity: dis ? 0.5 : 1,
                      }}>{n}名</button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            {race.stageRace ? <MultiStageCourseView race={race} /> : <ElevationChart course={previewCourse} />}
          </div>
        </div>
        <section>
          <Eyebrow>出走{N}名を選択（{sel.starters.length}/{N}）</Eyebrow>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {g.roster.map(r => {
              const t = TYPES[r.type];
              const dis = r.injury > 0;
              const on = sel.starters.includes(r.id);
              const fitKey = FAVORS_TO_DISCIPLINE[race.tmpl.favors];
              const fitScore = disciplineScore(r, fitKey);
              return (
                <div key={r.id} onClick={() => !dis && toggle(r.id)}
                  style={{
                    background: on ? "#2b3141" : C.panel, borderRadius: 10, padding: "9px 12px", cursor: dis ? "default" : "pointer",
                    border: `1.5px solid ${on ? C.yellow : C.line}`, opacity: dis ? 0.45 : 1,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{r.name}
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                      {dis && <span style={{ marginLeft: 6, fontSize: 10.5, color: C.red }}>🏥故障中</span>}
                      {r.streak >= 1 && !dis && <span style={{ marginLeft: 6, fontSize: 10.5, color: r.streak >= 2 ? C.red : "#e8a13c" }}>連闘{r.streak}{r.streak >= 2 ? "（出すと故障）" : ""}</span>}
                    </span>
                    <span style={{ fontFamily: FONT_M, fontSize: 12, color: COND_COLOR[r.cond - 1] }}>
                      {COND_ARROW[r.cond - 1]}<CondFc dir={r.condForecast} /> <span style={{ color: C.yellow }}>{overall(r)}</span>
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>{DISCIPLINES[fitKey].label}適性<span style={{ color: C.yellow, fontFamily: FONT_M }}> {fitScore}</span></span>
                    </span>
                  </div>
                  <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                  <FatigueBar v={r.fatigue} />
                  <AbilityGrid r={r} cap={growthCap} />
                </div>
              );
            })}
          </div>
        </section>
        {sel.starters.length === N && N > 1 && (
          <section>
            <Eyebrow color={C.yellow}>エース指名（残り{N - 1}名がエースを支える）</Eyebrow>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {g.roster.filter(r => sel.starters.includes(r.id)).map(r => (
                <button key={r.id} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, ace: r.id } }))}
                  style={{
                    fontFamily: FONT_D, fontWeight: 700, fontSize: 14, padding: "9px 13px", borderRadius: 8, cursor: "pointer",
                    background: sel.ace === r.id ? C.yellow : C.panel, color: sel.ace === r.id ? "#14171d" : C.text,
                    border: `1.5px solid ${sel.ace === r.id ? C.yellow : C.line}`,
                  }}>{sel.ace === r.id ? "👑 " : ""}{r.name}</button>
              ))}
            </div>
          </section>
        )}
        {sel.starters.length === N && (N === 1 || sel.ace) && groupMode !== "solo" && (
          <section>
            <Eyebrow color={C.green}>役割指定（エースを支える残りのメンバーのみ。コースに合わせて細かく指定できます）</Eyebrow>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {g.roster.filter(r => sel.starters.includes(r.id) && r.id !== sel.ace).map(r => {
                const role = sel.roles[r.id] || "lead";
                const mismatch = (role === "mountain" || role === "flat") && TYPE_ROLE_FIT[role] && !TYPE_ROLE_FIT[role].includes(r.type);
                return (
                  <div key={r.id} style={{ background: C.panel, borderRadius: 8, padding: "6px 10px", border: `1px solid ${C.line}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                      <span style={{ fontFamily: FONT_D, fontSize: 13, color: C.text }}>{r.name}</span>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {roleOptions.map(([k, rl]) => (
                          <button key={k} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, roles: { ...s.sel.roles, [r.id]: k } } }))}
                            title={rl.desc}
                            style={{
                              fontFamily: FONT_D, fontSize: 10.5, fontWeight: 700, padding: "4px 7px", borderRadius: 6, cursor: "pointer",
                              background: role === k ? (k === "breakaway" ? C.red : C.blue) : C.panel2,
                              color: role === k ? "#14171d" : C.sub,
                              border: `1px solid ${role === k ? (k === "breakaway" ? C.red : C.blue) : C.line}`,
                            }}>{rl.label}</button>
                        ))}
                      </div>
                    </div>
                    {mismatch && <div style={{ fontSize: 10, color: C.red, marginTop: 3 }}>⚠ {t_label(r.type)}には不向きな役割（適性ボーナスなし）</div>}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {ready && N > 1 && (
          <section>
            <Eyebrow color={C.green}>作戦（レース全体で1つ選択。観戦中の指示変更はできません）</Eyebrow>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {["normal", "push", "hold"].map(k => {
                const active = (sel.chaseMode || "normal") === k;
                return (
                  <button key={k} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, chaseMode: k } }))}
                    style={{
                      flex: 1, padding: "8px 4px", borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: FONT_D, cursor: "pointer",
                      background: active ? C.green : C.panel2, color: active ? "#14171d" : C.text,
                      border: `1px solid ${active ? C.green : C.line}`,
                    }}>🚩 {CHASE_MODES[k].label}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{CHASE_MODES[sel.chaseMode || "normal"].desc}</div>
            <Btn small outline={!sel.aceEarly} color={C.red} style={{ marginTop: 8 }}
              onClick={() => setG(s => ({ ...s, sel: { ...s.sel, aceEarly: !s.sel.aceEarly } }))}>
              {sel.aceEarly ? "✔ " : ""}🚩 {CHASE_MODES.ace_early.label}
            </Btn>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{CHASE_MODES.ace_early.desc}</div>
          </section>
        )}
        {ready && (
          <section>
            <Eyebrow color={C.green}>決戦機材</Eyebrow>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {g.inv.wheel > 0 && <Btn small outline={!sel.useWheel} color={C.purple} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, useWheel: !s.sel.useWheel } }))}>{sel.useWheel ? "✔ " : ""}決戦ホイール（登坂+15%）</Btn>}
              {g.inv.suit > 0 && <Btn small outline={!sel.useSuit} color={C.purple} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, useSuit: !s.sel.useSuit } }))}>{sel.useSuit ? "✔ " : ""}エアロスーツ（平坦+15%）</Btn>}
            </div>
          </section>
        )}
        <div style={{ display: "grid", gap: 8 }}>
          {g.pendingAiTeams && <Btn outline color={C.purple} onClick={() => setG(s => ({ ...s, screen: "startlist" }))}>🏁 出走表（他チームの布陣）を見る</Btn>}
          <Btn disabled={!ready} onClick={() => startRace(true)}>観戦しながらスタート 🏁</Btn>
          <Btn outline disabled={!ready} onClick={() => startRace(false)}>結果だけ見る（スキップ）</Btn>
          <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
        </div>
      </div>
    );
  }

  if (g.screen === "race" && g.result) return wrap(
    <div>
      <div style={{ marginBottom: 8 }}>
        <Eyebrow color={C.red}>LIVE — {g.result.raceMeta.name}{g.gc && g.gc.race.stageRace ? `（${g.gc.stage}日目）` : ""}</Eyebrow>
      </div>
      <RaceErrorBoundary onRecover={raceFinishHandler}>
        <RaceView sim={g.result} onFinish={raceFinishHandler} />
      </RaceErrorBoundary>
      <div style={{ marginTop: 8, fontSize: 12, color: C.sub }}>
        ● 印＝あなたのチーム／黄ジャージ＝エース。位置が近い選手同士が自然にグループを作り、千切れ・吸収・ローテーションが発生します。
      </div>
    </div>
  );

  if (g.screen === "result_pending") return wrap(<div style={{ color: C.sub }}>結果集計中…</div>);

  // v35(チームTT): チームTT専用の結果画面（チーム順位＝合算タイムで並べる）
  if (g.screen === "result" && g.result && g.prizeInfo && g.prizeInfo.teamTT) {
    const { race, prize, pts, teamTT, teamRank, totalTeams, mandateHit } = g.prizeInfo;
    const winner = teamTT[0];
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.yellow}` }}>
          <Eyebrow>RESULT — {race.name}（チームTT）</Eyebrow>
          <div style={{ fontFamily: FONT_D, fontSize: 20, color: C.text, fontWeight: 700, margin: "6px 0" }}>
            🏆 優勝：{winner.teamName}<span style={{ fontSize: 12, color: winner.isPlayer ? C.yellow : C.sub }}> {fmtTime(winner.time)}</span>
          </div>
          <div style={{ fontSize: 13.5, color: C.text }}>自チーム：<span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 17 }}>{teamRank}位</span> / {totalTeams}チーム</div>
          <div style={{ fontSize: 13.5, color: C.green, marginTop: 3 }}>賞金 +{prize}万円{race.championship ? "" : ` ／ ポイント +${pts}pt${mandateHit ? "（指定レースボーナス込）" : ""}`}</div>
          {(() => {
            const om = objectiveStatusText(g.prizeInfo.objectiveResult);
            if (!om) return null;
            return (
              <div style={{ marginTop: 4, fontSize: 12.5, color: g.prizeInfo.objectiveDone ? C.green : C.purple, fontWeight: g.prizeInfo.objectiveDone ? 700 : 400 }}>
                {g.prizeInfo.objectiveDone ? `🎉 中期目標「${om.icon} ${om.label}」達成！` : `🎯 中期目標「${om.icon} ${om.label}」進捗 ${om.tail}`}
              </div>
            );
          })()}
          <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>チームTTは合算タイム勝負。独走力・平坦・スタミナの層の厚さと連携（ケミストリー）が効きます。</div>
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: "8px 12px" }}>
          {teamTT.map((t) => (
            <div key={t.team} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6, fontSize: 13, background: t.isPlayer ? "rgba(255,210,63,0.12)" : "transparent", borderBottom: `1px solid ${C.line}` }}>
              <span style={{ color: t.isPlayer ? C.yellow : C.text, fontWeight: t.isPlayer ? 700 : 400 }}>
                <span style={{ fontFamily: FONT_M, display: "inline-block", width: 26 }}>{t.rank}.</span>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: t.color, marginRight: 6 }} />
                {t.teamName}{t.isPlayer ? "（自チーム）" : ""}
              </span>
              <span style={{ fontFamily: FONT_M, color: C.sub }}>{t.rank === 1 ? fmtTime(t.time) : fmtGap(t.time - winner.time)}</span>
            </div>
          ))}
        </div>
        <Btn onClick={() => { const expKeys = [...new Set(g.result.course.segs.map(s => SEG_AB[s.type]))]; advanceMonth({ starters: g.sel.starters, expKeys, grade: race.grade, weather: race.weather, raceId: g.sel.raceId }); }}>翌月へ進む →</Btn>
      </div>
    );
  }
  if (g.screen === "result" && g.result && g.prizeInfo) {
    const { race, prize, pts, best, mandateHit, breakSurvived, hadBreak, courseRecord } = g.prizeInfo;
    const res = g.result;
    const expKeys = [...new Set(res.course.segs.map(s => SEG_AB[s.type]))];
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.yellow}` }}>
          <Eyebrow>RESULT — {race.name}</Eyebrow>
          <div style={{ fontFamily: FONT_D, fontSize: 20, color: C.text, fontWeight: 700, margin: "6px 0" }}>
            🏆 優勝：{res.ranked[0].name}
            <span style={{ fontSize: 12, color: res.ranked[0].team === "PLAYER" ? C.yellow : C.sub }}>（{res.ranked[0].teamName}）</span>
          </div>
          <div style={{ fontSize: 13.5, color: C.text }}>自チーム最高位：<span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 17 }}>{best.rank}位</span>（{best.name}）</div>
          <div style={{ fontSize: 13.5, color: C.green, marginTop: 3 }}>賞金 +{prize}万円{race.championship ? "" : ` ／ ポイント +${pts}pt${mandateHit ? "（指定レースボーナス込）" : ""}`}</div>
          {hadBreak && (
            <div style={{ fontSize: 12, color: breakSurvived ? C.yellow : C.sub, marginTop: 3 }}>
              {breakSurvived ? "🚴 逃げ切り成功！逃げ集団内でのスプリント決着" : "🏃 メイン集団に吸収され、ゴールスプリント決着"}
            </div>
          )}
          <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>出走経験：{expKeys.map(k => AB_LABEL[k]).join("・")}が成長</div>
          {courseRecord && courseRecord.isNew && (
            <div style={{ fontSize: 12.5, color: courseRecord.isPlayer ? C.yellow : C.text, marginTop: 4, fontWeight: 700 }}>
              🏅 {courseRecord.kind}のコースレコード更新！（指数{courseRecord.speed}／達成：{courseRecord.holder}{courseRecord.isPlayer ? "・自チーム" : ""}）
            </div>
          )}
          {race.championship && (
            <div style={{ marginTop: 6, fontSize: 13, color: best.rank <= 3 ? C.yellow : C.red }}>
              {g.classIdx === 2 && best.rank === 1 ? "グランファイナル制覇！！" : best.rank <= 3 ? "昇格圏内でフィニッシュ！年度末処理で昇格します" : "昇格ならず…来季に再挑戦"}
            </div>
          )}
          {(() => {
            const om = objectiveStatusText(g.prizeInfo.objectiveResult);
            if (!om) return null;
            return (
              <div style={{ marginTop: 6, fontSize: 13, color: g.prizeInfo.objectiveDone ? C.green : C.purple, fontWeight: g.prizeInfo.objectiveDone ? 700 : 400 }}>
                {g.prizeInfo.objectiveDone ? `🎉 中期目標「${om.icon} ${om.label}」達成！` : `🎯 中期目標「${om.icon} ${om.label}」進捗 ${om.tail}`}
              </div>
            );
          })()}
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: "8px 12px", maxHeight: 260, overflowY: "auto" }}>
          {res.ranked.map(e => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px", borderRadius: 6, fontSize: 12.5, background: e.team === "PLAYER" ? "rgba(255,210,63,0.1)" : "transparent" }}>
              <span style={{ color: e.team === "PLAYER" ? C.yellow : C.text }}>
                <span style={{ fontFamily: FONT_M, display: "inline-block", width: 24 }}>{e.rank}.</span>
                {e.name}{e.isAce ? " 👑" : ""}{e.isAlumnus ? " 🔀" : ""}<span style={{ color: C.sub, fontSize: 10.5 }}> / {e.teamName}</span>
              </span>
              <span style={{ fontFamily: FONT_M, color: C.sub }}>{e.rank === 1 ? fmtTime(e.finishTime) : fmtGap(e.finishTime - res.ranked[0].finishTime)}</span>
            </div>
          ))}
        </div>
        <Btn onClick={() => advanceMonth({ starters: g.sel.starters, expKeys, grade: race.grade, weather: race.weather, raceId: g.sel.raceId, grandTour: !!race.grandTour, stageCount: race.stageCount })}>翌月へ進む →</Btn>
      </div>
    );
  }

  if (g.screen === "gc_stage" && g.result && g.gc) {
    const res = g.result;
    const sorted = [...res.entrants].sort((a, b) => a.finishTime - b.finishTime);
    const bestIdx = sorted.findIndex(e => e.team === "PLAYER");
    const stageNo = g.gc.stage;
    const totalStages = g.gc.race.stageCount || 2;
    // v13バグ修正: 中間ステージ画面はその日単独の着順しか表示しておらず、
    // 総合タイムがどこにも出ていなかった（計算はされていたが表示がなかったため
    // 「総合タイムが計算されていない」ように見えていた）。stageTimesの累積から
    // ここでも総合順位・総合タイム差を算出して表示する
    const idToEntrant = {}; res.entrants.forEach(en => { idToEntrant[en.id] = en; });
    const gcTimesSoFar = {};
    Object.keys(idToEntrant).forEach(id => {
      gcTimesSoFar[id] = Object.values(g.gc.stageTimes).reduce((sum, st) => sum + (st[id] || 0), 0);
    });
    const gcOrderSoFar = Object.entries(gcTimesSoFar).sort((a, b) => a[1] - b[1]);
    const gcBestIdx = gcOrderSoFar.findIndex(([id]) => idToEntrant[id].team === "PLAYER");
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.purple}` }}>
          <Eyebrow color={C.purple}>STAGE {stageNo} 完了 — {g.gc.race.name}</Eyebrow>
          <div style={{ fontSize: 13.5, color: C.text, marginTop: 6 }}>{stageNo}日目 自チーム最高位：<span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 17 }}>{bestIdx + 1}位</span></div>
          <div style={{ fontSize: 13.5, color: C.text, marginTop: 3 }}>
            総合成績（{stageNo}日目終了時点）：自チーム最高
            <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 17 }}> {gcBestIdx + 1}位</span>
            {gcBestIdx >= 0 && (
              <span style={{ fontFamily: FONT_M, color: C.sub, marginLeft: 6 }}>
                {gcBestIdx === 0 ? fmtTime(gcOrderSoFar[0][1]) : fmtGap(gcOrderSoFar[gcBestIdx][1] - gcOrderSoFar[0][1])}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>総合成績は{totalStages}日目終了後に確定します。まずは休息・疲労回復（-20）をしてから{stageNo + 1}日目へ。</div>
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: "8px 12px", maxHeight: 260, overflowY: "auto" }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>総合順位（{stageNo}日目終了時点）</div>
          {gcOrderSoFar.map(([id, t], i) => {
            const e = idToEntrant[id];
            return (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px", fontSize: 12.5, background: e.team === "PLAYER" ? "rgba(255,210,63,0.1)" : "transparent" }}>
                <span style={{ color: e.team === "PLAYER" ? C.yellow : C.text }}><span style={{ fontFamily: FONT_M, display: "inline-block", width: 24 }}>{i + 1}.</span>{e.name}{e.isAce ? " 👑" : ""}{e.isAlumnus ? " 🔀" : ""}</span>
                <span style={{ fontFamily: FONT_M, color: C.sub }}>{i === 0 ? fmtTime(t) : fmtGap(t - gcOrderSoFar[0][1])}</span>
              </div>
            );
          })}
        </div>
        <Btn onClick={() => {
          // v14.8: 出走1名（solo）は役割自体が存在しないため再設定画面を経由せず直接次日程へ
          if (g.gc.starters.length === 1) startNextStage();
          else setG(s => ({ ...s, screen: "gc_role_setup" }));
        }}>{stageNo + 1}日目へ進む →</Btn>
      </div>
    );
  }

  // v14.8: ステージレースは日ごとに役割（エース・アシスト種別）を変更できるようにした。
  // 出走メンバー自体（starters）は初日のまま固定し、誰がエースでどの役割かだけを
  // 次のステージに向けてここで選び直せる（lineup画面の役割選択UIと同じ操作感）
  if (g.screen === "gc_role_setup" && g.gc) {
    const gc = g.gc;
    const groupMode = groupModeFor(gc.starters.length);
    const roleOptions = groupMode === "pelotonOnly"
      ? Object.entries(ROLES).filter(([k]) => k !== "breakaway")
      : Object.entries(ROLES);
    const sel = g.sel;
    const squad = g.roster.filter(r => gc.starters.includes(r.id));
    const nextStageNo = gc.stage + 1;
    // v14.10: 作戦変更画面でもその日のコース（区間バー・標高グラフ）を見られるようにする。
    // 日ごとにコース性格が変わるグランツールでは特に、次の日がどんなコースかを
    // 確認した上でエース・役割を選び直せる方が理にかなっている
    const dayTmpl = gc.race.stageTmpls ? gc.race.stageTmpls[nextStageNo - 1] : gc.race.tmpl;
    const dayCourse = generateCourse(gc.race, `day${nextStageNo}`);
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 10, padding: "10px 14px", borderLeft: `4px solid ${C.purple}` }}>
          <div style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>{nextStageNo}日目に向けて作戦変更</div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>コース性格に合わせて、エース・役割をこの日だけ変更できます（出走メンバー自体は変更できません）。</div>
          <div style={{ display: "flex", gap: 3, margin: "8px 0 3px" }}>
            {dayTmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 7, borderRadius: 3, background: SEG_COLOR[s[0]] }} />)}
          </div>
          <div style={{ fontSize: 11.5, color: C.sub }}>{nextStageNo}日目・{dayTmpl.kind}・{TYPES[dayTmpl.favors].label}有利</div>
          <div style={{ marginTop: 6 }}><ElevationChart course={dayCourse} /></div>
        </div>
        <section>
          {/* v14.14: 作戦変更画面でも選手の能力を見た上でエース・役割を決められるよう、
              その日のコース適性（disciplineScore）と能力グリッドを一覧表示する */}
          <Eyebrow color={C.sub}>出走メンバーの能力（{nextStageNo}日目のコース適性）</Eyebrow>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {squad.map(r => {
              const t = TYPES[r.type];
              const fitKey = FAVORS_TO_DISCIPLINE[dayTmpl.favors];
              const fitScore = disciplineScore(r, fitKey);
              return (
                <div key={r.id} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1.5px solid ${sel.ace === r.id ? C.yellow : C.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{sel.ace === r.id ? "👑 " : ""}{r.name}
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                    </span>
                    <span style={{ fontFamily: FONT_M, fontSize: 12, color: COND_COLOR[r.cond - 1] }}>
                      {COND_ARROW[r.cond - 1]}<CondFc dir={r.condForecast} /> <span style={{ color: C.yellow }}>{overall(r)}</span>
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>{DISCIPLINES[fitKey].label}適性<span style={{ color: C.yellow, fontFamily: FONT_M }}> {fitScore}</span></span>
                    </span>
                  </div>
                  <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                  <FatigueBar v={r.fatigue} />
                  <AbilityGrid r={r} cap={growthCap} />
                </div>
              );
            })}
          </div>
        </section>
        <section>
          <Eyebrow color={C.yellow}>エース指名</Eyebrow>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {squad.map(r => (
              <button key={r.id} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, ace: r.id } }))}
                style={{
                  fontFamily: FONT_D, fontWeight: 700, fontSize: 14, padding: "9px 13px", borderRadius: 8, cursor: "pointer",
                  background: sel.ace === r.id ? C.yellow : C.panel, color: sel.ace === r.id ? "#14171d" : C.text,
                  border: `1.5px solid ${sel.ace === r.id ? C.yellow : C.line}`,
                }}>{sel.ace === r.id ? "👑 " : ""}{r.name}</button>
            ))}
          </div>
        </section>
        <section>
          <Eyebrow color={C.green}>役割指定（エースを支える残りのメンバーのみ）</Eyebrow>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {squad.filter(r => r.id !== sel.ace).map(r => {
              const role = sel.roles[r.id] || "lead";
              const mismatch = (role === "mountain" || role === "flat") && TYPE_ROLE_FIT[role] && !TYPE_ROLE_FIT[role].includes(r.type);
              return (
                <div key={r.id} style={{ background: C.panel, borderRadius: 8, padding: "6px 10px", border: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                    <span style={{ fontFamily: FONT_D, fontSize: 13, color: C.text }}>{r.name}</span>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {roleOptions.map(([k, rl]) => (
                        <button key={k} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, roles: { ...s.sel.roles, [r.id]: k } } }))}
                          title={rl.desc}
                          style={{
                            fontFamily: FONT_D, fontSize: 10.5, fontWeight: 700, padding: "4px 7px", borderRadius: 6, cursor: "pointer",
                            background: role === k ? (k === "breakaway" ? C.red : C.blue) : C.panel2,
                            color: role === k ? "#14171d" : C.sub,
                            border: `1px solid ${role === k ? (k === "breakaway" ? C.red : C.blue) : C.line}`,
                          }}>{rl.label}</button>
                      ))}
                    </div>
                  </div>
                  {mismatch && <div style={{ fontSize: 10, color: C.red, marginTop: 3 }}>⚠ {t_label(r.type)}には不向きな役割（適性ボーナスなし）</div>}
                </div>
              );
            })}
          </div>
        </section>
        <Btn onClick={startNextStage}>{nextStageNo}日目のレースへ →</Btn>
      </div>
    );
  }

  if (g.screen === "gc_final" && g.gc && g.gc.gcOrder) {
    const { gcOrder, idToEntrant, bestRank, prize, pts, jerseyInfo, jerseyBonus } = g.gc;
    const expKeys = [...new Set(g.result.course.segs.map(s => SEG_AB[s.type]))];
    // v13バグ修正: 上位10名までしか一覧に出しておらず、自チームが11位以下だと
    // 総合タイムがどこにも表示されないまま終わっていた。ヘッダーに自チームの
    // 総合タイム（差）を明示し、一覧も全員表示にスクロールで対応する
    const leaderTime = gcOrder[0][1];
    const bestEntry = gcOrder[bestRank - 1];
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.yellow}` }}>
          <Eyebrow>GC FINAL — {g.gc.race.name}</Eyebrow>
          <div style={{ fontSize: 13.5, color: C.text, marginTop: 6 }}>
            総合成績：自チーム最高位 <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 17 }}>{bestRank}位</span>
            {bestEntry && (
              <span style={{ fontFamily: FONT_M, color: C.sub, marginLeft: 8 }}>
                総合タイム {bestRank === 1 ? fmtTime(bestEntry[1]) : fmtGap(bestEntry[1] - leaderTime)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13.5, color: C.green, marginTop: 3 }}>賞金 +{prize}万円{!g.gc.race.championship ? ` ／ ポイント +${pts || 0}pt` : ""}</div>
          {(() => {
            const om = objectiveStatusText(g.gc.objectiveResult);
            if (!om) return null;
            return (
              <div style={{ marginTop: 6, fontSize: 13, color: g.gc.objectiveDone ? C.green : C.purple, fontWeight: g.gc.objectiveDone ? 700 : 400 }}>
                {g.gc.objectiveDone ? `🎉 中期目標「${om.icon} ${om.label}」達成！` : `🎯 中期目標「${om.icon} ${om.label}」進捗 ${om.tail}`}
              </div>
            );
          })()}
          <div style={{ marginTop: 6, fontSize: 13, color: bestRank <= 3 ? C.yellow : C.red }}>
            {bestRank <= 3 ? "昇格圏内でフィニッシュ！年度末処理で昇格します" : "昇格ならず…来季に再挑戦"}
          </div>
        </div>
        {jerseyInfo && (
          <div style={{ background: C.panel, borderRadius: 12, padding: 14, borderTop: `4px solid ${"#e8a13c"}` }}>
            <Eyebrow color={"#e8a13c"}>副次クラシフィケーション</Eyebrow>
            <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
              <div style={{ fontSize: 12.5, color: jerseyInfo.pointsLeaderIsPlayer ? C.yellow : C.text }}>
                🟢 ポイント賞：{jerseyInfo.pointsLeaderName || "—"}{jerseyInfo.pointsLeaderIsPlayer && " （自チーム！+50万円）"}
              </div>
              <div style={{ fontSize: 12.5, color: jerseyInfo.komLeaderIsPlayer ? C.yellow : C.text }}>
                🔴 山岳賞：{jerseyInfo.komLeaderName || "—"}{jerseyInfo.komLeaderIsPlayer && " （自チーム！+50万円）"}
              </div>
              <div style={{ fontSize: 12.5, color: jerseyInfo.youthLeaderIsPlayer ? C.yellow : C.text }}>
                ⚪ 新人賞（26歳未満）：{jerseyInfo.youthLeaderName || "該当者なし"}{jerseyInfo.youthLeaderIsPlayer && " （自チーム！+30万円）"}
              </div>
            </div>
            {jerseyBonus > 0 && <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>副次タイトルボーナスとして賞金に+{jerseyBonus}万円を上乗せ済み</div>}
          </div>
        )}
        <div style={{ background: C.panel, borderRadius: 12, padding: "8px 12px", maxHeight: 260, overflowY: "auto" }}>
          {gcOrder.map(([id, t], i) => {
            const e = idToEntrant[id];
            return (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px", fontSize: 12.5, background: e.team === "PLAYER" ? "rgba(255,210,63,0.1)" : "transparent" }}>
                <span style={{ color: e.team === "PLAYER" ? C.yellow : C.text }}><span style={{ fontFamily: FONT_M, display: "inline-block", width: 24 }}>{i + 1}.</span>{e.name}{e.isAce ? " 👑" : ""}{e.isAlumnus ? " 🔀" : ""}</span>
                <span style={{ fontFamily: FONT_M, color: C.sub }}>{i === 0 ? fmtTime(t) : fmtGap(t - gcOrder[0][1])}</span>
              </div>
            );
          })}
        </div>
        <Btn onClick={() => advanceMonth({ starters: g.gc.starters, expKeys, grade: g.gc.race.grade, weather: g.gc.race.weather, raceId: g.gc.race.id, grandTour: !!g.gc.race.grandTour, stageCount: g.gc.race.stageCount })}>翌月へ進む →</Btn>
      </div>
    );
  }


}
