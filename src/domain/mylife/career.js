// マイライフのキャリア年表・弟子（プロテジェ）・素質ランク・エピローグ。第13弾Phase0でlogic/support.jsから分離。
import { loadMlLegends, saveMlLegends } from "../../breeding/breeding.js";
import { ABILITIES, PERSONALITIES } from "../../data/abilities.js";

export function mlSetEpilogue(text) {
  const legends = loadMlLegends();
  if (legends.length === 0) return;
  legends[legends.length - 1] = { ...legends[legends.length - 1], epilogue: text };
  saveMlLegends(legends);
}

export function mlSetAutobiography(quote) {
  const legends = loadMlLegends();
  if (legends.length === 0) return;
  legends[legends.length - 1] = { ...legends[legends.length - 1], autobiography: quote };
  saveMlLegends(legends);
}

export function mlAutobiographyOptions(s) {
  const r = s.player;
  const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
  const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
  const opts = [];
  if (wins >= 8) opts.push({ title: "『頂へ — 勝利の記憶』", quote: "勝ち続けることでしか見えない景色があった。悔いはない。" });
  else opts.push({ title: "『それでも走った』", quote: "勝てない日も、腐らずペダルを回し続けた。それが誇りだ。" });
  if (podiums >= 10) opts.push({ title: "『表彰台の向こう側』", quote: "何度あの台に立っても、頂点への渇きは消えなかった。" });
  opts.push({ title: "『好敵手へ』", quote: s.rival ? `${s.rival.name}がいたから、俺はここまで来られた。` : "ライバルとは、鏡に映したもう一人の自分だった。" });
  opts.push({ title: "『次の世代へ』", quote: "この道は、後に続く者たちへ託したい。走る歓びよ、続け。" });
  return opts.slice(0, 3);
}

export function mlEpilogueDirector(s) {
  const r = s.player;
  const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
  const tone = wins >= 10 ? "百戦錬磨の経験を武器に" : wins >= 3 ? "現役時代に培った勘を頼りに" : "現役時代の悔しさを糧に";
  return `引退後は${s.team}のスポーツディレクターに転身。${tone}後進の指導にあたった。数年後、教え子の一人がプロ入りを果たしたという知らせが届いた。`;
}

export function mlEpilogueAway(s) {
  const r = s.player;
  return `引退後は競技の一線から静かに退き、第二の人生を歩み始めた。${r.name}の名は、あの頃を知るファンの記憶に長く残り続けている。`;
}

// v35(UI): キャリアの軌跡。raceLog から「語る価値のある一戦」だけを時系列で抽出し、
// 選手詳細（キャリアグラフ画面）に年表として並べる。勝利・モニュメント・格上レースの表彰台・
// 初勝利/初表彰台を拾う。純関数。
export function mlCareerTimeline(ml) {
  if (!ml || !ml.player) return [];
  const log = ml.player.raceLog || [];
  const out = [];
  let firstWinDone = false, firstPodiumDone = false;
  const isBig = (e) => /世界選手権|オリンピック|グランツール|ツアー|世界選手/.test(e.name || "");
  log.forEach((e, i) => {
    const rank = e.rank;
    const when = { year: e.year, month: e.month };
    if (rank === 1) {
      const first = !firstWinDone; firstWinDone = true;
      if (e.monument) out.push({ ...when, icon: "🏛", color: "#ffd24a", text: `${e.name}を制覇（クラシックの勝者）` });
      else if (isBig(e)) out.push({ ...when, icon: "🌍", color: "#ffd23f", text: `${e.name}で優勝！世界の頂点に立った` });
      else out.push({ ...when, icon: first ? "✨" : "🏆", color: "#ffd23f", text: first ? `プロ初勝利（${e.name}）` : `${e.name}で優勝` });
    } else if (rank <= 3) {
      if (e.monument) out.push({ ...when, icon: "🏛", color: "#e8a13c", text: `${e.name}で${rank}位（クラシック表彰台）` });
      else if (isBig(e)) out.push({ ...when, icon: "🥈", color: "#cfd6e4", text: `${e.name}で${rank}位（大舞台の表彰台）` });
      else if (!firstPodiumDone) { firstPodiumDone = true; out.push({ ...when, icon: "🎖", color: "#4fbf6b", text: `キャリア初表彰台（${e.name}で${rank}位）` }); }
    }
  });
  // 直近が上に来るよう新しい順。多すぎる場合は上位（最近）30件に留める
  return out.reverse().slice(0, 30);
}

