// 静的データ（Phase 1で src/main.jsx から分離）。純粋な定数のみ。

export const TYPES = {
  SPR: { label: "スプリンター", color: "#35c07e", affinity: { sprint: 5 } },
  CLM: { label: "クライマー", color: "#e8544f", affinity: { climb: 5, mtn: 5 } },
  RUL: { label: "ルーラー", color: "#4f8fe8", affinity: { flat: 4 } },
  PUN: { label: "パンチャー", color: "#c98bf0", affinity: { hill: 5 } },
  TT:  { label: "独走屋（TT）", color: "#e8a13c", affinity: { tt: 6 } },
};

export const TYPE_ROLE_FIT = {
  mountain: ["CLM", "PUN"],
  flat: ["SPR", "RUL"],
};

export const AB_KEYS = ["flat", "climb", "sprint", "stamina", "solo"];

export const AB_LABEL = { flat: "平坦", climb: "登坂", sprint: "スプリント", stamina: "スタミナ", solo: "独走" };

export const AB_COLOR = { flat: "#4f8fe8", climb: "#e8544f", sprint: "#35c07e", stamina: "#c9a13c", solo: "#c98bf0" };

// 第29弾（判断③・ユーザー合意「強」）: 脚質ごとの能力別成長上限差。得意+10／準得意+5
// （パンチャーは双得意+7）／苦手−12。マイライフの選手上限（domain/mylife/growthCap.js）と
// 第31弾でAIの上限（core.js newRider・domain/shared/scouting.js）の両方が参照するため、
// data/abilities.js（TYPES・AB_KEYSの定義元）へ置く（sim層・shared層のどちらからも
// 依存の向きを崩さず参照できる場所。CLAUDE.md §5「写経して増やさない」）。
export const ML_TYPE_CAP_OFFSET = {
  SPR: { flat: 5, climb: -12, sprint: 10, stamina: 0, solo: 0 },
  CLM: { flat: 0, climb: 10, sprint: -12, stamina: 5, solo: 0 },
  RUL: { flat: 10, climb: -12, sprint: 0, stamina: 5, solo: 0 },
  PUN: { flat: 0, climb: 7, sprint: 7, stamina: 0, solo: -12 },
  TT: { flat: 5, climb: 0, sprint: -12, stamina: 0, solo: 10 },
};

// v43(マイライフ難易度調整Phase 1・柱0): gainMulはlogic/support.jsのgrowthPhase()が
// 返すgain（練習・出走経験の伸び倍率）に掛かるタイプ別係数。従来は成長期・全盛期・
// 衰え期の長さ（peak）だけが違い、伸び速度は全タイプ共通1.0だったため、ピークが遅い
// ほど「成長期が長い＝総成長量が多い」だけの一方的な優劣になっていた（晩成・超晩成が
// 早熟・普通の完全上位互換）。ここに速度側の逆補正を掛けて、「早く強くなるが総量は
// 少ない（早熟）」⇔「総量は多いが遅い（晩成）」という本来のトレードオフに戻す。
// season/mylife両方がgrowthPhase()を共有するため、この係数は両モードへ自動的に効く。
export const GROWTH = {
  early: { label: "早熟", peak: [21, 25], gainMul: 1.7 },
  normal: { label: "普通", peak: [24, 29], gainMul: 1.25 },
  late: { label: "晩成", peak: [28, 33], gainMul: 1.0 },
  // v19: 早熟・晩成それぞれの極端形。superEarly/超晩成は通常の3タイプよりさらに
  // ピークが偏っており、ごく稀にしか出現しない（newRiderの生成時に低確率で抽選）
  super_early: { label: "超早熟", peak: [18, 21], gainMul: 2.4 },
  super_late: { label: "超晩成", peak: [32, 38], gainMul: 0.85 },
};

export const POW = {
  S: { mul: 1.6, color: "#ffd23f" }, A: { mul: 1.3, color: "#35c07e" },
  B: { mul: 1.0, color: "#4f8fe8" }, C: { mul: 0.7, color: "#9aa3b5" },
};

