// 能力成長の純計算（逓減カーブ・突破力・種目別適性）。第13弾Phase0でlogic/support.jsから分離。
import { PERSONALITIES, GROWTH, TYPES } from "../../data/abilities.js";
import { DISCIPLINES, DISCIPLINE_KEYS } from "../../data/progression.js";
import { hasAbility } from "../../core/core.js";

export const persMul = (r, k) => (PERSONALITIES[r.personality]?.mul[k]) || 1;

export function t_label(type) { return TYPES[type]?.label || type; }

// v46(能力上限の収束是正): 「極めると全員同じステータスになる」というユーザー指摘への対応。
// mlGrowthCap/DIFFICULTIES.growthCapという共有の天井そのものは変えず（growthPowは引き続き
// 到達速度のみに影響）、代わりに個体差である突破力(breakthrough)の効きを強めることで、
// 上限を超えてどこまで伸ばせるかに恒久的な差をつける。旧感度式(0.5+breakthrough/100)は、
// 実際に生成される突破力のレンジ(p10≈41〜p90≈63)に対して感度が低すぎ、キャリア終盤の
// 最終到達値の差が実測でわずか+2.2点しか無かった（ユーザーの「差があるとしても2、3ぐらい」
// という指摘と一致）。breakthrough=50（既定・旧セーブ互換）で係数1.0という性質は保ったまま
// 傾きだけを強め、同じp10/p90レンジで最終値の差が目安+15〜20点になるよう較正した
// （BREAKTHROUGH_SENSITIVITY=0.08、200ティックのシミュレーションで実測+17.4点。
// scratchpad/breakthrough_calib.mjs参照）。growthFactor/softFactorはseason/mylife共通の
// ため、シーズンモードにも選手ごとの差別化が自動的に及ぶ（difficultyのgrowthCap自体は
// 難易度別の固定値のまま・個体差はbreakthrough経由でのみ生じる設計）。
export const BREAKTHROUGH_SENSITIVITY = 0.08;
export const breakthroughMul = (breakthrough = 50) => Math.max(0.05, 1.0 + BREAKTHROUGH_SENSITIVITY * (breakthrough - 50));

// v43(マイライフ難易度調整Phase 1): 突破力(breakthrough)をgrowthFactorと同じ考え方で反映。
// breakthrough=50（既定・旧セーブ互換）のとき係数1.0で従来のexp(-(v-cap)/4)と完全一致する。
export const softFactor = (v, cap = 88, breakthrough = 50) => (v < cap ? 1 : Math.exp(-(v - cap) / (GROWTH_DECAY_DIV * breakthroughMul(breakthrough))));

// v39.14(バランス): 能力成長の逓減カーブ。従来のsoftFactorは「capまで減速ゼロ→capで壁」だったため、
// 伸びが一直線に上限へ張り付き、2年ほどでカンスト＝以降の成長に手応えが無くなっていた。
// 上限の手前TAPERから徐々に鈍らせ、「最後の20点は簡単には埋まらない」育成カーブにする。
export const GROWTH_TAPER = 42;
export const GROWTH_AT_CAP = 0.2;                  // 上限到達時点の伸び倍率（ここから先はさらに急減衰）
export const GROWTH_DECAY_DIV = 4;                 // 上限超過後の減衰の緩さ（大きいほど緩やかに減衰）
// v43(マイライフ難易度調整Phase 1): 新ステータス「突破力」(breakthrough, 1〜100・既定50)。
// 上限到達時点の伸び倍率(atCap)と減衰の緩さ(decayDiv)の両方をbreakthroughMul()で動かす
// （breakthrough=50のとき従来どおりGROWTH_AT_CAP/GROWTH_DECAY_DIVと完全一致する連続式に
// してあるため、突破力を持たない旧セーブの選手・NPCも挙動が変わらない）。
export const growthFactor = (v, cap = 88, breakthrough = 50) => {
  const mul = breakthroughMul(breakthrough);
  const atCap = GROWTH_AT_CAP * mul;
  const decayDiv = GROWTH_DECAY_DIV * mul;
  // 上限超過は急減衰。上限ぴったりで倍率が跳ね上がらないよう、逓減カーブの終端値から連続させる
  if (v >= cap) return atCap * Math.exp(-(v - cap) / decayDiv);
  const t = Math.max(0, Math.min(1, (v - (cap - GROWTH_TAPER)) / GROWTH_TAPER));
  return 1 - (1 - atCap) * t * t;
};

export const addAb = (r, k, amount, cap) => { r[k] = r[k] + amount * growthFactor(r[k], cap, r.breakthrough ?? 50); };

// v38(改善): 副ステ（加速力/体格/メンタル）の上限を 94→110、フル成長域を 88→100 に拡張。
// 従来はメンタルが数年で94にカンストして「大舞台の経験で育つ」意味が消えていた。天井を上げ、
// 高域はソフトキャップで緩やかに伸ばす＝キャリアを通じて育て続けられる長期ステータスにする。
export function growSub(r, key, amount) {
  const v = r[key] ?? 50;
  r[key] = Math.min(110, v + amount * softFactor(v, 100, r.breakthrough ?? 50));
}

