// マイライフの状態：init/save/load・アンビション（生き方の路線）・固定チームメイト。
// state/state.js から分離（第15弾F）。localStorageキー：roadrace_v12_mylife_save。
import { ABILITIES, TYPES } from "../data/abilities.js";
import { CLASSES } from "../data/progression.js";
import { WORLD_ROSTER_SIZE } from "../data/teams.js";
import { mulberry, pickRiderName, ridState, rollAbilities } from "../core/core.js";

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
    year: 1, month: 0, classIdx: 0, classIdxBest: 0, points: 0,
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
    // 第16弾A: 引退したライバルの記録（{name,team,type,age,year,record,heat}の配列）。
    // 現在の好敵手は引き継がれない（rival/rival2が後継）ため、回想用に別枠で保持する。
    retiredRivals: [],
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
    worldNews: [], // v51(第11弾Phase2・2-D): 年度末に生成する世界ニュース（実データベース）
    worldLeaderId: null, // 第16弾B-1: 前年の世界ランキング首位id（王者交代の検出に使う）
    ambitionIdx: 0, ambitionDone: [], ambitionPath: "victory", // v31.5: 生き方（路線）
    careerWins: 0, careerPodiums: 0, careerBigWins: 0, careerTitles: 0,
    // v32: 固定チームメイト・条件付き作戦・キャリアグラフ用の年次記録
    teammates: [], tactic: "balanced", careerHistory: [],
    // 第18弾: 僚友（チームメイト・弟子）ごとの絆 { [riderId]: number }
    bonds: {},
    // 第36弾: 専門コーチの段階（能力キーごとのLv・0=未雇用）／連続赤字月数
    coaches: {}, debtMonths: 0,
    // 第41弾: 目標バッジ宣言（キャラ作成時に選ぶ、強制力・ボーナスの無い「しおり」・最大3個）
    badgeGoals: [],
    // 第43弾: 出走計画。climb/hill/sprint/solo/null（未指定）。宣言すると通常月の候補に
    // その適性のレースが必ず1本入る（devlog/wave43.md）
    raceFocus: null,
    // 第74弾(devlog/wave74.md・TODO#27-b): 出走計画の2地形目。CPショップm_plan2購入
    // （cpFocus2）で宣言できるようになる。旧raceFocusSlots（「2本目」）は廃止——
    // マイライフは月1レースしか走れず、同じ地形の2本目には効果が無かった（実測）。
    raceFocus2: null,
    cpFocus2: false,
    // 第70弾: CPショップm_growthreveal購入時true。成長力の判明を1年目（既定3年目）へ早める。
    cpGrowthRevealEarly: false,
    // 第63弾(devlog/wave63.md): 既定をeasy→normalへ。初見が難易度の意味を理解しないまま
    // 「とりあえずデビュー」した場合、他チームが控えめすぎる易よりノーマルの方が本来の
    // バランスに近い（easyはmylife側にCP必要数のロックが無く常に選べるため、変更しても
    // 誰かの選択肢を奪わない）。
    difficulty: "normal", mlDiffChoice: "normal",
    // v51(第12弾12-C): CP交換所「パーツ強化の上限+2」。デビュー時にcpShopMylifePerks()から
    // 一度だけ適用される（既定は無購入＝0）。
    partLvMaxBonus: 0,
  };
}

