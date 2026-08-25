// クリアポイント(CP)・アビリティ習得（メタ進行）。第13弾Phase0でlogic/support.jsから分離。
import { ASSIST_ROLES, GOLD_CONDITIONS, countRoleUses, countWins, mulberry, newRider } from "../../core/core.js";
import { AB_KEYS } from "../../data/abilities.js";
import { UNLOCK_TEMPLATES } from "../../data/course.js";
import { MLCP_DIFF_MUL, ML_CP_MILESTONES } from "../../data/economy.js";
import { ML_BADGE_SLOTS_BY_CLASS } from "../../data/gear.js";

export function upgradeGoldAbilities(r) {
  const abilities = r.abilities || [];
  const current = r.goldAbilities || [];
  const next = [...current];
  let changed = false;
  Object.keys(GOLD_CONDITIONS).forEach(id => {
    if (abilities.includes(id) && !next.includes(id) && GOLD_CONDITIONS[id](r)) { next.push(id); changed = true; }
  });
  return changed ? { ...r, goldAbilities: next } : r;
}

// 第39弾: r=>booleanの不透明な条件をgate/cur/need/unitへ構造化し、進捗の分子を取り出せるように
// した（マイライフのバッジ進捗UIが使う）。ACQUIRE_CONDITIONSは後方互換のため従来どおり
// {id: r=>boolean} 形で導出する。gateは脚質など「満たさない限り永久に到達不可」な前提
// （UIはgate不成立の行を表示しない）。
const podiumIn = (mon, rankMax) => r => (r.raceLog || []).some(e => e.monument === mon && e.rank <= rankMax) ? 1 : 0;
export const ACQUIRE_REQS = {
  mount:       { gate: r => r.type === "CLM", cur: countWins, need: 2, unit: "勝" },
  puncheur:    { gate: r => r.type === "PUN", cur: countWins, need: 2, unit: "勝" },
  flatlander:  { gate: r => r.type === "RUL", cur: countWins, need: 2, unit: "勝" },
  sprinter_sp: { gate: r => r.type === "SPR", cur: countWins, need: 2, unit: "勝" },
  soloist:     { gate: r => r.type === "TT", cur: countWins, need: 2, unit: "勝" },
  closer:      { cur: countWins, need: 4, unit: "勝" },
  escape:      { cur: r => countRoleUses(r, e => e.role === "breakaway"), need: 3, unit: "回" },
  domestique:  { cur: r => countRoleUses(r, e => ASSIST_ROLES.has(e.role)), need: 5, unit: "回" },
  iron:        { cur: r => (r.raceLog || []).length, need: 15, unit: "回" },
  big:         { cur: r => (r.raceLog || []).some(e => (e.name.includes("世界選手権") || e.name.includes("オリンピック")) && e.rank <= 3) ? 1 : 0, need: 1, unit: "" },
  // v28: 新特殊能力の後天習得条件
  finisher:    { cur: countWins, need: 5, unit: "勝" },
  engine:      { cur: r => (r.raceLog || []).length, need: 20, unit: "回" },
  // v34(C-2): 各モニュメント（古典）で表彰台に立つと、その古典専用の適性に開眼する余地が生まれる（脚質別）
  pave_sp:     { cur: podiumIn("pave", 3), need: 1, unit: "" },
  ardennes_sp: { cur: podiumIn("ardennes", 3), need: 1, unit: "" },
  autumn_sp:   { cur: podiumIn("autumn", 3), need: 1, unit: "" },
};
export const ACQUIRE_CONDITIONS = Object.fromEntries(
  Object.entries(ACQUIRE_REQS).map(([id, q]) => [id, r => (!q.gate || q.gate(r)) && q.cur(r) >= q.need])
);

// シーズンモードは従来どおり自動習得（据え置き・第39弾の対象外。理由はdevlog/wave39.md参照：
// 6名分の習得選択を毎月迫るのは作業でしかなく、シーズンの主体性は練習指定とロースター運用が担う）。
export function acquireNewAbility(r) {
  const abilities = r.abilities || [];
  if (abilities.length >= 3) return r;
  const eligible = Object.keys(ACQUIRE_CONDITIONS).filter(id => !abilities.includes(id) && ACQUIRE_CONDITIONS[id](r));
  if (eligible.length === 0 || Math.random() >= 0.15) return r;
  const id = eligible[Math.floor(Math.random() * eligible.length)];
  return { ...r, abilities: [...abilities, id] };
}

