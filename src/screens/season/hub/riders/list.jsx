// hub/riders.jsxより分割（Step13第7弾）：選手カード一覧（能力・練習指定・パーツ・戦績）。
// 第13弾Phase3-D-4-b（案B）：RiderCardへ移行。実測でカード1枚が25要素・1人約560pxあり、
// 「どれだけ伸びるか」を示す指標（成長ランク・伸びしろ・成長フェーズ）が同じ行に3つ
// 重複していた。毎月の判断（練習指定）に要る9要素だけを常時表示し（名前・主将・OVR・
// 脚質・成長フェーズ・調子・疲労・能力レーダー・練習指定）、残りは「くわしく見る」へ
// 逃がす。ユースバッジ（age<=18）は年齢表示と重複するため廃止（詳細はdevlog/wave13.md）。
import React from "react";
import { DisciplineGrid, PersonaLine, TraitLine } from "../../../../components/panels.jsx";
import { AbilitySoshitsuRadarPair } from "../../../../components/RadarChart.jsx";
import { Item, QuietBtn } from "../../../../components/kit.jsx";
import { RiderCard } from "../../../../components/riderCard.jsx";
import { overall } from "../../../../core/core.js";
import { AB_KEYS, AB_LABEL, GROWTH, POW } from "../../../../data/abilities.js";
import { MONTHS } from "../../../../data/course.js";
import { DIFFICULTIES } from "../../../../data/progression.js";
import { FONT_DOT, T } from "../../../../data/theme.js";
import { SLOT_LABEL, growthPhase, potentialHint, riderFlavorText } from "../../../../logic/support.js";
import { PARTS, PART_SLOTS } from "../../../../sim/race.js";
import { riderNickname } from "../../../../state/state.js";

