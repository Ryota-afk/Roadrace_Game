// mylife.jsx より分割（Step8）：ショップ・イベント系（shop/event/protege_event/offseason/crossroads/contract）
// 第13弾Phase3-D-2: 新トークン(T/FONT_DOT)へ全面移行。FatigueBar（panels.jsx）は
// season側と共有のため中身は据え置き（Phase3-D-3担当）。
import React from "react";
import { FatigueBar } from "../../components/panels.jsx";
import { ChipRow, Item, PrimaryBtn, Prose, QuietBtn, Screen, Section, ShopBtn, ShopRow, TypeChip } from "../../components/kit.jsx";
import { ABILITIES, AB_LABEL, GROWTH, TYPES } from "../../data/abilities.js";
import { CLASSES, GROWTHPOW_ORDER, GROWTH_ORDER } from "../../data/progression.js";
import {
  ML_COACH_MAX_BY_CLASS, ML_COACH_SALARY, ML_COACH_SIGNING, ML_COACH_SLOTS_BY_CLASS, ML_DEV_PROJECT, ML_GROWTH_POW_UP_PRICE,
  ML_GROWTH_SHIFT_PRICE, ML_PART_UPGRADE_COST, ML_PART_LV_MAX, ML_PART_LV_MUL, ML_SCI_PROJECT,
} from "../../data/gear.js";
import { FONT_DOT, T } from "../../data/theme.js";
import {
  ML_AB_COACH_KEY, ML_CARS, ML_CROSSROADS, ML_GEAR, ML_HOUSES, ML_OFFSEASON_CHOICES, ML_STOCK_ITEMS, SLOT_LABEL,
  mlBadgeKind, mlBadgeSlots, mlDevProjectSuccessRate, mlGrowthPowRevealed, mlLivingCost, mlPrivateCampCost,
  mlProjectMonthsElapsed, mlSciProjectSuccessRate, mlSlotUsed,
} from "../../logic/support.js";
import { PARTS, PART_SLOTS, partEffectParts, resolvePart } from "../../data/parts.js";

// mlEventResultText等は複数行の生成テキスト（\n区切り）を含むため、Proseではなく
// whiteSpace:pre-wrapを明示したこの専用ブロックで改行を保持する。
const ResultText = ({ children }) => (
  <div style={{ fontSize: T.size.body, color: T.color.text, lineHeight: 1.9, padding: T.space.md, background: T.color.surface, marginBottom: T.space.md, whiteSpace: "pre-wrap" }}>{children}</div>
);

// 第34弾: 車・家は階段式（買えるのは常に次の1段だけ）なので、全段を並べず
// 「今の段階＋次の1段」だけの1枚パネルに畳む（devlog/wave34.md）。
// 第71弾(devlog/wave71.md): 旧`note`（固定の一般論。例「レースの疲労蓄積を軽減」）は
// 直下のnext.descと常に同内容を言い換えているだけの重複だった（実測で判明）。
// 所有中の効果はcur.descで具体的な数値付きに置き換え、未所有時（cur無し）は
// next側の1行に効果が出るためここには何も出さない。
const TierPanel = ({ title, items, lv, money, onBuy }) => {
  const cur = lv >= 0 ? items[lv] : null;
  const next = lv < items.length - 1 ? items[lv + 1] : null;
  return (
    <div style={{ background: T.color.surface, padding: T.space.md, marginBottom: T.space.sm }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: T.size.head }}>{title}</span>
        <span style={{ fontSize: T.size.body, color: cur ? T.color.accent : T.color.sub }}>{cur ? cur.label : "未所有"}</span>
      </div>
      {cur && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>{cur.desc}</div>}
      {next ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: T.space.sm, gap: T.space.sm }}>
          <span style={{ fontSize: T.size.caption, color: T.color.text }}>{next.label}　{next.desc}</span>
          <ShopBtn onClick={onBuy} disabled={money < next.price} minWidth={64}>{next.price}万</ShopBtn>
        </div>
      ) : (
        <div style={{ textAlign: "right", fontSize: T.size.caption, color: T.color.accent, marginTop: T.space.sm }}>最上位</div>
      )}
    </div>
  );
};

