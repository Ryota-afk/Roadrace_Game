// カイロソフト式メニューの大ジャンル/小ジャンル構成（Step13第2弾）。
// キー(section.key)は将来hub.jsxの各セクション関数（renderRidersSection等）と1:1で対応させる想定。
export const SEASON_MENU_CATEGORIES = [
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
