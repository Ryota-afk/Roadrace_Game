// 拠点(BaseView)の部屋グレード演出（Wave H-2）の見た目パラメータ。リテラルのみ。
//
// 【設計変更の記録】当初案では「壁を上質色へ塗り替える」を各グレードの一要素として
// 想定していたが、実装時にRoom.jsxの構造を確認したところ、壁（クラブハウス外周2面＋
// 部屋間の間仕切り）はクラブハウス全体で共有される要素であり、特定の1部屋だけを塗り替える
// ことができない（間仕切りがどの部屋の境界かを示すデータも持っていない）と判明した。
// 加えてデフォルトズームでは1部屋が画面上わずか約40×30pxしかなく、微妙な色調変化は
// どのみち視認できない（設計時に洗い出した既知のリスク）。そのため壁の塗り替えは
// 見送り、「輪郭のはっきりした付加物」＝ラグ・天井照明の光溜まり・バッジの金枠に
// 効果を集約した（床の色相＝部屋の識別情報は変更しない、という制約は維持）。
//
// ラグの色は各部屋の持ち場アクセント色（data/baseViewBuildings.jsのBASE_VIEW_STATIONS/
// BASE_VIEW_EMPTY_ROOMSで元々「その部屋の色」として使われている値）をそのまま再利用する
// （新しい配色を増やさない・部屋アイデンティティと一貫させるため）。
export const ROOM_GRADE_RUG_COLOR = {
  training: "#2f8f5c",
  mechanic: "#c9a23c",
  medical: "#4f8fe8",
  scout: "#c98bf0",
  corridor: "#b89968",
  spare1: "#9aa0a6",
  spare2: "#9aa0a6",
};

// グレードごとの演出フラグ。G1=目地のみ、G2=目地+ラグ、G3=目地+ラグ+天井照明+バッジ金枠。
export const ROOM_GRADE_SHOWS_GROUT = (grade) => grade >= 1;
export const ROOM_GRADE_SHOWS_RUG = (grade) => grade >= 2;
export const ROOM_GRADE_SHOWS_LIGHT = (grade) => grade >= 3;
export const ROOM_GRADE_SHOWS_GOLD_BADGE = (grade) => grade >= 3;
