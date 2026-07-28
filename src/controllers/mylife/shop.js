// マイライフのショップ・アイテム・私生活系の状態遷移（純粋なreducer関数）。
// controllers/season/shop.js の対（マイライフ側は setMl への薄い接続）。
import { MONTHS } from "../../data/course.js";
import { AB_KEYS, AB_LABEL } from "../../data/abilities.js";
import { ML_CARS, ML_GEAR, ML_HOUSES, ML_STOCK_ITEMS } from "../../data/gear.js";
import { GROWTHPOW_ORDER, GROWTH_ORDER } from "../../data/progression.js";
import { PARTS } from "../../sim/race.js";
import { addAb, mlGrowthCap, mlPrivateCampCost } from "../../logic/support.js";

export function mlBuyPart(s, pid) {
  const p = PARTS[pid];
  if (!p || s.money < p.price || p.tier > s.classIdx + 1) return s;
  return { ...s, money: s.money - p.price, partsInv: { ...s.partsInv, [pid]: (s.partsInv[pid] || 0) + 1 } };
}

export function mlSetPart(s, slot, pid) {
  return { ...s, player: { ...s.player, parts: { ...s.player.parts, [slot]: pid || null } } };
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
  // v15フェーズ2: 成長力・成長タイプを1段階アップさせる消耗品
  if (it.growthPowUp) {
    const idx = GROWTHPOW_ORDER.indexOf(player.growthPow);
    if (idx >= 0 && idx < GROWTHPOW_ORDER.length - 1) player.growthPow = GROWTHPOW_ORDER[idx + 1];
  }
  if (it.growthShiftUp) {
    const idx = GROWTH_ORDER.indexOf(player.growth);
    if (idx >= 0 && idx < GROWTH_ORDER.length - 1) player.growth = GROWTH_ORDER[idx + 1];
  }
  return { ...s, player, stock: { ...s.stock, [k]: s.stock[k] - 1 } };
}

// v27: 私設強化合宿。潤沢な資金を注ぎ込んで狙った能力（focus）を一気に引き上げる、
// 繰り返し利用できる資金の使い道。成長キャップは通常の練習と共通なので、伸びしろが
// 尽きた選手には効きにくい。疲労も溜まるので連打は難しい
export function mlPrivateCamp(s) {
  const cost = mlPrivateCampCost(s);
  if (s.money < cost) return s;
  const growthCap = mlGrowthCap(s.year, s.player);
  const player = { ...s.player };
  const before = player[player.focus];
  addAb(player, player.focus, 6, growthCap);
  AB_KEYS.filter(k => k !== player.focus).forEach(k => addAb(player, k, 2, growthCap));
  player.fatigue = Math.min(100, player.fatigue + 12);
  const gained = Math.round((player[player.focus] - before) * 10) / 10;
  return {
    ...s, player, money: s.money - cost,
    log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】私設強化合宿を実施（-${cost}万円）。${AB_LABEL[player.focus]}を中心に鍛え上げた（${AB_LABEL[player.focus]}+${gained}）`],
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
