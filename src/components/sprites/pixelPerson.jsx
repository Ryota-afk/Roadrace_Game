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
// 参考画像は輪郭ドット("K")を既に含むため、legend以外の自動縁取り処理は行わない
// （rasterize.jsのspriteImageUrlはlegend文字をそのまま塗るだけで縁取りを合成しない）。
import React from "react";
import { shade } from "./kit.jsx";
import { spriteImageUrl } from "./rasterize.js";

// legend文字：K=輪郭(黒) S=肌 s=肌の陰/口 H=髪 e=目 G=つば(グレー)
//              C=帽子(動的・個人識別色) c=帽子の陰 J=ジャージ(動的・チーム色) j=ジャージの陰
//              B=ビブショーツ D=シューズ
const STAND = [
  ".....KKKKKKK....",
  "....KcCCCGGCK...",
  "...KcCCCCCCCcK..",
  "..KcCCCCGGGGGGK.",
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
  "KsSSKKBBBBKKKSSK",
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
const WALK_A = [
  ".......KKKKKKK......",
  "......KcCCCGGCK.....",
  ".....KcCCCCCCCcK....",
  "....KcCCCCGGGGGGK...",
  "....KcCCKKKKKKKKKK..",
  "....KjHHsSSSSSSK....",
  "....KHHHSSeSSeSK....",
  "....KsSHSSeSSeSK....",
  "....KsSsSSSSSSSK....",
  ".....KHsSSSSSSSK....",
  "......KsSSSssSSK....",
  ".......KKSSSSSK.....",
  "......KKJKKKKK......",
  "....KKJJJJjjJK......",
  "...KjJJJJJJjJJK.....",
  "..KjJJJJJJJjJJJK....",
  ".KsSJJKjJJJjJKJK....",
  ".KSSSKKjJJJjJKJK....",
  "KsSSK.KjJJJjJKsK....",
  "KSSK.KKjJJJjJKssK...",
  "KSSK.KKjJJJjJKsssKK.",
  "KSSK.KjjjJJjJKKsssSK",
  "KSSK.KBBBBBBKK.KssSK",
  "KSSK.KBBBBBBKK..KKK.",
  ".KK..KKBBBBBKK......",
  "......KKBBBBBK......",
  ".....KBBKBBBBBK.....",
  ".....KBBBKBBBSK.....",
  "....KssKBKKsSSK.....",
  "...KssssK..KSSSK....",
  ".KKssssK...KsSSK....",
  "KDDssKK.....KSSSK...",
  "KDDKK.......KsSSKKKK",
  "KDDK.........KDDDDDK",
  ".KDDK........KDDDKK.",
  "..KKK........KKKK...",
];
const WALK_B = [
  ".......KKKKKKK......",
  "......KcCCCGGCK.....",
  ".....KcCCCCCCCcK....",
  "....KcCCCCGGGGGGK...",
  "....KcCCKKKKKKKKKK..",
  "....KjHHsSSSSSSK....",
  "....KHHHSSeSSeSK....",
  "....KsSHSSeSSeSK....",
  "....KsSsSSSSSSSK....",
  ".....KHsSSSSSSSK....",
  "......KsSSSssSSK....",
  ".......KKSSSSSK.....",
  "......KKJKKKKK......",
  "....KKJJJJjjJK......",
  "...KjJJJJJJjJJK.....",
  "..KJJJJJJJJjJJJK....",
  ".KsSJJKjJJJjJKJK....",
  ".KSSSKKjJJJjJKJK....",
  "KsSSK.KjJJJjJKsK....",
  "KSSK..KjJJJjJKssK...",
  "KSSK..KjJJJjJKsssKK.",
  "KSSK..KjjJJjJKKsssSK",
  "KSSK..KBBBBBBK.KssSK",
  ".KK...KBBBBBKK..KKK.",
  "......KBBBBBKK......",
  "......KKBBBBBK......",
  ".....KBBKBBBBBK.....",
  ".....KBBBKBBBSK.....",
  "....KssBBKKsSSK.....",
  "...KssssK..KSSSK....",
  ".KKssssK...KsSSK....",
  "KDDssKK.....KSSK....",
  "KDDKK.......KsSSKKK.",
  ".KDK.........KDDDDDK",
  ".KDDK........KDDDKK.",
  "..KKK........KKKK...",
];

// 座り。参考画像は椅子ごと描かれていたが、ゲーム内には椅子の什器(Fixtures.jsx)が別に
// あるため、グレーの椅子と「椅子の輪郭にしか触れていない黒」をアルゴリズムで除去して
// 人物だけを取り出した（scratchpadのstrip_chair）。除去後に余白を詰めてあるので、
// 他コマとは幅・高さが異なる（38行ではなく下記の行数）。
const SIT = [
  "...KKKKKKK...........",
  "..KcCCCGGCK..........",
  ".KcCCCCCCCCK.........",
  "KcCCCCGGGGGGK........",
  "KcCCKKKKKKKKKK.......",
  "KjHHsSSSSSSK.........",
  "KHHHSSeSSeSK.........",
  "KsSHSSeSSeSK.........",
  "KsSsSSSSSSSK.........",
  ".KKsSSSSSSSK.........",
  "..KKsSSssSSK.........",
  "...KKSSSSSK..........",
  "..KKJKKKKK...........",
  ".KjJJJJjjJK..........",
  "KjJJJJJJjJJK.........",
  "KjJJJJJJjJJJK........",
  "KjJJKJJJjJJJK........",
  "KjJJKKJJjJKJK........",
  ".KjSSKJJjJK..........",
  ".KsSSKJJjJKSK........",
  "..KSSKJJjJKSKK.......",
  "..KSSSKKjJKSSKK......",
  ".KjKsSSSKKKsSSKK.....",
  "..KKKssSSSSKKSSSK....",
  ".KBBBKKKsSSKKKKKK....",
  ".KBBBBBBKKKKKKSSK....",
  ".KBBBBBBBBSSSKsSSK...",
  "..KKBBBBBSSSSSKsSK...",
  "....KKKKKKsSSSKsSK...",
  "..........KsSSKsSK...",
  "..........KsSSKsSK...",
  "..........KsSSKsSK...",
  "..........KsSSKsSK...",
  "..........KsSSKDDDK..",
  "..........KDDDKDDDDK.",
  "..........KDDDDKKDDDK",
  "..........KDDDDDKKKKK",
  "..........KKKKKKK....",
];

// コマごとに幅が違う（歩行は脚を開くぶん横に広い）。参考画像のbboxはどのコマも
// 「帽子の中心＝bboxの中心」に揃っていたので、立ち/歩行のアンカーは各コマの幅/2でよい。
// 高さは立ち/歩行とも36マスで揃っており、originRow=36（足元）で接地が揃う。
export const PERSON_H = 36;
export const PERSON_PX = 0.49; // 1マスの実寸（ワールド単位）。36マス×0.49≈17.6＝旧ベクター版の全高相当

// 座りは椅子を抜いたぶん幅が非対称なので、頭の中心を他コマと揃えるための専用アンカー。
// SIT行0の帽子は cols 3-9（中心6）。立ちコマの帽子中心は幅16の中心8なので、
// 「頭が同じ位置に来る」ようにoriginColを6とする。
const SIT_ORIGIN_COL = 6;

// 歩行は WALK_A → STAND → WALK_B → STAND の4コマ巡回にする。
// 参考画像の歩行2コマは左右の脚が入れ替わった対の関係で、間に立ちポーズを挟むと
// 「片脚を前に出す→揃う→反対の脚を前に出す」という自然な歩行サイクルになる。
const WALK_CYCLE = [WALK_A, STAND, WALK_B, STAND];
// spriteImageUrlのキャッシュキー用（WALK_A/WALK_Bは幅がSTANDと異なる別絵なので区別する）。
const WALK_CYCLE_KEYS = ["walkA", "stand", "walkB", "stand"];

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
// pose: "walk" | "stand" | "sit"
// t: 経過秒。paused中はtが進まないので自然に静止する。phase: 個人ごとの位相ずらし。
// flip: 進行方向が左向きのとき true（鏡像反転）。
//
// Wave 6(#29): pixelSprite()の1ピクセル=1<rect>方式は、拠点画面(BaseView)で最大16名を
// 毎フレーム丸ごと作り直すコストの元凶だった（実測：1体≒430個の<rect>）。姿勢×色×帽子色の
// 組み合わせは静的な絵なので、canvasで1回ラスタライズし<image>1ノードで参照する。
export function PixelPerson({ x, y, color, cap, flip, pose = "stand", t = 0, phase = 0 }) {
  let frame, frameKey;
  if (pose === "sit") { frame = SIT; frameKey = "sit"; }
  else if (pose === "walk") {
    const idx = Math.floor(((t + phase) * 5.4) % WALK_CYCLE.length); // 1歩約0.74秒＝4コマ
    frame = WALK_CYCLE[idx]; frameKey = WALK_CYCLE_KEYS[idx];
  } else { frame = STAND; frameKey = "stand"; }
  const originCol = pose === "sit" ? SIT_ORIGIN_COL : frame[0].length / 2;
  const key = `person-${frameKey}-${color}-${cap}`;
  const sprite = spriteImageUrl(frame, personLegend(color, cap), key);
  const w = +(sprite.w * PERSON_PX).toFixed(2), h = +(sprite.h * PERSON_PX).toFixed(2);
  const ox = +(-originCol * PERSON_PX).toFixed(2), oy = +(-frame.length * PERSON_PX).toFixed(2);
  const img = <image href={sprite.url} x={ox} y={oy} width={w} height={h} style={{ imageRendering: "pixelated" }} />;
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      <ellipse cx="0" cy="0" rx="3.6" ry="1.5" fill="#000" opacity="0.2" />
      {flip ? <g transform="scale(-1,1)">{img}</g> : img}
    </g>
  );
}
