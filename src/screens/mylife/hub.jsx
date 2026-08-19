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

          {/* 第13弾Phase2：ここから下（「その他」の中身）はモックアップに含めなかった要素の仮置き場。
              旧トークン(C系)のまま——Phase3で選手/世界タブ等の行き先が決まってから作り直す。 */}
          <div>
            <button onClick={() => setMl(s => ({ ...s, uiStatusOpen: !s.uiStatusOpen }))}
              style={{ width: "100%", background: "none", border: `1px solid ${T.color.rule}`, color: T.color.sub, cursor: "pointer", padding: `${T.space.sm}px ${T.space.md}px`, textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FONT_DOT, fontSize: T.size.caption }}>
              <span>その他</span>
              <span>{ml.uiStatusOpen ? "閉じる" : "開く"}</span>
            </button>
            {ml.uiStatusOpen && (
              <div style={{ display: "grid", gap: 12, marginTop: 12, fontFamily: FONT_B }}>
                <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
                  {riderNickname(r) && <div style={{ fontSize: 12, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{riderNickname(r)}」</div>}
                  {r.master && <div style={{ fontSize: 11, color: C.purple, marginTop: 1 }}>🎓 {r.master}の教え子{r.teaching ? `・師の教え「${r.teaching}」` : ""}</div>}
                  {r.partner && <div style={{ fontSize: 11, color: "#e56cc8", marginTop: 1 }}>🧬 {r.master}×{r.partner}の配合{(r.generation || 0) > 1 ? `・${r.generation}代目` : ""}{(r.plusValue || 0) > 0 ? `・累代+${Math.min(15, r.plusValue)}` : ""}</div>}
                  {r.lineageName && <div style={{ fontSize: 10.5, color: "#c98bf0", marginTop: 1 }}>🩸 {r.lineageName}{r.bloodlineTier ? `　🏛${["", "確立", "名門", "大系統"][r.bloodlineTier]}系統` : ""}</div>}
                  {r.specialMating && <div style={{ fontSize: 10.5, color: r.specialMating.color || C.yellow, fontWeight: 700, marginTop: 1 }}>🌟 特殊配合『{r.specialMating.title}』</div>}
                  <PersonaLine p={r.personality} />
                  <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                  <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.sub, margin: "4px 0", flexWrap: "wrap" }}>
                    <span>成長{powRevealed ? <span style={{ color: POW[r.growthPow].color }}>{r.growthPow}</span> : <span style={{ color: C.sub }}>🔒???</span>}</span>
                    {(() => { const pot = potentialHint(r, powRevealed); return <span style={{ color: pot.color }}>{pot.label}</span>; })()}
                    {ml.flags?.married && <span style={{ color: C.purple }}>💍 既婚</span>}
                  </div>
                  {(() => {
                    const cap = mlGrowthCap(ml.year, r, ml);
                    return (
                      <>
                        <div style={{ fontSize: 10.5, color: C.sub, marginTop: 8 }}>コース適性</div>
                        <DisciplineGrid r={r} highlightKey={race?.tmpl?.favors ? (FAVORS_TO_DISCIPLINE[race.tmpl.favors] || "flat") : undefined} />
                        <div style={{ marginTop: 10 }}>
                          <AbilitySoshitsuRadarPair r={r} cap={cap} size={148} />
                        </div>
                        {r.talentCap ? <div style={{ fontSize: 10, color: C.sub, marginTop: 4, textAlign: "center" }}>才能で上限+{r.talentCap}</div> : null}
                      </>
                    );
                  })()}
                  <div style={{ fontSize: 11, color: C.sub, fontStyle: "italic", marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.line}`, lineHeight: 1.5 }}>{riderFlavorText(r)}</div>
                  {(ml.stock.drink > 0 || ml.stock.supp > 0 || ml.stock.tune > 0) && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {ml.stock.drink > 0 && <Btn small outline color={C.green} onClick={() => mlUseStockConfirm("drink")}>{ML_STOCK_ITEMS.drink.label}（疲労-30） ×{ml.stock.drink}</Btn>}
                      {ml.stock.supp > 0 && <Btn small outline color={C.green} onClick={() => mlUseStockConfirm("supp")}>{ML_STOCK_ITEMS.supp.label}（疲労-60） ×{ml.stock.supp}</Btn>}
                      {ml.stock.tune > 0 && <Btn small outline color={C.green} onClick={() => mlUseStockConfirm("tune")}>{ML_STOCK_ITEMS.tune.label}（フォーム+12） ×{ml.stock.tune}</Btn>}
                    </div>
                  )}
                </div>
                <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>📻 レース作戦</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {Object.entries(ML_TACTICS).map(([k, t]) => (
                      <button key={k} onClick={() => setMl(s => ({ ...s, tactic: k }))} title={t.desc}
                        style={{ padding: "4px 8px", borderRadius: 8, cursor: "pointer", fontSize: 10.5, fontWeight: 700,
                          background: (ml.tactic || "balanced") === k ? "rgba(255,210,63,0.14)" : C.panel, color: (ml.tactic || "balanced") === k ? C.yellow : C.sub,
                          border: `1.5px solid ${(ml.tactic || "balanced") === k ? C.yellow : C.line}` }}>{t.label}</button>
                    ))}
                  </div>
                  {(() => {
                    const tac = ML_TACTICS[ml.tactic] || ML_TACTICS.balanced;
                    return (
                      <div style={{ fontSize: 10, color: C.sub, marginTop: 5, display: "flex", gap: 6, alignItems: "flex-start" }}>
                        {tac.tag && <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, color: tac.tagColor || C.sub, border: `1px solid ${tac.tagColor || C.line}`, borderRadius: 6, padding: "1px 5px", lineHeight: 1.5 }}>{tac.tag}</span>}
                        <span>{tac.desc}</span>
                      </div>
                    );
                  })()}
                  <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>天候予報：</span>
                    {[0, 1, 2].map(off => {
                      const mi = ml.month + off;
                      if (mi > 11) return null;
                      const fr = mlGenRace(ml.year, mi, ml.classIdx);
                      const w = fr.weather || "clear";
                      return (
                        <span key={off} style={{ color: w === "rain" ? C.blue : w === "heat" ? C.red : C.sub }}>
                          {MONTHS[mi]}{off === 0 ? "(今)" : ""} {WEATHER[w].icon}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Eyebrow>今月の練習メニュー</Eyebrow>
                  <select value={r.focus} onChange={e => mlSetFocus(e.target.value)}
                    style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px", fontSize: 13, marginTop: 6, width: "100%", boxSizing: "border-box" }}>
                    {AB_KEYS.map(k => <option key={k} value={k}>{k === recKey ? "⭐ " : ""}{AB_LABEL[k]}強化（{roomLabel(k)}）</option>)}
                  </select>
                  <div style={{ fontSize: 10.5, color: C.sub, marginTop: 5, lineHeight: 1.5 }}>
                    ⭐推奨：<b style={{ color: C.green }}>{AB_LABEL[recKey]}</b>（{recWhy}）
                    {r.focus !== recKey && <span style={{ color: "#e8a13c" }}>　※今は{AB_LABEL[r.focus]}を強化中</span>}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                    {AB_KEYS.map(k => (
                      <span key={k} style={{ fontSize: 9.5, fontFamily: FONT_M, color: k === r.focus ? C.yellow : C.sub, background: C.panel2, borderRadius: 5, padding: "1px 6px", border: k === recKey ? `1px solid ${C.green}` : "1px solid transparent" }}>
                        {AB_LABEL[k]} {Math.round(r[k] || 0)}<span style={{ color: roomOf(k) >= 10 ? C.green : C.sub }}>（+{roomOf(k)}）</span>
                      </span>
                    ))}
                  </div>
                  <button onClick={() => setMl(s => ({ ...s, uiSpecialOpen: !s.uiSpecialOpen }))}
                    style={{ width: "100%", marginTop: 10, background: "none", border: `1px solid ${C.line}`, borderRadius: 8, color: C.sub, fontSize: 11, padding: "5px 8px", cursor: "pointer" }}>
                    {ml.uiSpecialOpen ? "▲ 専門トレーニングを閉じる" : "▼ 専門トレーニングを見る"}
                  </button>
                  {ml.uiSpecialOpen && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {Object.entries(ML_SPECIAL_TRAINING).map(([k, sp]) => (
                        <Btn key={k} small role="month" onClick={() => mlAdvanceMonth(k)} title={sp.desc}>{sp.label}</Btn>
                      ))}
                    </div>
                  )}
                </div>
                {ml.growthReport && (ml.growthReport.deltas.length > 0 || ml.growthReport.ovrUp > 0 || ml.growthReport.subDeltas.length > 0) && (() => {
                  const gr = ml.growthReport;
                  return (
                    <div style={{ background: "linear-gradient(180deg, rgba(125,208,160,0.12), transparent)", borderRadius: 10, border: `1px solid ${C.green}`, padding: "9px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: 11.5, color: C.green, fontWeight: 700 }}>📈 先月の成長</span>
                        {gr.ovrUp > 0 && <span style={{ fontFamily: FONT_M, fontSize: 13, color: C.yellow, fontWeight: 700 }}>OVR {gr.ovrBefore}→{gr.ovrAfter} <span style={{ color: C.green }}>(+{gr.ovrUp})</span></span>}
                      </div>
                      {gr.ovrMilestone && <div style={{ fontSize: 12.5, color: C.yellow, fontWeight: 700, marginTop: 5 }}>🎉 総合力 {gr.ovrMilestone} 到達！新たな領域へ</div>}
                      {(gr.deltas.length > 0 || gr.subDeltas.length > 0) ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                          {gr.deltas.map(d => (
                            <span key={d.key} style={{ fontFamily: FONT_M, fontSize: 11.5, color: C.text, background: C.panel2, borderRadius: 6, padding: "2px 8px" }}>
                              {d.label} <b style={{ color: C.green }}>{d.before}→{d.after}</b> <span style={{ color: C.green }}>+{d.up}</span>
                            </span>
                          ))}
                          {gr.subDeltas.map((d, i) => (
                            <span key={"s" + i} style={{ fontFamily: FONT_M, fontSize: 11, color: C.sub, background: C.panel2, borderRadius: 6, padding: "2px 8px" }}>{d.label} +{d.up}</span>
                          ))}
                        </div>
                      ) : <div style={{ fontSize: 10.5, color: C.sub, marginTop: 5 }}>伸びが頭打ち。休養で活力を戻すと伸びやすくなります。</div>}
                      {gr.vitAfter !== gr.vitBefore && <div style={{ fontSize: 10, color: gr.vitAfter > gr.vitBefore ? C.green : "#c86", marginTop: 5 }}>💚 活力 {gr.vitBefore}→{gr.vitAfter}{gr.vitAfter > gr.vitBefore ? "（休養で回復）" : "（走り込みで消耗）"}</div>}
                    </div>
                  );
                })()}
                {(() => {
                  const media = mlMediaHeadline(ml);
                  if (!media) return null;
                  const tc = media.tone === "good" ? C.green : media.tone === "bad" ? C.red : "#5aa9e6";
                  return (
                    <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), transparent)", borderRadius: 10, border: `1px solid ${C.line}`, borderLeft: `3px solid ${tc}`, padding: "8px 12px" }}>
                      <div style={{ fontSize: 9.5, color: C.sub, letterSpacing: 1, textTransform: "uppercase" }}>📰 ロードレース・タイムズ</div>
                      <div style={{ fontFamily: FONT_D, fontSize: 15, color: tc, margin: "2px 0 3px", lineHeight: 1.3 }}>{media.headline}</div>
                      <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.5 }}>{media.body}</div>
                    </div>
                  );
                })()}
                {ml.protege && (() => {
                  const pr = protegeState(ml.protege, ml.year);
                  const t = TYPES[ml.protege.type];
                  const growPct = pr.nextMilestone ? Math.max(0, Math.min(1, (pr.ovr - (pr.nextMilestone - 10)) / 10)) : 1;
                  return (
                    <div style={{ background: "linear-gradient(180deg, rgba(53,192,126,0.06), transparent)", borderRadius: 10, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.green}`, padding: "9px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: 10.5, color: C.green, fontWeight: 700 }}>🎓 弟子の成長</span>
                        <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.sub }}>年 +{pr.perYear}（絆×{pr.bondMul}・鍛錬×{pr.trainMul}）</span>
                      </div>
                      <div style={{ fontFamily: FONT_D, fontSize: 14, color: C.text, margin: "2px 0 1px" }}>
                        {ml.protege.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                        <span style={{ marginLeft: 6, fontSize: 11, color: C.sub }}>{pr.age}歳・成長力{ml.protege.growthPow}</span>
                        <span style={{ marginLeft: 8, fontFamily: FONT_M, fontSize: 13, color: C.yellow }}>OVR {pr.ovr}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: C.line, marginTop: 5, overflow: "hidden" }}>
                        <div style={{ width: `${growPct * 100}%`, height: "100%", background: C.green, borderRadius: 3 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                        <span style={{ fontSize: 9.5, color: C.pink }}>絆</span>
                        <div style={{ flex: 1, height: 4, borderRadius: 3, background: C.line, overflow: "hidden" }}>
                          <div style={{ width: `${pr.bond}%`, height: "100%", background: C.pink, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontFamily: FONT_M, fontSize: 9.5, color: C.sub }}>{pr.bond}/100</span>
                      </div>
                      <div style={{ fontSize: 10, color: C.sub, marginTop: 3 }}>
                        {pr.nextMilestone
                          ? (pr.yrs === 0 ? `弟子入りしたばかり。あなたの背中を追い、OVR${pr.nextMilestone}を目指す。` : `${pr.yrs}年の指導で着実に成長中。次はOVR${pr.nextMilestone}の壁。`)
                          : "一流の域に達した。あなたの教えが確かに実を結んでいる。"}
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const tier = worldRankTier(ml.worldRank);
                  const path = mlAmbitionPath(ml);
                  const amb = mlCurrentAmbition(ml);
                  const idx = ml.ambitionIdx || 0;
                  return (
                    <div style={{ background: "linear-gradient(180deg,#2a2740,#22202f)", borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.purple}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Eyebrow color={C.purple}>🌍 世界ランキング＆アンビション</Eyebrow>
                        <Btn small outline color={C.green} onClick={() => setMl(s => ({ ...s, screen: "mylife_ranking" }))}>📊 ランキングを見る</Btn>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 5 }}>
                        <span style={{ fontFamily: FONT_D, fontSize: 13.5, color: C.text }}>
                          世界ランク <span style={{ fontFamily: FONT_M, fontSize: 18, color: tier.color, fontWeight: 700 }}>{ml.worldRank == null ? "—" : `${ml.worldRank}位`}</span>
                          <span style={{ fontSize: 11, color: tier.color, marginLeft: 6 }}>{tier.label}</span>
                        </span>
                        <span style={{ fontSize: 10.5, color: C.sub, fontFamily: FONT_M }}>{Math.round(ml.worldPoints || 0)}pt{ml.worldRankBest != null ? `／自己最高 ${ml.worldRankBest}位` : ""}</span>
                      </div>
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: path.color, fontWeight: 700 }}>{path.icon} {path.label}</span>
                          <button onClick={() => setMl(s => ({ ...s, showPathChooser: !s.showPathChooser }))} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 6, color: C.sub, cursor: "pointer", fontSize: 10, padding: "2px 8px" }}>🔀 生き方を変える</button>
                        </div>
                        {ml.showPathChooser && (
                          <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
                            {ML_AMBITION_PATH_KEYS.map(pk => { const p = ML_AMBITION_PATHS[pk]; const cur = (ml.ambitionPath || "victory") === pk; return (
                              <button key={pk} onClick={() => setMl(s => ({ ...s, ambitionPath: pk, ambitionIdx: mlFirstUnmetRung(s, pk), showPathChooser: false }))}
                                style={{ textAlign: "left", padding: "6px 9px", borderRadius: 8, cursor: "pointer", background: cur ? "rgba(255,210,63,0.1)" : C.panel, border: `1.5px solid ${cur ? p.color : C.line}` }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: p.color }}>{p.icon} {p.label}{cur ? "（選択中）" : ""}</div>
                                <div style={{ fontSize: 10, color: C.sub }}>{p.desc}</div>
                              </button>
                            ); })}
                          </div>
                        )}
                        {amb ? (
                          <>
                            <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>🎯 いま目指す目標</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
                              <span style={{ fontFamily: FONT_D, fontSize: 13, color: "#e8a13c", fontWeight: 700 }}>{amb.label}</span>
                              <span style={{ fontFamily: FONT_M, fontSize: 12, color: C.text }}>{mlAmbitionProgressText(ml, amb)}</span>
                            </div>
                            <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>達成報酬：{[amb.reward.money ? `資金+${amb.reward.money}万` : null, amb.reward.pop ? `人気+${amb.reward.pop}` : null, amb.reward.ab ? `全能力+${amb.reward.ab}` : null, amb.reward.growth ? `成長力+${amb.reward.growth}段` : null].filter(Boolean).join("・")}</div>
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: C.yellow, fontWeight: 700, marginTop: 6 }}>🏆 「{path.label}」を極めた！別の生き方に挑戦できます</div>
                        )}
                        <div style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>{path.label}の達成度 {Math.min(idx, path.rungs.length)} / {path.rungs.length}</div>
                      </div>
                    </div>
                  );
                })()}
                {ml.flags?.mentorActive && (
                  <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.green}` }}>
                    <Eyebrow color={C.green}>🧑‍🏫 恩師の指導</Eyebrow>
                    <div style={{ fontSize: 11.5, color: C.text, marginTop: 4 }}>{ml.flags.mentorName}が新人指導中（練習・出走経験の伸び+15%）</div>
                    <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>3年目を迎えると一区切りを迎えます</div>
                  </div>
                )}
                <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
                  <Eyebrow color={"#e8a13c"}>個人スポンサー・人気度</Eyebrow>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>
                    人気度 <span style={{ fontFamily: FONT_M, color: "#e8a13c", fontWeight: 700 }}>{Math.round(ml.player.popularity || 0)}</span>/100
                    （個人スポンサー収入 月+{Math.floor((ml.player.popularity || 0) / 10) * 2}万円）
                  </div>
                  <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>好成績を残すほど上がり、25/50/75/100到達で一時金の契約ボーナスも入ります</div>
                </div>
                {ml.rival && (() => {
                  const ht = rivalHeatTier(ml.rivalRecord?.heat ?? ml.rivalRecord?.meetings ?? 0);
                  return (
                  <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${ht.color}` }}>
                    <Eyebrow color={ht.color}>🔥 {ht.label}</Eyebrow>
                    <div style={{ fontFamily: FONT_D, fontSize: 14, color: C.text, margin: "4px 0 2px" }}>{ml.rival.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>（{ml.rival.team}・{TYPES[ml.rival.type].label}）</span></div>
                    <div style={{ fontSize: 11, color: C.sub }}>
                      通算対戦成績：{ml.rivalRecord?.meetings || 0}戦 <span style={{ color: C.green }}>{ml.rivalRecord?.wins || 0}勝</span> <span style={{ color: C.red }}>{ml.rivalRecord?.losses || 0}敗</span>
                    </div>
                    {race.rivalPresent && <div style={{ fontSize: 11, color: C.yellow, marginTop: 3 }}>🔥 今月のレースにライバルも出走してくる</div>}
                  </div>
                  );
                })()}
                {ml.rival2 && (ml.rivalRecord2?.meetings || 0) > 0 && (() => {
                  const ht2 = rivalHeatTier(ml.rivalRecord2?.heat ?? ml.rivalRecord2?.meetings ?? 0);
                  return (
                  <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${ht2.color}` }}>
                    <Eyebrow color={ht2.color}>🔥 {ht2.label}（好敵手）</Eyebrow>
                    <div style={{ fontFamily: FONT_D, fontSize: 14, color: C.text, margin: "4px 0 2px" }}>{ml.rival2.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>（{ml.rival2.team}・{TYPES[ml.rival2.type].label}）</span></div>
                    <div style={{ fontSize: 11, color: C.sub }}>
                      通算対戦成績：{ml.rivalRecord2?.meetings || 0}戦 <span style={{ color: C.green }}>{ml.rivalRecord2?.wins || 0}勝</span> <span style={{ color: C.red }}>{ml.rivalRecord2?.losses || 0}敗</span>
                    </div>
                    {race.rival2Present && <div style={{ fontSize: 11, color: C.blue, marginTop: 3 }}>🔥 今月のレースに好敵手も出走してくる</div>}
                  </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div style={{ fontFamily: FONT_B }}>
            <Eyebrow color={C.sub}>📂 メニュー（月は進みません）</Eyebrow>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              <Btn small role="menu" onClick={() => setMl(s => ({ ...s, screen: "mylife_shop" }))}>🛍 ショップ</Btn>
              <Btn small role="menu" onClick={() => setMl(s => ({ ...s, screen: "mylife_achievements" }))}>🏆 実績 {computeAchievements(ml).filter(a => a.achieved).length}/{ML_ACHIEVEMENTS.length}</Btn>
              <Btn small role="menu" onClick={() => setMl(s => ({ ...s, screen: "mylife_teamroster" }))}>👥 チーム名鑑</Btn>
              <Btn small role="menu" onClick={() => setMl(s => ({ ...s, screen: "mylife_riderstats" }))}>📊 選手成績</Btn>
              <Btn small role="menu" onClick={() => setMl(s => ({ ...s, screen: "mylife_graph" }))}>📈 キャリアグラフ</Btn>
              <Btn small role="menu" onClick={() => setMl(s => ({ ...s, screen: "mylife_abilityfile" }))}>🗂 特殊能力図鑑</Btn>
              <Btn small role="menu" onClick={() => setMl(s => ({ ...s, screen: "mylife_records" }))}>🏅 コースレコード</Btn>
              <Btn small role="menu" onClick={() => setMl(s => ({ ...s, screen: "mylife_help" }))}>📖 ヘルプ</Btn>
            </div>
          </div>
          {/* v46(UI): 頻度が低く、かつ一部は取り返しがつかない操作なので折りたたみへ収納。
              「メンターになる」は前向きな意思決定で終了・消去の類ではないためdangerではなく
              menu扱い（色の意味＝「戻れない」を、離脱・消去系操作だけに絞るため）。 */}
          <div style={{ fontFamily: FONT_B }}>
            <button onClick={() => setMl(s => ({ ...s, uiOtherOpen: !s.uiOtherOpen }))}
              style={{ width: "100%", background: "none", border: `1px solid ${C.line}`, borderRadius: 8, color: C.sub, cursor: "pointer", padding: "9px 12px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5 }}>
              <span>⚙ その他・キャリア管理</span>
              <span style={{ fontWeight: 700 }}>{ml.uiOtherOpen ? "▲ 閉じる" : "▼ 開く"}</span>
            </button>
            {ml.uiOtherOpen && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
                {ml.flags?.mentor
                  ? <span style={{ fontSize: 11.5, color: C.yellow }}>🎖 チームの精神的支柱{ml.protege ? `・${ml.protege.name}の師` : ""}（毎月疲労-3／評価+0.3）</span>
                  : r.age >= 30 && (
                    <Btn small role="menu" onClick={() => askConfirm("若手のメンターになり、弟子を1人取りますか？弟子はあなたの地力に導かれて育っていきます。加えて毎月の疲労回復と監督評価の伸びも恒常的に上がります（一度なると元には戻せません）。", mlBecomeMentor)}>🎖 メンターになる（弟子を取る）</Btn>
                  )}
                <Btn small role="danger" onClick={() => askConfirm(`ラストレースに出場してから引退しますか？あなたの脚質に合ったグレード4のエキシビションで、ライバルたちも駆けつける最高の舞台です。走り終えるとそのまま引退となります。`, mlStartLastRace)}>🏁 ラストレースで引退</Btn>
                {/* v49(第11弾続き): 殿堂記録(mlRecordLegend)はここで直接呼ばない。以前はここでも
                    呼んでおり、"mylife_retired"遷移を検知するuseMyLifeGame.js側のuseEffectとの
                    二重呼び出しで、静かに引退するたび同じ選手が殿堂へ2回登録されるバグになっていた。
                    他の引退経路（ラストレース／引退勧告）と同じくuseEffect側の一本化した処理に委ねる。 */}
                <Btn small role="danger" onClick={() => askConfirm(`${r.age}歳で現役を引退しますか？この操作は取り消せません（キャリアの記録はセレモニー画面で振り返れます）。`, () => setMl(s => ({ ...s, screen: "mylife_retired" })))}>🚪 静かに引退</Btn>
                {/* v36(#6): ライバル会話ドラマ（紙芝居/VN風）の on/off トグル */}
                <Btn small role="menu" onClick={() => setMl(s => ({ ...s, rivalDramaOn: s.rivalDramaOn === false }))}>🎭 会話ドラマ：{ml.rivalDramaOn === false ? "非表示" : "表示中"}</Btn>
                <Btn small role="danger" onClick={() => askConfirm("マイライフを最初からやり直しますか？現在の選手の保存データは消えます（歴代の殿堂記録は残ります）。", () => { clearMyLifeSave(); setMl(initMyLife()); })}>🔄 最初からやり直す</Btn>
                <Btn small role="menu" onClick={() => askConfirm("マイライフモードを終了してタイトルに戻りますか？（自動セーブ済み）", () => setSuperMode(null))}>← タイトルに戻る</Btn>
              </div>
            )}
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
