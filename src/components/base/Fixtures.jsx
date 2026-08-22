// クラブハウス各部屋の什器・小道具（Wave F-2 redo 追補 → Wave E-3で「施設Lvに応じて
// 増える什器」を統合し、旧`Clutter.jsx`から`git mv`で改称）。
// 追補1（isoProjectの地面点から手加減のpxオフセットで浮かせて描く方式）は「それっぽく
// 見えない、レイヤーもミスってる」、追補2（isoBoxの土台を追加した版）は「そもそもの形状が
// 単純な立方体・円+棒・長方形止まりでデザインが足りない。浮いて見えるものもある」と、
// 2度にわたりユーザーから却下・再指摘を受けた。追補3で形状を実物の特徴的なシルエット
// （自転車の車輪＝タイヤ+リム+スポーク、椅子＝座面+背もたれ+4脚、ダンベル＝バー+両端の
// 円盤等）へ作り直し、床に接する要素は影と確実に接するよう座標を再検算した。
// Wave E-3では、この描画方式を踏襲したまま新規9種（ローラー増設・大型ファン・モニター・
// パーツ棚・2台目の作業スタンド・ホイール組み台・ワゴン・2台目のベッド・資料棚）を追加し、
// data/baseViewBuildings.jsのBASE_VIEW_FIXTURESの`minLevel`で段階的に解禁する。
import React from "react";
import { isoBoxFaces } from "../../domain/season/baseViewLayout.js";
import { pixelObjectNode } from "../sprites/pixelObject.jsx";
import { OBJ_SPRITES } from "../sprites/pixelObjectData.js";

const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

function isoBox(w, l, hw, hl, h, proj, colDark, colLight, colTop) {
  const f = isoBoxFaces(w, l, hw, hl, h, proj);
  return (
    <>
      <polygon points={poly([f.botLeft, f.botFront, f.topFront, f.topLeft])} fill={colDark} stroke="#00000030" strokeWidth="0.4" />
      <polygon points={poly([f.botFront, f.botRight, f.topRight, f.topFront])} fill={colLight} stroke="#00000030" strokeWidth="0.4" />
      <polygon points={poly([f.top.N, f.top.E, f.top.S, f.top.W])} fill={colTop} stroke="#00000030" strokeWidth="0.4" />
    </>
  );
}

function shadow(w, l, hw, hl, proj) {
  const c = isoBoxFaces(w + 0.04, l - 0.04, hw, hl, 0, proj).corners;
  return <polygon points={poly([c.N, c.E, c.S, c.W])} fill="#000" opacity="0.14" />;
}

// 自転車の車輪：タイヤ(太い暗色の輪)＋リム(細い明色の輪)＋スポーク3本＋ハブ。
// components/base/Station.jsxのwheelIconと同じ考え方（このファイルもStation.jsx/Props.jsx
// と同様に描画ヘルパーを自前で持つ既存方針を踏襲）。
function wheelIcon(cx, cy, r, key) {
  const spokes = [0, 60, 120].map((deg) => {
    const rad = (deg * Math.PI) / 180, dx = Math.cos(rad) * r * 0.62, dy = Math.sin(rad) * r * 0.62;
    return <line key={deg} x1={(cx - dx).toFixed(1)} y1={(cy - dy).toFixed(1)} x2={(cx + dx).toFixed(1)} y2={(cy + dy).toFixed(1)} stroke="#c9ced4" strokeWidth="0.6" />;
  });
  return (
    <g key={key}>
      <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={r} fill="none" stroke="#2a2e33" strokeWidth={(r * 0.32).toFixed(1)} />
      <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={(r * 0.68).toFixed(1)} fill="none" stroke="#c9ced4" strokeWidth={(r * 0.12).toFixed(1)} />
      {spokes}
      <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={(r * 0.13).toFixed(1)} fill="#2a2e33" />
    </g>
  );
}

