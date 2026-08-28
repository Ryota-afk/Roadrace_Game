// season.jsx より分割（Step8）：日程・順位表・殿堂（program/standings/trophy）
// 第13弾Phase3-D-4-c：kit.jsxへ全面移行。天候アイコン→文字（D-4-b済みcalendar.jsxと同形式）、
// 順位表はR2固定幅列、trophyはD-4-a2の生涯評価と同型に。詳細はdevlog/wave13.md参照。
import React from "react";
import { ScoutBadge, TitlesPanel } from "../../components/panels.jsx";
import { Item, QuietBtn, Section, TypeChip } from "../../components/kit.jsx";
import { MONTHS } from "../../data/course.js";
import { T } from "../../data/theme.js";
import { WEATHER, computeStandings, seasonRivalDex, standingsRankReward } from "../../logic/support.js";
import { computePrestige, genMonthRaces, riderNickname, seasonRaceFocus } from "../../state/state.js";

export function renderSeasonScheduleBoardScreens(ctx) {
  const { cls, g, setG, wrap } = ctx;
  if (g.screen === "program") {
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Section title="年間レースプログラム" right={`${g.year}年目・${cls.label}`}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.6, marginBottom: T.space.sm }}>会場・グレードは月初に確定するため、先の月は目安です。</div>
          {MONTHS.map((m, mi) => {
            const races = genMonthRaces(g.year, mi, g.classIdx, mi === 11 ? 9999 : 0, g.sponsor, g.gtWins, seasonRaceFocus(g.roster), g.raceFocusSlots);
            const isMandate = g.sponsor && g.sponsor.mandateMonths.includes(mi);
            const isNow = mi === g.month;
            return (
              <div key={mi} style={{ padding: `${T.space.sm}px 0`, borderTop: mi === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: T.size.head, color: isNow ? T.color.accent : T.color.text }}>{m}{isNow ? "（今月）" : ""}</span>
                  {isMandate && <span style={{ fontSize: T.size.caption, color: T.color.accent, flex: "none" }}>スポンサー指定月</span>}
                </div>
                <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2, lineHeight: 1.6 }}>
                  {races.map((r, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && " ／ "}
                      {r.championship && "チャンピオンシップ・"}
                      {r.weather && r.weather !== "clear" && <span style={{ color: T.color.accent }}>{WEATHER[r.weather].label}・</span>}
                      {r.name}{"★".repeat(r.grade)}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })}
        </Section>
        <QuietBtn onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</QuietBtn>
      </div>
    );
  }

  // v27: 今季のチームポイント順位表
  if (g.screen === "standings") {
    const rows = computeStandings(g);
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Section title="今季のチーム順位表" right={`${g.year}年目・${cls.label}`}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.7 }}>
            {MONTHS[g.month]}時点のチームポイント順位です。他チームも毎月ポイントを積み上げています——走り込んで順位を上げるほど、年度末に報酬とチャンピオンシップの優位が得られます。レースを休むと相手に抜かれて順位が下がります。
          </div>
        </Section>
        <div>
          <Section title="最終順位ボーナス">
            <Item first label="1位" value={`+${standingsRankReward(1, g.classIdx)}万円`} />
            <Item label="2位" value={`+${standingsRankReward(2, g.classIdx)}万円`} />
            <Item label="3位" value={`+${standingsRankReward(3, g.classIdx)}万円`} />
          </Section>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: -T.space.sm, lineHeight: 1.7 }}>
            昇格ボーダー緩和（PROは対象外）：シーズン順位が高いほど、チャンピオンシップでの昇格ラインが緩みます。シーズン1位なら5位以内、2位なら4位以内、3位以下は3位以内で昇格。
          </div>
        </div>
        <Section title="順位">
          {rows.map((row, i) => (
            <div key={row.name} style={{ display: "flex", alignItems: "center", gap: T.space.sm, padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
              <span style={{ fontSize: T.size.caption, color: T.color.sub, width: 20, textAlign: "right", flex: "none", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
              <span style={{ width: 10, height: 10, background: row.color, flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: T.size.head, color: row.isPlayer ? T.color.accent : T.color.text }}>{row.name}</span>
                {row.trait && <span style={{ fontSize: T.size.caption, color: T.color.sub, marginLeft: T.space.xs }}>{row.trait}</span>}
              </span>
              <span style={{ fontSize: T.size.head, color: row.isPlayer ? T.color.accent : T.color.text, flex: "none", fontVariantNumeric: "tabular-nums" }}>{row.pts}pt</span>
            </div>
          ))}
        </Section>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: -T.space.sm }}>昇格の最終判定は3月のチャンピオンシップで決まりますが、その必要着順はこのシーズン順位で緩和されます。年間を通して上位で走り切るほど昇格が近づきます。</div>
        <QuietBtn onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</QuietBtn>
      </div>
    );
  }

  // v28: トロフィールーム。通算タイトル・殿堂入り選手・生涯評価スコアを一堂に集めた栄誉の間
  if (g.screen === "trophy") {
    const pres = computePrestige();
    const hof = g.hallOfFame || [];
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <div style={{ textAlign: "center", padding: `${T.space.lg}px 0` }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>生涯評価スコア</div>
          <div style={{ fontSize: T.size.display, color: T.color.accent, fontVariantNumeric: "tabular-nums" }}>{pres.score}</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>累計クリアポイント{pres.totalEarnedCP}pt ・ 殿堂{pres.legendCount}人 ・ 通算タイトル{pres.titleCount}</div>
        </div>
        <Section title="通算タイトル">
          <TitlesPanel />
        </Section>
        <Section title="このチームの殿堂入り選手" right={`${hof.length}名`}>
          {hof.length === 0
            ? <div style={{ fontSize: T.size.body, color: T.color.sub, padding: `${T.space.sm}px 0` }}>まだ殿堂入り選手はいません。実績を残した選手が引退・退団すると刻まれます。</div>
            : hof.slice().reverse().map((r, i) => {
                const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
                const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
                const nick = riderNickname(r);
                return (
                  <div key={i} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: T.space.sm }}>
                      <span style={{ display: "flex", alignItems: "center", gap: T.space.xs, minWidth: 0 }}>
                        <span style={{ fontSize: T.size.head, color: T.color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                        <TypeChip type={r.type} />
                      </span>
                      <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none" }}>{r.farewellYear}年目に{r.farewellReason === "released" ? "退団" : "引退"}</span>
                    </div>
                    {nick && <div style={{ fontSize: T.size.caption, color: T.color.sub, fontStyle: "italic", marginTop: 1 }}>「{nick}」</div>}
                    <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>通算{(r.raceLog || []).length}戦・{wins}勝・{podiums}表彰台</div>
                  </div>
                );
              })}
        </Section>
        <QuietBtn onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</QuietBtn>
      </div>
    );
  }

  // v51(第11弾Phase3・3-C): 他チーム名鑑。自クラスの相手選手を、スカウトLvに応じた段階で査定する。
  if (g.screen === "rivals") {
    const teams = seasonRivalDex(g);
    const scoutLv = (g.staff && g.staff.scout) || 0;
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <Section title="他チーム名鑑" right={cls.label}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.6 }}>
            スカウトを雇うほど、相手選手の分析が段階的に進みます（現在Lv{scoutLv}）。
          </div>
        </Section>
        {teams.map(t => (
          <Section key={t.teamName} title={t.teamName} right={t.trait}>
            {t.riders.map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: T.space.sm, padding: `${T.space.xs}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: T.space.xs }}>
                  <span style={{ fontSize: T.size.body, color: T.color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  <TypeChip type={r.type} />
                </span>
                <ScoutBadge scout={r.scout} />
              </div>
            ))}
          </Section>
        ))}
        <QuietBtn onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</QuietBtn>
      </div>
    );
  }

  // v29: 出走表（シーズン）。事前生成した相手チーム布陣＋現在の自チーム選抜を一覧表示

}