export function renderMyLifeEventScreens(ctx) {
  const {
    ml, mlAdvanceMonth, mlBuyCar, mlBuyGear, mlBuyGrowthPowUp, mlBuyGrowthShift, mlBuyHouse, mlBuyPart, mlBuyStock, mlChooseTeam,
    mlContinueAfterCrossroads, mlContinueAfterOffseason, mlDismissCoach, mlHireCoach, mlPrivateCamp, mlResolveCrossroads, mlResolveEvent,
    mlResolveProtegeEvent, mlResolveOffseason, mlSetPart, mlUpgradePart, mlUseStockConfirm, mlWrap, setMl,
    mlStartDevProject, mlAddDevProject, mlFinishDevProject, mlStartSciProject, mlAddSciProject, mlFinishSciProject, mlSciConfirmSwap,
  } = ctx;
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
            {/* 第71弾(devlog/wave71.md): 「振り込まれる額・生活費/税」を別々に言う代わりに
                差引済みの月収支を1つ出す（3タブ共通ヘッダで毎回38字を消費していた）。 */}
            {(() => {
              const net = Math.round(ml.salary / 12) - mlLivingCost(ml);
              return (
                <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>
                  毎月の収支 <span style={{ color: net >= 0 ? T.color.good : T.color.bad }}>{net >= 0 ? "+" : ""}{net}万</span>（年俸{ml.salary}万）
                </div>
              );
            })()}
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

          {shopCat === "parts" && (() => {
            const tier2Count = Object.values(PARTS).filter(p => p.tier === 2).length;
            const tier3Count = Object.values(PARTS).filter(p => p.tier === 3).length;
            // 第71弾(devlog/wave71.md): 「上位パーツは」「が解禁されます」の定型句を削り、
            // 「クラス」も1箇所へ集約（元は各項目に付いていた）。
            const lockedTierMsgs = [];
            if (ml.classIdx < 1) lockedTierMsgs.push(`${CLASSES[1].id}で${tier2Count}点`);
            if (ml.classIdx < 2) lockedTierMsgs.push(`${CLASSES[2].id}で${tier3Count}点`);
            return (
              <>
                {PART_SLOTS.map(slot => {
                  const pid = r.parts[slot];
                  // 第88弾: ワンオフ機材（custom_で始まるid）は静的PARTSに存在しないため
                  // resolvePart経由でr.customPartsを先に見る（data/parts.js参照）
                  const p = pid ? resolvePart(r.customParts, pid) : null;
                  const lv = (r.partLv && r.partLv[slot]) || 0;
                  const isOpen = ml.shopSlot === slot;
                  const avail = Object.entries(PARTS).filter(([, pp]) => pp.slot === slot && pp.tier <= ml.classIdx + 1);
                  const minPrice = avail.length ? Math.min(...avail.map(([, pp]) => pp.price)) : null;
                  // 第94弾(devlog/wave94.md): 一点物（customParts）は静的PARTSに無いため
                  // avail一覧に一度も現れず、強化ボタンが出ない・履き替えると二度と
                  // 装着できなくなっていた。所持しているもの（一点物＋所持中の静的パーツ）と
                  // カタログ（未所持）の2グループに分け、一覧へ一点物も並べる。
                  const customForSlot = Object.entries(r.customParts || {}).filter(([, cp]) => cp.slot === slot);
                  const entries = [
                    ...avail.map(([apid, ap]) => ({ id: apid, part: ap, isCustom: false })),
                    ...customForSlot.map(([cpid, cp]) => ({ id: cpid, part: cp, isCustom: true })),
                  ];
                  // プラス合計（マイナスは無視）。装着中の行だけ現在のLv倍率をかける
                  // （partLvはスロット単位のため、装着していない手持ちには効いていない＝
                  // 現行のsim/effects.jsの挙動と一致させる）。
                  const sortKey = (part, isEquipped) => {
                    const mul = isEquipped ? 1 + ML_PART_LV_MUL * lv : 1;
                    return Object.values(part.ab || {}).reduce((a, v) => a + Math.max(0, v), 0) * mul;
                  };
                  entries.forEach(e => { e.owned = e.isCustom || e.id === pid || availPartsMl(e.id) > 0; });
                  const ordered = [
                    ...entries.filter(e => e.owned).sort((a, b) => {
                      if (a.id === pid) return -1;
                      if (b.id === pid) return 1;
                      return sortKey(b.part, false) - sortKey(a.part, false);
                    }),
                    ...entries.filter(e => !e.owned).sort((a, b) => sortKey(b.part, false) - sortKey(a.part, false)),
                  ];
                  return (
                    <div key={slot} style={{ marginBottom: T.space.sm }}>
                      <button onClick={() => setMl(x => ({ ...x, shopSlot: isOpen ? null : slot }))} style={{
                        display: "block", width: "100%", textAlign: "left", border: "none", cursor: "pointer", fontFamily: FONT_DOT,
                        padding: "10px 12px", background: isOpen ? "#2A2438" : T.color.surface,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={{ fontSize: T.size.head, color: T.color.text }}>{SLOT_LABEL[slot]}</span>
                          <span style={{ fontSize: T.size.body }}>
                            {p ? <span style={{ color: T.color.accent }}>{p.label}　Lv{lv}　›</span> : <span style={{ color: T.color.sub }}>未装着　›</span>}
                          </span>
                        </div>
                        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>
                          {p
                            ? partEffectParts(p, 1 + ML_PART_LV_MUL * lv, AB_LABEL).join(" / ")
                            : (minPrice != null ? `買える${avail.length}点　${minPrice}万〜` : "解禁されているパーツがありません")}
                        </div>
                      </button>
                      {isOpen && (
                        <div style={{ marginTop: T.space.xs }}>
                          {ordered.map(({ id: apid, part: ap, owned }, i) => {
                            if (apid === pid) {
                              const maxed = lv >= maxLv;
                              const cost = maxed ? null : ML_PART_UPGRADE_COST[lv];
                              return (
                                <ShopRow key={apid} first={i === 0} label={ap.label} badge={`装着中 Lv${lv}`}
                                  detail={partEffectParts(ap, 1 + ML_PART_LV_MUL * lv, AB_LABEL).join(" / ")}
                                  locked={maxed ? `Lv${maxLv} 最大` : null}
                                  buyLabel={maxed ? null : `強化 ${cost}万`} buyDisabled={ml.money < cost} onBuy={() => mlUpgradePart(slot)} />
                              );
                            }
                            return (
                              <ShopRow key={apid} first={i === 0} label={ap.label}
                                detail={partEffectParts(ap, 1, AB_LABEL).join(" / ")}
                                buyLabel={owned ? "装着する" : `${ap.price}万`}
                                buyDisabled={owned ? false : ml.money < ap.price}
                                onBuy={() => owned ? mlSetPart(slot, apid) : mlBuyPart(apid)} />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {lockedTierMsgs.length > 0 && (
                  <div style={{ fontSize: T.size.caption, color: T.color.sub, textAlign: "center", marginBottom: T.space.md }}>
                    クラス{lockedTierMsgs.join("・")} 解禁
                  </div>
                )}
              </>
            );
          })()}

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

              {/* 第88弾(devlog/wave88.md): ワンオフ機材の開発。「時間がかかる・結果が不確定・
                  終わったら何かが残る（失う）」プロジェクトの形。開発方針(尖らせる/まとめる)で
                  できあがるパーツの形を決める（確率分岐だけの運任せにしないための工夫）。 */}
              <Section title="ワンオフ機材の開発" right={ml.devProject ? undefined : "1件まで"}>
                {!ml.devProject ? (() => {
                  const slot = ml.uiDevSlot || "frame";
                  const policy = ml.uiDevPolicy || "broad";
                  return (
                    <>
                      <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.xs }}>自分専用の機材を作る（完成まで最短{ML_DEV_PROJECT.minMonths}ヶ月。注ぐほど成功率が上がるが、失敗すれば何も残らない）</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: T.space.xs }}>
                        <span style={{ fontSize: T.size.caption, color: T.color.sub }}>何を作るか</span>
                        <ChipRow value={slot} onChange={v => setMl(s => ({ ...s, uiDevSlot: v }))}
                          options={PART_SLOTS.map(k => ({ value: k, label: SLOT_LABEL[k] }))} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: T.space.sm }}>
                        <span style={{ fontSize: T.size.caption, color: T.color.sub }}>どう作るか</span>
                        <ChipRow value={policy} onChange={v => setMl(s => ({ ...s, uiDevPolicy: v }))}
                          options={[{ value: "broad", label: "まとめる" }, { value: "sharp", label: "尖らせる" }]} />
                      </div>
                      <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>
                        {policy === "sharp" ? `尖らせる：ひとつの能力を大きく伸ばす代わりに、別の能力が落ちる（成功率−${Math.round(ML_DEV_PROJECT.sharpPenalty * 100)}%）` : "まとめる：複数の能力に小さく伸ばす。マイナスは無い"}
                      </div>
                      <ShopRow first label="開発に着手する"
                        buyLabel={`${ML_DEV_PROJECT.initCost}万で始める`} buyDisabled={ml.money < ML_DEV_PROJECT.initCost}
                        onBuy={() => mlStartDevProject(slot, policy)} />
                    </>
                  );
                })() : (() => {
                  const p = ml.devProject;
                  const elapsed = mlProjectMonthsElapsed(p, ml.year, ml.month);
                  const rate = Math.round(mlDevProjectSuccessRate(p, ML_DEV_PROJECT) * 100);
                  const ready = elapsed >= ML_DEV_PROJECT.minMonths;
                  return (
                    <>
                      <ShopRow first label={`${SLOT_LABEL[p.slot]}・${p.policy === "sharp" ? "尖らせる" : "まとめる"}`}
                        detail={`経過${elapsed}ヶ月／投資${p.invested}万円　成功率 ${rate}%`}
                        secondaryLabel="+200万" onSecondary={() => mlAddDevProject(200)} secondaryDisabled={ml.money < 200}
                        buyLabel="+500万" buyDisabled={ml.money < 500} onBuy={() => mlAddDevProject(500)} />
                      {ready ? (
                        <ShopRow label="完成させる" buyLabel="完成させる" onBuy={mlFinishDevProject} />
                      ) : (
                        <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.xs}px 0` }}>完成させるまであと{ML_DEV_PROJECT.minMonths - elapsed}ヶ月</div>
                      )}
                    </>
                  );
                })()}
              </Section>

              {/* 第88弾: 科学トレーニング。成功しても特殊能力の枠を使うため、枠が満杯なら
                  必ず1つ手放す（「今回は見送る」は用意しない・ユーザー確定）。失敗すると
                  悪特性を負うが、これはバッジ枠を消費しない（createChar.jsの前例に倣う）。 */}
              <Section title="科学トレーニング" right={ml.sciProject || ml.sciPendingId ? undefined : "1件まで"}>
                {ml.sciPendingId ? (() => {
                  const id = ml.sciPendingId;
                  const swapCandidates = (r.abilities || []).filter(hid => ABILITIES[hid] && mlBadgeKind(hid) !== "taishitsu");
                  return (
                    <>
                      <div style={{ fontSize: T.size.body, color: T.color.text, marginBottom: T.space.xs }}>身体が応えた——「{ABILITIES[id].label}」を身につけた</div>
                      <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>ただし持てるのは{mlBadgeSlots(ml)}つまで。ひとつ手放す必要がある</div>
                      {swapCandidates.map((hid, i) => (
                        <div key={hid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${T.space.xs}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                          <span style={{ fontSize: T.size.body, color: T.color.text }}>{ABILITIES[hid].label}</span>
                          <ShopBtn onClick={() => mlSciConfirmSwap(hid)} outline>手放す</ShopBtn>
                        </div>
                      ))}
                    </>
                  );
                })() : !ml.sciProject ? (
                  <ShopRow first label="トレーニングを始める"
                    detail={`最新の科学で身体を作り替える（完成まで最短${ML_SCI_PROJECT.minMonths}ヶ月。成功すれば特殊能力を得るが、失敗すれば体に不調を抱える）`}
                    buyLabel={`${ML_SCI_PROJECT.initCost}万で始める`} buyDisabled={ml.money < ML_SCI_PROJECT.initCost}
                    onBuy={mlStartSciProject} />
                ) : (() => {
                  const p = ml.sciProject;
                  const elapsed = mlProjectMonthsElapsed(p, ml.year, ml.month);
                  const rate = Math.round(mlSciProjectSuccessRate(p, ML_SCI_PROJECT) * 100);
                  const ready = elapsed >= ML_SCI_PROJECT.minMonths;
                  return (
                    <>
                      <ShopRow first label="科学トレーニング"
                        detail={`経過${elapsed}ヶ月／投資${p.invested}万円　成功率 ${rate}%`}
                        secondaryLabel="+300万" onSecondary={() => mlAddSciProject(300)} secondaryDisabled={ml.money < 300}
                        buyLabel="+800万" buyDisabled={ml.money < 800} onBuy={() => mlAddSciProject(800)} />
                      {ready ? (
                        <ShopRow label="結果を見る" buyLabel="結果を見る" onBuy={mlFinishSciProject} />
                      ) : (
                        <div style={{ fontSize: T.size.caption, color: T.color.sub, padding: `${T.space.xs}px 0` }}>完了まであと{ML_SCI_PROJECT.minMonths - elapsed}ヶ月</div>
                      )}
                    </>
                  );
                })()}
              </Section>
            </>
          )}

          {shopCat === "perm" && (
            <>
              <Section title="永続トレーニング用品" right="買い切り">
                {["roller", "monitor", "chef"].map((k, i) => {
                  const it = ML_GEAR[k];
                  return (
                    <ShopRow key={k} first={i === 0} label={it.label} detail={it.desc}
                      locked={ml.gear[k] ? "購入済み" : null}
                      buyLabel={ml.gear[k] ? null : `${it.price}万`} buyDisabled={ml.money < it.price} onBuy={() => mlBuyGear(k)} />
                  );
                })}
              </Section>

              {/* 第37弾: 第36弾のコーチ節を圧縮（案2・devlog/wave37.md）。雇用中リストを廃止し、
                  チップを押すと直下に操作行が1行だけ開く（ホームのレース作戦・練習メニューと
                  同じ「押すと開く」の型）。coachLvはmonth.js/shop.jsと同じ実効Lvの式
                  （旧セーブのgear[coachKey]買い切りはLv1相当として扱う）。 */}
              {(() => {
                const abKeys = Object.keys(ML_AB_COACH_KEY);
                const coachLv = (k) => Math.max(ml.gear[ML_AB_COACH_KEY[k]] ? 1 : 0, (ml.coaches && ml.coaches[k]) || 0);
                const maxLv = ML_COACH_MAX_BY_CLASS[ml.classIdx] ?? 0;
                const slots = ML_COACH_SLOTS_BY_CLASS[ml.classIdx] ?? 0;
                const hiredKeys = abKeys.filter(k => coachLv(k) > 0);
                const hired = hiredKeys.length;
                const slotsFull = hired >= slots;
                const totalSalary = hiredKeys.reduce((a, k) => a + (ML_COACH_SALARY[coachLv(k)] || 0), 0);
                const sel = ml.uiCoachSel && abKeys.includes(ml.uiCoachSel) ? ml.uiCoachSel : null;
                const selLv = sel ? coachLv(sel) : 0;
                const selectCoach = (k) => setMl(s => ({ ...s, uiCoachSel: s.uiCoachSel === k ? null : k }));
                const dismissCoach = (k) => { mlDismissCoach(k); setMl(s => ({ ...s, uiCoachSel: null })); };
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, color: T.color.accent, marginBottom: T.space.sm }}>
                      <span>専門コーチ</span>
                      <span>{hired} / {slots}人{totalSalary > 0 ? `・月${totalSalary}万` : ""}</span>
                    </div>
                    <div style={{ background: T.color.surface, padding: T.space.md, marginBottom: T.space.md }}>
                      <div style={{ fontSize: T.size.caption, color: T.color.sub }}>昇格させるほど練習効果が高まる（月給制・契約金{ML_COACH_SIGNING}万）</div>
                      <div style={{ display: "flex", gap: T.space.xs, flexWrap: "wrap", marginTop: T.space.sm }}>
                        {abKeys.map(k => {
                          const lv = coachLv(k);
                          const capped = lv >= maxLv;
                          const hiredHere = lv > 0;
                          const isSel = sel === k;
                          return (
                            <button key={k} onClick={() => selectCoach(k)} style={{
                              border: "none", cursor: "pointer", fontFamily: FONT_DOT, fontSize: T.size.body,
                              padding: "6px 9px",
                              background: isSel ? T.color.action : T.color.surfaceUp,
                              color: isSel ? T.color.ink : hiredHere ? T.color.text : T.color.sub,
                            }}>
                              {AB_LABEL[k]}{hiredHere && ` Lv${lv}`}{capped && <span style={{ color: isSel ? T.color.ink : T.color.accent }}>（上限）</span>}
                            </button>
                          );
                        })}
                      </div>
                      {sel && (() => {
                        const capped = selLv >= maxLv;
                        const hiredHere = selLv > 0;
                        let label, note = null, buttons = null;
                        if (hiredHere && !capped) {
                          label = `${AB_LABEL[sel]}コーチ Lv${selLv}`;
                          note = `月給${ML_COACH_SALARY[selLv]}万`;
                          buttons = (
                            <>
                              <ShopBtn onClick={() => mlHireCoach(sel)}>{`Lv${selLv + 1}へ 月給${ML_COACH_SALARY[selLv + 1]}万`}</ShopBtn>
                              <ShopBtn onClick={() => dismissCoach(sel)} outline>解雇</ShopBtn>
                            </>
                          );
                        } else if (hiredHere && capped) {
                          label = `${AB_LABEL[sel]}コーチ Lv${selLv}`;
                          note = <>月給{ML_COACH_SALARY[selLv]}万　<span style={{ color: T.color.accent }}>クラス上限</span></>;
                          buttons = <ShopBtn onClick={() => dismissCoach(sel)} outline>解雇</ShopBtn>;
                        } else if (slotsFull) {
                          label = "雇用枠が満員です";
                          note = ml.classIdx !== 2 ? "上位クラスへ昇格すると枠が増えます" : null;
                        } else if (ml.money < ML_COACH_SIGNING) {
                          label = `契約金${ML_COACH_SIGNING}万が足りません`;
                        } else {
                          label = `${AB_LABEL[sel]}コーチを雇う`;
                          note = `契約金${ML_COACH_SIGNING}万・月給${ML_COACH_SALARY[1]}万`;
                          buttons = <ShopBtn onClick={() => mlHireCoach(sel)}>雇う</ShopBtn>;
                        }
                        return (
                          <div style={{ background: T.color.surfaceUp, padding: "8px 10px", marginTop: T.space.sm, display: "flex", justifyContent: "space-between", alignItems: "center", gap: T.space.sm }}>
                            <span>
                              <span style={{ fontSize: T.size.body }}>{label}</span>
                              {note && <span style={{ fontSize: T.size.caption, color: T.color.sub, marginLeft: 6 }}>{note}</span>}
                            </span>
                            {buttons && <span style={{ display: "flex", gap: T.space.xs, flex: "none" }}>{buttons}</span>}
                          </div>
                        );
                      })()}
                    </div>
                  </>
                );
              })()}

              <TierPanel title="車" items={ML_CARS} lv={ml.carLv} money={ml.money} onBuy={mlBuyCar} />

              <TierPanel title="家" items={ML_HOUSES} lv={ml.houseLv} money={ml.money} onBuy={mlBuyHouse} />

              <Section title="才能開花プログラム" right="成長力を1段階アップ">
                {mlGrowthPowRevealed(ml) ? (
                  <ShopRow first label="成長力" countLabel="現在" count={r.growthPow} detail="現在の段階に応じて価格が上がる、後戻りできない買い切り強化"
                    locked={GROWTHPOW_ORDER.indexOf(r.growthPow) >= GROWTHPOW_ORDER.length - 1 ? "最高段階" : null}
                    buyLabel={GROWTHPOW_ORDER.indexOf(r.growthPow) >= GROWTHPOW_ORDER.length - 1 ? null : `${ML_GROWTH_POW_UP_PRICE[r.growthPow]}万`}
                    buyDisabled={ml.money < ML_GROWTH_POW_UP_PRICE[r.growthPow]} onBuy={mlBuyGrowthPowUp} />
                ) : (
                  <Item first label="成長力" value="???" valueColor={T.color.sub} detail="3年目に判明後" />
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
                      detail="一方向のみ"
                      secondaryLabel={`早熟寄りへ（${ML_GROWTH_SHIFT_PRICE}万）`} onSecondary={() => mlBuyGrowthShift(-1)} secondaryDisabled={!affordable || gIdx <= 0}
                      buyLabel={`晩成寄りへ（${ML_GROWTH_SHIFT_PRICE}万）`} onBuy={() => mlBuyGrowthShift(1)} buyDisabled={!affordable || gIdx < 0 || gIdx >= GROWTH_ORDER.length - 1} />
                  );
                })()}
              </Section>
            </>
          )}

          <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 戻る</QuietBtn>
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
          {ml.protege && (
            <div style={{ display: "flex", alignItems: "center", gap: T.space.xs, marginTop: T.space.xs }}>
              <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{ml.protege.name}</span>
              {t && <TypeChip type={ml.protege.type} />}
            </div>
          )}
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
          ? <PrimaryBtn onClick={() => setMl(s => ({ ...s, eventAdvanced: false, screen: "mylife_main" }))}>← 戻る</PrimaryBtn>
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
