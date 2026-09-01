// ヘッドレス・キャリアシミュレータ。設計は devlog/wave92.md 参照。
//
// マイライフの純粋なreducerを直接呼んでキャリアを最後まで進め、統計を出す。
// ブラウザ・DOMは一切使わない。15年キャリアが約1分（tools/autoplay.mjsはレース1本の
// 演出だけで実時間20分）。⚠️設計時点の見積もり「1.6秒/40年」は年1本目の軽いコースだけを
// 測った誤りで、実際は`buildMyLifeSim`がコース距離に応じて300〜600ms/本かかる
// （詳細はdevlog/wave92.md「実装で判明した修正」）。
//
// ⚠️レース結果は buildMyLifeSim() を呼んだ時点で確定している（sim/buildMyLifeSim.js
// 264-265行の simulateTicks+rankSim）。RaceView.jsx の33ms tickは、既に決まっている
// 結果を再生しているだけの演出なので、ここでは一切再現しない。
//
// 【使い方】
//   node tools/simcareer.mjs --out /tmp/sim                          # 既定=20キャリア×15年
//   node tools/simcareer.mjs --careers 1 --policy frugal --verbose   # 1本だけ詳しく見る
//   node tools/simcareer.mjs --careers 100 --years 40 --out /tmp/sim # 深く見たい時（数時間規模）
//
// 【方策（policy）は必ず2つ以上を回して両方報告する】
// ⚠️第89弾の誤りは方策を1つ（資金を使わない）しか用意しなかったことだった。frugalと
// spenderの差がそのまま「プレイヤーの選択の幅」であり、それが無ければシンクは機能して
// いないことになる（第90弾で確認した「7,507万 vs 55万」がまさにこれ）。
import fs from "node:fs";
import path from "node:path";

const R = path.resolve(new URL(".", import.meta.url).pathname, "..", "src");

const { initMyLife } = await import(`${R}/state/mylifeState.js`);
const { mlCreateChar } = await import(`${R}/domain/mylife/createChar.js`);
const { mlAdvanceMonth } = await import(`${R}/controllers/mylife/month.js`);
const { mlRaceFinish, mlLastRaceFinish } = await import(`${R}/controllers/mylife/result.js`);
const {
  mlResolveEvent, mlResolveProtegeEvent, mlResolveRivalScene, mlRivalSceneContinue,
} = await import(`${R}/controllers/mylife/event.js`);
const {
  mlRetireAdviceContinue, mlChooseTeam, mlResolveOffseason, mlContinueAfterOffseason,
  mlResolveCrossroads, mlContinueAfterCrossroads,
} = await import(`${R}/controllers/mylife/career.js`);
const {
  mlStartDevProject, mlAddDevProject, mlFinishDevProject,
  mlStartSciProject, mlAddSciProject, mlFinishSciProject, mlSciConfirmSwap,
  mlBuyHouse, mlBuyCar, mlBuyGear, mlHireCoach, mlBuyPart, mlSetPart, mlUpgradePart,
} = await import(`${R}/controllers/mylife/shop.js`);
const { mlSelectedRace } = await import(`${R}/domain/mylife/race.js`);
const { resolveNationalRole } = await import(`${R}/controllers/mylife/raceStart.js`);
const { buildMyLifeSim } = await import(`${R}/sim/buildMyLifeSim.js`);
const { protegeState, mlBadgeKind } = await import(`${R}/logic/support.js`);
const { mlProjectMonthsElapsed } = await import(`${R}/domain/mylife/growthCap.js`);
const {
  ML_DEV_PROJECT, ML_SCI_PROJECT, ML_HOUSES, ML_CARS, ML_GEAR, ML_AB_COACH_KEY,
  ML_PART_UPGRADE_COST, ML_PART_LV_MAX, ML_COACH_SIGNING, ML_COACH_MAX_BY_CLASS,
} = await import(`${R}/data/gear.js`);
const { PART_SLOTS, PARTS } = await import(`${R}/data/parts.js`);
const { ML_SALARY_CAP } = await import(`${R}/data/economy.js`);

