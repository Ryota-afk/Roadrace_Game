// BaseView（敷地画面）の投影・クラブハウス・持ち場・周回路・地面・季節パレット・小物の
// 静的データ。Step13第3弾で新設 → Wave D（磨き込み）→ Wave D2（カイロソフト準拠の再設計）
// → Wave E（カメラ＋カットアウト部屋）。
//
// Wave D2で投影軸の非対称（w軸長26.83 / l軸長24.6で正しい菱形になっていなかった）を
// Px=Lx・Py=-Lyへ修正した（詳細はDEVLOG §10）。
// Wave E-1で固定キャンバス（旧BASE_VIEW_CANVAS）を廃止し、ResizeObserverで実ピクセルに
// viewBoxを一致させる方式へ変更した（`components/base/BaseView.jsx`参照）。
export const BASE_VIEW_PROJ = { cx0: 240, cy0: 600, Px: 26, Py: 13, Lx: 26, Ly: -13 };

// Wave E-2は「5棟の小さな建物」として実装したが、ユーザーの手描きスケッチの再確認により
// 「敷地全体を屋外(コース)/屋内(クラブハウス)の2つに大きく割り、屋内は単一の大部屋で、
// その中にトレーニング・メカニック・メディカル・スカウトそれぞれの持ち場（机など）が
// 点在する」という構図だったことが判明し、作り直した（Wave E-2 redo。詳細はDEVLOG §11）。
// クラブハウス（単一の大部屋）は周回路（world原点中心）から見て手前+右（w大きめ）に配置。
// カメラは固定のため、cutaway（床＋奥2壁だけを見せる手法）の「奥2壁／開放2辺」の判定は
// 部屋の世界座標上の位置に関わらず常にカメラから見て正しい向きになる
// （domain/season/baseViewLayout.jsのbackFacePair参照）。
// 第20弾: 奥行きを+1拡張（hl 4.0→5.0・footprint l:-4.5〜5.5）し、奥段に条件解禁の
// 3部屋（食堂・ロッカールーム・トロフィールーム）を増築した。
export const BASE_VIEW_CLUBHOUSE = {
  key: "clubhouse", label: "クラブハウス", icon: "🏠",
  w: 9.5, l: 0.5, hw: 4.5, hl: 5.0, wallHeight: 40,
  wallLight: "#f0ebe0", wallDark: "#dcd5c4", floor: "#c9a876", accent: "#e05050",
};

// クラブハウス内の4つの持ち場（Wave E-3で什器の種類・数が施設Lvに応じて増える予定。
// 現時点では各持ち場に固定の什器を1つ置く）。levelKey/levelMaxは
// domain/season/baseViewLayout.jsのbuildingLevels(g)が返すキーと対応する。
// w/lはBASE_VIEW_CLUBHOUSEのfootprint（w:5〜14, l:-4.5〜5.5）内、壁際から
// 十分離した位置に配置。roomは下記BASE_VIEW_ROOMSのkeyと対応（どの部屋の什器かを示す。
// 座標が対応する部屋のfootprint内に収まっているかはtools/verify_baseview.mjsで検算している）。
// 第20弾: icon（絵文字バッジ）は廃止。部屋の機能は什器の見た目で伝え、labelは選択時のみ表示。
export const BASE_VIEW_STATIONS = [
  { key: "training", levelKey: "training", levelMax: 5, label: "トレーニング",
    w: 6.6, l: -2.9, kind: "roller", accent: "#2f8f5c", room: "training" },
  { key: "mechanic", levelKey: "mechanic", levelMax: 5, label: "メカニック",
    w: 6.9, l: 1.9, kind: "workbench", accent: "#c9a23c", room: "mechanic" },
  { key: "medical", levelKey: "medical", levelMax: 3, label: "メディカル",
    w: 12.6, l: -2.9, kind: "medical", accent: "#4f8fe8", room: "medical" },
  { key: "scout", levelKey: "scout", levelMax: 3, label: "スカウト",
    w: 12.6, l: 1.7, kind: "desk", accent: "#c98bf0", room: "scout" },
];

