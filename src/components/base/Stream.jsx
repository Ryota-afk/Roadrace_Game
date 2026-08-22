// 小川（第20弾）。コースの道路（Track.jsx）と同じ「中心線に沿った帯」の手続き描画：
// 土手（季節の草色・太）→水面（青・中）→流れのきらめき（細い破線）の3層ストローク。
// Gタイル焼き込みスプライトの切り貼りでは小川に見えなかった（2026-08ユーザー指摘）ため、
// ユーザー選択（「道路と同じ手法で描く」）に基づく置き換え。経路は敷地の縁の外（海）から
// 入り縁の外へ抜けるため、切りっぱなしの端が芝の上に出ない。
import React from "react";
import { isoProject, streamCenterlinePts } from "../../domain/season/baseViewLayout.js";

export function Stream({ proj, stream, palette }) {
  const pts = streamCenterlinePts(stream, 48).map(p => isoProject(p.w, p.l, 0, proj));
  const d = "M " + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={palette.grassPatch} strokeWidth="11" opacity="0.9" />
      <path d={d} stroke="#7fb2d6" strokeWidth="7" />
      <path d={d} stroke="#cde5f4" strokeWidth="1.4" strokeDasharray="7,11" opacity="0.8" />
    </g>
  );
}
