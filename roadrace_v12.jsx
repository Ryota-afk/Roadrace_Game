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
  // v19: 早熟・晩成それぞれの極端形。superEarly/超晩成は通常の3タイプよりさらに
  // ピークが偏っており、ごく稀にしか出現しない（newRiderの生成時に低確率で抽選）
  super_early: { label: "超早熟", peak: [18, 21] },
  super_late: { label: "超晩成", peak: [32, 38] },
};
const POW = {
  S: { mul: 1.6, color: "#ffd23f" }, A: { mul: 1.3, color: "#35c07e" },
  B: { mul: 1.0, color: "#4f8fe8" }, C: { mul: 0.7, color: "#9aa3b5" },
};
// v15: 特殊能力システム（パワプロ風）。以前は選手ごとに1枠だけの「特性」だったが、
// 0〜3個を保有できる「特殊能力」に拡張した。categoryは今後の特殊能力ファイル（図鑑）用の分類。
// bad:true は悪特性。escape/domestique/closerは旧バージョンでは付与されるだけで効果が
// 実装されていなかった（死んだ特性）ため、今回きちんと効果を持たせた
const ABILITIES = {
  // 地形適性
  mount:       { label: "山の申し子", desc: "山岳・山頂フィニッシュ区間で能力+4", category: "地形適性" },
  puncheur:    { label: "丘陵ハンター", desc: "丘陵区間で能力+4", category: "地形適性" },
  flatlander:  { label: "平坦の職人", desc: "平坦区間で能力+4", category: "地形適性" },
  sprinter_sp: { label: "スプリント巧者", desc: "ゴールスプリント区間で能力+4", category: "地形適性" },
  soloist:     { label: "独走の求道者", desc: "TT区間で能力+4", category: "地形適性" },
  // v28: 万能型の地形適性。全区間で控えめに底上げする（脚質を選ばないオールラウンダー）
  allrounder_sp:{ label: "オールラウンダー", desc: "全ての区間で能力+2", category: "地形適性" },
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
function hasAbility(r, id) { return !!(r && r.abilities && r.abilities.includes(id)); }
// v15: 保有数は0〜3個（多いほど稀）。逸材(forceProdigy)は2〜3個確定・悪特性を含まない
function rollAbilities(rng, opts = {}) {
  const goodPool = Object.keys(ABILITIES).filter(k => !ABILITIES[k].bad && !ABILITIES[k].breedOnly);
  const badPool = Object.keys(ABILITIES).filter(k => ABILITIES[k].bad);
  let n;
  if (opts.forceProdigy) n = rng() < 0.5 ? 2 : 3;
  else { const roll = rng(); n = roll < 0.35 ? 0 : roll < 0.75 ? 1 : roll < 0.95 ? 2 : 3; }
  const abilities = [];
  for (let i = 0; i < n; i++) {
    const wantBad = !opts.forceProdigy && rng() < 0.2;
    const pool = (wantBad ? badPool : goodPool).filter(k => !abilities.includes(k));
    if (pool.length === 0) continue;
    abilities.push(pool[Math.floor(rng() * pool.length)]);
  }
  return abilities;
}
// v15フェーズ2: 金特（ゴールド進化）。対応する特殊能力を保有したまま一定の条件
// （その脚質での勝利数、または該当する役割での出走数）を満たすと、保有能力自体は
// そのままに「金特」フラグ（goldAbilities配列）が立ち、効果が強化される。
// ASSIST_ROLESはこのファイル後方（v13のフレーバーテキスト部）で定義されるが、
// 実際に呼ばれるのは選手が条件を満たした実行時なので問題ない
function hasGoldAbility(r, id) { return !!(r && r.goldAbilities && r.goldAbilities.includes(id)); }
function countWins(r) { return (r.raceLog || []).filter(e => e.rank === 1).length; }
function countRoleUses(r, pred) { return (r.raceLog || []).filter(pred).length; }
const GOLD_CONDITIONS = {
  mount:       r => r.type === "CLM" && countWins(r) >= 5,
  puncheur:    r => r.type === "PUN" && countWins(r) >= 5,
  flatlander:  r => r.type === "RUL" && countWins(r) >= 5,
  sprinter_sp: r => r.type === "SPR" && countWins(r) >= 5,
  soloist:     r => r.type === "TT" && countWins(r) >= 5,
  closer:      r => countWins(r) >= 8,
  escape:      r => countRoleUses(r, e => e.role === "breakaway") >= 5,
  domestique:  r => countRoleUses(r, e => ASSIST_ROLES.has(e.role)) >= 8,
  // v28: 新特殊能力の金特条件
  finisher:    r => countWins(r) >= 8,
  engine:      r => (r.raceLog || []).length >= 30,
  allrounder_sp: r => countWins(r) >= 6,
};
// 保有する特殊能力のうち、条件を満たしたものだけを金特化する。新たに金特化があれば
// 変更後のオブジェクトを返し（呼び出し側で差分検知してログ表示に使える）、無ければ引数をそのまま返す
function upgradeGoldAbilities(r) {
  const abilities = r.abilities || [];
  const current = r.goldAbilities || [];
  const next = [...current];
  let changed = false;
  Object.keys(GOLD_CONDITIONS).forEach(id => {
    if (abilities.includes(id) && !next.includes(id) && GOLD_CONDITIONS[id](r)) { next.push(id); changed = true; }
  });
  return changed ? { ...r, goldAbilities: next } : r;
}
// v17: 特殊能力の後天的獲得。GOLD_CONDITIONSより緩い閾値で「まだ持っていない選手が
// 新たに身につける」条件を定義する。条件を満たしても即座には身につかず、毎月低確率の
// 抽選を通過してはじめて習得する（じわじわ育っていく手応えを出すため）
const ACQUIRE_CONDITIONS = {
  mount:       r => r.type === "CLM" && countWins(r) >= 2,
  puncheur:    r => r.type === "PUN" && countWins(r) >= 2,
  flatlander:  r => r.type === "RUL" && countWins(r) >= 2,
  sprinter_sp: r => r.type === "SPR" && countWins(r) >= 2,
  soloist:     r => r.type === "TT" && countWins(r) >= 2,
  closer:      r => countWins(r) >= 4,
  escape:      r => countRoleUses(r, e => e.role === "breakaway") >= 3,
  domestique:  r => countRoleUses(r, e => ASSIST_ROLES.has(e.role)) >= 5,
  iron:        r => (r.raceLog || []).length >= 15,
  big:         r => (r.raceLog || []).some(e => (e.name.includes("世界選手権") || e.name.includes("オリンピック")) && e.rank <= 3),
  // v28: 新特殊能力の後天習得条件
  finisher:    r => countWins(r) >= 5,
  engine:      r => (r.raceLog || []).length >= 20,
};
// 保有枠（0〜3）に空きがあり、条件を満たす未保有の能力が一つでもあれば、月ごとに
// 15%の確率でその中から1つを新規習得する。変更があれば新オブジェクトを、無ければ引数をそのまま返す
function acquireNewAbility(r) {
  const abilities = r.abilities || [];
  if (abilities.length >= 3) return r;
  const eligible = Object.keys(ACQUIRE_CONDITIONS).filter(id => !abilities.includes(id) && ACQUIRE_CONDITIONS[id](r));
  if (eligible.length === 0 || Math.random() >= 0.15) return r;
  const id = eligible[Math.floor(Math.random() * eligible.length)];
  return { ...r, abilities: [...abilities, id] };
}
// v16フェーズ3: 特殊能力ファイル（図鑑）。自チーム所属選手・マイライフの自分自身が
// これまでに保有したことのある特殊能力を、セーブデータのリセットをまたいで記録する
// 永続ストレージ。通常特性と金特を別々に記録し、プレイ実績として蓄積していく
const ABILITY_FILE_KEY = "roadrace_v12_ability_file";
function loadAbilityFile() {
  try {
    const raw = localStorage.getItem(ABILITY_FILE_KEY);
    if (!raw) return { normal: [], gold: [] };
    const parsed = JSON.parse(raw);
    return { normal: Array.isArray(parsed.normal) ? parsed.normal : [], gold: Array.isArray(parsed.gold) ? parsed.gold : [] };
  } catch (e) { return { normal: [], gold: [] }; }
}
function saveAbilityFile(data) {
  try { localStorage.setItem(ABILITY_FILE_KEY, JSON.stringify(data)); } catch (e) { /* noop */ }
}
function noteAbilityDiscovery(riders) {
  const file = loadAbilityFile();
  const normalSet = new Set(file.normal);
  const goldSet = new Set(file.gold);
  let changed = false;
  (riders || []).forEach(r => {
    (r && r.abilities || []).forEach(id => { if (!normalSet.has(id)) { normalSet.add(id); changed = true; } });
    (r && r.goldAbilities || []).forEach(id => { if (!goldSet.has(id)) { goldSet.add(id); changed = true; } });
  });
  if (changed) saveAbilityFile({ normal: [...normalSet], gold: [...goldSet] });
}
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
// v29: 副ステータス（加速力・メンタル）の育成。ソフトキャップ88でじわっと伸び止まり、上限94。
// 成長フェーズの伸び率（ph.gain）を掛けるので、若手ほど伸びやすく衰え期はほぼ伸びない
function growSub(r, key, amount) {
  const v = r[key] ?? 50;
  r[key] = Math.min(94, v + amount * softFactor(v, 88));
}
const COND_ARROW = ["↓↓", "↘", "→", "↗", "↑↑"];
const COND_COLOR = ["#7a8296", "#8fa0b8", "#9aa3b5", "#7dd0a0", "#35c07e"];
// v27: コンディション予報。来月の調子変動の向き（-1下降/0安定/+1上昇）を事前に示す。
// 予報どおりに翌月の調子が動くよう、予報を保持して翌月に実際の変動として適用する
const COND_FC_ARROW = ["↘", "→", "↗"];
const COND_FC_COLOR = ["#8fa0b8", "#9aa3b5", "#7dd0a0"];
const COND_FC_LABEL = ["下降ぎみ", "安定", "上向き"];
// 元の調子変動と同じ確率分布（下降34%／安定33%／上昇33%）で向きを1つ引く
function rollCondDir() {
  return Math.random() < 0.34 ? -1 : Math.random() < 0.5 ? 0 : 1;
}
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
  // v24: age未指定だとnewRiderが22〜33歳のどれかをランダムに割り当ててしまい、成長タイプの
  // 組み合わせによっては加入した瞬間から衰え期の逸材が出て萎えるというフィードバックを受けた。
  // クリアポイントで確保する逸材は必ず18〜20歳の若手にし、どの成長タイプでも
  // 加入時点でまだ成長期／全盛期に入りたてであることを保証する
  const rookie = newRider(70, rng, { banned, forceProdigy: true, age: 18 + Math.floor(rng() * 3) });
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
// v27: コースレコード。コース種別（クリテリウム・丘陵ロード等）ごとに、これまでの全レースで
// 記録された最速の「レコード指数」（コース距離÷勝者フィニッシュタイム×100。距離のばらつきを
// 正規化した比較可能な指標）を、達成者名・年とともにプレイをまたいで蓄積する。
// シーズン・マイライフ両モードで共有し、殿堂やクリアポイント同様の永続記録として扱う
const COURSE_REC_KEY = "roadrace_v12_course_records";
function loadCourseRecords() {
  try { const raw = localStorage.getItem(COURSE_REC_KEY); const o = raw ? JSON.parse(raw) : {}; return (o && typeof o === "object") ? o : {}; } catch (e) { return {}; }
}
function saveCourseRecords(recs) {
  try { localStorage.setItem(COURSE_REC_KEY, JSON.stringify(recs)); } catch (e) { /* noop */ }
}
// 1レース終了時に呼ぶ。新記録なら保存し、結果画面で祝えるよう判定情報を返す
function recordCourseResult(kind, length, winnerTime, holder, isPlayer, year) {
  if (!kind || !winnerTime || winnerTime <= 0 || !length) return null;
  const speed = Math.round((length / winnerTime) * 100);
  const recs = loadCourseRecords();
  const prev = recs[kind] || null;
  const isNew = !prev || speed > prev.speed;
  if (isNew) { recs[kind] = { speed, holder: holder || "—", isPlayer: !!isPlayer, year: year || 1 }; saveCourseRecords(recs); }
  return { kind, speed, isNew, prev, holder: holder || "—", isPlayer: !!isPlayer };
}
// v28: 通算タイトル数。シーズン・マイライフ両モードで自分（自チーム）が獲得した主要タイトルを
// プレイをまたいで永続的に集計する。グランツール総合優勝・グランファイナル制覇（シーズン）、
// 世界選手権優勝・オリンピック優勝（マイライフ）を数える
const TITLES_KEY = "roadrace_v12_titles";
const TITLE_DEFS = [
  { key: "grandTour", label: "グランツール総合優勝", icon: "🌍" },
  { key: "grandFinal", label: "グランファイナル制覇", icon: "🏆" },
  { key: "worlds", label: "世界選手権優勝", icon: "🌐" },
  { key: "olympics", label: "オリンピック優勝", icon: "🥇" },
];
function loadTitles() {
  try { const raw = localStorage.getItem(TITLES_KEY); const o = raw ? JSON.parse(raw) : {}; return (o && typeof o === "object") ? o : {}; } catch (e) { return {}; }
}
function recordTitle(kind) {
  if (!kind) return;
  const t = loadTitles();
  t[kind] = (t[kind] || 0) + 1;
  try { localStorage.setItem(TITLES_KEY, JSON.stringify(t)); } catch (e) { /* noop */ }
}
function totalTitleCount() {
  const t = loadTitles();
  return TITLE_DEFS.reduce((s, d) => s + (t[d.key] || 0), 0);
}
// v15: マイライフ専用の殿堂入り・レジェンド記録。マイライフモードのリセット（新しい選手で
// キャリアを始める）をまたいで、引退した歴代選手のサマリーだけを別キーで蓄積し続ける
const ML_LEGENDS_KEY = "roadrace_v12_mylife_legends";
function loadMlLegends() {
  try {
    const raw = localStorage.getItem(ML_LEGENDS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function saveMlLegends(list) {
  try { localStorage.setItem(ML_LEGENDS_KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
}
// v33.3: 系統確立レジストリ。プレイをまたいで系統名ごとの累積実績を記録し、血統が
// 「未確立→確立→名門→大系統」と育っていく。確立した系統は子孫に因子（伸びしろ＋系統特能）を授ける。
const ML_BLOODLINE_KEY = "roadrace_v12_bloodlines";
function loadBloodlines() {
  try { const raw = localStorage.getItem(ML_BLOODLINE_KEY); const o = raw ? JSON.parse(raw) : {}; return (o && typeof o === "object") ? o : {}; }
  catch (e) { return {}; }
}
function saveBloodlines(obj) {
  try { localStorage.setItem(ML_BLOODLINE_KEY, JSON.stringify(obj)); } catch (e) { /* noop */ }
}
// 殿堂入りした選手の系統実績を累積する（引退＝殿堂入りのタイミングで呼ぶ）
function mlRegisterBloodline(leg) {
  if (!leg || !leg.lineageName) return;
  const all = loadBloodlines();
  const key = leg.lineageName;
  const rec = all[key] || { name: key, count: 0, wins: 0, podiums: 0, bestOverall: 0, abilityCounts: {}, members: [] };
  rec.count += 1;
  rec.wins += (leg.wins || 0);
  rec.podiums += (leg.podiums || 0);
  rec.bestOverall = Math.max(rec.bestOverall || 0, leg.overall || 0);
  (leg.specialAbilities || []).forEach(id => { if (ABILITIES[id] && !ABILITIES[id].bad) rec.abilityCounts[id] = (rec.abilityCounts[id] || 0) + 1; });
  if (leg.name && !rec.members.includes(leg.name)) rec.members.push(leg.name);
  if (rec.members.length > 20) rec.members = rec.members.slice(-20);
  all[key] = rec;
  saveBloodlines(all);
}
// 系統の格（確立度）。系統は「複数の名選手を輩出する」ことで初めて確立する（＝血の継続が必要）
function mlBloodlineTier(rec) {
  if (!rec) return { tier: 0, label: "未確立", score: 0 };
  const score = (rec.count || 0) * 6 + (rec.wins || 0) * 0.4 + (rec.bestOverall || 0) * 0.12;
  let tier = 0;
  if ((rec.count || 0) >= 5 && score >= 60) tier = 3;
  else if ((rec.count || 0) >= 3 && score >= 36) tier = 2;
  else if ((rec.count || 0) >= 2 && score >= 18) tier = 1;
  const label = ["未確立", "確立", "名門", "大系統"][tier];
  return { tier, label, score: Math.round(score) };
}
// 系統の因子（最も色濃く受け継がれてきた特能）
function mlBloodlineFactor(rec) {
  if (!rec || !rec.abilityCounts) return null;
  let best = null, bc = 1;
  Object.entries(rec.abilityCounts).forEach(([id, c]) => { if (c > bc && ABILITIES[id]) { bc = c; best = id; } });
  return best;
}
// 系統確立ボーナス（子孫が受け取る因子）。爆発力と同じく行き先は伸びしろ（才能キャップ・成長力）＋系統特能
function mlBloodlineBonus(lineageName) {
  if (!lineageName) return null;
  const rec = loadBloodlines()[lineageName];
  if (!rec) return null;
  const t = mlBloodlineTier(rec);
  if (t.tier <= 0) return null;
  return {
    tier: t.tier, label: t.label, rec, factor: mlBloodlineFactor(rec),
    talentCap: t.tier,               // +1 / +2 / +3
    growthSteps: t.tier >= 2 ? 1 : 0, // 名門以上は成長力も底上げ
    factorGold: t.tier >= 3,          // 大系統は因子を金特で伝える
  };
}
// v15: 引退の瞬間（強制引退・自主引退どちらも）にこのスナップショットを記録する。
// computeAchievements/riderNickname/riderCareerSummaryは全てファイル後方で定義されるが、
// 実際に呼ばれるのは選手が引退した実行時（スクリプト全体の評価が終わった後）なので問題ない
function mlLegendSnapshot(s) {
  const r = s.player;
  const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
  const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
  const achievedCount = computeAchievements(s).filter(a => a.achieved).length;
  // v31: 配合（血統）用の系譜データ。この選手を血統IDで識別し、両親・祖先・+値・世代を記録する。
  // 祖先は深追いしすぎないよう、両親＋その祖先までを最大12件で保持する
  const retiredAt = Date.now();
  const bloodId = "b:" + (r.name || "無名") + "#" + retiredAt;
  const ancestors = Array.isArray(r.ancestorBloodIds) ? r.ancestorBloodIds.slice(0, 12) : [];
  const arch = mlCareerArchetype(s); // v31.4: 生き様（称号）
  return {
    name: r.name, type: r.type, background: r.background, team: s.team,
    endYear: s.year, age: r.age, races: (r.raceLog || []).length, wins, podiums,
    salary: s.salary, rivalName: s.rival ? s.rival.name : null, rivalRecord: s.rivalRecord || null,
    // v26: 複数ライバル制。2人目の好敵手は初対戦を終えている場合のみ記録に残す
    rival2Name: (s.rival2 && (s.rivalRecord2?.meetings || 0) > 0) ? s.rival2.name : null, rivalRecord2: s.rivalRecord2 || null,
    achievedCount, achievedTotal: ML_ACHIEVEMENTS.length,
    nickname: riderNickname(r), summary: riderCareerSummary({ ...r, farewellYear: s.year, farewellReason: "retired" }),
    // v27: 教え子（プロテジェ）システム用。引退時の最終能力・成長力・特殊能力・得意分野を
    // 記録しておくと、次のプレイでこの選手に師事した新人が能力の一部を引き継げる。
    // 旧セーブの殿堂選手にはこれらが無いため、読み出し側は type/戦績からのフォールバックを用いる
    finalAbilities: { flat: Math.round(r.flat), climb: Math.round(r.climb), sprint: Math.round(r.sprint), stamina: Math.round(r.stamina), solo: Math.round(r.solo) },
    finalSubStats: { accel: Math.round(r.accel ?? 50), build: Math.round(r.build ?? 50), mental: Math.round(r.mental ?? 50) },
    growthPow: r.growthPow, specialAbilities: [...(r.abilities || [])], focus: r.focus, overall: overall(r),
    retiredAt,
    // v31: 配合（血統）
    bloodId, ancestors, parents: r.parentBloodIds || null,
    plusValue: r.plusValue || 0, generation: r.generation || 0,
    // v31.2: 系統名（旧セーブは名前から生成）
    lineageName: r.lineageName || `${r.name || "無名"}系`,
    // v31.4: キャリアの生き様（称号）
    careerTitle: arch.title, careerTitleDesc: arch.desc, careerArchetypeKey: arch.key,
    // v33.4: 特殊配合の称号（あれば）
    specialMatingTitle: r.specialMating ? r.specialMating.title : null,
  };
}
// v27: 教え子への継承内容を導く。師匠（殿堂スナップショット）の得意能力・戦績・成長力・
// 特殊能力から、新人が受け継ぐ能力ボーナス等を算出する。旧セーブ（能力データ無し）でも
// type と戦績だけで最低限の継承ができるようフォールバックを用意する
const TYPE_ABKEYS = {
  SPR: ["sprint", "flat"], CLM: ["climb", "stamina"], RUL: ["flat", "stamina"],
  PUN: ["climb", "sprint"], TT: ["solo", "stamina"],
};
// v28: 「師の教え」＝メンター継承のアーキタイプ。師匠の脚質・戦績に応じて、伝授される
// 得意能力の方向性・継承特性（lineage）・成長力が変わる。パターンを増やして師匠ごとに
// 教え子の個性が変わるようにする。keysModeは伸ばす能力2つ、lineageは継承する看板特性
const TEACH_KEYS = {
  climb: ["climb", "stamina"], sprint: ["sprint", "flat"], solo: ["solo", "stamina"],
  hill: ["climb", "sprint"], flat: ["flat", "stamina"], power: ["sprint", "stamina"],
};
const PROTEGE_TEACHINGS = [
  { key: "king",    label: "王者の風格", lineage: "big",           keysMode: "top2",   sub: { mental: 8 },           match: m => (m.wins || 0) >= 12, desc: "大舞台で力を発揮し、師の得意能力を色濃く受け継ぐ" },
  { key: "ironman", label: "鉄人の系譜", lineage: "engine",        keysMode: "power",  sub: { mental: 4, build: 3 }, match: m => (m.races || 0) >= 90, desc: "消耗に強い無尽蔵のエンジンを受け継ぐ" },
  { key: "climb",   label: "山脈の記憶", lineage: "mount",         keysMode: "climb",  sub: { build: -6 },           match: m => m.type === "CLM", desc: "山の申し子の系譜（軽量な体格を受け継ぐ）" },
  { key: "sprint",  label: "豪脚の血統", lineage: "finisher",      keysMode: "sprint", sub: { accel: 8 },            match: m => m.type === "SPR", desc: "ゴール前の鬼の系譜（鋭い加速を受け継ぐ）" },
  { key: "tt",      label: "孤高の走法", lineage: "soloist",       keysMode: "solo",   sub: { mental: 4, accel: 3 }, match: m => m.type === "TT",  desc: "独走屋の系譜" },
  { key: "punch",   label: "変幻の技",   lineage: "puncheur",      keysMode: "hill",   sub: { accel: 6 },            match: m => m.type === "PUN", desc: "丘陵ハンターの系譜" },
  { key: "all",     label: "万能の教え", lineage: "allrounder_sp", keysMode: "top2",   sub: { accel: 3, mental: 3 }, match: () => true, desc: "脚質を選ばない万能型の教え" },
];
function protegeInherit(master) {
  const wins = master.wins || 0, podiums = master.podiums || 0;
  const strength = Math.min(1, (wins * 2 + podiums) / 40); // 0..1（伝説的な師ほど1に近い）
  const teaching = PROTEGE_TEACHINGS.find(t => t.match(master)) || PROTEGE_TEACHINGS[PROTEGE_TEACHINGS.length - 1];
  // 伸ばす得意能力：top2は師の最終能力の上位2つ（無ければtype由来）、それ以外はkeysMode指定
  let keys;
  if (teaching.keysMode === "top2") {
    keys = master.finalAbilities
      ? Object.entries(master.finalAbilities).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0])
      : (TYPE_ABKEYS[master.type] || ["flat", "stamina"]);
  } else {
    keys = TEACH_KEYS[teaching.keysMode] || ["flat", "stamina"];
  }
  const primaryBonus = Math.round(3 + strength * 4); // 3〜7
  const abBonus = {};
  abBonus[keys[0]] = primaryBonus;
  abBonus[keys[1]] = (abBonus[keys[1]] || 0) + Math.round(primaryBonus * 0.5);
  const growthPowBump = strength >= 0.55;
  // 継承特性：師の教えの看板特性（lineage）を必ず受け継ぐ。
  // さらに師本人が良特性を持っていれば、それとは別に1つ受け継ぐ（最大2特性＝手厚い継承）
  const lineageTrait = teaching.lineage;
  let inheritAbility = null;
  for (const id of (master.specialAbilities || [])) {
    if (ABILITIES[id] && !ABILITIES[id].bad && id !== lineageTrait) { inheritAbility = id; break; }
  }
  // v29: 副ステータスの継承。師の教えに応じた副ステータス補正
  const subBonus = { ...(teaching.sub || {}) };
  return { teaching, keys, abBonus, growthPowBump, lineageTrait, inheritAbility, subBonus, strength };
}
// ---------- v31: 配合（血統）システム ----------
// ウイニングポストの血統・配合・インブリード、DQMの配合（+値累代）を、マイライフの
// 師弟継承へ落とし込む。2人の殿堂レジェンドを「両親」に選ぶと両方の血を引く教え子が生まれ、
// 脚質の相性（ニック）、共通祖先による血の濃さ（インブリード）、累代で受け継ぐ+値を持つ。
function legendBloodId(l) {
  if (!l) return null;
  return l.bloodId || (l.name != null ? "n:" + l.name : null);
}
// 自身＋記録済み祖先の血統IDの集合（インブリード判定用）
function legendAncestorSet(l) {
  const set = new Set();
  const self = legendBloodId(l); if (self) set.add(self);
  (l && l.ancestors || []).forEach(a => { if (a) set.add(a); });
  return set;
}
// v31.5: 生き様（称号）の血。親のアーキタイプに応じた配合ボーナス（能力・特能・血の格）。
const ARCH_BREED = {
  world1:         { ab: { flat: 2, climb: 2, sprint: 2, stamina: 2, solo: 2 }, plus: 3, note: "世界王者の血" },
  heroMulti:      { ability: "big", ab: { stamina: 2 }, plus: 2, note: "大舞台の英雄の血" },
  hero:           { ability: "big", note: "勝負師の血" },
  emperor:        { ab: { flat: 1, climb: 1, sprint: 1, stamina: 1, solo: 1 }, plus: 2, note: "帝王の血" },
  specialist_SPR: { ab: { sprint: 4 }, ability: "finisher", note: "豪脚の血" },
  specialist_CLM: { ab: { climb: 4 }, ability: "mount", note: "山岳の血" },
  specialist_RUL: { ab: { flat: 4 }, ability: "flatlander", note: "平坦の血" },
  specialist_PUN: { ab: { climb: 2, sprint: 2 }, ability: "puncheur", note: "丘陵の血" },
  specialist_TT:  { ab: { solo: 4 }, ability: "soloist", note: "独走の血" },
  domestique:     { ab: { stamina: 3 }, ability: "domestique", note: "献身の血" },
  nearly:         { sub: { mental: 8 }, note: "雪辱の血" },
  ironman:        { ab: { stamina: 4 }, ability: "iron", note: "鉄人の血" },
  latebloom:      { ab: { stamina: 2 }, note: "遅咲きの血" },
};
function legendArchetypeKey(leg) {
  if (leg && leg.careerArchetypeKey) return leg.careerArchetypeKey;
  if (!leg) return null;
  if ((leg.wins || 0) >= 25) return "emperor";
  if ((leg.wins || 0) >= 8) return "specialist_" + leg.type;
  if ((leg.podiums || 0) >= 12 && (leg.wins || 0) <= 3) return "nearly";
  return null;
}
function archBreedBonus(leg) {
  const key = legendArchetypeKey(leg);
  return (key && ARCH_BREED[key]) ? { ...ARCH_BREED[key], key } : null;
}
// v33.4: 特殊配合（DQM由来）。特定の血の組み合わせは、あらかじめ定められた唯一無二の名血
// （金枠）を確定で生む。爆発力・危険度とは別枠。行き先は伸びしろ＋称号＋金特に限定する。
const ML_SPECIAL_MATINGS = [
  { key: "absolute_king", title: "絶対王者の系譜", color: "#ffd24a", gold: "big", talent: 4, growth: 1,
    note: "二人の世界王者の血が交わり、頂点に立つ宿命を負って生まれた",
    test: c => c.keys.filter(k => k === "world1").length >= 2 },
  { key: "hero_emperor", title: "覇道義侠録", color: "#ff9f43", gold: "big", talent: 3, growth: 1,
    note: "帝王の覇道と英雄の義侠、二つの生き様が一人に宿る",
    test: c => c.keys.includes("emperor") && (c.keys.includes("hero") || c.keys.includes("heroMulti")) },
  { key: "iron_blood", title: "不屈の鉄血", color: "#8fb4c8", gold: "iron", talent: 2, growth: 0, extra: "tough",
    note: "鉄人の血を二重に受け継ぎ、決して壊れぬ肉体を得た",
    test: c => (c.keys.filter(k => k === "ironman").length + c.abs.filter(a => a === "iron").length) >= 2 },
  { key: "all_rounder", title: "万能王の血脈", color: "#9ae6b4", gold: "engine", talent: 3, growth: 1,
    note: "登坂と平地、相反する才能が融合し、地形を選ばぬ万能王が生まれた",
    test: c => { const up = k => k === "specialist_CLM" || k === "specialist_PUN"; const sp = k => k === "specialist_SPR" || k === "specialist_RUL" || k === "specialist_TT"; return (up(c.keys[0]) && sp(c.keys[1])) || (sp(c.keys[0]) && up(c.keys[1])); } },
  { key: "pure_blood", title: "純血の極み", color: "#ff5db1", gold: null, talent: 4, growth: 1, factorGold: true,
    note: "同じ系統の血が極限まで濃縮され、純血の頂点が結晶した",
    test: c => c.lineA && c.lineB && c.lineA === c.lineB && Math.min(c.genA, c.genB) >= 4 },
];
function mlSpecialMating(parentA, parentB) {
  if (!parentA || !parentB) return null;
  const keys = [legendArchetypeKey(parentA), legendArchetypeKey(parentB)];
  const abs = [...(parentA.specialAbilities || []), ...(parentB.specialAbilities || [])];
  const ctx = { keys, abs, lineA: parentA.lineageName, lineB: parentB.lineageName, genA: parentA.generation || 0, genB: parentB.generation || 0 };
  for (const sm of ML_SPECIAL_MATINGS) { try { if (sm.test(ctx)) return sm; } catch (e) { /* noop */ } }
  return null;
}
// 脚質ペアの配合相性（ニック）。良相性ほど強い恩恵と看板特性が出る
const BREED_NICKS = {
  "SPR+SPR": { rank: "◎", label: "純血スプリンターの配合", ability: "finisher",     ab: { sprint: 5, flat: 2 } },
  "CLM+CLM": { rank: "◎", label: "純血クライマーの配合",   ability: "mount",        ab: { climb: 5, stamina: 2 } },
  "TT+TT":   { rank: "◎", label: "純血独走屋の配合",       ability: "soloist",      ab: { solo: 5, stamina: 2 } },
  "PUN+SPR": { rank: "◎", label: "豪脚パンチャーの黄金配合", ability: "finisher",     ab: { sprint: 4, climb: 3 } },
  "CLM+TT":  { rank: "◎", label: "独走クライマーの黄金配合", ability: "soloist",      ab: { climb: 4, solo: 3 } },
  "RUL+SPR": { rank: "◎", label: "平坦最強の黄金配合",       ability: "engine",       ab: { flat: 4, sprint: 3 } },
  "CLM+PUN": { rank: "○", label: "登坂職人の好配合",         ability: "mount",        ab: { climb: 4, sprint: 1 } },
  "PUN+TT":  { rank: "○", label: "変幻自在の好配合",         ability: "puncheur",     ab: { climb: 2, solo: 3 } },
  "RUL+TT":  { rank: "○", label: "鉄壁ルーラーの好配合",     ability: "engine",       ab: { flat: 3, solo: 2 } },
  "RUL+RUL": { rank: "○", label: "純血ルーラーの配合",       ability: "engine",       ab: { flat: 4, stamina: 2 } },
  "PUN+PUN": { rank: "○", label: "純血パンチャーの配合",     ability: "puncheur",     ab: { climb: 3, sprint: 2 } },
  "RUL+PUN": { rank: "○", label: "万能型の好配合",           ability: "allrounder_sp", ab: { flat: 2, climb: 2 } },
};
function breedNick(typeA, typeB) {
  const key = [typeA, typeB].sort().join("+");
  return BREED_NICKS[key] || { rank: "△", label: "標準的な配合", ability: null, ab: {} };
}
// 血の濃さ（インブリード）：両親が共通の祖先を持つほど濃い血のクロスになる
function breedInbreed(parentA, parentB) {
  const ga = legendAncestorSet(parentA), gb = legendAncestorSet(parentB);
  let count = 0; ga.forEach(x => { if (gb.has(x)) count++; });
  return { count, mergedAncestors: new Set([...ga, ...gb]) };
}
// v33: 配合評価グレードの表示色
function mlGradeColor(g) {
  return g === "SS" ? "#ff5db1" : g === "S" ? "#ffd24a" : g === "A" ? "#ff9f43" : g === "B" ? "#6cc8e5" : g === "C" ? "#9aa7b4" : "#7a828c";
}
// 配合ボーナス一式を算出（両親＝殿堂スナップショット、typeは新人の脚質）
function mlBreedBonus(parentA, parentB) {
  const nick = breedNick(parentA.type, parentB.type);
  const inb = breedInbreed(parentA, parentB);
  // +値（累代）：両親の+値の平均＋世代加算。DQM的に代を重ねるほど蓄積する
  const plusValue = Math.round(((parentA.plusValue || 0) + (parentB.plusValue || 0)) / 2) + 2;
  const plusPer = Math.min(15, plusValue); // 1能力あたりの累代ボーナス（上限15）
  const abBonus = {};
  Object.entries(nick.ab || {}).forEach(([k, v]) => { abBonus[k] = (abBonus[k] || 0) + v; });
  AB_KEYS.forEach(k => { abBonus[k] = (abBonus[k] || 0) + Math.round(plusPer * 0.5); });
  // 血の濃さボーナス：共通祖先1つにつき全能力+2（上限+8）、看板特性を確定付与
  const inbreedAb = inb.count > 0 ? (nick.ability || "big") : null;
  if (inb.count > 0) { const b = Math.min(8, inb.count * 2); AB_KEYS.forEach(k => { abBonus[k] = (abBonus[k] || 0) + b; }); }
  // 継承特性：ニックの看板特性＋もう片親の良特性＋血の濃さ特性（重複除去は呼び出し側）
  const extraAbilities = [];
  if (nick.ability) extraAbilities.push(nick.ability);
  for (const id of (parentB.specialAbilities || [])) { if (ABILITIES[id] && !ABILITIES[id].bad && !extraAbilities.includes(id)) { extraAbilities.push(id); break; } }
  if (inbreedAb && !extraAbilities.includes(inbreedAb)) extraAbilities.push(inbreedAb);
  // 副ステータス：両親の高い方の1/4を上乗せ
  const subBonus = {};
  SUB_STAT_KEYS.forEach(k => {
    const a = (parentA.finalSubStats && parentA.finalSubStats[k]) || 50;
    const b = (parentB.finalSubStats && parentB.finalSubStats[k]) || 50;
    subBonus[k] = Math.round((Math.max(a, b) - 50) * 0.25);
  });
  const growthBump = nick.rank === "◎";
  const generation = Math.max(parentA.generation || 0, parentB.generation || 0) + 1;
  // v31.1: 金特クロス（配合限定の恩恵）。両親が共通で持ち、かつ金特化できる特能は、
  // 子に「最初から金特」で受け継がれる。さらに濃い血のクロス（インブリード×2以上）では
  // ニックの看板特性も金特で結晶する。通常プレイでは勝利数などを満たさないと金特化しないため、
  // 配合でしか手に入らない特別なアドバンテージになる
  const parentAset = new Set(parentA.specialAbilities || []);
  const goldInherit = [];
  (parentB.specialAbilities || []).forEach(id => {
    if (parentAset.has(id) && GOLD_CONDITIONS[id] && !goldInherit.includes(id)) goldInherit.push(id);
  });
  if (inb.count >= 2 && nick.ability && GOLD_CONDITIONS[nick.ability] && !goldInherit.includes(nick.ability)) goldInherit.push(nick.ability);
  // v31.2: 配合限定特能（通常は絶対に手に入らない血統の証）。
  //  系統の申し子＝◎ニック かつ 濃い血or血統を重ねた配合、
  //  二刀流＝登坂系(CLM/PUN)×スプリント系(SPR/RUL)の異系交配、
  //  覇道の血脈＝4代以上続いた血統
  const exclusive = [];
  if (nick.rank === "◎" && (inb.count >= 1 || generation >= 3)) exclusive.push("sireline");
  const upA = ["CLM", "PUN"].includes(parentA.type), spA = ["SPR", "RUL"].includes(parentA.type);
  const upB = ["CLM", "PUN"].includes(parentB.type), spB = ["SPR", "RUL"].includes(parentB.type);
  if ((upA && spB) || (spA && upB)) exclusive.push("hybrid");
  if (generation >= 4) exclusive.push("dynasty");
  // v31.5: 生き様（称号）の血。両親のアーキタイプに応じて能力・特能・副ステ・血の格を上乗せ。
  // 名血（世界王者・帝王・英雄）ほど能力ボーナスが厚く、脚質専門家は得意能力を色濃く伝える。
  const archNotes = [];
  let archBaku = 0; // 名血ボーナス（爆発力用）
  [parentA, parentB].forEach(par => {
    const ab = archBreedBonus(par);
    if (!ab) return;
    archNotes.push(ab.note);
    Object.entries(ab.ab || {}).forEach(([k, v]) => { abBonus[k] = (abBonus[k] || 0) + v; });
    if (ab.sub) SUB_STAT_KEYS.forEach(k => { if (ab.sub[k]) subBonus[k] = (subBonus[k] || 0) + ab.sub[k]; });
    if (ab.ability && ABILITIES[ab.ability] && !extraAbilities.includes(ab.ability)) extraAbilities.push(ab.ability);
    if (ab.plus) AB_KEYS.forEach(k => { abBonus[k] = (abBonus[k] || 0) + ab.plus; });
    const bakuByKey = { world1: 6, heroMulti: 5, hero: 4, emperor: 4, domestique: 1, nearly: 1, ironman: 1, latebloom: 1 };
    archBaku += (bakuByKey[ab.key] != null ? bakuByKey[ab.key] : (String(ab.key).startsWith("specialist_") ? 2 : 1));
  });
  // v33: 爆発力（ウイポ由来）。ニック・血の濃さ・累代・世代・名血・金特クロス・配合限定特能を
  // 1つの数値に集約し、産駒の「素質＝伸びしろ」を決める。フラットな初期能力盛りではなく、
  // 成長力(growthPow)と才能キャップ(talentCap)へ変換して「育てると化ける」形にする。
  const nickBaku = nick.rank === "◎" ? 8 : nick.rank === "○" ? 4 : 0;
  const inbreedBaku = Math.min(12, inb.count * 4);
  const diversityBaku = Math.min(8, Math.max(0, (inb.mergedAncestors ? inb.mergedAncestors.size : 0) - 2) * 2); // 血脈活性化（多様性）
  const legacyBaku = Math.min(10, Math.round(plusPer * 0.6) + Math.max(0, generation - 1));
  const specialBaku = goldInherit.length * 4 + exclusive.length * 3;
  const bakuhatsu = Math.round(nickBaku + inbreedBaku + diversityBaku + legacyBaku + specialBaku + archBaku);
  const matingGrade = bakuhatsu >= 30 ? "SS" : bakuhatsu >= 23 ? "S" : bakuhatsu >= 16 ? "A" : bakuhatsu >= 10 ? "B" : bakuhatsu >= 5 ? "C" : "D";
  const growthSteps = bakuhatsu >= 24 ? 2 : bakuhatsu >= 13 ? 1 : 0; // 成長力の底上げ段数
  const talentCap = Math.min(8, Math.floor(Math.max(0, bakuhatsu - 16) / 3)); // 才能：限界突破の上乗せ
  // v33.2: 危険度（インブリードの代償）。血が濃いほど虚弱・故障持ちで生まれるリスクが上がる。
  // 両親の健康な血（鉄人・頑丈）と、血脈の多様性（活性化配合）でリスクは和らぐ。
  let healthMit = 0;
  [parentA, parentB].forEach(par => {
    const sa = par.specialAbilities || [];
    if (sa.includes("tough")) healthMit += 18;
    if (sa.includes("iron")) healthMit += 10;
    const stam = (par.finalAbilities && par.finalAbilities.stamina) || 0;
    if (stam >= 85) healthMit += 6;
  });
  const danger = Math.max(0, Math.min(95, Math.round(inb.count * 22 + Math.max(0, inb.count - 1) * 8 - diversityBaku * 1.5 - healthMit)));
  const dangerLabel = danger >= 60 ? "激" : danger >= 38 ? "高" : danger >= 18 ? "中" : danger > 0 ? "低" : "無";
  // v33.4: 特殊配合（唯一無二の名血）
  const special = mlSpecialMating(parentA, parentB);
  return { nick, inbreed: inb, plusValue, plusPer, abBonus, extraAbilities, subBonus, growthBump, inbreedAb, generation, goldInherit, exclusive, archNotes, bakuhatsu, matingGrade, growthSteps, talentCap, danger, dangerLabel, healthMit, special };
}
// v31.1: 血統IDから表示名を得る（殿堂に記録のない祖先はIDから名前部分を抽出）
function bloodIdToName(id, map) {
  if (!id) return "？";
  if (map && map[id]) return map[id].name;
  const m = /^b:(.+)#\d+$/.exec(id) || /^n:(.+)$/.exec(id);
  return m ? m[1] : id;
}
// v31.1: 殿堂リストから血統IDをキーにしたマップを作る
function buildBloodMap(legends) {
  const map = {};
  (legends || []).forEach(l => { const id = legendBloodId(l); if (id) map[id] = l; });
  return map;
}
// v31.1: 配合相性表の表示用データ（◎○を抜粋。△は数が多いので省略）
function breedNickTableRows() {
  return Object.entries(BREED_NICKS)
    .map(([k, v]) => ({ pair: k.split("+"), ...v }))
    .sort((a, b) => (a.rank === b.rank ? 0 : a.rank === "◎" ? -1 : b.rank === "◎" ? 1 : a.rank === "○" ? -1 : 1));
}
function mlRecordLegend(s) {
  const snap = mlLegendSnapshot(s);
  saveMlLegends([...loadMlLegends(), snap]);
  mlRegisterBloodline(snap); // v33.3: 系統確立レジストリへ実績を累積
}
// v26: 引退後キャリア（エピローグ）。引退直後に殿堂入りしたスナップショットへ、
// 選んだ道（監督/完全引退）に応じたフレーバーテキストを後付けで追記する
function mlSetEpilogue(text) {
  const legends = loadMlLegends();
  if (legends.length === 0) return;
  legends[legends.length - 1] = { ...legends[legends.length - 1], epilogue: text };
  saveMlLegends(legends);
}
// v28: 自伝・レジェンドインタビュー。引退時に自伝を出版すると、選んだ座右の言葉が
// 殿堂記録に「名言」として刻まれる。mlSetEpilogueと同様に最新の殿堂入り選手へ後付けする
function mlSetAutobiography(quote) {
  const legends = loadMlLegends();
  if (legends.length === 0) return;
  legends[legends.length - 1] = { ...legends[legends.length - 1], autobiography: quote };
  saveMlLegends(legends);
}
// キャリアの傾向（勝利数・表彰台・ライバル・年数）から自伝タイトルと座右の言葉候補を導く
function mlAutobiographyOptions(s) {
  const r = s.player;
  const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
  const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
  const opts = [];
  if (wins >= 8) opts.push({ title: "『頂へ — 勝利の記憶』", quote: "勝ち続けることでしか見えない景色があった。悔いはない。" });
  else opts.push({ title: "『それでも走った』", quote: "勝てない日も、腐らずペダルを回し続けた。それが誇りだ。" });
  if (podiums >= 10) opts.push({ title: "『表彰台の向こう側』", quote: "何度あの台に立っても、頂点への渇きは消えなかった。" });
  opts.push({ title: "『好敵手へ』", quote: s.rival ? `${s.rival.name}がいたから、俺はここまで来られた。` : "ライバルとは、鏡に映したもう一人の自分だった。" });
  opts.push({ title: "『次の世代へ』", quote: "この道は、後に続く者たちへ託したい。走る歓びよ、続け。" });
  return opts.slice(0, 3);
}
function mlEpilogueDirector(s) {
  const r = s.player;
  const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
  const tone = wins >= 10 ? "百戦錬磨の経験を武器に" : wins >= 3 ? "現役時代に培った勘を頼りに" : "現役時代の悔しさを糧に";
  return `引退後は${s.team}のスポーツディレクターに転身。${tone}後進の指導にあたった。数年後、教え子の一人がプロ入りを果たしたという知らせが届いた。`;
}
function mlEpilogueAway(s) {
  const r = s.player;
  return `引退後は競技の一線から静かに退き、第二の人生を歩み始めた。${r.name}の名は、あの頃を知るファンの記憶に長く残り続けている。`;
}
// v26: 生涯評価（プレステージスコア）。周回プレイをまたいで蓄積される既存の永続データ
// （シーズンモードの生涯クリアポイント・マイライフの歴代選手記録）を1つのスコアに集約する。
// 新たな永続ストレージは増やさず、既にある2つの記録源だけから算出する
function computePrestige() {
  const meta = loadMeta();
  const legends = loadMlLegends();
  const mlWins = legends.reduce((s, l) => s + (l.wins || 0), 0);
  const mlPodiums = legends.reduce((s, l) => s + (l.podiums || 0), 0);
  const mlAchieved = legends.reduce((s, l) => s + (l.achievedCount || 0), 0);
  // v28: 通算タイトルもプレステージに加える（1タイトル=25点の重み）
  const titleCount = totalTitleCount();
  const score = Math.round(meta.totalEarnedCP * 3 + legends.length * 15 + mlWins * 2 + mlPodiums * 1 + mlAchieved * 5 + titleCount * 25);
  return { score, totalEarnedCP: meta.totalEarnedCP, legendCount: legends.length, mlWins, mlPodiums, mlAchieved, titleCount };
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

// v27: 実況テキストの拡充。区間タイプごとに複数の実況パターンを用意し、単調な
// 「◯◯へ突入！」の繰り返しを避ける（区間インデックスで決定的に選ぶ）
const SEG_COMMENTARY = {
  flat: ["平坦区間、集団は一団となってハイスピードで進む", "風を切る平坦路、隊列が長く伸びていく", "平坦の巡航、アシストが前を固めてペースを作る", "平坦基調、脚を溜めながらの我慢比べだ"],
  hill: ["丘陵に差しかかる、パンチャーがそわそわし始める", "細かなアップダウンで集団にじわじわ負荷がかかる", "起伏の連続、脚のある者が徐々に前へ上がる", "丘陵区間、ここで無理をすると後半に響く"],
  climb: ["本格的な登坂開始、クライマーの独壇場だ", "勾配がきつくなり、早くも千切れる選手が出る", "山岳区間、じりじりとタイム差が生まれていく", "登りに入った、パワーウェイトレシオがものを言う"],
  sprint: ["最終スプリント区間へ、隊列が一気に凝縮する", "ゴールスプリントの位置取り争いが激化してきた", "スプリンターが車列の前方へ殺到する", "ラスト、トレインが発進態勢に入る"],
  mtn: ["山頂フィニッシュへ、最後の急坂が待ち受ける", "頂上決戦、ここまでの疲労がすべて出る", "最後の登り、まさに勝負どころだ", "山頂ゴールへの激坂、脚が残っているのは誰だ"],
  tt: ["個人TT、孤独な独走のはじまり", "エアロポジションを保ち一定ペースを刻む", "独走力の真価が問われる区間だ", "タイムトライアル、己との戦いが続く"],
};
const FINISH_COMMENTARY = [
  "🎙 フィニッシュ！歓声が競技場を包む",
  "🎙 ゴール！長い戦いに決着がついた",
  "🎙 フィニッシュライン通過！勝者が決まる",
];

// v9: 出走人数を固定値からsquadMin〜squadMaxの幅に変更（編成画面で選択）
const TEMPLATES = [
  { kind: "クリテリウム", favors: "SPR", squadMin: 1, squadMax: 5, laps: 6, segs: [["flat", 300, 18], ["flat", 260, 15], ["sprint", 90, 4]] },
  { kind: "サーキットレース", favors: "SPR", squadMin: 1, squadMax: 5, laps: 4, segs: [["flat", 380, 20], ["hill", 260, 12], ["flat", 320, 16], ["sprint", 110, 4]] },
  { kind: "丘陵ロード", favors: "PUN", squadMin: 1, squadMax: 5, segs: [["flat", 480, 26], ["hill", 450, 17], ["hill", 450, 17], ["sprint", 130, 4]] },
  { kind: "山岳ロード", favors: "CLM", squadMin: 1, squadMax: 5, segs: [["flat", 460, 26], ["climb", 600, 13], ["climb", 640, 12], ["mtn", 190, 4]] },
  { kind: "ヒルクライム", favors: "CLM", squadMin: 1, squadMax: 5, segs: [["climb", 560, 14], ["climb", 600, 12], ["mtn", 190, 4]] },
  { kind: "個人TT", favors: "TT", squadMin: 1, squadMax: 1, segs: [["tt", 520, 22], ["tt", 520, 22]] },
];
// v28: 実績アンロック式の新コンテンツ。累計クリアポイント（totalEarnedCP）が閾値に達すると、
// 通常のTEMPLATESに加えて新しいコース種別がカレンダーに出現するようになる。TEMPLATESは
// index参照される箇所があるため配列は変えず、レース生成時の抽選プールだけを広げる
const UNLOCK_TEMPLATES = [
  { kind: "ナイトクリテリウム", favors: "SPR", squadMin: 1, squadMax: 5, laps: 8, unlockCP: 20, segs: [["flat", 260, 16], ["flat", 240, 14], ["sprint", 90, 4]] },
  { kind: "グラベルレース", favors: "PUN", squadMin: 1, squadMax: 5, unlockCP: 45, segs: [["flat", 420, 22], ["hill", 400, 16], ["climb", 300, 10], ["sprint", 120, 4]] },
];
function unlockedTemplates() {
  const cp = loadMeta().totalEarnedCP;
  return [...TEMPLATES, ...UNLOCK_TEMPLATES.filter(t => cp >= t.unlockCP)];
}
function groupModeFor(squadN) {
  if (squadN === 1) return "solo";
  if (squadN === 2) return "pelotonOnly";
  return "full";
}
const VENUES = ["房総", "飛騨", "阿蘇", "蔵王", "琵琶湖", "瀬戸内", "津軽", "日光", "富士", "美濃", "丹波", "石鎚"];
// v28: 会場ごとの相性・ホームアドバンテージ。各会場を地方ブロックに割り当て、自チームの
// 本拠地（homeRegion）と同じ地方のレースでは地元の声援で出走選手に小さな能力ボーナスがつく
const REGIONS = ["東日本", "中部", "西日本"];
const VENUE_REGION = {
  "房総": "東日本", "蔵王": "東日本", "津軽": "東日本", "日光": "東日本",
  "飛騨": "中部", "富士": "中部", "美濃": "中部", "琵琶湖": "中部",
  "阿蘇": "西日本", "瀬戸内": "西日本", "丹波": "西日本", "石鎚": "西日本",
};
const HOME_ABILITY_BONUS = 3;
function raceIsHome(race, homeRegion) {
  return !!(homeRegion && race && race.venue && VENUE_REGION[race.venue] === homeRegion);
}
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
  camp:  { label: "トレーニングキャンプ券", desc: "今月の練習効果×2（チーム全体）。ただし全員の疲労+25（故障リスクに注意）", price: 25 },
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
  manager: { label: "監督", desc: "スポンサー契約が好条件に（Lvごと月収+12%・ノルマ-8%・成功報酬+10%）" },
  trainer: { label: "トレーナー", desc: "練習の成長効果がアップする（Lvごと+12%・恒常）" },
  doctor:  { label: "ドクター", desc: "故障の発生率が下がり（Lvごと-22%）、故障期間も大きく短縮される" },
  // v28: スカウトスタッフ。新人スカウト候補の能力ブレ幅（＝査定の不確かさ）を減らし、
  // 逸材（成長S確定の隠し玉）の発掘率も上げる。スカウト方針とは別枠で査定精度を高める役割
  scout:   { label: "スカウト", desc: "新人候補の査定が正確になり（Lvごとブレ-30%）、逸材の発掘率も大きく上がる" },
};
// v29バグ修正: スカウト等のスタッフがPRO到達までまともに機能せず「今更感」があるという
// 指摘を受け、B1（最初のクラス）から各スタッフをLv1雇用できるよう解禁時期を前倒しした
const STAFF_MAX_BY_CLASS = [1, 2, 3];
const STAFF_SALARY_PER_LV = 12; // 万円/月・レベル1つあたり（月給制、昇格なし＝買い切り費用は無し）
function staffSalaryTotal(staff) {
  if (!staff) return 0;
  return (Object.values(staff).reduce((a, b) => a + b, 0)) * STAFF_SALARY_PER_LV;
}
// v27: 引退選手のスタッフ登用（OBコーチ）。殿堂入りしたOBを月給制で専属コーチに迎えると、
// その選手の脚質に対応する能力の練習効果が全選手+25%になる。月給8万円で一度に1名まで。
const OB_COACH_SALARY = 8; // 万円/月
const TYPE_COACH_ABILITY = { SPR: "sprint", CLM: "climb", RUL: "flat", PUN: "climb", TT: "solo" };

// v7: パーツスロットを4種に拡張
const PART_SLOTS = ["frame", "tire", "wheels", "nutrition"];
const SLOT_LABEL = { frame: "フレーム", tire: "タイヤ", wheels: "ホイール", nutrition: "補給食" };
// v28: 機材のアビリティ配分がスタミナ・独走に偏りすぎていた（補給食・タイヤがほぼこの2つ専用）
// ため、各スロットの選択肢を5能力に分散し直した。特に手薄だったスプリントを各スロットに追加。
// フレーム＝スプリント/平坦/登坂、ホイール＝平坦/登坂、タイヤ＝スプリント/独走/スタミナ/登坂、
// 補給食＝スタミナ/スプリントを基本に、脚質ごとに機材で伸ばす能力を選べるようにした
const PARTS = {
  fr_sprint: { slot: "frame", tier: 1, label: "スプリントフレーム", ab: { sprint: 6 }, price: 28 },
  fr_aero:   { slot: "frame", tier: 1, label: "エアロロードフレーム", ab: { flat: 6 }, price: 28 },
  fr_light:  { slot: "frame", tier: 1, label: "超軽量クライムフレーム", ab: { climb: 6 }, price: 28 },
  ti_endure: { slot: "tire", tier: 1, label: "耐久タイヤ", ab: { stamina: 6 }, price: 22 },
  ti_tt:     { slot: "tire", tier: 1, label: "TTタイヤ", ab: { solo: 6 }, price: 22 },
  ti_grip:   { slot: "tire", tier: 1, label: "グリップタイヤ", ab: { sprint: 4, climb: 3 }, price: 22 },
  wh_light:  { slot: "wheels", tier: 1, label: "軽量ホイール", ab: { climb: 5 }, price: 24 },
  wh_aero:   { slot: "wheels", tier: 1, label: "エアロホイール", ab: { flat: 5 }, price: 24 },
  nu_gel:    { slot: "nutrition", tier: 1, label: "エナジージェル", ab: { stamina: 5 }, price: 18 },
  nu_bar:    { slot: "nutrition", tier: 1, label: "カフェインジェル", ab: { sprint: 3, stamina: 3 }, price: 18 },
  fr_sprint2:{ slot: "frame", tier: 2, label: "スプリントフレームPro", ab: { sprint: 10 }, price: 48 },
  fr_aero2:  { slot: "frame", tier: 2, label: "エアロフレームPro", ab: { flat: 10 }, price: 48 },
  fr_light2: { slot: "frame", tier: 2, label: "クライムフレームPro", ab: { climb: 10 }, price: 48 },
  ti_race:   { slot: "tire", tier: 2, label: "レーシングタイヤ", ab: { sprint: 5, solo: 5 }, price: 40 },
  wh_race:   { slot: "wheels", tier: 2, label: "レーシングホイール", ab: { flat: 5, climb: 5 }, price: 44 },
  nu_pro:    { slot: "nutrition", tier: 2, label: "プロ仕様補給食", ab: { stamina: 8 }, price: 36 },
  fr_ult:    { slot: "frame", tier: 3, label: "モノコックUltimate", ab: { flat: 4, climb: 4, sprint: 4, stamina: 4, solo: 4 }, price: 90 },
  ti_ult:    { slot: "tire", tier: 3, label: "レーシングプロトUltimate", ab: { sprint: 4, solo: 8 }, price: 70 },
  wh_ult:    { slot: "wheels", tier: 3, label: "エアロクライムUltimate", ab: { flat: 6, climb: 6 }, price: 80 },
  nu_ult:    { slot: "nutrition", tier: 3, label: "アルティメット補給食", ab: { stamina: 6, sprint: 4 }, price: 60 },
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
// v15: グレード4はマイライフの節目の大会（世界選手権・オリンピック）専用の最高格付け
const GRADE_MUL = { 1: 1, 2: 1.5, 3: 2, 4: 2.6 };
// v25: 天候の悪化。レース単位で「晴れ／雨／猛暑」を1つ決め、雨は能力を一律で少し下げつつ
// 落車リスクを上乗せし（悪天候巧者持ちは軽減）、猛暑は出走後の疲労蓄積を増やす。
// 横風のような区間単位の演出ではなく、レース全体にかかる駆け引き要素として扱う
const WEATHER = {
  clear: { label: "晴れ", icon: "☀️" },
  rain: { label: "雨", icon: "🌧" },
  heat: { label: "猛暑", icon: "🥵" },
};
function rollWeather(rng) {
  const r = rng();
  if (r < 0.14) return "rain";
  if (r < 0.24) return "heat";
  return "clear";
}
// v25: マイライフの個人スポンサー・メディア人気度。節目（25/50/75/100）に到達するたびに
// 一時金の個人スポンサー契約が入る。加えて月々の人気度に応じた個人スポンサー収入も別途支給する
const POP_MILESTONES = [
  { th: 25, bonus: 80 }, { th: 50, bonus: 150 }, { th: 75, bonus: 250 }, { th: 100, bonus: 400 },
];

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
  // v25: イベントの種類をさらに増やしてほしいという要望。ネガティブな不和イベントに
  // 偏らないよう、表彰・地域交流・OB指導など前向き〜中立寄りの出来事を中心に追加
  { id: "cityAward", title: "自治体から表彰の打診", text: "地元自治体から「スポーツ振興功労賞」として表彰したいとの連絡が来た。",
    choices: [
      { label: "表彰式に出席する", result: "晴れやかな式典となり、地域からの支援がさらに厚くなった。", effects: { budget: 22, rosterCondAll: 1 } },
      { label: "書面での受賞に留める", result: "式典は辞退したが、記念品と共に祝い金が届いた。", effects: { budget: 12 } },
    ] },
  { id: "obCoach", title: "OB選手が臨時コーチとして参加", text: "現役時代に鳴らしたOBが、臨時コーチとして数日帯同してくれることになった。",
    choices: [
      { label: "みっちり指導を受ける", result: "実戦的な指導が刺激になり、成長のコツを掴んだ選手が出た。", effects: { growthPowUpgradeRandom: 1, rosterFatigueAll: 6 } },
      { label: "軽めのアドバイスに留める", result: "無理のない範囲で助言をもらい、和やかな雰囲気で終えた。", effects: { rosterCondAll: 1 } },
    ] },
  { id: "nutritionist", title: "栄養士から食事指導の提案", text: "スポーツ栄養士から、選手向けの食事メニュー指導をしたいと申し出があった。",
    choices: [
      { label: "全員で指導を受ける", result: "食生活が見直され、体調管理の意識が高まった。", effects: { rosterCondAll: 1, rosterFatigueAll: -6 } },
      { label: "希望者だけに任せる", result: "関心のある選手だけが指導を受け、無理のない範囲で取り入れた。", effects: { rosterFatigueAll: -3 } },
    ] },
  { id: "localFestival", title: "地域の自転車イベントとの日程調整", text: "近隣で行われる自転車の地域イベントと練習日程が重なりそうだ。",
    choices: [
      { label: "イベントに協力する", result: "地域との関係を優先し、日程を調整して協力した。多少慌ただしくなった。", effects: { budget: 14, rosterFatigueAll: 7 } },
      { label: "練習を優先する", result: "予定通り練習に専念し、コンディションを整えた。", effects: { rosterFatigueAll: -8 } },
    ] },
  { id: "youngTalentBuzz", title: "育成選手の走りが評判に", text: "若手選手の練習での走りが、関係者の間でひそかに評判になっているらしい。",
    choices: [
      { label: "期待に応えるよう後押しする", result: "期待を力に変え、練習に一段と熱が入った。", effects: { boostRandomRiderAbilities: 5, rosterFatigueAll: 6 } },
      { label: "焦らず見守る", result: "プレッシャーをかけずに見守ることにした。", effects: { condRandomRider: 1 } },
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
  // v28: 周回プレイで姓の被りが目立つとの指摘を受けさらに追加（実在頻度の高い姓を中心に）
  "野村", "小松", "武田", "上野", "杉山", "増田", "小山", "大久保", "丸田", "今村",
  "服部", "平田", "岩本", "田島", "望月", "永井", "浅野", "松浦", "河合", "星",
  "馬場", "菊地", "広瀬", "本田", "秋田", "根本", "野中", "堀", "神田", "沢田",
  "水野", "杉本", "大森", "須藤", "吉川", "飯田", "土屋", "堀内", "川崎", "関",
  "内藤", "松下", "浜田", "尾崎", "早川", "森本", "岡", "萩原", "小池", "村田",
  // v28: 姓も似た系統（藤◯・天◯・星◯…）で固まって見えるとの指摘を受け、漢字が散る実在姓をさらに追加
  "福井", "桑原", "岸本", "森下", "川上", "田辺", "富田", "平井", "黒木", "石橋",
  "三宅", "中西", "大橋", "篠原", "白川", "江口", "樋口", "山内", "竹中", "岡崎",
  "片山", "畑中", "板垣", "伊達", "稲垣", "宇野", "大内", "奥村", "香川", "神谷",
  "北川", "越智", "小澤", "阪本", "立花", "津田", "成田", "難波", "二宮", "沼田",
  "平塚", "福原", "前川", "松永", "三上", "水口", "宗像", "矢野", "柳沢", "米田",
  "若林", "浅井", "鵜飼", "海老原", "大隈", "柏木", "門脇", "北原", "楠", "河内",
  "小暮", "紺野", "笹川", "志村", "須賀", "瀬川", "高松", "田代", "土井", "堂本",
  "灘", "袴田", "日向", "深谷", "牧野", "槇島", "宮下", "毛利", "薬師寺", "湯川",
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
// v28: 下の名前が1文字漢字ばかりで周回時に被って見えるとの指摘を受け、2文字の名前を大量追加。
// pickRiderNameはGIVEN(1字)とGIVEN2(2字)を合わせた母集団から抽選し、名の多様性を大幅に広げる
const GIVEN2 = [
  "大輝", "翔太", "健太", "悠斗", "陽向", "颯太", "拓海", "海斗", "大和", "蓮司",
  "翔平", "涼介", "健吾", "雄大", "隼人", "直樹", "亮太", "翼", "駿介", "陽介",
  "圭介", "慎太郎", "航平", "悠真", "陽太", "大地", "琉生", "湊斗", "結翔", "陽斗",
  "駿太", "遼太郎", "光輝", "英輝", "和樹", "一輝", "拓也", "康平", "俊介", "壮一",
  "誠也", "友哉", "智也", "貴大", "秀樹", "篤志", "祐介", "洋平", "凌駕", "楓真",
  "壮太", "怜央", "颯真", "叶大", "碧斗", "奏太", "湊太", "悠斗", "櫂", "煌大",
  "晴斗", "陽翔", "大翔", "悠人", "蒼真", "颯馬", "眞人", "宗一郎", "誠一", "武尊",
  "隼太", "遥斗", "凪咲", "海翔", "汐音", "陣内", "駿平", "峻平", "翔真", "悠翔",
  "大成", "琉偉", "怜", "凰介", "京介", "岳人", "泰河", "颯人", "翠", "琥珀",
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
  const supR = log.filter(e => ["support", "sub", "experience", "domestique"].includes(e.role)).length;
  const aceR = log.filter(e => ["ace", "lead"].includes(e.role)).length;
  const abs = { flat: r.flat, climb: r.climb, sprint: r.sprint, stamina: r.stamina, solo: r.solo };
  const top = Object.entries(abs).sort((a, b) => b[1] - a[1])[0][0];
  // v31.4: 「勝ち星が多い＝みんな伝説の勝ち師」で没個性化していたため、勝利数上位は
  // 脚質を冠した称号にし、役割（献身のアシスト）や取りこぼし（悲運）も拾って多様化する
  const byTypeKing = { flat: "平坦の帝王", climb: "山岳の覇者", sprint: "豪脚のゴールハンター", stamina: "無尽蔵の機関車", solo: "独走の求道者" };
  const byType = { flat: "巡航の職人", climb: "山岳の申し子", sprint: "スプリンター", stamina: "鉄の脚", solo: "独走屋" };
  if (supR >= 10 && supR >= aceR * 1.5 && wins <= 4) return "献身のアシスト";
  if (podiums >= 10 && wins <= 2) return "悲運の名脇役";
  if (wins >= 8) return byTypeKing[top] || "常勝の帝王";
  if (wins >= 5) return "常勝の帝王";
  if (wins >= 3) return "勝利の申し子";
  if (podiums >= 12) return "表彰台の主";
  if (podiums >= 6) return "表彰台の常連";
  if (races >= 12 && podiums === 0) return "苦労人";
  if (r.prodigy) return "将来を嘱望された逸材";
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
// v16: tierはチームが所属する実際のクラス（0=B1／1=A／2=PRO）。マイライフの移籍
// オファー画面でチームのランクを一目でわかるように表示し、かつ実際にそのチームと
// 契約するとプレイヤーのclassIdxがそのtierに変わる（機材解放条件に直結する）
const RIVAL_TEAMS = [
  { name: "レッドサンダー山陽", color: "#d9484a", tier: 1 }, { name: "クレディ・ブルー", color: "#3f7fd9", tier: 2 },
  { name: "ヴェロチタ京都", color: "#9a6be0", tier: 0 }, { name: "ウィンドミル北海道", color: "#e08a3f", tier: 0 },
];
// v14: マイライフモード用のチームプール（6チーム）。プレイヤーは新人としてこの中の
// 1チームに加入し、残り5チームは全て純粋なライバルAIチームとしてレースに登場する
const MYLIFE_TEAMS = [
  ...RIVAL_TEAMS,
  { name: "サンライズ静岡", color: "#4fd1c5", tier: 0 }, { name: "北斗プロサイクル", color: "#c084fc", tier: 1 },
];
const CLASS_TIER_COLOR = [C.sub, C.blue, C.yellow];
function mlTeamTier(teamName) { const t = MYLIFE_TEAMS.find(t => t.name === teamName); return t ? t.tier : 0; }
// v28: ライバルチームの動向ニュース。年月から決定的に生成する簡易フレーバー。
// シーズンモードのメイン画面に毎月表示し、他チームが動いている手触りを出す
const RIVAL_NEWS_TEMPLATES = [
  t => `${t}が有望な若手を獲得し、戦力を着々と上積みしているという。`,
  t => `${t}が今季ここまで好調をキープ。勢いに乗っている。`,
  t => `${t}はエースの不振に苦しみ、やや停滞気味との情報だ。`,
  t => `${t}のエースに、他チームからの引き抜きの噂が浮上している。`,
  t => `${t}が最新機材を導入し、平坦での速さに磨きをかけたらしい。`,
  t => `${t}で世代交代が進み、チームの雰囲気が変わりつつあるようだ。`,
  t => `${t}が強化合宿を敢行。次戦に向けて仕上げてきそうだ。`,
  t => `${t}が監督体制を刷新し、戦術に変化が見られるという。`,
];
function rivalNews(year, month) {
  const rng = mulberry((year || 1) * 137 + (month || 0) * 31 + 911);
  const team = RIVAL_TEAMS[Math.floor(rng() * RIVAL_TEAMS.length)];
  const tmpl = RIVAL_NEWS_TEMPLATES[Math.floor(rng() * RIVAL_NEWS_TEMPLATES.length)];
  return { team: team.name, color: team.color, text: tmpl(team.name) };
}
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
  // v25: イベントの種類をさらに増やしてほしいという要望を受けて追加
  { title: "地元の子供たちからサイン会の依頼", text: "地域の子供向けサイクリング教室から、サイン会に来てほしいと依頼が来た。",
    choices: [
      { label: "喜んで引き受ける", result: "子供たちの憧れの眼差しに、身の引き締まる思いがした。", effects: { fatigueDelta: 3, abBoost: 1 } },
      { label: "手紙だけ送る", result: "無理のない形で気持ちを届けた。", effects: { fatigueDelta: -3 } },
    ] },
  { title: "先輩選手から食事に誘われる", text: "チームの先輩から「たまには飯でも」と誘われた。",
    choices: [
      { label: "経験談を聞かせてもらう", result: "貴重な経験談を聞け、走りへのヒントを得た気がする。", effects: { abBoost: 2, fatigueDelta: 2 } },
      { label: "気楽に楽しむ", result: "肩の力を抜いた楽しい時間を過ごせた。", effects: { fatigueDelta: -6 } },
    ] },
  { title: "新しいトレーニング理論の紹介", text: "海外で話題のトレーニング理論を紹介する記事を読んだ。",
    choices: [
      { label: "さっそく取り入れてみる", result: "新しい刺激になり、動きに変化の兆しが見えた。", effects: { abBoost: 3, fatigueDelta: 8 } },
      { label: "今のやり方を信じて続ける", result: "これまで積み上げてきたやり方を貫くことにした。", effects: { fatigueDelta: -2 } },
    ] },
  { title: "地方紙にインタビューが掲載", text: "地方紙の取材を受けた記事が、思いのほか大きく掲載された。",
    choices: [
      { label: "手応えを噛みしめる", result: "評価されている実感が自信につながった。", effects: { abBoost: 1, managerEvalDelta: 2 } },
      { label: "浮かれず淡々と過ごす", result: "普段通りのペースを崩さず過ごせた。", effects: { fatigueDelta: -4 } },
    ] },
];
// v27: 個人スポンサーの依頼イベント。人気度が一定以上になると受けられる、CM出演・撮影などの
// 単発の仕事。引き受けると報酬（お金）と人気度が得られるが、その月は競技に集中できず疲労が残る。
// 報酬は現在の人気度に比例して大きくなる（有名になるほど良い仕事が舞い込む）
const ML_SPONSOR_GIGS = [
  { title: "スポーツ用品ブランドのCM撮影", text: "個人スポンサーから、新製品のテレビCM出演のオファーが届いた。",
    baseMoney: 30, moneyPerPop: 1.2, pop: 3, fatigue: 12,
    acceptResult: "スタジオでの終日撮影をこなした。露出が増え、知名度がぐっと上がった。" },
  { title: "自転車雑誌の表紙撮影", text: "有名自転車雑誌から、表紙モデルとしての撮影依頼が来た。",
    baseMoney: 24, moneyPerPop: 1.0, pop: 3, fatigue: 9,
    acceptResult: "こだわりの撮影は長丁場だったが、雑誌の表紙を飾ることで注目が集まった。" },
  { title: "トークショー・ファンイベント出演", text: "スポンサー主催のファンイベントに、ゲストとして招かれた。",
    baseMoney: 20, moneyPerPop: 0.8, pop: 4, fatigue: 8,
    acceptResult: "ファンとの交流イベントは大盛況。多くの応援を背に受けることになった。" },
  { title: "地域プロモーション動画への出演", text: "地元自治体との共同で、地域を盛り上げるプロモ動画への出演依頼が来た。",
    baseMoney: 26, moneyPerPop: 1.0, pop: 2, fatigue: 10,
    acceptResult: "地域と一体になったプロモーションは好評で、応援の輪が広がった。" },
];
// v15: 人生の岐路イベント。ML_EVENTSの毎月の小さな出来事とは違い、年度末にだけ低確率で
// 発生し、一度きりの大きな選択とその後ずっと続く恒常効果を持つ。flagsに解決済みかどうかを
// 記録し、同じ岐路が二度は訪れないようにする
const ML_CROSSROADS = {
  marriage: {
    key: "marriage", title: "人生の岐路 — 結婚",
    text: "長年支えてくれた恋人から、将来について話したいと切り出された。",
    choices: [
      { label: "プロポーズする",
        result: "結婚した。生活が安定し、心身ともに落ち着いて競技に取り組めるようになった（以後、毎月の疲労回復がわずかに上がる）。",
        apply: (player, flags) => ({ player, flags: { ...flags, married: true, marriageResolved: true } }) },
      { label: "今は競技に集中したいと伝える",
        result: "気持ちを尊重してもらい、今は競技に専念することにした。",
        apply: (player, flags) => ({ player, flags: { ...flags, marriageResolved: true } }) },
    ],
  },
  injury: {
    key: "injury", title: "人生の岐路 — 大きな怪我",
    text: "練習中の落車で大きな怪我を負ってしまった。復帰への向き合い方が問われている。",
    choices: [
      { label: "焦らず段階的に戻す",
        result: "無理をせず、着実にリハビリを積んで復帰を果たした。一時的に能力が落ち込んだが、後遺症は残らなかった。",
        apply: (player, flags) => ({
          player: { ...player, flat: Math.max(20, player.flat - 3), climb: Math.max(20, player.climb - 3), sprint: Math.max(20, player.sprint - 3), stamina: Math.max(20, player.stamina - 3), solo: Math.max(20, player.solo - 3) },
          flags: { ...flags, injuryResolved: true },
        }) },
      { label: "早期復帰を目指す",
        result: "予定より早く戦列に復帰したが、無理がたたって本調子が長く続かず、以後も違和感を抱えることになった（毎月の疲労回復がわずかに下がる）。",
        // v17: 無理な早期復帰の代償として、枠に空きがあれば「ガラスの体」を後天的に負ってしまう
        apply: (player, flags) => {
          const canAcquire = (player.abilities || []).length < 3 && !hasAbility(player, "glass");
          return {
            player: {
              ...player,
              flat: Math.max(20, player.flat - 1), climb: Math.max(20, player.climb - 1), sprint: Math.max(20, player.sprint - 1), stamina: Math.max(20, player.stamina - 1), solo: Math.max(20, player.solo - 1),
              abilities: canAcquire ? [...(player.abilities || []), "glass"] : (player.abilities || []),
            },
            flags: { ...flags, injuryResolved: true, rushedInjuryComeback: true },
          };
        },
        resultNote: (player) => hasAbility(player, "glass") ? "この経験から、特殊能力「ガラスの体」が身についてしまった…。" : "" },
      // v26: リハビリの過ごし方をもう1択増やしてほしいという要望を受けて追加。
      // 安全策（焦らず段階的に戻す）・早期復帰（リスクあり）に加え、「新しい走り方を模索する」を
      // 用意した。短期的な能力低下は最も大きいが、後遺症なしで新たな特殊能力を直接獲得できる
      { label: "新しい走り方を模索する",
        result: "長い休養の間、これまでとは違う走り方を模索した。踏み込む力は一時的に落ち込んだが、後遺症なく戦列に戻れた。",
        apply: (player, flags) => {
          const owned = new Set(player.abilities || []);
          const eligible = Object.keys(ABILITIES).filter(k => !ABILITIES[k].bad && !owned.has(k));
          const canAcquire = (player.abilities || []).length < 3 && eligible.length > 0;
          const picked = canAcquire ? eligible[Math.floor(Math.random() * eligible.length)] : null;
          return {
            player: {
              ...player,
              flat: Math.max(20, player.flat - 5), climb: Math.max(20, player.climb - 5), sprint: Math.max(20, player.sprint - 5), stamina: Math.max(20, player.stamina - 5), solo: Math.max(20, player.solo - 5),
              abilities: picked ? [...(player.abilities || []), picked] : (player.abilities || []),
            },
            flags: { ...flags, injuryResolved: true },
          };
        },
        resultNote: (player, prevPlayer) => {
          const newlyAdded = (player.abilities || []).find(id => !(prevPlayer.abilities || []).includes(id));
          return newlyAdded ? `模索の末、新しい特殊能力「${ABILITIES[newlyAdded].label}」を身につけた！` : "";
        } },
    ],
  },
  // v17: 結婚した選手にだけ、その後さらに続く家庭の岐路として第一子誕生を用意する
  child: {
    key: "child", title: "人生の岐路 — 第一子誕生",
    text: "パートナーから妊娠を伝えられた。もうすぐ親になる。",
    choices: [
      { label: "喜んで育児にも積極的に関わる",
        result: "新しい家族を迎え、生活に張り合いが生まれた。家庭がしっかり支えてくれることで、以後は疲労がさらに抜けやすくなった。",
        apply: (player, flags) => ({ player, flags: { ...flags, hasChild: true, childResolved: true } }) },
      { label: "パートナーに任せ、競技を最優先する",
        result: "家庭のサポートを受けつつ競技に集中する環境を整えた。練習によりのめり込めるようになった（以後、練習効果がわずかに上がる）。",
        apply: (player, flags) => ({ player, flags: { ...flags, hasChild: true, childResolved: true, childFocusedCareer: true } }) },
    ],
  },
  // v25: 新人時代に指導を受けていた恩師との別れ。新人期は練習・出走経験の伸びに
  // ボーナスが乗るが、キャリアが進むと「もう教えることはない」と巣立ちを促される
  mentor_graduation: {
    key: "mentor_graduation", title: "人生の岐路 — 恩師との別れ",
    text: "新人時代から指導してくれた恩師が「もう教えることはない。あとは自分の力で這い上がれ」と告げてきた。",
    choices: [
      { label: "教えを胸に、独り立ちする",
        result: "恩師の教えを胸に刻み、独り立ちを決意した。これまでの指導の総仕上げとして、餞別に一段と地力が上がった。",
        apply: (player, flags) => {
          const p = { ...player };
          AB_KEYS.forEach(k => { p[k] = Math.min(135, p[k] + 3); });
          return { player: p, flags: { ...flags, mentorActive: false } };
        } },
      { label: "感謝を伝え、これからも助言を仰ぐ",
        result: "巣立ちを告げられつつも、関係は緩やかに続けることにした。指導ボーナスはなくなったが、時折もらえる助言が心の支えになっている。",
        apply: (player, flags) => ({ player, flags: { ...flags, mentorActive: false } }) },
    ],
  },
};
// v15: その年度末に人生の岐路イベントを発生させるか判定する。既に解決済みの岐路は対象外、
// 条件を満たすものが複数あればランダムに1つだけ選ぶ（同じ年に2つ重ねない）
function mlRollCrossroads(s, player) {
  const flags = s.flags || {};
  const candidates = [];
  if (!flags.marriageResolved && player.age >= 25 && Math.random() < 0.35) candidates.push(ML_CROSSROADS.marriage);
  if (!flags.injuryResolved && (player.raceLog || []).length >= 6 && Math.random() < 0.2) candidates.push(ML_CROSSROADS.injury);
  // v17: 結婚済み・未解決なら第一子誕生の岐路が続く
  if (flags.married && !flags.childResolved && player.age >= 27 && Math.random() < 0.3) candidates.push(ML_CROSSROADS.child);
  // v25: 新人期の師弟関係は3年目を迎えたタイミングで必ず一区切りを迎える（確率抽選なし）
  if (flags.mentorActive && s.year >= 3) candidates.push(ML_CROSSROADS.mentor_graduation);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
// v17: オフシーズンの過ごし方。年度末処理のたびに必ず1つ選ぶ（人生の岐路とは違い毎年発生する）。
// 安全策（国内自主トレ）・ハイリスクハイリターン（海外武者修行）・休養の3択で明確なトレードオフを出す
const ML_OFFSEASON_CHOICES = [
  { key: "domestic", label: "国内で自主トレーニングに励む", desc: "堅実に基礎を積む。伸びは控えめだが安全",
    result: "オフシーズンは国内で黙々と走り込み、着実に地力を蓄えた。",
    apply: (player, year) => { const p = { ...player }; AB_KEYS.forEach(k => addAb(p, k, 2, mlGrowthCap(year, p))); return p; } },
  { key: "overseas", label: "海外武者修行に出る", desc: "レベルの高い環境に飛び込む。伸びは大きいが疲労が残る",
    result: "海外の強豪選手たちに揉まれ、大きく成長する手応えを掴んだ。ただし疲労が抜けきらないまま新シーズンを迎えることになった。",
    apply: (player, year) => { const p = { ...player }; AB_KEYS.forEach(k => addAb(p, k, 4, mlGrowthCap(year, p))); p.fatigue = Math.min(100, p.fatigue + 20); return p; } },
  { key: "rest", label: "心身をしっかり休める", desc: "疲労を大きくリセットして万全の状態で新シーズンへ",
    result: "オフシーズンをゆっくり過ごし、心身ともにリフレッシュして新シーズンを迎える。",
    apply: (player) => ({ ...player, fatigue: Math.max(0, player.fatigue - 40) }) },
];
// v15: マイライフの実績・アチーブメント。既存のraceLog・rivalRecord・flags・classIdxだけから
// 判定する（達成状態を別途保持しない）ので、算出のたびに常に最新の状態と一致する
const ML_ACHIEVEMENTS = [
  { id: "first_win", icon: "🥇", label: "初勝利", desc: "レースで初めて優勝する", reward: { money: 30 },
    check: (ml) => (ml.player?.raceLog || []).some(e => e.rank === 1) },
  { id: "first_podium", icon: "🏅", label: "初表彰台", desc: "レースで初めて表彰台に上がる", reward: { money: 20 },
    check: (ml) => (ml.player?.raceLog || []).some(e => e.rank <= 3) },
  { id: "class_a", icon: "⬆️", label: "Aクラス昇格", desc: "Aクラスに昇格する", reward: { money: 50, cp: 1 },
    check: (ml) => ml.classIdx >= 1 },
  { id: "class_pro", icon: "👑", label: "PROクラス到達", desc: "PROクラスに昇格する", reward: { money: 100, cp: 2 },
    check: (ml) => ml.classIdx >= 2 },
  { id: "worlds_podium", icon: "🌍", label: "世界選手権メダリスト", desc: "世界選手権で表彰台に上がる", reward: { money: 80, cp: 2 },
    check: (ml) => (ml.player?.raceLog || []).some(e => e.name.includes("世界選手権") && e.rank <= 3) },
  { id: "worlds_win", icon: "🌍", label: "世界選手権制覇", desc: "世界選手権で優勝する", reward: { money: 150, cp: 4 },
    check: (ml) => (ml.player?.raceLog || []).some(e => e.name.includes("世界選手権") && e.rank === 1) },
  { id: "olympics_podium", icon: "🥇", label: "オリンピックメダリスト", desc: "オリンピックで表彰台に上がる", reward: { money: 100, cp: 3 },
    check: (ml) => (ml.player?.raceLog || []).some(e => e.name.includes("オリンピック") && e.rank <= 3) },
  { id: "olympics_win", icon: "🥇", label: "オリンピック制覇", desc: "オリンピックで金メダルを獲得する", reward: { money: 200, cp: 5 },
    check: (ml) => (ml.player?.raceLog || []).some(e => e.name.includes("オリンピック") && e.rank === 1) },
  { id: "rival_5wins", icon: "🔥", label: "宿命のライバル", desc: "ライバルに5勝する", reward: { money: 60 },
    check: (ml) => (ml.rivalRecord?.wins || 0) >= 5 },
  { id: "veteran_50", icon: "🚴", label: "百戦錬磨", desc: "通算50戦に出走する", reward: { money: 60 },
    check: (ml) => (ml.player?.raceLog || []).length >= 50 },
  { id: "married", icon: "💍", label: "家庭を持つ", desc: "結婚する", reward: { money: 30 },
    check: (ml) => !!ml.flags?.married },
  { id: "injury_comeback", icon: "🩹", label: "苦難を乗り越えて", desc: "大きな怪我から復帰する", reward: { money: 30 },
    check: (ml) => !!ml.flags?.injuryResolved },
  { id: "has_child", icon: "👶", label: "親になる", desc: "第一子を授かる", reward: { money: 30 },
    check: (ml) => !!ml.flags?.hasChild },
  { id: "mentor", icon: "🎖", label: "チームの精神的支柱に", desc: "後輩選手のメンターになる", reward: { money: 40 },
    check: (ml) => !!ml.flags?.mentor },
];
function computeAchievements(ml) {
  return ML_ACHIEVEMENTS.map(a => ({ ...a, achieved: a.check(ml) }));
}
// v17: シーズンモード（チーム運営）版の実績システム。マイライフと同様、既存の
// careerStats・careerHistory・hallOfFame・classIdx・roster・captainIdだけから判定する
const SEASON_ACHIEVEMENTS = [
  { id: "first_win", icon: "🥇", label: "初優勝", desc: "レースで初めて優勝する", reward: { money: 30 },
    check: (g) => g.careerStats.totalWins >= 1 },
  { id: "first_podium", icon: "🏅", label: "初表彰台", desc: "レースで初めて表彰台に上がる", reward: { money: 20 },
    check: (g) => g.careerStats.totalPodiums >= 1 },
  { id: "class_a", icon: "⬆️", label: "Aクラス昇格", desc: "Aクラスに昇格する", reward: { money: 50, cp: 1 },
    check: (g) => g.classIdx >= 1 },
  { id: "class_pro", icon: "👑", label: "PROクラス到達", desc: "PROクラスに昇格する", reward: { money: 100, cp: 2 },
    check: (g) => g.classIdx >= 2 },
  { id: "champion", icon: "🏆", label: "グランファイナル制覇", desc: "グランファイナルで総合優勝する", reward: { money: 200, cp: 5 },
    check: (g) => (g.careerHistory || []).some(h => h.champBest === 1) },
  { id: "wins_50", icon: "🔥", label: "通算50勝", desc: "チーム通算で50勝する", reward: { money: 150, cp: 3 },
    check: (g) => g.careerStats.totalWins >= 50 },
  { id: "races_100", icon: "🚴", label: "百戦錬磨", desc: "チーム通算で100戦に出走する", reward: { money: 100, cp: 2 },
    check: (g) => g.careerStats.totalRaces >= 100 },
  { id: "hof_1", icon: "🏛", label: "名鑑入り選手を輩出", desc: "殿堂入り選手を1人以上輩出する", reward: { money: 40 },
    check: (g) => (g.hallOfFame || []).length >= 1 },
  { id: "chemistry_max", icon: "🤝", label: "鉄壁の絆", desc: "チームケミストリーを最高段階まで高める", reward: { money: 50 },
    check: (g) => teamChemistryTier(g.roster).label === "鉄壁の絆" },
  { id: "captain", icon: "🎖", label: "主将を任命", desc: "チームに主将を任命する", reward: { money: 20 },
    check: (g) => !!g.captainId },
  { id: "jersey", icon: "🎽", label: "副次タイトル獲得", desc: "グランツールでポイント賞・山岳賞・新人賞のいずれかを獲得する", reward: { money: 60, cp: 1 },
    check: (g) => { const j = g.jerseyWinCounts; return !!j && (j.points > 0 || j.mountains > 0 || j.youth > 0); } },
];
function computeSeasonAchievements(g) {
  return SEASON_ACHIEVEMENTS.map(a => ({ ...a, achieved: a.check(g) }));
}
// v18: 実績報酬（資金・クリアポイント）を表示用テキストに整形する
function formatAchievementReward(a) {
  if (!a.reward) return "";
  const parts = [];
  if (a.reward.money) parts.push(`+${a.reward.money}万円`);
  if (a.reward.cp) parts.push(`CP+${a.reward.cp}`);
  return parts.length ? `報酬：${parts.join("／")}` : "";
}
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
  // v20: 稼いだ資金の使い道が尽きて余りがちだったため、終盤向けの最上位グレードを追加
  { label: "都心の高級タワーマンション", price: 900, fatigueBonus: 30, desc: "毎月の疲労回復+30。この上ない生活環境で、監督評価もさらに上がりやすくなる" },
];
const ML_CARS = [
  { label: "中古の軽自動車", price: 60, raceFatigueCut: 0.10, desc: "レース参加による疲労蓄積-10%" },
  { label: "国産セダン", price: 160, raceFatigueCut: 0.20, desc: "レース参加による疲労蓄積-20%" },
  { label: "輸入スポーツカー", price: 400, raceFatigueCut: 0.30, desc: "レース参加による疲労蓄積-30%" },
  { label: "オーダーメイドの高級SUV", price: 750, raceFatigueCut: 0.38, desc: "レース参加による疲労蓄積-38%" },
];
// v15フェーズ2: 種目別専門コーチ（恒常）。5種目それぞれの練習効果を、現在の練習指定に
// 関わらずそのアビリティが対象になったときだけ底上げする
const ML_AB_COACH_KEY = { flat: "flatCoach", climb: "climbCoach", sprint: "sprintCoach", stamina: "staminaCoach", solo: "soloCoach" };
const ML_GEAR = {
  roller: { label: "自主トレ用スマートローラー", price: 90, desc: "練習の成長効果+15%（恒常）" },
  monitor: { label: "パワーメーター一式", price: 70, desc: "狙った能力の伸びがさらに+10%（恒常）" },
  chef: { label: "専属コンディショニングシェフ", price: 150, desc: "レース参加による疲労蓄積が10%軽減される（恒常）" },
  flatCoach:    { label: "平坦専門コーチ", price: 100, desc: "平坦の練習効果+25%（恒常）" },
  climbCoach:   { label: "登坂専門コーチ", price: 100, desc: "登坂の練習効果+25%（恒常）" },
  sprintCoach:  { label: "スプリント専門コーチ", price: 100, desc: "スプリントの練習効果+25%（恒常）" },
  staminaCoach: { label: "スタミナ専門コーチ", price: 100, desc: "スタミナの練習効果+25%（恒常）" },
  soloCoach:    { label: "独走専門コーチ", price: 100, desc: "独走の練習効果+25%（恒常）" },
};
const GROWTHPOW_ORDER = ["C", "B", "A", "S"];
// v21: マイライフのaddAb呼び出しはこれまでcap未指定でsoftFactorの既定値（88＝シーズンモードの
// イージー相当）に固定されており、長いキャリアの途中で能力が伸び切ってしまっていた。
// v23: 固定値に引き上げただけでは、結局そのより高い壁に到達した時点で同じ問題（練習が
// ソフトキャップ付近でほぼ無意味になる）が起きるだけだと指摘を受けた。soft capはvが
// cap未満なら効果1倍・cap超で指数関数的に急減するという「壁」の構造そのものが原因のため、
// 経過年数に応じて上限自体をじわじわ引き上げ、長いキャリアを通して壁に本当の意味で
// 到達しない（＝練習が最後まで意味を持ち続ける）ようにする
function mlGrowthCap(year, player) {
  // v33: 配合の才能キャップ（talentCap）は選手固有の限界突破分。生まれ持った素質で天井が上がる
  const talent = (player && player.talentCap) ? player.talentCap : 0;
  return Math.min(140, 90 + Math.floor(Math.max(0, (year || 1) - 1)) * 2 + talent);
}
// v27: 毎月の生活費・税負担。年俸の一定割合＋クルマ・住居のグレード維持費。
// 年俸が伸びるほど額も増えるので、手取りは頭打ちになり資金のダブつきが抑えられる
function mlLivingCost(s) {
  const salaryTax = Math.round((s.salary || 0) / 12 * 0.5);
  const carUpkeep = Math.max(0, (s.carLv ?? -1) + 1) * 4;
  const houseUpkeep = Math.max(0, (s.houseLv ?? -1) + 1) * 4;
  return salaryTax + carUpkeep + houseUpkeep;
}
// v27: 私設強化合宿の費用。年次・クラスが上がるほど高額になり、後半のダブついた
// 資金の受け皿になる（同時に、スケールしていくAIに能力で食らいつく手段にもなる）
function mlPrivateCampCost(s) {
  return 120 + Math.max(0, (s.year || 1) - 1) * 40 + (s.classIdx || 0) * 60;
}
// v19: 超早熟は稀な自然発生のみで到達できる特別枠のため、育成アイテムでの
// 到達先には含めない（晩成方向への進行のみ：早熟→普通→晩成→超晩成）
const GROWTH_ORDER = ["early", "normal", "late", "super_late"];
const ML_STOCK_ITEMS = {
  drink: { label: "リカバリードリンク", desc: "疲労を30回復", price: 15, fatigueDelta: -30 },
  supp:  { label: "上質な休養サプリ", desc: "疲労を60回復", price: 32, fatigueDelta: -60 },
  tune:  { label: "フォーム調整剤", desc: "フォームを+12（レース前の仕上げに）", price: 20, formDelta: 12 },
  // v15フェーズ2: 成長力・成長タイプを底上げする消耗品
  growthPowUp: { label: "才能開花プログラム", desc: "成長力を1段階アップ（C→B→A→S）", price: 180, growthPowUp: true },
  growthShift: { label: "晩成型トレーニング理論", desc: "成長タイプを1段階「晩成」寄りに変更（早熟→普通→晩成→超晩成）", price: 150, growthShiftUp: true },
};
// v28: 練習メニューの専門化。通常練習（focus中心）に加え、狙いを絞った専門メニューを選べる。
// 対象2能力を強く伸ばす代わりに疲労が大きい。メンタル強化は能力より調子を整える枠
const ML_SPECIAL_TRAINING = {
  altitude: { label: "🏔 高地合宿", keys: ["stamina", "solo"], gainMul: 1.7, fatigue: 24, cond: 0, desc: "スタミナ・独走を集中的に鍛える（疲労大）" },
  sprintcamp: { label: "⚡ スプリント特訓", keys: ["sprint", "flat"], gainMul: 1.7, fatigue: 20, cond: 0, desc: "スプリント・平坦＋加速力を集中的に鍛える" },
  climbcamp: { label: "⛰ クライム合宿", keys: ["climb", "stamina"], gainMul: 1.7, fatigue: 24, cond: 0, desc: "登坂・スタミナを集中的に鍛える（疲労大）" },
  mental: { label: "🧘 メンタル強化", keys: [], gainMul: 0.4, fatigue: 6, cond: 1, desc: "メンタルを重点強化＋全能力わずか底上げ・フォーム+8（疲労小）" },
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
// v28: 1字の名(GIVEN)と2字の名(GIVEN2)を合わせた母集団から抽選。姓の追加と合わせて
// 組み合わせ数が大幅に増え（約310姓×約190名≒5.9万通り）、周回をまたいだ被りが起きにくくなる
const GIVEN_ALL = [...GIVEN, ...GIVEN2];
function pickRiderName(rng, banned) {
  let name, tries = 0;
  do {
    name = SURNAMES[Math.floor(rng() * SURNAMES.length)] + " " + GIVEN_ALL[Math.floor(rng() * GIVEN_ALL.length)];
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

// v29: コア5能力とは別の「副ステータス」3種。AB_KEYSには入れず（parts/overall/練習全体への
// 波及を避けるため）、生成・表示・シムの特定フックにだけ効かせる独立軸。
//   accel  加速力：アタックの初速・ゴール前の飛び出しの鋭さ（スプリント=トップ速度とは別）
//   build  体格 ：高いほど重量＝平坦/独走で有利・登坂で不利（パワーウェイトの本質）
//   mental メンタル：★3など大舞台での能力・調子の安定・勝負どころの粘り
const SUB_STAT_KEYS = ["accel", "build", "mental"];
const SUB_STAT_LABEL = { accel: "加速力", build: "体格", mental: "メンタル" };
function buildDesc(build) { return build >= 66 ? "パワー型" : build >= 45 ? "標準" : "軽量型"; }
function genSubStats(type, rng, opts = {}) {
  const j = () => (rng() - 0.5) * 24;
  const accelBase = { SPR: 68, PUN: 64, RUL: 54, CLM: 44, TT: 42 }[type] ?? 50;
  const buildBase = { SPR: 68, RUL: 66, PUN: 52, TT: 48, CLM: 34 }[type] ?? 50;
  const persM = { genius: 8, smart: 5, seeker: 4, artisan: 2 }[opts.personality] ?? 0;
  const boost = opts.forceProdigy ? 10 : 0;
  const cl = (v) => Math.max(20, Math.min(95, Math.round(v)));
  return {
    accel: cl(accelBase + j() + boost),
    build: cl(buildBase + j()), // 体格は才能とは無関係なので逸材補正なし
    mental: cl(48 + (rng() - 0.5) * 40 + persM + boost),
  };
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
  // v19: ごく稀に「超早熟」「超晩成」という極端な成長タイプが出現する（明示指定時は対象外）
  if (!opts.growth) {
    const rare = rng();
    if (rare < 0.03) growth = "super_early";
    else if (rare < 0.06) growth = "super_late";
  }
  const abilities = rollAbilities(rng, { forceProdigy: opts.forceProdigy });
  const px = rng();
  let personality = px < 0.30 ? "normal" : px < 0.35 ? "genius"
    : ["hotblood", "seeker", "artisan", "free", "smart"][Math.floor(rng() * 5)];
  let growthPowVal = opts.growthPow || randPow(rng, opts.powDist);
  if (opts.forceProdigy) { personality = "genius"; growthPowVal = "S"; }
  const sub = genSubStats(type, rng, { personality, forceProdigy: opts.forceProdigy });
  const rider = {
    id: RID++,
    name: pickRiderName(rng, opts.banned),
    type, ...r, ...sub, age, growth, growthPow: growthPowVal, abilities, personality,
    fatigue: 20 + Math.floor(rng() * 20), cond: 3, condForecast: (rng() < 0.34 ? -1 : rng() < 0.5 ? 0 : 1), injury: 0, streak: 0,
    focus: "flat", joinOvr: 0, parts: { frame: null, tire: null, wheels: null, nutrition: null },
    prodigy: !!opts.forceProdigy,
    raceLog: [], // v13: 選手名鑑用の出走履歴（{year, month, name, rank}）
    favorite: false, // v13.1: お気に入り登録（殿堂入り条件を満たさなくても必ず記録に残す）
    tenure: 0, // v17: チームケミストリー用の在籍月数（加入時は常に0からスタート）
  };
  rider.joinOvr = overall(rider);
  return rider;
}

function initRoster() {
  // v12バグ修正: 初期メンバー6名の名前が完全固定されており、新しくゲームを始めても
  // 毎回同じ名前になってしまうと気になるとのフィードバックを受け、能力値・年齢・役割の
  // バランスはそのまま維持しつつ、名前だけを新規ゲームのたびにランダム生成するようにした
  const rng = mulberry(Date.now() % 999983);
  const mk = (name, type, f, c, sp, st, so, age, growth, pow, trait, pers) => {
    const r = {
      id: RID++, name, type, flat: f, climb: c, sprint: sp, stamina: st, solo: so,
      ...genSubStats(type, rng, { personality: pers }),
      age, growth, growthPow: pow, abilities: trait ? [trait] : [], personality: pers,
      fatigue: 20, cond: 3, condForecast: 0, injury: 0, streak: 0,
      focus: "flat", joinOvr: 0, parts: { frame: null, tire: null, wheels: null, nutrition: null },
      raceLog: [], favorite: false, tenure: 0,
    };
    r.joinOvr = overall(r); return r;
  };
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
function genScouts(classIdx, seed, policy = "balance", existingNames, scoutLv = 0) {
  const rng = mulberry(seed);
  const base = CLASSES[classIdx].scout;
  const count = SCOUT_COUNT_BY_CLASS[classIdx];
  const specs = scoutSpecs(policy, count);
  const prodigyRng = mulberry(seed + 999);
  // v28: スカウトスタッフのレベルに応じて逸材（成長S確定）の発掘率が上がる
  const hasProdigy = prodigyRng() < PRODIGY_CHANCE_BY_CLASS[classIdx] * (1 + scoutLv * 0.6);
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
    // v28: スカウトスタッフのレベルで査定のブレ幅が縮む（lv3で約25%まで）
    const blurMul = Math.max(0.2, 1 - scoutLv * 0.28);
    const blur = {};
    AB_KEYS.forEach(k => {
      const d = (6 + rng() * 9) * blurMul;
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

// v17: 選手間トレード。ライバルチームが自チームの特定選手に目を付け、代わりに
// 自チーム所属の選手と近い実力の選手を1名提示してくる。最大2件、毎月入れ替わる
function genTradeOffers(classIdx, seed, roster) {
  if (!roster || roster.length <= 1) return [];
  const rng = mulberry(seed);
  const base = CLASSES[classIdx].scout;
  const nameBanned = new Set(roster.map(r => r.name));
  const wanted = [...roster].sort(() => rng() - 0.5).slice(0, Math.min(2, roster.length));
  return wanted.map(r => {
    const team = RIVAL_TEAMS[Math.floor(rng() * RIVAL_TEAMS.length)];
    const power = Math.max(base * 0.6, overall(r) + (rng() - 0.5) * 12);
    const offeredRider = newRider(power, rng, { banned: nameBanned });
    return { id: `trade-${r.id}-${Math.floor(rng() * 999999)}`, team: team.name, teamColor: team.color, wantRiderId: r.id, offeredRider };
  });
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
  // v28: 累計CPで解禁される新コース種別も抽選プールに含める
  const pool = unlockedTemplates();
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
      tmpl: TEMPLATES[3], grade: 3, cls: classIdx, weather: rollWeather(rng),
      lockReason: qualified ? null : (isProFinal
        ? `出場権なし（年間グランツール全${GRAND_TOURS.length}戦制覇が必要・現在${gtWinCount}/${GRAND_TOURS.length}勝）`
        : `出場権なし（${CLASSES[classIdx].need}pt必要）`),
    });
    const t = pool[Math.floor(rng() * pool.length)];
    const fvenue = VENUES[Math.floor(rng() * VENUES.length)];
    races.push({ id: `r-${year}-${month}-x`, name: `${fvenue}ファイナルロード`, venue: fvenue, tmpl: t, grade: 2, cls: classIdx, locked: false, weather: rollWeather(rng) });
    return races;
  }
  const count = month === 0 ? 3 : (month === 8 || month === 9) ? 4 : 5;
  const openCount = month === 0 ? 2 : 2 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const t = pool[Math.floor(rng() * pool.length)];
    const open = i < openCount;
    const cls = open ? classIdx : Math.floor(rng() * 3);
    const grade = month === 0 ? 1 : month === 10 ? (i === 0 ? 3 : 1 + Math.floor(rng() * 2)) : 1 + Math.floor(rng() * 3);
    const venue = VENUES[Math.floor(rng() * VENUES.length)];
    races.push({
      id: `r-${year}-${month}-${i}`,
      name: `${venue}${t.kind}`, venue,
      tmpl: t, grade, cls, weather: rollWeather(rng),
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
      grade: 3, cls: classIdx, locked: false, lockReason: null, weather: rollWeather(rng),
    });
  }
  if (sponsor && sponsor.mandateMonths && sponsor.mandateMonths.includes(month)) {
    const target = races.find(r => !r.locked);
    if (target) target.sponsorMandate = true;
  }
  return races;
}

// ---------- 実効能力 ----------
function rainMul(r, weather) {
  if (weather !== "rain") return 1;
  return hasAbility(r, "rain_sp") ? 0.97 : 0.93;
}
function effAbilities(r, equip, itemBoost, grade, weather) {
  const fatPen = 1 - Math.max(0, (r.fatigue || 0) - 50) * 0.003;
  const cm = condMul(r.cond || 3);
  // v29: ピーキング（フォーム）。狙って仕上げた選手はレース当日に能力が底上げされる（±約17%）。
  // マイライフ専用の概念で、フォーム未設定の選手（AI・シーズン）は50=1.0で無影響
  const formMul = 1 + ((r.form ?? 50) - 50) / 300;
  const e = {};
  AB_KEYS.forEach(k => { e[k] = r[k]; });
  if (r.parts) {
    PART_SLOTS.forEach(slot => {
      const pid = r.parts[slot];
      if (pid && PARTS[pid]) Object.entries(PARTS[pid].ab).forEach(([k, v]) => { e[k] += v; });
    });
  }
  // v28: 大舞台適性。big=★3で+6%、nervous(悪特性)=★3で-5%
  // v29: メンタルも★3で能力に反映（±約8%）。特性big/nervousと重ねる
  const mental = r.mental ?? 50;
  const mentalBig = grade === 3 ? 1 + (mental - 50) / 600 : 1;
  const bigMul = (grade === 3 ? (hasAbility(r, "big") ? 1.06 : hasAbility(r, "nervous") ? 0.95 : 1) : 1) * mentalBig;
  const wMul = rainMul(r, weather);
  AB_KEYS.forEach(k => { e[k] = e[k] * cm * fatPen * bigMul * wMul * formMul; });
  // v28: オールラウンダーは全能力を控えめに底上げ（脚質を選ばない万能型）
  if (hasAbility(r, "allrounder_sp")) AB_KEYS.forEach(k => { e[k] += hasGoldAbility(r, "allrounder_sp") ? 4 : 2; });
  // v31.2: 配合限定特能。系統の申し子＝全能力+3、覇道の血脈＝全能力+2かつスタミナ+3
  if (hasAbility(r, "sireline")) AB_KEYS.forEach(k => { e[k] += 3; });
  if (hasAbility(r, "dynasty")) { AB_KEYS.forEach(k => { e[k] += 2; }); e.stamina += 3; }
  // v29: 体格（パワーウェイト）。軽いほど登坂有利・重いほど平坦/独走有利
  const build = r.build ?? 50;
  e.climb *= 1 + (50 - build) / 300;
  e.flat *= 1 + (build - 50) / 350;
  e.solo *= 1 + (build - 50) / 450;
  e.flat *= (1 + equip.frame * 0.06) * (itemBoost.suit ? 1.15 : 1);
  e.climb *= (1 + equip.wheels * 0.06) * (itemBoost.wheel ? 1.15 : 1);
  // v29バグ修正: 万一いずれかの能力値が欠損（旧セーブ等でundefined）していると
  // NaNがシミュレーション全体（finishTime等）に伝播し、最終的にレース描画がクラッシュして
  // 画面が真っ暗になる恐れがあった。非有限値は安全な既定値(50)に丸めて必ず有限にする
  AB_KEYS.forEach(k => { e[k] = Number.isFinite(e[k]) ? Math.min(135, e[k]) : 50; });
  e.type = r.type; e.abilities = r.abilities; e.goldAbilities = r.goldAbilities;
  // v29: 副ステータスをエントラントにも持たせ、tick計算・最終区間で参照する
  e.accel = r.accel ?? 50; e.mental = mental; e.build = build;
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
// v27: 今季のチームポイント順位表。他チームのポイントは実シミュレーションしていないため、
// 年・クラス・チーム名から決定的に「シーズン想定合計」を割り出し、経過月数に応じて按分して
// 現在値を推定する（難易度が上がるほど他チームも強くなる）。自チームは実際のポイントを使う
function computeStandings(g) {
  const monthProg = Math.max(0.08, (g.month + 1) / 12);
  const need = CLASSES[g.classIdx].need;
  const diffMul = (DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).aiMul;
  const dynastyMul = 1 + Math.min(0.4, (g.dynastyLevel || 0) * 0.1);
  const rows = RIVAL_TEAMS.map(t => {
    const rng = mulberry(strHash(t.name) + g.year * 101 + g.classIdx * 7);
    const strength = (0.6 + rng() * 0.85) * diffMul * dynastyMul;
    const seasonTotal = Math.round(need * strength * 1.35);
    return { name: t.name, color: t.color, pts: Math.round(seasonTotal * monthProg), isPlayer: false };
  });
  rows.push({ name: g.teamName || "あなたのチーム", color: C.yellow, pts: g.points, isPlayer: true });
  rows.sort((a, b) => b.pts - a.pts);
  return rows;
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
  // v15: 特殊能力による区間タイプ別の能力補正（金特なら効果2倍）
  if (hasAbility(e, "mount") && ["climb", "mtn"].includes(segType)) ab += hasGoldAbility(e, "mount") ? 8 : 4;
  if (hasAbility(e, "puncheur") && segType === "hill") ab += hasGoldAbility(e, "puncheur") ? 8 : 4;
  if (hasAbility(e, "flatlander") && segType === "flat") ab += hasGoldAbility(e, "flatlander") ? 8 : 4;
  if (hasAbility(e, "sprinter_sp") && segType === "sprint") ab += hasGoldAbility(e, "sprinter_sp") ? 8 : 4;
  if (hasAbility(e, "soloist") && segType === "tt") ab += hasGoldAbility(e, "soloist") ? 8 : 4;
  if (hasAbility(e, "closer") && (segType === "sprint" || segType === "mtn")) ab += hasGoldAbility(e, "closer") ? 8 : 4;
  // v31.2: 配合限定「二刀流」。丘陵・山岳・スプリントの各区間で+5（登坂型とスプリント型の血を併せ持つ証）
  if (hasAbility(e, "hybrid") && ["hill", "climb", "mtn", "sprint"].includes(segType)) ab += 5;
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
  let ab = segmentAbility(segType, en, steepness);
  // v15: 展開依存の特殊能力（逃げ屋・献身のアシスト）は、能力算出時点ではmodeを
  // 知らないsegmentAbilityではなくここで加算する
  if (hasAbility(en, "escape") && mode === "attack") ab += hasGoldAbility(en, "escape") ? 8 : 4;
  if (hasAbility(en, "domestique") && mode === "pull") ab += hasGoldAbility(en, "domestique") ? 6 : 3;
  // v29: 加速力はアタック（飛び出し・ギャップ埋め）の鋭さに効く
  if (mode === "attack") ab += ((en.accel ?? 50) - 50) * 0.2;
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
  // v28: 「無尽蔵のエンジン」はレース中のエネルギー消耗が軽い（金特で更に軽減）
  const engineMul = hasAbility(en, "engine") ? (hasGoldAbility(en, "engine") ? 0.80 : 0.88) : 1;
  return TICK_SEC * (1 - en.stamina / 150) * DRAIN_K * effortCost(mode, segType, steepness) * roleTerrainMismatchMul(en.role, segType) * engineMul;
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
// v28: ゴール勝負の駆け引きを反映。最終スプリントは実力（スプリント能力）で決まるため、
// スプリントが弱点の選手ほど集団ゴールでは分が悪く、早めの逃げ（breakaway）に活路を求める。
// 逆にスプリントが武器の選手は集団に残ってゴールスプリントを待つ
function assignAIRoles(members, squadN) {
  const roles = {};
  members.forEach((r, i) => {
    if (i === 0 || squadN < 3) { roles[r.id] = "lead"; return; }
    const roll = Math.random();
    // スプリントがその選手の武器か弱点かを、他能力のピークとの差で測る。
    // sprintGap=0 → スプリントが最強（集団ゴール向き・ほぼ逃げない）
    // sprintGap大 → スプリントが弱点（集団ゴールで不利・早逃げに出やすい）
    const peak = Math.max(r.flat, r.climb, r.sprint, r.stamina, r.solo);
    const sprintGap = peak - r.sprint;
    const breakawayChance = Math.min(0.65, 0.06 + sprintGap * 0.022);
    if (roll < breakawayChance) { roles[r.id] = "breakaway"; return; }
    // 逃げないなら地形・脚質に応じた集団内の役割（ゴールスプリントに残る）
    if (r.type === "CLM") roles[r.id] = "mountain";
    else if (r.type === "SPR" || r.type === "RUL") roles[r.id] = "flat";
    else roles[r.id] = "sub";
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
          const isFinalSeg = segInfo.idx === course.finalIdx;
          if (isFinalSeg) {
            // v28: 最終区間（カメラが切り替わる勝負どころ）は、そこまで生き残った選手同士の
            // ゴール前の掛け合いをスプリント能力で決める。山頂フィニッシュなどスプリント以外で
            // 終わるコースでも、地形適性（ownCapable＝登坂等）で集団に残れるかは従来通り決まり、
            // 残った選手の中ではスプリント力の finishing kick が着差になる。
            // 登坂力が無ければ最終区間の手前（climb区間）で千切れて集団に残れない
            const terrainEdge = ownCapable / groupDist - 1;
            // sprint区間はownCapableが既にスプリントなので二重計上を避け係数を半分に
            const sprintEdge = (segType === "sprint" ? 0.5 : 1) * (en.sprint - 70) / 260;
            const edgeMul = segType === "sprint" ? 1.7 : 0.9;
            // v28: 「豪脚のラストスパート」は最終区間の追い込みが上乗せされる
            const finishKick = hasAbility(en, "finisher") ? (hasGoldAbility(en, "finisher") ? 0.06 : 0.035) : 0;
            // v29: 加速力=飛び出しの鋭さ、メンタル=勝負どころの粘りも最終区間の着差に効く
            const accelKick = ((en.accel ?? 50) - 50) / 900;
            const mentalKick = ((en.mental ?? 50) - 50) / 1500;
            const luck = (riderHash01(en.id, tick + 4409) - 0.5) * 0.035;
            dist = groupDist * Math.max(0.85, Math.min(1.19, 1 + terrainEdge * edgeMul + sprintEdge + finishKick + accelKick + mentalKick + luck));
          } else if (segType === "sprint") {
            // 周回途中などの非最終スプリント区間は従来の弱めの着差
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
        // v15: 横風耐性を持つ選手は横風区間でのドラフト消耗ペナルティが軽減される（1.25→1.1）
        const windPenalty = windActive && en.mode === "draft" ? (hasAbility(en, "crosswind_sp") ? 1.1 : 1.25) : 1;
        // v17: チームケミストリー（squad構築時にchemMulを付与。未設定なら1で無効果）
        const drain = energyDrain(en, en.mode === "solo" ? "solo" : "draft", segType, course.steepness) * windPenalty * shelterMul * (en.chemMul || 1);
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

// v17: チームケミストリー。出走メンバーの平均在籍月数（tenure）が長いほど、
// 集団内でのドラフト効率が上がる（消耗が減る）。長く一緒に走ってきたチームほど
// ローテーションの息が合ってくる、という表現。squadは出走選手のみで判定する
const CHEMISTRY_TIERS = [
  { min: 30, label: "鉄壁の絆", mul: 0.92 },
  { min: 15, label: "円熟したチーム", mul: 0.95 },
  { min: 6,  label: "定着期", mul: 0.98 },
  { min: 0,  label: "新体制", mul: 1 },
];
function teamChemistryTier(squad) {
  const avg = (!squad || squad.length === 0) ? 0 : squad.reduce((s, r) => s + (r.tenure || 0), 0) / squad.length;
  const tier = CHEMISTRY_TIERS.find(t => avg >= t.min);
  return { ...tier, avgTenure: avg };
}
// ---------- buildSim：選手構築＋コース生成＋ティックシミュレーション実行 ----------
// fixedAiTeams を渡すとAI選手を再利用する（GCステージレースの2日目用）
// dayTag を渡すとコース生成のシードに反映される（同じraceMetaでも日ごとに別コースにする）
function buildSim(raceMeta, squad, aceId, roles, equip, itemBoost, classIdx, fixedAiTeams, dayTag, directive, difficultyId, rivalAlumni, dynastyLevel, teamName) {
  // v13: 難易度による他チームの強さ補正（aiMul）。省略時はnormal相当
  const diffAiMul = (DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1]).aiMul;
  // v25: グランファイナル制覇後の周回（ディナスティ）モード。周を重ねるたびに他チームの
  // 地力を底上げし、周回プレイでも歯応えが保たれるようにする
  const dynastyBonus = Math.min(20, (dynastyLevel || 0) * 5);
  const course = generateCourse(raceMeta, dayTag);
  const groupMode = groupModeFor(squad.length);
  const riders = [];
  const chemTier = teamChemistryTier(squad);
  squad.forEach(r => {
    const e = effAbilities(r, equip, itemBoost, raceMeta.grade, raceMeta.weather);
    const role = roles[r.id] || "lead";
    riders.push({
      id: r.id, name: r.name, type: r.type, abilities: r.abilities, age: r.age, chemMul: chemTier.mul, ...e,
      team: "PLAYER", teamName: teamName || "あなたのチーム", color: C.yellow,
      isAce: r.id === aceId, role,
    });
  });
  let aiTeamsUsed;
  if (fixedAiTeams) {
    aiTeamsUsed = fixedAiTeams;
    fixedAiTeams.forEach(list => list.forEach(en => riders.push({ ...en })));
  } else {
    const rng = mulberry(Date.now() % 999983);
    const power = (52 + classIdx * 9 + (raceMeta.grade - 1) * 4 + (raceMeta.championship ? 6 : 0) + dynastyBonus) * diffAiMul;
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
      return members.map((r, i) => {
        // v29: AI相手もプレイヤーと同じeffAbilitiesを通し、体格(パワーウェイト)・調子・大舞台適性・
        // 加速力・メンタルなどの副次補正が相手選手にも効くようにする（天候補正もこの中で処理）
        const e = effAbilities(r, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather);
        return {
          id: r.id, name: r.name, type: r.type, abilities: r.abilities, goldAbilities: r.goldAbilities, age: r.age, ...e,
          team: d.name, teamName: d.name, color: d.color, isAce: i === 0, role: aiRoles[r.id], aiStyle,
          isAlumnus: alumniIds.has(r.id),
        };
      });
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
// v20: ポテンシャル予測レンジ。成長力(growthPow)・成長フェーズ・年齢から
// 伸びしろの粗い目安（大/中/小）を導く。スカウト査定やロスター表示で「今後どこまで
// 伸びるか」の指針として提示する（確定値ではなくあくまで予測）
function potentialHint(r) {
  const phase = growthPhase(r).tag;
  const powScore = { S: 3, A: 2, B: 1, C: 0 }[r.growthPow] ?? 1;
  let score = powScore;
  if (phase === "成長期") score += 2;
  else if (phase === "全盛期") score += 1;
  const [ps] = GROWTH[r.growth].peak;
  if (r.age < ps - 3) score += 1;
  if (score >= 5) return { label: "伸びしろ大", color: "#ffd23f" };
  if (score >= 3) return { label: "伸びしろ中", color: "#35c07e" };
  return { label: "伸びしろ小", color: "#9aa3b5" };
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
// v29: 副ステータス（加速力・体格・メンタル）の小さな表示。コア能力とは別枠のバッジ行
function SubStatLine({ r }) {
  if (r.accel == null && r.build == null && r.mental == null) return null;
  const col = (v) => v >= 75 ? C.yellow : v >= 55 ? C.green : v >= 40 ? C.sub : "#c86";
  const item = (label, v) => (
    <span key={label} style={{ fontSize: 10.5, color: C.sub }}>
      {label}<span style={{ fontFamily: FONT_M, color: col(v), marginLeft: 2, fontWeight: 700 }}>{Math.round(v)}</span>
    </span>
  );
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap", alignItems: "center" }}>
      {item("加速", r.accel ?? 50)}
      <span style={{ fontSize: 10.5, color: C.sub }}>体格<span style={{ fontFamily: FONT_M, color: col(r.build ?? 50), marginLeft: 2, fontWeight: 700 }}>{Math.round(r.build ?? 50)}</span><span style={{ color: C.sub, marginLeft: 2 }}>({buildDesc(r.build ?? 50)})</span></span>
      {item("メンタル", r.mental ?? 50)}
    </div>
  );
}
// v29: 出走表。sim.entrantsをチームごとにまとめて一覧表示する（シーズン・マイライフ共用）
function StartListPanel({ entrants }) {
  const teams = {};
  entrants.forEach(e => { (teams[e.teamName] = teams[e.teamName] || { color: e.color, list: [] }).list.push(e); });
  const rows = Object.entries(teams).sort((a, b) => {
    const ap = a[1].list.some(e => e.team === "PLAYER") ? 0 : 1;
    const bp = b[1].list.some(e => e.team === "PLAYER") ? 0 : 1;
    return ap - bp;
  });
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 11, color: C.sub }}>出走 {entrants.length}名 / {rows.length}チーム（👑=エース）</div>
      {rows.map(([tn, t]) => {
        const isPlayerTeam = t.list.some(e => e.team === "PLAYER");
        return (
          <div key={tn} style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", borderLeft: `3px solid ${t.color}` }}>
            <div style={{ fontFamily: FONT_D, fontWeight: 700, color: isPlayerTeam ? C.yellow : C.text, fontSize: 13 }}>{tn}{isPlayerTeam ? "（自チーム）" : ""}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 3 }}>
              {t.list.map((e, i) => (
                <span key={i} style={{ fontSize: 11.5, color: e.isPlayerChar ? C.yellow : e.isLegend ? C.purple : (e.isRival || e.isRival2) ? C.red : C.text }}>
                  {e.isAce ? "👑 " : ""}{e.isLegend ? "🏛 " : ""}{e.name}<span style={{ color: C.sub, fontSize: 10, marginLeft: 2 }}>{TYPES[e.type].label}</span>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
// v15: 1選手が複数の特殊能力を保有できるようになったため、バッジ付きの行を複数表示する。
// v15フェーズ2: 金特化した能力は★付きの金色バッジで区別する
function TraitLine({ abilities, goldAbilities }) {
  if (!abilities || abilities.length === 0) return null;
  return (
    <div style={{ marginTop: 2 }}>
      {abilities.map(id => {
        const t = ABILITIES[id];
        if (!t) return null;
        const isGold = !!(goldAbilities && goldAbilities.includes(id));
        const col = isGold ? C.yellow : t.bad ? C.red : "#e8a13c";
        return (
          <div key={id} style={{ fontSize: 10.5, color: C.sub, marginTop: 1 }}>
            <span style={{ color: col, border: `1px solid ${col}`, borderRadius: 4, padding: "0px 5px", marginRight: 5, fontWeight: isGold ? 700 : 400 }}>
              {isGold ? "★" : ""}{t.label}
            </span>
            {t.desc}{isGold ? "（金特・効果2倍）" : ""}
          </div>
        );
      })}
    </div>
  );
}
// v16フェーズ3: 特殊能力ファイル（図鑑）。まだ発見していない能力は「???」で伏せて表示し、
// 自チーム/マイライフで実際にその能力を持つ選手を保有すると解禁される
const ABILITY_CATEGORY_ORDER = ["地形適性", "展開・役割", "メンタル", "フィジカル", "成長"];
// v28: 通算タイトル一覧。プレイをまたいで獲得した主要タイトルの回数を表示する
function TitlesPanel() {
  const t = loadTitles();
  const total = totalTitleCount();
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.7 }}>これまでの全プレイ・両モードで自分（自チーム）が獲得した主要タイトルの通算数です。</div>
      <div style={{ background: C.panel, borderRadius: 12, padding: "12px 14px", textAlign: "center", border: `1px solid ${total > 0 ? "#e8a13c" : C.line}` }}>
        <div style={{ fontSize: 11, color: C.sub }}>通算タイトル</div>
        <div style={{ fontFamily: FONT_M, fontSize: 28, color: "#e8a13c", fontWeight: 700 }}>{total}</div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {TITLE_DEFS.map(d => (
          <div key={d.key} style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: C.text }}>{d.icon} {d.label}</span>
            <span style={{ fontFamily: FONT_M, fontSize: 15, color: (t[d.key] || 0) > 0 ? C.yellow : C.sub }}>{t[d.key] || 0}<span style={{ fontSize: 10, color: C.sub }}> 回</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
// v27: コンディション予報の小さな表示。来月の調子変動の向きを控えめに添える
function CondFc({ dir }) {
  if (dir == null) return null;
  const i = dir + 1;
  return <span style={{ fontSize: 10, color: COND_FC_COLOR[i], marginLeft: 4 }} title={`来月の調子予報：${COND_FC_LABEL[i]}`}>予報{COND_FC_ARROW[i]}</span>;
}
// v27: コースレコード一覧。コース種別ごとの最速レコード指数と達成者を表示する。
// シーズン・マイライフ両モードで共有する
function CourseRecordsPanel() {
  const recs = loadCourseRecords();
  const kinds = [...TEMPLATES, ...UNLOCK_TEMPLATES].map(t => t.kind);
  const anyRec = kinds.some(k => recs[k]);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.7 }}>
        コース種別ごとの最速記録（レコード指数＝コース距離÷勝者タイム×100。数値が大きいほど速い）。全プレイ・両モードで共有され、更新されるたびに達成者が刻まれます。
      </div>
      {!anyRec && <div style={{ fontSize: 12.5, color: C.sub }}>まだ記録はありません。レースを走ると刻まれていきます。</div>}
      {kinds.map(k => {
        const r = recs[k];
        return (
          <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${r && r.isPlayer ? C.yellow : C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
            <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13 }}>{k}</span>
            {r ? (
              <span style={{ fontSize: 11.5, color: C.sub }}>
                指数<span style={{ color: C.yellow, fontFamily: FONT_M, marginLeft: 3 }}>{r.speed}</span>
                <span style={{ marginLeft: 8, color: r.isPlayer ? C.yellow : C.text }}>{r.holder}{r.isPlayer ? " ★" : ""}</span>
                <span style={{ marginLeft: 6, color: C.sub }}>({r.year}年目)</span>
              </span>
            ) : <span style={{ fontSize: 11.5, color: C.sub }}>記録なし</span>}
          </div>
        );
      })}
    </div>
  );
}
function AbilityFileList({ file }) {
  const normalSet = new Set(file.normal);
  const goldSet = new Set(file.gold);
  const allIds = Object.keys(ABILITIES);
  const discoveredCount = allIds.filter(id => normalSet.has(id)).length;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 14, borderTop: `4px solid ${C.purple}` }}>
        <div style={{ fontFamily: FONT_D, fontSize: 18, color: C.text }}>{discoveredCount} / {allIds.length} 発見済み</div>
        <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>該当する特殊能力を持つ選手を保有すると解禁されます（シーズンモード・マイライフ通算）。</div>
      </div>
      {ABILITY_CATEGORY_ORDER.map(cat => {
        const ids = allIds.filter(id => ABILITIES[id].category === cat);
        if (ids.length === 0) return null;
        return (
          <div key={cat}>
            <Eyebrow color={C.purple}>{cat}</Eyebrow>
            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
              {ids.map(id => {
                const t = ABILITIES[id];
                const found = normalSet.has(id);
                const gold = goldSet.has(id);
                const goldable = !!GOLD_CONDITIONS[id];
                const col = t.bad ? C.red : "#e8a13c";
                return (
                  <div key={id} style={{
                    background: found ? C.panel : C.panel2, borderRadius: 10, padding: "9px 12px",
                    border: `1px solid ${found ? col : C.line}`, opacity: found ? 1 : 0.6,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 16 }}>{found ? (t.bad ? "⚠️" : "✦") : "🔒"}</span>
                      <span style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 13.5, color: found ? col : C.sub }}>
                        {found ? t.label : "???"}
                      </span>
                      {goldable && found && (
                        <span style={{
                          fontSize: 9.5, color: gold ? C.yellow : C.sub, border: `1px solid ${gold ? C.yellow : C.line}`,
                          borderRadius: 4, padding: "0 4px",
                        }}>{gold ? "★ 金特入手済" : "金特あり"}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>
                      {found ? t.desc : "まだ発見されていない特殊能力です。"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
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
              {c.isPlayer && <circle r={c.isAce ? 10.5 : 8.5} fill="none" stroke="#27d3ff" strokeWidth="2" />}
              <circle r={c.isAce ? 8 : 6} fill={c.color} stroke="#14171d" strokeWidth="1.5" />
              {c.isPlayer && <circle r="2.2" fill="#14171d" />}
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: fadeOpacity, borderRadius: 8, pointerEvents: "none" }} />
      <div style={{ fontSize: 10.5, color: C.sub, textAlign: "center", marginTop: 4 }}>{contenders.length > 1 ? "🏁 ゴールスプリント" : "🏁 単独ゴール"}</div>
    </div>
  );
}
// v29バグ修正: レース演出（RaceView）の描画中に万一の例外が起きても、
// 「画面が真っ暗になって進行不能」という致命的な詰みを絶対に発生させないためのエラー境界。
// レース結果（着順・タイム）はRaceViewの描画とは無関係に、シミュレーション段階
// （simulateTicks + rankSim）で既に確定済みなので、演出がこけても結果へは必ず進める。
// 例外時は自動で結果画面へ送る（フォールバックのボタンも用意し、二重に詰み防止）。
class RaceErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { crashed: false }; }
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(err) {
    // 自動復帰：次のティックで結果画面へ進める（描画中のsetState連鎖を避けて遅延実行）
    if (this.props.onRecover) setTimeout(() => { try { this.props.onRecover(); } catch (e) {} }, 400);
  }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ display: "grid", gap: 12, padding: 16, background: C.panel, borderRadius: 12, border: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: FONT_D, fontSize: 15, color: C.yellow, fontWeight: 700 }}>🏁 レースは終了しました</div>
          <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6 }}>
            レース中継の描画で問題が発生しましたが、着順・記録はすでに確定しています。
            そのまま結果画面へお進みください（進行への影響はありません）。
          </div>
          <Btn onClick={this.props.onRecover}>結果を見る →</Btn>
        </div>
      );
    }
    return this.props.children;
  }
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
  const cameraFramingRef = useRef(null); // v14.13: 直近のカメラ枠決めで実際に映していた選手集団（シネマティックの対象選手選定に再利用）
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
      if (s.wind) {
        baseEvents.push({ t: fracStart, text: `🌬 ${s.label}：横風区間！エシュロンで集団が分断されるか` });
        return;
      }
      // v27: 区間タイプごとの実況パターンから決定的に1つ選ぶ（区間indexで循環）
      const pool = SEG_COMMENTARY[s.type];
      const line = pool ? pool[j % pool.length] : `${s.label}へ突入！`;
      baseEvents.push({ t: fracStart, text: `🎙 ${line}` });
    });
    baseEvents.push({ t: 0.985, text: FINISH_COMMENTARY[Math.floor(strHash(sim.raceMeta.name || "x") % FINISH_COMMENTARY.length)] });
    // v27: 実況の動的イベント検知用の状態（逃げとメインのギャップ変化を追う）
    let prevGapSec = null, lastDynCommentAt = 0;

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
      // v14.13: このブロックで決めた「今カメラが映している集団」をcameraFramingRefに
      // 保存し、後段のシネマティック演出（下のfinalSegRef.current && !cinematicRef.current）
      // が同じ集団を参照できるようにする。以前はシネマティック側が全選手からタイム差だけで
      // 独自に対象選手を選び直していたため、俯瞰マップで追っていた選手（先頭集団や
      // フィーチャー中の選手の集団）と、切り替わった演出に映る選手が食い違うことがあった
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
        cameraFramingRef.current = framing;
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
          // v14.13: 対象選手は全選手からタイム差で選び直すのではなく、直前まで俯瞰マップの
          // カメラが実際に映していた集団（cameraFramingRef）に限定する。これにより、
          // 先頭集団を追っていればその先頭集団のまま、選手フィーチャー中ならその選手の
          // 集団のまま、演出に切り替わっても顔ぶれが変わらなくなる
          const pool = (cameraFramingRef.current && cameraFramingRef.current.length > 0) ? cameraFramingRef.current : riders;
          const sortedByFinish = [...pool].sort((a, b) => a.e.finishTime - b.e.finishTime);
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
        // ライブギャップ表示（逃げ集団 vs 追走）：先頭グループと2番手グループの位置差を秒換算
        let gapText = null;
        const gidSet = [...new Set(sorted.map(r => r.gid))];
        let curGapSec = null;
        if (sim.groupMode !== "solo" && gidSet.length > 1) {
          const leadG = sorted[0].gid;
          const chaseR = sorted.find(r => r.gid !== leadG);
          if (chaseR) {
            curGapSec = Math.max(0, Math.round((sorted[0].frac - chaseR.frac) * totalRef.current));
            gapText = `逃げとメインのギャップ：約${curGapSec}秒`;
          }
        }
        // v27: 実況の動的イベント。逃げとメインのギャップが大きく動いた瞬間に実況を差し込む
        // （最終区間はラストスパート演出が優先されるため対象外。過度な連発を避けて4秒間隔で抑制）
        if (!finalSegRef.current && curGapSec != null && prevGapSec != null && now - lastDynCommentAt > 4000) {
          const d = curGapSec - prevGapSec;
          if (curGapSec < 1.5 && prevGapSec >= 3) {
            liveRef.current = { text: "📻 逃げ吸収！集団は再び一つにまとまった", until: now + 2600 }; lastDynCommentAt = now;
          } else if (d >= 4) {
            liveRef.current = { text: "📻 逃げがリードを広げる！メイン集団は反応できるか", until: now + 2600 }; lastDynCommentAt = now;
          } else if (d <= -4 && curGapSec > 2) {
            liveRef.current = { text: "📻 メイン集団がペースを上げ、逃げを引き戻しにかかる", until: now + 2600 }; lastDynCommentAt = now;
          }
        }
        if (curGapSec != null) prevGapSec = curGapSec;
        let comment = "";
        if (liveRef.current.until > now) comment = liveRef.current.text;
        else {
          const ev = [...baseEvents].reverse().find(e => e.t <= leadFrac + 1e-4);
          comment = ev ? ev.text : "";
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
                    {/* v29バグ修正: 自分がエースでない（白マーカー）ときにアシスト仲間と見分けが
                        つかないという指摘に対応。自分の印には常に水色の識別リングを重ね、
                        エースかどうかに関わらず一目で自分だとわかるようにする */}
                    {r.isPlayer && <circle r={r.isAce ? 8 : 6.5} fill="none" stroke="#27d3ff" strokeWidth="1.8" />}
                    <circle r={r.isAce ? 5.5 : 4} fill={r.color} stroke={r.mode === "pull" ? "#fff" : "#14171d"} strokeWidth={r.mode === "pull" ? 2 : 0.75} />
                    {r.isPlayer && <circle r="1.7" fill="#14171d" />}
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
                    {r.isPlayer && <circle r={r.isAce ? 7 : 5.5} fill="none" stroke="#27d3ff" strokeWidth="1.6" />}
                    <circle r={r.isAce ? 5 : 3.5} fill={r.color} stroke={r.mode === "pull" ? "#fff" : "#14171d"} strokeWidth={r.mode === "pull" ? 1.8 : 0.6} />
                    {r.isPlayer && <circle r="1.5" fill="#14171d" />}
                  </g>
                );
              })}
            </svg>
          </div>
          <div style={{ fontSize: 10, color: C.sub, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>● 黄色＝エース</span><span>○ 白＝自チームのアシスト</span><span style={{ color: "#27d3ff" }}>◎ 水色リング＝あなた</span><span>白縁＝牽引中</span><span style={{ color: C.red }}>◎ 赤丸＝アタック中</span>
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
    // v28: 自チーム名（プレイヤーが命名できる。未設定なら既定名）
    teamName: "あなたのチーム",
    year: 1, month: 0, classIdx: 0, points: 0, budget: 300,
    roster,
    equip: { frame: 0, wheels: 0, facility: 0 },
    staff: { manager: 0, trainer: 0, doctor: 0, scout: 0 },
    inv: { wheel: 0, suit: 0, supp: 0, tune: 0, camp: 0 },
    partsInv: {},
    camp: false,
    sponsor: null,
    sponsorOffers: genSponsors(0, 1),
    scoutPolicy: "balance",
    // v12バグ修正: 初回のスカウト候補・FA候補が固定シードで毎回同じ顔ぶれになっていたため、
    // 新規ゲームのたびに変わるようDate.now()由来のシードに変更。
    // 自チームの初期ロースターの名前とも被らないよう渡す
    scouts: genScouts(0, Date.now() % 999983, "balance", rosterNames),
    faMarket: genFaPool(0, (Date.now() + 12345) % 999983, rosterNames),
    tradeOffers: genTradeOffers(0, (Date.now() + 54321) % 999983, roster),
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
    // v28: 会場ごとの相性・ホームアドバンテージ。自チームの本拠地。地元開催のレースで
    // 出走選手に小さな能力ボーナスがつく
    homeRegion: REGIONS[Math.floor(Math.random() * REGIONS.length)],
    // v17: キャプテン制度。指名した選手のidを保持する（未指名ならnull）
    captainId: null,
    // v18: グランツール副次クラシフィケーション（ポイント賞・山岳賞・新人賞）の
    // 自チーム通算獲得回数。実績判定に使う
    jerseyWinCounts: { points: 0, mountains: 0, youth: 0 },
    // v18: 実績を初めて達成した時に一度だけ報酬を付与するため、既に報酬を受け取った実績idを記録する
    rewardedAchievements: [],
    // v25: グランファイナル制覇後も同じチームで続けられる周回モード（ディナスティ）。
    // 周回のたびに他チームの地力を底上げし、再挑戦のたびに歯応えを保つ
    dynastyLevel: 0,
    // v25: ユース育成枠（年1回だけ安価に確保できる原石）。使用済みかどうかを保持し、
    // 年度末に毎年リセットする
    youthUsed: false,
    // v27: 引退選手のスタッフ登用（OBコーチ）。殿堂入りOBを月給制で1名まで雇える
    obCoach: null,
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
  "camp", "sponsor", "sponsorOffers", "scoutPolicy", "scouts", "faMarket", "races",
  "champBest", "log", "cleared", "careerStats", "careerHistory", "difficulty", "hallOfFame", "rivalAlumni",
  "gtWins", "captainId", "tradeOffers", "jerseyWinCounts", "rewardedAchievements", "dynastyLevel", "youthUsed", "obCoach", "homeRegion", "teamName",
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

// ---------- v30: 世界ランキング＆キャリア・アンビション ----------
// マイライフの中盤以降「やることがない／目標がなくなる」という課題への打開策。
// (1) 世界ランキング：レース成績で持ち点を稼ぎ、キャリアを通じて順位を上げていく。
//     年ごとに一部が減衰し（＝直近の成績ほど重視／休むと落ちる）、世界1位の基準点は
//     年々上がる（新世代の台頭）ため、上位維持には走り続ける必要があり練習が形骸化しない。
// (2) アンビション：段階的に提示される長期目標。達成すると報酬（資金・人気・能力・成長力）を
//     得て次の目標へ進む。常に「次に目指すもの」がある状態を作る。
function worldPointsForFinish(rank, grade) {
  const gradePts = { 1: 16, 2: 34, 3: 66, 4: 130 }[grade] || 16;
  const place = rank === 1 ? 1 : rank === 2 ? 0.7 : rank === 3 ? 0.55
    : rank <= 5 ? 0.4 : rank <= 10 ? 0.25 : rank <= 20 ? 0.12 : 0.05;
  return Math.round(gradePts * place);
}
// v33.9: 生きた世界。ペロトンの主役たちはキャリア固有シードから決定論的に生成され、
// 毎年 加齢→成長/衰え→引退→世代交代（時に名選手の血を継ぐ2世が台頭）していく。
// 状態はシード1つだけ保存し、任意の年の顔ぶれは年1から再シミュして求める（純関数）。
const WORLD_STAR_COUNT = 24;
const WORLD_STAR_TYPES = ["SPR", "CLM", "RUL", "PUN", "TT"];
function mlMakeWorldStar(rng, year, opts) {
  opts = opts || {};
  return {
    id: opts.id || ("ws" + Math.floor(rng() * 1e9)),
    name: opts.name || pickRiderName(rng, null),
    type: opts.type || WORLD_STAR_TYPES[Math.floor(rng() * WORLD_STAR_TYPES.length)],
    age: opts.age != null ? opts.age : 20 + Math.floor(rng() * 8),
    rating: opts.rating != null ? opts.rating : 74 + Math.floor(rng() * 20),
    wins: opts.wins || 0,
    peakAge: opts.peakAge != null ? opts.peakAge : 27 + Math.floor(rng() * 4),
    growth: opts.growth || (rng() < 0.25 ? "S" : rng() < 0.6 ? "A" : "B"),
    debutYear: opts.debutYear != null ? opts.debutYear : year,
    lineage: opts.lineage || null,
    bloodOf: opts.bloodOf || null, // v33.10: あなたの殿堂・血統から世界へ流入した選手
  };
}
function mlWorldStarsForYear(seed, targetYear, legendPool) {
  const s0 = ((seed || 777) >>> 0);
  const initRng = mulberry(s0);
  // v33.10: あなたの殿堂の名選手・確立した系統の血が、次世代として世界のペロトンに流入する
  const legs = (legendPool || []).slice().sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 8);
  let stars = [];
  for (let i = 0; i < WORLD_STAR_COUNT; i++) {
    if (i < legs.length && initRng() < 0.85) {
      const leg = legs[i];
      const surname = (leg.name || "名家 選手").split(" ")[0];
      stars.push(mlMakeWorldStar(initRng, 1, {
        name: surname + " " + GIVEN_ALL[Math.floor(initRng() * GIVEN_ALL.length)],
        type: leg.type,
        age: 21 + Math.floor(initRng() * 10),
        rating: Math.max(72, Math.min(97, Math.round((leg.overall || 80) - 4 + initRng() * 8))),
        wins: Math.floor(initRng() * 10),
        bloodOf: leg.lineageName || (surname + "系"),
      }));
    } else {
      stars.push(mlMakeWorldStar(initRng, 1, { age: 21 + Math.floor(initRng() * 12), rating: 74 + Math.floor(initRng() * 21), wins: Math.floor(initRng() * 14) }));
    }
  }
  const ty = Math.max(1, targetYear || 1);
  for (let y = 2; y <= ty; y++) {
    const yr = mulberry((s0 + y * 2654435761) >>> 0);
    // 加齢と成長/衰え
    stars = stars.map(st => {
      const ns = { ...st };
      ns.age += 1;
      if (ns.age <= ns.peakAge) ns.rating = Math.min(99, ns.rating + (ns.growth === "S" ? 3 : ns.growth === "A" ? 2 : 1));
      else ns.rating = Math.max(38, ns.rating - (1 + Math.floor((ns.age - ns.peakAge) / 2)));
      return ns;
    });
    // ランキング上位ほど勝ち星を積む
    const ranked = [...stars].sort((a, b) => b.rating - a.rating);
    ranked.forEach((st, idx) => { if (idx === 0) st.wins += 3; else if (idx < 3) st.wins += 2; else if (idx < 10) st.wins += 1; });
    // 引退＆世代交代（4割で名選手の血を継ぐ2世が登場）
    stars = stars.map(st => {
      const retire = st.age >= 35 || (st.age >= 32 && st.rating < 62) || st.rating < 44;
      if (!retire) return st;
      const inherit = yr() < 0.4 || !!st.bloodOf; // 殿堂の血を引くスターは必ず後継を残す
      const surname = (st.name || "無名 選手").split(" ")[0];
      const childName = inherit ? (surname + " " + GIVEN_ALL[Math.floor(yr() * GIVEN_ALL.length)]) : pickRiderName(yr, null);
      return mlMakeWorldStar(yr, y, { name: childName, type: inherit ? st.type : undefined, age: 19 + Math.floor(yr() * 3), rating: 70 + Math.floor(yr() * 16), lineage: inherit ? st.name : null, bloodOf: inherit ? st.bloodOf : null });
    });
  }
  return stars.sort((a, b) => b.rating - a.rating);
}
// 前年との比較で「今年の世界の動き」を抽出（新王者・引退・新星の台頭）
function mlWorldNews(seed, year, legendPool) {
  if (!year || year < 2) return [];
  const prev = mlWorldStarsForYear(seed, year - 1, legendPool);
  const cur = mlWorldStarsForYear(seed, year, legendPool);
  const news = [];
  if (cur[0] && (!prev[0] || prev[0].id !== cur[0].id)) news.push(`👑 ${cur[0].name}（${cur[0].age}歳・${TYPES[cur[0].type]?.label || cur[0].type}）が世界ランキング首位に立った${cur[0].bloodOf ? `。${cur[0].bloodOf}の血が世界の頂点へ` : ""}`);
  const curIds = new Set(cur.map(s => s.id));
  const retired = prev.filter(s => !curIds.has(s.id)).sort((a, b) => b.wins - a.wins);
  if (retired[0]) news.push(`🏁 ${retired[0].name}が現役を退いた（通算${retired[0].wins}勝）`);
  const risers = cur.filter(s => s.debutYear === year);
  const topRiser = risers.sort((a, b) => b.rating - a.rating)[0];
  if (topRiser) news.push(`🌟 新星 ${topRiser.name}（${topRiser.age}歳）が台頭${topRiser.lineage ? `。${topRiser.lineage}の血を継ぐ逸材だ` : ""}`);
  return news;
}
function computeWorldRank(points, year) {
  if (!points || points <= 1) return 300;
  const P1 = 360 + (year - 1) * 52; // 世界1位相当の持ち点（年々上昇）
  if (points >= P1) return 1;
  const rank = Math.ceil(Math.pow(P1 / points, 1 / 0.72));
  return Math.max(1, Math.min(300, rank));
}
function worldRankTier(rank) {
  if (rank == null) return { label: "ランク外", color: "#9aa3b5" };
  if (rank === 1) return { label: "世界王者", color: "#ffd23f" };
  if (rank <= 3) return { label: "世界トップ3", color: "#ffd23f" };
  if (rank <= 10) return { label: "世界トップ10", color: "#35c07e" };
  if (rank <= 30) return { label: "世界の常連", color: "#35c07e" };
  if (rank <= 80) return { label: "世界で戦う男", color: "#4f8fe8" };
  if (rank <= 200) return { label: "世界の登竜門", color: "#9aa3b5" };
  return { label: "無名の挑戦者", color: "#9aa3b5" };
}
// v31.5: 世界ランキングの閲覧用ボード。年数に応じた基準曲線から各順位の持ち点を逆算し、
// 名前は決定論的に生成（同じ年・順位なら同じ名前）。上位10＋自分の周辺＋ライバルを返す。
function mlWorldBoard(ml) {
  const year = ml.year || 1;
  const P1 = 360 + (year - 1) * 52;
  const myRank = ml.worldRank;
  const myPts = Math.round(ml.worldPoints || 0);
  const ptsAt = (rank) => Math.round(P1 * Math.pow(rank, -0.72));
  // v33.9: 生きた世界。各順位は永続的な世界のスター（加齢・世代交代する）で埋める
  // v33.10: あなたの殿堂の血も流入させる
  const stars = mlWorldStarsForYear(ml.worldSeed, year, (typeof loadMlLegends === "function" ? loadMlLegends() : []));
  const starAt = (rank) => stars[rank - 1] || null;
  const nameAt = (rank) => { const st = starAt(rank); return st ? st.name : pickRiderName(mulberry(year * 100003 + rank * 131 + 7), null); };
  const rivalRankOf = (rv, seedOff) => {
    if (!rv) return null;
    let rank = 2 + Math.floor(mulberry(strHash((rv.name || "") + seedOff))() * 45);
    if (myRank != null && rank === myRank) rank += 1;
    return rank;
  };
  const rivalRank = rivalRankOf(ml.rival, 11);
  const rival2Rank = (ml.rival2 && (ml.rivalRecord2?.meetings || 0) > 0) ? rivalRankOf(ml.rival2, 29) : null;
  const labelFor = (rank) => {
    if (myRank != null && rank === myRank) return { name: (ml.player && ml.player.name) || "あなた", isPlayer: true };
    if (rivalRank === rank && ml.rival) return { name: ml.rival.name, isRival: true };
    if (rival2Rank === rank && ml.rival2) return { name: ml.rival2.name, isRival2: true };
    const st = starAt(rank);
    return st ? { name: st.name, star: { age: st.age, wins: st.wins, type: st.type, lineage: st.lineage, bloodOf: st.bloodOf } } : { name: nameAt(rank) };
  };
  const entry = (rank) => ({ rank, pts: (myRank != null && rank === myRank) ? myPts : ptsAt(rank), ...labelFor(rank) });
  const top = [];
  for (let r = 1; r <= 10; r++) top.push(entry(r));
  const around = [];
  if (myRank != null && myRank > 12) { for (let r = myRank - 2; r <= myRank + 2; r++) { if (r >= 1) around.push(entry(r)); } }
  return { top, around, myRank, myPts, rivalRank, rival2Rank };
}
// v31.5: アンビションを「生き方（路線）」ごとに分岐させ、道中から個性が出るようにした。
// 勝利の道・大舞台の道・献身の道・世界の道の4路線を用意し、路線ごとに目標のはしごが異なる。
const ML_AMBITION_PATHS = {
  victory: {
    label: "勝利の道", icon: "🏆", color: "#ffd23f",
    desc: "とにかく勝つ。勝ち星を積み上げて絶対的エースを目指す生き方。",
    rungs: [
      { key: "v_first", label: "プロ初勝利を挙げる",           metric: "careerWins", target: 1,  reward: { money: 60,  pop: 3 } },
      { key: "v5",      label: "通算5勝",                     metric: "careerWins", target: 5,  reward: { money: 120, pop: 4 } },
      { key: "v10",     label: "通算10勝",                    metric: "careerWins", target: 10, reward: { money: 220, ab: 2 } },
      { key: "v20",     label: "通算20勝",                    metric: "careerWins", target: 20, reward: { money: 420, ab: 3 } },
      { key: "v30",     label: "通算30勝（生けるレジェンド）",  metric: "careerWins", target: 30, reward: { money: 700, ab: 4, growth: 1 } },
    ],
  },
  bigstage: {
    label: "大舞台の道", icon: "🎌", color: "#e8a13c",
    desc: "格上のレースと世界の大舞台で栄光をつかむ、勝負師の生き方。",
    rungs: [
      { key: "b_pod",    label: "初表彰台",                    metric: "careerPodiums", target: 1, reward: { money: 60,  pop: 3 } },
      { key: "b_big",    label: "グレード3以上のレースで勝利",   metric: "careerBigWins", target: 1, reward: { money: 220, pop: 8 } },
      { key: "b_big3",   label: "グレード3以上を通算3勝",       metric: "careerBigWins", target: 3, reward: { money: 380, ab: 2 } },
      { key: "b_title",  label: "世界選手権か五輪で優勝",        metric: "careerTitles",  target: 1, reward: { money: 600, pop: 15, ab: 2 } },
      { key: "b_title3", label: "大舞台で通算3勝（伝説の英雄）",  metric: "careerTitles",  target: 3, reward: { money: 900, pop: 25, ab: 3, growth: 1 } },
    ],
  },
  devotion: {
    label: "献身の道", icon: "🤝", color: "#4f8fe8",
    desc: "自分の勝利より仲間とチームのために走る、名脇役の生き方。",
    rungs: [
      { key: "d10",     label: "アシスト役で10戦走る",         metric: "supportRaces", target: 10, reward: { money: 80,  pop: 3 } },
      { key: "d_pod",   label: "それでも通算表彰台10回",        metric: "careerPodiums", target: 10, reward: { money: 160, ab: 1 } },
      { key: "d30",     label: "アシスト役で通算30戦",         metric: "supportRaces", target: 30, reward: { money: 280, ab: 2 } },
      { key: "d60",     label: "アシスト役で通算60戦",         metric: "supportRaces", target: 60, reward: { money: 450, ab: 2, growth: 1 } },
      { key: "d_pod20", label: "献身を貫き通算表彰台20回",      metric: "careerPodiums", target: 20, reward: { money: 600, ab: 3 } },
    ],
  },
  world: {
    label: "世界の道", icon: "🌍", color: "#35c07e",
    desc: "世界ランキングを駆け上がり、世界の頂点を極める生き方。",
    rungs: [
      { key: "w50", label: "世界ランク TOP50入り", metric: "rankAtMost", target: 50, reward: { money: 150, pop: 6 } },
      { key: "w20", label: "世界ランク TOP20入り", metric: "rankAtMost", target: 20, reward: { money: 260, pop: 8 } },
      { key: "w10", label: "世界ランク TOP10入り", metric: "rankAtMost", target: 10, reward: { money: 380, ab: 2, growth: 1 } },
      { key: "w3",  label: "世界ランク TOP3入り",  metric: "rankAtMost", target: 3,  reward: { money: 550, ab: 3 } },
      { key: "w1",  label: "世界ランク1位に立つ",   metric: "rankAtMost", target: 1,  reward: { money: 900, pop: 25, ab: 3, growth: 1 } },
    ],
  },
};
const ML_AMBITION_PATH_KEYS = ["victory", "bigstage", "devotion", "world"];
function mlAmbitionPath(ml) { return ML_AMBITION_PATHS[ml.ambitionPath] || ML_AMBITION_PATHS.victory; }
function mlAmbitionMetricValue(ml, metric) {
  if (metric === "careerWins") return ml.careerWins || 0;
  if (metric === "careerPodiums") return ml.careerPodiums || 0;
  if (metric === "careerBigWins") return ml.careerBigWins || 0;
  if (metric === "careerTitles") return ml.careerTitles || 0;
  if (metric === "rankAtMost") return ml.worldRank == null ? 999 : ml.worldRank;
  if (metric === "supportRaces") return ((ml.player && ml.player.raceLog) || []).filter(e => ["support", "sub", "experience", "domestique"].includes(e.role)).length;
  return 0;
}
function mlCurrentAmbition(ml) {
  const rungs = mlAmbitionPath(ml).rungs;
  const idx = ml.ambitionIdx || 0;
  return idx < rungs.length ? rungs[idx] : null;
}
// 指定路線で、現在の到達状況からまだ達成していない最初の段（路線切替時のindex決定に使う）
function mlFirstUnmetRung(ml, pathKey) {
  const rungs = (ML_AMBITION_PATHS[pathKey] || ML_AMBITION_PATHS.victory).rungs;
  for (let i = 0; i < rungs.length; i++) { if (!mlAmbitionCleared(ml, rungs[i])) return i; }
  return rungs.length;
}
function mlAmbitionCleared(ml, amb) {
  if (!amb) return false;
  const v = mlAmbitionMetricValue(ml, amb.metric);
  return amb.metric === "rankAtMost" ? v <= amb.target : v >= amb.target;
}
function mlAmbitionProgressText(ml, amb) {
  if (!amb) return "";
  if (amb.metric === "rankAtMost") return `現在 世界${ml.worldRank == null ? "—" : ml.worldRank}位 ／ 目標 ${amb.target}位以内`;
  return `${mlAmbitionMetricValue(ml, amb.metric)} / ${amb.target}`;
}
const GROWTH_POW_LADDER = ["C", "B", "A", "S"];
function bumpGrowthPow(pow, steps = 1) {
  let i = GROWTH_POW_LADDER.indexOf(pow);
  if (i < 0) return pow;
  return GROWTH_POW_LADDER[Math.min(GROWTH_POW_LADDER.length - 1, i + steps)];
}
// アンビション達成の報酬を適用し、達成テキストを返す（player/money を破壊的に受け取り更新して返す）
function applyAmbitionReward(reward, player, money) {
  const parts = [];
  let newMoney = money;
  if (reward.money) { newMoney += reward.money; parts.push(`資金+${reward.money}万円`); }
  if (reward.pop) { player.popularity = Math.max(0, Math.min(100, (player.popularity || 0) + reward.pop)); parts.push(`人気+${reward.pop}`); }
  if (reward.ab) { AB_KEYS.forEach(k => addAb(player, k, reward.ab, 130)); parts.push(`全能力+${reward.ab}`); }
  if (reward.growth) { player.growthPow = bumpGrowthPow(player.growthPow, reward.growth); parts.push(`成長力→${player.growthPow}`); }
  return { money: newMoney, text: parts.join("・") };
}
// v31.4: キャリアの生き様（アーキタイプ／称号）。「最終的にみんな伝説の勝ち師になり没個性化する」
// という指摘に対応。勝利数だけでなく、役割（エース/アシスト）・脚質・大舞台タイトル・世界ランク・
// 表彰台率・在籍年数・成長タイプから、その選手が「どんな伝説だったか」を1つに定めて称える。
function mlCareerArchetype(s) {
  const r = s.player || {};
  const log = r.raceLog || [];
  const races = log.length;
  const wins = (s.careerWins != null) ? s.careerWins : log.filter(e => e.rank === 1).length;
  const podiums = (s.careerPodiums != null) ? s.careerPodiums : log.filter(e => e.rank <= 3).length;
  const titles = s.careerTitles || 0;
  const worldBest = s.worldRankBest;
  const years = s.year || 1;
  const age = r.age || 30;
  const aceR = log.filter(e => ["ace", "lead"].includes(e.role)).length;
  const supR = log.filter(e => ["support", "sub", "experience", "domestique"].includes(e.role)).length;
  const type = r.type;
  const SPEC = {
    SPR: { t: "豪脚のスプリント王", d: "ゴール前の爆発力で数々の集団スプリントを制した、生粋のフィニッシャー。" },
    CLM: { t: "山岳の魔術師", d: "峠という峠で栄光を掴んだ、天性のクライマー。" },
    RUL: { t: "平坦の絶対王者", d: "風を切り裂くパワーで平坦路を支配した、鉄壁のルーラー。" },
    PUN: { t: "丘陵の変幻自在", d: "起伏あるコースを知性と脚で攻略し続けた、したたかなパンチャー。" },
    TT:  { t: "孤高のタイムトライアリスト", d: "時計と戦い、独走で幾多の勝利を刻んだ孤高の求道者。" },
  };
  if (worldBest === 1) return { key: "world1", title: "世界の頂に立った者", desc: "世界ランキングの頂点を極め、一時代を築いた絶対王者。", color: C.yellow };
  if (titles >= 2) return { key: "heroMulti", title: "大舞台の英雄", desc: "世界選手権・五輪の大舞台で幾度も頂点に立った、記憶に刻まれる英雄。", color: C.yellow };
  if (titles >= 1) return { key: "hero", title: "大一番の勝負師", desc: "ここぞの大舞台で栄冠をつかんだ、勝負強さの人。", color: "#e8a13c" };
  if (wins >= 25) return { key: "emperor", title: "常勝の帝王", desc: "数えきれない勝利を積み上げた、記録に残る絶対的エース。", color: C.yellow };
  if (wins >= 8) { const sp = SPEC[type] || { t: "勝利の職人", d: "堅実に勝ちを積み上げた実力者。" }; return { key: "specialist_" + type, title: sp.t, desc: sp.d, color: C.green }; }
  if (supR >= 12 && supR >= aceR * 1.5 && wins <= 4) return { key: "domestique", title: "不屈のアシスト職人", desc: "自らの勝利より仲間の勝利を優先し、チームを陰で支え続けた名脇役。", color: C.blue };
  if (podiums >= 12 && wins <= 3) return { key: "nearly", title: "悲運の名脇役", desc: "幾度も表彰台に立ちながら、最高の一段には手が届かなかった、愛されるべき選手。", color: C.purple };
  if (years >= 12 || age >= 36) return { key: "ironman", title: "鉄人", desc: "長きにわたり第一線で走り続けた、稀有なる持久力の持ち主。", color: "#6fa8dc" };
  if ((r.growth === "late" || r.growth === "super_late") && wins >= 2) return { key: "latebloom", title: "遅咲きの雑草魂", desc: "長い下積みを経て、キャリア後半に花開いた苦労人。", color: C.green };
  if (wins >= 3) return { key: "winner", title: "勝利を知る者", desc: "確かな勝ち星を残した、記憶に残るレーサー。", color: C.green };
  if (podiums >= 6) return { key: "podium", title: "表彰台の常連", desc: "安定して上位に絡み続けた、堅実な実力者。", color: C.sub };
  if (races >= 15) return { key: "journeyman", title: "生涯一レーサー", desc: "派手さはなくとも、最後までペダルを回し続けた職人。", color: C.sub };
  return { key: "challenger", title: "名もなき挑戦者", desc: "短くも自分の走りを貫いた、一人の挑戦者。", color: C.sub };
}
// ---------- v14: マイライフモード（選手1人のキャリア） ----------
// v9〜v13のシーズンモード（チーム運営）とは完全に別のセーブ・状態を持つ、
// 選手1人の視点でB1からのキャリアを歩む新モード。既存のTYPES/ABILITIES/PERSONALITIES/
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
    gear: { roller: false, monitor: false, chef: false, flatCoach: false, climbCoach: false, sprintCoach: false, staminaCoach: false, soloCoach: false },
    houseLv: -1, carLv: -1,
    // v15: マイライフ専用ライバル。キャリア開始時に1名生成し、以後固定
    rival: null, rivalRecord: null,
    // v26: 複数ライバル制。2人目の好敵手（初対戦を終えるまでUIには出さない）
    rival2: null, rivalRecord2: null,
    // v15: 人生の岐路イベントで解決済みかどうか・恒常効果の有無を保持するフラグ
    flags: { married: false, marriageResolved: false, injuryResolved: false, rushedInjuryComeback: false, hasChild: false, childResolved: false, childFocusedCareer: false, mentor: false, mentorName: null, mentorActive: false },
    rewardedAchievements: [],
    pendingCrossroads: null, crossroadsResultText: null,
    pendingOffseason: null, offseasonResultText: null,
    // v30: 世界ランキング＆キャリア・アンビション
    worldPoints: 0, worldRank: null, worldRankBest: null,
    worldSeed: (Math.floor(Math.random() * 1e9) >>> 0) || 777, // v33.9: 生きた世界のシード
    ambitionIdx: 0, ambitionDone: [], ambitionPath: "victory", // v31.5: 生き方（路線）
    careerWins: 0, careerPodiums: 0, careerBigWins: 0, careerTitles: 0,
    // v32: 固定チームメイト・条件付き作戦・キャリアグラフ用の年次記録
    teammates: [], tactic: "balanced", careerHistory: [],
  };
}
const ML_SAVE_KEY = "roadrace_v12_mylife_save";
const ML_SAVE_VERSION = "v12ml";
const ML_SAVE_FIELDS = [
  "screen", "year", "month", "classIdx", "points", "player", "team", "races", "log", "retired",
  "directive", "managerEval", "salary", "money", "partsInv", "stock", "gear", "houseLv", "carLv",
  "rival", "rivalRecord", "rival2", "rivalRecord2", "flags", "rewardedAchievements",
  // v30: 世界ランキング＆キャリア・アンビション
  "worldPoints", "worldRank", "worldRankBest", "worldSeed", "ambitionIdx", "ambitionDone", "ambitionPath",
  "careerWins", "careerPodiums", "careerBigWins", "careerTitles",
  "teammates", "tactic", "careerHistory",
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
    if (parsed.state.rival && parsed.state.rival.id >= RID) RID = parsed.state.rival.id + 1;
    const merged = { ...base, ...parsed.state, sel: base.sel, result: null, resultInfo: null };
    // v30: 旧セーブ移行。世界ランキング／アンビションの通算カウンタが未保存なら、
    // これまでの戦績ログから通算勝利・表彰台を補完する（グレード依存のbigWinsは補完不可のため0）
    if (parsed.state.careerWins == null && merged.player && Array.isArray(merged.player.raceLog)) {
      merged.careerWins = merged.player.raceLog.filter(e => e.rank === 1).length;
      merged.careerPodiums = merged.player.raceLog.filter(e => e.rank <= 3).length;
    }
    // v31.5: 路線（生き方）未設定の旧セーブは勝利の道に置き、到達状況から現在の段を決める
    if (parsed.state.ambitionPath == null) {
      merged.ambitionPath = "victory";
      merged.ambitionIdx = mlFirstUnmetRung(merged, "victory");
    }
    // v32: 固定チームメイト未設定の旧セーブは、現所属チームのメンバーを今生成する
    if ((!merged.teammates || merged.teammates.length === 0) && merged.player && merged.team) {
      const trng = mulberry(Date.now() % 999983 + 7);
      merged.teammates = mlGenTeammates(trng, merged.team, 3, [merged.player.name], merged.year || 1);
    }
    if (!merged.tactic) merged.tactic = "balanced";
    if (!Array.isArray(merged.careerHistory)) merged.careerHistory = [];
    return merged;
  } catch (e) { return null; }
}
function clearMyLifeSave() {
  try { localStorage.removeItem(ML_SAVE_KEY); } catch (e) { /* noop */ }
}
// v15: マイライフ専用のライバル選手。キャリア開始時に1名だけ生成し、以後は名前・脚質・
// 性格・所属チームを固定したまま、レースのたびに現在のクラス／グレードに応じた能力で
// 登場させる（プレイヤーと同じ月次成長シミュレーションを個別に回す必要をなくすための単純化）
// v26: 複数ライバル制。2人目のライバル生成時は、既に確保済みの名前・所属チームを
// bannedNames/bannedTeamsで除外できるようにする
function mlCreateRival(rng, playerName, playerTeamName, bannedNames, bannedTeams) {
  const excludeTeams = new Set([playerTeamName, ...(bannedTeams || [])]);
  const otherTeams = MYLIFE_TEAMS.filter(t => !excludeTeams.has(t.name));
  const team = otherTeams[Math.floor(rng() * otherTeams.length)];
  const keys = Object.keys(TYPES);
  const type = keys[Math.floor(rng() * keys.length)];
  const banned = new Set([playerName, ...(bannedNames || [])]);
  const name = pickRiderName(rng, banned);
  const px = rng();
  const personality = px < 0.30 ? "normal" : px < 0.35 ? "genius"
    : ["hotblood", "seeker", "artisan", "free", "smart"][Math.floor(rng() * 5)];
  const abilities = rollAbilities(rng);
  return { id: RID++, name, type, team: team.name, age: 20 + Math.floor(rng() * 8), personality, abilities };
}
// v32（固定チームメイト）：所属チームの固定メンバーを生成する。名前・脚質・性格・特性・
// 加入年を固定アイデンティティとして持ち、以後レースには現在の地力で登場する（保存対象）。
function mlGenTeammates(rng, teamName, count, bannedNames, year) {
  const banned = new Set(bannedNames || []);
  const typeKeys = Object.keys(TYPES);
  const list = [];
  for (let i = 0; i < count; i++) {
    const type = typeKeys[Math.floor(rng() * typeKeys.length)];
    const name = pickRiderName(rng, banned);
    const px = rng();
    const personality = px < 0.35 ? "normal" : ["hotblood", "seeker", "artisan", "free", "smart", "genius"][Math.floor(rng() * 6)];
    list.push({ id: RID++, name, type, personality, abilities: rollAbilities(rng), team: teamName, joinYear: year || 1, winsForMe: 0 });
  }
  return list;
}
// v14: マイライフのレースは6チーム全部をAI生成し、プレイヤーの選手だけを
// 「PLAYER」チームタグ付きの1名として混ぜる（RaceView等の既存カメラ・強調表示ロジックを
// そのまま再利用するため）。プレイヤー自身のチームメイトは実際のチーム名で登場する
// v15: rivalとraceMeta.rivalPresentが揃っていれば、ライバルの所属チームの1枠（エース枠）を
// ライバルの固定アイデンティティ（名前・脚質・性格）に差し替え、isRivalフラグを立てる
// v32: TACTICS＝出走前に選ぶ条件付き作戦（ノーリスクの疑似無線）。simulateTicksが解釈する
// directiveと、プレイヤー自身の立ち回り（早め逃げ）へマッピングする。結果に実際に影響する。
const ML_TACTICS = {
  balanced:   { label: "🚩 標準（流れに任せる）",       chaseMode: "normal", aceEarly: false, desc: "特別な仕掛けはせず、脚質と展開に任せる" },
  wait:       { label: "⏳ 末脚温存（集団スプリント狙い）", chaseMode: "push",   aceEarly: false, desc: "逃げを許さず集団を保ち、ゴール勝負に持ち込む（スプリント型向き）" },
  early:      { label: "💨 早めに逃げる",               chaseMode: "normal", aceEarly: false, playerBreakaway: true, desc: "序盤から飛び出して逃げ切りを狙う（スプリントが苦手な選手向き）" },
  aggressive: { label: "⚔ 積極的に仕掛ける",            chaseMode: "normal", aceEarly: true,  desc: "終盤の勝負どころで自ら仕掛ける（エース時）" },
  assist:     { label: "🤝 アシストに徹する",            chaseMode: "push",   aceEarly: false, playerAssist: true, desc: "自分の勝ちを捨ててエースを支える献身の走り。監督指示に関わらず必ずアシスト戦としてカウントされ、監督評価も下がらない（献身の道向き）" },
};
function buildMyLifeSim(raceMeta, player, myTeamName, classIdx, difficultyId, dayTag, directiveKey, rival, year, rival2, teammates, tactic) {
  const diffAiMul = (DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1]).aiMul;
  const course = generateCourse(raceMeta, dayTag);
  const rng = mulberry(Date.now() % 999983);
  // v22: クラスさえ上がれば以降は相手のレベルが固定されてしまい、キャリア後半は練習しなくても
  // 勝ち続けられて練習の意味が薄れる、という指摘を受けた。年数が経つほどライバル勢も力をつけて
  // くる（新世代の台頭）という設定で、経過年数に応じてAIの地力を継続的に底上げする
  const yearBonus = Math.min(24, ((year || 1) - 1) * 1.5);
  const power = (50 + classIdx * 9 + (raceMeta.grade - 1) * 4 + yearBonus) * diffAiMul;
  const { squadMin, squadMax } = raceMeta.tmpl;
  const nameBanned = new Set([player.name]);
  const riders = [];
  const playerEff = effAbilities(player, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather);
  // v32（世界の統合）：歴代殿堂選手を、AIチームのエース枠に一定確率で紛れ込ませる。
  // 過去の自分やライバルの血を引く名選手たちと、同じレースで再会できる。
  const legendPool = loadMlLegends().filter(l => l && l.finalAbilities);
  const legendTeams = {}; // teamName -> legend
  if (legendPool.length > 0) {
    const nLeg = rng() < 0.55 ? (rng() < 0.35 ? 2 : 1) : 0;
    const otherTeams = MYLIFE_TEAMS.filter(d => d.name !== myTeamName && !(rival && d.name === rival.team) && !(rival2 && d.name === rival2.team));
    const shuffled = [...legendPool].sort(() => rng() - 0.5).slice(0, nLeg);
    const teamsForLeg = [...otherTeams].sort(() => rng() - 0.5).slice(0, nLeg);
    shuffled.forEach((leg, i) => { if (teamsForLeg[i]) legendTeams[teamsForLeg[i].name] = leg; });
  }
  let assistedAceRef = null; // v33.8: アシスト宣言時に献身で押し上げた自チームのエース
  MYLIFE_TEAMS.forEach(d => {
    const isMyTeam = d.name === myTeamName;
    const aiSquadN = squadMin === squadMax ? squadMin : squadMin + Math.floor(rng() * (squadMax - squadMin + 1));
    const members = [];
    // v32（固定チームメイト）：自分のチームは、保存済みの固定メンバーを現在の地力で登場させる
    if (isMyTeam && teammates && teammates.length) {
      teammates.slice(0, Math.max(1, aiSquadN)).forEach((tm, i) => {
        const st = newRider(power + (i === 0 ? 4 : 0), rng, { type: tm.type, banned: nameBanned });
        st.id = tm.id; st.name = tm.name; st.type = tm.type; st.personality = tm.personality || st.personality;
        if (tm.abilities) st.abilities = tm.abilities;
        members.push(st);
      });
      for (let i = members.length; i < aiSquadN; i++) members.push(newRider(power, rng, { banned: nameBanned }));
    } else {
      for (let i = 0; i < aiSquadN; i++) members.push(newRider(power + (i === 0 ? 6 : 0), rng, { banned: nameBanned }));
    }
    const aiRoles = assignAIRoles(members, aiSquadN);
    const aiStyle = AI_STYLES[Math.floor(rng() * AI_STYLES.length)];
    const teamEntrants = members.map((r, i) => {
      // v29: マイライフのAI相手もeffAbilitiesを通し、体格・調子・大舞台・加速力・メンタルを反映
      const e = effAbilities(r, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather);
      return {
        id: r.id, name: r.name, type: r.type, abilities: r.abilities, goldAbilities: r.goldAbilities, ...e,
        team: d.name, teamName: d.name, color: d.color, isAce: i === 0, role: aiRoles[r.id], aiStyle,
      };
    });
    if (rival && raceMeta.rivalPresent && d.name === rival.team && d.name !== myTeamName) {
      const rivalStats = newRider(power + 6, rng, { type: rival.type, banned: nameBanned });
      rivalStats.abilities = rival.abilities; rivalStats.goldAbilities = rival.goldAbilities;
      const re = effAbilities(rivalStats, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather);
      teamEntrants[0] = {
        ...teamEntrants[0], ...re,
        id: rival.id, name: rival.name, type: rival.type, abilities: rival.abilities, goldAbilities: rival.goldAbilities,
        isRival: true,
      };
    }
    // v26: 複数ライバル制。2人目のライバル（好敵手）は別チームの出走枠を差し替える
    if (rival2 && raceMeta.rival2Present && d.name === rival2.team && d.name !== myTeamName) {
      const rival2Stats = newRider(power + 6, rng, { type: rival2.type, banned: nameBanned });
      rival2Stats.abilities = rival2.abilities; rival2Stats.goldAbilities = rival2.goldAbilities;
      const r2e = effAbilities(rival2Stats, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather);
      teamEntrants[0] = {
        ...teamEntrants[0], ...r2e,
        id: rival2.id, name: rival2.name, type: rival2.type, abilities: rival2.abilities, goldAbilities: rival2.goldAbilities,
        isRival2: true,
      };
    }
    // v32（世界の統合）：このチームに歴代殿堂選手が割り当てられていればエース枠に差し替える
    if (legendTeams[d.name] && !isMyTeam) {
      const leg = legendTeams[d.name];
      const legStats = newRider(power + 8, rng, { type: leg.type, banned: nameBanned });
      legStats.abilities = leg.specialAbilities || legStats.abilities;
      AB_KEYS.forEach(k => { if (leg.finalAbilities && leg.finalAbilities[k] != null) legStats[k] = leg.finalAbilities[k]; });
      SUB_STAT_KEYS.forEach(k => { if (leg.finalSubStats && leg.finalSubStats[k] != null) legStats[k] = leg.finalSubStats[k]; });
      const le = effAbilities(legStats, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather);
      teamEntrants[0] = {
        ...teamEntrants[0], ...le,
        id: legStats.id, name: leg.name, type: leg.type, abilities: legStats.abilities, goldAbilities: legStats.goldAbilities,
        isLegend: true, legendTitle: leg.careerTitle || null,
      };
    }
    if (isMyTeam) {
      // v14.3: 監督指示が「エース」「アシスト／経験」であれば役割はそれに従って強制する。
      // 指示のない特別な区分（積極的な走り等）の場合のみ、従来通り能力比較で自動判定する
      const topAbility = Math.max(...teamEntrants.map(e => e.flat + e.climb + e.sprint + e.stamina + e.solo));
      const playerTotal = playerEff.flat + playerEff.climb + playerEff.sprint + playerEff.stamina + playerEff.solo;
      const tac = ML_TACTICS[tactic] || ML_TACTICS.balanced;
      let playerIsAce;
      // v33.6: 「アシストに徹する」を選べば監督指示に関わらず献身役に固定できる（献身の道の運ゲー解消）
      if (tac.playerAssist) playerIsAce = false;
      else if (directiveKey === "ace") playerIsAce = true;
      else if (directiveKey === "support" || directiveKey === "experience") playerIsAce = false;
      else playerIsAce = playerTotal >= topAbility;
      if (playerIsAce) teamEntrants.forEach(e => { e.isAce = false; });
      // v33.8: アシストに徹する＝チームのエース（先頭のチームメイト）を献身で押し上げる。
      // 牽引・風除け・ボトルの恩恵を、自分の地力＋「献身のアシスト」特能に応じてエースの決め所へ還元する。
      if (tac.playerAssist && !playerIsAce) {
        const ace = teamEntrants.find(e => e.isAce);
        if (ace) {
          const contrib = (playerTotal / 5 - 55) * 0.16 + (hasAbility(player, "domestique") ? (hasGoldAbility(player, "domestique") ? 5 : 3) : 0);
          const boost = Math.max(2, Math.min(10, Math.round(contrib)));
          AB_KEYS.forEach(k => { ace[k] = Math.min(99, (ace[k] || 0) + boost); });
          ace.assistBoost = boost;
          assistedAceRef = ace;
        }
      }
      // v32（条件付き作戦）：早めに逃げる作戦なら、プレイヤーを逃げ要員として飛び出させる
      const playerRole = tac.playerBreakaway ? "breakaway" : (playerIsAce ? "lead" : "sub");
      riders.push({
        id: player.id, name: player.name, type: player.type, abilities: player.abilities, goldAbilities: player.goldAbilities, ...playerEff,
        team: "PLAYER", teamName: myTeamName, color: C.yellow,
        isAce: playerIsAce, role: playerRole, isPlayerChar: true,
      });
    }
    teamEntrants.forEach(en => riders.push(en));
  });
  const sim = { entrants: riders, riders, course, groupMode: "full", raceMeta, breakSurvived: false };
  // v32（条件付き作戦）：選択した作戦をレース全体の指示（集団牽引の強さ・エース発射）へ反映
  const tac = ML_TACTICS[tactic] || ML_TACTICS.balanced;
  simulateTicks(course, riders, 0, { chaseMode: tac.chaseMode, aceEarly: tac.aceEarly }, false);
  rankSim(sim);
  // v33.8: 献身で押し上げたエースの最終着順を結果画面に渡す
  if (assistedAceRef) sim.assistedAce = { name: assistedAceRef.name, rank: assistedAceRef.rank, boost: assistedAceRef.assistBoost };
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
  // v29: 選手名の変更用モーダル（アプリ内完結のテキスト入力）
  const [renameState, setRenameState] = useState(null); // { title, value, onCommit }
  const openRename = (title, current, onCommit) => setRenameState({ title, value: current || "", onCommit });
  const stage2LockRef = useRef(false);
  // v28: 新規ゲーム開始時のチーム名入力
  const [teamNameChoice, setTeamNameChoice] = useState("");
  // v13: 新規ゲーム開始時の難易度選択（newgame_setup画面用。永続ボーナスは選択不要で自動適用）
  const [diffChoice, setDiffChoice] = useState("easy");
  const clearAwardedRef = useRef(false);
  // v13: 選手名鑑（戦績一覧）の展開状態。選手カードのトグルボタンで開閉する
  const [expandedRiderId, setExpandedRiderId] = useState(null);
  // v31.1: シーズンモードの血統ユース（配合）の選択状態（null=閉じている／{a,b}=親のindex）
  const [breedYouthSel, setBreedYouthSel] = useState(null);
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
    if (g.screen === "main") { saveGame(g); noteAbilityDiscovery(g.roster); }
  }, [g]);

  // v14: マイライフモードも同様にmylife_main到達時点で自動保存（別のセーブキー）
  useEffect(() => {
    if (superMode === "mylife" && ml.screen === "mylife_main") { saveMyLife(ml); noteAbilityDiscovery([ml.player]); }
  }, [ml, superMode]);

  // v18: 実績を初めて達成したタイミングで自動的に報酬（資金・一部はクリアポイント）を付与する。
  // rewardedAchievementsに記録済みのidは対象から除外するので、次回以降のrender/effectでは
  // newlyが空になり安全に停止する（重複付与しない）
  useEffect(() => {
    if (g.screen !== "main") return;
    const newly = computeSeasonAchievements(g).filter(a => a.achieved && !(g.rewardedAchievements || []).includes(a.id));
    if (newly.length === 0) return;
    const moneyTotal = newly.reduce((sum, a) => sum + (a.reward?.money || 0), 0);
    const cpTotal = newly.reduce((sum, a) => sum + (a.reward?.cp || 0), 0);
    if (cpTotal > 0) { const meta = loadMeta(); saveMeta({ totalEarnedCP: meta.totalEarnedCP + cpTotal }); }
    setG(s => ({
      ...s,
      budget: s.budget + moneyTotal,
      rewardedAchievements: [...(s.rewardedAchievements || []), ...newly.map(a => a.id)],
      log: [...s.log, ...newly.map(a => `【実績解除】${a.label}（+${a.reward?.money || 0}万円${a.reward?.cp ? `／CP+${a.reward.cp}` : ""}）`)],
    }));
  }, [g]);

  // v18: マイライフも同様に実績達成時に報酬を付与する
  useEffect(() => {
    if (superMode !== "mylife" || ml.screen !== "mylife_main" || !ml.player) return;
    const newly = computeAchievements(ml).filter(a => a.achieved && !(ml.rewardedAchievements || []).includes(a.id));
    if (newly.length === 0) return;
    const moneyTotal = newly.reduce((sum, a) => sum + (a.reward?.money || 0), 0);
    const cpTotal = newly.reduce((sum, a) => sum + (a.reward?.cp || 0), 0);
    if (cpTotal > 0) { const meta = loadMeta(); saveMeta({ totalEarnedCP: meta.totalEarnedCP + cpTotal }); }
    setMl(s => ({
      ...s,
      money: s.money + moneyTotal,
      rewardedAchievements: [...(s.rewardedAchievements || []), ...newly.map(a => a.id)],
      log: [...s.log, ...newly.map(a => `【実績解除】${a.label}（+${a.reward?.money || 0}万円${a.reward?.cp ? `／CP+${a.reward.cp}` : ""}）`)],
    }));
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
    // v17: キャプテン制度。主将より2歳以上若い選手は、主将の指導を受けて練習効果+10%になる。
    // v18バランス調整: 指導に時間を割く分、主将自身の練習効果はわずかに落ちる（-5%）ようにし、
    // 「誰でも無条件に任命した方が得」にならないよう小さなトレードオフを持たせた
    const captain = state.roster.find(r => r.id === state.captainId);
    const captainMentorMul = (n) => {
      if (!captain) return 1;
      if (n.id === captain.id) return 0.95;
      return n.age < captain.age - 2 ? 1.1 : 1;
    };
    const roster = state.roster.map(r => {
      const n = { ...r, parts: { ...r.parts } };
      // v17: チームケミストリー用に、在籍月数を毎月加算する
      n.tenure = (n.tenure || 0) + 1;
      const injMul = hasAbility(n, "glass") ? 2 : hasAbility(n, "tough") ? 0.5 : 1;
      const injExtra = hasAbility(n, "glass") ? 1 : 0;
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
            * (hasAbility(n, "trainer") ? 1.2 : hasAbility(n, "lazy_sp") ? 0.8 : 1)
            * (hasAbility(n, "lateblow_sp") && n.age >= 28 ? 1.15 : 1)
            * captainMentorMul(n);
          // v27: OBコーチが在籍していれば、その担当能力の練習効果を全選手+25%する
          const obAb = state.obCoach ? state.obCoach.ab : null;
          const obMul = (k) => (obAb && k === obAb ? 1.25 : 1);
          // 指定能力の成長にトレードオフ（×0.9）。指定外はさらに絞って14%
          addAb(n, n.focus, gain * 0.9 * persMul(n, n.focus) * obMul(n.focus), growthCap);
          AB_KEYS.filter(k => k !== n.focus).forEach(k => addAb(n, k, gain * 0.14 * persMul(n, k) * obMul(k), growthCap));
          // v29: シーズンでも練習で加速力・メンタルがわずかに伸びる（focusがsprint/flatなら加速に厚め）
          const subG = 0.24 * ph.gain * POW[n.growthPow].mul;
          growSub(n, "accel", subG * (n.focus === "sprint" || n.focus === "flat" ? 1.3 : 0.7));
          growSub(n, "mental", subG * 0.6);
          n.fatigue = Math.min(100, n.fatigue + 6);
        }
        const ph2 = growthPhase(n);
        if (ph2.dec > 0) AB_KEYS.forEach(k => { n[k] = Math.max(20, n[k] - ph2.dec); });
      }
      if (starterIds && starterIds.includes(n.id)) {
        // v28: 出走した選手はベンチ月数（起用されない不満の蓄積）をリセットする
        n.benchMonths = 0;
        // v25: 天候の悪化。猛暑は出走後の疲労蓄積を増やす（悪天候巧者による軽減はなし＝純粋な体力勝負）
        const heatMul = raceInfo.weather === "heat" ? 1.15 : 1;
        n.fatigue = Math.min(100, n.fatigue + (hasAbility(n, "iron") ? 32 : 45) * stageFatigueMul * heatMul);
        n.streak += 1;
        const ph = growthPhase(n);
        // v25: 出走経験による成長が練習に比べて弱く、レースに出る意味が薄いという指摘を受け強化。
        // 基礎係数を引き上げた上、格上のレース（グレードが高い）ほど得るものが大きくなるようにした
        const raceGradeMul = GRADE_MUL[raceInfo.grade] || 1;
        raceInfo.expKeys.forEach(k => addAb(n, k, 1.0 * raceGradeMul * Math.max(0.2, ph.gain) * POW[n.growthPow].mul * persMul(n, k), growthCap));
        // v29: メンタルは大舞台の経験で育つ（格上ほど大きく）
        growSub(n, "mental", 0.3 * raceGradeMul * Math.max(0.25, ph.gain));
        // v11: ドクター（staff.doctor）は故障の発生率を下げ、発生した場合も期間を短縮する
        // v29バグ修正: 効果が体感しづらいという指摘を受け、発生率減・期間短縮ともに強化
        const doctorLv = state.staff?.doctor || 0;
        const injCut = Math.round(doctorLv * 0.8); // 故障期間の短縮量（Lv3で3ヶ月短縮）
        if (n.streak >= 3) {
          n.injury = Math.max(1, 1 + (Math.random() < 0.5 ? 1 : 0) + injExtra - injCut);
          n.streak = 0;
          state._injured.push(`${n.name} が3連闘の無理がたたり故障（${n.injury}ヶ月離脱）`);
        } else if (n.fatigue > 90) {
          const p = (0.3 + (n.fatigue - 90) * 0.04) * injMul * Math.max(0.1, 1 - doctorLv * 0.22);
          if (Math.random() < p) {
            n.injury = Math.max(1, 1 + (Math.random() < 0.4 ? 1 : 0) + injExtra - injCut);
            n.streak = 0;
            state._injured.push(`${n.name} が疲労の蓄積で故障（${n.injury}ヶ月離脱）`);
          }
        } else if (raceInfo.weather === "rain" && Math.random() < (hasAbility(n, "rain_sp") ? 0.02 : 0.06) * Math.max(0.1, 1 - doctorLv * 0.22)) {
          // v25: 雨天レースは悪天候巧者を持たない選手に一定確率で落車リスクを上乗せする
          n.injury = Math.max(1, 1 + (Math.random() < 0.3 ? 1 : 0) + injExtra - injCut);
          n.streak = 0;
          state._injured.push(`${n.name} が雨天のレースで落車、負傷離脱（${n.injury}ヶ月）`);
        }
      } else if (n.injury === 0) {
        n.fatigue = Math.max(0, n.fatigue - (starterIds ? 30 : 50));
        n.streak = 0;
        // v28: レースが行われた月に起用されなかった選手は「ベンチ月数」が積み上がる（移籍志願の判定に使う）
        if (starterIds) n.benchMonths = (n.benchMonths || 0) + 1;
      }
      if (hasAbility(n, "recover")) n.fatigue = Math.max(0, n.fatigue - 15);
      // v27: コンディション予報。前月に予報した向きを実際の変動として適用し、翌月の予報を新たに引く
      const swing = hasAbility(n, "moody") ? 2 : hasAbility(n, "steady_sp") ? 0.5 : 1;
      const dir = (n.condForecast != null) ? n.condForecast : rollCondDir();
      n.cond = Math.max(1, Math.min(5, n.cond + dir * swing));
      n.condForecast = rollCondDir();
      // v15フェーズ2: 金特化の判定（勝利数・役割出走数の条件を満たしたら毎月チェック）
      let updated = n;
      const upgraded = upgradeGoldAbilities(updated);
      if (upgraded !== updated) {
        upgraded.goldAbilities.filter(id => !(updated.goldAbilities || []).includes(id))
          .forEach(id => state._injured.push(`${n.name}の特殊能力「${ABILITIES[id].label}」が金特に覚醒した！`));
        updated = upgraded;
      }
      // v17: 特殊能力の後天的獲得判定
      const acquired = acquireNewAbility(updated);
      if (acquired !== updated) {
        const newId = acquired.abilities[acquired.abilities.length - 1];
        state._injured.push(`${n.name}が新たな特殊能力「${ABILITIES[newId].label}」を身につけた！`);
        updated = acquired;
      }
      return updated;
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
          if (s.classIdx === 2 && s.champBest === 1) { info.cleared = true; recordTitle("grandFinal"); }
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
        const staffSalary = staffSalaryTotal(s.staff) + (s.obCoach ? OB_COACH_SALARY : 0);
        const managerLv = s.staff?.manager || 0;
        const nextOffers = genSponsors(classIdx, year).map(o => ({
          ...o,
          // v29バグ修正: 監督スタッフの効果が体感しづらいという指摘を受け、契約条件への
          // 反映を強化（月収・成功報酬UP／ノルマ・失敗ペナルティ減）
          monthly: Math.round(o.monthly * (1 + managerLv * 0.12)),
          norma: Math.max(5, Math.round(o.norma * (1 - managerLv * 0.08))),
          bonus: Math.round((o.bonus || 0) * (1 + managerLv * 0.10)),
          penalty: Math.max(0, Math.round((o.penalty || 0) * (1 - managerLv * 0.10))),
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
          scouts: genScouts(classIdx, year * 771 + 13, s.scoutPolicy, survivors.map(r => r.name), s.staff?.scout || 0),
          faMarket: genFaPool(classIdx, year * 613 + 29, survivors.map(r => r.name)),
          tradeOffers: genTradeOffers(classIdx, year * 1471 + 37, survivors),
          races: genMonthRaces(year, 0, classIdx, 0, null, []),
          camp: false, champBest: null, gc: null,
          sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false, chaseMode: "normal", aceEarly: false },
          // v14.8: 年が変わるのでグランツール制覇状況もリセットする
          gtWins: [],
          // v25: ユース育成枠も年度が変わるたびにリセットする
          youthUsed: false,
          yearendInfo: info, cleared: info.cleared, log, careerHistory, hallOfFame, rivalAlumni: survivingAlumni,
          screen: info.cleared ? "clear" : "yearend", tab: "home",
        };
      }
      const month = s.month + 1;
      const upkeep = roster.length * UPKEEP_PER_RIDER;
      const staffSalary = staffSalaryTotal(s.staff) + (s.obCoach ? OB_COACH_SALARY : 0);
      const base = {
        ...s, roster, month, camp: false,
        budget: s.budget + income - upkeep - staffSalary,
        sponsor,
        faMarket: genFaPool(s.classIdx, s.year * 1013 + month * 37 + 7, roster.map(r => r.name)),
        tradeOffers: genTradeOffers(s.classIdx, s.year * 1231 + month * 59 + 17, roster),
        races: genMonthRaces(s.year, month, s.classIdx, s.points, sponsor, s.gtWins),
        sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false, chaseMode: "normal", aceEarly: false },
        gc: null,
        screen: "main", log,
      };
      // v28: 選手の移籍志願。長期間ベンチに置かれた実力者（能力55以上）が不満を募らせ、
      // 退団を申し出ることがある。主将は対象外。慰留か放出かをプレイヤーが選ぶ
      const requester = roster.find(r => r.injury === 0 && (r.benchMonths || 0) >= 4 && overall(r) >= 55 && r.id !== s.captainId);
      if (month !== 0 && requester && roster.length > 1 && Math.random() < 0.25) {
        return { ...base, transferRequest: { riderId: requester.id, name: requester.name }, screen: "transferRequest" };
      }
      // v8: 月替わりでランダムに選択肢付きイベントが発生（春先の解禁月は除く）
      if (month !== 0 && Math.random() < EVENT_CHANCE) {
        const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        return { ...base, pendingEvent: ev, screen: "event" };
      }
      return base;
    });
  }
  // v28: 移籍志願への対応。慰留＝引き止め費用を払って残ってもらう／放出＝退団（他チームに拾われうる）
  const retainRider = () => {
    setG(s => {
      const req = s.transferRequest;
      if (!req) return s;
      const cost = 30;
      return {
        ...s, budget: s.budget - cost, transferRequest: null, screen: "main",
        roster: s.roster.map(r => r.id === req.riderId ? { ...r, benchMonths: 0, cond: Math.min(5, r.cond + 1) } : r),
        log: [...s.log, `【${MONTHS[s.month]}】${req.name}を慰留（引き止め費用-${cost}万・本人は納得して残留）`],
      };
    });
  };
  const grantTransferRequest = () => {
    setG(s => {
      const req = s.transferRequest;
      if (!req) return s;
      const r = s.roster.find(x => x.id === req.riderId);
      if (!r) return { ...s, transferRequest: null, screen: "main" };
      const roster = s.roster.filter(x => x.id !== req.riderId);
      const captainId = s.captainId === req.riderId ? null : s.captainId;
      // 志願しての退団なので、他チームに拾われやすい（能力・将来性に応じて）
      const pickedUp = Math.random() < Math.max(0.5, computePickupChance(r));
      if (pickedUp) {
        const signedTeam = RIVAL_TEAMS[Math.floor(Math.random() * RIVAL_TEAMS.length)].name;
        return {
          ...s, roster, captainId, transferRequest: null, screen: "main",
          rivalAlumni: [...s.rivalAlumni, { ...r, signedTeam, signedYear: s.year }],
          log: [...s.log, `【${MONTHS[s.month]}】${r.name}の移籍志願を受け入れた → ${signedTeam}へ移籍`],
        };
      }
      const hallOfFame = isHallOfFameWorthy(r) ? [...s.hallOfFame, { ...r, farewellYear: s.year, farewellReason: "released" }] : s.hallOfFame;
      return { ...s, roster, captainId, hallOfFame, transferRequest: null, screen: "main", log: [...s.log, `【${MONTHS[s.month]}】${r.name}の移籍志願を受け入れ、円満に送り出した`] };
    });
  };

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
    const squadRaw = g.roster.filter(r => g.sel.starters.includes(r.id));
    // v28: ホームアドバンテージ。地元開催なら出走選手の全能力に小ボーナス（元のroster配列は不変）
    const isHome = raceIsHome(race, g.homeRegion);
    const squad = isHome
      ? squadRaw.map(r => ({ ...r, flat: r.flat + HOME_ABILITY_BONUS, climb: r.climb + HOME_ABILITY_BONUS, sprint: r.sprint + HOME_ABILITY_BONUS, stamina: r.stamina + HOME_ABILITY_BONUS, solo: r.solo + HOME_ABILITY_BONUS }))
      : squadRaw;
    const aceId = g.sel.starters.length === 1 ? g.sel.starters[0] : g.sel.ace;
    const itemBoost = { wheel: g.sel.useWheel, suit: g.sel.useSuit };
    // v12: 無線指示は廃止し、出走前に選んだ作戦をそのままシミュレーションへ渡す
    const directive = { chaseMode: g.sel.chaseMode || "normal", aceEarly: !!g.sel.aceEarly };
    // v29: 出走表用に事前生成した相手チーム布陣があればそれを使い、顔ぶれを一致させる
    const { sim, aiTeams } = buildSim(race, squad, aceId, g.sel.roles, g.equip, itemBoost, g.classIdx, g.pendingAiTeams, race.stageRace ? "day1" : undefined, directive, g.difficulty, g.rivalAlumni, g.dynastyLevel, g.teamName);
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
      const { sim } = buildSim(gc.race, squad, aceId, roles, s.equip, { wheel: false, suit: false }, s.classIdx, gc.aiTeams, `day${nextStage}`, gc.directive, s.difficulty, undefined, s.dynastyLevel, s.teamName);
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
    // v27: コースレコード。勝者のフィニッシュタイムからコース種別ごとの最速記録を更新する
    const winner = sim.ranked[0];
    const courseRecord = recordCourseResult(race.tmpl.kind, sim.course.length, winner.finishTime, winner.name, winner.team === "PLAYER", g.year);
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
        prizeInfo: { race, prize, pts: race.championship ? 0 : pts, best, mandateHit, breakSurvived: sim.breakSurvived, hadBreak: sim.hadBreak, courseRecord },
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
        const gtNewWin = race.grandTour && bestRank === 1 && race.gtIndex != null && !(s.gtWins || []).includes(race.gtIndex);
        const gtWins = gtNewWin ? [...(s.gtWins || []), race.gtIndex] : (s.gtWins || []);
        // v28: 通算タイトル記録（グランツール総合優勝）
        if (gtNewWin) recordTitle("grandTour");
        // v18: グランツールの副次クラシフィケーション（ポイント賞・山岳賞・新人賞）。
        // 実際のGCタイムとは別に、各ステージの着順を日ごとの地形（favors）で重み付けして
        // 集計する。新人賞は26歳未満の選手の中でのGC最高位。自チームの選手が獲得すれば
        // ボーナス賞金を上乗せする
        const STAGE_JERSEY_POINTS = [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        let jerseyBonus = 0;
        let jerseyInfo = null;
        if (race.grandTour) {
          const pointsScore = {}, komScore = {};
          dayLogs.forEach(dl => {
            const dayTmpl = race.stageTmpls ? race.stageTmpls[dl.day - 1] : race.tmpl;
            const favors = dayTmpl ? dayTmpl.favors : race.tmpl.favors;
            const pointsMul = favors === "SPR" ? 1.5 : favors === "PUN" ? 1.0 : favors === "CLM" ? 0.6 : 1.0;
            const komMul = favors === "CLM" ? 1.5 : favors === "PUN" ? 0.6 : 0.2;
            Object.entries(dl.rankById).forEach(([id, rank]) => {
              const base = STAGE_JERSEY_POINTS[rank - 1] || 0;
              pointsScore[id] = (pointsScore[id] || 0) + base * pointsMul;
              komScore[id] = (komScore[id] || 0) + base * komMul;
            });
          });
          const byScoreDesc = (score) => Object.keys(score).sort((a, b) => score[b] - score[a]);
          const pointsLeaderId = byScoreDesc(pointsScore)[0] || null;
          const komLeaderId = byScoreDesc(komScore)[0] || null;
          const youthOrder = order.filter(([id]) => idToEntrant[id] && idToEntrant[id].age <= 25);
          const youthLeaderId = youthOrder.length ? youthOrder[0][0] : null;
          const isPlayer = (id) => id != null && idToEntrant[id]?.team === "PLAYER";
          const pointsLeaderIsPlayer = isPlayer(pointsLeaderId);
          const komLeaderIsPlayer = isPlayer(komLeaderId);
          const youthLeaderIsPlayer = isPlayer(youthLeaderId);
          jerseyBonus = (pointsLeaderIsPlayer ? 50 : 0) + (komLeaderIsPlayer ? 50 : 0) + (youthLeaderIsPlayer ? 30 : 0);
          jerseyInfo = {
            pointsLeaderId, pointsLeaderName: pointsLeaderId ? idToEntrant[pointsLeaderId].name : null, pointsLeaderIsPlayer,
            komLeaderId, komLeaderName: komLeaderId ? idToEntrant[komLeaderId].name : null, komLeaderIsPlayer,
            youthLeaderId, youthLeaderName: youthLeaderId ? idToEntrant[youthLeaderId].name : null, youthLeaderIsPlayer,
          };
        }
        const jerseyWinCounts = { ...(s.jerseyWinCounts || { points: 0, mountains: 0, youth: 0 }) };
        if (jerseyInfo?.pointsLeaderIsPlayer) jerseyWinCounts.points += 1;
        if (jerseyInfo?.komLeaderIsPlayer) jerseyWinCounts.mountains += 1;
        if (jerseyInfo?.youthLeaderIsPlayer) jerseyWinCounts.youth += 1;
        return {
          ...s, roster, rivalAlumni, budget: s.budget + prize + jerseyBonus, points: race.championship ? s.points : s.points + pts, champBest: bestRank,
          careerStats: bumpCareerStats(s.careerStats, bestRank, prize + jerseyBonus),
          gc: { ...s.gc, gcOrder: order, idToEntrant, bestRank, prize: prize + jerseyBonus, pts, jerseyInfo, jerseyBonus },
          gtWins, jerseyWinCounts,
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
  // v15: 節目の大会。通常の月次カレンダーとは別枠で、特定の月・クラス到達時にのみ登場する
  // 最高格付け（グレード4）の一発勝負。世界選手権は毎年9月・クラスA以上で選出、
  // オリンピックは4年に一度7月・PROクラスでのみ選出される。ライバルも代表入りし、
  // 大舞台での因縁の対決になる
  function mlGenRace(year, month, classIdx) {
    if (month === 5 && classIdx >= 1) {
      const wrng = mulberry(year * 401 + month * 7 + 501);
      return { id: `ml-worlds-${year}`, name: `${year}年目 世界選手権ロードレース`, tmpl: TEMPLATES[2], grade: 4, cls: classIdx, milestone: "worlds", rivalPresent: true, rival2Present: true, weather: rollWeather(wrng) };
    }
    if (month === 3 && classIdx >= 2 && (year - 1) % 4 === 0) {
      const wrng = mulberry(year * 401 + month * 7 + 502);
      return { id: `ml-olympics-${year}`, name: `${year}年目 オリンピック ロードレース`, tmpl: TEMPLATES[3], grade: 4, cls: classIdx, milestone: "olympics", rivalPresent: true, rival2Present: true, weather: rollWeather(wrng) };
    }
    const rng = mulberry(year * 3001 + month * 97 + classIdx * 17);
    const pool = unlockedTemplates();
    const t = pool[Math.floor(rng() * pool.length)];
    const grade = month === 11 ? 3 : 1 + Math.floor(rng() * 3);
    // v15: 約45%の確率でその月のレースにライバルが出走してくる（rival自体はキャラ作成時に固定生成済み）
    const rivalPresent = rng() < 0.45;
    // v26: 2人目のライバル（好敵手）も独立した確率で出走してくる
    const rival2Present = rng() < 0.45;
    return { id: `ml-${year}-${month}`, name: `${VENUES[Math.floor(rng() * VENUES.length)]}${t.kind}`, tmpl: t, grade, cls: classIdx, rivalPresent, rival2Present, weather: rollWeather(rng) };
  }
  const ML_MILESTONE_LABEL = { worlds: { eyebrow: "🌍 世界選手権", color: C.blue }, olympics: { eyebrow: "🥇 オリンピック", color: C.yellow } };
  function mlCreateChar(type, background, master, partner) {
    const rng = mulberry(Date.now() % 999983);
    const team = MYLIFE_TEAMS[Math.floor(Math.random() * MYLIFE_TEAMS.length)];
    const bg = ML_BACKGROUNDS[background];
    // v27: 教え子（プロテジェ）。師匠を選んでいれば、その最終能力・特殊能力・成長力を
    // 一部引き継いだ状態でデビューする
    const inh = master ? protegeInherit(master) : null;
    const player = newRider(bg.powerBase, rng, { type, age: bg.age, growth: bg.growth, powDist: bg.powDist, banned: new Set(), abBonus: inh ? inh.abBonus : undefined });
    player.background = background;
    if (inh) {
      if (inh.growthPowBump) {
        const gi = GROWTHPOW_ORDER.indexOf(player.growthPow);
        if (gi >= 0 && gi < GROWTHPOW_ORDER.length - 1) player.growthPow = GROWTHPOW_ORDER[gi + 1];
      }
      // v28: 「師の教え」の看板特性(lineage)＋師本人の良特性(inheritAbility)を継承。
      // 教え子は継承分により特殊能力を最大4つまで持てる（通常上限3より1多い＝メンターの恩恵）
      let abils = [...(player.abilities || [])];
      [inh.lineageTrait, inh.inheritAbility].forEach(id => { if (id && !abils.includes(id)) abils.push(id); });
      player.abilities = abils.slice(0, 4);
      // v29: 師の教えに応じた副ステータス補正
      if (inh.subBonus) SUB_STAT_KEYS.forEach(k => { if (inh.subBonus[k]) player[k] = Math.max(20, Math.min(95, (player[k] ?? 50) + inh.subBonus[k])); });
      player.master = master.name;
      player.teaching = inh.teaching.label;
      player.joinOvr = overall(player);
    }
    // v31: 配合（血統）。2人目の親（配合相手）が選ばれていれば、両方の血を引く教え子にする
    let breed = null;
    if (master && partner) {
      breed = mlBreedBonus(master, partner);
      AB_KEYS.forEach(k => { if (breed.abBonus[k]) player[k] = Math.min(96, (player[k] || 0) + breed.abBonus[k]); });
      SUB_STAT_KEYS.forEach(k => { if (breed.subBonus[k]) player[k] = Math.max(20, Math.min(95, (player[k] ?? 50) + breed.subBonus[k])); });
      // v33: 爆発力（配合評価）は初期能力ではなく「伸びしろ」に還元する。生まれた瞬間は普通でも育てると化ける
      if (breed.growthSteps) player.growthPow = bumpGrowthPow(player.growthPow, breed.growthSteps);
      else if (breed.growthBump) player.growthPow = bumpGrowthPow(player.growthPow, 1);
      player.talentCap = breed.talentCap || 0;
      player.bakuhatsu = breed.bakuhatsu || 0;
      player.matingGrade = breed.matingGrade || "D";
      // 金特クロス・配合限定特能は最優先で保持する（枠上限で溢れないように先頭へ）
      let abils2 = [...(breed.goldInherit || []), ...(breed.exclusive || []), ...(player.abilities || [])];
      breed.extraAbilities.forEach(id => { if (id && ABILITIES[id] && !abils2.includes(id)) abils2.push(id); });
      abils2 = abils2.filter((id, i) => abils2.indexOf(id) === i);
      player.abilities = abils2.slice(0, 5); // 配合は特能を最大5つまで受け継げる
      // 金特クロス：受け継いだ金特のうち、実際に特能枠へ残ったものを金特フラグ化
      if (breed.goldInherit && breed.goldInherit.length) {
        player.goldAbilities = [...(player.goldAbilities || [])];
        breed.goldInherit.forEach(id => { if (player.abilities.includes(id) && !player.goldAbilities.includes(id)) player.goldAbilities.push(id); });
      }
      // v33.4: 特殊配合。特定の血の組み合わせで、唯一無二の名血（金枠）を確定発現する
      if (breed.special) {
        const sm = breed.special;
        player.specialMating = { key: sm.key, title: sm.title, color: sm.color, note: sm.note, factorGold: !!sm.factorGold };
        player.talentCap = (player.talentCap || 0) + (sm.talent || 0);
        if (sm.growth) player.growthPow = bumpGrowthPow(player.growthPow, sm.growth);
        if (sm.extra && ABILITIES[sm.extra] && !(player.abilities || []).includes(sm.extra) && (player.abilities || []).length < 6) player.abilities = [...(player.abilities || []), sm.extra];
        if (sm.gold && ABILITIES[sm.gold]) {
          if (!(player.abilities || []).includes(sm.gold) && (player.abilities || []).length < 6) player.abilities = [...(player.abilities || []), sm.gold];
          if ((player.abilities || []).includes(sm.gold)) { player.goldAbilities = [...(player.goldAbilities || [])]; if (!player.goldAbilities.includes(sm.gold)) player.goldAbilities.push(sm.gold); }
        }
      }
      // v33.2: 危険度。濃い血の代償として、稀に「ガラスの体」を持って生まれる（頑丈を継いでいれば発症しない）
      player.matingDanger = breed.danger || 0;
      if (breed.danger > 0 && !player.abilities.includes("tough") && !player.abilities.includes("glass") && Math.random() * 100 < breed.danger) {
        player.abilities = [...player.abilities, "glass"]; // 呪いは通常枠と別枠で背負う
        player.fragileBorn = true;
      }
      player.partner = partner.name;
      player.plusValue = breed.plusValue;
      player.generation = breed.generation;
      player.parentBloodIds = [legendBloodId(master), legendBloodId(partner)].filter(Boolean);
      const anc = new Set(player.parentBloodIds);
      legendAncestorSet(master).forEach(a => anc.add(a));
      legendAncestorSet(partner).forEach(a => anc.add(a));
      player.ancestorBloodIds = [...anc].slice(0, 12);
      player.joinOvr = overall(player);
    }
    // v31.2: 系統名（血統の系統）。師匠／親の系統を継ぎ、いなければ自分が始祖となって新系統を興す
    player.lineageName = master ? (master.lineageName || `${master.name}系`) : `${player.name}系`;
    // v33.3: 系統確立ボーナス（因子）。確立した系統を継ぐ子孫は伸びしろ＋系統特能を受け取る
    let bloodlineNote = null;
    const blb = mlBloodlineBonus(player.lineageName);
    if (blb) {
      player.bloodlineTier = blb.tier;
      player.talentCap = (player.talentCap || 0) + blb.talentCap;
      if (blb.growthSteps) player.growthPow = bumpGrowthPow(player.growthPow, blb.growthSteps);
      let gotFactor = false;
      if (blb.factor && ABILITIES[blb.factor]) {
        if (!(player.abilities || []).includes(blb.factor) && (player.abilities || []).length < 5) {
          player.abilities = [...(player.abilities || []), blb.factor];
          gotFactor = true;
        }
        // 大系統は系統因子を金特へ昇華する（既に持っていても金特化）
        if (blb.factorGold && (player.abilities || []).includes(blb.factor)) {
          player.goldAbilities = [...(player.goldAbilities || [])];
          if (!player.goldAbilities.includes(blb.factor)) { player.goldAbilities.push(blb.factor); gotFactor = true; }
        }
      }
      bloodlineNote = { tier: blb.tier, label: blb.label, factor: gotFactor ? blb.factor : null, gold: blb.factorGold && (player.abilities || []).includes(blb.factor) };
    }
    // v33.4: 純血の極み（特殊配合）は系統因子を金特へ昇華する。系統因子が無ければ得意脚質特能を金特化
    if (player.specialMating && player.specialMating.factorGold) {
      const fac = (blb && blb.factor) || { climb: "mount", sprint: "finisher", flat: "flatlander", solo: "soloist" }[master ? master.focus : player.focus];
      if (fac && ABILITIES[fac]) {
        if (!(player.abilities || []).includes(fac) && (player.abilities || []).length < 6) player.abilities = [...(player.abilities || []), fac];
        if ((player.abilities || []).includes(fac)) { player.goldAbilities = [...(player.goldAbilities || [])]; if (!player.goldAbilities.includes(fac)) player.goldAbilities.push(fac); }
      }
    }
    player.focus = type === "CLM" ? "climb" : type === "SPR" ? "sprint" : "flat";
    // v25: 個人スポンサー・メディア人気度。チーム年俸とは別枠で、戦績に応じて上がる
    // 知名度が個人スポンサー収入（月極＋節目の一時金）に反映される
    player.popularity = 0;
    player.form = 50; // v29: ピーキング用のフォーム（50=平常）
    player.popMilestones = [];
    // v14.3: 経歴ごとの初任給（万円/年）。年俸・監督評価・資産はキャリア開始時に初期化する
    const initialSalary = { highschool: 220, university: 280, corporate: 360 }[background] || 260;
    const rival = mlCreateRival(rng, player.name, team.name);
    // v26: 複数ライバル制。2人目の好敵手も別チームに固定生成しておくが、最初の対戦まで
    // 本人には明かされず、レースで実際に相まみえた瞬間に「新たな好敵手」として紹介される
    const rival2 = mlCreateRival(rng, player.name, team.name, [rival.name], [rival.team]);
    // v25: 新人時代に指導してくれる恩師を1名設定する。在籍から3年目を迎えるまでの間、
    // 練習・出走経験の伸びにボーナスがかかり、3年目に「人生の岐路」として一区切りを迎える
    // v27: 師匠（プロテジェの師）を選んでいれば、その名選手本人が恩師として指導につく
    const mentorName = master ? master.name : pickRiderName(rng, new Set([player.name, rival.name, rival2.name]));
    const initLog = [
      `【1年目 4月】${bg.label}として${team.name}に新人選手加入`,
      `【1年目 4月】${rival.team}の${rival.name}が、これから長く続くライバルになりそうだ`,
    ];
    if (master) {
      initLog.push(`【1年目 4月】かつての名選手・${master.name}の教え子としてデビュー。師の教え「${inh.teaching.label}」を授かり、${AB_LABEL[inh.keys[0]]}を受け継いだ`);
      initLog.push(`【1年目 4月】継承特性「${ABILITIES[inh.lineageTrait].label}」を身につけている（${inh.teaching.desc}）`);
      if (inh.inheritAbility) initLog.push(`【1年目 4月】さらに師匠直伝の特殊能力「${ABILITIES[inh.inheritAbility].label}」も受け継いだ`);
      if (breed) {
        initLog.push(`【1年目 4月】🧬 配合：${master.name}と${partner.name}、二人の血を引く逸材（${breed.nick.rank} ${breed.nick.label}／累代+${breed.plusPer}）`);
        if (breed.inbreed.count > 0) initLog.push(`【1年目 4月】🩸 共通の祖先を持つ濃い血のクロス（インブリード×${breed.inbreed.count}）。血が結晶し「${ABILITIES[breed.inbreedAb]?.label || breed.inbreedAb}」を宿す`);
        (breed.goldInherit || []).forEach(id => { if (player.abilities.includes(id)) initLog.push(`【1年目 4月】✨ 金特クロス！両親の血が重なり、特殊能力「${ABILITIES[id]?.label || id}」を最初から金特で受け継いだ`); });
        (breed.exclusive || []).forEach(id => { if (player.abilities.includes(id)) initLog.push(`【1年目 4月】🩸 配合限定特能「${ABILITIES[id]?.label || id}」を血に宿して誕生した`); });
        if (player.fragileBorn) initLog.push(`【1年目 4月】⚠️ 濃すぎる血の代償か、生まれつき体が脆く「ガラスの体」を抱えている…健康管理が鍵になる`);
      }
      if (player.lineageName) initLog.push(`【1年目 4月】この血統は「${player.lineageName}」と呼ばれている`);
      if (bloodlineNote) {
        initLog.push(`【1年目 4月】🏛 「${player.lineageName}」は${bloodlineNote.label}した名門血統。その因子を受け継いで生まれた（伸びしろ上昇）`);
        if (bloodlineNote.factor) initLog.push(`【1年目 4月】🧬 系統因子「${ABILITIES[bloodlineNote.factor]?.label || bloodlineNote.factor}」${bloodlineNote.gold ? "を金特で" : "を"}発現している`);
      }
      if (player.specialMating) initLog.push(`【1年目 4月】🌟 特殊配合『${player.specialMating.title}』発動！${player.specialMating.note}`);
    } else {
      initLog.push(`【1年目 4月】チームの${mentorName}が新人指導を買って出てくれた。しばらくは練習・出走の伸びに手心を加えてもらえそうだ`);
    }
    setMl(s => ({
      ...s, player, team: team.name, classIdx: 0, year: 1, month: 0, points: 0,
      races: [mlGenRace(1, 0, 0)],
      directive: mlGenDirective(1, 0, 0, 30),
      managerEval: 30, salary: initialSalary, money: 0,
      partsInv: {}, stock: { drink: 0, supp: 0, tune: 0 },
      gear: { roller: false, monitor: false, chef: false, flatCoach: false, climbCoach: false, sprintCoach: false, staminaCoach: false, soloCoach: false },
      houseLv: -1, carLv: -1,
      rival, rivalRecord: { meetings: 0, wins: 0, losses: 0 },
      rival2, rivalRecord2: { meetings: 0, wins: 0, losses: 0 },
      flags: { ...s.flags, mentorName, mentorActive: true, master: master ? master.name : null },
      // v30: 世界ランキング＆アンビションを新規キャリア用に初期化
      worldPoints: 0, worldRank: null, worldRankBest: null,
      worldSeed: (Math.floor(Math.random() * 1e9) >>> 0) || 777, // v33.9: 生きた世界のシード
      ambitionIdx: 0, ambitionDone: [], ambitionPath: "victory",
      careerWins: 0, careerPodiums: 0, careerBigWins: 0, careerTitles: 0,
      // v32: 固定チームメイト・作戦・キャリア記録
      teammates: mlGenTeammates(rng, team.name, 3, [player.name, rival.name, rival2.name], 1),
      tactic: "balanced", careerHistory: [],
      log: initLog,
      screen: "mylife_main",
    }));
  }
  function mlSetFocus(key) {
    setMl(s => ({ ...s, player: { ...s.player, focus: key } }));
  }
  // v18: シーズンモードのキャプテン制度に対応するマイライフ側の役割。30歳以降、
  // チームの精神的支柱（メンター）になることを選べる。一度なると解除はできない
  function mlBecomeMentor() {
    setMl(s => ({
      ...s, flags: { ...s.flags, mentor: true },
      log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】チームの精神的支柱としてメンター役を引き受けた`],
    }));
  }
  function mlStartRace() {
    if (mlRaceLockRef.current) return;
    mlRaceLockRef.current = true;
    let race = ml.races[0];
    // v28: 代表チームでの立場。世界選手権・オリンピックでは代表監督から役割が与えられる。
    // 監督評価が高い（信頼されている）ほどエースを任され、そうでなければアシスト役になる。
    // 役割はそのままレースでの立ち回り（directive）に反映される
    let directiveKey = ml.directive ? ml.directive.key : null;
    if (race.milestone && !race.nationalRole) {
      const natRole = ml.managerEval >= 55 ? "ace" : "support";
      race = { ...race, nationalRole: natRole };
      directiveKey = natRole;
      setMl(s => ({ ...s, races: [race, ...s.races.slice(1)] }));
    } else if (race.milestone && race.nationalRole) {
      directiveKey = race.nationalRole;
    }
    const sim = buildMyLifeSim(race, ml.player, ml.team, ml.classIdx, "easy", undefined, directiveKey, ml.rival, ml.year, ml.rival2, ml.teammates, ml.tactic);
    // v29: 出走表を挟んでからレース本番へ（顔ぶれを確認できる）
    setMl(s => ({ ...s, result: sim, screen: "mylife_startlist" }));
  }
  // v27: ラストレース演出。引退前に「最後のレース」を特別に用意し、有終の美を飾れるようにする。
  // 脚質に合ったコースのグレード4エキシビションとして、両ライバルも駆けつける最高の舞台にする
  function mlStartLastRace() {
    if (mlRaceLockRef.current) return;
    mlRaceLockRef.current = true;
    const tmplByType = { SPR: TEMPLATES[0], CLM: TEMPLATES[3], RUL: TEMPLATES[2], PUN: TEMPLATES[2], TT: TEMPLATES[5] };
    const tmpl = tmplByType[ml.player.type] || TEMPLATES[2];
    const meta = { id: `ml-lastrace-${ml.year}`, name: `${ml.player.name} 引退記念ラストレース`, tmpl, grade: 4, cls: ml.classIdx, rivalPresent: true, rival2Present: true, weather: "clear", isLastRace: true };
    const sim = buildMyLifeSim(meta, ml.player, ml.team, ml.classIdx, "easy", undefined, "ace", ml.rival, ml.year, ml.rival2, ml.teammates, "aggressive");
    setMl(s => ({ ...s, result: sim, inLastRace: true, screen: "mylife_race" }));
  }
  function mlLastRaceFinish() {
    mlRaceLockRef.current = false;
    const sim = ml.result;
    const me = sim.ranked.find(e => e.isPlayerChar);
    const rank = me ? me.rank : sim.ranked.length;
    const total = sim.ranked.length;
    const flavor = rank === 1 ? "最後のレースを、なんと勝利で締めくくった！最高の花道だ。"
      : rank <= 3 ? "最後のレースで堂々の表彰台。見事な有終の美を飾った。"
      : rank <= 10 ? "最後まで集団に食らいつき、力を出し切って走り抜けた。"
      : "結果は振るわなかったが、最後まで自分の走りを貫いた。悔いはない。";
    setMl(s => {
      // ラストレースの戦績も通算記録に含めてから殿堂入りさせる
      const player = { ...s.player, raceLog: [...(s.player.raceLog || []), { year: s.year, month: s.month, name: sim.raceMeta.name, rank, role: "ace" }] };
      const finalState = { ...s, player };
      mlRecordLegend(finalState);
      return {
        ...finalState, inLastRace: false, result: null,
        lastRaceResult: { rank, total, flavor, name: sim.raceMeta.name },
        screen: "mylife_retired",
        log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】ラストレースで${rank}位。${player.age}歳で現役を退いた`],
      };
    });
  }
  function mlRaceFinish() {
    mlRaceLockRef.current = false;
    const sim = ml.result;
    const me = sim.ranked.find(e => e.isPlayerChar);
    const race = ml.races[0];
    const pts = Math.round((PTS[me.rank - 1] || 0) * GRADE_MUL[race.grade]);
    // v14.3: 監督指示を全うできたかどうかで監督評価が増減する。賞金はクラス倍率に応じて即時支給
    // v33.5: セーブから復元した監督指示はJSONでcheck関数が失われているため、キーで正規テーブルから引き直す
    const directive = ml.directive ? (MANAGER_DIRECTIVES[ml.directive.key] || ml.directive) : null;
    // v33.6: 「アシストに徹する」を選んだ場合は監督指示ではなく献身の走りとして評価する。
    // 献身は自らの着順を犠牲にする行為なので、監督評価は下げず（むしろ小幅加点）運ゲーにしない
    const assistChosen = !!(ML_TACTICS[ml.tactic] && ML_TACTICS[ml.tactic].playerAssist);
    const fulfilled = assistChosen ? true : ((directive && typeof directive.check === "function") ? directive.check(me.rank, sim.ranked.length) : false);
    const evalDelta = assistChosen ? 3 : (directive ? (fulfilled ? directive.evalGain : -directive.evalPenalty) : 0);
    const prize = Math.round((PRIZES[me.rank - 1] || 0) * (0.4 + ml.classIdx * 0.25));
    // v15: このレースにライバルが出走していれば、着順を比較して通算のライバル戦績を更新する
    const rivalEntrant = sim.ranked.find(e => e.isRival);
    // v26: 複数ライバル制。2人目の好敵手も同様に戦績を追跡する
    const rival2Entrant = sim.ranked.find(e => e.isRival2);
    // v27: コースレコード。勝者のフィニッシュタイムからコース種別ごとの最速記録を更新する
    const winner = sim.ranked[0];
    const courseRecord = recordCourseResult(race.tmpl.kind, sim.course.length, winner.finishTime, winner.name, !!winner.isPlayerChar, ml.year);
    // v28: 通算タイトル記録（世界選手権・オリンピックで優勝したら）
    if (me.rank === 1 && race.milestone) recordTitle(race.milestone);
    // v28: 代表チームでの立場。世界選手権・オリンピックには代表監督から役割（エース/アシスト）が
    // 与えられる。役割を全うすると名声（人気度）が大きく上がる
    const natRole = race.nationalRole || null;
    const natFulfilled = natRole ? (natRole === "ace" ? me.rank <= 3 : me.rank <= 10) : false;
    const natPopBonus = natRole ? (natFulfilled ? (natRole === "ace" ? 8 : 5) : 0) : 0;
    setMl(s => {
      // v14.6: マイライフでは監督指示のキー自体がその一戦での役割を表すので、そのまま記録する
      // v33.6: ただし「アシストに徹する」を選んだ場合は監督指示に関わらず献身役として記録し、
      // 献身の道（アンビション）へ確実にカウントされるようにする（監督指示待ちの運ゲーを解消）
      const role = assistChosen ? "support" : (directive ? directive.key : (me.isAce ? "ace" : "support"));
      // v25: 個人スポンサー・メディア人気度。着順が良いほど、また規模の大きいレースほど伸びる
      // v28: 代表の役割を全うすれば名声（人気度）が上乗せされる
      const popGain = (me.rank === 1 ? 3 : me.rank <= 3 ? 1.5 : me.rank <= 10 ? 0.5 : 0.1) * GRADE_MUL[race.grade] + natPopBonus;
      const popMilestones = s.player.popMilestones || [];
      const newPopularity = Math.max(0, Math.min(100, (s.player.popularity || 0) + popGain));
      let popBonus = 0;
      const newlyHit = [];
      POP_MILESTONES.forEach(m => {
        if (newPopularity >= m.th && !popMilestones.includes(m.th)) { popBonus += m.bonus; newlyHit.push(m.th); }
      });
      const player = {
        ...s.player,
        raceLog: [...(s.player.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: me.rank, role }],
        popularity: newPopularity,
        popMilestones: [...popMilestones, ...newlyHit],
      };
      let rivalRecord = s.rivalRecord;
      let rivalOutcome = null;
      if (rivalEntrant) {
        const beat = me.rank < rivalEntrant.rank;
        rivalRecord = {
          meetings: (rivalRecord?.meetings || 0) + 1,
          wins: (rivalRecord?.wins || 0) + (beat ? 1 : 0),
          losses: (rivalRecord?.losses || 0) + (beat ? 0 : 1),
        };
        rivalOutcome = { name: rivalEntrant.name, rank: rivalEntrant.rank, beat };
      }
      // v26: 複数ライバル制。2人目の好敵手は初対戦時だけ「新たな好敵手が現れた」という
      // 紹介フレーバーを付ける
      let rivalRecord2 = s.rivalRecord2;
      let rivalOutcome2 = null;
      let rival2Intro = false;
      if (rival2Entrant) {
        const isFirstMeeting = (rivalRecord2?.meetings || 0) === 0;
        const beat2 = me.rank < rival2Entrant.rank;
        rivalRecord2 = {
          meetings: (rivalRecord2?.meetings || 0) + 1,
          wins: (rivalRecord2?.wins || 0) + (beat2 ? 1 : 0),
          losses: (rivalRecord2?.losses || 0) + (beat2 ? 0 : 1),
        };
        rivalOutcome2 = { name: rival2Entrant.name, rank: rival2Entrant.rank, beat: beat2 };
        rival2Intro = isFirstMeeting;
      }
      let log = newlyHit.length > 0
        ? [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】人気度が${newlyHit.join("・")}に到達し、個人スポンサー契約で+${popBonus}万円`]
        : s.log;
      if (rival2Intro) log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】${rival2Entrant.teamName}の${rival2Entrant.name}と初めて同じレースで相まみえた。新たな好敵手になりそうだ`];
      // v30: 世界ランキング更新＆キャリア・アンビション判定
      const wpGain = worldPointsForFinish(me.rank, race.grade);
      const worldPoints = (s.worldPoints || 0) + wpGain;
      const worldRank = computeWorldRank(worldPoints, s.year);
      const worldRankBest = s.worldRankBest == null ? worldRank : Math.min(s.worldRankBest, worldRank);
      const careerWins = (s.careerWins || 0) + (me.rank === 1 ? 1 : 0);
      const careerPodiums = (s.careerPodiums || 0) + (me.rank <= 3 ? 1 : 0);
      const careerBigWins = (s.careerBigWins || 0) + (me.rank === 1 && race.grade >= 3 ? 1 : 0);
      const careerTitles = (s.careerTitles || 0) + (me.rank === 1 && race.milestone ? 1 : 0);
      let ambitionIdx = s.ambitionIdx || 0;
      let ambitionDone = s.ambitionDone || [];
      let ambitionCleared = null;
      let ambMoney = 0;
      // 判定は更新後の到達値で行う（順位・通算勝利・アシスト出走数等を反映した一時ビュー）
      const progressedMl = { ...s, player, worldRank, careerWins, careerPodiums, careerBigWins, careerTitles };
      const curAmb = mlCurrentAmbition(progressedMl); // 現在の路線・段の目標
      if (curAmb && mlAmbitionCleared(progressedMl, curAmb)) {
        const rw = applyAmbitionReward(curAmb.reward, player, 0);
        ambMoney = rw.money;
        ambitionCleared = { label: curAmb.label, rewardText: rw.text };
        ambitionIdx = ambitionIdx + 1;
        ambitionDone = [...ambitionDone, curAmb.key];
        log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】🎯アンビション「${curAmb.label}」を達成！（${rw.text}）`];
      }
      // v33.8: 献身の走りの成果。支えたエースが上位に入れば名アシストとして評価・人気・報酬が上乗せされる
      let assistOutcome = null, assistPop = 0, assistEval = 0, assistMoney = 0;
      if (sim.assistedAce) {
        const ar = sim.assistedAce.rank;
        const success = ar <= 3;
        assistOutcome = { name: sim.assistedAce.name, rank: ar, success };
        if (success) {
          assistPop = ar === 1 ? 2.5 : 1.5; assistEval = ar === 1 ? 4 : 2; assistMoney = ar === 1 ? 30 : 15;
          log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】🤝 あなたの献身の牽引でエース${sim.assistedAce.name}が${ar}位！名アシストとして称えられた（人気+${assistPop}・評価+${assistEval}・+${assistMoney}万円）`];
        } else {
          log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】🤝 エース${sim.assistedAce.name}を最後まで牽引したが${ar}位。報われない走りになった`];
        }
      }
      if (assistPop) player.popularity = Math.max(0, Math.min(100, player.popularity + assistPop));
      return {
        ...s, player, points: s.points + pts, log,
        managerEval: Math.max(0, Math.min(100, s.managerEval + evalDelta + assistEval)),
        money: s.money + prize + popBonus + ambMoney + assistMoney, rivalRecord, rivalRecord2,
        worldPoints, worldRank, worldRankBest, careerWins, careerPodiums, careerBigWins, careerTitles,
        ambitionIdx, ambitionDone,
        resultInfo: { race, rank: me.rank, total: sim.ranked.length, pts, directive, fulfilled, evalDelta, prize, rivalOutcome, rivalOutcome2, rival2Intro, popGain: Math.round(popGain * 10) / 10, popBonus, courseRecord, natRole, natFulfilled, natPopBonus, wpGain, worldRank, worldRankPrev: s.worldRank, ambitionCleared, assistOutcome },
        screen: "mylife_result",
      };
    });
  }
  // v14.2: 月次アクションを「レース／練習」の2択から拡張。練習・休養・イベントで
  // 選手への効果を出し分ける（順位・ポイント・賞金は既にmlRaceFinish側で反映済みのため
  // ここでは疲労・出走経験による能力成長を扱う）。
  // v14.3: 永続トレーニング用品（ローラー台・パワーメーター）と車（レース疲労軽減）の
  // 恒常効果もここで反映する
  function mlApplyMonthEffect(player0, mode, ctx) {
    const player = { ...player0 };
    const gear = (ctx && ctx.gear) || {};
    const carLv = ctx ? ctx.carLv : -1;
    const houseLv = ctx ? ctx.houseLv : -1;
    const flags = (ctx && ctx.flags) || {};
    const growthCap = mlGrowthCap(ctx && ctx.year, player);
    if (mode === "race") {
      const carCut = carLv >= 0 ? (1 - ML_CARS[carLv].raceFatigueCut) : 1;
      const chefCut = gear.chef ? 0.9 : 1;
      // v15: 「鉄人」を持つ選手は出走疲労が軽減される（シーズンモードの45→32と同じ比率）
      const ironCut = hasAbility(player, "iron") ? 32 / 45 : 1;
      // v25: 天候の悪化。猛暑は出走後の疲労蓄積を増やす
      const raceWeather = ctx && ctx.raceWeather;
      const heatMul = raceWeather === "heat" ? 1.15 : 1;
      // v28: 役割を縮小して現役続行を選んだベテランは、レース負荷が軽くなり疲労蓄積が減る
      const roleCut = flags.reducedRole ? 0.85 : 1;
      player.fatigue = Math.min(100, player.fatigue + 40 * carCut * chefCut * ironCut * heatMul * roleCut);
      player.streak = (player.streak || 0) + 1;
      // v25: シーズンモード同様、出走した種目に応じた能力成長（出走経験）を追加。
      // 格上のレース（グレードが高い）ほど得るものが大きい
      const raceExpKeys = (ctx && ctx.raceExpKeys) || [];
      const raceGradeMul = (ctx && ctx.raceGrade) ? (GRADE_MUL[ctx.raceGrade] || 1) : 1;
      // v25: 新人時代に恩師の指導を受けている間は、出走経験の伸びにもボーナスがかかる
      // v28: 「天才肌」は25歳以下の伸びが+15%
      const mentorMul = (flags.mentorActive ? 1.15 : 1) * (hasAbility(player, "genius_sp") && player.age <= 25 ? 1.15 : 1);
      const ph = growthPhase(player);
      raceExpKeys.forEach(k => addAb(player, k, 1.0 * raceGradeMul * mentorMul * Math.max(0.2, ph.gain) * POW[player.growthPow].mul * persMul(player, k), growthCap));
      // v29: メンタルは「大舞台の経験」で育つ。格上のレースほど大きく伸びる
      growSub(player, "mental", 0.35 * raceGradeMul * Math.max(0.25, ph.gain));
      // v25: 雨天レースは悪天候巧者を持たない選手に落車リスク（疲労急増＋わずかな能力の目減り）を上乗せする
      if (raceWeather === "rain" && Math.random() < (hasAbility(player, "rain_sp") ? 0.02 : 0.06)) {
        player.fatigue = Math.min(100, player.fatigue + 15);
        AB_KEYS.forEach(k => { player[k] = Math.max(20, player[k] - 2); });
        player.__weatherCrash = true;
      }
    } else if (mode === "train") {
      const ph = growthPhase(player);
      // v15: 「練習の虫」「練習嫌い」「遅咲き」の特殊能力を練習効果に反映
      // v17: 育児をパートナーに任せて競技優先を選んだ場合、練習効果がわずかに上乗せされる
      const abMul = (hasAbility(player, "trainer") ? 1.2 : hasAbility(player, "lazy_sp") ? 0.8 : 1)
        * (hasAbility(player, "lateblow_sp") && player.age >= 28 ? 1.15 : 1)
        // v28: 「天才肌」は25歳以下の練習効果+15%（遅咲きの逆で若手向け）
        * (hasAbility(player, "genius_sp") && player.age <= 25 ? 1.15 : 1)
        * (flags.childFocusedCareer ? 1.05 : 1)
        // v25: 新人時代に恩師の指導を受けている間は練習効果+15%
        * (flags.mentorActive ? 1.15 : 1);
      const gain = 1.5 * ph.gain * POW[player.growthPow].mul * (gear.roller ? 1.15 : 1) * abMul;
      const focusMul = gear.monitor ? 1.10 : 1;
      // v15フェーズ2: 種目別専門コーチは、狙っている能力かどうかに関わらずそのアビリティの伸びを底上げする
      const coachMul = (k) => (gear[ML_AB_COACH_KEY[k]] ? 1.25 : 1);
      addAb(player, player.focus, gain * 0.9 * persMul(player, player.focus) * focusMul * coachMul(player.focus), growthCap);
      AB_KEYS.filter(k => k !== player.focus).forEach(k => addAb(player, k, gain * 0.14 * persMul(player, k) * coachMul(k), growthCap));
      const ph2 = growthPhase(player);
      if (ph2.dec > 0) AB_KEYS.forEach(k => { player[k] = Math.max(20, player[k] - ph2.dec); });
      // v29: 通常練習でも加速力・メンタルがわずかに伸びる（focusがsprint/flatなら加速に厚め）
      const subG = 0.28 * ph.gain * POW[player.growthPow].mul;
      growSub(player, "accel", subG * (player.focus === "sprint" || player.focus === "flat" ? 1.3 : 0.7));
      growSub(player, "mental", subG * 0.6);
      player.fatigue = Math.max(0, player.fatigue - 15);
      player.streak = 0;
    } else if (mode === "rest") {
      player.fatigue = Math.max(0, player.fatigue - 35);
      player.streak = 0;
    } else if (mode === "event") {
      player.fatigue = Math.max(0, player.fatigue - 5);
    } else if (mode === "peak") {
      // v29: ピーキング。レースに向けたコンディション調整。フォームを高め疲労も少し抜ける
      // （能力の成長は無く、あくまで「仕上げ」）
      player.fatigue = Math.max(0, player.fatigue - 12);
      player.streak = 0;
    } else if (ML_SPECIAL_TRAINING[mode]) {
      // v28: 専門トレーニング。対象2能力を強めに伸ばし、疲労を大きく消費する。
      // メンタル強化（対象能力なし）は全能力をわずかに底上げしつつ調子を整える枠
      const spec = ML_SPECIAL_TRAINING[mode];
      const ph = growthPhase(player);
      const abMul = (hasAbility(player, "trainer") ? 1.2 : hasAbility(player, "lazy_sp") ? 0.8 : 1)
        * (flags.mentorActive ? 1.15 : 1);
      const base = 1.5 * ph.gain * POW[player.growthPow].mul * (gear.roller ? 1.15 : 1) * abMul * spec.gainMul;
      const coachMul = (k) => (gear[ML_AB_COACH_KEY[k]] ? 1.25 : 1);
      if (spec.keys.length > 0) {
        spec.keys.forEach(k => addAb(player, k, base * 0.65 * persMul(player, k) * coachMul(k), growthCap));
        AB_KEYS.filter(k => !spec.keys.includes(k)).forEach(k => addAb(player, k, base * 0.08 * persMul(player, k) * coachMul(k), growthCap));
      } else {
        AB_KEYS.forEach(k => addAb(player, k, base * 0.18 * persMul(player, k) * coachMul(k), growthCap));
      }
      // v29: 専門トレの副ステータス育成。スプリント特訓＝加速力、メンタル強化＝メンタルを重点的に鍛える
      const subBase = ph.gain * POW[player.growthPow].mul;
      if (mode === "sprintcamp") growSub(player, "accel", 1.6 * subBase);
      if (mode === "mental") growSub(player, "mental", 1.8 * subBase);
      const ph2 = growthPhase(player);
      if (ph2.dec > 0) AB_KEYS.forEach(k => { player[k] = Math.max(20, player[k] - ph2.dec); });
      player.fatigue = Math.min(100, player.fatigue + spec.fatigue);
      if (spec.cond) player.form = Math.min(100, (player.form ?? 50) + spec.cond * 8); // v31.3: 調子→フォームに統合
      player.streak = 0;
    }
    if (houseLv >= 0) player.fatigue = Math.max(0, player.fatigue - ML_HOUSES[houseLv].fatigueBonus);
    // v15: 「回復力」を持つ選手は毎月さらに疲労-15（シーズンモードと同じ効果）
    if (hasAbility(player, "recover")) player.fatigue = Math.max(0, player.fatigue - 15);
    // v15: 人生の岐路イベントで得た恒常効果（結婚による生活の安定／無理な怪我復帰の後遺症）
    if (flags.married) player.fatigue = Math.max(0, player.fatigue - 4);
    if (flags.rushedInjuryComeback) player.fatigue = Math.min(100, player.fatigue + 3);
    // v17: 育児に積極的に関わる道を選んだ場合、家庭のサポートでさらに疲労が抜けやすくなる
    if (flags.hasChild && !flags.childFocusedCareer) player.fatigue = Math.max(0, player.fatigue - 3);
    // v18: 若手のメンターになると、後進を気にかける充実感から疲労がわずかに抜けやすくなる
    if (flags.mentor) player.fatigue = Math.max(0, player.fatigue - 3);
    // v31.3: 「調子(cond)」と「フォーム(form)」は、どちらも当日の能力を上下させる二重の指標で
    // 分かりづらいという指摘を受け、マイライフではフォーム(0-100)に一本化した。調子は中立(3)に
    // 固定して能力への二重補正を止め、月々の好不調の波・予報・ピーキングをすべてフォームに集約する。
    player.cond = 3;
    const mentalSteady = Math.max(0.6, Math.min(1.4, 1 - ((player.mental ?? 50) - 50) / 250));
    // 毎月の波の大きさ（moodyは激しく、精密機械/steady_spは小さく、メンタルが高いほど安定）
    const swingMag = (hasAbility(player, "moody") ? 10 : hasAbility(player, "steady_sp") ? 3 : 6) * mentalSteady;
    const dir = (player.formForecast != null) ? player.formForecast : rollCondDir();
    const curForm = player.form ?? 50;
    // ピーキング調整の月はフォームが大きく上がる。それ以外は基準値(48)へ戻りつつ月々の波が乗る
    // ＝ピークは維持し続けられず、大レースに合わせて仕上げる駆け引きになる
    const nextForm = mode === "peak"
      ? curForm + 24
      : curForm + (48 - curForm) * 0.30 + dir * swingMag;
    player.form = Math.max(0, Math.min(100, Math.round(nextForm)));
    player.formForecast = rollCondDir(); // 翌月の波の向きを予報
    return player;
  }
  function mlAdvanceMonth(mode) {
    setMl(s => {
      // v25: シーズンモードと同様、マイライフでも出走した種目に応じた「出走経験」で能力が伸びるようにする
      // （従来は出走しても疲労とストリークが変化するだけで能力は一切伸びなかった）
      const raceExpKeys = (mode === "race" && s.result && s.result.course)
        ? [...new Set(s.result.course.segs.map(seg => SEG_AB[seg.type]))] : [];
      const raceGrade = (mode === "race" && s.resultInfo) ? s.resultInfo.race.grade : null;
      const raceWeather = (mode === "race" && s.resultInfo) ? s.resultInfo.race.weather : null;
      const ctx = { gear: s.gear, houseLv: s.houseLv, carLv: s.carLv, flags: s.flags, year: s.year, raceExpKeys, raceGrade, raceWeather };
      let player = mlApplyMonthEffect(s.player, mode, ctx);
      const log = [...s.log];
      if (ML_SPECIAL_TRAINING[mode]) log.push(`【${s.year}年目 ${MONTHS[s.month]}】${ML_SPECIAL_TRAINING[mode].label}を実施した`);
      if (player.__weatherCrash) {
        log.push(`【${s.year}年目 ${MONTHS[s.month]}】雨天のレースで危うく転倒しかけ、ヒヤッとした…`);
        player = { ...player, __weatherCrash: undefined };
      }
      // v15フェーズ2: 金特化の判定
      const upgradedPlayer = upgradeGoldAbilities(player);
      if (upgradedPlayer !== player) {
        upgradedPlayer.goldAbilities.filter(id => !(player.goldAbilities || []).includes(id))
          .forEach(id => log.push(`【${s.year}年目 ${MONTHS[s.month]}】特殊能力「${ABILITIES[id].label}」が金特に覚醒した！`));
        player = upgradedPlayer;
      }
      // v17: 特殊能力の後天的獲得判定
      const acquiredPlayer = acquireNewAbility(player);
      if (acquiredPlayer !== player) {
        const newId = acquiredPlayer.abilities[acquiredPlayer.abilities.length - 1];
        log.push(`【${s.year}年目 ${MONTHS[s.month]}】特殊能力「${ABILITIES[newId].label}」を新たに身につけた！`);
        player = acquiredPlayer;
      }
      // v14.3: 毎月、練習を積んだり生活基盤（一戸建て）が整っていると監督評価がじわじわ上がる。
      // 年俸は毎月1/12ずつ資金として振り込まれる
      const passiveEvalDelta = (mode === "train" ? 0.4 : 0) + (s.houseLv >= 2 ? 0.3 : 0) + (s.houseLv >= 3 ? 0.2 : 0) + (s.flags?.mentor ? 0.3 : 0);
      const managerEval = Math.max(0, Math.min(100, s.managerEval + passiveEvalDelta));
      // v25: 個人スポンサー収入。人気度10ごとに月+2万円の継続収入が入る（チーム年俸とは別枠）
      const popIncome = Math.floor((s.player.popularity || 0) / 10) * 2;
      // v27: 生活費・税負担。年俸が上がるほど生活水準・税負担も増し、手元に残る額は
      // 頭打ちになる。高級車・住居のグレードにも維持費がかかる。これによりキャリア後半に
      // 資金がダブついて緊張感が失われる（＝ヌルゲー化）のを抑える
      const livingCost = mlLivingCost(s);
      const money = Math.max(0, s.money + Math.round(s.salary / 12) + popIncome - livingCost);
      if (s.month === 11) {
        player.age += 1;
        const retire = player.age >= 36 || (player.age >= 33 && overall(player) < player.joinOvr * 0.8);
        if (retire) {
          const retiredState = { ...s, player, money, managerEval };
          mlRecordLegend(retiredState);
          return { ...retiredState, screen: "mylife_retired", log: [...log, `【${s.year}年目 3月】${player.age}歳で現役引退`] };
        }
        // v28: 衰えと引退勧告の駆け引き。強制引退には至らないが、年齢を重ね衰え期に入り
        // 全盛期の力を失いつつある選手には、年度末にチームから引退・役割縮小の打診が入る。
        // プレイヤーは「現役続行／役割を縮小して続行／勧告を受け入れ引退」を選べる
        const declining = player.age >= 32 && growthPhase(player).tag === "衰え期" && overall(player) < player.joinOvr && !s.flags?.reducedRole;
        // v17: 引退以外でキャリアが続く年は、必ずオフシーズンの過ごし方を選ばせる。
        // 人生の岐路イベントの判定はオフシーズンの選択を終えたあと（mlContinueAfterOffseason）で行う
        const finalizeYearEnd = (nextState) => {
          // v30: 世界ランキングの持ち点は年ごとに一部減衰し、翌年の（強くなった）基準で
          // 順位を引き直す。休むと順位が落ちるため、上位維持には走り続ける必要がある
          const decayedWP = Math.round((s.worldPoints || 0) * 0.72);
          // v32（キャリアグラフ）：この年の到達値を年次記録に積む（OVR・世界ランク・通算成績の推移）
          const histEntry = { year: s.year, ovr: overall(player), worldRank: s.worldRank, worldBest: s.worldRankBest, wins: s.careerWins || 0, podiums: s.careerPodiums || 0 };
          nextState = { ...nextState, worldPoints: decayedWP, worldRank: computeWorldRank(decayedWP, nextState.year), careerHistory: [...(s.careerHistory || []), histEntry] };
          const offseasonState = { ...s, screen: "mylife_offseason", pendingOffseason: nextState };
          if (declining) {
            return { ...s, screen: "mylife_retire_advice", pendingAdvice: offseasonState, player, money, managerEval,
              adviceInfo: { age: player.age, ovr: overall(player), joinOvr: player.joinOvr }, log };
          }
          return offseasonState;
        };
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
        // v15: オファーはチーム名だけでなく、年俸倍率・契約金・エース確約の有無が
        // チームごとに異なる。残留オファーは条件を上乗せしない基準線として提示し、
        // 移籍オファーはそれより魅力的な条件を出すことで「引き抜き」らしさを出す
        // v16: オファーには移籍先チームのtier（B1/A/PRO）を持たせ、契約するとその
        // tierがそのままプレイヤーの新classIdxになる。一度の移籍で飛び級しすぎない
        // よう、現在のclassIdxから±1tierの範囲のチームだけを候補にする
        const interest = s.points / Math.max(1, CLASSES[s.classIdx].need);
        if (interest >= 0.8 && Math.random() < 0.6) {
          const others = MYLIFE_TEAMS.filter(t => t.name !== s.team);
          const nearTier = others.filter(t => Math.abs(t.tier - classIdx) <= 1);
          const pool = nearTier.length >= 2 ? nearTier : others;
          // v27: 移籍時の争奪戦。昇格ラインを大きく超える好成績（interest>=1.2）を残した年は、
          // 複数チームが競って条件を吊り上げる。オファー数が増え、年俸倍率・契約金・エース確約が
          // 通常より豪華になり、契約画面に「争奪戦」の演出が表示される
          const biddingWar = interest >= 1.2;
          const offerN = biddingWar ? Math.min(3, pool.length) : 2;
          const offerTeams = [...pool].sort(() => Math.random() - 0.5).slice(0, offerN).map(t => ({
            team: t.name,
            tier: t.tier,
            salaryMul: Math.round(((biddingWar ? 1.2 : 1.05) + Math.random() * (biddingWar ? 0.4 : 0.25)) * 100) / 100,
            bonus: Math.round((biddingWar ? 60 : 20) + Math.random() * (biddingWar ? 140 : 80)),
            aceGuarantee: Math.random() < (biddingWar ? 0.7 : 0.4),
          }));
          const stayOffer = { team: s.team, tier: mlTeamTier(s.team), salaryMul: biddingWar ? 1.1 : 1, bonus: biddingWar ? 40 : 0, aceGuarantee: false };
          return finalizeYearEnd({
            ...s, player, classIdx, points: 0, year: s.year + 1, month: 0,
            races: [mlGenRace(s.year + 1, 0, classIdx)],
            directive: mlGenDirective(s.year + 1, 0, classIdx, managerEval),
            contractOffers: [stayOffer, ...offerTeams], biddingWar,
            salary, money, managerEval,
            screen: "mylife_contract", log,
          });
        }
        return finalizeYearEnd({
          ...s, player, classIdx, points: 0, year: s.year + 1, month: 0,
          races: [mlGenRace(s.year + 1, 0, classIdx)],
          directive: mlGenDirective(s.year + 1, 0, classIdx, managerEval),
          salary, money, managerEval,
          screen: "mylife_main", log,
        });
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
  // v28: 引退勧告への応答。pendingAdviceに次年度以降の続行state（オフシーズン画面）が
  // 既に格納済みなので、選択に応じてそこへ進む／役割縮小フラグを注入する／引退する
  function mlRetireAdviceContinue() {
    setMl(s => ({ ...s.pendingAdvice, pendingAdvice: null, adviceInfo: null,
      log: [...(s.pendingAdvice.log || s.log), `【${s.year}年目 3月】引退勧告を退け、現役続行を選んだ`] }));
  }
  function mlRetireAdviceReduceRole() {
    setMl(s => {
      const cont = s.pendingAdvice;
      const po = cont.pendingOffseason;
      // 次年度以降の状態へreducedRoleフラグを立てる（レース負荷が軽くなり現役を延命できる）
      const nextPO = { ...po, flags: { ...po.flags, reducedRole: true } };
      return { ...cont, pendingOffseason: nextPO, pendingAdvice: null, adviceInfo: null,
        flags: { ...s.flags, reducedRole: true },
        log: [...(cont.log || s.log), `【${s.year}年目 3月】役割を縮小してもう一年。レース負荷を抑えて現役を続ける`] };
    });
  }
  function mlRetireAdviceAccept() {
    setMl(s => {
      const retiredState = { ...s, pendingAdvice: null, adviceInfo: null };
      mlRecordLegend(retiredState);
      return { ...retiredState, screen: "mylife_retired",
        log: [...s.log, `【${s.year}年目 3月】チームの勧告を受け入れ、${s.player.age}歳で現役を退いた`] };
    });
  }
  // v15: 選んだオファーの条件（年俸倍率・契約金・エース確約）を実際に反映して契約を結ぶ
  // v16: 移籍先チームのtierがそのままプレイヤーの新classIdxになる（機材解放条件に直結）。
  // classIdxが変わる場合はそのtierに合わせてrace/directiveも生成し直す
  function mlChooseTeam(offer) {
    setMl(s => {
      const salary = Math.round(s.salary * offer.salaryMul);
      const money = s.money + offer.bonus;
      const classIdx = offer.tier != null ? offer.tier : s.classIdx;
      const classChanged = classIdx !== s.classIdx;
      const races = classChanged ? [mlGenRace(s.year, s.month, classIdx)] : s.races;
      const managerEval = s.managerEval;
      const directive = offer.aceGuarantee
        ? MANAGER_DIRECTIVES.ace
        : (classChanged ? mlGenDirective(s.year, s.month, classIdx, managerEval) : s.directive);
      let log = offer.bonus > 0 || offer.salaryMul > 1
        ? [...s.log, `【${s.year}年目 4月】${offer.team}と契約（年俸${salary}万円${offer.bonus > 0 ? `／契約金+${offer.bonus}万円` : ""}）`]
        : [...s.log];
      if (classChanged) {
        log = [...log, classIdx > s.classIdx
          ? `${offer.team}への移籍に伴い${CLASSES[classIdx].label}に昇格した！`
          : `${offer.team}への移籍に伴い${CLASSES[classIdx].label}に降格となった`];
      }
      // v32: 移籍で所属が変わったら固定チームメイトも新チームの顔ぶれに一新する
      const newTeammates = offer.team !== s.team
        ? mlGenTeammates(mulberry(Date.now() % 999983 + s.year * 13), offer.team, 3, [s.player.name, s.rival?.name, s.rival2?.name].filter(Boolean), s.year)
        : s.teammates;
      return { ...s, team: offer.team, classIdx, races, directive, salary, money, teammates: newTeammates, contractOffers: null, biddingWar: false, screen: "mylife_main", log };
    });
  }
  // v17: オフシーズンの過ごし方を確定する。年度末処理はpendingOffseasonに既に計算済みなので、
  // 選んだ効果をそこへ重ねてから結果画面へ進む
  function mlResolveOffseason(choiceIdx) {
    setMl(s => {
      const po = s.pendingOffseason;
      if (!po) return s;
      const choice = ML_OFFSEASON_CHOICES[choiceIdx];
      const player = choice.apply(po.player, po.year);
      return {
        ...s,
        pendingOffseason: { ...po, player },
        offseasonResultText: choice.result,
        screen: "mylife_offseason_result",
      };
    });
  }
  // オフシーズンの選択を終えたあとに、人生の岐路イベントの判定へ続ける（発生すればそちらへ、
  // なければそのままpendingOffseasonが持っていた本来の遷移先へ進む）
  function mlContinueAfterOffseason() {
    setMl(s => {
      const po = s.pendingOffseason;
      if (!po) return s;
      // v25: 恩師卒業の判定は「年が明けたあと」の年数を見る必要があるため、
      // 更新前のsではなく年度更新済みのpo（年度末処理の計算結果）を渡す
      const cr = mlRollCrossroads(po, po.player);
      if (cr) return { ...s, pendingOffseason: null, offseasonResultText: null, screen: "mylife_crossroads", pendingCrossroads: { key: cr.key, resolvedState: po } };
      return { ...po, pendingOffseason: null, offseasonResultText: null };
    });
  }
  // v15: 人生の岐路イベントの選択を確定する。年度末処理はpendingCrossroads.resolvedStateに
  // 既に計算済みなので、選んだ効果をそこへ重ねてから結果画面へ進む（時間は二重に進めない）
  function mlResolveCrossroads(choiceIdx) {
    setMl(s => {
      const pc = s.pendingCrossroads;
      if (!pc) return s;
      const cr = ML_CROSSROADS[pc.key];
      const choice = cr.choices[choiceIdx];
      const prevPlayer = pc.resolvedState.player;
      const { player, flags } = choice.apply(prevPlayer, s.flags || {});
      const note = choice.resultNote ? choice.resultNote(player, prevPlayer) : "";
      return {
        ...s,
        pendingCrossroads: { ...pc, resolvedState: { ...pc.resolvedState, player, flags } },
        crossroadsResultText: note ? `${choice.result}\n\n${note}` : choice.result,
        screen: "mylife_crossroads_result",
      };
    });
  }
  function mlContinueAfterCrossroads() {
    setMl(s => {
      const pc = s.pendingCrossroads;
      if (!pc) return s;
      return { ...pc.resolvedState, pendingCrossroads: null, crossroadsResultText: null };
    });
  }
  // v14.2: 私生活・取材イベント（練習/休養以外の月次アクション）
  function mlApplyEventEffects(player0, effects, year) {
    const player = { ...player0 };
    if (effects.fatigueDelta) player.fatigue = Math.max(0, Math.min(100, player.fatigue + effects.fatigueDelta));
    if (effects.abBoost) AB_KEYS.forEach(k => addAb(player, k, effects.abBoost, mlGrowthCap(year)));
    // v27: 個人スポンサー依頼イベント用。人気度も増減させられるようにする
    if (effects.popularityDelta) player.popularity = Math.max(0, Math.min(100, (player.popularity || 0) + effects.popularityDelta));
    return player;
  }
  function mlTriggerEvent() {
    const ev = ML_EVENTS[Math.floor(Math.random() * ML_EVENTS.length)];
    setMl(s => ({ ...s, pendingEvent: ev, screen: "mylife_event" }));
  }
  // v27: 個人スポンサーの依頼イベント。現在の人気度に応じて報酬が大きくなる仕事を1件生成する
  function mlTriggerSponsorGig() {
    setMl(s => {
      const pop = s.player.popularity || 0;
      const g0 = ML_SPONSOR_GIGS[Math.floor(Math.random() * ML_SPONSOR_GIGS.length)];
      const money = Math.round(g0.baseMoney + pop * g0.moneyPerPop);
      const gig = {
        title: g0.title, text: g0.text,
        choices: [
          { label: `引き受ける（+${money}万円・人気度+${g0.pop}・疲労+${g0.fatigue}）`, result: g0.acceptResult, effects: { moneyDelta: money, popularityDelta: g0.pop, fatigueDelta: g0.fatigue } },
          { label: "今回は辞退する", result: "今は競技に集中したいと、丁重に辞退した。", effects: { fatigueDelta: -3 } },
        ],
      };
      return { ...s, pendingEvent: gig, screen: "mylife_event" };
    });
  }
  function mlResolveEvent(choiceIdx) {
    setMl(s => {
      const ev = s.pendingEvent;
      if (!ev) return s;
      const choice = ev.choices[choiceIdx];
      const player = mlApplyEventEffects(s.player, choice.effects, s.year);
      const managerEval = Math.max(0, Math.min(100, s.managerEval + (choice.effects.managerEvalDelta || 0)));
      // v27: スポンサー依頼イベントの報酬（お金）を即時反映する
      const money = s.money + (choice.effects.moneyDelta || 0);
      return { ...s, player, money, managerEval, pendingEvent: null, eventResultText: choice.result, screen: "mylife_event_result" };
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
      if (it.formDelta) player.form = Math.max(0, Math.min(100, (player.form ?? 50) + it.formDelta));
      // v15フェーズ2: 成長力・成長タイプを1段階アップさせる消耗品
      if (it.growthPowUp) {
        const idx = GROWTHPOW_ORDER.indexOf(player.growthPow);
        if (idx >= 0 && idx < GROWTHPOW_ORDER.length - 1) player.growthPow = GROWTHPOW_ORDER[idx + 1];
      }
      if (it.growthShiftUp) {
        const idx = GROWTH_ORDER.indexOf(player.growth);
        if (idx >= 0 && idx < GROWTH_ORDER.length - 1) player.growth = GROWTH_ORDER[idx + 1];
      }
      return { ...s, player, stock: { ...s.stock, [k]: s.stock[k] - 1 } };
    });
  }
  // v20: 疲労が既に十分低い状態で回復アイテムを使うと、上限クランプで一部が無駄になる。
  // 気づかず使ってしまうのを防ぐため、無駄になる場合は先に確認ダイアログを挟む
  function mlUseStockConfirm(k) {
    const it = ML_STOCK_ITEMS[k];
    const player = ml.player;
    if (player && it.fatigueDelta && player.fatigue + it.fatigueDelta < 0) {
      const wasted = Math.round(Math.abs(player.fatigue + it.fatigueDelta));
      askConfirm(`疲労は現在${Math.round(player.fatigue)}です。${it.label}を使うと回復量の一部（約${wasted}）が無駄になります。それでも使いますか？`, () => mlUseStock(k));
      return;
    }
    if (player && it.formDelta && (player.form ?? 50) >= 92) {
      askConfirm(`フォームは既にほぼピーク（${Math.round(player.form ?? 50)}）です。${it.label}を使っても大半が無駄になります。それでも使いますか？`, () => mlUseStock(k));
      return;
    }
    mlUseStock(k);
  }
  // v27: 私設強化合宿。潤沢な資金を注ぎ込んで狙った能力（focus）を一気に引き上げる、
  // 繰り返し利用できる資金の使い道。成長キャップは通常の練習と共通なので、伸びしろが
  // 尽きた選手には効きにくい。疲労も溜まるので連打は難しい
  function mlPrivateCamp() {
    setMl(s => {
      const cost = mlPrivateCampCost(s);
      if (s.money < cost) return s;
      const growthCap = mlGrowthCap(s.year, s.player);
      const player = { ...s.player };
      const before = player[player.focus];
      addAb(player, player.focus, 6, growthCap);
      AB_KEYS.filter(k => k !== player.focus).forEach(k => addAb(player, k, 2, growthCap));
      player.fatigue = Math.min(100, player.fatigue + 12);
      const gained = Math.round((player[player.focus] - before) * 10) / 10;
      return {
        ...s, player, money: s.money - cost,
        log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】私設強化合宿を実施（-${cost}万円）。${AB_LABEL[player.focus]}を中心に鍛え上げた（${AB_LABEL[player.focus]}+${gained}）`],
      };
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
    const lv = g.staff[k] || 0;
    if (lv >= staffMax) return;
    setG(s => ({ ...s, staff: { ...s.staff, [k]: (s.staff[k] || 0) + 1 } }));
  };
  // v27: 引退選手のスタッフ登用。殿堂入りOBを月給制で専属コーチに迎える（1名まで）
  const hireObCoach = (hof) => {
    setG(s => ({
      ...s,
      obCoach: { id: hof.id, name: hof.name, type: hof.type, ab: TYPE_COACH_ABILITY[hof.type] || "flat" },
      log: [...s.log, `【${MONTHS[s.month]}】${hof.name}をOBコーチに迎えた（${AB_LABEL[TYPE_COACH_ABILITY[hof.type] || "flat"]}の練習効果+25%／月給-${OB_COACH_SALARY}万）`],
    }));
  };
  const dismissObCoach = () => {
    setG(s => ({ ...s, obCoach: null, log: [...s.log, `【${MONTHS[s.month]}】OBコーチとの契約を解消した`] }));
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
    if (g.inv.camp <= 0 || g.camp) return;
    // v22: クールダウンによる利用間隔の制限では「空けばすぐ使う」が最適解になり続けて
    // 「毎月使うのが前提」という印象は変わらなかったため、タイマーではなく実質的な負荷で
    // ブレーキをかける方式に変更。キャンプは全員の疲労を大きく消耗させる（+25）ため、
    // 連発するとレース前に疲労90超＝故障リスクゾーンへ突入しやすくなる。「今は無理をしても
    // いい月か」をプレイヤー自身が毎回判断する、意味のある選択にする
    setG(s => ({
      ...s, camp: true, inv: { ...s.inv, camp: s.inv.camp - 1 },
      roster: s.roster.map(r => ({ ...r, fatigue: Math.min(100, r.fatigue + 25) })),
    }));
  };
  // v13.1: お気に入り登録した選手は、殿堂入り条件（実績）を満たしていなくても必ず記録に残る
  const toggleFavorite = (rid) => {
    setG(s => ({ ...s, roster: s.roster.map(r => r.id === rid ? { ...r, favorite: !r.favorite } : r) }));
  };
  // v17: キャプテン制度。同じ選手をもう一度指名すると解任になる（1名まで）
  const setCaptain = (rid) => {
    setG(s => ({ ...s, captainId: s.captainId === rid ? null : rid }));
  };
  const releaseRider = (rid) => {
    if (g.month !== 0) return;
    setG(s => {
      if (s.roster.length <= 1) return s;
      const r = s.roster.find(x => x.id === rid);
      if (!r) return s;
      const roster = s.roster.filter(x => x.id !== rid);
      const captainId = s.captainId === rid ? null : s.captainId;
      // v13.1: 能力・将来性次第でライバルチームに拾われる。拾われた場合は殿堂入りさせず
      // rivalAlumniで追跡し、そのチームで出走を続けさせる（いずれ引退した時点で改めて判定）
      const pickedUp = Math.random() < computePickupChance(r);
      if (pickedUp) {
        const signedTeam = RIVAL_TEAMS[Math.floor(Math.random() * RIVAL_TEAMS.length)].name;
        const rivalAlumni = [...s.rivalAlumni, { ...r, signedTeam, signedYear: s.year }];
        return {
          ...s, roster, rivalAlumni, captainId,
          log: [...s.log, `【${MONTHS[s.month]}】${r.name} を解雇 → ${signedTeam}が獲得したとの噂`],
        };
      }
      // v13.1: 殿堂入りは一定の実績かお気に入り登録がある選手のみ（無条件だとキリがない）
      const hallOfFame = isHallOfFameWorthy(r)
        ? [...s.hallOfFame, { ...r, farewellYear: s.year, farewellReason: "released" }]
        : s.hallOfFame;
      return { ...s, roster, hallOfFame, captainId, log: [...s.log, `【${MONTHS[s.month]}】${r.name} を解雇した`] };
    });
  };
  // v25: ユース育成枠。4月のスカウト候補とは別に、年1回だけ安価な契約金で
  // 16〜17歳の若手を確保できる。現在の能力は低いが成長力（growthPow）はA以上を保証し、
  // 長期育成前提の「原石」枠として機能させる
  const signYouthProspect = () => {
    setG(s => {
      if (s.youthUsed || s.budget < 15) return s;
      const rng = mulberry(Date.now() % 999983 + s.roster.length * 4111);
      const banned = new Set(s.roster.map(r => r.name));
      const growthPow = rng() < 0.4 ? "S" : "A";
      const rookie = newRider(34, rng, { banned, age: 16 + Math.floor(rng() * 2), growthPow });
      return {
        ...s, roster: [...s.roster, rookie], budget: s.budget - 15, youthUsed: true,
        log: [...s.log, `【${MONTHS[s.month]}】ユース育成枠で${rookie.name}（${rookie.age}歳・成長力${growthPow}）を確保した`],
      };
    });
  };
  // v31.1: 血統ユース（配合）。マイライフ殿堂の2名を親に選び、配合の原石をユース枠で確保する。
  // 通常ユース（15万）より高価（40万）だが、相性・血の濃さ・累代+値・金特クロスの恩恵が乗る
  const signBredYouth = (legA, legB) => {
    setG(s => {
      if (s.youthUsed || s.budget < 40 || s.roster.length >= ROSTER_MAX_BY_CLASS[s.classIdx] || !legA || !legB) return s;
      const rng = mulberry(Date.now() % 999983 + s.roster.length * 7333);
      const banned = new Set(s.roster.map(r => r.name));
      const growthPow = rng() < 0.5 ? "S" : "A";
      const rookie = newRider(34, rng, { banned, age: 16 + Math.floor(rng() * 2), growthPow, type: legA.type });
      const breed = mlBreedBonus(legA, legB);
      AB_KEYS.forEach(k => { if (breed.abBonus[k]) rookie[k] = Math.min(96, (rookie[k] || 0) + breed.abBonus[k]); });
      SUB_STAT_KEYS.forEach(k => { if (breed.subBonus[k]) rookie[k] = Math.max(20, Math.min(95, (rookie[k] ?? 50) + breed.subBonus[k])); });
      let abils = [...(breed.goldInherit || []), ...(breed.exclusive || []), ...(rookie.abilities || [])];
      breed.extraAbilities.forEach(id => { if (id && ABILITIES[id] && !abils.includes(id)) abils.push(id); });
      abils = abils.filter((id, i) => abils.indexOf(id) === i);
      rookie.abilities = abils.slice(0, 5);
      if (breed.goldInherit && breed.goldInherit.length) { rookie.goldAbilities = [...(rookie.goldAbilities || [])]; breed.goldInherit.forEach(id => { if (rookie.abilities.includes(id) && !rookie.goldAbilities.includes(id)) rookie.goldAbilities.push(id); }); }
      // v33: 爆発力は伸びしろへ。ユースは元々成長力A/S＋才能キャップで大器化する
      if (breed.growthSteps) rookie.growthPow = bumpGrowthPow(rookie.growthPow, breed.growthSteps);
      else if (breed.growthBump) rookie.growthPow = bumpGrowthPow(rookie.growthPow, 1);
      rookie.talentCap = breed.talentCap || 0;
      rookie.bakuhatsu = breed.bakuhatsu || 0;
      rookie.matingGrade = breed.matingGrade || "D";
      // v33.4: 特殊配合。唯一無二の名血を確定発現
      let specialNote = "";
      if (breed.special) {
        const sm = breed.special;
        rookie.specialMating = { key: sm.key, title: sm.title, color: sm.color };
        rookie.talentCap = (rookie.talentCap || 0) + (sm.talent || 0);
        if (sm.growth) rookie.growthPow = bumpGrowthPow(rookie.growthPow, sm.growth);
        const goldId = sm.gold || (sm.factorGold ? ({ climb: "mount", sprint: "finisher", flat: "flatlander", solo: "soloist" }[legA.focus] || "engine") : null);
        if (sm.extra && ABILITIES[sm.extra] && !rookie.abilities.includes(sm.extra) && rookie.abilities.length < 6) rookie.abilities = [...rookie.abilities, sm.extra];
        if (goldId && ABILITIES[goldId]) {
          if (!rookie.abilities.includes(goldId) && rookie.abilities.length < 6) rookie.abilities = [...rookie.abilities, goldId];
          if (rookie.abilities.includes(goldId)) { rookie.goldAbilities = [...(rookie.goldAbilities || [])]; if (!rookie.goldAbilities.includes(goldId)) rookie.goldAbilities.push(goldId); }
        }
        specialNote = `・🌟${sm.title}`;
      }
      // v33.2: 危険度。濃い血の代償で稀にガラスの体を持って生まれる（頑丈を継いでいれば発症しない）
      rookie.matingDanger = breed.danger || 0;
      let fragileNote = "";
      if (breed.danger > 0 && !rookie.abilities.includes("tough") && !rookie.abilities.includes("glass") && rng() * 100 < breed.danger) {
        rookie.abilities = [...rookie.abilities, "glass"];
        rookie.fragileBorn = true;
        fragileNote = "・⚠️ガラスの体";
      }
      // v33.3: 系統確立ボーナス。名門系統を継ぐユースは因子（伸びしろ＋系統特能）を受け取る
      rookie.lineageName = legA.lineageName || `${legA.name}系`;
      let lineNote = "";
      const yblb = mlBloodlineBonus(rookie.lineageName);
      if (yblb) {
        rookie.bloodlineTier = yblb.tier;
        rookie.talentCap = (rookie.talentCap || 0) + yblb.talentCap;
        if (yblb.growthSteps) rookie.growthPow = bumpGrowthPow(rookie.growthPow, yblb.growthSteps);
        if (yblb.factor && ABILITIES[yblb.factor]) {
          if (!rookie.abilities.includes(yblb.factor) && rookie.abilities.length < 5) rookie.abilities = [...rookie.abilities, yblb.factor];
          if (yblb.factorGold && rookie.abilities.includes(yblb.factor)) { rookie.goldAbilities = [...(rookie.goldAbilities || [])]; if (!rookie.goldAbilities.includes(yblb.factor)) rookie.goldAbilities.push(yblb.factor); }
        }
        lineNote = `・🏛${yblb.label}`;
      }
      const goldNote = (breed.goldInherit && breed.goldInherit.length) ? `・✨金特クロス` : "";
      return {
        ...s, roster: [...s.roster, rookie], budget: s.budget - 40, youthUsed: true,
        log: [...s.log, `【${MONTHS[s.month]}】🧬 血統ユース：${legA.name}×${legB.name}の配合で${rookie.name}（${rookie.age}歳・成長力${rookie.growthPow}）を確保（${breed.nick.rank} ${breed.nick.label}${goldNote}${fragileNote}${lineNote}${specialNote}）`],
      };
    });
    setBreedYouthSel(null);
  };
  // v17: 選手間トレード。受け入れると自チームの該当選手が抜け、相手が提示した選手が加入する
  const acceptTrade = (offerId) => {
    setG(s => {
      const offer = (s.tradeOffers || []).find(o => o.id === offerId);
      if (!offer) return s;
      const outgoing = s.roster.find(r => r.id === offer.wantRiderId);
      if (!outgoing) return s;
      const incoming = { ...offer.offeredRider, id: RID++, tenure: 0, favorite: false, raceLog: [] };
      const roster = s.roster.filter(r => r.id !== offer.wantRiderId).concat(incoming);
      const captainId = s.captainId === offer.wantRiderId ? null : s.captainId;
      return {
        ...s, roster, captainId,
        tradeOffers: s.tradeOffers.filter(o => o.id !== offerId),
        log: [...s.log, `【${MONTHS[s.month]}】${offer.team}と選手交換トレード成立：${outgoing.name} → ${incoming.name}が加入`],
      };
    });
  };
  const declineTrade = (offerId) => {
    setG(s => ({ ...s, tradeOffers: (s.tradeOffers || []).filter(o => o.id !== offerId) }));
  };

  // ---- 共通 ----
  const Header = () => (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Eyebrow>{cls.label} — {g.year}年目 {MONTHS[g.month]}{g.dynastyLevel > 0 ? ` ／ 🔁 ディナスティ${g.dynastyLevel}周目` : ""}</Eyebrow>
          <div style={{ fontFamily: FONT_D, fontSize: 18, fontWeight: 700, color: C.text }}>{g.teamName || "あなたのチーム"}</div>
          {g.sponsor && <div style={{ fontSize: 10.5, color: C.sub }}>SPONSOR: {g.sponsor.name}（月+{g.sponsor.monthly}万／ノルマ{g.sponsor.norma}pt／未達-{g.sponsor.penalty}万／指定レース{g.sponsor.mandatesMet}済{g.sponsor.mandatesMissed > 0 ? `・見送り${g.sponsor.mandatesMissed}` : ""}）</div>}
          <div style={{ fontSize: 10.5, color: C.sub }}>
            選手維持費 -{g.roster.length * UPKEEP_PER_RIDER}万/月（{g.roster.length}名）
            {staffSalaryTotal(g.staff) > 0 && <>／スタッフ月給 -{staffSalaryTotal(g.staff)}万/月</>}
            {g.obCoach && <>／OBコーチ -{OB_COACH_SALARY}万/月</>}
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
  // v29: 選手名変更モーダル（wrap/mlWrap両方で表示する共用JSX）
  const commitRename = () => { const v = (renameState.value || "").trim(); if (v) renameState.onCommit(v); setRenameState(null); };
  const renameModal = renameState && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%", border: `1px solid ${C.line}` }}>
        <div style={{ color: C.text, fontSize: 14, marginBottom: 12 }}>{renameState.title}</div>
        <input type="text" autoFocus value={renameState.value} maxLength={12}
          onChange={e => setRenameState(s => ({ ...s, value: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter") commitRename(); }}
          style={{ width: "100%", boxSizing: "border-box", background: C.panel2, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FONT_B }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn small outline color={C.sub} onClick={() => setRenameState(null)}>キャンセル</Btn>
          <Btn small color={C.green} onClick={commitRename}>変更</Btn>
        </div>
      </div>
    </div>
  );
  const wrap = (children, withNav) => (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT_B }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "6px 14px 40px" }}>
        <Header />
        {withNav && <Nav />}
        {children}
      </div>
      {renameModal}
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
            <div style={{ fontSize: 11, color: C.sub }}>所持金{ml.money}万円・年俸{ml.salary}万円（生活費/税 -{mlLivingCost(ml)}万/月）</div>
          </div>
        )}
        {children}
      </div>
      {renameModal}
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
      <Btn outline color={"#e8a13c"} onClick={() => setSuperMode("prestige")}>🏆 生涯評価を見る</Btn>
    </div>
  );

  // v26: 生涯評価（プレステージスコア）。周回プレイをまたいで蓄積された記録を1画面に集約する
  if (superMode === "prestige") {
    const p = computePrestige();
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 22, borderTop: `4px solid ${"#e8a13c"}`, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <h2 style={{ fontFamily: FONT_D, color: "#e8a13c", fontSize: 26, margin: "8px 0" }}>生涯評価スコア</h2>
          <div style={{ fontFamily: FONT_M, fontSize: 32, color: C.text, fontWeight: 700 }}>{p.score.toLocaleString()}</div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>シーズンモード・マイライフモード両方のプレイ履歴から算出されます</div>
        </div>
        <div>
          <Eyebrow color={"#e8a13c"}>通算タイトル</Eyebrow>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, marginTop: 8, fontSize: 12.5, color: C.text, lineHeight: 1.8 }}>
            主要タイトル獲得数：<span style={{ color: "#e8a13c", fontFamily: FONT_M }}>{p.titleCount}回</span>（グランツール・グランファイナル・世界選手権・オリンピック）
          </div>
        </div>
        <div>
          <Eyebrow color={C.blue}>シーズンモード（周回プレイ）</Eyebrow>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, marginTop: 8, fontSize: 12.5, color: C.text, lineHeight: 1.8 }}>
            生涯獲得クリアポイント：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.totalEarnedCP}pt</span>
          </div>
        </div>
        <div>
          <Eyebrow color={C.red}>マイライフモード（歴代選手）</Eyebrow>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, fontSize: 12.5, color: C.text }}>
              引退した選手数：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.legendCount}名</span>
            </div>
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, fontSize: 12.5, color: C.text }}>
              通算勝利数：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.mlWins}勝</span>／通算表彰台：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.mlPodiums}回</span>
            </div>
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, fontSize: 12.5, color: C.text }}>
              通算実績達成数：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.mlAchieved}</span>
            </div>
          </div>
        </div>
        <Btn outline color={C.sub} onClick={() => setSuperMode(null)}>← モード選択に戻る</Btn>
      </div>
    );
  }

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
          {(() => {
            const legends = loadMlLegends();
            if (legends.length === 0) return null;
            const idx = ml.masterIdx ?? -1;
            const master = idx >= 0 ? legends[idx] : null;
            const inh = master ? protegeInherit(master) : null;
            return (
              <div>
                <Eyebrow color={C.purple}>師匠（歴代の名選手に師事・任意）</Eyebrow>
                <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 6px" }}>過去に殿堂入りした選手の教え子としてデビューできます。師の得意能力や特殊能力・成長力の一部を受け継ぎます。</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <button onClick={() => setMl(s => ({ ...s, masterIdx: -1 }))}
                    style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                      background: idx === -1 ? "rgba(255,210,63,0.12)" : C.panel, border: `1.5px solid ${idx === -1 ? C.yellow : C.line}` }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>師事しない（通常のデビュー）</span>
                  </button>
                  {legends.map((leg, i) => (
                    <button key={i} onClick={() => setMl(s => ({ ...s, masterIdx: i }))}
                      style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                        background: idx === i ? "rgba(201,139,240,0.14)" : C.panel, border: `1.5px solid ${idx === i ? C.purple : C.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{leg.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>（{TYPES[leg.type]?.label || leg.type}）</span></span>
                        <span style={{ fontSize: 10.5, color: C.sub }}>{leg.wins || 0}勝/{leg.podiums || 0}表彰台</span>
                      </div>
                      {leg.nickname && <div style={{ fontSize: 11, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{leg.nickname}」</div>}
                    </button>
                  ))}
                </div>
                {inh && (
                  <div style={{ background: C.panel2, borderRadius: 8, padding: "8px 10px", marginTop: 8, fontSize: 11.5, color: C.text, lineHeight: 1.7 }}>
                    <div><span style={{ color: C.purple, fontWeight: 700 }}>師の教え：</span>{inh.teaching.label}<span style={{ color: C.sub, fontSize: 10.5 }}>（{inh.teaching.desc}）</span></div>
                    <div>
                      <span style={{ color: C.purple, fontWeight: 700 }}>継承：</span>
                      {Object.entries(inh.abBonus).map(([k, v]) => `${AB_LABEL[k]}+${v}`).join(" / ")}
                      {inh.subBonus && Object.entries(inh.subBonus).map(([k, v]) => `・${SUB_STAT_LABEL[k]}${v >= 0 ? "+" : ""}${v}`).join("")}
                      {inh.growthPowBump && "・成長力+1段階"}
                      <span style={{ color: C.yellow }}>・継承特性「{ABILITIES[inh.lineageTrait].label}」</span>
                      {inh.inheritAbility && `・特殊能力「${ABILITIES[inh.inheritAbility].label}」`}
                    </div>
                  </div>
                )}
                {/* v31: 配合相手（2人目の親）。師匠を選んでいる時だけ表示する */}
                {master && legends.length >= 2 && (() => {
                  const pIdx = ml.partnerIdx ?? -1;
                  const partner = (pIdx >= 0 && pIdx !== idx) ? legends[pIdx] : null;
                  const breed = partner ? mlBreedBonus(master, partner) : null;
                  const nickColor = breed ? (breed.nick.rank === "◎" ? C.yellow : breed.nick.rank === "○" ? C.green : C.sub) : C.sub;
                  return (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                      <Eyebrow color={"#e56cc8"}>🧬 配合相手（もう一人の親・任意）</Eyebrow>
                      <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 6px" }}>師匠に加えて2人目の親を選ぶと「配合」になり、両方の血を引く逸材が生まれます。脚質の相性（ニック◎○△）、共通の祖先による血の濃さ（インブリード）、代を重ねるほど蓄積する+値が乗ります。</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <button onClick={() => setMl(s => ({ ...s, partnerIdx: -1 }))}
                          style={{ textAlign: "left", padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                            background: pIdx === -1 ? "rgba(255,210,63,0.12)" : C.panel, border: `1.5px solid ${pIdx === -1 ? C.yellow : C.line}` }}>
                          <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>配合しない（師事のみ）</span>
                        </button>
                        {legends.map((leg, i) => i === idx ? null : (
                          <button key={i} onClick={() => setMl(s => ({ ...s, partnerIdx: i }))}
                            style={{ textAlign: "left", padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                              background: pIdx === i ? "rgba(229,108,200,0.16)" : C.panel, border: `1.5px solid ${pIdx === i ? "#e56cc8" : C.line}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{leg.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>（{TYPES[leg.type]?.label || leg.type}）</span></span>
                              <span style={{ fontSize: 10.5, color: C.sub }}>{(leg.generation || 0) > 0 ? `${leg.generation}代目・` : ""}+{leg.plusValue || 0}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      {breed && (
                        <div style={{ background: "linear-gradient(180deg,#2e2436,#241d2c)", borderRadius: 8, padding: "9px 11px", marginTop: 8, fontSize: 11.5, color: C.text, lineHeight: 1.7, border: `1px solid #e56cc8` }}>
                          {breed.special && (
                            <div style={{ background: "linear-gradient(90deg,#3a2f10,#2b2410)", border: `1px solid ${breed.special.color}`, borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
                              <div style={{ color: breed.special.color, fontWeight: 800, fontSize: 12.5 }}>🌟 特殊配合『{breed.special.title}』</div>
                              <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>{breed.special.note}</div>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: "#e56cc8" }}>配合評価</span>
                            <span style={{ fontFamily: FONT_M, fontWeight: 800, fontSize: 17, color: mlGradeColor(breed.matingGrade), textShadow: "0 0 6px rgba(0,0,0,.4)" }}>{breed.matingGrade}</span>
                            <span style={{ fontSize: 10.5, color: C.sub }}>爆発力 <span style={{ fontFamily: FONT_M, color: C.yellow }}>{breed.bakuhatsu}</span></span>
                          </div>
                          <div style={{ fontSize: 10.5, color: "#9ae6b4", marginBottom: 3 }}>
                            {breed.growthSteps > 0 && `成長力+${breed.growthSteps}段`}{breed.growthSteps > 0 && breed.talentCap > 0 && "・"}{breed.talentCap > 0 && `才能キャップ+${breed.talentCap}`}{(breed.growthSteps > 0 || breed.talentCap > 0) ? "（生まれた時は普通でも育てると化ける）" : "素質は平凡（配合の質を上げると化ける）"}
                          </div>
                          {breed.danger > 0 && (
                            <div style={{ fontSize: 10.5, color: breed.danger >= 38 ? C.red : "#e8a13c", marginBottom: 3 }}>
                              ⚠️ 危険度 <span style={{ fontWeight: 700 }}>{breed.dangerLabel}</span>（約{breed.danger}%）：稀に「ガラスの体」を持って生まれる{breed.healthMit > 0 ? "／健康な血で軽減済" : "。頑丈・鉄人の血を持つ親で軽減できる"}
                            </div>
                          )}
                          <div><span style={{ fontWeight: 700, color: "#e56cc8" }}>配合相性：</span><span style={{ color: nickColor, fontWeight: 700 }}>{breed.nick.rank} {breed.nick.label}</span></div>
                          <div><span style={{ fontWeight: 700, color: "#e56cc8" }}>血統ボーナス：</span>
                            累代+値 <span style={{ color: C.yellow }}>+{breed.plusPer}</span>
                            {breed.inbreed.count > 0 && <span style={{ color: C.red }}>・🩸インブリード×{breed.inbreed.count}（血が濃い！）</span>}
                            {breed.generation > 1 && `・${breed.generation}代目`}
                          </div>
                          <div><span style={{ fontWeight: 700, color: "#e56cc8" }}>受け継ぐ特能：</span>
                            {breed.extraAbilities.length > 0 ? breed.extraAbilities.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・") : "—"}
                          </div>
                          {breed.goldInherit && breed.goldInherit.length > 0 && (
                            <div style={{ color: C.yellow, fontWeight: 700 }}>✨ 金特クロス：{breed.goldInherit.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")}（最初から金特！）</div>
                          )}
                          {breed.exclusive && breed.exclusive.length > 0 && (
                            <div style={{ color: "#e56cc8", fontWeight: 700 }}>🩸 配合限定特能：{breed.exclusive.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")}</div>
                          )}
                          <div><span style={{ fontWeight: 700, color: "#e56cc8" }}>継承する系統：</span>{master.lineageName || `${master.name}系`}
                            {(() => { const rec = loadBloodlines()[master.lineageName || `${master.name}系`]; const t = rec ? mlBloodlineTier(rec) : null; if (!t || t.tier <= 0) return null; const fac = mlBloodlineFactor(rec); return <span style={{ color: "#e8a13c", fontWeight: 700 }}>　🏛{t.label}系統（因子：伸びしろ+{t.tier}{fac ? `・${ABILITIES[fac]?.label || fac}` : ""}{t.tier >= 3 ? "★金" : ""}）</span>; })()}
                          </div>
                          {breed.archNotes && breed.archNotes.length > 0 && (
                            <div style={{ color: "#e8a13c" }}>🩸 血の格：{breed.archNotes.join("・")}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}
          <Btn onClick={() => {
            const legends = loadMlLegends();
            const mIdx = ml.masterIdx ?? -1;
            const master = mIdx >= 0 ? legends[mIdx] : null;
            const pIdx = ml.partnerIdx ?? -1;
            const partner = (master && pIdx >= 0 && pIdx !== mIdx) ? legends[pIdx] : null;
            const doCreate = () => { clearMyLifeSave(); mlCreateChar(ml.typeChoice, ml.bgChoice, master, partner); };
            if (hasMyLifeSave()) askConfirm("保存データを消して新しい選手でキャリアを始めます。よろしいですか？", doCreate);
            else doCreate();
          }}>この内容でデビュー →</Btn>
          <Btn outline color={C.purple} onClick={() => setMl(s => ({ ...s, screen: "mylife_legends" }))}>🏛 歴代選手の殿堂を見る</Btn>
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
              <span style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>{r.name}
                <button onClick={() => openRename("あなたの選手名を変更", r.name, v => setMl(s => {
                  const p = s.player;
                  // v33.7: 自分が始祖の系統（＝自分の名前から生まれた系統）は改名に追従させる。
                  // 師匠・配合で継いだ系統名は先祖の名なのでそのまま維持する
                  const isFounderLineage = !!p.lineageName && p.lineageName === `${p.name}系`;
                  return { ...s, player: { ...p, name: v, lineageName: isFounderLineage ? `${v}系` : p.lineageName } };
                }))} title="名前を変更" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, marginLeft: 4, padding: 0, opacity: 0.7 }}>✏️</button>
              </span>
              <div style={{ fontFamily: FONT_M, fontSize: 14, color: C.yellow }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></div>
            </div>
            {riderNickname(r) && <div style={{ fontSize: 12, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{riderNickname(r)}」</div>}
            {r.master && <div style={{ fontSize: 11, color: C.purple, marginTop: 1 }}>🎓 {r.master}の教え子{r.teaching ? `・師の教え「${r.teaching}」` : ""}</div>}
            {r.partner && <div style={{ fontSize: 11, color: "#e56cc8", marginTop: 1 }}>🧬 {r.master}×{r.partner}の配合{(r.generation || 0) > 1 ? `・${r.generation}代目` : ""}{(r.plusValue || 0) > 0 ? `・累代+${Math.min(15, r.plusValue)}` : ""}</div>}
            {r.lineageName && <div style={{ fontSize: 10.5, color: "#c98bf0", marginTop: 1 }}>🩸 {r.lineageName}{r.bloodlineTier ? `　🏛${["", "確立", "名門", "大系統"][r.bloodlineTier]}系統` : ""}</div>}
            {r.specialMating && <div style={{ fontSize: 10.5, color: r.specialMating.color || C.yellow, fontWeight: 700, marginTop: 1 }}>🌟 特殊配合『{r.specialMating.title}』</div>}
            <PersonaLine p={r.personality} />
            <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
            <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.sub, margin: "4px 0", flexWrap: "wrap" }}>
              <span>{r.age}歳・{GROWTH[r.growth].label}・<span style={{ color: ph.tag === "全盛期" ? C.yellow : ph.tag === "衰え期" ? C.red : C.green }}>{ph.tag}</span></span>
              <span>成長<span style={{ color: POW[r.growthPow].color }}>{r.growthPow}</span></span>
              {(() => { const pot = potentialHint(r); return <span style={{ color: pot.color }}>{pot.label}</span>; })()}
              {ml.flags?.married && <span style={{ color: C.purple }}>💍 既婚</span>}
            </div>
            <div style={{ fontSize: 10.5, color: C.sub }}>疲労（90超で故障リスク・60未満なら急いで回復させる必要はありません）</div>
            <FatigueBar v={r.fatigue} />
            {(() => {
              const form = r.form ?? 50;
              const fc = form >= 80 ? C.yellow : form >= 62 ? C.green : form >= 40 ? C.sub : "#c86";
              const fl = form >= 80 ? "ピーク" : form >= 62 ? "好調" : form >= 40 ? "平常" : "低調";
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 10.5, color: C.sub }}>フォーム（好不調）<CondFc dir={r.formForecast} /></span>
                  <div style={{ flex: 1, height: 5, background: C.line, borderRadius: 3 }}><div style={{ width: `${form}%`, height: 5, background: fc, borderRadius: 3 }} /></div>
                  <span style={{ fontFamily: FONT_M, fontSize: 11, color: fc, width: 58, textAlign: "right" }}>{Math.round(form)}・{fl}</span>
                </div>
              );
            })()}
            <AbilityGrid r={r} cap={mlGrowthCap(ml.year, r)} />
            <SubStatLine r={r} />
            <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>能力{mlGrowthCap(ml.year, r)}以上＝限界突破（伸びの上限は経験を積むほど毎年じわじわ上がっていきます）{r.talentCap ? `／才能キャップ+${r.talentCap}` : ""}</div>
            {/* v30: フレーバーテキストは特能と能力値の間に挟まって視認性を損ねていたため、
                カード末尾の独立したプロフィール欄（区切り線付き）に移動した */}
            <div style={{ fontSize: 11, color: C.sub, fontStyle: "italic", marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.line}`, lineHeight: 1.5 }}>{riderFlavorText(r)}</div>
            {(ml.stock.drink > 0 || ml.stock.supp > 0 || ml.stock.tune > 0) && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {ml.stock.drink > 0 && <Btn small outline color={C.green} onClick={() => mlUseStockConfirm("drink")}>{ML_STOCK_ITEMS.drink.label}(-30) ×{ml.stock.drink}</Btn>}
                {ml.stock.supp > 0 && <Btn small outline color={C.green} onClick={() => mlUseStockConfirm("supp")}>{ML_STOCK_ITEMS.supp.label}(-60) ×{ml.stock.supp}</Btn>}
                {ml.stock.tune > 0 && <Btn small outline color={C.green} onClick={() => mlUseStockConfirm("tune")}>{ML_STOCK_ITEMS.tune.label}(フォーム+12) ×{ml.stock.tune}</Btn>}
              </div>
            )}
          </div>
          {/* v30/v31.5: 世界ランキング＆キャリア・アンビション（生き方＝路線で目標が分岐） */}
          {(() => {
            const tier = worldRankTier(ml.worldRank);
            const path = mlAmbitionPath(ml);
            const amb = mlCurrentAmbition(ml);
            const idx = ml.ambitionIdx || 0;
            return (
              <div style={{ background: "linear-gradient(180deg,#2a2740,#22202f)", borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.purple}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Eyebrow color={C.purple}>🌍 世界ランキング＆アンビション</Eyebrow>
                  <Btn small outline color={C.green} onClick={() => setMl(s => ({ ...s, screen: "mylife_ranking" }))}>📊 ランキングを見る</Btn>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 5 }}>
                  <span style={{ fontFamily: FONT_D, fontSize: 13.5, color: C.text }}>
                    世界ランク <span style={{ fontFamily: FONT_M, fontSize: 18, color: tier.color, fontWeight: 700 }}>{ml.worldRank == null ? "—" : `${ml.worldRank}位`}</span>
                    <span style={{ fontSize: 11, color: tier.color, marginLeft: 6 }}>{tier.label}</span>
                  </span>
                  <span style={{ fontSize: 10.5, color: C.sub, fontFamily: FONT_M }}>{Math.round(ml.worldPoints || 0)}pt{ml.worldRankBest != null ? `／自己最高 ${ml.worldRankBest}位` : ""}</span>
                </div>
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: path.color, fontWeight: 700 }}>{path.icon} {path.label}</span>
                    <button onClick={() => setMl(s => ({ ...s, showPathChooser: !s.showPathChooser }))} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 6, color: C.sub, cursor: "pointer", fontSize: 10, padding: "2px 8px" }}>🔀 生き方を変える</button>
                  </div>
                  {ml.showPathChooser && (
                    <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
                      {ML_AMBITION_PATH_KEYS.map(pk => { const p = ML_AMBITION_PATHS[pk]; const cur = (ml.ambitionPath || "victory") === pk; return (
                        <button key={pk} onClick={() => setMl(s => ({ ...s, ambitionPath: pk, ambitionIdx: mlFirstUnmetRung(s, pk), showPathChooser: false }))}
                          style={{ textAlign: "left", padding: "6px 9px", borderRadius: 8, cursor: "pointer", background: cur ? "rgba(255,210,63,0.1)" : C.panel, border: `1.5px solid ${cur ? p.color : C.line}` }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: p.color }}>{p.icon} {p.label}{cur ? "（選択中）" : ""}</div>
                          <div style={{ fontSize: 10, color: C.sub }}>{p.desc}</div>
                        </button>
                      ); })}
                    </div>
                  )}
                  {amb ? (
                    <>
                      <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>🎯 いま目指す目標</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
                        <span style={{ fontFamily: FONT_D, fontSize: 13, color: "#e8a13c", fontWeight: 700 }}>{amb.label}</span>
                        <span style={{ fontFamily: FONT_M, fontSize: 12, color: C.text }}>{mlAmbitionProgressText(ml, amb)}</span>
                      </div>
                      <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>達成報酬：{[amb.reward.money ? `資金+${amb.reward.money}万` : null, amb.reward.pop ? `人気+${amb.reward.pop}` : null, amb.reward.ab ? `全能力+${amb.reward.ab}` : null, amb.reward.growth ? "成長力UP" : null].filter(Boolean).join("・")}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: C.yellow, fontWeight: 700, marginTop: 6 }}>🏆 「{path.label}」を極めた！別の生き方に挑戦できます</div>
                  )}
                  <div style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>{path.label}の達成度 {Math.min(idx, path.rungs.length)} / {path.rungs.length}</div>
                </div>
              </div>
            );
          })()}
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
          {ml.flags?.mentorActive && (
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.green}` }}>
              <Eyebrow color={C.green}>🧑‍🏫 恩師の指導</Eyebrow>
              <div style={{ fontSize: 11.5, color: C.text, marginTop: 4 }}>{ml.flags.mentorName}が新人指導中（練習・出走経験の伸び+15%）</div>
              <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>3年目を迎えると一区切りを迎えます</div>
            </div>
          )}
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
            <Eyebrow color={"#e8a13c"}>個人スポンサー・人気度</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>
              人気度 <span style={{ fontFamily: FONT_M, color: "#e8a13c", fontWeight: 700 }}>{Math.round(ml.player.popularity || 0)}</span>/100
              （個人スポンサー収入 月+{Math.floor((ml.player.popularity || 0) / 10) * 2}万円）
            </div>
            <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>好成績を残すほど上がり、25/50/75/100到達で一時金の契約ボーナスも入ります</div>
          </div>
          {ml.rival && (
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.red}` }}>
              <Eyebrow color={C.red}>ライバル</Eyebrow>
              <div style={{ fontFamily: FONT_D, fontSize: 14, color: C.text, margin: "4px 0 2px" }}>{ml.rival.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>（{ml.rival.team}・{TYPES[ml.rival.type].label}）</span></div>
              <div style={{ fontSize: 11, color: C.sub }}>
                通算対戦成績：{ml.rivalRecord?.meetings || 0}戦 <span style={{ color: C.green }}>{ml.rivalRecord?.wins || 0}勝</span> <span style={{ color: C.red }}>{ml.rivalRecord?.losses || 0}敗</span>
              </div>
              {race.rivalPresent && <div style={{ fontSize: 11, color: C.yellow, marginTop: 3 }}>🔥 今月のレースにライバルも出走してくる</div>}
            </div>
          )}
          {/* v26: 複数ライバル制。2人目の好敵手は初対戦を終えるまでは表示しない（サプライズを残す） */}
          {ml.rival2 && (ml.rivalRecord2?.meetings || 0) > 0 && (
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.blue}` }}>
              <Eyebrow color={C.blue}>好敵手</Eyebrow>
              <div style={{ fontFamily: FONT_D, fontSize: 14, color: C.text, margin: "4px 0 2px" }}>{ml.rival2.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>（{ml.rival2.team}・{TYPES[ml.rival2.type].label}）</span></div>
              <div style={{ fontSize: 11, color: C.sub }}>
                通算対戦成績：{ml.rivalRecord2?.meetings || 0}戦 <span style={{ color: C.green }}>{ml.rivalRecord2?.wins || 0}勝</span> <span style={{ color: C.red }}>{ml.rivalRecord2?.losses || 0}敗</span>
              </div>
              {race.rival2Present && <div style={{ fontSize: 11, color: C.blue, marginTop: 3 }}>🔥 今月のレースに好敵手も出走してくる</div>}
            </div>
          )}
          <div>
            <Eyebrow>今月の練習メニュー</Eyebrow>
            <select value={r.focus} onChange={e => mlSetFocus(e.target.value)}
              style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px", fontSize: 13, marginTop: 6 }}>
              {AB_KEYS.map(k => <option key={k} value={k}>{AB_LABEL[k]}強化</option>)}
            </select>
          </div>
          <div style={{
            background: race.milestone ? "#2b2436" : C.panel, borderRadius: 10, padding: "10px 12px",
            border: `1.5px solid ${race.milestone ? ML_MILESTONE_LABEL[race.milestone].color : C.line}`,
          }}>
            <Eyebrow color={race.milestone ? ML_MILESTONE_LABEL[race.milestone].color : C.green}>{race.milestone ? ML_MILESTONE_LABEL[race.milestone].eyebrow : "今月のレース"}</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 14, color: C.text, margin: "4px 0" }}>{race.name}</div>
            <div style={{ fontSize: 11.5, color: C.sub }}>{race.tmpl.kind}・{"★".repeat(race.grade)}・{TYPES[race.tmpl.favors].label}有利</div>
            {race.weather && race.weather !== "clear" && (
              <div style={{ fontSize: 11.5, color: race.weather === "rain" ? C.blue : C.red, marginTop: 2 }}>
                {WEATHER[race.weather].icon} 天候：{WEATHER[race.weather].label}
                {race.weather === "rain" ? "（悪天候巧者がないと能力低下・落車リスク増）" : "（出走後の疲労蓄積が増える）"}
              </div>
            )}
            {race.milestone && <div style={{ fontSize: 11, color: ML_MILESTONE_LABEL[race.milestone].color, marginTop: 3 }}>代表選出！一生に何度もない大舞台での一戦だ。</div>}
            {race.milestone && (() => {
              // v28: 代表チームでの立場。監督評価に応じてエース／アシストの役割が示される
              const natRole = (race.nationalRole || (ml.managerEval >= 55 ? "ace" : "support"));
              return (
                <div style={{ fontSize: 11, color: natRole === "ace" ? C.yellow : C.blue, marginTop: 3 }}>
                  🎌 代表での役割：<b>{natRole === "ace" ? "エース（3位以内で任務達成）" : "アシスト（10位以内で任務達成）"}</b>。全うすれば名声が大きく上がります。
                </div>
              );
            })()}
            {/* v27: 天候予報。今月を含む先の月の天候を先読みして育成計画に活かせるようにする */}
            <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span>天候予報：</span>
              {[0, 1, 2].map(off => {
                const mi = ml.month + off;
                if (mi > 11) return null;
                const fr = mlGenRace(ml.year, mi, ml.classIdx);
                const w = fr.weather || "clear";
                return (
                  <span key={off} style={{ color: w === "rain" ? C.blue : w === "heat" ? C.red : C.sub }}>
                    {MONTHS[mi]}{off === 0 ? "(今)" : ""} {WEATHER[w].icon}
                  </span>
                );
              })}
            </div>
          </div>
          {/* v28: 縦積みになりすぎたボタン群を「今月のアクション（月を消費）」「メニュー（画面表示）」
              「その他・キャリア管理」の3グループに整理。二次的なものは折り返す小ボタンにまとめる */}
          <div style={{ display: "grid", gap: 8 }}>
            <Eyebrow color={C.green}>🎬 今月のアクション（1つ選ぶと1ヶ月進みます）</Eyebrow>
            {/* v31.2: アクションが下部にあり疲労・調子を確認しながら選べないという指摘に対応。
                行動選択の直前に、判断材料（疲労・調子・フォーム・OVR）の要約を再掲する */}
            <div style={{ background: C.panel2, borderRadius: 8, padding: "6px 10px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", fontSize: 11 }}>
              <span style={{ color: C.sub }}>選択の目安 ▶</span>
              <span>疲労 <b style={{ color: r.fatigue > 90 ? C.red : r.fatigue > 60 ? "#e8a13c" : C.green, fontFamily: FONT_M }}>{Math.round(r.fatigue)}</b></span>
              <span>フォーム <b style={{ color: (r.form ?? 50) >= 80 ? C.yellow : (r.form ?? 50) >= 62 ? C.green : C.sub, fontFamily: FONT_M }}>{Math.round(r.form ?? 50)}</b><CondFc dir={r.formForecast} /></span>
              <span>OVR <b style={{ color: C.yellow, fontFamily: FONT_M }}>{overall(r)}</b></span>
            </div>
            {/* v32（条件付き作戦＝ノーリスク無線）：出走前に作戦を選ぶと、結果に実際に反映される */}
            <div style={{ background: C.panel2, borderRadius: 8, padding: "7px 10px" }}>
              <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>📻 レース作戦（結果に反映されます）</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {Object.entries(ML_TACTICS).map(([k, t]) => (
                  <button key={k} onClick={() => setMl(s => ({ ...s, tactic: k }))} title={t.desc}
                    style={{ padding: "4px 8px", borderRadius: 8, cursor: "pointer", fontSize: 10.5, fontWeight: 700,
                      background: (ml.tactic || "balanced") === k ? "rgba(255,210,63,0.14)" : C.panel, color: (ml.tactic || "balanced") === k ? C.yellow : C.sub,
                      border: `1.5px solid ${(ml.tactic || "balanced") === k ? C.yellow : C.line}` }}>{t.label}</button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>{(ML_TACTICS[ml.tactic] || ML_TACTICS.balanced).desc}</div>
            </div>
            <Btn onClick={mlStartRace}>🏁 このレースに出場する</Btn>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Btn small outline color={C.sub} onClick={() => mlAdvanceMonth("train")}>💪 練習（focus中心）</Btn>
              <Btn small outline color={C.sub} onClick={() => mlAdvanceMonth("rest")}>😴 完全休養</Btn>
              <Btn small outline color={"#e8a13c"} onClick={() => mlAdvanceMonth("peak")}>🎯 ピーキング調整（フォームを上げる）</Btn>
              <Btn small outline color={C.purple} onClick={mlTriggerEvent}>🎤 取材・私生活イベント</Btn>
              {(ml.player.popularity || 0) >= 20 && (
                <Btn small outline color={"#e8a13c"} onClick={mlTriggerSponsorGig}>📸 スポンサーの仕事</Btn>
              )}
            </div>
            <div style={{ background: C.panel2, borderRadius: 10, padding: "8px 10px" }}>
              <Eyebrow color={C.blue}>🎯 専門トレーニング（狙いを絞って強化・1ヶ月消費）</Eyebrow>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {Object.entries(ML_SPECIAL_TRAINING).map(([k, sp]) => (
                  <Btn key={k} small outline color={C.blue} onClick={() => mlAdvanceMonth(k)} title={sp.desc}>{sp.label}</Btn>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Eyebrow color={C.sub}>📂 メニュー（開くだけ・月は進みません）</Eyebrow>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              <Btn small outline color={"#e8a13c"} onClick={() => setMl(s => ({ ...s, screen: "mylife_shop" }))}>🛍 ショップ</Btn>
              <Btn small outline color={C.yellow} onClick={() => setMl(s => ({ ...s, screen: "mylife_achievements" }))}>🏆 実績 {computeAchievements(ml).filter(a => a.achieved).length}/{ML_ACHIEVEMENTS.length}</Btn>
              <Btn small outline color={C.green} onClick={() => setMl(s => ({ ...s, screen: "mylife_teamroster" }))}>👥 チーム名鑑</Btn>
              <Btn small outline color={C.blue} onClick={() => setMl(s => ({ ...s, screen: "mylife_graph" }))}>📈 キャリアグラフ</Btn>
              <Btn small outline color={C.purple} onClick={() => setMl(s => ({ ...s, screen: "mylife_abilityfile" }))}>🗂 特殊能力図鑑</Btn>
              <Btn small outline color={"#e8a13c"} onClick={() => setMl(s => ({ ...s, screen: "mylife_records" }))}>🏅 コースレコード</Btn>
              <Btn small outline color={C.blue} onClick={() => setMl(s => ({ ...s, screen: "mylife_help" }))}>📖 ヘルプ</Btn>
            </div>
          </div>
          <div>
            <Eyebrow color={C.sub}>⚙ その他・キャリア管理</Eyebrow>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, alignItems: "center" }}>
              {ml.flags?.mentor
                ? <span style={{ fontSize: 11.5, color: C.yellow }}>🎖 チームの精神的支柱（毎月疲労-3／評価+0.3）</span>
                : r.age >= 30 && (
                  <Btn small outline color={C.yellow} onClick={() => askConfirm("若手のメンターになりますか？（毎月の疲労回復と監督評価の伸びが恒常的に上がります。一度なると元には戻せません）", mlBecomeMentor)}>🎖 メンターになる</Btn>
                )}
              <Btn small outline color={"#e8a13c"} onClick={() => askConfirm(`ラストレースに出場してから引退しますか？あなたの脚質に合ったグレード4のエキシビションで、ライバルたちも駆けつける最高の舞台です。走り終えるとそのまま引退となります。`, mlStartLastRace)}>🏁 ラストレースで引退</Btn>
              <Btn small outline color={C.red} onClick={() => askConfirm(`${r.age}歳で現役を引退しますか？この操作は取り消せません（キャリアの記録はセレモニー画面で振り返れます）。`, () => { mlRecordLegend(ml); setMl(s => ({ ...s, screen: "mylife_retired" })); })}>🚪 静かに引退</Btn>
              <Btn small outline color={C.red} onClick={() => askConfirm("マイライフを最初からやり直しますか？現在の選手の保存データは消えます（歴代の殿堂記録は残ります）。", () => { clearMyLifeSave(); setMl(initMyLife()); })}>🔄 最初からやり直す</Btn>
              <Btn small outline color={C.sub} onClick={() => askConfirm("マイライフモードを終了してタイトルに戻りますか？（自動セーブ済み）", () => setSuperMode(null))}>← タイトルに戻る</Btn>
            </div>
          </div>
        </div>
      );
    }

    if (ml.screen === "mylife_achievements" && ml.player) {
      const achievements = computeAchievements(ml);
      const achievedCount = achievements.filter(a => a.achieved).length;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.yellow}` }}>
            <Eyebrow color={C.yellow}>🏆 実績</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 18, color: C.text, margin: "4px 0" }}>{achievedCount} / {achievements.length} 達成</div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {achievements.map(a => (
              <div key={a.id} style={{
                background: a.achieved ? "rgba(255,210,63,0.1)" : C.panel, borderRadius: 10, padding: "10px 12px",
                border: `1.5px solid ${a.achieved ? C.yellow : C.line}`, opacity: a.achieved ? 1 : 0.55,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 22 }}>{a.achieved ? a.icon : "🔒"}</span>
                <div>
                  <div style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 13.5, color: a.achieved ? C.yellow : C.text }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>{a.desc}</div>
                  {formatAchievementReward(a) && <div style={{ fontSize: 10.5, color: C.green, marginTop: 1 }}>{formatAchievementReward(a)}</div>}
                </div>
              </div>
            ))}
          </div>
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_abilityfile") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <Eyebrow color={C.purple}>🗂 特殊能力図鑑</Eyebrow>
        <AbilityFileList file={loadAbilityFile()} />
        <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
      </div>
    );

    // v27: コースレコード一覧（シーズンモードと共有の永続記録）
    if (ml.screen === "mylife_records") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <Eyebrow color={"#e8a13c"}>👑 通算タイトル</Eyebrow>
        <TitlesPanel />
        <Eyebrow color={"#e8a13c"}>🏅 コースレコード</Eyebrow>
        <CourseRecordsPanel />
        <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
      </div>
    );

    // v25: マイライフ専用ヘルプ。毎月のアクションから細かな仕様まで一覧できるようにする
    if (ml.screen === "mylife_help") {
      const Section = ({ color, title, children }) => (
        <div>
          <Eyebrow color={color}>{title}</Eyebrow>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>{children}</div>
        </div>
      );
      const Card = ({ children }) => (
        <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>{children}</div>
      );
      return mlWrap(
        <div style={{ display: "grid", gap: 14 }}>
          <Eyebrow color={C.blue}>📖 ヘルプ</Eyebrow>

          <Section color={C.green} title="毎月の基本アクション">
            <Card>毎月1つだけアクションを選びます：<span style={{ color: C.text }}>①その月のレースに出走</span>／<span style={{ color: C.text }}>②練習</span>（指定能力+疲労増）／<span style={{ color: C.text }}>③完全休養</span>（疲労回復のみ）／<span style={{ color: C.text }}>④取材・私生活イベント</span>（能力・疲労に小さな効果）。出走すると賞金・ポイント・出走経験による能力成長が入りますが、疲労も大きく増えます。</Card>
            <Card>クラスはB1→A→PROの3段階。各クラスの昇格に必要なポイントを1年（12ヶ月）で稼ぐと年度末に昇格し、上位クラスほど賞金・年俸の倍率が上がります。</Card>
          </Section>

          <Section color={C.yellow} title="成長・練習の仕組み">
            <Card>選手（自分）にも成長タイプ（早熟・普通・晩成・超早熟・超晩成）と成長期／全盛期／衰え期があり、成長力（C/B/A/S、×0.7〜×1.6）が伸び方に倍率をかけます。練習では指定能力に90%、残り4能力に14%が配分されます。</Card>
            <Card>能力の伸びには年数が経つほど上昇し続けるソフトキャップがあります（目安：1年目90、以後1年ごとに+2、最大132）。この値未満は伸び全開、超えると急激に鈍化します。キャリアが長くなっても練習が無意味にならないよう、上限自体が毎年じわじわ上がっていきます。</Card>
            <Card>出走した場合は、レースで使った区間の種目に応じた「出走経験」でも能力が伸び、レースのグレードが高いほど伸びが大きくなります。またキャリアを重ねるほど対戦相手（AI選手）の地力も底上げされていくため、成長を怠るとだんだん勝てなくなっていきます。</Card>
          </Section>

          <Section color={C.red} title="疲労・フォーム">
            <Card>出走で疲労+40（車のグレードや「鉄人」「回復力」等で軽減）。疲労が60未満なら急いで回復させる必要はなく、90を超えると要注意です。</Card>
            <Card>フォーム（好不調・0〜100）はレース当日の能力を最大±17%上下させる好不調の指標です。毎月ゆるやかに基準値へ戻りつつ波打ち、「🎯ピーキング調整」で大きく上がります（狙ったレースに合わせて仕上げ、ピークは長く維持できません）。フォーム調整剤（ショップ）でも上げられます。「ムラっ気」は波が激しく、「精密機械」やメンタルが高い選手は安定します。予報アイコンで翌月の傾向がわかります。</Card>
            <Card>結婚・子供の有無・一戸建て以上の住居・メンター就任などのライフイベントは、毎月の疲労回復量にわずかな恒常ボーナスを与えます。</Card>
          </Section>

          <Section color={C.blue} title="監督指示・監督評価">
            <Card>毎月、監督から「エースとして表彰台を狙え」「積極的な走りで上位進出せよ」「アシストとしてチームを支えよ」「経験を積むために出走せよ」のいずれかの指示が出ます。達成すると監督評価が上がり、未達成だと下がります。監督評価が高いほど「エース」指示が出やすくなります。</Card>
            <Card>監督評価は年俸交渉や移籍オファーの内容にも影響します。練習をこなす、住環境を整える等でも少しずつ上がります。</Card>
          </Section>

          <Section color={"#4f8fe8"} title="レース作戦（出走前に選択）">
            <Card>出走前に作戦を選べます（結果に反映）：<span style={{ color: C.text }}>🚩標準</span>（流れ任せ）／<span style={{ color: C.text }}>⏳末脚温存</span>（集団維持でゴール勝負・スプリント型向き）／<span style={{ color: C.text }}>💨早めに逃げる</span>（自ら逃げに乗る・逃げ実績稼ぎにも）／<span style={{ color: C.text }}>⚔積極的に仕掛ける</span>（エース時の終盤アタック）。監督指示とは別に、あなた自身の意思で展開を作れます。</Card>
            <Card><span style={{ color: C.text }}>🤝アシストに徹する</span>＝自分の勝ちを捨ててエースを支える献身の走り。あなたが牽引・風除けを担うことで<b style={{ color: "#4f8fe8" }}>チームのエースが実際に押し上げられ</b>、エースが表彰台に入れば名アシストとして人気・監督評価・報酬が上乗せされます（あなたの地力や「献身のアシスト」特能が高いほど効果大）。<b style={{ color: "#4f8fe8" }}>監督指示がエースでも必ずアシスト戦としてカウントされ、監督評価も下がりません。</b>「献身の道（アンビション）」を狙うなら、監督の指示待ちにせず自分でこの作戦を選んで積み上げてください。</Card>
          </Section>

          <Section color={"#e8a13c"} title="世界ランキングとアンビション（生き様）">
            <Card>レースの着順・グレードに応じて世界ランキングポイントが入り、世界ランクが上下します。上位を目指すのが長期の大目標です。</Card>
            <Card>🌍 世界のペロトンは<b style={{ color: "#4f8fe8" }}>生きています</b>。世界ランキングの選手たちは実在の名前を持ち、毎年 加齢・成長・衰え・引退を繰り返して世代交代します（名選手の血を継ぐ2世が台頭することも）。ランキング画面の「今年の世界の動き」で新王者・引退・新星をチェックできます。さらに<b style={{ color: "#e8a13c" }}>あなたが殿堂に残した名選手・確立した系統の血は、次のキャリアの世界に🩸血統として流入</b>し、世界の頂点を争います。</Card>
            <Card>「生き方（アンビション）」は4つの道から選べます：<span style={{ color: C.text }}>🏆勝利の道</span>（勝利数）／<span style={{ color: C.text }}>🎭大舞台の道</span>（★の高いレース）／<span style={{ color: C.text }}>🤝献身の道</span>（アシスト戦数＝上の🤝作戦で積む）／<span style={{ color: C.text }}>🌍世界の道</span>（世界ランク）。道ごとに目標のはしごが異なり、達成報酬（資金・能力・成長力）が入ります。「🔀生き方を変える」でいつでも切替できます。</Card>
            <Card>引退時のキャリア傾向から「生き様（称号）」が決まり、殿堂記録に残ります。これが次のプレイの配合（生き様の血）にも影響します。</Card>
          </Section>

          <Section color={"#e56cc8"} title="配合・血統（教え子／殿堂）">
            <Card>キャラ作成時、殿堂の名選手を<span style={{ color: C.text }}>師匠（1人）＝教え子</span>、さらに<span style={{ color: C.text }}>配合相手（2人目）＝血を引く子</span>として選べます。両親の脚質相性（ニック）・血の濃さ・累代+値・生き様の血などから恩恵が決まります。</Card>
            <Card><b style={{ color: "#e56cc8" }}>爆発力＆配合評価（SS〜D）</b>：配合の質を1つの数値に集約した評価。ボーナスは初期能力ではなく<span style={{ color: C.text }}>伸びしろ（成長力・才能キャップ）</span>に還元されます＝生まれた瞬間は普通でも、育てると化けます。</Card>
            <Card><b style={{ color: C.red }}>危険度</b>：共通の祖先を持つ濃い配合（インブリード）は爆発力が上がる一方、稀に「ガラスの体」を持って生まれるリスクがあります。両親の健康な血（鉄人・頑丈・高スタミナ）と血脈の多様性で軽減されます。ハイリスク・ハイリターンの駆け引きです。</Card>
            <Card><b style={{ color: "#e8a13c" }}>系統確立＋因子</b>：同じ系統名の名選手を代々輩出すると、血統が「確立→名門→大系統」と成長します（プレイをまたいで蓄積）。確立した系統を継ぐ子孫は因子として伸びしろ＋系統特能を受け取り、大系統ではその因子が金特で発現します。</Card>
            <Card><b style={{ color: C.yellow }}>特殊配合</b>：特定の血の組み合わせ（例：二人の世界王者＝絶対王者の系譜、登坂型×平地型＝万能王の血脈 など）は、唯一無二の名血（金枠の称号＋金特）を確定で生みます。いろいろな組み合わせを試してみてください。</Card>
            <Card>これらの恩恵は<span style={{ color: C.text }}>金特クロス・配合限定特能</span>とあわせて配合プレビューに表示されます。シーズンモードでも「血統ユース」で同じ仕組みの原石を確保できます。</Card>
          </Section>

          <Section color={C.purple} title="年俸・契約・移籍オファー">
            <Card>年俸は年度末にその年のポイント・勝利数・表彰台数に応じて改定されます。好成績を残すと複数チームから移籍オファー（年俸倍率・契約金・エース確約の有無つき）が届き、残留か移籍かを選べます。移籍先のクラス（B1/A/PRO）がそのまま翌年の所属クラスになります。</Card>
          </Section>

          <Section color={C.red} title="ライバル">
            <Card>キャリア開始時に固定のライバル選手が1名生成されます。同じレースに出走すると自動で対決成績（通算勝敗）が記録され、随所で意識させられる存在になります。</Card>
          </Section>

          <Section color={C.yellow} title="節目の大会">
            <Card>🌍世界選手権：クラスA以上なら毎年9月に選出されます。🥇オリンピック：PROクラスかつ4年に一度だけ、3月に選出されます。どちらもグレード4（通常の最高格付けの1.3倍相当）の一発勝負で、ライバルも代表入りしてきます。</Card>
          </Section>

          <Section color={C.green} title="人生の岐路・オフシーズンの過ごし方">
            <Card>年度末には必ず「オフシーズンの過ごし方」を3択（国内自主トレ・海外武者修行・休養）から選びます。海外武者修行はハイリスクハイリターン（伸び大・疲労も増加）です。</Card>
            <Card>それとは別に、結婚・大きな怪我・第一子誕生・新人時代の恩師との別れといった「人生の岐路」が、条件を満たすと年度末に低確率（恩師との別れのみ確定）で発生し、一度きりの選択とその後ずっと続く恒常効果をもたらします。</Card>
          </Section>

          <Section color={"#e8a13c"} title="個人スポンサー・人気度">
            <Card>レースの着順が良いほど（グレードが高いレースほど）人気度（0〜100）が上がります。人気度10ごとに月+2万円の個人スポンサー収入（チーム年俸とは別枠）が入り、25/50/75/100到達時には契約一時金も入ります。</Card>
            <Card>人気度が20以上になると、毎月のアクションとして<span style={{ color: C.text }}>スポンサーの仕事（CM出演・撮影など）</span>を引き受けられるようになります。報酬（お金）と人気度が得られますが、その月は競技に集中できず疲労が残ります。報酬額は人気度が高いほど大きくなります。</Card>
          </Section>

          <Section color={C.blue} title="新人時代の恩師（師弟関係）">
            <Card>キャリア開始時、チームの恩師が新人指導を買って出てくれます。3年目を迎えるまでは練習・出走経験の伸びに+15%のボーナスがかかり、3年目に「人生の岐路」として一区切りを迎えます（選択次第で餞別の能力ボーナスもあります）。</Card>
          </Section>

          <Section color={"#6fa8dc"} title="天候">
            <Card>レースごとに晴れ・🌧雨・🥵猛暑のいずれかが決まります。雨は能力低下＋落車リスク（「悪天候巧者」で軽減）、猛暑は出走後の疲労蓄積増です。</Card>
          </Section>

          <Section color={C.purple} title="特殊能力">
            <Card>0〜3個の特殊能力を保有し、条件を満たすと保有能力が金特に強化されたり、新しい能力を後天的に習得したりします。発見済みの能力は特殊能力図鑑で内容を確認できます。</Card>
          </Section>

          <Section color={C.sub} title="実績・殿堂入り">
            <Card>初勝利・初表彰台など、キャリアを通じた実績を達成すると報酬が入ります。達成状況は「実績を見る」から確認できます。引退時はキャリアが記録として殿堂（歴代選手の殿堂）に残ります。</Card>
          </Section>

          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }

    // v29: 出走表（マイライフ）。レース本番前に顔ぶれを確認できる
    if (ml.screen === "mylife_startlist" && ml.result) return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <Eyebrow color={C.purple}>🏁 出走表 — {ml.result.raceMeta.name}</Eyebrow>
        <div style={{ fontSize: 11.5, color: C.sub }}>{ml.result.raceMeta.tmpl.kind}・{"★".repeat(ml.result.raceMeta.grade)}・{TYPES[ml.result.raceMeta.tmpl.favors].label}有利</div>
        <StartListPanel entrants={ml.result.entrants} />
        <Btn onClick={() => setMl(s => ({ ...s, screen: "mylife_race" }))}>🏁 レースを始める</Btn>
        <Btn outline color={C.sub} onClick={() => { mlRaceLockRef.current = false; setMl(s => ({ ...s, result: null, screen: "mylife_main" })); }}>← 出走を取りやめる</Btn>
      </div>
    );
    if (ml.screen === "mylife_race" && ml.result) return mlWrap(
      <div>
        <div style={{ marginBottom: 8 }}><Eyebrow color={ml.inLastRace ? "#e8a13c" : C.red}>{ml.inLastRace ? "🏁 LAST RACE — " : "LIVE — "}{ml.result.raceMeta.name}</Eyebrow></div>
        <RaceErrorBoundary onRecover={ml.inLastRace ? mlLastRaceFinish : mlRaceFinish}>
          <RaceView sim={ml.result} onFinish={ml.inLastRace ? mlLastRaceFinish : mlRaceFinish} />
        </RaceErrorBoundary>
        <div style={{ marginTop: 8, fontSize: 12, color: C.sub }}>● 印＝あなた。位置が近い選手同士が自然にグループを作ります。</div>
      </div>
    );

    if (ml.screen === "mylife_result" && ml.resultInfo) {
      const { race, rank, total, pts, directive, fulfilled, evalDelta, prize, rivalOutcome, rivalOutcome2, rival2Intro, popGain, popBonus, courseRecord, natRole, natFulfilled, natPopBonus, wpGain, worldRank, worldRankPrev, ambitionCleared, assistOutcome } = ml.resultInfo;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: race.milestone ? "#2b2436" : C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${race.milestone ? ML_MILESTONE_LABEL[race.milestone].color : C.yellow}` }}>
            <Eyebrow color={race.milestone ? ML_MILESTONE_LABEL[race.milestone].color : undefined}>{race.milestone ? `${ML_MILESTONE_LABEL[race.milestone].eyebrow} RESULT` : "RESULT"} — {race.name}</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 20, color: C.text, fontWeight: 700, margin: "6px 0" }}>{rank}位 / {total}人中</div>
            <div style={{ fontSize: 13.5, color: C.green }}>ポイント +{pts}pt ／ 賞金 +{prize}万円</div>
            {popGain > 0 && (
              <div style={{ fontSize: 11.5, color: "#e8a13c", marginTop: 3 }}>
                人気度 +{popGain}{popBonus > 0 ? `／個人スポンサー契約ボーナス +${popBonus}万円！` : ""}
              </div>
            )}
            {courseRecord && courseRecord.isNew && (
              <div style={{ fontSize: 12, color: courseRecord.isPlayer ? C.yellow : C.text, marginTop: 4, fontWeight: 700 }}>
                🏅 {courseRecord.kind}のコースレコード更新！（指数{courseRecord.speed}／達成：{courseRecord.holder}{courseRecord.isPlayer ? "・あなた" : ""}）
              </div>
            )}
            {/* v30: 世界ランキングの増減 */}
            {wpGain != null && (
              <div style={{ fontSize: 11.5, color: C.purple, marginTop: 4 }}>
                🌍 世界ランキングポイント +{wpGain}
                {worldRankPrev != null && worldRank != null && worldRank < worldRankPrev
                  ? `／世界ランク ${worldRankPrev}位 → ${worldRank}位（${worldRankPrev - worldRank}ランクUP！）`
                  : worldRank != null ? `／現在 世界${worldRank}位` : ""}
              </div>
            )}
          </div>
          {/* v30: アンビション達成バナー */}
          {ambitionCleared && (
            <div style={{ background: "linear-gradient(180deg,#33301a,#2a2416)", border: `1.5px solid #e8a13c`, borderRadius: 12, padding: "12px 14px" }}>
              <Eyebrow color={"#e8a13c"}>🎯 アンビション達成！</Eyebrow>
              <div style={{ fontFamily: FONT_D, fontSize: 15, color: "#ffd23f", fontWeight: 700, margin: "5px 0 3px" }}>{ambitionCleared.label}</div>
              <div style={{ fontSize: 12, color: C.green }}>達成報酬：{ambitionCleared.rewardText}</div>
            </div>
          )}
          {natRole && (
            <div style={{ background: natFulfilled ? "#16241c" : "#241818", border: `1px solid ${natFulfilled ? C.green : C.red}`, borderRadius: 10, padding: "10px 12px" }}>
              <Eyebrow color={natFulfilled ? C.green : C.red}>🎌 代表での役割（{natRole === "ace" ? "エース" : "アシスト"}） — {natFulfilled ? "任務達成" : "任務未達"}</Eyebrow>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>
                {natFulfilled ? `期待に応える走りで代表の役割を全うした。名声が高まった（人気度+${natPopBonus}）。` : "代表の役割を果たしきれず、悔しい結果となった。"}
              </div>
            </div>
          )}
          {assistOutcome && (
            <div style={{ background: assistOutcome.success ? "#16241c" : "#241818", border: `1px solid ${assistOutcome.success ? C.green : C.red}`, borderRadius: 10, padding: "10px 12px" }}>
              <Eyebrow color={assistOutcome.success ? C.green : C.red}>🤝 献身の走り — {assistOutcome.success ? "エースを勝利に導いた" : "報われず"}</Eyebrow>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>
                {assistOutcome.success
                  ? `あなたの牽引・風除けでエース${assistOutcome.name}が${assistOutcome.rank}位でフィニッシュ。名アシストとして称えられた（人気・監督評価・報酬に上乗せ）。`
                  : `最後までエース${assistOutcome.name}を牽引したが${assistOutcome.rank}位。勝たせられなかったが、その献身は仲間が見ている。`}
              </div>
            </div>
          )}
          {rivalOutcome && (
            <div style={{ background: rivalOutcome.beat ? "#16241c" : "#241818", border: `1px solid ${rivalOutcome.beat ? C.green : C.red}`, borderRadius: 10, padding: "10px 12px" }}>
              <Eyebrow color={rivalOutcome.beat ? C.green : C.red}>🔥 ライバル対決 — {rivalOutcome.beat ? "勝利" : "敗北"}</Eyebrow>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>{rivalOutcome.name}は{rivalOutcome.rank}位でフィニッシュ。{rivalOutcome.beat ? "今回はあなたが上手だった。" : "悔しい結果に終わった。"}</div>
            </div>
          )}
          {rivalOutcome2 && (
            <div style={{ background: rival2Intro ? "#1c2536" : (rivalOutcome2.beat ? "#16241c" : "#241818"), border: `1px solid ${rival2Intro ? C.blue : (rivalOutcome2.beat ? C.green : C.red)}`, borderRadius: 10, padding: "10px 12px" }}>
              <Eyebrow color={rival2Intro ? C.blue : (rivalOutcome2.beat ? C.green : C.red)}>{rival2Intro ? "🆕 新たな好敵手" : `🔥 好敵手対決 — ${rivalOutcome2.beat ? "勝利" : "敗北"}`}</Eyebrow>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>
                {rival2Intro
                  ? `${rivalOutcome2.name}という選手と初めて同じレースで走った。${rivalOutcome2.rank}位でフィニッシュした彼／彼女は、これから長く意識する存在になりそうだ。`
                  : `${rivalOutcome2.name}は${rivalOutcome2.rank}位でフィニッシュ。${rivalOutcome2.beat ? "今回はあなたが上手だった。" : "悔しい結果に終わった。"}`}
              </div>
            </div>
          )}
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
            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>年俸{ml.salary}万円/年（毎月{Math.round(ml.salary / 12)}万円が振り込まれます・生活費/税 -{mlLivingCost(ml)}万/月）</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 11, color: C.sub }}>現在の疲労</span>
              <div style={{ width: 90 }}><FatigueBar v={r.fatigue} /></div>
              <span style={{ fontSize: 11, color: C.sub }}>フォーム <span style={{ color: (r.form ?? 50) >= 80 ? C.yellow : (r.form ?? 50) >= 62 ? C.green : C.sub, fontFamily: FONT_M }}>{Math.round(r.form ?? 50)}</span></span>
            </div>
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
            <Eyebrow color={C.green}>消耗品（在庫制）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {Object.entries(ML_STOCK_ITEMS).map(([k, it]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>{it.label} <span style={{ fontFamily: FONT_M, color: C.green }}>×{ml.stock[k] || 0}</span></div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{it.desc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn small outline color={C.green} disabled={ml.money < it.price} onClick={() => mlBuyStock(k)}>{it.price}万で購入</Btn>
                    <Btn small color={C.green} disabled={(ml.stock[k] || 0) <= 0} onClick={() => mlUseStockConfirm(k)}>使う</Btn>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <Eyebrow color={"#e8a13c"}>私設強化合宿（何度でも・資金の使い道）</Eyebrow>
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6 }}>
              <div>
                <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>私設強化合宿</div>
                <div style={{ color: C.sub, fontSize: 11 }}>資金を注ぎ込み{AB_LABEL[r.focus]}を中心に鍛える（{AB_LABEL[r.focus]}+6・他+2、疲労+12）。伸びしろが尽きた選手には効きにくい</div>
              </div>
              <Btn small color={"#e8a13c"} disabled={ml.money < mlPrivateCampCost(ml)} onClick={mlPrivateCamp}>{mlPrivateCampCost(ml)}万で実施</Btn>
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

    if (ml.screen === "mylife_offseason" && ml.pendingOffseason) {
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "#1e2b24", border: `2px solid ${C.green}`, borderRadius: 10, padding: "12px 14px" }}>
            <Eyebrow color={C.green}>オフシーズン</Eyebrow>
            <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0" }}>新シーズンまでの間、どのように過ごしますか？</p>
          </div>
          {ML_OFFSEASON_CHOICES.map((c, i) => (
            <div key={c.key} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
              <div style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 14, color: C.text }}>{c.label}</div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{c.desc}</div>
              <Btn small color={C.green} style={{ marginTop: 8 }} onClick={() => mlResolveOffseason(i)}>これを選ぶ</Btn>
            </div>
          ))}
        </div>
      );
    }

    if (ml.screen === "mylife_offseason_result") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.green}` }}>
          <Eyebrow color={C.green}>結果</Eyebrow>
          <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{ml.offseasonResultText}</p>
        </div>
        <Btn onClick={mlContinueAfterOffseason}>続ける →</Btn>
      </div>
    );

    if (ml.screen === "mylife_crossroads" && ml.pendingCrossroads) {
      const cr = ML_CROSSROADS[ml.pendingCrossroads.key];
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "#2b1e1e", border: `2px solid ${C.red}`, borderRadius: 10, padding: "12px 14px" }}>
            <Eyebrow color={C.red}>{cr.title}</Eyebrow>
            <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0" }}>{cr.text}</p>
          </div>
          {cr.choices.map((c, i) => (
            <Btn key={i} color={C.red} onClick={() => mlResolveCrossroads(i)}>{c.label}</Btn>
          ))}
        </div>
      );
    }

    if (ml.screen === "mylife_crossroads_result") return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.red}` }}>
          <Eyebrow color={C.red}>結果</Eyebrow>
          <p style={{ color: C.text, fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{ml.crossroadsResultText}</p>
        </div>
        <Btn onClick={mlContinueAfterCrossroads}>続ける →</Btn>
      </div>
    );

    if (ml.screen === "mylife_contract" && ml.contractOffers) return mlWrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: ml.biddingWar ? "#3a2a12" : "#2b2436", border: `1px solid ${ml.biddingWar ? "#e8a13c" : C.purple}`, borderRadius: 10, padding: "10px 14px" }}>
          <Eyebrow color={ml.biddingWar ? "#e8a13c" : C.purple}>{ml.biddingWar ? "🔥 CONTRACT — 争奪戦！" : "CONTRACT — 移籍オファー"}</Eyebrow>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
            {ml.biddingWar
              ? "圧倒的な成績にチーム間で争奪戦が勃発！各チームが競って年俸・契約金・エース確約を吊り上げてきています。最高の条件を選び取りましょう。"
              : "好成績を残したあなたに、複数チームから声がかかっています。条件を見比べて来季の所属先を選んでください。"}
          </div>
        </div>
        {ml.contractOffers.map((offer, i) => {
          const isStay = i === 0;
          const previewSalary = Math.round(ml.salary * offer.salaryMul);
          const classDelta = offer.tier - ml.classIdx;
          return (
            <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1.5px solid ${isStay ? C.line : C.purple}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontFamily: FONT_M, fontSize: 11, fontWeight: 700, color: "#14171d", background: CLASS_TIER_COLOR[offer.tier],
                  borderRadius: 5, padding: "1px 6px",
                }}>{CLASSES[offer.tier].id}</span>
                <span style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 14, color: C.text }}>{offer.team}{isStay ? "（残留）" : "（移籍）"}</span>
                {classDelta > 0 && <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>⬆ 昇格</span>}
                {classDelta < 0 && <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>⬇ 降格</span>}
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>年俸 {previewSalary}万円{offer.bonus > 0 && <span style={{ color: C.green }}>／契約金 +{offer.bonus}万円</span>}</div>
              {offer.aceGuarantee && <div style={{ fontSize: 11, color: C.yellow, marginTop: 2 }}>👑 来季開幕戦はエースとして起用を確約</div>}
              <Btn small outline={isStay} color={C.purple} onClick={() => mlChooseTeam(offer)} style={{ marginTop: 8 }}>この条件で契約する</Btn>
            </div>
          );
        })}
      </div>
    );

    // v28: 引退勧告の駆け引き画面
    if (ml.screen === "mylife_retire_advice" && ml.player) {
      const r = ml.player;
      const info = ml.adviceInfo || { age: r.age, ovr: overall(r), joinOvr: r.joinOvr };
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${C.red}`, textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>📋</div>
            <h2 style={{ fontFamily: FONT_D, color: C.red, fontSize: 20, margin: "6px 0" }}>チームからの引退勧告</h2>
            <div style={{ fontSize: 12, color: C.sub }}>{info.age}歳・全盛期の力に陰りが見える</div>
          </div>
          <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.8, background: C.panel2, borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${C.red}` }}>
            監督room「{r.name}、今季もよく走ってくれた。だが正直、往年の走りには戻れていない（OVR {info.ovr}／全盛期基準{info.joinOvr}）。
            そろそろ身の振り方を考える時期かもしれない。もう一年やるか、役割を落として続けるか、それとも——決めるのは君だ」
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <Btn color={C.sub} outline onClick={mlRetireAdviceContinue}>💪 勧告を退けて現役を続ける（今まで通り）</Btn>
            <Btn color={C.blue} outline onClick={mlRetireAdviceReduceRole}>🤝 役割を縮小して続ける（レース負荷-15%・延命）</Btn>
            <Btn color={C.red} outline onClick={() => askConfirm(`勧告を受け入れ、${r.age}歳で引退しますか？この操作は取り消せません。`, mlRetireAdviceAccept)}>🏁 勧告を受け入れて引退する</Btn>
          </div>
        </div>
      );
    }
    if (ml.screen === "mylife_retired" && ml.player) {
      const r = ml.player;
      const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
      const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
      const arch = mlCareerArchetype(ml);
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${C.yellow}`, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🏁</div>
            <h2 style={{ fontFamily: FONT_D, color: C.yellow, fontSize: 22, margin: "8px 0" }}>{r.name} 引退</h2>
            {riderNickname(r) && <div style={{ fontSize: 13, color: C.purple, fontStyle: "italic" }}>「{riderNickname(r)}」</div>}
            {/* v31.4: キャリアの生き様（称号）。どんな伝説だったかを引退セレモニーで称える */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 10.5, color: C.sub }}>この選手の生き様</div>
              <div style={{ fontFamily: FONT_D, fontSize: 19, fontWeight: 700, color: arch.color, margin: "3px 0" }}>― {arch.title} ―</div>
              <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.6 }}>{arch.desc}</div>
            </div>
          </div>
          {ml.lastRaceResult && (
            <div style={{ background: "rgba(232,161,60,0.1)", borderRadius: 10, padding: "10px 12px", border: `1.5px solid #e8a13c` }}>
              <Eyebrow color={"#e8a13c"}>🏁 ラストレース — {ml.lastRaceResult.name}</Eyebrow>
              <div style={{ fontFamily: FONT_D, fontSize: 17, color: C.text, fontWeight: 700, margin: "4px 0" }}>{ml.lastRaceResult.rank}位 / {ml.lastRaceResult.total}人中</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{ml.lastRaceResult.flavor}</div>
            </div>
          )}
          <div style={{ fontSize: 11.5, color: C.text, padding: "8px 10px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.purple}`, lineHeight: 1.6 }}>
            {riderCareerSummary({ ...r, farewellYear: ml.year, farewellReason: "retired" })}
          </div>
          <div style={{ fontSize: 11.5, color: C.sub }}>通算{(r.raceLog || []).length}戦・{wins}勝・表彰台{podiums}回</div>
          {ml.rival && (
            <div style={{ fontSize: 11.5, color: C.text, padding: "8px 10px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.red}`, lineHeight: 1.6 }}>
              ライバル・{ml.rival.name}（{ml.rival.team}）との通算対戦成績は{ml.rivalRecord?.meetings || 0}戦{ml.rivalRecord?.wins || 0}勝{ml.rivalRecord?.losses || 0}敗だった。
            </div>
          )}
          {ml.rival2 && (
            <div style={{ fontSize: 11.5, color: C.text, padding: "8px 10px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.blue}`, lineHeight: 1.6 }}>
              好敵手・{ml.rival2.name}（{ml.rival2.team}）との通算対戦成績は{ml.rivalRecord2?.meetings || 0}戦{ml.rivalRecord2?.wins || 0}勝{ml.rivalRecord2?.losses || 0}敗だった。
            </div>
          )}
          {/* v26: 引退後キャリア（エピローグ）。監督転身／完全引退を選ぶと殿堂記録に後日談が加わる */}
          {ml.epilogueText ? (
            <div style={{ fontSize: 11.5, color: C.text, padding: "8px 10px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.yellow}`, lineHeight: 1.7 }}>
              {ml.epilogueText}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 11.5, color: C.sub }}>引退後の道を選ぶと、殿堂の記録に後日談が加わります。</div>
              <Btn small outline color={C.yellow} onClick={() => { const t = mlEpilogueDirector(ml); mlSetEpilogue(t); setMl(s => ({ ...s, epilogueText: t })); }}>🎓 監督としてチームに残る</Btn>
              <Btn small outline color={C.sub} onClick={() => { const t = mlEpilogueAway(ml); mlSetEpilogue(t); setMl(s => ({ ...s, epilogueText: t })); }}>🚶 競技から静かに離れる</Btn>
            </div>
          )}
          {/* v28: 自伝・レジェンドインタビュー。座右の言葉を選んで出版すると殿堂記録に名言が残る */}
          {ml.autobiographyText ? (
            <div style={{ fontSize: 12, color: C.text, padding: "10px 12px", background: "rgba(201,139,240,0.1)", borderRadius: 8, border: `1px solid ${C.purple}`, lineHeight: 1.7 }}>
              📖 自伝を出版した。<span style={{ color: C.purple, fontStyle: "italic" }}>「{ml.autobiographyText}」</span>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <Eyebrow color={C.purple}>📖 自伝を出版する — 座右の言葉を残す</Eyebrow>
              {mlAutobiographyOptions(ml).map((o, i) => (
                <Btn key={i} small outline color={C.purple} onClick={() => { mlSetAutobiography(o.quote); setMl(s => ({ ...s, autobiographyText: o.quote })); }}>{o.title}</Btn>
              ))}
            </div>
          )}
          <Btn onClick={() => { clearMyLifeSave(); setMl(initMyLife()); }}>新たな選手でキャリアを始める</Btn>
          <Btn outline color={C.purple} onClick={() => setMl(s => ({ ...s, screen: "mylife_legends" }))}>🏛 歴代選手の殿堂を見る</Btn>
          <Btn outline color={C.sub} onClick={() => setSuperMode(null)}>← モード選択に戻る</Btn>
        </div>
      );
    }

    // v32: チーム名鑑（固定チームメイトの確認画面）
    if (ml.screen === "mylife_teamroster" && ml.player) {
      const mates = ml.teammates || [];
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.green}` }}>
            <Eyebrow color={C.green}>👥 チーム名鑑 — {ml.team}</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>あなたと同じチームを走る固定メンバーです。移籍すると顔ぶれが変わります。</div>
          </div>
          <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.yellow}` }}>
            <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.yellow }}>★ {ml.player.name}（あなた）<span style={{ fontSize: 10.5, color: TYPES[ml.player.type]?.color, marginLeft: 6 }}>{TYPES[ml.player.type]?.label}</span><span style={{ fontFamily: FONT_M, fontSize: 11, color: C.sub, marginLeft: 8 }}>OVR {overall(ml.player)}</span></div>
          </div>
          {mates.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>チームメイトの記録がありません。</div>}
          {mates.map((tm, i) => (
            <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
              <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{tm.name}<span style={{ fontSize: 10.5, color: TYPES[tm.type]?.color, marginLeft: 6 }}>{TYPES[tm.type]?.label}</span></div>
              <PersonaLine p={tm.personality} />
              {tm.abilities && tm.abilities.length > 0 && <div style={{ fontSize: 10.5, color: C.purple, marginTop: 2 }}>{tm.abilities.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")}</div>}
              {(tm.winsForMe || 0) > 0 && <div style={{ fontSize: 10.5, color: C.green, marginTop: 2 }}>あなたのアシストとして {tm.winsForMe} 勝を支えた</div>}
            </div>
          ))}
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }
    // v32: キャリアグラフ（OVR・世界ランクの推移）
    if (ml.screen === "mylife_graph" && ml.player) {
      const hist = [...(ml.careerHistory || []), { year: ml.year, ovr: overall(ml.player), worldRank: ml.worldRank, wins: ml.careerWins || 0, podiums: ml.careerPodiums || 0 }];
      const W = 320, H = 160, padL = 24, padR = 24, padT = 14, padB = 22;
      const years = hist.map(h => h.year);
      const minY = Math.min(...years), maxY = Math.max(...years);
      const xAt = (yr) => maxY === minY ? W / 2 : padL + (yr - minY) / (maxY - minY) * (W - padL - padR);
      const ovrs = hist.map(h => h.ovr || 0);
      const ovrMin = Math.min(...ovrs) - 3, ovrMax = Math.max(...ovrs) + 3;
      const yOvr = (v) => H - padB - ((v - ovrMin) / Math.max(1, ovrMax - ovrMin)) * (H - padT - padB);
      const rankPts = hist.filter(h => h.worldRank != null);
      const ranks = rankPts.map(h => h.worldRank);
      const rMin = ranks.length ? Math.min(...ranks) : 1, rMax = ranks.length ? Math.max(...ranks) : 100;
      const yRank = (v) => padT + ((v - rMin) / Math.max(1, rMax - rMin)) * (H - padT - padB);
      const ovrPath = hist.map((h, i) => `${i === 0 ? "M" : "L"}${xAt(h.year).toFixed(1)},${yOvr(h.ovr || 0).toFixed(1)}`).join(" ");
      const rankPath = rankPts.map((h, i) => `${i === 0 ? "M" : "L"}${xAt(h.year).toFixed(1)},${yRank(h.worldRank).toFixed(1)}`).join(" ");
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.blue}` }}>
            <Eyebrow color={C.blue}>📈 キャリアグラフ</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>年ごとのOVRと世界ランクの推移。年度をまたぐごとに記録されます。</div>
          </div>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 6px", border: `1px solid ${C.line}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
              <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={C.line} />
              <path d={ovrPath} fill="none" stroke={C.yellow} strokeWidth="2" />
              {hist.map((h, i) => <circle key={i} cx={xAt(h.year)} cy={yOvr(h.ovr || 0)} r="2.5" fill={C.yellow} />)}
              {rankPath && <path d={rankPath} fill="none" stroke={C.green} strokeWidth="2" strokeDasharray="3,2" />}
              {rankPts.map((h, i) => <circle key={`r${i}`} cx={xAt(h.year)} cy={yRank(h.worldRank)} r="2.5" fill={C.green} />)}
              {hist.map((h, i) => <text key={`t${i}`} x={xAt(h.year)} y={H - 6} fontSize="8" fill={C.sub} textAnchor="middle">{h.year}</text>)}
            </svg>
            <div style={{ fontSize: 10.5, color: C.sub, display: "flex", gap: 14, justifyContent: "center", marginTop: 2 }}>
              <span style={{ color: C.yellow }}>― OVR</span><span style={{ color: C.green }}>┈ 世界ランク（上ほど上位）</span>
            </div>
          </div>
          {hist.length <= 1 && <div style={{ fontSize: 11, color: C.sub }}>年度を進めるとグラフが伸びていきます。</div>}
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }
    // v31.5: 世界ランキング閲覧画面
    if (ml.screen === "mylife_ranking" && ml.player) {
      const board = mlWorldBoard(ml);
      const tier = worldRankTier(ml.worldRank);
      const Row = ({ e }) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6,
          background: e.isPlayer ? "rgba(255,210,63,0.14)" : e.isRival ? "rgba(224,80,80,0.1)" : e.isRival2 ? "rgba(79,143,232,0.1)" : "transparent",
          border: e.isPlayer ? `1px solid ${C.yellow}` : "1px solid transparent" }}>
          <span style={{ fontFamily: FONT_M, fontSize: 12, width: 34, textAlign: "right", color: e.rank <= 3 ? C.yellow : e.rank <= 10 ? C.green : C.sub, fontWeight: 700 }}>{e.rank}位</span>
          <span style={{ flex: 1, fontSize: 12, color: e.isPlayer ? C.yellow : C.text, fontWeight: e.isPlayer ? 700 : 400 }}>
            {e.name}{e.isPlayer ? " ●（あなた）" : e.isRival ? " 🔥ライバル" : e.isRival2 ? " 🔥好敵手" : ""}
            {e.star && <span style={{ fontSize: 10, color: C.sub }}>　{TYPES[e.star.type]?.label || e.star.type}・{e.star.age}歳・通算{e.star.wins}勝</span>}
            {e.star && e.star.bloodOf && <span style={{ fontSize: 10, color: "#e8a13c", fontWeight: 700 }}>　🩸{e.star.bloodOf}</span>}
          </span>
          <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.sub }}>{e.pts}pt</span>
        </div>
      );
      const worldNews = mlWorldNews(ml.worldSeed, ml.year, loadMlLegends());
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "linear-gradient(180deg,#2a2740,#22202f)", borderRadius: 12, padding: 16, borderTop: `4px solid ${C.purple}` }}>
            <Eyebrow color={C.purple}>🌍 世界ランキング（{ml.year}年目）</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 20, color: tier.color, fontWeight: 700, margin: "6px 0 2px" }}>
              あなたは 世界{ml.worldRank == null ? "ランク外" : `${ml.worldRank}位`}
            </div>
            <div style={{ fontSize: 12, color: C.sub }}>{tier.label}／{Math.round(ml.worldPoints || 0)}pt{ml.worldRankBest != null ? `／自己最高 ${ml.worldRankBest}位` : ""}</div>
            <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4 }}>成績（着順×グレード）でポイントを獲得。年ごとに一部減衰し、世界1位の基準点は年々上がります。</div>
          </div>
          {worldNews.length > 0 && (
            <div style={{ background: "linear-gradient(180deg,#20283a,#1b2230)", borderRadius: 10, padding: "8px 11px", border: `1px solid ${C.blue}` }}>
              <div style={{ fontSize: 11, color: C.blue, fontWeight: 700, marginBottom: 4 }}>📰 今年の世界の動き</div>
              <div style={{ display: "grid", gap: 3 }}>{worldNews.map((n, i) => <div key={i} style={{ fontSize: 11.5, color: C.text }}>{n}</div>)}</div>
            </div>
          )}
          <div style={{ background: C.panel, borderRadius: 10, padding: "8px 10px", border: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginBottom: 4 }}>🏆 世界トップ10</div>
            <div style={{ display: "grid", gap: 2 }}>{board.top.map((e, i) => <Row key={i} e={e} />)}</div>
          </div>
          {board.around.length > 0 && (
            <div style={{ background: C.panel, borderRadius: 10, padding: "8px 10px", border: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginBottom: 4 }}>📍 あなたの周辺</div>
              <div style={{ display: "grid", gap: 2 }}>{board.around.map((e, i) => <Row key={i} e={e} />)}</div>
            </div>
          )}
          {(board.rivalRank != null || board.rival2Rank != null) && (
            <div style={{ fontSize: 11, color: C.sub }}>
              {board.rivalRank != null && ml.rival && <div>🔥 ライバル {ml.rival.name}：世界{board.rivalRank}位</div>}
              {board.rival2Rank != null && ml.rival2 && <div>🔥 好敵手 {ml.rival2.name}：世界{board.rival2Rank}位</div>}
            </div>
          )}
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_legends") {
      const allLegends = loadMlLegends();
      const legends = [...allLegends].reverse();
      const bloodMap = buildBloodMap(allLegends);
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.purple}` }}>
            <Eyebrow color={C.purple}>🏛 マイライフ殿堂</Eyebrow>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>これまでのプレイで引退した歴代選手の記録です（{legends.length}名）。2人を親に選んで「配合」で教え子を作れます。</div>
          </div>
          {/* v31.1: 配合相性表（ニック）。どの脚質同士が好相性か一覧できる */}
          <div style={{ background: "linear-gradient(180deg,#2e2436,#241d2c)", borderRadius: 12, padding: "12px 14px", border: `1px solid #e56cc8` }}>
            <button onClick={() => setMl(s => ({ ...s, showNicks: !s.showNicks }))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", textAlign: "left" }}>
              <Eyebrow color={"#e56cc8"}>🧬 配合相性表（ニック）　{ml.showNicks ? "▲" : "▼"}</Eyebrow>
            </button>
            {ml.showNicks && (
              <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                {breedNickTableRows().map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                    <span style={{ fontFamily: FONT_M, fontWeight: 700, width: 18, color: r.rank === "◎" ? C.yellow : r.rank === "○" ? C.green : C.sub }}>{r.rank}</span>
                    <span style={{ width: 96, color: C.text }}>{TYPES[r.pair[0]]?.label || r.pair[0]}×{TYPES[r.pair[1]]?.label || r.pair[1]}</span>
                    <span style={{ color: C.sub, flex: 1 }}>{r.label}{r.ability && ABILITIES[r.ability] ? `（${ABILITIES[r.ability].label}）` : ""}</span>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>※ 表以外の組み合わせは △（標準）。同じ祖先を持つ親同士を配合すると「血の濃さ（インブリード）」で更に強くなります。</div>
              </div>
            )}
          </div>
          {legends.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>まだ引退した選手はいません。</div>}
          <div style={{ display: "grid", gap: 8 }}>
            {legends.map((leg, i) => {
              const legId = legendBloodId(leg);
              const expanded = ml.expandedLegend === legId;
              const parents = leg.parents || [];
              return (
              <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.purple}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 14.5 }}>
                    {leg.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: TYPES[leg.type]?.color }}>{TYPES[leg.type]?.label}</span>
                    {(leg.generation || 0) > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: "#e56cc8" }}>🧬{leg.generation}代目{(leg.plusValue || 0) > 0 ? `+${leg.plusValue}` : ""}</span>}
                  </span>
                  <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.sub }}>{leg.endYear}年目引退・{leg.age}歳</span>
                </div>
                {leg.nickname && <div style={{ fontSize: 11.5, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{leg.nickname}」</div>}
                {leg.careerTitle && <div style={{ fontSize: 11.5, color: "#e8a13c", fontWeight: 700, marginTop: 2 }} title={leg.careerTitleDesc || ""}>― {leg.careerTitle} ―</div>}
                <div style={{ fontSize: 11, color: C.text, marginTop: 4, lineHeight: 1.6 }}>{leg.summary}</div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>
                  {leg.team}／通算{leg.races}戦{leg.wins}勝・表彰台{leg.podiums}回／実績{leg.achievedCount}/{leg.achievedTotal}
                  {leg.rivalName && `／ライバル${leg.rivalName}に${leg.rivalRecord?.wins || 0}勝${leg.rivalRecord?.losses || 0}敗`}
                  {leg.rival2Name && `／好敵手${leg.rival2Name}に${leg.rivalRecord2?.wins || 0}勝${leg.rivalRecord2?.losses || 0}敗`}
                </div>
                {leg.epilogue && <div style={{ fontSize: 10.5, color: C.yellow, marginTop: 5, lineHeight: 1.6, fontStyle: "italic" }}>{leg.epilogue}</div>}
                {leg.autobiography && <div style={{ fontSize: 11, color: C.purple, marginTop: 5, lineHeight: 1.6, fontStyle: "italic" }}>📖「{leg.autobiography}」</div>}
                {leg.master && <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>🎓 {leg.master}の教え子{leg.partner ? `・🧬${leg.partner}との配合` : ""}</div>}
                {leg.lineageName && <div style={{ fontSize: 10.5, color: "#c98bf0", marginTop: 2 }}>🩸 {leg.lineageName}
                  {(() => { const rec = loadBloodlines()[leg.lineageName]; const t = rec ? mlBloodlineTier(rec) : null; if (!t || t.tier <= 0) return null; return <span style={{ color: "#e8a13c", fontWeight: 700 }}>　🏛{t.label}（{rec.count}名・{rec.wins}勝）</span>; })()}
                </div>}
                {leg.specialMatingTitle && <div style={{ fontSize: 10.5, color: "#ffd24a", fontWeight: 700, marginTop: 1 }}>🌟 {leg.specialMatingTitle}</div>}
                {/* v31.2: 殿堂記録の削除。誤って残った記録や整理のために1件ずつ消せる */}
                <div style={{ marginTop: 6, textAlign: "right" }}>
                  <button onClick={() => askConfirm(`殿堂記録から「${leg.name}」を削除しますか？この操作は取り消せません（血統の親として選べなくなります）。`, () => {
                    const list = loadMlLegends(); const oi = allLegends.length - 1 - i; if (oi >= 0 && oi < list.length) { list.splice(oi, 1); saveMlLegends(list); setMl(s => ({ ...s })); }
                  })} style={{ background: "none", border: `1px solid ${C.red}`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 10.5, padding: "2px 8px" }}>🗑 この記録を削除</button>
                </div>
                {/* v31.1: 系譜ツリー（血統）。親・祖父母を辿って表示する */}
                {parents.length > 0 && (
                  <>
                    <button onClick={() => setMl(s => ({ ...s, expandedLegend: expanded ? null : legId }))}
                      style={{ marginTop: 6, background: "none", border: `1px solid ${C.line}`, borderRadius: 6, color: "#e56cc8", cursor: "pointer", fontSize: 10.5, padding: "3px 8px" }}>
                      {expanded ? "▲ 系譜を閉じる" : "🌳 系譜（血統）を見る"}
                    </button>
                    {expanded && (
                      <div style={{ marginTop: 6, background: C.panel2, borderRadius: 8, padding: "8px 10px", fontSize: 11.5, lineHeight: 1.8 }}>
                        <div style={{ color: C.text, fontWeight: 700 }}>{leg.name}</div>
                        <div style={{ color: C.sub, marginLeft: 8 }}>
                          ├ 父母：{parents.map(p => bloodIdToName(p, bloodMap)).join(" × ")}
                        </div>
                        {parents.map((pid, pj) => {
                          const pl = bloodMap[pid];
                          const gp = pl && pl.parents || [];
                          if (gp.length === 0) return null;
                          return (
                            <div key={pj} style={{ color: C.sub, marginLeft: 20, fontSize: 11 }}>
                              └ {bloodIdToName(pid, bloodMap)}の父母：{gp.map(g => bloodIdToName(g, bloodMap)).join(" × ")}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
              );
            })}
          </div>
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_create" }))}>← 戻る</Btn>
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
          <Eyebrow>チーム名</Eyebrow>
          <input type="text" value={teamNameChoice} maxLength={16} placeholder="あなたのチーム"
            onChange={e => setTeamNameChoice(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 6, background: C.panel2, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FONT_B }} />
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>レース・順位表・記録に表示されます（未入力なら「あなたのチーム」・後からショップで変更可）。</div>
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
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, border: `1px solid ${C.line}` }}>
          <Eyebrow color={C.green}>🏁 解禁コンテンツ（累計CPで新コース種別が出現）</Eyebrow>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {UNLOCK_TEMPLATES.map(t => {
              const unlocked = meta.totalEarnedCP >= t.unlockCP;
              return (
                <div key={t.kind} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, opacity: unlocked ? 1 : 0.55 }}>
                  <span style={{ color: unlocked ? C.text : C.sub }}>{unlocked ? "✅" : "🔒"} {t.kind}<span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>{TYPES[t.favors].label}有利</span></span>
                  <span style={{ fontFamily: FONT_M, fontSize: 11, color: unlocked ? C.green : C.sub }}>{unlocked ? "解禁済み" : `${t.unlockCP}ptで解禁`}</span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>解禁するとシーズン・マイライフ両モードのカレンダーに登場します。</div>
        </div>
        <Btn onClick={() => {
          const name = teamNameChoice.trim();
          const base = applyCpMilestones({ ...initGame(), difficulty: diffChoice, teamName: name || "あなたのチーム" }, meta.totalEarnedCP);
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
      <Btn onClick={() => setG(s => ({ ...s, scouts: genScouts(0, Date.now() % 999983, s.scoutPolicy, s.roster.map(r => r.name), s.staff?.scout || 0), screen: "sponsor" }))}>この方針で決定 → スポンサー選択へ</Btn>
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
          {(() => { const news = rivalNews(g.year, g.month); return (
            <div style={{ background: C.panel2, borderRadius: 10, padding: "8px 12px", borderLeft: `3px solid ${news.color}` }}>
              <Eyebrow color={C.sub}>📰 他チーム動向</Eyebrow>
              <div style={{ fontSize: 12, color: C.text, marginTop: 3 }}>{news.text}</div>
            </div>
          ); })()}
          <Eyebrow>今月のレースカレンダー（出場は月1回）</Eyebrow>
          {g.homeRegion && <div style={{ fontSize: 11, color: C.sub }}>🏠 本拠地：<span style={{ color: C.green }}>{g.homeRegion}</span>（地元開催のレースは出走選手が地元の声援を受けて能力+{HOME_ABILITY_BONUS}）</div>}
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
                    {r.championship ? "👑 " : ""}{r.grandTour ? "🌍 " : ""}{r.sponsorMandate ? "🎯 " : ""}{raceIsHome(r, g.homeRegion) ? "🏠 " : ""}{r.name}
                  </div>
                  <div style={{ fontFamily: FONT_M, fontSize: 12, color: C.yellow }}>{r.weather && r.weather !== "clear" ? `${WEATHER[r.weather].icon} ` : ""}{"★".repeat(r.grade)}</div>
                </div>
                <div style={{ display: "flex", gap: 3, margin: "6px 0 4px" }}>
                  {r.tmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 6, borderRadius: 3, background: SEG_COLOR[s[0]] }} />)}
                </div>
                <div style={{ fontSize: 11.5, color: C.sub }}>
                  {r.tmpl.kind}・出走{squadLabel}・{TYPES[r.tmpl.favors].label}有利／優勝 約{Math.round(PRIZES[0] * mul)}万・{Math.round(PTS[0] * GRADE_MUL[r.grade])}pt
                  {raceIsHome(r, g.homeRegion) && <span style={{ color: C.green }}>／🏠 地元開催（出走選手 全能力+{HOME_ABILITY_BONUS}）</span>}
                  {r.sponsorMandate && <span style={{ color: C.red }}>／スポンサー指定レース</span>}
                  {r.stageRace && <span style={{ color: C.purple }}>／{r.stageCount || 2}日間ステージレース(総合)</span>}
                </div>
                <div style={{ marginTop: 8 }}>
                  {r.locked
                    ? <span style={{ fontSize: 12, color: C.red }}>🔒 {r.lockReason}</span>
                    : <Btn small disabled={!enough} onClick={() => setG(s => {
                        const defN = Math.max(r.tmpl.squadMin, Math.min(r.tmpl.squadMax, healthy.length));
                        // v29: 出走表用に相手チームの布陣を先に生成してキャッシュ。実際のレースでも
                        // このfixedAiTeamsを再利用するので、出走表と本番の顔ぶれが一致する
                        const { aiTeams } = buildSim(r, healthy, null, {}, s.equip, {}, s.classIdx, undefined, r.stageRace ? "day1" : undefined, { chaseMode: "normal", aceEarly: false }, s.difficulty, s.rivalAlumni, s.dynastyLevel, s.teamName);
                        return { ...s, sel: { ...s.sel, raceId: r.id, starters: [], ace: null, roles: {}, squadN: defN }, pendingAiTeams: aiTeams, screen: "lineup" };
                      })}>
                        {enough ? "このレースに出場" : `出走可能${healthy.length}名（最低${r.tmpl.squadMin}名必要）`}
                      </Btn>}
                </div>
              </div>
            );
          })}
          <Btn outline color={C.sub} onClick={() => advanceMonth(null)}>翌月へ進む（今月は休養：全員の疲労-50）</Btn>
          {/* v28: 縦積みだった閲覧・管理系ボタンを折り返しの小ボタン群にまとめて縦の長さを圧縮 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Btn small outline color={C.blue} onClick={() => setG(s => ({ ...s, screen: "program" }))}>📅 年間プログラム</Btn>
            <Btn small outline color={C.purple} onClick={() => setG(s => ({ ...s, screen: "standings" }))}>📊 順位表</Btn>
            <Btn small outline color={"#e8a13c"} onClick={() => setG(s => ({ ...s, screen: "trophy" }))}>🏆 トロフィールーム</Btn>
            <Btn small outline color={C.green} onClick={() => {
              const ok = saveGame(g);
              setG(s => ({ ...s, log: [...s.log, ok ? `【${MONTHS[s.month]}】セーブしました` : "セーブに失敗しました（ブラウザの保存領域を確認してください）"] }));
            }}>💾 セーブ</Btn>
            <Btn small outline color={C.sub} onClick={() => {
              askConfirm("タイトルに戻ります。セーブ済みのデータは消えません。よろしいですか？", () => {
                setG(s => ({ ...s, screen: "intro" }));
                setSuperMode(null);
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
      const chem = teamChemistryTier(g.roster);
      body = (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, color: C.sub }}>
            所属 {g.roster.length}/{rosterMax}名。<span style={{ color: C.yellow }}>能力{growthCap}以上＝限界突破</span>（金色表示・成長が大幅に鈍化。難易度「{(DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).label}」の成長上限）。練習指定能力の伸びはトレードオフ（×0.9）で指定外に一部融通されます。
          </div>
          <div style={{ background: C.panel, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: 11.5, color: C.sub }}>チームケミストリー </span>
              <span style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 13.5, color: C.green }}>{chem.label}</span>
            </div>
            <div style={{ fontSize: 10.5, color: C.sub }}>平均在籍{chem.avgTenure.toFixed(1)}ヶ月{chem.mul < 1 ? `／レース中のドラフト消耗-${Math.round((1 - chem.mul) * 100)}%` : ""}</div>
          </div>
          <div style={{ fontSize: 11, color: C.sub }}>🎖 各選手カードのマークで主将を1名任命できます。主将より2歳以上若い選手は練習効果+10%になります。</div>
          {g.inv.camp > 0 && !g.camp && <Btn small outline color={C.purple} onClick={() => askConfirm("キャンプを実施しますか？今月の練習効果が×2になりますが、選手全員の疲労が+25されます（連発すると故障リスクが高まります）。", useCamp)}>⛺ キャンプ券を使う（今月の練習効果×2・全員疲労+25）</Btn>}
          {g.camp && <div style={{ fontSize: 12, color: C.purple }}>⛺ 今月はトレーニングキャンプ実施中（練習効果×2）</div>}
          {!g.youthUsed && g.roster.length < rosterMax && g.budget >= 15 && (
            <Btn small outline color={C.green} onClick={() => askConfirm("ユース候補を1名確保しますか？契約金15万円。現在の能力は控えめですが、成長力（growthPow A以上）が保証された若手（16〜17歳）です。", signYouthProspect)}>
              🌱 ユース選手を獲得する（契約金15万円・年1回限り）
            </Btn>
          )}
          {/* v31.1: 血統ユース（配合）。マイライフ殿堂の2名を親に選び、配合の原石を確保する */}
          {!g.youthUsed && g.roster.length < rosterMax && (() => {
            const legends = loadMlLegends();
            if (legends.length < 2) return null;
            const sel = breedYouthSel;
            const legA = sel ? legends[sel.a] : null;
            const legB = sel && sel.b !== sel.a ? legends[sel.b] : null;
            const breed = (legA && legB) ? mlBreedBonus(legA, legB) : null;
            return (
              <div style={{ background: "linear-gradient(180deg,#2a2436,#22202f)", borderRadius: 10, padding: "10px 12px", border: `1px solid #e56cc8` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: FONT_D, fontSize: 12.5, fontWeight: 700, color: "#e56cc8" }}>🧬 血統ユース（配合・契約金40万）</span>
                  <Btn small outline color={"#e56cc8"} onClick={() => setBreedYouthSel(sel ? null : { a: 0, b: legends.length > 1 ? 1 : 0 })}>{sel ? "閉じる" : "親を選ぶ"}</Btn>
                </div>
                <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>マイライフ殿堂の名選手2名を親に配合の原石を確保。相性・血の濃さ・累代+値・金特クロスの恩恵が乗ります。</div>
                {sel && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {[["a", "親A"], ["b", "親B"]].map(([key, lbl]) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: C.sub, width: 32 }}>{lbl}</span>
                        <select value={sel[key]} onChange={e => { const v = parseInt(e.target.value); setBreedYouthSel(s => ({ ...s, [key]: v })); }}
                          style={{ flex: 1, background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 6px", fontSize: 12 }}>
                          {legends.map((l, i) => <option key={i} value={i}>{l.name}（{TYPES[l.type]?.label || l.type}{(l.generation || 0) > 0 ? `・${l.generation}代目+${l.plusValue || 0}` : ""}）</option>)}
                        </select>
                      </div>
                    ))}
                    {sel.a === sel.b && <div style={{ fontSize: 10.5, color: C.red }}>※ 異なる2名を選んでください</div>}
                    {breed && (
                      <div style={{ background: C.panel2, borderRadius: 8, padding: "7px 9px", fontSize: 11, color: C.text, lineHeight: 1.7 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: C.sub }}>配合評価</span>
                          <span style={{ fontFamily: FONT_M, fontWeight: 800, fontSize: 15, color: mlGradeColor(breed.matingGrade) }}>{breed.matingGrade}</span>
                          <span style={{ fontSize: 10, color: C.sub }}>爆発力 <span style={{ fontFamily: FONT_M, color: C.yellow }}>{breed.bakuhatsu}</span></span>
                          {(breed.growthSteps > 0 || breed.talentCap > 0) && <span style={{ fontSize: 10, color: "#9ae6b4" }}>{breed.growthSteps > 0 ? `成長力+${breed.growthSteps}` : ""}{breed.growthSteps > 0 && breed.talentCap > 0 ? "・" : ""}{breed.talentCap > 0 ? `才能+${breed.talentCap}` : ""}</span>}
                        </div>
                        {breed.special && <div style={{ color: breed.special.color, fontWeight: 800 }}>🌟 特殊配合『{breed.special.title}』</div>}
                        {breed.danger > 0 && <div style={{ color: breed.danger >= 38 ? C.red : "#e8a13c", fontSize: 10.5 }}>⚠️ 危険度 {breed.dangerLabel}（約{breed.danger}%）ガラスの体リスク{breed.healthMit > 0 ? "（健康な血で軽減）" : ""}</div>}
                        <div>相性 <span style={{ color: breed.nick.rank === "◎" ? C.yellow : breed.nick.rank === "○" ? C.green : C.sub, fontWeight: 700 }}>{breed.nick.rank} {breed.nick.label}</span></div>
                        <div>累代+値 <span style={{ color: C.yellow }}>+{breed.plusPer}</span>{breed.inbreed.count > 0 && <span style={{ color: C.red }}>・🩸インブリード×{breed.inbreed.count}</span>}{breed.goldInherit && breed.goldInherit.length > 0 && <span style={{ color: C.yellow }}>・✨金特クロス</span>}{breed.exclusive && breed.exclusive.length > 0 && <span style={{ color: "#e56cc8" }}>・🩸{breed.exclusive.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")}</span>}</div>
                        <div style={{ color: C.sub }}>継承特能：{breed.extraAbilities.length ? breed.extraAbilities.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・") : "—"}</div>
                        {breed.archNotes && breed.archNotes.length > 0 && <div style={{ color: "#e8a13c" }}>血の格：{breed.archNotes.join("・")}</div>}
                      </div>
                    )}
                    <Btn small color={"#e56cc8"} disabled={!breed || g.budget < 40} onClick={() => askConfirm(`${legA.name}×${legB.name}の配合で血統ユースを確保しますか？契約金40万円（年1回のユース枠を消費）。`, () => signBredYouth(legA, legB))}>
                      {g.budget < 40 ? "資金不足（40万円必要）" : "🧬 この配合で確保する（40万円）"}
                    </Btn>
                  </div>
                )}
              </div>
            );
          })()}
          {g.youthUsed && <div style={{ fontSize: 11, color: C.sub }}>🌱 ユース育成枠は今年度使用済み（来年4月にリセット）</div>}
          {g.month === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>4月は選手の解雇が可能です（各選手カードの「解雇」ボタン）。</div>}
          {g.roster.map(r => {
            const t = TYPES[r.type], ph = growthPhase(r);
            return (
              <div key={r.id} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${r.injury > 0 ? C.red : C.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>{r.name}</span>
                    <button onClick={() => openRename("選手名を変更", r.name, v => setG(s => ({ ...s, roster: s.roster.map(x => x.id === r.id ? { ...x, name: v } : x) })))} title="名前を変更" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, marginLeft: 4, padding: 0, opacity: 0.7 }}>✏️</button>
                    {r.id === g.captainId && <span style={{ marginLeft: 5, fontSize: 10.5, color: "#14171d", background: C.yellow, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>🎖 主将</span>}
                    {r.age <= 18 && <span style={{ marginLeft: 5, fontSize: 10.5, color: "#14171d", background: C.green, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>🌱 ユース</span>}
                    <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color, border: `1px solid ${t.color}`, borderRadius: 4, padding: "1px 5px" }}>{t.label}</span>
                    <span style={{ marginLeft: 5, fontFamily: FONT_M, fontSize: 12, color: POW[r.growthPow].color }}>成長{r.growthPow}</span>
                    <span style={{ marginLeft: 5, fontSize: 11, color: potentialHint(r).color }}>{potentialHint(r).label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => setCaptain(r.id)} title="主将に任命（自分より2歳以上若い選手の練習効果+10%）"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0, color: r.id === g.captainId ? C.yellow : C.sub }}>
                      🎖
                    </button>
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
                <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.sub, margin: "4px 0", flexWrap: "wrap" }}>
                  <span>{r.age}歳・{GROWTH[r.growth].label}・<span style={{ color: ph.tag === "全盛期" ? C.yellow : ph.tag === "衰え期" ? C.red : C.green }}>{ph.tag}</span></span>
                  <span>調子 <span style={{ color: COND_COLOR[r.cond - 1], fontFamily: FONT_M }}>{COND_ARROW[r.cond - 1]}</span><CondFc dir={r.condForecast} /></span>
                  {r.streak > 0 && <span style={{ color: r.streak >= 2 ? C.red : "#e8a13c" }}>連闘{r.streak}{r.streak >= 2 ? "（次で故障！）" : ""}</span>}
                  {r.injury > 0 && <span style={{ color: C.red }}>🏥 故障 残{r.injury}ヶ月</span>}
                </div>
                <div style={{ fontSize: 10.5, color: C.sub }}>疲労（90超で故障リスク）</div>
                <FatigueBar v={r.fatigue} />
                <AbilityGrid r={r} cap={growthCap} />
                <SubStatLine r={r} />
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
                {/* v30: フレーバーテキストは特能と能力値の間から、カード末尾の独立欄へ移動 */}
                <div style={{ fontSize: 11, color: C.sub, fontStyle: "italic", marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.line}`, lineHeight: 1.5 }}>{riderFlavorText(r)}</div>
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
          <section>
            <Eyebrow color={C.yellow}>🏳 チーム名</Eyebrow>
            <input type="text" value={g.teamName || ""} maxLength={16} placeholder="あなたのチーム"
              onChange={e => { const v = e.target.value; setG(s => ({ ...s, teamName: v })); }}
              onBlur={e => { if (!e.target.value.trim()) setG(s => ({ ...s, teamName: "あなたのチーム" })); }}
              style={{ width: "100%", boxSizing: "border-box", marginTop: 6, background: C.panel2, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", fontSize: 14, fontFamily: FONT_B }} />
            <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>いつでも変更できます（16文字まで）。</div>
          </section>
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
                      <div style={{ fontSize: 11.5, color: C.sub, margin: "3px 0" }}>{sc.tag}・{r.age}歳・{GROWTH[r.growth].label}型・成長<span style={{ color: POW[r.growthPow].color }}>{r.growthPow}</span>・<span style={{ color: potentialHint(r).color }}>{potentialHint(r).label}</span></div>
                      <PersonaLine p={r.personality} />
                      <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                      <BlurGrid blur={sc.blur} />
                      <SubStatLine r={r} />
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
                    <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
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
            <Eyebrow color={"#e8a13c"}>選手間トレード（毎月入れ替え）</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, margin: "4px 0 8px" }}>ライバルチームが自チームの選手に興味を示し、代わりの選手を提示してきています。受け入れると1対1で入れ替わります。</div>
            <div style={{ display: "grid", gap: 8 }}>
              {(g.tradeOffers || []).length === 0 && <div style={{ fontSize: 13, color: C.sub }}>今月のトレードオファーはありません。</div>}
              {(g.tradeOffers || []).map(offer => {
                const wantRider = g.roster.find(r => r.id === offer.wantRiderId);
                if (!wantRider) return null;
                const r = offer.offeredRider, t = TYPES[r.type];
                return (
                  <div key={offer.id} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${"#e8a13c"}` }}>
                    <div style={{ fontSize: 12, color: C.sub }}>{offer.team}が<span style={{ color: C.text, fontWeight: 700 }}>{wantRider.name}</span>（{TYPES[wantRider.type].label}・{overall(wantRider)} OVR）を欲しがっています</div>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", marginTop: 6 }}>
                      <div>
                        <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 15 }}>{r.name}</span>
                        <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                        <span style={{ marginLeft: 6, fontSize: 11, color: C.sub }}>{r.age}歳</span>
                      </div>
                      <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 13 }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></span>
                    </div>
                    <PersonaLine p={r.personality} />
                    <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                    <AbilityGrid r={r} cap={growthCap} />
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <Btn small color={"#e8a13c"} disabled={g.roster.length <= 1} onClick={() => askConfirm(`${wantRider.name}を放出し、${r.name}を獲得するトレードを成立させますか？`, () => acceptTrade(offer.id))}>このトレードを受け入れる</Btn>
                      <Btn small outline color={C.sub} onClick={() => declineTrade(offer.id)}>見送る</Btn>
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
              {g.inv.camp > 0 && !g.camp && <Btn small outline color={C.purple} onClick={() => askConfirm("キャンプを実施しますか？今月の練習効果が×2になりますが、選手全員の疲労が+25されます（連発すると故障リスクが高まります）。", useCamp)}>キャンプ券を使う（今月の練習×2・全員疲労+25）</Btn>}
              {g.camp && <div style={{ fontSize: 12, color: C.purple }}>⛺ 今月はトレーニングキャンプ実施中（練習効果×2）</div>}
            </div>
          </section>
          {/* v28: チーム施設のアップグレード段階可視化。機材・スタッフの現在レベルと累積効果を
              バーで一覧できるようにし、投資の進み具合と効果を直感的に把握できるようにする */}
          <section>
            <Eyebrow color={"#e8a13c"}>🏭 施設・投資の状況</Eyebrow>
            <div style={{ display: "grid", gap: 7, marginTop: 6 }}>
              {[
                { label: "エアロフレーム", lv: g.equip.frame, max: 5, effect: `平坦 +${g.equip.frame * 6}%`, color: C.blue },
                { label: "軽量ホイール", lv: g.equip.wheels, max: 5, effect: `登坂 +${g.equip.wheels * 6}%`, color: C.red },
                { label: "トレーニング設備", lv: g.equip.facility, max: 5, effect: `練習効果 +${g.equip.facility * 15}%`, color: C.green },
                { label: "監督", lv: g.staff.manager, max: 3, effect: g.staff.manager > 0 ? `月収+${g.staff.manager * 12}%・ノルマ-${g.staff.manager * 8}%・報酬+${g.staff.manager * 10}%` : "未雇用", color: C.yellow },
                { label: "トレーナー", lv: g.staff.trainer, max: 3, effect: g.staff.trainer > 0 ? `練習成長 +${g.staff.trainer * 12}%` : "未雇用", color: C.green },
                { label: "ドクター", lv: g.staff.doctor, max: 3, effect: g.staff.doctor > 0 ? `故障率 -${g.staff.doctor * 22}%・離脱-${Math.round(g.staff.doctor * 0.8)}ヶ月` : "未雇用", color: "#6fa8dc" },
                { label: "スカウト", lv: g.staff.scout || 0, max: 3, effect: (g.staff.scout || 0) > 0 ? `査定ブレ -${(g.staff.scout || 0) * 28}%・逸材率+${(g.staff.scout || 0) * 60}%` : "未雇用", color: C.purple },
              ].map((row, i) => (
                <div key={i} style={{ background: C.panel, borderRadius: 8, padding: "7px 10px", border: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>{row.label} <span style={{ fontFamily: FONT_M, color: C.sub, fontSize: 10.5 }}>Lv{row.lv}/{row.max}</span></span>
                    <span style={{ fontSize: 10.5, color: row.lv > 0 ? row.color : C.sub }}>{row.effect}</span>
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    {Array.from({ length: row.max }).map((_, j) => (
                      <div key={j} style={{ flex: 1, height: 6, borderRadius: 3, background: j < row.lv ? row.color : C.panel2 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {g.obCoach && <div style={{ fontSize: 11, color: "#e8a13c", marginTop: 6 }}>🎓 OBコーチ {g.obCoach.name}：{AB_LABEL[g.obCoach.ab]}の練習効果+25%</div>}
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
                  const lv = g.staff[k] || 0;
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
          <section>
            <Eyebrow color={"#e8a13c"}>OBコーチ（引退選手の登用・月給{OB_COACH_SALARY}万）</Eyebrow>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>殿堂入りしたOBを専属コーチに迎えると、その選手の脚質に対応する能力の練習効果が全選手+25%になります（1名まで）。</div>
            {g.obCoach && (
              <div style={{ background: "rgba(232,161,60,0.1)", borderRadius: 10, padding: "10px 12px", border: `1.5px solid #e8a13c`, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700 }}>🎓 {g.obCoach.name}コーチ <span style={{ fontSize: 10.5, color: TYPES[g.obCoach.type].color }}>{TYPES[g.obCoach.type].label}</span></div>
                  <div style={{ color: "#e8a13c", fontSize: 11.5 }}>{AB_LABEL[g.obCoach.ab]}の練習効果+25%（全選手）</div>
                </div>
                <Btn small outline color={C.sub} onClick={dismissObCoach}>契約解消</Btn>
              </div>
            )}
            {!g.obCoach && (
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {g.hallOfFame.length === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>まだ殿堂入りOBがいません（引退・退団した実績ある選手が対象です）。</div>}
                {[...g.hallOfFame].reverse().slice(0, 6).map((h, i) => (
                  <div key={`ob-${h.id}-${i}`} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13 }}>{h.name}</span>
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: TYPES[h.type].color }}>{TYPES[h.type].label}</span>
                      <div style={{ fontSize: 10.5, color: C.sub }}>{AB_LABEL[TYPE_COACH_ABILITY[h.type] || "flat"]}の練習効果+25%</div>
                    </div>
                    <Btn small color={"#e8a13c"} onClick={() => hireObCoach(h)}>コーチに迎える</Btn>
                  </div>
                ))}
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
          <Eyebrow color={C.yellow}>🏆 実績（{computeSeasonAchievements(g).filter(a => a.achieved).length} / {SEASON_ACHIEVEMENTS.length}達成）</Eyebrow>
          <div style={{ display: "grid", gap: 8 }}>
            {computeSeasonAchievements(g).map(a => (
              <div key={a.id} style={{
                background: a.achieved ? "rgba(255,210,63,0.1)" : C.panel, borderRadius: 10, padding: "10px 12px",
                border: `1.5px solid ${a.achieved ? C.yellow : C.line}`, opacity: a.achieved ? 1 : 0.55,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 22 }}>{a.achieved ? a.icon : "🔒"}</span>
                <div>
                  <div style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 13.5, color: a.achieved ? C.yellow : C.text }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>{a.desc}</div>
                  {formatAchievementReward(a) && <div style={{ fontSize: 10.5, color: C.green, marginTop: 1 }}>{formatAchievementReward(a)}</div>}
                </div>
              </div>
            ))}
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
          <Eyebrow color={"#e8a13c"}>👑 通算タイトル</Eyebrow>
          <TitlesPanel />
          <Eyebrow color={"#e8a13c"}>🏅 コースレコード</Eyebrow>
          <CourseRecordsPanel />
          <Eyebrow color={C.purple}>🗂 特殊能力図鑑</Eyebrow>
          <AbilityFileList file={loadAbilityFile()} />
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

          {/* v25: ヘルプを大幅拡充。基本の能力・成長システムから、細かな仕様まで一覧できるようにする */}
          <div>
            <Eyebrow color={C.green}>能力値と特殊能力の基本</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                能力値は<span style={{ color: C.text }}>平坦・登坂・スプリント・スタミナ・独走</span>の5種類（22〜135）。区間の種類ごとに使われる能力が決まり、丘陵は登坂55%＋平坦45%、山頂フィニッシュは登坂70%＋スプリント30%、TT区間は独走60%＋平坦40%というように複数の能力が混ざる区間もあります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                選手は<span style={{ color: C.text }}>特殊能力を0〜3個</span>保有します。地形適性・展開/役割・メンタル・フィジカル・成長の5カテゴリがあり、悪特性（バッドステータス）が混ざることもあります。一定の勝利数や役割出走数を満たすと保有能力が「金特」に強化され、逆に条件を満たせば未保有の能力を後天的に習得することもあります。発見済みの能力は「記録」タブの特殊能力図鑑で内容を確認できます（未発見のものは？？？で伏せられます）。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.yellow}>成長・練習の仕組み</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                選手にはそれぞれ<span style={{ color: C.text }}>成長タイプ</span>（早熟・普通・晩成・超早熟・超晩成）があり、年齢によって「成長期（伸び最大）」「全盛期（伸び半減）」「衰え期（能力が少しずつ下がる）」が切り替わります。ピーク年齢は早熟21〜25歳・普通24〜29歳・晩成28〜33歳・超早熟18〜21歳・超晩成32〜38歳です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                さらに<span style={{ color: C.text }}>成長力（C/B/A/S）</span>が練習・出走経験の伸び方に倍率をかけます（C×0.7・B×1.0・A×1.3・S×1.6）。練習では指定した1能力に90%、残り4能力に14%の伸びが配分されます（トレードオフ）。出走した場合は、レースで使った区間の種目に応じた「出走経験」でも能力が伸び、レースのグレードが高いほど伸びが大きくなります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                能力には難易度ごとの<span style={{ color: C.text }}>ソフトキャップ</span>があります（イージー88・ノーマル94・ハード102・鬼112）。この値未満なら伸びは全開ですが、超えると急激に伸びが鈍化します。上限を超えた金色表示の能力は「限界突破」状態です。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.red}>疲労・コンディション・故障</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                出走すると疲労が+45（「鉄人」持ちは+32）増えます。<span style={{ color: C.red }}>3ヶ月連続で出走（3連闘）すると確定で故障</span>、疲労が90を超えると確率で故障が発生します（ドクターの雇用で確率・離脱期間ともに軽減）。「頑丈」は故障率半減、「ガラスの体」は故障率2倍＆離脱+1ヶ月です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                調子は→（普通）／↗（好調）／↑↑（絶好調）／↘（やや不調）／↓↓（絶不調）の5段階で毎月ランダムに変動します（「ムラっ気」は変動幅が大きく、「精密機械」は小さい）。休養させると疲労が回復します（出走なしなら-50、故障中でも自然回復します）。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.blue}>チームケミストリー・キャプテン制度</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                ロースター平均在籍月数に応じて<span style={{ color: C.text }}>チームケミストリー</span>が「新体制／定着期／円熟したチーム／鉄壁の絆」の順に上がり、レース中のドラフト消耗が最大8%軽減されます。移籍・トレード・解雇が多いと在籍月数がリセットされるため、頻繁な入れ替えは足元のケミストリーを崩すコストがあります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                任命した<span style={{ color: C.text }}>キャプテン</span>より2歳以上若い選手は練習効果+10%になりますが、キャプテン自身の練習効果は-5%になります（誰でも任命した方が得、にはならないよう小さなトレードオフがあります）。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={"#6fa8dc"}>天候</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                レースごとに晴れ・🌧雨・🥵猛暑のいずれかが決まります（カレンダー・出走前画面に表示）。<span style={{ color: C.text }}>雨</span>は出走選手全員の能力を一律で下げ（「悪天候巧者」持ちは軽減）、持たない選手には落車による負傷離脱のリスクも上乗せされます。<span style={{ color: C.text }}>猛暑</span>は出走後の疲労蓄積が増えます。横風区間の影響（「横風耐性」で軽減）とは別の、レース全体にかかる要素です。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.purple}>キャンプ・機材・スタッフ</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                <span style={{ color: C.text }}>トレーニングキャンプ券</span>を使うとその月の練習効果が×2になりますが、選手全員の疲労が+25されます。クールダウンはありませんが、連発すると疲労90超＝故障リスクゾーンに入りやすくなるため、使いどころの見極めが重要です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                恒常装備：<span style={{ color: C.text }}>エアロフレーム</span>（平坦+6%/Lv）・<span style={{ color: C.text }}>軽量ホイール</span>（登坂+6%/Lv）・<span style={{ color: C.text }}>トレーニング設備</span>（練習効果+15%/Lv）は買い切りで恒常的に効果が続きます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                スタッフは月給制：<span style={{ color: C.text }}>監督</span>（スポンサー契約が有利に）・<span style={{ color: C.text }}>トレーナー</span>（練習効果が恒常アップ）・<span style={{ color: C.text }}>ドクター</span>（故障率と離脱期間を軽減）。雇用できるレベル上限はクラスが上がるほど増えます。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={"#e8a13c"}>グランツール・副次クラシフィケーション</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                PROクラス限定で年3回（春・夏・秋）、3日間ステージレースの<span style={{ color: C.text }}>グランツール</span>が開催されます。グランファイナルへの出場には、その年の3戦すべてで総合優勝することが条件です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                グランツールでは総合成績とは別に、🟢ポイント賞（各区間の着順ポイント合計）・🔴山岳賞（山岳区間の着順ポイント合計）・⚪新人賞（26歳未満限定）の<span style={{ color: C.text }}>副次クラシフィケーション</span>が争われ、自チームが獲得すると賞金ボーナスが入ります。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.green}>ディナスティ周回・ユース育成枠</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                グランファイナル制覇後、「新たなチームで最初から」ではなく<span style={{ color: C.text }}>この轍を継いでさらなる高みへ</span>を選ぶと、同じチームのまま周回を継続できます（ディナスティモード）。周回を重ねるたびに他チームの地力が底上げされ、歯応えが保たれます。クリアポイントは周回のたびに再獲得できます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                「選手・練習」タブでは年1回だけ、契約金15万円で<span style={{ color: C.text }}>ユース選手（16〜17歳・成長力A以上確定）</span>を確保できます。現在の能力は低いですが、長期育成向けの原石です。使用枠は4月の年度替わりでリセットされます。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.sub}>スカウト・移籍・トレード・実績</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                毎年4月は新人スカウト月間。事前に選んだ方針（おまかせ／スプリント重視／登坂力重視／将来性重視／即戦力重視）に応じて候補5名の傾向が変わります。年間を通じてFA市場・他チームからのトレード提案・選手解雇（4月のみ）も利用できます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                実績を達成すると報酬（賞金や恒常ボーナス）が入ります。詳細な一覧は「記録」タブで確認できます。解雇・引退した選手のうち、実績かお気に入り登録の条件を満たした選手だけが殿堂入りとして名鑑に残ります。
              </div>
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

  // v28: 選手の移籍志願イベント
  if (g.screen === "transferRequest" && g.transferRequest) {
    const req = g.transferRequest;
    const r = g.roster.find(x => x.id === req.riderId);
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: "#2b1e1e", borderRadius: 12, padding: 18, borderTop: `4px solid ${C.red}` }}>
          <Eyebrow color={C.red}>移籍志願 — {MONTHS[g.month]}</Eyebrow>
          <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 19, margin: "6px 0 10px" }}>{req.name}が退団を申し出た</h2>
          <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.8, margin: 0 }}>
            「最近ずっと出番がなく、このチームでは自分の力を発揮できない。もっと走れる場所へ移りたい」——長くベンチが続いた{req.name}{r ? `（${TYPES[r.type].label}・OVR${overall(r)}）` : ""}が、真剣な面持ちで移籍を願い出てきました。
          </p>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <Btn color={C.green} disabled={g.budget < 30} onClick={retainRider}>慰留する（引き止め費用30万・残留＆調子+1）{g.budget < 30 ? "／資金不足" : ""}</Btn>
          <Btn outline color={C.red} onClick={() => askConfirm(`${req.name}の移籍志願を受け入れますか？この選手はチームを去ります。`, grantTransferRequest)}>志願を受け入れて送り出す</Btn>
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
        <div style={{ fontSize: 11.5, color: C.sub }}>会場・グレードは月初に確定するため、先の月は目安です。天候予報も併記します（☀️晴れ／🌧雨／🥵猛暑）。</div>
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
                {races.map(r => `${r.championship ? "👑" : ""}${r.weather && r.weather !== "clear" ? WEATHER[r.weather].icon : ""}${r.name}${"★".repeat(r.grade)}`).join(" ／ ")}
              </div>
            </div>
          );
        })}
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  // v27: 今季のチームポイント順位表
  if (g.screen === "standings") {
    const rows = computeStandings(g);
    return wrap(
      <div style={{ display: "grid", gap: 10 }}>
        <Eyebrow color={C.purple}>今季のチーム順位表（{g.year}年目・{cls.label}）</Eyebrow>
        <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.7 }}>
          {MONTHS[g.month]}時点の推定ポイント順位です。他チームのポイントは想定値ですが、昇格ライン（{CLASSES[g.classIdx].need}pt）到達の目安として自チームの立ち位置を確認できます。
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: "6px 10px", display: "grid", gap: 2 }}>
          {rows.map((row, i) => (
            <div key={row.name} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 8px",
              borderRadius: 8, background: row.isPlayer ? "rgba(255,210,63,0.12)" : "transparent",
              borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : "none",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: FONT_M, fontSize: 14, color: i === 0 ? C.yellow : C.sub, width: 22 }}>{i + 1}.</span>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: row.color, display: "inline-block" }} />
                <span style={{ fontFamily: FONT_D, fontWeight: 700, color: row.isPlayer ? C.yellow : C.text, fontSize: 13.5 }}>{row.name}</span>
              </span>
              <span style={{ fontFamily: FONT_M, fontSize: 14, color: row.isPlayer ? C.yellow : C.text }}>{row.pts}pt</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.sub }}>3月のチャンピオンシップ3位以内で昇格できます。順位表はあくまで参考で、昇格判定はチャンピオンシップの結果で決まります。</div>
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  // v28: トロフィールーム。通算タイトル・殿堂入り選手・生涯評価スコアを一堂に集めた栄誉の間
  if (g.screen === "trophy") {
    const pres = computePrestige();
    const hof = g.hallOfFame || [];
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid #e8a13c`, textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>🏆</div>
          <h2 style={{ fontFamily: FONT_D, color: "#e8a13c", fontSize: 22, margin: "6px 0" }}>トロフィールーム</h2>
          <div style={{ fontSize: 11, color: C.sub }}>生涯評価スコア</div>
          <div style={{ fontFamily: FONT_M, fontSize: 30, color: C.yellow, fontWeight: 700 }}>{pres.score}</div>
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4 }}>累計CP{pres.totalEarnedCP} ・ 殿堂{pres.legendCount}人 ・ 通算タイトル{pres.titleCount}</div>
        </div>
        <Eyebrow color={"#e8a13c"}>👑 通算タイトル</Eyebrow>
        <TitlesPanel />
        <Eyebrow color={C.purple}>🏛 このチームの殿堂入り選手（{hof.length}名）</Eyebrow>
        {hof.length === 0
          ? <div style={{ fontSize: 12, color: C.sub }}>まだ殿堂入り選手はいません。実績を残した選手が引退・退団すると刻まれます。</div>
          : (
            <div style={{ display: "grid", gap: 8 }}>
              {hof.slice().reverse().map((r, i) => {
                const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
                const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
                const nick = riderNickname(r);
                return (
                  <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 14 }}>{r.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: TYPES[r.type].color }}>{TYPES[r.type].label}</span></span>
                      <span style={{ fontSize: 10.5, color: C.sub }}>{r.farewellYear}年目に{r.farewellReason === "released" ? "退団" : "引退"}</span>
                    </div>
                    {nick && <div style={{ fontSize: 11.5, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{nick}」</div>}
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>通算{(r.raceLog || []).length}戦・{wins}勝・{podiums}表彰台</div>
                  </div>
                );
              })}
            </div>
          )}
        <Btn outline color={C.sub} onClick={() => setG(s => ({ ...s, screen: "main" }))}>← 戻る</Btn>
      </div>
    );
  }

  // v29: 出走表（シーズン）。事前生成した相手チーム布陣＋現在の自チーム選抜を一覧表示
  if (g.screen === "startlist") {
    const race = g.races.find(r => r.id === g.sel.raceId);
    const playerEntrants = g.roster.filter(r => (g.sel.starters || []).includes(r.id))
      .map(r => ({ name: r.name, type: r.type, teamName: g.teamName || "あなたのチーム", color: C.yellow, team: "PLAYER", isAce: r.id === g.sel.ace }));
    const aiEntrants = (g.pendingAiTeams || []).flat();
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <Eyebrow color={C.purple}>🏁 出走表 — {race ? race.name : ""}</Eyebrow>
        {playerEntrants.length === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>まだ自チームの出走メンバーを選んでいません。相手の布陣を見て編成を決めましょう。</div>}
        <StartListPanel entrants={[...playerEntrants, ...aiEntrants]} />
        <Btn onClick={() => setG(s => ({ ...s, screen: "lineup" }))}>← 編成に戻る</Btn>
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
          {race.weather && race.weather !== "clear" && (
            <div style={{ fontSize: 12, color: race.weather === "rain" ? C.blue : C.red, marginTop: 2 }}>
              {WEATHER[race.weather].icon} 天候：{WEATHER[race.weather].label}
              {race.weather === "rain" ? "（悪天候巧者以外は能力低下・落車リスク増）" : "（出走後の疲労蓄積が増える）"}
            </div>
          )}
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
                      {COND_ARROW[r.cond - 1]}<CondFc dir={r.condForecast} /> <span style={{ color: C.yellow }}>{overall(r)}</span>
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>{DISCIPLINES[fitKey].label}適性<span style={{ color: C.yellow, fontFamily: FONT_M }}> {fitScore}</span></span>
                    </span>
                  </div>
                  <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
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
          {g.pendingAiTeams && <Btn outline color={C.purple} onClick={() => setG(s => ({ ...s, screen: "startlist" }))}>🏁 出走表（他チームの布陣）を見る</Btn>}
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
      <RaceErrorBoundary onRecover={raceFinishHandler}>
        <RaceView sim={g.result} onFinish={raceFinishHandler} />
      </RaceErrorBoundary>
      <div style={{ marginTop: 8, fontSize: 12, color: C.sub }}>
        ● 印＝あなたのチーム／黄ジャージ＝エース。位置が近い選手同士が自然にグループを作り、千切れ・吸収・ローテーションが発生します。
      </div>
    </div>
  );

  if (g.screen === "result_pending") return wrap(<div style={{ color: C.sub }}>結果集計中…</div>);

  if (g.screen === "result" && g.result && g.prizeInfo) {
    const { race, prize, pts, best, mandateHit, breakSurvived, hadBreak, courseRecord } = g.prizeInfo;
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
          {courseRecord && courseRecord.isNew && (
            <div style={{ fontSize: 12.5, color: courseRecord.isPlayer ? C.yellow : C.text, marginTop: 4, fontWeight: 700 }}>
              🏅 {courseRecord.kind}のコースレコード更新！（指数{courseRecord.speed}／達成：{courseRecord.holder}{courseRecord.isPlayer ? "・自チーム" : ""}）
            </div>
          )}
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
        <Btn onClick={() => advanceMonth({ starters: g.sel.starters, expKeys, grade: race.grade, weather: race.weather, raceId: g.sel.raceId, grandTour: !!race.grandTour, stageCount: race.stageCount })}>翌月へ進む →</Btn>
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
          {/* v14.14: 作戦変更画面でも選手の能力を見た上でエース・役割を決められるよう、
              その日のコース適性（disciplineScore）と能力グリッドを一覧表示する */}
          <Eyebrow color={C.sub}>出走メンバーの能力（{nextStageNo}日目のコース適性）</Eyebrow>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {squad.map(r => {
              const t = TYPES[r.type];
              const fitKey = FAVORS_TO_DISCIPLINE[dayTmpl.favors];
              const fitScore = disciplineScore(r, fitKey);
              return (
                <div key={r.id} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1.5px solid ${sel.ace === r.id ? C.yellow : C.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{sel.ace === r.id ? "👑 " : ""}{r.name}
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: t.color }}>{t.label}</span>
                    </span>
                    <span style={{ fontFamily: FONT_M, fontSize: 12, color: COND_COLOR[r.cond - 1] }}>
                      {COND_ARROW[r.cond - 1]}<CondFc dir={r.condForecast} /> <span style={{ color: C.yellow }}>{overall(r)}</span>
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: C.sub }}>{DISCIPLINES[fitKey].label}適性<span style={{ color: C.yellow, fontFamily: FONT_M }}> {fitScore}</span></span>
                    </span>
                  </div>
                  <TraitLine abilities={r.abilities} goldAbilities={r.goldAbilities} />
                  <FatigueBar v={r.fatigue} />
                  <AbilityGrid r={r} cap={growthCap} />
                </div>
              );
            })}
          </div>
        </section>
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
    const { gcOrder, idToEntrant, bestRank, prize, pts, jerseyInfo, jerseyBonus } = g.gc;
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
        {jerseyInfo && (
          <div style={{ background: C.panel, borderRadius: 12, padding: 14, borderTop: `4px solid ${"#e8a13c"}` }}>
            <Eyebrow color={"#e8a13c"}>副次クラシフィケーション</Eyebrow>
            <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
              <div style={{ fontSize: 12.5, color: jerseyInfo.pointsLeaderIsPlayer ? C.yellow : C.text }}>
                🟢 ポイント賞：{jerseyInfo.pointsLeaderName || "—"}{jerseyInfo.pointsLeaderIsPlayer && " （自チーム！+50万円）"}
              </div>
              <div style={{ fontSize: 12.5, color: jerseyInfo.komLeaderIsPlayer ? C.yellow : C.text }}>
                🔴 山岳賞：{jerseyInfo.komLeaderName || "—"}{jerseyInfo.komLeaderIsPlayer && " （自チーム！+50万円）"}
              </div>
              <div style={{ fontSize: 12.5, color: jerseyInfo.youthLeaderIsPlayer ? C.yellow : C.text }}>
                ⚪ 新人賞（26歳未満）：{jerseyInfo.youthLeaderName || "該当者なし"}{jerseyInfo.youthLeaderIsPlayer && " （自チーム！+30万円）"}
              </div>
            </div>
            {jerseyBonus > 0 && <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>副次タイトルボーナスとして賞金に+{jerseyBonus}万円を上乗せ済み</div>}
          </div>
        )}
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
        <Btn onClick={() => advanceMonth({ starters: g.gc.starters, expKeys, grade: g.gc.race.grade, weather: g.gc.race.weather, raceId: g.gc.race.id, grandTour: !!g.gc.race.grandTour, stageCount: g.gc.race.stageCount })}>翌月へ進む →</Btn>
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
        {/* v25: 制覇後もこの轍（チーム）を引き継いで周回できるディナスティモード。
            周を重ねるたびに他チームの地力が上がり、歯応えを保ったまま挑戦を続けられる */}
        <Btn onClick={() => setG(s => ({ ...s, dynastyLevel: (s.dynastyLevel || 0) + 1, screen: "yearend" }))}>
          🔁 この轍を継いでさらなる高みへ（{(g.dynastyLevel || 0) + 1}周目へ・他チームがさらに強化される）
        </Btn>
        <Btn outline onClick={() => { clearSaveGame(); setG(initGame()); }}>新たなチームで最初から</Btn>
      </div>
    );
  }

  return wrap(<div style={{ color: C.sub }}>読み込み中…</div>);
}

function t_label(type) { return TYPES[type]?.label || type; }

export default App;
