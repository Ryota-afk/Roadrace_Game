// ゲーム状態：init/save/load・生成器・アンビション・実績・キャリア。Phase 2で分離。
import { AB_KEYS, TYPES } from "../data/abilities.js";
import { TYPE_ABKEYS } from "../data/breeding.js";
import { GRAND_TOURS, OVERSEAS_VENUES, PRODIGY_CHANCE_BY_CLASS, REGIONS, SCOUT_COUNT_BY_CLASS, TEMPLATES, UNLOCK_TEMPLATES, VENUES } from "../data/course.js";
import { CLASSES, DIFFICULTIES, TITLE_DEFS } from "../data/progression.js";
import { C } from "../data/theme.js";
import { SUB_STAT_KEYS, genSubStats, hasAbility, hasGoldAbility, mulberry, newRider, overall, pickRiderName, ridState, rollAbilities } from "../core/core.js";
import { AI_STYLES, assignAIRoles, computeTeamTT, effAbilities, generateCourse, rankSim, rollWeather, simulateTicks } from "../sim/race.js";
import { loadMlLegends } from "../breeding/breeding.js";

export function totalTitleCount() {
  const t = loadTitles();
  return TITLE_DEFS.reduce((s, d) => s + (t[d.key] || 0), 0);
}

export function computePrestige() {
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

export function unlockedTemplates() {
  const cp = loadMeta().totalEarnedCP;
  return [...TEMPLATES, ...UNLOCK_TEMPLATES.filter(t => cp >= t.unlockCP)];
}

export const SPONSOR_NAMES = ["アオゾラ銀行", "ハヤテ運輸", "ヤマセミ食品", "クレセント自転車", "ソラマメ製菓", "ツバキ石油", "ミナモ製薬", "カワセミ電工"];

export function hasEarnedNickname(r) {
  const log = r.raceLog || [];
  const wins = log.filter(e => e.rank === 1).length;
  const podiums = log.filter(e => e.rank <= 3).length;
  return wins >= 1 || podiums >= 2 || log.length >= 5 || !!r.prodigy;
}

export function riderNickname(r) {
  if (!hasEarnedNickname(r)) return null;
  const log = r.raceLog || [];
  const wins = log.filter(e => e.rank === 1).length;
  const podiums = log.filter(e => e.rank <= 3).length;
  const races = log.length;
  const supR = log.filter(e => ["support", "sub", "experience", "domestique"].includes(e.role)).length;
  const aceR = log.filter(e => ["ace", "lead"].includes(e.role)).length;
  const abs = { flat: r.flat || 0, climb: r.climb || 0, sprint: r.sprint || 0, stamina: r.stamina || 0, solo: r.solo || 0 };
  // v38(#8): 能力が均等に極まると Object.entries の順序（flat が先頭）で必ず flat が選ばれ、
  // 殿堂の二つ名が全員「平坦の帝王」になっていた。脚質(type)を最優先のタイブレークにする＝
  // 首位と僅差(3以内)に脚質相応の能力があればそれを採用。これで脚質どおりの多彩な称号になる。
  const typeAbil = { SPR: "sprint", CLM: "climb", RUL: "flat", TT: "solo", PUN: "sprint" }[r.type];
  const sortedAbs = Object.entries(abs).sort((a, b) => b[1] - a[1]);
  const topVal = sortedAbs[0][1];
  const tiedKeys = sortedAbs.filter(([, v]) => topVal - v <= 3).map(([k]) => k);
  const top = (typeAbil && tiedKeys.includes(typeAbil)) ? typeAbil : sortedAbs[0][0];
  // v31.4: 「勝ち星が多い＝みんな伝説の勝ち師」で没個性化していたため、勝利数上位は
  // 脚質を冠した称号にし、役割（献身のアシスト）や取りこぼし（悲運）も拾って多様化する
  // v38(#8): PUN（パンチャー）専用の帝王称号を追加し、脚質ごとに必ず別称号になるようにした。
  const punKing = r.type === "PUN" ? "起伏の覇王" : null;
  const byTypeKing = { flat: "平坦の帝王", climb: "山岳の覇者", sprint: "豪脚のゴールハンター", stamina: "無尽蔵の機関車", solo: "独走の求道者" };
  const byType = { flat: "巡航の職人", climb: "山岳の申し子", sprint: "スプリンター", stamina: "鉄の脚", solo: "独走屋" };
  // v37: 特能・性格に紐づく特別な異名（一定の実績を満たしたら優先して冠する）
  const abils = r.abilities || [];
  if (wins >= 2 && abils.includes("kicker")) return "剛脚のフィニッシャー";
  if (wins >= 2 && abils.includes("climbengine")) return "山の吸血鬼";
  if (podiums >= 3 && abils.includes("grinder")) return "不屈のねばり脚";
  if ((wins >= 2 || podiums >= 4) && r.personality === "maverick") return "孤高の一匹狼";
  if (wins >= 3 && r.personality === "showman") return "魅せる勝負師";
  if (wins >= 3 && r.personality === "tactician") return "レースの支配者";
  if (supR >= 10 && supR >= aceR * 1.5 && wins <= 4) return "献身のアシスト";
  if (podiums >= 10 && wins <= 2) return "悲運の名脇役";
  if (wins >= 8) return punKing || byTypeKing[top] || "常勝の帝王";
  if (wins >= 5) return "常勝の帝王";
  if (wins >= 3) return "勝利の申し子";
  if (podiums >= 12) return "表彰台の主";
  if (podiums >= 6) return "表彰台の常連";
  if (races >= 12 && podiums === 0) return "苦労人";
  if (r.prodigy) return "将来を嘱望された逸材";
  return byType[top] || "無名の挑戦者";
}

export function riderCareerSummary(r) {
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

// v35(シーズン深掘り): 各チームに個性（脚質傾向 spec ＋ 二つ名 trait）。レースでは所属選手が
// その脚質に寄って生成され、エースは必ずその脚質になる（＝スプリント軍団は平坦で、山岳の名門は
// 登りで脅威、という対戦の駆け引きが生まれる）。spec は newRider の type コード。
// v38: チーム数を拡張（4→6）。tier（0=下位/1=中堅/2=強豪）と spec（脚質傾向）を各帯に散らし、
// クラス（B1/A/PRO）ごとに複数チームが存在するようにした＝昇降格で相手・移籍先の顔ぶれが変わる。
export const RIVAL_TEAMS = [
  { name: "レッドサンダー山陽", color: "#d9484a", tier: 1, spec: "SPR", trait: "スプリント軍団" },
  { name: "クレディ・ブルー", color: "#3f7fd9", tier: 2, spec: "PUN", trait: "オールラウンドの強豪" },
  { name: "ヴェロチタ京都", color: "#9a6be0", tier: 0, spec: "CLM", trait: "山岳の名門" },
  { name: "ウィンドミル北海道", color: "#e08a3f", tier: 0, spec: "TT", trait: "独走・逃げ派" },
  { name: "グランヴィア福岡", color: "#2fb37a", tier: 2, spec: "CLM", trait: "山岳の超名門" },
  { name: "アトラス名古屋", color: "#eab308", tier: 1, spec: "RUL", trait: "鉄壁のルーラー軍団" },
];

// マイライフはさらに3チーム多い（9チーム）。所属先・移籍先の選択肢を広げ、キャリアごとに
// 顔ぶれが変わるようにする。tier2（PRO級）も複数用意して昇格後の移籍先を確保。
export const MYLIFE_TEAMS = [
  ...RIVAL_TEAMS,
  { name: "サンライズ静岡", color: "#4fd1c5", tier: 0, spec: "RUL", trait: "平坦のルーラー集団" },
  { name: "北斗プロサイクル", color: "#c084fc", tier: 1, spec: "PUN", trait: "勝負師揃い" },
  { name: "クレバー横浜", color: "#38bdf8", tier: 2, spec: "TT", trait: "TTスペシャリスト集団" },
];

// v37: 永続ワールドロースター。従来はAI相手を毎レース使い捨てで生成していたため、
// 同じ選手が二度と現れず「毎レース違うチーム」に見え、成績も追えなかった。キャリア開始時に
// 各チーム固定の選手団（安定id・名前・脚質・性格・特能・強さ階級baseline）を生成して永続化し、
// 毎レース同じ顔ぶれが出走するようにする（強さは baseline＋その時のクラス/年で文脈スケール）。
const WORLD_PERS_POOL = ["hotblood", "seeker", "artisan", "free", "smart", "maverick", "showman", "tactician"];

// v38: ワールド選手を1人生成。genWorldRosters（初期化）と ageWorldRosters（新人補充）で共用。
// opts で年齢・baseline・脚質固定・入団年を上書きできる。
function genOneWorldRider(rng, spec, banned, opts = {}) {
  const typeKeys = Object.keys(TYPES);
  const useSpec = opts.forceSpec ? true : (spec && rng() < 0.5);
  const type = useSpec ? spec : typeKeys[Math.floor(rng() * typeKeys.length)];
  const px = rng();
  const personality = px < 0.30 ? "normal" : px < 0.35 ? "genius" : WORLD_PERS_POOL[Math.floor(rng() * WORLD_PERS_POOL.length)];
  const gp = rng();
  const growthPow = gp < 0.10 ? "S" : gp < 0.35 ? "A" : gp < 0.75 ? "B" : "C";
  const baseline = opts.baseline != null ? opts.baseline
    : (opts.ace ? 5 + Math.round(rng() * 4) : Math.round(rng() * 8 - 3));
  return {
    id: ridState.value++, name: pickRiderName(rng, banned), type, personality,
    abilities: rollAbilities(rng), goldAbilities: [], growthPow,
    age: opts.age != null ? opts.age : 20 + Math.floor(rng() * 10),
    baseline, joinYear: opts.joinYear || 1,
  };
}

export function genWorldRosters(rng, count = 6, teams = MYLIFE_TEAMS) {
  const rosters = {};
  const banned = new Set();
  teams.forEach(d => {
    const riders = [];
    for (let i = 0; i < count; i++) {
      const r = genOneWorldRider(rng, d.spec, banned, { ace: i === 0, forceSpec: i === 0 && !!d.spec });
      banned.add(r.name);
      riders.push(r);
    }
    riders.sort((a, b) => b.baseline - a.baseline); // エースが先頭
    rosters[d.name] = riders;
  });
  return rosters;
}

// 成長曲線のピーク年齢（成長力が高いほど遅咲き＝長く伸びる）
function growthPeakAge(growthPow) {
  return growthPow === "S" ? 29 : growthPow === "A" ? 28 : growthPow === "B" ? 27 : 26;
}
function growthStep(growthPow) {
  return growthPow === "S" ? 2.6 : growthPow === "A" ? 1.9 : growthPow === "B" ? 1.2 : 0.7;
}

// v38: 年次成長・引退で世代交代。年に一度（シーズン終わり）呼び出す。
// 各選手を1歳加齢し、ピーク前は成長・ピーク後は衰え。高齢者は引退して新人に置き換わる。
// 戻り値: { worldRosters: 更新後, retired: [{team, name, age, type}...], debuted: [{team, name, age}...] }
export function ageWorldRosters(prevRosters, rng, year, teams = MYLIFE_TEAMS) {
  const next = {};
  const retired = [];
  const debuted = [];
  const banned = new Set();
  // 既存の名前を banned に集めて重複回避
  Object.values(prevRosters || {}).forEach(list => (list || []).forEach(r => banned.add(r.name)));
  teams.forEach(d => {
    const src = (prevRosters && prevRosters[d.name]) || [];
    const out = [];
    src.forEach(r => {
      const age = (r.age || 24) + 1;
      const peak = growthPeakAge(r.growthPow);
      let baseline = r.baseline || 0;
      if (age <= peak) {
        baseline += growthStep(r.growthPow);
      } else {
        baseline -= 0.8 + (age - peak) * 0.35; // 加齢で加速的に衰える
      }
      baseline = Math.max(-9, Math.min(14, Math.round(baseline)));
      // 引退判定: 38歳で強制、33歳以上は確率的（年齢が上がるほど高確率）
      const retireChance = age >= 38 ? 1 : (age >= 33 ? 0.18 + (age - 33) * 0.06 : 0);
      if (retireChance > 0 && rng() < retireChance) {
        retired.push({ team: d.name, name: r.name, age, type: r.type });
        banned.delete(r.name);
        // 新人ルーキーで補充
        const rookie = genOneWorldRider(rng, d.spec, banned, {
          age: 20 + Math.floor(rng() * 3),
          baseline: Math.round(rng() * 6 - 3),
          joinYear: year,
        });
        banned.add(rookie.name);
        debuted.push({ team: d.name, name: rookie.name, age: rookie.age });
        out.push(rookie);
      } else {
        out.push({ ...r, age, baseline });
      }
    });
    out.sort((a, b) => b.baseline - a.baseline); // エースが先頭に再ソート
    next[d.name] = out;
  });
  return { worldRosters: next, retired, debuted };
}

export const ML_ACHIEVEMENTS = [
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

export function computeAchievements(ml) {
  return ML_ACHIEVEMENTS.map(a => ({ ...a, achieved: a.check(ml) }));
}

export function initRoster() {
  // v12バグ修正: 初期メンバー6名の名前が完全固定されており、新しくゲームを始めても
  // 毎回同じ名前になってしまうと気になるとのフィードバックを受け、能力値・年齢・役割の
  // バランスはそのまま維持しつつ、名前だけを新規ゲームのたびにランダム生成するようにした
  const rng = mulberry(Date.now() % 999983);
  const mk = (name, type, f, c, sp, st, so, age, growth, pow, trait, pers) => {
    const r = {
      id: ridState.value++, name, type, flat: f, climb: c, sprint: sp, stamina: st, solo: so,
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

export function scoutSpecs(policy, count) {
  let base5;
  if (policy === "future") base5 = [17, 18, 18, 19, 20].map(age => ({ age, mul: 0.8, priceMul: 0.7, powDist: [0.15, 0.60, 0.90] }));
  else if (policy === "now") base5 = [23, 24, 25, 26, 27].map(age => ({ age, mul: 1.08, priceMul: 1.25, powDist: [0.0, 0.05, 0.45] }));
  else base5 = [18, 20, 22, 24, 25].map((age, i) => ({ age, mul: 0.85 + i * 0.055, priceMul: 0.7 + i * 0.13 }));
  const extra = [];
  for (let i = 5; i < count; i++) extra.push({ age: 20 + (i % 6), mul: 0.9 + (i % 4) * 0.05, priceMul: 0.85 + (i % 4) * 0.1 });
  return [...base5, ...extra];
}

export function genScouts(classIdx, seed, policy = "balance", existingNames, scoutLv = 0) {
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

export const FA_POOL_COUNT_BY_CLASS = [4, 5, 7];

export function genFaPool(classIdx, seed, existingNames) {
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

export function genTradeOffers(classIdx, seed, roster) {
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

export function genSponsors(classIdx, year) {
  const rng = mulberry(year * 913 + classIdx * 77 + 3);
  const pick = () => SPONSOR_NAMES[Math.floor(rng() * SPONSOR_NAMES.length)];
  const need = CLASSES[classIdx].need;
  return [
    { name: pick(), style: "安定型", monthly: 18 + classIdx * 8, norma: Math.max(10, need - 10), bonus: 80 + classIdx * 40, penalty: 30 + classIdx * 15, mandates: 1 },
    { name: pick(), style: "バランス型", monthly: 12 + classIdx * 7, norma: need - 3, bonus: 180 + classIdx * 70, penalty: 80 + classIdx * 30, mandates: 1 },
    { name: pick(), style: "挑戦型", monthly: 8 + classIdx * 5, norma: need + 5, bonus: 350 + classIdx * 130, penalty: 180 + classIdx * 60, mandates: 2 },
  ];
}

export function genMonthRaces(year, month, classIdx, points, sponsor, gtWins) {
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

export function initGame() {
  ridState.value = 100;
  const roster = initRoster();
  const rosterNames = roster.map(r => r.name);
  return {
    screen: "intro", tab: "home",
    // v28: 自チーム名（プレイヤーが命名できる。未設定なら既定名）
    teamName: "あなたのチーム",
    year: 1, month: 0, classIdx: 0, points: 0, budget: 300,
    roster,
    // v38: 永続ライバルロースター。従来はレースごとにAI相手を使い捨て生成しており、同じチーム名でも
    // 毎レース別人が出走していた（宿敵が育たず相手の成績も追えない）。開始時に各ライバルチーム固定の
    // 選手団を生成して永続化し、毎レース同じ顔ぶれが（その年の地力で）出走するようにする。年度末に加齢。
    rivalRosters: genWorldRosters(mulberry(Date.now() % 999983 + 4242), 6, RIVAL_TEAMS),
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

export const SAVE_KEY = "roadrace_v12_save";
const SAVE_VERSION = "v12";
const SAVE_FIELDS = [
  "year", "month", "classIdx", "points", "budget", "roster", "equip", "staff", "inv", "partsInv",
  "camp", "sponsor", "sponsorOffers", "scoutPolicy", "scouts", "faMarket", "races",
  "champBest", "log", "cleared", "careerStats", "careerHistory", "difficulty", "hallOfFame", "rivalAlumni",
  "gtWins", "captainId", "tradeOffers", "jerseyWinCounts", "rewardedAchievements", "dynastyLevel", "youthUsed", "obCoach", "homeRegion", "teamName",
  "rivalRosters", "rivalStats",
];

export function serializeState(g) {
  const out = {};
  SAVE_FIELDS.forEach(k => { out[k] = g[k]; });
  return out;
}

export function saveGame(g) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), state: serializeState(g) }));
    return true;
  } catch (e) { return false; }
}

export function resyncRid(state) {
  let max = ridState.value;
  (state.roster || []).forEach(r => { if (r.id >= max) max = r.id + 1; });
  (state.scouts || []).forEach(sc => { if (sc.rider.id >= max) max = sc.rider.id + 1; });
  (state.faMarket || []).forEach(fa => { if (fa.rider.id >= max) max = fa.rider.id + 1; });
  ridState.value = max;
}

export function loadGame() {
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

// v35(UI): セーブの安心感。フルロードせずに続きから用のサマリ（誰の・いつの・どこまで）だけ覗く。
export function saveGameInfo() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p.version !== SAVE_VERSION || !p.state) return null;
    const s = p.state;
    return { savedAt: p.savedAt || null, teamName: s.teamName || "あなたのチーム", year: s.year || 1, classLabel: (CLASSES[s.classIdx || 0] || {}).label || "" };
  } catch (e) { return null; }
}

export const ML_AMBITION_PATHS = {
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

export function mlAmbitionMetricValue(ml, metric) {
  if (metric === "careerWins") return ml.careerWins || 0;
  if (metric === "careerPodiums") return ml.careerPodiums || 0;
  if (metric === "careerBigWins") return ml.careerBigWins || 0;
  if (metric === "careerTitles") return ml.careerTitles || 0;
  if (metric === "rankAtMost") return ml.worldRank == null ? 999 : ml.worldRank;
  if (metric === "supportRaces") return ((ml.player && ml.player.raceLog) || []).filter(e => ["support", "sub", "experience", "domestique"].includes(e.role)).length;
  return 0;
}

export function mlFirstUnmetRung(ml, pathKey) {
  const rungs = (ML_AMBITION_PATHS[pathKey] || ML_AMBITION_PATHS.victory).rungs;
  for (let i = 0; i < rungs.length; i++) { if (!mlAmbitionCleared(ml, rungs[i])) return i; }
  return rungs.length;
}

export function mlAmbitionCleared(ml, amb) {
  if (!amb) return false;
  const v = mlAmbitionMetricValue(ml, amb.metric);
  return amb.metric === "rankAtMost" ? v <= amb.target : v >= amb.target;
}

export function mlCareerArchetype(s) {
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
  // v33.11: モニュメント（クラシック）制覇に特化したキャリア
  if ((s.careerClassics || 0) >= 3) return { key: "classicKing", title: "クラシックの覇者", desc: "格式高いモニュメントを幾度も制した、古典レースの申し子。", color: "#e8a13c" };
  if ((s.careerClassics || 0) >= 1 && wins < 8) return { key: "classicHunter", title: "石畳の古豪", desc: "消耗の激しい一発勝負の古典で栄冠をつかんだ、タフネスの体現者。", color: C.green };
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

export function initMyLife() {
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
    // v37: 永続キャラ（ライバル/仲間）の成績台帳
    riderStats: {},
    // v37: 永続ワールドロースター（各AIチーム固定の選手団）
    worldRosters: {},
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

export const ML_SAVE_KEY = "roadrace_v12_mylife_save";
const ML_SAVE_VERSION = "v12ml";
const ML_SAVE_FIELDS = [
  "screen", "year", "month", "classIdx", "points", "player", "team", "races", "log", "retired",
  "directive", "managerEval", "salary", "money", "partsInv", "stock", "gear", "houseLv", "carLv",
  "rival", "rivalRecord", "rival2", "rivalRecord2", "flags", "rewardedAchievements",
  // v30: 世界ランキング＆キャリア・アンビション
  "worldPoints", "worldRank", "worldRankBest", "worldSeed", "ambitionIdx", "ambitionDone", "ambitionPath",
  "careerWins", "careerPodiums", "careerBigWins", "careerTitles", "careerClassics",
  "teammates", "tactic", "careerHistory",
  "protege", // v35(逆メンター): 弟子（プロテジェ）
  "rivalDramaOn", // v36(#6): 性格ベースのライバル会話ドラマの表示 on/off
  "riderStats", // v37: 永続キャラ（ライバル/仲間）の成績台帳
  "worldRosters", // v37: 永続ワールドロースター（各AIチーム固定の選手団）
];

export function saveMyLife(ml) {
  try {
    const out = {}; ML_SAVE_FIELDS.forEach(k => { out[k] = ml[k]; });
    localStorage.setItem(ML_SAVE_KEY, JSON.stringify({ version: ML_SAVE_VERSION, savedAt: Date.now(), state: out }));
    return true;
  } catch (e) { return false; }
}

export function loadMyLifeGame() {
  try {
    const raw = localStorage.getItem(ML_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== ML_SAVE_VERSION || !parsed.state) return null;
    const base = initMyLife();
    if (parsed.state.player && parsed.state.player.id >= ridState.value) ridState.value = parsed.state.player.id + 1;
    if (parsed.state.rival && parsed.state.rival.id >= ridState.value) ridState.value = parsed.state.rival.id + 1;
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

// v35(UI): マイライフ続きから用の軽量サマリ（誰の・何年目・どのクラス・いつ保存）。
export function myLifeSaveInfo() {
  try {
    const raw = localStorage.getItem(ML_SAVE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p.version !== ML_SAVE_VERSION || !p.state) return null;
    const s = p.state;
    return {
      savedAt: p.savedAt || null,
      name: (s.player && s.player.name) || "選手",
      age: (s.player && s.player.age) || null,
      year: s.year || 1,
      classLabel: (CLASSES[s.classIdx || 0] || {}).label || "",
    };
  } catch (e) { return null; }
}

export function mlGenTeammates(rng, teamName, count, bannedNames, year) {
  const banned = new Set(bannedNames || []);
  const typeKeys = Object.keys(TYPES);
  const list = [];
  for (let i = 0; i < count; i++) {
    const type = typeKeys[Math.floor(rng() * typeKeys.length)];
    const name = pickRiderName(rng, banned);
    const px = rng();
    const personality = px < 0.35 ? "normal" : ["hotblood", "seeker", "artisan", "free", "smart", "genius", "maverick", "showman", "tactician"][Math.floor(rng() * 9)];
    list.push({ id: ridState.value++, name, type, personality, abilities: rollAbilities(rng), team: teamName, joinYear: year || 1, winsForMe: 0 });
  }
  return list;
}

// v35(バランス): 作戦の説明を実測（Node頭付き比較）に合わせて正直化。
// 各tacticの tag = 一目でわかる向き・リスク、desc = 実際の効き方（どのコース・脚質で得か）。
// 検証で判明した要点：末脚温存＝平坦スプリントで堅実／早めに逃げる＝多くは吸収され着順は落ちる
// 博打だが集団ゴールで勝てない脚質の唯一の一発（起伏・山岳で逃げ切りやすい）／積極＝非スプリント型が
// 終盤に仕掛けて先着を狙う（スプリント型は末脚を消して不利）。
export const ML_TACTICS = {
  balanced:   { label: "🚩 標準（流れに任せる）",       tag: "無難", tagColor: "#9aa3b5", chaseMode: "normal", aceEarly: false, desc: "特別な仕掛けはせず、脚質と展開に任せる。迷ったらまずこれ" },
  wait:       { label: "⏳ 末脚温存（集団スプリント狙い）", tag: "堅実・平坦向き", tagColor: "#4fbf6b", chaseMode: "push",   aceEarly: false, desc: "逃げを潰して集団を保ち、ゴールスプリントで勝負。スプリント型・平坦/クリテで最も安定して上位に入る" },
  early:      { label: "💨 早めに逃げる",               tag: "博打・起伏向き", tagColor: "#e8734a", chaseMode: "normal", aceEarly: false, playerBreakaway: true, desc: "ハイリスク＝多くは吸収され平均着順は落ちる。だが集団スプリントで勝てない脚質が“一発”を狙える唯一の手。平坦より起伏・山岳の方が逃げ切りやすい" },
  aggressive: { label: "⚔ 積極的に仕掛ける",            tag: "非スプリント型向き", tagColor: "#e8a13c", chaseMode: "normal", aceEarly: true,  desc: "終盤にエース自ら加速して先着を狙う。集団ゴールで分が悪い登坂・独走・パンチャー型向き。スプリント型は末脚を消すので不利" },
  assist:     { label: "🤝 アシストに徹する",            tag: "献身", tagColor: "#5aa9e6", chaseMode: "push",   aceEarly: false, playerAssist: true, desc: "自分の勝ちを捨ててエースを押し上げる献身の走り。監督指示に関わらず必ずアシスト戦としてカウントされ、監督評価も下がらない（献身の道向き）" },
};

export function buildMyLifeSim(raceMeta, player, myTeamName, classIdx, difficultyId, dayTag, directiveKey, rival, year, rival2, teammates, tactic, worldStars, worldRosters) {
  const diffDef = DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1];
  const diffAiMul = diffDef.aiMul;
  const aiCap = diffDef.abilCap ?? 94; // v35(バランス): 難易度別のAI能力上限（hard/oniは94超）
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
  const playerEff = effAbilities(player, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
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
  // v33.12（A-3）：世界ランキング上位の永続スターを、実際のレースに名前付きで出走させる。
  // グレードが高いほど強豪が集う。殿堂・ライバルのチームとは重ならないよう割り当てる。
  const worldStarTeams = {}; // teamName -> { star, rank }
  if (worldStars && worldStars.length) {
    const nWant = ({ 1: 1, 2: 2, 3: 3, 4: 4 }[raceMeta.grade] || 1) - Object.keys(legendTeams).length;
    if (nWant > 0) {
      const avail = MYLIFE_TEAMS.filter(d => d.name !== myTeamName && !(rival && d.name === rival.team) && !(rival2 && d.name === rival2.team) && !legendTeams[d.name]);
      const pool = worldStars.slice(0, Math.min(worldStars.length, nWant * 3));
      const chosen = [...pool].sort(() => rng() - 0.5).slice(0, Math.min(nWant, avail.length));
      const teamsForStar = [...avail].sort(() => rng() - 0.5);
      chosen.forEach((st, i) => { if (teamsForStar[i]) worldStarTeams[teamsForStar[i].name] = { star: st, rank: worldStars.indexOf(st) + 1 }; });
    }
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
    } else if (worldRosters && worldRosters[d.name] && worldRosters[d.name].length) {
      // v37: 永続ワールドロースターから同じ顔ぶれを出走させる（identityは固定・stats は文脈スケール）。
      // 各選手の stats は id＋year でシードして年内は安定、年が進むと power の上昇で強くなる。
      const roster = worldRosters[d.name];
      roster.slice(0, Math.min(aiSquadN, roster.length)).forEach(wr => {
        const wrng = mulberry(((wr.id * 2654435761) ^ ((year || 1) * 40503)) >>> 0);
        const st = newRider(power + (wr.baseline || 0), wrng, { type: wr.type, cap: aiCap, banned: nameBanned });
        st.id = wr.id; st.name = wr.name; st.type = wr.type; st.personality = wr.personality || st.personality;
        if (wr.abilities) st.abilities = wr.abilities;
        st.goldAbilities = wr.goldAbilities || [];
        st.growthPow = wr.growthPow || st.growthPow;
        members.push(st);
      });
      for (let i = members.length; i < aiSquadN; i++) members.push(newRider(power, rng, { banned: nameBanned, cap: aiCap }));
    } else {
      for (let i = 0; i < aiSquadN; i++) members.push(newRider(power + (i === 0 ? 6 : 0), rng, { banned: nameBanned, cap: aiCap }));
    }
    const aiRoles = assignAIRoles(members, aiSquadN);
    const aiStyle = AI_STYLES[Math.floor(rng() * AI_STYLES.length)];
    const teamEntrants = members.map((r, i) => {
      // v29: マイライフのAI相手もeffAbilitiesを通し、体格・調子・大舞台・加速力・メンタルを反映
      const e = effAbilities(r, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
      return {
        id: r.id, name: r.name, type: r.type, abilities: r.abilities, goldAbilities: r.goldAbilities, ...e,
        // v37: 自チームの選手は team を "PLAYER" に統一（プレイヤー本人と同じ）。これでチームTTの
        // チーム集計が自分＋チームメイトで正しくまとまり、集団simのエース同一チーム判定（牽引ペース
        // 合わせ）も効く。表示名 teamName は自チーム名のまま。
        team: isMyTeam ? "PLAYER" : d.name, teamName: d.name, color: d.color, isAce: i === 0, role: aiRoles[r.id], aiStyle,
      };
    });
    if (rival && raceMeta.rivalPresent && d.name === rival.team && d.name !== myTeamName) {
      const rivalStats = newRider(power + 6, rng, { type: rival.type, banned: nameBanned, cap: aiCap });
      rivalStats.abilities = rival.abilities; rivalStats.goldAbilities = rival.goldAbilities;
      const re = effAbilities(rivalStats, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
      teamEntrants[0] = {
        ...teamEntrants[0], ...re,
        id: rival.id, name: rival.name, type: rival.type, abilities: rival.abilities, goldAbilities: rival.goldAbilities,
        isRival: true,
      };
    }
    // v26: 複数ライバル制。2人目のライバル（好敵手）は別チームの出走枠を差し替える
    if (rival2 && raceMeta.rival2Present && d.name === rival2.team && d.name !== myTeamName) {
      const rival2Stats = newRider(power + 6, rng, { type: rival2.type, banned: nameBanned, cap: aiCap });
      rival2Stats.abilities = rival2.abilities; rival2Stats.goldAbilities = rival2.goldAbilities;
      const r2e = effAbilities(rival2Stats, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
      teamEntrants[0] = {
        ...teamEntrants[0], ...r2e,
        id: rival2.id, name: rival2.name, type: rival2.type, abilities: rival2.abilities, goldAbilities: rival2.goldAbilities,
        isRival2: true,
      };
    }
    // v32（世界の統合）：このチームに歴代殿堂選手が割り当てられていればエース枠に差し替える
    if (legendTeams[d.name] && !isMyTeam) {
      const leg = legendTeams[d.name];
      const legStats = newRider(power + 8, rng, { type: leg.type, banned: nameBanned, cap: aiCap });
      legStats.abilities = leg.specialAbilities || legStats.abilities;
      // v37: 過去選手（引退した殿堂選手）は全盛期より衰えて登場する。周回で殿堂が増えるほど
      // 全盛期のまま無限に湧いてインフレする問題を抑える（現役スター＝worldStarは対象外）。
      // 現役時OVRが高いレジェンドほど衰えも大きめ（LEGEND_DECAY_BASE〜。最低でも-8%）。
      const legOvr0 = leg.finalAbilities ? AB_KEYS.reduce((a, k) => a + (leg.finalAbilities[k] || 0), 0) / AB_KEYS.length : 70;
      const decay = Math.max(0.82, 0.92 - Math.max(0, legOvr0 - 80) * 0.006);
      AB_KEYS.forEach(k => { if (leg.finalAbilities && leg.finalAbilities[k] != null) legStats[k] = Math.round(leg.finalAbilities[k] * decay); });
      SUB_STAT_KEYS.forEach(k => { if (leg.finalSubStats && leg.finalSubStats[k] != null) legStats[k] = Math.round(leg.finalSubStats[k] * decay); });
      const le = effAbilities(legStats, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
      teamEntrants[0] = {
        ...teamEntrants[0], ...le,
        id: legStats.id, name: leg.name, type: leg.type, abilities: legStats.abilities, goldAbilities: legStats.goldAbilities,
        isLegend: true, legendTitle: leg.careerTitle || null,
      };
    }
    // v33.12（A-3）：世界ランキングのスターをエース枠に差し替える（isLegendと排他）
    if (worldStarTeams[d.name] && !isMyTeam && !legendTeams[d.name]) {
      const { star, rank } = worldStarTeams[d.name];
      const wsStats = newRider(power, rng, { type: star.type, banned: nameBanned });
      const keyset = TYPE_ABKEYS[star.type] || [];
      AB_KEYS.forEach(k => { wsStats[k] = Math.max(40, Math.min(98, Math.round(star.rating - 8 + (keyset.includes(k) ? 8 : 0) + rng() * 5))); });
      const we = effAbilities(wsStats, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
      teamEntrants[0] = {
        ...teamEntrants[0], ...we,
        id: wsStats.id, name: star.name, type: star.type, abilities: wsStats.abilities, goldAbilities: wsStats.goldAbilities,
        isWorldStar: true, worldRank: rank, bloodOf: star.bloodOf || null,
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
          // v35: 献身は「格下のエースを自分の走力の近くまで引き上げ、格上の展開に乗せる」もの。
          // 弱いエースが千切れて牽引が届かず無意味になる問題を解消するため、各能力を
          // 「プレイヤー実効値 - gap」まで底上げする（＝風除け・位置取り・ボトルで勝負所へ運ぶ）。
          // 「献身のアシスト」持ちほど密着でき、格差(gap)が縮まる。
          const gap = hasAbility(player, "domestique") ? (hasGoldAbility(player, "domestique") ? 4 : 6) : 9;
          AB_KEYS.forEach(k => { ace[k] = Math.min(99, Math.max((ace[k] || 0) + boost, (playerEff[k] || 0) - gap)); });
          ace.assistBoost = boost;
          // v35: 守られるエースは風除け・位置取りの恩恵で脚を温存でき、集団から千切れにくくなる
          ace.isAssisting = true;
          assistedAceRef = ace;
        }
      }
      // v32（条件付き作戦）：早めに逃げる作戦なら、プレイヤーを逃げ要員として飛び出させる
      const playerRole = tac.playerBreakaway ? "breakaway" : (playerIsAce ? "lead" : "sub");
      riders.push({
        id: player.id, name: player.name, type: player.type, abilities: player.abilities, goldAbilities: player.goldAbilities, ...playerEff,
        team: "PLAYER", teamName: myTeamName, color: C.yellow,
        isAce: playerIsAce, role: playerRole, isPlayerChar: true,
        // v35: アシストに徹する選手は脚を賢く使い自滅しない（energyDrainで消耗軽減）
        isAssisting: !!(tac.playerAssist && !playerIsAce),
      });
    }
    teamEntrants.forEach(en => riders.push(en));
  });
  const sim = { entrants: riders, riders, course, groupMode: "full", raceMeta, breakSurvived: false };
  // v37: チームTTはペロトンではなくチーム単位の合算タイム。マイライフでも「個人の順位」ではなく
  // 「チームの順位」で結果を出す（従来は teamTT 未対応で個人simへ落ちて個人リザルトになっていた）。
  if (raceMeta.tmpl && raceMeta.tmpl.teamTT) {
    computeTeamTT(sim, 1);
    sim.hadBreak = false;
    return sim;
  }
  // v32（条件付き作戦）：選択した作戦をレース全体の指示（集団牽引の強さ・エース発射）へ反映
  const tac = ML_TACTICS[tactic] || ML_TACTICS.balanced;
  simulateTicks(course, riders, 0, { chaseMode: tac.chaseMode, aceEarly: tac.aceEarly }, false);
  rankSim(sim);
  // v36修正: レース後にfinishTimeを書き換えると、観戦アニメ（posHist）と着順（finishTime）が
  // 食い違い「先頭でゴールしたのにリザルト2位」等の同期ズレが起きていた。着順の書き換えは全廃し、
  // 献身の作用はすべてシミュレーション内で完結させる：(1)エースは能力ブースト＋風除け（isAssisting=
  // 消耗軽減）で勝負圏に残る、(2)アシスト本人は最終直線で流して勝負を譲る（isAssistingの最終区間
  // ハンドリング）。結果はシミュレーション（＝観戦）そのまま＝アニメと必ず一致する。
  if (assistedAceRef) {
    // 結果画面用に、献身で押し上げたエースの最終着順（シミュレーション通り）を渡すだけ
    sim.assistedAce = { name: assistedAceRef.name, rank: assistedAceRef.rank, boost: assistedAceRef.assistBoost };
  }
  return sim;
}


// --- Phase 2追補（取りこぼし関数を追加抽出）---
export const META_KEY = "roadrace_v12_meta";

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] };
    const m = JSON.parse(raw);
    // v37: CPショップ用に cpSpent（累計使用CP）・cpUnlocks（購入済みid）を保持
    return { totalEarnedCP: m.totalEarnedCP || 0, cpSpent: m.cpSpent || 0, cpUnlocks: Array.isArray(m.cpUnlocks) ? m.cpUnlocks : [] };
  } catch (e) { return { totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] }; }
}
// v37: CPショップ。貯めたCP（残高＝totalEarnedCP−cpSpent）を使って恒久解禁を購入する。
export function cpBalance(meta) { return Math.max(0, (meta.totalEarnedCP || 0) - (meta.cpSpent || 0)); }

// 購入式の恒久解禁カタログ（従来の自動ミルストーンとは別の"選んで買う"プレミアム枠）。
export const CP_SHOP = [
  { id: "s_rookie", cost: 45, category: "シーズン", label: "エース級新人 確定枠", desc: "シーズン開始時、成長ランクS確定の逸材が1名追加加入", season: { prodigyRookie: 1 } },
  { id: "s_budget", cost: 30, category: "シーズン", label: "開幕資金 +800万円", desc: "シーズン開始時の資金が+800万円", season: { budget: 800 } },
  { id: "s_equip", cost: 55, category: "シーズン", label: "全設備 Lv+3", desc: "フレーム・ホイールの強化レベルが+3された状態でスタート", season: { equipLv: 3 } },
  { id: "m_gold", cost: 60, category: "マイライフ", label: "デビュー時 金特1つ確定", desc: "新人が必ず特能を1つ金特で持ってデビューする", mylife: { debutGold: true } },
  { id: "m_growth", cost: 45, category: "マイライフ", label: "初期成長力 +1段 確定", desc: "デビュー時、成長力が確定で1段階アップ", mylife: { growthUp: true } },
  { id: "m_money", cost: 25, category: "マイライフ", label: "支度金 +300万円", desc: "デビュー時の所持金が+300万円", mylife: { money: 300 } },
  { id: "m_reroll", cost: 35, category: "マイライフ", label: "リセマラ当たり率 大幅UP", desc: "デビュー当たり特能（天啓/天賦の才）の抽選が大きく上がる", mylife: { boonBonus: 0.25 } },
  { id: "x_boost", cost: 70, category: "特別", label: "英才教育：初期能力ブースト", desc: "シーズン＝全選手の能力+6／マイライフ＝デビュー時の能力+6でスタート", season: { rosterBoost: 6 }, mylife: { statBoost: 6 } },
];
export function cpOwned(meta, id) { return (meta.cpUnlocks || []).includes(id); }
export function cpBuy(meta, id) {
  const item = CP_SHOP.find(x => x.id === id);
  if (!item || cpOwned(meta, id) || cpBalance(meta) < item.cost) return meta;
  return { ...meta, cpSpent: (meta.cpSpent || 0) + item.cost, cpUnlocks: [...(meta.cpUnlocks || []), id] };
}
export function cpShopSeasonPerks(meta) {
  const acc = { prodigyRookie: 0, budget: 0, equipLv: 0, rosterBoost: 0 };
  CP_SHOP.forEach(it => { if (cpOwned(meta, it.id)) { const s = it.season || {}; acc.prodigyRookie += s.prodigyRookie || 0; acc.budget += s.budget || 0; acc.equipLv += s.equipLv || 0; acc.rosterBoost += s.rosterBoost || 0; } });
  return acc;
}
export function cpShopMylifePerks(meta) {
  const acc = { debutGold: false, growthUp: false, money: 0, boonBonus: 0, statBoost: 0 };
  CP_SHOP.forEach(it => { if (cpOwned(meta, it.id)) { const m = it.mylife || {}; if (m.debutGold) acc.debutGold = true; if (m.growthUp) acc.growthUp = true; acc.money += m.money || 0; acc.boonBonus += m.boonBonus || 0; acc.statBoost += m.statBoost || 0; } });
  return acc;
}

export function saveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* noop */ }
}

export const TITLES_KEY = "roadrace_v12_titles";

export function loadTitles() {
  try { const raw = localStorage.getItem(TITLES_KEY); const o = raw ? JSON.parse(raw) : {}; return (o && typeof o === "object") ? o : {}; } catch (e) { return {}; }
}

export function recordTitle(kind) {
  if (!kind) return;
  const t = loadTitles();
  t[kind] = (t[kind] || 0) + 1;
  try { localStorage.setItem(TITLES_KEY, JSON.stringify(t)); } catch (e) { /* noop */ }
}
