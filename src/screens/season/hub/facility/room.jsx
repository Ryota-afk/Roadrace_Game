// Wave H-2新設：拠点の「内装・改装」セクション。4つの持ち場（トレーニング/メカニック/
// メディカル/スカウト）の内装グレード(0〜3・見た目のみ・能力値への影響なし)を資金で購入する。
// buyEquip系のUIパターン（hub/facility/equip.jsx）に揃えた。
import React from "react";
import { Btn, Eyebrow } from "../../../../components/ui.jsx";
import { ROOM_GRADE_MAX, ROOM_UPGRADE_COST, ROOM_UPGRADE_KEYS, ROOM_UPGRADE_LABEL } from "../../../../data/roomUpgrade.js";
import { C, FONT_M } from "../../../../data/theme.js";

const GRADE_LABEL = ["未改装", "標準", "上級", "最高級"];

export function renderFacilityRoomSection(ctx) {
  const { buyRoomUpgrade, g } = ctx;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section>
        <Eyebrow color={"#e8a13c"}>🛋 内装・改装（見た目のみ・能力値への影響はありません）</Eyebrow>
        <div style={{ fontSize: 11, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>
          持ち場の内装を上げると、拠点画面でラグ・照明などの飾りが増え、最高グレードではバッジが金色になります。4部屋すべてを最高グレードにすると実績が解除されます。
        </div>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {ROOM_UPGRADE_KEYS.map(k => {
            const lv = ((g.roomLv || {})[k]) || 0;
            const cost = lv >= ROOM_GRADE_MAX ? null : ROOM_UPGRADE_COST[lv];
            return (
              <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>
                    {ROOM_UPGRADE_LABEL[k]} <span style={{ fontFamily: FONT_M, color: "#e8a13c" }}>{GRADE_LABEL[lv]}（Lv{lv}/{ROOM_GRADE_MAX}）</span>
                  </div>
                  <div style={{ color: C.sub, fontSize: 11.5 }}>{lv >= ROOM_GRADE_MAX ? "最高グレードです" : `次：${GRADE_LABEL[lv + 1]}`}</div>
                </div>
                <Btn small color={"#e8a13c"} disabled={lv >= ROOM_GRADE_MAX || g.budget < cost} onClick={() => buyRoomUpgrade(k)}>
                  {lv >= ROOM_GRADE_MAX ? "上限" : `${cost}万`}
                </Btn>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
