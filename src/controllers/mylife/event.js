// マイライフの私生活/イベント・レース後のライバル対話の状態遷移（純粋なreducer関数）。Step7第9弾。
// main.jsxのApp()に生で残っていたクラスタの1つ。mlApplyEventEffects/eventEffectSummaryは
// mlResolveEvent専用の内部ヘルパー（controllers/内に留め置く。単体テストのためexportはしておく）。
import { AB_KEYS, AB_LABEL } from "../../data/abilities.js";
import { ML_SPONSOR_GIGS } from "../../data/events.js";
import { addAb, bumpGrowthPow, growSub, mlGrowthCap, weightedPick } from "../../logic/support.js";
import { mlAdvanceMonth } from "./month.js";

// v14.2: 私生活・取材イベント（練習/休養以外の月次アクション）
// v43: 第3引数はmlの状態そのもの（実績連動の成長キャップ計算に使う）。
// v43(Phase 2): イベント拡充に伴い、能力個別ブースト(abKeyDelta)・新ステ増減
// (breakthroughDelta/stabilityDelta/luckDelta)・覚醒級(growthPowBump/talentCapDelta)
// に対応。abKeyDeltaは正なら既存のaddAb（伸びしろカーブ・成長上限に従う）、負なら
// 直接減算（伸びを減らすわけではないので曲線を通さない）。新ステ3種は生まれつき固定だが、
// 判断により「イベントという物語上の節目」だけは例外的に動かせる（成長キャップとは無関係の
// 直接加減算、範囲は[5,100]）。
export function mlApplyEventEffects(player0, effects, ml) {
  const player = { ...player0 };
  if (effects.fatigueDelta) player.fatigue = Math.max(0, Math.min(100, player.fatigue + effects.fatigueDelta));
  if (effects.abBoost) AB_KEYS.forEach(k => addAb(player, k, effects.abBoost, mlGrowthCap(ml.year, player, ml)));
  if (effects.abKeyDelta) {
    const cap = mlGrowthCap(ml.year, player, ml);
    Object.entries(effects.abKeyDelta).forEach(([k, v]) => {
      if (v > 0) addAb(player, k, v, cap);
      else player[k] = Math.max(20, (player[k] || 0) + v);
    });
  }
  // v27: 個人スポンサー依頼イベント用。人気度も増減させられるようにする
  if (effects.popularityDelta) player.popularity = Math.max(0, Math.min(100, (player.popularity || 0) + effects.popularityDelta));
  // v36(#8): 私生活イベントを有意義に。メンタル（フォーム安定・大舞台に効く副ステータス）を育てられる
  if (effects.mentalDelta) growSub(player, "mental", effects.mentalDelta);
  // v36(#8): フォーム（当日の仕上がり）を直接動かせる（気分転換で調子が上向く等）
  if (effects.formDelta) player.form = Math.max(0, Math.min(100, (player.form ?? 50) + effects.formDelta));
  if (effects.breakthroughDelta) player.breakthrough = Math.max(5, Math.min(100, (player.breakthrough ?? 50) + effects.breakthroughDelta));
  if (effects.stabilityDelta) player.stability = Math.max(5, Math.min(100, (player.stability ?? 50) + effects.stabilityDelta));
  if (effects.luckDelta) player.luck = Math.max(5, Math.min(100, (player.luck ?? 50) + effects.luckDelta));
  if (effects.growthPowBump) player.growthPow = bumpGrowthPow(player.growthPow, 1);
  if (effects.talentCapDelta) player.talentCap = Math.max(0, (player.talentCap || 0) + effects.talentCapDelta);
  return player;
}

