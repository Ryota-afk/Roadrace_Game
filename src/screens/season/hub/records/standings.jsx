// hub/home.jsxより分割（Step13第7弾）：年間プログラム・順位表・トロフィールームへの導線。
// 第13弾Phase3-D-4-b: Section/QuietBtnへ移行し絵文字4個を撤去（詳細はdevlog/wave13.md）。
import React from "react";
import { QuietBtn, Section } from "../../../../components/kit.jsx";

export function renderRecordsStandingsSection(ctx) {
  const { setG } = ctx;
  return (
    <Section title="記録を見る">
      <QuietBtn onClick={() => setG(s => ({ ...s, screen: "program" }))}>年間プログラム</QuietBtn>
      <QuietBtn onClick={() => setG(s => ({ ...s, screen: "standings" }))}>順位表</QuietBtn>
      <QuietBtn onClick={() => setG(s => ({ ...s, screen: "trophy" }))}>トロフィールーム</QuietBtn>
      <QuietBtn onClick={() => setG(s => ({ ...s, screen: "rivals" }))}>他チーム名鑑</QuietBtn>
    </Section>
  );
}
