// マイライフの装備・住居・車の静的データ（Phase 4-1後の support.js から分離）。

// 第71弾(devlog/wave71.md): descの「（恒常）」は削除——タブ名「恒久投資」自体が
// 恒常であることを示しており、全項目に付けると重複になる（実測で判明）。
export const ML_HOUSES = [
  { label: "賃貸アパート", price: 80, fatigueBonus: 5, desc: "毎月の疲労回復+5" },
  { label: "分譲マンション", price: 220, fatigueBonus: 12, desc: "毎月の疲労回復+12" },
  { label: "郊外の一戸建て", price: 480, fatigueBonus: 22, desc: "毎月の疲労回復+22" },
  // v20: 稼いだ資金の使い道が尽きて余りがちだったため、終盤向けの最上位グレードを追加
  { label: "都心の高級タワーマンション", price: 900, fatigueBonus: 30, desc: "毎月の疲労回復+30" },
];

export const ML_CARS = [
  { label: "中古の軽自動車", price: 60, raceFatigueCut: 0.10, desc: "レース参加による疲労蓄積-10%" },
  { label: "国産セダン", price: 160, raceFatigueCut: 0.20, desc: "レース参加による疲労蓄積-20%" },
  { label: "輸入スポーツカー", price: 400, raceFatigueCut: 0.30, desc: "レース参加による疲労蓄積-30%" },
  { label: "オーダーメイドの高級SUV", price: 750, raceFatigueCut: 0.38, desc: "レース参加による疲労蓄積-38%" },
];

export const ML_AB_COACH_KEY = { flat: "flatCoach", climb: "climbCoach", sprint: "sprintCoach", stamina: "staminaCoach", solo: "soloCoach" };

export const ML_GEAR = {
  roller: { label: "自主トレ用スマートローラー", price: 90, desc: "練習の成長効果+15%" },
  monitor: { label: "パワーメーター一式", price: 70, desc: "狙った能力の伸びがさらに+10%" },
  chef: { label: "専属コンディショニングシェフ", price: 150, desc: "レース参加による疲労蓄積が10%軽減される" },
  flatCoach:    { label: "平坦専門コーチ", price: 100, desc: "平坦の練習効果+25%" },
  climbCoach:   { label: "登坂専門コーチ", price: 100, desc: "登坂の練習効果+25%" },
  sprintCoach:  { label: "スプリント専門コーチ", price: 100, desc: "スプリントの練習効果+25%" },
  staminaCoach: { label: "スタミナ専門コーチ", price: 100, desc: "スタミナの練習効果+25%" },
  soloCoach:    { label: "独走専門コーチ", price: 100, desc: "独走の練習効果+25%" },
};

// 第36弾: 専門コーチの段階制。シーズンのスタッフ（STAFF_MAX_BY_CLASS/STAFF_SALARY_PER_LV）を
// 手本にしているが、マイライフの家計スケールはチーム予算と桁が違うため、値は意図的に別で持つ
// （economy.js側を触るとシーズンのバランスまで動いてしまうため共有しない）。
// 倍率は実測で較正済み：1.50以上にすると現実的プレイのカンストが11年目→7年目へ跳ぶ崖があり、
// またfocus以外の能力は上限のはるか下で倍率が丸ごと効くため、上げすぎると全能力が一様に
// 伸びて「極めると全員同じ万能型」が再来する（詳細はdevlog/wave36.md）。
export const ML_COACH_MAX_BY_CLASS   = [1, 2, 3];        // Lv上限：B1 / A / PRO
export const ML_COACH_SLOTS_BY_CLASS = [1, 2, 3];        // 同時に雇える人数：B1 / A / PRO
export const ML_COACH_MUL    = [1, 1.25, 1.33, 1.40];    // Lv0..3 の練習効果倍率
export const ML_COACH_SALARY = [0, 6, 10, 15];           // Lv0..3 の月給（万円/月）
export const ML_COACH_SIGNING = 100;                      // 契約金（Lv0→Lv1のときのみ）

