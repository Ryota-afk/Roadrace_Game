// season.jsx より分割（Step8）：年度末・グランファイナル（yearend/clear）
import React from "react";
import { Btn, Eyebrow } from "../../components/ui.jsx";
import { DIFFICULTIES } from "../../data/progression.js";
import { C, FONT_D, FONT_M } from "../../data/theme.js";
import { clearSaveGame, computeClearPoints, objectiveStatusText } from "../../logic/support.js";
import { initGame } from "../../state/state.js";

export function renderSeasonYearEndScreens(ctx) {
  const { cls, g, setG, wrap } = ctx;
  if (g.screen === "yearend" && g.yearendInfo) {
    const info = g.yearendInfo;
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${info.promoted ? C.green : info.relegated ? C.red : C.yellow}` }}>
          <Eyebrow>YEAR END — {g.year - 1}年目終了</Eyebrow>
          <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 22, margin: "6px 0 10px" }}>
            {info.promoted ? `🎉 ${cls.label} へ昇格！` : info.relegated ? "😞 降格…" : "残留 — 来季へ"}
          </h2>
          <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.8 }}>
            {info.champBest !== null ? `年度末レース結果：自チーム最高 ${info.champBest}位` : "年度末レースには出場できませんでした（ポイント不足）"}
          </div>
          {info.standingsRank != null && (
            <div style={{ marginTop: 8, fontSize: 13, color: "#e8a13c", lineHeight: 1.8 }}>
              🏆 シーズン最終順位 {info.standingsRank}/{info.standingsTotal}位
              {info.standingsMoney > 0 ? ` — 順位ボーナス +${info.standingsMoney}万円` : ""}
              {info.promoteCut > 3 && info.champBest !== null ? `／ 上位の走りで昇格ボーダーが本番${info.promoteCut}位以内に緩和` : ""}
            </div>
          )}
          {info.sponsorResult && (
            <div style={{ marginTop: 8, fontSize: 13, color: info.sponsorResult.achieved ? C.green : C.red }}>
              {info.sponsorResult.name}：ノルマ{info.sponsorResult.norma}ptに対し{info.sponsorResult.pts}pt —
              {info.sponsorResult.achieved ? ` 達成！ボーナス+${info.sponsorResult.bonus}万円` : ` 未達…違約金-${info.sponsorResult.penalty}万円`}
              {info.sponsorResult.mandatesMissed > 0 && ` ／ 指定レース見送り${info.sponsorResult.mandatesMissed}回：追加違約金-${info.sponsorResult.mandatePenalty}万円`}
              {info.sponsorResult.mandatesMet > 0 && ` ／ 指定レース達成${info.sponsorResult.mandatesMet}回`}
            </div>
          )}
          {(() => {
            const om = objectiveStatusText(info.sponsorResult && info.sponsorResult.objective);
            if (!om) return null;
            const obj = info.sponsorResult.objective;
            return (
              <div style={{ marginTop: 5, fontSize: 12.5, color: om.status === "done" ? C.green : C.red }}>
                中期目標「{om.icon} {om.label}」：{om.status === "done" ? `達成（ボーナス+${obj.budget}万・ノルマ+${obj.points}pt）` : `未達（違約金-${obj.penalty}万）`}
              </div>
            );
          })()}
          {info.retired.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <Eyebrow color={C.sub}>引退セレモニー</Eyebrow>
              {info.retired.map((t, i) => <div key={i} style={{ fontSize: 13, color: C.text, marginTop: 4 }}>🌸 {t}</div>)}
            </div>
          )}
        </div>
        <div style={{ background: C.panel2, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: C.sub, lineHeight: 1.7 }}>新年度：全選手が1歳加齢。次は新しいスポンサーとの契約です。</div>
        <Btn onClick={() => setG(s => ({ ...s, screen: "sponsor", yearendInfo: null }))}>スポンサー契約へ →</Btn>
      </div>
    );
  }

  if (g.screen === "clear") {
    const earnedCP = computeClearPoints(g.year, g.difficulty);
    const diffLabel = (DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).label;
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 22, borderTop: `4px solid ${C.yellow}`, textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>🏆</div>
          <h2 style={{ fontFamily: FONT_D, color: C.yellow, fontSize: 26, margin: "8px 0" }}>グランファイナル制覇！</h2>
          <p style={{ color: C.text, fontSize: 14, lineHeight: 1.8 }}>B1から始まったチームが、{g.year - 1}年の歳月（難易度：{diffLabel}）をかけてPROの頂点に立ちました。おめでとうございます！</p>
          <div style={{ marginTop: 10, fontSize: 15, color: C.yellow, fontFamily: FONT_M }}>🎁 クリアポイント +{earnedCP}pt 獲得！</div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>次回以降の新規ゲームで、難易度の解禁や永続ボーナスに自動反映されます</div>
        </div>
        {/* v25: 制覇後もこの轍（チーム）を引き継いで周回できるディナスティモード。
            周を重ねるたびに他チームの地力が上がり、歯応えを保ったまま挑戦を続けられる */}
        <Btn onClick={() => setG(s => ({ ...s, dynastyLevel: (s.dynastyLevel || 0) + 1, screen: "yearend" }))}>
          🔁 この轍を継いでさらなる高みへ（{(g.dynastyLevel || 0) + 1}周目へ・他チームがさらに強化される）
        </Btn>
        <Btn outline onClick={() => { clearSaveGame(); setG(initGame()); }}>新たなチームで最初から</Btn>
      </div>
    );
  }

}
