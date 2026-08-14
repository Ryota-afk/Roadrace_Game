// 静的データ（Phase 1で src/main.jsx から分離）。純粋な定数のみ。
import { C } from "./theme.js";

export const CLASSES = [
  { id: "B1", label: "クラス B1", prizeMul: 1.0, need: 45, scout: 58 },
  { id: "A",  label: "クラス A",  prizeMul: 2.0, need: 50, scout: 66 },
  { id: "PRO", label: "クラス PRO", prizeMul: 3.5, need: 60, scout: 74 },
];

// v50(第11弾Phase1・1-D): シーズンのポイントを「上位10位内の全選手合算」へ変更したことで、
// 1レースあたりの獲得ptが従来（自チーム最上位1人分だけ）よりかなり増えた。CLASSES.needは
// マイライフの昇格判定（controllers/mylife/month.js、ポイント式は変更していない＝旧のまま）
// とも共有しているため、needの値自体は変えず、シーズン側だけ表示・判定に掛ける倍率として
// 独立させる。実測（scratchpad/need_calib.mjs・25チーム構成でのシーズン相当11ヶ月の
// AIチーム獲得pt平均）：B1平均159/A平均178.5/PRO平均202。旧式では平均AI獲得pt≒need×1.38
// だったため、同じ「needは平均よりやや控えめな到達可能ライン」という関係を保つ倍率として
// 2.5を採用（B1:112.5≈115／A:125≈130／PRO:150）。**実プレイでの昇格成功率を見て
// 要再調整**（devlog/wave11.md参照）。
export const SEASON_NEED_MUL = 2.5;

// シーズン側だけが参照する「実際の昇格ライン」。CLASSES[classIdx].needそのものは
// マイライフと共有の生値として変えず、表示・判定はこの関数経由に統一する。
export function seasonNeed(classIdx) {
  return Math.round(CLASSES[classIdx].need * SEASON_NEED_MUL);
}

// v35(バランス): abilCap＝AI選手の能力値上限。newRiderは従来どこでも一律94で頭打ちだったため、
// PRO帯ではaiMul（1.25/1.55）を掛けても地力がすべて94でクランプされ、ハードと鬼がPROで完全に
// 同一の強さになっていた（難易度つまみが高クラスで効かない不具合。実測：PRO/y8でhard5.6位＝oni5.5位）。
// 最小の是正として、opt-inの「無理ゲー」帯である鬼だけ上限を94→104へ引き上げ、PROでもハードより
// 明確に強い化け物集団にする。easy/normal/hardは94で据え置き＝これまでの手応えを一切変えない。
// 鬼のプレイヤー成長上限は112で、AI上限104を超えるため、極めた選手なら地力で上回る脱出口は残る。
export const DIFFICULTIES = [
  { id: "easy", label: "イージー", desc: "他チームはかなり控えめ。まずはここでクリアを目指そう", aiMul: 0.80, growthCap: 88, needCP: 0, abilCap: 94 },
  { id: "normal", label: "ノーマル", desc: "標準的な強さ。歯応えのある本来のバランス", aiMul: 1.0, growthCap: 94, needCP: 4, abilCap: 94 },
  { id: "hard", label: "ハード", desc: "他チームは強豪揃い。選手の成長上限も上がるが、相手はさらに本気を出してくる", aiMul: 1.25, growthCap: 102, needCP: 10, abilCap: 94 },
  { id: "oni", label: "鬼", desc: "完全な無理ゲー。成長上限は大幅に上がるが、他チームは化け物揃い。生半可な覚悟でクリアできると思うな", aiMul: 1.55, growthCap: 112, needCP: 20, abilCap: 104 },
];

export const TITLE_DEFS = [
  { key: "grandTour", label: "グランツール総合優勝", icon: "🌍" },
  { key: "grandFinal", label: "グランファイナル制覇", icon: "🏆" },
  { key: "worlds", label: "世界選手権優勝", icon: "🌐" },
  { key: "olympics", label: "オリンピック優勝", icon: "🥇" },
];

// ── 種目・成長・チーム関連の分類テーブル（Phase 4-1後の support.js から分離）──

export const CLASS_TIER_COLOR = [C.sub, C.blue, C.yellow];

export const GROWTHPOW_ORDER = ["C", "B", "A", "S"];

export const GROWTH_ORDER = ["early", "normal", "late", "super_late"];

export const DISCIPLINES = {
  flat:   { label: "平坦",      calc: r => r.flat * 0.6 + r.solo * 0.25 + r.stamina * 0.15 },
  climb:  { label: "山岳",      calc: r => r.climb * 0.7 + r.stamina * 0.3 },
  sprint: { label: "スプリント", calc: r => r.sprint * 0.7 + r.flat * 0.2 + r.stamina * 0.1 },
  solo:   { label: "独走（TT）", calc: r => r.solo * 0.7 + r.stamina * 0.3 },
  hill:   { label: "丘陵",      calc: r => r.climb * 0.4 + r.sprint * 0.4 + r.stamina * 0.2 },
};

export const DISCIPLINE_KEYS = Object.keys(DISCIPLINES);

export const FAVORS_TO_DISCIPLINE = { SPR: "sprint", CLM: "climb", PUN: "hill", TT: "solo" };

// v43(マイライフ難易度調整Phase 1): 突破力・安定感を追加（新ステータス。生成はcore/core.jsのgenSubStats参照）
export const SUB_STAT_LABEL = { accel: "加速力", build: "体格", mental: "メンタル", breakthrough: "突破力", stability: "安定感" };

export const CHEMISTRY_TIERS = [
  { min: 30, label: "鉄壁の絆", mul: 0.92 },
  { min: 15, label: "円熟したチーム", mul: 0.95 },
  { min: 6,  label: "定着期", mul: 0.98 },
  { min: 0,  label: "新体制", mul: 1 },
];

export const ABILITY_CATEGORY_ORDER = ["地形適性", "展開・役割", "メンタル", "フィジカル", "成長", "配合限定"];

export const ML_AMBITION_PATH_KEYS = ["victory", "bigstage", "devotion", "world", "ironman", "stardom"];

export const APT_GRADE_COLOR = { S: "#ffd23f", A: "#ff8a5c", B: "#e8734a", C: "#6fbf73", D: "#4f8fe8", E: "#8a93a6", F: "#8a93a6", G: "#5a6274" };

export const GROWTH_POW_LADDER = ["C", "B", "A", "S"];

