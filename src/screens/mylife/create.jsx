// mylife.jsx より分割（Step8）：キャラクター作成・スカウト（mylife_create/mylife_scout）
// 第13弾Phase3-D-2: 新トークン(T/FONT_DOT)へ全面移行。AbilityGrid/TraitLine（panels.jsx）は
// season側と共有のため中身は据え置き（Phase3-D-3担当）。
// 第32弾Phase B: 強調ボックスの左罫線(borderLeft)を撤去（縦線禁止・CLAUDE.md §8）。
// surfaceUpの面差だけで区切る。
import React from "react";
import { loadMlLegends, mlBreedBonus, protegeInherit } from "../../breeding/breeding.js";
import { bestBloodRecipeProgress, bloodRecipeProgress, deriveBloodMarks, matchBloodRecipe } from "../../breeding/recipes.js";
import { AbilityGrid, TraitLine } from "../../components/panels.jsx";
import { PrimaryBtn, QuietBtn, Screen, Section, TypeChip } from "../../components/kit.jsx";
import { fmtRelTime, overall } from "../../core/core.js";
import { ABILITIES, AB_LABEL, TYPES } from "../../data/abilities.js";
import { SEG_LABEL, TEMPLATES } from "../../data/course.js";
import { DIFFICULTIES, DISCIPLINE_KEYS, DISCIPLINES, FAVORS_TO_DISCIPLINE } from "../../data/progression.js";
import { FONT_DOT, T } from "../../data/theme.js";
import { ACQUIRE_REQS, MLCP_DIFF_MUL, ML_BACKGROUNDS, SUB_STAT_LABEL, clearMyLifeSave, hasMyLifeSave, mlGrowthPowRevealed, mlTalentRank } from "../../logic/support.js";
import { loadMyLifeGame, myLifeSaveInfo } from "../../state/state.js";

// 第34弾: 選択肢は名前だけを横に並べ、説明は選んでいる1件だけを下の面に出す。
// 「3件分の説明を読み比べる人はいない」という実態に合わせた形（devlog/wave34.md）。
const PickHead = ({ children }) => (
  <div style={{ fontSize: T.size.caption, color: T.color.accent, marginBottom: T.space.sm }}>{children}</div>
);
const PickRow = ({ items, value, onPick }) => (
  <div style={{ display: "flex", gap: T.space.xs, flexWrap: "wrap", marginBottom: T.space.sm }}>
    {items.map(it => (
      <button key={it.key} onClick={() => onPick(it.key)} style={{
        border: "none", cursor: "pointer", fontFamily: FONT_DOT, fontSize: T.size.body,
        padding: `${T.space.sm}px ${T.space.md}px`,
        background: value === it.key ? T.color.action : T.color.surfaceUp,
        color: value === it.key ? T.color.bg : T.color.sub,
      }}>{it.label}{it.sub && <span style={{ fontSize: T.size.caption, marginLeft: 4 }}>{it.sub}</span>}</button>
    ))}
  </div>
);
const PickNote = ({ children }) => (
  <div style={{ background: T.color.surface, padding: `10px ${T.space.md}px`, marginBottom: T.space.md }}>{children}</div>
);

