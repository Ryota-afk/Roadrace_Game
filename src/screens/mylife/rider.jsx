// 「選手」タブ（第13弾Phase3-A で新設）。
// Phase 2でホームの「その他」へ仮置きしていた選手の詳細——能力・コース適性・素質・
// 性格と成長・経歴——をここへ集約した。図の形（レーダー）はそのまま、フォントと色だけ
// 新トークンへ寄せている（ユーザー指示：「レーダーのままフォントのみ変更」）。
import React from "react";
import { DisciplineGrid } from "../../components/panels.jsx";
import { AbilitySoshitsuRadarPair } from "../../components/RadarChart.jsx";
import { RiderPortrait } from "../../components/RiderPortrait.jsx";
import { overall } from "../../core/core.js";
import { ABILITIES, GROWTH, PERSONALITIES } from "../../data/abilities.js";
import { FONT_DOT, T } from "../../data/theme.js";
import { FAVORS_TO_DISCIPLINE, growthPhase, mlGrowthCap, mlGrowthCapFor, mlGrowthPowRevealed, potentialHint, riderFlavorText } from "../../logic/support.js";
import { riderNickname } from "../../state/state.js";
import { Item, Screen, Section, TypeChip } from "../../components/kit.jsx";

export function renderMyLifeRiderScreen(ctx) {
  const { ml, mlWrap, setMl } = ctx;
  const r = ml.player;
  if (!r) return null;
  const race = ml.races[0];
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

      {abils.length > 0 && (
        <Section title="特殊能力" padded>
          {abils.map((id, i) => {
            const a = ABILITIES[id];
            if (!a) return null;
            return (
              <div key={id} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
                  <span style={{ color: a.bad ? T.color.bad : T.color.text }}>{a.label}</span>
                  {golds.has(id) && <span style={{ fontSize: T.size.caption, color: T.color.accent }}>金</span>}
                </div>
                <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs, lineHeight: 1.6 }}>{a.desc}</div>
              </div>
            );
          })}
        </Section>
      )}

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
