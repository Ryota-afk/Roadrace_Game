// season.jsx より分割（Step8）：日程・順位表・殿堂（program/standings/trophy）
import React from "react";
import { ScoutBadge, TitlesPanel } from "../../components/panels.jsx";
import { Btn, Eyebrow } from "../../components/ui.jsx";
import { TYPES } from "../../data/abilities.js";
import { MONTHS } from "../../data/course.js";
import { C, FONT_D, FONT_M } from "../../data/theme.js";
import { WEATHER, computeStandings, seasonRivalDex, standingsRankReward } from "../../logic/support.js";
import { computePrestige, genMonthRaces, riderNickname } from "../../state/state.js";

export function renderSeasonScheduleBoardScreens(ctx) {
  const { cls, g, setG, wrap } = ctx;
  if (g.screen === "program") {
    return wrap(
      <div style={{ display: "grid", gap: 10 }}>
        <Eyebrow color={C.blue}>年間レースプログラム（{g.year}年目・{cls.label}）</Eyebrow>
        <div style={{ fontSize: 11.5, color: C.sub }}>会場・グレードは月初に確定するため、先の月は目安です。天候予報も併記します（☀️晴れ／🌧雨／🥵猛暑）。</div>
        {MONTHS.map((m, mi) => {
          const races = genMonthRaces(g.year, mi, g.classIdx, mi === 11 ? 9999 : 0, g.sponsor, g.gtWins);
          const isMandate = g.sponsor && g.sponsor.mandateMonths.includes(mi);
          return (
            <div key={mi} style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", border: `1px solid ${mi === g.month ? C.yellow : C.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: FONT_D, fontWeight: 700, color: mi === g.month ? C.yellow : C.text, fontSize: 13 }}>{m}{mi === g.month ? "（今月）" : ""}</span>
                {isMandate && <span style={{ fontSize: 10.5, color: C.red }}>🎯スポンサー指定月</span>}
              </div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3, lineHeight: 1.6 }}>
                {races.map(r => `${r.championship ? "👑" : ""}${r.weather && r.weather !== "clear" ? WEATHER[r.weather].icon : ""}${r.name}${"★".repeat(r.grade)}`).join(" ／ ")}
              </div>
            </div>
          );
        })}
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  // v27: 今季のチームポイント順位表
  if (g.screen === "standings") {
    const rows = computeStandings(g);
    return wrap(
      <div style={{ display: "grid", gap: 10 }}>
        <Eyebrow color={C.purple}>今季のチーム順位表（{g.year}年目・{cls.label}）</Eyebrow>
        <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.7 }}>
          {MONTHS[g.month]}時点のチームポイント順位です。他チームも毎月ポイントを積み上げています——<span style={{ color: C.text }}>走り込んで順位を上げるほど、年度末に報酬とチャンピオンシップの優位が得られます</span>。レースを休むと相手に抜かれて順位が下がります。
        </div>
        <div style={{ background: C.panel2, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.line}`, fontSize: 11, color: C.sub, lineHeight: 1.7 }}>
          🏆 <span style={{ color: C.text, fontWeight: 700 }}>最終順位ボーナス</span>：1位 +{standingsRankReward(1, g.classIdx)}万／2位 +{standingsRankReward(2, g.classIdx)}万／3位 +{standingsRankReward(3, g.classIdx)}万<br />
          🎯 <span style={{ color: C.text, fontWeight: 700 }}>昇格ボーダー緩和</span>（PROは対象外）：シーズン順位が高いほど、チャンピオンシップでの昇格ラインが緩みます。<br />
          シーズン1位ならチャンピオンシップ<span style={{ color: "#e8a13c" }}>5位以内</span>、2位なら<span style={{ color: "#e8a13c" }}>4位以内</span>、3位以下は3位以内で昇格
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: "6px 10px", display: "grid", gap: 2 }}>
          {rows.map((row, i) => (
            <div key={row.name} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 8px",
              borderRadius: 8, background: row.isPlayer ? "rgba(255,210,63,0.12)" : "transparent",
              borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : "none",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: FONT_M, fontSize: 14, color: i === 0 ? C.yellow : C.sub, width: 22 }}>{i + 1}.</span>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: row.color, display: "inline-block" }} />
                <span>
                  <span style={{ fontFamily: FONT_D, fontWeight: 700, color: row.isPlayer ? C.yellow : C.text, fontSize: 13.5 }}>{row.name}</span>
                  {row.trait && <span style={{ fontSize: 10, color: C.sub, marginLeft: 6 }}>{row.trait}</span>}
                </span>
              </span>
              <span style={{ fontFamily: FONT_M, fontSize: 14, color: row.isPlayer ? C.yellow : C.text }}>{row.pts}pt</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.sub }}>昇格の最終判定は3月のチャンピオンシップで決まりますが、その必要着順はこのシーズン順位で緩和されます。年間を通して上位で走り切るほど昇格が近づきます。</div>
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  // v28: トロフィールーム。通算タイトル・殿堂入り選手・生涯評価スコアを一堂に集めた栄誉の間
  if (g.screen === "trophy") {
    const pres = computePrestige();
    const hof = g.hallOfFame || [];
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid #e8a13c`, textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>🏆</div>
          <h2 style={{ fontFamily: FONT_D, color: "#e8a13c", fontSize: 22, margin: "6px 0" }}>トロフィールーム</h2>
          <div style={{ fontSize: 11, color: C.sub }}>生涯評価スコア</div>
          <div style={{ fontFamily: FONT_M, fontSize: 30, color: C.yellow, fontWeight: 700 }}>{pres.score}</div>
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4 }}>累計クリアポイント{pres.totalEarnedCP}pt ・ 殿堂{pres.legendCount}人 ・ 通算タイトル{pres.titleCount}</div>
        </div>
        <Eyebrow color={"#e8a13c"}>👑 通算タイトル</Eyebrow>
        <TitlesPanel />
        <Eyebrow color={C.purple}>🏛 このチームの殿堂入り選手（{hof.length}名）</Eyebrow>
        {hof.length === 0
          ? <div style={{ fontSize: 12, color: C.sub }}>まだ殿堂入り選手はいません。実績を残した選手が引退・退団すると刻まれます。</div>
          : (
            <div style={{ display: "grid", gap: 8 }}>
              {hof.slice().reverse().map((r, i) => {
                const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
                const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
                const nick = riderNickname(r);
                return (
                  <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 14 }}>{r.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: TYPES[r.type].color }}>{TYPES[r.type].label}</span></span>
                      <span style={{ fontSize: 10.5, color: C.sub }}>{r.farewellYear}年目に{r.farewellReason === "released" ? "退団" : "引退"}</span>
                    </div>
                    {nick && <div style={{ fontSize: 11.5, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{nick}」</div>}
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>通算{(r.raceLog || []).length}戦・{wins}勝・{podiums}表彰台</div>
                  </div>
                );
              })}
            </div>
          )}
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  // v51(第11弾Phase3・3-C): 他チーム名鑑。自クラスの相手選手を、スカウトLvに応じた段階で査定する。
  if (g.screen === "rivals") {
    const teams = seasonRivalDex(g);
    const scoutLv = (g.staff && g.staff.scout) || 0;
    return wrap(
      <div style={{ display: "grid", gap: 10 }}>
        <Eyebrow color={C.green}>🔍 他チーム名鑑（{cls.label}）</Eyebrow>
        <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.6 }}>
          スカウトを雇うほど、相手選手の分析が段階的に進みます（現在Lv{scoutLv}）。
        </div>
        {teams.map(t => (
          <div key={t.teamName} style={{ background: C.panel, borderRadius: 10, border: `1px solid ${C.line}`, borderLeft: `3px solid ${t.color}`, overflow: "hidden" }}>
            <div style={{ padding: "7px 12px", background: C.panel2 }}>
              <span style={{ fontFamily: FONT_D, fontSize: 14, color: C.text }}>{t.teamName}<span style={{ fontSize: 10, color: C.sub, marginLeft: 6 }}>{t.trait}</span></span>
            </div>
            {t.riders.map(r => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "5px 12px", borderTop: `1px solid ${C.bg}`, fontSize: 12 }}>
                <span style={{ flex: 1, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}<span style={{ fontSize: 9.5, color: TYPES[r.type]?.color, marginLeft: 4 }}>{TYPES[r.type]?.label}</span></span>
                <ScoutBadge scout={r.scout} />
              </div>
            ))}
          </div>
        ))}
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  // v29: 出走表（シーズン）。事前生成した相手チーム布陣＋現在の自チーム選抜を一覧表示

}
