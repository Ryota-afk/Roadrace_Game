// 第99弾: 実装した本気度のreducer連鎖（mlRaceFinish→mlAdvanceMonth）をエンドツーエンドで
// 動かすスモークテスト。UIを介さずcontrollers/*.jsの純関数を直接呼ぶ（useMyLifeGame.jsの
// mlStartRace/mlSetIntensity/mlRaceFinishが実際にやっていることと同じ手順）。
// 確認する項目：
//  ①賭け金が成否によらず引かれる ②成功時のみ人気度・成長に倍率がかかる
//  ③活力コストが成否によらず引かれる ④intensity/raceSeedがレース後0/nullに戻る
//  ⑤intensity=0（賭けない）では従来と完全に同じ結果になる（回帰が無いことの確認）
const R = "/home/user/Roadrace_Game/src";
const { initMyLife } = await import(`${R}/state/mylifeState.js`);
const { mlCreateChar } = await import(`${R}/domain/mylife/createChar.js`);
const { buildMyLifeSim } = await import(`${R}/sim/buildMyLifeSim.js`);
const { AB_KEYS } = await import(`${R}/data/abilities.js`);
const { mlRaceFinish } = await import(`${R}/controllers/mylife/result.js`);
const { mlAdvanceMonth } = await import(`${R}/controllers/mylife/month.js`);
const { mlIntensityStake, mlIntensityTarget } = await import(`${R}/domain/mylife/intensity.js`);
const { careerRaces } = await import("/home/user/Roadrace_Game/tools/_shared.mjs");

const YEAR = 9, CLASS = 2;
const races = await careerRaces(R, YEAR, CLASS);

function makeState(ability) {
  let s = { ...initMyLife(), ...mlCreateChar(initMyLife(), "RUL", "university", null, null, { totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] }) };
  const cur = AB_KEYS.reduce((a, k) => a + (s.player[k] || 0), 0) / AB_KEYS.length;
  AB_KEYS.forEach(k => { s.player[k] = s.player[k] * (ability / cur); });
  s.classIdx = CLASS; s.year = YEAR;
  return s;
}

function run(level, ability, seed) {
  let s = makeState(ability);
  const race = races[0];
  const sim = buildMyLifeSim(race, s.player, s.team, s.classIdx, s.difficulty || "easy", undefined, null, s.rival, s.year, s.rival2, s.teammates, s.tactic, s.worldRosters, null, s.bonds, level, seed);
  s = { ...s, result: sim, intensity: level, raceSeed: seed };
  const moneyBefore = s.money;
  const vitBefore = s.player.vitality == null ? 100 : s.player.vitality;
  const after = mlRaceFinish(s);
  const stake = mlIntensityStake(s.year, s.classIdx, level);
  const target = mlIntensityTarget(s.classIdx);
  const rank = after.resultInfo.rank;
  const bet = after.resultInfo.bet;
  const afterMonth = mlAdvanceMonth(after, "race");
  const expectedVit = Math.max(0, vitBefore - (5 + race.grade * 2) - [0, 8, 16][level]);
  return { rank, target, moneyBefore, moneyAfterFinish: after.money, stake, bet, vitBefore, vitAfterMonth: afterMonth.player.vitality, expectedVit, popGain: after.resultInfo.popGain, prize: after.resultInfo.prize, popBonus: after.resultInfo.popBonus, ambitionCleared: after.resultInfo.ambitionCleared, growthDelta: AB_KEYS.reduce((a, k) => a + ((afterMonth.player[k] || 0) - (after.player[k] || 0)), 0) };
}

console.log("=== intensity=0（賭けない）——moneyはstake=0で変化しないはず ===");
for (let i = 0; i < 3; i++) {
  const r = run(0, 92, 100000 + i);
  const ambMoney0 = (r.ambitionCleared && /資金\+(\d+)万円/.test(r.ambitionCleared.rewardText)) ? Number(RegExp.$1) : 0;
  const expectedDelta = r.prize + r.popBonus + ambMoney0 - r.stake;
  console.log(`  着順${r.rank}位 / stake=${r.stake} / money変化=${r.moneyAfterFinish - r.moneyBefore}（想定${expectedDelta}） / bet=${JSON.stringify(r.bet)}`);
  if (r.stake !== 0 || r.bet !== null) console.log("  ⚠️NG: intensity=0でも賭けが発生している");
  if (r.moneyAfterFinish - r.moneyBefore !== expectedDelta) console.log("  ⚠️NG: money変化が想定と食い違う");
}

console.log("\n=== intensity=2（全部賭ける）——複数シードで成功/失敗の両方を確認 ===");
let sawSuccess = false, sawFail = false;
for (let i = 0; i < 20; i++) {
  const r = run(2, 92, 200000 + i * 977);
  const ok = r.rank <= r.target;
  if (r.bet.success !== ok) { console.log(`  ⚠️NG: bet.success(${r.bet.success}) が実際の着順(${r.rank} vs 目標${r.target})と食い違う`); }
  const ambMoney = (r.ambitionCleared && /資金\+(\d+)万円/.test(r.ambitionCleared.rewardText)) ? Number(RegExp.$1) : 0;
  const expectedDelta = r.prize + r.popBonus + ambMoney - r.stake;
  if (r.moneyAfterFinish - r.moneyBefore !== expectedDelta) { console.log(`  ⚠️NG: money変化が想定と食い違う（実際${r.moneyAfterFinish - r.moneyBefore} vs 想定${expectedDelta}=prize${r.prize}+popBonus${r.popBonus}-stake${r.stake}）`); }
  if (Math.abs(r.vitAfterMonth - r.expectedVit) > 0.01) { console.log(`  ⚠️NG: 活力の消費が想定と食い違う（実際${r.vitAfterMonth.toFixed(1)} vs 想定${r.expectedVit.toFixed(1)}）`); }
  if (ok) { sawSuccess = true; console.log(`  成功: 着順${r.rank}位 / 賭け金-${r.stake} / 人気度+${r.popGain} / 成長合計+${r.growthDelta.toFixed(2)}`); }
  else { sawFail = true; console.log(`  失敗: 着順${r.rank}位 / 賭け金-${r.stake} / 人気度+${r.popGain} / 成長合計+${r.growthDelta.toFixed(2)}`); }
}
console.log(`\n成功例を確認: ${sawSuccess} / 失敗例を確認: ${sawFail}`);

console.log("\n=== レース後にintensity/raceSeedが0/nullへ戻るか ===");
{
  const r0 = run(1, 92, 999);
  console.log("  (関数の戻り値を直接見るため再実行)");
}
{
  let s = makeState(92);
  const race = races[0];
  const sim = buildMyLifeSim(race, s.player, s.team, s.classIdx, s.difficulty || "easy", undefined, null, s.rival, s.year, s.rival2, s.teammates, s.tactic, s.worldRosters, null, s.bonds, 1, 555);
  s = { ...s, result: sim, intensity: 1, raceSeed: 555 };
  const after = mlRaceFinish(s);
  console.log("  after.intensity =", after.intensity, "/ after.raceSeed =", after.raceSeed);
  if (after.intensity !== 0 || after.raceSeed !== null) console.log("  ⚠️NG: リセットされていない");
}
