// hub/facility.jsxより分割（Step13第7弾）：OBコーチ登用セクション。
// 第13弾Phase3-D-4-b：ShopRowへ移行し絵文字を撤去（詳細はdevlog/wave13.md）。
import React from "react";
import { Section, ShopRow } from "../../../../components/kit.jsx";
import { AB_LABEL, TYPES } from "../../../../data/abilities.js";
import { T } from "../../../../data/theme.js";
import { OB_COACH_SALARY, TYPE_COACH_ABILITY } from "../../../../logic/support.js";

export function renderFacilityObSection(ctx) {
  const { dismissObCoach, g, hireObCoach } = ctx;
  const candidates = [...g.hallOfFame].reverse().slice(0, 6);
  return (
    <Section title="OBコーチ" right={`月給${OB_COACH_SALARY}万・練習効果+25%`}>
      {g.obCoach && (
        <ShopRow first label={`${g.obCoach.name}コーチ`} badge={TYPES[g.obCoach.type].label}
          detail={`${AB_LABEL[g.obCoach.ab]}の練習効果+25%（全選手）`}
          secondaryLabel="契約解消" onSecondary={dismissObCoach} />
      )}
      {!g.obCoach && candidates.length === 0 && (
        <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px 0` }}>まだ殿堂入りOBがいません（引退・退団した実績ある選手が対象です）。</div>
      )}
      {!g.obCoach && candidates.map((h, i) => (
        <ShopRow key={`ob-${h.id}-${i}`} first={i === 0}
          label={h.name} badge={TYPES[h.type].label}
          detail={`${AB_LABEL[TYPE_COACH_ABILITY[h.type] || "flat"]}の練習効果+25%`}
          buyLabel="迎える" onBuy={() => hireObCoach(h)} />
      ))}
    </Section>
  );
}
