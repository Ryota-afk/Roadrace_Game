// v46(UI): 次のアクション#15「導線・ユーザビリティ」。マイライフ本編で「今月は何をすべきか」が
// 一目で分からないという指摘への対応。疲労・レースの有無・大舞台かどうかから今月のおすすめを
// 1つだけ判定する純関数（CLAUDE.md §5：JSX非依存＝Node単体テスト可能）。
// ラベル文言・実際のonClickハンドラはUI側（screens/mylife/hub.jsx）が key から組み立てる
// （フォーカス中の能力名などUI都合の文言を混ぜないため、ここではkeyとreasonだけを返す）。
// 判定結果は「黄・塗りの強調ボタン＋理由1行」として表示する想定。他の行動を選ぶ自由は
// 常に残す（このおすすめは強制ではなく道しるべ）。
// v47(第7弾A-3): 衰え期は練習を既定で勧めない（練習は疲労を増やすだけで能力の伸びもごく僅か。
// 衰え期の選手にはレース・休養を優先させる。詳細はDEVLOG §38参照）
export function mlNextAction({ fatigue, race, recTrainLabel, declining }) {
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
  if (declining) {
    return { key: "rest", reason: "衰え期。無理な練習より休養で長く走れる体を保ちたい" };
  }
  return { key: "train", reason: recTrainLabel ? `今は${recTrainLabel}を伸ばす好機` : "地力を鍛える好機" };
}
