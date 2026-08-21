// 人生の岐路(ML_CROSSROADS)・オフシーズン選択・シーズン実績・指令。第13弾Phase0でlogic/support.jsから分離。
import { hasAbility, mulberry } from "../../core/core.js";
import { ABILITIES, AB_KEYS } from "../../data/abilities.js";
import { MANAGER_DIRECTIVES } from "../../data/directives.js";
import { ROOM_GRADE_MAX, ROOM_UPGRADE_KEYS } from "../../data/roomUpgrade.js";
import { T } from "../../data/theme.js";
import { addAb } from "../shared/growth.js";
import { mlGrowthCap } from "../mylife/growthCap.js";
import { teamChemistryTier } from "../../sim/buildSim.js";

// v45: ユーザー指摘「イベントで起きた能力変化などは必ず明示したほうがいい」への対応。
// 各選択はresult（フレーバー文）だけで実際の増減値（全能力+2〜4・疲労±）を一切示して
// いなかった。mlResolveOffseason側でbefore/after差分を機械的に計算して必ず併記する
// （addAb()は成長キャップで頭打ちすることがあるため、ここに静的な数値は持たせない）。
export const ML_OFFSEASON_CHOICES = [
  { key: "domestic", label: "国内で自主トレーニングに励む", desc: "堅実に基礎を積む。伸びは控えめだが安全",
    result: "オフシーズンは国内で黙々と走り込み、着実に地力を蓄えた。",
    apply: (player, year, ml) => { const p = { ...player }; AB_KEYS.forEach(k => addAb(p, k, 2, mlGrowthCap(year, p, ml))); return p; } },
  { key: "overseas", label: "海外武者修行に出る", desc: "レベルの高い環境に飛び込む。伸びは大きいが疲労が残る",
    result: "海外の強豪選手たちに揉まれ、大きく成長する手応えを掴んだ。ただし疲労が抜けきらないまま新シーズンを迎えることになった。",
    apply: (player, year, ml) => { const p = { ...player }; AB_KEYS.forEach(k => addAb(p, k, 4, mlGrowthCap(year, p, ml))); p.fatigue = Math.min(100, p.fatigue + 20); return p; } },
  { key: "rest", label: "心身をしっかり休める", desc: "疲労を大きくリセットして万全の状態で新シーズンへ",
    result: "オフシーズンをゆっくり過ごし、心身ともにリフレッシュして新シーズンを迎える。",
    apply: (player) => ({ ...player, fatigue: Math.max(0, player.fatigue - 40) }) },
];

