// 血統表・配合表記・因子図鑑。第13弾Phase0でlogic/support.jsから分離。
import { legendBloodId, loadMlLegends, loadBloodlines, mlBloodlineTier } from "../../breeding/breeding.js";
import { ABILITIES, TYPES } from "../../data/abilities.js";
import { BREED_NICKS } from "../../data/breeding.js";
import { APT_GRADE_COLOR, DISCIPLINES } from "../../data/progression.js";
import { C } from "../../data/theme.js";
import { riderAptitudes } from "../shared/growth.js";

export function mlGradeColor(g) {
  return g === "SS" ? "#ff5db1" : g === "S" ? "#ffd24a" : g === "A" ? "#ff9f43" : g === "B" ? "#6cc8e5" : g === "C" ? "#9aa7b4" : "#7a828c";
}

export function bloodIdToName(id, map) {
  if (!id) return "？";
  if (map && map[id]) return map[id].name;
  const m = /^b:(.+)#\d+$/.exec(id) || /^n:(.+)$/.exec(id);
  return m ? m[1] : "？";
}

export function buildBloodMap(legends) {
  const map = {};
  (legends || []).forEach(l => { const id = legendBloodId(l); if (id) map[id] = l; });
  return map;
}

// v38(#9 B-4): 系譜フォレスト。殿堂選手を系統（lineageName）ごとにまとめ、世代順に親子の連なりを
// 返す純関数。ダイナスティ（血の連なり）を可視化し、A案（統合ダイナスティ）の入口にする。
// 戻り値: [{ lineageName, tier, size, members: [{name,type,generation,plusValue,overall,nickname,parents:[name]}] }]
export function mlLineageForest(legends) {
  const legs = legends || loadMlLegends();
  const map = buildBloodMap(legs);
  const blood = loadBloodlines();
  const groups = {};
  legs.forEach(l => {
    const key = l.lineageName || `${l.name || "無名"}系`;
    (groups[key] = groups[key] || []).push(l);
  });
  return Object.entries(groups).map(([lineageName, members]) => {
    const rec = blood[lineageName];
    const tier = mlBloodlineTier(rec);
    const rows = members
      .slice()
      .sort((a, b) => (a.generation || 0) - (b.generation || 0) || (a.retiredAt || 0) - (b.retiredAt || 0))
      .map(l => ({
        name: l.name, type: l.type, generation: l.generation || 0, plusValue: l.plusValue || 0,
        overall: l.overall || 0, nickname: l.nickname || null,
        parents: (l.parents || []).map(pid => bloodIdToName(pid, map)).filter(n => n && n !== "？"),
      }));
    return { lineageName, tier, size: members.length, members: rows };
  }).sort((a, b) => (b.tier.tier - a.tier.tier) || (b.size - a.size));
}

export function breedNickTableRows() {
  return Object.entries(BREED_NICKS)
    .map(([k, v]) => ({ pair: k.split("+"), ...v }))
    .sort((a, b) => (a.rank === b.rank ? 0 : a.rank === "◎" ? -1 : b.rank === "◎" ? 1 : a.rank === "○" ? -1 : 1));
}

// v38(#9 B-3): 因子図鑑。殿堂入りした歴代選手が「残した因子」を横断的に集計する純関数。
// ウイポの因子集めに相当し、周回を重ねるほど脚質・特能・適性の因子が star（保有選手数）で貯まる。
// これらは既存の系統ボーナス（mlBloodlineBonus）で配合・弟子継承に効いており、その"収集"を可視化する。
// 戻り値: [{ category, items: [{key,label,count,color,members:[name...]}] }]（count降順）
export function mlFactorCollection(legends) {
  const legs = legends || loadMlLegends();
  const typeC = {}, abilC = {}, aptC = {};
  const typeMembers = {}, abilMembers = {}, aptMembers = {};
  const push = (m, k, name) => { (m[k] = m[k] || []); if (name && m[k].length < 8 && !m[k].includes(name)) m[k].push(name); };
  legs.forEach(l => {
    if (l.type) { typeC[l.type] = (typeC[l.type] || 0) + 1; push(typeMembers, l.type, l.name); }
    (l.specialAbilities || []).forEach(id => {
      if (ABILITIES[id] && !ABILITIES[id].bad) { abilC[id] = (abilC[id] || 0) + 1; push(abilMembers, id, l.name); }
    });
    if (l.finalAbilities) {
      const r = { ...l.finalAbilities, type: l.type };
      riderAptitudes(r).forEach(a => {
        if (a.grade === "S" || a.grade === "A") { aptC[a.key] = (aptC[a.key] || 0) + 1; push(aptMembers, a.key, l.name); }
      });
    }
  });
  const sortItems = (obj, members, labelFn, colorFn) => Object.entries(obj)
    .map(([k, count]) => ({ key: k, label: labelFn(k), count, color: colorFn ? colorFn(k) : C.purple, members: members[k] || [] }))
    .sort((a, b) => b.count - a.count);
  return [
    { category: "脚質因子", icon: "🚴", items: sortItems(typeC, typeMembers, k => (TYPES[k] ? TYPES[k].label : k), k => (TYPES[k] ? TYPES[k].color : C.sub)) },
    { category: "特能因子", icon: "✨", items: sortItems(abilC, abilMembers, k => (ABILITIES[k] ? ABILITIES[k].label : k)) },
    { category: "適性因子（S/A適性）", icon: "🏔️", items: sortItems(aptC, aptMembers, k => (DISCIPLINES[k] ? DISCIPLINES[k].label : k), k => APT_GRADE_COLOR.A) },
  ];
}