// 第44弾: バッジ枠はクラス別（ML_BADGE_SLOTS_BY_CLASS＝B1:3/A:4/PRO:5）。上限3個固定は撤廃したが
// 「撤廃」ではなく「キャリアで増やす」——各脚質の到達可能バッジは約10種あり、無制限にすると
// 全員が同じ組み合わせになり個性が消えるため（devlog/wave44.md）。
// maxSlots省略時は3（シーズン側の呼び出し・旧テスト等の後方互換）。上限に達している場合は
// 既存の1つを外して入れ替える（swapOutId省略時は失敗＝呼び出し側でUI選択させる）。
export function mlAcquireAbility(r, id, swapOutId, maxSlots = 3) {
  const abilities = r.abilities || [];
  if (abilities.includes(id) || !ACQUIRE_CONDITIONS[id] || !ACQUIRE_CONDITIONS[id](r)) return r;
  if (abilities.length < maxSlots) return { ...r, abilities: [...abilities, id] };
  if (!swapOutId || !abilities.includes(swapOutId)) return r;
  return { ...r, abilities: [...abilities.filter(a => a !== swapOutId), id] };
}

// 第44弾: バッジを外す（＝装備を解く）。ACQUIRE_CONDITIONSは累積実績を見るため、外しても
// 条件を満たしたままなら「付ける」でいつでも戻せる（goldAbilitiesの実績も無条件で保持される。
// hasAbility/hasGoldAbilityは常にabilities側をゲートに使うため、外している間は効果も発火しない）。
export function mlUnequipAbility(r, id) {
  const abilities = r.abilities || [];
  if (!abilities.includes(id)) return r;
  return { ...r, abilities: abilities.filter(a => a !== id) };
}

// 第44弾: プレイヤーの現在のバッジ枠数（最高到達クラス基準・降格しても減らない）。
export function mlBadgeSlots(ml) {
  const idx = ml && ml.classIdxBest != null ? ml.classIdxBest : (ml ? ml.classIdx : 0);
  return ML_BADGE_SLOTS_BY_CLASS[idx] ?? ML_BADGE_SLOTS_BY_CLASS[ML_BADGE_SLOTS_BY_CLASS.length - 1];
}

export const ABILITY_FILE_KEY = "roadrace_v12_ability_file";

export function loadAbilityFile() {
  try {
    const raw = localStorage.getItem(ABILITY_FILE_KEY);
    if (!raw) return { normal: [], gold: [] };
    const parsed = JSON.parse(raw);
    return { normal: Array.isArray(parsed.normal) ? parsed.normal : [], gold: Array.isArray(parsed.gold) ? parsed.gold : [] };
  } catch (e) { return { normal: [], gold: [] }; }
}

export function saveAbilityFile(data) {
  try { localStorage.setItem(ABILITY_FILE_KEY, JSON.stringify(data)); } catch (e) { /* noop */ }
}

export function noteAbilityDiscovery(riders) {
  const file = loadAbilityFile();
  const normalSet = new Set(file.normal);
  const goldSet = new Set(file.gold);
  let changed = false;
  (riders || []).forEach(r => {
    (r && r.abilities || []).forEach(id => { if (!normalSet.has(id)) { normalSet.add(id); changed = true; } });
    (r && r.goldAbilities || []).forEach(id => { if (!goldSet.has(id)) { goldSet.add(id); changed = true; } });
  });
  if (changed) saveAbilityFile({ normal: [...normalSet], gold: [...goldSet] });
}

export const bumpRosterAbAll = (state, amount) => ({
  ...state,
  roster: state.roster.map(r => ({ ...r, ...Object.fromEntries(AB_KEYS.map(k => [k, Math.min(94, Math.round(r[k] + amount))])) })),
});

export const bumpEquipLv = (state, amount) => ({
  ...state,
  // B1スタート時点のequipMax（3+classIdx=3+0）を超えないよう安全のためクランプ
  equip: { ...state.equip, frame: Math.min(3, state.equip.frame + amount), wheels: Math.min(3, state.equip.wheels + amount) },
});

export const addProdigyRookie = (state) => {
  const rng = mulberry(Date.now() % 999983 + state.roster.length * 7919);
  const banned = new Set(state.roster.map(r => r.name));
  // v24: age未指定だとnewRiderが22〜33歳のどれかをランダムに割り当ててしまい、成長タイプの
  // 組み合わせによっては加入した瞬間から衰え期の逸材が出て萎えるというフィードバックを受けた。
  // クリアポイントで確保する逸材は必ず18〜20歳の若手にし、どの成長タイプでも
  // 加入時点でまだ成長期／全盛期に入りたてであることを保証する
  const rookie = newRider(70, rng, { banned, forceProdigy: true, age: 18 + Math.floor(rng() * 3) });
  return { ...state, roster: [...state.roster, rookie] };
};

