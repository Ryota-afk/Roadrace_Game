// season.jsx より分割（Step8）：出走〜結果〜GC（startlist/lineup/race/result/gc_stage/gc_role_setup/gc_final）
// 第13弾Phase3-E：kit.jsxへ全面移行。lineupの出走人数・役割・作戦はChipRow、メンバー選択は
// RiderCard（選択=action・故障中=bad）。結果画面は「言葉が主役」（優勝/順位をdisplay 28pxに）で
// 全行表示（スクロールボックス廃止）。👑→エース／🔀→OB／ジャージ🟢🔴⚪→色チップ。
// 詳細はdevlog/wave13.md参照。
import React from "react";
import { RaceErrorBoundary, RaceView } from "../../components/RaceView.jsx";
import { AbilityGrid, ElevationChart, MultiStageCourseView, StartListPanel, TraitLine } from "../../components/panels.jsx";
import { ChipRow, Item, PrimaryBtn, QuietBtn, Section, SelectRow, TypeChip } from "../../components/kit.jsx";
import { RiderCard } from "../../components/riderCard.jsx";
import { fmtGap, fmtTime, overall } from "../../core/core.js";
import { AB_LABEL, TYPES, TYPE_ROLE_FIT } from "../../data/abilities.js";
import { CHASE_MODES, ROLES, SEG_AB, SEG_COLOR } from "../../data/course.js";
import { FONT_DOT, T } from "../../data/theme.js";
import { DISCIPLINES, FAVORS_TO_DISCIPLINE, WEATHER, disciplineScore, groupModeFor, objectiveStatusText, t_label } from "../../logic/support.js";
import { effAbilities, generateCourse } from "../../sim/race.js";

