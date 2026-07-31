// 人物のドット絵モデル（Wave G-1改：ベクター造形から本物のドット絵への切り替え）。
// まずは「立ち・真横向き」の1コマだけを作成する段階（ユーザー指示：モデル作成だけ）。
// 承認が得られたら歩行4コマ・座りコマを追加し、Person.jsx本体へ統合する。
//
// v2（ユーザー提示の参考ドット絵を見て全面改訂）：
//  - 解像度を24×32→32×42へ拡大（ユーザー指摘：解像度をもっと上げるべき）。
//  - **両腕を描画**（ユーザー指摘：片腕だけで違和感がある）。肩の左右両方から腕を垂らす。
//  - ジャージの胸アクセントを廃止し、中央に細い陰影ライン1本だけの単色ジャージへ
//    （ユーザー指摘：服の柄の向きが訳分からない＝チグハグな装飾だった）。
//  - 帽子は参考画像に合わせて「丸みのある帽子＋小さいグレーのつば＋もみあげの髪」に
//    作り直した（旧版の大きく平らなつばを廃止）。目を2つにして参考画像に寄せた。
// 縁取りは手で置かず、`kit.jsx`の`pixelSprite`がシルエットから自動生成する。
import React from "react";
import { row, pixelSprite, shade, SKIN, HAIR } from "./kit.jsx";

const W = 32, H = 42;
export const PERSON_PX = 0.42; // 1マスの実寸（ワールド単位）。全高42マス×0.42≈17.6=旧ベクター版の全高相当

// legend文字の意味：
// S=肌 n=鼻・口の陰(肌より少し濃い) H=髪 e=目
// C=帽子(動的・明) c=帽子の陰(動的・暗) G=つば(グレー・固定)
// J=ジャージ(動的・明) j=ジャージの陰(動的・暗、中央の縫い目)
// B=ビブショーツ(黒) D=シューズ(暗色)
const STAND = [
  row(W, [13, "cccccc"]),                                          // r0  帽子てっぺん(陰)
  row(W, [11, "CCCCCCCCCC"]),                                      // r1  帽子
  row(W, [10, "CCCCCCCCCCCC"]),                                    // r2
  row(W, [10, "CCCCCCCCCCCC"], [22, "GGG"]),                       // r3  つば(グレー)が右へ
  row(W, [9, "HH"], [11, "SSSSSSSSSS"], [22, "GGG"]),              // r4  もみあげ＋額
  row(W, [9, "HH"], [11, "SSSSSSSSSS"]),                           // r5
  row(W, [9, "HH"], [11, "SSSSSSSSSS"]),                           // r6
  row(W, [9, "HH"], [11, "SSS"], [14, "e"], [15, "SS"], [17, "e"], [18, "SS"]), // r7 両目
  row(W, [9, "HH"], [11, "SSSSSSSSSS"]),                           // r8
  row(W, [10, "SSSSS"], [15, "nn"], [17, "SSSS"]),                 // r9  鼻・口
  row(W, [11, "SSSSSSSSSS"]),                                      // r10 あご
  row(W, [12, "SSSSSSSS"]),                                        // r11
  row(W, [13, "SSSSSS"]),                                          // r12 あご先〜首
  row(W, [14, "SSSS"]),                                            // r13 首
  row(W, [7, "JJJ"], [11, "JJJJJJJJJJ"], [21, "JJJJ"]),            // r14 肩＋両袖
  row(W, [7, "SSS"], [11, "JJJJ"], [15, "jj"], [17, "JJJJ"], [21, "SSSS"]), // r15 両腕(肌)＋胴
  row(W, [7, "SSS"], [11, "JJJJ"], [15, "jj"], [17, "JJJJ"], [21, "SSSS"]), // r16
  row(W, [7, "SSS"], [11, "JJJJ"], [15, "jj"], [17, "JJJJ"], [21, "SSSS"]), // r17
  row(W, [7, "SSS"], [11, "JJJJ"], [15, "jj"], [17, "JJJJ"], [21, "SSSS"]), // r18
  row(W, [7, "SSS"], [11, "JJJJ"], [15, "jj"], [17, "JJJJ"], [21, "SSSS"]), // r19
  row(W, [7, "SSS"], [11, "JJJJ"], [15, "jj"], [17, "JJJJ"], [21, "SSSS"]), // r20
  row(W, [7, "SSS"], [11, "JJJJ"], [15, "jj"], [17, "JJJJ"], [21, "SSSS"]), // r21
  row(W, [7, "SS"], [11, "JJJJ"], [15, "jj"], [17, "JJJJ"], [21, "SS"]),   // r22 腕が終わる(手)
  row(W, [11, "JJJJ"], [15, "jj"], [17, "JJJJ"]),                  // r23 胴のみ
  row(W, [11, "JJJJ"], [15, "jj"], [17, "JJJJ"]),                  // r24
  row(W, [10, "BBBBBBBBBBBB"]),                                    // r25 ショーツ
  row(W, [10, "BBBBBBBBBBBB"]),                                    // r26
  row(W, [10, "BBBBBBBBBBBB"]),                                    // r27
  row(W, [11, "BBBBBBBBBB"]),                                      // r28
  row(W, [12, "SS"], [18, "SS"]),                                  // r29 脚
  row(W, [12, "SS"], [18, "SS"]),                                  // r30
  row(W, [12, "SS"], [18, "SS"]),                                  // r31
  row(W, [12, "SS"], [18, "SS"]),                                  // r32
  row(W, [12, "SS"], [18, "SS"]),                                  // r33
  row(W, [12, "SS"], [18, "SS"]),                                  // r34
  row(W, [12, "SS"], [18, "SS"]),                                  // r35
  row(W, [12, "SS"], [18, "SS"]),                                  // r36
  row(W, [12, "SS"], [18, "SS"]),                                  // r37
  row(W, [12, "SS"], [18, "SS"]),                                  // r38
  row(W, [12, "DDDD"], [18, "DDDD"]),                              // r39 シューズ
  row(W, [12, "DDDD"], [18, "DDDD"]),                              // r40
  row(W, [12, "DDDD"], [18, "DDDD"]),                              // r41
];

// x,y: 足元中央のワールド座標。color=ジャージ色(動的)、cap=帽子/個人識別色(動的)。
// flip: 進行方向が左向きのとき true（鏡像反転）。
export function PixelPerson({ x, y, color, cap, flip }) {
  const legend = {
    S: SKIN, n: shade(SKIN, 0.85), H: HAIR, e: "#241a12",
    C: cap, c: shade(cap, 0.75), G: "#9aa0a8",
    J: color, j: shade(color, 0.72),
    B: "#20242c", D: "#14171c",
  };
  const inner = pixelSprite(STAND, legend, PERSON_PX, W / 2, H, "stand");
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      <ellipse cx="0" cy="0" rx={(2.6 * 1.5).toFixed(1)} ry={(1.05 * 1.5).toFixed(1)} fill="#000" opacity="0.2" />
      {flip ? <g transform="scale(-1,1)">{inner}</g> : inner}
    </g>
  );
}