// Wave F-2 redo：クラブハウスの間取り。均等な3列×2行グリッドで機械的に割った初版を
// ユーザーの指摘（「出入り口と廊下を一切考慮していない」「均等に並べる必要は必ずしもない」
// 「現実的な間取りにして」）を受けて全面的に作り直した。玄関（Room.jsxの扉。footprintの
// 手前辺、w9.5付近の中央）を入ってすぐが廊下(corridor)で、廊下の左右に4つの持ち場、
// 廊下の突き当りに小さな空き部屋(納戸)2つを配置する、普通の建物に近い構成。
// 第20弾: T字廊下の間取り（devlog/wave20.md）。footprint(w:5〜14, l:-4.5〜5.5)を
// 前段(l:-4.5〜-0.9)・中段(-0.9〜2.7)・横廊下(2.7〜3.5)・奥段(3.5〜5.5)の4帯×
// 左中右3列で敷き詰める（面積合計=footprint全体・隙間なし）。
// 玄関→玄関ホール→中央縦廊下→横廊下→奥3部屋という動線がT字になる。
export const BASE_VIEW_ROOMS = [
  { key: "training", w: 6.5, l: -2.7, hw: 1.5, hl: 1.8, floorTint: "#dcefd5" },  // 前段左
  { key: "mechanic", w: 6.5, l: 0.9, hw: 1.5, hl: 1.8, floorTint: "#f2e7c6" },   // 中段左
  { key: "hall", w: 9.5, l: -2.7, hw: 1.5, hl: 1.8, floorTint: "#cbb896" },      // 玄関ホール
  { key: "corridor", w: 9.5, l: 0.9, hw: 1.5, hl: 1.8, floorTint: "#cbb896" },   // 中央縦廊下
  { key: "medical", w: 12.5, l: -2.7, hw: 1.5, hl: 1.8, floorTint: "#dbe8f8" },  // 前段右
  { key: "scout", w: 12.5, l: 0.9, hw: 1.5, hl: 1.8, floorTint: "#ecdff8" },     // 中段右
  { key: "cross", w: 9.5, l: 3.1, hw: 4.5, hl: 0.4, floorTint: "#cbb896" },      // 横廊下（全幅）
  { key: "diner", w: 6.5, l: 4.5, hw: 1.5, hl: 1.0, floorTint: "#f7e3c8" },      // 奥段左：食堂
  { key: "locker", w: 9.5, l: 4.5, hw: 1.5, hl: 1.0, floorTint: "#e2dccc" },     // 奥段中：ロッカー
  { key: "trophy", w: 12.5, l: 4.5, hw: 1.5, hl: 1.0, floorTint: "#f4ecd2" },    // 奥段右：トロフィー
];