// トレーニング室：床に直置きしたダンベル2個（太いバー+両端の丸い錘。錘は2枚重ねで厚みを
// 出す）。什器や床の影と同じ高さ0の地面点を基準に置くため、宙に浮いて見えない。
function dumbbellsNode(w, l, proj, key) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  const dumbbell = (cx, cy, scale) => (
    <g key={cx}>
      <line x1={(cx - 7 * scale).toFixed(1)} y1={cy.toFixed(1)} x2={(cx + 7 * scale).toFixed(1)} y2={cy.toFixed(1)} stroke="#4a4f58" strokeWidth={(2.2 * scale).toFixed(1)} strokeLinecap="round" />
      {[-1, 1].map((sign) => (
        <g key={sign}>
          <ellipse cx={(cx + sign * 7 * scale).toFixed(1)} cy={cy.toFixed(1)} rx={(3.2 * scale).toFixed(1)} ry={(3.2 * scale).toFixed(1)} fill="#2a2e33" />
          <ellipse cx={(cx + sign * 7 * scale).toFixed(1)} cy={(cy - 0.8 * scale).toFixed(1)} rx={(3.2 * scale).toFixed(1)} ry={(2.6 * scale).toFixed(1)} fill="#3a3f46" />
        </g>
      ))}
    </g>
  );
  return (
    <g key={key}>
      <ellipse cx={(p.x - 2).toFixed(1)} cy={(p.y + 0.5).toFixed(1)} rx="11" ry="3.2" fill="#000" opacity="0.14" />
      {dumbbell(p.x - 4, p.y - 1, 1)}
      {dumbbell(p.x + 6, p.y + 2, 0.72)}
    </g>
  );
}

// トレーニング室：低いテーブル＋天面のボトル(円柱+キャップ+ラベル)とタオル(2枚重ねの帯)。
function waterTableNode(w, l, proj, key) {
  const hw = 0.2, hl = 0.16, h = 6;
  const top = isoBoxFaces(w, l, hw, hl, h, proj).top.N;
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#a89572", "#c9b48a", "#e0cda0")}
      <rect x={(top.x - 4).toFixed(1)} y={(top.y - 1.8).toFixed(1)} width="7" height="1.6" rx="0.6" fill="#dfe6e9" opacity="0.95" />
      <rect x={(top.x - 3.4).toFixed(1)} y={(top.y - 0.6).toFixed(1)} width="6" height="1.4" rx="0.6" fill="#c9463c" opacity="0.75" />
      <rect x={(top.x + 2).toFixed(1)} y={(top.y - 6.6).toFixed(1)} width="2.4" height="6.2" rx="1.1" fill="#5aa3c9" stroke="#2a5c78" strokeWidth="0.4" />
      <rect x={(top.x + 2.3).toFixed(1)} y={(top.y - 5.4).toFixed(1)} width="1.8" height="1.7" fill="#e8f4fa" opacity="0.65" />
      <rect x={(top.x + 2.5).toFixed(1)} y={(top.y - 8).toFixed(1)} width="1.4" height="1.6" rx="0.3" fill="#2a5c78" />
    </g>
  );
}

// トレーニング室（Wave E-3新規）：増設ローラー（低い台＋ローラー2本。フレームは無く
// 「予備の台」であることを示す最小限の構成）。
// 第19弾: ドット絵化（sprites/pixelObjectData.jsの静的rows・影はヘルパーが敷く）
function rollerUnitNode(w, l, proj, key) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  return pixelObjectNode({
    x: p.x, y: p.y, data: OBJ_SPRITES.rollerUnit, key,
    cacheKey: "obj-rollerUnit", shadowRx: 10.5, shadowRy: 5.2,
  });
}

