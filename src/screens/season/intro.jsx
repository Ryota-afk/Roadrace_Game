// season.jsx より分割（Step8）：オンボーディング（intro/newgame_setup/scoutpolicy_initial/sponsor）
// 第13弾Phase3-D-4-c：kit.jsxへ全面移行。newgame_setupの永続ボーナスは全列挙をやめ、
// cpMilestoneSummary()で「今回何が効くか」を要約する（争点1・案A）。sponsorは3社比較表＋
// SelectRow＋主ボタン1つへ（争点2・案B）。詳細はdevlog/wave13.md参照。
import React from "react";
import { loadMlLegends } from "../../breeding/breeding.js";
import { Item, PrimaryBtn, QuietBtn, Section, SelectRow } from "../../components/kit.jsx";
import { fmtRelTime, overall } from "../../core/core.js";
import { TYPES } from "../../data/abilities.js";
import { MONTHS } from "../../data/course.js";
import { DIFFICULTIES } from "../../data/progression.js";
import { FONT_DOT, T } from "../../data/theme.js";
import { CP_MILESTONES, SCOUT_POLICIES, applyCpMilestones, addProdigyRookie, bumpRosterAbAll, clearSaveGame, cpMilestoneSummary, hasSaveGame, pickMandateMonths, genSeasonObjective, objectiveStatusText } from "../../logic/support.js";
import { cpShopSeasonPerks, genMonthRaces, genScouts, initGame, legendToSeasonRider, loadGame, loadMeta, saveGameInfo, seasonRaceFocus } from "../../state/state.js";
import { findUnsupportedChars } from "../../domain/shared/textInput.js";

