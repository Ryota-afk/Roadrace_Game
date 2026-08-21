// 選手カード共通部品。第13弾Phase3-D-4-b（案B）：riders/list・market/scout・
// market/transfer・records/hallの4画面が、同じ形の選手カード（名前＋脚質＋OVR＋本文＋
// アクション）をそれぞれ独自にインラインstyleで書いていた状態を解消する。
// 実測でriders/listの1枚は25要素・1人約560pxあり、「どれだけ伸びるか」を表す指標が
// 成長ランク／伸びしろ／成長フェーズの3つ同じ行に重複していた。案Bはヘッダ（名前・
// バッジ・OVR）＋副次行（脚質・任意のsub文字列・調子）＋本文（screenごとに異なる内容を
// childrenで渡す）＋任意のフッター（購入/契約ボタン等）＋任意の展開領域、という
// 5スロットの骨格だけを共有し、性格・特能・適性・戦績といった中身は呼び出し側が
// 既存の共有部品（PersonaLine/TraitLine/DisciplineGrid等）で組み立てる。
// 詳細はdevlog/wave13.md参照。
import React from "react";
import { COND_ARROW, COND_COLOR, TYPES } from "../data/abilities.js";
import { FONT_DOT, T } from "../data/theme.js";

export function RiderCard({
  r, ovr, ovrLabel = "OVR", badge, sub, cond, fatigue,
  children, footer, expanded, onToggleExpand,
  expandLabel = "くわしく見る", collapseLabel = "閉じる", expandedContent,
  first,
}) {
  const t = TYPES[r.type];
  return (
    <div style={{ padding: `${T.space.md}px 0`, borderTop: first ? "none" : `1px solid ${T.color.rule}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: T.space.sm }}>
        <span style={{ fontSize: T.size.head, color: T.color.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.name}{badge && <span style={{ fontSize: T.size.caption, color: T.color.accent, marginLeft: T.space.xs }}>{badge}</span>}
        </span>
        {ovr != null && (
          <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none" }}>
            <span style={{ fontSize: T.size.head, color: T.color.accent, fontVariantNumeric: "tabular-nums" }}>{ovr}</span> {ovrLabel}
          </span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.caption, color: T.color.sub, marginTop: 3, gap: T.space.sm }}>
        <span>{t.label}{sub ? `・${sub}` : ""}</span>
        {cond != null && (
          <span style={{ flex: "none" }}>調子 <span style={{ color: COND_COLOR[cond - 1], fontVariantNumeric: "tabular-nums" }}>{COND_ARROW[cond - 1]}</span></span>
        )}
      </div>
      {fatigue != null && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm }}>
            <span>疲労</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fatigue}</span>
          </div>
          <div style={{ height: 4, background: T.color.rule, marginTop: 3 }}>
            <div style={{ height: "100%", width: `${Math.min(100, fatigue)}%`, background: fatigue >= 70 ? T.color.bad : T.color.accent }} />
          </div>
        </>
      )}
      {children && <div style={{ marginTop: T.space.sm }}>{children}</div>}
      {footer && <div style={{ marginTop: T.space.sm }}>{footer}</div>}
      {expandedContent != null && (
        <>
          <button onClick={onToggleExpand} style={{
            width: "100%", background: "none", border: "none", borderTop: `1px solid ${T.color.rule}`,
            color: T.color.sub, fontFamily: FONT_DOT, fontSize: T.size.caption, padding: `${T.space.sm}px 0 0`,
            marginTop: T.space.sm, cursor: "pointer", textAlign: "left",
          }}>{expanded ? `▲ ${collapseLabel}` : `▼ ${expandLabel}`}</button>
          {expanded && <div style={{ marginTop: T.space.sm }}>{expandedContent}</div>}
        </>
      )}
    </div>
  );
}
