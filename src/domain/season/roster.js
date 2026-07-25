// ロースター生成の純ロジック（初期編成・新人スカウト候補）。Phase 4-1後の state.js から分離（Step5: domain抽出）。
import { AB_KEYS } from "../../data/abilities.js";
import { PRODIGY_CHANCE_BY_CLASS, SCOUT_COUNT_BY_CLASS } from "../../data/course.js";
import { CLASSES } from "../../data/progression.js";
import { genSubStats, mulberry, newRider, overall, pickRiderName, ridState } from "../../core/core.js";

export function initRoster() {
  // v12バグ修正: 初期メンバー6名の名前が完全固定されており、新しくゲームを始めても
  // 毎回同じ名前になってしまうと気になるとのフィードバックを受け、能力値・年齢・役割の
  // バランスはそのまま維持しつつ、名前だけを新規ゲームのたびにランダム生成するようにした
  const rng = mulberry(Date.now() % 999983);
  const mk = (name, type, f, c, sp, st, so, age, growth, pow, trait, pers) => {
    const r = {
      id: ridState.value++, name, type, flat: f, climb: c, sprint: sp, stamina: st, solo: so,
      ...genSubStats(type, rng, { personality: pers }),
      age, growth, growthPow: pow, abilities: trait ? [trait] : [], personality: pers,
      fatigue: 20, cond: 3, condForecast: 0, injury: 0, streak: 0,
      focus: "flat", joinOvr: 0, parts: { frame: null, tire: null, wheels: null, nutrition: null },
      raceLog: [], favorite: false, tenure: 0,
    };
    r.joinOvr = overall(r); return r;
  };
  const banned = new Set();
  const randName = () => pickRiderName(rng, banned);
  return [
    mk(randName(), "SPR", 66, 38, 82, 60, 48, 25, "normal", "A", "closer", "hotblood"),
    mk(randName(), "CLM", 52, 80, 34, 72, 58, 27, "late", "B", "mount", "seeker"),
    mk(randName(), "RUL", 76, 56, 52, 76, 64, 28, "normal", "C", "domestique", "artisan"),
    mk(randName(), "PUN", 62, 67, 64, 62, 56, 23, "early", "A", null, "normal"),
    mk(randName(), "TT", 64, 46, 44, 64, 76, 26, "normal", "B", null, "free"),
    mk(randName(), "RUL", 48, 42, 44, 52, 46, 19, "late", "S", "iron", "genius"),
  ];
}

export function scoutSpecs(policy, count) {
  let base5;
  if (policy === "future") base5 = [17, 18, 18, 19, 20].map(age => ({ age, mul: 0.8, priceMul: 0.7, powDist: [0.15, 0.60, 0.90] }));
  else if (policy === "now") base5 = [23, 24, 25, 26, 27].map(age => ({ age, mul: 1.08, priceMul: 1.25, powDist: [0.0, 0.05, 0.45] }));
  else base5 = [18, 20, 22, 24, 25].map((age, i) => ({ age, mul: 0.85 + i * 0.055, priceMul: 0.7 + i * 0.13 }));
  const extra = [];
  for (let i = 5; i < count; i++) extra.push({ age: 20 + (i % 6), mul: 0.9 + (i % 4) * 0.05, priceMul: 0.85 + (i % 4) * 0.1 });
  return [...base5, ...extra];
}

export function genScouts(classIdx, seed, policy = "balance", existingNames, scoutLv = 0) {
  const rng = mulberry(seed);
  const base = CLASSES[classIdx].scout;
  const count = SCOUT_COUNT_BY_CLASS[classIdx];
  const specs = scoutSpecs(policy, count);
  const prodigyRng = mulberry(seed + 999);
  // v28: スカウトスタッフのレベルに応じて逸材（成長S確定）の発掘率が上がる
  const hasProdigy = prodigyRng() < PRODIGY_CHANCE_BY_CLASS[classIdx] * (1 + scoutLv * 0.6);
  const prodigyIdx = hasProdigy ? Math.floor(prodigyRng() * count) : -1;
  // v12バグ修正: 候補一覧の中で名前が被らないよう、既存ロースターの名前も避けつつ
  // 同じバッチ内で使った名前を集合に積み上げていく
  const nameBanned = new Set(existingNames || []);
  return specs.map((s, i) => {
    const opts = { age: s.age, powDist: s.powDist, banned: nameBanned };
    if (policy === "sprint" && i < Math.ceil(count * 0.6)) { opts.type = "SPR"; opts.abBonus = { sprint: 8 }; }
    if (policy === "climb" && i < Math.ceil(count * 0.6)) { opts.type = "CLM"; opts.abBonus = { climb: 8 }; }
    if (i === prodigyIdx) opts.forceProdigy = true;
    const r = newRider(base * s.mul, rng, opts);
    if (s.age <= 18) r.growth = rng() < 0.6 ? "late" : r.growth;
    // v28: スカウトスタッフのレベルで査定のブレ幅が縮む（lv3で約25%まで）
    const blurMul = Math.max(0.2, 1 - scoutLv * 0.28);
    const blur = {};
    AB_KEYS.forEach(k => {
      const d = (6 + rng() * 9) * blurMul;
      blur[k] = { min: Math.max(20, Math.round(r[k] - d)), max: Math.min(94, Math.round(r[k] + d)) };
    });
    const ovrMin = Math.round(AB_KEYS.reduce((a, k) => a + blur[k].min, 0) / 5);
    const ovrMax = Math.round(AB_KEYS.reduce((a, k) => a + blur[k].max, 0) / 5);
    const tag = s.age <= 19 ? "高卒ルーキー" : s.age <= 22 ? "大卒" : "実業団";
    return { rider: r, tag, blur, ovrMin, ovrMax, price: Math.round(overall(r) * 1.4 * s.priceMul * (r.prodigy ? 1.7 : 1)) };
  });
}
