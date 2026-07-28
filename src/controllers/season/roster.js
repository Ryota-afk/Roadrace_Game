// ロースター管理（獲得・解雇・日々の運用）の状態遷移（純粋なreducer関数）。
// controllers/season/transfer.js（移籍・トレード）と対をなす、日常のロースター操作ドメイン。
import { MONTHS, ROSTER_MAX_BY_CLASS } from "../../data/course.js";
import { ABILITIES, AB_KEYS } from "../../data/abilities.js";
import { RIVAL_TEAMS } from "../../data/teams.js";
import { mulberry, newRider, SUB_STAT_KEYS } from "../../core/core.js";
import { mlBloodlineBonus, mlBreedBonus } from "../../breeding/breeding.js";
import { bumpGrowthPow, computePickupChance, isHallOfFameWorthy } from "../../logic/support.js";

export function signScout(s, sc) {
  const rosterMax = ROSTER_MAX_BY_CLASS[s.classIdx];
  if (s.budget < sc.price || s.roster.length >= rosterMax) return s;
  return {
    ...s, budget: s.budget - sc.price, roster: [...s.roster, { ...sc.rider }],
    scouts: s.scouts.filter(x => x.rider.id !== sc.rider.id),
    log: [...s.log, `【${MONTHS[s.month]}】${sc.rider.name} が入団（${sc.tag}）— 真の能力が判明！`],
  };
}

// v11: FA移籍市場。即決購入方式（新人スカウトと異なり能力は伏せず即座に表示）
export function signFa(s, fa) {
  const rosterMax = ROSTER_MAX_BY_CLASS[s.classIdx];
  if (s.budget < fa.price || s.roster.length >= rosterMax) return s;
  return {
    ...s, budget: s.budget - fa.price, roster: [...s.roster, { ...fa.rider }],
    faMarket: s.faMarket.filter(x => x.rider.id !== fa.rider.id),
    log: [...s.log, `【${MONTHS[s.month]}】${fa.rider.name}（${fa.age}歳）がFA移籍で入団`],
  };
}

export function useSupp(s, rid) {
  if (s.inv.supp <= 0) return s;
  return { ...s, inv: { ...s.inv, supp: s.inv.supp - 1 }, roster: s.roster.map(r => r.id === rid ? { ...r, fatigue: Math.max(0, r.fatigue - 40) } : r) };
}

export function useTune(s, rid) {
  if (s.inv.tune <= 0) return s;
  return { ...s, inv: { ...s.inv, tune: s.inv.tune - 1 }, roster: s.roster.map(r => r.id === rid ? { ...r, cond: Math.min(5, r.cond + 2) } : r) };
}

export function setFocus(s, rid, focus) {
  return { ...s, roster: s.roster.map(r => r.id === rid ? { ...r, focus } : r) };
}

// v22: クールダウンによる利用間隔の制限では「空けばすぐ使う」が最適解になり続けて
// 「毎月使うのが前提」という印象は変わらなかったため、タイマーではなく実質的な負荷で
// ブレーキをかける方式に変更。キャンプは全員の疲労を大きく消耗させる（+25）ため、
// 連発するとレース前に疲労90超＝故障リスクゾーンへ突入しやすくなる。「今は無理をしても
// いい月か」をプレイヤー自身が毎回判断する、意味のある選択にする
export function useCamp(s) {
  if (s.inv.camp <= 0 || s.camp) return s;
  return {
    ...s, camp: true, inv: { ...s.inv, camp: s.inv.camp - 1 },
    roster: s.roster.map(r => ({ ...r, fatigue: Math.min(100, r.fatigue + 25) })),
  };
}

// v13.1: お気に入り登録した選手は、殿堂入り条件（実績）を満たしていなくても必ず記録に残る
export function toggleFavorite(s, rid) {
  return { ...s, roster: s.roster.map(r => r.id === rid ? { ...r, favorite: !r.favorite } : r) };
}

// v17: キャプテン制度。同じ選手をもう一度指名すると解任になる（1名まで）
export function setCaptain(s, rid) {
  return { ...s, captainId: s.captainId === rid ? null : rid };
}

