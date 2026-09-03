// 第99弾（32-d 本気度システム）の before 計測プローブ。
//
// 【測る理由】設計が2つの数値に依存する：
//  M1. 「そのレースだけAIを強くする」つまみ（aiMulのΔ）は、どれだけ回せば
//      プレイヤーの成績が動くのか。動かなければ本気度は見た目だけの装置になる。
//  M2. 各キャリア段階での素の達成率。閾値（例「3位以内で成功」）を置くには、
//      素で何%通るかを知らないと「必ず成功」か「絶対無理」のどちらかになる。
//
// 【第96〜98弾の3つの罠を踏まないための約束】
//  ① プレイヤーは `entrants.find(e => e.isPlayerChar)` のみ。フォールバックを置かない。
//  ② レースは careerRaces()（年間日程）。s.races（その月の候補3件）は使わない。
//  ③ 着順は飽和する。Δ秒（ゴールタイム）を必ず併記し、勝率が高い条件は警告する。
//  ④ 対応のある標本：同一キャラ・同一レースを全つまみ位置へ流す。
import path from "node:path";

const R = "/home/user/Roadrace_Game/src";
const { initMyLife } = await import(`${R}/state/mylifeState.js`);
const { mlCreateChar } = await import(`${R}/domain/mylife/createChar.js`);
const { buildMyLifeSim } = await import(`${R}/sim/buildMyLifeSim.js`);
const { AB_KEYS } = await import(`${R}/data/abilities.js`);
const { DIFFICULTIES } = await import(`${R}/data/progression.js`);
const { careerRaces } = await import("/home/user/Roadrace_Game/tools/_shared.mjs");

// 本気度のつまみ位置を「normalのaiMulに対する加算」として仮想的に作る。
// ⚠️src は一切変更しない——計測のためにDIFFICULTIESへ一時的な行を足すだけ。
// abilCap は normal と同じ96相当（mlAiCapFor経由）に保ち、aiMulだけを動かす
// ＝「同じ顔ぶれが本気を出す」という本気度の意味論に合わせる。
const STEPS = [0, 0.15, 0.30, 0.45, 0.60];
const normal = DIFFICULTIES.find(d => d.id === "normal");
STEPS.forEach(dv => {
  if (dv === 0) return;
  DIFFICULTIES.push({ ...normal, id: `probe${dv}`, aiMul: normal.aiMul + dv });
});
const idFor = dv => (dv === 0 ? "normal" : `probe${dv}`);

const STAGES = [
  { label: "新人 B1/1年目 能力60", classIdx: 0, year: 1, ability: 60 },
  { label: "中堅 A/5年目 能力80", classIdx: 1, year: 5, ability: 80 },
  { label: "円熟 PRO/9年目 能力92", classIdx: 2, year: 9, ability: 92 },
];
const CHARS = Number(process.argv[process.argv.indexOf("--chars") + 1] || 12);
const TYPE = "RUL";

function scaleTo(p, t) {
  const cur = AB_KEYS.reduce((a, k) => a + (p[k] || 0), 0) / AB_KEYS.length;
  AB_KEYS.forEach(k => { p[k] = (p[k] || 0) * (t / cur); });
  return p;
}

for (const stage of STAGES) {
  const races = await careerRaces(R, stage.year, stage.classIdx);
  const st = {};
  STEPS.forEach(dv => st[dv] = { n: 0, rank: 0, win: 0, top3: 0, top10: 0, time: 0 });
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
        if (!me || me.finishTime == null) continue;
        const a = st[dv];
        a.n++; a.rank += me.rank; a.time += me.finishTime;
        if (me.rank === 1) a.win++;
        if (me.rank <= 3) a.top3++;
        if (me.rank <= 10) a.top10++;
      }
    }
  }
  console.log(`\n=== ${stage.label} / ${TYPE} / ${CHARS}キャラ×${races.length}レース（対応のある標本） ===`);
  const base = st[0];
  console.log("aiMul差   n     平均着順   勝率   3位以内  10位以内  Δ秒(vs据置)");
  for (const dv of STEPS) {
    const a = st[dv];
    if (!a.n) { console.log(`+${dv.toFixed(2)}  データ不足`); continue; }
    const dt = base.n ? (a.time / a.n) - (base.time / base.n) : 0;
    console.log(
      `+${dv.toFixed(2)}  ${String(a.n).padStart(4)}` +
      `  ${(a.rank / a.n).toFixed(2).padStart(7)}着` +
      `  ${String(Math.round(100 * a.win / a.n)).padStart(4)}%` +
      `  ${String(Math.round(100 * a.top3 / a.n)).padStart(6)}%` +
      `  ${String(Math.round(100 * a.top10 / a.n)).padStart(7)}%` +
      `  ${(dt >= 0 ? "+" : "") + dt.toFixed(1)}`
    );
  }
  const bw = 100 * base.win / (base.n || 1);
  if (bw >= 40) console.log(`  ⚠️据置での勝率が${Math.round(bw)}%——着順は天井(1着)に飽和するため、Δ秒を主指標として読むこと（第98弾§4.2）。`);
}
