// hub/market.jsxより分割（Step13第7弾）：引き抜き市場＋選手間トレードセクション。
// 第13弾Phase3-D-4-b：引き抜き市場は説明文＋ボタン1つだけなのでSection＋ボタンのまま、
// トレードはRiderCardへ移行（詳細はdevlog/wave13.md）。
import React from "react";
import { AbilityGrid, PersonaLine, TraitLine } from "../../../../components/panels.jsx";
import { PrimaryBtn, QuietBtn, Section } from "../../../../components/kit.jsx";
import { RiderCard } from "../../../../components/riderCard.jsx";
import { overall } from "../../../../core/core.js";
import { TYPES } from "../../../../data/abilities.js";
import { T } from "../../../../data/theme.js";

export function renderMarketTransferSection(ctx) {
  const { acceptTrade, askConfirm, declineTrade, g, growthCap, setG } = ctx;
  return (
    <>
      <Section title="引き抜き市場" right="他チームの主力を獲得">
        <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px 0` }}>
          ライバルの看板選手を移籍金で引き抜けます（年1回まで）。相手を弱体化させつつ自チームを強化できます。
          {g.poachDoneThisYear && <span style={{ color: T.color.bad }}> ／今季は使用済み</span>}
        </div>
        <PrimaryBtn onClick={() => setG(s => ({ ...s, screen: "poachMarket" }))}>
          引き抜き市場を開く（候補{(g.poachTargets || []).length}名）
        </PrimaryBtn>
      </Section>
      <Section title="選手間トレード" right="毎月入れ替え">
        <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px 0` }}>他チームからの1対1の交換提案です。</div>
        {(g.tradeOffers || []).length === 0 && <div style={{ fontSize: T.size.caption, color: T.color.sub }}>今月のトレードオファーはありません。</div>}
        {(g.tradeOffers || []).map((offer, i) => {
          const wantRider = g.roster.find(r => r.id === offer.wantRiderId);
          if (!wantRider) return null;
          const r = offer.offeredRider;
          return (
            <RiderCard key={offer.id} r={r} first={i === 0}
              ovr={overall(r)}
              sub={`${r.age}歳`}
              footer={
                <div style={{ display: "flex", gap: T.space.sm }}>
                  <PrimaryBtn disabled={g.roster.length <= 1} onClick={() => askConfirm(`${wantRider.name}を放出し、${r.name}を獲得するトレードを成立させますか？`, () => acceptTrade(offer.id), "トレードを成立させる")}>受け入れる</PrimaryBtn>
                  <QuietBtn onClick={() => declineTrade(offer.id)}>見送る</QuietBtn>
                </div>
              }
            >
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>
                {offer.team}が<span style={{ color: T.color.text }}>{wantRider.name}</span>（{TYPES[wantRider.type].label}・{overall(wantRider)} OVR）を欲しがっています
              </div>
              <PersonaLine p={r.personality} />
              <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
              <AbilityGrid r={r} cap={growthCap} />
            </RiderCard>
          );
        })}
      </Section>
    </>
  );
}
