// mylife.jsx より分割（Step8）：メインハブ（main/achievements/abilityfile/riderstats/worldstats/records）
// 第13弾Phase2：mylife_main（ホーム画面）を新トークン(T/FONT_DOT)で作り直した。モックアップに
// 無かった要素（作戦・練習フォーカス・成長レポート・弟子・ランキング＆アンビション・スポンサー・
// ライバル・詳細な能力値）はユーザー合意により「その他」の折りたたみへ仮置きし、旧トークン(C系)の
// ままにしてある——Phase3で選手/世界タブ等の行き先が決まってから本格的に作り直す（devlog/wave13.md参照）。
import React from "react";
import { mlNextAction } from "../../domain/mylife/nextAction.js";
import { AbilityFileList, CourseRecordsPanel, DisciplineGrid, PersonaLine, ScoutBadge, TitlesPanel, TraitLine } from "../../components/panels.jsx";
import { AbilitySoshitsuRadarPair } from "../../components/RadarChart.jsx";
import { CourseProfile } from "../../components/CourseProfile.jsx";
import { RiderPortrait } from "../../components/RiderPortrait.jsx";
import { Btn, Eyebrow } from "../../components/ui.jsx";
import { overall } from "../../core/core.js";
import { AB_KEYS, AB_LABEL, POW, TYPES } from "../../data/abilities.js";
import { MONTHS } from "../../data/course.js";
import { C, FONT_B, FONT_D, FONT_DOT, FONT_M, T } from "../../data/theme.js";
import { FAVORS_TO_DISCIPLINE, ML_AMBITION_PATH_KEYS, ML_SPECIAL_TRAINING, ML_STOCK_ITEMS, WEATHER, clearMyLifeSave, formatAchievementReward, growthPhase, loadAbilityFile, managerEvalTier, mlAmbitionPath, mlAmbitionProgressText, mlCurrentAmbition, mlGrowthCap, mlGrowthPowRevealed, mlMediaHeadline, mlRiderStatsRows, mlWorldTeamStats, potentialHint, protegeState, riderFlavorText, rivalHeatTier, worldRankTier } from "../../logic/support.js";
import { ML_ACHIEVEMENTS, ML_AMBITION_PATHS, ML_TACTICS, computeAchievements, initMyLife, mlFirstUnmetRung, riderNickname } from "../../state/state.js";

