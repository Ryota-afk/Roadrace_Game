// マイライフの「買い切り（有限）の使い道」の総額を data/ から機械的に合計する。
// 第93弾(devlog/wave93.md)：資金の供給（tools/simcareer.mjs の frugal 累積）と
// 突き合わせて「使い道がいつ尽きるか」を出すために作った。価格を足したり
// 段階を増やしたりしたら、このスクリプトを流し直して総額の変化を見ること。
//   node tools/money_demand.mjs
import path from "node:path";
const R = path.resolve(new URL(".", import.meta.url).pathname, "..", "src");
const g = await import(`${R}/data/gear.js`);
const { PARTS, PART_SLOTS } = await import(`${R}/data/parts.js`);

const sum = a => a.reduce((x,y)=>x+y,0);
const rows = [];

rows.push(["住居（4段階すべて）", sum(g.ML_HOUSES.map(h=>h.price))]);
rows.push(["車（4段階すべて）", sum(g.ML_CARS.map(c=>c.price))]);
const nonCoachGear = Object.entries(g.ML_GEAR).filter(([k])=>!k.endsWith("Coach"));
rows.push([`練習用品（${nonCoachGear.map(([,v])=>v.label).join("・")}）`, sum(nonCoachGear.map(([,v])=>v.price))]);
// コーチ：契約金のみ。Lv上げは無料（月給が上がるだけ）。同時雇用はPROで3人まで
rows.push(["専門コーチ 契約金（PROの同時雇用上限3人）", g.ML_COACH_SIGNING * Math.max(...g.ML_COACH_SLOTS_BY_CLASS)]);
// パーツ：各スロットの最上位tierを1つずつ
const best = PART_SLOTS.map(slot => {
  const cands = Object.values(PARTS).filter(p=>p.slot===slot);
  return cands.reduce((a,b)=> (b.tier>a.tier?b:a));
});
rows.push([`パーツ本体（各スロット最上位×4）`, sum(best.map(p=>p.price))]);
// パーツ強化：CP未購入時の上限Lv5まで × 4スロット
const upTo5 = sum(g.ML_PART_UPGRADE_COST.slice(0, g.ML_PART_LV_MAX));
rows.push([`パーツ強化 Lv5まで×4スロット（1スロット${upTo5}万）`, upTo5 * PART_SLOTS.length]);
rows.push([`成長力アップ（C→B→A→S の連鎖）`, sum(Object.values(g.ML_GROWTH_POW_UP_PRICE))]);
rows.push([`成長タイプ変更（キャリア1回限り）`, g.ML_GROWTH_SHIFT_PRICE]);

const total = sum(rows.map(r=>r[1]));
console.log("## 買い切り（有限）の使い道 — 一生で使い切れる総額\n");
console.log("| 項目 | 総額 |");
console.log("|---|---|");
rows.forEach(([k,v])=>console.log(`| ${k} | ${v.toLocaleString()}万 |`));
console.log(`| **合計** | **${total.toLocaleString()}万** |`);
console.log(`\n単品の最高額: ${Math.max(...g.ML_HOUSES.map(h=>h.price), ...g.ML_CARS.map(c=>c.price), g.ML_GROWTH_SHIFT_PRICE, ...Object.values(g.ML_GROWTH_POW_UP_PRICE))}万`);
console.log("\n## 繰り返せる（無限）の使い道 — 単価");
console.log(`- ワンオフ機材の開発: 初期${g.ML_DEV_PROJECT.initCost}万＋追加${g.ML_DEV_PROJECT.addCosts.join("/")}万（最短${g.ML_DEV_PROJECT.minMonths}ヶ月）`);
console.log(`- 科学トレーニング: 初期${g.ML_SCI_PROJECT.initCost}万＋追加${g.ML_SCI_PROJECT.addCosts.join("/")}万（最短${g.ML_SCI_PROJECT.minMonths}ヶ月）`);
console.log(`- 私設強化合宿: 120＋(年-1)×40＋クラス×60 万`);
console.log(`- 消耗品: ${Object.values(g.ML_STOCK_ITEMS).map(i=>`${i.label} ${i.price}万`).join(" / ")}`);
console.log(`- コーチ月給: Lv1..3 = ${g.ML_COACH_SALARY.slice(1).join("/")}万/月`);
