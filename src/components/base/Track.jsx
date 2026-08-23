// BaseView（敷地画面）の練習コース。Wave Dで新設 → Wave D2で路肩の白線 → 第20弾で
// 角丸オーバルから「丸め角付き任意多角形」（案A: L字）へ一般化。リボン・中央破線・白線・
// スタート帯を重ねる。選手も同じloopPointAtで周回するため、見た目と走行位置が常に一致する。
import React from "react";
import { isoProject, loopRibbonPts, loopCenterlinePts, loopNearestT } from "../../domain/season/baseViewLayout.js";

const chain = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");
const closed = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

// rack: 自転車ラック({w,l})。スタート/フィニッシュ帯はラックに一番近い周回路上の地点に
// 固定する（選手がラックから出てすぐ・戻る直前に通る場所＝実際のスタート/ゴールらしい位置）。
export function Track({ proj, loop, rack }) {
  const { trackHalfWidth } = loop;
  const N = 96; // 第20弾: L字は周長が伸びたためサンプルを増やす（角の丸みを保つ）
  const project = (p) => isoProject(p.w, p.l, 0, proj);
  const { outer, inner } = loopRibbonPts(loop, N, trackHalfWidth);
  const outerPx = outer.map(project), innerPx = inner.map(project);
  const centerPx = loopCenterlinePts(loop, N).map(project);

  // ラック最寄りのtをリボンのサンプル間隔(1/N)へ丸め、隣接する2点で帯の幅を作る。
  const t0 = loopNearestT(loop, rack);
  const i0 = Math.round(t0 * N) % N;
  const i1 = (i0 + 1) % N;

  return (
    <g>
      {/* 路面（evenoddで内側をくり抜いた1本のリボン）。第25弾：アスファルトの
          粒テクスチャ（BaseView.jsxのGroundTextureDefsが定義するpattern） */}
      <path d={`M ${chain(outerPx)} Z M ${chain(innerPx)} Z`} fill="url(#texAsphalt)" fillRule="evenodd" />
      {/* 路肩の白線（外側・内側） */}
      <polygon points={closed(outerPx)} fill="none" stroke="#eceadf" strokeWidth="1.6" opacity="0.75" />
      <polygon points={closed(innerPx)} fill="none" stroke="#eceadf" strokeWidth="1.6" opacity="0.75" />
      {/* センターの破線 */}
      <polygon points={closed(centerPx)} fill="none" stroke="#e9e2d4" strokeWidth="1" strokeDasharray="6,7" opacity="0.6" />
      {/* スタート/フィニッシュ帯（ラック最寄り点） */}
      <polygon points={closed([outerPx[i0], outerPx[i1], innerPx[i1], innerPx[i0]])} fill="#f4f2ec" stroke="#22242a" strokeWidth="0.6" />
    </g>
  );
}
