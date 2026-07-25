// シーズンモードの画面ディスパッチ（Phase 4-2で App から分離）。ctx=App状態/ハンドラ。
import React from "react";
import { loadMlLegends, mlBreedBonus } from "../breeding/breeding.js";
import { RaceErrorBoundary, RaceView } from "../components/RaceView.jsx";
import { AbilityFileList, AbilityGrid, BlurGrid, CondFc, CourseRecordsPanel, DisciplineGrid, ElevationChart, FatigueBar, MultiStageCourseView, PersonaLine, StartListPanel, SubStatLine, TitlesPanel, TraitLine } from "../components/panels.jsx";
import { Btn, Eyebrow } from "../components/ui.jsx";
import { fmtGap, fmtRelTime, fmtTime, overall } from "../core/core.js";
import { ABILITIES, AB_KEYS, AB_LABEL, COND_ARROW, COND_COLOR, GROWTH, POW, TYPES, TYPE_ROLE_FIT } from "../data/abilities.js";
import { CHASE_MODES, HOME_ABILITY_BONUS, MONTHS, ROLES, SEG_AB, SEG_COLOR, UNLOCK_TEMPLATES } from "../data/course.js";
import { EQUIPS, EQUIP_COST, ITEMS } from "../data/items.js";
import { CLASSES, DIFFICULTIES } from "../data/progression.js";
import { C, FONT_B, FONT_D, FONT_M } from "../data/theme.js";
import { CHEMISTRY_TIERS, CP_MILESTONES, DISCIPLINES, FAVORS_TO_DISCIPLINE, GRADE_MUL, OB_COACH_SALARY, PRIZES, PTS, SCOUT_POLICIES, SEASON_ACHIEVEMENTS, SLOT_LABEL, STAFF_ROLES, STAFF_SALARY_PER_LV, TYPE_COACH_ABILITY, WEATHER, applyCpMilestones, addProdigyRookie, bumpEquipLv, bumpRosterAbAll, buildSim, clearSaveGame, computeClearPoints, computeSeasonAchievements, computeStandings, disciplineScore, formatAchievementReward, groupModeFor, growthPhase, hasSaveGame, loadAbilityFile, mlGradeColor, pickMandateMonths, genSeasonObjective, objectiveStatusText, potentialHint, raceIsHome, riderFlavorText, rivalNews, seasonTitleRace, STAFF_META, staffEffectText, staffMemberName, staffSalaryTotal, standingsRankReward, t_label, teamChemistryTier } from "../logic/support.js";
import { PARTS, PART_SLOTS, effAbilities, generateCourse } from "../sim/race.js";
import { computePrestige, cpShopSeasonPerks, genMonthRaces, genScouts, initGame, legendToSeasonRider, loadGame, loadMeta, riderCareerSummary, riderNickname, saveGame, saveGameInfo, saveMeta } from "../state/state.js";

