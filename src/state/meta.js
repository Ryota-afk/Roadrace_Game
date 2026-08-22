// メタ進行（プレイ跨ぎの永続データ）：クリアポイント・CPショップ・累積タイトル台帳。
// state/state.js から分離（第15弾F）。localStorageキー：roadrace_v12_meta / roadrace_v12_titles。
export const META_KEY = "roadrace_v12_meta";

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] };
    const m = JSON.parse(raw);
    // v37: CPショップ用に cpSpent（累計使用CP）・cpUnlocks（購入済みid）を保持
    return { totalEarnedCP: m.totalEarnedCP || 0, cpSpent: m.cpSpent || 0, cpUnlocks: Array.isArray(m.cpUnlocks) ? m.cpUnlocks : [] };
  } catch (e) { return { totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] }; }
}
// v37: CPショップ。貯めたCP（残高＝totalEarnedCP−cpSpent）を使って恒久解禁を購入する。
export function cpBalance(meta) { return Math.max(0, (meta.totalEarnedCP || 0) - (meta.cpSpent || 0)); }

// 購入式の恒久解禁カタログ（従来の自動ミルストーンとは別の"選んで買う"プレミアム枠）。
export const CP_SHOP = [
  { id: "s_rookie", cost: 45, category: "シーズン", label: "エース級新人 確定枠", desc: "シーズン開始時、成長ランクS確定の逸材が1名追加加入", season: { prodigyRookie: 1 } },
  { id: "s_budget", cost: 30, category: "シーズン", label: "開幕資金 +800万円", desc: "毎シーズン開始時の所持資金へ自動加算される", season: { budget: 800 } },
  { id: "s_equip", cost: 55, category: "シーズン", label: "全設備 Lv+3", desc: "フレーム・ホイールの強化レベルが+3された状態でスタート", season: { equipLv: 3 } },
  { id: "m_gold", cost: 60, category: "マイライフ", label: "デビュー時 特殊能力を金で確定", desc: "新人が必ず特殊能力を1つ、金の状態でデビューする", mylife: { debutGold: true } },
  { id: "m_growth", cost: 45, category: "マイライフ", label: "初期成長力 +1段 確定", desc: "デビュー時、成長力が確定で1段階アップ", mylife: { growthUp: true } },
  { id: "m_money", cost: 25, category: "マイライフ", label: "支度金 +300万円", desc: "デビュー時の所持金へ自動加算される", mylife: { money: 300 } },
  { id: "m_reroll", cost: 35, category: "マイライフ", label: "デビュー特能運 大幅アップ（リセマラ）", desc: "デビュー当たり特能（天啓/天賦の才）の抽選が大きく上がる", mylife: { boonBonus: 0.25 } },
  { id: "x_boost", cost: 70, category: "特別", label: "初期能力 大幅ブースト", desc: "シーズンでは全選手の能力+6、マイライフではデビュー時の能力+6でスタートする", season: { rosterBoost: 6 }, mylife: { statBoost: 6 } },
  // v38(#5): 高CP帯の使い道を拡充（200ptで頭打ちの解消）。既存perk枠を再利用し、周回で貯めたCPを
  // 長く注ぎ込める上位枠を用意。全買いに約1000CP必要になり、CPが「貯まりきる」感覚を解消する。
  { id: "s_rookie2", cost: 100, category: "シーズン", label: "エース級新人 確定枠（2人目）", desc: "シーズン開始時、成長ランクS確定の逸材がさらに1名加入（計2名）", season: { prodigyRookie: 1 } },
  { id: "s_equip2", cost: 95, category: "シーズン", label: "全設備 Lv+3（さらに）", desc: "フレーム・ホイールの強化レベルがさらに+3された状態でスタート", season: { equipLv: 3 } },
  { id: "s_budget2", cost: 60, category: "シーズン", label: "開幕資金 +1500万円", desc: "毎シーズン開始時の所持資金へ自動加算される", season: { budget: 1500 } },
  { id: "m_reroll2", cost: 80, category: "マイライフ", label: "デビュー特能運 特大アップ（リセマラ）", desc: "デビュー当たり特能（天啓/天賦の才）の抽選がさらに大きく上がる", mylife: { boonBonus: 0.30 } },
  { id: "m_money2", cost: 55, category: "マイライフ", label: "支度金 +700万円", desc: "デビュー時の所持金へ自動加算される", mylife: { money: 700 } },
  { id: "x_boost2", cost: 120, category: "特別", label: "初期能力 特大ブースト", desc: "シーズンでは全選手の能力+6、マイライフではデビュー時の能力+6でスタート（初期能力ブーストと重複購入可・合計+12）", season: { rosterBoost: 6 }, mylife: { statBoost: 6 } },
  // v51(第12弾12-C): 「開始時ブースト」ではなく「恒久的な上限拡張」の新カテゴリ。
  // 12-A（年俸制）・12-B（パーツ強化）の実測値を踏まえた終盤向けの追加投資先。
  { id: "s_staffmax", cost: 50, category: "シーズン", label: "スタッフ枠 +1", desc: "全クラスでスタッフを1名多く雇用できるようになる（恒常）", season: { staffMaxBonus: 1 } },
  { id: "s_rostermax", cost: 45, category: "シーズン", label: "所属枠 +2", desc: "全クラスでロースターの上限が2名増える（恒常）", season: { rosterMaxBonus: 2 } },
  { id: "m_partlvmax", cost: 40, category: "マイライフ", label: "パーツ強化の上限 +2", desc: "装着中パーツをLv7まで強化できるようになる（恒常）", mylife: { partLvMaxBonus: 2 } },
  { id: "s_salarydiscount", cost: 60, category: "シーズン", label: "年俸交渉術", desc: "選手の年俸が一律10%割安になる（恒常）", season: { salaryDiscountMul: 0.9 } },
];
export function cpOwned(meta, id) { return (meta.cpUnlocks || []).includes(id); }
export function cpBuy(meta, id) {
  const item = CP_SHOP.find(x => x.id === id);
  if (!item || cpOwned(meta, id) || cpBalance(meta) < item.cost) return meta;
  return { ...meta, cpSpent: (meta.cpSpent || 0) + item.cost, cpUnlocks: [...(meta.cpUnlocks || []), id] };
}
export function cpShopSeasonPerks(meta) {
  const acc = { prodigyRookie: 0, budget: 0, equipLv: 0, rosterBoost: 0, staffMaxBonus: 0, rosterMaxBonus: 0, salaryDiscountMul: 1 };
  CP_SHOP.forEach(it => {
    if (!cpOwned(meta, it.id)) return;
    const s = it.season || {};
    acc.prodigyRookie += s.prodigyRookie || 0; acc.budget += s.budget || 0; acc.equipLv += s.equipLv || 0; acc.rosterBoost += s.rosterBoost || 0;
    acc.staffMaxBonus += s.staffMaxBonus || 0; acc.rosterMaxBonus += s.rosterMaxBonus || 0;
    if (s.salaryDiscountMul) acc.salaryDiscountMul *= s.salaryDiscountMul;
  });
  return acc;
}
export function cpShopMylifePerks(meta) {
  const acc = { debutGold: false, growthUp: false, money: 0, boonBonus: 0, statBoost: 0, partLvMaxBonus: 0 };
  CP_SHOP.forEach(it => { if (cpOwned(meta, it.id)) { const m = it.mylife || {}; if (m.debutGold) acc.debutGold = true; if (m.growthUp) acc.growthUp = true; acc.money += m.money || 0; acc.boonBonus += m.boonBonus || 0; acc.statBoost += m.statBoost || 0; acc.partLvMaxBonus += m.partLvMaxBonus || 0; } });
  return acc;
}

export function saveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* noop */ }
}

export const TITLES_KEY = "roadrace_v12_titles";

export function loadTitles() {
  try { const raw = localStorage.getItem(TITLES_KEY); const o = raw ? JSON.parse(raw) : {}; return (o && typeof o === "object") ? o : {}; } catch (e) { return {}; }
}

export function recordTitle(kind) {
  if (!kind) return;
  const t = loadTitles();
  t[kind] = (t[kind] || 0) + 1;
  try { localStorage.setItem(TITLES_KEY, JSON.stringify(t)); } catch (e) { /* noop */ }
}