// トレーニング室（Wave E-3新規）：大型サーキュレーター（支柱＋丸いガード付きの羽根＋台座）。
function fanNode(w, l, proj, key) {
  const base = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  const h = 10, headY = base.y - h;
  return (
    <g key={key}>
      {shadow(w, l, 0.22, 0.2, proj)}
      <ellipse cx={base.x.toFixed(1)} cy={base.y.toFixed(1)} rx="3.2" ry="1.3" fill="#3a3f46" />
      <line x1={base.x.toFixed(1)} y1={base.y.toFixed(1)} x2={base.x.toFixed(1)} y2={(headY + 3).toFixed(1)} stroke="#5a626c" strokeWidth="1.5" />
      <circle cx={base.x.toFixed(1)} cy={headY.toFixed(1)} r="4.2" fill="#e8ecef" stroke="#8a919b" strokeWidth="0.8" />
      {[0, 60, 120].map((deg) => {
        const rad = (deg * Math.PI) / 180, dx = Math.cos(rad) * 3.3, dy = Math.sin(rad) * 3.3;
        return <line key={deg} x1={base.x.toFixed(1)} y1={headY.toFixed(1)} x2={(base.x + dx).toFixed(1)} y2={(headY + dy).toFixed(1)} stroke="#8a919b" strokeWidth="0.7" />;
      })}
      <circle cx={base.x.toFixed(1)} cy={headY.toFixed(1)} r="0.8" fill="#8a919b" />
    </g>
  );
}

// トレーニング室（Wave E-3新規）：計測モニター（支柱＋画面＋簡易グラフ）。
function monitorNode(w, l, proj, key) {
  const base = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  const h = 11, screenY = base.y - h;
  return (
    <g key={key}>
      {shadow(w, l, 0.16, 0.14, proj)}
      <line x1={base.x.toFixed(1)} y1={base.y.toFixed(1)} x2={base.x.toFixed(1)} y2={(screenY + 2.4).toFixed(1)} stroke="#5a626c" strokeWidth="1.3" />
      <rect x={(base.x - 3.4).toFixed(1)} y={(screenY - 2.6).toFixed(1)} width="6.8" height="5" rx="0.6" fill="#1c2a33" stroke="#3a4a54" strokeWidth="0.5" />
      <polyline points={`${(base.x - 2.4).toFixed(1)},${(screenY + 1).toFixed(1)} ${(base.x - 0.8).toFixed(1)},${(screenY - 0.6).toFixed(1)} ${(base.x + 0.6).toFixed(1)},${(screenY + 0.4).toFixed(1)} ${(base.x + 2.2).toFixed(1)},${(screenY - 1.4).toFixed(1)}`} fill="none" stroke="#4fd1c5" strokeWidth="0.6" />
    </g>
  );
}

// メカニック室：予備の車輪2本を壁際に立てかける。円の下端がちょうど床影に接するよう
// cyを計算し（cy = 地面y - r）、宙に浮かない。手前の車輪をわずかに大きく・低い位置に
// 置いて奥行きを表現する。
function wheelsLeaningNode(w, l, proj, key) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  const r1 = 6.2, r2 = 5.4;
  const cy1 = p.y - r1 * 0.92, cy2 = p.y - 2.4 - r2 * 0.92;
  return (
    <g key={key}>
      <ellipse cx={(p.x - 1).toFixed(1)} cy={(p.y + 0.5).toFixed(1)} rx="8.5" ry="2.6" fill="#000" opacity="0.15" />
      {wheelIcon(p.x + 3, cy2, r2, "back")}
      {wheelIcon(p.x - 2, cy1, r1, "front")}
    </g>
  );
}

// メカニック室：工具箱（本体+取っ手のアーチ+顔を出したレンチとドライバー）。
function toolboxNode(w, l, proj, key) {
  const hw = 0.26, hl = 0.2, h = 5;
  const f = isoBoxFaces(w, l, hw, hl, h, proj);
  const top = f.top.N;
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#8a2e28", "#c9463c", "#dc5a4e")}
      <path d={`M ${(top.x - 3).toFixed(1)} ${(top.y - 0.5).toFixed(1)} Q ${top.x.toFixed(1)} ${(top.y - 5.5).toFixed(1)} ${(top.x + 3).toFixed(1)} ${(top.y - 0.5).toFixed(1)}`} fill="none" stroke="#5a2b26" strokeWidth="1.1" />
      <line x1={(top.x - 2).toFixed(1)} y1={(top.y - 1).toFixed(1)} x2={(top.x - 3.2).toFixed(1)} y2={(top.y - 6.4).toFixed(1)} stroke="#c9ced4" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx={(top.x - 3.2).toFixed(1)} cy={(top.y - 6.4).toFixed(1)} r="1.1" fill="none" stroke="#c9ced4" strokeWidth="0.8" />
      <line x1={(top.x + 1.6).toFixed(1)} y1={(top.y - 1).toFixed(1)} x2={(top.x + 2.6).toFixed(1)} y2={(top.y - 5.6).toFixed(1)} stroke="#e0a032" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

// メカニック室（Wave E-3新規）：パーツ棚（2段の棚板＋色違いの部品ケース3つ）。
// 第19弾: ドット絵化（開いた正面＝棚板2枚＋色付き小箱＋最下段のホイール）
function partsShelfNode(w, l, proj, key) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  return pixelObjectNode({
    x: p.x, y: p.y, data: OBJ_SPRITES.partsShelf, key,
    cacheKey: "obj-partsShelf", shadowRx: 11.5, shadowRy: 5.7,
  });
}