export const ML_SAVE_KEY = "roadrace_v12_mylife_save";
const ML_SAVE_VERSION = "v12ml";
const ML_SAVE_FIELDS = [
  "screen", "year", "month", "classIdx", "classIdxBest", "points", "player", "team", "races", "log", "retired",
  "directive", "managerEval", "salary", "money", "partsInv", "stock", "gear", "houseLv", "carLv",
  "rival", "rivalRecord", "rival2", "rivalRecord2", "retiredRivals", "flags", "rewardedAchievements",
  // v30: 世界ランキング＆キャリア・アンビション
  "worldPoints", "worldRank", "worldRankBest", "worldNews", "worldLeaderId", "ambitionIdx", "ambitionDone", "ambitionPath",
  "careerWins", "careerPodiums", "careerBigWins", "careerTitles", "careerClassics",
  "teammates", "tactic", "careerHistory",
  "protege", // v35(逆メンター): 弟子（プロテジェ）
  "rivalDramaOn", // v36(#6): 性格ベースのライバル会話ドラマの表示 on/off
  "riderStats", // v37: 永続キャラ（ライバル/仲間）の成績台帳
  "worldRosters", // v37: 永続ワールドロースター（各AIチーム固定の選手団）
  "difficulty", // v38(#6): マイライフの難易度（相手強さ・CP倍率）
  // v49(第11弾続き): 引退時のCP付与済みフラグ。これがリスト外だとsaveMyLife()で保存しても
  // 次回読み込み時に消え、「未付与」判定に戻ってCP・殿堂を再付与できてしまう
  // （タスクキル→再読み込みでのCP無限稼ぎ・殿堂重複登録バグの直接原因だった）。
  "awardedCP",
  // v51(第12弾12-C): CP交換所「パーツ強化の上限+2」
  "partLvMaxBonus",
  "bonds", // 第18弾: 僚友ごとの絆
  "coaches", // 第36弾: 専門コーチの段階（能力キーごとのLv、0=未雇用）
  "debtMonths", // 第36弾: 連続赤字月数（赤字ペナルティの段階判定に使う）
  "badgeGoals", // 第41弾: 目標バッジ宣言（強制力・ボーナスの無い「しおり」）
  "raceFocus", // 第43弾: 出走計画（宣言した適性が通常月の候補に必ず1本入る）
  "raceFocus2", "cpFocus2", // 第74弾: 出走計画の2地形目（旧raceFocusSlotsから作り替え）
  "cpGrowthRevealEarly", // 第70弾: CPショップの成長力早期判明
  "devProject", // 第88弾: ワンオフ機材の開発（進行中プロジェクト）
  "sciProject", // 第88弾: 科学トレーニング（進行中プロジェクト）
  "sciPendingId", // 第88弾: 科学トレーニング成功・枠満杯で手放す1つを選ぶまでの保留中の報酬id
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
    // v49(第11弾続き): worldRostersが既にあるならそちらの実在ロースターから取る（新規/移籍時と
    // 同じ経路）。旧セーブがworldRostersごと欠けている場合のみ、最後の手段として
    // mlGenTeammates()のランダム生成にフォールバックする。
    if ((!merged.teammates || merged.teammates.length === 0) && merged.player && merged.team) {
      const fromRoster = mlTeammatesFromRoster(merged.worldRosters, merged.team);
      if (fromRoster.length) {
        merged.teammates = fromRoster;
      } else {
        const trng = mulberry(Date.now() % 999983 + 7);
        merged.teammates = mlGenTeammates(trng, merged.team, 5, [merged.player.name], merged.year || 1);
      }
    }
    if (!merged.tactic) merged.tactic = "balanced";
    if (!Array.isArray(merged.careerHistory)) merged.careerHistory = [];
    // 第18弾: 絆未保存の旧セーブは空から始める
    if (!merged.bonds || typeof merged.bonds !== "object") merged.bonds = {};
    // v51(第11弾Phase2): 世界ランキング実体化に伴う旧セーブ移行。riderStatsに.wp（世界ポイント）が
    // 無い＝Phase2より前のセーブと判定し、ユーザー判断どおり「自分を含め全員0から再スタート」
    // させる（旧worldPointsを残すと、他の全員が0スタートの中で自分だけ持ち点が残り継続セーブが
    // 不自然に世界上位に立ってしまうため。年度減衰があるので数年で妥当な位置に戻る）。
    const hasWp = Object.values(merged.riderStats || {}).some(r => r.wp != null);
    if (!hasWp && Object.keys(merged.riderStats || {}).length > 0) {
      merged.riderStats = {};
      merged.worldPoints = 0;
      merged.worldRank = null;
    }
    if (!Array.isArray(merged.worldNews)) merged.worldNews = [];
    // 第16弾A: 旧セーブ（retiredRivals未保存）はここで初期化。rival/rival2にageが
    // 無い旧セーブはageRival()側が26歳として扱うため、ここでの補完は不要。
    if (!Array.isArray(merged.retiredRivals)) merged.retiredRivals = [];
    // 第47弾: bloodAbilities未保存の旧セーブは、r.abilitiesの中のbreedOnly（血脈）を
    // 抜き出して補完する。装着状態は維持する（枠を超過していても遡って外さない・
    // devlog/wave47.md「既存セーブの移行」＝既存プレイヤーを黙って弱くしないため）。
    if (merged.player && !Array.isArray(merged.player.bloodAbilities)) {
      const blood = (merged.player.abilities || []).filter(id => ABILITIES[id] && ABILITIES[id].breedOnly);
      merged.player = { ...merged.player, bloodAbilities: blood };
    }
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

// v49(第11弾続き): 固定チームメイトの定員。永続ワールドロースター（WORLD_ROSTER_SIZE=12）から
// 自分の1枠を引いた11名を「実在のチームメイト」として使う（プレイヤー本人＋11＝AIチームと
// 同じ12名になる）。
export const ML_TEAMMATE_COUNT = WORLD_ROSTER_SIZE - 1;

// v49(第11弾続き): 固定チームメイトをworldRosters[teamName]から取得する。以前はmlGenTeammates()で
// 独立に生成していたが、①毎回別人が生まれ他チームの選手と顔ぶれが重ならない②年を取らず引退も
// 成長衰えもしない③移籍すると5人まるごと総入れ替えになる④自チーム分だけ`worldRosters`に
// 「使われない並行ロースター」が残り続ける、という4つの問題があった。実在するworldRostersの
// ロースター（id+年シードで安定・ageWorldRosters()で年次に加齢/成長衰え/引退/新人補充が
// 回っている）をそのままチームメイトとして使うことで、名鑑と自チームが同じデータソースになり、
// 移籍すれば「そのチームに実際にいた選手たち」が新しい仲間になる。roster側は既にbaselineの
// 降順でソート済み（エースが先頭）なので、そのままslice(0, n)で強い順に取れる。
export function mlTeammatesFromRoster(worldRosters, teamName, n = ML_TEAMMATE_COUNT) {
  const roster = worldRosters && worldRosters[teamName];
  return roster && roster.length ? roster.slice(0, n) : [];
}