// ---------------------------------------------------------------------------
// 引数
const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const N_CAREERS = Number(arg("--careers", "20"));
const OUT = arg("--out", null);
const MAX_STEPS = Number(arg("--steps", "20000")); // 安全弁。--yearsで先に止まるのが通常経路
const MAX_YEARS = Number(arg("--years", "15"));
const ONLY_POLICY = arg("--policy", null); // 指定時はそのpolicyだけ回す（デバッグ用）
const VERBOSE = process.argv.includes("--verbose");
if (OUT) fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// mlStartRace の再実装。
// ⚠️これはuseMyLifeGame.js内にreducerとしてexportされておらず、フックの中に直に
// 書かれているクロージャなので、同じロジックを純粋関数としてここに複製する
// （src/側は一切変更しない。手順はsrc/hooks/useMyLifeGame.jsのmlStartRaceと同一）。
function mlStartRace(s) {
  const baseDirectiveKey = s.directive ? s.directive.key : null;
  const selectedRace = mlSelectedRace(s);
  const { race, directiveKey } = resolveNationalRole(selectedRace, s.managerEval, baseDirectiveKey);
  const protegeForRace = s.protege ? { ...s.protege, curOvr: protegeState(s.protege, s.year).ovr } : null;
  const sim = buildMyLifeSim(race, s.player, s.team, s.classIdx, s.difficulty || "easy", undefined, directiveKey, s.rival, s.year, s.rival2, s.teammates, s.tactic, s.worldRosters, protegeForRace, s.bonds);
  return {
    ...s,
    races: race !== selectedRace ? s.races.map(r => r.id === selectedRace.id ? race : r) : s.races,
    sel: { ...s.sel, raceId: race.id },
    result: sim, screen: "mylife_startlist",
  };
}

// mlConfirmBadgeGoals の再実装（同じ理由。raceFocusは方策側で一切設定しないため、
// 「まだ1戦も走っていない」の分岐は常にfalseへ倒れ、実質 screen: "mylife_main" だけになる）。
function confirmBadgeGoals(s) {
  return { ...s, screen: "mylife_main" };
}

// ---------------------------------------------------------------------------
// 方策（policy）：state を受け取り、月ごとの資金の使い道（シンク）を決める。
// main画面での行動（何を練習するか等）は両policy共通で「毎月レースに出る」に固定する
// （tools/autoplay.mjsの実測と比較可能にするため。第90・91弾の数字はこの前提で出している）。
function frugalSinks(s) { return s; } // 資金の使い道は一切使わない＝上振れ側の計測

function spenderSinks(s, rng) {
  // ⚠️tools/autoplay.mjsの優先順位（完成/結果を見る → 追加投資 → 新規開始）を踏襲する。
  // 押せる中で常に最大額を選ぶ「使えるだけ使う」極端側の計測である点に注意。
  if (s.sciPendingId) {
    const cand = (s.player.abilities || []).find(hid => mlBadgeKind(hid) !== "taishitsu");
    if (cand) s = mlSciConfirmSwap(s, cand);
  }
  if (s.sciProject) {
    const p = s.sciProject;
    const elapsed = mlProjectMonthsElapsed(p, s.year, s.month);
    if (elapsed >= ML_SCI_PROJECT.minMonths) s = mlFinishSciProject(s);
    else { const amt = ML_SCI_PROJECT.addCosts[1]; if (s.money >= amt) s = mlAddSciProject(s, amt); }
  } else if (!s.sciPendingId && s.money >= ML_SCI_PROJECT.initCost) {
    s = mlStartSciProject(s);
  }
  if (s.devProject) {
    const p = s.devProject;
    const elapsed = mlProjectMonthsElapsed(p, s.year, s.month);
    if (elapsed >= ML_DEV_PROJECT.minMonths) s = mlFinishDevProject(s);
    else { const amt = ML_DEV_PROJECT.addCosts[1]; if (s.money >= amt) s = mlAddDevProject(s, amt); }
  } else if (s.money >= ML_DEV_PROJECT.initCost) {
    const slot = PART_SLOTS[Math.floor(rng() * PART_SLOTS.length)];
    s = mlStartDevProject(s, slot, rng() < 0.5 ? "broad" : "sharp");
  }
  return s;
}

