// 拠点画面の人物スプライト（歩く/立つ/座る）。Step13 Wave F-3aで新設。
//
// 造形の方針（初版を実機プレビューで確認して全面的に作り直した経緯を含む）：
//  - **真横向き**で描く。この世界は`IsoRider`（自転車）が完全な側面図で描かれており、
//    「アイソメの地面に横向きスプライトを立てる」というカイロソフト系の作法になっている。
//    初版を正面向きで作ったところ、(a)左右反転しても絵が変わらず進行方向が伝わらない、
//    (b)歩行が「脚を左右に開いて立っているだけ」に見える、という致命的な問題が出た
//    （6倍プレビューで確認して判明）。
//  - 四肢は`IsoRider`と同じ「丸端の線」で描く。関節を曲げられるので歩行・着座の姿勢が作れる。
//    胴と頭はrect＋`crispEdges`のピクセル調（これもIsoRider譲り）。
//  - 歩行は足先を楕円軌道で動かす本物の歩行サイクル：接地中は足が体に対し前→後ろへ流れ、
//    離地中は持ち上がって後ろ→前へ戻る。腕は脚と逆位相。
//  - 識別色の使い方もIsoRiderを踏襲：胴＝チーム/脚質色(color)、帽子と短パン＝個人色(cap)。
//    自転車に乗っている時と歩いている時で同じ人だと分かる。
//  - 足元に必ず影の楕円を敷く（Wave F-2で「浮いて見える」と指摘された点の再発防止）。
import React from "react";

const U = 1.5; // 1ローカル単位あたりのpx。IsoRiderのu=1.45に合わせてある
const SKIN = "#f2d2a8";
const HAIR = "#4a3728"; // 髪。帽子がどんな色でも頭が肌色の塊に潰れないようにする
// 素肌の脚。顔より少しだけ濃くして、明るい床の上でも脚のシルエットが消えないようにする。
const LEG_NEAR = "#e6bd8e";
const LEG_FAR = "#c99f74";  // 奥側（同じ色だと2本が団子になって1本に見える）
const SHORTS = "#20242c";   // ビブショーツ＝黒。自転車の装いとして最も読み取りやすい
const SOCK = "#f4f6f8";
const SHOE = "#14171c";

const X = (a) => +(a * U).toFixed(2);
const Y = (b) => +(-b * U).toFixed(2);
const px = (a, b, w, h, f, key) => (
  <rect key={key} x={X(a)} y={Y(b + h)} width={+(w * U).toFixed(2)} height={+(h * U).toFixed(2)} fill={f} shapeRendering="crispEdges" />
);
const ln = (a1, b1, a2, b2, f, wd, key) => (
  <line key={key} x1={X(a1)} y1={Y(b1)} x2={X(a2)} y2={Y(b2)} stroke={f} strokeWidth={+(wd * U).toFixed(2)} strokeLinecap="round" />
);

// 股関節から足先までを膝で1回折った脚。膝は股と足の中点をやや前方へ押し出して作る。
// 素肌の脚＋白いソックス＋暗い靴、という自転車競技の装いにして、上のビブショーツと
// あわせて「サイクリングウェアを着た選手」だと一目で分かるようにする。
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
      {ln(footA - 0.15, footB + 0.15, footA + 0.75, footB + 0.15, SHOE, 0.8, "ft")}
    </g>
  );
}

// 頭部（右向き）。帽子のつばが前(右)へ出ることで、絵として進行方向が読み取れる。
// 初版は「肌色の頭＋クリーム色の帽子」で明度差がほとんど無く、頭全体が大きな白い塊に
// 見えていた（6倍プレビューで判明）。後頭部に必ず濃い髪を入れて輪郭を作る。
function head(baseB, cap) {
  return (
    <>
      {px(-1.0, baseB, 2.3, 2.2, SKIN, "head")}
      {/* 髪（後頭部）：帽子の色に関わらず常に濃色なので、頭が塊に潰れない */}
      {px(-1.0, baseB + 0.5, 0.85, 1.7, HAIR, "hair")}
      {px(-1.0, baseB + 1.9, 2.3, 0.4, HAIR, "hairTop")}
      {/* 帽子＝個人識別色。つばが前(右)へ出る */}
      {px(-1.1, baseB + 2.1, 2.5, 0.8, cap, "capTop")}
      {px(1.3, baseB + 2.1, 1.1, 0.42, cap, "capBrim")}
      {/* 顎の下の陰＝首と頭の境目を締める */}
      {px(-0.9, baseB, 2.1, 0.28, "#00000022", "chinShade")}
    </>
  );
}

