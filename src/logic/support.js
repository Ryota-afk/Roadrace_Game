// 表示ヘルパー関数＋残存データ定数（Phase 4-1で main.jsx から分離）。
import { legendBloodId, loadMlLegends, saveMlLegends, loadBloodlines, mlBloodlineTier } from "../breeding/breeding.js";
import { ASSIST_ROLES, GOLD_CONDITIONS, countRoleUses, countWins, hasAbility, mulberry, newRider, overall, pickRiderName, ridState, rollAbilities, strHash } from "../core/core.js";
import { ABILITIES, AB_KEYS, GROWTH, PERSONALITIES, TYPES } from "../data/abilities.js";
import { BREED_NICKS } from "../data/breeding.js";
import { MONTHS, VENUE_REGION, UNLOCK_TEMPLATES } from "../data/course.js";
import { CLASSES, DIFFICULTIES } from "../data/progression.js";
import { C } from "../data/theme.js";
import { AI_STYLES, assignAIRoles, computeTeamTT, effAbilities, generateCourse, rankSim, simulateTicks } from "../sim/race.js";
import { ML_AMBITION_PATHS, ML_SAVE_KEY, MYLIFE_TEAMS, RIVAL_TEAMS, SAVE_KEY, mlAmbitionMetricValue } from "../state/state.js";
import { mlWorldStarsForYear } from "../world/world.js";

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

export const softFactor = (v, cap = 88) => (v < cap ? 1 : Math.exp(-(v - cap) / 4));

export const addAb = (r, k, amount, cap) => { r[k] = r[k] + amount * softFactor(r[k], cap); };

