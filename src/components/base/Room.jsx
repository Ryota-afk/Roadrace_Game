// BaseView（敷地画面）の部屋1棟分の描画。Wave E-2で新設し、Wave D/D2の3D箱の外観
// （壁2面＋屋根＋窓）を全面的に置き換えた。
// ユーザーの手描きスケッチに基づき、カイロソフトの室内表現（一部の壁だけを表示するカット
// アウト）を敷地画面そのものに採用する：床＋奥2壁だけを描き、手前2辺は開けたままにして
// 中（什器・人。Wave E-3/E-4で追加）が常に見える状態にする。
//
// 奥2壁の選び方は幾何学的に決まる：footprint(w±hw, l±hl)の4頂点のうち画面Y座標が最小＝
// カメラから最も遠い頂点(back)に接する2面が「奥の壁」になる（ユーザースケッチの「∧」型と
// 一致）。これはWave D2で修正した可視面選択(front=Y最大)の鏡像であり、
// `domain/season/baseViewLayout.js`の`backFacePair()`が同じ頂点集合から求める。
import React from "react";
import { isoBoxFaces, backFacePair, visibleFacePair, wallPoint, isoProject } from "../../domain/season/baseViewLayout.js";
import { ROOM_GRADE_RUG_COLOR, ROOM_GRADE_SHOWS_GROUT, ROOM_GRADE_SHOWS_RUG, ROOM_GRADE_SHOWS_LIGHT } from "../../data/baseViewRoomGrade.js";

const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

// Wave H-2: 部屋グレードの付加物（目地・ラグ・天井照明の光溜まり）。
// N/E/S/Wの4隅はisoBoxFaces内部で N=(w-hw,l+hl) E=(w+hw,l+hl) S=(w+hw,l-hl) W=(w-hw,l-hl)
// という単純な軸並行の矩形をworld座標のまま投影しているだけ（isoProjectは線形写像）なので、
// 目地の格子点は screen座標を補間するのではなく、world座標(r.w±hw, r.l±hl)の内分点を
// 先に求めてから isoProject する方が素直で正確（斜めの補間誤差が原理的に出ない）。
function RoomGradeOverlay({ r, proj, grade }) {
  if (!grade) return null;
  const { w, l, hw, hl, key } = r;
  const nodes = [];
  if (ROOM_GRADE_SHOWS_GROUT(grade)) {
    // 3×3格子になるよう、各軸を1/3・2/3で仕切る目地を1本ずつ引く（各軸2本＝設計時に
    // 定めた上限「1部屋あたり各軸4本程度」の範囲内）。
    for (const f of [1 / 3, 2 / 3]) {
      const wLine = w - hw + 2 * hw * f;
      const a = isoProject(wLine, l - hl, 0, proj), b = isoProject(wLine, l + hl, 0, proj);
      nodes.push(<line key={`grout-w${f}`} x1={a.x.toFixed(1)} y1={a.y.toFixed(1)} x2={b.x.toFixed(1)} y2={b.y.toFixed(1)} stroke="#00000014" strokeWidth="0.5" />);
      const lLine = l - hl + 2 * hl * f;
      const c = isoProject(w - hw, lLine, 0, proj), d = isoProject(w + hw, lLine, 0, proj);
      nodes.push(<line key={`grout-l${f}`} x1={c.x.toFixed(1)} y1={c.y.toFixed(1)} x2={d.x.toFixed(1)} y2={d.y.toFixed(1)} stroke="#00000014" strokeWidth="0.5" />);
    }
  }
  if (ROOM_GRADE_SHOWS_RUG(grade)) {
    // ラグ：部屋中央に一回り小さい相似形の床を重ねる。色は部屋アクセント（既存の識別色）の再利用。
    const rugCorners = isoBoxFaces(w, l, hw * 0.55, hl * 0.55, 0, proj).corners;
    nodes.push(<polygon key="rug" points={poly([rugCorners.N, rugCorners.E, rugCorners.S, rugCorners.W])}
      fill={ROOM_GRADE_RUG_COLOR[key] || "#c9a23c"} opacity="0.4" />);
  }
  if (ROOM_GRADE_SHOWS_LIGHT(grade)) {
    // 天井照明の光溜まり：中心の真上に半透明の楕円を数枚重ねてグラデーション風のにじみを作る
    // （SVGフィルタ(blur)は使わず、既存コード（PixelPersonの影楕円等）と同じ「重ね塗り」の
    // 手法に揃えている＝軽量でどの環境でも同じ見た目になる）。
    const c = isoProject(w, l, 0, proj);
    nodes.push(
      <g key="light">
        <ellipse cx={c.x} cy={c.y} rx={hw * 13} ry={hw * 6.5} fill="#fff6df" opacity="0.10" />
        <ellipse cx={c.x} cy={c.y} rx={hw * 8} ry={hw * 4} fill="#fff6df" opacity="0.14" />
      </g>
    );
  }
  return <>{nodes}</>;
}

