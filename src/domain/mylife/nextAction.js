// v46(UI): 次のアクション#15「導線・ユーザビリティ」。マイライフ本編で「今月は何をすべきか」が
// 一目で分からないという指摘への対応。疲労・レースの有無・大舞台かどうかから今月のおすすめを
// 1つだけ判定する純関数（CLAUDE.md §5：JSX非依存＝Node単体テスト可能）。
// ラベル文言・実際のonClickハンドラはUI側（screens/mylife/hub.jsx）が key から組み立てる
// （フォーカス中の能力名などUI都合の文言を混ぜないため、ここではkeyとreasonだけを返す）。
// 判定結果は「黄・塗りの強調ボタン＋理由1行」として表示する想定。他の行動を選ぶ自由は
// 常に残す（このおすすめは強制ではなく道しるべ）。
export function mlNextAction({ fatigue, race, recTrainLabel }) {
  const fat = fatigue || 0;
  if (fat >= 85) {
    return { key: "rest", reason: "疲労が高い。このまま走ると故障の危険がある" };
  }
  if (race && race.milestone && fat < 70) {
    return { key: "race", reason: "一生に何度もない大舞台。ここで結果を残したい" };
  }
  if (race && fat < 75) {
    return { key: "race", reason: "出走すると経験で能力が伸びる" };
  }
  return { key: "train", reason: recTrainLabel ? `今は${recTrainLabel}を伸ばす好機` : "地力を鍛える好機" };
}
