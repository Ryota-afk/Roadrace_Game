// マイライフの月次レース生成（純粋なジェネレータ関数）。Step7第3弾でmain.jsxから分離。
// controllers/mylife/month.js・screens/mylife/hub.jsx・main.jsx（mlCreateChar等の未抽出ハンドラ）
// の複数箇所から参照されるため、controllers/ではなくdomain/に置く。
import { ML_MONUMENTS, TEMPLATES, VENUES } from "../../data/course.js";
import { mulberry } from "../../core/core.js";
import { FAVORS_TO_DISCIPLINE } from "../../data/progression.js";
import { rollWeather } from "../../sim/race.js";

// 第41弾: 看板レース（世界選手権・五輪・古典・年度末）は従来どおり1本だけを返す
// （選択肢を出すと格が下がるため）。通常月だけ3本の候補を返す。候補ごとに地形・グレード・
// 天候・ライバル出走が個別に振られ、「格上だが苦手な地形」vs「格下だが得意な地形」の
// 迷いを作る（devlog/wave41.md）。生成は決定的（同じ年・月・クラスなら常に同じ候補）。
// 第43弾: 第4引数focus（climb/hill/sprint/solo/null）。通常月のみ、focusと同じ適性の
// テンプレを1本先に確保してから残りを引く。focus=nullなら旧実装とバイト単位で同一の出力
// （RNGの消費順を一切変えない・devlog/wave43.md）。看板レース月は無変更。
// 第74弾(devlog/wave74.md・TODO#27-b): focusは文字列（1地形）または配列（複数地形）を
// 受け付ける。マイライフは月1レースしか走れないため「同じ地形の2本目」には意味が無く、
// CPショップm_plan2は「2本目」ではなく「2地形目」を買う商品に作り替えた（旧focusSlots引数は廃止）。
// focusが文字列、または長さ1の配列のときはfocus指定の第43弾とバイト単位で同一の出力になる。
export function mlGenRaceCandidates(year, month, classIdx, focus) {
  // 第81弾(devlog/wave75.md「第81弾」・TODO#26/27-e/28): 旧実装は全年で丘陵ロード(PUN)
  // 固定だった。8月のアルデンヌ(PUN)と役割が重複するうえ、看板レース（候補1本の月）が
  // 報いる脚質にSPR・TTが1つも無かった（CLM3・PUN2・RUL1・SPR0・TT0）。⚠️月を消費せず
  // TTに見せ場を与える代案として、サーキットレース(SPR)と個人TT(TT)の2択にする——
  // これ1つでSPRとTTの両方に看板レースができ、候補1本の月は6/12→5/12へ減る。
  if (month === 5 && classIdx >= 1) {
    const wrng = mulberry(year * 401 + month * 7 + 501);
    const weather = rollWeather(wrng);
    return [
      { id: `ml-worlds-${year}-road`, name: `${year}年目 世界選手権ロードレース`, tmpl: TEMPLATES[1], grade: 4, cls: classIdx, milestone: "worlds", rivalPresent: true, rival2Present: true, weather },
      { id: `ml-worlds-${year}-tt`, name: `${year}年目 世界選手権 個人TT`, tmpl: TEMPLATES[5], grade: 4, cls: classIdx, milestone: "worlds", rivalPresent: true, rival2Present: true, weather },
    ];
  }
  if (month === 3 && classIdx >= 2 && (year - 1) % 4 === 0) {
    const wrng = mulberry(year * 401 + month * 7 + 502);
    return [{ id: `ml-olympics-${year}`, name: `${year}年目 オリンピック ロードレース`, tmpl: TEMPLATES[3], grade: 4, cls: classIdx, milestone: "olympics", rivalPresent: true, rival2Present: true, weather: rollWeather(wrng) }];
  }
  // v33.11: モニュメント（クラシック）。特定の月は格式高いワンデー古典が開催される
  const mon = ML_MONUMENTS.find(m => m.month === month);
  if (mon) {
    const mrng = mulberry(year * 401 + month * 7 + 613);
    return [{ id: `ml-mon-${mon.id}-${year}`, name: `${year}年目 ${mon.name}`, tmpl: mon.tmpl, grade: mon.grade, cls: classIdx, monument: mon.id, monumentName: mon.name, rivalPresent: true, rival2Present: mrng() < 0.5, weather: rollWeather(mrng) }];
  }
  const rng = mulberry(year * 3001 + month * 97 + classIdx * 17);
  const pool = TEMPLATES;
  // 3月（年度末）は従来どおりグレード3固定・候補1本のまま（看板レース扱い）
  const n = month === 11 ? 1 : 3;
  // 地形は重複なしで引く（部分Fisher-Yates。TEMPLATESは常時6種以上あるためn<=poolで足りる）
  const order = pool.map((_, i) => i);
  for (let i = 0; i < Math.min(n, order.length); i++) {
    const j = i + Math.floor(rng() * (order.length - i));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let indices = order.slice(0, n);
  // 第43弾: focus指定時、通常月（n===3）は候補の先頭を宣言した適性のテンプレへ差し替える。
  // 候補が複数あれば追加で1回rng()を消費して選ぶ（focusが文字列、または長さ1の配列なら
  // この1本目の差し替えのみで、旧実装とバイト単位で同一の出力）。
  // 第74弾: focusが配列のとき、2番目以降の要素は別枠（別の地形）を差し替える。
  // 同じ地形を2回書いても2本目は増えない（used集合はテンプレindex単位で共有するため）。
  const foci = (Array.isArray(focus) ? focus : [focus]).filter(Boolean);
  if (foci.length && n === 3) {
    const usedMatchIdx = new Set();
    for (let slot = 0; slot < Math.min(foci.length, n); slot++) {
      const matches = pool.map((t, i) => i).filter(i => (FAVORS_TO_DISCIPLINE[pool[i].favors] || "flat") === foci[slot] && !usedMatchIdx.has(i));
      if (matches.length === 0) continue;
      const focusIdx = matches.length === 1 ? matches[0] : matches[Math.floor(rng() * matches.length)];
      usedMatchIdx.add(focusIdx);
      if (!indices.includes(focusIdx)) indices = indices.map((idx, k) => k === slot ? focusIdx : idx);
    }
  }
  const candidates = [];
  for (let i = 0; i < n; i++) {
    const t = pool[indices[i % indices.length]];
    const grade = month === 11 ? 3 : 1 + Math.floor(rng() * 3);
    // v15: 約45%の確率でその月のレースにライバルが出走してくる（rival自体はキャラ作成時に固定生成済み）
    const rivalPresent = rng() < 0.45;
    // v26: 2人目のライバル（好敵手）も独立した確率で出走してくる
    const rival2Present = rng() < 0.45;
    const id = n === 1 ? `ml-${year}-${month}` : `ml-${year}-${month}-${i}`;
    candidates.push({ id, name: `${VENUES[Math.floor(rng() * VENUES.length)]}${t.kind}`, tmpl: t, grade, cls: classIdx, rivalPresent, rival2Present, weather: rollWeather(rng) });
  }
  return candidates;
}

// 既存呼び出し（domain/mylife/worldRank.js等・自分が出ていないクラスの地形/グレード取得用）は
// 1本で足りるため、候補配列の先頭を返す薄いラッパとして残す。他クラスの選手を扱うため
// focusは渡さない（プレイヤーの出走計画と無関係・devlog/wave43.md）。
export function mlGenRace(year, month, classIdx) {
  return mlGenRaceCandidates(year, month, classIdx)[0];
}

// 第41弾: ml.sel.raceIdで選択中のレースを解決する。未選択（null・該当なし）なら
// races[0]にフォールバック——旧セーブ（races長さ1・sel.raceId未設定）はこれで従来と同じ挙動になる。
export function mlSelectedRace(ml) {
  const races = ml.races || [];
  if (races.length === 0) return null;
  const sel = ml.sel && ml.sel.raceId;
  if (sel != null) {
    const found = races.find(r => r.id === sel);
    if (found) return found;
  }
  return races[0];
}
