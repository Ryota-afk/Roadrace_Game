// 世界ランキング・選手成績台帳・メディア記事。第13弾Phase0でlogic/support.jsから分離。
import { overall, strHash, mulberry } from "../../core/core.js";
import { DIFFICULTIES, DISCIPLINE_KEYS } from "../../data/progression.js";
import { ML_TYPE_CAP_OFFSET } from "../../data/abilities.js";
import { MYLIFE_TEAMS, teamsForClass } from "../../state/state.js";
import { aiPowerFor, mlAiCapFor, ovrBandLabel, scoutedAbilities, scoutStageFromRaces } from "../shared/scouting.js";
import { aptGrade, disciplineScore } from "../shared/growth.js";
import { mlTeamTier, rivalHeatTier } from "../season/rival.js";

// v51(第11弾Phase2・2-B): classMul（クラス係数、CLASSES[classIdx].prizeMulを流用）を追加。
// 世界ランキングを実データ化するにあたり、PROで勝つ方がB1で勝つより世界的な価値が
// はっきり大きくなるようにする（ユーザー判断）。省略時は1.0＝旧来どおり。
export function worldPointsForFinish(rank, grade, classMul = 1) {
  const gradePts = { 1: 16, 2: 34, 3: 66, 4: 130 }[grade] || 16;
  const place = rank === 1 ? 1 : rank === 2 ? 0.7 : rank === 3 ? 0.55
    : rank <= 5 ? 0.4 : rank <= 10 ? 0.25 : rank <= 20 ? 0.12 : 0.05;
  return Math.round(gradePts * place * classMul);
}

// v35(D 物語): メディアナラティブ。選手の実際のキャリア状態（直近成績・連勝/連続表彰台・
// 世界ランク・因縁・人気・年齢）から最も「記事になる」角度を選び、見出し＋短い記事を生成する。
// 純関数（ml から読むだけ）。tone で色分け（good/bad/neutral）。seed で月ごとに文面を少し変える。
// v37: 選手成績台帳。毎レース後、永続キャラ（ライバル／自チームメイト）の着順を集計する純関数。
// 出走ごとに通算＆年度別（勝利/表彰台/トップ10/ベスト着順）を積む。使い捨てのモブは対象外。
// v51(第11弾Phase2・2-B): grade・classMulを渡すと、着順に応じたworldPointsForFinish()の
// 値もcur.wpへ積む（世界ランキングの実データ化）。省略時（grade未指定）はwpを積まない＝
// 既存の呼び出し（成績集計だけが目的の箇所）は無変更で動く。
export function mlUpdateRiderStats(prev, rankedEntrants, teammateIds, year, grade, classMul) {
  const next = { ...(prev || {}) };
  (rankedEntrants || []).forEach(e => {
    if (e.isPlayerChar) return; // 自分は raceLog で別管理
    if (!Number.isFinite(e.rank)) return;
    const isRival = !!(e.isRival || e.isRival2);
    const isMate = teammateIds && teammateIds.has(e.id);
    // v37: 永続ワールドロースター化に伴い、AI相手（world）も含めて全出走選手を追跡する。
    // v38(#3): 弟子（isProtege）は専用の kind で区別（成績画面で「弟子」として表示）。
    const kind = e.isProtege ? "protege" : isRival ? "rival" : isMate ? "teammate" : "world";
    const cur = next[e.id]
      ? { ...next[e.id], byYear: { ...next[e.id].byYear } }
      : { id: e.id, name: e.name, team: e.teamName || e.team, kind, races: 0, wins: 0, podiums: 0, top10: 0, bestRank: 99, wp: 0, byYear: {} };
    // 既存記録のkindがrival/teammateなら維持（worldに降格させない）
    if (cur.kind === "world" && kind !== "world") cur.kind = kind;
    const r = e.rank;
    cur.name = e.name; cur.team = e.teamName || e.team || cur.team;
    cur.races += 1;
    if (r === 1) cur.wins += 1;
    if (r <= 3) cur.podiums += 1;
    if (r <= 10) cur.top10 += 1;
    cur.bestRank = Math.min(cur.bestRank, r);
    if (grade != null) cur.wp = (cur.wp || 0) + worldPointsForFinish(r, grade, classMul || 1);
    const y = cur.byYear[year] ? { ...cur.byYear[year] } : { races: 0, wins: 0, podiums: 0 };
    y.races += 1; if (r === 1) y.wins += 1; if (r <= 3) y.podiums += 1;
    cur.byYear[year] = y;
    next[e.id] = cur;
  });
  return next;
}