// 第13弾Phase3-D-4-c: 各件の効果を`fx`に構造化して併記（applyは不透明なクロージャで集計に
// 使えないため）。newgame_setup画面が「今回何が効いているか」を集計表示するのに使う
// （cpMilestoneSummary参照）。
export const CP_MILESTONES = [
  { cp: 5, label: "開幕資金 +100万円", desc: "毎シーズン開幕時の所持金へ自動加算される", fx: { budget: 100 }, apply: s => ({ ...s, budget: s.budget + 100 }) },
  { cp: 10, label: "★ 初期選手 全員能力+8", desc: "初期ロースター全員の能力値+8してスタート", fx: { abAll: 8 }, apply: s => bumpRosterAbAll(s, 8) },
  { cp: 15, label: "チーム設備 Lv1底上げ", desc: "フレーム・ホイールの強化レベルが+1された状態でスタート", fx: { equipLv: 1 }, apply: s => bumpEquipLv(s, 1) },
  { cp: 25, label: "★ 開幕資金 +400万円", desc: "毎シーズン開幕時の所持金へ自動加算される", fx: { budget: 400 }, apply: s => ({ ...s, budget: s.budget + 400 }) },
  { cp: 35, label: "開幕アイテム一式", desc: "決戦ホイール・エアロスーツ・リカバリーサプリ・調子アップを各2個ずつ所持", fx: { items: 2 }, apply: s => ({ ...s, inv: { ...s.inv, wheel: s.inv.wheel + 2, suit: s.inv.suit + 2, supp: s.inv.supp + 2, tune: s.inv.tune + 2 } }) },
  { cp: 50, label: "★★ 逸材新人を1名確保", desc: "成長ランクS確定の逸材が1名、追加でロースターに加入", fx: { rookie: 1 }, apply: s => addProdigyRookie(s) },
  { cp: 65, label: "初期選手 全員能力+5", desc: "初期ロースター全員の能力値がさらに+5", fx: { abAll: 5 }, apply: s => bumpRosterAbAll(s, 5) },
  { cp: 75, label: "★★ チーム設備 Lv2底上げ", desc: "フレーム・ホイールの強化レベルがさらに+2", fx: { equipLv: 2 }, apply: s => bumpEquipLv(s, 2) },
  { cp: 90, label: "開幕資金 +300万円", desc: "毎シーズン開幕時の所持金へ自動加算される", fx: { budget: 300 }, apply: s => ({ ...s, budget: s.budget + 300 }) },
  { cp: 100, label: "★★★ 逸材新人をもう1名確保＋全員能力+10", desc: "成長ランクS確定の逸材がもう1名加入し、ロースター全員の能力値も+10", fx: { rookie: 1, abAll: 10 }, apply: s => bumpRosterAbAll(addProdigyRookie(s), 10) },
  // v37: 高CP帯の拡張（周回を重ねたプレイヤーへのさらなる開幕強化）
  { cp: 130, label: "開幕資金 +600万円", desc: "毎シーズン開幕時の所持金へ自動加算される", fx: { budget: 600 }, apply: s => ({ ...s, budget: s.budget + 600 }) },
  { cp: 160, label: "★★★ チーム設備 Lv2底上げ", desc: "フレーム・ホイールの強化レベルがさらに+2", fx: { equipLv: 2 }, apply: s => bumpEquipLv(s, 2) },
  { cp: 200, label: "★★★★ 逸材新人をもう1名＋全員能力+12", desc: "成長ランクS確定の逸材がさらに1名加入し、ロースター全員の能力値も+12", fx: { rookie: 1, abAll: 12 }, apply: s => bumpRosterAbAll(addProdigyRookie(s), 12) },
  // v38(#5): 200pt頭打ちの解消。さらに上のCP帯を追加し、周回の到達目標を延伸する。
  { cp: 250, label: "開幕資金 +1000万円", desc: "毎シーズン開幕時の所持金へ自動加算される", fx: { budget: 1000 }, apply: s => ({ ...s, budget: s.budget + 1000 }) },
  { cp: 320, label: "★★★★ チーム設備 Lv3底上げ", desc: "フレーム・ホイールの強化レベルがさらに+3", fx: { equipLv: 3 }, apply: s => bumpEquipLv(s, 3) },
  { cp: 400, label: "★★★★★ 逸材新人をもう1名＋全員能力+15", desc: "成長ランクS確定の逸材がさらに1名加入し、ロースター全員の能力値も+15", fx: { rookie: 1, abAll: 15 }, apply: s => bumpRosterAbAll(addProdigyRookie(s), 15) },
];

export function applyCpMilestones(state, totalEarnedCP) {
  return CP_MILESTONES.filter(m => totalEarnedCP >= m.cp).reduce((s, m) => m.apply(s), state);
}

