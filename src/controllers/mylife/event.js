// マイライフの私生活/イベント・レース後のライバル対話の状態遷移（純粋なreducer関数）。Step7第9弾。
// main.jsxのApp()に生で残っていたクラスタの1つ。mlApplyEventEffects/eventEffectSummaryは
// mlResolveEvent専用の内部ヘルパー（controllers/内に留め置く。単体テストのためexportはしておく）。
import { AB_KEYS } from "../../data/abilities.js";
import { ML_EVENTS, ML_PERSONALITY_EVENTS, ML_SPONSOR_GIGS } from "../../data/events.js";
import { addAb, growSub, mlGrowthCap } from "../../logic/support.js";
import { mlAdvanceMonth } from "./month.js";

// v14.2: 私生活・取材イベント（練習/休養以外の月次アクション）
export function mlApplyEventEffects(player0, effects, year) {
  const player = { ...player0 };
  if (effects.fatigueDelta) player.fatigue = Math.max(0, Math.min(100, player.fatigue + effects.fatigueDelta));
  if (effects.abBoost) AB_KEYS.forEach(k => addAb(player, k, effects.abBoost, mlGrowthCap(year)));
  // v27: 個人スポンサー依頼イベント用。人気度も増減させられるようにする
  if (effects.popularityDelta) player.popularity = Math.max(0, Math.min(100, (player.popularity || 0) + effects.popularityDelta));
  // v36(#8): 私生活イベントを有意義に。メンタル（フォーム安定・大舞台に効く副ステータス）を育てられる
  if (effects.mentalDelta) growSub(player, "mental", effects.mentalDelta);
  // v36(#8): フォーム（当日の仕上がり）を直接動かせる（気分転換で調子が上向く等）
  if (effects.formDelta) player.form = Math.max(0, Math.min(100, (player.form ?? 50) + effects.formDelta));
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
  if (effects.formDelta) parts.push(`フォーム${effects.formDelta > 0 ? "+" : ""}${effects.formDelta}`);
  if (effects.moneyDelta) parts.push(`+${effects.moneyDelta}万円`);
  if (effects.fatigueDelta) parts.push(`疲労${effects.fatigueDelta > 0 ? "+" : ""}${effects.fatigueDelta}`);
  return parts.length ? `（${parts.join("・")}）` : "";
}

export function mlTriggerEvent(s) {
  // v36(#9): プレイヤーの性格に応じた私生活イベントを半々で差し込む（性格を持つ選手のみ）
  const persPool = ML_PERSONALITY_EVENTS[s.player?.personality];
  const usePers = persPool && persPool.length && Math.random() < 0.5;
  const ev = usePers ? persPool[Math.floor(Math.random() * persPool.length)] : ML_EVENTS[Math.floor(Math.random() * ML_EVENTS.length)];
  return { ...s, pendingEvent: ev, screen: "mylife_event" };
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
  const player = mlApplyEventEffects(s.player, choice.effects, s.year);
  const managerEval = Math.max(0, Math.min(100, s.managerEval + (choice.effects.managerEvalDelta || 0)));
  // v27: スポンサー依頼イベントの報酬（お金）を即時反映する
  const money = s.money + (choice.effects.moneyDelta || 0);
  // v36(#8): 得た成果を結果文に明示（手応えのないイベントにしない）
  const resultText = choice.result + " " + eventEffectSummary(choice.effects);
  return { ...s, player, money, managerEval, pendingEvent: null, eventResultText: resultText, screen: "mylife_event_result" };
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
  if (md.abBoost) { const cap = mlGrowthCap(s.year, player); player = { ...player }; AB_KEYS.forEach(k => { player[k] = Math.min(cap, (player[k] || 0) + md.abBoost); }); }
  const fatigue = Math.max(0, Math.min(100, (player.fatigue || 0) + (md.fatigueDelta || 0)));
  player = { ...player, fatigue };
  const managerEval = Math.max(0, Math.min(100, s.managerEval + (md.evalDelta || 0)));
  return { ...s, protege, player, managerEval, pendingProtegeEvent: null,
    eventResultText: ch.result, eventAdvanced: true,
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