// メカニック室（Wave E-3新規）：2台目の作業スタンド（本体は主什器のWorkbenchFurnitureより
// 簡略化。支柱+車輪1つのみで「予備のスタンド」であることを示す）。
function workbench2Node(w, l, proj, key) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  const standY = p.y - 7, wheelCx = p.x + 3.5, wheelCy = p.y - 5.5;
  return (
    <g key={key}>
      {shadow(w, l, 0.32, 0.22, proj)}
      {isoBox(w, l, 0.32, 0.22, 5, proj, "#6b5636", "#8a6f48", "#a3814f")}
      <line x1={p.x.toFixed(1)} y1={p.y.toFixed(1)} x2={p.x.toFixed(1)} y2={standY.toFixed(1)} stroke="#8a8f99" strokeWidth="1.3" />
      <line x1={p.x.toFixed(1)} y1={standY.toFixed(1)} x2={wheelCx.toFixed(1)} y2={wheelCy.toFixed(1)} stroke="#c9463c" strokeWidth="1.2" strokeLinecap="round" />
      {wheelIcon(wheelCx, wheelCy, 3.3)}
    </g>
  );
}

// メカニック室（Wave E-3新規）：ホイール組み台（振れ取り台。2本脚のジグ＋車輪を垂直に固定）。
function wheelBuildStandNode(w, l, proj, key) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  const legTop = p.y - 5.2, cx = p.x, cy = p.y - 8.5;
  return (
    <g key={key}>
      {shadow(w, l, 0.22, 0.2, proj)}
      <line x1={(p.x - 2.6).toFixed(1)} y1={p.y.toFixed(1)} x2={(p.x - 2.6).toFixed(1)} y2={legTop.toFixed(1)} stroke="#5a626c" strokeWidth="1.3" />
      <line x1={(p.x + 2.6).toFixed(1)} y1={p.y.toFixed(1)} x2={(p.x + 2.6).toFixed(1)} y2={legTop.toFixed(1)} stroke="#5a626c" strokeWidth="1.3" />
      <line x1={(p.x - 2.6).toFixed(1)} y1={legTop.toFixed(1)} x2={(p.x + 2.6).toFixed(1)} y2={legTop.toFixed(1)} stroke="#5a626c" strokeWidth="1.3" />
      {wheelIcon(cx, cy, 4.4)}
    </g>
  );
}

// メディカル室：薬品棚（本体＋2段の棚板＋小さな薬瓶＋前面の赤十字）。
function cabinetNode(w, l, proj, key) {
  const hw = 0.2, hl = 0.15, h = 11;
  const f = isoBoxFaces(w, l, hw, hl, h, proj);
  const cx = (f.botFront.x + f.topFront.x) / 2, cy = (f.botFront.y + f.topFront.y) / 2;
  const shelfY1 = f.botFront.y - h * 0.34, shelfY2 = f.botFront.y - h * 0.66;
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#c7d3d8", "#eef4f6", "#ffffff")}
      <line x1={(f.botFront.x - 3.6).toFixed(1)} y1={shelfY1.toFixed(1)} x2={(f.botFront.x + 3.6).toFixed(1)} y2={shelfY1.toFixed(1)} stroke="#00000022" strokeWidth="0.5" />
      <line x1={(f.botFront.x - 3.6).toFixed(1)} y1={shelfY2.toFixed(1)} x2={(f.botFront.x + 3.6).toFixed(1)} y2={shelfY2.toFixed(1)} stroke="#00000022" strokeWidth="0.5" />
      <circle cx={(f.botFront.x - 2).toFixed(1)} cy={(shelfY1 - 1).toFixed(1)} r="0.8" fill="#4f8fe8" />
      <circle cx={(f.botFront.x + 1.6).toFixed(1)} cy={(shelfY2 - 1).toFixed(1)} r="0.8" fill="#c9463c" />
      <rect x={(cx - 1).toFixed(1)} y={(cy - 3).toFixed(1)} width="2" height="6" fill="#c9463c" />
      <rect x={(cx - 3).toFixed(1)} y={(cy - 1).toFixed(1)} width="6" height="2" fill="#c9463c" />
    </g>
  );
}

