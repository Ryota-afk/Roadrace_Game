// mylife.jsx より分割（Step8）：ショップ・イベント系（shop/event/protege_event/offseason/crossroads/contract）
import React from "react";
import { FatigueBar } from "../../components/panels.jsx";
import { Btn, Eyebrow } from "../../components/ui.jsx";
import { AB_LABEL, TYPES } from "../../data/abilities.js";
import { CLASSES } from "../../data/progression.js";
import { C, FONT_D, FONT_M } from "../../data/theme.js";
import { CLASS_TIER_COLOR, ML_CARS, ML_CROSSROADS, ML_GEAR, ML_HOUSES, ML_OFFSEASON_CHOICES, ML_STOCK_ITEMS, SLOT_LABEL, mlLivingCost, mlPrivateCampCost } from "../../logic/support.js";
import { PARTS, PART_SLOTS } from "../../sim/race.js";

export function renderMyLifeEventScreens(ctx) {
  const { ml, mlAdvanceMonth, mlBuyCar, mlBuyGear, mlBuyHouse, mlBuyPart, mlBuyStock, mlChooseTeam, mlContinueAfterCrossroads, mlContinueAfterOffseason, mlPrivateCamp, mlResolveCrossroads, mlResolveEvent, mlResolveProtegeEvent, mlResolveOffseason, mlSetPart, mlUseStockConfirm, mlWrap, setMl } = ctx;
    if (ml.screen === "mylife_shop" && ml.player) {
      const r = ml.player;
      const availPartsMl = (pid) => (ml.partsInv[pid] || 0) - (Object.values(r.parts || {}).includes(pid) ? 1 : 0);
      const shopCat = ml.shopCat || "parts";
      return mlWrap(
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
            <Eyebrow color={C.green}>SHOP — 所持金 {ml.money}万円</Eyebrow>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>年俸{ml.salary}万円/年（毎月{Math.round(ml.salary / 12)}万円が振り込まれます・生活費/税 -{mlLivingCost(ml)}万/月）</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 11, color: C.sub }}>現在の疲労</span>
              <div style={{ width: 90 }}><FatigueBar v={r.fatigue} /></div>
              <span style={{ fontSize: 11, color: C.sub }}>フォーム <span style={{ color: (r.form ?? 50) >= 80 ? C.yellow : (r.form ?? 50) >= 62 ? C.green : C.sub, fontFamily: FONT_M }}>{Math.round(r.form ?? 50)}</span></span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["parts", "🔧 パーツ", C.purple], ["items", "🧪 消耗品・合宿", C.green], ["perm", "⭐ 恒久投資", "#e8a13c"]].map(([k, label, col]) => (
              <button key={k} onClick={() => setMl(x => ({ ...x, shopCat: k }))}
                style={{ flex: "1 1 auto", minWidth: 0, background: shopCat === k ? col : C.panel2, color: shopCat === k ? "#14171d" : C.sub, border: `1px solid ${shopCat === k ? col : C.line}`, borderRadius: 8, padding: "7px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {shopCat === "parts" && (<section>
            <Eyebrow color={C.purple}>マシンパーツ（クラス昇格で上位解禁）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(PARTS).map(([pid, p]) => {
                const lockedByClass = p.tier > ml.classIdx + 1;
                return (
                  <div key={pid} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, opacity: lockedByClass ? 0.5 : 1 }}>
                    <div>
                      <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                        {p.label} <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.purple }}>所持{ml.partsInv[pid] || 0}（空き{Math.max(0, availPartsMl(pid))}）</span>
                      </div>
                      <div style={{ color: C.sub, fontSize: 11 }}>[{SLOT_LABEL[p.slot]}] {Object.entries(p.ab).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join(" / ")}</div>
                    </div>
                    {lockedByClass
                      ? <span style={{ fontSize: 11, color: C.red, whiteSpace: "nowrap" }}>🔒 {CLASSES[p.tier - 1].id}で解禁</span>
                      : <Btn small color={C.purple} disabled={ml.money < p.price} onClick={() => mlBuyPart(pid)}>{p.price}万</Btn>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              {PART_SLOTS.map(slot => (
                <span key={slot} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 11, color: C.purple }}>{SLOT_LABEL[slot]}:</span>
                  <select value={r.parts[slot] || ""} onChange={e => mlSetPart(slot, e.target.value)}
                    style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 5px", fontSize: 11.5, maxWidth: 140 }}>
                    <option value="">— なし —</option>
                    {Object.entries(PARTS).filter(([pid, p]) => p.slot === slot && (availPartsMl(pid) > 0 || r.parts[slot] === pid))
                      .map(([pid, p]) => <option key={pid} value={pid}>{p.label}</option>)}
                  </select>
                </span>
              ))}
            </div>
          </section>)}
          {shopCat === "items" && (<section>
            <Eyebrow color={C.green}>消耗品（在庫制）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(ML_STOCK_ITEMS).map(([k, it]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{it.label} <span style={{ fontFamily: FONT_M, color: C.green }}>×{ml.stock[k] || 0}</span></div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{it.desc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn small outline color={C.green} disabled={ml.money < it.price} onClick={() => mlBuyStock(k)}>{it.price}万で購入</Btn>
                    <Btn small color={C.green} disabled={(ml.stock[k] || 0) <= 0} onClick={() => mlUseStockConfirm(k)}>使う</Btn>
                  </div>
                </div>
              ))}
            </div>
          </section>)}
          {shopCat === "items" && (<section>
            <Eyebrow color={"#e8a13c"}>私設強化合宿（何度でも・資金の使い道）</Eyebrow>
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6 }}>
              <div>
                <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>私設強化合宿</div>
                <div style={{ color: C.sub, fontSize: 11 }}>資金を注ぎ込み{AB_LABEL[r.focus]}を中心に鍛える（{AB_LABEL[r.focus]}+6・他+2、疲労+12）。伸びしろが尽きた選手には効きにくい</div>
              </div>
              <Btn small color={"#e8a13c"} disabled={ml.money < mlPrivateCampCost(ml)} onClick={mlPrivateCamp}>{mlPrivateCampCost(ml)}万で実施</Btn>
            </div>
          </section>)}
          {shopCat === "perm" && (<section>
            <Eyebrow color={C.blue}>永続トレーニング用品（買い切り）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(ML_GEAR).map(([k, it]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{it.label}</div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{it.desc}</div>
                  </div>
                  {ml.gear[k]
                    ? <span style={{ fontSize: 11, color: C.green, whiteSpace: "nowrap" }}>✔ 購入済み</span>
                    : <Btn small color={C.blue} disabled={ml.money < it.price} onClick={() => mlBuyGear(k)}>{it.price}万</Btn>}
                </div>
              ))}
            </div>
          </section>)}
          {shopCat === "perm" && (<section>
            <Eyebrow color={"#e8a13c"}>車（レース参加の疲労蓄積を軽減）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {ML_CARS.map((c, i) => (
                <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${ml.carLv === i ? "#e8a13c" : C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{c.label}{ml.carLv === i && <span style={{ marginLeft: 6, fontSize: 10.5, color: "#e8a13c" }}>（所有中）</span>}</div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{c.desc}</div>
                  </div>
                  {ml.carLv >= i ? null : <Btn small color={"#e8a13c"} disabled={ml.money < c.price || ml.carLv !== i - 1} onClick={mlBuyCar}>{c.price}万</Btn>}
                </div>
              ))}
            </div>
          </section>)}
          {shopCat === "perm" && (<section>
            <Eyebrow color={C.red}>家（毎月の疲労回復を底上げ）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {ML_HOUSES.map((h, i) => (
                <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${ml.houseLv === i ? C.red : C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{h.label}{ml.houseLv === i && <span style={{ marginLeft: 6, fontSize: 10.5, color: C.red }}>（所有中）</span>}</div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{h.desc}</div>
                  </div>
                  {ml.houseLv >= i ? null : <Btn small color={C.red} disabled={ml.money < h.price || ml.houseLv !== i - 1} onClick={mlBuyHouse}>{h.price}万</Btn>}
                </div>
              ))}
            </div>
          </section>)}
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_event" && ml.pendingEvent) {
      const ev = ml.pendingEvent;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "#2b2436", border: `1px solid ${C.purple}`, borderRadius: 10, padding: "12px 14px" }}>
            <Eyebrow color={C.purple}>LIFE EVENT — {ev.title}</Eyebrow>
            <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0" }}>{ev.text}</p>
          </div>
          {ev.choices.map((c, i) => (
            <Btn key={i} color={C.purple} onClick={() => mlResolveEvent(i)}>{c.label}</Btn>
          ))}
        </div>
      );
    }

    if (ml.screen === "mylife_protege_event" && ml.pendingProtegeEvent) {
      const ev = ml.pendingProtegeEvent;
      const t = ml.protege ? TYPES[ml.protege.type] : null;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "linear-gradient(180deg, rgba(53,192,126,0.10), #232a26)", border: `1px solid ${C.green}`, borderRadius: 10, padding: "12px 14px" }}>
            <Eyebrow color={C.green}>🎓 弟子との時間 — {ev.title}</Eyebrow>
            {ml.protege && <div style={{ fontFamily: FONT_D, fontSize: 14, color: C.text, margin: "6px 0 2px" }}>{ml.protege.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: t?.color }}>{t?.label}</span></div>}
            <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "6px 0 0" }}>{ev.text}</p>
          </div>
          {ev.choices.map((c, i) => (
            <Btn key={i} color={C.green} onClick={() => mlResolveProtegeEvent(i)}>{c.label}</Btn>
          ))}
        </div>
      );
    }

    if (ml.screen === "mylife_event_result") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, border: `1px solid ${C.line}` }}>
          <Eyebrow color={C.purple}>結果</Eyebrow>
          <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{ml.eventResultText}</p>
        </div>
        {ml.eventAdvanced
          ? <Btn onClick={() => setMl(s => ({ ...s, eventAdvanced: false, screen: "mylife_main" }))}>戻る →</Btn>
          : <Btn onClick={() => mlAdvanceMonth("event")}>翌月へ進む →</Btn>}
      </div>
    );

    if (ml.screen === "mylife_offseason" && ml.pendingOffseason) {
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "#1e2b24", border: `2px solid ${C.green}`, borderRadius: 10, padding: "12px 14px" }}>
            <Eyebrow color={C.green}>オフシーズン</Eyebrow>
            <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0" }}>新シーズンまでの間、どのように過ごしますか？</p>
          </div>
          {ML_OFFSEASON_CHOICES.map((c, i) => (
            <div key={c.key} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
              <div style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 14, color: C.text }}>{c.label}</div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{c.desc}</div>
              <Btn small color={C.green} style={{ marginTop: 8 }} onClick={() => mlResolveOffseason(i)}>これを選ぶ</Btn>
            </div>
          ))}
        </div>
      );
    }

    if (ml.screen === "mylife_offseason_result") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.green}` }}>
          <Eyebrow color={C.green}>結果</Eyebrow>
          <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{ml.offseasonResultText}</p>
        </div>
        <Btn onClick={mlContinueAfterOffseason}>続ける →</Btn>
      </div>
    );

    if (ml.screen === "mylife_crossroads" && ml.pendingCrossroads) {
      const cr = ML_CROSSROADS[ml.pendingCrossroads.key];
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "#2b1e1e", border: `2px solid ${C.red}`, borderRadius: 10, padding: "12px 14px" }}>
            <Eyebrow color={C.red}>{cr.title}</Eyebrow>
            <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0" }}>{cr.text}</p>
          </div>
          {cr.choices.map((c, i) => (
            <Btn key={i} color={C.red} onClick={() => mlResolveCrossroads(i)}>{c.label}</Btn>
          ))}
        </div>
      );
    }

    if (ml.screen === "mylife_crossroads_result") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.red}` }}>
          <Eyebrow color={C.red}>結果</Eyebrow>
          <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{ml.crossroadsResultText}</p>
        </div>
        <Btn onClick={mlContinueAfterCrossroads}>続ける →</Btn>
      </div>
    );

    if (ml.screen === "mylife_contract" && ml.contractOffers) return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: ml.biddingWar ? "#3a2a12" : "#2b2436", border: `1px solid ${ml.biddingWar ? "#e8a13c" : C.purple}`, borderRadius: 10, padding: "10px 14px" }}>
          <Eyebrow color={ml.biddingWar ? "#e8a13c" : C.purple}>{ml.biddingWar ? "🔥 CONTRACT — 争奪戦！" : "CONTRACT — 移籍オファー"}</Eyebrow>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
            {ml.biddingWar
              ? "圧倒的な成績にチーム間で争奪戦が勃発！各チームが競って年俸・契約金・エース確約を吊り上げてきています。最高の条件を選び取りましょう。"
              : "好成績を残したあなたに、複数チームから声がかかっています。条件を見比べて来季の所属先を選んでください。"}
          </div>
        </div>
        {ml.contractOffers.map((offer, i) => {
          const isStay = i === 0;
          const previewSalary = Math.round(ml.salary * offer.salaryMul);
          const classDelta = offer.tier - ml.classIdx;
          return (
            <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1.5px solid ${isStay ? C.line : C.purple}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontFamily: FONT_M, fontSize: 11, fontWeight: 700, color: "#14171d", background: CLASS_TIER_COLOR[offer.tier],
                  borderRadius: 5, padding: "1px 6px",
                }}>{CLASSES[offer.tier].id}</span>
                <span style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 14, color: C.text }}>{offer.team}{isStay ? "（残留）" : "（移籍）"}</span>
                {classDelta > 0 && <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>⬆ 昇格</span>}
                {classDelta < 0 && <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>⬇ 降格</span>}
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>年俸 {previewSalary}万円{offer.bonus > 0 && <span style={{ color: C.green }}>／契約金 +{offer.bonus}万円</span>}</div>
              {offer.aceGuarantee && <div style={{ fontSize: 11, color: C.yellow, marginTop: 2 }}>👑 来季開幕戦はエースとして起用を確約</div>}
              <Btn small outline={isStay} color={C.purple} onClick={() => mlChooseTeam(offer)} style={{ marginTop: 8 }}>この条件で契約する</Btn>
            </div>
          );
        })}
      </div>
    );

    // v28: 引退勧告の駆け引き画面

}