// 第94弾(devlog/wave94.md P2): 恒久的なもの（住居・車・練習用品・コーチ・パーツ本体・
// パーツ強化）を買えるだけ買う方策。⚠️既存のfrugal/spenderはパーツも住居もコーチも
// 一度も買わないため、「恒久的な使い道が何年目に尽きるか」を実挙動として測れなかった
// （第93弾の11,720万はdata/から機械的に合計した値で、実際に買う挙動は未計測だった）。
function builderSinks(s) {
  if (s.houseLv + 1 < ML_HOUSES.length && s.money >= ML_HOUSES[s.houseLv + 1].price) s = mlBuyHouse(s);
  if (s.carLv + 1 < ML_CARS.length && s.money >= ML_CARS[s.carLv + 1].price) s = mlBuyCar(s);
  ["roller", "monitor", "chef"].forEach(k => {
    if (!s.gear[k] && s.money >= ML_GEAR[k].price) s = mlBuyGear(s, k);
  });
  // 同時雇用枠（クラス別1/2/3）の範囲で契約金を払い、既に雇用中のコーチは毎月無料でLv上昇する
  Object.keys(ML_AB_COACH_KEY).forEach(key => { s = mlHireCoach(s, key); });
  // パーツ：各スロット未装着なら買えるうち最上位tierを購入・装着し、装着中は上限まで強化する
  PART_SLOTS.forEach(slot => {
    if (!s.player.parts?.[slot]) {
      const cands = Object.entries(PARTS).filter(([, p]) => p.slot === slot && p.tier <= s.classIdx + 1);
      if (cands.length) {
        const [pid, part] = cands.reduce((a, b) => (b[1].tier > a[1].tier ? b : a));
        if (s.money >= part.price) { s = mlBuyPart(s, pid); s = mlSetPart(s, slot, pid); }
      }
    }
    const lv = s.player.partLv?.[slot] || 0;
    const maxLv = ML_PART_LV_MAX + (s.partLvMaxBonus || 0);
    if (s.player.parts?.[slot] && lv < maxLv && s.money >= ML_PART_UPGRADE_COST[lv]) s = mlUpgradePart(s, slot);
  });
  return s;
}

const POLICIES = {
  frugal: { maintainSinks: frugalSinks },
  spender: { maintainSinks: spenderSinks },
  builder: { maintainSinks: builderSinks },
};