export function renderMyLifeHubScreen(ctx) {
  const { askConfirm, ml, mlAdvanceMonth, mlBecomeMentor, mlGenRace, mlSetFocus, mlStartLastRace, mlStartRace, mlTriggerSponsorGig, mlUseStockConfirm, mlWrap, openRename, setMl, setSuperMode } = ctx;
    if (ml.screen === "mylife_main" && ml.player) {
      const r = ml.player;
      const race = ml.races[0];
      const ph = growthPhase(r);
      const powRevealed = mlGrowthPowRevealed(ml);
      // v46(UI): 次のアクション#15。「今月の練習メニューの推奨」と「今月の行動の推奨」の両方が
      // 同じ計算（能力の伸びしろ）を必要とするため、ここで一度だけ計算して両方から参照する
      // （旧実装はこの計算を練習メニューのIIFE内に閉じ込めていたため再利用できなかった）。
      const capV = mlGrowthCap(ml.year, r, ml);
      const typeKey = { SPR: "sprint", CLM: "climb", RUL: "flat", TT: "solo", PUN: "sprint" }[r.type];
      const raceFav = race?.tmpl?.favors;
      const raceKey = { SPR: "sprint", CLM: "climb", RUL: "flat", TT: "solo", PUN: "sprint" }[raceFav];
      const roomOf = (k) => Math.max(0, Math.round(capV - (r[k] || 0)));
      const scoreOf = (k) => (k === typeKey ? 10 : 0) + (k === raceKey ? 6 : 0) + Math.min(6, roomOf(k) / 6);
      const recKey = AB_KEYS.slice().sort((a, b) => scoreOf(b) - scoreOf(a))[0];
      const roomLabel = (k) => { const rm = roomOf(k); return rm >= 22 ? "伸びしろ大" : rm >= 10 ? "伸びしろ中" : rm >= 3 ? "伸びしろ小" : "頭打ち"; };
      const recWhy = [recKey === typeKey ? "脚質の主武器" : null, recKey === raceKey ? "今月のレースが有利" : null, roomOf(recKey) >= 15 ? "伸びしろ大" : null].filter(Boolean).join("・") || "バランス";
      // v46(UI): 「今月は何をすべきか分かりづらい」という指摘への対応。疲労・レースの有無・
      // 大舞台かどうかから今月のおすすめを1つだけ判定する（domain/mylife/nextAction.js）。
      // ラベル文言とハンドラはUI都合（フォーカス中の能力名など）なのでここで組み立てる。
      const nextAction = mlNextAction({ fatigue: r.fatigue, race, recTrainLabel: AB_LABEL[recKey], declining: ph.tag === "衰え期" });
      const ACTION_LABEL = { race: "このレースに出場する", rest: "完全休養", train: `練習（${AB_LABEL[r.focus] || "バランス"}中心）` };
      const ACTION_HANDLER = { race: mlStartRace, rest: () => mlAdvanceMonth("rest"), train: () => mlAdvanceMonth("train") };
      const raceTotalKm = (race.tmpl.segs || []).reduce((a, s) => a + s[2], 0);
      return mlWrap(
        <div style={{ display: "grid", gap: T.space.sm, background: T.color.bg, fontFamily: FONT_DOT, color: T.color.text, margin: "-6px -14px 0", padding: T.space.lg }}>
          {/* 第13弾Phase2：ヒーロー領域。選手のドット絵＋名前＋総合力。詳細な能力値・特殊能力・
              血統等は下の「その他」（旧デザインのまま仮置き）へ退避した（Phase3で選手タブへ再設計）。 */}
          <div style={{ display: "flex", gap: T.space.md, alignItems: "flex-end", background: T.color.surface, padding: T.space.md }}>
            <div style={{ flex: "none" }}><RiderPortrait color={T.color.accent} size={72} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: T.size.title, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.name}
                <button onClick={() => openRename("あなたの選手名を変更", r.name, v => setMl(s => {
                  const p = s.player;
                  // v33.7: 自分が始祖の系統（＝自分の名前から生まれた系統）は改名に追従させる。
                  // 師匠・配合で継いだ系統名は先祖の名なのでそのまま維持する
                  const isFounderLineage = !!p.lineageName && p.lineageName === `${p.name}系`;
                  return { ...s, player: { ...p, name: v, lineageName: isFounderLineage ? `${v}系` : p.lineageName } };
                }))} title="名前を変更" style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FONT_DOT, fontSize: T.size.caption, marginLeft: 6, padding: 0, color: T.color.sub }}>変更</button>
              </div>
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ml.team}</div>
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm }}>{r.age}歳 / {ph.tag}</div>
            </div>
            <div style={{ textAlign: "right", flex: "none" }}>
              <div style={{ fontSize: T.size.display, lineHeight: 1, color: T.color.accent }}>{overall(r)}</div>
              <div style={{ fontSize: T.size.caption, color: T.color.sub }}>総合力</div>
            </div>
          </div>

          <div style={{ background: T.color.surface, padding: T.space.md }}>
            {(() => {
              const fatigue = Math.round(r.fatigue);
              const form = Math.round(r.form ?? 50);
              const vit = Math.round(r.vitality == null ? 100 : r.vitality);
              const rows = [
                ["疲労", fatigue, fatigue >= 90 ? T.color.bad : fatigue >= 60 ? T.color.accent : T.color.good],
                ["フォーム", form, form >= 62 ? T.color.good : form >= 40 ? T.color.accent : T.color.bad],
                ["活力", vit, vit >= 70 ? T.color.good : vit >= 40 ? T.color.accent : T.color.bad],
              ];
              return rows.map(([label, val, color], i) => (
                <div key={label} style={{ marginBottom: i === rows.length - 1 ? 0 : T.space.sm }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.caption, marginBottom: T.space.xs }}>
                    <span style={{ color: T.color.sub }}>{label}</span><span style={{ color }}>{val}</span>
                  </div>
                  <div style={{ height: 4, background: T.color.surfaceUp }}><div style={{ height: 4, width: `${val}%`, background: color }} /></div>
                </div>
              ));
            })()}
          </div>

          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>今月のレース</div>
          <div style={{ background: T.color.surface, padding: T.space.md }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: T.space.sm }}>
              <span style={{ fontSize: T.size.head, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{race.name}</span>
              <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none", marginLeft: T.space.sm }}>{raceTotalKm}km</span>
            </div>
            <div style={{ marginBottom: T.space.sm }}><CourseProfile segs={race.tmpl.segs} height={40} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.caption, color: T.color.sub, flexWrap: "wrap", gap: T.space.xs }}>
              <span>{race.tmpl.kind}</span>
              <span>{TYPES[race.tmpl.favors].label}有利</span>
              {race.weather && race.weather !== "clear" && <span style={{ color: T.color.bad }}>{WEATHER[race.weather].label}</span>}
            </div>
            {(race.milestone || race.monument) && (
              <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: T.space.sm }}>
                {race.milestone === "worlds" ? "世界選手権" : race.milestone === "olympics" ? "オリンピック" : "モニュメント（クラシック）"}
              </div>
            )}
          </div>

          {/* 第13弾Phase2：今月の行動。1つだけの推奨（塗り）＋他の選択肢（枠）。旧デザインの色分け
              （黄塗り＝おすすめ／黄枠＝他の行動）は踏襲しつつ、新トークンで作り直した。 */}
          <div style={{ background: T.color.surface, padding: T.space.md }}>
            <button onClick={ACTION_HANDLER[nextAction.key]} style={{ width: "100%", background: T.color.accent, color: T.color.bg, border: 0, padding: T.space.md, fontFamily: FONT_DOT, fontSize: T.size.body, cursor: "pointer" }}>
              {ACTION_LABEL[nextAction.key]}
            </button>
            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs, textAlign: "center" }}>{nextAction.reason}</div>
            <div style={{ marginTop: T.space.sm }}>
              {nextAction.key !== "race" && (
                <button onClick={mlStartRace} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, borderTop: `1px solid ${T.color.rule}`, color: T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body, padding: `${T.space.sm}px 0`, cursor: "pointer" }}>{ACTION_LABEL.race}</button>
              )}
              {nextAction.key !== "rest" && (
                <button onClick={() => mlAdvanceMonth("rest")} title="疲労を大きく回復し、脚がフレッシュに（フォームの下振れを消して微増）＋メンタルも整う。大レース前の仕上げに"
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, borderTop: `1px solid ${T.color.rule}`, color: T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body, padding: `${T.space.sm}px 0`, cursor: "pointer" }}>{ACTION_LABEL.rest}</button>
              )}
              {nextAction.key !== "train" && (
                <button onClick={() => mlAdvanceMonth("train")} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, borderTop: `1px solid ${T.color.rule}`, color: T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body, padding: `${T.space.sm}px 0`, cursor: "pointer" }}>{ACTION_LABEL.train}</button>
              )}
              <button onClick={() => mlAdvanceMonth("peak")} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, borderTop: `1px solid ${T.color.rule}`, color: T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body, padding: `${T.space.sm}px 0`, cursor: "pointer" }}>ピーキング調整（フォームを上げる）</button>
              {/* v43(Phase 2): 取材・私生活イベントは手動ボタンを廃止し、月が終わるたびに
                  運ステータスで確率が変わる受動発火へ移行した（controllers/mylife/month.js参照） */}
              {(ml.player.popularity || 0) >= 20 && (
                <button onClick={mlTriggerSponsorGig} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, borderTop: `1px solid ${T.color.rule}`, color: T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body, padding: `${T.space.sm}px 0`, cursor: "pointer" }}>スポンサーの仕事</button>
              )}
            </div>
          </div>

          {ml.directive && (
            <div style={{ background: T.color.surface, padding: T.space.md }}>
              <div style={{ fontSize: T.size.caption, color: T.color.sub }}>監督から</div>
              <div style={{ fontSize: T.size.body, marginTop: T.space.xs, marginBottom: T.space.xs }}>{ml.directive.label}</div>
              <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{ml.directive.desc}</div>
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm }}>評価 {managerEvalTier(ml.managerEval).label}</div>
            </div>
          )}

          {/* 第13弾Phase3-A：レース作戦。出走前に決める＝「今月の決断」の一部なのでホームに残す。 */}
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>レース作戦</div>
          <div style={{ background: T.color.surface }}>
            {Object.entries(ML_TACTICS).map(([k, t], i) => {
              const on = (ml.tactic || "balanced") === k;
              return (
                <button key={k} onClick={() => setMl(s => ({ ...s, tactic: k }))} title={t.desc}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "baseline", width: "100%",
                    background: on ? T.color.surfaceUp : "none", border: 0,
                    borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}`,
                    color: on ? T.color.accent : T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body,
                    padding: `${T.space.sm}px ${T.space.md}px`, cursor: "pointer", textAlign: "left",
                  }}>
                  <span>{t.label}</span>
                  {on && <span style={{ fontSize: T.size.caption, color: T.color.sub }}>選択中</span>}
                </button>
              );
            })}
            <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px ${T.space.md}px`, borderTop: `1px solid ${T.color.rule}`, lineHeight: 1.6 }}>
              {(ML_TACTICS[ml.tactic] || ML_TACTICS.balanced).desc}
            </div>
          </div>

          {/* 練習メニュー。こちらも「今月どう過ごすか」の決断なのでホームに残す。 */}
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>練習メニュー</div>
          <div style={{ background: T.color.surface }}>
            {AB_KEYS.map((k, i) => {
              const on = r.focus === k;
              const rec = recKey === k;
              return (
                <button key={k} onClick={() => mlSetFocus(k)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "baseline", width: "100%",
                    background: on ? T.color.surfaceUp : "none", border: 0,
                    borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}`,
                    color: on ? T.color.accent : T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body,
                    padding: `${T.space.sm}px ${T.space.md}px`, cursor: "pointer", textAlign: "left",
                  }}>
                  <span>{AB_LABEL[k]}{rec ? "（おすすめ）" : ""}</span>
                  <span style={{ fontSize: T.size.caption, color: T.color.sub }}>
                    {Math.round(r[k] || 0)} <span style={{ color: roomOf(k) >= 10 ? T.color.good : T.color.sub }}>+{roomOf(k)}</span>
                  </span>
                </button>
              );
            })}
            <button onClick={() => setMl(s => ({ ...s, uiSpecialOpen: !s.uiSpecialOpen }))}
              style={{ width: "100%", background: "none", border: 0, borderTop: `1px solid ${T.color.rule}`, color: T.color.sub, fontFamily: FONT_DOT, fontSize: T.size.caption, padding: `${T.space.sm}px ${T.space.md}px`, cursor: "pointer", textAlign: "left" }}>
              {ml.uiSpecialOpen ? "専門トレーニングを閉じる" : "専門トレーニングを見る"}
            </button>
            {ml.uiSpecialOpen && Object.entries(ML_SPECIAL_TRAINING).map(([k, sp]) => (
              <button key={k} onClick={() => mlAdvanceMonth(k)} title={sp.desc}
                style={{ display: "block", width: "100%", background: "none", border: 0, borderTop: `1px solid ${T.color.rule}`, color: T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body, padding: `${T.space.sm}px ${T.space.md}px`, cursor: "pointer", textAlign: "left" }}>
                {sp.label}
              </button>
            ))}
          </div>

          {/* 先月の成長。直前の行動の手応えを返す情報なのでホームに残す。 */}
          {ml.growthReport && (ml.growthReport.deltas.length > 0 || ml.growthReport.ovrUp > 0) && (() => {
            const gr = ml.growthReport;
            return (
              <>
                <div style={{ fontSize: T.size.caption, color: T.color.sub }}>先月の成長</div>
                <div style={{ background: T.color.surface, padding: T.space.md }}>
                  {gr.ovrUp > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body, marginBottom: T.space.sm }}>
                      <span style={{ color: T.color.sub }}>総合力</span>
                      <span>{gr.ovrBefore} → <span style={{ color: T.color.accent }}>{gr.ovrAfter}</span></span>
                    </div>
                  )}
                  {gr.deltas.map((d, i) => (
                    <div key={d.key} style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.body, padding: `${T.space.xs}px 0`, borderTop: i === 0 && !gr.ovrUp ? "none" : `1px solid ${T.color.rule}` }}>
                      <span style={{ color: T.color.sub }}>{d.label}</span>
                      <span>{d.before} → {d.after} <span style={{ color: T.color.good }}>+{d.up}</span></span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
          {/* 第13弾Phase3-A：ヘルプと、頻度が低く一部は取り返しがつかないキャリア操作。
              5つのタブのどれにも属さない性質（設定・生涯の区切り）なのでホーム末尾の折りたたみに置く。
              取り返しがつかない操作だけは赤（T.color.bad）で示す。 */}
          <div>
            <button onClick={() => setMl(s => ({ ...s, uiOtherOpen: !s.uiOtherOpen }))}
              style={{ width: "100%", background: "none", border: `1px solid ${T.color.rule}`, color: T.color.sub, cursor: "pointer", padding: `${T.space.sm}px ${T.space.md}px`, textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FONT_DOT, fontSize: T.size.caption }}>
              <span>その他</span>
              <span>{ml.uiOtherOpen ? "閉じる" : "開く"}</span>
            </button>
            {ml.uiOtherOpen && (() => {
              const item = (label, onClick, color) => (
                <button onClick={onClick}
                  style={{ display: "block", width: "100%", background: "none", border: 0, borderTop: `1px solid ${T.color.rule}`, color: color || T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body, padding: `${T.space.sm}px ${T.space.md}px`, cursor: "pointer", textAlign: "left" }}>
                  {label}
                </button>
              );
              return (
                <div style={{ background: T.color.surface }}>
                  {item("ヘルプ", () => setMl(s => ({ ...s, screen: "mylife_help" })))}
                  {item(`会話ドラマ：${ml.rivalDramaOn === false ? "非表示" : "表示中"}`, () => setMl(s => ({ ...s, rivalDramaOn: s.rivalDramaOn === false })))}
                  {ml.flags?.mentor
                    ? <div style={{ borderTop: `1px solid ${T.color.rule}`, color: T.color.sub, fontSize: T.size.caption, padding: `${T.space.sm}px ${T.space.md}px` }}>
                        チームの精神的支柱{ml.protege ? `・${ml.protege.name}の師` : ""}（毎月 疲労-3／評価+0.3）
                      </div>
                    : r.age >= 30 && item("メンターになる（弟子を取る）", () => askConfirm("若手のメンターになり、弟子を1人取りますか？弟子はあなたの地力に導かれて育っていきます。加えて毎月の疲労回復と監督評価の伸びも恒常的に上がります（一度なると元には戻せません）。", mlBecomeMentor))}
                  {item("ラストレースで引退", () => askConfirm("ラストレースに出場してから引退しますか？あなたの脚質に合ったグレード4のエキシビションで、ライバルたちも駆けつける最高の舞台です。走り終えるとそのまま引退となります。", mlStartLastRace), T.color.bad)}
                  {/* v49(第11弾続き): 殿堂記録(mlRecordLegend)はここで直接呼ばない。以前はここでも
                      呼んでおり、"mylife_retired"遷移を検知するuseMyLifeGame.js側のuseEffectとの
                      二重呼び出しで、静かに引退するたび同じ選手が殿堂へ2回登録されるバグになっていた。
                      他の引退経路（ラストレース／引退勧告）と同じくuseEffect側の一本化した処理に委ねる。 */}
                  {item("静かに引退", () => askConfirm(`${r.age}歳で現役を引退しますか？この操作は取り消せません（キャリアの記録はセレモニー画面で振り返れます）。`, () => setMl(s => ({ ...s, screen: "mylife_retired" }))), T.color.bad)}
                  {item("最初からやり直す", () => askConfirm("マイライフを最初からやり直しますか？現在の選手の保存データは消えます（歴代の殿堂記録は残ります）。", () => { clearMyLifeSave(); setMl(initMyLife()); }), T.color.bad)}
                  {item("タイトルに戻る", () => askConfirm("マイライフモードを終了してタイトルに戻りますか？（自動セーブ済み）", () => setSuperMode(null)))}
                </div>
              );
            })()}
          </div>
        </div>
      );
    }

    if (ml.screen === "mylife_achievements" && ml.player) {
      const achievements = computeAchievements(ml);
      const achievedCount = achievements.filter(a => a.achieved).length;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.yellow}` }}>
            <Eyebrow color={C.yellow}>🏆 実績</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 18, color: C.text, margin: "4px 0" }}>{achievedCount} / {achievements.length} 達成</div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {achievements.map(a => (
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
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_abilityfile") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <Eyebrow color={C.purple}>🗂 特殊能力図鑑</Eyebrow>
        <AbilityFileList file={loadAbilityFile()} />
        <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
      </div>
    );

    // v27: コースレコード一覧（シーズンモードと共有の永続記録）
    // v37: 選手成績台帳（自分・ライバル・チームメイトの今季／通算スタッツ）
    if (ml.screen === "mylife_riderstats" && ml.player) {
      const rows = mlRiderStatsRows(ml);
      const kindLabel = { self: { t: "あなた", c: C.yellow }, rival: { t: "ライバル", c: C.red }, protege: { t: "弟子", c: C.green }, teammate: { t: "チームメイト", c: C.blue } };
      return mlWrap(
        <div style={{ display: "grid", gap: 10 }}>
          <Eyebrow color={C.red}>📊 選手成績 — {ml.year}年目 時点</Eyebrow>
          <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.6 }}>同じレースを走った相手との成績（今季／通算）。</div>
          <div style={{ background: C.panel, borderRadius: 10, border: `1px solid ${C.line}`, overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 6, padding: "6px 10px", fontSize: 10, color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
              <span style={{ flex: 1 }}>選手</span>
              <span style={{ width: 62, textAlign: "center" }}>今季</span>
              <span style={{ width: 96, textAlign: "center" }}>通算（勝／表彰台）</span>
              <span style={{ width: 40, textAlign: "right" }}>最高</span>
            </div>
            {rows.map((r) => {
              const kl = kindLabel[r.kind] || kindLabel.teammate;
              return (
                <div key={r.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "7px 10px", borderBottom: `1px solid ${C.bg}`, background: r.kind === "self" ? "rgba(255,210,63,0.10)" : "transparent" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: kl.c, fontWeight: r.kind === "self" ? 700 : 500, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                      {r.kind === "self" ? "🚴 " : r.kind === "rival" ? "🔥 " : r.kind === "protege" ? "🎓 " : "🤝 "}{r.name}
                    </span>
                    <span style={{ fontSize: 9.5, color: C.sub }}>{kl.t}・{r.team}</span>
                  </span>
                  <span style={{ width: 62, textAlign: "center", fontFamily: FONT_M, fontSize: 11, color: C.text }}>{r.yr ? `${r.yr.races}走${r.yr.wins}勝` : "—"}</span>
                  <span style={{ width: 96, textAlign: "center", fontFamily: FONT_M, fontSize: 11, color: C.text }}>{r.races}走 <span style={{ color: C.yellow }}>{r.wins}</span>/<span style={{ color: "#e8a13c" }}>{r.podiums}</span></span>
                  <span style={{ width: 40, textAlign: "right", fontFamily: FONT_M, fontSize: 11, color: r.bestRank === 1 ? C.yellow : C.sub }}>{r.bestRank >= 99 ? "—" : `${r.bestRank}位`}</span>
                </div>
              );
            })}
            {rows.length <= 1 && <div style={{ padding: "12px", fontSize: 11.5, color: C.sub, textAlign: "center" }}>レースを重ねると、ライバルや仲間の成績がここに蓄積されます。</div>}
          </div>
          <Btn outline color={C.green} onClick={() => setMl(s => ({ ...s, screen: "mylife_worldstats" }))}>🌍 全チーム名鑑・成績を見る</Btn>
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 戻る</Btn>
        </div>
      );
    }

    // v37: 全チーム名鑑＋成績（チームごとに全選手を一覧・成績を表示）
    if (ml.screen === "mylife_worldstats" && ml.player) {
      const teams = mlWorldTeamStats(ml);
      return mlWrap(
        <div style={{ display: "grid", gap: 10 }}>
          <Eyebrow color={C.green}>🌍 全チーム名鑑・成績 — {ml.year}年目</Eyebrow>
          <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.6 }}>各チームの選手団と、対戦成績（通算 勝/表彰台、今季）。</div>
          {teams.length === 0 && <div style={{ fontSize: 12, color: C.sub, padding: 12 }}>まだデータがありません（旧セーブは新規キャラから反映されます）。</div>}
          {teams.map((t) => (
            <div key={t.teamName} style={{ background: C.panel, borderRadius: 10, border: `1px solid ${C.line}`, borderLeft: `3px solid ${t.color}`, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 12px", background: C.panel2 }}>
                <span style={{ fontFamily: FONT_D, fontSize: 14, color: C.text }}>{t.isMyTeam ? "⭐ " : ""}{t.teamName}<span style={{ fontSize: 10, color: C.sub, marginLeft: 6 }}>{t.trait}</span></span>
                <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.sub }}>通算 <b style={{ color: C.yellow }}>{t.teamWins}</b>勝/{t.teamPodiums}表彰台</span>
              </div>
              {t.riders.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "5px 12px", borderTop: `1px solid ${C.bg}`, fontSize: 12 }}>
                  <span style={{ flex: 1, color: r.self ? C.yellow : C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.self ? "🚴 " : ""}{r.name}<span style={{ fontSize: 9.5, color: TYPES[r.type]?.color, marginLeft: 4 }}>{TYPES[r.type]?.label}</span></span>
                  <span style={{ width: 54, textAlign: "center", fontFamily: FONT_M, fontSize: 10.5, color: C.sub }}>今{r.yr.races}走{r.yr.wins}勝</span>
                  <span style={{ width: 88, textAlign: "center", fontFamily: FONT_M, fontSize: 10.5, color: C.text }}>通{r.races}走 <span style={{ color: C.yellow }}>{r.wins}</span>/<span style={{ color: "#e8a13c" }}>{r.podiums}</span></span>
                  <span style={{ width: 34, textAlign: "right", fontFamily: FONT_M, fontSize: 10.5, color: r.bestRank === 1 ? C.yellow : C.sub }}>{r.bestRank >= 99 ? "—" : `${r.bestRank}位`}</span>
                  {!r.self && <ScoutBadge scout={r.scout} compact />}
                </div>
              ))}
            </div>
          ))}
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_riderstats" }))}>← 戻る</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_records") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <Eyebrow color={"#e8a13c"}>👑 通算タイトル</Eyebrow>
        <TitlesPanel />
        <Eyebrow color={"#e8a13c"}>🏅 コースレコード</Eyebrow>
        <CourseRecordsPanel />
        <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
      </div>
    );

    // v25: マイライフ専用ヘルプ。毎月のアクションから細かな仕様まで一覧できるようにする

}
