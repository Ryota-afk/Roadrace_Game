// 第9弾：判断カードの「レア度」を計算する純関数（JSX非依存・Node単体テスト可能）。
// レア度は「強さ」ではなく「振れ幅」を表す（DEVLOG §40）。
//   虹＝大勝負（決まれば独走／外せば大きく落ちる）
//   金＝手堅い（確実に効くが伸びは限定的）
//   通常＝無難（hold＝何もしない基準点）
//   不発＝今は効かない（脚が売り切れて、脚依存の一手が機能しない）
// sim本体（sim/race.js）と同じ`legsLeft01`を使い、表示と実際の挙動を食い違わせない。
import { legsLeft01 } from "../../sim/race.js";

// v48(第9弾): attackLeftを付与し「単独で先頭に残る」状態を作る一手は、決まれば集団から
// 抜け出せるが、外せば独走の消耗（ドラフト保護なし）を集団に吸収されるまで払い続ける＝
// 大きく落ちるリスクを負う。sendは自分自身、teamChaseは僚友にattackLeftを付与する
// （RACE_MOVES参照）。この3手だけが「落ちる」構造を持つため虹に分類する。
const RISK_MOVES = new Set(["attack", "send", "teamChase"]);

// 集団に残ったまま消耗を抑える／確実に上乗せを得る一手＝手堅い（金）。
const STEADY_MOVES = new Set(["conserve", "hangOn", "kick", "kickBig", "sprintWait", "teamShelter", "assistLaunch"]);

// legsLeft01（残脚）に比例して効果が決まる一手。脚が売り切れていれば「不発」になり得る。
const LEGS_SCALED_MOVES = new Set(["attack", "send", "kick", "kickBig", "sprintWait"]);

// この残脚（0〜1）を下回ったら、脚依存の一手は「不発」表示に落ちる。
const DUD_THRESHOLD = 0.15;

export function moveTierBase(moveId) {
  if (RISK_MOVES.has(moveId)) return "rainbow";
  if (STEADY_MOVES.has(moveId)) return "gold";
  return "normal"; // hold等、基準点の一手
}

// moveId・その瞬間のエネルギー（RACE_MOVESと同じ0〜100スケールの生値）から
// { tier, g } を返す。gは残脚0〜1（脚バーと同じ値なのでUI側で使い回せる）。
export function moveEdge(moveId, energy) {
  const g = legsLeft01({ energy });
  const base = moveTierBase(moveId);
  const dud = LEGS_SCALED_MOVES.has(moveId) && g < DUD_THRESHOLD;
  return { tier: dud ? "dud" : base, g };
}