// v51(第11弾Phase2・2-B): 年度末、全世界選手のwpを一律に減衰させる（プレイヤー自身の
// worldPointsに掛けているのと同じ0.72）。減衰しないと「一度稼いだ古参」が永遠に
// 上位に居座り、新世代・プレイヤーの追い上げが意味を持たなくなる。
export function decayRiderStatsWp(riderStats, mul) {
  const next = {};
  Object.entries(riderStats || {}).forEach(([id, s]) => { next[id] = { ...s, wp: Math.round((s.wp || 0) * mul) }; });
  return next;
}

// v51(第11弾Phase2・2-C): 世界ランキングを「自分の持ち点だけで決まる計算式」から
// 「riderStats（実際に走る全選手）に対する実順位」へ置換。旧computeWorldRank(points, year)は
// 他人を一切参照しない張りぼてだった（実測でworldPoints=600なら年次に関わらず無条件世界1位に
// なることを確認済み。devlog/wave11.md Phase2参照）。
export function computeWorldRank(riderStats, myWp) {
  const wp = myWp || 0;
  const better = Object.values(riderStats || {}).filter(s => (s.wp || 0) > wp).length;
  return Math.max(1, better + 1);
}

// v37: 自分が出走しなかったクラスのレース結果を軽量に決着させる（ワールドの選手だけで順位付け）。
// 地形適性（コース得意脚質との一致）＋強さ階級baseline＋ノイズでスコアリングし、pseudo-entrants を返す。
// これを mlUpdateRiderStats に渡すことで、自分が出ていないレースの成績も台帳に積める。
// v51(第11弾Phase2・2-A): 従来は全25チーム(288名)を1レースで決着させていたが、実レース
// （buildMyLifeSim）はクラス分割済み（teamsForClass、約9チーム）のため台帳の土俵が
// 食い違っていた。classIdxを受け取りteamsForClass(classIdx)だけを母集団にすることで統一する。
// raceForClassはmlGenRace(year, month, classIdx)で生成した「そのクラスの今月のレース」
// （地形favors・グレード取得用。実際に開催されて見せる訳ではない）。
export function mlWorldRaceLite(ml, seed, classIdx, raceForClass) {
  const rosters = ml.worldRosters || {};
  const teams = teamsForClass(classIdx);
  const favors = raceForClass && raceForClass.tmpl ? raceForClass.tmpl.favors : null;
  const rng = mulberry(((seed || 1) >>> 0) || 1);
  const entrants = [];
  teams.forEach(t => {
    // v38(#4): 自チームは worldRosters ではなく teammates が実体（レースに出るのはそちら）。
    // ここで自チームのロースターに成績を積むと、名鑑に「出走したことのない幽霊選手」の成績が
    // 表示されてしまうため除外する（チームメイトは自分の出走レースで台帳に積まれる）
    if (t.name === ml.team) return;
    (rosters[t.name] || []).forEach(wr => {
      const typeMatch = (favors && wr.type === favors) ? 8 : 0;
      entrants.push({ id: wr.id, name: wr.name, teamName: t.name, score: (wr.baseline || 0) + typeMatch + (rng() - 0.5) * 14 });
    });
  });
  // v51: ライバルは所属チームのtierが一致するクラスの世界にだけ出す（3クラス全部に
  // 重複出現させない）。所属チームが不明（旧セーブ等）ならtier0扱い。
  [ml.rival, ml.rival2].forEach((rv, idx) => {
    if (!rv) return;
    if (mlTeamTier(rv.team) !== classIdx) return;
    const typeMatch = (favors && rv.type === favors) ? 8 : 0;
    entrants.push({ id: rv.id, name: rv.name, teamName: rv.team, isRival: idx === 0, isRival2: idx === 1, score: 6 + typeMatch + (rng() - 0.5) * 14 });
  });
  entrants.sort((a, b) => b.score - a.score);
  entrants.forEach((e, i) => { e.rank = i + 1; });
  return entrants;
}

