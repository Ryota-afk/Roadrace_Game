// BaseView（敷地画面）の建物1棟の描画。Wave Dで新設 → Wave D2でカイロソフト準拠に再設計。
//
// Wave D2の見直し（実機スクショに基づく診断・詳細はDEVLOG §10）：
//  ・屋根が原色の巨大な平面菱形で、壁(42px)より屋根の幅(86px)が倍あり建物が「色板」に見えていた
//    → 階高を26pxに引き上げて壁を主役にし、屋根は壁色から導いた暗色＋軒の張り出しへ変更
//  ・窓が大きすぎ・明るすぎて壁が「クリーム色のブロック格子」になっていた
//    → 窓を小さく（セルの約4割）暗いガラス色にし、点灯窓は少数だけに
//  ・機能が伝わらない → 正面に看板帯＋アイコンを追加（カイロソフトの店舗表現に倣う）
import React from "react";
import { isoProject, isoBoxFaces, wallPoint, buildingFloors } from "../../domain/season/baseViewLayout.js";
import { riderHash01 } from "../../sim/race.js";

const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const keyHash = (key) => [...key].reduce((a, c) => a + c.charCodeAt(0), 0);

// 壁面にrows行×cols列の窓を並べる。点灯/消灯は建物key+行+列から決定論的に決める
// （Math.random不使用・毎フレーム点滅しない）。昼の空色に合わせ、既定は暗いガラス色。
function WindowGrid({ botA, botB, topA, topB, rows, cols, idBase }) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    const vBot = 1 - (r + 0.70) / rows, vTop = 1 - (r + 0.32) / rows;
    for (let c = 0; c < cols; c++) {
      const uL = (c + 0.30) / cols, uR = (c + 0.70) / cols;
      const p1 = wallPoint(botA, botB, topA, topB, uL, vBot), p2 = wallPoint(botA, botB, topA, topB, uR, vBot);
      const p3 = wallPoint(botA, botB, topA, topB, uR, vTop), p4 = wallPoint(botA, botB, topA, topB, uL, vTop);
      const lit = riderHash01(idBase + r * 13 + c * 7, 311) > 0.78;
      out.push(<polygon key={`w${r}_${c}`} points={poly([p1, p2, p3, p4])}
        fill={lit ? "#f2dc9a" : "#41586b"} stroke="#1e2a33" strokeWidth="0.6" />);
    }
  }
  return <>{out}</>;
}