export function rollCondDir() {
  return Math.random() < 0.34 ? -1 : Math.random() < 0.5 ? 0 : 1;
}

// v43(マイライフ難易度調整Phase 1・柱0): GROWTH[r.growth].gainMulを乗算し、成長タイプごとの
// 伸び速度に差をつける（詳細はdata/abilities.jsのGROWTH定義コメント参照）。season/mylife
// 両方がこの関数を共有するため、係数は両モードへ自動的に効く。
export function growthPhase(r) {
  const def = GROWTH[r.growth];
  const [ps, pe] = def.peak;
  const mul = def.gainMul ?? 1.0;
  if (r.age < ps) return { gain: 1.0 * mul, dec: 0, tag: "成長期" };
  if (r.age <= pe) return { gain: 0.5 * mul, dec: 0, tag: "全盛期" };
  // 第15弾: 血脈レシピ達成の伝説特能は、レシピの深さ（希少さ）に応じて衰えが緩やかになる。
  // 2代レシピ(revenant/twinsoul)＝3割抑制、3代レシピ(destiny/unfallen)＝5割抑制、
  // 4代レシピ(sovereign)＝衰えなし。devlog/wave15.mdの初期案（destiny=0.5・sovereign=0）を、
  // 5種すべてに深さ基準で一貫して拡張した（詳細はdevlog/wave15.md §C）
  const decayMul = hasAbility(r, "sovereign") ? 0
    : (hasAbility(r, "destiny") || hasAbility(r, "unfallen")) ? 0.5
    : (hasAbility(r, "revenant") || hasAbility(r, "twinsoul")) ? 0.7
    : 1;
  // 第33弾（バランス是正）: 衰えが急すぎてピーク後わずか4年で崩壊していた（devlog/wave33.md
  // 実測：33歳で全能力94から63まで低下）。slope/capを緩め、キャリア終盤が「上昇→プラトー→
  // 緩やかな下降」の形になるようにした（33歳で78程度に留まる）。この関数はシーズン/マイライフ
  // 共有のため両モードのベテランが長持ちする。実測ではGF優勝率をほぼ動かさない（誤差範囲）。
  return { gain: 0.1 * mul, dec: Math.min(0.6, 0.12 * (r.age - pe)) * decayMul, tag: "衰え期" };
}

// v43(マイライフ難易度調整Phase 1・成長力マスク化): revealPow=falseの間はpowScoreを除外する
// （マイライフの成長力非公開期間中、この「伸びしろ」ヒントから逆算されないようにするため）。
// v46(素質ランク圧縮修正): powScoreを単純にゼロ化すると、公開時基準のしきい値(5/3)のままでは
// 「伸びしろ大」が非公開中は理論上到達不能になり常に中/小しか出ない（デビュー時の年齢×成長型
// 8万通りを実測：最大でも視認可能スコアは3どまり）。非公開時専用のしきい値を用意し、
// 視認可能スコアの取りうる値(1〜3がほぼ均等)全体に大/中/小を割り当てるよう較正した
// （scratchpad/potentialhint_calib.mjs）。
export function potentialHint(r, revealPow = true) {
  const phase = growthPhase(r).tag;
  const powScore = revealPow ? ({ S: 3, A: 2, B: 1, C: 0 }[r.growthPow] ?? 1) : 0;
  let score = powScore;
  if (phase === "成長期") score += 2;
  else if (phase === "全盛期") score += 1;
  const [ps] = GROWTH[r.growth].peak;
  if (r.age < ps - 3) score += 1;
  const T = revealPow ? { big: 5, mid: 3 } : { big: 3, mid: 2 };
  if (score >= T.big) return { label: "伸びしろ大", color: "#ffd23f" };
  if (score >= T.mid) return { label: "伸びしろ中", color: "#35c07e" };
  return { label: "伸びしろ小", color: "#9aa3b5" };
}

export function disciplineScore(r, key) { return Math.round(DISCIPLINES[key].calc(r)); }

export function buildDesc(build) { return build >= 66 ? "パワー型" : build >= 45 ? "標準" : "軽量型"; }

// v38(#9 B-1): 適性グレード（ウイポの適性表）。既存の種目別地力スコア（disciplineScore）に S〜G の
// 文字グレードを付与し「どの地形で輝くか」を一目で読めるようにする。数値の羅列より直感的で、将来の
// A案（因子で適性を継承）の土台にもなる。sim・スコアの算出式は不変（適性表と結果は矛盾しない）。
export function aptGrade(score) {
  if (score >= 90) return "S";
  if (score >= 82) return "A";
  if (score >= 74) return "B";
  if (score >= 66) return "C";
  if (score >= 58) return "D";
  if (score >= 50) return "E";
  if (score >= 42) return "F";
  return "G";
}
// 選手の種目別適性を {key,label,score,grade} で返す（DisciplineGrid 表示用）
export function riderAptitudes(r) {
  return DISCIPLINE_KEYS.map(k => {
    const score = disciplineScore(r, k);
    return { key: k, label: DISCIPLINES[k].label, score, grade: aptGrade(score) };
  });
}
