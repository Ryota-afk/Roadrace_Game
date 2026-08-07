// season.jsx より分割（Step8）：移籍・イベント系（event/transferRequest/poachOffer/poachMarket/event_result）
import React from "react";
import { AbilityGrid, PersonaLine, TraitLine } from "../../components/panels.jsx";
import { Btn, Eyebrow } from "../../components/ui.jsx";
import { overall } from "../../core/core.js";
import { TYPES } from "../../data/abilities.js";
import { MONTHS } from "../../data/course.js";
import { C, FONT_D, FONT_M } from "../../data/theme.js";

export function renderSeasonTransferEventScreens(ctx) {
  const { askConfirm, g, grantTransferRequest, growthCap, resolveEvent, retainRider, poachRetain, poachAccept, poachSign, rosterMax, setG, wrap } = ctx;
  if (g.screen === "event" && g.pendingEvent) {
    const ev = g.pendingEvent;
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: "#2b2436", borderRadius: 12, padding: 18, borderTop: `4px solid ${C.purple}` }}>
          <Eyebrow color={C.purple}>チームの出来事 — {MONTHS[g.month]}</Eyebrow>
          <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 20, margin: "6px 0 10px" }}>{ev.title}</h2>
          <p style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.8, margin: 0 }}>{ev.text}</p>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {ev.choices.map((c, i) => (
            <Btn key={i} color={C.purple} onClick={() => resolveEvent(i)}>{c.label}</Btn>
          ))}
        </div>
      </div>
    );
  }

  // v28: 選手の移籍志願イベント
  if (g.screen === "transferRequest" && g.transferRequest) {
    const req = g.transferRequest;
    const r = g.roster.find(x => x.id === req.riderId);
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: "#2b1e1e", borderRadius: 12, padding: 18, borderTop: `4px solid ${C.red}` }}>
          <Eyebrow color={C.red}>移籍志願 — {MONTHS[g.month]}</Eyebrow>
          <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 19, margin: "6px 0 10px" }}>{req.name}が退団を申し出た</h2>
          <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.8, margin: 0 }}>
            「最近ずっと出番がなく、このチームでは自分の力を発揮できない。もっと走れる場所へ移りたい」——長くベンチが続いた{req.name}{r ? `（${TYPES[r.type].label}・OVR${overall(r)}）` : ""}が、真剣な面持ちで移籍を願い出てきました。
          </p>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <Btn color={C.green} disabled={g.budget < 30} onClick={retainRider}>慰留する（引き止め費用30万・残留＆調子+1）{g.budget < 30 ? "／資金不足" : ""}</Btn>
          <Btn outline color={C.red} onClick={() => askConfirm(`${req.name}の移籍志願を受け入れますか？この選手はチームを去ります。`, grantTransferRequest)}>志願を受け入れて送り出す</Btn>
        </div>
      </div>
    );
  }

  // v41: 被引き抜き（ライバルが自チームの主力を引き抜きに来る）。引き止めるか、移籍金を得て放出するか。
  if (g.screen === "poachOffer" && g.poachOffer) {
    const o = g.poachOffer;
    const r = g.roster.find(x => x.id === o.riderId);
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: "#2b1e1e", borderRadius: 12, padding: 18, borderTop: `4px solid #e8a13c` }}>
          <Eyebrow color={"#e8a13c"}>引き抜きオファー — {MONTHS[g.month]}</Eyebrow>
          <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 19, margin: "6px 0 10px" }}>
            <span style={{ color: o.teamColor }}>{o.team}</span>が{o.name}の獲得に動いた
          </h2>
          <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.8, margin: 0 }}>
            強豪<span style={{ color: o.teamColor, fontWeight: 700 }}>{o.team}</span>が、あなたの主力
            <span style={{ color: C.text, fontWeight: 700 }}>{o.name}</span>{r ? `（${TYPES[r.type].label}・OVR${overall(r)}）` : `（OVR${o.ovr}）`}
            に破格の移籍金<span style={{ color: C.yellow, fontFamily: FONT_M }}>{o.fee}万円</span>を提示してきました。放出すれば大きな資金が手に入りますが、
            主力を失い、しかも<span style={{ color: C.red }}>今後はライバルの一員として自チームの前に立ちはだかります</span>。引き止めるには慰留費用がかかります。
          </p>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <Btn color={C.green} disabled={g.budget < o.retainCost} onClick={poachRetain}>
            引き止める（慰留費用-{o.retainCost}万・残留＆調子+1）{g.budget < o.retainCost ? "／資金不足" : ""}
          </Btn>
          <Btn outline color={"#e8a13c"} onClick={() => askConfirm(`${o.name}を${o.team}へ放出し、移籍金${o.fee}万円を受け取りますか？この主力はチームを去ります。`, poachAccept)}>
            放出して移籍金+{o.fee}万を受け取る
          </Btn>
        </div>
      </div>
    );
  }

  // v41: 引き抜き市場（こちらが他チームの主力を引き抜く）。年1回・資金と枠が必要。
  if (g.screen === "poachMarket") {
    const targets = g.poachTargets || [];
    const done = g.poachDoneThisYear;
    const full = g.roster.length >= rosterMax;
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 10, padding: "10px 14px", borderLeft: `4px solid #e8a13c` }}>
          <Eyebrow color={"#e8a13c"}>🎯 引き抜き市場 — ライバルの主力を狙う</Eyebrow>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.7 }}>
            各ライバルチームの<span style={{ color: C.text }}>看板選手</span>を、移籍金を払って引き抜けます。<span style={{ color: C.yellow }}>引き抜きは1シーズンに1回まで</span>。
            成立すると相手は主力を失い、その選手は今後あなたのチームで走ります。移籍金は選手の実力と移籍意欲で決まります。
          </div>
          <div style={{ fontSize: 11.5, marginTop: 5, color: done ? C.red : full ? C.red : C.green }}>
            {done ? "今季の引き抜き枠は使用済みです（年度末にリセット）" : full ? `ロースターが満員です（最大${rosterMax}名）` : `資金 ${g.budget}万円／枠 ${g.roster.length}/${rosterMax}名`}
          </div>
        </div>
        {targets.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>現在、引き抜ける主力候補がいません。</div>}
        {targets.map(t => {
          const c = t.candidate, ty = TYPES[c.type];
          const afford = g.budget >= t.fee && !full && !done;
          return (
            <div key={t.id} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 15 }}>{c.name}</span>
                  <span style={{ marginLeft: 6, fontSize: 10.5, color: ty.color }}>{ty.label}</span>
                  <span style={{ marginLeft: 6, fontSize: 11, color: C.sub }}>{c.age}歳</span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: t.teamColor }}>● {t.team}</span>
                </div>
                <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 14 }}>{overall(c)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></span>
              </div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>移籍意欲：<span style={{ color: t.willLabel === "移籍に前向き" ? C.green : t.willLabel === "チームの看板" ? C.red : C.text }}>{t.willLabel}</span></div>
              <PersonaLine p={c.personality} />
              <TraitLine abilities={c.abilities} goldAbilities={c.goldAbilities} />
              <AbilityGrid r={c} cap={growthCap} />
              <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                <Btn small color={"#e8a13c"} disabled={!afford}
                  onClick={() => askConfirm(`${t.team}の${c.name}を移籍金${t.fee}万円で引き抜きますか？（今季の引き抜き枠を消費します）`, () => poachSign(t.id))}>
                  移籍金 {t.fee}万で引き抜く
                </Btn>
                {!afford && !done && !full && <span style={{ fontSize: 11, color: C.red }}>資金不足</span>}
              </div>
            </div>
          );
        })}
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  if (g.screen === "event_result" && g.eventResult) {
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${C.purple}` }}>
          <Eyebrow color={C.purple}>{g.eventResult.title}</Eyebrow>
          <p style={{ color: C.text, fontSize: 14, lineHeight: 1.8, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{g.eventResult.text}</p>
        </div>
        <Btn onClick={() => setG(s => ({ ...s, eventResult: null, screen: "main" }))}>続ける →</Btn>
      </div>
    );
  }


}
