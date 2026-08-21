// season.jsx より分割（Step8）：年度末・グランファイナル（yearend/clear）
// 第13弾Phase3-D-4-c：kit.jsxへ全面移行。争点3・案A「言葉が主役」——絵文字と色付き上枠線を
// 廃止し、昇格/降格/制覇の言葉をdisplay(28px)に。数字はItemへ。詳細はdevlog/wave13.md参照。
import React from "react";
import { PrimaryBtn, QuietBtn, Section, Item } from "../../components/kit.jsx";
import { DIFFICULTIES } from "../../data/progression.js";
import { T } from "../../data/theme.js";
import { clearSaveGame, computeClearPoints, objectiveStatusText } from "../../logic/support.js";
import { initGame } from "../../state/state.js";

export function renderSeasonYearEndScreens(ctx) {
  const { askConfirm, cls, g, setG, wrap } = ctx;
  if (g.screen === "yearend" && g.yearendInfo) {
    const info = g.yearendInfo;
    const heroColor = info.promoted ? T.color.good : info.relegated ? T.color.bad : T.color.text;
    const heroText = info.promoted ? `${cls.label}へ昇格` : info.relegated ? `${cls.label}へ降格` : "残留 — 来季へ";
    const om = objectiveStatusText(info.sponsorResult && info.sponsorResult.objective);
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <div style={{ textAlign: "center", padding: `${T.space.lg}px 0` }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{g.year - 1}年目 終了</div>
          <div style={{ fontSize: T.size.display, color: heroColor }}>{heroText}</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>
            {info.champBest !== null ? `チャンピオンシップ結果：自チーム最高 ${info.champBest}位` : "チャンピオンシップには出場できませんでした（ポイント不足）"}
          </div>
        </div>
        {info.standingsRank != null && (
          <Section title="最終成績">
            <Item first label="最終順位" value={`${info.standingsRank} / ${info.standingsTotal}位`}
              detail={`${info.standingsMoney > 0 ? `順位ボーナス +${info.standingsMoney}万円` : ""}${info.promoteCut > 3 && info.champBest !== null ? `${info.standingsMoney > 0 ? "・" : ""}上位の走りで、チャンピオンシップの昇格ラインが${info.promoteCut}位以内まで緩和されています` : ""}`} />
          </Section>
        )}
        {info.sponsorResult && (
          <Section title="スポンサー精算" right={info.sponsorResult.name}>
            <Item first label={`ノルマ ${info.sponsorResult.norma}pt`} value={info.sponsorResult.achieved ? "達成" : "未達"}
              valueColor={info.sponsorResult.achieved ? T.color.good : T.color.bad}
              detail={`実績${info.sponsorResult.pts}pt — ${info.sponsorResult.achieved ? `達成ボーナス+${info.sponsorResult.bonus}万円` : `違約金-${info.sponsorResult.penalty}万円`}`} />
            {info.sponsorResult.mandatesMissed > 0 && <Item label="指定レース見送り" value={`${info.sponsorResult.mandatesMissed}回`} detail={`追加違約金-${info.sponsorResult.mandatePenalty}万円`} valueColor={T.color.bad} />}
            {info.sponsorResult.mandatesMet > 0 && <Item label="指定レース達成" value={`${info.sponsorResult.mandatesMet}回`} />}
            {om && (
              <Item label={`中期目標「${om.label}」`} value={om.status === "done" ? "達成" : "未達"} valueColor={om.status === "done" ? T.color.good : T.color.bad}
                detail={om.status === "done" ? `ボーナス+${info.sponsorResult.objective.budget}万・ノルマ+${info.sponsorResult.objective.points}pt` : `違約金-${info.sponsorResult.objective.penalty}万`} />
            )}
          </Section>
        )}
        {info.retired.length > 0 && (
          <Section title="引退セレモニー">
            {info.retired.map((t, i) => <div key={i} style={{ fontSize: T.size.body, color: T.color.text, padding: `${T.space.xs}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>{t}</div>)}
          </Section>
        )}
        <div style={{ fontSize: T.size.caption, color: T.color.sub }}>新年度：全選手が1歳加齢。次は新しいスポンサーとの契約です。</div>
        <PrimaryBtn onClick={() => setG(s => ({ ...s, screen: "sponsor", yearendInfo: null }))}>スポンサー契約へ</PrimaryBtn>
      </div>
    );
  }

  if (g.screen === "clear") {
    const earnedCP = computeClearPoints(g.year, g.difficulty);
    const diffLabel = (DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).label;
    return wrap(
      <div style={{ display: "grid", gap: T.space.lg }}>
        <div style={{ textAlign: "center", padding: `${T.space.lg}px 0` }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>PROクラス {g.year - 1}年目</div>
          <div style={{ fontSize: T.size.display, color: T.color.accent }}>グランファイナル制覇</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs, lineHeight: 1.6 }}>
            B1から始まったチームが、{g.year - 1}年の歳月（難易度：{diffLabel}）をかけてPROの頂点に立ちました。おめでとうございます！
          </div>
        </div>
        <Section title="クリア報酬">
          <Item first label="獲得クリアポイント" value={`+${earnedCP}pt`} valueColor={T.color.accent}
            detail="次回以降の新規ゲームで、難易度の解禁や永続ボーナスに自動反映されます" />
        </Section>
        {/* v25: 制覇後もこの轍（チーム）を引き継いで周回できるディナスティモード。
            周を重ねるたびに他チームの地力が上がり、歯応えを保ったまま挑戦を続けられる */}
        <div>
          <PrimaryBtn onClick={() => setG(s => ({ ...s, dynastyLevel: (s.dynastyLevel || 0) + 1, screen: "yearend" }))}>この轍を継いでさらなる高みへ</PrimaryBtn>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, textAlign: "center", marginTop: -T.space.xs }}>{(g.dynastyLevel || 0) + 1}周目へ・他チームがさらに強化されます</div>
        </div>
        <QuietBtn onClick={() => askConfirm("現在のチームを終え、新たなチームを最初から始めます。よろしいですか？", () => { clearSaveGame(); setG(initGame()); }, "最初から始める")}>新たなチームで最初から</QuietBtn>
      </div>
    );
  }

}