export function releaseRider(s, rid) {
  if (s.month !== 0) return s;
  if (s.roster.length <= 1) return s;
  const r = s.roster.find(x => x.id === rid);
  if (!r) return s;
  const roster = s.roster.filter(x => x.id !== rid);
  const captainId = s.captainId === rid ? null : s.captainId;
  // v13.1: 能力・将来性次第でライバルチームに拾われる。拾われた場合は殿堂入りさせず
  // rivalAlumniで追跡し、そのチームで出走を続けさせる（いずれ引退した時点で改めて判定）
  const pickedUp = Math.random() < computePickupChance(r);
  if (pickedUp) {
    const signedTeam = RIVAL_TEAMS[Math.floor(Math.random() * RIVAL_TEAMS.length)].name;
    const rivalAlumni = [...s.rivalAlumni, { ...r, signedTeam, signedYear: s.year }];
    return {
      ...s, roster, rivalAlumni, captainId,
      log: [...s.log, `【${MONTHS[s.month]}】${r.name} を解雇 → ${signedTeam}が獲得したとの噂`],
    };
  }
  // v13.1: 殿堂入りは一定の実績かお気に入り登録がある選手のみ（無条件だとキリがない）
  const hallOfFame = isHallOfFameWorthy(r)
    ? [...s.hallOfFame, { ...r, farewellYear: s.year, farewellReason: "released" }]
    : s.hallOfFame;
  return { ...s, roster, hallOfFame, captainId, log: [...s.log, `【${MONTHS[s.month]}】${r.name} を解雇した`] };
}

// v25: ユース育成枠。4月のスカウト候補とは別に、年1回だけ安価な契約金で
// 16〜17歳の若手を確保できる。現在の能力は低いが成長力（growthPow）はA以上を保証し、
// 長期育成前提の「原石」枠として機能させる
export function signYouthProspect(s) {
  if (s.youthUsed || s.budget < 15) return s;
  const rng = mulberry(Date.now() % 999983 + s.roster.length * 4111);
  const banned = new Set(s.roster.map(r => r.name));
  const growthPow = rng() < 0.4 ? "S" : "A";
  const rookie = newRider(34, rng, { banned, age: 16 + Math.floor(rng() * 2), growthPow });
  return {
    ...s, roster: [...s.roster, rookie], budget: s.budget - 15, youthUsed: true,
    log: [...s.log, `【${MONTHS[s.month]}】ユース育成枠で${rookie.name}（${rookie.age}歳・成長力${growthPow}）を確保した`],
  };
}

