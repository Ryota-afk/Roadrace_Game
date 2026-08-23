// hub/riders.jsxより分割（Step13第7弾）：選手カード一覧（能力・練習指定・パーツ・戦績）。
// 第13弾Phase3-D-4-b（案B）：RiderCardへ移行。実測でカード1枚が25要素・1人約560pxあり、
// 「どれだけ伸びるか」を示す指標（成長ランク・伸びしろ・成長フェーズ）が同じ行に3つ
// 重複していた。毎月の判断（練習指定）に要る9要素だけを常時表示し（名前・主将・OVR・
// 脚質・成長フェーズ・調子・疲労・能力レーダー・練習指定）、残りは「くわしく見る」へ
// 逃がす。ユースバッジ（age<=18）は年齢表示と重複するため廃止（詳細はdevlog/wave13.md）。
// 第32弾（第2次UI改革）: RiderCardの汎用カード（他3画面と共有）から、この画面専用の
// 3行コンパクト行（RiderRow）へ差し替えた。行全体がタップ対象で、レーダー・練習指定・
// サプリ/調律・故障の詳細は展開領域へ集約する（縦線は使わない・devlog/wave32.md画面3仕様）。
import React from "react";
import { DisciplineGrid, PersonaLine, TraitLine } from "../../../../components/panels.jsx";
import { AbilitySoshitsuRadarPair } from "../../../../components/RadarChart.jsx";
import { Item, QuietBtn, Tag, TypeChip } from "../../../../components/kit.jsx";
import { overall } from "../../../../core/core.js";
import { AB_KEYS, AB_LABEL, COND_ARROW, COND_COLOR, GROWTH } from "../../../../data/abilities.js";
import { MONTHS } from "../../../../data/course.js";
import { FONT_DOT, T } from "../../../../data/theme.js";
import { SLOT_LABEL, growthPhase, potentialHint, riderFlavorText } from "../../../../logic/support.js";
import { PARTS, PART_SLOTS } from "../../../../sim/race.js";
import { riderNickname } from "../../../../state/state.js";

// 能力ラベルの短縮形（行3は5能力を横並びにするため、フルラベルだと折り返す）。
const AB_SHORT = { flat: "平坦", climb: "登坂", sprint: "スプ", stamina: "スタ", solo: "独走" };

function RiderRow({ r, first, ovr, badge, ph, expanded, onToggle }) {
  const injured = r.injury > 0;
  return (
    <button onClick={onToggle} style={{
      display: "block", width: "100%", textAlign: "left", cursor: "pointer",
      background: "none", border: 0, borderTop: first ? "none" : `1px solid ${T.color.rule}`,
      fontFamily: FONT_DOT, padding: `${T.space.sm}px 0`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: T.space.sm }}>
        <span style={{ fontSize: T.size.head, color: T.color.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.name}{badge && <span style={{ fontSize: T.size.caption, color: T.color.accent, marginLeft: T.space.xs }}>{badge}</span>}
        </span>
        <span style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: T.size.title, color: T.color.accent, fontVariantNumeric: "tabular-nums" }}>{ovr}</span>
          <span style={{ fontSize: T.size.body, color: T.color.sub }}>›</span>
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3, gap: T.space.sm }}>
        <span style={{ display: "flex", gap: T.space.xs, alignItems: "center" }}>
          <TypeChip type={r.type} />
          <Tag>{ph.tag}</Tag>
          {!injured && <span style={{ fontSize: T.size.label, color: COND_COLOR[r.cond - 1], fontVariantNumeric: "tabular-nums" }}>{COND_ARROW[r.cond - 1]}</span>}
        </span>
        {injured ? (
          <span style={{ fontSize: T.size.caption, color: T.color.bad, flex: "none" }}>故障{r.injury}ヶ月</span>
        ) : (
          <span style={{ display: "flex", alignItems: "center", gap: 4, flex: "none" }}>
            <span style={{ fontSize: T.size.micro, color: T.color.sub, fontVariantNumeric: "tabular-nums" }}>{Math.round(r.fatigue)}</span>
            <span style={{ display: "block", width: 44, height: 4, background: T.color.surfaceUp }}>
              <span style={{ display: "block", height: 4, width: `${Math.min(100, r.fatigue)}%`, background: r.fatigue >= 70 ? T.color.bad : T.color.accent }} />
            </span>
          </span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: T.space.xs, gap: T.space.sm }}>
        <span style={{ display: "flex", gap: T.space.sm }}>
          {AB_KEYS.map(k => (
            <span key={k} style={{ textAlign: "center" }}>
              <div style={{ fontSize: T.size.label, color: (r[k] || 0) >= 70 ? T.color.accent : T.color.text, fontVariantNumeric: "tabular-nums" }}>{Math.round(r[k] || 0)}</div>
              <div style={{ fontSize: T.size.micro, color: T.color.sub }}>{AB_SHORT[k]}</div>
            </span>
          ))}
        </span>
        <Tag>練習 {AB_LABEL[r.focus]}</Tag>
      </div>
      {expanded !== undefined && (
        <div style={{ fontSize: T.size.caption, color: T.color.sub, textAlign: "center", marginTop: T.space.xs }}>{expanded ? "▲ 閉じる" : "▼ くわしく見る"}</div>
      )}
    </button>
  );
}

