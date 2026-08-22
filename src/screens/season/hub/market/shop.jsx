// hub/market.jsxより分割（Step13第7弾）：マシンパーツ購入＋消耗品購入セクション。
// 第13弾Phase3-D-4-b：ShopRowへ移行。「所持N（空きN）」表記（D-4-0でマイライフ側は
// 「未装着 N」へ既に直したが、シーズン側はこのラウンドまで手つかずだった）を統一
// （詳細はdevlog/wave13.md）。
import React from "react";
import { Section, ShopRow } from "../../../../components/kit.jsx";
import { AB_LABEL } from "../../../../data/abilities.js";
import { ITEMS } from "../../../../data/items.js";
import { PARTS, partEffectParts } from "../../../../data/parts.js";
import { CLASSES } from "../../../../data/progression.js";
import { T } from "../../../../data/theme.js";
import { SLOT_LABEL } from "../../../../logic/support.js";

export function renderMarketShopSection(ctx) {
  const { askConfirm, availParts, buyItem, buyPart, g, useCamp } = ctx;
  return (
    <>
      <Section title="マシンパーツ" right="クラス昇格で上位解禁">
        {Object.entries(PARTS).map(([pid, p], i) => {
          const lockedByClass = p.tier > g.classIdx + 1;
          return (
            <div key={pid} style={{ opacity: lockedByClass ? 0.5 : 1 }}>
              <ShopRow first={i === 0}
                label={p.label} badge={p.tier > 1 ? CLASSES[p.tier - 1].id : null}
                detail={`[${SLOT_LABEL[p.slot]}] ${partEffectParts(p, 1, AB_LABEL).join(" / ")}`}
                countLabel="未装着" count={Math.max(0, availParts(pid))}
                locked={lockedByClass ? `${CLASSES[p.tier - 1].id}で解禁` : null}
                buyLabel={lockedByClass ? null : `${p.price}万`}
                buyDisabled={g.budget < p.price}
                onBuy={() => buyPart(pid)} />
            </div>
          );
        })}
      </Section>
      <Section title="消耗品（在庫制）">
        {Object.entries(ITEMS).map(([k, it], i) => (
          <ShopRow key={k} first={i === 0}
            label={it.label} detail={it.desc}
            countLabel="所持" count={g.inv[k]}
            buyLabel={`${it.price}万`} buyDisabled={g.budget < it.price}
            onBuy={() => buyItem(k)} />
        ))}
        {g.inv.camp > 0 && !g.camp && (
          <div style={{ marginTop: T.space.sm }}>
            <button onClick={() => askConfirm("キャンプを実施しますか？今月の練習効果が×2になりますが、選手全員の疲労が+25されます（連発すると故障リスクが高まります）。", useCamp)}
              style={{ width: "100%", background: "none", border: `1px solid ${T.color.accent}`, color: T.color.accent, fontFamily: "inherit", fontSize: T.size.caption, padding: T.space.sm, cursor: "pointer" }}>
              キャンプ券を使う（今月の練習効果×2・全員疲労+25）
            </button>
          </div>
        )}
        {g.camp && <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: T.space.sm }}>今月はトレーニングキャンプ実施中（練習効果×2）</div>}
      </Section>
    </>
  );
}