export function renderSeasonScreens(ctx) {
  const { acceptTrade, advanceMonth, askConfirm, availParts, breedYouthSel, buyEquip, buyItem, buyPart, cls, declineTrade, diffChoice, dismissObCoach, equipMax, expandedRiderId, g, grantTransferRequest, growthCap, healthy, hireObCoach, hireStaff, openRename, raceFinishHandler, releaseRider, resolveEvent, retainRider, poachRetain, poachAccept, poachSign, rosterMax, setBreedYouthSel, setCaptain, setDiffChoice, setExpandedRiderId, setFocus, setG, setPart, setSuperMode, setTeamNameChoice, signBredYouth, signFa, signScout, signYouthProspect, staffMax, startNextStage, startRace, teamNameChoice, toggleFavorite, useCamp, useSupp, useTune, wrap } = ctx;
  if (g.screen === "intro") return wrap(
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 18, border: `1px solid ${C.line}` }}>
        <Eyebrow>SEASON MODE v12</Eyebrow>
        <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 23, margin: "6px 0 10px" }}>B1からPROの頂点へ</h2>
        <p style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.8, margin: 0 }}>
          1年＝1シーズン、出場は月1回。3月のチャンピオンシップ3位以内で昇格。PROクラスのみ年3戦のグランツール
          （春・夏・秋）が開催され、その全戦制覇がグランファイナルへの出場条件。グランファイナル優勝でクリア。
        </p>
      </div>
      {hasSaveGame() && (() => {
        const info = saveGameInfo();
        return (
          <Btn onClick={() => { const loaded = loadGame(); if (loaded) setG(loaded); }}>
            💾 続きから
            {info && <span style={{ display: "block", fontSize: 10.5, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>{info.teamName}・{info.classLabel}・{info.year}年目{info.savedAt ? ` — ${fmtRelTime(info.savedAt)}に保存` : ""}</span>}
          </Btn>
        );
      })()}
      <Btn outline={hasSaveGame()} onClick={() => {
        const doReset = () => { clearSaveGame(); setG(s => ({ ...initGame(), screen: "newgame_setup" })); };
        if (hasSaveGame()) askConfirm("保存データを消して最初から始めます。よろしいですか？", doReset);
        else doReset();
      }}>
        {hasSaveGame() ? "最初から（保存データは消えます）" : "スカウト方針の確認へ"}
      </Btn>
    </div>
  );

  if (g.screen === "newgame_setup") {
    const meta = loadMeta();
    const nextMilestone = CP_MILESTONES.find(m => meta.totalEarnedCP < m.cp);
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, border: `1px solid ${C.line}` }}>
          <Eyebrow color={C.yellow}>累計クリアポイント：{meta.totalEarnedCP}pt</Eyebrow>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>過去のプレイでクリアするたびに貯まっていく生涯合計値です。一度到達した永続ボーナス・難易度は消費しても失われません。</div>
        </div>
        <div>
          <Eyebrow>チーム名</Eyebrow>
          <input type="text" value={teamNameChoice} maxLength={16} placeholder="あなたのチーム"
            onChange={e => setTeamNameChoice(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 6, background: C.panel2, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FONT_B }} />
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>レース・順位表・記録に表示されます（未入力なら「あなたのチーム」・後からショップで変更可）。</div>
        </div>
        <div>
          <Eyebrow>難易度を選択</Eyebrow>
          <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
            {DIFFICULTIES.map(d => {
              const locked = meta.totalEarnedCP < d.needCP;
              return (
                <button key={d.id} disabled={locked} onClick={() => setDiffChoice(d.id)}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: locked ? "default" : "pointer",
                    background: diffChoice === d.id ? "rgba(255,210,63,0.12)" : C.panel,
                    border: `1.5px solid ${diffChoice === d.id ? C.yellow : C.line}`, opacity: locked ? 0.5 : 1,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 14 }}>{d.label}</span>
                    {locked && <span style={{ fontSize: 11, color: C.red }}>🔒 累計{d.needCP}pt必要</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{d.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
        {(() => {
          // v38(#9 A-2): マイライフで育てた殿堂選手を、シーズンの創設メンバーとして1名招聘できる。
          // 「選手として育てた英雄を、監督として率いる」A案の核心ループ。全盛期をやや過ぎたベテランとして加入。
          const legends = [...loadMlLegends()].reverse();
          if (legends.length === 0) return null;
          const selIdx = g.legendRecruitIdx;
          return (
            <div>
              <Eyebrow color={"#e56cc8"}>🌳 レジェンド招聘（マイライフで育てた名選手を1名迎える）</Eyebrow>
              <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 6px", lineHeight: 1.5 }}>あなたが選手として育て上げ引退した英雄を、監督として率いるチームの創設メンバーに迎えられます（全盛期をやや過ぎたベテランとして加入・任意）。</div>
              <div style={{ display: "grid", gap: 5, maxHeight: 210, overflowY: "auto" }}>
                {legends.map((leg, i) => {
                  const sel = selIdx === i;
                  return (
                    <button key={i} onClick={() => setG(s => ({ ...s, legendRecruitIdx: sel ? null : i }))}
                      style={{ textAlign: "left", padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                        background: sel ? "rgba(229,108,200,0.12)" : C.panel, border: `1.5px solid ${sel ? "#e56cc8" : C.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{sel ? "✔ " : ""}{leg.name}<span style={{ marginLeft: 6, fontSize: 10, color: TYPES[leg.type]?.color }}>{TYPES[leg.type]?.label}</span></span>
                        <span style={{ fontSize: 10.5, color: C.sub }}>OVR{leg.overall || "—"}{(leg.generation || 0) > 0 ? ` ・🧬${leg.generation}代目` : ""}</span>
                      </div>
                      {leg.nickname && <div style={{ fontSize: 10, color: C.purple, fontStyle: "italic" }}>「{leg.nickname}」</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
        <div>
          <Eyebrow>永続ボーナス（累計クリアポイントで自動解禁・消費なし）</Eyebrow>
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {CP_MILESTONES.map((m, i) => {
              const unlocked = meta.totalEarnedCP >= m.cp;
              const jackpot = m.label.startsWith("★");
              const accent = jackpot ? C.yellow : C.green;
              return (
                <div key={i} style={{
                  padding: jackpot ? "11px 12px" : "9px 12px", borderRadius: 10,
                  background: unlocked ? (jackpot ? "rgba(255,210,63,0.12)" : "rgba(125,208,160,0.1)") : C.panel,
                  border: `${jackpot ? 2 : 1.5}px solid ${unlocked ? accent : C.line}`, opacity: unlocked ? 1 : (jackpot ? 0.75 : 0.6),
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: unlocked ? accent : C.text, fontSize: jackpot ? 14.5 : 13.5 }}>
                      {unlocked ? "✔ " : "🔒 "}{m.label}
                    </span>
                    <span style={{ fontFamily: FONT_M, fontSize: 11.5, color: C.sub }}>累計{m.cp}pt</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{m.desc}</div>
                </div>
              );
            })}
          </div>
          {nextMilestone && <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>次のボーナスまであと{nextMilestone.cp - meta.totalEarnedCP}pt</div>}
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, border: `1px solid ${C.line}` }}>
          <Eyebrow color={C.green}>🏁 解禁コンテンツ（累計CPで新コース種別が出現）</Eyebrow>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {UNLOCK_TEMPLATES.map(t => {
              const unlocked = meta.totalEarnedCP >= t.unlockCP;
              return (
                <div key={t.kind} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, opacity: unlocked ? 1 : 0.55 }}>
                  <span style={{ color: unlocked ? C.text : C.sub }}>{unlocked ? "✅" : "🔒"} {t.kind}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>{TYPES[t.favors].label}有利</span></span>
                  <span style={{ fontFamily: FONT_M, fontSize: 11, color: unlocked ? C.green : C.sub }}>{unlocked ? "解禁済み" : `${t.unlockCP}ptで解禁`}</span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>解禁するとシーズン・マイライフ両モードのカレンダーに登場します。</div>
        </div>
        <Btn onClick={() => {
          const name = teamNameChoice.trim();
          let base = applyCpMilestones({ ...initGame(), difficulty: diffChoice, teamName: name || "あなたのチーム" }, meta.totalEarnedCP);
          // v37: CPショップで購入済みのシーズン特典を適用
          const shop = cpShopSeasonPerks(meta);
          for (let i = 0; i < shop.prodigyRookie; i++) base = addProdigyRookie(base);
          if (shop.budget) base = { ...base, budget: base.budget + shop.budget };
          if (shop.equipLv) base = bumpEquipLv(base, shop.equipLv);
          if (shop.rosterBoost) base = bumpRosterAbAll(base, shop.rosterBoost);
          // v38(#9 A-2): 招聘したレジェンドを創設メンバーとしてロースターへ加える
          if (g.legendRecruitIdx != null) {
            const legends = [...loadMlLegends()].reverse();
            const leg = legends[g.legendRecruitIdx];
            const recruit = leg && legendToSeasonRider(leg);
            if (recruit) base = { ...base, roster: [...base.roster, recruit], captainId: recruit.id };
          }
          setG({ ...base, legendRecruitIdx: null, screen: "scoutpolicy_initial" });
        }}>この内容でゲーム開始 →</Btn>
        <Btn outline color={C.red} onClick={() => {
          // v14.11: 生涯合計値の消去は取り消せないため、二重確認（2段階の確認モーダル）を挟む
          askConfirm(
            `累計クリアポイント（${meta.totalEarnedCP}pt）と、それに紐づく永続ボーナス・難易度解禁をすべて消去します。この操作は取り消せません。よろしいですか？`,
            () => askConfirm(
              "本当によろしいですか？もう一度確認します。クリアポイントは元に戻せません。",
              () => { saveMeta({ totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] }); setDiffChoice("easy"); setG(s => ({ ...s })); }
            )
          );
        }}>クリアポイントをリセット（累計{meta.totalEarnedCP}pt消去）</Btn>
      </div>
    );
  }

  if (g.screen === "scoutpolicy_initial") return wrap(
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#1f2b26", border: `1px solid ${C.green}`, borderRadius: 10, padding: "10px 14px" }}>
        <Eyebrow color={C.green}>SCOUT POLICY — 初年度（4月）のスカウト方針</Eyebrow>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>4月に提示される新人候補5名の傾向を決めます。方針は毎年3月にも見直せます。</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(SCOUT_POLICIES).map(([k, p]) => (
          <button key={k} onClick={() => setG(s => ({ ...s, scoutPolicy: k }))} title={p.desc}
            style={{
              padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT_D,
              background: g.scoutPolicy === k ? C.purple : C.panel, color: g.scoutPolicy === k ? "#14171d" : C.sub,
              border: `1px solid ${g.scoutPolicy === k ? C.purple : C.line}`,
            }}>{p.label}</button>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: C.text }}>方針：{SCOUT_POLICIES[g.scoutPolicy].desc}</div>
      {/* v12バグ修正: initGame()の初期スカウト候補を先にランダム化しても、ここで固定シード4001を
          使ってgenScoutsを呼び直し上書きしていたため、方針決定ボタンを押すと結局毎回同じ顔ぶれに
          戻ってしまっていた。ここも新規ゲームのたびに変わる乱数シードを使うよう修正 */}
      <Btn onClick={() => setG(s => ({ ...s, scouts: genScouts(0, Date.now() % 999983, s.scoutPolicy, s.roster.map(r => r.name), s.staff?.scout || 0), screen: "sponsor" }))}>この方針で決定 → スポンサー選択へ</Btn>
    </div>
  );

  if (g.screen === "sponsor") return wrap(
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: C.panel, borderRadius: 10, padding: "10px 14px", borderLeft: `4px solid ${C.green}` }}>
        <Eyebrow color={C.green}>SPONSOR — 今季のメインスポンサーを選択</Eyebrow>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>毎月の契約金＋ノルマ達成で年度末ボーナス。<span style={{ color: C.red }}>未達なら違約金</span>、<span style={{ color: C.red }}>指定レースを見送るとさらに違約金</span>が加算されます。</div>
      </div>
      {g.sponsorOffers.map((sp, i) => {
        // v40（第1候補②）：各スポンサーが複数レースにまたがる「中期目標」を提示（画面表示と契約時で同じシード）
        const objSeed = g.year * 7919 + i * 313 + g.classIdx * 17;
        const proposed = genSeasonObjective(objSeed, g.classIdx);
        const om = objectiveStatusText(proposed);
        return (
        <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontFamily: FONT_D, fontSize: 16, fontWeight: 700, color: C.text }}>{sp.name}</div>
            <span style={{ fontSize: 11, color: sp.style === "挑戦型" ? C.red : sp.style === "安定型" ? C.blue : C.yellow }}>{sp.style}</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.sub, margin: "4px 0 8px", lineHeight: 1.7 }}>
            月額 <span style={{ color: C.green, fontFamily: FONT_M }}>+{sp.monthly}万</span>
            ／ノルマ <span style={{ color: C.yellow, fontFamily: FONT_M }}>{sp.norma}pt</span><br />
            達成 <span style={{ color: C.green, fontFamily: FONT_M }}>+{sp.bonus}万</span>
            ／未達 <span style={{ color: C.red, fontFamily: FONT_M }}>-{sp.penalty}万</span><br />
            年間指定レース <span style={{ color: C.text, fontFamily: FONT_M }}>{sp.mandates}回</span>（出場でpt+30%ボーナス／見送ると-15万ずつ加算）
          </div>
          {om && (
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "7px 10px", margin: "0 0 9px", borderLeft: `3px solid ${C.purple}` }}>
              <div style={{ fontSize: 11.5, color: C.purple, fontWeight: 700 }}>🎯 中期目標「{om.icon} {om.label}」<span style={{ color: C.sub, fontWeight: 400 }}>（〜{MONTHS[om.deadline]}）</span></div>
              <div style={{ fontSize: 12, color: C.text, marginTop: 2, lineHeight: 1.5 }}>{om.desc}</div>
              <div style={{ fontSize: 11.5, marginTop: 3 }}>
                <span style={{ color: C.green }}>達成 +{proposed.budget}万・ノルマ+{proposed.points}pt</span>
                <span style={{ color: C.sub }}> ／ </span>
                <span style={{ color: C.red }}>未達 -{proposed.penalty}万</span>
              </div>
            </div>
          )}
          <Btn small color={C.green} onClick={() => setG(s => {
            const months = pickMandateMonths(sp.mandates, s.year * 555 + i * 91 + s.classIdx * 13);
            const objective = genSeasonObjective(s.year * 7919 + i * 313 + s.classIdx * 17, s.classIdx);
            const sponsor = { ...sp, mandateMonths: months, mandatesMet: 0, mandatesMissed: 0, objective };
            const om2 = objectiveStatusText(objective);
            return { ...s, sponsor, screen: "main", log: [...s.log, `【${MONTHS[s.month]}】${sp.name}と契約（ノルマ${sp.norma}pt／違約金${sp.penalty}万／指定レース${months.length}回／中期目標「${om2.label}」）`] };
          })}>この契約を結ぶ</Btn>
        </div>
        );
      })}
    </div>
  );

  if (g.screen === "main") {
    let body = null;
    if (g.tab === "home") {
      const isMandateMonth = g.sponsor && g.sponsor.mandateMonths.includes(g.month);
      body = (
        <div style={{ display: "grid", gap: 10 }}>
          {g.budget < 0 && <div style={{ background: "#2e2124", border: `1px solid ${C.red}`, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: C.red }}>💸 借金状態です。賞金とスポンサー収入で返済しましょう（返済まで買い物不可）。</div>}
          {isMandateMonth && (
            <div style={{ background: "#2e2124", border: `1px solid ${C.red}`, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: C.red }}>
              🎯 今月はスポンサー指定月間です。下の🎯マーク付きレースに出場するとポイント+30%、見送ると違約金-15万が年度末に加算されます。
            </div>
          )}
          {/* v40（第1候補②）：シーズン中期目標。複数レースにまたがるスポンサーの約束と進捗を常時表示 */}
          {(() => {
            const om = objectiveStatusText(g.sponsor && g.sponsor.objective);
            if (!om) return null;
            const obj = g.sponsor.objective;
            const col = om.status === "done" ? C.green : om.status === "failed" ? C.red : C.purple;
            const remain = om.status === "active" ? Math.max(0, om.deadline - g.month) : null;
            return (
              <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), transparent)", borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, borderLeft: `3px solid ${col}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Eyebrow color={col}>🎯 中期目標 — {om.icon} {om.label}</Eyebrow>
                  <span style={{ fontFamily: FONT_M, fontSize: 12, color: col, fontWeight: 700 }}>
                    {om.status === "done" ? "達成✓" : om.status === "failed" ? "未達" : `${obj.progress} / ${obj.need}`}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.text, marginTop: 3, lineHeight: 1.5 }}>{om.desc}</div>
                {om.status === "active" && (
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>
                    期限：{MONTHS[om.deadline]}まで（残り{remain}ヶ月）／達成報酬 <span style={{ color: C.green }}>+{obj.budget}万・ノルマ+{obj.points}pt</span> ／未達 <span style={{ color: C.red }}>-{obj.penalty}万</span>
                  </div>
                )}
              </div>
            );
          })()}
          {g.month === 11 && (
            <div style={{ background: "#2b2436", border: `1px solid ${C.purple}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 13, color: C.purple, fontWeight: 700 }}>3月 — チャンピオンシップ月間／来季スカウト方針の決定</div>
              <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                {Object.entries(SCOUT_POLICIES).map(([k, p]) => (
                  <button key={k} onClick={() => setG(s => ({ ...s, scoutPolicy: k }))} title={p.desc}
                    style={{
                      padding: "5px 9px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT_D,
                      background: g.scoutPolicy === k ? C.purple : C.panel, color: g.scoutPolicy === k ? "#14171d" : C.sub,
                      border: `1px solid ${g.scoutPolicy === k ? C.purple : C.line}`,
                    }}>{p.label}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>方針：{SCOUT_POLICIES[g.scoutPolicy].desc}（4月の候補5名に反映）</div>
            </div>
          )}
          {g.month === 0 && <div style={{ background: "#1f2b26", border: `1px solid ${C.green}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, color: C.green }}>4月 — 新人スカウト月間（方針：{SCOUT_POLICIES[g.scoutPolicy].label}）</div>}
          {/* v35(シーズン深掘り): タイトル争い。順位表を物語化し、シーズンを通した優勝争いの緊張感を出す */}
          {(() => {
            const tr = seasonTitleRace(g);
            if (!tr) return null;
            const col = tr.isLeader ? C.yellow : tr.rank <= 3 ? C.green : C.blue;
            return (
              <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), transparent)", borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, borderLeft: `3px solid ${col}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Eyebrow color={col}>🏆 タイトル争い</Eyebrow>
                  <span style={{ fontFamily: FONT_M, fontSize: 12, color: col, fontWeight: 700 }}>{tr.rank}位 / {tr.total}</span>
                </div>
                <div style={{ fontSize: 12, color: C.text, marginTop: 3, lineHeight: 1.5 }}>{tr.line}</div>
                {(tr.ahead || tr.behind) && (
                  <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {tr.ahead && <span>🎯 追う相手：{tr.ahead.name}{tr.ahead.trait ? `（${tr.ahead.trait}）` : ""}</span>}
                    {tr.behind && <span>👀 背後：{tr.behind.name}{tr.behind.trait ? `（${tr.behind.trait}）` : ""}</span>}
                  </div>
                )}
              </div>
            );
          })()}
          {(() => { const news = rivalNews(g.year, g.month); return (
            <div style={{ background: C.panel2, borderRadius: 10, padding: "8px 12px", borderLeft: `3px solid ${news.color}` }}>
              <Eyebrow color={C.sub}>📰 他チーム動向</Eyebrow>
              <div style={{ fontSize: 12, color: C.text, marginTop: 3 }}>{news.text}</div>
            </div>
          ); })()}
          {/* v34(UI): 今月のチーム状態をレース選びの直上に出し、タブ切替なしで「出場か休養か」を判断できるように */}
          {(() => {
            const inj = g.roster.filter(r => r.injury > 0);
            const avgFat = Math.round(g.roster.reduce((s, r) => s + (r.fatigue || 0), 0) / Math.max(1, g.roster.length));
            const tired = g.roster.filter(r => r.injury === 0 && (r.fatigue || 0) >= 80).length;
            const fatColor = avgFat >= 70 ? C.red : avgFat >= 45 ? "#e8a13c" : C.green;
            return (
              <div style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.line}`, display: "flex", flexWrap: "wrap", gap: "2px 14px", alignItems: "center", fontSize: 12 }}>
                <span style={{ color: C.sub }}>🚴 今月のチーム状態</span>
                <span style={{ color: C.text }}>出走可能 <b style={{ color: healthy.length > 0 ? C.green : C.red, fontFamily: FONT_M }}>{healthy.length}</b>/{g.roster.length}名</span>
                <span style={{ color: C.text }}>平均疲労 <b style={{ color: fatColor, fontFamily: FONT_M }}>{avgFat}</b></span>
                {tired > 0 && <span style={{ color: "#e8a13c" }}>疲労高 {tired}名</span>}
                {inj.length > 0 && <span style={{ color: C.red }}>🩹 故障 {inj.map(r => `${r.name}(${r.injury}ヶ月)`).join("・")}</span>}
                {g.camp && <span style={{ color: C.purple }}>⛺ キャンプ実施中</span>}
              </div>
            );
          })()}
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
          {/* v28: 縦積みだった閲覧・管理系ボタンを折り返しの小ボタン群にまとめて縦の長さを圧縮 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Btn small outline color={C.blue} onClick={() => setG(s => ({ ...s, screen: "program" }))}>📅 年間プログラム</Btn>
            <Btn small outline color={C.purple} onClick={() => setG(s => ({ ...s, screen: "standings" }))}>📊 順位表</Btn>
            <Btn small outline color={"#e8a13c"} onClick={() => setG(s => ({ ...s, screen: "trophy" }))}>🏆 トロフィールーム</Btn>
            <Btn small outline color={C.green} onClick={() => {
              const ok = saveGame(g);
              setG(s => ({ ...s, log: [...s.log, ok ? `【${MONTHS[s.month]}】セーブしました` : "セーブに失敗しました（ブラウザの保存領域を確認してください）"] }));
            }}>💾 セーブ</Btn>
            <Btn small outline color={C.sub} onClick={() => {
              askConfirm("タイトルに戻ります。セーブ済みのデータは消えません。よろしいですか？", () => {
                setG(s => ({ ...s, screen: "intro" }));
                setSuperMode(null);
              });
            }}>🏠 タイトルに戻る</Btn>
          </div>
          {g.log.length > 0 && (
            <div style={{ background: C.panel2, borderRadius: 10, padding: "8px 12px" }}>
              <Eyebrow color={C.sub}>TEAM LOG</Eyebrow>
              {g.log.slice(-4).map((l, i) => <div key={i} style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>{l}</div>)}
            </div>
          )}
        </div>
      );
    }
    if (g.tab === "riders") {
      const chem = teamChemistryTier(g.roster);
      body = (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, color: C.sub }}>
            所属 {g.roster.length}/{rosterMax}名。<span style={{ color: C.yellow }}>能力{growthCap}以上＝限界突破</span>（金色表示・成長が大幅に鈍化。難易度「{(DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).label}」の成長上限）。練習指定能力の伸びはトレードオフ（×0.9）で指定外に一部融通されます。
          </div>
          {(() => {
            // v35(シーズン深掘り): ケミストリーの育ちを可視化。次のティアまでの進捗バー＋昇格後の効果
            const next = [...CHEMISTRY_TIERS].sort((a, b) => a.min - b.min).find(t => t.min > chem.min);
            const pct = next ? Math.max(0, Math.min(1, (chem.avgTenure - chem.min) / (next.min - chem.min))) : 1;
            return (
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 11.5, color: C.sub }}>🤝 チームケミストリー </span>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 13.5, color: C.green }}>{chem.label}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.sub }}>平均在籍{chem.avgTenure.toFixed(1)}ヶ月{chem.mul < 1 ? `／ドラフト消耗-${Math.round((1 - chem.mul) * 100)}%` : ""}</div>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: C.line, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ width: `${pct * 100}%`, height: "100%", background: C.green, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 10, color: C.sub, marginTop: 3 }}>
                  {next ? `次の絆「${next.label}」まで平均在籍あと${Math.max(0, next.min - chem.avgTenure).toFixed(1)}ヶ月（メンバーを固定して走り込むほど深まる）` : "最高の絆に到達。長く共に走った証だ。"}
                </div>
              </div>
            );
          })()}
          {/* v35(シーズン深掘り): スタッフ陣を一目で。雇用中の各スタッフを名前付きで並べる */}
          {(() => {
            const hired = Object.entries(g.staff || {}).filter(([, lv]) => lv > 0);
            if (hired.length === 0 && !g.obCoach) return null;
            return (
              <div style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.line}` }}>
                <span style={{ fontSize: 11, color: C.sub }}>🏳 スタッフ陣：</span>
                <span style={{ fontSize: 11.5, color: C.text }}>
                  {hired.length === 0 ? "（一般スタッフ未雇用）" : hired.map(([k, lv]) => `${(STAFF_META[k] || {}).icon || ""}${staffMemberName(g.teamName, k)}${(STAFF_META[k] || {}).title || k}Lv${lv}`).join("・")}
                  {g.obCoach && <span style={{ color: "#e8a13c" }}>{hired.length > 0 ? "・" : ""}🎓{g.obCoach.name}コーチ</span>}
                </span>
              </div>
            );
          })()}
          <div style={{ fontSize: 11, color: C.sub }}>🎖 各選手カードのマークで主将を1名任命できます。主将より2歳以上若い選手は練習効果+10%になります。</div>
          {g.inv.camp > 0 && !g.camp && <Btn small outline color={C.purple} onClick={() => askConfirm("キャンプを実施しますか？今月の練習効果が×2になりますが、選手全員の疲労が+25されます（連発すると故障リスクが高まります）。", useCamp)}>⛺ キャンプ券を使う（今月の練習効果×2・全員疲労+25）</Btn>}
          {g.camp && <div style={{ fontSize: 12, color: C.purple }}>⛺ 今月はトレーニングキャンプ実施中（練習効果×2）</div>}
          {!g.youthUsed && g.roster.length < rosterMax && g.budget >= 15 && (
            <Btn small outline color={C.green} onClick={() => askConfirm("ユース候補を1名確保しますか？契約金15万円。現在の能力は控えめですが、成長力（growthPow A以上）が保証された若手（16〜17歳）です。", signYouthProspect)}>
              🌱 ユース選手を獲得する（契約金15万円・年1回限り）
            </Btn>
          )}
          {/* v31.1: 血統ユース（配合）。マイライフ殿堂の2名を親に選び、配合の原石を確保する */}
          {!g.youthUsed && g.roster.length < rosterMax && (() => {
            const legends = loadMlLegends();
            if (legends.length < 2) return null;
            const sel = breedYouthSel;
            const legA = sel ? legends[sel.a] : null;
            const legB = sel && sel.b !== sel.a ? legends[sel.b] : null;
            const breed = (legA && legB) ? mlBreedBonus(legA, legB) : null;
            return (
              <div style={{ background: "linear-gradient(180deg,#2a2436,#22202f)", borderRadius: 10, padding: "10px 12px", border: `1px solid #e56cc8` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: FONT_D, fontSize: 12.5, fontWeight: 700, color: "#e56cc8" }}>🧬 血統ユース（配合・契約金40万）</span>
                  <Btn small outline color={"#e56cc8"} onClick={() => setBreedYouthSel(sel ? null : { a: 0, b: legends.length > 1 ? 1 : 0 })}>{sel ? "閉じる" : "親を選ぶ"}</Btn>
                </div>
                <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>マイライフ殿堂の名選手2名を親に配合の原石を確保。相性・血の濃さ・累代+値・金特クロスの恩恵が乗ります。</div>
                {sel && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {[["a", "親A"], ["b", "親B"]].map(([key, lbl]) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: C.sub, width: 32 }}>{lbl}</span>
                        <select value={sel[key]} onChange={e => { const v = parseInt(e.target.value); setBreedYouthSel(s => ({ ...s, [key]: v })); }}
                          style={{ flex: 1, background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 6px", fontSize: 12 }}>
                          {legends.map((l, i) => <option key={i} value={i}>{l.name}（{TYPES[l.type]?.label || l.type}{(l.generation || 0) > 0 ? `・${l.generation}代目+${l.plusValue || 0}` : ""}）</option>)}
                        </select>
                      </div>
                    ))}
                    {sel.a === sel.b && <div style={{ fontSize: 10.5, color: C.red }}>※ 異なる2名を選んでください</div>}
                    {breed && (
                      <div style={{ background: C.panel2, borderRadius: 8, padding: "7px 9px", fontSize: 11, color: C.text, lineHeight: 1.7 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: C.sub }}>配合評価</span>
                          <span style={{ fontFamily: FONT_M, fontWeight: 800, fontSize: 15, color: mlGradeColor(breed.matingGrade) }}>{breed.matingGrade}</span>
                          <span style={{ fontSize: 10, color: C.sub }}>爆発力 <span style={{ fontFamily: FONT_M, color: C.yellow }}>{breed.bakuhatsu}</span></span>
                          {(breed.growthSteps > 0 || breed.talentCap > 0) && <span style={{ fontSize: 10, color: "#9ae6b4" }}>{breed.growthSteps > 0 ? `成長力+${breed.growthSteps}` : ""}{breed.growthSteps > 0 && breed.talentCap > 0 ? "・" : ""}{breed.talentCap > 0 ? `才能+${breed.talentCap}` : ""}</span>}
                        </div>
                        {breed.special && <div style={{ color: breed.special.color, fontWeight: 800 }}>🌟 特殊配合『{breed.special.title}』</div>}
                        {breed.danger > 0 && <div style={{ color: breed.danger >= 38 ? C.red : "#e8a13c", fontSize: 10.5 }}>⚠️ 危険度 {breed.dangerLabel}（約{breed.danger}%）ガラスの体リスク{breed.healthMit > 0 ? "（健康な血で軽減）" : ""}</div>}
                        <div>相性 <span style={{ color: breed.nick.rank === "◎" ? C.yellow : breed.nick.rank === "○" ? C.green : C.sub, fontWeight: 700 }}>{breed.nick.rank} {breed.nick.label}</span></div>
                        <div>累代+値 <span style={{ color: C.yellow }}>+{breed.plusPer}</span>{breed.inbreed.count > 0 && <span style={{ color: C.red }}>・🩸インブリード×{breed.inbreed.count}</span>}{breed.goldInherit && breed.goldInherit.length > 0 && <span style={{ color: C.yellow }}>・✨金特クロス</span>}{breed.exclusive && breed.exclusive.length > 0 && <span style={{ color: "#e56cc8" }}>・🩸{breed.exclusive.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")}</span>}</div>
                        <div style={{ color: C.sub }}>継承特能：{breed.extraAbilities.length ? breed.extraAbilities.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・") : "—"}</div>
                        {breed.archNotes && breed.archNotes.length > 0 && <div style={{ color: "#e8a13c" }}>血の格：{breed.archNotes.join("・")}</div>}
                      </div>
                    )}
                    <Btn small color={"#e56cc8"} disabled={!breed || g.budget < 40} onClick={() => askConfirm(`${legA.name}×${legB.name}の配合で血統ユースを確保しますか？契約金40万円（年1回のユース枠を消費）。`, () => signBredYouth(legA, legB))}>
                      {g.budget < 40 ? "資金不足（40万円必要）" : "🧬 この配合で確保する（40万円）"}
                    </Btn>
                  </div>
                )}
              </div>
            );
          })()}
          {g.youthUsed && <div style={{ fontSize: 11, color: C.sub }}>🌱 ユース育成枠は今年度使用済み（来年4月にリセット）</div>}
          {g.month === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>4月は選手の解雇が可能です（各選手カードの「解雇」ボタン）。</div>}
          {g.roster.map(r => {
            const t = TYPES[r.type], ph = growthPhase(r);
            return (
              <div key={r.id} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${r.injury > 0 ? C.red : C.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>{r.name}</span>
                    <button onClick={() => openRename("選手名を変更", r.name, v => setG(s => ({ ...s, roster: s.roster.map(x => x.id === r.id ? { ...x, name: v } : x) })))} title="名前を変更" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, marginLeft: 4, padding: 0, opacity: 0.7 }}>✏️</button>
                    {r.id === g.captainId && <span style={{ marginLeft: 5, fontSize: 10.5, color: "#14171d", background: C.yellow, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>🎖 主将</span>}
                    {r.age <= 18 && <span style={{ marginLeft: 5, fontSize: 10.5, color: "#14171d", background: C.green, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>🌱 ユース</span>}
                    {r.isLegendRecruit && <span style={{ marginLeft: 5, fontSize: 10.5, color: "#14171d", background: "#e56cc8", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }} title={r.legendNickname ? `「${r.legendNickname}」` : ""}>🌳 招聘レジェンド</span>}
                    <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color, border: `1px solid ${t.color}`, borderRadius: 4, padding: "1px 5px" }}>{t.label}</span>
                    <span style={{ marginLeft: 5, fontFamily: FONT_M, fontSize: 12, color: POW[r.growthPow].color }}>成長{r.growthPow}</span>
                    <span style={{ marginLeft: 5, fontSize: 11, color: potentialHint(r).color }}>{potentialHint(r).label}</span>
                    {/* v35(シーズン深掘り): 現在の成長フェーズを明示（育成の手応え） */}
                    <span style={{ marginLeft: 5, fontSize: 10.5, color: ph.tag === "成長期" ? C.green : ph.tag === "全盛期" ? C.yellow : "#e8734a" }}>
                      {ph.tag === "成長期" ? "☘ 成長期" : ph.tag === "全盛期" ? "⛰ 全盛期" : "🍂 衰え期"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => setCaptain(r.id)} title="主将に任命（自分より2歳以上若い選手の練習効果+10%）"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0, color: r.id === g.captainId ? C.yellow : C.sub }}>
                      🎖
                    </button>
                    <button onClick={() => toggleFavorite(r.id)} title="お気に入り登録（殿堂入りが確約されます）"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0, color: r.favorite ? C.yellow : C.sub }}>
                      {r.favorite ? "★" : "☆"}
                    </button>
                    <div style={{ fontFamily: FONT_M, fontSize: 14, color: C.yellow }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></div>
                    {g.month === 0 && <Btn small outline color={C.red} onClick={() => askConfirm(`${r.name}を解雇しますか？`, () => releaseRider(r.id))}>解雇</Btn>}
                  </div>
                </div>
                {riderNickname(r) && <div style={{ fontSize: 12, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{riderNickname(r)}」</div>}
                <PersonaLine p={r.personality} />
                <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.sub, margin: "4px 0", flexWrap: "wrap" }}>
                  <span>{r.age}歳・{GROWTH[r.growth].label}・<span style={{ color: ph.tag === "全盛期" ? C.yellow : ph.tag === "衰え期" ? C.red : C.green }}>{ph.tag}</span></span>
                  <span>調子 <span style={{ color: COND_COLOR[r.cond - 1], fontFamily: FONT_M }}>{COND_ARROW[r.cond - 1]}</span><CondFc dir={r.condForecast} /></span>
                  {r.streak > 0 && <span style={{ color: r.streak >= 2 ? C.red : "#e8a13c" }}>連闘{r.streak}{r.streak >= 2 ? "（次で故障！）" : ""}</span>}
                  {r.injury > 0 && <span style={{ color: C.red }}>🏥 故障 残{r.injury}ヶ月</span>}
                </div>
                <div style={{ fontSize: 10.5, color: C.sub }}>疲労（90超で故障リスク）</div>
                <FatigueBar v={r.fatigue} />
                <AbilityGrid r={r} cap={growthCap} />
                <SubStatLine r={r} />
                <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>種目別適性</div>
                <DisciplineGrid r={r} />
                <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: C.sub }}>練習:</span>
                  <select value={r.focus} onChange={e => setFocus(r.id, e.target.value)}
                    style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 6px", fontSize: 12 }}>
                    {AB_KEYS.map(k => <option key={k} value={k}>{AB_LABEL[k]}強化</option>)}
                    <option value="rest">休養（疲労-15）</option>
                  </select>
                  {g.inv.supp > 0 && r.fatigue > 30 && <Btn small outline color={C.green} onClick={() => useSupp(r.id)}>サプリ(-40)</Btn>}
                  {g.inv.tune > 0 && r.cond < 5 && <Btn small outline color={C.green} onClick={() => useTune(r.id)}>調律(調子+2)</Btn>}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                  {PART_SLOTS.map(slot => (
                    <span key={slot} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: C.purple }}>{SLOT_LABEL[slot]}:</span>
                      <select value={r.parts[slot] || ""} onChange={e => setPart(r.id, slot, e.target.value)}
                        style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 5px", fontSize: 11.5, maxWidth: 140 }}>
                        <option value="">— なし —</option>
                        {Object.entries(PARTS).filter(([pid, p]) => p.slot === slot && (availParts(pid) > 0 || r.parts[slot] === pid))
                          .map(([pid, p]) => <option key={pid} value={pid}>{p.label}</option>)}
                      </select>
                    </span>
                  ))}
                </div>
                {/* v30: フレーバーテキストは特能と能力値の間から、カード末尾の独立欄へ移動 */}
                <div style={{ fontSize: 11, color: C.sub, fontStyle: "italic", marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.line}`, lineHeight: 1.5 }}>{riderFlavorText(r)}</div>
                <Btn small outline color={C.sub} onClick={() => setExpandedRiderId(expandedRiderId === r.id ? null : r.id)}
                  style={{ marginTop: 8 }}>
                  {expandedRiderId === r.id ? "▲ 戦績を閉じる" : `▼ 戦績を見る（${(r.raceLog || []).length}戦）`}
                </Btn>
                {expandedRiderId === r.id && (
                  <div style={{ marginTop: 6, background: C.panel2, borderRadius: 8, padding: "6px 10px", maxHeight: 200, overflowY: "auto" }}>
                    {(!r.raceLog || r.raceLog.length === 0) && <div style={{ fontSize: 11.5, color: C.sub }}>まだ出走記録がありません。</div>}
                    {[...(r.raceLog || [])].reverse().map((e, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "3px 0", borderBottom: i < r.raceLog.length - 1 ? `1px solid ${C.line}` : "none" }}>
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
      );
    }
    if (g.tab === "shop") {
      body = (
        <div style={{ display: "grid", gap: 14 }}>
          <section>
            <Eyebrow color={C.yellow}>🏳 チーム名</Eyebrow>
            <input type="text" value={g.teamName || ""} maxLength={16} placeholder="あなたのチーム"
              onChange={e => { const v = e.target.value; setG(s => ({ ...s, teamName: v })); }}
              onBlur={e => { if (!e.target.value.trim()) setG(s => ({ ...s, teamName: "あなたのチーム" })); }}
              style={{ width: "100%", boxSizing: "border-box", marginTop: 6, background: C.panel2, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", fontSize: 14, fontFamily: FONT_B }} />
            <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>いつでも変更できます（16文字まで）。</div>
          </section>
          {g.month === 0 && (
            <section>
              <Eyebrow color={C.green}>APRIL DRAFT — 新人スカウト（方針：{SCOUT_POLICIES[g.scoutPolicy].label}）</Eyebrow>
              <div style={{ fontSize: 11.5, color: C.sub, margin: "4px 0 8px" }}>能力は推定レンジ表示。契約するまで真の値は分かりません。</div>
              <div style={{ display: "grid", gap: 8 }}>
                {g.scouts.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>今年の候補は全員契約済み、または見送りました。</div>}
                {g.scouts.map(sc => {
                  const r = sc.rider, t = TYPES[r.type];
                  return (
                    <div key={r.id} style={{ background: r.prodigy ? "#2b2410" : C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${r.prodigy ? C.yellow : C.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                        <div>
                          {r.prodigy && <span style={{ marginRight: 6, fontSize: 10.5, color: C.yellow, fontWeight: 700 }}>🌟逸材</span>}
                          <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 15 }}>{r.name}</span>
                          <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                        </div>
                        <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 13 }}>{sc.ovrMin}〜{sc.ovrMax}<span style={{ fontSize: 9, color: C.sub }}> OVR?</span></span>
                      </div>
                      <div style={{ fontSize: 11.5, color: C.sub, margin: "3px 0" }}>{sc.tag}・{r.age}歳・{GROWTH[r.growth].label}型・成長<span style={{ color: POW[r.growthPow].color }}>{r.growthPow}</span>・<span style={{ color: potentialHint(r).color }}>{potentialHint(r).label}</span></div>
                      <PersonaLine p={r.personality} />
                      <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                      <BlurGrid blur={sc.blur} />
                      <SubStatLine r={r} />
                      <div style={{ marginTop: 8 }}>
                        <Btn small color={C.green} disabled={g.budget < sc.price || g.roster.length >= rosterMax} onClick={() => signScout(sc)}>
                          {g.roster.length >= rosterMax ? "ロースター満員" : `${sc.price}万円で契約`}
                        </Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          <section>
            <Eyebrow color={C.green}>FA移籍市場（能力は公開済み・即決購入）</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, margin: "4px 0 8px" }}>新人スカウトと違い、既に実績のある選手を能力そのままで獲得できます。毎月全入れ替え。</div>
            <div style={{ display: "grid", gap: 8 }}>
              {g.faMarket.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>今月の候補は全員契約済みです。</div>}
              {g.faMarket.map(fa => {
                const r = fa.rider, t = TYPES[r.type];
                const full = g.roster.length >= rosterMax;
                return (
                  <div key={r.id} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <div>
                        <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 15 }}>{r.name}</span>
                        <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                      </div>
                      <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 13 }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></span>
                    </div>
                    <div style={{ fontSize: 11.5, color: C.sub, margin: "3px 0" }}>{fa.age}歳・{GROWTH[r.growth].label}型・成長<span style={{ color: POW[r.growthPow].color }}>{r.growthPow}</span></div>
                    <PersonaLine p={r.personality} />
                    <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                    <AbilityGrid r={r} cap={growthCap} />
                    <div style={{ marginTop: 8 }}>
                      <Btn small color={C.green} disabled={g.budget < fa.price || full} onClick={() => signFa(fa)}>
                        {full ? "ロースター満員（4月に解雇で空き作成）" : `${fa.price}万円で獲得`}
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={"#e8a13c"}>🎯 引き抜き市場（他チームの主力を獲得）</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, margin: "4px 0 8px" }}>
              ライバルの看板選手を移籍金で引き抜けます（年1回まで）。相手を弱体化させつつ自チームを強化する攻めの一手。
              {g.poachDoneThisYear && <span style={{ color: C.red }}> ／今季は使用済み</span>}
            </div>
            <Btn small color={"#e8a13c"} outline onClick={() => setG(s => ({ ...s, screen: "poachMarket" }))}>
              引き抜き市場を開く（候補{(g.poachTargets || []).length}名）→
            </Btn>
          </section>
          <section>
            <Eyebrow color={"#e8a13c"}>選手間トレード（毎月入れ替え）</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, margin: "4px 0 8px" }}>ライバルチームが自チームの選手に興味を示し、代わりの選手を提示してきています。受け入れると1対1で入れ替わります。</div>
            <div style={{ display: "grid", gap: 8 }}>
              {(g.tradeOffers || []).length === 0 && <div style={{ fontSize: 13, color: C.sub }}>今月のトレードオファーはありません。</div>}
              {(g.tradeOffers || []).map(offer => {
                const wantRider = g.roster.find(r => r.id === offer.wantRiderId);
                if (!wantRider) return null;
                const r = offer.offeredRider, t = TYPES[r.type];
                return (
                  <div key={offer.id} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${"#e8a13c"}` }}>
                    <div style={{ fontSize: 12, color: C.sub }}>{offer.team}が<span style={{ color: C.text, fontWeight: 700 }}>{wantRider.name}</span>（{TYPES[wantRider.type].label}・{overall(wantRider)} OVR）を欲しがっています</div>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", marginTop: 6 }}>
                      <div>
                        <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 15 }}>{r.name}</span>
                        <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                        <span style={{ marginLeft: 6, fontSize: 11, color: C.sub }}>{r.age}歳</span>
                      </div>
                      <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 13 }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></span>
                    </div>
                    <PersonaLine p={r.personality} />
                    <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                    <AbilityGrid r={r} cap={growthCap} />
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <Btn small color={"#e8a13c"} disabled={g.roster.length <= 1} onClick={() => askConfirm(`${wantRider.name}を放出し、${r.name}を獲得するトレードを成立させますか？`, () => acceptTrade(offer.id))}>このトレードを受け入れる</Btn>
                      <Btn small outline color={C.sub} onClick={() => declineTrade(offer.id)}>見送る</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={C.purple}>マシンパーツ（クラス昇格で上位解禁）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(PARTS).map(([pid, p]) => {
                const lockedByClass = p.tier > g.classIdx + 1;
                return (
                  <div key={pid} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, opacity: lockedByClass ? 0.5 : 1 }}>
                    <div>
                      <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                        {p.tier > 1 && <span style={{ color: p.tier === 3 ? C.yellow : C.green, fontSize: 10.5 }}>[{CLASSES[p.tier - 1].id}] </span>}
                        {p.label} <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.purple }}>所持{g.partsInv[pid] || 0}（空き{Math.max(0, availParts(pid))}）</span>
                      </div>
                      <div style={{ color: C.sub, fontSize: 11 }}>[{SLOT_LABEL[p.slot]}] {Object.entries(p.ab).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join(" / ")}</div>
                    </div>
                    {lockedByClass
                      ? <span style={{ fontSize: 11, color: C.red, whiteSpace: "nowrap" }}>🔒 {CLASSES[p.tier - 1].id}で解禁</span>
                      : <Btn small color={C.purple} disabled={g.budget < p.price} onClick={() => buyPart(pid)}>{p.price}万</Btn>}
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={C.purple}>消耗品（在庫制）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(ITEMS).map(([k, it]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{it.label} <span style={{ fontFamily: FONT_M, color: C.purple }}>×{g.inv[k]}</span></div>
                    <div style={{ color: C.sub, fontSize: 11.5 }}>{it.desc}</div>
                  </div>
                  <Btn small color={C.purple} disabled={g.budget < it.price} onClick={() => buyItem(k)}>{it.price}万</Btn>
                </div>
              ))}
              {g.inv.camp > 0 && !g.camp && <Btn small outline color={C.purple} onClick={() => askConfirm("キャンプを実施しますか？今月の練習効果が×2になりますが、選手全員の疲労が+25されます（連発すると故障リスクが高まります）。", useCamp)}>キャンプ券を使う（今月の練習×2・全員疲労+25）</Btn>}
              {g.camp && <div style={{ fontSize: 12, color: C.purple }}>⛺ 今月はトレーニングキャンプ実施中（練習効果×2）</div>}
            </div>
          </section>
          {/* v28: チーム施設のアップグレード段階可視化。機材・スタッフの現在レベルと累積効果を
              バーで一覧できるようにし、投資の進み具合と効果を直感的に把握できるようにする */}
          <section>
            <Eyebrow color={"#e8a13c"}>🏭 施設・投資の状況</Eyebrow>
            <div style={{ display: "grid", gap: 7, marginTop: 6 }}>
              {[
                { label: "エアロフレーム", lv: g.equip.frame, max: 5, effect: `平坦 +${g.equip.frame * 6}%`, color: C.blue },
                { label: "軽量ホイール", lv: g.equip.wheels, max: 5, effect: `登坂 +${g.equip.wheels * 6}%`, color: C.red },
                { label: "トレーニング設備", lv: g.equip.facility, max: 5, effect: `練習効果 +${g.equip.facility * 15}%`, color: C.green },
                { label: "監督", lv: g.staff.manager, max: 3, effect: g.staff.manager > 0 ? `月収+${g.staff.manager * 12}%・ノルマ-${g.staff.manager * 8}%・報酬+${g.staff.manager * 10}%` : "未雇用", color: C.yellow },
                { label: "トレーナー", lv: g.staff.trainer, max: 3, effect: g.staff.trainer > 0 ? `練習成長 +${g.staff.trainer * 12}%` : "未雇用", color: C.green },
                { label: "ドクター", lv: g.staff.doctor, max: 3, effect: g.staff.doctor > 0 ? `故障率 -${g.staff.doctor * 22}%・離脱-${Math.round(g.staff.doctor * 0.8)}ヶ月` : "未雇用", color: "#6fa8dc" },
                { label: "スカウト", lv: g.staff.scout || 0, max: 3, effect: (g.staff.scout || 0) > 0 ? `査定ブレ -${(g.staff.scout || 0) * 28}%・逸材率+${(g.staff.scout || 0) * 60}%` : "未雇用", color: C.purple },
              ].map((row, i) => (
                <div key={i} style={{ background: C.panel, borderRadius: 8, padding: "7px 10px", border: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>{row.label} <span style={{ fontFamily: FONT_M, color: C.sub, fontSize: 10.5 }}>Lv{row.lv}/{row.max}</span></span>
                    <span style={{ fontSize: 10.5, color: row.lv > 0 ? row.color : C.sub }}>{row.effect}</span>
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    {Array.from({ length: row.max }).map((_, j) => (
                      <div key={j} style={{ flex: 1, height: 6, borderRadius: 3, background: j < row.lv ? row.color : C.panel2 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {g.obCoach && <div style={{ fontSize: 11, color: "#e8a13c", marginTop: 6 }}>🎓 OBコーチ {g.obCoach.name}：{AB_LABEL[g.obCoach.ab]}の練習効果+25%</div>}
          </section>
          <section>
            <Eyebrow color={C.red}>チーム機材（Lv上限：{cls.id}＝{equipMax}）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(EQUIPS).map(([k, eq]) => {
                const lv = g.equip[k], cost = lv >= equipMax ? null : EQUIP_COST[lv];
                return (
                  <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{eq.label} <span style={{ fontFamily: FONT_M, color: C.yellow }}>Lv{lv}/{equipMax}</span></div>
                      <div style={{ color: C.sub, fontSize: 11.5 }}>{eq.desc}</div>
                    </div>
                    <Btn small color={C.red} disabled={lv >= equipMax || g.budget < cost} onClick={() => buyEquip(k)}>
                      {lv >= equipMax ? (g.classIdx < 2 ? "昇格で解禁" : "MAX") : `${cost}万`}
                    </Btn>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={C.red}>スタッフ（月給制・Lv上限：{cls.id}＝{staffMax}）</Eyebrow>
            {staffMax === 0 ? (
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>A昇格で雇用が解禁されます。</div>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                {Object.entries(STAFF_ROLES).map(([k, st]) => {
                  const lv = g.staff[k] || 0;
                  const meta = STAFF_META[k] || { icon: "🧑‍💼", title: st.label };
                  const hired = lv > 0;
                  const name = staffMemberName(g.teamName, k);
                  return (
                    <div key={k} style={{ background: hired ? "rgba(217,72,74,0.06)" : C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${hired ? "rgba(217,72,74,0.4)" : C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div>
                        <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>
                          {meta.icon} {hired ? `${name}${meta.title}` : st.label} <span style={{ fontFamily: FONT_M, color: C.yellow }}>Lv{lv}/{staffMax}</span>
                        </div>
                        <div style={{ color: hired ? C.red : C.sub, fontSize: 11.5 }}>{hired ? `現在の効果：${staffEffectText(k, lv)}` : st.desc}</div>
                      </div>
                      <Btn small color={C.red} disabled={lv >= staffMax} onClick={() => hireStaff(k)}>
                        {lv >= staffMax ? (g.classIdx < 2 ? "昇格で解禁" : "MAX") : hired ? `昇格 +${STAFF_SALARY_PER_LV}万` : `雇用 月給+${STAFF_SALARY_PER_LV}万`}
                      </Btn>
                    </div>
                  );
                })}
                <div style={{ fontSize: 10.5, color: C.sub }}>スタッフ月給合計 -{staffSalaryTotal(g.staff)}万/月</div>
              </div>
            )}
          </section>
          <section>
            <Eyebrow color={"#e8a13c"}>OBコーチ（引退選手の登用・月給{OB_COACH_SALARY}万）</Eyebrow>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>殿堂入りしたOBを専属コーチに迎えると、その選手の脚質に対応する能力の練習効果が全選手+25%になります（1名まで）。</div>
            {g.obCoach && (
              <div style={{ background: "rgba(232,161,60,0.1)", borderRadius: 10, padding: "10px 12px", border: `1.5px solid #e8a13c`, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>🎓 {g.obCoach.name}コーチ <span style={{ fontSize: 10.5, color: TYPES[g.obCoach.type].color }}>{TYPES[g.obCoach.type].label}</span></div>
                  <div style={{ color: "#e8a13c", fontSize: 11.5 }}>{AB_LABEL[g.obCoach.ab]}の練習効果+25%（全選手）</div>
                </div>
                <Btn small outline color={C.sub} onClick={dismissObCoach}>契約解消</Btn>
              </div>
            )}
            {!g.obCoach && (
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {g.hallOfFame.length === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>まだ殿堂入りOBがいません（引退・退団した実績ある選手が対象です）。</div>}
                {[...g.hallOfFame].reverse().slice(0, 6).map((h, i) => (
                  <div key={`ob-${h.id}-${i}`} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13 }}>{h.name}</span>
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: TYPES[h.type].color }}>{TYPES[h.type].label}</span>
                      <div style={{ fontSize: 10.5, color: C.sub }}>{AB_LABEL[TYPE_COACH_ABILITY[h.type] || "flat"]}の練習効果+25%</div>
                    </div>
                    <Btn small color={"#e8a13c"} onClick={() => hireObCoach(h)}>コーチに迎える</Btn>
                  </div>
                ))}
              </div>
            )}
          </section>
          <Btn outline color={C.sub} onClick={() => askConfirm("最初からやり直しますか？セーブデータも消えます。", () => { clearSaveGame(); setG(initGame()); })}>ゲームをリセット</Btn>
        </div>
      );
    }
    if (g.tab === "career") {
      const cs = g.careerStats;
      const history = [...g.careerHistory].reverse();
      const hof = [...g.hallOfFame].reverse();
      body = (
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
    if (g.tab === "help") {
      const roleRows = Object.entries(ROLES).map(([k, v]) => ({ key: k, ...v }));
      const ROLE_PROS_CONS = {
        lead: { pro: "エースを最後まで牽引。最も信頼できる基本役割", con: "脚質が合わなくても最後まで牽引を続けるため、コースと合わないと非効率になりがち" },
        sub: { pro: "第一アシストを後方から支援し、序盤の消耗を分散できる", con: "脚がなくなると早期に離脱し、そこから先の牽引には貢献できない" },
        mountain: { pro: "山岳・山頂フィニッシュ区間で牽引力を発揮。平坦区間は温存できる", con: "平坦・丘陵中心のコースでは牽引せず、実質的に消耗するだけの手駒になる" },
        flat: { pro: "平坦・丘陵区間の牽引に強く、山岳の少ないコースで安定して働く", con: "山岳区間に入ると牽引せず自然に遅れていく（そこから先は温存扱い）" },
        breakaway: { pro: "序盤に飛び出して逃げ集団を形成。エースの脚を使わずに得点機会を作れる", con: "メイン集団に吸収されるとポイントに繋がらないリスクがある" },
      };
      const CHASE_PROS_CONS = {
        normal: { pro: "脚の消耗を抑えた標準ペース", con: "特別な加速はしない" },
        push: { pro: "ローテーション頻度を上げてペースアップできる", con: "牽引役の脚の消耗が早まる" },
        hold: { pro: "牽引役の脚を温存できる", con: "ギャップの拡大を許容することになる" },
        ace_early: { pro: "エースが単独アタックし、一気にタイム差を作れる可能性がある", con: "エネルギー切れで終盤に大失速するリスクがある（1レース1回限り）" },
      };
      const benchAbility = 80;
      body = (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <Eyebrow color={C.green}>役割の得意・弱点</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {roleRows.map(r => (
                <div key={r.key} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13.5 }}>{r.label}</div>
                  <div style={{ fontSize: 11.5, color: C.green, marginTop: 3 }}>◎ {ROLE_PROS_CONS[r.key].pro}</div>
                  <div style={{ fontSize: 11.5, color: C.red, marginTop: 2 }}>▲ {ROLE_PROS_CONS[r.key].con}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow color={C.blue}>作戦の得意・弱点（出走前に1つ選択）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {Object.entries(CHASE_MODES).map(([k, v]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13.5 }}>🚩 {v.label}</div>
                  <div style={{ fontSize: 11.5, color: C.green, marginTop: 3 }}>◎ {CHASE_PROS_CONS[k].pro}</div>
                  <div style={{ fontSize: 11.5, color: C.red, marginTop: 2 }}>▲ {CHASE_PROS_CONS[k].con}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow color={C.yellow}>能力値のクラス別ベンチマーク</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4, lineHeight: 1.7 }}>
              新人の能力値は「クラスの基準値±11」＋「専門種目+14」で決まり、22〜94の範囲でばらつきます。
              同じ能力値でも、所属クラスが上がるほど相対的な希少価値は下がります（PROの80は「まずまずの主力」、B1の80は「相当な逸材」）。
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {CLASSES.map((c, i) => {
                const lo = c.scout - 11 + 14, hi = Math.min(94, c.scout + 11 + 14);
                const pct = Math.max(0, Math.min(100, Math.round(((hi - benchAbility) / (hi - lo)) * 100)));
                return (
                  <div key={c.id} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13 }}>{c.label}</span>
                    <span style={{ fontSize: 11.5, color: C.sub }}>専門種目の新人レンジ 約{Math.round(lo)}〜{Math.round(hi)}</span>
                    <span style={{ fontSize: 11.5, color: C.yellow }}>能力{benchAbility}は新人の上位約{pct}%相当</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <Eyebrow color={C.purple}>難易度・スコアリングの目安</Eyebrow>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                レースの★（グレード）は賞金・獲得ポイントの倍率です：★1=×1.0／★2=×1.5／★3=×2.0。
              </div>
              {CLASSES.map(c => {
                const perRace = (c.need / 11).toFixed(1);
                return (
                  <div key={c.id} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub }}>
                    <span style={{ color: C.text, fontFamily: FONT_D, fontWeight: 700 }}>{c.label}</span>：昇格に必要{c.need}pt ÷ シーズン11レース ＝ 平均<span style={{ color: C.yellow, fontFamily: FONT_M }}> {perRace}pt/レース</span>が目安（★1のレースなら概ね6〜7位以内の成績）
                  </div>
                );
              })}
            </div>
          </div>

          {/* v25: ヘルプを大幅拡充。基本の能力・成長システムから、細かな仕様まで一覧できるようにする */}
          <div>
            <Eyebrow color={C.green}>能力値と特殊能力の基本</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                能力値は<span style={{ color: C.text }}>平坦・登坂・スプリント・スタミナ・独走</span>の5種類（22〜135）。区間の種類ごとに使われる能力が決まり、丘陵は登坂55%＋平坦45%、山頂フィニッシュは登坂70%＋スプリント30%、TT区間は独走60%＋平坦40%というように複数の能力が混ざる区間もあります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                選手は<span style={{ color: C.text }}>特殊能力を0〜3個</span>保有します。地形適性・展開/役割・メンタル・フィジカル・成長の5カテゴリがあり、悪特性（バッドステータス）が混ざることもあります。一定の勝利数や役割出走数を満たすと保有能力が「金特」に強化され、逆に条件を満たせば未保有の能力を後天的に習得することもあります。発見済みの能力は「記録」タブの特殊能力図鑑で内容を確認できます（未発見のものは？？？で伏せられます）。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.yellow}>成長・練習の仕組み</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                選手にはそれぞれ<span style={{ color: C.text }}>成長タイプ</span>（早熟・普通・晩成・超早熟・超晩成）があり、年齢によって「成長期（伸び最大）」「全盛期（伸び半減）」「衰え期（能力が少しずつ下がる）」が切り替わります。ピーク年齢は早熟21〜25歳・普通24〜29歳・晩成28〜33歳・超早熟18〜21歳・超晩成32〜38歳です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                さらに<span style={{ color: C.text }}>成長力（C/B/A/S）</span>が練習・出走経験の伸び方に倍率をかけます（C×0.7・B×1.0・A×1.3・S×1.6）。練習では指定した1能力に90%、残り4能力に14%の伸びが配分されます（トレードオフ）。出走した場合は、レースで使った区間の種目に応じた「出走経験」でも能力が伸び、レースのグレードが高いほど伸びが大きくなります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                能力には難易度ごとの<span style={{ color: C.text }}>ソフトキャップ</span>があります（イージー88・ノーマル94・ハード102・鬼112）。この値未満なら伸びは全開ですが、超えると急激に伸びが鈍化します。上限を超えた金色表示の能力は「限界突破」状態です。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.red}>疲労・コンディション・故障</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                出走すると疲労が+45（「鉄人」持ちは+32）増えます。<span style={{ color: C.red }}>3ヶ月連続で出走（3連闘）すると確定で故障</span>、疲労が90を超えると確率で故障が発生します（ドクターの雇用で確率・離脱期間ともに軽減）。「頑丈」は故障率半減、「ガラスの体」は故障率2倍＆離脱+1ヶ月です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                調子は→（普通）／↗（好調）／↑↑（絶好調）／↘（やや不調）／↓↓（絶不調）の5段階で毎月ランダムに変動します（「ムラっ気」は変動幅が大きく、「精密機械」は小さい）。休養させると疲労が回復します（出走なしなら-50、故障中でも自然回復します）。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.blue}>チームケミストリー・キャプテン制度</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                ロースター平均在籍月数に応じて<span style={{ color: C.text }}>チームケミストリー</span>が「新体制／定着期／円熟したチーム／鉄壁の絆」の順に上がり、レース中のドラフト消耗が最大8%軽減されます。移籍・トレード・解雇が多いと在籍月数がリセットされるため、頻繁な入れ替えは足元のケミストリーを崩すコストがあります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                任命した<span style={{ color: C.text }}>キャプテン</span>より2歳以上若い選手は練習効果+10%になりますが、キャプテン自身の練習効果は-5%になります（誰でも任命した方が得、にはならないよう小さなトレードオフがあります）。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={"#6fa8dc"}>天候</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                レースごとに晴れ・🌧雨・🥵猛暑のいずれかが決まります（カレンダー・出走前画面に表示）。<span style={{ color: C.text }}>雨</span>は出走選手全員の能力を一律で下げ（「悪天候巧者」持ちは軽減）、持たない選手には落車による負傷離脱のリスクも上乗せされます。<span style={{ color: C.text }}>猛暑</span>は出走後の疲労蓄積が増えます。横風区間の影響（「横風耐性」で軽減）とは別の、レース全体にかかる要素です。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.purple}>キャンプ・機材・スタッフ</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                <span style={{ color: C.text }}>トレーニングキャンプ券</span>を使うとその月の練習効果が×2になりますが、選手全員の疲労が+25されます。クールダウンはありませんが、連発すると疲労90超＝故障リスクゾーンに入りやすくなるため、使いどころの見極めが重要です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                恒常装備：<span style={{ color: C.text }}>エアロフレーム</span>（平坦+6%/Lv）・<span style={{ color: C.text }}>軽量ホイール</span>（登坂+6%/Lv）・<span style={{ color: C.text }}>トレーニング設備</span>（練習効果+15%/Lv）は買い切りで恒常的に効果が続きます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                スタッフは月給制：<span style={{ color: C.text }}>監督</span>（スポンサー契約が有利に）・<span style={{ color: C.text }}>トレーナー</span>（練習効果が恒常アップ）・<span style={{ color: C.text }}>ドクター</span>（故障率と離脱期間を軽減）。雇用できるレベル上限はクラスが上がるほど増えます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                <span style={{ color: C.purple }}>🎯 中期目標</span>：スポンサー契約時に、複数レースにまたがる約束（例「山岳系で通算2勝」「大レースで表彰台」）が1つ提示されます。年間ノルマ（総pt）や単月の指定レースとは別枠で、<span style={{ color: C.text }}>期限月までに達成すれば臨時ボーナス（資金＋ノルマpt）、未達なら違約金</span>。どのレースにエースを送り込むか、シーズンを通した計画性が問われます。進捗は主画面のパネルで常時確認できます。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={"#e8a13c"}>グランツール・副次クラシフィケーション</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                PROクラス限定で年3回（春・夏・秋）、3日間ステージレースの<span style={{ color: C.text }}>グランツール</span>が開催されます。グランファイナルへの出場には、その年の3戦すべてで総合優勝することが条件です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                グランツールでは総合成績とは別に、🟢ポイント賞（各区間の着順ポイント合計）・🔴山岳賞（山岳区間の着順ポイント合計）・⚪新人賞（26歳未満限定）の<span style={{ color: C.text }}>副次クラシフィケーション</span>が争われ、自チームが獲得すると賞金ボーナスが入ります。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.green}>ディナスティ周回・ユース育成枠</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                グランファイナル制覇後、「新たなチームで最初から」ではなく<span style={{ color: C.text }}>この轍を継いでさらなる高みへ</span>を選ぶと、同じチームのまま周回を継続できます（ディナスティモード）。周回を重ねるたびに他チームの地力が底上げされ、歯応えが保たれます。クリアポイントは周回のたびに再獲得できます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                「選手・練習」タブでは年1回だけ、契約金15万円で<span style={{ color: C.text }}>ユース選手（16〜17歳・成長力A以上確定）</span>を確保できます。現在の能力は低いですが、長期育成向けの原石です。使用枠は4月の年度替わりでリセットされます。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.sub}>スカウト・移籍・トレード・実績</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                毎年4月は新人スカウト月間。事前に選んだ方針（おまかせ／スプリント重視／登坂力重視／将来性重視／即戦力重視）に応じて候補5名の傾向が変わります。年間を通じてFA市場・他チームからのトレード提案・選手解雇（4月のみ）も利用できます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                <span style={{ color: "#e8a13c" }}>🎯 引き抜き市場</span>：ショップの「引き抜き市場」から、ライバルチームの<span style={{ color: C.text }}>看板選手</span>を移籍金で獲得できます（<span style={{ color: C.text }}>1シーズンに1回まで</span>）。成立すると相手は主力を失い、その選手は以後あなたのチームで走ります。逆に、あなたの主力が強豪から狙われる<span style={{ color: "#e8a13c" }}>引き抜きオファー</span>が届くこともあります。引き止め費用を払って残すか、移籍金を受け取って放出するか——放出した選手はライバルの一員として自チームの前に立ちはだかります。移籍金は選手の実力と移籍意欲で決まります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                実績を達成すると報酬（賞金や恒常ボーナス）が入ります。詳細な一覧は「記録」タブで確認できます。解雇・引退した選手のうち、実績かお気に入り登録の条件を満たした選手だけが殿堂入りとして名鑑に残ります。
              </div>
            </div>
          </div>
        </div>
      );
    }
    return wrap(body, true);
  }

  if (g.screen === "event" && g.pendingEvent) {
    const ev = g.pendingEvent;
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: "#2b2436", borderRadius: 12, padding: 18, borderTop: `4px solid ${C.purple}` }}>
          <Eyebrow color={C.purple}>TEAM EVENT — {MONTHS[g.month]}</Eyebrow>
          <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 20, margin: "6px 0 10px" }}>{ev.title}</h2>
          <p style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.8, margin: 0 }}>{ev.text}</p>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {ev.choices.map((c, i) => (
            <Btn key={i} color={C.purple} onClick={() => resolveEvent(i)}>{c.label}</Btn>
          ))}
        </div>
      </div>
    );
  }

  // v28: 選手の移籍志願イベント
  if (g.screen === "transferRequest" && g.transferRequest) {
    const req = g.transferRequest;
    const r = g.roster.find(x => x.id === req.riderId);
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: "#2b1e1e", borderRadius: 12, padding: 18, borderTop: `4px solid ${C.red}` }}>
          <Eyebrow color={C.red}>移籍志願 — {MONTHS[g.month]}</Eyebrow>
          <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 19, margin: "6px 0 10px" }}>{req.name}が退団を申し出た</h2>
          <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.8, margin: 0 }}>
            「最近ずっと出番がなく、このチームでは自分の力を発揮できない。もっと走れる場所へ移りたい」——長くベンチが続いた{req.name}{r ? `（${TYPES[r.type].label}・OVR${overall(r)}）` : ""}が、真剣な面持ちで移籍を願い出てきました。
          </p>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <Btn color={C.green} disabled={g.budget < 30} onClick={retainRider}>慰留する（引き止め費用30万・残留＆調子+1）{g.budget < 30 ? "／資金不足" : ""}</Btn>
          <Btn outline color={C.red} onClick={() => askConfirm(`${req.name}の移籍志願を受け入れますか？この選手はチームを去ります。`, grantTransferRequest)}>志願を受け入れて送り出す</Btn>
        </div>
      </div>
    );
  }

  // v41: 被引き抜き（ライバルが自チームの主力を引き抜きに来る）。引き止めるか、移籍金を得て放出するか。
  if (g.screen === "poachOffer" && g.poachOffer) {
    const o = g.poachOffer;
    const r = g.roster.find(x => x.id === o.riderId);
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: "#2b1e1e", borderRadius: 12, padding: 18, borderTop: `4px solid #e8a13c` }}>
          <Eyebrow color={"#e8a13c"}>引き抜きオファー — {MONTHS[g.month]}</Eyebrow>
          <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 19, margin: "6px 0 10px" }}>
            <span style={{ color: o.teamColor }}>{o.team}</span>が{o.name}の獲得に動いた
          </h2>
          <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.8, margin: 0 }}>
            強豪<span style={{ color: o.teamColor, fontWeight: 700 }}>{o.team}</span>が、あなたの主力
            <span style={{ color: C.text, fontWeight: 700 }}>{o.name}</span>{r ? `（${TYPES[r.type].label}・OVR${overall(r)}）` : `（OVR${o.ovr}）`}
            に破格の移籍金<span style={{ color: C.yellow, fontFamily: FONT_M }}>{o.fee}万円</span>を提示してきました。放出すれば大きな資金が手に入りますが、
            主力を失い、しかも<span style={{ color: C.red }}>今後はライバルの一員として自チームの前に立ちはだかります</span>。引き止めるには慰留費用がかかります。
          </p>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <Btn color={C.green} disabled={g.budget < o.retainCost} onClick={poachRetain}>
            引き止める（慰留費用-{o.retainCost}万・残留＆調子+1）{g.budget < o.retainCost ? "／資金不足" : ""}
          </Btn>
          <Btn outline color={"#e8a13c"} onClick={() => askConfirm(`${o.name}を${o.team}へ放出し、移籍金${o.fee}万円を受け取りますか？この主力はチームを去ります。`, poachAccept)}>
            放出して移籍金+{o.fee}万を受け取る
          </Btn>
        </div>
      </div>
    );
  }

  // v41: 引き抜き市場（こちらが他チームの主力を引き抜く）。年1回・資金と枠が必要。
  if (g.screen === "poachMarket") {
    const targets = g.poachTargets || [];
    const done = g.poachDoneThisYear;
    const full = g.roster.length >= rosterMax;
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 10, padding: "10px 14px", borderLeft: `4px solid #e8a13c` }}>
          <Eyebrow color={"#e8a13c"}>🎯 引き抜き市場 — ライバルの主力を狙う</Eyebrow>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.7 }}>
            各ライバルチームの<span style={{ color: C.text }}>看板選手</span>を、移籍金を払って引き抜けます。<span style={{ color: C.yellow }}>引き抜きは1シーズンに1回まで</span>。
            成立すると相手は主力を失い、その選手は今後あなたのチームで走ります。移籍金は選手の実力と移籍意欲で決まります。
          </div>
          <div style={{ fontSize: 11.5, marginTop: 5, color: done ? C.red : full ? C.red : C.green }}>
            {done ? "今季の引き抜き枠は使用済みです（年度末にリセット）" : full ? `ロースターが満員です（最大${rosterMax}名）` : `資金 ${g.budget}万円／枠 ${g.roster.length}/${rosterMax}名`}
          </div>
        </div>
        {targets.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>現在、引き抜ける主力候補がいません。</div>}
        {targets.map(t => {
          const c = t.candidate, ty = TYPES[c.type];
          const afford = g.budget >= t.fee && !full && !done;
          return (
            <div key={t.id} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 15 }}>{c.name}</span>
                  <span style={{ marginLeft: 6, fontSize: 10.5, color: ty.color }}>{ty.label}</span>
                  <span style={{ marginLeft: 6, fontSize: 11, color: C.sub }}>{c.age}歳</span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: t.teamColor }}>● {t.team}</span>
                </div>
                <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 14 }}>{overall(c)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></span>
              </div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>移籍意欲：<span style={{ color: t.willLabel === "移籍に前向き" ? C.green : t.willLabel === "チームの看板" ? C.red : C.text }}>{t.willLabel}</span></div>
              <PersonaLine p={c.personality} />
              <TraitLine abilities={c.abilities} goldAbilities={c.goldAbilities} />
              <AbilityGrid r={c} cap={growthCap} />
              <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                <Btn small color={"#e8a13c"} disabled={!afford}
                  onClick={() => askConfirm(`${t.team}の${c.name}を移籍金${t.fee}万円で引き抜きますか？（今季の引き抜き枠を消費します）`, () => poachSign(t.id))}>
                  移籍金 {t.fee}万で引き抜く
                </Btn>
                {!afford && !done && !full && <span style={{ fontSize: 11, color: C.red }}>資金不足</span>}
              </div>
            </div>
          );
        })}
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  if (g.screen === "event_result" && g.eventResult) {
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${C.purple}` }}>
          <Eyebrow color={C.purple}>{g.eventResult.title}</Eyebrow>
          <p style={{ color: C.text, fontSize: 14, lineHeight: 1.8, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{g.eventResult.text}</p>
        </div>
        <Btn onClick={() => setG(s => ({ ...s, eventResult: null, screen: "main" }))}>続ける →</Btn>
      </div>
    );
  }

  if (g.screen === "program") {
    return wrap(
      <div style={{ display: "grid", gap: 10 }}>
        <Eyebrow color={C.blue}>年間レースプログラム（{g.year}年目・{cls.label}）</Eyebrow>
        <div style={{ fontSize: 11.5, color: C.sub }}>会場・グレードは月初に確定するため、先の月は目安です。天候予報も併記します（☀️晴れ／🌧雨／🥵猛暑）。</div>
        {MONTHS.map((m, mi) => {
          const races = genMonthRaces(g.year, mi, g.classIdx, mi === 11 ? 9999 : 0, g.sponsor, g.gtWins);
          const isMandate = g.sponsor && g.sponsor.mandateMonths.includes(mi);
          return (
            <div key={mi} style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", border: `1px solid ${mi === g.month ? C.yellow : C.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: FONT_D, fontWeight: 700, color: mi === g.month ? C.yellow : C.text, fontSize: 13 }}>{m}{mi === g.month ? "（今月）" : ""}</span>
                {isMandate && <span style={{ fontSize: 10.5, color: C.red }}>🎯スポンサー指定月</span>}
              </div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3, lineHeight: 1.6 }}>
                {races.map(r => `${r.championship ? "👑" : ""}${r.weather && r.weather !== "clear" ? WEATHER[r.weather].icon : ""}${r.name}${"★".repeat(r.grade)}`).join(" ／ ")}
              </div>
            </div>
          );
        })}
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  // v27: 今季のチームポイント順位表
  if (g.screen === "standings") {
    const rows = computeStandings(g);
    return wrap(
      <div style={{ display: "grid", gap: 10 }}>
        <Eyebrow color={C.purple}>今季のチーム順位表（{g.year}年目・{cls.label}）</Eyebrow>
        <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.7 }}>
          {MONTHS[g.month]}時点のチームポイント順位です。他チームも毎月ポイントを積み上げています——<span style={{ color: C.text }}>走り込んで順位を上げるほど、年度末に報酬とチャンピオンシップの優位が得られます</span>。レースを休むと相手に抜かれて順位が下がります。
        </div>
        <div style={{ background: C.panel2, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.line}`, fontSize: 11, color: C.sub, lineHeight: 1.7 }}>
          🏆 <span style={{ color: C.text, fontWeight: 700 }}>最終順位ボーナス</span>：1位 +{standingsRankReward(1, g.classIdx)}万／2位 +{standingsRankReward(2, g.classIdx)}万／3位 +{standingsRankReward(3, g.classIdx)}万<br />
          🎯 <span style={{ color: C.text, fontWeight: 700 }}>昇格ボーダー緩和</span>：シーズン1位＝本番<span style={{ color: "#e8a13c" }}>5位以内</span>／2位＝<span style={{ color: "#e8a13c" }}>4位以内</span>／3位以下＝3位以内でチャンピオンシップ昇格（PROは対象外）
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: "6px 10px", display: "grid", gap: 2 }}>
          {rows.map((row, i) => (
            <div key={row.name} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 8px",
              borderRadius: 8, background: row.isPlayer ? "rgba(255,210,63,0.12)" : "transparent",
              borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : "none",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: FONT_M, fontSize: 14, color: i === 0 ? C.yellow : C.sub, width: 22 }}>{i + 1}.</span>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: row.color, display: "inline-block" }} />
                <span>
                  <span style={{ fontFamily: FONT_D, fontWeight: 700, color: row.isPlayer ? C.yellow : C.text, fontSize: 13.5 }}>{row.name}</span>
                  {row.trait && <span style={{ fontSize: 10, color: C.sub, marginLeft: 6 }}>{row.trait}</span>}
                </span>
              </span>
              <span style={{ fontFamily: FONT_M, fontSize: 14, color: row.isPlayer ? C.yellow : C.text }}>{row.pts}pt</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.sub }}>昇格の最終判定は3月のチャンピオンシップ（本番）で決まりますが、その必要着順はこのシーズン順位で緩和されます。年間を通して上位で走り切るほど昇格が近づきます。</div>
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  // v28: トロフィールーム。通算タイトル・殿堂入り選手・生涯評価スコアを一堂に集めた栄誉の間
  if (g.screen === "trophy") {
    const pres = computePrestige();
    const hof = g.hallOfFame || [];
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid #e8a13c`, textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>🏆</div>
          <h2 style={{ fontFamily: FONT_D, color: "#e8a13c", fontSize: 22, margin: "6px 0" }}>トロフィールーム</h2>
          <div style={{ fontSize: 11, color: C.sub }}>生涯評価スコア</div>
          <div style={{ fontFamily: FONT_M, fontSize: 30, color: C.yellow, fontWeight: 700 }}>{pres.score}</div>
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4 }}>累計CP{pres.totalEarnedCP} ・ 殿堂{pres.legendCount}人 ・ 通算タイトル{pres.titleCount}</div>
        </div>
        <Eyebrow color={"#e8a13c"}>👑 通算タイトル</Eyebrow>
        <TitlesPanel />
        <Eyebrow color={C.purple}>🏛 このチームの殿堂入り選手（{hof.length}名）</Eyebrow>
        {hof.length === 0
          ? <div style={{ fontSize: 12, color: C.sub }}>まだ殿堂入り選手はいません。実績を残した選手が引退・退団すると刻まれます。</div>
          : (
            <div style={{ display: "grid", gap: 8 }}>
              {hof.slice().reverse().map((r, i) => {
                const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
                const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
                const nick = riderNickname(r);
                return (
                  <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 14 }}>{r.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: TYPES[r.type].color }}>{TYPES[r.type].label}</span></span>
                      <span style={{ fontSize: 10.5, color: C.sub }}>{r.farewellYear}年目に{r.farewellReason === "released" ? "退団" : "引退"}</span>
                    </div>
                    {nick && <div style={{ fontSize: 11.5, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{nick}」</div>}
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>通算{(r.raceLog || []).length}戦・{wins}勝・{podiums}表彰台</div>
                  </div>
                );
              })}
            </div>
          )}
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  // v29: 出走表（シーズン）。事前生成した相手チーム布陣＋現在の自チーム選抜を一覧表示
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

  if (g.screen === "yearend" && g.yearendInfo) {
    const info = g.yearendInfo;
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${info.promoted ? C.green : info.relegated ? C.red : C.yellow}` }}>
          <Eyebrow>YEAR END — {g.year - 1}年目終了</Eyebrow>
          <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 22, margin: "6px 0 10px" }}>
            {info.promoted ? `🎉 ${cls.label} へ昇格！` : info.relegated ? "😞 降格…" : "残留 — 来季へ"}
          </h2>
          <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.8 }}>
            {info.champBest !== null ? `年度末レース結果：自チーム最高 ${info.champBest}位` : "年度末レースには出場できませんでした（ポイント不足）"}
          </div>
          {info.standingsRank != null && (
            <div style={{ marginTop: 8, fontSize: 13, color: "#e8a13c", lineHeight: 1.8 }}>
              🏆 シーズン最終順位 {info.standingsRank}/{info.standingsTotal}位
              {info.standingsMoney > 0 ? ` — 順位ボーナス +${info.standingsMoney}万円` : ""}
              {info.promoteCut > 3 && info.champBest !== null ? `／ 上位の走りで昇格ボーダーが本番${info.promoteCut}位以内に緩和` : ""}
            </div>
          )}
          {info.sponsorResult && (
            <div style={{ marginTop: 8, fontSize: 13, color: info.sponsorResult.achieved ? C.green : C.red }}>
              {info.sponsorResult.name}：ノルマ{info.sponsorResult.norma}ptに対し{info.sponsorResult.pts}pt —
              {info.sponsorResult.achieved ? ` 達成！ボーナス+${info.sponsorResult.bonus}万円` : ` 未達…違約金-${info.sponsorResult.penalty}万円`}
              {info.sponsorResult.mandatesMissed > 0 && ` ／ 指定レース見送り${info.sponsorResult.mandatesMissed}回：追加違約金-${info.sponsorResult.mandatePenalty}万円`}
              {info.sponsorResult.mandatesMet > 0 && ` ／ 指定レース達成${info.sponsorResult.mandatesMet}回`}
            </div>
          )}
          {(() => {
            const om = objectiveStatusText(info.sponsorResult && info.sponsorResult.objective);
            if (!om) return null;
            const obj = info.sponsorResult.objective;
            return (
              <div style={{ marginTop: 5, fontSize: 12.5, color: om.status === "done" ? C.green : C.red }}>
                中期目標「{om.icon} {om.label}」：{om.status === "done" ? `達成（ボーナス+${obj.budget}万・ノルマ+${obj.points}pt）` : `未達（違約金-${obj.penalty}万）`}
              </div>
            );
          })()}
          {info.retired.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <Eyebrow color={C.sub}>引退セレモニー</Eyebrow>
              {info.retired.map((t, i) => <div key={i} style={{ fontSize: 13, color: C.text, marginTop: 4 }}>🌸 {t}</div>)}
            </div>
          )}
        </div>
        <div style={{ background: C.panel2, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: C.sub, lineHeight: 1.7 }}>新年度：全選手が1歳加齢。次は新しいスポンサーとの契約です。</div>
        <Btn onClick={() => setG(s => ({ ...s, screen: "sponsor", yearendInfo: null }))}>スポンサー契約へ →</Btn>
      </div>
    );
  }

  if (g.screen === "clear") {
    const earnedCP = computeClearPoints(g.year, g.difficulty);
    const diffLabel = (DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).label;
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 22, borderTop: `4px solid ${C.yellow}`, textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>🏆</div>
          <h2 style={{ fontFamily: FONT_D, color: C.yellow, fontSize: 26, margin: "8px 0" }}>グランファイナル制覇！</h2>
          <p style={{ color: C.text, fontSize: 14, lineHeight: 1.8 }}>B1から始まったチームが、{g.year - 1}年の歳月（難易度：{diffLabel}）をかけてPROの頂点に立ちました。おめでとうございます！</p>
          <div style={{ marginTop: 10, fontSize: 15, color: C.yellow, fontFamily: FONT_M }}>🎁 クリアポイント +{earnedCP}pt 獲得！</div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>次回以降の新規ゲームで、難易度の解禁や永続ボーナスに自動反映されます</div>
        </div>
        {/* v25: 制覇後もこの轍（チーム）を引き継いで周回できるディナスティモード。
            周を重ねるたびに他チームの地力が上がり、歯応えを保ったまま挑戦を続けられる */}
        <Btn onClick={() => setG(s => ({ ...s, dynastyLevel: (s.dynastyLevel || 0) + 1, screen: "yearend" }))}>
          🔁 この轍を継いでさらなる高みへ（{(g.dynastyLevel || 0) + 1}周目へ・他チームがさらに強化される）
        </Btn>
        <Btn outline onClick={() => { clearSaveGame(); setG(initGame()); }}>新たなチームで最初から</Btn>
      </div>
    );
  }

  return wrap(<div style={{ color: C.sub }}>読み込み中…</div>);
}