// 部屋を隔てる壁（間仕切り）の線分。廊下と各持ち場を隔てる壁(w=8/w=10.5)には、対応する
// 持ち場ごとに出入り口の隙間を開けてあるため、1本の壁線が複数のセグメントに分かれている
// （隙間の区間には壁を描かない＝そこが扉）。training/mechanic間・medical/scout間・
// 納戸2部屋の間は単純な1本の間仕切り（扉なし＝廊下側からのみ出入りする部屋どうしの区切り）。
// 外壁（backFacePairが選ぶ2面＝w=5の辺とl=4.5の辺）とは異なる位置になるため重ならない。
// 第20弾: T字廊下の壁。縦壁(w=8/w=11)は各部屋の扉の区間だけ開けてあり、
// 横廊下(l:2.7〜3.5)へは中央縦廊下から壁なしで繋がる（w8〜11のl=2.7に壁を描かない）。
// 奥3部屋の扉は横廊下側の壁(l=3.5)に各部屋1つずつ開けてある。
export const BASE_VIEW_PARTITIONS = [
  // 縦壁 w=8（左列との境）。training扉(l:-3.3〜-2.1)・mechanic扉(l:0.3〜1.5)
  { w1: 8, l1: -4.5, w2: 8, l2: -3.3 },
  { w1: 8, l1: -2.1, w2: 8, l2: 0.3 },
  { w1: 8, l1: 1.5, w2: 8, l2: 2.7 },
  // 縦壁 w=11（右列との境）。medical扉(l:-3.3〜-2.1)・scout扉(l:0.3〜1.5)
  { w1: 11, l1: -4.5, w2: 11, l2: -3.3 },
  { w1: 11, l1: -2.1, w2: 11, l2: 0.3 },
  { w1: 11, l1: 1.5, w2: 11, l2: 2.7 },
  // 前段/中段の境（training|mechanic・medical|scout。扉なし＝廊下側からのみ出入り）
  { w1: 5, l1: -0.9, w2: 8, l2: -0.9 },
  { w1: 11, l1: -0.9, w2: 14, l2: -0.9 },
  // 中段/横廊下の境（mechanic・scout側のみ。中央w8〜11は開放＝縦廊下と横廊下の接続）
  { w1: 5, l1: 2.7, w2: 8, l2: 2.7 },
  { w1: 11, l1: 2.7, w2: 14, l2: 2.7 },
  // 横廊下/奥段の境(l=3.5)。食堂扉(w:5.9〜7.1)・ロッカー扉(w:8.9〜10.1)・トロフィー扉(w:11.9〜13.1)
  { w1: 5, l1: 3.5, w2: 5.9, l2: 3.5 },
  { w1: 7.1, l1: 3.5, w2: 8.9, l2: 3.5 },
  { w1: 10.1, l1: 3.5, w2: 11.9, l2: 3.5 },
  { w1: 13.1, l1: 3.5, w2: 14, l2: 3.5 },
  // 奥3部屋どうしの間仕切り（扉なし）
  { w1: 8, l1: 3.5, w2: 8, l2: 5.5 },
  { w1: 11, l1: 3.5, w2: 11, l2: 5.5 },
];

// 間仕切り壁の高さ（外壁 wallHeight:40 より低い＝上から中が見渡せる普通の間取りらしさを出す）。
export const BASE_VIEW_PARTITION_HEIGHT = 16;

// 第20弾: 条件解禁の奥3部屋。解禁前は納戸の見た目（st_emptyの段ボールセット）で存在し、
// 条件を満たすと部屋の什器（BASE_VIEW_FIXTURESのroom=diner/locker/trophy）に置き換わる。
// 解禁判定はdomain/season/baseViewLayout.jsのroomUnlocks(g)（食堂=スタッフ2人以上／
// ロッカールーム=所属8人以上／トロフィールーム=初タイトル）。
export const BASE_VIEW_LOCKED_ROOMS = [
  { key: "diner-locked", room: "diner", label: "納戸", w: 6.5, l: 4.55, kind: "empty" },
  { key: "locker-locked", room: "locker", label: "納戸", w: 9.5, l: 4.55, kind: "empty" },
  { key: "trophy-locked", room: "trophy", label: "納戸", w: 12.5, l: 4.55, kind: "empty" },
];

