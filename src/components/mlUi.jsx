// マイライフ新デザイン共通部品。第13弾Phase3-D-2で career.jsx/race.jsx/rider.jsx/world.jsx に
// 4つに分岐していたSection/Item等をここへ集約した（paddingの違いでタブ間の縦のリズムが
// 不揃いだった問題の解消。詳細はdevlog/wave13.md参照）。season側とは共有しない
// （mylifeの新トークン画面専用。season本体の作り直しは後続フェーズ）。
import React from "react";
import { FONT_DOT, T } from "../data/theme.js";

export const Section = ({ title, right, children, padded }) => (
  <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>
      <span>{title}</span>{right != null && <span style={{ color: T.color.accent }}>{right}</span>}
    </div>
    <div style={{ background: T.color.surface, padding: padded ? T.space.md : `0 ${T.space.md}px`, marginBottom: T.space.md }}>{children}</div>
  </>
);

// 見出し語＋短い値（必ず1行）＋任意の補足行（キャプションサイズ・下段・全幅）
export const Item = ({ label, value, valueColor, detail, detailColor, first }) => (
  <div style={{ padding: `${T.space.sm}px 0`, borderTop: first ? "none" : `1px solid ${T.color.rule}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
      <span style={{ color: T.color.sub, flex: "none" }}>{label}</span>
      <span style={{ color: valueColor || T.color.text, flex: "none", marginLeft: T.space.sm }}>{value}</span>
    </div>
    {detail && <div style={{ fontSize: T.size.caption, color: detailColor || T.color.sub, marginTop: 2 }}>{detail}</div>}
  </div>
);

export const PrimaryBtn = ({ children, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: "100%", background: disabled ? T.color.surfaceUp : T.color.accent, color: disabled ? T.color.sub : T.color.bg,
    border: "none", fontFamily: FONT_DOT, fontSize: T.size.body, padding: T.space.md, cursor: disabled ? "default" : "pointer", marginBottom: T.space.sm,
  }}>{children}</button>
);

export const QuietBtn = ({ children, onClick, color, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: "100%", background: T.color.surfaceUp, color: disabled ? T.color.rule : (color || T.color.sub),
    border: "none", fontFamily: FONT_DOT, fontSize: T.size.body, padding: T.space.md, cursor: disabled ? "default" : "pointer", marginBottom: T.space.sm,
  }}>{children}</button>
);

export const Prose = ({ children }) => (
  <div style={{ fontSize: T.size.body, color: T.color.text, lineHeight: 1.9, padding: T.space.md, background: T.color.surface, marginBottom: T.space.md }}>{children}</div>
);

// 選択式の行（キャラ作成の脚質・経歴・難易度・師匠など、複数の中から1つを選ぶUI共通）
export const SelectRow = ({ label, detail, selected, onClick, first }) => (
  <button onClick={onClick} style={{
    display: "block", width: "100%", textAlign: "left", background: selected ? T.color.surfaceUp : "none",
    border: 0, borderTop: first ? "none" : `1px solid ${T.color.rule}`, cursor: "pointer",
    padding: `${T.space.sm}px ${T.space.md}px`, fontFamily: FONT_DOT,
  }}>
    <div style={{ fontSize: T.size.body, color: selected ? T.color.accent : T.color.text }}>{label}</div>
    {detail && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2, lineHeight: 1.6 }}>{detail}</div>}
  </button>
);

export const Screen = ({ children }) => (
  <div style={{ background: T.color.bg, color: T.color.text, fontFamily: FONT_DOT, margin: "-6px -14px 0", padding: T.space.lg }}>{children}</div>
);
