// レース1本分のシミュレーション構築（自チーム＋相手チームの生成・ティック実行）。
// 第13弾Phase0でlogic/support.jsから分離。sim層はdomain層に依存できないため、
// buildSimが内部で使うgroupModeFor/teamChemistryTierもここに同居させる
// （domain/season/achievements.js・domain/season/rival.js等はここからimportする側）。
import { aiFormRoll, idYearSeed, mulberry, newRider } from "../core/core.js";
import { CHEMISTRY_TIERS, DIFFICULTIES } from "../data/progression.js";
import { VENUE_REGION } from "../data/course.js";
import { T } from "../data/theme.js";
import { teamsForClass } from "../state/state.js";
import { aiPowerFor } from "../domain/shared/scouting.js";
import { AI_STYLES, assignAIRoles, computeTeamTT, effAbilities, generateCourse, rankSim, simulateTicks } from "./race.js";

export function groupModeFor(squadN) {
  if (squadN === 1) return "solo";
  if (squadN === 2) return "pelotonOnly";
  return "full";
}

export function raceIsHome(race, homeRegion) {
  return !!(homeRegion && race && race.venue && VENUE_REGION[race.venue] === homeRegion);
}

export function teamChemistryTier(squad) {
  const avg = (!squad || squad.length === 0) ? 0 : squad.reduce((s, r) => s + (r.tenure || 0), 0) / squad.length;
  const tier = CHEMISTRY_TIERS.find(t => avg >= t.min);
  return { ...tier, avgTenure: avg };
}

