// 判断カードの選択肢EV計測（第95弾 #31-D）。
// マイライフのレース中「判断カード」（RaceView.jsxのdecisions/composeCard）は着順を実際に
// 動かす中心機構だが、これまで一度も選択肢ごとの期待値（EV）を測っていなかった。
// 「どの一手が実際に得か」が分からないまま、CLAUDE.md §0の「意味のある判断」を
// 主張することはできない。
//
// 【手法】buildMyLifeSim() で1レースぶんのsimを作り、同一の判断地点から各選択肢を
// フォーク（分岐）してΔ着順を比較する。
//   ⚠️sim.course は関数（(frac)=>frac*LEN 等）を含み structuredClone できない。
//   resumeSim() が sim.course を変更しないことを実測で確認済みなので、course は
//   共有し、entrants だけ深クローンする：{ ...sim, entrants: sim.entrants.map(structuredClone) }。
//   これで元のsimを一切汚さず何度でも同じ地点からフォークできる（乱数の再現性は不要）。
//
// 【使い方】
//   node tools/decisioncard_ev.mjs                          # 既定=5脚質×easy/hard×40人
//   node tools/decisioncard_ev.mjs --types RUL --diffs easy --chars 40 --verbose
//   node tools/decisioncard_ev.mjs --out /tmp/ev
//   node tools/decisioncard_ev.mjs --ability 100 --class 2  # 円熟期（能力100・PRO）
//
// 【第一次計測（devlog/wave95.md §4.5）との違い】
// 第一次はRUL・キャリア開始時のみだった。本ツールは脚質を選べるようにした恒久版。
// ⚠️キャリア中盤/後半（バッジ所持後）の再測定は別課題（TODO #31-D残作業②）——
// mlAdvanceMonth等で月を進める土台がもう1段要るため、本ツールのスコープ外のまま残す。
//
// 【#31-D-2（devlog/wave95.md §4.5c/d）の是正後の検証で追加】
// finaleカードは「脚が十分なら踏む・苦しければ溜める」判断になった（kick/kickBigに
// KICK_ENERGY_COST/KICKBIG_ENERGY_COSTを課し、3択目をhold→conserveへ）。
// 判断時点の実エネルギー（me.energyHist、RaceView.jsxのctx.energy算出と同じ読み方）を
// DecisionCard.jsxのlegsTierと同じ4段階で層別し、finaleカードだけ段階別の表を出す。
// 合格条件：①脚「十分」層でkick/kickBigがconserveを上回る ②「苦しい/限界」層で
// conserveがkick/kickBigを上回る ③どの層でも両軸を支配する一手が無い。
import path from "node:path";
import fs from "node:fs";

const R = path.resolve(new URL(".", import.meta.url).pathname, "..", "src");
const { initMyLife } = await import(`${R}/state/mylifeState.js`);
const { mlCreateChar } = await import(`${R}/domain/mylife/createChar.js`);
const { buildMyLifeSim } = await import(`${R}/sim/buildMyLifeSim.js`);
const { resumeSim } = await import(`${R}/sim/race.js`);
const { buildDecisions, composeCard } = await import(`${R}/domain/shared/raceDecisions.js`);
const { AB_KEYS } = await import(`${R}/data/abilities.js`);

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const TYPES = arg("--types", "RUL,SPR,CLM,PUN,TT").split(",");
const DIFFS = arg("--diffs", "easy,hard").split(",");
const CHARS = Number(arg("--chars", "40"));
// 第96弾§7.8(TODO #32-f): キャリア時期を選べるようにする。既定は従来どおり
// 「新人のまま・そのキャラのクラス」＝キャリア開始時。
// ⚠️finaleカードの設計意図（脚が残っていれば踏む）が効くのは能力が育った後であり、
// 既定値だけでは最も肝心な円熟期を測れない（第95弾のEV計測はここを測っていなかった）。
//   --ability 100 --class 2   … 円熟期（能力平均100）をクラスPROで
const ABILITY = arg("--ability", null) != null ? Number(arg("--ability", null)) : null;
const CLASSIDX = arg("--class", null) != null ? Number(arg("--class", null)) : null;
const VERBOSE = process.argv.includes("--verbose");
const OUT = arg("--out", null);
if (OUT) fs.mkdirSync(OUT, { recursive: true });

function segTypeAt(course, frac) {
  for (let i = 0; i < course.segs.length; i++) if (frac <= course.cumFrac[i]) return course.segs[i].type;
  return course.segs[course.segs.length - 1].type;
}

// DecisionCard.jsxのlegsTierと同じ境界（十分/やや消耗/苦しい/限界）。
function legsTier(energy) {
  const e = Math.max(-100, Math.min(100, energy ?? 100));
  return e >= 40 ? "十分" : e >= 0 ? "やや消耗" : e >= -60 ? "苦しい" : "限界";
}

// 能力の平均を目標値へ揃える（tools/difficulty_check.mjsと同じ手法）。
function scaleTo(p, t) {
  const cur = AB_KEYS.reduce((a, k) => a + (p[k] || 0), 0) / AB_KEYS.length;
  AB_KEYS.forEach(k => { p[k] = (p[k] || 0) * (t / cur); });
  return p;
}

function newChar(type) {
  const s = mlCreateChar(initMyLife(), type, "university", null, null, { totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] });
  if (ABILITY != null) scaleTo(s.player, ABILITY);
  return s;
}

