// 配合・血統・殿堂スナップショット。Phase 2で分離。
// v41(§Step6): 選手の異名・キャリア総括・実績判定（元は state.js）をここへ移送。state.js が
// loadMlLegends を必要とする一方、これらは mlLegendSnapshot（本ファイル）専用の依存だったため、
// state.js⇄breeding.js の循環importになっていた。5つとも自分の引数のみ参照する自己完結の純関数・
// 純データだったため、唯一の呼び出し元であるここへ移し、state.js→breeding.js の一方向に整理した。
import { ABILITIES, AB_KEYS } from "../data/abilities.js";
import { ARCH_BREED, BREED_NICKS, ML_SPECIAL_MATINGS, PROTEGE_TEACHINGS, TEACH_KEYS, TYPE_ABKEYS } from "../data/breeding.js";
import { T } from "../data/theme.js";
import { GOLD_CONDITIONS, SUB_STAT_KEYS, overall } from "../core/core.js";

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
  if (worldBest === 1) return { key: "world1", title: "世界の頂に立った者", desc: "世界ランキングの頂点を極め、一時代を築いた絶対王者。", color: T.color.accent };
  if (titles >= 2) return { key: "heroMulti", title: "大舞台の英雄", desc: "世界選手権・五輪の大舞台で幾度も頂点に立った、記憶に刻まれる英雄。", color: T.color.accent };
  if (titles >= 1) return { key: "hero", title: "大一番の勝負師", desc: "ここぞの大舞台で栄冠をつかんだ、勝負強さの人。", color: "#e8a13c" };
  // v33.11: モニュメント（クラシック）制覇に特化したキャリア
  if ((s.careerClassics || 0) >= 3) return { key: "classicKing", title: "クラシックの覇者", desc: "格式高いモニュメントを幾度も制した、古典レースの申し子。", color: "#e8a13c" };
  if ((s.careerClassics || 0) >= 1 && wins < 8) return { key: "classicHunter", title: "石畳の古豪", desc: "消耗の激しい一発勝負の古典で栄冠をつかんだ、タフネスの体現者。", color: T.color.good };
  if (wins >= 25) return { key: "emperor", title: "常勝の帝王", desc: "数えきれない勝利を積み上げた、記録に残る絶対的エース。", color: T.color.accent };
  if (wins >= 8) { const sp = SPEC[type] || { t: "勝利の職人", d: "堅実に勝ちを積み上げた実力者。" }; return { key: "specialist_" + type, title: sp.t, desc: sp.d, color: T.color.good }; }
  if (supR >= 12 && supR >= aceR * 1.5 && wins <= 4) return { key: "domestique", title: "不屈のアシスト職人", desc: "自らの勝利より仲間の勝利を優先し、チームを陰で支え続けた名脇役。", color: "#4f8fe8" };
  if (podiums >= 12 && wins <= 3) return { key: "nearly", title: "悲運の名脇役", desc: "幾度も表彰台に立ちながら、最高の一段には手が届かなかった、愛されるべき選手。", color: "#c98bf0" };
  if (years >= 12 || age >= 36) return { key: "ironman", title: "鉄人", desc: "長きにわたり第一線で走り続けた、稀有なる持久力の持ち主。", color: "#6fa8dc" };
  if ((r.growth === "late" || r.growth === "super_late") && wins >= 2) return { key: "latebloom", title: "遅咲きの雑草魂", desc: "長い下積みを経て、キャリア後半に花開いた苦労人。", color: T.color.good };
  if (wins >= 3) return { key: "winner", title: "勝利を知る者", desc: "確かな勝ち星を残した、記憶に残るレーサー。", color: T.color.good };
  if (podiums >= 6) return { key: "podium", title: "表彰台の常連", desc: "安定して上位に絡み続けた、堅実な実力者。", color: T.color.sub };
  if (races >= 15) return { key: "journeyman", title: "生涯一レーサー", desc: "派手さはなくとも、最後までペダルを回し続けた職人。", color: T.color.sub };
  return { key: "challenger", title: "名もなき挑戦者", desc: "短くも自分の走りを貫いた、一人の挑戦者。", color: T.color.sub };
}

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
  // 第15弾（血脈レシピ）：この代で確定した血の印（キャリアの生き様＋成立していれば特殊配合）を
  // 両親から受け継いだ印に追記する。次代の配合ではこの選手をmaster/partnerに選ぶだけで、
  // 何世代も遡らずレシピ判定ができる。
  const ownBloodMarks = [{ gen: r.generation || 0, mark: arch.key }];
  if (r.specialMating) ownBloodMarks.push({ gen: r.generation || 0, mark: "sm:" + r.specialMating.key });
  const bloodMarks = [...(r.bloodMarks || []), ...ownBloodMarks].slice(0, 24);
  return {
    // v49(第11弾続き): この選手個体を一意に識別するid。mlRecordLegend()の二重記録防止に使う
    // （リロード等で同じ引退が2回呼ばれても、同一idの選手を殿堂に重複登録しないためのキー）。
    riderId: r.id,
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
    bloodId, ancestors, parents: r.parentBloodIds || null, bloodMarks,
    plusValue: r.plusValue || 0, generation: r.generation || 0,
    // v31.2: 系統名（旧セーブは名前から生成）
    lineageName: r.lineageName || `${r.name || "無名"}系`,
    // v31.4: キャリアの生き様（称号）
    careerTitle: arch.title, careerTitleDesc: arch.desc, careerArchetypeKey: arch.key,
    // v33.4: 特殊配合の称号（あれば）
    specialMatingTitle: r.specialMating ? r.specialMating.title : null,
    // v35(逆メンター/演出): 育てた弟子（プロテジェ）の生データ。読み出し側で最終OVRを算出して称える
    protege: s.protege || null,
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
  const existing = loadMlLegends();
  // v49(第11弾続き): 同一選手（riderId）の重複登録を防ぐ。強制終了→再読み込みで引退直後の
  // 状態に巻き戻っても、この選手は既に殿堂入り済みなら再登録しない（呼び出し元の
  // useMyLifeGame.js側の恒久化修正が主対策だが、経路によらず二重登録を防ぐ保険として残す）。
  if (snap.riderId != null && existing.some(e => e.riderId === snap.riderId)) return;
  saveMlLegends([...existing, snap]);
  mlRegisterBloodline(snap); // v33.3: 系統確立レジストリへ実績を累積
}
