// 新デザインの共通部品（season/mylife両モード共有）。第13弾Phase3-D-2で
// career.jsx/race.jsx/rider.jsx/world.jsx に4つに分岐していたSection/Item等をここへ
// 集約（paddingの違いでタブ間の縦のリズムが不揃いだった問題の解消。詳細はdevlog/wave13.md）。
// 第13弾Phase3-D-4-aでseason側（race/status.jsx）がSection/Itemを使い始め、
// Phase3-D-4-bでShopRow/ShopBtnもmylife/events.jsxから移設——mlUi.jsxからkit.jsxへ改名。
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

// 見出し語＋短い値（必ず1行）＋任意の補足行（キャプションサイズ・下段・全幅）。
// 第13弾Phase3-D-0（可読性ルールR4）：主役はvalue側なのでhead(16px)、labelはcaption(12px)に
// 落として比を1.33にする（bodyとcaptionの1.17では階層として認識されないと実測）。
// valueはflex:noneをやめてtextAlign:rightにし、長い文字列でも折り返せるようにする。
export const Item = ({ label, value, valueColor, detail, detailColor, first }) => (
  <div style={{ padding: `${T.space.sm}px 0`, borderTop: first ? "none" : `1px solid ${T.color.rule}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: T.space.sm }}>
      <span style={{ color: T.color.sub, fontSize: T.size.caption, flex: "none" }}>{label}</span>
      <span style={{ color: valueColor || T.color.text, fontSize: T.size.head, flex: "1 1 auto", minWidth: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}</span>
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

// 買い物行専用のボタン（見出し＋補足＋購入ボタン。Itemでは表現できない「ボタン付き行」）。
// 第13弾Phase3-D-0（可読性ルール）で mylife/events.jsx にローカル定義として新設、
// 第13弾Phase3-D-4-bでseason側の買い物5画面（施設・機材・スタッフ・OBコーチ・内装・
// パーツ）でも使うためkit.jsxへ移設した。
//   R1 数値を文字列に連結しない → count/countLabelで「未装着/所持/Lv/現在」の値を独立させ、
//      名前の長さに関係なく右揃えの列に揃える。
//   R4 一覧行の主役はhead(16px) → labelをhead、detail/countはcaption(12px)。
export const ShopBtn = ({ children, onClick, disabled, outline, minWidth }) => (
  <button onClick={onClick} disabled={disabled} style={{
    flex: "none", minWidth, textAlign: minWidth ? "center" : undefined,
    background: disabled ? T.color.surfaceUp : outline ? "transparent" : T.color.accent,
    color: disabled ? T.color.sub : outline ? T.color.accent : T.color.bg,
    border: outline ? `1px solid ${disabled ? T.color.sub : T.color.accent}` : "none",
    fontFamily: FONT_DOT, fontSize: T.size.caption, padding: `${T.space.xs}px ${T.space.sm}px`, cursor: disabled ? "default" : "pointer", whiteSpace: "nowrap",
  }}>{children}</button>
);

// gauge={{lv, max}}（任意）：Lvを持つ買い物行（施設機材・スタッフ・内装）で、現在の
// 進み具合を段（セグメント）で示す。第13弾Phase3-D-4-bでfacility/equipのダッシュボード
// （機材Lvの重複表示）を廃止した受け皿——「進み具合が図で見える」性質を買い物行自体に移した。
export const ShopRow = ({ label, badge, detail, count, countLabel, gauge, locked, buyLabel, onBuy, buyDisabled, secondaryLabel, onSecondary, secondaryDisabled, first }) => (
  <div style={{ padding: `${T.space.sm}px 0`, borderTop: first ? "none" : `1px solid ${T.color.rule}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: T.space.sm }}>
      <span style={{ fontSize: T.size.head, color: T.color.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}{badge && <span style={{ fontSize: T.size.caption, color: T.color.accent, marginLeft: T.space.xs }}>{badge}</span>}
      </span>
      <span style={{ flex: "none", display: "flex", gap: T.space.xs, alignItems: "center" }}>
        {locked && <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{locked}</span>}
        {secondaryLabel && <ShopBtn onClick={onSecondary} disabled={secondaryDisabled} outline>{secondaryLabel}</ShopBtn>}
        {buyLabel && <ShopBtn onClick={onBuy} disabled={buyDisabled} minWidth={56}>{buyLabel}</ShopBtn>}
      </span>
    </div>
    {(detail || count != null) && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: T.space.sm, marginTop: 2 }}>
        <span style={{ fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.5 }}>{detail}</span>
        {count != null && <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none", fontVariantNumeric: "tabular-nums" }}>{countLabel} {count}</span>}
      </div>
    )}
    {gauge && (
      <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
        {Array.from({ length: gauge.max }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 3, background: i < gauge.lv ? T.color.accent : T.color.rule }} />
        ))}
      </div>
    )}
  </div>
);
