// hub/home.jsxより分割（Step13第7弾）：年間プログラム・順位表・トロフィールームへの導線。
// 旧home.jsx（現race）末尾の折り返しボタン列のうち、記録閲覧系の3項目をここへ移設した
// （セーブ・タイトルに戻るは「その他」カテゴリと重複するため削除・一本化）。
import React from "react";
import { Btn, Eyebrow } from "../../../../components/ui.jsx";
import { C } from "../../../../data/theme.js";

export function renderRecordsStandingsSection(ctx) {
  const { setG } = ctx;
  return (
        <div style={{ display: "grid", gap: 10 }}>
          <Eyebrow color={C.sub}>記録を見る</Eyebrow>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Btn small outline color={C.blue} onClick={() => setG(s => ({ ...s, screen: "program" }))}>📅 年間プログラム</Btn>
            <Btn small outline color={C.purple} onClick={() => setG(s => ({ ...s, screen: "standings" }))}>📊 順位表</Btn>
            <Btn small outline color={"#e8a13c"} onClick={() => setG(s => ({ ...s, screen: "trophy" }))}>🏆 トロフィールーム</Btn>
            <Btn small outline color={C.green} onClick={() => setG(s => ({ ...s, screen: "rivals" }))}>🔍 他チーム名鑑</Btn>
          </div>
        </div>
  );
}
