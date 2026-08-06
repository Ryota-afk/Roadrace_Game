// 拠点(BaseView)の吹き出し1個分の描画（Wave H-1／旧Wave E-4の残件）。
// セリフの決定は domain/season/riderChatter.js が済ませている前提で、ここは純粋に見た目だけ。
//
// 【scaleについて】呼び出し側はカメラ倍率kの逆数(1/k)を渡す。BaseViewの初期表示はfitスケール
// （敷地全体が画面に収まる＝かなり引いた状態）のため、シーン座標のまま文字を描くと読めない
// 大きさになる。カメラ変換の内側でscale(1/k)を掛けることで正味の倍率を1＝画面ピクセル等倍に
// 固定し、ズーム位置に関わらず常に同じ読めるサイズを保つ。
// 一方、頭上へのオフセット(y)はシーン座標のまま呼び出し側で与える＝スプライトの背丈に
// 正しく追従する（拡大すると吹き出しがちゃんと頭から離れる）。
import React from "react";
import { FONT_B } from "../../data/theme.js";

const FONT_SIZE = 9.5;
const CHAR_W = 9.6;   // 日本語全角1文字ぶんの想定幅（半角混在ぶんは余白として吸収される）
const PAD_X = 5;
const PAD_Y = 3.5;
const TAIL_W = 3.2;   // 尻尾の根元の半幅
const TAIL_H = 4;     // 尻尾の高さ

const BUBBLE_FILL = "#f7f2e6";   // ドット絵の明色に馴染む不透明なオフホワイト
const BUBBLE_LINE = "#20242e";
const BUBBLE_TEXT = "#1a1e26";

export function SpeechBubble({ x, y, text, scale = 1 }) {
  if (!text) return null;
  const w = Math.max(26, text.length * CHAR_W + PAD_X * 2);
  const h = FONT_SIZE + PAD_Y * 2;
  const top = -TAIL_H - h;
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${scale.toFixed(4)})`}>
      <polygon points={`${-TAIL_W},${-TAIL_H + 0.5} ${TAIL_W},${-TAIL_H + 0.5} 0,0`}
        fill={BUBBLE_FILL} stroke={BUBBLE_LINE} strokeWidth="1" strokeLinejoin="round" />
      <rect x={-w / 2} y={top} width={w} height={h} rx="3.5"
        fill={BUBBLE_FILL} stroke={BUBBLE_LINE} strokeWidth="1" />
      <text x="0" y={top + h / 2} textAnchor="middle" dominantBaseline="central"
        fontFamily={FONT_B} fontSize={FONT_SIZE} fill={BUBBLE_TEXT}>{text}</text>
    </g>
  );
}
