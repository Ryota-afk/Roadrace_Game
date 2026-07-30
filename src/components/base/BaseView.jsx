// カイロソフト式敷地画面（BaseView）。Step13第3弾で新設、Wave D（磨き込み）で全面拡張。
// FinalSprintCinematic（components/RaceView.jsx）の2:1ディメトリック投影・IsoRider・
// riderWander・30fps間引きrAFループを流用した、固定カメラ・周回路の「常設の拠点」表示。
// ゲーム状態（月・育成・資金）には一切触れない環境演出専用コンポーネント（月は季節演出の
// 参照にのみ使う＝時間経過そのものはメニュー操作でのみ進む設計を崩さない）。
// Wave Dで「建物に見えない（可視面選択のバグ）」「コースが読めない」問題を修正し、
// 建物詳細（階数・窓・扉・看板）・角丸オーバルコース・地面ゾーニング・季節・小物を追加した
// （設計の経緯・診断はDEVLOG §10参照）。
import React, { useEffect, useRef, useState } from "react";
import { C, FONT_M } from "../../data/theme.js";
import { BASE_VIEW_BUILDINGS, BASE_VIEW_LOOP, BASE_VIEW_GROUND, BASE_VIEW_SEASON_PALETTE, BASE_VIEW_PROPS } from "../../data/baseViewBuildings.js";
import { isoProject, riderLoopPoint, buildingLevels, seasonOf } from "../../domain/season/baseViewLayout.js";
import { IsoRider, CAP_COLORS, riderWander } from "../RaceView.jsx";
import { riderHash01 } from "../../sim/race.js";
import { IsoBuilding } from "./IsoBuilding.jsx";
import { Track } from "./Track.jsx";
import { Ground } from "./Ground.jsx";
import { propItems } from "./Props.jsx";
import { TYPES } from "../../data/abilities.js";

const W = 480, H = 300;
const PROJ = { cx0: 240, cy0: 130, Px: 24, Py: 12, Lx: 22, Ly: -11 };
const RIDER_SPEED = 0.05; // 周回速度（t/秒）
// 選手が7名を超えたら簡易スプライト（IsoRiderのsimple版）に切り替える。
// FinalSprintCinematicが確立した「大人数ほど残像対策で簡易化する」しきい値を踏襲。
const SIMPLE_THRESHOLD = 7;

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
  const season = seasonOf(g.month);
  const palette = BASE_VIEW_SEASON_PALETTE[season];
  const snow = !!palette.snow;
  const { pathW, pathL, cornerR } = BASE_VIEW_LOOP;

  const roster = (g.roster || []).slice(0, 12);
  const simple = roster.length > SIMPLE_THRESHOLD;
  const riderRows = roster.map(r => {
    const { w, l } = riderLoopPoint(r.id, elapsed, RIDER_SPEED, pathW, pathL, cornerR);
    const wob = riderWander(r.id, 7, elapsed, 0.5) * 0.10;
    const p = isoProject(w, l + wob, 0, PROJ);
    return {
      kind: "rider", r, x: p.x, y: p.y, sortY: p.y,
      cap: CAP_COLORS[Math.floor(riderHash01(r.id, 17) * CAP_COLORS.length) % CAP_COLORS.length],
      color: (TYPES[r.type] && TYPES[r.type].color) || C.yellow,
    };
  });
  const buildingRows = BASE_VIEW_BUILDINGS.map(b => {
    const pts = [
      isoProject(b.w - b.hw, b.l, 0, PROJ), isoProject(b.w, b.l + b.hl, 0, PROJ),
      isoProject(b.w + b.hw, b.l, 0, PROJ), isoProject(b.w, b.l - b.hl, 0, PROJ),
    ];
    return { kind: "building", b, level: levels[b.levelKey], sortY: Math.max(...pts.map(p => p.y)) };
  });
  const propRows = propItems(PROJ, BASE_VIEW_PROPS, palette).map(item => ({ kind: "prop", ...item }));
  const drawOrder = [...buildingRows, ...propRows, ...riderRows].sort((a, b) => a.sortY - b.sortY);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", aspectRatio: `${W} / ${H}`, borderRadius: 10, display: "block", background: palette.sky }}>
        <Ground proj={PROJ} ground={BASE_VIEW_GROUND} loop={BASE_VIEW_LOOP} palette={palette} />
        <Track proj={PROJ} loop={BASE_VIEW_LOOP} />
        {drawOrder.map((item, i) => {
          if (item.kind === "building") return <IsoBuilding key={`b${item.b.key}`} b={item.b} level={item.level} snow={snow} proj={PROJ} />;
          if (item.kind === "prop") return <React.Fragment key={`p${i}`}>{item.node}</React.Fragment>;
          return <IsoRider key={`r${item.r.id}`} x={item.x} y={item.y} color={item.color} cap={item.cap} isPlayer={false} isAce={false} surging={false} simple={simple} />;
        })}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 10, color: C.sub, marginTop: 4, fontFamily: FONT_M }}>
        {BASE_VIEW_BUILDINGS.map(b => (
          <span key={b.key}>{b.icon} {b.label} Lv{levels[b.levelKey]}</span>
        ))}
      </div>
    </div>
  );
}
