// 第25弾：地面・路面・プラザのピクセルテクスチャ（F分類ドット絵化・屋外の面）。
// ユーザー合意（2026-08・AskUserQuestion）：案B「刈り込みバンド」を採用。
//   - 芝：細かい明暗の粒＋(+w方向のアイソメ対角に沿った)淡い刈り込みバンド。
//     冬（palette.snow）は雪面に刈り込み跡は不自然なため粒のみに落とす。
//   - 路面：アスファルトの骨材粒。
//   - プラザ：2world単位ごとのアイソメ目地＋石ごとの微妙なトーン差の石畳。
// 仕組み：canvasで小さなタイルを1回焼き、SVG <pattern>（userSpaceOnUse）で面に敷く。
// パターンはカメラ変換の内側なのでズームと一緒に拡縮する＝ズームインするとドットが
// 大きく見える（スプライトと同じピクセルアートの振る舞い）。色は季節パレット由来
// （キャッシュキーに色を含むため季節が変わると自動で別タイルが焼かれる）。
// 乱数はMath.random不使用の既存方針に合わせ決定論ハッシュ。
import React from "react";

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
function hash01(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const cache = new Map();
function tileUrl(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  draw(ctx, w, h);
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}

// 芝（春夏秋）：刈り込みバンド＋粒。バンドは+w方向（screen(26,13)）に沿うため
// 境界は y - x/2 = const の斜線。周期26px＝2world単位で明/やや暗を交互に。
function grassStripeUrl(base) {
  return tileUrl(`grassStripe-${base}`, 104, 52, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const band = Math.floor((((y - x / 2) % 26) + 26) % 26 / 13);
      let f = band === 0 ? 1.0 : 0.965;
      const r = hash01(x, y, 11);
      if (r < 0.05) f *= 0.94; else if (r > 0.96) f *= 1.06;
      ctx.fillStyle = shade(base, f);
      ctx.fillRect(x, y, 1, 1);
    }
  });
}

// 芝（冬・雪面）：粒のみ
function grassGrainUrl(base) {
  return tileUrl(`grassGrain-${base}`, 32, 32, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = hash01(x, y, 7);
      if (r < 0.06) { ctx.fillStyle = shade(base, 0.95); ctx.fillRect(x, y, 1, 1); }
      else if (r > 0.955) { ctx.fillStyle = shade(base, 1.04); ctx.fillRect(x, y, 1, 1); }
    }
  });
}

// アスファルト：骨材の粒
function asphaltUrl(base) {
  return tileUrl(`asphalt-${base}`, 32, 32, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = hash01(x, y, 23);
      if (r < 0.05) { ctx.fillStyle = shade(base, 1.16); ctx.fillRect(x, y, 1, 1); }
      else if (r < 0.09) { ctx.fillStyle = shade(base, 0.86); ctx.fillRect(x, y, 1, 1); }
    }
  });
}

// プラザ石畳：アイソメ2方向の目地（2world単位=26px周期）＋石ごとのトーン差
function paversUrl(base, edge) {
  return tileUrl(`pavers-${base}-${edge}`, 104, 52, (ctx, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (((x / 2 + y) % 26) + 26) % 26;
      const v = (((x / 2 - y) % 26) + 26) % 26;
      const su = Math.floor((((x / 2 + y) / 26) % 2 + 2) % 2);
      const sv = Math.floor((((x / 2 - y) / 26) % 2 + 2) % 2);
      const onJoint = u < 1.2 || v < 1.2;
      let f = 1.0 + ((su + sv) % 2 === 0 ? 0.02 : -0.02);
      const r = hash01(x, y, 31);
      if (r < 0.04) f *= 0.95; else if (r > 0.97) f *= 1.05;
      ctx.fillStyle = onJoint ? edge : shade(base, f);
      ctx.fillRect(x, y, 1, 1);
    }
  });
}

// Track.jsxの路面色（#54565f）と揃える。路面はパレット非依存（季節で変わらない）。
export const TRACK_ASPHALT = "#54565f";

export function GroundTextureDefs({ palette }) {
  const grassUrl = palette.snow ? grassGrainUrl(palette.grass) : grassStripeUrl(palette.grass);
  const gw = palette.snow ? 32 : 104, gh = palette.snow ? 32 : 52;
  return (
    <defs>
      <pattern id="texGrass" patternUnits="userSpaceOnUse" width={gw} height={gh}>
        <image href={grassUrl} width={gw} height={gh} style={{ imageRendering: "pixelated" }} />
      </pattern>
      <pattern id="texAsphalt" patternUnits="userSpaceOnUse" width="32" height="32">
        <image href={asphaltUrl(TRACK_ASPHALT)} width="32" height="32" style={{ imageRendering: "pixelated" }} />
      </pattern>
      <pattern id="texPavers" patternUnits="userSpaceOnUse" width="104" height="52">
        <image href={paversUrl(palette.plaza, palette.plazaEdge)} width="104" height="52" style={{ imageRendering: "pixelated" }} />
      </pattern>
    </defs>
  );
}
