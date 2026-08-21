// 系譜ツリー／因子図鑑の共通ビュー。生涯評価（screens/meta.jsx）とマイライフ殿堂
// （screens/mylife/career.jsx）の両方から呼ばれる、ほぼ同一だったJSXをStep7第11弾で統合した。
// 第13弾Phase3-D-3: 新トークンへ全面移行。系譜ツリーはnetkeibaの血統表を参考に、罫線グリッドで
// 世代を並べる表形式へ再設計した——ただし現在のデータ（mlLineageForest）は1系統内の直系1本を
// 世代順に並べたものであり、netkeibaのような5代・両親を再帰的に遡る血統表そのものではない
// （父方/母方の区別も無い＝parentsは[師匠,配合相手]の役割で、性別による父母の区分ではない）。
// 祖先を再帰的に遡る5代グリッドの実装はデータ層の拡張が要るため次弾へ送る（devlog/wave13.md）。
// variantは「見出しの出し方」の差分吸収だった旧設計を廃止し、空状態の文言差分のみ残す
// （見出し自体はkit.jsxのScreenが担うため、呼び出し側でのheadingAsH2切替が不要になった）。
import React from "react";
import { T } from "../data/theme.js";
import { TYPES } from "../data/abilities.js";
import { Screen } from "./kit.jsx";

const EMPTY_TEXT = {
  lineage: {
    dynasty: "まだ殿堂選手がいません。マイライフで選手を引退させると系譜が始まります。",
    mylife: "まだ殿堂選手がいません。選手を引退させると系譜が始まります。",
  },
  factor: {
    dynasty: "まだ殿堂選手がいません。マイライフで選手を引退させると因子が集まり始めます。",
    mylife: "まだ殿堂選手がいません。選手を引退させると因子が集まり始めます。",
  },
};

export function LineageForestView({ forest, totalLeg, variant, footer }) {
  const tierColor = [T.color.sub, T.color.good, T.color.accent, T.color.accent];
  return (
    <Screen>
      <div style={{ fontSize: T.size.title, marginBottom: T.space.xs }}>系譜ツリー</div>
      <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.md }}>歴代選手{totalLeg}名を、血の流れごとにまとめました。</div>
      {totalLeg === 0 && <div style={{ fontSize: T.size.body, color: T.color.sub, marginBottom: T.space.md }}>{EMPTY_TEXT.lineage[variant]}</div>}
      {forest.map(g => (
        <div key={g.lineageName} style={{ marginBottom: T.space.lg }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", fontSize: T.size.body }}>
            <span style={{ color: T.color.text }}>{g.lineageName}</span>
            <span style={{ fontSize: T.size.caption, color: tierColor[g.tier.tier] }}>{g.tier.label}{g.tier.tier > 0 ? `・因子+${g.tier.tier}` : ""}・{g.size}名</span>
          </div>
          <div style={{ background: T.color.surface, marginTop: T.space.sm, border: `1px solid ${T.color.rule}` }}>
            <div style={{ display: "flex", fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.xs}px ${T.space.sm}px`, borderBottom: `1px solid ${T.color.rule}` }}>
              <span style={{ width: 48, flex: "none" }}>世代</span>
              <span style={{ flex: 1 }}>名前</span>
              <span style={{ width: 60, flex: "none", textAlign: "right" }}>総合力</span>
            </div>
            {g.members.map((m, i) => (
              <div key={i} style={{ padding: `${T.space.sm}px ${T.space.sm}px`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <div style={{ display: "flex", alignItems: "baseline", fontSize: T.size.body }}>
                  <span style={{ width: 48, flex: "none", fontSize: T.size.caption, color: T.color.sub }}>{m.generation > 0 ? `${m.generation}代目` : "元祖"}</span>
                  <span style={{ flex: 1, color: T.color.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.name}<span style={{ fontSize: T.size.caption, color: T.color.sub, marginLeft: T.space.xs }}>{TYPES[m.type]?.label}</span>
                    {m.plusValue > 0 && <span style={{ fontSize: T.size.caption, color: T.color.accent, marginLeft: T.space.xs }}>+{m.plusValue}</span>}
                  </span>
                  <span style={{ width: 60, flex: "none", textAlign: "right", color: T.color.sub }}>{m.overall}</span>
                </div>
                {m.nickname && <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: 2, paddingLeft: 48 }}>「{m.nickname}」</div>}
                {m.parents.length > 0 && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2, paddingLeft: 48 }}>系統：{m.parents.join(" × ")}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {footer}
    </Screen>
  );
}

export function FactorCollectionView({ cats, totalLeg, variant, footer }) {
  return (
    <Screen>
      <div style={{ fontSize: T.size.title, marginBottom: T.space.xs }}>因子図鑑</div>
      <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.md }}>殿堂選手{totalLeg}名が残した「因子」。★＝その因子を持つ選手の数。</div>
      {totalLeg === 0 && <div style={{ fontSize: T.size.body, color: T.color.sub, marginBottom: T.space.md }}>{EMPTY_TEXT.factor[variant]}</div>}
      {cats.map(cat => (
        <div key={cat.category} style={{ marginBottom: T.space.lg }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>{cat.category}</div>
          {cat.items.length === 0 && <div style={{ fontSize: T.size.caption, color: T.color.sub }}>まだこの種類の因子はありません。</div>}
          <div style={{ background: T.color.surface }}>
            {cat.items.map((it, i) => (
              <div key={it.key} style={{ display: "flex", alignItems: "baseline", gap: T.space.sm, padding: `${T.space.sm}px ${T.space.md}px`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                {/* 脚質因子はTYPES色、適性因子はグレード色（どちらも実データが持つ意味色）。
                    特能因子はmlFactorCollection()側で意味なくC.purpleが充てられているだけなので
                    ここでは使わず本文色に統一する（単一アクセント原則） */}
                <span style={{ fontSize: T.size.body, color: cat.category === "特能因子" ? T.color.text : (it.color || T.color.text), flex: "none", minWidth: 92 }}>{it.label}</span>
                <span style={{ fontSize: T.size.caption, color: T.color.accent, letterSpacing: -1 }}>{"★".repeat(Math.min(6, it.count))}{it.count > 6 ? ` ×${it.count}` : ""}</span>
                <span style={{ flex: 1, fontSize: T.size.caption, color: T.color.sub, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.members.slice(0, 3).join("・")}{it.members.length > 3 ? "…" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {footer}
    </Screen>
  );
}
