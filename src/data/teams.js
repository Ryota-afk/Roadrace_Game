// チームのロースター定義（純データ）。Phase 4-1後の state.js から分離（Step5: domain抽出の前提整理）。
// domain/season/* が RIVAL_TEAMS を参照する際、state.js への逆依存（循環import）を避けるため data/ に置く。

// v46(#23): 永続ワールドロースターの定員。旧来は6名固定で、通常レース（squadMax=5）では
// 6人目が一度も出走できない死に枠だった。8名に拡張し、5番手以降を「控え層」として持たせる。
// 既存セーブとの互換のため、初期生成そのものは6名のまま据え置き、topUpWorldRosters()で
// 末尾に追記して8名まで埋める（既存メンバーのidentity・並び順は一切変えない。詳細はstate.js参照）。
//
// v49(第11弾): 世界ランキング（computeWorldRank/worldRankTier）は1〜300位スケールで
// 「世界に挑む新鋭＝〜200位」等のラベルを持つが、実際の世界人口はMYLIFE_TEAMS(9)×8＝72名しか
// おらず、しきい値と実体が乖離していた。当初は1チームの定員を34名まで拡張して人口を
// 埋める案を試したが、シーズンの自チーム上限（12〜16名）と比べて1チーム34名は明らかに
// 過剰で違和感が出ると判断し、ユーザーの指示で方針転換：**1チームあたりの人数は12名
// （シーズンB1の所属枠上限と同規模）に抑え、代わりにチーム数をMYLIFE_TEAMSで25まで
// 増やす**ことで300名規模（12×25＝300）に到達させる。既存の8名化と同じ手順
// （genWorldRosters()の初期生成数・rngストリームには触れず、topUpWorldRosters()が
// 末尾に追記するだけ）を踏襲するため、既存メンバーのidentity・並び順・旧セーブ互換は壊れない。
export const WORLD_ROSTER_SIZE = 12;

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
//
// v49(第11弾): 世界人口を300名規模へ広げるため16チーム追加し、MYLIFE_TEAMSを25チームへ
// 拡張（RIVAL_TEAMSは6チームのまま据え置き＝シーズンのクラス構成・昇降格には触れない）。
// 追加分もspec（5種）・tier（0/1/2）を既存9チームと同じ考え方で均等に割り振っている
// （各specがちょうど5チームずつになるよう調整）。ここで増えたチームは、マイライフの
// 移籍オファー・ライバル所属・世界ロースター生成のいずれも「ランダムに1つ選ぶ」形でしか
// 使われない（一覧をそのままプレイヤーに見せるUIは無い）ため、追加しても選択画面が
// 煩雑になることはない。
export const MYLIFE_TEAMS = [
  ...RIVAL_TEAMS,
  { name: "サンライズ静岡", color: "#4fd1c5", tier: 0, spec: "RUL", trait: "平坦のルーラー集団" },
  { name: "北斗プロサイクル", color: "#c084fc", tier: 1, spec: "PUN", trait: "勝負師揃い" },
  { name: "クレバー横浜", color: "#38bdf8", tier: 2, spec: "TT", trait: "TT巧者集団" },
  { name: "スパークル金沢", color: "#f4785a", tier: 0, spec: "SPR", trait: "北陸の俊足集団" },
  { name: "シリウス岡山", color: "#ff6b81", tier: 0, spec: "SPR", trait: "山陽育ちの快速屋" },
  { name: "エルデ神戸", color: "#d94f8c", tier: 1, spec: "SPR", trait: "関西のスプリント新鋭" },
  { name: "インペリアル大阪", color: "#8e44ad", tier: 2, spec: "SPR", trait: "西の絶対王者" },
  { name: "フェニックス熊本", color: "#ff7f50", tier: 0, spec: "PUN", trait: "九州の勝負師" },
  { name: "サザンクロス那覇", color: "#f6b93b", tier: 1, spec: "PUN", trait: "南国のオールラウンダー" },
  { name: "ブリランテ川崎", color: "#c2185b", tier: 2, spec: "PUN", trait: "首都圏の万能強豪" },
  { name: "白樺青森", color: "#66cdaa", tier: 0, spec: "CLM", trait: "北の山岳一族" },
  { name: "桜華奈良", color: "#a29bfe", tier: 1, spec: "CLM", trait: "古都の登り屋" },
  { name: "グラン・ピレネー岐阜", color: "#4a69bd", tier: 2, spec: "CLM", trait: "飛騨山脈の登坂帝国" },
  { name: "コバルト長野", color: "#34ace0", tier: 0, spec: "TT", trait: "高原のTT系譜" },
  { name: "アズール千葉", color: "#7ed6df", tier: 1, spec: "TT", trait: "湾岸の独走部隊" },
  { name: "ノーザンライツ帯広", color: "#eccc68", tier: 2, spec: "TT", trait: "雪原の独走帝国" },
  { name: "みちのく飛脚", color: "#5b8c5a", tier: 0, spec: "RUL", trait: "東北の鉄脚ルーラー" },
  { name: "常磐ウルフ", color: "#b8860b", tier: 1, spec: "RUL", trait: "常磐路の集団戦術家" },
  { name: "ヴァルハラ広島", color: "#6ab04c", tier: 2, spec: "RUL", trait: "中国地方の重戦車軍団" },
];
