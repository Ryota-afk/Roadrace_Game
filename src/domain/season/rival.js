// ライバル・殿堂判定・因縁演出。第13弾Phase0でlogic/support.jsから分離。
import { mulberry, overall, pickRiderName, ridState, rollAbilities } from "../../core/core.js";
import { AB_KEYS, AB_LABEL, PERSONALITIES, TYPES } from "../../data/abilities.js";
import { DIFFICULTIES, DISCIPLINE_KEYS } from "../../data/progression.js";
import { MYLIFE_TEAMS, teamsForClass } from "../../state/state.js";
import { aiPowerFor, ovrBandLabel, scoutedAbilities, scoutStageFromLv } from "../shared/scouting.js";
import { aptGrade, disciplineScore } from "../shared/growth.js";

export function isHallOfFameWorthy(r) {
  if (r.favorite) return true;
  const log = r.raceLog || [];
  const wins = log.filter(e => e.rank === 1).length;
  const podiums = log.filter(e => e.rank <= 3).length;
  return log.length >= 8 || wins >= 1 || podiums >= 3 || overall(r) >= 70 || !!r.prodigy;
}

export function mlTeamTier(teamName) { const t = MYLIFE_TEAMS.find(t => t.name === teamName); return t ? t.tier : 0; }

// v35(D 物語): 因縁が育つライバル。対戦を重ね、特に接戦（写真判定・僅差）ほど
// 「因縁度(heat)」が燃え上がり、呼称が 好敵手→ライバル→宿敵→宿命の宿敵 と激化する。
// 既存セーブ（heat未保存）は通算対戦数からフォールバック。
export function rivalHeatTier(heat) {
  const h = heat || 0;
  if (h >= 22) return { key: 3, label: "宿命の宿敵", color: "#ff4d4d" };
  if (h >= 11) return { key: 2, label: "宿敵", color: "#ff7a45" };
  if (h >= 4)  return { key: 1, label: "ライバル", color: "#e8a13c" };
  return { key: 0, label: "好敵手", color: "#5aa9e6" };
}

// 1戦で加算される因縁度。接戦ほど大きく燃える（写真判定+3／僅差+2／通常+1）
export function rivalMeetingHeat(gapSec) {
  const g = Math.abs(gapSec == null ? 99 : gapSec);
  if (g < 1) return 3;
  if (g < 4) return 2;
  return 1;
}

// 1戦の「決定的瞬間」を物語る一文を生成。勝敗×接戦度×格上/格下で分岐し、
// 因縁度が上がった瞬間は昇格の煽りも添える。
export function rivalDrama({ beat, gapSec, rivalName, rivalRank, myRank, heatBefore, heatAfter }) {
  const g = Math.abs(gapSec == null ? 99 : gapSec);
  const gTxt = g < 60 ? `${g.toFixed(1)}秒` : `${Math.floor(g / 60)}分${Math.round(g % 60)}秒`;
  const photo = g < 1, close = g < 4;
  // 第60弾(devlog/wave60.md): 表示側（RivalBlock）が既に見出しでライバル名を出しているため、
  // 本文でも名前を繰り返すと二重表示になる。全分岐で本文から名前を落とす。
  // 第83弾(devlog/wave83.md): ⚠️myRankを引数で受け取りながら一度も使っておらず、勝敗と
  // タイム差だけで文言を決めていた。そのため48人中27位でも「完勝。今日は完全にあなたの
  // 一日だった」と出る（実機プレイで発見）。ライバルに勝っても自分が上位でなければ
  // 「二人の戦い」に留める文言へ分岐させる。
  const lowPlacing = myRank != null && myRank > 10;
  let line;
  if (beat) {
    if (photo) line = `写真判定にもつれ込む死闘。わずか${gTxt}、競り落とした。`;
    else if (close) line = `最後まで並走する接戦を、${gTxt}振り切って制した。視線が背中に刺さる。`;
    else if (lowPlacing) line = `${gTxt}先着。上位には届かなかったが、この一戦は譲らなかった。`;
    else line = `${gTxt}突き放す完勝。今日は完全にあなたの一日だった。`;
  } else {
    if (photo) line = `写真判定の末、わずか${gTxt}。刺し返された。この悔しさは忘れない。`;
    else if (close) line = `わずか${gTxt}及ばず。あと一歩、その差を埋める日が来る。`;
    else line = `${gTxt}の完敗。力の差を見せつけられ、拳を握る。`;
  }
  const before = rivalHeatTier(heatBefore), after = rivalHeatTier(heatAfter);
  const promoted = after.key > before.key ? `——この一戦で、二人の因縁はついに『${after.label}』の域に入った。` : null;
  return { line, promoted, tier: after };
}

