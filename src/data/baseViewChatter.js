// 拠点(BaseView)の選手の吹き出しセリフ表（Wave H-1／旧Wave E-4の残件）。
// リテラルのみを持つデータ層——ロジックは domain/season/riderChatter.js が担う。
//
// 各行の意味：
//   when    : 状況キー。"ride"＝練習コース周回中、それ以外は持ち場の部屋キー
//             （training/mechanic/medical/scout）。移動中は喋らないので該当キーは無い。
//   persona : null＝全性格共通、指定あり＝その性格の選手だけが言う（data/abilities.jsのPERSONALITIES）
//   state   : null＝常時、指定あり＝その状態のときだけ言う
//             injured=故障中／tired=疲労80以上／hot=調子4以上／cold=調子2以下
//
// 性格10種×状況5種の完全な表（50セット）はデータが爆発するため、フラットな1次元配列にして
// 「状況が一致 かつ 性格が一致(またはnull) かつ 状態が一致(または該当なしならnull)」で
// 絞り込む方式にした。共通セリフで最低限の量を保証しつつ、性格つき・状態つきのセリフが
// 混ざることで個性と情報量が出る。セリフの追加は1行足すだけで済む。
//
// 【不変条件】各whenについて`persona:null かつ state:null`の行が最低1つ必要
//（絞り込みの最終フォールバックになるため。riderChatter.jsのNodeテストで検証している）。
export const BASE_VIEW_CHATTER = [
  // ── 練習コース周回中 ──────────────────────────────
  { when: "ride", persona: null, state: null, text: "いいペースだ" },
  { when: "ride", persona: null, state: null, text: "脚が回る" },
  { when: "ride", persona: null, state: null, text: "風が気持ちいい" },
  { when: "ride", persona: null, state: null, text: "もう一周" },
  { when: "ride", persona: null, state: "tired", text: "脚が…重い" },
  { when: "ride", persona: null, state: "tired", text: "そろそろ限界だ" },
  { when: "ride", persona: null, state: "injured", text: "無理はできないな" },
  { when: "ride", persona: null, state: "hot", text: "今日は乗れてる！" },
  { when: "ride", persona: null, state: "hot", text: "体が軽い" },
  { when: "ride", persona: null, state: "cold", text: "調子が上がらない" },
  { when: "ride", persona: "normal", state: null, text: "調子はまずまず" },
  { when: "ride", persona: "genius", state: null, text: "まだ本気じゃない" },
  { when: "ride", persona: "hotblood", state: null, text: "まだまだ行けるぞ！" },
  { when: "ride", persona: "seeker", state: null, text: "この一本を丁寧に" },
  { when: "ride", persona: "artisan", state: null, text: "淡々と踏む" },
  { when: "ride", persona: "free", state: null, text: "ひとりの方が速い" },
  { when: "ride", persona: "smart", state: null, text: "心拍は想定内" },
  { when: "ride", persona: "maverick", state: null, text: "先に行く" },
  { when: "ride", persona: "showman", state: null, text: "見ててくれよ！" },
  { when: "ride", persona: "tactician", state: null, text: "ここは温存だ" },

  // ── トレーニング室 ────────────────────────────────
  { when: "training", persona: null, state: null, text: "あと10本…" },
  { when: "training", persona: null, state: null, text: "うっ、キツい" },
  { when: "training", persona: null, state: null, text: "もう一セット" },
  { when: "training", persona: null, state: "tired", text: "今日はここまでか" },
  { when: "training", persona: null, state: "injured", text: "軽めに回そう" },
  { when: "training", persona: null, state: "hot", text: "体が動く！" },
  { when: "training", persona: null, state: "cold", text: "体が重いな…" },
  { when: "training", persona: "normal", state: null, text: "地道にやるか" },
  { when: "training", persona: "genius", state: null, text: "これで十分だろ" },
  { when: "training", persona: "hotblood", state: null, text: "気合いだ！" },
  { when: "training", persona: "seeker", state: null, text: "フォームを見直す" },
  { when: "training", persona: "artisan", state: null, text: "毎日同じことを" },
  { when: "training", persona: "free", state: null, text: "飽きてきたな" },
  { when: "training", persona: "smart", state: null, text: "数字で管理だ" },
  { when: "training", persona: "maverick", state: null, text: "ひとりで追い込む" },
  { when: "training", persona: "showman", state: null, text: "自己新記録だ！" },
  { when: "training", persona: "tactician", state: null, text: "山岳に備える" },

  // ── メカニック室 ──────────────────────────────────
  { when: "mechanic", persona: null, state: null, text: "チェーン鳴ってるな" },
  { when: "mechanic", persona: null, state: null, text: "ホイール変えるか" },
  { when: "mechanic", persona: null, state: null, text: "ここを詰めたい" },
  { when: "mechanic", persona: null, state: "tired", text: "サドル下げようか" },
  { when: "mechanic", persona: null, state: "injured", text: "復帰に備えて整備" },
  { when: "mechanic", persona: null, state: "hot", text: "機材もバッチリだ" },
  { when: "mechanic", persona: null, state: "cold", text: "機材のせいかな…" },
  { when: "mechanic", persona: "normal", state: null, text: "そろそろ交換時期か" },
  { when: "mechanic", persona: "genius", state: null, text: "機材は何でもいい" },
  { when: "mechanic", persona: "hotblood", state: null, text: "頑丈が一番だ" },
  { when: "mechanic", persona: "seeker", state: null, text: "軽さより剛性だ" },
  { when: "mechanic", persona: "artisan", state: null, text: "1mm詰める" },
  { when: "mechanic", persona: "free", state: null, text: "派手なのがいい" },
  { when: "mechanic", persona: "smart", state: null, text: "空気圧は7.0だ" },
  { when: "mechanic", persona: "maverick", state: null, text: "自分で組む" },
  { when: "mechanic", persona: "showman", state: null, text: "目立つ色にしよう" },
  { when: "mechanic", persona: "tactician", state: null, text: "山岳用に組み替え" },

  // ── メディカル室 ──────────────────────────────────
  { when: "medical", persona: null, state: null, text: "痛たた…" },
  { when: "medical", persona: null, state: null, text: "ケアは大事だな" },
  { when: "medical", persona: null, state: null, text: "もう少し休むか" },
  { when: "medical", persona: null, state: "tired", text: "体が悲鳴を上げてる" },
  { when: "medical", persona: null, state: "injured", text: "早く治さないと…" },
  { when: "medical", persona: null, state: "hot", text: "念のための検診だ" },
  { when: "medical", persona: null, state: "cold", text: "どこか悪いのかな" },
  { when: "medical", persona: "normal", state: null, text: "問題なさそうだ" },
  { when: "medical", persona: "genius", state: null, text: "すぐ治るさ" },
  { when: "medical", persona: "hotblood", state: null, text: "こんなの平気だ！" },
  { when: "medical", persona: "seeker", state: null, text: "体と向き合う時間" },
  { when: "medical", persona: "artisan", state: null, text: "毎週来てる" },
  { when: "medical", persona: "free", state: null, text: "サボりに来た" },
  { when: "medical", persona: "smart", state: null, text: "データを取ろう" },
  { when: "medical", persona: "maverick", state: null, text: "放っておいてくれ" },
  { when: "medical", persona: "showman", state: null, text: "心配された" },
  { when: "medical", persona: "tactician", state: null, text: "ここで回復させる" },

  // ── スカウト室 ────────────────────────────────────
  { when: "scout", persona: null, state: null, text: "次の相手は誰だ" },
  { when: "scout", persona: null, state: null, text: "いい選手いるかな" },
  { when: "scout", persona: null, state: null, text: "情報が命だな" },
  { when: "scout", persona: null, state: "tired", text: "休みつつ資料を見る" },
  { when: "scout", persona: null, state: "injured", text: "今は情報収集だ" },
  { when: "scout", persona: null, state: "hot", text: "誰が来ても勝てる" },
  { when: "scout", persona: null, state: "cold", text: "勉強しないとな" },
  { when: "scout", persona: "normal", state: null, text: "なるほどな" },
  { when: "scout", persona: "genius", state: null, text: "見なくても分かる" },
  { when: "scout", persona: "hotblood", state: null, text: "誰が来ても倒す！" },
  { when: "scout", persona: "seeker", state: null, text: "学ぶことは多い" },
  { when: "scout", persona: "artisan", state: null, text: "地道に調べる" },
  { when: "scout", persona: "free", state: null, text: "へえ、面白い" },
  { when: "scout", persona: "smart", state: null, text: "データを読み込む" },
  { when: "scout", persona: "maverick", state: null, text: "他人は関係ない" },
  { when: "scout", persona: "showman", state: null, text: "俺が一番だろ" },
  { when: "scout", persona: "tactician", state: null, text: "相手の弱点を探る" },

  // ── 屋外（ベンチ・ジム）第21弾 ──────────────────────
  { when: "bench", persona: null, state: null, text: "ちょっと休憩" },
  { when: "bench", persona: null, state: null, text: "いい天気だな" },
  { when: "bench", persona: null, state: null, text: "水分補給しとくか" },
  { when: "bench", persona: null, state: "tired", text: "少し座らせてくれ" },
  { when: "bench", persona: null, state: "injured", text: "無理はしない" },
  { when: "bench", persona: null, state: "hot", text: "調子いいから休むのも大事" },
  { when: "bench", persona: null, state: "cold", text: "ぼーっとするか" },
  { when: "gym", persona: null, state: null, text: "体幹を鍛えるか" },
  { when: "gym", persona: null, state: null, text: "地力をつけないと" },
  { when: "gym", persona: null, state: null, text: "もう少しやろう" },
  { when: "gym", persona: null, state: "tired", text: "軽めに済ませる" },
  { when: "gym", persona: null, state: "injured", text: "無理のない範囲で" },
  { when: "gym", persona: null, state: "hot", text: "追い込めるな今日は" },
  { when: "gym", persona: null, state: "cold", text: "気合を入れ直す" },
];
