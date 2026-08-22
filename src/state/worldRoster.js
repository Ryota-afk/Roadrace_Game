// 永続ワールドロースター：全チーム固定の選手団の生成・年次加齢/引退/補充・共有ワールド。
// state/state.js から分離（第15弾F）。localStorageキー：roadrace_v12_world。
import { TYPES } from "../data/abilities.js";
import { MYLIFE_TEAMS, WORLD_ROSTER_SIZE } from "../data/teams.js";
import { mulberry, pickRiderName, ridState, rollAbilities } from "../core/core.js";

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

// 成長曲線のピーク年齢（成長力が高いほど遅咲き＝長く伸びる）。
// 第16弾C: シーズンの「他チーム動向」（seasonWorldNews）がエースの衰え判定に使うためexport。
export function growthPeakAge(growthPow) {
  return growthPow === "S" ? 29 : growthPow === "A" ? 28 : growthPow === "B" ? 27 : 26;
}
function growthStep(growthPow) {
  return growthPow === "S" ? 2.6 : growthPow === "A" ? 1.9 : growthPow === "B" ? 1.2 : 0.7;
}

// v38: 年次成長・引退で世代交代。年に一度（シーズン終わり）呼び出す。
// 各選手を1歳加齢し、ピーク前は成長・ピーク後は衰え。高齢者は引退して新人に置き換わる。
// 戻り値: { worldRosters: 更新後, retired: [{team, name, age, type, id}...], debuted: [{team, name, age, id, bloodOf}...] }
// v51(第11弾Phase2・2-D): legendPool（マイライフの殿堂選手一覧、省略可）を渡すと、
// 引退の後継ルーキーに一定確率で殿堂の血（bloodOf）を継がせる。退役したmlWorldStarsForYear
// が担っていた「殿堂の血が世界へ流入する」役割をここへ移植した。母集団が24人から
// 実際に走る300人規模に拡大したため、血統の希少感を保つ目安として旧来の40%より
// 控えめな15%を採用（Season側のageWorldRosters呼び出しはlegendPool省略＝挙動不変）。
export function ageWorldRosters(prevRosters, rng, year, teams = MYLIFE_TEAMS, legendPool) {
  const next = {};
  const retired = [];
  const debuted = [];
  const banned = new Set();
  const legs = (legendPool && legendPool.length) ? legendPool : null;
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
        retired.push({ team: d.name, name: r.name, age, type: r.type, id: r.id });
        banned.delete(r.name);
        // 新人ルーキーで補充（殿堂の血を継ぐことがある）
        const rookie = genOneWorldRider(rng, d.spec, banned, {
          age: 20 + Math.floor(rng() * 3),
          baseline: Math.round(rng() * 6 - 3),
          joinYear: year,
        });
        if (legs && rng() < 0.15) {
          const leg = legs[Math.floor(rng() * legs.length)];
          rookie.bloodOf = leg.lineageName || ((leg.name || "名家 選手").split(" ")[0] + "系");
        }
        banned.add(rookie.name);
        debuted.push({ team: d.name, name: rookie.name, age: rookie.age, id: rookie.id, bloodOf: rookie.bloodOf || null });
        out.push(rookie);
      } else {
        out.push({ ...r, age, baseline });
      }
    });
    // v46(#23): 引き抜き等で定員（WORLD_ROSTER_SIZE）を割り込んでいたら新人で埋め直す。
    // 引退時の1:1置換とは別枠＝「引き抜かれた年は手薄なまま、翌年に補充される」という
    // 戦略的な間合いは保ちつつ、恒久的に欠員が残ることは無くす。
    for (let i = out.length; i < WORLD_ROSTER_SIZE; i++) {
      const rookie = genOneWorldRider(rng, d.spec, banned, {
        age: 20 + Math.floor(rng() * 3),
        baseline: Math.round(rng() * 6 - 3),
        joinYear: year,
      });
      banned.add(rookie.name);
      debuted.push({ team: d.name, name: rookie.name, age: rookie.age, id: rookie.id, bloodOf: null });
      out.push(rookie);
    }
    out.sort((a, b) => b.baseline - a.baseline); // エースが先頭に再ソート
    next[d.name] = out;
  });
  return { worldRosters: next, retired, debuted };
}

// v46(#23): 定員（WORLD_ROSTER_SIZE）に満たないチームへ、末尾に新人を追記するだけの関数。
// 既存メンバーの並び順・identityには一切触れない（sharedWorldRosters()が「同じseedなら
// 同じ顔ぶれ」であり続けるという不変条件を壊さないため、genWorldRosters()のcountを
// 直接引き上げることはしない＝実測でcountを変えると生成列そのものがずれ全チームの
// 顔ぶれが変わることを確認済み）。追記された新人は控え選手として温存され、ロースターが
// 摩耗した際（主に引き抜き後）に繰り上がる。
export function topUpWorldRosters(rosters, rng, teams = MYLIFE_TEAMS) {
  const next = { ...rosters };
  const banned = new Set();
  Object.values(rosters || {}).forEach(list => (list || []).forEach(r => banned.add(r.name)));
  teams.forEach(d => {
    const cur = next[d.name] || [];
    if (cur.length >= WORLD_ROSTER_SIZE) return;
    const added = [...cur];
    for (let i = cur.length; i < WORLD_ROSTER_SIZE; i++) {
      const r = genOneWorldRider(rng, d.spec, banned, { baseline: Math.round(rng() * 6 - 3) });
      banned.add(r.name);
      added.push(r);
    }
    // v49(第11弾続き): 追記した控え選手のbaselineが、既存メンバーの下位より高いことがあり得るため
    // 再ソートする（identityや個々のbaseline値は変えない、並び順だけの整理）。genWorldRosters()/
    // ageWorldRosters()は末尾で既に同じソートをしており、ここだけ抜けていた。「先頭＝最強」という
    // 前提でslice(0, N)している呼び出し側（出走メンバー選出・第11弾続きのチームメイト選出）の
    // 正しさをこの関数でも揃える。
    added.sort((a, b) => b.baseline - a.baseline);
    next[d.name] = added;
  });
  return next;
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
  // v46(#23): 初期定員(6名)を8名まで拡張。genWorldRosters自体のcountを直接8にすると
  // 生成列がずれて既存セーブの顔ぶれが総入れ替わりになる（実測で確認済み）ため、
  // 独立したrngストリームで追記するtopUpWorldRosters()を使う。
  rosters = topUpWorldRosters(rosters, mulberry((m.seed ^ 0x5bd1e995) >>> 0), MYLIFE_TEAMS);
  for (let y = 2; y <= m.year; y++) {
    rosters = ageWorldRosters(rosters, mulberry((y * 2246822519) >>> 0), y, MYLIFE_TEAMS).worldRosters;
  }
  if (teams === MYLIFE_TEAMS) return rosters;
  const sub = {};
  teams.forEach(d => { if (rosters[d.name]) sub[d.name] = rosters[d.name]; });
  return sub;
}
