// hub/market.jsxより分割（Step13第7弾）：引き抜き市場＋選手間トレードセクション。
// 中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { AbilityGrid, PersonaLine, TraitLine } from "../../../../components/panels.jsx";
import { Btn, Eyebrow } from "../../../../components/ui.jsx";
import { overall } from "../../../../core/core.js";
import { TYPES } from "../../../../data/abilities.js";
import { C, FONT_D, FONT_M } from "../../../../data/theme.js";

export function renderMarketTransferSection(ctx) {
  const { acceptTrade, askConfirm, declineTrade, g, growthCap, setG } = ctx;
  return (
    <div style={{ display: "grid", gap: 14 }}>
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
    </div>
  );
}
