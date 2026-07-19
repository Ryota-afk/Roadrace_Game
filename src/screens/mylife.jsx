// マイライフモードの画面ディスパッチ（Phase 4-2で App から分離）。ctx=App状態/ハンドラ。
import React from "react";
import { legendBloodId, loadBloodlines, loadMlLegends, mlBloodlineFactor, mlBloodlineTier, mlBreedBonus, mlRecordLegend, protegeInherit, saveMlLegends } from "../breeding/breeding.js";
import { RaceErrorBoundary, RaceView } from "../components/RaceView.jsx";
import { AbilityFileList, AbilityGrid, CondFc, CourseRecordsPanel, DisciplineGrid, FatigueBar, PersonaLine, StartListPanel, SubStatLine, TitlesPanel, TraitLine } from "../components/panels.jsx";
import { Btn, Eyebrow } from "../components/ui.jsx";
import { fmtRelTime, fmtTime, overall } from "../core/core.js";
import { ABILITIES, AB_KEYS, AB_LABEL, GROWTH, POW, TYPES } from "../data/abilities.js";
import { MONTHS } from "../data/course.js";
import { CLASSES } from "../data/progression.js";
import { C, FONT_D, FONT_M } from "../data/theme.js";
import { CLASS_TIER_COLOR, FAVORS_TO_DISCIPLINE, ML_AMBITION_PATH_KEYS, ML_BACKGROUNDS, ML_CARS, ML_CROSSROADS, ML_GEAR, ML_HOUSES, ML_OFFSEASON_CHOICES, ML_SPECIAL_TRAINING, ML_STOCK_ITEMS, SLOT_LABEL, SUB_STAT_LABEL, WEATHER, bloodIdToName, breedNickTableRows, buildBloodMap, clearMyLifeSave, formatAchievementReward, growthPhase, hasMyLifeSave, loadAbilityFile, managerEvalTier, mlAmbitionPath, mlAmbitionProgressText, mlAutobiographyOptions, mlCurrentAmbition, mlEpilogueAway, mlEpilogueDirector, mlGradeColor, mlGrowthCap, mlLivingCost, mlPrivateCampCost, mlSetAutobiography, mlSetEpilogue, mlCareerTimeline, mlMediaHeadline, mlWorldBoard, mlWorldNews, potentialHint, riderFlavorText, rivalHeatTier, worldRankTier } from "../logic/support.js";
import { PARTS, PART_SLOTS } from "../sim/race.js";
import { ML_ACHIEVEMENTS, ML_AMBITION_PATHS, ML_TACTICS, computeAchievements, initMyLife, loadMyLifeGame, myLifeSaveInfo, mlCareerArchetype, mlFirstUnmetRung, riderCareerSummary, riderNickname } from "../state/state.js";

