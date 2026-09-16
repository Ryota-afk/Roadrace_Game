// 難易度つまみが正しい向きに効いているかの恒久チェック（第96弾 §7で新設）。
//
// 【なぜ恒久ツールにしたか】
// 第96弾は「難易度を上げるほど成績が良くなる」という発見から始まり、sim本体へ3回
// 手を入れた末に、⚠️**発見そのものが計測バグだった**と判明して全面撤回になった。
// 同じ穴に落ちないよう、難易度の向きだけは使い捨てのプローブではなく恒久ツールで測る。
//
// 【この2点を必ず守る（第96弾§7.6の教訓）】
//  ① プレイヤーの取得は `entrants.find(e => e.isPlayerChar)` のみ。
//     ⚠️`isPlayer` というフィールドは存在せず、`|| entrants[0]` を書くと
//     .find() が失敗しても静かに**AI選手**（プレイヤーは添字30前後）を掴み続ける。
//     取れなければ黙って別の値を返さず skip する。
//  ② 対応のある標本にする。難易度ごとに mlCreateChar() を引き直すと、easy と oni で
//     別のキャラ・別のレース日程を比べることになる。同一キャラ・同一レースを
//     4難易度へ流し込む。
//
// 【使い方】
//   node tools/difficulty_check.mjs                       # 既定=RUL・能力100・PRO・30キャラ
//   node tools/difficulty_check.mjs --ability 60 --class 0
//   node tools/difficulty_check.mjs --types RUL,SPR,CLM --chars 20
//
// 【合格条件】勝率が easy ≥ normal ≥ hard ≥ oni の順に単調であること。
// 逆転や非単調が出たら、⚠️**まず本ツール自身を疑う**（①②が守られているか）。
import path from "node:path";

const R = path.resolve(new URL(".", import.meta.url).pathname, "..", "src");
const { initMyLife } = await import(`${R}/state/mylifeState.js`);
const { mlCreateChar } = await import(`${R}/domain/mylife/createChar.js`);
const { buildMyLifeSim } = await import(`${R}/sim/buildMyLifeSim.js`);
const { AB_KEYS } = await import(`${R}/data/abilities.js`);
const { careerRaces, defaultYearFor } = await import("./_shared.mjs");

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const TYPES = arg("--types", "RUL").split(",");
const CHARS = Number(arg("--chars", "30"));
const ABILITY = Number(arg("--ability", "100"));
const CLASSIDX = Number(arg("--class", "2"));
// ⚠️第97弾§4.13: 出走レースは年間日程から組む。旧実装は`s.races`（その月の候補3件）を
// 使っており、クラスを変えても走るコースは新人1年目の2〜3本のままだった。
const YEAR = arg("--year", null) != null ? Number(arg("--year", null)) : defaultYearFor(CLASSIDX);
const RACE_LIST = await careerRaces(R, YEAR, CLASSIDX);
const DIFFS = ["easy", "normal", "hard", "oni"];

// 能力の平均を目標値へ揃える（難易度以外の条件を固定するため）
function scaleTo(p, t) {
  const cur = AB_KEYS.reduce((a, k) => a + (p[k] || 0), 0) / AB_KEYS.length;
  AB_KEYS.forEach(k => { p[k] = (p[k] || 0) * (t / cur); });
  return p;
}

function measure(type) {
  const st = {};
  DIFFS.forEach(d => st[d] = { n: 0, rank: 0, win: 0, top3: 0, tick: 0, fin: 0, draft: 0, solo: 0, ticks: 0 });
  for (let c = 0; c < CHARS; c++) {
    const s = mlCreateChar(initMyLife(), type, "university", null, null,
      { totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] });
    scaleTo(s.player, ABILITY);
    for (const race of RACE_LIST) {
      // ⚠️同一キャラ・同一レースを4難易度へ（対応のある標本）
      for (const diff of DIFFS) {
        const sim = buildMyLifeSim(race, s.player, s.team, CLASSIDX, diff, undefined, null,
          s.rival, YEAR, s.rival2, s.teammates, s.tactic, s.worldRosters, null, s.bonds);
        if (!sim.entrants) continue;
        const me = sim.entrants.find(e => e.isPlayerChar); // ⚠️フォールバックを置かない
        if (!me || !me.posHist || me.posHist.length < 60) continue;
        const a = st[diff];
        const T = me.posHist.filter(v => v != null).length;
        a.n++; a.rank += me.rank; if (me.rank === 1) a.win++; if (me.rank <= 3) a.top3++;
        a.tick += T; a.fin += me.energyHist[T - 1] ?? 0;
        for (let t = 0; t < T; t++) {
          const m = me.modeHist[t];
          a.ticks++;
          if (m === "draft") a.draft++;
          else if (m === "solo" || m === "attack") a.solo++;
        }
      }
    }
  }
  return st;
}

let allMonotone = true;
for (const type of TYPES) {
  const st = measure(type);
  console.log(`\n=== ${type} / 能力平均${ABILITY} / クラスidx${CLASSIDX} / ${CHARS}キャラ（対応のある標本） ===`);
  const wins = [];
  DIFFS.forEach(d => {
    const a = st[d];
    if (!a.n) { console.log(`${d.padEnd(6)} データ不足`); return; }
    wins.push(100 * a.win / a.n);
    console.log(
      `${d.padEnd(6)} n=${String(a.n).padStart(3)} 平均${(a.rank / a.n).toFixed(2).padStart(6)}着` +
      ` 勝率${String(Math.round(100 * a.win / a.n)).padStart(3)}%` +
      ` 表彰台${String(Math.round(100 * a.top3 / a.n)).padStart(3)}%` +
      ` | ${(a.tick / a.n).toFixed(0)}tick ゴール脚${(a.fin / a.n).toFixed(1).padStart(6)}` +
      ` | draft${String(Math.round(100 * a.draft / a.ticks)).padStart(3)}%` +
      ` solo${String(Math.round(100 * a.solo / a.ticks)).padStart(3)}%`
    );
  });
  const mono = wins.every((v, i) => i === 0 || wins[i - 1] >= v);
  if (!mono) allMonotone = false;
  console.log(mono
    ? "  → 勝率は easy≥normal≥hard≥oni で単調。難易度は正しい向きに効いている。"
    : "  → ⚠️単調でない。まず本ツール自身（isPlayerChar／対応のある標本）を疑うこと。");
}
process.exit(allMonotone ? 0 : 1);
