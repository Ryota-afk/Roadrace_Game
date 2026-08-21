// 汎用UIコンポーネント（Btn/Eyebrow）。Phase 3で main.jsx から分離。
// 第13弾Phase3-D-1: 呼び出し側231箇所（Btn111・Eyebrow120）を無改修のまま新トークンへ寄せる
// 写像シム。呼び出し側が渡すcolorプロップ（C.xxxまたは生のhex文字列）を新トークンの3色
// （accent/good/bad）へ写像し、それ以外（旧・青/橙/桃/紫の一部やC.sub）はすべて既定(sub)へ
// 落とす。§8の「アクセントは1色だけ」を、231箇所を書き換えずに実現する（詳細はdevlog/wave13.md）。
// 形状（角丸・枠線幅・フォント）は今回は変えない——それらの大半はscreens側の直書きが主因で
// 共有部品の変更では動かないと実測済みのため、season本体の作り直し（後続フェーズ）で扱う。
import React from "react";
import { C, FONT_D } from "../data/theme.js";
import { T } from "../data/theme.js";

const COLOR_MAP = {
  [C.yellow]: T.color.accent,
  [C.purple]: T.color.accent, // 決定事項：配合系の紫だけはアクセントとして残す
  [C.green]: T.color.good,
  [C.red]: T.color.bad,
  [C.blue]: T.color.sub,
  [C.pink]: T.color.sub,
  [C.sub]: T.color.sub,
  "#e8a13c": T.color.sub, // 橙（旧・警告/特別枠の装飾色）
  "#e56cc8": T.color.sub, // 桃（旧・配合系の装飾色）
  "#6fa8dc": T.color.sub,
};
const mapColor = (c) => COLOR_MAP[c] ?? T.color.sub;

// v46(UI): 次のアクション#15。roleを渡すとcolor/outlineを「意味」から自動決定する
// （ボタンの色が場当たり的で統一感がないという指摘への対応）。
//   primary = 強調・塗り：今この画面でのおすすめ行動（1画面に1つだけを想定）
//   month   = 強調・枠線：月/ターンが進む他の行動
//   menu    = 既定・枠線：月は進まない（画面を開くだけ・トグルするだけ）
//   danger  = 警告・枠線：取り返しがつかない操作（引退・データ消去など）
// role未指定なら従来通りcolor/outlineをそのまま使う（既存の呼び出しは無改修で動く）。
// 第13弾Phase3-D-5: 黄(accent)はデータ強調専用、押せるものはaction（バイオレット）に
// 役割を分けた（CLAUDE.md §9）。primary/monthはどちらも「押す」役割の強調なのでaction。
const BTN_ROLE = {
  primary: { color: T.color.action, outline: false },
  month: { color: T.color.action, outline: true },
  menu: { color: T.color.sub, outline: true },
  danger: { color: T.color.bad, outline: true },
};

export function Btn({ children, onClick, disabled, color = C.yellow, small, outline, style, role }) {
  const r = role ? BTN_ROLE[role] : null;
  const finalColor = r ? r.color : mapColor(color);
  const finalOutline = r ? r.outline : outline;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        fontFamily: FONT_D, letterSpacing: "0.05em",
        background: disabled ? T.color.surfaceUp : finalOutline ? "transparent" : finalColor,
        color: disabled ? T.color.sub : finalOutline ? finalColor : T.color.bg,
        border: finalOutline ? `1.5px solid ${disabled ? T.color.sub : finalColor}` : "none",
        borderRadius: 6, padding: small ? "6px 12px" : "12px 18px",
        fontSize: small ? 13 : 15, fontWeight: 700, cursor: disabled ? "default" : "pointer",
        width: small ? "auto" : "100%", ...style,
      }}>{children}</button>
  );
}

export function Eyebrow({ children, color = C.yellow }) {
  return <div style={{ fontFamily: FONT_D, color: mapColor(color), fontSize: 12, letterSpacing: "0.2em", fontWeight: 700 }}>{children}</div>;
}
