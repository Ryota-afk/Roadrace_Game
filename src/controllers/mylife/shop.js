// マイライフのショップ・アイテム・私生活系の状態遷移（純粋なreducer関数）。
// controllers/season/shop.js の対（マイライフ側は setMl への薄い接続）。
import { MONTHS } from "../../data/course.js";
import { AB_KEYS, AB_LABEL, ABILITIES } from "../../data/abilities.js";
import {
  ML_AB_COACH_KEY, ML_CARS, ML_COACH_MAX_BY_CLASS, ML_COACH_SIGNING, ML_COACH_SLOTS_BY_CLASS, ML_DEV_PROJECT, ML_GEAR,
  ML_HOUSES, ML_SCI_BAD_POOL, ML_SCI_GOOD_POOL, ML_SCI_PROJECT, ML_STOCK_ITEMS, ML_GROWTH_POW_UP_PRICE, ML_GROWTH_SHIFT_PRICE,
  ML_PART_UPGRADE_COST, ML_PART_LV_MAX,
} from "../../data/gear.js";
import { SLOT_LABEL } from "../../data/economy.js";
import { GROWTHPOW_ORDER, GROWTH_ORDER } from "../../data/progression.js";
import { PART_SLOTS, PARTS } from "../../sim/race.js";
import {
  addAb, mlAcquireAbility, mlBadgeSlots, mlDevProjectSuccessRate, mlEquipBlood, mlGrantAbilityDirect, mlGrowthCapFor,
  mlPrivateCampCost, mlProjectMonthsElapsed, mlSciProjectSuccessRate, mlSlotUsed, mlUnequipAbility,
} from "../../logic/support.js";

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

// 第88弾(devlog/wave88.md): ワンオフ機材の開発。開発方針(尖らせる/まとめる)で
// できあがるパーツの形を決める（確率分岐だけの「運任せ」にしないための工夫）。
// スロットごとの能力の顔ぶれ・tier3の合計値は data/parts.js の既存パーツから決めた
// （frame:flat/climb/sprint=15、tire:stamina/solo/sprint=12、wheels:flat/climb=12、
// nutrition:stamina/sprint=10）。⚠️具体的な配分係数(1.5/1.3/1.15/0.5倍)は設計文書に
// 明記が無いため実装時に決めた値——数値バランスの検証対象はあくまで初期費用・追加投資額・
// 成功率の式（devlog/wave88.md「計測必須」参照）で、この配分自体は演出の範囲。
const DEV_SLOT_STAT_KEYS = {
  frame: ["flat", "climb", "sprint"], tire: ["stamina", "solo", "sprint"],
  wheels: ["flat", "climb"], nutrition: ["stamina", "sprint"],
};
const DEV_TIER3_AB_SUM = { frame: 15, tire: 12, wheels: 12, nutrition: 10 };

function buildCustomPartAb(slot, policy, bigSuccess) {
  const keys = [...DEV_SLOT_STAT_KEYS[slot]].sort(() => Math.random() - 0.5);
  const base = DEV_TIER3_AB_SUM[slot];
  const ab = {};
  if (bigSuccess) {
    const per = Math.round((base * 1.5) / keys.length);
    keys.forEach(k => { ab[k] = per; });
  } else if (policy === "broad") {
    const per = Math.round((base * 1.15) / keys.length);
    keys.forEach(k => { ab[k] = per; });
  } else {
    ab[keys[0]] = Math.round(base * 1.3);
    ab[keys[1]] = -Math.round(base * 0.5);
  }
  return ab;
}

export function mlStartDevProject(s, slot, policy) {
  if (s.devProject || s.money < ML_DEV_PROJECT.initCost || !PART_SLOTS.includes(slot)) return s;
  return {
    ...s, money: s.money - ML_DEV_PROJECT.initCost,
    devProject: { slot, policy, invested: ML_DEV_PROJECT.initCost, startYear: s.year, startMonth: s.month },
    log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】${SLOT_LABEL[slot]}の自分専用機材の開発に着手した（-${ML_DEV_PROJECT.initCost}万円）`],
  };
}

export function mlAddDevProject(s, amount) {
  if (!s.devProject || s.money < amount) return s;
  return { ...s, money: s.money - amount, devProject: { ...s.devProject, invested: s.devProject.invested + amount } };
}

export function mlFinishDevProject(s) {
  const p = s.devProject;
  if (!p) return s;
  if (mlProjectMonthsElapsed(p, s.year, s.month) < ML_DEV_PROJECT.minMonths) return s;
  const successRate = mlDevProjectSuccessRate(p, ML_DEV_PROJECT);
  if (Math.random() >= successRate) {
    return {
      ...s, devProject: null,
      log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】試作は形にならなかった。${p.invested}万円を投じたが、狙った性能は出せなかった`],
    };
  }
  const bigSuccess = Math.random() < ML_DEV_PROJECT.bigSuccessChance;
  const label = `${s.player.name}専用${SLOT_LABEL[p.slot]}`;
  const partId = `custom_${p.slot}_${s.year}_${s.month}_${Math.floor(Math.random() * 1000)}`;
  const ab = buildCustomPartAb(p.slot, p.policy, bigSuccess);
  // 完成した一点物は即座に装着する（screens/mylife/events.jsxのパーツ装備UIは静的PARTSしか
  // 一覧しないため、ここで装着しないと選手が二度と身に着ける手段が無くなる）
  const player = {
    ...s.player, parts: { ...s.player.parts, [p.slot]: partId },
    customParts: { ...(s.player.customParts || {}), [partId]: { slot: p.slot, tier: 4, label, ab } },
  };
  return {
    ...s, player, devProject: null,
    log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】完成した——「${label}」（${p.invested}万円を投じて${bigSuccess ? "大成功" : "成功"}）`],
  };
}

// 第88弾(devlog/wave88.md): 科学トレーニング。成功しても特殊能力の枠（B1:3/A:4/PRO:5）を
// 使うため、枠が満杯なら必ず1つ手放す（「今回は見送る」は用意しない・ユーザー確定）。
// 手放す候補は常に非空——枠満杯(mlSlotUsed>=maxSlots)を満たす時点で、その枠を
// 占めているのは必ずbadge/ketsumyaku（非taishitsu）がmaxSlots個以上ある状態なので、
// mlBadgeKind(id)!=="taishitsu"の候補が構造的に0件にはならない（rider.jsxの
// swapCandidatesと同じ前提）。
export function mlStartSciProject(s) {
  if (s.sciProject || s.sciPendingId || s.money < ML_SCI_PROJECT.initCost) return s;
  return {
    ...s, money: s.money - ML_SCI_PROJECT.initCost,
    sciProject: { invested: ML_SCI_PROJECT.initCost, startYear: s.year, startMonth: s.month },
    log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】最新の科学トレーニングに着手した（-${ML_SCI_PROJECT.initCost}万円）`],
  };
}

