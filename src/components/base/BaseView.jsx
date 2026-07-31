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
  BASE_VIEW_GROUNDS_DECOR, BASE_VIEW_ROOMS, BASE_VIEW_PARTITIONS, BASE_VIEW_PARTITION_HEIGHT,
  BASE_VIEW_EMPTY_ROOMS, BASE_VIEW_FIXTURES, BASE_VIEW_STAFF,
} from "../../data/baseViewBuildings.js";
import {
  isoProject, buildingLevels, seasonOf,
  pointInQuad, roomFloorQuad, stationQuad,
} from "../../domain/season/baseViewLayout.js";
import {
  riderActivityAt, activityFacesLeft, activityDir, activityWobble, isIndoors, routeToStation, workSpotFor,
} from "../../domain/season/riderActivity.js";
import { sceneContentBounds } from "../../domain/season/camera.js";
import { useIsoCamera } from "../../hooks/useIsoCamera.js";
import { CAP_COLORS } from "../sprites/IsoRider.jsx";
import { PixelBike } from "../sprites/pixelBike.jsx";
import { riderHash01 } from "../../sim/race.js";
import { Room } from "./Room.jsx";
import { Station } from "./Station.jsx";
import { Track } from "./Track.jsx";
import { Ground } from "./Ground.jsx";
import { propItems } from "./Props.jsx";
import { fixtureItems } from "./Fixtures.jsx";
import { PixelPerson } from "../sprites/pixelPerson.jsx";
import { TYPES } from "../../data/abilities.js";

const PROJ = BASE_VIEW_PROJ;
const RIDER_SPEED = 0.035; // 周回速度（t/秒）
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
// 屋外装飾(BASE_VIEW_GROUNDS_DECOR)は未解禁のものも含めて全件を境界計算に含める
// （解禁状況でカメラのfit/cover倍率がガタつかないようにするため。実際に描くかどうかは
// 後述のunlockedDecorでg.equip.groundsに応じてフィルタする）。
const SCENE_BOUNDS = sceneContentBounds({
  proj: BASE_VIEW_PROJ, land: BASE_VIEW_GROUND, plaza: BASE_VIEW_PLAZA, loop: BASE_VIEW_LOOP,
  buildings: [BASE_VIEW_CLUBHOUSE], props: { ...BASE_VIEW_PROPS, groundsDecor: BASE_VIEW_GROUNDS_DECOR },
});
// 敷地（陸地）の外形。BASE_VIEW_GROUNDのworld矩形をそのまま「所有敷地」の輪郭として使う
// （芝の装飾もこの範囲に散らしているため、境界を揃えると自然に一致する）。
const LAND_QUAD_WORLD = [
  { w: BASE_VIEW_GROUND.wMin, l: BASE_VIEW_GROUND.lMin }, { w: BASE_VIEW_GROUND.wMin, l: BASE_VIEW_GROUND.lMax },
  { w: BASE_VIEW_GROUND.wMax, l: BASE_VIEW_GROUND.lMax }, { w: BASE_VIEW_GROUND.wMax, l: BASE_VIEW_GROUND.lMin },
];

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
// Wave F-2 redo: 空き部屋はSTATION_QUADSに含めない＝タップ判定は従来通り床全体(clubhouse)
// へフォールバックする（機能が無い部屋なので専用の遷移先を持たない）。