// Wave E-3：什器を施設Lvに応じて段階的に増やす。ユーザー要望「E-3の設計」（DEVLOG参照）に
// 基づき、旧`BASE_VIEW_CLUTTER`（Wave F-2 redo 追補3で意匠を作り直し済み）を土台に
// `minLevel`を振り直し、各部屋へ新規什器を追加した（`git mv`で`Clutter.jsx`→
// `Fixtures.jsx`へ改称）。`minLevel`は`domain/season/baseViewLayout.jsのbuildingLevels(g)`
// が返す当該部屋のLv（training/mechanic/medical/scout）以下なら表示する
// （`components/base/BaseView.jsx`側でフィルタ）。corridorはどの`buildingLevels`キーとも
// 対応しないため、常時表示（minLevel:0のまま）。
// 「椅子だけはLv0から常設」（ユーザー合意①A・E-3設計図参照）：選手の「座る」作業位置は
// `domain/season/riderActivity.js`の`workSpotFor()`が椅子の有無で決めており、椅子をLv依存に
// すると拠点画面の`ACTIVITY_CTX`（静的に一度だけ組み立てる）をゲーム状態依存にする必要が
// 生じ、Wave F-3aの純関数設計に波及するため。
// 座標は什器・バッジ位置（w5,l4.5）・出入り口の隙間(BASE_VIEW_PARTITIONS)・スタッフ
// (BASE_VIEW_STAFF)のいずれとも十分離してある（Node単体テストで機械的に検算）。
// 第20弾: T字廊下の間取りに合わせて全件を再配置。**選手の動線（routeToStation：
// 玄関(9.5,-5.3)→縦廊下(w=9.5)→扉→持ち場）と交差しない位置**に置くこと。
// 動線と什器の干渉はtools/verify_baseview.mjsが機械的に検算する。
export const BASE_VIEW_FIXTURES = [
  // トレーニング室(w5〜8, l-4.5〜-0.9)：Lv1 ダンベル／Lv2 給水台／Lv3 増設ローラー／
  // Lv4 大型ファン／Lv5 増設ローラー2台目+モニター
  { key: "training-weights", room: "training", kind: "dumbbells", w: 5.6, l: -3.9, minLevel: 1 },
  { key: "training-water", room: "training", kind: "waterTable", w: 5.6, l: -1.4, minLevel: 2 },
  { key: "training-roller2", room: "training", kind: "rollerUnit", w: 7.4, l: -3.9, minLevel: 3 },
  { key: "training-fan", room: "training", kind: "fan", w: 5.4, l: -2.6, minLevel: 4 },
  { key: "training-roller3", room: "training", kind: "rollerUnit", w: 7.4, l: -1.5, minLevel: 5 },
  { key: "training-monitor", room: "training", kind: "monitor", w: 5.4, l: -4.15, minLevel: 5 },
  // メカニック室(w5〜8, l-0.9〜2.7)：Lv1 工具箱／Lv2 予備の車輪／Lv3 パーツ棚／
  // Lv4 2台目の作業スタンド／Lv5 ホイール組み台
  { key: "mechanic-crate", room: "mechanic", kind: "toolbox", w: 5.6, l: -0.3, minLevel: 1 },
  { key: "mechanic-wheels", room: "mechanic", kind: "wheelsLeaning", w: 5.5, l: 1.1, minLevel: 2 },
  { key: "mechanic-shelf", room: "mechanic", kind: "partsShelf", w: 6.6, l: 2.35, minLevel: 3 },
  { key: "mechanic-stand2", room: "mechanic", kind: "workbench2", w: 7.6, l: -0.35, minLevel: 4 },
  { key: "mechanic-wheelbuild", room: "mechanic", kind: "wheelBuildStand", w: 5.5, l: 2.2, minLevel: 5 },
  // メディカル室(w11〜14, l-4.5〜-0.9)：椅子は常設／Lv1 薬品棚／Lv2 処置ワゴン／Lv3 2台目のベッド
  { key: "medical-chair", room: "medical", kind: "chair", w: 11.6, l: -3.9, minLevel: 0 },
  { key: "medical-cabinet", room: "medical", kind: "cabinet", w: 13.6, l: -1.5, minLevel: 1 },
  { key: "medical-cart", room: "medical", kind: "medCart", w: 11.5, l: -1.3, minLevel: 2 },
  { key: "medical-bed2", room: "medical", kind: "bed2", w: 13.6, l: -3.9, minLevel: 3 },
  // スカウト室(w11〜14, l-0.9〜2.7)：椅子は常設／Lv1 選手ファイル／Lv2 ホワイトボード／Lv3 資料棚
  { key: "scout-chair", room: "scout", kind: "chair", w: 13.0, l: 0.6, minLevel: 0 },
  { key: "scout-folders", room: "scout", kind: "folders", w: 11.4, l: 2.4, minLevel: 1 },
  { key: "scout-whiteboard", room: "scout", kind: "whiteboard", w: 13.5, l: 2.4, minLevel: 2 },
  { key: "scout-shelf", room: "scout", kind: "archiveShelf", w: 13.6, l: -0.3, minLevel: 3 },
  // 玄関ホール：靴箱（旧・廊下配置(9.5,-2.8)は縦廊下の動線の真上で選手が貫通していた）＋
  // Kシートの受付カウンター・自立コルクボード・雑誌ラック（待合の趣）
  { key: "hall-shoerack", room: "hall", kind: "shoeRack", w: 8.5, l: -4.1, minLevel: 0 },
  { key: "hall-reception", room: "hall", kind: "receptionCounter", w: 10.6, l: -1.8, minLevel: 0 },
  { key: "hall-corkboard", room: "hall", kind: "corkboardStand", w: 8.5, l: -1.6, minLevel: 0 },
  { key: "hall-magazines", room: "hall", kind: "magazineRack", w: 10.6, l: -4.0, minLevel: 0 },
  // スカウト室の置き時計（Kシート）
  { key: "scout-clock", room: "scout", kind: "deskClock", w: 12.9, l: 2.45, minLevel: 0 },
  // --- 条件解禁の奥3部屋（J/Kシートの専用什器。解禁前はBaseView側で
  //     このグループごと非表示にし、st_emptyの納戸を描く） ---
  // 食堂：テーブルセット＋配膳カウンター＋メニュー掲示のコルクボード（立てかけ）
  { key: "diner-table", room: "diner", kind: "cafeteriaTable", w: 6.0, l: 4.3, minLevel: 0 },
  { key: "diner-counter", room: "diner", kind: "cateringCounter", w: 7.2, l: 4.95, minLevel: 0 },
  { key: "diner-menu", room: "diner", kind: "corkboardLean", w: 5.5, l: 5.0, minLevel: 0 },
  // ロッカールーム：ロッカー列＋コート掛け
  { key: "locker-row", room: "locker", kind: "lockerRow", w: 9.6, l: 4.95, minLevel: 0 },
  { key: "locker-coats", room: "locker", kind: "coatRack", w: 8.7, l: 4.0, minLevel: 0 },
  // トロフィールーム：トロフィーケース＋観葉植物
  { key: "trophy-case", room: "trophy", kind: "trophyCase", w: 12.4, l: 4.95, minLevel: 0 },
  { key: "trophy-plant", room: "trophy", kind: "pottedPlant", w: 13.5, l: 4.3, minLevel: 0 },
];

