// 生きた世界（永続ペロトン／世界スター生成）。Phase 2で分離。
import { GIVEN_ALL, mulberry, overall, pickRiderName } from "../core/core.js";

export const WORLD_STAR_COUNT = 24;
const WORLD_STAR_TYPES = ["SPR", "CLM", "RUL", "PUN", "TT"];

export function mlMakeWorldStar(rng, year, opts) {
  opts = opts || {};
  return {
    id: opts.id || ("ws" + Math.floor(rng() * 1e9)),
    name: opts.name || pickRiderName(rng, null),
    type: opts.type || WORLD_STAR_TYPES[Math.floor(rng() * WORLD_STAR_TYPES.length)],
    age: opts.age != null ? opts.age : 20 + Math.floor(rng() * 8),
    rating: opts.rating != null ? opts.rating : 74 + Math.floor(rng() * 20),
    wins: opts.wins || 0,
    peakAge: opts.peakAge != null ? opts.peakAge : 27 + Math.floor(rng() * 4),
    growth: opts.growth || (rng() < 0.25 ? "S" : rng() < 0.6 ? "A" : "B"),
    debutYear: opts.debutYear != null ? opts.debutYear : year,
    lineage: opts.lineage || null,
    bloodOf: opts.bloodOf || null, // v33.10: あなたの殿堂・血統から世界へ流入した選手
  };
}

export function mlWorldStarsForYear(seed, targetYear, legendPool) {
  const s0 = ((seed || 777) >>> 0);
  const initRng = mulberry(s0);
  // v33.10: あなたの殿堂の名選手・確立した系統の血が、次世代として世界のペロトンに流入する
  const legs = (legendPool || []).slice().sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 8);
  let stars = [];
  for (let i = 0; i < WORLD_STAR_COUNT; i++) {
    if (i < legs.length && initRng() < 0.85) {
      const leg = legs[i];
      const surname = (leg.name || "名家 選手").split(" ")[0];
      stars.push(mlMakeWorldStar(initRng, 1, {
        name: surname + " " + GIVEN_ALL[Math.floor(initRng() * GIVEN_ALL.length)],
        type: leg.type,
        age: 21 + Math.floor(initRng() * 10),
        rating: Math.max(72, Math.min(97, Math.round((leg.overall || 80) - 4 + initRng() * 8))),
        wins: Math.floor(initRng() * 10),
        bloodOf: leg.lineageName || (surname + "系"),
      }));
    } else {
      stars.push(mlMakeWorldStar(initRng, 1, { age: 21 + Math.floor(initRng() * 12), rating: 74 + Math.floor(initRng() * 21), wins: Math.floor(initRng() * 14) }));
    }
  }
  const ty = Math.max(1, targetYear || 1);
  for (let y = 2; y <= ty; y++) {
    const yr = mulberry((s0 + y * 2654435761) >>> 0);
    // 加齢と成長/衰え
    stars = stars.map(st => {
      const ns = { ...st };
      ns.age += 1;
      if (ns.age <= ns.peakAge) ns.rating = Math.min(99, ns.rating + (ns.growth === "S" ? 3 : ns.growth === "A" ? 2 : 1));
      else ns.rating = Math.max(38, ns.rating - (1 + Math.floor((ns.age - ns.peakAge) / 2)));
      return ns;
    });
    // ランキング上位ほど勝ち星を積む
    const ranked = [...stars].sort((a, b) => b.rating - a.rating);
    ranked.forEach((st, idx) => { if (idx === 0) st.wins += 3; else if (idx < 3) st.wins += 2; else if (idx < 10) st.wins += 1; });
    // 引退＆世代交代（4割で名選手の血を継ぐ2世が登場）
    stars = stars.map(st => {
      const retire = st.age >= 35 || (st.age >= 32 && st.rating < 62) || st.rating < 44;
      if (!retire) return st;
      const inherit = yr() < 0.4 || !!st.bloodOf; // 殿堂の血を引くスターは必ず後継を残す
      const surname = (st.name || "無名 選手").split(" ")[0];
      const childName = inherit ? (surname + " " + GIVEN_ALL[Math.floor(yr() * GIVEN_ALL.length)]) : pickRiderName(yr, null);
      return mlMakeWorldStar(yr, y, { name: childName, type: inherit ? st.type : undefined, age: 19 + Math.floor(yr() * 3), rating: 70 + Math.floor(yr() * 16), lineage: inherit ? st.name : null, bloodOf: inherit ? st.bloodOf : null });
    });
  }
  return stars.sort((a, b) => b.rating - a.rating);
}
