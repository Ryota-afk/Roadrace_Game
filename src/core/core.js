// 共有の低レベルロジック（RNG・能力ヘルパー・選手/名前生成・OVR）。Phase 2で分離。
import { ABILITIES, AB_KEYS, GROWTH, TYPES } from "../data/abilities.js";

// 選手ID採番の共有可変カウンタ（旧 let ridState.value）。所有はcore、他モジュールは .value を読み書き。
export const ridState = { value: 100 };

export function hasAbility(r, id) { return !!(r && r.abilities && r.abilities.includes(id)); }

export function rollAbilities(rng, opts = {}) {
  const goodPool = Object.keys(ABILITIES).filter(k => !ABILITIES[k].bad && !ABILITIES[k].breedOnly);
  const badPool = Object.keys(ABILITIES).filter(k => ABILITIES[k].bad);
  let n;
  if (opts.forceProdigy) n = rng() < 0.5 ? 2 : 3;
  else { const roll = rng(); n = roll < 0.35 ? 0 : roll < 0.75 ? 1 : roll < 0.95 ? 2 : 3; }
  const abilities = [];
  for (let i = 0; i < n; i++) {
    const wantBad = !opts.forceProdigy && rng() < 0.2;
    const pool = (wantBad ? badPool : goodPool).filter(k => !abilities.includes(k));
    if (pool.length === 0) continue;
    abilities.push(pool[Math.floor(rng() * pool.length)]);
  }
  return abilities;
}

export function hasGoldAbility(r, id) { return !!(r && r.goldAbilities && r.goldAbilities.includes(id)); }

export function countWins(r) { return (r.raceLog || []).filter(e => e.rank === 1).length; }

export function countRoleUses(r, pred) { return (r.raceLog || []).filter(pred).length; }

// 第46弾: raceLogのsegMix（第40弾で記録済み・既存セーブのレース履歴にも遡って効く）から
// レースの主要地形を1つに分類する。9種（岳人・鉄脚の巡航機関等）の取得条件が使う軸。
// 実測（devlog/wave46.md）で全6テンプレートが例外なくいずれかに分類されることを確認済み。
export const TERRAINS = ["climb", "flat", "hill", "solo"];
export function terrainOfMix(mix) {
  if (!mix) return null;
  if ((mix.tt || 0) >= 0.5) return "solo";
  if ((mix.climb || 0) + (mix.mtn || 0) >= 0.5) return "climb";
  if ((mix.hill || 0) >= 0.5) return "hill";
  if ((mix.flat || 0) >= 0.6) return "flat";
  return null;
}
export function terrainCount(r, terrain) { return (r.raceLog || []).filter(e => terrainOfMix(e.segMix) === terrain).length; }
export function terrainPodium(r, terrain, rankMax) { return (r.raceLog || []).filter(e => terrainOfMix(e.segMix) === terrain && e.rank <= rankMax).length; }
export function terrainWin(r, terrains) { return (r.raceLog || []).filter(e => terrains.includes(terrainOfMix(e.segMix)) && e.rank === 1).length; }
// 「全地形で満遍なく」を表す軸。4地形の最小値＝一番手薄な地形が足を引っ張る（1地形に
// 偏った専門選手は届きにくく、複数地形をこなす万能選手ほど伸びる）。
export function allTerrainMin(r, fn) { return Math.min(...TERRAINS.map(t => fn(r, t))); }
export function bigStagePodium(r, rankMax) { return (r.raceLog || []).filter(e => (e.monument || /世界選手権|オリンピック/.test(e.name || "")) && e.rank <= rankMax).length; }

