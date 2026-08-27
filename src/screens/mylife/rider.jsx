// 「選手」タブ（第13弾Phase3-A で新設）。
// Phase 2でホームの「その他」へ仮置きしていた選手の詳細——能力・コース適性・素質・
// 性格と成長・経歴——をここへ集約した。図の形（レーダー）はそのまま、フォントと色だけ
// 新トークンへ寄せている（ユーザー指示：「レーダーのままフォントのみ変更」）。
import React from "react";
import { DisciplineGrid } from "../../components/panels.jsx";
import { AbilitySoshitsuRadarPair } from "../../components/RadarChart.jsx";
import { RiderPortrait } from "../../components/RiderPortrait.jsx";
import { badgeTier, GOLD_REQS, overall, TIER_LADDER, TIER_LABEL } from "../../core/core.js";
import { ABILITIES, GROWTH, PERSONALITIES } from "../../data/abilities.js";
import { FONT_DOT, T } from "../../data/theme.js";
import { mlSelectedRace } from "../../domain/mylife/race.js";
import { ACQUIRE_REQS, FAVORS_TO_DISCIPLINE, growthPhase, mlBadgeKind, mlBadgeSlots, mlGrowthCap, mlGrowthCapFor, mlGrowthPowRevealed, mlSlotUsed, potentialHint, riderFlavorText } from "../../logic/support.js";
import { riderNickname } from "../../state/state.js";
import { BadgeTierMark, Item, QuietBtn, Screen, Section, ShopBtn, TypeChip } from "../../components/kit.jsx";

