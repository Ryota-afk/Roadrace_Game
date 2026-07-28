// レース結果確定（通常/チームTT/ステージ）の状態遷移（純粋なreducer関数）。Step7第3弾。
// v41(§Step7第3弾): finishStage内のrecordTitle("grandTour")はここで呼ばず、返り値の
// gc.justWonGrandTour フラグを見たApp()側のuseEffectに一本化した（詳細はDEVLOG §9参照）。
// v41(§Step7第4弾): recordCourseResultも同様の理由（非冪等な書き込みをupdater内に置かない）で
// peekCourseRecord（読み取り専用の判定）に差し替えた。実際の書き込みはApp()側のuseEffectが
// courseRecord.isNewを見てpersistCourseRecordを1回だけ呼ぶ（詳細はDEVLOG §9参照）。
// v41(§Step7第5弾・退行修正): 第3弾でfinishRaceをreducer化した際、rankSim(sim)がこのupdater内へ
// 移動してしまっていた。rankSimはsimを破壊的に変更し、内部のresolveFinishClustersがMath.random()で
// ジッターを掛けるため、updaterが複数回呼ばれると着順が変わり得る（第3弾・第4弾で潰していた
// 「非冪等な処理をupdaterに置かない」原則の違反を、同じ作業中に1つ作り込んでいた）。
// rankSimはApp()側のfinishRaceラッパーがsetGを呼ぶ前に1回だけ実行する。この関数は
// 「simは既にランク済み」を前提とする（詳細はDEVLOG §9参照）。
import { CLASSES } from "../../data/progression.js";
import { MONTHS } from "../../data/course.js";
import {
  GRADE_MUL, PRIZES, PTS, advanceObjective, bumpCareerStats, peekCourseRecord, raceObjectiveEvent,
} from "../../logic/support.js";

export function finishRace(s, sim, race, stageOverride) {
  // v35(チームTT): チーム単位の合算タイム。チーム順位で得点・賞金を確定する
  if (sim.teamTT) return finishTeamTT(s, sim, race);
  if (race.stageRace) return finishStage(s, sim, race, stageOverride);
  const playerRs = sim.ranked.filter(e => e.team === "PLAYER");
  const best = playerRs[0];
  // v27: コースレコード。勝者のフィニッシュタイムからコース種別ごとの最速記録を更新する
  const winner = sim.ranked[0];
  const courseRecord = peekCourseRecord(race.tmpl.kind, sim.course.length, winner.finishTime, winner.name, winner.team === "PLAYER");
  const mul = CLASSES[s.classIdx].prizeMul * GRADE_MUL[race.grade];
  const prize = Math.round(playerRs.reduce((s2, e) => s2 + (PRIZES[e.rank - 1] || 1), 0) * mul);
  const mandateHit = !race.championship && !!race.sponsorMandate;
  let pts = Math.round((PTS[best.rank - 1] || 0) * GRADE_MUL[race.grade]);
  if (mandateHit) pts = Math.round(pts * 1.3);
  // v13: 選手名鑑用に、出走した自チーム選手それぞれの着順を各選手のraceLogへ記録する
  const rankById = {}; playerRs.forEach(e => { rankById[e.id] = e.rank; });
  // v14.6: フレーバーテキストで「そのレースでどんな役割だったか」を語れるよう、
  // 着順と一緒に役割（エースならace、それ以外はROLESのキー）も記録する
  const roleById = {}; playerRs.forEach(e => { roleById[e.id] = e.isAce ? "ace" : e.role; });
  // v13.1: ライバルチームに拾われた元選手が出走していれば、そちらのraceLogも伸ばす
  const alumniRankById = {}; sim.ranked.filter(e => e.isAlumnus).forEach(e => { alumniRankById[e.id] = e.rank; });
  const alumniRoleById = {}; sim.ranked.filter(e => e.isAlumnus).forEach(e => { alumniRoleById[e.id] = e.isAce ? "ace" : e.role; });
  const roster = s.roster.map(r => rankById[r.id] != null
    ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: rankById[r.id], role: roleById[r.id] }] }
    : r);
  const rivalAlumni = (s.rivalAlumni || []).map(r => alumniRankById[r.id] != null
    ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: alumniRankById[r.id], role: alumniRoleById[r.id] }] }
    : r);
  // v40（第1候補②）：シーズン中期目標の進捗。達成した瞬間に資金＋ノルマptを付与する
  let sponsor = (s.sponsor && mandateHit) ? { ...s.sponsor, mandatesMet: s.sponsor.mandatesMet + 1 } : s.sponsor;
  const objRes = advanceObjective(sponsor && sponsor.objective, raceObjectiveEvent(race, best.rank, best.age), MONTHS[s.month]);
  if (sponsor && sponsor.objective) sponsor = { ...sponsor, objective: objRes.objective };
  return {
    ...s, roster, rivalAlumni, sponsor,
    log: objRes.log ? [...s.log, objRes.log] : s.log,
    budget: s.budget + prize + objRes.budgetDelta,
    points: race.championship ? s.points : s.points + pts + objRes.pointsDelta,
    champBest: race.championship ? best.rank : s.champBest,
    careerStats: bumpCareerStats(s.careerStats, best.rank, prize),
    prizeInfo: { race, prize, pts: race.championship ? 0 : pts, best, mandateHit, breakSurvived: sim.breakSurvived, hadBreak: sim.hadBreak, courseRecord, objectiveResult: objRes.log ? objRes.objective : null, objectiveDone: objRes.justDone },
    screen: "result",
  };
}

