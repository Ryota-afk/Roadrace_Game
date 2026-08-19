import { createRoot } from "react-dom/client";
import React from "react";

// 第13弾Phase1: 埋め込みフォントの@font-face宣言。ビルド時にbase64で単一HTMLへインライン化される。
import "./styles/fonts.css";

import { initGame } from "./state/state.js";
import { makeWrap, makeMlWrap, makeMetaWrap } from "./components/chrome.jsx";
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
  const { superMode, setSuperMode, buyCpItem, resetCpProgress, confirmDialog, setConfirmDialog, askConfirm, renameState, setRenameState, openRename } = shell;
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
  const metaWrap = makeMetaWrap({ ...modal });

  // ================= メタ画面（モード選択・生涯評価・系譜・因子・CPショップ） =================
  // v46(UI): season用wrap()ではなくmetaWrap()を渡す（モード非依存の画面にシーズンの
  // 自チーム情報が漏れる不具合の修正。詳細はcomponents/chrome.jsxのmakeMetaWrap参照）。
  const metaScreen = renderMetaScreens({ superMode, setSuperMode, buyCpItem, resetCpProgress, askConfirm, wrap: metaWrap });
  if (metaScreen) return metaScreen;

  // v41(§Step7第10弾): ctx（旧・88メンバーの手組みオブジェクト）を season/mylife に分割した。
  // season画面はmylifeハンドラを一切受け取らない（層の逆流を構造的に不可能にする）。
  // 両モード共有の3メンバー（askConfirm/openRename/setSuperMode）だけをshellから注入する。
  const shellForScreens = { askConfirm, openRename, setSuperMode };
  if (superMode === "mylife") return renderMyLifeScreens({ ...shellForScreens, ...mylife, mlWrap, becomeManager });

  // ================= 画面（シーズンモード） =================
  // v46(UI): metaWrapもseason ctxへ渡す（新規設定前のオンボーディング画面がまだ実在しない
  // チーム情報を表示しないようscreens/season/intro.jsx側で使い分けるため）。
  return renderSeasonScreens({ ...shellForScreens, ...season, wrap, metaWrap, seasonMenu });
}


export default App;
createRoot(document.getElementById("root")).render(<App />);