// 1脚質×1難易度ぶんを計測する。戻り値: { baseline: {n,meanRank,winPct,podiumPct}, cards: {kind/move: {...}} }
function measure(type, diff, nChars) {
  const baseRanks = [];
  const acc = {}; // "kind/move" -> {n, dsum, wins, top3}
  const tierAcc = {}; // finaleのみ: "tier/move" -> {n, dsum, wins, top3}
  const rec = (bucket, kind, move, delta, rank) => {
    const k = `${kind}/${move}`;
    bucket[k] = bucket[k] || { n: 0, dsum: 0, wins: 0, top3: 0 };
    const a = bucket[k];
    a.n++; a.dsum += delta; if (rank === 1) a.wins++; if (rank <= 3) a.top3++;
  };
  let races = 0;
  for (let c = 0; c < nChars; c++) {
    const s = newChar(type);
    const list = s.races.filter(r => !(r.tmpl && (r.tmpl.teamTT || r.tmpl.soloTT)));
    for (const race of list) {
      const sim = buildMyLifeSim(race, s.player, s.team, CLASSIDX ?? s.classIdx, diff, undefined, null,
        s.rival, s.year, s.rival2, s.teammates, s.tactic, s.worldRosters, null, s.bonds);
      if (!sim.entrants) continue;
      // ⚠️第96弾: ここは長らく `find(e => e.isPlayer) || sim.entrants[0]` だった。
      // entrant側の実フィールドは isPlayerChar（buildMyLifeSim.js）で isPlayer は存在せず、
      // find は常に失敗して sim.entrants[0]＝AI選手（プレイヤーは添字30前後）を掴んでいた。
      // ＝第95弾のEV計測はすべて「AI選手に、プレイヤーの手を適用した」結果だった。
      const me = sim.entrants.find(e => e.isPlayerChar);
      if (!me) continue;
      if (!me.posHist || me.posHist.length < 60) continue;
      const base = me.rank;
      baseRanks.push(base);
      const decs = buildDecisions(sim.course, me, false).filter(d => d.at != null);
      for (const dec of decs) {
        const frac = dec.at;
        const fromTick = Math.floor(frac * me.posHist.length);
        // RaceView.jsxのctx.energy算出と同じ読み方（判断直前tickの実エネルギー）
        const realEnergy = me.energyHist[Math.min(fromTick - 1, me.energyHist.length - 1)] ?? 100;
        const ctx = { manager: false, segType: segTypeAt(sim.course, frac), frac, energy: realEnergy, mates: 2, inBreak: false };
        const card = composeCard(dec.kind, me, ctx);
        const tier = legsTier(realEnergy);
        for (const ch of card.choices) {
          const forked = { ...sim, entrants: sim.entrants.map(e => structuredClone(e)) };
          resumeSim(forked, fromTick, me.id, ch.move);
          const r = forked.entrants.find(e => e.id === me.id).rank;
          rec(acc, dec.kind, ch.move, r - base, r);
          if (dec.kind === "finale") rec(tierAcc, tier, ch.move, r - base, r);
        }
      }
      races++;
    }
  }
  baseRanks.sort((a, b) => a - b);
  const n = baseRanks.length;
  const baseline = n ? {
    n, meanRank: +(baseRanks.reduce((a, b) => a + b, 0) / n).toFixed(2),
    winPct: +(100 * baseRanks.filter(r => r === 1).length / n).toFixed(0),
    podiumPct: +(100 * baseRanks.filter(r => r <= 3).length / n).toFixed(0),
  } : null;
  const fmt = (bucket) => Object.fromEntries(Object.entries(bucket).map(([k, a]) =>
    [k, { n: a.n, meanDelta: +(a.dsum / a.n).toFixed(2), winPct: +(100 * a.wins / a.n).toFixed(0), podiumPct: +(100 * a.top3 / a.n).toFixed(0) }]));
  return { races, baseline, cards: fmt(acc), finaleByLegs: fmt(tierAcc) };
}

const report = {};
for (const type of TYPES) {
  report[type] = {};
  for (const diff of DIFFS) {
    const t0 = Date.now();
    const result = measure(type, diff, CHARS);
    report[type][diff] = result;
    const ms = Date.now() - t0;
    console.log(`\n=== ${type} / ${diff} （${result.races}レース・${ms}ms） ===`);
    if (result.baseline) {
      console.log(`無入力基準: n=${result.baseline.n} 平均${result.baseline.meanRank}着 勝率${result.baseline.winPct}% 表彰台${result.baseline.podiumPct}%`);
    } else {
      console.log("無入力基準: データ不足（レースが取れなかった）");
    }
    const rows = Object.entries(result.cards).sort((a, b) => a[0].localeCompare(b[0]));
    rows.forEach(([k, a]) => {
      console.log(`  ${k.padEnd(22)} n=${String(a.n).padStart(3)}  Δ着順=${a.meanDelta.toFixed(2).padStart(7)}  勝率${String(a.winPct).padStart(3)}%  表彰台${String(a.podiumPct).padStart(3)}%`);
    });
    const legTiers = ["十分", "やや消耗", "苦しい", "限界"];
    const legRows = Object.entries(result.finaleByLegs);
    if (legRows.length) {
      console.log("  --- finale：脚の残り別 ---");
      legTiers.forEach(tier => {
        const rowsForTier = legRows.filter(([k]) => k.startsWith(`${tier}/`));
        if (!rowsForTier.length) return;
        rowsForTier.sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, a]) => {
          console.log(`  ${k.padEnd(22)} n=${String(a.n).padStart(3)}  Δ着順=${a.meanDelta.toFixed(2).padStart(7)}  勝率${String(a.winPct).padStart(3)}%  表彰台${String(a.podiumPct).padStart(3)}%`);
        });
      });
    }
    if (VERBOSE) console.log(JSON.stringify(result, null, 2));
  }
}

if (OUT) {
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n報告書: ${path.join(OUT, "report.json")}`);
}
