// クラブハウス内の持ち場（什器）1つぶんの描画。Wave E-2 redoで新設。
// 第19弾：手続きSVGを全廃しドット絵（sprites/pixelObjectData.jsのst_*）へ差し替え。
// 第20弾：絵文字バッジを全廃（CLAUDE.md §8「アイコンは逃げ」・ユーザー合意の案b）。
// 部屋の機能は什器そのもので分からせ、**部屋名は選択時のみ**小さな札で表示する。
// 内装グレードG3の金枠はバッジ廃止に伴い選択リングの色替えに引き継いだ。
import React from "react";
import { FONT_DOT } from "../../data/theme.js";
import { isoBoxFaces } from "../../domain/season/baseViewLayout.js";
import { pixelObjectNode } from "../sprites/pixelObject.jsx";
import { OBJ_SPRITES } from "../sprites/pixelObjectData.js";

const STATION_SPRITE = {
  roller: "st_roller",       // ローラー台一式（ローラー＋サイドテーブル＋マット）
  workbench: "st_workbench", // 作業台（ペグボード＋工具＋引き出し）
  medical: "st_medical",     // 診察ベッド（ベッド＋点滴＋モニター＋ワゴン）
  desk: "st_desk",           // スカウトデスク（デスク＋モニター＋チェア）
  empty: "st_empty",         // 納戸（段ボール＋掃除機＋古いPC。未解禁の奥3部屋にも使う）
};

// grade(0〜3)はWave H-2の内装グレード。G3は選択リングを金色にする。
export function Station({ s, proj, selected, grade = 0 }) {
  const spriteKey = STATION_SPRITE[s.kind] || "st_desk";
  const label = isoBoxFaces(s.w, s.l, 0, 0, 0, proj).corners.N;
  const ringColor = grade >= 3 ? "#f5d98a" : "#ffffff";
  return (
    <g opacity={selected ? 1 : 0.98}>
      {pixelObjectNode({
        x: label.x, y: label.y, data: OBJ_SPRITES[spriteKey],
        key: "furniture", cacheKey: `obj-${spriteKey}`,
      })}
      {selected && (
        <g>
          <circle cx={label.x} cy={label.y - 4} r="16" fill="none" stroke={ringColor} strokeWidth="1.2" opacity="0.6" />
          <g transform={`translate(${label.x.toFixed(1)},${(label.y - 26).toFixed(1)})`}>
            <rect x={-(s.label.length * 5.5 + 6)} y="-9" width={s.label.length * 11 + 12} height="15" rx="2"
              fill="#16181d" opacity="0.85" />
            <text x="0" y="2.5" textAnchor="middle" fontSize="10" fill="#f2efe6"
              fontFamily={FONT_DOT} style={{ pointerEvents: "none" }}>{s.label}</text>
          </g>
        </g>
      )}
    </g>
  );
}
