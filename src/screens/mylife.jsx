// マイライフモードの画面ディスパッチ（Phase 4-2で App から分離／2026-07 Step8で src/screens/mylife/* へさらに分割）。
// ctx=App状態/ハンドラ。各 ml.screen の実体は src/screens/mylife/*.jsx にあり、ここは委譲するだけの薄い窓口。
import React from "react";
import { T } from "../data/theme.js";
import { renderMyLifeCreateScreens } from "./mylife/create.jsx";
import { renderMyLifeHubScreen } from "./mylife/hub.jsx";
import { renderMyLifeHelpScreens } from "./mylife/help.jsx";
import { renderMyLifeRaceScreens } from "./mylife/race.jsx";
import { renderMyLifeEventScreens } from "./mylife/events.jsx";
import { renderMyLifeCareerScreens } from "./mylife/career.jsx";
// 第13弾Phase3-A：下部タブ5分類のうち新設した3画面（選手・世界・記録）
import { renderMyLifeRiderScreen } from "./mylife/rider.jsx";
import { renderMyLifeWorldScreen } from "./mylife/world.jsx";
import { renderMyLifeArchiveScreen } from "./mylife/archive.jsx";

const CREATE_SCREENS = new Set(["mylife_create", "mylife_scout", "mylife_badge_goals"]);
const HUB_SCREENS = new Set(["mylife_main", "mylife_achievements", "mylife_abilityfile", "mylife_riderstats", "mylife_worldstats", "mylife_records"]);
const RACE_SCREENS = new Set(["mylife_startlist", "mylife_race", "mylife_result", "mylife_rival_scene", "mylife_newspaper"]);
const EVENT_SCREENS = new Set(["mylife_shop", "mylife_event", "mylife_protege_event", "mylife_event_result", "mylife_offseason", "mylife_offseason_result", "mylife_crossroads", "mylife_crossroads_result", "mylife_contract"]);
const CAREER_SCREENS = new Set(["mylife_retire_advice", "mylife_retired", "mylife_teamroster", "mylife_graph", "mylife_ranking", "mylife_lineage", "mylife_factors", "mylife_legends"]);

export function renderMyLifeScreens(ctx) {
  const { ml, mlWrap } = ctx;
  if (CREATE_SCREENS.has(ml.screen)) return renderMyLifeCreateScreens(ctx);
  if (ml.screen === "mylife_rider") return renderMyLifeRiderScreen(ctx);
  if (ml.screen === "mylife_world") return renderMyLifeWorldScreen(ctx);
  if (ml.screen === "mylife_archive") return renderMyLifeArchiveScreen(ctx);
  if (HUB_SCREENS.has(ml.screen)) return renderMyLifeHubScreen(ctx);
  if (ml.screen === "mylife_help") return renderMyLifeHelpScreens(ctx);
  if (RACE_SCREENS.has(ml.screen)) return renderMyLifeRaceScreens(ctx);
  if (EVENT_SCREENS.has(ml.screen)) return renderMyLifeEventScreens(ctx);
  if (CAREER_SCREENS.has(ml.screen)) return renderMyLifeCareerScreens(ctx);
  return mlWrap(<div style={{ color: T.color.sub }}>読み込み中…</div>);
}
