// 「選手」タブ（第13弾Phase3-A で新設）。
// Phase 2でホームの「その他」へ仮置きしていた選手の詳細——能力・コース適性・素質・
// 性格と成長・経歴——をここへ集約した。図の形（レーダー）はそのまま、フォントと色だけ
// 新トークンへ寄せている（ユーザー指示：「レーダーのままフォントのみ変更」）。
import React from "react";
import { DisciplineGrid } from "../../components/panels.jsx";
import { AbilitySoshitsuRadarPair } from "../../components/RadarChart.jsx";
import { RiderPortrait } from "../../components/RiderPortrait.jsx";
import { GOLD_REQS, overall } from "../../core/core.js";
import { ABILITIES, GROWTH, PERSONALITIES } from "../../data/abilities.js";
import { FONT_DOT, T } from "../../data/theme.js";
import { badgeExposureScore, badgeReturnLabel, EXPOSURE_NORM, swapsToRestoreGold } from "../../domain/mylife/badge.js";
import { mlSelectedRace } from "../../domain/mylife/race.js";
import { ACQUIRE_REQS, FAVORS_TO_DISCIPLINE, growthPhase, mlAcquireAbility, mlGrowthCap, mlGrowthCapFor, mlGrowthPowRevealed, potentialHint, riderFlavorText } from "../../logic/support.js";
import { riderNickname } from "../../state/state.js";
import { Item, Screen, Section, ShopBtn, TypeChip } from "../../components/kit.jsx";

export function renderMyLifeRiderScreen(ctx) {
  const { ml, mlWrap, mlAcquireBadge, setMl } = ctx;
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
  const golds = new Set(r.goldAbilities || []);

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

      {(() => {
        // 第39弾: 取得済み（金への進捗込み）＋未取得の到達可能な進捗を1つの並びに統合する。
        // gate不成立（脚質違い等）・進捗0のものは表示しない（並べても情報量がない・devlog/wave39.md）。
        const heldRows = abils.filter(id => ABILITIES[id]).map(id => {
          const a = ABILITIES[id];
          const gr = GOLD_REQS[id];
          const achieved = golds.has(id);
          // 第42弾: 実績（天井）は達成していても、直近の走り方が離れていればscore<0.5で銅へ戻る（状態C）。
          const norm = EXPOSURE_NORM[id];
          const score = achieved && norm ? badgeExposureScore(r, id) : null;
          const isGold = achieved && (norm ? (score !== null && score >= 0.5) : true);
          const drifting = achieved && !isGold; // 状態C: 実績はあるが今は銅
          const cur = gr ? gr.cur(r) : 0;
          const need = gr ? gr.need : 0;
          const swaps = drifting ? swapsToRestoreGold(r, id) : null;
          const returnLabel = drifting ? badgeReturnLabel(id) : null;
          return { id, a, held: true, isGold, drifting, gr, cur, need, score, swaps, returnLabel, ratio: isGold ? 2 : drifting ? 1.9 : gr ? cur / need : 1.5 };
        }).sort((a, b) => b.ratio - a.ratio); // 取得済みは金→（離れた金）→銅の並びにする
        const heldSet = new Set(abils);
        const candRows = Object.entries(ACQUIRE_REQS)
          .filter(([id]) => !heldSet.has(id) && ABILITIES[id])
          .map(([id, q]) => ({ id, a: ABILITIES[id], q, gateOk: !q.gate || q.gate(r), cur: q.cur(r), need: q.need, unit: q.unit }))
          .filter(x => x.gateOk && x.cur > 0)
          .map(x => ({ ...x, held: false, eligible: x.cur >= x.need, ratio: x.cur / x.need }))
          .sort((a, b) => b.ratio - a.ratio);
        const rows = [...heldRows, ...candRows];
        if (rows.length === 0) return null;
        const full = abils.length >= 3;
        const swapTarget = ml.uiBadgeSwap && candRows.some(c => c.id === ml.uiBadgeSwap) ? ml.uiBadgeSwap : null;
        return (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, marginBottom: T.space.sm }}>
              <span style={{ color: T.color.accent }}>バッジ</span>
              <span style={{ color: full ? T.color.accent : T.color.sub }}>{abils.length} / 3 所持</span>
            </div>
            <div style={{ background: T.color.surface, padding: `0 ${T.space.md}px`, marginBottom: T.space.md }}>
              {rows.map((row, i) => {
                const border = i === 0 ? "none" : `1px solid ${T.color.rule}`;
                if (row.held) {
                  const { id, a, isGold, drifting, gr, cur, need, score, swaps, returnLabel } = row;
                  return (
                    <div key={id} style={{ padding: `${T.space.sm}px 0`, borderTop: border }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
                        <span style={{ color: a.bad ? T.color.bad : T.color.text }}>{a.label}</span>
                        <span style={{ fontSize: T.size.caption, color: isGold ? T.color.accent : T.color.sub, flex: "none" }}>{isGold ? "金" : "銅"}</span>
                      </div>
                      <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2, lineHeight: 1.6 }}>
                        {a.desc}
                        {!isGold && !drifting && gr && `　　金まで ${cur} / ${need}${gr.unit}`}
                        {drifting && returnLabel != null && swaps != null && `　　金に戻るまで ${returnLabel} あと${swaps}回`}
                      </div>
                      {!isGold && !drifting && gr && (
                        <div style={{ height: 3, background: T.color.surfaceUp, marginTop: T.space.xs }}>
                          <div style={{ height: 3, width: `${Math.min(100, cur / need * 100)}%`, background: T.color.accent }} />
                        </div>
                      )}
                      {drifting && (
                        <div style={{ height: 3, background: T.color.surfaceUp, marginTop: T.space.xs }}>
                          <div style={{ height: 3, width: `${Math.min(100, (score || 0) / 0.5 * 100)}%`, background: T.color.accent }} />
                        </div>
                      )}
                    </div>
                  );
                }
                const { id, a, eligible, cur, need, unit } = row;
                return (
                  <div key={id} style={{ padding: `${T.space.sm}px 0`, borderTop: border }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: T.space.sm }}>
                      <span style={{ fontSize: T.size.body, color: T.color.sub }}>{a.label}</span>
                      {eligible
                        ? <ShopBtn onClick={() => full ? setMl(s => ({ ...s, uiBadgeSwap: id })) : mlAcquireBadge(id)}>習得</ShopBtn>
                        : <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none" }}>{cur} / {need}{unit}</span>}
                    </div>
                    {!eligible && (
                      <div style={{ height: 3, background: T.color.surfaceUp, marginTop: T.space.xs }}>
                        <div style={{ height: 3, width: `${Math.min(100, cur / need * 100)}%`, background: T.color.action }} />
                      </div>
                    )}
                    {swapTarget === id && (
                      <div style={{ background: T.color.surfaceUp, padding: T.space.sm, marginTop: T.space.xs }}>
                        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.xs }}>所持は上限（3個）です。外すバッジを選んでください</div>
                        {abils.filter(hid => ABILITIES[hid]).map(hid => (
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