export function renderRidersListSection(ctx) {
  const { askConfirm, availParts, expandedRiderId, g, growthCap, openRename, releaseRider, rosterMax, setCaptain, setExpandedRiderId, setFocus, setG, setPart, toggleFavorite, useSupp, useTune } = ctx;

  const expandedContentFor = (r, isCaptain) => (
      <>
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
        <div style={{ display: "flex", gap: T.space.sm, flexWrap: "wrap", marginTop: T.space.sm, paddingTop: T.space.sm, borderTop: `1px solid ${T.color.rule}` }}>
          <QuietBtn onClick={() => openRename("選手名を変更", r.name, v => setG(s => ({ ...s, roster: s.roster.map(x => x.id === r.id ? { ...x, name: v } : x) })))}>名前を変更</QuietBtn>
          {!isCaptain && <QuietBtn onClick={() => setCaptain(r.id)}>主将に任命</QuietBtn>}
          <QuietBtn color={r.favorite ? T.color.action : T.color.sub} onClick={() => toggleFavorite(r.id)}>{r.favorite ? "お気に入り解除" : "お気に入り登録"}</QuietBtn>
          {g.month === 0 && <QuietBtn color={T.color.bad} onClick={() => askConfirm(`${r.name}を解雇しますか？`, () => releaseRider(r.id), "解雇する")}>解雇</QuietBtn>}
        </div>
        {riderNickname(r) && <div style={{ fontSize: T.size.caption, color: T.color.sub, fontStyle: "italic", marginTop: T.space.sm }}>「{riderNickname(r)}」</div>}
        <PersonaLine p={r.personality} />
        <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
        <Item label="年齢・成長タイプ" value={`${r.age}歳・${GROWTH[r.growth].label}`} />
        <Item label="成長ランク・伸びしろ" value={`${r.growthPow}・${potentialHint(r).label}`} />
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: T.space.sm }}>
        <span style={{ fontSize: T.size.head, color: T.color.text }}>
          選手 {g.roster.length}<span style={{ fontSize: T.size.caption, color: T.color.sub }}>/{rosterMax}名</span>
        </span>
        {g.month === 0 && <Tag>4月は解雇できます</Tag>}
      </div>
      {g.roster.map((r, i) => {
        const ph = growthPhase(r);
        const isCaptain = r.id === g.captainId;
        const expanded = expandedRiderId === r.id;
        return (
          <React.Fragment key={r.id}>
            <RiderRow r={r} first={i === 0} ovr={overall(r)}
              badge={isCaptain ? "主将" : r.isLegendRecruit ? "伝説の招待選手" : null}
              ph={ph} expanded={expanded}
              onToggle={() => setExpandedRiderId(expanded ? null : r.id)} />
            {expanded && <div style={{ paddingBottom: T.space.sm }}>{expandedContentFor(r, isCaptain)}</div>}
          </React.Fragment>
        );
      })}
    </>
  );
}
