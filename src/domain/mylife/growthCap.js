// マイライフの育成上限・私生活イベント抽選・生活費。第13弾Phase0でlogic/support.jsから分離。
import { ML_EVENTS, ML_PERSONALITY_EVENTS } from "../../data/events.js";
import { ML_TYPE_CAP_OFFSET } from "../../data/abilities.js";
import { mlFirstUnmetRung } from "../../state/state.js";

// 第31弾: ML_TYPE_CAP_OFFSETの定義はdata/abilities.jsへ移した（AIの上限にも同じ表を
// 使うため、sim層・shared層のどちらからも参照できる場所が必要だった）。呼び出し側
// （logic/support.jsの再エクスポート経由）を壊さないよう、ここでも再エクスポートする。
export { ML_TYPE_CAP_OFFSET };

// v43(マイライフ難易度調整Phase 1・柱1): 経過年数だけで誰でも同じペースでカンストしていた
// （難易度を問わず年9〜10でキャップに到達、実測はDEVLOG該当ウェーブ参照）ことへの対処。
// 時間経過による底上げは+10年分（+20）で頭打ちにし、それ以降の伸びしろは「実績」（大望の道の
// 踏破・大舞台タイトル・通算勝利）でしか広がらないようにする。難易度が上がるほど実績1つあたりの
// 価値を下げる（鬼は0.5倍）ことで、"難易度=キャップの伸ばしにくさ"という手応えを作る。
const ML_GROWTHCAP_DIFF_MUL = { easy: 1.3, normal: 1.0, hard: 0.75, oni: 0.5 };

// 実績ボーナス：現在選んでいる大望の道でクリア済みのはしご数(0-5)×3、大舞台タイトル×4、
// 通算勝利5勝ごとに+1（この項だけで+10まで）。mlはml状態そのもの（year/careerWins/careerTitles/
// ambitionPath/player.raceLog等）を想定。無ければ0を返す（呼び出し側でmlが渡せない箇所への配慮）。
// v47(第7弾B-3): rungs/majors/winsBonusの各重みを引き上げ、mlGrowthCap内で時間成分から
// 実績成分へ比重を移した分を補う（詳細はDEVLOG §38参照）
export function mlAchievementBonus(ml) {
  if (!ml) return 0;
  const rungs = mlFirstUnmetRung(ml, ml.ambitionPath || "victory");
  const majors = ml.careerTitles || 0;
  const winsBonus = Math.min(16, Math.floor((ml.careerWins || 0) / 4));
  return rungs * 4 + majors * 5 + winsBonus;
}

export function mlGrowthCap(year, player, ml) {
  // v33: 配合の才能キャップ（talentCap）は選手固有の限界突破分。生まれ持った素質で天井が上がる
  const talent = (player && player.talentCap) ? player.talentCap : 0;
  // v47(第7弾B-3): 経過年数だけで伸びる時間成分を縮小した（従来は最大+20＝一度も勝たず練習だけ
  // していても上限が勝手に伸びていた）。上限を主に実績（勝利・表彰台・タイトル＝mlAchievementBonus）
  // で押し上げる形に寄せ、上げ幅の一部をそちらへ移した（詳細はDEVLOG §38参照）
  const timeComponent = Math.min(8, Math.floor(Math.max(0, (year || 1) - 1)));
  const achievementBonus = mlAchievementBonus(ml);
  const diffMul = ML_GROWTHCAP_DIFF_MUL[(ml && ml.difficulty) || "normal"] ?? 1.0;
  return Math.min(140, 90 + timeComponent + achievementBonus * diffMul + talent);
}

// 第29弾（判断③・ユーザー合意「強」）: 脚質ごとの能力別成長上限差。
// mlGrowthCap（共通の基準値）に脚質×能力のオフセットを足し、育て切ったときの
// 能力シルエットを脚質が規定する（「極めると全員同じ万能型になる」の是正・v46の
// 突破力感度と別軸のレバー）。得意+10／準得意+5（パンチャーは双得意+7）／苦手−12
// （表の実体はdata/abilities.jsのML_TYPE_CAP_OFFSET）。
// - 上限を下げても既存キャラの能力値は下がらない（addAbは超過分の伸びが急減衰する
//   だけでクランプはしないため。既存セーブへの影響は「苦手の今後の伸びが鈍る」のみ）。
// - 配合の才能キャップ・血脈レシピ・突破力は基準値側にそのまま効く（オフセットは最後に加算）。
// - マイライフ専用（シーズンの上限は難易度別固定値の別系統・対象外）。
export function mlGrowthCapFor(year, player, ml, abKey) {
  const off = (ML_TYPE_CAP_OFFSET[player && player.type] || {})[abKey] || 0;
  return Math.max(70, mlGrowthCap(year, player, ml) + off);
}

// v43(マイライフ難易度調整Phase 2・イベント受動発火): item.weight（既定1）に応じた加重抽選。
// レア度の高いイベント（覚醒級等）に小さいweightを与えると滅多に出ないようにできる。
export function weightedPick(items) {
  const total = items.reduce((sum, it) => sum + (it.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const it of items) {
    const w = it.weight ?? 1;
    if (roll < w) return it;
    roll -= w;
  }
  return items[items.length - 1];
}

// v43(マイライフ難易度調整Phase 2): 私生活イベントの抽選。新ステータス「運」が高いほど
// 「悪いイベント」（`bad:true`タグ）を引きにくくなる（0.4〜1.6倍でクランプ・luck=50で等倍、
// 突破力/安定感と同じ揺らぎ式）。性格別イベントは悪イベントを持たないため、「悪いイベントを
// 引く」判定に外れた回だけ半々で差し込む（旧mlTriggerEventと同じ配分を踏襲）。
export function pickMlEvent(player) {
  const luck = player?.luck ?? 50;
  const badMul = Math.max(0.4, Math.min(1.6, 1 - (luck - 50) / 100));
  const wantBad = Math.random() < 0.30 * badMul;
  const persPool = ML_PERSONALITY_EVENTS[player?.personality];
  if (!wantBad && persPool && persPool.length && Math.random() < 0.5) return weightedPick(persPool);
  const pool = ML_EVENTS.filter(e => !!e.bad === wantBad);
  return weightedPick(pool.length ? pool : ML_EVENTS);
}

// v43(マイライフ難易度調整Phase 1・成長力マスク化): 成長力(growthPow)はリセマラ・引き直しでの
// 「Sが出るまで粘る」を防ぐため、デビュー直後（3年目未満）は選手本人にも非公開にする。
// 3年目（year>=3）になった時点で判明する。判断⑫（ユーザー承認済み）。
export function mlGrowthPowRevealed(ml) {
  return ((ml && ml.year) || 1) >= 3;
}

export function mlLivingCost(s) {
  const salaryTax = Math.round((s.salary || 0) / 12 * 0.5);
  const carUpkeep = Math.max(0, (s.carLv ?? -1) + 1) * 4;
  const houseUpkeep = Math.max(0, (s.houseLv ?? -1) + 1) * 4;
  return salaryTax + carUpkeep + houseUpkeep;
}

export function mlPrivateCampCost(s) {
  return 120 + Math.max(0, (s.year || 1) - 1) * 40 + (s.classIdx || 0) * 60;
}
