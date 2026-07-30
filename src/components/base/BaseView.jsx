// カイロソフト式敷地画面（BaseView）。Step13第3弾で新設 → Wave D（磨き込み）
// → Wave D2（カイロソフト準拠の再設計）→ Wave E（カメラ＋カットアウト部屋）。
// FinalSprintCinematic（components/RaceView.jsx）の2:1ディメトリック投影・IsoRider・
// riderWander・30fps間引きrAFループを流用した、固定カメラ・周回路の「常設の拠点」表示。
// ゲーム状態（月・育成・資金）には一切触れない環境演出専用コンポーネント（月は季節演出の
// 参照にのみ使う＝時間経過そのものはメニュー操作でのみ進む設計を崩さない）。
//
// Wave E-2 redo（ユーザーの手描きスケッチの再確認に基づく・詳細はDEVLOG §11）：
// 当初「5棟の小さな建物」として実装したが、スケッチは「敷地全体を屋外(コース)/屋内
// (クラブハウス)の2つに大きく割り、屋内は単一の大部屋で、その中にトレーニング・
// メカニック・メディカル・スカウトの持ち場（机など）が点在する」という構図だった。
// クラブハウス（Room、単一の大部屋）＋4つの持ち場（Station）へ作り直した。
// 持ち場をタップすると対応するメニューセクションが、部屋の何もない床をタップすると
// メニュー全体（大ジャンル一覧）が開く（onRoomTap経由。当たり判定は持ち場を優先し、
// 外れたら部屋全体のfloorへフォールバックする）。
import React, { useEffect, useRef, useState } from "react";
import { C, FONT_M } from "../../data/theme.js";
import {
  BASE_VIEW_PROJ, BASE_VIEW_CLUBHOUSE, BASE_VIEW_STATIONS, BASE_VIEW_LOOP,
  BASE_VIEW_PLAZA, BASE_VIEW_GROUND, BASE_VIEW_SEASON_PALETTE, BASE_VIEW_PROPS,
} from "../../data/baseViewBuildings.js";
import {
  isoProject, riderLoopPoint, riderFacesLeft, buildingLevels, seasonOf,
  pointInQuad, roomFloorQuad, stationQuad,
} from "../../domain/season/baseViewLayout.js";
import { sceneContentBounds } from "../../domain/season/camera.js";
import { useIsoCamera } from "../../hooks/useIsoCamera.js";
import { IsoRider, CAP_COLORS, riderWander } from "../RaceView.jsx";
import { riderHash01 } from "../../sim/race.js";
import { Room } from "./Room.jsx";
import { Station } from "./Station.jsx";
import { Track } from "./Track.jsx";
import { Ground } from "./Ground.jsx";
import { propItems } from "./Props.jsx";
import { TYPES } from "../../data/abilities.js";

const PROJ = BASE_VIEW_PROJ;
const RIDER_SPEED = 0.035; // 周回速度（t/秒）
// 選手が7名を超えたら簡易スプライト（IsoRiderのsimple版）に切り替える。
// FinalSprintCinematicが確立した「大人数ほど残像対策で簡易化する」しきい値を踏襲。
const SIMPLE_THRESHOLD = 7;
const STATION_HIT_SIZE = 0.85; // 持ち場タップの当たり判定の半径（world単位）

