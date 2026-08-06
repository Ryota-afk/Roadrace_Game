// 月次更新・年度末処理の状態遷移（純粋なreducer関数）。Step7第3弾。
// v41(§Step7第3弾): 非冪等なlocalStorage書き込み（recordTitle/advanceWorldYear）は
// このファイルからは呼ばない。年度末（screen遷移・g.year変化）を検知したApp()側のuseEffectが
// 1回だけ実行する（既存のclearAwardedRefイディオムを踏襲。詳細はDEVLOG §9参照）。
import { CLASSES } from "../../data/progression.js";
import { MONTHS, RELEGATE_LINE, UPKEEP_PER_RIDER } from "../../data/course.js";
import { OB_COACH_SALARY } from "../../data/economy.js";
import { ABILITIES, AB_KEYS, POW } from "../../data/abilities.js";
import { DIFFICULTIES } from "../../data/progression.js";
import { mulberry, overall, hasAbility } from "../../core/core.js";
import {
  RIVAL_TEAMS, ageWorldRosters, genFaPool, genMonthRaces, genPoachTargets,
  genScouts, genSponsors, genTradeOffers, makePoachOffer,
} from "../../state/state.js";
import {
  EVENTS, EVENT_CHANCE, GRADE_MUL, acquireNewAbility, addAb, champPromoteCut, expireObjective,
  growSub, growthPhase, isHallOfFameWorthy, persMul, rollCondDir, seasonPersonalityEvent, seasonRank,
  staffSalaryTotal, standingsRankReward, teamChemistryTier, upgradeGoldAbilities,
} from "../../logic/support.js";

