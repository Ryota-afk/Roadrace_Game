// hub.jsxより分割（Step13第1弾）：施設状況・機材強化・スタッフ・OBコーチ・リセットセクション
// （旧shopタブ後半）。中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { Btn, Eyebrow } from "../../../components/ui.jsx";
import { AB_LABEL, TYPES } from "../../../data/abilities.js";
import { EQUIPS, EQUIP_COST } from "../../../data/items.js";
import { C, FONT_D, FONT_M } from "../../../data/theme.js";
import { OB_COACH_SALARY, STAFF_META, STAFF_ROLES, STAFF_SALARY_PER_LV, TYPE_COACH_ABILITY, clearSaveGame, staffEffectText, staffMemberName, staffSalaryTotal } from "../../../logic/support.js";
import { initGame } from "../../../state/state.js";

export function renderFacilitySection(ctx) {
  const { askConfirm, buyEquip, cls, dismissObCoach, equipMax, g, hireObCoach, hireStaff, setG, staffMax } = ctx;
  return (
    <>
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
            <Eyebrow color={C.red}>チーム機材（Lv上限：{cls.id}＝{equipMax}）</Eyebrow>
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
                      {lv >= equipMax ? (g.classIdx < 2 ? "昇格で解禁" : "MAX") : `${cost}万`}
                    </Btn>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={C.red}>スタッフ（月給制・Lv上限：{cls.id}＝{staffMax}）</Eyebrow>
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
                        {lv >= staffMax ? (g.classIdx < 2 ? "昇格で解禁" : "MAX") : hired ? `昇格 +${STAFF_SALARY_PER_LV}万` : `雇用 月給+${STAFF_SALARY_PER_LV}万`}
                      </Btn>
                    </div>
                  );
                })}
                <div style={{ fontSize: 10.5, color: C.sub }}>スタッフ月給合計 -{staffSalaryTotal(g.staff)}万/月</div>
              </div>
            )}
          </section>
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
          <Btn outline color={C.sub} onClick={() => askConfirm("最初からやり直しますか？セーブデータも消えます。", () => { clearSaveGame(); setG(initGame()); })}>ゲームをリセット</Btn>
    </>
  );
}
