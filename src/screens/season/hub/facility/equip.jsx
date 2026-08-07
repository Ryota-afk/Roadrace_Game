// hub/facility.jsxより分割（Step13第7弾）：施設・投資の状況ダッシュボード＋チーム機材強化
// セクション。中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { Btn, Eyebrow } from "../../../../components/ui.jsx";
import { AB_LABEL } from "../../../../data/abilities.js";
import { EQUIPS, EQUIP_COST } from "../../../../data/items.js";
import { C, FONT_M } from "../../../../data/theme.js";

export function renderFacilityEquipSection(ctx) {
  const { buyEquip, cls, equipMax, g } = ctx;
  return (
    <div style={{ display: "grid", gap: 14 }}>
          {/* v28: チーム施設のアップグレード段階可視化。機材・スタッフの現在レベルと累積効果を
              バーで一覧できるようにし、投資の進み具合と効果を直感的に把握できるようにする */}
          <section>
            <Eyebrow color={"#e8a13c"}>🏭 施設・投資の状況</Eyebrow>
            <div style={{ display: "grid", gap: 7, marginTop: 6 }}>
              {[
                { label: "エアロフレーム", lv: g.equip.frame, max: 5, effect: `平坦 +${g.equip.frame * 6}%`, color: C.blue },
                { label: "軽量ホイール", lv: g.equip.wheels, max: 5, effect: `登坂 +${g.equip.wheels * 6}%`, color: C.red },
                { label: "トレーニング設備", lv: g.equip.facility, max: 5, effect: `練習効果 +${g.equip.facility * 15}%`, color: C.green },
                { label: "監督", lv: g.staff.manager, max: 3, effect: g.staff.manager > 0 ? `月収+${g.staff.manager * 12}%・ノルマ-${g.staff.manager * 8}%・報酬+${g.staff.manager * 10}%` : "未雇用", color: C.yellow },
                { label: "トレーナー", lv: g.staff.trainer, max: 3, effect: g.staff.trainer > 0 ? `練習成長 +${g.staff.trainer * 12}%` : "未雇用", color: C.green },
                { label: "ドクター", lv: g.staff.doctor, max: 3, effect: g.staff.doctor > 0 ? `故障率 -${g.staff.doctor * 22}%・離脱-${Math.round(g.staff.doctor * 0.8)}ヶ月` : "未雇用", color: "#6fa8dc" },
                { label: "スカウト", lv: g.staff.scout || 0, max: 3, effect: (g.staff.scout || 0) > 0 ? `査定ブレ -${(g.staff.scout || 0) * 28}%・逸材率+${(g.staff.scout || 0) * 60}%` : "未雇用", color: C.purple },
              ].map((row, i) => (
                <div key={i} style={{ background: C.panel, borderRadius: 8, padding: "7px 10px", border: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>{row.label} <span style={{ fontFamily: FONT_M, color: C.sub, fontSize: 10.5 }}>Lv{row.lv}/{row.max}</span></span>
                    <span style={{ fontSize: 10.5, color: row.lv > 0 ? row.color : C.sub }}>{row.effect}</span>
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    {Array.from({ length: row.max }).map((_, j) => (
                      <div key={j} style={{ flex: 1, height: 6, borderRadius: 3, background: j < row.lv ? row.color : C.panel2 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {g.obCoach && <div style={{ fontSize: 11, color: "#e8a13c", marginTop: 6 }}>🎓 OBコーチ {g.obCoach.name}：{AB_LABEL[g.obCoach.ab]}の練習効果+25%</div>}
          </section>
          <section>
            <Eyebrow color={C.red}>チーム機材（{cls.label}の上限はLv{equipMax}）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(EQUIPS).map(([k, eq]) => {
                const lv = g.equip[k], cost = lv >= equipMax ? null : EQUIP_COST[lv];
                return (
                  <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{eq.label} <span style={{ fontFamily: FONT_M, color: C.yellow }}>Lv{lv}/{equipMax}</span></div>
                      <div style={{ color: C.sub, fontSize: 11.5 }}>{eq.desc}</div>
                    </div>
                    <Btn small color={C.red} disabled={lv >= equipMax || g.budget < cost} onClick={() => buyEquip(k)}>
                      {lv >= equipMax ? (g.classIdx < 2 ? "昇格で解禁" : "上限") : `${cost}万`}
                    </Btn>
                  </div>
                );
              })}
            </div>
          </section>
    </div>
  );
}