// v35(逆メンター): 弟子（プロテジェ）の現在の状態を、弟子入りからの経過年数から算出する純関数。
// 成長力(growthPow)と、弟子を取った時の師（プレイヤー）の地力(mentorOvr)＝指導の質で伸びが決まる。
// インクリメンタルな状態更新を持たず「年が進めば自然に育つ」形（保存・分岐に依存しない）。
export function protegeState(protege, year) {
  if (!protege) return null;
  const yrs = Math.max(0, (year || protege.joinYear) - protege.joinYear);
  const powBase = { S: 5.6, A: 4.3, B: 3.1, C: 2.2 }[protege.growthPow] || 3.1;
  const guide = 0.7 + Math.max(0, ((protege.mentorOvr || 70) - 60)) / 120; // 師の地力で 0.7〜約1.0
  // v36(弟子深化): 指導イベントで積んだ「絆(bond 0〜100)」と「鍛錬(guideBonus)」が伸びに効く。
  // 絆＝寄り添って信頼を築くと最大+20%、鍛錬＝厳しく鍛えると最大+40%（数字が勝手に上がるだけの
  // 存在から、関わり方で伸びが変わる存在へ）。ovrBonus＝その場の後押しで即時に乗る加点。
  const bondMul = 1 + Math.min(100, protege.bond || 0) / 500;
  const trainMul = 1 + Math.min(0.4, protege.guideBonus || 0);
  const perYear = powBase * guide * bondMul * trainMul;
  const ovr = Math.min(96, Math.round((protege.ovr0 || 50) + yrs * perYear + (protege.ovrBonus || 0)));
  const age = (protege.age0 || 18) + yrs;
  // 直近の節目（70/80/90）到達の可視化用
  const nextMilestone = [70, 80, 90].find(t => ovr < t) || null;
  const bond = Math.min(100, protege.bond || 0);
  return { ovr, age, yrs, perYear: Number(perYear.toFixed(1)), nextMilestone, bond,
    trainMul: Number(trainMul.toFixed(2)), bondMul: Number(bondMul.toFixed(2)) };
}

// v36(#5リセマラ): デビュー時の「素質ランク」を算出する純関数。成長力・性格・特殊能力（金特/良特/悪特）・
// 爆発力（配合の伸びしろ）を総合し SS〜D で格付け。リセマラで狙う目標をひと目で示す。
// v43(マイライフ難易度調整Phase 1・成長力マスク化): 成長力(growthPow)自体は3年目まで非公開にするが、
// この素質ランクは成長力に最も重く（他の項目の2倍以上）依存しているため、成長力を隠したまま
// 素質ランクだけ見せると「Sランクが出るまで粘る」というリセマラの実質が温存されてしまう。
// revealPow=falseの間はpowScore項を丸ごと除外し、素質ランクからも成長力を推測できないようにする。
// v46(素質ランク圧縮修正): revealPow=false時はpowScoreが常に0になるため、公開時と同じ
// しきい値(2.5/5.8/8.5/11.5)のままだと分布が潰れる。実測（3経歴×5脚質・8万体）：
// 公開時 C45%/B44%/A11%/S0.4% に対し、非公開時に旧しきい値を使うとC96%/B4%/A0%/S0%まで
// 圧縮され、デビュー画面の「素質を引き直す」がほぼ常にCしか出ず機能しなくなっていた。
// 非公開スコア（=powScoreを除いた視認可能要素のみの合計）の分位点が、公開時の各ランク比率と
// 一致するよう専用しきい値を較正した（scratchpad/talentrank_calib.mjs）。
export function mlTalentRank(player, revealPow = true) {
  if (!player) return { rank: "C", color: "#9aa3b5", score: 0 };
  const powScore = revealPow ? ({ S: 3, A: 2, B: 1, C: 0 }[player.growthPow] ?? 1) : 0;
  const pers = PERSONALITIES[player.personality];
  const persScore = player.personality === "genius" ? 2.2 : (player.personality === "normal" ? 0 : 0.5);
  const abils = player.abilities || [];
  const gold = player.goldAbilities || [];
  let goodCount = 0, badCount = 0;
  abils.forEach(id => { const a = ABILITIES[id]; if (!a) return; if (a.bad) badCount++; else goodCount++; });
  const goldCount = gold.filter(id => ABILITIES[id] && !ABILITIES[id].bad).length;
  const growthRare = (player.growth === "super_late" || player.growth === "super_early") ? 1 : 0;
  const score = powScore * 2 + persScore + goodCount * 0.8 + goldCount * 1.7
    + (player.talentCap || 0) * 0.25 + (player.bakuhatsu || 0) * 0.15 + growthRare - badCount * 0.9;
  const T = revealPow
    ? { SS: 11.5, S: 8.5, A: 5.8, B: 2.5 }
    : { SS: 4.8, S: 3.8, A: 2.1, B: 0.5 };
  let rank, color;
  if (score >= T.SS) { rank = "SS"; color = "#ff7ac0"; }
  else if (score >= T.S) { rank = "S"; color = "#ffd23f"; }
  else if (score >= T.A) { rank = "A"; color = "#35c07e"; }
  else if (score >= T.B) { rank = "B"; color = "#4f8fe8"; }
  else { rank = "C"; color = "#9aa3b5"; }
  return { rank, color, score: Number(score.toFixed(1)),
    parts: { powScore, persLabel: pers?.label || "普通", goodCount, badCount, goldCount } };
}

