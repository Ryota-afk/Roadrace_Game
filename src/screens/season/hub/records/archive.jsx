// hub/records.jsxより分割（Step13第7弾）：通算タイトル＋コースレコード＋特殊能力図鑑セクション。
// 第13弾Phase3-D-4-b: 見出しを新トークンへ移行し絵文字3個を撤去。TitlesPanel/
// CourseRecordsPanel/AbilityFileListはD-3で確立した「list-type共有部品は自前で
// T.color.surface背景を持つ」規約により、Sectionで二重包装しない（詳細はdevlog/wave13.md）。
import React from "react";
import { AbilityFileList, CourseRecordsPanel, TitlesPanel } from "../../../../components/panels.jsx";
import { T } from "../../../../data/theme.js";
import { loadAbilityFile } from "../../../../logic/support.js";

const Heading = ({ children }) => (
  <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>{children}</div>
);

export function renderRecordsArchiveSection() {
  return (
    <>
      <Heading>通算タイトル</Heading>
      <TitlesPanel />
      <Heading>コースレコード</Heading>
      <CourseRecordsPanel />
      <Heading>特殊能力図鑑</Heading>
      <AbilityFileList file={loadAbilityFile()} />
    </>
  );
}
