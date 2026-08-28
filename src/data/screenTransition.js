// 第66弾 Phase 1（devlog/wave66.md）: マイライフの画面遷移アニメーション分類。
// 画面ID→分類の静的対応表と、分類から実際の遷移種別を決める純関数のみ（JSXは持たない。
// CLAUDE.md §5: data/はJSXをimportしない）。呼び出し側（画面遷移を起こす約100箇所）は
// この対応表を一切参照しない——components/chrome.jsx側だけがこれを読む。

// BottomTabs.jsx のML_TABSと同じ並び順（横スライドの方向はこの並びのindex差で決める）。
export const ML_TABS_ORDER = ["mylife_main", "mylife_rider", "mylife_world", "mylife_shop", "mylife_archive"];

// ②長い一覧（リスト全体が上から満ちる）。第60〜65弾のいずれの改修にも含まれない、
// 縦に長い一覧画面。
const LIST_SCREENS = new Set([
  "mylife_ranking", "mylife_worldstats", "mylife_riderstats",
  "mylife_teamroster", "mylife_legends", "mylife_newspaper",
]);

// ③読むための画面（動かさない）。第65弾で解体した「遊び方」を含む、目的が読むことの画面。
const READ_SCREENS = new Set([
  "mylife_help", "mylife_abilityfile", "mylife_factors",
  "mylife_lineage", "mylife_records", "mylife_achievements", "mylife_graph",
]);

// ⑤レースの流れ（横スイープ・タブ間より大きくゆっくり）。
const RACE_FLOW_SCREENS = new Set([
  "mylife_startlist", "mylife_race", "mylife_result", "mylife_rival_scene",
]);

// ④その他（persist）は上記いずれにも該当しない全画面が既定で該当するため、個別列挙は不要。

export function mlScreenCategory(screen) {
  if (LIST_SCREENS.has(screen)) return "list";
  if (READ_SCREENS.has(screen)) return "read";
  if (RACE_FLOW_SCREENS.has(screen)) return "race";
  if (ML_TABS_ORDER.includes(screen)) return "tab";
  return "default";
}

// 優先順位（devlog/wave66.md）：月が進んだ(month) > 行き先の分類(list/read/race) >
// タブ間の方向(tabForward/tabBack) > 既定(rise)。
// 戻り値："month" | "flow" | "none" | "sweep" | "tabForward" | "tabBack" | "rise"
export function mlTransitionKind({ prevScreen, nextScreen, monthChanged }) {
  if (monthChanged) return "month";
  const nextCat = mlScreenCategory(nextScreen);
  if (nextCat === "list") return "flow";
  if (nextCat === "read") return "none";
  if (nextCat === "race") return "sweep";
  if (nextCat === "tab") {
    const prevCat = mlScreenCategory(prevScreen);
    if (prevCat === "tab" && prevScreen !== nextScreen) {
      const pi = ML_TABS_ORDER.indexOf(prevScreen);
      const ni = ML_TABS_ORDER.indexOf(nextScreen);
      return ni > pi ? "tabForward" : "tabBack";
    }
    return "rise";
  }
  return "rise";
}
