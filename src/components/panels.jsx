// 表示用サブコンポーネント（Phase 4-1で main.jsx から分離）。
// 第13弾Phase3-D-3: 新トークン(T/FONT_DOT)へ全面移行。season側とも共有しているため、
// 「ゲージ型・バッジ型」（FatigueBar/AbilityGrid/DisciplineGrid/BlurGrid/TraitLine/PersonaLine/
// SubStatLine/ScoutBadge/CondFc）は元々自前の面（背景枠）を持たない断片であり、呼び出し側
// （season/mylife双方）が用意した面に載せる前提のまま。「リスト型」（StartListPanel/TitlesPanel/
// CourseRecordsPanel/AbilityFileList）は自前の面を持ち続ける——season側の呼び出し元
// （records/archive.jsx等）がSectionのような外枠を持たないため、面を剥がすとseasonが素の
// テキストになってしまう。マイライフ側はこれらをSectionで二重に囲わず直接呼ぶ（hub.jsx参照）。
// 色の方針（ユーザー決定・2026-08）：AB_COLOR（能力5色）・APT_GRADE_COLOR（適性8色）・
// 金の特殊能力/★2倍表記の黄金色は維持。それ以外の装飾色（下馬評◎○▲の3色等）は撤去し、
// 「自分の行だけアクセント」に一本化。絵文字は撤去、→★●等の機能記号は維持。
import React from "react";
import { ABILITY_CATEGORY_ORDER, APT_GRADE_COLOR, DISCIPLINES, DISCIPLINE_KEYS, aptGrade, buildDesc, disciplineScore, loadCourseRecords, raceForecast } from "../logic/support.js";
import { GOLD_CONDITIONS, fmtTime } from "../core/core.js";
import { ABILITIES, AB_COLOR, AB_KEYS, AB_LABEL, COND_FC_ARROW, COND_FC_COLOR, COND_FC_LABEL, PERSONALITIES, TYPES } from "../data/abilities.js";
import { SEG_COLOR, TEMPLATES } from "../data/course.js";
import { TITLE_DEFS } from "../data/progression.js";
import { FONT_DOT, T } from "../data/theme.js";
import { PARTS, PART_SLOTS, generateCourse } from "../sim/race.js";
import { loadTitles, totalTitleCount } from "../state/state.js";

// v46(UI): このバーは元々「60/90で色が変わる」「90に赤い目盛りがある」という形で
// しきい値を表現できていたのに、呼び出し側が「疲労（90超で故障リスク・60未満なら急いで
// 回復させる必要はありません）」という注釈を添えて同じことを文章で二重に説明していた
// （CLAUDE.md §7(c)）。注釈は削除し、代わりに90以上を薄い赤の危険域として塗って
// 「目盛りの右側＝危ない領域」が一目で分かるようにした。文章ではなく図で伝える。
// 疲労は良し悪しのある指標なので、good/accent/badの意味色を使う（単一アクセントの例外）。
export function FatigueBar({ v }) {
  const col = v >= 90 ? T.color.bad : v >= 60 ? T.color.accent : T.color.good;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: T.space.sm }}>
      <div style={{ flex: 1, height: 4, background: T.color.rule, position: "relative" }}>
        <div style={{ position: "absolute", left: "90%", right: 0, top: 0, height: 4, background: T.color.bad, opacity: 0.3 }} />
        <div style={{ width: `${v}%`, height: 4, background: col, position: "relative" }} />
        <div style={{ position: "absolute", left: "90%", top: -2, width: 1, height: 8, background: T.color.bad }} />
      </div>
      <span style={{ fontFamily: FONT_DOT, fontSize: T.size.caption, color: col, width: 26, textAlign: "right" }}>{Math.round(v)}</span>
    </div>
  );
}

