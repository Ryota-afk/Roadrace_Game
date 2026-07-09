import React, { useState, useRef, useEffect, useMemo } from "react";

/* =========================================================
   ロードレース・プロチーム運営 v12
   v11からの変更（詳細は roadrace_design_v12.md 参照）：
   ・レース中の無線指示（追走強化/静観/エース早期発射）を廃止し、出走前に
     「作戦」として1つだけ選ぶ形式に変更。観戦画面はカメラ操作のみの純粋な観戦専用に
   ・ローテーション演出をシミュレーション内部の交代タイミングから切り離し、
     実時間の固定サイクルで滑らかに周回させる方式に変更
   ・俯瞰マップを1次元的なレーン表示から、実際の隊列力学（団子状/縦一列/エシュロン）に
     基づく2次元の楕円軌道モデルに刷新。道路の描画幅も拡張
   ・天候・横風エシュロン（集団分裂の実際の促進＋斜め隊列の視覚表現）を追加
   ・AIチームに隠しの戦略スタイル（積極/バランス/保守）を持たせ、レース展開にばらつきを追加
   ・最終直線を暗転→専用カメラの高完成度2Dシネマティック演出に変更
   v10→v11の変更点は旧ヘッダー参照：
   ・集団ゴール時のスプリント決着処理を追加。同一ティックでゴールした選手を
     フィニッシュクラスタとして検出し、スプリント能力＋乱数で現実的な微小タイム差を付与
     （「TOP」表示が集団内で乱発する問題への対処。ティック本体・観戦アニメーションは無変更）
   ・千切れ選手の遅れ過大バグを修正（energyPenaltyMul下限0.35→0.55、
     MAX_TICKS到達時の外挿式の分母に安全下限、レース全体のソフトキャップ+35%）
   ・OVR計算式は現状維持のまま、種目別複合適性スコア（平坦・山岳・スプリント・独走・丘陵）を
     新設し編成画面・選手詳細に表示
   ・新規「ヘルプ」タブ：役割の得意/弱点表、能力値のクラス別ベンチマーク、難易度・スコアリングの目安
   ・セーブ/ロード機能を追加（localStorage自動保存＋手動セーブ/ロード/最初から）
   v8→v9の変更点は旧ヘッダー参照：3D観戦廃止・2Dマップ化、出走人数の可変化、成長速度の鈍化
========================================================= */

// ---------- デザイントークン ----------
const C = {
  bg: "#14171d", panel: "#1e232e", panel2: "#262c3a", line: "#3a4356",
  text: "#f0efe9", sub: "#9aa3b5",
  yellow: "#ffd23f", green: "#35c07e", red: "#e8544f", blue: "#4f8fe8", purple: "#c98bf0",
};
const FONT_D = "'Avenir Next Condensed','Arial Narrow','Noto Sans JP',sans-serif";
const FONT_B = "'Hiragino Sans','Noto Sans JP','Meiryo',sans-serif";
const FONT_M = "ui-monospace,'SF Mono',Menlo,monospace";

// ---------- 基本定義 ----------
const TYPES = {
  SPR: { label: "スプリンター", color: C.green, affinity: { sprint: 5 } },
  CLM: { label: "クライマー", color: C.red, affinity: { climb: 5, mtn: 5 } },
  RUL: { label: "ルーラー", color: C.blue, affinity: { flat: 4 } },
  PUN: { label: "パンチャー", color: C.purple, affinity: { hill: 5 } },
  TT:  { label: "独走屋(TT)", color: "#e8a13c", affinity: { tt: 6 } },
};
// 役割適性（合わないと roleMismatchPenalty）
const TYPE_ROLE_FIT = {
  mountain: ["CLM", "PUN"],
  flat: ["SPR", "RUL"],
};
const AB_KEYS = ["flat", "climb", "sprint", "stamina", "solo"];
const AB_LABEL = { flat: "平坦", climb: "登坂", sprint: "ｽﾌﾟﾘﾝﾄ", stamina: "ｽﾀﾐﾅ", solo: "独走" };
const AB_COLOR = { flat: C.blue, climb: C.red, sprint: C.green, stamina: "#c9a13c", solo: C.purple };

const GROWTH = {
  early: { label: "早熟", peak: [21, 25] },
  normal: { label: "普通", peak: [24, 29] },
  late: { label: "晩成", peak: [28, 33] },
};
const POW = {
  S: { mul: 1.6, color: "#ffd23f" }, A: { mul: 1.3, color: "#35c07e" },
  B: { mul: 1.0, color: "#4f8fe8" }, C: { mul: 0.7, color: "#9aa3b5" },
};
const TRAITS = {
  big:        { label: "大舞台に強い", desc: "★3レースで全能力+6%" },
  escape:     { label: "逃げ屋", desc: "逃げ集団での貢献度1.5倍" },
  mount:      { label: "山の申し子", desc: "登坂系区間で能力+4" },
  iron:       { label: "鉄人", desc: "出走疲労 +45→+32" },
  recover:    { label: "回復力", desc: "毎月さらに疲労-15" },
  closer:     { label: "勝負師", desc: "最終区間で能力+5%" },
  domestique: { label: "献身のアシスト", desc: "エースの牽引・レッドアウト時の効果+30%" },
  trainer:    { label: "練習の虫", desc: "練習効果+20%" },
  tough:      { label: "頑丈", desc: "怪我の発生率が半分（3連闘は防げない）" },
  glass:      { label: "ガラスの体", desc: "怪我の発生率2倍・離脱期間+1ヶ月", bad: true },
  moody:      { label: "ムラっ気", desc: "調子の変動が激しい", bad: true },
};
const PERSONALITIES = {
  normal:   { label: "普通", desc: "クセなし", mul: {} },
  genius:   { label: "天才", desc: "全能力が伸びやすい", mul: { flat: 1.25, climb: 1.25, sprint: 1.25, stamina: 1.25, solo: 1.25 } },
  hotblood: { label: "熱血", desc: "ｽﾌﾟﾘﾝﾄ↑ 登坂↓", mul: { sprint: 1.4, climb: 0.7 } },
  seeker:   { label: "求道者", desc: "登坂↑ ｽﾌﾟﾘﾝﾄ↓", mul: { climb: 1.4, sprint: 0.7 } },
  artisan:  { label: "職人", desc: "ｽﾀﾐﾅ↑ 独走↑ ｽﾌﾟﾘﾝﾄ↓", mul: { stamina: 1.35, solo: 1.15, sprint: 0.85 } },
  free:     { label: "自由人", desc: "独走↑ ｽﾀﾐﾅ↓", mul: { solo: 1.4, stamina: 0.7 } },
  smart:    { label: "秀才", desc: "平坦↑ 登坂↓", mul: { flat: 1.3, climb: 0.9 } },
};
const persMul = (r, k) => (PERSONALITIES[r.personality]?.mul[k]) || 1;
// v8: 収束・インフレ対策でソフトキャップを強化（90→88から発動、減衰も急に）
// v13: 難易度ごとの成長上限（DIFFICULTIES.growthCap）をしきい値として渡せるように変更。
// 呼び出し側が省略した場合は既存バランス通り88のまま
const softFactor = (v, cap = 88) => (v < cap ? 1 : Math.exp(-(v - cap) / 4));
const addAb = (r, k, amount, cap) => { r[k] = r[k] + amount * softFactor(r[k], cap); };
const COND_ARROW = ["↓↓", "↘", "→", "↗", "↑↑"];
const COND_COLOR = ["#7a8296", "#8fa0b8", "#9aa3b5", "#7dd0a0", "#35c07e"];
const condMul = (c) => [0.92, 0.96, 1.0, 1.04, 1.08][c - 1];

const CLASSES = [
  { id: "B1", label: "クラス B1", prizeMul: 1.0, need: 45, scout: 58 },
  { id: "A",  label: "クラス A",  prizeMul: 2.0, need: 50, scout: 66 },
  { id: "PRO", label: "PRO", prizeMul: 3.5, need: 60, scout: 74 },
];
// v13: 周回プレイ（クリアポイント）＋難易度テーマ。難易度は他チームの強さ（aiMul）と
// 選手成長のソフトキャップ閾値（growthCap、softFactorのしきい値）に反映する。
// needCPは「これまでの生涯獲得クリアポイント合計」で解禁するため、後でポイントを
// 使い切っても一度解禁した難易度が再ロックされることはない。
// v13.1: フィードバックを受け、難易度間の差をより大きく。成長上限は難易度が上がるほど
// 「インフレ」して選手も強くなる代わりに、他チームはそれ以上のペースで強くなる設計に変更
const DIFFICULTIES = [
  { id: "easy", label: "イージー", desc: "他チームはかなり控えめ。まずはここでクリアを目指そう", aiMul: 0.80, growthCap: 88, needCP: 0 },
  { id: "normal", label: "ノーマル", desc: "標準的な強さ。歯応えのある本来のバランス", aiMul: 1.0, growthCap: 94, needCP: 4 },
  { id: "hard", label: "ハード", desc: "他チームは強豪揃い。選手の成長上限も上がるが、相手はさらに本気を出してくる", aiMul: 1.25, growthCap: 102, needCP: 10 },
  { id: "oni", label: "鬼", desc: "完全な無理ゲー。成長上限は大幅に上がるが、他チームは化け物揃い。生半可な覚悟でクリアできると思うな", aiMul: 1.55, growthCap: 112, needCP: 20 },
];
// v13.2: 消費型の特典は「だんだん強くなる実感」が薄いというフィードバックを受け、
// 累積型（一度到達した閾値の特典は以後ずっと有効・使っても減らない）に作り直した。
// 難易度解禁と同じ「生涯獲得クリアポイント合計」で判定するため、しきい値を超えた
// ボーナスは重ね掛けで全て自動適用される（都度の選択・消費は発生しない）
const bumpRosterAbAll = (state, amount) => ({
  ...state,
  roster: state.roster.map(r => ({ ...r, ...Object.fromEntries(AB_KEYS.map(k => [k, Math.min(94, Math.round(r[k] + amount))])) })),
});
const bumpEquipLv = (state, amount) => ({
  ...state,
  // B1スタート時点のequipMax（3+classIdx=3+0）を超えないよう安全のためクランプ
  equip: { ...state.equip, frame: Math.min(3, state.equip.frame + amount), wheels: Math.min(3, state.equip.wheels + amount) },
});
const addProdigyRookie = (state) => {
  const rng = mulberry(Date.now() % 999983 + state.roster.length * 7919);
  const banned = new Set(state.roster.map(r => r.name));
  const rookie = newRider(70, rng, { banned, forceProdigy: true });
  return { ...state, roster: [...state.roster, rookie] };
};
// v13.3: 内容が弱いというフィードバックを受け、ラダーの間隔を広げて本数を増やし、
// キリのいい数字（10/25/50/75/100pt）に大幅強化の「ジャックポット」を配置。
// 間の半端な数字（5/15/35/65/90pt）には控えめな中間ボーナスを挟み、
// 周回を重ねるほど明確に強くなっていく実感を出す
const CP_MILESTONES = [
  { cp: 5, label: "開幕資金 +100万円", desc: "初期資金+100万円", apply: s => ({ ...s, budget: s.budget + 100 }) },
  { cp: 10, label: "★ 初期選手 全員能力+8", desc: "初期ロースター全員の能力値+8してスタート（大幅強化）", apply: s => bumpRosterAbAll(s, 8) },
  { cp: 15, label: "チーム設備 Lv1底上げ", desc: "フレーム・ホイールの強化レベルが+1された状態でスタート", apply: s => bumpEquipLv(s, 1) },
  { cp: 25, label: "★ 開幕資金 +400万円", desc: "初期資金にさらに+400万円（大幅強化）", apply: s => ({ ...s, budget: s.budget + 400 }) },
  { cp: 35, label: "開幕アイテム一式", desc: "決戦ホイール・エアロスーツ・リカバリーサプリ・コンディション調律を各2個ずつ所持", apply: s => ({ ...s, inv: { ...s.inv, wheel: s.inv.wheel + 2, suit: s.inv.suit + 2, supp: s.inv.supp + 2, tune: s.inv.tune + 2 } }) },
  { cp: 50, label: "★★ 逸材新人を1名確保", desc: "成長ランクS確定の逸材が1名、追加でロースターに加入（大幅強化）", apply: s => addProdigyRookie(s) },
  { cp: 65, label: "初期選手 全員能力+5", desc: "初期ロースター全員の能力値がさらに+5", apply: s => bumpRosterAbAll(s, 5) },
  { cp: 75, label: "★★ チーム設備 Lv2底上げ", desc: "フレーム・ホイールの強化レベルがさらに+2（大幅強化）", apply: s => bumpEquipLv(s, 2) },
  { cp: 90, label: "開幕資金 +300万円", desc: "初期資金にさらに+300万円", apply: s => ({ ...s, budget: s.budget + 300 }) },
  { cp: 100, label: "★★★ 逸材新人をもう1名確保＋全員能力+10", desc: "成長ランクS確定の逸材がもう1名加入し、ロースター全員の能力値も+10（集大成）", apply: s => bumpRosterAbAll(addProdigyRookie(s), 10) },
];
function applyCpMilestones(state, totalEarnedCP) {
  return CP_MILESTONES.filter(m => totalEarnedCP >= m.cp).reduce((s, m) => m.apply(s), state);
}
// v13: 周回ボーナス。速くクリアするほど、難易度が高いほどクリアポイントが増える
function computeClearPoints(year, difficultyId) {
  const speedBonus = Math.max(0, 15 - Math.max(0, year - 2) * 2);
  const diffBonus = { easy: 0, normal: 4, hard: 10, oni: 22 }[difficultyId] || 0;
  return 5 + speedBonus + diffBonus;
}
// v13.2: 特典が消費式ではなくなったため、保持する値は「生涯獲得クリアポイント合計」の
// 1つだけになった（難易度解禁・永続ボーナスのどちらもこの値だけで判定する）
const META_KEY = "roadrace_v12_meta";
function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { totalEarnedCP: 0 };
    const m = JSON.parse(raw);
    return { totalEarnedCP: m.totalEarnedCP || 0 };
  } catch (e) { return { totalEarnedCP: 0 }; }
}
function saveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* noop */ }
}
const MONTHS = ["4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"];
const RELEGATE_LINE = 15;
// v8: クラス連動の恩恵（ロースター上限・スカウト人数・逸材確率）
const ROSTER_MAX_BY_CLASS = [12, 14, 16];
const SCOUT_COUNT_BY_CLASS = [5, 7, 9];
const PRODIGY_CHANCE_BY_CLASS = [0.28, 0.38, 0.5];
const UPKEEP_PER_RIDER = 3; // 選手1名あたりの月次維持費（万円）

// ---------- v7: 役割（5種・エースは別枠のisAceフラグ） ----------
const ROLES = {
  lead:      { label: "第一アシスト", desc: "エースを最後まで牽引" },
  sub:       { label: "第二アシスト", desc: "第一アシストを支援。脚がなくなると離脱" },
  mountain:  { label: "山岳アシスト", desc: "山岳まで脚を温存し、山岳区間でエースを牽引" },
  flat:      { label: "平坦アシスト", desc: "平坦・丘陵のみ牽引。山岳では牽引せず自然消滅的に遅れる" },
  breakaway: { label: "逃げ要員", desc: "序盤に飛び出し逃げ集団を形成。ローテーションで牽引し合う" },
};
// v12: 無線指示（レース中の操作）を廃止し、出走前に選ぶ「作戦」に統合。
// normal/push/holdは排他の1択、ace_earlyは独立したON/OFFトグル
const CHASE_MODES = {
  normal:    { label: "通常", desc: "標準的なローテーションペースで走る" },
  push:      { label: "追走強化", desc: "牽引役のローテーション頻度を上げてペースを上げる（脚の消耗が早まる）" },
  hold:      { label: "静観", desc: "牽引役の脚を温存し、ギャップの拡大を許容する" },
  ace_early: { label: "エース早期発射", desc: "エースが単独アタック。エネルギー切れで大失速のリスクあり（1回限り）" },
};

// v9: 出走人数を固定値からsquadMin〜squadMaxの幅に変更（編成画面で選択）
const TEMPLATES = [
  { kind: "クリテリウム", favors: "SPR", squadMin: 1, squadMax: 5, laps: 6, segs: [["flat", 300, 18], ["flat", 260, 15], ["sprint", 90, 4]] },
  { kind: "サーキットレース", favors: "SPR", squadMin: 1, squadMax: 5, laps: 4, segs: [["flat", 380, 20], ["hill", 260, 12], ["flat", 320, 16], ["sprint", 110, 4]] },
  { kind: "丘陵ロード", favors: "PUN", squadMin: 1, squadMax: 5, segs: [["flat", 480, 26], ["hill", 450, 17], ["hill", 450, 17], ["sprint", 130, 4]] },
  { kind: "山岳ロード", favors: "CLM", squadMin: 1, squadMax: 5, segs: [["flat", 460, 26], ["climb", 600, 13], ["climb", 640, 12], ["mtn", 190, 4]] },
  { kind: "ヒルクライム", favors: "CLM", squadMin: 1, squadMax: 5, segs: [["climb", 560, 14], ["climb", 600, 12], ["mtn", 190, 4]] },
  { kind: "個人TT", favors: "TT", squadMin: 1, squadMax: 1, segs: [["tt", 520, 22], ["tt", 520, 22]] },
];
function groupModeFor(squadN) {
  if (squadN === 1) return "solo";
  if (squadN === 2) return "pelotonOnly";
  return "full";
}
const VENUES = ["房総", "飛騨", "阿蘇", "蔵王", "琵琶湖", "瀬戸内", "津軽", "日光", "富士", "美濃", "丹波", "石鎚"];
// v13: グランツール・海外遠征テーマ用の海外venue名（VENUESとは別枠で使用）
const OVERSEAS_VENUES = ["アルプス", "ピレネー", "ドロミテ", "フランドル", "ロンバルディア", "アンダルシア", "トスカーナ", "プロヴァンス"];
// v14.8: グランツールを年3戦（春・夏・秋）に増設。PROクラスのグランファイナル出場には
// この3戦すべての総合優勝（全制覇）が必要になる。コース性格も戦ごとに変えて個性を出す
const GRAND_TOURS = [
  { month: 1, season: "春季", stageTmpls: [TEMPLATES[0], TEMPLATES[1], TEMPLATES[2]] },
  { month: 3, season: "夏季", stageTmpls: [TEMPLATES[2], TEMPLATES[3], TEMPLATES[4]] },
  { month: 5, season: "秋季", stageTmpls: [TEMPLATES[3], TEMPLATES[4], TEMPLATES[1]] },
];
const SEG_LABEL = { flat: "平坦", hill: "丘陵", climb: "山岳", sprint: "ゴールスプリント", mtn: "山頂フィニッシュ", tt: "TT区間" };
const SEG_COLOR = { flat: C.blue, hill: C.purple, climb: C.red, sprint: C.green, mtn: C.red, tt: "#e8a13c" };
const SEG_AB = { flat: "flat", hill: "climb", climb: "climb", sprint: "sprint", mtn: "climb", tt: "solo" };

const ITEMS = {
  wheel: { label: "決戦用カーボンホイール", desc: "次の1レース：出走全員の登坂+15%", price: 30 },
  suit:  { label: "エアロワンピース", desc: "次の1レース：出走全員の平坦+15%", price: 30 },
  supp:  { label: "リカバリーサプリ", desc: "選手1名の疲労を40回復", price: 12 },
  tune:  { label: "コンディション調律", desc: "選手1名の調子を2段階アップ", price: 15 },
  camp:  { label: "トレーニングキャンプ券", desc: "今月の練習効果×2（チーム全体）", price: 25 },
};
const EQUIPS = {
  frame: { label: "エアロフレーム(チーム)", desc: "平坦 +6%/Lv（全員・恒常）" },
  wheels: { label: "軽量ホイール(チーム)", desc: "登坂 +6%/Lv（全員・恒常）" },
  facility: { label: "トレーニング設備", desc: "練習効果 +15%/Lv（恒常）" },
};
const EQUIP_COST = [40, 70, 110, 160, 220];
// v11: スタッフ雇用（equipの買い切りとは異なり、レベルに応じた月給制。
// クラスが上がるほど雇用できるレベル上限が増える）
const STAFF_ROLES = {
  manager: { label: "監督", desc: "スポンサー契約の条件が良くなる（月収UP・ノルマ緩和）" },
  trainer: { label: "トレーナー", desc: "練習の成長効果がアップする（恒常）" },
  doctor:  { label: "ドクター", desc: "故障の発生率が下がり、故障期間も短縮される" },
};
const STAFF_MAX_BY_CLASS = [0, 1, 3];
const STAFF_SALARY_PER_LV = 12; // 万円/月・レベル1つあたり（月給制、昇格なし＝買い切り費用は無し）
function staffSalaryTotal(staff) {
  if (!staff) return 0;
  return (Object.values(staff).reduce((a, b) => a + b, 0)) * STAFF_SALARY_PER_LV;
}

// v7: パーツスロットを4種に拡張
const PART_SLOTS = ["frame", "tire", "wheels", "nutrition"];
const SLOT_LABEL = { frame: "フレーム", tire: "タイヤ", wheels: "ホイール", nutrition: "補給食" };
const PARTS = {
  fr_sprint: { slot: "frame", tier: 1, label: "スプリントフレーム", ab: { sprint: 6 }, price: 28 },
  fr_aero:   { slot: "frame", tier: 1, label: "エアロロードフレーム", ab: { flat: 6 }, price: 28 },
  fr_light:  { slot: "frame", tier: 1, label: "超軽量クライムフレーム", ab: { climb: 6 }, price: 28 },
  ti_endure: { slot: "tire", tier: 1, label: "耐久タイヤ", ab: { stamina: 6 }, price: 22 },
  ti_tt:     { slot: "tire", tier: 1, label: "TTタイヤ", ab: { solo: 6 }, price: 22 },
  ti_grip:   { slot: "tire", tier: 1, label: "グリップタイヤ", ab: { sprint: 3, climb: 3 }, price: 22 },
  wh_light:  { slot: "wheels", tier: 1, label: "軽量ホイール", ab: { climb: 5 }, price: 24 },
  wh_aero:   { slot: "wheels", tier: 1, label: "エアロホイール", ab: { flat: 5 }, price: 24 },
  nu_gel:    { slot: "nutrition", tier: 1, label: "エナジージェル", ab: { stamina: 5 }, price: 18 },
  nu_bar:    { slot: "nutrition", tier: 1, label: "リカバリーバー", ab: { solo: 3, stamina: 3 }, price: 18 },
  fr_sprint2:{ slot: "frame", tier: 2, label: "スプリントフレームPro", ab: { sprint: 10 }, price: 48 },
  fr_aero2:  { slot: "frame", tier: 2, label: "エアロフレームPro", ab: { flat: 10 }, price: 48 },
  fr_light2: { slot: "frame", tier: 2, label: "クライムフレームPro", ab: { climb: 10 }, price: 48 },
  ti_race:   { slot: "tire", tier: 2, label: "レーシングタイヤ", ab: { solo: 5, sprint: 5 }, price: 40 },
  wh_race:   { slot: "wheels", tier: 2, label: "レーシングホイール", ab: { flat: 5, climb: 5 }, price: 44 },
  nu_pro:    { slot: "nutrition", tier: 2, label: "プロ仕様補給食", ab: { stamina: 8 }, price: 36 },
  fr_ult:    { slot: "frame", tier: 3, label: "モノコックUltimate", ab: { flat: 4, climb: 4, sprint: 4, stamina: 4, solo: 4 }, price: 90 },
  ti_ult:    { slot: "tire", tier: 3, label: "プロトタイヤUltimate", ab: { stamina: 8, solo: 8 }, price: 70 },
  wh_ult:    { slot: "wheels", tier: 3, label: "エアロクライムUltimate", ab: { flat: 6, climb: 6 }, price: 80 },
  nu_ult:    { slot: "nutrition", tier: 3, label: "アルティメット補給食", ab: { stamina: 10, solo: 5 }, price: 60 },
};

const SPONSOR_NAMES = ["アオゾラ銀行", "ハヤテ運輸", "ヤマセミ食品", "クレセント自転車", "ソラマメ製菓", "ツバキ石油", "ミナモ製薬", "カワセミ電工"];

const SCOUT_POLICIES = {
  balance: { label: "おまかせ", desc: "バランス型の候補" },
  sprint:  { label: "スプリント重視", desc: "スプリンター系が集まる" },
  climb:   { label: "登坂力重視", desc: "クライマー系が集まる" },
  future:  { label: "将来性重視", desc: "若く成長力の高い原石" },
  now:     { label: "即戦力重視", desc: "完成度の高い中堅" },
};

const PRIZES = [100, 60, 40, 30, 22, 16, 12, 9, 6, 4];
const PTS = [10, 7, 5, 3, 3, 1, 1, 1, 1, 1];
const GRADE_MUL = { 1: 1, 2: 1.5, 3: 2 };

// ---------- v8: 選択肢付きランダムイベント（栄冠ナイン風の月間フレーバー） ----------
const EVENT_CHANCE = 0.35;
const EFFECT_APPLIERS = {
  budget: (s, v) => ({ ...s, budget: s.budget + v }),
  rosterFatigueAll: (s, v) => ({ ...s, roster: s.roster.map(r => ({ ...r, fatigue: Math.max(0, Math.min(100, r.fatigue + v)) })) }),
  rosterCondAll: (s, v) => ({ ...s, roster: s.roster.map(r => ({ ...r, cond: Math.max(1, Math.min(5, r.cond + v)) })) }),
  campGrant: (s, v) => ({ ...s, inv: { ...s.inv, camp: s.inv.camp + v } }),
  pointsDelta: (s, v) => ({ ...s, points: Math.max(0, s.points + v) }),
  injuryReduceRandom: (s, v) => {
    const injured = s.roster.filter(r => r.injury > 0);
    if (!injured.length) return s;
    const pick = injured[Math.floor(Math.random() * injured.length)];
    return { ...s, roster: s.roster.map(r => r.id === pick.id ? { ...r, injury: Math.max(0, r.injury + v) } : r) };
  },
  fatigueReduceRandom: (s, v) => {
    if (!s.roster.length) return s;
    const pick = s.roster[Math.floor(Math.random() * s.roster.length)];
    return { ...s, roster: s.roster.map(r => r.id === pick.id ? { ...r, fatigue: Math.max(0, Math.min(100, r.fatigue + v)) } : r) };
  },
  mandatesMissedReduce: (s, v) => {
    if (!s.sponsor) return s;
    return { ...s, sponsor: { ...s.sponsor, mandatesMissed: Math.max(0, s.sponsor.mandatesMissed + v) } };
  },
  // v12: イベントの種類を増やすにあたり追加した「個人」targetの効果。誰が対象になったか
  // プレイヤーに伝わるよう、__eventNoteに選手名入りの一言をしのばせておき、
  // resolveEvent側でchoice.resultの末尾に添える
  boostRandomRiderAbilities: (s, v) => {
    if (!s.roster.length) return s;
    const pick = s.roster[Math.floor(Math.random() * s.roster.length)];
    const roster = s.roster.map(r => r.id === pick.id
      ? { ...r, ...Object.fromEntries(AB_KEYS.map(k => [k, Math.max(22, Math.min(94, Math.round(r[k] + v)))])) }
      : r);
    return { ...s, roster, __eventNote: `📈 ${pick.name}の能力が一段伸びた！` };
  },
  condRandomRider: (s, v) => {
    if (!s.roster.length) return s;
    const pick = s.roster[Math.floor(Math.random() * s.roster.length)];
    const roster = s.roster.map(r => r.id === pick.id ? { ...r, cond: Math.max(1, Math.min(5, r.cond + v)) } : r);
    return { ...s, roster, __eventNote: v > 0 ? `😊 ${pick.name}のコンディションが上向いた。` : `😔 ${pick.name}のコンディションが優れない…` };
  },
  growthPowUpgradeRandom: (s, v) => {
    if (v <= 0 || !s.roster.length) return s;
    const order = ["C", "B", "A", "S"];
    const candidates = s.roster.filter(r => order.indexOf(r.growthPow) < order.length - 1);
    if (!candidates.length) return s;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const nextPow = order[order.indexOf(pick.growthPow) + 1];
    const roster = s.roster.map(r => r.id === pick.id ? { ...r, growthPow: nextPow } : r);
    return { ...s, roster, __eventNote: `🌟 ${pick.name}の成長力が「${nextPow}」に上がった！` };
  },
  // v12: 起きる確率自体をここに埋め込む（v=万一発生した場合の離脱月数）。選択肢の分岐は
  // 「安全に休む（発生しない）」か「無理をする（一定確率で発生）」かで表現する
  injuryRiskRandom: (s, v) => {
    if (Math.random() >= 0.4) return s;
    const healthy = s.roster.filter(r => r.injury === 0);
    if (!healthy.length) return s;
    const pick = healthy[Math.floor(Math.random() * healthy.length)];
    const roster = s.roster.map(r => r.id === pick.id ? { ...r, injury: v, fatigue: Math.min(100, r.fatigue + 20) } : r);
    return { ...s, roster, __eventNote: `🤕 ${pick.name}が無理がたたって故障してしまった…` };
  },
  wheelGrant: (s, v) => ({ ...s, inv: { ...s.inv, wheel: s.inv.wheel + v } }),
};
function applyEventEffects(s, effects) {
  let ns = s;
  Object.entries(effects || {}).forEach(([k, v]) => { if (EFFECT_APPLIERS[k]) ns = EFFECT_APPLIERS[k](ns, v); });
  return ns;
}
const EVENTS = [
  { id: "media", title: "地元メディアの密着取材", text: "地元テレビ局がチームへの密着取材を申し込んできた。",
    choices: [
      { label: "取材を受ける", result: "知名度が上がり、スポンサーへの印象も良くなった。ただし対応で少し疲れが出た。", effects: { budget: 25, rosterFatigueAll: 6 } },
      { label: "練習に集中する", result: "取材は断り、全員で練習に打ち込んだ。疲労が回復した。", effects: { rosterFatigueAll: -10 } },
    ] },
  { id: "rivalcamp", title: "ライバルチームから合同合宿の誘い", text: "他チームから合同合宿をしないかと誘いが来た。",
    choices: [
      { label: "参加する", result: "刺激になる合宿だった。キャンプ券を1枚もらえた。少し疲れが溜まった。", effects: { campGrant: 1, rosterFatigueAll: 8 } },
      { label: "自主トレを選ぶ", result: "自チームのペースで調整し、コンディションが上向いた。", effects: { rosterCondAll: 1 } },
    ] },
  { id: "sponsorvisit", title: "スポンサー重役の視察", text: "スポンサー企業の重役がチームの練習を視察に来た。",
    choices: [
      { label: "気合を入れて出迎える", result: "熱意が伝わり、ノルマ未達の心証が少し和らいだ。", effects: { mandatesMissedReduce: -1, rosterFatigueAll: 4 } },
      { label: "普段通り過ごす", result: "ありのままの姿勢が好感を持たれ、差し入れをもらった。", effects: { budget: 15 } },
    ] },
  { id: "familyvisit", title: "若手選手の家族が観戦に", text: "若手選手の家族が応援に駆けつけた。",
    choices: [
      { label: "激励会を開く", result: "チーム全体が温かい雰囲気に包まれた。", effects: { rosterCondAll: 1, budget: -10 } },
      { label: "本人に任せる", result: "リラックスできたのか、疲れがよく抜けた。", effects: { fatigueReduceRandom: -25 } },
    ] },
  { id: "bikeclinic", title: "地域の自転車教室に招待", text: "地元の自治体から子供向け自転車教室への協力を依頼された。",
    choices: [
      { label: "参加する", result: "地域との交流が評価され、謝礼をもらった。", effects: { budget: 20, rosterFatigueAll: 3 } },
      { label: "コース試走を優先する", result: "参加を見送り、じっくり体を休めた。", effects: { rosterFatigueAll: -8 } },
    ] },
  { id: "weather", title: "記録的な猛暑・寒波が到来", text: "今月は例年にない厳しい天候が続いている。",
    choices: [
      { label: "無理せず調整する", result: "疲労をしっかり抜くことを優先した。", effects: { rosterFatigueAll: -12 } },
      { label: "予定通り練習する", result: "厳しい環境を乗り越え、精神的に一回り成長した。", effects: { rosterCondAll: 1, rosterFatigueAll: 10 } },
    ] },
  { id: "omen", title: "「来年は大物が来る」というOBの占い", text: "OBの一人が「来年は掘り出し物が入ってくる」と言い出した。",
    choices: [
      { label: "お布施のつもりで奢る", result: "気持ちが軽くなった。", effects: { budget: -15, rosterCondAll: 1 } },
      { label: "気にせず過ごす", result: "特に何も起きなかったが、浮いた分は懐に。", effects: { budget: 10 } },
    ] },
  { id: "donation", title: "OB会からの寄付", text: "OB会から「頑張っているチームへ」と寄付の申し出があった。",
    choices: [
      { label: "ありがたく受け取る", result: "運営資金の足しになった。", effects: { budget: 40 } },
      { label: "設備投資に使ってほしいと伝える", result: "OB会の心遣いに選手たちも奮起した。", effects: { budget: 15, rosterCondAll: 1 } },
    ] },
  { id: "injuryluck", title: "故障中の選手が早期復帰を志願", text: "療養中の選手が「もう大丈夫」と早期復帰を申し出た。",
    choices: [
      { label: "本人の意志を尊重する", result: "気持ちの強さが功を奏し、復帰が早まった。", effects: { injuryReduceRandom: -1 } },
      { label: "医者の指示通り休ませる", result: "無理をさせなかったことで、チーム内に安心感が広がった。", effects: { rosterCondAll: 1 } },
    ] },
  { id: "rivalace", title: "ライバルチームのエースが練習試合を申し込む", text: "ライバルチームのエースから非公式の練習試合を持ちかけられた。",
    choices: [
      { label: "受けて立つ", result: "白熱した練習試合となり、良い経験値になった。", effects: { pointsDelta: 2, rosterFatigueAll: 8 } },
      { label: "今は見送る", result: "無理をせず、来るべき本番に備えた。", effects: { rosterFatigueAll: -5 } },
    ] },
  { id: "sns", title: "選手の一人がSNSで話題に", text: "所属選手の練習動画がSNSでちょっとした話題になった。",
    choices: [
      { label: "話題を後押しする", result: "注目度が上がり、スポンサー筋から反応があった。", effects: { budget: 18, rosterFatigueAll: 3 } },
      { label: "静かに見守る", result: "本人は普段通りのペースを保てた。", effects: { rosterCondAll: 1 } },
    ] },
  { id: "travel", title: "遠征中の交通トラブル", text: "遠征先で交通トラブルに巻き込まれ、日程がタイトになった。",
    choices: [
      { label: "予備日を使って調整する", result: "余裕を持って体を休めることができた。", effects: { rosterFatigueAll: -6 } },
      { label: "強行日程で乗り切る", result: "多少の疲労と引き換えに、日程通りの活動費が浮いた。", effects: { budget: 12, rosterFatigueAll: 12 } },
    ] },
  // v12: イベントの種類を増やしてほしいという要望を受けて追加（栄冠ナイン風の「覚醒」
  // 「スランプ」など、選手個人にフォーカスするイベントを中心に拡充）
  { id: "awakening", title: "練習中に選手が覚醒？", text: "いつもの練習中、ある選手が今までにない動きを見せた。手応えを感じているようだ。",
    choices: [
      { label: "そのままとことん追い込ませる", result: "本人の勢いに任せてとことん追い込んだ。", effects: { boostRandomRiderAbilities: 6, rosterFatigueAll: 5 } },
      { label: "無理はさせず切り上げる", result: "興奮を落ち着かせ、無理のない範囲で切り上げた。", effects: { boostRandomRiderAbilities: 3 } },
    ] },
  { id: "slump", title: "選手がスランプ気味に", text: "ある選手が、最近どうも本来の動きができていない様子だ。",
    choices: [
      { label: "とことん話を聞く", result: "じっくり話を聞き、気持ちの整理を手伝った。", effects: { condRandomRider: 1, rosterFatigueAll: -2 } },
      { label: "そっとしておく", result: "本人のペースに任せることにした。", effects: { condRandomRider: -1 } },
    ] },
  { id: "veteranAdvice", title: "伝説のOBがふらりと顔を出す", text: "かつて名を馳せたOBが練習場にふらりと立ち寄り、若手に直接指導してくれた。",
    choices: [
      { label: "指導を仰ぐ", result: "貴重な指導を受け、才能が開花する予感がする。", effects: { growthPowUpgradeRandom: 1, rosterFatigueAll: 4 } },
      { label: "自分たちのやり方を貫く", result: "ありがたい申し出だったが、今のチームの方針を貫いた。", effects: { rosterCondAll: 1 } },
    ] },
  { id: "injuryOmen", title: "きしむ体、無理はできない兆候", text: "練習量が積み重なり、選手の一人が体の張りを訴えている。",
    choices: [
      { label: "様子を見ながら続ける", result: "無理をさせず、負荷を落として乗り切った。", effects: { rosterFatigueAll: -10 } },
      { label: "気にせず追い込む", result: "本人の意志を尊重し、通常通りのメニューを続けた。", effects: { rosterFatigueAll: 6, injuryRiskRandom: 1 } },
    ] },
  { id: "teamConflict", title: "選手間でちょっとした衝突", text: "練習方針をめぐって、選手同士でちょっとした言い合いになった。",
    choices: [
      { label: "仲裁に入る", result: "話し合いの場を設け、わだかまりを解消した。", effects: { budget: -10, rosterCondAll: 1 } },
      { label: "本人たちに任せる", result: "干渉せず、当人同士の解決に委ねた。", effects: { rosterCondAll: -1 } },
    ] },
  { id: "wheelMonitor", title: "新型ホイールのモニター依頼", text: "用具メーカーから、開発中の新型ホイールを試してほしいと依頼が来た。",
    choices: [
      { label: "モニターを引き受ける", result: "試作品を受け取った。感触を確かめるのに少し時間を要した。", effects: { wheelGrant: 1, rosterFatigueAll: 3 } },
      { label: "今回は見送る", result: "丁重にお断りしたところ、御礼の品が届いた。", effects: { budget: 10 } },
    ] },
  { id: "teamBonding", title: "選手会主催の親睦会", text: "選手会が主催する食事会が開かれ、チームの雰囲気作りに一役買った。",
    choices: [
      { label: "参加して盛り上げる", result: "和やかな時間を過ごし、チームの結束が深まった。", effects: { rosterCondAll: 1, budget: -8 } },
      { label: "差し入れだけ済ませる", result: "顔は出さず、差し入れだけ届けておいた。", effects: { budget: -3 } },
    ] },
  { id: "hardCamp", title: "有志だけの追加合宿", text: "有志を募っての追加合宿の話が持ち上がった。",
    choices: [
      { label: "実施を後押しする", result: "気合の入った合宿になり、参加した選手たちの動きが良くなった。", effects: { boostRandomRiderAbilities: 4, rosterFatigueAll: 10 } },
      { label: "通常メニューに留める", result: "無理のない範囲での調整に留めた。", effects: { rosterFatigueAll: -5 } },
    ] },
];

// ---------- ユーティリティ ----------
function mulberry(seed) {
  let a = seed | 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// v12バグ修正: 名前のバリエーションが少なく被って見えるとの指摘を受け、大幅に語彙を増やした
// （180姓×100名＝18000通り）。前半は既存の演出寄りの姓、後半は実際によくある姓を追加し、
// 母集団を広げてかぶりにくくしている
const SURNAMES = [
  "相馬", "桐生", "白鳥", "早瀬", "神楽", "水城", "燕", "嵐山", "灰原", "東雲",
  "氷室", "真壁", "夏目", "御堂", "九条", "橘", "篝", "斑鳩", "黒崎", "鏡",
  "朝霧", "深月", "鷹羽", "竜崎", "天羽", "風間", "雪村", "藤堂", "綾小路", "一条",
  "二階堂", "銀河", "朔", "響", "澄川", "涼風", "月島", "星野", "千歳", "朝比奈",
  "西園寺", "北条", "高城", "結城", "雫石", "氷川", "風早", "花房", "星空", "銀水",
  "紅葉", "桜井", "藤崎", "藤宮", "神代", "天海", "蒼月", "蒼樹", "朝倉", "夕凪",
  "冬木", "秋月", "秋山", "五十嵐", "百瀬", "千葉", "常盤", "若宮", "大鷹", "小鳥遊",
  "南雲", "東條", "高杉", "高階", "桜小路", "藤枝", "天音", "夜久", "春日井", "夏川",
  "佐藤", "鈴木", "高橋", "田中", "渡辺", "伊藤", "山本", "中村", "小林", "加藤",
  "吉田", "山田", "佐々木", "山口", "松本", "井上", "木村", "林", "斎藤", "清水",
  "山崎", "森", "池田", "橋本", "阿部", "石川", "山下", "中島", "石井", "小川",
  "前田", "岡田", "長谷川", "藤田", "後藤", "近藤", "村上", "遠藤", "青木", "坂本",
  "福田", "太田", "西村", "藤井", "金子", "岡本", "松田", "中川", "中野", "原田",
  "小野", "田村", "竹内", "和田", "中山", "石田", "上田", "森田", "柴田", "酒井",
  "工藤", "横山", "宮崎", "宮本", "内田", "高木", "安藤", "島田", "谷口", "大野",
  "高田", "丸山", "今井", "河野", "藤原", "新井", "松井", "木下", "川口", "大塚",
  "小島", "田口", "平野", "菅原", "久保", "松岡", "野口", "中田", "大西", "竹田",
  "白石", "岩崎", "荒木", "鈴村", "三浦", "西田", "北村", "南田", "春日", "東野",
];
const GIVEN = [
  "蓮", "岳", "走", "迅", "颯", "翼", "剛", "凌", "駆", "峻",
  "隼", "湊", "遼", "陸", "翔", "樹", "匠", "輝", "悠", "陽",
  "光", "智", "誠", "健", "潤", "晴", "涼", "昴", "蒼", "弦",
  "燦", "耀", "煌", "皓", "昂", "漣", "澪", "渚", "洸", "汐",
  "雷", "焔", "陣", "塁", "魁", "羽", "律", "尊", "崚", "岬",
  "朝", "暁", "昇", "昌", "明", "央", "心", "淳", "敦", "慧",
  "碧", "凪", "宙", "龍", "天", "空", "海", "舜", "駿", "豪",
  "猛", "進", "学", "勉", "潔", "実", "修", "治", "仁", "卓",
  "巧", "拓", "創", "想", "志", "元", "直", "正", "賢", "聡",
  "亮", "諒", "爽", "快", "康", "保", "守", "護", "勝", "優",
];
let RID = 100;
// v7: OVRは上位加重（特化型を正しく評価）
function overall(r) {
  const vals = AB_KEYS.map(k => r[k]).sort((a, b) => b - a);
  return Math.round(vals[0] * 0.5 + vals[1] * 0.3 + (vals[2] + vals[3] + vals[4]) / 3 * 0.2);
}
// v13: 選手名鑑・殿堂入り演出用の二つ名・フレーバーテキスト生成。
// パワプロの選手名鑑／ウイニングポストの殿堂入りをイメージし、戦績（raceLog）を
// 優先しつつ、まだ実績のない選手には脚質・性格ベースの二つ名を割り当てる
// v13.2: 二つ名は無条件で全選手に付与せず、ある程度の実績（勝利・表彰台・出場数など）を
// 残した選手だけに与える。実績が無ければ二つ名なし（呼び出し側はnullを想定して表示を省く）
function hasEarnedNickname(r) {
  const log = r.raceLog || [];
  const wins = log.filter(e => e.rank === 1).length;
  const podiums = log.filter(e => e.rank <= 3).length;
  return wins >= 1 || podiums >= 2 || log.length >= 5 || !!r.prodigy;
}
function riderNickname(r) {
  if (!hasEarnedNickname(r)) return null;
  const log = r.raceLog || [];
  const wins = log.filter(e => e.rank === 1).length;
  const podiums = log.filter(e => e.rank <= 3).length;
  const races = log.length;
  if (wins >= 8) return "伝説の勝ち師";
  if (wins >= 5) return "常勝の帝王";
  if (wins >= 3) return "勝利の申し子";
  if (podiums >= 12) return "表彰台の主";
  if (podiums >= 6) return "表彰台の常連";
  if (races >= 12 && podiums === 0) return "苦労人";
  if (r.prodigy) return "将来を嘱望された逸材";
  const abs = { flat: r.flat, climb: r.climb, sprint: r.sprint, stamina: r.stamina, solo: r.solo };
  const top = Object.entries(abs).sort((a, b) => b[1] - a[1])[0][0];
  const byType = {
    flat: "巡航の職人", climb: "山岳の覇者", sprint: "ゴールハンター", stamina: "鉄の脚", solo: "独走の求道者",
  };
  return byType[top] || "無名の挑戦者";
}
// v13.3: 以前はフレーバーテキストが脚質・性格・特性をそのまま言い換えるだけで、
// ロースターカード上のバッジ／PersonaLine／TraitLineと内容が丸かぶりしていた。
// 実績があれば「特筆すべき1戦」を物語調に語るエピソード方式、まだ実績がなければ
// 能力値と無関係な人物エピソードを語る方式に差し替える。選手ID（＋該当レースの
// 年月・順位）を種にした決定論的選択のため、再レンダリングのたびに文言が変わらない
const FLAVOR_PERSONA = [
  "オフの日は決まって近所の定食屋に顔を出す、気さくな一面を持つ。",
  "移動中のバスや車内では誰よりも早く眠りに落ちるタイプ。",
  "自転車以外にも将棋を嗜み、盤面を読む集中力には定評がある。",
  "機材の整備は人任せにせず、隅々まで自分の手で行う几帳面な性格。",
  "地元の後輩たちからは兄貴分・姉御肌として慕われている。",
  "レース前は決まって同じルーティンで気持ちを整える。",
  "甘いものに目がなく、補給食のストックはいつも自前で用意している。",
  "寡黙だが、チームメイトの誕生日は必ず覚えている。",
  "オフシーズンは登山に出かけ、脚力よりも景色を楽しむ派。",
  "SNSでの発信はほとんどせず、黙々と練習に打ち込む職人肌。",
  "移動中の車内ではいつも同じプレイリストを聴いている。",
  "地元では意外にも人見知りとして知られている。",
  "インタビューでは飾らない本音がついつい出てしまう。",
  "雨の日のレースでも表情ひとつ変えない胆力の持ち主。",
  "練習後のストレッチには人一倍時間をかける。",
  "実は大の猫好きで、遠征先でも野良猫を見つけると必ず声をかける。",
  "料理が趣味で、遠征中も自炊にこだわっている。",
  "幼い頃からこの土地で育ち、地元愛は人一倍。",
  "几帳面な性格で、練習ノートを欠かさずつけている。",
  "案外な負けず嫌いで、練習の順位付けにも本気になる。",
  "チーム内のムードメーカーとして、重い空気を和ませる存在。",
  "高校時代は別競技をしていたが、この道に転向してきた変わり種。",
  "早起きが得意で、誰よりも早く練習に出てくる。",
  "実は方向音痴で、遠征先ではよく道に迷うと本人談。",
  "声援を受けると急に力が湧いてくるタイプ。",
  "自分の走りを分析するのが好きで、映像を何度も見返す。",
  "家族思いで、レースの合間にはよく実家に連絡を入れている。",
  "意外にも手先が器用で、機材の細かい調整も自分でこなす。",
  "普段は物静かだが、レースになると人が変わったように闘志を燃やす。",
  "新しい土地でのレースを何より楽しみにしている旅好き。",
];
// v14.6: エピソードのフレーバーに、そのレースで実際に担っていた役割
// （シーズンモードのROLES＋isAce、マイライフの監督指示）を織り込む一言を差し込む。
// raceLogにroleが記録されていない古いデータ（このアップデート以前のセーブ等）では
// 静かに空文字を返し、これまで通りの文面にフォールバックする
const ROLE_CLAUSE = {
  ace: "エースとして先頭に立ち、",
  lead: "第一アシストとして脚を使いながらも、",
  sub: "第二アシストの立場ながら、",
  mountain: "山岳アシストとして山を駆け上がりながら、",
  flat: "平坦アシストとして集団を牽引しながら、",
  breakaway: "逃げ要員として早々に飛び出し、",
  breakthrough: "自由な走りを許され、",
  support: "アシスト役に徹しながらも、",
  experience: "経験を積む一戦の中で、",
};
function roleClause(role) { return ROLE_CLAUSE[role] || ""; }
const FLAVOR_EPISODE_WIN = [
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で圧巻の逃げ切りを見せ、今も語り草になっている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}を制した走りは、本人いわく会心の一戦だったという。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}のゴールスプリントを制した瞬間はチーム内でも語り継がれている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で初優勝を飾って以来、勝負どころでの強さに定評がある。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で見せた独走勝利は、今も本人の自信の源になっている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で終盤の集団を突き放し、そのまま押し切った。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}制覇を境に、周囲の見る目が変わったという。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での勝利は本人にとって忘れられない一戦。`,
];
const FLAVOR_EPISODE_PODIUM = [
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で表彰台に上がり、確かな手応えをつかんだ。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では終盤まで優勝争いに加わり、僅差で表彰台に踏みとどまった。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での表彰台は本人にとって大きな自信になっている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で見せた粘りの走りが、表彰台という結果につながった。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}のラストで踏ん張り、表彰台をつかみ取った。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では、最後まで諦めない走りで表彰台に食い込んだ。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での好走は今もチーム内で話題に上る。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}、あと一歩及ばず優勝は逃したが、表彰台という結果を残した。`,
];
const FLAVOR_EPISODE_OTHER = [
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では先頭集団に食らいつき、力の片鱗を見せた。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では終盤まで粘り、確かな成長を感じさせた。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での走りは結果以上に評価されている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で見せた積極的な仕掛けは、今後への期待を抱かせた。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では苦しい展開ながらも最後まで足を止めなかった。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}を経て、レース勘を着実に磨いている最中だ。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での経験は今の走りの土台になっている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では悔しい結果に終わったが、その後の糧にしている。`,
];
// v14.7: 単発のレース結果だけでなく、raceLog全体の傾向（連勝・無敗・役割の変遷）から
// 選手の「人物像」を判断するアーキタイプ系フレーバー。単発エピソードより優先度を高くし、
// 無敗＞連勝中＞役割アーキタイプ＞通常のエピソード／人物像、の順で判定する
function raceLogWinStreak(log) {
  let streak = 0;
  for (let i = log.length - 1; i >= 0; i--) { if (log[i].rank === 1) streak++; else break; }
  return streak;
}
const ACE_TYPE_LABEL = {
  SPR: "エーススプリンター", CLM: "エースクライマー", RUL: "オールラウンドエース",
  PUN: "エースパンチャー", TT: "エースタイムトライアリスト",
};
// v14.6で追加したROLE_CLAUSEのキーのうち、実質「アシスト系」に分類できるものをまとめる
// （breakthroughは自由な個人色が強くどちらにも属さないため除外、breakawayは別枠で判定）
const ASSIST_ROLES = new Set(["lead", "sub", "mountain", "flat", "support", "experience"]);
const FLAVOR_UNDEFEATED = [
  n => `${n}戦${n}勝、デビュー以来まだ黒星がない完全無敗を貫いている。`,
  n => `無敗街道驀進中——${n}戦して一度も負けたことがない。`,
  n => `${n}戦全勝という圧倒的な戦績で、負けを知らない走りを続けている。`,
  n => `ここまで${n}戦無敗。誰にも負ける気がしないという自信がにじみ出ている。`,
];
const FLAVOR_STREAK = [
  n => `現在${n}連勝中。勢いに乗ったこの選手を止めるのは容易ではない。`,
  n => `直近${n}戦を勝ち続け、波に乗っている真っ最中だ。`,
  n => `${n}連勝と絶好調で、次のレースでも警戒される存在になっている。`,
  n => `破竹の${n}連勝中——誰もこの勢いに逆らえずにいる。`,
];
const FLAVOR_ACE_ARCHETYPE = [
  label => `幾多のレースでエースを任され続けた、チームの絶対的${label}。`,
  label => `迷わずエースの座を託される、押しも押されもせぬ${label}。`,
  label => `チームメイトの誰もが認める、揺るぎない${label}としての地位を築いている。`,
  label => `他の追随を許さぬ結果を積み重ね、名実ともにチームの${label}になった。`,
];
const FLAVOR_ASSIST_ARCHETYPE = [
  () => "己の勝利より仲間を活かす道を選び続けた、チーム随一の名アシスト。",
  () => "目立たぬ働きでエースを何度も勝たせてきた、縁の下の名アシスト。",
  () => "献身的な牽引でチームを支え続け、いぶし銀の名アシストと評されている。",
  () => "自らの結果より仲間のゴールを優先する、信頼厚い名アシスト。",
];
const FLAVOR_BREAKAWAY_ARCHETYPE = [
  () => "序盤から果敢に飛び出す走りを繰り返す、逃げのスペシャリスト。",
  () => "集団任せにせず自ら仕掛け続ける、逃げ屋としての矜持を持つ選手。",
  () => "番狂わせを演出する逃げの名手として、レースを何度も面白くしてきた。",
];
// v14.8: ステージレースは日ごとに役割を変更できるようになったため、そのレースの
// notable判定に使われた1件が「日ごとの内訳（stageBreakdown）」を持っていれば、
// 総合順位だけでなく「〇日目はエースで〇位」という日替わりの物語を優先して語る
const STAGE_DAY_ROLE_LABEL = {
  ace: "エース", lead: "第一アシスト", sub: "第二アシスト", mountain: "山岳アシスト", flat: "平坦アシスト", breakaway: "逃げ要員",
};
function stageDayPhrase(d) {
  const roleLabel = STAGE_DAY_ROLE_LABEL[d.role] || "アシスト";
  const rankLabel = d.rank === 1 ? "優勝" : `${d.rank}位`;
  return `${d.day}日目は${roleLabel}で${rankLabel}`;
}
function stageOverallPhrase(e) {
  return e.rank === 1 ? "見事総合優勝を飾った" : e.rank <= 3 ? `総合${e.rank}位で表彰台に上がった` : `総合${e.rank}位でフィニッシュした`;
}
const FLAVOR_STAGE_TEMPLATES = [
  e => `${e.year}年目${MONTHS[e.month]}の${e.name}では、${e.stageBreakdown.map(stageDayPhrase).join("、")}という走りを見せ、${stageOverallPhrase(e)}。`,
  e => `${e.year}年目${MONTHS[e.month]}、${e.name}を振り返ると——${e.stageBreakdown.map(stageDayPhrase).join("、")}。最終的には${stageOverallPhrase(e)}。`,
  e => `${e.year}年目${MONTHS[e.month]}の${e.name}、その道のりは${e.stageBreakdown.map(stageDayPhrase).join("、")}というものだった。結果は${stageOverallPhrase(e)}。`,
  e => `${e.year}年目${MONTHS[e.month]}、${e.name}では日替わりで役割を変えながら${e.stageBreakdown.map(stageDayPhrase).join("、")}。${stageOverallPhrase(e)}。`,
];
// v14.12: raceLogの傾向からさらに読み取れる6種のアーキタイプ・エピソードを追加。
// 「スランプ脱出」は直近の1戦だけでなく、その直前の不振期があってこそ成立する物語なので
// 単発エピソード（FLAVOR_EPISODE_*）より優先し、逆に得意コース・GT巧者・早熟／ベテラン・
// ムラ気質はキャリア全体の傾向を語るため、単発エピソードより優先するが役割アーキタイプよりは後にする
function raceLogSlumpBeforeLast(log) {
  if (log.length < 3) return 0;
  let n = 0;
  for (let i = log.length - 2; i >= 0; i--) { if (log[i].rank >= 5) n++; else break; }
  return n;
}
const FLAVOR_COMEBACK = [
  e => `一時は${roleClause(e.role)}不振に沈んだが、${e.year}年目${MONTHS[e.month]}の${e.name}で見事な復活を遂げた。`,
  e => `苦しい時期を乗り越え、${e.year}年目${MONTHS[e.month]}の${e.name}では${roleClause(e.role)}会心の走りでカムバックを果たした。`,
  e => `不調の連鎖を断ち切ったのが、${e.year}年目${MONTHS[e.month]}の${e.name}。${roleClause(e.role)}這い上がる走りで存在感を示した。`,
  e => `低迷期を経て、${e.year}年目${MONTHS[e.month]}の${e.name}で${roleClause(e.role)}見違えるような走りを取り戻した。`,
];
function findCourseSpecialty(log) {
  const groups = {};
  log.forEach(e => { (groups[e.name] = groups[e.name] || []).push(e); });
  let best = null;
  Object.keys(groups).forEach(name => {
    const arr = groups[name];
    if (arr.length >= 2 && arr.every(e => e.rank <= 3)) {
      if (!best || arr.length > best.arr.length) best = { name, arr };
    }
  });
  return best;
}
const FLAVOR_COURSE_SPECIALTY = [
  (name, n) => `${name}には${n}度出走して${n}度とも表彰台に上がっている、勝手知ったる得意のコース。`,
  (name, n) => `${name}となると俄然強さを増すタイプで、${n}戦${n}回とも表彰台を外していない。`,
  (name, n) => `${name}の道筋を知り尽くしているのか、${n}度の出走すべてで表彰台に食い込んでいる。`,
  (name, n) => `${name}との相性は抜群で、出走した${n}戦すべてで好結果を残している。`,
];
const FLAVOR_GT_SPECIALIST = [
  n => `グランツールとなるとひときわ輝きを増す選手で、これまで${n}度表彰台に上っている。`,
  n => `長丁場のグランツールを得意とし、${n}度の総合表彰台がその適性を物語っている。`,
  n => `グランツール巧者として知られ、通算${n}度の総合表彰台を築き上げてきた。`,
];
const FLAVOR_PRODIGY = [
  () => "若くしてすでに複数の勝利を手にしている、将来を嘱望される逸材。",
  () => "同年代を大きく引き離す結果を残し続ける、早熟の才能の持ち主。",
  () => "デビューから間もないながら勝ち方を知っている、期待の若手。",
];
const FLAVOR_VETERAN = [
  () => "ベテランと呼ばれる年齢になってもなお、第一線で結果を残し続けている。",
  () => "年齢を感じさせない走りで、若手相手にも一歩も引かない意地を見せる。",
  () => "長いキャリアを積みながら衰えを知らず、今も好走を重ねている。",
];
const FLAVOR_MURA = [
  () => "絶好調かと思えば急失速もある、振れ幅の大きさが持ち味の選手。",
  () => "波に乗ればどこまでも強いが、崩れる時は大きく崩れる読めないタイプ。",
  () => "会心の走りと不本意な結果が同居する、良くも悪くもムラのある選手。",
];
function riderFlavorText(r) {
  const log = r.raceLog || [];
  if (log.length >= 3 && log.every(e => e.rank === 1)) {
    const idx = Math.floor(mulberry((r.id || 0) * 211 + log.length)() * FLAVOR_UNDEFEATED.length);
    return FLAVOR_UNDEFEATED[idx](log.length);
  }
  const streak = raceLogWinStreak(log);
  if (streak >= 3) {
    const idx = Math.floor(mulberry((r.id || 0) * 311 + streak)() * FLAVOR_STREAK.length);
    return FLAVOR_STREAK[idx](streak);
  }
  const last = log[log.length - 1];
  const slump = raceLogSlumpBeforeLast(log);
  if (last && last.rank <= 3 && slump >= 2) {
    const idx = Math.floor(mulberry((r.id || 0) * 823 + slump)() * FLAVOR_COMEBACK.length);
    return FLAVOR_COMEBACK[idx](last);
  }
  const roled = log.filter(e => e.role);
  if (log.length >= 5 && roled.length / log.length >= 0.6) {
    const aceCount = roled.filter(e => e.role === "ace").length;
    const assistCount = roled.filter(e => ASSIST_ROLES.has(e.role)).length;
    const breakawayCount = roled.filter(e => e.role === "breakaway").length;
    const wins = log.filter(e => e.rank === 1).length;
    if (aceCount / roled.length >= 0.7 && wins >= 2) {
      const label = ACE_TYPE_LABEL[r.type] || "絶対的エース";
      const idx = Math.floor(mulberry((r.id || 0) * 419 + aceCount)() * FLAVOR_ACE_ARCHETYPE.length);
      return FLAVOR_ACE_ARCHETYPE[idx](label);
    }
    if (assistCount / roled.length >= 0.7) {
      const idx = Math.floor(mulberry((r.id || 0) * 523 + assistCount)() * FLAVOR_ASSIST_ARCHETYPE.length);
      return FLAVOR_ASSIST_ARCHETYPE[idx]();
    }
    if (breakawayCount / roled.length >= 0.5) {
      const idx = Math.floor(mulberry((r.id || 0) * 617 + breakawayCount)() * FLAVOR_BREAKAWAY_ARCHETYPE.length);
      return FLAVOR_BREAKAWAY_ARCHETYPE[idx]();
    }
  }
  const spec = findCourseSpecialty(log);
  if (spec) {
    const idx = Math.floor(mulberry((r.id || 0) * 929 + spec.arr.length)() * FLAVOR_COURSE_SPECIALTY.length);
    return FLAVOR_COURSE_SPECIALTY[idx](spec.name, spec.arr.length);
  }
  const gtPodiums = log.filter(e => e.name.includes("グランツール") && e.rank <= 3).length;
  if (gtPodiums >= 2) {
    const idx = Math.floor(mulberry((r.id || 0) * 1031 + gtPodiums)() * FLAVOR_GT_SPECIALIST.length);
    return FLAVOR_GT_SPECIALIST[idx](gtPodiums);
  }
  const totalWins = log.filter(e => e.rank === 1).length;
  if (r.age <= 22 && totalWins >= 2) {
    const idx = Math.floor(mulberry((r.id || 0) * 1129 + totalWins)() * FLAVOR_PRODIGY.length);
    return FLAVOR_PRODIGY[idx]();
  }
  if (r.age >= 32 && log.length >= 5 && log.slice(-3).some(e => e.rank <= 3)) {
    const idx = Math.floor(mulberry((r.id || 0) * 1237 + r.age)() * FLAVOR_VETERAN.length);
    return FLAVOR_VETERAN[idx]();
  }
  if (log.length >= 5) {
    const bestRank = Math.min(...log.map(e => e.rank));
    const worstRank = Math.max(...log.map(e => e.rank));
    if (bestRank <= 3 && worstRank - bestRank >= 6) {
      const idx = Math.floor(mulberry((r.id || 0) * 1327 + worstRank)() * FLAVOR_MURA.length);
      return FLAVOR_MURA[idx]();
    }
  }
  let notable = null;
  log.forEach(e => {
    if (!notable || e.rank < notable.rank || (e.rank === notable.rank && (e.year > notable.year || (e.year === notable.year && e.month > notable.month)))) notable = e;
  });
  if (notable) {
    if (notable.stageBreakdown && notable.stageBreakdown.length) {
      const idx = Math.floor(mulberry((r.id || 0) * 719 + notable.year * 13 + notable.month)() * FLAVOR_STAGE_TEMPLATES.length);
      return FLAVOR_STAGE_TEMPLATES[idx](notable);
    }
    const pool = notable.rank === 1 ? FLAVOR_EPISODE_WIN : notable.rank <= 3 ? FLAVOR_EPISODE_PODIUM : FLAVOR_EPISODE_OTHER;
    const idx = Math.floor(mulberry((r.id || 0) * 131 + notable.year * 37 + notable.month * 11 + notable.rank * 5)() * pool.length);
    return pool[idx](notable);
  }
  const idx = Math.floor(mulberry((r.id || 0) * 977 + 3)() * FLAVOR_PERSONA.length);
  return FLAVOR_PERSONA[idx];
}
// v13.2: 殿堂入り選手専用の「軌跡」テキスト。riderFlavorText（脚質・性格などの固定プロフィール）
// とは別枠で、raceLogや離脱理由から実際のキャリアの歩みを物語調に組み立てる
function riderCareerSummary(r) {
  const log = r.raceLog || [];
  const wins = log.filter(e => e.rank === 1).length;
  const podiums = log.filter(e => e.rank <= 3).length;
  const races = log.length;
  const firstYear = races > 0 ? Math.min(...log.map(e => e.year)) : null;
  const lastYear = r.farewellYear;
  const spanText = firstYear != null && lastYear != null
    ? `${firstYear}年目から${lastYear}年目までの${Math.max(1, lastYear - firstYear + 1)}年間、`
    : "";
  const originText = r.prodigy ? "鳴り物入りの逸材として加入し、" : "";
  let recordText;
  if (races === 0) recordText = "出走機会には恵まれなかったが、";
  else if (wins > 0) recordText = `通算${races}戦${wins}勝・表彰台${podiums}回という実績を残し、`;
  else if (podiums > 0) recordText = `通算${races}戦、表彰台${podiums}回まで食い込みながらも勝利には届かず、`;
  else recordText = `通算${races}戦を走り抜いたが目立った結果は残せず、`;
  let farewellText;
  if (r.farewellReason === "rival_retired") farewellText = `解雇後は${r.signedTeam}に活躍の場を移し、${r.age}歳でそこで現役を退いた。`;
  else if (r.farewellReason === "released") farewellText = `${r.age}歳でチームを去った。`;
  else farewellText = `${r.age}歳で現役を引退した。`;
  return `${originText}${spanText}${recordText}${farewellText}`;
}
// v13.1: 殿堂入りの条件。「所属したことがある全選手」を無条件で殿堂入りさせるとキリがないため、
// 一定の実績（出走数・勝利・表彰台・能力）かお気に入り登録のいずれかを満たした選手だけを
// 選手名鑑に永久保存する。基準未満の選手はチームを離れた時点で記録から静かに消える
function isHallOfFameWorthy(r) {
  if (r.favorite) return true;
  const log = r.raceLog || [];
  const wins = log.filter(e => e.rank === 1).length;
  const podiums = log.filter(e => e.rank <= 3).length;
  return log.length >= 8 || wins >= 1 || podiums >= 3 || overall(r) >= 70 || !!r.prodigy;
}
// v13.1: 解雇された選手が能力・将来性次第でライバルチームに拾われる確率。
// 高OVR・高成長ランク・逸材ほど声がかかりやすい
function computePickupChance(r) {
  const ovr = overall(r);
  let chance = 0.05;
  if (ovr >= 75) chance += 0.5;
  else if (ovr >= 65) chance += 0.25;
  else if (ovr >= 55) chance += 0.1;
  if (r.growthPow === "S") chance += 0.3;
  else if (r.growthPow === "A") chance += 0.15;
  if (r.prodigy) chance += 0.2;
  return Math.min(0.9, chance);
}
const RIVAL_TEAMS = [
  { name: "レッドサンダー山陽", color: "#d9484a" }, { name: "クレディ・ブルー", color: "#3f7fd9" },
  { name: "ヴェロチタ京都", color: "#9a6be0" }, { name: "ウィンドミル北海道", color: "#e08a3f" },
];
// v14: マイライフモード用のチームプール（6チーム）。プレイヤーは新人としてこの中の
// 1チームに加入し、残り5チームは全て純粋なライバルAIチームとしてレースに登場する
const MYLIFE_TEAMS = [
  ...RIVAL_TEAMS,
  { name: "サンライズ静岡", color: "#4fd1c5" }, { name: "北斗プロサイクル", color: "#c084fc" },
];
// v14.1: マイライフの経歴選択。年齢・初期能力・成長ポテンシャル（growthPow分布・成長タイプ）に
// 差を付け、「若く粗削りだが伸びしろ最大」〜「即戦力だが伸びしろ小さめ」の3択にする
const ML_BACKGROUNDS = {
  highschool: { label: "高校卒", age: 18, powerBase: 40, growth: "late", powDist: [0.16, 0.46, 0.80],
    desc: "能力はまだ粗削りだが伸びしろは最大級。長い目で育てる叩き上げタイプ" },
  university: { label: "大学卒", age: 22, powerBase: 50, growth: "normal", powDist: [0.08, 0.30, 0.65],
    desc: "能力・伸びしろのバランス型。安定した成長曲線が魅力" },
  corporate: { label: "実業団卒", age: 25, powerBase: 58, growth: "early", powDist: [0.02, 0.12, 0.40],
    desc: "即戦力級の完成度を持つが、伸びしろは小さめ" },
};
// v14.2: マイライフの私生活・取材イベント。シーズンモードのEVENTS/resolveEventと
// 同じ「タイトル・本文・選択肢×効果」の構成を、選手1人向けに簡略化して流用する
const ML_EVENTS = [
  { title: "地元メディアの取材", text: "地元テレビ局が調子について取材したいと申し出た。",
    choices: [
      { label: "前向きにアピールする", result: "自信に満ちた受け答えで注目を集めた。少し気を張ったが手応えを感じている。", effects: { fatigueDelta: 4, abBoost: 1 } },
      { label: "謙虚に答える", result: "謙虚な受け答えが好感を持たれた。気負わず過ごせた。", effects: { fatigueDelta: -4 } },
    ] },
  { title: "個人スポンサーとの会食", text: "個人スポンサーの担当者から食事に誘われた。",
    choices: [
      { label: "しっかり交流する", result: "関係を深めることができ、期待に応えたいという気持ちが強くなった。", effects: { abBoost: 2, fatigueDelta: 6 } },
      { label: "早めに切り上げて休む", result: "体調を優先し、早めに休んだ。", effects: { fatigueDelta: -10 } },
    ] },
  { title: "実家に顔を出す", text: "オフの合間、久しぶりに実家に顔を出した。",
    choices: [
      { label: "ゆっくり休養する", result: "心身ともにリフレッシュでき、疲れが抜けた。", effects: { fatigueDelta: -25 } },
      { label: "自主トレに励む", result: "休みの日も鍛錬を怠らず、地力が少し上がった。", effects: { abBoost: 3, fatigueDelta: 5 } },
    ] },
  { title: "ライバルからの挑発", text: "SNSでライバル選手から挑発めいた投稿があった。",
    choices: [
      { label: "闘志を燃やす", result: "闘志に火がつき、練習に熱が入った。", effects: { abBoost: 3, fatigueDelta: 10 } },
      { label: "受け流す", result: "冷静に受け流し、平常心を保った。", effects: { fatigueDelta: -2 } },
    ] },
  { title: "監督との面談", text: "監督に呼ばれ、今後の起用方針について話をした。",
    choices: [
      { label: "エースを目指したいと伝える", result: "強い意欲を評価された一方、気合が入りすぎて少し力んでしまった。", effects: { abBoost: 2, fatigueDelta: 6, managerEvalDelta: 4 } },
      { label: "チームのために尽くすと伝える", result: "誠実な姿勢が信頼につながった。", effects: { fatigueDelta: -6, managerEvalDelta: 6 } },
    ] },
  { title: "違和感のある一日", text: "練習中、脚に軽い張りを感じた。",
    choices: [
      { label: "無理せず様子を見る", result: "早めのケアで大事に至らず、疲労も抜けた。", effects: { fatigueDelta: -15 } },
      { label: "気にせず追い込む", result: "その日は乗り切ったが、疲労が蓄積した。", effects: { abBoost: 2, fatigueDelta: 18 } },
    ] },
];
// v14.3: 監督指示（レースごとの役割指示）。全うすると監督評価（マスクデータ）が上がり、
// 評価が高いほどエースなど重要な役割の指示が出やすくなる好循環にする
const MANAGER_DIRECTIVES = {
  ace: { key: "ace", label: "エースとして表彰台を狙え", desc: "チームの主力として3位以内でフィニッシュせよ",
    evalGain: 7, evalPenalty: 5, check: (rank) => rank <= 3 },
  breakthrough: { key: "breakthrough", label: "積極的な走りで上位進出せよ", desc: "上位30%以内でのフィニッシュを目指せ",
    evalGain: 5, evalPenalty: 2, check: (rank, total) => rank <= Math.max(3, Math.ceil(total * 0.3)) },
  support: { key: "support", label: "アシストとしてチームを支えよ", desc: "先頭集団に食らいついて完走せよ",
    evalGain: 3, evalPenalty: 1, check: (rank, total) => rank <= Math.max(5, Math.ceil(total * 0.6)) },
  experience: { key: "experience", label: "経験を積むために出走せよ", desc: "とにかく最後まで走り切れ",
    evalGain: 2, evalPenalty: 0, check: () => true },
};
// managerEvalが高いほど「エース」指示の抽選比重が上がり、低いうちは「経験」指示が出やすい
function mlGenDirective(year, month, classIdx, managerEval) {
  const rng = mulberry(year * 4001 + month * 131 + classIdx * 23 + 9007);
  const w = {
    ace: managerEval >= 65 ? 34 : managerEval >= 40 ? 12 : 2,
    breakthrough: 28,
    support: 26,
    experience: managerEval < 25 ? 30 : 8,
  };
  const totalW = Object.values(w).reduce((a, b) => a + b, 0);
  let roll = rng() * totalW;
  for (const k of Object.keys(w)) { if (roll < w[k]) return MANAGER_DIRECTIVES[k]; roll -= w[k]; }
  return MANAGER_DIRECTIVES.experience;
}
// v14.3: 監督評価はマスクデータのため選手には数値を見せず、大まかな評価ラベルのみ表示する
function managerEvalTier(v) {
  if (v >= 80) return { label: "絶大な信頼", color: C.yellow };
  if (v >= 60) return { label: "高い評価", color: C.green };
  if (v >= 40) return { label: "順調な評価", color: C.blue };
  if (v >= 20) return { label: "様子見", color: C.sub };
  return { label: "信頼不足", color: C.red };
}
// v14.3: 年俸で得た資金を使うショップ群（パーツはPARTSを流用、それ以外はマイライフ専用）
const ML_HOUSES = [
  { label: "賃貸アパート", price: 80, fatigueBonus: 5, desc: "毎月の疲労回復+5（恒常）" },
  { label: "分譲マンション", price: 220, fatigueBonus: 12, desc: "毎月の疲労回復+12（恒常）" },
  { label: "郊外の一戸建て", price: 480, fatigueBonus: 22, desc: "毎月の疲労回復+22。私生活が安定し監督評価もやや上がりやすくなる" },
];
const ML_CARS = [
  { label: "中古の軽自動車", price: 60, raceFatigueCut: 0.10, desc: "レース参加による疲労蓄積-10%" },
  { label: "国産セダン", price: 160, raceFatigueCut: 0.20, desc: "レース参加による疲労蓄積-20%" },
  { label: "輸入スポーツカー", price: 400, raceFatigueCut: 0.30, desc: "レース参加による疲労蓄積-30%" },
];
const ML_GEAR = {
  roller: { label: "自主トレ用スマートローラー", price: 90, desc: "練習の成長効果+15%（恒常）" },
  monitor: { label: "パワーメーター一式", price: 70, desc: "狙った能力の伸びがさらに+10%（恒常）" },
  chef: { label: "専属コンディショニングシェフ", price: 150, desc: "レース参加による疲労蓄積が10%軽減される（恒常）" },
};
const ML_STOCK_ITEMS = {
  drink: { label: "リカバリードリンク", desc: "疲労を30回復", price: 15, fatigueDelta: -30 },
  supp:  { label: "上質な休養サプリ", desc: "疲労を60回復", price: 32, fatigueDelta: -60 },
  tune:  { label: "コンディション調整", desc: "調子を1段階アップ", price: 20, condDelta: 1 },
};
// v10: 種目別複合適性スコア（OVR計算式自体は変更せず、表示専用の追加指標）
const DISCIPLINES = {
  flat:   { label: "平坦",      calc: r => r.flat * 0.6 + r.solo * 0.25 + r.stamina * 0.15 },
  climb:  { label: "山岳",      calc: r => r.climb * 0.7 + r.stamina * 0.3 },
  sprint: { label: "スプリント", calc: r => r.sprint * 0.7 + r.flat * 0.2 + r.stamina * 0.1 },
  solo:   { label: "独走(TT)",  calc: r => r.solo * 0.7 + r.stamina * 0.3 },
  hill:   { label: "丘陵",      calc: r => r.climb * 0.4 + r.sprint * 0.4 + r.stamina * 0.2 },
};
const DISCIPLINE_KEYS = Object.keys(DISCIPLINES);
function disciplineScore(r, key) { return Math.round(DISCIPLINES[key].calc(r)); }
// レースの favors（脚質）から、編成画面で強調表示する種目別スコアを引く
const FAVORS_TO_DISCIPLINE = { SPR: "sprint", CLM: "climb", PUN: "hill", TT: "solo" };
function fmtTime(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, "0")}`; }
function fmtGap(sec) { return sec < 0.5 ? "TOP" : `+${fmtTime(sec)}`; }

// v12バグ修正: 母集団を広げても「同じ画面に同じ名前が2人」現れる確率はゼロにはならないため、
// 呼び出し側から渡された「使用済み名前」の集合を避けて選ぶようにし、同じレース・同じ
// スカウト一覧・同じFA一覧の中では確実にかぶらないようにする（bannedはミュータブルに
// 追記していくので、同じSetをリレーしながらnewRiderを複数回呼べば呼び出し間でも重複しない）
function pickRiderName(rng, banned) {
  let name, tries = 0;
  do {
    name = SURNAMES[Math.floor(rng() * SURNAMES.length)] + " " + GIVEN[Math.floor(rng() * GIVEN.length)];
    tries++;
  } while (banned && banned.has(name) && tries < 200);
  if (banned) banned.add(name);
  return name;
}

function randPow(rng, dist) {
  const d = dist || [0.05, 0.25, 0.60];
  const x = rng();
  if (x < d[0]) return "S";
  if (x < d[1]) return "A";
  if (x < d[2]) return "B";
  return "C";
}

function newRider(power, rng, opts = {}) {
  const keys = Object.keys(TYPES);
  const type = opts.type || keys[Math.floor(rng() * keys.length)];
  const clamp = (v) => Math.max(22, Math.min(94, Math.round(v)));
  const b = () => power + (rng() - 0.5) * 22;
  const r = { flat: b(), climb: b(), sprint: b(), stamina: b(), solo: b() };
  const bo = 14;
  if (type === "SPR") { r.sprint += bo; r.climb -= 9; }
  if (type === "CLM") { r.climb += bo; r.sprint -= 9; }
  if (type === "RUL") { r.flat += bo; r.stamina += 6; }
  if (type === "PUN") { r.climb += 7; r.sprint += 7; }
  if (type === "TT")  { r.solo += bo; r.flat += 6; }
  if (opts.abBonus) Object.entries(opts.abBonus).forEach(([k, v]) => { r[k] += v; });
  if (opts.forceProdigy) AB_KEYS.forEach(k => { r[k] += 12; }); // v8: 逸材はベース能力を底上げ
  AB_KEYS.forEach(k => r[k] = clamp(r[k]));
  const age = opts.age ?? (22 + Math.floor(rng() * 12));
  const gKeys = Object.keys(GROWTH);
  // v14: マイライフの経歴選択（高卒/大卒/実業団卒）で成長タイプを明示指定できるように。
  // 指定が無ければ従来通りランダム（若年層はlate寄りの補正込み）
  let growth = opts.growth || gKeys[Math.floor(rng() * 3)];
  if (!opts.growth && age <= 19 && rng() < 0.5) growth = "late";
  let trait = null;
  if (rng() < 0.35) {
    const bad = rng() < 0.25;
    const pool = Object.keys(TRAITS).filter(k => !!TRAITS[k].bad === bad);
    trait = pool[Math.floor(rng() * pool.length)];
  }
  const px = rng();
  let personality = px < 0.30 ? "normal" : px < 0.35 ? "genius"
    : ["hotblood", "seeker", "artisan", "free", "smart"][Math.floor(rng() * 5)];
  let growthPowVal = randPow(rng, opts.powDist);
  if (opts.forceProdigy) { personality = "genius"; growthPowVal = "S"; }
  const rider = {
    id: RID++,
    name: pickRiderName(rng, opts.banned),
    type, ...r, age, growth, growthPow: growthPowVal, trait, personality,
    fatigue: 20 + Math.floor(rng() * 20), cond: 3, injury: 0, streak: 0,
    focus: "flat", joinOvr: 0, parts: { frame: null, tire: null, wheels: null, nutrition: null },
    prodigy: !!opts.forceProdigy,
    raceLog: [], // v13: 選手名鑑用の出走履歴（{year, month, name, rank}）
    favorite: false, // v13.1: お気に入り登録（殿堂入り条件を満たさなくても必ず記録に残す）
  };
  rider.joinOvr = overall(rider);
  return rider;
}

function initRoster() {
  const mk = (name, type, f, c, sp, st, so, age, growth, pow, trait, pers) => {
    const r = {
      id: RID++, name, type, flat: f, climb: c, sprint: sp, stamina: st, solo: so,
      age, growth, growthPow: pow, trait: trait || null, personality: pers,
      fatigue: 20, cond: 3, injury: 0, streak: 0,
      focus: "flat", joinOvr: 0, parts: { frame: null, tire: null, wheels: null, nutrition: null },
      raceLog: [], favorite: false,
    };
    r.joinOvr = overall(r); return r;
  };
  // v12バグ修正: 初期メンバー6名の名前が完全固定されており、新しくゲームを始めても
  // 毎回同じ名前になってしまうと気になるとのフィードバックを受け、能力値・年齢・役割の
  // バランスはそのまま維持しつつ、名前だけを新規ゲームのたびにランダム生成するようにした
  const rng = mulberry(Date.now() % 999983);
  const banned = new Set();
  const randName = () => pickRiderName(rng, banned);
  return [
    mk(randName(), "SPR", 66, 38, 82, 60, 48, 25, "normal", "A", "closer", "hotblood"),
    mk(randName(), "CLM", 52, 80, 34, 72, 58, 27, "late", "B", "mount", "seeker"),
    mk(randName(), "RUL", 76, 56, 52, 76, 64, 28, "normal", "C", "domestique", "artisan"),
    mk(randName(), "PUN", 62, 67, 64, 62, 56, 23, "early", "A", null, "normal"),
    mk(randName(), "TT", 64, 46, 44, 64, 76, 26, "normal", "B", null, "free"),
    mk(randName(), "RUL", 48, 42, 44, 52, 46, 19, "late", "S", "iron", "genius"),
  ];
}

// v8: クラスが上がるほど候補が増える。5名を超える分は汎用スロットで補う
function scoutSpecs(policy, count) {
  let base5;
  if (policy === "future") base5 = [17, 18, 18, 19, 20].map(age => ({ age, mul: 0.8, priceMul: 0.7, powDist: [0.15, 0.60, 0.90] }));
  else if (policy === "now") base5 = [23, 24, 25, 26, 27].map(age => ({ age, mul: 1.08, priceMul: 1.25, powDist: [0.0, 0.05, 0.45] }));
  else base5 = [18, 20, 22, 24, 25].map((age, i) => ({ age, mul: 0.85 + i * 0.055, priceMul: 0.7 + i * 0.13 }));
  const extra = [];
  for (let i = 5; i < count; i++) extra.push({ age: 20 + (i % 6), mul: 0.9 + (i % 4) * 0.05, priceMul: 0.85 + (i % 4) * 0.1 });
  return [...base5, ...extra];
}
function genScouts(classIdx, seed, policy = "balance", existingNames) {
  const rng = mulberry(seed);
  const base = CLASSES[classIdx].scout;
  const count = SCOUT_COUNT_BY_CLASS[classIdx];
  const specs = scoutSpecs(policy, count);
  const prodigyRng = mulberry(seed + 999);
  const hasProdigy = prodigyRng() < PRODIGY_CHANCE_BY_CLASS[classIdx];
  const prodigyIdx = hasProdigy ? Math.floor(prodigyRng() * count) : -1;
  // v12バグ修正: 候補一覧の中で名前が被らないよう、既存ロースターの名前も避けつつ
  // 同じバッチ内で使った名前を集合に積み上げていく
  const nameBanned = new Set(existingNames || []);
  return specs.map((s, i) => {
    const opts = { age: s.age, powDist: s.powDist, banned: nameBanned };
    if (policy === "sprint" && i < Math.ceil(count * 0.6)) { opts.type = "SPR"; opts.abBonus = { sprint: 8 }; }
    if (policy === "climb" && i < Math.ceil(count * 0.6)) { opts.type = "CLM"; opts.abBonus = { climb: 8 }; }
    if (i === prodigyIdx) opts.forceProdigy = true;
    const r = newRider(base * s.mul, rng, opts);
    if (s.age <= 18) r.growth = rng() < 0.6 ? "late" : r.growth;
    const blur = {};
    AB_KEYS.forEach(k => {
      const d = 6 + rng() * 9;
      blur[k] = { min: Math.max(20, Math.round(r[k] - d)), max: Math.min(94, Math.round(r[k] + d)) };
    });
    const ovrMin = Math.round(AB_KEYS.reduce((a, k) => a + blur[k].min, 0) / 5);
    const ovrMax = Math.round(AB_KEYS.reduce((a, k) => a + blur[k].max, 0) / 5);
    const tag = s.age <= 19 ? "高卒ルーキー" : s.age <= 22 ? "大卒" : "実業団";
    return { rider: r, tag, blur, ovrMin, ovrMax, price: Math.round(overall(r) * 1.4 * s.priceMul * (r.prodigy ? 1.7 : 1)) };
  });
}

// v11: FA移籍市場。genScoutsと異なり、既に完成している23〜30歳の即戦力〜中堅選手を
// 能力を伏せずに（ブレ幅なしで）即決購入方式で提示する。月1回、月送り時に全入れ替え
const FA_POOL_COUNT_BY_CLASS = [4, 5, 7];
function genFaPool(classIdx, seed, existingNames) {
  const rng = mulberry(seed);
  const base = CLASSES[classIdx].scout;
  const count = FA_POOL_COUNT_BY_CLASS[classIdx];
  const nameBanned = new Set(existingNames || []);
  const out = [];
  for (let i = 0; i < count; i++) {
    const age = 23 + Math.floor(rng() * 8); // 23〜30歳
    const mul = 0.85 + rng() * 0.45; // 新人スカウトよりブレ幅を広く（即戦力〜掘り出し物まで）
    const r = newRider(base * mul, rng, { age, banned: nameBanned });
    const ageFactor = age <= 25 ? 1.2 : age <= 28 ? 1.0 : age <= 30 ? 0.85 : 0.65;
    const price = Math.max(20, Math.round(overall(r) * 1.6 * ageFactor));
    out.push({ rider: r, age, price });
  }
  return out;
}

function genSponsors(classIdx, year) {
  const rng = mulberry(year * 913 + classIdx * 77 + 3);
  const pick = () => SPONSOR_NAMES[Math.floor(rng() * SPONSOR_NAMES.length)];
  const need = CLASSES[classIdx].need;
  return [
    { name: pick(), style: "安定型", monthly: 18 + classIdx * 8, norma: Math.max(10, need - 10), bonus: 80 + classIdx * 40, penalty: 30 + classIdx * 15, mandates: 1 },
    { name: pick(), style: "バランス型", monthly: 12 + classIdx * 7, norma: need - 3, bonus: 180 + classIdx * 70, penalty: 80 + classIdx * 30, mandates: 1 },
    { name: pick(), style: "挑戦型", monthly: 8 + classIdx * 5, norma: need + 5, bonus: 350 + classIdx * 130, penalty: 180 + classIdx * 60, mandates: 2 },
  ];
}
function pickMandateMonths(n, seed) {
  const rng = mulberry(seed);
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out.sort((a, b) => a - b);
}

function strHash(s) {
  let h = 9;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489);
  return (h ^ (h >>> 9)) >>> 0;
}

// v7: month===11でclassIdx===0(B1)ならA昇格戦を2日間ステージレースとして生成
// v14.8: gtWins（そのクラスでその年に総合優勝したグランツールのgtIndex配列）を追加引数に取り、
// PROクラスのグランファイナルだけは出場条件がポイントではなくグランツール全制覇になる
function genMonthRaces(year, month, classIdx, points, sponsor, gtWins) {
  const rng = mulberry(year * 1000 + month * 37 + 5);
  const races = [];
  if (month === 11) {
    const isProFinal = classIdx === 2;
    const gtWinCount = (gtWins || []).length;
    const qualified = isProFinal ? gtWinCount >= GRAND_TOURS.length : points >= CLASSES[classIdx].need;
    // v12: 以前はB1→Aの昇格戦だけが2日間ステージレースで、A→PRO・PROグランファイナルは
    // 1日のとばしレースだった（1日目を観戦してもすぐ結果に飛ぶように見え、2日目が
    // 行われないバグと誤解されていた）。全クラスのチャンピオンシップを統一して
    // 2日間ステージレースにする
    const stageName = classIdx === 0 ? "A昇格ステージレース（2日間・総合タイム）"
      : classIdx === 1 ? "PRO昇格ステージレース（2日間・総合タイム）"
      : "グランファイナル（2日間・総合タイム）";
    races.push({
      id: `champ-${year}-${classIdx}`, championship: true, locked: !qualified, stageRace: true, stageCount: 2,
      name: stageName,
      tmpl: TEMPLATES[3], grade: 3, cls: classIdx,
      lockReason: qualified ? null : (isProFinal
        ? `出場権なし（年間グランツール全${GRAND_TOURS.length}戦制覇が必要・現在${gtWinCount}/${GRAND_TOURS.length}勝）`
        : `出場権なし（${CLASSES[classIdx].need}pt必要）`),
    });
    const t = TEMPLATES[Math.floor(rng() * TEMPLATES.length)];
    races.push({ id: `r-${year}-${month}-x`, name: `${VENUES[Math.floor(rng() * VENUES.length)]}ファイナルロード`, tmpl: t, grade: 2, cls: classIdx, locked: false });
    return races;
  }
  const count = month === 0 ? 3 : (month === 8 || month === 9) ? 4 : 5;
  const openCount = month === 0 ? 2 : 2 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const t = TEMPLATES[Math.floor(rng() * TEMPLATES.length)];
    const open = i < openCount;
    const cls = open ? classIdx : Math.floor(rng() * 3);
    const grade = month === 0 ? 1 : month === 10 ? (i === 0 ? 3 : 1 + Math.floor(rng() * 2)) : 1 + Math.floor(rng() * 3);
    races.push({
      id: `r-${year}-${month}-${i}`,
      name: `${VENUES[Math.floor(rng() * VENUES.length)]}${t.kind}`,
      tmpl: t, grade, cls,
      locked: !open || cls !== classIdx,
      lockReason: (!open || cls !== classIdx) ? `${CLASSES[cls].id}限定` : null,
    });
  }
  // v13: グランツール・海外遠征。年3戦（春・夏・秋）、その年のクラスに開かれた
  // 3日間の海外遠征ステージレースを追加する。stageTmplsで日ごとにコース性格を変え、
  // 通常のクラス別カレンダーとは独立に毎年必ず出走できる
  // v14.7: グランツールはPROクラス限定の大会に変更（B1・Aでは開催されない）
  // v14.8: 1戦だったグランツールを年3戦に増設。gtIndexで個別に勝敗を追跡し、
  // 3戦すべての総合優勝がグランファイナル出場の条件になる
  const gtDef = classIdx === 2 ? GRAND_TOURS.find(g => g.month === month) : null;
  if (gtDef) {
    const gtIndex = GRAND_TOURS.indexOf(gtDef);
    const venue = OVERSEAS_VENUES[Math.floor(rng() * OVERSEAS_VENUES.length)];
    races.unshift({
      id: `grandtour-${year}-${gtIndex}`, grandTour: true, gtIndex, stageRace: true, stageCount: 3,
      name: `${venue}${gtDef.season}グランツール（3日間・総合タイム）`,
      tmpl: gtDef.stageTmpls[0], stageTmpls: gtDef.stageTmpls,
      grade: 3, cls: classIdx, locked: false, lockReason: null,
    });
  }
  if (sponsor && sponsor.mandateMonths && sponsor.mandateMonths.includes(month)) {
    const target = races.find(r => !r.locked);
    if (target) target.sponsorMandate = true;
  }
  return races;
}

// ---------- 実効能力 ----------
function effAbilities(r, equip, itemBoost, grade) {
  const fatPen = 1 - Math.max(0, (r.fatigue || 0) - 50) * 0.003;
  const cm = condMul(r.cond || 3);
  const e = {};
  AB_KEYS.forEach(k => { e[k] = r[k]; });
  if (r.parts) {
    PART_SLOTS.forEach(slot => {
      const pid = r.parts[slot];
      if (pid && PARTS[pid]) Object.entries(PARTS[pid].ab).forEach(([k, v]) => { e[k] += v; });
    });
  }
  const bigMul = (r.trait === "big" && grade === 3) ? 1.06 : 1;
  AB_KEYS.forEach(k => { e[k] = e[k] * cm * fatPen * bigMul; });
  e.flat *= (1 + equip.frame * 0.06) * (itemBoost.suit ? 1.15 : 1);
  e.climb *= (1 + equip.wheels * 0.06) * (itemBoost.wheel ? 1.15 : 1);
  AB_KEYS.forEach(k => { e[k] = Math.min(135, e[k]); });
  e.type = r.type; e.trait = r.trait;
  return e;
}
// 脚質の得意区間ボーナス（形骸化対策）
function typeAffinityBonus(type, segType) {
  return (TYPES[type]?.affinity?.[segType]) || 0;
}
function abilityFor(segType, e) {
  if (segType === "flat") return e.flat;
  if (segType === "hill") return e.climb * 0.55 + e.flat * 0.45;
  if (segType === "climb") return e.climb;
  if (segType === "sprint") return e.sprint;
  if (segType === "mtn") return e.climb * 0.7 + e.sprint * 0.3;
  if (segType === "tt") return e.solo * 0.6 + e.flat * 0.4;
  return e.flat;
}

// ---------- v7: コース生成（3D表示とシミュレーションで共有） ----------
// 現実の勾配(%)は使わず、区間タイプ＋レースごとの「急峻さ乱数」で近似する（簡易だが十分にドラマが出る）
function generateCourse(raceMeta, dayTag) {
  // v13: グランツールなど、日ごとに異なるコース性格を持つステージレース用に
  // stageTmpls（日別テンプレート配列）があればそちらを優先して使う
  const stageMatch = dayTag && /^day(\d+)$/.exec(dayTag);
  const tmpl = (raceMeta.stageTmpls && stageMatch) ? raceMeta.stageTmpls[Number(stageMatch[1]) - 1] || raceMeta.tmpl : raceMeta.tmpl;
  // v8: dayTagを混ぜることで、2日間ステージレースの各日で別コースになるようにする（同一レースIDの使い回し対策）
  const crng = mulberry(strHash(raceMeta.id + raceMeta.name + (dayTag || "")));
  const LEN = 300 + crng() * 120;
  const amp1 = 20 + crng() * 26, f1 = 2.2 + crng() * 2.2, ph1 = crng() * Math.PI * 2;
  const amp2 = 4 + crng() * 9, f2 = 8 + crng() * 8, ph2 = crng() * Math.PI * 2;
  const steepness = 0.75 + crng() * 0.6; // 0.75〜1.35：この山/丘がきついかどうか
  // v13: 周回コース（laps指定時、1周分のsegsをそのままlaps回繰り返して全体コースを構成する）
  const laps = tmpl.laps || 1;
  const lapSegDefs = laps > 1 ? Array.from({ length: laps }, () => tmpl.segs).flat() : tmpl.segs;
  const segs = lapSegDefs.map(([type, base, dist]) => ({ type, base, dist, label: SEG_LABEL[type] }));
  // v12: 天候・横風エシュロン。平坦・丘陵区間の一部にランダムで横風フラグを立てる
  segs.forEach(s => {
    s.wind = (s.type === "flat" || s.type === "hill") && crng() < 0.28;
    if (s.wind) s.windDir = crng() < 0.5 ? 1 : -1;
  });
  const totalW = segs.reduce((s, x) => s + x.dist, 0);
  const cumFrac = []; let acc = 0;
  segs.forEach(s => { acc += s.dist / totalW; cumFrac.push(acc); });
  const elevTarget = { flat: 0, hill: 9, climb: 22, sprint: 0, mtn: 26, tt: 0 };
  const boundElev = [0];
  segs.forEach(s => boundElev.push(elevTarget[s.type] * steepness));
  const yAt = (frac) => {
    let j = 0;
    for (; j < segs.length; j++) { if (frac <= cumFrac[j] + 1e-6) break; }
    j = Math.min(j, segs.length - 1);
    const prev = j === 0 ? 0 : cumFrac[j - 1];
    const local = (frac - prev) / (cumFrac[j] - prev);
    return boundElev[j] + (boundElev[j + 1] - boundElev[j]) * local;
  };
  const segTypeAtFrac = (frac) => {
    for (let j = 0; j < segs.length; j++) { if (frac <= cumFrac[j] + 1e-6) return { type: segs[j].type, idx: j, wind: !!segs[j].wind, windDir: segs[j].windDir || 0 }; }
    const last = segs[segs.length - 1];
    return { type: last.type, idx: segs.length - 1, wind: !!last.wind, windDir: last.windDir || 0 };
  };
  // 標高プロファイル（グラフ表示用・30点）
  const elevationProfile = [];
  for (let i = 0; i <= 30; i++) { const f = i / 30; elevationProfile.push({ frac: f, elev: yAt(f) }); }
  let totalElevationGain = 0;
  for (let i = 1; i < elevationProfile.length; i++) { const d = elevationProfile[i].elev - elevationProfile[i - 1].elev; if (d > 0) totalElevationGain += d; }
  const climbCount = segs.filter(s => ["climb", "mtn"].includes(s.type)).length;
  const raceDifficultyRating = Math.round((totalElevationGain * 1.2 + climbCount * 15 + LEN * 0.15) * steepness);
  return {
    length: LEN, segs, cumFrac, steepness, finalIdx: segs.length - 1,
    posAtFrac: (frac) => frac * LEN,
    fracAtPos: (pos) => Math.max(0, Math.min(1, pos / LEN)),
    segTypeAt: (pos) => segTypeAtFrac(pos / LEN),
    yAt, elevationProfile, totalElevationGain, climbCount, raceDifficultyRating,
    amp1, f1, ph1, amp2, f2, ph2,
    laps, lapAtFrac: (frac) => Math.min(laps, Math.floor(Math.max(0, Math.min(1, frac)) * laps) + 1),
  };
}
// v13: キャリア統計の通算値更新（レース1件確定するたびに呼ぶ）
function bumpCareerStats(cs, rank, prize) {
  return {
    totalRaces: cs.totalRaces + 1,
    totalWins: cs.totalWins + (rank === 1 ? 1 : 0),
    totalPodiums: cs.totalPodiums + (rank <= 3 ? 1 : 0),
    totalPrize: cs.totalPrize + prize,
    bestFinish: cs.bestFinish === null ? rank : Math.min(cs.bestFinish, rank),
  };
}
function climbWeightFor(segType, steepness) {
  const base = { flat: 0, hill: 0.4, climb: 0.85, mtn: 0.9, sprint: 0, tt: 0 }[segType] || 0;
  return Math.min(1, base * steepness);
}
function terrainSpeedMul(segType, steepness) {
  const base = { flat: 1, hill: 0.85, climb: 0.65, mtn: 0.6, sprint: 1, tt: 0.95 }[segType] ?? 1;
  if (segType === "climb" || segType === "mtn") return Math.max(0.35, base - (steepness - 1) * 0.3);
  return base;
}
// 区間タイプ別の実効能力（連続勾配ブレンド＋脚質ボーナス）
function segmentAbility(segType, e, steepness) {
  let ab;
  if (segType === "sprint") ab = e.sprint;
  else if (segType === "tt") ab = e.solo * 0.6 + e.flat * 0.4;
  else if (segType === "mtn") ab = e.climb * 0.7 + e.sprint * 0.3;
  else { const w = climbWeightFor(segType, steepness); ab = e.flat * (1 - w) + e.climb * w; }
  ab += typeAffinityBonus(e.type, segType);
  if (e.trait === "mount" && ["hill", "climb", "mtn"].includes(segType)) ab += 4;
  return ab;
}

// ---------- v7/v8: ティックベース連続シミュレーション ----------
// v8: 解像度を5秒/tick→1秒/tickに引き上げ（3D観戦のワープ・divergenceの根本対策）。
// BASE_TICK_DIST/GROUP_GAP_DISTはTICK_SECに比例して縮小し、実時間あたりの速度・グループ判定基準は据え置き
const TICK_SEC = 1;
const GROUP_GAP_DIST = 0.22;      // これ以内の位置差なら同一グループ
const ROTATION_PERIOD_TICKS = 20; // 20秒ごとに先頭交代
// v12: AIチームごとの隠しの戦略スタイル（プレイヤーの事前作戦とは独立）。
// aggressive=push相当・conservative=hold相当のローテーションペースになる
const AI_STYLES = ["aggressive", "balanced", "conservative"];
// v12バグ修正: 消耗ペースを全体的に緩和（1.15→0.85）。集団サイズによる消耗軽減・
// 集団後方での回復を導入したこととあわせ、長いレースで役割が合っている選手まで
// 早々にスタミナを使い切ってしまい、役割ミスマッチとの対比が埋もれてしまう問題に対応
const DRAIN_K = 0.85;
// v12バグ修正: エネルギーは減る一方で回復する仕組みがなく、下限も無かったため、
// 長いレースでは選手のエネルギーが際限なく（-1000を超えるほど）マイナスに膨らみ続けていた。
// energyPenaltyMul()はenergy<=-90あたりで既に速度低下が頭打ち（0.55倍）になるため、
// それより下はゲーム的な意味を持たない数値の暴走に過ぎない。下限を設けて無意味な
// 桁あふれを防ぐ（energyPenaltyMulの頭打ち地点より十分下なので、既存の速度・結果には影響しない）
const ENERGY_FLOOR = -100;
const BASE_TICK_DIST = 0.26;      // 能力70・エネルギー満タン時の基準移動量/tick
const ATTACK_TICKS = 25;          // アタック持続（25秒）
// v14.10: 逃げ要員（breakaway）ロールの選手が実際に飛び出すための持続時間。
// エースの早期発射（ATTACK_TICKS）よりやや長めにし、集団から確実に離れる間合いを作る
const BREAKAWAY_ATTACK_TICKS = 30;
const MAX_TICKS = 2500;

function effortCost(mode, segType, steepness) {
  if (mode === "pull") return 1.0;
  if (mode === "draft") return { flat: 0.5, tt: 0.5, sprint: 0.5, hill: 0.7 }[segType] ?? (0.85 - (steepness - 1) * 0.1);
  if (mode === "solo") return 1.3;
  return 1.6; // attack
}
function energyPenaltyMul(energy) {
  if (energy > 20) return 1;
  if (energy > 0) return 0.85 + (energy / 20) * 0.15;
  // v10: 下限0.35→0.55（深いエネルギー枯渇時の失速緩和。千切れ選手の遅れ過大バグ対策）
  return Math.max(0.55, 1 + (energy / 100) * 0.5);
}
function tickSpeedFactor(en, segType, mode, steepness) {
  const ab = segmentAbility(segType, en, steepness);
  let f = 1 + (ab - 70) / 260;
  if (mode === "attack") f *= 1.15;
  f *= energyPenaltyMul(en.energy);
  // v8: 微小なゆらぎ（±3%）。純粋な決定論だと同一条件のレースが毎回ほぼ同じ結果になってしまうため
  f *= 1 + (Math.random() - 0.5) * 0.06;
  return Math.max(0.15, f);
}
function tickDistance(en, segType, mode, steepness) {
  return BASE_TICK_DIST * tickSpeedFactor(en, segType, mode, steepness) * terrainSpeedMul(segType, steepness);
}
// v12バグ修正: 平坦アシストが山岳区間に入っても、能力値による速度低下以外は何も起きず、
// 千切れるとしても唐突に見えた。役割と地形が合っていない選手は消耗が早まるようにし、
// 能力不足による減速と合わさって「じわじわ垂れて千切れていく」自然な挙動にする
function roleTerrainMismatchMul(role, segType) {
  if (role === "flat" && (segType === "climb" || segType === "mtn")) return 1.6;
  if (role === "mountain" && (segType === "flat" || segType === "sprint")) return 1.3;
  return 1;
}
// v12: 集団の人数が多いほど風除け効果で消耗が緩む（独走=1.0、大集団ほど下がり0.55が下限）。
// 牽引中の選手はこの恩恵を受けない（風除けの外にいるため。呼び出し側でdraft時のみ掛ける）
function groupShelterMul(n) {
  return Math.max(0.55, 1 - Math.min(1, (n - 1) / 14) * 0.45);
}
const ENERGY_REGEN_BASE = 0.5; // 集団後方（牽引順が回ってこない位置）での基礎回復量/tick
function energyDrain(en, mode, segType, steepness) {
  return TICK_SEC * (1 - en.stamina / 150) * DRAIN_K * effortCost(mode, segType, steepness) * roleTerrainMismatchMul(en.role, segType);
}
// 役割ごとに「今この地形で牽引役になれるか」
// v12バグ修正: エネルギーが尽きているかどうかは"sub"ロールしかチェックしておらず、
// 他のロール（lead/flat/mountain/breakaway）は消耗しきっていてもローテーションの
// 牽引順が回ってくると牽引を続けてしまっていた（エネルギーが際限なく大きくマイナスに
// なる・スタミナ切れの選手がずるずる千切れず牽引を続ける不自然な挙動の原因）。
// 役割に関わらず、エネルギーが尽きたら牽引適性を失うようにする
function canPull(en, segType) {
  if (en.isAce) return false;
  if (en.energy <= 0) return false;
  if (en.role === "breakaway") return true;
  if (en.role === "lead") return true;
  if (en.role === "sub") return true;
  if (en.role === "mountain") return ["climb", "mtn"].includes(segType);
  if (en.role === "flat") return ["flat", "hill"].includes(segType);
  return false;
}

// AIチームの役割自動割り当て（5役割・先頭=エース）
function assignAIRoles(members, squadN) {
  const roles = {};
  members.forEach((r, i) => {
    if (i === 0 || squadN < 3) { roles[r.id] = "lead"; return; }
    const roll = Math.random();
    if (r.type === "CLM" && roll < 0.3) roles[r.id] = "breakaway";
    else if (r.type === "CLM") roles[r.id] = "mountain";
    else if (r.type === "TT" && roll < 0.3) roles[r.id] = "breakaway";
    else if (r.type === "SPR" || r.type === "RUL") roles[r.id] = roll < 0.15 ? "breakaway" : "flat";
    else roles[r.id] = roll < 0.2 ? "breakaway" : "sub";
  });
  if (squadN >= 3) {
    const hasLead = members.slice(1).some(r => roles[r.id] === "lead" || roles[r.id] === "sub" || roles[r.id] === "flat" || roles[r.id] === "mountain");
    if (!hasLead && members.length > 1) roles[members[1].id] = "lead";
  }
  return roles;
}

// 1レース分のティックシミュレーションを実行/再開する
// riders: buildSimで作った実体配列（pos/energy/mode/finished/history...を保持）
// fromTick: この番号のティックから再計算（0なら最初から）
// directive: { chaseMode:'normal'|'push'|'hold', aceEarly:bool }
// noGroup: true ならグルーピングを一切行わない（TT個人走行用）
function simulateTicks(course, riders, fromTick, directive, noGroup) {
  if (fromTick === 0) {
    riders.forEach(en => {
      en.pos = 0; en.energy = 100; en.finished = false; en.finishTime = null;
      // v12: エース早期発射は無線指示の廃止に伴い出走前の作戦選択になったため、
      // レース開始（fromTick===0）の時点から適用する
      // v14.10: 逃げ要員ロールは牽引適性が上がるだけで実際に飛び出す処理が無く、
      // 「逃げてくれない」不具合になっていた。ロールを持つ選手はレース開始と同時に
      // 自動でアタック（attackモード）に入り、実際に集団から離れる動きをするようにする
      en.attackLeft = (directive.aceEarly && en.isAce) ? ATTACK_TICKS
        : (en.role === "breakaway" ? BREAKAWAY_ATTACK_TICKS : 0);
      en.posHist = []; en.energyHist = []; en.modeHist = []; en.groupHist = []; en.slotHist = [];
    });
  } else {
    riders.forEach(en => {
      const idx = Math.min(fromTick - 1, en.posHist.length - 1);
      en.pos = en.posHist[idx]; en.energy = en.energyHist[idx];
      en.posHist = en.posHist.slice(0, fromTick); en.energyHist = en.energyHist.slice(0, fromTick);
      en.modeHist = en.modeHist.slice(0, fromTick); en.groupHist = en.groupHist.slice(0, fromTick);
      en.slotHist = en.slotHist.slice(0, fromTick);
      if (directive.aceEarly && en.isAce) { en.attackLeft = ATTACK_TICKS; }
    });
  }
  let tick = fromTick;
  while (tick < MAX_TICKS) {
    const active = riders.filter(en => !en.finished);
    if (active.length === 0) break;
    // 1. グループ判定（位置の近さのみ。吸収・千切れは自然発生）
    if (noGroup) {
      active.forEach((en, i) => { en.groupId = en.id; });
    } else {
      active.sort((a, b) => b.pos - a.pos);
      let gid = 0;
      active.forEach((en, i) => {
        if (i === 0) { en.groupId = gid; return; }
        if (active[i - 1].pos - en.pos <= GROUP_GAP_DIST) en.groupId = active[i - 1].groupId;
        else { gid++; en.groupId = gid; }
      });
    }
    // 2. モード決定（pull/draft/solo/attack）：ロール・ローテーション周期・無線指示から
    const groups = {};
    active.forEach(en => { (groups[en.groupId] = groups[en.groupId] || []).push(en); });
    Object.values(groups).forEach(members => {
      if (members.length === 1) {
        const en = members[0];
        en.mode = en.attackLeft > 0 ? "attack" : "solo";
        en.slot = 0;
        if (en.attackLeft > 0) en.attackLeft--;
        return;
      }
      const segType = course.segTypeAt(members[0].pos).type;
      let eligible = members.filter(en => canPull(en, segType));
      let rotSpan = ROTATION_PERIOD_TICKS;
      // v12: 自チームが関与するグループはプレイヤーの事前作戦（directive.chaseMode）に従う。
      // AIチームのみのグループは、そのグループの多数派チームが持つ隠しスタイル
      // （aiStyle）に応じたペースになる（プレイヤーの作戦とは独立）
      if (members.some(en => en.team === "PLAYER")) {
        if (directive.chaseMode === "push") rotSpan = Math.max(2, ROTATION_PERIOD_TICKS - 2);
        if (directive.chaseMode === "hold") rotSpan = ROTATION_PERIOD_TICKS + 3;
      } else {
        const styleCounts = {};
        members.forEach(en => { if (en.aiStyle) styleCounts[en.aiStyle] = (styleCounts[en.aiStyle] || 0) + 1; });
        const domStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (domStyle === "aggressive") rotSpan = Math.max(2, ROTATION_PERIOD_TICKS - 2);
        if (domStyle === "conservative") rotSpan = ROTATION_PERIOD_TICKS + 3;
      }
      const rotIdx = Math.floor(tick / rotSpan);
      let puller = eligible.length ? eligible[rotIdx % eligible.length] : null;
      // v12バグ修正: canPullにエネルギー切れの判定を追加したことで、集団全員が消耗しきっている
      // 極端な状況では牽引適性者が誰もいなくなり得る。誰も牽引しないと集団全体がそのtickで
      // 完全に停止してしまうため、非常時のフォールバックとして（エースを除く）最もエネルギーが
      // 残っている選手に牽引を任せる（消耗はするが、集団が立ち止まるよりは自然）
      if (!puller) {
        const fallbackPool = members.filter(en => !en.isAce);
        if (fallbackPool.length > 0) puller = fallbackPool.reduce((best, en) => (en.energy > best.energy ? en : best), fallbackPool[0]);
      }
      // v10: 見た目専用のローテーション待ち順（0=牽引中、1,2,...=次に牽引予定、
      // ローテーションに参加しない選手は集団後方扱い）。finishTime等の実データには無関係
      members.forEach(en => {
        if (en.attackLeft > 0) { en.mode = "attack"; en.slot = 0; en.attackLeft--; return; }
        en.mode = (puller && en === puller) ? "pull" : "draft";
        const eIdx = eligible.indexOf(en);
        en.slot = eIdx === -1 ? eligible.length : ((eIdx - rotIdx) % eligible.length + eligible.length) % eligible.length;
      });
    });
    // 3. 移動：先にpull/solo/attackを確定、その後draftが「ついていけるか」を判定
    active.forEach(en => {
      if (en.mode === "draft") return;
      const segType = course.segTypeAt(en.pos).type;
      let dist = tickDistance(en, segType, en.mode, course.steepness);
      // v12バグ修正: 牽引中の選手が自チームのエースと同じ集団にいる場合でも、
      // 牽引ペースは牽引者自身の最大出力（自然な走力）で決まっていたため、
      // 脚力の強いアシストがエース本人が付いていけるペースより速く牽引してしまい、
      // 「アシストがエースを置いていく」形でエースだけ千切れてしまうことがあった。
      // エースが同じ集団にいる時は、エースが牽引した場合の到達距離を上限にして
      // ペースを合わせる（エースを守るための牽引、という前提に合わせる）
      if (en.mode === "pull") {
        const ace = active.find(o => o.team === en.team && o.isAce && o.groupId === en.groupId);
        if (ace) dist = Math.min(dist, tickDistance(ace, segType, "pull", course.steepness));
      }
      en.lastOwnDist = dist;
      en.pos = Math.min(course.length, en.pos + dist);
      en.energy = Math.max(ENERGY_FLOOR, en.energy - energyDrain(en, en.mode, segType, course.steepness));
    });
    Object.values(groups).forEach(members => {
      const puller = members.find(en => en.mode === "pull");
      if (!puller) return;
      members.filter(en => en.mode === "draft").forEach(en => {
        const segInfo = course.segTypeAt(en.pos);
        const segType = segInfo.type;
        // v12: 横風区間は道幅の関係で全員がシェルターを得られず、千切れやすくなる
        // （集団についていける基準を厳しくし、ドラフトのコストも上げる）
        const windActive = !!segInfo.wind;
        const groupDist = puller.lastOwnDist;
        const ownCapable = tickDistance(en, segType, "pull", course.steepness);
        let dist;
        if (ownCapable >= groupDist * (windActive ? 0.80 : 0.9)) {
          // v12バグ修正: ゴールスプリント区間で集団のドラフト勢が全員groupDistと完全に
          // 同一の距離だけ進む仕様だと、同じ集団の選手が毎ティック寸分違わず横並びになり、
          // ゴールタイムが不自然なほど大量に完全一致してしまう（差が均質すぎる問題）。
          // スプリント区間に限り、各選手自身のスプリント適性（ownCapable/groupDistの比）と
          // 小さな運要素を反映した微差を加え、集団のままでも着差にばらつきが出るようにする
          if (segType === "sprint") {
            const abilityEdge = ownCapable / groupDist - 1;
            const luck = (riderHash01(en.id, tick + 4409) - 0.5) * 0.05;
            dist = groupDist * Math.max(0.94, Math.min(1.06, 1 + abilityEdge * 0.6 + luck));
          } else {
            dist = groupDist;
          }
        }
        else { dist = ownCapable; en.mode = "solo"; }
        en.pos = Math.min(course.length, en.pos + dist);
        // v12: 集団の人数が多いほどドラフト勢の消耗が緩み（風除け効果）、ローテーションの
        // 牽引順が回ってこない集団後方の位置にいるほど少しずつスタミナが回復する。
        // 千切れて単独走になった選手（en.mode==="solo"）はこの恩恵を受けない
        const sheltered = en.mode === "draft";
        const shelterMul = sheltered ? groupShelterMul(members.length) : 1;
        const backRatio = sheltered ? Math.min(1, (en.slot || 0) / Math.max(1, members.length - 1)) : 0;
        const regen = sheltered ? ENERGY_REGEN_BASE * backRatio * (windActive ? 0.5 : 1) : 0;
        const drain = energyDrain(en, en.mode === "solo" ? "solo" : "draft", segType, course.steepness) * (windActive && en.mode === "draft" ? 1.25 : 1) * shelterMul;
        en.energy = Math.min(100, Math.max(ENERGY_FLOOR, en.energy - drain + regen));
      });
    });
    // 4. 履歴記録・ゴール判定
    active.forEach(en => {
      en.posHist[tick] = en.pos; en.energyHist[tick] = en.energy;
      en.modeHist[tick] = en.mode; en.groupHist[tick] = en.groupId; en.slotHist[tick] = en.slot || 0;
      if (en.pos >= course.length && !en.finished) { en.finished = true; en.finishTime = tick * TICK_SEC; }
    });
    tick++;
  }
  // MAX_TICKS到達時点で未ゴールの選手はペースから残り距離を推定して確定
  riders.forEach(en => {
    if (!en.finished) {
      const lastDist = Math.max(0.2, en.lastOwnDist || 0.3);
      const remain = course.length - en.pos;
      en.finishTime = MAX_TICKS * TICK_SEC + (remain / lastDist) * TICK_SEC;
    }
  });
  return tick;
}
// v10: 同一ティック（TICK_SEC未満の差）でゴールした集団を検出し、
// スプリント能力+乱数で現実的な微小タイム差（0〜3秒程度）を付与する。
// ドラフト処理が集団内で完全に同じ移動距離を割り当てるため、そのままだと
// 集団ゴールの選手が文字通り同タイムになり「TOP」表示が乱発してしまう対策。
// ティックシミュレーション本体・観戦アニメーションのposHist等には一切手を加えない。
function resolveFinishClusters(entrants) {
  const sorted = [...entrants].sort((a, b) => a.finishTime - b.finishTime);
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].finishTime - sorted[i].finishTime < TICK_SEC) j++;
    if (j - i > 1) {
      const cluster = sorted.slice(i, j);
      const baseTime = cluster[0].finishTime;
      const scored = cluster.map(en => {
        const jitter = 1 + (Math.random() - 0.5) * 0.16;
        const energyFactor = 0.85 + Math.max(0, Math.min(1, (en.energy + 20) / 120)) * 0.15;
        return { en, score: (en.sprint || 0) * energyFactor * jitter };
      }).sort((a, b) => b.score - a.score);
      const spread = Math.min(3.0, 0.3 * (scored.length - 1));
      scored.forEach((s, k) => {
        const frac = scored.length > 1 ? k / (scored.length - 1) : 0;
        s.en.finishTime = baseTime + frac * spread;
      });
    }
    i = j;
  }
}
// v10: 千切れ選手の遅れ過大バグ対策。優勝タイムの+35%を上限に、それを超える
// finishTimeは丸める（順位はそのまま、表示上のタイム差だけ現実的な範囲に収める）
const MAX_GAP_MUL = 1.35;
function capExcessiveGaps(entrants) {
  if (entrants.length === 0) return;
  const winnerTime = Math.min(...entrants.map(e => e.finishTime));
  const cap = winnerTime * MAX_GAP_MUL;
  entrants.forEach(en => { if (en.finishTime > cap) en.finishTime = cap; });
}
function rankSim(sim) {
  resolveFinishClusters(sim.entrants);
  capExcessiveGaps(sim.entrants);
  sim.ranked = [...sim.entrants].sort((a, b) => a.finishTime - b.finishTime);
  sim.ranked.forEach((e, i) => e.rank = i + 1);
}

// ---------- buildSim：選手構築＋コース生成＋ティックシミュレーション実行 ----------
// fixedAiTeams を渡すとAI選手を再利用する（GCステージレースの2日目用）
// dayTag を渡すとコース生成のシードに反映される（同じraceMetaでも日ごとに別コースにする）
function buildSim(raceMeta, squad, aceId, roles, equip, itemBoost, classIdx, fixedAiTeams, dayTag, directive, difficultyId, rivalAlumni) {
  // v13: 難易度による他チームの強さ補正（aiMul）。省略時はnormal相当
  const diffAiMul = (DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1]).aiMul;
  const course = generateCourse(raceMeta, dayTag);
  const groupMode = groupModeFor(squad.length);
  const riders = [];
  squad.forEach(r => {
    const e = effAbilities(r, equip, itemBoost, raceMeta.grade);
    const role = roles[r.id] || "lead";
    riders.push({
      id: r.id, name: r.name, type: r.type, trait: r.trait, ...e,
      team: "PLAYER", teamName: "あなたのチーム", color: C.yellow,
      isAce: r.id === aceId, role,
    });
  });
  let aiTeamsUsed;
  if (fixedAiTeams) {
    aiTeamsUsed = fixedAiTeams;
    fixedAiTeams.forEach(list => list.forEach(en => riders.push({ ...en })));
  } else {
    const rng = mulberry(Date.now() % 999983);
    const power = (52 + classIdx * 9 + (raceMeta.grade - 1) * 4 + (raceMeta.championship ? 6 : 0)) * diffAiMul;
    // v12: 相手チームの出走人数は自チームの選択人数に連動させず、レース規定の範囲内で
    // チームごとに独立して決める（毎回同じ人数になる不自然さを解消）
    const { squadMin, squadMax } = raceMeta.tmpl;
    // v12バグ修正: 同じレース内で自チーム・他チームの選手が名前被りしないよう、
    // 自チームの名前を最初に登録した「使用済み」集合を全チームで共有しながら生成する
    const nameBanned = new Set(squad.map(r => r.name));
    aiTeamsUsed = RIVAL_TEAMS.map(d => {
      const aiSquadN = squadMin === squadMax ? squadMin : squadMin + Math.floor(rng() * (squadMax - squadMin + 1));
      // v13.1: 解雇後にこのチームへ拾われた元自チーム選手がいれば、実際の能力のまま
      // 優先的に出走させる（フルの新規生成ではなく実データを引き継ぐ）
      const alumni = (rivalAlumni || []).filter(a => a.signedTeam === d.name).slice(0, aiSquadN);
      const alumniIds = new Set(alumni.map(a => a.id));
      const members = alumni.map(a => ({ ...a }));
      for (let i = members.length; i < aiSquadN; i++) members.push(newRider(power + (i === 0 ? 6 : 0), rng, { banned: nameBanned }));
      const aiRoles = assignAIRoles(members, aiSquadN);
      // v12: チームごとに隠しの戦略スタイルを割り当て、レース展開にばらつきを持たせる
      const aiStyle = AI_STYLES[Math.floor(rng() * AI_STYLES.length)];
      return members.map((r, i) => ({
        id: r.id, name: r.name, type: r.type, trait: r.trait,
        flat: r.flat, climb: r.climb, sprint: r.sprint, stamina: r.stamina, solo: r.solo,
        team: d.name, teamName: d.name, color: d.color, isAce: i === 0, role: aiRoles[r.id], aiStyle,
        isAlumnus: alumniIds.has(r.id),
      }));
    });
    aiTeamsUsed.forEach(list => list.forEach(en => riders.push({ ...en })));
  }
  const sim = { entrants: riders, riders, course, groupMode, raceMeta, breakSurvived: false };
  const roleMap = {}; riders.forEach(en => { roleMap[en.id] = en.role; });
  // v12: 無線指示の廃止に伴い、作戦（chaseMode/aceEarly）は出走前に決定済みのものをそのまま渡す
  simulateTicks(course, riders, 0, directive || { chaseMode: "normal", aceEarly: false }, groupMode === "solo");
  rankSim(sim);
  // 逃げ切り判定（表示用）：エントラント中に逃げ役がいて、ゴール時点でメイン集団と別グループのままか
  const breakers = riders.filter(en => en.role === "breakaway");
  sim.hadBreak = breakers.length > 0;
  if (sim.hadBreak) {
    const lastTickIdx = Math.max(...riders.map(en => en.groupHist.length - 1));
    const finalGroups = new Set(riders.map(en => en.groupHist[Math.min(lastTickIdx, en.groupHist.length - 1)]));
    const breakGroupIds = new Set(breakers.map(en => en.groupHist[Math.min(lastTickIdx, en.groupHist.length - 1)]));
    const others = riders.filter(en => en.role !== "breakaway");
    sim.breakSurvived = others.length > 0 && others.every(en => !breakGroupIds.has(en.groupHist[Math.min(lastTickIdx, en.groupHist.length - 1)]));
  }
  return { sim, aiTeams: aiTeamsUsed };
}

// ---------- 成長 ----------
// v9: 成長期の伸びをさらに鈍化（1.25→1.0）。「将来性一択」問題への対処
function growthPhase(r) {
  const [ps, pe] = GROWTH[r.growth].peak;
  if (r.age < ps) return { gain: 1.0, dec: 0, tag: "成長期" };
  if (r.age <= pe) return { gain: 0.5, dec: 0, tag: "全盛期" };
  return { gain: 0.1, dec: Math.min(1.2, 0.25 * (r.age - pe)), tag: "衰え期" };
}

// ---------- UIパーツ ----------
function Btn({ children, onClick, disabled, color = C.yellow, small, outline, style }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        fontFamily: FONT_D, letterSpacing: "0.05em",
        background: disabled ? C.panel2 : outline ? "transparent" : color,
        color: disabled ? "#6b7386" : outline ? color : "#14171d",
        border: outline ? `1.5px solid ${disabled ? "#6b7386" : color}` : "none",
        borderRadius: 6, padding: small ? "6px 12px" : "12px 18px",
        fontSize: small ? 13 : 15, fontWeight: 700, cursor: disabled ? "default" : "pointer",
        width: small ? "auto" : "100%", ...style,
      }}>{children}</button>
  );
}
function Eyebrow({ children, color = C.yellow }) {
  return <div style={{ fontFamily: FONT_D, color, fontSize: 12, letterSpacing: "0.2em", fontWeight: 700 }}>{children}</div>;
}
function FatigueBar({ v }) {
  const col = v >= 90 ? C.red : v >= 60 ? "#e8a13c" : C.green;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: C.line, borderRadius: 3, position: "relative" }}>
        <div style={{ width: `${v}%`, height: 5, background: col, borderRadius: 3 }} />
        <div style={{ position: "absolute", left: "90%", top: -2, width: 1.5, height: 9, background: C.red }} />
      </div>
      <span style={{ fontFamily: FONT_M, fontSize: 11, color: col, width: 26, textAlign: "right" }}>{Math.round(v)}</span>
    </div>
  );
}
function TraitLine({ trait }) {
  if (!trait) return null;
  const t = TRAITS[trait];
  const col = t.bad ? C.red : "#e8a13c";
  return (
    <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>
      <span style={{ color: col, border: `1px solid ${col}`, borderRadius: 4, padding: "0px 5px", marginRight: 5 }}>{t.label}</span>
      {t.desc}
    </div>
  );
}
function PersonaLine({ p }) {
  const per = PERSONALITIES[p];
  if (!per) return null;
  const col = p === "genius" ? C.yellow : C.blue;
  return (
    <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>
      <span style={{ color: col, border: `1px solid ${col}`, borderRadius: 4, padding: "0px 5px", marginRight: 5 }}>性格：{per.label}</span>
      {per.desc}
    </div>
  );
}
function AbilityGrid({ r, cap = 88 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginTop: 6 }}>
      {AB_KEYS.map(k => {
        const partBonus = r.parts ? PART_SLOTS.reduce((s, sl) => s + ((r.parts[sl] && PARTS[r.parts[sl]].ab[k]) || 0), 0) : 0;
        const broke = r[k] >= cap;
        return (
          <div key={k}>
            <div style={{ fontSize: 9.5, color: C.sub }}>{AB_LABEL[k]}</div>
            <div style={{ fontFamily: FONT_M, fontSize: 12.5, color: broke ? C.yellow : C.text }}>
              {Math.round(r[k])}{partBonus > 0 && <span style={{ color: C.purple, fontSize: 10 }}>+{partBonus}</span>}
            </div>
            <div style={{ height: 3, background: C.line, borderRadius: 2 }}>
              <div style={{ height: 3, width: `${Math.min(100, r[k] + partBonus)}%`, background: broke ? C.yellow : AB_COLOR[k], borderRadius: 2 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
// v10: 種目別複合適性スコアの表示（レーダー的な棒グラフ）。highlightKeyを指定すると
// そのレース種別に対応する項目だけ強調表示する（編成画面での「このレースに向いているか」用）
function DisciplineGrid({ r, highlightKey }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginTop: 4 }}>
      {DISCIPLINE_KEYS.map(k => {
        const score = disciplineScore(r, k);
        const hi = k === highlightKey;
        return (
          <div key={k}>
            <div style={{ fontSize: 9.5, color: hi ? C.yellow : C.sub }}>{DISCIPLINES[k].label}{hi ? " ★" : ""}</div>
            <div style={{ fontFamily: FONT_M, fontSize: 12.5, color: hi ? C.yellow : C.text }}>{score}</div>
            <div style={{ height: 3, background: C.line, borderRadius: 2 }}>
              <div style={{ height: 3, width: `${Math.min(100, score)}%`, background: hi ? C.yellow : C.purple, borderRadius: 2 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
function BlurGrid({ blur }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginTop: 6 }}>
      {AB_KEYS.map(k => (
        <div key={k}>
          <div style={{ fontSize: 9.5, color: C.sub }}>{AB_LABEL[k]}</div>
          <div style={{ fontFamily: FONT_M, fontSize: 11.5, color: C.sub }}>{blur[k].min}〜{blur[k].max}</div>
          <div style={{ height: 4, background: C.line, borderRadius: 2, position: "relative" }}>
            <div style={{
              position: "absolute", left: `${blur[k].min}%`, width: `${blur[k].max - blur[k].min}%`,
              height: 4, background: AB_COLOR[k], opacity: 0.55, borderRadius: 2,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
// v7: コース標高グラフ（SVG折れ線）
function ElevationChart({ course }) {
  const W = 520, H = 70, pad = 4;
  const maxE = Math.max(1, ...course.elevationProfile.map(p => p.elev));
  const pts = course.elevationProfile.map(p => {
    const x = pad + p.frac * (W - pad * 2);
    const y = H - pad - (p.elev / maxE) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 56, display: "block" }}>
        <polyline points={`${pad},${H - pad} ${pts} ${W - pad},${H - pad}`} fill="rgba(255,210,63,0.18)" stroke="none" />
        <polyline points={pts} fill="none" stroke={C.yellow} strokeWidth="2" />
      </svg>
      <div style={{ display: "flex", gap: 10, fontSize: 10.5, color: C.sub, marginTop: 2 }}>
        <span>獲得標高目安 {Math.round(course.totalElevationGain)}</span>
        <span>山岳区間 {course.climbCount}</span>
        <span>難易度指数 {course.raceDifficultyRating}</span>
        {course.laps > 1 && <span style={{ color: C.yellow }}>周回コース 全{course.laps}周</span>}
      </div>
    </div>
  );
}
// v14.5: ステージレース（昇格戦・グランツール）は日ごとにコースが変わるが、
// 出走前プレビューは1日分（実質day1相当）しか見えず「本当に日ごとに違うのか」
// 分かりにくいという指摘を受け、全日程の区間バー・標高グラフを横に並べて
// 縦の区切り線で分割した「通し」ビューに差し替える
function MultiStageCourseView({ race }) {
  const stageCount = race.stageCount || (race.stageTmpls ? race.stageTmpls.length : 2);
  const days = Array.from({ length: stageCount }, (_, i) => i + 1);
  const dayCourses = days.map(d => ({
    day: d,
    tmpl: race.stageTmpls ? race.stageTmpls[d - 1] : race.tmpl,
    course: generateCourse(race, `day${d}`),
  }));
  const maxE = Math.max(1, ...dayCourses.flatMap(dc => dc.course.elevationProfile.map(p => p.elev)));
  const W = 520, H = 70, pad = 4;
  const dayW = (W - pad * 2) / stageCount;
  return (
    <div>
      <div style={{ display: "flex", gap: 3, margin: "6px 0 3px" }}>
        {dayCourses.map(dc => (
          <div key={dc.day} style={{ flex: 1, display: "flex", gap: 2 }}>
            {dc.tmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 7, borderRadius: 3, background: SEG_COLOR[s[0]] }} />)}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", fontSize: 10, color: C.sub, marginBottom: 2 }}>
        {dayCourses.map(dc => (
          <div key={dc.day} style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {dc.day}日目・{dc.tmpl.kind}
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 56, display: "block" }}>
        {dayCourses.map(dc => {
          const x0 = pad + (dc.day - 1) * dayW;
          const pts = dc.course.elevationProfile.map(p => {
            const x = x0 + p.frac * dayW;
            const y = H - pad - (p.elev / maxE) * (H - pad * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ");
          return (
            <g key={dc.day}>
              <polyline points={`${x0.toFixed(1)},${H - pad} ${pts} ${(x0 + dayW).toFixed(1)},${H - pad}`} fill="rgba(255,210,63,0.18)" stroke="none" />
              <polyline points={pts} fill="none" stroke={C.yellow} strokeWidth="2" />
            </g>
          );
        })}
        {days.slice(1).map(d => {
          const x = pad + (d - 1) * dayW;
          return <line key={d} x1={x} y1="0" x2={x} y2={H} stroke="#5b6272" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.8" />;
        })}
      </svg>
      <div style={{ display: "flex", gap: 10, fontSize: 10.5, color: C.sub, marginTop: 2, flexWrap: "wrap" }}>
        <span>全{stageCount}日間ステージレース（縦線＝日の区切り）</span>
        <span>獲得標高目安 {Math.round(dayCourses.reduce((s, dc) => s + dc.course.totalElevationGain, 0))}（総合）</span>
      </div>
    </div>
  );
}

// ---------- 3Dレース観戦（v7：ティック履歴を実時間で補間して再生） ----------
function interpFrac(en, rt, course) {
  const idx = rt / TICK_SEC;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  const len = en.posHist.length;
  if (len === 0) return 0;
  const pos = (en.finished && lo >= len - 1)
    ? course.length
    : (() => {
        const a = en.posHist[Math.min(lo, len - 1)];
        const b = en.posHist[Math.min(hi, len - 1)];
        const t = idx - lo;
        return a + (b - a) * t;
      })();
  return course.fracAtPos(pos);
}
function modeAt(en, rt) {
  const idx = Math.min(en.modeHist.length - 1, Math.floor(rt / TICK_SEC));
  return idx >= 0 ? en.modeHist[idx] : "draft";
}
function groupAt(en, rt) {
  const idx = Math.min(en.groupHist.length - 1, Math.floor(rt / TICK_SEC));
  return idx >= 0 ? en.groupHist[idx] : en.id;
}
// v10: ローテーション待ち順（見た目専用。0=牽引中、大きいほど集団後方）
function slotAt(en, rt) {
  const idx = Math.min((en.slotHist || []).length - 1, Math.floor(rt / TICK_SEC));
  return idx >= 0 ? (en.slotHist[idx] || 0) : 0;
}
// v10: 現在のtickまで同じmodeが何tick連続しているか（見た目専用の演出に使う。
// 千切れ始め・アタック開始からの経過を判定するため、modeHistを遡ってカウントするだけで
// シミュレーション本体には手を加えない）
function modeStreakAt(en, rt, mode, cap) {
  const idx = Math.min(en.modeHist.length - 1, Math.floor(rt / TICK_SEC));
  if (idx < 0 || en.modeHist[idx] !== mode) return 0;
  let n = 0;
  for (let i = idx; i >= 0 && i > idx - cap && en.modeHist[i] === mode; i--) n++;
  return n;
}

// v9: コース形状（横揺れ）・標高から、俯瞰マップ用のY座標・側面マップ用のY座標を計算
function topLateral(course, frac) {
  return Math.sin(frac * Math.PI * course.f1 + course.ph1) * course.amp1 + Math.sin(frac * course.f2 + course.ph2) * course.amp2;
}
// v13バグ修正: 俯瞰マップがviewBoxの縦横比とCSS上の実表示サイズの比率が
// 食い違っていたため（デフォルトのpreserveAspectRatio="xMidYMid meet"）、
// 上下に大きな余白（レターボックス）ができて画面を有効に使えておらず、
// 選手の横移動とコース背景の湾曲の連動もその分弱く見えていた。
// マップ自体の縦幅を拡大し、preserveAspectRatio="none"と画面端までの
// ブリード表示を組み合わせてレターボックスを解消する
const MAP_W = 660, TOP_H = 280, SIDE_H = 150, MAP_PAD = 18;
const MAP_BLEED = { width: "calc(100% + 28px)", marginLeft: -14, marginRight: -14 };
// v10: 俯瞰マップ・側面マップを「先頭集団を追従してズームするカメラ」方式に変更。
// 全コースを常時表示するのではなく、まだゴールしていない選手たちの広がりに合わせて
// ズーム幅を自動調整する（競馬のトラッキングシステムのような大きな表示を再現）
const MIN_VIEW_FRAC = 0.035;  // 最大ズーム時に見えるコース幅（集団が固まっている時。v11でさらに拡大）
const MAX_VIEW_FRAC = 0.4;   // 最大ズームアウト時に見えるコース幅（逃げ等で大きく広がった時）
const VIEW_LEAD_BIAS = 0.42;  // 集団の中心を画面の何%の位置に置くか（0.5=中央、小さいほど前方の余白が広がる）
// v11: ゴール直前（最終区間突入後）の演出。カメラを先頭集団だけに絞ってさらに拡大し、
// 時間の進行を遅くしてスプリント勝負を細かく見られるようにする
const SPRINT_MIN_VIEW_FRAC = 0.018; // 最終区間突入後のズーム上限（通常のMIN_VIEW_FRACよりさらに狭い）
// v12: 最終区間突入の時間ベース判定（優勝者の確定タイムの残り何%を「最終区間」とみなすか）
const FINAL_SEG_TIME_RATIO = 0.045;
// v12: シネマティック切り替えの時間ベース判定（最終区間突入よりさらに遅く、ゴール直前に発動）
const CINEMATIC_TIME_RATIO = 0.012;
// v12（簡易リードアウト演出）：エース「発射」の光るリングを見せる時間ベース判定。
// 実際のmode（牽引/ドラフト/単独）は集団のままの一斉スプリントでは終始draftのままなので、
// それとは独立に、最終区間中盤〜シネマティック直前の間を「発射」演出のタイミングとして扱う
// （見た目専用。finishTime等の実データやモード判定には一切影響しない）
const LAUNCH_TIME_RATIO = 0.02;
const SPRINT_SLOWDOWN = 0.4;        // 最終区間突入後、clock進行に掛ける追加の減速係数
function mapX(f, start, end) { return MAP_PAD + ((f - start) / (end - start)) * (MAP_W - MAP_PAD * 2); }
// v12: 俯瞰マップの再設計。以前は道自体がS字カーブの絶対座標として描かれ、選手もその
// 曲がりをなぞって斜めに進んでいるように見えた。選手の見た目の移動は常に真横固定にし
// （下のridersUi描画側でTOP_H/2の固定水平帯を使う）、代わりに背景の道をコースの
// 曲がり具合に応じて回転させることで「曲がっている感じ」を表現する。
// topLateral()の値をそのまま「その地点での進行方向の角度」とみなし、frac方向に
// 一定歩幅で歩きながら向きを変えていく（タートルグラフィックス方式）ことで、
// 道自体が回転・カーブするリボンとして描かれる（選手の位置とは独立）
const TOP_CURVE_MAX_ANGLE = 0.5; // 道の見た目上の最大傾き（ラジアン）
function courseAngleAt(course, frac) {
  const range = course.amp1 + course.amp2 || 1;
  return (topLateral(course, frac) / range) * TOP_CURVE_MAX_ANGLE;
}
// v14.9: 選手が常に真横（TOP_H/2固定）に動く一方、道自体は最大±0.5ラジアンも
// 回転するため、道が曲がっているのに選手だけ直線的に横切って見える違和感があった。
// pathの文字列に加えて、任意のfracにおける「その地点の道のY座標」を返すyAt()も
// 一緒に返すようにし、選手の描画位置をこの道のY座標に軽く追従させられるようにする
function buildTopPath(course, start, end) {
  const N = 60;
  const step = (end - start) / N;
  const pxPerStep = (MAP_W - MAP_PAD * 2) / N;
  const raw = [{ x: 0, y: 0 }];
  let x = 0, y = 0;
  for (let i = 1; i <= N; i++) {
    const f = start + i * step;
    const angle = courseAngleAt(course, f);
    x += Math.cos(angle) * pxPerStep;
    y += Math.sin(angle) * pxPerStep;
    raw.push({ x, y });
  }
  // 画面中央（表示範囲の中点）を基準点とし、そこが選手たちの固定水平帯（TOP_H/2）の
  // ちょうど画面中央に来るよう全体を平行移動する
  const anchorIdx = Math.round(N / 2);
  const anchor = raw[anchorIdx];
  const anchorScreenX = mapX((start + end) / 2, start, end);
  // 縦方向の累積が表示枠からはみ出さないよう、必要な場合のみ一様に縮めて収める
  const allowedY = TOP_H / 2 - 20;
  const maxAbsY = Math.max(1, ...raw.map(p => Math.abs(p.y - anchor.y)));
  const yScale = Math.min(1, allowedY / maxAbsY);
  const path = raw.map(p => `${(anchorScreenX + (p.x - anchor.x)).toFixed(1)},${(TOP_H / 2 + (p.y - anchor.y) * yScale).toFixed(1)}`).join(" ");
  const yAt = (frac) => {
    const clamped = Math.min(end, Math.max(start, frac));
    const idxF = (clamped - start) / step;
    const i0 = Math.max(0, Math.min(N, Math.floor(idxF)));
    const i1 = Math.min(N, i0 + 1);
    const t = idxF - i0;
    const yInterp = raw[i0].y + (raw[i1].y - raw[i0].y) * t;
    return TOP_H / 2 + (yInterp - anchor.y) * yScale;
  };
  return { path, yAt };
}
function buildSidePath(course, start, end) {
  const maxElev = Math.max(1, ...course.elevationProfile.map(p => p.elev));
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const f = start + t * (end - start);
    const y = SIDE_H - 16 - (course.yAt(f) / maxElev) * (SIDE_H - 32);
    pts.push(`${(MAP_PAD + t * (MAP_W - MAP_PAD * 2)).toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}
// v10: 見た目専用の演出パラメータ（実際のレース結果には一切影響しない）
const DROP_TRANSITION_TICKS = 6; // 千切れ直後、集団後方へ寄っていく演出の長さ（tick数）
const DROP_EXTRA_LANE = 7;       // 千切れ演出の最大オフセット（横方向、SVG px）
const DROP_EXTRA_DX_RATIO = 0.03; // 千切れ演出の最大オフセット（前後方向、現在のカメラ幅spanに対する比率）
const ATTACK_VISUAL_TICKS = 8;   // アタック開始直後、前方への誇張演出の長さ（tick数）
const ATTACK_EXAGGERATION = 0.014; // アタック演出の最大frac誇張量
// v12: 俯瞰マップの隊列表現を「slotに応じた1次元的なレーン+前後オフセット」から、
// 実際のロードレースの隊列力学（巡航時は団子状、高強度時は縦一列、横風時はエシュロン）に
// 基づく2次元モデルへ刷新。当初は全選手が同じ楕円軌道を位相だけずらして回る方式にしたが、
// 「ビーズが同じ線路を周回しているようで不自然」というフィードバックを受け、
// 各選手が完全に独立した固有の揺らぎ（周波数・位相とも選手ごとに異なる）で
// 集団の中を漂うモデルに変更。誰が今pull中かのだいたいの前後バイアスだけはslotから
// 緩やかに追従させるが、全員が同じ経路をなぞることは一切ない
const PACK_LEN_BASE = 0.028;      // 縦方向の広がりの基準値（現在のカメラ幅spanに対する比率）
const PACK_LEN_PER_MEMBER = 0.003; // 縦方向の広がり：グループの人数1人あたりの増分（比率）
const PACK_WIDTH_BASE = 6;       // 横方向の広がりの基準値（SVG px）
const PACK_WIDTH_PER_MEMBER = 1.1; // 横方向の広がり：グループの人数1人あたりの増分（SVG px）
const PACK_MAX_MEMBERS_FOR_SCALE = 10; // 広がりの拡大が頭打ちになる人数
// 区間タイプごとの「伸縮度」（0=団子状に横に広がる、1=縦に伸びた単騎列）
const ELONGATION_BY_SEG = { flat: 0.15, hill: 0.45, climb: 0.7, mtn: 0.8, sprint: 0.85, tt: 0.6 };
const PACK_TILT_MAX_RAD = 0.7; // 横風エシュロン時の隊列の傾き（約40度）
const PACK_BIAS_EASE = 0.06;    // 前後バイアス（誰が前寄りか）が新しいslotへ追従する速さ（毎フレーム）
// v12バグ修正: 山岳突入など地形（区間タイプ）が切り替わった瞬間、隊列の伸び・傾きが
// 即座に新しい値へ飛んでしまい、選手が急にワープしたように見えるバグがあった。
// biasXと同様に毎フレーム緩やかに追従させることで、区間の変わり目でも滑らかに変化させる
const PACK_ELONG_EASE = 0.035;
const PACK_WANDER_FREQ_X = 0.16; // 独立揺らぎの基準周波数（Hz、前後方向）
const PACK_WANDER_FREQ_Y = 0.12; // 独立揺らぎの基準周波数（Hz、左右方向）
function riderHash01(id, salt) { return ((id * 2654435761 + salt * 40503) % 100000) / 100000; }
// 選手固有の周波数・位相で滑らかに漂う疑似ランダム波形（他の選手とは同期しない）
function riderWander(id, salt, tSec, baseFreq) {
  const h1 = riderHash01(id, salt), h2 = riderHash01(id, salt + 1);
  const f1 = baseFreq * (0.6 + h1 * 0.8);
  const f2 = f1 * (1.7 + h2 * 0.6);
  return 0.65 * Math.sin(tSec * f1 * Math.PI * 2 + h1 * Math.PI * 2)
       + 0.35 * Math.sin(tSec * f2 * Math.PI * 2 + h2 * Math.PI * 2);
}

// v12: 最終直線の高完成度2Dシネマティック演出。結果（着順・着差）は既に確定済みなので、
// 実際のtickデータを逐次描画するのではなく、確定済みの着差から逆算して滑らかな
// スプリント演出を振り付ける（実際の着順・着差は一切変えない、魅せ方のみ）
const SPRINT_CONTENDER_GAP_SEC = 12;  // この秒差以内の選手をスプリント演出の対象にする
const SPRINT_MAX_CONTENDERS = 8;      // 演出に登場させる選手数の上限
const SPRINT_CINEMATIC_MS = 4200;     // 演出の所要時間（実時間ミリ秒）
const SPRINT_MAX_SPREAD = 0.42;       // 最大着差の選手がゴールライン手前どこまでで止まるか（0=ライン上、1=スタート地点）
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function FinalSprintCinematic({ contenders }) {
  const [now, setNow] = useState(() => performance.now());
  const startRef = useRef(performance.now());
  useEffect(() => {
    let raf;
    const loop = () => { setNow(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const t = Math.min(1, (now - startRef.current) / SPRINT_CINEMATIC_MS);
  const eased = easeOutCubic(t);
  const maxGap = Math.max(0.5, ...contenders.map(c => c.gapSec));
  const W = 200, H = 300, topY = 34, bottomY = H - 18;
  const fadeOpacity = Math.max(0, 1 - t * 5); // 冒頭の暗転からのフェードイン
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 300, background: "linear-gradient(#3f5a3a,#26361f)", borderRadius: 8, display: "block" }}>
        <line x1={W / 2} y1={topY - 14} x2={W / 2} y2={H} stroke="#8a8f98" strokeWidth="70" strokeLinecap="round" />
        <line x1={W / 2 - 44} y1={topY} x2={W / 2 + 44} y2={topY} stroke="#fff" strokeWidth="4" strokeDasharray="6,4" />
        <text x={W / 2} y={topY - 18} textAnchor="middle" fontSize="16">🏁</text>
        {contenders.map((c, i) => {
          const finalPos = 1 - Math.min(1, c.gapSec / maxGap) * SPRINT_MAX_SPREAD;
          const y = bottomY - finalPos * eased * (bottomY - topY);
          const wobble = Math.sin(now / 260 + i * 1.7) * (1 - eased) * 9;
          const x = W / 2 + (i - (contenders.length - 1) / 2) * 11 + wobble;
          return (
            <g key={c.id} transform={`translate(${x},${y})`}>
              <circle r={c.isAce ? 8 : 6} fill={c.color} stroke="#14171d" strokeWidth="1.5" />
              {c.isPlayer && <circle r="2" fill="#14171d" />}
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: fadeOpacity, borderRadius: 8, pointerEvents: "none" }} />
      <div style={{ fontSize: 10.5, color: C.sub, textAlign: "center", marginTop: 4 }}>{contenders.length > 1 ? "🏁 ゴールスプリント" : "🏁 単独ゴール"}</div>
    </div>
  );
}
function RaceView({ sim, onFinish }) {
  const [hud, setHud] = useState({ top: [], seg: "", clock: 0, done: false, comment: "", gap: null });
  const [ridersUi, setRidersUi] = useState([]);
  const [cam, setCam] = useState({ start: 0, end: MIN_VIEW_FRAC });
  const [camMode, setCamMode] = useState("lead"); // v11: "lead" または自チーム選手id（選手フィーチャー）
  const camModeRef = useRef("lead");
  // v12: 無線指示（追走強化/静観/エース早期発射）は出走前の「作戦」選択に一本化し廃止。
  // 観戦画面はカメラ操作のみの純粋な観戦専用画面になった
  const [finalSeg, setFinalSeg] = useState(false); // 最終区間突入フラグ（カメラの超ズーム・スロー演出のトリガー）
  const [cinematic, setCinematic] = useState(null); // v12: 最終直線シネマティック演出のスナップショット（一度だけ計算）
  const speedRef = useRef(1);
  const [speedUi, setSpeedUi] = useState(1);
  const skipRef = useRef(false);
  const tickRef = useRef(null);
  const rtRef = useRef(0);
  const totalRef = useRef(1);
  const finalSegRef = useRef(false);
  const cinematicRef = useRef(false);
  const [launching, setLaunching] = useState(false); // v12（簡易リードアウト演出）：エース発射の光るリング表示フラグ
  const launchingRef = useRef(false);
  const liveRef = useRef({ text: "", until: 0 });
  const PLAY_DUR = 40;
  const course = sim.course;

  // v11: カメラの選手フィーチャー切替（自チーム選手のみ対象、結果ロック後も切替は常に可能）
  const playerRoster = useMemo(() => sim.entrants.filter(e => e.team === "PLAYER"), [sim]);
  const selectCam = (mode) => {
    if (mode === camMode) return;
    camModeRef.current = mode;
    setCamMode(mode);
  };

  const { path: topPath, yAt: topRoadYAt } = useMemo(() => buildTopPath(course, cam.start, cam.end), [sim, cam.start, cam.end]);
  const sidePath = useMemo(() => buildSidePath(course, cam.start, cam.end), [sim, cam.start, cam.end]);
  // v14.9: 選手を道のカーブに軽く追従させ、道が曲がっているのに選手が直線的に
  // 横切って見える違和感を緩和する。1.0にすると道の曲がりに完全一致するが、
  // それだと以前（v11以前）の「選手が斜めに動いて不自然」という問題が再発するため、
  // 控えめな追従量に留める
  const RIDER_CURVE_FOLLOW = 0.4;
  const riderTopY = (frac, dy) => TOP_H / 2 + (topRoadYAt(frac) - TOP_H / 2) * RIDER_CURVE_FOLLOW + dy;
  // v12: フィニッシュフラグは道の曲がりとは独立に、常に固定の水平帯（TOP_H/2）上に描く
  const sideYAt = (f) => { const maxElev = Math.max(1, ...course.elevationProfile.map(p => p.elev)); return SIDE_H - 16 - (course.yAt(f) / maxElev) * (SIDE_H - 32); };

  // v12: 集団の隊列シェイプを毎レンダー計算する。各選手は共有の軌道をなぞるのではなく、
  // 選手ごとに周波数・位相が異なる独立した揺らぎで集団の中を漂う（他の選手と同期しない）。
  // 前後のだいたいの位置取り（誰が前寄りか）だけはslotから緩やかに追従するbiasXに従う
  const packTSec = performance.now() / 1000;
  const packGroupSize = {};
  ridersUi.forEach(r => { packGroupSize[r.gid] = (packGroupSize[r.gid] || 0) + 1; });
  const packShape = {};
  ridersUi.forEach(r => {
    const n = packGroupSize[r.gid] || 1;
    const dropRatio = r.dropStreak > 0 ? Math.min(1, r.dropStreak / DROP_TRANSITION_TICKS) : 0;
    if (n <= 1 || r.mode === "attack" || r.frac >= 1) { packShape[r.id] = { dx: 0, dy: 0 }; return; }
    // v12バグ修正: 区間タイプから生で計算するのではなく、tickループ側で毎フレーム緩やかに
    // 追従させたr.elong/r.tiltを使う（山岳突入などの瞬間にワープしないようにするため）
    const elong = r.elong ?? ELONGATION_BY_SEG.flat;
    const tilt = r.tilt ?? 0;
    const span = cam.end - cam.start;
    const nCap = Math.min(n, PACK_MAX_MEMBERS_FOR_SCALE);
    const L = (PACK_LEN_BASE + nCap * PACK_LEN_PER_MEMBER) * (1 + elong * 2.2) * span;
    const W = (PACK_WIDTH_BASE + nCap * PACK_WIDTH_PER_MEMBER) * (1 - elong * 0.5);
    // 選手固有の独立した揺らぎ（前後・左右とも他の選手とは違う周波数・位相）
    const wanderX = riderWander(r.id, 1, packTSec, PACK_WANDER_FREQ_X);
    const wanderY = riderWander(r.id, 5, packTSec, PACK_WANDER_FREQ_Y);
    const ex = L * Math.max(-1, Math.min(1, r.biasX * 0.55 + wanderX * 0.6));
    const ey = W * wanderY;
    // v12バグ修正: exはコース位置（frac）単位、eyは画面ピクセル単位で、そのままではスケールが
    // 全く異なる（exは0.03前後、eyは数〜十数px）。横風のtilt回転で両者を直接混ぜると、
    // dx（frac単位のまま後でmapXにより数百px/fracに再拡大される）にピクセル単位の値が
    // 漏れ込み、画面外まで吹き飛ぶ選手が出るバグになっていた。回転はピクセル単位に揃えてから行い、
    // 結果のx成分だけをfrac単位に戻す
    const pxPerFrac = (MAP_W - MAP_PAD * 2) / Math.max(span, 1e-4);
    const exPx = ex * pxPerFrac;
    let dxPx = exPx * Math.cos(tilt) - ey * Math.sin(tilt);
    let dy = exPx * Math.sin(tilt) + ey * Math.cos(tilt);
    let dx = dxPx / pxPerFrac;
    // 千切れかけの選手は揺らぎを徐々にフェードアウトしつつ後方へドリフトし、単独走に見せる
    dx = dx * (1 - dropRatio) - dropRatio * DROP_EXTRA_DX_RATIO * span;
    dy = dy * (1 - dropRatio) + dropRatio * DROP_EXTRA_LANE;
    packShape[r.id] = { dx, dy };
  });
  // v12: 俯瞰マップ上の実際の画面座標（簡易リードアウト演出の牽引線描画に使う）
  const packPoint = (r) => {
    const { dx, dy } = packShape[r.id] || { dx: 0, dy: 0 };
    const attackBonus = r.attackStreak > 0 ? (1 - r.attackStreak / ATTACK_VISUAL_TICKS) * ATTACK_EXAGGERATION : 0;
    const drawFrac = Math.min(1, r.frac + attackBonus);
    return { x: mapX(drawFrac + dx, cam.start, cam.end), y: riderTopY(drawFrac + dx, dy) };
  };
  // v12（簡易リードアウト演出）：自チームのエースを、同じ集団内で牽引中の自チームアシストが
  // いれば「牽引中」として線で結び、牽引が外れた瞬間（エースがdraft以外になった瞬間）に
  // 最終区間内であれば「発射」の光るリングを出す。実データ（finishTime等）には無関係の
  // 見た目専用演出
  const playerAce = ridersUi.find(r => r.isPlayer && r.isAce);
  const playerLeadout = playerAce && playerAce.mode === "draft"
    ? ridersUi.find(r => r.isPlayer && !r.isAce && r.mode === "pull" && r.gid === playerAce.gid)
    : null;

  useEffect(() => {
    const riders = sim.entrants.map((e) => ({
      e, frac: 0, mode: "draft", gid: e.id, slot: 0, dropStreak: 0, attackStreak: 0,
      // v12: エースのみ黄色を使い、他のAI含む何色とも被らないようにする。
      // 自チームのアシストは白系（他チームは赤/青/紫/橙）で「自分のチーム」だと一目でわかるようにする
      color: e.team === "PLAYER" ? (e.isAce ? C.yellow : "#eef1f6") : e.color,
      biasX: -0.3, // v12: 前後バイアス（誰が前寄りか）。slotに応じて緩やかに追従する永続値
      elong: ELONGATION_BY_SEG.flat, tilt: 0, // v12バグ修正: 隊列の伸び・傾きも同様に緩やかに追従させる
    }));

    totalRef.current = Math.max(...sim.entrants.map(e => e.finishTime));
    const baseEvents = [];
    course.segs.forEach((s, j) => {
      const fracStart = j === 0 ? 0 : course.cumFrac[j - 1];
      baseEvents.push({ t: fracStart, text: s.wind ? `🌬 ${s.label}へ突入！横風区間：集団分裂に注意` : `🎙 ${s.label}へ突入！` });
    });
    baseEvents.push({ t: 0.985, text: "🎙 フィニッシュ！" });

    let clock = 0, prev = performance.now(), done = false, lastHud = 0, intervalId = null;
    const tick = () => {
      if (done) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (skipRef.current) clock = PLAY_DUR;
      else {
        // v11: 最終区間突入後はスプリント演出のため進行を追加で減速（スキップ時は対象外）
        const slowFactor = finalSegRef.current ? SPRINT_SLOWDOWN : 1;
        clock = Math.min(PLAY_DUR, clock + dt * speedRef.current * slowFactor);
      }
      const rt = (clock / PLAY_DUR) * totalRef.current;
      rtRef.current = rt;
      let leadFrac = 0;
      riders.forEach((r) => {
        r.frac = interpFrac(r.e, rt, course);
        r.gid = groupAt(r.e, rt);
        r.mode = modeAt(r.e, rt);
        r.slot = slotAt(r.e, rt);
        // v12: 前後バイアス（誰が前寄りか）はslot/modeから決まる目標値へ毎フレーム緩やかに
        // 追従させる（瞬間移動を避けるため）。実際に集団の中を漂う揺らぎは描画時に加える
        const targetBiasX = r.mode === "pull" ? 0.85 : Math.max(-0.85, 0.7 - r.slot * 0.4);
        r.biasX += (targetBiasX - r.biasX) * PACK_BIAS_EASE;
        // v12バグ修正: 隊列の伸び・傾きも地形の変わり目でワープしないよう、目標値へ
        // 毎フレーム緩やかに追従させる（描画側では生の区間タイプから直接計算しない）
        const segInfoNow = course.segTypeAt(r.frac * course.length);
        const targetElong = Math.min(1, (ELONGATION_BY_SEG[segInfoNow.type] ?? 0.15) + (segInfoNow.wind ? 0.25 : 0));
        const targetTilt = segInfoNow.wind ? segInfoNow.windDir * PACK_TILT_MAX_RAD : 0;
        r.elong += (targetElong - r.elong) * PACK_ELONG_EASE;
        r.tilt += (targetTilt - r.tilt) * PACK_ELONG_EASE;
        r.dropStreak = modeStreakAt(r.e, rt, "solo", DROP_TRANSITION_TICKS);
        r.attackStreak = modeStreakAt(r.e, rt, "attack", ATTACK_VISUAL_TICKS);
        if (r.frac > leadFrac) leadFrac = r.frac;
      });
      // v10: カメラズーム。ゴール済みの選手は枠決めの対象から外し、まだ走っている選手の
      // 広がりに合わせてズーム幅を自動調整する（先頭に少し前方の余白を持たせる）
      // v11: 「ゴール済み」は静的なen.finished（precompute直後は常にtrue）ではなく、
      // 現在の再生時刻rtがfinishTimeを過ぎたかどうかで判定する（実際にライブで通過したか）
      {
        const liveFinished = (en) => rt >= en.finishTime;
        const unfinished = riders.filter(r => !liveFinished(r.e));
        let framing = unfinished.length > 0 ? unfinished : riders;
        // v11: 選手フィーチャー中は、その選手と同じ集団だけで枠を決める
        if (camModeRef.current !== "lead") {
          const focus = riders.find(r => r.e.id === camModeRef.current);
          if (!focus || liveFinished(focus.e)) {
            if (camModeRef.current !== "lead") {
              camModeRef.current = "lead";
              setCamMode("lead");
              liveRef.current = { text: "📻 フィーチャー選手がゴール、先頭集団表示に切替", until: performance.now() + 3000 };
            }
          } else {
            const sameGroup = riders.filter(r => r.gid === focus.gid);
            if (sameGroup.length > 0) framing = sameGroup;
          }
        }
        // v11: 最終区間突入後、先頭集団追従モードに限り先頭集団（最高fracと同じgid）だけに絞り、
        // スプリント勝負に寄せる（選手フィーチャー中はその選手の集団のまま）
        if (finalSegRef.current && camModeRef.current === "lead") {
          const leadGid = framing.reduce((best, r) => (r.frac > best.frac ? r : best), framing[0]).gid;
          const leadOnly = framing.filter(r => r.gid === leadGid);
          if (leadOnly.length > 0) framing = leadOnly;
        }
        const fracs = framing.map(r => r.frac);
        const maxF = Math.max(...fracs), minF = Math.min(...fracs);
        const spreadF = maxF - minF;
        const center = (maxF + minF) / 2;
        let span = Math.min(MAX_VIEW_FRAC, Math.max(MIN_VIEW_FRAC, spreadF * 1.6));
        if (finalSegRef.current) span = Math.min(span, SPRINT_MIN_VIEW_FRAC);
        // v12バグ修正: 逃げとメイン集団の差が開きMAX_VIEW_FRAC（最大ズームアウト幅）を
        // 超えると、上のMath.minでspanが実際に必要な幅より狭く決まってしまい、
        // 「先頭集団」カメラで追っているはずの選手がキャンバス範囲外（画面右側など）に
        // 押し出されて見えなくなるバグがあった。安全マージンを削ってでも全員が必ず
        // 表示範囲に収まるよう、実際の広がりを下回らない値まで引き上げる
        span = Math.max(span, spreadF + 0.01);
        let start = center - span * VIEW_LEAD_BIAS;
        let end = start + span;
        if (start < 0) { start = 0; end = Math.min(1, span); }
        // v11: 意図的にend>1をクランプしない。MAX_TICKS到達により選手のfracは実際には
        // ちょうど1.0までは届かない（数%手前で打ち切られる）ため、endを無理に1へスナップさせると
        // 実際の先頭選手とゴールフラッグの間に不自然な空白ができてしまう。end>1のままにしておけば
        // フラッグは（実際の先頭選手との距離に応じて）自然に画面の内側寄りに表示される
        setCam({ start, end });
      }
      // 最終区間突入判定
      // v12: 位置ベース（最終区間に実際に入ったか）に加えて時間ベースの判定もOR条件で追加。
      // MAX_TICKS到達により、山岳など遅いレースでは選手の位置が実際には最終区間まで
      // 到達しないままfinishTimeが外挿で確定してしまうことがあり、位置ベースの判定だけでは
      // 山岳ゴール等で最終区間演出が一度も発火しない不具合があったための対策
      if (!finalSegRef.current) {
        const posBasedFinal = riders.some(r => course.segTypeAt(r.frac * course.length).idx >= course.finalIdx);
        const winnerFinishTime = Math.min(...riders.map(r => r.e.finishTime));
        const timeBasedFinal = rt >= winnerFinishTime * (1 - FINAL_SEG_TIME_RATIO);
        const anyInFinal = posBasedFinal || timeBasedFinal;
        if (anyInFinal) {
          finalSegRef.current = true; setFinalSeg(true);
          // v11: 最終区間突入をはっきり体感できるよう、切り替わりの瞬間にバナー表示する
          liveRef.current = { text: "🏁 ラストスパート突入！カメラをズームして追跡します", until: now + 3000 };
        }
      }
      // v12: シネマティックへの切り替えは最終区間突入よりさらに後（ゴール直前）に遅らせる。
      // 同時に発火させると、通常の俯瞰マップで見えるリードアウト演出（牽引線・エース発射）が
      // 表示される間もなくシネマティックに切り替わってしまうため
      // v12（簡易リードアウト演出）：エース発射の光るリング。実際のmodeは一斉スプリントだと
      // 終始draftのままなので、mode変化ではなく時間ベースでこのタイミングを演出する
      if (finalSegRef.current && !launchingRef.current) {
        const winnerFinishTime = Math.min(...riders.map(r => r.e.finishTime));
        if (rt >= winnerFinishTime * (1 - LAUNCH_TIME_RATIO)) {
          launchingRef.current = true; setLaunching(true);
        }
      }
      if (finalSegRef.current && !cinematicRef.current) {
        const winnerFinishTime = Math.min(...riders.map(r => r.e.finishTime));
        if (rt >= winnerFinishTime * (1 - CINEMATIC_TIME_RATIO)) {
          cinematicRef.current = true;
          // v12: 最終直線シネマティック演出用に、結果が既に確定済みの着順・着差をスナップショットする
          // （実際のfinishTimeから逆算するだけで、シミュレーション自体には一切手を加えない）
          const sortedByFinish = [...riders].sort((a, b) => a.e.finishTime - b.e.finishTime);
          const winnerTime = sortedByFinish[0].e.finishTime;
          const contenders = sortedByFinish
            .filter(r => r.e.finishTime - winnerTime < SPRINT_CONTENDER_GAP_SEC)
            .slice(0, SPRINT_MAX_CONTENDERS)
            .map(r => ({ id: r.e.id, name: r.e.name, color: r.color, isAce: r.e.isAce, isPlayer: r.e.team === "PLAYER", gapSec: r.e.finishTime - winnerTime }));
          setCinematic({ contenders });
        }
      }
      setRidersUi(riders.map(r => ({
        id: r.e.id, frac: r.frac, mode: r.mode, color: r.color, isAce: r.e.isAce, isPlayer: r.e.team === "PLAYER",
        gid: r.gid, slot: r.slot, dropStreak: r.dropStreak, attackStreak: r.attackStreak, biasX: r.biasX,
        elong: r.elong, tilt: r.tilt,
      })));
      if (now - lastHud > 300 || clock >= PLAY_DUR) {
        lastHud = now;
        const sorted = [...riders].sort((a, b) => b.frac - a.frac);
        const top = sorted.slice(0, 5).map(r => ({ name: r.e.name, team: r.e.team, gap: (sorted[0].frac - r.frac) * totalRef.current }));
        let segLabel = course.segs[course.segs.length - 1].label;
        for (let j = 0; j < course.segs.length; j++) { if (leadFrac <= course.cumFrac[j] + 1e-6) { segLabel = course.segs[j].label; break; } }
        let comment = "";
        if (liveRef.current.until > now) comment = liveRef.current.text;
        else {
          const ev = [...baseEvents].reverse().find(e => e.t <= leadFrac + 1e-4);
          comment = ev ? ev.text : "";
        }
        // ライブギャップ表示（逃げ集団 vs 追走）：先頭グループと2番手グループの位置差を秒換算
        let gapText = null;
        const gidSet = [...new Set(sorted.map(r => r.gid))];
        if (sim.groupMode !== "solo" && gidSet.length > 1) {
          const leadG = sorted[0].gid;
          const chaseR = sorted.find(r => r.gid !== leadG);
          if (chaseR) gapText = `逃げとメインのギャップ：約${Math.max(0, Math.round((sorted[0].frac - chaseR.frac) * totalRef.current))}秒`;
        }
        const isDone = clock >= PLAY_DUR;
        const lap = course.laps > 1 ? course.lapAtFrac(leadFrac) : null;
        setHud({ top, seg: segLabel, clock: rt, done: isDone, comment, gap: gapText, lap });
        if (isDone && !done) { done = true; if (intervalId) clearInterval(intervalId); return; }
      }
    };
    // requestAnimationFrameはタブが非表示/非フォーカス時にブラウザが完全停止させることがあり、
    // その場合スキップボタンも巻き添えで無反応になってしまう。setIntervalは強くスロットルされることは
    // あっても完全停止はしないため、進行不能を避けるためこちらを使う。
    // さらに、tickRef経由でスキップボタンからtick()を直接同期呼び出しできるようにし、
    // ブラウザの長時間バックグラウンド時のタイマー完全凍結にも耐えられるようにする
    tickRef.current = tick;
    intervalId = setInterval(tick, 33);
    return () => {
      tickRef.current = null;
      clearInterval(intervalId);
    };
  }, [sim]);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ background: C.panel2, borderLeft: `4px solid ${C.yellow}`, borderRadius: 6, padding: "6px 10px" }}>
          <div style={{ fontFamily: FONT_D, fontSize: 12, color: C.yellow }}>{hud.seg}{hud.lap ? `（${hud.lap}/${sim.course.laps}周）` : ""}</div>
          <div style={{ fontFamily: FONT_M, fontSize: 14, color: C.text }}>{fmtTime(hud.clock)}</div>
          {hud.gap && <div style={{ fontFamily: FONT_M, fontSize: 10.5, color: C.green, marginTop: 2 }}>{hud.gap}</div>}
        </div>
        <div style={{ background: C.panel2, borderRadius: 6, padding: "6px 10px", minWidth: 165 }}>
          {hud.top.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
              <span style={{ color: r.team === "PLAYER" ? C.yellow : C.text }}>{i + 1}. {r.name}{r.team === "PLAYER" ? " ●" : ""}</span>
              <span style={{ fontFamily: FONT_M, color: C.sub }}>{fmtGap(r.gap)}</span>
            </div>
          ))}
        </div>
      </div>
      {!cinematic && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[{ id: "lead", label: "🎥 先頭集団" }, ...playerRoster.map(e => ({ id: e.id, label: `🎥 ${e.name.split(" ")[0]}${e.isAce ? " 👑" : ""}` }))].map(o => (
          <button key={o.id} onClick={() => selectCam(o.id)}
            style={{
              padding: "4px 8px", borderRadius: 12, fontSize: 10.5, fontWeight: 700, fontFamily: FONT_D, cursor: "pointer",
              background: camMode === o.id ? C.yellow : C.panel2, color: camMode === o.id ? "#14171d" : C.sub,
              border: `1px solid ${camMode === o.id ? C.yellow : C.line}`,
            }}>{o.label}</button>
        ))}
      </div>}
      {cinematic ? (
        <div>
          <Eyebrow color={C.red}>{cinematic.contenders.length > 1 ? "🏁 ゴールスプリント — 最終直線" : "🏁 単独ゴール — 最終直線"}</Eyebrow>
          <FinalSprintCinematic contenders={cinematic.contenders} />
        </div>
      ) : (
        <>
          <div>
            <Eyebrow color={finalSeg ? C.red : C.sub}>{finalSeg ? "🏁 ラストスパートズーム — 俯瞰マップ" : "俯瞰マップ（コースの左右の揺れ）"}</Eyebrow>
            <svg viewBox={`0 0 ${MAP_W} ${TOP_H}`} preserveAspectRatio="none" style={{ ...MAP_BLEED, boxSizing: "border-box", aspectRatio: `${MAP_W} / ${TOP_H}`, background: "#3f5a3a", borderRadius: 8, marginTop: 4, border: finalSeg ? `2px solid ${C.red}` : "2px solid transparent", transition: "border-color 0.2s" }}>
              {/* v12: 集団の2次元的な広がり（団子状〜エシュロン時の斜め隊列）に対して
                  道幅が狭すぎて選手がはみ出て見える問題を修正するため大幅に拡張。
                  さらに拡張してほしいという追加フィードバックを繰り返し受け再拡大。
                  v14.4: 固定height指定とviewBoxの縦横比が食い違い、画面幅次第で
                  横方向に伸縮するアスペクト比崩れが発生していたため、CSSのaspect-ratio
                  でviewBoxと同じ比率を強制する形に修正（あわせて道幅もさらに拡大） */}
              <polyline points={topPath} fill="none" stroke="#8a8f98" strokeWidth="190" strokeLinecap="round" />
              <polyline points={topPath} fill="none" stroke="#7a7f88" strokeWidth="1" strokeDasharray="6,5" opacity="0.5" />
              <circle cx={mapX(1, cam.start, cam.end)} cy={riderTopY(1, 0)} r="4" fill={C.red} />
              {/* v12（簡易リードアウト演出）：自チームのアシストがエースを牽引中なら線で結ぶ */}
              {playerLeadout && (() => {
                const p1 = packPoint(playerLeadout), p2 = packPoint(playerAce);
                return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={C.yellow} strokeWidth="1.2" strokeDasharray="3,2" opacity="0.65" />;
              })()}
              {ridersUi.map(r => {
                // v12: 隊列シェイプ（楕円軌道）由来の2次元オフセット。千切れ演出・アタック誇張は
                // packShape計算に統合済み（アタック中はdx=dy=0で、前方誇張はdrawFrac側で処理）
                const { dx, dy } = packShape[r.id] || { dx: 0, dy: 0 };
                const attackBonus = r.attackStreak > 0 ? (1 - r.attackStreak / ATTACK_VISUAL_TICKS) * ATTACK_EXAGGERATION : 0;
                const drawFrac = Math.min(1, r.frac + attackBonus);
                // v12（簡易リードアウト演出）：最終区間の終盤（シネマティック直前）を
                // 自チームエース「発射」の瞬間として光らせる。一斉スプリントだと実際の
                // modeは終始draftのままなので、mode変化ではなく時間ベースの演出にしている。
                // ただし、エースが千切れて先頭集団のカメラ枠外にいる場合は「発射」の意味がない
                // （画面外に光るリングが出てしまう）ため、現在の表示範囲内にいる時だけ光らせる
                const isLaunching = launching && r.isPlayer && r.isAce
                  && drawFrac >= cam.start - 0.01 && drawFrac <= cam.end + 0.01;
                return (
                  <g key={r.id} transform={`translate(${mapX(drawFrac + dx, cam.start, cam.end)},${riderTopY(drawFrac + dx, dy)})`}>
                    {camMode === r.id && <circle r="10" fill="none" stroke={C.green} strokeWidth="1.5" opacity="0.9" />}
                    {isLaunching && (
                      <circle r="9" fill="none" stroke={C.yellow} strokeWidth="2" opacity="0.9">
                        <animate attributeName="r" values="7;11;7" dur="0.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.9;0.3;0.9" dur="0.8s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {r.mode === "attack" && <circle r="8" fill="none" stroke={C.red} strokeWidth="1.5" opacity="0.85" />}
                    {r.slot === 1 && r.mode === "draft" && <circle r={r.isAce ? 7.5 : 6} fill="none" stroke={C.yellow} strokeWidth="1" strokeDasharray="2,2" opacity="0.7" />}
                    <circle r={r.isAce ? 5.5 : 4} fill={r.color} stroke={r.mode === "pull" ? "#fff" : "#14171d"} strokeWidth={r.mode === "pull" ? 2 : 0.75} />
                    {r.isPlayer && <circle r="1.5" fill="#14171d" />}
                  </g>
                );
              })}
            </svg>
          </div>
          <div>
            <Eyebrow color={finalSeg ? C.red : C.sub}>{finalSeg ? "🏁 ラストスパートズーム — 側面マップ" : "側面マップ（コースの上下の起伏）"}</Eyebrow>
            <svg viewBox={`0 0 ${MAP_W} ${SIDE_H}`} preserveAspectRatio="none" style={{ ...MAP_BLEED, boxSizing: "border-box", aspectRatio: `${MAP_W} / ${SIDE_H}`, background: "#232a20", borderRadius: 8, marginTop: 4, border: finalSeg ? `2px solid ${C.red}` : "2px solid transparent", transition: "border-color 0.2s" }}>
              <polyline points={`${MAP_PAD},${SIDE_H - 4} ${sidePath} ${MAP_W - MAP_PAD},${SIDE_H - 4}`} fill="rgba(255,210,63,0.12)" stroke="none" />
              <polyline points={sidePath} fill="none" stroke="#8a8f98" strokeWidth="16" />
              {ridersUi.map(r => {
                const { dx, dy } = packShape[r.id] || { dx: 0, dy: 0 };
                const attackBonus = r.attackStreak > 0 ? (1 - r.attackStreak / ATTACK_VISUAL_TICKS) * ATTACK_EXAGGERATION : 0;
                const drawFrac = Math.min(1, r.frac + attackBonus);
                return (
                  <g key={r.id} transform={`translate(${mapX(drawFrac + dx, cam.start, cam.end)},${sideYAt(drawFrac) - Math.abs(dy) * 0.6})`}>
                    {camMode === r.id && <circle r="9" fill="none" stroke={C.green} strokeWidth="1.5" opacity="0.9" />}
                    {r.mode === "attack" && <circle r="7" fill="none" stroke={C.red} strokeWidth="1.5" opacity="0.85" />}
                    {r.slot === 1 && r.mode === "draft" && <circle r={r.isAce ? 6.5 : 5} fill="none" stroke={C.yellow} strokeWidth="1" strokeDasharray="2,2" opacity="0.7" />}
                    <circle r={r.isAce ? 5 : 3.5} fill={r.color} stroke={r.mode === "pull" ? "#fff" : "#14171d"} strokeWidth={r.mode === "pull" ? 1.8 : 0.6} />
                    {r.isPlayer && <circle r="1.3" fill="#14171d" />}
                  </g>
                );
              })}
            </svg>
          </div>
          <div style={{ fontSize: 10, color: C.sub, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>● 黄色＝エース</span><span>○ 白＝自チームのアシスト</span><span>白縁＝牽引中</span><span style={{ color: C.red }}>◎ 赤丸＝アタック中</span>
            <span style={{ color: C.yellow }}>点線＝次に牽引予定</span><span style={{ color: C.green }}>◎ 緑丸＝カメラで追跡中の選手</span>
            <span style={{ color: C.yellow }}>黄線＝アシストがエースを牽引中</span><span style={{ color: C.yellow }}>点滅リング＝エース発射</span>
            <span>選手はそれぞれ独立して集団内を漂う（巡航時は団子状、高強度区間ほど縦に伸びる）／中心から離れて動かなくなったら千切れかけ</span>
          </div>
        </>
      )}
      {hud.comment && (
        <div style={{ background: C.panel2, borderRadius: 6, padding: "6px 10px", fontSize: 13, color: C.text }}>
          {hud.comment}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        {!hud.done && (<>
          <Btn small outline color={C.text} onClick={() => { const nx = speedUi === 4 ? 1 : speedUi * 2; speedRef.current = nx; setSpeedUi(nx); }}>×{speedUi}</Btn>
          <Btn small outline color={C.text} onClick={() => { skipRef.current = true; if (tickRef.current) tickRef.current(); }}>スキップ</Btn>
        </>)}
        {hud.done && <Btn small onClick={onFinish}>結果を見る →</Btn>}
      </div>
    </div>
  );
}

// ---------- 初期状態 ----------
function initGame() {
  RID = 100;
  const roster = initRoster();
  const rosterNames = roster.map(r => r.name);
  return {
    screen: "intro", tab: "home",
    year: 1, month: 0, classIdx: 0, points: 0, budget: 300,
    roster,
    equip: { frame: 0, wheels: 0, facility: 0 },
    staff: { manager: 0, trainer: 0, doctor: 0 },
    inv: { wheel: 0, suit: 0, supp: 0, tune: 0, camp: 0 },
    partsInv: {},
    camp: false, campCooldown: 0,
    sponsor: null,
    sponsorOffers: genSponsors(0, 1),
    scoutPolicy: "balance",
    // v12バグ修正: 初回のスカウト候補・FA候補が固定シードで毎回同じ顔ぶれになっていたため、
    // 新規ゲームのたびに変わるようDate.now()由来のシードに変更。
    // 自チームの初期ロースターの名前とも被らないよう渡す
    scouts: genScouts(0, Date.now() % 999983, "balance", rosterNames),
    faMarket: genFaPool(0, (Date.now() + 12345) % 999983, rosterNames),
    races: genMonthRaces(1, 0, 0, 0, null, []),
    sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false, chaseMode: "normal", aceEarly: false },
    result: null, prizeInfo: null,
    champBest: null, gc: null, pendingEvent: null, eventResult: null,
    yearendInfo: null, log: [], cleared: false,
    // v13: キャリア統計・歴史記録テーマ。通算成績と年度ごとの結果履歴を保持する
    careerStats: { totalRaces: 0, totalWins: 0, totalPodiums: 0, totalPrize: 0, bestFinish: null },
    careerHistory: [],
    // v13: 難易度（周回プレイでクリアポイントを貯めて上位難易度を解禁する）
    difficulty: "easy",
    // v13: 選手名鑑・殿堂入り。引退・解雇した選手のスナップショット（raceLog含む）を保持する
    hallOfFame: [],
    // v13.1: 解雇後にライバルチームへ拾われた元自チーム選手（signedTeamで所属先を管理）。
    // 出走のたびraceLogが伸び、年度末に引退すると殿堂入り条件次第でhallOfFameへ移る
    rivalAlumni: [],
    // v14.8: その年に総合優勝したグランツールのgtIndex一覧（年度末にリセット）。
    // PROクラスのグランファイナル出場条件（全戦制覇）の判定に使う
    gtWins: [],
  };
}

// ---------- v10: セーブ/ロード（localStorage） ----------
// "main"画面（月送り後の安定した地点）でのみ自動保存する。result/gc/pendingEvent等の
// レース中・イベント中の一時的な状態は保存対象から除外し、ロード時は必ずmain画面に着地させる
// （courseオブジェクトなど関数を含む値をシリアライズしようとする事故を避けるため）
const SAVE_KEY = "roadrace_v12_save";
const SAVE_VERSION = "v12";
const SAVE_FIELDS = [
  "year", "month", "classIdx", "points", "budget", "roster", "equip", "staff", "inv", "partsInv",
  "camp", "campCooldown", "sponsor", "sponsorOffers", "scoutPolicy", "scouts", "faMarket", "races",
  "champBest", "log", "cleared", "careerStats", "careerHistory", "difficulty", "hallOfFame", "rivalAlumni",
  "gtWins",
];
function serializeState(g) {
  const out = {};
  SAVE_FIELDS.forEach(k => { out[k] = g[k]; });
  return out;
}
function saveGame(g) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), state: serializeState(g) }));
    return true;
  } catch (e) { return false; }
}
function hasSaveGame() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
// v12: initGame()がダミーのロースター/スカウト生成でRID（グローバル選手ID採番）を
// 消費した後にセーブデータで上書きされるため、ロード後のRIDが実際の最大IDより
// 低いまま取り残されていた。これにより次回のスカウト/FA生成が既存選手とIDが衝突し、
// Reactのkey衝突で能力値表示が古い選手のまま残る不具合が発生していた（要修正済み）
function resyncRid(state) {
  let max = RID;
  (state.roster || []).forEach(r => { if (r.id >= max) max = r.id + 1; });
  (state.scouts || []).forEach(sc => { if (sc.rider.id >= max) max = sc.rider.id + 1; });
  (state.faMarket || []).forEach(fa => { if (fa.rider.id >= max) max = fa.rider.id + 1; });
  RID = max;
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== SAVE_VERSION || !parsed.state) return null;
    const base = initGame();
    resyncRid(parsed.state);
    return {
      ...base, ...parsed.state,
      screen: "main", tab: "home",
      sel: base.sel, result: null, prizeInfo: null, gc: null, pendingEvent: null, eventResult: null, yearendInfo: null,
    };
  } catch (e) { return null; }
}
function clearSaveGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ }
}

// ---------- v14: マイライフモード（選手1人のキャリア） ----------
// v9〜v13のシーズンモード（チーム運営）とは完全に別のセーブ・状態を持つ、
// 選手1人の視点でB1からのキャリアを歩む新モード。既存のTYPES/TRAITS/PERSONALITIES/
// GROWTH/newRider/generateCourse/simulateTicks/rankSim/riderNickname等はそのまま再利用する
function initMyLife() {
  return {
    screen: "mylife_create", typeChoice: "RUL", bgChoice: "university",
    year: 1, month: 0, classIdx: 0, points: 0,
    player: null, team: null,
    races: [], sel: { raceId: null },
    result: null, resultInfo: null,
    log: [], retired: false,
    // v14.3: 監督指示・監督評価（マスクデータ）・年俸・ショップ用の資産
    directive: null, managerEval: 30, salary: 0, money: 0,
    partsInv: {}, stock: { drink: 0, supp: 0, tune: 0 },
    gear: { roller: false, monitor: false, chef: false },
    houseLv: -1, carLv: -1,
  };
}
const ML_SAVE_KEY = "roadrace_v12_mylife_save";
const ML_SAVE_VERSION = "v12ml";
const ML_SAVE_FIELDS = [
  "screen", "year", "month", "classIdx", "points", "player", "team", "races", "log", "retired",
  "directive", "managerEval", "salary", "money", "partsInv", "stock", "gear", "houseLv", "carLv",
];
function saveMyLife(ml) {
  try {
    const out = {}; ML_SAVE_FIELDS.forEach(k => { out[k] = ml[k]; });
    localStorage.setItem(ML_SAVE_KEY, JSON.stringify({ version: ML_SAVE_VERSION, savedAt: Date.now(), state: out }));
    return true;
  } catch (e) { return false; }
}
function hasMyLifeSave() {
  try { return !!localStorage.getItem(ML_SAVE_KEY); } catch (e) { return false; }
}
function loadMyLifeGame() {
  try {
    const raw = localStorage.getItem(ML_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== ML_SAVE_VERSION || !parsed.state) return null;
    const base = initMyLife();
    if (parsed.state.player && parsed.state.player.id >= RID) RID = parsed.state.player.id + 1;
    return { ...base, ...parsed.state, sel: base.sel, result: null, resultInfo: null };
  } catch (e) { return null; }
}
function clearMyLifeSave() {
  try { localStorage.removeItem(ML_SAVE_KEY); } catch (e) { /* noop */ }
}
// v14: マイライフのレースは6チーム全部をAI生成し、プレイヤーの選手だけを
// 「PLAYER」チームタグ付きの1名として混ぜる（RaceView等の既存カメラ・強調表示ロジックを
// そのまま再利用するため）。プレイヤー自身のチームメイトは実際のチーム名で登場する
function buildMyLifeSim(raceMeta, player, myTeamName, classIdx, difficultyId, dayTag, directiveKey) {
  const diffAiMul = (DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1]).aiMul;
  const course = generateCourse(raceMeta, dayTag);
  const rng = mulberry(Date.now() % 999983);
  const power = (50 + classIdx * 9 + (raceMeta.grade - 1) * 4) * diffAiMul;
  const { squadMin, squadMax } = raceMeta.tmpl;
  const nameBanned = new Set([player.name]);
  const riders = [];
  const playerEff = effAbilities(player, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade);
  MYLIFE_TEAMS.forEach(d => {
    const isMyTeam = d.name === myTeamName;
    const aiSquadN = squadMin === squadMax ? squadMin : squadMin + Math.floor(rng() * (squadMax - squadMin + 1));
    const members = [];
    for (let i = 0; i < aiSquadN; i++) members.push(newRider(power + (i === 0 ? 6 : 0), rng, { banned: nameBanned }));
    const aiRoles = assignAIRoles(members, aiSquadN);
    const aiStyle = AI_STYLES[Math.floor(rng() * AI_STYLES.length)];
    const teamEntrants = members.map((r, i) => ({
      id: r.id, name: r.name, type: r.type, trait: r.trait,
      flat: r.flat, climb: r.climb, sprint: r.sprint, stamina: r.stamina, solo: r.solo,
      team: d.name, teamName: d.name, color: d.color, isAce: i === 0, role: aiRoles[r.id], aiStyle,
    }));
    if (isMyTeam) {
      // v14.3: 監督指示が「エース」「アシスト／経験」であれば役割はそれに従って強制する。
      // 指示のない特別な区分（積極的な走り等）の場合のみ、従来通り能力比較で自動判定する
      const topAbility = Math.max(...teamEntrants.map(e => e.flat + e.climb + e.sprint + e.stamina + e.solo));
      const playerTotal = playerEff.flat + playerEff.climb + playerEff.sprint + playerEff.stamina + playerEff.solo;
      let playerIsAce;
      if (directiveKey === "ace") playerIsAce = true;
      else if (directiveKey === "support" || directiveKey === "experience") playerIsAce = false;
      else playerIsAce = playerTotal >= topAbility;
      if (playerIsAce) teamEntrants.forEach(e => { e.isAce = false; });
      riders.push({
        id: player.id, name: player.name, type: player.type, trait: player.trait, ...playerEff,
        team: "PLAYER", teamName: myTeamName, color: C.yellow,
        isAce: playerIsAce, role: playerIsAce ? "lead" : "sub", isPlayerChar: true,
      });
    }
    teamEntrants.forEach(en => riders.push(en));
  });
  const sim = { entrants: riders, riders, course, groupMode: "full", raceMeta, breakSurvived: false };
  simulateTicks(course, riders, 0, { chaseMode: "normal", aceEarly: false }, false);
  rankSim(sim);
  return sim;
}

// ---------- メインアプリ ----------
function App() {
  const [g, setG] = useState(initGame);
  // v14: マイライフモードはシーズンモードとは完全に別の状態を持つ（タイトル画面で選択）。
  // superMode: null=モード未選択（タイトル）／"season"=既存のチーム運営／"mylife"=新モード
  const [superMode, setSuperMode] = useState(null);
  const [ml, setMl] = useState(initMyLife);
  const mlRaceLockRef = useRef(false);
  // v12バグ修正: window.confirm()はモバイル端末（特にホーム画面追加時のPWA表示や
  // 一部のアプリ内ブラウザ）で表示されない・即falseを返すことがあり、その場合
  // 「最初から」等のボタンを押しても確認ダイアログがブロックされて何も起きない
  // （リセットできていないように見える）。ブラウザ標準のconfirm()に頼らず、
  // アプリ内で完結する確認モーダルに置き換える
  const [confirmDialog, setConfirmDialog] = useState(null);
  const askConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });
  const stage2LockRef = useRef(false);
  // v13: 新規ゲーム開始時の難易度選択（newgame_setup画面用。永続ボーナスは選択不要で自動適用）
  const [diffChoice, setDiffChoice] = useState("easy");
  const clearAwardedRef = useRef(false);
  // v13: 選手名鑑（戦績一覧）の展開状態。選手カードのトグルボタンで開閉する
  const [expandedRiderId, setExpandedRiderId] = useState(null);
  const cls = CLASSES[g.classIdx];
  const healthy = g.roster.filter(r => r.injury === 0);
  const equipMax = 3 + g.classIdx;
  const rosterMax = ROSTER_MAX_BY_CLASS[g.classIdx];
  const staffMax = STAFF_MAX_BY_CLASS[g.classIdx];
  // v14.11: 「限界突破」表示のしきい値は難易度ごとの成長上限（growthCap）と
  // 一致させる（以前は難易度に関わらず固定95だったため、上位難易度で実際の
  // ソフトキャップ〈102/112〉と表示上のしきい値〈95〉がズレていた）
  const growthCap = (DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).growthCap;

  // v10: main画面に到達するたびに自動保存
  useEffect(() => {
    if (g.screen === "main") saveGame(g);
  }, [g]);

  // v14: マイライフモードも同様にmylife_main到達時点で自動保存（別のセーブキー）
  useEffect(() => {
    if (superMode === "mylife" && ml.screen === "mylife_main") saveMyLife(ml);
  }, [ml, superMode]);

  // v13: グランファイナル制覇でクリアポイントを付与（周回プレイの起点）。
  // 通常のセーブデータとは別のlocalStorageキーに保存し、「最初から」でリセットしても
  // 消えない永続的な進行度にする。re-render時に重複加算しないようrefでガードする
  useEffect(() => {
    if (g.screen === "clear" && !clearAwardedRef.current) {
      clearAwardedRef.current = true;
      const earned = computeClearPoints(g.year, g.difficulty);
      const meta = loadMeta();
      saveMeta({ totalEarnedCP: meta.totalEarnedCP + earned });
    }
    if (g.screen !== "clear") clearAwardedRef.current = false;
  }, [g.screen]);

  const equippedCount = (pid) => g.roster.reduce((s, r) => s + (PART_SLOTS.reduce((n, sl) => n + (r.parts[sl] === pid ? 1 : 0), 0)), 0);
  const availParts = (pid) => (g.partsInv[pid] || 0) - equippedCount(pid);

  // ---- 月次更新 ----
  function monthlyUpdate(state, raceInfo) {
    const starterIds = raceInfo ? raceInfo.starters : null;
    // v14.7: グランツールは複数日にわたって走り切る大会のため、ワンデーレースと
    // 同じ疲労蓄積では実態に合わない。ただしステージレースは中日ごとに-20の回復が
    // 別途入る（startNextStage）ため、素朴に係数を掛けただけだとその回復分で
    // ほぼ相殺されてしまう。かといって係数を上げすぎると、疲労は0未満に下がらない
    // （中日回復は0で頭打ち）ため、開幕直後の疲労が低い選手でも常に上限100に
    // 張り付いてしまい「グランツール＝常に即MAX」という芸のない結果になる。
    // 3日間なら中日回復-40を踏まえてもワンデーレースよりはっきり多く疲労が残りつつ、
    // 低疲労状態からのスタートなら100に張り付かない程度の係数に留める
    const stageFatigueMul = (raceInfo && raceInfo.grandTour) ? 1 + ((raceInfo.stageCount || 3) - 1) / 3 : 1;
    // v13: 難易度別の成長ソフトキャップ閾値（易しいほど高い閾値まで伸びる）
    const growthCap = (DIFFICULTIES.find(d => d.id === state.difficulty) || DIFFICULTIES[0]).growthCap;
    const roster = state.roster.map(r => {
      const n = { ...r, parts: { ...r.parts } };
      const injMul = n.trait === "glass" ? 2 : n.trait === "tough" ? 0.5 : 1;
      const injExtra = n.trait === "glass" ? 1 : 0;
      if (n.injury > 0) {
        n.injury -= 1;
        n.fatigue = Math.max(0, n.fatigue - 30);
        n.streak = 0;
      } else {
        if (n.focus === "rest") {
          n.fatigue = Math.max(0, n.fatigue - 15);
        } else {
          const ph = growthPhase(n);
          const winter = state.month === 8 || state.month === 9;
          // v9: 基礎成長量をさらに引き下げ（2.2→1.5）。「将来性一択」問題への対処
          const gain = 1.5 * ph.gain * POW[n.growthPow].mul
            * (winter ? 1.3 : 1) * (state.camp ? 2 : 1)
            * (1 + state.equip.facility * 0.15)
            * (1 + (state.staff?.trainer || 0) * 0.12)
            * (n.trait === "trainer" ? 1.2 : 1);
          // 指定能力の成長にトレードオフ（×0.9）。指定外はさらに絞って14%
          addAb(n, n.focus, gain * 0.9 * persMul(n, n.focus), growthCap);
          AB_KEYS.filter(k => k !== n.focus).forEach(k => addAb(n, k, gain * 0.14 * persMul(n, k), growthCap));
          n.fatigue = Math.min(100, n.fatigue + 6);
        }
        const ph2 = growthPhase(n);
        if (ph2.dec > 0) AB_KEYS.forEach(k => { n[k] = Math.max(20, n[k] - ph2.dec); });
      }
      if (starterIds && starterIds.includes(n.id)) {
        n.fatigue = Math.min(100, n.fatigue + (n.trait === "iron" ? 32 : 45) * stageFatigueMul);
        n.streak += 1;
        const ph = growthPhase(n);
        raceInfo.expKeys.forEach(k => addAb(n, k, 0.6 * Math.max(0.2, ph.gain) * POW[n.growthPow].mul * persMul(n, k), growthCap));
        // v11: ドクター（staff.doctor）は故障の発生率を下げ、発生した場合も期間を短縮する
        const doctorLv = state.staff?.doctor || 0;
        if (n.streak >= 3) {
          n.injury = Math.max(1, 1 + (Math.random() < 0.5 ? 1 : 0) + injExtra - Math.floor(doctorLv / 2));
          n.streak = 0;
          state._injured.push(`${n.name} が3連闘の無理がたたり故障（${n.injury}ヶ月離脱）`);
        } else if (n.fatigue > 90) {
          const p = (0.3 + (n.fatigue - 90) * 0.04) * injMul * (1 - doctorLv * 0.15);
          if (Math.random() < p) {
            n.injury = Math.max(1, 1 + (Math.random() < 0.4 ? 1 : 0) + injExtra - Math.floor(doctorLv / 2));
            n.streak = 0;
            state._injured.push(`${n.name} が疲労の蓄積で故障（${n.injury}ヶ月離脱）`);
          }
        }
      } else if (n.injury === 0) {
        n.fatigue = Math.max(0, n.fatigue - (starterIds ? 30 : 50));
        n.streak = 0;
      }
      if (n.trait === "recover") n.fatigue = Math.max(0, n.fatigue - 15);
      const swing = n.trait === "moody" ? 2 : 1;
      n.cond = Math.max(1, Math.min(5, n.cond + (Math.random() < 0.34 ? -swing : Math.random() < 0.5 ? 0 : swing)));
      return n;
    });
    return roster;
  }

  function advanceMonth(raceInfo) {
    setG(s => {
      const st = { ...s, _injured: [] };
      const roster = monthlyUpdate(st, raceInfo);
      const income = s.sponsor ? s.sponsor.monthly : 0;
      const log = [...s.log, ...st._injured.map(t => `【${MONTHS[s.month]}】${t}`)];
      let sponsor = s.sponsor;
      const mandateRace = s.races.find(r => r.sponsorMandate);
      if (sponsor && mandateRace && !(raceInfo && raceInfo.raceId === mandateRace.id)) {
        sponsor = { ...sponsor, mandatesMissed: sponsor.mandatesMissed + 1 };
        log.push(`【${MONTHS[s.month]}】${sponsor.name}の指定レースを見送った（違約金が加算されます）`);
      }
      if (s.month === 11) {
        let classIdx = s.classIdx;
        const info = { promoted: false, relegated: false, retired: [], retiredRiders: [], cleared: false, champBest: s.champBest, sponsorResult: null };
        if (s.champBest !== null && s.champBest <= 3) {
          if (s.classIdx === 2 && s.champBest === 1) info.cleared = true;
          else { classIdx = Math.min(2, s.classIdx + 1); info.promoted = true; }
        } else if (s.points < RELEGATE_LINE && s.classIdx > 0) {
          classIdx = s.classIdx - 1; info.relegated = true;
        }
        let delta = 0;
        if (sponsor) {
          const achieved = s.points >= sponsor.norma;
          const mandatePenalty = sponsor.mandatesMissed * 15;
          delta = (achieved ? sponsor.bonus : -sponsor.penalty) - mandatePenalty;
          info.sponsorResult = {
            name: sponsor.name, achieved, bonus: sponsor.bonus, penalty: sponsor.penalty, norma: sponsor.norma, pts: s.points,
            mandatesMet: sponsor.mandatesMet, mandatesMissed: sponsor.mandatesMissed, mandatePenalty,
          };
        }
        const survivors = [];
        roster.forEach(r => {
          const n = { ...r, age: r.age + 1 };
          const retire = n.age >= 36 || (n.age >= 33 && overall(n) < n.joinOvr * 0.8);
          if (retire) { info.retired.push(`${n.name}（${n.age}歳）が引退`); info.retiredRiders.push(n); }
          else survivors.push(n);
        });
        const year = s.year + 1;
        const upkeep = survivors.length * UPKEEP_PER_RIDER;
        const staffSalary = staffSalaryTotal(s.staff);
        const managerLv = s.staff?.manager || 0;
        const nextOffers = genSponsors(classIdx, year).map(o => ({
          ...o,
          monthly: Math.round(o.monthly * (1 + managerLv * 0.06)),
          norma: Math.max(5, Math.round(o.norma * (1 - managerLv * 0.04))),
        }));
        // v13: 年度の総括を歴史記録として1件積む（クラス・最終ポイント・昇格/降格・
        // チャンピオンシップ最高位）
        const careerHistory = [...s.careerHistory, {
          year: s.year, classLabel: CLASSES[s.classIdx].label, points: s.points,
          promoted: info.promoted, relegated: info.relegated, champBest: s.champBest,
        }];
        // v13.1: ライバルチームに拾われた元選手も年齢を重ね、同じ引退条件を満たせば
        // 殿堂入り判定（実績かお気に入りがあれば記録に残る）を経て名鑑へ、
        // 満たさなければ静かに記録から外れる。生き残った選手はrivalAlumniに残り続ける
        const survivingAlumni = [];
        const retiredAlumniHof = [];
        (s.rivalAlumni || []).forEach(r => {
          const n = { ...r, age: r.age + 1 };
          const retire = n.age >= 36 || (n.age >= 33 && overall(n) < n.joinOvr * 0.8);
          if (retire) { if (isHallOfFameWorthy(n)) retiredAlumniHof.push({ ...n, farewellYear: year, farewellReason: "rival_retired" }); }
          else survivingAlumni.push(n);
        });
        // v13.1: 引退した選手は、殿堂入り条件（実績かお気に入り）を満たした場合のみ記録に残す
        const hallOfFame = [
          ...s.hallOfFame,
          ...info.retiredRiders.filter(isHallOfFameWorthy).map(n => ({ ...n, farewellYear: s.year, farewellReason: "retired" })),
          ...retiredAlumniHof,
        ];
        return {
          ...s, roster: survivors, classIdx, points: 0, year, month: 0,
          budget: s.budget + income + delta - upkeep - staffSalary,
          sponsor: null, sponsorOffers: nextOffers,
          scouts: genScouts(classIdx, year * 771 + 13, s.scoutPolicy, survivors.map(r => r.name)),
          faMarket: genFaPool(classIdx, year * 613 + 29, survivors.map(r => r.name)),
          races: genMonthRaces(year, 0, classIdx, 0, null, []),
          camp: false, campCooldown: 0, champBest: null, gc: null,
          sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false, chaseMode: "normal", aceEarly: false },
          // v14.8: 年が変わるのでグランツール制覇状況もリセットする
          gtWins: [],
          yearendInfo: info, cleared: info.cleared, log, careerHistory, hallOfFame, rivalAlumni: survivingAlumni,
          screen: info.cleared ? "clear" : "yearend", tab: "home",
        };
      }
      const month = s.month + 1;
      const upkeep = roster.length * UPKEEP_PER_RIDER;
      const staffSalary = staffSalaryTotal(s.staff);
      const base = {
        ...s, roster, month, camp: false, campCooldown: Math.max(0, s.campCooldown - 1),
        budget: s.budget + income - upkeep - staffSalary,
        sponsor,
        faMarket: genFaPool(s.classIdx, s.year * 1013 + month * 37 + 7, roster.map(r => r.name)),
        races: genMonthRaces(s.year, month, s.classIdx, s.points, sponsor, s.gtWins),
        sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false, chaseMode: "normal", aceEarly: false },
        gc: null,
        screen: "main", log,
      };
      // v8: 月替わりでランダムに選択肢付きイベントが発生（春先の解禁月は除く）
      if (month !== 0 && Math.random() < EVENT_CHANCE) {
        const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        return { ...base, pendingEvent: ev, screen: "event" };
      }
      return base;
    });
  }

  function resolveEvent(choiceIdx) {
    setG(s => {
      const ev = s.pendingEvent;
      if (!ev) return s;
      const choice = ev.choices[choiceIdx];
      const applied = applyEventEffects(s, choice.effects);
      // v12: 個人targetの効果は誰が対象だったかを__eventNoteに乗せて返してくるので、
      // 結果テキストの末尾に添えてから消す（保存対象にも含まれない一時フィールド）
      const { __eventNote, ...rest } = applied;
      const text = __eventNote ? `${choice.result}\n\n${__eventNote}` : choice.result;
      return { ...rest, pendingEvent: null, eventResult: { title: ev.title, text }, screen: "event_result" };
    });
  }

  // ---- レース ----
  function startRace(watch) {
    stage2LockRef.current = false;
    const race = g.races.find(r => r.id === g.sel.raceId);
    const squad = g.roster.filter(r => g.sel.starters.includes(r.id));
    const aceId = g.sel.starters.length === 1 ? g.sel.starters[0] : g.sel.ace;
    const itemBoost = { wheel: g.sel.useWheel, suit: g.sel.useSuit };
    // v12: 無線指示は廃止し、出走前に選んだ作戦をそのままシミュレーションへ渡す
    const directive = { chaseMode: g.sel.chaseMode || "normal", aceEarly: !!g.sel.aceEarly };
    const { sim, aiTeams } = buildSim(race, squad, aceId, g.sel.roles, g.equip, itemBoost, g.classIdx, undefined, race.stageRace ? "day1" : undefined, directive, g.difficulty, g.rivalAlumni);
    setG(s => ({
      ...s, result: sim,
      gc: race.stageRace ? { race, aceId, roles: s.sel.roles, starters: s.sel.starters, aiTeams, watch, stage: 1, directive, stageTimes: {}, dayLogs: [] } : s.gc,
      inv: { ...s.inv, wheel: s.inv.wheel - (itemBoost.wheel ? 1 : 0), suit: s.inv.suit - (itemBoost.suit ? 1 : 0) },
      screen: watch ? "race" : "result_pending",
    }));
    if (!watch) setTimeout(() => finishRace(sim, race, race.stageRace ? 1 : undefined), 0);
  }

  // v12: 以前はg（renderクロージャのstale値）からroster2/simを計算した後にsetGへ渡していたため、
  // 何らかの理由でgが更新される前に呼ばれる／連打で二重発火すると2日目のシミュレーションが
  // 食い違う・実行されない不具合があった。setGのfunctional updater内で毎回最新のsから
  // 計算するよう変更し、連打防止のロックも追加
  // v13: 2日間固定だったステージレースを任意日数（race.stageCount）に一般化。
  // 「2日目」だけを特別扱いしていたstartStage2を、現在のgc.stageから次の日を
  // 割り出すstartNextStageに置き換えた
  function startNextStage() {
    if (stage2LockRef.current) return;
    stage2LockRef.current = true;
    // v12バグ修正: watchFlagをsetGのfunctional updater内で代入し、その直後（同期的に）
    // if(!watchFlag)で参照していたため、Reactがupdaterをこの行より後（バッチ処理の
    // 反映時）に呼ぶ場合、常にwatchFlag=falseの初期値のまま判定されてしまい、観戦モードで
    // 開始したはずの次の日が毎回「結果だけ見る」経路に落ちて即座に確定してしまっていた
    // （日程が実行されないように見えるバグの原因）。gc.watchはステージレース開始時に
    // 一度決まったら変わらない値なので、setGを呼ぶ前に外側のgから同期的に読んで安全に使う
    const watchFlag = g.gc.watch;
    const nextStage = g.gc.stage + 1;
    let simResult = null, raceRef = null;
    setG(s => {
      const gc = s.gc;
      const roster2 = s.roster.map(r => gc.starters.includes(r.id) ? { ...r, fatigue: Math.max(0, r.fatigue - 20) } : r);
      const squad = roster2.filter(r => gc.starters.includes(r.id));
      // v14.8: ステージごとに役割を変更できるようにしたため、初日から固定のgc.aceId/gc.rolesではなく、
      // 直前の「作戦変更」画面（gc_role_setup）で更新したg.sel.ace/g.sel.rolesを都度反映する。
      // 出走人数1名（solo）の場合は再設定画面自体を経由しないため、従来通りgc.aceIdを使う
      const aceId = gc.starters.length === 1 ? gc.starters[0] : (s.sel.ace || gc.aceId);
      const roles = s.sel.roles || gc.roles;
      // v13: 各日ともステージ1で選んだ作戦（gc.directive）をそのまま引き継ぐ
      const { sim } = buildSim(gc.race, squad, aceId, roles, s.equip, { wheel: false, suit: false }, s.classIdx, gc.aiTeams, `day${nextStage}`, gc.directive, s.difficulty);
      simResult = sim; raceRef = gc.race;
      return {
        ...s, roster: roster2, result: sim,
        gc: { ...s.gc, stage: nextStage, aceId, roles },
        screen: watchFlag ? "race" : "result_pending",
      };
    });
    if (!watchFlag) setTimeout(() => finishRace(simResult, raceRef, nextStage), 0);
  }

  // stageOverride: skip経路（結果だけ見る）はステージ番号を明示で渡し、
  // setG後にgが更新前のまま参照される（stale closure）事故を避ける
  function finishRace(sim, race, stageOverride) {
    rankSim(sim);
    if (race.stageRace) {
      finishStage(sim, race, stageOverride);
      return;
    }
    const playerRs = sim.ranked.filter(e => e.team === "PLAYER");
    const best = playerRs[0];
    const mul = CLASSES[g.classIdx].prizeMul * GRADE_MUL[race.grade];
    const prize = Math.round(playerRs.reduce((s2, e) => s2 + (PRIZES[e.rank - 1] || 1), 0) * mul);
    const mandateHit = !race.championship && !!race.sponsorMandate;
    let pts = Math.round((PTS[best.rank - 1] || 0) * GRADE_MUL[race.grade]);
    if (mandateHit) pts = Math.round(pts * 1.3);
    // v13: 選手名鑑用に、出走した自チーム選手それぞれの着順を各選手のraceLogへ記録する
    const rankById = {}; playerRs.forEach(e => { rankById[e.id] = e.rank; });
    // v14.6: フレーバーテキストで「そのレースでどんな役割だったか」を語れるよう、
    // 着順と一緒に役割（エースならace、それ以外はROLESのキー）も記録する
    const roleById = {}; playerRs.forEach(e => { roleById[e.id] = e.isAce ? "ace" : e.role; });
    // v13.1: ライバルチームに拾われた元選手が出走していれば、そちらのraceLogも伸ばす
    const alumniRankById = {}; sim.ranked.filter(e => e.isAlumnus).forEach(e => { alumniRankById[e.id] = e.rank; });
    const alumniRoleById = {}; sim.ranked.filter(e => e.isAlumnus).forEach(e => { alumniRoleById[e.id] = e.isAce ? "ace" : e.role; });
    setG(s => {
      const roster = s.roster.map(r => rankById[r.id] != null
        ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: rankById[r.id], role: roleById[r.id] }] }
        : r);
      const rivalAlumni = (s.rivalAlumni || []).map(r => alumniRankById[r.id] != null
        ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: alumniRankById[r.id], role: alumniRoleById[r.id] }] }
        : r);
      return {
        ...s, roster, rivalAlumni, budget: s.budget + prize,
        points: race.championship ? s.points : s.points + pts,
        champBest: race.championship ? best.rank : s.champBest,
        sponsor: (s.sponsor && mandateHit) ? { ...s.sponsor, mandatesMet: s.sponsor.mandatesMet + 1 } : s.sponsor,
        careerStats: bumpCareerStats(s.careerStats, best.rank, prize),
        prizeInfo: { race, prize, pts: race.championship ? 0 : pts, best, mandateHit, breakSurvived: sim.breakSurvived, hadBreak: sim.hadBreak },
        screen: "result",
      };
    });
  }

  function finishStage(sim, race, stageOverride) {
    const times = {}; sim.entrants.forEach(en => { times[en.id] = en.finishTime; });
    const stage = stageOverride || (g.gc ? g.gc.stage : 1);
    const totalStages = race.stageCount || 2;
    // v14.8: ステージごとに役割を変更できるようになったため、フレーバーテキスト用に
    // 「その日単独の着順・役割」もdayLogとして日ごとに記録しておく（GC総合成績とは別枠）
    const dayOrder = [...sim.entrants].sort((a, b) => a.finishTime - b.finishTime);
    const dayRankById = {}; dayOrder.forEach((en, i) => { dayRankById[en.id] = i + 1; });
    const dayRoleById = {}; sim.entrants.forEach(en => { dayRoleById[en.id] = en.isAce ? "ace" : en.role; });
    const dayLog = { day: stage, rankById: dayRankById, roleById: dayRoleById };
    if (stage < totalStages) {
      stage2LockRef.current = false;
      setG(s => ({ ...s, gc: { ...s.gc, stageTimes: { ...s.gc.stageTimes, [stage]: times }, dayLogs: [...(s.gc.dayLogs || []), dayLog] }, screen: "gc_stage" }));
    } else {
      setG(s => {
        const dayLogs = [...(s.gc.dayLogs || []), dayLog];
        const allStageTimes = { ...s.gc.stageTimes, [stage]: times };
        const gcTimes = {};
        Object.keys(times).forEach(id => {
          gcTimes[id] = Object.values(allStageTimes).reduce((sum2, st) => sum2 + (st[id] || 0), 0);
        });
        const order = Object.entries(gcTimes).sort((a, b) => a[1] - b[1]);
        const idToEntrant = {}; sim.entrants.forEach(en => { idToEntrant[en.id] = en; });
        const playerRanks = order.map(([id], i) => ({ id, rank: i + 1 })).filter(o => idToEntrant[o.id]?.team === "PLAYER");
        const bestRank = playerRanks.length ? Math.min(...playerRanks.map(o => o.rank)) : order.length;
        const prize = Math.round((PRIZES[bestRank - 1] || 1) * CLASSES[s.classIdx].prizeMul * 2.2);
        // v13: 昇格戦（championship）は年度末に近くポイントがどのみちリセットされるため対象外。
        // グランツールなど通常カレンダー上のステージレースは、複数日にわたる大会である
        // ことを踏まえ通常レースよりポイント倍率を優遇する
        const pts = race.championship ? 0 : Math.round((PTS[bestRank - 1] || 0) * GRADE_MUL[race.grade] * 1.3);
        // v13: 選手名鑑用に、ステージレース全体の総合着順を各選手のraceLogへ記録する
        // （各日のステージ結果ではなく、最終確定した総合成績のみを1件記録する）
        const rankById = {}; playerRanks.forEach(o => { rankById[o.id] = o.rank; });
        // v14.6: フレーバーテキストでの役割参照用（最終日時点の役割を代表値として使う）
        const roleOf = (id) => { const en = idToEntrant[id]; return en ? (en.isAce ? "ace" : en.role) : undefined; };
        // v14.8: ステージレースなら日ごとの内訳（役割・その日の着順）もraceLogに添えて記録する
        const stageBreakdownFor = (id) => race.stageRace
          ? dayLogs.map(dl => ({ day: dl.day, role: dl.roleById[id], rank: dl.rankById[id] })).filter(d => d.rank != null)
          : undefined;
        const roster = s.roster.map(r => rankById[r.id] != null
          ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: rankById[r.id], role: roleOf(r.id), stageBreakdown: stageBreakdownFor(r.id) }] }
          : r);
        // v13.1: ライバルチームに拾われた元選手のGC総合成績もraceLogへ記録する
        const alumniRanks = order.map(([id], i) => ({ id, rank: i + 1 })).filter(o => idToEntrant[o.id]?.isAlumnus);
        const alumniRankById = {}; alumniRanks.forEach(o => { alumniRankById[o.id] = o.rank; });
        const rivalAlumni = (s.rivalAlumni || []).map(r => alumniRankById[r.id] != null
          ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: alumniRankById[r.id], role: roleOf(r.id), stageBreakdown: stageBreakdownFor(r.id) }] }
          : r);
        // v14.8: グランツールで自チーム総合優勝ならそのgtIndexを勝利記録に加える（重複防止）
        const gtWins = (race.grandTour && bestRank === 1 && race.gtIndex != null && !(s.gtWins || []).includes(race.gtIndex))
          ? [...(s.gtWins || []), race.gtIndex]
          : (s.gtWins || []);
        return {
          ...s, roster, rivalAlumni, budget: s.budget + prize, points: race.championship ? s.points : s.points + pts, champBest: bestRank,
          careerStats: bumpCareerStats(s.careerStats, bestRank, prize),
          gc: { ...s.gc, gcOrder: order, idToEntrant, bestRank, prize, pts },
          gtWins,
          screen: "gc_final",
        };
      });
    }
  }

  const raceFinishHandler = () => {
    if (g.gc && g.gc.race.stageRace) finishStage(g.result, g.gc.race, g.gc.stage);
    else finishRace(g.result, g.result.raceMeta);
  };

  // ==== v14: マイライフモード専用ハンドラ ====
  function mlGenRace(year, month, classIdx) {
    const rng = mulberry(year * 3001 + month * 97 + classIdx * 17);
    const t = TEMPLATES[Math.floor(rng() * TEMPLATES.length)];
    const grade = month === 11 ? 3 : 1 + Math.floor(rng() * 3);
    return { id: `ml-${year}-${month}`, name: `${VENUES[Math.floor(rng() * VENUES.length)]}${t.kind}`, tmpl: t, grade, cls: classIdx };
  }
  function mlCreateChar(type, background) {
    const rng = mulberry(Date.now() % 999983);
    const team = MYLIFE_TEAMS[Math.floor(Math.random() * MYLIFE_TEAMS.length)];
    const bg = ML_BACKGROUNDS[background];
    const player = newRider(bg.powerBase, rng, { type, age: bg.age, growth: bg.growth, powDist: bg.powDist, banned: new Set() });
    player.background = background;
    player.focus = type === "CLM" ? "climb" : type === "SPR" ? "sprint" : "flat";
    // v14.3: 経歴ごとの初任給（万円/年）。年俸・監督評価・資産はキャリア開始時に初期化する
    const initialSalary = { highschool: 220, university: 280, corporate: 360 }[background] || 260;
    setMl(s => ({
      ...s, player, team: team.name, classIdx: 0, year: 1, month: 0, points: 0,
      races: [mlGenRace(1, 0, 0)],
      directive: mlGenDirective(1, 0, 0, 30),
      managerEval: 30, salary: initialSalary, money: 0,
      partsInv: {}, stock: { drink: 0, supp: 0, tune: 0 },
      gear: { roller: false, monitor: false, chef: false },
      houseLv: -1, carLv: -1,
      log: [`【1年目 4月】${bg.label}として${team.name}に新人選手加入`],
      screen: "mylife_main",
    }));
  }
  function mlSetFocus(key) {
    setMl(s => ({ ...s, player: { ...s.player, focus: key } }));
  }
  function mlStartRace() {
    if (mlRaceLockRef.current) return;
    mlRaceLockRef.current = true;
    const race = ml.races[0];
    const sim = buildMyLifeSim(race, ml.player, ml.team, ml.classIdx, "easy", undefined, ml.directive ? ml.directive.key : null);
    setMl(s => ({ ...s, result: sim, screen: "mylife_race" }));
  }
  function mlRaceFinish() {
    mlRaceLockRef.current = false;
    const sim = ml.result;
    const me = sim.ranked.find(e => e.isPlayerChar);
    const race = ml.races[0];
    const pts = Math.round((PTS[me.rank - 1] || 0) * GRADE_MUL[race.grade]);
    // v14.3: 監督指示を全うできたかどうかで監督評価が増減する。賞金はクラス倍率に応じて即時支給
    const directive = ml.directive;
    const fulfilled = directive ? directive.check(me.rank, sim.ranked.length) : false;
    const evalDelta = directive ? (fulfilled ? directive.evalGain : -directive.evalPenalty) : 0;
    const prize = Math.round((PRIZES[me.rank - 1] || 0) * (0.4 + ml.classIdx * 0.25));
    setMl(s => {
      // v14.6: マイライフでは監督指示のキー自体がその一戦での役割を表すので、そのまま記録する
      const role = directive ? directive.key : (me.isAce ? "ace" : "support");
      const player = {
        ...s.player,
        raceLog: [...(s.player.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: me.rank, role }],
      };
      return {
        ...s, player, points: s.points + pts,
        managerEval: Math.max(0, Math.min(100, s.managerEval + evalDelta)),
        money: s.money + prize,
        resultInfo: { race, rank: me.rank, total: sim.ranked.length, pts, directive, fulfilled, evalDelta, prize },
        screen: "mylife_result",
      };
    });
  }
  // v14.2: 月次アクションを「レース／練習」の2択から拡張。練習・休養・イベントで
  // 選手への効果を出し分ける（レースは既にmlRaceFinish側で反映済みのためここでは疲労のみ）。
  // v14.3: 永続トレーニング用品（ローラー台・パワーメーター）と車（レース疲労軽減）の
  // 恒常効果もここで反映する
  function mlApplyMonthEffect(player0, mode, ctx) {
    const player = { ...player0 };
    const gear = (ctx && ctx.gear) || {};
    const carLv = ctx ? ctx.carLv : -1;
    const houseLv = ctx ? ctx.houseLv : -1;
    if (mode === "race") {
      const carCut = carLv >= 0 ? (1 - ML_CARS[carLv].raceFatigueCut) : 1;
      const chefCut = gear.chef ? 0.9 : 1;
      player.fatigue = Math.min(100, player.fatigue + 40 * carCut * chefCut);
      player.streak = (player.streak || 0) + 1;
    } else if (mode === "train") {
      const ph = growthPhase(player);
      const gain = 1.5 * ph.gain * POW[player.growthPow].mul * (gear.roller ? 1.15 : 1);
      const focusMul = gear.monitor ? 1.10 : 1;
      addAb(player, player.focus, gain * 0.9 * persMul(player, player.focus) * focusMul);
      AB_KEYS.filter(k => k !== player.focus).forEach(k => addAb(player, k, gain * 0.14 * persMul(player, k)));
      const ph2 = growthPhase(player);
      if (ph2.dec > 0) AB_KEYS.forEach(k => { player[k] = Math.max(20, player[k] - ph2.dec); });
      player.fatigue = Math.max(0, player.fatigue - 15);
      player.streak = 0;
    } else if (mode === "rest") {
      player.fatigue = Math.max(0, player.fatigue - 35);
      player.streak = 0;
    } else if (mode === "event") {
      player.fatigue = Math.max(0, player.fatigue - 5);
    }
    if (houseLv >= 0) player.fatigue = Math.max(0, player.fatigue - ML_HOUSES[houseLv].fatigueBonus);
    return player;
  }
  function mlAdvanceMonth(mode) {
    setMl(s => {
      const ctx = { gear: s.gear, houseLv: s.houseLv, carLv: s.carLv };
      let player = mlApplyMonthEffect(s.player, mode, ctx);
      const log = [...s.log];
      // v14.3: 毎月、練習を積んだり生活基盤（一戸建て）が整っていると監督評価がじわじわ上がる。
      // 年俸は毎月1/12ずつ資金として振り込まれる
      const passiveEvalDelta = (mode === "train" ? 0.4 : 0) + (s.houseLv >= 2 ? 0.3 : 0);
      const managerEval = Math.max(0, Math.min(100, s.managerEval + passiveEvalDelta));
      const money = s.money + Math.round(s.salary / 12);
      if (s.month === 11) {
        player.age += 1;
        const retire = player.age >= 36 || (player.age >= 33 && overall(player) < player.joinOvr * 0.8);
        if (retire) {
          return { ...s, player, money, managerEval, screen: "mylife_retired", log: [...log, `【${s.year}年目 3月】${player.age}歳で現役引退`] };
        }
        const qualified = s.points >= CLASSES[s.classIdx].need;
        const classIdx = qualified ? Math.min(2, s.classIdx + 1) : s.classIdx;
        if (qualified && classIdx > s.classIdx) log.push(`【${s.year}年目 3月】${CLASSES[classIdx].label}に昇格！`);
        // v14.3: 年俸改定。その年のポイント・勝利・表彰台に応じて年俸が上がる
        const yearRaces = (player.raceLog || []).filter(e => e.year === s.year);
        const yearWins = yearRaces.filter(e => e.rank === 1).length;
        const yearPodiums = yearRaces.filter(e => e.rank <= 3).length;
        const salaryGain = Math.round(s.points * 2.2 + yearWins * 18 + yearPodiums * 7);
        const salary = s.salary + salaryGain;
        if (salaryGain > 0) log.push(`【${s.year}年目 3月】戦績が評価され年俸+${salaryGain}万円（年俸${salary}万円に）`);
        // v14: 好成績を残すと移籍オファーが来る（簡易な移籍システム）
        const interest = s.points / Math.max(1, CLASSES[s.classIdx].need);
        if (interest >= 0.8 && Math.random() < 0.6) {
          const others = MYLIFE_TEAMS.filter(t => t.name !== s.team);
          const offerTeams = [...others].sort(() => Math.random() - 0.5).slice(0, 2).map(t => t.name);
          return {
            ...s, player, classIdx, points: 0, year: s.year + 1, month: 0,
            races: [mlGenRace(s.year + 1, 0, classIdx)],
            directive: mlGenDirective(s.year + 1, 0, classIdx, managerEval),
            contractOffers: [s.team, ...offerTeams],
            salary, money, managerEval,
            screen: "mylife_contract", log,
          };
        }
        return {
          ...s, player, classIdx, points: 0, year: s.year + 1, month: 0,
          races: [mlGenRace(s.year + 1, 0, classIdx)],
          directive: mlGenDirective(s.year + 1, 0, classIdx, managerEval),
          salary, money, managerEval,
          screen: "mylife_main", log,
        };
      }
      const month = s.month + 1;
      return {
        ...s, player, month, races: [mlGenRace(s.year, month, s.classIdx)],
        directive: mlGenDirective(s.year, month, s.classIdx, managerEval),
        money, managerEval,
        screen: "mylife_main", log,
      };
    });
  }
  function mlChooseTeam(teamName) {
    setMl(s => ({ ...s, team: teamName, contractOffers: null, screen: "mylife_main" }));
  }
  // v14.2: 私生活・取材イベント（練習/休養以外の月次アクション）
  function mlApplyEventEffects(player0, effects) {
    const player = { ...player0 };
    if (effects.fatigueDelta) player.fatigue = Math.max(0, Math.min(100, player.fatigue + effects.fatigueDelta));
    if (effects.abBoost) AB_KEYS.forEach(k => addAb(player, k, effects.abBoost));
    return player;
  }
  function mlTriggerEvent() {
    const ev = ML_EVENTS[Math.floor(Math.random() * ML_EVENTS.length)];
    setMl(s => ({ ...s, pendingEvent: ev, screen: "mylife_event" }));
  }
  function mlResolveEvent(choiceIdx) {
    setMl(s => {
      const ev = s.pendingEvent;
      if (!ev) return s;
      const choice = ev.choices[choiceIdx];
      const player = mlApplyEventEffects(s.player, choice.effects);
      const managerEval = Math.max(0, Math.min(100, s.managerEval + (choice.effects.managerEvalDelta || 0)));
      return { ...s, player, managerEval, pendingEvent: null, eventResultText: choice.result, screen: "mylife_event_result" };
    });
  }
  // v14.3: マイライフ専用ショップ（年俸で得た資金を使う）。パーツはPARTS/PART_SLOTSを
  // 選手1名向けに流用し、それ以外（消耗品・トレーニング用品・車・家）はマイライフ専用データを使う
  function mlBuyPart(pid) {
    setMl(s => {
      const p = PARTS[pid];
      if (!p || s.money < p.price || p.tier > s.classIdx + 1) return s;
      return { ...s, money: s.money - p.price, partsInv: { ...s.partsInv, [pid]: (s.partsInv[pid] || 0) + 1 } };
    });
  }
  function mlSetPart(slot, pid) {
    setMl(s => ({ ...s, player: { ...s.player, parts: { ...s.player.parts, [slot]: pid || null } } }));
  }
  function mlBuyGear(k) {
    setMl(s => {
      const it = ML_GEAR[k];
      if (!it || s.gear[k] || s.money < it.price) return s;
      return { ...s, money: s.money - it.price, gear: { ...s.gear, [k]: true } };
    });
  }
  function mlBuyStock(k) {
    setMl(s => {
      const it = ML_STOCK_ITEMS[k];
      if (!it || s.money < it.price) return s;
      return { ...s, money: s.money - it.price, stock: { ...s.stock, [k]: (s.stock[k] || 0) + 1 } };
    });
  }
  function mlUseStock(k) {
    setMl(s => {
      if ((s.stock[k] || 0) <= 0) return s;
      const it = ML_STOCK_ITEMS[k];
      const player = { ...s.player };
      if (it.fatigueDelta) player.fatigue = Math.max(0, Math.min(100, player.fatigue + it.fatigueDelta));
      if (it.condDelta) player.cond = Math.max(1, Math.min(5, player.cond + it.condDelta));
      return { ...s, player, stock: { ...s.stock, [k]: s.stock[k] - 1 } };
    });
  }
  function mlBuyCar() {
    setMl(s => {
      const next = s.carLv + 1;
      if (next >= ML_CARS.length || s.money < ML_CARS[next].price) return s;
      return { ...s, money: s.money - ML_CARS[next].price, carLv: next };
    });
  }
  function mlBuyHouse() {
    setMl(s => {
      const next = s.houseLv + 1;
      if (next >= ML_HOUSES.length || s.money < ML_HOUSES[next].price) return s;
      return { ...s, money: s.money - ML_HOUSES[next].price, houseLv: next };
    });
  }

  // ---- 購入・装備・アイテム ----
  const buyItem = (k) => { if (g.budget < ITEMS[k].price) return; setG(s => ({ ...s, budget: s.budget - ITEMS[k].price, inv: { ...s.inv, [k]: s.inv[k] + 1 } })); };
  const buyPart = (pid) => {
    if (g.budget < PARTS[pid].price || PARTS[pid].tier > g.classIdx + 1) return;
    setG(s => ({ ...s, budget: s.budget - PARTS[pid].price, partsInv: { ...s.partsInv, [pid]: (s.partsInv[pid] || 0) + 1 } }));
  };
  const setPart = (rid, slot, pid) => { setG(s => ({ ...s, roster: s.roster.map(r => r.id === rid ? { ...r, parts: { ...r.parts, [slot]: pid || null } } : r) })); };
  const buyEquip = (k) => {
    const lv = g.equip[k];
    if (lv >= equipMax || g.budget < EQUIP_COST[lv]) return;
    setG(s => ({ ...s, budget: s.budget - EQUIP_COST[lv], equip: { ...s.equip, [k]: lv + 1 } }));
  };
  // v11: スタッフは買い切りではなく月給制。レベルを上げると翌月から月給が増える（即時の費用はない）
  const hireStaff = (k) => {
    const lv = g.staff[k];
    if (lv >= staffMax) return;
    setG(s => ({ ...s, staff: { ...s.staff, [k]: lv + 1 } }));
  };
  const signScout = (sc) => {
    if (g.budget < sc.price || g.roster.length >= rosterMax) return;
    setG(s => ({
      ...s, budget: s.budget - sc.price, roster: [...s.roster, { ...sc.rider }],
      scouts: s.scouts.filter(x => x.rider.id !== sc.rider.id),
      log: [...s.log, `【${MONTHS[s.month]}】${sc.rider.name} が入団（${sc.tag}）— 真の能力が判明！`],
    }));
  };
  // v11: FA移籍市場。即決購入方式（新人スカウトと異なり能力は伏せず即座に表示）
  const signFa = (fa) => {
    if (g.budget < fa.price || g.roster.length >= rosterMax) return;
    setG(s => ({
      ...s, budget: s.budget - fa.price, roster: [...s.roster, { ...fa.rider }],
      faMarket: s.faMarket.filter(x => x.rider.id !== fa.rider.id),
      log: [...s.log, `【${MONTHS[s.month]}】${fa.rider.name}（${fa.age}歳）がFA移籍で入団`],
    }));
  };
  const useSupp = (rid) => { if (g.inv.supp <= 0) return; setG(s => ({ ...s, inv: { ...s.inv, supp: s.inv.supp - 1 }, roster: s.roster.map(r => r.id === rid ? { ...r, fatigue: Math.max(0, r.fatigue - 40) } : r) })); };
  const useTune = (rid) => { if (g.inv.tune <= 0) return; setG(s => ({ ...s, inv: { ...s.inv, tune: s.inv.tune - 1 }, roster: s.roster.map(r => r.id === rid ? { ...r, cond: Math.min(5, r.cond + 2) } : r) })); };
  const setFocus = (rid, focus) => setG(s => ({ ...s, roster: s.roster.map(r => r.id === rid ? { ...r, focus } : r) }));
  const useCamp = () => {
    if (g.inv.camp <= 0 || g.camp || g.campCooldown > 0) return;
    setG(s => ({ ...s, camp: true, campCooldown: 1, inv: { ...s.inv, camp: s.inv.camp - 1 } }));
  };
  // v13.1: お気に入り登録した選手は、殿堂入り条件（実績）を満たしていなくても必ず記録に残る
  const toggleFavorite = (rid) => {
    setG(s => ({ ...s, roster: s.roster.map(r => r.id === rid ? { ...r, favorite: !r.favorite } : r) }));
  };
  const releaseRider = (rid) => {
    if (g.month !== 0) return;
    setG(s => {
      if (s.roster.length <= 1) return s;
      const r = s.roster.find(x => x.id === rid);
      if (!r) return s;
      const roster = s.roster.filter(x => x.id !== rid);
      // v13.1: 能力・将来性次第でライバルチームに拾われる。拾われた場合は殿堂入りさせず
      // rivalAlumniで追跡し、そのチームで出走を続けさせる（いずれ引退した時点で改めて判定）
      const pickedUp = Math.random() < computePickupChance(r);
      if (pickedUp) {
        const signedTeam = RIVAL_TEAMS[Math.floor(Math.random() * RIVAL_TEAMS.length)].name;
        const rivalAlumni = [...s.rivalAlumni, { ...r, signedTeam, signedYear: s.year }];
        return {
          ...s, roster, rivalAlumni,
          log: [...s.log, `【${MONTHS[s.month]}】${r.name} を解雇 → ${signedTeam}が獲得したとの噂`],
        };
      }
      // v13.1: 殿堂入りは一定の実績かお気に入り登録がある選手のみ（無条件だとキリがない）
      const hallOfFame = isHallOfFameWorthy(r)
        ? [...s.hallOfFame, { ...r, farewellYear: s.year, farewellReason: "released" }]
        : s.hallOfFame;
      return { ...s, roster, hallOfFame, log: [...s.log, `【${MONTHS[s.month]}】${r.name} を解雇した`] };
    });
  };

  // ---- 共通 ----
  const Header = () => (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Eyebrow>{cls.label} — {g.year}年目 {MONTHS[g.month]}</Eyebrow>
          <div style={{ fontFamily: FONT_D, fontSize: 18, fontWeight: 700, color: C.text }}>チーム運営 v12</div>
          {g.sponsor && <div style={{ fontSize: 10.5, color: C.sub }}>SPONSOR: {g.sponsor.name}（月+{g.sponsor.monthly}万／ノルマ{g.sponsor.norma}pt／未達-{g.sponsor.penalty}万／指定レース{g.sponsor.mandatesMet}済{g.sponsor.mandatesMissed > 0 ? `・見送り${g.sponsor.mandatesMissed}` : ""}）</div>}
          <div style={{ fontSize: 10.5, color: C.sub }}>
            選手維持費 -{g.roster.length * UPKEEP_PER_RIDER}万/月（{g.roster.length}名）
            {staffSalaryTotal(g.staff) > 0 && <>／スタッフ月給 -{staffSalaryTotal(g.staff)}万/月</>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: FONT_M, fontSize: 18, color: g.budget < 0 ? C.red : C.yellow }}>{g.budget}<span style={{ fontSize: 10 }}>万円{g.budget < 0 ? "（借金）" : ""}</span></div>
          <div style={{ fontFamily: FONT_M, fontSize: 12, color: C.green }}>{g.points}pt <span style={{ color: C.sub }}>/ 出場権{cls.need}pt</span></div>
        </div>
      </div>
    </div>
  );
  const Nav = () => (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {[["home", "🏁 レース"], ["riders", "👥 選手・練習"], ["shop", "🛒 ショップ"], ["career", "📜 記録"], ["help", "📖 ヘルプ"]].map(([k, l]) => (
        <button key={k} onClick={() => setG(s => ({ ...s, tab: k }))}
          style={{
            flex: 1, padding: "9px 4px", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: FONT_D, cursor: "pointer",
            background: g.tab === k ? C.yellow : C.panel, color: g.tab === k ? "#14171d" : C.sub,
            border: `1px solid ${g.tab === k ? C.yellow : C.line}`,
          }}>{l}</button>
      ))}
    </div>
  );
  const wrap = (children, withNav) => (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT_B }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "6px 14px 40px" }}>
        <Header />
        {withNav && <Nav />}
        {children}
      </div>
      {/* v12バグ修正: window.confirm()に頼らない、アプリ内完結の確認モーダル */}
      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%", border: `1px solid ${C.line}` }}>
            <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-wrap" }}>{confirmDialog.message}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn small outline color={C.sub} onClick={() => setConfirmDialog(null)}>キャンセル</Btn>
              <Btn small color={C.red} onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }}>OK</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ================= v14: モード選択（タイトル） =================
  const mlWrap = (children) => (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT_B }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "6px 14px 40px" }}>
        {ml.player && (
          <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 12 }}>
            <Eyebrow>MY LIFE — {CLASSES[ml.classIdx].label} {ml.year}年目 {MONTHS[ml.month]}</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 16, fontWeight: 700, color: C.text }}>{ml.player.name}（{ml.team}）</div>
            <div style={{ fontSize: 11, color: C.sub }}>{ml.points}pt / 昇格権{CLASSES[ml.classIdx].need}pt</div>
            <div style={{ fontSize: 11, color: C.sub }}>所持金{ml.money}万円・年俸{ml.salary}万円</div>
          </div>
        )}
        {children}
      </div>
      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%", border: `1px solid ${C.line}` }}>
            <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-wrap" }}>{confirmDialog.message}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn small outline color={C.sub} onClick={() => setConfirmDialog(null)}>キャンセル</Btn>
              <Btn small color={C.red} onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }}>OK</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (superMode === null) return wrap(
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 18, border: `1px solid ${C.line}` }}>
        <Eyebrow>MODE SELECT — v14</Eyebrow>
        <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 21, margin: "6px 0 10px" }}>プレイモードを選んでください</h2>
        <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.7, margin: 0 }}>
          シーズンモードは6名のロースターを率いるチーム運営、マイライフモードは選手1人のキャリアをB1から歩む新モードです。
        </p>
      </div>
      <Btn onClick={() => setSuperMode("season")}>🏢 シーズンモード（チーム運営）</Btn>
      <Btn outline onClick={() => setSuperMode("mylife")}>🚴 マイライフモード（選手キャリア）</Btn>
    </div>
  );

  // ================= v14: マイライフモード 画面群 =================
  if (superMode === "mylife") {
    if (ml.screen === "mylife_create") {
      const typeOpts = Object.entries(TYPES);
      const bgOpts = Object.entries(ML_BACKGROUNDS);
      return mlWrap(
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 18, border: `1px solid ${C.line}` }}>
            <Eyebrow>MY LIFE — キャラクター作成</Eyebrow>
            <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.7, margin: "6px 0 0" }}>
              脚質と経歴を選んでB1のいずれかのチームに新人選手として加入します。
            </p>
          </div>
          {hasMyLifeSave() && (
            <Btn onClick={() => { const loaded = loadMyLifeGame(); if (loaded) setMl(loaded); }}>💾 続きから</Btn>
          )}
          <div>
            <Eyebrow>脚質</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {typeOpts.map(([k, t]) => (
                <button key={k} onClick={() => setMl(s => ({ ...s, typeChoice: k }))}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: ml.typeChoice === k ? "rgba(255,210,63,0.12)" : C.panel,
                    border: `1.5px solid ${ml.typeChoice === k ? C.yellow : C.line}`,
                  }}>
                  <span style={{ fontFamily: FONT_D, fontWeight: 700, color: t.color }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow>経歴（年齢・能力・伸びしろに影響）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {bgOpts.map(([k, b]) => (
                <button key={k} onClick={() => setMl(s => ({ ...s, bgChoice: k }))}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: ml.bgChoice === k ? "rgba(255,210,63,0.12)" : C.panel,
                    border: `1.5px solid ${ml.bgChoice === k ? C.yellow : C.line}`,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{b.label}</span>
                    <span style={{ fontSize: 11, color: C.sub }}>{b.age}歳スタート</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{b.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <Btn onClick={() => {
            const doCreate = () => { clearMyLifeSave(); mlCreateChar(ml.typeChoice, ml.bgChoice); };
            if (hasMyLifeSave()) askConfirm("保存データを消して新しい選手でキャリアを始めます。よろしいですか？", doCreate);
            else doCreate();
          }}>この内容でデビュー →</Btn>
          <Btn outline color={C.sub} onClick={() => setSuperMode(null)}>← モード選択に戻る</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_main" && ml.player) {
      const r = ml.player;
      const race = ml.races[0];
      const ph = growthPhase(r);
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>{r.name}</span>
              <div style={{ fontFamily: FONT_M, fontSize: 14, color: C.yellow }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></div>
            </div>
            {riderNickname(r) && <div style={{ fontSize: 12, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{riderNickname(r)}」</div>}
            <PersonaLine p={r.personality} />
            <TraitLine trait={r.trait} />
            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{riderFlavorText(r)}</div>
            <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.sub, margin: "4px 0", flexWrap: "wrap" }}>
              <span>{r.age}歳・{GROWTH[r.growth].label}・<span style={{ color: ph.tag === "全盛期" ? C.yellow : ph.tag === "衰え期" ? C.red : C.green }}>{ph.tag}</span></span>
              <span>成長<span style={{ color: POW[r.growthPow].color }}>{r.growthPow}</span></span>
            </div>
            <div style={{ fontSize: 10.5, color: C.sub }}>疲労（90超で故障リスク）</div>
            <FatigueBar v={r.fatigue} />
            <AbilityGrid r={r} />
            {(ml.stock.drink > 0 || ml.stock.supp > 0 || ml.stock.tune > 0) && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {ml.stock.drink > 0 && <Btn small outline color={C.green} onClick={() => mlUseStock("drink")}>{ML_STOCK_ITEMS.drink.label}(-30) ×{ml.stock.drink}</Btn>}
                {ml.stock.supp > 0 && <Btn small outline color={C.green} onClick={() => mlUseStock("supp")}>{ML_STOCK_ITEMS.supp.label}(-60) ×{ml.stock.supp}</Btn>}
                {ml.stock.tune > 0 && <Btn small outline color={C.green} onClick={() => mlUseStock("tune")}>{ML_STOCK_ITEMS.tune.label}(調子+1) ×{ml.stock.tune}</Btn>}
              </div>
            )}
          </div>
          {ml.directive && (
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
              <Eyebrow color={C.blue}>監督指示</Eyebrow>
              <div style={{ fontFamily: FONT_D, fontSize: 14, color: C.text, margin: "4px 0 2px" }}>{ml.directive.label}</div>
              <div style={{ fontSize: 11.5, color: C.sub }}>{ml.directive.desc}</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>
                監督評価: <span style={{ color: managerEvalTier(ml.managerEval).color, fontWeight: 700 }}>{managerEvalTier(ml.managerEval).label}</span>
              </div>
            </div>
          )}
          <div>
            <Eyebrow>今月の練習メニュー</Eyebrow>
            <select value={r.focus} onChange={e => mlSetFocus(e.target.value)}
              style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px", fontSize: 13, marginTop: 6 }}>
              {AB_KEYS.map(k => <option key={k} value={k}>{AB_LABEL[k]}強化</option>)}
            </select>
          </div>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
            <Eyebrow color={C.green}>今月のレース</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 14, color: C.text, margin: "4px 0" }}>{race.name}</div>
            <div style={{ fontSize: 11.5, color: C.sub }}>{race.tmpl.kind}・{"★".repeat(race.grade)}・{TYPES[race.tmpl.favors].label}有利</div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <Btn onClick={mlStartRace}>🏁 このレースに出場する</Btn>
            <Btn outline color={C.sub} onClick={() => mlAdvanceMonth("train")}>💪 練習する（能力強化・疲労+）</Btn>
            <Btn outline color={C.sub} onClick={() => mlAdvanceMonth("rest")}>😴 完全休養する（疲労回復のみ）</Btn>
            <Btn outline color={C.purple} onClick={mlTriggerEvent}>🎤 取材・私生活のイベントを受ける</Btn>
            <Btn outline color={"#e8a13c"} onClick={() => setMl(s => ({ ...s, screen: "mylife_shop" }))}>🛍 ショップに行く</Btn>
          </div>
          <Btn outline color={C.sub} onClick={() => askConfirm("マイライフモードを終了してタイトルに戻りますか？（自動セーブ済み）", () => setSuperMode(null))}>← タイトルに戻る</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_race" && ml.result) return mlWrap(
      <div>
        <div style={{ marginBottom: 8 }}><Eyebrow color={C.red}>LIVE — {ml.result.raceMeta.name}</Eyebrow></div>
        <RaceView sim={ml.result} onFinish={mlRaceFinish} />
        <div style={{ marginTop: 8, fontSize: 12, color: C.sub }}>● 印＝あなた。位置が近い選手同士が自然にグループを作ります。</div>
      </div>
    );

    if (ml.screen === "mylife_result" && ml.resultInfo) {
      const { race, rank, total, pts, directive, fulfilled, evalDelta, prize } = ml.resultInfo;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.yellow}` }}>
            <Eyebrow>RESULT — {race.name}</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 20, color: C.text, fontWeight: 700, margin: "6px 0" }}>{rank}位 / {total}人中</div>
            <div style={{ fontSize: 13.5, color: C.green }}>ポイント +{pts}pt ／ 賞金 +{prize}万円</div>
          </div>
          {directive && (
            <div style={{ background: fulfilled ? "#16241c" : "#241818", border: `1px solid ${fulfilled ? C.green : C.red}`, borderRadius: 10, padding: "10px 12px" }}>
              <Eyebrow color={fulfilled ? C.green : C.red}>監督指示 — {fulfilled ? "達成" : "未達成"}</Eyebrow>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>{directive.label}</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>監督評価 {evalDelta >= 0 ? "+" : ""}{evalDelta}</div>
            </div>
          )}
          <Btn onClick={() => mlAdvanceMonth("race")}>翌月へ進む →</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_shop" && ml.player) {
      const r = ml.player;
      const availPartsMl = (pid) => (ml.partsInv[pid] || 0) - (Object.values(r.parts || {}).includes(pid) ? 1 : 0);
      return mlWrap(
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
            <Eyebrow color={C.green}>SHOP — 所持金 {ml.money}万円</Eyebrow>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>年俸{ml.salary}万円/年（毎月{Math.round(ml.salary / 12)}万円が振り込まれます）</div>
          </div>
          <section>
            <Eyebrow color={C.purple}>マシンパーツ（クラス昇格で上位解禁）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(PARTS).map(([pid, p]) => {
                const lockedByClass = p.tier > ml.classIdx + 1;
                return (
                  <div key={pid} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, opacity: lockedByClass ? 0.5 : 1 }}>
                    <div>
                      <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                        {p.label} <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.purple }}>所持{ml.partsInv[pid] || 0}（空き{Math.max(0, availPartsMl(pid))}）</span>
                      </div>
                      <div style={{ color: C.sub, fontSize: 11 }}>[{SLOT_LABEL[p.slot]}] {Object.entries(p.ab).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join(" / ")}</div>
                    </div>
                    {lockedByClass
                      ? <span style={{ fontSize: 11, color: C.red, whiteSpace: "nowrap" }}>🔒 {CLASSES[p.tier - 1].id}で解禁</span>
                      : <Btn small color={C.purple} disabled={ml.money < p.price} onClick={() => mlBuyPart(pid)}>{p.price}万</Btn>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              {PART_SLOTS.map(slot => (
                <span key={slot} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 11, color: C.purple }}>{SLOT_LABEL[slot]}:</span>
                  <select value={r.parts[slot] || ""} onChange={e => mlSetPart(slot, e.target.value)}
                    style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 5px", fontSize: 11.5, maxWidth: 140 }}>
                    <option value="">— なし —</option>
                    {Object.entries(PARTS).filter(([pid, p]) => p.slot === slot && (availPartsMl(pid) > 0 || r.parts[slot] === pid))
                      .map(([pid, p]) => <option key={pid} value={pid}>{p.label}</option>)}
                  </select>
                </span>
              ))}
            </div>
          </section>
          <section>
            <Eyebrow color={C.green}>疲労回復グッズ（在庫制）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(ML_STOCK_ITEMS).map(([k, it]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{it.label} <span style={{ fontFamily: FONT_M, color: C.green }}>×{ml.stock[k] || 0}</span></div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{it.desc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn small outline color={C.green} disabled={ml.money < it.price} onClick={() => mlBuyStock(k)}>{it.price}万で購入</Btn>
                    <Btn small color={C.green} disabled={(ml.stock[k] || 0) <= 0} onClick={() => mlUseStock(k)}>使う</Btn>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <Eyebrow color={C.blue}>永続トレーニング用品（買い切り）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(ML_GEAR).map(([k, it]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{it.label}</div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{it.desc}</div>
                  </div>
                  {ml.gear[k]
                    ? <span style={{ fontSize: 11, color: C.green, whiteSpace: "nowrap" }}>✔ 購入済み</span>
                    : <Btn small color={C.blue} disabled={ml.money < it.price} onClick={() => mlBuyGear(k)}>{it.price}万</Btn>}
                </div>
              ))}
            </div>
          </section>
          <section>
            <Eyebrow color={"#e8a13c"}>車（レース参加の疲労蓄積を軽減）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {ML_CARS.map((c, i) => (
                <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${ml.carLv === i ? "#e8a13c" : C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{c.label}{ml.carLv === i && <span style={{ marginLeft: 6, fontSize: 10.5, color: "#e8a13c" }}>（所有中）</span>}</div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{c.desc}</div>
                  </div>
                  {ml.carLv >= i ? null : <Btn small color={"#e8a13c"} disabled={ml.money < c.price || ml.carLv !== i - 1} onClick={mlBuyCar}>{c.price}万</Btn>}
                </div>
              ))}
            </div>
          </section>
          <section>
            <Eyebrow color={C.red}>家（毎月の疲労回復を底上げ）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {ML_HOUSES.map((h, i) => (
                <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${ml.houseLv === i ? C.red : C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{h.label}{ml.houseLv === i && <span style={{ marginLeft: 6, fontSize: 10.5, color: C.red }}>（所有中）</span>}</div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{h.desc}</div>
                  </div>
                  {ml.houseLv >= i ? null : <Btn small color={C.red} disabled={ml.money < h.price || ml.houseLv !== i - 1} onClick={mlBuyHouse}>{h.price}万</Btn>}
                </div>
              ))}
            </div>
          </section>
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
          <Btn outline color={C.red} onClick={() => askConfirm("マイライフを最初からやり直しますか？保存データも消えます。", () => { clearMyLifeSave(); setMl(initMyLife()); })}>マイライフをリセット</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_event" && ml.pendingEvent) {
      const ev = ml.pendingEvent;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "#2b2436", border: `1px solid ${C.purple}`, borderRadius: 10, padding: "12px 14px" }}>
            <Eyebrow color={C.purple}>LIFE EVENT — {ev.title}</Eyebrow>
            <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0" }}>{ev.text}</p>
          </div>
          {ev.choices.map((c, i) => (
            <Btn key={i} color={C.purple} onClick={() => mlResolveEvent(i)}>{c.label}</Btn>
          ))}
        </div>
      );
    }

    if (ml.screen === "mylife_event_result") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, border: `1px solid ${C.line}` }}>
          <Eyebrow color={C.purple}>結果</Eyebrow>
          <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{ml.eventResultText}</p>
        </div>
        <Btn onClick={() => mlAdvanceMonth("event")}>翌月へ進む →</Btn>
      </div>
    );

    if (ml.screen === "mylife_contract" && ml.contractOffers) return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: "#2b2436", border: `1px solid ${C.purple}`, borderRadius: 10, padding: "10px 14px" }}>
          <Eyebrow color={C.purple}>CONTRACT — 移籍オファー</Eyebrow>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>好成績を残したあなたに、複数チームから声がかかっています。来季どのチームで走りますか？</div>
        </div>
        {ml.contractOffers.map((teamName, i) => (
          <Btn key={i} outline={i > 0} onClick={() => mlChooseTeam(teamName)}>
            {i === 0 ? `${teamName}に残留` : `${teamName}へ移籍`}
          </Btn>
        ))}
      </div>
    );

    if (ml.screen === "mylife_retired" && ml.player) {
      const r = ml.player;
      const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
      const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${C.yellow}`, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🏁</div>
            <h2 style={{ fontFamily: FONT_D, color: C.yellow, fontSize: 22, margin: "8px 0" }}>{r.name} 引退</h2>
            {riderNickname(r) && <div style={{ fontSize: 13, color: C.purple, fontStyle: "italic" }}>「{riderNickname(r)}」</div>}
          </div>
          <div style={{ fontSize: 11.5, color: C.text, padding: "8px 10px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.purple}`, lineHeight: 1.6 }}>
            {riderCareerSummary({ ...r, farewellYear: ml.year, farewellReason: "retired" })}
          </div>
          <div style={{ fontSize: 11.5, color: C.sub }}>通算{(r.raceLog || []).length}戦・{wins}勝・表彰台{podiums}回</div>
          <Btn onClick={() => { clearMyLifeSave(); setMl(initMyLife()); }}>新たな選手でキャリアを始める</Btn>
          <Btn outline color={C.sub} onClick={() => setSuperMode(null)}>← モード選択に戻る</Btn>
        </div>
      );
    }

    return mlWrap(<div style={{ color: C.sub }}>読み込み中…</div>);
  }

  // ================= 画面（シーズンモード） =================
  if (g.screen === "intro") return wrap(
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 18, border: `1px solid ${C.line}` }}>
        <Eyebrow>SEASON MODE v12</Eyebrow>
        <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 23, margin: "6px 0 10px" }}>B1からPROの頂点へ</h2>
        <p style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.8, margin: 0 }}>
          1年＝1シーズン、出場は月1回。3月のチャンピオンシップ3位以内で昇格。PROクラスのみ年3戦のグランツール
          （春・夏・秋）が開催され、その全戦制覇がグランファイナルへの出場条件。グランファイナル優勝でクリア。
        </p>
      </div>
      {hasSaveGame() && (
        <Btn onClick={() => { const loaded = loadGame(); if (loaded) setG(loaded); }}>💾 続きから</Btn>
      )}
      <Btn outline={hasSaveGame()} onClick={() => {
        const doReset = () => { clearSaveGame(); setG(s => ({ ...initGame(), screen: "newgame_setup" })); };
        if (hasSaveGame()) askConfirm("保存データを消して最初から始めます。よろしいですか？", doReset);
        else doReset();
      }}>
        {hasSaveGame() ? "最初から（保存データは消えます）" : "スカウト方針の確認へ"}
      </Btn>
    </div>
  );

  if (g.screen === "newgame_setup") {
    const meta = loadMeta();
    const nextMilestone = CP_MILESTONES.find(m => meta.totalEarnedCP < m.cp);
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, border: `1px solid ${C.line}` }}>
          <Eyebrow color={C.yellow}>累計クリアポイント：{meta.totalEarnedCP}pt</Eyebrow>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>過去のプレイでクリアするたびに貯まっていく生涯合計値です。一度到達した永続ボーナス・難易度は消費しても失われません。</div>
        </div>
        <div>
          <Eyebrow>難易度を選択</Eyebrow>
          <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
            {DIFFICULTIES.map(d => {
              const locked = meta.totalEarnedCP < d.needCP;
              return (
                <button key={d.id} disabled={locked} onClick={() => setDiffChoice(d.id)}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: locked ? "default" : "pointer",
                    background: diffChoice === d.id ? "rgba(255,210,63,0.12)" : C.panel,
                    border: `1.5px solid ${diffChoice === d.id ? C.yellow : C.line}`, opacity: locked ? 0.5 : 1,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 14 }}>{d.label}</span>
                    {locked && <span style={{ fontSize: 11, color: C.red }}>🔒 累計{d.needCP}pt必要</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{d.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Eyebrow>永続ボーナス（累計クリアポイントで自動解禁・消費なし）</Eyebrow>
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {CP_MILESTONES.map((m, i) => {
              const unlocked = meta.totalEarnedCP >= m.cp;
              const jackpot = m.label.startsWith("★");
              const accent = jackpot ? C.yellow : C.green;
              return (
                <div key={i} style={{
                  padding: jackpot ? "11px 12px" : "9px 12px", borderRadius: 10,
                  background: unlocked ? (jackpot ? "rgba(255,210,63,0.12)" : "rgba(125,208,160,0.1)") : C.panel,
                  border: `${jackpot ? 2 : 1.5}px solid ${unlocked ? accent : C.line}`, opacity: unlocked ? 1 : (jackpot ? 0.75 : 0.6),
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: unlocked ? accent : C.text, fontSize: jackpot ? 14.5 : 13.5 }}>
                      {unlocked ? "✔ " : "🔒 "}{m.label}
                    </span>
                    <span style={{ fontFamily: FONT_M, fontSize: 11.5, color: C.sub }}>累計{m.cp}pt</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{m.desc}</div>
                </div>
              );
            })}
          </div>
          {nextMilestone && <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>次のボーナスまであと{nextMilestone.cp - meta.totalEarnedCP}pt</div>}
        </div>
        <Btn onClick={() => {
          const base = applyCpMilestones({ ...initGame(), difficulty: diffChoice }, meta.totalEarnedCP);
          setG({ ...base, screen: "scoutpolicy_initial" });
        }}>この内容でゲーム開始 →</Btn>
        <Btn outline color={C.red} onClick={() => {
          // v14.11: 生涯合計値の消去は取り消せないため、二重確認（2段階の確認モーダル）を挟む
          askConfirm(
            `累計クリアポイント（${meta.totalEarnedCP}pt）と、それに紐づく永続ボーナス・難易度解禁をすべて消去します。この操作は取り消せません。よろしいですか？`,
            () => askConfirm(
              "本当によろしいですか？もう一度確認します。クリアポイントは元に戻せません。",
              () => { saveMeta({ totalEarnedCP: 0 }); setDiffChoice("easy"); setG(s => ({ ...s })); }
            )
          );
        }}>クリアポイントをリセット（累計{meta.totalEarnedCP}pt消去）</Btn>
      </div>
    );
  }

  if (g.screen === "scoutpolicy_initial") return wrap(
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#1f2b26", border: `1px solid ${C.green}`, borderRadius: 10, padding: "10px 14px" }}>
        <Eyebrow color={C.green}>SCOUT POLICY — 初年度（4月）のスカウト方針</Eyebrow>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>4月に提示される新人候補5名の傾向を決めます。方針は毎年3月にも見直せます。</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(SCOUT_POLICIES).map(([k, p]) => (
          <button key={k} onClick={() => setG(s => ({ ...s, scoutPolicy: k }))} title={p.desc}
            style={{
              padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT_D,
              background: g.scoutPolicy === k ? C.purple : C.panel, color: g.scoutPolicy === k ? "#14171d" : C.sub,
              border: `1px solid ${g.scoutPolicy === k ? C.purple : C.line}`,
            }}>{p.label}</button>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: C.text }}>方針：{SCOUT_POLICIES[g.scoutPolicy].desc}</div>
      {/* v12バグ修正: initGame()の初期スカウト候補を先にランダム化しても、ここで固定シード4001を
          使ってgenScoutsを呼び直し上書きしていたため、方針決定ボタンを押すと結局毎回同じ顔ぶれに
          戻ってしまっていた。ここも新規ゲームのたびに変わる乱数シードを使うよう修正 */}
      <Btn onClick={() => setG(s => ({ ...s, scouts: genScouts(0, Date.now() % 999983, s.scoutPolicy, s.roster.map(r => r.name)), screen: "sponsor" }))}>この方針で決定 → スポンサー選択へ</Btn>
    </div>
  );

  if (g.screen === "sponsor") return wrap(
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: C.panel, borderRadius: 10, padding: "10px 14px", borderLeft: `4px solid ${C.green}` }}>
        <Eyebrow color={C.green}>SPONSOR — 今季のメインスポンサーを選択</Eyebrow>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>毎月の契約金＋ノルマ達成で年度末ボーナス。<span style={{ color: C.red }}>未達なら違約金</span>、<span style={{ color: C.red }}>指定レースを見送るとさらに違約金</span>が加算されます。</div>
      </div>
      {g.sponsorOffers.map((sp, i) => (
        <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontFamily: FONT_D, fontSize: 16, fontWeight: 700, color: C.text }}>{sp.name}</div>
            <span style={{ fontSize: 11, color: sp.style === "挑戦型" ? C.red : sp.style === "安定型" ? C.blue : C.yellow }}>{sp.style}</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.sub, margin: "4px 0 8px", lineHeight: 1.7 }}>
            月額 <span style={{ color: C.green, fontFamily: FONT_M }}>+{sp.monthly}万</span>
            ／ノルマ <span style={{ color: C.yellow, fontFamily: FONT_M }}>{sp.norma}pt</span><br />
            達成 <span style={{ color: C.green, fontFamily: FONT_M }}>+{sp.bonus}万</span>
            ／未達 <span style={{ color: C.red, fontFamily: FONT_M }}>-{sp.penalty}万</span><br />
            年間指定レース <span style={{ color: C.text, fontFamily: FONT_M }}>{sp.mandates}回</span>（出場でpt+30%ボーナス／見送ると-15万ずつ加算）
          </div>
          <Btn small color={C.green} onClick={() => setG(s => {
            const months = pickMandateMonths(sp.mandates, s.year * 555 + i * 91 + s.classIdx * 13);
            const sponsor = { ...sp, mandateMonths: months, mandatesMet: 0, mandatesMissed: 0 };
            return { ...s, sponsor, screen: "main", log: [...s.log, `【${MONTHS[s.month]}】${sp.name}と契約（ノルマ${sp.norma}pt／違約金${sp.penalty}万／指定レース${months.length}回）`] };
          })}>この契約を結ぶ</Btn>
        </div>
      ))}
    </div>
  );

  if (g.screen === "main") {
    let body = null;
    if (g.tab === "home") {
      const isMandateMonth = g.sponsor && g.sponsor.mandateMonths.includes(g.month);
      body = (
        <div style={{ display: "grid", gap: 10 }}>
          {g.budget < 0 && <div style={{ background: "#2e2124", border: `1px solid ${C.red}`, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: C.red }}>💸 借金状態です。賞金とスポンサー収入で返済しましょう（返済まで買い物不可）。</div>}
          {isMandateMonth && (
            <div style={{ background: "#2e2124", border: `1px solid ${C.red}`, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: C.red }}>
              🎯 今月はスポンサー指定月間です。下の🎯マーク付きレースに出場するとポイント+30%、見送ると違約金-15万が年度末に加算されます。
            </div>
          )}
          {g.month === 11 && (
            <div style={{ background: "#2b2436", border: `1px solid ${C.purple}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 13, color: C.purple, fontWeight: 700 }}>3月 — チャンピオンシップ月間／来季スカウト方針の決定</div>
              <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                {Object.entries(SCOUT_POLICIES).map(([k, p]) => (
                  <button key={k} onClick={() => setG(s => ({ ...s, scoutPolicy: k }))} title={p.desc}
                    style={{
                      padding: "5px 9px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT_D,
                      background: g.scoutPolicy === k ? C.purple : C.panel, color: g.scoutPolicy === k ? "#14171d" : C.sub,
                      border: `1px solid ${g.scoutPolicy === k ? C.purple : C.line}`,
                    }}>{p.label}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>方針：{SCOUT_POLICIES[g.scoutPolicy].desc}（4月の候補5名に反映）</div>
            </div>
          )}
          {g.month === 0 && <div style={{ background: "#1f2b26", border: `1px solid ${C.green}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, color: C.green }}>4月 — 新人スカウト月間（方針：{SCOUT_POLICIES[g.scoutPolicy].label}）</div>}
          <Eyebrow>今月のレースカレンダー（出場は月1回）</Eyebrow>
          {g.races.map(r => {
            const mul = CLASSES[r.cls].prizeMul * GRADE_MUL[r.grade];
            const enough = healthy.length >= r.tmpl.squadMin;
            const squadLabel = r.tmpl.squadMin === r.tmpl.squadMax ? `${r.tmpl.squadMin}名` : `${r.tmpl.squadMin}〜${r.tmpl.squadMax}名`;
            return (
              <div key={r.id} style={{
                background: (r.championship || r.grandTour) ? "#2b2436" : C.panel, borderRadius: 10, padding: "10px 12px",
                border: `1.5px solid ${r.sponsorMandate ? C.red : (r.championship || r.grandTour) ? C.purple : C.line}`, opacity: r.locked ? 0.55 : 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>
                    {r.championship ? "👑 " : ""}{r.grandTour ? "🌍 " : ""}{r.sponsorMandate ? "🎯 " : ""}{r.name}
                  </div>
                  <div style={{ fontFamily: FONT_M, fontSize: 12, color: C.yellow }}>{"★".repeat(r.grade)}</div>
                </div>
                <div style={{ display: "flex", gap: 3, margin: "6px 0 4px" }}>
                  {r.tmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 6, borderRadius: 3, background: SEG_COLOR[s[0]] }} />)}
                </div>
                <div style={{ fontSize: 11.5, color: C.sub }}>
                  {r.tmpl.kind}・出走{squadLabel}・{TYPES[r.tmpl.favors].label}有利／優勝 約{Math.round(PRIZES[0] * mul)}万・{Math.round(PTS[0] * GRADE_MUL[r.grade])}pt
                  {r.sponsorMandate && <span style={{ color: C.red }}>／スポンサー指定レース</span>}
                  {r.stageRace && <span style={{ color: C.purple }}>／{r.stageCount || 2}日間ステージレース(総合)</span>}
                </div>
                <div style={{ marginTop: 8 }}>
                  {r.locked
                    ? <span style={{ fontSize: 12, color: C.red }}>🔒 {r.lockReason}</span>
                    : <Btn small disabled={!enough} onClick={() => setG(s => {
                        const defN = Math.max(r.tmpl.squadMin, Math.min(r.tmpl.squadMax, healthy.length));
                        return { ...s, sel: { ...s.sel, raceId: r.id, starters: [], ace: null, roles: {}, squadN: defN }, screen: "lineup" };
                      })}>
                        {enough ? "このレースに出場" : `出走可能${healthy.length}名（最低${r.tmpl.squadMin}名必要）`}
                      </Btn>}
                </div>
              </div>
            );
          })}
          <Btn outline color={C.sub} onClick={() => advanceMonth(null)}>翌月へ進む（今月は休養：全員の疲労-50）</Btn>
          <Btn outline color={C.blue} onClick={() => setG(s => ({ ...s, screen: "program" }))}>📅 年間レースプログラムを見る</Btn>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small outline color={C.green} onClick={() => {
              const ok = saveGame(g);
              setG(s => ({ ...s, log: [...s.log, ok ? `【${MONTHS[s.month]}】セーブしました` : "セーブに失敗しました（ブラウザの保存領域を確認してください）"] }));
            }}>💾 セーブ</Btn>
            <Btn small outline color={C.sub} onClick={() => {
              askConfirm("タイトルに戻ります。セーブ済みのデータは消えません。よろしいですか？", () => {
                setG(s => ({ ...s, screen: "intro" }));
              });
            }}>🏠 タイトルに戻る</Btn>
          </div>
          {g.log.length > 0 && (
            <div style={{ background: C.panel2, borderRadius: 10, padding: "8px 12px" }}>
              <Eyebrow color={C.sub}>TEAM LOG</Eyebrow>
              {g.log.slice(-4).map((l, i) => <div key={i} style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>{l}</div>)}
            </div>
          )}
        </div>
      );
    }
    if (g.tab === "riders") {
      body = (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, color: C.sub }}>
            所属 {g.roster.length}/{rosterMax}名。<span style={{ color: C.yellow }}>能力{growthCap}以上＝限界突破</span>（金色表示・成長が大幅に鈍化。難易度「{(DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).label}」の成長上限）。練習指定能力の伸びはトレードオフ（×0.9）で指定外に一部融通されます。
          </div>
          {g.inv.camp > 0 && !g.camp && g.campCooldown === 0 && <Btn small outline color={C.purple} onClick={useCamp}>⛺ キャンプ券を使う（今月の練習効果×2）</Btn>}
          {g.inv.camp > 0 && !g.camp && g.campCooldown > 0 && <div style={{ fontSize: 11.5, color: C.sub }}>⛺ キャンプ券は連続使用できません（来月から使用可）</div>}
          {g.camp && <div style={{ fontSize: 12, color: C.purple }}>⛺ 今月はトレーニングキャンプ実施中（練習効果×2）</div>}
          {g.month === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>4月は選手の解雇が可能です（各選手カードの「解雇」ボタン）。</div>}
          {g.roster.map(r => {
            const t = TYPES[r.type], ph = growthPhase(r);
            return (
              <div key={r.id} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${r.injury > 0 ? C.red : C.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>{r.name}</span>
                    <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color, border: `1px solid ${t.color}`, borderRadius: 4, padding: "1px 5px" }}>{t.label}</span>
                    <span style={{ marginLeft: 5, fontFamily: FONT_M, fontSize: 12, color: POW[r.growthPow].color }}>成長{r.growthPow}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => toggleFavorite(r.id)} title="お気に入り登録（殿堂入りが確約されます）"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0, color: r.favorite ? C.yellow : C.sub }}>
                      {r.favorite ? "★" : "☆"}
                    </button>
                    <div style={{ fontFamily: FONT_M, fontSize: 14, color: C.yellow }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></div>
                    {g.month === 0 && <Btn small outline color={C.red} onClick={() => askConfirm(`${r.name}を解雇しますか？`, () => releaseRider(r.id))}>解雇</Btn>}
                  </div>
                </div>
                {riderNickname(r) && <div style={{ fontSize: 12, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{riderNickname(r)}」</div>}
                <PersonaLine p={r.personality} />
                <TraitLine trait={r.trait} />
                <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{riderFlavorText(r)}</div>
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.sub, margin: "4px 0", flexWrap: "wrap" }}>
                  <span>{r.age}歳・{GROWTH[r.growth].label}・<span style={{ color: ph.tag === "全盛期" ? C.yellow : ph.tag === "衰え期" ? C.red : C.green }}>{ph.tag}</span></span>
                  <span>調子 <span style={{ color: COND_COLOR[r.cond - 1], fontFamily: FONT_M }}>{COND_ARROW[r.cond - 1]}</span></span>
                  {r.streak > 0 && <span style={{ color: r.streak >= 2 ? C.red : "#e8a13c" }}>連闘{r.streak}{r.streak >= 2 ? "（次で故障！）" : ""}</span>}
                  {r.injury > 0 && <span style={{ color: C.red }}>🏥 故障 残{r.injury}ヶ月</span>}
                </div>
                <div style={{ fontSize: 10.5, color: C.sub }}>疲労（90超で故障リスク）</div>
                <FatigueBar v={r.fatigue} />
                <AbilityGrid r={r} cap={growthCap} />
                <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>種目別適性</div>
                <DisciplineGrid r={r} />
                <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: C.sub }}>練習:</span>
                  <select value={r.focus} onChange={e => setFocus(r.id, e.target.value)}
                    style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 6px", fontSize: 12 }}>
                    {AB_KEYS.map(k => <option key={k} value={k}>{AB_LABEL[k]}強化</option>)}
                    <option value="rest">休養（疲労-15）</option>
                  </select>
                  {g.inv.supp > 0 && r.fatigue > 30 && <Btn small outline color={C.green} onClick={() => useSupp(r.id)}>サプリ(-40)</Btn>}
                  {g.inv.tune > 0 && r.cond < 5 && <Btn small outline color={C.green} onClick={() => useTune(r.id)}>調律(調子+2)</Btn>}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                  {PART_SLOTS.map(slot => (
                    <span key={slot} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: C.purple }}>{SLOT_LABEL[slot]}:</span>
                      <select value={r.parts[slot] || ""} onChange={e => setPart(r.id, slot, e.target.value)}
                        style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 5px", fontSize: 11.5, maxWidth: 140 }}>
                        <option value="">— なし —</option>
                        {Object.entries(PARTS).filter(([pid, p]) => p.slot === slot && (availParts(pid) > 0 || r.parts[slot] === pid))
                          .map(([pid, p]) => <option key={pid} value={pid}>{p.label}</option>)}
                      </select>
                    </span>
                  ))}
                </div>
                <Btn small outline color={C.sub} onClick={() => setExpandedRiderId(expandedRiderId === r.id ? null : r.id)}
                  style={{ marginTop: 8 }}>
                  {expandedRiderId === r.id ? "▲ 戦績を閉じる" : `▼ 戦績を見る（${(r.raceLog || []).length}戦）`}
                </Btn>
                {expandedRiderId === r.id && (
                  <div style={{ marginTop: 6, background: C.panel2, borderRadius: 8, padding: "6px 10px", maxHeight: 200, overflowY: "auto" }}>
                    {(!r.raceLog || r.raceLog.length === 0) && <div style={{ fontSize: 11.5, color: C.sub }}>まだ出走記録がありません。</div>}
                    {[...(r.raceLog || [])].reverse().map((e, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "3px 0", borderBottom: i < r.raceLog.length - 1 ? `1px solid ${C.line}` : "none" }}>
                        <span style={{ color: C.sub }}>{e.year}年目 {MONTHS[e.month]}</span>
                        <span style={{ color: C.text, flex: 1, margin: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                        <span style={{ fontFamily: FONT_M, color: e.rank === 1 ? C.yellow : e.rank <= 3 ? C.green : C.sub, fontWeight: 700 }}>{e.rank}位</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    if (g.tab === "shop") {
      body = (
        <div style={{ display: "grid", gap: 14 }}>
          {g.month === 0 && (
            <section>
              <Eyebrow color={C.green}>APRIL DRAFT — 新人スカウト（方針：{SCOUT_POLICIES[g.scoutPolicy].label}）</Eyebrow>
              <div style={{ fontSize: 11.5, color: C.sub, margin: "4px 0 8px" }}>能力は推定レンジ表示。契約するまで真の値は分かりません。</div>
              <div style={{ display: "grid", gap: 8 }}>
                {g.scouts.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>今年の候補は全員契約済み、または見送りました。</div>}
                {g.scouts.map(sc => {
                  const r = sc.rider, t = TYPES[r.type];
                  return (
                    <div key={r.id} style={{ background: r.prodigy ? "#2b2410" : C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${r.prodigy ? C.yellow : C.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                        <div>
                          {r.prodigy && <span style={{ marginRight: 6, fontSize: 10.5, color: C.yellow, fontWeight: 700 }}>🌟逸材</span>}
                          <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 15 }}>{r.name}</span>
                          <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                        </div>
                        <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 13 }}>{sc.ovrMin}〜{sc.ovrMax}<span style={{ fontSize: 9, color: C.sub }}> OVR?</span></span>
                      </div>
                      <div style={{ fontSize: 11.5, color: C.sub, margin: "3px 0" }}>{sc.tag}・{r.age}歳・{GROWTH[r.growth].label}型・成長<span style={{ color: POW[r.growthPow].color }}>{r.growthPow}</span></div>
                      <PersonaLine p={r.personality} />
                      <TraitLine trait={r.trait} />
                      <BlurGrid blur={sc.blur} />
                      <div style={{ marginTop: 8 }}>
                        <Btn small color={C.green} disabled={g.budget < sc.price || g.roster.length >= rosterMax} onClick={() => signScout(sc)}>
                          {g.roster.length >= rosterMax ? "ロースター満員" : `${sc.price}万円で契約`}
                        </Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          <section>
            <Eyebrow color={C.green}>FA移籍市場（能力は公開済み・即決購入）</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, margin: "4px 0 8px" }}>新人スカウトと違い、既に実績のある選手を能力そのままで獲得できます。毎月全入れ替え。</div>
            <div style={{ display: "grid", gap: 8 }}>
              {g.faMarket.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>今月の候補は全員契約済みです。</div>}
              {g.faMarket.map(fa => {
                const r = fa.rider, t = TYPES[r.type];
                const full = g.roster.length >= rosterMax;
                return (
                  <div key={r.id} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <div>
                        <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 15 }}>{r.name}</span>
                        <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                      </div>
                      <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 13 }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></span>
                    </div>
                    <div style={{ fontSize: 11.5, color: C.sub, margin: "3px 0" }}>{fa.age}歳・{GROWTH[r.growth].label}型・成長<span style={{ color: POW[r.growthPow].color }}>{r.growthPow}</span></div>
                    <PersonaLine p={r.personality} />
                    <TraitLine trait={r.trait} />
                    <AbilityGrid r={r} cap={growthCap} />
                    <div style={{ marginTop: 8 }}>
                      <Btn small color={C.green} disabled={g.budget < fa.price || full} onClick={() => signFa(fa)}>
                        {full ? "ロースター満員（4月に解雇で空き作成）" : `${fa.price}万円で獲得`}
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={C.purple}>マシンパーツ（クラス昇格で上位解禁）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(PARTS).map(([pid, p]) => {
                const lockedByClass = p.tier > g.classIdx + 1;
                return (
                  <div key={pid} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, opacity: lockedByClass ? 0.5 : 1 }}>
                    <div>
                      <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                        {p.tier > 1 && <span style={{ color: p.tier === 3 ? C.yellow : C.green, fontSize: 10.5 }}>[{CLASSES[p.tier - 1].id}] </span>}
                        {p.label} <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.purple }}>所持{g.partsInv[pid] || 0}（空き{Math.max(0, availParts(pid))}）</span>
                      </div>
                      <div style={{ color: C.sub, fontSize: 11 }}>[{SLOT_LABEL[p.slot]}] {Object.entries(p.ab).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join(" / ")}</div>
                    </div>
                    {lockedByClass
                      ? <span style={{ fontSize: 11, color: C.red, whiteSpace: "nowrap" }}>🔒 {CLASSES[p.tier - 1].id}で解禁</span>
                      : <Btn small color={C.purple} disabled={g.budget < p.price} onClick={() => buyPart(pid)}>{p.price}万</Btn>}
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={C.purple}>消耗品（在庫制）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(ITEMS).map(([k, it]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{it.label} <span style={{ fontFamily: FONT_M, color: C.purple }}>×{g.inv[k]}</span></div>
                    <div style={{ color: C.sub, fontSize: 11.5 }}>{it.desc}</div>
                  </div>
                  <Btn small color={C.purple} disabled={g.budget < it.price} onClick={() => buyItem(k)}>{it.price}万</Btn>
                </div>
              ))}
              {g.inv.camp > 0 && !g.camp && g.campCooldown === 0 && <Btn small outline color={C.purple} onClick={useCamp}>キャンプ券を使う（今月の練習×2）</Btn>}
              {g.inv.camp > 0 && !g.camp && g.campCooldown > 0 && <div style={{ fontSize: 11.5, color: C.sub }}>⛺ 連続使用不可（来月から使用可）</div>}
              {g.camp && <div style={{ fontSize: 12, color: C.purple }}>⛺ 今月はトレーニングキャンプ実施中（練習効果×2）</div>}
            </div>
          </section>
          <section>
            <Eyebrow color={C.red}>チーム機材（Lv上限：{cls.id}＝{equipMax}）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(EQUIPS).map(([k, eq]) => {
                const lv = g.equip[k], cost = lv >= equipMax ? null : EQUIP_COST[lv];
                return (
                  <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{eq.label} <span style={{ fontFamily: FONT_M, color: C.yellow }}>Lv{lv}/{equipMax}</span></div>
                      <div style={{ color: C.sub, fontSize: 11.5 }}>{eq.desc}</div>
                    </div>
                    <Btn small color={C.red} disabled={lv >= equipMax || g.budget < cost} onClick={() => buyEquip(k)}>
                      {lv >= equipMax ? (g.classIdx < 2 ? "昇格で解禁" : "MAX") : `${cost}万`}
                    </Btn>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <Eyebrow color={C.red}>スタッフ（月給制・Lv上限：{cls.id}＝{staffMax}）</Eyebrow>
            {staffMax === 0 ? (
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>A昇格で雇用が解禁されます。</div>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                {Object.entries(STAFF_ROLES).map(([k, st]) => {
                  const lv = g.staff[k];
                  return (
                    <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{st.label} <span style={{ fontFamily: FONT_M, color: C.yellow }}>Lv{lv}/{staffMax}</span></div>
                        <div style={{ color: C.sub, fontSize: 11.5 }}>{st.desc}</div>
                      </div>
                      <Btn small color={C.red} disabled={lv >= staffMax} onClick={() => hireStaff(k)}>
                        {lv >= staffMax ? (g.classIdx < 2 ? "昇格で解禁" : "MAX") : `月給+${STAFF_SALARY_PER_LV}万`}
                      </Btn>
                    </div>
                  );
                })}
                <div style={{ fontSize: 10.5, color: C.sub }}>スタッフ月給合計 -{staffSalaryTotal(g.staff)}万/月</div>
              </div>
            )}
          </section>
          <Btn outline color={C.sub} onClick={() => askConfirm("最初からやり直しますか？セーブデータも消えます。", () => { clearSaveGame(); setG(initGame()); })}>ゲームをリセット</Btn>
        </div>
      );
    }
    if (g.tab === "career") {
      const cs = g.careerStats;
      const history = [...g.careerHistory].reverse();
      const hof = [...g.hallOfFame].reverse();
      body = (
        <div style={{ display: "grid", gap: 12 }}>
          <Eyebrow color={C.yellow}>キャリア通算成績</Eyebrow>
          <div style={{ background: C.panel, borderRadius: 12, padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><div style={{ fontSize: 11, color: C.sub }}>通算出走レース</div><div style={{ fontFamily: FONT_M, fontSize: 20, color: C.text }}>{cs.totalRaces}</div></div>
            <div><div style={{ fontSize: 11, color: C.sub }}>通算優勝</div><div style={{ fontFamily: FONT_M, fontSize: 20, color: C.yellow }}>{cs.totalWins}</div></div>
            <div><div style={{ fontSize: 11, color: C.sub }}>通算表彰台（3位以内）</div><div style={{ fontFamily: FONT_M, fontSize: 20, color: C.green }}>{cs.totalPodiums}</div></div>
            <div><div style={{ fontSize: 11, color: C.sub }}>自己ベスト着順</div><div style={{ fontFamily: FONT_M, fontSize: 20, color: C.text }}>{cs.bestFinish ? `${cs.bestFinish}位` : "—"}</div></div>
            <div style={{ gridColumn: "1 / -1" }}><div style={{ fontSize: 11, color: C.sub }}>通算獲得賞金</div><div style={{ fontFamily: FONT_M, fontSize: 20, color: C.text }}>{cs.totalPrize}万円</div></div>
          </div>
          <Eyebrow color={C.sub}>年度別記録</Eyebrow>
          {history.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>まだ年度を終えていません。3月のチャンピオンシップを終えると記録が積み重なります。</div>}
          <div style={{ background: C.panel, borderRadius: 12, padding: "8px 12px", display: "grid", gap: 6 }}>
            {history.map((h, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 4px", borderBottom: i < history.length - 1 ? `1px solid ${C.line}` : "none", fontSize: 12.5 }}>
                <span style={{ color: C.text }}>{h.year}年目・{h.classLabel}</span>
                <span style={{ color: C.sub, fontFamily: FONT_M }}>{h.points}pt{h.champBest ? `／CS ${h.champBest}位` : ""}</span>
                <span style={{ color: h.promoted ? C.green : h.relegated ? C.red : C.sub, fontWeight: 700 }}>
                  {h.promoted ? "🎉 昇格" : h.relegated ? "😞 降格" : "残留"}
                </span>
              </div>
            ))}
          </div>
          <Eyebrow color={C.purple}>🏛 殿堂入り選手名鑑</Eyebrow>
          {hof.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>引退・退団した選手はまだいません。</div>}
          <div style={{ display: "grid", gap: 8 }}>
            {hof.map((r, i) => {
              const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
              const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
              const rid = `hof-${r.id}-${i}`;
              return (
                <div key={rid} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.purple}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div>
                      <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 14.5 }}>{r.name}</span>
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: TYPES[r.type].color }}>{TYPES[r.type].label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: C.sub }}>
                      {r.farewellReason === "retired" && `${r.farewellYear}年目 引退`}
                      {r.farewellReason === "released" && `${r.farewellYear}年目 退団`}
                      {r.farewellReason === "rival_retired" && `${r.farewellYear}年目 引退（${r.signedTeam}）`}
                    </span>
                  </div>
                  {r.signedTeam && <div style={{ fontSize: 11, color: C.red, marginTop: 1 }}>🔀 解雇後、{r.signedTeam}に拾われて現役を続けた</div>}
                  {r.favorite && <div style={{ fontSize: 10.5, color: C.yellow, marginTop: 1 }}>★ お気に入り登録選手</div>}
                  {riderNickname(r) && <div style={{ fontSize: 12, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{riderNickname(r)}」</div>}
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{riderFlavorText(r)}</div>
                  <div style={{ fontSize: 11.5, color: C.text, marginTop: 5, padding: "6px 8px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.purple}`, lineHeight: 1.6 }}>
                    {riderCareerSummary(r)}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>通算{(r.raceLog || []).length}戦・{wins}勝・表彰台{podiums}回</div>
                  <Btn small outline color={C.sub} style={{ marginTop: 6 }} onClick={() => setExpandedRiderId(expandedRiderId === rid ? null : rid)}>
                    {expandedRiderId === rid ? "▲ 戦績を閉じる" : "▼ 戦績を見る"}
                  </Btn>
                  {expandedRiderId === rid && (
                    <div style={{ marginTop: 6, background: C.panel2, borderRadius: 8, padding: "6px 10px", maxHeight: 200, overflowY: "auto" }}>
                      {(!r.raceLog || r.raceLog.length === 0) && <div style={{ fontSize: 11.5, color: C.sub }}>出走記録がありません。</div>}
                      {[...(r.raceLog || [])].reverse().map((e, j) => (
                        <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "3px 0", borderBottom: j < r.raceLog.length - 1 ? `1px solid ${C.line}` : "none" }}>
                          <span style={{ color: C.sub }}>{e.year}年目 {MONTHS[e.month]}</span>
                          <span style={{ color: C.text, flex: 1, margin: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                          <span style={{ fontFamily: FONT_M, color: e.rank === 1 ? C.yellow : e.rank <= 3 ? C.green : C.sub, fontWeight: 700 }}>{e.rank}位</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    if (g.tab === "help") {
      const roleRows = Object.entries(ROLES).map(([k, v]) => ({ key: k, ...v }));
      const ROLE_PROS_CONS = {
        lead: { pro: "エースを最後まで牽引。最も信頼できる基本役割", con: "脚質が合わなくても最後まで牽引を続けるため、コースと合わないと非効率になりがち" },
        sub: { pro: "第一アシストを後方から支援し、序盤の消耗を分散できる", con: "脚がなくなると早期に離脱し、そこから先の牽引には貢献できない" },
        mountain: { pro: "山岳・山頂フィニッシュ区間で牽引力を発揮。平坦区間は温存できる", con: "平坦・丘陵中心のコースでは牽引せず、実質的に消耗するだけの手駒になる" },
        flat: { pro: "平坦・丘陵区間の牽引に強く、山岳の少ないコースで安定して働く", con: "山岳区間に入ると牽引せず自然に遅れていく（そこから先は温存扱い）" },
        breakaway: { pro: "序盤に飛び出して逃げ集団を形成。エースの脚を使わずに得点機会を作れる", con: "メイン集団に吸収されるとポイントに繋がらないリスクがある" },
      };
      const CHASE_PROS_CONS = {
        normal: { pro: "脚の消耗を抑えた標準ペース", con: "特別な加速はしない" },
        push: { pro: "ローテーション頻度を上げてペースアップできる", con: "牽引役の脚の消耗が早まる" },
        hold: { pro: "牽引役の脚を温存できる", con: "ギャップの拡大を許容することになる" },
        ace_early: { pro: "エースが単独アタックし、一気にタイム差を作れる可能性がある", con: "エネルギー切れで終盤に大失速するリスクがある（1レース1回限り）" },
      };
      const benchAbility = 80;
      body = (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <Eyebrow color={C.green}>役割の得意・弱点</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {roleRows.map(r => (
                <div key={r.key} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13.5 }}>{r.label}</div>
                  <div style={{ fontSize: 11.5, color: C.green, marginTop: 3 }}>◎ {ROLE_PROS_CONS[r.key].pro}</div>
                  <div style={{ fontSize: 11.5, color: C.red, marginTop: 2 }}>▲ {ROLE_PROS_CONS[r.key].con}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow color={C.blue}>作戦の得意・弱点（出走前に1つ選択）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {Object.entries(CHASE_MODES).map(([k, v]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13.5 }}>🚩 {v.label}</div>
                  <div style={{ fontSize: 11.5, color: C.green, marginTop: 3 }}>◎ {CHASE_PROS_CONS[k].pro}</div>
                  <div style={{ fontSize: 11.5, color: C.red, marginTop: 2 }}>▲ {CHASE_PROS_CONS[k].con}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow color={C.yellow}>能力値のクラス別ベンチマーク</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4, lineHeight: 1.7 }}>
              新人の能力値は「クラスの基準値±11」＋「専門種目+14」で決まり、22〜94の範囲でばらつきます。
              同じ能力値でも、所属クラスが上がるほど相対的な希少価値は下がります（PROの80は「まずまずの主力」、B1の80は「相当な逸材」）。
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {CLASSES.map((c, i) => {
                const lo = c.scout - 11 + 14, hi = Math.min(94, c.scout + 11 + 14);
                const pct = Math.max(0, Math.min(100, Math.round(((hi - benchAbility) / (hi - lo)) * 100)));
                return (
                  <div key={c.id} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13 }}>{c.label}</span>
                    <span style={{ fontSize: 11.5, color: C.sub }}>専門種目の新人レンジ 約{Math.round(lo)}〜{Math.round(hi)}</span>
                    <span style={{ fontSize: 11.5, color: C.yellow }}>能力{benchAbility}は新人の上位約{pct}%相当</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <Eyebrow color={C.purple}>難易度・スコアリングの目安</Eyebrow>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                レースの★（グレード）は賞金・獲得ポイントの倍率です：★1=×1.0／★2=×1.5／★3=×2.0。
              </div>
              {CLASSES.map(c => {
                const perRace = (c.need / 11).toFixed(1);
                return (
                  <div key={c.id} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub }}>
                    <span style={{ color: C.text, fontFamily: FONT_D, fontWeight: 700 }}>{c.label}</span>：昇格に必要{c.need}pt ÷ シーズン11レース ＝ 平均<span style={{ color: C.yellow, fontFamily: FONT_M }}> {perRace}pt/レース</span>が目安（★1のレースなら概ね6〜7位以内の成績）
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }
    return wrap(body, true);
  }

  if (g.screen === "event" && g.pendingEvent) {
    const ev = g.pendingEvent;
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: "#2b2436", borderRadius: 12, padding: 18, borderTop: `4px solid ${C.purple}` }}>
          <Eyebrow color={C.purple}>TEAM EVENT — {MONTHS[g.month]}</Eyebrow>
          <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 20, margin: "6px 0 10px" }}>{ev.title}</h2>
          <p style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.8, margin: 0 }}>{ev.text}</p>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {ev.choices.map((c, i) => (
            <Btn key={i} color={C.purple} onClick={() => resolveEvent(i)}>{c.label}</Btn>
          ))}
        </div>
      </div>
    );
  }

  if (g.screen === "event_result" && g.eventResult) {
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${C.purple}` }}>
          <Eyebrow color={C.purple}>{g.eventResult.title}</Eyebrow>
          <p style={{ color: C.text, fontSize: 14, lineHeight: 1.8, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{g.eventResult.text}</p>
        </div>
        <Btn onClick={() => setG(s => ({ ...s, eventResult: null, screen: "main" }))}>続ける →</Btn>
      </div>
    );
  }

  if (g.screen === "program") {
    return wrap(
      <div style={{ display: "grid", gap: 10 }}>
        <Eyebrow color={C.blue}>年間レースプログラム（{g.year}年目・{cls.label}）</Eyebrow>
        <div style={{ fontSize: 11.5, color: C.sub }}>会場・グレードは月初に確定するため、先の月は目安です。</div>
        {MONTHS.map((m, mi) => {
          const races = genMonthRaces(g.year, mi, g.classIdx, mi === 11 ? 9999 : 0, g.sponsor, g.gtWins);
          const isMandate = g.sponsor && g.sponsor.mandateMonths.includes(mi);
          return (
            <div key={mi} style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", border: `1px solid ${mi === g.month ? C.yellow : C.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: FONT_D, fontWeight: 700, color: mi === g.month ? C.yellow : C.text, fontSize: 13 }}>{m}{mi === g.month ? "（今月）" : ""}</span>
                {isMandate && <span style={{ fontSize: 10.5, color: C.red }}>🎯スポンサー指定月</span>}
              </div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3, lineHeight: 1.6 }}>
                {races.map(r => `${r.championship ? "👑" : ""}${r.name}${"★".repeat(r.grade)}`).join(" ／ ")}
              </div>
            </div>
          );
        })}
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  if (g.screen === "lineup") {
    const race = g.races.find(r => r.id === g.sel.raceId);
    const N = g.sel.squadN || race.tmpl.squadMin;
    const groupMode = groupModeFor(N);
    const previewCourse = generateCourse(race);
    const setSquadN = (n) => setG(s => ({ ...s, sel: { ...s.sel, squadN: n, starters: [], ace: null, roles: {} } }));
    const toggle = (id) => setG(s => {
      const st = s.sel.starters;
      let starters, ace = s.sel.ace;
      if (st.includes(id)) { starters = st.filter(x => x !== id); if (ace === id) ace = null; }
      else if (st.length >= N) return s;
      else starters = [...st, id];
      return { ...s, sel: { ...s.sel, starters, ace } };
    });
    const sel = g.sel;
    const ready = sel.starters.length === N && (N === 1 || sel.ace);
    const roleOptions = groupMode === "pelotonOnly"
      ? Object.entries(ROLES).filter(([k]) => k !== "breakaway")
      : Object.entries(ROLES);
    const squadChoices = [];
    for (let n = race.tmpl.squadMin; n <= race.tmpl.squadMax; n++) squadChoices.push(n);
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 10, padding: "10px 14px", borderLeft: `4px solid ${C.yellow}` }}>
          <div style={{ fontFamily: FONT_D, fontSize: 16, fontWeight: 700, color: C.text }}>{race.championship ? "👑 " : ""}{race.sponsorMandate ? "🎯 " : ""}{race.name} {"★".repeat(race.grade)}</div>
          {!race.stageRace && (
            <div style={{ display: "flex", gap: 3, margin: "6px 0 3px" }}>
              {race.tmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 7, borderRadius: 3, background: SEG_COLOR[s[0]] }} />)}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: C.sub }}>{race.stageRace && race.stageTmpls ? "日替わりコース" : race.tmpl.kind}・<span style={{ color: C.yellow }}>出走{N}名</span>・{TYPES[race.tmpl.favors].label}有利</div>
          {squadChoices.length > 1 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>出走人数（少人数ほど手持ちの疲労を温存できるが、ローテーションや逃げの選択肢は減る）</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {squadChoices.map(n => {
                  const dis = healthy.length < n;
                  return (
                    <button key={n} disabled={dis} onClick={() => setSquadN(n)}
                      style={{
                        fontFamily: FONT_D, fontWeight: 700, fontSize: 12.5, padding: "5px 11px", borderRadius: 6, cursor: dis ? "default" : "pointer",
                        background: N === n ? C.yellow : C.panel2, color: N === n ? "#14171d" : dis ? "#5b6272" : C.sub,
                        border: `1px solid ${N === n ? C.yellow : C.line}`, opacity: dis ? 0.5 : 1,
                      }}>{n}名</button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            {race.stageRace ? <MultiStageCourseView race={race} /> : <ElevationChart course={previewCourse} />}
          </div>
        </div>
        <section>
          <Eyebrow>出走{N}名を選択（{sel.starters.length}/{N}）</Eyebrow>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {g.roster.map(r => {
              const t = TYPES[r.type];
              const dis = r.injury > 0;
              const on = sel.starters.includes(r.id);
              const fitKey = FAVORS_TO_DISCIPLINE[race.tmpl.favors];
              const fitScore = disciplineScore(r, fitKey);
              return (
                <div key={r.id} onClick={() => !dis && toggle(r.id)}
                  style={{
                    background: on ? "#2b3141" : C.panel, borderRadius: 10, padding: "9px 12px", cursor: dis ? "default" : "pointer",
                    border: `1.5px solid ${on ? C.yellow : C.line}`, opacity: dis ? 0.45 : 1,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{r.name}
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                      {dis && <span style={{ marginLeft: 6, fontSize: 10.5, color: C.red }}>🏥故障中</span>}
                      {r.streak >= 1 && !dis && <span style={{ marginLeft: 6, fontSize: 10.5, color: r.streak >= 2 ? C.red : "#e8a13c" }}>連闘{r.streak}{r.streak >= 2 ? "（出すと故障）" : ""}</span>}
                    </span>
                    <span style={{ fontFamily: FONT_M, fontSize: 12, color: COND_COLOR[r.cond - 1] }}>
                      {COND_ARROW[r.cond - 1]} <span style={{ color: C.yellow }}>{overall(r)}</span>
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>{DISCIPLINES[fitKey].label}適性<span style={{ color: C.yellow, fontFamily: FONT_M }}> {fitScore}</span></span>
                    </span>
                  </div>
                  <TraitLine trait={r.trait} />
                  <FatigueBar v={r.fatigue} />
                  <AbilityGrid r={r} cap={growthCap} />
                </div>
              );
            })}
          </div>
        </section>
        {sel.starters.length === N && N > 1 && (
          <section>
            <Eyebrow color={C.yellow}>エース指名（残り{N - 1}名がエースを支える）</Eyebrow>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {g.roster.filter(r => sel.starters.includes(r.id)).map(r => (
                <button key={r.id} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, ace: r.id } }))}
                  style={{
                    fontFamily: FONT_D, fontWeight: 700, fontSize: 14, padding: "9px 13px", borderRadius: 8, cursor: "pointer",
                    background: sel.ace === r.id ? C.yellow : C.panel, color: sel.ace === r.id ? "#14171d" : C.text,
                    border: `1.5px solid ${sel.ace === r.id ? C.yellow : C.line}`,
                  }}>{sel.ace === r.id ? "👑 " : ""}{r.name}</button>
              ))}
            </div>
          </section>
        )}
        {sel.starters.length === N && (N === 1 || sel.ace) && groupMode !== "solo" && (
          <section>
            <Eyebrow color={C.green}>役割指定（エースを支える残りのメンバーのみ。コースに合わせて細かく指定できます）</Eyebrow>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {g.roster.filter(r => sel.starters.includes(r.id) && r.id !== sel.ace).map(r => {
                const role = sel.roles[r.id] || "lead";
                const mismatch = (role === "mountain" || role === "flat") && TYPE_ROLE_FIT[role] && !TYPE_ROLE_FIT[role].includes(r.type);
                return (
                  <div key={r.id} style={{ background: C.panel, borderRadius: 8, padding: "6px 10px", border: `1px solid ${C.line}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                      <span style={{ fontFamily: FONT_D, fontSize: 13, color: C.text }}>{r.name}</span>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {roleOptions.map(([k, rl]) => (
                          <button key={k} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, roles: { ...s.sel.roles, [r.id]: k } } }))}
                            title={rl.desc}
                            style={{
                              fontFamily: FONT_D, fontSize: 10.5, fontWeight: 700, padding: "4px 7px", borderRadius: 6, cursor: "pointer",
                              background: role === k ? (k === "breakaway" ? C.red : C.blue) : C.panel2,
                              color: role === k ? "#14171d" : C.sub,
                              border: `1px solid ${role === k ? (k === "breakaway" ? C.red : C.blue) : C.line}`,
                            }}>{rl.label}</button>
                        ))}
                      </div>
                    </div>
                    {mismatch && <div style={{ fontSize: 10, color: C.red, marginTop: 3 }}>⚠ {t_label(r.type)}には不向きな役割（適性ボーナスなし）</div>}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {ready && N > 1 && (
          <section>
            <Eyebrow color={C.green}>作戦（レース全体で1つ選択。観戦中の指示変更はできません）</Eyebrow>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {["normal", "push", "hold"].map(k => {
                const active = (sel.chaseMode || "normal") === k;
                return (
                  <button key={k} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, chaseMode: k } }))}
                    style={{
                      flex: 1, padding: "8px 4px", borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: FONT_D, cursor: "pointer",
                      background: active ? C.green : C.panel2, color: active ? "#14171d" : C.text,
                      border: `1px solid ${active ? C.green : C.line}`,
                    }}>🚩 {CHASE_MODES[k].label}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{CHASE_MODES[sel.chaseMode || "normal"].desc}</div>
            <Btn small outline={!sel.aceEarly} color={C.red} style={{ marginTop: 8 }}
              onClick={() => setG(s => ({ ...s, sel: { ...s.sel, aceEarly: !s.sel.aceEarly } }))}>
              {sel.aceEarly ? "✔ " : ""}🚩 {CHASE_MODES.ace_early.label}
            </Btn>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{CHASE_MODES.ace_early.desc}</div>
          </section>
        )}
        {ready && (
          <section>
            <Eyebrow color={C.green}>決戦機材</Eyebrow>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {g.inv.wheel > 0 && <Btn small outline={!sel.useWheel} color={C.purple} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, useWheel: !s.sel.useWheel } }))}>{sel.useWheel ? "✔ " : ""}決戦ホイール（登坂+15%）</Btn>}
              {g.inv.suit > 0 && <Btn small outline={!sel.useSuit} color={C.purple} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, useSuit: !s.sel.useSuit } }))}>{sel.useSuit ? "✔ " : ""}エアロスーツ（平坦+15%）</Btn>}
            </div>
          </section>
        )}
        <div style={{ display: "grid", gap: 8 }}>
          <Btn disabled={!ready} onClick={() => startRace(true)}>観戦しながらスタート 🏁</Btn>
          <Btn outline disabled={!ready} onClick={() => startRace(false)}>結果だけ見る（スキップ）</Btn>
          <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
        </div>
      </div>
    );
  }

  if (g.screen === "race" && g.result) return wrap(
    <div>
      <div style={{ marginBottom: 8 }}>
        <Eyebrow color={C.red}>LIVE — {g.result.raceMeta.name}{g.gc && g.gc.race.stageRace ? `（${g.gc.stage}日目）` : ""}</Eyebrow>
      </div>
      <RaceView sim={g.result} onFinish={raceFinishHandler} />
      <div style={{ marginTop: 8, fontSize: 12, color: C.sub }}>
        ● 印＝あなたのチーム／黄ジャージ＝エース。位置が近い選手同士が自然にグループを作り、千切れ・吸収・ローテーションが発生します。
      </div>
    </div>
  );

  if (g.screen === "result_pending") return wrap(<div style={{ color: C.sub }}>結果集計中…</div>);

  if (g.screen === "result" && g.result && g.prizeInfo) {
    const { race, prize, pts, best, mandateHit, breakSurvived, hadBreak } = g.prizeInfo;
    const res = g.result;
    const expKeys = [...new Set(res.course.segs.map(s => SEG_AB[s.type]))];
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.yellow}` }}>
          <Eyebrow>RESULT — {race.name}</Eyebrow>
          <div style={{ fontFamily: FONT_D, fontSize: 20, color: C.text, fontWeight: 700, margin: "6px 0" }}>
            🏆 優勝：{res.ranked[0].name}
            <span style={{ fontSize: 12, color: res.ranked[0].team === "PLAYER" ? C.yellow : C.sub }}>（{res.ranked[0].teamName}）</span>
          </div>
          <div style={{ fontSize: 13.5, color: C.text }}>自チーム最高位：<span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 17 }}>{best.rank}位</span>（{best.name}）</div>
          <div style={{ fontSize: 13.5, color: C.green, marginTop: 3 }}>賞金 +{prize}万円{race.championship ? "" : ` ／ ポイント +${pts}pt${mandateHit ? "（指定レースボーナス込）" : ""}`}</div>
          {hadBreak && (
            <div style={{ fontSize: 12, color: breakSurvived ? C.yellow : C.sub, marginTop: 3 }}>
              {breakSurvived ? "🚴 逃げ切り成功！逃げ集団内でのスプリント決着" : "🏃 メイン集団に吸収され、ゴールスプリント決着"}
            </div>
          )}
          <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>出走経験：{expKeys.map(k => AB_LABEL[k]).join("・")}が成長</div>
          {race.championship && (
            <div style={{ marginTop: 6, fontSize: 13, color: best.rank <= 3 ? C.yellow : C.red }}>
              {g.classIdx === 2 && best.rank === 1 ? "グランファイナル制覇！！" : best.rank <= 3 ? "昇格圏内でフィニッシュ！年度末処理で昇格します" : "昇格ならず…来季に再挑戦"}
            </div>
          )}
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: "8px 12px", maxHeight: 260, overflowY: "auto" }}>
          {res.ranked.map(e => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px", borderRadius: 6, fontSize: 12.5, background: e.team === "PLAYER" ? "rgba(255,210,63,0.1)" : "transparent" }}>
              <span style={{ color: e.team === "PLAYER" ? C.yellow : C.text }}>
                <span style={{ fontFamily: FONT_M, display: "inline-block", width: 24 }}>{e.rank}.</span>
                {e.name}{e.isAce ? " 👑" : ""}{e.isAlumnus ? " 🔀" : ""}<span style={{ color: C.sub, fontSize: 10.5 }}> / {e.teamName}</span>
              </span>
              <span style={{ fontFamily: FONT_M, color: C.sub }}>{e.rank === 1 ? fmtTime(e.finishTime) : fmtGap(e.finishTime - res.ranked[0].finishTime)}</span>
            </div>
          ))}
        </div>
        <Btn onClick={() => advanceMonth({ starters: g.sel.starters, expKeys, raceId: g.sel.raceId, grandTour: !!race.grandTour, stageCount: race.stageCount })}>翌月へ進む →</Btn>
      </div>
    );
  }

  if (g.screen === "gc_stage" && g.result && g.gc) {
    const res = g.result;
    const sorted = [...res.entrants].sort((a, b) => a.finishTime - b.finishTime);
    const bestIdx = sorted.findIndex(e => e.team === "PLAYER");
    const stageNo = g.gc.stage;
    const totalStages = g.gc.race.stageCount || 2;
    // v13バグ修正: 中間ステージ画面はその日単独の着順しか表示しておらず、
    // 総合タイムがどこにも出ていなかった（計算はされていたが表示がなかったため
    // 「総合タイムが計算されていない」ように見えていた）。stageTimesの累積から
    // ここでも総合順位・総合タイム差を算出して表示する
    const idToEntrant = {}; res.entrants.forEach(en => { idToEntrant[en.id] = en; });
    const gcTimesSoFar = {};
    Object.keys(idToEntrant).forEach(id => {
      gcTimesSoFar[id] = Object.values(g.gc.stageTimes).reduce((sum, st) => sum + (st[id] || 0), 0);
    });
    const gcOrderSoFar = Object.entries(gcTimesSoFar).sort((a, b) => a[1] - b[1]);
    const gcBestIdx = gcOrderSoFar.findIndex(([id]) => idToEntrant[id].team === "PLAYER");
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.purple}` }}>
          <Eyebrow color={C.purple}>STAGE {stageNo} 完了 — {g.gc.race.name}</Eyebrow>
          <div style={{ fontSize: 13.5, color: C.text, marginTop: 6 }}>{stageNo}日目 自チーム最高位：<span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 17 }}>{bestIdx + 1}位</span></div>
          <div style={{ fontSize: 13.5, color: C.text, marginTop: 3 }}>
            総合成績（{stageNo}日目終了時点）：自チーム最高
            <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 17 }}> {gcBestIdx + 1}位</span>
            {gcBestIdx >= 0 && (
              <span style={{ fontFamily: FONT_M, color: C.sub, marginLeft: 6 }}>
                {gcBestIdx === 0 ? fmtTime(gcOrderSoFar[0][1]) : fmtGap(gcOrderSoFar[gcBestIdx][1] - gcOrderSoFar[0][1])}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>総合成績は{totalStages}日目終了後に確定します。まずは休息・疲労回復（-20）をしてから{stageNo + 1}日目へ。</div>
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: "8px 12px", maxHeight: 260, overflowY: "auto" }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>総合順位（{stageNo}日目終了時点）</div>
          {gcOrderSoFar.map(([id, t], i) => {
            const e = idToEntrant[id];
            return (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px", fontSize: 12.5, background: e.team === "PLAYER" ? "rgba(255,210,63,0.1)" : "transparent" }}>
                <span style={{ color: e.team === "PLAYER" ? C.yellow : C.text }}><span style={{ fontFamily: FONT_M, display: "inline-block", width: 24 }}>{i + 1}.</span>{e.name}{e.isAce ? " 👑" : ""}{e.isAlumnus ? " 🔀" : ""}</span>
                <span style={{ fontFamily: FONT_M, color: C.sub }}>{i === 0 ? fmtTime(t) : fmtGap(t - gcOrderSoFar[0][1])}</span>
              </div>
            );
          })}
        </div>
        <Btn onClick={() => {
          // v14.8: 出走1名（solo）は役割自体が存在しないため再設定画面を経由せず直接次日程へ
          if (g.gc.starters.length === 1) startNextStage();
          else setG(s => ({ ...s, screen: "gc_role_setup" }));
        }}>{stageNo + 1}日目へ進む →</Btn>
      </div>
    );
  }

  // v14.8: ステージレースは日ごとに役割（エース・アシスト種別）を変更できるようにした。
  // 出走メンバー自体（starters）は初日のまま固定し、誰がエースでどの役割かだけを
  // 次のステージに向けてここで選び直せる（lineup画面の役割選択UIと同じ操作感）
  if (g.screen === "gc_role_setup" && g.gc) {
    const gc = g.gc;
    const groupMode = groupModeFor(gc.starters.length);
    const roleOptions = groupMode === "pelotonOnly"
      ? Object.entries(ROLES).filter(([k]) => k !== "breakaway")
      : Object.entries(ROLES);
    const sel = g.sel;
    const squad = g.roster.filter(r => gc.starters.includes(r.id));
    const nextStageNo = gc.stage + 1;
    // v14.10: 作戦変更画面でもその日のコース（区間バー・標高グラフ）を見られるようにする。
    // 日ごとにコース性格が変わるグランツールでは特に、次の日がどんなコースかを
    // 確認した上でエース・役割を選び直せる方が理にかなっている
    const dayTmpl = gc.race.stageTmpls ? gc.race.stageTmpls[nextStageNo - 1] : gc.race.tmpl;
    const dayCourse = generateCourse(gc.race, `day${nextStageNo}`);
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 10, padding: "10px 14px", borderLeft: `4px solid ${C.purple}` }}>
          <div style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>{nextStageNo}日目に向けて作戦変更</div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>コース性格に合わせて、エース・役割をこの日だけ変更できます（出走メンバー自体は変更できません）。</div>
          <div style={{ display: "flex", gap: 3, margin: "8px 0 3px" }}>
            {dayTmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 7, borderRadius: 3, background: SEG_COLOR[s[0]] }} />)}
          </div>
          <div style={{ fontSize: 11.5, color: C.sub }}>{nextStageNo}日目・{dayTmpl.kind}・{TYPES[dayTmpl.favors].label}有利</div>
          <div style={{ marginTop: 6 }}><ElevationChart course={dayCourse} /></div>
        </div>
        <section>
          <Eyebrow color={C.yellow}>エース指名</Eyebrow>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {squad.map(r => (
              <button key={r.id} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, ace: r.id } }))}
                style={{
                  fontFamily: FONT_D, fontWeight: 700, fontSize: 14, padding: "9px 13px", borderRadius: 8, cursor: "pointer",
                  background: sel.ace === r.id ? C.yellow : C.panel, color: sel.ace === r.id ? "#14171d" : C.text,
                  border: `1.5px solid ${sel.ace === r.id ? C.yellow : C.line}`,
                }}>{sel.ace === r.id ? "👑 " : ""}{r.name}</button>
            ))}
          </div>
        </section>
        <section>
          <Eyebrow color={C.green}>役割指定（エースを支える残りのメンバーのみ）</Eyebrow>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {squad.filter(r => r.id !== sel.ace).map(r => {
              const role = sel.roles[r.id] || "lead";
              const mismatch = (role === "mountain" || role === "flat") && TYPE_ROLE_FIT[role] && !TYPE_ROLE_FIT[role].includes(r.type);
              return (
                <div key={r.id} style={{ background: C.panel, borderRadius: 8, padding: "6px 10px", border: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                    <span style={{ fontFamily: FONT_D, fontSize: 13, color: C.text }}>{r.name}</span>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {roleOptions.map(([k, rl]) => (
                        <button key={k} onClick={() => setG(s => ({ ...s, sel: { ...s.sel, roles: { ...s.sel.roles, [r.id]: k } } }))}
                          title={rl.desc}
                          style={{
                            fontFamily: FONT_D, fontSize: 10.5, fontWeight: 700, padding: "4px 7px", borderRadius: 6, cursor: "pointer",
                            background: role === k ? (k === "breakaway" ? C.red : C.blue) : C.panel2,
                            color: role === k ? "#14171d" : C.sub,
                            border: `1px solid ${role === k ? (k === "breakaway" ? C.red : C.blue) : C.line}`,
                          }}>{rl.label}</button>
                      ))}
                    </div>
                  </div>
                  {mismatch && <div style={{ fontSize: 10, color: C.red, marginTop: 3 }}>⚠ {t_label(r.type)}には不向きな役割（適性ボーナスなし）</div>}
                </div>
              );
            })}
          </div>
        </section>
        <Btn onClick={startNextStage}>{nextStageNo}日目のレースへ →</Btn>
      </div>
    );
  }

  if (g.screen === "gc_final" && g.gc && g.gc.gcOrder) {
    const { gcOrder, idToEntrant, bestRank, prize, pts } = g.gc;
    const expKeys = [...new Set(g.result.course.segs.map(s => SEG_AB[s.type]))];
    // v13バグ修正: 上位10名までしか一覧に出しておらず、自チームが11位以下だと
    // 総合タイムがどこにも表示されないまま終わっていた。ヘッダーに自チームの
    // 総合タイム（差）を明示し、一覧も全員表示にスクロールで対応する
    const leaderTime = gcOrder[0][1];
    const bestEntry = gcOrder[bestRank - 1];
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.yellow}` }}>
          <Eyebrow>GC FINAL — {g.gc.race.name}</Eyebrow>
          <div style={{ fontSize: 13.5, color: C.text, marginTop: 6 }}>
            総合成績：自チーム最高位 <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 17 }}>{bestRank}位</span>
            {bestEntry && (
              <span style={{ fontFamily: FONT_M, color: C.sub, marginLeft: 8 }}>
                総合タイム {bestRank === 1 ? fmtTime(bestEntry[1]) : fmtGap(bestEntry[1] - leaderTime)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13.5, color: C.green, marginTop: 3 }}>賞金 +{prize}万円{!g.gc.race.championship ? ` ／ ポイント +${pts || 0}pt` : ""}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: bestRank <= 3 ? C.yellow : C.red }}>
            {bestRank <= 3 ? "昇格圏内でフィニッシュ！年度末処理で昇格します" : "昇格ならず…来季に再挑戦"}
          </div>
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: "8px 12px", maxHeight: 260, overflowY: "auto" }}>
          {gcOrder.map(([id, t], i) => {
            const e = idToEntrant[id];
            return (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px", fontSize: 12.5, background: e.team === "PLAYER" ? "rgba(255,210,63,0.1)" : "transparent" }}>
                <span style={{ color: e.team === "PLAYER" ? C.yellow : C.text }}><span style={{ fontFamily: FONT_M, display: "inline-block", width: 24 }}>{i + 1}.</span>{e.name}{e.isAce ? " 👑" : ""}{e.isAlumnus ? " 🔀" : ""}</span>
                <span style={{ fontFamily: FONT_M, color: C.sub }}>{i === 0 ? fmtTime(t) : fmtGap(t - gcOrder[0][1])}</span>
              </div>
            );
          })}
        </div>
        <Btn onClick={() => advanceMonth({ starters: g.gc.starters, expKeys, raceId: g.gc.race.id, grandTour: !!g.gc.race.grandTour, stageCount: g.gc.race.stageCount })}>翌月へ進む →</Btn>
      </div>
    );
  }

  if (g.screen === "yearend" && g.yearendInfo) {
    const info = g.yearendInfo;
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${info.promoted ? C.green : info.relegated ? C.red : C.yellow}` }}>
          <Eyebrow>YEAR END — {g.year - 1}年目終了</Eyebrow>
          <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 22, margin: "6px 0 10px" }}>
            {info.promoted ? `🎉 ${cls.label} へ昇格！` : info.relegated ? "😞 降格…" : "残留 — 来季へ"}
          </h2>
          <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.8 }}>
            {info.champBest !== null ? `年度末レース結果：自チーム最高 ${info.champBest}位` : "年度末レースには出場できませんでした（ポイント不足）"}
          </div>
          {info.sponsorResult && (
            <div style={{ marginTop: 8, fontSize: 13, color: info.sponsorResult.achieved ? C.green : C.red }}>
              {info.sponsorResult.name}：ノルマ{info.sponsorResult.norma}ptに対し{info.sponsorResult.pts}pt —
              {info.sponsorResult.achieved ? ` 達成！ボーナス+${info.sponsorResult.bonus}万円` : ` 未達…違約金-${info.sponsorResult.penalty}万円`}
              {info.sponsorResult.mandatesMissed > 0 && ` ／ 指定レース見送り${info.sponsorResult.mandatesMissed}回：追加違約金-${info.sponsorResult.mandatePenalty}万円`}
              {info.sponsorResult.mandatesMet > 0 && ` ／ 指定レース達成${info.sponsorResult.mandatesMet}回`}
            </div>
          )}
          {info.retired.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <Eyebrow color={C.sub}>引退セレモニー</Eyebrow>
              {info.retired.map((t, i) => <div key={i} style={{ fontSize: 13, color: C.text, marginTop: 4 }}>🌸 {t}</div>)}
            </div>
          )}
        </div>
        <div style={{ background: C.panel2, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: C.sub, lineHeight: 1.7 }}>新年度：全選手が1歳加齢。次は新しいスポンサーとの契約です。</div>
        <Btn onClick={() => setG(s => ({ ...s, screen: "sponsor", yearendInfo: null }))}>スポンサー契約へ →</Btn>
      </div>
    );
  }

  if (g.screen === "clear") {
    const earnedCP = computeClearPoints(g.year, g.difficulty);
    const diffLabel = (DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).label;
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 22, borderTop: `4px solid ${C.yellow}`, textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>🏆</div>
          <h2 style={{ fontFamily: FONT_D, color: C.yellow, fontSize: 26, margin: "8px 0" }}>グランファイナル制覇！</h2>
          <p style={{ color: C.text, fontSize: 14, lineHeight: 1.8 }}>B1から始まったチームが、{g.year - 1}年の歳月（難易度：{diffLabel}）をかけてPROの頂点に立ちました。おめでとうございます！</p>
          <div style={{ marginTop: 10, fontSize: 15, color: C.yellow, fontFamily: FONT_M }}>🎁 クリアポイント +{earnedCP}pt 獲得！</div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>次回以降の新規ゲームで、難易度の解禁や永続ボーナスに自動反映されます</div>
        </div>
        <Btn onClick={() => { clearSaveGame(); setG(initGame()); }}>新たなチームで最初から</Btn>
      </div>
    );
  }

  return wrap(<div style={{ color: C.sub }}>読み込み中…</div>);
}

function t_label(type) { return TYPES[type]?.label || type; }

export default App;