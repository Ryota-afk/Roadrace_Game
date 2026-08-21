// hub/facility.jsxより分割（Step13第7弾）：チーム機材強化セクション。
// 第13弾Phase3-D-4-b（案C）：旧「施設・投資の状況」ダッシュボードは、下の買い物行と
// 同じ機材Lv・効果を重複して表示していたため廃止。失われる「進み具合が図で見える」
// 性質はShopRowのgaugeプロパティ（セグメントバー）として買い物行自体へ移した
// （詳細はdevlog/wave13.md）。
import React from "react";
import { Section, ShopRow } from "../../../../components/kit.jsx";
import { EQUIPS, EQUIP_COST } from "../../../../data/items.js";

export function renderFacilityEquipSection(ctx) {
  const { buyEquip, cls, equipMax, g } = ctx;
  return (
    <Section title="チーム機材" right={`${cls.label}の上限 Lv${equipMax}`}>
      {Object.entries(EQUIPS).map(([k, eq], i) => {
        const lv = g.equip[k], cost = lv >= equipMax ? null : EQUIP_COST[lv];
        const locked = lv >= equipMax;
        return (
          <ShopRow key={k} first={i === 0}
            label={eq.label} detail={eq.desc}
            countLabel="Lv" count={`${lv}/${equipMax}`}
            gauge={{ lv, max: equipMax }}
            locked={locked ? (g.classIdx < 2 ? "昇格で解禁" : "上限") : null}
            buyLabel={locked ? null : `${cost}万`}
            buyDisabled={g.budget < cost}
            onBuy={() => buyEquip(k)} />
        );
      })}
    </Section>
  );
}
