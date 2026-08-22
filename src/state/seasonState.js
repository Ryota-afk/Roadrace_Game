// シーズンモードの状態：月間レース生成・init/save/load。state/state.js から分離（第15弾F）。
// localStorageキー：roadrace_v12_save。
import { GRAND_TOURS, OVERSEAS_VENUES, REGIONS, TEMPLATES, VENUES } from "../data/course.js";
import { CLASSES, DIFFICULTIES, seasonNeed } from "../data/progression.js";
import { MYLIFE_TEAMS, teamsForClass } from "../data/teams.js";
import { raceEntryPlan } from "../domain/season/entryPlan.js";
import { mulberry, ridState } from "../core/core.js";
import { rollWeather } from "../sim/race.js";
import { genPoachTargets, genFaPool, genTradeOffers } from "../domain/season/transfer.js";
import { teamPayroll } from "../domain/season/salary.js";
import { initRoster, genScouts } from "../domain/season/roster.js";
import { genSponsors } from "../domain/season/sponsor.js";
import { unlockedTemplates } from "./prestige.js";
import { sharedWorldRosters, topUpWorldRosters } from "./worldRoster.js";

export function genMonthRaces(year, month, classIdx, points, sponsor, gtWins) {
  const rng = mulberry(year * 1000 + month * 37 + 5);
  const races = [];
  // v28: 累計CPで解禁される新コース種別も抽選プールに含める
  const pool = unlockedTemplates();
  if (month === 11) {
    const isProFinal = classIdx === 2;
    const gtWinCount = (gtWins || []).length;
    const qualified = isProFinal ? gtWinCount >= GRAND_TOURS.length : points >= seasonNeed(classIdx);
    // v12: 以前はB1→Aの昇格戦だけが2日間ステージレースで、A→PRO・PROグランファイナルは
    // 1日のとばしレースだった（1日目を観戦してもすぐ結果に飛ぶように見え、2日目が
    // 行われないバグと誤解されていた）。全クラスのチャンピオンシップを統一して
    // 2日間ステージレースにする
    const stageName = classIdx === 0 ? "A昇格ステージレース（2日間・総合タイム）"
      : classIdx === 1 ? "PRO昇格ステージレース（2日間・総合タイム）"
      : "グランファイナル（2日間・総合タイム）";
    races.push({
      id: `champ-${year}-${classIdx}`, championship: true, locked: !qualified, stageRace: true, stageCount: 2,
      name: stageName,
      tmpl: TEMPLATES[3], grade: 3, cls: classIdx, weather: rollWeather(rng),
      lockReason: qualified ? null : (isProFinal
        ? `出場権なし（年間グランツール全${GRAND_TOURS.length}戦制覇が必要・現在${gtWinCount}/${GRAND_TOURS.length}勝）`
        : `出場権なし（${seasonNeed(classIdx)}pt必要）`),
    });
    const t = pool[Math.floor(rng() * pool.length)];
    const fvenue = VENUES[Math.floor(rng() * VENUES.length)];
    races.push({ id: `r-${year}-${month}-x`, name: `${fvenue}ファイナルロード`, venue: fvenue, tmpl: t, grade: 2, cls: classIdx, locked: false, weather: rollWeather(rng) });
    return races;
  }
  const count = month === 0 ? 3 : (month === 8 || month === 9) ? 4 : 5;
  const openCount = month === 0 ? 2 : 2 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const t = pool[Math.floor(rng() * pool.length)];
    const open = i < openCount;
    const cls = open ? classIdx : Math.floor(rng() * 3);
    const grade = month === 0 ? 1 : month === 10 ? (i === 0 ? 3 : 1 + Math.floor(rng() * 2)) : 1 + Math.floor(rng() * 3);
    const venue = VENUES[Math.floor(rng() * VENUES.length)];
    races.push({
      id: `r-${year}-${month}-${i}`,
      name: `${venue}${t.kind}`, venue,
      tmpl: t, grade, cls, weather: rollWeather(rng),
      locked: !open || cls !== classIdx,
      lockReason: (!open || cls !== classIdx) ? `${CLASSES[cls].id}限定` : null,
    });
  }
  // v13: グランツール・海外遠征。年3戦（春・夏・秋）、その年のクラスに開かれた
  // 3日間の海外遠征ステージレースを追加する。stageTmplsで日ごとにコース性格を変え、
  // 通常のクラス別カレンダーとは独立に毎年必ず出走できる
  // v14.7: グランツールはPROクラス限定の大会に変更（B1・Aでは開催されない）
  // v14.8: 1戦だったグランツールを年3戦に増設。gtIndexで個別に勝敗を追跡し、
  // 3戦すべての総合優勝がグランファイナル出場の条件になる
  const gtDef = classIdx === 2 ? GRAND_TOURS.find(g => g.month === month) : null;
  if (gtDef) {
    const gtIndex = GRAND_TOURS.indexOf(gtDef);
    const venue = OVERSEAS_VENUES[Math.floor(rng() * OVERSEAS_VENUES.length)];
    races.unshift({
      id: `grandtour-${year}-${gtIndex}`, grandTour: true, gtIndex, stageRace: true, stageCount: 3,
      name: `${venue}${gtDef.season}グランツール（3日間・総合タイム）`,
      tmpl: gtDef.stageTmpls[0], stageTmpls: gtDef.stageTmpls,
      grade: 3, cls: classIdx, locked: false, lockReason: null, weather: rollWeather(rng),
    });
  }
  if (sponsor && sponsor.mandateMonths && sponsor.mandateMonths.includes(month)) {
    const target = races.find(r => !r.locked);
    if (target) target.sponsorMandate = true;
  }
  return races;
}