export function IsoBuilding({ b, level, snow, proj }) {
  const floors = buildingFloors(level, b.levelMax);
  const height = floors * b.floorHeight;
  const f = isoBoxFaces(b.w, b.l, b.hw, b.hl, height, proj);
  const { botFront, botLeft, botRight, topFront, topLeft, topRight, top } = f;
  const idBase = keyHash(b.key);

  // 軒：屋根を footprint より少し外へ張り出させる。実物の建物と同じく壁の上端に影の線が
  // できるため、屋根と壁の境界がはっきりし「箱」ではなく「建物」に見える。
  const OVER = 1.16;
  const eave = isoBoxFaces(b.w, b.l, b.hw * OVER, b.hl * OVER, height, proj).top;
  const roofPts = [eave.N, eave.E, eave.S, eave.W];
  const roofThick = 4;
  const roofLow = roofPts.map(p => ({ x: p.x, y: p.y + roofThick }));

  // 看板帯：正面（カメラに近い側）の明るい面の上部に水平の帯を置き、中央にアイコンを載せる。
  const sign = [
    wallPoint(botFront, botRight, topFront, topRight, 0.12, 0.74),
    wallPoint(botFront, botRight, topFront, topRight, 0.88, 0.74),
    wallPoint(botFront, botRight, topFront, topRight, 0.88, 0.93),
    wallPoint(botFront, botRight, topFront, topRight, 0.12, 0.93),
  ];
  const signMid = wallPoint(botFront, botRight, topFront, topRight, 0.5, 0.835);

  // 扉：正面の暗い面の足元に置く（看板帯とは別の面にして情報が重ならないようにする）。
  const door = [
    wallPoint(botLeft, botFront, topLeft, topFront, 0.58, 0),
    wallPoint(botLeft, botFront, topLeft, topFront, 0.86, 0),
    wallPoint(botLeft, botFront, topLeft, topFront, 0.86, 0.52 / floors),
    wallPoint(botLeft, botFront, topLeft, topFront, 0.58, 0.52 / floors),
  ];

  const center = isoProject(b.w, b.l, 0, proj);
  const shadow = isoBoxFaces(b.w + 0.12, b.l - 0.12, b.hw * 1.05, b.hl * 1.05, 0, proj).corners;

  return (
    <g>
      {/* 接地影（アイソメの菱形。Wave Dはスクリーン座標の楕円で格子に乗っていなかった） */}
      <polygon points={poly([shadow.N, shadow.E, shadow.S, shadow.W])} fill="#000" opacity="0.18" />

      {/* 壁：暗い面(-l側)→明るい面(+l側)の順に描く */}
      <polygon points={poly([botLeft, botFront, topFront, topLeft])} fill={b.wallDark} stroke="#00000030" strokeWidth="0.6" />
      <polygon points={poly([botFront, botRight, topRight, topFront])} fill={b.wallLight} stroke="#00000030" strokeWidth="0.6" />

      {/* 窓（各面独立・階数ぶんの行） */}
      <WindowGrid botA={botLeft} botB={botFront} topA={topLeft} topB={topFront} rows={floors} cols={2} idBase={idBase + 1} />
      <WindowGrid botA={botFront} botB={botRight} topA={topFront} topB={topRight} rows={Math.max(1, floors - 1)} cols={3} idBase={idBase + 2} />

      {/* 扉 */}
      <polygon points={poly(door)} fill="#3c2f22" stroke="#00000055" strokeWidth="0.6" />

      {/* 看板帯＋機能アイコン */}
      <polygon points={poly(sign)} fill={b.accent} stroke="#00000045" strokeWidth="0.6" />
      <text x={signMid.x.toFixed(1)} y={(signMid.y + 3.4).toFixed(1)} textAnchor="middle" fontSize="10"
        style={{ pointerEvents: "none" }}>{b.icon}</text>

      {/* 屋根：軒の厚み（側面）→ 天面の順。天面は壁より暗くして主張を抑える */}
      <polygon points={poly([roofLow[0], roofLow[1], roofLow[2], roofLow[3]])} fill="#000" opacity="0.35" />
      <polygon points={poly(roofPts)} fill={snow ? "#eef4f8" : b.roof} stroke="#00000055" strokeWidth="0.8" />
      {/* 屋上パラペット（屋根の縁の内側に一回り小さい枠。平坦な板に見えないための手がかり） */}
      <polygon points={poly(isoBoxFaces(b.w, b.l, b.hw * 0.82, b.hl * 0.82, height, proj).top4)}
        fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.12" />

      {/* 最高Lv（3階建て）のみ：屋上の設備＋チームフラッグ */}
      {floors >= 3 && (() => {
        const tankH = 10;
        const tank = isoBoxFaces(b.w, b.l + 0.22, 0.20, 0.16, tankH, proj);
        const poleTop = { x: top.W.x + 6, y: top.W.y - 26 };
        return (
          <g>
            <polygon points={poly([tank.botLeft, tank.botFront, tank.topFront, tank.topLeft])} fill="#6d7681" />
            <polygon points={poly([tank.botFront, tank.botRight, tank.topRight, tank.topFront])} fill="#8b95a1" />
            <polygon points={poly([tank.top.N, tank.top.E, tank.top.S, tank.top.W])} fill="#a4aeb9" />
            <line x1={(top.W.x + 6).toFixed(1)} y1={top.W.y.toFixed(1)} x2={poleTop.x.toFixed(1)} y2={poleTop.y.toFixed(1)} stroke="#7c848e" strokeWidth="1.2" />
            <polygon points={`${poleTop.x.toFixed(1)},${poleTop.y.toFixed(1)} ${poleTop.x.toFixed(1)},${(poleTop.y + 8).toFixed(1)} ${(poleTop.x + 13).toFixed(1)},${(poleTop.y + 4).toFixed(1)}`} fill={b.accent} />
          </g>
        );
      })()}
    </g>
  );
}
