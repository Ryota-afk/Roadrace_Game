// マイライフのレース1本分のシミュレーション構築（自分＋チームメイト＋対戦AIの生成・ティック実行）。
// state/state.js から分離（第15弾F）。シーズン側の対になる関数はsim/buildSim.jsにあり、
// 同じ役割の関数が別レイヤーに分かれていた非対称を解消する（第14弾37番のバグの遠因だった）。
import { AB_KEYS, ML_TYPE_CAP_OFFSET } from "../data/abilities.js";
import { DIFFICULTIES, ML_TACTICS } from "../data/progression.js";
import { MYLIFE_TEAMS, teamsForClass } from "../data/teams.js";
import { T } from "../data/theme.js";
import { SUB_STAT_KEYS, aiFormRoll, idYearSeed, mulberry, newRider } from "../core/core.js";
import { AI_STYLES, assignAIRoles, computeTeamTT, effAbilities, generateCourse, rankSim, simulateTicks } from "./race.js";
import { aiPowerFor, mlAiCapFor } from "../domain/shared/scouting.js";
import { loadMlLegends } from "../breeding/breeding.js";
import { avgBondFor } from "../domain/mylife/bonds.js";
import { INTENSITY_AIMUL } from "../domain/mylife/intensity.js";

// 第16弾A: ライバルの強さは年齢の山なりで変化する（世界のロースターと同じ「全盛期が最も強い」
// 発想）。従来は生成時の年齢によらず常にpower+6の固定強度だったため、世界の300名が世代交代する
// 中でライバルだけが不老不死だった。全盛期(24〜31歳)の値は既存の+6のまま据え置き、それ以外の
// 年齢帯だけ変化させる（バランスの中心は動かさない）。
// sim層はdomain/season/rival.jsを参照しない（依存の一方向を保つため）ため、ここに直接置く。
function rivalPowerBonus(rival) {
  const age = rival.age != null ? rival.age : 26;
  if (age <= 23) return 3;       // 若手：まだ粗い
  if (age <= 31) return 6;       // 全盛期：既存と同じ
  if (age <= 34) return 4;       // 陰り
  return 1;                      // 最晩年：それでも並のAIよりは強い
}

