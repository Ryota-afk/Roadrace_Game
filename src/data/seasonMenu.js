// カイロソフト式メニューの大ジャンル/小ジャンル構成。
// キー(section.key)はhub.jsxの各セクション関数（renderRidersSection等）と1:1で対応する
// （Step13第1弾で作った6関数＋Step13第4弾で追加した"base"/"save"/"titleReturn"の3クイック
// アクション）。"save"/"titleReturn"はhub.jsx側でフルスクリーン遷移ではなく即時アクションとして
// 特別扱いされる（詳細はhub.jsxのhandleSelectSection参照）。"base"はWave G-1改の続きで
// 大ジャンル直下のリーフ項目へ格上げされ、その他(misc)からは削除した（下記参照）。
export const SEASON_MENU_CATEGORIES = [
  // sectionsを持たない大ジャンルは「小ジャンルへドリルダウンせず即座に選択される」リーフ項目
  // （MenuShellが分岐）。ホームに戻るはワンタップで戻れることが重要なため先頭・リーフ化した。
  { key: "base", icon: "🏠", label: "ホームに戻る" },
  { key: "riders", icon: "🚴", label: "選手", sections: [
    { key: "riders", label: "選手一覧・練習指定" },
  ] },
  { key: "facility", icon: "🏗", label: "施設・機材", sections: [
    { key: "facility", label: "施設・機材" },
  ] },
  { key: "market", icon: "🛒", label: "市場", sections: [
    { key: "market", label: "スカウト・移籍・購入" },
  ] },
  { key: "race", icon: "🏁", label: "レース", sections: [
    { key: "race", label: "レースカレンダー" },
  ] },
  { key: "records", icon: "📜", label: "記録", sections: [
    { key: "records", label: "通算成績・殿堂" },
  ] },
  { key: "misc", icon: "⚙️", label: "その他", sections: [
    { key: "help", label: "ヘルプ" },
    { key: "save", label: "セーブ" },
    { key: "titleReturn", label: "タイトルに戻る" },
  ] },
];

// Wave E-2: BaseView（敷地画面）の部屋（data/baseViewBuildings.jsのBASE_VIEW_BUILDINGS）を
// タップしたときに開くセクションの対応表。training/mechanic/medical/scoutはいずれも
// hub/facility.jsx（施設状況・機材強化・スタッフ・OBコーチ）で管理される状態
// （equip.frame/wheels/facility・staff.doctor/manager/scout）を表すため同じ"facility"へ、
// clubhouseだけは特定のセクションを持たない「チームの拠点」そのものなので、値をnullにして
// hub.jsx側でメニュー全体（大ジャンル一覧）を開く特別扱いにする。
export const ROOM_SECTION_MAP = {
  training: "facility",
  mechanic: "facility",
  medical: "facility",
  scout: "facility",
  clubhouse: null,
};
