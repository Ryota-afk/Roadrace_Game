// カイロソフト式敷地画面（BaseView）。Step13第3弾。
// FinalSprintCinematic（components/RaceView.jsx）の2:1ディメトリック投影・IsoRider・
// riderWander・30fps間引きrAFループをそのまま流用し、固定カメラ・周回路の「常設の拠点」表示へ
// 一般化した。ゲーム状態（月・育成・資金）には一切触れない環境演出専用コンポーネント。
import React, { useEffect, useRef, useState } from "react";
import { C, FONT_D, FONT_M } from "../../data/theme.js";
import { TYPES } from "../../data/abilities.js";
import { BASE_VIEW_BUILDINGS, BASE_VIEW_LOOP, BASE_VIEW_GROUND } from "../../data/baseViewBuildings.js";
import { isoProject, riderLoopPoint, levelScale, buildingLevels, isPathTile } from "../../domain/season/baseViewLayout.js";
import { IsoRider, CAP_COLORS, riderWander } from "../RaceView.jsx";
import { riderHash01 } from "../../sim/race.js";

const W = 480, H = 300;
const PROJ = { cx0: 240, cy0: 130, Px: 24, Py: 12, Lx: 22, Ly: -11 };
const RIDER_SPEED = 0.045; // 周回速度（t/秒）。1周(t=1)に約22秒。
// 選手が7名を超えたら簡易スプライト（IsoRiderのsimple版）に切り替える。
// FinalSprintCinematicが確立した「大人数ほど残像対策で簡易化する」しきい値を踏襲。
const SIMPLE_THRESHOLD = 7;

const diamond = (w, l, hw, hl) => {
  const p1 = isoProject(w - hw, l, 0, PROJ), p2 = isoProject(w, l + hl, 0, PROJ);
  const p3 = isoProject(w + hw, l, 0, PROJ), p4 = isoProject(w, l - hl, 0, PROJ);
  return `${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p3.x.toFixed(1)},${p3.y.toFixed(1)} ${p4.x.toFixed(1)},${p4.y.toFixed(1)}`;
};

function IsoBuilding({ b, level }) {
  const scale = levelScale(level, b.levelMax);
  const hw = b.hw * scale, hl = b.hl * scale, height = b.baseHeight * scale;
  const N = isoProject(b.w - hw, b.l, 0, PROJ), E = isoProject(b.w, b.l + hl, 0, PROJ);
  const Sc = isoProject(b.w + hw, b.l, 0, PROJ), Wp = isoProject(b.w, b.l - hl, 0, PROJ);
  const up = (p) => ({ x: p.x, y: p.y - height });
  const Nt = up(N), Et = up(E), St = up(Sc), Wt = up(Wp);
  const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <g>
      <polygon points={poly([N, Wp, Wt, Nt])} fill={b.wallL} stroke="#00000030" strokeWidth="0.5" />
      <polygon points={poly([N, E, Et, Nt])} fill={b.wallR} stroke="#00000030" strokeWidth="0.5" />
      <polygon points={poly([Nt, Et, St, Wt])} fill={b.roof} stroke="#00000030" strokeWidth="0.5" />
    </g>
  );
}

// paused=true（メニュー展開中）の間はelapsed秒数の加算そのものを止める。rAFの再開時に
// 経過時間がジャンプしない（＝一時停止中は本当に世界が止まって見える）よう、加算量を
// requestAnimationFrameのタイムスタンプ差分で管理する。
function useElapsedSeconds(paused) {
  const [tick, setTick] = useState(0);
  const elapsedRef = useRef(0);
  const lastTsRef = useRef(null);
  useEffect(() => {
    if (paused) { lastTsRef.current = null; return; }
    let raf, lastThrottle = 0;
    const loop = (t) => {
      if (lastTsRef.current == null) lastTsRef.current = t;
      elapsedRef.current += (t - lastTsRef.current) / 1000;
      lastTsRef.current = t;
      if (t - lastThrottle >= 32) { lastThrottle = t; setTick(x => x + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused]);
  return elapsedRef.current;
}

export function BaseView({ g, paused }) {
  const elapsed = useElapsedSeconds(!!paused);
  const levels = buildingLevels(g);
  const { wMin, wMax, lMin, lMax, tileStep } = BASE_VIEW_GROUND;

  const tiles = [];
  for (let w = wMin; w <= wMax + 1e-6; w += tileStep) {
    for (let l = lMin; l <= lMax + 1e-6; l += tileStep) {
      tiles.push({ w, l, path: isPathTile(w, l, BASE_VIEW_LOOP.pathW, BASE_VIEW_LOOP.pathL) });
    }
  }

  const roster = (g.roster || []).slice(0, 12);
  const simple = roster.length > SIMPLE_THRESHOLD;
  const riderRows = roster.map(r => {
    const { w, l } = riderLoopPoint(r.id, elapsed, RIDER_SPEED, BASE_VIEW_LOOP.pathW, BASE_VIEW_LOOP.pathL);
    const wob = riderWander(r.id, 7, elapsed, 0.5) * 0.12;
    const p = isoProject(w, l + wob, 0, PROJ);
    return {
      kind: "rider", r, x: p.x, y: p.y, sortY: p.y,
      cap: CAP_COLORS[Math.floor(riderHash01(r.id, 17) * CAP_COLORS.length) % CAP_COLORS.length],
      color: (TYPES[r.type] && TYPES[r.type].color) || C.yellow,
    };
  });
  const buildingRows = BASE_VIEW_BUILDINGS.map(b => {
    const scale = levelScale(levels[b.levelKey], b.levelMax);
    const front = isoProject(b.w - b.hw * scale, b.l, 0, PROJ);
    return { kind: "building", b, level: levels[b.levelKey], sortY: front.y };
  });
  const drawOrder = [...buildingRows, ...riderRows].sort((a, b) => a.sortY - b.sortY);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", aspectRatio: `${W} / ${H}`, borderRadius: 10, display: "block", background: "#243424" }}>
        {tiles.map((t, i) => (
          <polygon key={`gt${i}`} points={diamond(t.w, t.l, tileStep / 2, tileStep / 2)}
            fill={t.path ? (((Math.round(t.w / tileStep) + Math.round(t.l / tileStep)) & 1) ? "#a9977c" : "#b4a488") : (((Math.round(t.w / tileStep) + Math.round(t.l / tileStep)) & 1) ? "#33473a" : "#3a5040")}
            stroke="#00000018" strokeWidth="0.4" />
        ))}
        {drawOrder.map((item, i) => item.kind === "building"
          ? <IsoBuilding key={`b${item.b.key}`} b={item.b} level={item.level} />
          : <IsoRider key={`r${item.r.id}`} x={item.x} y={item.y} color={item.color} cap={item.cap} isPlayer={false} isAce={false} surging={false} simple={simple} />
        )}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 10, color: C.sub, marginTop: 4, fontFamily: FONT_M }}>
        {BASE_VIEW_BUILDINGS.map(b => (
          <span key={b.key}>{b.label} Lv{levels[b.levelKey]}</span>
        ))}
      </div>
    </div>
  );
}
