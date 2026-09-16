// 集団の役割ラベル（独走／逃げ集団／追走集団／ペロトン／遅れた集団）の算出を純関数化。
// 第39弾で俯瞰マップ用にRaceView.jsxのJSX内に書かれていたロジックを、第101弾で
// 「あなた」の帯（走行中に自分がどの集団にいるかを言葉で出す）と共有するため抽出した。
// ラベル文言・配色・しきい値は一切変えていない（表示は1ピクセルも変えない・devlog/wave101.md）。

// riders: { gid, frac } を持つオブジェクトの配列（RaceView.jsxのridersUi/ridersと同じ形。
// 他のフィールドが付いていても無視する）。集団が1つしか無いときはnullを返す
// （＝画面には「どの集団か」を出す意味が無い）。
export function computeRaceGroups(riders) {
  if (!riders || riders.length < 2) return null;
  const byG = {};
  riders.forEach(r => { (byG[r.gid] = byG[r.gid] || []).push(r); });
  const groups = Object.values(byG).map(m => ({
    m, gid: m[0].gid, n: m.length,
    front: Math.max(...m.map(r => r.frac)),
    cx: m.reduce((s, r) => s + r.frac, 0) / m.length,
  }));
  if (groups.length < 2) return null;
  groups.sort((a, b) => b.front - a.front);
  const pelotonN = Math.max(...groups.map(g => g.n));
  groups.forEach((g, i) => {
    if (g.n === pelotonN && g.n >= 5) g.label = { t: "ペロトン", c: "#cfd6e4" };
    else if (i === 0) g.label = { t: g.n === 1 ? "独走" : "逃げ集団", c: "#ffd23f" };
    else if (g.front < groups[0].front && g.n >= 1 && i < groups.length - 1) g.label = { t: "追走集団", c: "#7fd6a0" };
    else g.label = { t: "遅れた集団", c: "#9aa3b5" };
  });
  return groups;
}

// 指定gidが属する集団のラベルを返す（集団が1つしか無い・該当gidが見つからない場合はnull）。
// 第101弾（devlog/wave101.md）：走行中に「あなたは今どの集団にいるか」を言葉で出す帯に使う。
export function groupLabelFor(riders, gid) {
  const groups = computeRaceGroups(riders);
  if (!groups) return null;
  const g = groups.find(x => x.gid === gid);
  return g ? g.label : null;
}