// Wave F-3c：常駐スタッフ（動かない人）。対応するスタッフを雇っていれば
// （g.staff[staffKey] > 0）その持ち場に立つ。選手が誰も来ていない時間帯でも部屋が無人に
// ならず、拠点が「人の居る場所」に見える。選手のジャージ色とは異なる配色にして、
// 選手（走る人）とスタッフ（迎える人）が絵として区別できるようにしてある。
// flipは向き：その部屋の什器のほうを向くようscreen x座標を比較して決めてある。
export const BASE_VIEW_STAFF = [
  { key: "trainer", staffKey: "trainer", room: "training", label: "トレーナー",
    w: 5.5, l: -3.0, color: "#2f8f5c", cap: "#e9e2d4", flip: false },
  { key: "doctor", staffKey: "doctor", room: "medical", label: "ドクター",
    w: 13.1, l: -2.3, color: "#eef4f6", cap: "#c7d3d8", flip: true },
  { key: "scout", staffKey: "scout", room: "scout", label: "スカウト",
    w: 11.7, l: 1.5, color: "#c98bf0", cap: "#5c4a68", flip: false },
  { key: "manager", staffKey: "manager", room: "hall", label: "マネージャー",
    w: 10.4, l: -3.3, color: "#3a4250", cap: "#c9a23c", flip: true },
];

// 練習コース（第20弾・案A「湖畔L字サーキット」）。楕円をやめ、L字型（6角・凹1つ）の
// 周回にした。コースの内側（L字の懐）に湖（pond3）と芝生広場・ジムを抱え込む構図。
// domain/season/baseViewLayout.jsのloopPointAt/loopRibbonPts等（丸め角付き任意多角形）で描く。
// クラブハウス(w:5〜14)・前庭舗装(w:3.6〜)とは重ならない（コースはw≤2.2+帯0.42）。
export const BASE_VIEW_LOOP = {
  points: [
    { w: -6.5, l: -5.5 },  // 左手前（ホームストレート西端）
    { w: -6.5, l: 6.5 },   // 左奥
    { w: 2.2, l: 6.5 },    // 右奥（湖の裏）
    { w: 2.2, l: 2.0 },    // 湖の手前で内側へ折れる
    { w: -2.0, l: 2.0 },   // 凹み角（L字の内角）
    { w: -2.0, l: -5.5 },  // 右手前（ラック側ストレート南端）
  ],
  cornerR: 1.1, trackHalfWidth: 0.42,
};