export function renderRidersListSection(ctx) {
  const { askConfirm, availParts, expandedRiderId, g, growthCap, openRename, releaseRider, rosterMax, setCaptain, setExpandedRiderId, setFocus, setG, setPart, toggleFavorite, useSupp, useTune } = ctx;

  const expandedContentFor = (r, isCaptain) => (
      <>
        <div style={{ display: "flex", gap: T.space.sm, flexWrap: "wrap", marginBottom: T.space.sm }}>
          <QuietBtn onClick={() => openRename("選手名を変更", r.name, v => setG(s => ({ ...s, roster: s.roster.map(x => x.id === r.id ? { ...x, name: v } : x) })))}>名前を変更</QuietBtn>
          {!isCaptain && <QuietBtn onClick={() => setCaptain(r.id)}>主将に任命</QuietBtn>}
          <QuietBtn color={r.favorite ? T.color.action : T.color.sub} onClick={() => toggleFavorite(r.id)}>{r.favorite ? "お気に入り解除" : "お気に入り登録"}</QuietBtn>
          {g.month === 0 && <QuietBtn color={T.color.bad} onClick={() => askConfirm(`${r.name}を解雇しますか？`, () => releaseRider(r.id), "解雇する")}>解雇</QuietBtn>}
        </div>
        {riderNickname(r) && <div style={{ fontSize: T.size.caption, color: T.color.sub, fontStyle: "italic", marginBottom: T.space.sm }}>「{riderNickname(r)}」</div>}
        <PersonaLine p={r.personality} />
        <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
        <Item label="年齢・成長タイプ" value={`${r.age}歳・${GROWTH[r.growth].label}`} />
        <Item label="成長ランク・伸びしろ" value={`${POW[r.growthPow].label}・${potentialHint(r).label}`} />
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm }}>コース適性</div>
        <DisciplineGrid r={r} />
        <div style={{ display: "flex", gap: T.space.sm, marginTop: T.space.sm, flexWrap: "wrap" }}>
          {PART_SLOTS.map(slot => (
            <span key={slot} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{SLOT_LABEL[slot]}</span>
              <select value={r.parts[slot] || ""} onChange={e => setPart(r.id, slot, e.target.value)}
                style={{ background: T.color.surfaceUp, color: T.color.text, border: "none", padding: `3px ${T.space.xs}px`, fontSize: T.size.caption, maxWidth: 140, fontFamily: FONT_DOT }}>
                <option value="">— なし —</option>
                {Object.entries(PARTS).filter(([pid, p]) => p.slot === slot && (availParts(pid) > 0 || r.parts[slot] === pid))
                  .map(([pid, p]) => <option key={pid} value={pid}>{p.label}</option>)}
              </select>
            </span>
          ))}
        </div>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, fontStyle: "italic", marginTop: T.space.sm, paddingTop: T.space.sm, borderTop: `1px solid ${T.color.rule}`, lineHeight: 1.6 }}>{riderFlavorText(r)}</div>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm }}>戦績（{(r.raceLog || []).length}戦）</div>
        {(!r.raceLog || r.raceLog.length === 0) && <div style={{ fontSize: T.size.caption, color: T.color.sub }}>まだ出走記録がありません。</div>}
        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          {[...(r.raceLog || [])].reverse().map((e, j) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.caption, padding: "3px 0", borderBottom: j < r.raceLog.length - 1 ? `1px solid ${T.color.rule}` : "none" }}>
              <span style={{ color: T.color.sub }}>{e.year}年目 {MONTHS[e.month]}</span>
              <span style={{ color: T.color.text, flex: 1, margin: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
              <span style={{ color: e.rank === 1 ? T.color.accent : T.color.sub, fontVariantNumeric: "tabular-nums" }}>{e.rank}位</span>
            </div>
          ))}
        </div>
      </>
  );

  return (
    <>
      <Item first label="所属" value={`${g.roster.length}/${rosterMax}名`}
        detail={`成長上限 ${growthCap}（難易度「${(DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).label}」）${g.month === 0 ? "・4月は選手を解雇できます" : ""}`} />
      {g.roster.map((r, i) => {
        const ph = growthPhase(r);
        const isCaptain = r.id === g.captainId;
        return (
          <RiderCard key={r.id} r={r} first={i === 0}
            ovr={overall(r)}
            badge={isCaptain ? "主将" : r.isLegendRecruit ? "伝説の招待選手" : null}
            sub={ph.tag} subColor={T.color.accent}
            cond={r.cond}
            fatigue={r.fatigue}
            expanded={expandedRiderId === r.id}
            onToggleExpand={() => setExpandedRiderId(expandedRiderId === r.id ? null : r.id)}
            expandedContent={expandedContentFor(r, isCaptain)}
          >
            <AbilitySoshitsuRadarPair r={r} cap={growthCap} size={140} />
            <div style={{ display: "flex", gap: T.space.sm, marginTop: T.space.sm, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: T.size.caption, color: T.color.sub }}>練習</span>
              <select value={r.focus} onChange={e => setFocus(r.id, e.target.value)}
                style={{ flex: 1, background: T.color.surfaceUp, color: T.color.text, border: "none", padding: `${T.space.xs}px ${T.space.sm}px`, fontSize: T.size.caption, fontFamily: FONT_DOT }}>
                {AB_KEYS.map(k => <option key={k} value={k}>{AB_LABEL[k]}強化</option>)}
                <option value="rest">休養（疲労-15）</option>
              </select>
            </div>
            {((g.inv.supp > 0 && r.fatigue > 30) || (g.inv.tune > 0 && r.cond < 5)) && (
              <div style={{ display: "flex", gap: T.space.sm, marginTop: T.space.sm }}>
                {g.inv.supp > 0 && r.fatigue > 30 && <QuietBtn color={T.color.action} onClick={() => useSupp(r.id)}>サプリ（疲労-40）</QuietBtn>}
                {g.inv.tune > 0 && r.cond < 5 && <QuietBtn color={T.color.action} onClick={() => useTune(r.id)}>調律（調子+2）</QuietBtn>}
              </div>
            )}
            {r.injury > 0 && <div style={{ fontSize: T.size.caption, color: T.color.bad, marginTop: T.space.sm }}>故障 残{r.injury}ヶ月</div>}
          </RiderCard>
        );
      })}
    </>
  );
}
