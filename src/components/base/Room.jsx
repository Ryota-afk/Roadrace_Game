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
import { isoBoxFaces, backFacePair } from "../../domain/season/baseViewLayout.js";

const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

export function Room({ b, proj, snow, selected }) {
  const f = isoBoxFaces(b.w, b.l, b.hw, b.hl, b.wallHeight, proj);
  const { corners, top } = f;
  const { back, left, right } = backFacePair(corners);
  const botBack = corners[back], botLeft = corners[left], botRight = corners[right];
  const topBack = top[back], topLeft = top[left], topRight = top[right];

  return (
    <g opacity={selected ? 1 : 0.98}>
      {/* 床：footprint全体（4頂点とも高さ0） */}
      <polygon points={poly([corners.N, corners.E, corners.S, corners.W])} fill={b.floor} stroke="#00000022" strokeWidth="0.6" />

      {/* 奥2壁：backに接する2面。leftは明るい面、rightは陰の面（光源は右上想定） */}
      <polygon points={poly([botLeft, botBack, topBack, topLeft])} fill={b.wallLight} stroke="#00000030" strokeWidth="0.6" />
      <polygon points={poly([botBack, botRight, topRight, topBack])} fill={b.wallDark} stroke="#00000030" strokeWidth="0.6" />
      {snow && <polygon points={poly([topLeft, topBack, topRight])} fill="#f7fbff" opacity="0.55" />}

      {/* 壁の足元にごく薄い巾木（床と壁の境界を明確にする） */}
      <polygon points={poly([botLeft, botBack, { x: botBack.x, y: botBack.y - 3 }, { x: botLeft.x, y: botLeft.y - 3 }])} fill="#00000022" />
      <polygon points={poly([botBack, botRight, { x: botRight.x, y: botRight.y - 3 }, { x: botBack.x, y: botBack.y - 3 }])} fill="#00000022" />

      {/* 見出し：奥の角の上に部屋アイコン＋ラベルの小さな札 */}
      <g transform={`translate(${topBack.x.toFixed(1)},${(topBack.y - 12).toFixed(1)})`}>
        <rect x="-8" y="-9" width="16" height="14" rx="3" fill={b.accent} opacity="0.92" />
        <text x="0" y="1.5" textAnchor="middle" fontSize="9" style={{ pointerEvents: "none" }}>{b.icon}</text>
      </g>

      {/* タップ領域を視覚的に示す枠線（選択中のみ） */}
      {selected && <polygon points={poly([corners.N, corners.E, corners.S, corners.W])} fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.5" />}
    </g>
  );
}
