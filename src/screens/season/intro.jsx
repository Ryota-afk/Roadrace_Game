// season.jsx より分割（Step8）：オンボーディング（intro/newgame_setup/scoutpolicy_initial/sponsor）
import React from "react";
import { loadMlLegends } from "../../breeding/breeding.js";
import { Btn, Eyebrow } from "../../components/ui.jsx";
import { fmtRelTime, overall } from "../../core/core.js";
import { TYPES } from "../../data/abilities.js";
import { MONTHS, UNLOCK_TEMPLATES } from "../../data/course.js";
import { DIFFICULTIES } from "../../data/progression.js";
import { C, FONT_B, FONT_D, FONT_M } from "../../data/theme.js";
import { CP_MILESTONES, SCOUT_POLICIES, applyCpMilestones, addProdigyRookie, bumpEquipLv, bumpRosterAbAll, clearSaveGame, hasSaveGame, pickMandateMonths, genSeasonObjective, objectiveStatusText } from "../../logic/support.js";
import { cpShopSeasonPerks, genScouts, initGame, legendToSeasonRider, loadGame, loadMeta, saveGameInfo } from "../../state/state.js";

export function renderSeasonIntroScreens(ctx) {
  const { askConfirm, diffChoice, g, metaWrap, setDiffChoice, setG, setSuperMode, setTeamNameChoice, teamNameChoice, wrap } = ctx;
  // v46(UI): 次のアクション（導線整理）。「intro」「newgame_setup」はまだ実在のチームが
  // 存在しない段階なのに、season専用のwrap()経由でSeasonHeader（クラスB1・あなたのチーム・
  // 予算等の初期化直後の仮値）が表示されてしまっていた。実際のチーム情報が確定するのは
  // 「この内容でゲーム開始」を押した後（scoutpolicy_initial以降）なので、それより前の
  // 2画面だけヘッダーの無いmetaWrapを使う。あわせてモード選択へ戻るボタンも追加した
  // （マイライフのcreate.jsxには元々あり、シーズン側だけ欠けていた非対称の解消）。
  if (g.screen === "intro") return metaWrap(
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 18, border: `1px solid ${C.line}` }}>
        <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 23, margin: "0 0 10px" }}>B1からPROの頂点へ</h2>
        <p style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.8, margin: 0 }}>
          1年＝1シーズン、出場は月1回。3月のチャンピオンシップ3位以内で昇格。PROクラスのみ年3戦のグランツール
          （春・夏・秋）が開催され、その全戦制覇がグランファイナルへの出場条件。グランファイナル優勝でクリア。
        </p>
      </div>
      {hasSaveGame() && (() => {
        const info = saveGameInfo();
        return (
          <Btn onClick={() => { const loaded = loadGame(); if (loaded) setG(loaded); }}>
            💾 続きから
            {info && <span style={{ display: "block", fontSize: 10.5, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>{info.teamName}・{info.classLabel}・{info.year}年目{info.savedAt ? ` — ${fmtRelTime(info.savedAt)}に保存` : ""}</span>}
          </Btn>
        );
      })()}
      <Btn outline={hasSaveGame()} onClick={() => {
        const doReset = () => { clearSaveGame(); setG(s => ({ ...initGame(), screen: "newgame_setup" })); };
        if (hasSaveGame()) askConfirm("保存データを消して最初から始めます。よろしいですか？", doReset);
        else doReset();
      }}>
        {hasSaveGame() ? "最初から（保存データは消えます）" : "スカウト方針の確認へ"}
      </Btn>
      <Btn outline color={C.sub} onClick={() => setSuperMode(null)}>← モード選択に戻る</Btn>
    </div>
  );

  if (g.screen === "newgame_setup") {
    const meta = loadMeta();
    const nextMilestone = CP_MILESTONES.find(m => meta.totalEarnedCP < m.cp);
    return metaWrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, border: `1px solid ${C.line}` }}>
          <Eyebrow color={C.yellow}>累計クリアポイント：{meta.totalEarnedCP}pt</Eyebrow>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>過去のプレイでクリアするたびに貯まっていく生涯合計値です。一度到達した永続ボーナス・難易度は消費しても失われません。</div>
        </div>
        <div>
          <Eyebrow>チーム名</Eyebrow>
          <input type="text" value={teamNameChoice} maxLength={16} placeholder="あなたのチーム"
            onChange={e => setTeamNameChoice(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 6, background: C.panel2, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FONT_B }} />
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>後から変更できます。</div>
        </div>
        <div>
          <Eyebrow>難易度を選択</Eyebrow>
          <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
            {DIFFICULTIES.map(d => {
              const locked = meta.totalEarnedCP < d.needCP;
              return (
                <button key={d.id} disabled={locked} onClick={() => setDiffChoice(d.id)}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: locked ? "default" : "pointer",
                    background: diffChoice === d.id ? "rgba(255,210,63,0.12)" : C.panel,
                    border: `1.5px solid ${diffChoice === d.id ? C.yellow : C.line}`, opacity: locked ? 0.5 : 1,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 14 }}>{d.label}</span>
                    {locked && <span style={{ fontSize: 11, color: C.red }}>🔒 累計{d.needCP}pt必要</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{d.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
        {(() => {
          // v38(#9 A-2): マイライフで育てた殿堂選手を、シーズンの創設メンバーとして1名招聘できる。
          // 「選手として育てた英雄を、監督として率いる」A案の核心ループ。全盛期をやや過ぎたベテランとして加入。
          const legends = [...loadMlLegends()].reverse();
          if (legends.length === 0) return null;
          const selIdx = g.legendRecruitIdx;
          return (
            <div>
              <Eyebrow color={"#e56cc8"}>🌳 レジェンド招聘（任意）</Eyebrow>
              <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 6px", lineHeight: 1.5 }}>マイライフで育てた引退済みの名選手を1名、創設メンバー（ベテラン）として迎えられます。</div>
              <div style={{ display: "grid", gap: 5, maxHeight: 210, overflowY: "auto" }}>
                {legends.map((leg, i) => {
                  const sel = selIdx === i;
                  return (
                    <button key={i} onClick={() => setG(s => ({ ...s, legendRecruitIdx: sel ? null : i }))}
                      style={{ textAlign: "left", padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                        background: sel ? "rgba(229,108,200,0.12)" : C.panel, border: `1.5px solid ${sel ? "#e56cc8" : C.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{sel ? "✔ " : ""}{leg.name}<span style={{ marginLeft: 6, fontSize: 10, color: TYPES[leg.type]?.color }}>{TYPES[leg.type]?.label}</span></span>
                        <span style={{ fontSize: 10.5, color: C.sub }}>OVR{leg.overall || "—"}{(leg.generation || 0) > 0 ? ` ・🧬${leg.generation}代目` : ""}</span>
                      </div>
                      {leg.nickname && <div style={{ fontSize: 10, color: C.purple, fontStyle: "italic" }}>「{leg.nickname}」</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
        <div>
          <Eyebrow>永続ボーナス（累計クリアポイントで自動解禁・消費なし）</Eyebrow>
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {CP_MILESTONES.map((m, i) => {
              const unlocked = meta.totalEarnedCP >= m.cp;
              const jackpot = m.label.startsWith("★");
              const accent = jackpot ? C.yellow : C.green;
              return (
                <div key={i} style={{
                  padding: jackpot ? "11px 12px" : "9px 12px", borderRadius: 10,
                  background: unlocked ? (jackpot ? "rgba(255,210,63,0.12)" : "rgba(125,208,160,0.1)") : C.panel,
                  border: `${jackpot ? 2 : 1.5}px solid ${unlocked ? accent : C.line}`, opacity: unlocked ? 1 : (jackpot ? 0.75 : 0.6),
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: unlocked ? accent : C.text, fontSize: jackpot ? 14.5 : 13.5 }}>
                      {unlocked ? "✔ " : "🔒 "}{m.label}
                    </span>
                    <span style={{ fontFamily: FONT_M, fontSize: 11.5, color: C.sub }}>累計{m.cp}pt</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{m.desc}</div>
                </div>
              );
            })}
          </div>
          {nextMilestone && <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>次のボーナスまであと{nextMilestone.cp - meta.totalEarnedCP}pt</div>}
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, border: `1px solid ${C.line}` }}>
          <Eyebrow color={C.green}>🏁 解禁コンテンツ（累計クリアポイントで新コース種別が出現）</Eyebrow>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {UNLOCK_TEMPLATES.map(t => {
              const unlocked = meta.totalEarnedCP >= t.unlockCP;
              return (
                <div key={t.kind} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, opacity: unlocked ? 1 : 0.55 }}>
                  <span style={{ color: unlocked ? C.text : C.sub }}>{unlocked ? "✅" : "🔒"} {t.kind}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>{TYPES[t.favors].label}有利</span></span>
                  <span style={{ fontFamily: FONT_M, fontSize: 11, color: unlocked ? C.green : C.sub }}>{unlocked ? "解禁済み" : `${t.unlockCP}ptで解禁`}</span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>解禁すると両モードのカレンダーに登場します。</div>
        </div>
        <Btn onClick={() => {
          const name = teamNameChoice.trim();
          // v46(UI): クリアポイントのリセットがCP交換所へ移設されたため、選択中の難易度が
          // （そちらでリセットされた等の理由で）既にロック済みになっているケースを開始直前に
          // 再検証し、その場合はeasyへ安全に倒す（ロック済み難易度のまま開始してしまう事故防止）。
          const safeDiff = DIFFICULTIES.find(d => d.id === diffChoice && meta.totalEarnedCP >= d.needCP) ? diffChoice : "easy";
          let base = applyCpMilestones({ ...initGame(), difficulty: safeDiff, teamName: name || "あなたのチーム" }, meta.totalEarnedCP);
          // v37: CPショップで購入済みのシーズン特典を適用
          const shop = cpShopSeasonPerks(meta);
          for (let i = 0; i < shop.prodigyRookie; i++) base = addProdigyRookie(base);
          if (shop.budget) base = { ...base, budget: base.budget + shop.budget };
          if (shop.equipLv) base = bumpEquipLv(base, shop.equipLv);
          if (shop.rosterBoost) base = bumpRosterAbAll(base, shop.rosterBoost);
          // v51(第12弾12-C): CP交換所の恒久上限拡張・年俸割引
          base = { ...base, rosterMaxBonus: shop.rosterMaxBonus, staffMaxBonus: shop.staffMaxBonus, salaryDiscountMul: shop.salaryDiscountMul };
          // v38(#9 A-2): 招聘したレジェンドを創設メンバーとしてロースターへ加える
          if (g.legendRecruitIdx != null) {
            const legends = [...loadMlLegends()].reverse();
            const leg = legends[g.legendRecruitIdx];
            const recruit = leg && legendToSeasonRider(leg);
            if (recruit) base = { ...base, roster: [...base.roster, recruit], captainId: recruit.id };
          }
          setG({ ...base, legendRecruitIdx: null, screen: "scoutpolicy_initial" });
        }}>この内容でゲーム開始 →</Btn>
        <Btn outline color={C.sub} onClick={() => setSuperMode(null)}>← モード選択に戻る</Btn>
      </div>
    );
  }

  if (g.screen === "scoutpolicy_initial") return wrap(
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#1f2b26", border: `1px solid ${C.green}`, borderRadius: 10, padding: "10px 14px" }}>
        <Eyebrow color={C.green}>初年度のスカウト方針</Eyebrow>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>4月に提示される新人候補5名の傾向を決めます。方針は毎年3月にも見直せます。</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(SCOUT_POLICIES).map(([k, p]) => (
          <button key={k} onClick={() => setG(s => ({ ...s, scoutPolicy: k }))} title={p.desc}
            style={{
              padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT_D,
              background: g.scoutPolicy === k ? C.purple : C.panel, color: g.scoutPolicy === k ? "#14171d" : C.sub,
              border: `1px solid ${g.scoutPolicy === k ? C.purple : C.line}`,
            }}>{p.label}</button>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: C.text }}>方針：{SCOUT_POLICIES[g.scoutPolicy].desc}</div>
      {/* v12バグ修正: initGame()の初期スカウト候補を先にランダム化しても、ここで固定シード4001を
          使ってgenScoutsを呼び直し上書きしていたため、方針決定ボタンを押すと結局毎回同じ顔ぶれに
          戻ってしまっていた。ここも新規ゲームのたびに変わる乱数シードを使うよう修正 */}
      <Btn onClick={() => setG(s => ({ ...s, scouts: genScouts(0, Date.now() % 999983, s.scoutPolicy, s.roster.map(r => r.name), s.staff?.scout || 0), screen: "sponsor" }))}>この方針で決定 → スポンサー選択へ</Btn>
    </div>
  );

  if (g.screen === "sponsor") return wrap(
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: C.panel, borderRadius: 10, padding: "10px 14px", borderLeft: `4px solid ${C.green}` }}>
        <Eyebrow color={C.green}>今季のメインスポンサー</Eyebrow>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>毎月の契約金＋ノルマ達成で年度末ボーナス。<span style={{ color: C.red }}>未達なら違約金</span>、<span style={{ color: C.red }}>指定レースを見送るとさらに違約金</span>が加算されます。</div>
      </div>
      {g.sponsorOffers.map((sp, i) => {
        // v40（第1候補②）：各スポンサーが複数レースにまたがる「中期目標」を提示（画面表示と契約時で同じシード）
        const objSeed = g.year * 7919 + i * 313 + g.classIdx * 17;
        const proposed = genSeasonObjective(objSeed, g.classIdx);
        const om = objectiveStatusText(proposed);
        return (
        <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontFamily: FONT_D, fontSize: 16, fontWeight: 700, color: C.text }}>{sp.name}</div>
            <span style={{ fontSize: 11, color: sp.style === "挑戦型" ? C.red : sp.style === "安定型" ? C.blue : C.yellow }}>{sp.style}</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.sub, margin: "4px 0 8px", lineHeight: 1.7 }}>
            月額 <span style={{ color: C.green, fontFamily: FONT_M }}>+{sp.monthly}万</span>
            ／ノルマ <span style={{ color: C.yellow, fontFamily: FONT_M }}>{sp.norma}pt</span><br />
            達成 <span style={{ color: C.green, fontFamily: FONT_M }}>+{sp.bonus}万</span>
            ／未達 <span style={{ color: C.red, fontFamily: FONT_M }}>-{sp.penalty}万</span><br />
            年間指定レース <span style={{ color: C.text, fontFamily: FONT_M }}>{sp.mandates}回</span>（出場でpt+30%ボーナス／見送ると-15万ずつ加算）
          </div>
          {om && (
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "7px 10px", margin: "0 0 9px", borderLeft: `3px solid ${C.purple}` }}>
              <div style={{ fontSize: 11.5, color: C.purple, fontWeight: 700 }}>🎯 中期目標「{om.icon} {om.label}」<span style={{ color: C.sub, fontWeight: 400 }}>（〜{MONTHS[om.deadline]}）</span></div>
              <div style={{ fontSize: 12, color: C.text, marginTop: 2, lineHeight: 1.5 }}>{om.desc}</div>
              <div style={{ fontSize: 11.5, marginTop: 3 }}>
                <span style={{ color: C.green }}>達成 +{proposed.budget}万・ノルマ+{proposed.points}pt</span>
                <span style={{ color: C.sub }}> ／ </span>
                <span style={{ color: C.red }}>未達 -{proposed.penalty}万</span>
              </div>
            </div>
          )}
          <Btn small color={C.green} onClick={() => setG(s => {
            const months = pickMandateMonths(sp.mandates, s.year * 555 + i * 91 + s.classIdx * 13);
            const objective = genSeasonObjective(s.year * 7919 + i * 313 + s.classIdx * 17, s.classIdx);
            const sponsor = { ...sp, mandateMonths: months, mandatesMet: 0, mandatesMissed: 0, objective };
            const om2 = objectiveStatusText(objective);
            return { ...s, sponsor, screen: "main", log: [...s.log, `【${MONTHS[s.month]}】${sp.name}と契約（ノルマ${sp.norma}pt／違約金${sp.penalty}万／指定レース${months.length}回／中期目標「${om2.label}」）`] };
          })}>この契約を結ぶ</Btn>
        </div>
        );
      })}
    </div>
  );


}