// 第13弾Phase3-D-4-c: newgame_setup画面用。解禁済みマイルストーンの`fx`を合算し、
// 「今回の開幕で実際に何が効いているか」を1つの要約にする（争点1・案A）。
export function cpMilestoneSummary(totalEarnedCP) {
  const acc = { budget: 0, abAll: 0, equipLv: 0, rookie: 0, items: 0 };
  CP_MILESTONES.filter(m => totalEarnedCP >= m.cp).forEach(m => {
    const fx = m.fx || {};
    acc.budget += fx.budget || 0; acc.abAll += fx.abAll || 0; acc.equipLv += fx.equipLv || 0;
    acc.rookie += fx.rookie || 0; acc.items += fx.items || 0;
  });
  return acc;
}

export function mlCpPerks(totalCP) {
  const acc = { money: 0, pop: 0, eval: 0, growthLottery: 0, boonBonus: 0 };
  ML_CP_MILESTONES.filter(m => totalCP >= m.cp).forEach(m => {
    const p = m.perk || {};
    acc.money += p.money || 0; acc.pop += p.pop || 0; acc.eval += p.eval || 0;
    acc.growthLottery += p.growthLottery || 0; acc.boonBonus += p.boonBonus || 0;
  });
  return acc;
}

export function computeClearPoints(year, difficultyId) {
  const speedBonus = Math.max(0, 15 - Math.max(0, year - 2) * 2);
  const diffBonus = { easy: 0, normal: 4, hard: 10, oni: 22 }[difficultyId] || 0;
  return 5 + speedBonus + diffBonus;
}

// v37: マイライフのキャリアからも生涯クリアポイント(CP)を獲得できるように（メタ進行の統合）。
// 引退時に、通算成績・タイトル・クラシック・世界ランク・現役年数から算出する純関数。
export function computeMyLifeClearPoints(ml) {
  if (!ml) return { total: 0, parts: [] };
  const wins = ml.careerWins || 0;
  const bigWins = ml.careerBigWins || 0;
  const titles = ml.careerTitles || 0;
  const classics = ml.careerClassics || 0;
  const best = ml.worldRankBest;
  const years = ml.year || 1;
  const parts = [];
  parts.push({ label: "完走ボーナス", cp: 3 });
  const winCp = Math.min(40, wins); if (winCp) parts.push({ label: `通算${wins}勝`, cp: winCp });
  const bigCp = Math.min(30, bigWins * 2); if (bigCp) parts.push({ label: `格上勝利${bigWins}回`, cp: bigCp });
  const titleCp = titles * 8; if (titleCp) parts.push({ label: `世界/五輪タイトル${titles}回`, cp: titleCp });
  const classicCp = classics * 5; if (classicCp) parts.push({ label: `クラシック制覇${classics}回`, cp: classicCp });
  let rankCp = 0;
  if (best != null) rankCp = best === 1 ? 30 : best <= 3 ? 20 : best <= 10 ? 12 : best <= 50 ? 5 : 0;
  if (rankCp) parts.push({ label: `世界最高${best}位`, cp: rankCp });
  const longCp = Math.min(10, Math.floor(years * 0.5)); if (longCp) parts.push({ label: `現役${years}年`, cp: longCp });
  const rawTotal = parts.reduce((a, b) => a + b.cp, 0);
  // v38(#5/#6): 難易度でCP獲得を増減。イージー周回でCPが溢れる（3人殿堂で200pt頭打ち）問題に対し、
  // イージーは獲得を抑え、挑戦（ノーマル以上）ほど多く報いる＝CPは「難所を越えた勲章」になる。
  const diffMul = MLCP_DIFF_MUL[ml.difficulty] ?? 1;
  const total = Math.round(rawTotal * diffMul);
  if (diffMul !== 1) parts.push({ label: `難易度補正 ×${diffMul}`, cp: total - rawTotal });
  return { total, parts, diffMul };
}

// v37: CP解禁の一覧（生涯評価画面で「何がいつ解禁されるか」を見せる）。
// コース解禁(unlockCP)＋シーズン開幕ミルストーン(CP_MILESTONES)＋マイライフ特典(ML_CP_MILESTONES)を統合。
export function cpUnlockRows(totalCP) {
  const rows = [];
  (UNLOCK_TEMPLATES || []).forEach(t => rows.push({ cp: t.unlockCP || 0, category: "コース", label: `新コース「${t.kind}」`, unlocked: totalCP >= (t.unlockCP || 0) }));
  (CP_MILESTONES || []).forEach(m => rows.push({ cp: m.cp, category: "シーズン開幕", label: m.label, unlocked: totalCP >= m.cp }));
  ML_CP_MILESTONES.forEach(m => rows.push({ cp: m.cp, category: "マイライフ", label: m.label, unlocked: totalCP >= m.cp }));
  rows.sort((a, b) => a.cp - b.cp);
  return rows;
}
