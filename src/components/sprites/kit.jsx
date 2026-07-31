// 人物(Person.jsx)と自転車(IsoRider.jsx)が共有する造形言語。Wave G-1で新設。
// 「同じ人物がゲーム内で歩いたり自転車に乗ったりする」ことを絵として保証するため、
// 肌・髪・縁取りの色と、先細り四角形(quad)・縁取り付き矩形(outlineRect)を1箇所にまとめた。
// 座標規約は呼び出し側に委ねる：X(a)/Y(b)は「ローカル単位→px」に変換済みの投影関数を渡す
// （PersonはU=1.5、IsoRiderはu=1.45*サイズ倍率、と単位が異なるため）。
import React from "react";

export const SKIN = "#f2d2a8";
export const HAIR = "#4a3728";
export const OUTLINE = "#20242c"; // 主要パーツの縁取り。明るい床でもシルエットが溶けないように

// 16進カラーを明度factor倍する。奥側パーツ(far)を手前側(near)より暗くする用途。
export function shade(hex, factor) {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * factor);
  const g = clamp(((n >> 8) & 255) * factor);
  const b = clamp((n & 255) * factor);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// 先細り四角形。胴や袖を「肩幅≠腰幅」の多角形として描く（1本の太線だと肩腰の区別がつかない）。
// off: 法線方向へのオフセット（背中側にラインを1本通す用途）。outline: 縁取りを付けるか。
export function quad(X, Y, p1, p2, hw1, hw2, fill, key, off = 0, outline = false) {
  const dx = p2[0] - p1[0], db = p2[1] - p1[1];
  const len = Math.hypot(dx, db) || 1;
  const nx = -db / len, nb = dx / len;
  const a1 = [p1[0] + nx * off, p1[1] + nb * off], a2 = [p2[0] + nx * off, p2[1] + nb * off];
  const pts = [
    [a1[0] + nx * hw1, a1[1] + nb * hw1], [a2[0] + nx * hw2, a2[1] + nb * hw2],
    [a2[0] - nx * hw2, a2[1] - nb * hw2], [a1[0] - nx * hw1, a1[1] - nb * hw1],
  ];
  return (
    <polygon key={key} points={pts.map(([a, b]) => `${X(a)},${Y(b)}`).join(" ")}
      fill={fill} stroke={outline ? OUTLINE : "none"} strokeWidth={outline ? 0.55 : 0} strokeLinejoin="round" />
  );
}

// 縁取り付きの矩形（靴など、後から他の図形に上書きされない「最後に描くパーツ」用）。
// a,bはローカル座標(左下基準)、w,hはローカル単位。
export function outlineRect(X, Y, u, a, b, w, h, fill, key, strokeColor = OUTLINE) {
  const x = X(a), y = Y(b + h), width = +(w * u).toFixed(2), height = +(h * u).toFixed(2);
  return (
    <rect key={key} x={x} y={y} width={width} height={height} fill={fill}
      stroke={strokeColor} strokeWidth={Math.max(0.5, u * 0.09)} shapeRendering="crispEdges" />
  );
}

// 輪郭線だけを重ね描きする矩形（fill無し）。頭のように「塗り→髪→帽子→…」と複数パーツを
// 重ねた後で全体のシルエットを縁取りたい場合に使う。塗りの矩形自体にstrokeを付けても、
// 後から重ねる不透明な図形（髪・帽子）に隠れて消えてしまうため、必ず最後に呼ぶこと。
export function silhouette(X, Y, u, a, b, w, h, key, strokeColor = OUTLINE) {
  const x = X(a), y = Y(b + h), width = +(w * u).toFixed(2), height = +(h * u).toFixed(2);
  return (
    <rect key={key} x={x} y={y} width={width} height={height} fill="none"
      stroke={strokeColor} strokeWidth={Math.max(0.5, u * 0.1)} shapeRendering="crispEdges" />
  );
}

// 縁取り付きの管（フレームのチューブ等）。同じ経路にOUTLINE色の太線→本体色の細線を重ねて縁を作る。
export function tube(X, Y, a1, b1, a2, b2, wd, u, color, key) {
  return (
    <g key={key}>
      <line x1={X(a1)} y1={Y(b1)} x2={X(a2)} y2={Y(b2)} stroke={OUTLINE} strokeWidth={+((wd + 0.35) * u).toFixed(2)} strokeLinecap="round" />
      <line x1={X(a1)} y1={Y(b1)} x2={X(a2)} y2={Y(b2)} stroke={color} strokeWidth={+(wd * u).toFixed(2)} strokeLinecap="round" />
    </g>
  );
}
