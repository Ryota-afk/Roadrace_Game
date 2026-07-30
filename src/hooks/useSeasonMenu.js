// カイロソフト式メニューのReact state接続。Step13第2弾。
// 実体（状態遷移）はdomain/season/menuNav.jsの純関数群。ここはsetGと同型の薄いラッパーのみ。
import { useState } from "react";
import { initMenuNav, openMenu, closeMenu, selectCategory, backToCategories, selectSection } from "../domain/season/menuNav.js";

export function useSeasonMenu() {
  const [menuState, setMenuState] = useState(initMenuNav);
  return {
    menuState,
    openMenu: () => setMenuState(openMenu),
    closeMenu: () => setMenuState(closeMenu),
    selectCategory: (catKey) => setMenuState(s => selectCategory(s, catKey)),
    backToCategories: () => setMenuState(backToCategories),
    selectSection: (sectionKey) => setMenuState(s => selectSection(s, sectionKey)),
  };
}
