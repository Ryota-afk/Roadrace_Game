// 配合・血統・殿堂スナップショット。Phase 2で分離。
import { ABILITIES, AB_KEYS } from "../data/abilities.js";
import { ARCH_BREED, BREED_NICKS, ML_SPECIAL_MATINGS, PROTEGE_TEACHINGS, TEACH_KEYS, TYPE_ABKEYS } from "../data/breeding.js";
import { C } from "../data/theme.js";
import { GOLD_CONDITIONS, SUB_STAT_KEYS, overall } from "../core/core.js";
import { ML_ACHIEVEMENTS, computeAchievements, mlCareerArchetype, riderCareerSummary, riderNickname } from "../state/state.js";

export const ML_LEGENDS_KEY = "roadrace_v12_mylife_legends";
export function loadMlLegends() {
  try {
    const raw = localStorage.getItem(ML_LEGENDS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

export function saveMlLegends(list) {
  try { localStorage.setItem(ML_LEGENDS_KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
}

export const ML_BLOODLINE_KEY = "roadrace_v12_bloodlines";
export function loadBloodlines() {
  try { const raw = localStorage.getItem(ML_BLOODLINE_KEY); const o = raw ? JSON.parse(raw) : {}; return (o && typeof o === "object") ? o : {}; }
  catch (e) { return {}; }
}

export function saveBloodlines(obj) {
  try { localStorage.setItem(ML_BLOODLINE_KEY, JSON.stringify(obj)); } catch (e) { /* noop */ }
}

export function mlRegisterBloodline(leg) {
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

export function mlBloodlineTier(rec) {
  if (!rec) return { tier: 0, label: "未確立", score: 0 };
  const score = (rec.count || 0) * 6 + (rec.wins || 0) * 0.4 + (rec.bestOverall || 0) * 0.12;
  let tier = 0;
  if ((rec.count || 0) >= 5 && score >= 60) tier = 3;
  else if ((rec.count || 0) >= 3 && score >= 36) tier = 2;
  else if ((rec.count || 0) >= 2 && score >= 18) tier = 1;
  const label = ["未確立", "確立", "名門", "大系統"][tier];
  return { tier, label, score: Math.round(score) };
}

export function mlBloodlineFactor(rec) {
  if (!rec || !rec.abilityCounts) return null;
  let best = null, bc = 1;
  Object.entries(rec.abilityCounts).forEach(([id, c]) => { if (c > bc && ABILITIES[id]) { bc = c; best = id; } });
  return best;
}

export function mlBloodlineBonus(lineageName) {
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

export function mlLegendSnapshot(s) {
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

export function protegeInherit(master) {
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

export function legendBloodId(l) {
  if (!l) return null;
  return l.bloodId || (l.name != null ? "n:" + l.name : null);
}

export function legendAncestorSet(l) {
  const set = new Set();
  const self = legendBloodId(l); if (self) set.add(self);
  (l && l.ancestors || []).forEach(a => { if (a) set.add(a); });
  return set;
}

export function legendArchetypeKey(leg) {
  if (leg && leg.careerArchetypeKey) return leg.careerArchetypeKey;
  if (!leg) return null;
  if ((leg.wins || 0) >= 25) return "emperor";
  if ((leg.wins || 0) >= 8) return "specialist_" + leg.type;
  if ((leg.podiums || 0) >= 12 && (leg.wins || 0) <= 3) return "nearly";
  return null;
}

export function archBreedBonus(leg) {
  const key = legendArchetypeKey(leg);
  return (key && ARCH_BREED[key]) ? { ...ARCH_BREED[key], key } : null;
}

export function mlSpecialMating(parentA, parentB) {
  if (!parentA || !parentB) return null;
  const keys = [legendArchetypeKey(parentA), legendArchetypeKey(parentB)];
  const abs = [...(parentA.specialAbilities || []), ...(parentB.specialAbilities || [])];
  const ctx = { keys, abs, lineA: parentA.lineageName, lineB: parentB.lineageName, genA: parentA.generation || 0, genB: parentB.generation || 0 };
  for (const sm of ML_SPECIAL_MATINGS) { try { if (sm.test(ctx)) return sm; } catch (e) { /* noop */ } }
  return null;
}

export function breedNick(typeA, typeB) {
  const key = [typeA, typeB].sort().join("+");
  return BREED_NICKS[key] || { rank: "△", label: "標準的な配合", ability: null, ab: {} };
}

export function breedInbreed(parentA, parentB) {
  const ga = legendAncestorSet(parentA), gb = legendAncestorSet(parentB);
  let count = 0; ga.forEach(x => { if (gb.has(x)) count++; });
  return { count, mergedAncestors: new Set([...ga, ...gb]) };
}

export function mlBreedBonus(parentA, parentB) {
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

export function mlRecordLegend(s) {
  const snap = mlLegendSnapshot(s);
  saveMlLegends([...loadMlLegends(), snap]);
  mlRegisterBloodline(snap); // v33.3: 系統確立レジストリへ実績を累積
}
