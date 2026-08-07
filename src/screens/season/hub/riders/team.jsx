// hub/riders.jsxより分割（Step13第7弾）：チームケミストリー・スタッフ陣・主将任命ヒント・
// キャンプ券セクション。中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { Btn } from "../../../../components/ui.jsx";
import { CHEMISTRY_TIERS } from "../../../../data/progression.js";
import { C, FONT_D } from "../../../../data/theme.js";
import { STAFF_META, staffMemberName, teamChemistryTier } from "../../../../logic/support.js";

export function renderRidersTeamSection(ctx) {
  const { askConfirm, g, useCamp } = ctx;
  const chem = teamChemistryTier(g.roster);
  return (
        <div style={{ display: "grid", gap: 10 }}>
          {(() => {
            // v35(シーズン深掘り): ケミストリーの育ちを可視化。次のティアまでの進捗バー＋昇格後の効果
            const next = [...CHEMISTRY_TIERS].sort((a, b) => a.min - b.min).find(t => t.min > chem.min);
            const pct = next ? Math.max(0, Math.min(1, (chem.avgTenure - chem.min) / (next.min - chem.min))) : 1;
            return (
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 11.5, color: C.sub }}>🤝 チームケミストリー </span>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 13.5, color: C.green }}>{chem.label}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.sub }}>平均在籍{chem.avgTenure.toFixed(1)}ヶ月{chem.mul < 1 ? `／集団走行の消耗-${Math.round((1 - chem.mul) * 100)}%` : ""}</div>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: C.line, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ width: `${pct * 100}%`, height: "100%", background: C.green, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 10, color: C.sub, marginTop: 3 }}>
                  {next ? `次の絆「${next.label}」まで平均在籍あと${Math.max(0, next.min - chem.avgTenure).toFixed(1)}ヶ月（メンバーを固定して走り込むほど深まる）` : "最高の絆に到達。長く共に走った証だ。"}
                </div>
              </div>
            );
          })()}
          {/* v35(シーズン深掘り): スタッフ陣を一目で。雇用中の各スタッフを名前付きで並べる */}
          {(() => {
            const hired = Object.entries(g.staff || {}).filter(([, lv]) => lv > 0);
            if (hired.length === 0 && !g.obCoach) return null;
            return (
              <div style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.line}` }}>
                <span style={{ fontSize: 11, color: C.sub }}>🏳 スタッフ陣：</span>
                <span style={{ fontSize: 11.5, color: C.text }}>
                  {hired.length === 0 ? "（一般スタッフ未雇用）" : hired.map(([k, lv]) => `${(STAFF_META[k] || {}).icon || ""}${staffMemberName(g.teamName, k)}${(STAFF_META[k] || {}).title || "スタッフ"}Lv${lv}`).join("・")}
                  {g.obCoach && <span style={{ color: "#e8a13c" }}>{hired.length > 0 ? "・" : ""}🎓{g.obCoach.name}コーチ</span>}
                </span>
              </div>
            );
          })()}
          <div style={{ fontSize: 11, color: C.sub }}>🎖 主将より2歳以上若い選手は練習効果+10%。任命は各選手カードの🎖から。</div>
          {g.inv.camp > 0 && !g.camp && <Btn small outline color={C.purple} onClick={() => askConfirm("キャンプを実施しますか？今月の練習効果が×2になりますが、選手全員の疲労が+25されます（連発すると故障リスクが高まります）。", useCamp)}>⛺ キャンプ券を使う（今月の練習効果×2・全員疲労+25）</Btn>}
          {g.camp && <div style={{ fontSize: 12, color: C.purple }}>⛺ 今月はトレーニングキャンプ実施中（練習効果×2）</div>}
        </div>
  );
}