// Wave F-2 redo: roomsを渡すと床を（玄関→廊下→各部屋という現実的な間取りの）部屋ごとに
// 色分けする。渡さない呼び出し元（テスト・将来の別用途）は従来通り単色の床1枚に
// フォールバックする。間仕切り壁は第23弾でBaseView.jsx側（什器・人物と同じ奥行き
// ソート列）へ移した（PartitionSliceNode参照）ためここでは描かない。
export function Room({ b, proj, snow, selected, rooms, grades }) {
  const f = isoBoxFaces(b.w, b.l, b.hw, b.hl, b.wallHeight, proj);
  const { corners, top } = f;
  const { back, left, right } = backFacePair(corners);
  const { front } = visibleFacePair(corners); // backの対角＝手前の開放頂点
  const botBack = corners[back], botLeft = corners[left], botRight = corners[right];
  const topBack = top[back], topLeft = top[left], topRight = top[right];

  // 入口（扉）：開放辺の1つ（left-front）の中央に、目印としての枠線＋マットを置く。
  // 実際に床を切り欠くわけではなく、どこから出入りするかを示す最小限の表現。
  const doorJamb1 = wallPoint(corners[left], corners[front], top[left], top[front], 0.40, 0);
  const doorJamb1Top = wallPoint(corners[left], corners[front], top[left], top[front], 0.40, 0.42);
  const doorJamb2 = wallPoint(corners[left], corners[front], top[left], top[front], 0.60, 0);
  const doorJamb2Top = wallPoint(corners[left], corners[front], top[left], top[front], 0.60, 0.42);
  const matA = wallPoint(corners[left], corners[front], top[left], top[front], 0.36, 0);
  const matB = wallPoint(corners[left], corners[front], top[left], top[front], 0.64, 0);

  return (
    <g opacity={selected ? 1 : 0.98}>
      {/* 床：roomsがあれば部屋ごとに色分け。無ければfootprint全体を単色(従来通り)。 */}
      {rooms
        ? rooms.map((r) => {
            const rf = isoBoxFaces(r.w, r.l, r.hw, r.hl, 0, proj).corners;
            return (
              <React.Fragment key={`room-${r.key}`}>
                <polygon points={poly([rf.N, rf.E, rf.S, rf.W])} fill={r.floorTint} stroke="#00000018" strokeWidth="0.5" />
                <RoomGradeOverlay r={r} proj={proj} grade={(grades && grades[r.key]) || 0} />
              </React.Fragment>
            );
          })
        : <polygon points={poly([corners.N, corners.E, corners.S, corners.W])} fill={b.floor} stroke="#00000022" strokeWidth="0.6" />}

      {/* 第20弾: 開放2辺（手前）の床の縁に低い段差を描き、床と前庭舗装（同系色）の境界を
          はっきりさせる。これが無いと車や噴水が「屋内にある」ように見える（ユーザー指摘の
          「地面の下にあるかのよう」と同種の錯視の予防）。 */}
      <polygon points={poly([corners[left], corners[front], { x: corners[front].x, y: corners[front].y - 4 }, { x: corners[left].x, y: corners[left].y - 4 }])} fill="#00000030" />
      <polygon points={poly([corners[front], corners[right], { x: corners[right].x, y: corners[right].y - 4 }, { x: corners[front].x, y: corners[front].y - 4 }])} fill="#00000030" />

      {/* 入口（扉）：開放辺(left-front)の中央に敷物＋短い枠柱を置き、出入口の目印にする */}
      <polygon points={poly([matA, matB, { x: matB.x, y: matB.y - 3 }, { x: matA.x, y: matA.y - 3 }])} fill="#8a6a45" opacity="0.85" />
      <line x1={doorJamb1.x.toFixed(1)} y1={doorJamb1.y.toFixed(1)} x2={doorJamb1Top.x.toFixed(1)} y2={doorJamb1Top.y.toFixed(1)} stroke="#5a4632" strokeWidth="1.6" />
      <line x1={doorJamb2.x.toFixed(1)} y1={doorJamb2.y.toFixed(1)} x2={doorJamb2Top.x.toFixed(1)} y2={doorJamb2Top.y.toFixed(1)} stroke="#5a4632" strokeWidth="1.6" />

      {/* 奥2壁：backに接する2面。leftは明るい面、rightは陰の面（光源は右上想定） */}
      <polygon points={poly([botLeft, botBack, topBack, topLeft])} fill={b.wallLight} stroke="#00000030" strokeWidth="0.6" />
      <polygon points={poly([botBack, botRight, topRight, topBack])} fill={b.wallDark} stroke="#00000030" strokeWidth="0.6" />
      {snow && <polygon points={poly([topLeft, topBack, topRight])} fill="#f7fbff" opacity="0.55" />}

      {/* 壁の足元にごく薄い巾木（床と壁の境界を明確にする） */}
      <polygon points={poly([botLeft, botBack, { x: botBack.x, y: botBack.y - 3 }, { x: botLeft.x, y: botLeft.y - 3 }])} fill="#00000022" />
      <polygon points={poly([botBack, botRight, { x: botRight.x, y: botRight.y - 3 }, { x: botBack.x, y: botBack.y - 3 }])} fill="#00000022" />

      {/* 第23弾: 間仕切り壁はここでは描かない。BaseView.jsx側で什器・人物と同じ奥行き
          ソート列（短冊分割・partitionSlices）に混ぜて描く（下記の「間仕切り壁の短冊描画」
          コメント・PartitionSliceNode参照）。什器より必ず後に描く旧実装は、壁が実際には
          手前にあるケースで什器を覆い隠せず「什器が壁の前に出て見える」原因だった
          （2026-08ユーザー指摘）。 */}

      {/* タップ領域を視覚的に示す枠線（選択中のみ） */}
      {selected && <polygon points={poly([corners.N, corners.E, corners.S, corners.W])} fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.5" />}
    </g>
  );
}

// 第23弾: 間仕切り壁1短冊分の描画（domain/season/baseViewLayout.jsのpartitionSlicesが
// 求めた1切片をBaseView.jsxの奥行きソート列にそのまま混ぜられる形で返す）。
export function partitionSliceNode(slice, wallLight, wallDark, key) {
  const shade = slice.vertical ? wallDark : wallLight;
  const { botA, botB, topA, topB } = slice.wp;
  return <polygon key={key} points={poly([botA, botB, topB, topA])} fill={shade} opacity="0.85" stroke="#00000030" strokeWidth="0.5" />;
}
