// シーズンのイベント効果適用・性格ベースのチームイベント。第13弾Phase0でlogic/support.jsから分離。
import { AB_KEYS } from "../../data/abilities.js";

export const EFFECT_APPLIERS = {
  budget: (s, v) => ({ ...s, budget: s.budget + v }),
  rosterFatigueAll: (s, v) => ({ ...s, roster: s.roster.map(r => ({ ...r, fatigue: Math.max(0, Math.min(100, r.fatigue + v)) })) }),
  rosterCondAll: (s, v) => ({ ...s, roster: s.roster.map(r => ({ ...r, cond: Math.max(1, Math.min(5, r.cond + v)) })) }),
  campGrant: (s, v) => ({ ...s, inv: { ...s.inv, camp: s.inv.camp + v } }),
  pointsDelta: (s, v) => ({ ...s, points: Math.max(0, s.points + v) }),
  injuryReduceRandom: (s, v) => {
    const injured = s.roster.filter(r => r.injury > 0);
    if (!injured.length) return s;
    const pick = injured[Math.floor(Math.random() * injured.length)];
    return { ...s, roster: s.roster.map(r => r.id === pick.id ? { ...r, injury: Math.max(0, r.injury + v) } : r) };
  },
  fatigueReduceRandom: (s, v) => {
    if (!s.roster.length) return s;
    const pick = s.roster[Math.floor(Math.random() * s.roster.length)];
    return { ...s, roster: s.roster.map(r => r.id === pick.id ? { ...r, fatigue: Math.max(0, Math.min(100, r.fatigue + v)) } : r) };
  },
  mandatesMissedReduce: (s, v) => {
    if (!s.sponsor) return s;
    return { ...s, sponsor: { ...s.sponsor, mandatesMissed: Math.max(0, s.sponsor.mandatesMissed + v) } };
  },
  // v12: イベントの種類を増やすにあたり追加した「個人」targetの効果。誰が対象になったか
  // プレイヤーに伝わるよう、__eventNoteに選手名入りの一言をしのばせておき、
  // resolveEvent側でchoice.resultの末尾に添える
  boostRandomRiderAbilities: (s, v) => {
    if (!s.roster.length) return s;
    const pick = s.roster[Math.floor(Math.random() * s.roster.length)];
    const roster = s.roster.map(r => r.id === pick.id
      ? { ...r, ...Object.fromEntries(AB_KEYS.map(k => [k, Math.max(22, Math.min(94, Math.round(r[k] + v)))])) }
      : r);
    return { ...s, roster, __eventNote: `📈 ${pick.name}の能力が一段伸びた！` };
  },
  condRandomRider: (s, v) => {
    if (!s.roster.length) return s;
    const pick = s.roster[Math.floor(Math.random() * s.roster.length)];
    const roster = s.roster.map(r => r.id === pick.id ? { ...r, cond: Math.max(1, Math.min(5, r.cond + v)) } : r);
    return { ...s, roster, __eventNote: v > 0 ? `😊 ${pick.name}の調子が上向いた。` : `😔 ${pick.name}の調子が優れない…` };
  },
  growthPowUpgradeRandom: (s, v) => {
    if (v <= 0 || !s.roster.length) return s;
    const order = ["C", "B", "A", "S"];
    const candidates = s.roster.filter(r => order.indexOf(r.growthPow) < order.length - 1);
    if (!candidates.length) return s;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const nextPow = order[order.indexOf(pick.growthPow) + 1];
    const roster = s.roster.map(r => r.id === pick.id ? { ...r, growthPow: nextPow } : r);
    return { ...s, roster, __eventNote: `🌟 ${pick.name}の成長力が「${nextPow}」に上がった！` };
  },
  // v12: 起きる確率自体をここに埋め込む（v=万一発生した場合の離脱月数）。選択肢の分岐は
  // 「安全に休む（発生しない）」か「無理をする（一定確率で発生）」かで表現する
  injuryRiskRandom: (s, v) => {
    if (Math.random() >= 0.4) return s;
    const healthy = s.roster.filter(r => r.injury === 0);
    if (!healthy.length) return s;
    const pick = healthy[Math.floor(Math.random() * healthy.length)];
    const roster = s.roster.map(r => r.id === pick.id ? { ...r, injury: v, fatigue: Math.min(100, r.fatigue + 20) } : r);
    return { ...s, roster, __eventNote: `🤕 ${pick.name}が無理がたたって故障してしまった…` };
  },
  wheelGrant: (s, v) => ({ ...s, inv: { ...s.inv, wheel: s.inv.wheel + v } }),
  // v36(#9): 性格イベントで「特定の1名」を対象にするための適用子（vは{id,v}）。
  riderAbById: (s, { id, v }) => {
    const pick = s.roster.find(r => r.id === id);
    if (!pick) return s;
    return { ...s, roster: s.roster.map(r => r.id === id
      ? { ...r, ...Object.fromEntries(AB_KEYS.map(k => [k, Math.max(22, Math.min(94, Math.round(r[k] + v)))])) } : r),
      __eventNote: `📈 ${pick.name}の地力が伸びた（全能力+${v}）` };
  },
  riderCondById: (s, { id, v }) => {
    const pick = s.roster.find(r => r.id === id);
    if (!pick) return s;
    return { ...s, roster: s.roster.map(r => r.id === id ? { ...r, cond: Math.max(1, Math.min(5, r.cond + v)) } : r),
      __eventNote: v > 0 ? `😊 ${pick.name}のコンディションが上向いた` : `😔 ${pick.name}の調子が下がった` };
  },
  riderFatigueById: (s, { id, v }) => {
    const pick = s.roster.find(r => r.id === id);
    if (!pick) return s;
    return { ...s, roster: s.roster.map(r => r.id === id ? { ...r, fatigue: Math.max(0, Math.min(100, r.fatigue + v)) } : r) };
  },
};

