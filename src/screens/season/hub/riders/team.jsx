// hub/riders.jsxより分割（Step13第7弾）：チームケミストリー・スタッフ陣・主将任命ヒント・
// キャンプ券セクション。第13弾Phase3-D-4-b: Section/Itemへ移行。スタッフ陣の1行連結
// （join("・")）をItemの行へ分離。絵文字を撤去（詳細はdevlog/wave13.md）。
import React from "react";
import { Item, QuietBtn, Section } from "../../../../components/kit.jsx";
import { CHEMISTRY_TIERS } from "../../../../data/progression.js";
import { T } from "../../../../data/theme.js";
import { STAFF_META, staffMemberName, teamChemistryTier } from "../../../../logic/support.js";

export function renderRidersTeamSection(ctx) {
  const { askConfirm, g, useCamp } = ctx;
  const chem = teamChemistryTier(g.roster);
  const next = [...CHEMISTRY_TIERS].sort((a, b) => a.min - b.min).find(t => t.min > chem.min);
  const pct = next ? Math.max(0, Math.min(1, (chem.avgTenure - chem.min) / (next.min - chem.min))) : 1;
  const hired = Object.entries(g.staff || {}).filter(([, lv]) => lv > 0);
  return (
    <>
      <Section title="チームケミストリー" right={chem.label}>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.sm}px 0` }}>
          平均在籍{chem.avgTenure.toFixed(1)}ヶ月{chem.mul < 1 ? `／集団走行の消耗-${Math.round((1 - chem.mul) * 100)}%` : ""}
        </div>
        <div style={{ height: 4, background: T.color.rule }}>
          <div style={{ width: `${pct * 100}%`, height: "100%", background: T.color.accent }} />
        </div>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>
          {next ? `次の絆「${next.label}」まで平均在籍あと${Math.max(0, next.min - chem.avgTenure).toFixed(1)}ヶ月（メンバーを固定して走り込むほど深まる）` : "最高の絆に到達。長く共に走った証だ。"}
        </div>
      </Section>
      {(hired.length > 0 || g.obCoach) && (
        <Section title="スタッフ陣">
          {hired.map(([k, lv], i) => (
            <Item key={k} first={i === 0} label={(STAFF_META[k] || {}).title || "スタッフ"} value={`${staffMemberName(g.teamName, k)}・Lv${lv}`} />
          ))}
          {g.obCoach && <Item first={hired.length === 0} label="OBコーチ" value={`${g.obCoach.name}コーチ`} valueColor={T.color.accent} />}
        </Section>
      )}
      <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>主将より2歳以上若い選手は練習効果+10%。任命は各選手カードの「くわしく見る」から。</div>
      {g.inv.camp > 0 && !g.camp && <QuietBtn color={T.color.accent} onClick={() => askConfirm("キャンプを実施しますか？今月の練習効果が×2になりますが、選手全員の疲労が+25されます（連発すると故障リスクが高まります）。", useCamp)}>キャンプ券を使う（今月の練習効果×2・全員疲労+25）</QuietBtn>}
      {g.camp && <div style={{ fontSize: T.size.body, color: T.color.accent }}>今月はトレーニングキャンプ実施中（練習効果×2）</div>}
    </>
  );
}
