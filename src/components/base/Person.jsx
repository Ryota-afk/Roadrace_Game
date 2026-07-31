// 拠点画面の人物スプライト（歩く/立つ/座る）。Step13 Wave F-3aで新設、Wave G-1で造形を作り直した。
//
// 造形の方針（Wave F-3aの初版を実機プレビューで確認して全面的に作り直した経緯を含む）：
//  - **真横向き**で描く（向きの多方向化はWave G-2で扱う。本弾は方向を変えずに造形のみ改善）。
//    この世界は`IsoRider`（自転車）が真横図で描かれており、「アイソメの地面に横向きスプライトを
//    立てる」というカイロソフト系の作法になっている。
//  - Wave G-1でユーザー提示の参考ドット絵と見比べ、(a)顔が無くのっぺらぼう(b)頭身がリアル寄りで
//    デフォルメが弱い(c)主要パーツに縁取りが無くシルエットが溶ける(d)胴が単なる矩形で体型が無い
//    (e)腕が片方しか見えず板のように薄い(f)靴が細い線で頼りない、という6点のギャップが判明。
//    `components/sprites/kit.jsx`（`IsoRider`と共有）を新設し、縁取り付き矩形・先細り四角形の胴・
//    奥側の腕・塊としての靴・目鼻のある頭、へ作り直した。
//  - 四肢は`IsoRider`と同じ「丸端の線」で描く。関節を曲げられるので歩行・着座の姿勢が作れる。
//  - 歩行は足先を楕円軌道で動かす本物の歩行サイクル：接地中は足が体に対し前→後ろへ流れ、
//    離地中は持ち上がって後ろ→前へ戻る。腕は脚と逆位相。
//  - 識別色の使い方も`IsoRider`を踏襲：胴＝チーム/脚質色(color)、帽子と短パン裾＝個人色(cap)。
//    自転車に乗っている時と歩いている時で同じ人だと分かる。
//  - 足元に必ず影の楕円を敷く（Wave F-2で「浮いて見える」と指摘された点の再発防止）。
import React from "react";
import { SKIN, HAIR, shade, quad, outlineRect, silhouette } from "../sprites/kit.jsx";

const U = 1.5; // 1ローカル単位あたりのpx。IsoRiderのu=1.45に合わせてある
// 素肌の脚。顔より少しだけ濃くして、明るい床の上でも脚のシルエットが消えないようにする。
const LEG_NEAR = "#e6bd8e";
const LEG_FAR = "#c99f74";  // 奥側（同じ色だと2本が団子になって1本に見える）
const SHORTS = "#20242c";   // ビブショーツ＝黒。自転車の装いとして最も読み取りやすい
const SOCK = "#f4f6f8";
const SHOE = "#14171c";
const SKIN_FAR = shade(SKIN, 0.86); // 奥側の腕。近側と同じ色だと胴に埋もれて見分けがつかない

const X = (a) => +(a * U).toFixed(2);
const Y = (b) => +(-b * U).toFixed(2);
const px = (a, b, w, h, f, key) => (
  <rect key={key} x={X(a)} y={Y(b + h)} width={+(w * U).toFixed(2)} height={+(h * U).toFixed(2)} fill={f} shapeRendering="crispEdges" />
);
const ln = (a1, b1, a2, b2, f, wd, key) => (
  <line key={key} x1={X(a1)} y1={Y(b1)} x2={X(a2)} y2={Y(b2)} stroke={f} strokeWidth={+(wd * U).toFixed(2)} strokeLinecap="round" />
);
const qd = (p1, p2, hw1, hw2, fill, key, off = 0, outline = false) => quad(X, Y, p1, p2, hw1, hw2, fill, key, off, outline);

// 股関節から足先までを膝で1回折った脚。膝は股と足の中点をやや前方へ押し出して作る。
// 素肌の脚＋白いソックス＋暗い靴（塊として見せる）、という自転車競技の装いにして、
// 上のビブショーツとあわせて「サイクリングウェアを着た選手」だと一目で分かるようにする。
function leg(hipA, hipB, footA, footB, color, key) {
  const kneeA = (hipA + footA) / 2 + 0.35;
  const kneeB = (hipB + footB) / 2;
  const sockB = footB + 0.95;
  const sockA = footA + (kneeA - footA) * 0.22;
  return (
    <g key={key}>
      {ln(hipA, hipB, kneeA, kneeB, color, 1.15, "th")}
      {ln(kneeA, kneeB, footA, footB, color, 1.0, "sh")}
      {ln(sockA, sockB, footA, footB + 0.2, SOCK, 1.0, "sock")}
      {/* 靴：線ではなく縁取り付きの塊として描く（Wave G-1。細い線だと足元が頼りなく見える） */}
      {outlineRect(X, Y, U, footA - 0.2, footB, 1.0, 0.55, SHOE, "ft")}
    </g>
  );
}

