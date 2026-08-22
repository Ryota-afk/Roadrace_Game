# 第19弾：拠点のドット絵化（什器・プロップ33種）

**状態：設計合意済み・実装待ち**。次のアクション4番（拠点のオブジェクト類のドット絵化）に着手する。

## 着手時の実測（A〜F分類の棚卸し）

ユーザー提示の分類A〜Fを現行コードと突き合わせた結果：

- **A. 人物＝完了済み**。`sprites/pixelPerson.jsx`（16×36 legend・歩行4コマ/立ち/座り・
  `<image>`ラスタ化済み）がBaseViewで使用中。
- **B. 自転車選手＝完了済み**（通常姿勢。ダンシング/スプリントの改善は11番として凍結中・
  本弾のスコープ外）。`sprites/pixelBike.jsx`がローラー台上・レース両方で使用中。
- **旧`base/Person.jsx`（手続き型ベクター人物・178行）はどこからも参照されない死にコード**。
  本弾の後始末でarchive退避する（§5）。
- **C. 主要什器5種**＝`base/Station.jsx`：Roller/Workbench/Medical/Desk/EmptyRoomの5関数。手続きSVG。
- **D. 二次什器18種**＝`base/Fixtures.jsx`のFIXTURE_RENDER：dumbbells・waterTable・rollerUnit・
  fan・monitor・wheelsLeaning・toolbox・partsShelf・workbench2・wheelBuildStand・cabinet・
  medCart・bed2・chair・whiteboard・folders・archiveShelf・shoeRack。手続きSVG（isoBox積み）。
- **E. 屋外プロップ10種**＝`base/Props.jsx`：tree・bench・lamp・bikeRack・teamCar＋
  装飾5種（pond・hedge・gym・arch・fountain）。手続きSVG。treeのみ季節パレット
  （`palette.treeDark/treeMid/treeLeaf`・`palette.snow`）を受ける。
- **F. 建物・地面・コース**＝`Room/Ground/Track.jsx`。面が大きくスプライトと性質が違うため
  **別弾送り（ユーザー合意）**。

**残る実作業＝C+D+E：33種**。

## 確定判断（ユーザー合意・2026-08）

1. **試作先行**：まずClaudeが代表4点のlegend行列を手書きで試作し、実際の拠点画面のスクショで
   ユーザーが合否判定（§8の作法）。合格なら同方式で残りを量産、不合格なら参考画像方式
   （CLAUDE.md §6・PixelBikeと同じPillow抽出パイプライン）へ切替＝ユーザーに参考画像を依頼して
   一時中断。※AI新規描画は選手モデル（複雑な人体）で失敗済みだが、什器は単純な人工物かつ
   小サイズなので、被害が4点で止まる形で一度だけ試す価値がある、という判断。
2. **スコープはC+D+Eの33種全部**（Fは別弾）。部屋ごと・カテゴリごとに小刻みにcommitする。
3. **視点はアイソメ3/4見下ろし**：什器・プロップは現行isoBox什器と同じ斜め見下ろしの向きで
   ドットを打つ（カイロソフトの家具と同じ作法）。人物・自転車は真横図のまま＝この混在も
   カイロソフト作品で実証済みの見せ方。

## 詳細設計

### 基盤（試作と同時に作る）

- **新ファイル `src/components/sprites/pixelFixtures.jsx`**（C+D屋内23種のlegendデータ＋描画）と
  **`src/components/sprites/pixelProps.jsx`**（E屋外10種）。§5のファイル肥大化防止のため
  最初から2分割（33種×20〜30行のlegendは1ファイルだと千行超になる）。
- 共通描画ヘルパー `PixelFixture({ x, y, rows, legend, cacheKey, px })`：
  - 既存`rasterize.js`の`spriteImageUrl(rows, legend, cacheKey)`をそのまま使用
    （canvas1回焼き→`<image>`1ノード・キャッシュ済み。新規実装なし）。
  - アンカーは**足元中央**（PixelPersonと同じ）：`x=接地点中央, y=接地点`、
    `<image>`は`x=-originCol*px, y=-rows.length*px`で配置、`imageRendering: "pixelated"`。
  - `px`＝1マスの実寸（ワールド単位）。**PERSON_PX=0.49を基準**とし、試作で見た目の
    粒度が人物と揃うことを確認してから全種で固定する（PixelBike導入時の「粒度差が
    安っぽさの原因」の教訓）。
  - 各スプライトの下に既存と同じ影の楕円を敷く（浮いて見える問題の再発防止）。
