// 共有の低レベルロジック（RNG・能力ヘルパー・選手/名前生成・OVR）。Phase 2で分離。
import { ABILITIES, AB_KEYS, GROWTH, TYPES } from "../data/abilities.js";
import { C } from "../data/theme.js";

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

export const GOLD_CONDITIONS = {
  mount:       r => r.type === "CLM" && countWins(r) >= 5,
  puncheur:    r => r.type === "PUN" && countWins(r) >= 5,
  flatlander:  r => r.type === "RUL" && countWins(r) >= 5,
  sprinter_sp: r => r.type === "SPR" && countWins(r) >= 5,
  soloist:     r => r.type === "TT" && countWins(r) >= 5,
  closer:      r => countWins(r) >= 8,
  escape:      r => countRoleUses(r, e => e.role === "breakaway") >= 5,
  domestique:  r => countRoleUses(r, e => ASSIST_ROLES.has(e.role)) >= 8,
  // v28: 新特殊能力の金特条件
  finisher:    r => countWins(r) >= 8,
  engine:      r => (r.raceLog || []).length >= 30,
  allrounder_sp: r => countWins(r) >= 6,
};

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
  return {
    accel: cl(accelBase + j() + boost),
    build: cl(buildBase + j()), // 体格は才能とは無関係なので逸材補正なし
    mental: cl(48 + (rng() - 0.5) * 40 + persM + boost),
  };
}

export function newRider(power, rng, opts = {}) {
  const keys = Object.keys(TYPES);
  const type = opts.type || keys[Math.floor(rng() * keys.length)];
  const clamp = (v) => Math.max(22, Math.min(94, Math.round(v)));
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
  AB_KEYS.forEach(k => r[k] = clamp(r[k]));
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
    : ["hotblood", "seeker", "artisan", "free", "smart"][Math.floor(rng() * 5)];
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
