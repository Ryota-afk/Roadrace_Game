// 自転車に乗った選手のスプライト（ベクター版）。元は`components/RaceView.jsx`に
// 定義されていたものを、Step13 Wave F-3bで独立モジュールへ切り出した。
//
// 【Wave H-4時点で未使用（アーカイブ候補）】唯一の呼び出し元だったRaceView.jsxの
// FinalSprintCinematicがドット絵(components/sprites/pixelBike.jsxのPixelBikeSymbolDefs/
// PixelBikeUse)へ置き換わったため、本ファイルの`IsoRider`コンポーネント自体は
// どこからもimportされていない（`grep -rn "IsoRider(" src`で確認）。同ファイル内の
// `CAP_COLORS`（帽子色パレット。純粋なデータ）だけは引き続きBaseView.jsx/RaceView.jsxから
// 使われているため、ファイルごとの削除はまだ見送っている。CLAUDE.md §5に基づき、
// 次にこのファイルへ触れる機会（または構造整理のタイミング）でCAP_COLORSをdata層へ
// 移し、`IsoRider`本体はarchive/へgit mvすることを検討する。
//
// Wave F-3bでの作り直し（ユーザー指摘を受けて）：
//  - **ハンドル位置が低すぎた**：旧実装はバーがb=4.9、サドルがb=7.4で、実車ではありえない
//    ほどの落差だった。バートップをb≒7.0へ上げ、サドル(7.7)との落差を実車相当(約8cm)にした。
//  - **3つの姿勢**を持たせた：
//      normal   … 普通にサドルに座り、上体もそれほど低くなく、上ハンドルを握る
//      dancing  … 上ハンドルを握ったままサドルから腰を上げる立ち漕ぎ（登坂で見られる）
//      sprint   … 姿勢を低くして下ハンドル（ドロップ）を握る（ゴールスプリントで見られる）
//  - 脚と腕は**2関節の逆運動学**で膝・肘を解く。姿勢ごとに腰・肩・手の位置を変えるだけで
//    自然な関節の曲がりが出る（姿勢ごとに全部の線を手で置き直さなくてよい）。
//  - ペダルはクランクを実際に回し、車輪にはスポークを入れて転がす。
//
// Wave G-1での作り直し（ユーザー提示の参考ドット絵と見比べて判明したギャップへの対応）：
//  - フレームが細い灰色の線で存在感が無かった→`kit.jsx`の`tube()`で太く・色付き・縁取り付きに。
//  - 顔が無くのっぺらぼうだった→頭を一回り拡大し、目を追加（`Person.jsx`と同じ顔の作法）。
//  - 3姿勢の差が弱かった→ダンシングの車体の振り幅、スプリントの前傾をそれぞれ強調。
//  - `Person.jsx`と色定数(SKIN/HAIR)・先細り四角形(quad)を`kit.jsx`で共有し、同一人物として
//    自然に見えるようにした（このファイルとPerson.jsxで別々に定義されていた重複を解消）。
//  - 向き（真横図→3/4ビュー）はWave G-3で扱う。本弾では向きを変えず造形のみ改善する。
import React from "react";
import { SKIN, HAIR, OUTLINE, quad as quadKit, tube, silhouette } from "./kit.jsx";

// v39.9: ヘルメット色のバリエーション（同一チーム色でも見分けが付くように）。
// Wave F-3bでRaceView.jsxからこちらへ移設（スプライトの見た目に属するデータのため）。
export const CAP_COLORS = ["#e9e2d4", "#d94f4f", "#e0b23c", "#4b7fc1", "#43a047", "#7e57c2", "#eeeeee", "#2b3038"];

const FRAME = "#4d7ea8"; // Wave G-1: 灰色の細線→鋼色に着色（tube()で縁取りも付く）
const LIMB = "#242830";

