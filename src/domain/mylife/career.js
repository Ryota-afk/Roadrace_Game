// マイライフのキャリア年表・弟子（プロテジェ）・素質ランク・エピローグ。第13弾Phase0でlogic/support.jsから分離。
import { loadMlLegends, saveMlLegends } from "../../breeding/breeding.js";
import { ABILITIES, PERSONALITIES } from "../../data/abilities.js";
import { CLASSES } from "../../data/progression.js";

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

// 第32弾（第2次UI改革）B-4第2バッチ: 自伝の選択肢。旧実装は「書名を選ぶが、殿堂に
// 残るのは書名とは別の引用文」という構造で、選ぶ前に残る言葉を一度も見せていなかった。
// 書名（どこにも保存されていなかった）を廃止し、実際に刻まれる言葉そのものを並べる。
//
// さらに旧実装は「各グループで一番めずらしい条件を1つだけ残す」方式で、やり込んで
// 複数グループが同時に最高位へ達すると毎回同じ言葉を指す欠陥があった（実測：11年
// プレイした個体が戦績・好敵手・受け継ぎ・歩みの4グループすべてで最高位に到達）。
// 「当てはまった言葉を全部候補にし、最高位の1段下(tol=1)まで同格に扱う」方式へ変更。
// 実測（scratchpad/proto_autobio.mjs）：同戦績で名前だけ違う20人について、
// 最高位だけを残す方式は全員が同じ話題（世界1位）で始まったが、1段下も同格にすると
// 話題が6種類に散った。選ぶ順序はキャリア固有の値から決めるため、同じ選手なら
// 何度開いても同じ3つが出る（再描画のたびに入れ替わらない）。
const ML_AUTOBIO_POOL = [
  // ---- 戦績 ----
  { grp: "戦績", r: 5, ok: c => c.worldRankBest === 1, vs: [
    "世界の頂に立った日の風は、今も忘れられない。",
    "頂点から見た景色を知っている。それだけで一生分だ。",
    "世界の一番上に、確かに名前が刻まれた。"] },
  { grp: "戦績", r: 4, ok: c => c.monumentWins >= 1, vs: [
    "古典と呼ばれるレースを制した。あの一日は生涯色褪せない。",
    "百年続く道で先頭を走った。歴史に一行だけ書き足せた。"] },
  { grp: "戦績", r: 4, ok: c => c.wins >= 20, vs: [
    "勝ち続けることでしか見えない景色があった。悔いはない。",
    "数えきれないほど手を挙げた。どの一回も同じではなかった。",
    "勝つことに慣れてしまう日は、ついに来なかった。"] },
  { grp: "戦績", r: 3, ok: c => c.wins >= 8, vs: [
    "あの一勝があったから、次の一勝を追いかけられた。",
    "勝てる日が来ると信じて続けた。その通りになった。"] },
  { grp: "戦績", r: 3, ok: c => c.podiums >= 10 && c.wins <= 2, vs: [
    "あと一歩が、これほど遠いとは思わなかった。",
    "二番手の景色ばかり見てきた。それでも走る理由はあった。"] },
  { grp: "戦績", r: 2, ok: c => c.podiums >= 10, vs: [
    "何度あの台に立っても、頂点への渇きは消えなかった。",
    "表彰台の高さに慣れるほど、上の段が遠く見えた。"] },
  { grp: "戦績", r: 2, ok: c => c.wins === 0 && c.races > 0, vs: [
    "一度も勝てなかった。それでも毎朝、自転車に跨った。",
    "記録には残らない走りばかりだった。悔いは、少しある。"] },
  { grp: "戦績", r: 0, ok: () => true, vs: [
    "勝てない日も、腐らずペダルを回し続けた。それが誇りだ。"] },

  // ---- 好敵手 ----
  { grp: "好敵手", r: 4, ok: c => c.rival && c.rm >= 10 && c.rw > c.rl, vs: [
    "{rival}と競り合った日々こそが、全盛期だった。",
    "{rival}を退けた数だけ、強くなれた気がする。",
    "{rival}がいなければ、ここまで踏めなかった。"] },
  { grp: "好敵手", r: 4, ok: c => c.rival && c.rm >= 10 && c.rl >= c.rw, vs: [
    "{rival}の背中は、最後まで追いつけなかった。",
    "{rival}に届かなかった。その悔しさが脚を作った。",
    "生涯をかけて{rival}を追った。悪くない一生だった。"] },
  { grp: "好敵手", r: 3, ok: c => c.rival && c.rm >= 1, vs: [
    "{rival}という存在が、走り続ける理由をくれた。",
    "{rival}と同じ時代を走れたのは、幸運だった。"] },
  { grp: "好敵手", r: 0, ok: () => true, vs: [
    "ライバルとは、鏡に映したもう一人の自分だった。"] },

  // ---- 受け継ぎ ----
  { grp: "受け継ぎ", r: 4, ok: c => !!c.protege, vs: [
    "{protege}の走りの中に、確かに何かが残っている。",
    "{protege}に渡せるものは渡した。あとは託すだけだ。",
    "{protege}が勝つ日を、誰より楽しみにしている。"] },
  { grp: "受け継ぎ", r: 3, ok: c => c.mentor, vs: [
    "若い者に伝えられることは、全部伝えたつもりだ。",
    "教えることで、自分の走りをもう一度覚え直した。"] },
  { grp: "受け継ぎ", r: 3, ok: c => !!c.master, vs: [
    "{master}に教わった一言を、今日まで胸に置いてきた。",
    "{master}の走りを真似ることから、全部が始まった。"] },
  { grp: "受け継ぎ", r: 2, ok: c => c.hasParents, vs: [
    "受け継いだものを、少しは太くできただろうか。",
    "血の中に走り方が入っていた。抗う気はなかった。"] },
  { grp: "受け継ぎ", r: 0, ok: () => true, vs: [
    "この道は、後に続く者たちへ託したい。走る歓びよ、続け。"] },

  // ---- 歩み ----
  { grp: "歩み", r: 4, ok: c => c.races >= 100, vs: [
    "百を超えるレースを走った。同じ一日は一度もなかった。",
    "数えるのをやめるほど走った。脚が覚えている。",
    "走った道を全部つなげたら、どこまで行けただろう。"] },
  { grp: "歩み", r: 3, ok: c => c.year >= 12, vs: [
    "長く走り続けられたこと、それ自体が勲章だ。",
    "辞めどきを何度も考えた。そのたびにもう一年走った。"] },
  { grp: "歩み", r: 3, ok: c => c.married, vs: [
    "帰る家があったから、最後まで踏み続けられた。",
    "待っている人がいる。それが一番のペースメーカーだった。"] },
  { grp: "歩み", r: 2, ok: c => c.reducedRole, vs: [
    "エースの座を降りてからの数年に、一番多くを学んだ。",
    "誰かのために踏む走りにも、確かな誇りがあった。"] },
  { grp: "歩み", r: 2, ok: c => c.classIdx >= c.classMax, vs: [
    "一番上の舞台で戦えた。それで十分だ。",
    "上がれるところまで上がった。景色は思った通りだった。"] },
  { grp: "歩み", r: 0, ok: () => true, vs: [
    "うまくいかない日のほうが多かった。それでも走り続けた。"] },
];