export function buildMyLifeSim(raceMeta, player, myTeamName, classIdx, difficultyId, dayTag, directiveKey, rival, year, rival2, teammates, tactic, worldRosters, protege, bonds, intensity, seed) {
  const diffDef = DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1];
  // 第99弾(devlog/wave99.md): 「本気度」——このレースだけ相手チームを本気にさせるつまみ。
  // aiMulにだけ加算し、abilCap（AI能力の上限）は変えない＝「同じ顔ぶれが本気を出す」という
  // 意味論を保つ（上限まで変えると「もっと強い集団と差し替える」になり別の意味になる）。
  const diffAiMul = diffDef.aiMul + (INTENSITY_AIMUL[intensity] || 0);
  // v38(#6): マイライフのAI能力上限を難易度で引き上げる。従来は easy/normal/hard がどれも94上限で
  // 実質同強度になり、能力を極めた終盤（100超）に対して hard でも相手が頭打ちで無双できた。
  // hard=102/oni=112 まで許容し、極まった選手にも歯応えが残るようにする（season側のDIFFICULTIESは不変）。
  const aiCap = mlAiCapFor(difficultyId, diffDef.abilCap);
  // 第31弾: newRider内部で脚質ごとの能力の形が付くのに上限が全能力へ一律にかかっていたため、
  // 上限が効く場面（高クラス・高グレード）で得意能力だけ切り落とされ苦手はそのまま残る
  // ＝AIが万能型に見える不具合があった。プレイヤー用のML_TYPE_CAP_OFFSET（第29弾）を
  // そのまま共有し、cap がかかる全ての生成に一律で適用する（伝説選手はfinalAbilitiesで
  // 上書きされるため対象外。詳細はdevlog/wave31.md）。
  const course = generateCourse(raceMeta, dayTag);
  // 第99弾(devlog/wave99.md): 「本気度」を選び直すとintensityだけ変えてこの関数を呼び直す
  // （useMyLifeGame.jsのmlSetIntensity）。既定はDate.now()由来の非決定論的な乱数列だが、
  // その都度サイコロを振り直すと出走者の顔ぶれ（人数・チーム構成・当日の調子）まで
  // 毎回入れ替わってしまい、「同じ顔ぶれが本気を出す」というUIの前提が崩れる
  // （実測で確認済み：newRider内のrng消費量はpower＝本気度に依存しないため、seedさえ
  // 揃えれば顔ぶれ・年齢・成長タイプ・当日の調子の乱数列は完全に一致し、能力の基準値
  // （power）だけが動く）。seed省略時（通常のレース開始）は従来どおりDate.now()を使う。
  const rng = mulberry((seed != null ? seed : Date.now()) % 999983);
  // v47(第7弾C): yearBonus（経過年数だけでAIの地力を底上げする一律ボーナス、最大+24）を廃止した。
  // 「新世代の台頭」という同じ役割は既にageWorldRosters()が本物として実装済み（各選手が加齢し、
  // ピークまで伸び、その後衰え、33〜38歳で引退してルーキーに置き換わる）。yearBonusはこれと同じ
  // 役割の雑な二重実装で、①プレイヤーから見えない②自チームの僚友も同率で強化してしまう
  // ③aiCapに吸収される④17年で頭打ち、という欠陥があった。年次の手応えは、以降ワールドロースター
  // 自身の世代交代（baseline経由の個体差）だけから生まれる（詳細はDEVLOG §38参照）
  const power = aiPowerFor(50, classIdx, raceMeta.grade, diffAiMul);
  const { squadMin, squadMax } = raceMeta.tmpl;
  const nameBanned = new Set([player.name]);
  const riders = [];
  const playerEff = effAbilities(player, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
  // v50(第11弾Phase1・1-A): 対戦相手はteamsForClass(classIdx)（今のクラスのチームだけ）に絞る。
  // ただしMyLifeのclassIdxは所属チームのtierとは独立に動く（tier0のチームに居たままクラスAへ
  // 昇格し得る）ため、自チーム・ライバル1・ライバル2の所属チームはクラスが違っても必ず含める
  // （でないと自チームが出走できない・ライバルと一生出会えなくなる）。
  const classTeams = teamsForClass(classIdx);
  const classTeamNames = new Set(classTeams.map(d => d.name));
  const extraTeamNames = new Set([myTeamName, rival && rival.team, rival2 && rival2.team].filter(n => n && !classTeamNames.has(n)));
  const raceTeams = [...classTeams, ...[...extraTeamNames].map(n => MYLIFE_TEAMS.find(d => d.name === n)).filter(Boolean)];
  // v32（世界の統合）：歴代殿堂選手を、AIチームのエース枠に一定確率で紛れ込ませる。
  // 過去の自分やライバルの血を引く名選手たちと、同じレースで再会できる。
  const legendPool = loadMlLegends().filter(l => l && l.finalAbilities);
  const legendTeams = {}; // teamName -> legend
  if (legendPool.length > 0) {
    const nLeg = rng() < 0.55 ? (rng() < 0.35 ? 2 : 1) : 0;
    const otherTeams = raceTeams.filter(d => d.name !== myTeamName && !(rival && d.name === rival.team) && !(rival2 && d.name === rival2.team));
    const shuffled = [...legendPool].sort(() => rng() - 0.5).slice(0, nLeg);
    const teamsForLeg = [...otherTeams].sort(() => rng() - 0.5).slice(0, nLeg);
    shuffled.forEach((leg, i) => { if (teamsForLeg[i]) legendTeams[teamsForLeg[i].name] = leg; });
  }
  // v51(第11弾Phase2・2-D): 世界ランキング上位スターをAIチームのエース枠へ差し替える仕組み
  // （worldStarTeams）は廃止した。永続ワールドロースター（worldRosters）の各チーム先頭
  // （baseline最大＝実質エース）が既にその役割を果たしており、二重実装だった上、
  // 差し替えのたびにnewRider()で新idを振っていたため世界スター自身の通算成績が
  // 一切積まれない不具合があった（devlog/wave11.md Phase2参照）。
  let assistedAceRef = null; // v33.8: アシスト宣言時に献身で押し上げた自チームのエース
  // 第84弾: チームTT(computeTeamTT)は自チームのchemMulをループ外から参照する必要があるため、
  // ループ内(isMyTeam時)で確定した値をここへ巻き上げる。従来はcomputeTeamTT(sim, 1)と
  // ハードコードされており、マイライフのチームTTだけ絆(結束)が結果に一切反映されていなかった
  // （シーズン側のbuildSim.jsはchemTier.mulを渡している。devlog/wave84.md参照）。
  let playerChemMul = 1;
  // v46(#23): 出走人数の下限を3へ引き上げ（従来1〜5でチームごとに大きく揺れていた）。
  // squadMin===squadMaxのレース（個人TT=1名固定・チームTT=4〜6名）はこの下限の対象外。
  const aiMinFloor = squadMin === squadMax ? squadMin : Math.min(squadMax, Math.max(squadMin, 3));
  raceTeams.forEach(d => {
    const isMyTeam = d.name === myTeamName;
    const aiSquadNRaw = squadMin === squadMax ? squadMin : aiMinFloor + Math.floor(rng() * (squadMax - aiMinFloor + 1));
    const members = [];
    let aiSquadN = aiSquadNRaw;
    // 第18弾: 実際に出走する僚友（＋弟子）の絆から結束（chemMul）を算出する。省略時・自チーム以外は
    // 従来通り無効果（chemMul=1）。
    let coRacedIds = [];
    // v32（固定チームメイト）：自分のチームは、保存済みの固定メンバーを現在の地力で登場させる
    if (isMyTeam && teammates && teammates.length) {
      // v38(#3): 弟子（プロテジェ）を自チームの1枠として実際にレースへ出す。従来は数値が育つだけで
      // レースにも同チームにも現れず「本当に数字だけ」だった。弟子は現在のOVR（curOvr）で地力が決まり、
      // 育つほど強く出走する。id/名前/脚質を固定＝成績台帳にも積まれる（isProtege マーク）。
      // v38修正: プレイヤー本人はこのあと別途 riders に追加されるため、自チームのチームメイト枠は
      // 「aiSquadN - 1」に抑える。従来は members を aiSquadN 個作った上にプレイヤーを足していたため、
      // 自チームだけ他チームより1人多くなっていた（＝自チームだけ人数が多い問題）。
      const memberTarget = Math.max(0, aiSquadN - 1);
      const protegeSlot = (protege && protege.id != null && memberTarget >= 1) ? 1 : 0;
      const tmSlots = Math.max(0, memberTarget - protegeSlot);
      coRacedIds = [...teammates.slice(0, tmSlots).map(tm => tm.id), ...(protegeSlot ? [protege.id] : [])];
      // v48(第10弾続き): 固定メンバーの土台をworldRostersと同じid+年シードへ揃える。
      // 従来はここだけ毎レース非決定論的なrngで再ロールしており、「毎回同じ顔ぶれなのに
      // 能力だけ毎回変わる」という食い違いになっていた（詳細はDEVLOG §41／devlog/wave10.md）。
      // v49(第11弾続き): teammatesはworldRosters[team]由来（mlTeammatesFromRoster）になり、
      // 各自baselineを持つ（ageWorldRosters()で年次に加齢/成長衰えが反映される）。以前は
      // 先頭（＝もっとも強い1人）だけ固定+4する雑な近似だったが、実在のbaselineをそのまま
      // 使うことでAIチーム（worldRostersのelseブランチ）と同じ式に揃え、自チームにも
      // 成長・衰えが実際に効くようにする。
      teammates.slice(0, tmSlots).forEach((tm) => {
        const st = newRider(power + (tm.baseline || 0), idYearSeed(tm.id, year), { type: tm.type, banned: nameBanned, capOffset: ML_TYPE_CAP_OFFSET });
        st.id = tm.id; st.name = tm.name; st.type = tm.type; st.personality = tm.personality || st.personality;
        if (tm.abilities) st.abilities = tm.abilities;
        members.push(st);
      });
      if (protegeSlot) {
        const pOvr = protege.curOvr || protege.ovr0 || 55;
        const prng = idYearSeed(protege.id, year);
        const st = newRider(pOvr, prng, { type: protege.type, cap: aiCap, capOffset: ML_TYPE_CAP_OFFSET, banned: nameBanned });
        st.id = protege.id; st.name = protege.name; st.type = protege.type;
        st.personality = protege.personality || st.personality;
        if (protege.abilities) st.abilities = protege.abilities;
        st.isProtege = true;
        members.push(st);
      }
      for (let i = members.length; i < memberTarget; i++) members.push(newRider(power, rng, { banned: nameBanned, capOffset: ML_TYPE_CAP_OFFSET }));
    } else if (worldRosters && worldRosters[d.name] && worldRosters[d.name].length) {
      // v37: 永続ワールドロースターから同じ顔ぶれを出走させる（identityは固定・stats は文脈スケール）。
      // 各選手の stats は id＋year でシードして年内は安定、年が進むと power の上昇で強くなる。
      // v46(#23): 出走人数をロースターの実在人数まで絞る。旧来はここで埋まらない枠を毎レース
      // 使い捨ての新規選手で埋めていたため、引き抜き等で欠員が出ると「毎回別人が現れる」
      // 不具合になっていた（seasonのbuildSimと同根・同時に修正）。
      const roster = worldRosters[d.name];
      aiSquadN = Math.min(aiSquadNRaw, roster.length);
      roster.slice(0, aiSquadN).forEach(wr => {
        const st = newRider(power + (wr.baseline || 0), idYearSeed(wr.id, year), { type: wr.type, cap: aiCap, capOffset: ML_TYPE_CAP_OFFSET, banned: nameBanned });
        st.id = wr.id; st.name = wr.name; st.type = wr.type; st.personality = wr.personality || st.personality;
        if (wr.abilities) st.abilities = wr.abilities;
        st.goldAbilities = wr.goldAbilities || [];
        st.growthPow = wr.growthPow || st.growthPow;
        members.push(st);
      });
    } else {
      for (let i = 0; i < aiSquadN; i++) members.push(newRider(power + (i === 0 ? 6 : 0), rng, { banned: nameBanned, cap: aiCap, capOffset: ML_TYPE_CAP_OFFSET }));
    }
    const aiRoles = assignAIRoles(members, aiSquadN);
    const aiStyle = AI_STYLES[Math.floor(rng() * AI_STYLES.length)];
    // 第18弾: 実際に出走する僚友（チームメイト＋弟子）の絆の平均から結束を算出
    // （自チームのみ・絆0なら1=無効果。弟子はprotege.bond＝既存の指導で育つ絆を一本化して使う）
    const chemMul = isMyTeam ? 1 - (avgBondFor(bonds, coRacedIds, protege) / 100) * 0.08 : 1;
    if (isMyTeam) playerChemMul = chemMul;
    const teamEntrants = members.map((r, i) => {
      // v29: マイライフのAI相手もeffAbilitiesを通し、体格・調子・大舞台・加速力・メンタルを反映
      // v48(第10弾続き): 土台の能力値はid+年で固定した分、当日の調子（form）は毎レース振り直す。
      // プレイヤー本人のピーキング（±約17%）より控えめな幅（±5%程度、aiFormRoll参照）。
      r.form = aiFormRoll(rng);
      const e = effAbilities(r, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
      return {
        id: r.id, name: r.name, type: r.type, abilities: r.abilities, goldAbilities: r.goldAbilities, ...e,
        // v37: 自チームの選手は team を "PLAYER" に統一（プレイヤー本人と同じ）。これでチームTTの
        // チーム集計が自分＋チームメイトで正しくまとまり、集団simのエース同一チーム判定（牽引ペース
        // 合わせ）も効く。表示名 teamName は自チーム名のまま。
        team: isMyTeam ? "PLAYER" : d.name, teamName: d.name, color: d.color, isAce: i === 0, role: aiRoles[r.id], aiStyle,
        chemMul: isMyTeam ? chemMul : 1,
        isProtege: !!r.isProtege,
      };
    });
    if (rival && raceMeta.rivalPresent && d.name === rival.team && d.name !== myTeamName) {
      const rivalStats = newRider(power + rivalPowerBonus(rival), idYearSeed(rival.id, year), { type: rival.type, banned: nameBanned, cap: aiCap, capOffset: ML_TYPE_CAP_OFFSET });
      rivalStats.abilities = rival.abilities; rivalStats.goldAbilities = rival.goldAbilities;
      rivalStats.form = aiFormRoll(rng);
      const re = effAbilities(rivalStats, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
      teamEntrants[0] = {
        ...teamEntrants[0], ...re,
        id: rival.id, name: rival.name, type: rival.type, abilities: rival.abilities, goldAbilities: rival.goldAbilities,
        isRival: true,
      };
    }
    // v26: 複数ライバル制。2人目のライバル（好敵手）は別チームの出走枠を差し替える
    if (rival2 && raceMeta.rival2Present && d.name === rival2.team && d.name !== myTeamName) {
      const rival2Stats = newRider(power + rivalPowerBonus(rival2), idYearSeed(rival2.id, year), { type: rival2.type, banned: nameBanned, cap: aiCap, capOffset: ML_TYPE_CAP_OFFSET });
      rival2Stats.abilities = rival2.abilities; rival2Stats.goldAbilities = rival2.goldAbilities;
      rival2Stats.form = aiFormRoll(rng);
      const r2e = effAbilities(rival2Stats, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
      teamEntrants[0] = {
        ...teamEntrants[0], ...r2e,
        id: rival2.id, name: rival2.name, type: rival2.type, abilities: rival2.abilities, goldAbilities: rival2.goldAbilities,
        isRival2: true,
      };
    }
    // v32（世界の統合）：このチームに歴代殿堂選手が割り当てられていればエース枠に差し替える
    if (legendTeams[d.name] && !isMyTeam) {
      const leg = legendTeams[d.name];
      const legStats = newRider(power + 8, rng, { type: leg.type, banned: nameBanned, cap: aiCap });
      legStats.abilities = leg.specialAbilities || legStats.abilities;
      // v37: 過去選手（引退した殿堂選手）は全盛期より衰えて登場する。周回で殿堂が増えるほど
      // 全盛期のまま無限に湧いてインフレする問題を抑える（現役スター＝worldStarは対象外）。
      // 現役時OVRが高いレジェンドほど衰えも大きめ（LEGEND_DECAY_BASE〜。最低でも-8%）。
      const legOvr0 = leg.finalAbilities ? AB_KEYS.reduce((a, k) => a + (leg.finalAbilities[k] || 0), 0) / AB_KEYS.length : 70;
      const decay = Math.max(0.82, 0.92 - Math.max(0, legOvr0 - 80) * 0.006);
      AB_KEYS.forEach(k => { if (leg.finalAbilities && leg.finalAbilities[k] != null) legStats[k] = Math.round(leg.finalAbilities[k] * decay); });
      SUB_STAT_KEYS.forEach(k => { if (leg.finalSubStats && leg.finalSubStats[k] != null) legStats[k] = Math.round(leg.finalSubStats[k] * decay); });
      legStats.form = aiFormRoll(rng);
      const le = effAbilities(legStats, { frame: 0, wheels: 0, facility: 0 }, {}, raceMeta.grade, raceMeta.weather, raceMeta.monument);
      teamEntrants[0] = {
        ...teamEntrants[0], ...le,
        id: legStats.id, name: leg.name, type: leg.type, abilities: legStats.abilities, goldAbilities: legStats.goldAbilities,
        isLegend: true, legendTitle: leg.careerTitle || null,
      };
    }
    if (isMyTeam) {
      // v14.3: 監督指示が「エース」「アシスト／経験」であれば役割はそれに従って強制する。
      // 指示のない特別な区分（積極的な走り等）の場合のみ、従来通り能力比較で自動判定する
      const topAbility = Math.max(...teamEntrants.map(e => e.flat + e.climb + e.sprint + e.stamina + e.solo));
      const playerTotal = playerEff.flat + playerEff.climb + playerEff.sprint + playerEff.stamina + playerEff.solo;
      const tac = ML_TACTICS[tactic] || ML_TACTICS.balanced;
      let playerIsAce;
      // v33.6: 「アシストに徹する」を選べば監督指示に関わらず献身役に固定できる（献身の道の運ゲー解消）
      if (tac.playerAssist) playerIsAce = false;
      else if (directiveKey === "ace") playerIsAce = true;
      else if (directiveKey === "support" || directiveKey === "experience") playerIsAce = false;
      else playerIsAce = playerTotal >= topAbility;
      if (playerIsAce) teamEntrants.forEach(e => { e.isAce = false; });
      // v48(第10弾): アシストに徹する＝チームのエース（先頭のチームメイト）を献身で支える。
      // 従来はここでエースの能力値を出走前に直接書き換えていた（+boost、下限をplayerEff-gapまで
      // 引き上げ、99で頭打ち）が、これは実際のレース内容と無関係な作り話だった。第10弾でsim側に
      // 実在の風除け（チームドラフト、simulateTicks参照）を新設したため、ここでは
      // 「誰が押し上げ対象か」だけを覚えておく（結果画面の献身報酬判定に使う）。
      if (tac.playerAssist && !playerIsAce) {
        const ace = teamEntrants.find(e => e.isAce);
        if (ace) assistedAceRef = ace;
      }
      // v32（条件付き作戦）：早めに逃げる作戦なら、プレイヤーを逃げ要員として飛び出させる
      const playerRole = tac.playerBreakaway ? "breakaway" : (playerIsAce ? "lead" : "sub");
      riders.push({
        id: player.id, name: player.name, type: player.type, abilities: player.abilities, goldAbilities: player.goldAbilities, ...playerEff,
        team: "PLAYER", teamName: myTeamName, color: T.color.accent,
        isAce: playerIsAce, role: playerRole, isPlayerChar: true,
        // v35: アシストに徹する選手は脚を賢く使い自滅しない（energyDrainで消耗軽減）
        isAssisting: !!(tac.playerAssist && !playerIsAce),
        chemMul, // 第18弾: 僚友との絆から算出した結束
      });
    }
    teamEntrants.forEach(en => riders.push(en));
  });
  const sim = { entrants: riders, riders, course, groupMode: raceMeta.tmpl?.soloTT ? "solo" : "full", raceMeta, breakSurvived: false };
  // v37: チームTTはペロトンではなくチーム単位の合算タイム。マイライフでも「個人の順位」ではなく
  // 「チームの順位」で結果を出す（従来は teamTT 未対応で個人simへ落ちて個人リザルトになっていた）。
  if (raceMeta.tmpl && raceMeta.tmpl.teamTT) {
    computeTeamTT(sim, playerChemMul);
    sim.hadBreak = false;
    return sim;
  }
  // v32（条件付き作戦）：選択した作戦をレース全体の指示（集団牽引の強さ・エース発射）へ反映
  const tac = ML_TACTICS[tactic] || ML_TACTICS.balanced;
  // v38(改善): モニュメント（丘陵/山岳の古典）は選抜性の高いハードな一日レース。集団を絞る選抜フラグを立てる。
  course.selective = !!(raceMeta.monument || raceMeta.grade >= 4);
  // v39(A案): レース中の判断カードでfromTickから再計算するため、作戦（directive）をsimに保持する
  sim.directive = { chaseMode: tac.chaseMode, aceEarly: tac.aceEarly };
  sim.difficulty = difficultyId; // v39.18: 難易度で判断カードの一手の効きを変える
  simulateTicks(course, riders, 0, sim.directive, !!(raceMeta.tmpl && raceMeta.tmpl.soloTT));
  rankSim(sim);
  // v36修正: レース後にfinishTimeを書き換えると、観戦アニメ（posHist）と着順（finishTime）が
  // 食い違い「先頭でゴールしたのにリザルト2位」等の同期ズレが起きていた。着順の書き換えは全廃し、
  // 献身の作用はすべてシミュレーション内で完結させる：(1)エースはチームドラフト（sim/race.js
  // 参照）による実在の風除けで勝負圏に残る、(2)アシスト本人は最終直線で流して勝負を譲る
  // （isAssistingの最終区間ハンドリング）。結果はシミュレーション（＝観戦）そのまま＝アニメと必ず一致する。
  if (assistedAceRef) {
    // 結果画面用に、献身で押し上げたエースを渡す。着順(rank)はレース中の判断カード(resumeSim)で
    // 再ランクされ得るため、結果画面側で id から最新順位を引き直す（snapshotのrankはフォールバック）。
    sim.assistedAce = { id: assistedAceRef.id, name: assistedAceRef.name, rank: assistedAceRef.rank };
  }
  return sim;
}