// 立ち／歩き（右向き）。p は歩行サイクルの位相[0,1)。立ち止まりのときは p=null。
function Upright({ color, cap, p }) {
  const hipB = 4.4;
  // 足先の楕円軌道：接地中(前→後)と離地中(後→前・持ち上がる)
  const foot = (ph) => {
    const a = 2 * Math.PI * ph;
    return { a: 1.45 * Math.cos(a), b: 0.85 * Math.max(0, -Math.sin(a)) };
  };
  const near = p == null ? { a: 0.55, b: 0 } : foot(p);
  const far = p == null ? { a: -0.55, b: 0 } : foot((p + 0.5) % 1);
  const handA = p == null ? 0.5 : 0.5 - 1.15 * Math.cos(2 * Math.PI * p);
  return (
    <>
      {/* 脚2本 → 短パン → 胴 の順。短パンを脚より後に描かないと、脚の付け根に隠れて
          短パンがまったく見えなくなる（6倍プレビューで判明） */}
      {leg(-0.2, hipB, far.a, far.b, LEG_FAR, "legFar")}
      {leg(-0.2, hipB, near.a, near.b, LEG_NEAR, "legNear")}
      {/* ビブショーツ（黒）。個人識別色は裾のラインにだけ入れる */}
      {px(-1.2, 3.8, 2.5, 1.7, SHORTS, "shorts")}
      {px(-1.2, 3.8, 2.5, 0.3, cap, "shortsHem")}
      {/* 胴＝チーム色のジャージ（側面なので正面向きより細い） */}
      {px(-1.1, 5.3, 2.5, 3.3, color, "torso")}
      {/* 襟と袖口だけを個人識別色にする（胸を横切る帯は「何を着ているか分からない」原因だった） */}
      {px(-1.1, 8.3, 2.5, 0.35, cap, "collar")}
      {/* 腕（脚と逆位相・肩から手へ1本）＋半袖の袖 */}
      {ln(0.25, 8.1, handA, 5.4, SKIN, 0.95, "arm")}
      {px(-0.4, 7.4, 1.5, 1.1, color, "sleeve")}
      {px(-0.4, 7.4, 1.5, 0.28, cap, "cuff")}
      {/* 首・頭 */}
      {px(-0.4, 8.4, 1.1, 0.5, SKIN, "neck")}
      {head(8.8, cap)}
    </>
  );
}

// 座り（右向き）。腰の高さ3.0単位＝4.5pxはClutter.jsxの椅子の座面高と一致させてある
// （椅子に腰が乗って見える）。腿を水平・すねを垂直に折るのが「座り」の読み取りの要。
function Seated({ color, cap }) {
  const hipA = -0.5, hipB = 3.0;
  return (
    <>
      {/* 奥の脚 */}
      {ln(hipA, hipB, 1.35, hipB - 0.15, LEG_FAR, 1.1, "thighFar")}
      {ln(1.35, hipB - 0.15, 1.5, 0, LEG_FAR, 0.95, "shinFar")}
      {/* ビブショーツ（黒） */}
      {px(-1.2, 2.6, 2.2, 1.5, SHORTS, "hip")}
      {/* 胴（座っているぶん低い位置から立ち上がる） */}
      {px(-1.1, 3.9, 2.5, 3.2, color, "torso")}
      {px(-1.1, 6.8, 2.5, 0.35, cap, "collar")}
      {/* 手前の脚：腿は水平、すねは垂直に落とす */}
      {ln(hipA, hipB, 1.55, hipB, LEG_NEAR, 1.15, "thighNear")}
      {ln(1.55, hipB, 1.7, 0, LEG_NEAR, 1.0, "shinNear")}
      {ln(1.62, 1.0, 1.7, 0.2, SOCK, 1.0, "sock")}
      {ln(1.55, 0.15, 2.45, 0.15, SHOE, 0.8, "foot")}
      {/* 腕：肩から腿の上へ下ろす */}
      {ln(0.25, 6.5, 1.3, 3.5, SKIN, 0.95, "arm")}
      {px(-0.4, 5.9, 1.5, 1.1, color, "sleeve")}
      {px(-0.4, 5.9, 1.5, 0.28, cap, "cuff")}
      {/* 首・頭 */}
      {px(-0.4, 6.8, 1.1, 0.5, SKIN, "neck")}
      {head(7.2, cap)}
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
