// マイライフの月次アクション・年度末処理の状態遷移（純粋なreducer関数）。Step7第3弾。
// v41(§Step7第3弾): 非冪等なlocalStorage書き込み（advanceWorldYear）はここで呼ばない。
// ml.yearの変化を検知したApp()側のuseEffectが1回だけ実行する（詳細はDEVLOG §9参照）。
import { ABILITIES, AB_KEYS, AB_LABEL, POW } from "../../data/abilities.js";
import { CLASSES } from "../../data/progression.js";
import { MONTHS, SEG_AB } from "../../data/course.js";
import { ML_CARS, ML_HOUSES } from "../../data/gear.js";
import { PARTS } from "../../data/parts.js";
import { badgeTier, mulberry, overall, hasAbility, tierValue } from "../../core/core.js";
import { MYLIFE_TEAMS, ageWorldRosters, mlTeammatesFromRoster } from "../../state/state.js";
import {
  GRADE_MUL, ML_AB_COACH_KEY, ML_COACH_MUL, ML_COACH_SALARY, ML_PROTEGE_EVENTS, ML_SPECIAL_TRAINING, addAb, ageRival, computeWorldRank,
  decayRiderStatsWp, growSub, growthPhase, mlBuildWorldNews, mlGenDirective, mlGrowthCapFor, mlLivingCost, mlTeamTier,
  mlUpdateRiderStats, mlWorldRaceLite, persMul, pickMlEvent, protegeMilestoneNews, rollCondDir, upgradeGoldAbilities,
} from "../../logic/support.js";
import { mlGenRace, mlGenRaceCandidates } from "../../domain/mylife/race.js";
import { loadMlLegends } from "../../breeding/breeding.js";
import { pruneBonds } from "../../domain/mylife/bonds.js";

// v14.2: 月次アクションを「レース／練習」の2択から拡張。練習・休養・イベントで
// 選手への効果を出し分ける（順位・ポイント・賞金は既にmlRaceFinish側で反映済みのため
// ここでは疲労・出走経験による能力成長を扱う）。
// v14.3: 永続トレーニング用品（ローラー台・パワーメーター）と車（レース疲労軽減）の
// 恒常効果もここで反映する
// v47(第7弾B): 加齢による衰えの縮小係数。シーズン側のdec(最大1.2/月)はマイライフには急峻すぎる
// ため、マイライフでは緩やかな衰え（目安 年-3）になるよう縮める（詳細はDEVLOG §38参照）
const ML_AGE_DECLINE_MUL = 0.2;

