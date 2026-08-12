// 演出専用の疑似乱数ハッシュ（純関数・JSX非依存＝Node単体テスト可能）。
//
// 【背景・v46(#32)】sim/race.js の riderHash01 は
// `((id*2654435761 + salt*40503) % 100000) / 100000` という式だが、
// 2654435761 mod 100000 = 35761 のため実質的に一次式（線形写像）に退化している。
// つまり salt を+1すると出力は必ず+0.62012（mod 1）、id を+1すると必ず+0.35761（mod 1）
// だけ一定シフトする。この規則性が FinalSprintCinematic の集団描画（packShapeの揺れ・
// laneOfの横位置）に「楕円軌道」状の周期的なジッターとして現れていた。
// sim側のriderHash01/riderWanderは着順の乱数に使われているため変更できない
// （変更するとレース結果が変わってしまう）。そのため演出だけをこちらの
// ビット混合ハッシュに差し替える。
function mix32(x) {
  x |= 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = x ^ (x >>> 16);
  return x >>> 0;
}

export function viewHash01(id, salt) {
  return mix32(id * 374761393 + salt * 668265263) / 4294967296;
}

// riderWander（sim/race.js）と同じ形の周期ゆらぎだが、viewHash01を使う演出専用版。
export function viewWander(id, salt, tSec, baseFreq) {
  const h1 = viewHash01(id, salt), h2 = viewHash01(id, salt + 1);
  const f1 = baseFreq * (0.6 + h1 * 0.8);
  const f2 = f1 * (1.7 + h2 * 0.6);
  return 0.65 * Math.sin(tSec * f1 * Math.PI * 2 + h1 * Math.PI * 2)
       + 0.35 * Math.sin(tSec * f2 * Math.PI * 2 + h2 * Math.PI * 2);
}
