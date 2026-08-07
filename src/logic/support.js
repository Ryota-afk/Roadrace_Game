// 表示ヘルパー関数＋残存データ定数（Phase 4-1で main.jsx から分離）。
// v41(§Step3): 静的データ定数（export const の大半）は data/economy.js, data/events.js,
// data/directives.js, data/gear.js, data/progression.js へ移送済み。ここでは import して
// 内部利用しつつ再エクスポートし、main.jsx/screens/*.jsx 側の既存 import 文（"./logic/support.js"）
// を変更せずに済むようにしている（＝互換シム。将来的に呼び出し側を data/* への直接importへ
// 揃えれば、このファイルの再エクスポート行は削除できる）。
import { legendBloodId, loadMlLegends, saveMlLegends, loadBloodlines, mlBloodlineTier } from "../breeding/breeding.js";
import { ASSIST_ROLES, GOLD_CONDITIONS, countRoleUses, countWins, hasAbility, mulberry, newRider, overall, pickRiderName, ridState, rollAbilities, strHash } from "../core/core.js";
import { ABILITIES, AB_KEYS, AB_LABEL, GROWTH, PERSONALITIES, TYPES } from "../data/abilities.js";
import { BREED_NICKS } from "../data/breeding.js";
import { VENUE_REGION, UNLOCK_TEMPLATES } from "../data/course.js";
import { EVENT_CHANCE, GRADE_MUL, MLCP_DIFF_MUL, ML_CP_MILESTONES, OB_COACH_SALARY, POP_MILESTONES, PRIZES, PTS, SCOUT_POLICIES, SLOT_LABEL, STAFF_MAX_BY_CLASS, STAFF_META, STAFF_ROLES, STAFF_SALARY_PER_LV, TYPE_COACH_ABILITY, WEATHER } from "../data/economy.js";
import { ROOM_GRADE_MAX, ROOM_UPGRADE_KEYS } from "../data/roomUpgrade.js";
import { EVENTS, ML_BACKGROUNDS, ML_EVENTS, ML_PERSONALITY_EVENTS, ML_SPONSOR_GIGS } from "../data/events.js";
import { MANAGER_DIRECTIVES, SEASON_OBJECTIVES } from "../data/directives.js";
import { ML_AB_COACH_KEY, ML_CARS, ML_GEAR, ML_HOUSES, ML_SPECIAL_TRAINING, ML_STOCK_ITEMS } from "../data/gear.js";
import { ABILITY_CATEGORY_ORDER, APT_GRADE_COLOR, CHEMISTRY_TIERS, CLASS_TIER_COLOR, DIFFICULTIES, DISCIPLINES, DISCIPLINE_KEYS, FAVORS_TO_DISCIPLINE, GROWTHPOW_ORDER, GROWTH_ORDER, GROWTH_POW_LADDER, ML_AMBITION_PATH_KEYS, SUB_STAT_LABEL } from "../data/progression.js";
import { C } from "../data/theme.js";
import { AI_STYLES, assignAIRoles, computeTeamTT, effAbilities, generateCourse, rankSim, simulateTicks } from "../sim/race.js";
import { ML_AMBITION_PATHS, ML_SAVE_KEY, MYLIFE_TEAMS, RIVAL_TEAMS, SAVE_KEY, mlAmbitionMetricValue, mlFirstUnmetRung } from "../state/state.js";
import { mlWorldStarsForYear } from "../world/world.js";
import { riderFlavorText } from "../view/flavor.js";
import { mlNewspaper, mlWorldNews, rivalNews } from "../view/news.js";
import { computePickupChance } from "../domain/season/transfer.js";
import { genSeasonObjective, raceObjectiveEvent, advanceObjective, expireObjective, objectiveStatusText } from "../domain/season/sponsor.js";
import { computeStandings, seasonRank, seasonTitleRace, standingsRankReward, champPromoteCut } from "../domain/season/standings.js";
import { raceForecast } from "../domain/shared/forecast.js";

// data/* ・ view/* ・ domain/* へ移送した定数・関数の再エクスポート（呼び出し側の import 文を変更しないための互換シム）
export {
  EVENT_CHANCE, GRADE_MUL, MLCP_DIFF_MUL, ML_CP_MILESTONES, OB_COACH_SALARY, POP_MILESTONES, PRIZES, PTS,
  SCOUT_POLICIES, SLOT_LABEL, STAFF_MAX_BY_CLASS, STAFF_META, STAFF_ROLES, STAFF_SALARY_PER_LV, TYPE_COACH_ABILITY, WEATHER,
  EVENTS, ML_BACKGROUNDS, ML_EVENTS, ML_PERSONALITY_EVENTS, ML_SPONSOR_GIGS,
  MANAGER_DIRECTIVES, SEASON_OBJECTIVES,
  ML_AB_COACH_KEY, ML_CARS, ML_GEAR, ML_HOUSES, ML_SPECIAL_TRAINING, ML_STOCK_ITEMS,
  ABILITY_CATEGORY_ORDER, APT_GRADE_COLOR, CHEMISTRY_TIERS, CLASS_TIER_COLOR, DISCIPLINES, DISCIPLINE_KEYS,
  FAVORS_TO_DISCIPLINE, GROWTHPOW_ORDER, GROWTH_ORDER, GROWTH_POW_LADDER, ML_AMBITION_PATH_KEYS, SUB_STAT_LABEL,
  riderFlavorText, mlNewspaper, mlWorldNews, rivalNews,
  computePickupChance,
  genSeasonObjective, raceObjectiveEvent, advanceObjective, expireObjective, objectiveStatusText,
  computeStandings, seasonRank, seasonTitleRace, standingsRankReward, champPromoteCut,
  raceForecast,
};

export function upgradeGoldAbilities(r) {
  const abilities = r.abilities || [];
  const current = r.goldAbilities || [];
  const next = [...current];
  let changed = false;
  Object.keys(GOLD_CONDITIONS).forEach(id => {
    if (abilities.includes(id) && !next.includes(id) && GOLD_CONDITIONS[id](r)) { next.push(id); changed = true; }
  });
  return changed ? { ...r, goldAbilities: next } : r;
}

export const ACQUIRE_CONDITIONS = {
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
  // v34(C-2): 各モニュメント（古典）で表彰台に立つと、その古典専用の適性に開眼する余地が生まれる（脚質別）
  pave_sp:     r => (r.raceLog || []).some(e => e.monument === "pave" && e.rank <= 3),
  ardennes_sp: r => (r.raceLog || []).some(e => e.monument === "ardennes" && e.rank <= 3),
  autumn_sp:   r => (r.raceLog || []).some(e => e.monument === "autumn" && e.rank <= 3),
};

export function acquireNewAbility(r) {
  const abilities = r.abilities || [];
  if (abilities.length >= 3) return r;
  const eligible = Object.keys(ACQUIRE_CONDITIONS).filter(id => !abilities.includes(id) && ACQUIRE_CONDITIONS[id](r));
  if (eligible.length === 0 || Math.random() >= 0.15) return r;
  const id = eligible[Math.floor(Math.random() * eligible.length)];
  return { ...r, abilities: [...abilities, id] };
}

export const ABILITY_FILE_KEY = "roadrace_v12_ability_file";

export function loadAbilityFile() {
  try {
    const raw = localStorage.getItem(ABILITY_FILE_KEY);
    if (!raw) return { normal: [], gold: [] };
    const parsed = JSON.parse(raw);
    return { normal: Array.isArray(parsed.normal) ? parsed.normal : [], gold: Array.isArray(parsed.gold) ? parsed.gold : [] };
  } catch (e) { return { normal: [], gold: [] }; }
}

export function saveAbilityFile(data) {
  try { localStorage.setItem(ABILITY_FILE_KEY, JSON.stringify(data)); } catch (e) { /* noop */ }
}