// Wave F-3a: 選手の行動（周回⇔屋内の往復）を解くための静的な文脈。レイアウトは不変なので
// モジュール読み込み時に一度だけ組み立てる。歩行ルートは壁データ(BASE_VIEW_PARTITIONS)の
// 「壁が無い区間」＝扉から機械的に導出されるため、壁を通り抜ける経路が発生しない。
const ACTIVITY_CTX = (() => {
  const base = {
    loop: BASE_VIEW_LOOP,
    rack: BASE_VIEW_PROPS.bikeRack,
    speed: RIDER_SPEED,
    clubhouse: BASE_VIEW_CLUBHOUSE,
    corridor: BASE_VIEW_ROOMS.find(r => r.key === "corridor"),
    rooms: BASE_VIEW_ROOMS,
    partitions: BASE_VIEW_PARTITIONS,
    stations: BASE_VIEW_STATIONS,
    clutter: BASE_VIEW_FIXTURES,
  };
  const roomKeys = BASE_VIEW_STATIONS.map(s => s.room);
  const routes = {}, poses = {};
  for (const k of roomKeys) {
    routes[k] = routeToStation(base, k);
    poses[k] = workSpotFor(k, BASE_VIEW_STATIONS.find(s => s.room === k), BASE_VIEW_FIXTURES).pose;
  }
  return { ...base, roomKeys, routes, poses };
})();

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

  const roster = (g.roster || []).slice(0, 12);
  // Wave F-3a: 選手ごとの「今なにをしているか」を時刻の純関数として解く
  // （周回／コース⇔ラックの移動／徒歩での往復／持ち場での作業）。
  const riderRows = roster.map(r => {
    const act = riderActivityAt(r, elapsed, ACTIVITY_CTX);
    // 周回中だけ左右のゆらぎを加える（歩行中は経路上をまっすぐ進ませる）。
    // activityFacesLeft/activityDirの向き判定も同じactivityWobbleを使っており、
    // 実際の描画位置と向き判定がズレないようにしてある（Wave G-1改で発覚したバグの修正）。
    const wob = activityWobble(r, act, elapsed);
    const p = isoProject(act.w, act.l + wob, 0, PROJ);
    return {
      kind: "rider", r, act, x: p.x, y: p.y, sortY: p.y,
      indoors: isIndoors(act.w, act.l, BASE_VIEW_CLUBHOUSE),
      flip: activityFacesLeft(r, elapsed, ACTIVITY_CTX, PROJ),
      dir: activityDir(r, elapsed, ACTIVITY_CTX, PROJ),
      cap: CAP_COLORS[Math.floor(riderHash01(r.id, 17) * CAP_COLORS.length) % CAP_COLORS.length],
      color: (TYPES[r.type] && TYPES[r.type].color) || C.yellow,
      phase: riderHash01(r.id, 91) * 4, // 歩調・ペダリングが全員で揃わないようずらす
      // 立ち漕ぎ：選手ごとに違う周期で断続的に立つ（決定論的・Math.random不使用）
      dancing: act.pose === "ride"
        && Math.sin(elapsed * (0.24 + riderHash01(r.id, 37) * 0.12) + riderHash01(r.id, 61) * 6.28) > 0.72,
    };
  });
  // 屋内の人物は不透明な床・什器の後に描かないと埋もれるため、クラブハウスのatomicな
  // 描画グループへ入れる（Wave E-2で実際に踏んだ罠）。屋外の人物は通常どおり奥行きソート。
  const outdoorRiders = riderRows.filter(x => !x.indoors);
  const indoorRiders = riderRows.filter(x => x.indoors);
  // Wave F-3c: 雇っているスタッフは持ち場に常駐する（動かない人）。
  const staffRows = BASE_VIEW_STAFF
    .filter(s => (g.staff && g.staff[s.staffKey]) > 0)
    .map(s => {
      const p = isoProject(s.w, s.l, 0, PROJ);
      return { ...s, x: p.x, y: p.y, sortY: p.y };
    });
  const indoorPeople = [...indoorRiders, ...staffRows].sort((a, b) => a.sortY - b.sortY);
  // クラブハウス（床+壁）と持ち場（什器）は1つの描画ユニットとしてまとめる。
  // 什器は必ず部屋の床の「上」に乗る関係にあるが、それぞれ独立にsortYで奥行きソートすると
  // 部屋自体のsortY（footprintの最前面＝部屋の外周のうち最もカメラに近い点）が、内側に
  // マージンを取って置かれた什器のsortYより大きくなりがちで、不透明な床ポリゴンが後から
  // 描かれて什器を覆い隠してしまう（実機確認で発覚。什器がほぼ透けて見えない不具合）。
  // 部屋＋全持ち場を1つのdrawOrderエントリにまとめ、内部では必ず「床→什器」の順で描くことで
  // 解消する（他の要素＝小物・選手との奥行き比較には部屋のsortYをそのまま使う）。
  const clubhouseRow = { kind: "clubhouse", sortY: Math.max(...CLUBHOUSE_QUAD.map(p => p.y)) };
  // Wave F-1: 施設ショップの「敷地整備」(g.equip.grounds、Lv0〜5)で段階的に解禁される
  // 屋外装飾。旧セーブに未存在のことがあるためstaff.scout等と同じ`|| 0`ガードを踏襲する。
  const groundsLv = g.equip.grounds || 0;
  const unlockedDecor = BASE_VIEW_GROUNDS_DECOR.filter(d => groundsLv >= d.minLevel);
  const propRows = propItems(PROJ, { ...BASE_VIEW_PROPS, groundsDecor: unlockedDecor }, palette).map(item => ({ kind: "prop", ...item }));
  const drawOrder = [clubhouseRow, ...propRows, ...outdoorRiders].sort((a, b) => a.sortY - b.sortY);
  const landQuad = LAND_QUAD_WORLD.map(p => isoProject(p.w, p.l, 0, PROJ));

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div ref={viewRef} style={{ position: "relative", flex: 1, minHeight: 260, borderRadius: 10, overflow: "hidden" }}>
        <svg viewBox={`0 0 ${view.w} ${view.h}`} width={view.w} height={view.h}
          style={{ display: "block", touchAction: "none", cursor: "grab" }} {...camera.handlers}>
          {/* Wave F-1: 下地はカメラ変換の外側＝海（palette.sky）。どこまで引いても必ず
              ビューポートを埋める。所有敷地（陸地）は緑の芝としてカメラ内側に別途描き、
              「敷地の外は海」で境界をはっきりさせる（ユーザー指摘：緑の範囲が広すぎる）。 */}
          <rect x="0" y="0" width={view.w} height={view.h} fill={palette.sky} />
          {camera.ready && (
            <g transform={camera.transform}>
              <polygon points={landQuad.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill={palette.grass} stroke={palette.plazaEdge} strokeWidth="1.5" opacity="0.9" />
              <Ground proj={PROJ} ground={BASE_VIEW_GROUND} plaza={BASE_VIEW_PLAZA} loop={BASE_VIEW_LOOP} palette={palette} bounds={SCENE_BOUNDS} />
              <Track proj={PROJ} loop={BASE_VIEW_LOOP} />
              {drawOrder.map((item, i) => {
                if (item.kind === "clubhouse") return (
                  <g key="clubhouse">
                    <Room b={BASE_VIEW_CLUBHOUSE} snow={snow} proj={PROJ} selected={tappedKey === "clubhouse"}
                      rooms={BASE_VIEW_ROOMS} partitions={BASE_VIEW_PARTITIONS} partitionHeight={BASE_VIEW_PARTITION_HEIGHT} />
                    {BASE_VIEW_STATIONS.map(s => <Station key={s.key} s={s} proj={PROJ} selected={tappedKey === s.key} />)}
                    {BASE_VIEW_EMPTY_ROOMS.map(s => <Station key={s.key} s={s} proj={PROJ} selected={false} />)}
                    {fixtureItems(PROJ, BASE_VIEW_FIXTURES.filter(f => (f.minLevel ?? 0) <= (levels[f.room] ?? Infinity)))}
                    {/* 屋内の人物（選手＋常駐スタッフ）は必ず床・壁・什器より後に描く */}
                    {indoorPeople.map(pn => (
                      <PixelPerson key={pn.r ? `ir${pn.r.id}` : `st${pn.key}`} x={pn.x} y={pn.y}
                        pose={pn.r ? pn.act.pose : "stand"} t={elapsed}
                        color={pn.color} cap={pn.cap} flip={pn.flip} phase={pn.phase || 0} />
                    ))}
                  </g>
                );
                if (item.kind === "prop") return <React.Fragment key={`p${i}`}>{item.node}</React.Fragment>;
                // 自転車に乗っていない選手（ラック〜玄関の屋外を歩く）は人型で描く
                if (item.act.pose !== "ride") {
                  return <PixelPerson key={`r${item.r.id}`} x={item.x} y={item.y} pose={item.act.pose} t={elapsed}
                    color={item.color} cap={item.cap} flip={item.flip} phase={item.phase} />;
                }
                // Wave F-3b: 練習中は通常姿勢。一部の選手が周期的に立ち漕ぎ（ダンシング）を
                // 見せて単調さを消す。判定は決定論的（riderHash01と経過時間のみ）。
                // Wave G-1改：PixelBikeは自前でflip(左右反転)を持つため、旧IsoRiderのような
                // 外側からのtranslate+scale(-1,1)ラップは不要。
                return <PixelBike key={`r${item.r.id}`} x={item.x} y={item.y} color={item.color}
                  posture={item.dancing ? "dancing" : "normal"} dir={item.dir} flip={item.flip}
                  t={elapsed} phase={item.phase} />;
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
        <span>🌳 敷地整備 Lv{groundsLv}</span>
      </div>
    </div>
  );
}