export function SubStatLine({ r }) {
  if (r.accel == null && r.build == null && r.mental == null) return null;
  const col = (v) => v >= 75 ? T.color.accent : v >= 55 ? T.color.good : v >= 40 ? T.color.sub : T.color.bad;
  const item = (label, v) => (
    <span key={label} style={{ fontSize: T.size.caption, color: T.color.sub }}>
      {label}<span style={{ color: col(v), marginLeft: 2 }}>{Math.round(v)}</span>
    </span>
  );
  return (
    <div style={{ display: "flex", gap: T.space.md, marginTop: T.space.xs, flexWrap: "wrap", alignItems: "center" }}>
      {item("加速力", r.accel ?? 50)}
      <span style={{ fontSize: T.size.caption, color: T.color.sub }}>体格<span style={{ color: col(r.build ?? 50), marginLeft: 2 }}>{Math.round(r.build ?? 50)}</span><span style={{ marginLeft: 2 }}>（{buildDesc(r.build ?? 50)}）</span></span>
      {/* v43(マイライフ難易度調整Phase 1/2): 突破力・安定感・運（固定ステータス、buildと同じく非成長）をSeason/MyLife共通で表示 */}
      {item("突破力", r.breakthrough ?? 50)}
      {item("安定感", r.stability ?? 50)}
      {item("運", r.luck ?? 50)}
    </div>
  );
}