// 頭部（右向き）。帽子のつばが前(右)へ出ることで、絵として進行方向が読み取れる。
// Wave G-1：デフォルメを強めるため一回り拡大し、目を追加して「顔」にした
// （初版は肌色の頭＋クリーム色の帽子だけで、のっぺらぼうに見えるのが最大の弱点だった）。
function head(baseB, cap) {
  return (
    <>
      {px(-1.15, baseB, 2.6, 2.5, SKIN, "head")}
      {/* 髪（後頭部）：帽子の色に関わらず常に濃色なので、頭が塊に潰れない */}
      {px(-1.05, baseB + 0.55, 0.85, 1.9, HAIR, "hair")}
      {px(-1.05, baseB + 2.15, 2.5, 0.35, HAIR, "hairTop")}
      {/* 目：進行方向側(前)に1つだけ置く。真横向きなので奥の目は隠れて見えない */}
      {px(0.85, baseB + 1.15, 0.38, 0.38, "#2a2118", "eye")}
      {/* 帽子＝個人識別色。つばが前(右)へ出る */}
      {px(-1.25, baseB + 2.35, 2.7, 0.85, cap, "capTop")}
      {px(1.4, baseB + 2.35, 1.15, 0.45, cap, "capBrim")}
      {/* 顎の下の陰＝首と頭の境目を締める */}
      {px(-0.95, baseB, 2.2, 0.28, "#00000022", "chinShade")}
      {/* 頭部全体のシルエット縁取り。髪・帽子を重ねた「後」に描かないと隠れて消える
          （Wave G-1で判明：塗り矩形自体にstrokeを付けても後続の不透明な図形に上書きされる）。 */}
      {silhouette(X, Y, U, -1.15, baseB, 2.6, 2.5, "headOutline")}
    </>
  );
}

// 立ち／歩き（右向き）。p は歩行サイクルの位相[0,1)。立ち止まりのときは p=null。
function Upright({ color, cap, p }) {
  const hipB = 4.4;
  const shoulder = [0.15, 8.5], hip = [0.15, 5.35];
  // 足先の楕円軌道：接地中(前→後)と離地中(後→前・持ち上がる)
  const foot = (ph) => {
    const a = 2 * Math.PI * ph;
    return { a: 1.45 * Math.cos(a), b: 0.85 * Math.max(0, -Math.sin(a)) };
  };
  const near = p == null ? { a: 0.55, b: 0 } : foot(p);
  const far = p == null ? { a: -0.55, b: 0 } : foot((p + 0.5) % 1);
  const handA = p == null ? 0.5 : 0.5 - 1.15 * Math.cos(2 * Math.PI * p);
  const handAFar = p == null ? -0.15 : 0.15 + 0.7 * Math.cos(2 * Math.PI * p); // 逆位相・振り幅は控えめ（胴に大半が隠れるため）
  return (
    <>
      {/* 脚2本 → 短パン → 奥の腕 → 胴 → 手前の腕 の順。
          奥の腕は胴の描画で大半が隠れ、肩口と手だけが覗く＝Wave G-1で追加した奥行き表現。 */}
      {leg(-0.2, hipB, far.a, far.b, LEG_FAR, "legFar")}
      {leg(-0.2, hipB, near.a, near.b, LEG_NEAR, "legNear")}
      {/* ビブショーツ（黒）。個人識別色は裾のラインにだけ入れる */}
      {px(-1.2, 3.8, 2.5, 1.7, SHORTS, "shorts")}
      {px(-1.2, 3.8, 2.5, 0.3, cap, "shortsHem")}
      {/* 奥の腕（先に描いて胴に隠れさせる） */}
      {ln(-0.15, 8.3, handAFar, 5.7, SKIN_FAR, 0.85, "armFar")}
      {/* 胴＝チーム色のジャージ。先細り四角形（肩幅＞腰幅）で体型を出す（Wave G-1） */}
      {qd(hip, shoulder, 1.25, 1.5, color, "torso", 0, true)}
      {qd(hip, shoulder, 0.3, 0.35, cap, "stripe", 0.95)}
      {/* 手前の腕（脚と逆位相・肩から手へ1本）＋半袖の袖 */}
      {ln(0.25, 8.1, handA, 5.4, SKIN, 0.95, "arm")}
      {px(-0.4, 7.4, 1.5, 1.1, color, "sleeve")}
      {px(-0.4, 7.4, 1.5, 0.28, cap, "cuff")}
      {/* 首・頭 */}
      {px(-0.4, 8.4, 1.1, 0.5, SKIN, "neck")}
      {head(8.75, cap)}
    </>
  );
}

