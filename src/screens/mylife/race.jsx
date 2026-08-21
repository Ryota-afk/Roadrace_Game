// mylife.jsx より分割（Step8）：出走〜結果（startlist/race/result/rival_scene/newspaper）
// 第13弾Phase3-B: 新トークン(T/FONT_DOT)へ全面移行。StartListPanel（panels.jsx）とRaceView本体は
// season側と共有／別弾(3-E)の担当のため中身は据え置き、周囲の額縁だけをこの弾で作り直した。
import React from "react";
import { RaceErrorBoundary, RaceView } from "../../components/RaceView.jsx";
import { StartListPanel } from "../../components/panels.jsx";
import { fmtTime } from "../../core/core.js";
import { TYPES } from "../../data/abilities.js";
import { FONT_DOT, T } from "../../data/theme.js";
import { Item, PrimaryBtn, QuietBtn, Screen, Section } from "../../components/kit.jsx";

function resultTitle(rank) {
  return rank === 1 ? "優勝" : rank <= 3 ? "表彰台" : rank <= 10 ? "上位入賞" : "フィニッシュ";
}

const ResultHero = ({ eyebrow, raceName, rank, total, timeStr }) => (
  <div style={{ background: T.color.surface, padding: T.space.lg, marginBottom: T.space.md, textAlign: "center" }}>
    {eyebrow && <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{eyebrow}</div>}
    <div style={{ fontSize: T.size.head, color: T.color.text, margin: `${T.space.xs}px 0 ${T.space.lg}px` }}>{raceName}</div>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: T.space.xs }}>
      <span style={{ fontSize: T.size.display, color: T.color.accent }}>{rank}</span>
      <span style={{ fontSize: T.size.body, color: T.color.sub }}>位 / {total}人中</span>
    </div>
    <div style={{ fontSize: T.size.head, color: rank === 1 ? T.color.good : T.color.text, marginTop: T.space.sm }}>{resultTitle(rank)}</div>
    {timeStr && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm }}>{timeStr}</div>}
  </div>
);

// 話者を色ではなく面の濃淡と寄せだけで分ける吹き出し（相手＝surface・左寄せ／自分＝surfaceUp・右寄せ）
const Bubble = ({ mine, name, text }) => (
  <div style={{ background: mine ? T.color.surfaceUp : T.color.surface, padding: T.space.md, marginBottom: T.space.sm }}>
    <div style={{ fontSize: T.size.caption, color: mine ? T.color.accent : T.color.sub, marginBottom: T.space.xs, textAlign: mine ? "right" : "left" }}>{name}</div>
    <div style={{ fontSize: T.size.body, color: T.color.text, lineHeight: 1.7, textAlign: mine ? "right" : "left" }}>{text}</div>
  </div>
);

// 好敵手ブロック。scene（対話イベントあり）は専用画面への導線のみ、dialogue（一問一答なし）は
// その場でVN風に表示——という原則を、色ではなくブロックの中身の出し分けで実現する。
const RivalBlock = ({ outcome, introText, playerName }) => {
  if (!outcome) return null;
  const showScene = !introText && outcome.scene;
  const showInlineVN = !introText && !outcome.scene && outcome.dialogue?.lines;
  return (
    <Section title="好敵手">
      <div style={{ padding: `${T.space.sm}px 0` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
          <span>{outcome.name}</span>
          <span style={{ color: T.color.sub, fontSize: T.size.caption }}>{outcome.rank}位でフィニッシュ</span>
        </div>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>
          {introText || outcome.line || (outcome.beat ? "今回はあなたが上手だった。" : "悔しい結果に終わった。")}
        </div>
        {outcome.promoted && <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: T.space.xs }}>{outcome.promoted}</div>}
        {showScene && (
          <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: T.space.sm, paddingTop: T.space.sm, borderTop: `1px solid ${T.color.rule}` }}>言葉を交わすことができる →</div>
        )}
      </div>
      {showInlineVN && (
        <div style={{ paddingBottom: T.space.sm }}>
          {outcome.dialogue.lines.map((ln, i) => (
            <Bubble key={i} mine={ln.who === "me"} name={ln.who === "me" ? playerName : ln.name} text={ln.text} />
          ))}
        </div>
      )}
    </Section>
  );
};