export function renderSeasonRaceScreens(ctx) {
  const { advanceMonth, g, growthCap, healthy, raceFinishHandler, setG, startNextStage, startRace, wrap } = ctx;
  if (g.screen === "startlist") {
    const race = g.races.find(r => r.id === g.sel.raceId);
    const playerEntrants = g.roster.filter(r => (g.sel.starters || []).includes(r.id))
      .map(r => {
        // v34(UI): 下馬評用に自チーム選手も実効能力を持たせる（AIと同じeffAbilitiesで公平に比較）
        const meta = { id: r.id, name: r.name, type: r.type, teamName: g.teamName || "あなたのチーム", color: T.color.accent, team: "PLAYER", isAce: r.id === g.sel.ace };
        return race ? { ...effAbilities(r, g.equip, {}, race.grade, race.weather, race.monument), ...meta } : meta;
      });
    const aiEntrants = (g.pendingAiTeams || []).flat();
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Section title="出走表" right={race ? race.name : ""}>
          {playerEntrants.length === 0 && <div style={{ fontSize: T.size.caption, color: T.color.sub }}>まだ自チームの出走メンバーを選んでいません。相手の布陣を見て編成を決めましょう。</div>}
        </Section>
        <StartListPanel entrants={[...playerEntrants, ...aiEntrants]} favors={race && race.tmpl ? race.tmpl.favors : undefined} />
        <QuietBtn onClick={() => setG(s => ({ ...s, screen: "lineup" }))}>← 編成に戻る</QuietBtn>
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
    const tags = [
      race.championship && "チャンピオンシップ", race.grandTour && "グランツール", race.sponsorMandate && "スポンサー指定レース",
    ].filter(Boolean);
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Section title="出走準備" right={"★".repeat(race.grade)}>
          <div style={{ fontSize: T.size.title, color: T.color.text }}>{race.name}</div>
          {tags.length > 0 && <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: 2 }}>{tags.join("・")}</div>}
          {race.weather && race.weather !== "clear" && (
            <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: T.space.xs }}>
              {WEATHER[race.weather].label}：{race.weather === "rain" ? "悪天候巧者以外は能力低下・落車リスク増" : "出走後の疲労蓄積が増える"}
            </div>
          )}
          {!race.stageRace && (
            <div style={{ display: "flex", gap: 3, margin: `${T.space.sm}px 0 ${T.space.xs}px` }}>
              {race.tmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 5, background: SEG_COLOR[s[0]] }} />)}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: T.space.xs }}>
            <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{race.stageRace && race.stageTmpls ? "日替わりコース" : race.tmpl.kind}・<span style={{ color: T.color.accent }}>出走{N}名</span></span>
            <TypeChip type={race.tmpl.favors} label={`${TYPES[race.tmpl.favors].label}有利`} />
          </div>
          {squadChoices.length > 1 && (
            <div style={{ marginTop: T.space.sm }}>
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.xs }}>出走人数（少ないほど疲労を温存でき、多いほど作戦の幅が広がる）</div>
              <ChipRow value={N} onChange={setSquadN} options={squadChoices.map(n => ({ value: n, label: `${n}名`, disabled: healthy.length < n }))} />
            </div>
          )}
          <div style={{ marginTop: T.space.sm }}>
            {race.stageRace ? <MultiStageCourseView race={race} /> : <ElevationChart course={previewCourse} />}
          </div>
        </Section>
        <Section title="出走メンバー" right={`${sel.starters.length}/${N}名`}>
          {g.roster.map((r, i) => {
            const dis = r.injury > 0;
            const on = sel.starters.includes(r.id);
            const fitKey = FAVORS_TO_DISCIPLINE[race.tmpl.favors];
            const fitScore = disciplineScore(r, fitKey);
            return (
              <RiderCard key={r.id} r={r} first={i === 0} ovr={overall(r)}
                selected={on} disabled={dis} onClick={() => toggle(r.id)}
                sub={`${DISCIPLINES[fitKey].label}適性${fitScore}`}
                cond={r.cond} fatigue={r.fatigue}>
                {dis && <div style={{ fontSize: T.size.caption, color: T.color.bad, marginBottom: T.space.xs }}>故障中</div>}
                {!dis && r.streak >= 1 && <div style={{ fontSize: T.size.caption, color: r.streak >= 2 ? T.color.bad : T.color.accent, marginBottom: T.space.xs }}>連闘{r.streak}{r.streak >= 2 ? "（出すと故障）" : ""}</div>}
                <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                <AbilityGrid r={r} cap={growthCap} />
              </RiderCard>
            );
          })}
        </Section>
        {sel.starters.length === N && N > 1 && (
          <Section title="エース指名" right={`残り${N - 1}名がエースを支える`}>
            {g.roster.filter(r => sel.starters.includes(r.id)).map((r, i) => (
              <SelectRow key={r.id} first={i === 0} label={r.name} selected={sel.ace === r.id}
                onClick={() => setG(s => ({ ...s, sel: { ...s.sel, ace: r.id } }))} />
            ))}
          </Section>
        )}
        {sel.starters.length === N && (N === 1 || sel.ace) && groupMode !== "solo" && (
          <Section title="役割指定" right="エースを支える残りのメンバーのみ">
            {g.roster.filter(r => sel.starters.includes(r.id) && r.id !== sel.ace).map((r, i) => {
              const role = sel.roles[r.id] || "lead";
              const mismatch = (role === "mountain" || role === "flat") && TYPE_ROLE_FIT[role] && !TYPE_ROLE_FIT[role].includes(r.type);
              return (
                <div key={r.id} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                  <div style={{ fontSize: T.size.body, color: T.color.text, marginBottom: T.space.xs }}>{r.name}</div>
                  <ChipRow value={role} onChange={k => setG(s => ({ ...s, sel: { ...s.sel, roles: { ...s.sel.roles, [r.id]: k } } }))}
                    options={roleOptions.map(([k, rl]) => ({ value: k, label: rl.label }))} />
                  {mismatch && <div style={{ fontSize: T.size.caption, color: T.color.bad, marginTop: T.space.xs }}>{t_label(r.type)}には不向きな役割（適性ボーナスなし）</div>}
                </div>
              );
            })}
          </Section>
        )}
        {ready && N > 1 && (
          <Section title="作戦" right="レース全体で1つ選択">
            <ChipRow value={sel.chaseMode || "normal"} onChange={k => setG(s => ({ ...s, sel: { ...s.sel, chaseMode: k } }))}
              options={["normal", "push", "hold"].map(k => ({ value: k, label: CHASE_MODES[k].label }))} />
            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm }}>{CHASE_MODES[sel.chaseMode || "normal"].desc}</div>
            <div style={{ marginTop: T.space.sm }}>
              <QuietBtn color={sel.aceEarly ? T.color.action : T.color.sub} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, aceEarly: !s.sel.aceEarly } }))}>
                {CHASE_MODES.ace_early.label}{sel.aceEarly ? "・選択中" : ""}
              </QuietBtn>
            </div>
            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: -T.space.xs }}>{CHASE_MODES.ace_early.desc}</div>
          </Section>
        )}
        {ready && (g.inv.wheel > 0 || g.inv.suit > 0) && (
          <Section title="決戦機材">
            {g.inv.wheel > 0 && <QuietBtn color={sel.useWheel ? T.color.action : T.color.sub} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, useWheel: !s.sel.useWheel } }))}>決戦ホイール（登坂+15%）{sel.useWheel ? "・使用する" : ""}</QuietBtn>}
            {g.inv.suit > 0 && <QuietBtn color={sel.useSuit ? T.color.action : T.color.sub} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, useSuit: !s.sel.useSuit } }))}>エアロスーツ（平坦+15%）{sel.useSuit ? "・使用する" : ""}</QuietBtn>}
          </Section>
        )}
        {ready && (() => {
          // 第17弾C: 機材セットアップ（無料・出走メンバー全員に一律）。天候対応チップは該当天候の時だけ表示
          const setupOptions = [
            { value: "std", label: "標準" },
            { value: "light", label: "軽量仕様" },
            { value: "aero", label: "エアロ仕様" },
          ];
          if (race.weather === "rain") setupOptions.push({ value: "rain", label: "雨仕様" });
          if (race.weather === "heat") setupOptions.push({ value: "cool", label: "冷却仕様" });
          return (
            <Section title="機材セットアップ" right="出走メンバー全員に適用">
              <ChipRow value={sel.setup || "std"} onChange={k => setG(s => ({ ...s, sel: { ...s.sel, setup: k } }))} options={setupOptions} />
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm }}>
                {sel.setup === "light" ? "登坂に強いが平坦がやや落ちる"
                  : sel.setup === "aero" ? "平坦に強いが登坂がやや落ちる"
                  : sel.setup === "rain" ? "雨のペナルティを緩和し落車率も下げるが、地形の得意分野は伸びない"
                  : sel.setup === "cool" ? "猛暑による疲労蓄積を抑える"
                  : "地形・天候に左右されない万能仕様"}
              </div>
            </Section>
          );
        })()}
        <div style={{ display: "grid", gap: T.space.sm }}>
          {g.pendingAiTeams && <QuietBtn onClick={() => setG(s => ({ ...s, screen: "startlist" }))}>出走表（他チームの布陣）を見る</QuietBtn>}
          <PrimaryBtn disabled={!ready} onClick={() => startRace(true)}>観戦しながらスタート</PrimaryBtn>
          <QuietBtn disabled={!ready} onClick={() => startRace(false)}>結果だけ見る（スキップ）</QuietBtn>
          <QuietBtn onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</QuietBtn>
        </div>
      </div>
    );
  }

  if (g.screen === "race" && g.result) return wrap(
    <div>
      <div style={{ marginBottom: T.space.sm, fontSize: T.size.caption, color: T.color.bad }}>
        LIVE — {g.result.raceMeta.name}{g.result.raceMeta.stageRace ? `（${g.gc.stage}日目）` : ""}
      </div>
      <RaceErrorBoundary onRecover={raceFinishHandler}>
        <RaceView sim={g.result} onFinish={raceFinishHandler} />
      </RaceErrorBoundary>
    </div>
  );

  if (g.screen === "result_pending") return wrap(<div style={{ color: T.color.sub, fontSize: T.size.body }}>結果集計中…</div>);

  // v35(チームTT): チームTT専用の結果画面（チーム順位＝合算タイムで並べる）
  if (g.screen === "result" && g.result && g.prizeInfo && g.prizeInfo.teamTT) {
    const { race, prize, pts, teamTT, teamRank, totalTeams, mandateHit } = g.prizeInfo;
    const winner = teamTT[0];
    const om = objectiveStatusText(g.prizeInfo.objectiveResult);
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <div style={{ textAlign: "center", padding: `${T.space.lg}px 0` }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{race.name}（チームTT）</div>
          <div style={{ fontSize: T.size.display, color: winner.isPlayer ? T.color.accent : T.color.text }}>
            {winner.isPlayer ? `${winner.teamName}、優勝` : `自チーム ${teamRank}位`}
          </div>
          {!winner.isPlayer && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>優勝：{winner.teamName}</div>}
        </div>
        <Section title="獲得">
          <Item first label="自チーム順位" value={`${teamRank} / ${totalTeams}チーム`} />
          <Item label="タイム" value={teamRank === 1 ? fmtTime(winner.time) : fmtGap((teamTT.find(t => t.isPlayer) || {}).time - winner.time)} />
          <Item label="賞金" value={`+${prize}万円`} />
          {!race.championship && <Item label="チームポイント" value={`+${pts}pt`} detail={mandateHit ? "指定レースボーナス込み" : undefined} />}
          {om && <Item label={`中期目標「${om.label}」`} value={g.prizeInfo.objectiveDone ? "達成" : `進捗 ${om.tail}`} valueColor={g.prizeInfo.objectiveDone ? T.color.good : undefined} />}
        </Section>
        <Section title="チーム順位" right={`出走${totalTeams}チーム`}>
          {teamTT.map((t, i) => (
            <div key={t.team} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: T.space.sm, padding: `${T.space.xs}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: T.space.sm, minWidth: 0 }}>
                <span style={{ fontSize: T.size.label, color: t.isPlayer ? T.color.accent : T.color.sub, width: 22, textAlign: "right", flex: "none", fontVariantNumeric: "tabular-nums" }}>{t.rank}</span>
                <span style={{ width: 10, height: 10, background: t.color, flex: "none" }} />
                <span style={{ fontSize: T.size.head, color: t.isPlayer ? T.color.accent : T.color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.teamName}{t.isPlayer ? "（自チーム）" : ""}</span>
              </span>
              <span style={{ fontFamily: FONT_DOT, fontSize: T.size.label, color: t.isPlayer ? T.color.accent : T.color.sub, flex: "none" }}>{t.rank === 1 ? fmtTime(t.time) : fmtGap(t.time - winner.time)}</span>
            </div>
          ))}
        </Section>
        <PrimaryBtn onClick={() => { const expKeys = [...new Set(g.result.course.segs.map(s => SEG_AB[s.type]))]; advanceMonth({ starters: g.sel.starters, expKeys, grade: race.grade, weather: race.weather, raceId: g.sel.raceId, setup: g.sel.setup }); }}>翌月へ進む</PrimaryBtn>
      </div>
    );
  }
  if (g.screen === "result" && g.result && g.prizeInfo) {
    const { race, prize, pts, best, mandateHit, breakSurvived, hadBreak, courseRecord } = g.prizeInfo;
    const res = g.result;
    const expKeys = [...new Set(res.course.segs.map(s => SEG_AB[s.type]))];
    const winnerIsPlayer = res.ranked[0].team === "PLAYER";
    const om = objectiveStatusText(g.prizeInfo.objectiveResult);
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <div style={{ textAlign: "center", padding: `${T.space.lg}px 0` }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{race.name}</div>
          <div style={{ fontSize: T.size.display, color: winnerIsPlayer ? T.color.accent : T.color.text }}>
            {winnerIsPlayer ? `${res.ranked[0].name}、優勝` : `自チーム最高 ${best.rank}位`}
          </div>
          {!winnerIsPlayer && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>優勝：{res.ranked[0].name}（{res.ranked[0].teamName}）</div>}
          {hadBreak && (
            <div style={{ fontSize: T.size.caption, color: breakSurvived ? T.color.accent : T.color.sub, marginTop: T.space.xs }}>
              {breakSurvived ? "逃げ切り成功——逃げ集団内でのスプリント決着" : "メイン集団に吸収され、ゴールスプリント決着"}
            </div>
          )}
          {race.championship && (
            <div style={{ fontSize: T.size.body, color: best.rank <= 3 ? T.color.good : T.color.bad, marginTop: T.space.sm }}>
              {g.classIdx === 2 && best.rank === 1 ? "グランファイナル制覇！！" : best.rank <= 3 ? "昇格圏内でフィニッシュ！年度末処理で昇格します" : "昇格ならず…来季に再挑戦"}
            </div>
          )}
        </div>
        <Section title="獲得">
          <Item first label="自チーム最高位" value={`${best.rank}位`} detail={best.name} />
          <Item label="賞金" value={`+${prize}万円`} />
          {!race.championship && <Item label="チームポイント" value={`+${pts}pt`} detail={mandateHit ? "指定レースボーナス込み" : undefined} />}
          <Item label="出走経験" value={expKeys.map(k => AB_LABEL[k]).join("・")} detail="が成長" />
          {courseRecord && courseRecord.isNew && (
            // 第60弾(devlog/wave60.md): 内部指標(speed)の生値ではなく、誰でも読めるタイムを表示する
            <Item label={`${courseRecord.kind}のコースレコード`} value="更新！" valueColor={T.color.accent}
              detail={`記録タイム${fmtTime(courseRecord.timeSec)}／達成：${courseRecord.holder}${courseRecord.isPlayer ? "・自チーム" : ""}`} />
          )}
          {om && <Item label={`中期目標「${om.label}」`} value={g.prizeInfo.objectiveDone ? "達成" : `進捗 ${om.tail}`} valueColor={g.prizeInfo.objectiveDone ? T.color.good : undefined} />}
        </Section>
        <Section title="最終順位" right={`出走${res.ranked.length}名`}>
          {res.ranked.map((e, i) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: T.space.sm, padding: `${T.space.xs}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: T.space.sm, minWidth: 0 }}>
                <span style={{ fontSize: T.size.label, color: e.team === "PLAYER" ? T.color.accent : T.color.sub, width: 22, textAlign: "right", flex: "none", fontVariantNumeric: "tabular-nums" }}>{e.rank}</span>
                <span style={{ fontSize: T.size.head, color: e.team === "PLAYER" ? T.color.accent : T.color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.name}{e.isAce ? "・エース" : ""}{e.isAlumnus ? "・OB" : ""}
                </span>
                <span style={{ fontSize: T.size.micro, color: T.color.sub, flex: "none" }}>{e.teamName}</span>
              </span>
              <span style={{ fontFamily: FONT_DOT, fontSize: T.size.label, color: e.team === "PLAYER" ? T.color.accent : T.color.sub, flex: "none" }}>{e.rank === 1 ? fmtTime(e.finishTime) : fmtGap(e.finishTime - res.ranked[0].finishTime)}</span>
            </div>
          ))}
        </Section>
        <PrimaryBtn onClick={() => advanceMonth({ starters: g.sel.starters, expKeys, grade: race.grade, weather: race.weather, raceId: g.sel.raceId, grandTour: !!race.grandTour, stageCount: race.stageCount, setup: g.sel.setup })}>翌月へ進む</PrimaryBtn>
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
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Section title={`第${stageNo}日 完了`} right={g.gc.race.name}>
          <Item first label={`${stageNo}日目 自チーム最高位`} value={`${bestIdx + 1}位`} />
          <Item label="総合成績 自チーム最高"
            value={`${gcBestIdx + 1}位`}
            detail={gcBestIdx >= 0 ? (gcBestIdx === 0 ? fmtTime(gcOrderSoFar[0][1]) : fmtGap(gcOrderSoFar[gcBestIdx][1] - gcOrderSoFar[0][1])) : undefined} />
        </Section>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: -T.space.sm }}>総合成績は{totalStages}日目終了後に確定します。まずは休息・疲労回復（-20）をしてから{stageNo + 1}日目へ。</div>
        <Section title="総合順位" right={`${stageNo}日目終了時点`}>
          {gcOrderSoFar.map(([id, t], i) => {
            const e = idToEntrant[id];
            return (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: T.space.sm, padding: `${T.space.xs}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: T.space.sm, minWidth: 0 }}>
                  <span style={{ fontSize: T.size.label, color: e.team === "PLAYER" ? T.color.accent : T.color.sub, width: 22, textAlign: "right", flex: "none", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                  <span style={{ fontSize: T.size.head, color: e.team === "PLAYER" ? T.color.accent : T.color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}{e.isAce ? "・エース" : ""}{e.isAlumnus ? "・OB" : ""}</span>
                </span>
                <span style={{ fontFamily: FONT_DOT, fontSize: T.size.label, color: e.team === "PLAYER" ? T.color.accent : T.color.sub, flex: "none" }}>{i === 0 ? fmtTime(t) : fmtGap(t - gcOrderSoFar[0][1])}</span>
              </div>
            );
          })}
        </Section>
        <PrimaryBtn onClick={() => {
          // v14.8: 出走1名（solo）は役割自体が存在しないため再設定画面を経由せず直接次日程へ
          if (g.gc.starters.length === 1) startNextStage();
          else setG(s => ({ ...s, screen: "gc_role_setup" }));
        }}>{stageNo + 1}日目へ進む</PrimaryBtn>
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
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Section title={`${nextStageNo}日目に向けて作戦変更`} padded>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>この日だけエース・役割を変更できます（メンバーは変更不可）。</div>
          <div style={{ display: "flex", gap: 3, margin: `0 0 ${T.space.xs}px` }}>
            {dayTmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 5, background: SEG_COLOR[s[0]] }} />)}
          </div>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: T.space.xs }}>
            <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{nextStageNo}日目・{dayTmpl.kind}</span>
            <TypeChip type={dayTmpl.favors} label={`${TYPES[dayTmpl.favors].label}有利`} />
          </div>
          <div style={{ marginTop: T.space.sm }}><ElevationChart course={dayCourse} /></div>
        </Section>
        {/* v14.14: 作戦変更画面でも選手の能力を見た上でエース・役割を決められるよう、
            その日のコース適性（disciplineScore）と能力グリッドを一覧表示する */}
        <Section title="出走メンバーの能力" right={`${nextStageNo}日目のコース適性`}>
          {squad.map((r, i) => {
            const fitKey = FAVORS_TO_DISCIPLINE[dayTmpl.favors];
            const fitScore = disciplineScore(r, fitKey);
            return (
              <RiderCard key={r.id} r={r} first={i === 0} ovr={overall(r)} selected={sel.ace === r.id}
                badge={sel.ace === r.id ? "エース" : undefined}
                sub={`${DISCIPLINES[fitKey].label}適性${fitScore}`} cond={r.cond} fatigue={r.fatigue}>
                <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                <AbilityGrid r={r} cap={growthCap} />
              </RiderCard>
            );
          })}
        </Section>
        <Section title="エース指名">
          {squad.map((r, i) => (
            <SelectRow key={r.id} first={i === 0} label={r.name} selected={sel.ace === r.id}
              onClick={() => setG(s => ({ ...s, sel: { ...s.sel, ace: r.id } }))} />
          ))}
        </Section>
        <Section title="役割指定" right="エースを支える残りのメンバーのみ">
          {squad.filter(r => r.id !== sel.ace).map((r, i) => {
            const role = sel.roles[r.id] || "lead";
            const mismatch = (role === "mountain" || role === "flat") && TYPE_ROLE_FIT[role] && !TYPE_ROLE_FIT[role].includes(r.type);
            return (
              <div key={r.id} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <div style={{ fontSize: T.size.body, color: T.color.text, marginBottom: T.space.xs }}>{r.name}</div>
                <ChipRow value={role} onChange={k => setG(s => ({ ...s, sel: { ...s.sel, roles: { ...s.sel.roles, [r.id]: k } } }))}
                  options={roleOptions.map(([k, rl]) => ({ value: k, label: rl.label }))} />
                {mismatch && <div style={{ fontSize: T.size.caption, color: T.color.bad, marginTop: T.space.xs }}>{t_label(r.type)}には不向きな役割（適性ボーナスなし）</div>}
              </div>
            );
          })}
        </Section>
        <PrimaryBtn onClick={startNextStage}>{nextStageNo}日目のレースへ</PrimaryBtn>
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
    const om = objectiveStatusText(g.gc.objectiveResult);
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <div style={{ textAlign: "center", padding: `${T.space.lg}px 0` }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{g.gc.race.name}</div>
          <div style={{ fontSize: T.size.display, color: bestRank === 1 ? T.color.accent : T.color.text }}>総合 {bestRank}位</div>
          {bestEntry && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>総合タイム {bestRank === 1 ? fmtTime(bestEntry[1]) : fmtGap(bestEntry[1] - leaderTime)}</div>}
          <div style={{ fontSize: T.size.body, color: bestRank <= 3 ? T.color.good : T.color.bad, marginTop: T.space.sm }}>
            {bestRank <= 3 ? "昇格圏内でフィニッシュ！年度末処理で昇格します" : "昇格ならず…来季に再挑戦"}
          </div>
        </div>
        <Section title="獲得">
          <Item first label="賞金" value={`+${prize}万円`} />
          {!g.gc.race.championship && <Item label="ポイント" value={`+${pts || 0}pt`} />}
          {jerseyBonus > 0 && <Item label="副次タイトルボーナス" value={`+${jerseyBonus}万円`} detail="賞金に上乗せ済み" />}
          {om && <Item label={`中期目標「${om.label}」`} value={g.gc.objectiveDone ? "達成" : `進捗 ${om.tail}`} valueColor={g.gc.objectiveDone ? T.color.good : undefined} />}
        </Section>
        {jerseyInfo && (
          <Section title="副次タイトル">
            {[
              { color: "#35c07e", label: "ポイント賞", name: jerseyInfo.pointsLeaderName, isPlayer: jerseyInfo.pointsLeaderIsPlayer, bonus: 50 },
              { color: "#e8544f", label: "山岳賞", name: jerseyInfo.komLeaderName, isPlayer: jerseyInfo.komLeaderIsPlayer, bonus: 50 },
              { color: "#eef1f6", label: "新人賞（26歳未満）", name: jerseyInfo.youthLeaderName, isPlayer: jerseyInfo.youthLeaderIsPlayer, bonus: 30 },
            ].map((row, i) => (
              <div key={row.label} style={{ display: "flex", alignItems: "baseline", gap: T.space.sm, padding: `${T.space.xs}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <span style={{ width: 8, height: 8, background: row.color, flex: "none" }} />
                <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none" }}>{row.label}</span>
                <span style={{ fontSize: T.size.body, color: row.isPlayer ? T.color.accent : T.color.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name || "該当者なし"}</span>
                {row.isPlayer && <span style={{ fontSize: T.size.caption, color: T.color.accent, flex: "none" }}>自チーム！+{row.bonus}万円</span>}
              </div>
            ))}
          </Section>
        )}
        <Section title="総合順位" right={`出走${gcOrder.length}名`}>
          {gcOrder.map(([id, t], i) => {
            const e = idToEntrant[id];
            return (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: T.space.sm, padding: `${T.space.xs}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: T.space.sm, minWidth: 0 }}>
                  <span style={{ fontSize: T.size.label, color: e.team === "PLAYER" ? T.color.accent : T.color.sub, width: 22, textAlign: "right", flex: "none", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                  <span style={{ fontSize: T.size.head, color: e.team === "PLAYER" ? T.color.accent : T.color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}{e.isAce ? "・エース" : ""}{e.isAlumnus ? "・OB" : ""}</span>
                </span>
                <span style={{ fontFamily: FONT_DOT, fontSize: T.size.label, color: e.team === "PLAYER" ? T.color.accent : T.color.sub, flex: "none" }}>{i === 0 ? fmtTime(t) : fmtGap(t - gcOrder[0][1])}</span>
              </div>
            );
          })}
        </Section>
        <PrimaryBtn onClick={() => advanceMonth({ starters: g.gc.starters, expKeys, grade: g.gc.race.grade, weather: g.gc.race.weather, raceId: g.gc.race.id, grandTour: !!g.gc.race.grandTour, stageCount: g.gc.race.stageCount, setup: g.sel.setup })}>翌月へ進む</PrimaryBtn>
      </div>
    );
  }


}