// 台帳を「自分・ライバル・チームメイト」の表示用リストへ整形（純関数）。
export function mlRiderStatsRows(ml) {
  const stats = ml.riderStats || {};
  const year = ml.year || 1;
  const rows = [];
  // 自分（raceLogから集計）
  const p = ml.player;
  if (p) {
    const log = p.raceLog || [];
    const agg = { races: log.length, wins: 0, podiums: 0, top10: 0, bestRank: 99, yr: { races: 0, wins: 0, podiums: 0 } };
    log.forEach(e => {
      if (e.rank === 1) agg.wins++; if (e.rank <= 3) agg.podiums++; if (e.rank <= 10) agg.top10++;
      agg.bestRank = Math.min(agg.bestRank, e.rank);
      if (e.year === year) { agg.yr.races++; if (e.rank === 1) agg.yr.wins++; if (e.rank <= 3) agg.yr.podiums++; }
    });
    rows.push({ id: p.id, name: p.name, team: ml.team, kind: "self", ...agg, byYear: { [year]: agg.yr } });
  }
  // 近しい面々（自分・ライバル・仲間・弟子）だけをこの画面に。ワールド全体は mlWorldTeamStats で。
  Object.values(stats).filter(s => s.kind !== "world").forEach(s => {
    const yr = s.byYear && s.byYear[year] ? s.byYear[year] : { races: 0, wins: 0, podiums: 0 };
    rows.push({ ...s, yr });
  });
  const kindOrder = { self: 0, rival: 1, protege: 2, teammate: 3 };
  rows.sort((a, b) => (kindOrder[a.kind] - kindOrder[b.kind]) || (b.wins - a.wins) || (a.bestRank - b.bestRank));
  return rows;
}