export function mlApplyMonthEffect(player0, mode, ctx) {
  const player = { ...player0 };
  // v38(#9 B-2): 活力（バイタリティ）。疲労が短期の"その月の重さ"なのに対し、活力は長期の
  // "伸びしろの芯・鮮度"。走り込むほど（特に格上レース）少しずつ減り、完全休養やオフで回復する。
  // 活力が高いほど成長が満額に近く、低いと伸びが鈍る＝「休ませて育てる」戦略性が生まれる。
  if (player.vitality == null) player.vitality = 100;
  const vitMul = 0.55 + 0.45 * Math.min(1, Math.max(0, player.vitality) / 70); // 活力70+で満額、低いほど鈍化
  // v47(第7弾B): 疲労が高いまま練習・合宿を続けると、その月の伸びが鈍る（fatigue<=50は無影響、
  // 100で最大60%減）。合宿ローテを回し続けて疲労を溜めたままにする戦略への機会費用を作る
  // （詳細はDEVLOG §38参照）
  const fatMul = Math.max(0.4, 1 - Math.max(0, (player.fatigue || 0) - 50) * 0.012);
  const gear = (ctx && ctx.gear) || {};
  const coaches = (ctx && ctx.coaches) || {};
  const carLv = ctx ? ctx.carLv : -1;
  const houseLv = ctx ? ctx.houseLv : -1;
  const flags = (ctx && ctx.flags) || {};
  // 第36弾: 専門コーチの段階制。旧セーブのgear[coachKey]（買い切り済み）はLv1相当として
  // 引き継ぐ（100万を払い済みのため遡って課金しない）。効果は倍率テーブルから引く。
  const coachLv = (k) => Math.max(gear[ML_AB_COACH_KEY[k]] ? 1 : 0, coaches[k] || 0);
  const coachMul = (k) => ML_COACH_MUL[coachLv(k)];
  // v43(マイライフ難易度調整Phase 1・柱1): 難易度による成長上限の調整は、mlGrowthCap内部の
  // 実績ボーナス×難易度倍率（easy1.3〜oni0.5）に一本化した（旧diffCapAdjの一律加減算は廃止）。
  // ctx.mlStateはmlAdvanceMonth側で渡す実績連動計算用のml状態スナップショット。
  // 第29弾(判断③): 成長上限は能力別（脚質×能力のオフセット付き）。詳細はgrowthCap.js参照。
  const capFor = (k) => mlGrowthCapFor(ctx && ctx.year, player, ctx && ctx.mlState, k);
  // v35(バランス): マイライフには選手本人の故障システムが無く、「ガラスの体」（危険度＝濃い配合の代償）が
  // 完全に無効化されていた（＝インブリードがノーリスクで爆発力を得られる抜け穴）。故障システムを新設せず、
  // 脆い体を「疲労が溜まりやすく抜けにくい」形で表現し、健康管理（休養の頻度）に実コストを課す。
  const glassBody = hasAbility(player, "glass");
  if (mode === "race") {
    const carCut = carLv >= 0 ? (1 - ML_CARS[carLv].raceFatigueCut) : 1;
    const chefCut = gear.chef ? 0.9 : 1;
    // v15: 「鉄人」を持つ選手は出走疲労が軽減される（シーズンモードの45→32と同じ比率）
    const ironCut = hasAbility(player, "iron") ? 32 / 45 : 1;
    // v35: ガラスの体は逆に出走疲労が増える（脆く、消耗しやすい）
    const glassMul = glassBody ? 1.35 : 1;
    // v25: 天候の悪化。猛暑は出走後の疲労蓄積を増やす
    const raceWeather = ctx && ctx.raceWeather;
    // 第17弾: 冷感ボトルセット（栄養スロット）は猛暑の疲労加算をキャンセルする
    const nuPid = player.parts && player.parts.nutrition;
    const nuPart = nuPid && PARTS[nuPid];
    const heatCancelled = raceWeather === "heat" && nuPart && nuPart.heat && nuPart.heat.fatigueCancel;
    const heatMul = (raceWeather === "heat" && !heatCancelled) ? 1.15 : 1;
    // v28: 役割を縮小して現役続行を選んだベテランは、レース負荷が軽くなり疲労蓄積が減る
    const roleCut = flags.reducedRole ? 0.85 : 1;
    player.fatigue = Math.min(100, player.fatigue + 40 * carCut * chefCut * ironCut * glassMul * heatMul * roleCut);
    player.streak = (player.streak || 0) + 1;
    // v25: シーズンモード同様、出走した種目に応じた能力成長（出走経験）を追加。
    // 格上のレース（グレードが高い）ほど得るものが大きい
    const raceExpKeys = (ctx && ctx.raceExpKeys) || [];
    const raceGradeMul = (ctx && ctx.raceGrade) ? (GRADE_MUL[ctx.raceGrade] || 1) : 1;
    // v25: 新人時代に恩師の指導を受けている間は、出走経験の伸びにもボーナスがかかる
    // v28: 「天才肌」は25歳以下の伸びが+15%
    // 第45弾: 吸収の天才は元々2段階の効果差が無かった（銅も金も一律+25%）。金の値が
    // 存在しなかったため、他の消耗軽減系（鉄の心肺93→88等）と同程度の上げ幅で暫定的に
    // 金1.35を置き、銀・虹はtierValueの式でそこから機械的に算出した（要バランス見直し）。
    const spongeMul = hasAbility(player, "sponge") ? tierValue(1.25, 1.35, badgeTier(player, "sponge")) : 1;
    const mentorMul = (flags.mentorActive ? 1.15 : 1) * (hasAbility(player, "genius_sp") && player.age <= 25 ? 1.15 : 1)
      * spongeMul // v37: 吸収の天才＝出走経験の伸び+25%（第45弾で4段階化）
      * vitMul; // v38(#9 B-2): 活力が低いと出走経験の伸びも鈍る
    const ph = growthPhase(player);
    raceExpKeys.forEach(k => addAb(player, k, 1.0 * raceGradeMul * mentorMul * Math.max(0.2, ph.gain) * POW[player.growthPow].mul * persMul(player, k), capFor(k)));
    // v38(#9 B-2): レースで活力を消耗（格上ほど大きい）。走らせすぎると伸びの芯が細る
    player.vitality = Math.max(0, player.vitality - (5 + (ctx && ctx.raceGrade ? ctx.raceGrade : 1) * 2));
    // v29: メンタルは「大舞台の経験」で育つ。格上のレースほど大きく伸びる
    growSub(player, "mental", 0.35 * raceGradeMul * Math.max(0.25, ph.gain));
    // v25: 雨天レースは悪天候巧者を持たない選手に落車リスク（疲労急増＋わずかな能力の目減り）を上乗せする
    // 第17弾: 雨天用タイヤ（タイヤスロット）は落車率を半減させる
    const tiPid = player.parts && player.parts.tire;
    const tiPart = tiPid && PARTS[tiPid];
    const rainCrashHalf = tiPart && tiPart.rain && tiPart.rain.crashHalf;
    const rainCrashChance = (hasAbility(player, "rain_sp") ? 0.02 : 0.06) * (rainCrashHalf ? 0.5 : 1);
    if (raceWeather === "rain" && Math.random() < rainCrashChance) {
      player.fatigue = Math.min(100, player.fatigue + 15);
      AB_KEYS.forEach(k => { player[k] = Math.max(20, player[k] - 2); });
      player.__weatherCrash = true;
    }
  } else if (mode === "train") {
    const ph = growthPhase(player);
    // v15: 「練習の虫」「練習嫌い」「遅咲き」の特殊能力を練習効果に反映
    // v17: 育児をパートナーに任せて競技優先を選んだ場合、練習効果がわずかに上乗せされる
    const abMul = (hasAbility(player, "trainer") ? 1.2 : hasAbility(player, "lazy_sp") ? 0.8 : 1)
      * (hasAbility(player, "lateblow_sp") && player.age >= 28 ? 1.15 : 1)
      // v28: 「天才肌」は25歳以下の練習効果+15%（遅咲きの逆で若手向け）
      * (hasAbility(player, "genius_sp") && player.age <= 25 ? 1.15 : 1)
      * (flags.childFocusedCareer ? 1.05 : 1)
      // v25: 新人時代に恩師の指導を受けている間は練習効果+15%
      * (flags.mentorActive ? 1.15 : 1)
      * vitMul // v38(#9 B-2): 活力が低いと練習効果も鈍る
      * fatMul; // v47(第7弾B): 疲労が高いと練習効果も鈍る
    const gain = 1.5 * ph.gain * POW[player.growthPow].mul * (gear.roller ? 1.15 : 1) * abMul;
    const focusMul = gear.monitor ? 1.10 : 1;
    addAb(player, player.focus, gain * 0.9 * persMul(player, player.focus) * focusMul * coachMul(player.focus), capFor(player.focus));
    AB_KEYS.filter(k => k !== player.focus).forEach(k => addAb(player, k, gain * 0.14 * persMul(player, k) * coachMul(k), capFor(k)));
    // v29: 通常練習でも加速力・メンタルがわずかに伸びる（focusがsprint/flatなら加速に厚め）
    const subG = 0.28 * ph.gain * POW[player.growthPow].mul;
    growSub(player, "accel", subG * (player.focus === "sprint" || player.focus === "flat" ? 1.3 : 0.7));
    growSub(player, "mental", subG * 0.6);
    // v47(第7弾B-2): 従来は練習が疲労を-15していた＝練習が休養を兼ね、休む理由が無かった。
    // 練習は疲労を増やす側に回し、休養との使い分け（機会費用）を作る（詳細はDEVLOG §38参照）
    player.fatigue = Math.min(100, player.fatigue + 10 * (glassBody ? 1.3 : 1));
    player.vitality = Math.max(0, player.vitality - 3); // v38(#9 B-2): 練習でも活力を少し使う
    player.streak = 0;
  } else if (mode === "rest") {
    // v35: ガラスの体は回復も鈍い（休んでも抜けきらない＝より頻繁な休養を強いる）
    player.fatigue = Math.max(0, player.fatigue - 35 * (glassBody ? 0.78 : 1));
    // v36(#8): 完全休養を「疲労を抜くだけ」から意味のある回復へ。休むと心も整い（メンタル微増）、
    // フォームに上向きの偏り（フレッシュな脚＝後段のフォーム計算でrest分岐が下振れを消す）が付く。
    growSub(player, "mental", 0.5);
    player.vitality = Math.min(100, player.vitality + 22); // v38(#9 B-2): 完全休養で活力を大きく回復
    player.streak = 0;
  } else if (mode === "event") {
    player.fatigue = Math.max(0, player.fatigue - 5);
  } else if (mode === "peak") {
    // v29: ピーキング。レースに向けたコンディション調整。フォームを高め疲労も少し抜ける
    // （能力の成長は無く、あくまで「仕上げ」）
    player.fatigue = Math.max(0, player.fatigue - 12);
    player.streak = 0;
  } else if (ML_SPECIAL_TRAINING[mode]) {
    // v28: 専門トレーニング。対象2能力を強めに伸ばし、疲労を大きく消費する。
    // メンタル強化（対象能力なし）は全能力をわずかに底上げしつつ調子を整える枠
    const spec = ML_SPECIAL_TRAINING[mode];
    const ph = growthPhase(player);
    const abMul = (hasAbility(player, "trainer") ? 1.2 : hasAbility(player, "lazy_sp") ? 0.8 : 1)
      * (flags.mentorActive ? 1.15 : 1);
    // v47(第7弾B): 疲労が高いと専門トレの伸びも鈍る（合宿ローテを回し続ける戦略への機会費用）
    const base = 1.5 * ph.gain * POW[player.growthPow].mul * (gear.roller ? 1.15 : 1) * abMul * spec.gainMul * fatMul;
    if (spec.keys.length > 0) {
      spec.keys.forEach(k => addAb(player, k, base * 0.65 * persMul(player, k) * coachMul(k), capFor(k)));
      AB_KEYS.filter(k => !spec.keys.includes(k)).forEach(k => addAb(player, k, base * 0.08 * persMul(player, k) * coachMul(k), capFor(k)));
    } else {
      AB_KEYS.forEach(k => addAb(player, k, base * 0.18 * persMul(player, k) * coachMul(k), capFor(k)));
    }
    // v29: 専門トレの副ステータス育成。スプリント特訓＝加速力、メンタル強化＝メンタルを重点的に鍛える
    const subBase = ph.gain * POW[player.growthPow].mul;
    if (mode === "sprintcamp") growSub(player, "accel", 1.6 * subBase);
    if (mode === "mental") growSub(player, "mental", 1.8 * subBase);
    player.fatigue = Math.min(100, player.fatigue + spec.fatigue);
    if (spec.cond) player.form = Math.min(100, (player.form ?? 50) + spec.cond * 8); // v31.3: 調子→フォームに統合
    player.streak = 0;
  }
  // v47(第7弾A): 加齢による衰えは、旧実装ではtrain/専門トレの分岐の中にしか無く「練習した月だけ
  // 衰える」というバグになっていた（真面目に練習し続けると全能力が下限まで崩壊し、練習をやめると
  // 一切衰えない逆転現象）。シーズン側と同じくmode非依存で毎月必ず適用する
  // （詳細はDEVLOG §38参照）
  const declinePh = growthPhase(player);
  if (declinePh.dec > 0) {
    const mlDec = declinePh.dec * ML_AGE_DECLINE_MUL;
    AB_KEYS.forEach(k => { player[k] = Math.max(20, player[k] - mlDec); });
  }
  if (houseLv >= 0) player.fatigue = Math.max(0, player.fatigue - ML_HOUSES[houseLv].fatigueBonus);
  // v15: 「回復力」を持つ選手は毎月さらに疲労-15（シーズンモードと同じ効果）
  if (hasAbility(player, "recover")) player.fatigue = Math.max(0, player.fatigue - 15);
  if (hasAbility(player, "recover2")) player.fatigue = Math.max(0, player.fatigue - 25); // v37(第2弾): 超回復
  // v15: 人生の岐路イベントで得た恒常効果（結婚による生活の安定／無理な怪我復帰の後遺症）
  if (flags.married) player.fatigue = Math.max(0, player.fatigue - 4);
  if (flags.rushedInjuryComeback) player.fatigue = Math.min(100, player.fatigue + 3);
  // v17: 育児に積極的に関わる道を選んだ場合、家庭のサポートでさらに疲労が抜けやすくなる
  if (flags.hasChild && !flags.childFocusedCareer) player.fatigue = Math.max(0, player.fatigue - 3);
  // v18: 若手のメンターになると、後進を気にかける充実感から疲労がわずかに抜けやすくなる
  if (flags.mentor) player.fatigue = Math.max(0, player.fatigue - 3);
  // v31.3: 「調子(cond)」と「フォーム(form)」は、どちらも当日の能力を上下させる二重の指標で
  // 分かりづらいという指摘を受け、マイライフではフォーム(0-100)に一本化した。調子は中立(3)に
  // 固定して能力への二重補正を止め、月々の好不調の波・予報・ピーキングをすべてフォームに集約する。
  player.cond = 3;
  const mentalSteady = Math.max(0.6, Math.min(1.4, 1 - ((player.mental ?? 50) - 50) / 250));
  // v43(マイライフ難易度調整Phase 1・判断19a): 新ステータス「安定感」で変動幅を追加で狭める。
  // stability=50（既定・旧セーブ互換）のとき倍率1で従来と完全一致する。
  const stabilitySteady = Math.max(0.5, Math.min(1.3, 1 - ((player.stability ?? 50) - 50) / 150));
  // 毎月の波の大きさ（moodyは激しく、精密機械/steady_spは小さく、メンタルが高いほど安定）
  const swingMag = (hasAbility(player, "moody") ? 10 : hasAbility(player, "steady_sp") ? 3 : 6) * mentalSteady * stabilitySteady;
  const dir = (player.formForecast != null) ? player.formForecast : rollCondDir();
  const curForm = player.form ?? 50;
  // ピーキング調整の月はフォームが大きく上がる。それ以外は基準値(48)へ戻りつつ月々の波が乗る
  // ＝ピークは維持し続けられず、大レースに合わせて仕上げる駆け引きになる
  const nextForm = mode === "peak"
    ? curForm + 24
    // v36(#8): 完全休養はフレッシュな脚。基準を少し上（52）に引き上げ、月々の下振れを消して
    // 小さな上げ底（+4）を付ける＝大レース前に「休んで整える」戦術的価値を持たせる。
    : mode === "rest"
      ? curForm + (52 - curForm) * 0.35 + Math.abs(dir) * swingMag * 0.5 + 4
      : curForm + (48 - curForm) * 0.30 + dir * swingMag;
  player.form = Math.max(0, Math.min(100, Math.round(nextForm)));
  player.formForecast = rollCondDir(); // 翌月の波の向きを予報
  return player;
}