export const ABILITIES = {
  // 地形適性
  mount:       { label: "山の申し子", desc: "山岳・山頂フィニッシュ区間で能力+4", category: "地形適性" },
  puncheur:    { label: "丘陵ハンター", desc: "丘陵区間で能力+4", category: "地形適性" },
  flatlander:  { label: "平坦の職人", desc: "平坦区間で能力+4", category: "地形適性" },
  sprinter_sp: { label: "スプリント巧者", desc: "ゴールスプリント区間で能力+4", category: "地形適性" },
  soloist:     { label: "独走の求道者", desc: "TT区間で能力+4", category: "地形適性" },
  // v28: 万能型の地形適性。全区間で控えめに底上げする（脚質を選ばないオールラウンダー）
  allrounder_sp:{ label: "オールラウンダー", desc: "全ての区間で能力+2", category: "地形適性" },
  // v34(C-2): 古典適性（脚質別）。各モニュメント（石畳/丘陵/山岳）ごとに専用の適性があり、
  // 対応する古典レースでのみ全能力+5%（金特で+9%）。消耗の激しいワンデー古典の英雄。
  pave_sp:     { label: "石畳巧者", desc: "石畳の古典《春の地獄》で全能力+5%（金の状態で+9%）", category: "地形適性" },
  ardennes_sp: { label: "アルデンヌの狼", desc: "丘陵の古典《アルデンヌ》で全能力+5%（金の状態で+9%）", category: "地形適性" },
  autumn_sp:   { label: "秋の女王", desc: "山岳の古典《秋の女王》で全能力+5%（金の状態で+9%）", category: "地形適性" },
  // 展開・役割
  escape:      { label: "逃げ屋", desc: "アタック（逃げ）中の能力+4", category: "展開・役割" },
  domestique:  { label: "献身のアシスト", desc: "牽引中の能力+3", category: "展開・役割" },
  closer:      { label: "勝負師", desc: "ゴールスプリント・山頂フィニッシュで能力+4", category: "展開・役割" },
  // v37: 特能拡充。最終直線の追い込みが鋭い「差し脚」（finisherと別枠で最終区間の伸び）
  kicker:      { label: "剛脚の差し脚", desc: "最終直線での追い込みがさらに鋭くなる", category: "展開・役割" },
  // v37(第2弾): 展開・地形
  allclimber:  { label: "岳人", desc: "丘陵・登坂・山岳の全区間で能力+4", category: "地形適性" },
  windguard:   { label: "横風の達人", desc: "横風区間でのドラフト消耗ペナルティをほぼ無効化", category: "展開・役割" },
  choke:       { label: "勝負弱い", desc: "最終直線での追い込みが鈍い", category: "展開・役割", bad: true },
  crosswind_sp:{ label: "横風耐性", desc: "横風区間でのドラフト消耗が軽減される", category: "展開・役割" },
  rain_sp:     { label: "悪天候巧者", desc: "雨天レースでの能力低下が軽減され、落車のリスクも下がる", category: "展開・役割" },
  // v28: 最終スプリント区間（勝負どころ）での追い込みが鋭くなる
  finisher:    { label: "豪脚のラストスパート", desc: "最終スプリント区間での追い込みが強くなる", category: "展開・役割" },
  // メンタル・大舞台
  big:         { label: "大舞台に強い", desc: "★3レースで全能力+6%", category: "メンタル" },
  bigheart:    { label: "大舞台の申し子", desc: "★3・★4の大舞台で全能力+7%（世界選手権・五輪でも発揮）", category: "メンタル" },
  // v28: 大舞台に弱い（★3で能力低下）。悪特性
  nervous:     { label: "大舞台に弱い", desc: "★3レースで全能力-5%", category: "メンタル", bad: true },
  // フィジカル
  iron:        { label: "鉄人", desc: "出走疲労が軽減される", category: "フィジカル" },
  recover:     { label: "回復力", desc: "毎月さらに疲労-15", category: "フィジカル" },
  tough:       { label: "頑丈", desc: "怪我の発生率が半分（3連闘は防げない）", category: "フィジカル" },
  steady_sp:   { label: "精密機械", desc: "調子の変動が小さく安定する", category: "フィジカル" },
  // v28: レース中のエネルギー消耗が軽い（長丁場・逃げで垂れにくい）
  engine:      { label: "無尽蔵のエンジン", desc: "レース中のエネルギー消耗が軽くなる", category: "フィジカル" },
  // v37: 特能拡充。地形特化のエコラン（消耗軽減）＋集団に食らいつく粘り
  climbengine: { label: "山の吸血鬼", desc: "登り・山岳区間でのエネルギー消耗が軽くなる", category: "フィジカル" },
  rouleur:     { label: "鉄脚の巡航機関", desc: "平坦区間・独走・逃げでのエネルギー消耗が軽くなる（垂れにくい）", category: "フィジカル" },
  grinder:     { label: "食らいつく脚", desc: "集団から千切れにくくなる（ドラフトで粘れる）", category: "フィジカル" },
  diesel:      { label: "鉄の心肺", desc: "レース中のエネルギー消耗が軽くなる（無尽蔵のエンジンより控えめ）", category: "フィジカル" },
  recover2:    { label: "超回復", desc: "毎月の疲労回復が大きくなる", category: "フィジカル" },
  heavy:       { label: "重量級", desc: "登坂・山岳区間で能力が落ちる", category: "フィジカル", bad: true },
  glass:       { label: "ガラスの体", desc: "脆い体。シーズンでは故障率2倍・離脱+1ヶ月、マイライフでは疲労が溜まりやすく抜けにくい", category: "フィジカル", bad: true },
  moody:       { label: "ムラっ気", desc: "調子の変動が激しい", category: "フィジカル", bad: true },
  // 成長
  trainer:     { label: "練習の虫", desc: "練習効果+20%", category: "成長" },
  lateblow_sp: { label: "遅咲き", desc: "28歳以降の練習効果+15%", category: "成長" },
  // v28: 若い頃の伸びが良い（マイライフの25歳以下で練習・出走経験+15%）
  genius_sp:   { label: "天才肌", desc: "25歳以下の練習・出走経験の伸びが+15%", category: "成長" },
  // v37: 特能拡充。出走で得る経験（実戦での伸び）が大きい
  sponge:      { label: "吸収の天才", desc: "出走経験の伸びが+25%", category: "成長" },
  lazy_sp:     { label: "練習嫌い", desc: "練習効果-20%", category: "成長", bad: true },
  // v31.2: 配合限定特能（breedOnly）。通常のスカウト・後天習得では絶対に出現せず、
  // 特定条件の配合でしか手に入らない血統の証。TraitLineでは金色枠で表示する
  sireline:    { label: "系統の申し子", desc: "全区間で能力+3", category: "配合限定", breedOnly: true },
  hybrid:      { label: "二刀流", desc: "登坂・スプリント+2、さらに丘陵・山岳・スプリント区間で能力+5", category: "配合限定", breedOnly: true },
  dynasty:     { label: "覇道の血脈", desc: "全能力+2・スタミナ+3", category: "配合限定", breedOnly: true },
  // 第15弾: 血脈レシピ（複数世代にわたる隠し配合）を達成したときだけ手に入る最上位の特能。
  // 配合限定(breedOnly)のさらに上位で、通常の配合(mlBreedBonus)では絶対に付与されない
  // （付与はdomain/mylife/createChar.jsのレシピ判定処理でのみ行う）
  revenant:  { label: "雪辱の継承", desc: "全能力+4。最終直線の追い込みがさらに鋭くなる", category: "血脈レシピ", breedOnly: true },
  twinsoul:  { label: "万能の極致", desc: "全能力+3。あらゆる地形で能力+4（二刀流の上位互換）", category: "血脈レシピ", breedOnly: true },
  destiny:   { label: "宿願成就", desc: "全能力+5。大舞台（★3以上）でさらに能力+5%", category: "血脈レシピ", breedOnly: true },
  unfallen:  { label: "不落の血", desc: "全能力+4。登坂・山岳区間でさらに+6、エネルギー消耗-10%", category: "血脈レシピ", breedOnly: true },
  sovereign: { label: "絶対王者の血", desc: "全能力+6。あらゆる地形で能力+5、エネルギー消耗-8%", category: "血脈レシピ", breedOnly: true },
};