// メディカル室（Wave E-3新規）：処置用ワゴン（低い台＋天面のトレー＋足元の小さな車輪2つ）。
function medCartNode(w, l, proj, key) {
  const hw = 0.2, hl = 0.16, h = 6;
  const top = isoBoxFaces(w, l, hw, hl, h, proj).top.N;
  const base = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#c7d3d8", "#eef4f6", "#ffffff")}
      <rect x={(top.x - 2.6).toFixed(1)} y={(top.y - 1.3).toFixed(1)} width="5.2" height="1.5" fill="#dfe6e9" />
      <circle cx={(base.x - 2).toFixed(1)} cy={(base.y - 0.6).toFixed(1)} r="1" fill="#3a3f46" />
      <circle cx={(base.x + 2).toFixed(1)} cy={(base.y - 0.6).toFixed(1)} r="1" fill="#3a3f46" />
    </g>
  );
}

// メディカル室（Wave E-3新規）：2台目のベッド（主什器のMedicalFurnitureより簡略化。
// 枕のみで点滴スタンドは無く「予備のベッド」であることを示す）。
function bed2Node(w, l, proj, key) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  return (
    <g key={key}>
      {shadow(w, l, 0.5, 0.24, proj)}
      {isoBox(w, l, 0.5, 0.24, 7, proj, "#c7d3d8", "#eef4f6", "#ffffff")}
      <ellipse cx={(p.x - 8).toFixed(1)} cy={(p.y - 8).toFixed(1)} rx="3.6" ry="2" fill="#ffffff" stroke="#00000020" strokeWidth="0.4" />
    </g>
  );
}

// メディカル室・スカウト室共通：椅子（座面＋背もたれ(縦板)＋4本脚）。
// 旧版（箱+背もたれ線1本のみ）は「単純な立方体」と指摘された最大の要因だったため、
// 脚を4本の独立した線として描き分け、座面と背もたれを別々の面として構成し直した。
function chairNode(w, l, proj, key) {
  const seatH = 4.5, backH = 8.5;
  const f = isoBoxFaces(w, l, 0.15, 0.13, seatH, proj);
  const legs = [f.corners.N, f.corners.E, f.corners.S, f.corners.W];
  const seatTop = f.top;
  const backL = { x: seatTop.W.x, y: seatTop.W.y - (backH - seatH) };
  const backR = { x: seatTop.N.x, y: seatTop.N.y - (backH - seatH) };
  return (
    <g key={key}>
      {shadow(w, l, 0.15, 0.13, proj)}
      {legs.map((b, i) => (
        <line key={i} x1={b.x.toFixed(1)} y1={b.y.toFixed(1)} x2={b.x.toFixed(1)} y2={(b.y - seatH).toFixed(1)} stroke="#5a4632" strokeWidth="1.1" />
      ))}
      <polygon points={poly([seatTop.N, seatTop.E, seatTop.S, seatTop.W])} fill="#9c7a50" stroke="#5a4632" strokeWidth="0.5" />
      <polygon points={poly([seatTop.W, seatTop.N, backR, backL])} fill="#b89060" stroke="#5a4632" strokeWidth="0.6" />
    </g>
  );
}

