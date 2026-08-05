// hub/market.jsxより分割（Step13第7弾）：マシンパーツ購入＋消耗品購入セクション。
// 中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { Btn, Eyebrow } from "../../../../components/ui.jsx";
import { AB_LABEL } from "../../../../data/abilities.js";
import { ITEMS } from "../../../../data/items.js";
import { CLASSES } from "../../../../data/progression.js";
import { C, FONT_M } from "../../../../data/theme.js";
import { SLOT_LABEL } from "../../../../logic/support.js";
import { PARTS } from "../../../../sim/race.js";

export function renderMarketShopSection(ctx) {
  const { askConfirm, availParts, buyItem, buyPart, g, useCamp } = ctx;
  return (
    <div style={{ display: "grid", gap: 14 }}>
          <section>
            <Eyebrow color={C.purple}>マシンパーツ（クラス昇格で上位解禁）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(PARTS).map(([pid, p]) => {
                const lockedByClass = p.tier > g.classIdx + 1;
                return (
                  <div key={pid} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, opacity: lockedByClass ? 0.5 : 1 }}>
                    <div>
                      <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                        {p.tier > 1 && <span style={{ color: p.tier === 3 ? C.yellow : C.green, fontSize: 10.5 }}>[{CLASSES[p.tier - 1].id}] </span>}
                        {p.label} <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.purple }}>所持{g.partsInv[pid] || 0}（空き{Math.max(0, availParts(pid))}）</span>
                      </div>
                      <div style={{ color: C.sub, fontSize: 11 }}>[{SLOT_LABEL[p.slot]}] {Object.entries(p.ab).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join(" / ")}</div>
                    </div>
                    {lockedByClass
                      ? <span style={{ fontSize: 11, color: C.red, whiteSpace: "nowrap" }}>🔒 {CLASSES[p.tier - 1].id}で解禁</span>
                      : <Btn small color={C.purple} disabled={g.budget < p.price} onClick={() => buyPart(pid)}>{p.price}万</Btn>}
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={C.purple}>消耗品（在庫制）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(ITEMS).map(([k, it]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{it.label} <span style={{ fontFamily: FONT_M, color: C.purple }}>×{g.inv[k]}</span></div>
                    <div style={{ color: C.sub, fontSize: 11.5 }}>{it.desc}</div>
                  </div>
                  <Btn small color={C.purple} disabled={g.budget < it.price} onClick={() => buyItem(k)}>{it.price}万</Btn>
                </div>
              ))}
              {g.inv.camp > 0 && !g.camp && <Btn small outline color={C.purple} onClick={() => askConfirm("キャンプを実施しますか？今月の練習効果が×2になりますが、選手全員の疲労が+25されます（連発すると故障リスクが高まります）。", useCamp)}>キャンプ券を使う（今月の練習×2・全員疲労+25）</Btn>}
              {g.camp && <div style={{ fontSize: 12, color: C.purple }}>⛺ 今月はトレーニングキャンプ実施中（練習効果×2）</div>}
            </div>
          </section>
    </div>
  );
}
