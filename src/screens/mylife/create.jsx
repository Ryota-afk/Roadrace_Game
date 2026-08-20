// mylife.jsx より分割（Step8）：キャラクター作成・スカウト（mylife_create/mylife_scout）
// 第13弾Phase3-D-2: 新トークン(T/FONT_DOT)へ全面移行。AbilityGrid/TraitLine（panels.jsx）は
// season側と共有のため中身は据え置き（Phase3-D-3担当）。
import React from "react";
import { loadBloodlines, loadMlLegends, mlBloodlineFactor, mlBloodlineTier, mlBreedBonus, protegeInherit } from "../../breeding/breeding.js";
import { AbilityGrid, TraitLine } from "../../components/panels.jsx";
import { Item, PrimaryBtn, QuietBtn, Screen, Section, SelectRow } from "../../components/mlUi.jsx";
import { fmtRelTime, overall } from "../../core/core.js";
import { ABILITIES, AB_LABEL, TYPES } from "../../data/abilities.js";
import { DIFFICULTIES } from "../../data/progression.js";
import { T } from "../../data/theme.js";
import { MLCP_DIFF_MUL, ML_BACKGROUNDS, SUB_STAT_LABEL, clearMyLifeSave, hasMyLifeSave, mlGrowthPowRevealed, mlTalentRank } from "../../logic/support.js";
import { loadMyLifeGame, myLifeSaveInfo } from "../../state/state.js";

