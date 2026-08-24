// 「記録」タブ（第13弾Phase3-A で新設）。
// 実績・コースレコード・殿堂・系譜・因子図鑑・特殊能力図鑑への入口をまとめた索引。
// 各画面の中身自体はまだ旧デザインのまま（Phase3-B以降で作り直す）。
import React from "react";
import { Item } from "../../components/kit.jsx";
import { FONT_DOT, T } from "../../data/theme.js";
import { ML_ACHIEVEMENTS, computeAchievements } from "../../state/state.js";

export function renderMyLifeArchiveScreen(ctx) {
  const { ml, mlWrap, setMl } = ctx;
  if (!ml.player) return null;
  const done = computeAchievements(ml).filter(a => a.achieved).length;
  const r = ml.player;
  const log = r.raceLog || [];
  const wins = log.filter(e => e.rank === 1).length;
  const podiums = log.filter(e => e.rank <= 3).length;
  const best = log.length ? Math.min(...log.map(e => e.rank)) : null;

  const items = [
    { label: "実績", note: `${done} / ${ML_ACHIEVEMENTS.length}`, screen: "mylife_achievements" },
    { label: "コースレコード", note: "", screen: "mylife_records" },
    { label: "歴代選手の殿堂", note: "", screen: "mylife_legends" },
    { label: "系譜", note: "", screen: "mylife_lineage" },
    { label: "因子図鑑", note: "", screen: "mylife_factors" },
    { label: "特殊能力図鑑", note: "", screen: "mylife_abilityfile" },
  ];

  return mlWrap(
    <div style={{ background: T.color.bg, color: T.color.text, fontFamily: FONT_DOT, margin: "-6px -14px 0", padding: T.space.lg }}>
      <div style={{ fontSize: T.size.title, marginBottom: T.space.md }}>記録</div>

      <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>これまでの戦績</div>
      <div style={{ background: T.color.surface, padding: `0 ${T.space.md}px`, marginBottom: T.space.md }}>
        {[["出走", log.length], ["優勝", wins], ["表彰台", podiums], ["最高着順", best == null ? "—" : `${best}位`]].map(([k, v], i) => (
          <Item key={k} first={i === 0} label={k} value={v} valueColor={k === "優勝" && wins > 0 ? T.color.accent : undefined} />
        ))}
      </div>

      {/* 第32弾Phase B R3: 枠線・透明背景の一覧行を面(surfaceUp)＋chevronのアフォーダンス規約へ統一 */}
      {/* 第33弾: 殿堂・系譜・因子図鑑はタイトル側（キャリア作成・引退後）と画面を共有しているため、
          記録タブから開いたことを覚えて戻り先をここに戻す（従来はキャリア作成画面へ飛んでいた）。 */}
      {items.map((it, i) => (
        <button key={it.screen} onClick={() => setMl(s => ({
          ...s, screen: it.screen,
          ...(["mylife_legends", "mylife_lineage", "mylife_factors"].includes(it.screen)
            ? { careerBack: "mylife_archive", dexBack: "mylife_archive" } : {}),
        }))}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline", width: "100%",
            background: T.color.surfaceUp, border: 0, marginBottom: T.space.xs,
            color: T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body,
            padding: `${T.space.md}px`, cursor: "pointer", textAlign: "left",
          }}>
          <span>{it.label}</span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            {it.note && <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{it.note}</span>}
            <span style={{ color: T.color.sub }}>›</span>
          </span>
        </button>
      ))}
    </div>
  );
}