export function renderSeasonIntroScreens(ctx) {
  const { askConfirm, diffChoice, g, metaWrap, setDiffChoice, setG, setSuperMode, setTeamNameChoice, teamNameChoice, wrap } = ctx;
  if (g.screen === "intro") {
    const saved = hasSaveGame();
    return metaWrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        {/* 第63弾(devlog/wave63.md): 旧文言は3行に未定義の固有名詞7つ（B1/PRO/チャンピオンシップ/
            グランツール/グランファイナル/全戦制覇/クリア）を詰め込み、しかも「毎月何をするか」より
            先に勝利条件を説明していた。ここでは「まず1行で何をするか」→「毎月やること」の順に
            並べ替え、固有名詞は初回は出さない（クラス名は開始後すぐヘッダーで実際に目にする）。 */}
        <Section padded title="チームを率いる">
          <div style={{ fontSize: T.size.title, color: T.color.text }}>3部リーグの底から、頂点へ</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.8, marginTop: T.space.xs }}>
            監督として選手を集め、毎月1戦を選んで戦います。1年戦って上位に入れば、ひとつ上のクラスへ。
          </div>
        </Section>
        <div style={{ background: T.color.surface, padding: `0 ${T.space.md}px` }}>
          <Item first label="毎月やること" value="レースを1つ選んで出る" />
          <Item label="1年の区切り" value="3月の大一番で昇格が決まる" />
          <Item label="最後の目標" value="最上位クラスで年間王者になる" />
        </div>
        {saved && (() => {
          const info = saveGameInfo();
          return (
            <div>
              <PrimaryBtn onClick={() => { const loaded = loadGame(); if (loaded) setG(loaded); }}>続きから</PrimaryBtn>
              {info && <div style={{ fontSize: T.size.caption, color: T.color.sub, margin: `-${T.space.xs}px 0 ${T.space.sm}px`, textAlign: "center" }}>{info.teamName}・{info.classLabel}・{info.year}年目{info.savedAt ? ` — ${fmtRelTime(info.savedAt)}に保存` : ""}</div>}
            </div>
          );
        })()}
        {saved
          ? <QuietBtn color={T.color.bad} onClick={() => askConfirm("保存データを消して最初から始めます。よろしいですか？", () => { clearSaveGame(); setG(s => ({ ...initGame(), screen: "newgame_setup" })); }, "消して始める")}>最初から（保存データは消えます）</QuietBtn>
          : <PrimaryBtn onClick={() => { clearSaveGame(); setG(s => ({ ...initGame(), screen: "newgame_setup" })); }}>スカウト方針の確認へ</PrimaryBtn>}
        <QuietBtn onClick={() => setSuperMode(null)}>← モード選択に戻る</QuietBtn>
      </div>
    );
  }

  if (g.screen === "newgame_setup") {
    const meta = loadMeta();
    const nextMilestone = CP_MILESTONES.find(m => meta.totalEarnedCP < m.cp);
    const teamNameBadChars = findUnsupportedChars(teamNameChoice);
    // 第70弾(devlog/wave70.md): 開幕ブーストは難易度で効き方が変わる（CP_BOOST_DIFF_MUL）ため、
    // プレビューも実際に開始ボタンが使うsafeDiffと同じロジックで難易度を確定させてから渡す
    // （ロック中の難易度を選択中に見せかけの数値が出ないようにする）。
    const previewDiff = DIFFICULTIES.find(d => d.id === diffChoice && meta.totalEarnedCP >= d.needCP) ? diffChoice : "easy";
    const fx = cpMilestoneSummary(meta.totalEarnedCP, previewDiff);
    const legends = [...loadMlLegends()].reverse();
    return metaWrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Item first label="累計クリアポイント" value={`${meta.totalEarnedCP}pt`}
          detail="過去のプレイでクリアするたびに貯まる生涯合計値です。一度到達した永続ボーナス・難易度は消費しても失われません。" />
        <div>
          <div style={{ fontSize: T.size.caption, color: T.color.accent, marginBottom: T.space.sm }}>チーム名</div>
          <input type="text" value={teamNameChoice} maxLength={16} placeholder="あなたのチーム"
            onChange={e => setTeamNameChoice(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: T.color.surfaceUp, color: T.color.text, border: `1px solid ${teamNameBadChars.length ? T.color.bad : T.color.rule}`, padding: T.space.sm, fontSize: T.size.body, fontFamily: FONT_DOT }} />
          {teamNameBadChars.length > 0
            ? <div style={{ fontSize: T.size.caption, color: T.color.bad, marginTop: T.space.xs }}>「{teamNameBadChars.join("")}」は使えません</div>
            : <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>後から変更できます。</div>}
        </div>
        <div>
          <Section title="難易度" padded={false}>
            {DIFFICULTIES.map((d, i) => {
              const locked = meta.totalEarnedCP < d.needCP;
              return (
                <div key={d.id} style={{ opacity: locked ? 0.5 : 1 }}>
                  <SelectRow first={i === 0} label={d.label} selected={diffChoice === d.id}
                    detail={locked ? `${d.desc}・累計${d.needCP}pt必要` : d.desc}
                    onClick={() => !locked && setDiffChoice(d.id)} />
                </div>
              );
            })}
          </Section>
        </div>
        {legends.length > 0 && (
          <div>
            <Section title="レジェンド招聘（任意）" padded={false}>
              <div style={{ padding: `0 ${T.space.md}px ${T.space.sm}px`, fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.6 }}>
                マイライフで育てた引退済みの名選手を1名、創設メンバー（ベテラン）として迎えられます。
              </div>
              {legends.map((leg, i) => {
                const sel = g.legendRecruitIdx === i;
                const t = TYPES[leg.type];
                const gen = (leg.generation || 0) > 0 ? `・${leg.generation}代目` : "";
                const nick = leg.nickname ? `・「${leg.nickname}」` : "";
                return (
                  <SelectRow key={i} first={i === 0} label={leg.name} selected={sel}
                    detail={`${t ? t.label : ""}・OVR${leg.overall || "—"}${gen}${nick}`}
                    onClick={() => setG(s => ({ ...s, legendRecruitIdx: sel ? null : i }))} />
                );
              })}
            </Section>
          </div>
        )}
        {meta.totalEarnedCP > 0 && (
          <Section title="開幕ボーナス（自動適用）">
            {fx.budget > 0 && <Item first label="開幕資金" value={`+${fx.budget}万円`} />}
            {fx.abAll > 0 && <Item first={fx.budget === 0} label="初期選手の能力" value={`+${fx.abAll}`} />}
            {fx.rookie > 0 && <Item label="逸材新人" value={`${fx.rookie}名`} />}
            {fx.items > 0 && <Item label="開幕アイテム" value={`各${fx.items}個`} />}
            {nextMilestone && (
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm }}>
                次の解禁まであと{nextMilestone.cp - meta.totalEarnedCP}pt（{nextMilestone.label.replace(/^★+\s*/, "")}）。全一覧は「生涯評価」にあります。
              </div>
            )}
          </Section>
        )}
        <PrimaryBtn disabled={teamNameBadChars.length > 0} onClick={() => {
          const name = teamNameChoice.trim();
          // v46(UI): クリアポイントのリセットがCP交換所へ移設されたため、選択中の難易度が
          // （そちらでリセットされた等の理由で）既にロック済みになっているケースを開始直前に
          // 再検証し、その場合はeasyへ安全に倒す（ロック済み難易度のまま開始してしまう事故防止）。
          const safeDiff = DIFFICULTIES.find(d => d.id === diffChoice && meta.totalEarnedCP >= d.needCP) ? diffChoice : "easy";
          let base = applyCpMilestones({ ...initGame(), difficulty: safeDiff, teamName: name || "あなたのチーム" }, meta.totalEarnedCP, safeDiff);
          // v37: CPショップで購入済みのシーズン特典を適用（第70弾: 強さ系はsafeDiffでスケーリング）
          const shop = cpShopSeasonPerks(meta, safeDiff);
          for (let i = 0; i < shop.prodigyRookie; i++) base = addProdigyRookie(base);
          if (shop.budget) base = { ...base, budget: base.budget + shop.budget };
          if (shop.rosterBoost) base = bumpRosterAbAll(base, shop.rosterBoost);
          // v51(第12弾12-C): CP交換所の恒久上限拡張・年俸割引
          base = { ...base, rosterMaxBonus: shop.rosterMaxBonus, staffMaxBonus: shop.staffMaxBonus, salaryDiscountMul: shop.salaryDiscountMul };
          // 第70弾(devlog/wave70.md): 出走計画（s_plan1/s_plan2）。initGame()内部の1年目1月の
          // 候補はまだこの特典を知らないため、ここで作り直す（raceEntryPlanはid/cls/lockedのみ
          // 参照しtmpl/nameは見ないため再計算不要）。
          base = { ...base, raceFocusSlots: shop.focusSlots };
          if (shop.focusSlots > 0) {
            base = { ...base, races: genMonthRaces(1, 0, 0, 0, null, [], seasonRaceFocus(base.roster), shop.focusSlots) };
          }
          // v38(#9 A-2): 招聘したレジェンドを創設メンバーとしてロースターへ加える
          if (g.legendRecruitIdx != null) {
            const leg = legends[g.legendRecruitIdx];
            const recruit = leg && legendToSeasonRider(leg);
            if (recruit) base = { ...base, roster: [...base.roster, recruit], captainId: recruit.id };
          }
          setG({ ...base, legendRecruitIdx: null, screen: "scoutpolicy_initial" });
        }}>この内容でゲーム開始</PrimaryBtn>
        <QuietBtn onClick={() => setSuperMode(null)}>← モード選択に戻る</QuietBtn>
      </div>
    );
  }

  if (g.screen === "scoutpolicy_initial") return wrap(
    <div style={{ display: "grid", gap: T.space.lg }}>
      <Section title="初年度のスカウト方針" padded={false}>
        <div style={{ padding: `0 ${T.space.md}px ${T.space.sm}px`, fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.6 }}>
          4月に提示される新人候補5名の傾向を決めます。方針は毎年3月にも見直せます。
        </div>
        {Object.entries(SCOUT_POLICIES).map(([k, p], i) => (
          <SelectRow key={k} first={i === 0} label={p.label} detail={p.desc} selected={g.scoutPolicy === k}
            onClick={() => setG(s => ({ ...s, scoutPolicy: k }))} />
        ))}
      </Section>
      {/* v12バグ修正: initGame()の初期スカウト候補を先にランダム化しても、ここで固定シード4001を
          使ってgenScoutsを呼び直し上書きしていたため、方針決定ボタンを押すと結局毎回同じ顔ぶれに
          戻ってしまっていた。ここも新規ゲームのたびに変わる乱数シードを使うよう修正 */}
      <PrimaryBtn onClick={() => setG(s => ({ ...s, scouts: genScouts(0, Date.now() % 999983, s.scoutPolicy, s.roster.map(r => r.name), s.staff?.scout || 0), screen: "sponsor" }))}>この方針で決定 → スポンサー選択へ</PrimaryBtn>
    </div>
  );

  if (g.screen === "sponsor") {
    const offers = g.sponsorOffers;
    const selIdx = g.sponsorChoiceIdx ?? 0;
    const objectives = offers.map((sp, i) => {
      const objSeed = g.year * 7919 + i * 313 + g.classIdx * 17;
      const proposed = genSeasonObjective(objSeed, g.classIdx);
      return { proposed, om: objectiveStatusText(proposed) };
    });
    const rows = [
      { label: "月額", vals: offers.map(sp => `+${sp.monthly}万`) },
      { label: "ノルマ", vals: offers.map(sp => `${sp.norma}pt`) },
      { label: "達成", vals: offers.map(sp => `+${sp.bonus}万`) },
      { label: "未達", vals: offers.map(sp => `-${sp.penalty}万`) },
      { label: "指定", vals: offers.map(sp => `年${sp.mandates}回`) },
    ];
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <div>
          <Section title="今季のメインスポンサー" padded={false}>
            <div style={{ padding: `0 ${T.space.md}px ${T.space.sm}px`, fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.6 }}>
              毎月の契約金＋ノルマ達成で年度末ボーナス。未達なら違約金、指定レースを見送るとさらに違約金が加算されます。
            </div>
          </Section>
        </div>
        <div style={{ background: T.color.surface, padding: T.space.md }}>
          <div style={{ display: "flex", gap: T.space.sm }}>
            <span style={{ width: 44, flex: "none" }} />
            {offers.map((sp, i) => (
              <span key={i} style={{ flex: 1, textAlign: "right", fontSize: T.size.caption, color: T.color.sub, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sp.name}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: T.space.sm, marginTop: 2 }}>
            <span style={{ width: 44, flex: "none" }} />
            {offers.map((sp, i) => (
              <span key={i} style={{ flex: 1, textAlign: "right", fontSize: T.size.caption, color: T.color.sub }}>{sp.style}</span>
            ))}
          </div>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: "flex", gap: T.space.sm, padding: `${T.space.xs}px 0`, borderTop: `1px solid ${T.color.rule}`, marginTop: ri === 0 ? T.space.sm : 0 }}>
              <span style={{ width: 44, flex: "none", fontSize: T.size.caption, color: T.color.sub }}>{row.label}</span>
              {row.vals.map((v, i) => (
                <span key={i} style={{ flex: 1, textAlign: "right", fontSize: T.size.body, color: T.color.text, fontVariantNumeric: "tabular-nums" }}>{v}</span>
              ))}
            </div>
          ))}
        </div>
        <div>
          <Section title="中期目標（達成でボーナス・未達で違約金）" padded={false}>
            {objectives.map(({ proposed, om }, i) => om && (
              <div key={i} style={{ padding: `${T.space.sm}px ${T.space.md}px`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: T.space.sm }}>
                  <span style={{ fontSize: T.size.head, color: T.color.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{om.label}</span>
                  <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none" }}>{offers[i].name}</span>
                </div>
                <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2, lineHeight: 1.5 }}>
                  {om.desc}（〜{MONTHS[proposed.deadline]}）。達成 +{proposed.budget}万・ノルマ+{proposed.points}pt ／ 未達 -{proposed.penalty}万
                </div>
              </div>
            ))}
          </Section>
        </div>
        <div>
          <Section title="契約する会社" padded={false}>
            {offers.map((sp, i) => (
              <SelectRow key={i} first={i === 0} label={sp.name} selected={selIdx === i}
                onClick={() => setG(s => ({ ...s, sponsorChoiceIdx: i }))} />
            ))}
          </Section>
        </div>
        <PrimaryBtn onClick={() => setG(s => {
          const sp = s.sponsorOffers[selIdx];
          const months = pickMandateMonths(sp.mandates, s.year * 555 + selIdx * 91 + s.classIdx * 13);
          const objective = genSeasonObjective(s.year * 7919 + selIdx * 313 + s.classIdx * 17, s.classIdx);
          const sponsor = { ...sp, mandateMonths: months, mandatesMet: 0, mandatesMissed: 0, objective };
          const om2 = objectiveStatusText(objective);
          return { ...s, sponsor, sponsorChoiceIdx: undefined, screen: "main", log: [...s.log, `【${MONTHS[s.month]}】${sp.name}と契約（ノルマ${sp.norma}pt／違約金${sp.penalty}万／指定レース${months.length}回／中期目標「${om2.label}」）`] };
        })}>{`${offers[selIdx].name}と契約する`}</PrimaryBtn>
      </div>
    );
  }
}