// paused=true（メニュー展開中）の間はelapsed秒数の加算そのものを止める。rAFの再開時に
// 経過時間がジャンプしない（＝一時停止中は本当に世界が止まって見える）よう、加算量を
// requestAnimationFrameのタイムスタンプ差分で管理する。
function useElapsedSeconds(paused) {
  const [, setTick] = useState(0);
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

// 描画物が占めるscene座標の範囲。レイアウトは静的なので一度だけ求めればよい。
const SCENE_BOUNDS = sceneContentBounds({
  proj: BASE_VIEW_PROJ, plaza: BASE_VIEW_PLAZA, loop: BASE_VIEW_LOOP,
  buildings: [BASE_VIEW_CLUBHOUSE], props: BASE_VIEW_PROPS,
});

// SVGの描画領域の実ピクセルサイズを追う。viewBoxをこれと一致させることで
// 1 SVG単位=1CSSピクセルになり、preserveAspectRatioによる切り落としも歪みも起きなくなる
// （カメラのズーム/パンが拡縮を全て担うため、slice/meetに頼る必要がなくなった）。
function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: Math.max(0, Math.round(r.width)), h: Math.max(0, Math.round(r.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

// タップ当たり判定用の四角形。持ち場（小さい・優先）→部屋全体の床（大きい・フォールバック）の順。
const STATION_QUADS = BASE_VIEW_STATIONS.map(s => ({ key: s.key, quad: stationQuad(s, STATION_HIT_SIZE, BASE_VIEW_PROJ) }));
const CLUBHOUSE_QUAD = roomFloorQuad(BASE_VIEW_CLUBHOUSE, BASE_VIEW_PROJ);

export function BaseView({ g, paused, onRoomTap }) {
  const elapsed = useElapsedSeconds(!!paused);
  const [viewRef, view] = useElementSize();
  const [tappedKey, setTappedKey] = useState(null);
  const handleTap = (scenePt) => {
    const hitStation = STATION_QUADS.find(s => pointInQuad(scenePt, s.quad));
    const key = hitStation ? hitStation.key : (pointInQuad(scenePt, CLUBHOUSE_QUAD) ? "clubhouse" : null);
    if (!key) return;
    setTappedKey(key);
    onRoomTap && onRoomTap(key);
  };
  const camera = useIsoCamera({ bounds: SCENE_BOUNDS, viewW: view.w, viewH: view.h, onTap: handleTap });
  const levels = buildingLevels(g);
  const palette = BASE_VIEW_SEASON_PALETTE[seasonOf(g.month)];
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
      flip: riderFacesLeft(r.id, elapsed, RIDER_SPEED, pathW, pathL, cornerR, PROJ),
      cap: CAP_COLORS[Math.floor(riderHash01(r.id, 17) * CAP_COLORS.length) % CAP_COLORS.length],
      color: (TYPES[r.type] && TYPES[r.type].color) || C.yellow,
    };
  });
  // クラブハウス（床+壁）と持ち場（什器）は1つの描画ユニットとしてまとめる。
  // 什器は必ず部屋の床の「上」に乗る関係にあるが、それぞれ独立にsortYで奥行きソートすると
  // 部屋自体のsortY（footprintの最前面＝部屋の外周のうち最もカメラに近い点）が、内側に
  // マージンを取って置かれた什器のsortYより大きくなりがちで、不透明な床ポリゴンが後から
  // 描かれて什器を覆い隠してしまう（実機確認で発覚。什器がほぼ透けて見えない不具合）。
  // 部屋＋全持ち場を1つのdrawOrderエントリにまとめ、内部では必ず「床→什器」の順で描くことで
  // 解消する（他の要素＝小物・選手との奥行き比較には部屋のsortYをそのまま使う）。
  const clubhouseRow = { kind: "clubhouse", sortY: Math.max(...CLUBHOUSE_QUAD.map(p => p.y)) };
  const propRows = propItems(PROJ, BASE_VIEW_PROPS, palette).map(item => ({ kind: "prop", ...item }));
  const drawOrder = [clubhouseRow, ...propRows, ...riderRows].sort((a, b) => a.sortY - b.sortY);

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div ref={viewRef} style={{ position: "relative", flex: 1, minHeight: 260, borderRadius: 10, overflow: "hidden" }}>
        <svg viewBox={`0 0 ${view.w} ${view.h}`} width={view.w} height={view.h}
          style={{ display: "block", touchAction: "none", cursor: "grab" }} {...camera.handlers}>
          {/* 芝の下地はカメラ変換の外側。どこまで引いても必ずビューポートを埋める */}
          <rect x="0" y="0" width={view.w} height={view.h} fill={palette.grass} />
          {camera.ready && (
            <g transform={camera.transform}>
              <Ground proj={PROJ} ground={BASE_VIEW_GROUND} plaza={BASE_VIEW_PLAZA} loop={BASE_VIEW_LOOP} palette={palette} bounds={SCENE_BOUNDS} />
              <Track proj={PROJ} loop={BASE_VIEW_LOOP} />
              {drawOrder.map((item, i) => {
                if (item.kind === "clubhouse") return (
                  <g key="clubhouse">
                    <Room b={BASE_VIEW_CLUBHOUSE} snow={snow} proj={PROJ} selected={tappedKey === "clubhouse"} />
                    {BASE_VIEW_STATIONS.map(s => <Station key={s.key} s={s} proj={PROJ} selected={tappedKey === s.key} />)}
                  </g>
                );
                if (item.kind === "prop") return <React.Fragment key={`p${i}`}>{item.node}</React.Fragment>;
                // 左へ進むときは x=item.x の垂直線でスプライトを鏡像反転する
                const sprite = <IsoRider x={item.x} y={item.y} color={item.color} cap={item.cap} isPlayer={false} isAce={false} surging={false} simple={simple} />;
                return item.flip
                  ? <g key={`r${item.r.id}`} transform={`translate(${(2 * item.x).toFixed(1)},0) scale(-1,1)`}>{sprite}</g>
                  : <React.Fragment key={`r${item.r.id}`}>{sprite}</React.Fragment>;
              })}
            </g>
          )}
        </svg>
        {/* ズーム操作ボタン（ピンチ/ホイールが使えない環境向けの代替） */}
        <div style={{ position: "absolute", left: 8, bottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {[["＋", 1.35], ["－", 1 / 1.35]].map(([lbl, mul]) => (
            <button key={lbl} onClick={() => camera.zoomBy(mul)} aria-label={lbl === "＋" ? "ズームイン" : "ズームアウト"}
              style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.line}`, background: "rgba(20,23,29,0.72)", color: C.text, fontSize: 16, lineHeight: 1, cursor: "pointer" }}>{lbl}</button>
          ))}
          <button onClick={camera.reset} aria-label="表示をリセット"
            style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.line}`, background: "rgba(20,23,29,0.72)", color: C.text, fontSize: 13, lineHeight: 1, cursor: "pointer" }}>⌂</button>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 10, color: C.sub, marginTop: 4, fontFamily: FONT_M, flexShrink: 0 }}>
        <span>{BASE_VIEW_CLUBHOUSE.icon} {BASE_VIEW_CLUBHOUSE.label} Lv{levels.clubhouse}</span>
        {BASE_VIEW_STATIONS.map(s => (
          <span key={s.key}>{s.icon} {s.label} Lv{levels[s.levelKey]}</span>
        ))}
      </div>
    </div>
  );
}