// v37: 全チームの選手名鑑＋成績（チームごとにグルーピング）。永続ワールドロースターの全選手を、
// 蓄積した成績（riderStats）と突き合わせて返す。未出走の選手も0成績で表示する。
// v51(第11弾Phase3・3-B/3-C): 各行にscoutStage（0-3）とscout（段階に応じた査定情報）を添える。
// 自分・チームメイトは常にstage3（毎日一緒に練習している以上、伏せる理由が無い＝ユーザー判断）。
// 相手チームの選手は対戦経験（riderStats[id].races）で段階が開く。
export function mlWorldTeamStats(ml) {
  const stats = ml.riderStats || {};
  const rosters = ml.worldRosters || {};
  const year = ml.year || 1;
  const diffDef = DIFFICULTIES.find(d => d.id === ml.difficulty) || DIFFICULTIES[1];
  const aiCap = mlAiCapFor(ml.difficulty, diffDef.abilCap);
  // v51: 査定は実際のレース生成と同じ式で計算する。相手チーム（worldRosters経由）はaiCap、
  // 自チームメイト（buildMyLifeSimでcap未指定＝既定94）はcapを分ける（実際の生成と食い違わせない）。
  const scoutInfoFor = (rider, classIdx, stage, cap) => {
    if (stage < 1) return null;
    const power = aiPowerFor(50, classIdx, 2, diffDef.aiMul);
    // 第31弾: 査定値は実際のレース生成（buildMyLifeSim）と同じcapOffsetを渡す。
    // 揃えないと「スカウトで見た能力」と「実際に走る能力」が食い違う。
    const ab = scoutedAbilities(rider, power, year, cap, ML_TYPE_CAP_OFFSET);
    if (stage === 1) return { stage, ovrBand: ovrBandLabel(ab.ovr) };
    if (stage === 2) return { stage, grades: DISCIPLINE_KEYS.reduce((acc, k) => { acc[k] = aptGrade(disciplineScore(ab, k)); return acc; }, {}) };
    return { stage, ...ab };
  };
  const teams = [];
  const statRow = (id, name, type, wr, teamTier, extra = {}, forceStage) => {
    const s = stats[id];
    const yr = s && s.byYear && s.byYear[year] ? s.byYear[year] : { races: 0, wins: 0, podiums: 0 };
    const stage = forceStage != null ? forceStage : scoutStageFromRaces(s ? s.races : 0);
    return { id, name, type,
      races: s ? s.races : 0, wins: s ? s.wins : 0, podiums: s ? s.podiums : 0,
      bestRank: s ? s.bestRank : 99, yr, scoutStage: stage,
      scout: wr ? scoutInfoFor(wr, teamTier, stage, forceStage != null ? 94 : aiCap) : null, ...extra };
  };
  Object.entries(rosters).forEach(([teamName, riders]) => {
    const teamInfo = MYLIFE_TEAMS.find(t => t.name === teamName);
    const teamTier = teamInfo ? teamInfo.tier : 0;
    let rows;
    if (teamName === ml.team) {
      // v38(#4): 自チームは worldRosters の未使用選手団ではなく、実際にレースへ出ている
      // 「自分＋固定チームメイト」を表示する（選手成績画面と同じ顔ぶれに統一）。
      // 自分は raceLog から集計（riderStats は自分を対象外にしているため）。
      rows = [];
      const p = ml.player;
      if (p) {
        const log = p.raceLog || [];
        const agg = { races: log.length, wins: 0, podiums: 0, bestRank: 99, yr: { races: 0, wins: 0, podiums: 0 } };
        log.forEach(e => {
          if (e.rank === 1) agg.wins++; if (e.rank <= 3) agg.podiums++;
          agg.bestRank = Math.min(agg.bestRank, e.rank);
          if (e.year === year) { agg.yr.races++; if (e.rank === 1) agg.yr.wins++; if (e.rank <= 3) agg.yr.podiums++; }
        });
        // 自分は毎レースAI生成しない実在のキャラなので、査定値ではなく実際の保有能力をそのまま出す
        rows.push({ id: p.id, name: p.name, type: p.type, ...agg, self: true, scoutStage: 3,
          scout: { stage: 3, flat: p.flat, climb: p.climb, sprint: p.sprint, stamina: p.stamina, solo: p.solo, ovr: overall(p) } });
      }
      (ml.teammates || []).forEach(tm => rows.push(statRow(tm.id, tm.name, tm.type, tm, teamTier, {}, 3)));
      // 自分を先頭に固定し、チームメイトは成績順
      rows = [rows[0], ...rows.slice(1).sort((a, b) => (b.wins - a.wins) || (b.podiums - a.podiums) || (a.bestRank - b.bestRank))].filter(Boolean);
      const teamWins = rows.reduce((a, r) => a + r.wins, 0);
      const teamPodiums = rows.reduce((a, r) => a + r.podiums, 0);
      teams.push({ teamName, color: teamInfo ? teamInfo.color : "#9aa3b5", trait: teamInfo ? teamInfo.trait : "", riders: rows, teamWins, teamPodiums, isMyTeam: true });
      return;
    }
    rows = (riders || []).map(wr => statRow(wr.id, wr.name, wr.type, wr, teamTier));
    rows.sort((a, b) => (b.wins - a.wins) || (b.podiums - a.podiums) || (a.bestRank - b.bestRank));
    const teamWins = rows.reduce((a, r) => a + r.wins, 0);
    const teamPodiums = rows.reduce((a, r) => a + r.podiums, 0);
    teams.push({ teamName, color: teamInfo ? teamInfo.color : "#9aa3b5", trait: teamInfo ? teamInfo.trait : "", riders: rows, teamWins, teamPodiums });
  });
  teams.sort((a, b) => (b.teamWins - a.teamWins) || (b.teamPodiums - a.teamPodiums));
  return teams;
}