// 決定的な乱数（シンクのスロット選択・開発方針の抽選にのみ使う。第92弾時点ではキャリア
// 生成そのもの（mlCreateChar等）はDate.now()由来のままで再現しない。devlog/wave92.md
// 「この設計で解決しないこと」参照——初版は本数で殴る）。
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 不変条件アサーション（devlog/wave92.md §4）。破れたら理由付きで記録するが、
// キャリア自体は止めない（1件の違反で残り39年分の観測を捨てるのは高くつく）。
function checkInvariants(s, violations, careerId) {
  const when = `${s.year}年${(s.month ?? 0) + 1}月目`;
  // A1: 年俸は所属クラスの上限を超えない
  if (s.salary != null && s.salary > ML_SALARY_CAP[s.classIdx]) {
    violations.push(`[career${careerId}] ${when} A1違反: salary=${s.salary} > CAP[${s.classIdx}]=${ML_SALARY_CAP[s.classIdx]}`);
  }
  // A2: 人気度は0〜100の範囲内（範囲チェックのみ。100張り付き率はサマリー側で統計的に見る）
  const pop = s.player?.popularity;
  if (pop != null && (pop < 0 || pop > 100)) {
    violations.push(`[career${careerId}] ${when} A2違反: popularity=${pop} が[0,100]の範囲外`);
  }
  // A3: 資金がマイナスのまま12ヶ月以上続かない
  if (s.money < 0) {
    s.__negMoneyStreak = (s.__negMoneyStreak || 0) + 1;
    if (s.__negMoneyStreak === 12) violations.push(`[career${careerId}] ${when} A3違反: 資金マイナスが12ヶ月連続`);
  } else {
    s.__negMoneyStreak = 0;
  }
  // ⚠️A4（成長キャップ超過）は削除した。実測でclimb/flatが常時cap超過（時にはcapの
  // 1.3倍近く）していたので不具合を疑ったが、domain/mylife/growthCap.js:49-50に
  // 明文の設計意図があった：「上限を下げても既存キャラの能力値は下がらない（addAbは
  // 超過分の伸びが急減衰するだけでクランプはしないため）」。つまりcapは減速する
  // ソフトな目安であり、player[k] > cap は常態としてあり得る——ハード上限ではない。
  // A4は存在しない不変条件をチェックしていた（n=20実測でA1〜A3=0件に対しA4だけ
  // 5,252件を検出し、この設計上の誤りが発覚した）。第33・36弾の「早期カンスト」は
  // 「capの計算式自体が積み増しで際限なく伸びる」問題であり、性質が異なる別の
  // チェックが要る（cap算出式の構成要素の増え方を見る等）。今回は実装しない
  // ——DEVLOG「次のアクション」から#28を撤回し、この節に経緯を残す。
}

// ---------------------------------------------------------------------------
// 1ステップ進める。screenに対応するreducerを呼んで次のstateを返す。
// ⚠️表に無いscreenが来たら黙って読み飛ばさず、その場で例外を投げて止める
// （devlog/wave92.md：寛容さは誤った計測を生む。第89弾のハーネスが「押せるボタンが
// 無ければ待つ」という寛容な作りだったため、シーズンモードへ迷い込んだまま計測を続けた）。
function step(s, policy, rng) {
  switch (s.screen) {
    case "mylife_scout": return { ...s, screen: "mylife_badge_goals" };
    case "mylife_badge_goals": return confirmBadgeGoals(s);
    case "mylife_main": {
      const withSinks = policy.maintainSinks(s, rng);
      return mlStartRace(withSinks);
    }
    case "mylife_startlist": {
      const soloTT = s.result.teamTT || s.result.raceMeta?.tmpl?.soloTT;
      return soloTT ? mlRaceFinish(s) : { ...s, screen: "mylife_race" };
    }
    case "mylife_race": return s.inLastRace ? mlLastRaceFinish(s) : mlRaceFinish(s);
    case "mylife_result": {
      const ri = s.resultInfo;
      if (ri?.rivalOutcome?.scene) return { ...s, rivalSceneReply: null, screen: "mylife_rival_scene" };
      if (ri?.newspaper) return { ...s, screen: "mylife_newspaper" };
      return mlAdvanceMonth(s, "race");
    }
    case "mylife_rival_scene": {
      if (!s.rivalSceneReply) {
        const sc = s.resultInfo.rivalOutcome.scene;
        const fireIdx = sc.responses.findIndex(r => r.tone === "fire");
        return mlResolveRivalScene(s, fireIdx >= 0 ? fireIdx : 0);
      }
      return mlRivalSceneContinue(s);
    }
    case "mylife_newspaper": return mlAdvanceMonth(s, "race");
    case "mylife_event": return mlResolveEvent(s, 0);
    case "mylife_event_result":
      return s.eventAdvanced ? { ...s, eventAdvanced: false, screen: "mylife_main" } : mlAdvanceMonth(s, "event");
    case "mylife_protege_event": return mlResolveProtegeEvent(s, 0);
    case "mylife_contract": return mlChooseTeam(s, s.contractOffers[0]); // 常に残留オファー
    case "mylife_retire_advice": return mlRetireAdviceContinue(s); // 自ら引退しない（現行の主ボタン挙動を踏襲）
    case "mylife_offseason": return mlResolveOffseason(s, 0);
    case "mylife_offseason_result": return mlContinueAfterOffseason(s);
    case "mylife_crossroads": return mlResolveCrossroads(s, 0);
    case "mylife_crossroads_result": return mlContinueAfterCrossroads(s);
    case "mylife_retired": return null; // キャリア終了
    default:
      throw new Error(`未知のscreen「${s.screen}」。ディスパッチ表(tools/simcareer.mjs)に追加が必要。`);
  }
}

