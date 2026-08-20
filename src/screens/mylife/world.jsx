// 「世界」タブ（第13弾Phase3-A で新設）。
// Phase 2でホームの「その他」へ仮置きしていた世界ランキング・目標（アンビション）・
// ライバル・ニュースをここへ集約した。決定事項「ニュースはホームから外し世界タブへ」の実体。
import React from "react";
import { FONT_DOT, T } from "../../data/theme.js";
import { TYPES } from "../../data/abilities.js";
import { mlAmbitionPath, mlCurrentAmbition, mlAmbitionProgressText, mlMediaHeadline, mlWorldBoard, rivalHeatTier, worldRankTier } from "../../logic/support.js";

const Section = ({ title, children, action }) => (
  <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: T.space.sm }}>
      <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{title}</span>
      {action}
    </div>
    <div style={{ background: T.color.surface, padding: T.space.md, marginBottom: T.space.md }}>{children}</div>
  </>
);

const RivalPanel = ({ rival, record, present }) => {
  const ht = rivalHeatTier(record?.heat ?? record?.meetings ?? 0);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: T.size.head }}>{rival.name}</span>
        <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{rival.team}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.body, marginTop: T.space.sm }}>
        <span style={{ color: T.color.sub }}>{ht.label}・通算</span>
        <span>
          <span style={{ color: T.color.good }}>{record?.wins || 0}</span>勝{" "}
          <span style={{ color: T.color.bad }}>{record?.losses || 0}</span>敗
        </span>
      </div>
      {present && <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: T.space.sm }}>今月のレースに出走してくる</div>}
    </>
  );
};

export function renderMyLifeWorldScreen(ctx) {
  const { ml, mlWrap, setMl } = ctx;
  if (!ml.player) return null;
  const race = ml.races[0];
  const path = mlAmbitionPath(ml);
  const amb = mlCurrentAmbition(ml);
  const board = mlWorldBoard(ml);
  // ml.worldRankは初レースを終えるまでnull。その間もランキング表（mlWorldBoard）は自分を
  // 何位かに並べているため、そのまま「—位」と出すと表と食い違う。確定値が無い間は表の位置を使う。
  const rank = ml.worldRank == null ? board.myRank : ml.worldRank;
  const tier = worldRankTier(rank);
  const media = mlMediaHeadline(ml);
  const linkBtn = (label, screen) => (
    <button onClick={() => setMl(s => ({ ...s, screen }))}
      style={{ width: "100%", background: "none", border: `1px solid ${T.color.rule}`, color: T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body, padding: T.space.sm, cursor: "pointer", marginBottom: T.space.sm }}>
      {label}
    </button>
  );

  return mlWrap(
    <div style={{ background: T.color.bg, color: T.color.text, fontFamily: FONT_DOT, margin: "-6px -14px 0", padding: T.space.lg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: T.space.md }}>
        <div>
          <div style={{ fontSize: T.size.title, lineHeight: 1.1 }}>世界</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>{tier.label}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: T.size.display, lineHeight: 1, color: T.color.accent }}>{rank}</span>
          <span style={{ fontSize: T.size.caption, color: T.color.sub }}>位</span>
        </div>
      </div>

      <Section title="いま目指す目標">
        {amb ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: T.size.body }}>{amb.label}</span>
              <span style={{ fontSize: T.size.body, color: T.color.accent, marginLeft: T.space.sm, flex: "none" }}>{mlAmbitionProgressText(ml, amb)}</span>
            </div>
            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>
              {path.label} — 達成度 {Math.min(ml.ambitionIdx || 0, path.rungs.length)}/{path.rungs.length}
            </div>
          </>
        ) : (
          <div style={{ fontSize: T.size.body, color: T.color.accent }}>「{path.label}」を極めた。別の生き方に挑戦できる</div>
        )}
      </Section>

      <Section title="世界ランキング">
        {board.top.map((e, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "baseline", gap: T.space.sm, fontSize: T.size.body,
            padding: `${T.space.sm}px ${T.space.md}px`, margin: `0 -${T.space.md}px`,
            borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}`,
            background: e.isPlayer ? T.color.surfaceUp : "transparent",
          }}>
            <span style={{ width: 32, flex: "none", textAlign: "right", color: e.isPlayer ? T.color.accent : T.color.sub }}>{e.rank}</span>
            <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: e.isPlayer ? T.color.accent : T.color.text }}>{e.name}</span>
            <span style={{ flex: "none", fontSize: T.size.caption, color: T.color.sub }}>{e.pts}</span>
          </div>
        ))}
        {board.around.length > 0 && (
          <div style={{ marginTop: T.space.sm, paddingTop: T.space.sm, borderTop: `1px solid ${T.color.rule}` }}>
            {board.around.map((e, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "baseline", gap: T.space.sm, fontSize: T.size.body,
                padding: `${T.space.sm}px ${T.space.md}px`, margin: `0 -${T.space.md}px`,
                background: e.isPlayer ? T.color.surfaceUp : "transparent",
              }}>
                <span style={{ width: 32, flex: "none", textAlign: "right", color: e.isPlayer ? T.color.accent : T.color.sub }}>{e.rank}</span>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: e.isPlayer ? T.color.accent : T.color.text }}>{e.name}</span>
                <span style={{ flex: "none", fontSize: T.size.caption, color: T.color.sub }}>{e.pts}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {ml.rival && <Section title="好敵手"><RivalPanel rival={ml.rival} record={ml.rivalRecord} present={race?.rivalPresent} /></Section>}
      {ml.rival2 && (ml.rivalRecord2?.meetings || 0) > 0 && (
        <Section title="好敵手"><RivalPanel rival={ml.rival2} record={ml.rivalRecord2} present={race?.rival2Present} /></Section>
      )}

      {media && (
        <Section title="ロードレース・タイムズ">
          <div style={{ fontSize: T.size.head, lineHeight: 1.3 }}>{media.headline}</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm, lineHeight: 1.7 }}>{media.body}</div>
        </Section>
      )}

      {linkBtn("全チームの名鑑を見る", "mylife_worldstats")}
      {linkBtn("選手の成績を見る", "mylife_riderstats")}
      {linkBtn("チームメイトを見る", "mylife_teamroster")}
    </div>
  );
}
