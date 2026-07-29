// マイライフのキャリア分岐（メンター就任・移籍先選択・引退勧告・オフシーズン・人生の岐路）の
// 状態遷移（純粋なreducer関数）。Step7第9弾。main.jsxのApp()に生で残っていたクラスタの1つ。
import { TYPES } from "../../data/abilities.js";
import { MONTHS } from "../../data/course.js";
import { CLASSES } from "../../data/progression.js";
import { MANAGER_DIRECTIVES } from "../../data/directives.js";
import { mulberry, overall, pickRiderName, ridState, rollAbilities } from "../../core/core.js";
import { mlGenTeammates } from "../../state/state.js";
import { ML_CROSSROADS, ML_OFFSEASON_CHOICES, mlGenDirective, mlRollCrossroads } from "../../logic/support.js";
import { mlGenRace } from "../../domain/mylife/race.js";

// v18: シーズンモードのキャプテン制度に対応するマイライフ側の役割。30歳以降、
// チームの精神的支柱（メンター）になることを選べる。一度なると解除はできない
export function mlBecomeMentor(s) {
  if (s.protege) return s;
  // v35(逆メンター): メンターになると、有望な若手を1人「弟子」に取る。弟子は師（あなた）の
  // 地力に導かれ、年を追うごとに育っていく（protegeState で経過年数から算出）。
  const rng = mulberry(Date.now() % 999983 + 61);
  const types = ["SPR", "CLM", "RUL", "PUN", "TT"];
  const type = types[Math.floor(rng() * types.length)];
  const growthPow = rng() < 0.45 ? "S" : "A";
  const name = pickRiderName(rng, new Set([s.player?.name, s.rival?.name, s.rival2?.name].filter(Boolean)));
  const age0 = 17 + Math.floor(rng() * 3);
  const ovr0 = 46 + Math.floor(rng() * 10);
  const protege = { id: ridState.value++, name, type, age0, ovr0, growthPow, joinYear: s.year, mentorOvr: overall(s.player), bond: 20, guideBonus: 0, ovrBonus: 0, abilities: rollAbilities(rng), personality: "normal" };
  return {
    ...s, flags: { ...s.flags, mentor: true }, protege,
    log: [...s.log,
      `【${s.year}年目 ${MONTHS[s.month]}】チームの精神的支柱としてメンター役を引き受けた`,
      `【${s.year}年目 ${MONTHS[s.month]}】将来有望な若手 ${name}（${age0}歳・${TYPES[type].label}／成長力${growthPow}）を弟子に取り、指導を始めた`,
    ],
  };
}

// v15: 選んだオファーの条件（年俸倍率・契約金・エース確約）を実際に反映して契約を結ぶ
// v16: 移籍先チームのtierがそのままプレイヤーの新classIdxになる（機材解放条件に直結）。
// classIdxが変わる場合はそのtierに合わせてrace/directiveも生成し直す
export function mlChooseTeam(s, offer) {
  const salary = Math.round(s.salary * offer.salaryMul);
  const money = s.money + offer.bonus;
  const classIdx = offer.tier != null ? offer.tier : s.classIdx;
  const classChanged = classIdx !== s.classIdx;
  const races = classChanged ? [mlGenRace(s.year, s.month, classIdx)] : s.races;
  const managerEval = s.managerEval;
  const directive = offer.aceGuarantee
    ? MANAGER_DIRECTIVES.ace
    : (classChanged ? mlGenDirective(s.year, s.month, classIdx, managerEval) : s.directive);
  let log = offer.bonus > 0 || offer.salaryMul > 1
    ? [...s.log, `【${s.year}年目 4月】${offer.team}と契約（年俸${salary}万円${offer.bonus > 0 ? `／契約金+${offer.bonus}万円` : ""}）`]
    : [...s.log];
  if (classChanged) {
    log = [...log, classIdx > s.classIdx
      ? `${offer.team}への移籍に伴い${CLASSES[classIdx].label}に昇格した！`
      : `${offer.team}への移籍に伴い${CLASSES[classIdx].label}に降格となった`];
  }
  // v32: 移籍で所属が変わったら固定チームメイトも新チームの顔ぶれに一新する
  const newTeammates = offer.team !== s.team
    ? mlGenTeammates(mulberry(Date.now() % 999983 + s.year * 13), offer.team, 5, [s.player.name, s.rival?.name, s.rival2?.name].filter(Boolean), s.year)
    : s.teammates;
  return { ...s, team: offer.team, classIdx, races, directive, salary, money, teammates: newTeammates, contractOffers: null, biddingWar: false, screen: "mylife_main", log };
}