// スカウト室：机の脇に立てるホワイトボード（キャスター付きの2本脚＋パネル＋マーカー
// トレー）。archNode/gymNodeと同じ「2本の脚＋その頂点を結ぶ形状」の実績のある描き方に、
// キャスター(小円)とマーカートレーを追加して「移動式ホワイトボード」の特徴を足した。
function whiteboardNode(w, l, proj, key) {
  const legA = isoBoxFaces(w, l - 0.35, 0, 0, 0, proj).corners.N;
  const legB = isoBoxFaces(w, l + 0.35, 0, 0, 0, proj).corners.N;
  const h = 15, panelH = 11;
  const topA = { x: legA.x, y: legA.y - h }, topB = { x: legB.x, y: legB.y - h };
  const botPanelA = { x: legA.x, y: legA.y - (h - panelH) }, botPanelB = { x: legB.x, y: legB.y - (h - panelH) };
  return (
    <g key={key}>
      <ellipse cx={legA.x.toFixed(1)} cy={legA.y.toFixed(1)} rx="1.4" ry="0.7" fill="#00000030" />
      <ellipse cx={legB.x.toFixed(1)} cy={legB.y.toFixed(1)} rx="1.4" ry="0.7" fill="#00000030" />
      <line x1={legA.x.toFixed(1)} y1={legA.y.toFixed(1)} x2={topA.x.toFixed(1)} y2={topA.y.toFixed(1)} stroke="#8a8f99" strokeWidth="1.4" />
      <line x1={legB.x.toFixed(1)} y1={legB.y.toFixed(1)} x2={topB.x.toFixed(1)} y2={topB.y.toFixed(1)} stroke="#8a8f99" strokeWidth="1.4" />
      <polygon points={poly([botPanelA, botPanelB, topB, topA])} fill="#f4f6f8" stroke="#8a8f99" strokeWidth="1" />
      <line x1={(topA.x + 2).toFixed(1)} y1={(topA.y + 3).toFixed(1)} x2={(topB.x - 2).toFixed(1)} y2={(topB.y + 7).toFixed(1)} stroke="#4f8fe8" strokeWidth="1" opacity="0.85" />
      <line x1={(topA.x + 2).toFixed(1)} y1={(topA.y + 7).toFixed(1)} x2={(topA.x + 6).toFixed(1)} y2={(topA.y + 5).toFixed(1)} stroke="#c9463c" strokeWidth="1" opacity="0.85" />
      <rect x={botPanelA.x.toFixed(1)} y={(botPanelA.y - 0.6).toFixed(1)} width={(botPanelB.x - botPanelA.x).toFixed(1)} height="1.2" fill="#c9ced4" />
      <circle cx={(botPanelA.x + 3).toFixed(1)} cy={(botPanelA.y - 0.6).toFixed(1)} r="0.6" fill="#4f8fe8" />
      <circle cx={(botPanelA.x + 5).toFixed(1)} cy={(botPanelA.y - 0.6).toFixed(1)} r="0.6" fill="#c9463c" />
    </g>
  );
}

// スカウト室：床に置いた選手ファイルの束（色違いのフォルダを扇状にずらして重ね、
// 「1枚の板」ではなく「複数のフォルダの束」に見えるようにする）。
function foldersNode(w, l, proj, key) {
  const p = isoBoxFaces(w, l, 0, 0, 0, proj).corners.N;
  const sheets = [
    { dx: -3, dy: 0.6, rot: -6, fill: "#c9a23c" },
    { dx: -1, dy: -0.2, rot: 3, fill: "#e8dfc8" },
    { dx: 1.4, dy: -1, rot: -3, fill: "#b89860" },
  ];
  return (
    <g key={key}>
      <ellipse cx={p.x.toFixed(1)} cy={(p.y + 0.6).toFixed(1)} rx="6.5" ry="2.2" fill="#000" opacity="0.13" />
      {sheets.map((s, i) => (
        <g key={i} transform={`translate(${(p.x + s.dx).toFixed(1)},${(p.y + s.dy).toFixed(1)}) rotate(${s.rot})`}>
          <rect x="-5" y="-3.4" width="10" height="4" rx="0.5" fill={s.fill} stroke="#00000025" strokeWidth="0.4" />
          <rect x="-3.4" y="-4.2" width="4" height="1.2" rx="0.3" fill={s.fill} />
        </g>
      ))}
    </g>
  );
}