// 第94弾P2(devlog/wave94.md): 恒久的な使い道に使った総額を最終状態から逆算する。
// 毎月の差分を追わなくても、最終Lv・所持状態から一意に決まる（各段階の価格は
// 累進的に確定しているため）。第93弾の11,720万＝data/から機械計算した「理論上の
// 総額」に対し、こちらは方策が実際に買った額の実測値（tools/money_demand.mjsと対）。
function finiteSpend(s) {
  let total = 0;
  for (let i = 0; i <= s.houseLv; i++) total += ML_HOUSES[i].price;
  for (let i = 0; i <= s.carLv; i++) total += ML_CARS[i].price;
  ["roller", "monitor", "chef"].forEach(k => { if (s.gear[k]) total += ML_GEAR[k].price; });
  Object.keys(ML_AB_COACH_KEY).forEach(key => { if ((s.coaches?.[key] || 0) > 0) total += ML_COACH_SIGNING; });
  PART_SLOTS.forEach(slot => {
    const pid = s.player?.parts?.[slot];
    if (pid && PARTS[pid]) total += PARTS[pid].price; // 一点物はprice無し＝加算されない
    const lv = s.player?.partLv?.[slot] || 0;
    for (let i = 0; i < lv; i++) total += ML_PART_UPGRADE_COST[i] || 0;
  });
  return total;
}

// 恒久的な使い道をすべて買い切ったか（住居・車・練習用品・コーチ・パーツ強化が
// すべて上限）。「買うものが無くなって資金が余り始める年」を実挙動で特定するために使う。
function isFiniteSaturated(s) {
  const maxLv = ML_PART_LV_MAX + (s.partLvMaxBonus || 0);
  const partsMaxed = PART_SLOTS.every(slot => (s.player?.partLv?.[slot] || 0) >= maxLv && s.player?.parts?.[slot]);
  const gearDone = ["roller", "monitor", "chef"].every(k => s.gear[k]);
  const coachMax = ML_COACH_MAX_BY_CLASS[s.classIdx] ?? 0;
  const coachDone = Object.keys(ML_AB_COACH_KEY).every(key => (s.coaches?.[key] || 0) >= coachMax);
  return s.houseLv >= ML_HOUSES.length - 1 && s.carLv >= ML_CARS.length - 1 && gearDone && coachDone && partsMaxed;
}