// 座り（右向き）。腰の高さ3.0単位＝4.5pxはFixtures.jsxの椅子の座面高と一致させてある
// （椅子に腰が乗って見える）。腿を水平・すねを垂直に折るのが「座り」の読み取りの要。
function Seated({ color, cap }) {
  const hipA = -0.5, hipB = 3.0;
  const shoulder = [0.05, 6.9], hip = [0.05, 3.75];
  return (
    <>
      {/* 奥の脚 */}
      {ln(hipA, hipB, 1.35, hipB - 0.15, LEG_FAR, 1.1, "thighFar")}
      {ln(1.35, hipB - 0.15, 1.5, 0, LEG_FAR, 0.95, "shinFar")}
      {/* ビブショーツ（黒） */}
      {px(-1.2, 2.6, 2.2, 1.5, SHORTS, "hip")}
      {/* 奥の腕（肘掛けに置く想定・大半は胴に隠れる） */}
      {ln(-0.1, 6.6, 0.5, 4.2, SKIN_FAR, 0.85, "armFar")}
      {/* 胴（座っているぶん低い位置から立ち上がる）。先細り四角形で体型を出す */}
      {qd(hip, shoulder, 1.25, 1.5, color, "torso", 0, true)}
      {qd(hip, shoulder, 0.3, 0.35, cap, "stripe", 0.95)}
      {/* 手前の脚：腿は水平、すねは垂直に落とす */}
      {ln(hipA, hipB, 1.55, hipB, LEG_NEAR, 1.15, "thighNear")}
      {ln(1.55, hipB, 1.7, 0, LEG_NEAR, 1.0, "shinNear")}
      {ln(1.62, 1.0, 1.7, 0.2, SOCK, 1.0, "sock")}
      {outlineRect(X, Y, U, 1.42, 0, 1.0, 0.5, SHOE, "foot")}
      {/* 手前の腕：肩から腿の上へ下ろす */}
      {ln(0.25, 6.5, 1.3, 3.5, SKIN, 0.95, "arm")}
      {px(-0.4, 5.9, 1.5, 1.1, color, "sleeve")}
      {px(-0.4, 5.9, 1.5, 0.28, cap, "cuff")}
      {/* 首・頭 */}
      {px(-0.4, 6.8, 1.1, 0.5, SKIN, "neck")}
      {head(7.15, cap)}
    </>
  );
}

// pose: "walk" | "stand" | "sit"
// t: 経過秒（歩行サイクル・立ち時の呼吸に使う。paused中はtが進まないので自然に静止する）
// flip: 進行方向が画面左向きのとき true（スプライトを鏡像反転）
// phase: 選手ごとにずらす位相（全員の歩調が揃うのを防ぐ）
export function Person({ x, y, pose, t, color, cap, flip, phase = 0 }) {
  const tt = (t || 0) + phase;
  let body, bob = 0;
  if (pose === "sit") {
    body = <Seated color={color} cap={cap} />;
  } else if (pose === "walk") {
    const p = (tt * 1.35) % 1; // 1歩約0.74秒
    bob = Math.abs(Math.sin(2 * Math.PI * p)) * 0.32; // 一歩ごとに重心が上下する
    body = <Upright color={color} cap={cap} p={p} />;
  } else {
    bob = Math.sin(tt * 1.5) * 0.16; // ごく浅い呼吸
    body = <Upright color={color} cap={cap} p={null} />;
  }
  const inner = <g transform={`translate(0,${(-bob * U).toFixed(2)})`}>{body}</g>;
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      <ellipse cx="0" cy="0" rx={(2.6 * U).toFixed(1)} ry={(1.05 * U).toFixed(1)} fill="#000" opacity="0.2" />
      {flip ? <g transform="scale(-1,1)">{inner}</g> : inner}
    </g>
  );
}