// v35(チームTT): チームTTの結果確定。チーム順位で得点・賞金を付与し、出走選手にチーム着順を記録
export function finishTeamTT(s, sim, race) {
  const teams = sim.teamTT;
  const playerTeam = teams.find(t => t.isPlayer);
  const teamRank = playerTeam ? playerTeam.rank : teams.length;
  const totalTeams = teams.length;
  const mul = CLASSES[s.classIdx].prizeMul * GRADE_MUL[race.grade];
  // チーム1つの結果なので、個人レースの複数入賞相当に賞金を厚めに換算
  const prize = Math.round((PRIZES[teamRank - 1] || 1) * mul * 2.4);
  const mandateHit = !race.championship && !!race.sponsorMandate;
  let pts = Math.round((PTS[teamRank - 1] || 0) * GRADE_MUL[race.grade]);
  if (mandateHit) pts = Math.round(pts * 1.3);
  const starterIds = new Set((playerTeam ? playerTeam.riders : []).map(r => r.id));
  const roster = s.roster.map(r => starterIds.has(r.id)
    ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: teamRank, role: "tt" }] }
    : r);
  // v40（第1候補②）：チームTTでも中期目標の進捗を判定（チーム着順を最上位着順とみなす。エース年齢は無し）
  let sponsor = (s.sponsor && mandateHit) ? { ...s.sponsor, mandatesMet: s.sponsor.mandatesMet + 1 } : s.sponsor;
  const objRes = advanceObjective(sponsor && sponsor.objective, raceObjectiveEvent(race, teamRank, null), MONTHS[s.month]);
  if (sponsor && sponsor.objective) sponsor = { ...sponsor, objective: objRes.objective };
  return {
    ...s, roster, sponsor,
    log: objRes.log ? [...s.log, objRes.log] : s.log,
    budget: s.budget + prize + objRes.budgetDelta,
    points: race.championship ? s.points : s.points + pts + objRes.pointsDelta,
    careerStats: bumpCareerStats(s.careerStats, teamRank, prize),
    prizeInfo: { race, prize, pts: race.championship ? 0 : pts, teamTT: teams, teamRank, totalTeams, mandateHit, objectiveResult: objRes.log ? objRes.objective : null, objectiveDone: objRes.justDone },
    screen: "result",
  };
}