// 2関節の逆運動学。根元(ax,ab)と先端(bx,bb)、骨の長さl1/l2から中間関節を返す。
// dirは曲げる向き(+1/-1)。届かない場合は距離をクランプして自然に伸び切らせる。
function joint(ax, ab, bx, bb, l1, l2, dir) {
  const dx = bx - ax, db = bb - ab;
  const d = Math.hypot(dx, db) || 0.0001;
  const ux = dx / d, ub = db / d;
  const dc = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, d));
  const a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { x: ax + ux * a - dir * h * ub, b: ab + ub * a + dir * h * ux };
}

// 姿勢ごとの腰・肩・頭・手の位置。上ハンドル(tops)と下ハンドル(drops)の握り分けもここで決まる。
const POSTURES = {
  normal:  { hip: [-1.6, 7.8], sh: [2.0, 10.0], head: [2.9, 10.9], hand: [5.0, 7.1], rock: 0 },
  // 立ち漕ぎ：腰をサドル(上面b≒8.15)から明確に持ち上げ、前へ乗り出す。車体の左右振りも強め。
  dancing: { hip: [0.6, 9.5],  sh: [3.0, 10.9], head: [3.7, 11.7], hand: [5.0, 7.1], rock: 1 },
  sprint:  { hip: [-2.2, 7.6], sh: [1.8, 8.6],  head: [2.8, 9.2],  hand: [6.0, 5.5], rock: 0 },
};

