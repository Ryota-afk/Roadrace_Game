// 静的データ（Phase 1で src/main.jsx から分離）。純粋な定数のみ。
import { C } from "./theme.js";

export const TYPES = {
  SPR: { label: "スプリンター", color: C.green, affinity: { sprint: 5 } },
  CLM: { label: "クライマー", color: C.red, affinity: { climb: 5, mtn: 5 } },
  RUL: { label: "ルーラー", color: C.blue, affinity: { flat: 4 } },
  PUN: { label: "パンチャー", color: C.purple, affinity: { hill: 5 } },
  TT:  { label: "独走屋(TT)", color: "#e8a13c", affinity: { tt: 6 } },
};

export const TYPE_ROLE_FIT = {
  mountain: ["CLM", "PUN"],
  flat: ["SPR", "RUL"],
};

export const AB_KEYS = ["flat", "climb", "sprint", "stamina", "solo"];

export const AB_LABEL = { flat: "平坦", climb: "登坂", sprint: "ｽﾌﾟﾘﾝﾄ", stamina: "ｽﾀﾐﾅ", solo: "独走" };

export const AB_COLOR = { flat: C.blue, climb: C.red, sprint: C.green, stamina: "#c9a13c", solo: C.purple };

export const GROWTH = {
  early: { label: "早熟", peak: [21, 25] },
  normal: { label: "普通", peak: [24, 29] },
  late: { label: "晩成", peak: [28, 33] },
  // v19: 早熟・晩成それぞれの極端形。superEarly/超晩成は通常の3タイプよりさらに
  // ピークが偏っており、ごく稀にしか出現しない（newRiderの生成時に低確率で抽選）
  super_early: { label: "超早熟", peak: [18, 21] },
  super_late: { label: "超晩成", peak: [32, 38] },
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
  pave_sp:     { label: "石畳巧者", desc: "石畳の古典《春の地獄》で全能力+5%（金特で+9%）", category: "地形適性" },
  ardennes_sp: { label: "アルデンヌの狼", desc: "丘陵の古典《アルデンヌ》で全能力+5%（金特で+9%）", category: "地形適性" },
  autumn_sp:   { label: "秋の女王", desc: "山岳の古典《秋の女王》で全能力+5%（金特で+9%）", category: "地形適性" },
  // 展開・役割
  escape:      { label: "逃げ屋", desc: "アタック（逃げ）中の能力+4", category: "展開・役割" },
  domestique:  { label: "献身のアシスト", desc: "牽引中の能力+3", category: "展開・役割" },
  closer:      { label: "勝負師", desc: "ゴールスプリント・山頂フィニッシュで能力+4", category: "展開・役割" },
  crosswind_sp:{ label: "横風耐性", desc: "横風区間でのドラフト消耗が軽減される", category: "展開・役割" },
  rain_sp:     { label: "悪天候巧者", desc: "雨天レースでの能力低下が軽減され、落車のリスクも下がる", category: "展開・役割" },
  // v28: 最終スプリント区間（勝負どころ）での追い込みが鋭くなる
  finisher:    { label: "豪脚のラストスパート", desc: "最終スプリント区間での追い込みが強くなる", category: "展開・役割" },
  // メンタル・大舞台
  big:         { label: "大舞台に強い", desc: "★3レースで全能力+6%", category: "メンタル" },
  // v28: 大舞台に弱い（★3で能力低下）。悪特性
  nervous:     { label: "大舞台に弱い", desc: "★3レースで全能力-5%", category: "メンタル", bad: true },
  // フィジカル
  iron:        { label: "鉄人", desc: "出走疲労が軽減される", category: "フィジカル" },
  recover:     { label: "回復力", desc: "毎月さらに疲労-15", category: "フィジカル" },
  tough:       { label: "頑丈", desc: "怪我の発生率が半分（3連闘は防げない）", category: "フィジカル" },
  steady_sp:   { label: "精密機械", desc: "調子の変動が小さく安定する", category: "フィジカル" },
  // v28: レース中のエネルギー消耗が軽い（長丁場・逃げで垂れにくい）
  engine:      { label: "無尽蔵のエンジン", desc: "レース中のエネルギー消耗が軽くなる", category: "フィジカル" },
  glass:       { label: "ガラスの体", desc: "怪我の発生率2倍・離脱期間+1ヶ月", category: "フィジカル", bad: true },
  moody:       { label: "ムラっ気", desc: "調子の変動が激しい", category: "フィジカル", bad: true },
  // 成長
  trainer:     { label: "練習の虫", desc: "練習効果+20%", category: "成長" },
  lateblow_sp: { label: "遅咲き", desc: "28歳以降の練習効果+15%", category: "成長" },
  // v28: 若い頃の伸びが良い（マイライフの25歳以下で練習・出走経験+15%）
  genius_sp:   { label: "天才肌", desc: "25歳以下の練習・出走経験の伸びが+15%", category: "成長" },
  lazy_sp:     { label: "練習嫌い", desc: "練習効果-20%", category: "成長", bad: true },
  // v31.2: 配合限定特能（breedOnly）。通常のスカウト・後天習得では絶対に出現せず、
  // 特定条件の配合でしか手に入らない血統の証。TraitLineでは金色枠で表示する
  sireline:    { label: "系統の申し子", desc: "全区間で能力+3（配合限定）", category: "配合限定", breedOnly: true },
  hybrid:      { label: "二刀流", desc: "丘陵・山岳・スプリント区間で能力+5（配合限定）", category: "配合限定", breedOnly: true },
  dynasty:     { label: "覇道の血脈", desc: "全能力+2・スタミナ+3（配合限定）", category: "配合限定", breedOnly: true },
};

export const PERSONALITIES = {
  normal:   { label: "普通", desc: "クセなし", mul: {} },
  genius:   { label: "天才", desc: "全能力が伸びやすい", mul: { flat: 1.25, climb: 1.25, sprint: 1.25, stamina: 1.25, solo: 1.25 } },
  hotblood: { label: "熱血", desc: "ｽﾌﾟﾘﾝﾄ↑ 登坂↓", mul: { sprint: 1.4, climb: 0.7 } },
  seeker:   { label: "求道者", desc: "登坂↑ ｽﾌﾟﾘﾝﾄ↓", mul: { climb: 1.4, sprint: 0.7 } },
  artisan:  { label: "職人", desc: "ｽﾀﾐﾅ↑ 独走↑ ｽﾌﾟﾘﾝﾄ↓", mul: { stamina: 1.35, solo: 1.15, sprint: 0.85 } },
  free:     { label: "自由人", desc: "独走↑ ｽﾀﾐﾅ↓", mul: { solo: 1.4, stamina: 0.7 } },
  smart:    { label: "秀才", desc: "平坦↑ 登坂↓", mul: { flat: 1.3, climb: 0.9 } },
};

export const COND_ARROW = ["↓↓", "↘", "→", "↗", "↑↑"];

export const COND_COLOR = ["#7a8296", "#8fa0b8", "#9aa3b5", "#7dd0a0", "#35c07e"];

export const COND_FC_ARROW = ["↘", "→", "↗"];

export const COND_FC_COLOR = ["#8fa0b8", "#9aa3b5", "#7dd0a0"];

export const COND_FC_LABEL = ["下降ぎみ", "安定", "上向き"];
