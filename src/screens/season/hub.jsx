// season.jsx より分割（Step8）：メイン画面。
// Step13第4弾：カイロソフト式動線への一括カットオーバー。旧5タブUI（SeasonNav）を撤去し、
// BaseView（常設の敷地画面）＋MenuShell（右下ボタン→左パネル→大ジャンル→小ジャンルの
// 2階層メニュー）を主画面として配線した。
// Step13第7弾：大ジャンルを小ジャンルへ細分化（17小分類）。セクション数が増えたため、
// if/elseチェーンからSECTION_RENDERERSのルックアップテーブルへ切り替えた。
import React from "react";
import { MONTHS } from "../../data/course.js";
import { SEASON_MENU_CATEGORIES, ROOM_SECTION_MAP } from "../../data/seasonMenu.js";
import { saveGame } from "../../state/state.js";
import { BaseView } from "../../components/base/BaseView.jsx";
import { MenuShell } from "../../components/menu/MenuShell.jsx";
import { renderRidersListSection } from "./hub/riders/list.jsx";
import { renderRidersTeamSection } from "./hub/riders/team.jsx";
import { renderRidersYouthSection } from "./hub/riders/youth.jsx";
import { renderFacilityEquipSection } from "./hub/facility/equip.jsx";
import { renderFacilityStaffSection } from "./hub/facility/staff.jsx";
import { renderFacilityObSection } from "./hub/facility/ob.jsx";
import { renderFacilityRoomSection } from "./hub/facility/room.jsx";
import { renderMarketScoutSection } from "./hub/market/scout.jsx";
import { renderMarketTransferSection } from "./hub/market/transfer.jsx";
import { renderMarketShopSection } from "./hub/market/shop.jsx";
import { renderRaceCalendarSection } from "./hub/race/calendar.jsx";
import { renderRaceStatusSection } from "./hub/race/status.jsx";
import { renderRecordsCareerSection } from "./hub/records/career.jsx";
import { renderRecordsHallSection } from "./hub/records/hall.jsx";
import { renderRecordsArchiveSection } from "./hub/records/archive.jsx";
import { renderRecordsStandingsSection } from "./hub/records/standings.jsx";
import { renderMiscSettingsSection } from "./hub/misc.jsx";
import { renderHelpSection } from "./hub/help.jsx";

// セクションキー→描画関数のルックアップ表。キーはdata/seasonMenu.jsのsection.keyと1:1対応。
// help/misc_settingsのように引数のないもの・ctxを受けるものが混在するため、統一的に
// (ctx) => JSXの形へラップしている。
const SECTION_RENDERERS = {
  riders_list: renderRidersListSection,
  riders_team: renderRidersTeamSection,
  riders_youth: renderRidersYouthSection,
  facility_equip: renderFacilityEquipSection,
  facility_staff: renderFacilityStaffSection,
  facility_ob: renderFacilityObSection,
  facility_room: renderFacilityRoomSection,
  market_scout: renderMarketScoutSection,
  market_transfer: renderMarketTransferSection,
  market_shop: renderMarketShopSection,
  race_calendar: renderRaceCalendarSection,
  race_status: renderRaceStatusSection,
  records_career: renderRecordsCareerSection,
  records_hall: renderRecordsHallSection,
  records_archive: () => renderRecordsArchiveSection(),
  records_standings: renderRecordsStandingsSection,
  misc_settings: renderMiscSettingsSection,
  help: () => renderHelpSection(),
};

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
  const renderer = sec && SECTION_RENDERERS[sec];
  const content = renderer ? renderer(ctx) : <BaseView g={g} paused={seasonMenu.menuState.open} onRoomTap={handleRoomTap} />;

  // BaseView（敷地画面）表示中だけ wrap を fill モードにし、画面の残り高さを全て使う
  // （Wave D2以前は横長固定のSVGが縦長スマホで画面高の27%しか占めず下半分が余っていた）。
  const isBase = !renderer;

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
