// hub/facility.jsxより分割（Step13第7弾）：OBコーチ登用セクション。
// 中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { Btn, Eyebrow } from "../../../../components/ui.jsx";
import { AB_LABEL, TYPES } from "../../../../data/abilities.js";
import { C, FONT_D } from "../../../../data/theme.js";
import { OB_COACH_SALARY, TYPE_COACH_ABILITY } from "../../../../logic/support.js";

export function renderFacilityObSection(ctx) {
  const { dismissObCoach, g, hireObCoach } = ctx;
  return (
    <div style={{ display: "grid", gap: 14 }}>
          <section>
            <Eyebrow color={"#e8a13c"}>OBコーチ（引退選手の登用・月給{OB_COACH_SALARY}万）</Eyebrow>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>殿堂入りしたOBを専属コーチに迎えると、その選手の脚質に対応する能力の練習効果が全選手+25%になります（1名まで）。</div>
            {g.obCoach && (
              <div style={{ background: "rgba(232,161,60,0.1)", borderRadius: 10, padding: "10px 12px", border: `1.5px solid #e8a13c`, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>🎓 {g.obCoach.name}コーチ <span style={{ fontSize: 10.5, color: TYPES[g.obCoach.type].color }}>{TYPES[g.obCoach.type].label}</span></div>
                  <div style={{ color: "#e8a13c", fontSize: 11.5 }}>{AB_LABEL[g.obCoach.ab]}の練習効果+25%（全選手）</div>
                </div>
                <Btn small outline color={C.sub} onClick={dismissObCoach}>契約解消</Btn>
              </div>
            )}
            {!g.obCoach && (
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {g.hallOfFame.length === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>まだ殿堂入りOBがいません（引退・退団した実績ある選手が対象です）。</div>}
                {[...g.hallOfFame].reverse().slice(0, 6).map((h, i) => (
                  <div key={`ob-${h.id}-${i}`} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13 }}>{h.name}</span>
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: TYPES[h.type].color }}>{TYPES[h.type].label}</span>
                      <div style={{ fontSize: 10.5, color: C.sub }}>{AB_LABEL[TYPE_COACH_ABILITY[h.type] || "flat"]}の練習効果+25%</div>
                    </div>
                    <Btn small color={"#e8a13c"} onClick={() => hireObCoach(h)}>コーチに迎える</Btn>
                  </div>
                ))}
              </div>
            )}
          </section>
    </div>
  );
}
