// hub/facility.jsxより分割（Step13第7弾）：スタッフ雇用セクション。
// 中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { Btn, Eyebrow } from "../../../../components/ui.jsx";
import { C, FONT_M } from "../../../../data/theme.js";
import { STAFF_META, STAFF_ROLES, STAFF_SALARY_PER_LV, staffEffectText, staffMemberName, staffSalaryTotal } from "../../../../logic/support.js";

export function renderFacilityStaffSection(ctx) {
  const { cls, g, hireStaff, staffMax } = ctx;
  return (
    <div style={{ display: "grid", gap: 14 }}>
          <section>
            <Eyebrow color={C.red}>スタッフ（月給制・{cls.label}の上限はLv{staffMax}）</Eyebrow>
            {staffMax === 0 ? (
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>A昇格で雇用が解禁されます。</div>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                {Object.entries(STAFF_ROLES).map(([k, st]) => {
                  const lv = g.staff[k] || 0;
                  const meta = STAFF_META[k] || { icon: "🧑‍💼", title: st.label };
                  const hired = lv > 0;
                  const name = staffMemberName(g.teamName, k);
                  return (
                    <div key={k} style={{ background: hired ? "rgba(217,72,74,0.06)" : C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${hired ? "rgba(217,72,74,0.4)" : C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div>
                        <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>
                          {meta.icon} {hired ? `${name}${meta.title}` : st.label} <span style={{ fontFamily: FONT_M, color: C.yellow }}>Lv{lv}/{staffMax}</span>
                        </div>
                        <div style={{ color: hired ? C.red : C.sub, fontSize: 11.5 }}>{hired ? `現在の効果：${staffEffectText(k, lv)}` : st.desc}</div>
                      </div>
                      <Btn small color={C.red} disabled={lv >= staffMax} onClick={() => hireStaff(k)}>
                        {lv >= staffMax ? (g.classIdx < 2 ? "昇格で解禁" : "上限") : hired ? `昇格 +${STAFF_SALARY_PER_LV}万` : `雇用 月給+${STAFF_SALARY_PER_LV}万`}
                      </Btn>
                    </div>
                  );
                })}
                <div style={{ fontSize: 10.5, color: C.sub }}>スタッフ月給合計 -{staffSalaryTotal(g.staff)}万/月</div>
              </div>
            )}
          </section>
    </div>
  );
}