// v9: 基礎成長量をさらに引き下げ（2.2→1.5）。「将来性一択」問題への対処
// 戻り値を {roster, notices} に正規化（旧: 引数stateへ state._injured を積むout-param方式）。
export function monthlyUpdate(state, raceInfo) {
  const notices = [];
  const starterIds = raceInfo ? raceInfo.starters : null;
  // v14.7: グランツールは複数日にわたって走り切る大会のため、ワンデーレースと
  // 同じ疲労蓄積では実態に合わない。ただしステージレースは中日ごとに-20の回復が
  // 別途入る（startNextStage）ため、素朴に係数を掛けただけだとその回復分で
  // ほぼ相殺されてしまう。かといって係数を上げすぎると、疲労は0未満に下がらない
  // （中日回復は0で頭打ち）ため、開幕直後の疲労が低い選手でも常に上限100に
  // 張り付いてしまい「グランツール＝常に即MAX」という芸のない結果になる。
  // 3日間なら中日回復-40を踏まえてもワンデーレースよりはっきり多く疲労が残りつつ、
  // 低疲労状態からのスタートなら100に張り付かない程度の係数に留める
  const stageFatigueMul = (raceInfo && raceInfo.grandTour) ? 1 + ((raceInfo.stageCount || 3) - 1) / 3 : 1;
  // v13: 難易度別の成長ソフトキャップ閾値（易しいほど高い閾値まで伸びる）
  const growthCap = (DIFFICULTIES.find(d => d.id === state.difficulty) || DIFFICULTIES[0]).growthCap;
  // v17: キャプテン制度。主将より2歳以上若い選手は、主将の指導を受けて練習効果+10%になる。
  // v18バランス調整: 指導に時間を割く分、主将自身の練習効果はわずかに落ちる（-5%）ようにし、
  // 「誰でも無条件に任命した方が得」にならないよう小さなトレードオフを持たせた
  const captain = state.roster.find(r => r.id === state.captainId);
  const captainMentorMul = (n) => {
    if (!captain) return 1;
    if (n.id === captain.id) return 0.95;
    return n.age < captain.age - 2 ? 1.1 : 1;
  };
  const roster = state.roster.map(r => {
    const n = { ...r, parts: { ...r.parts } };
    // v17: チームケミストリー用に、在籍月数を毎月加算する
    n.tenure = (n.tenure || 0) + 1;
    const injMul = hasAbility(n, "glass") ? 2 : hasAbility(n, "tough") ? 0.5 : 1;
    const injExtra = hasAbility(n, "glass") ? 1 : 0;
    if (n.injury > 0) {
      n.injury -= 1;
      n.fatigue = Math.max(0, n.fatigue - 30);
      n.streak = 0;
    } else {
      if (n.focus === "rest") {
        n.fatigue = Math.max(0, n.fatigue - 15);
      } else {
        const ph = growthPhase(n);
        const winter = state.month === 8 || state.month === 9;
        const gain = 1.5 * ph.gain * POW[n.growthPow].mul
          * (winter ? 1.3 : 1) * (state.camp ? 2 : 1)
          * (1 + state.equip.facility * 0.15)
          * (1 + (state.staff?.trainer || 0) * 0.12)
          * (hasAbility(n, "trainer") ? 1.2 : hasAbility(n, "lazy_sp") ? 0.8 : 1)
          * (hasAbility(n, "lateblow_sp") && n.age >= 28 ? 1.15 : 1)
          * captainMentorMul(n);
        // v27: OBコーチが在籍していれば、その担当能力の練習効果を全選手+25%する
        const obAb = state.obCoach ? state.obCoach.ab : null;
        const obMul = (k) => (obAb && k === obAb ? 1.25 : 1);
        // 指定能力の成長にトレードオフ（×0.9）。指定外はさらに絞って14%
        addAb(n, n.focus, gain * 0.9 * persMul(n, n.focus) * obMul(n.focus), growthCap);
        AB_KEYS.filter(k => k !== n.focus).forEach(k => addAb(n, k, gain * 0.14 * persMul(n, k) * obMul(k), growthCap));
        // v29: シーズンでも練習で加速力・メンタルがわずかに伸びる（focusがsprint/flatなら加速に厚め）
        const subG = 0.24 * ph.gain * POW[n.growthPow].mul;
        growSub(n, "accel", subG * (n.focus === "sprint" || n.focus === "flat" ? 1.3 : 0.7));
        growSub(n, "mental", subG * 0.6);
        n.fatigue = Math.min(100, n.fatigue + 6);
      }
      const ph2 = growthPhase(n);
      if (ph2.dec > 0) AB_KEYS.forEach(k => { n[k] = Math.max(20, n[k] - ph2.dec); });
    }
    if (starterIds && starterIds.includes(n.id)) {
      // v28: 出走した選手はベンチ月数（起用されない不満の蓄積）をリセットする
      n.benchMonths = 0;
      // v25: 天候の悪化。猛暑は出走後の疲労蓄積を増やす（悪天候巧者による軽減はなし＝純粋な体力勝負）
      const heatMul = raceInfo.weather === "heat" ? 1.15 : 1;
      n.fatigue = Math.min(100, n.fatigue + (hasAbility(n, "iron") ? 32 : 45) * stageFatigueMul * heatMul);
      n.streak += 1;
      const ph = growthPhase(n);
      // v25: 出走経験による成長が練習に比べて弱く、レースに出る意味が薄いという指摘を受け強化。
      // 基礎係数を引き上げた上、格上のレース（グレードが高い）ほど得るものが大きくなるようにした
      const raceGradeMul = GRADE_MUL[raceInfo.grade] || 1;
      raceInfo.expKeys.forEach(k => addAb(n, k, 1.0 * raceGradeMul * Math.max(0.2, ph.gain) * POW[n.growthPow].mul * persMul(n, k), growthCap));
      // v29: メンタルは大舞台の経験で育つ（格上ほど大きく）
      growSub(n, "mental", 0.3 * raceGradeMul * Math.max(0.25, ph.gain));
      // v11: ドクター（staff.doctor）は故障の発生率を下げ、発生した場合も期間を短縮する
      // v29バグ修正: 効果が体感しづらいという指摘を受け、発生率減・期間短縮ともに強化
      const doctorLv = state.staff?.doctor || 0;
      const injCut = Math.round(doctorLv * 0.8); // 故障期間の短縮量（Lv3で3ヶ月短縮）
      if (n.streak >= 3) {
        n.injury = Math.max(1, 1 + (Math.random() < 0.5 ? 1 : 0) + injExtra - injCut);
        n.streak = 0;
        notices.push(`${n.name} が3連闘の無理がたたり故障（${n.injury}ヶ月離脱）`);
      } else if (n.fatigue > 90) {
        const p = (0.3 + (n.fatigue - 90) * 0.04) * injMul * Math.max(0.1, 1 - doctorLv * 0.22);
        if (Math.random() < p) {
          n.injury = Math.max(1, 1 + (Math.random() < 0.4 ? 1 : 0) + injExtra - injCut);
          n.streak = 0;
          notices.push(`${n.name} が疲労の蓄積で故障（${n.injury}ヶ月離脱）`);
        }
      } else if (raceInfo.weather === "rain" && Math.random() < (hasAbility(n, "rain_sp") ? 0.02 : 0.06) * Math.max(0.1, 1 - doctorLv * 0.22)) {
        // v25: 雨天レースは悪天候巧者を持たない選手に一定確率で落車リスクを上乗せする
        n.injury = Math.max(1, 1 + (Math.random() < 0.3 ? 1 : 0) + injExtra - injCut);
        n.streak = 0;
        notices.push(`${n.name} が雨天のレースで落車、負傷離脱（${n.injury}ヶ月）`);
      }
    } else if (n.injury === 0) {
      n.fatigue = Math.max(0, n.fatigue - (starterIds ? 30 : 50));
      n.streak = 0;
      // v28: レースが行われた月に起用されなかった選手は「ベンチ月数」が積み上がる（移籍志願の判定に使う）
      if (starterIds) n.benchMonths = (n.benchMonths || 0) + 1;
    }
    if (hasAbility(n, "recover")) n.fatigue = Math.max(0, n.fatigue - 15);
    if (hasAbility(n, "recover2")) n.fatigue = Math.max(0, n.fatigue - 25); // v37(第2弾): 超回復
    // v27: コンディション予報。前月に予報した向きを実際の変動として適用し、翌月の予報を新たに引く
    // v43(マイライフ難易度調整Phase 1・判断19a): 新ステータス「安定感」で変動幅そのものを狭める。
    // stability=50（既定・旧セーブ互換）のとき倍率1で従来と完全一致する。
    const stabilitySteady = Math.max(0.5, Math.min(1.3, 1 - ((n.stability ?? 50) - 50) / 150));
    const swing = (hasAbility(n, "moody") ? 2 : hasAbility(n, "steady_sp") ? 0.5 : 1) * stabilitySteady;
    const dir = (n.condForecast != null) ? n.condForecast : rollCondDir();
    n.cond = Math.max(1, Math.min(5, n.cond + dir * swing));
    n.condForecast = rollCondDir();
    // v15フェーズ2: 金特化の判定（勝利数・役割出走数の条件を満たしたら毎月チェック）
    let updated = n;
    const upgraded = upgradeGoldAbilities(updated);
    if (upgraded !== updated) {
      upgraded.goldAbilities.filter(id => !(updated.goldAbilities || []).includes(id))
        .forEach(id => notices.push(`${n.name}の特殊能力「${ABILITIES[id].label}」が金特に覚醒した！`));
      updated = upgraded;
    }
    // v17: 特殊能力の後天的獲得判定
    const acquired = acquireNewAbility(updated);
    if (acquired !== updated) {
      const newId = acquired.abilities[acquired.abilities.length - 1];
      notices.push(`${n.name}が新たな特殊能力「${ABILITIES[newId].label}」を身につけた！`);
      updated = acquired;
    }
    return updated;
  });
  return { roster, notices };
}