// ---------------------------------------------------------------------------
function runOneCareer(policyName, careerId, seed) {
  const rng = mulberry32(seed);
  const cpMeta = { totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] };
  let s = mlCreateChar(initMyLife(), "RUL", "university", null, null, cpMeta);
  const policy = POLICIES[policyName];
  const violations = [];
  const yearly = []; // {year, pop, money, salary, classIdx, worldRank}
  let lastYear = s.year;
  let steps = 0;
  let saturatedYear = null; // 恒久的な使い道をすべて買い切った最初の年（第94弾P2）
  for (; steps < MAX_STEPS; steps++) {
    // SIM_DEBUG=1で進捗を可視化できる（1キャリアが数十秒〜数分かかるため、固まったのか
    // 実行中なのか外から見分けられないと困る。tools/autoplay.mjsのログ全部書きと同じ理由）。
    if (process.env.SIM_DEBUG && steps % 50 === 0) console.error(`t=${Date.now()} step=${steps} screen=${s.screen} year=${s.year}`);
    checkInvariants(s, violations, careerId);
    if (saturatedYear == null && isFiniteSaturated(s)) saturatedYear = s.year;
    if (s.year !== lastYear) {
      yearly.push({ year: lastYear, pop: s.player?.popularity ?? 0, money: s.money, salary: s.salary, classIdx: s.classIdx, worldRank: s.worldRank, age: s.player?.age });
      lastYear = s.year;
      // ⚠️自ら引退しない方策（mlRetireAdviceContinueを常に選ぶ）なのでmylife_retiredには
      // 到達しない。--yearsで打ち切るのが通常の終了経路（devlog/wave92.md実測：
      // 1レースのbuildMyLifeSimが実測300〜600ms/本かかり、40年通すと1キャリア数分規模になる
      // ため、既定は15年で打ち切る。深く見たい時は--yearsを上げて個別に流す）。
      if (s.year > MAX_YEARS) { s = { ...s, __stoppedBy: "years" }; break; }
    }
    if (s.screen === "mylife_retired") { s = { ...s, __stoppedBy: "retired" }; break; }
    const next = step(s, policy, rng);
    if (next === null) { s = { ...s, __stoppedBy: "retired" }; break; }
    s = next;
  }
  // ⚠️stepsがMAX_STEPSの安全弁に達したのに指定年数へ届いていない＝月送りが異常に
  // 足踏みしている可能性がある（本来は毎月レースに出るだけなので数ステップ/月のはず）
  const stoppedBy = s.__stoppedBy || (steps >= MAX_STEPS ? "steps" : "unknown");
  return {
    policyName, careerId, steps, stoppedBy, violations, yearly, finalYear: s.year, finalAge: s.player?.age,
    saturatedYear, finiteSpendTotal: finiteSpend(s),
  };
}

// ---------------------------------------------------------------------------
function median(arr) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function summarizePolicy(results) {
  const allViolations = results.flatMap(r => r.violations);
  const stepsExhausted = results.filter(r => r.stoppedBy === "steps").length;
  // 年ごとの中央値（1〜30年目まで。個体差で到達年数が違うため年ごとに集計可能な分だけ使う）
  const byYear = {};
  results.forEach(r => r.yearly.forEach(y => {
    (byYear[y.year] ||= []).push(y);
  }));
  const yearRows = Object.keys(byYear).map(Number).sort((a, b) => a - b)
    .filter(y => [1, 5, 10, 15, 20, 30, 40].includes(y))
    .map(y => {
      const rows = byYear[y];
      return {
        year: y, n: rows.length,
        popMedian: median(rows.map(r => r.pop)).toFixed(1),
        moneyMedian: median(rows.map(r => r.money)),
        salaryMedian: median(rows.map(r => r.salary)),
      };
    });
  // 人気度100張り付き率（統計的な不変条件A2の本体。devlog/wave92.md参照）
  const allMonths = results.flatMap(r => r.yearly);
  const pinned = allMonths.filter(y => y.pop >= 100).length;
  const pinnedRate = allMonths.length ? (pinned / allMonths.length * 100) : 0;
  // 第94弾P2: 恒久的な使い道の実測（builder方策の基準値取り用。他方策でも一応出す）
  const satYears = results.map(r => r.saturatedYear).filter(y => y != null);
  const saturatedMedianYear = satYears.length ? median(satYears) : null;
  const saturatedRate = results.length ? (satYears.length / results.length * 100) : 0;
  const finiteSpendMedian = median(results.map(r => r.finiteSpendTotal));
  return {
    careers: results.length, stepsExhausted, violationCount: allViolations.length, violations: allViolations,
    yearRows, pinnedRate, monthCount: allMonths.length,
    saturatedMedianYear, saturatedRate, finiteSpendMedian,
  };
}

