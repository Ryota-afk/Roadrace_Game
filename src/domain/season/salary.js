// 第12弾(12-A): シーズンの選手年俸制（純関数のみ・JSX非依存）。
// 詳細な導出根拠・キャリブレーション表はdevlog/wave12.mdを参照。
import { overall } from "../../core/core.js";

export const SALARY_BASE = 40;  // OVR95相当での月額（万円）
export const SALARY_FLOOR = 45; // これ以下は最低額
export const SALARY_SCALE = 50;
export const SALARY_EXP = 2.6;  // 上位ほど跳ねる非線形性

export function riderSalary(r) {
  const t = Math.max(0, overall(r) - SALARY_FLOOR) / SALARY_SCALE;
  return Math.max(1, Math.round(SALARY_BASE * Math.pow(t, SALARY_EXP)));
}

// mul: 第12弾12-C「年俸交渉術」（CP交換所）の恒久割引。riderSalary()自体は純粋なまま保ち、
// 割引は合計額にだけ掛ける（個々のcalibration表の数値をmul=1のまま検証し続けられるようにするため）。
export function teamPayroll(roster, mul = 1) {
  return Math.round((roster || []).reduce((a, r) => a + riderSalary(r), 0) * mul);
}
