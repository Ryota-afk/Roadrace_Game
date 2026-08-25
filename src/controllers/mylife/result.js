// マイライフのレース結果確定（通常/チームTT/ラストレース）の状態遷移（純粋なreducer関数）。Step7第3弾。
// v41(§Step7第3弾): mlRaceFinish内のrecordTitle(race.milestone)はここで呼ばず、返り値の
// resultInfo.milestoneWin フラグを見たApp()側のuseEffectに一本化した。mlLastRaceFinish内の
// mlRecordLegend(finalState)も同様に、既存のmlClearAwardedRefイディオム（"mylife_retired"画面への
// 遷移を検知するuseEffect）へ移した（詳細はDEVLOG §9参照）。
// v41(§Step7第4弾): recordCourseResultも同様の理由（非冪等な書き込みをupdater内に置かない）で
// peekCourseRecord（読み取り専用の判定）に差し替えた。実際の書き込みはApp()側のuseEffectが
// resultInfo.courseRecord.isNewを見てpersistCourseRecordを1回だけ呼ぶ（詳細はDEVLOG §9参照）。
import { MONTHS } from "../../data/course.js";
import { CLASSES } from "../../data/progression.js";
import { ML_TACTICS, buildMyLifeSim, mlAmbitionCleared } from "../../state/state.js";
import {
  GRADE_MUL, MANAGER_DIRECTIVES, POP_MILESTONES, PRIZES, PTS, applyAmbitionReward, computeWorldRank,
  mlCurrentAmbition, mlNewspaper, mlUpdateRiderStats, peekCourseRecord, raceForecast, rivalDialogue,
  rivalDrama, rivalMeetingHeat, rivalScene, worldPointsForFinish,
} from "../../logic/support.js";
import { mlBondsAfterRace } from "../../domain/mylife/bonds.js";
import { segMixOfRace } from "../../domain/shared/segMix.js";
import { mlSelectedRace } from "../../domain/mylife/race.js";