export function mlAdvanceMonth(s, mode) {
  // 第33弾: 専門トレーニングは「練習メニューで選択→通常の練習で実行」の一回きり。
  // 旧実装は専門トレのボタンを押した瞬間に月が進む（通常練習だけ2段階の）動線非対称だった。
  // どの形で月が進んでも選択は消える＝その月だけで、翌月は元の練習メニューへ自動的に戻る。
  if (mode === "train" && s.plannedSpecial && ML_SPECIAL_TRAINING[s.plannedSpecial]) mode = s.plannedSpecial;
  if (s.plannedSpecial) s = { ...s, plannedSpecial: null };
  // v25: シーズンモードと同様、マイライフでも出走した種目に応じた「出走経験」で能力が伸びるようにする
  // （従来は出走しても疲労とストリークが変化するだけで能力は一切伸びなかった）
  const raceExpKeys = (mode === "race" && s.result && s.result.course)
    ? [...new Set(s.result.course.segs.map(seg => SEG_AB[seg.type]))] : [];
  const raceGrade = (mode === "race" && s.resultInfo) ? s.resultInfo.race.grade : null;
  const raceWeather = (mode === "race" && s.resultInfo) ? s.resultInfo.race.weather : null;
  const ctx = { gear: s.gear, coaches: s.coaches, houseLv: s.houseLv, carLv: s.carLv, flags: s.flags, year: s.year, difficulty: s.difficulty, raceExpKeys, raceGrade, raceWeather, mlState: s };
  // v38(改善:育成の手応え): 月次アクション前の能力・OVR・活力を控えておき、後で「今月の成長」を可視化する
  const _preAb = {}; AB_KEYS.forEach(k => { _preAb[k] = s.player[k] || 0; });
  const _preSub = { accel: s.player.accel || 0, mental: s.player.mental || 0 };
  const _preOvr = overall(s.player);
  const _preVit = s.player.vitality == null ? 100 : s.player.vitality;
  let player = mlApplyMonthEffect(s.player, mode, ctx);
  const log = [...s.log];
  if (ML_SPECIAL_TRAINING[mode]) log.push(`【${s.year}年目 ${MONTHS[s.month]}】${ML_SPECIAL_TRAINING[mode].label}を実施した`);
  if (player.__weatherCrash) {
    log.push(`【${s.year}年目 ${MONTHS[s.month]}】雨天のレースで危うく転倒しかけ、ヒヤッとした…`);
    player = { ...player, __weatherCrash: undefined };
  }
  // v15フェーズ2: 金特化の判定
  const upgradedPlayer = upgradeGoldAbilities(player);
  if (upgradedPlayer !== player) {
    upgradedPlayer.goldAbilities.filter(id => !(player.goldAbilities || []).includes(id))
      .forEach(id => log.push(`【${s.year}年目 ${MONTHS[s.month]}】特殊能力「${ABILITIES[id].label}」が金の特殊能力に覚醒した！`));
    player = upgradedPlayer;
  }
  // 第39弾: v17由来の月15%抽選による自動習得は廃止した。マイライフは条件を満たしたバッジを
  // プレイヤーが選手画面から自分で選んで習得する（mlAcquireAbility）。シーズンは据え置き
  // （acquireNewAbilityは自動習得のままcontrollers/season/month.jsで使用中）。
  // v14.3: 毎月、練習を積んだり生活基盤（一戸建て）が整っていると監督評価がじわじわ上がる。
  // 年俸は毎月1/12ずつ資金として振り込まれる
  const passiveEvalDelta = (mode === "train" ? 0.4 : 0) + (s.houseLv >= 2 ? 0.3 : 0) + (s.houseLv >= 3 ? 0.2 : 0) + (s.flags?.mentor ? 0.3 : 0);
  let managerEval = Math.max(0, Math.min(100, s.managerEval + passiveEvalDelta));
  // v25: 個人スポンサー収入。人気度10ごとに月+2万円の継続収入が入る（チーム年俸とは別枠）
  const popIncome = Math.floor((s.player.popularity || 0) / 10) * 2;
  // v27: 生活費・税負担。年俸が上がるほど生活水準・税負担も増し、手元に残る額は
  // 頭打ちになる。高級車・住居のグレードにも維持費がかかる。これによりキャリア後半に
  // 資金がダブついて緊張感が失われる（＝ヌルゲー化）のを抑える
  // 第36弾: 従来はMath.max(0,...)でクランプしており不足分が黙って帳消しになっていた
  // （v27の狙いを打ち消していた）。クランプを外し、赤字は段階的なペナルティで扱う。
  const livingCost = mlLivingCost(s);
  let money = s.money + Math.round(s.salary / 12) + popIncome - livingCost;
  const debtMonths = money < 0 ? (s.debtMonths || 0) + 1 : 0;
  let carLv = s.carLv, houseLv = s.houseLv, coaches = s.coaches || {};
  if (debtMonths >= 2) {
    player.form = Math.max(0, (player.form ?? 50) - 6);
  }
  if (debtMonths >= 4) {
    // 段階3: 維持費が最も高いものを毎月1つ手放す（同額なら車→コーチ→家の優先順）。
    // 赤字の原因そのものを削るため、放置しても自動的に維持費が下がりデススパイラルにならない。
    const candidates = [];
    if (carLv >= 0) candidates.push({ type: "car", cost: (carLv + 1) * 4, order: 0 });
    if (houseLv >= 0) candidates.push({ type: "house", cost: (houseLv + 1) * 4, order: 2 });
    Object.entries(coaches).forEach(([k, lv]) => { if (lv > 0) candidates.push({ type: "coach", key: k, cost: ML_COACH_SALARY[lv] || 0, order: 1 }); });
    candidates.sort((a, b) => b.cost - a.cost || a.order - b.order);
    if (candidates.length) {
      const pick = candidates[0];
      if (pick.type === "car") {
        const refund = Math.round(ML_CARS[carLv].price * 0.5);
        log.push(`【${s.year}年目 ${MONTHS[s.month]}】維持できなくなり${ML_CARS[carLv].label}を手放した（+${refund}万円）`);
        carLv -= 1; money += refund;
      } else if (pick.type === "house") {
        const refund = Math.round(ML_HOUSES[houseLv].price * 0.5);
        log.push(`【${s.year}年目 ${MONTHS[s.month]}】維持できなくなり${ML_HOUSES[houseLv].label}を手放した（+${refund}万円）`);
        houseLv -= 1; money += refund;
      } else {
        log.push(`【${s.year}年目 ${MONTHS[s.month]}】維持できなくなり${AB_LABEL[pick.key]}コーチを手放した`);
        coaches = { ...coaches, [pick.key]: coaches[pick.key] - 1 };
      }
    } else {
      log.push(`【${s.year}年目 ${MONTHS[s.month]}】赤字が続いているが、これ以上手放せるものが無い`);
    }
  }
  if (debtMonths >= 2) {
    managerEval = Math.max(0, Math.min(100, managerEval - 1.5));
    log.push(`【${s.year}年目 ${MONTHS[s.month]}】赤字が${debtMonths}か月続き、生活が荒れている（フォーム-6・監督評価-1.5）`);
  } else if (debtMonths === 1) {
    log.push(`【${s.year}年目 ${MONTHS[s.month]}】今月は支出が収入を上回った。所持金がマイナスの間は買い物ができない`);
  }
  if (s.month === 11) {
    player.age += 1;
    // v38(#9 B-2): オフシーズンで活力が回復（走り込んだ体もひと冬でリフレッシュ）。若いほど戻りが良い。
    player.vitality = Math.min(100, (player.vitality == null ? 100 : player.vitality) + (player.age <= 27 ? 40 : player.age <= 32 ? 30 : 20));
    // v38: ワールド選手の世代交代。年度替わりに全チームの選手を1歳加齢させ、
    // ピーク前は成長・ピーク後は衰えを反映。高齢者は引退して新人ルーキーに置き換わる。
    // これで「同じ顔ぶれが永遠に同じ強さ」ではなく、若手台頭とベテラン引退の流れが生まれる。
    const agerng = mulberry(((s.year + 1) * 2246822519) >>> 0);
    const aged = ageWorldRosters(s.worldRosters, agerng, s.year + 1, MYLIFE_TEAMS, loadMlLegends());
    // 第18弾D: 絆の高い僚友は練習の質が上がり、実際の成長（baseline）が良くなる。
    // ageWorldRosters自体は無改修（シーズンに影響しない）で、その戻り値の自チームのみに
    // 後処理として適用する（第16弾のageRivalと同じ手筋）。クランプ14はageWorldRosters内部の
    // 上限と同値（自チームだけ上限を超えないため）。ログは出さない（§7の抑制。効果は
    // 名鑑の成長と結束の数字で見える）。
    if (aged.worldRosters[s.team]) {
      aged.worldRosters[s.team] = aged.worldRosters[s.team]
        .map(r => {
          const bond = (s.bonds || {})[r.id] || 0;
          const boost = bond >= 85 ? 2 : bond >= 60 ? 1 : 0;
          return boost ? { ...r, baseline: Math.min(14, (r.baseline || 0) + boost) } : r;
        })
        .sort((a, b) => (b.baseline || 0) - (a.baseline || 0));
    }
    // v41(§Step7第3弾): advanceWorldYear()（非冪等なlocalStorage書き込み）はここで呼ばず、
    // s.yearの変化を検知したApp()側のuseEffectに一本化した（詳細はDEVLOG §9参照）。
    // 自チームの引退は下のチームメイト専用ログで個別に出すため、ここでは他チーム分だけに絞る
    // （同じ引退が「世代交代」枠と「チームメイト」枠の二重表示になるのを防ぐ）。
    aged.retired.filter(r => r.team !== s.team).slice(0, 3).forEach(r => {
      const debut = aged.debuted.find(d => d.team === r.team);
      log.push(`【${s.year}年目 3月】🌍 世代交代：${r.team}の${r.name}（${r.age}歳）が引退。${debut ? `新星${debut.name}（${debut.age}歳）が加入した` : "後継者の台頭が待たれる"}`);
    });
    // v49(第11弾続き): 固定チームメイトも実在ロースター（worldRosters[所属チーム]）から
    // 取っているため、上のageWorldRosters()による加齢・成長衰え・引退・新人補充が
    // 自チームにもそのまま反映される。ここで取り直して次年度の教チームメイトへ反映し、
    // 自チームで実際に入れ替わりがあれば専用のログも出す（背景で起きても気づけないと
    // 「本当に効いているのか」分からないため）。
    const nextTeammates = mlTeammatesFromRoster(aged.worldRosters, s.team);
    const myRetired = aged.retired.filter(r => r.team === s.team);
    if (myRetired.length) {
      log.push(`【${s.year}年目 3月】チームメイトの${myRetired.map(r => `${r.name}（${r.age}歳）`).join("・")}が引退した`);
    }
    const freshFaces = nextTeammates.filter(tm => !(s.teammates || []).some(prev => prev.id === tm.id));
    if (freshFaces.length && s.teammates && s.teammates.length) {
      log.push(`【${s.year}年目 3月】新加入の${freshFaces.map(tm => tm.name).join("・")}がチームに合流した`);
    }
    // 第18弾B: 現メンバー（次年度のチームメイト）以外の絆を刈り取る（引退・入れ替わりで自然に消える）。
    // 弟子はprotege.bond（既存の指導で育つ絆）に一本化しており、ml.bondsには入らないため対象外。
    const nextBonds = pruneBonds(s.bonds, nextTeammates.map(tm => tm.id));
    // 第16弾A: ライバル（好敵手）も世界の選手と同じルールで加齢・引退する。引退時は
    // 若い後継のライバルが台頭する（対戦成績はリセット＝因縁は一から）。2人のライバルの
    // rng streamは互いに独立させ、後継の名前は「もう一方の現在のライバル」と重複しないようにする。
    const rival1Rng = mulberry(((s.year + 1) * 3266489917) >>> 0);
    const rival1Res = ageRival(s.rival, s.rivalRecord, rival1Rng, s.year + 1, player.name, s.team,
      s.rival2 ? [s.rival2.name] : [], s.rival2 ? [s.rival2.team] : []);
    const rival2Rng = mulberry(((s.year + 1) * 4106556331) >>> 0);
    const rival2Res = ageRival(s.rival2, s.rivalRecord2, rival2Rng, s.year + 1, player.name, s.team,
      [rival1Res.rival?.name].filter(Boolean), [rival1Res.rival?.team].filter(Boolean));
    const nextRetiredRivals = [...(s.retiredRivals || [])];
    if (rival1Res.retiredInfo) {
      nextRetiredRivals.push(rival1Res.retiredInfo);
      log.push(`【${s.year}年目 3月】🏁 好敵手・${rival1Res.retiredInfo.name}（${rival1Res.retiredInfo.age}歳）が現役を退いた。通算${rival1Res.retiredInfo.record.meetings}回対戦し${rival1Res.retiredInfo.record.wins}勝${rival1Res.retiredInfo.record.losses}敗の記憶を残して。${rival1Res.rival.team}の${rival1Res.rival.name}（${rival1Res.rival.age}歳）が、次代の好敵手として名乗りを上げた`);
    }
    if (rival2Res.retiredInfo) {
      nextRetiredRivals.push(rival2Res.retiredInfo);
      log.push(`【${s.year}年目 3月】🏁 好敵手・${rival2Res.retiredInfo.name}（${rival2Res.retiredInfo.age}歳）が現役を退いた。通算${rival2Res.retiredInfo.record.meetings}回対戦し${rival2Res.retiredInfo.record.wins}勝${rival2Res.retiredInfo.record.losses}敗の記憶を残して`);
    }
    // v36(弟子深化): 弟子がこの年度替わりでOVRの節目(70/80/90)を越えたら祝いのニュースを記録
    if (s.protege) {
      const news = protegeMilestoneNews(s.protege, s.year, s.year + 1);
      if (news) log.push(`【${s.year}年目 3月】${news}`);
    }
    // v35: 強制引退を廃止。何の前触れもなく引退させられる不満を解消し、ベテランは毎年3月の
    // 契約更改で「現役続行／役割縮小／引退」を必ず自分で選べる。衰え期で戦力が落ちていれば
    // 「引退勧告」トーン、まだ戦えるなら「契約更改」トーンで提示する（判定はadviceInfo.declining）。
    const phase = growthPhase(player).tag;
    const declining = phase === "衰え期" && overall(player) < player.joinOvr;
    const retireChoice = player.age >= 33 || (player.age >= 31 && declining);
    // v17: 引退以外でキャリアが続く年は、必ずオフシーズンの過ごし方を選ばせる。
    // 人生の岐路イベントの判定はオフシーズンの選択を終えたあと（mlContinueAfterOffseason）で行う
    const finalizeYearEnd = (nextState) => {
      // v30: 世界ランキングの持ち点は年ごとに一部減衰し、翌年の（強くなった）基準で
      // 順位を引き直す。休むと順位が落ちるため、上位維持には走り続ける必要がある
      const decayedWP = Math.round((s.worldPoints || 0) * 0.72);
      // v51(第11弾Phase2・2-B/2-C): riderStats側のwpも同じ0.72で一律減衰させ、
      // 実データに対する実順位を引き直す（旧computeWorldRank(points,year)は自分の持ち点
      // だけで決まる張りぼてだった。devlog/wave11.md Phase2参照）。
      const decayedRiderStats = decayRiderStatsWp(s.riderStats, 0.72);
      const worldRank = computeWorldRank(decayedRiderStats, decayedWP);
      // v51(第11弾Phase2・2-D): 世界ニュースをこの年度末に1回だけ生成して保存する
      // （mlWorldStarsForYearの「毎回1年目から再計算」に代わり、実際に起きたイベント
      // ＝ageWorldRosters()のretired/debutedをそのまま文章化する）。
      const leaderEntry = Object.values(decayedRiderStats).sort((a, b) => (b.wp || 0) - (a.wp || 0))[0] || null;
      // 第16弾B-1: 王者交代・エース交代・ライバル引退後継・節目の勝利数を加えて最大7行へ拡充
      const rivalRetirements = [
        rival1Res.retiredInfo ? { retiredInfo: rival1Res.retiredInfo, newRival: rival1Res.rival } : null,
        rival2Res.retiredInfo ? { retiredInfo: rival2Res.retiredInfo, newRival: rival2Res.rival } : null,
      ].filter(Boolean);
      const worldNews = mlBuildWorldNews({
        riderStatsById: decayedRiderStats, leaderEntry, retired: aged.retired, debuted: aged.debuted, year: s.year + 1,
        prevWorldRosters: s.worldRosters, nextWorldRosters: aged.worldRosters,
        prevLeaderId: s.worldLeaderId, rivalRetirements,
      });
      // v32（キャリアグラフ）：この年の到達値を年次記録に積む（OVR・世界ランク・通算成績の推移）
      const histEntry = { year: s.year, ovr: overall(player), worldRank: s.worldRank, worldBest: s.worldRankBest, wins: s.careerWins || 0, podiums: s.careerPodiums || 0 };
      nextState = {
        ...nextState, worldPoints: decayedWP, worldRank, riderStats: decayedRiderStats, worldNews,
        worldLeaderId: leaderEntry ? leaderEntry.id : null,
        careerHistory: [...(s.careerHistory || []), histEntry],
      };
      const offseasonState = { ...s, screen: "mylife_offseason", pendingOffseason: nextState, carLv, houseLv, coaches, debtMonths };
      if (retireChoice) {
        return { ...s, screen: "mylife_retire_advice", pendingAdvice: offseasonState, player, money, managerEval, carLv, houseLv, coaches, debtMonths,
          adviceInfo: { age: player.age, ovr: overall(player), joinOvr: player.joinOvr, declining, reducedRole: !!s.flags?.reducedRole }, log };
      }
      return offseasonState;
    };
    const qualified = s.points >= CLASSES[s.classIdx].need;
    // v38: 降格を実装（従来は昇格のみで「クラスの上下」が形骸化していた）。年間ポイントが
    // クラス維持ラインを大きく下回ると1つ降格する（B1は最下位なので降格なし）。これにより
    // 昇格の価値が生まれ、上位クラスで結果を出し続けるプレッシャーが働く。
    const mlRelegateLine = Math.round(CLASSES[s.classIdx].need * 0.4);
    let classIdx = s.classIdx;
    if (qualified) classIdx = Math.min(2, s.classIdx + 1);
    else if (s.classIdx > 0 && s.points < mlRelegateLine) classIdx = s.classIdx - 1;
    if (classIdx > s.classIdx) log.push(`【${s.year}年目 3月】${CLASSES[classIdx].label}に昇格！`);
    else if (classIdx < s.classIdx) log.push(`【${s.year}年目 3月】不振により${CLASSES[classIdx].label}へ降格…雪辱を期す`);
    // 第44弾: バッジ枠は最高到達クラスで決まる。降格しても枠を減らさないためclassIdxBestを更新する
    const classIdxBest = Math.max(s.classIdxBest ?? s.classIdx, classIdx);
    // v14.3: 年俸改定。その年のポイント・勝利・表彰台に応じて年俸が上がる
    const yearRaces = (player.raceLog || []).filter(e => e.year === s.year);
    const yearWins = yearRaces.filter(e => e.rank === 1).length;
    const yearPodiums = yearRaces.filter(e => e.rank <= 3).length;
    const salaryGain = Math.round(s.points * 2.2 + yearWins * 18 + yearPodiums * 7);
    const salary = s.salary + salaryGain;
    if (salaryGain > 0) log.push(`【${s.year}年目 3月】戦績が評価され年俸+${salaryGain}万円（年俸${salary}万円に）`);
    // v14: 好成績を残すと移籍オファーが来る（簡易な移籍システム）
    // v15: オファーはチーム名だけでなく、年俸倍率・契約金・エース確約の有無が
    // チームごとに異なる。残留オファーは条件を上乗せしない基準線として提示し、
    // 移籍オファーはそれより魅力的な条件を出すことで「引き抜き」らしさを出す
    // v16: オファーには移籍先チームのtier（B1/A/PRO）を持たせ、契約するとその
    // tierがそのままプレイヤーの新classIdxになる。一度の移籍で飛び級しすぎない
    // よう、現在のclassIdxから±1tierの範囲のチームだけを候補にする
    const interest = s.points / Math.max(1, CLASSES[s.classIdx].need);
    if (interest >= 0.8 && Math.random() < 0.6) {
      const others = MYLIFE_TEAMS.filter(t => t.name !== s.team);
      const nearTier = others.filter(t => Math.abs(t.tier - classIdx) <= 1);
      const pool = nearTier.length >= 2 ? nearTier : others;
      // v27: 移籍時の争奪戦。昇格ラインを大きく超える好成績（interest>=1.2）を残した年は、
      // 複数チームが競って条件を吊り上げる。オファー数が増え、年俸倍率・契約金・エース確約が
      // 通常より豪華になり、契約画面に「争奪戦」の演出が表示される
      const biddingWar = interest >= 1.2;
      const offerN = biddingWar ? Math.min(3, pool.length) : 2;
      const offerTeams = [...pool].sort(() => Math.random() - 0.5).slice(0, offerN).map(t => ({
        team: t.name,
        tier: t.tier,
        salaryMul: Math.round(((biddingWar ? 1.2 : 1.05) + Math.random() * (biddingWar ? 0.4 : 0.25)) * 100) / 100,
        bonus: Math.round((biddingWar ? 60 : 20) + Math.random() * (biddingWar ? 140 : 80)),
        aceGuarantee: Math.random() < (biddingWar ? 0.7 : 0.4),
      }));
      const stayOffer = { team: s.team, tier: mlTeamTier(s.team), salaryMul: biddingWar ? 1.1 : 1, bonus: biddingWar ? 40 : 0, aceGuarantee: false };
      return finalizeYearEnd({
        ...s, player, classIdx, classIdxBest, points: 0, year: s.year + 1, month: 0,
        races: mlGenRaceCandidates(s.year + 1, 0, classIdx, s.raceFocus, s.raceFocusSlots), sel: { ...s.sel, raceId: null },
        directive: mlGenDirective(s.year + 1, 0, classIdx, managerEval),
        contractOffers: [stayOffer, ...offerTeams], biddingWar,
        salary, money, managerEval, carLv, houseLv, coaches, debtMonths, worldRosters: aged.worldRosters, teammates: nextTeammates, bonds: nextBonds,
        rival: rival1Res.rival, rivalRecord: rival1Res.record, rival2: rival2Res.rival, rivalRecord2: rival2Res.record,
        retiredRivals: nextRetiredRivals,
        screen: "mylife_contract", log,
      });
    }
    return finalizeYearEnd({
      ...s, player, classIdx, classIdxBest, points: 0, year: s.year + 1, month: 0,
      races: mlGenRaceCandidates(s.year + 1, 0, classIdx, s.raceFocus, s.raceFocusSlots), sel: { ...s.sel, raceId: null },
      directive: mlGenDirective(s.year + 1, 0, classIdx, managerEval),
      salary, money, managerEval, carLv, houseLv, coaches, debtMonths, worldRosters: aged.worldRosters, teammates: nextTeammates, bonds: nextBonds,
      rival: rival1Res.rival, rivalRecord: rival1Res.record, rival2: rival2Res.rival, rivalRecord2: rival2Res.record,
      retiredRivals: nextRetiredRivals,
      screen: "mylife_main", log,
    });
  }
  const month = s.month + 1;
  // v37: 自分が出走しなかったクラスは、その月のレースをワールドの選手だけで軽量に決着させ、
  // 成績台帳に積む（自分が出ていないレースの成績も溜まる）。
  // v51(第11弾Phase2・2-A): 実レース（buildMyLifeSim）は自クラスのみに絞られているため、
  // 台帳の土俵を揃えるには残り2クラスも毎月ここで決着させる必要がある。自分が走った
  // クラス（mode==="race"の場合のs.classIdx）だけはmlRaceFinish側で実結果を既に積んでいる
  // ので、二重計上を避けてスキップする。
  let riderStats = s.riderStats;
  // 第16弾B-2: 自分が出ていない月も、他クラスで実際に決着したレースの優勝者を1行だけ
  // ホームに出す（world ticker）。既に台帳へ積むために毎月計算しているworldLite[0]を
  // そのまま流用するので追加コストはゼロ。自分のクラスに近い方を優先する。
  let worldTicker = null;
  let worldTickerDist = Infinity;
  if (s.worldRosters && Object.keys(s.worldRosters).length) {
    for (let cls = 0; cls < 3; cls++) {
      if (mode === "race" && cls === s.classIdx) continue;
      const raceForClass = mlGenRace(s.year, s.month, cls);
      const worldLite = mlWorldRaceLite(s, s.year * 1000 + s.month * 17 + 3 + cls, cls, raceForClass);
      riderStats = mlUpdateRiderStats(riderStats, worldLite, new Set(), s.year, raceForClass.grade, CLASSES[cls].prizeMul);
      const dist = Math.abs(cls - s.classIdx);
      if (worldLite[0] && dist < worldTickerDist) {
        worldTicker = `${worldLite[0].name}（${worldLite[0].teamName}）が${raceForClass.name}を制した`;
        worldTickerDist = dist;
      }
    }
  }
  // v38(改善:育成の手応え): 「今月の成長」レポート。伸びた能力（丸め後で+1以上、または生の伸びが
  // 大きいもの）とOVR・活力の増減をまとめ、主画面に出す。毎月の積み上げを目に見える手応えにする。
  const growthDeltas = AB_KEYS.map(k => {
    const beforeR = Math.round(_preAb[k]); const afterR = Math.round(player[k] || 0);
    return { key: k, label: AB_LABEL[k], before: beforeR, after: afterR, raw: (player[k] || 0) - _preAb[k], up: afterR - beforeR };
  }).filter(d => d.up > 0).sort((a, b) => b.up - a.up || b.raw - a.raw);
  const subDeltas = [];
  { const a = Math.round(player.accel || 0) - Math.round(_preSub.accel); if (a > 0) subDeltas.push({ label: "加速力", up: a }); }
  { const m = Math.round(player.mental || 0) - Math.round(_preSub.mental); if (m > 0) subDeltas.push({ label: "メンタル", up: m }); }
  const ovrAfter = overall(player);
  // OVRが10の節目（60/70/80/90…）を越えたら祝う＝成長のピークを演出
  const ovrMilestone = (ovrAfter >= 50 && Math.floor(ovrAfter / 10) > Math.floor(_preOvr / 10)) ? Math.floor(ovrAfter / 10) * 10 : null;
  if (ovrMilestone) log.push(`【${s.year}年目 ${MONTHS[s.month]}】📈 総合力（OVR）が${ovrMilestone}に到達した！`);
  const growthReport = {
    mode, deltas: growthDeltas, subDeltas, ovrMilestone,
    ovrBefore: _preOvr, ovrAfter, ovrUp: ovrAfter - _preOvr,
    vitBefore: Math.round(_preVit), vitAfter: Math.round(player.vitality == null ? 100 : player.vitality),
    month: s.month, year: s.year,
  };
  const base = {
    ...s, player, month, races: mlGenRaceCandidates(s.year, month, s.classIdx, s.raceFocus, s.raceFocusSlots), sel: { ...s.sel, raceId: null },
    directive: mlGenDirective(s.year, month, s.classIdx, managerEval),
    money, managerEval, carLv, houseLv, coaches, debtMonths, riderStats, growthReport, worldTicker,
    screen: "mylife_main", log,
  };
  // v36(弟子深化): 弟子がいる間は、毎月ごく稀に指導イベントが発生する。関わり方で
  // 弟子の伸びや個性が変わり、"年1回数字が変わるだけ"だった弟子育成に手触りを与える。
  if (s.protege && Math.random() < 0.2) {
    const ev = ML_PROTEGE_EVENTS[Math.floor(Math.random() * ML_PROTEGE_EVENTS.length)];
    return { ...base, pendingProtegeEvent: ev, screen: "mylife_protege_event" };
  }
  // v43(マイライフ難易度調整Phase 2): 「🎤取材・私生活イベント」の手動ボタンを廃止し、
  // 弟子イベントと同じ「月が終わるたびに確率で割り込む」形に統一した。月コストは既に
  // baseの時点で確定済み（練習/レース等の効果は反映済み）のため、ここでの発火に
  // 追加の月消費は発生しない（弟子イベントと排他＝ポップアップの多重発生を防ぐ）。
  // 発火率は新ステータス「運」で0.5〜1.5倍に振れる（突破力/安定感と同じ揺らぎ式）。
  const luck = player.luck ?? 50;
  if (Math.random() < 0.28 * (0.5 + luck / 100)) {
    const ev = pickMlEvent(player);
    return { ...base, pendingEvent: { ...ev, passive: true }, screen: "mylife_event" };
  }
  return base;
}
