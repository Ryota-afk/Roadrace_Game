// マイライフの月次レース生成（純粋なジェネレータ関数）。Step7第3弾でmain.jsxから分離。
// controllers/mylife/month.js・screens/mylife/hub.jsx・main.jsx（mlCreateChar等の未抽出ハンドラ）
// の複数箇所から参照されるため、controllers/ではなくdomain/に置く。
import { ML_MONUMENTS, TEMPLATES, VENUES } from "../../data/course.js";
import { mulberry } from "../../core/core.js";
import { rollWeather } from "../../sim/race.js";
import { unlockedTemplates } from "../../state/state.js";

export function mlGenRace(year, month, classIdx) {
  if (month === 5 && classIdx >= 1) {
    const wrng = mulberry(year * 401 + month * 7 + 501);
    return { id: `ml-worlds-${year}`, name: `${year}年目 世界選手権ロードレース`, tmpl: TEMPLATES[2], grade: 4, cls: classIdx, milestone: "worlds", rivalPresent: true, rival2Present: true, weather: rollWeather(wrng) };
  }
  if (month === 3 && classIdx >= 2 && (year - 1) % 4 === 0) {
    const wrng = mulberry(year * 401 + month * 7 + 502);
    return { id: `ml-olympics-${year}`, name: `${year}年目 オリンピック ロードレース`, tmpl: TEMPLATES[3], grade: 4, cls: classIdx, milestone: "olympics", rivalPresent: true, rival2Present: true, weather: rollWeather(wrng) };
  }
  // v33.11: モニュメント（クラシック）。特定の月は格式高いワンデー古典が開催される
  const mon = ML_MONUMENTS.find(m => m.month === month);
  if (mon) {
    const mrng = mulberry(year * 401 + month * 7 + 613);
    return { id: `ml-mon-${mon.id}-${year}`, name: `${year}年目 ${mon.name}`, tmpl: mon.tmpl, grade: mon.grade, cls: classIdx, monument: mon.id, monumentName: mon.name, rivalPresent: true, rival2Present: mrng() < 0.5, weather: rollWeather(mrng) };
  }
  const rng = mulberry(year * 3001 + month * 97 + classIdx * 17);
  const pool = unlockedTemplates();
  const t = pool[Math.floor(rng() * pool.length)];
  const grade = month === 11 ? 3 : 1 + Math.floor(rng() * 3);
  // v15: 約45%の確率でその月のレースにライバルが出走してくる（rival自体はキャラ作成時に固定生成済み）
  const rivalPresent = rng() < 0.45;
  // v26: 2人目のライバル（好敵手）も独立した確率で出走してくる
  const rival2Present = rng() < 0.45;
  return { id: `ml-${year}-${month}`, name: `${VENUES[Math.floor(rng() * VENUES.length)]}${t.kind}`, tmpl: t, grade, cls: classIdx, rivalPresent, rival2Present, weather: rollWeather(rng) };
}
