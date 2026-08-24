// マイライフのショップ・アイテム・私生活系の状態遷移（純粋なreducer関数）。
// controllers/season/shop.js の対（マイライフ側は setMl への薄い接続）。
import { MONTHS } from "../../data/course.js";
import { AB_KEYS, AB_LABEL } from "../../data/abilities.js";
import { ML_AB_COACH_KEY, ML_CARS, ML_COACH_MAX_BY_CLASS, ML_COACH_SIGNING, ML_COACH_SLOTS_BY_CLASS, ML_GEAR, ML_HOUSES, ML_STOCK_ITEMS, ML_GROWTH_POW_UP_PRICE, ML_GROWTH_SHIFT_PRICE, ML_PART_UPGRADE_COST, ML_PART_LV_MAX } from "../../data/gear.js";
import { GROWTHPOW_ORDER, GROWTH_ORDER } from "../../data/progression.js";
import { PARTS } from "../../sim/race.js";
import { addAb, mlGrowthCapFor, mlPrivateCampCost } from "../../logic/support.js";

export function mlBuyPart(s, pid) {
  const p = PARTS[pid];
  if (!p || s.money < p.price || p.tier > s.classIdx + 1) return s;
  return { ...s, money: s.money - p.price, partsInv: { ...s.partsInv, [pid]: (s.partsInv[pid] || 0) + 1 } };
}

export function mlSetPart(s, slot, pid) {
  return { ...s, player: { ...s.player, parts: { ...s.player.parts, [slot]: pid || null } } };
}

// 第12弾(12-B): 装着中のパーツを強化する（買い切り・段階制、Lv0〜実効上限）。
// 未装着スロットや上限到達済みスロットは対象外。実効上限はCP交換所「パーツ強化の上限+2」
// （第12弾12-C・s.partLvMaxBonus）を加算した値。
export function mlUpgradePart(s, slot) {
  const player = s.player;
  if (!player.parts || !player.parts[slot]) return s;
  const lv = (player.partLv && player.partLv[slot]) || 0;
  const maxLv = ML_PART_LV_MAX + (s.partLvMaxBonus || 0);
  if (lv >= maxLv) return s;
  const cost = ML_PART_UPGRADE_COST[lv];
  if (s.money < cost) return s;
  return {
    ...s, money: s.money - cost,
    player: { ...player, partLv: { ...player.partLv, [slot]: lv + 1 } },
  };
}

export function mlBuyGear(s, k) {
  const it = ML_GEAR[k];
  if (!it || s.gear[k] || s.money < it.price) return s;
  return { ...s, money: s.money - it.price, gear: { ...s.gear, [k]: true } };
}

export function mlBuyStock(s, k) {
  const it = ML_STOCK_ITEMS[k];
  if (!it || s.money < it.price) return s;
  return { ...s, money: s.money - it.price, stock: { ...s.stock, [k]: (s.stock[k] || 0) + 1 } };
}

export function mlUseStock(s, k) {
  if ((s.stock[k] || 0) <= 0) return s;
  const it = ML_STOCK_ITEMS[k];
  const player = { ...s.player };
  if (it.fatigueDelta) player.fatigue = Math.max(0, Math.min(100, player.fatigue + it.fatigueDelta));
  if (it.formDelta) player.form = Math.max(0, Math.min(100, (player.form ?? 50) + it.formDelta));
  return { ...s, player, stock: { ...s.stock, [k]: s.stock[k] - 1 } };
}

// v43(マイライフ難易度調整Phase 1・柱0-b): 成長力アップは在庫消耗品ではなく買った瞬間に
// 即適用される買い切り（mlBuyCar/mlBuyHouseと同じ形）。現在の成長力ごとに価格が
// 累進するため、在庫を安値のうちに買い貯めてあとで使う抜け道が構造的に塞がれる。
export function mlBuyGrowthPowUp(s) {
  const player = s.player;
  const price = ML_GROWTH_POW_UP_PRICE[player.growthPow];
  const idx = GROWTHPOW_ORDER.indexOf(player.growthPow);
  if (price == null || idx < 0 || idx >= GROWTHPOW_ORDER.length - 1 || s.money < price) return s;
  return { ...s, money: s.money - price, player: { ...player, growthPow: GROWTHPOW_ORDER[idx + 1] } };
}

