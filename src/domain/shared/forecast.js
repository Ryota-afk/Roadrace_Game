// 出走表の下馬評（純ロジック）。両モード共通。Phase 4-1後の logic/support.js から分離（Step5: domain抽出）。
import { DISCIPLINES, FAVORS_TO_DISCIPLINE } from "../../data/progression.js";

// v34(UI): 出走表の「下馬評」予想。コースの得意分野に沿った地力（＝出走時点の実効能力）で
// 出走選手を格付けし、本命◎/対抗○/注目▲ を付ける。競輪・競馬の予想印のイメージ。
// 能力データを持たないエントラント（シーズンの簡易出走表など）や favors 未指定なら空を返す（＝予想なし）。
// 返り値：Map(entrant -> { rank, mark|null })。mark = { icon, label, color }。
export function raceForecast(entrants, favors) {
  const map = new Map();
  if (!favors || !entrants || entrants.length < 3) return map;
  const key = FAVORS_TO_DISCIPLINE[favors] || "flat";
  const calc = DISCIPLINES[key].calc;
  const scored = [];
  for (const e of entrants) {
    if (typeof e.flat !== "number" || typeof e.climb !== "number") return map; // 能力データ無し→予想しない
    scored.push({ e, s: calc(e) });
  }
  scored.sort((a, b) => b.s - a.s);
  scored.forEach(({ e }, i) => {
    let mark = null;
    if (i === 0) mark = { icon: "◎", label: "本命", color: "#ffd23f" };
    else if (i <= 2) mark = { icon: "○", label: "対抗", color: "#4f8fe8" };
    else if (i <= 4) mark = { icon: "▲", label: "注目", color: "#35c07e" };
    map.set(e, { rank: i + 1, mark });
  });
  return map;
}
