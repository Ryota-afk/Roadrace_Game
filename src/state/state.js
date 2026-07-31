// ゲーム状態：init/save/load・アンビション・実績・キャリア。Phase 2で分離。
// v41(§Step5): 移籍市場の生成器（legendToSeasonRider/worldRiderToRosterRider/genPoachTargets/
// makePoachOffer/genFaPool/genTradeOffers）と RIVAL_TEAMS/MYLIFE_TEAMS は domain/season/transfer.js・
// data/teams.js へ移送済み。ここでは import して内部利用（initGame等）しつつ再エクスポートし、
// main.jsx/screens/*.jsx 側の既存import文（"./state/state.js"）を変更せずに済むようにしている。
// v41(§Step6): 選手の異名・キャリア総括・実績判定（ML_ACHIEVEMENTS/computeAchievements/
// mlCareerArchetype/riderCareerSummary/riderNickname）は breeding.js（mlLegendSnapshotの
// 唯一の呼び出し元）へ移送。従来 state.js⇄breeding.js が循環importだったのを、これで
// state.js→breeding.js の一方向に整理した（loadMlLegendsのみ引き続き必要）。
import { AB_KEYS, TYPES } from "../data/abilities.js";
import { TYPE_ABKEYS } from "../data/breeding.js";
import { GRAND_TOURS, OVERSEAS_VENUES, REGIONS, TEMPLATES, UNLOCK_TEMPLATES, VENUES } from "../data/course.js";
import { CLASSES, DIFFICULTIES, TITLE_DEFS } from "../data/progression.js";
import { RIVAL_TEAMS, MYLIFE_TEAMS } from "../data/teams.js";
import { C } from "../data/theme.js";
import { SUB_STAT_KEYS, hasAbility, hasGoldAbility, mulberry, newRider, pickRiderName, ridState, rollAbilities } from "../core/core.js";
import { AI_STYLES, assignAIRoles, computeTeamTT, effAbilities, generateCourse, rankSim, rollWeather, simulateTicks } from "../sim/race.js";
import { loadMlLegends, ML_ACHIEVEMENTS, computeAchievements, mlCareerArchetype, riderCareerSummary, riderNickname } from "../breeding/breeding.js";
import { legendToSeasonRider, worldRiderToRosterRider, genPoachTargets, makePoachOffer, genFaPool, genTradeOffers } from "../domain/season/transfer.js";
import { initRoster, genScouts } from "../domain/season/roster.js";
import { genSponsors } from "../domain/season/sponsor.js";

export { RIVAL_TEAMS, MYLIFE_TEAMS, legendToSeasonRider, worldRiderToRosterRider, genPoachTargets, makePoachOffer, genFaPool, genTradeOffers, initRoster, genScouts, genSponsors, ML_ACHIEVEMENTS, computeAchievements, mlCareerArchetype, riderCareerSummary, riderNickname };

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

