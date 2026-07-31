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

// 行×列の指定で1マスだけ塗る（下のrow()と組み合わせてグリッドの1行を組み立てる）。
export function row(width, ...segments) {
  const chars = Array(width).fill(".");
  for (const [start, s] of segments) {
    for (let i = 0; i < s.length; i++) chars[start + i] = s[i];
  }
  return chars.join("");
}

// ドット絵グリッドの描画（Wave G-1改：ベクター造形→本物のドット絵への切り替えで新設）。
// rows: 1文字=1マスの文字列配列（"."=透明）。legend: 文字→色のマップ（呼び出し時に解決した
// 実際の色を渡す。ジャージ色・個人色など動的な色もここで解決済みのものを渡す）。
// px: 1マスの一辺の長さ（ワールド単位）。originCol/originRow: 全体をどこにアンカーするか
// （例：足元中央を(0,0)に合わせたい場合は originCol=幅/2, originRow=高さ を渡す）。
//
// 縁取りは手で置かず自動生成する：塗られたマスの上下左右が透明なら、そこへ縁取り色の
// マスを差し込む（先に縁取りを全部描いてから、実際の色を上に重ねる）。手作業で縁取り文字を
// 置く方式は「後から重ねる別パーツに縁取りが隠れて消える」バグ(Wave G-1で発見)の温床になる
// ため、シルエットから機械的に導出する方式に統一した。
export function pixelSprite(rows, legend, px, originCol, originRow, key, outlineColor = OUTLINE) {
  const h = rows.length;
  const filled = (r, c) => r >= 0 && r < h && rows[r] && c >= 0 && c < rows[r].length && rows[r][c] !== ".";
  const cells = [];
  const outlineSet = new Set();
  for (let r = 0; r < h; r++) {
    if (!rows[r]) continue;
    for (let c = 0; c < rows[r].length; c++) {
      if (!filled(r, c)) continue;
      cells.push({ r, c, ch: rows[r][c] });
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (!filled(nr, nc)) outlineSet.add(`${nr},${nc}`);
      }
    }
  }
  const ox = (c) => +((c - originCol) * px).toFixed(2);
  const oy = (r) => +((r - originRow) * px).toFixed(2);
  const p = +px.toFixed(2);
  return (
    <g key={key}>
      {[...outlineSet].map((k) => {
        const [r, c] = k.split(",").map(Number);
        return <rect key={`o${k}`} x={ox(c)} y={oy(r)} width={p} height={p} fill={outlineColor} shapeRendering="crispEdges" />;
      })}
      {cells.map(({ r, c, ch }, i) => {
        const fill = legend[ch];
        return fill ? <rect key={`c${i}`} x={ox(c)} y={oy(r)} width={p} height={p} fill={fill} shapeRendering="crispEdges" /> : null;
      })}
    </g>
  );
}