export function initGame() {
  ridState.value = 100;
  const roster = initRoster();
  const rosterNames = roster.map(r => r.name);
  // v41: 引き抜き市場は rivalRosters と id を共有する必要があるため、先に一度だけ生成して使い回す
  // v50(第11弾Phase1・1-A): RIVAL_TEAMS(6)ではなくMYLIFE_TEAMS(25)全体でロースターを持つ。
  // クラス昇降格で対戦相手が入れ替わっても、行き先クラスのチームには既にロースターがある状態にする。
  const rivalRosters = sharedWorldRosters(MYLIFE_TEAMS);
  const initRaces = genMonthRaces(1, 0, 0, 0, null, []);
  return {
    screen: "intro", tab: "home",
    // v28: 自チーム名（プレイヤーが命名できる。未設定なら既定名）
    teamName: "あなたのチーム",
    year: 1, month: 0, classIdx: 0, points: 0, budget: 300,
    roster,
    // v38: 永続ライバルロースター。従来はレースごとにAI相手を使い捨て生成しており、同じチーム名でも
    // 毎レース別人が出走していた（宿敵が育たず相手の成績も追えない）。開始時に固定の選手団を持つ。
    // v38(#9 A-3): 共有ワールドから取得＝新しいシーズンでも前回・マイライフと同じ顔ぶれの相手が
    // （年を取った状態で）出走する。世界が1つに繋がる。
    rivalRosters,
    equip: { frame: 0, wheels: 0, facility: 0, grounds: 0 },
    staff: { manager: 0, trainer: 0, doctor: 0, scout: 0 },
    // Wave H-2: 部屋の内装グレード（見た目のみ・能力値への影響なし）。equipとは独立の軸。
    roomLv: { training: 0, mechanic: 0, medical: 0, scout: 0 },
    inv: { wheel: 0, suit: 0, supp: 0, tune: 0, camp: 0 },
    partsInv: {},
    camp: false,
    sponsor: null,
    sponsorOffers: genSponsors(0, 1),
    scoutPolicy: "balance",
    // v12バグ修正: 初回のスカウト候補・FA候補が固定シードで毎回同じ顔ぶれになっていたため、
    // 新規ゲームのたびに変わるようDate.now()由来のシードに変更。
    // 自チームの初期ロースターの名前とも被らないよう渡す
    scouts: genScouts(0, Date.now() % 999983, "balance", rosterNames),
    faMarket: genFaPool(0, (Date.now() + 12345) % 999983, rosterNames),
    tradeOffers: genTradeOffers(0, (Date.now() + 54321) % 999983, roster),
    races: initRaces,
    // v50(第11弾Phase1・1-B): AIチームの月内出走登録（raceId→登録チーム名の配列）。
    // 決定論的（year+monthのみでシード）なので、プレイヤーが見る前に確定している。
    entryPlan: raceEntryPlan(initRaces, teamsForClass(0), 0, rivalRosters, 1, 0),
    // v50(第11弾Phase1・1-C): 実際のレース結果から積み上げるチーム別ポイント（張りぼてのハッシュ式を置換）
    rivalPoints: {},
    sel: { raceId: null, starters: [], ace: null, roles: {}, squadN: null, useWheel: false, useSuit: false, chaseMode: "normal", aceEarly: false },
    result: null, prizeInfo: null,
    champBest: null, gc: null, pendingEvent: null, eventResult: null,
    yearendInfo: null, log: [], cleared: false,
    // v13: キャリア統計・歴史記録テーマ。通算成績と年度ごとの結果履歴を保持する
    careerStats: { totalRaces: 0, totalWins: 0, totalPodiums: 0, totalPrize: 0, bestFinish: null },
    careerHistory: [],
    // v13: 難易度（周回プレイでクリアポイントを貯めて上位難易度を解禁する）
    difficulty: "easy",
    // v13: 選手名鑑・殿堂入り。引退・解雇した選手のスナップショット（raceLog含む）を保持する
    hallOfFame: [],
    // v13.1: 解雇後にライバルチームへ拾われた元自チーム選手（signedTeamで所属先を管理）。
    // 出走のたびraceLogが伸び、年度末に引退すると殿堂入り条件次第でhallOfFameへ移る
    rivalAlumni: [],
    // v14.8: その年に総合優勝したグランツールのgtIndex一覧（年度末にリセット）。
    // PROクラスのグランファイナル出場条件（全戦制覇）の判定に使う
    gtWins: [],
    // v28: 会場ごとの相性・ホームアドバンテージ。自チームの本拠地。地元開催のレースで
    // 出走選手に小さな能力ボーナスがつく
    homeRegion: REGIONS[Math.floor(Math.random() * REGIONS.length)],
    // v17: キャプテン制度。指名した選手のidを保持する（未指名ならnull）
    captainId: null,
    // v18: グランツール副次クラシフィケーション（ポイント賞・山岳賞・新人賞）の
    // 自チーム通算獲得回数。実績判定に使う
    jerseyWinCounts: { points: 0, mountains: 0, youth: 0 },
    // v18: 実績を初めて達成した時に一度だけ報酬を付与するため、既に報酬を受け取った実績idを記録する
    rewardedAchievements: [],
    // v25: グランファイナル制覇後も同じチームで続けられる周回モード（ディナスティ）。
    // 周回のたびに他チームの地力を底上げし、再挑戦のたびに歯応えを保つ
    dynastyLevel: 0,
    // v25: ユース育成枠（年1回だけ安価に確保できる原石）。使用済みかどうかを保持し、
    // 年度末に毎年リセットする
    youthUsed: false,
    // v27: 引退選手のスタッフ登用（OBコーチ）。殿堂入りOBを月給制で1名まで雇える
    obCoach: null,
    // v41: 移籍市場の駆け引き（引き抜き）。他チームの主力を引き抜く候補（年1更新）と、
    // 引き抜きは年1回までの制限フラグ（年度末にリセット）
    poachTargets: genPoachTargets(0, 1, 777 + 13, rivalRosters, teamsForClass(0)),
    poachDoneThisYear: false,
    // v51(第12弾12-A): 選手年俸制への移行フラグ。新規ゲームは最初から年俸制なので移行不要＝true。
    // 旧セーブ（一律月3万時代）はloadGame()側でfalse扱いとなり、一度だけ移行支援金を受け取る。
    payrollMigrated: true,
    // v51(第12弾12-C): CP交換所の恒久上限拡張・年俸割引。既定は無購入＝ボーナス0／割引なし。
    // 実際の付与はscreens/season/intro.jsxのゲーム開始時にcpShopSeasonPerks()から一度だけ適用される。
    rosterMaxBonus: 0, staffMaxBonus: 0, salaryDiscountMul: 1,
  };
}

