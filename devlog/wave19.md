# 第19弾：拠点のドット絵化（什器・プロップ33種＋池の段階成長）

**状態：完了（2026-08）**。実施結果は末尾の「実施記録」参照。設計時の想定から
大きく変わった点：①手書きlegend方式は試作止まり＝**参考画像抽出方式へ全面切替**
（pixelFixtures/pixelProps 2ファイル案も廃し、抽出データ一括の`pixelObjectData.js`＋
共通描画`pixelObject.jsx`に）、②F分類のうち屋外装飾5種も本弾で実施、③池は
「敷地整備Lvで育つ3段階」に拡張（モジュラータイル案は破棄し完成品H/Iから抽出）。

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

---

## 実施記録（2026-08・完了）

### 方式の転換：手書きlegend → 参考画像抽出

試作4点（手書きlegend）はユーザー判定「修正条件付きで続行」どまり。その後ユーザーが
参考画像シート（6〜33番＋屋外）を提供し、同条件で比較した結果**抽出方式が明確に上**
だったため全面切替。シートは当初チャットアップロードで受け取ったが**ファイルが保存
されない事故が2回**発生（さらに保存済み2枚がサーバーから消失）したため、
**`reference/`ディレクトリ（リポジトリ直接コミット）での受け渡しに一本化**した。
GitHub再アップロードの再圧縮ノイズは最大チャンネル差23で、量子化を通すため影響なし。

### 抽出パイプライン（scratchpad/w19/extract2.py）

crop → 背景候補`(全ch≥225)or(mn≥190,diff≤26)or(mn≥182,diff≤22)`を**外周からflood-fill**
（物体内部の白はアウトラインに囲まれ残る）→ 8近傍連結成分で最大の8%未満を除去＋
主成分bbox下端より下の成分（ラベル文字）をサイズ不問で除去 → タイトトリム →
彩度1.15/コントラスト1.06 → BOX縮小 → MEDIANCUT量子化（既定13色）→ despeckle →
`{key, rows, legend}`。1セル=0.5px（OBJ_PX、PixelPerson 0.49と粒度統一）。
`to_game2.mjs`が後段で全legendへHSVブースト（彩度×1.30・明度0.5支点×1.05）を適用。

### 品質サイクルで直した不具合（ユーザー指摘起点）

- **見切れ・切り抜きミス**：目視をやめ機械検査`audit.py`（マスク再現→残存セルが
  crop縁1px以内なら辺+座標で報告）を導入。初回28種中14件→crop修正3周でゼロ。
  後日audit.pyが**古い複製JOBSを見ていてF分類を未検査**だったバグを発見・
  extract2.pyから直接importする形へ修正→さらに5件（池の右端102セル・ジムのポール
  上端等）を検出しゼロ化。
- **木の幹が緑**：量子化13色が全て樹冠の緑に割かれ幹の茶が吸収されていた。幹領域
  （最下部の'a'優勢行ブロック）検出→専用茶2色(w/x)へ再塗装。季節再マップも
  「上68%行」→「幹以外全行」へ修正（冬春に樹冠下端だけ夏色が残る不整合の解消）。
- **全体の色褪せ**：BOX縮小＋量子化が色を平均へ寄せるため。上記HSVブーストで解消。
  QCシートが後処理前データを表示していた罠も`qc_game.mjs`（ゲーム実データ読み）で解消。
- **チームカー**：手書き版は「直方体すぎ」で破棄→E.pngの単体カーから抽出（96セル）。
  ついでにWave F-1以来クラブハウス壁裏に隠れていた配置バグを発見し(6.4,-4.9)へ移動。

### 池の段階成長（G→H/I）

モジュラータイル案（Gシート：中央/直線端/外角/内角＋装飾中央4種）は、タイルごとの
描画サイズ・縦横比のブレで実装検証の結果ユーザー判断で破棄（アフィン3点写像で
噛み合わせまでは到達したが「モジュールとして繋ぐには無理がある」）。**完成品2枚
（H=中型豪華池・I=巨大豪華池）を抽出**する方式へ転換：

- 敷地整備Lv1〜2＝pond（F-34・96セル）→ Lv3〜4＝pond2（H-48・124セル・20色）→
  Lv5＝pond3（I-49・208セル・28色。東屋・橋・滝・鯉の判別を保つため色数を拡大）。
- 切替は`BaseView.jsx`の解禁フィルタ直後で`kind`を差し替える1行。位置・解禁Lv・
  データ構造は不変＝セーブ互換に影響なし。

### 最終形の構成

- `sprites/pixelObjectData.js`：全36エントリ（C5+D18+E5+装飾5+池2＋treeSnow）。生成元は
  scratchpad/w19の extract2.py→to_game2.mjs（再現はreference/のシートから可能）。
- `sprites/pixelObject.jsx`：共通描画`pixelObjectNode`（影楕円は幅から自動・shadowRx:0で
  無効化可）＋`treeSpriteNode`（季節文字t/u/v/V動的legend＋冠雪treeSnow）。
- `Station.jsx`/`Fixtures.jsx`/`Props.jsx`は「接地点にスプライトを置くだけ」へ縮退
  （手続きSVG約500行を削除。isoBox/shadowDiamondヘルパーも撤去）。
- 旧`base/Person.jsx`→`archive/baseViewPerson_v18.jsx`へgit mv。
- 最終検証：ビルド＋Playwright4季節（春=桜・夏=緑・秋=橙・冬=冠雪、いずれも幹は茶）
  エラーゼロ。全35抽出の縁接触検査ゼロ。