export function mlMediaHeadline(ml) {
  if (!ml || !ml.player) return null;
  const p = ml.player;
  const log = p.raceLog || [];
  const nm = p.name || "選手";
  const year = ml.year || 1, month = ml.month || 0;
  const rng = mulberry((year * 12 + month) * 101 + strHash(nm));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  // 直近の流れ
  const recent = log.slice(-4);
  let winStreak = 0, podiumStreak = 0;
  for (let i = log.length - 1; i >= 0; i--) { if (log[i].rank === 1) winStreak++; else break; }
  for (let i = log.length - 1; i >= 0; i--) { if (log[i].rank <= 3) podiumStreak++; else break; }
  const last = log[log.length - 1];
  const recentPoor = recent.length >= 3 && recent.every(r => r.rank > 10);
  const careerWins = log.filter(r => r.rank === 1).length;
  const wr = ml.worldRank, wrPrev = ml.worldRankPrev;
  const heat = ml.rivalRecord?.heat ?? ml.rivalRecord?.meetings ?? 0;
  const heatTier = rivalHeatTier(heat);
  const age = p.age || 24;
  const pop = p.popularity || 0;
  const H = (headline, body, tone) => ({ headline, body, tone });

  // 記事になる角度を優先度順に選ぶ（最初に該当したもの）
  if (log.length === 0) return H("期待の新人、デビュー間近", `${nm}が${["静かな闘志を胸に","大器の予感を漂わせ","無名ながら","チーム期待の星として"][Math.floor(rng()*4)]}プロの世界へ足を踏み入れる。その走りに注目が集まる。`, "neutral");
  if (winStreak >= 3) return H(`${nm} 破竹の${winStreak}連勝`, pick([`止まらない。${nm}が${winStreak}連勝を飾り、ペロトンにその名を刻みつつある。`, `敵なしの快進撃。${nm}の独走態勢に他チームは対抗策を見いだせずにいる。`]), "good");
  if (wr === 1) return H(`${nm}、ついに世界の頂点へ`, `世界ランキング首位。${nm}は名実ともに世界王者となった。この景色を、彼／彼女は長く夢見てきた。`, "good");
  if (wr != null && wrPrev != null && wr <= 10 && wrPrev > 10) return H(`${nm} 世界トップ10入り`, `世界ランキング${wrPrev}位から${wr}位へ躍進。${nm}がついに世界の一線級に名を連ねた。`, "good");
  if (winStreak >= 1 && last) return H(`${nm}が${last.name}を制す`, pick([`${nm}が勝利を掴んだ。会心の走りにスタンドは沸いた。`, `勝ったのは${nm}。着実に勝ち星を重ね、視線を上へと向ける。`]), "good");
  if (heatTier.key >= 2 && ml.rival) return H(`因縁の${heatTier.label}・${ml.rival.name}戦、白熱`, `${nm}と${ml.rival.name}の${heatTier.label}対決から目が離せない。通算${ml.rivalRecord?.wins||0}勝${ml.rivalRecord?.losses||0}敗、この物語の結末を誰もが見届けたがっている。`, "neutral");
  if (podiumStreak >= 3) return H(`${nm} 安定の表彰台ラッシュ`, `${podiumStreak}戦連続表彰台。${nm}の充実ぶりは本物だ。あとは頂点に立つ一勝を待つばかり。`, "good");
  if (pop >= 60 && age <= 25) return H(`若きスター ${nm} に熱視線`, `${age}歳、人気沸騰。${nm}はいまや競技の枠を超えた注目株となっている。`, "good");
  if (recentPoor) return H(`${nm}、正念場の時`, pick([`ここ数戦は精彩を欠く${nm}。しかし本物の選手は逆境でこそ真価を問われる。`, `もがく${nm}。復調のきっかけを、本人もファンも待ち望んでいる。`]), "bad");
  if (age >= 33) return H(`ベテラン ${nm}、なお現役`, `${age}歳。積み重ねた通算${careerWins}勝が語るのは、衰えぬ闘志。${nm}の走りは若手の目標であり続ける。`, "neutral");
  if (careerWins >= 1) return H(`${nm}、通算${careerWins}勝目へ視線`, `一歩ずつ、確かに。${nm}のキャリアは着実に厚みを増している。`, "neutral");
  return H(`${nm}、雌伏の時`, `まだ大きな結果は出ていないが、${nm}の努力を見る者は見ている。飛躍の時は近い。`, "neutral");
}

