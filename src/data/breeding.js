// 静的データ（Phase 1で src/main.jsx から分離）。純粋な定数のみ。

export const TYPE_ABKEYS = {
  SPR: ["sprint", "flat"], CLM: ["climb", "stamina"], RUL: ["flat", "stamina"],
  PUN: ["climb", "sprint"], TT: ["solo", "stamina"],
};

export const TEACH_KEYS = {
  climb: ["climb", "stamina"], sprint: ["sprint", "flat"], solo: ["solo", "stamina"],
  hill: ["climb", "sprint"], flat: ["flat", "stamina"], power: ["sprint", "stamina"],
};

export const PROTEGE_TEACHINGS = [
  { key: "king",    label: "王者の風格", lineage: "big",           keysMode: "top2",   sub: { mental: 8 },           match: m => (m.wins || 0) >= 12, desc: "大舞台で力を発揮し、師の得意能力を色濃く受け継ぐ" },
  { key: "ironman", label: "鉄人の系譜", lineage: "engine",        keysMode: "power",  sub: { mental: 4, build: 3 }, match: m => (m.races || 0) >= 90, desc: "消耗に強い無尽蔵のエンジンを受け継ぐ" },
  { key: "climb",   label: "山脈の記憶", lineage: "mount",         keysMode: "climb",  sub: { build: -6 },           match: m => m.type === "CLM", desc: "山の申し子の系譜（軽量な体格を受け継ぐ）" },
  { key: "sprint",  label: "豪脚の血統", lineage: "finisher",      keysMode: "sprint", sub: { accel: 8 },            match: m => m.type === "SPR", desc: "ゴール前の鬼の系譜（鋭い加速を受け継ぐ）" },
  { key: "tt",      label: "孤高の走法", lineage: "soloist",       keysMode: "solo",   sub: { mental: 4, accel: 3 }, match: m => m.type === "TT",  desc: "独走屋の系譜" },
  { key: "punch",   label: "変幻の技",   lineage: "puncheur",      keysMode: "hill",   sub: { accel: 6 },            match: m => m.type === "PUN", desc: "丘陵ハンターの系譜" },
  { key: "all",     label: "万能の教え", lineage: "allrounder_sp", keysMode: "top2",   sub: { accel: 3, mental: 3 }, match: () => true, desc: "脚質を選ばない万能型の教え" },
];

export const ARCH_BREED = {
  world1:         { ab: { flat: 2, climb: 2, sprint: 2, stamina: 2, solo: 2 }, plus: 3, note: "世界王者の血" },
  heroMulti:      { ability: "big", ab: { stamina: 2 }, plus: 2, note: "大舞台の英雄の血" },
  hero:           { ability: "big", note: "勝負師の血" },
  emperor:        { ab: { flat: 1, climb: 1, sprint: 1, stamina: 1, solo: 1 }, plus: 2, note: "帝王の血" },
  specialist_SPR: { ab: { sprint: 4 }, ability: "finisher", note: "豪脚の血" },
  specialist_CLM: { ab: { climb: 4 }, ability: "mount", note: "山岳の血" },
  specialist_RUL: { ab: { flat: 4 }, ability: "flatlander", note: "平坦の血" },
  specialist_PUN: { ab: { climb: 2, sprint: 2 }, ability: "puncheur", note: "丘陵の血" },
  specialist_TT:  { ab: { solo: 4 }, ability: "soloist", note: "独走の血" },
  domestique:     { ab: { stamina: 3 }, ability: "domestique", note: "献身の血" },
  nearly:         { sub: { mental: 8 }, note: "雪辱の血" },
  ironman:        { ab: { stamina: 4 }, ability: "iron", note: "鉄人の血" },
  latebloom:      { ab: { stamina: 2 }, note: "遅咲きの血" },
};

export const ML_SPECIAL_MATINGS = [
  { key: "absolute_king", title: "絶対王者の系譜", color: "#ffd24a", gold: "big", talent: 4, growth: 1,
    note: "二人の世界王者の血が交わり、頂点に立つ宿命を負って生まれた",
    test: c => c.keys.filter(k => k === "world1").length >= 2 },
  { key: "hero_emperor", title: "覇道義侠録", color: "#ff9f43", gold: "big", talent: 3, growth: 1,
    note: "帝王の覇道と英雄の義侠、二つの生き様が一人に宿る",
    test: c => c.keys.includes("emperor") && (c.keys.includes("hero") || c.keys.includes("heroMulti")) },
  { key: "iron_blood", title: "不屈の鉄血", color: "#8fb4c8", gold: "iron", talent: 2, growth: 0, extra: "tough",
    note: "鉄人の血を二重に受け継ぎ、決して壊れぬ肉体を得た",
    test: c => (c.keys.filter(k => k === "ironman").length + c.abs.filter(a => a === "iron").length) >= 2 },
  { key: "all_rounder", title: "万能王の血脈", color: "#9ae6b4", gold: "engine", talent: 3, growth: 1,
    note: "登坂と平地、相反する才能が融合し、地形を選ばぬ万能王が生まれた",
    test: c => { const up = k => k === "specialist_CLM" || k === "specialist_PUN"; const sp = k => k === "specialist_SPR" || k === "specialist_RUL" || k === "specialist_TT"; return (up(c.keys[0]) && sp(c.keys[1])) || (sp(c.keys[0]) && up(c.keys[1])); } },
  { key: "pure_blood", title: "純血の極み", color: "#ff5db1", gold: null, talent: 4, growth: 1, factorGold: true,
    note: "同じ系統の血が極限まで濃縮され、純血の頂点が結晶した",
    test: c => c.lineA && c.lineB && c.lineA === c.lineB && Math.min(c.genA, c.genB) >= 4 },
];

export const BREED_NICKS = {
  "SPR+SPR": { rank: "◎", label: "純血スプリンターの配合", ability: "finisher",     ab: { sprint: 5, flat: 2 } },
  "CLM+CLM": { rank: "◎", label: "純血クライマーの配合",   ability: "mount",        ab: { climb: 5, stamina: 2 } },
  "TT+TT":   { rank: "◎", label: "純血独走屋の配合",       ability: "soloist",      ab: { solo: 5, stamina: 2 } },
  "PUN+SPR": { rank: "◎", label: "豪脚パンチャーの黄金配合", ability: "finisher",     ab: { sprint: 4, climb: 3 } },
  "CLM+TT":  { rank: "◎", label: "独走クライマーの黄金配合", ability: "soloist",      ab: { climb: 4, solo: 3 } },
  "RUL+SPR": { rank: "◎", label: "平坦最強の黄金配合",       ability: "engine",       ab: { flat: 4, sprint: 3 } },
  "CLM+PUN": { rank: "○", label: "登坂職人の好配合",         ability: "mount",        ab: { climb: 4, sprint: 1 } },
  "PUN+TT":  { rank: "○", label: "変幻自在の好配合",         ability: "puncheur",     ab: { climb: 2, solo: 3 } },
  "RUL+TT":  { rank: "○", label: "鉄壁ルーラーの好配合",     ability: "engine",       ab: { flat: 3, solo: 2 } },
  "RUL+RUL": { rank: "○", label: "純血ルーラーの配合",       ability: "engine",       ab: { flat: 4, stamina: 2 } },
  "PUN+PUN": { rank: "○", label: "純血パンチャーの配合",     ability: "puncheur",     ab: { climb: 3, sprint: 2 } },
  "RUL+PUN": { rank: "○", label: "万能型の好配合",           ability: "allrounder_sp", ab: { flat: 2, climb: 2 } },
};