const ML_AUTOBIO_GROUPS = ["戦績", "好敵手", "受け継ぎ", "歩み"];

// キャリア固有の種（同じキャリアなら毎回同じ3つが出る＝再描画で入れ替わらない）。
const mlAutobioSeed = (c) => {
  const s = `${c.name}|${c.year}|${c.races}|${c.wins}|${c.podiums}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
// splitmix系の撹拌。単純な seed+salt では10人中6通りにしか散らず1つの言い回しに
// 偏った（実測）。撹拌後は10人中10通りに改善。
const mlAutobioMix = (seed, salt) => {
  let h = (seed ^ Math.imul(salt + 1, 0x9E3779B1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
const mlAutobioFill = (t, c) => t.replace("{rival}", c.rival || "").replace("{protege}", c.protege || "").replace("{master}", c.master || "");

function mlAutobioPick(c, n = 3, tol = 1) {
  const seed = mlAutobioSeed(c);
  const hits = ML_AUTOBIO_POOL.filter(q => q.ok(c));
  const perGroup = ML_AUTOBIO_GROUPS.map((g, gi) => {
    const gh = hits.filter(q => q.grp === g);
    const top = Math.max(...gh.map(q => q.r));
    const best = gh.filter(q => q.r >= top - tol);
    const q = best[mlAutobioMix(seed, gi * 3 + 1) % best.length];
    const text = q.vs[mlAutobioMix(seed, gi * 3 + 2) % q.vs.length];
    return { grp: g, r: q.r, text: mlAutobioFill(text, c) };
  });
  const order = [...perGroup].sort((a, b) =>
    (b.r - a.r) || (mlAutobioMix(seed, 100 + ML_AUTOBIO_GROUPS.indexOf(a.grp)) % 997) - (mlAutobioMix(seed, 100 + ML_AUTOBIO_GROUPS.indexOf(b.grp)) % 997));
  return order.slice(0, n);
}

// キャリアの事実を、選択ロジックが必要とする形へ抽出する。
export function careerFacts(ml) {
  const p = ml.player || {}, log = p.raceLog || [], rr = ml.rivalRecord || {}, f = ml.flags || {};
  return {
    name: p.name, year: ml.year || 0, races: log.length,
    wins: log.filter(e => e.rank === 1).length,
    podiums: log.filter(e => e.rank <= 3).length,
    monumentWins: log.filter(e => e.monument && e.rank === 1).length,
    worldRankBest: ml.worldRankBest, classIdx: ml.classIdx || 0, classMax: CLASSES.length - 1,
    rival: (ml.rival || {}).name, rm: rr.meetings || 0, rw: rr.wins || 0, rl: rr.losses || 0,
    protege: (ml.protege || {}).name, master: p.master || null,
    hasParents: !!(p.parentBloodIds || []).length,
    mentor: !!f.mentor, married: !!f.married, reducedRole: !!f.reducedRole,
  };
}

export function mlAutobiographyOptions(ml) {
  return mlAutobioPick(careerFacts(ml), 3, 1).map(q => ({ text: q.text }));
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
// 第13弾Phase3-C: iconフィールドを撤去（絵文字ゼロの原則。表示側はdownフラグの有無で
// 文字色を分ける）。あわせて「勝利しか記録されない」というユーザー指摘を受け、大舞台での
// 二桁着順・3年以上の勝利空白という2種類の挫折も拾うようにした。
// モニュメント（古典レース）のレース名は生成時に年が焼き込まれる
// （domain/mylife/race.js:22 の `${year}年目 ${mon.name}`）。raceLogにはnameしか
// 保存されないため、一覧の左に出る年（e.year）と本文の中の年が二重になる。
// 本文側だけ先頭の「N年目」を落として重複を断つ（生成側は他画面でも使うため無改修）。
const mlCareerShortName = (n) => String(n || "").replace(/^\d+年目\s*/, "");

export function mlCareerTimeline(ml) {
  if (!ml || !ml.player) return [];
  const log = ml.player.raceLog || [];
  const out = [];
  let firstWinDone = false, firstPodiumDone = false;
  const isBig = (e) => /世界選手権|オリンピック|グランツール|ツアー|世界選手/.test(e.name || "");
  log.forEach((e) => {
    const rank = e.rank;
    const when = { year: e.year, month: e.month };
    const name = mlCareerShortName(e.name);
    if (rank === 1) {
      const first = !firstWinDone; firstWinDone = true;
      if (e.monument) out.push({ ...when, text: `${name}を制覇（クラシックの勝者）` });
      else if (isBig(e)) out.push({ ...when, text: `${name}で優勝！世界の頂点に立った` });
      else out.push({ ...when, text: first ? `プロ初勝利（${name}）` : `${name}で優勝` });
    } else if (rank <= 3) {
      if (e.monument) out.push({ ...when, text: `${name}で${rank}位（クラシック表彰台）` });
      else if (isBig(e)) out.push({ ...when, text: `${name}で${rank}位（大舞台の表彰台）` });
      else if (!firstPodiumDone) { firstPodiumDone = true; out.push({ ...when, text: `キャリア初表彰台（${name}で${rank}位）` }); }
    } else if (isBig(e) && rank >= 11) {
      out.push({ ...when, text: `${name}で${rank}位。世界の壁は高かった`, down: true });
    }
  });
  // 3年以上の勝利空白を挫折として拾う（勝利の無い年が連続した区間の始点を記録）
  const raceYears = log.map(e => e.year);
  const winYears = [...new Set(log.filter(e => e.rank === 1).map(e => e.year))].sort((a, b) => a - b);
  if (raceYears.length > 0) {
    const firstYear = Math.min(...raceYears), lastYear = Math.max(...raceYears);
    let prev = firstYear;
    for (const wy of winYears) {
      if (wy - prev >= 3) out.push({ year: prev, month: null, text: `${prev}年目から${wy - prev}年間、勝利から遠ざかった`, down: true });
      prev = wy;
    }
    if (lastYear - prev >= 3) out.push({ year: prev, month: null, text: `${prev}年目から${lastYear - prev}年間、勝利から遠ざかった`, down: true });
  }
  // 直近が上に来るよう新しい順。多すぎる場合は上位（最近）30件に留める
  return out.sort((a, b) => (b.year - a.year) || ((b.month ?? -1) - (a.month ?? -1))).slice(0, 30);
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
