// シーズンモードの画面ディスパッチ（Phase 4-2で App から分離／2026-07 Step8で src/screens/season/* へさらに分割）。
// ctx=App状態/ハンドラ。各 g.screen の実体は src/screens/season/*.jsx にあり、ここは委譲するだけの薄い窓口。
import React from "react";
import { C } from "../data/theme.js";
import { renderSeasonIntroScreens } from "./season/intro.jsx";
import { renderSeasonHubScreen } from "./season/hub.jsx";
import { renderSeasonTransferEventScreens } from "./season/transferEvents.jsx";
import { renderSeasonScheduleBoardScreens } from "./season/scheduleBoard.jsx";
import { renderSeasonRaceScreens } from "./season/race.jsx";
import { renderSeasonYearEndScreens } from "./season/yearend.jsx";

const INTRO_SCREENS = new Set(["intro", "newgame_setup", "scoutpolicy_initial", "sponsor"]);
const TRANSFER_EVENT_SCREENS = new Set(["event", "transferRequest", "poachOffer", "poachMarket", "event_result"]);
const SCHEDULE_BOARD_SCREENS = new Set(["program", "standings", "trophy", "rivals"]);
const RACE_SCREENS = new Set(["startlist", "lineup", "race", "result_pending", "result", "gc_stage", "gc_role_setup", "gc_final"]);
const YEAREND_SCREENS = new Set(["yearend", "clear"]);

export function renderSeasonScreens(ctx) {
  const { g, wrap } = ctx;
  if (INTRO_SCREENS.has(g.screen)) return renderSeasonIntroScreens(ctx);
  if (g.screen === "main") return renderSeasonHubScreen(ctx);
  if (TRANSFER_EVENT_SCREENS.has(g.screen)) return renderSeasonTransferEventScreens(ctx);
  if (SCHEDULE_BOARD_SCREENS.has(g.screen)) return renderSeasonScheduleBoardScreens(ctx);
  if (RACE_SCREENS.has(g.screen)) return renderSeasonRaceScreens(ctx);
  if (YEAREND_SCREENS.has(g.screen)) return renderSeasonYearEndScreens(ctx);
  return wrap(<div style={{ color: C.sub }}>読み込み中…</div>);
}
