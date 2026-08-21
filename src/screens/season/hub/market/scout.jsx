// hub/market.jsxより分割（Step13第7弾）：新人スカウト(APRIL DRAFT)＋FA移籍市場セクション。
// 第13弾Phase3-D-4-b（案B）：RiderCardへ移行（詳細はdevlog/wave13.md）。
import React from "react";
import { AbilityGrid, BlurGrid, PersonaLine, SubStatLine, TraitLine } from "../../../../components/panels.jsx";
import { PrimaryBtn, Section } from "../../../../components/kit.jsx";
import { RiderCard } from "../../../../components/riderCard.jsx";
import { overall } from "../../../../core/core.js";
import { GROWTH } from "../../../../data/abilities.js";
import { T } from "../../../../data/theme.js";
import { SCOUT_POLICIES } from "../../../../logic/support.js";

export function renderMarketScoutSection(ctx) {
  const { g, growthCap, rosterMax, signFa, signScout } = ctx;
  return (
    <>
      {g.month === 0 && (
        <Section title="新人スカウト" right={`方針：${SCOUT_POLICIES[g.scoutPolicy].label}`}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px 0` }}>能力は推定値。契約するまで正確には分かりません。</div>
          {g.scouts.length === 0 && <div style={{ fontSize: T.size.caption, color: T.color.sub }}>今年の候補は全員契約済み、または見送りました。</div>}
          {g.scouts.map((sc, i) => {
            const r = sc.rider;
            return (
              <RiderCard key={r.id} r={r} first={i === 0}
                ovr={`${sc.ovrMin}〜${sc.ovrMax}`} ovrLabel="OVR?"
                badge={r.prodigy ? "逸材" : null}
                sub={`${sc.tag}・${r.age}歳・${GROWTH[r.growth].label}型`}
                footer={<PrimaryBtn disabled={g.budget < sc.price || g.roster.length >= rosterMax} onClick={() => signScout(sc)}>
                  {g.roster.length >= rosterMax ? "所属枠が満員" : `${sc.price}万円で契約`}
                </PrimaryBtn>}
              >
                <PersonaLine p={r.personality} />
                <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                <BlurGrid blur={sc.blur} />
                <SubStatLine r={r} />
              </RiderCard>
            );
          })}
        </Section>
      )}
      <Section title="FA移籍市場" right="能力は公開済み・即決購入">
        <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px 0` }}>実績のある選手を能力を確認したうえで獲得できます。候補は毎月入れ替わります。</div>
        {g.faMarket.length === 0 && <div style={{ fontSize: T.size.caption, color: T.color.sub }}>今月の候補は全員契約済みです。</div>}
        {g.faMarket.map((fa, i) => {
          const r = fa.rider;
          const full = g.roster.length >= rosterMax;
          return (
            <RiderCard key={r.id} r={r} first={i === 0}
              ovr={overall(r)}
              sub={`${fa.age}歳・${GROWTH[r.growth].label}型`}
              footer={<PrimaryBtn disabled={g.budget < fa.price || full} onClick={() => signFa(fa)}>
                {full ? "所属枠が満員（4月に解雇で空き作成）" : `${fa.price}万円で獲得`}
              </PrimaryBtn>}
            >
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