// 第39弾: r=>booleanの不透明な条件をgate/cur/need/unitへ構造化し、進捗の分子を取り出せるように
// した（マイライフのバッジ進捗UIが使う）。GOLD_CONDITIONSは後方互換のため従来どおり
// {id: r=>boolean} 形で導出する（breeding.js・panels.jsxが存在チェック＋呼び出しに使用中）。
// unit: 進捗の単位表記（"勝"/"回"/空文字＝しきい値到達で即成立する一過性の条件）。
const countMonumentPodium = (mon, rankMax) => r => (r.raceLog || []).some(e => e.monument === mon && e.rank <= rankMax) ? 1 : 0;
export const GOLD_REQS = {
  mount:       { gate: r => r.type === "CLM", cur: countWins, need: 5, unit: "勝" },
  puncheur:    { gate: r => r.type === "PUN", cur: countWins, need: 5, unit: "勝" },
  flatlander:  { gate: r => r.type === "RUL", cur: countWins, need: 5, unit: "勝" },
  sprinter_sp: { gate: r => r.type === "SPR", cur: countWins, need: 5, unit: "勝" },
  soloist:     { gate: r => r.type === "TT", cur: countWins, need: 5, unit: "勝" },
  closer:      { cur: countWins, need: 8, unit: "勝" },
  escape:      { cur: r => countRoleUses(r, e => e.role === "breakaway"), need: 5, unit: "回" },
  domestique:  { cur: r => countRoleUses(r, e => ASSIST_ROLES.has(e.role)), need: 8, unit: "回" },
  // v28: 新特殊能力の金特条件
  finisher:    { cur: countWins, need: 8, unit: "勝" },
  engine:      { cur: r => (r.raceLog || []).length, need: 30, unit: "回" },
  // 第46弾: 万能さ＝全4地形で入賞できる選手のみ伸びる（1地形専門では頭打ち。devlog/wave46.md）
  allrounder_sp: { cur: r => allTerrainMin(r, (rr, t) => terrainPodium(rr, t, 5)), need: 6, unit: "回" },
  // v34(C-2): 各モニュメント（古典）を制覇すると、その古典専用の適性が金特に進化する（脚質別）
  pave_sp:     { cur: countMonumentPodium("pave", 1), need: 1, unit: "" },
  ardennes_sp: { cur: countMonumentPodium("ardennes", 1), need: 1, unit: "" },
  autumn_sp:   { cur: countMonumentPodium("autumn", 1), need: 1, unit: "" },
  // 第46弾: 「そのバッジらしい遊び方」の地形軸へ全面的に置き換え（旧軸は総出走数・総勝利数等の
  // 脚質非依存カウンタで、専門化してもしなくても同じ速さで埋まっていた。devlog/wave46.md）。
  kicker:      { cur: r => terrainWin(r, ["flat", "hill"]), need: 10, unit: "勝" },        // 平坦・丘陵で勝ち切る差し脚
  climbengine: { cur: r => terrainPodium(r, "climb", 5), need: 16, unit: "回" },           // 山岳で入賞を重ねた山の吸血鬼
  rouleur:     { cur: r => terrainCount(r, "flat"), need: 45, unit: "回" },                // 平坦を走り込んだ鉄脚
  grinder:     { cur: r => terrainCount(r, "hill"), need: 45, unit: "回" },                // 丘陵を走り込んだ食らいつく脚
  sponge:      { cur: r => allTerrainMin(r, terrainCount), need: 14, unit: "回" },         // 全地形をまんべんなく経験した
  allclimber:  { cur: r => terrainCount(r, "climb"), need: 45, unit: "回" },               // 山岳を制した岳人
  bigheart:    { cur: r => bigStagePodium(r, 3), need: 10, unit: "回" },                   // 大舞台の表彰台に立ち続けた
  diesel:      { cur: r => terrainCount(r, "solo"), need: 25, unit: "回" },                // 独走を重ねた鉄の心肺
};
// 第45弾: バッジを銅/銀/金/虹の4段階へ拡張。銀を間に挟み、虹を上に足す。devlog/wave44.md
// 「梯子（銅→銀→金→虹）」参照。
// - 自然な梯子10種（mount〜engine。銅=ACQUIRE_REQS・金=GOLD_REQS。値は一切動かしていない）：
//   silverNeed=round((銅+金)/2)・rainbowNeed=金×2
// 第46弾: 残る9種（allrounder_sp〜diesel）は元々「銅の取得条件が無く配合でしか手に入らない」
// ためsilverNeed=round(金×0.6)の仮の式を置いていたが、そもそも銅・金とも総出走数／総勝利数
// という脚質非依存の軸で、専門化してもしなくても同じ速さで埋まり「バッジで個性を出す」の
// 母集団になっていなかった（devlog/wave46.md）。銅・金の軸自体を地形別（山岳/平坦/丘陵/独走）
// のraceLog実績へ全面的に置き換え、銀・虹もその新しい軸の上で個別に設計した値（公式には
// 従わない。到達可能性を実測した上での明示的な設計値）。
// 石畳巧者/アルデンヌの狼/秋の女王（表彰台の二値）・鉄人/大舞台に強い（金条件なし）は
// 4段階化の対象外＝このテーブルに載せない（従来どおり銅/金の2段階のまま）。
export const TIER_LADDER = {
  mount:         { silverNeed: 4,  rainbowNeed: 10 },
  puncheur:      { silverNeed: 4,  rainbowNeed: 10 },
  flatlander:    { silverNeed: 4,  rainbowNeed: 10 },
  sprinter_sp:   { silverNeed: 4,  rainbowNeed: 10 },
  soloist:       { silverNeed: 4,  rainbowNeed: 10 },
  closer:        { silverNeed: 6,  rainbowNeed: 16 },
  escape:        { silverNeed: 4,  rainbowNeed: 10 },
  domestique:    { silverNeed: 7,  rainbowNeed: 16 },
  finisher:      { silverNeed: 7,  rainbowNeed: 16 },
  engine:        { silverNeed: 25, rainbowNeed: 60 },
  allrounder_sp: { silverNeed: 3,  rainbowNeed: 10 },
  kicker:        { silverNeed: 5,  rainbowNeed: 18 },
  climbengine:   { silverNeed: 8,  rainbowNeed: 28 },
  rouleur:       { silverNeed: 25, rainbowNeed: 70 },
  grinder:       { silverNeed: 25, rainbowNeed: 70 },
  sponge:        { silverNeed: 8,  rainbowNeed: 22 },
  allclimber:    { silverNeed: 25, rainbowNeed: 70 },
  bigheart:      { silverNeed: 5,  rainbowNeed: 18 },
  diesel:        { silverNeed: 10, rainbowNeed: 50 },
};

