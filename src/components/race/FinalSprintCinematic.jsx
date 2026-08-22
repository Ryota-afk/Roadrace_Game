// 最終直線シネマティック演出（RaceView.jsxから分離。第14弾D）。
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FONT_DOT, T } from "../../data/theme.js";
import { riderHash01 } from "../../sim/race.js";
import { viewHash01 } from "../../domain/shared/viewHash.js";
import { PixelBikeUse } from "../sprites/pixelBike.jsx";
import { pickDancerIds, sprintPosture } from "../../domain/shared/sprintPosture.js";
import { easeOutCubic } from "./raceViewConstants.js";

// v39.7: バンプ関数（x=0で0、x=Wbで最大1、その先は減衰）。ごぼう抜き/リードアウトの一過性の前後移動に使う。
function sprintBump(x, Wb) { return x > 0 ? (x / Wb) * Math.exp(1 - x / Wb) : 0; }

// v45: ユーザー指摘「星マーカーと水色の丸が選手の顔と被る」への対応。従来は最終スプリント
// 演出のみ★（エース）と水色の丸（自分）を顔の高さに直接重ねていたため、密集時に顔にも
// お互いにも被って読みづらかった。俯瞰マップの名前ラベルとスタイルを統一し、選手の頭上
// 斜めへ短い引き出し線を伸ばした先に名前タグを置く方式へ変更（添付いただいた手描き案の
// 「本体から線を引き出し、離れた場所に名前を置く」という考え方を両画面に共通導入）。
// 対象は自分・エース・自チーム（isMyTeam）のみ（全選手に付けると密集時にごちゃつくため、
// それ以外は既存の色スウォッチ付き順位表／マップ名簿で識別する）。
function riderTagKind(r) {
  if (r.isPlayer && r.isAce) return "selfAce";
  if (r.isPlayer) return "self";
  if (r.isAce) return "ace";
  if (r.isMyTeam) return "mate";
  return null;
}
// 自分＝水色／エース＝黄色／自チーム＝青、という既存の配色（俯瞰マップの凡例・マーカー色）を
// そのまま踏襲。自分がエースを兼ねる場合は「水色地に黄色い縁取り」で両方を一つのタグに表す。
// rival/legend/otherは俯瞰マップ側（先頭選手・ライバル・殿堂選手）で使う
// （演出側は自分/エース/自チームのみ）。legendはユーザー呼称「転生ライバル」＝殿堂選手
// （引退後に衰えて後年に再登場する歴代選手）。ライバルと紛らわしくないよう同じ赤系だが
// 別トーン＋🏛アイコンで区別する。
const RIDER_TAG_STYLE = {
  selfAce: { fill: "#27d3ff", border: "#ffd23c", text: "#0c2430" },
  self: { fill: "#0E0E10", border: "#27d3ff", text: "#27d3ff" },
  ace: { fill: "#0E0E10", border: "#ffd23c", text: "#ffd23c" },
  mate: { fill: "#0E0E10", border: "#7db8ff", text: "#7db8ff" },
  rival: { fill: "#0E0E10", border: "#ff6b6b", text: "#ff6b6b" },
  legend: { fill: "#0E0E10", border: "#e0637a", text: "#e0637a" },
  other: { fill: "#0E0E10", border: "#8a8f98", text: "#eef0f5" },
};
// 俯瞰マップの名前ラベル用（先頭3名・ライバル・殿堂選手も対象に含む点が演出側と異なる）。
export function mapTagKind(r) {
  if (r.isPlayer && r.isAce) return "selfAce";
  if (r.isPlayer) return "self";
  if (r.isRival) return "rival";
  if (r.isLegend) return "legend";
  if (r.isMyTeam && r.isAce) return "ace";
  if (r.isMyTeam) return "mate";
  return "other";
}
// タグ内の名前に添える小アイコン（自分=🚴／ライバル=🔥／殿堂選手=🏛／自チームエース=★）。
export function riderTagIcon(kind) {
  return kind === "self" || kind === "selfAce" ? "🚴" : kind === "rival" ? "🔥" : kind === "legend" ? "🏛" : kind === "ace" ? "★" : "";
}
// x,y: 選手本体の基準点。dx,dy: タグの中心をどれだけずらすか（斜め上方向を想定）。
// scaleでキャンバスのサイズ差（演出=340幅／マップ=660幅）を吸収する。
export function RiderNameTag({ x, y, dx, dy, kind, label, scale = 1 }) {
  const style = RIDER_TAG_STYLE[kind];
  if (!style) return null;
  const lx = x + dx, ly = y + dy;
  const w = (label.length * 6.6 + 10) * scale, h = 11.5 * scale;
  return (
    <g style={{ pointerEvents: "none" }}>
      <line x1={x} y1={y} x2={lx} y2={ly} stroke={style.border} strokeWidth={1.1 * scale} opacity="0.8" />
      <rect x={lx - w / 2} y={ly - h / 2} width={w} height={h} rx={h / 2} fill={style.fill} stroke={style.border} strokeWidth={1.1 * scale} />
      <text x={lx} y={ly + 3.1 * scale} textAnchor="middle" fontSize={7.6 * scale} fontWeight="700" fill={style.text}>{label}</text>
    </g>
  );
}

