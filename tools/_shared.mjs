// 計測ツール共通のヘルパ（第97弾§4.13で新設）。
//
// 【なぜ要るか】
// ⚠️`mlCreateChar()`が返す`races`は「その月のレース候補3件」であって年間日程ではない。
// これを`s.races.filter(...)`のように全部使うと、⚠️**キャリア1年目の2〜3レースだけを
// 繰り返し測ることになる**（第96弾§7.9〜第97弾§4.12の「円熟期」の計測がすべてこれだった
// ——能力を100にしクラスをPROにしても、⚠️走るコースは新人1年目のグラベルと丘陵ロードの
// ままで、山岳ロードを一度も走っていなかった）。
//
// ⚠️**`es[0]`事故（第96弾§7）と同じ類型**：便利な既存フィールドをそのまま使い、
// それが何を指すか確認しなかった。どちらも「それらしい値が返る」ので誤りに気づけない。
//
// 実際の年間日程は`mlGenRaceCandidates(year, month, classIdx, focus)`を12ヶ月ぶん
// 呼んで集める。クラス・年次で内訳は大きく変わる（実測）：
//   新人1年目/B1  28レース（グラベル4・クリテ4・TTステージ4・ヒルクライム3・丘陵3…）
//   中堅5年目/A   27レース（個人TT6・TTステージ3・平坦3・グラベル3…）
//   円熟9年目/PRO 25レース（⚠️山岳ロード4・チームTT3・丘陵3・サーキット3…）

// キャリアのその年に実際に出走しうるレースを全部返す。
//   R        … src の絶対パス
//   year     … 1始まり
//   classIdx … 0=B1 / 1=A / 2=PRO
//   opts.focus       … 宣言した適性（既定は未宣言）
//   opts.includeTT   … チームTT・個人TTを含めるか（既定false＝判断カードが出ないため除外）
export async function careerRaces(R, year, classIdx, opts = {}) {
  const { focus = [null, null], includeTT = false } = opts;
  const { mlGenRaceCandidates } = await import(`${R}/domain/mylife/race.js`);
  const out = [];
  for (let month = 0; month < 12; month++) {
    for (const r of mlGenRaceCandidates(year, month, classIdx, focus) || []) {
      if (!includeTT && r.tmpl && (r.tmpl.teamTT || r.tmpl.soloTT)) continue;
      out.push(r);
    }
  }
  return out;
}

// クラスに対応する「その段階らしい年次」。--yearを省いたときの既定値に使う。
export function defaultYearFor(classIdx) {
  return classIdx >= 2 ? 9 : classIdx === 1 ? 5 : 1;
}