export const TIER_ORDER = ["bronze", "silver", "gold", "rainbow"];
export const TIER_LABEL = { bronze: "銅", silver: "銀", gold: "金", rainbow: "虹" };

// そのバッジの現在の段階（"bronze"|"silver"|"gold"|"rainbow"）。未所持ならnull。
// TIER_LADDER未登録（2段階のまま据え置きの種）はhasGoldAbilityの真偽だけで銅/金を返す
// （従来どおりの後方互換）。段階は一度到達したら永久に落ちない
// （r.silverAbilities/r.goldAbilities/r.rainbowAbilitiesはcp.jsのupgradeGoldAbilitiesが
// 加算のみで更新する。第42/43弾で確定した「退行は入れない」を4段階でも踏襲）。
export function badgeTier(r, id) {
  if (!hasAbility(r, id)) return null;
  if (!TIER_LADDER[id]) return hasGoldAbility(r, id) ? "gold" : "bronze";
  if (r && r.rainbowAbilities && r.rainbowAbilities.includes(id)) return "rainbow";
  if (hasGoldAbility(r, id)) return "gold";
  if (r && r.silverAbilities && r.silverAbilities.includes(id)) return "silver";
  return "bronze";
}

// 銅→金の値を線形補間/外挿して銀・虹の効果値を出す（devlog/wave44.md「効果」参照）。
// 加算値・乗算値のどちらも同じ式でよい（生の数値をそのまま補間するだけ）。
export function tierValue(bronze, gold, tier) {
  const delta = gold - bronze;
  if (tier === "rainbow") return gold + delta * 0.75;
  if (tier === "gold") return gold;
  if (tier === "silver") return bronze + delta * 0.5;
  return bronze;
}

export const GOLD_CONDITIONS = Object.fromEntries(
  Object.entries(GOLD_REQS).map(([id, q]) => [id, r => (!q.gate || q.gate(r)) && q.cur(r) >= q.need])
);

