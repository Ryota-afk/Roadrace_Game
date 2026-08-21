// Wave H-2新設：拠点の「内装・改装」セクション。4つの持ち場（トレーニング/メカニック/
// メディカル/スカウト）の内装グレード(0〜3・見た目のみ・能力値への影響なし)を資金で購入する。
// 第13弾Phase3-D-4-b：ShopRowへ移行（詳細はdevlog/wave13.md）。
import React from "react";
import { Section, ShopRow } from "../../../../components/kit.jsx";
import { ROOM_GRADE_MAX, ROOM_UPGRADE_COST, ROOM_UPGRADE_KEYS, ROOM_UPGRADE_LABEL } from "../../../../data/roomUpgrade.js";

const GRADE_LABEL = ["未改装", "標準", "上級", "最高級"];

export function renderFacilityRoomSection(ctx) {
  const { buyRoomUpgrade, g } = ctx;
  return (
    <Section title="内装・改装" right="見た目のみ・能力値への影響なし">
      {ROOM_UPGRADE_KEYS.map((k, i) => {
        const lv = ((g.roomLv || {})[k]) || 0;
        const cost = lv >= ROOM_GRADE_MAX ? null : ROOM_UPGRADE_COST[lv];
        const locked = lv >= ROOM_GRADE_MAX;
        return (
          <ShopRow key={k} first={i === 0}
            label={ROOM_UPGRADE_LABEL[k]}
            detail={locked ? "最高グレードです" : `次：${GRADE_LABEL[lv + 1]}`}
            countLabel={GRADE_LABEL[lv]} count={`Lv${lv}/${ROOM_GRADE_MAX}`}
            gauge={{ lv, max: ROOM_GRADE_MAX }}
            locked={locked ? "上限" : null}
            buyLabel={locked ? null : `${cost}万`}
            buyDisabled={g.budget < cost}
            onBuy={() => buyRoomUpgrade(k)} />
        );
      })}
    </Section>
  );
}