// v36(#6): 性格ベースのライバル会話ドラマ（紙芝居/VN風）。ライバルの性格・勝敗・接戦度・因縁度で
// 台詞を分岐し、短い掛け合いを生成する。whenBeaten＝プレイヤーが勝ってライバルが敗れた時、
// whenWon＝ライバルが勝った時、vow＝因縁が深い時に添える決意の一言。
const RIVAL_VOICE = {
  hotblood: {
    whenBeaten: ["「くそぉっ…！ 今日はお前の勝ちだ。だが次は、次こそは俺が前でゴールする！", "「認めるさ、今日は速かった。でもな、この悔しさが俺を強くするんだ！"],
    whenWon: ["「はっはァ！ 見たか、これが俺の走りだ！ ついてこられたか？", "「まだまだだな！ お前が本気を出す前に、俺が突き放させてもらった！"],
    vow: ["「燃えてきたぜ…お前がいるから、俺はもっと速くなれる。次も本気で来い！"],
  },
  seeker: {
    whenBeaten: ["「……強い。今のあなたには、確かに届かなかった。", "「敗因は明確だ。私はまだ、自分の限界の先に手が届いていない。"],
    whenWon: ["「これが今の私の答えだ。あなたの走りも、悪くなかった。", "「勝ち負けは過程に過ぎない。私はただ、より速い自分を求め続けるだけだ。"],
    vow: ["「あなたという壁があるから、私は歩みを止められない。……感謝している。"],
  },
  artisan: {
    whenBeaten: ["「ふむ、完敗だ。あなたのラインどり、無駄がなかった。盗ませてもらうよ。", "「悔しいが、美しい勝ち方だった。職人として、認めざるを得ない。"],
    whenWon: ["「計算通りさ。一つひとつの仕事を、丁寧に積み重ねただけだ。", "「派手さはないが、これが私の流儀でね。届かなかったろう？"],
    vow: ["「あなたと競るたび、自分の技が磨かれていく。良い好敵手を持ったものだ。"],
  },
  free: {
    whenBeaten: ["「あーあ、負けちゃった。まあいいや、今日は楽しかったし！", "「やるねぇ。ちょっと本気出せばよかったかな〜、なんてね。"],
    whenWon: ["「あははっ、勝っちゃった！ 気持ちよかった〜！", "「たまたまだよ、たまたま。でも勝ちは勝ち、もらっとくね！"],
    vow: ["「君と走るの、けっこう好きなんだよね。次もよろしく！"],
  },
  smart: {
    whenBeaten: ["「……想定の範囲外だ。あなたの脚を、少し見誤っていたようだね。", "「データ上は私が有利だったはずだが。面白い、修正して次に臨むとしよう。"],
    whenWon: ["「盤面は最初から見えていた。あなたが仕掛ける前に、決着はついていたのさ。", "「勝つべくして勝った。感情ではなく、戦術がレースを決めるんだ。"],
    vow: ["「あなたは私の計算を狂わせる、数少ない変数だ。……嫌いじゃない。"],
  },
  genius: {
    whenBeaten: ["「へえ、僕を負かすなんて。少しは楽しめそうだね、君となら。", "「まぐれか、実力か。次で見極めさせてもらうよ。"],
    whenWon: ["「言ったろう？ 僕に勝つのは、まだ早いって。", "「才能の差、と言ったら怒るかい？ でも事実なんだから仕方ない。"],
    vow: ["「君が僕に追いつく日を、退屈しのぎに待っていてあげるよ。"],
  },
  normal: {
    whenBeaten: ["「参りました。今日はあなたの方が一枚上手でした。", "「悔しいですけど、完敗です。次は負けません。"],
    whenWon: ["「勝てた…！ 練習の成果が出ました。", "「今日は流れが味方してくれました。でも実力で掴んだ勝ちです。"],
    vow: ["「あなたと競り合えるのが、今は何より励みになります。次も全力で。"],
  },
  maverick: {
    whenBeaten: ["「……ふん。群れないやり方が今日は裏目に出たか。だが俺の走りは変えない。", "「一人でも構わない。次はこの脚で、お前の前を独走してみせる。"],
    whenWon: ["「群れなくても勝てる。俺はそれを証明しただけだ。", "「馴れ合いは要らない。強い奴が前を走る、ただそれだけさ。"],
    vow: ["「お前だけは……認めてやる。俺を本気にさせる、数少ない一人だ。"],
  },
  showman: {
    whenBeaten: ["「うわ、やられた！ でも今日の観客、盛り上がってたろ？ それでいいのさ。", "「主役を持っていかれたか。次はもっと派手に決めてやるよ、見てな！"],
    whenWon: ["「どうだ、見てたか今の差し脚！ これが魅せるってことさ！", "「歓声が聞こえるだろ？ 勝つならこうでなくちゃな！"],
    vow: ["「お前がいると舞台が締まる。次も最高のショーにしようぜ！"],
  },
  tactician: {
    whenBeaten: ["「読みが甘かった。あなたの一手が、私の描いた図面を上回った。", "「敗着は明確だ。次までに布石を打ち直す。侮らないことだ。"],
    whenWon: ["「盤面通りだ。仕掛けどころも、脚の温存も、すべて計算のうちさ。", "「勝負は脚だけでは決まらない。頭を使った者が勝つ。それだけだ。"],
    vow: ["「あなたは私の計略を崩す厄介な変数だ。……だからこそ、面白い。"],
  },
};
const PLAYER_LINES = {
  winClose: ["「ギリギリだった…お前がいると、いつも力を出し切れる。", "「危なかった。次も、その次も、負けるつもりはない。"],
  win: ["「まだ伸びるさ。次はもっと差をつけてみせる。", "「今日は獲った。だが慢心はしない。"],
  loseClose: ["「あと一歩…。この差は、必ず埋めてみせる。", "「悔しい。でも、この距離ならいつか抜ける。"],
  lose: ["「完敗だ…。だが、この背中は追い続ける。", "「今日は届かなかった。次までに、必ず強くなる。"],
};
// v36修正: 会話ドラマを一往復の紙芝居から「返答を選べる双方向イベント」へ。プレイヤーの返し
// （称える/強気 or 認める/悔しさ）に、ライバルが性格で反応する。返答は心情（メンタル）・人気・
// 因縁度(heat)に効く。
const RIVAL_REPLY = {
  hotblood: { respect: ["…ふん、お前にそう言われると悪い気はしねえ。次も本気で来いよ！"], fire: ["はっ、言うじゃねえか！ その意気だ、次はもっと熱くいこうぜ！"] },
  seeker: { respect: ["その言葉、胸に刻んでおく。互いに高め合おう。"], fire: ["……いい目だ。その闘志こそ、私が求めていたものだ。"] },
  artisan: { respect: ["礼を言うよ。良い勝負は、良い相手あってこそだ。"], fire: ["威勢がいいね。なら私も、もっと腕を磨かせてもらおう。"] },
  free: { respect: ["なんだ、素直だなあ。そういうの、嫌いじゃないよ。"], fire: ["おっと、やる気だねぇ。じゃあ次はもっと本気で遊ぼうか！"] },
  smart: { respect: ["冷静な自己分析だ。感情に流されない君は、厄介な相手になる。"], fire: ["面白い。その強気がどこまで通用するか、次で試させてもらう。"] },
  genius: { respect: ["殊勝じゃないか。少し見直したよ。"], fire: ["いいね、その顔。退屈しのぎには、それくらいでないとね。"] },
  normal: { respect: ["こちらこそ。良い刺激になります、これからも。"], fire: ["その意気ですね。負けていられません、次も全力で。"] },
  maverick: { respect: ["……悪くない。馴れ合いは嫌いだが、お前の走りは嫌いじゃない。"], fire: ["いい目だ。孤高の俺を追ってこられるものなら、追ってみろ。"] },
  showman: { respect: ["おっ、粋なこと言うねぇ。お前、いい相棒になりそうだ！"], fire: ["はっ、その負けん気こそ最高の演出だ！ 次も盛り上げようぜ！"] },
  tactician: { respect: ["冷静だな。感情を制御できる相手ほど、崩しにくい。厄介だよ。"], fire: ["威勢がいい。だが勢いだけでは私の盤面は破れない。試してみるか？"] },
};
const PLAYER_RESPOND = {
  winRespect: { label: "健闘を称える", line: "いいレースだった。お前がいたから、俺も出し切れた。" },
  winFire: { label: "さらに強気に出る", line: "次も、その次も、前を走るのは俺だ。ついてこい。" },
  loseRespect: { label: "潔く負けを認める", line: "完敗だ。今日のお前は強かった。素直に認めるよ。" },
  loseFire: { label: "悔しさをぶつける", line: "…覚えてろ。この借りは、次のレースで必ず返す。" },
};
// v38(改善:会話を厚く): その一戦の状況（接戦/圧勝/完敗/大舞台）を地の文で描写し、会話に文脈を与える。
// 同じ性格の台詞でも「今この瞬間」の物語として立ち上がるようにする。
const RIVAL_SITUATION = {
  close: ["わずかな差だった。ゴール後、荒い息のまま二人の視線が交差する。", "紙一重。決着の余韻が残る中、相手がゆっくりと口を開いた。", "最後まで並走した末の一瞬の差。互いの脚を、誰より知っている。"],
  blowoutWin: ["圧倒的な走りだった。悔しさを噛み殺しながら、相手が近づいてくる。", "背中も見せない完勝。それでも相手は、まっすぐこちらを見据えていた。"],
  blowoutLose: ["完敗だった。息を整えるこちらへ、相手が静かに歩み寄る。", "力の差を見せつけられた。だが、うつむいている場合ではない。"],
  bigWin: ["大舞台を制した高揚の中、宿敵がこちらへ手を伸ばしてきた。", "最高の舞台での勝利。その熱気の中で、二人はまた向き合う。"],
  bigLose: ["大一番で敗れた悔しさ。それでも、この舞台で競えたことに意味がある。", "大舞台の敗北は重い。だが宿敵の存在が、次への焔を灯す。"],
  normal: ["レースを終え、二人はまた言葉を交わす。", "ゴール後のわずかな時間。宿敵との、いつもの掛け合いが始まる。"],
};
export function rivalScene({ rival, beat, gapSec, heatAfter, playerName, seed, record, big }) {
  if (!rival) return null;
  const pers = rival.personality || "normal";
  const V = RIVAL_VOICE[pers] || RIVAL_VOICE.normal;
  const R = RIVAL_REPLY[pers] || RIVAL_REPLY.normal;
  const tier = rivalHeatTier(heatAfter);
  const rng = mulberry(((seed || 1) >>> 0) || 1);
  const pick = a => a[Math.floor(rng() * a.length)] || a[0];
  // 状況（接戦/圧勝/完敗/大舞台）を選んで地の文にする
  const ag = Math.abs(gapSec || 0);
  const sitKey = big ? (beat ? "bigWin" : "bigLose")
    : ag < 3 ? "close"
    : ag > 30 ? (beat ? "blowoutWin" : "blowoutLose")
    : "normal";
  const situation = pick(RIVAL_SITUATION[sitKey] || RIVAL_SITUATION.normal);
  // 通算対戦成績を一言で（因縁の積み重ねを可視化）
  const w = record?.wins || 0, l = record?.losses || 0, m = record?.meetings || 0;
  const recordLine = m >= 2 ? `通算 ${w}勝${l}敗——${w > l ? "今はあなたが上だ" : w < l ? "まだ分が悪い" : "五分の戦いが続く"}` : null;
  const opening = { name: rival.name, text: pick(beat ? V.whenBeaten : V.whenWon).replace(/」?$/, "」") };
  const mkResp = (r, tone) => ({
    label: r.label, playerLine: r.line.replace(/」?$/, "」"),
    reply: { name: rival.name, text: pick(tone === "respect" ? R.respect : R.fire).replace(/」?$/, "」") },
    tone,
    effects: beat
      ? (tone === "respect" ? { mentalDelta: 2, heatDelta: 1 } : { popularityDelta: 3, heatDelta: 2 })
      : (tone === "respect" ? { mentalDelta: 2, heatDelta: 1 } : { mentalDelta: 3, heatDelta: 2 }),
  });
  const responses = beat
    ? [mkResp(PLAYER_RESPOND.winRespect, "respect"), mkResp(PLAYER_RESPOND.winFire, "fire")]
    : [mkResp(PLAYER_RESPOND.loseRespect, "respect"), mkResp(PLAYER_RESPOND.loseFire, "fire")];
  return { persLabel: PERSONALITIES[pers]?.label || "", tierLabel: tier.label, tierColor: tier.color, situation, recordLine, opening, responses };
}
export function rivalDialogue({ rival, beat, gapSec, heatAfter, playerName, seed }) {
  if (!rival) return null;
  const pers = rival.personality || "normal";
  const close = Math.abs(gapSec == null ? 99 : gapSec) < 4;
  const tier = rivalHeatTier(heatAfter);
  const rng = mulberry(((seed || 1) >>> 0) || 1);
  const pick = arr => arr[Math.floor(rng() * arr.length)] || arr[0];
  const V = RIVAL_VOICE[pers] || RIVAL_VOICE.normal;
  const rivalLine = pick(beat ? V.whenBeaten : V.whenWon);
  const meLine = beat ? pick(close ? PLAYER_LINES.winClose : PLAYER_LINES.win)
    : pick(close ? PLAYER_LINES.loseClose : PLAYER_LINES.lose);
  const lines = [
    { who: "rival", name: rival.name, text: rivalLine.replace(/」?$/, "」") },
    { who: "me", name: playerName || "自分", text: meLine.replace(/」?$/, "」") },
  ];
  if (tier.key >= 2) lines.push({ who: "rival", name: rival.name, text: pick(V.vow).replace(/」?$/, "」") });
  return { lines, tierLabel: tier.label, tierColor: tier.color, persLabel: PERSONALITIES[pers]?.label || "" };
}