export function IsoRider({ x, y, color, cap, isPlayer, isAce, surging, simple, posture = "normal", phase = 0 }) {
  const s = isAce ? 1.14 : 1, u = 1.45 * s;
  const X = (a) => +(a * u).toFixed(2), Y = (b) => +(-b * u).toFixed(2);
  const px = (a, b, w, h, f, key) => <rect key={key} x={X(a)} y={Y(b + h)} width={+(w * u).toFixed(2)} height={+(h * u).toFixed(2)} fill={f} shapeRendering="crispEdges" />;
  const ln = (a, b, c, d, f, wd = 1, key) => <line key={key} x1={X(a)} y1={Y(b)} x2={X(c)} y2={Y(d)} stroke={f} strokeWidth={+(wd * u).toFixed(2)} strokeLinecap="round" />;
  // フレームのチューブ（縁取り付き太線）と先細り四角形（胴・袖）は`kit.jsx`でPerson.jsxと共有。
  const tb = (a, b, c, d, wd, key) => tube(X, Y, a, b, c, d, wd, u, FRAME, key);
  const quad = (p1, p2, hw1, hw2, f, key, off = 0, outline = false) => quadKit(X, Y, p1, p2, hw1, hw2, f, key, off, outline);

  const P = POSTURES[posture] || POSTURES.normal;
  const crank = phase * Math.PI * 2;
  // 立ち漕ぎは車体を左右に振る（ダンシングらしさはこの揺れで一気に伝わる）。Wave G-1で強調。
  const rock = P.rock ? Math.sin(crank) * 6.5 : 0;

  // ---- 車体の基準点（実車の比率に寄せてある。車輪半径2.9単位 ≒ 33cm換算） ----
  const RW = [-5.4, 2.9], FW = [5.4, 2.9];   // 後輪・前輪の中心（下端がb=0＝接地）
  const BB = [0.0, 2.5];                      // クランク軸
  const SEAT = [-1.6, 7.6];                   // シートクラスタ
  const HEADTOP = [4.6, 6.9];                 // ヘッドチューブ上端
  const BAR = [5.4, 7.0];                     // ステム先＝上ハンドル
  const DROP = [6.1, 5.4];                    // 下ハンドル

  // ---- ペダル（クランクを実際に回す） ----
  const CR = 1.5;
  const pedNear = [BB[0] + CR * Math.cos(crank), BB[1] + CR * Math.sin(crank)];
  const pedFar = [BB[0] - CR * Math.cos(crank), BB[1] - CR * Math.sin(crank)];

  // ---- 関節を解く ----
  const kneeNear = joint(P.hip[0], P.hip[1], pedNear[0], pedNear[1], 3.1, 3.0, 1);
  const kneeFar = joint(P.hip[0], P.hip[1], pedFar[0], pedFar[1], 3.1, 3.0, 1);
  const elbow = joint(P.sh[0], P.sh[1], P.hand[0], P.hand[1], 2.1, 2.0, -1);

  const wheelAngle = phase * 2.2; // 車輪の転がり（速すぎるとちらつくので控えめ）
  const wheel = (c, key) => (
    <g key={key}>
      <circle cx={X(c[0])} cy={Y(c[1])} r={+(2.9 * u).toFixed(2)} fill="none" stroke="#12141a" strokeWidth={+(0.95 * u).toFixed(2)} />
      <circle cx={X(c[0])} cy={Y(c[1])} r={+(2.2 * u).toFixed(2)} fill="none" stroke="#c9ced4" strokeWidth={+(0.3 * u).toFixed(2)} />
      {!simple && [0, 1, 2].map(i => {
        const a = wheelAngle + (i * Math.PI) / 3;
        const dx = Math.cos(a) * 2.0, db = Math.sin(a) * 2.0;
        return ln(c[0] - dx, c[1] - db, c[0] + dx, c[1] + db, "#c9ced4", 0.22, `sp${i}`);
      })}
      <circle cx={X(c[0])} cy={Y(c[1])} r={+(0.45 * u).toFixed(2)} fill="#12141a" />
    </g>
  );

  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      <ellipse cx="0" cy="0" rx={8.6 * s} ry={2 * s} fill="#000" opacity="0.22" />
      {surging && <g><rect x={-13 * s} y={-9 * s} width={8 * s} height={1.2 * s} fill="#fff" opacity="0.32" /><rect x={-11 * s} y={-12 * s} width={5 * s} height={1 * s} fill="#fff" opacity="0.2" /></g>}
      <g transform={rock ? `rotate(${rock.toFixed(2)})` : undefined}>
        {wheel(RW, "rw")}
        {wheel(FW, "fw")}
        {/* フレーム：チェーンステー／シートチューブ／ダウンチューブ／トップチューブ／フォーク／ステー。
            Wave G-1：太さ+縁取り付きの`tube()`にし、灰色→鋼色へ着色して存在感を出した。 */}
        {tb(RW[0], RW[1], BB[0], BB[1], 1.05, "cs")}
        {tb(BB[0], BB[1], SEAT[0], SEAT[1], 1.15, "st")}
        {tb(BB[0], BB[1], HEADTOP[0], HEADTOP[1], 1.25, "dt")}
        {tb(SEAT[0], SEAT[1], HEADTOP[0], HEADTOP[1], 1.15, "tt")}
        {tb(RW[0], RW[1], SEAT[0], SEAT[1], 1.0, "ss")}
        {tb(HEADTOP[0], HEADTOP[1], FW[0], FW[1], 1.1, "fork")}
        {/* ステム＋上ハンドル＋ドロップ（下ハンドルへ弧を描いて下りる） */}
        {tb(HEADTOP[0], HEADTOP[1], BAR[0], BAR[1], 1.0, "stem")}
        {tb(BAR[0] - 0.9, BAR[1], BAR[0], BAR[1], 1.05, "tops")}
        <path d={`M ${X(BAR[0])} ${Y(BAR[1])} Q ${X(BAR[0] + 1.1)} ${Y(BAR[1] - 0.3)} ${X(DROP[0])} ${Y(DROP[1])}`} fill="none" stroke={OUTLINE} strokeWidth={+(1.35 * u).toFixed(2)} strokeLinecap="round" />
        <path d={`M ${X(BAR[0])} ${Y(BAR[1])} Q ${X(BAR[0] + 1.1)} ${Y(BAR[1] - 0.3)} ${X(DROP[0])} ${Y(DROP[1])}`} fill="none" stroke={FRAME} strokeWidth={+(1.0 * u).toFixed(2)} strokeLinecap="round" />
        {/* サドル */}
        {px(-3.0, 7.6, 2.4, 0.55, "#20242c", "saddle")}
        {/* 奥側の脚 → 胴 → 手前側の脚 の順で重ねる */}
        {ln(P.hip[0], P.hip[1], kneeFar.x, kneeFar.b, "#171a20", 1.0, "thF")}
        {ln(kneeFar.x, kneeFar.b, pedFar[0], pedFar[1], "#171a20", 0.85, "shF")}
        {ln(BB[0], BB[1], pedFar[0], pedFar[1], "#6f757f", 0.35, "crF")}
        {/* 短パン（腰まわり）→ 胴 の順。腰から肩へ先細りの多角形で描き、背中側に
            個人識別色のラインを1本通す（姿勢の角度がそのまま背中の傾きに出る）。
            Wave G-1：半幅を拡大し縁取りを付けて、車体に対する人物の存在感を強めた。 */}
        {quad([P.hip[0] - 0.5, P.hip[1] - 0.3], [P.hip[0] + 0.6, P.hip[1] + 0.25], 1.35, 1.3, "#20242c", "shorts", 0, true)}
        {quad(P.hip, P.sh, 1.3, 1.55, color, "torso", 0, true)}
        {quad(P.hip, P.sh, 0.3, 0.35, cap || "#e9e2d4", "stripe", 0.9)}
        {/* 手前側の脚 */}
        {ln(BB[0], BB[1], pedNear[0], pedNear[1], "#8a919b", 0.35, "crN")}
        {ln(P.hip[0], P.hip[1], kneeNear.x, kneeNear.b, LIMB, 1.25, "thN")}
        {ln(kneeNear.x, kneeNear.b, pedNear[0], pedNear[1], LIMB, 1.0, "shN")}
        {/* 半袖の袖（肩まわり）＋腕（肩→肘→手） */}
        {quad(P.sh, [(P.sh[0] + elbow.x) / 2, (P.sh[1] + elbow.b) / 2], 1.35, 0.8, color, "sleeve", 0, true)}
        {ln(P.sh[0], P.sh[1], elbow.x, elbow.b, SKIN, 0.85, "ua")}
        {ln(elbow.x, elbow.b, P.hand[0], P.hand[1], SKIN, 0.75, "fa")}
        {/* 頭：Person.jsxと同じ「肌＋髪＋帽子(＝ヘルメット)＋目」構成にして同一人物に見せる。
            Wave G-1：一回り拡大し、目を追加して「顔」にした（のっぺらぼう対策）。 */}
        {px(P.head[0] - 1.15, P.head[1] - 1.2, 2.5, 2.4, SKIN, "head")}
        {px(P.head[0] - 1.15, P.head[1] - 0.65, 0.9, 1.85, HAIR, "hair")}
        {px(P.head[0] + 0.75, P.head[1] - 0.05, 0.4, 0.4, "#2a2118", "eye")}
        {px(P.head[0] - 1.25, P.head[1] + 1.0, 2.7, 0.95, cap || "#e9e2d4", "helm")}
        {px(P.head[0] + 1.25, P.head[1] + 1.0, 1.0, 0.45, cap || "#e9e2d4", "helmTail")}
        {/* 頭部のシルエット縁取り。髪・ヘルメットを重ねた後に描く（Person.jsxと同じ理由） */}
        {silhouette(X, Y, u, P.head[0] - 1.15, P.head[1] - 1.2, 2.5, 2.4, "headOutline")}
      </g>
      {isPlayer && <rect x={X(-3.0)} y={Y(12.6)} width={+(9.2 * u).toFixed(2)} height={+(4.2 * u).toFixed(2)} rx={u} fill="none" stroke="#27d3ff" strokeWidth="1.7" />}
    </g>
  );
}
