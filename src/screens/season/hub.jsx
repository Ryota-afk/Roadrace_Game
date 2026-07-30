// season.jsx より分割（Step8）：メイン画面（home/riders/shop/career/help の5タブ）
// Step13第1弾：カイロソフト式動線移行の第1歩として、各タブの中身をカテゴリ単位のセクション
// 関数（hub/*.jsx）へ機械分解した。ここは薄いディスパッチャのみで、中身の変更は一切無い。
import React from "react";
import { renderHomeSection } from "./hub/home.jsx";
import { renderRidersSection } from "./hub/riders.jsx";
import { renderMarketSection } from "./hub/market.jsx";
import { renderFacilitySection } from "./hub/facility.jsx";
import { renderRecordsSection } from "./hub/records.jsx";
import { renderHelpSection } from "./hub/help.jsx";

export function renderSeasonHubScreen(ctx) {
  const { g, wrap } = ctx;
  if (g.screen === "main") {
    let body = null;
    if (g.tab === "home") body = renderHomeSection(ctx);
    if (g.tab === "riders") body = renderRidersSection(ctx);
    if (g.tab === "shop") {
      body = (
        <div style={{ display: "grid", gap: 14 }}>
          {renderMarketSection(ctx)}
          {renderFacilitySection(ctx)}
        </div>
      );
    }
    if (g.tab === "career") body = renderRecordsSection(ctx);
    if (g.tab === "help") body = renderHelpSection();
    return wrap(body, true);
  }
}
