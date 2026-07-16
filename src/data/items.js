// 静的データ（Phase 1で src/main.jsx から分離）。純粋な定数のみ。

export const ITEMS = {
  wheel: { label: "決戦用カーボンホイール", desc: "次の1レース：出走全員の登坂+15%", price: 30 },
  suit:  { label: "エアロワンピース", desc: "次の1レース：出走全員の平坦+15%", price: 30 },
  supp:  { label: "リカバリーサプリ", desc: "選手1名の疲労を40回復", price: 12 },
  tune:  { label: "コンディション調律", desc: "選手1名の調子を2段階アップ", price: 15 },
  camp:  { label: "トレーニングキャンプ券", desc: "今月の練習効果×2（チーム全体）。ただし全員の疲労+25（故障リスクに注意）", price: 25 },
};

export const EQUIPS = {
  frame: { label: "エアロフレーム(チーム)", desc: "平坦 +6%/Lv（全員・恒常）" },
  wheels: { label: "軽量ホイール(チーム)", desc: "登坂 +6%/Lv（全員・恒常）" },
  facility: { label: "トレーニング設備", desc: "練習効果 +15%/Lv（恒常）" },
};

export const EQUIP_COST = [40, 70, 110, 160, 220];