export const PERSONALITIES = {
  normal:   { label: "普通", desc: "クセなし", mul: {} },
  genius:   { label: "天才", desc: "全能力が伸びやすい", mul: { flat: 1.25, climb: 1.25, sprint: 1.25, stamina: 1.25, solo: 1.25 } },
  hotblood: { label: "熱血", desc: "スプリント↑ 登坂↓", mul: { sprint: 1.4, climb: 0.7 } },
  seeker:   { label: "求道者", desc: "登坂↑ スプリント↓", mul: { climb: 1.4, sprint: 0.7 } },
  artisan:  { label: "職人", desc: "スタミナ↑ 独走↑ スプリント↓", mul: { stamina: 1.35, solo: 1.15, sprint: 0.85 } },
  free:     { label: "自由人", desc: "独走↑ スタミナ↓", mul: { solo: 1.4, stamina: 0.7 } },
  smart:    { label: "秀才", desc: "平坦↑ 登坂↓", mul: { flat: 1.3, climb: 0.9 } },
  // v37: パーソナリティ拡充（ウマーソナリティ参考）
  maverick: { label: "一匹狼", desc: "独走↑↑ 平坦↓", mul: { solo: 1.45, flat: 0.85 } },
  showman:  { label: "目立ちたがり", desc: "スプリント↑↑ スタミナ↓", mul: { sprint: 1.4, stamina: 0.85 } },
  tactician:{ label: "策士", desc: "平坦↑ 独走↑ スプリント↓", mul: { flat: 1.25, solo: 1.2, sprint: 0.85 } },
};

export const COND_ARROW = ["↓↓", "↘", "→", "↗", "↑↑"];

export const COND_COLOR = ["#7a8296", "#8fa0b8", "#9aa3b5", "#7dd0a0", "#35c07e"];

export const COND_FC_ARROW = ["↘", "→", "↗"];

export const COND_FC_COLOR = ["#8fa0b8", "#9aa3b5", "#7dd0a0"];

export const COND_FC_LABEL = ["下降ぎみ", "安定", "上向き"];
