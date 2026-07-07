import React, { useState, useRef, useEffect, useMemo } from "react";

/* =========================================================
   ロードレース・プロチーム運営 v10
   v9からの変更（詳細は roadrace_design_v10.md 参照）：
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
const softFactor = (v) => (v < 88 ? 1 : Math.exp(-(v - 88) / 4));
const addAb = (r, k, amount) => { r[k] = r[k] + amount * softFactor(r[k]); };
const COND_ARROW = ["↓↓", "↘", "→", "↗", "↑↑"];
const COND_COLOR = ["#7a8296", "#8fa0b8", "#9aa3b5", "#7dd0a0", "#35c07e"];
const condMul = (c) => [0.92, 0.96, 1.0, 1.04, 1.08][c - 1];

const CLASSES = [
  { id: "B1", label: "クラス B1", prizeMul: 1.0, need: 45, scout: 58 },
  { id: "A",  label: "クラス A",  prizeMul: 2.0, need: 50, scout: 66 },
  { id: "PRO", label: "PRO", prizeMul: 3.5, need: 60, scout: 74 },
];
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
const CHASE_MODES = {
  push:      { label: "追走強化", desc: "牽引役のローテーション頻度を上げてペースを上げる（脚の消耗が早まる）" },
  hold:      { label: "静観", desc: "牽引役の脚を温存し、ギャップの拡大を許容する" },
  ace_early: { label: "エース早期発射", desc: "エースが単独アタック。エネルギー切れで大失速のリスクあり（1回限り）" },
};

// v9: 出走人数を固定値からsquadMin〜squadMaxの幅に変更（編成画面で選択）
const TEMPLATES = [
  { kind: "クリテリウム", favors: "SPR", squadMin: 1, squadMax: 5, segs: [["flat", 480, 26], ["flat", 480, 26], ["sprint", 130, 4]] },
  { kind: "サーキットレース", favors: "SPR", squadMin: 1, squadMax: 5, segs: [["flat", 440, 24], ["flat", 440, 24], ["flat", 400, 20], ["sprint", 130, 4]] },
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
const SURNAMES = ["相馬", "桐生", "白鳥", "早瀬", "神楽", "水城", "燕", "嵐山", "灰原", "東雲", "氷室", "真壁", "夏目", "御堂", "九条", "橘", "篝", "斑鳩"];
const GIVEN = ["蓮", "岳", "走", "迅", "颯", "翼", "剛", "凌", "駆", "峻", "隼", "湊", "遼", "陸"];
let RID = 100;
// v7: OVRは上位加重（特化型を正しく評価）
function overall(r) {
  const vals = AB_KEYS.map(k => r[k]).sort((a, b) => b - a);
  return Math.round(vals[0] * 0.5 + vals[1] * 0.3 + (vals[2] + vals[3] + vals[4]) / 3 * 0.2);
}
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
  let growth = gKeys[Math.floor(rng() * 3)];
  if (age <= 19 && rng() < 0.5) growth = "late";
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
    name: SURNAMES[Math.floor(rng() * SURNAMES.length)] + " " + GIVEN[Math.floor(rng() * GIVEN.length)],
    type, ...r, age, growth, growthPow: growthPowVal, trait, personality,
    fatigue: 20 + Math.floor(rng() * 20), cond: 3, injury: 0, streak: 0,
    focus: "flat", joinOvr: 0, parts: { frame: null, tire: null, wheels: null, nutrition: null },
    prodigy: !!opts.forceProdigy,
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
    };
    r.joinOvr = overall(r); return r;
  };
  return [
    mk("佐伯 蓮", "SPR", 66, 38, 82, 60, 48, 25, "normal", "A", "closer", "hotblood"),
    mk("高梨 岳", "CLM", 52, 80, 34, 72, 58, 27, "late", "B", "mount", "seeker"),
    mk("三浦 走", "RUL", 76, 56, 52, 76, 64, 28, "normal", "C", "domestique", "artisan"),
    mk("綾瀬 迅", "PUN", 62, 67, 64, 62, 56, 23, "early", "A", null, "normal"),
    mk("氷室 圭", "TT", 64, 46, 44, 64, 76, 26, "normal", "B", null, "free"),
    mk("燕 翔太", "RUL", 48, 42, 44, 52, 46, 19, "late", "S", "iron", "genius"),
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
function genScouts(classIdx, seed, policy = "balance") {
  const rng = mulberry(seed);
  const base = CLASSES[classIdx].scout;
  const count = SCOUT_COUNT_BY_CLASS[classIdx];
  const specs = scoutSpecs(policy, count);
  const prodigyRng = mulberry(seed + 999);
  const hasProdigy = prodigyRng() < PRODIGY_CHANCE_BY_CLASS[classIdx];
  const prodigyIdx = hasProdigy ? Math.floor(prodigyRng() * count) : -1;
  return specs.map((s, i) => {
    const opts = { age: s.age, powDist: s.powDist };
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
function genMonthRaces(year, month, classIdx, points, sponsor) {
  const rng = mulberry(year * 1000 + month * 37 + 5);
  const races = [];
  if (month === 11) {
    const qualified = points >= CLASSES[classIdx].need;
    if (classIdx === 0) {
      races.push({
        id: `champ-${year}-${classIdx}`, championship: true, locked: !qualified, stageRace: true, stageCount: 2,
        name: "A昇格ステージレース（2日間・総合タイム）",
        tmpl: TEMPLATES[3], grade: 3, cls: classIdx,
        lockReason: qualified ? null : `出場権なし（${CLASSES[classIdx].need}pt必要）`,
      });
    } else {
      races.push({
        id: `champ-${year}-${classIdx}`, championship: true, locked: !qualified,
        name: classIdx === 2 ? "グランファイナル" : `${CLASSES[classIdx].id}昇格チャンピオンシップ`,
        tmpl: TEMPLATES[3], grade: 3, cls: classIdx,
        lockReason: qualified ? null : `出場権なし（${CLASSES[classIdx].need}pt必要）`,
      });
    }
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
  const tmpl = raceMeta.tmpl;
  // v8: dayTagを混ぜることで、2日間ステージレースの各日で別コースになるようにする（同一レースIDの使い回し対策）
  const crng = mulberry(strHash(raceMeta.id + raceMeta.name + (dayTag || "")));
  const LEN = 300 + crng() * 120;
  const amp1 = 20 + crng() * 26, f1 = 2.2 + crng() * 2.2, ph1 = crng() * Math.PI * 2;
  const amp2 = 4 + crng() * 9, f2 = 8 + crng() * 8, ph2 = crng() * Math.PI * 2;
  const steepness = 0.75 + crng() * 0.6; // 0.75〜1.35：この山/丘がきついかどうか
  const segs = tmpl.segs.map(([type, base, dist]) => ({ type, base, dist, label: SEG_LABEL[type] }));
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
    for (let j = 0; j < segs.length; j++) { if (frac <= cumFrac[j] + 1e-6) return { type: segs[j].type, idx: j }; }
    return { type: segs[segs.length - 1].type, idx: segs.length - 1 };
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
const DRAIN_K = 1.15;
const BASE_TICK_DIST = 0.26;      // 能力70・エネルギー満タン時の基準移動量/tick
const ATTACK_TICKS = 25;          // アタック持続（25秒）
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
function energyDrain(en, mode, segType, steepness) {
  return TICK_SEC * (1 - en.stamina / 150) * DRAIN_K * effortCost(mode, segType, steepness);
}
// 役割ごとに「今この地形で牽引役になれるか」
function canPull(en, segType) {
  if (en.isAce) return false;
  if (en.role === "breakaway") return true;
  if (en.role === "lead") return true;
  if (en.role === "sub") return en.energy > 0;
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
      en.pos = 0; en.energy = 100; en.finished = false; en.finishTime = null; en.attackLeft = 0;
      en.posHist = []; en.energyHist = []; en.modeHist = []; en.groupHist = [];
    });
  } else {
    riders.forEach(en => {
      const idx = Math.min(fromTick - 1, en.posHist.length - 1);
      en.pos = en.posHist[idx]; en.energy = en.energyHist[idx];
      en.posHist = en.posHist.slice(0, fromTick); en.energyHist = en.energyHist.slice(0, fromTick);
      en.modeHist = en.modeHist.slice(0, fromTick); en.groupHist = en.groupHist.slice(0, fromTick);
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
        if (en.attackLeft > 0) en.attackLeft--;
        return;
      }
      const segType = course.segTypeAt(members[0].pos).type;
      let eligible = members.filter(en => canPull(en, segType));
      let rotSpan = ROTATION_PERIOD_TICKS;
      if (directive.chaseMode === "push") rotSpan = Math.max(2, ROTATION_PERIOD_TICKS - 2);
      if (directive.chaseMode === "hold") rotSpan = ROTATION_PERIOD_TICKS + 3;
      const rotIdx = Math.floor(tick / rotSpan);
      const puller = eligible.length ? eligible[rotIdx % eligible.length] : null;
      members.forEach(en => {
        if (en.attackLeft > 0) { en.mode = "attack"; en.attackLeft--; return; }
        en.mode = (puller && en === puller) ? "pull" : "draft";
      });
    });
    // 3. 移動：先にpull/solo/attackを確定、その後draftが「ついていけるか」を判定
    active.forEach(en => {
      if (en.mode === "draft") return;
      const segType = course.segTypeAt(en.pos).type;
      const dist = tickDistance(en, segType, en.mode, course.steepness);
      en.lastOwnDist = dist;
      en.pos = Math.min(course.length, en.pos + dist);
      en.energy -= energyDrain(en, en.mode, segType, course.steepness);
    });
    Object.values(groups).forEach(members => {
      const puller = members.find(en => en.mode === "pull");
      if (!puller) return;
      members.filter(en => en.mode === "draft").forEach(en => {
        const segType = course.segTypeAt(en.pos).type;
        const groupDist = puller.lastOwnDist;
        const ownCapable = tickDistance(en, segType, "pull", course.steepness);
        let dist;
        if (ownCapable >= groupDist * 0.9) dist = groupDist;
        else { dist = ownCapable; en.mode = "solo"; }
        en.pos = Math.min(course.length, en.pos + dist);
        en.energy -= energyDrain(en, en.mode === "solo" ? "solo" : "draft", segType, course.steepness);
      });
    });
    // 4. 履歴記録・ゴール判定
    active.forEach(en => {
      en.posHist[tick] = en.pos; en.energyHist[tick] = en.energy;
      en.modeHist[tick] = en.mode; en.groupHist[tick] = en.groupId;
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
// 📻中断：現在の実時間rtNowから、自チームエースの現在ティックを基準に未走行分だけ再計算
function regroupTicks(sim, rtNow, chaseMode, aceEarly) {
  if (sim.groupMode === "solo") return;
  const ref = sim.riders.find(e => e.team === "PLAYER" && e.isAce) || sim.riders.find(e => e.team === "PLAYER") || sim.riders[0];
  const fromTick = Math.min(MAX_TICKS - 1, Math.floor(rtNow / TICK_SEC) + 1);
  simulateTicks(sim.course, sim.riders, fromTick, { chaseMode, aceEarly }, sim.groupMode === "solo");
  sim.entrants = sim.riders;
  rankSim(sim);
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
function buildSim(raceMeta, squad, aceId, roles, equip, itemBoost, classIdx, fixedAiTeams, dayTag) {
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
    const aiDefs = [
      { name: "レッドサンダー山陽", color: "#d9484a" }, { name: "クレディ・ブルー", color: "#3f7fd9" },
      { name: "ヴェロチタ京都", color: "#9a6be0" }, { name: "ウィンドミル北海道", color: "#e08a3f" },
    ];
    const power = 52 + classIdx * 9 + (raceMeta.grade - 1) * 4 + (raceMeta.championship ? 6 : 0);
    const squadN = squad.length;
    aiTeamsUsed = aiDefs.map(d => {
      const members = [];
      for (let i = 0; i < squadN; i++) members.push(newRider(power + (i === 0 ? 6 : 0), rng));
      const aiRoles = assignAIRoles(members, squadN);
      return members.map((r, i) => ({
        id: r.id, name: r.name, type: r.type, trait: r.trait,
        flat: r.flat, climb: r.climb, sprint: r.sprint, stamina: r.stamina, solo: r.solo,
        team: d.name, teamName: d.name, color: d.color, isAce: i === 0, role: aiRoles[r.id],
      }));
    });
    aiTeamsUsed.forEach(list => list.forEach(en => riders.push({ ...en })));
  }
  const sim = { entrants: riders, riders, course, groupMode, raceMeta, breakSurvived: false };
  const roleMap = {}; riders.forEach(en => { roleMap[en.id] = en.role; });
  simulateTicks(course, riders, 0, { chaseMode: "normal", aceEarly: false }, groupMode === "solo");
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
function AbilityGrid({ r }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginTop: 6 }}>
      {AB_KEYS.map(k => {
        const partBonus = r.parts ? PART_SLOTS.reduce((s, sl) => s + ((r.parts[sl] && PARTS[r.parts[sl]].ab[k]) || 0), 0) : 0;
        const broke = r[k] >= 95;
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

// v9: コース形状（横揺れ）・標高から、俯瞰マップ用のY座標・側面マップ用のY座標を計算
function topLateral(course, frac) {
  return Math.sin(frac * Math.PI * course.f1 + course.ph1) * course.amp1 + Math.sin(frac * course.f2 + course.ph2) * course.amp2;
}
const MAP_W = 660, TOP_H = 120, SIDE_H = 80, MAP_PAD = 18;
function RaceView({ sim, onFinish }) {
  const [hud, setHud] = useState({ top: [], seg: "", clock: 0, done: false, comment: "", gap: null });
  const [ridersUi, setRidersUi] = useState([]);
  const [chaseUi, setChaseUi] = useState("normal");
  const [aceEarlyUsed, setAceEarlyUsed] = useState(false);
  const [locked, setLocked] = useState(false);
  const chaseRef = useRef("normal");
  const speedRef = useRef(1);
  const [speedUi, setSpeedUi] = useState(1);
  const skipRef = useRef(false);
  const tickRef = useRef(null);
  const rtRef = useRef(0);
  const totalRef = useRef(1);
  const lockedRef = useRef(false);
  const liveRef = useRef({ text: "", until: 0 });
  const PLAY_DUR = 40;
  const course = sim.course;

  const changeChase = (k) => {
    if (hud.done || lockedRef.current) return;
    if (k === "ace_early") {
      if (aceEarlyUsed) return;
      regroupTicks(sim, rtRef.current, chaseRef.current, true);
      setAceEarlyUsed(true);
      liveRef.current = { text: "📻 エースが単独アタック！エネルギー切れに注意", until: performance.now() + 3500 };
    } else {
      if (k === chaseUi) return;
      chaseRef.current = k;
      regroupTicks(sim, rtRef.current, k, false);
      setChaseUi(k);
      liveRef.current = { text: `📻 指示変更：「${CHASE_MODES[k].label}」`, until: performance.now() + 3500 };
    }
    totalRef.current = Math.max(...sim.entrants.map(e => e.finishTime));
  };

  const topPath = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const f = i / 60;
      const range = course.amp1 + course.amp2 || 1;
      const y = TOP_H / 2 - (topLateral(course, f) / range) * (TOP_H / 2 - 14);
      pts.push(`${MAP_PAD + f * (MAP_W - MAP_PAD * 2)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  }, [sim]);
  const sidePath = useMemo(() => {
    const maxElev = Math.max(1, ...course.elevationProfile.map(p => p.elev));
    return course.elevationProfile.map(p => {
      const x = MAP_PAD + p.frac * (MAP_W - MAP_PAD * 2);
      const y = SIDE_H - 12 - (p.elev / maxElev) * (SIDE_H - 24);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [sim]);
  const topYAt = (f) => { const range = course.amp1 + course.amp2 || 1; return TOP_H / 2 - (topLateral(course, f) / range) * (TOP_H / 2 - 14); };
  const sideYAt = (f) => { const maxElev = Math.max(1, ...course.elevationProfile.map(p => p.elev)); return SIDE_H - 12 - (course.yAt(f) / maxElev) * (SIDE_H - 24); };

  useEffect(() => {
    const teamNames = [...new Set(sim.entrants.map(e => e.team))];
    const teamLane = {}; teamNames.forEach((t, i) => { teamLane[t] = (i - (teamNames.length - 1) / 2) * 5; });
    const riders = sim.entrants.map((e) => ({
      e, lane: teamLane[e.team], frac: 0, mode: "draft", gid: e.id,
      color: e.team === "PLAYER" && e.isAce ? C.yellow : e.color,
    }));

    totalRef.current = Math.max(...sim.entrants.map(e => e.finishTime));
    const baseEvents = [];
    course.segs.forEach((s, j) => {
      const fracStart = j === 0 ? 0 : course.cumFrac[j - 1];
      baseEvents.push({ t: fracStart, text: `🎙 ${s.label}へ突入！` });
    });
    baseEvents.push({ t: 0.985, text: "🎙 フィニッシュ！" });

    let clock = 0, prev = performance.now(), done = false, lastHud = 0, intervalId = null;
    const tick = () => {
      if (done) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (skipRef.current) clock = PLAY_DUR;
      else clock = Math.min(PLAY_DUR, clock + dt * speedRef.current);
      const rt = (clock / PLAY_DUR) * totalRef.current;
      rtRef.current = rt;
      let leadFrac = 0;
      riders.forEach((r) => {
        r.frac = interpFrac(r.e, rt, course);
        r.gid = groupAt(r.e, rt);
        r.mode = modeAt(r.e, rt);
        if (r.frac > leadFrac) leadFrac = r.frac;
      });
      // 最終区間ロック判定
      if (!lockedRef.current) {
        const anyInFinal = riders.some(r => course.segTypeAt(r.frac * course.length).idx >= course.finalIdx);
        if (anyInFinal) { lockedRef.current = true; setLocked(true); }
      }
      setRidersUi(riders.map(r => ({ id: r.e.id, frac: r.frac, mode: r.mode, color: r.color, isAce: r.e.isAce, isPlayer: r.e.team === "PLAYER", lane: r.lane })));
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
        setHud({ top, seg: segLabel, clock: rt, done: isDone, comment, gap: gapText });
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
          <div style={{ fontFamily: FONT_D, fontSize: 12, color: C.yellow }}>{hud.seg}</div>
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
      <div>
        <Eyebrow color={C.sub}>俯瞰マップ（コースの左右の揺れ）</Eyebrow>
        <svg viewBox={`0 0 ${MAP_W} ${TOP_H}`} style={{ width: "100%", height: 120, background: "#3f5a3a", borderRadius: 8, marginTop: 4 }}>
          <polyline points={topPath} fill="none" stroke="#8a8f98" strokeWidth="9" strokeLinecap="round" />
          <circle cx={MAP_W - MAP_PAD} cy={topYAt(1)} r="4" fill={C.red} />
          {ridersUi.map(r => (
            <g key={r.id} transform={`translate(${MAP_PAD + r.frac * (MAP_W - MAP_PAD * 2)},${topYAt(r.frac) + r.lane})`}>
              {r.mode === "attack" && <circle r="8" fill="none" stroke={C.red} strokeWidth="1.5" opacity="0.85" />}
              <circle r={r.isAce ? 5.5 : 4} fill={r.color} stroke={r.mode === "pull" ? "#fff" : "#14171d"} strokeWidth={r.mode === "pull" ? 2 : 0.75} />
              {r.isPlayer && <circle r="1.5" fill="#14171d" />}
            </g>
          ))}
        </svg>
      </div>
      <div>
        <Eyebrow color={C.sub}>側面マップ（コースの上下の起伏）</Eyebrow>
        <svg viewBox={`0 0 ${MAP_W} ${SIDE_H}`} style={{ width: "100%", height: 80, background: "#232a20", borderRadius: 8, marginTop: 4 }}>
          <polyline points={`${MAP_PAD},${SIDE_H - 4} ${sidePath} ${MAP_W - MAP_PAD},${SIDE_H - 4}`} fill="rgba(255,210,63,0.12)" stroke="none" />
          <polyline points={sidePath} fill="none" stroke="#8a8f98" strokeWidth="2" />
          {ridersUi.map(r => (
            <g key={r.id} transform={`translate(${MAP_PAD + r.frac * (MAP_W - MAP_PAD * 2)},${sideYAt(r.frac) - Math.abs(r.lane) * 0.6})`}>
              {r.mode === "attack" && <circle r="7" fill="none" stroke={C.red} strokeWidth="1.5" opacity="0.85" />}
              <circle r={r.isAce ? 5 : 3.5} fill={r.color} stroke={r.mode === "pull" ? "#fff" : "#14171d"} strokeWidth={r.mode === "pull" ? 1.8 : 0.6} />
            </g>
          ))}
        </svg>
      </div>
      <div style={{ fontSize: 10, color: C.sub, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span>● 黄色＝エース</span><span>白縁＝牽引中</span><span style={{ color: C.red }}>◎ 赤丸＝アタック中</span>
      </div>
      {hud.comment && (
        <div style={{ background: C.panel2, borderRadius: 6, padding: "6px 10px", fontSize: 13, color: C.text }}>
          {hud.comment}
        </div>
      )}
      {sim.groupMode !== "solo" && !hud.done && (
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(CHASE_MODES).map(([k, t]) => {
            const active = k === "ace_early" ? aceEarlyUsed : chaseUi === k;
            const dis = locked || (k === "ace_early" && aceEarlyUsed);
            return (
              <button key={k} disabled={dis} onClick={() => changeChase(k)}
                style={{
                  flex: 1, padding: "6px 2px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, fontFamily: FONT_D, cursor: dis ? "default" : "pointer",
                  background: active ? C.green : C.panel2, color: active ? "#14171d" : C.text,
                  border: `1px solid ${active ? C.green : C.line}`, opacity: dis ? 0.5 : 1,
                }}>📻 {t.label}</button>
            );
          })}
        </div>
      )}
      {locked && !hud.done && (
        <div style={{ fontSize: 10.5, color: C.sub, textAlign: "center" }}>
          最終区間に突入：無線での介入は締め切りました
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
  return {
    screen: "intro", tab: "home",
    year: 1, month: 0, classIdx: 0, points: 0, budget: 300,
    roster: initRoster(),
    equip: { frame: 0, wheels: 0, facility: 0 },
    inv: { wheel: 0, suit: 0, supp: 0, tune: 0, camp: 0 },
    partsInv: {},
    camp: false, campCooldown: 0,
    sponsor: null,
    sponsorOffers: genSponsors(0, 1),
    scoutPolicy: "balance",
    scouts: genScouts(0, 4001, "balance"),
    races: genMonthRaces(1, 0, 0, 0, null),
    sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false },
    result: null, prizeInfo: null,
    champBest: null, gc: null, pendingEvent: null, eventResult: null,
    yearendInfo: null, log: [], cleared: false,
  };
}

// ---------- v10: セーブ/ロード（localStorage） ----------
// "main"画面（月送り後の安定した地点）でのみ自動保存する。result/gc/pendingEvent等の
// レース中・イベント中の一時的な状態は保存対象から除外し、ロード時は必ずmain画面に着地させる
// （courseオブジェクトなど関数を含む値をシリアライズしようとする事故を避けるため）
const SAVE_KEY = "roadrace_v10_save";
const SAVE_VERSION = "v10";
const SAVE_FIELDS = [
  "year", "month", "classIdx", "points", "budget", "roster", "equip", "inv", "partsInv",
  "camp", "campCooldown", "sponsor", "sponsorOffers", "scoutPolicy", "scouts", "races",
  "champBest", "log", "cleared",
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
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== SAVE_VERSION || !parsed.state) return null;
    const base = initGame();
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

// ---------- メインアプリ ----------
function App() {
  const [g, setG] = useState(initGame);
  const cls = CLASSES[g.classIdx];
  const healthy = g.roster.filter(r => r.injury === 0);
  const equipMax = 3 + g.classIdx;
  const rosterMax = ROSTER_MAX_BY_CLASS[g.classIdx];

  // v10: main画面に到達するたびに自動保存
  useEffect(() => {
    if (g.screen === "main") saveGame(g);
  }, [g]);

  const equippedCount = (pid) => g.roster.reduce((s, r) => s + (PART_SLOTS.reduce((n, sl) => n + (r.parts[sl] === pid ? 1 : 0), 0)), 0);
  const availParts = (pid) => (g.partsInv[pid] || 0) - equippedCount(pid);

  // ---- 月次更新 ----
  function monthlyUpdate(state, raceInfo) {
    const starterIds = raceInfo ? raceInfo.starters : null;
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
            * (n.trait === "trainer" ? 1.2 : 1);
          // 指定能力の成長にトレードオフ（×0.9）。指定外はさらに絞って14%
          addAb(n, n.focus, gain * 0.9 * persMul(n, n.focus));
          AB_KEYS.filter(k => k !== n.focus).forEach(k => addAb(n, k, gain * 0.14 * persMul(n, k)));
          n.fatigue = Math.min(100, n.fatigue + 6);
        }
        const ph2 = growthPhase(n);
        if (ph2.dec > 0) AB_KEYS.forEach(k => { n[k] = Math.max(20, n[k] - ph2.dec); });
      }
      if (starterIds && starterIds.includes(n.id)) {
        n.fatigue = Math.min(100, n.fatigue + (n.trait === "iron" ? 32 : 45));
        n.streak += 1;
        const ph = growthPhase(n);
        raceInfo.expKeys.forEach(k => addAb(n, k, 0.6 * Math.max(0.2, ph.gain) * POW[n.growthPow].mul * persMul(n, k)));
        if (n.streak >= 3) {
          n.injury = 1 + (Math.random() < 0.5 ? 1 : 0) + injExtra;
          n.streak = 0;
          state._injured.push(`${n.name} が3連闘の無理がたたり故障（${n.injury}ヶ月離脱）`);
        } else if (n.fatigue > 90) {
          const p = (0.3 + (n.fatigue - 90) * 0.04) * injMul;
          if (Math.random() < p) {
            n.injury = 1 + (Math.random() < 0.4 ? 1 : 0) + injExtra;
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
        const info = { promoted: false, relegated: false, retired: [], cleared: false, champBest: s.champBest, sponsorResult: null };
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
          if (retire) info.retired.push(`${n.name}（${n.age}歳）が引退`);
          else survivors.push(n);
        });
        const year = s.year + 1;
        const upkeep = survivors.length * UPKEEP_PER_RIDER;
        return {
          ...s, roster: survivors, classIdx, points: 0, year, month: 0,
          budget: s.budget + income + delta - upkeep,
          sponsor: null, sponsorOffers: genSponsors(classIdx, year),
          scouts: genScouts(classIdx, year * 771 + 13, s.scoutPolicy),
          races: genMonthRaces(year, 0, classIdx, 0, null),
          camp: false, campCooldown: 0, champBest: null, gc: null,
          sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false },
          yearendInfo: info, cleared: info.cleared, log,
          screen: info.cleared ? "clear" : "yearend", tab: "home",
        };
      }
      const month = s.month + 1;
      const upkeep = roster.length * UPKEEP_PER_RIDER;
      const base = {
        ...s, roster, month, camp: false, campCooldown: Math.max(0, s.campCooldown - 1),
        budget: s.budget + income - upkeep,
        sponsor,
        races: genMonthRaces(s.year, month, s.classIdx, s.points, sponsor),
        sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false },
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
      return { ...applied, pendingEvent: null, eventResult: { title: ev.title, text: choice.result }, screen: "event_result" };
    });
  }

  // ---- レース ----
  function startRace(watch) {
    const race = g.races.find(r => r.id === g.sel.raceId);
    const squad = g.roster.filter(r => g.sel.starters.includes(r.id));
    const aceId = g.sel.starters.length === 1 ? g.sel.starters[0] : g.sel.ace;
    const itemBoost = { wheel: g.sel.useWheel, suit: g.sel.useSuit };
    const { sim, aiTeams } = buildSim(race, squad, aceId, g.sel.roles, g.equip, itemBoost, g.classIdx, undefined, race.stageRace ? "day1" : undefined);
    setG(s => ({
      ...s, result: sim,
      gc: race.stageRace ? { race, aceId, roles: s.sel.roles, starters: s.sel.starters, aiTeams, watch, stage: 1 } : s.gc,
      inv: { ...s.inv, wheel: s.inv.wheel - (itemBoost.wheel ? 1 : 0), suit: s.inv.suit - (itemBoost.suit ? 1 : 0) },
      screen: watch ? "race" : "result_pending",
    }));
    if (!watch) setTimeout(() => finishRace(sim, race, race.stageRace ? 1 : undefined), 0);
  }

  function startStage2() {
    const gc = g.gc;
    const roster2 = g.roster.map(r => gc.starters.includes(r.id) ? { ...r, fatigue: Math.max(0, r.fatigue - 20) } : r);
    const squad = roster2.filter(r => gc.starters.includes(r.id));
    const { sim } = buildSim(gc.race, squad, gc.aceId, gc.roles, g.equip, { wheel: false, suit: false }, g.classIdx, gc.aiTeams, "day2");
    setG(s => ({
      ...s, roster: roster2, result: sim,
      gc: { ...s.gc, stage: 2 },
      screen: gc.watch ? "race" : "result_pending",
    }));
    if (!gc.watch) setTimeout(() => finishRace(sim, gc.race, 2), 0);
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
    setG(s => ({
      ...s, budget: s.budget + prize,
      points: race.championship ? s.points : s.points + pts,
      champBest: race.championship ? best.rank : s.champBest,
      sponsor: (s.sponsor && mandateHit) ? { ...s.sponsor, mandatesMet: s.sponsor.mandatesMet + 1 } : s.sponsor,
      prizeInfo: { race, prize, pts: race.championship ? 0 : pts, best, mandateHit, breakSurvived: sim.breakSurvived, hadBreak: sim.hadBreak },
      screen: "result",
    }));
  }

  function finishStage(sim, race, stageOverride) {
    const times = {}; sim.entrants.forEach(en => { times[en.id] = en.finishTime; });
    const stage = stageOverride || (g.gc ? g.gc.stage : 1);
    if (stage === 1) {
      setG(s => ({ ...s, gc: { ...s.gc, stage1Times: times }, screen: "gc_stage1" }));
    } else {
      setG(s => {
        const gcTimes = {};
        Object.keys(times).forEach(id => { gcTimes[id] = (s.gc.stage1Times[id] || 0) + times[id]; });
        const order = Object.entries(gcTimes).sort((a, b) => a[1] - b[1]);
        const idToEntrant = {}; sim.entrants.forEach(en => { idToEntrant[en.id] = en; });
        const playerRanks = order.map(([id], i) => ({ id, rank: i + 1 })).filter(o => idToEntrant[o.id]?.team === "PLAYER");
        const bestRank = playerRanks.length ? Math.min(...playerRanks.map(o => o.rank)) : order.length;
        const prize = Math.round((PRIZES[bestRank - 1] || 1) * CLASSES[s.classIdx].prizeMul * 2.2);
        return {
          ...s, budget: s.budget + prize, champBest: bestRank,
          gc: { ...s.gc, gcOrder: order, idToEntrant, bestRank, prize },
          screen: "gc_final",
        };
      });
    }
  }

  const raceFinishHandler = () => {
    if (g.gc && g.gc.race.stageRace) finishStage(g.result, g.gc.race, g.gc.stage);
    else finishRace(g.result, g.result.raceMeta);
  };

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
  const signScout = (sc) => {
    if (g.budget < sc.price || g.roster.length >= rosterMax) return;
    setG(s => ({
      ...s, budget: s.budget - sc.price, roster: [...s.roster, { ...sc.rider }],
      scouts: s.scouts.filter(x => x.rider.id !== sc.rider.id),
      log: [...s.log, `【${MONTHS[s.month]}】${sc.rider.name} が入団（${sc.tag}）— 真の能力が判明！`],
    }));
  };
  const useSupp = (rid) => { if (g.inv.supp <= 0) return; setG(s => ({ ...s, inv: { ...s.inv, supp: s.inv.supp - 1 }, roster: s.roster.map(r => r.id === rid ? { ...r, fatigue: Math.max(0, r.fatigue - 40) } : r) })); };
  const useTune = (rid) => { if (g.inv.tune <= 0) return; setG(s => ({ ...s, inv: { ...s.inv, tune: s.inv.tune - 1 }, roster: s.roster.map(r => r.id === rid ? { ...r, cond: Math.min(5, r.cond + 2) } : r) })); };
  const setFocus = (rid, focus) => setG(s => ({ ...s, roster: s.roster.map(r => r.id === rid ? { ...r, focus } : r) }));
  const useCamp = () => {
    if (g.inv.camp <= 0 || g.camp || g.campCooldown > 0) return;
    setG(s => ({ ...s, camp: true, campCooldown: 1, inv: { ...s.inv, camp: s.inv.camp - 1 } }));
  };
  const releaseRider = (rid) => {
    if (g.month !== 0) return;
    setG(s => {
      if (s.roster.length <= 1) return s;
      const r = s.roster.find(x => x.id === rid);
      if (!r) return s;
      return { ...s, roster: s.roster.filter(x => x.id !== rid), log: [...s.log, `【${MONTHS[s.month]}】${r.name} を解雇した`] };
    });
  };

  // ---- 共通 ----
  const Header = () => (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Eyebrow>{cls.label} — {g.year}年目 {MONTHS[g.month]}</Eyebrow>
          <div style={{ fontFamily: FONT_D, fontSize: 18, fontWeight: 700, color: C.text }}>チーム運営 v10</div>
          {g.sponsor && <div style={{ fontSize: 10.5, color: C.sub }}>SPONSOR: {g.sponsor.name}（月+{g.sponsor.monthly}万／ノルマ{g.sponsor.norma}pt／未達-{g.sponsor.penalty}万／指定レース{g.sponsor.mandatesMet}済{g.sponsor.mandatesMissed > 0 ? `・見送り${g.sponsor.mandatesMissed}` : ""}）</div>}
          <div style={{ fontSize: 10.5, color: C.sub }}>選手維持費 -{g.roster.length * UPKEEP_PER_RIDER}万/月（{g.roster.length}名）</div>
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
      {[["home", "🏁 レース"], ["riders", "👥 選手・練習"], ["shop", "🛒 ショップ"], ["help", "📖 ヘルプ"]].map(([k, l]) => (
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
    </div>
  );

  // ================= 画面 =================
  if (g.screen === "intro") return wrap(
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 18, border: `1px solid ${C.line}` }}>
        <Eyebrow>SEASON MODE v10</Eyebrow>
        <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 23, margin: "6px 0 10px" }}>B1からPROの頂点へ</h2>
        <p style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.8, margin: 0 }}>
          1年＝1シーズン、出場は月1回。3月のチャンピオンシップ3位以内で昇格、PROのグランファイナル優勝でクリア。
          v10新要素：集団ゴールのスプリント決着処理・千切れ選手の遅れ過大バグ修正・種目別適性レーティング・
          ヘルプタブ・セーブ/ロード機能を追加しました。
        </p>
      </div>
      {hasSaveGame() && (
        <Btn onClick={() => { const loaded = loadGame(); if (loaded) setG(loaded); }}>💾 続きから</Btn>
      )}
      <Btn outline={hasSaveGame()} onClick={() => {
        if (hasSaveGame() && !window.confirm("保存データを消して最初から始めます。よろしいですか？")) return;
        clearSaveGame();
        setG(s => ({ ...initGame(), screen: "scoutpolicy_initial" }));
      }}>
        {hasSaveGame() ? "最初から（保存データは消えます）" : "スカウト方針の確認へ"}
      </Btn>
    </div>
  );

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
      <Btn onClick={() => setG(s => ({ ...s, scouts: genScouts(0, 4001, s.scoutPolicy), screen: "sponsor" }))}>この方針で決定 → スポンサー選択へ</Btn>
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
                background: r.championship ? "#2b2436" : C.panel, borderRadius: 10, padding: "10px 12px",
                border: `1.5px solid ${r.sponsorMandate ? C.red : r.championship ? C.purple : C.line}`, opacity: r.locked ? 0.55 : 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>
                    {r.championship ? "👑 " : ""}{r.sponsorMandate ? "🎯 " : ""}{r.name}
                  </div>
                  <div style={{ fontFamily: FONT_M, fontSize: 12, color: C.yellow }}>{"★".repeat(r.grade)}</div>
                </div>
                <div style={{ display: "flex", gap: 3, margin: "6px 0 4px" }}>
                  {r.tmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 6, borderRadius: 3, background: SEG_COLOR[s[0]] }} />)}
                </div>
                <div style={{ fontSize: 11.5, color: C.sub }}>
                  {r.tmpl.kind}・出走{squadLabel}・{TYPES[r.tmpl.favors].label}有利／優勝 約{Math.round(PRIZES[0] * mul)}万・{Math.round(PTS[0] * GRADE_MUL[r.grade])}pt
                  {r.sponsorMandate && <span style={{ color: C.red }}>／スポンサー指定レース</span>}
                  {r.stageRace && <span style={{ color: C.purple }}>／2日間ステージレース(総合)</span>}
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
              if (window.confirm("タイトルに戻ります。セーブ済みのデータは消えません。よろしいですか？")) {
                setG(s => ({ ...s, screen: "intro" }));
              }
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
            所属 {g.roster.length}/{rosterMax}名。<span style={{ color: C.yellow }}>能力95以上＝限界突破</span>（金色表示・成長が大幅に鈍化）。練習指定能力の伸びはトレードオフ（×0.9）で指定外に一部融通されます。
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
                    <div style={{ fontFamily: FONT_M, fontSize: 14, color: C.yellow }}>{overall(r)}<span style={{ fontSize: 9, color: C.sub }}> OVR</span></div>
                    {g.month === 0 && <Btn small outline color={C.red} onClick={() => { if (window.confirm(`${r.name}を解雇しますか？`)) releaseRider(r.id); }}>解雇</Btn>}
                  </div>
                </div>
                <PersonaLine p={r.personality} />
                <TraitLine trait={r.trait} />
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.sub, margin: "4px 0", flexWrap: "wrap" }}>
                  <span>{r.age}歳・{GROWTH[r.growth].label}・<span style={{ color: ph.tag === "全盛期" ? C.yellow : ph.tag === "衰え期" ? C.red : C.green }}>{ph.tag}</span></span>
                  <span>調子 <span style={{ color: COND_COLOR[r.cond - 1], fontFamily: FONT_M }}>{COND_ARROW[r.cond - 1]}</span></span>
                  {r.streak > 0 && <span style={{ color: r.streak >= 2 ? C.red : "#e8a13c" }}>連闘{r.streak}{r.streak >= 2 ? "（次で故障！）" : ""}</span>}
                  {r.injury > 0 && <span style={{ color: C.red }}>🏥 故障 残{r.injury}ヶ月</span>}
                </div>
                <div style={{ fontSize: 10.5, color: C.sub }}>疲労（90超で故障リスク）</div>
                <FatigueBar v={r.fatigue} />
                <AbilityGrid r={r} />
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
          <Btn outline color={C.sub} onClick={() => { if (window.confirm("最初からやり直しますか？セーブデータも消えます。")) { clearSaveGame(); setG(initGame()); } }}>ゲームをリセット</Btn>
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
            <Eyebrow color={C.blue}>無線指示の得意・弱点</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {Object.entries(CHASE_MODES).map(([k, v]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13.5 }}>📻 {v.label}</div>
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
          <p style={{ color: C.text, fontSize: 14, lineHeight: 1.8, margin: "8px 0 0" }}>{g.eventResult.text}</p>
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
          const races = genMonthRaces(g.year, mi, g.classIdx, mi === 11 ? 9999 : 0, g.sponsor);
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
          <div style={{ display: "flex", gap: 3, margin: "6px 0 3px" }}>
            {race.tmpl.segs.map((s, i) => <div key={i} style={{ flex: s[2], height: 7, borderRadius: 3, background: SEG_COLOR[s[0]] }} />)}
          </div>
          <div style={{ fontSize: 11.5, color: C.sub }}>{race.tmpl.kind}・<span style={{ color: C.yellow }}>出走{N}名</span>・{TYPES[race.tmpl.favors].label}有利</div>
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
          <div style={{ marginTop: 6 }}><ElevationChart course={previewCourse} /></div>
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
                  <AbilityGrid r={r} />
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
        {ready && (
          <section>
            <Eyebrow color={C.green}>決戦機材（📻無線での作戦変更は観戦中に行えます）</Eyebrow>
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
        ● 印＝あなたのチーム／黄ジャージ＝エース。位置が近い選手同士が自然にグループを作り、千切れ・吸収・ローテーションが発生します。📻は最終区間突入で締め切られます。
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
                {e.name}{e.isAce ? " 👑" : ""}<span style={{ color: C.sub, fontSize: 10.5 }}> / {e.teamName}</span>
              </span>
              <span style={{ fontFamily: FONT_M, color: C.sub }}>{e.rank === 1 ? fmtTime(e.finishTime) : fmtGap(e.finishTime - res.ranked[0].finishTime)}</span>
            </div>
          ))}
        </div>
        <Btn onClick={() => advanceMonth({ starters: g.sel.starters, expKeys, raceId: g.sel.raceId })}>翌月へ進む →</Btn>
      </div>
    );
  }

  if (g.screen === "gc_stage1" && g.result && g.gc) {
    const res = g.result;
    const sorted = [...res.entrants].sort((a, b) => a.finishTime - b.finishTime);
    const bestIdx = sorted.findIndex(e => e.team === "PLAYER");
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.purple}` }}>
          <Eyebrow color={C.purple}>STAGE 1 完了 — {g.gc.race.name}</Eyebrow>
          <div style={{ fontSize: 13.5, color: C.text, marginTop: 6 }}>1日目 自チーム最高位：<span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 17 }}>{bestIdx + 1}位</span></div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>総合成績は2日目終了後に確定します。まずは休息・疲労回復（-20）をしてから2日目へ。</div>
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: "8px 12px", maxHeight: 260, overflowY: "auto" }}>
          {sorted.slice(0, 10).map((e, i) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px", fontSize: 12.5, background: e.team === "PLAYER" ? "rgba(255,210,63,0.1)" : "transparent" }}>
              <span style={{ color: e.team === "PLAYER" ? C.yellow : C.text }}><span style={{ fontFamily: FONT_M, display: "inline-block", width: 24 }}>{i + 1}.</span>{e.name}{e.isAce ? " 👑" : ""}</span>
              <span style={{ fontFamily: FONT_M, color: C.sub }}>{i === 0 ? fmtTime(e.finishTime) : fmtGap(e.finishTime - sorted[0].finishTime)}</span>
            </div>
          ))}
        </div>
        <Btn onClick={startStage2}>2日目のレースへ →</Btn>
      </div>
    );
  }

  if (g.screen === "gc_final" && g.gc && g.gc.gcOrder) {
    const { gcOrder, idToEntrant, bestRank, prize } = g.gc;
    const expKeys = [...new Set(g.result.course.segs.map(s => SEG_AB[s.type]))];
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.yellow}` }}>
          <Eyebrow>GC FINAL — {g.gc.race.name}</Eyebrow>
          <div style={{ fontSize: 13.5, color: C.text, marginTop: 6 }}>総合成績：自チーム最高位 <span style={{ fontFamily: FONT_M, color: C.yellow, fontSize: 17 }}>{bestRank}位</span></div>
          <div style={{ fontSize: 13.5, color: C.green, marginTop: 3 }}>賞金 +{prize}万円</div>
          <div style={{ marginTop: 6, fontSize: 13, color: bestRank <= 3 ? C.yellow : C.red }}>
            {bestRank <= 3 ? "昇格圏内でフィニッシュ！年度末処理で昇格します" : "昇格ならず…来季に再挑戦"}
          </div>
        </div>
        <div style={{ background: C.panel, borderRadius: 12, padding: "8px 12px", maxHeight: 260, overflowY: "auto" }}>
          {gcOrder.slice(0, 10).map(([id, t], i) => {
            const e = idToEntrant[id];
            return (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px", fontSize: 12.5, background: e.team === "PLAYER" ? "rgba(255,210,63,0.1)" : "transparent" }}>
                <span style={{ color: e.team === "PLAYER" ? C.yellow : C.text }}><span style={{ fontFamily: FONT_M, display: "inline-block", width: 24 }}>{i + 1}.</span>{e.name}{e.isAce ? " 👑" : ""}</span>
                <span style={{ fontFamily: FONT_M, color: C.sub }}>{i === 0 ? fmtTime(t) : fmtGap(t - gcOrder[0][1])}</span>
              </div>
            );
          })}
        </div>
        <Btn onClick={() => advanceMonth({ starters: g.gc.starters, expKeys, raceId: g.gc.race.id })}>翌月へ進む →</Btn>
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

  if (g.screen === "clear") return wrap(
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 22, borderTop: `4px solid ${C.yellow}`, textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>🏆</div>
        <h2 style={{ fontFamily: FONT_D, color: C.yellow, fontSize: 26, margin: "8px 0" }}>グランファイナル制覇！</h2>
        <p style={{ color: C.text, fontSize: 14, lineHeight: 1.8 }}>B1から始まったチームが、{g.year - 1}年の歳月をかけてPROの頂点に立ちました。おめでとうございます！</p>
      </div>
      <Btn onClick={() => { clearSaveGame(); setG(initGame()); }}>新たなチームで最初から</Btn>
    </div>
  );

  return wrap(<div style={{ color: C.sub }}>読み込み中…</div>);
}

function t_label(type) { return TYPES[type]?.label || type; }

export default App;
