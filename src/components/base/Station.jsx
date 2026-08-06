// クラブハウス内の持ち場（什器）1つぶんの描画。Wave E-2 redoで新設。
// 「大きな室内にそれぞれ対応した場所（机とか）がある」というユーザーのスケッチに基づき、
// トレーニング/メカニック/メディカル/スカウトの4持ち場それぞれに、ひと目で何の場所か
// 分かる什器のシルエットを置く。什器の種類・数を施設Lvに応じて増やすのはWave E-3で行う
// （現時点ではkindごとに固定1つ）。
//
// Wave F-2 redo 追補3：ユーザー指摘「そもそもの形状が単純な立方体・円+棒・長方形止まりで
// デザインが足りない」への対応。什器の輪郭を、単なる箱の集合ではなく「自転車の車輪
// （タイヤ+リム+スポーク+ハブ）」「フレームの三角形」等、実物の特徴的なシルエットへ
// 作り直した（詳細はDEVLOG参照）。
import React from "react";
import { isoBoxFaces } from "../../domain/season/baseViewLayout.js";

const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

// 天板が水平な低い箱（机・作業台・診察台の共通形状）。暗い面→明るい面→天面の順。
function tableBox(w, l, hw, hl, h, proj, legColor, topColor) {
  const f = isoBoxFaces(w, l, hw, hl, h, proj);
  return (
    <>
      <polygon points={poly([f.botLeft, f.botFront, f.topFront, f.topLeft])} fill={legColor} stroke="#00000030" strokeWidth="0.5" />
      <polygon points={poly([f.botFront, f.botRight, f.topRight, f.topFront])} fill={legColor} stroke="#00000030" strokeWidth="0.5" />
      <polygon points={poly([f.top.N, f.top.E, f.top.S, f.top.W])} fill={topColor} stroke="#00000030" strokeWidth="0.5" />
    </>
  );
}

function shadow(w, l, hw, hl, proj) {
  const c = isoBoxFaces(w + 0.05, l - 0.05, hw, hl, 0, proj).corners;
  return <polygon points={poly([c.N, c.E, c.S, c.W])} fill="#000" opacity="0.16" />;
}

// 自転車の車輪：タイヤ(太い暗色の輪)＋リム(細い明色の輪)＋スポーク3本＋ハブ。
// 実物の自転車の車輪を特徴づける最小限の要素（円1つだけでは「車輪」に見えない）。
function wheelIcon(cx, cy, r) {
  const spokes = [0, 60, 120].map((deg) => {
    const rad = (deg * Math.PI) / 180, dx = Math.cos(rad) * r * 0.62, dy = Math.sin(rad) * r * 0.62;
    return <line key={deg} x1={(cx - dx).toFixed(1)} y1={(cy - dy).toFixed(1)} x2={(cx + dx).toFixed(1)} y2={(cy + dy).toFixed(1)} stroke="#c9ced4" strokeWidth="0.7" />;
  });
  return (
    <g>
      <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={r} fill="none" stroke="#2a2e33" strokeWidth={(r * 0.34).toFixed(1)} />
      <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={(r * 0.68).toFixed(1)} fill="none" stroke="#c9ced4" strokeWidth={(r * 0.13).toFixed(1)} />
      {spokes}
      <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={(r * 0.14).toFixed(1)} fill="#2a2e33" />
    </g>
  );
}

// ローラー台：低い台＋台の上に乗った後輪(車輪アイコン)＋そこから伸びるフレームの三角形
// （トップチューブ・シートチューブ・後方への短いステー）。「箱+ただの円2つ」だった旧版を、
// 実際に自転車が固定されているように見える構成へ作り直した。
function RollerFurniture({ w, l, proj }) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  const wheelCx = p.x + 3, wheelCy = p.y - 13;
  const seatX = p.x - 9, seatY = p.y - 25;
  const bbX = p.x - 2, bbY = p.y - 12; // ボトムブラケット(クランク軸)相当の点
  return (
    <g>
      {shadow(w, l, 0.55, 0.32, proj)}
      {tableBox(w, l, 0.5, 0.28, 6, proj, "#5a6068", "#7a828c")}
      {/* ローラー3本（円柱を横から見た形：楕円の両端+胴の線） */}
      {[-9, 0, 9].map((dx, i) => (
        <g key={i}>
          <ellipse cx={(p.x + dx).toFixed(1)} cy={(p.y - 5).toFixed(1)} rx="1.6" ry="3.4" fill="#3a3f46" />
          <line x1={(p.x + dx - 1.6).toFixed(1)} y1={(p.y - 5).toFixed(1)} x2={(p.x + dx - 1.6).toFixed(1)} y2={(p.y - 2).toFixed(1)} stroke="#2a2e33" strokeWidth="0.6" />
        </g>
      ))}
      {/* フレームの三角形（トップチューブ・シートチューブ・後方ステー） */}
      <line x1={seatX.toFixed(1)} y1={seatY.toFixed(1)} x2={bbX.toFixed(1)} y2={bbY.toFixed(1)} stroke="#2f8f5c" strokeWidth="1.8" strokeLinecap="round" />
      <line x1={seatX.toFixed(1)} y1={seatY.toFixed(1)} x2={wheelCx.toFixed(1)} y2={(wheelCy - 6).toFixed(1)} stroke="#2f8f5c" strokeWidth="1.8" strokeLinecap="round" />
      <line x1={bbX.toFixed(1)} y1={bbY.toFixed(1)} x2={wheelCx.toFixed(1)} y2={wheelCy.toFixed(1)} stroke="#2f8f5c" strokeWidth="1.6" strokeLinecap="round" />
      {wheelIcon(wheelCx, wheelCy, 5.6)}
    </g>
  );
}

