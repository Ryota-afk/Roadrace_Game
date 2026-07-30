// BaseView（敷地画面）の建物1棟の描画。Wave D（磨き込み）で新設。
// Step13第3弾時点は「壁2面+屋根」のみの単色ポリゴンで、しかも可視面選択のバグにより
// カメラから見えない奥側の面を描いていたため、屋根の菱形にほぼ隠れて「旗」のように見える
// 不具合があった（詳細はDEVLOG §10参照）。Wave Dで可視面選択を修正し、階数・窓格子・扉・
// パラペット・看板アイコン・接地影・屋上付帯物を追加して「建物」に見えるようにした。
import React from "react";
import { isoProject, visibleFacePair, wallPoint, buildingFloors } from "../../domain/season/baseViewLayout.js";
import { riderHash01 } from "../../sim/race.js";

const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const up = (p, h) => ({ x: p.x, y: p.y - h });
const keyHash = (key) => [...key].reduce((a, c) => a + c.charCodeAt(0), 0);

// 壁面(botA→botB, 上辺topA→topB)にrows行×cols列の窓を並べる。各窓の点灯/消灯は
// 建物key+行+列から決定論的に決める（Math.random不使用・毎フレーム点滅しない）。
function WindowGrid({ botA, botB, topA, topB, rows, cols, idBase, litColor, darkColor }) {
  const rects = [];
  for (let r = 0; r < rows; r++) {
    const vBot = 1 - (r + 0.78) / rows, vTop = 1 - (r + 0.28) / rows;
    for (let c = 0; c < cols; c++) {
      const uL = (c + 0.18) / cols, uR = (c + 0.82) / cols;
      const p1 = wallPoint(botA, botB, topA, topB, uL, vBot), p2 = wallPoint(botA, botB, topA, topB, uR, vBot);
      const p3 = wallPoint(botA, botB, topA, topB, uR, vTop), p4 = wallPoint(botA, botB, topA, topB, uL, vTop);
      const lit = riderHash01(idBase + r * 13 + c * 7, 311) > 0.45;
      rects.push(<polygon key={`w${r}_${c}`} points={poly([p1, p2, p3, p4])} fill={lit ? litColor : darkColor} stroke="#00000040" strokeWidth="0.4" />);
    }
  }
  return <>{rects}</>;
}

export function IsoBuilding({ b, level, snow, proj }) {
  const floors = buildingFloors(level, b.levelMax);
  const height = floors * b.floorHeight;
  const N = isoProject(b.w - b.hw, b.l, 0, proj), E = isoProject(b.w, b.l + b.hl, 0, proj);
  const S = isoProject(b.w + b.hw, b.l, 0, proj), W = isoProject(b.w, b.l - b.hl, 0, proj);
  const center = isoProject(b.w, b.l, 0, proj);
  const corners = { N, E, S, W };
  const { front, left, right } = visibleFacePair(corners);
  const topCorners = { N: up(N, height), E: up(E, height), S: up(S, height), W: up(W, height) };

  const botFront = corners[front], botLeft = corners[left], botRight = corners[right];
  const topFront = topCorners[front], topLeft = topCorners[left], topRight = topCorners[right];

  const idBase = keyHash(b.key);
  const capH = Math.max(2, height * 0.06);
  const parapetPoly = (botA, botB, topA, topB) => {
    const tA = up(topA, -capH), tB = up(topB, -capH); // 上へcapHぶん盛り上げる
    return poly([topA, topB, tB, tA]);
  };

  // 屋上の頂点(apex)：4隅のうちscreen Y最小＝最も奥・高く見える点。旗・アンテナの起点にする。
  const apexKey = ["N", "E", "S", "W"].reduce((a, k) => (topCorners[k].y < topCorners[a].y ? k : a), "N");
  const apex = topCorners[apexKey];

  return (
    <g>
      {/* 接地影 */}
      <polygon points={poly([
        { x: corners.N.x, y: corners.N.y }, { x: corners.E.x + 3, y: corners.E.y + 2 },
        { x: corners.S.x, y: corners.S.y + 4 }, { x: corners.W.x - 3, y: corners.W.y + 2 },
      ])} fill="#000000" opacity="0.22" />

      {/* 壁：左面(left-front)・右面(front-right) */}
      <polygon points={poly([botLeft, botFront, topFront, topLeft])} fill={b.wallL} stroke="#00000035" strokeWidth="0.5" />
      <polygon points={poly([botFront, botRight, topRight, topFront])} fill={b.wallR} stroke="#00000035" strokeWidth="0.5" />

      {/* 窓格子（各面独立） */}
      <WindowGrid botA={botLeft} botB={botFront} topA={topLeft} topB={topFront} rows={floors} cols={Math.max(1, Math.ceil(b.winCols / 2))} idBase={idBase + 1} litColor="#ffe9a8" darkColor="#2a3a4a" />
      <WindowGrid botA={botFront} botB={botRight} topA={topFront} topB={topRight} rows={floors} cols={Math.max(1, Math.floor(b.winCols / 2) + 1)} idBase={idBase + 2} litColor="#ffe9a8" darkColor="#2a3a4a" />

      {/* 扉（front頂点付近・右面側） */}
      {(() => {
        const d1 = wallPoint(botFront, botRight, topFront, topRight, 0.08, 0);
        const d2 = wallPoint(botFront, botRight, topFront, topRight, 0.32, 0);
        const d3 = wallPoint(botFront, botRight, topFront, topRight, 0.32, 0.62);
        const d4 = wallPoint(botFront, botRight, topFront, topRight, 0.08, 0.62);
        return <polygon points={poly([d1, d2, d3, d4])} fill="#3a2c1e" stroke="#00000050" strokeWidth="0.5" />;
      })()}

      {/* パラペット（壁と屋根の境の縁取り） */}
      <polygon points={parapetPoly(botLeft, botFront, topLeft, topFront)} fill={b.trim} opacity="0.85" />
      <polygon points={parapetPoly(botFront, botRight, topFront, topRight)} fill={b.trim} opacity="0.85" />

      {/* 屋根 */}
      <polygon points={poly([topCorners.N, topCorners.E, topCorners.S, topCorners.W])} fill={snow ? "#eef4f8" : b.roof} stroke="#00000040" strokeWidth="0.5" />

      {/* 3階建て(最高Lv)のみ：屋上付帯物（アンテナ+旗） */}
      {floors >= 3 && (
        <g>
          <line x1={apex.x} y1={apex.y} x2={apex.x} y2={apex.y - 10} stroke="#8a8f9a" strokeWidth="1" />
          <polygon points={`${apex.x},${(apex.y - 10).toFixed(1)} ${apex.x},${(apex.y - 4).toFixed(1)} ${(apex.x + 8).toFixed(1)},${(apex.y - 7).toFixed(1)}`} fill={b.roof} />
        </g>
      )}

      {/* 看板アイコン（建物footprintの中心の真上・壁の中央あたりの高さ） */}
      <text x={center.x} y={center.y - height * 0.42} textAnchor="middle" fontSize="11" style={{ pointerEvents: "none" }}>{b.icon}</text>
    </g>
  );
}