export function renderMyLifeRiderScreen(ctx) {
  const { ml, mlWrap, mlAcquireBadge, mlUnequipBadge, mlEquipBlood, setMl } = ctx;
  const r = ml.player;
  if (!r) return null;
  const race = mlSelectedRace(ml);
  const ph = growthPhase(r);
  const powRevealed = mlGrowthPowRevealed(ml);
  const cap = mlGrowthCap(ml.year, r, ml);
  // 第29弾(判断③): レーダーの外周＝能力別上限（脚質の得意は遠く・苦手は近く）。
  // 右下隅の「上限」数字は基準値capのまま。
  const capFor = (k) => mlGrowthCapFor(ml.year, r, ml, k);
  const pot = potentialHint(r, powRevealed);
  const abils = [...(r.abilities || [])];

  return mlWrap(
    <Screen>
      <div style={{ display: "flex", gap: T.space.md, alignItems: "flex-end", background: T.color.surface, padding: T.space.md, marginBottom: T.space.md }}>
        <div style={{ flex: "none" }}><RiderPortrait color={T.color.accent} size={64} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.size.title, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
          {riderNickname(r) && <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: T.space.xs }}>{riderNickname(r)}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: T.space.xs, marginTop: T.space.xs }}>
            <TypeChip type={r.type} />
            <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{r.age}歳</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div style={{ fontSize: T.size.display, lineHeight: 1, color: T.color.accent }}>{overall(r)}</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>総合力</div>
        </div>
      </div>

      <Section title="能力と素質" padded>
        <AbilitySoshitsuRadarPair r={r} cap={cap} size={140} capFor={capFor} />
      </Section>

      <Section title="コース適性" padded>
        <DisciplineGrid r={r} highlightKey={race?.tmpl?.favors ? (FAVORS_TO_DISCIPLINE[race.tmpl.favors] || "flat") : undefined} />
      </Section>

      <Section title="性格と成長" padded>
        <Item first label="性格" value={PERSONALITIES[r.personality]?.label || "普通"} />
        <Item label="成長型" value={GROWTH[r.growth]?.label} />
        <Item label="いまの時期" value={ph.tag} />
        <Item label="成長力" value={powRevealed ? r.growthPow : "3年目に判明"} />
        {/* pot.labelは「伸びしろ中」のように項目名を含むため、行の見出しと重複しないよう剥がす */}
        <Item label="伸びしろ" value={pot.label.replace(/^伸びしろ/, "")} />
        {r.talentCap ? <Item label="才能による上限" value={`+${r.talentCap}`} /> : null}
      </Section>

      {/* 第62弾(devlog/wave62.md): 宣言した目標バッジ（最大3件）はこれまでホームの「最も
          進んでいる1件」しか表示されず、残り2件はどこにも見えていなかった（実プレイで
          報告を受けて確認）。ここに全件を並べ、「選び直す」で作成時の宣言画面へ再訪できる
          ようにする。ホーム側は現行どおり1件のみ（同じ情報を2箇所に出さない・DEVLOG §6）。 */}
      <Section title="目標バッジ" right={`${(ml.badgeGoals || []).length} / 3`} padded>
        {(ml.badgeGoals || []).length === 0 ? (
          <div style={{ fontSize: T.size.body, color: T.color.sub, marginBottom: T.space.sm }}>まだ決めていません</div>
        ) : (ml.badgeGoals || []).map((id, i) => {
          const a = ABILITIES[id];
          if (!a) return null;
          const q = ACQUIRE_REQS[id];
          const cur = q ? q.cur(r) : 0;
          const done = q && cur >= q.need;
          // 表彰台系（世界選手権/五輪・古典3種）は回数ではなく条件文で言う
          // （目標バッジ宣言画面のcondTextと同じ言い回しに揃える）
          const condText = id === "big" ? "世界選手権かオリンピックで表彰台"
            : id === "pave_sp" ? "石畳の古典《春の地獄》で表彰台"
            : id === "ardennes_sp" ? "丘陵の古典《アルデンヌ》で表彰台"
            : id === "autumn_sp" ? "山岳の古典《秋の女王》で表彰台"
            : q ? `あと${q.need - cur}${q.unit}` : "";
          return (
            <Item key={id} first={i === 0} label={a.label}
              value={done ? "条件達成" : condText}
              valueColor={done ? T.color.good : T.color.text}
              detail={a.desc} />
          );
        })}
        <div style={{ marginTop: T.space.sm }}>
          <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_badge_goals" }))}>選び直す</QuietBtn>
        </div>
      </Section>

      {(() => {
        // 第44弾: 「使用中／使っていない」の2節構造に分離（devlog/wave44.md）。
        // 所持上限3個は撤廃ではなく、クラス別の枠（B1:3/A:4/PRO:5・最高到達クラス基準）へ拡張。
        // 第47弾: r.abilitiesに同居する3種（バッジ/体質/血脈）を分けて3節構造にした
        // （devlog/wave47.md）。「使用中のバッジ」節はバッジ（実績で獲得・24種）だけを表示し、
        // 体質・血脈はそれぞれ専用の節へ切り出す。枠（mlSlotUsed）もバッジ＋使用中の血脈だけを
        // 数え、体質は数えない。
        const maxSlots = mlBadgeSlots(ml);
        const badgeIds = abils.filter(id => mlBadgeKind(id) === "badge");
        // 第45弾: TIER_LADDER登録種（19種）は銅/銀/金/虹の4段階。未登録種（古典3種の表彰台判定・
        // 鉄人/大舞台に強いの金条件なし等）は従来どおり銅/金の2段階のまま（devlog/wave44.md）。
        const heldRows = badgeIds.filter(id => ABILITIES[id]).map(id => {
          const a = ABILITIES[id];
          const gr = GOLD_REQS[id];
          const ladder = TIER_LADDER[id];
          const tier = badgeTier(r, id); // "bronze"|"silver"|"gold"|"rainbow"
          const cur = gr ? gr.cur(r) : 0;
          let nextLabel = null, nextNeed = null;
          if (gr) {
            if (ladder) {
              if (tier === "bronze") { nextLabel = TIER_LABEL.silver; nextNeed = ladder.silverNeed; }
              else if (tier === "silver") { nextLabel = TIER_LABEL.gold; nextNeed = gr.need; }
              else if (tier === "gold") { nextLabel = TIER_LABEL.rainbow; nextNeed = ladder.rainbowNeed; }
              // tier === "rainbow"：最上段。次の段階なし
            } else if (tier !== "gold") {
              nextLabel = TIER_LABEL.gold; nextNeed = gr.need;
            }
          }
          return { id, a, tier, gr, cur, nextLabel, nextNeed };
        });
        const heldSet = new Set(abils);
        // 第45弾: 過去に到達した段階（金・銀・虹）ははずしても失われない（累積実績）ため、
        // 未使用でも到達済みならマークを出す（再び付ければ即その段階に戻る）。
        const achievedTier = id => (r.rainbowAbilities || []).includes(id) ? "rainbow"
          : (r.goldAbilities || []).includes(id) ? "gold"
          : (r.silverAbilities || []).includes(id) ? "silver" : "bronze";
        const candRows = Object.entries(ACQUIRE_REQS)
          .filter(([id]) => !heldSet.has(id) && ABILITIES[id])
          .map(([id, q]) => ({ id, a: ABILITIES[id], q, gateOk: !q.gate || q.gate(r), cur: q.cur(r), need: q.need, unit: q.unit }))
          .filter(x => x.gateOk && x.cur > 0)
          .map(x => ({ ...x, eligible: x.cur >= x.need, ratio: x.cur / x.need, tier: achievedTier(x.id) }))
          .sort((a, b) => b.ratio - a.ratio);
        // 第44弾: 所持0個でも「使用中のバッジ」節は（空き）だけを並べて出す（devlog/wave44.md
        // empty state）。枠の存在自体を新規キャラの初日から見せる。「使っていないバッジ」節は
        // 表示すべき候補が無ければ出さない（並べても情報量が無いため・第39弾の方針を踏襲）。
        const slotUsed = mlSlotUsed(r);
        const full = slotUsed >= maxSlots;
        const remaining = Math.max(0, maxSlots - slotUsed);
        // 第47弾: 入れ替え対象は枠を使っているもの（バッジ・血脈）に限る。体質を選ばせない
        // （悪特性を「これと入れ替える」で踏み倒す経路の封鎖）。
        const swapCandidates = abils.filter(id => ABILITIES[id] && mlBadgeKind(id) !== "taishitsu");
        const swapTarget = ml.uiBadgeSwap && candRows.some(c => c.id === ml.uiBadgeSwap) ? ml.uiBadgeSwap : null;
        // 第47弾: 体質（生まれつき・付け外し不可・枠を消費しない）。良い体質→悪特性の順。
        const taishitsuIds = abils.filter(id => mlBadgeKind(id) === "taishitsu" && ABILITIES[id]);
        const taishitsuRows = [...taishitsuIds.filter(id => !ABILITIES[id].bad), ...taishitsuIds.filter(id => ABILITIES[id].bad)];
        // 第47弾: 血脈（配合限定・付け外し可能・枠を消費し、枠に入れた分だけ効果が出る）。
        // 並び順はbloodAbilities（生成時に決まる）のまま——使用中を上に寄せない
        // （並びが操作のたびに動くと、どれを触ったか分からなくなるため）。
        const bloodIds = (r.bloodAbilities || []).filter(id => ABILITIES[id]);
        return (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, marginBottom: T.space.sm }}>
              <span style={{ color: T.color.accent }}>使用中のバッジ</span>
              <span style={{ color: full ? T.color.sub : T.color.accent }}>{`残り${remaining}枠`}</span>
            </div>
            <div style={{ background: T.color.surface, padding: `0 ${T.space.md}px`, marginBottom: T.space.md }}>
              {heldRows.map((row, i) => {
                const border = i === 0 ? "none" : `1px solid ${T.color.rule}`;
                const { id, a, tier, gr, cur, nextLabel, nextNeed } = row;
                return (
                  <div key={id} style={{ padding: `${T.space.sm}px 0`, borderTop: border }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
                      <span style={{ display: "flex", alignItems: "center", gap: T.space.xs }}>
                        <BadgeTierMark tier={tier} />
                        <span style={{ color: a.bad ? T.color.bad : T.color.text }}>{a.label}</span>
                      </span>
                      <ShopBtn onClick={() => mlUnequipBadge(id)} outline>はずす</ShopBtn>
                    </div>
                    <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2, lineHeight: 1.6, paddingLeft: 18 }}>
                      {a.desc}{nextLabel != null && `　　${nextLabel}まで ${cur} / ${nextNeed}${gr.unit}`}
                    </div>
                    {nextLabel != null && (
                      <div style={{ height: 3, background: T.color.surfaceUp, marginTop: T.space.xs, marginLeft: 18 }}>
                        <div style={{ height: 3, width: `${Math.min(100, cur / nextNeed * 100)}%`, background: T.color.accent }} />
                      </div>
                    )}
                  </div>
                );
              })}
              {remaining === 0 && heldRows.length === 0 ? (
                <div style={{ padding: `${T.space.sm}px 0` }}>
                  <span style={{ fontSize: T.size.body, color: T.color.sub, paddingLeft: 18 }}>血脈で枠が埋まっています</span>
                </div>
              ) : Array.from({ length: remaining }).map((_, i) => (
                <div key={`empty${i}`} style={{ padding: `${T.space.sm}px 0`, borderTop: (heldRows.length === 0 && i === 0) ? "none" : `1px solid ${T.color.rule}` }}>
                  <span style={{ fontSize: T.size.body, color: T.color.sub, paddingLeft: 18 }}>（空き）</span>
                </div>
              ))}
            </div>
            {candRows.length > 0 && (
              <>
                <div style={{ fontSize: T.size.caption, color: T.color.accent, marginBottom: T.space.sm }}>使っていないバッジ</div>
                <div style={{ background: T.color.surface, padding: `0 ${T.space.md}px`, marginBottom: T.space.md }}>
                  {candRows.map((row, i) => {
                    const border = i === 0 ? "none" : `1px solid ${T.color.rule}`;
                    const { id, a, eligible, cur, need, unit, tier } = row;
                    return (
                      <div key={id} style={{ padding: `${T.space.sm}px 0`, borderTop: border }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: T.space.sm }}>
                          <span style={{ display: "flex", alignItems: "center", gap: T.space.xs }}>
                            {eligible && <BadgeTierMark tier={tier} />}
                            <span style={{ fontSize: T.size.body, color: T.color.sub }}>{a.label}</span>
                          </span>
                          {eligible
                            ? <ShopBtn onClick={() => full ? setMl(s => ({ ...s, uiBadgeSwap: id })) : mlAcquireBadge(id)}>付ける</ShopBtn>
                            : <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none" }}>{cur} / {need}{unit}</span>}
                        </div>
                        {!eligible && (
                          <div style={{ height: 3, background: T.color.surfaceUp, marginTop: T.space.xs }}>
                            <div style={{ height: 3, width: `${Math.min(100, cur / need * 100)}%`, background: T.color.action }} />
                          </div>
                        )}
                        {swapTarget === id && (
                          <div style={{ background: T.color.surfaceUp, padding: T.space.sm, marginTop: T.space.xs }}>
                            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.xs }}>所持は上限（{maxSlots}個）です。はずすバッジを選んでください</div>
                            {swapCandidates.map(hid => (
                              <div key={hid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${T.space.xs}px 0` }}>
                                <span style={{ fontSize: T.size.body, color: T.color.text }}>{ABILITIES[hid].label}</span>
                                <ShopBtn onClick={() => { mlAcquireBadge(id, hid); setMl(s => ({ ...s, uiBadgeSwap: null })); }} outline>これと入れ替える</ShopBtn>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {taishitsuRows.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, marginBottom: T.space.sm }}>
                  <span style={{ color: T.color.accent }}>体質</span>
                  <span style={{ color: T.color.sub }}>生まれつき・変更できません</span>
                </div>
                <div style={{ background: T.color.surface, padding: `0 ${T.space.md}px`, marginBottom: T.space.md }}>
                  {taishitsuRows.map((id, i) => {
                    const a = ABILITIES[id];
                    return (
                      <div key={id} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                        <div style={{ fontSize: T.size.body, color: a.bad ? T.color.bad : T.color.text, paddingLeft: 18 }}>{a.label}</div>
                        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2, lineHeight: 1.6, paddingLeft: 18 }}>{a.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {bloodIds.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, marginBottom: T.space.sm }}>
                  <span style={{ color: T.color.accent }}>血脈</span>
                  <span style={{ color: T.color.sub }}>{`${bloodIds.filter(id => heldSet.has(id)).length} / ${bloodIds.length} を使用中・枠を使います`}</span>
                </div>
                <div style={{ background: T.color.surface, padding: `0 ${T.space.md}px`, marginBottom: T.space.md }}>
                  {bloodIds.map((id, i) => {
                    const a = ABILITIES[id];
                    const equipped = heldSet.has(id);
                    return (
                      <div key={id} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
                          <span style={{ color: equipped ? T.color.text : T.color.sub, paddingLeft: 18 }}>{a.label}</span>
                          {equipped
                            ? <ShopBtn onClick={() => mlUnequipBadge(id)} outline>はずす</ShopBtn>
                            : full
                              ? <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none" }}>空き枠なし</span>
                              : <ShopBtn onClick={() => mlEquipBlood(id)}>付ける</ShopBtn>}
                        </div>
                        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2, lineHeight: 1.6, paddingLeft: 18 }}>{a.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        );
      })()}

      <Section title="経歴" padded>
        {r.lineageName && <Item first label="系統" value={r.lineageName} />}
        {r.master && <Item label="師" value={r.master} />}
        {r.partner && <Item label="配合" value={`${r.master}×${r.partner}`} />}
        {ml.flags?.married && <Item label="家庭" value={ml.flags.hasChild ? "既婚・子あり" : "既婚"} />}
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm, paddingTop: T.space.sm, borderTop: `1px solid ${T.color.rule}`, lineHeight: 1.7 }}>
          {riderFlavorText(r)}
        </div>
      </Section>

      {/* 第32弾Phase B R3: 枠線ボタンを面(surfaceUp)＋chevronのアフォーダンス規約へ統一 */}
      <button onClick={() => setMl(s => ({ ...s, screen: "mylife_graph" }))}
        style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 4, width: "100%", background: T.color.surfaceUp, border: "none", color: T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body, padding: T.space.sm, cursor: "pointer" }}>
        キャリアの推移を見る <span style={{ color: T.color.sub }}>›</span>
      </button>
    </Screen>
  );
}