export const condMul = (c) => [0.92, 0.96, 1.0, 1.04, 1.08][c - 1];

export function mulberry(seed) {
  let a = seed | 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// v48(第10弾続き): 固定身分のAI選手（永続ロースター/チームメイト/ライバル）の能力ロールを
// id＋年でシードする共通ヘルパー。同じ年の中では常に同じ値になる＝「毎回別人」を防ぐ
// （既存のworldRosters/protegeが個別に書いていたのと同じ式を集約しただけ、新しい式ではない）。
export function idYearSeed(id, year) {
  return mulberry(((id * 2654435761) ^ ((year || 1) * 40503)) >>> 0);
}

// v48(第10弾続き): 土台の能力値をid+年で固定した副作用として、AI選手の「毎回微妙に違う」感触が
// 消えてしまう（急成長選手・絶好調の一週間のような表情が出ない）。effAbilities()に既にある
// フォーム（ピーキング）の仕組み（現状マイライフの自分自身専用・AI/シーズンはform未設定で無効）を
// AI選手にも小さめの幅で流用し、レースごとの当たり外れを土台を壊さず表現する。
// プレイヤーが意図して仕上げるピーキング（±約17%）より控えめな±5%程度に留める。
export function aiFormRoll(rng) {
  return 50 + (rng() - 0.5) * 30;
}

export const SURNAMES = [
  "相馬", "桐生", "白鳥", "早瀬", "神楽", "水城", "燕", "嵐山", "灰原", "東雲",
  "氷室", "真壁", "夏目", "御堂", "九条", "橘", "篝", "斑鳩", "黒崎", "鏡",
  "朝霧", "深月", "鷹羽", "竜崎", "天羽", "風間", "雪村", "藤堂", "綾小路", "一条",
  "二階堂", "銀河", "朔", "響", "澄川", "涼風", "月島", "星野", "千歳", "朝比奈",
  "西園寺", "北条", "高城", "結城", "雫石", "氷川", "風早", "花房", "星空", "銀水",
  "紅葉", "桜井", "藤崎", "藤宮", "神代", "天海", "蒼月", "蒼樹", "朝倉", "夕凪",
  "冬木", "秋月", "秋山", "五十嵐", "百瀬", "千葉", "常盤", "若宮", "大鷹", "小鳥遊",
  "南雲", "東條", "高杉", "高階", "桜小路", "藤枝", "天音", "夜久", "春日井", "夏川",
  "佐藤", "鈴木", "高橋", "田中", "渡辺", "伊藤", "山本", "中村", "小林", "加藤",
  "吉田", "山田", "佐々木", "山口", "松本", "井上", "木村", "林", "斎藤", "清水",
  "山崎", "森", "池田", "橋本", "阿部", "石川", "山下", "中島", "石井", "小川",
  "前田", "岡田", "長谷川", "藤田", "後藤", "近藤", "村上", "遠藤", "青木", "坂本",
  "福田", "太田", "西村", "藤井", "金子", "岡本", "松田", "中川", "中野", "原田",
  "小野", "田村", "竹内", "和田", "中山", "石田", "上田", "森田", "柴田", "酒井",
  "工藤", "横山", "宮崎", "宮本", "内田", "高木", "安藤", "島田", "谷口", "大野",
  "高田", "丸山", "今井", "河野", "藤原", "新井", "松井", "木下", "川口", "大塚",
  "小島", "田口", "平野", "菅原", "久保", "松岡", "野口", "中田", "大西", "竹田",
  "白石", "岩崎", "荒木", "鈴村", "三浦", "西田", "北村", "南田", "春日", "東野",
  // v28: 周回プレイで姓の被りが目立つとの指摘を受けさらに追加（実在頻度の高い姓を中心に）
  "野村", "小松", "武田", "上野", "杉山", "増田", "小山", "大久保", "丸田", "今村",
  "服部", "平田", "岩本", "田島", "望月", "永井", "浅野", "松浦", "河合", "星",
  "馬場", "菊地", "広瀬", "本田", "秋田", "根本", "野中", "堀", "神田", "沢田",
  "水野", "杉本", "大森", "須藤", "吉川", "飯田", "土屋", "堀内", "川崎", "関",
  "内藤", "松下", "浜田", "尾崎", "早川", "森本", "岡", "萩原", "小池", "村田",
  // v28: 姓も似た系統（藤◯・天◯・星◯…）で固まって見えるとの指摘を受け、漢字が散る実在姓をさらに追加
  "福井", "桑原", "岸本", "森下", "川上", "田辺", "富田", "平井", "黒木", "石橋",
  "三宅", "中西", "大橋", "篠原", "白川", "江口", "樋口", "山内", "竹中", "岡崎",
  "片山", "畑中", "板垣", "伊達", "稲垣", "宇野", "大内", "奥村", "香川", "神谷",
  "北川", "越智", "小澤", "阪本", "立花", "津田", "成田", "難波", "二宮", "沼田",
  "平塚", "福原", "前川", "松永", "三上", "水口", "宗像", "矢野", "柳沢", "米田",
  "若林", "浅井", "鵜飼", "海老原", "大隈", "柏木", "門脇", "北原", "楠", "河内",
  "小暮", "紺野", "笹川", "志村", "須賀", "瀬川", "高松", "田代", "土井", "堂本",
  "灘", "袴田", "日向", "深谷", "牧野", "槇島", "宮下", "毛利", "薬師寺", "湯川",
];

export const GIVEN = [
  "蓮", "岳", "走", "迅", "颯", "翼", "剛", "凌", "駆", "峻",
  "隼", "湊", "遼", "陸", "翔", "樹", "匠", "輝", "悠", "陽",
  "光", "智", "誠", "健", "潤", "晴", "涼", "昴", "蒼", "弦",
  "燦", "耀", "煌", "皓", "昂", "漣", "澪", "渚", "洸", "汐",
  "雷", "焔", "陣", "塁", "魁", "羽", "律", "尊", "崚", "岬",
  "朝", "暁", "昇", "昌", "明", "央", "心", "淳", "敦", "慧",
  "碧", "凪", "宙", "龍", "天", "空", "海", "舜", "駿", "豪",
  "猛", "進", "学", "勉", "潔", "実", "修", "治", "仁", "卓",
  "巧", "拓", "創", "想", "志", "元", "直", "正", "賢", "聡",
  "亮", "諒", "爽", "快", "康", "保", "守", "護", "勝", "優",
];

export const GIVEN2 = [
  "大輝", "翔太", "健太", "悠斗", "陽向", "颯太", "拓海", "海斗", "大和", "蓮司",
  "翔平", "涼介", "健吾", "雄大", "隼人", "直樹", "亮太", "翼", "駿介", "陽介",
  "圭介", "慎太郎", "航平", "悠真", "陽太", "大地", "琉生", "湊斗", "結翔", "陽斗",
  "駿太", "遼太郎", "光輝", "英輝", "和樹", "一輝", "拓也", "康平", "俊介", "壮一",
  "誠也", "友哉", "智也", "貴大", "秀樹", "篤志", "祐介", "洋平", "凌駕", "楓真",
  "壮太", "怜央", "颯真", "叶大", "碧斗", "奏太", "湊太", "悠斗", "櫂", "煌大",
  "晴斗", "陽翔", "大翔", "悠人", "蒼真", "颯馬", "眞人", "宗一郎", "誠一", "武尊",
  "隼太", "遥斗", "凪咲", "海翔", "汐音", "陣内", "駿平", "峻平", "翔真", "悠翔",
  "大成", "琉偉", "怜", "凰介", "京介", "岳人", "泰河", "颯人", "翠", "琥珀",
];

export function overall(r) {
  const vals = AB_KEYS.map(k => r[k]).sort((a, b) => b - a);
  return Math.round(vals[0] * 0.5 + vals[1] * 0.3 + (vals[2] + vals[3] + vals[4]) / 3 * 0.2);
}

export const ASSIST_ROLES = new Set(["lead", "sub", "mountain", "flat", "support", "experience"]);

export const GIVEN_ALL = [...GIVEN, ...GIVEN2];

export function pickRiderName(rng, banned) {
  let name, tries = 0;
  do {
    name = SURNAMES[Math.floor(rng() * SURNAMES.length)] + " " + GIVEN_ALL[Math.floor(rng() * GIVEN_ALL.length)];
    tries++;
  } while (banned && banned.has(name) && tries < 200);
  if (banned) banned.add(name);
  return name;
}

export function randPow(rng, dist) {
  const d = dist || [0.05, 0.25, 0.60];
  const x = rng();
  if (x < d[0]) return "S";
  if (x < d[1]) return "A";
  if (x < d[2]) return "B";
  return "C";
}

export const SUB_STAT_KEYS = ["accel", "build", "mental"];

export function genSubStats(type, rng, opts = {}) {
  const j = () => (rng() - 0.5) * 24;
  const accelBase = { SPR: 68, PUN: 64, RUL: 54, CLM: 44, TT: 42 }[type] ?? 50;
  const buildBase = { SPR: 68, RUL: 66, PUN: 52, TT: 48, CLM: 34 }[type] ?? 50;
  const persM = { genius: 8, smart: 5, seeker: 4, artisan: 2 }[opts.personality] ?? 0;
  const boost = opts.forceProdigy ? 10 : 0;
  const cl = (v) => Math.max(20, Math.min(95, Math.round(v)));
  // v43(マイライフ難易度調整Phase 1): 新ステータス「突破力」「安定感」。buildと同じく
  // 生まれつき固定・才能とは無関係（逸材補正なし）。判断⑳「ゆるやかに脚質差をつける
  // 程度」に基づき、buildのタイプ差(34〜68点)より狭い幅(44〜58点)に留めている。
  // 突破力：山岳・独走系（じっくり型）がやや高め、スプリンター（瞬発型）がやや低め。
  // 安定感：独走・平坦系（淡々と走る）がやや高め、スプリンター（爆発力型）がやや低め。
  const breakthroughBase = { CLM: 58, TT: 56, RUL: 52, PUN: 50, SPR: 44 }[type] ?? 50;
  const stabilityBase = { TT: 58, RUL: 56, PUN: 50, CLM: 48, SPR: 44 }[type] ?? 50;
  // 第18弾: スピリット（僚友と走る力）。ルーラー（献身の脚質）がやや高め、独走屋がやや低め。
  const spiritBase = { RUL: 56, PUN: 52, CLM: 50, SPR: 48, TT: 44 }[type] ?? 50;
  return {
    accel: cl(accelBase + j() + boost),
    build: cl(buildBase + j()), // 体格は才能とは無関係なので逸材補正なし
    mental: cl(48 + (rng() - 0.5) * 40 + persM + boost),
    breakthrough: cl(breakthroughBase + j()),
    stability: cl(stabilityBase + j()),
    // v43(マイライフ難易度調整Phase 2): 新ステータス「運」。脚質と運の間に論理的な関連が
    // 無いため、breakthrough/stabilityと違い脚質差はつけずbase50±ジッターのみ。
    luck: cl(50 + j()),
    // 第18弾: 新ステータス「スピリット」。breakthrough/stabilityと同じく生まれつき固定・
    // 才能とは無関係（逸材補正なし）。献身の脚質（ルーラー）がやや高め、独走屋がやや低め。
    spirit: cl(spiritBase + j()),
  };
}

export function newRider(power, rng, opts = {}) {
  const keys = Object.keys(TYPES);
  const type = opts.type || keys[Math.floor(rng() * keys.length)];
  // v35(バランス): 能力上限を可変に（既定94）。難易度の高いAIは opts.cap で94超の地力を持てる。
  const cap = opts.cap ?? 94;
  // 第31弾: opts.capOffsetにML_TYPE_CAP_OFFSET相当の表（type→abKey→オフセット）を渡すと、
  // 上限が能力ごとに変わる。typeがここで確定した後でないと引けないため、呼び出し側が
  // 個別に上限を計算するcapForコールバック方式ではなく表そのものを渡す形にしている
  // （newRider内部でtypeをランダム決定する呼び出しがあるため。詳細はdevlog/wave31.md）。
  // 未指定なら従来どおり全能力へcapを一律適用（シーズン側は無変更）。
  const capOf = (k) => cap + (opts.capOffset ? ((opts.capOffset[type] || {})[k] || 0) : 0);
  const clamp = (v, k) => Math.max(22, Math.min(capOf(k), Math.round(v)));
  const b = () => power + (rng() - 0.5) * 22;
  const r = { flat: b(), climb: b(), sprint: b(), stamina: b(), solo: b() };
  const bo = 14;
  if (type === "SPR") { r.sprint += bo; r.climb -= 9; }
  if (type === "CLM") { r.climb += bo; r.sprint -= 9; }
  if (type === "RUL") { r.flat += bo; r.stamina += 6; }
  if (type === "PUN") { r.climb += 7; r.sprint += 7; }
  if (type === "TT")  { r.solo += bo; r.flat += 6; }
  if (opts.abBonus) Object.entries(opts.abBonus).forEach(([k, v]) => { r[k] += v; });
  if (opts.forceProdigy) AB_KEYS.forEach(k => { r[k] += 12; }); // v8: 逸材はベース能力を底上げ
  AB_KEYS.forEach(k => r[k] = clamp(r[k], k));
  const age = opts.age ?? (22 + Math.floor(rng() * 12));
  const gKeys = Object.keys(GROWTH);
  // v14: マイライフの経歴選択（高卒/大卒/実業団卒）で成長タイプを明示指定できるように。
  // 指定が無ければ従来通りランダム（若年層はlate寄りの補正込み）
  let growth = opts.growth || gKeys[Math.floor(rng() * 3)];
  if (!opts.growth && age <= 19 && rng() < 0.5) growth = "late";
  // v19: ごく稀に「超早熟」「超晩成」という極端な成長タイプが出現する（明示指定時は対象外）
  if (!opts.growth) {
    const rare = rng();
    if (rare < 0.03) growth = "super_early";
    else if (rare < 0.06) growth = "super_late";
  }
  const abilities = rollAbilities(rng, { forceProdigy: opts.forceProdigy });
  const px = rng();
  let personality = px < 0.30 ? "normal" : px < 0.35 ? "genius"
    : ["hotblood", "seeker", "artisan", "free", "smart", "maverick", "showman", "tactician"][Math.floor(rng() * 8)];
  let growthPowVal = opts.growthPow || randPow(rng, opts.powDist);
  if (opts.forceProdigy) { personality = "genius"; growthPowVal = "S"; }
  const sub = genSubStats(type, rng, { personality, forceProdigy: opts.forceProdigy });
  const rider = {
    id: ridState.value++,
    name: pickRiderName(rng, opts.banned),
    type, ...r, ...sub, age, growth, growthPow: growthPowVal, abilities, personality,
    fatigue: 20 + Math.floor(rng() * 20), cond: 3, condForecast: (rng() < 0.34 ? -1 : rng() < 0.5 ? 0 : 1), injury: 0, streak: 0,
    focus: "flat", joinOvr: 0, parts: { frame: null, tire: null, wheels: null, nutrition: null },
    prodigy: !!opts.forceProdigy,
    raceLog: [], // v13: 選手名鑑用の出走履歴（{year, month, name, rank}）
    favorite: false, // v13.1: お気に入り登録（殿堂入り条件を満たさなくても必ず記録に残す）
    tenure: 0, // v17: チームケミストリー用の在籍月数（加入時は常に0からスタート）
  };
  rider.joinOvr = overall(rider);
  return rider;
}

export function strHash(s) {
  let h = 9;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489);
  return (h ^ (h >>> 9)) >>> 0;
}


// --- 表示フォーマッタ（Phase 3で移設）---
export function fmtTime(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, "0")}`; }

export function fmtGap(sec) { return sec < 0.5 ? "TOP" : `+${fmtTime(sec)}`; }

// v35(UI): セーブ時刻の相対表示（続きからの安心感）。
export function fmtRelTime(ts) {
  if (!ts) return "";
  const d = Date.now() - ts;
  if (d < 0) return "たった今";
  const min = Math.floor(d / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}日前`;
  const mon = Math.floor(day / 30);
  return `${mon}ヶ月前`;
}