export function renderMyLifeRaceScreens(ctx) {
  const { ML_MILESTONE_LABEL, ml, mlAdvanceMonth, mlLastRaceFinish, mlRaceFinish, mlResolveRivalScene, mlRivalSceneContinue, mlWrap, setMl } = ctx;

  // ---- 出走表 ----
  if (ml.screen === "mylife_startlist" && ml.result) {
    const { raceMeta } = ml.result;
    const skipWatch = ml.result.teamTT || raceMeta.tmpl.soloTT;
    const startLabel = ml.result.teamTT ? "チームタイムトライアルに挑む" : skipWatch ? "個人タイムトライアルに挑む" : "レースを始める";
    return mlWrap(
      <Screen>
        <div style={{ marginBottom: T.space.lg }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>出走表</div>
          <div style={{ fontSize: T.size.title, marginTop: T.space.xs, lineHeight: 1.3 }}>{raceMeta.name}</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm }}>
            {"★".repeat(raceMeta.grade)}・{TYPES[raceMeta.tmpl.favors].label}が有利
          </div>
        </div>
        <StartListPanel entrants={ml.result.entrants} favors={raceMeta.tmpl.favors} />
        <div style={{ marginTop: T.space.md }}>
          <PrimaryBtn onClick={() => { if (skipWatch) { mlRaceFinish(); } else setMl(s => ({ ...s, screen: "mylife_race" })); }}>{startLabel}</PrimaryBtn>
          <QuietBtn onClick={() => setMl(s => ({ ...s, result: null, screen: "mylife_main" }))}>出走を取りやめる</QuietBtn>
        </div>
      </Screen>
    );
  }

  // ---- LIVE中継 ----
  if (ml.screen === "mylife_race" && ml.result) return mlWrap(
    <Screen>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: T.space.md }}>
        <span style={{ fontSize: T.size.head }}>{ml.result.raceMeta.name}</span>
        <span style={{ fontSize: T.size.caption, color: T.color.accent, flex: "none", marginLeft: T.space.sm }}>{ml.inLastRace ? "引退レース" : "中継"}</span>
      </div>
      <RaceErrorBoundary onRecover={ml.inLastRace ? mlLastRaceFinish : mlRaceFinish}>
        <RaceView sim={ml.result} onFinish={ml.inLastRace ? mlLastRaceFinish : mlRaceFinish} />
      </RaceErrorBoundary>
      <div style={{ marginTop: T.space.sm, fontSize: T.size.caption, color: T.color.sub }}>● 印があなた</div>
    </Screen>
  );

  // ---- 結果：チームタイムトライアル ----
  if (ml.screen === "mylife_result" && ml.resultInfo && ml.resultInfo.teamTT) {
    const { race, totalTeams, pts, prize, teamStandings, wpGain, worldRank, worldRankPrev } = ml.resultInfo;
    const myTeam = teamStandings.find(t => t.isPlayer);
    const rank = myTeam ? myTeam.rank : 1;
    const timeStr = myTeam ? (myTeam.rank === 1 ? fmtTime(myTeam.time) : `+${fmtTime(myTeam.gap)}`) : null;
    return mlWrap(
      <Screen>
        <ResultHero eyebrow="チームタイムトライアル" raceName={race.name} rank={rank} total={totalTeams} timeStr={timeStr} />
        <Section title="この一戦の成果">
          <Item first label="獲得ポイント" value={`+${pts}pt`} valueColor={T.color.accent} />
          <Item label="賞金" value={`+${prize}万円`} valueColor={T.color.accent} />
          {worldRank != null && (
            <Item label="世界ランキング" value={`${worldRank}位`} valueColor={worldRank < worldRankPrev ? T.color.good : T.color.text}
              detail={`${worldRankPrev}位から${worldRank < worldRankPrev ? "上昇" : "後退"}——ランキングpt +${wpGain}`}
              detailColor={worldRank < worldRankPrev ? T.color.good : T.color.sub} />
          )}
        </Section>
        <Section title="チーム順位表">
          {teamStandings.map((t, i) => (
            <div key={t.rank} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: T.space.sm, fontSize: T.size.body }}>
                <span style={{ width: 22, flex: "none", textAlign: "right", color: t.isPlayer ? T.color.accent : T.color.sub }}>{t.rank}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t.isPlayer ? T.color.accent : T.color.text }}>{t.name}</span>
                <span style={{ flex: "none", width: 56, textAlign: "right", color: t.rank === 1 ? T.color.good : T.color.sub }}>{t.rank === 1 ? "TOP" : `+${fmtTime(t.gap)}`}</span>
              </div>
              {t.riders && t.riders.length > 0 && (
                <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2, marginLeft: 30, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.riders.join("・")}</div>
              )}
            </div>
          ))}
        </Section>
        <PrimaryBtn onClick={() => mlAdvanceMonth("race")}>翌月へ進む</PrimaryBtn>
      </Screen>
    );
  }

  // ---- 結果：通常 ----
  if (ml.screen === "mylife_result" && ml.resultInfo) {
    const { race, rank, total, pts, directive, fulfilled, evalDelta, prize, rivalOutcome, rivalOutcome2, rival2Intro, popGain, popBonus,
      courseRecord, natRole, natFulfilled, natPopBonus, wpGain, worldRank, worldRankPrev, ambitionCleared, assistOutcome, finishTime, gapSec,
      forecast, newspaper, standings } = ml.resultInfo;
    const eyebrow = race.milestone ? ML_MILESTONE_LABEL[race.milestone].eyebrow : race.monument ? "モニュメント" : null;
    const timeStr = finishTime != null ? (rank === 1 ? fmtTime(finishTime) : `トップ +${fmtTime(gapSec)}`) : null;
    const beatForecast = forecast && rank < forecast.rank - 1;
    const worldRankUp = worldRank != null && worldRankPrev != null && worldRank < worldRankPrev;
    const hasAmbitionOrDirective = ambitionCleared || directive || natRole || assistOutcome;

    return mlWrap(
      <Screen>
        <ResultHero eyebrow={eyebrow} raceName={race.name} rank={rank} total={total} timeStr={timeStr} />

        <Section title="この一戦の成果">
          <Item first label="獲得ポイント" value={`+${pts}pt`} valueColor={T.color.accent} />
          <Item label="賞金" value={`+${prize}万円`} valueColor={T.color.accent} />
          {forecast && (
            <Item label="下馬評" value={`${forecast.mark}（${forecast.rank}番手予想）`}
              detail={`実際は${rank}位${beatForecast ? "——予想を上回る快走" : rank > forecast.rank ? "——下馬評を下回る" : ""}`}
              detailColor={beatForecast ? T.color.good : rank > forecast.rank ? T.color.bad : T.color.sub} />
          )}
          {popGain > 0 && (
            <Item label="人気度" value={`+${popGain}`} valueColor={T.color.accent}
              detail={popBonus > 0 ? `個人スポンサー契約ボーナス +${popBonus}万円` : null} detailColor={T.color.accent} />
          )}
          {courseRecord && courseRecord.isNew && (
            <Item label={`${courseRecord.kind} コースレコード`} value={courseRecord.speed}
              valueColor={courseRecord.isPlayer ? T.color.good : T.color.text}
              detail={courseRecord.isPlayer ? "あなたが樹立" : `${courseRecord.holder}が樹立`}
              detailColor={courseRecord.isPlayer ? T.color.good : T.color.sub} />
          )}
          {worldRank != null && (
            <Item label="世界ランキング" value={`${worldRank}位`} valueColor={worldRankUp ? T.color.good : T.color.text}
              detail={`${worldRankPrev ?? "—"}位から${worldRankUp ? "上昇" : "後退"}——ランキングpt +${wpGain}`}
              detailColor={worldRankUp ? T.color.good : T.color.sub} />
          )}
        </Section>

        {hasAmbitionOrDirective && (
          <Section title="評価">
            {ambitionCleared && (
              <Item first label="目標達成" value={ambitionCleared.label} valueColor={T.color.accent} detail={ambitionCleared.rewardText} detailColor={T.color.accent} />
            )}
            {directive && (
              <Item first={!ambitionCleared} label="監督指示" value={fulfilled ? "達成" : "未達成"} valueColor={fulfilled ? T.color.good : T.color.bad}
                detail={`${directive.label}（監督評価 ${evalDelta >= 0 ? "+" : ""}${evalDelta}）`} />
            )}
            {natRole && (
              <Item first={!ambitionCleared && !directive} label={`代表の役割（${natRole === "ace" ? "エース" : "アシスト"}）`}
                value={natFulfilled ? "達成" : "未達"} valueColor={natFulfilled ? T.color.good : T.color.bad}
                detail={natFulfilled ? `名声が高まった（人気度 +${natPopBonus}）` : "悔しい結果に終わった。"} />
            )}
            {assistOutcome && (
              <Item first={!ambitionCleared && !directive && !natRole} label="献身のアシスト"
                value={assistOutcome.success ? "成功" : "力及ばず"} valueColor={assistOutcome.success ? T.color.good : T.color.bad}
                detail={assistOutcome.success
                  ? `エース${assistOutcome.name}を${assistOutcome.rank === 1 ? "優勝" : "表彰台"}に導いた`
                  : `最後まで${assistOutcome.name}を牽引したが届かなかった`} />
            )}
          </Section>
        )}

        <RivalBlock outcome={rivalOutcome} playerName={ml.player.name} />
        <RivalBlock outcome={rivalOutcome2} introText={rival2Intro ? `${rivalOutcome2.name}という選手と初めて同じレースで走った。${rivalOutcome2.rank}位でフィニッシュした彼／彼女は、これから長く意識する存在になりそうだ。` : null} playerName={ml.player.name} />

        {standings && standings.length > 0 && (
          <>
            <div onClick={() => setMl(s => ({ ...s, resultTableOpen: !s.resultTableOpen }))}
              style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>
              <span>全順位表（{standings.length}名）</span>
              <span style={{ color: T.color.accent }}>{ml.resultTableOpen ? "閉じる ▴" : "開く ▾"}</span>
            </div>
            {ml.resultTableOpen && (
              <div style={{ background: T.color.surface, padding: `0 ${T.space.md}px`, marginBottom: T.space.md, maxHeight: 340, overflowY: "auto" }}>
                {standings.map((r, i) => {
                  const tag = r.isPlayer ? "あなた" : r.isRival ? "好敵手" : r.isMyTeam ? "チーム" : r.isAce ? "エース" : null;
                  return (
                    <div key={r.rank} style={{ display: "flex", alignItems: "baseline", gap: T.space.sm, fontSize: T.size.body, padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                      <span style={{ width: 22, flex: "none", textAlign: "right", color: r.isPlayer ? T.color.accent : T.color.sub }}>{r.rank}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: r.isPlayer ? T.color.accent : T.color.text }}>
                        {r.name}{tag && <span style={{ color: T.color.sub, fontSize: T.size.caption }}> ({tag})</span>}
                      </span>
                      <span style={{ flex: "none", width: 96, fontSize: T.size.caption, color: T.color.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.team}</span>
                      <span style={{ flex: "none", width: 52, textAlign: "right", color: r.gap === 0 || r.gap == null ? T.color.good : T.color.sub }}>{r.rank === 1 ? "TOP" : r.gap == null ? "—" : `+${fmtTime(r.gap)}`}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {(ml.rivalDramaOn !== false && rivalOutcome && rivalOutcome.scene)
          ? <PrimaryBtn onClick={() => setMl(s => ({ ...s, rivalSceneReply: null, screen: "mylife_rival_scene" }))}>好敵手と言葉を交わす →</PrimaryBtn>
          : newspaper
            ? <PrimaryBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_newspaper" }))}>号外が届いた →</PrimaryBtn>
            : <PrimaryBtn onClick={() => mlAdvanceMonth("race")}>翌月へ進む →</PrimaryBtn>}
      </Screen>
    );
  }

  // ---- ライバル対話 ----
  if (ml.screen === "mylife_rival_scene" && ml.resultInfo?.rivalOutcome?.scene) {
    const sc = ml.resultInfo.rivalOutcome.scene;
    const oc = ml.resultInfo.rivalOutcome;
    const reply = ml.rivalSceneReply;
    return mlWrap(
      <Screen>
        <div style={{ marginBottom: T.space.lg }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>好敵手との一幕</div>
          <div style={{ fontSize: T.size.title, marginTop: T.space.xs }}>{oc.name}</div>
          {(sc.persLabel || sc.recordLine) && (
            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>
              {sc.persLabel}{sc.persLabel && sc.recordLine ? "・" : ""}{sc.recordLine}
            </div>
          )}
        </div>
        {sc.situation && (
          <div style={{ fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.8, marginBottom: T.space.md, paddingLeft: T.space.md, borderLeft: `2px solid ${T.color.rule}` }}>{sc.situation}</div>
        )}
        <Bubble name={sc.opening.name} text={sc.opening.text} />
        {reply && <Bubble mine name={ml.player.name} text={reply.playerLine} />}
        {reply && <Bubble name={reply.reply.name} text={reply.reply.text} />}
        {!reply ? (
          <>
            <div style={{ fontSize: T.size.caption, color: T.color.sub, textAlign: "center", margin: `${T.space.lg}px 0 ${T.space.sm}px` }}>どう返す</div>
            {sc.responses.map((r, i) => r.tone === "fire"
              ? <PrimaryBtn key={i} onClick={() => mlResolveRivalScene(i)}>{r.label}</PrimaryBtn>
              : <QuietBtn key={i} onClick={() => mlResolveRivalScene(i)}>{r.label}</QuietBtn>)}
          </>
        ) : (
          <>
            {(() => {
              const e = reply.effects || {};
              const rows = [];
              if (e.mentalDelta) rows.push(["メンタル", e.mentalDelta, T.color.good]);
              if (e.popularityDelta) rows.push(["人気度", e.popularityDelta, T.color.accent]);
              if (e.heatDelta) rows.push(["因縁", e.heatDelta, T.color.accent]);
              return rows.length > 0 && (
                <div style={{ background: T.color.surface, padding: `0 ${T.space.md}px`, margin: `${T.space.md}px 0` }}>
                  {rows.map(([k, v, c], i) => <Item key={k} first={i === 0} label={k} value={`${v >= 0 ? "+" : ""}${v}`} valueColor={c} />)}
                </div>
              );
            })()}
            <PrimaryBtn onClick={mlRivalSceneContinue}>{ml.resultInfo.newspaper ? "号外が届いた →" : "続ける →"}</PrimaryBtn>
          </>
        )}
      </Screen>
    );
  }

  // ---- 号外 ----
  if (ml.screen === "mylife_newspaper" && ml.resultInfo?.newspaper) {
    const np = ml.resultInfo.newspaper;
    const paper = "#EDE9DF", ink = "#1A1A1A", subInk = "#5A574F";
    return mlWrap(
      <Screen>
        <div style={{ background: paper, color: ink, padding: T.space.lg, marginBottom: T.space.md }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `3px double ${ink}`, paddingBottom: T.space.sm }}>
            <span style={{ fontSize: T.size.head, letterSpacing: 1 }}>{np.masthead}</span>
            <span style={{ fontSize: T.size.caption, color: subInk }}>{np.date}</span>
          </div>
          <div style={{ fontSize: T.size.caption, color: subInk, marginTop: T.space.md }}>{np.tag}</div>
          <div style={{ fontSize: T.size.title, lineHeight: 1.35, marginTop: T.space.xs }}>{np.headline}</div>
          <div style={{ fontSize: T.size.body, color: subInk, marginTop: T.space.sm }}>{np.sub}</div>
          <div style={{ background: "#D9D4C6", height: 96, margin: `${T.space.md}px 0 ${T.space.xs}px` }} />
          <div style={{ fontSize: T.size.caption, color: subInk, marginBottom: T.space.md }}>{np.photo}</div>
          <div style={{ fontSize: T.size.body, lineHeight: 1.9, textAlign: "justify" }}>{np.body}</div>
        </div>
        <PrimaryBtn onClick={() => mlAdvanceMonth("race")}>読み終えて翌月へ進む</PrimaryBtn>
      </Screen>
    );
  }
}