// v28: 引退勧告への応答。pendingAdviceに次年度以降の続行state（オフシーズン画面）が
// 既に格納済みなので、選択に応じてそこへ進む／役割縮小フラグを注入する／引退する
export function mlRetireAdviceContinue(s) {
  return { ...s.pendingAdvice, pendingAdvice: null, adviceInfo: null,
    log: [...(s.pendingAdvice.log || s.log), `【${s.year}年目 3月】引退勧告を退け、現役続行を選んだ`] };
}

export function mlRetireAdviceReduceRole(s) {
  const cont = s.pendingAdvice;
  const po = cont.pendingOffseason;
  // 次年度以降の状態へreducedRoleフラグを立てる（レース負荷が軽くなり現役を延命できる）
  const nextPO = { ...po, flags: { ...po.flags, reducedRole: true } };
  return { ...cont, pendingOffseason: nextPO, pendingAdvice: null, adviceInfo: null,
    flags: { ...s.flags, reducedRole: true },
    log: [...(cont.log || s.log), `【${s.year}年目 3月】役割を縮小してもう一年。レース負荷を抑えて現役を続ける`] };
}

// v41(§Step7第3弾): mlRecordLegend（殿堂記録）はここで呼ばず、mlLastRaceFinishと同じく
// "mylife_retired"画面への遷移を検知するuseEffect（mlClearAwardedRef）に一本化した。
export function mlRetireAdviceAccept(s) {
  const retiredState = { ...s, pendingAdvice: null, adviceInfo: null };
  return { ...retiredState, screen: "mylife_retired",
    log: [...s.log, `【${s.year}年目 3月】チームの勧告を受け入れ、${s.player.age}歳で現役を退いた`] };
}

// v17: オフシーズンの過ごし方を確定する。年度末処理はpendingOffseasonに既に計算済みなので、
// 選んだ効果をそこへ重ねてから結果画面へ進む
export function mlResolveOffseason(s, choiceIdx) {
  const po = s.pendingOffseason;
  if (!po) return s;
  const choice = ML_OFFSEASON_CHOICES[choiceIdx];
  const player = choice.apply(po.player, po.year);
  return {
    ...s,
    pendingOffseason: { ...po, player },
    offseasonResultText: choice.result,
    screen: "mylife_offseason_result",
  };
}

// オフシーズンの選択を終えたあとに、人生の岐路イベントの判定へ続ける（発生すればそちらへ、
// なければそのままpendingOffseasonが持っていた本来の遷移先へ進む）
export function mlContinueAfterOffseason(s) {
  const po = s.pendingOffseason;
  if (!po) return s;
  // v25: 恩師卒業の判定は「年が明けたあと」の年数を見る必要があるため、
  // 更新前のsではなく年度更新済みのpo（年度末処理の計算結果）を渡す
  const cr = mlRollCrossroads(po, po.player);
  if (cr) return { ...s, pendingOffseason: null, offseasonResultText: null, screen: "mylife_crossroads", pendingCrossroads: { key: cr.key, resolvedState: po } };
  return { ...po, pendingOffseason: null, offseasonResultText: null };
}

// v15: 人生の岐路イベントの選択を確定する。年度末処理はpendingCrossroads.resolvedStateに
// 既に計算済みなので、選んだ効果をそこへ重ねてから結果画面へ進む（時間は二重に進めない）
export function mlResolveCrossroads(s, choiceIdx) {
  const pc = s.pendingCrossroads;
  if (!pc) return s;
  const cr = ML_CROSSROADS[pc.key];
  const choice = cr.choices[choiceIdx];
  const prevPlayer = pc.resolvedState.player;
  const { player, flags } = choice.apply(prevPlayer, s.flags || {});
  const note = choice.resultNote ? choice.resultNote(player, prevPlayer) : "";
  return {
    ...s,
    pendingCrossroads: { ...pc, resolvedState: { ...pc.resolvedState, player, flags } },
    crossroadsResultText: note ? `${choice.result}\n\n${note}` : choice.result,
    screen: "mylife_crossroads_result",
  };
}

export function mlContinueAfterCrossroads(s) {
  const pc = s.pendingCrossroads;
  if (!pc) return s;
  return { ...pc.resolvedState, pendingCrossroads: null, crossroadsResultText: null };
}