export function renderMyLifeScreens(ctx) {
  const { ML_MILESTONE_LABEL, askConfirm, g, ml, mlAdvanceMonth, mlBecomeMentor, mlBuyCar, mlBuyGear, mlBuyHouse, mlBuyPart, mlBuyStock, mlChooseTeam, mlContinueAfterCrossroads, mlContinueAfterOffseason, mlCreateChar, mlGenRace, mlLastRaceFinish, mlPrivateCamp, mlRaceFinish, mlRaceLockRef, mlResolveCrossroads, mlResolveEvent, mlResolveOffseason, mlRetireAdviceAccept, mlRetireAdviceContinue, mlRetireAdviceReduceRole, mlSetFocus, mlSetPart, mlStartLastRace, mlStartRace, mlTriggerEvent, mlTriggerSponsorGig, mlUseStockConfirm, mlWrap, openRename, setMl, setSuperMode, wrap } = ctx;
    if (ml.screen === "mylife_create") {
      const typeOpts = Object.entries(TYPES);
      const bgOpts = Object.entries(ML_BACKGROUNDS);
      return mlWrap(
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 18, border: `1px solid ${C.line}` }}>
            <Eyebrow>MY LIFE — キャラクター作成</Eyebrow>
            <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.7, margin: "6px 0 0" }}>
              脚質と経歴を選んでB1のいずれかのチームに新人選手として加入します。
            </p>
          </div>
          {hasMyLifeSave() && (() => {
            const info = myLifeSaveInfo();
            return (
              <Btn onClick={() => { const loaded = loadMyLifeGame(); if (loaded) setMl(loaded); }}>
                💾 続きから
                {info && <span style={{ display: "block", fontSize: 10.5, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>{info.name}{info.age ? `（${info.age}歳）` : ""}・{info.classLabel}・{info.year}年目{info.savedAt ? ` — ${fmtRelTime(info.savedAt)}に保存` : ""}</span>}
              </Btn>
            );
          })()}
          <div>
            <Eyebrow>脚質</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {typeOpts.map(([k, t]) => (
                <button key={k} onClick={() => setMl(s => ({ ...s, typeChoice: k }))}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: ml.typeChoice === k ? "rgba(255,210,63,0.12)" : C.panel,
                    border: `1.5px solid ${ml.typeChoice === k ? C.yellow : C.line}`,
                  }}>
                  <span style={{ fontFamily: FONT_D, fontWeight: 700, color: t.color }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow>経歴（年齢・能力・伸びしろに影響）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {bgOpts.map(([k, b]) => (
                <button key={k} onClick={() => setMl(s => ({ ...s, bgChoice: k }))}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: ml.bgChoice === k ? "rgba(255,210,63,0.12)" : C.panel,
                    border: `1.5px solid ${ml.bgChoice === k ? C.yellow : C.line}`,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{b.label}</span>
                    <span style={{ fontSize: 11, color: C.sub }}>{b.age}歳スタート</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{b.desc}</div>
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const legends = loadMlLegends();
            if (legends.length === 0) return null;
            const idx = ml.masterIdx ?? -1;
            const master = idx >= 0 ? legends[idx] : null;
            const inh = master ? protegeInherit(master) : null;
            return (
              <div>
                <Eyebrow color={C.purple}>師匠（歴代の名選手に師事・任意）</Eyebrow>
                <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 6px" }}>過去に殿堂入りした選手の教え子としてデビューできます。師の得意能力や特殊能力・成長力の一部を受け継ぎます。</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <button onClick={() => setMl(s => ({ ...s, masterIdx: -1 }))}
                    style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                      background: idx === -1 ? "rgba(255,210,63,0.12)" : C.panel, border: `1.5px solid ${idx === -1 ? C.yellow : C.line}` }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>師事しない（通常のデビュー）</span>
                  </button>
                  {legends.map((leg, i) => (
                    <button key={i} onClick={() => setMl(s => ({ ...s, masterIdx: i }))}
                      style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                        background: idx === i ? "rgba(201,139,240,0.14)" : C.panel, border: `1.5px solid ${idx === i ? C.purple : C.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{leg.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>（{TYPES[leg.type]?.label || leg.type}）</span></span>
                        <span style={{ fontSize: 10.5, color: C.sub }}>{leg.wins || 0}勝/{leg.podiums || 0}表彰台</span>
                      </div>
                      {leg.nickname && <div style={{ fontSize: 11, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{leg.nickname}」</div>}
                    </button>
                  ))}
                </div>
                {inh && (
                  <div style={{ background: C.panel2, borderRadius: 8, padding: "8px 10px", marginTop: 8, fontSize: 11.5, color: C.text, lineHeight: 1.7 }}>
                    <div><span style={{ color: C.purple, fontWeight: 700 }}>師の教え：</span>{inh.teaching.label}<span style={{ color: C.sub, fontSize: 10.5 }}>（{inh.teaching.desc}）</span></div>
                    <div>
                      <span style={{ color: C.purple, fontWeight: 700 }}>継承：</span>
                      {Object.entries(inh.abBonus).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join(" / ")}
                      {inh.subBonus && Object.entries(inh.subBonus).map(([k, v]) => `・${SUB_STAT_LABEL[k]}${v >= 0 ? "+" : ""}${v}`).join("")}
                      {inh.growthPowBump && "・成長力+1段階"}
                      <span style={{ color: C.yellow }}>・継承特性「{ABILITIES[inh.lineageTrait].label}」</span>
                      {inh.inheritAbility && `・特殊能力「${ABILITIES[inh.inheritAbility].label}」`}
                    </div>
                  </div>
                )}
                {/* v31: 配合相手（2人目の親）。師匠を選んでいる時だけ表示する */}
                {master && legends.length >= 2 && (() => {
                  const pIdx = ml.partnerIdx ?? -1;
                  const partner = (pIdx >= 0 && pIdx !== idx) ? legends[pIdx] : null;
                  const breed = partner ? mlBreedBonus(master, partner) : null;
                  const nickColor = breed ? (breed.nick.rank === "◎" ? C.yellow : breed.nick.rank === "○" ? C.green : C.sub) : C.sub;
                  return (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                      <Eyebrow color={"#e56cc8"}>🧬 配合相手（もう一人の親・任意）</Eyebrow>
                      <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 6px" }}>師匠に加えて2人目の親を選ぶと「配合」になり、両方の血を引く逸材が生まれます。脚質の相性（ニック◎○△）、共通の祖先による血の濃さ（インブリード）、代を重ねるほど蓄積する+値が乗ります。</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <button onClick={() => setMl(s => ({ ...s, partnerIdx: -1 }))}
                          style={{ textAlign: "left", padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                            background: pIdx === -1 ? "rgba(255,210,63,0.12)" : C.panel, border: `1.5px solid ${pIdx === -1 ? C.yellow : C.line}` }}>
                          <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>配合しない（師事のみ）</span>
                        </button>
                        {legends.map((leg, i) => i === idx ? null : (
                          <button key={i} onClick={() => setMl(s => ({ ...s, partnerIdx: i }))}
                            style={{ textAlign: "left", padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                              background: pIdx === i ? "rgba(229,108,200,0.16)" : C.panel, border: `1.5px solid ${pIdx === i ? "#e56cc8" : C.line}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{leg.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>（{TYPES[leg.type]?.label || leg.type}）</span></span>
                              <span style={{ fontSize: 10.5, color: C.sub }}>{(leg.generation || 0) > 0 ? `${leg.generation}代目・` : ""}+{leg.plusValue || 0}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      {breed && (
                        <div style={{ background: "linear-gradient(180deg,#2e2436,#241d2c)", borderRadius: 8, padding: "9px 11px", marginTop: 8, fontSize: 11.5, color: C.text, lineHeight: 1.7, border: `1px solid #e56cc8` }}>
                          {breed.special && (
                            <div style={{ background: "linear-gradient(90deg,#3a2f10,#2b2410)", border: `1px solid ${breed.special.color}`, borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
                              <div style={{ color: breed.special.color, fontWeight: 800, fontSize: 12.5 }}>🌟 特殊配合『{breed.special.title}』</div>
                              <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>{breed.special.note}</div>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: "#e56cc8" }}>配合評価</span>
                            <span style={{ fontFamily: FONT_M, fontWeight: 800, fontSize: 17, color: mlGradeColor(breed.matingGrade), textShadow: "0 0 6px rgba(0,0,0,.4)" }}>{breed.matingGrade}</span>
                            <span style={{ fontSize: 10.5, color: C.sub }}>爆発力 <span style={{ fontFamily: FONT_M, color: C.yellow }}>{breed.bakuhatsu}</span></span>
                          </div>
                          <div style={{ fontSize: 10.5, color: "#9ae6b4", marginBottom: 3 }}>
                            {breed.growthSteps > 0 && `成長力+${breed.growthSteps}段`}{breed.growthSteps > 0 && breed.talentCap > 0 && "・"}{breed.talentCap > 0 && `才能キャップ+${breed.talentCap}`}{(breed.growthSteps > 0 || breed.talentCap > 0) ? "（生まれた時は普通でも育てると化ける）" : "素質は平凡（配合の質を上げると化ける）"}
                          </div>
                          {breed.danger > 0 && (
                            <div style={{ fontSize: 10.5, color: breed.danger >= 38 ? C.red : "#e8a13c", marginBottom: 3 }}>
                              ⚠️ 危険度 <span style={{ fontWeight: 700 }}>{breed.dangerLabel}</span>（約{breed.danger}%）：稀に「ガラスの体」を持って生まれる{breed.healthMit > 0 ? "／健康な血で軽減済" : "。頑丈・鉄人の血を持つ親で軽減できる"}
                            </div>
                          )}
                          <div><span style={{ fontWeight: 700, color: "#e56cc8" }}>配合相性：</span><span style={{ color: nickColor, fontWeight: 700 }}>{breed.nick.rank} {breed.nick.label}</span></div>
                          <div><span style={{ fontWeight: 700, color: "#e56cc8" }}>血統ボーナス：</span>
                            累代+値 <span style={{ color: C.yellow }}>+{breed.plusPer}</span>
                            {breed.inbreed.count > 0 && <span style={{ color: C.red }}>・🩸インブリード×{breed.inbreed.count}（血が濃い！）</span>}
                            {breed.generation > 1 && `・${breed.generation}代目`}
                          </div>
                          <div><span style={{ fontWeight: 700, color: "#e56cc8" }}>受け継ぐ特能：</span>
                            {breed.extraAbilities.length > 0 ? breed.extraAbilities.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・") : "—"}
                          </div>
                          {breed.goldInherit && breed.goldInherit.length > 0 && (
                            <div style={{ color: C.yellow, fontWeight: 700 }}>✨ 金特クロス：{breed.goldInherit.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")}（最初から金特！）</div>
                          )}
                          {breed.exclusive && breed.exclusive.length > 0 && (
                            <div style={{ color: "#e56cc8", fontWeight: 700 }}>🩸 配合限定特能：{breed.exclusive.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")}</div>
                          )}
                          <div><span style={{ fontWeight: 700, color: "#e56cc8" }}>継承する系統：</span>{master.lineageName || `${master.name}系`}
                            {(() => { const rec = loadBloodlines()[master.lineageName || `${master.name}系`]; const t = rec ? mlBloodlineTier(rec) : null; if (!t || t.tier <= 0) return null; const fac = mlBloodlineFactor(rec); return <span style={{ color: "#e8a13c", fontWeight: 700 }}>　🏛{t.label}系統（因子：伸びしろ+{t.tier}{fac ? `・${ABILITIES[fac]?.label || fac}` : ""}{t.tier >= 3 ? "★金" : ""}）</span>; })()}
                          </div>
                          {breed.archNotes && breed.archNotes.length > 0 && (
                            <div style={{ color: "#e8a13c" }}>🩸 血の格：{breed.archNotes.join("・")}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}
          <Btn onClick={() => {
            const legends = loadMlLegends();
            const mIdx = ml.masterIdx ?? -1;
            const master = mIdx >= 0 ? legends[mIdx] : null;
            const pIdx = ml.partnerIdx ?? -1;
            const partner = (master && pIdx >= 0 && pIdx !== mIdx) ? legends[pIdx] : null;
            const doCreate = () => { clearMyLifeSave(); mlCreateChar(ml.typeChoice, ml.bgChoice, master, partner); };
            if (hasMyLifeSave()) askConfirm("保存データを消して新しい選手でキャリアを始めます。よろしいですか？", doCreate);
            else doCreate();
          }}>この内容でデビュー →</Btn>
          <Btn outline color={C.purple} onClick={() => setMl(s => ({ ...s, screen: "mylife_legends" }))}>🏛 歴代選手の殿堂を見る</Btn>
          <Btn outline color={C.sub} onClick={() => setSuperMode(null)}>← モード選択に戻る</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_main" && ml.player) {
      const r = ml.player;
      const race = ml.races[0];
      const ph = growthPhase(r);
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>{r.name}
                <button onClick={() => openRename("あなたの選手名を変更", r.name, v => setMl(s => {
                  const p = s.player;
                  // v33.7: 自分が始祖の系統（＝自分の名前から生まれた系統）は改名に追従させる。
                  // 師匠・配合で継いだ系統名は先祖の名なのでそのまま維持する
                  const isFounderLineage = !!p.lineageName && p.lineageName === `${p.name}系`;
                  return { ...s, player: { ...p, name: v, lineageName: isFounderLineage ? `${v}系` : p.lineageName } };
                }))} title="名前を変更" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, marginLeft: 4, padding: 0, opacity: 0.7 }}>✏️</button>
              </span>
              <div style={{ fontFamily: FONT_M, fontSize: 14, color: C.yellow }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></div>
            </div>
            {riderNickname(r) && <div style={{ fontSize: 12, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{riderNickname(r)}」</div>}
            {r.master && <div style={{ fontSize: 11, color: C.purple, marginTop: 1 }}>🎓 {r.master}の教え子{r.teaching ? `・師の教え「${r.teaching}」` : ""}</div>}
            {r.partner && <div style={{ fontSize: 11, color: "#e56cc8", marginTop: 1 }}>🧬 {r.master}×{r.partner}の配合{(r.generation || 0) > 1 ? `・${r.generation}代目` : ""}{(r.plusValue || 0) > 0 ? `・累代+${Math.min(15, r.plusValue)}` : ""}</div>}
            {r.lineageName && <div style={{ fontSize: 10.5, color: "#c98bf0", marginTop: 1 }}>🩸 {r.lineageName}{r.bloodlineTier ? `　🏛${["", "確立", "名門", "大系統"][r.bloodlineTier]}系統` : ""}</div>}
            {r.specialMating && <div style={{ fontSize: 10.5, color: r.specialMating.color || C.yellow, fontWeight: 700, marginTop: 1 }}>🌟 特殊配合『{r.specialMating.title}』</div>}
            <PersonaLine p={r.personality} />
            <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
            <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.sub, margin: "4px 0", flexWrap: "wrap" }}>
              <span>{r.age}歳・{GROWTH[r.growth].label}・<span style={{ color: ph.tag === "全盛期" ? C.yellow : ph.tag === "衰え期" ? C.red : C.green }}>{ph.tag}</span></span>
              <span>成長<span style={{ color: POW[r.growthPow].color }}>{r.growthPow}</span></span>
              {(() => { const pot = potentialHint(r); return <span style={{ color: pot.color }}>{pot.label}</span>; })()}
              {ml.flags?.married && <span style={{ color: C.purple }}>💍 既婚</span>}
            </div>
            <div style={{ fontSize: 10.5, color: C.sub }}>疲労（90超で故障リスク・60未満なら急いで回復させる必要はありません）</div>
            <FatigueBar v={r.fatigue} />
            {(() => {
              const form = r.form ?? 50;
              const fc = form >= 80 ? C.yellow : form >= 62 ? C.green : form >= 40 ? C.sub : "#c86";
              const fl = form >= 80 ? "ピーク" : form >= 62 ? "好調" : form >= 40 ? "平常" : "低調";
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 10.5, color: C.sub }}>フォーム（好不調）<CondFc dir={r.formForecast} /></span>
                  <div style={{ flex: 1, height: 5, background: C.line, borderRadius: 3 }}><div style={{ width: `${form}%`, height: 5, background: fc, borderRadius: 3 }} /></div>
                  <span style={{ fontFamily: FONT_M, fontSize: 11, color: fc, width: 58, textAlign: "right" }}>{Math.round(form)}・{fl}</span>
                </div>
              );
            })()}
            <AbilityGrid r={r} cap={mlGrowthCap(ml.year, r)} />
            <SubStatLine r={r} />
            <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>能力{mlGrowthCap(ml.year, r)}以上＝限界突破（バーの薄い帯＝上限までの伸びしろ・数字の小さな+も伸びしろ）{r.talentCap ? `／才能キャップ+${r.talentCap}` : ""}</div>
            <div style={{ fontSize: 9.5, color: C.sub, marginTop: 6 }}>コース適性（種目別の総合地力／★＝今月のレースが有利とする種目）</div>
            <DisciplineGrid r={r} highlightKey={race?.tmpl?.favors ? (FAVORS_TO_DISCIPLINE[race.tmpl.favors] || "flat") : undefined} />
            {/* v30: フレーバーテキストは特能と能力値の間に挟まって視認性を損ねていたため、
                カード末尾の独立したプロフィール欄（区切り線付き）に移動した */}
            <div style={{ fontSize: 11, color: C.sub, fontStyle: "italic", marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.line}`, lineHeight: 1.5 }}>{riderFlavorText(r)}</div>
            {(ml.stock.drink > 0 || ml.stock.supp > 0 || ml.stock.tune > 0) && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {ml.stock.drink > 0 && <Btn small outline color={C.green} onClick={() => mlUseStockConfirm("drink")}>{ML_STOCK_ITEMS.drink.label}(-30) ×{ml.stock.drink}</Btn>}
                {ml.stock.supp > 0 && <Btn small outline color={C.green} onClick={() => mlUseStockConfirm("supp")}>{ML_STOCK_ITEMS.supp.label}(-60) ×{ml.stock.supp}</Btn>}
                {ml.stock.tune > 0 && <Btn small outline color={C.green} onClick={() => mlUseStockConfirm("tune")}>{ML_STOCK_ITEMS.tune.label}(フォーム+12) ×{ml.stock.tune}</Btn>}
              </div>
            )}
          </div>
          {/* v35(D 物語): メディアナラティブ。キャリアの現状から「記事になる角度」を選び見出し＋記事を生成 */}
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
          {/* v34(UI): チーム・キャリア状況を折りたたみ、毎月の行動（レース/練習）を主画面の上部に出す */}
          <div style={{ background: C.panel, borderRadius: 10, border: `1px solid ${C.line}` }}>
            <button onClick={() => setMl(s => ({ ...s, uiStatusOpen: !s.uiStatusOpen }))} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "9px 12px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", color: C.sub, fontSize: 11.5 }}>
              <span>📋 状況：世界{ml.worldRank == null ? "—" : `${ml.worldRank}位`}・監督{managerEvalTier(ml.managerEval).label}・人気{Math.round(ml.player.popularity || 0)}{ml.rival ? `・vs ${ml.rival.name}` : ""}{race.rivalPresent ? " 🔥同走" : ""}</span>
              <span style={{ fontWeight: 700 }}>{ml.uiStatusOpen ? "▲ 閉じる" : "▼ 詳しく"}</span>
            </button>
            {ml.uiStatusOpen && (
              <div style={{ display: "grid", gap: 8, padding: "0 10px 10px" }}>
          {/* v30/v31.5: 世界ランキング＆キャリア・アンビション（生き方＝路線で目標が分岐） */}
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
                      <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>達成報酬：{[amb.reward.money ? `資金+${amb.reward.money}万` : null, amb.reward.pop ? `人気+${amb.reward.pop}` : null, amb.reward.ab ? `全能力+${amb.reward.ab}` : null, amb.reward.growth ? "成長力UP" : null].filter(Boolean).join("・")}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: C.yellow, fontWeight: 700, marginTop: 6 }}>🏆 「{path.label}」を極めた！別の生き方に挑戦できます</div>
                  )}
                  <div style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>{path.label}の達成度 {Math.min(idx, path.rungs.length)} / {path.rungs.length}</div>
                </div>
              </div>
            );
          })()}
          {ml.directive && (
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
              <Eyebrow color={C.blue}>監督指示</Eyebrow>
              <div style={{ fontFamily: FONT_D, fontSize: 14, color: C.text, margin: "4px 0 2px" }}>{ml.directive.label}</div>
              <div style={{ fontSize: 11.5, color: C.sub }}>{ml.directive.desc}</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>
                監督評価: <span style={{ color: managerEvalTier(ml.managerEval).color, fontWeight: 700 }}>{managerEvalTier(ml.managerEval).label}</span>
              </div>
            </div>
          )}
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
          {/* v26: 複数ライバル制。2人目の好敵手は初対戦を終えるまでは表示しない（サプライズを残す） */}
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
          <div>
            <Eyebrow>今月の練習メニュー</Eyebrow>
            <select value={r.focus} onChange={e => mlSetFocus(e.target.value)}
              style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px", fontSize: 13, marginTop: 6 }}>
              {AB_KEYS.map(k => <option key={k} value={k}>{AB_LABEL[k]}強化</option>)}
            </select>
          </div>
          <div style={{
            background: (race.milestone || race.monument) ? "#2b2436" : C.panel, borderRadius: 10, padding: "10px 12px",
            border: `1.5px solid ${race.milestone ? ML_MILESTONE_LABEL[race.milestone].color : race.monument ? "#e8a13c" : C.line}`,
          }}>
            <Eyebrow color={race.milestone ? ML_MILESTONE_LABEL[race.milestone].color : race.monument ? "#e8a13c" : C.green}>{race.milestone ? ML_MILESTONE_LABEL[race.milestone].eyebrow : race.monument ? "🏛️ モニュメント（クラシック）" : "今月のレース"}</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 14, color: C.text, margin: "4px 0" }}>{race.name}</div>
            <div style={{ fontSize: 11.5, color: C.sub }}>{race.tmpl.kind}・{"★".repeat(race.grade)}・{TYPES[race.tmpl.favors].label}有利</div>
            {race.monument && <div style={{ fontSize: 11, color: "#e8a13c", marginTop: 3, fontWeight: 700 }}>格式高い一発勝負の古典。長く消耗の激しいコースで真の実力が問われる。制覇すれば「クラシックの覇者」への道が開ける。</div>}
            {race.weather && race.weather !== "clear" && (
              <div style={{ fontSize: 11.5, color: race.weather === "rain" ? C.blue : C.red, marginTop: 2 }}>
                {WEATHER[race.weather].icon} 天候：{WEATHER[race.weather].label}
                {race.weather === "rain" ? "（悪天候巧者がないと能力低下・落車リスク増）" : "（出走後の疲労蓄積が増える）"}
              </div>
            )}
            {race.milestone && <div style={{ fontSize: 11, color: ML_MILESTONE_LABEL[race.milestone].color, marginTop: 3 }}>代表選出！一生に何度もない大舞台での一戦だ。</div>}
            {race.milestone && (() => {
              // v28: 代表チームでの立場。監督評価に応じてエース／アシストの役割が示される
              const natRole = (race.nationalRole || (ml.managerEval >= 55 ? "ace" : "support"));
              return (
                <div style={{ fontSize: 11, color: natRole === "ace" ? C.yellow : C.blue, marginTop: 3 }}>
                  🎌 代表での役割：<b>{natRole === "ace" ? "エース（3位以内で任務達成）" : "アシスト（10位以内で任務達成）"}</b>。全うすれば名声が大きく上がります。
                </div>
              );
            })()}
            {/* v27: 天候予報。今月を含む先の月の天候を先読みして育成計画に活かせるようにする */}
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
          {/* v28: 縦積みになりすぎたボタン群を「今月のアクション（月を消費）」「メニュー（画面表示）」
              「その他・キャリア管理」の3グループに整理。二次的なものは折り返す小ボタンにまとめる */}
          <div style={{ display: "grid", gap: 8 }}>
            <Eyebrow color={C.green}>🎬 今月のアクション（1つ選ぶと1ヶ月進みます）</Eyebrow>
            {/* v31.2: アクションが下部にあり疲労・調子を確認しながら選べないという指摘に対応。
                行動選択の直前に、判断材料（疲労・調子・フォーム・OVR）の要約を再掲する */}
            <div style={{ background: C.panel2, borderRadius: 8, padding: "6px 10px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", fontSize: 11 }}>
              <span style={{ color: C.sub }}>選択の目安 ▶</span>
              <span>疲労 <b style={{ color: r.fatigue > 90 ? C.red : r.fatigue > 60 ? "#e8a13c" : C.green, fontFamily: FONT_M }}>{Math.round(r.fatigue)}</b></span>
              <span>フォーム <b style={{ color: (r.form ?? 50) >= 80 ? C.yellow : (r.form ?? 50) >= 62 ? C.green : C.sub, fontFamily: FONT_M }}>{Math.round(r.form ?? 50)}</b><CondFc dir={r.formForecast} /></span>
              <span>OVR <b style={{ color: C.yellow, fontFamily: FONT_M }}>{overall(r)}</b></span>
            </div>
            {/* v32（条件付き作戦＝ノーリスク無線）：出走前に作戦を選ぶと、結果に実際に反映される */}
            <div style={{ background: C.panel2, borderRadius: 8, padding: "7px 10px" }}>
              <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>📻 レース作戦（結果に反映されます）</div>
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
            </div>
            <Btn onClick={mlStartRace}>🏁 このレースに出場する</Btn>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Btn small outline color={C.sub} onClick={() => mlAdvanceMonth("train")}>💪 練習（focus中心）</Btn>
              <Btn small outline color={C.sub} onClick={() => mlAdvanceMonth("rest")}>😴 完全休養</Btn>
              <Btn small outline color={"#e8a13c"} onClick={() => mlAdvanceMonth("peak")}>🎯 ピーキング調整（フォームを上げる）</Btn>
              <Btn small outline color={C.purple} onClick={mlTriggerEvent}>🎤 取材・私生活イベント</Btn>
              {(ml.player.popularity || 0) >= 20 && (
                <Btn small outline color={"#e8a13c"} onClick={mlTriggerSponsorGig}>📸 スポンサーの仕事</Btn>
              )}
            </div>
            <div style={{ background: C.panel2, borderRadius: 10, padding: "8px 10px" }}>
              <Eyebrow color={C.blue}>🎯 専門トレーニング（狙いを絞って強化・1ヶ月消費）</Eyebrow>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {Object.entries(ML_SPECIAL_TRAINING).map(([k, sp]) => (
                  <Btn key={k} small outline color={C.blue} onClick={() => mlAdvanceMonth(k)} title={sp.desc}>{sp.label}</Btn>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Eyebrow color={C.sub}>📂 メニュー（開くだけ・月は進みません）</Eyebrow>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              <Btn small outline color={"#e8a13c"} onClick={() => setMl(s => ({ ...s, screen: "mylife_shop" }))}>🛍 ショップ</Btn>
              <Btn small outline color={C.yellow} onClick={() => setMl(s => ({ ...s, screen: "mylife_achievements" }))}>🏆 実績 {computeAchievements(ml).filter(a => a.achieved).length}/{ML_ACHIEVEMENTS.length}</Btn>
              <Btn small outline color={C.green} onClick={() => setMl(s => ({ ...s, screen: "mylife_teamroster" }))}>👥 チーム名鑑</Btn>
              <Btn small outline color={C.blue} onClick={() => setMl(s => ({ ...s, screen: "mylife_graph" }))}>📈 キャリアグラフ</Btn>
              <Btn small outline color={C.purple} onClick={() => setMl(s => ({ ...s, screen: "mylife_abilityfile" }))}>🗂 特殊能力図鑑</Btn>
              <Btn small outline color={"#e8a13c"} onClick={() => setMl(s => ({ ...s, screen: "mylife_records" }))}>🏅 コースレコード</Btn>
              <Btn small outline color={C.blue} onClick={() => setMl(s => ({ ...s, screen: "mylife_help" }))}>📖 ヘルプ</Btn>
            </div>
          </div>
          <div>
            <Eyebrow color={C.sub}>⚙ その他・キャリア管理</Eyebrow>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, alignItems: "center" }}>
              {ml.flags?.mentor
                ? <span style={{ fontSize: 11.5, color: C.yellow }}>🎖 チームの精神的支柱（毎月疲労-3／評価+0.3）</span>
                : r.age >= 30 && (
                  <Btn small outline color={C.yellow} onClick={() => askConfirm("若手のメンターになりますか？（毎月の疲労回復と監督評価の伸びが恒常的に上がります。一度なると元には戻せません）", mlBecomeMentor)}>🎖 メンターになる</Btn>
                )}
              <Btn small outline color={"#e8a13c"} onClick={() => askConfirm(`ラストレースに出場してから引退しますか？あなたの脚質に合ったグレード4のエキシビションで、ライバルたちも駆けつける最高の舞台です。走り終えるとそのまま引退となります。`, mlStartLastRace)}>🏁 ラストレースで引退</Btn>
              <Btn small outline color={C.red} onClick={() => askConfirm(`${r.age}歳で現役を引退しますか？この操作は取り消せません（キャリアの記録はセレモニー画面で振り返れます）。`, () => { mlRecordLegend(ml); setMl(s => ({ ...s, screen: "mylife_retired" })); })}>🚪 静かに引退</Btn>
              <Btn small outline color={C.red} onClick={() => askConfirm("マイライフを最初からやり直しますか？現在の選手の保存データは消えます（歴代の殿堂記録は残ります）。", () => { clearMyLifeSave(); setMl(initMyLife()); })}>🔄 最初からやり直す</Btn>
              <Btn small outline color={C.sub} onClick={() => askConfirm("マイライフモードを終了してタイトルに戻りますか？（自動セーブ済み）", () => setSuperMode(null))}>← タイトルに戻る</Btn>
            </div>
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
    if (ml.screen === "mylife_help") {
      const Section = ({ color, title, children }) => (
        <div>
          <Eyebrow color={color}>{title}</Eyebrow>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>{children}</div>
        </div>
      );
      const Card = ({ children }) => (
        <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>{children}</div>
      );
      return mlWrap(
        <div style={{ display: "grid", gap: 14 }}>
          <Eyebrow color={C.blue}>📖 ヘルプ</Eyebrow>

          <Section color={C.green} title="毎月の基本アクション">
            <Card>毎月1つだけアクションを選びます：<span style={{ color: C.text }}>①その月のレースに出走</span>／<span style={{ color: C.text }}>②練習</span>（指定能力+疲労増）／<span style={{ color: C.text }}>③完全休養</span>（疲労回復のみ）／<span style={{ color: C.text }}>④取材・私生活イベント</span>（能力・疲労に小さな効果）。出走すると賞金・ポイント・出走経験による能力成長が入りますが、疲労も大きく増えます。</Card>
            <Card>クラスはB1→A→PROの3段階。各クラスの昇格に必要なポイントを1年（12ヶ月）で稼ぐと年度末に昇格し、上位クラスほど賞金・年俸の倍率が上がります。</Card>
          </Section>

          <Section color={C.yellow} title="成長・練習の仕組み">
            <Card>選手（自分）にも成長タイプ（早熟・普通・晩成・超早熟・超晩成）と成長期／全盛期／衰え期があり、成長力（C/B/A/S、×0.7〜×1.6）が伸び方に倍率をかけます。練習では指定能力に90%、残り4能力に14%が配分されます。</Card>
            <Card>能力の伸びには年数が経つほど上昇し続けるソフトキャップがあります（目安：1年目90、以後1年ごとに+2、最大132）。この値未満は伸び全開、超えると急激に鈍化します。キャリアが長くなっても練習が無意味にならないよう、上限自体が毎年じわじわ上がっていきます。</Card>
            <Card>出走した場合は、レースで使った区間の種目に応じた「出走経験」でも能力が伸び、レースのグレードが高いほど伸びが大きくなります。またキャリアを重ねるほど対戦相手（AI選手）の地力も底上げされていくため、成長を怠るとだんだん勝てなくなっていきます。</Card>
          </Section>

          <Section color={C.red} title="疲労・フォーム">
            <Card>出走で疲労+40（車のグレードや「鉄人」「回復力」等で軽減）。疲労が60未満なら急いで回復させる必要はなく、90を超えると要注意です。</Card>
            <Card>フォーム（好不調・0〜100）はレース当日の能力を最大±17%上下させる好不調の指標です。毎月ゆるやかに基準値へ戻りつつ波打ち、「🎯ピーキング調整」で大きく上がります（狙ったレースに合わせて仕上げ、ピークは長く維持できません）。フォーム調整剤（ショップ）でも上げられます。「ムラっ気」は波が激しく、「精密機械」やメンタルが高い選手は安定します。予報アイコンで翌月の傾向がわかります。</Card>
            <Card>結婚・子供の有無・一戸建て以上の住居・メンター就任などのライフイベントは、毎月の疲労回復量にわずかな恒常ボーナスを与えます。</Card>
          </Section>

          <Section color={C.blue} title="監督指示・監督評価">
            <Card>毎月、監督から「エースとして表彰台を狙え」「積極的な走りで上位進出せよ」「アシストとしてチームを支えよ」「経験を積むために出走せよ」のいずれかの指示が出ます。達成すると監督評価が上がり、未達成だと下がります。監督評価が高いほど「エース」指示が出やすくなります。</Card>
            <Card>監督評価は年俸交渉や移籍オファーの内容にも影響します。練習をこなす、住環境を整える等でも少しずつ上がります。</Card>
          </Section>

          <Section color={"#4f8fe8"} title="レース作戦（出走前に選択）">
            <Card>出走前に作戦を選べます（結果に反映）：<span style={{ color: C.text }}>🚩標準</span>（流れ任せ）／<span style={{ color: C.text }}>⏳末脚温存</span>（集団維持でゴール勝負・スプリント型向き）／<span style={{ color: C.text }}>💨早めに逃げる</span>（自ら逃げに乗る・逃げ実績稼ぎにも）／<span style={{ color: C.text }}>⚔積極的に仕掛ける</span>（エース時の終盤アタック）。監督指示とは別に、あなた自身の意思で展開を作れます。</Card>
            <Card><span style={{ color: C.text }}>🤝アシストに徹する</span>＝自分の勝ちを捨ててエースを支える献身の走り。あなたが牽引・風除けを担うことで<b style={{ color: "#4f8fe8" }}>チームのエースが実際に押し上げられ</b>、エースが表彰台に入れば名アシストとして人気・監督評価・報酬が上乗せされます（あなたの地力や「献身のアシスト」特能が高いほど効果大）。<b style={{ color: "#4f8fe8" }}>監督指示がエースでも必ずアシスト戦としてカウントされ、監督評価も下がりません。</b>「献身の道（アンビション）」を狙うなら、監督の指示待ちにせず自分でこの作戦を選んで積み上げてください。</Card>
          </Section>

          <Section color={"#e8a13c"} title="世界ランキングとアンビション（生き様）">
            <Card>レースの着順・グレードに応じて世界ランキングポイントが入り、世界ランクが上下します。上位を目指すのが長期の大目標です。</Card>
            <Card>🌍 世界のペロトンは<b style={{ color: "#4f8fe8" }}>生きています</b>。世界ランキングの選手たちは実在の名前を持ち、毎年 加齢・成長・衰え・引退を繰り返して世代交代します（名選手の血を継ぐ2世が台頭することも）。ランキング画面の「今年の世界の動き」で新王者・引退・新星をチェックできます。さらに<b style={{ color: "#e8a13c" }}>あなたが殿堂に残した名選手・確立した系統の血は、次のキャリアの世界に🩸血統として流入</b>し、世界の頂点を争います。</Card>
            <Card>🌍 世界ランキング上位のスターは<b style={{ color: "#4f8fe8" }}>実際のあなたのレースにも出走してきます</b>（出走表に「🌍◯位」で表示）。格の高いレース（世界選手権・モニュメント等）ほど強豪が集います。世界の強豪と直接ぶつかり、打ち破ってのし上がっていきましょう。</Card>
            <Card>「生き方（アンビション）」は4つの道から選べます：<span style={{ color: C.text }}>🏆勝利の道</span>（勝利数）／<span style={{ color: C.text }}>🎭大舞台の道</span>（★の高いレース）／<span style={{ color: C.text }}>🤝献身の道</span>（アシスト戦数＝上の🤝作戦で積む）／<span style={{ color: C.text }}>🌍世界の道</span>（世界ランク）。道ごとに目標のはしごが異なり、達成報酬（資金・能力・成長力）が入ります。「🔀生き方を変える」でいつでも切替できます。</Card>
            <Card>引退時のキャリア傾向から「生き様（称号）」が決まり、殿堂記録に残ります。これが次のプレイの配合（生き様の血）にも影響します。</Card>
          </Section>

          <Section color={"#e56cc8"} title="配合・血統（教え子／殿堂）">
            <Card>キャラ作成時、殿堂の名選手を<span style={{ color: C.text }}>師匠（1人）＝教え子</span>、さらに<span style={{ color: C.text }}>配合相手（2人目）＝血を引く子</span>として選べます。両親の脚質相性（ニック）・血の濃さ・累代+値・生き様の血などから恩恵が決まります。</Card>
            <Card><b style={{ color: "#e56cc8" }}>爆発力＆配合評価（SS〜D）</b>：配合の質を1つの数値に集約した評価。ボーナスは初期能力ではなく<span style={{ color: C.text }}>伸びしろ（成長力・才能キャップ）</span>に還元されます＝生まれた瞬間は普通でも、育てると化けます。</Card>
            <Card><b style={{ color: C.red }}>危険度</b>：共通の祖先を持つ濃い配合（インブリード）は爆発力が上がる一方、稀に「ガラスの体」を持って生まれるリスクがあります。両親の健康な血（鉄人・頑丈・高スタミナ）と血脈の多様性で軽減されます。ハイリスク・ハイリターンの駆け引きです。</Card>
            <Card><b style={{ color: "#e8a13c" }}>系統確立＋因子</b>：同じ系統名の名選手を代々輩出すると、血統が「確立→名門→大系統」と成長します（プレイをまたいで蓄積）。確立した系統を継ぐ子孫は因子として伸びしろ＋系統特能を受け取り、大系統ではその因子が金特で発現します。</Card>
            <Card><b style={{ color: C.yellow }}>特殊配合</b>：特定の血の組み合わせ（例：二人の世界王者＝絶対王者の系譜、登坂型×平地型＝万能王の血脈 など）は、唯一無二の名血（金枠の称号＋金特）を確定で生みます。いろいろな組み合わせを試してみてください。</Card>
            <Card>これらの恩恵は<span style={{ color: C.text }}>金特クロス・配合限定特能</span>とあわせて配合プレビューに表示されます。シーズンモードでも「血統ユース」で同じ仕組みの原石を確保できます。</Card>
          </Section>

          <Section color={C.purple} title="年俸・契約・移籍オファー">
            <Card>年俸は年度末にその年のポイント・勝利数・表彰台数に応じて改定されます。好成績を残すと複数チームから移籍オファー（年俸倍率・契約金・エース確約の有無つき）が届き、残留か移籍かを選べます。移籍先のクラス（B1/A/PRO）がそのまま翌年の所属クラスになります。</Card>
          </Section>

          <Section color={C.red} title="ライバル">
            <Card>キャリア開始時に固定のライバル選手が1名生成されます。同じレースに出走すると自動で対決成績（通算勝敗）が記録され、随所で意識させられる存在になります。</Card>
          </Section>

          <Section color={C.yellow} title="節目の大会">
            <Card>🌍世界選手権：クラスA以上なら毎年9月に選出されます。🥇オリンピック：PROクラスかつ4年に一度だけ、3月に選出されます。どちらもグレード4（通常の最高格付けの1.3倍相当）の一発勝負で、ライバルも代表入りしてきます。</Card>
          </Section>

          <Section color={"#e8a13c"} title="モニュメント（ワンデー・クラシック）">
            <Card>🏛️ 毎年決まった月に、格式高い一発勝負の古典レース「モニュメント」が開催されます：<span style={{ color: C.text }}>石畳の古典《春の地獄》</span>（5月・ルーラー有利）／<span style={{ color: C.text }}>丘陵の古典《アルデンヌ》</span>（8月・パンチャー有利）／<span style={{ color: C.text }}>山岳の古典《秋の女王》</span>（10月・クライマー有利）。いずれも長く消耗の激しいコースで、脚質と地力が問われます。</Card>
            <Card>モニュメントを制覇するとキャリアに刻まれ、複数勝てば引退時に「クラシックの覇者」「石畳の古豪」といった生き様（称号）が付きます。ステージレースや集団スプリントとはひと味違う、古典ならではの重みのある一戦です。</Card>
            <Card>🪨 各モニュメントには<span style={{ color: "#e8a13c" }}>脚質別の古典適性</span>があります——石畳＝<span style={{ color: "#e8a13c" }}>「石畳巧者」</span>／丘陵＝<span style={{ color: "#e8a13c" }}>「アルデンヌの狼」</span>／山岳＝<span style={{ color: "#e8a13c" }}>「秋の女王」</span>。その古典で表彰台に立つと開眼することがあり（対応する古典本番で全能力+5%）、優勝すると金特に進化して+9%に強化されます。狙う古典を絞って育てるのが古典ハンターへの道です。</Card>
          </Section>

          <Section color={C.green} title="人生の岐路・オフシーズンの過ごし方">
            <Card>年度末には必ず「オフシーズンの過ごし方」を3択（国内自主トレ・海外武者修行・休養）から選びます。海外武者修行はハイリスクハイリターン（伸び大・疲労も増加）です。</Card>
            <Card>それとは別に、結婚・大きな怪我・第一子誕生・新人時代の恩師との別れといった「人生の岐路」が、条件を満たすと年度末に低確率（恩師との別れのみ確定）で発生し、一度きりの選択とその後ずっと続く恒常効果をもたらします。</Card>
          </Section>

          <Section color={"#e8a13c"} title="個人スポンサー・人気度">
            <Card>レースの着順が良いほど（グレードが高いレースほど）人気度（0〜100）が上がります。人気度10ごとに月+2万円の個人スポンサー収入（チーム年俸とは別枠）が入り、25/50/75/100到達時には契約一時金も入ります。</Card>
            <Card>人気度が20以上になると、毎月のアクションとして<span style={{ color: C.text }}>スポンサーの仕事（CM出演・撮影など）</span>を引き受けられるようになります。報酬（お金）と人気度が得られますが、その月は競技に集中できず疲労が残ります。報酬額は人気度が高いほど大きくなります。</Card>
          </Section>

          <Section color={C.blue} title="新人時代の恩師（師弟関係）">
            <Card>キャリア開始時、チームの恩師が新人指導を買って出てくれます。3年目を迎えるまでは練習・出走経験の伸びに+15%のボーナスがかかり、3年目に「人生の岐路」として一区切りを迎えます（選択次第で餞別の能力ボーナスもあります）。</Card>
          </Section>

          <Section color={"#6fa8dc"} title="天候">
            <Card>レースごとに晴れ・🌧雨・🥵猛暑のいずれかが決まります。雨は能力低下＋落車リスク（「悪天候巧者」で軽減）、猛暑は出走後の疲労蓄積増です。</Card>
          </Section>

          <Section color={C.purple} title="特殊能力">
            <Card>0〜3個の特殊能力を保有し、条件を満たすと保有能力が金特に強化されたり、新しい能力を後天的に習得したりします。発見済みの能力は特殊能力図鑑で内容を確認できます。</Card>
          </Section>

          <Section color={C.sub} title="実績・殿堂入り">
            <Card>初勝利・初表彰台など、キャリアを通じた実績を達成すると報酬が入ります。達成状況は「実績を見る」から確認できます。引退時はキャリアが記録として殿堂（歴代選手の殿堂）に残ります。</Card>
          </Section>

          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }

    // v29: 出走表（マイライフ）。レース本番前に顔ぶれを確認できる
    if (ml.screen === "mylife_startlist" && ml.result) return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <Eyebrow color={C.purple}>🏁 出走表 — {ml.result.raceMeta.name}</Eyebrow>
        <div style={{ fontSize: 11.5, color: C.sub }}>{ml.result.raceMeta.tmpl.kind}・{"★".repeat(ml.result.raceMeta.grade)}・{TYPES[ml.result.raceMeta.tmpl.favors].label}有利</div>
        <StartListPanel entrants={ml.result.entrants} favors={ml.result.raceMeta.tmpl.favors} />
        <Btn onClick={() => setMl(s => ({ ...s, screen: "mylife_race" }))}>🏁 レースを始める</Btn>
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

    if (ml.screen === "mylife_result" && ml.resultInfo) {
      const { race, rank, total, pts, directive, fulfilled, evalDelta, prize, rivalOutcome, rivalOutcome2, rival2Intro, popGain, popBonus, courseRecord, natRole, natFulfilled, natPopBonus, wpGain, worldRank, worldRankPrev, ambitionCleared, assistOutcome, finishTime, gapSec, forecast } = ml.resultInfo;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
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
              <Eyebrow color={assistOutcome.success ? C.green : C.red}>🤝 献身の走り — {assistOutcome.success ? "エースを勝利に導いた" : "報われず"}</Eyebrow>
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
            </div>
          )}
          {directive && (
            <div style={{ background: fulfilled ? "#16241c" : "#241818", border: `1px solid ${fulfilled ? C.green : C.red}`, borderRadius: 10, padding: "10px 12px" }}>
              <Eyebrow color={fulfilled ? C.green : C.red}>監督指示 — {fulfilled ? "達成" : "未達成"}</Eyebrow>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>{directive.label}</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>監督評価 {evalDelta >= 0 ? "+" : ""}{evalDelta}</div>
            </div>
          )}
          <Btn onClick={() => mlAdvanceMonth("race")}>翌月へ進む →</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_shop" && ml.player) {
      const r = ml.player;
      const availPartsMl = (pid) => (ml.partsInv[pid] || 0) - (Object.values(r.parts || {}).includes(pid) ? 1 : 0);
      const shopCat = ml.shopCat || "parts";
      return mlWrap(
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
            <Eyebrow color={C.green}>SHOP — 所持金 {ml.money}万円</Eyebrow>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>年俸{ml.salary}万円/年（毎月{Math.round(ml.salary / 12)}万円が振り込まれます・生活費/税 -{mlLivingCost(ml)}万/月）</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 11, color: C.sub }}>現在の疲労</span>
              <div style={{ width: 90 }}><FatigueBar v={r.fatigue} /></div>
              <span style={{ fontSize: 11, color: C.sub }}>フォーム <span style={{ color: (r.form ?? 50) >= 80 ? C.yellow : (r.form ?? 50) >= 62 ? C.green : C.sub, fontFamily: FONT_M }}>{Math.round(r.form ?? 50)}</span></span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["parts", "🔧 パーツ", C.purple], ["items", "🧪 消耗品・合宿", C.green], ["perm", "⭐ 恒久投資", "#e8a13c"]].map(([k, label, col]) => (
              <button key={k} onClick={() => setMl(x => ({ ...x, shopCat: k }))}
                style={{ flex: "1 1 auto", minWidth: 0, background: shopCat === k ? col : C.panel2, color: shopCat === k ? "#14171d" : C.sub, border: `1px solid ${shopCat === k ? col : C.line}`, borderRadius: 8, padding: "7px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {shopCat === "parts" && (<section>
            <Eyebrow color={C.purple}>マシンパーツ（クラス昇格で上位解禁）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(PARTS).map(([pid, p]) => {
                const lockedByClass = p.tier > ml.classIdx + 1;
                return (
                  <div key={pid} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, opacity: lockedByClass ? 0.5 : 1 }}>
                    <div>
                      <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                        {p.label} <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.purple }}>所持{ml.partsInv[pid] || 0}（空き{Math.max(0, availPartsMl(pid))}）</span>
                      </div>
                      <div style={{ color: C.sub, fontSize: 11 }}>[{SLOT_LABEL[p.slot]}] {Object.entries(p.ab).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join(" / ")}</div>
                    </div>
                    {lockedByClass
                      ? <span style={{ fontSize: 11, color: C.red, whiteSpace: "nowrap" }}>🔒 {CLASSES[p.tier - 1].id}で解禁</span>
                      : <Btn small color={C.purple} disabled={ml.money < p.price} onClick={() => mlBuyPart(pid)}>{p.price}万</Btn>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              {PART_SLOTS.map(slot => (
                <span key={slot} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 11, color: C.purple }}>{SLOT_LABEL[slot]}:</span>
                  <select value={r.parts[slot] || ""} onChange={e => mlSetPart(slot, e.target.value)}
                    style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 5px", fontSize: 11.5, maxWidth: 140 }}>
                    <option value="">— なし —</option>
                    {Object.entries(PARTS).filter(([pid, p]) => p.slot === slot && (availPartsMl(pid) > 0 || r.parts[slot] === pid))
                      .map(([pid, p]) => <option key={pid} value={pid}>{p.label}</option>)}
                  </select>
                </span>
              ))}
            </div>
          </section>)}
          {shopCat === "items" && (<section>
            <Eyebrow color={C.green}>消耗品（在庫制）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(ML_STOCK_ITEMS).map(([k, it]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{it.label} <span style={{ fontFamily: FONT_M, color: C.green }}>×{ml.stock[k] || 0}</span></div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{it.desc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn small outline color={C.green} disabled={ml.money < it.price} onClick={() => mlBuyStock(k)}>{it.price}万で購入</Btn>
                    <Btn small color={C.green} disabled={(ml.stock[k] || 0) <= 0} onClick={() => mlUseStockConfirm(k)}>使う</Btn>
                  </div>
                </div>
              ))}
            </div>
          </section>)}
          {shopCat === "items" && (<section>
            <Eyebrow color={"#e8a13c"}>私設強化合宿（何度でも・資金の使い道）</Eyebrow>
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6 }}>
              <div>
                <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>私設強化合宿</div>
                <div style={{ color: C.sub, fontSize: 11 }}>資金を注ぎ込み{AB_LABEL[r.focus]}を中心に鍛える（{AB_LABEL[r.focus]}+6・他+2、疲労+12）。伸びしろが尽きた選手には効きにくい</div>
              </div>
              <Btn small color={"#e8a13c"} disabled={ml.money < mlPrivateCampCost(ml)} onClick={mlPrivateCamp}>{mlPrivateCampCost(ml)}万で実施</Btn>
            </div>
          </section>)}
          {shopCat === "perm" && (<section>
            <Eyebrow color={C.blue}>永続トレーニング用品（買い切り）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(ML_GEAR).map(([k, it]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{it.label}</div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{it.desc}</div>
                  </div>
                  {ml.gear[k]
                    ? <span style={{ fontSize: 11, color: C.green, whiteSpace: "nowrap" }}>✔ 購入済み</span>
                    : <Btn small color={C.blue} disabled={ml.money < it.price} onClick={() => mlBuyGear(k)}>{it.price}万</Btn>}
                </div>
              ))}
            </div>
          </section>)}
          {shopCat === "perm" && (<section>
            <Eyebrow color={"#e8a13c"}>車（レース参加の疲労蓄積を軽減）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {ML_CARS.map((c, i) => (
                <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${ml.carLv === i ? "#e8a13c" : C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{c.label}{ml.carLv === i && <span style={{ marginLeft: 6, fontSize: 10.5, color: "#e8a13c" }}>（所有中）</span>}</div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{c.desc}</div>
                  </div>
                  {ml.carLv >= i ? null : <Btn small color={"#e8a13c"} disabled={ml.money < c.price || ml.carLv !== i - 1} onClick={mlBuyCar}>{c.price}万</Btn>}
                </div>
              ))}
            </div>
          </section>)}
          {shopCat === "perm" && (<section>
            <Eyebrow color={C.red}>家（毎月の疲労回復を底上げ）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {ML_HOUSES.map((h, i) => (
                <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${ml.houseLv === i ? C.red : C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{h.label}{ml.houseLv === i && <span style={{ marginLeft: 6, fontSize: 10.5, color: C.red }}>（所有中）</span>}</div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{h.desc}</div>
                  </div>
                  {ml.houseLv >= i ? null : <Btn small color={C.red} disabled={ml.money < h.price || ml.houseLv !== i - 1} onClick={mlBuyHouse}>{h.price}万</Btn>}
                </div>
              ))}
            </div>
          </section>)}
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_event" && ml.pendingEvent) {
      const ev = ml.pendingEvent;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "#2b2436", border: `1px solid ${C.purple}`, borderRadius: 10, padding: "12px 14px" }}>
            <Eyebrow color={C.purple}>LIFE EVENT — {ev.title}</Eyebrow>
            <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0" }}>{ev.text}</p>
          </div>
          {ev.choices.map((c, i) => (
            <Btn key={i} color={C.purple} onClick={() => mlResolveEvent(i)}>{c.label}</Btn>
          ))}
        </div>
      );
    }

    if (ml.screen === "mylife_event_result") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, border: `1px solid ${C.line}` }}>
          <Eyebrow color={C.purple}>結果</Eyebrow>
          <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{ml.eventResultText}</p>
        </div>
        <Btn onClick={() => mlAdvanceMonth("event")}>翌月へ進む →</Btn>
      </div>
    );

    if (ml.screen === "mylife_offseason" && ml.pendingOffseason) {
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "#1e2b24", border: `2px solid ${C.green}`, borderRadius: 10, padding: "12px 14px" }}>
            <Eyebrow color={C.green}>オフシーズン</Eyebrow>
            <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0" }}>新シーズンまでの間、どのように過ごしますか？</p>
          </div>
          {ML_OFFSEASON_CHOICES.map((c, i) => (
            <div key={c.key} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
              <div style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 14, color: C.text }}>{c.label}</div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{c.desc}</div>
              <Btn small color={C.green} style={{ marginTop: 8 }} onClick={() => mlResolveOffseason(i)}>これを選ぶ</Btn>
            </div>
          ))}
        </div>
      );
    }

    if (ml.screen === "mylife_offseason_result") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.green}` }}>
          <Eyebrow color={C.green}>結果</Eyebrow>
          <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{ml.offseasonResultText}</p>
        </div>
        <Btn onClick={mlContinueAfterOffseason}>続ける →</Btn>
      </div>
    );

    if (ml.screen === "mylife_crossroads" && ml.pendingCrossroads) {
      const cr = ML_CROSSROADS[ml.pendingCrossroads.key];
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "#2b1e1e", border: `2px solid ${C.red}`, borderRadius: 10, padding: "12px 14px" }}>
            <Eyebrow color={C.red}>{cr.title}</Eyebrow>
            <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0" }}>{cr.text}</p>
          </div>
          {cr.choices.map((c, i) => (
            <Btn key={i} color={C.red} onClick={() => mlResolveCrossroads(i)}>{c.label}</Btn>
          ))}
        </div>
      );
    }

    if (ml.screen === "mylife_crossroads_result") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.red}` }}>
          <Eyebrow color={C.red}>結果</Eyebrow>
          <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{ml.crossroadsResultText}</p>
        </div>
        <Btn onClick={mlContinueAfterCrossroads}>続ける →</Btn>
      </div>
    );

    if (ml.screen === "mylife_contract" && ml.contractOffers) return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: ml.biddingWar ? "#3a2a12" : "#2b2436", border: `1px solid ${ml.biddingWar ? "#e8a13c" : C.purple}`, borderRadius: 10, padding: "10px 14px" }}>
          <Eyebrow color={ml.biddingWar ? "#e8a13c" : C.purple}>{ml.biddingWar ? "🔥 CONTRACT — 争奪戦！" : "CONTRACT — 移籍オファー"}</Eyebrow>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
            {ml.biddingWar
              ? "圧倒的な成績にチーム間で争奪戦が勃発！各チームが競って年俸・契約金・エース確約を吊り上げてきています。最高の条件を選び取りましょう。"
              : "好成績を残したあなたに、複数チームから声がかかっています。条件を見比べて来季の所属先を選んでください。"}
          </div>
        </div>
        {ml.contractOffers.map((offer, i) => {
          const isStay = i === 0;
          const previewSalary = Math.round(ml.salary * offer.salaryMul);
          const classDelta = offer.tier - ml.classIdx;
          return (
            <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1.5px solid ${isStay ? C.line : C.purple}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontFamily: FONT_M, fontSize: 11, fontWeight: 700, color: "#14171d", background: CLASS_TIER_COLOR[offer.tier],
                  borderRadius: 5, padding: "1px 6px",
                }}>{CLASSES[offer.tier].id}</span>
                <span style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 14, color: C.text }}>{offer.team}{isStay ? "（残留）" : "（移籍）"}</span>
                {classDelta > 0 && <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>⬆ 昇格</span>}
                {classDelta < 0 && <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>⬇ 降格</span>}
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>年俸 {previewSalary}万円{offer.bonus > 0 && <span style={{ color: C.green }}>／契約金 +{offer.bonus}万円</span>}</div>
              {offer.aceGuarantee && <div style={{ fontSize: 11, color: C.yellow, marginTop: 2 }}>👑 来季開幕戦はエースとして起用を確約</div>}
              <Btn small outline={isStay} color={C.purple} onClick={() => mlChooseTeam(offer)} style={{ marginTop: 8 }}>この条件で契約する</Btn>
            </div>
          );
        })}
      </div>
    );

    // v28: 引退勧告の駆け引き画面
    if (ml.screen === "mylife_retire_advice" && ml.player) {
      const r = ml.player;
      const info = ml.adviceInfo || { age: r.age, ovr: overall(r), joinOvr: r.joinOvr };
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${C.red}`, textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>📋</div>
            <h2 style={{ fontFamily: FONT_D, color: C.red, fontSize: 20, margin: "6px 0" }}>チームからの引退勧告</h2>
            <div style={{ fontSize: 12, color: C.sub }}>{info.age}歳・全盛期の力に陰りが見える</div>
          </div>
          <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.8, background: C.panel2, borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${C.red}` }}>
            監督room「{r.name}、今季もよく走ってくれた。だが正直、往年の走りには戻れていない（OVR {info.ovr}／全盛期基準{info.joinOvr}）。
            そろそろ身の振り方を考える時期かもしれない。もう一年やるか、役割を落として続けるか、それとも——決めるのは君だ」
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <Btn color={C.sub} outline onClick={mlRetireAdviceContinue}>💪 勧告を退けて現役を続ける（今まで通り）</Btn>
            <Btn color={C.blue} outline onClick={mlRetireAdviceReduceRole}>🤝 役割を縮小して続ける（レース負荷-15%・延命）</Btn>
            <Btn color={C.red} outline onClick={() => askConfirm(`勧告を受け入れ、${r.age}歳で引退しますか？この操作は取り消せません。`, mlRetireAdviceAccept)}>🏁 勧告を受け入れて引退する</Btn>
          </div>
        </div>
      );
    }
    if (ml.screen === "mylife_retired" && ml.player) {
      const r = ml.player;
      const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
      const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
      const arch = mlCareerArchetype(ml);
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${C.yellow}`, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🏁</div>
            <h2 style={{ fontFamily: FONT_D, color: C.yellow, fontSize: 22, margin: "8px 0" }}>{r.name} 引退</h2>
            {riderNickname(r) && <div style={{ fontSize: 13, color: C.purple, fontStyle: "italic" }}>「{riderNickname(r)}」</div>}
            {/* v31.4: キャリアの生き様（称号）。どんな伝説だったかを引退セレモニーで称える */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 10.5, color: C.sub }}>この選手の生き様</div>
              <div style={{ fontFamily: FONT_D, fontSize: 19, fontWeight: 700, color: arch.color, margin: "3px 0" }}>― {arch.title} ―</div>
              <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.6 }}>{arch.desc}</div>
            </div>
          </div>
          {ml.lastRaceResult && (
            <div style={{ background: "rgba(232,161,60,0.1)", borderRadius: 10, padding: "10px 12px", border: `1.5px solid #e8a13c` }}>
              <Eyebrow color={"#e8a13c"}>🏁 ラストレース — {ml.lastRaceResult.name}</Eyebrow>
              <div style={{ fontFamily: FONT_D, fontSize: 17, color: C.text, fontWeight: 700, margin: "4px 0" }}>{ml.lastRaceResult.rank}位 / {ml.lastRaceResult.total}人中</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{ml.lastRaceResult.flavor}</div>
            </div>
          )}
          <div style={{ fontSize: 11.5, color: C.text, padding: "8px 10px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.purple}`, lineHeight: 1.6 }}>
            {riderCareerSummary({ ...r, farewellYear: ml.year, farewellReason: "retired" })}
          </div>
          <div style={{ fontSize: 11.5, color: C.sub }}>通算{(r.raceLog || []).length}戦・{wins}勝・表彰台{podiums}回</div>
          {ml.rival && (
            <div style={{ fontSize: 11.5, color: C.text, padding: "8px 10px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.red}`, lineHeight: 1.6 }}>
              ライバル・{ml.rival.name}（{ml.rival.team}）との通算対戦成績は{ml.rivalRecord?.meetings || 0}戦{ml.rivalRecord?.wins || 0}勝{ml.rivalRecord?.losses || 0}敗だった。
            </div>
          )}
          {ml.rival2 && (
            <div style={{ fontSize: 11.5, color: C.text, padding: "8px 10px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.blue}`, lineHeight: 1.6 }}>
              好敵手・{ml.rival2.name}（{ml.rival2.team}）との通算対戦成績は{ml.rivalRecord2?.meetings || 0}戦{ml.rivalRecord2?.wins || 0}勝{ml.rivalRecord2?.losses || 0}敗だった。
            </div>
          )}
          {/* v26: 引退後キャリア（エピローグ）。監督転身／完全引退を選ぶと殿堂記録に後日談が加わる */}
          {ml.epilogueText ? (
            <div style={{ fontSize: 11.5, color: C.text, padding: "8px 10px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.yellow}`, lineHeight: 1.7 }}>
              {ml.epilogueText}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 11.5, color: C.sub }}>引退後の道を選ぶと、殿堂の記録に後日談が加わります。</div>
              <Btn small outline color={C.yellow} onClick={() => { const t = mlEpilogueDirector(ml); mlSetEpilogue(t); setMl(s => ({ ...s, epilogueText: t })); }}>🎓 監督としてチームに残る</Btn>
              <Btn small outline color={C.sub} onClick={() => { const t = mlEpilogueAway(ml); mlSetEpilogue(t); setMl(s => ({ ...s, epilogueText: t })); }}>🚶 競技から静かに離れる</Btn>
            </div>
          )}
          {/* v28: 自伝・レジェンドインタビュー。座右の言葉を選んで出版すると殿堂記録に名言が残る */}
          {ml.autobiographyText ? (
            <div style={{ fontSize: 12, color: C.text, padding: "10px 12px", background: "rgba(201,139,240,0.1)", borderRadius: 8, border: `1px solid ${C.purple}`, lineHeight: 1.7 }}>
              📖 自伝を出版した。<span style={{ color: C.purple, fontStyle: "italic" }}>「{ml.autobiographyText}」</span>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <Eyebrow color={C.purple}>📖 自伝を出版する — 座右の言葉を残す</Eyebrow>
              {mlAutobiographyOptions(ml).map((o, i) => (
                <Btn key={i} small outline color={C.purple} onClick={() => { mlSetAutobiography(o.quote); setMl(s => ({ ...s, autobiographyText: o.quote })); }}>{o.title}</Btn>
              ))}
            </div>
          )}
          <Btn onClick={() => { clearMyLifeSave(); setMl(initMyLife()); }}>新たな選手でキャリアを始める</Btn>
          <Btn outline color={C.purple} onClick={() => setMl(s => ({ ...s, screen: "mylife_legends" }))}>🏛 歴代選手の殿堂を見る</Btn>
          <Btn outline color={C.sub} onClick={() => setSuperMode(null)}>← モード選択に戻る</Btn>
        </div>
      );
    }

    // v32: チーム名鑑（固定チームメイトの確認画面）
    if (ml.screen === "mylife_teamroster" && ml.player) {
      const mates = ml.teammates || [];
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.green}` }}>
            <Eyebrow color={C.green}>👥 チーム名鑑 — {ml.team}</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>あなたと同じチームを走る固定メンバーです。移籍すると顔ぶれが変わります。</div>
          </div>
          <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.yellow}` }}>
            <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.yellow }}>★ {ml.player.name}（あなた）<span style={{ fontSize: 10.5, color: TYPES[ml.player.type]?.color, marginLeft: 6 }}>{TYPES[ml.player.type]?.label}</span><span style={{ fontFamily: FONT_M, fontSize: 11, color: C.sub, marginLeft: 8 }}>OVR {overall(ml.player)}</span></div>
          </div>
          {mates.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>チームメイトの記録がありません。</div>}
          {mates.map((tm, i) => (
            <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
              <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{tm.name}<span style={{ fontSize: 10.5, color: TYPES[tm.type]?.color, marginLeft: 6 }}>{TYPES[tm.type]?.label}</span></div>
              <PersonaLine p={tm.personality} />
              {tm.abilities && tm.abilities.length > 0 && <div style={{ fontSize: 10.5, color: C.purple, marginTop: 2 }}>{tm.abilities.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")}</div>}
              {(tm.winsForMe || 0) > 0 && <div style={{ fontSize: 10.5, color: C.green, marginTop: 2 }}>あなたのアシストとして {tm.winsForMe} 勝を支えた</div>}
            </div>
          ))}
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }
    // v32: キャリアグラフ（OVR・世界ランクの推移）
    if (ml.screen === "mylife_graph" && ml.player) {
      const hist = [...(ml.careerHistory || []), { year: ml.year, ovr: overall(ml.player), worldRank: ml.worldRank, wins: ml.careerWins || 0, podiums: ml.careerPodiums || 0 }];
      const W = 320, H = 160, padL = 24, padR = 24, padT = 14, padB = 22;
      const years = hist.map(h => h.year);
      const minY = Math.min(...years), maxY = Math.max(...years);
      const xAt = (yr) => maxY === minY ? W / 2 : padL + (yr - minY) / (maxY - minY) * (W - padL - padR);
      const ovrs = hist.map(h => h.ovr || 0);
      const ovrMin = Math.min(...ovrs) - 3, ovrMax = Math.max(...ovrs) + 3;
      const yOvr = (v) => H - padB - ((v - ovrMin) / Math.max(1, ovrMax - ovrMin)) * (H - padT - padB);
      const rankPts = hist.filter(h => h.worldRank != null);
      const ranks = rankPts.map(h => h.worldRank);
      const rMin = ranks.length ? Math.min(...ranks) : 1, rMax = ranks.length ? Math.max(...ranks) : 100;
      const yRank = (v) => padT + ((v - rMin) / Math.max(1, rMax - rMin)) * (H - padT - padB);
      const ovrPath = hist.map((h, i) => `${i === 0 ? "M" : "L"}${xAt(h.year).toFixed(1)},${yOvr(h.ovr || 0).toFixed(1)}`).join(" ");
      const rankPath = rankPts.map((h, i) => `${i === 0 ? "M" : "L"}${xAt(h.year).toFixed(1)},${yRank(h.worldRank).toFixed(1)}`).join(" ");
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.blue}` }}>
            <Eyebrow color={C.blue}>📈 キャリアグラフ</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>年ごとのOVRと世界ランクの推移。年度をまたぐごとに記録されます。</div>
          </div>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 6px", border: `1px solid ${C.line}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
              <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={C.line} />
              <path d={ovrPath} fill="none" stroke={C.yellow} strokeWidth="2" />
              {hist.map((h, i) => <circle key={i} cx={xAt(h.year)} cy={yOvr(h.ovr || 0)} r="2.5" fill={C.yellow} />)}
              {rankPath && <path d={rankPath} fill="none" stroke={C.green} strokeWidth="2" strokeDasharray="3,2" />}
              {rankPts.map((h, i) => <circle key={`r${i}`} cx={xAt(h.year)} cy={yRank(h.worldRank)} r="2.5" fill={C.green} />)}
              {hist.map((h, i) => <text key={`t${i}`} x={xAt(h.year)} y={H - 6} fontSize="8" fill={C.sub} textAnchor="middle">{h.year}</text>)}
            </svg>
            <div style={{ fontSize: 10.5, color: C.sub, display: "flex", gap: 14, justifyContent: "center", marginTop: 2 }}>
              <span style={{ color: C.yellow }}>― OVR</span><span style={{ color: C.green }}>┈ 世界ランク（上ほど上位）</span>
            </div>
          </div>
          {hist.length <= 1 && <div style={{ fontSize: 11, color: C.sub }}>年度を進めるとグラフが伸びていきます。</div>}
          {/* v35(UI): キャリアの軌跡（年表）。raceLogから語る価値のある一戦を時系列で */}
          {(() => {
            const tl = mlCareerTimeline(ml);
            return (
              <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
                <Eyebrow color={C.yellow}>🏅 キャリアの軌跡</Eyebrow>
                {tl.length === 0 ? (
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>まだ語るべき一戦はない。初勝利・初表彰台がここに刻まれていく。</div>
                ) : (
                  <div style={{ display: "grid", gap: 0, marginTop: 6 }}>
                    {tl.map((e, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "5px 0", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                        <span style={{ fontSize: 10, color: C.sub, fontFamily: FONT_M, width: 62, flexShrink: 0 }}>{e.year}年目{MONTHS[e.month] || ""}</span>
                        <span style={{ fontSize: 13, flexShrink: 0 }}>{e.icon}</span>
                        <span style={{ fontSize: 11.5, color: e.color, lineHeight: 1.4 }}>{e.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }
    // v31.5: 世界ランキング閲覧画面
    if (ml.screen === "mylife_ranking" && ml.player) {
      const board = mlWorldBoard(ml);
      const tier = worldRankTier(ml.worldRank);
      const Row = ({ e }) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6,
          background: e.isPlayer ? "rgba(255,210,63,0.14)" : e.isRival ? "rgba(224,80,80,0.1)" : e.isRival2 ? "rgba(79,143,232,0.1)" : "transparent",
          border: e.isPlayer ? `1px solid ${C.yellow}` : "1px solid transparent" }}>
          <span style={{ fontFamily: FONT_M, fontSize: 12, width: 34, textAlign: "right", color: e.rank <= 3 ? C.yellow : e.rank <= 10 ? C.green : C.sub, fontWeight: 700 }}>{e.rank}位</span>
          <span style={{ flex: 1, fontSize: 12, color: e.isPlayer ? C.yellow : C.text, fontWeight: e.isPlayer ? 700 : 400 }}>
            {e.name}{e.isPlayer ? " ●（あなた）" : e.isRival ? " 🔥ライバル" : e.isRival2 ? " 🔥好敵手" : ""}
            {e.star && <span style={{ fontSize: 10, color: C.sub }}>　{TYPES[e.star.type]?.label || e.star.type}・{e.star.age}歳・通算{e.star.wins}勝</span>}
            {e.star && e.star.bloodOf && <span style={{ fontSize: 10, color: "#e8a13c", fontWeight: 700 }}>　🩸{e.star.bloodOf}</span>}
          </span>
          <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.sub }}>{e.pts}pt</span>
        </div>
      );
      const worldNews = mlWorldNews(ml.worldSeed, ml.year, loadMlLegends());
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "linear-gradient(180deg,#2a2740,#22202f)", borderRadius: 12, padding: 16, borderTop: `4px solid ${C.purple}` }}>
            <Eyebrow color={C.purple}>🌍 世界ランキング（{ml.year}年目）</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 20, color: tier.color, fontWeight: 700, margin: "6px 0 2px" }}>
              あなたは 世界{ml.worldRank == null ? "ランク外" : `${ml.worldRank}位`}
            </div>
            <div style={{ fontSize: 12, color: C.sub }}>{tier.label}／{Math.round(ml.worldPoints || 0)}pt{ml.worldRankBest != null ? `／自己最高 ${ml.worldRankBest}位` : ""}</div>
            <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4 }}>成績（着順×グレード）でポイントを獲得。年ごとに一部減衰し、世界1位の基準点は年々上がります。</div>
          </div>
          {worldNews.length > 0 && (
            <div style={{ background: "linear-gradient(180deg,#20283a,#1b2230)", borderRadius: 10, padding: "8px 11px", border: `1px solid ${C.blue}` }}>
              <div style={{ fontSize: 11, color: C.blue, fontWeight: 700, marginBottom: 4 }}>📰 今年の世界の動き</div>
              <div style={{ display: "grid", gap: 3 }}>{worldNews.map((n, i) => <div key={i} style={{ fontSize: 11.5, color: C.text }}>{n}</div>)}</div>
            </div>
          )}
          <div style={{ background: C.panel, borderRadius: 10, padding: "8px 10px", border: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginBottom: 4 }}>🏆 世界トップ10</div>
            <div style={{ display: "grid", gap: 2 }}>{board.top.map((e, i) => <Row key={i} e={e} />)}</div>
          </div>
          {board.around.length > 0 && (
            <div style={{ background: C.panel, borderRadius: 10, padding: "8px 10px", border: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginBottom: 4 }}>📍 あなたの周辺</div>
              <div style={{ display: "grid", gap: 2 }}>{board.around.map((e, i) => <Row key={i} e={e} />)}</div>
            </div>
          )}
          {(board.rivalRank != null || board.rival2Rank != null) && (
            <div style={{ fontSize: 11, color: C.sub }}>
              {board.rivalRank != null && ml.rival && <div>🔥 ライバル {ml.rival.name}：世界{board.rivalRank}位</div>}
              {board.rival2Rank != null && ml.rival2 && <div>🔥 好敵手 {ml.rival2.name}：世界{board.rival2Rank}位</div>}
            </div>
          )}
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_legends") {
      const allLegends = loadMlLegends();
      const legends = [...allLegends].reverse();
      const bloodMap = buildBloodMap(allLegends);
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.purple}` }}>
            <Eyebrow color={C.purple}>🏛 マイライフ殿堂</Eyebrow>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>これまでのプレイで引退した歴代選手の記録です（{legends.length}名）。2人を親に選んで「配合」で教え子を作れます。</div>
          </div>
          {/* v31.1: 配合相性表（ニック）。どの脚質同士が好相性か一覧できる */}
          <div style={{ background: "linear-gradient(180deg,#2e2436,#241d2c)", borderRadius: 12, padding: "12px 14px", border: `1px solid #e56cc8` }}>
            <button onClick={() => setMl(s => ({ ...s, showNicks: !s.showNicks }))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", textAlign: "left" }}>
              <Eyebrow color={"#e56cc8"}>🧬 配合相性表（ニック）　{ml.showNicks ? "▲" : "▼"}</Eyebrow>
            </button>
            {ml.showNicks && (
              <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                {breedNickTableRows().map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                    <span style={{ fontFamily: FONT_M, fontWeight: 700, width: 18, color: r.rank === "◎" ? C.yellow : r.rank === "○" ? C.green : C.sub }}>{r.rank}</span>
                    <span style={{ width: 96, color: C.text }}>{TYPES[r.pair[0]]?.label || r.pair[0]}×{TYPES[r.pair[1]]?.label || r.pair[1]}</span>
                    <span style={{ color: C.sub, flex: 1 }}>{r.label}{r.ability && ABILITIES[r.ability] ? `（${ABILITIES[r.ability].label}）` : ""}</span>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>※ 表以外の組み合わせは △（標準）。同じ祖先を持つ親同士を配合すると「血の濃さ（インブリード）」で更に強くなります。</div>
              </div>
            )}
          </div>
          {legends.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>まだ引退した選手はいません。</div>}
          <div style={{ display: "grid", gap: 8 }}>
            {legends.map((leg, i) => {
              const legId = legendBloodId(leg);
              const expanded = ml.expandedLegend === legId;
              const parents = leg.parents || [];
              return (
              <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.purple}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 14.5 }}>
                    {leg.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: TYPES[leg.type]?.color }}>{TYPES[leg.type]?.label}</span>
                    {(leg.generation || 0) > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: "#e56cc8" }}>🧬{leg.generation}代目{(leg.plusValue || 0) > 0 ? `+${leg.plusValue}` : ""}</span>}
                  </span>
                  <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.sub }}>{leg.endYear}年目引退・{leg.age}歳</span>
                </div>
                {leg.nickname && <div style={{ fontSize: 11.5, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{leg.nickname}」</div>}
                {leg.careerTitle && <div style={{ fontSize: 11.5, color: "#e8a13c", fontWeight: 700, marginTop: 2 }} title={leg.careerTitleDesc || ""}>― {leg.careerTitle} ―</div>}
                <div style={{ fontSize: 11, color: C.text, marginTop: 4, lineHeight: 1.6 }}>{leg.summary}</div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>
                  {leg.team}／通算{leg.races}戦{leg.wins}勝・表彰台{leg.podiums}回／実績{leg.achievedCount}/{leg.achievedTotal}
                  {leg.rivalName && `／ライバル${leg.rivalName}に${leg.rivalRecord?.wins || 0}勝${leg.rivalRecord?.losses || 0}敗`}
                  {leg.rival2Name && `／好敵手${leg.rival2Name}に${leg.rivalRecord2?.wins || 0}勝${leg.rivalRecord2?.losses || 0}敗`}
                </div>
                {leg.epilogue && <div style={{ fontSize: 10.5, color: C.yellow, marginTop: 5, lineHeight: 1.6, fontStyle: "italic" }}>{leg.epilogue}</div>}
                {leg.autobiography && <div style={{ fontSize: 11, color: C.purple, marginTop: 5, lineHeight: 1.6, fontStyle: "italic" }}>📖「{leg.autobiography}」</div>}
                {leg.master && <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>🎓 {leg.master}の教え子{leg.partner ? `・🧬${leg.partner}との配合` : ""}</div>}
                {leg.lineageName && <div style={{ fontSize: 10.5, color: "#c98bf0", marginTop: 2 }}>🩸 {leg.lineageName}
                  {(() => { const rec = loadBloodlines()[leg.lineageName]; const t = rec ? mlBloodlineTier(rec) : null; if (!t || t.tier <= 0) return null; return <span style={{ color: "#e8a13c", fontWeight: 700 }}>　🏛{t.label}（{rec.count}名・{rec.wins}勝）</span>; })()}
                </div>}
                {leg.specialMatingTitle && <div style={{ fontSize: 10.5, color: "#ffd24a", fontWeight: 700, marginTop: 1 }}>🌟 {leg.specialMatingTitle}</div>}
                {/* v31.2: 殿堂記録の削除。誤って残った記録や整理のために1件ずつ消せる */}
                <div style={{ marginTop: 6, textAlign: "right" }}>
                  <button onClick={() => askConfirm(`殿堂記録から「${leg.name}」を削除しますか？この操作は取り消せません（血統の親として選べなくなります）。`, () => {
                    const list = loadMlLegends(); const oi = allLegends.length - 1 - i; if (oi >= 0 && oi < list.length) { list.splice(oi, 1); saveMlLegends(list); setMl(s => ({ ...s })); }
                  })} style={{ background: "none", border: `1px solid ${C.red}`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 10.5, padding: "2px 8px" }}>🗑 この記録を削除</button>
                </div>
                {/* v31.1: 系譜ツリー（血統）。親・祖父母を辿って表示する */}
                {parents.length > 0 && (
                  <>
                    <button onClick={() => setMl(s => ({ ...s, expandedLegend: expanded ? null : legId }))}
                      style={{ marginTop: 6, background: "none", border: `1px solid ${C.line}`, borderRadius: 6, color: "#e56cc8", cursor: "pointer", fontSize: 10.5, padding: "3px 8px" }}>
                      {expanded ? "▲ 系譜を閉じる" : "🌳 系譜（血統）を見る"}
                    </button>
                    {expanded && (
                      <div style={{ marginTop: 6, background: C.panel2, borderRadius: 8, padding: "8px 10px", fontSize: 11.5, lineHeight: 1.8 }}>
                        <div style={{ color: C.text, fontWeight: 700 }}>{leg.name}</div>
                        <div style={{ color: C.sub, marginLeft: 8 }}>
                          ├ 父母：{parents.map(p => bloodIdToName(p, bloodMap)).join(" × ")}
                        </div>
                        {parents.map((pid, pj) => {
                          const pl = bloodMap[pid];
                          const gp = pl && pl.parents || [];
                          if (gp.length === 0) return null;
                          return (
                            <div key={pj} style={{ color: C.sub, marginLeft: 20, fontSize: 11 }}>
                              └ {bloodIdToName(pid, bloodMap)}の父母：{gp.map(g => bloodIdToName(g, bloodMap)).join(" × ")}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
              );
            })}
          </div>
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_create" }))}>← 戻る</Btn>
        </div>
      );
    }

    return mlWrap(<div style={{ color: C.sub }}>読み込み中…</div>);
}
