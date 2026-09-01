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
//
// 【第一次計測（devlog/wave95.md §4.5）との違い】
// 第一次はRUL・キャリア開始時のみだった。本ツールは脚質を選べるようにした恒久版。
// ⚠️キャリア中盤/後半（バッジ所持後）の再測定は別課題（TODO #31-D残作業②）——
// mlAdvanceMonth等で月を進める土台がもう1段要るため、本ツールのスコープ外のまま残す。
import path from "node:path";
import fs from "node:fs";

const R = path.resolve(new URL(".", import.meta.url).pathname, "..", "src");
const { initMyLife } = await import(`${R}/state/mylifeState.js`);
const { mlCreateChar } = await import(`${R}/domain/mylife/createChar.js`);
const { buildMyLifeSim } = await import(`${R}/sim/buildMyLifeSim.js`);
const { resumeSim } = await import(`${R}/sim/race.js`);
const { buildDecisions, composeCard } = await import(`${R}/domain/shared/raceDecisions.js`);

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const TYPES = arg("--types", "RUL,SPR,CLM,PUN,TT").split(",");
const DIFFS = arg("--diffs", "easy,hard").split(",");
const CHARS = Number(arg("--chars", "40"));
const VERBOSE = process.argv.includes("--verbose");
const OUT = arg("--out", null);
if (OUT) fs.mkdirSync(OUT, { recursive: true });

function segTypeAt(course, frac) {
  for (let i = 0; i < course.segs.length; i++) if (frac <= course.cumFrac[i]) return course.segs[i].type;
  return course.segs[course.segs.length - 1].type;
}

function newChar(type) {
  return mlCreateChar(initMyLife(), type, "university", null, null, { totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] });
}

// 1脚質×1難易度ぶんを計測する。戻り値: { baseline: {n,meanRank,winPct,podiumPct}, cards: {kind/move: {...}} }
function measure(type, diff, nChars) {
  const baseRanks = [];
  const acc = {}; // "kind/move" -> {n, dsum, wins, top3}
  const rec = (kind, move, delta, rank) => {
    const k = `${kind}/${move}`;
    acc[k] = acc[k] || { n: 0, dsum: 0, wins: 0, top3: 0 };
    const a = acc[k];
    a.n++; a.dsum += delta; if (rank === 1) a.wins++; if (rank <= 3) a.top3++;
  };
  let races = 0;
  for (let c = 0; c < nChars; c++) {
    const s = newChar(type);
    const list = s.races.filter(r => !(r.tmpl && (r.tmpl.teamTT || r.tmpl.soloTT)));
    for (const race of list) {
      const sim = buildMyLifeSim(race, s.player, s.team, s.classIdx, diff, undefined, null,
        s.rival, s.year, s.rival2, s.teammates, s.tactic, s.worldRosters, null, s.bonds);
      if (!sim.entrants) continue;
      const me = sim.entrants.find(e => e.isPlayer) || sim.entrants[0];
      if (!me.posHist || me.posHist.length < 60) continue;
      const base = me.rank;
      baseRanks.push(base);
      const decs = buildDecisions(sim.course, me, false).filter(d => d.at != null);
      for (const dec of decs) {
        const frac = dec.at;
        const fromTick = Math.floor(frac * me.posHist.length);
        const ctx = { manager: false, segType: segTypeAt(sim.course, frac), frac, energy: 60, mates: 2, inBreak: false };
        const card = composeCard(dec.kind, me, ctx);
        for (const ch of card.choices) {
          const forked = { ...sim, entrants: sim.entrants.map(e => structuredClone(e)) };
          resumeSim(forked, fromTick, me.id, ch.move);
          const r = forked.entrants.find(e => e.id === me.id).rank;
          rec(dec.kind, ch.move, r - base, r);
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
  const cards = {};
  Object.entries(acc).forEach(([k, a]) => {
    cards[k] = { n: a.n, meanDelta: +(a.dsum / a.n).toFixed(2), winPct: +(100 * a.wins / a.n).toFixed(0), podiumPct: +(100 * a.top3 / a.n).toFixed(0) };
  });
  return { races, baseline, cards };
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
    if (VERBOSE) console.log(JSON.stringify(result, null, 2));
  }
}

if (OUT) {
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n報告書: ${path.join(OUT, "report.json")}`);
}