// v36(#8): イベントの効果を「人気+6・メンタル+2・疲労-8」の形で結果文に添え、手応えを明示する
export function eventEffectSummary(effects) {
  if (!effects) return "";
  const parts = [];
  if (effects.popularityDelta) parts.push(`人気${effects.popularityDelta > 0 ? "+" : ""}${effects.popularityDelta}`);
  if (effects.managerEvalDelta) parts.push(`監督評価${effects.managerEvalDelta > 0 ? "+" : ""}${effects.managerEvalDelta}`);
  if (effects.mentalDelta) parts.push(`メンタル+${effects.mentalDelta}`);
  if (effects.abBoost) parts.push(`能力+${effects.abBoost}`);
  if (effects.abKeyDelta) parts.push(Object.entries(effects.abKeyDelta).map(([k, v]) => `${AB_LABEL[k]}${v > 0 ? "+" : ""}${v}`).join("・"));
  if (effects.formDelta) parts.push(`フォーム${effects.formDelta > 0 ? "+" : ""}${effects.formDelta}`);
  if (effects.breakthroughDelta) parts.push(`突破力${effects.breakthroughDelta > 0 ? "+" : ""}${effects.breakthroughDelta}`);
  if (effects.stabilityDelta) parts.push(`安定感${effects.stabilityDelta > 0 ? "+" : ""}${effects.stabilityDelta}`);
  if (effects.luckDelta) parts.push(`運${effects.luckDelta > 0 ? "+" : ""}${effects.luckDelta}`);
  if (effects.growthPowBump) parts.push("成長力↑");
  if (effects.talentCapDelta) parts.push(`才能キャップ${effects.talentCapDelta > 0 ? "+" : ""}${effects.talentCapDelta}`);
  if (effects.moneyDelta) parts.push(`+${effects.moneyDelta}万円`);
  if (effects.fatigueDelta) parts.push(`疲労${effects.fatigueDelta > 0 ? "+" : ""}${effects.fatigueDelta}`);
  return parts.length ? `（${parts.join("・")}）` : "";
}

// v45: ユーザー指摘「イベントで起きた能力変化などは必ず明示したほうがいい」。
// 弟子の指導イベントは結果文(ch.result)がフレーバーのみで、実際に動いた数値
// （弟子の絆・鍛錬・地力、師＝プレイヤー自身の能力・疲労・監督評価）が一切
// 表示されずに反映されていた。eventEffectSummaryと同じ「（〜・〜）」形式で
// 弟子側／師側の変化をまとめて明示する。
export function protegeEffectSummary(pd, md) {
  const parts = [];
  if (pd.bond) parts.push(`弟子の絆${pd.bond > 0 ? "+" : ""}${pd.bond}`);
  if (pd.guideBonus) parts.push("弟子の鍛錬↑");
  if (pd.ovrBonus) parts.push(`弟子の地力${pd.ovrBonus > 0 ? "+" : ""}${pd.ovrBonus}`);
  if (md.abBoost) parts.push(`自分の能力+${md.abBoost}`);
  if (md.fatigueDelta) parts.push(`疲労${md.fatigueDelta > 0 ? "+" : ""}${md.fatigueDelta}`);
  if (md.evalDelta) parts.push(`監督評価${md.evalDelta > 0 ? "+" : ""}${md.evalDelta}`);
  return parts.length ? `（${parts.join("・")}）` : "";
}

// v43(Phase 2): ダイジョーブ博士系（賭け）イベント用。choice.outcomesがあれば
// weight加重で1つ抽選し、そのeffects/resultを採用する（＝選んだ瞬間には結果が
// 決まっておらず、賭けた後にどちらに転ぶか分かる）。無ければ従来通りchoice自体を使う。
export function resolveChoiceOutcome(choice) {
  if (choice.outcomes && choice.outcomes.length) {
    const outcome = weightedPick(choice.outcomes);
    return { effects: outcome.effects || {}, result: outcome.result };
  }
  return { effects: choice.effects || {}, result: choice.result };
}

// v27: 個人スポンサーの依頼イベント。現在の人気度に応じて報酬が大きくなる仕事を1件生成する
export function mlTriggerSponsorGig(s) {
  const pop = s.player.popularity || 0;
  const g0 = ML_SPONSOR_GIGS[Math.floor(Math.random() * ML_SPONSOR_GIGS.length)];
  const money = Math.round(g0.baseMoney + pop * g0.moneyPerPop);
  const gig = {
    title: g0.title, text: g0.text,
    choices: [
      { label: `引き受ける（+${money}万円・人気度+${g0.pop}・疲労+${g0.fatigue}）`, result: g0.acceptResult, effects: { moneyDelta: money, popularityDelta: g0.pop, fatigueDelta: g0.fatigue } },
      { label: "今回は辞退する", result: "今は競技に集中したいと、丁重に辞退した。", effects: { fatigueDelta: -3 } },
    ],
  };
  return { ...s, pendingEvent: gig, screen: "mylife_event" };
}