export function noteAbilityDiscovery(riders) {
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

export const persMul = (r, k) => (PERSONALITIES[r.personality]?.mul[k]) || 1;

// v43(マイライフ難易度調整Phase 1): 突破力(breakthrough)をgrowthFactorと同じ考え方で反映。
// breakthrough=50（既定・旧セーブ互換）のとき0.5+50/100=1で従来のexp(-(v-cap)/4)と完全一致する。
export const softFactor = (v, cap = 88, breakthrough = 50) => (v < cap ? 1 : Math.exp(-(v - cap) / (GROWTH_DECAY_DIV * (0.5 + breakthrough / 100))));

// v39.14(バランス): 能力成長の逓減カーブ。従来のsoftFactorは「capまで減速ゼロ→capで壁」だったため、
// 伸びが一直線に上限へ張り付き、2年ほどでカンスト＝以降の成長に手応えが無くなっていた。
// 上限の手前TAPERから徐々に鈍らせ、「最後の20点は簡単には埋まらない」育成カーブにする。
export const GROWTH_TAPER = 42;
export const GROWTH_AT_CAP = 0.2;                  // 上限到達時点の伸び倍率（ここから先はさらに急減衰）
export const GROWTH_DECAY_DIV = 4;                 // 上限超過後の減衰の緩さ（大きいほど緩やかに減衰）
// v43(マイライフ難易度調整Phase 1): 新ステータス「突破力」(breakthrough, 1〜100・既定50)。
// 上限到達時点の伸び倍率(atCap)と減衰の緩さ(decayDiv)の両方を、既定値(50)を中心に
// ±50%の範囲で動かす（breakthrough=50のとき従来どおりGROWTH_AT_CAP/GROWTH_DECAY_DIVと
// 完全一致する連続式にしてあるため、突破力を持たない旧セーブの選手・NPCも挙動が変わらない）。
export const growthFactor = (v, cap = 88, breakthrough = 50) => {
  const atCap = GROWTH_AT_CAP * (0.5 + breakthrough / 100);
  const decayDiv = GROWTH_DECAY_DIV * (0.5 + breakthrough / 100);
  // 上限超過は急減衰。上限ぴったりで倍率が跳ね上がらないよう、逓減カーブの終端値から連続させる
  if (v >= cap) return atCap * Math.exp(-(v - cap) / decayDiv);
  const t = Math.max(0, Math.min(1, (v - (cap - GROWTH_TAPER)) / GROWTH_TAPER));
  return 1 - (1 - atCap) * t * t;
};

export const addAb = (r, k, amount, cap) => { r[k] = r[k] + amount * growthFactor(r[k], cap, r.breakthrough ?? 50); };

// v38(改善): 副ステ（加速力/体格/メンタル）の上限を 94→110、フル成長域を 88→100 に拡張。
// 従来はメンタルが数年で94にカンストして「大舞台の経験で育つ」意味が消えていた。天井を上げ、
// 高域はソフトキャップで緩やかに伸ばす＝キャリアを通じて育て続けられる長期ステータスにする。
export function growSub(r, key, amount) {
  const v = r[key] ?? 50;
  r[key] = Math.min(110, v + amount * softFactor(v, 100, r.breakthrough ?? 50));
}

export function rollCondDir() {
  return Math.random() < 0.34 ? -1 : Math.random() < 0.5 ? 0 : 1;
}

export const bumpRosterAbAll = (state, amount) => ({
  ...state,
  roster: state.roster.map(r => ({ ...r, ...Object.fromEntries(AB_KEYS.map(k => [k, Math.min(94, Math.round(r[k] + amount))])) })),
});

export const bumpEquipLv = (state, amount) => ({
  ...state,
  // B1スタート時点のequipMax（3+classIdx=3+0）を超えないよう安全のためクランプ
  equip: { ...state.equip, frame: Math.min(3, state.equip.frame + amount), wheels: Math.min(3, state.equip.wheels + amount) },
});

export const addProdigyRookie = (state) => {
  const rng = mulberry(Date.now() % 999983 + state.roster.length * 7919);
  const banned = new Set(state.roster.map(r => r.name));
  // v24: age未指定だとnewRiderが22〜33歳のどれかをランダムに割り当ててしまい、成長タイプの
  // 組み合わせによっては加入した瞬間から衰え期の逸材が出て萎えるというフィードバックを受けた。
  // クリアポイントで確保する逸材は必ず18〜20歳の若手にし、どの成長タイプでも
  // 加入時点でまだ成長期／全盛期に入りたてであることを保証する
  const rookie = newRider(70, rng, { banned, forceProdigy: true, age: 18 + Math.floor(rng() * 3) });
  return { ...state, roster: [...state.roster, rookie] };
};

export const CP_MILESTONES = [
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
  // v37: 高CP帯の拡張（周回を重ねたプレイヤーへのさらなる開幕強化）
  { cp: 130, label: "開幕資金 +600万円", desc: "初期資金にさらに+600万円", apply: s => ({ ...s, budget: s.budget + 600 }) },
  { cp: 160, label: "★★★ チーム設備 Lv2底上げ", desc: "フレーム・ホイールの強化レベルがさらに+2（計Lv5相当）", apply: s => bumpEquipLv(s, 2) },
  { cp: 200, label: "★★★★ 逸材新人をもう1名＋全員能力+12", desc: "成長ランクS確定の逸材がさらに1名加入し、ロースター全員の能力値も+12（頂点）", apply: s => bumpRosterAbAll(addProdigyRookie(s), 12) },
  // v38(#5): 200pt頭打ちの解消。さらに上のCP帯を追加し、周回の到達目標を延伸する。
  { cp: 250, label: "開幕資金 +1000万円", desc: "初期資金にさらに+1000万円", apply: s => ({ ...s, budget: s.budget + 1000 }) },
  { cp: 320, label: "★★★★ チーム設備 Lv3底上げ", desc: "フレーム・ホイールの強化レベルがさらに+3", apply: s => bumpEquipLv(s, 3) },
  { cp: 400, label: "★★★★★ 逸材新人をもう1名＋全員能力+15（極致）", desc: "成長ランクS確定の逸材がさらに1名加入し、ロースター全員の能力値も+15（メタ進行の極致）", apply: s => bumpRosterAbAll(addProdigyRookie(s), 15) },
];

export function applyCpMilestones(state, totalEarnedCP) {
  return CP_MILESTONES.filter(m => totalEarnedCP >= m.cp).reduce((s, m) => m.apply(s), state);
}

export function mlCpPerks(totalCP) {
  const acc = { money: 0, pop: 0, eval: 0, growthLottery: 0, boonBonus: 0 };
  ML_CP_MILESTONES.filter(m => totalCP >= m.cp).forEach(m => {
    const p = m.perk || {};
    acc.money += p.money || 0; acc.pop += p.pop || 0; acc.eval += p.eval || 0;
    acc.growthLottery += p.growthLottery || 0; acc.boonBonus += p.boonBonus || 0;
  });
  return acc;
}

export function computeClearPoints(year, difficultyId) {
  const speedBonus = Math.max(0, 15 - Math.max(0, year - 2) * 2);
  const diffBonus = { easy: 0, normal: 4, hard: 10, oni: 22 }[difficultyId] || 0;
  return 5 + speedBonus + diffBonus;
}

// v37: マイライフのキャリアからも生涯クリアポイント(CP)を獲得できるように（メタ進行の統合）。
// 引退時に、通算成績・タイトル・クラシック・世界ランク・現役年数から算出する純関数。
export function computeMyLifeClearPoints(ml) {
  if (!ml) return { total: 0, parts: [] };
  const wins = ml.careerWins || 0;
  const bigWins = ml.careerBigWins || 0;
  const titles = ml.careerTitles || 0;
  const classics = ml.careerClassics || 0;
  const best = ml.worldRankBest;
  const years = ml.year || 1;
  const parts = [];
  parts.push({ label: "完走ボーナス", cp: 3 });
  const winCp = Math.min(40, wins); if (winCp) parts.push({ label: `通算${wins}勝`, cp: winCp });
  const bigCp = Math.min(30, bigWins * 2); if (bigCp) parts.push({ label: `格上勝利${bigWins}回`, cp: bigCp });
  const titleCp = titles * 8; if (titleCp) parts.push({ label: `世界/五輪タイトル${titles}回`, cp: titleCp });
  const classicCp = classics * 5; if (classicCp) parts.push({ label: `クラシック制覇${classics}回`, cp: classicCp });
  let rankCp = 0;
  if (best != null) rankCp = best === 1 ? 30 : best <= 3 ? 20 : best <= 10 ? 12 : best <= 50 ? 5 : 0;
  if (rankCp) parts.push({ label: `世界最高${best}位`, cp: rankCp });
  const longCp = Math.min(10, Math.floor(years * 0.5)); if (longCp) parts.push({ label: `現役${years}年`, cp: longCp });
  const rawTotal = parts.reduce((a, b) => a + b.cp, 0);
  // v38(#5/#6): 難易度でCP獲得を増減。イージー周回でCPが溢れる（3人殿堂で200pt頭打ち）問題に対し、
  // イージーは獲得を抑え、挑戦（ノーマル以上）ほど多く報いる＝CPは「難所を越えた勲章」になる。
  const diffMul = MLCP_DIFF_MUL[ml.difficulty] ?? 1;
  const total = Math.round(rawTotal * diffMul);
  if (diffMul !== 1) parts.push({ label: `難易度補正 ×${diffMul}`, cp: total - rawTotal });
  return { total, parts, diffMul };
}

// v37: CP解禁の一覧（生涯評価画面で「何がいつ解禁されるか」を見せる）。
// コース解禁(unlockCP)＋シーズン開幕ミルストーン(CP_MILESTONES)＋マイライフ特典(ML_CP_MILESTONES)を統合。
export function cpUnlockRows(totalCP) {
  const rows = [];
  (UNLOCK_TEMPLATES || []).forEach(t => rows.push({ cp: t.unlockCP || 0, category: "コース", label: `新コース「${t.kind}」`, unlocked: totalCP >= (t.unlockCP || 0) }));
  (CP_MILESTONES || []).forEach(m => rows.push({ cp: m.cp, category: "シーズン開幕", label: m.label, unlocked: totalCP >= m.cp }));
  ML_CP_MILESTONES.forEach(m => rows.push({ cp: m.cp, category: "マイライフ", label: m.label, unlocked: totalCP >= m.cp }));
  rows.sort((a, b) => a.cp - b.cp);
  return rows;
}

export const COURSE_REC_KEY = "roadrace_v12_course_records";

export function loadCourseRecords() {
  try { const raw = localStorage.getItem(COURSE_REC_KEY); const o = raw ? JSON.parse(raw) : {}; return (o && typeof o === "object") ? o : {}; } catch (e) { return {}; }
}

export function saveCourseRecords(recs) {
  try { localStorage.setItem(COURSE_REC_KEY, JSON.stringify(recs)); } catch (e) { /* noop */ }
}

// v41(§Step7第4弾): recordCourseResultは「判定（読み取り）」と「更新（書き込み）」を1関数に
// 同居させていたため、setG/setMlのupdater内で呼ぶと非冪等（updaterが複数回呼ばれるとprevが
// 既に更新済みになりisNewの値が呼び出しごとに変わる）だった。判定はreducerがUI表示用に同期的に
// 必要とするためpeekCourseRecordとして残し、書き込みはApp()側のuseEffectへ分離した
// （persistCourseRecord・詳細はDEVLOG §9参照）。
export function peekCourseRecord(kind, length, winnerTime, holder, isPlayer) {
  if (!kind || !winnerTime || winnerTime <= 0 || !length) return null;
  const speed = Math.round((length / winnerTime) * 100);
  const recs = loadCourseRecords();
  const prev = recs[kind] || null;
  const isNew = !prev || speed > prev.speed;
  return { kind, speed, isNew, prev, holder: holder || "—", isPlayer: !!isPlayer };
}

export function persistCourseRecord(courseRecord, year) {
  if (!courseRecord || !courseRecord.isNew) return;
  const recs = loadCourseRecords();
  recs[courseRecord.kind] = { speed: courseRecord.speed, holder: courseRecord.holder, isPlayer: courseRecord.isPlayer, year: year || 1 };
  saveCourseRecords(recs);
}

export function mlGradeColor(g) {
  return g === "SS" ? "#ff5db1" : g === "S" ? "#ffd24a" : g === "A" ? "#ff9f43" : g === "B" ? "#6cc8e5" : g === "C" ? "#9aa7b4" : "#7a828c";
}

export function bloodIdToName(id, map) {
  if (!id) return "？";
  if (map && map[id]) return map[id].name;
  const m = /^b:(.+)#\d+$/.exec(id) || /^n:(.+)$/.exec(id);
  return m ? m[1] : id;
}

export function buildBloodMap(legends) {
  const map = {};
  (legends || []).forEach(l => { const id = legendBloodId(l); if (id) map[id] = l; });
  return map;
}

// v38(#9 B-4): 系譜フォレスト。殿堂選手を系統（lineageName）ごとにまとめ、世代順に親子の連なりを
// 返す純関数。ダイナスティ（血の連なり）を可視化し、A案（統合ダイナスティ）の入口にする。
// 戻り値: [{ lineageName, tier, size, members: [{name,type,generation,plusValue,overall,nickname,parents:[name]}] }]
export function mlLineageForest(legends) {
  const legs = legends || loadMlLegends();
  const map = buildBloodMap(legs);
  const blood = loadBloodlines();
  const groups = {};
  legs.forEach(l => {
    const key = l.lineageName || `${l.name || "無名"}系`;
    (groups[key] = groups[key] || []).push(l);
  });
  return Object.entries(groups).map(([lineageName, members]) => {
    const rec = blood[lineageName];
    const tier = mlBloodlineTier(rec);
    const rows = members
      .slice()
      .sort((a, b) => (a.generation || 0) - (b.generation || 0) || (a.retiredAt || 0) - (b.retiredAt || 0))
      .map(l => ({
        name: l.name, type: l.type, generation: l.generation || 0, plusValue: l.plusValue || 0,
        overall: l.overall || 0, nickname: l.nickname || null,
        parents: (l.parents || []).map(pid => bloodIdToName(pid, map)).filter(n => n && n !== "？"),
      }));
    return { lineageName, tier, size: members.length, members: rows };
  }).sort((a, b) => (b.tier.tier - a.tier.tier) || (b.size - a.size));
}

export function breedNickTableRows() {
  return Object.entries(BREED_NICKS)
    .map(([k, v]) => ({ pair: k.split("+"), ...v }))
    .sort((a, b) => (a.rank === b.rank ? 0 : a.rank === "◎" ? -1 : b.rank === "◎" ? 1 : a.rank === "○" ? -1 : 1));
}

export function mlSetEpilogue(text) {
  const legends = loadMlLegends();
  if (legends.length === 0) return;
  legends[legends.length - 1] = { ...legends[legends.length - 1], epilogue: text };
  saveMlLegends(legends);
}

export function mlSetAutobiography(quote) {
  const legends = loadMlLegends();
  if (legends.length === 0) return;
  legends[legends.length - 1] = { ...legends[legends.length - 1], autobiography: quote };
  saveMlLegends(legends);
}

export function mlAutobiographyOptions(s) {
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

export function mlEpilogueDirector(s) {
  const r = s.player;
  const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
  const tone = wins >= 10 ? "百戦錬磨の経験を武器に" : wins >= 3 ? "現役時代に培った勘を頼りに" : "現役時代の悔しさを糧に";
  return `引退後は${s.team}のスポーツディレクターに転身。${tone}後進の指導にあたった。数年後、教え子の一人がプロ入りを果たしたという知らせが届いた。`;
}

export function mlEpilogueAway(s) {
  const r = s.player;
  return `引退後は競技の一線から静かに退き、第二の人生を歩み始めた。${r.name}の名は、あの頃を知るファンの記憶に長く残り続けている。`;
}

export function groupModeFor(squadN) {
  if (squadN === 1) return "solo";
  if (squadN === 2) return "pelotonOnly";
  return "full";
}

export function raceIsHome(race, homeRegion) {
  return !!(homeRegion && race && race.venue && VENUE_REGION[race.venue] === homeRegion);
}



const STAFF_SURNAMES = ["田中", "佐藤", "鈴木", "高橋", "渡辺", "伊藤", "山本", "中村", "小林", "加藤", "吉田", "山田", "松本", "井上", "木村", "林"];
export function staffMemberName(teamName, role) {
  const rng = mulberry(strHash((teamName || "team") + "#" + role));
  return STAFF_SURNAMES[Math.floor(rng() * STAFF_SURNAMES.length)];
}
// 現在レベルでの具体効果（説明文の一般論ではなく「今いくら効いているか」）
export function staffEffectText(role, lv) {
  if (!lv) return null;
  switch (role) {
    case "manager": return `スポンサー月収 +${lv * 12}%・ノルマ -${lv * 8}%・成功報酬 +${lv * 10}%`;
    case "trainer": return `全選手の練習成長 +${lv * 12}%`;
    case "doctor":  return `故障率 -${lv * 22}%・離脱期間を短縮`;
    case "scout":   return `新人査定のブレ -${Math.min(80, lv * 28)}%・逸材の発掘率アップ`;
    default: return null;
  }
}


export function staffSalaryTotal(staff) {
  if (!staff) return 0;
  return (Object.values(staff).reduce((a, b) => a + b, 0)) * STAFF_SALARY_PER_LV;
}











export const EFFECT_APPLIERS = {
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
  // v36(#9): 性格イベントで「特定の1名」を対象にするための適用子（vは{id,v}）。
  riderAbById: (s, { id, v }) => {
    const pick = s.roster.find(r => r.id === id);
    if (!pick) return s;
    return { ...s, roster: s.roster.map(r => r.id === id
      ? { ...r, ...Object.fromEntries(AB_KEYS.map(k => [k, Math.max(22, Math.min(94, Math.round(r[k] + v)))])) } : r),
      __eventNote: `📈 ${pick.name}の地力が伸びた（全能力+${v}）` };
  },
  riderCondById: (s, { id, v }) => {
    const pick = s.roster.find(r => r.id === id);
    if (!pick) return s;
    return { ...s, roster: s.roster.map(r => r.id === id ? { ...r, cond: Math.max(1, Math.min(5, r.cond + v)) } : r),
      __eventNote: v > 0 ? `😊 ${pick.name}のコンディションが上向いた` : `😔 ${pick.name}の調子が下がった` };
  },
  riderFatigueById: (s, { id, v }) => {
    const pick = s.roster.find(r => r.id === id);
    if (!pick) return s;
    return { ...s, roster: s.roster.map(r => r.id === id ? { ...r, fatigue: Math.max(0, Math.min(100, r.fatigue + v)) } : r) };
  },
};

// v36(#9): 性格ベースのチームイベント（シーズン）。ロースターから1名を選び、その選手の性格に応じた
// 出来事＋二択を生成する（対象選手のidを効果に埋め込む）。該当者がいなければnull。
const SEASON_PERS_EVENTS = {
  hotblood: (r) => ({ title: `${r.name}がチームを鼓舞`, text: `熱血漢の${r.name}が「今年こそやってやる！」とチーム全体に檄を飛ばしている。`,
    choices: [
      { label: "勢いに乗る", result: `${r.name}の熱がチームに伝播し、全員の士気が上がった。本人は少し飛ばしすぎた。`, effects: { rosterCondAll: 1, riderFatigueById: { id: r.id, v: 10 } } },
      { label: "落ち着かせる", result: `熱くなりすぎないよう声をかけ、${r.name}をうまくクールダウンさせた。`, effects: { riderFatigueById: { id: r.id, v: -12 }, riderCondById: { id: r.id, v: 1 } } },
    ] }),
  seeker: (r) => ({ title: `${r.name}が限界に挑む`, text: `求道者気質の${r.name}が「もっと強くなりたい」と、限界を超える猛練習を志願してきた。`,
    choices: [
      { label: "挑戦を見守る", result: `追い込みを許すと、${r.name}は殻を破って一段成長した。代償に疲労も深い。`, effects: { riderAbById: { id: r.id, v: 2 }, riderFatigueById: { id: r.id, v: 14 } } },
      { label: "無理はさせない", result: `オーバーワークを戒め、計画的な調整に切り替えさせた。`, effects: { riderCondById: { id: r.id, v: 1 }, riderFatigueById: { id: r.id, v: -8 } } },
    ] }),
  artisan: (r) => ({ title: `${r.name}が機材を突き詰める`, text: `職人肌の${r.name}が、ポジションと機材のセッティングを細部まで詰めたいと言い出した。`,
    choices: [
      { label: "とことん付き合う", result: `納得いくまで詰めた結果、${r.name}の走りに無駄がなくなった。`, effects: { riderAbById: { id: r.id, v: 2 } } },
      { label: "ほどほどで休ませる", result: `凝りすぎる前に切り上げさせ、しっかり休養を取らせた。`, effects: { riderFatigueById: { id: r.id, v: -12 }, riderCondById: { id: r.id, v: 1 } } },
    ] }),
  free: (r) => ({ title: `${r.name}のマイペース`, text: `自由人の${r.name}が、練習の合間に気ままな寄り道をして周囲をやきもきさせている。`,
    choices: [
      { label: "大らかに見守る", result: `本人らしさを尊重すると、チームの雰囲気も和み、${r.name}も伸び伸び走れた。`, effects: { rosterCondAll: 1 } },
      { label: "少し引き締める", result: `けじめをつけるよう促し、${r.name}も気を引き締めた。`, effects: { riderCondById: { id: r.id, v: 1 }, riderFatigueById: { id: r.id, v: -6 } } },
    ] }),
  smart: (r) => ({ title: `${r.name}が戦術を提案`, text: `智将肌の${r.name}が、次戦に向けた緻密な作戦プランを持ちかけてきた。`,
    choices: [
      { label: "作戦を採用する", result: `${r.name}の分析をチームで共有し、全員の狙いが噛み合った。`, effects: { rosterCondAll: 1 } },
      { label: "本人の武器も磨かせる", result: `戦術眼を評価しつつ、自身の走力も伸ばすよう助言した。`, effects: { riderAbById: { id: r.id, v: 2 } } },
    ] }),
  genius: (r) => ({ title: `${r.name}が退屈そうにしている`, text: `天才肌の${r.name}が、いまの練習に物足りなさを感じているようだ。`,
    choices: [
      { label: "高い課題を与える", result: `歯応えのあるメニューに${r.name}は目を輝かせ、才能をさらに開花させた。`, effects: { riderAbById: { id: r.id, v: 3 }, riderFatigueById: { id: r.id, v: 8 } } },
      { label: "自由にやらせる", result: `本人の裁量に任せると、気分良く調子を上げてきた。`, effects: { riderCondById: { id: r.id, v: 1 } } },
    ] }),
  maverick: (r) => ({ title: `${r.name}が単独練習を望む`, text: `一匹狼の${r.name}が「チーム練習より一人で追い込みたい」と申し出てきた。`,
    choices: [
      { label: "独りの流儀を尊重する", result: `思う存分追い込ませると、${r.name}は独走力を大きく伸ばした。`, effects: { riderAbById: { id: r.id, v: 2 }, riderFatigueById: { id: r.id, v: 6 } } },
      { label: "チームに引き込む", result: `根気よく対話し、${r.name}が少しだけ心を開いた。チームの結束が高まった。`, effects: { rosterCondAll: 1 } },
    ] }),
  showman: (r) => ({ title: `${r.name}がメディアの寵児に`, text: `目立ちたがりの${r.name}が取材やSNSで話題を集め、チームの注目度が上がっている。`,
    choices: [
      { label: "広告塔として前に出す", result: `${r.name}のスター性でスポンサーの覚えもめでたく、チームに追い風が吹いた。`, effects: { budget: 20, riderFatigueById: { id: r.id, v: 4 } } },
      { label: "浮かれないよう釘を刺す", result: `地に足をつけるよう諭すと、${r.name}は走りで魅せると誓い、集中を取り戻した。`, effects: { riderCondById: { id: r.id, v: 1 } } },
    ] }),
  tactician: (r) => ({ title: `${r.name}が全体戦術を献策`, text: `策士の${r.name}が、チーム全体の勝ち筋を描いた緻密な作戦を持ち込んできた。`,
    choices: [
      { label: "チーム戦術に採り入れる", result: `${r.name}の描いた盤面を全員で共有し、連携が一段と噛み合った。`, effects: { rosterCondAll: 1 } },
      { label: "本人の走力も伸ばさせる", result: `参謀としての目を評価しつつ、自身の脚も磨くよう促した。`, effects: { riderAbById: { id: r.id, v: 2 } } },
    ] }),
};
export function seasonPersonalityEvent(roster, rng) {
  const r0 = rng || Math.random;
  const pool = (roster || []).filter(r => r.injury === 0 && SEASON_PERS_EVENTS[r.personality]);
  if (!pool.length) return null;
  const r = pool[Math.floor(r0() * pool.length)];
  return SEASON_PERS_EVENTS[r.personality](r);
}

export function applyEventEffects(s, effects) {
  let ns = s;
  Object.entries(effects || {}).forEach(([k, v]) => { if (EFFECT_APPLIERS[k]) ns = EFFECT_APPLIERS[k](ns, v); });
  return ns;
}



export function isHallOfFameWorthy(r) {
  if (r.favorite) return true;
  const log = r.raceLog || [];
  const wins = log.filter(e => e.rank === 1).length;
  const podiums = log.filter(e => e.rank <= 3).length;
  return log.length >= 8 || wins >= 1 || podiums >= 3 || overall(r) >= 70 || !!r.prodigy;
}

export function mlTeamTier(teamName) { const t = MYLIFE_TEAMS.find(t => t.name === teamName); return t ? t.tier : 0; }


// v35(D 物語): 因縁が育つライバル。対戦を重ね、特に接戦（写真判定・僅差）ほど
// 「因縁度(heat)」が燃え上がり、呼称が 好敵手→ライバル→宿敵→宿命の宿敵 と激化する。
// 既存セーブ（heat未保存）は通算対戦数からフォールバック。
export function rivalHeatTier(heat) {
  const h = heat || 0;
  if (h >= 22) return { key: 3, label: "宿命の宿敵", color: "#ff4d4d" };
  if (h >= 11) return { key: 2, label: "宿敵", color: "#ff7a45" };
  if (h >= 4)  return { key: 1, label: "ライバル", color: "#e8a13c" };
  return { key: 0, label: "好敵手", color: "#5aa9e6" };
}

// 1戦で加算される因縁度。接戦ほど大きく燃える（写真判定+3／僅差+2／通常+1）
export function rivalMeetingHeat(gapSec) {
  const g = Math.abs(gapSec == null ? 99 : gapSec);
  if (g < 1) return 3;
  if (g < 4) return 2;
  return 1;
}

// 1戦の「決定的瞬間」を物語る一文を生成。勝敗×接戦度×格上/格下で分岐し、
// 因縁度が上がった瞬間は昇格の煽りも添える。
export function rivalDrama({ beat, gapSec, rivalName, rivalRank, myRank, heatBefore, heatAfter }) {
  const g = Math.abs(gapSec == null ? 99 : gapSec);
  const gTxt = g < 60 ? `${g.toFixed(1)}秒` : `${Math.floor(g / 60)}分${Math.round(g % 60)}秒`;
  const photo = g < 1, close = g < 4;
  let line;
  if (beat) {
    if (photo) line = `写真判定にもつれ込む死闘。わずか${gTxt}、あなたが${rivalName}を競り落とした。`;
    else if (close) line = `最後まで並走する接戦を、${gTxt}振り切って制した。${rivalName}の視線が背中に刺さる。`;
    else line = `${rivalName}を${gTxt}突き放す完勝。今日は完全にあなたの一日だった。`;
  } else {
    if (photo) line = `写真判定の末、わずか${gTxt}。${rivalName}に刺し返された。この悔しさは忘れない。`;
    else if (close) line = `${rivalName}にわずか${gTxt}及ばず。あと一歩、その差を埋める日が来る。`;
    else line = `${rivalName}に${gTxt}の完敗。力の差を見せつけられ、拳を握る。`;
  }
  const before = rivalHeatTier(heatBefore), after = rivalHeatTier(heatAfter);
  const promoted = after.key > before.key ? `——この一戦で、二人の因縁はついに『${after.label}』の域に入った。` : null;
  return { line, promoted, tier: after };
}

// v36(#6): 性格ベースのライバル会話ドラマ（紙芝居/VN風）。ライバルの性格・勝敗・接戦度・因縁度で
// 台詞を分岐し、短い掛け合いを生成する。whenBeaten＝プレイヤーが勝ってライバルが敗れた時、
// whenWon＝ライバルが勝った時、vow＝因縁が深い時に添える決意の一言。
const RIVAL_VOICE = {
  hotblood: {
    whenBeaten: ["「くそぉっ…！ 今日はお前の勝ちだ。だが次は、次こそは俺が前でゴールする！", "「認めるさ、今日は速かった。でもな、この悔しさが俺を強くするんだ！"],
    whenWon: ["「はっはァ！ 見たか、これが俺の走りだ！ ついてこられたか？", "「まだまだだな！ お前が本気を出す前に、俺が突き放させてもらった！"],
    vow: ["「燃えてきたぜ…お前がいるから、俺はもっと速くなれる。次も本気で来い！"],
  },
  seeker: {
    whenBeaten: ["「……強い。今のあなたには、確かに届かなかった。", "「敗因は明確だ。私はまだ、自分の限界の先に手が届いていない。"],
    whenWon: ["「これが今の私の答えだ。あなたの走りも、悪くなかった。", "「勝ち負けは過程に過ぎない。私はただ、より速い自分を求め続けるだけだ。"],
    vow: ["「あなたという壁があるから、私は歩みを止められない。……感謝している。"],
  },
  artisan: {
    whenBeaten: ["「ふむ、完敗だ。あなたのラインどり、無駄がなかった。盗ませてもらうよ。", "「悔しいが、美しい勝ち方だった。職人として、認めざるを得ない。"],
    whenWon: ["「計算通りさ。一つひとつの仕事を、丁寧に積み重ねただけだ。", "「派手さはないが、これが私の流儀でね。届かなかったろう？"],
    vow: ["「あなたと競るたび、自分の技が磨かれていく。良い好敵手を持ったものだ。"],
  },
  free: {
    whenBeaten: ["「あーあ、負けちゃった。まあいいや、今日は楽しかったし！", "「やるねぇ。ちょっと本気出せばよかったかな〜、なんてね。"],
    whenWon: ["「あははっ、勝っちゃった！ 気持ちよかった〜！", "「たまたまだよ、たまたま。でも勝ちは勝ち、もらっとくね！"],
    vow: ["「君と走るの、けっこう好きなんだよね。次もよろしく！"],
  },
  smart: {
    whenBeaten: ["「……想定の範囲外だ。あなたの脚を、少し見誤っていたようだね。", "「データ上は私が有利だったはずだが。面白い、修正して次に臨むとしよう。"],
    whenWon: ["「盤面は最初から見えていた。あなたが仕掛ける前に、決着はついていたのさ。", "「勝つべくして勝った。感情ではなく、戦術がレースを決めるんだ。"],
    vow: ["「あなたは私の計算を狂わせる、数少ない変数だ。……嫌いじゃない。"],
  },
  genius: {
    whenBeaten: ["「へえ、僕を負かすなんて。少しは楽しめそうだね、君となら。", "「まぐれか、実力か。次で見極めさせてもらうよ。"],
    whenWon: ["「言ったろう？ 僕に勝つのは、まだ早いって。", "「才能の差、と言ったら怒るかい？ でも事実なんだから仕方ない。"],
    vow: ["「君が僕に追いつく日を、退屈しのぎに待っていてあげるよ。"],
  },
  normal: {
    whenBeaten: ["「参りました。今日はあなたの方が一枚上手でした。", "「悔しいですけど、完敗です。次は負けません。"],
    whenWon: ["「勝てた…！ 練習の成果が出ました。", "「今日は流れが味方してくれました。でも実力で掴んだ勝ちです。"],
    vow: ["「あなたと競り合えるのが、今は何より励みになります。次も全力で。"],
  },
  maverick: {
    whenBeaten: ["「……ふん。群れないやり方が今日は裏目に出たか。だが俺の走りは変えない。", "「一人でも構わない。次はこの脚で、お前の前を独走してみせる。"],
    whenWon: ["「群れなくても勝てる。俺はそれを証明しただけだ。", "「馴れ合いは要らない。強い奴が前を走る、ただそれだけさ。"],
    vow: ["「お前だけは……認めてやる。俺を本気にさせる、数少ない一人だ。"],
  },
  showman: {
    whenBeaten: ["「うわ、やられた！ でも今日の観客、盛り上がってたろ？ それでいいのさ。", "「主役を持っていかれたか。次はもっと派手に決めてやるよ、見てな！"],
    whenWon: ["「どうだ、見てたか今の差し脚！ これが魅せるってことさ！", "「歓声が聞こえるだろ？ 勝つならこうでなくちゃな！"],
    vow: ["「お前がいると舞台が締まる。次も最高のショーにしようぜ！"],
  },
  tactician: {
    whenBeaten: ["「読みが甘かった。あなたの一手が、私の描いた図面を上回った。", "「敗着は明確だ。次までに布石を打ち直す。侮らないことだ。"],
    whenWon: ["「盤面通りだ。仕掛けどころも、脚の温存も、すべて計算のうちさ。", "「勝負は脚だけでは決まらない。頭を使った者が勝つ。それだけだ。"],
    vow: ["「あなたは私の計略を崩す厄介な変数だ。……だからこそ、面白い。"],
  },
};
const PLAYER_LINES = {
  winClose: ["「ギリギリだった…お前がいると、いつも力を出し切れる。", "「危なかった。次も、その次も、負けるつもりはない。"],
  win: ["「まだ伸びるさ。次はもっと差をつけてみせる。", "「今日は獲った。だが慢心はしない。"],
  loseClose: ["「あと一歩…。この差は、必ず埋めてみせる。", "「悔しい。でも、この距離ならいつか抜ける。"],
  lose: ["「完敗だ…。だが、この背中は追い続ける。", "「今日は届かなかった。次までに、必ず強くなる。"],
};
// v36修正: 会話ドラマを一往復の紙芝居から「返答を選べる双方向イベント」へ。プレイヤーの返し
// （称える/強気 or 認める/悔しさ）に、ライバルが性格で反応する。返答は心情（メンタル）・人気・
// 因縁度(heat)に効く。
const RIVAL_REPLY = {
  hotblood: { respect: ["…ふん、お前にそう言われると悪い気はしねえ。次も本気で来いよ！"], fire: ["はっ、言うじゃねえか！ その意気だ、次はもっと熱くいこうぜ！"] },
  seeker: { respect: ["その言葉、胸に刻んでおく。互いに高め合おう。"], fire: ["……いい目だ。その闘志こそ、私が求めていたものだ。"] },
  artisan: { respect: ["礼を言うよ。良い勝負は、良い相手あってこそだ。"], fire: ["威勢がいいね。なら私も、もっと腕を磨かせてもらおう。"] },
  free: { respect: ["なんだ、素直だなあ。そういうの、嫌いじゃないよ。"], fire: ["おっと、やる気だねぇ。じゃあ次はもっと本気で遊ぼうか！"] },
  smart: { respect: ["冷静な自己分析だ。感情に流されない君は、厄介な相手になる。"], fire: ["面白い。その強気がどこまで通用するか、次で試させてもらう。"] },
  genius: { respect: ["殊勝じゃないか。少し見直したよ。"], fire: ["いいね、その顔。退屈しのぎには、それくらいでないとね。"] },
  normal: { respect: ["こちらこそ。良い刺激になります、これからも。"], fire: ["その意気ですね。負けていられません、次も全力で。"] },
  maverick: { respect: ["……悪くない。馴れ合いは嫌いだが、お前の走りは嫌いじゃない。"], fire: ["いい目だ。孤高の俺を追ってこられるものなら、追ってみろ。"] },
  showman: { respect: ["おっ、粋なこと言うねぇ。お前、いい相棒になりそうだ！"], fire: ["はっ、その負けん気こそ最高の演出だ！ 次も盛り上げようぜ！"] },
  tactician: { respect: ["冷静だな。感情を制御できる相手ほど、崩しにくい。厄介だよ。"], fire: ["威勢がいい。だが勢いだけでは私の盤面は破れない。試してみるか？"] },
};
const PLAYER_RESPOND = {
  winRespect: { label: "健闘を称える", line: "いいレースだった。お前がいたから、俺も出し切れた。" },
  winFire: { label: "さらに強気に出る", line: "次も、その次も、前を走るのは俺だ。ついてこい。" },
  loseRespect: { label: "潔く負けを認める", line: "完敗だ。今日のお前は強かった。素直に認めるよ。" },
  loseFire: { label: "悔しさをぶつける", line: "…覚えてろ。この借りは、次のレースで必ず返す。" },
};
// v38(改善:会話を厚く): その一戦の状況（接戦/圧勝/完敗/大舞台）を地の文で描写し、会話に文脈を与える。
// 同じ性格の台詞でも「今この瞬間」の物語として立ち上がるようにする。
const RIVAL_SITUATION = {
  close: ["わずかな差だった。ゴール後、荒い息のまま二人の視線が交差する。", "紙一重。決着の余韻が残る中、彼／彼女がゆっくりと口を開いた。", "最後まで並走した末の一瞬の差。互いの脚を、誰より知っている。"],
  blowoutWin: ["圧倒的な走りだった。悔しさを噛み殺しながら、彼／彼女が近づいてくる。", "背中も見せない完勝。それでも相手は、まっすぐこちらを見据えていた。"],
  blowoutLose: ["完敗だった。息を整えるこちらへ、彼／彼女が静かに歩み寄る。", "力の差を見せつけられた。だが、うつむいている場合ではない。"],
  bigWin: ["大舞台を制した高揚の中、宿敵がこちらへ手を伸ばしてきた。", "最高の舞台での勝利。その熱気の中で、二人はまた向き合う。"],
  bigLose: ["大一番で敗れた悔しさ。それでも、この舞台で競えたことに意味がある。", "大舞台の敗北は重い。だが宿敵の存在が、次への焔を灯す。"],
  normal: ["レースを終え、二人はまた言葉を交わす。", "ゴール後のわずかな時間。宿敵との、いつもの掛け合いが始まる。"],
};
export function rivalScene({ rival, beat, gapSec, heatAfter, playerName, seed, record, big }) {
  if (!rival) return null;
  const pers = rival.personality || "normal";
  const V = RIVAL_VOICE[pers] || RIVAL_VOICE.normal;
  const R = RIVAL_REPLY[pers] || RIVAL_REPLY.normal;
  const tier = rivalHeatTier(heatAfter);
  const rng = mulberry(((seed || 1) >>> 0) || 1);
  const pick = a => a[Math.floor(rng() * a.length)] || a[0];
  // 状況（接戦/圧勝/完敗/大舞台）を選んで地の文にする
  const ag = Math.abs(gapSec || 0);
  const sitKey = big ? (beat ? "bigWin" : "bigLose")
    : ag < 3 ? "close"
    : ag > 30 ? (beat ? "blowoutWin" : "blowoutLose")
    : "normal";
  const situation = pick(RIVAL_SITUATION[sitKey] || RIVAL_SITUATION.normal);
  // 通算対戦成績を一言で（因縁の積み重ねを可視化）
  const w = record?.wins || 0, l = record?.losses || 0, m = record?.meetings || 0;
  const recordLine = m >= 2 ? `通算 ${w}勝${l}敗——${w > l ? "今はあなたが上だ" : w < l ? "まだ分が悪い" : "五分の戦いが続く"}` : null;
  const opening = { name: rival.name, text: pick(beat ? V.whenBeaten : V.whenWon).replace(/」?$/, "」") };
  const mkResp = (r, tone) => ({
    label: r.label, playerLine: r.line.replace(/」?$/, "」"),
    reply: { name: rival.name, text: pick(tone === "respect" ? R.respect : R.fire).replace(/」?$/, "」") },
    tone,
    effects: beat
      ? (tone === "respect" ? { mentalDelta: 2, heatDelta: 1 } : { popularityDelta: 3, heatDelta: 2 })
      : (tone === "respect" ? { mentalDelta: 2, heatDelta: 1 } : { mentalDelta: 3, heatDelta: 2 }),
  });
  const responses = beat
    ? [mkResp(PLAYER_RESPOND.winRespect, "respect"), mkResp(PLAYER_RESPOND.winFire, "fire")]
    : [mkResp(PLAYER_RESPOND.loseRespect, "respect"), mkResp(PLAYER_RESPOND.loseFire, "fire")];
  return { persLabel: PERSONALITIES[pers]?.label || "", tierLabel: tier.label, tierColor: tier.color, situation, recordLine, opening, responses };
}
export function rivalDialogue({ rival, beat, gapSec, heatAfter, playerName, seed }) {
  if (!rival) return null;
  const pers = rival.personality || "normal";
  const close = Math.abs(gapSec == null ? 99 : gapSec) < 4;
  const tier = rivalHeatTier(heatAfter);
  const rng = mulberry(((seed || 1) >>> 0) || 1);
  const pick = arr => arr[Math.floor(rng() * arr.length)] || arr[0];
  const V = RIVAL_VOICE[pers] || RIVAL_VOICE.normal;
  const rivalLine = pick(beat ? V.whenBeaten : V.whenWon);
  const meLine = beat ? pick(close ? PLAYER_LINES.winClose : PLAYER_LINES.win)
    : pick(close ? PLAYER_LINES.loseClose : PLAYER_LINES.lose);
  const lines = [
    { who: "rival", name: rival.name, text: rivalLine.replace(/」?$/, "」") },
    { who: "me", name: playerName || "自分", text: meLine.replace(/」?$/, "」") },
  ];
  if (tier.key >= 2) lines.push({ who: "rival", name: rival.name, text: pick(V.vow).replace(/」?$/, "」") });
  return { lines, tierLabel: tier.label, tierColor: tier.color, persLabel: PERSONALITIES[pers]?.label || "" };
}





// v45: ユーザー指摘「イベントで起きた能力変化などは必ず明示したほうがいい」への対応。
// ML_CROSSROADSの各choice.applyは能力値を直接書き換えるが、resultは物語文のみで数値を
// 一切示していなかった（例：怪我イベントで能力-1〜-5されても本文に数値が出ない）。
// before/afterのAB_KEYSを機械的に比較して差分だけ拾うので、choice側の記述漏れが起きない。
export function abilityDeltaSummary(player, prevPlayer) {
  if (!player || !prevPlayer) return "";
  const parts = [];
  AB_KEYS.forEach(k => {
    const d = Math.round((player[k] || 0) - (prevPlayer[k] || 0));
    if (d !== 0) parts.push(`${AB_LABEL[k]}${d > 0 ? "+" : ""}${d}`);
  });
  return parts.length ? `（${parts.join("・")}）` : "";
}

export const ML_CROSSROADS = {
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

export function mlRollCrossroads(s, player) {
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

// v45: ユーザー指摘「イベントで起きた能力変化などは必ず明示したほうがいい」への対応。
// 各選択はresult（フレーバー文）だけで実際の増減値（全能力+2〜4・疲労±）を一切示して
// いなかった。mlResolveOffseason側でbefore/after差分を機械的に計算して必ず併記する
// （addAb()は成長キャップで頭打ちすることがあるため、ここに静的な数値は持たせない）。
export const ML_OFFSEASON_CHOICES = [
  { key: "domestic", label: "国内で自主トレーニングに励む", desc: "堅実に基礎を積む。伸びは控えめだが安全",
    result: "オフシーズンは国内で黙々と走り込み、着実に地力を蓄えた。",
    apply: (player, year, ml) => { const p = { ...player }; AB_KEYS.forEach(k => addAb(p, k, 2, mlGrowthCap(year, p, ml))); return p; } },
  { key: "overseas", label: "海外武者修行に出る", desc: "レベルの高い環境に飛び込む。伸びは大きいが疲労が残る",
    result: "海外の強豪選手たちに揉まれ、大きく成長する手応えを掴んだ。ただし疲労が抜けきらないまま新シーズンを迎えることになった。",
    apply: (player, year, ml) => { const p = { ...player }; AB_KEYS.forEach(k => addAb(p, k, 4, mlGrowthCap(year, p, ml))); p.fatigue = Math.min(100, p.fatigue + 20); return p; } },
  { key: "rest", label: "心身をしっかり休める", desc: "疲労を大きくリセットして万全の状態で新シーズンへ",
    result: "オフシーズンをゆっくり過ごし、心身ともにリフレッシュして新シーズンを迎える。",
    apply: (player) => ({ ...player, fatigue: Math.max(0, player.fatigue - 40) }) },
];

export const SEASON_ACHIEVEMENTS = [
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
  // Wave H-2: 内装グレードは能力値に影響しない見た目のみの購入軸のため、実績報酬で
  // 購入動機を補う（判断⑤a+c：効果は付けず、実績連動のみ）。
  { id: "room_full_grade", icon: "🏡", label: "拠点フル改装", desc: "4つの持ち場すべての内装を最高グレードにする", reward: { money: 80, cp: 1 },
    check: (g) => ROOM_UPGRADE_KEYS.every(k => (((g.roomLv || {})[k]) || 0) >= ROOM_GRADE_MAX) },
];

// v41(§Step5): SEASON_ACHIEVEMENTSのchemistry_max判定がteamChemistryTier（本ファイル内）を呼ぶため、
// domain/season/standings.js（data/*のみに依存する層）へは移送せずここに残す（循環import回避）。
export function computeSeasonAchievements(g) {
  return SEASON_ACHIEVEMENTS.map(a => ({ ...a, achieved: a.check(g) }));
}

export function formatAchievementReward(a) {
  if (!a.reward) return "";
  const parts = [];
  if (a.reward.money) parts.push(`+${a.reward.money}万円`);
  if (a.reward.cp) parts.push(`CP+${a.reward.cp}`);
  return parts.length ? `報酬：${parts.join("／")}` : "";
}


export function mlGenDirective(year, month, classIdx, managerEval) {
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

export function managerEvalTier(v) {
  if (v >= 80) return { label: "絶大な信頼", color: C.yellow };
  if (v >= 60) return { label: "高い評価", color: C.green };
  if (v >= 40) return { label: "順調な評価", color: C.blue };
  if (v >= 20) return { label: "様子見", color: C.sub };
  return { label: "信頼不足", color: C.red };
}






// v43(マイライフ難易度調整Phase 1・柱1): 経過年数だけで誰でも同じペースでカンストしていた
// （難易度を問わず年9〜10でキャップに到達、実測はDEVLOG該当ウェーブ参照）ことへの対処。
// 時間経過による底上げは+10年分（+20）で頭打ちにし、それ以降の伸びしろは「実績」（大望の道の
// 踏破・大舞台タイトル・通算勝利）でしか広がらないようにする。難易度が上がるほど実績1つあたりの
// 価値を下げる（鬼は0.5倍）ことで、"難易度=キャップの伸ばしにくさ"という手応えを作る。
const ML_GROWTHCAP_DIFF_MUL = { easy: 1.3, normal: 1.0, hard: 0.75, oni: 0.5 };

// 実績ボーナス：現在選んでいる大望の道でクリア済みのはしご数(0-5)×3、大舞台タイトル×4、
// 通算勝利5勝ごとに+1（この項だけで+10まで）。mlはml状態そのもの（year/careerWins/careerTitles/
// ambitionPath/player.raceLog等）を想定。無ければ0を返す（呼び出し側でmlが渡せない箇所への配慮）。
export function mlAchievementBonus(ml) {
  if (!ml) return 0;
  const rungs = mlFirstUnmetRung(ml, ml.ambitionPath || "victory");
  const majors = ml.careerTitles || 0;
  const winsBonus = Math.min(10, Math.floor((ml.careerWins || 0) / 5));
  return rungs * 3 + majors * 4 + winsBonus;
}

export function mlGrowthCap(year, player, ml) {
  // v33: 配合の才能キャップ（talentCap）は選手固有の限界突破分。生まれ持った素質で天井が上がる
  const talent = (player && player.talentCap) ? player.talentCap : 0;
  // v43: 経過年数の効果は+10年分で頭打ち（従来は無制限に伸び続けていた）
  const timeComponent = Math.min(10, Math.floor(Math.max(0, (year || 1) - 1))) * 2;
  const achievementBonus = mlAchievementBonus(ml);
  const diffMul = ML_GROWTHCAP_DIFF_MUL[(ml && ml.difficulty) || "normal"] ?? 1.0;
  return Math.min(140, 90 + timeComponent + achievementBonus * diffMul + talent);
}

// v43(マイライフ難易度調整Phase 2・イベント受動発火): item.weight（既定1）に応じた加重抽選。
// レア度の高いイベント（覚醒級等）に小さいweightを与えると滅多に出ないようにできる。
export function weightedPick(items) {
  const total = items.reduce((sum, it) => sum + (it.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const it of items) {
    const w = it.weight ?? 1;
    if (roll < w) return it;
    roll -= w;
  }
  return items[items.length - 1];
}

// v43(マイライフ難易度調整Phase 2): 私生活イベントの抽選。新ステータス「運」が高いほど
// 「悪いイベント」（`bad:true`タグ）を引きにくくなる（0.4〜1.6倍でクランプ・luck=50で等倍、
// 突破力/安定感と同じ揺らぎ式）。性格別イベントは悪イベントを持たないため、「悪いイベントを
// 引く」判定に外れた回だけ半々で差し込む（旧mlTriggerEventと同じ配分を踏襲）。
export function pickMlEvent(player) {
  const luck = player?.luck ?? 50;
  const badMul = Math.max(0.4, Math.min(1.6, 1 - (luck - 50) / 100));
  const wantBad = Math.random() < 0.30 * badMul;
  const persPool = ML_PERSONALITY_EVENTS[player?.personality];
  if (!wantBad && persPool && persPool.length && Math.random() < 0.5) return weightedPick(persPool);
  const pool = ML_EVENTS.filter(e => !!e.bad === wantBad);
  return weightedPick(pool.length ? pool : ML_EVENTS);
}

// v43(マイライフ難易度調整Phase 1・成長力マスク化): 成長力(growthPow)はリセマラ・引き直しでの
// 「Sが出るまで粘る」を防ぐため、デビュー直後（3年目未満）は選手本人にも非公開にする。
// 3年目（year>=3）になった時点で判明する。判断⑫（ユーザー承認済み）。
export function mlGrowthPowRevealed(ml) {
  return ((ml && ml.year) || 1) >= 3;
}

export function mlLivingCost(s) {
  const salaryTax = Math.round((s.salary || 0) / 12 * 0.5);
  const carUpkeep = Math.max(0, (s.carLv ?? -1) + 1) * 4;
  const houseUpkeep = Math.max(0, (s.houseLv ?? -1) + 1) * 4;
  return salaryTax + carUpkeep + houseUpkeep;
}

export function mlPrivateCampCost(s) {
  return 120 + Math.max(0, (s.year || 1) - 1) * 40 + (s.classIdx || 0) * 60;
}






export function disciplineScore(r, key) { return Math.round(DISCIPLINES[key].calc(r)); }




export function buildDesc(build) { return build >= 66 ? "パワー型" : build >= 45 ? "標準" : "軽量型"; }

export function pickMandateMonths(n, seed) {
  const rng = mulberry(seed);
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out.sort((a, b) => a - b);
}





// シーズン順位に応じてチャンピオンシップの昇格ボーダー（必要着順）を緩和する。
// 1位＝本番5位以内で昇格／2位＝4位以内／3位以下＝従来通り3位以内。年間を通した強さを本番に還元。

export function bumpCareerStats(cs, rank, prize) {
  return {
    totalRaces: cs.totalRaces + 1,
    totalWins: cs.totalWins + (rank === 1 ? 1 : 0),
    totalPodiums: cs.totalPodiums + (rank <= 3 ? 1 : 0),
    totalPrize: cs.totalPrize + prize,
    bestFinish: cs.bestFinish === null ? rank : Math.min(cs.bestFinish, rank),
  };
}


export function teamChemistryTier(squad) {
  const avg = (!squad || squad.length === 0) ? 0 : squad.reduce((s, r) => s + (r.tenure || 0), 0) / squad.length;
  const tier = CHEMISTRY_TIERS.find(t => avg >= t.min);
  return { ...tier, avgTenure: avg };
}

export function buildSim(raceMeta, squad, aceId, roles, equip, itemBoost, classIdx, fixedAiTeams, dayTag, directive, difficultyId, rivalAlumni, dynastyLevel, teamName, rivalRosters, year) {
  // v13: 難易度による他チームの強さ補正（aiMul）。省略時はnormal相当
  const diffDef = DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1];
  const diffAiMul = diffDef.aiMul;
  const aiCap = diffDef.abilCap ?? 94; // v35(バランス): 難易度別のAI能力上限（hard/oniは94超）
  // v25: グランファイナル制覇後の周回（ディナスティ）モード。周を重ねるたびに他チームの
  // 地力を底上げし、周回プレイでも歯応えが保たれるようにする
  const dynastyBonus = Math.min(20, (dynastyLevel || 0) * 5);
  const course = generateCourse(raceMeta, dayTag);
  const groupMode = groupModeFor(squad.length);
  const riders = [];
  const chemTier = teamChemistryTier(squad);
  squad.forEach(r => {
    const e = effAbilities(r, equip, itemBoost, raceMeta.grade, raceMeta.weather, raceMeta.monument);
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
      // v38: 永続ライバルロースターから同じ顔ぶれを出走させる（identity固定・stats は id＋year で
      // シードして年内安定・power で文脈スケール）。従来は毎レース使い捨て生成で「同じチーム名でも
      // 毎回別人」だったため、宿敵が育つ感覚も相手の通算成績も追えなかった。マイライフと同じ根治。
      const roster = rivalRosters && rivalRosters[d.name];
      if (roster && roster.length) {
        roster.slice(0, Math.min(aiSquadN, roster.length)).forEach(wr => {
          if (members.length >= aiSquadN) return;
          if (alumniIds.has(wr.id)) return; // 既にalumniで出走している選手は重複させない
          const wrng = mulberry(((wr.id * 2654435761) ^ ((year || 1) * 40503)) >>> 0);
          const st = newRider(power + (wr.baseline || 0), wrng, { type: wr.type, cap: aiCap, banned: nameBanned });
          st.id = wr.id; st.name = wr.name; st.type = wr.type; st.personality = wr.personality || st.personality;
          if (wr.abilities) st.abilities = wr.abilities;
          st.goldAbilities = wr.goldAbilities || [];
          st.growthPow = wr.growthPow || st.growthPow;
          members.push(st);
        });
      }
      // v35(シーズン深掘り): ロースターで埋まらない残り枠はチームの個性（spec）に沿って補完。
      // エースは必ずその脚質、他メンバーも過半数がその脚質に寄る＝対戦の駆け引きが生まれる
      for (let i = members.length; i < aiSquadN; i++) {
        const useSpec = d.spec && (i === 0 || rng() < 0.55);
        members.push(newRider(power + (i === 0 ? 6 : 0), rng, { banned: nameBanned, cap: aiCap, type: useSpec ? d.spec : undefined }));
      }
      const aiRoles = assignAIRoles(members, aiSquadN);
      // v12: チームごとに隠しの戦略スタイルを割り当て、レース展開にばらつきを持たせる
      const aiStyle = AI_STYLES[Math.floor(rng() * AI_STYLES.length)];
      return members.map((r, i) => {
        // v29: AI相手もプレイヤーと同じeffAbilitiesを通し、体格(パワーウェイト)・調子・大舞台適性・
        // 加速力・メンタルなどの副次補正が相手選手にも効くようにする（天候補正もこの中で処理）
        const e = effAbilities(r, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
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
  // v35(チームTT): チームタイムトライアルは集団シミュレーションではなく、チーム単位の合算タイム。
  // ペロトンのsimulateTicksは走らせず、TT地力・人数・ケミストリーからチーム時間を算出する。
  if (raceMeta.tmpl && raceMeta.tmpl.teamTT) {
    computeTeamTT(sim, chemTier.mul);
    sim.hadBreak = false;
    return { sim, aiTeams: aiTeamsUsed };
  }
  // v12: 無線指示の廃止に伴い、作戦（chaseMode/aceEarly）は出走前に決定済みのものをそのまま渡す
  // v39(A案): レース中の判断カードでfromTickから再計算するため、作戦（directive）をsimに保持する
  sim.directive = directive || { chaseMode: "normal", aceEarly: false };
  sim.difficulty = difficultyId; // v39.18: 難易度で判断カードの一手の効きを変える
  simulateTicks(course, riders, 0, sim.directive, groupMode === "solo");
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

// v43(マイライフ難易度調整Phase 1・柱0): GROWTH[r.growth].gainMulを乗算し、成長タイプごとの
// 伸び速度に差をつける（詳細はdata/abilities.jsのGROWTH定義コメント参照）。season/mylife
// 両方がこの関数を共有するため、係数は両モードへ自動的に効く。
export function growthPhase(r) {
  const def = GROWTH[r.growth];
  const [ps, pe] = def.peak;
  const mul = def.gainMul ?? 1.0;
  if (r.age < ps) return { gain: 1.0 * mul, dec: 0, tag: "成長期" };
  if (r.age <= pe) return { gain: 0.5 * mul, dec: 0, tag: "全盛期" };
  return { gain: 0.1 * mul, dec: Math.min(1.2, 0.25 * (r.age - pe)), tag: "衰え期" };
}

// v43(マイライフ難易度調整Phase 1・成長力マスク化): revealPow=falseの間はpowScoreを除外する
// （マイライフの成長力非公開期間中、この「伸びしろ」ヒントから逆算されないようにするため）。
// v46(素質ランク圧縮修正): powScoreを単純にゼロ化すると、公開時基準のしきい値(5/3)のままでは
// 「伸びしろ大」が非公開中は理論上到達不能になり常に中/小しか出ない（デビュー時の年齢×成長型
// 8万通りを実測：最大でも視認可能スコアは3どまり）。非公開時専用のしきい値を用意し、
// 視認可能スコアの取りうる値(1〜3がほぼ均等)全体に大/中/小を割り当てるよう較正した
// （scratchpad/potentialhint_calib.mjs）。
export function potentialHint(r, revealPow = true) {
  const phase = growthPhase(r).tag;
  const powScore = revealPow ? ({ S: 3, A: 2, B: 1, C: 0 }[r.growthPow] ?? 1) : 0;
  let score = powScore;
  if (phase === "成長期") score += 2;
  else if (phase === "全盛期") score += 1;
  const [ps] = GROWTH[r.growth].peak;
  if (r.age < ps - 3) score += 1;
  const T = revealPow ? { big: 5, mid: 3 } : { big: 3, mid: 2 };
  if (score >= T.big) return { label: "伸びしろ大", color: "#ffd23f" };
  if (score >= T.mid) return { label: "伸びしろ中", color: "#35c07e" };
  return { label: "伸びしろ小", color: "#9aa3b5" };
}


export function hasSaveGame() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function clearSaveGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ }
}

export function worldPointsForFinish(rank, grade) {
  const gradePts = { 1: 16, 2: 34, 3: 66, 4: 130 }[grade] || 16;
  const place = rank === 1 ? 1 : rank === 2 ? 0.7 : rank === 3 ? 0.55
    : rank <= 5 ? 0.4 : rank <= 10 ? 0.25 : rank <= 20 ? 0.12 : 0.05;
  return Math.round(gradePts * place);
}


// v35(D 物語): メディアナラティブ。選手の実際のキャリア状態（直近成績・連勝/連続表彰台・
// 世界ランク・因縁・人気・年齢）から最も「記事になる」角度を選び、見出し＋短い記事を生成する。
// 純関数（ml から読むだけ）。tone で色分け（good/bad/neutral）。seed で月ごとに文面を少し変える。
// v37: 選手成績台帳。毎レース後、永続キャラ（ライバル／自チームメイト）の着順を集計する純関数。
// 出走ごとに通算＆年度別（勝利/表彰台/トップ10/ベスト着順）を積む。使い捨てのモブは対象外。
export function mlUpdateRiderStats(prev, rankedEntrants, teammateIds, year) {
  const next = { ...(prev || {}) };
  (rankedEntrants || []).forEach(e => {
    if (e.isPlayerChar) return; // 自分は raceLog で別管理
    if (!Number.isFinite(e.rank)) return;
    const isRival = !!(e.isRival || e.isRival2);
    const isMate = teammateIds && teammateIds.has(e.id);
    // v37: 永続ワールドロースター化に伴い、AI相手（world）も含めて全出走選手を追跡する。
    // v38(#3): 弟子（isProtege）は専用の kind で区別（成績画面で「弟子」として表示）。
    const kind = e.isProtege ? "protege" : isRival ? "rival" : isMate ? "teammate" : "world";
    const cur = next[e.id]
      ? { ...next[e.id], byYear: { ...next[e.id].byYear } }
      : { id: e.id, name: e.name, team: e.teamName || e.team, kind, races: 0, wins: 0, podiums: 0, top10: 0, bestRank: 99, byYear: {} };
    // 既存記録のkindがrival/teammateなら維持（worldに降格させない）
    if (cur.kind === "world" && kind !== "world") cur.kind = kind;
    const r = e.rank;
    cur.name = e.name; cur.team = e.teamName || e.team || cur.team;
    cur.races += 1;
    if (r === 1) cur.wins += 1;
    if (r <= 3) cur.podiums += 1;
    if (r <= 10) cur.top10 += 1;
    cur.bestRank = Math.min(cur.bestRank, r);
    const y = cur.byYear[year] ? { ...cur.byYear[year] } : { races: 0, wins: 0, podiums: 0 };
    y.races += 1; if (r === 1) y.wins += 1; if (r <= 3) y.podiums += 1;
    cur.byYear[year] = y;
    next[e.id] = cur;
  });
  return next;
}

// v37: 自分が出走しなかった月のレース結果を軽量に決着させる（ワールドの選手だけで順位付け）。
// 地形適性（コース得意脚質との一致）＋強さ階級baseline＋ノイズでスコアリングし、pseudo-entrants を返す。
// これを mlUpdateRiderStats に渡すことで、自分が出ていないレースの成績も台帳に積める。
export function mlWorldRaceLite(ml, seed) {
  const rosters = ml.worldRosters || {};
  const race = (ml.races && ml.races[0]) || {};
  const favors = race.tmpl ? race.tmpl.favors : null;
  const rng = mulberry(((seed || 1) >>> 0) || 1);
  const entrants = [];
  Object.entries(rosters).forEach(([teamName, riders]) => {
    // v38(#4): 自チームは worldRosters ではなく teammates が実体（レースに出るのはそちら）。
    // ここで自チームのロースターに成績を積むと、名鑑に「出走したことのない幽霊選手」の成績が
    // 表示されてしまうため除外する（チームメイトは自分の出走レースで台帳に積まれる）
    if (teamName === ml.team) return;
    (riders || []).forEach(wr => {
      const typeMatch = (favors && wr.type === favors) ? 8 : 0;
      entrants.push({ id: wr.id, name: wr.name, teamName, score: (wr.baseline || 0) + typeMatch + (rng() - 0.5) * 14 });
    });
  });
  [ml.rival, ml.rival2].forEach((rv, idx) => {
    if (!rv) return;
    const typeMatch = (favors && rv.type === favors) ? 8 : 0;
    entrants.push({ id: rv.id, name: rv.name, teamName: rv.team, isRival: idx === 0, isRival2: idx === 1, score: 6 + typeMatch + (rng() - 0.5) * 14 });
  });
  entrants.sort((a, b) => b.score - a.score);
  entrants.forEach((e, i) => { e.rank = i + 1; });
  return entrants;
}

// 台帳を「自分・ライバル・チームメイト」の表示用リストへ整形（純関数）。
export function mlRiderStatsRows(ml) {
  const stats = ml.riderStats || {};
  const year = ml.year || 1;
  const rows = [];
  // 自分（raceLogから集計）
  const p = ml.player;
  if (p) {
    const log = p.raceLog || [];
    const agg = { races: log.length, wins: 0, podiums: 0, top10: 0, bestRank: 99, yr: { races: 0, wins: 0, podiums: 0 } };
    log.forEach(e => {
      if (e.rank === 1) agg.wins++; if (e.rank <= 3) agg.podiums++; if (e.rank <= 10) agg.top10++;
      agg.bestRank = Math.min(agg.bestRank, e.rank);
      if (e.year === year) { agg.yr.races++; if (e.rank === 1) agg.yr.wins++; if (e.rank <= 3) agg.yr.podiums++; }
    });
    rows.push({ id: p.id, name: p.name, team: ml.team, kind: "self", ...agg, byYear: { [year]: agg.yr } });
  }
  // 近しい面々（自分・ライバル・仲間・弟子）だけをこの画面に。ワールド全体は mlWorldTeamStats で。
  Object.values(stats).filter(s => s.kind !== "world").forEach(s => {
    const yr = s.byYear && s.byYear[year] ? s.byYear[year] : { races: 0, wins: 0, podiums: 0 };
    rows.push({ ...s, yr });
  });
  const kindOrder = { self: 0, rival: 1, protege: 2, teammate: 3 };
  rows.sort((a, b) => (kindOrder[a.kind] - kindOrder[b.kind]) || (b.wins - a.wins) || (a.bestRank - b.bestRank));
  return rows;
}

// v37: 全チームの選手名鑑＋成績（チームごとにグルーピング）。永続ワールドロースターの全選手を、
// 蓄積した成績（riderStats）と突き合わせて返す。未出走の選手も0成績で表示する。
export function mlWorldTeamStats(ml) {
  const stats = ml.riderStats || {};
  const rosters = ml.worldRosters || {};
  const year = ml.year || 1;
  const teams = [];
  const statRow = (id, name, type, extra = {}) => {
    const s = stats[id];
    const yr = s && s.byYear && s.byYear[year] ? s.byYear[year] : { races: 0, wins: 0, podiums: 0 };
    return { id, name, type,
      races: s ? s.races : 0, wins: s ? s.wins : 0, podiums: s ? s.podiums : 0,
      bestRank: s ? s.bestRank : 99, yr, ...extra };
  };
  Object.entries(rosters).forEach(([teamName, riders]) => {
    const teamInfo = MYLIFE_TEAMS.find(t => t.name === teamName);
    let rows;
    if (teamName === ml.team) {
      // v38(#4): 自チームは worldRosters の未使用選手団ではなく、実際にレースへ出ている
      // 「自分＋固定チームメイト」を表示する（選手成績画面と同じ顔ぶれに統一）。
      // 自分は raceLog から集計（riderStats は自分を対象外にしているため）。
      rows = [];
      const p = ml.player;
      if (p) {
        const log = p.raceLog || [];
        const agg = { races: log.length, wins: 0, podiums: 0, bestRank: 99, yr: { races: 0, wins: 0, podiums: 0 } };
        log.forEach(e => {
          if (e.rank === 1) agg.wins++; if (e.rank <= 3) agg.podiums++;
          agg.bestRank = Math.min(agg.bestRank, e.rank);
          if (e.year === year) { agg.yr.races++; if (e.rank === 1) agg.yr.wins++; if (e.rank <= 3) agg.yr.podiums++; }
        });
        rows.push({ id: p.id, name: p.name, type: p.type, ...agg, self: true });
      }
      (ml.teammates || []).forEach(tm => rows.push(statRow(tm.id, tm.name, tm.type)));
      // 自分を先頭に固定し、チームメイトは成績順
      rows = [rows[0], ...rows.slice(1).sort((a, b) => (b.wins - a.wins) || (b.podiums - a.podiums) || (a.bestRank - b.bestRank))].filter(Boolean);
      const teamWins = rows.reduce((a, r) => a + r.wins, 0);
      const teamPodiums = rows.reduce((a, r) => a + r.podiums, 0);
      teams.push({ teamName, color: teamInfo ? teamInfo.color : "#9aa3b5", trait: teamInfo ? teamInfo.trait : "", riders: rows, teamWins, teamPodiums, isMyTeam: true });
      return;
    }
    rows = (riders || []).map(wr => statRow(wr.id, wr.name, wr.type));
    rows.sort((a, b) => (b.wins - a.wins) || (b.podiums - a.podiums) || (a.bestRank - b.bestRank));
    const teamWins = rows.reduce((a, r) => a + r.wins, 0);
    const teamPodiums = rows.reduce((a, r) => a + r.podiums, 0);
    teams.push({ teamName, color: teamInfo ? teamInfo.color : "#9aa3b5", trait: teamInfo ? teamInfo.trait : "", riders: rows, teamWins, teamPodiums });
  });
  teams.sort((a, b) => (b.teamWins - a.teamWins) || (b.teamPodiums - a.teamPodiums));
  return teams;
}

export function mlMediaHeadline(ml) {
  if (!ml || !ml.player) return null;
  const p = ml.player;
  const log = p.raceLog || [];
  const nm = p.name || "選手";
  const year = ml.year || 1, month = ml.month || 0;
  const rng = mulberry((year * 12 + month) * 101 + strHash(nm));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  // 直近の流れ
  const recent = log.slice(-4);
  let winStreak = 0, podiumStreak = 0;
  for (let i = log.length - 1; i >= 0; i--) { if (log[i].rank === 1) winStreak++; else break; }
  for (let i = log.length - 1; i >= 0; i--) { if (log[i].rank <= 3) podiumStreak++; else break; }
  const last = log[log.length - 1];
  const recentPoor = recent.length >= 3 && recent.every(r => r.rank > 10);
  const careerWins = log.filter(r => r.rank === 1).length;
  const wr = ml.worldRank, wrPrev = ml.worldRankPrev;
  const heat = ml.rivalRecord?.heat ?? ml.rivalRecord?.meetings ?? 0;
  const heatTier = rivalHeatTier(heat);
  const age = p.age || 24;
  const pop = p.popularity || 0;
  const H = (headline, body, tone) => ({ headline, body, tone });

  // 記事になる角度を優先度順に選ぶ（最初に該当したもの）
  if (log.length === 0) return H("期待の新人、デビュー間近", `${nm}が${["静かな闘志を胸に","大器の予感を漂わせ","無名ながら","チーム期待の星として"][Math.floor(rng()*4)]}プロの世界へ足を踏み入れる。その走りに注目が集まる。`, "neutral");
  if (winStreak >= 3) return H(`${nm} 破竹の${winStreak}連勝`, pick([`止まらない。${nm}が${winStreak}連勝を飾り、ペロトンにその名を刻みつつある。`, `敵なしの快進撃。${nm}の独走態勢に他チームは対抗策を見いだせずにいる。`]), "good");
  if (wr === 1) return H(`${nm}、ついに世界の頂点へ`, `世界ランキング首位。${nm}は名実ともに世界王者となった。この景色を、彼／彼女は長く夢見てきた。`, "good");
  if (wr != null && wrPrev != null && wr <= 10 && wrPrev > 10) return H(`${nm} 世界トップ10入り`, `世界ランキング${wrPrev}位から${wr}位へ躍進。${nm}がついに世界の一線級に名を連ねた。`, "good");
  if (winStreak >= 1 && last) return H(`${nm}が${last.name}を制す`, pick([`${nm}が勝利を掴んだ。会心の走りにスタンドは沸いた。`, `勝ったのは${nm}。着実に勝ち星を重ね、視線を上へと向ける。`]), "good");
  if (heatTier.key >= 2 && ml.rival) return H(`因縁の${heatTier.label}・${ml.rival.name}戦、白熱`, `${nm}と${ml.rival.name}の${heatTier.label}対決から目が離せない。通算${ml.rivalRecord?.wins||0}勝${ml.rivalRecord?.losses||0}敗、この物語の結末を誰もが見届けたがっている。`, "neutral");
  if (podiumStreak >= 3) return H(`${nm} 安定の表彰台ラッシュ`, `${podiumStreak}戦連続表彰台。${nm}の充実ぶりは本物だ。あとは頂点に立つ一勝を待つばかり。`, "good");
  if (pop >= 60 && age <= 25) return H(`若きスター ${nm} に熱視線`, `${age}歳、人気沸騰。${nm}はいまや競技の枠を超えた注目株となっている。`, "good");
  if (recentPoor) return H(`${nm}、正念場の時`, pick([`ここ数戦は精彩を欠く${nm}。しかし本物の選手は逆境でこそ真価を問われる。`, `もがく${nm}。復調のきっかけを、本人もファンも待ち望んでいる。`]), "bad");
  if (age >= 33) return H(`ベテラン ${nm}、なお現役`, `${age}歳。積み重ねた通算${careerWins}勝が語るのは、衰えぬ闘志。${nm}の走りは若手の目標であり続ける。`, "neutral");
  if (careerWins >= 1) return H(`${nm}、通算${careerWins}勝目へ視線`, `一歩ずつ、確かに。${nm}のキャリアは着実に厚みを増している。`, "neutral");
  return H(`${nm}、雌伏の時`, `まだ大きな結果は出ていないが、${nm}の努力を見る者は見ている。飛躍の時は近い。`, "neutral");
}

// v35(UI): キャリアの軌跡。raceLog から「語る価値のある一戦」だけを時系列で抽出し、
// 選手詳細（キャリアグラフ画面）に年表として並べる。勝利・モニュメント・格上レースの表彰台・
// 初勝利/初表彰台を拾う。純関数。
export function mlCareerTimeline(ml) {
  if (!ml || !ml.player) return [];
  const log = ml.player.raceLog || [];
  const out = [];
  let firstWinDone = false, firstPodiumDone = false;
  const isBig = (e) => /世界選手権|オリンピック|グランツール|ツアー|世界選手/.test(e.name || "");
  log.forEach((e, i) => {
    const rank = e.rank;
    const when = { year: e.year, month: e.month };
    if (rank === 1) {
      const first = !firstWinDone; firstWinDone = true;
      if (e.monument) out.push({ ...when, icon: "🏛", color: "#ffd24a", text: `${e.name}を制覇（クラシックの勝者）` });
      else if (isBig(e)) out.push({ ...when, icon: "🌍", color: "#ffd23f", text: `${e.name}で優勝！世界の頂点に立った` });
      else out.push({ ...when, icon: first ? "✨" : "🏆", color: "#ffd23f", text: first ? `プロ初勝利（${e.name}）` : `${e.name}で優勝` });
    } else if (rank <= 3) {
      if (e.monument) out.push({ ...when, icon: "🏛", color: "#e8a13c", text: `${e.name}で${rank}位（クラシック表彰台）` });
      else if (isBig(e)) out.push({ ...when, icon: "🥈", color: "#cfd6e4", text: `${e.name}で${rank}位（大舞台の表彰台）` });
      else if (!firstPodiumDone) { firstPodiumDone = true; out.push({ ...when, icon: "🎖", color: "#4fbf6b", text: `キャリア初表彰台（${e.name}で${rank}位）` }); }
    }
  });
  // 直近が上に来るよう新しい順。多すぎる場合は上位（最近）30件に留める
  return out.reverse().slice(0, 30);
}

// v36(#7): 新聞・雑誌イベント。大きな勝利・連勝を「号外」の紙面として演出する純関数。
// 直近の一戦が号外に値するか判定し、値するなら見出し・記事を返す（値しなければnull）。

// v35(逆メンター): 弟子（プロテジェ）の現在の状態を、弟子入りからの経過年数から算出する純関数。
// 成長力(growthPow)と、弟子を取った時の師（プレイヤー）の地力(mentorOvr)＝指導の質で伸びが決まる。
// インクリメンタルな状態更新を持たず「年が進めば自然に育つ」形（保存・分岐に依存しない）。
export function protegeState(protege, year) {
  if (!protege) return null;
  const yrs = Math.max(0, (year || protege.joinYear) - protege.joinYear);
  const powBase = { S: 5.6, A: 4.3, B: 3.1, C: 2.2 }[protege.growthPow] || 3.1;
  const guide = 0.7 + Math.max(0, ((protege.mentorOvr || 70) - 60)) / 120; // 師の地力で 0.7〜約1.0
  // v36(弟子深化): 指導イベントで積んだ「絆(bond 0〜100)」と「鍛錬(guideBonus)」が伸びに効く。
  // 絆＝寄り添って信頼を築くと最大+20%、鍛錬＝厳しく鍛えると最大+40%（数字が勝手に上がるだけの
  // 存在から、関わり方で伸びが変わる存在へ）。ovrBonus＝その場の後押しで即時に乗る加点。
  const bondMul = 1 + Math.min(100, protege.bond || 0) / 500;
  const trainMul = 1 + Math.min(0.4, protege.guideBonus || 0);
  const perYear = powBase * guide * bondMul * trainMul;
  const ovr = Math.min(96, Math.round((protege.ovr0 || 50) + yrs * perYear + (protege.ovrBonus || 0)));
  const age = (protege.age0 || 18) + yrs;
  // 直近の節目（70/80/90）到達の可視化用
  const nextMilestone = [70, 80, 90].find(t => ovr < t) || null;
  const bond = Math.min(100, protege.bond || 0);
  return { ovr, age, yrs, perYear: Number(perYear.toFixed(1)), nextMilestone, bond,
    trainMul: Number(trainMul.toFixed(2)), bondMul: Number(bondMul.toFixed(2)) };
}

// v36(#5リセマラ): デビュー時の「素質ランク」を算出する純関数。成長力・性格・特殊能力（金特/良特/悪特）・
// 爆発力（配合の伸びしろ）を総合し SS〜D で格付け。リセマラで狙う目標をひと目で示す。
// v43(マイライフ難易度調整Phase 1・成長力マスク化): 成長力(growthPow)自体は3年目まで非公開にするが、
// この素質ランクは成長力に最も重く（他の項目の2倍以上）依存しているため、成長力を隠したまま
// 素質ランクだけ見せると「Sランクが出るまで粘る」というリセマラの実質が温存されてしまう。
// revealPow=falseの間はpowScore項を丸ごと除外し、素質ランクからも成長力を推測できないようにする。
// v46(素質ランク圧縮修正): revealPow=false時はpowScoreが常に0になるため、公開時と同じ
// しきい値(2.5/5.8/8.5/11.5)のままだと分布が潰れる。実測（3経歴×5脚質・8万体）：
// 公開時 C45%/B44%/A11%/S0.4% に対し、非公開時に旧しきい値を使うとC96%/B4%/A0%/S0%まで
// 圧縮され、デビュー画面の「素質を引き直す」がほぼ常にCしか出ず機能しなくなっていた。
// 非公開スコア（=powScoreを除いた視認可能要素のみの合計）の分位点が、公開時の各ランク比率と
// 一致するよう専用しきい値を較正した（scratchpad/talentrank_calib.mjs）。
export function mlTalentRank(player, revealPow = true) {
  if (!player) return { rank: "C", color: "#9aa3b5", score: 0 };
  const powScore = revealPow ? ({ S: 3, A: 2, B: 1, C: 0 }[player.growthPow] ?? 1) : 0;
  const pers = PERSONALITIES[player.personality];
  const persScore = player.personality === "genius" ? 2.2 : (player.personality === "normal" ? 0 : 0.5);
  const abils = player.abilities || [];
  const gold = player.goldAbilities || [];
  let goodCount = 0, badCount = 0;
  abils.forEach(id => { const a = ABILITIES[id]; if (!a) return; if (a.bad) badCount++; else goodCount++; });
  const goldCount = gold.filter(id => ABILITIES[id] && !ABILITIES[id].bad).length;
  const growthRare = (player.growth === "super_late" || player.growth === "super_early") ? 1 : 0;
  const score = powScore * 2 + persScore + goodCount * 0.8 + goldCount * 1.7
    + (player.talentCap || 0) * 0.25 + (player.bakuhatsu || 0) * 0.15 + growthRare - badCount * 0.9;
  const T = revealPow
    ? { SS: 11.5, S: 8.5, A: 5.8, B: 2.5 }
    : { SS: 4.8, S: 3.8, A: 2.1, B: 0.5 };
  let rank, color;
  if (score >= T.SS) { rank = "SS"; color = "#ff7ac0"; }
  else if (score >= T.S) { rank = "S"; color = "#ffd23f"; }
  else if (score >= T.A) { rank = "A"; color = "#35c07e"; }
  else if (score >= T.B) { rank = "B"; color = "#4f8fe8"; }
  else { rank = "C"; color = "#9aa3b5"; }
  return { rank, color, score: Number(score.toFixed(1)),
    parts: { powScore, persLabel: pers?.label || "普通", goodCount, badCount, goldCount } };
}

// v36(弟子深化): 弟子の指導イベント。毎月ごく稀に発生し、師（プレイヤー）が関わり方を選ぶ。
// 「厳しく鍛える」系＝鍛錬(guideBonus)が伸び師も少し消耗、「寄り添う」系＝絆(bond)が深まり師も癒やされる。
// 弟子を"育てている実感"と、育て方による個性差を生む。TYPESに依存しない汎用シーン（名前は画面で差し込む）。
export const ML_PROTEGE_EVENTS = [
  { id: "slump", title: "弟子のスランプ",
    text: "弟子が結果を出せず、練習中も表情が暗い。「自分には才能がないのかも」と弱気なことを口にした。",
    choices: [
      { label: "厳しく発破をかける", result: "「甘えるな」と本気で叱咤した。悔し涙をこらえ、翌日から見違えるほど練習に打ち込むようになった。",
        protege: { guideBonus: 0.06, bond: 4, ovrBonus: 1 }, mentor: { fatigueDelta: 6 } },
      { label: "隣に座って話を聞く", result: "自分も同じ壁にぶつかった頃の話をした。少し表情が和らぎ、「もう少し頑張ってみます」と顔を上げた。",
        protege: { bond: 14 }, mentor: { fatigueDelta: -6, evalDelta: 2 } },
    ] },
  { id: "form", title: "弟子のフォーム相談",
    text: "弟子が「先輩のペダリングを盗みたい」と、フォームを見てほしいと頼んできた。",
    choices: [
      { label: "つきっきりで矯正する", result: "夜まで付き合い、無駄のない動きを叩き込んだ。効率が目に見えて上がった。",
        protege: { guideBonus: 0.07, bond: 6 }, mentor: { fatigueDelta: 8, abBoost: 1 } },
      { label: "要点だけ教えて自分で考えさせる", result: "ヒントだけ与えて突き放した。試行錯誤の末、自分なりの形を掴み始めた。",
        protege: { guideBonus: 0.03, bond: 8 }, mentor: { fatigueDelta: -2 } },
    ] },
  { id: "race_debut", title: "弟子の初レース",
    text: "弟子が初めて大きなレースに出る。緊張で前夜に眠れなかったらしい。",
    choices: [
      { label: "勝ちにこだわれと送り出す", result: "「お前なら獲れる」と背中を押した。気迫の走りで健闘し、大きな自信を掴んだ。",
        protege: { guideBonus: 0.05, bond: 6, ovrBonus: 1 }, mentor: { fatigueDelta: 3 } },
      { label: "楽しんでこいと肩を叩く", result: "「結果より、まず走りを楽しめ」と。伸び伸びと走り、レースそのものを好きになったようだ。",
        protege: { bond: 16 }, mentor: { fatigueDelta: -4 } },
    ] },
  { id: "gift", title: "弟子からの贈り物",
    text: "弟子が「いつもありがとうございます」と、小さなプレゼントを差し出してきた。",
    choices: [
      { label: "照れ隠しに稽古をつける", result: "礼の代わりだと、そのまま追い込みメニューに付き合わせた。二人とも汗だくになった。",
        protege: { guideBonus: 0.04, bond: 10 }, mentor: { fatigueDelta: 5 } },
      { label: "素直に受け取り労う", result: "ありがたく受け取り、これまでの努力を労った。師弟の絆がぐっと深まった。",
        protege: { bond: 18 }, mentor: { fatigueDelta: -8, evalDelta: 1 } },
    ] },
  { id: "temptation", title: "弟子の迷い",
    text: "弟子が「もっと待遇の良い他チームに誘われている」と打ち明けてきた。目は揺れている。",
    choices: [
      { label: "実力で黙らせろと鍛え直す", result: "「行きたければ行け。だがその前に、ここで一流になってみせろ」。覚悟を決め、練習量が跳ね上がった。",
        protege: { guideBonus: 0.08, bond: 8 }, mentor: { fatigueDelta: 7 } },
      { label: "お前の意志を尊重すると伝える", result: "頭ごなしに止めず、本人の気持ちを最優先した。「やっぱり、先輩の下で続けます」と残る道を選んだ。",
        protege: { bond: 20 }, mentor: { fatigueDelta: -3, evalDelta: 3 } },
    ] },
];

// v36(弟子深化): 年度をまたいだ時、弟子がOVRの節目(70/80/90)を越えたら祝いのニュースを返す（無ければnull）。
export function protegeMilestoneNews(protege, oldYear, newYear) {
  if (!protege) return null;
  const before = protegeState(protege, oldYear).ovr;
  const after = protegeState(protege, newYear).ovr;
  const crossed = [90, 80, 70].find(t => before < t && after >= t);
  if (!crossed) return null;
  const name = protege.name;
  if (crossed >= 90) return `🎓 弟子 ${name} がついにOVR90の壁を突破！世界のトップと肩を並べる領域へ。あなたの教えが世界を舞台に花開いた`;
  if (crossed >= 80) return `🎓 弟子 ${name} がOVR80に到達！エース級の風格をまとい、チームの中心を担う存在に成長した`;
  return `🎓 弟子 ${name} がOVR70を突破！一人前のプロとして、レースで結果を残せる選手になった`;
}

export function computeWorldRank(points, year) {
  if (!points || points <= 1) return 300;
  const P1 = 360 + (year - 1) * 52; // 世界1位相当の持ち点（年々上昇）
  if (points >= P1) return 1;
  const rank = Math.ceil(Math.pow(P1 / points, 1 / 0.72));
  return Math.max(1, Math.min(300, rank));
}

export function worldRankTier(rank) {
  if (rank == null) return { label: "ランク外", color: "#9aa3b5" };
  if (rank === 1) return { label: "世界王者", color: "#ffd23f" };
  if (rank <= 3) return { label: "世界トップ3", color: "#ffd23f" };
  if (rank <= 10) return { label: "世界トップ10", color: "#35c07e" };
  if (rank <= 30) return { label: "世界の常連", color: "#35c07e" };
  if (rank <= 80) return { label: "世界で戦う男", color: "#4f8fe8" };
  if (rank <= 200) return { label: "世界の登竜門", color: "#9aa3b5" };
  return { label: "無名の挑戦者", color: "#9aa3b5" };
}

export function mlWorldBoard(ml) {
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


// v38(#9 B-1): 適性グレード（ウイポの適性表）。既存の種目別地力スコア（disciplineScore）に S〜G の
// 文字グレードを付与し「どの地形で輝くか」を一目で読めるようにする。数値の羅列より直感的で、将来の
// A案（因子で適性を継承）の土台にもなる。sim・スコアの算出式は不変（適性表と結果は矛盾しない）。
export function aptGrade(score) {
  if (score >= 90) return "S";
  if (score >= 82) return "A";
  if (score >= 74) return "B";
  if (score >= 66) return "C";
  if (score >= 58) return "D";
  if (score >= 50) return "E";
  if (score >= 42) return "F";
  return "G";
}
// 選手の種目別適性を {key,label,score,grade} で返す（DisciplineGrid 表示用）
export function riderAptitudes(r) {
  return DISCIPLINE_KEYS.map(k => {
    const score = disciplineScore(r, k);
    return { key: k, label: DISCIPLINES[k].label, score, grade: aptGrade(score) };
  });
}

// v38(#9 B-3): 因子図鑑。殿堂入りした歴代選手が「残した因子」を横断的に集計する純関数。
// ウイポの因子集めに相当し、周回を重ねるほど脚質・特能・適性の因子が star（保有選手数）で貯まる。
// これらは既存の系統ボーナス（mlBloodlineBonus）で配合・弟子継承に効いており、その"収集"を可視化する。
// 戻り値: [{ category, items: [{key,label,count,color,members:[name...]}] }]（count降順）
export function mlFactorCollection(legends) {
  const legs = legends || loadMlLegends();
  const typeC = {}, abilC = {}, aptC = {};
  const typeMembers = {}, abilMembers = {}, aptMembers = {};
  const push = (m, k, name) => { (m[k] = m[k] || []); if (name && m[k].length < 8 && !m[k].includes(name)) m[k].push(name); };
  legs.forEach(l => {
    if (l.type) { typeC[l.type] = (typeC[l.type] || 0) + 1; push(typeMembers, l.type, l.name); }
    (l.specialAbilities || []).forEach(id => {
      if (ABILITIES[id] && !ABILITIES[id].bad) { abilC[id] = (abilC[id] || 0) + 1; push(abilMembers, id, l.name); }
    });
    if (l.finalAbilities) {
      const r = { ...l.finalAbilities, type: l.type };
      riderAptitudes(r).forEach(a => {
        if (a.grade === "S" || a.grade === "A") { aptC[a.key] = (aptC[a.key] || 0) + 1; push(aptMembers, a.key, l.name); }
      });
    }
  });
  const sortItems = (obj, members, labelFn, colorFn) => Object.entries(obj)
    .map(([k, count]) => ({ key: k, label: labelFn(k), count, color: colorFn ? colorFn(k) : C.purple, members: members[k] || [] }))
    .sort((a, b) => b.count - a.count);
  return [
    { category: "脚質因子", icon: "🚴", items: sortItems(typeC, typeMembers, k => (TYPES[k] ? TYPES[k].label : k), k => (TYPES[k] ? TYPES[k].color : C.sub)) },
    { category: "特能因子", icon: "✨", items: sortItems(abilC, abilMembers, k => (ABILITIES[k] ? ABILITIES[k].label : k)) },
    { category: "適性因子（S/A適性）", icon: "🏔️", items: sortItems(aptC, aptMembers, k => (DISCIPLINES[k] ? DISCIPLINES[k].label : k), k => APT_GRADE_COLOR.A) },
  ];
}

export function mlAmbitionPath(ml) { return ML_AMBITION_PATHS[ml.ambitionPath] || ML_AMBITION_PATHS.victory; }

export function mlCurrentAmbition(ml) {
  const rungs = mlAmbitionPath(ml).rungs;
  const idx = ml.ambitionIdx || 0;
  return idx < rungs.length ? rungs[idx] : null;
}

export function mlAmbitionProgressText(ml, amb) {
  if (!amb) return "";
  if (amb.metric === "rankAtMost") return `現在 世界${ml.worldRank == null ? "—" : ml.worldRank}位 ／ 目標 ${amb.target}位以内`;
  return `${mlAmbitionMetricValue(ml, amb.metric)} / ${amb.target}`;
}


export function bumpGrowthPow(pow, steps = 1) {
  let i = GROWTH_POW_LADDER.indexOf(pow);
  if (i < 0) return pow;
  return GROWTH_POW_LADDER[Math.min(GROWTH_POW_LADDER.length - 1, i + steps)];
}

export function applyAmbitionReward(reward, player, money) {
  const parts = [];
  let newMoney = money;
  if (reward.money) { newMoney += reward.money; parts.push(`資金+${reward.money}万円`); }
  if (reward.pop) { player.popularity = Math.max(0, Math.min(100, (player.popularity || 0) + reward.pop)); parts.push(`人気+${reward.pop}`); }
  if (reward.ab) { AB_KEYS.forEach(k => addAb(player, k, reward.ab, 130)); parts.push(`全能力+${reward.ab}`); }
  if (reward.growth) { player.growthPow = bumpGrowthPow(player.growthPow, reward.growth); parts.push(`成長力→${player.growthPow}`); }
  return { money: newMoney, text: parts.join("・") };
}

export function hasMyLifeSave() {
  try { return !!localStorage.getItem(ML_SAVE_KEY); } catch (e) { return false; }
}

export function clearMyLifeSave() {
  try { localStorage.removeItem(ML_SAVE_KEY); } catch (e) { /* noop */ }
}

export function mlCreateRival(rng, playerName, playerTeamName, bannedNames, bannedTeams) {
  const excludeTeams = new Set([playerTeamName, ...(bannedTeams || [])]);
  const otherTeams = MYLIFE_TEAMS.filter(t => !excludeTeams.has(t.name));
  const team = otherTeams[Math.floor(rng() * otherTeams.length)];
  const keys = Object.keys(TYPES);
  const type = keys[Math.floor(rng() * keys.length)];
  const banned = new Set([playerName, ...(bannedNames || [])]);
  const name = pickRiderName(rng, banned);
  const px = rng();
  const personality = px < 0.30 ? "normal" : px < 0.35 ? "genius"
    : ["hotblood", "seeker", "artisan", "free", "smart", "maverick", "showman", "tactician"][Math.floor(rng() * 8)];
  const abilities = rollAbilities(rng);
  return { id: ridState.value++, name, type, team: team.name, age: 20 + Math.floor(rng() * 8), personality, abilities };
}

export function t_label(type) { return TYPES[type]?.label || type; }