export function renderMyLifeCreateScreens(ctx) {
  const { askConfirm, ml, mlConfirmCandidate, mlCreateChar, mlRerollCandidate, mlWrap, setMl, setSuperMode } = ctx;
    if (ml.screen === "mylife_create") {
      const typeOpts = Object.entries(TYPES);
      const bgOpts = Object.entries(ML_BACKGROUNDS);
      return mlWrap(
        <Screen>
          <div style={{ fontSize: T.size.title, marginBottom: T.space.xs }}>キャラクター作成</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.md, lineHeight: 1.7 }}>
            一人の選手としてB1からデビューし、引退までのキャリアを歩みます。まずは脚質と経歴を選んでください。
          </div>

          {hasMyLifeSave() && (() => {
            const info = myLifeSaveInfo();
            return (
              <PrimaryBtn onClick={() => { const loaded = loadMyLifeGame(); if (loaded) setMl(loaded); }}>
                続きから
                {info && <span style={{ display: "block", fontSize: T.size.caption, color: T.color.bg, opacity: 0.85, marginTop: 2 }}>{info.name}{info.age ? `（${info.age}歳）` : ""}・{info.classLabel}・{info.year}年目{info.savedAt ? ` — ${fmtRelTime(info.savedAt)}に保存` : ""}</span>}
              </PrimaryBtn>
            );
          })()}

          <Section title="脚質">
            {typeOpts.map(([k, t], i) => (
              <SelectRow key={k} first={i === 0} label={t.label} selected={ml.typeChoice === k} onClick={() => setMl(s => ({ ...s, typeChoice: k }))} />
            ))}
          </Section>

          <Section title="経歴" right="年齢・能力・伸びしろに影響">
            {bgOpts.map(([k, b], i) => (
              <SelectRow key={k} first={i === 0} selected={ml.bgChoice === k} onClick={() => setMl(s => ({ ...s, bgChoice: k }))}
                label={<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span>{b.label}</span><span style={{ fontSize: T.size.caption, color: T.color.sub }}>{b.age}歳スタート</span></div>}
                detail={<>{b.desc}{b.merit && <div style={{ color: T.color.accent, marginTop: 2 }}>{b.meritLabel} {b.merit}</div>}</>} />
            ))}
          </Section>

          <Section title="難易度" right="相手の強さ・成長上限・クリアポイント倍率">
            {DIFFICULTIES.map((d, i) => {
              const cpMul = MLCP_DIFF_MUL[d.id] ?? 1;
              const sel = (ml.mlDiffChoice || "easy") === d.id;
              return (
                <SelectRow key={d.id} first={i === 0} selected={sel} onClick={() => setMl(s => ({ ...s, mlDiffChoice: d.id }))}
                  label={<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span>{d.label}</span><span style={{ fontSize: T.size.caption, color: cpMul > 1 ? T.color.good : T.color.sub }}>クリアポイント ×{cpMul}</span></div>}
                  detail={d.desc} />
              );
            })}
          </Section>

          {(() => {
            const legends = loadMlLegends();
            if (legends.length === 0) return null;
            const idx = ml.masterIdx ?? -1;
            const master = idx >= 0 ? legends[idx] : null;
            const inh = master ? protegeInherit(master) : null;
            return (
              <>
                <Section title="師匠" right="歴代の名選手に師事・任意">
                  <SelectRow first label="師事しない（通常のデビュー）" selected={idx === -1} onClick={() => setMl(s => ({ ...s, masterIdx: -1 }))} />
                  {legends.map((leg, i) => (
                    <SelectRow key={i} selected={idx === i} onClick={() => setMl(s => ({ ...s, masterIdx: i }))}
                      label={<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span>{leg.name}<span style={{ fontSize: T.size.caption, color: T.color.sub, marginLeft: T.space.xs }}>{TYPES[leg.type]?.label || leg.type}</span></span>
                        <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{leg.wins || 0}勝/{leg.podiums || 0}表彰台</span>
                      </div>}
                      detail={leg.nickname ? `「${leg.nickname}」` : null} />
                  ))}
                </Section>

                {inh && (
                  <div style={{ background: T.color.surface, padding: T.space.md, marginBottom: T.space.md, fontSize: T.size.caption, color: T.color.text, lineHeight: 1.8 }}>
                    <div><span style={{ color: T.color.accent }}>師の教え：</span>{inh.teaching.label}<span style={{ color: T.color.sub }}>（{inh.teaching.desc}）</span></div>
                    <div>
                      <span style={{ color: T.color.accent }}>継承：</span>
                      {Object.entries(inh.abBonus).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join(" / ")}
                      {inh.subBonus && Object.entries(inh.subBonus).map(([k, v]) => `・${SUB_STAT_LABEL[k]}${v >= 0 ? "+" : ""}${v}`).join("")}
                      {inh.growthPowBump && "・成長力+1段階"}
                      <span style={{ color: T.color.accent }}>・継承特性「{ABILITIES[inh.lineageTrait].label}」</span>
                      {inh.inheritAbility && `・特殊能力「${ABILITIES[inh.inheritAbility].label}」`}
                    </div>
                  </div>
                )}

                {master && legends.length >= 2 && (() => {
                  const pIdx = ml.partnerIdx ?? -1;
                  const partner = (pIdx >= 0 && pIdx !== idx) ? legends[pIdx] : null;
                  const breed = partner ? mlBreedBonus(master, partner) : null;
                  return (
                    <>
                      <Section title="配合相手" right="もう一人の親・任意">
                        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>2人目の親を選ぶと「配合」になり、両方の血を引く逸材が生まれます。</div>
                        <SelectRow first label="配合しない（師事のみ）" selected={pIdx === -1} onClick={() => setMl(s => ({ ...s, partnerIdx: -1 }))} />
                        {legends.map((leg, i) => i === idx ? null : (
                          <SelectRow key={i} selected={pIdx === i} onClick={() => setMl(s => ({ ...s, partnerIdx: i }))}
                            label={<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span>{leg.name}<span style={{ fontSize: T.size.caption, color: T.color.sub, marginLeft: T.space.xs }}>{TYPES[leg.type]?.label || leg.type}</span></span>
                              <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{(leg.generation || 0) > 0 ? `${leg.generation}代目・` : ""}+{leg.plusValue || 0}</span>
                            </div>} />
                        ))}
                      </Section>

                      {breed && (
                        <Section title="配合の相性">
                          {breed.special && (
                            <div style={{ background: T.color.surfaceUp, borderLeft: `3px solid ${T.color.accent}`, padding: T.space.sm, marginBottom: T.space.sm }}>
                              <div style={{ fontSize: T.size.body, color: T.color.accent }}>特殊配合『{breed.special.title}』</div>
                              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>{breed.special.note}</div>
                            </div>
                          )}
                          <Item first label="配合評価" value={breed.matingGrade} valueColor={T.color.accent} detail={`爆発力 ${breed.bakuhatsu}`} />
                          <Item label="素質の見込み"
                            value={breed.growthSteps > 0 || breed.talentCap > 0 ? "化ける可能性あり" : "平凡"}
                            detail={[breed.growthSteps > 0 ? `成長力+${breed.growthSteps}段` : null, breed.talentCap > 0 ? `才能キャップ+${breed.talentCap}` : null].filter(Boolean).join("・") || "配合の質を上げると化ける"} />
                          {breed.danger > 0 && (
                            <Item label="危険度" value={breed.dangerLabel} valueColor={breed.danger >= 38 ? T.color.bad : T.color.accent}
                              detail={`約${breed.danger}%：稀に「ガラスの体」を持って生まれる${breed.healthMit > 0 ? "／健康な血で軽減済" : "。頑丈・鉄人の血を持つ親で軽減できる"}`} />
                          )}
                          <Item label="配合相性" value={`${breed.nick.rank} ${breed.nick.label}`} valueColor={breed.nick.rank === "◎" ? T.color.accent : T.color.text} />
                          <Item label="血統ボーナス" value={`累代+${breed.plusPer}`}
                            detail={[breed.inbreed.count > 0 ? `インブリード×${breed.inbreed.count}（血が濃い！）` : null, breed.generation > 1 ? `${breed.generation}代目` : null].filter(Boolean).join("・") || null} />
                          <Item label="受け継ぐ特能" value={breed.extraAbilities.length > 0 ? breed.extraAbilities.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・") : "—"} />
                          {breed.goldInherit && breed.goldInherit.length > 0 && (
                            <Item label="金の特殊能力" value={breed.goldInherit.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")} valueColor={T.color.accent} detail="最初から金です" />
                          )}
                          {breed.exclusive && breed.exclusive.length > 0 && (
                            <Item label="配合限定特能" value={breed.exclusive.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")} valueColor={T.color.accent} />
                          )}
                          <Item label="継承する系統" value={master.lineageName || `${master.name}系`}
                            detail={(() => { const rec = loadBloodlines()[master.lineageName || `${master.name}系`]; const t = rec ? mlBloodlineTier(rec) : null; if (!t || t.tier <= 0) return null; const fac = mlBloodlineFactor(rec); return `${t.label}系統（因子：伸びしろ+${t.tier}${fac ? `・${ABILITIES[fac]?.label || fac}` : ""}${t.tier >= 3 ? "・金" : ""}）`; })()} />
                          {breed.archNotes && breed.archNotes.length > 0 && (
                            <Item label="血の格" value={breed.archNotes.join("・")} />
                          )}
                        </Section>
                      )}
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
          <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_legends" }))}>歴代選手の殿堂を見る</QuietBtn>
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
              <div style={{ fontSize: T.size.title, lineHeight: 1.1 }}>{r.name}<span style={{ fontSize: T.size.caption, color: T.color.sub, marginLeft: T.space.xs }}>{TYPES[r.type].label}</span></div>
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>{r.age}歳・{ML_BACKGROUNDS[r.background]?.label} ／ 総合力 {overall(r)}</div>
              <div style={{ fontSize: T.size.caption, marginTop: T.space.xs }}>
                {powRevealed
                  ? <span style={{ color: T.color.text }}>成長力 {r.growthPow}</span>
                  : <span style={{ color: T.color.sub }}>成長力 ???（3年目に判明）</span>}
                <span style={{ color: T.color.sub }}> ・ 性格 </span><span style={{ color: r.personality === "genius" ? T.color.accent : T.color.text }}>{persLabel}</span>
              </div>
            </div>
          </div>

          {r.debutBoon && (
            <div style={{ background: T.color.surfaceUp, borderLeft: `3px solid ${T.color.accent}`, padding: T.space.sm, marginBottom: T.space.md }}>
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


}