export function worldRankTier(rank) {
  if (rank == null) return { label: "ランク外", color: "#9aa3b5" };
  if (rank === 1) return { label: "世界王者", color: "#ffd23f" };
  if (rank <= 3) return { label: "世界トップ3", color: "#ffd23f" };
  if (rank <= 10) return { label: "世界トップ10", color: "#35c07e" };
  if (rank <= 30) return { label: "世界の常連", color: "#35c07e" };
  if (rank <= 80) return { label: "世界で戦う実力者", color: "#4f8fe8" };
  if (rank <= 200) return { label: "世界に挑む新鋭", color: "#9aa3b5" };
  return { label: "無名の挑戦者", color: "#9aa3b5" };
}

// v51(第11弾Phase2・2-C/2-D): 世界ランキング表を実データ（riderStats、実際に走る全選手）から
// 組み立てる。旧来は永続スターの別世界（mlWorldStarsForYear・24人）で穴埋めしていたが、
// 実際に走る300人がそのまま順位表の実体になる（devlog/wave11.md Phase2参照）。
export function mlWorldBoard(ml) {
  const myPts = Math.round(ml.worldPoints || 0);
  const stats = ml.riderStats || {};
  const others = Object.values(stats).map(s => ({ id: s.id, name: s.name, team: s.team, wp: s.wp || 0, wins: s.wins || 0, bloodOf: s.bloodOf || null }));
  const me = { name: (ml.player && ml.player.name) || "あなた", wp: myPts, isPlayer: true };
  const all = [...others, me].sort((a, b) => b.wp - a.wp || (a.isPlayer ? -1 : b.isPlayer ? 1 : 0));
  all.forEach((e, i) => { e.rank = i + 1; });
  const myRank = all.find(e => e.isPlayer).rank;
  const rivalId = ml.rival ? ml.rival.id : null;
  const rival2Id = ml.rival2 ? ml.rival2.id : null;
  const entryFor = (e) => ({
    rank: e.rank, pts: e.wp, name: e.name, isPlayer: !!e.isPlayer,
    isRival: !e.isPlayer && rivalId != null && e.id === rivalId,
    isRival2: !e.isPlayer && rival2Id != null && e.id === rival2Id,
    star: e.isPlayer ? null : { wins: e.wins, bloodOf: e.bloodOf },
  });
  const top = all.slice(0, 10).map(entryFor);
  const idx = myRank - 1;
  const around = [];
  if (idx > 11) { for (let i = idx - 2; i <= idx + 2; i++) { if (i >= 0 && i < all.length) around.push(entryFor(all[i])); } }
  const rivalEntry = rivalId != null ? all.find(e => !e.isPlayer && e.id === rivalId) : null;
  const rival2Entry = rival2Id != null ? all.find(e => !e.isPlayer && e.id === rival2Id) : null;
  return { top, around, myRank, myPts, rivalRank: rivalEntry ? rivalEntry.rank : null, rival2Rank: rival2Entry ? rival2Entry.rank : null };
}

// v51(第11弾Phase3・3-C): シーズン版「他チーム名鑑」で使うseasonRivalDexはdomain/season/rival.jsへ。