export function renderMyLifeCreateScreens(ctx) {
  const { askConfirm, ml, mlConfirmBadgeGoals, mlConfirmCandidate, mlCreateChar, mlRerollCandidate, mlSetRaceFocus, mlToggleBadgeGoal, mlWrap, setMl, setSuperMode } = ctx;
    if (ml.screen === "mylife_create") {
      const typeOpts = Object.entries(TYPES);
      const bgOpts = Object.entries(ML_BACKGROUNDS);
      const curType = TYPES[ml.typeChoice];
      const curBg = ML_BACKGROUNDS[ml.bgChoice];
      const curDiff = DIFFICULTIES.find(d => d.id === (ml.mlDiffChoice || "easy")) || DIFFICULTIES[0];
      return mlWrap(
        <Screen>
          <div style={{ fontSize: T.size.title, marginBottom: T.space.md }}>選手をつくる</div>

          {hasMyLifeSave() && (() => {
            const info = myLifeSaveInfo();
            return (
              <PrimaryBtn onClick={() => { const loaded = loadMyLifeGame(); if (loaded) setMl(loaded); }}>
                続きから
                {info && <span style={{ display: "block", fontSize: T.size.caption, color: T.color.bg, opacity: 0.85, marginTop: 2 }}>{info.name}{info.age ? `（${info.age}歳）` : ""}・{info.classLabel}・{info.year}年目{info.savedAt ? ` — ${fmtRelTime(info.savedAt)}に保存` : ""}</span>}
              </PrimaryBtn>
            );
          })()}

          <PickHead>脚質</PickHead>
          <PickRow items={typeOpts.map(([k, t]) => ({ key: k, label: t.label }))} value={ml.typeChoice} onPick={k => setMl(s => ({ ...s, typeChoice: k }))} />
          {curType && (
            <PickNote>
              <div style={{ fontSize: T.size.body, color: T.color.text }}>
                {Object.entries(curType.affinity).map(([seg, v]) => `${SEG_LABEL[seg]} +${v}`).join("／")}
              </div>
            </PickNote>
          )}

          <PickHead>経歴</PickHead>
          <PickRow items={bgOpts.map(([k, b]) => ({ key: k, label: b.label, sub: `${b.age}歳` }))} value={ml.bgChoice} onPick={k => setMl(s => ({ ...s, bgChoice: k }))} />
          {curBg && (
            <PickNote>
              <div style={{ fontSize: T.size.body, color: T.color.text }}>{curBg.desc}</div>
              {curBg.merit && (
                <>
                  <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: T.space.xs }}>{curBg.meritLabel}</div>
                  <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>{curBg.merit}</div>
                </>
              )}
            </PickNote>
          )}

          <PickHead>難易度</PickHead>
          <PickRow items={DIFFICULTIES.map(d => ({ key: d.id, label: d.label }))} value={ml.mlDiffChoice || "easy"} onPick={k => setMl(s => ({ ...s, mlDiffChoice: k }))} />
          {curDiff && (() => {
            const cpMul = MLCP_DIFF_MUL[curDiff.id] ?? 1;
            return (
              <PickNote>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: T.size.body, color: T.color.text }}>{curDiff.desc}</span>
                  <span style={{ fontSize: T.size.head, color: cpMul > 1 ? T.color.good : T.color.sub, flex: "none", marginLeft: T.space.sm }}>×{cpMul}</span>
                </div>
                <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>クリアポイント倍率</div>
              </PickNote>
            );
          })()}

          {(() => {
            const legends = loadMlLegends();
            if (legends.length === 0) return null;
            const idx = ml.masterIdx ?? -1;
            const master = idx >= 0 ? legends[idx] : null;
            const inh = master ? protegeInherit(master) : null;
            return (
              <>
                <PickHead>師匠</PickHead>
                <PickRow
                  items={[{ key: -1, label: "師事しない" }, ...legends.map((leg, i) => ({ key: i, label: leg.name, sub: `${leg.wins || 0}勝` }))]}
                  value={idx} onPick={k => setMl(s => ({ ...s, masterIdx: k }))} />

                {inh && (
                  <PickNote>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: T.space.sm }}>
                      <span style={{ fontSize: T.size.body, color: T.color.accent }}>{inh.teaching.label}</span>
                      <TypeChip type={master.type} />
                    </div>
                    <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>{inh.teaching.desc}</div>
                    <div style={{ fontSize: T.size.caption, color: T.color.text, marginTop: T.space.xs }}>
                      {Object.entries(inh.abBonus).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join("・")}
                      {inh.subBonus && Object.entries(inh.subBonus).map(([k, v]) => `・${SUB_STAT_LABEL[k]}${v >= 0 ? "+" : ""}${v}`).join("")}
                      {inh.growthPowBump && "・成長力+1段階"}
                      {`・継承特性「${ABILITIES[inh.lineageTrait].label}」`}
                      {inh.inheritAbility && `・特殊能力「${ABILITIES[inh.inheritAbility].label}」`}
                    </div>
                  </PickNote>
                )}

                {master && legends.length >= 2 && (() => {
                  const pIdx = ml.partnerIdx ?? -1;
                  const partner = (pIdx >= 0 && pIdx !== idx) ? legends[pIdx] : null;
                  const breed = partner ? mlBreedBonus(master, partner) : null;
                  return (
                    <>
                      <PickHead>配合相手</PickHead>
                      <PickRow
                        items={[{ key: -1, label: "配合しない" }, ...legends.map((leg, i) => i === idx ? null : { key: i, label: leg.name, sub: `+${leg.plusValue || 0}` }).filter(Boolean)]}
                        value={pIdx} onPick={k => setMl(s => ({ ...s, partnerIdx: k }))} />

                      {breed && (() => {
                        const lines = [];
                        lines.push([breed.growthSteps > 0 ? `成長力+${breed.growthSteps}段` : null, breed.talentCap > 0 ? `才能キャップ+${breed.talentCap}` : null, `累代+${breed.plusPer}`, breed.inbreed.count > 0 ? `インブリード×${breed.inbreed.count}` : null].filter(Boolean).join("・"));
                        const abIds = [...breed.extraAbilities, ...(breed.goldInherit || []), ...(breed.exclusive || [])];
                        const abText = [...new Set(abIds)].map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・");
                        return (
                          <PickNote>
                            {breed.special && (
                              <div style={{ marginBottom: T.space.xs }}>
                                <div style={{ fontSize: T.size.body, color: T.color.accent }}>『{breed.special.title}』</div>
                                <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>{breed.special.note}</div>
                              </div>
                            )}
                            <div style={{ fontSize: T.size.body, color: T.color.accent }}>配合評価 {breed.matingGrade}　相性 {breed.nick.rank} {breed.nick.label}</div>
                            {lines[0] && <div style={{ fontSize: T.size.caption, color: T.color.text, marginTop: T.space.xs }}>{lines[0]}</div>}
                            {abText && <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: 2 }}>{abText}</div>}
                          </PickNote>
                        );
                      })()}
                      {breed && breed.danger > 0 && (
                        <div style={{ fontSize: T.size.caption, color: breed.danger >= 38 ? T.color.bad : T.color.accent, marginBottom: T.space.md }}>
                          {breed.dangerLabel}　約{breed.danger}%で「ガラスの体」
                        </div>
                      )}

                      {breed && (() => {
                        // 第15弾D: 血脈レシピの段階的ヒント（候補C・合意済み）。
                        // mlCreateChar()が実際に使う式と完全一致させ、「デビューすれば確実にこうなる」
                        // という確定情報として見せる。
                        const pool = [...deriveBloodMarks(master), ...deriveBloodMarks(partner)].slice(0, 24);
                        const recipe = matchBloodRecipe(pool);
                        const progress = recipe ? [] : bloodRecipeProgress(pool);
                        const best = bestBloodRecipeProgress(progress);
                        const otherCount = best ? progress.length - 1 : 0;
                        return (
                          <>
                            <PickHead>血脈レシピ</PickHead>
                            <PickNote>
                              {recipe ? (
                                <div style={{ background: T.color.surfaceUp, padding: T.space.sm }}>
                                  <div style={{ fontSize: T.size.body, color: T.color.accent }}>血脈レシピ『{recipe.title}』成立！</div>
                                  <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>{recipe.note}</div>
                                  <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: T.space.xs }}>
                                    伝説の特殊能力「{ABILITIES[recipe.abilityId]?.label}」を宿して生まれる
                                  </div>
                                </div>
                              ) : best ? (
                                <>
                                  <div style={{ background: T.color.surfaceUp, padding: T.space.sm }}>
                                    <div style={{ fontSize: T.size.body, color: T.color.text }}>{best.recipe.title}</div>
                                    <div style={{ fontSize: T.size.body, color: T.color.accent, letterSpacing: 2, marginTop: 2 }}>
                                      {"●".repeat(best.matchedCount)}{"○".repeat(best.total - best.matchedCount)}
                                    </div>
                                    <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>
                                      {best.recipe.steps.slice(0, best.matchedCount).join(" → ")}
                                      {best.matchedCount < best.total && `　／　次の代に「${best.recipe.steps[best.matchedCount]}」が揃うと成立`}
                                    </div>
                                  </div>
                                  {otherCount > 0 && (
                                    <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>他に{otherCount}件の隠しレシピが進行中</div>
                                  )}
                                </>
                              ) : (
                                <div style={{ color: T.color.sub, fontSize: T.size.caption }}>配合を重ねると、隠されたレシピの手がかりが見えてくる</div>
                              )}
                            </PickNote>
                          </>
                        );
                      })()}
                    </>
                  );
                })()}
              </>
            );
          })()}

          <PrimaryBtn onClick={() => {
            const legends = loadMlLegends();
            const mIdx = ml.masterIdx ?? -1;
            const master = mIdx >= 0 ? legends[mIdx] : null;
            const pIdx = ml.partnerIdx ?? -1;
            const partner = (master && pIdx >= 0 && pIdx !== mIdx) ? legends[pIdx] : null;
            const doCreate = () => { clearMyLifeSave(); mlCreateChar(ml.typeChoice, ml.bgChoice, master, partner); };
            if (hasMyLifeSave()) askConfirm("保存データを消して新しい選手でキャリアを始めます。よろしいですか？", doCreate, "新しく始める");
            else doCreate();
          }}>この内容でデビュー →</PrimaryBtn>
          <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_legends", careerBack: s.screen }))}>歴代選手の殿堂を見る</QuietBtn>
          <QuietBtn onClick={() => setSuperMode(null)}>モード選択に戻る</QuietBtn>
        </Screen>
      );
    }

    // v36(#5リセマラ): 素質診断。デビュー前に成長力・性格・特能・素質ランクを確認し、
    // 気に入るまで「引き直す」できる（確定するまでセーブされない）。
    if (ml.screen === "mylife_scout" && ml.player) {
      const r = ml.player;
      // v43(マイライフ難易度調整Phase 1・成長力マスク化): 成長力は3年目まで非公開。
      // 素質診断はこの時点(year=1)では常に非公開側で採点する（成長力込みのSSを狙うリセマラ潰し）。
      const powRevealed = mlGrowthPowRevealed(ml);
      const tr = mlTalentRank(r, powRevealed);
      const persLabel = tr.parts?.persLabel || "普通";
      return mlWrap(
        <Screen>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>素質診断 — スカウトの評価</div>
          <div style={{ display: "flex", gap: T.space.md, alignItems: "center", background: T.color.surface, padding: T.space.md, marginBottom: T.space.md }}>
            <div style={{ textAlign: "center", flex: "none" }}>
              <div style={{ fontSize: T.size.caption, color: T.color.sub }}>素質</div>
              <div style={{ fontSize: T.size.display, color: T.color.accent, lineHeight: 1 }}>{tr.rank}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: T.size.title, lineHeight: 1.1 }}>{r.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: T.space.xs, marginTop: T.space.xs }}>
                <TypeChip type={r.type} />
                <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{r.age}歳・{ML_BACKGROUNDS[r.background]?.label} ／ 総合力 {overall(r)}</span>
              </div>
              <div style={{ fontSize: T.size.caption, marginTop: T.space.xs }}>
                {powRevealed
                  ? <span style={{ color: T.color.text }}>成長力 {r.growthPow}</span>
                  : <span style={{ color: T.color.sub }}>成長力 ???（3年目に判明）</span>}
                <span style={{ color: T.color.sub }}> ・ 性格 </span><span style={{ color: r.personality === "genius" ? T.color.accent : T.color.text }}>{persLabel}</span>
              </div>
            </div>
          </div>

          {r.debutBoon && (
            <div style={{ background: T.color.surfaceUp, padding: T.space.sm, marginBottom: T.space.md }}>
              <div style={{ fontSize: T.size.body, color: T.color.accent }}>{r.debutBoon.label}</div>
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>{r.debutBoon.note}</div>
            </div>
          )}

          <Section title="特殊能力" padded>
            <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
          </Section>
          <Section title="能力値" padded>
            <AbilityGrid r={r} />
          </Section>

          <PrimaryBtn onClick={mlConfirmCandidate}>この素質でデビュー →</PrimaryBtn>
          <QuietBtn onClick={mlRerollCandidate}>素質を引き直す（リセマラ）</QuietBtn>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, textAlign: "center", lineHeight: 1.6, marginTop: T.space.sm }}>
            性格・特殊能力・素質ランクは引き直すたびに変わります。<br />稀に「天啓」「天賦の才」「才能の片鱗」を持って生まれます。確定するまで保存されません。
          </div>
        </Screen>
      );
    }

    // 第41弾: 目標バッジ宣言。強制力・ボーナスは一切ない純粋な「しおり」（あとから選手画面で
    // 変更できる）。母集団はACQUIRE_REQSを持つ15種のうち、脚質のgateを通り体質(iron)を除いたもの
    // （devlog/wave41.md B-1）。D案：全候補の条件を常時表示する（2Kの「全バッジと要件が
    // 最初から見える」に最も近い形）。
    // 第43弾: 出走計画（案A：目指すバッジのあとに置く。devlog/wave43.md）。選択肢は
    // DISCIPLINE_KEYSのうち実際にTEMPLATESが対応するもの（flatは対応するテンプレが無いため
    // 選択肢から除外——既存語彙をそのまま使い新しい言葉は作らない）。
    if (ml.screen === "mylife_badge_goals" && ml.player) {
      const r = ml.player;
      const goalPool = Object.keys(ACQUIRE_REQS).filter(id => id !== "iron" && ABILITIES[id] && (!ACQUIRE_REQS[id].gate || ACQUIRE_REQS[id].gate(r)));
      const goals = ml.badgeGoals || [];
      const condText = (id, q) => {
        if (id === "big") return "世界選手権かオリンピックで表彰台";
        if (id === "pave_sp") return "石畳の古典《春の地獄》で表彰台";
        if (id === "ardennes_sp") return "丘陵の古典《アルデンヌ》で表彰台";
        if (id === "autumn_sp") return "山岳の古典《秋の女王》で表彰台";
        return `${q.need}${q.unit}で解放`;
      };
      const focusOptions = DISCIPLINE_KEYS.filter(k => TEMPLATES.some(t => (FAVORS_TO_DISCIPLINE[t.favors] || "flat") === k));
      const focus = ml.raceFocus || null;
      return mlWrap(
        <Screen>
          <div style={{ fontSize: T.size.title, marginBottom: T.space.md }}>目指す選手像</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, marginBottom: T.space.sm }}>
            <span style={{ color: T.color.accent }}>目指すバッジ</span>
            <span style={{ color: goals.length >= 3 ? T.color.accent : T.color.sub }}>{goals.length} / 3 選択</span>
          </div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.md }}>
            {TYPES[r.type]?.label}が目指せるバッジから3つ選ぶ。あとから変えられる
          </div>
          <div style={{ background: T.color.surface, marginBottom: T.space.md }}>
            {goalPool.map((id, i) => {
              const q = ACQUIRE_REQS[id];
              const a = ABILITIES[id];
              const selected = goals.includes(id);
              return (
                <button key={id} onClick={() => mlToggleBadgeGoal(id)} style={{
                  display: "block", width: "100%", textAlign: "left", border: "none", cursor: "pointer", fontFamily: FONT_DOT,
                  padding: `${T.space.sm}px ${T.space.md}px`, background: selected ? T.color.surfaceUp : "transparent",
                  borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: T.size.head, color: selected ? T.color.text : T.color.sub }}>{a.label}</span>
                    <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none", marginLeft: T.space.sm }}>{condText(id, q)}</span>
                  </div>
                  <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>{a.desc}</div>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: T.size.caption, color: T.color.accent, marginBottom: T.space.sm }}>出走計画</div>
          <div style={{ background: T.color.surface, marginBottom: T.space.md }}>
            {focusOptions.map((k, i) => {
              const selected = focus === k;
              return (
                <button key={k} onClick={() => mlSetRaceFocus(k)} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline", width: "100%",
                  background: selected ? T.color.surfaceUp : "transparent", border: 0,
                  borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}`,
                  color: selected ? T.color.action : T.color.sub, fontFamily: FONT_DOT, fontSize: T.size.body,
                  padding: `${T.space.sm}px ${T.space.md}px`, cursor: "pointer", textAlign: "left",
                }}>
                  <span>{DISCIPLINES[k].label}中心</span>
                  {selected && <span style={{ fontSize: T.size.caption, color: T.color.sub }}>選択中</span>}
                </button>
              );
            })}
            <button onClick={() => mlSetRaceFocus(null)} style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline", width: "100%",
              background: focus === null ? T.color.surfaceUp : "transparent", border: 0,
              borderTop: `1px solid ${T.color.rule}`,
              color: focus === null ? T.color.action : T.color.sub, fontFamily: FONT_DOT, fontSize: T.size.body,
              padding: `${T.space.sm}px ${T.space.md}px`, cursor: "pointer", textAlign: "left",
            }}>
              <span>特に決めない</span>
              {focus === null && <span style={{ fontSize: T.size.caption, color: T.color.sub }}>選択中</span>}
            </button>
            {focus && (
              <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px ${T.space.md}px`, borderTop: `1px solid ${T.color.rule}`, lineHeight: 1.6 }}>
                毎月の候補に{DISCIPLINES[focus].label}のレースが必ず1本入る
              </div>
            )}
          </div>
          <PrimaryBtn onClick={mlConfirmBadgeGoals}>この内容でキャリアを始める →</PrimaryBtn>
        </Screen>
      );
    }

}