export function mlAddSciProject(s, amount) {
  if (!s.sciProject || s.money < amount) return s;
  return { ...s, money: s.money - amount, sciProject: { ...s.sciProject, invested: s.sciProject.invested + amount } };
}

function mlGrantSciReward(s, id, swapOutId) {
  const maxSlots = mlBadgeSlots(s);
  const player = mlGrantAbilityDirect(s.player, id, swapOutId, maxSlots);
  if (player === s.player) return s;
  const gold = Math.random() < ML_SCI_PROJECT.goldChance;
  const finalPlayer = gold ? { ...player, goldAbilities: [...(player.goldAbilities || []), id] } : player;
  const swapLine = swapOutId ? `「${ABILITIES[swapOutId].label}」を手放し、` : "";
  return {
    ...s, player: finalPlayer, sciPendingId: null,
    log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】${swapLine}身体が応えた——「${ABILITIES[id].label}」を身につけた${gold ? "（金の状態で）" : ""}`],
  };
}

export function mlFinishSciProject(s) {
  const p = s.sciProject;
  if (!p) return s;
  if (mlProjectMonthsElapsed(p, s.year, s.month) < ML_SCI_PROJECT.minMonths) return s;
  const successRate = mlSciProjectSuccessRate(p, ML_SCI_PROJECT);
  const held = s.player.abilities || [];
  if (Math.random() >= successRate) {
    const pool = ML_SCI_BAD_POOL.filter(id => !held.includes(id));
    const id = (pool.length ? pool : ML_SCI_BAD_POOL)[Math.floor(Math.random() * (pool.length ? pool.length : ML_SCI_BAD_POOL.length))];
    const player = { ...s.player, abilities: [...held, id] };
    return {
      ...s, player, sciProject: null,
      log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】身体が悲鳴を上げた——「${ABILITIES[id].label}」を負った（${p.invested}万円を投じたが不調に終わった）`],
    };
  }
  const pool = ML_SCI_GOOD_POOL.filter(id => !held.includes(id));
  if (!pool.length) {
    return { ...s, sciProject: null, log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】身体は応えたが、これ以上学べる技術が見当たらなかった`] };
  }
  const id = pool[Math.floor(Math.random() * pool.length)];
  const maxSlots = mlBadgeSlots(s);
  if (mlSlotUsed(s.player) >= maxSlots) return { ...s, sciProject: null, sciPendingId: id };
  return mlGrantSciReward(s, id, null);
}

export function mlSciConfirmSwap(s, swapOutId) {
  if (!s.sciPendingId) return s;
  return mlGrantSciReward(s, s.sciPendingId, swapOutId);
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

// 第39弾: 条件を満たしたバッジをプレイヤーが選んで習得する（月15%抽選の廃止）。
// 第44弾: 所持枠はクラス別（B1:3/A:4/PRO:5・最高到達クラス基準）。枠が埋まっている場合は
// swapOutIdで指定した1個と入れ替える（省略時は枠に空きがある場合のみ習得できる）。
export function mlAcquireBadge(s, id, swapOutId) {
  const player = mlAcquireAbility(s.player, id, swapOutId, mlBadgeSlots(s));
  return player === s.player ? s : { ...s, player };
}

// 第44弾: バッジを外す（装備を解く）。累積実績（goldAbilities含む）は失われず、
// 「付ける」でいつでも戻せる。第47弾: 体質（taishitsu）はmlUnequipAbility側で弾かれるため
// ここでは何もせず`s`が返る（UIも体質にははずすボタンを出さない）。
export function mlUnequipBadge(s, id) {
  const player = mlUnequipAbility(s.player, id);
  return player === s.player ? s : { ...s, player };
}

// 第47弾: 血脈を枠に装着する。bloodAbilitiesに記録済みのものだけが対象で、
// 枠に空きが無ければ何も起きない（UIが「空き枠なし」を表示する）。
export function mlEquipBloodBadge(s, id) {
  const player = mlEquipBlood(s.player, id, mlBadgeSlots(s));
  return player === s.player ? s : { ...s, player };
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
