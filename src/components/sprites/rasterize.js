// ドット絵グリッド（pixelSprite()と同じrows/legend形式）をcanvasで1回だけラスタライズし、
// data URLとしてキャッシュするヘルパー。Wave 6(#29)。
//
// 【背景】pixelSprite()は1ピクセル=1個の<rect>を出力するため、自転車1体で約900個、
// 集団スプリント演出では「色×3姿勢×クランク2コマ」を毎回<defs>に並べて数万ノードになり、
// 毎フレームのスタイル解決コストで描画が破綻していた（実測：色数12で2.3fps）。
// 同じ絵（色×姿勢×dir×クランクコマの組み合わせ）は見た目が完全に静的なので、
// 一度canvasに焼いてラスタ画像化すれば、あとは<image>1ノードの参照だけで済む。
//
// キャッシュは「同一キーには同一オブジェクトを返す」ことが重要：Reactに新しいオブジェクト/
// 文字列を渡すと属性の差分検出コストが余計に乗るため、毎フレーム呼ばれても同じ参照を返す。
const cache = new Map();

// rows: pixelSprite()と同じ1文字=1マスの文字列配列（"."=透明）。legend: 文字→"#rrggbb"。
// cacheKey: 呼び出し側が「この絵を一意に決める全パラメータ」から組み立てた文字列
// （例：`${posture}-${dir}-${tableIdx}-${color}`）。
// 戻り値: { url, w, h }（wはrows[0]の幅、hはrowsの行数＝マス単位）。
export function spriteImageUrl(rows, legend, cacheKey) {
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r ? r.length : 0), 0);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  for (let r = 0; r < h; r++) {
    const rowStr = rows[r];
    if (!rowStr) continue;
    for (let c = 0; c < rowStr.length; c++) {
      const ch = rowStr[c];
      if (ch === ".") continue;
      const color = legend[ch];
      if (!color) continue;
      const i = (r * w + c) * 4;
      img.data[i] = parseInt(color.slice(1, 3), 16);
      img.data[i + 1] = parseInt(color.slice(3, 5), 16);
      img.data[i + 2] = parseInt(color.slice(5, 7), 16);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const entry = { url: canvas.toDataURL(), w, h };
  cache.set(cacheKey, entry);
  return entry;
}
