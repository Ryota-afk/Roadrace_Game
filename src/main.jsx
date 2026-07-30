import { createRoot } from "react-dom/client";
import React from "react";

import { initGame } from "./state/state.js";
import { makeWrap, makeMlWrap } from "./components/chrome.jsx";
import { renderMetaScreens } from "./screens/meta.jsx";
import { renderMyLifeScreens } from "./screens/mylife.jsx";
import { renderSeasonScreens } from "./screens/season.jsx";

// ---- Step7第10弾：g/ml/shellの状態・ハンドラをフックへ集約 ----
import { useAppShell } from "./hooks/useAppShell.js";
import { useSeasonGame } from "./hooks/useSeasonGame.js";
import { useMyLifeGame } from "./hooks/useMyLifeGame.js";
// Step13第4弾: カイロソフト式メニューの状態。早期returnより前で無条件に呼ぶ
// （Rules of Hooks。第2弾の実機検証で「早期returnの後段で呼ぶとレンダーごとにフック
// 呼び出し回数が変わりクラッシュする」ことを確認済み。詳細はDEVLOG §10参照）。
import { useSeasonMenu } from "./hooks/useSeasonMenu.js";

// ---------- メインアプリ ----------
function App() {
  const shell = useAppShell();
  const { superMode, setSuperMode, buyCpItem, confirmDialog, setConfirmDialog, askConfirm, renameState, setRenameState, openRename } = shell;
  const season = useSeasonGame();
  const { g, setG } = season;
  const mylife = useMyLifeGame({ superMode, askConfirm });
  const { ml } = mylife;
  const seasonMenu = useSeasonMenu();

  // v38(#9 A-4): 選手→監督の転身ブリッジ。マイライフの殿堂選手を新チームの監督として招聘する
  // （生涯評価画面の「監督として新チームを率いる」から呼ばれる、season/mylifeを跨ぐ唯一の導線）
  const becomeManager = () => { setSuperMode("season"); setG({ ...initGame(), screen: "newgame_setup", legendRecruitIdx: 0 }); };

  const modal = { renameState, setRenameState, confirmDialog, setConfirmDialog };
  const wrap = makeWrap({ g, setG, ...modal });
  const mlWrap = makeMlWrap({ ml, ...modal });

  // ================= メタ画面（モード選択・生涯評価・系譜・因子・CPショップ） =================
  const metaScreen = renderMetaScreens({ superMode, setSuperMode, buyCpItem, wrap });
  if (metaScreen) return metaScreen;

  // v41(§Step7第10弾): ctx（旧・88メンバーの手組みオブジェクト）を season/mylife に分割した。
  // season画面はmylifeハンドラを一切受け取らない（層の逆流を構造的に不可能にする）。
  // 両モード共有の3メンバー（askConfirm/openRename/setSuperMode）だけをshellから注入する。
  const shellForScreens = { askConfirm, openRename, setSuperMode };
  if (superMode === "mylife") return renderMyLifeScreens({ ...shellForScreens, ...mylife, mlWrap, becomeManager });

  // ================= 画面（シーズンモード） =================
  return renderSeasonScreens({ ...shellForScreens, ...season, wrap, seasonMenu });
}


export default App;
createRoot(document.getElementById("root")).render(<App />);