export function StartListPanel({ entrants, favors }) {
  const teams = {};
  entrants.forEach(e => { (teams[e.teamName] = teams[e.teamName] || { list: [] }).list.push(e); });
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
    <div style={{ background: T.color.surface, padding: T.space.md }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm, flexWrap: "wrap", gap: T.space.xs }}>
        <span>出走 {entrants.length}名・{rows.length}チーム</span>
        {myFc && <span>あなたは <span style={{ color: T.color.text }}>{myFc.mark ? myFc.mark.icon : "無印"}{myFc.mark ? myFc.mark.label : ""}</span>（{myFc.rank}番手）</span>}
      </div>
      {hasForecast && (
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.md }}>
          下馬評　<span style={{ color: T.color.text }}>◎ 本命</span>　<span style={{ color: T.color.text }}>○ 対抗</span>　<span style={{ color: T.color.text }}>▲ 注目</span>
        </div>
      )}
      {rows.map(([tn, t], i) => {
        const isPlayerTeam = t.list.some(e => e.team === "PLAYER");
        return (
          // 第32弾Phase B: チーム色の左罫線(borderLeft)を撤去（縦線禁止・CLAUDE.md §8）。
          // チーム識別は自チームのaccent色（下のチーム名色分け）で十分伝わる。
          <div key={tn} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
            <div style={{ fontSize: T.size.body, color: isPlayerTeam ? T.color.accent : T.color.text }}>{tn}</div>
            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2, lineHeight: 1.8 }}>
              {t.list.map((e, j) => {
                const fc = forecast.get(e);
                return (
                  <span key={j} style={{ color: e.isPlayerChar ? T.color.accent : T.color.sub, marginRight: T.space.sm }}>
                    {fc && fc.mark ? `${fc.mark.icon} ` : ""}{e.name}
                    {(e.isAce || e.isLegend) && <span> （{[e.isAce ? "エース" : null, e.isLegend ? "殿堂" : null].filter(Boolean).join("・")}）</span>}
                    <span style={{ marginLeft: 2 }}>{TYPES[e.type].label}</span>
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
    <div style={{ marginTop: T.space.xs }}>
      {abilities.map(id => {
        const t = ABILITIES[id];
        if (!t) return null;
        const isGold = !!(goldAbilities && goldAbilities.includes(id));
        return (
          <div key={id} style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>
            <span style={{ color: isGold ? T.color.accent : t.bad ? T.color.bad : T.color.text, marginRight: T.space.xs }}>
              {t.label}
            </span>
            {t.desc}
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
    <div style={{ background: T.color.surface, padding: T.space.md }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>
        <span>全プレイ・両モード通算</span><span style={{ color: T.color.accent }}>{total}</span>
      </div>
      {TITLE_DEFS.map((d, i) => (
        <div key={d.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body, padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
          <span style={{ color: T.color.sub }}>{d.label}</span>
          <span style={{ color: (t[d.key] || 0) > 0 ? T.color.accent : T.color.sub }}>{t[d.key] || 0}</span>
        </div>
      ))}
    </div>
  );
}

export function CondFc({ dir }) {
  if (dir == null) return null;
  const i = dir + 1;
  return <span style={{ fontSize: T.size.caption, color: COND_FC_COLOR[i], marginLeft: T.space.xs }} title={`来月の調子予報：${COND_FC_LABEL[i]}`}>予報{COND_FC_ARROW[i]}</span>;
}

export function CourseRecordsPanel() {
  const recs = loadCourseRecords();
  const kinds = TEMPLATES.map(t => t.kind);
  const anyRec = kinds.some(k => recs[k]);
  return (
    <div style={{ background: T.color.surface, padding: T.space.md }}>
      <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm, lineHeight: 1.7 }}>
        コース種別ごとの最速記録。全プレイ・両モードで共有されます。
      </div>
      {!anyRec && <div style={{ fontSize: T.size.body, color: T.color.sub }}>まだ記録はありません。レースを走ると刻まれていきます。</div>}
      {kinds.map((k, i) => {
        const r = recs[k];
        return (
          <div key={k} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
              <span style={{ color: T.color.text }}>{k}</span>
              {r ? (
                // 第60弾(devlog/wave60.md): 内部指標(speed)の生値ではなく、誰でも読めるタイムを
                // 表示する。旧セーブ（timeSec未保存）はタイム欄を省き、保持者・年だけ出す。
                <span style={{ fontSize: T.size.caption, color: T.color.sub }}>
                  {r.timeSec != null && <span style={{ color: T.color.accent, marginRight: T.space.sm }}>{fmtTime(r.timeSec)}</span>}
                  <span style={{ color: r.isPlayer ? T.color.accent : T.color.text }}>{r.holder}</span>
                  <span style={{ marginLeft: T.space.xs }}>（{r.year}年目）</span>
                </span>
              ) : <span style={{ fontSize: T.size.caption, color: T.color.sub }}>記録なし</span>}
            </div>
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
    <div style={{ background: T.color.surface, padding: T.space.md }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.md }}>
        <span>特殊能力図鑑</span><span style={{ color: T.color.accent }}>{discoveredCount} / {allIds.length} 発見済み</span>
      </div>
      {ABILITY_CATEGORY_ORDER.map(cat => {
        const ids = allIds.filter(id => ABILITIES[id].category === cat);
        if (ids.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: T.space.md }}>
            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.xs }}>{cat}</div>
            {ids.map((id, i) => {
              const t = ABILITIES[id];
              const found = normalSet.has(id);
              const gold = goldSet.has(id);
              const goldable = !!GOLD_CONDITIONS[id];
              return (
                <div key={id} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: T.space.sm }}>
                    <span style={{ fontSize: T.size.head, color: !found ? T.color.sub : gold ? T.color.accent : t.bad ? T.color.bad : T.color.text }}>{found ? t.label : "???"}</span>
                    <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none" }}>
                      {!found ? "未発見" : goldable && !gold ? "金に進化する" : ""}
                    </span>
                  </div>
                  {found && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>{t.desc}</div>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function PersonaLine({ p }) {
  const per = PERSONALITIES[p];
  if (!per) return null;
  return (
    <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>
      <span style={{ color: p === "genius" ? T.color.accent : T.color.text, marginRight: T.space.xs }}>性格：{per.label}</span>
      {per.desc}
    </div>
  );
}

export function AbilityGrid({ r, cap = 88 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: T.space.sm, marginTop: T.space.sm }}>
      {AB_KEYS.map(k => {
        const partBonus = r.parts ? PART_SLOTS.reduce((s, sl) => s + ((r.parts[sl] && PARTS[r.parts[sl]].ab[k]) || 0), 0) : 0;
        const broke = r[k] >= cap;
        // v34(UI): 成長の伸びしろを可視化。現在値のバー＋成長上限(cap)までの薄い帯＋上限マーカー。
        const valPct = Math.min(100, r[k] + partBonus);
        const capPct = Math.min(100, cap);
        const room = Math.max(0, Math.round(cap - r[k]));
        return (
          // 第32弾Phase B R2: 5列の密な並びなのでラベルはmicro(8)、能力数値はlabel(11)へ。
          <div key={k}>
            <div style={{ fontSize: T.size.micro, color: T.color.sub }}>{AB_LABEL[k]}</div>
            <div style={{ fontSize: T.size.label, color: broke ? T.color.accent : T.color.text }}>
              {Math.round(r[k])}{partBonus > 0 && <span style={{ color: T.color.accent, fontSize: T.size.micro }}>+{partBonus}</span>}
              {!broke && room > 0 && <span style={{ color: T.color.sub, fontSize: T.size.micro }}> +{room}</span>}
            </div>
            <div style={{ position: "relative", height: 4, background: T.color.rule, marginTop: 3 }} title={broke ? "限界突破" : `伸びしろ +${room}（上限${Math.round(cap)}）`}>
              {!broke && capPct > valPct && <div style={{ position: "absolute", left: `${valPct}%`, width: `${capPct - valPct}%`, height: 4, background: AB_COLOR[k], opacity: 0.3 }} />}
              <div style={{ position: "absolute", left: 0, width: `${valPct}%`, height: 4, background: broke ? T.color.accent : AB_COLOR[k] }} />
              <div style={{ position: "absolute", left: `${capPct}%`, top: -2, width: 1, height: 8, background: broke ? T.color.accent : T.color.sub, transform: "translateX(-1px)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DisciplineGrid({ r, highlightKey }) {
  return (
    // 第32弾Phase B R2: AbilityGrid/BlurGridと同じ密な5列。ラベルmicro(8)・数値label(11)。
    // グレード文字（S〜G）は主役の判定記号なのでhead(16)のまま。
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: T.space.sm, marginTop: T.space.xs }}>
      {DISCIPLINE_KEYS.map(k => {
        const score = disciplineScore(r, k);
        const hi = k === highlightKey;
        // v38(#9 B-1): ウイポ風の S〜G 適性グレードを併記（一目でどの地形が得意か読める）
        const grade = aptGrade(score);
        const gc = APT_GRADE_COLOR[grade] || T.color.sub;
        return (
          <div key={k}>
            <div style={{ fontSize: T.size.micro, color: hi ? T.color.accent : T.color.sub }}>{DISCIPLINES[k].label}{hi ? " ★" : ""}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: T.space.xs }}>
              <span style={{ fontSize: T.size.head, fontWeight: 700, color: gc, lineHeight: 1 }}>{grade}</span>
              <span style={{ fontSize: T.size.caption, color: hi ? T.color.accent : T.color.sub }}>{score}</span>
            </div>
            <div style={{ height: 3, background: T.color.rule, marginTop: 3 }}>
              <div style={{ height: 3, width: `${Math.min(100, score)}%`, background: gc }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// v51(第11弾Phase3・3-C/3-D): 他チーム選手の査定バッジ。段階（scout.stage）ごとに粒度だけを
// 変える（帯→適性グレード→数値）。乱数のブレは使わない（画面を開くたび数字が揺れて
// 壊れて見える事故を構造的に防ぐため。詳細はdevlog/wave11.md Phase3参照）。
// 未開示（stage0）は一言で示し、長い説明文は書かない（CLAUDE.md §7）。
export function ScoutBadge({ scout, compact }) {
  if (!scout || scout.stage < 1) {
    return <span style={{ fontSize: T.size.caption, color: T.color.sub }}>未分析</span>;
  }
  if (scout.stage === 1) {
    return <span style={{ fontSize: T.size.caption, color: T.color.sub }}>総合力 <span style={{ color: T.color.text }}>{scout.ovrBand}</span></span>;
  }
  if (scout.stage === 2) {
    return (
      <span style={{ display: "inline-flex", gap: T.space.xs }}>
        {DISCIPLINE_KEYS.map(k => {
          const g = scout.grades[k];
          return <span key={k} title={DISCIPLINES[k].label} style={{ fontSize: T.size.caption, fontWeight: 700, color: APT_GRADE_COLOR[g] || T.color.sub }}>{g}</span>;
        })}
      </span>
    );
  }
  // stage3: 実数値
  if (compact) {
    return <span style={{ fontSize: T.size.caption, color: T.color.text }}>総合力 <span style={{ color: T.color.accent }}>{scout.ovr}</span></span>;
  }
  return (
    <span style={{ display: "inline-flex", gap: T.space.sm, fontSize: T.size.caption, color: T.color.sub }}>
      <span>平{scout.flat}</span><span>登{scout.climb}</span><span>スプ{scout.sprint}</span><span>スタ{scout.stamina}</span><span>独{scout.solo}</span>
    </span>
  );
}

export function BlurGrid({ blur }) {
  return (
    // 第32弾Phase B R2: AbilityGridと同じ密な5列。ラベルmicro(8)・数値label(11)。
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: T.space.sm, marginTop: T.space.sm }}>
      {AB_KEYS.map(k => (
        <div key={k}>
          <div style={{ fontSize: T.size.micro, color: T.color.sub }}>{AB_LABEL[k]}</div>
          <div style={{ fontSize: T.size.label, color: T.color.sub }}>{blur[k].min}〜{blur[k].max}</div>
          <div style={{ height: 4, background: T.color.rule, position: "relative", marginTop: 2 }}>
            <div style={{
              position: "absolute", left: `${blur[k].min}%`, width: `${blur[k].max - blur[k].min}%`,
              height: 4, background: AB_COLOR[k], opacity: 0.55,
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
        <polyline points={`${pad},${H - pad} ${pts} ${W - pad},${H - pad}`} fill="rgba(242,201,76,0.16)" stroke="none" />
        <polyline points={pts} fill="none" stroke={T.color.accent} strokeWidth="2" />
      </svg>
      <div style={{ display: "flex", gap: T.space.md, fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>
        <span>獲得標高目安 {Math.round(course.totalElevationGain)}</span>
        <span>山岳区間 {course.climbCount}</span>
        <span>難易度指数 {course.raceDifficultyRating}</span>
        {course.laps > 1 && <span style={{ color: T.color.accent }}>周回コース 全{course.laps}周</span>}
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
            {dc.tmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 7, background: SEG_COLOR[s[0]] }} />)}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", fontSize: T.size.caption, color: T.color.sub, marginBottom: 2 }}>
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
              <polyline points={`${x0.toFixed(1)},${H - pad} ${pts} ${(x0 + dayW).toFixed(1)},${H - pad}`} fill="rgba(242,201,76,0.16)" stroke="none" />
              <polyline points={pts} fill="none" stroke={T.color.accent} strokeWidth="2" />
            </g>
          );
        })}
        {days.slice(1).map(d => {
          const x = pad + (d - 1) * dayW;
          return <line key={d} x1={x} y1="0" x2={x} y2={H} stroke={T.color.rule} strokeWidth="1.5" strokeDasharray="3,3" opacity="0.9" />;
        })}
      </svg>
      <div style={{ display: "flex", gap: T.space.md, fontSize: T.size.caption, color: T.color.sub, marginTop: 2, flexWrap: "wrap" }}>
        <span>全{stageCount}日間ステージレース（縦線＝日の区切り）</span>
        <span>獲得標高目安 {Math.round(dayCourses.reduce((s, dc) => s + dc.course.totalElevationGain, 0))}（総合）</span>
      </div>
    </div>
  );
}
