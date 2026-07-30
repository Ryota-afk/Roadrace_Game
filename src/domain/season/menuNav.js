// カイロソフト式メニュー（右下ボタン→左パネル→大ジャンル→小ジャンル）のナビゲーション状態。
// Step13第2弾。JSXを持たない純粋な状態機械（(state, ...args) => newState）として実装し、
// hooks/useSeasonMenu.jsから薄いuseReducer相当のラッパーとして呼ばれる。
export function initMenuNav() {
  return { open: false, cat: null, section: null };
}

// メニューを開く。開いた瞬間は常に大ジャンル一覧（cat:null）から始める。
export function openMenu(s) {
  return { ...s, open: true, cat: null };
}

// メニューを閉じる（大ジャンル選択状態はリセットするが、直前に表示していたsectionは
// 保持する＝メニューを開閉してもそれまで見ていた画面には留まる）。
export function closeMenu(s) {
  return { ...s, open: false, cat: null };
}

export function selectCategory(s, catKey) {
  return { ...s, cat: catKey };
}

export function backToCategories(s) {
  return { ...s, cat: null };
}

// 小ジャンル（末端の行動）を選ぶと、メニューは自動的に閉じてその画面へ遷移する。
export function selectSection(s, sectionKey) {
  return { ...s, open: false, cat: null, section: sectionKey };
}