export const SAVE_KEY = "roadrace_v12_save";
const SAVE_VERSION = "v12";
const SAVE_FIELDS = [
  "year", "month", "classIdx", "points", "budget", "roster", "equip", "staff", "inv", "partsInv",
  "camp", "sponsor", "sponsorOffers", "scoutPolicy", "scouts", "faMarket", "races",
  "champBest", "log", "cleared", "careerStats", "careerHistory", "difficulty", "hallOfFame", "rivalAlumni",
  "gtWins", "captainId", "tradeOffers", "jerseyWinCounts", "rewardedAchievements", "dynastyLevel", "youthUsed", "obCoach", "homeRegion", "teamName",
  "rivalRosters", "rivalStats", "poachTargets", "poachDoneThisYear",
  // v50(第11弾Phase1): 出走登録（1-B）と実体化した順位ポイント（1-C）
  "entryPlan", "rivalPoints",
  // v51(第12弾12-A): 選手年俸制への移行済みフラグ
  "payrollMigrated",
  // v51(第12弾12-C): CP交換所の恒久上限拡張・年俸割引
  "rosterMaxBonus", "staffMaxBonus", "salaryDiscountMul",
];

export function serializeState(g) {
  const out = {};
  SAVE_FIELDS.forEach(k => { out[k] = g[k]; });
  return out;
}