export function finishStage(s, sim, race, stageOverride) {
  const times = {}; sim.entrants.forEach(en => { times[en.id] = en.finishTime; });
  const stage = stageOverride || (s.gc ? s.gc.stage : 1);
  const totalStages = race.stageCount || 2;
  // v14.8: ステージごとに役割を変更できるようになったため、フレーバーテキスト用に
  // 「その日単独の着順・役割」もdayLogとして日ごとに記録しておく（GC総合成績とは別枠）
  const dayOrder = [...sim.entrants].sort((a, b) => a.finishTime - b.finishTime);
  const dayRankById = {}; dayOrder.forEach((en, i) => { dayRankById[en.id] = i + 1; });
  const dayRoleById = {}; sim.entrants.forEach(en => { dayRoleById[en.id] = en.isAce ? "ace" : en.role; });
  const dayLog = { day: stage, rankById: dayRankById, roleById: dayRoleById };
  if (stage < totalStages) {
    return { ...s, gc: { ...s.gc, stageTimes: { ...s.gc.stageTimes, [stage]: times }, dayLogs: [...(s.gc.dayLogs || []), dayLog] }, screen: "gc_stage" };
  }
  const dayLogs = [...(s.gc.dayLogs || []), dayLog];
  const allStageTimes = { ...s.gc.stageTimes, [stage]: times };
  const gcTimes = {};
  Object.keys(times).forEach(id => {
    gcTimes[id] = Object.values(allStageTimes).reduce((sum2, st) => sum2 + (st[id] || 0), 0);
  });
  const order = Object.entries(gcTimes).sort((a, b) => a[1] - b[1]);
  const idToEntrant = {}; sim.entrants.forEach(en => { idToEntrant[en.id] = en; });
  const playerRanks = order.map(([id], i) => ({ id, rank: i + 1 })).filter(o => idToEntrant[o.id]?.team === "PLAYER");
  const bestRank = playerRanks.length ? Math.min(...playerRanks.map(o => o.rank)) : order.length;
  const prize = Math.round((PRIZES[bestRank - 1] || 1) * CLASSES[s.classIdx].prizeMul * 2.2);
  // v13: 昇格戦（championship）は年度末に近くポイントがどのみちリセットされるため対象外。
  // グランツールなど通常カレンダー上のステージレースは、複数日にわたる大会である
  // ことを踏まえ通常レースよりポイント倍率を優遇する
  const pts = race.championship ? 0 : Math.round((PTS[bestRank - 1] || 0) * GRADE_MUL[race.grade] * 1.3);
  // v13: 選手名鑑用に、ステージレース全体の総合着順を各選手のraceLogへ記録する
  // （各日のステージ結果ではなく、最終確定した総合成績のみを1件記録する）
  const rankById = {}; playerRanks.forEach(o => { rankById[o.id] = o.rank; });
  // v14.6: フレーバーテキストでの役割参照用（最終日時点の役割を代表値として使う）
  const roleOf = (id) => { const en = idToEntrant[id]; return en ? (en.isAce ? "ace" : en.role) : undefined; };
  // v14.8: ステージレースなら日ごとの内訳（役割・その日の着順）もraceLogに添えて記録する
  const stageBreakdownFor = (id) => race.stageRace
    ? dayLogs.map(dl => ({ day: dl.day, role: dl.roleById[id], rank: dl.rankById[id] })).filter(d => d.rank != null)
    : undefined;
  const roster = s.roster.map(r => rankById[r.id] != null
    ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: rankById[r.id], role: roleOf(r.id), stageBreakdown: stageBreakdownFor(r.id) }] }
    : r);
  // v13.1: ライバルチームに拾われた元選手のGC総合成績もraceLogへ記録する
  const alumniRanks = order.map(([id], i) => ({ id, rank: i + 1 })).filter(o => idToEntrant[o.id]?.isAlumnus);
  const alumniRankById = {}; alumniRanks.forEach(o => { alumniRankById[o.id] = o.rank; });
  const rivalAlumni = (s.rivalAlumni || []).map(r => alumniRankById[r.id] != null
    ? { ...r, raceLog: [...(r.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: alumniRankById[r.id], role: roleOf(r.id), stageBreakdown: stageBreakdownFor(r.id) }] }
    : r);
  // v14.8: グランツールで自チーム総合優勝ならそのgtIndexを勝利記録に加える（重複防止）
  const gtNewWin = race.grandTour && bestRank === 1 && race.gtIndex != null && !(s.gtWins || []).includes(race.gtIndex);
  const gtWins = gtNewWin ? [...(s.gtWins || []), race.gtIndex] : (s.gtWins || []);
  // v18: グランツールの副次クラシフィケーション（ポイント賞・山岳賞・新人賞)。
  // 実際のGCタイムとは別に、各ステージの着順を日ごとの地形（favors）で重み付けして
  // 集計する。新人賞は26歳未満の選手の中でのGC最高位。自チームの選手が獲得すれば
  // ボーナス賞金を上乗せする
  const STAGE_JERSEY_POINTS = [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  let jerseyBonus = 0;
  let jerseyInfo = null;
  if (race.grandTour) {
    const pointsScore = {}, komScore = {};
    dayLogs.forEach(dl => {
      const dayTmpl = race.stageTmpls ? race.stageTmpls[dl.day - 1] : race.tmpl;
      const favors = dayTmpl ? dayTmpl.favors : race.tmpl.favors;
      const pointsMul = favors === "SPR" ? 1.5 : favors === "PUN" ? 1.0 : favors === "CLM" ? 0.6 : 1.0;
      const komMul = favors === "CLM" ? 1.5 : favors === "PUN" ? 0.6 : 0.2;
      Object.entries(dl.rankById).forEach(([id, rank]) => {
        const base = STAGE_JERSEY_POINTS[rank - 1] || 0;
        pointsScore[id] = (pointsScore[id] || 0) + base * pointsMul;
        komScore[id] = (komScore[id] || 0) + base * komMul;
      });
    });
    const byScoreDesc = (score) => Object.keys(score).sort((a, b) => score[b] - score[a]);
    const pointsLeaderId = byScoreDesc(pointsScore)[0] || null;
    const komLeaderId = byScoreDesc(komScore)[0] || null;
    const youthOrder = order.filter(([id]) => idToEntrant[id] && idToEntrant[id].age <= 25);
    const youthLeaderId = youthOrder.length ? youthOrder[0][0] : null;
    const isPlayer = (id) => id != null && idToEntrant[id]?.team === "PLAYER";
    const pointsLeaderIsPlayer = isPlayer(pointsLeaderId);
    const komLeaderIsPlayer = isPlayer(komLeaderId);
    const youthLeaderIsPlayer = isPlayer(youthLeaderId);
    jerseyBonus = (pointsLeaderIsPlayer ? 50 : 0) + (komLeaderIsPlayer ? 50 : 0) + (youthLeaderIsPlayer ? 30 : 0);
    jerseyInfo = {
      pointsLeaderId, pointsLeaderName: pointsLeaderId ? idToEntrant[pointsLeaderId].name : null, pointsLeaderIsPlayer,
      komLeaderId, komLeaderName: komLeaderId ? idToEntrant[komLeaderId].name : null, komLeaderIsPlayer,
      youthLeaderId, youthLeaderName: youthLeaderId ? idToEntrant[youthLeaderId].name : null, youthLeaderIsPlayer,
    };
  }
  const jerseyWinCounts = { ...(s.jerseyWinCounts || { points: 0, mountains: 0, youth: 0 }) };
  if (jerseyInfo?.pointsLeaderIsPlayer) jerseyWinCounts.points += 1;
  if (jerseyInfo?.komLeaderIsPlayer) jerseyWinCounts.mountains += 1;
  if (jerseyInfo?.youthLeaderIsPlayer) jerseyWinCounts.youth += 1;
  // v40（第1候補②）：ステージレース（グランツール等）でも中期目標の進捗を判定
  const bestEntry = playerRanks.find(o => o.rank === bestRank);
  const aceAge = bestEntry ? (idToEntrant[bestEntry.id]?.age ?? null) : null;
  let sponsor = s.sponsor;
  const objRes = advanceObjective(sponsor && sponsor.objective, raceObjectiveEvent(race, bestRank, aceAge), MONTHS[s.month]);
  if (sponsor && sponsor.objective) sponsor = { ...sponsor, objective: objRes.objective };
  return {
    ...s, roster, rivalAlumni, sponsor, budget: s.budget + prize + jerseyBonus + objRes.budgetDelta,
    points: race.championship ? s.points : s.points + pts + objRes.pointsDelta, champBest: bestRank,
    log: objRes.log ? [...s.log, objRes.log] : s.log,
    careerStats: bumpCareerStats(s.careerStats, bestRank, prize + jerseyBonus),
    // v41(§Step7第3弾): justWonGrandTour はrecordTitle("grandTour")呼び出しの代替シグナル。
    // App()側のuseEffectがこのフラグを見て1回だけ記録する（詳細はDEVLOG §9参照）。
    gc: { ...s.gc, gcOrder: order, idToEntrant, bestRank, prize: prize + jerseyBonus, pts, jerseyInfo, jerseyBonus, objectiveResult: objRes.log ? objRes.objective : null, objectiveDone: objRes.justDone, justWonGrandTour: gtNewWin },
    gtWins, jerseyWinCounts,
    screen: "gc_final",
  };
}