// ---------------------------------------------------------------------------
const policyNames = ONLY_POLICY ? [ONLY_POLICY] : Object.keys(POLICIES);
const report = {};
// ⚠️1キャリアが数十秒〜数分かかるため、標準出力をファイルへリダイレクトすると
// バッファリングで最後まで何も見えなくなる（tools/autoplay.mjsで踏んだのと同じ問題）。
// --outがあれば進捗を毎キャリアごとファイルへ書く。
const progressPath = OUT ? `${OUT}/progress.txt` : null;
if (progressPath) fs.writeFileSync(progressPath, `開始: ${new Date().toISOString()}\n`);
for (const policyName of policyNames) {
  const results = [];
  for (let i = 0; i < N_CAREERS; i++) {
    const r = runOneCareer(policyName, i, 1000 + i);
    results.push(r);
    const line = `[${policyName}] career${i}: ${r.steps}ステップ・${r.finalYear}年目・${r.finalAge}歳・違反${r.violations.length}件（終了理由:${r.stoppedBy}）`;
    if (VERBOSE) console.log(line);
    if (progressPath) fs.appendFileSync(progressPath, line + "\n");
  }
  report[policyName] = summarizePolicy(results);
}

// ---------------------------------------------------------------------------
let md = `# キャリアシミュレータ実行結果\n\n`;
md += `キャリア数: ${N_CAREERS} / 方策: ${policyNames.join(", ")}\n\n`;
for (const p of policyNames) {
  const r = report[p];
  md += `## 方策: ${p}\n\n`;
  md += `${r.careers}本中、指定年数(${MAX_YEARS}年)まで到達 ${r.careers - r.stepsExhausted}本 / ステップ上限で打ち切り ${r.stepsExhausted}本 / 不変条件違反 ${r.violationCount}件\n\n`;
  md += `⚠️人気度が100に張り付いた月の割合: **${r.pinnedRate.toFixed(1)}%**（全${r.monthCount}ヶ月中）\n\n`;
  md += `| 年目 | サンプル数 | 人気度(中央値) | 資金(中央値) | 年俸(中央値) |\n|---|---|---|---|---|\n`;
  r.yearRows.forEach(y => { md += `| ${y.year} | ${y.n} | ${y.popMedian} | ${y.moneyMedian}万 | ${y.salaryMedian}万 |\n`; });
  md += `\n`;
  // 第94弾P2: 恒久的な使い道の実測
  md += `恒久的な使い道（住居・車・練習用品・コーチ・パーツ本体・パーツ強化）を買い切った本数: `
    + `${r.saturatedRate.toFixed(0)}%（${r.saturatedMedianYear != null ? `到達した本の中央値=${r.saturatedMedianYear}年目` : "指定年数内に到達なし"}）\n\n`;
  md += `実際に使った額の中央値（最終時点）: ${r.finiteSpendMedian != null ? r.finiteSpendMedian.toLocaleString() : "—"}万\n\n`;
}
md += `## 不変条件違反の一覧\n\n`;
const allV = policyNames.flatMap(p => report[p].violations);
if (allV.length === 0) {
  md += `⚠️0件（CLAUDE.md §10：動かなかったことも書く）。\n`;
} else {
  md += allV.slice(0, 200).map(v => `- ${v}`).join("\n") + (allV.length > 200 ? `\n…他${allV.length - 200}件` : "") + "\n";
}

console.log(md);
if (OUT) {
  fs.writeFileSync(`${OUT}/summary.md`, md);
  fs.writeFileSync(`${OUT}/violations.txt`, allV.length ? allV.join("\n") : "0件（違反なし）");
  console.log(`\n書き出し: ${OUT}/summary.md, ${OUT}/violations.txt`);
}