export const ML_CROSSROADS = {
  marriage: {
    key: "marriage", title: "人生の岐路 — 結婚",
    text: "長年支えてくれた恋人から、将来について話したいと切り出された。",
    choices: [
      { label: "プロポーズする",
        result: "結婚した。生活が安定し、心身ともに落ち着いて競技に取り組めるようになった（以後、毎月の疲労回復がわずかに上がる）。",
        apply: (player, flags) => ({ player, flags: { ...flags, married: true, marriageResolved: true } }) },
      { label: "今は競技に集中したいと伝える",
        result: "気持ちを尊重してもらい、今は競技に専念することにした。",
        apply: (player, flags) => ({ player, flags: { ...flags, marriageResolved: true } }) },
    ],
  },
  injury: {
    key: "injury", title: "人生の岐路 — 大きな怪我",
    text: "練習中の落車で大きな怪我を負ってしまった。復帰への向き合い方が問われている。",
    choices: [
      { label: "焦らず段階的に戻す",
        result: "無理をせず、着実にリハビリを積んで復帰を果たした。一時的に能力が落ち込んだが、後遺症は残らなかった。",
        apply: (player, flags) => ({
          player: { ...player, flat: Math.max(20, player.flat - 3), climb: Math.max(20, player.climb - 3), sprint: Math.max(20, player.sprint - 3), stamina: Math.max(20, player.stamina - 3), solo: Math.max(20, player.solo - 3) },
          flags: { ...flags, injuryResolved: true },
        }) },
      { label: "早期復帰を目指す",
        result: "予定より早く戦列に復帰したが、無理がたたって本調子が長く続かず、以後も違和感を抱えることになった（毎月の疲労回復がわずかに下がる）。",
        // v17: 無理な早期復帰の代償として、枠に空きがあれば「ガラスの体」を後天的に負ってしまう
        apply: (player, flags) => {
          const canAcquire = (player.abilities || []).length < 3 && !hasAbility(player, "glass");
          return {
            player: {
              ...player,
              flat: Math.max(20, player.flat - 1), climb: Math.max(20, player.climb - 1), sprint: Math.max(20, player.sprint - 1), stamina: Math.max(20, player.stamina - 1), solo: Math.max(20, player.solo - 1),
              abilities: canAcquire ? [...(player.abilities || []), "glass"] : (player.abilities || []),
            },
            flags: { ...flags, injuryResolved: true, rushedInjuryComeback: true },
          };
        },
        resultNote: (player) => hasAbility(player, "glass") ? "この経験から、特殊能力「ガラスの体」が身についてしまった…。" : "" },
      // v26: リハビリの過ごし方をもう1択増やしてほしいという要望を受けて追加。
      // 安全策（焦らず段階的に戻す）・早期復帰（リスクあり）に加え、「新しい走り方を模索する」を
      // 用意した。短期的な能力低下は最も大きいが、後遺症なしで新たな特殊能力を直接獲得できる
      { label: "新しい走り方を模索する",
        result: "長い休養の間、これまでとは違う走り方を模索した。踏み込む力は一時的に落ち込んだが、後遺症なく戦列に戻れた。",
        apply: (player, flags) => {
          const owned = new Set(player.abilities || []);
          const eligible = Object.keys(ABILITIES).filter(k => !ABILITIES[k].bad && !owned.has(k));
          const canAcquire = (player.abilities || []).length < 3 && eligible.length > 0;
          const picked = canAcquire ? eligible[Math.floor(Math.random() * eligible.length)] : null;
          return {
            player: {
              ...player,
              flat: Math.max(20, player.flat - 5), climb: Math.max(20, player.climb - 5), sprint: Math.max(20, player.sprint - 5), stamina: Math.max(20, player.stamina - 5), solo: Math.max(20, player.solo - 5),
              abilities: picked ? [...(player.abilities || []), picked] : (player.abilities || []),
            },
            flags: { ...flags, injuryResolved: true },
          };
        },
        resultNote: (player, prevPlayer) => {
          const newlyAdded = (player.abilities || []).find(id => !(prevPlayer.abilities || []).includes(id));
          return newlyAdded ? `模索の末、新しい特殊能力「${ABILITIES[newlyAdded].label}」を身につけた！` : "";
        } },
    ],
  },
  // v17: 結婚した選手にだけ、その後さらに続く家庭の岐路として第一子誕生を用意する
  child: {
    key: "child", title: "人生の岐路 — 第一子誕生",
    text: "パートナーから妊娠を伝えられた。もうすぐ親になる。",
    choices: [
      { label: "喜んで育児にも積極的に関わる",
        result: "新しい家族を迎え、生活に張り合いが生まれた。家庭がしっかり支えてくれることで、以後は疲労がさらに抜けやすくなった。",
        apply: (player, flags) => ({ player, flags: { ...flags, hasChild: true, childResolved: true } }) },
      { label: "パートナーに任せ、競技を最優先する",
        result: "家庭のサポートを受けつつ競技に集中する環境を整えた。練習によりのめり込めるようになった（以後、練習効果がわずかに上がる）。",
        apply: (player, flags) => ({ player, flags: { ...flags, hasChild: true, childResolved: true, childFocusedCareer: true } }) },
    ],
  },
  // v25: 新人時代に指導を受けていた恩師との別れ。新人期は練習・出走経験の伸びに
  // ボーナスが乗るが、キャリアが進むと「もう教えることはない」と巣立ちを促される
  mentor_graduation: {
    key: "mentor_graduation", title: "人生の岐路 — 恩師との別れ",
    text: "新人時代から指導してくれた恩師が「もう教えることはない。あとは自分の力で這い上がれ」と告げてきた。",
    choices: [
      { label: "教えを胸に、独り立ちする",
        result: "恩師の教えを胸に刻み、独り立ちを決意した。これまでの指導の総仕上げとして、餞別に一段と地力が上がった。",
        apply: (player, flags) => {
          const p = { ...player };
          AB_KEYS.forEach(k => { p[k] = Math.min(135, p[k] + 3); });
          return { player: p, flags: { ...flags, mentorActive: false } };
        } },
      { label: "感謝を伝え、これからも助言を仰ぐ",
        result: "巣立ちを告げられつつも、関係は緩やかに続けることにした。指導ボーナスはなくなったが、時折もらえる助言が心の支えになっている。",
        apply: (player, flags) => ({ player, flags: { ...flags, mentorActive: false } }) },
    ],
  },
};