// v36(#9): 性格ベースのチームイベント（シーズン）。ロースターから1名を選び、その選手の性格に応じた
// 出来事＋二択を生成する（対象選手のidを効果に埋め込む）。該当者がいなければnull。
const SEASON_PERS_EVENTS = {
  hotblood: (r) => ({ title: `${r.name}がチームを鼓舞`, text: `熱血漢の${r.name}が「今年こそやってやる！」とチーム全体に檄を飛ばしている。`,
    choices: [
      { label: "勢いに乗る", result: `${r.name}の熱がチームに伝播し、全員の士気が上がった。本人は少し飛ばしすぎた。`, effects: { rosterCondAll: 1, riderFatigueById: { id: r.id, v: 10 } } },
      { label: "落ち着かせる", result: `熱くなりすぎないよう声をかけ、${r.name}をうまくクールダウンさせた。`, effects: { riderFatigueById: { id: r.id, v: -12 }, riderCondById: { id: r.id, v: 1 } } },
    ] }),
  seeker: (r) => ({ title: `${r.name}が限界に挑む`, text: `求道者気質の${r.name}が「もっと強くなりたい」と、限界を超える猛練習を志願してきた。`,
    choices: [
      { label: "挑戦を見守る", result: `追い込みを許すと、${r.name}は殻を破って一段成長した。代償に疲労も深い。`, effects: { riderAbById: { id: r.id, v: 2 }, riderFatigueById: { id: r.id, v: 14 } } },
      { label: "無理はさせない", result: `オーバーワークを戒め、計画的な調整に切り替えさせた。`, effects: { riderCondById: { id: r.id, v: 1 }, riderFatigueById: { id: r.id, v: -8 } } },
    ] }),
  artisan: (r) => ({ title: `${r.name}が機材を突き詰める`, text: `職人肌の${r.name}が、ポジションと機材のセッティングを細部まで詰めたいと言い出した。`,
    choices: [
      { label: "とことん付き合う", result: `納得いくまで詰めた結果、${r.name}の走りに無駄がなくなった。`, effects: { riderAbById: { id: r.id, v: 2 } } },
      { label: "ほどほどで休ませる", result: `凝りすぎる前に切り上げさせ、しっかり休養を取らせた。`, effects: { riderFatigueById: { id: r.id, v: -12 }, riderCondById: { id: r.id, v: 1 } } },
    ] }),
  free: (r) => ({ title: `${r.name}のマイペース`, text: `自由人の${r.name}が、練習の合間に気ままな寄り道をして周囲をやきもきさせている。`,
    choices: [
      { label: "大らかに見守る", result: `本人らしさを尊重すると、チームの雰囲気も和み、${r.name}も伸び伸び走れた。`, effects: { rosterCondAll: 1 } },
      { label: "少し引き締める", result: `けじめをつけるよう促し、${r.name}も気を引き締めた。`, effects: { riderCondById: { id: r.id, v: 1 }, riderFatigueById: { id: r.id, v: -6 } } },
    ] }),
  smart: (r) => ({ title: `${r.name}が戦術を提案`, text: `智将肌の${r.name}が、次戦に向けた緻密な作戦プランを持ちかけてきた。`,
    choices: [
      { label: "作戦を採用する", result: `${r.name}の分析をチームで共有し、全員の狙いが噛み合った。`, effects: { rosterCondAll: 1 } },
      { label: "本人の武器も磨かせる", result: `戦術眼を評価しつつ、自身の走力も伸ばすよう助言した。`, effects: { riderAbById: { id: r.id, v: 2 } } },
    ] }),
  genius: (r) => ({ title: `${r.name}が退屈そうにしている`, text: `天才肌の${r.name}が、いまの練習に物足りなさを感じているようだ。`,
    choices: [
      { label: "高い課題を与える", result: `歯応えのあるメニューに${r.name}は目を輝かせ、才能をさらに開花させた。`, effects: { riderAbById: { id: r.id, v: 3 }, riderFatigueById: { id: r.id, v: 8 } } },
      { label: "自由にやらせる", result: `本人の裁量に任せると、気分良く調子を上げてきた。`, effects: { riderCondById: { id: r.id, v: 1 } } },
    ] }),
  maverick: (r) => ({ title: `${r.name}が単独練習を望む`, text: `一匹狼の${r.name}が「チーム練習より一人で追い込みたい」と申し出てきた。`,
    choices: [
      { label: "独りの流儀を尊重する", result: `思う存分追い込ませると、${r.name}は独走力を大きく伸ばした。`, effects: { riderAbById: { id: r.id, v: 2 }, riderFatigueById: { id: r.id, v: 6 } } },
      { label: "チームに引き込む", result: `根気よく対話し、${r.name}が少しだけ心を開いた。チームの結束が高まった。`, effects: { rosterCondAll: 1 } },
    ] }),
  showman: (r) => ({ title: `${r.name}がメディアの寵児に`, text: `目立ちたがりの${r.name}が取材やSNSで話題を集め、チームの注目度が上がっている。`,
    choices: [
      { label: "広告塔として前に出す", result: `${r.name}のスター性でスポンサーの覚えもめでたく、チームに追い風が吹いた。`, effects: { budget: 20, riderFatigueById: { id: r.id, v: 4 } } },
      { label: "浮かれないよう釘を刺す", result: `地に足をつけるよう諭すと、${r.name}は走りで魅せると誓い、集中を取り戻した。`, effects: { riderCondById: { id: r.id, v: 1 } } },
    ] }),
  tactician: (r) => ({ title: `${r.name}が全体戦術を献策`, text: `策士の${r.name}が、チーム全体の勝ち筋を描いた緻密な作戦を持ち込んできた。`,
    choices: [
      { label: "チーム戦術に採り入れる", result: `${r.name}の描いた盤面を全員で共有し、連携が一段と噛み合った。`, effects: { rosterCondAll: 1 } },
      { label: "本人の走力も伸ばさせる", result: `参謀としての目を評価しつつ、自身の脚も磨くよう促した。`, effects: { riderAbById: { id: r.id, v: 2 } } },
    ] }),
};
export function seasonPersonalityEvent(roster, rng) {
  const r0 = rng || Math.random;
  const pool = (roster || []).filter(r => r.injury === 0 && SEASON_PERS_EVENTS[r.personality]);
  if (!pool.length) return null;
  const r = pool[Math.floor(r0() * pool.length)];
  return SEASON_PERS_EVENTS[r.personality](r);
}

export function applyEventEffects(s, effects) {
  let ns = s;
  Object.entries(effects || {}).forEach(([k, v]) => { if (EFFECT_APPLIERS[k]) ns = EFFECT_APPLIERS[k](ns, v); });
  return ns;
}