// v31.1: 血統ユース（配合）。マイライフ殿堂の2名を親に選び、配合の原石をユース枠で確保する。
// 通常ユース（15万）より高価（40万）だが、相性・血の濃さ・累代+値・金特クロスの恩恵が乗る
export function signBredYouth(s, legA, legB) {
  if (s.youthUsed || s.budget < 40 || s.roster.length >= ROSTER_MAX_BY_CLASS[s.classIdx] || !legA || !legB) return s;
  const rng = mulberry(Date.now() % 999983 + s.roster.length * 7333);
  const banned = new Set(s.roster.map(r => r.name));
  const growthPow = rng() < 0.5 ? "S" : "A";
  const rookie = newRider(34, rng, { banned, age: 16 + Math.floor(rng() * 2), growthPow, type: legA.type });
  const breed = mlBreedBonus(legA, legB);
  AB_KEYS.forEach(k => { if (breed.abBonus[k]) rookie[k] = Math.min(96, (rookie[k] || 0) + breed.abBonus[k]); });
  SUB_STAT_KEYS.forEach(k => { if (breed.subBonus[k]) rookie[k] = Math.max(20, Math.min(95, (rookie[k] ?? 50) + breed.subBonus[k])); });
  let abils = [...(breed.goldInherit || []), ...(breed.exclusive || []), ...(rookie.abilities || [])];
  breed.extraAbilities.forEach(id => { if (id && ABILITIES[id] && !abils.includes(id)) abils.push(id); });
  abils = abils.filter((id, i) => abils.indexOf(id) === i);
  rookie.abilities = abils.slice(0, 5);
  if (breed.goldInherit && breed.goldInherit.length) { rookie.goldAbilities = [...(rookie.goldAbilities || [])]; breed.goldInherit.forEach(id => { if (rookie.abilities.includes(id) && !rookie.goldAbilities.includes(id)) rookie.goldAbilities.push(id); }); }
  // v33: 爆発力は伸びしろへ。ユースは元々成長力A/S＋才能キャップで大器化する
  if (breed.growthSteps) rookie.growthPow = bumpGrowthPow(rookie.growthPow, breed.growthSteps);
  else if (breed.growthBump) rookie.growthPow = bumpGrowthPow(rookie.growthPow, 1);
  rookie.talentCap = breed.talentCap || 0;
  rookie.bakuhatsu = breed.bakuhatsu || 0;
  rookie.matingGrade = breed.matingGrade || "D";
  // v33.4: 特殊配合。唯一無二の名血を確定発現
  let specialNote = "";
  if (breed.special) {
    const sm = breed.special;
    rookie.specialMating = { key: sm.key, title: sm.title, color: sm.color };
    rookie.talentCap = (rookie.talentCap || 0) + (sm.talent || 0);
    if (sm.growth) rookie.growthPow = bumpGrowthPow(rookie.growthPow, sm.growth);
    const goldId = sm.gold || (sm.factorGold ? ({ climb: "mount", sprint: "finisher", flat: "flatlander", solo: "soloist" }[legA.focus] || "engine") : null);
    if (sm.extra && ABILITIES[sm.extra] && !rookie.abilities.includes(sm.extra) && rookie.abilities.length < 6) rookie.abilities = [...rookie.abilities, sm.extra];
    if (goldId && ABILITIES[goldId]) {
      if (!rookie.abilities.includes(goldId) && rookie.abilities.length < 6) rookie.abilities = [...rookie.abilities, goldId];
      if (rookie.abilities.includes(goldId)) { rookie.goldAbilities = [...(rookie.goldAbilities || [])]; if (!rookie.goldAbilities.includes(goldId)) rookie.goldAbilities.push(goldId); }
    }
    specialNote = `・🌟${sm.title}`;
  }
  // v33.2: 危険度。濃い血の代償で稀にガラスの体を持って生まれる（頑丈を継いでいれば発症しない）
  rookie.matingDanger = breed.danger || 0;
  let fragileNote = "";
  if (breed.danger > 0 && !rookie.abilities.includes("tough") && !rookie.abilities.includes("glass") && rng() * 100 < breed.danger) {
    rookie.abilities = [...rookie.abilities, "glass"];
    rookie.fragileBorn = true;
    fragileNote = "・⚠️ガラスの体";
  }
  // v33.3: 系統確立ボーナス。名門系統を継ぐユースは因子（伸びしろ＋系統特能）を受け取る
  rookie.lineageName = legA.lineageName || `${legA.name}系`;
  let lineNote = "";
  const yblb = mlBloodlineBonus(rookie.lineageName);
  if (yblb) {
    rookie.bloodlineTier = yblb.tier;
    rookie.talentCap = (rookie.talentCap || 0) + yblb.talentCap;
    if (yblb.growthSteps) rookie.growthPow = bumpGrowthPow(rookie.growthPow, yblb.growthSteps);
    if (yblb.factor && ABILITIES[yblb.factor]) {
      if (!rookie.abilities.includes(yblb.factor) && rookie.abilities.length < 5) rookie.abilities = [...rookie.abilities, yblb.factor];
      if (yblb.factorGold && rookie.abilities.includes(yblb.factor)) { rookie.goldAbilities = [...(rookie.goldAbilities || [])]; if (!rookie.goldAbilities.includes(yblb.factor)) rookie.goldAbilities.push(yblb.factor); }
    }
    lineNote = `・🏛${yblb.label}`;
  }
  const goldNote = (breed.goldInherit && breed.goldInherit.length) ? `・✨金特クロス` : "";
  return {
    ...s, roster: [...s.roster, rookie], budget: s.budget - 40, youthUsed: true,
    log: [...s.log, `【${MONTHS[s.month]}】🧬 血統ユース：${legA.name}×${legB.name}の配合で${rookie.name}（${rookie.age}歳・成長力${rookie.growthPow}）を確保（${breed.nick.rank} ${breed.nick.label}${goldNote}${fragileNote}${lineNote}${specialNote}）`],
  };
}
