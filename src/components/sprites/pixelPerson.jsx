// 人物のドット絵モデル（Wave G-1改）。
//
// 【作り方の経緯・重要】
// 当初は座標を手で積んでドット絵を書いたが、(a)胴と腕の間に1列の隙間が空いて腕が途中で
// 切れて見える (b)左右の腕の太さが3px/4pxで非対称 (c)ショーツが胴より広くて膨らんで見える
// (d)自動生成の縁取りが全パーツ境界に入り頭部が黒く潰れる、という破綻を連発した。
// そこで方式を変え、**ユーザー提示の参考ドット絵から実際のドットを機械的に抽出**している
// （scratchpadのPillowスクリプトで解像度16×36を推定→最近傍で量子化→色をlegend文字へ写像）。
// 手で座標を積むのをやめたので、上記のような「1列ズレ」「左右非対称」は原理的に起きない。
//
// 参考画像は輪郭ドット("K")を既に含むため、`pixelSprite`の自動縁取りは**必ず false** にする
// （true だと輪郭が二重になり細部が黒く潰れる）。
import React from "react";
import { pixelSprite, shade } from "./kit.jsx";

// legend文字：K=輪郭(黒) S=肌 s=肌の陰/口 H=髪 e=目 G=つば(グレー)
//              C=帽子(動的・個人識別色) c=帽子の陰 J=ジャージ(動的・チーム色) j=ジャージの陰
//              B=ビブショーツ D=シューズ
const STAND = [
  ".....KKKKKKK....",
  "....KcCCCGGCK...",
  "...KcCCCCCCCcK..",
  "..KcCCCcGGGGGGK.",
  "..KcCCKKKKKKKKKK",
  "..KjHHsSSSSSSK..",
  "..KHHHSSeSSeSK..",
  "..KsSHSSeSSeSK..",
  "..KsSsSSSSSSSK..",
  "...KHsSSSSSSSK..",
  "....KsSSSssSSK..",
  ".....KKSSSSSK...",
  "....KKJKKKKK....",
  "...KjJJJJjJJK...",
  "..KJJJJJJjJJJK..",
  ".KjJJJJJJjJJJJK.",
  ".KjJJjJJJjJJKJK.",
  ".KjJKjJJJjJJKJK.",
  "KsSSKjJJJjJJKsK.",
  "KsSSKjJJJjJJKsK.",
  "KsSSKjJJJjJJKsK.",
  "KsSSKjJJJjJJKsK.",
  "KsSSKBBBBBBBKsSK",
  "KsSSSKBBBBBBKsSK",
  "KsSSKKBBBBKBKsSK",
  ".KKKKBBBKKBBKKK.",
  "....KBBBKBBBK...",
  "....KBBBKBBBK...",
  "....KsSSKsSSK...",
  "....KsSSKsSSK...",
  "....KsSSKsSSK...",
  "....KsSSKsSSK...",
  "....KsSSKsSSK...",
  "....KDDDDKDDDK..",
  "....KDDDDDKDDDK.",
  "....KKKKKKKKKKK.",
];

export const PERSON_W = 16, PERSON_H = 36;
export const PERSON_PX = 0.49; // 1マスの実寸（ワールド単位）。36マス×0.49≈17.6＝旧ベクター版の全高相当

export function personLegend(color, cap) {
  return {
    K: "#000000",
    S: "#f7c391", s: "#d68e56",
    H: "#4a2d20", e: "#151515",
    G: "#969696",
    C: cap, c: shade(cap, 0.62),
    J: color, j: shade(color, 0.68),
    B: "#292929", D: "#1c1c1c",
  };
}

// x,y: 足元中央のワールド座標。color=ジャージ色(動的)、cap=帽子/個人識別色(動的)。
// flip: 進行方向が左向きのとき true（鏡像反転）。
export function PixelPerson({ x, y, color, cap, flip }) {
  const inner = pixelSprite(STAND, personLegend(color, cap), PERSON_PX,
    PERSON_W / 2, PERSON_H, "stand", "#000000", false);
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      <ellipse cx="0" cy="0" rx="3.6" ry="1.5" fill="#000" opacity="0.2" />
      {flip ? <g transform="scale(-1,1)">{inner}</g> : inner}
    </g>
  );
}
