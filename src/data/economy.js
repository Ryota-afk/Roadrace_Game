// 経済・報酬関連の静的データ（Phase 4-1後の support.js から分離）。

// v37: マイライフ用CP特典。生涯CPに応じてデビュー時の支度金・人気・監督評価・成長力抽選・
// 当たり特能抽選が強化される（＝CPがマイライフでも意味を持つ／周回で新人が有利になる）。
export const ML_CP_MILESTONES = [
  { cp: 10, label: "支度金 +50万円", perk: { money: 50 } },
  { cp: 20, label: "初期人気 +10", perk: { pop: 10 } },
  { cp: 40, label: "初期監督評価 +8", perk: { eval: 8 } },
  { cp: 60, label: "成長力アップ抽選 +15%", perk: { growthLottery: 0.15 } },
  { cp: 85, label: "デビュー当たり特能の抽選 +10%", perk: { boonBonus: 0.10 } },
  { cp: 120, label: "支度金 +150万＆初期人気 +15", perk: { money: 150, pop: 15 } },
  // v38(#5): 高CP帯のマイライフ特典を延伸
  { cp: 170, label: "初期監督評価 +12＆成長力抽選 +15%", perk: { eval: 12, growthLottery: 0.15 } },
  { cp: 240, label: "デビュー当たり特能の抽選 +15%＆支度金 +300万", perk: { boonBonus: 0.15, money: 300 } },
  { cp: 330, label: "初期人気 +25＆監督評価 +12", perk: { pop: 25, eval: 12 } },
];

export const MLCP_DIFF_MUL = { easy: 0.7, normal: 1.0, hard: 1.5, oni: 2.2 };

export const STAFF_ROLES = {
  manager: { label: "監督", desc: "スポンサー契約が好条件に（Lvごと月収+12%・ノルマ-8%・成功報酬+10%）" },
  trainer: { label: "トレーナー", desc: "練習の成長効果がアップする（Lvごと+12%・恒常）" },
  doctor:  { label: "ドクター", desc: "故障の発生率が下がり（Lvごと-22%）、故障期間も大きく短縮される" },
  // v28: スカウトスタッフ。新人スカウト候補の能力ブレ幅（＝査定の不確かさ）を減らし、
  // 逸材（成長S確定の隠し玉）の発掘率も上げる。スカウト方針とは別枠で査定精度を高める役割
  scout:   { label: "スカウト", desc: "新人候補の査定が正確になり（Lvごとブレ-30%）、逸材の発掘率も大きく上がる" },
};

export const STAFF_MAX_BY_CLASS = [1, 2, 3];

// v35(シーズン深掘り): スタッフの個性化。役割ごとに名前・肩書・現在レベルの具体効果を返し、
// 「顔の見えるスタッフ陣」にする。名前はチーム名＋役割から決定論的に生成（在籍中は不変）。
export const STAFF_META = {
  manager: { icon: "🧑‍💼", title: "監督" },
  trainer: { icon: "🧑‍🏫", title: "トレーナー" },
  doctor:  { icon: "🩺", title: "チームドクター" },
  scout:   { icon: "🔍", title: "スカウト" },
};

export const STAFF_SALARY_PER_LV = 12; // 万円/月・レベル1つあたり（月給制、昇格なし＝買い切り費用は無し）

export const OB_COACH_SALARY = 8; // 万円/月

export const TYPE_COACH_ABILITY = { SPR: "sprint", CLM: "climb", RUL: "flat", PUN: "climb", TT: "solo" };

export const SLOT_LABEL = { frame: "フレーム", tire: "タイヤ", wheels: "ホイール", nutrition: "補給食" };

export const SCOUT_POLICIES = {
  balance: { label: "おまかせ", desc: "バランス型の候補" },
  sprint:  { label: "スプリント重視", desc: "スプリンター系が集まる" },
  climb:   { label: "登坂力重視", desc: "クライマー系が集まる" },
  future:  { label: "将来性重視", desc: "若く成長力の高い原石" },
  now:     { label: "即戦力重視", desc: "完成度の高い中堅" },
};

export const PRIZES = [100, 60, 40, 30, 22, 16, 12, 9, 6, 4];

export const PTS = [10, 7, 5, 3, 3, 1, 1, 1, 1, 1];

export const GRADE_MUL = { 1: 1, 2: 1.5, 3: 2, 4: 2.6 };

export const WEATHER = {
  clear: { label: "晴れ", icon: "☀️" },
  rain: { label: "雨", icon: "🌧" },
  heat: { label: "猛暑", icon: "🥵" },
};

export const POP_MILESTONES = [
  { th: 25, bonus: 80 }, { th: 50, bonus: 150 }, { th: 75, bonus: 250 }, { th: 100, bonus: 400 },
];

export const EVENT_CHANCE = 0.35;

