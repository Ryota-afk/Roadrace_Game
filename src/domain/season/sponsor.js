// スポンサー契約・シーズン中期目標の純ロジック。Phase 4-1後の state.js/logic/support.js から分離（Step5: domain抽出）。
import { mulberry } from "../../core/core.js";
import { CLASSES } from "../../data/progression.js";
import { SEASON_OBJECTIVES } from "../../data/directives.js";

const SPONSOR_NAMES = ["アオゾラ銀行", "ハヤテ運輸", "ヤマセミ食品", "クレセント自転車", "ソラマメ製菓", "ツバキ石油", "ミナモ製薬", "カワセミ電工"];

export function genSponsors(classIdx, year) {
  const rng = mulberry(year * 913 + classIdx * 77 + 3);
  const pick = () => SPONSOR_NAMES[Math.floor(rng() * SPONSOR_NAMES.length)];
  const need = CLASSES[classIdx].need;
  return [
    { name: pick(), style: "安定型", monthly: 18 + classIdx * 8, norma: Math.max(10, need - 10), bonus: 80 + classIdx * 40, penalty: 30 + classIdx * 15, mandates: 1 },
    { name: pick(), style: "バランス型", monthly: 12 + classIdx * 7, norma: need - 3, bonus: 180 + classIdx * 70, penalty: 80 + classIdx * 30, mandates: 1 },
    { name: pick(), style: "挑戦型", monthly: 8 + classIdx * 5, norma: need + 5, bonus: 350 + classIdx * 130, penalty: 180 + classIdx * 60, mandates: 2 },
  ];
}

// v40 第1候補②：単月の「指定レース」（見せ場ボーナス）や年間ノルマ（総pt）とは別に、シーズンの
// 複数レースにまたがる「中期目標」をスポンサーが提示する。達成すれば臨時ボーナス（資金＋ノルマ加算pt）、
// 期限月までに未達なら違約金。監督指示カードと同様、関数（match/desc）はセーブに載らないため id で引き直す。

// 目標テンプレの候補（need／期限月index／報酬の素値）。deadline は MONTHS のindex（その月まで達成可）。
const OBJECTIVE_POOL = [
  { id: "wins", need: 4, deadline: 9, budget: 300, points: 20, penalty: 140 },
  { id: "climb", need: 2, deadline: 8, budget: 260, points: 16, penalty: 120 },
  { id: "sprint", need: 3, deadline: 8, budget: 240, points: 16, penalty: 110 },
  { id: "bigstage", need: 1, deadline: 10, budget: 340, points: 22, penalty: 150 },
  { id: "youth", need: 1, deadline: 8, budget: 220, points: 18, penalty: 90 },
];

// スポンサーの提案する中期目標を生成（シードで決定論的＝スポンサー画面と契約時で一致）。
// classIdx で報酬・違約金をスケール（上位クラスほど見返りも罰も大きい）。
export function genSeasonObjective(seed, classIdx) {
  const rng = mulberry(seed);
  const base = OBJECTIVE_POOL[Math.floor(rng() * OBJECTIVE_POOL.length)];
  const scale = 1 + classIdx * 0.6;
  return {
    id: base.id, need: base.need, deadline: base.deadline,
    progress: 0, status: "active",
    budget: Math.round(base.budget * scale),
    points: base.points,
    penalty: Math.round(base.penalty * scale),
  };
}

// レース結果から中期目標の進捗イベントを組む（bestRank＝自チーム最上位着順、aceAge＝そのエースの年齢）
export function raceObjectiveEvent(race, bestRank, aceAge) {
  const tmpl = race.tmpl || {};
  return {
    won: bestRank === 1, podium: bestRank <= 3, grade: race.grade || 1, favors: tmpl.favors,
    championship: !!race.championship, grandTour: !!race.grandTour, aceAge: aceAge == null ? null : aceAge,
  };
}

// アクティブな目標にイベントを適用。達成した瞬間に報酬（呼び出し側が budget/points へ加算する）。
// 返り値：{ objective, budgetDelta, pointsDelta, log|null, justDone }
export function advanceObjective(obj, ev, monthLabel) {
  const none = { objective: obj, budgetDelta: 0, pointsDelta: 0, log: null, justDone: false };
  if (!obj || obj.status !== "active") return none;
  const meta = SEASON_OBJECTIVES[obj.id];
  if (!meta || !meta.match(ev)) return none;
  const progress = obj.progress + 1;
  if (progress >= obj.need) {
    return {
      objective: { ...obj, progress: obj.need, status: "done" },
      budgetDelta: obj.budget, pointsDelta: obj.points, justDone: true,
      log: `【${monthLabel}】🎉 中期目標「${meta.label}」達成！ ボーナス+${obj.budget}万円・ノルマ+${obj.points}pt`,
    };
  }
  return {
    objective: { ...obj, progress }, budgetDelta: 0, pointsDelta: 0, justDone: false,
    log: `【${monthLabel}】中期目標「${meta.label}」進捗 ${progress}/${obj.need}`,
  };
}

// 期限切れ判定（月を送る advanceMonth で呼ぶ）。期限月を過ぎて未達なら失敗＝違約金。
// 返り値：{ objective, penalty, log|null }
export function expireObjective(obj, curMonth, monthLabel) {
  if (!obj || obj.status !== "active" || curMonth < obj.deadline) return { objective: obj, penalty: 0, log: null };
  const meta = SEASON_OBJECTIVES[obj.id];
  return {
    objective: { ...obj, status: "failed" }, penalty: obj.penalty,
    log: `【${monthLabel}】中期目標「${meta ? meta.label : ""}」は期限内に達成できず…違約金-${obj.penalty}万円`,
  };
}

// 表示用に目標の要約を返す（アイコン／名称／説明／期限月／進捗テール／状態）
export function objectiveStatusText(obj) {
  if (!obj) return null;
  const meta = SEASON_OBJECTIVES[obj.id];
  if (!meta) return null;
  const tail = obj.status === "done" ? "達成" : obj.status === "failed" ? "未達" : `${obj.progress}/${obj.need}`;
  return { icon: meta.icon, label: meta.label, narr: meta.narr, desc: meta.desc(obj.need), deadline: obj.deadline, tail, status: obj.status };
}