// v38(#9 A-3): 共有ワールド。シーズンとマイライフ、そして全周回で「1つの世界」を共有する。
// 保存するのは seed と worldYear の2値だけ（選手オブジェクトのidは保存しない＝id衝突を避ける）。
// 顔ぶれは seed から決定論的に生成し worldYear まで加齢して都度再構成する（idは毎回ridStateから新規採番
// ＝単調増加で衝突なし）。これにより「同じ世界が両モード・周回をまたいで年を取り続ける」連続性が生まれる。
export const WORLD_KEY = "roadrace_v12_world";
export function loadWorldMeta() {
  try {
    const raw = localStorage.getItem(WORLD_KEY);
    if (raw) { const w = JSON.parse(raw); if (w && w.seed != null) return { seed: w.seed >>> 0, year: Math.max(1, w.year || 1) }; }
  } catch (e) { /* noop */ }
  const meta = { seed: (((Date.now() % 999983) ^ 0x9e3779b9) >>> 0) || 12345, year: 1 };
  try { localStorage.setItem(WORLD_KEY, JSON.stringify(meta)); } catch (e) { /* noop */ }
  return meta;
}
export function advanceWorldYear() {
  const m = loadWorldMeta();
  const next = { seed: m.seed, year: (m.year || 1) + 1 };
  try { localStorage.setItem(WORLD_KEY, JSON.stringify(next)); } catch (e) { /* noop */ }
  return next;
}
// 共有ワールドの「現在（worldYear）」の顔ぶれを決定論的に再構成して返す。teams で対象チームを絞れる。
export function sharedWorldRosters(teams = MYLIFE_TEAMS) {
  const m = loadWorldMeta();
  let rosters = genWorldRosters(mulberry(m.seed), 6, MYLIFE_TEAMS);
  for (let y = 2; y <= m.year; y++) {
    rosters = ageWorldRosters(rosters, mulberry((y * 2246822519) >>> 0), y, MYLIFE_TEAMS).worldRosters;
  }
  if (teams === MYLIFE_TEAMS) return rosters;
  const sub = {};
  teams.forEach(d => { if (rosters[d.name]) sub[d.name] = rosters[d.name]; });
  return sub;
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
  // v41: 引き抜き市場は rivalRosters と id を共有する必要があるため、先に一度だけ生成して使い回す
  const rivalRosters = sharedWorldRosters(RIVAL_TEAMS);
  return {
    screen: "intro", tab: "home",
    // v28: 自チーム名（プレイヤーが命名できる。未設定なら既定名）
    teamName: "あなたのチーム",
    year: 1, month: 0, classIdx: 0, points: 0, budget: 300,
    roster,
    // v38: 永続ライバルロースター。従来はレースごとにAI相手を使い捨て生成しており、同じチーム名でも
    // 毎レース別人が出走していた（宿敵が育たず相手の成績も追えない）。開始時に固定の選手団を持つ。
    // v38(#9 A-3): 共有ワールドから取得＝新しいシーズンでも前回・マイライフと同じ顔ぶれの相手が
    // （年を取った状態で）出走する。世界が1つに繋がる。
    rivalRosters,
    equip: { frame: 0, wheels: 0, facility: 0, grounds: 0 },
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
    // v41: 移籍市場の駆け引き（引き抜き）。他チームの主力を引き抜く候補（年1更新）と、
    // 引き抜きは年1回までの制限フラグ（年度末にリセット）
    poachTargets: genPoachTargets(0, 1, 777 + 13, rivalRosters),
    poachDoneThisYear: false,
  };
}

