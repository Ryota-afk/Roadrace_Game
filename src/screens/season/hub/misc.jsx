// hub/market.jsx（チーム名編集）＋hub/facility.jsx（ゲームリセット）より分割
// （Step13第7弾）：市場・施設それぞれの状況表示とは無関係な設定操作を「その他」カテゴリへ
// まとめたセクション。第13弾Phase3-D-4-b: Section/QuietBtnへ移行。✏️は「変更」の文字
// ボタンへ、「いつでも変更できます。」は自明なので削除（詳細はdevlog/wave13.md）。
import React from "react";
import { QuietBtn, Section } from "../../../components/kit.jsx";
import { T } from "../../../data/theme.js";
import { clearSaveGame } from "../../../logic/support.js";
import { initGame } from "../../../state/state.js";

// 第13弾: チーム名変更は他の改名操作（選手名等）と同じ共有モーダル（openRename）に統一。
// ライブ入力欄だと、フォント未対応文字を打った瞬間に弾く／決定を押させない、という
// 統一挙動（CLAUDE.md準拠の判定はdomain/shared/textInput.js）をRenameModal側だけに
// 実装すれば足りる（重複実装を避ける）。
export function renderMiscSettingsSection(ctx) {
  const { askConfirm, g, openRename, setG } = ctx;
  return (
    <>
      <Section title="チーム名">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: `${T.space.sm}px 0` }}>
          <span style={{ fontSize: T.size.head, color: T.color.text }}>{g.teamName || "あなたのチーム"}</span>
          <button onClick={() => openRename("チーム名を変更", g.teamName || "", v => setG(s => ({ ...s, teamName: v })), 16)}
            style={{ background: "none", border: "none", color: T.color.accent, fontSize: T.size.caption, cursor: "pointer", fontFamily: "inherit" }}>変更</button>
        </div>
      </Section>
      <QuietBtn color={T.color.sub} onClick={() => askConfirm("最初からやり直しますか？セーブデータも消えます。", () => { clearSaveGame(); setG(initGame()); }, "新しく始める")}>ゲームをリセット</QuietBtn>
    </>
  );
}
