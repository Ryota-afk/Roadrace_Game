// 第99弾・第2次計測。第1次（intensity_probe.mjs）で分かったこと：
//  ・aiMulのつまみは +0.15 で既に崖（新人の3位以内 8%→0%、円熟 56%→18%）。段は遥かに細かく要る。
//  ・素の達成率が段階で全く違う（3位以内：新人8% / 中堅28% / 円熟56%）→ 固定閾値は成立しない。
//
// そこで「閾値をプレイヤー自身の予想着順に置く」案を測る。`raceForecast`（domain/shared/forecast.js）は
// 既に出走表に出ている（panels.jsx:73）＝プレイヤーが賭ける画面に判断材料が既にある。
//
// 測るのは2つ：
//  A. 細かいつまみ（+0.00〜+0.15）での絶対達成率——段をどこに置けるか。
//  B. 「予想着順を上回れたか」の率が、つまみと段階に対してどう動くか。
//     ⚠️これが段階によらず一定なら、本気度は「難しさ」ではなく「賭け金の大きさ」だけを動かす装置になる。
//     ⚠️つまみで下がるなら、難しさと見返りの両方が乗る（悪魔の釜と同型）。
import path from "node:path";

const R = "/home/user/Roadrace_Game/src";
const { initMyLife } = await import(`${R}/state/mylifeState.js`);
const { mlCreateChar } = await import(`${R}/domain/mylife/createChar.js`);
const { buildMyLifeSim } = await import(`${R}/sim/buildMyLifeSim.js`);
const { AB_KEYS } = await import(`${R}/data/abilities.js`);
const { DIFFICULTIES } = await import(`${R}/data/progression.js`);
const { raceForecast } = await import(`${R}/domain/shared/forecast.js`);
const { careerRaces } = await import("/home/user/Roadrace_Game/tools/_shared.mjs");

const STEPS = [0, 0.03, 0.06, 0.10, 0.15];
const normal = DIFFICULTIES.find(d => d.id === "normal");
STEPS.forEach(dv => { if (dv !== 0) DIFFICULTIES.push({ ...normal, id: `p${dv}`, aiMul: normal.aiMul + dv }); });
const idFor = dv => (dv === 0 ? "normal" : `p${dv}`);

const STAGES = [
  { label: "新人 B1/1年目 能力60", classIdx: 0, year: 1, ability: 60 },
  { label: "中堅 A/5年目 能力80", classIdx: 1, year: 5, ability: 80 },
  { label: "円熟 PRO/9年目 能力92", classIdx: 2, year: 9, ability: 92 },
];
const CHARS = 8;
const TYPE = "RUL";

function scaleTo(p, t) {
  const cur = AB_KEYS.reduce((a, k) => a + (p[k] || 0), 0) / AB_KEYS.length;
  AB_KEYS.forEach(k => { p[k] = (p[k] || 0) * (t / cur); });
  return p;
}

for (const stage of STAGES) {
  const races = await careerRaces(R, stage.year, stage.classIdx);
  const st = {};
  STEPS.forEach(dv => st[dv] = { n: 0, rank: 0, fc: 0, beat: 0, tie: 0, win: 0, top3: 0, top10: 0, nofc: 0 });
  for (let c = 0; c < CHARS; c++) {
    const s = mlCreateChar(initMyLife(), TYPE, "university", null, null,
      { totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] });
    scaleTo(s.player, stage.ability);
    for (const race of races) {
      for (const dv of STEPS) {
        const sim = buildMyLifeSim(race, s.player, s.team, stage.classIdx, idFor(dv), undefined, null,
          s.rival, stage.year, s.rival2, s.teammates, s.tactic, s.worldRosters, null, s.bonds);
        if (!sim.entrants) continue;
        const me = sim.entrants.find(e => e.isPlayerChar);
        if (!me || me.rank == null) continue;
        const a = st[dv];
        a.n++; a.rank += me.rank;
        if (me.rank === 1) a.win++;
        if (me.rank <= 3) a.top3++;
        if (me.rank <= 10) a.top10++;
        const fmap = raceForecast(sim.entrants, race.tmpl && race.tmpl.favors);
        const mine = fmap.get(me);
        if (!mine) { a.nofc++; continue; }
        a.fc += mine.rank;
        if (me.rank < mine.rank) a.beat++;
        else if (me.rank === mine.rank) a.tie++;
      }
    }
  }
  console.log(`\n=== ${stage.label} / ${TYPE} / ${CHARS}キャラ×${races.length}レース（対応のある標本） ===`);
  console.log("aiMul差   n    平均着順  予想着順  予想超え  同着以上   勝率  3位以内 10位以内");
  for (const dv of STEPS) {
    const a = st[dv];
    if (!a.n) { console.log(`+${dv.toFixed(2)}  データ不足`); continue; }
    const withFc = a.n - a.nofc;
    console.log(
      `+${dv.toFixed(2)}  ${String(a.n).padStart(4)}` +
      `  ${(a.rank / a.n).toFixed(2).padStart(7)}` +
      `  ${(withFc ? a.fc / withFc : 0).toFixed(2).padStart(7)}` +
      `  ${String(Math.round(100 * a.beat / (withFc || 1))).padStart(7)}%` +
      `  ${String(Math.round(100 * (a.beat + a.tie) / (withFc || 1))).padStart(7)}%` +
      `  ${String(Math.round(100 * a.win / a.n)).padStart(4)}%` +
      `  ${String(Math.round(100 * a.top3 / a.n)).padStart(6)}%` +
      `  ${String(Math.round(100 * a.top10 / a.n)).padStart(7)}%`
    );
    if (a.nofc) console.log(`        （予想が出せなかった標本 ${a.nofc}件を予想系の列から除外）`);
  }
}
