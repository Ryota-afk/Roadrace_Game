// 最終スプリント演出の「姿勢」決定（純関数・JSX非依存＝Node単体テスト可能）。
// components/RaceView.jsx の FinalSprintCinematic から使う。
//
// 【背景】v43以前は姿勢を `kick > 0.2` の一点で決めていた。kick は
// `(sprint - 72) / 24` というPRO帯基準の絶対値なので、実測すると条件（スプリント能力77超）を
// 満たすのは B1帯 0% / A帯 4.8% / PRO帯 24.8% でしかなく、下位クラスでは誰一人として
// 姿勢が変わらなかった。さらに dancing は<symbol>すら生成しておらず一度も使われていなかった。
// そこで「集団の中で最も仕掛けている数名」というフィールド相対の選び方に変え、
// クラスによらず3姿勢が意味を持って出そろうようにした。

// 演出に登場する集団のうち、サドルから腰を上げて仕掛ける（dancing）選手のidを選ぶ。
// kick の絶対値ではなく集団内の順位で選ぶため、どのクラスでも必ず数名が該当する。
// contenders は演出中ずっと不変なので、呼び出し側で一度だけ算出して使い回す。
export function pickDancerIds(contenders) {
  if (!contenders || contenders.length === 0) return new Set();
  const sorted = [...contenders].sort((a, b) => (b.kick || 0) - (a.kick || 0));
  const n = Math.max(1, Math.min(3, Math.round(sorted.length * 0.25)));
  return new Set(sorted.slice(0, n).map(c => c.id));
}

// rem: ゴールまでの残り（演出内の単位。0以下＝通過済み）。
// 最終直線は全員がもがいている場面なので既定は sprint（下ハンドル）。
// 仕掛けている数名だけが dancing、ゴールを通過してしばらく経ってから身体を起こして normal に戻る。
// v45.4: 旧しきい値は rem<=0.05（＝通過した瞬間）だったため、ゴールした直後に選手が
// 即座に体を起こして見えた（ユーザー指摘）。POST_FINISH_HOLD分だけ通過後もsprint/dancing
// 姿勢を保持し、しばらく走り抜けてから自然に立ち上がるようにする。
// v46(#13再修正): 1.5では実機でまだ早く感じられた（呼び出し元がwOfの前後ジッター削除で
// 描画位置の精度が上がったこともあり、より正確に「まだ通過していない」ことを検出できる
// ようになった）。1ユニット=約Px(30)px相当の画面奥行きなので、3.0=自転車2台分ほど
// 明確に過ぎ切った量まで引き上げた。
const POST_FINISH_HOLD = 3.0;
export function sprintPosture(rem, isDancer) {
  if (rem <= -POST_FINISH_HOLD) return "normal";
  if (isDancer && rem < 2.6) return "dancing";
  return "sprint";
}

// この演出で出現しうる姿勢の一覧。<symbol>定義（PixelBikeSymbolDefs）に渡す組み合わせを
// ここから作ることで、「姿勢を増やしたのに<symbol>を作り忘れて選手が消える」事故を防ぐ。
export const SPRINT_POSTURES = ["normal", "sprint", "dancing"];