// v45: ユーザー指摘「イベントで起きた能力変化などは必ず明示したほうがいい」への対応。
// ML_CROSSROADSの各choice.applyは能力値を直接書き換えるが、resultは物語文のみで数値を
// 一切示していなかった（例：怪我イベントで能力-1〜-5されても本文に数値が出ない）。
// before/afterのAB_KEYSを機械的に比較して差分だけ拾うので、choice側の記述漏れが起きない。
export function abilityDeltaSummary(player, prevPlayer) {
  if (!player || !prevPlayer) return "";
  const parts = [];
  AB_KEYS.forEach(k => {
    const d = Math.round((player[k] || 0) - (prevPlayer[k] || 0));
    if (d !== 0) parts.push(`${AB_LABEL[k]}${d > 0 ? "+" : ""}${d}`);
  });
  return parts.length ? `（${parts.join("・")}）` : "";
}

// v51(第11弾Phase3・3-C): シーズン版「他チーム名鑑」。自クラス（teamsForClass）の相手選手を
// スカウトLv（g.staff.scout、0-3）に応じた段階で査定する。マイライフと違い対戦経験の概念が
// 無いため、開示はスタッフ雇用だけで決まる（スタッフを雇う＝情報を得る行為、という点は
// マイライフの「対戦する」と同じ構図）。
export function seasonRivalDex(g) {
  const rosters = g.rivalRosters || {};
  const teams = teamsForClass(g.classIdx);
  const diffDef = DIFFICULTIES.find(d => d.id === g.difficulty) || DIFFICULTIES[0];
  const aiCap = diffDef.abilCap ?? 94;
  const stage = scoutStageFromLv(g.staff && g.staff.scout);
  return teams.map(t => {
    const roster = rosters[t.name] || [];
    const riders = roster.map(wr => {
      let scout = null;
      if (stage >= 1) {
        const power = aiPowerFor(52, t.tier, 2, diffDef.aiMul);
        const ab = scoutedAbilities(wr, power, g.year, aiCap);
        if (stage === 1) scout = { stage, ovrBand: ovrBandLabel(ab.ovr) };
        else if (stage === 2) scout = { stage, grades: DISCIPLINE_KEYS.reduce((acc, k) => { acc[k] = aptGrade(disciplineScore(ab, k)); return acc; }, {}) };
        else scout = { stage, ...ab };
      }
      return { id: wr.id, name: wr.name, type: wr.type, age: wr.age, scoutStage: stage, scout };
    });
    return { teamName: t.name, color: t.color, trait: t.trait, riders };
  });
}

