// クラブハウス内の持ち場（什器）1つぶんの描画。Wave E-2 redoで新設。
// 第19弾：手続きSVG（tableBox/wheelIcon等の組み合わせ）を全廃し、ユーザー提供の参考画像から
// 抽出したドット絵（sprites/pixelObjectData.jsのst_*）へ全面差し替えた。
// バッジ（部屋アイコン・内装グレードG3の金枠）と選択リングの仕組みは従来のまま。
import React from "react";
import { isoBoxFaces } from "../../domain/season/baseViewLayout.js";
import { pixelObjectNode } from "../sprites/pixelObject.jsx";
import { OBJ_SPRITES } from "../sprites/pixelObjectData.js";

const STATION_SPRITE = {
  roller: "st_roller",       // ローラー台一式（ローラー＋サイドテーブル＋マット）
  workbench: "st_workbench", // 作業台（ペグボード＋工具＋引き出し）
  medical: "st_medical",     // 診察ベッド（ベッド＋点滴＋モニター＋ワゴン）
  desk: "st_desk",           // スカウトデスク（デスク＋モニター＋チェア）
  empty: "st_empty",         // 空き部屋の機器（段ボール＋掃除機＋古いPC）
};

// grade(0〜3)はWave H-2の内装グレード。G3のみバッジに金枠を追加する
// （domain/season/baseViewLayout.jsのroomGrade参照。判断⑤a+c＝効果は無いが実績連動）。
export function Station({ s, proj, selected, grade = 0 }) {
  const spriteKey = STATION_SPRITE[s.kind] || "st_desk";
  const label = isoBoxFaces(s.w, s.l, 0, 0, 0, proj).corners.N;
  const goldBadge = grade >= 3;
  return (
    <g opacity={selected ? 1 : 0.98}>
      {pixelObjectNode({
        x: label.x, y: label.y, data: OBJ_SPRITES[spriteKey],
        key: "furniture", cacheKey: `obj-${spriteKey}`,
      })}
      <g transform={`translate(${label.x.toFixed(1)},${(label.y - 24).toFixed(1)})`}>
        {goldBadge && <rect x="-9.5" y="-10.5" width="19" height="17" rx="4" fill="none" stroke="#f5d98a" strokeWidth="1.4" />}
        <rect x="-8" y="-9" width="16" height="14" rx="3" fill={s.accent} opacity="0.92" />
        <text x="0" y="1.5" textAnchor="middle" fontSize="9" style={{ pointerEvents: "none" }}>{s.icon}</text>
      </g>
      {selected && <circle cx={label.x} cy={label.y - 4} r="16" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.5" />}
    </g>
  );
}
