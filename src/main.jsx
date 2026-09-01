import { createRoot } from "react-dom/client";
import React from "react";

// 第13弾Phase1: 埋め込みフォントの@font-face宣言。ビルド時にbase64で単一HTMLへインライン化される。
import "./styles/fonts.css";
// 第66弾Phase1(devlog/wave66.md): 画面遷移アニメーションのkeyframes。
import "./styles/transitions.css";

import { initGame } from "./state/state.js";
import { logEvent } from "./dev/telemetry.js";
import { makeWrap, makeMlWrap, makeMetaWrap } from "./components/chrome.jsx";
import { mlTransitionKind, seasonTransitionKind } from "./data/screenTransition.js";
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
  // 第67弾(devlog/wave67.md): シーズンも同じ「enterKeyが同じ間はkindを凍結する」対策が
  // 要る（第66弾Phase1で踏んだkindドリフトのバグと同じ構造のため）。⚠️seasonMenuの
  // menuState.sectionをkeyへ含めるのが本体——これが無いとメニュー移動（main画面内での
  // section差し替え）は一切アニメーションしない（実測済み・devlog/wave67.md）。
  // ⚠️方向つき横スライドは使わないためprevScreenは不要。
  const seasonSection = seasonMenu.menuState.section;
  const seasonTransitionRef = React.useRef({ year: g.year, month: g.month, enterKey: null, kind: "rise" });
  const prevSeasonTransition = seasonTransitionRef.current;
  const seasonMonthChanged = prevSeasonTransition.year !== g.year || prevSeasonTransition.month !== g.month;
  const seasonCandidateKind = seasonTransitionKind({ screen: g.screen, section: seasonSection, monthChanged: seasonMonthChanged });
  const seasonCandidateKey = seasonCandidateKind === "none" ? "static" : `${g.screen}:${seasonSection || "base"}:${g.year}-${g.month}`;
  const seasonSameAsBefore = seasonCandidateKey === prevSeasonTransition.enterKey;
  const seasonTransitionInfo = {
    enterKey: seasonCandidateKey,
    kind: seasonSameAsBefore ? prevSeasonTransition.kind : seasonCandidateKind,
  };
  seasonTransitionRef.current = { year: g.year, month: g.month, enterKey: seasonTransitionInfo.enterKey, kind: seasonTransitionInfo.kind };
  const wrap = makeWrap({ g, setG, transitionInfo: seasonTransitionInfo, ...modal });
  // 第66弾Phase1(devlog/wave66.md): 画面ID＋年月からenterKeyとkindを決め、
  // 「enterKeyが変わった時だけ」新しいkindを採用して固定する。
  // ⚠️kindを毎レンダー素朴に計算し直すと、月が進んだ直後の次のレンダー（例：
  // アコーディオン開閉など画面もenterKeyも変わらない操作）でmonthChangedがfalseへ戻り、
  // "month"→"rise"へドリフトして無関係な操作のたびに本文が再アニメする実測バグがあった
  // （同じenterKeyのままclassNameだけ変わるとCSSアニメーションは再発火するため）。
  // enterKeyが同じ間はkindを凍結することでこれを防ぐ。
  const mlTransitionRef = React.useRef({ screen: ml.screen, year: ml.year, month: ml.month, enterKey: null, kind: "rise" });
  const prevMlTransition = mlTransitionRef.current;
  const monthChanged = prevMlTransition.screen === "mylife_main" && ml.screen === "mylife_main"
    && (prevMlTransition.year !== ml.year || prevMlTransition.month !== ml.month);
  const candidateKind = mlTransitionKind({ prevScreen: prevMlTransition.screen, nextScreen: ml.screen, monthChanged });
  const candidateKey = candidateKind === "none" ? "static" : `${ml.screen}:${ml.year}-${ml.month}`;
  const sameAsBefore = candidateKey === prevMlTransition.enterKey;
  const mlTransitionInfo = {
    enterKey: candidateKey,
    kind: sameAsBefore ? prevMlTransition.kind : candidateKind,
  };
  mlTransitionRef.current = { screen: ml.screen, year: ml.year, month: ml.month, enterKey: mlTransitionInfo.enterKey, kind: mlTransitionInfo.kind };
  // 第95弾 #31-A: 画面が切り替わった時、または月が進んだ時に記録する（既定OFF・src/dev/telemetry.js参照）。
  // ⚠️月送りのほとんどは`screen`が"mylife_main"のまま変化しない（train/rest/peakはmonth.jsが
  // 毎回screen:"mylife_main"を返す）ため、依存をml.screenだけにすると同じ画面に何ヶ月も
  // 滞在した扱いになり、月ごとの滞在時間が測れなくなる。year/monthも依存に含めて月替わりを拾う。
  React.useEffect(() => {
    if (superMode === "mylife") logEvent("screen_enter", { screen: ml.screen, year: ml.year, month: ml.month });
  }, [ml.screen, ml.year, ml.month, superMode]);
  // 第13弾Phase3-A: 下部タブ（chrome.jsxのBottomTabs）が画面遷移するためsetMlを渡す
  const mlWrap = makeMlWrap({ ml, transitionInfo: mlTransitionInfo, setMl: mylife.setMl, ...modal });
  const metaWrap = makeMetaWrap({ superMode, ...modal });

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
