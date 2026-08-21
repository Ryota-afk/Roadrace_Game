// season.jsx より分割（Step8）：移籍・イベント系（event/transferRequest/poachOffer/poachMarket/event_result）
// 第13弾Phase3-D-4-c：kit.jsxへ全面移行。通知3画面の色付き上枠線を廃止し種別は見出しの言葉で
// 伝える。poachMarketはRiderCard（market/transferと同型）へ。詳細はdevlog/wave13.md参照。
import React from "react";
import { AbilityGrid, PersonaLine, TraitLine } from "../../components/panels.jsx";
import { PrimaryBtn, QuietBtn, Section, ShopBtn } from "../../components/kit.jsx";
import { RiderCard } from "../../components/riderCard.jsx";
import { overall } from "../../core/core.js";
import { TYPES } from "../../data/abilities.js";
import { MONTHS } from "../../data/course.js";
import { T } from "../../data/theme.js";

export function renderSeasonTransferEventScreens(ctx) {
  const { askConfirm, g, grantTransferRequest, growthCap, resolveEvent, retainRider, poachRetain, poachAccept, poachSign, rosterMax, setG, wrap } = ctx;
  if (g.screen === "event" && g.pendingEvent) {
    const ev = g.pendingEvent;
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Section padded title={`チームの出来事 — ${MONTHS[g.month]}`}>
          <div style={{ fontSize: T.size.title, color: T.color.text }}>{ev.title}</div>
          <div style={{ fontSize: T.size.body, color: T.color.sub, lineHeight: 1.8, marginTop: T.space.sm }}>{ev.text}</div>
        </Section>
        <div style={{ display: "grid", gap: T.space.sm }}>
          {ev.choices.map((c, i) => (
            <QuietBtn key={i} color={T.color.action} onClick={() => resolveEvent(i)}>{c.label}</QuietBtn>
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
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Section padded title={`移籍志願 — ${MONTHS[g.month]}`}>
          <div style={{ fontSize: T.size.title, color: T.color.text }}>{req.name}が退団を申し出た</div>
          <div style={{ fontSize: T.size.body, color: T.color.sub, lineHeight: 1.8, marginTop: T.space.sm }}>
            「最近ずっと出番がなく、このチームでは自分の力を発揮できない。もっと走れる場所へ移りたい」——長くベンチが続いた{req.name}{r ? `（${TYPES[r.type].label}・OVR${overall(r)}）` : ""}が、真剣な面持ちで移籍を願い出てきました。
          </div>
        </Section>
        <div style={{ display: "grid", gap: T.space.sm }}>
          <PrimaryBtn disabled={g.budget < 30} onClick={retainRider}>慰留する（慰留費用30万・残留＆調子+1）{g.budget < 30 ? "／資金不足" : ""}</PrimaryBtn>
          <QuietBtn color={T.color.bad} onClick={() => askConfirm(`${req.name}の移籍志願を受け入れますか？この選手はチームを去ります。`, grantTransferRequest, "送り出す")}>志願を受け入れて送り出す</QuietBtn>
        </div>
      </div>
    );
  }

  // v41: 被引き抜き（ライバルが自チームの主力を引き抜きに来る）。引き止めるか、移籍金を得て放出するか。
  if (g.screen === "poachOffer" && g.poachOffer) {
    const o = g.poachOffer;
    const r = g.roster.find(x => x.id === o.riderId);
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Section padded title={`引き抜きオファー — ${MONTHS[g.month]}`}>
          <div style={{ fontSize: T.size.title, color: T.color.text }}>{o.team}が{o.name}の獲得に動いた</div>
          <div style={{ fontSize: T.size.body, color: T.color.sub, lineHeight: 1.8, marginTop: T.space.sm }}>
            強豪{o.team}が、あなたの主力{o.name}{r ? `（${TYPES[r.type].label}・OVR${overall(r)}）` : `（OVR${o.ovr}）`}に破格の移籍金
            <span style={{ color: T.color.accent }}> {o.fee}万円</span>を提示してきました。放出すれば大きな資金が手に入りますが、
            主力を失い、今後はライバルの一員として自チームの前に立ちはだかります。引き止めるには慰留費用がかかります。
          </div>
        </Section>
        <div style={{ display: "grid", gap: T.space.sm }}>
          <PrimaryBtn disabled={g.budget < o.retainCost} onClick={poachRetain}>
            慰留する（慰留費用-{o.retainCost}万・残留＆調子+1）{g.budget < o.retainCost ? "／資金不足" : ""}
          </PrimaryBtn>
          <QuietBtn color={T.color.bad} onClick={() => askConfirm(`${o.name}を${o.team}へ放出し、移籍金${o.fee}万円を受け取りますか？この主力はチームを去ります。`, poachAccept, "放出する")}>
            放出して移籍金+{o.fee}万を受け取る
          </QuietBtn>
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
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Section title="引き抜き市場">
          <div style={{ fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.7 }}>
            各ライバルチームの看板選手を、移籍金を払って引き抜けます（1シーズンに1回まで）。
            成立すると相手は主力を失い、その選手は今後あなたのチームで走ります。移籍金は選手の実力と移籍意欲で決まります。
          </div>
          <div style={{ fontSize: T.size.caption, marginTop: T.space.sm, color: done || full ? T.color.bad : T.color.good }}>
            {done ? "今季の引き抜き枠は使用済みです（年度末にリセット）" : full ? `ロースターが満員です（最大${rosterMax}名）` : `資金 ${g.budget}万円／枠 ${g.roster.length}/${rosterMax}名`}
          </div>
        </Section>
        {targets.length === 0 && <div style={{ fontSize: T.size.body, color: T.color.sub }}>現在、引き抜ける主力候補がいません。</div>}
        {targets.map((t, i) => {
          const c = t.candidate;
          const afford = g.budget >= t.fee && !full && !done;
          return (
            <RiderCard key={t.id} r={c} first={i === 0} ovr={overall(c)}
              sub={`${c.age}歳・${t.team}`} subColor={t.teamColor}
              footer={<ShopBtn onClick={() => askConfirm(`${t.team}の${c.name}を移籍金${t.fee}万円で引き抜きますか？（今季の引き抜き枠を消費します）`, () => poachSign(t.id), "引き抜く")} disabled={!afford}>移籍金 {t.fee}万で引き抜く</ShopBtn>}>
              <div style={{ fontSize: T.size.caption, color: T.color.sub }}>移籍意欲：<span style={{ color: t.willLabel === "移籍に前向き" ? T.color.good : t.willLabel === "チームの看板" ? T.color.bad : T.color.text }}>{t.willLabel}</span></div>
              <PersonaLine p={c.personality} />
              <TraitLine abilities={c.abilities} goldAbilities={c.goldAbilities} />
              <AbilityGrid r={c} cap={growthCap} />
            </RiderCard>
          );
        })}
        <QuietBtn onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</QuietBtn>
      </div>
    );
  }

  if (g.screen === "event_result" && g.eventResult) {
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Section padded title={g.eventResult.title}>
          <div style={{ fontSize: T.size.body, color: T.color.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{g.eventResult.text}</div>
        </Section>
        <PrimaryBtn onClick={() => setG(s => ({ ...s, eventResult: null, screen: "main" }))}>続ける</PrimaryBtn>
      </div>
    );
  }


}