export function saveGame(g) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), state: serializeState(g) }));
    return true;
  } catch (e) { return false; }
}

export function resyncRid(state) {
  let max = ridState.value;
  (state.roster || []).forEach(r => { if (r.id >= max) max = r.id + 1; });
  (state.scouts || []).forEach(sc => { if (sc.rider.id >= max) max = sc.rider.id + 1; });
  (state.faMarket || []).forEach(fa => { if (fa.rider.id >= max) max = fa.rider.id + 1; });
  // v41: 引き抜き候補（実体化済み選手）の id も採番に含める（ロード後の id 衝突を防ぐ）
  (state.poachTargets || []).forEach(pt => { if (pt.candidate && pt.candidate.id >= max) max = pt.candidate.id + 1; });
  ridState.value = max;
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== SAVE_VERSION || !parsed.state) return null;
    const base = initGame();
    resyncRid(parsed.state);
    const merged = {
      ...base, ...parsed.state,
      screen: "main", tab: "home",
      sel: base.sel, result: null, prizeInfo: null, gc: null, pendingEvent: null, eventResult: null, yearendInfo: null,
    };
    // v50(第11弾Phase1): entryPlan/rivalRosters未保存の旧セーブ（RIVAL_TEAMS(6)時代）は
    // rivalRostersがMYLIFE_TEAMS(25)に満たない可能性があるため補充し、entryPlanも
    // 現在のyear/month/classIdxに合わせて作り直す（initGame()の1年目1月分をそのまま
    // 使うと年月がズレて破綻するため）。
    if (!merged.rivalRosters || Object.keys(merged.rivalRosters).length < MYLIFE_TEAMS.length) {
      merged.rivalRosters = topUpWorldRosters(merged.rivalRosters || {}, mulberry((merged.year * 7919 + merged.month * 31) >>> 0), MYLIFE_TEAMS);
    }
    if (parsed.state.entryPlan == null) {
      merged.entryPlan = raceEntryPlan(merged.races, teamsForClass(merged.classIdx), merged.classIdx, merged.rivalRosters, merged.year, merged.month);
    }
    if (parsed.state.rivalPoints == null) merged.rivalPoints = {};
    // v51(第12弾12-A): 選手年俸制への移行。旧セーブ（一律月3万時代）は、新方式の半年分を
    // 移行支援金として一度だけ支給する（急な負担増で即赤字化するのを防ぐ）。
    if (!parsed.state.payrollMigrated) {
      const grant = teamPayroll(merged.roster) * 6;
      merged.budget = merged.budget + grant;
      merged.payrollMigrated = true;
      merged.log = [...(merged.log || []), `【運営方針の変更】選手の待遇を一律の維持費から実力に応じた年俸制へ改めた。移行にあたり支度金${grant}万円を受け取った`];
    }
    return merged;
  } catch (e) { return null; }
}

// v35(UI): セーブの安心感。フルロードせずに続きから用のサマリ（誰の・いつの・どこまで）だけ覗く。
export function saveGameInfo() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p.version !== SAVE_VERSION || !p.state) return null;
    const s = p.state;
    return { savedAt: p.savedAt || null, teamName: s.teamName || "あなたのチーム", year: s.year || 1, classLabel: (CLASSES[s.classIdx || 0] || {}).label || "" };
  } catch (e) { return null; }
}
