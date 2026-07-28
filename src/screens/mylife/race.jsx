// mylife.jsx より分割（Step8）：出走〜結果（startlist/race/result/rival_scene/newspaper）
import React from "react";
import { RaceErrorBoundary, RaceView } from "../../components/RaceView.jsx";
import { StartListPanel } from "../../components/panels.jsx";
import { Btn, Eyebrow } from "../../components/ui.jsx";
import { fmtTime } from "../../core/core.js";
import { TYPES } from "../../data/abilities.js";
import { C, FONT_D, FONT_M } from "../../data/theme.js";

export function renderMyLifeRaceScreens(ctx) {
  const { ML_MILESTONE_LABEL, ml, mlAdvanceMonth, mlLastRaceFinish, mlRaceFinish, mlRaceLockRef, mlResolveRivalScene, mlRivalSceneContinue, mlWrap, setMl } = ctx;
    if (ml.screen === "mylife_startlist" && ml.result) return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <Eyebrow color={C.purple}>🏁 出走表 — {ml.result.raceMeta.name}</Eyebrow>
        <div style={{ fontSize: 11.5, color: C.sub }}>{ml.result.raceMeta.tmpl.kind}・{"★".repeat(ml.result.raceMeta.grade)}・{TYPES[ml.result.raceMeta.tmpl.favors].label}有利</div>
        <StartListPanel entrants={ml.result.entrants} favors={ml.result.raceMeta.tmpl.favors} />
        {/* v37: チームTTは集団シミュ（観戦アニメ）が無いため、結果画面へ直行する */}
        <Btn onClick={() => { if (ml.result.teamTT) { mlRaceFinish(); } else setMl(s => ({ ...s, screen: "mylife_race" })); }}>🏁 {ml.result.teamTT ? "チームタイムトライアルに挑む（結果へ）" : "レースを始める"}</Btn>
        <Btn outline color={C.sub} onClick={() => { mlRaceLockRef.current = false; setMl(s => ({ ...s, result: null, screen: "mylife_main" })); }}>← 出走を取りやめる</Btn>
      </div>
    );
    if (ml.screen === "mylife_race" && ml.result) return mlWrap(
      <div>
        <div style={{ marginBottom: 8 }}><Eyebrow color={ml.inLastRace ? "#e8a13c" : C.red}>{ml.inLastRace ? "🏁 LAST RACE — " : "LIVE — "}{ml.result.raceMeta.name}</Eyebrow></div>
        <RaceErrorBoundary onRecover={ml.inLastRace ? mlLastRaceFinish : mlRaceFinish}>
          <RaceView sim={ml.result} onFinish={ml.inLastRace ? mlLastRaceFinish : mlRaceFinish} />
        </RaceErrorBoundary>
        <div style={{ marginTop: 8, fontSize: 12, color: C.sub }}>● 印＝あなた。位置が近い選手同士が自然にグループを作ります。</div>
      </div>
    );

    // v37: チームTTの結果画面（チーム順位表：チーム名／合算タイム／秒差／メンバー）。
    if (ml.screen === "mylife_result" && ml.resultInfo && ml.resultInfo.teamTT) {
      const { race, teamRank, totalTeams, pts, prize, teamStandings, wpGain, worldRank, worldRankPrev } = ml.resultInfo;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "#2b2436", borderRadius: 12, padding: 16, borderTop: `4px solid ${teamRank === 1 ? C.yellow : teamRank <= 3 ? "#e8a13c" : C.blue}` }}>
            <Eyebrow color={C.blue}>🚴‍♂️🚴‍♂️ チームタイムトライアル 結果</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 22, color: C.text, margin: "6px 0 2px" }}>チーム {teamRank}位 <span style={{ fontSize: 13, color: C.sub }}>/ {totalTeams}チーム</span></div>
            <div style={{ fontSize: 12, color: C.sub }}>ポイント +{pts} ／ 賞金 +{prize}万円{wpGain ? ` ／ 世界ランクpt +${wpGain}` : ""}</div>
            {worldRankPrev != null && worldRank != null && worldRank !== worldRankPrev && (
              <div style={{ fontSize: 11.5, color: worldRank < worldRankPrev ? C.green : C.sub, marginTop: 2 }}>🌍 世界ランキング {worldRankPrev ?? "—"}位 → {worldRank}位</div>
            )}
          </div>
          <div style={{ background: C.panel, borderRadius: 10, border: `1px solid ${C.line}`, overflow: "hidden" }}>
            <div style={{ padding: "8px 12px", fontSize: 11, color: C.sub, borderBottom: `1px solid ${C.line}` }}>📋 チーム順位表（合算タイム・トップとの差）</div>
            {teamStandings.map((t) => (
              <div key={t.rank} style={{ padding: "7px 12px", background: t.isPlayer ? "rgba(79,143,232,0.12)" : "transparent", borderBottom: `1px solid ${C.bg}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <span style={{ width: 24, textAlign: "right", fontFamily: FONT_M, color: t.rank <= 3 ? C.yellow : C.sub, fontWeight: t.rank <= 3 ? 700 : 400 }}>{t.rank}</span>
                  <span style={{ flex: 1, color: t.isPlayer ? C.blue : C.text, fontWeight: t.isPlayer ? 700 : 400 }}>{t.isPlayer ? "⭐ " : ""}{t.name}</span>
                  <span style={{ fontFamily: FONT_M, fontSize: 12, color: t.gap === 0 ? C.green : C.sub }}>{t.rank === 1 ? fmtTime(t.time) : `+${fmtTime(t.gap)}`}</span>
                </div>
                {t.riders && t.riders.length > 0 && (
                  <div style={{ fontSize: 10, color: C.sub, marginTop: 2, marginLeft: 32, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.riders.join("・")}</div>
                )}
              </div>
            ))}
          </div>
          <Btn onClick={() => mlAdvanceMonth("race")}>翌月へ進む →</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_result" && ml.resultInfo) {
      const { race, rank, total, pts, directive, fulfilled, evalDelta, prize, rivalOutcome, rivalOutcome2, rival2Intro, popGain, popBonus, courseRecord, natRole, natFulfilled, natPopBonus, wpGain, worldRank, worldRankPrev, ambitionCleared, assistOutcome, finishTime, gapSec, forecast, newspaper, standings } = ml.resultInfo;
      // v36(#6): 性格ベースの会話ドラマ（紙芝居/VN風）。ml.rivalDramaOn===false でオフにできる。
      const vnScene = (dlg) => (ml.rivalDramaOn !== false && dlg && dlg.lines) ? (
        <div style={{ marginTop: 8, display: "grid", gap: 6, borderTop: `1px dashed ${C.line}`, paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: C.sub }}>🎭 {dlg.persLabel ? `${dlg.persLabel}な` : ""}{dlg.tierLabel}との一幕</div>
          {dlg.lines.map((ln, i) => (
            <div key={i} style={{ display: "flex", justifyContent: ln.who === "me" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "86%", background: ln.who === "me" ? "rgba(79,143,232,0.14)" : "rgba(232,84,79,0.12)", border: `1px solid ${ln.who === "me" ? C.blue : C.red}`, borderRadius: 10, padding: "6px 9px" }}>
                <div style={{ fontSize: 9.5, color: ln.who === "me" ? C.blue : C.red, fontWeight: 700, marginBottom: 1 }}>{ln.who === "me" ? "🚴 " : "🔥 "}{ln.name}</div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.55 }}>{ln.text}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null;
      // v38(改善③④): 結果の感情的ペイオフ。着順に応じて大きく反応するヒーローバナー。
      // 「ただの数字」から「その一戦の記憶に残る瞬間」へ。下馬評を上回れば会心の走りも添える。
      const beatForecast = forecast && rank < forecast.rank - 1;
      const big = race.milestone || race.monument;
      const hero = rank === 1
        ? { icon: "🏆", title: big ? "大舞台を制覇！！" : "優勝！！", sub: "頂点に立った——この一勝がキャリアを彩る。", bg: "linear-gradient(135deg,#3a2f10,#241d0c)", color: "#ffd23f", border: "#ffd23f" }
        : rank <= 3
        ? { icon: rank === 2 ? "🥈" : "🥉", title: `${rank}位・表彰台！`, sub: "あと一歩。だが確かな手応えを掴んだ。", bg: "linear-gradient(135deg,#33291a,#221b12)", color: "#e8a13c", border: "#e8a13c" }
        : rank <= 10
        ? { icon: "👏", title: `${rank}位・上位入賞`, sub: "集団の前で戦えた。着実な一歩。", bg: C.panel, color: C.green, border: C.green }
        : rank <= Math.ceil(total * 0.5)
        ? { icon: "🚴", title: `${rank}位`, sub: "中団でレースを終えた。次へ向けて糧にしたい。", bg: C.panel, color: C.sub, border: C.line }
        : { icon: "💧", title: `${rank}位`, sub: "厳しい一戦。この悔しさを、次の走りにぶつける。", bg: C.panel, color: "#c86", border: "#c86" };
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: hero.bg, borderRadius: 14, padding: "18px 16px", border: `2px solid ${hero.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 46, lineHeight: 1 }}>{hero.icon}</div>
            <div style={{ fontFamily: FONT_D, fontSize: 26, fontWeight: 800, color: hero.color, margin: "6px 0 2px" }}>{hero.title}</div>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>{hero.sub}</div>
            {beatForecast && <div style={{ fontSize: 12.5, color: C.green, fontWeight: 700, marginTop: 6 }}>⤴ 下馬評{forecast.mark}を覆す会心の走り！</div>}
            <div style={{ fontFamily: FONT_M, fontSize: 12, color: C.sub, marginTop: 8 }}>{rank}位 / {total}人中{finishTime != null ? ` ・ ${rank === 1 ? fmtTime(finishTime) : `トップ +${fmtTime(gapSec)}`}` : ""}</div>
          </div>
          <div style={{ background: (race.milestone || race.monument) ? "#2b2436" : C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${race.milestone ? ML_MILESTONE_LABEL[race.milestone].color : race.monument ? "#e8a13c" : C.yellow}` }}>
            <Eyebrow color={race.milestone ? ML_MILESTONE_LABEL[race.milestone].color : race.monument ? "#e8a13c" : undefined}>{race.milestone ? `${ML_MILESTONE_LABEL[race.milestone].eyebrow} RESULT` : race.monument ? "🏛️ モニュメント RESULT" : "RESULT"} — {race.name}</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 20, color: C.text, fontWeight: 700, margin: "6px 0 1px" }}>{rank}位 / {total}人中</div>
            {finishTime != null && (
              <div style={{ fontSize: 12, color: C.sub, fontFamily: FONT_M, marginBottom: 4 }}>
                タイム {fmtTime(finishTime)}{rank === 1 ? "（優勝）" : `／トップ +${fmtTime(gapSec)}`}
              </div>
            )}
            <div style={{ fontSize: 13.5, color: C.green }}>ポイント +{pts}pt ／ 賞金 +{prize}万円</div>
            {forecast && (
              <div style={{ fontSize: 11.5, marginTop: 5, color: C.sub }}>
                📊 下馬評 <span style={{ color: forecast.markColor, fontWeight: 700 }}>{forecast.mark}</span>（{forecast.rank}番手予想）→ 実際 {rank}位
                {rank < forecast.rank ? <span style={{ color: C.green, fontWeight: 700 }}>　⤴ 予想を上回る快走！</span>
                  : rank === forecast.rank ? <span style={{ color: C.sub }}>　→ 下馬評どおり</span>
                  : <span style={{ color: C.red }}>　⤵ 下馬評を下回る…</span>}
              </div>
            )}
            {popGain > 0 && (
              <div style={{ fontSize: 11.5, color: "#e8a13c", marginTop: 3 }}>
                人気度 +{popGain}{popBonus > 0 ? `／個人スポンサー契約ボーナス +${popBonus}万円！` : ""}
              </div>
            )}
            {courseRecord && courseRecord.isNew && (
              <div style={{ fontSize: 12, color: courseRecord.isPlayer ? C.yellow : C.text, marginTop: 4, fontWeight: 700 }}>
                🏅 {courseRecord.kind}のコースレコード更新！（指数{courseRecord.speed}／達成：{courseRecord.holder}{courseRecord.isPlayer ? "・あなた" : ""}）
              </div>
            )}
            {/* v30: 世界ランキングの増減 */}
            {wpGain != null && (
              <div style={{ fontSize: 11.5, color: C.purple, marginTop: 4 }}>
                🌍 世界ランキングポイント +{wpGain}
                {worldRankPrev != null && worldRank != null && worldRank < worldRankPrev
                  ? `／世界ランク ${worldRankPrev}位 → ${worldRank}位（${worldRankPrev - worldRank}ランクUP！）`
                  : worldRank != null ? `／現在 世界${worldRank}位` : ""}
              </div>
            )}
          </div>
          {/* v30: アンビション達成バナー */}
          {ambitionCleared && (
            <div style={{ background: "linear-gradient(180deg,#33301a,#2a2416)", border: `1.5px solid #e8a13c`, borderRadius: 12, padding: "12px 14px" }}>
              <Eyebrow color={"#e8a13c"}>🎯 アンビション達成！</Eyebrow>
              <div style={{ fontFamily: FONT_D, fontSize: 15, color: "#ffd23f", fontWeight: 700, margin: "5px 0 3px" }}>{ambitionCleared.label}</div>
              <div style={{ fontSize: 12, color: C.green }}>達成報酬：{ambitionCleared.rewardText}</div>
            </div>
          )}
          {natRole && (
            <div style={{ background: natFulfilled ? "#16241c" : "#241818", border: `1px solid ${natFulfilled ? C.green : C.red}`, borderRadius: 10, padding: "10px 12px" }}>
              <Eyebrow color={natFulfilled ? C.green : C.red}>🎌 代表での役割（{natRole === "ace" ? "エース" : "アシスト"}） — {natFulfilled ? "任務達成" : "任務未達"}</Eyebrow>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>
                {natFulfilled ? `期待に応える走りで代表の役割を全うした。名声が高まった（人気度+${natPopBonus}）。` : "代表の役割を果たしきれず、悔しい結果となった。"}
              </div>
            </div>
          )}
          {assistOutcome && (
            <div style={{ background: assistOutcome.success ? "#16241c" : "#241818", border: `1px solid ${assistOutcome.success ? C.green : C.red}`, borderRadius: 10, padding: "10px 12px" }}>
              <Eyebrow color={assistOutcome.success ? C.green : C.red}>🤝 献身の走り — {assistOutcome.success ? (assistOutcome.rank === 1 ? "エースを勝利に導いた" : "エースを表彰台へ導いた") : "報われず"}</Eyebrow>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>
                {assistOutcome.success
                  ? `あなたの牽引・風除けでエース${assistOutcome.name}が${assistOutcome.rank}位でフィニッシュ。名アシストとして称えられた（人気・監督評価・報酬に上乗せ）。`
                  : `最後までエース${assistOutcome.name}を牽引したが${assistOutcome.rank}位。勝たせられなかったが、その献身は仲間が見ている。`}
              </div>
            </div>
          )}
          {rivalOutcome && (
            <div style={{ background: rivalOutcome.beat ? "#16241c" : "#241818", border: `1px solid ${rivalOutcome.beat ? C.green : C.red}`, borderRadius: 10, padding: "10px 12px" }}>
              <Eyebrow color={rivalOutcome.beat ? C.green : C.red}>🔥 {rivalOutcome.tierLabel || "ライバル"}対決 — {rivalOutcome.beat ? "勝利" : "敗北"}</Eyebrow>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>{rivalOutcome.name}は{rivalOutcome.rank}位でフィニッシュ。{rivalOutcome.line || (rivalOutcome.beat ? "今回はあなたが上手だった。" : "悔しい結果に終わった。")}</div>
              {rivalOutcome.promoted && <div style={{ fontSize: 12, color: rivalOutcome.tierColor || C.yellow, marginTop: 5, fontWeight: 700 }}>{rivalOutcome.promoted}</div>}
              {!rivalOutcome.scene && vnScene(rivalOutcome.dialogue)}
            </div>
          )}
          {rivalOutcome2 && (
            <div style={{ background: rival2Intro ? "#1c2536" : (rivalOutcome2.beat ? "#16241c" : "#241818"), border: `1px solid ${rival2Intro ? C.blue : (rivalOutcome2.beat ? C.green : C.red)}`, borderRadius: 10, padding: "10px 12px" }}>
              <Eyebrow color={rival2Intro ? C.blue : (rivalOutcome2.beat ? C.green : C.red)}>{rival2Intro ? "🆕 新たな好敵手" : `🔥 ${rivalOutcome2.tierLabel || "好敵手"}対決 — ${rivalOutcome2.beat ? "勝利" : "敗北"}`}</Eyebrow>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>
                {rival2Intro
                  ? `${rivalOutcome2.name}という選手と初めて同じレースで走った。${rivalOutcome2.rank}位でフィニッシュした彼／彼女は、これから長く意識する存在になりそうだ。`
                  : `${rivalOutcome2.name}は${rivalOutcome2.rank}位でフィニッシュ。${rivalOutcome2.line || (rivalOutcome2.beat ? "今回はあなたが上手だった。" : "悔しい結果に終わった。")}`}
              </div>
              {!rival2Intro && rivalOutcome2.promoted && <div style={{ fontSize: 12, color: rivalOutcome2.tierColor || C.yellow, marginTop: 5, fontWeight: 700 }}>{rivalOutcome2.promoted}</div>}
              {!rival2Intro && vnScene(rivalOutcome2.dialogue)}
            </div>
          )}
          {directive && (
            <div style={{ background: fulfilled ? "#16241c" : "#241818", border: `1px solid ${fulfilled ? C.green : C.red}`, borderRadius: 10, padding: "10px 12px" }}>
              <Eyebrow color={fulfilled ? C.green : C.red}>監督指示 — {fulfilled ? "達成" : "未達成"}</Eyebrow>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>{directive.label}</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>監督評価 {evalDelta >= 0 ? "+" : ""}{evalDelta}</div>
            </div>
          )}
          {/* v37: 全順位表（着順・選手名・チーム名・トップとの秒差）。自分・自チーム・ライバルを色分け */}
          {standings && standings.length > 0 && (
            <div style={{ background: C.panel, borderRadius: 10, border: `1px solid ${C.line}`, overflow: "hidden" }}>
              <button onClick={() => setMl(s => ({ ...s, resultTableOpen: !s.resultTableOpen }))} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "9px 12px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", color: C.sub, fontSize: 11.5 }}>
                <span>📋 全順位表（{standings.length}名・選手名／チーム／秒差）</span>
                <span style={{ fontWeight: 700 }}>{ml.resultTableOpen ? "▲ 閉じる" : "▼ 開く"}</span>
              </button>
              {ml.resultTableOpen && (
                <div style={{ maxHeight: 320, overflowY: "auto", borderTop: `1px solid ${C.line}` }}>
                  {standings.map((r) => {
                    const bg = r.isPlayer ? "rgba(255,210,63,0.14)" : r.isMyTeam ? "rgba(79,143,232,0.08)" : "transparent";
                    const nameColor = r.isPlayer ? C.yellow : r.isRival ? C.red : r.isMyTeam ? C.blue : C.text;
                    return (
                      <div key={r.rank} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", background: bg, borderBottom: `1px solid ${C.bg}`, fontSize: 12 }}>
                        <span style={{ width: 26, textAlign: "right", fontFamily: FONT_M, color: r.rank <= 3 ? C.yellow : C.sub, fontWeight: r.rank <= 3 ? 700 : 400 }}>{r.rank}</span>
                        <span style={{ flex: 1, color: nameColor, fontWeight: r.isPlayer ? 700 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.isPlayer ? "🚴 " : r.isRival ? "🔥 " : r.isAce ? "👑 " : ""}{r.name}
                          {r.worldRank ? <span style={{ color: C.purple, fontSize: 10, marginLeft: 3 }}>🌍{r.worldRank}</span> : null}
                        </span>
                        <span style={{ width: 96, color: C.sub, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.team}</span>
                        <span style={{ width: 52, textAlign: "right", fontFamily: FONT_M, color: r.gap === 0 || r.gap == null ? C.green : C.sub }}>{r.rank === 1 ? "TOP" : r.gap == null ? "—" : `+${fmtTime(r.gap)}`}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {(ml.rivalDramaOn !== false && rivalOutcome && rivalOutcome.scene)
            ? <Btn color={rivalOutcome.tierColor || C.purple} onClick={() => setMl(s => ({ ...s, rivalSceneReply: null, screen: "mylife_rival_scene" }))}>💬 {rivalOutcome.name}と言葉を交わす →</Btn>
            : newspaper
              ? <Btn color={newspaper.accent} onClick={() => setMl(s => ({ ...s, screen: "mylife_newspaper" }))}>📰 号外が届いた！ →</Btn>
              : <Btn onClick={() => mlAdvanceMonth("race")}>翌月へ進む →</Btn>}
        </div>
      );
    }

    // v36修正: レース後のライバル対話シーン（返答を選べる双方向イベント）。
    if (ml.screen === "mylife_rival_scene" && ml.resultInfo?.rivalOutcome?.scene) {
      const sc = ml.resultInfo.rivalOutcome.scene;
      const oc = ml.resultInfo.rivalOutcome;
      const reply = ml.rivalSceneReply;
      const Bubble = ({ who, name, text }) => (
        <div style={{ display: "flex", justifyContent: who === "me" ? "flex-end" : "flex-start" }}>
          <div style={{ maxWidth: "86%", background: who === "me" ? "rgba(79,143,232,0.14)" : "rgba(232,84,79,0.12)", border: `1px solid ${who === "me" ? C.blue : C.red}`, borderRadius: 10, padding: "7px 10px" }}>
            <div style={{ fontSize: 9.5, color: who === "me" ? C.blue : C.red, fontWeight: 700, marginBottom: 1 }}>{who === "me" ? "🚴 " : "🔥 "}{name}</div>
            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>{text}</div>
          </div>
        </div>
      );
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "linear-gradient(180deg, rgba(201,139,240,0.08), #201e26)", border: `1px solid ${oc.tierColor || C.purple}`, borderRadius: 12, padding: 14 }}>
            <Eyebrow color={oc.tierColor || C.purple}>💬 {sc.persLabel ? `${sc.persLabel}な` : ""}{sc.tierLabel}・{oc.name}との対話</Eyebrow>
            {sc.situation && <div style={{ fontSize: 11.5, color: C.sub, fontStyle: "italic", lineHeight: 1.6, margin: "6px 0 2px", paddingLeft: 8, borderLeft: `2px solid ${oc.tierColor || C.purple}` }}>{sc.situation}</div>}
            {sc.recordLine && <div style={{ fontSize: 10.5, color: oc.tierColor || C.purple, fontFamily: FONT_M, marginBottom: 2 }}>🔥 {sc.recordLine}</div>}
            <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
              <Bubble who="rival" name={sc.opening.name} text={sc.opening.text} />
              {reply && <Bubble who="me" name={ml.player.name} text={reply.playerLine} />}
              {reply && <Bubble who="rival" name={reply.reply.name} text={reply.reply.text} />}
            </div>
            {reply && (() => {
              const e = reply.effects || {};
              const parts = [];
              if (e.mentalDelta) parts.push(`🧠 メンタル+${e.mentalDelta}`);
              if (e.popularityDelta) parts.push(`⭐ 人気+${e.popularityDelta}`);
              if (e.heatDelta) parts.push(`🔥 因縁+${e.heatDelta}`);
              return parts.length ? (
                <div style={{ marginTop: 8, textAlign: "center", fontSize: 11.5, color: C.green, fontWeight: 700 }}>{parts.join("　")}</div>
              ) : null;
            })()}
          </div>
          {!reply
            ? (<div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 11, color: C.sub, textAlign: "center" }}>どう返す？</div>
                {sc.responses.map((r, i) => (
                  <Btn key={i} color={r.tone === "fire" ? C.red : C.blue} onClick={() => mlResolveRivalScene(i)}>{r.tone === "fire" ? "🔥 " : "🤝 "}{r.label}</Btn>
                ))}
              </div>)
            : (<Btn onClick={mlRivalSceneContinue}>{ml.resultInfo.newspaper ? "📰 号外が届いた！ →" : "続ける →"}</Btn>)}
        </div>
      );
    }

    // v36(#7): 新聞・雑誌イベント。大勝・連勝を号外の紙面として演出する。
    if (ml.screen === "mylife_newspaper" && ml.resultInfo?.newspaper) {
      const np = ml.resultInfo.newspaper;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "#f4efe3", color: "#1a1a1a", borderRadius: 6, padding: "16px 16px 18px", border: `3px double #1a1a1a`, boxShadow: "0 6px 24px rgba(0,0,0,0.4)" }}>
            {/* 題字 */}
            <div style={{ borderBottom: "3px double #1a1a1a", paddingBottom: 6, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <span style={{ fontFamily: FONT_D, fontWeight: 800, fontSize: 20, letterSpacing: 1 }}>📰 {np.masthead}</span>
              <span style={{ fontSize: 10, color: "#555" }}>{np.date}</span>
            </div>
            <div style={{ display: "inline-block", background: np.accent, color: "#1a1a1a", fontSize: 10.5, fontWeight: 800, padding: "1px 8px", borderRadius: 3, marginBottom: 6 }}>{np.tag}</div>
            {/* 大見出し */}
            <div style={{ fontFamily: FONT_D, fontWeight: 800, fontSize: 27, lineHeight: 1.2, margin: "2px 0 4px", borderLeft: `6px solid ${np.accent}`, paddingLeft: 8 }}>{np.headline}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 10 }}>{np.sub}</div>
            {/* 写真枠 */}
            <div style={{ background: "#d8d2c4", border: "1px solid #b3ac9c", borderRadius: 4, padding: "18px 10px", textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 30 }}>📷</div>
              <div style={{ fontSize: 10.5, color: "#555", marginTop: 4, fontStyle: "italic" }}>【写真】{np.photo}</div>
            </div>
            {/* 本文（2段組み風） */}
            <div style={{ fontSize: 12.5, lineHeight: 1.85, color: "#222", textAlign: "justify", columnGap: 14 }}>{np.body}</div>
          </div>
          <Btn onClick={() => mlAdvanceMonth("race")}>読み終えて翌月へ進む →</Btn>
        </div>
      );
    }



}
