// 表示用サブコンポーネント（Phase 4-1で main.jsx から分離）。
import React from "react";
import { ABILITY_CATEGORY_ORDER, APT_GRADE_COLOR, DISCIPLINES, DISCIPLINE_KEYS, aptGrade, buildDesc, disciplineScore, loadCourseRecords, raceForecast } from "../logic/support.js";
import { Eyebrow } from "./ui.jsx";
import { GOLD_CONDITIONS } from "../core/core.js";
import { ABILITIES, AB_COLOR, AB_KEYS, AB_LABEL, COND_FC_ARROW, COND_FC_COLOR, COND_FC_LABEL, PERSONALITIES, TYPES } from "../data/abilities.js";
import { SEG_COLOR, TEMPLATES, UNLOCK_TEMPLATES } from "../data/course.js";
import { TITLE_DEFS } from "../data/progression.js";
import { C, FONT_D, FONT_M } from "../data/theme.js";
import { PARTS, PART_SLOTS, generateCourse } from "../sim/race.js";
import { loadTitles, totalTitleCount } from "../state/state.js";

export function FatigueBar({ v }) {
  const col = v >= 90 ? C.red : v >= 60 ? "#e8a13c" : C.green;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: C.line, borderRadius: 3, position: "relative" }}>
        <div style={{ width: `${v}%`, height: 5, background: col, borderRadius: 3 }} />
        <div style={{ position: "absolute", left: "90%", top: -2, width: 1.5, height: 9, background: C.red }} />
      </div>
      <span style={{ fontFamily: FONT_M, fontSize: 11, color: col, width: 26, textAlign: "right" }}>{Math.round(v)}</span>
    </div>
  );
}

export function SubStatLine({ r }) {
  if (r.accel == null && r.build == null && r.mental == null) return null;
  const col = (v) => v >= 75 ? C.yellow : v >= 55 ? C.green : v >= 40 ? C.sub : "#c86";
  const item = (label, v) => (
    <span key={label} style={{ fontSize: 10.5, color: C.sub }}>
      {label}<span style={{ fontFamily: FONT_M, color: col(v), marginLeft: 2, fontWeight: 700 }}>{Math.round(v)}</span>
    </span>
  );
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap", alignItems: "center" }}>
      {item("加速", r.accel ?? 50)}
      <span style={{ fontSize: 10.5, color: C.sub }}>体格<span style={{ fontFamily: FONT_M, color: col(r.build ?? 50), marginLeft: 2, fontWeight: 700 }}>{Math.round(r.build ?? 50)}</span><span style={{ color: C.sub, marginLeft: 2 }}>({buildDesc(r.build ?? 50)})</span></span>
      {item("メンタル", r.mental ?? 50)}
      {/* v43(マイライフ難易度調整Phase 1): 突破力・安定感（固定ステータス、buildと同じく非成長）をSeason/MyLife共通で表示 */}
      {item("突破力", r.breakthrough ?? 50)}
      {item("安定感", r.stability ?? 50)}
    </div>
  );
}

