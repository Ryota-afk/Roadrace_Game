// hub/records.jsxより分割（Step13第7弾）：通算タイトル＋コースレコード＋特殊能力図鑑セクション。
// 中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { AbilityFileList, CourseRecordsPanel, TitlesPanel } from "../../../../components/panels.jsx";
import { Eyebrow } from "../../../../components/ui.jsx";
import { C } from "../../../../data/theme.js";
import { loadAbilityFile } from "../../../../logic/support.js";

export function renderRecordsArchiveSection() {
  return (
        <div style={{ display: "grid", gap: 12 }}>
          <Eyebrow color={"#e8a13c"}>👑 通算タイトル</Eyebrow>
          <TitlesPanel />
          <Eyebrow color={"#e8a13c"}>🏅 コースレコード</Eyebrow>
          <CourseRecordsPanel />
          <Eyebrow color={C.purple}>🗂 特殊能力図鑑</Eyebrow>
          <AbilityFileList file={loadAbilityFile()} />
        </div>
  );
}