export function mlRaceFinish(s) {
  const sim = s.result;
  const race = mlSelectedRace(s);
  if (sim.teamTT) return mlFinishTeamTT(s, sim, race);
  const me = sim.ranked.find(e => e.isPlayerChar);
  const pts = Math.round((PTS[me.rank - 1] || 0) * GRADE_MUL[race.grade]);
  // v14.3: 監督指示を全うできたかどうかで監督評価が増減する。賞金はクラス倍率に応じて即時支給
  // v33.5: セーブから復元した監督指示はJSONでcheck関数が失われているため、キーで正規テーブルから引き直す
  const directive = s.directive ? (MANAGER_DIRECTIVES[s.directive.key] || s.directive) : null;
  // v33.6: 「アシストに徹する」を選んだ場合は監督指示ではなく献身の走りとして評価する。
  // 献身は自らの着順を犠牲にする行為なので、監督評価は下げず（むしろ小幅加点）運ゲーにしない
  const assistChosen = !!(ML_TACTICS[s.tactic] && ML_TACTICS[s.tactic].playerAssist);
  const fulfilled = assistChosen ? true : ((directive && typeof directive.check === "function") ? directive.check(me.rank, sim.ranked.length) : false);
  const evalDelta = assistChosen ? 3 : (directive ? (fulfilled ? directive.evalGain : -directive.evalPenalty) : 0);
  const prize = Math.round((PRIZES[me.rank - 1] || 0) * (0.4 + s.classIdx * 0.25));
  // v15: このレースにライバルが出走していれば、着順を比較して通算のライバル戦績を更新する
  const rivalEntrant = sim.ranked.find(e => e.isRival);
  // v26: 複数ライバル制。2人目の好敵手も同様に戦績を追跡する
  const rival2Entrant = sim.ranked.find(e => e.isRival2);
  // v27: コースレコード。勝者のフィニッシュタイムからコース種別ごとの最速記録を更新する
  const winner = sim.ranked[0];
  const courseRecord = peekCourseRecord(race.tmpl.kind, sim.course.length, winner.finishTime, winner.name, !!winner.isPlayerChar);
  // v37: レース結果に「全順位表」を添える（着順・選手名・チーム名・トップとの秒差）。
  // これで自分以外の選手も識別でき、観戦→結果の一貫した見え方になる。
  const winTime = winner.finishTime;
  const standings = sim.ranked.map(e => ({
    rank: e.rank, name: e.name,
    team: e.teamName || (e.team === "PLAYER" ? s.team : e.team) || "—",
    gap: Number.isFinite(e.finishTime) && Number.isFinite(winTime) ? e.finishTime - winTime : null,
    isPlayer: !!e.isPlayerChar, isMyTeam: e.team === "PLAYER",
    isRival: !!(e.isRival || e.isRival2), isAce: !!e.isAce,
    worldRank: e.worldRank || null,
  }));
  // v28: 通算タイトル記録（世界選手権・オリンピックで優勝したら）。recordTitle自体はApp()側の
  // useEffect（resultInfo.milestoneWinを見る）に任せ、ここではその可否だけを算出する。
  const milestoneWin = (me.rank === 1 && race.milestone) ? race.milestone : null;
  // v28: 代表チームでの立場。世界選手権・オリンピックには代表監督から役割（エース/アシスト）が
  // 与えられる。役割を全うすると名声（人気度）が大きく上がる
  const natRole = race.nationalRole || null;
  const natFulfilled = natRole ? (natRole === "ace" ? me.rank <= 3 : me.rank <= 10) : false;
  const natPopBonus = natRole ? (natFulfilled ? (natRole === "ace" ? 8 : 5) : 0) : 0;
  // v14.6: マイライフでは監督指示のキー自体がその一戦での役割を表すので、そのまま記録する
  // v33.6: ただし「アシストに徹する」を選んだ場合は監督指示に関わらず献身役として記録し、
  // 献身の道（アンビション）へ確実にカウントされるようにする（監督指示待ちの運ゲーを解消）
  const role = assistChosen ? "support" : (directive ? directive.key : (me.isAce ? "ace" : "support"));
  // v25: 個人スポンサー・メディア人気度。着順が良いほど、また規模の大きいレースほど伸びる
  // v28: 代表の役割を全うすれば名声（人気度）が上乗せされる
  const popGain = (me.rank === 1 ? 3 : me.rank <= 3 ? 1.5 : me.rank <= 10 ? 0.5 : 0.1) * GRADE_MUL[race.grade] + natPopBonus;
  const popMilestones = s.player.popMilestones || [];
  const newPopularity = Math.max(0, Math.min(100, (s.player.popularity || 0) + popGain));
  let popBonus = 0;
  const newlyHit = [];
  POP_MILESTONES.forEach(m => {
    if (newPopularity >= m.th && !popMilestones.includes(m.th)) { popBonus += m.bonus; newlyHit.push(m.th); }
  });
  const player = {
    ...s.player,
    raceLog: [...(s.player.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: me.rank, role, monument: race.monument || undefined, segMix: segMixOfRace(race) }],
    popularity: newPopularity,
    popMilestones: [...popMilestones, ...newlyHit],
  };
  let rivalRecord = s.rivalRecord;
  let rivalOutcome = null;
  if (rivalEntrant) {
    const beat = me.rank < rivalEntrant.rank;
    // v35(D 物語): 因縁が育つライバル。接戦ほど因縁度が燃え、決定的瞬間の一文を生成する
    const gapSec = Math.abs((me.finishTime || 0) - (rivalEntrant.finishTime || 0));
    const heatBefore = rivalRecord?.heat ?? rivalRecord?.meetings ?? 0;
    const heatAfter = heatBefore + rivalMeetingHeat(gapSec);
    rivalRecord = {
      meetings: (rivalRecord?.meetings || 0) + 1,
      wins: (rivalRecord?.wins || 0) + (beat ? 1 : 0),
      losses: (rivalRecord?.losses || 0) + (beat ? 0 : 1),
      heat: heatAfter,
    };
    const drama = rivalDrama({ beat, gapSec, rivalName: rivalEntrant.name, rivalRank: rivalEntrant.rank, myRank: me.rank, heatBefore, heatAfter });
    // v36(#6): 性格ベースの会話ドラマ（紙芝居/VN風）。ライバルの性格で掛け合いを生成
    const dialogue = rivalDialogue({ rival: s.rival, beat, gapSec, heatAfter, playerName: s.player.name, seed: s.year * 137 + s.month * 7 + me.rank });
    // v36修正: 接戦（8秒未満）か因縁が深まった時（heat≥4）だけ、返答を選べる双方向の対話シーンを用意。
    // 毎戦だと冗長なので"見せ場"に限定する。
    const sceneWorthy = Math.abs(gapSec) < 8 || heatAfter >= 4;
    const scene = sceneWorthy ? rivalScene({ rival: s.rival, beat, gapSec, heatAfter, playerName: s.player.name, seed: s.year * 137 + s.month * 7 + me.rank, record: s.rivalRecord, big: !!(race.milestone || race.monument || race.grade >= 4) }) : null;
    rivalOutcome = { name: rivalEntrant.name, rank: rivalEntrant.rank, beat, line: drama.line, promoted: drama.promoted, tierLabel: drama.tier.label, tierColor: drama.tier.color, dialogue, scene };
  }
  // v26: 複数ライバル制。2人目の好敵手は初対戦時だけ「新たな好敵手が現れた」という
  // 紹介フレーバーを付ける
  let rivalRecord2 = s.rivalRecord2;
  let rivalOutcome2 = null;
  let rival2Intro = false;
  if (rival2Entrant) {
    const isFirstMeeting = (rivalRecord2?.meetings || 0) === 0;
    const beat2 = me.rank < rival2Entrant.rank;
    const gap2 = Math.abs((me.finishTime || 0) - (rival2Entrant.finishTime || 0));
    const heat2Before = rivalRecord2?.heat ?? rivalRecord2?.meetings ?? 0;
    const heat2After = heat2Before + rivalMeetingHeat(gap2);
    rivalRecord2 = {
      meetings: (rivalRecord2?.meetings || 0) + 1,
      wins: (rivalRecord2?.wins || 0) + (beat2 ? 1 : 0),
      losses: (rivalRecord2?.losses || 0) + (beat2 ? 0 : 1),
      heat: heat2After,
    };
    const drama2 = rivalDrama({ beat: beat2, gapSec: gap2, rivalName: rival2Entrant.name, rivalRank: rival2Entrant.rank, myRank: me.rank, heatBefore: heat2Before, heatAfter: heat2After });
    const dialogue2 = rivalDialogue({ rival: s.rival2, beat: beat2, gapSec: gap2, heatAfter: heat2After, playerName: s.player.name, seed: s.year * 149 + s.month * 11 + me.rank });
    rivalOutcome2 = { name: rival2Entrant.name, rank: rival2Entrant.rank, beat: beat2, line: drama2.line, promoted: isFirstMeeting ? null : drama2.promoted, tierLabel: drama2.tier.label, tierColor: drama2.tier.color, dialogue: dialogue2 };
    rival2Intro = isFirstMeeting;
  }
  let log = newlyHit.length > 0
    ? [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】人気度が${newlyHit.join("・")}に到達し、個人スポンサー契約で+${popBonus}万円`]
    : s.log;
  if (rival2Intro) log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】${rival2Entrant.teamName}の${rival2Entrant.name}と初めて同じレースで相まみえた。新たな好敵手になりそうだ`];
  // v35(D 物語): 因縁度が上がった瞬間はログにも刻む（決定的な一戦の記録）
  if (rivalOutcome && rivalOutcome.promoted) log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】${rivalOutcome.promoted.replace(/^——/, "")}`];
  if (rivalOutcome2 && rivalOutcome2.promoted) log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】${rivalOutcome2.promoted.replace(/^——/, "")}`];
  // v30: 世界ランキング更新＆キャリア・アンビション判定
  // v51(第11弾Phase2・2-C): riderStats（このレースのAI参加者分も含む）を先に更新し、
  // その実データに対する自分の実順位を出す（旧computeWorldRank(points,year)は他人を
  // 一切参照しない張りぼてだった。devlog/wave11.md Phase2参照）。
  const classMul = CLASSES[s.classIdx].prizeMul;
  const riderStats = mlUpdateRiderStats(s.riderStats, sim.ranked, new Set([...(s.teammates || []).map(t => t.id), ...(s.protege ? [s.protege.id] : [])]), s.year, race.grade, classMul);
  const wpGain = worldPointsForFinish(me.rank, race.grade, classMul);
  const worldPoints = (s.worldPoints || 0) + wpGain;
  // 第18弾: 共闘した僚友（チームメイト・弟子）との絆を更新
  const bonds = mlBondsAfterRace(s.bonds, s, sim, { podium: me.rank <= 3, assist: assistChosen });
  const worldRank = computeWorldRank(riderStats, worldPoints);
  const worldRankBest = s.worldRankBest == null ? worldRank : Math.min(s.worldRankBest, worldRank);
  const careerWins = (s.careerWins || 0) + (me.rank === 1 ? 1 : 0);
  const careerPodiums = (s.careerPodiums || 0) + (me.rank <= 3 ? 1 : 0);
  const careerBigWins = (s.careerBigWins || 0) + (me.rank === 1 && race.grade >= 3 ? 1 : 0);
  const careerTitles = (s.careerTitles || 0) + (me.rank === 1 && race.milestone ? 1 : 0);
  const careerClassics = (s.careerClassics || 0) + (me.rank === 1 && race.monument ? 1 : 0); // v33.11: モニュメント制覇数
  let ambitionIdx = s.ambitionIdx || 0;
  let ambitionDone = s.ambitionDone || [];
  let ambitionCleared = null;
  let ambMoney = 0;
  // 判定は更新後の到達値で行う（順位・通算勝利・アシスト出走数等を反映した一時ビュー）
  const progressedMl = { ...s, player, worldRank, careerWins, careerPodiums, careerBigWins, careerTitles };
  const curAmb = mlCurrentAmbition(progressedMl); // 現在の路線・段の目標
  if (curAmb && mlAmbitionCleared(progressedMl, curAmb)) {
    const rw = applyAmbitionReward(curAmb.reward, player, 0);
    ambMoney = rw.money;
    ambitionCleared = { label: curAmb.label, rewardText: rw.text };
    ambitionIdx = ambitionIdx + 1;
    ambitionDone = [...ambitionDone, curAmb.key];
    log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】🎯アンビション「${curAmb.label}」を達成！（${rw.text}）`];
  }
  // v33.8: 献身の走りの成果。支えたエースが上位に入れば名アシストとして評価・人気・報酬が上乗せされる
  // v48(第10弾): 表彰台(3位以内)でしか報われない一段階のゲートは実測で「ほぼ発火しない」状態
  // だった（エースの表彰台率は能力帯によって1〜5割）。惜しかった健闘（上位10位）にも小さな
  // 見返りを置く2段階へ改める（詳細はDEVLOG §41／devlog/wave10.md）。
  let assistOutcome = null, assistPop = 0, assistEval = 0, assistMoney = 0;
  if (sim.assistedAce) {
    // v39.4修正: エースの着順は最終ランキング（判断カードの再計算後）から引き直す。
    // 従来は buildMyLifeSim 時点のsnapshot rankを使っており、レース中の判断で順位が変わると
    // 「アシストの自分が1位なのにエースも1位」等の食い違いが起きていた。
    const aceEntrant = sim.ranked.find(e => e.id === sim.assistedAce.id);
    const ar = aceEntrant ? aceEntrant.rank : sim.assistedAce.rank;
    const success = ar <= 3;
    const solid = !success && ar <= 10;
    assistOutcome = { name: sim.assistedAce.name, rank: ar, success };
    if (success) {
      assistPop = ar === 1 ? 3 : 2; assistEval = ar === 1 ? 5 : 3; assistMoney = ar === 1 ? 40 : 20;
      log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】🤝 あなたの献身の牽引でエース${sim.assistedAce.name}が${ar}位！名アシストとして称えられた（人気+${assistPop}・評価+${assistEval}・+${assistMoney}万円）`];
    } else if (solid) {
      assistPop = 0.5; assistEval = 1; assistMoney = 5;
      log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】🤝 エース${sim.assistedAce.name}を最後まで牽引し${ar}位。表彰台には届かなかったが堅実な仕事ぶりが評価された（評価+${assistEval}・+${assistMoney}万円）`];
    } else {
      log = [...log, `【${s.year}年目 ${MONTHS[s.month]}】🤝 エース${sim.assistedAce.name}を最後まで牽引したが${ar}位。報われない走りになった`];
    }
  }
  if (assistPop) player.popularity = Math.max(0, Math.min(100, player.popularity + assistPop));
  // v36(#7): 大勝・連勝を「号外」として演出（値するときだけnon-null）
  const newspaper = mlNewspaper({ player, race, rank: me.rank, careerWins, worldRank, year: s.year, month: s.month });
  return {
    ...s, player, points: s.points + pts, log,
    managerEval: Math.max(0, Math.min(100, s.managerEval + evalDelta + assistEval)),
    money: s.money + prize + popBonus + ambMoney + assistMoney, rivalRecord, rivalRecord2,
    worldPoints, worldRank, worldRankBest, careerWins, careerPodiums, careerBigWins, careerTitles, careerClassics,
    ambitionIdx, ambitionDone,
    // v37: 永続キャラ（ライバル／チームメイト）の成績台帳を更新（上でworldRank算出のため既に計算済み）
    riderStats,
    bonds, // 第18弾: 僚友との絆
    resultInfo: { race, rank: me.rank, total: sim.ranked.length, pts, directive, fulfilled, evalDelta, prize, rivalOutcome, rivalOutcome2, rival2Intro, popGain: Math.round(popGain * 10) / 10, popBonus, courseRecord, natRole, natFulfilled, natPopBonus, wpGain, worldRank, worldRankPrev: s.worldRank, ambitionCleared, assistOutcome, milestoneWin,
      // v34(UI): レース後サマリーの整理。フィニッシュタイム・トップとの差・下馬評の答え合わせ。
      finishTime: me.finishTime, gapSec: me.rank === 1 ? 0 : (me.finishTime - winner.finishTime),
      forecast: (() => { const fc = raceForecast(sim.entrants, race.tmpl?.favors); const my = fc.get(me); return my ? { rank: my.rank, mark: my.mark ? my.mark.label : "無印", markColor: my.mark ? my.mark.color : "#9aa3b5" } : null; })(),
      newspaper, standings },
    screen: "mylife_result",
  };
}

// v37: マイライフのチームTTは「チームの順位」で結果を出す（個人simへ落とさない）。
export function mlFinishTeamTT(s, sim, race) {
  const teams = sim.teamTT;
  const playerTeam = teams.find(t => t.isPlayer);
  const teamRank = playerTeam ? playerTeam.rank : teams.length;
  const totalTeams = teams.length;
  const pts = Math.round((PTS[teamRank - 1] || 0) * GRADE_MUL[race.grade]);
  const prize = Math.round((PRIZES[teamRank - 1] || 1) * (0.4 + s.classIdx * 0.25) * 2.4);
  const baseTime = teams[0].time;
  const teamStandings = teams.map(t => ({
    rank: t.rank, name: t.teamName || t.team, isPlayer: !!t.isPlayer,
    time: t.time, gap: t.time - baseTime,
    riders: (t.riders || []).map(r => r.name),
  }));
  const player = { ...s.player, raceLog: [...(s.player.raceLog || []), { year: s.year, month: s.month, name: race.name, rank: teamRank, role: "tt", segMix: segMixOfRace(race) }] };
  const wpGain = worldPointsForFinish(teamRank, race.grade, CLASSES[s.classIdx].prizeMul);
  const worldPoints = (s.worldPoints || 0) + wpGain;
  const worldRank = computeWorldRank(s.riderStats, worldPoints);
  const worldRankBest = s.worldRankBest == null ? worldRank : Math.min(s.worldRankBest, worldRank);
  const careerPodiums = (s.careerPodiums || 0) + (teamRank <= 3 ? 1 : 0);
  return {
    ...s, player, points: s.points + pts, money: s.money + prize,
    worldPoints, worldRank, worldRankBest, careerPodiums,
    resultInfo: { race, teamTT: true, teamRank, totalTeams, pts, prize, teamStandings, wpGain, worldRank, worldRankPrev: s.worldRank },
    screen: "mylife_result",
  };
}

// v27: ラストレース演出の結果確定。mlRecordLegend（殿堂記録）はここで呼ばず、
// "mylife_retired"画面への遷移を検知するApp()側のuseEffect（既存のmlClearAwardedRefイディオム）
// に一本化した（詳細はDEVLOG §9参照）。
export function mlLastRaceFinish(s) {
  const sim = s.result;
  const me = sim.ranked.find(e => e.isPlayerChar);
  const rank = me ? me.rank : sim.ranked.length;
  const total = sim.ranked.length;
  const flavor = rank === 1 ? "最後のレースを、なんと勝利で締めくくった！最高の花道だ。"
    : rank <= 3 ? "最後のレースで堂々の表彰台。見事な有終の美を飾った。"
    : rank <= 10 ? "最後まで集団に食らいつき、力を出し切って走り抜けた。"
    : "結果は振るわなかったが、最後まで自分の走りを貫いた。悔いはない。";
  // ラストレースの戦績も通算記録に含めてから殿堂入りさせる
  const player = { ...s.player, raceLog: [...(s.player.raceLog || []), { year: s.year, month: s.month, name: sim.raceMeta.name, rank, role: "ace", segMix: segMixOfRace(sim.raceMeta) }] };
  return {
    ...s, player, inLastRace: false, result: null,
    lastRaceResult: { rank, total, flavor, name: sim.raceMeta.name },
    screen: "mylife_retired",
    log: [...s.log, `【${s.year}年目 ${MONTHS[s.month]}】ラストレースで${rank}位。${player.age}歳で現役を退いた`],
  };
}