// クラブハウスの入口前の舗装アプローチ（world座標のw/l範囲）。クラブハウスfootprint
// （w:4.5〜13.5〜手前に張り出す形）とコースの間の「敷地の通り道」を1枚の大きな
// ポリゴンとして描く。
// 第19弾補修: lMinを-4.8→-6.4へ拡張（チームカーの駐車場所。車が芝との境界をまたいで
// 沈んで見える問題への対応。ユーザー提案「舗装自体を広げてみては」）。
export const BASE_VIEW_PLAZA = { wMin: 3.6, wMax: 14.5, lMin: -6.4, lMax: 5.8 };

// 芝の装飾（草むら等）を散らす範囲。市松塗りは廃止したので、ここは「点在させる装飾の範囲」。
// Wave F-1でこの矩形を「所有敷地（陸地）」の外形としても兼用する（下記BASE_VIEW_PROPS
// コメント・BaseView.jsx参照）。敷地の外は海（palette.sky）になる。
export const BASE_VIEW_GROUND = { wMin: -9, wMax: 16, lMin: -8, lMax: 9, scatterStep: 1.6 };

// 季節ごとの配色（domain/season/baseViewLayout.jsのseasonOf(month)のキーと対応）。
// grassは一様な1色（Wave Dの明暗交互＝市松模様を廃止）、grassPatchは点在させる濃淡用。
export const BASE_VIEW_SEASON_PALETTE = {
  spring: { sky: "#8fc9e8", grass: "#7cc45c", grassPatch: "#6fb551", plaza: "#cfc6ad", plazaEdge: "#b3aa92", treeLeaf: "#f2a8c6", treeMid: "#e394b4", treeDark: "#c97a9b", snow: null },
  summer: { sky: "#79bfe0", grass: "#57ab45", grassPatch: "#4d9c3d", plaza: "#c8bfa6", plazaEdge: "#aca48c", treeLeaf: "#57b44a", treeMid: "#43963a", treeDark: "#33762d", snow: null },
  autumn: { sky: "#a8c8dc", grass: "#b8924c", grassPatch: "#a88443", plaza: "#c6b99b", plazaEdge: "#aa9e83", treeLeaf: "#e0873a", treeMid: "#c96f2a", treeDark: "#a5551d", snow: null },
  winter: { sky: "#c3d6e4", grass: "#e8eef0", grassPatch: "#d8e2e6", plaza: "#d2d8d8", plazaEdge: "#b9c1c2", treeLeaf: "#dfe8ea", treeMid: "#c2ced2", treeDark: "#9aa8ad", snow: "#f7fbff" },
};

