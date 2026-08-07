// 汎用UIコンポーネント（Btn/Eyebrow）。Phase 3で main.jsx から分離。
import React from "react";
import { C, FONT_D } from "../data/theme.js";

// v46(UI): 次のアクション#15。roleを渡すとcolor/outlineを「意味」から自動決定する
// （ボタンの色が場当たり的で統一感がないという指摘への対応）。
//   primary = 黄・塗り：今この画面でのおすすめ行動（1画面に1つだけを想定）
//   month   = 黄・枠線：月/ターンが進む他の行動
//   menu    = グレー・枠線：月は進まない（画面を開くだけ・トグルするだけ）
//   danger  = 赤・枠線：取り返しがつかない操作（引退・データ消去など。前向きな意思決定でも
//             「元に戻せない」ことを示すためこの色を使う。単に月が進むだけの操作には使わない）
// role未指定なら従来通りcolor/outlineをそのまま使う（既存の呼び出しは無改修で動く）。
const BTN_ROLE = {
  primary: { color: C.yellow, outline: false },
  month: { color: C.yellow, outline: true },
  menu: { color: C.sub, outline: true },
  danger: { color: C.red, outline: true },
};

export function Btn({ children, onClick, disabled, color = C.yellow, small, outline, style, role }) {
  const r = role ? BTN_ROLE[role] : null;
  const finalColor = r ? r.color : color;
  const finalOutline = r ? r.outline : outline;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        fontFamily: FONT_D, letterSpacing: "0.05em",
        background: disabled ? C.panel2 : finalOutline ? "transparent" : finalColor,
        color: disabled ? "#6b7386" : finalOutline ? finalColor : "#14171d",
        border: finalOutline ? `1.5px solid ${disabled ? "#6b7386" : finalColor}` : "none",
        borderRadius: 6, padding: small ? "6px 12px" : "12px 18px",
        fontSize: small ? 13 : 15, fontWeight: 700, cursor: disabled ? "default" : "pointer",
        width: small ? "auto" : "100%", ...style,
      }}>{children}</button>
  );
}

export function Eyebrow({ children, color = C.yellow }) {
  return <div style={{ fontFamily: FONT_D, color, fontSize: 12, letterSpacing: "0.2em", fontWeight: 700 }}>{children}</div>;
}
