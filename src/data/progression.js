// 静的データ（Phase 1で src/main.jsx から分離）。純粋な定数のみ。

export const CLASSES = [
  { id: "B1", label: "クラス B1", prizeMul: 1.0, need: 45, scout: 58 },
  { id: "A",  label: "クラス A",  prizeMul: 2.0, need: 50, scout: 66 },
  { id: "PRO", label: "クラス PRO", prizeMul: 3.5, need: 60, scout: 74 },
];

// v50(第11弾Phase1・1-D): シーズンのポイントを「上位10位内の全選手合算」へ変更したことで、
// 1レースあたりの獲得ptが従来（自チーム最上位1人分だけ）よりかなり増えた。CLASSES.needは
// マイライフの昇格判定（controllers/mylife/month.js、ポイント式は変更していない＝旧のまま）
// とも共有しているため、needの値自体は変えず、シーズン側だけ表示・判定に掛ける倍率として
// 独立させる。実測（scratchpad/need_calib.mjs・25チーム構成でのシーズン相当11ヶ月の
// AIチーム獲得pt平均）：B1平均159/A平均178.5/PRO平均202。旧式では平均AI獲得pt≒need×1.38
// だったため、同じ「needは平均よりやや控えめな到達可能ライン」という関係を保つ倍率として
// 2.5を採用（B1:112.5≈115／A:125≈130／PRO:150）。**実プレイでの昇格成功率を見て
// 要再調整**（devlog/wave11.md参照）。
export const SEASON_NEED_MUL = 2.5;

// シーズン側だけが参照する「実際の昇格ライン」。CLASSES[classIdx].needそのものは
// マイライフと共有の生値として変えず、表示・判定はこの関数経由に統一する。
export function seasonNeed(classIdx) {
  return Math.round(CLASSES[classIdx].need * SEASON_NEED_MUL);
}

// v35(バランス): abilCap＝AI選手の能力値上限。newRiderは従来どこでも一律94で頭打ちだったため、
// PRO帯ではaiMul（1.25/1.55）を掛けても地力がすべて94でクランプされ、ハードと鬼がPROで完全に
// 同一の強さになっていた（難易度つまみが高クラスで効かない不具合。実測：PRO/y8でhard5.6位＝oni5.5位）。
// 最小の是正として、opt-inの「無理ゲー」帯である鬼だけ上限を94→104へ引き上げ、PROでもハードより
// 明確に強い化け物集団にする。easy/normal/hardは94で据え置き＝これまでの手応えを一切変えない。
// 鬼のプレイヤー成長上限は112で、AI上限104を超えるため、極めた選手なら地力で上回る脱出口は残る。
// 第99弾(TODO #32-b): descはシーズンのgrowthCap（88/94/102/112＝難易度が上がるほど上限も上がる）を
// 説明した文だが、マイライフはこのgrowthCapを一切使わず、mlGrowthCapのML_GROWTHCAP_DIFF_MUL
// （easy1.3／normal1.0／hard0.75／oni0.5）で「実績1つあたりが伸びしろをどれだけ広げるか」を決める
// ＝難易度が上がるほど上限は伸びにくい。両モードで同じdescを出すと鬼で説明が逆になるため、
// マイライフ用の文をmlDescとして分けて持つ（screens/mylife/create.jsxが参照）。
export const DIFFICULTIES = [
  { id: "easy", label: "イージー", desc: "他チームはかなり控えめ。まずはここでクリアを目指そう", mlDesc: "相手はかなり控えめ。勝利やタイトルで伸びしろが大きく広がる", aiMul: 0.80, growthCap: 88, needCP: 0, abilCap: 94 },
  { id: "normal", label: "ノーマル", desc: "標準的な強さ。歯応えのある本来のバランス", mlDesc: "標準的な強さ。歯応えのある本来のバランス", aiMul: 1.0, growthCap: 94, needCP: 4, abilCap: 94 },
  { id: "hard", label: "ハード", desc: "他チームは強豪揃い。選手の成長上限も上がるが、相手はさらに本気を出してくる", mlDesc: "相手は強豪揃い。勝利やタイトルを重ねても伸びしろは広がりにくい", aiMul: 1.25, growthCap: 102, needCP: 10, abilCap: 94 },
  { id: "oni", label: "鬼", desc: "完全な無理ゲー。成長上限は大幅に上がるが、他チームは化け物揃い。生半可な覚悟でクリアできると思うな", mlDesc: "完全な無理ゲー。相手は化け物揃いで、勝ち続けても伸びしろはなかなか広がらない", aiMul: 1.55, growthCap: 112, needCP: 20, abilCap: 104 },
];

export const TITLE_DEFS = [
  { key: "grandTour", label: "グランツール総合優勝" },
  { key: "grandFinal", label: "グランファイナル制覇" },
  { key: "worlds", label: "世界選手権優勝" },
  { key: "olympics", label: "オリンピック優勝" },
];

// ── 種目・成長・チーム関連の分類テーブル（Phase 4-1後の support.js から分離）──

export const CLASS_TIER_COLOR = ["#9aa3b5", "#4f8fe8", "#ffd23f"];

export const GROWTHPOW_ORDER = ["C", "B", "A", "S"];