// v36(弟子深化): 弟子の指導イベント。毎月ごく稀に発生し、師（プレイヤー）が関わり方を選ぶ。
// 「厳しく鍛える」系＝鍛錬(guideBonus)が伸び師も少し消耗、「寄り添う」系＝絆(bond)が深まり師も癒やされる。
// 弟子を"育てている実感"と、育て方による個性差を生む。TYPESに依存しない汎用シーン（名前は画面で差し込む）。
export const ML_PROTEGE_EVENTS = [
  { id: "slump", title: "弟子のスランプ",
    text: "弟子が結果を出せず、練習中も表情が暗い。「自分には才能がないのかも」と弱気なことを口にした。",
    choices: [
      { label: "厳しく発破をかける", result: "「甘えるな」と本気で叱咤した。悔し涙をこらえ、翌日から見違えるほど練習に打ち込むようになった。",
        protege: { guideBonus: 0.06, bond: 4, ovrBonus: 1 }, mentor: { fatigueDelta: 6 } },
      { label: "隣に座って話を聞く", result: "自分も同じ壁にぶつかった頃の話をした。少し表情が和らぎ、「もう少し頑張ってみます」と顔を上げた。",
        protege: { bond: 14 }, mentor: { fatigueDelta: -6, evalDelta: 2 } },
    ] },
  { id: "form", title: "弟子のフォーム相談",
    text: "弟子が「先輩のペダリングを盗みたい」と、フォームを見てほしいと頼んできた。",
    choices: [
      { label: "つきっきりで矯正する", result: "夜まで付き合い、無駄のない動きを叩き込んだ。効率が目に見えて上がった。",
        protege: { guideBonus: 0.07, bond: 6 }, mentor: { fatigueDelta: 8, abBoost: 1 } },
      { label: "要点だけ教えて自分で考えさせる", result: "ヒントだけ与えて突き放した。試行錯誤の末、自分なりの形を掴み始めた。",
        protege: { guideBonus: 0.03, bond: 8 }, mentor: { fatigueDelta: -2 } },
    ] },
  { id: "race_debut", title: "弟子の初レース",
    text: "弟子が初めて大きなレースに出る。緊張で前夜に眠れなかったらしい。",
    choices: [
      { label: "勝ちにこだわれと送り出す", result: "「お前なら獲れる」と背中を押した。気迫の走りで健闘し、大きな自信を掴んだ。",
        protege: { guideBonus: 0.05, bond: 6, ovrBonus: 1 }, mentor: { fatigueDelta: 3 } },
      { label: "楽しんでこいと肩を叩く", result: "「結果より、まず走りを楽しめ」と。伸び伸びと走り、レースそのものを好きになったようだ。",
        protege: { bond: 16 }, mentor: { fatigueDelta: -4 } },
    ] },
  { id: "gift", title: "弟子からの贈り物",
    text: "弟子が「いつもありがとうございます」と、小さなプレゼントを差し出してきた。",
    choices: [
      { label: "照れ隠しに稽古をつける", result: "礼の代わりだと、そのまま追い込みメニューに付き合わせた。二人とも汗だくになった。",
        protege: { guideBonus: 0.04, bond: 10 }, mentor: { fatigueDelta: 5 } },
      { label: "素直に受け取り労う", result: "ありがたく受け取り、これまでの努力を労った。師弟の絆がぐっと深まった。",
        protege: { bond: 18 }, mentor: { fatigueDelta: -8, evalDelta: 1 } },
    ] },
  { id: "temptation", title: "弟子の迷い",
    text: "弟子が「もっと待遇の良い他チームに誘われている」と打ち明けてきた。目は揺れている。",
    choices: [
      { label: "実力で黙らせろと鍛え直す", result: "「行きたければ行け。だがその前に、ここで一流になってみせろ」。覚悟を決め、練習量が跳ね上がった。",
        protege: { guideBonus: 0.08, bond: 8 }, mentor: { fatigueDelta: 7 } },
      { label: "お前の意志を尊重すると伝える", result: "頭ごなしに止めず、本人の気持ちを最優先した。「やっぱり、先輩の下で続けます」と残る道を選んだ。",
        protege: { bond: 20 }, mentor: { fatigueDelta: -3, evalDelta: 3 } },
    ] },
];

// v36(弟子深化): 年度をまたいだ時、弟子がOVRの節目(70/80/90)を越えたら祝いのニュースを返す（無ければnull）。
export function protegeMilestoneNews(protege, oldYear, newYear) {
  if (!protege) return null;
  const before = protegeState(protege, oldYear).ovr;
  const after = protegeState(protege, newYear).ovr;
  const crossed = [90, 80, 70].find(t => before < t && after >= t);
  if (!crossed) return null;
  const name = protege.name;
  if (crossed >= 90) return `🎓 弟子 ${name} がついにOVR90の壁を突破！世界のトップと肩を並べる領域へ。あなたの教えが世界を舞台に花開いた`;
  if (crossed >= 80) return `🎓 弟子 ${name} がOVR80に到達！エース級の風格をまとい、チームの中心を担う存在に成長した`;
  return `🎓 弟子 ${name} がOVR70を突破！一人前のプロとして、レースで結果を残せる選手になった`;
}