// 小物の固定配置。木はコース周りに、車・自転車ラックはクラブハウスの入口前アプローチに置く
// （ローラー等のトレーニング機材は屋内の持ち場＝BASE_VIEW_STATIONSの"training"に含む）。
export const BASE_VIEW_PROPS = {
  // 敷地(BASE_VIEW_GROUND: l>=-8)の内側・奥辺沿いに並べる。旧配置(l:-8.5〜-12.5)は
  // 敷地外＝海の上に浮いて見えていた（2026-08ユーザー指摘「桜がありえない場所に生えている」）。
  backTrees: [
    { w: -8.0, l: -7.2 }, { w: -5.5, l: -7.5 }, { w: -3.0, l: -7.0 },
    { w: -0.5, l: -7.6 }, { w: 2.0, l: -7.2 }, { w: -8.6, l: -6.2 },
  ],
  // 第20弾: L字コースの外周・インフィールド・敷地奥の縁に沿って並木を増量（賑わい）。
  // いずれもコース帯・動線・水路・装飾から機械検証（tools/verify_baseview.mjs）で
  // クリアランスを取ってある。
  trees: [
    { w: -7.6, l: -2.0 }, { w: -7.5, l: 4.5 },              // コース左外周
    { w: -4.5, l: 7.6 }, { w: -0.5, l: 7.8 }, { w: 3.0, l: 7.2 }, // 敷地奥の縁
    { w: -4.3, l: 0.5 }, { w: -4.6, l: 4.6 },               // インフィールド
    { w: 1.5, l: -1.5 }, { w: 0.3, l: -3.1 },               // 前庭側の芝
    { w: 4.5, l: 5.5 },                                      // クラブハウス脇
    { w: -2.1, l: 7.1 },  // 小川の陸側の端の手前（切り口を樹冠で隠す。canalより後に描かれる位置）
  ],
  benches: [
    { w: 4.3, l: 2.4 }, { w: 4.2, l: 3.6 },                 // 前庭（既存）
    { w: -4.8, l: -6.6 }, { w: -1.6, l: -6.6 },             // ホームストレート観戦ベンチ
  ],
  lamps: [{ w: 3.9, l: 0.2 }, { w: 0.5, l: -6.6 }, { w: -7.8, l: 0.5 }],
  // 第20弾: 建物の奥行き拡張(l:-4.5〜)で旧位置(5.2,-4.2)が屋内に入ってしまったため
  // 玄関前の舗装(l<-4.5)へ移動。
  bikeRack: { w: 5.2, l: -5.4 },
  // 第20弾: 玄関ルート(ラック→玄関前)とのクリアランス確保のため少し外へ。
  teamCar: { w: 11.0, l: -6.0 },
  // 第20弾: 小川（Gシートのタイルを合成した水路スプライト・約55%長へ短縮版）。
  // コース奥の芝帯（コース上辺l=6.5と敷地の縁lMax=9の間）を横切り、上端が縁を
  // 少し越えて海へ「流れ出る」形。切りっぱなしの端が芝の途中で終わると池が
  // 見切れているように読める（2026-08ユーザー指摘）ため、海側の端は縁越え・
  // 陸側の端は手前の木（trees末尾の1本）で隠す。旧・左奥の角配置は、帯（水面約3
  // ユニット）が角の狭い陸地に視覚的に収まらず半分浮いて見えたため放棄した。
  // 実寸（スプライト画素の逆算）: アンカー基準で水面 dw -1.22..-0.37 / dl -0.18..+1.76。
  canal: { w: -1.9, l: 7.49 },
};

// Wave F-1: 敷地の見た目だけを変える購入枠（data/items.jsのEQUIPS.grounds、g.equip.grounds
// のLv0〜5）で段階的に解禁される屋外装飾のカタログ。既存のBASE_VIEW_PROPSと違い、
// 各項目にminLevelを持たせゲーム状態（g）に応じてBaseView側でフィルタする
// （`components/base/BaseView.jsx`参照）。位置はコース・クラブハウスのプラザ・既存の
// 小物のいずれとも重ならないよう選んである。
// 第20弾: L字コースに合わせて再配置。湖はコース内側（L字の懐）＝「湖畔サーキット」の主役。
// ジムはインフィールドの芝生広場、アーチは「コース⇔駐輪ラック」の乗り入れ動線上のゲート
// （選手がアーチをくぐって出入りする）、噴水は玄関前広場、生け垣は前庭の縁取り。
// 池のアンカーは接地点（下端中央）で、Lv5のpond3はそこから約±1.0ユニットの菱形に広がる。
// 旧位置(l:4.3)ではpond3の上縁がコース帯（l=6.5の直線・帯半幅0.42）に乗り上げていた
// （2026-08ユーザー指摘「豪華な池とコースがかぶっている」。実測: 中心線まで0.22）。
export const BASE_VIEW_GROUNDS_DECOR = [
  { key: "pond", minLevel: 1, kind: "pond", w: -0.3, l: 3.55 },
  { key: "hedge", minLevel: 2, kind: "hedge", w: 13.9, l: -5.9 },
  { key: "gym", minLevel: 3, kind: "gym", w: -4.3, l: -2.8 },
  { key: "arch", minLevel: 4, kind: "arch", w: 2.6, l: -5.4 },
  { key: "fountain", minLevel: 5, kind: "fountain", w: 12.2, l: -5.4 },
];
