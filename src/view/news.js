// ニュース・号外の文字列生成（純関数）。Phase 4-1後の support.js から分離（Step 4: view層）。
import { mulberry } from "../core/core.js";
import { MONTHS } from "../data/course.js";
import { RIVAL_TEAMS } from "../state/state.js";

export const RIVAL_NEWS_TEMPLATES = [
  t => `${t}が有望な若手を獲得し、戦力を着々と上積みしているという。`,
  t => `${t}が今季ここまで好調をキープ。勢いに乗っている。`,
  t => `${t}はエースの不振に苦しみ、やや停滞気味との情報だ。`,
  t => `${t}のエースに、他チームからの引き抜きの噂が浮上している。`,
  t => `${t}が最新機材を導入し、平坦での速さに磨きをかけたらしい。`,
  t => `${t}で世代交代が進み、チームの雰囲気が変わりつつあるようだ。`,
  t => `${t}が強化合宿を敢行。次戦に向けて仕上げてきそうだ。`,
  t => `${t}が監督体制を刷新し、戦術に変化が見られるという。`,
];

export function rivalNews(year, month) {
  const rng = mulberry((year || 1) * 137 + (month || 0) * 31 + 911);
  const team = RIVAL_TEAMS[Math.floor(rng() * RIVAL_TEAMS.length)];
  const tmpl = RIVAL_NEWS_TEMPLATES[Math.floor(rng() * RIVAL_NEWS_TEMPLATES.length)];
  return { team: team.name, color: team.color, text: tmpl(team.name) };
}

// v51(第11弾Phase2・2-D): mlWorldStarsForYear（24人の別世界を毎回1年目から再計算する
// 仕組み）を廃止し、実データから生成する形へ置換。旧実装は「前年・今年」を独立に
// 再計算して差分を取っていたが、riderStatsは現在値しか持たない（過去年のスナップショットが
// 無い）ため、その年に実際に起きたイベント（ageWorldRosters()が返すretired/debuted＝
// state.js側で既に計算済み）を年度末にそのまま文章化する形にした。呼び出し側（月次コントローラ）
// で年度末に1回だけ生成し、ml.worldNewsとして保存する（career.jsx側での再計算・シード復元は不要）。
export function mlBuildWorldNews(riderStatsById, leaderEntry, retired, debuted, year) {
  if (!year || year < 2) return [];
  const news = [];
  if (leaderEntry) news.push(`👑 ${leaderEntry.name}（${leaderEntry.team || "無所属"}）が世界ランキング首位（通算${leaderEntry.wins || 0}勝）`);
  const notableRetired = [...(retired || [])].sort((a, b) => ((riderStatsById[b.id] || {}).wins || 0) - ((riderStatsById[a.id] || {}).wins || 0))[0];
  if (notableRetired) {
    const st = riderStatsById[notableRetired.id];
    news.push(`🏁 ${notableRetired.name}が現役を退いた${st ? `（通算${st.wins}勝）` : ""}`);
  }
  const topDebut = (debuted || []).find(d => d.bloodOf);
  if (topDebut) news.push(`🌟 新星 ${topDebut.name}（${topDebut.age}歳）が台頭。${topDebut.bloodOf}の血を継ぐ逸材だ`);
  else if (debuted && debuted[0]) news.push(`🌟 新星 ${debuted[0].name}（${debuted[0].age}歳）が台頭`);
  return news;
}

export function mlNewspaper({ player, race, rank, careerWins, worldRank, year, month }) {
  if (!player || !race || rank !== 1) return null; // 号外は「勝った時」だけ
  const log = player.raceLog || [];
  // 直近から連続する優勝数（今回を含む）を数える＝勝ち星の連なり
  let winStreak = 0;
  for (let i = log.length - 1; i >= 0; i--) { if (log[i].rank === 1) winStreak++; else break; }
  const name = player.name;
  const grade = race.grade || 1;
  const isWorlds = race.milestone === "worlds";
  const isOlympics = race.milestone === "olympics";
  const isMonument = !!race.monument;
  const streakMilestone = [15, 10, 8, 5, 3].find(n => winStreak >= n && winStreak === n) ?? (winStreak >= 3 ? winStreak : 0);
  const careerMilestone = [100, 50, 25, 10].find(n => careerWins === n) || 0;
  const date = `${year}年目 ${MONTHS[month]}`;
  const masthead = "ロードレース・タイムズ";
  // 優先度：世界の頂点 ＞ モニュメント ＞ 連勝節目 ＞ 格上ビッグウィン ＞ 通算勝利節目
  if (isWorlds || isOlympics) {
    const t = isWorlds ? "世界選手権" : "オリンピック";
    return { kind: "crown", accent: "#ffd23f", masthead, date, tag: "号外・特報",
      headline: `${name}、${t}を制す`, sub: `世界の頂点に立つ ── 王者の称号、ここに`,
      body: `${race.name}を制した${name}が、ついに世界のトップへと駆け上がった。ゴール前で見せた圧巻の走りに、スタンドは総立ち。${worldRank && worldRank <= 5 ? `世界ランキングも${worldRank}位まで上昇し、` : ""}その名は世界中のファンの記憶に刻まれた。`,
      photo: `${t}の表彰台で栄光を噛みしめる${name}` };
  }
  if (isMonument) {
    return { kind: "classic", accent: "#e8a13c", masthead, date, tag: "号外",
      headline: `${name}、クラシック制覇`, sub: `${race.name} ── 英雄の系譜に新たな名`,
      body: `一世紀を超えて受け継がれる格式高い古典レース《${race.monumentName || race.name}》を、${name}が制した。消耗の激しい伝統のコースで最後まで脚を残し、歴戦の強豪たちを退けての完勝。クラシックの覇者として、その走りは長く語り継がれるだろう。`,
      photo: `石畳（または峠）を越えて先頭でゴールする${name}` };
  }
  if (streakMilestone >= 3) {
    return { kind: "streak", accent: "#e8544f", masthead, date, tag: winStreak >= 8 ? "特集" : "スポーツ面",
      headline: `${name} ${winStreak}連勝！`, sub: `止まらない快進撃 ── 敵なしの快走続く`,
      body: `${race.name}を制し、${name}が${winStreak}連勝を達成した。誰にも止められない勢いで白星を重ね、いまや大会の主役。${winStreak >= 8 ? "この記録がどこまで伸びるのか、ファンの期待は高まるばかりだ。" : "次戦でも連勝を伸ばせるか、注目が集まる。"}`,
      photo: `ガッツポーズでゴールラインを駆け抜ける${name}` };
  }
  if (grade >= 3) {
    return { kind: "big", accent: "#4f8fe8", masthead, date, tag: "スポーツ面",
      headline: `${name}、大金星`, sub: `${race.name}で強豪を撃破`,
      body: `格の高い${"★".repeat(grade)}レース${race.name}で、${name}が見事に優勝を飾った。並みいる強豪を相手にした価値ある勝利。着実に実力をつけてきた走りが、大舞台で結実した一日となった。`,
      photo: `両手を突き上げて喜ぶ${name}` };
  }
  if (careerMilestone) {
    return { kind: "milestone", accent: "#35c07e", masthead, date, tag: "コラム",
      headline: `${name} 通算${careerMilestone}勝の金字塔`, sub: `積み重ねた白星、また一つの節目`,
      body: `${race.name}を制し、${name}がキャリア通算${careerMilestone}勝に到達した。一戦一戦を大切に走り続けた積み重ねが、大きな数字となって結実した。次なる目標へ、歩みは止まらない。`,
      photo: `記念すべき${careerMilestone}勝目を挙げた${name}` };
  }
  return null;
}
