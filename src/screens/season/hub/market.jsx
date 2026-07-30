// hub.jsxより分割（Step13第1弾）：新人スカウト・FA・引き抜き・トレード・パーツ・消耗品セクション
// （旧shopタブ前半）。中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { AbilityGrid, BlurGrid, PersonaLine, SubStatLine, TraitLine } from "../../../components/panels.jsx";
import { Btn, Eyebrow } from "../../../components/ui.jsx";
import { overall } from "../../../core/core.js";
import { AB_LABEL, GROWTH, POW, TYPES } from "../../../data/abilities.js";
import { ITEMS } from "../../../data/items.js";
import { CLASSES } from "../../../data/progression.js";
import { C, FONT_B, FONT_D, FONT_M } from "../../../data/theme.js";
import { SCOUT_POLICIES, SLOT_LABEL, potentialHint } from "../../../logic/support.js";
import { PARTS } from "../../../sim/race.js";

export function renderMarketSection(ctx) {
  const { acceptTrade, askConfirm, availParts, buyItem, buyPart, declineTrade, g, growthCap, rosterMax, setG, signFa, signScout, useCamp } = ctx;
  return (
    <>
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
    </>
  );
}