export function FinalSprintCinematic({ contenders }) {
  const [now, setNow] = useState(() => performance.now());
  const startRef = useRef(performance.now());
  const camRef = useRef(null); // v39.6: 追走カメラの平滑化用（先頭交代時のカメラ移動をなめらかに）
  const dancerIds = useMemo(() => pickDancerIds(contenders), [contenders]);
  // v39.14(残像対策): 毎フレーム全選手のSVG（1人あたり十数ノード）を再構築すると端末によっては
  // 描画が追いつかず残像・尾を引いて見える。約30fpsに間引いて1フレームあたりの再構築量を半減させる。
  useEffect(() => {
    let raf, last = 0;
    const loop = (t) => {
      if (t - last >= 32) { last = t; setNow(performance.now()); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  // v39.8(演出刷新): カイロソフト風のディメトリック(2:1アイソメ)視点。タイル状の地面が斜めに広がり、
  // 立ったキャラ(スプライト)が道を進む。カメラは先頭を画面中央に捉えて地面ごとスクロール（＝速度感）。
  // 各選手の kick で「後方から差す/先行して垂れる/独走」を、laneで集団内の位置取りを見せる。遠近拡縮なし。
  const W = 340, H = 178;
  const cx0 = W * 0.44, cy0 = H * 0.42;
  const Px = 30, Py = 15, Lx = 27, Ly = -14;        // アイソメの2軸（進行=右下、レーン=右上）。大きめ＝画面上の間隔を広げ密集を緩和
  const roadHL = 1.35, laneStep = 0.6;              // 道の半幅（レーン単位）／地面タイル1枚のレーン幅
  const n = contenders.length;
  const maxGap = Math.max(0.6, ...contenders.map(c => c.gapSec));
  const bunch = n >= 10;
  const close = maxGap <= 3.2;
  const soloWin = n >= 2 && contenders[1].gapSec >= 4;  // 逃げ切り/独走（2位まで4秒以上）
  const spanGap = Math.min(maxGap, 16);
  // v39.9: 着差(秒)を道沿い距離へ圧縮＝「長い一列」でなく前後に締まった団子に。横（レーン）は道幅いっぱいに
  // 散らして重なりを解消。もっと手前(vtStart)から長め(t1)に見せて駆け引き（差し/リードアウト/独走）を強調。
  // v39.13: 大人数(nが多い)ほど前後にも散らして塊が潰れて重なる（＝残像に見える）のを防ぐ。
  const COMPRESS = n >= 14 ? 0.62 : 0.45;
  // v39.16(スピード感): 従来は接近フェーズの移動距離が3.6ユニットしかなく、カメラが先頭を追う＝地面が
  // ほとんど流れずスピード感が皆無だった。開始地点を大きく手前に取り、同じ時間で長距離を走らせる＝
  // 地面・沿道が高速で流れる。さらに常にease-out（序盤ほど高速→ラインに向けて減速）にして、
  // 「速い→スロー＆ズーム」の落差でゴール前を引き立てる。
  // v39.17: ゴール前のやりとり（差し・リードアウト・抜きつ抜かれつ）を見せる時間を確保するため接近を
  // 長く取り、同時に距離も伸ばしてスピード感を維持する（時間だけ延ばすと遅く見えてしまうため）。
  // v44: ユーザー指摘「ゴールスプリントの時間を長くして」。時間だけ延ばすと速度感が失われるため、
  // 接近距離(vtStart)・退出距離(exitVtの加算分)も同じ倍率でスケールし、速度プロファイルは
  // 維持したまま尺だけ約1.4倍に延ばした（＝仕掛け合い・ダンシング姿勢を見せる時間も比例して延びる）。
  const CINE_STRETCH = 1.4;
  const vtStart = -26 * CINE_STRETCH;
  const vtCross = 0.05;                             // v39.13: 先頭がライン（前輪）を通過する瞬間をスローの底に
  const exitVt = spanGap * COMPRESS + 6.5 * CINE_STRETCH;
  const t1 = (close ? 6.2 : 5.2) * CINE_STRETCH, t2 = 1.9 * CINE_STRETCH;
  const el = (now - startRef.current) / 1000;
  let vt, approaching;
  if (el <= t1) {
    const u = el / t1;
    const eased = close ? easeOutCubic(u) : 1 - Math.pow(1 - u, 2.2); // 接戦ほど強く減速して"ゴールの瞬間"を溜める
    vt = vtStart + (vtCross - vtStart) * eased; approaching = true;
  }
  else { const u = Math.min(1, (el - t1) / t2); vt = vtCross + (exitVt - vtCross) * u; approaching = false; }
  const fade = Math.max(0, 1 - el * 3.2);
  // v44: ユーザー指摘「ゴール前でスローになるのに選手の動き（ペダリング）はスローに
  // なっていない」。従来はPixelBikeUseへ実経過秒(el)をそのまま渡していたため、カメラ・
  // 選手の位置(vt)がイーズアウトで減速しても脚の回転だけは常に実時間ペースで回り続けて
  // いた。ペダル回転は本来「進んだ距離」に比例するもの（車輪と同じ）なので、実時間ではなく
  // vtの進み具合からペダル用の仮想時間を作る。これによりスロー区間では脚も自然に遅くなり、
  // 演出が完全に静止した後（vtが固定された後）は脚も静止する。
  // PEDAL_Kは「最も速い瞬間（接近開始直後）」でおおよそ従来の実時間ケイデンスに一致するよう
  // 較正した値（イーズアウト曲線の初速×PEDAL_K≒1）。
  const PEDAL_K = 0.085;
  const pedalT = (vt - vtStart) * PEDAL_K;
  // 各選手の道沿い位置 w（大＝前方/ゴール通過側）と lane（道幅内の位置）。ゴールは w=0。
  const gEff = (c) => c.gapSec * COMPRESS;
  // v46(#28修正): 従来は末尾に (riderHash01(c.id,23)-0.5)*1.05 という前後方向の固定ジッターを
  // 加えており、実際の着差(0.42秒でもgEff差0.19)より大きいランダム値が順位を表す軸に乗っていた
  // （実測：描画順が着順と食い違うレースが80%、最大4着ぶんのズレ）。重なりのほぐしはlaneOf側
  // （横方向の散らし）が既に担っているため、前後方向のジッターは削除した。
  const wOf = (c) => (vt - gEff(c)) - (c.kick || 0) * 1.5 * sprintBump(gEff(c) - vt, 1.9);
  const laneOf = (c) => {
    const rem = gEff(c) - vt;
    // v46(#32修正): riderHash01は一次式に退化しており(salt+1で必ず+0.62012、id+1で必ず+0.35761
    // だけ一定シフト)、これが道幅内位置に「楕円軌道」状の規則的なジッターとして現れていた。
    // 着順計算に使うsim側のriderHash01は変更できないため、演出専用のviewHash01に差し替える。
    const base = (viewHash01(c.id, 3) - 0.5) * 2.4; // 道幅いっぱいに散らばる（＝横並びの団子に）
    const conv = 0.82 + 0.18 * Math.max(0, Math.min(1, rem / 3.0)); // 収束はさらに控えめ（潰れて一列にしない）
    const weave = Math.sin(vt * 2.1 + viewHash01(c.id, 9) * 7) * 0.08;
    const passLat = Math.sign(c.kick || 0) * sprintBump(rem, 2.2) * 0.36; // 差し/リードアウトは横へ膨らんで抜く
    return Math.max(-1.25, Math.min(1.25, base * conv + weave + passLat));
  };
  const withW = contenders.map(c => ({ c, w: wOf(c) }));
  // v45.2: 従来は「まだ0.12を通過していない候補の中の最先頭」を追走し、勝者通過後はゴール(0)に
  // 固定、という2分岐だった。追走対象の候補プールが毎フレーム0.12の境界で入れ替わるため、
  // 直前まで追っていた選手がそのラインを越えて候補から外れた瞬間、カメラの目標が後方の選手へ
  // 引き戻されてガクつく（ユーザー指摘の原因）。常に「最も進んでいる選手」を素直に追い、
  // ゴール(w=0)より先へは進ませないようclampするだけにすると、追走対象の入れ替わりも
  // 目標値のジャンプも起きず、連続的にゴールで頭打ちになる。
  const leaderW = Math.max(...withW.map(o => o.w));
  let camWTarget = Math.min(leaderW, 0);
  // v39.19(演出): 導入。最初はゴール手前の路面を映しておき、集団が画面奥（左上）から入ってくるのを
  // 見せてから先頭にフォーカスを移す＝「いきなり選手が現れる」違和感を解消する。
  const introT = 1.5;
  const introBlend = Math.max(0, Math.min(1, el / introT));
  camWTarget = camWTarget + (1 - introBlend) * 6.0;        // 開始時はカメラが先頭の6ユニット前方＝選手は画面外
  if (camRef.current == null) camRef.current = camWTarget;
  camRef.current += (camWTarget - camRef.current) * 0.12;  // カメラ移動を滑らかに
  const camW = camRef.current;
  const S = (w, l) => ({ x: cx0 + (w - camW) * Px + l * Lx, y: cy0 + (w - camW) * Py + l * Ly });
  // 地面タイル（芝＋道）をアイソメの菱形で敷き、カメラで無限スクロールさせる
  const a0 = Math.floor(camW) - 9;
  const tiles = [];
  for (let a = a0; a < a0 + 20; a++) for (let b = -4; b <= 4; b++) {
    const lc = b * laneStep; const c0 = S(a, lc);
    if (c0.x < -45 || c0.x > W + 45 || c0.y < -45 || c0.y > H + 45) continue;
    tiles.push({ a, b, lc, road: Math.abs(lc) <= roadHL, c0 });
  }
  const diamond = (w, l, hw = 0.5, hl = laneStep / 2) => {
    const p1 = S(w - hw, l), p2 = S(w, l + hl), p3 = S(w + hw, l), p4 = S(w, l - hl);
    return `${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p3.x.toFixed(1)},${p3.y.toFixed(1)} ${p4.x.toFixed(1)},${p4.y.toFixed(1)}`;
  };
  // v45.3: diamond()は地面タイルのように(a,b)両方向へ敷き詰めて初めて隙間なく繋がる形状
  // （菱形の頂点同士でしか隣接しない）。ゴールラインはレーン方向にしか並べない1本の帯なので
  // 同じdiamond()を流用すると隣接セルが頂点1点でしか触れ合わず、「連続した線」ではなく
  // 「散らばった菱形」に見えていた（ユーザー指摘の原因）。帯は矩形の四隅をそのまま投影した
  // 平行四辺形セルを敷き詰めれば、隣接セルが辺全体で密着し連続した帯に見える。
  const finBand = (l, hl, hw = 0.4) => {
    const p1 = S(-hw, l - hl), p2 = S(-hw, l + hl), p3 = S(hw, l + hl), p4 = S(hw, l - hl);
    return `${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p3.x.toFixed(1)},${p3.y.toFixed(1)} ${p4.x.toFixed(1)},${p4.y.toFixed(1)}`;
  };
  const finLanes = [-2, -1, 0, 1, 2].map(b => b * laneStep).filter(l => Math.abs(l) <= roadHL + 0.01);
  const gBaseL = S(0, -(roadHL + 0.12)), gBaseR = S(0, roadHL + 0.12);
  const gTopL = { x: gBaseL.x, y: gBaseL.y - 30 }, gTopR = { x: gBaseR.x, y: gBaseR.y - 30 };
  // Wave H-4: capは廃止（旧IsoRiderのヘルメット色による個体識別）。ドット絵は帽子色の
  // スロットを持たないため、識別は下の順位表（判断④）に一本化した。
  // v43: 姿勢の決定は domain/shared/sprintPosture.js の純関数へ切り出した（詳細はそちら）。
  // v46(#13修正): 従来は参照位置(gEff(c)-vt)を渡していたが、これは描画位置w（ジッター・差し脚
  // バンプ込み）とズレるため、実際にはまだラインを過ぎ切っていない選手が姿勢だけ先に
  // normalへ戻ってしまっていた。姿勢は実際に描画する位置wから直接決める（w>0＝通過済みなので
  // -wが「残り」に相当）。
  const rows = withW.map(({ c, w }) => ({ c, ...S(w, laneOf(c)), posture: sprintPosture(-w, dancerIds.has(c.id)) }))
    .filter(r => r.x > -30 && r.x < W + 30 && r.y < H + 40 && r.y > -40)
    .sort((a, b) => (a.y - b.y) || (a.c.isPlayer ? 1 : -1)); // 奥(上)→手前(下)、自分は最前面
  // Wave H-4（判断④）: capによるヘルメット色での個体識別を廃止した代わりに、現在の
  // 並び順を名前付きでリアルタイム表示する。withW（画面外にいる選手も含む全員）を
  // wの降順（ゴールに近い順）で並べ、色スウォッチ＋名前で「どの色のジャージが誰か」を
  // 常に確認できるようにした。場所を取りすぎないよう上位6名＋自分の行（7位以下のときだけ）
  // に絞る。
  const standings = [...withW].sort((a, b) => b.w - a.w).map((o, i) => ({ ...o, rank: i + 1 }));
  const playerIdx = standings.findIndex(o => o.c.isPlayer);
  const standingsShown = (playerIdx >= 0 && playerIdx >= 6) ? [...standings.slice(0, 6), standings[playerIdx]] : standings.slice(0, 6);
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", aspectRatio: `${W} / ${H}`, borderRadius: 8, display: "block", background: "#2b3a30" }}>
        {/* 地面タイル */}
        {tiles.map(t => {
          const dark = (t.a + t.b) & 1;
          const fill = t.road ? (dark ? "#484d56" : "#50555e") : (dark ? "#33473a" : "#3a5040");
          return <polygon key={`t${t.a}_${t.b}`} points={diamond(t.a, t.lc)} fill={fill} stroke="#00000018" strokeWidth="0.5" />;
        })}
        {/* v39.16: 沿道の柵を0.5ユニット間隔に密度アップ＋色を交互に＝流れる速さが目で読み取れる */}
        {Array.from({ length: 34 }, (_, i) => a0 + i * 0.5).map((a, i) => {
          const l = S(a, -(roadHL + 0.3)), r = S(a, roadHL + 0.3);
          if (l.y < -20 || l.y > H + 20) return null;
          const col = i % 2 ? "#6d8471" : "#465a4c";
          return <g key={"fc" + i}><rect x={l.x - 1.1} y={l.y - 7} width="2.2" height="7" fill={col} /><rect x={r.x - 1.1} y={r.y - 7} width="2.2" height="7" fill={col} /></g>;
        })}
        {/* ゴール：路面の市松ライン＋門＋市松バナー */}
        {finLanes.map((l, i) => <polygon key={"fin" + i} points={finBand(l, laneStep / 2)} fill={i % 2 ? "#e9ecef" : "#0E0E10"} opacity="0.92" />)}
        <line x1={gBaseL.x} y1={gBaseL.y} x2={gTopL.x} y2={gTopL.y} stroke="#8a8f98" strokeWidth="2.4" />
        <line x1={gBaseR.x} y1={gBaseR.y} x2={gTopR.x} y2={gTopR.y} stroke="#8a8f98" strokeWidth="2.4" />
        {Array.from({ length: 11 }, (_, i) => {
          const t = i / 10, x = gTopL.x + (gTopR.x - gTopL.x) * t, y = gTopL.y + (gTopR.y - gTopL.y) * t;
          const bw = Math.abs(gTopR.x - gTopL.x) / 10 + 0.6;
          return <rect key={"gb" + i} x={x - 0.3} y={y - 5} width={bw} height="8" fill={i % 2 ? "#e9ecef" : "#0E0E10"} />;
        })}
        {/* 選手（ドット絵スプライト。Wave H-4） */}
        {/* v43: 姿勢は postureOf で決まる（既定=sprint／仕掛けている数名=dancing／
            ゴール通過後=normal）。同じ集団の中に姿勢差が生まれ、誰が踏んでいるのかが絵で分かる。
            phaseは選手ごとにずらしてペダリングが揃わないようにする（BaseView.jsxと同様、
            tに経過秒・phaseに小さな個人差だけを渡す＝IsoRider時代のphase運用とは意味が違う）。
            cap（ヘルメット色）による個体識別は廃止し、代わりに下の順位表（判断④）と
            引き出し線タグ（v45・下記）で名前を確認できるようにした。 */}
        {rows.map(r => (
          <PixelBikeUse key={r.c.id} x={r.x} y={r.y} color={r.c.color} posture={r.posture}
            flip={false} t={pedalT} phase={riderHash01(r.c.id, 23) * 4} />
        ))}
        {/* v45: 従来は★（エース）・水色の丸（自分）を顔の高さに直接重ねており、密集時に
            顔にもお互いにも被って読みづらかった。俯瞰マップと同じ「頭上斜めへ引き出し線＋
            名前タグ」方式に統一。全選手ではなく自分・エース・自チームのみ対象（過剰表示を
            避ける）。スプライトを描き終えた後に別パスで重ね描きし、隣の選手のスプライトに
            タグが隠れないようにする。 */}
        {rows.filter(r => riderTagKind(r.c)).map(r => {
          const dx = 12 + (riderHash01(r.c.id, 41) - 0.5) * 5;
          const dy = -24 - riderHash01(r.c.id, 43) * 9;
          const kind = riderTagKind(r.c);
          return <RiderNameTag key={"tag" + r.c.id} x={r.x} y={r.y - 9} dx={dx} dy={dy}
            kind={kind} label={riderTagIcon(kind) + r.c.name.split(" ")[0]} />;
        })}
      </svg>
      {fade > 0.01 && <div style={{ position: "absolute", inset: 0, background: "#000", opacity: fade, borderRadius: 8, pointerEvents: "none" }} />}
      <div style={{ fontSize: 10.5, color: T.color.sub, textAlign: "center", marginTop: 4 }}>
        {soloWin ? "独走フィニッシュ" : n > 1 ? (bunch ? `大集団のゴールスプリント（${n}名）` : "ゴールスプリント") : "単独ゴール"}{close && approaching ? " — スロー再生" : ""}
      </div>
      {/* Wave H-4（判断④）: リアルタイム順位表。色スウォッチが画面内の各選手のジャージ色と
          対応する。自分は水色枠、エースは★で強調（画面上のマーカーと共通）。 */}
      {n > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", marginTop: 5 }}>
          {standingsShown.map(o => (
            <div key={o.c.id} style={{
              display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 6,
              background: o.c.isPlayer ? "rgba(39,211,255,0.15)" : T.color.surfaceUp,
              border: `1px solid ${o.c.isPlayer ? "#27d3ff" : "transparent"}`,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: o.c.color, flexShrink: 0 }} />
              <span style={{ fontFamily: FONT_DOT, fontSize: 9.5, color: T.color.sub }}>{o.rank}</span>
              <span style={{ fontSize: 10, color: T.color.text, maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {o.c.isAce ? "★" : ""}{o.c.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
