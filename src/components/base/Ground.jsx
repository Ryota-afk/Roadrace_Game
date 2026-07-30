// BaseView（敷地画面）の地面。Wave Dで新設 → Wave D2で市松模様を廃止して再設計。
//
// Wave D2の見直し（詳細はDEVLOG §10）：Wave Dは芝を1タイルおきに明暗交互で塗っており、
// 実機では「チェス盤」にしか見えなかった（ユーザー指摘「地面の謎の市松模様」）。
// カイロソフトの芝は一様な1色で、装飾（草むら等）を点在させることで密度を作っている。
// ここでも芝はviewBox全面を覆う単色の矩形1枚にし、舗装プラザは大きなポリゴン1枚、
// 装飾は決定論的な散布点として描く方式へ改めた（ポリゴン数も1500超→100前後へ激減）。
import React from "react";
import { isoProject, isoBoxFaces, inWorldRect, scatterPoints, groundZone } from "../../domain/season/baseViewLayout.js";

const pt = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

// Wave E-1：一様な芝の下地はカメラ変換の**外側**（BaseViewのビューポート全面rect）へ移した。
// ズームアウトしてもビューポートは必ず芝色で埋まり、黒い余白が出ない。ここはカメラ変換の
// 内側に入る「world座標に紐づく物」＝プラザと芝の装飾だけを描く。
export function Ground({ proj, ground, plaza, loop, palette, bounds }) {
  const { pathW, pathL, trackHalfWidth } = loop;
  const P = (w, l) => isoProject(w, l, 0, proj);

  // 舗装プラザ：world矩形の4隅をそのまま投影した平行四辺形（＝アイソメ格子に乗る）
  const pz = [P(plaza.wMin, plaza.lMin), P(plaza.wMin, plaza.lMax), P(plaza.wMax, plaza.lMax), P(plaza.wMax, plaza.lMin)];

  // 描画物がカメラの可動範囲（sceneContentBounds）を食み出さないようにするクリップ。
  // これが無いと芝の装飾だけが遥かに広く散らばり（実測2444x1222 vs 本体894x933）、
  // ズームアウト下限が装飾に引きずられて「全体が見えるまで引く」が成立しなくなる。
  const within = (w, l, inset) => {
    if (!bounds) return true;
    const p = P(w, l);
    return p.x >= bounds.minX + inset && p.x <= bounds.maxX - inset
      && p.y >= bounds.minY + inset && p.y <= bounds.maxY - inset;
  };

  // 芝の装飾：草むらを散らす。舗装プラザの内側と周回路の帯の上には置かない。
  const tufts = scatterPoints(ground, ground.scatterStep, 91, 0.34)
    .filter(s => !inWorldRect(s.w, s.l, plaza))
    .filter(s => groundZone(s.w, s.l, pathW, pathL, trackHalfWidth, 0.2) !== "track")
    .filter(s => within(s.w, s.l, 12));

  return (
    <g>
      {/* 芝の濃淡パッチ（一様すぎるのを避ける淡い斑）。楕円ではなくアイソメの菱形で描き、
          地面の格子方向と揃える（Wave D2初版は楕円でシミのように見えていた） */}
      {tufts.filter(s => s.h < 0.16 && within(s.w, s.l, 62)).map((s, i) => {
        const d = isoBoxFaces(s.w, s.l, 1.1, 1.1, 0, proj).corners;
        return <polygon key={`patch${i}`} points={[d.N, d.E, d.S, d.W].map(pt).join(" ")}
          fill={palette.grassPatch} opacity="0.5" />;
      })}

      {/* 舗装プラザ（建物が建つ敷地）＋敷石の目地。目地が無いと広い無地の面になり
          「謎の台形」に見えるため、world軸に沿った線を等間隔で入れて方向を示す */}
      <polygon points={pz.map(pt).join(" ")} fill={palette.plaza} stroke={palette.plazaEdge} strokeWidth="1.5" />
      <g stroke={palette.plazaEdge} strokeWidth="0.7" opacity="0.5">
        {(() => {
          const lines = [];
          for (let w = Math.ceil(plaza.wMin / 2) * 2; w <= plaza.wMax; w += 2) {
            const a = P(w, plaza.lMin), b = P(w, plaza.lMax);
            lines.push(<line key={`pw${w}`} x1={a.x.toFixed(1)} y1={a.y.toFixed(1)} x2={b.x.toFixed(1)} y2={b.y.toFixed(1)} />);
          }
          for (let l = Math.ceil(plaza.lMin / 2) * 2; l <= plaza.lMax; l += 2) {
            const a = P(plaza.wMin, l), b = P(plaza.wMax, l);
            lines.push(<line key={`pl${l}`} x1={a.x.toFixed(1)} y1={a.y.toFixed(1)} x2={b.x.toFixed(1)} y2={b.y.toFixed(1)} />);
          }
          return lines;
        })()}
      </g>

      {/* 草むら（芝の上のみ） */}
      {tufts.map((s, i) => {
        const p = P(s.w, s.l);
        const c = palette.snow ? palette.grassPatch : palette.grassPatch;
        return (
          <g key={`tuft${i}`} opacity="0.9">
            <path d={`M ${(p.x - 3).toFixed(1)} ${p.y.toFixed(1)} l 1.4 -4 l 1.2 4`} fill={c} />
            <path d={`M ${(p.x + 0.4).toFixed(1)} ${p.y.toFixed(1)} l 1.6 -5 l 1.4 5`} fill={c} />
          </g>
        );
      })}
    </g>
  );
}