// 作業台：スタンドに固定された自転車（前後の車輪＋フレーム三角形＋支柱）＋工具箱。
// 旧版の「斜め線1本+丸2つ」を、車輪アイコン(タイヤ+リム+スポーク)と、フレームを構成する
// 3本の直線（トップ・ダウン・シート）で組んだ実物らしい輪郭へ作り直した。
function WorkbenchFurniture({ w, l, proj }) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  const rearX = p.x - 9, rearY = p.y - 8, frontX = p.x + 9, frontY = p.y - 12;
  const seatX = p.x - 7, seatY = p.y - 24, headX = p.x + 6, headY = p.y - 20;
  const standX = p.x, standY = p.y - 10;
  return (
    <g>
      {shadow(w, l, 0.5, 0.42, proj)}
      {tableBox(w, l, 0.46, 0.38, 10, proj, "#6b5636", "#a3814f")}
      {/* 固定スタンドの支柱 */}
      <line x1={standX.toFixed(1)} y1={p.y.toFixed(1)} x2={standX.toFixed(1)} y2={standY.toFixed(1)} stroke="#8a8f99" strokeWidth="2" />
      {/* フレーム：シート-BB-ヘッドの三角形＋トップチューブ */}
      <line x1={seatX.toFixed(1)} y1={seatY.toFixed(1)} x2={standX.toFixed(1)} y2={standY.toFixed(1)} stroke="#c9463c" strokeWidth="1.8" strokeLinecap="round" />
      <line x1={seatX.toFixed(1)} y1={seatY.toFixed(1)} x2={headX.toFixed(1)} y2={headY.toFixed(1)} stroke="#c9463c" strokeWidth="1.8" strokeLinecap="round" />
      <line x1={standX.toFixed(1)} y1={standY.toFixed(1)} x2={headX.toFixed(1)} y2={headY.toFixed(1)} stroke="#c9463c" strokeWidth="1.6" strokeLinecap="round" />
      <line x1={headX.toFixed(1)} y1={headY.toFixed(1)} x2={frontX.toFixed(1)} y2={frontY.toFixed(1)} stroke="#c9463c" strokeWidth="1.6" strokeLinecap="round" />
      <line x1={standX.toFixed(1)} y1={standY.toFixed(1)} x2={rearX.toFixed(1)} y2={rearY.toFixed(1)} stroke="#c9463c" strokeWidth="1.6" strokeLinecap="round" />
      {wheelIcon(rearX, rearY, 4.6)}
      {wheelIcon(frontX, frontY, 4.6)}
      {/* 工具箱：本体+取っ手+顔を出した工具 */}
      <rect x={(p.x - 15).toFixed(1)} y={(p.y - 7).toFixed(1)} width="7" height="5" rx="0.6" fill="#c9463c" stroke="#8a2e28" strokeWidth="0.5" />
      <path d={`M ${(p.x - 13).toFixed(1)} ${(p.y - 7).toFixed(1)} q 1.5 -3 3 0`} fill="none" stroke="#8a2e28" strokeWidth="0.8" />
      <line x1={(p.x - 12.5).toFixed(1)} y1={(p.y - 7).toFixed(1)} x2={(p.x - 11.5).toFixed(1)} y2={(p.y - 11).toFixed(1)} stroke="#c9ced4" strokeWidth="1" />
    </g>
  );
}

