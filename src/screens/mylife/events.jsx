// mylife.jsx より分割（Step8）：ショップ・イベント系（shop/event/protege_event/offseason/crossroads/contract）
// 第13弾Phase3-D-2: 新トークン(T/FONT_DOT)へ全面移行。FatigueBar（panels.jsx）は
// season側と共有のため中身は据え置き（Phase3-D-3担当）。
import React from "react";
import { FatigueBar } from "../../components/panels.jsx";
import { Item, PrimaryBtn, Prose, QuietBtn, Screen, Section } from "../../components/mlUi.jsx";
import { AB_LABEL, GROWTH, TYPES } from "../../data/abilities.js";
import { CLASSES, GROWTHPOW_ORDER, GROWTH_ORDER } from "../../data/progression.js";
import { ML_GROWTH_POW_UP_PRICE, ML_GROWTH_SHIFT_PRICE, ML_PART_UPGRADE_COST, ML_PART_LV_MAX, ML_PART_LV_MUL } from "../../data/gear.js";
import { FONT_DOT, T } from "../../data/theme.js";
import { ML_CARS, ML_CROSSROADS, ML_GEAR, ML_HOUSES, ML_OFFSEASON_CHOICES, ML_STOCK_ITEMS, SLOT_LABEL, mlGrowthPowRevealed, mlLivingCost, mlPrivateCampCost } from "../../logic/support.js";
import { PARTS, PART_SLOTS } from "../../sim/race.js";

// ショップ専用の行（見出し＋補足＋購入ボタン。Itemでは表現できない「ボタン付き行」）。
// 第13弾Phase3-D-0（可読性ルール）：
//   R1 数値を文字列に連結しない → count/countLabelで「未装着/所持/現在」の値を独立させ、
//      パーツ名の長さに関係なく右揃えの列に揃える。
//   R4 一覧行の主役はhead(16px) → labelをhead、detail/countはcaption(12px)。
const ShopBtn = ({ children, onClick, disabled, outline, minWidth }) => (
  <button onClick={onClick} disabled={disabled} style={{
    flex: "none", minWidth, textAlign: minWidth ? "center" : undefined,
    background: disabled ? T.color.surfaceUp : outline ? "transparent" : T.color.accent,
    color: disabled ? T.color.sub : outline ? T.color.accent : T.color.bg,
    border: outline ? `1px solid ${disabled ? T.color.sub : T.color.accent}` : "none",
    fontFamily: FONT_DOT, fontSize: T.size.caption, padding: `${T.space.xs}px ${T.space.sm}px`, cursor: disabled ? "default" : "pointer", whiteSpace: "nowrap",
  }}>{children}</button>
);

const ShopRow = ({ label, badge, detail, count, countLabel, locked, buyLabel, onBuy, buyDisabled, secondaryLabel, onSecondary, secondaryDisabled, first }) => (
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
  </div>
);

// mlEventResultText等は複数行の生成テキスト（\n区切り）を含むため、Proseではなく
// whiteSpace:pre-wrapを明示したこの専用ブロックで改行を保持する。
const ResultText = ({ children }) => (
  <div style={{ fontSize: T.size.body, color: T.color.text, lineHeight: 1.9, padding: T.space.md, background: T.color.surface, marginBottom: T.space.md, whiteSpace: "pre-wrap" }}>{children}</div>
);

