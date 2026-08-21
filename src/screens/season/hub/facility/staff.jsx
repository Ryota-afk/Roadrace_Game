// hub/facility.jsxより分割（Step13第7弾）：スタッフ雇用セクション。
// 第13弾Phase3-D-4-b：ShopRowへ移行し絵文字を撤去（詳細はdevlog/wave13.md）。
import React from "react";
import { Item, Section, ShopRow } from "../../../../components/kit.jsx";
import { T } from "../../../../data/theme.js";
import { STAFF_META, STAFF_ROLES, STAFF_SALARY_PER_LV, staffEffectText, staffMemberName, staffSalaryTotal } from "../../../../logic/support.js";

export function renderFacilityStaffSection(ctx) {
  const { cls, g, hireStaff, staffMax } = ctx;
  if (staffMax === 0) {
    return <Section title="スタッフ" right={`${cls.label}の上限 Lv0`}><div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px 0` }}>A昇格で雇用が解禁されます。</div></Section>;
  }
  const total = staffSalaryTotal(g.staff);
  return (
    <Section title="スタッフ" right={`${cls.label}の上限 Lv${staffMax}`}>
      {Object.entries(STAFF_ROLES).map(([k, st], i) => {
        const lv = g.staff[k] || 0;
        const hired = lv > 0;
        const meta = STAFF_META[k] || { title: st.label };
        const name = hired ? `${staffMemberName(g.teamName, k)}${meta.title}` : st.label;
        const locked = lv >= staffMax;
        return (
          <ShopRow key={k} first={i === 0}
            label={name} detail={hired ? staffEffectText(k, lv) : st.desc}
            countLabel="Lv" count={`${lv}/${staffMax}`}
            locked={locked ? (g.classIdx < 2 ? "昇格で解禁" : "上限") : null}
            buyLabel={locked ? null : hired ? `昇格 +${STAFF_SALARY_PER_LV}万` : `雇用 月給+${STAFF_SALARY_PER_LV}万`}
            onBuy={() => hireStaff(k)} />
        );
      })}
      <Item label="スタッフ月給合計" value={`-${total}万/月`} />
    </Section>
  );
}