// 第44弾: バッジ所持枠：B1 / A / PRO。降格しても枠は減らさないため、コーチ枠（現在の
// classIdxで引く）とは異なり、最高到達クラス（ml.classIdxBest）で引く（devlog/wave44.md）。
export const ML_BADGE_SLOTS_BY_CLASS = [3, 4, 5];

export const ML_STOCK_ITEMS = {
  drink: { label: "リカバリードリンク", desc: "疲労を30回復", price: 15, fatigueDelta: -30 },
  supp:  { label: "上質な休養サプリ", desc: "疲労を60回復", price: 32, fatigueDelta: -60 },
  tune:  { label: "フォーム調整剤", desc: "フォームを+12（レース前の仕上げに）", price: 20, formDelta: 12 },
};

// v43(マイライフ難易度調整Phase 1・柱0-b): 成長力・成長タイプを底上げするアイテムは、従来
// 「安価・繰り返し購入可」だったため、誰でもリセマラ抜きで最速450万円ちょっとで
// 「超晩成×成長力S」という一極集中ビルドを確定入手できてしまっていた
// （実測はDEVLOGの該当ウェーブ参照）。ML_STOCK_ITEMS（在庫を貯めて後で使う消耗品）から
// 切り離し、mlBuyCar/mlBuyHouseと同じ「買った瞬間に即適用される買い切り」に変更した
// （在庫を貯めてから安い時点のレートで大量purchaseする抜け道を構造的に塞ぐため）。
//
// 才能開花プログラム：現在の成長力(C/B/A/S)ごとに価格が跳ね上がる累進制（Sには次が無く購入不可）。
export const ML_GROWTH_POW_UP_PRICE = { C: 400, B: 1200, A: 3000 };
// 成長タイプ変更：キャリアを通じて1回限り（早熟寄り／晩成寄りいずれか一方向のみ選べる）。
// 「タダ同然で晩成側に矯正する」ではなく「一度きりの選び直し」として機能させるため
// 双方向を1つの権利として共有し、高額にした。
export const ML_GROWTH_SHIFT_PRICE = 900;

// 第12弾(12-B): パーツを「育てる装備」へ。買い切りの完成品ではなく、資金を注ぎ続けて
// 育てる対象にすることで、稼いだ資金の使い道を終盤まで保つ（詳細はdevlog/wave12.md）。
// 第12弾(12-C): CP交換所「パーツ強化の上限+2」でLv7まで解禁される。既存5段の価格上昇比
// （直近2段は約1.6倍/段）をそのまま延長し、Lv5→6=240*1.6≈385、Lv6→7=385*1.6≈615とした。
export const ML_PART_UPGRADE_COST = [30, 55, 90, 150, 240, 385, 615]; // Lv0→1 … Lv6→7（万円）
export const ML_PART_LV_MAX = 5; // CP未購入時の上限（購入後の実効上限は+partLvMaxBonus）
export const ML_PART_LV_MUL = 0.12; // 1Lvあたり+12% → Lv5で1.6倍・Lv7で1.84倍

export const ML_SPECIAL_TRAINING = {
  altitude: { label: "高地合宿", keys: ["stamina", "solo"], gainMul: 1.7, fatigue: 24, cond: 0, desc: "スタミナ・独走を集中的に鍛える（疲労大）" },
  sprintcamp: { label: "スプリント特訓", keys: ["sprint", "flat"], gainMul: 1.7, fatigue: 20, cond: 0, desc: "スプリント・平坦＋加速力を集中的に鍛える" },
  climbcamp: { label: "クライム合宿", keys: ["climb", "stamina"], gainMul: 1.7, fatigue: 24, cond: 0, desc: "登坂・スタミナを集中的に鍛える（疲労大）" },
  mental: { label: "メンタル強化", keys: [], gainMul: 0.4, fatigue: 6, cond: 1, desc: "メンタルを重点強化＋全能力わずか底上げ・フォーム+8（疲労小）" },
};

