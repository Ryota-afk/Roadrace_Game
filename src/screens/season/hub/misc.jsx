// hub/market.jsx（チーム名編集）＋hub/facility.jsx（ゲームリセット）より分割
// （Step13第7弾）：市場・施設それぞれの状況表示とは無関係な設定操作を「その他」カテゴリへ
// まとめたセクション。中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { Btn, Eyebrow } from "../../../components/ui.jsx";
import { C, FONT_B } from "../../../data/theme.js";
import { clearSaveGame } from "../../../logic/support.js";
import { initGame } from "../../../state/state.js";

export function renderMiscSettingsSection(ctx) {
  const { askConfirm, g, setG } = ctx;
  return (
    <div style={{ display: "grid", gap: 14 }}>
          <section>
            <Eyebrow color={C.yellow}>🏳 チーム名</Eyebrow>
            <input type="text" value={g.teamName || ""} maxLength={16} placeholder="あなたのチーム"
              onChange={e => { const v = e.target.value; setG(s => ({ ...s, teamName: v })); }}
              onBlur={e => { if (!e.target.value.trim()) setG(s => ({ ...s, teamName: "あなたのチーム" })); }}
              style={{ width: "100%", boxSizing: "border-box", marginTop: 6, background: C.panel2, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", fontSize: 14, fontFamily: FONT_B }} />
            <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>いつでも変更できます（16文字まで）。</div>
          </section>
          <Btn outline color={C.sub} onClick={() => askConfirm("最初からやり直しますか？セーブデータも消えます。", () => { clearSaveGame(); setG(initGame()); })}>ゲームをリセット</Btn>
    </div>
  );
}
