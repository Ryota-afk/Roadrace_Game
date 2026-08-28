// 生涯プレステージ・タイトル台帳。state/state.js から分離（第15弾F）。
import { TITLE_DEFS } from "../data/progression.js";
import { loadMlLegends } from "../breeding/breeding.js";
import { loadMeta, loadTitles } from "./meta.js";

export function totalTitleCount() {
  const t = loadTitles();
  return TITLE_DEFS.reduce((s, d) => s + (t[d.key] || 0), 0);
}

export function computePrestige() {
  const meta = loadMeta();
  const legends = loadMlLegends();
  const mlWins = legends.reduce((s, l) => s + (l.wins || 0), 0);
  const mlPodiums = legends.reduce((s, l) => s + (l.podiums || 0), 0);
  const mlAchieved = legends.reduce((s, l) => s + (l.achievedCount || 0), 0);
  // v28: 通算タイトルもプレステージに加える（1タイトル=25点の重み）
  const titleCount = totalTitleCount();
  const score = Math.round(meta.totalEarnedCP * 3 + legends.length * 15 + mlWins * 2 + mlPodiums * 1 + mlAchieved * 5 + titleCount * 25);
  return { score, totalEarnedCP: meta.totalEarnedCP, legendCount: legends.length, mlWins, mlPodiums, mlAchieved, titleCount };
}
