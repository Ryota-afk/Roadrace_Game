// カイロソフト式メニューの大ジャンル/小ジャンル構成。
// キー(section.key)はhub.jsxの各セクション関数（renderRidersSection等）と1:1で対応する
// （Step13第1弾で作った6関数＋Step13第4弾で追加した"base"/"save"/"titleReturn"の3クイック
// アクション）。"save"/"titleReturn"はhub.jsx側でフルスクリーン遷移ではなく即時アクションとして
// 特別扱いされる（詳細はhub.jsxのhandleSelectSection参照）。
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
    { key: "base", label: "🏠 拠点に戻る" },
    { key: "help", label: "ヘルプ" },
    { key: "save", label: "セーブ" },
    { key: "titleReturn", label: "タイトルに戻る" },
  ] },
];