export function advanceMonth(s, raceInfo) {
  const { roster, notices } = monthlyUpdate(s, raceInfo);
  const income = s.sponsor ? s.sponsor.monthly : 0;
  const log = [...s.log, ...notices.map(t => `【${MONTHS[s.month]}】${t}`)];
  // v35(シーズン深掘り): チームケミストリーが上のティアへ上がった瞬間を「絆」の節目としてログに刻む
  const prevChem = teamChemistryTier(s.roster), newChem = teamChemistryTier(roster);
  if (newChem.min > prevChem.min && newChem.min > 0) {
    log.push(`【${MONTHS[s.month]}】🤝 長く共に走った絆が実り、チームは「${newChem.label}」に到達（レース中のドラフト消耗 -${Math.round((1 - newChem.mul) * 100)}%）`);
  }
  // v35(シーズン深掘り): 育成の手応え。練習・出走の成長でOVRの節目(70/80/90)を越えた選手を祝う
  roster.forEach(nr => {
    const old = s.roster.find(r => r.id === nr.id);
    if (!old) return;
    const oOld = overall(old), oNew = overall(nr);
    [70, 80, 90].forEach(th => {
      if (oOld < th && oNew >= th) {
        const young = (nr.age || 25) <= 23;
        log.push(`【${MONTHS[s.month]}】📈 ${nr.name} がOVR${th}の壁を突破！${young ? "若き才能が確かに開花しつつある。" : "円熟の走りにさらなる凄みが増した。"}`);
      }
    });
  });
  let sponsor = s.sponsor;
  const mandateRace = s.races.find(r => r.sponsorMandate);
  if (sponsor && mandateRace && !(raceInfo && raceInfo.raceId === mandateRace.id)) {
    sponsor = { ...sponsor, mandatesMissed: sponsor.mandatesMissed + 1 };
    log.push(`【${MONTHS[s.month]}】${sponsor.name}の指定レースを見送った（違約金が加算されます）`);
  }
  // v40（第1候補②）：中期目標の期限切れ判定。期限月を過ぎて未達なら失敗＝違約金をその場で計上する
  let objectivePenalty = 0;
  if (sponsor && sponsor.objective) {
    const exp = expireObjective(sponsor.objective, s.month, MONTHS[s.month]);
    if (exp.log) { sponsor = { ...sponsor, objective: exp.objective }; objectivePenalty = exp.penalty; log.push(exp.log); }
  }
  if (s.month === 11) {
    let classIdx = s.classIdx;
    // v34（バランス）：シーズン順位を実効化。年間の順位で本番の昇格ボーダーが緩み、順位で賞金も出る。
    const sr = seasonRank(s);
    const promoteCut = s.classIdx < 2 ? champPromoteCut(sr.rank) : 3;
    const standingsMoney = standingsRankReward(sr.rank, s.classIdx);
    const info = { promoted: false, relegated: false, retired: [], retiredRiders: [], cleared: false, champBest: s.champBest, sponsorResult: null, standingsRank: sr.rank, standingsTotal: sr.total, promoteCut, standingsMoney };
    if (s.champBest !== null && s.champBest <= promoteCut) {
      // v41(§Step7第3弾): recordTitle("grandFinal") はここで呼ばず、info.clearedを見た
      // App()側のuseEffect（clearAwardedRef、"clear"画面への遷移を検知）に一本化した。
      if (s.classIdx === 2 && s.champBest === 1) { info.cleared = true; }
      else { classIdx = Math.min(2, s.classIdx + 1); info.promoted = true; }
    } else if (s.points < RELEGATE_LINE && s.classIdx > 0) {
      classIdx = s.classIdx - 1; info.relegated = true;
    }
    let delta = 0;
    if (sponsor) {
      const achieved = s.points >= sponsor.norma;
      const mandatePenalty = sponsor.mandatesMissed * 15;
      delta = (achieved ? sponsor.bonus : -sponsor.penalty) - mandatePenalty;
      info.sponsorResult = {
        name: sponsor.name, achieved, bonus: sponsor.bonus, penalty: sponsor.penalty, norma: sponsor.norma, pts: s.points,
        mandatesMet: sponsor.mandatesMet, mandatesMissed: sponsor.mandatesMissed, mandatePenalty,
        objective: sponsor.objective || null,
      };
    }
    const survivors = [];
    roster.forEach(r => {
      const n = { ...r, age: r.age + 1 };
      const retire = n.age >= 36 || (n.age >= 33 && overall(n) < n.joinOvr * 0.8);
      if (retire) { info.retired.push(`${n.name}（${n.age}歳）が引退`); info.retiredRiders.push(n); }
      else survivors.push(n);
    });
    const year = s.year + 1;
    // v38: ライバルチームも年次で世代交代（加齢→成長/衰え→引退→新人補充）。
    // これで周回の相手が固定強度で止まらず、若手台頭とベテラン引退の流れが生まれる。
    const agedRivals = ageWorldRosters(s.rivalRosters, mulberry((year * 2246822519) >>> 0), year, RIVAL_TEAMS);
    // v41(§Step7第3弾): advanceWorldYear()（非冪等なlocalStorage書き込み）はここで呼ばず、
    // s.yearの変化を検知したApp()側のuseEffectに一本化した（詳細はDEVLOG §9参照）。
    agedRivals.retired.slice(0, 3).forEach(r => {
      const debut = agedRivals.debuted.find(d => d.team === r.team);
      log.push(`【${s.year}年目 世代交代】🌍 ${r.team}の${r.name}（${r.age}歳）が引退。${debut ? `新星${debut.name}（${debut.age}歳）が加入した` : ""}`);
    });
    const upkeep = survivors.length * UPKEEP_PER_RIDER;
    const staffSalary = staffSalaryTotal(s.staff) + (s.obCoach ? OB_COACH_SALARY : 0);
    const managerLv = s.staff?.manager || 0;
    const nextOffers = genSponsors(classIdx, year).map(o => ({
      ...o,
      // v29バグ修正: 監督スタッフの効果が体感しづらいという指摘を受け、契約条件への
      // 反映を強化（月収・成功報酬UP／ノルマ・失敗ペナルティ減）
      monthly: Math.round(o.monthly * (1 + managerLv * 0.12)),
      norma: Math.max(5, Math.round(o.norma * (1 - managerLv * 0.08))),
      bonus: Math.round((o.bonus || 0) * (1 + managerLv * 0.10)),
      penalty: Math.max(0, Math.round((o.penalty || 0) * (1 - managerLv * 0.10))),
    }));
    // v13: 年度の総括を歴史記録として1件積む（クラス・最終ポイント・昇格/降格・
    // チャンピオンシップ最高位）
    const careerHistory = [...s.careerHistory, {
      year: s.year, classLabel: CLASSES[s.classIdx].label, points: s.points,
      promoted: info.promoted, relegated: info.relegated, champBest: s.champBest,
    }];
    // v13.1: ライバルチームに拾われた元選手も年齢を重ね、同じ引退条件を満たせば
    // 殿堂入り判定（実績かお気に入りがあれば記録に残る）を経て名鑑へ、
    // 満たさなければ静かに記録から外れる。生き残った選手はrivalAlumniに残り続ける
    const survivingAlumni = [];
    const retiredAlumniHof = [];
    (s.rivalAlumni || []).forEach(r => {
      const n = { ...r, age: r.age + 1 };
      const retire = n.age >= 36 || (n.age >= 33 && overall(n) < n.joinOvr * 0.8);
      if (retire) { if (isHallOfFameWorthy(n)) retiredAlumniHof.push({ ...n, farewellYear: year, farewellReason: "rival_retired" }); }
      else survivingAlumni.push(n);
    });
    // v13.1: 引退した選手は、殿堂入り条件（実績かお気に入り）を満たした場合のみ記録に残す
    const hallOfFame = [
      ...s.hallOfFame,
      ...info.retiredRiders.filter(isHallOfFameWorthy).map(n => ({ ...n, farewellYear: s.year, farewellReason: "retired" })),
      ...retiredAlumniHof,
    ];
    return {
      ...s, roster: survivors, classIdx, points: 0, year, month: 0,
      budget: s.budget + income + delta + standingsMoney - upkeep - staffSalary - objectivePenalty,
      sponsor: null, sponsorOffers: nextOffers,
      scouts: genScouts(classIdx, year * 771 + 13, s.scoutPolicy, survivors.map(r => r.name), s.staff?.scout || 0),
      faMarket: genFaPool(classIdx, year * 613 + 29, survivors.map(r => r.name)),
      tradeOffers: genTradeOffers(classIdx, year * 1471 + 37, survivors),
      races: genMonthRaces(year, 0, classIdx, 0, null, []),
      camp: false, champBest: null, gc: null,
      sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false, chaseMode: "normal", aceEarly: false },
      // v14.8: 年が変わるのでグランツール制覇状況もリセットする
      gtWins: [],
      // v25: ユース育成枠も年度が変わるたびにリセットする
      youthUsed: false,
      yearendInfo: info, cleared: info.cleared, log, careerHistory, hallOfFame, rivalAlumni: survivingAlumni,
      rivalRosters: agedRivals.worldRosters,
      // v41: 引き抜き市場を来季の（年を取った）ライバル主力で更新し、年1回の引き抜き枠をリセット
      poachTargets: genPoachTargets(classIdx, year, year * 331 + 47, agedRivals.worldRosters),
      poachDoneThisYear: false,
      screen: info.cleared ? "clear" : "yearend", tab: "home",
    };
  }
  const month = s.month + 1;
  const upkeep = roster.length * UPKEEP_PER_RIDER;
  const staffSalary = staffSalaryTotal(s.staff) + (s.obCoach ? OB_COACH_SALARY : 0);
  const base = {
    ...s, roster, month, camp: false,
    budget: s.budget + income - upkeep - staffSalary - objectivePenalty,
    sponsor,
    faMarket: genFaPool(s.classIdx, s.year * 1013 + month * 37 + 7, roster.map(r => r.name)),
    tradeOffers: genTradeOffers(s.classIdx, s.year * 1231 + month * 59 + 17, roster),
    races: genMonthRaces(s.year, month, s.classIdx, s.points, sponsor, s.gtWins),
    sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false, chaseMode: "normal", aceEarly: false },
    gc: null,
    screen: "main", log,
  };
  // v41: 被引き抜き。ライバルが自チームの主力を引き抜きに来る（主将以外・健康・OVR66以上の最上位）。
  // 引き止める（費用を払って残留）か、放出して移籍金を得るか＝チーム運営の駆け引き。移籍志願より優先。
  if (month !== 0 && Math.random() < 0.16) {
    const offer = makePoachOffer({ roster, captainId: s.captainId, classIdx: s.classIdx }, Math.random);
    if (offer) return { ...base, poachOffer: offer, screen: "poachOffer" };
  }
  // v28: 選手の移籍志願。長期間ベンチに置かれた実力者（能力55以上）が不満を募らせ、
  // 退団を申し出ることがある。主将は対象外。慰留か放出かをプレイヤーが選ぶ
  const requester = roster.find(r => r.injury === 0 && (r.benchMonths || 0) >= 4 && overall(r) >= 55 && r.id !== s.captainId);
  if (month !== 0 && requester && roster.length > 1 && Math.random() < 0.25) {
    return { ...base, transferRequest: { riderId: requester.id, name: requester.name }, screen: "transferRequest" };
  }
  // v8: 月替わりでランダムに選択肢付きイベントが発生（春先の解禁月は除く）
  // v36(#9): 半々で「性格ベースのチームイベント」（ロースターの誰かの個性にスポットを当てる）を差し込む
  // v43(マイライフ難易度調整Phase 2): 新ステータス「運」をシーズンにも軽く適用。ロースター平均の
  // luckでEVENT_CHANCEを0.5〜1.5倍に補正する（突破力/安定感と同じ揺らぎ式）。マイライフと違い
  // 良/悪の質までは踏み込まず、頻度のみに留める（詳細はDEVLOG参照）。
  const avgLuck = roster.length ? roster.reduce((sum, r) => sum + (r.luck ?? 50), 0) / roster.length : 50;
  const eventChance = EVENT_CHANCE * (0.5 + avgLuck / 100);
  if (month !== 0 && Math.random() < eventChance) {
    const pe = Math.random() < 0.5 ? seasonPersonalityEvent(roster) : null;
    const ev = pe || EVENTS[Math.floor(Math.random() * EVENTS.length)];
    return { ...base, pendingEvent: ev, screen: "event" };
  }
  return base;
}