// 診察台：枕(丸み)＋掛け布団の折り目のある白いベッド＋点滴スタンド。
function MedicalFurniture({ w, l, proj }) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  return (
    <g>
      {shadow(w, l, 0.62, 0.30, proj)}
      {tableBox(w, l, 0.58, 0.26, 8, proj, "#c7d3d8", "#eef4f6")}
      {/* 枕 */}
      <ellipse cx={(p.x - 11).toFixed(1)} cy={(p.y - 9.5).toFixed(1)} rx="5" ry="2.6" fill="#ffffff" stroke="#00000020" strokeWidth="0.4" />
      {/* 掛け布団の折り目 */}
      <line x1={(p.x - 3).toFixed(1)} y1={(p.y - 8.6).toFixed(1)} x2={(p.x + 9).toFixed(1)} y2={(p.y - 10.4).toFixed(1)} stroke="#00000018" strokeWidth="0.6" />
      {/* 点滴スタンド：支柱+袋 */}
      <line x1={(p.x + 12).toFixed(1)} y1={p.y.toFixed(1)} x2={(p.x + 12).toFixed(1)} y2={(p.y - 18).toFixed(1)} stroke="#8a8f99" strokeWidth="1.2" />
      <rect x={(p.x + 10.4).toFixed(1)} y={(p.y - 18).toFixed(1)} width="3.2" height="4.4" rx="1" fill="#cfe8f5" stroke="#8fb8cc" strokeWidth="0.5" />
    </g>
  );
}

// スカウト用のデスク：引き出しの筋の入った天板＋画面を立てたノートPC＋書類の山。
function DeskFurniture({ w, l, proj }) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  return (
    <g>
      {shadow(w, l, 0.46, 0.34, proj)}
      {tableBox(w, l, 0.42, 0.3, 9, proj, "#5c4a68", "#8a6fa0")}
      {/* 引き出しの筋 */}
      <line x1={(p.x - 12).toFixed(1)} y1={(p.y - 3).toFixed(1)} x2={(p.x - 2).toFixed(1)} y2={(p.y - 5).toFixed(1)} stroke="#3f3350" strokeWidth="0.6" />
      {/* ノートPC：底面(キーボード)+画面(立てた板) */}
      <rect x={(p.x - 6).toFixed(1)} y={(p.y - 14).toFixed(1)} width="10" height="3" rx="0.6" fill="#3a3c41" />
      <rect x={(p.x - 5.4).toFixed(1)} y={(p.y - 21).toFixed(1)} width="9" height="7" rx="0.6" fill="#2a2c31" stroke="#000000" strokeWidth="0.3" />
      <rect x={(p.x - 4.6).toFixed(1)} y={(p.y - 20.3).toFixed(1)} width="7.4" height="5.6" fill="#6fa8dc" opacity="0.7" />
      {/* 書類の山 */}
      <rect x={(p.x + 6).toFixed(1)} y={(p.y - 11).toFixed(1)} width="5" height="4" fill="#e8dfc8" />
      <rect x={(p.x + 6.4).toFixed(1)} y={(p.y - 12.4).toFixed(1)} width="4.4" height="3.4" fill="#d8c9a8" />
    </g>
  );
}

// 空き部屋の仮置き（Wave F-2）：段ボール箱2つ＋養生テープ風の対角線。「バグで空っぽ」では
// なく「後々の機能追加用に確保済み」だとひと目で分かるようにする最小限の意匠。
function EmptyRoomFurniture({ w, l, proj }) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  return (
    <g opacity="0.85">
      {shadow(w, l, 0.42, 0.34, proj)}
      {tableBox(w - 0.16, l + 0.1, 0.22, 0.2, 6, proj, "#8a6a45", "#c9a876")}
      {tableBox(w + 0.2, l - 0.12, 0.16, 0.16, 4, proj, "#7a5c3c", "#b89060")}
      <line x1={p.x - 10} y1={p.y - 2} x2={p.x + 10} y2={p.y - 10} stroke="#c9a23c" strokeWidth="1.4" strokeDasharray="2,2" />
    </g>
  );
}

const FURNITURE = { roller: RollerFurniture, workbench: WorkbenchFurniture, medical: MedicalFurniture, desk: DeskFurniture, empty: EmptyRoomFurniture };

// grade(0〜3)はWave H-2の内装グレード。G3のみバッジに金枠を追加する
// （domain/season/baseViewLayout.jsのroomGrade参照。判断⑤a+c＝効果は無いが実績連動）。
export function Station({ s, proj, selected, grade = 0 }) {
  const Furniture = FURNITURE[s.kind] || DeskFurniture;
  const label = isoBoxFaces(s.w, s.l, 0, 0, 0, proj).corners.N;
  const goldBadge = grade >= 3;
  return (
    <g opacity={selected ? 1 : 0.98}>
      <Furniture w={s.w} l={s.l} proj={proj} />
      <g transform={`translate(${label.x.toFixed(1)},${(label.y - 24).toFixed(1)})`}>
        {goldBadge && <rect x="-9.5" y="-10.5" width="19" height="17" rx="4" fill="none" stroke="#f5d98a" strokeWidth="1.4" />}
        <rect x="-8" y="-9" width="16" height="14" rx="3" fill={s.accent} opacity="0.92" />
        <text x="0" y="1.5" textAnchor="middle" fontSize="9" style={{ pointerEvents: "none" }}>{s.icon}</text>
      </g>
      {selected && <circle cx={label.x} cy={label.y - 4} r="16" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.5" />}
    </g>
  );
}