// 成長タイプ変更：キャリア通じて1回限り（dir=+1で晩成寄り、dir=-1で早熟寄り）。
export function mlBuyGrowthShift(s, dir) {
  const player = s.player;
  if (player.growthShiftUsed || s.money < ML_GROWTH_SHIFT_PRICE) return s;
  const idx = GROWTH_ORDER.indexOf(player.growth);
  const nextIdx = idx + dir;
  if (idx < 0 || nextIdx < 0 || nextIdx >= GROWTH_ORDER.length) return s;
  return { ...s, money: s.money - ML_GROWTH_SHIFT_PRICE, player: { ...player, growth: GROWTH_ORDER[nextIdx], growthShiftUsed: true } };
}

// v27: 私設強化合宿。潤沢な資金を注ぎ込んで狙った能力（focus）を一気に引き上げる、
// 繰り返し利用できる資金の使い道。成長キャップは通常の練習と共通なので、伸びしろが
// 尽きた選手には効きにくい。疲労も溜まるので連打は難しい
export function mlPrivateCamp(s) {
  const cost = mlPrivateCampCost(s);
  if (s.money < cost) return s;
  // 第29弾(判断③): 成長上限は能力別（脚質×能力のオフセット付き）
  const player = { ...s.player };
  const capFor = (k) => mlGrowthCapFor(s.year, player, s, k);
  const before = player[player.focus];
  addAb(player, player.focus, 6, capFor(player.focus));
  AB_KEYS.filter(k => k !== player.focus).forEach(k => addAb(player, k, 2, capFor(k)));
  player.fatigue = Math.min(100, player.fatigue + 12);
  const gained = Math.round((player[player.focus] - before) * 10) / 10;
  return {
    ...s, player, money: s.money - cost,
    log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】私設強化合宿を実施（-${cost}万円）。${AB_LABEL[player.focus]}を中心に鍛え上げた（+${gained}）`],
  };
}

export function mlBuyCar(s) {
  const next = s.carLv + 1;
  if (next >= ML_CARS.length || s.money < ML_CARS[next].price) return s;
  return { ...s, money: s.money - ML_CARS[next].price, carLv: next };
}

export function mlBuyHouse(s) {
  const next = s.houseLv + 1;
  if (next >= ML_HOUSES.length || s.money < ML_HOUSES[next].price) return s;
  return { ...s, money: s.money - ML_HOUSES[next].price, houseLv: next };
}

export function mlSetFocus(s, key) {
  return { ...s, player: { ...s.player, focus: key } };
}

// 第36弾: 専門コーチの段階制。Lv0→1は契約金＋雇用枠の空きが要る。Lv→Lv+1（昇格）は
// 契約金なし・クラスのLv上限内なら無条件（月給は次回のmlLivingCostから自動的に上がる）。
// 旧セーブのgear[coachKey]（買い切り済み）はLv1相当として扱う（二重課金しない）。
export function mlHireCoach(s, key) {
  const coaches = s.coaches || {};
  const legacyLv = (s.gear && s.gear[ML_AB_COACH_KEY[key]]) ? 1 : 0;
  const lv = Math.max(legacyLv, coaches[key] || 0);
  const maxLv = ML_COACH_MAX_BY_CLASS[s.classIdx] ?? 0;
  if (lv >= maxLv) return s;
  if (lv === 0) {
    const hired = Object.keys(ML_AB_COACH_KEY)
      .filter(k => Math.max((s.gear && s.gear[ML_AB_COACH_KEY[k]]) ? 1 : 0, coaches[k] || 0) > 0)
      .length;
    const slots = ML_COACH_SLOTS_BY_CLASS[s.classIdx] ?? 0;
    if (hired >= slots || s.money < ML_COACH_SIGNING) return s;
    return { ...s, money: s.money - ML_COACH_SIGNING, coaches: { ...coaches, [key]: 1 } };
  }
  return { ...s, coaches: { ...coaches, [key]: lv + 1 } };
}

// クラス降格で雇用中の人数・Lvが上限を超えていても、ここでは強制解雇しない
// （プレイヤーの資産を勝手に奪わない。超過分は雇用・昇格ができなくなるだけ）。
// 旧セーブのgear[coachKey]がtrueのまま残っていると効果的な解雇にならないため、
// 解雇時はgear側のフラグも一緒に落とす。
export function mlDismissCoach(s, key) {
  const coaches = s.coaches || {};
  const coachKey = ML_AB_COACH_KEY[key];
  const hadLegacy = !!(s.gear && s.gear[coachKey]);
  const lv = Math.max(hadLegacy ? 1 : 0, coaches[key] || 0);
  if (lv <= 0) return s;
  const nextGear = hadLegacy ? { ...s.gear, [coachKey]: false } : s.gear;
  return { ...s, gear: nextGear, coaches: { ...coaches, [key]: 0 } };
}