export function renderMyLifeEventScreens(ctx) {
  const { ml, mlAdvanceMonth, mlBuyCar, mlBuyGear, mlBuyGrowthPowUp, mlBuyGrowthShift, mlBuyHouse, mlBuyPart, mlBuyStock, mlChooseTeam, mlContinueAfterCrossroads, mlContinueAfterOffseason, mlPrivateCamp, mlResolveCrossroads, mlResolveEvent, mlResolveProtegeEvent, mlResolveOffseason, mlSetPart, mlUpgradePart, mlUseStockConfirm, mlWrap, setMl } = ctx;
    if (ml.screen === "mylife_shop" && ml.player) {
      const r = ml.player;
      const availPartsMl = (pid) => (ml.partsInv[pid] || 0) - (Object.values(r.parts || {}).includes(pid) ? 1 : 0);
      const shopCat = ml.shopCat || "parts";
      const CATS = [["parts", "パーツ"], ["items", "消耗品・合宿"], ["perm", "恒久投資"]];
      const maxLv = ML_PART_LV_MAX + (ml.partLvMaxBonus || 0);
      return mlWrap(
        <Screen>
          <div style={{ background: T.color.surface, padding: T.space.md, marginBottom: T.space.md }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: T.size.head }}>所持金</span>
              <span style={{ fontSize: T.size.title, color: T.color.accent }}>{ml.money}万円</span>
            </div>
            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>年俸{ml.salary}万円/年（毎月{Math.round(ml.salary / 12)}万円が振り込まれます・生活費/税 -{mlLivingCost(ml)}万/月）</div>
            <div style={{ display: "flex", alignItems: "center", gap: T.space.sm, marginTop: T.space.sm }}>
              <span style={{ fontSize: T.size.caption, color: T.color.sub }}>疲労</span>
              <div style={{ width: 90 }}><FatigueBar v={r.fatigue} /></div>
              <span style={{ fontSize: T.size.caption, color: T.color.sub }}>フォーム <span style={{ color: T.color.text }}>{Math.round(r.form ?? 50)}</span></span>
            </div>
          </div>

          <div style={{ display: "flex", gap: T.space.lg, marginBottom: T.space.md, borderBottom: `1px solid ${T.color.rule}`, paddingBottom: T.space.sm }}>
            {CATS.map(([k, label]) => (
              <button key={k} onClick={() => setMl(x => ({ ...x, shopCat: k }))}
                style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: FONT_DOT, fontSize: T.size.body, color: shopCat === k ? T.color.accent : T.color.sub }}>{label}</button>
            ))}
          </div>

          {shopCat === "parts" && (
            <>
              <Section title="マシンパーツ" right="クラス昇格で上位解禁">
                {Object.entries(PARTS).map(([pid, p], i) => {
                  const lockedByClass = p.tier > ml.classIdx + 1;
                  return (
                    <ShopRow key={pid} first={i === 0}
                      label={p.label} countLabel="未装着" count={Math.max(0, availPartsMl(pid))}
                      detail={`${SLOT_LABEL[p.slot]}・${Object.entries(p.ab).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join(" / ")}`}
                      locked={lockedByClass ? `${CLASSES[p.tier - 1].id}で解禁` : null}
                      buyLabel={lockedByClass ? null : `${p.price}万`} buyDisabled={ml.money < p.price} onBuy={() => mlBuyPart(pid)} />
                  );
                })}
              </Section>

              <div style={{ display: "flex", gap: T.space.sm, marginTop: `-${T.space.sm}px`, marginBottom: T.space.md, flexWrap: "wrap" }}>
                {PART_SLOTS.map(slot => (
                  <span key={slot} style={{ display: "inline-flex", alignItems: "center", gap: T.space.xs, fontSize: T.size.caption }}>
                    <span style={{ color: T.color.sub }}>{SLOT_LABEL[slot]}:</span>
                    <select value={r.parts[slot] || ""} onChange={e => mlSetPart(slot, e.target.value)}
                      style={{ background: T.color.surfaceUp, color: T.color.text, border: `1px solid ${T.color.rule}`, fontFamily: FONT_DOT, fontSize: T.size.caption, padding: "3px 5px", maxWidth: 140 }}>
                      <option value="">— なし —</option>
                      {Object.entries(PARTS).filter(([pid, p]) => p.slot === slot && (availPartsMl(pid) > 0 || r.parts[slot] === pid))
                        .map(([pid, p]) => <option key={pid} value={pid}>{p.label}</option>)}
                    </select>
                  </span>
                ))}
              </div>

              <Section title="装着中パーツの強化" right={`買い切り・Lv${maxLv}まで`}>
                {PART_SLOTS.filter(slot => r.parts[slot]).map((slot, i) => {
                  const pid = r.parts[slot];
                  const p = PARTS[pid];
                  const lv = (r.partLv && r.partLv[slot]) || 0;
                  const maxed = lv >= maxLv;
                  const cost = maxed ? null : ML_PART_UPGRADE_COST[lv];
                  return (
                    <ShopRow key={slot} first={i === 0}
                      label={p.label} countLabel="Lv" count={`${lv}/${maxLv}`}
                      detail={Object.entries(p.ab).map(([k, v]) => `${AB_LABEL[k]}+${Math.round(v * (1 + ML_PART_LV_MUL * lv) * 10) / 10}`).join(" / ")}
                      locked={maxed ? "最大強化" : null}
                      buyLabel={maxed ? null : `${cost}万`} buyDisabled={ml.money < cost} onBuy={() => mlUpgradePart(slot)} />
                  );
                })}
                {PART_SLOTS.every(slot => !r.parts[slot]) && <Item first label="—" value="" detail="パーツを装着すると、ここで強化できます" />}
              </Section>
            </>
          )}

          {shopCat === "items" && (
            <>
              <Section title="消耗品" right="在庫制">
                {Object.entries(ML_STOCK_ITEMS).map(([k, it], i) => (
                  <ShopRow key={k} first={i === 0}
                    label={it.label} countLabel="所持" count={ml.stock[k] || 0} detail={it.desc}
                    secondaryLabel="使う" onSecondary={() => mlUseStockConfirm(k)} secondaryDisabled={(ml.stock[k] || 0) <= 0}
                    buyLabel={`${it.price}万`} buyDisabled={ml.money < it.price} onBuy={() => mlBuyStock(k)} />
                ))}
              </Section>

              <Section title="私設強化合宿" right="何度でも可">
                <ShopRow first label="私設強化合宿"
                  detail={`資金を注ぎ込み${AB_LABEL[r.focus]}を中心に鍛える（${AB_LABEL[r.focus]}+6・他+2、疲労+12）。伸びしろが尽きた選手には効きにくい`}
                  buyLabel={`${mlPrivateCampCost(ml)}万で実施`} buyDisabled={ml.money < mlPrivateCampCost(ml)} onBuy={mlPrivateCamp} />
              </Section>
            </>
          )}

          {shopCat === "perm" && (
            <>
              <Section title="永続トレーニング用品" right="買い切り">
                {Object.entries(ML_GEAR).map(([k, it], i) => (
                  <ShopRow key={k} first={i === 0} label={it.label} detail={it.desc}
                    locked={ml.gear[k] ? "購入済み" : null}
                    buyLabel={ml.gear[k] ? null : `${it.price}万`} buyDisabled={ml.money < it.price} onBuy={() => mlBuyGear(k)} />
                ))}
              </Section>

              <Section title="車" right="レースの疲労蓄積を軽減">
                {ML_CARS.map((c, i) => (
                  <ShopRow key={i} first={i === 0} label={c.label} detail={c.desc}
                    badge={ml.carLv === i ? "所有中" : null}
                    buyLabel={ml.carLv >= i ? null : `${c.price}万`} buyDisabled={ml.money < c.price || ml.carLv !== i - 1} onBuy={mlBuyCar} />
                ))}
              </Section>

              <Section title="家" right="毎月の疲労回復を底上げ">
                {ML_HOUSES.map((h, i) => (
                  <ShopRow key={i} first={i === 0} label={h.label} detail={h.desc}
                    badge={ml.houseLv === i ? "所有中" : null}
                    buyLabel={ml.houseLv >= i ? null : `${h.price}万`} buyDisabled={ml.money < h.price || ml.houseLv !== i - 1} onBuy={mlBuyHouse} />
                ))}
              </Section>

              <Section title="才能開花プログラム" right="成長力を1段階アップ">
                {mlGrowthPowRevealed(ml) ? (
                  <ShopRow first label="成長力" countLabel="現在" count={r.growthPow} detail="現在の段階に応じて価格が上がる、後戻りできない買い切り強化"
                    locked={GROWTHPOW_ORDER.indexOf(r.growthPow) >= GROWTHPOW_ORDER.length - 1 ? "最高段階" : null}
                    buyLabel={GROWTHPOW_ORDER.indexOf(r.growthPow) >= GROWTHPOW_ORDER.length - 1 ? null : `${ML_GROWTH_POW_UP_PRICE[r.growthPow]}万`}
                    buyDisabled={ml.money < ML_GROWTH_POW_UP_PRICE[r.growthPow]} onBuy={mlBuyGrowthPowUp} />
                ) : (
                  <Item first label="成長力" value="???" valueColor={T.color.sub} detail="デビュー3年目に成長力が判明してから購入できます" />
                )}
              </Section>

              <Section title="成長タイプ変更" right="キャリアで1回限り">
                {ml.player.growthShiftUsed ? (
                  <Item first label="成長タイプ" value={GROWTH[r.growth]?.label ?? r.growth} valueColor={T.color.sub} detail="使用済み" />
                ) : (() => {
                  const gIdx = GROWTH_ORDER.indexOf(r.growth);
                  const affordable = ml.money >= ML_GROWTH_SHIFT_PRICE;
                  return (
                    <ShopRow first label="成長タイプ" countLabel="現在" count={GROWTH[r.growth]?.label ?? r.growth}
                      detail="早熟寄り・晩成寄りのどちらか一方向のみ、キャリアで1回だけ選び直せる"
                      secondaryLabel={`早熟寄りへ（${ML_GROWTH_SHIFT_PRICE}万）`} onSecondary={() => mlBuyGrowthShift(-1)} secondaryDisabled={!affordable || gIdx <= 0}
                      buyLabel={`晩成寄りへ（${ML_GROWTH_SHIFT_PRICE}万）`} onBuy={() => mlBuyGrowthShift(1)} buyDisabled={!affordable || gIdx < 0 || gIdx >= GROWTH_ORDER.length - 1} />
                  );
                })()}
              </Section>
            </>
          )}

          <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>選手画面に戻る</QuietBtn>
        </Screen>
      );
    }

    if (ml.screen === "mylife_event" && ml.pendingEvent) {
      const ev = ml.pendingEvent;
      return mlWrap(
        <Screen>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>できごと</div>
          <div style={{ fontSize: T.size.title, marginTop: T.space.xs, marginBottom: T.space.md }}>{ev.title}</div>
          <Prose>{ev.text}</Prose>
          {ev.choices.map((c, i) => (
            <QuietBtn key={i} onClick={() => mlResolveEvent(i)}>{c.label}</QuietBtn>
          ))}
        </Screen>
      );
    }

    if (ml.screen === "mylife_protege_event" && ml.pendingProtegeEvent) {
      const ev = ml.pendingProtegeEvent;
      const t = ml.protege ? TYPES[ml.protege.type] : null;
      return mlWrap(
        <Screen>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>弟子との時間</div>
          <div style={{ fontSize: T.size.title, marginTop: T.space.xs }}>{ev.title}</div>
          {ml.protege && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>{ml.protege.name}・{t?.label}</div>}
          <div style={{ marginTop: T.space.md }}><Prose>{ev.text}</Prose></div>
          {ev.choices.map((c, i) => (
            <QuietBtn key={i} onClick={() => mlResolveProtegeEvent(i)}>{c.label}</QuietBtn>
          ))}
        </Screen>
      );
    }

    if (ml.screen === "mylife_event_result") return mlWrap(
      <Screen>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>結果</div>
        <ResultText>{ml.eventResultText}</ResultText>
        {ml.eventAdvanced
          ? <PrimaryBtn onClick={() => setMl(s => ({ ...s, eventAdvanced: false, screen: "mylife_main" }))}>戻る →</PrimaryBtn>
          : <PrimaryBtn onClick={() => mlAdvanceMonth("event")}>翌月へ進む →</PrimaryBtn>}
      </Screen>
    );

    if (ml.screen === "mylife_offseason" && ml.pendingOffseason) {
      return mlWrap(
        <Screen>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>オフシーズン</div>
          <div style={{ marginTop: T.space.sm, marginBottom: T.space.md }}><Prose>新シーズンまでの間、どのように過ごしますか？</Prose></div>
          {ML_OFFSEASON_CHOICES.map((c, i) => (
            <div key={c.key} style={{ background: T.color.surface, padding: T.space.md, marginBottom: T.space.sm }}>
              <div style={{ fontSize: T.size.body }}>{c.label}</div>
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2, lineHeight: 1.6 }}>{c.desc}</div>
              <div style={{ marginTop: T.space.sm }}><QuietBtn onClick={() => mlResolveOffseason(i)}>これを選ぶ</QuietBtn></div>
            </div>
          ))}
        </Screen>
      );
    }

    if (ml.screen === "mylife_offseason_result") return mlWrap(
      <Screen>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>結果</div>
        <ResultText>{ml.offseasonResultText}</ResultText>
        <PrimaryBtn onClick={mlContinueAfterOffseason}>続ける →</PrimaryBtn>
      </Screen>
    );

    if (ml.screen === "mylife_crossroads" && ml.pendingCrossroads) {
      const cr = ML_CROSSROADS[ml.pendingCrossroads.key];
      return mlWrap(
        <Screen>
          <div style={{ fontSize: T.size.title, marginBottom: T.space.md }}>{cr.title}</div>
          <Prose>{cr.text}</Prose>
          {cr.choices.map((c, i) => (
            <QuietBtn key={i} onClick={() => mlResolveCrossroads(i)}>{c.label}</QuietBtn>
          ))}
        </Screen>
      );
    }

    if (ml.screen === "mylife_crossroads_result") return mlWrap(
      <Screen>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>結果</div>
        <ResultText>{ml.crossroadsResultText}</ResultText>
        <PrimaryBtn onClick={mlContinueAfterCrossroads}>続ける →</PrimaryBtn>
      </Screen>
    );

    if (ml.screen === "mylife_contract" && ml.contractOffers) return mlWrap(
      <Screen>
        <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{ml.biddingWar ? "争奪戦！ — 移籍オファー" : "契約 — 移籍オファー"}</div>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs, marginBottom: T.space.md, lineHeight: 1.7 }}>
          {ml.biddingWar
            ? "圧倒的な成績にチーム間で争奪戦が勃発。各チームが競って年俸・契約金・エース確約を吊り上げてきています。最高の条件を選び取りましょう。"
            : "好成績を残したあなたに、複数チームから声がかかっています。条件を見比べて来季の所属先を選んでください。"}
        </div>
        {ml.contractOffers.map((offer, i) => {
          const isStay = i === 0;
          const previewSalary = Math.round(ml.salary * offer.salaryMul);
          const classDelta = offer.tier - ml.classIdx;
          return (
            <div key={i} style={{ background: T.color.surface, padding: T.space.md, marginBottom: T.space.sm }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: T.space.sm, flexWrap: "wrap" }}>
                <span style={{ fontSize: T.size.caption, color: T.color.accent }}>{CLASSES[offer.tier].id}</span>
                <span style={{ fontSize: T.size.head }}>{offer.team}{isStay ? "（残留）" : "（移籍）"}</span>
                {classDelta > 0 && <span style={{ fontSize: T.size.caption, color: T.color.good }}>昇格</span>}
                {classDelta < 0 && <span style={{ fontSize: T.size.caption, color: T.color.bad }}>降格</span>}
              </div>
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>
                年俸 {previewSalary}万円{offer.bonus > 0 && <span style={{ color: T.color.accent }}>／契約金 +{offer.bonus}万円</span>}
              </div>
              {offer.aceGuarantee && <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: 2 }}>来季開幕戦はエースとして起用を確約</div>}
              <div style={{ marginTop: T.space.sm }}>
                <QuietBtn onClick={() => mlChooseTeam(offer)}>この条件で契約する</QuietBtn>
              </div>
            </div>
          );
        })}
      </Screen>
    );

    // v28: 引退勧告の駆け引き画面

}