// v50(第11弾Phase1・1-A/1-B): entryTeamsは「このレースに実際に登録されたチーム」の配列
// （domain/season/entryPlan.jsのraceEntryPlan()の結果をteam定義オブジェクトへ解決したもの）。
// 省略時はteamsForClass(classIdx)（そのクラスの全チーム）にフォールバックする。
export function buildSim(raceMeta, squad, aceId, roles, equip, itemBoost, classIdx, fixedAiTeams, dayTag, directive, difficultyId, rivalAlumni, dynastyLevel, teamName, rivalRosters, year, entryTeams) {
  // v13: 難易度による他チームの強さ補正（aiMul）。省略時はnormal相当
  const diffDef = DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1];
  const diffAiMul = diffDef.aiMul;
  const aiCap = diffDef.abilCap ?? 94; // v35(バランス): 難易度別のAI能力上限（hard/oniは94超）
  // v25: グランファイナル制覇後の周回（ディナスティ）モード。周を重ねるたびに他チームの
  // 地力を底上げし、周回プレイでも歯応えが保たれるようにする
  const dynastyBonus = Math.min(20, (dynastyLevel || 0) * 5);
  const course = generateCourse(raceMeta, dayTag);
  const groupMode = groupModeFor(squad.length);
  const riders = [];
  const chemTier = teamChemistryTier(squad);
  squad.forEach(r => {
    const e = effAbilities(r, equip, itemBoost, raceMeta.grade, raceMeta.weather, raceMeta.monument);
    const role = roles[r.id] || "lead";
    riders.push({
      id: r.id, name: r.name, type: r.type, abilities: r.abilities, age: r.age, chemMul: chemTier.mul, ...e,
      team: "PLAYER", teamName: teamName || "あなたのチーム", color: T.color.accent,
      isAce: r.id === aceId, role,
    });
  });
  let aiTeamsUsed;
  if (fixedAiTeams) {
    aiTeamsUsed = fixedAiTeams;
    fixedAiTeams.forEach(list => list.forEach(en => riders.push({ ...en })));
  } else {
    const rng = mulberry(Date.now() % 999983);
    const power = aiPowerFor(52, classIdx, raceMeta.grade, diffAiMul, (raceMeta.championship ? 6 : 0) + dynastyBonus);
    // v12: 相手チームの出走人数は自チームの選択人数に連動させず、レース規定の範囲内で
    // チームごとに独立して決める（毎回同じ人数になる不自然さを解消）
    const { squadMin, squadMax } = raceMeta.tmpl;
    // v12バグ修正: 同じレース内で自チーム・他チームの選手が名前被りしないよう、
    // 自チームの名前を最初に登録した「使用済み」集合を全チームで共有しながら生成する
    const nameBanned = new Set(squad.map(r => r.name));
    // v46(#23): 出走人数の下限を3へ引き上げ（従来1〜5でチームごとに大きく揺れていた）。
    // squadMin===squadMaxのレース（個人TT=1名固定・チームTT=4〜6名）はこの下限の対象外。
    const aiMinFloor = squadMin === squadMax ? squadMin : Math.min(squadMax, Math.max(squadMin, 3));
    const teamsInThisRace = (entryTeams && entryTeams.length) ? entryTeams : teamsForClass(classIdx);
    aiTeamsUsed = teamsInThisRace.map(d => {
      const aiSquadNRaw = squadMin === squadMax ? squadMin : aiMinFloor + Math.floor(rng() * (squadMax - aiMinFloor + 1));
      // v13.1: 解雇後にこのチームへ拾われた元自チーム選手がいれば、実際の能力のまま
      // 優先的に出走させる（フルの新規生成ではなく実データを引き継ぐ）
      const alumni = (rivalAlumni || []).filter(a => a.signedTeam === d.name).slice(0, aiSquadNRaw);
      const alumniIds = new Set(alumni.map(a => a.id));
      const members = alumni.map(a => ({ ...a }));
      // v38: 永続ライバルロースターから同じ顔ぶれを出走させる（identity固定・stats は id＋year で
      // シードして年内安定・power で文脈スケール）。従来は毎レース使い捨て生成で「同じチーム名でも
      // 毎回別人」だったため、宿敵が育つ感覚も相手の通算成績も追えなかった。マイライフと同じ根治。
      const roster = rivalRosters && rivalRosters[d.name];
      // v46(#23): ロースターが実在するチームは、出走人数をロースターの実在人数（＋alumni）まで
      // 絞る。旧来はここで埋まらない枠を毎レース使い捨ての新規選手で埋めていたため、
      // 引き抜き等で欠員が出ると「毎回別人が現れる」不具合になっていた。ロースター自体が
      // 無い場合（rivalRosters欠落の旧セーブ）だけ、従来どおりその場生成で補う。
      const hasRoster = !!(roster && roster.length);
      const aiSquadN = hasRoster ? Math.min(aiSquadNRaw, alumni.length + roster.length) : aiSquadNRaw;
      if (hasRoster) {
        roster.slice(0, Math.min(aiSquadN, roster.length)).forEach(wr => {
          if (members.length >= aiSquadN) return;
          if (alumniIds.has(wr.id)) return; // 既にalumniで出走している選手は重複させない
          const st = newRider(power + (wr.baseline || 0), idYearSeed(wr.id, year), { type: wr.type, cap: aiCap, banned: nameBanned });
          st.id = wr.id; st.name = wr.name; st.type = wr.type; st.personality = wr.personality || st.personality;
          if (wr.abilities) st.abilities = wr.abilities;
          st.goldAbilities = wr.goldAbilities || [];
          st.growthPow = wr.growthPow || st.growthPow;
          members.push(st);
        });
      } else {
        // v35(シーズン深掘り): ロースターが無い旧セーブ用のフォールバック。チームの個性（spec）に
        // 沿って補完する。エースは必ずその脚質、他メンバーも過半数がその脚質に寄る
        for (let i = members.length; i < aiSquadN; i++) {
          const useSpec = d.spec && (i === 0 || rng() < 0.55);
          members.push(newRider(power + (i === 0 ? 6 : 0), rng, { banned: nameBanned, cap: aiCap, type: useSpec ? d.spec : undefined }));
        }
      }
      const aiRoles = assignAIRoles(members, aiSquadN);
      // v12: チームごとに隠しの戦略スタイルを割り当て、レース展開にばらつきを持たせる
      const aiStyle = AI_STYLES[Math.floor(rng() * AI_STYLES.length)];
      return members.map((r, i) => {
        // v29: AI相手もプレイヤーと同じeffAbilitiesを通し、体格(パワーウェイト)・調子・大舞台適性・
        // 加速力・メンタルなどの副次補正が相手選手にも効くようにする（天候補正もこの中で処理）
        // v48(第10弾続き): 土台の能力値はid+年で固定（安定）、当日の調子（form）は毎レース振り直す。
        r.form = aiFormRoll(rng);
        const e = effAbilities(r, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
        return {
          id: r.id, name: r.name, type: r.type, abilities: r.abilities, goldAbilities: r.goldAbilities, age: r.age, ...e,
          team: d.name, teamName: d.name, color: d.color, isAce: i === 0, role: aiRoles[r.id], aiStyle,
          isAlumnus: alumniIds.has(r.id),
        };
      });
    });
    aiTeamsUsed.forEach(list => list.forEach(en => riders.push({ ...en })));
  }
  const sim = { entrants: riders, riders, course, groupMode, raceMeta, breakSurvived: false };
  const roleMap = {}; riders.forEach(en => { roleMap[en.id] = en.role; });
  // v35(チームTT): チームタイムトライアルは集団シミュレーションではなく、チーム単位の合算タイム。
  // ペロトンのsimulateTicksは走らせず、TT地力・人数・ケミストリーからチーム時間を算出する。
  if (raceMeta.tmpl && raceMeta.tmpl.teamTT) {
    computeTeamTT(sim, chemTier.mul);
    sim.hadBreak = false;
    return { sim, aiTeams: aiTeamsUsed };
  }
  // v12: 無線指示の廃止に伴い、作戦（chaseMode/aceEarly）は出走前に決定済みのものをそのまま渡す
  // v39(A案): レース中の判断カードでfromTickから再計算するため、作戦（directive）をsimに保持する
  sim.directive = directive || { chaseMode: "normal", aceEarly: false };
  sim.difficulty = difficultyId; // v39.18: 難易度で判断カードの一手の効きを変える
  simulateTicks(course, riders, 0, sim.directive, groupMode === "solo");
  rankSim(sim);
  // 逃げ切り判定（表示用）：エントラント中に逃げ役がいて、ゴール時点でメイン集団と別グループのままか
  const breakers = riders.filter(en => en.role === "breakaway");
  sim.hadBreak = breakers.length > 0;
  if (sim.hadBreak) {
    const lastTickIdx = Math.max(...riders.map(en => en.groupHist.length - 1));
    const finalGroups = new Set(riders.map(en => en.groupHist[Math.min(lastTickIdx, en.groupHist.length - 1)]));
    const breakGroupIds = new Set(breakers.map(en => en.groupHist[Math.min(lastTickIdx, en.groupHist.length - 1)]));
    const others = riders.filter(en => en.role !== "breakaway");
    sim.breakSurvived = others.length > 0 && others.every(en => !breakGroupIds.has(en.groupHist[Math.min(lastTickIdx, en.groupHist.length - 1)]));
  }
  return { sim, aiTeams: aiTeamsUsed };
}
