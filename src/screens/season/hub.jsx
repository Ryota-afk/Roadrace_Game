// season.jsx より分割（Step8）：メイン画面。
// Step13第4弾：カイロソフト式動線への一括カットオーバー。旧5タブUI（SeasonNav）を撤去し、
// BaseView（常設の敷地画面）＋MenuShell（右下ボタン→左パネル→大ジャンル→小ジャンルの
// 2階層メニュー）を主画面として配線した。Step13第1弾で切り出した6セクション関数がそのまま
// メニューの行き先になる（中身は無変更）。
import React from "react";
import { MONTHS } from "../../data/course.js";
import { SEASON_MENU_CATEGORIES, ROOM_SECTION_MAP } from "../../data/seasonMenu.js";
import { saveGame } from "../../state/state.js";
import { BaseView } from "../../components/base/BaseView.jsx";
import { MenuShell } from "../../components/menu/MenuShell.jsx";
import { renderHomeSection } from "./hub/home.jsx";
import { renderRidersSection } from "./hub/riders.jsx";
import { renderMarketSection } from "./hub/market.jsx";
import { renderFacilitySection } from "./hub/facility.jsx";
import { renderRecordsSection } from "./hub/records.jsx";
import { renderHelpSection } from "./hub/help.jsx";

export function renderSeasonHubScreen(ctx) {
  const { g, setG, askConfirm, setSuperMode, wrap, seasonMenu } = ctx;
  if (g.screen !== "main") return null;

  // "save"/"titleReturn"はフルスクリーン遷移ではなく即時アクション（旧homeタブの
  // misc button row相当）。メニューは選択と同時に閉じるが、section状態自体は変更しない
  // （titleReturnの確認ダイアログをキャンセルしても表示中の画面を保つため）。
  const handleSelectSection = (key) => {
    if (key === "save") {
      const ok = saveGame(g);
      setG(s => ({ ...s, log: [...s.log, ok ? `【${MONTHS[s.month]}】セーブしました` : "セーブに失敗しました（ブラウザの保存領域を確認してください）"] }));
      seasonMenu.closeMenu();
      return;
    }
    if (key === "titleReturn") {
      seasonMenu.closeMenu();
      askConfirm("タイトルに戻ります。セーブ済みのデータは消えません。よろしいですか？", () => {
        setG(s => ({ ...s, screen: "intro" }));
        setSuperMode(null);
      });
      return;
    }
    seasonMenu.selectSection(key);
  };

  // Wave E-2: BaseView上の部屋をタップしたときの行き先。ROOM_SECTION_MAPがnullの部屋
  // （クラブハウス＝拠点そのもの）は特定セクションへ飛ばさず、大ジャンル一覧を開く。
  const handleRoomTap = (roomKey) => {
    const target = ROOM_SECTION_MAP[roomKey];
    if (target == null) seasonMenu.openMenu();
    else handleSelectSection(target);
  };

  const sec = seasonMenu.menuState.section;
  let content;
  if (sec === "riders") content = renderRidersSection(ctx);
  else if (sec === "facility") content = <div style={{ display: "grid", gap: 14 }}>{renderFacilitySection(ctx)}</div>;
  else if (sec === "market") content = <div style={{ display: "grid", gap: 14 }}>{renderMarketSection(ctx)}</div>;
  else if (sec === "race") content = renderHomeSection(ctx);
  else if (sec === "records") content = renderRecordsSection(ctx);
  else if (sec === "help") content = renderHelpSection();
  else content = <BaseView g={g} paused={seasonMenu.menuState.open} onRoomTap={handleRoomTap} />; // sec===null || "base"

  // BaseView（敷地画面）表示中だけ wrap を fill モードにし、画面の残り高さを全て使う
  // （Wave D2以前は横長固定のSVGが縦長スマホで画面高の27%しか占めず下半分が余っていた）。
  const isBase = !sec || sec === "base";

  return (
    <>
      {wrap(content, isBase ? { fill: true } : undefined)}
      <MenuShell categories={SEASON_MENU_CATEGORIES} menuState={seasonMenu.menuState}
        openMenu={seasonMenu.openMenu} closeMenu={seasonMenu.closeMenu}
        selectCategory={seasonMenu.selectCategory} backToCategories={seasonMenu.backToCategories}
        selectSection={handleSelectSection} />
    </>
  );
}
