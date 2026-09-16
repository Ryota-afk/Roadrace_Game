// 第99弾（32-d 本気度システム）の計測プローブ。
//
// ⚠️第1版（案A・aiMulへの固定加算）はDIFFICULTIESへ偽の行を足して測っていたが、
// 案A自体が不成立と判明し実装は案B'（プレイヤー能力に対する比でAI powerを決める）へ
// 差し替わった。この第2版は⚠️出荷するコードそのもの（buildMyLifeSimのintensity引数）を
// 直接叩く。DIFFICULTIESは一切いじらない。
//
// 【第96〜98弾・第99弾較正の罠を踏まないための約束】
//  ① プレイヤーは `entrants.find(e => e.isPlayerChar)` のみ。フォールバックを置かない。
//  ② レースは careerRaces()（年間日程）。s.races（その月の候補3件）は使わない。
//  ③ 着順は飽和する。Δ秒（ゴールタイム）を必ず併記し、勝率が高い条件は警告する。
//  ④ 対応のある標本：同一キャラ・同一レースを全intensity段へ流す。
//  ⑤ 標本は最低10キャラ以上にする（4キャラでは同一条件が実行間で77%/98%とブレた実績）。
//  ⑥ 実キャリアの強さ帯で測る（能力60/80/92は1〜4年目にしか存在しない。
//     tools/simcareer.mjsの実測：総合力は5年目101・10年目128・15年目144）。
const R = "/home/user/Roadrace_Game/src";
const { initMyLife } = await import(`${R}/state/mylifeState.js`);
const { mlCreateChar } = await import(`${R}/domain/mylife/createChar.js`);
const { buildMyLifeSim } = await import(`${R}/sim/buildMyLifeSim.js`);
const { AB_KEYS } = await import(`${R}/data/abilities.js`);
const { overall } = await import(`${R}/core/core.js`);
const { mlIntensityTarget, mlIntensityTargetLabel } = await import(`${R}/domain/mylife/intensity.js`);
const { careerRaces } = await import("/home/user/Roadrace_Game/tools/_shared.mjs");

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const LEVELS = [0, 1, 2]; // 賭けない／本気で／全部賭ける（INTENSITY_LABELと対応）
const CHARS = Number(arg("--chars", "10"));
const TYPE = arg("--type", "RUL");

const ABILITIES = arg("--abilities", null);
const STAGES = ABILITIES
  ? ABILITIES.split(",").map(Number).map(a => ({
    label: `${arg("--class", "2") === "0" ? "B1" : arg("--class", "2") === "1" ? "A" : "PRO"}/${arg("--year", "15")}年目 能力${a}`,
    classIdx: Number(arg("--class", "2")), year: Number(arg("--year", "15")), ability: a,
  }))
  : [
    { label: "新人 B1/1年目 能力60", classIdx: 0, year: 1, ability: 60 },
    { label: "中堅 A/5年目 能力100", classIdx: 1, year: 5, ability: 100 },
    { label: "円熟 PRO/10年目 能力128", classIdx: 2, year: 10, ability: 128 },
    { label: "極み PRO/15年目 能力144", classIdx: 2, year: 15, ability: 144 },
  ];

function scaleTo(p, t) {
  const cur = AB_KEYS.reduce((a, k) => a + (p[k] || 0), 0) / AB_KEYS.length;
  AB_KEYS.forEach(k => { p[k] = (p[k] || 0) * (t / cur); });
  return p;
}

// ⚠️段階ごとに mlCreateChar を引き直すと、⚠️**キャラの引きの差が段階差に化ける**。
// 実際、同一条件（PRO/15年目/能力144）が別々の実行で段1達成率14%と31%になった
// ——n=10でも±17ポイントぶれる。段階間を比べるなら⚠️**キャラ集団は1度だけ作り、
// 各段階へは能力だけスケールした複製を流す**（段階間で対応のある標本にする）。
// player以外（rival/teammates/worldRosters/bonds）は参照のまま共有してよい——
// scaleToが触るのはplayerだけなので副作用が無い。
const BASE_CHARS = [];
for (let c = 0; c < CHARS; c++) {
  BASE_CHARS.push(mlCreateChar(initMyLife(), TYPE, "university", null, null,
    { totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] }));
}

// ⚠️このプローブの限界（結果を読む人へ）：worldRostersはmlCreateCharが返す
// **1年目のまま**渡しており、ageWorldRosters()によるAIの経年成長を再現していない。
// つまり「15年目」は⚠️**15年目のレース日程と乱数シード**であって
// **15年目のAIの強さではない**。段階間の差はクラス（対戦プール・出走人数）と
// レース構成の差であり、AI自身の成長は含まれない。
for (const stage of STAGES) {
  const races = await careerRaces(R, stage.year, stage.classIdx);
  const st = {};
  let ovrSum = 0, ovrN = 0;
  LEVELS.forEach(lv => st[lv] = { n: 0, rank: 0, win: 0, top3: 0, top10: 0, hitTarget: 0, time: 0 });
  for (let c = 0; c < CHARS; c++) {
    const base = BASE_CHARS[c];
    const s = { ...base, player: scaleTo({ ...base.player }, stage.ability) };
    ovrSum += overall(s.player); ovrN++;
    for (const race of races) {
      for (const lv of LEVELS) {
        const sim = buildMyLifeSim(race, s.player, s.team, stage.classIdx, "normal", undefined, null,
          s.rival, stage.year, s.rival2, s.teammates, s.tactic, s.worldRosters, null, s.bonds, lv);
        if (!sim.entrants) continue;
        const me = sim.entrants.find(e => e.isPlayerChar);
        if (!me || me.finishTime == null) continue;
        const a = st[lv];
        a.n++; a.rank += me.rank; a.time += me.finishTime;
        if (me.rank === 1) a.win++;
        if (me.rank <= 3) a.top3++;
        if (me.rank <= 10) a.top10++;
        if (me.rank <= mlIntensityTarget(stage.classIdx)) a.hitTarget++;
      }
    }
  }
  const ovrSample = ovrN ? ovrSum / ovrN : 0;
  const targetLabel = mlIntensityTargetLabel(stage.classIdx);
  console.log(`\n=== ${stage.label} / 総合力${ovrSample.toFixed(0)} / 目標=${targetLabel} / ${TYPE} / ${CHARS}キャラ×${races.length}レース（対応のある標本） ===`);
  const base = st[0];
  console.log(`段  n     平均着順   勝率   3位以内  10位以内  ${targetLabel}達成率  Δ秒(vs賭けない)`);
  for (const lv of LEVELS) {
    const a = st[lv];
    if (!a.n) { console.log(`${lv}  データ不足`); continue; }
    const dt = base.n ? (a.time / a.n) - (base.time / base.n) : 0;
    console.log(
      `${lv}   ${String(a.n).padStart(4)}` +
      `  ${(a.rank / a.n).toFixed(2).padStart(7)}着` +
      `  ${String(Math.round(100 * a.win / a.n)).padStart(4)}%` +
      `  ${String(Math.round(100 * a.top3 / a.n)).padStart(6)}%` +
      `  ${String(Math.round(100 * a.top10 / a.n)).padStart(7)}%` +
      `  ${String(Math.round(100 * a.hitTarget / a.n)).padStart(10)}%` +
      `  ${(dt >= 0 ? "+" : "") + dt.toFixed(1)}`
    );
  }
  const bw = 100 * base.hitTarget / (base.n || 1);
  if (bw >= 40) console.log(`  ⚠️賭けない状態での${targetLabel}達成率が${Math.round(bw)}%——飽和に近いので段1/2の伸びしろが狭い可能性がある。`);
}