export const SAVE_KEY = "roadrace_v12_save";
const SAVE_VERSION = "v12";
const SAVE_FIELDS = [
  "year", "month", "classIdx", "points", "budget", "roster", "equip", "staff", "inv", "partsInv",
  "camp", "sponsor", "sponsorOffers", "scoutPolicy", "scouts", "faMarket", "races",
  "champBest", "log", "cleared", "careerStats", "careerHistory", "difficulty", "hallOfFame", "rivalAlumni",
  "gtWins", "captainId", "tradeOffers", "jerseyWinCounts", "rewardedAchievements", "dynastyLevel", "youthUsed", "obCoach", "homeRegion", "teamName",
  "rivalRosters", "rivalStats", "poachTargets", "poachDoneThisYear",
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
  // v41: 引き抜き候補（実体化済み選手）の id も採番に含める（ロード後の id 衝突を防ぐ）
  (state.poachTargets || []).forEach(pt => { if (pt.candidate && pt.candidate.id >= max) max = pt.candidate.id + 1; });
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
      // v38(#7): 「アシスト60戦」の作業感を解消。目標戦数を圧縮し、献身と表彰台を交互に配置して
      // 通常プレイの中で自然に達成できるはしごにした（アシスト作戦を選ぶと着実に進む）。
      { key: "d5",      label: "アシスト役で5戦走る",           metric: "supportRaces", target: 5,  reward: { money: 80,  pop: 3 } },
      { key: "d_pod",   label: "それでも通算表彰台8回",         metric: "careerPodiums", target: 8,  reward: { money: 160, ab: 1 } },
      { key: "d15",     label: "アシスト役で通算15戦",         metric: "supportRaces", target: 15, reward: { money: 280, ab: 2 } },
      { key: "d_pod15", label: "献身を貫き通算表彰台15回",      metric: "careerPodiums", target: 15, reward: { money: 420, ab: 2, growth: 1 } },
      { key: "d30",     label: "生涯を捧げアシスト通算30戦",    metric: "supportRaces", target: 30, reward: { money: 650, ab: 3 } },
    ],
  },
  ironman: {
    label: "鉄人の道", icon: "🔩", color: "#7fa8d0",
    desc: "何年も第一線で走り続ける。長く戦い抜くことそのものを誇りとする生き方。",
    rungs: [
      { key: "i_y3",  label: "プロ3年目を迎える",       metric: "yearsActive", target: 3,  reward: { money: 90,  pop: 3 } },
      { key: "i_r30", label: "通算30戦に出走",          metric: "careerRaces", target: 30, reward: { money: 160, ab: 1 } },
      { key: "i_y7",  label: "プロ7年目を迎える",       metric: "yearsActive", target: 7,  reward: { money: 300, ab: 2 } },
      { key: "i_r80", label: "通算80戦に出走",          metric: "careerRaces", target: 80, reward: { money: 460, ab: 2, growth: 1 } },
      { key: "i_y12", label: "プロ12年目（不屈の鉄人）", metric: "yearsActive", target: 12, reward: { money: 750, ab: 3, growth: 1 } },
    ],
  },
  stardom: {
    label: "スターの道", icon: "✨", color: "#e878b0",
    desc: "競技の枠を超えた人気者になる。走りだけでなく存在で魅了する生き方。",
    rungs: [
      { key: "s_p20", label: "人気度20に到達",           metric: "popularity", target: 20, reward: { money: 120, pop: 4 } },
      { key: "s_p40", label: "人気度40（地元の英雄）",     metric: "popularity", target: 40, reward: { money: 220, pop: 6 } },
      { key: "s_p60", label: "人気度60（全国区のスター）",  metric: "popularity", target: 60, reward: { money: 380, ab: 2 } },
      { key: "s_p80", label: "人気度80（時代の顔）",       metric: "popularity", target: 80, reward: { money: 600, ab: 2, growth: 1 } },
      { key: "s_p95", label: "人気度95（生きる伝説）",     metric: "popularity", target: 95, reward: { money: 900, ab: 3 } },
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
  // v38(#7): 新しい道（鉄人／スター）用の指標
  if (metric === "yearsActive") return ml.year || 1;
  if (metric === "careerRaces") return ((ml.player && ml.player.raceLog) || []).length;
  if (metric === "popularity") return Math.round((ml.player && ml.player.popularity) || 0);
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
    difficulty: "easy", mlDiffChoice: "easy", // v38(#6): 難易度
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
  "difficulty", // v38(#6): マイライフの難易度（相手強さ・CP倍率）
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
      merged.teammates = mlGenTeammates(trng, merged.team, 5, [merged.player.name], merged.year || 1);
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

export function buildMyLifeSim(raceMeta, player, myTeamName, classIdx, difficultyId, dayTag, directiveKey, rival, year, rival2, teammates, tactic, worldStars, worldRosters, protege) {
  const diffDef = DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1];
  const diffAiMul = diffDef.aiMul;
  // v38(#6): マイライフのAI能力上限を難易度で引き上げる。従来は easy/normal/hard がどれも94上限で
  // 実質同強度になり、能力を極めた終盤（100超）に対して hard でも相手が頭打ちで無双できた。
  // hard=102/oni=112 まで許容し、極まった選手にも歯応えが残るようにする（season側のDIFFICULTIESは不変）。
  const aiCap = ({ easy: 92, normal: 96, hard: 102, oni: 112 })[difficultyId] ?? (diffDef.abilCap ?? 94);
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
      // v38(#3): 弟子（プロテジェ）を自チームの1枠として実際にレースへ出す。従来は数値が育つだけで
      // レースにも同チームにも現れず「本当に数字だけ」だった。弟子は現在のOVR（curOvr）で地力が決まり、
      // 育つほど強く出走する。id/名前/脚質を固定＝成績台帳にも積まれる（isProtege マーク）。
      // v38修正: プレイヤー本人はこのあと別途 riders に追加されるため、自チームのチームメイト枠は
      // 「aiSquadN - 1」に抑える。従来は members を aiSquadN 個作った上にプレイヤーを足していたため、
      // 自チームだけ他チームより1人多くなっていた（＝自チームだけ人数が多い問題）。
      const memberTarget = Math.max(0, aiSquadN - 1);
      const protegeSlot = (protege && protege.id != null && memberTarget >= 1) ? 1 : 0;
      const tmSlots = Math.max(0, memberTarget - protegeSlot);
      teammates.slice(0, tmSlots).forEach((tm, i) => {
        const st = newRider(power + (i === 0 ? 4 : 0), rng, { type: tm.type, banned: nameBanned });
        st.id = tm.id; st.name = tm.name; st.type = tm.type; st.personality = tm.personality || st.personality;
        if (tm.abilities) st.abilities = tm.abilities;
        members.push(st);
      });
      if (protegeSlot) {
        const pOvr = protege.curOvr || protege.ovr0 || 55;
        const prng = mulberry(((protege.id * 2654435761) ^ ((year || 1) * 40503)) >>> 0);
        const st = newRider(pOvr, prng, { type: protege.type, cap: aiCap, banned: nameBanned });
        st.id = protege.id; st.name = protege.name; st.type = protege.type;
        st.personality = protege.personality || st.personality;
        if (protege.abilities) st.abilities = protege.abilities;
        st.isProtege = true;
        members.push(st);
      }
      for (let i = members.length; i < memberTarget; i++) members.push(newRider(power, rng, { banned: nameBanned }));
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
        isProtege: !!r.isProtege,
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
  // v38(改善): モニュメント（丘陵/山岳の古典）は選抜性の高いハードな一日レース。集団を絞る選抜フラグを立てる。
  course.selective = !!(raceMeta.monument || raceMeta.grade >= 4);
  // v39(A案): レース中の判断カードでfromTickから再計算するため、作戦（directive）をsimに保持する
  sim.directive = { chaseMode: tac.chaseMode, aceEarly: tac.aceEarly };
  sim.difficulty = difficultyId; // v39.18: 難易度で判断カードの一手の効きを変える
  simulateTicks(course, riders, 0, sim.directive, false);
  rankSim(sim);
  // v36修正: レース後にfinishTimeを書き換えると、観戦アニメ（posHist）と着順（finishTime）が
  // 食い違い「先頭でゴールしたのにリザルト2位」等の同期ズレが起きていた。着順の書き換えは全廃し、
  // 献身の作用はすべてシミュレーション内で完結させる：(1)エースは能力ブースト＋風除け（isAssisting=
  // 消耗軽減）で勝負圏に残る、(2)アシスト本人は最終直線で流して勝負を譲る（isAssistingの最終区間
  // ハンドリング）。結果はシミュレーション（＝観戦）そのまま＝アニメと必ず一致する。
  if (assistedAceRef) {
    // 結果画面用に、献身で押し上げたエースを渡す。着順(rank)はレース中の判断カード(resumeSim)で
    // 再ランクされ得るため、結果画面側で id から最新順位を引き直す（snapshotのrankはフォールバック）。
    sim.assistedAce = { id: assistedAceRef.id, name: assistedAceRef.name, rank: assistedAceRef.rank, boost: assistedAceRef.assistBoost };
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
  // v38(#5): 高CP帯の使い道を拡充（200ptで頭打ちの解消）。既存perk枠を再利用し、周回で貯めたCPを
  // 長く注ぎ込める上位枠を用意。全買いに約1000CP必要になり、CPが「貯まりきる」感覚を解消する。
  { id: "s_rookie2", cost: 100, category: "シーズン", label: "エース級新人 確定枠（2人目）", desc: "シーズン開始時、成長ランクS確定の逸材がさらに1名加入（計2名）", season: { prodigyRookie: 1 } },
  { id: "s_equip2", cost: 95, category: "シーズン", label: "全設備 Lv+3（さらに）", desc: "フレーム・ホイールの強化レベルがさらに+3された状態でスタート", season: { equipLv: 3 } },
  { id: "s_budget2", cost: 60, category: "シーズン", label: "開幕資金 +1500万円", desc: "シーズン開始時の資金がさらに+1500万円", season: { budget: 1500 } },
  { id: "m_reroll2", cost: 80, category: "マイライフ", label: "リセマラ当たり率 特大UP", desc: "デビュー当たり特能（天啓/天賦の才）の抽選がさらに大きく上がる", mylife: { boonBonus: 0.30 } },
  { id: "m_money2", cost: 55, category: "マイライフ", label: "支度金 +700万円", desc: "デビュー時の所持金がさらに+700万円", mylife: { money: 700 } },
  { id: "x_boost2", cost: 120, category: "特別", label: "頂点の英才教育：能力ブースト（さらに）", desc: "シーズン＝全選手の能力+6／マイライフ＝デビュー時の能力+6（x_boostと重複可）", season: { rosterBoost: 6 }, mylife: { statBoost: 6 } },
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