export function StartListPanel({ entrants, favors }) {
  const teams = {};
  entrants.forEach(e => { (teams[e.teamName] = teams[e.teamName] || { color: e.color, list: [] }).list.push(e); });
  const rows = Object.entries(teams).sort((a, b) => {
    const ap = a[1].list.some(e => e.team === "PLAYER") ? 0 : 1;
    const bp = b[1].list.some(e => e.team === "PLAYER") ? 0 : 1;
    return ap - bp;
  });
  // v34(UI): 下馬評（コース地力の予想印）。能力データがあるとき（マイライフの出走表）だけ有効
  const forecast = raceForecast(entrants, favors);
  const hasForecast = forecast.size > 0;
  const me = hasForecast ? entrants.find(e => e.isPlayerChar) : null;
  const myFc = me ? forecast.get(me) : null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 11, color: C.sub }}>出走 {entrants.length}名 / {rows.length}チーム（👑=エース）</div>
      {hasForecast && (
        <div style={{ background: C.panel2, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 11.5, color: C.sub }}>
            📊 下馬評（このコースの地力予想）：
            <span style={{ color: "#ffd23f", fontWeight: 700, marginLeft: 4 }}>◎本命</span>{" "}
            <span style={{ color: "#4f8fe8", fontWeight: 700 }}>○対抗</span>{" "}
            <span style={{ color: "#35c07e", fontWeight: 700 }}>▲注目</span>
          </div>
          {myFc && (
            <div style={{ fontSize: 12.5, color: C.text, marginTop: 4, fontWeight: 700 }}>
              あなたの評価：
              <span style={{ color: myFc.mark ? myFc.mark.color : C.sub, marginLeft: 4 }}>
                {myFc.mark ? `${myFc.mark.icon} ${myFc.mark.label}` : "無印"}（{myFc.rank}番手／{entrants.length}人中）
              </span>
            </div>
          )}
        </div>
      )}
      {rows.map(([tn, t]) => {
        const isPlayerTeam = t.list.some(e => e.team === "PLAYER");
        return (
          <div key={tn} style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", borderLeft: `3px solid ${t.color}` }}>
            <div style={{ fontFamily: FONT_D, fontWeight: 700, color: isPlayerTeam ? C.yellow : C.text, fontSize: 13 }}>{tn}{isPlayerTeam ? "（自チーム）" : ""}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 3 }}>
              {t.list.map((e, i) => {
                const fc = forecast.get(e);
                return (
                  <span key={i} style={{ fontSize: 11.5, color: e.isPlayerChar ? C.yellow : e.isLegend ? C.purple : e.isWorldStar ? "#4f8fe8" : (e.isRival || e.isRival2) ? C.red : C.text }}>
                    {fc && fc.mark ? <span style={{ color: fc.mark.color, fontWeight: 700, marginRight: 1 }}>{fc.mark.icon}</span> : ""}
                    {e.isAce ? "👑 " : ""}{e.isLegend ? "🏛 " : ""}{e.isWorldStar ? `🌍${e.worldRank}位 ` : ""}{e.name}<span style={{ color: C.sub, fontSize: 10, marginLeft: 2 }}>{TYPES[e.type].label}</span>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TraitLine({ abilities, goldAbilities }) {
  if (!abilities || abilities.length === 0) return null;
  return (
    <div style={{ marginTop: 2 }}>
      {abilities.map(id => {
        const t = ABILITIES[id];
        if (!t) return null;
        const isGold = !!(goldAbilities && goldAbilities.includes(id));
        const col = isGold ? C.yellow : t.bad ? C.red : "#e8a13c";
        return (
          <div key={id} style={{ fontSize: 10.5, color: C.sub, marginTop: 1 }}>
            <span style={{ color: col, border: `1px solid ${col}`, borderRadius: 4, padding: "0px 5px", marginRight: 5, fontWeight: isGold ? 700 : 400 }}>
              {isGold ? "★" : ""}{t.label}
            </span>
            {t.desc}{isGold ? "（金特・効果2倍）" : ""}
          </div>
        );
      })}
    </div>
  );
}

export function TitlesPanel() {
  const t = loadTitles();
  const total = totalTitleCount();
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.7 }}>これまでの全プレイ・両モードで自分（自チーム）が獲得した主要タイトルの通算数です。</div>
      <div style={{ background: C.panel, borderRadius: 12, padding: "12px 14px", textAlign: "center", border: `1px solid ${total > 0 ? "#e8a13c" : C.line}` }}>
        <div style={{ fontSize: 11, color: C.sub }}>通算タイトル</div>
        <div style={{ fontFamily: FONT_M, fontSize: 28, color: "#e8a13c", fontWeight: 700 }}>{total}</div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {TITLE_DEFS.map(d => (
          <div key={d.key} style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: C.text }}>{d.icon} {d.label}</span>
            <span style={{ fontFamily: FONT_M, fontSize: 15, color: (t[d.key] || 0) > 0 ? C.yellow : C.sub }}>{t[d.key] || 0}<span style={{ fontSize: 10, color: C.sub }}> 回</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CondFc({ dir }) {
  if (dir == null) return null;
  const i = dir + 1;
  return <span style={{ fontSize: 10, color: COND_FC_COLOR[i], marginLeft: 4 }} title={`来月の調子予報：${COND_FC_LABEL[i]}`}>予報{COND_FC_ARROW[i]}</span>;
}

export function CourseRecordsPanel() {
  const recs = loadCourseRecords();
  const kinds = [...TEMPLATES, ...UNLOCK_TEMPLATES].map(t => t.kind);
  const anyRec = kinds.some(k => recs[k]);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.7 }}>
        コース種別ごとの最速記録（レコード指数＝コース距離÷勝者タイム×100。数値が大きいほど速い）。全プレイ・両モードで共有され、更新されるたびに達成者が刻まれます。
      </div>
      {!anyRec && <div style={{ fontSize: 12.5, color: C.sub }}>まだ記録はありません。レースを走ると刻まれていきます。</div>}
      {kinds.map(k => {
        const r = recs[k];
        return (
          <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${r && r.isPlayer ? C.yellow : C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
            <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13 }}>{k}</span>
            {r ? (
              <span style={{ fontSize: 11.5, color: C.sub }}>
                指数<span style={{ color: C.yellow, fontFamily: FONT_M, marginLeft: 3 }}>{r.speed}</span>
                <span style={{ marginLeft: 8, color: r.isPlayer ? C.yellow : C.text }}>{r.holder}{r.isPlayer ? " ★" : ""}</span>
                <span style={{ marginLeft: 6, color: C.sub }}>({r.year}年目)</span>
              </span>
            ) : <span style={{ fontSize: 11.5, color: C.sub }}>記録なし</span>}
          </div>
        );
      })}
    </div>
  );
}

export function AbilityFileList({ file }) {
  const normalSet = new Set(file.normal);
  const goldSet = new Set(file.gold);
  const allIds = Object.keys(ABILITIES);
  const discoveredCount = allIds.filter(id => normalSet.has(id)).length;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 14, borderTop: `4px solid ${C.purple}` }}>
        <div style={{ fontFamily: FONT_D, fontSize: 18, color: C.text }}>{discoveredCount} / {allIds.length} 発見済み</div>
        <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>該当する特殊能力を持つ選手を保有すると解禁されます（シーズンモード・マイライフ通算）。</div>
      </div>
      {ABILITY_CATEGORY_ORDER.map(cat => {
        const ids = allIds.filter(id => ABILITIES[id].category === cat);
        if (ids.length === 0) return null;
        return (
          <div key={cat}>
            <Eyebrow color={C.purple}>{cat}</Eyebrow>
            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
              {ids.map(id => {
                const t = ABILITIES[id];
                const found = normalSet.has(id);
                const gold = goldSet.has(id);
                const goldable = !!GOLD_CONDITIONS[id];
                const col = t.bad ? C.red : "#e8a13c";
                return (
                  <div key={id} style={{
                    background: found ? C.panel : C.panel2, borderRadius: 10, padding: "9px 12px",
                    border: `1px solid ${found ? col : C.line}`, opacity: found ? 1 : 0.6,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 16 }}>{found ? (t.bad ? "⚠️" : "✦") : "🔒"}</span>
                      <span style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 13.5, color: found ? col : C.sub }}>
                        {found ? t.label : "???"}
                      </span>
                      {goldable && found && (
                        <span style={{
                          fontSize: 9.5, color: gold ? C.yellow : C.sub, border: `1px solid ${gold ? C.yellow : C.line}`,
                          borderRadius: 4, padding: "0 4px",
                        }}>{gold ? "★ 金特入手済" : "金特あり"}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>
                      {found ? t.desc : "まだ発見されていない特殊能力です。"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PersonaLine({ p }) {
  const per = PERSONALITIES[p];
  if (!per) return null;
  const col = p === "genius" ? C.yellow : C.blue;
  return (
    <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>
      <span style={{ color: col, border: `1px solid ${col}`, borderRadius: 4, padding: "0px 5px", marginRight: 5 }}>性格：{per.label}</span>
      {per.desc}
    </div>
  );
}

export function AbilityGrid({ r, cap = 88 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginTop: 6 }}>
      {AB_KEYS.map(k => {
        const partBonus = r.parts ? PART_SLOTS.reduce((s, sl) => s + ((r.parts[sl] && PARTS[r.parts[sl]].ab[k]) || 0), 0) : 0;
        const broke = r[k] >= cap;
        // v34(UI): 成長の伸びしろを可視化。現在値のバー＋成長上限(cap)までの薄い帯＋上限マーカー。
        const valPct = Math.min(100, r[k] + partBonus);
        const capPct = Math.min(100, cap);
        const room = Math.max(0, Math.round(cap - r[k]));
        return (
          <div key={k}>
            <div style={{ fontSize: 9.5, color: C.sub }}>{AB_LABEL[k]}</div>
            <div style={{ fontFamily: FONT_M, fontSize: 12.5, color: broke ? C.yellow : C.text }}>
              {Math.round(r[k])}{partBonus > 0 && <span style={{ color: C.purple, fontSize: 10 }}>+{partBonus}</span>}
              {!broke && room > 0 && <span style={{ color: C.sub, fontSize: 9 }}> +{room}</span>}
            </div>
            <div style={{ position: "relative", height: 4, background: C.line, borderRadius: 2 }} title={broke ? "限界突破" : `伸びしろ +${room}（上限${Math.round(cap)}）`}>
              {!broke && capPct > valPct && <div style={{ position: "absolute", left: `${valPct}%`, width: `${capPct - valPct}%`, height: 4, background: AB_COLOR[k], opacity: 0.28, borderRadius: 2 }} />}
              <div style={{ position: "absolute", left: 0, width: `${valPct}%`, height: 4, background: broke ? C.yellow : AB_COLOR[k], borderRadius: 2 }} />
              <div style={{ position: "absolute", left: `${capPct}%`, top: -1, width: 1.5, height: 6, background: broke ? C.yellow : C.sub, transform: "translateX(-1px)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DisciplineGrid({ r, highlightKey }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginTop: 4 }}>
      {DISCIPLINE_KEYS.map(k => {
        const score = disciplineScore(r, k);
        const hi = k === highlightKey;
        // v38(#9 B-1): ウイポ風の S〜G 適性グレードを併記（一目でどの地形が得意か読める）
        const grade = aptGrade(score);
        const gc = APT_GRADE_COLOR[grade] || C.sub;
        return (
          <div key={k}>
            <div style={{ fontSize: 9.5, color: hi ? C.yellow : C.sub }}>{DISCIPLINES[k].label}{hi ? " ★" : ""}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 800, color: gc, lineHeight: 1 }}>{grade}</span>
              <span style={{ fontFamily: FONT_M, fontSize: 11, color: hi ? C.yellow : C.sub }}>{score}</span>
            </div>
            <div style={{ height: 3, background: C.line, borderRadius: 2, marginTop: 1 }}>
              <div style={{ height: 3, width: `${Math.min(100, score)}%`, background: hi ? C.yellow : gc, borderRadius: 2 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BlurGrid({ blur }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginTop: 6 }}>
      {AB_KEYS.map(k => (
        <div key={k}>
          <div style={{ fontSize: 9.5, color: C.sub }}>{AB_LABEL[k]}</div>
          <div style={{ fontFamily: FONT_M, fontSize: 11.5, color: C.sub }}>{blur[k].min}〜{blur[k].max}</div>
          <div style={{ height: 4, background: C.line, borderRadius: 2, position: "relative" }}>
            <div style={{
              position: "absolute", left: `${blur[k].min}%`, width: `${blur[k].max - blur[k].min}%`,
              height: 4, background: AB_COLOR[k], opacity: 0.55, borderRadius: 2,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ElevationChart({ course }) {
  const W = 520, H = 70, pad = 4;
  const maxE = Math.max(1, ...course.elevationProfile.map(p => p.elev));
  const pts = course.elevationProfile.map(p => {
    const x = pad + p.frac * (W - pad * 2);
    const y = H - pad - (p.elev / maxE) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 56, display: "block" }}>
        <polyline points={`${pad},${H - pad} ${pts} ${W - pad},${H - pad}`} fill="rgba(255,210,63,0.18)" stroke="none" />
        <polyline points={pts} fill="none" stroke={C.yellow} strokeWidth="2" />
      </svg>
      <div style={{ display: "flex", gap: 10, fontSize: 10.5, color: C.sub, marginTop: 2 }}>
        <span>獲得標高目安 {Math.round(course.totalElevationGain)}</span>
        <span>山岳区間 {course.climbCount}</span>
        <span>難易度指数 {course.raceDifficultyRating}</span>
        {course.laps > 1 && <span style={{ color: C.yellow }}>周回コース 全{course.laps}周</span>}
      </div>
    </div>
  );
}

export function MultiStageCourseView({ race }) {
  const stageCount = race.stageCount || (race.stageTmpls ? race.stageTmpls.length : 2);
  const days = Array.from({ length: stageCount }, (_, i) => i + 1);
  const dayCourses = days.map(d => ({
    day: d,
    tmpl: race.stageTmpls ? race.stageTmpls[d - 1] : race.tmpl,
    course: generateCourse(race, `day${d}`),
  }));
  const maxE = Math.max(1, ...dayCourses.flatMap(dc => dc.course.elevationProfile.map(p => p.elev)));
  const W = 520, H = 70, pad = 4;
  const dayW = (W - pad * 2) / stageCount;
  return (
    <div>
      <div style={{ display: "flex", gap: 3, margin: "6px 0 3px" }}>
        {dayCourses.map(dc => (
          <div key={dc.day} style={{ flex: 1, display: "flex", gap: 2 }}>
            {dc.tmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 7, borderRadius: 3, background: SEG_COLOR[s[0]] }} />)}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", fontSize: 10, color: C.sub, marginBottom: 2 }}>
        {dayCourses.map(dc => (
          <div key={dc.day} style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {dc.day}日目・{dc.tmpl.kind}
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 56, display: "block" }}>
        {dayCourses.map(dc => {
          const x0 = pad + (dc.day - 1) * dayW;
          const pts = dc.course.elevationProfile.map(p => {
            const x = x0 + p.frac * dayW;
            const y = H - pad - (p.elev / maxE) * (H - pad * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ");
          return (
            <g key={dc.day}>
              <polyline points={`${x0.toFixed(1)},${H - pad} ${pts} ${(x0 + dayW).toFixed(1)},${H - pad}`} fill="rgba(255,210,63,0.18)" stroke="none" />
              <polyline points={pts} fill="none" stroke={C.yellow} strokeWidth="2" />
            </g>
          );
        })}
        {days.slice(1).map(d => {
          const x = pad + (d - 1) * dayW;
          return <line key={d} x1={x} y1="0" x2={x} y2={H} stroke="#5b6272" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.8" />;
        })}
      </svg>
      <div style={{ display: "flex", gap: 10, fontSize: 10.5, color: C.sub, marginTop: 2, flexWrap: "wrap" }}>
        <span>全{stageCount}日間ステージレース（縦線＝日の区切り）</span>
        <span>獲得標高目安 {Math.round(dayCourses.reduce((s, dc) => s + dc.course.totalElevationGain, 0))}（総合）</span>
      </div>
    </div>
  );
}
