// チームのロースター定義（純データ）。Phase 4-1後の state.js から分離（Step5: domain抽出の前提整理）。
// domain/season/* が RIVAL_TEAMS を参照する際、state.js への逆依存（循環import）を避けるため data/ に置く。

// v35(シーズン深掘り): 各チームに個性（脚質傾向 spec ＋ 二つ名 trait）。レースでは所属選手が
// その脚質に寄って生成され、エースは必ずその脚質になる（＝スプリント軍団は平坦で、山岳の名門は
// 登りで脅威、という対戦の駆け引きが生まれる）。spec は newRider の type コード。
// v38: チーム数を拡張（4→6）。tier（0=下位/1=中堅/2=強豪）と spec（脚質傾向）を各帯に散らし、
// クラス（B1/A/PRO）ごとに複数チームが存在するようにした＝昇降格で相手・移籍先の顔ぶれが変わる。
export const RIVAL_TEAMS = [
  { name: "レッドサンダー山陽", color: "#d9484a", tier: 1, spec: "SPR", trait: "スプリント軍団" },
  { name: "クレディ・ブルー", color: "#3f7fd9", tier: 2, spec: "PUN", trait: "オールラウンドの強豪" },
  { name: "ヴェロチタ京都", color: "#9a6be0", tier: 0, spec: "CLM", trait: "山岳の名門" },
  { name: "ウィンドミル北海道", color: "#e08a3f", tier: 0, spec: "TT", trait: "独走・逃げ派" },
  { name: "グランヴィア福岡", color: "#2fb37a", tier: 2, spec: "CLM", trait: "山岳の超名門" },
  { name: "アトラス名古屋", color: "#eab308", tier: 1, spec: "RUL", trait: "鉄壁のルーラー軍団" },
];

// マイライフはさらに3チーム多い（9チーム）。所属先・移籍先の選択肢を広げ、キャリアごとに
// 顔ぶれが変わるようにする。tier2（PRO級）も複数用意して昇格後の移籍先を確保。
export const MYLIFE_TEAMS = [
  ...RIVAL_TEAMS,
  { name: "サンライズ静岡", color: "#4fd1c5", tier: 0, spec: "RUL", trait: "平坦のルーラー集団" },
  { name: "北斗プロサイクル", color: "#c084fc", tier: 1, spec: "PUN", trait: "勝負師揃い" },
  { name: "クレバー横浜", color: "#38bdf8", tier: 2, spec: "TT", trait: "TTスペシャリスト集団" },
];
