// 静的データ（Phase 1で src/main.jsx から分離）。純粋な定数のみ。

export const ITEMS = {
  wheel: { label: "決戦用カーボンホイール", desc: "次の1レース：出走全員の登坂+15%", price: 30 },
  suit:  { label: "エアロワンピース", desc: "次の1レース：出走全員の平坦+15%", price: 30 },
  supp:  { label: "リカバリーサプリ", desc: "選手1名の疲労を40回復", price: 12 },
  tune:  { label: "調子アップ", desc: "選手1名の調子を2段階上げる", price: 15 },
  camp:  { label: "トレーニングキャンプ券", desc: "今月の練習効果×2。ただし全員の疲労+25（故障リスクに注意）", price: 25 },
};

export const EQUIPS = {
  frame: { label: "エアロフレーム", desc: "平坦 +6%/Lv（全員・恒常）" },
  wheels: { label: "軽量ホイール", desc: "登坂 +6%/Lv（全員・恒常）" },
  facility: { label: "トレーニング設備", desc: "練習効果 +15%/Lv（恒常）" },
  // v42(Wave F-1): 敷地の見た目だけを変える枠。能力値への効果は無い（購入UI・経済は
  // 既存のEQUIPS/buyEquipをそのまま流用し、Lvに応じて敷地画面の装飾が増える）。
  grounds: { label: "敷地整備", desc: "池・植栽・屋外機器などで敷地の雰囲気が変化（見た目のみ・能力値への影響なし）" },
};

export const EQUIP_COST = [40, 70, 110, 160, 220];
