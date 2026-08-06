// 拠点(BaseView)の「内装・改装」購入軸のデータ（Wave H-2）。純粋に見た目のみで能力値には
// 影響しない（Wave F-1の「敷地整備」(equip.grounds)と同じ位置づけ）。
// 対象は4つの持ち場（training/mechanic/medical/scout）のみ。廊下・納戸はここでは購入対象に
// せず、クラブハウスのクラス(g.classIdx)に連動する別ロジック(domain/season/baseViewLayout.js
// のroomGrade)で自動的にグレードが上がる。
export const ROOM_UPGRADE_KEYS = ["training", "mechanic", "medical", "scout"];

// Lv1→2→3のコスト（Lv0→1は[0]、Lv2→3は[2]）。EQUIP_COST([40,70,110,160,220]、5段階・
// 実効果あり)より高めの単価設定：内装は能力値に一切効かない分、資金に余裕が出た後半の
// 「使い道」として機能する水準を狙う（1部屋フルで480万・4部屋全てで1920万）。
export const ROOM_UPGRADE_COST = [80, 150, 250];
export const ROOM_GRADE_MAX = 3;

export const ROOM_UPGRADE_LABEL = {
  training: "トレーニング室",
  mechanic: "メカニック室",
  medical: "メディカル室",
  scout: "スカウト室",
};