export const GROWTH_ORDER = ["early", "normal", "late", "super_late"];

export const DISCIPLINES = {
  flat:   { label: "平坦",      calc: r => r.flat * 0.6 + r.solo * 0.25 + r.stamina * 0.15 },
  climb:  { label: "山岳",      calc: r => r.climb * 0.7 + r.stamina * 0.3 },
  sprint: { label: "スプリント", calc: r => r.sprint * 0.7 + r.flat * 0.2 + r.stamina * 0.1 },
  solo:   { label: "独走（TT）", calc: r => r.solo * 0.7 + r.stamina * 0.3 },
  hill:   { label: "丘陵",      calc: r => r.climb * 0.4 + r.sprint * 0.4 + r.stamina * 0.2 },
};

export const DISCIPLINE_KEYS = Object.keys(DISCIPLINES);

// 第72弾(devlog/wave72.md): RULが欠落していた。平坦ロード新設に伴い"flat"を追加——
// これで出走計画（第70弾）・キャラ作成の出走計画選択肢（create.jsxのfocusOptions）が
// RULでも機能するようになる。
export const FAVORS_TO_DISCIPLINE = { SPR: "sprint", CLM: "climb", PUN: "hill", TT: "solo", RUL: "flat" };

// v43(マイライフ難易度調整Phase 1): 突破力・安定感を追加（新ステータス。生成はcore/core.jsのgenSubStats参照）
export const SUB_STAT_LABEL = { accel: "加速力", build: "体格", mental: "メンタル", breakthrough: "突破力", stability: "安定感" };

export const CHEMISTRY_TIERS = [
  { min: 30, label: "鉄壁の絆", mul: 0.92 },
  { min: 15, label: "円熟したチーム", mul: 0.95 },
  { min: 6,  label: "定着期", mul: 0.98 },
  { min: 0,  label: "新体制", mul: 1 },
];

export const ABILITY_CATEGORY_ORDER = ["地形適性", "展開・役割", "メンタル", "フィジカル", "成長", "配合限定", "血脈レシピ"];

export const ML_AMBITION_PATH_KEYS = ["victory", "bigstage", "devotion", "world", "ironman", "stardom"];

export const APT_GRADE_COLOR = { S: "#ffd23f", A: "#ff8a5c", B: "#e8734a", C: "#6fbf73", D: "#4f8fe8", E: "#8a93a6", F: "#8a93a6", G: "#5a6274" };

export const GROWTH_POW_LADDER = ["C", "B", "A", "S"];

// v35(バランス): 作戦の説明を実測（Node頭付き比較）に合わせて正直化。
// 各tacticの tag = 一目でわかる向き・リスク、desc = 実際の効き方（どのコース・脚質で得か）。
// 検証で判明した要点：末脚温存＝平坦スプリントで堅実／早めに逃げる＝多くは吸収され着順は落ちる
// 博打だが集団ゴールで勝てない脚質の唯一の一発（起伏・山岳で逃げ切りやすい）／積極＝非スプリント型が
// 終盤に仕掛けて先着を狙う（スプリント型は末脚を消して不利）。
// 第15弾F: state.js → sim/buildMyLifeSim.jsへ移した際、simレイヤーがstateレイヤーへ逆依存
// しないようここ（data/）へ移設（元は state/state.js にあった）。
export const ML_TACTICS = {
  balanced:   { label: "標準（流れに任せる）",       tag: "無難", tagColor: "#9aa3b5", chaseMode: "normal", aceEarly: false, desc: "特別な仕掛けはせず、脚質と展開に任せる。迷ったらまずこれ" },
  wait:       { label: "末脚温存（集団スプリント狙い）", tag: "堅実・平坦向き", tagColor: "#4fbf6b", chaseMode: "push",   aceEarly: false, desc: "逃げを潰して集団を保ち、ゴールスプリントで勝負。スプリント型・平坦/クリテで最も安定して上位に入る" },
  early:      { label: "早めに逃げる",               tag: "博打・起伏向き", tagColor: "#e8734a", chaseMode: "normal", aceEarly: false, playerBreakaway: true, desc: "ハイリスクな作戦で、多くは吸収されて平均着順は落ちる。だが集団スプリントで勝てない脚質が「一発」を狙える唯一の手。平坦より起伏・山岳の方が逃げ切りやすい" },
  aggressive: { label: "積極的に仕掛ける",            tag: "非スプリント型向き", tagColor: "#e8a13c", chaseMode: "normal", aceEarly: true,  desc: "終盤にエース自ら加速して先着を狙う。集団ゴールで分が悪い登坂・独走・パンチャー型向き。スプリント型は末脚を消すので不利" },
  // v48(第10弾): chaseMode:"push"を撤去。実測でこれ自体がチーム成績を悪化させる主犯だった
  // （集団のローテを速める効果で献身の意味論には無関係）。献身の効果はチームドラフト
  // （sim/race.js）に一本化する。
  assist:     { label: "アシストに徹する",            tag: "献身", tagColor: "#5aa9e6", chaseMode: "normal", aceEarly: false, playerAssist: true, desc: "自分の勝ちを捨ててエースを風除けで支える献身の走り。監督指示に関わらず必ずアシスト戦としてカウントされ、監督評価も下がらない（献身の道向き）" },
};