- **配線の互換**：`fixtureItems(proj, list)`・`propItems(proj, props, palette)`・
  `Station({s, proj, selected, grade})`のシグネチャと、`data/baseViewBuildings.js`の
  配置データ（`BASE_VIEW_FIXTURES`の`w/l/minLevel`等）は**一切変えない**。各Node関数の
  中身だけを「接地点を計算→PixelFixtureを置く」に差し替える。奥行きソート（sortY）・
  minLevel解禁・部屋グレードの仕組みは無改修で生きる。
- **季節パレット（treeなど）**：legendの葉色文字をpaletteの色へ動的にマップし、
  cacheKeyにパレット識別子を含める（`tree-${palette.key}`のような形）。雪
  （`palette.snow`）は雪あり差分のrowsをもう1フレーム持つ。
- **ローラー台の乗車関係**：ローラー台スプライトは台だけを描き、その上のPixelBike
  （既存の乗車表示）の位置関係を現状維持する。`workSpotFor()`の座席・作業位置も無改修。

### 試作4点（代表4形状ファミリー）

| # | 対象 | 分類 | 選定理由 |
|---|---|---|---|
| 1 | rollerUnit（ローラー台） | D | 機械もの・上にPixelBikeが乗る位置関係の検証を兼ねる |
| 2 | partsShelf（パーツ棚） | D | 箱・棚もの（cabinet/archiveShelf等と同族の量産原型） |
| 3 | tree（木） | E | 有機物＋季節パレット4種＋雪差分の仕組み検証 |
| 4 | teamCar（チームカー） | E | 大きめの人工物（gym/fountain等の大物の原型） |

試作は**実際の拠点画面に組み込んだスクショ**（標準ズームと寄り、季節はtreeのため夏と冬の2枚）
で提示する。モック単体画像だけでの判定はしない。

### 量産の順序（試作合格後）

1. **C：主要什器5種**（Station.jsx置換）— ローラー本体・作業台・診察ベッド・スカウトデスク・
   空き部屋什器。部屋の顔なので最初に。
2. **D：二次什器 残り17種**（Fixtures.jsx置換）— 部屋ごとに training→mechanic→medical→
   scout→corridor の順でcommit。
3. **E：屋外 残り8種**（Props.jsx置換）— bench・lamp・bikeRack・pond・hedge・gym・arch・fountain。
4. **後始末**：`base/Person.jsx`をarchiveへ`git mv`。isoBox等の手続きヘルパーで未参照に
   なったものを整理（`isoBoxFaces`は接地点計算で使い続ける可能性あり＝残す判断も可）。

### 検証

- 各ステップでビルド＋Playwrightスクショ（新規ゲーム＝Lv0什器なし、
  localStorage注入の遊び込みセーブ＝全minLevel解禁、の両状態）。
- 季節4パレット＋雪でtree等の色が正しく変わることをスクショで確認。
- ノード数はrasterize化で減る方向（1什器=ポリゴン十数個→`<image>`1個）だが、
  初回ラスタライズの一拍を含めfpsの体感劣化がないことを一度確認。
- コンソールエラーなし・両ズームで`imageRendering: "pixelated"`が効いてぼやけないこと。

### 波及範囲の切り分け

- レース画面・スプリント演出は無改修（PixelBike/PixelPersonは既に完成形）。
- `data/baseViewBuildings.js`・`domain/season/baseViewLayout.js`・カメラ・吹き出し・
  部屋グレードは無改修。見た目の差し替えのみ。
- セーブデータに影響なし（描画だけの変更）。

## 実装対象（順序）

1. **試作**: PixelFixture基盤＋代表4点のlegend→拠点画面スクショ提示→**ユーザー合否判定（合意待ち）**
2. 合格→ **C**: 主要什器5種（Station.jsx置換・Playwright確認・commit）
3. **D**: 二次什器17種（部屋ごとにcommit）
4. **E**: 屋外8種（commit）
5. **後始末**: base/Person.jsx退避＋未参照ヘルパー整理
6. **最終検証**: ビルド＋Playwright（新規/遊び込み・季節4種＋雪・両ズーム）
7. **完了処理**: DEVLOG §50追記・commit・push
   ※不合格の場合：参考画像方式（CLAUDE.md §6）へ切替を提案し、画像が揃うまで弾を中断する。
