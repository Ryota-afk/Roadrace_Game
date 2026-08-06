// カイロソフト式メニューの大ジャンル/小ジャンル構成。
// キー(section.key)はhub.jsxのSECTION_RENDERERS（各hub/*.jsxのrender*関数）と1:1で対応する。
// "save"/"titleReturn"はhub.jsx側でフルスクリーン遷移ではなく即時アクションとして
// 特別扱いされる（詳細はhub.jsxのhandleSelectSection参照）。"base"は大ジャンル直下の
// リーフ項目（sectionsを持たない＝ワンタップで即選択されドリルダウンしない）。
//
// Step13第7弾: 各大ジャンルを小ジャンルへ細分化（それまでは1大ジャンル=1小ジャンルの
// 暫定構成だった）。移動の経緯：
// - facility末尾の「ゲームをリセット」ボタン→misc_settingsへ（施設の状況表示から独立した操作のため）
// - market先頭の「チーム名」編集セクション→misc_settingsへ（市場取引とは無関係な設定操作のため）
// - race（旧home.jsx）末尾の「年間プログラム/順位表/トロフィールーム」リンク→
//   records_standingsへ統合（いずれも記録閲覧画面への導線であり、記録ジャンルの方が自然なため）
export const SEASON_MENU_CATEGORIES = [
  // sectionsを持たない大ジャンルは「小ジャンルへドリルダウンせず即座に選択される」リーフ項目
  // （MenuShellが分岐）。ホームに戻るはワンタップで戻れることが重要なため先頭・リーフ化した。
  { key: "base", icon: "🏠", label: "ホームに戻る" },
  { key: "riders", icon: "🚴", label: "選手", sections: [
    { key: "riders_list", label: "選手一覧・練習指定" },
    { key: "riders_team", label: "チーム状況（絆・スタッフ）" },
    { key: "riders_youth", label: "ユース・血統配合" },
  ] },
  { key: "facility", icon: "🏗", label: "施設・機材", sections: [
    { key: "facility_equip", label: "施設状況・機材強化" },
    { key: "facility_staff", label: "スタッフ雇用" },
    { key: "facility_ob", label: "OBコーチ" },
    { key: "facility_room", label: "内装・改装" },
  ] },
  { key: "market", icon: "🛒", label: "市場", sections: [
    { key: "market_scout", label: "新人スカウト・FA移籍" },
    { key: "market_transfer", label: "引き抜き・トレード" },
    { key: "market_shop", label: "パーツ・消耗品" },
  ] },
  { key: "race", icon: "🏁", label: "レース", sections: [
    { key: "race_calendar", label: "レースカレンダー" },
    { key: "race_status", label: "シーズン状況・目標" },
  ] },
  { key: "records", icon: "📜", label: "記録", sections: [
    { key: "records_career", label: "通算成績・実績・年度別記録" },
    { key: "records_hall", label: "殿堂入り選手名鑑" },
    { key: "records_archive", label: "通算タイトル・コースレコード・特能図鑑" },
    { key: "records_standings", label: "年間プログラム・順位表・トロフィールーム" },
  ] },
  { key: "misc", icon: "⚙️", label: "その他", sections: [
    { key: "help", label: "ヘルプ" },
    { key: "misc_settings", label: "チーム名・その他設定" },
    { key: "save", label: "セーブ" },
    { key: "titleReturn", label: "タイトルに戻る" },
  ] },
];

// Wave E-2: BaseView（敷地画面）の部屋（data/baseViewBuildings.jsのBASE_VIEW_BUILDINGS）を
// タップしたときに開くセクションの対応表。Step13第7弾で細分化に合わせて更新：
// training/medicalは施設状況(facility_equip/facility_staff)という「部屋の状態を表す」場所への
// 導線のまま据え置き、mechanic/scoutは「その部屋でやりたいこと」＝実際にパーツを買う/選手を
// 探す先である市場側(market_shop/market_scout)へ直接飛ばすように変更した。
// clubhouseだけは特定のセクションを持たない「チームの拠点」そのものなので、値をnullにして
// hub.jsx側でメニュー全体（大ジャンル一覧）を開く特別扱いにする。
export const ROOM_SECTION_MAP = {
  training: "facility_equip",
  mechanic: "market_shop",
  medical: "facility_staff",
  scout: "market_scout",
  clubhouse: null,
};