export function growSub(r, key, amount) {
  const v = r[key] ?? 50;
  r[key] = Math.min(94, v + amount * softFactor(v, 88));
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

// v37: マイライフ用CP特典。生涯CPに応じてデビュー時の支度金・人気・監督評価・成長力抽選・
// 当たり特能抽選が強化される（＝CPがマイライフでも意味を持つ／周回で新人が有利になる）。
export const ML_CP_MILESTONES = [
  { cp: 10, label: "マイライフ:支度金 +50万円", perk: { money: 50 } },
  { cp: 20, label: "マイライフ:初期人気 +10", perk: { pop: 10 } },
  { cp: 40, label: "マイライフ:初期監督評価 +8", perk: { eval: 8 } },
  { cp: 60, label: "マイライフ:成長力アップ抽選 +15%", perk: { growthLottery: 0.15 } },
  { cp: 85, label: "マイライフ:デビュー当たり特能の抽選 +10%", perk: { boonBonus: 0.10 } },
  { cp: 120, label: "マイライフ:支度金 +150万＆初期人気 +15", perk: { money: 150, pop: 15 } },
  // v38(#5): 高CP帯のマイライフ特典を延伸
  { cp: 170, label: "マイライフ:初期監督評価 +12＆成長力抽選 +15%", perk: { eval: 12, growthLottery: 0.15 } },
  { cp: 240, label: "マイライフ:デビュー当たり特能の抽選 +15%＆支度金 +300万", perk: { boonBonus: 0.15, money: 300 } },
  { cp: 330, label: "マイライフ:初期人気 +25＆監督評価 +12（頂点）", perk: { pop: 25, eval: 12 } },
];
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
export const MLCP_DIFF_MUL = { easy: 0.7, normal: 1.0, hard: 1.5, oni: 2.2 };

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

export function recordCourseResult(kind, length, winnerTime, holder, isPlayer, year) {
  if (!kind || !winnerTime || winnerTime <= 0 || !length) return null;
  const speed = Math.round((length / winnerTime) * 100);
  const recs = loadCourseRecords();
  const prev = recs[kind] || null;
  const isNew = !prev || speed > prev.speed;
  if (isNew) { recs[kind] = { speed, holder: holder || "—", isPlayer: !!isPlayer, year: year || 1 }; saveCourseRecords(recs); }
  return { kind, speed, isNew, prev, holder: holder || "—", isPlayer: !!isPlayer };
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

export const STAFF_SALARY_PER_LV = 12; // 万円/月・レベル1つあたり（月給制、昇格なし＝買い切り費用は無し）

export function staffSalaryTotal(staff) {
  if (!staff) return 0;
  return (Object.values(staff).reduce((a, b) => a + b, 0)) * STAFF_SALARY_PER_LV;
}

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

export const EVENTS = [
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

export const FLAVOR_PERSONA = [
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

export const ROLE_CLAUSE = {
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

export function roleClause(role) { return ROLE_CLAUSE[role] || ""; }

export const FLAVOR_EPISODE_WIN = [
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で圧巻の逃げ切りを見せ、今も語り草になっている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}を制した走りは、本人いわく会心の一戦だったという。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}のゴールスプリントを制した瞬間はチーム内でも語り継がれている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で初優勝を飾って以来、勝負どころでの強さに定評がある。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で見せた独走勝利は、今も本人の自信の源になっている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で終盤の集団を突き放し、そのまま押し切った。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}制覇を境に、周囲の見る目が変わったという。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での勝利は本人にとって忘れられない一戦。`,
];

export const FLAVOR_EPISODE_PODIUM = [
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で表彰台に上がり、確かな手応えをつかんだ。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では終盤まで優勝争いに加わり、僅差で表彰台に踏みとどまった。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での表彰台は本人にとって大きな自信になっている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で見せた粘りの走りが、表彰台という結果につながった。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}のラストで踏ん張り、表彰台をつかみ取った。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では、最後まで諦めない走りで表彰台に食い込んだ。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での好走は今もチーム内で話題に上る。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}、あと一歩及ばず優勝は逃したが、表彰台という結果を残した。`,
];

export const FLAVOR_EPISODE_OTHER = [
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では先頭集団に食らいつき、力の片鱗を見せた。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では終盤まで粘り、確かな成長を感じさせた。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での走りは結果以上に評価されている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で見せた積極的な仕掛けは、今後への期待を抱かせた。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では苦しい展開ながらも最後まで足を止めなかった。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}を経て、レース勘を着実に磨いている最中だ。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での経験は今の走りの土台になっている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では悔しい結果に終わったが、その後の糧にしている。`,
];

export function raceLogWinStreak(log) {
  let streak = 0;
  for (let i = log.length - 1; i >= 0; i--) { if (log[i].rank === 1) streak++; else break; }
  return streak;
}

export const ACE_TYPE_LABEL = {
  SPR: "エーススプリンター", CLM: "エースクライマー", RUL: "オールラウンドエース",
  PUN: "エースパンチャー", TT: "エースタイムトライアリスト",
};

export const FLAVOR_UNDEFEATED = [
  n => `${n}戦${n}勝、デビュー以来まだ黒星がない完全無敗を貫いている。`,
  n => `無敗街道驀進中——${n}戦して一度も負けたことがない。`,
  n => `${n}戦全勝という圧倒的な戦績で、負けを知らない走りを続けている。`,
  n => `ここまで${n}戦無敗。誰にも負ける気がしないという自信がにじみ出ている。`,
];

export const FLAVOR_STREAK = [
  n => `現在${n}連勝中。勢いに乗ったこの選手を止めるのは容易ではない。`,
  n => `直近${n}戦を勝ち続け、波に乗っている真っ最中だ。`,
  n => `${n}連勝と絶好調で、次のレースでも警戒される存在になっている。`,
  n => `破竹の${n}連勝中——誰もこの勢いに逆らえずにいる。`,
];

export const FLAVOR_ACE_ARCHETYPE = [
  label => `幾多のレースでエースを任され続けた、チームの絶対的${label}。`,
  label => `迷わずエースの座を託される、押しも押されもせぬ${label}。`,
  label => `チームメイトの誰もが認める、揺るぎない${label}としての地位を築いている。`,
  label => `他の追随を許さぬ結果を積み重ね、名実ともにチームの${label}になった。`,
];

export const FLAVOR_ASSIST_ARCHETYPE = [
  () => "己の勝利より仲間を活かす道を選び続けた、チーム随一の名アシスト。",
  () => "目立たぬ働きでエースを何度も勝たせてきた、縁の下の名アシスト。",
  () => "献身的な牽引でチームを支え続け、いぶし銀の名アシストと評されている。",
  () => "自らの結果より仲間のゴールを優先する、信頼厚い名アシスト。",
];

export const FLAVOR_BREAKAWAY_ARCHETYPE = [
  () => "序盤から果敢に飛び出す走りを繰り返す、逃げのスペシャリスト。",
  () => "集団任せにせず自ら仕掛け続ける、逃げ屋としての矜持を持つ選手。",
  () => "番狂わせを演出する逃げの名手として、レースを何度も面白くしてきた。",
];

export const STAGE_DAY_ROLE_LABEL = {
  ace: "エース", lead: "第一アシスト", sub: "第二アシスト", mountain: "山岳アシスト", flat: "平坦アシスト", breakaway: "逃げ要員",
};

export function stageDayPhrase(d) {
  const roleLabel = STAGE_DAY_ROLE_LABEL[d.role] || "アシスト";
  const rankLabel = d.rank === 1 ? "優勝" : `${d.rank}位`;
  return `${d.day}日目は${roleLabel}で${rankLabel}`;
}

export function stageOverallPhrase(e) {
  return e.rank === 1 ? "見事総合優勝を飾った" : e.rank <= 3 ? `総合${e.rank}位で表彰台に上がった` : `総合${e.rank}位でフィニッシュした`;
}

export const FLAVOR_STAGE_TEMPLATES = [
  e => `${e.year}年目${MONTHS[e.month]}の${e.name}では、${e.stageBreakdown.map(stageDayPhrase).join("、")}という走りを見せ、${stageOverallPhrase(e)}。`,
  e => `${e.year}年目${MONTHS[e.month]}、${e.name}を振り返ると——${e.stageBreakdown.map(stageDayPhrase).join("、")}。最終的には${stageOverallPhrase(e)}。`,
  e => `${e.year}年目${MONTHS[e.month]}の${e.name}、その道のりは${e.stageBreakdown.map(stageDayPhrase).join("、")}というものだった。結果は${stageOverallPhrase(e)}。`,
  e => `${e.year}年目${MONTHS[e.month]}、${e.name}では日替わりで役割を変えながら${e.stageBreakdown.map(stageDayPhrase).join("、")}。${stageOverallPhrase(e)}。`,
];

export function raceLogSlumpBeforeLast(log) {
  if (log.length < 3) return 0;
  let n = 0;
  for (let i = log.length - 2; i >= 0; i--) { if (log[i].rank >= 5) n++; else break; }
  return n;
}

export const FLAVOR_COMEBACK = [
  e => `一時は${roleClause(e.role)}不振に沈んだが、${e.year}年目${MONTHS[e.month]}の${e.name}で見事な復活を遂げた。`,
  e => `苦しい時期を乗り越え、${e.year}年目${MONTHS[e.month]}の${e.name}では${roleClause(e.role)}会心の走りでカムバックを果たした。`,
  e => `不調の連鎖を断ち切ったのが、${e.year}年目${MONTHS[e.month]}の${e.name}。${roleClause(e.role)}這い上がる走りで存在感を示した。`,
  e => `低迷期を経て、${e.year}年目${MONTHS[e.month]}の${e.name}で${roleClause(e.role)}見違えるような走りを取り戻した。`,
];

export function findCourseSpecialty(log) {
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

export const FLAVOR_COURSE_SPECIALTY = [
  (name, n) => `${name}には${n}度出走して${n}度とも表彰台に上がっている、勝手知ったる得意のコース。`,
  (name, n) => `${name}となると俄然強さを増すタイプで、${n}戦${n}回とも表彰台を外していない。`,
  (name, n) => `${name}の道筋を知り尽くしているのか、${n}度の出走すべてで表彰台に食い込んでいる。`,
  (name, n) => `${name}との相性は抜群で、出走した${n}戦すべてで好結果を残している。`,
];

export const FLAVOR_GT_SPECIALIST = [
  n => `グランツールとなるとひときわ輝きを増す選手で、これまで${n}度表彰台に上っている。`,
  n => `長丁場のグランツールを得意とし、${n}度の総合表彰台がその適性を物語っている。`,
  n => `グランツール巧者として知られ、通算${n}度の総合表彰台を築き上げてきた。`,
];

export const FLAVOR_PRODIGY = [
  () => "若くしてすでに複数の勝利を手にしている、将来を嘱望される逸材。",
  () => "同年代を大きく引き離す結果を残し続ける、早熟の才能の持ち主。",
  () => "デビューから間もないながら勝ち方を知っている、期待の若手。",
];

export const FLAVOR_VETERAN = [
  () => "ベテランと呼ばれる年齢になってもなお、第一線で結果を残し続けている。",
  () => "年齢を感じさせない走りで、若手相手にも一歩も引かない意地を見せる。",
  () => "長いキャリアを積みながら衰えを知らず、今も好走を重ねている。",
];

export const FLAVOR_MURA = [
  () => "絶好調かと思えば急失速もある、振れ幅の大きさが持ち味の選手。",
  () => "波に乗ればどこまでも強いが、崩れる時は大きく崩れる読めないタイプ。",
  () => "会心の走りと不本意な結果が同居する、良くも悪くもムラのある選手。",
];

export function riderFlavorText(r) {
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

export function isHallOfFameWorthy(r) {
  if (r.favorite) return true;
  const log = r.raceLog || [];
  const wins = log.filter(e => e.rank === 1).length;
  const podiums = log.filter(e => e.rank <= 3).length;
  return log.length >= 8 || wins >= 1 || podiums >= 3 || overall(r) >= 70 || !!r.prodigy;
}

export function computePickupChance(r) {
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

export const CLASS_TIER_COLOR = [C.sub, C.blue, C.yellow];

export function mlTeamTier(teamName) { const t = MYLIFE_TEAMS.find(t => t.name === teamName); return t ? t.tier : 0; }

export const RIVAL_NEWS_TEMPLATES = [
  t => `${t}が有望な若手を獲得し、戦力を着々と上積みしているという。`,
  t => `${t}が今季ここまで好調をキープ。勢いに乗っている。`,
  t => `${t}はエースの不振に苦しみ、やや停滞気味との情報だ。`,
  t => `${t}のエースに、他チームからの引き抜きの噂が浮上している。`,
  t => `${t}が最新機材を導入し、平坦での速さに磨きをかけたらしい。`,
  t => `${t}で世代交代が進み、チームの雰囲気が変わりつつあるようだ。`,
  t => `${t}が強化合宿を敢行。次戦に向けて仕上げてきそうだ。`,
  t => `${t}が監督体制を刷新し、戦術に変化が見られるという。`,
];

export function rivalNews(year, month) {
  const rng = mulberry((year || 1) * 137 + (month || 0) * 31 + 911);
  const team = RIVAL_TEAMS[Math.floor(rng() * RIVAL_TEAMS.length)];
  const tmpl = RIVAL_NEWS_TEMPLATES[Math.floor(rng() * RIVAL_NEWS_TEMPLATES.length)];
  return { team: team.name, color: team.color, text: tmpl(team.name) };
}

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
export function rivalScene({ rival, beat, gapSec, heatAfter, playerName, seed }) {
  if (!rival) return null;
  const pers = rival.personality || "normal";
  const V = RIVAL_VOICE[pers] || RIVAL_VOICE.normal;
  const R = RIVAL_REPLY[pers] || RIVAL_REPLY.normal;
  const tier = rivalHeatTier(heatAfter);
  const rng = mulberry(((seed || 1) >>> 0) || 1);
  const pick = a => a[Math.floor(rng() * a.length)] || a[0];
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
  return { persLabel: PERSONALITIES[pers]?.label || "", tierLabel: tier.label, tierColor: tier.color, opening, responses };
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

export const ML_BACKGROUNDS = {
  highschool: { label: "高校卒", age: 18, powerBase: 40, growth: "late", powDist: [0.16, 0.46, 0.80],
    desc: "能力はまだ粗削りだが伸びしろは最大級。長い目で育てる叩き上げタイプ",
    // v36(#4): 叩き上げ＝デビュー時に成長力が1段階上がる抽選（伸びしろの天井を狙える）
    perk: { growthLottery: 0.55 },
    meritLabel: "🌱 叩き上げ", merit: "伸びしろ最大＆最長キャリア。デビュー時に55%で成長力が1段階アップ（才能の天井が高い）" },
  university: { label: "大学卒", age: 22, powerBase: 50, growth: "normal", powDist: [0.08, 0.30, 0.65],
    desc: "能力・伸びしろのバランス型。安定した成長曲線が魅力",
    // v36(#4): 文武両道＝学生時代の実績で早くから注目される（人気→スポンサー収入）＋若き才「天才肌」
    perk: { popBonus: 16, startAbility: "genius_sp" },
    meritLabel: "🎓 文武両道", merit: "バランス型。初期人気+16（スポンサー収入が早い）＆「天才肌」持ちでデビュー（25歳までの伸びが速い）" },
  corporate: { label: "実業団卒", age: 25, powerBase: 58, growth: "early", powDist: [0.02, 0.12, 0.40],
    desc: "即戦力級の完成度を持つが、伸びしろは小さめ",
    // v36(#4): 即戦力＝実戦仕込みの完成度。高い初期評価で早くからエース起用・好条件移籍、支度金つき
    perk: { evalBonus: 12, moneyBonus: 100, startAbility: "engine" },
    meritLabel: "💼 即戦力", merit: "高い完成度で即通用。初期監督評価+12（早くからエース起用・好条件の移籍）＆支度金+100万＆「無尽蔵のエンジン」持ち" },
};

// v36(#8): 取材・私生活イベントを有意義に。各選択が「人気（＝スポンサー収入）」「メンタル
// （＝フォーム安定・大舞台）」「監督評価」「地力」「疲労」のどれかに実効的に効く二択へ強化。
// フレーバーだけの微差をやめ、育成方針として選ぶ意味を持たせた（効果は結果画面に明示）。
export const ML_EVENTS = [
  { title: "地元メディアの取材", text: "地元テレビ局が調子について取材したいと申し出た。",
    choices: [
      { label: "前向きにアピールする", result: "自信に満ちた受け答えでファンの心を掴んだ。知名度が上がった。", effects: { popularityDelta: 7, fatigueDelta: 5 } },
      { label: "謙虚に落ち着いて答える", result: "気負わぬ受け答えが好感を呼び、自分自身も平常心を取り戻せた。", effects: { mentalDelta: 3, fatigueDelta: -5 } },
    ] },
  { title: "個人スポンサーとの会食", text: "個人スポンサーの担当者から食事に誘われた。",
    choices: [
      { label: "しっかり交流する", result: "関係を深め、スポンサーの期待と信頼を勝ち取った。", effects: { popularityDelta: 5, managerEvalDelta: 3, fatigueDelta: 8 } },
      { label: "早めに切り上げて休む", result: "体調を最優先し、しっかり英気を養った。", effects: { fatigueDelta: -14, mentalDelta: 1 } },
    ] },
  { title: "実家に顔を出す", text: "オフの合間、久しぶりに実家に顔を出した。",
    choices: [
      { label: "ゆっくり心身を休める", result: "家族と過ごす時間に心がほぐれ、疲れも気持ちの張りもすっかり抜けた。", effects: { fatigueDelta: -28, mentalDelta: 3 } },
      { label: "地元で自主トレに励む", result: "慣れた道での鍛錬で、地力が確かに一段上がった。", effects: { abBoost: 4, fatigueDelta: 6 } },
    ] },
  { title: "ライバルからの挑発", text: "SNSでライバル選手から挑発めいた投稿があった。",
    choices: [
      { label: "闘志を燃やす", result: "負けん気に火がつき、練習に鬼気迫る熱が入った。心も鍛えられた。", effects: { abBoost: 3, mentalDelta: 2, fatigueDelta: 10 } },
      { label: "泰然と受け流す", result: "動じず受け流したことで、勝負所での胆力が一段増した。", effects: { mentalDelta: 4, fatigueDelta: -3 } },
    ] },
  { title: "監督との面談", text: "監督に呼ばれ、今後の起用方針について話をした。",
    choices: [
      { label: "エースを目指したいと伝える", result: "強い意欲が評価され、起用の期待が高まった。", effects: { managerEvalDelta: 7, mentalDelta: 1, fatigueDelta: 5 } },
      { label: "チームのために尽くすと伝える", result: "誠実な姿勢が厚い信頼につながった。", effects: { managerEvalDelta: 9, fatigueDelta: -4 } },
    ] },
  { title: "違和感のある一日", text: "練習中、脚に軽い張りを感じた。",
    choices: [
      { label: "無理せず入念にケアする", result: "早めのケアで大事に至らず、コンディションも上向いた。", effects: { fatigueDelta: -18, formDelta: 4 } },
      { label: "気にせず追い込む", result: "その日は乗り切って地力を伸ばしたが、疲労が深く残った。", effects: { abBoost: 3, fatigueDelta: 18 } },
    ] },
  { title: "地元の子供たちからサイン会の依頼", text: "地域の子供向けサイクリング教室から、サイン会に来てほしいと依頼が来た。",
    choices: [
      { label: "喜んで引き受ける", result: "子供たちの憧れの眼差しに応え、地域の人気者になった。", effects: { popularityDelta: 7, fatigueDelta: 4 } },
      { label: "手紙とサイン色紙を送る", result: "無理のない形で気持ちを届け、穏やかに過ごせた。", effects: { popularityDelta: 2, fatigueDelta: -6, mentalDelta: 1 } },
    ] },
  { title: "先輩選手から食事に誘われる", text: "チームの先輩から「たまには飯でも」と誘われた。",
    choices: [
      { label: "経験談を聞かせてもらう", result: "修羅場をくぐった先輩の言葉が、走りと心の糧になった。", effects: { abBoost: 2, mentalDelta: 2, fatigueDelta: 2 } },
      { label: "気楽に楽しむ", result: "肩の力を抜いた時間で、しっかりリフレッシュできた。", effects: { fatigueDelta: -10, mentalDelta: 1 } },
    ] },
  { title: "新しいトレーニング理論の紹介", text: "海外で話題のトレーニング理論を紹介する記事を読んだ。",
    choices: [
      { label: "さっそく取り入れてみる", result: "新しい刺激が体に変化をもたらし、地力が伸びた。", effects: { abBoost: 4, fatigueDelta: 8 } },
      { label: "今のやり方を信じて貫く", result: "積み上げた流儀を貫く覚悟が、揺るがぬ芯を育てた。", effects: { mentalDelta: 3, fatigueDelta: -2 } },
    ] },
  { title: "地方紙にインタビューが掲載", text: "地方紙の取材を受けた記事が、思いのほか大きく掲載された。",
    choices: [
      { label: "手応えを噛みしめる", result: "評価される実感が自信となり、知名度も評価も上がった。", effects: { popularityDelta: 5, managerEvalDelta: 2 } },
      { label: "浮かれず淡々と過ごす", result: "平常心を崩さず、次に向けて心を整えた。", effects: { mentalDelta: 2, fatigueDelta: -4 } },
    ] },
  // v36(#8): 私生活の充実を描く新イベント（休息・趣味・恋愛・地域貢献）
  { title: "束の間のオフ、趣味に没頭", text: "レースの合間、久しぶりにまとまった休みが取れた。",
    choices: [
      { label: "何も考えず好きなことに使う", result: "完全に頭を空にして遊んだ。心のコップが満たされ、気力が漲ってきた。", effects: { mentalDelta: 4, fatigueDelta: -12 } },
      { label: "体を動かしてアクティブに過ごす", result: "オフでも軽く汗を流し、体を鈍らせずに保った。", effects: { abBoost: 2, formDelta: 3, fatigueDelta: -4 } },
    ] },
  { title: "ファンからの応援の手紙", text: "闘病中の少年から「あなたの走りに勇気をもらった」という手紙が届いた。",
    choices: [
      { label: "返事を書き、必ず勝つと誓う", result: "誰かの希望である責任が、静かな闘志となって胸に宿った。", effects: { mentalDelta: 4, popularityDelta: 3 } },
      { label: "そっと胸にしまい走りで応える", result: "言葉より走りで応えると決め、練習にも身が入った。", effects: { abBoost: 2, mentalDelta: 2, fatigueDelta: 5 } },
    ] },
];

// v36(#9): 性格ベースの私生活イベント（マイライフ）。プレイヤー自身の性格に応じた出来事が起き、
// その性格らしい二択を選ぶ。取材・私生活イベントの一部として、性格を持つ選手にだけ差し込まれる。
export const ML_PERSONALITY_EVENTS = {
  hotblood: [
    { title: "抑えきれない闘志", text: "レースの映像を見返すうち、悔しさと闘志がこみ上げて眠れなくなった。",
      choices: [
        { label: "衝動のまま夜通し追い込む", result: "燃え上がる情熱を練習にぶつけ、地力を一気に引き上げた。反動で疲労は深い。", effects: { abBoost: 4, fatigueDelta: 14 } },
        { label: "深呼吸して頭を冷やす", result: "昂りを鎮め、勝負所で活きる冷静さを手に入れた。", effects: { mentalDelta: 4, fatigueDelta: -8 } },
      ] },
  ],
  seeker: [
    { title: "強さへの探求", text: "「本当の強さとは何か」──答えを求め、あなたは自分と向き合っていた。",
      choices: [
        { label: "限界の先へ体を追い込む", result: "苦しみの果てに、また一つ壁を越えた。", effects: { abBoost: 4, fatigueDelta: 12 } },
        { label: "走りを理論で見つめ直す", result: "感覚を言語化し、揺るがぬ芯を得た。", effects: { mentalDelta: 4 } },
      ] },
  ],
  artisan: [
    { title: "細部への こだわり", text: "職人肌のあなたは、ペダリングと機材の詰めが気になって仕方がない。",
      choices: [
        { label: "納得いくまで突き詰める", result: "無駄のない動きが仕上がり、当日の仕上がりが一段上がった。", effects: { formDelta: 7, fatigueDelta: 4 } },
        { label: "実戦感覚を優先する", result: "机上より実走を選び、地力を確かに伸ばした。", effects: { abBoost: 3 } },
      ] },
  ],
  free: [
    { title: "気の向くままに", text: "自由人のあなたは、ふと思い立って予定のない一日を過ごすことにした。",
      choices: [
        { label: "何にも縛られず遊ぶ", result: "心が軽くなり、また走りたい気持ちが湧いてきた。", effects: { mentalDelta: 4, fatigueDelta: -10 } },
        { label: "気ままにペダルを回す", result: "遊びのように走るうち、体も動きも自然と整った。", effects: { abBoost: 2, formDelta: 3 } },
      ] },
  ],
  smart: [
    { title: "データとの対話", text: "智将肌のあなたは、パワーデータとレース映像を照らし合わせて分析に没頭した。",
      choices: [
        { label: "弱点をピンポイント補強", result: "課題を的確に潰し、効率よく地力を伸ばした。", effects: { abBoost: 3 } },
        { label: "レース展開を読み込む", result: "勝ち筋のパターンが頭に入り、仕上がりと胆力が増した。", effects: { mentalDelta: 2, formDelta: 4 } },
      ] },
  ],
  genius: [
    { title: "持て余す才能", text: "何をやっても人よりできてしまう。天才肌のあなたは、少し退屈さえ感じていた。",
      choices: [
        { label: "自らに高い課題を課す", result: "歯応えのある挑戦に才能がさらに開花した。", effects: { abBoost: 4, fatigueDelta: 8 } },
        { label: "感覚のままに流す", result: "肩の力を抜いて走ると、不思議と調子が上向いた。", effects: { formDelta: 5 } },
      ] },
  ],
  maverick: [
    { title: "孤高の流儀", text: "チームの輪に馴染めない自分に、周囲は戸惑っている。だが群れないのがあなたの生き方だ。",
      choices: [
        { label: "独りで黙々と鍛える", result: "誰にも合わせず限界まで追い込み、独走の地力を磨き上げた。", effects: { abBoost: 4, fatigueDelta: 10 } },
        { label: "少しだけ歩み寄る", result: "柄にもなく仲間と言葉を交わし、張り詰めていた心がほぐれた。", effects: { mentalDelta: 3, fatigueDelta: -6 } },
      ] },
  ],
  showman: [
    { title: "魅せる走りへの情熱", text: "「速いだけじゃ面白くない」。観客を沸かせる派手な勝ち方こそ、あなたの美学だ。",
      choices: [
        { label: "スター性で人気を掴む", result: "魅せる走りがファンを熱狂させ、知名度がぐっと上がった。", effects: { popularityDelta: 8, fatigueDelta: 3 } },
        { label: "地道に瞬発力を磨く", result: "派手さの裏に確かな技術を。ラストの切れ味が増した。", effects: { abBoost: 3, formDelta: 3 } },
      ] },
  ],
  tactician: [
    { title: "レース盤面の研究", text: "策士のあなたは、あらゆる展開を想定して勝ち筋を組み立てるのが何より好きだ。",
      choices: [
        { label: "徹底的に戦術を練る", result: "無数の展開を頭に叩き込み、勝負勘と冷静さが研ぎ澄まされた。", effects: { mentalDelta: 4, formDelta: 2 } },
        { label: "机上より実走で試す", result: "理論を実戦で検証し、走力そのものを一段引き上げた。", effects: { abBoost: 3, fatigueDelta: 5 } },
      ] },
  ],
};

export const ML_SPONSOR_GIGS = [
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

export const ML_OFFSEASON_CHOICES = [
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
];

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

export const MANAGER_DIRECTIVES = {
  ace: { key: "ace", label: "エースとして表彰台を狙え", desc: "チームの主力として3位以内でフィニッシュせよ",
    evalGain: 7, evalPenalty: 5, check: (rank) => rank <= 3 },
  breakthrough: { key: "breakthrough", label: "積極的な走りで上位進出せよ", desc: "上位30%以内でのフィニッシュを目指せ",
    evalGain: 5, evalPenalty: 2, check: (rank, total) => rank <= Math.max(3, Math.ceil(total * 0.3)) },
  support: { key: "support", label: "アシストとしてチームを支えよ", desc: "先頭集団に食らいついて完走せよ",
    evalGain: 3, evalPenalty: 1, check: (rank, total) => rank <= Math.max(5, Math.ceil(total * 0.6)) },
  experience: { key: "experience", label: "経験を積むために出走せよ", desc: "とにかく最後まで走り切れ",
    evalGain: 2, evalPenalty: 0, check: () => true },
};

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

export const ML_HOUSES = [
  { label: "賃貸アパート", price: 80, fatigueBonus: 5, desc: "毎月の疲労回復+5（恒常）" },
  { label: "分譲マンション", price: 220, fatigueBonus: 12, desc: "毎月の疲労回復+12（恒常）" },
  { label: "郊外の一戸建て", price: 480, fatigueBonus: 22, desc: "毎月の疲労回復+22。私生活が安定し監督評価もやや上がりやすくなる" },
  // v20: 稼いだ資金の使い道が尽きて余りがちだったため、終盤向けの最上位グレードを追加
  { label: "都心の高級タワーマンション", price: 900, fatigueBonus: 30, desc: "毎月の疲労回復+30。この上ない生活環境で、監督評価もさらに上がりやすくなる" },
];

export const ML_CARS = [
  { label: "中古の軽自動車", price: 60, raceFatigueCut: 0.10, desc: "レース参加による疲労蓄積-10%" },
  { label: "国産セダン", price: 160, raceFatigueCut: 0.20, desc: "レース参加による疲労蓄積-20%" },
  { label: "輸入スポーツカー", price: 400, raceFatigueCut: 0.30, desc: "レース参加による疲労蓄積-30%" },
  { label: "オーダーメイドの高級SUV", price: 750, raceFatigueCut: 0.38, desc: "レース参加による疲労蓄積-38%" },
];

export const ML_AB_COACH_KEY = { flat: "flatCoach", climb: "climbCoach", sprint: "sprintCoach", stamina: "staminaCoach", solo: "soloCoach" };

export const ML_GEAR = {
  roller: { label: "自主トレ用スマートローラー", price: 90, desc: "練習の成長効果+15%（恒常）" },
  monitor: { label: "パワーメーター一式", price: 70, desc: "狙った能力の伸びがさらに+10%（恒常）" },
  chef: { label: "専属コンディショニングシェフ", price: 150, desc: "レース参加による疲労蓄積が10%軽減される（恒常）" },
  flatCoach:    { label: "平坦専門コーチ", price: 100, desc: "平坦の練習効果+25%（恒常）" },
  climbCoach:   { label: "登坂専門コーチ", price: 100, desc: "登坂の練習効果+25%（恒常）" },
  sprintCoach:  { label: "スプリント専門コーチ", price: 100, desc: "スプリントの練習効果+25%（恒常）" },
  staminaCoach: { label: "スタミナ専門コーチ", price: 100, desc: "スタミナの練習効果+25%（恒常）" },
  soloCoach:    { label: "独走専門コーチ", price: 100, desc: "独走の練習効果+25%（恒常）" },
};

export const GROWTHPOW_ORDER = ["C", "B", "A", "S"];

export function mlGrowthCap(year, player) {
  // v33: 配合の才能キャップ（talentCap）は選手固有の限界突破分。生まれ持った素質で天井が上がる
  const talent = (player && player.talentCap) ? player.talentCap : 0;
  return Math.min(140, 90 + Math.floor(Math.max(0, (year || 1) - 1)) * 2 + talent);
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

export const GROWTH_ORDER = ["early", "normal", "late", "super_late"];

export const ML_STOCK_ITEMS = {
  drink: { label: "リカバリードリンク", desc: "疲労を30回復", price: 15, fatigueDelta: -30 },
  supp:  { label: "上質な休養サプリ", desc: "疲労を60回復", price: 32, fatigueDelta: -60 },
  tune:  { label: "フォーム調整剤", desc: "フォームを+12（レース前の仕上げに）", price: 20, formDelta: 12 },
  // v15フェーズ2: 成長力・成長タイプを底上げする消耗品
  growthPowUp: { label: "才能開花プログラム", desc: "成長力を1段階アップ（C→B→A→S）", price: 180, growthPowUp: true },
  growthShift: { label: "晩成型トレーニング理論", desc: "成長タイプを1段階「晩成」寄りに変更（早熟→普通→晩成→超晩成）", price: 150, growthShiftUp: true },
};

export const ML_SPECIAL_TRAINING = {
  altitude: { label: "🏔 高地合宿", keys: ["stamina", "solo"], gainMul: 1.7, fatigue: 24, cond: 0, desc: "スタミナ・独走を集中的に鍛える（疲労大）" },
  sprintcamp: { label: "⚡ スプリント特訓", keys: ["sprint", "flat"], gainMul: 1.7, fatigue: 20, cond: 0, desc: "スプリント・平坦＋加速力を集中的に鍛える" },
  climbcamp: { label: "⛰ クライム合宿", keys: ["climb", "stamina"], gainMul: 1.7, fatigue: 24, cond: 0, desc: "登坂・スタミナを集中的に鍛える（疲労大）" },
  mental: { label: "🧘 メンタル強化", keys: [], gainMul: 0.4, fatigue: 6, cond: 1, desc: "メンタルを重点強化＋全能力わずか底上げ・フォーム+8（疲労小）" },
};

export const DISCIPLINES = {
  flat:   { label: "平坦",      calc: r => r.flat * 0.6 + r.solo * 0.25 + r.stamina * 0.15 },
  climb:  { label: "山岳",      calc: r => r.climb * 0.7 + r.stamina * 0.3 },
  sprint: { label: "スプリント", calc: r => r.sprint * 0.7 + r.flat * 0.2 + r.stamina * 0.1 },
  solo:   { label: "独走(TT)",  calc: r => r.solo * 0.7 + r.stamina * 0.3 },
  hill:   { label: "丘陵",      calc: r => r.climb * 0.4 + r.sprint * 0.4 + r.stamina * 0.2 },
};

export const DISCIPLINE_KEYS = Object.keys(DISCIPLINES);

export function disciplineScore(r, key) { return Math.round(DISCIPLINES[key].calc(r)); }

export const FAVORS_TO_DISCIPLINE = { SPR: "sprint", CLM: "climb", PUN: "hill", TT: "solo" };

// v34(UI): 出走表の「下馬評」予想。コースの得意分野に沿った地力（＝出走時点の実効能力）で
// 出走選手を格付けし、本命◎/対抗○/注目▲ を付ける。競輪・競馬の予想印のイメージ。
// 能力データを持たないエントラント（シーズンの簡易出走表など）や favors 未指定なら空を返す（＝予想なし）。
// 返り値：Map(entrant -> { rank, mark|null })。mark = { icon, label, color }。
export function raceForecast(entrants, favors) {
  const map = new Map();
  if (!favors || !entrants || entrants.length < 3) return map;
  const key = FAVORS_TO_DISCIPLINE[favors] || "flat";
  const calc = DISCIPLINES[key].calc;
  const scored = [];
  for (const e of entrants) {
    if (typeof e.flat !== "number" || typeof e.climb !== "number") return map; // 能力データ無し→予想しない
    scored.push({ e, s: calc(e) });
  }
  scored.sort((a, b) => b.s - a.s);
  scored.forEach(({ e }, i) => {
    let mark = null;
    if (i === 0) mark = { icon: "◎", label: "本命", color: "#ffd23f" };
    else if (i <= 2) mark = { icon: "○", label: "対抗", color: "#4f8fe8" };
    else if (i <= 4) mark = { icon: "▲", label: "注目", color: "#35c07e" };
    map.set(e, { rank: i + 1, mark });
  });
  return map;
}

export const SUB_STAT_LABEL = { accel: "加速力", build: "体格", mental: "メンタル" };

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

export function abilityFor(segType, e) {
  if (segType === "flat") return e.flat;
  if (segType === "hill") return e.climb * 0.55 + e.flat * 0.45;
  if (segType === "climb") return e.climb;
  if (segType === "sprint") return e.sprint;
  if (segType === "mtn") return e.climb * 0.7 + e.sprint * 0.3;
  if (segType === "tt") return e.solo * 0.6 + e.flat * 0.4;
  return e.flat;
}

export function computeStandings(g) {
  const monthProg = Math.max(0.08, (g.month + 1) / 12);
  const need = CLASSES[g.classIdx].need;
  const diffMul = (DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).aiMul;
  const dynastyMul = 1 + Math.min(0.4, (g.dynastyLevel || 0) * 0.1);
  const rows = RIVAL_TEAMS.map(t => {
    const rng = mulberry(strHash(t.name) + g.year * 101 + g.classIdx * 7);
    const strength = (0.6 + rng() * 0.85) * diffMul * dynastyMul;
    const seasonTotal = Math.round(need * strength * 1.35);
    return { name: t.name, color: t.color, spec: t.spec, trait: t.trait, pts: Math.round(seasonTotal * monthProg), isPlayer: false };
  });
  rows.push({ name: g.teamName || "あなたのチーム", color: C.yellow, pts: g.points, isPlayer: true });
  rows.sort((a, b) => b.pts - a.pts);
  return rows;
}

// v34（バランス）：シーズン順位を実効化する。現在の順位表での自チームの順位を返す。
export function seasonRank(g) {
  const rows = computeStandings(g);
  const idx = rows.findIndex(r => r.isPlayer);
  return { rank: idx + 1, total: rows.length };
}
// v35(シーズン深掘り): タイトル争い。順位表から「今の位置・すぐ上の相手・すぐ下の相手・首位との差」を
// 読み取り、シーズンを通した優勝争いの物語を返す。純関数。ホームに常時カードで出して緊張感を生む。
export function seasonTitleRace(g) {
  const rows = computeStandings(g);
  const idx = rows.findIndex(r => r.isPlayer);
  if (idx < 0) return null;
  const me = rows[idx], rank = idx + 1, total = rows.length;
  const leader = rows[0];
  const ahead = idx > 0 ? rows[idx - 1] : null;   // すぐ上（追う相手）
  const behind = idx < rows.length - 1 ? rows[idx + 1] : null; // すぐ下（追われる相手）
  const gapToLeader = Math.max(0, leader.pts - me.pts);
  const gapAhead = ahead ? Math.max(0, ahead.pts - me.pts) : 0;
  const gapBehind = behind ? Math.max(0, me.pts - behind.pts) : 0;
  const late = (g.month || 0) >= 8; // 終盤ほど言い回しを煽る
  let line;
  if (rank === 1) {
    line = behind
      ? `首位を快走。2位・${behind.name}を${gapBehind}pt引き離している。${late ? "このまま逃げ切れるか。" : "リードを守り抜けるか。"}`
      : "首位。独走態勢だ。";
  } else if (rank <= 3) {
    line = `表彰台圏の${rank}位。首位・${leader.name}まで${gapToLeader}pt、目前の${ahead.name}（+${gapAhead}pt）を捉えれば順位が上がる。${late ? "終盤、勝負どころだ。" : ""}`;
  } else {
    line = `${rank}位／${total}チーム。上位進出へ、まずは一つ上の${ahead.name}（+${gapAhead}pt）を追う。${late ? "残り少ない、追い上げを。" : "走り込んで差を詰めよう。"}`;
  }
  return {
    rank, total, isLeader: rank === 1,
    leaderName: leader.name, gapToLeader,
    ahead: ahead ? { name: ahead.name, gap: gapAhead, trait: ahead.trait } : null,
    behind: behind ? { name: behind.name, gap: gapBehind, trait: behind.trait } : null,
    line,
  };
}

// 年度末のシーズン順位ボーナス（賞金・万円）。上位ほど厚く、クラスで増額。走り込んで順位を上げる意味を作る。
export function standingsRankReward(rank, classIdx) {
  const base = rank === 1 ? 150 : rank === 2 ? 90 : rank === 3 ? 40 : 0;
  return Math.round(base * (1 + classIdx * 0.6));
}
// シーズン順位に応じてチャンピオンシップの昇格ボーダー（必要着順）を緩和する。
// 1位＝本番5位以内で昇格／2位＝4位以内／3位以下＝従来通り3位以内。年間を通した強さを本番に還元。
export function champPromoteCut(rank) {
  return rank === 1 ? 5 : rank === 2 ? 4 : 3;
}

export function bumpCareerStats(cs, rank, prize) {
  return {
    totalRaces: cs.totalRaces + 1,
    totalWins: cs.totalWins + (rank === 1 ? 1 : 0),
    totalPodiums: cs.totalPodiums + (rank <= 3 ? 1 : 0),
    totalPrize: cs.totalPrize + prize,
    bestFinish: cs.bestFinish === null ? rank : Math.min(cs.bestFinish, rank),
  };
}

export const CHEMISTRY_TIERS = [
  { min: 30, label: "鉄壁の絆", mul: 0.92 },
  { min: 15, label: "円熟したチーム", mul: 0.95 },
  { min: 6,  label: "定着期", mul: 0.98 },
  { min: 0,  label: "新体制", mul: 1 },
];

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

export function growthPhase(r) {
  const [ps, pe] = GROWTH[r.growth].peak;
  if (r.age < ps) return { gain: 1.0, dec: 0, tag: "成長期" };
  if (r.age <= pe) return { gain: 0.5, dec: 0, tag: "全盛期" };
  return { gain: 0.1, dec: Math.min(1.2, 0.25 * (r.age - pe)), tag: "衰え期" };
}

export function potentialHint(r) {
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

export const ABILITY_CATEGORY_ORDER = ["地形適性", "展開・役割", "メンタル", "フィジカル", "成長"];

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

export function mlWorldNews(seed, year, legendPool) {
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
export function mlNewspaper({ player, race, rank, careerWins, worldRank, year, month }) {
  if (!player || !race || rank !== 1) return null; // 号外は「勝った時」だけ
  const log = player.raceLog || [];
  // 直近から連続する優勝数（今回を含む）を数える＝勝ち星の連なり
  let winStreak = 0;
  for (let i = log.length - 1; i >= 0; i--) { if (log[i].rank === 1) winStreak++; else break; }
  const name = player.name;
  const grade = race.grade || 1;
  const isWorlds = race.milestone === "worlds";
  const isOlympics = race.milestone === "olympics";
  const isMonument = !!race.monument;
  const streakMilestone = [15, 10, 8, 5, 3].find(n => winStreak >= n && winStreak === n) ?? (winStreak >= 3 ? winStreak : 0);
  const careerMilestone = [100, 50, 25, 10].find(n => careerWins === n) || 0;
  const date = `${year}年目 ${MONTHS[month]}`;
  const masthead = "ロードレース・タイムズ";
  // 優先度：世界の頂点 ＞ モニュメント ＞ 連勝節目 ＞ 格上ビッグウィン ＞ 通算勝利節目
  if (isWorlds || isOlympics) {
    const t = isWorlds ? "世界選手権" : "オリンピック";
    return { kind: "crown", accent: "#ffd23f", masthead, date, tag: "号外・特報",
      headline: `${name}、${t}を制す`, sub: `世界の頂点に立つ ── 王者の称号、ここに`,
      body: `${race.name}を制した${name}が、ついに世界のトップへと駆け上がった。ゴール前で見せた圧巻の走りに、スタンドは総立ち。${worldRank && worldRank <= 5 ? `世界ランキングも${worldRank}位まで上昇し、` : ""}その名は世界中のファンの記憶に刻まれた。`,
      photo: `${t}の表彰台で栄光を噛みしめる${name}` };
  }
  if (isMonument) {
    return { kind: "classic", accent: "#e8a13c", masthead, date, tag: "号外",
      headline: `${name}、クラシック制覇`, sub: `${race.name} ── 英雄の系譜に新たな名`,
      body: `一世紀を超えて受け継がれる格式高い古典レース《${race.monumentName || race.name}》を、${name}が制した。消耗の激しい伝統のコースで最後まで脚を残し、歴戦の強豪たちを退けての完勝。クラシックの覇者として、その走りは長く語り継がれるだろう。`,
      photo: `石畳（または峠）を越えて先頭でゴールする${name}` };
  }
  if (streakMilestone >= 3) {
    return { kind: "streak", accent: "#e8544f", masthead, date, tag: winStreak >= 8 ? "特集" : "スポーツ面",
      headline: `${name} ${winStreak}連勝！`, sub: `止まらない快進撃 ── 敵なしの快走続く`,
      body: `${race.name}を制し、${name}が${winStreak}連勝を達成した。誰にも止められない勢いで白星を重ね、いまや大会の主役。${winStreak >= 8 ? "この記録がどこまで伸びるのか、ファンの期待は高まるばかりだ。" : "次戦でも連勝を伸ばせるか、注目が集まる。"}`,
      photo: `ガッツポーズでゴールラインを駆け抜ける${name}` };
  }
  if (grade >= 3) {
    return { kind: "big", accent: "#4f8fe8", masthead, date, tag: "スポーツ面",
      headline: `${name}、大金星`, sub: `${race.name}で強豪を撃破`,
      body: `格の高い${"★".repeat(grade)}レース${race.name}で、${name}が見事に優勝を飾った。並みいる強豪を相手にした価値ある勝利。着実に実力をつけてきた走りが、大舞台で結実した一日となった。`,
      photo: `両手を突き上げて喜ぶ${name}` };
  }
  if (careerMilestone) {
    return { kind: "milestone", accent: "#35c07e", masthead, date, tag: "コラム",
      headline: `${name} 通算${careerMilestone}勝の金字塔`, sub: `積み重ねた白星、また一つの節目`,
      body: `${race.name}を制し、${name}がキャリア通算${careerMilestone}勝に到達した。一戦一戦を大切に走り続けた積み重ねが、大きな数字となって結実した。次なる目標へ、歩みは止まらない。`,
      photo: `記念すべき${careerMilestone}勝目を挙げた${name}` };
  }
  return null;
}

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
export function mlTalentRank(player) {
  if (!player) return { rank: "C", color: "#9aa3b5", score: 0 };
  const powScore = { S: 3, A: 2, B: 1, C: 0 }[player.growthPow] ?? 1;
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
  let rank, color;
  if (score >= 11.5) { rank = "SS"; color = "#ff7ac0"; }
  else if (score >= 8.5) { rank = "S"; color = "#ffd23f"; }
  else if (score >= 5.8) { rank = "A"; color = "#35c07e"; }
  else if (score >= 2.5) { rank = "B"; color = "#4f8fe8"; }
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

export const ML_AMBITION_PATH_KEYS = ["victory", "bigstage", "devotion", "world", "ironman", "stardom"];

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
export const APT_GRADE_COLOR = { S: "#ffd23f", A: "#ff8a5c", B: "#e8734a", C: "#6fbf73", D: "#4f8fe8", E: "#8a93a6", F: "#8a93a6", G: "#5a6274" };
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

export const GROWTH_POW_LADDER = ["C", "B", "A", "S"];

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
