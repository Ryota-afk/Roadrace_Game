// シーズン順位の純ロジック。Phase 4-1後の logic/support.js から分離（Step5: domain抽出）。
// computeSeasonAchievements は SEASON_ACHIEVEMENTS の一部がteamChemistryTier（support.js）を
// 呼ぶ論理結合データのため、循環import回避のため support.js 側に残している。
import { mulberry, strHash } from "../../core/core.js";
import { CLASSES, DIFFICULTIES } from "../../data/progression.js";
import { C } from "../../data/theme.js";
import { RIVAL_TEAMS } from "../../data/teams.js";

export function computeStandings(g) {
  const monthProg = Math.max(0.08, (g.month + 1) / 12);
  const need = CLASSES[g.classIdx].need;
  const diffMul = (DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0]).aiMul;
  const dynastyMul = 1 + Math.min(0.4, (g.dynastyLevel || 0) * 0.1);
  const rows = RIVAL_TEAMS.map(t => {
    const rng = mulberry(strHash(t.name) + g.year * 101 + g.classIdx * 7);
    const strength = (0.6 + rng() * 0.85) * diffMul * dynastyMul;
    const seasonTotal = Math.round(need * strength * 1.35);
    return { name: t.name, color: t.color, spec: t.spec, trait: t.trait, pts: Math.round(seasonTotal * monthProg), isPlayer: false };
  });
  rows.push({ name: g.teamName || "あなたのチーム", color: C.yellow, pts: g.points, isPlayer: true });
  rows.sort((a, b) => b.pts - a.pts);
  return rows;
}

// v34（バランス）：シーズン順位を実効化する。現在の順位表での自チームの順位を返す。
export function seasonRank(g) {
  const rows = computeStandings(g);
  const idx = rows.findIndex(r => r.isPlayer);
  return { rank: idx + 1, total: rows.length };
}

// v35(シーズン深掘り): タイトル争い。順位表から「今の位置・すぐ上の相手・すぐ下の相手・首位との差」を
// 読み取り、シーズンを通した優勝争いの物語を返す。純関数。ホームに常時カードで出して緊張感を生む。
export function seasonTitleRace(g) {
  const rows = computeStandings(g);
  const idx = rows.findIndex(r => r.isPlayer);
  if (idx < 0) return null;
  const me = rows[idx], rank = idx + 1, total = rows.length;
  const leader = rows[0];
  const ahead = idx > 0 ? rows[idx - 1] : null;   // すぐ上（追う相手）
  const behind = idx < rows.length - 1 ? rows[idx + 1] : null; // すぐ下（追われる相手）
  const gapToLeader = Math.max(0, leader.pts - me.pts);
  const gapAhead = ahead ? Math.max(0, ahead.pts - me.pts) : 0;
  const gapBehind = behind ? Math.max(0, me.pts - behind.pts) : 0;
  const late = (g.month || 0) >= 8; // 終盤ほど言い回しを煽る
  let line;
  if (rank === 1) {
    line = behind
      ? `首位を快走。2位・${behind.name}を${gapBehind}pt引き離している。${late ? "このまま逃げ切れるか。" : "リードを守り抜けるか。"}`
      : "首位。独走態勢だ。";
  } else if (rank <= 3) {
    line = `表彰台圏の${rank}位。首位・${leader.name}まで${gapToLeader}pt、目前の${ahead.name}（+${gapAhead}pt）を捉えれば順位が上がる。${late ? "終盤、勝負どころだ。" : ""}`;
  } else {
    line = `${rank}位／${total}チーム。上位進出へ、まずは一つ上の${ahead.name}（+${gapAhead}pt）を追う。${late ? "残り少ない、追い上げを。" : "走り込んで差を詰めよう。"}`;
  }
  return {
    rank, total, isLeader: rank === 1,
    leaderName: leader.name, gapToLeader,
    ahead: ahead ? { name: ahead.name, gap: gapAhead, trait: ahead.trait } : null,
    behind: behind ? { name: behind.name, gap: gapBehind, trait: behind.trait } : null,
    line,
  };
}

// 年度末のシーズン順位ボーナス（賞金・万円）。上位ほど厚く、クラスで増額。走り込んで順位を上げる意味を作る。
export function standingsRankReward(rank, classIdx) {
  const base = rank === 1 ? 150 : rank === 2 ? 90 : rank === 3 ? 40 : 0;
  return Math.round(base * (1 + classIdx * 0.6));
}

// シーズン順位に応じてチャンピオンシップの昇格ボーダー（必要着順）を緩和する。
// 1位＝本番5位以内で昇格／2位＝4位以内／3位以下＝従来通り3位以内。年間を通した強さを本番に還元。
export function champPromoteCut(rank) {
  return rank === 1 ? 5 : rank === 2 ? 4 : 3;
}