// スカウト室（Wave E-3新規）：資料棚（棚板＋色違いの資料ケース2つ）。
function archiveShelfNode(w, l, proj, key) {
  const hw = 0.26, hl = 0.16, h = 10;
  const f = isoBoxFaces(w, l, hw, hl, h, proj);
  const shelfY = f.botFront.y - h * 0.5;
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#5c4a68", "#8a6fa0", "#a288b8")}
      <line x1={(f.botFront.x - 4).toFixed(1)} y1={shelfY.toFixed(1)} x2={(f.botFront.x + 4).toFixed(1)} y2={shelfY.toFixed(1)} stroke="#00000030" strokeWidth="0.5" />
      <rect x={(f.botFront.x - 3).toFixed(1)} y={(shelfY - 2.3).toFixed(1)} width="2.6" height="2.2" fill="#c9a23c" />
      <rect x={(f.botFront.x + 0.2).toFixed(1)} y={(shelfY - 2.3).toFixed(1)} width="2.6" height="2.2" fill="#4f8fe8" />
    </g>
  );
}

// 廊下：玄関そばの靴棚（2段の棚板＋それぞれに先の尖った靴のシルエット）。
function shoeRackNode(w, l, proj, key) {
  const hw = 0.34, hl = 0.13, h = 6;
  const f = isoBoxFaces(w, l, hw, hl, h, proj);
  const midH = h * 0.5;
  const shelfBotA = { x: f.botFront.x - 6, y: f.botFront.y - midH }, shelfBotB = { x: f.botFront.x + 6, y: f.botFront.y - midH };
  const shoe = (cx, cy, flip) => (
    <path
      d={`M ${(cx - 3 * flip).toFixed(1)} ${cy.toFixed(1)} q ${(-1.5 * flip).toFixed(1)} -2.4 ${(1.5 * flip).toFixed(1)} -2.6 q ${(3 * flip).toFixed(1)} -0.2 ${(4.5 * flip).toFixed(1)} 1.4 q ${(0.8 * flip).toFixed(1)} 1 ${(-0.5 * flip).toFixed(1)} 1.6 Z`}
      fill={flip > 0 ? "#3a3f46" : "#c9463c"}
    />
  );
  return (
    <g key={key}>
      {shadow(w, l, hw, hl, proj)}
      {isoBox(w, l, hw, hl, h, proj, "#6b5636", "#8a6f48", "#a3814f")}
      <line x1={shelfBotA.x.toFixed(1)} y1={shelfBotA.y.toFixed(1)} x2={shelfBotB.x.toFixed(1)} y2={shelfBotB.y.toFixed(1)} stroke="#00000030" strokeWidth="0.6" />
      {shoe(f.top.N.x - 5, f.top.N.y - 0.5, 1)}
      {shoe(f.top.N.x + 4, f.top.N.y - 0.8, -1)}
      {shoe(shelfBotA.x + 5.5, shelfBotA.y - 0.5, 1)}
    </g>
  );
}

const FIXTURE_RENDER = {
  dumbbells: dumbbellsNode, waterTable: waterTableNode,
  rollerUnit: rollerUnitNode, fan: fanNode, monitor: monitorNode,
  wheelsLeaning: wheelsLeaningNode, toolbox: toolboxNode,
  partsShelf: partsShelfNode, workbench2: workbench2Node, wheelBuildStand: wheelBuildStandNode,
  cabinet: cabinetNode, medCart: medCartNode, bed2: bed2Node, chair: chairNode,
  whiteboard: whiteboardNode, folders: foldersNode, archiveShelf: archiveShelfNode,
  shoeRack: shoeRackNode,
};

export function fixtureItems(proj, list) {
  return (list || []).map((c) => {
    const render = FIXTURE_RENDER[c.kind];
    return render ? render(c.w, c.l, proj, c.key) : null;
  }).filter(Boolean);
}