export function mlCreateRival(rng, playerName, playerTeamName, bannedNames, bannedTeams) {
  const excludeTeams = new Set([playerTeamName, ...(bannedTeams || [])]);
  const otherTeams = MYLIFE_TEAMS.filter(t => !excludeTeams.has(t.name));
  const team = otherTeams[Math.floor(rng() * otherTeams.length)];
  const keys = Object.keys(TYPES);
  const type = keys[Math.floor(rng() * keys.length)];
  const banned = new Set([playerName, ...(bannedNames || [])]);
  const name = pickRiderName(rng, banned);
  const px = rng();
  const personality = px < 0.30 ? "normal" : px < 0.35 ? "genius"
    : ["hotblood", "seeker", "artisan", "free", "smart", "maverick", "showman", "tactician"][Math.floor(rng() * 8)];
  const abilities = rollAbilities(rng);
  return { id: ridState.value++, name, type, team: team.name, age: 20 + Math.floor(rng() * 8), personality, abilities };
}

// 第16弾A: ライバルの加齢・引退・後継。世界のロースター（ageWorldRosters）と同じ引退ルール
// （38歳で強制、33歳以上は0.18+(age-33)*0.06の確率）を適用する。引退すれば、その好敵手との
// 記録（rivalRecord）を持ち帰りつつ、若い後継のライバルを新たに立てる（対戦成績はリセット＝
// 因縁は一から）。旧セーブ（ageを保存していない）は26歳（生成時の年齢帯20〜27の中央値）として
// 扱う。戻り値: { rival, record, retiredInfo }（retiredInfoは引退が起きた年だけ非null）。
export function ageRival(rival, record, rng, year, playerName, playerTeamName, bannedNames, bannedTeams) {
  if (!rival) return { rival, record, retiredInfo: null };
  const age = (rival.age != null ? rival.age : 26) + 1;
  const retireChance = age >= 38 ? 1 : (age >= 33 ? 0.18 + (age - 33) * 0.06 : 0);
  if (retireChance > 0 && rng() < retireChance) {
    const retiredInfo = {
      name: rival.name, team: rival.team, type: rival.type, age, year,
      record: { ...(record || { meetings: 0, wins: 0, losses: 0 }) },
      heat: (record && record.heat) || 0,
    };
    const successor = mlCreateRival(rng, playerName, playerTeamName, bannedNames, bannedTeams);
    successor.age = 20 + Math.floor(rng() * 4); // 後継は20〜23歳の新星
    return { rival: successor, record: { meetings: 0, wins: 0, losses: 0 }, retiredInfo };
  }
  return { rival: { ...rival, age }, record, retiredInfo: null };
}
