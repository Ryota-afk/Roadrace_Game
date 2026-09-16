// #32-k の原因確認。仮説：`raceForecast`は`favors`（1つのラベル）から固定の
// DISCIPLINES式を引くが、simは実際のコースの区間構成（SEG_AB）で走る。
// 例：グラベル(RUL)の式は flat*0.6 + solo*0.25 + stamina*0.15 だが、実際のコースに
// tt区間がほぼ無ければ solo の0.25は架空の重み。
//
// B1で偏りが大きいのは、⚠️プレイヤーが専門型・AIが万能型だから（実測：
// プレイヤー flat73/climb51/solo48 に対し AI平均 flat66/climb65/solo65）。
// 式がずれると専門型だけが大きく誤査定される。PROではプレイヤーが全能力でAIを
// 上回る（104 vs 76）ため、どの式でも上位に並び偏りが出ない。
//
// 対照実験：同じ出走者に対し ①現行の favors 式 ②実コースの区間構成で重みを作った式
// の2通りで予想順位を出し、実着順に対する「予想超え率」を比べる。
// ⚠️②が50%へ寄れば仮説は支持される。寄らなければ原因は別にある。
const R = "/home/user/Roadrace_Game/src";
const { initMyLife } = await import(`${R}/state/mylifeState.js`);
const { mlCreateChar } = await import(`${R}/domain/mylife/createChar.js`);
const { buildMyLifeSim } = await import(`${R}/sim/buildMyLifeSim.js`);
const { AB_KEYS } = await import(`${R}/data/abilities.js`);
const { SEG_AB } = await import(`${R}/data/course.js`);
const { raceForecast } = await import(`${R}/domain/shared/forecast.js`);
const { careerRaces } = await import("/home/user/Roadrace_Game/tools/_shared.mjs");

// ②実コースの区間構成から重みを作る。各区間の距離ぶんだけ SEG_AB の能力に重みを置く。
function segMixForecastRank(entrants, course, me) {
  const w = {};
  let total = 0;
  for (const seg of course.segs || []) {
    const k = SEG_AB[seg.type];
    if (!k) continue;
    const len = seg.km || seg.len || 1;
    w[k] = (w[k] || 0) + len;
    total += len;
  }
  if (!total) return null;
  Object.keys(w).forEach(k => { w[k] /= total; });
  // stamina は全区間に効く土台として一律15%を混ぜ、残り85%を区間構成で配分する
  const score = e => 0.15 * (e.stamina || 0)
    + 0.85 * Object.entries(w).reduce((a, [k, v]) => a + v * (e[k] || 0), 0);
  const sorted = [...entrants].sort((a, b) => score(b) - score(a));
  return sorted.indexOf(me) + 1;
}

for (const [lbl, cls, yr, ab] of [["新人 B1/1年目 能力60", 0, 1, 60], ["円熟 PRO/9年目 能力92", 2, 9, 92]]) {
  const races = await careerRaces(R, yr, cls);
  let n = 0, beatOld = 0, beatNew = 0, sumRank = 0, sumOld = 0, sumNew = 0;
  for (let c = 0; c < 8; c++) {
    const s = mlCreateChar(initMyLife(), "RUL", "university", null, null,
      { totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] });
    const cur = AB_KEYS.reduce((a, k) => a + (s.player[k] || 0), 0) / AB_KEYS.length;
    AB_KEYS.forEach(k => { s.player[k] = s.player[k] * (ab / cur); });
    for (const race of races) {
      const sim = buildMyLifeSim(race, s.player, s.team, cls, "normal", undefined, null,
        s.rival, yr, s.rival2, s.teammates, s.tactic, s.worldRosters, null, s.bonds);
      if (!sim.entrants) continue;
      const me = sim.entrants.find(e => e.isPlayerChar);
      if (!me || me.rank == null) continue;
      const old = raceForecast(sim.entrants, race.tmpl && race.tmpl.favors).get(me);
      const neo = segMixForecastRank(sim.entrants, sim.course, me);
      if (!old || !neo) continue;
      n++; sumRank += me.rank; sumOld += old.rank; sumNew += neo;
      if (me.rank < old.rank) beatOld++;
      if (me.rank < neo) beatNew++;
    }
  }
  console.log(`\n=== ${lbl} / n=${n} ===`);
  console.log(`  実着順      平均 ${(sumRank / n).toFixed(2)}`);
  console.log(`  ①現行(favors式)  予想平均 ${(sumOld / n).toFixed(2)}   予想超え ${Math.round(100 * beatOld / n)}%`);
  console.log(`  ②区間構成から    予想平均 ${(sumNew / n).toFixed(2)}   予想超え ${Math.round(100 * beatNew / n)}%`);
}
