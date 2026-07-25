// 移籍・トレードの状態遷移（純粋なreducer関数：(state, ...args) => newState）。
// Phase 4-1後の main.jsx App() から分離（Step7: controller抽出）。JSX/React非依存＝Node単体テスト可能。
// main.jsx 側は `const retainRider = () => setG(retainRider_);` のような薄いラッパーで setG に接続する。
import { MONTHS, ROSTER_MAX_BY_CLASS } from "../../data/course.js";
import { RIVAL_TEAMS } from "../../data/teams.js";
import { overall, ridState } from "../../core/core.js";
import { computePickupChance } from "../../domain/season/transfer.js";
import { isHallOfFameWorthy } from "../../logic/support.js";

// v28: 移籍志願への対応。慰留＝引き止め費用を払って残ってもらう。
export function retainRider(s) {
  const req = s.transferRequest;
  if (!req) return s;
  const cost = 30;
  return {
    ...s, budget: s.budget - cost, transferRequest: null, screen: "main",
    roster: s.roster.map(r => r.id === req.riderId ? { ...r, benchMonths: 0, cond: Math.min(5, r.cond + 1) } : r),
    log: [...s.log, `【${MONTHS[s.month]}】${req.name}を慰留（引き止め費用-${cost}万・本人は納得して残留）`],
  };
}

// v28: 移籍志願を受け入れて放出（他チームに拾われうる）。
export function grantTransferRequest(s) {
  const req = s.transferRequest;
  if (!req) return s;
  const r = s.roster.find(x => x.id === req.riderId);
  if (!r) return { ...s, transferRequest: null, screen: "main" };
  const roster = s.roster.filter(x => x.id !== req.riderId);
  const captainId = s.captainId === req.riderId ? null : s.captainId;
  // 志願しての退団なので、他チームに拾われやすい（能力・将来性に応じて）
  const pickedUp = Math.random() < Math.max(0.5, computePickupChance(r));
  if (pickedUp) {
    const signedTeam = RIVAL_TEAMS[Math.floor(Math.random() * RIVAL_TEAMS.length)].name;
    return {
      ...s, roster, captainId, transferRequest: null, screen: "main",
      rivalAlumni: [...s.rivalAlumni, { ...r, signedTeam, signedYear: s.year }],
      log: [...s.log, `【${MONTHS[s.month]}】${r.name}の移籍志願を受け入れた → ${signedTeam}へ移籍`],
    };
  }
  const hallOfFame = isHallOfFameWorthy(r) ? [...s.hallOfFame, { ...r, farewellYear: s.year, farewellReason: "released" }] : s.hallOfFame;
  return { ...s, roster, captainId, hallOfFame, transferRequest: null, screen: "main", log: [...s.log, `【${MONTHS[s.month]}】${r.name}の移籍志願を受け入れ、円満に送り出した`] };
}

// v41: 被引き抜きへの対応。引き止める＝費用を払い残留（本人は奮起＝調子+1）。
export function poachRetain(s) {
  const o = s.poachOffer;
  if (!o) return { ...s, poachOffer: null, screen: "main" };
  if (s.budget < o.retainCost) return s; // 資金不足なら操作無効（ボタン側でも抑止）
  return {
    ...s, budget: s.budget - o.retainCost, poachOffer: null, screen: "main",
    roster: s.roster.map(r => r.id === o.riderId ? { ...r, cond: Math.min(5, r.cond + 1) } : r),
    log: [...s.log, `【${MONTHS[s.month]}】${o.team}による${o.name}の引き抜きを退けた（引き止め費用-${o.retainCost}万・本人は奮起して調子+1）`],
  };
}

// v41: 被引き抜きの受諾。移籍金を受け取り主力を放出。相手チームの一員として走り続ける（rivalAlumni）。
export function poachAccept(s) {
  const o = s.poachOffer;
  if (!o) return { ...s, poachOffer: null, screen: "main" };
  const r = s.roster.find(x => x.id === o.riderId);
  if (!r) return { ...s, poachOffer: null, screen: "main" };
  const roster = s.roster.filter(x => x.id !== o.riderId);
  const captainId = s.captainId === o.riderId ? null : s.captainId;
  return {
    ...s, roster, captainId, budget: s.budget + o.fee, poachOffer: null, screen: "main",
    rivalAlumni: [...(s.rivalAlumni || []), { ...r, signedTeam: o.team, signedYear: s.year }],
    log: [...s.log, `【${MONTHS[s.month]}】${o.name}を${o.team}へ放出（移籍金+${o.fee}万）。今後は${o.team}の一員として自チームの前に立ちはだかる`],
  };
}

// v41: 引き抜き（こちらが他チームの主力を獲得）。年1回まで・資金と枠が必要。成立すると相手の
// ロースターから外れ（世界に反映）、自チームへ加入。移籍金は candidate の実効OVRで算定済み。
// rosterMax は s.classIdx から都度算出する（App()側の閉じ込みに依存しない＝純関数として自己完結）。
export function poachSign(s, targetId) {
  const t = (s.poachTargets || []).find(x => x.id === targetId);
  if (!t) return s;
  if (s.poachDoneThisYear) return s;
  if (s.budget < t.fee) return s;
  const rosterMax = ROSTER_MAX_BY_CLASS[s.classIdx];
  if (s.roster.length >= rosterMax) return s;
  // 相手ロースターから引き抜いた選手を外す（世界に反映＝以後その相手として出走しない）
  const rivalRosters = { ...(s.rivalRosters || {}) };
  if (rivalRosters[t.team]) rivalRosters[t.team] = rivalRosters[t.team].filter(wr => wr.id !== t.wrId);
  const recruit = { ...t.candidate, poachedFrom: t.team };
  return {
    ...s, budget: s.budget - t.fee, roster: [...s.roster, recruit],
    rivalRosters, poachDoneThisYear: true,
    poachTargets: (s.poachTargets || []).filter(x => x.id !== targetId),
    screen: "main",
    log: [...s.log, `【${MONTHS[s.month]}】${t.team}の主力 ${t.candidate.name}（OVR${overall(t.candidate)}）を引き抜き獲得！ 移籍金-${t.fee}万`],
  };
}

export function acceptTrade(s, offerId) {
  const offer = (s.tradeOffers || []).find(o => o.id === offerId);
  if (!offer) return s;
  const outgoing = s.roster.find(r => r.id === offer.wantRiderId);
  if (!outgoing) return s;
  const incoming = { ...offer.offeredRider, id: ridState.value++, tenure: 0, favorite: false, raceLog: [] };
  const roster = s.roster.filter(r => r.id !== offer.wantRiderId).concat(incoming);
  const captainId = s.captainId === offer.wantRiderId ? null : s.captainId;
  return {
    ...s, roster, captainId,
    tradeOffers: s.tradeOffers.filter(o => o.id !== offerId),
    log: [...s.log, `【${MONTHS[s.month]}】${offer.team}と選手交換トレード成立：${outgoing.name} → ${incoming.name}が加入`],
  };
}

export function declineTrade(s, offerId) {
  return { ...s, tradeOffers: (s.tradeOffers || []).filter(o => o.id !== offerId) };
}
