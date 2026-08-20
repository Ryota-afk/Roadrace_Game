// 下部タブ（第13弾Phase3-A）。デザイン合意時に決めた5分類の実体。
// 「ホーム／選手／世界／ショップ／記録」。絵文字は使わず、選択中はアクセント色で示す。
import React from "react";
import { FONT_DOT, T } from "../data/theme.js";

// key は ml.screen に入れる画面ID。ここが唯一の対応表。
export const ML_TABS = [
  { key: "mylife_main", label: "ホーム" },
  { key: "mylife_rider", label: "選手" },
  { key: "mylife_world", label: "世界" },
  { key: "mylife_shop", label: "ショップ" },
  { key: "mylife_archive", label: "記録" },
];

// そのタブに属する（＝タブを選択中として扱う）画面。タブから開いた先の画面でも
// 現在地が分かるようにするため、タブ本体以外の画面IDもここに並べる。
const TAB_MEMBERS = {
  mylife_rider: ["mylife_rider", "mylife_graph"],
  mylife_world: ["mylife_world", "mylife_ranking", "mylife_worldstats", "mylife_riderstats", "mylife_teamroster", "mylife_newspaper"],
  mylife_archive: ["mylife_archive", "mylife_achievements", "mylife_records", "mylife_legends", "mylife_lineage", "mylife_factors", "mylife_abilityfile"],
};

export function activeMlTab(screen) {
  for (const [tab, members] of Object.entries(TAB_MEMBERS)) {
    if (members.includes(screen)) return tab;
  }
  return screen === "mylife_shop" ? "mylife_shop" : "mylife_main";
}

export function BottomTabs({ screen, onSelect }) {
  const active = activeMlTab(screen);
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginTop: T.space.xl, paddingTop: T.space.md, borderTop: `1px solid ${T.color.rule}`,
      fontFamily: FONT_DOT,
    }}>
      {ML_TABS.map(t => (
        <button key={t.key} onClick={() => onSelect(t.key)}
          style={{
            background: "none", border: 0, padding: `${T.space.xs}px ${T.space.sm}px`, cursor: "pointer",
            fontFamily: FONT_DOT, fontSize: T.size.caption,
            color: t.key === active ? T.color.accent : T.color.sub,
          }}>{t.label}</button>
      ))}
    </div>
  );
}
