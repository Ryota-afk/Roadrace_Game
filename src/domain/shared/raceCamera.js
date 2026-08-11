// レース観戦画面（俯瞰マップ）のカメラ平滑化計算（純関数・JSX非依存＝Node単体テスト可能）。
// components/RaceView.jsx の描画ループ（setInterval 33ms≒30fps）から毎フレーム呼ばれる。
//
// 【背景】v46: ズームイン・ズームアウトが速すぎてガクガクして見えるという指摘を受け調整。
// kSpan は指数平滑の係数で、1フレームごとに (targetSpan-curSpan) の kSpan 倍だけ近づく。
// 30fpsのもとでは 1/e（約63%）収束までの時間は概ね 1 / (k * 30) 秒になる。
// ZOOM_IN_K=0.028 → 約1.2秒、ZOOM_OUT_K=0.09 → 約370ms で収束する計算値。
// ズームインを緩やかに・ズームアウトを速く戻す非対称性は据え置き（先頭が枠外に
// 飛び出すのを防ぐには「広げる」方は機敏である必要があるため）。
export const PAN_K = 0.5;          // パン（中心）は機敏に追従（ズームより優先して据え置き）
export const ZOOM_IN_K = 0.028;    // ズームイン（寄る）は緩やかに ≒1.2秒で収束
export const ZOOM_OUT_K = 0.09;    // ズームアウト（引く）は速く戻す ≒370msで収束
export const ZOOM_DEADBAND = 0.12; // 目標との差がこの割合未満ならspanを据え置く（ハンチング防止）
export const FRAME_MARGIN_RATIO = 0.08;     // 枠寄せ補正の余白（span比）
export const FRAME_MAX_SHIFT_RATIO = 0.055; // 1フレームあたりの寄せ量上限（span比、ガクつき防止）

// prev: 直前フレームの {start, end}（初回はnull）。maxF/minF: 今フレームで画面に収めるべき
// 選手群のフィールド座標(frac)の最大・最小。戻り値は次フレームで使う {start, end}。
export function smoothRaceCamera({ targetC, targetSpan, prev, maxF, minF }) {
  let nc, nSpan;
  if (!prev) {
    nc = targetC;
    nSpan = targetSpan;
  } else {
    const curC = (prev.start + prev.end) / 2, curSpan = prev.end - prev.start;
    const relDiff = Math.abs(targetSpan - curSpan) / Math.max(1e-6, curSpan);
    const kSpan = relDiff < ZOOM_DEADBAND ? 0 : (targetSpan < curSpan ? ZOOM_IN_K : ZOOM_OUT_K);
    nc = curC + (targetC - curC) * PAN_K;
    nSpan = curSpan + (targetSpan - curSpan) * kSpan;
  }
  let ns = nc - nSpan / 2, ne = nc + nSpan / 2;
  // 補正：選手が枠からはみ出しそうなら枠を"寄せて"収める（端に張り付かせない）。入り切らない時だけ広げる
  const margin = nSpan * FRAME_MARGIN_RATIO, maxShift = nSpan * FRAME_MAX_SHIFT_RATIO;
  const clampShift = (d) => Math.max(-maxShift, Math.min(maxShift, d));
  if (maxF > ne - margin) { const d = clampShift(maxF - (ne - margin)); ns += d; ne += d; }
  if (minF < ns + margin) { const d = clampShift((ns + margin) - minF); ns -= d; ne -= d; }
  if (maxF > ne) ne = maxF + margin;
  return { start: ns, end: ne };
}