export function mlResolveEvent(s, choiceIdx) {
  const ev = s.pendingEvent;
  if (!ev) return s;
  const choice = ev.choices[choiceIdx];
  // v43(Phase 2): 賭けイベント（choice.outcomes）はここで初めて結果が確定する
  const { effects, result } = resolveChoiceOutcome(choice);
  const player = mlApplyEventEffects(s.player, effects, s);
  const managerEval = Math.max(0, Math.min(100, s.managerEval + (effects.managerEvalDelta || 0)));
  // v27: スポンサー依頼イベントの報酬（お金）を即時反映する
  const money = s.money + (effects.moneyDelta || 0);
  // v36(#8): 得た成果を結果文に明示（手応えのないイベントにしない）
  const resultText = result + " " + eventEffectSummary(effects);
  // v43(Phase 2): 受動発火した私生活イベント（ev.passive）は既に月が進んでいるため、
  // 「翌月へ進む」ではなく弟子イベントと同じ「戻る」だけでmylife_mainへ戻す
  return { ...s, player, money, managerEval, pendingEvent: null, eventResultText: resultText,
    eventAdvanced: !!ev.passive, screen: "mylife_event_result" };
}

// v36(弟子深化): 弟子の指導イベントへの応答。選択に応じて弟子の絆(bond)・鍛錬(guideBonus)・
// 即時加点(ovrBonus)と、師（プレイヤー）の疲労・評価・地力を反映し、結果画面へ。
export function mlResolveProtegeEvent(s, choiceIdx) {
  const ev = s.pendingProtegeEvent;
  if (!ev || !s.protege) return { ...s, pendingProtegeEvent: null, screen: "mylife_main" };
  const ch = ev.choices[choiceIdx];
  const pd = ch.protege || {}, md = ch.mentor || {};
  const protege = {
    ...s.protege,
    bond: Math.min(100, (s.protege.bond || 0) + (pd.bond || 0)),
    guideBonus: Math.min(0.4, (s.protege.guideBonus || 0) + (pd.guideBonus || 0)),
    ovrBonus: (s.protege.ovrBonus || 0) + (pd.ovrBonus || 0),
  };
  let player = s.player;
  if (md.abBoost) { const cap = mlGrowthCap(s.year, player, s); player = { ...player }; AB_KEYS.forEach(k => { player[k] = Math.min(cap, (player[k] || 0) + md.abBoost); }); }
  const fatigue = Math.max(0, Math.min(100, (player.fatigue || 0) + (md.fatigueDelta || 0)));
  player = { ...player, fatigue };
  const managerEval = Math.max(0, Math.min(100, s.managerEval + (md.evalDelta || 0)));
  return { ...s, protege, player, managerEval, pendingProtegeEvent: null,
    eventResultText: ch.result + " " + protegeEffectSummary(pd, md), eventAdvanced: true,
    screen: "mylife_event_result" };
}

// v36修正: レース後のライバル対話シーン。返答を選ぶと心情（メンタル）・人気・因縁度(heat)に反映し、
// ライバルの反応（reply）を表示する。続けると号外（あれば）→翌月へ進む。
export function mlResolveRivalScene(s, choiceIdx) {
  const scene = s.resultInfo && s.resultInfo.rivalOutcome && s.resultInfo.rivalOutcome.scene;
  if (!scene) return { ...s, screen: "mylife_result" };
  const resp = scene.responses[choiceIdx];
  const eff = resp.effects || {};
  let player = { ...s.player };
  if (eff.mentalDelta) growSub(player, "mental", eff.mentalDelta);
  if (eff.popularityDelta) player.popularity = Math.max(0, Math.min(100, (player.popularity || 0) + eff.popularityDelta));
  let rivalRecord = s.rivalRecord;
  if (eff.heatDelta) rivalRecord = { ...rivalRecord, heat: (rivalRecord && rivalRecord.heat || 0) + eff.heatDelta };
  return { ...s, player, rivalRecord, rivalSceneReply: resp };
}

// 対話シーンを閉じて次へ（号外があればそちらへ、なければ翌月へ）。
// v41(§Step7第9弾): 旧実装は外側のml（renderクロージャ）を読んでhasNewspaperを判定し、
// setMlを2回（うち1回は早期return）＋mlAdvanceMonthの計3呼び出しに分かれていた。
// 常に最新のsだけを参照する1つの純reducerに正規化し、mlAdvanceMonth（既存controller）を
// そのまま合成する形にした。
export function mlRivalSceneContinue(s) {
  if (s.resultInfo && s.resultInfo.newspaper) return { ...s, rivalSceneReply: null, screen: "mylife_newspaper" };
  return mlAdvanceMonth({ ...s, rivalSceneReply: null }, "race");
}
