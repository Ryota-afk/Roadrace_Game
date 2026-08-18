// hub/market.jsx（チーム名編集）＋hub/facility.jsx（ゲームリセット）より分割
// （Step13第7弾）：市場・施設それぞれの状況表示とは無関係な設定操作を「その他」カテゴリへ
// まとめたセクション。中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { Btn, Eyebrow } from "../../../components/ui.jsx";
import { C } from "../../../data/theme.js";
import { clearSaveGame } from "../../../logic/support.js";
import { initGame } from "../../../state/state.js";

// 第13弾: チーム名変更は他の改名操作（選手名等）と同じ共有モーダル（openRename）に統一。
// ライブ入力欄だと、フォント未対応文字を打った瞬間に弾く／決定を押させない、という
// 統一挙動（CLAUDE.md準拠の判定はdomain/shared/textInput.js）をRenameModal側だけに
// 実装すれば足りる（重複実装を避ける）。
export function renderMiscSettingsSection(ctx) {
  const { askConfirm, g, openRename, setG } = ctx;
  return (
    <div style={{ display: "grid", gap: 14 }}>
          <section>
            <Eyebrow color={C.yellow}>🏳 チーム名</Eyebrow>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <div style={{ fontSize: 15, color: C.text }}>{g.teamName || "あなたのチーム"}</div>
              <button onClick={() => openRename("チーム名を変更", g.teamName || "", v => setG(s => ({ ...s, teamName: v })), 16)}
                title="名前を変更" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0, opacity: 0.7 }}>✏️</button>
            </div>
            <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>いつでも変更できます。</div>
          </section>
          <Btn outline color={C.sub} onClick={() => askConfirm("最初からやり直しますか？セーブデータも消えます。", () => { clearSaveGame(); setG(initGame()); })}>ゲームをリセット</Btn>
    </div>
  );
}
