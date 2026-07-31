// 人物のドット絵モデル（Wave G-1改：ベクター造形から本物のドット絵への切り替え）。
// まずは「立ち・真横向き」の1コマだけを作成する段階（ユーザー指示：モデル作成だけ）。
// 承認が得られたら歩行4コマ・座りコマを追加し、Person.jsx本体へ統合する。
//
// 解像度は24(幅)×32(高さ)相当。1文字=1マスで手書きし、縁取りは`kit.jsx`の`pixelSprite`が
// シルエットから自動生成する（手で縁取り文字を置くと、後から重ねる別パーツに隠れて消える
// バグの温床になるため。Wave G-1のベクター版で実際に踏んだ経緯があり、それを踏まえた設計）。
import React from "react";
import { row, pixelSprite, SKIN, HAIR } from "./kit.jsx";

const W = 24, H = 32;
export const PERSON_PX = 0.55; // 1マスの実寸（ワールド単位）。全高32マス×0.55≈17.6=旧ベクター版の全高相当

// legend文字の意味：
// S=肌 H=髪 C=帽子/個人識別色(動的) J=ジャージ/チーム色(動的) B=ビブショーツ(黒)
// W=ソックス(白) D=シューズ(暗色) e=目
const STAND = [
  row(W),                                                    // r0
  row(W, [8, "CCCCCCC"]),                                    // r1 帽子てっぺん
  row(W, [7, "CCCCCCCCCC"]),                                 // r2 帽子バンド
  row(W, [7, "CCCCCCCCCCCC"]),                               // r3 帽子＋つば付け根
  row(W, [7, "CCCCCC"], [13, "SSSS"], [17, "CCC"]),          // r4 つばが右へ突き出る／額
  row(W, [8, "H"], [9, "SSSSSSSS"]),                         // r5 髪(後頭部)＋顔
  row(W, [8, "H"], [9, "SSSSSSSS"]),                         // r6
  row(W, [8, "H"], [9, "SSSSS"], [14, "e"], [15, "SS"]),     // r7 目
  row(W, [8, "H"], [9, "SSSSSSSS"]),                         // r8
  row(W, [10, "SSSSSS"]),                                    // r9 あご
  row(W, [11, "SSS"]),                                       // r10 首
  row(W, [8, "CCCCCCCCC"]),                                  // r11 襟(個人識別色)
  row(W, [7, "JJJJJJJJJJ"], [17, "JJ"]),                     // r12 胴＋袖
  row(W, [7, "JJJJJJJJJJ"], [17, "JJ"]),                     // r13
  row(W, [7, "JJ"], [9, "CC"], [11, "JJJJJJ"], [17, "S"]),   // r14 胸アクセント＋腕(肌)
  row(W, [7, "JJ"], [9, "CC"], [11, "JJJJJJ"], [17, "S"]),   // r15
  row(W, [7, "JJJJJJJJJJ"], [17, "S"]),                      // r16
  row(W, [7, "JJJJJJJJJJ"], [17, "S"]),                      // r17
  row(W, [7, "JJJJJJJJJJ"], [17, "S"]),                      // r18
  row(W, [7, "JJJJJJJJJJ"]),                                 // r19 胴の裾
  row(W, [8, "BBBBBBBB"]),                                   // r20 ショーツ
  row(W, [8, "BBBBBBBB"]),                                   // r21
  row(W, [8, "CCCCCCCC"]),                                   // r22 裾ライン(個人識別色)
  row(W, [9, "SS"], [13, "SS"]),                             // r23 脚
  row(W, [9, "SS"], [13, "SS"]),                             // r24
  row(W, [9, "SS"], [13, "SS"]),                             // r25
  row(W, [9, "SS"], [13, "SS"]),                             // r26
  row(W, [9, "SS"], [13, "SS"]),                             // r27
  row(W, [9, "WW"], [13, "WW"]),                             // r28 ソックス
  row(W, [8, "DDDD"], [12, "DDDD"]),                         // r29 シューズ
  row(W, [8, "DDDD"], [12, "DDDD"]),                         // r30
  row(W),                                                    // r31
];

// x,y: 足元中央のワールド座標。color=ジャージ色(動的)、cap=帽子/個人識別色(動的)。
// flip: 進行方向が左向きのとき true（鏡像反転）。
export function PixelPerson({ x, y, color, cap, flip }) {
  const legend = { S: SKIN, H: HAIR, e: "#241a12", C: cap, J: color, B: "#20242c", W: "#f4f6f8", D: "#14171c" };
  const inner = pixelSprite(STAND, legend, PERSON_PX, W / 2, H, "stand");
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      <ellipse cx="0" cy="0" rx={(2.6 * 1.5).toFixed(1)} ry={(1.05 * 1.5).toFixed(1)} fill="#000" opacity="0.2" />
      {flip ? <g transform="scale(-1,1)">{inner}</g> : inner}
    </g>
  );
}