export function mlRollCrossroads(s, player) {
  const flags = s.flags || {};
  const candidates = [];
  if (!flags.marriageResolved && player.age >= 25 && Math.random() < 0.35) candidates.push(ML_CROSSROADS.marriage);
  if (!flags.injuryResolved && (player.raceLog || []).length >= 6 && Math.random() < 0.2) candidates.push(ML_CROSSROADS.injury);
  // v17: 結婚済み・未解決なら第一子誕生の岐路が続く
  if (flags.married && !flags.childResolved && player.age >= 27 && Math.random() < 0.3) candidates.push(ML_CROSSROADS.child);
  // v25: 新人期の師弟関係は3年目を迎えたタイミングで必ず一区切りを迎える（確率抽選なし）
  if (flags.mentorActive && s.year >= 3) candidates.push(ML_CROSSROADS.mentor_graduation);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export const SEASON_ACHIEVEMENTS = [
  { id: "first_win", icon: "🥇", label: "初優勝", desc: "レースで初めて優勝する", reward: { money: 30 },
    check: (g) => g.careerStats.totalWins >= 1 },
  { id: "first_podium", icon: "🏅", label: "初表彰台", desc: "レースで初めて表彰台に上がる", reward: { money: 20 },
    check: (g) => g.careerStats.totalPodiums >= 1 },
  { id: "class_a", icon: "⬆️", label: "Aクラス昇格", desc: "Aクラスに昇格する", reward: { money: 50, cp: 1 },
    check: (g) => g.classIdx >= 1 },
  { id: "class_pro", icon: "👑", label: "PROクラス到達", desc: "PROクラスに昇格する", reward: { money: 100, cp: 2 },
    check: (g) => g.classIdx >= 2 },
  { id: "champion", icon: "🏆", label: "グランファイナル制覇", desc: "グランファイナルで総合優勝する", reward: { money: 200, cp: 5 },
    check: (g) => (g.careerHistory || []).some(h => h.champBest === 1) },
  { id: "wins_50", icon: "🔥", label: "通算50勝", desc: "チーム通算で50勝する", reward: { money: 150, cp: 3 },
    check: (g) => g.careerStats.totalWins >= 50 },
  { id: "races_100", icon: "🚴", label: "百戦錬磨", desc: "チーム通算で100戦に出走する", reward: { money: 100, cp: 2 },
    check: (g) => g.careerStats.totalRaces >= 100 },
  { id: "hof_1", icon: "🏛", label: "殿堂入り選手を輩出", desc: "殿堂入り選手を1人以上輩出する", reward: { money: 40 },
    check: (g) => (g.hallOfFame || []).length >= 1 },
  { id: "chemistry_max", icon: "🤝", label: "鉄壁の絆", desc: "チームケミストリーを最高段階まで高める", reward: { money: 50 },
    check: (g) => teamChemistryTier(g.roster).label === "鉄壁の絆" },
  { id: "captain", icon: "🎖", label: "主将を任命", desc: "チームに主将を任命する", reward: { money: 20 },
    check: (g) => !!g.captainId },
  { id: "jersey", icon: "🎽", label: "副次タイトル獲得", desc: "グランツールでポイント賞・山岳賞・新人賞のいずれかを獲得する", reward: { money: 60, cp: 1 },
    check: (g) => { const j = g.jerseyWinCounts; return !!j && (j.points > 0 || j.mountains > 0 || j.youth > 0); } },
  // Wave H-2: 内装グレードは能力値に影響しない見た目のみの購入軸のため、実績報酬で
  // 購入動機を補う（判断⑤a+c：効果は付けず、実績連動のみ）。
  { id: "room_full_grade", icon: "🏡", label: "拠点フル改装", desc: "4つの持ち場すべての内装を最高グレードにする", reward: { money: 80, cp: 1 },
    check: (g) => ROOM_UPGRADE_KEYS.every(k => (((g.roomLv || {})[k]) || 0) >= ROOM_GRADE_MAX) },
];

// v41(§Step5): SEASON_ACHIEVEMENTSのchemistry_max判定がteamChemistryTier（本ファイル内）を呼ぶため、
// domain/season/standings.js（data/*のみに依存する層）へは移送せずここに残す（循環import回避）。
export function computeSeasonAchievements(g) {
  return SEASON_ACHIEVEMENTS.map(a => ({ ...a, achieved: a.check(g) }));
}

export function formatAchievementReward(a) {
  if (!a.reward) return "";
  const parts = [];
  if (a.reward.money) parts.push(`+${a.reward.money}万円`);
  if (a.reward.cp) parts.push(`クリアポイント+${a.reward.cp}pt`);
  return parts.length ? `報酬：${parts.join("／")}` : "";
}

export function mlGenDirective(year, month, classIdx, managerEval) {
  const rng = mulberry(year * 4001 + month * 131 + classIdx * 23 + 9007);
  const w = {
    ace: managerEval >= 65 ? 34 : managerEval >= 40 ? 12 : 2,
    breakthrough: 28,
    support: 26,
    experience: managerEval < 25 ? 30 : 8,
  };
  const totalW = Object.values(w).reduce((a, b) => a + b, 0);
  let roll = rng() * totalW;
  for (const k of Object.keys(w)) { if (roll < w[k]) return MANAGER_DIRECTIVES[k]; roll -= w[k]; }
  return MANAGER_DIRECTIVES.experience;
}

export function managerEvalTier(v) {
  if (v >= 80) return { label: "絶大な信頼", color: T.color.accent };
  if (v >= 60) return { label: "高い評価", color: T.color.good };
  if (v >= 40) return { label: "順調な評価", color: "#4f8fe8" };
  if (v >= 20) return { label: "様子見", color: T.color.sub };
  return { label: "信頼不足", color: T.color.bad };
}

export function pickMandateMonths(n, seed) {
  const rng = mulberry(seed);
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out.sort((a, b) => a - b);
}

export function bumpCareerStats(cs, rank, prize) {
  return {
    totalRaces: cs.totalRaces + 1,
    totalWins: cs.totalWins + (rank === 1 ? 1 : 0),
    totalPodiums: cs.totalPodiums + (rank <= 3 ? 1 : 0),
    totalPrize: cs.totalPrize + prize,
    bestFinish: cs.bestFinish === null ? rank : Math.min(cs.bestFinish, rank),
  };
}
