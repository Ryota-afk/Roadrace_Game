# DEVLOG — ロードレース・プロチーム運営（開発引き継ぎ）

新しいチャットはこのファイルを最初に読めば、巨大な本体ファイルを全読みしなくても文脈を安く復元できます。
**使い方**：新チャット冒頭で「`DEVLOG.md` を読んで続きから」と指示 → 必要な箇所だけ本体を部分読みする。

---

## 0. これは何か

> **⚠ 作業ブランチの注意（2026-07・重要）**：正しい作業ブランチは **`claude/roadrace-v9-continuation-imtukw`**。
> このセッション以降の全作業（モジュール分割・各機能・バランス調整）はここに積まれている。
> タスク指定で `claude/roadrace-modularization-plan-ris7zv` が designated branch として渡ることがあるが、
> **それは誤り**：ris7zv はモジュール分割以前の古いプロトタイプ（60コミット以上前）を指しており、
> そこへ積むと現行コードが無い土台に孤立コミットが載って壊れる。ris7zv 指定は無視し、
> v9-continuation で作業・push すること（過去セッションでユーザー承認済みの運用）。

単一HTMLファイルで動く React + SVG のロードレース・ゲーム。2モード構成：
- **シーズンモード**：6名ロースターのチーム運営（経営）
- **マイライフモード**：一人の選手のキャリア育成（人生）

自転車ロードレースのチーム戦術（エース／アシスト、逃げ、集団、山岳など）をSVGで可視化しつつ、
育成・血統・世界ランキングなどのメタ要素を積み上げてきた。

---

## 1. ファイル構成と開発フロー（重要 / v12モジュール移行後）
**2026-07 に単一HTMLからモジュール分割＋Viteビルドへ移行した（経緯は §8）。真実の源は `src/` に移り、`roadrace_v12.html`/`.jsx` は廃止。**

- **`src/`** … 唯一の編集対象・真実の源
  - `src/main.jsx` … 本体（`App()`の状態・ハンドラ＋画面ディスパッチの薄い配線。2026-07に死コメント477行を除去）
  - `src/index.html` … Viteの入口HTMLテンプレート（薄い雛形）
  - `src/data/` … 静的データ定数のみ（ロジック禁止・JSX/domain import禁止）。`abilities/breeding/course/items/progression/theme` に加え、
    2026-07(§Step3)で `economy.js`(経済・スタッフ・天候)/`events.js`(選択肢イベント)/`directives.js`(監督指示・中期目標)/
    `gear.js`(マイライフ装備)を新設し、`support.js`から純データを移送。`progression.js`にも分類テーブル（種目/成長順/
    チーム関連）を追加。2026-07(§Step5)で `teams.js`（`RIVAL_TEAMS`/`MYLIFE_TEAMS`）も新設（循環import回避のため）
  - `src/view/` … 2026-07(§Step4)新設。文字列生成の純関数（JSX無し）。`flavor.js`(選手フレーバーテキスト)、
    `news.js`(ライバル動向・世界ニュース・優勝号外)
  - `src/domain/` … 2026-07(§Step5)新設。純粋なドメインロジック（生成器・計算関数、JSX無し）。
    `season/transfer.js`(移籍市場)・`season/roster.js`(ロースター/スカウト生成)・`season/sponsor.js`(スポンサー契約/中期目標)・
    `season/standings.js`(順位計算)・`shared/forecast.js`(下馬評)
  - `src/sim/` `src/breeding/` `src/world/` `src/state/` `src/components/` … Phase 1〜3で分割済み。
    2026-07(§Step6)で `state.js⇄breeding.js` の循環importを解消（`state.js`→`breeding.js`の一方向に整理）
  - `src/controllers/` … 2026-07(§Step7)新設。`main.jsx` App() のハンドラのうち、状態遷移が
    `(state, ...args) => newState` の形（setG/setMlへの薄い接続だけApp()に残す）のものを純関数として抽出。
    `season/transfer.js`(移籍・トレード)・`season/shop.js`(ショップ/スタッフ経済)・
    `season/roster.js`(日常のロースター運用)・`season/month.js`(月次更新・年度末処理)・
    `season/event.js`(選択肢イベント応答)・`season/result.js`(レース結果確定)・
    `mylife/shop.js`(マイライフのショップ・アイテム・私生活)・`mylife/month.js`(マイライフの月次アクション・
    年度末処理)・`mylife/result.js`(マイライフのレース結果確定)・`season/raceStart.js`(レース開始時の
    入力組み立て：ホームアドバンテージ・aceId解決・ステージ中日のsquad再構成)・`mylife/raceStart.js`
    (代表役割の判定・ラストレースmeta構築)。`startRace`等のuseRef連打防止ロック・setTimeout・
    updater内の変数密輸・updater内buildSim自体（v12でstale closureバグを実際に踏んだ箇所）は
    意図的に未着手のまま残す（詳細は§9 Step7第5弾参照）
  - `src/domain/mylife/` … 2026-07(§Step7第3弾)新設。`race.js`(mlGenRace＝マイライフの月次レース生成。
    複数箇所から参照される純粋なジェネレータのため`controllers/`ではなく`domain/`に配置)
  - `src/logic/support.js` … 表示ヘルパー＋残存ロジック（画面イベント効果適用・監督評価・配合表示・実績判定等）。
    data/view/domain層への移送で2574行→1615行に縮小。移送分は互換シム（`import`＋`export {}`）で再エクスポートして
    おり、main.jsx/screens/*.jsxの既存import文は変更不要（詳細は§9）
  - `src/screens/season/` `src/screens/mylife/` … 2026-07(§Step8)新設。`screens/season.jsx`（旧2038行）・
    `screens/mylife.jsx`（旧1980行）の巨大ディスパッチャを、それぞれ用途クラスタ単位で分割：
    season側は`intro.jsx`/`hub.jsx`(mainの5タブ)/`transferEvents.jsx`/`scheduleBoard.jsx`/`race.jsx`/
    `yearend.jsx`、mylife側は`create.jsx`/`hub.jsx`/`help.jsx`/`race.jsx`/`events.jsx`/`career.jsx`。
    `screens/season.jsx`・`screens/mylife.jsx`自体は委譲だけの27行dispatcherとして残存
- **`index.html`（リポジトリ直下）** … `npm run build` が生成する**自己完結の単一HTML成果物**（デプロイ用）。React/JSXはビルド時に変換・バンドル済みで**CDNもBabelも不要**。手で編集しない
- `package.json` / `vite.config.js` / `package-lock.json` … ビルド定義
- `dist/`, `node_modules/` … gitignore（追跡しない）
- `archive/` … 過去バージョンのアーカイブ（`roadrace_v5〜v11.*`＝分割前の単一ファイル版、`archive/design/`＝旧設計メモ）。src/から未参照・触らない
- `roadrace_v12_test.html` … （旧）検証ハーネス。**もう不要**（§2参照）。gitignore済み

### 編集→ビルド→コミット→push の手順
```bash
# 1) src/ を編集（対象モジュールだけ読めばよい＝トークン激減）

# 2) ビルド（index.html を再生成）。Node/npm 必須。初回のみ npm install
npm install          # 初回だけ
npm run build        # vite build && cp dist/index.html index.html

# 3) コミット（日本語メッセージ）。末尾に必ず以下のトレーラを付ける
#    Co-Authored-By: Claude ...
#    Claude-Session: https://claude.ai/code/session_...
git add -A            # src/ と生成された index.html を両方コミット
git commit -F - <<'EOF'
（日本語の要約タイトル）

（本文）
EOF

# 4) push（作業ブランチ）
git push -u origin claude/roadrace-v9-continuation-imtukw
```
- 作業ブランチ：**`claude/roadrace-v9-continuation-imtukw`**（default へ直push禁止）
- コミットメッセージは日本語。モデル識別子はリポジトリに書かない。
- **`index.html` は生成物**。src を直したら必ず `npm run build` してから両方コミット（＝新しい二重管理を作らない）。

---

## 2. 検証（Playwright）— ビルド成果物をそのままテスト
**移行でCDN依存が消えたため、vendor版React差し替えハックは不要になった。** `npm run build` が出す
`index.html` は自己完結（React/JSXバンドル済み・CDN/Babel不参照）なので、クラウド環境でも本物をそのまま開ける。

```bash
# 1) ビルド
npm run build

# 2) サーバ（リポジトリ直下を配信）
npx http-server -p 8844 -s -c-1 .   # ← run_in_background で起動。curlで200を待つ

# 3) Playwright（scratchpad に置く）
#    executablePath: /opt/pw-browsers/chromium-1194/chrome-linux/chrome  （args:['--no-sandbox']）
#    playwright本体は /opt/node22/lib/node_modules にある。scratchpad の node_modules に
#    シンボリックリンクを張ると import できる：
#      ln -sfn /opt/node22/lib/node_modules/playwright      node_modules/playwright
#      ln -sfn /opt/node22/lib/node_modules/playwright-core node_modules/playwright-core
#    favicon の 404 は無視してよい（[BABEL] deopt はもう出ない）。
```
テストのコツ：作戦ピッカーは**メイン画面**（「このレースに出場する」ボタンの上）にあるので、
作戦を選んでから出場する。controlled input は `page.fill` を使う（`inp.value=` はReactに効かない）。
旧 `roadrace_v12_test.html` ハーネスは不要（消してよい）。

---

## 3. アーキテクチャ（関数名で参照）
### レースsim（両モード共通）
- `simulateTicks(course, riders, fromTick, directive, noGroup)` … **レース全体を先に計算**（finishTimeまで）。
  RaceView は `posHist/energyHist/modeHist/...` の**再生専用**。`fromTick!==0` で途中再開できる（未使用だが存在）。
- `buildMyLifeSim(raceMeta, player, myTeamName, classIdx, difficultyId, dayTag, directiveKey, rival, year, rival2, teammates, tactic)`
- `canPull(en, segType)`（誰が牽引できるか）, `assignAIRoles`, `effAbilities`, `overall`, `newRider`, `mulberry`(seeded RNG), `pickRiderName`
- 役割 role：`ace/lead/sub/mountain/flat/breakaway`。draftモードは省エネ、pullは全消費。

### マイライフ状態
- `initMyLife()` / `mlCreateChar(type, background, master, partner)` / `mlGenRace(year, month, classIdx)`
- 月次：`mlAdvanceMonth`, `mlApplyMonthEffect(player, mode, ctx)`, レース確定は `mlRaceFinish` 相当の setMl ブロック（resultInfoを積む）
- セーブ：`ML_SAVE_FIELDS`（配列）、`saveMyLife/loadMyLife`。**playerはまるごと保存**されるので player.* は保存フィールド追加不要。
- 成長キャップ：`mlGrowthCap(year, player)` = min(140, 90 + (year-1)*2 + player.talentCap)。`bumpGrowthPow`, `GROWTHPOW_ORDER=["C","B","A","S"]`, `POW`
- 監督指示：`MANAGER_DIRECTIVES`（keyed, chec-fn付き）, `mlGenDirective`。**復元時はキーで引き直す**（JSONで関数が消えるため。既知バグ修正済み）
- 作戦：`ML_TACTICS`（balanced/wait/early/aggressive/**assist**）。`playerAssist`, `playerBreakaway`

### 配合・血統（v31〜v33で作り込み）
- `mlBreedBonus(parentA, parentB)` が全部返す：`nick/inbreed/plusValue/plusPer/abBonus/extraAbilities/subBonus/
  goldInherit/exclusive/archNotes/bakuhatsu/matingGrade/growthSteps/talentCap/danger/dangerLabel/healthMit/special`
  - **設計方針（厳守）**：爆発力・系統・特殊配合のボーナスは**初期能力に足さない**。伸びしろ（growthPow段数＋talentCap）＋称号＋金特に還元する。序盤インフレを避けるため。
  - `BREED_NICKS`（脚質相性）, `ARCH_BREED`（生き様の血）, `ML_SPECIAL_MATINGS`+`mlSpecialMating`（特殊配合）, `mlGradeColor`
  - 危険度：濃い血→稀に `glass`（ガラスの体）で誕生。親の iron/tough/高スタミナ＋血脈多様性で軽減。
- 系統レジストリ（プレイ跨ぎ／localStorage `roadrace_v12_bloodlines`）：
  `loadBloodlines/saveBloodlines`, `mlRegisterBloodline`(引退時), `mlBloodlineTier`（未確立→確立→名門→大系統）,
  `mlBloodlineFactor`, `mlBloodlineBonus`（子孫が受け取る因子）

### 生きた世界（v33.9〜.10）
- `mlWorldStarsForYear(seed, targetYear, legendPool)` … **キャリア固有シードから決定論的**に24人の永続スターを生成し、
  年1から targetYear まで再シミュ（加齢→成長/衰え→引退→世代交代／2世）。状態は `ml.worldSeed` の1つだけ保存。
- `mlWorldNews(seed, year, legendPool)`（新王者・引退・新星）, `mlWorldBoard(ml)`（ランキング表示）, `computeWorldRank`
- **殿堂の血が流入**：`legendPool = loadMlLegends()` を渡すと、上位スターが殿堂選手の姓・脚質を継ぐ `bloodOf` 付きになる。

### アンビション／キャリア／モニュメント
- `ML_AMBITION_PATHS`（victory/bigstage/**devotion**/world）, `mlCurrentAmbition`, `mlFirstUnmetRung`, `mlAmbitionCleared`, `applyAmbitionReward`
  - devotionの `supportRaces` は raceLog.role ∈ {support,sub,experience,domestique} を数える。**assist作戦で自分の意思で稼げる**（運ゲー解消済み）。
- `mlCareerArchetype(s)` … 引退時の生き様（称号）。`careerWins/careerPodiums/careerBigWins/careerTitles/careerClassics` を参照。
- `ML_MONUMENTS` … ワンデー古典3種（石畳/丘陵/山岳）。`race.monument` フラグ、`careerClassics` を加算。

### 殿堂・その他
- 殿堂：localStorage `roadrace_v12_mylife_legends`。`ML_LEGENDS_KEY`, `mlLegendSnapshot(s)`, `mlRecordLegend(s)`, `protegeInherit`
- 特殊能力：`ABILITIES`（`iron`鉄人 / `tough`頑丈 / `glass`ガラスの体[bad] / `big`大舞台 / `finisher` 等）, `GOLD_CONDITIONS`, `hasAbility/hasGoldAbility`
- シーズンモード：別state（`g`/`initGame`）。`TEMPLATES`(コース), `signBredYouth`（シーズンの血統ユース）。

### localStorage キー一覧
- `roadrace_v12_mylife_save` … マイライフ本体
- `roadrace_v12_mylife_legends` … 殿堂（プレイ跨ぎ）
- `roadrace_v12_bloodlines` … 系統レジストリ（プレイ跨ぎ）
- `roadrace_v12_save` … シーズン本体
- クリアポイント等は `loadMeta()`（`totalEarnedCP` でアンロック判定）

---

## 3.5 実装済み機能インベントリ（全体像・再実装しないための一覧）
※ v11〜v33で積み上げ済み。細部は本体を参照。**ここにある物は「もうある」前提で扱うこと。**

### レースsim・可視化
- レース全体を先計算→再生する方式（`simulateTicks`）／2D集団フォーメーション／ローテーション・パスラインの縦可視化／カメラの選手追従
- 天候（晴/雨/猛暑）＋横風エシュロン、特能「悪天候巧者」
- 最終スプリントの2D演出／フィニッシュのズーム＆スローモ／周回レース（クリテリウム・サーキット）
- コースレコード、レース実況の拡充、コースを道の曲線に沿わせる、逃げ要員が実際に逃げる、最終区間スプリント戦術

### シーズンモード（チーム経営）
- 6名ロースター運営、B1/A/PRO の3クラス昇格
- スタッフ雇用／FA移籍市場／選手トレード／移籍志願／退団選手をライバルチームが拾う
- グランツール（年3つ・海外遠征）＋副次分類（ポイント/山岳/ヤングジャージ）、ステージ間の役割再配置
- チーム化学反応、キャプテン制、実績システム＋報酬、チーム順位表
- ユースアカデミー枠、血統ユース（`signBredYouth`）、施設アップグレード可視化、トロフィールーム
- ライバルチーム動向ニュース、会場相性/ホームアドバンテージ、クリア後の王朝継続(NG+)
- キャンプ券を「疲労/故障トレードオフ」に再設計

### マイライフモード（選手育成）
- 月次ループ（出走／練習／完全休養／私生活イベント）、経歴選択（高卒/大卒/実業団卒）
- 監督指示＋監督評価、年俸改定、契約交渉、移籍オファー（クラス/契約金/エース確約）、移籍入札戦
- ショップ（パーツ/消耗品/恒久ギア/車/住居）、成長力・脚質アイテム、能力別コーチ
- ライバル（1人目・2人目）、節目の大会（世界選手権/五輪）、代表での役割
- 人生の岐路（結婚／大怪我＋3択リハビリ／第一子／恩師との別れ）、オフシーズンの過ごし方
- 個人スポンサー＋人気度＋スポンサーの仕事、自伝出版、引退後エピローグ（監督/完全引退）
- 恩師（師弟）＝新人時代の指導、教え子（プロテジェ）、メンター役
- 調子→フォームに統一、ピーキング、フォーム予報、天候予報、潜在力予報レンジ
- 成長キャップの経年上昇、出走経験による成長、対戦相手(AI)の年々底上げ
- 世界ランキング＋アンビション4路線（勝利/大舞台/献身/世界）、キャリアの生き様（称号）
- 配合（血統）：ニック／インブリード／累代+値／金特クロス／配合限定特能／生き様の血／相性表／系譜ツリー
- **v33**：爆発力＆配合評価／危険度／系統確立＋因子／特殊配合／生きた世界（永続ペロトン＋殿堂の血流入）／モニュメント／アシスト作戦（献身の走り）

### 共通・メタ
- 難易度ティア（成長キャップ＋AI強度）、クリアポイント＋パーク屋（メタ進行）
- 選手ごとの戦績・ニックネーム・フレーバー（役割/連勝/無敗などアーキタイプ別）、殿堂（プレイ跨ぎ）、累積タイトル台帳
- 特殊能力システム（銅→金特への進化、特殊能力図鑑）、副ステータス（加速/体格/メンタル）＋ピーキング
- 生涯プレステージスコア画面、ヘルプタブ（両モード）

### v34（モジュール移行後・このセッション。詳細は §4／§8）
- **基盤**：単一HTML→`src/`モジュール分割＋Viteビルド（Phase 0–4完了）。真実の源は `src/`、`index.html`は生成物。
- **クラシック適性**：脚質別の古典特能3種（石畳/丘陵/山岳）。`monumentMul`＋`effAbilities(…, monument)`。
- **出走表の下馬評**：`raceForecast`で◎本命/○対抗/▲注目（両モード）。
- **シーズン順位の実効化**：`computeStandings`を報酬＋昇格ボーダー緩和に接続（`seasonRank`/`standingsRankReward`/`champPromoteCut`）。
- **UI導線**：マイライフ主画面の状況パネルを折りたたみ（`ml.uiStatusOpen`）。能力バーに伸びしろ帯＋コース適性（`AbilityGrid`/`DisciplineGrid`）。
- **レース後サマリー**：結果画面にタイム差（`finishTime`/`gapSec`）＋下馬評の答え合わせ（`forecast`）を追加。

---

## 4. 実装履歴（v33系〜v34・現行セッション）
v33系＝配合拡張4本→献身の運ゲー修正→進化3方向（A/B/C）。v34＝モジュール移行(§8)後の機能/バランス/UI。
すべてPlaywright（＋純ロジックはNode単体）検証・push済み。作業ブランチ：`claude/roadrace-v9-continuation-imtukw`。

| commit | 内容 |
|---|---|
| `v41以前〜v33系（93件・要約リスト）` | 全文はgit履歴に保存済み。件名で `git log --oneline --grep="<キーワード>"` または `git log --oneline | grep <キーワード>` すれば該当コミットが見つかり、`git show <hash>` で当時の詳細（実装箇所・検証結果込み）を復元できる。以下は件名のみの索引（新しい順）：<br>v41 第1候補③：移籍市場の駆け引き（引き抜き合戦） ／ v40 第1候補②：シーズンの中期目標 ／ v39.20 sim本体に展開戦術を実装（トレイン/発射/前待ち/ピールオフ） ／ v39.19 展開のリアリティ（逃げ/追走/ペロトン明示）＋ゴール導入カメラ ／ v39.18 沿道を道のカーブに追従＋難易度で判断の効きを変える ／ v39.17 俯瞰マップにもスピード感／ゴール前の間合いを長く ／ v39.16 ゴール演出のスピード感を根本強化（走行距離4倍） ／ v39.15 ゴール演出のスピード感強化＋レース中のスロー/ズーム強化 ／ v39.14 残像の描画負荷対策＋マイライフ育成カーブの再設計（カンスト対策・難易度連動） ／ v39.13 残像対策＋最終スプリント判断＋ゴールスロー再調整＋縮尺バー ／ v39.12 俯瞰マップ大幅強化（6点：自転車アイコン/ギャップ可視化/KOM・残距離/アクションカム/隊列/沿道） ／ v39.11 ロードバイクのドット絵化／再生を遅く＆×0.5追加／俯瞰マップを地形着色＋勾配表示 ／ v39.10 ゴール演出：ドット絵化・密集緩和・ゴール固定カメラ／俯瞰の緩ズーム＆スロー連動＆右寄り修正 ／ v39.9 ゴール演出の修正：重なり解消・自転車スプライト・駆け引きを手前から ／ v39.8 ゴール演出をカイロソフト風アイソメ(2:1ディメトリック)に ／ v39.7 ゴールを斜め視点＋スプリントの駆け引き演出／俯瞰ズームを滑らかに ／ v39.6 ゴールスプリントを横視点(サイドビュー)＋高速スクロール背景に ／ v39.5 ゴール演出を放送カメラ風に（follow→ライン固定・左→右・接戦スロー） ／ v39.4 ゴールスプリント演出を横フロー化＋アシストのエース着順表示バグ修正 ／ v39.3 観戦演出の強化：スロー＋ズームの山場(beat)と実況拡充 ／ v39.2 最終直線シネマティックを集団スプリント対応（表示人数拡大） ／ v39.1 判断カードを脚質・特性・役割・地形と連動（種類拡充） ／ v39 A案:レース中の判断カード（観戦→"プレイ"へ）＋スリム化 ／ #9 A-4:選手→監督の転身ブリッジ＋世界暦の可視化（A案の連結完了） ／ #9 A-2/A-3:レジェンド招聘＋共有ワールド（1つの世界が両モードで年を取る） ／ #9 A-1:統合ダイナスティ・ハブ（両モード共通の系譜/因子）＋ヘルプ拡充 ／ #9 B案（配合・系統の深掘り）B-1〜B-4＋2修正 ／ フィードバック9項目バッチ（#1〜#8＋リードアウト・スタミナAI） ／ シーズン:相手チームを永続ロースター化（選手とチーム同期） ／ 両モード:チーム数拡張＋マイライフ所属/クラス実効化 ／ マイライフ:ワールド選手の年次成長・引退で世代交代 ／ マイライフ:永続ワールドロースター＋全チーム成績台帳 ／ 拡充:パーソナリティ3種＋異名を追加（会話/イベント完備） ／ 拡充:特殊能力をさらに7種追加（第2弾・良5/悪2） ／ 拡充:特殊能力を5種追加（既存simレバーに接続） ／ メタ:CPショップ（貯めたCPで恒久解禁を購入） ／ メタ:クリアポイント(CP)拡充 — マイライフでも獲得＆CP特典 ／ マイライフ:観戦マップに選手名ラベル＋選手成績台帳 ／ マイライフ:チームTTをチーム結果に＋全レースに順位表 ／ fd862f2 ／ a7678b4 ／ d407a7d ／ 1a15631 ／ 0abbcfd ／ d905587 ／ f9b1bc8 ／ fc29891 ／ ca54130 ／ 20dc260 ／ e98092f ／ DEVLOG ／ A-3 ／ C-2増分1 ／ C-2増分2 ／ UI下馬評 ／ バランス:シーズン順位実効化 ／ UI:マイライフ主画面導線 ／ UI:能力プレビュー ／ UI:レース後サマリー ／ UI:シーズン主画面導線 ／ UI:マイライフ・ショップ整理 ／ 修正:アシストの自滅・大敗 ／ C-2 新競技:チームTT ／ D演出:引退セレモニー＆殿堂の集大成 ／ B-2 逆メンター:弟子を育てる ／ マイライフ:アシストの不整合を修正 ／ シーズン深掘り:スタッフの個性化 ／ シーズン深掘り:育成の手応え ／ シーズン深掘り:ケミストリーの可視化＋絆の節目 ／ シーズン深掘り:ライバルチームの個性 ／ シーズン深掘り:タイトル争いの物語化 ／ UI:選手詳細にキャリアの軌跡 ／ UI:実況の充実（注目選手を名指し） ／ UI:セーブの安心感（続きから明細） ／ D物語:メディアナラティブ ／ D物語:因縁が育つライバル ／ バランス:配合小要素点検＋危険度を実効化 ／ バランス:配合点検＋二刀流を実効化 ／ バランス:難易度つまみを高クラスで実効化（鬼を強化） ／ バランス:エース早期発射を実効化（勝負の逃げ） ／ バランス:シーズン作戦の点検 ／ バランス:作戦説明の正直化 ／ バランス:地形別フィニッシュ決着 ／ 修正:アシストの観戦⇔リザルト同期ズレを根治 ／ 修正:アシスト大敗＆横一線ゴールの再修正 ／ 改善:ライバル会話ドラマを双方向イベント化 ／ 両モード:性格ベースのイベント ／ マイライフ:完全休養・取材/私生活を有意義に ／ マイライフ:新聞・雑誌イベント（大勝・連勝の号外） ／ マイライフ:性格ベースのライバル会話ドラマ（紙芝居/VN風） ／ マイライフ:リセマラ（素質診断＋引き直し）強化 ／ マイライフ:経歴（出自）ごとの固有メリット ／ マイライフ:弟子育成の深化（絆・鍛錬・指導イベント） ／ マイライフ:突然の強制引退→契約更改の選択制 |

---

## 5. 次の候補

### 🧭 現在地（2026-07 v39系セッション終了時点・次の担当はまずここを読む）

**このゲームは何か**：ロードレースの育成/運営ゲーム。2モードあり、両方が1つの共有世界（殿堂・系統・因子・世界ペロトン）を
またいで年を取り続ける（§3「生きた世界」「ダイナスティ」参照）。
- **シーズンモード**＝6名のロースターを率いるチーム運営
- **マイライフモード**＝選手1人のキャリアをB1から歩む

**v39系で何をしたか（設計方針）**：出発点はユーザーの根本指摘「レースが受動的（事前に作戦を選んだら見るだけ）」。
そこで**レースを「観るもの」から「プレイするもの」へ**転換することに全投資した。
1. **A案＝レース中の判断カード**（v39.0〜）…再生を止めて選択させ、`resumeSim()`でその地点からレースを
   フォークして再計算する。選択が着順に実際に反映される（＝観戦アニメと結果が必ず一致）。
2. **判断の文脈化**（v39.1）…脚質・特性・役割・地形から「その選手ならでは」の選択肢を組み立てる。
3. **演出の作り直し**（v39.2〜v39.19）…ゴール決着をカイロソフト風アイソメ（2:1ディメトリック）に。
   カメラは先頭追走→ゴール固定、接戦のみスロー、背景スクロールで速度感。俯瞰マップも用語表示・
   アクションカム・地形着色などで強化。
4. **展開のリアリティ**（v39.19〜20）…逃げ/追走/ペロトンの分類表示に加え、sim本体にトレイン・前待ち・
   発射・ピールオフを実装（slotに反映＝隊列として目に見える）。
5. **バランス**（v39.14/21）…育成カーブの逓減化（2年カンスト解消）、難易度で成長上限と判断の効きを変更、
   「終盤に踏み倒すだけ（早駆け）が最適解」の是正。

**開発の作法（必ず踏襲）**：`npm run build`（index.htmlへのコピーまで自動）→ **Node単体テストで数値の裏取り**
（特にsim/バランスは体感でなく計測で判断する）→ **Playwrightで実エラー0** → DEVLOG §4 に1行追記 → コミット。

### 📌 次にやると決まっていること（この順番で着手する合意済み）
**第1候補：シーズンモードの駆け引き**（マイライフだけ面白い、という体験の非対称の解消）
- ✅ ① 監督指示カード（v39.22で完了）
- ✅ ② シーズンの中期目標（v40で完了）…スポンサーが契約時に「複数レースにまたがる約束」を1つ提示。5種（通算勝利/山岳勝利/平坦表彰台/大舞台表彰台/若手エース勝利）を期限月まで追い、達成でボーナス・未達で違約金。主画面パネルで常時進捗。詳細は §4 の v40 行。
- ✅ ③ 移籍市場の駆け引き（v41で完了）…**引き抜きを双方向で実装**。被引き抜き＝ライバルが自チーム主力を狙う `poachOffer`（引き止める／放出）。引き抜き＝ショップの `poachMarket` で他チーム看板選手を移籍金で獲得（年1回）。放出した選手はライバルとして再登場。詳細は §4 の v41 行。

> **第1候補（シーズンの駆け引き）①②③はすべて完了。** 次に着手するなら以下から選ぶ（合意順位ではなく候補）：
> - **第2候補：生きた世界**（`src/world/world.js` 71行・v33.10で停滞）…ライバルの成長/全盛期/引退、世界ランキング変動のニュース化、世代交代の物語化。
> - **第3候補：アイテム・設備の刷新**（`src/data/items.js` は5アイテム/3設備で初期のまま）…機材選択にトレードオフ（軽量ホイール＝登り有利/平坦不利、雨用・石畳用など）。

**第3候補：アイテム・設備の刷新** … `src/data/items.js` はほぼ初期のまま（5アイテム/3設備・買うだけ）。
機材選択に**トレードオフ**を入れる（軽量ホイール＝登り有利/平坦不利、雨用・石畳用など）。

**第2候補：生きた世界** … `src/world/world.js` は71行・v33.10で停滞。ライバルの成長/全盛期/引退、
世界ランキング変動のニュース化、世代交代。

**第4候補：特殊配合の深化**（2026-07 ユーザーメモ・未着手）… ドラクエモンスターズのように
「適切な4体を適切な順番で配合すると新しく超強力な1体が生まれる」という面白さを育成
システムに取り入れたい、というユーザーの着想。配合の対象を選手そのものにするのか、
能力・特能・因子にするのか、既存のOB配合／因子継承システムとどう関係づけるかは未整理。
着手前に設計の合意（本ファイル§1のメタ指示）が必要。

**第5候補：リーグ全体の生きてる感**（2026-07 ユーザーメモ・未着手）… 現状はユーザーが
リーグ全体の動き（強い選手・強いチーム・世界ランキングの推移など、ゲーム全体の流れ）を
把握しきれておらず、それが面白さを損ねているというユーザーの指摘。第2候補「生きた世界」
（ライバルの成長/全盛期/引退・世界ランキング変動のニュース化・世代交代）と関連が深いため、
着手時はまとめて検討する。

### ⚖️ 未解決・要判断として残しているもの
- 山岳×クライマーのアタック勝率が高め（81%）。「得意地形×得意脚質は大きく報われる」設計意図として現状維持中。
  下げるなら `committedBreak` の登坂割引を弱める。
- oni難易度の判断効果 `MOVE_EFF_BY_DIFF` が0.66（ほぼ無効）。厳しすぎるなら0.75程度へ。
- 直近の演出調整（スロー/ズーム/尺）は**強めに振ってある**。実機の感触次第で中間値へ戻す余地あり。

> **メモ（2026-07）**：機能ロードマップを一旦中断して §7/§8 のモジュール分割移行（Phase 0〜4）を完了させた。
> 以降のゲーム開発は分割後の `src/` 上で進める（該当モジュールだけ読めばよく、巨大ファイル全読みは不要）。
> ゲーム内容の候補は移行の影響を受けずそのまま有効。

### ゲーム内容
- **C-2 追加フォーマット／適性**（進行中）：
  - **増分1（完了・v34）**：クラシック適性の配線を実装。`raceMeta.monument` を `effAbilities`（sim/race.js）へ届け、
    `rainMul` と同型の `monumentMul(r, monument)` で全能力×1.05（金特×1.09）を適用。プレイヤーの raceLog
    エントリに `monument` タグ（＝モニュメントid）を付与（main.jsx のレース確定）。
  - **増分2（完了・v34）**：これを**脚質別の古典適性3種**に展開。`monumentMul` を
    `MONUMENT_ABILITY = {pave:"pave_sp", ardennes:"ardennes_sp", autumn:"autumn_sp"}` のマップ方式にし、
    各モニュメントは対応特能を持つ選手だけをブースト（相互作用なし）：
    石畳《春の地獄》→`pave_sp`「石畳巧者」／丘陵《アルデンヌ》→`ardennes_sp`「アルデンヌの狼」／
    山岳《秋の女王》→`autumn_sp`「秋の女王」。習得＝その古典で表彰台（ACQUIRE, support.js）、
    金特化＝その古典で優勝（GOLD, core.js）。ヘルプ更新。**検証**：Nodeで13ケース単体テスト
    （各特能が自分の古典のみ+5%/+9%・他古典は無影響・条件の脚質別判定）＋Playwrightで両モード0エラー。
  - **チームTT＝実装済み（§4）**。残＝トラック競技等。※シーズンモードにはモニュメントが無いため
    これら古典適性は現状マイライフ専用（season の raceMeta.monument は undefined＝無影響）。
- **バランス調整パス**（2026-07に集中実施・すべて§4に記録）：シーズン順位実効化／地形別フィニッシュ決着
  （脚質を着順へ・クライマー勝率34%→83%）／マイライフ作戦の説明正直化／シーズン作戦(CHASE_MODES)点検／
  エース早期発射を「勝負の逃げ」に実効化（committedBreak・地形依存）／難易度つまみの高クラス実効化（鬼のAI上限94→104）／
  アシスト不整合の修正（エース先着）。
  - **統合リグレッション再点検（2026-07・全項目PASS）**：Nodeで一括検証し、今セッションの全変更が競争的難易度で崩れていないことを確認。
    A.地形決着＝ヒルクライムでclimber勝率88%・クリテ/丘陵でsprinter有利（climber20%/1%）。B.難易度＝PRO/y10で鬼18.7位≫hard6.5位（鬼が明確に難しい）・normal B1は競争圏。
    C.アシスト＝エース先着100%。D.作戦＝末脚温存≧標準・逃げに表彰台プレミアム。E.チーム個性＝相手エースのspec一致100%。
    ※脚質差はB1/y1など弱編成では圧縮される（両強者が弱いAIを圧倒）＝既知の仕様。競争的な場（B2/y3+）では全て意図どおり効く。
  - **難易度カーブ診断の副次観察（検討の結果いずれも「仕様」と判断・要対応なし。2026-07にユーザーと確認）**：
    (1) **脚質が着順を大きく左右**する（決着地形に合わない脚質は集団ゴールで沈む）＝地形別決着の**意図どおりの良い設計**。
    情報導線も下馬評（◎○▲）＋種目別適性表示で事前に分かるので追加対応不要。
    (2) **hard/oniは序盤が「遅咲きスタート」**：AI能力に上限があり自分は成長し続けるため、B1/A帯（自OVR低）が最も勝てない。
    ただしこれは**逸材/成長で突破する想定どおりの高難度**であり壊れではない。実測（hard B1・脚質合致・2コース平均）＝
    OVR76で表彰台圏（勝16%/台50%）、開始域は実業団58〜配合込み65前後。若い高成長型（高卒＝伸びしろ最大）は年+5〜10伸び、
    AIの年+1.5を追い越して数年で到達できる。シーズンは逸材スカウト／CP褒賞「逸材新人確保」（成長S・全能力+12）で即打破可。
    ソフトロックでもない（レース抜きでもトレで成長可）。easy/normalは最初から健全。→ **対応不要**（留意は「越えるまで立ち上がりが地味」という好みの範囲のみ）。
  - **配合まわりは点検完了（§4に2コミット）**：成長力2.3倍差・配合限定特能・特殊配合5種・爆発力変換とも健全。
    是正したのは2点のみ＝(a)hybrid二刀流の実効化（+2climb/sprint）、(b)危険度「ガラスの体」がマイライフで
    無効だった抜け穴（→疲労コスト化）。→ 配合は全体として良好、投資に見合う設計と確認。
  - **系統確立も点検＝健全・修正不要**（Node機能テスト、localStorageモック）：`mlBloodlineTier`の段階が
    2人→確立(talentCap+1)／3人→名門(+2・成長+1)／5人→大系統(+3・成長+1・因子金特化)と滑らかに到達、
    因子（系統の代表特能）も最頻の良特能を正しく抽出。引退時`mlRecordLegend`（main.jsx 3箇所＋引退ボタン）で
    確実に累積する配線も確認。プレイ跨ぎのメタ進行として妥当。
  - 残る調整候補＝生きた世界（世界ランキング/殿堂流入）※配合とは独立。→ **配合系は一区切り**。
- **UI/UX 磨き込み**（継続中・§4参照）：下馬評／主画面導線／能力プレビュー／レース後サマリー／セーブの安心感／選手詳細のキャリア年表／実況の名指し充実を実施済み。
  次候補＝シーズン主画面の導線整理、セーブ/ロードの安心感、選手詳細のさらなる強化。
- **B-2 逆メンター**（着手・§4「逆メンター:弟子を育てる」）：メンターになると弟子を取り、師の地力に導かれて育つ（主画面パネル＋引退セレモニーで総括）。
  残り候補＝弟子の脚質別の成長偏り／弟子が実レースに登場／引退後に弟子が殿堂・血統へ流入（世界の生きた設定と接続）／チームメイトの絆・確執イベント
- **A（生きた世界）は A-1/A-2/A-3 で一旦完成**
- **D 物語・ドラマ生成**（着手中）：**因縁が育つライバル・メディアナラティブ＝実装済み**（§4）。残り候補＝
  決定的瞬間の演出（レース観戦中のライバルとの直接対決ズーム等）、引退セレモニーでの因縁の総括
  （rivalRecord.heat/最高呼称を回顧に反映）、レース後のメディア反応（結果画面にも見出しを出す）。

### アーキテクチャ後追い（任意・§8「今後の改善候補」より。機能追加と独立に着手可）
- **`src/` のさらなる細分割**：`screens/mylife.jsx`(1288行)・`screens/season.jsx`(1687行)・`logic/support.js`(1452行) は依然大きい。画面ごと/ドメインごとに割ればトークン効率がさらに上がる（分割機構は §8 で確立済み、あとは粒度判断）
- **`ctx`(81メンバーの手組みオブジェクト) の整理**：React Context 化、またはハンドラを別モジュールへ
- **ビルド自動化**：GitHub Actions で `npm run build` → 生成 `index.html` のコミットレス化（現状は手元でビルドして直下 `index.html` を手コミット）

## 6. 守るべき方針メモ
- 配合・世界系のボーナスは **伸びしろ／称号／金特** に限定（初期能力インフレ厳禁）。
- 新機能は必ず Playwright で end-to-end 検証してからコミット（数値ロジック＋UI表示＋0エラー）。
- ヘルプ（`mylife_help` 画面）にも新機能の説明を追記して整合を保つ。
- **編集は `src/` のみ**。`src/` を直したら必ず `npm run build` してから `src/` と生成 `index.html` を両方コミット（手順は §1）。`index.html` は生成物なので手編集しない。テストハーネスはコミットしない。
  （※旧「3ファイル同期（.html/.jsx/テスト）」ルールは、§8の移行で `.jsx`手作業ミラーが撤廃されたため廃止）

## 7. アーキテクチャの岐路（未決定・要判断）
**現状**：本体は単一HTML約9,300行。JSXをBabel-standaloneが実行時変換。`.jsx` は手作業ミラー（＝二重管理の匂い）。

**問題意識**：単一ファイルが快適な限界を超えつつある。
- AI編集の課金が重い（1行直すのに巨大ファイルを毎回読む＝トークンの主因）
- 認知負荷・壊れやすさ（全部が同一スコープ）・起動時Babelコンパイル負荷

**選択肢**：
1. **単一ファイル維持** — ゲームが「ほぼ完成、小改修中心」なら正当
2. **モジュール分割＋軽量ビルド（Vite/esbuild）＝推し** — 該当モジュールだけ読めばよくトークン激減。`.jsx`手作業ミラーも廃止できる。JSXを実行時Babelでやめてビルド時変換にするのが素直
3. **フルにビルド環境へ移行** — DX最良だが「開くだけ」の手軽さは失われ移行コスト最大

**推奨**：まだ活発に開発を続けるなら 2 に一度だけ投資。段階移行できる：
(a) 巨大な静的データ（定数・テーブル）を別ファイルへ → (b) 純ロジック（sim/breeding/world）を切り出し → (c) 最後にReactコンポーネント。
「当面は微調整のみ」なら 1 のままでも可。

**次アクション候補**：機能追加(C-2)より先に、この移行の是非を決める → やるなら移行プランを別途作成しDEVLOGに追記。

**→ 決定（2026-07）**：選択肢2を採用。Phase 0〜3を実行することにした。詳細は §8。
**→ 完了（2026-07）**：Phase 0〜4 まで移行完了（App分解まで到達）。`.jsx`ミラー・実行時Babel・CDN依存は撤廃。以降は §8 の到達点を参照。
（この §7 冒頭「約9,300行」等は移行前の岐路時点のスナップショット。現状は §1/§8 が正）

---

## 8. モジュール分割＋Viteビルド移行プラン（採用・**完了** 2026-07）
§7 の選択肢2を採用。**Vite + `vite-plugin-singlefile` で「自己完結の単一 `index.html`」を出力**する方式。
「配布は単一HTML1枚」という手軽さを保ったまま、オーサリングをモジュール化する。
**Phase 0〜4 まで全て完了。移行は決着済み**（HEAD=`d0c15ba`「Phase 4-2：App分解完了」）。以降の作業は分割後の `src/` 上で行う。

### 到達点（移行完了時点・全読みせずに現状を掴むための要約）
- **`main.jsx` は 9,624行 → 2,395行（約1/4）**。残りは App のフック・ハンドラ・`ctx`組立のみ。ロジック/データ/画面は下記モジュールへ退避済み。
- ソースは `src/` の18モジュール（＋`main.jsx`/`index.html`テンプレート）：
  `data/`(theme,abilities,progression,breeding,course,items) / `core/` / `sim/` / `breeding/` / `world/` /
  `state/` / `logic/support.js` / `components/`(RaceView,ui,panels) / `screens/`(mylife,season)。
- **デプロイ物**：リポジトリ直下 `index.html`（自己完結の単一HTML・約560KB）＝`npm run build` の生成物。GitHub Pages 経路は不変。
- **撤廃済み**：`.jsx`手作業ミラー ／ 実行時Babel（起動時コンパイル）／ 実行時CDN依存（esm.sh・unpkg）。
- **ビルド**：`package.json` の `npm run build`＝`vite build && cp dist/index.html index.html`（React18＋`@vitejs/plugin-react`＋`vite-plugin-singlefile`）。
- **検証**：各Phaseで `npm run build`→http-server→Playwrightで両モード起動・全画面・レース実走まで実エラー0を確認済み。
- **残タスク（任意・下記「今後の改善候補」）**：`screens/`のさらなる細分割、`ctx`(81メンバー)のContext化、GitHub Actionsでのビルド自動化。

### 方針の要点
- ソースは `src/*.jsx`（実import/export）。`npm run build` が `dist/index.html`（全インライン）を生成し、
  それをリポジトリ直下 `index.html` へコピー＝デプロイ成果物。GitHub Pages の経路は不変。
- **廃止できたもの**：`.jsx`手作業ミラー／実行時Babel（起動時コンパイル）／実行時CDN依存（esm.sh/unpkg）。
- **副産物**：CDN依存が消えたのでクラウド環境で本物の成果物を直接Playwrightできる（vendor版Reactハック不要）。
- **代償**：編集後に `npm run build` が要る（Node必須）。`index.html` は生成物なので手編集しない。

### 段階（各Phaseは独立コミット・独立検証。いつ止めても壊れない）
- **Phase 0（完了）**：ビルド土台の敷設。コード再編ゼロ。旧 `<script>` 本体を `src/main.jsx` へ丸ごと移動
  （挙動不変・verbatim）、`src/index.html`＝Vite入口テンプレート、`package.json`/`vite.config.js` 追加、
  `.gitignore` 整備、`.jsx`ミラーと旧 `roadrace_v12.html` を廃止（内容は `src/` と git 履歴に保全）。
  Playwrightで両モード起動を検証（実エラー0）。
- **Phase 1 (a)（完了）**：静的データ52定数を `src/data/` の6モジュールへ（theme/abilities/progression/
  breeding/course/items）。関数を参照する条件テーブル(GOLD_CONDITIONS 等)はロジック扱いでPhase 2へ送った。
- **Phase 2 (b)（完了）**：純ロジックを層構造で分離。`src/core/`(RNG・能力/名前/選手生成・OVR)←
  `src/sim/`(コース生成・simulateTicks・着順)／`src/breeding/`(配合・血統・殿堂)／`src/world/`(世界スター)←
  `src/state/`(init/save/load・生成器・アンビション・実績・buildMyLifeSim)。**手法**：純ロジックseedの
  参照閉包(102メンバー)を機械抽出→クロスimport自動計算→ビルド＋Playwright検証。閉包はAppもhookも一切参照せず
  完全に分離できた。共有可変カウンタ RID は `ridState={value}` ホルダーへ変換（所有はcore）。state↔breedingの
  実行時のみの循環importは安全。**教訓**：ビルド成功は参照解決を保証しない（未定義識別子はグローバル扱い）。
  cross-fileのimport網羅は静的チェッカで検証すること。
- **Phase 3（完了）**：`RaceView` を `src/components/RaceView.jsx` へ。実際にはRaceViewは可視化専用の
  定数・ヘルパー約44個（MAP_W/PACK_*/buildTopPath/mapX/groupAt/FinalSprintCinematic 等）とRaceErrorBoundaryを
  伴う「レース演出サブシステム」だった。参照閉包を取り、RaceView専用シンボルは同ファイルへ同梱。App と共有する
  汎用UI（`Btn`/`Eyebrow`）は `src/components/ui.jsx` へ、フォーマッタ（`fmtTime`/`fmtGap`）は `core.js` へ切り出し、
  両者から import。main.jsx は 7617→6959行。Playwrightでレース実走（LIVE可視化）まで検証、実エラー0。
- **Phase 4（完了・2増分）**：App(モノリス)の分解。
  - **4-1**：App本体の外（col-0＝モジュールレベル）に残っていた純粋な宣言154個をモジュールへ。
    `src/components/panels.jsx`（表示サブコンポーネント14個）＋`src/logic/support.js`（ヘルパー＋残存データ139個）。
    これらはスコープ上App状態に非依存（`<g>`タグや `check:(g)=>` の引数gはApp状態ではない）。main.jsx 6959→5329行。
  - **4-2**：App内の画面ディスパッチを切り出し。画面はフックを一切呼ばない純レンダ関数なので、App状態/ハンドラを
    集約した `ctx` オブジェクトを渡す方式で `renderMyLifeScreens(ctx)`＝`src/screens/mylife.jsx`、
    `renderSeasonScreens(ctx)`＝`src/screens/season.jsx` に分離。ctx=81メンバー（g/ml/setter/全ハンドラ/wrap/mlWrap）。
    App は `if(superMode==="mylife") return renderMyLifeScreens(ctx); return renderSeasonScreens(ctx);` に。
    **main.jsx は 5329→2394行**（当初9,624行の約1/4）。残る main.jsx は App のフック・ハンドラ・ctx組立のみ。
  - **ctx完全性の検証**：画面ファイルの自由変数を静的抽出し「ctx分割代入・import・ローカル・JSXタグ/CSSキー/globals」で
    説明できない参照が無いことを確認。Playwrightで両モード＋マイライフ全画面＋レース実走＋シーズンmain画面まで実エラー0。
  - **落とし穴（記録）**：ブレースマッチで App の閉じ `}` を巻き込みやすい（EOFエラー）。抽出後は brace balance=0 を確認。

### 各Phaseの検証手順（必須）
`npm run build` → http-server 配信 → Playwrightで①両モード起動②実コンソールエラー0③代表フロー。
分割はモジュール単位で少しずつ→ビルド→煙テスト→コミットを繰り返す。

### 今後の改善候補（任意）
- `src/screens/mylife.jsx`(1288行)・`season.jsx`(1687行) と `src/logic/support.js`(139宣言) は、なお大きい。
  画面ごと・ドメインごとにさらに細分割すればトークン効率は上がる（機構は確立済み、あとは分割粒度の判断）。
- `ctx` は81メンバーの手組みオブジェクト。React Context 化や、ハンドラを別モジュール化する余地あり。
- GitHub Actions でビルドしてコミットレス化する案（初手は生成 `index.html` をコミットする方式で最小リスク）。

---

## 9. モジュール細分化・整理（2026-07・Opus設計→Step1〜8実施・Step7第2〜12弾実施）

**背景**：v41（移籍市場）完了時点で `main.jsx`(3041行)・`logic/support.js`(2574行) が肥大化し、
ロジックが単一Reactクロージャ(`App()`)と雑多な`support.js`に集約される構造リスクを検出。Opusが実測ベースで
「理想的なファイル・モジュールの細分化設計図」を作成し、リスクの低い Step 1〜4 から着手。その後
`domain/`・`controllers/`層への本格分離（Step 5〜8）、さらにcontrollers抽出のうち特に危険度の高い
レース進行系（B-3）を段階的に潰すStep7第2〜8弾まで、すべて完了済み（下記参照）。

**設計原則（新規追加は必ずこれに従う）**：
1. 依存は下向き一方通行：`data → core/sim → domain/state/view → controllers → screens → app`
2. `data/`・`view/`は JSX を import しない（＝常にNodeで単体テスト可能に保つ）
3. データ（`export const`）とロジック（外部関数呼び出しを含む`apply`/`effects`）を混同しない。
   `check:`/`match:`のような**自己完結の小さな述語関数**（引数のみ参照）はデータとして扱ってよいが、
   `bumpRosterAbAll(s, 8)`のように**外部の状態変更関数を呼ぶクロージャ**は論理（domain）であり、
   `data/`へ移送しない（`CP_MILESTONES`・`ML_CROSSROADS`・`ML_OFFSEASON_CHOICES`・`SEASON_ACHIEVEMENTS`が該当し、
   `support.js`に意図して残している）

### 実施内容（Step1〜8・完了済みの基盤整備）
**Step1〜8は全て完了済み。** 全文は各コミットに保存済みで、件名で `git log --oneline --grep="Step"` すれば
該当コミットが見つかり、`git show <hash>` で当時の詳細（実装箇所・検証結果込み）を復元できる。
以下は件名のみの索引（新しい順ではなく実施順）：

- **Step1**：main.jsxの死コメント477行削除（3041→2564行）
- **Step2**：archive/整理（roadrace_v5〜v11等をgit mv、履歴保存）
- **Step3**：support.jsxの純データ41ブロックをdata/（economy/events/directives/gear/progression）へ移送、
  互換シム方式（2574→2137行）。**判定基準（新規追加は必ず従う）**：`check`/`match`が自分の引数だけを
  参照する自己完結の述語関数はデータとして扱ってよいが、`bumpRosterAbAll(s,8)`のように外部の状態変更
  関数を呼ぶクロージャはロジック（`CP_MILESTONES`/`ML_CROSSROADS`等はこの理由でsupport.jsに意図的に残置）
- **Step4**：文字列生成の純関数をview/へ新設（`riderFlavorText`・`rivalNews`等、2137→1776行）
- **Step5**：domain/season・domain/sharedを新設し純粋なドメインロジック（生成器・計算関数）を集約。
  循環import回避のため`data/teams.js`（`RIVAL_TEAMS`/`MYLIFE_TEAMS`）新設が前提整理として必須だった
- **Step6**：`state.js⇄breeding.js`の循環依存を解消（`mlLegendSnapshot`等5関数をbreeding.jsへ集約、
  互換シム経由で`===`一致することをテストで確認）
- **Step7（着手・移籍ドメインのみ）**：`controllers/season/transfer.js`新設（移籍・トレード7ハンドラ抽出）。
  **ここで確立した型（以後のcontroller抽出全てで踏襲）**：`(state, ...args) => newState`という純粋な
  reducerを`controllers/`へ、`setG`/`setMl`への接続は1行の薄いラッパーとしてmain.jsxに残す
- **Step8**：`screens/season.jsx`・`screens/mylife.jsx`（巨大ディスパッチャ）を用途クラスタ単位で
  各6ファイルへ分割。byte-for-byte機械照合（コピペミス検出）＋Playwright実機確認で検証

検証はいずれも`npm run build`→brace対応の機械チェック→既存Nodeテスト再実行→Playwright実機確認（実行時
エラー0）を経てpush。

- **Step7第2弾〜第4弾（完了・詳細はgit履歴）**：`git log --oneline --grep="controllers抽出"` で
  該当コミットを検索し `git show <hash>` で当時の詳細を復元できる。以下は件名のみの索引：
  - **第2弾**：分類Aの単純reducer27個を`controllers/season/shop.js`・`roster.js`・`mylife/shop.js`へ
    抽出（main.jsx 2564→2262行）。この時点でApp()の残ハンドラを**分類A**（`setG`/`setMl`だけで完結）と
    **分類B**（`useRef`ロック・`setTimeout`・stale closure修正コメントを持つレース/月進行系）に分類した。
  - **第3弾**：分類Bをさらに3層に再分類——**B-1**（完全に純粋）・**B-2**（reducer形＋副作用埋め込み）・
    **B-3＝真の危険地帯**（`startRace`／`startNextStage`／`mlStartRace`／`mlStartLastRace`のみ・合計約89行）。
    B-1/B-2（約1,070行）を`controllers/season(mylife)/month.js`・`event.js`・`result.js`へ抽出。
    setG/setMlのupdater内側で非冪等なlocalStorage書き込み（`recordTitle`/`advanceWorldYear`/
    `mlRecordLegend`）が直接呼ばれていた「休眠地雷」も発見し、画面遷移をrefガード付きで検知する
    useEffectへ解消（main.jsx 2262→1241行）。**B-3にはこの時点では意図的に未着手**（後述の第5〜8弾で対応）。
  - **第4弾**：`recordCourseResult`の非冪等性解消（`peekCourseRecord`＝判定のみ／`persistCourseRecord`＝
    書き込みのみに分離）・dead import 124個の削除（main.jsx 1241→1257行）。
  検証はいずれもNode単体テスト新規追加＋既存分の全PASS、Playwright実機確認・実行時エラー0。

- **Step7第5弾〜第9弾（B-3残り4関数の段階的解消・`ctx`フック化着手前の下準備。完了済み）**：
  `git log --oneline --grep="Step7第[5-9]弾"` で該当コミットを検索し `git show <hash>` で
  当時の詳細（実装箇所・発見した実バグの再現手順・検証結果込み）を復元できる。
  以下は件名のみの索引：
  - **第5弾**：B-3再調査（第3弾混入のrankSim退行を発見・修正）。`startRace`系の
    「純粋な入力組み立て」約35行を`controllers/season(mylife)/raceStart.js`へ抽出。
  - **第6弾**：グランツール3日間をスキップ経路のみで進めると3日目が永久に進行不能になる
    実バグを発見・修正（`stage2LockRef`解除漏れ→"gc_stage"遷移検知useEffectへ一本化）。
  - **第7弾**：`startNextStage`の二相化（意図確定の純関数＋`pendingStage`監視useEffect）。
    `stage2LockRef`useRefロックを廃止。
  - **第8弾**：B-3最後の3関数（`startRace`/`mlStartRace`/`mlStartLastRace`）を解消。
    連打で賞金・ポイントが二重加算される実バグを発見・修正、`mlRaceLockRef`も廃止
    （これでB-3＝真の危険地帯は全解消）。
  - **第9弾**：main.jsxに生で残っていた586行（`mlCreateChar`ほかキャラ作成/イベント/
    キャリア分岐）を`domain/mylife/createChar.js`等へ抽出。mylifeセーブ注入という
    実機検証手法を新設。main.jsx 1259→822行。
  検証はいずれもNode単体テスト新規追加＋既存分の全PASS（226→287ケース）、Playwright実機
  確認（PROセーブ注入・連打の高速2回発火・mylifeセーブ注入等の各弾で新設した手法込み）・
  実行時エラー0。

- **Step7第10弾（`ctx`89メンバーの手組み解消・`useAppShell`/`useSeasonGame`/
  `useMyLifeGame`へのフック化・OBコーチ選択時のライブクラッシュ発見/修正）**：
  `git log --oneline --grep="Step7第10弾"` → `git show <hash>` で復元可能。
  ctxをseason/mylifeに分割しseason画面へmylifeハンドラを一切渡さない構造にし（層の逆流を
  構造的に不可能にする）、両モードの唯一の実結合点（引退選手→監督への転身ブリッジ）を
  `becomeManager()`1つに集約した。副次的に、`Header`が`OB_COACH_SALARY`を未importのまま
  参照しており**OBコーチを1人でも雇うと即座に全画面クラッシュする**本番相当のライブバグを
  発見・修正（過去のdead import一括削除で誤って巻き込まれたと推測）。
  検証：ctx要求/提供メンバーの機械突合（season要求51/提供54・mylife要求41/提供43・
  層の逆流ゼロ）＋既存Node287ケース全PASS＋Playwright114項目（グランツール回帰・
  season/mylife連打防止回帰・mylifeセーブ注入・転身ブリッジ新規シナリオ）全PASS。
  main.jsx 822→365行、`hooks/`3ファイル合計537行を新設。

- **Step7第11弾（`superMode`メタ画面5つの`screens/meta.jsx`分離・クローム（Header/Nav/
  モーダル/wrap/mlWrap）の`components/chrome.jsx`分離・系譜/因子ビューのseason/mylife
  共通化）**：`git log --oneline --grep="Step7第11弾"` → `git show <hash>` で復元可能。
  `main.jsx`は365→48行（合成ルートのみ）になり、season/mylifeで9割同一だった系譜・因子
  ビューは`components/dynasty.jsx`へ共通化、2箇所に重複していた確認モーダルも
  `ConfirmDialog`1つへ統合した。
  検証：`Date.now`/`Math.random`固定によるリファクタ前後DOMバイト比較（メタ5画面×2
  フィクスチャ＋season/mylife主要画面等、計23点）が全一致、実クリック走査22項目＋
  既存Playwright回帰（グランツール・連打防止・mylifeセーブ注入・転身ブリッジ）全PASS、
  既存Node287ケース全PASS。

- **Step7第12弾（`raceFinishHandler`の`g.gc`残留誤判定修正・二重`rankSim`呼び出しの削除）**：
  `git log --oneline --grep="Step7第12弾"` → `git show <hash>` で復元可能。
  調査の結果、`g.gc`残留による誤判定は現行UIからは到達不能（潜在バグ）と確定したが、
  暗黙の大域不変条件に依存する危うさがあるため修正（判定を`g.result.raceMeta.stageRace`
  基準に変更）。副次的に`buildSim`と`finishRace`ラッパーで`rankSim`が二重に呼ばれ、
  観戦中と結果画面で着順がずれ得る実害も発見・削除（全経路を`buildSim`内の1回に統一）。
  検証：UIから到達不能な変更のためNode単体テストを主軸に据え20ケース新規（暗黙の不変
  条件の明示化・潜在バグの直接再現含む）、既存287→307ケース全PASS。Playwrightは第11弾
  DOM比較23点・グランツール回帰・連打防止回帰・mylifeセーブ注入・転身ブリッジ・OBコーチ
  再現テストを全再実行し全PASS（グランツール回帰スクリプトの元来のフレーキーさ
  ＝固定シード無しによる出現待ちの不安定性は、本弾着手前から確認済みの既知の挙動であり
  今回の変更とは無関係と判断）。

**残っている候補**：`hub.jsx`は本セクション（§10）第1弾で950行→30行（ディスパッチャのみ）に
分解済み（下記参照）。mylife側`hub.jsx`（557行）は依然大きいが現状は許容範囲。第7弾
グランツール回帰スクリプト（`gt_regress_wave7.mjs`）のGT出現待ちによるフレーキーさは、
いずれ固定シード注入に置き換える価値があるが優先度は低い。新機能は必ず
「data / domain / controller / screen」の4箇所に配る（1機能が既存の巨大ファイルへ
"にじむ"のを禁止）。

---

## 10. カイロソフト式動線への移行（2026-07・Step13・完了）

> **2026-07 DEVLOG圧縮メモ**：本セクション（Step13第1〜4弾／Wave D／Wave D2）と次セクション
> §11前半（Wave E-1／E-2／E-2 redo）は、CLAUDE.md §4に従い件名のみの索引へ圧縮した
> （ユーザー承認済み）。全文は失われていない——`git log --oneline --grep=<キーワード>`で
> 該当コミットを探し、`git show <hash>`で復元できる。現行の実装（BaseViewの間取り・
> カメラ・什器の最終形）はさらに新しいWave F（§11後半）が上書きしているため、実装の
> 参考にするなら基本的にWave F以降だけを読めばよく、本索引は「どういう変遷でここに
> 至ったか」を追いたいときの道しるべとして残す。

**背景**：ユーザーからカイロソフト系シミュレーションゲームのような動線への刷新依頼。
画面の大半に「チームの建物と動く選手」を常設表示し、右下メニューボタンで世界を一時停止して
左パネル→大ジャンル→小ジャンルの2階層で行動を選ぶUIへ、season側の主画面を全面的に置き換えた
（旧5タブUIは最初から置き換え、対象はシーズンモード先行）。既存の`FinalSprintCinematic`の
2:1ディメトリック投影・`IsoRider`・決定論的な待機モーションを敷地画面(BaseView)へ転用する
方針で、4波構成（①hub.jsx分解→②メニューシェル→③敷地画面→④カットオーバー）を経て完了した。

**索引**（件名／要点1行／コミット）：
- **Step13第1弾**：`hub.jsx`950行を6セクションファイルへ機械分解。DOMバイト比較で無変更を保証。
  `git show 1bd77c8`
- **Step13第2弾**：メニューシェル（右下ボタン→左パネル→大ジャンル→小ジャンル）を新設・単体で
  休眠実装。React Hooksルール違反（早期returnより後にフックを呼んでクラッシュ）を発見・修正。
  `git show 1b6330b`
- **Step13第3弾**：敷地画面BaseViewを新設。`IsoRider`をexport化して再利用。
  `git show 5df6498`
- **Step13第4弾**：カットオーバー（BaseView＋MenuShell本配線、旧5タブNav撤去）。
  `git show ca529ac`
- **Wave D**：BaseViewの視覚的な磨き込み。可視面選択バグ（奥側の見えない面を壁として
  描いていた）を修正、建物ディテール・オーバルコース・地面ゾーニング・季節演出・小物を追加。
  `git show 664400b`
- **Wave D2**：カイロソフト準拠の視覚再設計。footprintが世界空間で45°回転した菱形になって
  おり2:1投影で非アイソメの長方形になっていた根本原因を発見・修正。投影軸の非対称・屋根が
  主役化・地面の市松模様・小物の非アイソメ座標・選手の向き固定、計6件の根因を修正し、
  SVGの画面占有率を26.8%→82.0%に改善。`git show 541ce76`

## 11. 敷地画面の「カットアウト部屋＋カメラ」化 → Wave F（2026-07・Step13・完了）

**索引（Wave E-1〜E-2 redo。件名／要点1行／コミット）**：
- **Wave E-1**：カメラ（ズーム/パン）を導入。座標系をworld/scene/viewの3層に整理し、
  既存の投影計算を一切変更せず後付け。`git show 3d35b09`
- **Wave E-2**：3D箱の外観建物を廃し、床＋奥2壁だけの「カットアウト部屋」へ全置換。
  部屋タップで対応メニューが開く。`git show 8828894`
- **Wave E-2 redo**：ユーザーの手描きスケッチの再読み取りにより「5棟の建物」という前提
  自体が誤りと判明し、単一クラブハウス＋4持ち場（training/mechanic/medical/scout）へ
  作り直し。什器が床に埋もれるz順序バグ、初期表示で敷地の半分が画面外になるバグを発見・
  修正。`git show bffec16`

**この後、Wave F（敷地境界の可視化・購入型の屋外装飾・部屋割りの現実化・什器と小道具の
デザイン作り込み・選手モーション・自転車スプライトの3姿勢化）が続く。以下、詳細を残す。**

- **Wave F-1（敷地境界の可視化＋屋外装飾の購入枠・完了）**：Opusで設計方針を確認、Sonnetで
  実装。ユーザーから「①黄緑の範囲が大きすぎるので敷地の外を青（海）にして境界を明確に
  ②屋外がコース以外何もなく寂しいので池・植栽・機器等を施設Lvとして購入できるようにしたい
  ③内装を部屋割りに（機能の無い予備room含む）④選手の歩く/立つ/座るモーションと自転車
  モーションの改善」という4点の要望を受けた。AskUserQuestionで③④の設計方針
  （屋外装飾は既存equipのLv自動解禁ではなく**新規のショップ購入項目**として追加／
  選手は本格的にサーキット⇔室内を往復する状態遷移／室内は6部屋＝機能4＋空き2）を
  確認した上で、F-1（本項）→F-2（室内の部屋割り）→F-3（選手モーション）の3段階に
  分割して合意。F-1はそのうち①②を実装する。
  **敷地境界**：これまでカメラ枠外に敷いていた芝の`<rect>`（Wave E-1の「常に画面を
  埋める背景」トリック）を`palette.sky`（海の青）へ変更し、代わりにカメラ内側へ
  `BASE_VIEW_GROUND`の4隅そのままの緑ポリゴン（陸地）を新設した。これにより
  「敷地の外は海、中は陸地」という所有範囲がひと目でわかる構図になった。`palette.sky`は
  Wave E-1で背景手法を変えて以来参照が無かった死にデータだったため、新しい用途
  （海の色）として復活させた（CLAUDE.md §5の「死んでいるフィールドは削除、ただし
  形が合う新用途があれば再利用」の実例）。
  **屋外装飾の購入枠**：`data/items.js`の`EQUIPS`に`grounds`（既存のframe/wheels/facility
  と並ぶ第4の購入枠。能力値には影響しない見た目専用）を追加。この購入UI・購入ロジック
  （`hub/facility.jsx`のEQUIPS走査描画・`controllers/season/shop.js`の`buyEquip`）は
  完全にkey駆動の汎用実装だったため、新規UIコードは一切書かずに済んだ。
  `data/baseViewBuildings.js`に`BASE_VIEW_GROUNDS_DECOR`（pond/hedge/gym/arch/fountainの
  5種、`minLevel`1〜5で`g.equip.grounds`のLvに応じて段階解禁）を新設し、
  `components/base/Props.jsx`へ各装飾の描画関数（池＝二重リング+水面ハイライト、
  生垣＝低木3株、屋外トレーニング機器＝懸垂バー、入口アーチ＝ポール+旗、噴水＝
  池ベース+台座+水しぶき線）を追加した。位置はコース帯・クラブハウスのプラザ・
  既存の木のいずれとも重ならないよう選定（archのみ入口の目印として意図的にプラザ際）。
  **実装中に見つけて直したバグ（2件）**：
  ①**`buyEquip`の旧セーブ非互換**：`grounds`は5番目に追加されたequipキーであり、
  `loadGame`は`equip`オブジェクトごと上書きするため、旧セーブでは`s.equip.grounds`が
  `undefined`のままになりうる。`hireStaff`が同じ理由で`staff[k]`に既に適用している
  `|| 0`ガードを`buyEquip`にも合わせて追加し、旧セーブでも例外にならずLv1になることを
  Node単体テストで確認した。
  ②**`sceneContentBounds`が新設の陸地ポリゴンの外形を境界計算に含めていなかった**：
  陸地（`BASE_VIEW_GROUND`）は横長の矩形のため、アイソメ投影後の対角線方向の張り出しが
  他の要素（プラザ等）由来の境界より大きくなることがあり（実測：陸地1092pxに対し
  従来の境界計算値は1084px）、fitで表示したはずの陸地が実際には画面から数%はみ出す
  不整合が実機のPlaywright検証（「ズームアウト下限で内容全体が画面内に収まる」）で
  発覚した。`domain/season/camera.js`の`sceneContentBounds`に新規`land`引数を追加し、
  陸地4隅を境界計算へ含めることで解消した。
  **検証**：Node単体テストを新規に104ケース作成（`EQUIPS.grounds`のスキーマ／
  `initGame`の`equip.grounds`初期値／`buyEquip`の旧セーブ互換・通常購入・予算不足時の
  据え置き／`BASE_VIEW_GROUNDS_DECOR`のminLevel網羅性・重複無し・他要素との非重なり／
  `sceneContentBounds`のland込み境界が陸地4隅・装飾5点すべてを包含すること）。既存の
  `waved_domain`(58)・`waved_data`(96)・`wavee_camera_test`(29)・`wavee_room_test`(37)・
  `menunav`(43)、Playwrightの`cutover_check`(18)・`wavee_camera_check`(12、境界修正前は
  containチェックが1件FAILしていたが修正後12/12)・`wavee_room_check`(4)も含め全て
  再検証し、Node 367ケース＋Playwright 34項目が全PASS。本番ビルドも成功を確認。
  スクリーンショットで「敷地の外が青、中が緑」「池・生垣・懸垂バー・アーチ・噴水が
  Lv1〜5で段階的に増えていく」ことを目視確認済み。

- **Wave F-2（クラブハウスの6部屋間取り化・完了）**：Sonnetで設計・実装（既存の幾何を
  読み解けば座標変更が不要と判明したため、Opusでの再診断は不要と判断）。ユーザーの
  「内装を充実させてほしい(普通の建築物のような部屋割りで、部屋ごとに各機能のイメージ。
  機能のない部屋もあって良い)」という要望のうち、F-1に続く2段階目。事前のAskUserQuestionで
  「6部屋程度（機能4＋空き2）」を選択済みだったため、追加の要件確認はせず、既存の
  クラブハウスfootprint（w:5〜14, l:-3.5〜4.5）の実座標を読み解いた上で設計してから実装した。
  **グリッド設計**：footprintを3列(w軸)×2行(l軸)に機械的に等分すると、既存4持ち場の座標が
  一切動かさずに列0(w5〜8：training/mechanic)・列2(w11〜14：medical/scout)へ自然に
  収まり、中央列(w8〜11)の2セルがそのまま「空き部屋」になることを確認した（座標の
  偶然の一致ではなく、Wave E-2 redoの時点でクラブハウスfootprint内に4持ち場を左右に
  振り分けて配置していたことに起因）。既存の入口（扉）は中央列・手前行の辺に開いており、
  入って正面が空き部屋という自然な導線になる。
  **新規の純粋関数**（`domain/season/baseViewLayout.js`）：`clubhouseRoomGrid(b,cols,rows)`
  （footprintをcols×rows個の均等なセルへ分割し中心・半径を返す）、`clubhousePartitions`
  （セル境界の間仕切り壁の線分を返す。外壁(backFacePairが選ぶ2面)とは異なる位置になる
  ため重ならないことをNode単体テストで確認）、`wallPanel(w1,l1,w2,l2,height,proj)`
  （footprintに縛られる`isoBoxFaces`とは別に、任意の線分から壁面4頂点を作る汎用ヘルパー）。
  **見た目**：`Room.jsx`の床を単色1枚から6セルの色分け床へ変更（`data/baseViewBuildings.js`の
  `BASE_VIEW_STATIONS`にcol/row/floorTintを追加し、機能ごとに淡い色調＝トレーニング=薄緑・
  メカニック=薄黄・メディカル=薄青・スカウト=薄紫）。セル境界には外壁(高さ40)より低い
  間仕切り壁(高さ16、新設の`BASE_VIEW_ROOM_GRID.partitionHeight`)を追加し、上から中が
  見渡せる高さに留めて普通の間取りらしさを出した。空き部屋2件（新設の
  `BASE_VIEW_EMPTY_ROOMS`、床は中立グレー）には`Station.jsx`に追加した
  `EmptyRoomFurniture`（段ボール箱2つ＋養生テープ風の対角線）を置き、「バグで空」ではなく
  「後々の機能追加用に確保済み」と分かるようにした。
  **当たり判定・カメラは変更なし**：4持ち場のタップ判定(`STATION_QUADS`)・カメラ境界
  (`SCENE_BOUNDS`)はいずれも座標を動かしていないため無変更。空き部屋は`STATION_QUADS`に
  含めず、タップは従来通りクラブハウス床全体へフォールバック（メニュー全体を開く＝
  「まだ専用の遷移先を持たない場所」として扱う）。
  **検証**：Node単体テスト新規70ケース（`clubhouseRoomGrid`のセル面積が footprint全体と
  一致／data層の持ち場・空き部屋のw/l/col/rowが対応セル範囲内に収まる／6セルが持ち場4件＋
  空き部屋2件でちょうど1回ずつ埋まる全単射／間仕切りの本数・位置が外壁と重ならない／
  `wallPanel`の純粋な幾何／持ち場・空き部屋タップの当たり判定が従来のfloor quad内のまま
  変化しない）。既存の`waved_domain`(58)・`waved_data`(96)・`wavee_camera_test`(29)・
  `wavee_room_test`(37)・`menunav`(43)・`wavef1_test`(104)も全PASS（データ層のオブジェクトへ
  フィールド追加しただけで既存の形状検査を壊していないことを確認）。Playwrightは
  `cutover_check`(18)・`wavee_camera_check`(12)・`wavee_room_check`(4)を再検証し全PASS
  （実行時エラー0、持ち場のタップ・カメラのfit/cover挙動とも無回帰）。本番ビルドも成功。
  スクリーンショットで「6部屋が異なる色で区切られ、間仕切り壁越しに什器が見える」
  「空き部屋に段ボール箱が置かれている」ことを目視確認済み。

- **Wave F-2 redo（3列×2行グリッド→玄関/廊下つきの現実的な間取りへの作り直し・完了）**：
  Sonnetで実装（設計判断はユーザーの指摘そのものが設計図だったため、追加のAskUserQuestion
  無しで再設計・着手した）。上記Wave F-2完了直後、ユーザーから「やり直して。出入り口と
  廊下とかを一切考慮してないよね。私は現実的な間取りにしてと指示しました。部屋を均等に
  並べる必要は必ずしもありません」と明確な却下を受けた。3列×2行の均等グリッドは
  「機能4＋空き2」という部屋**数**の合意は満たしていたが、部屋同士がどうやって行き来
  できるかを考慮しておらず、均等割りは「現実的な間取り」の指示にも反していた。
  **作り直した設計**：クラブハウスfootprint（w:5〜14, l:-3.5〜4.5）内に、玄関を入って
  正面に廊下（corridor、w:8〜10.5の縦長の帯、玄関から奥まで貫通）を通し、廊下の左右に
  training/mechanic（左、w:5〜8）・medical/scout（右、w:10.5〜14）を配置、廊下の突き当り
  （奥、l:3.2〜4.5）に小さな納戸2部屋（空き部屋のspare1/spare2、廊下を2分する形）を置いた。
  部屋のサイズは統一せず、機能に応じて手作業で決めた（例：medical/scoutは廊下の外側の
  分だけtraining/mechanicより幅が広い）。既存4持ち場の座標（Wave E-2 redo以来変更なし）は
  すべて対応する新しい部屋の範囲内に収まったため、什器は一切動かしていない。
  **データ構造の作り直し**：均等グリッドを機械的に生成していた`clubhouseRoomGrid`/
  `clubhousePartitions`（domain層）は死にコードになったため削除し（CLAUDE.md §5）、
  代わりに`data/baseViewBuildings.js`に手作業の矩形リスト`BASE_VIEW_ROOMS`（7区画：
  4持ち場＋corridor＋spare1/spare2、面積の合計がfootprint全体とちょうど一致＝隙間なく
  重なりなく敷き詰めてある）と、間仕切り壁の線分リスト`BASE_VIEW_PARTITIONS`を新設した。
  廊下と各持ち場を隔てる壁（w=8/w=10.5）は、持ち場ごとの出入り口ぶんだけ意図的に
  セグメントを分けて「隙間＝扉」を表現している（壁を描かない区間がそのまま開口部になる、
  というRoom.jsxの間仕切り描画の性質をそのまま利用）。`wallPanel`（線分から壁面を作る
  汎用ヘルパー）はそのまま再利用できたため変更していない。
  **検証**：Node単体テストを全面的に書き直し（新規84ケース）。旧テストが「均等な6セル」
  を前提にしていたため書き直しが必要だった。新規テストの要点：①7区画の面積合計が
  footprint全体と一致し、どの2区画も内部で重ならない（隙間なく敷き詰められている数学的
  保証）②持ち場・空き部屋の座標が対応する部屋の範囲内に収まる③**玄関の扉の位置が廊下の
  w範囲と重なる**＝玄関→廊下に直結している④**各持ち場について、廊下側の壁の「隙間
  （壁が描かれない区間）」がその持ち場のl範囲に届いている**＝廊下から実際に出入りできる
  ことを壁セグメントの被覆区間から機械的に算出して確認（このテストが今回の核心＝
  「出入り口・廊下を考慮する」という指摘に対する機械的な裏付け）⑤間仕切りが外壁の位置
  と重ならない。既存の`waved_domain`(58)・`waved_data`(96)・`wavee_camera_test`(29)・
  `wavee_room_test`(37)・`menunav`(43)・`wavef1_test`(104)も全PASS。Playwrightは
  `cutover_check`(18)・`wavee_camera_check`(12)・`wavee_room_check`(4)を再検証し全PASS
  （実行時エラー0）。本番ビルドも成功。スクリーンショットで「玄関から廊下が奥まで
  貫通し、廊下の左右に4部屋、突き当りに小さな空き部屋2つ」という間取りが実際に視認
  できることを確認した。

- **Wave F-2 redo 追補（各部屋への小道具追加・完了）**：Sonnetで実装。上記の間取り作り直し
  直後、ユーザーから「部屋の間取り的に人が生活してる感がない。ショールームみたいに感じる」
  と重ねて指摘を受けた。原因は間取りそのものではなく、各部屋に主要什器
  （`BASE_VIEW_STATIONS`の机・ローラー等）が1つだけ置かれ、床の大部分が空いたままだった
  こと＝「展示品を1点だけ置いた見せ場」に見えていた点と判断した。
  **対応**：機能ごとに小道具を2〜3個ずつ壁際・隅へ追加した。トレーニング室＝予備ウェイト・
  丸めたマット・ボトル&タオル、メカニック室＝予備ホイール・パーツクレート・散らばった
  ボルト（作業台のすぐそばに意図的に配置）、メディカル室＝赤十字の薬品棚・待合の椅子・
  サイドテーブル、スカウト室＝選手写真のコルクボード・書類の束・来客用の椅子、廊下＝
  玄関そばの靴棚・敷物。新設の`components/base/Clutter.jsx`（`data/baseViewBuildings.js`の
  `BASE_VIEW_CLUTTER`をkindごとに描画。Props.jsx/Station.jsxと同様、isoBox等の描画
  ヘルパーを自前で持つ既存方針を踏襲）で実装し、`BaseView.jsx`の「クラブハウス」atomic
  drawOrderエントリ内（床→壁→什器の**後**）に追加して、Wave E-2 redoで踏んだ
  「什器が床に埋もれる」z順序バグを再発させないようにした。
  **検証**：Node単体テスト新規58ケース（小道具keyの重複なし／各小道具が対応する部屋の
  範囲内に収まる／散らばったボルト以外は同室の主要什器と十分離れている＝重ならない／
  4つの機能部屋すべてに小道具が2つ以上ある）。既存の全スイート（domain 58・data 96・
  camera-math 29・room-quad 37・menunav 43・wavef1 104・wavef2b 84、計451件）も全PASS。
  Playwrightは`cutover_check`(18)・`wavee_camera_check`(12)・`wavee_room_check`(4)を
  再検証し全PASS（実行時エラー0）。本番ビルドも成功。スクリーンショットで各部屋が
  「主要什器＋周辺の小道具」で埋まり、単体展示のショールーム感が解消されたことを
  目視確認した。

- **Wave F-2 redo 追補2（小道具の再改良・浮遊バグ修正・完了）**：Sonnetで実装。前項の
  小道具追加後、ユーザーから「それっぽく見えないし、レイヤーもミスってる」「追加や改善を
  するなら実物を確認してからクオリティを上げてください」と明確な却下＋やり方への指摘を
  受けた。従来の実装（`isoProject`の地面点から手加減のpxオフセットで小物を描く方式）を
  実機スクショで確認したところ、支える箱や影を持たない小物（予備ホイールの輪・丸めた
  マット・コルクボード）が宙に浮いて見え、しかもクラブハウス全体の見出しバッジ（奥角
  w5,l4.5付近の🏠）と重なっていたことが判明した。
  **今回はユーザー指示通り「実物を確認してから」進めた**：Playwrightでカメラのtransformを
  DOMから読み取り、目的のworld座標がview中心に来るようピクセル精度でパン→スクショという
  手順（今セッション確立済みの「ピクセル精度タップ」と同じ技法をパンへ応用）を用いて、
  各部屋を実際に大きくズームして目視診断した。
  **設計変更**：`components/base/Clutter.jsx`を全面書き直し。どの小道具も必ず`isoBox`
  （実什器と同じ箱＋影）を土台に持たせ、装飾はその箱の天面座標
  （`isoBoxFaces(...).top.N`）へアンカーする方式に統一し、土台の無い"浮遊アイコン"を
  廃止した。ユーザー要望の「机と椅子とかホワイトボードとか」に応え、スカウト室に
  机の脇へ寄せた椅子（`chairNode`）とホワイトボード（`whiteboardNode`。archNode/gymNode
  と同じ実績のある「2本脚＋パネル」の描き方を踏襲）を新設。効果の薄かった
  `boltsScatter`・`matRoll`（浮遊バグの主因）・`corkboard`（同）・`rug`は削除し、
  質を優先して項目数を減らした。
  **実機診断で見つけた実バグ（1件）**：`medical-chair`（旧位置 w10.9,l-0.6）がメディカル
  室のバッジ（⚕アイコン、ベッド上方24px）とscreen座標でほぼ完全に重なり、宙に浮いて
  見えていた。原因はアイソメ投影の性質——world座標では什器から1.5ユニット離れていても、
  差がほぼl方向（＝screen y方向）に集中していたため、バッジのy位置（什器のy-24px）と
  偶然一致してしまっていた。世界座標のユークリッド距離だけでは検知できない類のバグ
  （実際、旧バージョンのテストは通っていた）。`w=10.9,l=-2.6`（l方向の差を減らし、
  w方向の差を増やす）へ再配置して解消し、マーカーオーバーレイ（目的の小道具のworld座標に
  赤丸をSVGへ直接注入してスクショする診断手法）で実際に位置がズレたことを目視確認した。
  **恒久対策**：`step13_wavef2_clutter_test.mjs`に「各持ち場の見出しバッジのscreen座標
  bbox（Station.jsxの`translate(label.x,label.y-24)`・16x14pxを再現）と、同室の全小道具の
  screen座標が重ならない」ことを機械的に検算する新規テストを追加し、同種のバグが再発したら
  Node単体テストの時点で検知できるようにした。
  **検証**：Node単体テスト71ケース（key重複無し／各小道具が対応部屋の範囲内／什器との
  距離／同室の小道具同士の距離／**見出しバッジとのscreen座標非衝突**／機能部屋4室すべてに
  2つ以上／ホワイトボードとスカウト室の椅子の存在）。既存の全スイート（計451ケース）も
  再検証し全PASS。Playwrightは`cutover_check`(18)・`wavee_camera_check`(12)・
  `wavee_room_check`(4)を再検証し全PASS。本番ビルドも成功。パン→ズームのスクリーンショット
  を各部屋・複数アングルで撮り直し、什器がすべて箱＋影の上に乗って自然に見えること、
  バッジとの重なりが解消されたことを目視で最終確認した。

- **Wave F-2 redo 追補3（形状デザインの作り直し・完了）**：Sonnetで実装。追補2完了後、
  ユーザーから「そもそもの形状が単純な立方体だったり、円状のものと棒が組み合わさった
  何かだったり、長方形の何かだったり、そう言うデザイン部分が全く足りていない。実物の
  画像を調べながら改善して欲しい。プラスで、浮いているように見えるオブジェクトもある」
  と、形状そのものの作り込み不足を指摘された。
  **調査**：WebSearchでアイソメ/フラットアイコンにおけるダンベル・オフィスチェア・
  自転車の車輪の一般的な意匠傾向を確認したが、得られたのはストック素材サイトの一覧の
  みで実画像は閲覧できなかった。実質的な「実物を確認しながらの改善」は、本セッションで
  確立済みのPlaywright手法（カメラtransformをDOMから読み取りピクセル精度でパン→
  スクショ）で**自分の描画結果を実機で繰り返し目視検証する**形で行った（外部の写真より、
  実際にゲーム内でどう見えるかを直接確認する方が効果的と判断）。
  **形状の作り直し**：単一の箱・単一の円といった「部品1つ」ではなく、実物を特徴づける
  シルエットを複数要素で組む方針に転換。
  - 自転車の車輪：`wheelIcon`ヘルパー（タイヤの太い暗色リング＋リムの細い明色リング＋
    スポーク3本＋ハブ）を新設し、`Station.jsx`(ローラー台・作業台の車輪)と
    `Clutter.jsx`(予備の車輪)の両方で共有的に使用（ファイルごとに実体は複製、既存の
    「各ファイル自己完結」方針を踏襲）。
  - ローラー台：円2つだけだった旧版を、後輪(車輪アイコン)＋そこから伸びるフレーム
    三角形（トップチューブ・シートチューブ・後方ステー）へ。
  - 作業台：斜め線1本+円2つだった旧版を、前後の車輪(車輪アイコン)＋フレーム三角形
    （シート・ヘッド・BBを結ぶ3本の線）＋固定スタンドの支柱へ。「自転車を修理している」
    と一目で分かる構成にした。
  - トレーニング室の小道具：棚+楕円2個（weightRack）を、床置きのダンベル2個（太いバー+
    両端の丸い錘を2枚重ねて厚みを表現）へ（`dumbbells`）。
  - メカニック室の小道具：予備ホイールの浮遊リング（wheelRack）を、車輪アイコンを
    「円の下端が床影に接する」よう高さを計算して壁に立てかけた形（`wheelsLeaning`）へ。
    パーツクレート（partsCrate）を、取っ手のアーチ+顔を出したレンチ・ドライバーのある
    工具箱（`toolbox`）へ。
  - 椅子（`chair`）：箱+背もたれ線1本だった旧版を、4本の独立した脚＋座面＋背もたれ
    パネルの3要素構成へ全面作り直し（「単純な立方体」批判の最大要因だったため優先）。
  - 薬品棚（`cabinet`）：棚板2段の線＋小さな薬瓶（点）を追加。
  - ホワイトボード（`whiteboard`）：キャスター(小さな影の楕円)とマーカートレー＋
    マーカーの点を追加し「移動式」の特徴を足した。
  - 書類の束（`folders`）：単一の箱だった旧版を、色違いの3枚を扇状にずらして重ねる
    構成へ。
  - 靴棚（`shoeRack`）：楕円2つだった靴を、つま先の尖った靴のシルエット（path）へ、
    棚板も追加。
  **検証**：既存のNode単体テスト（`step13_wavef2_clutter_test.mjs`のkey/room/座標系の
  検証は形状変更の影響を受けないため、kind名の変更のみ反映して71件全PASSを維持）に加え、
  既存の全スイート（計451ケース）・Playwright34項目も再検証し全PASS。本番ビルドも成功。
  Playwrightでのパン→ズームスクリーンショットを部屋ごとに複数回撮り直し、車輪の
  スポーク・椅子の4脚・ダンベルのシルエット・自転車フレームの三角形が実際に判読できる
  こと、すべての要素が影の上に乗り宙に浮いて見えないことを目視で最終確認した。

- **Wave F-3a/F-3c（選手モーション＋常駐スタッフ・完了）**：**Opusで設計・合意 → 同セッションで実装**。
  ユーザー要望「選手の歩く/立つ/椅子に座るモーション（サーキット外は自転車なし）」に対し、
  CLAUDE.md §1に従い**コードを書く前にテキストで設計図を提示して合意**を得た。
  **合意した設計判断（3点）**：①行き先はゲーム状態に連動（疲労の高い選手ほどメディカル室へ
  行きやすい＝拠点を一目見て「誰か医務室にいる＝疲れてるな」と分かる＝装飾ではなく情報になる）
  ②自転車アニメの改良はレース画面にも適用（同じコンポーネントのため追加コストほぼ無し。F-3bで実施）
  ③常駐スタッフ（動かない人）を置く。
  **設計の核＝状態を持たない純関数**：Reactのstateも`useEffect`のタイマーも使わず、
  `riderActivityAt(rider, tSec, ctx)`が時刻だけから位置・モード・ポーズを決める
  （新設`domain/season/riderActivity.js`）。既存の`riderLoopPoint(id, tSec, ...)`と同じ流儀。
  利点：(a)メニューを開くと`elapsed`が止まるのでポーズも自然に静止する（既存の一時停止機構が
  そのまま効き、個別の停止処理が不要）(b)「t=37.5秒の選手2は廊下のどこにいるか」をNodeで
  機械的に検算できる (c)`Math.random()`不使用の既存方針を維持。
  1サイクル96秒＝周回50/コース→ラック4/徒歩10/作業18/徒歩10/ラック→コース4。周回に半分以上を
  割くことで、実行時のカウンタを持たずに「常に一定割合だけが屋内にいる」状態が自動的に生まれる。
  **歩行ルートを壁データから導出**：`wallGaps()`で`BASE_VIEW_PARTITIONS`の「壁が無い区間」＝扉を
  算出し、`ラック→玄関→廊下の背骨→扉→持ち場`の折れ線を組み立てる。間仕切りを動かせばルートも
  自動追従し、**壁を通り抜ける経路が原理的に発生しない**。この隙間算出はWave F-2のNode単体
  テストで書いたロジックをdomain層へ昇格させたもので、テストと本番が同じ計算を共有する。
  **椅子に実際に座る**：`workSpotFor()`が同じ部屋に`kind:"chair"`の小物があれば**その椅子の
  座標**を返し座らせる（メディカル室・スカウト室）。無ければ什器の手前に立つ。Wave F-2 redo
  追補で置いた椅子がここで機能した。座り姿勢の腰の高さ(3.0単位=4.5px)は椅子の座面高と一致させてある。
  **人物スプライト（`components/base/Person.jsx`新設）で踏んだ実装上の失敗2件**：
  ①**正面向きで作ってしまった**：初版を正面向きで実装したところ、(a)左右反転しても絵が変わらず
  進行方向が伝わらない (b)歩行が「脚を左右に開いて立っているだけ」に見える、という致命的な問題が出た。
  この世界は`IsoRider`（自転車）が完全な側面図で描かれる「アイソメの地面に横向きスプライトを立てる」
  作法だったため、**真横向きへ全面的に作り直した**。四肢はIsoRider譲りの「丸端の線」にして関節を
  曲げられるようにし、足先を楕円軌道で動かす本物の歩行サイクル（接地中は前→後、離地中は持ち上げて
  後→前）にした。②**頭が肌色の塊に潰れていた**：帽子色がクリーム系の選手だと帽子と肌の明度差が
  ほとんど無く、頭全体が大きな白い塊に見えていた。帽子の色に関わらず常に濃色の**髪**を後頭部に
  入れて解決。あわせて短パンが脚の描画順に隠れて見えていない問題も修正（脚→短パン→胴の順へ）。
  いずれも**実装途中に6倍拡大のプレビューページを立てて目視で発見**したもの（ユーザー指示
  「実物を確認しながらデザインに気をつけて」に従い、小さいまま作り込まず先に拡大検証した）。
  **z順序**：屋内の人物はクラブハウスのatomicな描画グループ内・什器の後に描く（独立して奥行き
  ソートすると不透明な床に埋もれる。Wave E-2で実際に踏んだ罠を設計時点で織り込み済み）。
  **常駐スタッフ（F-3c）**：`BASE_VIEW_STAFF`を新設し、雇っているスタッフ（trainer/doctor/
  scout/manager）が対応する部屋に立つ。選手のジャージ色とは異なる配色（ドクターは白衣、
  マネージャーはスーツ）にして選手と区別できるようにし、向きは各部屋の什器のほうを向くよう
  screen x座標を比較して決めてある。選手が誰も来ていない時間帯でも部屋が無人にならない。
  **検証**：Node単体テスト新規1280ケース。特に重要な3つの不変条件を機械的に固定した——
  (1)**歩行経路が間仕切り壁を通り抜けない**（各壁線分と経路の全隣接サンプルの交差判定。
  「部屋を横断する直線は壁として検出される」という検出器自体の健全性テストも同梱）
  (2)**建物へ入るのは玄関のある辺だけ**（外壁抜けが無い）
  (3)**2周期を通じて位置が連続＝瞬間移動しない**（最大移動量が閾値未満。approach/departの端点を
  周回上の実際の位置に一致させる設計が効いていることの裏取り）。
  加えて「屋内では自転車に乗っていない」「徒歩のときコースの帯の上にいない」（ユーザー要件の
  機械的な保証）、疲労と行き先の相関、平均して2人以上がコース上にいること、スタッフが什器・
  小物・選手の作業位置と重ならないこと等。既存の全スイート（domain 58・data 96・camera 29・
  room 37・menunav 43・wavef1 104・wavef2b 84・clutter 71）とPlaywright 34項目も全PASS。
  本番ビルドも成功。実機スクリーンショットで「疲労85の選手がメディカル室の椅子に座って待って
  いる」「スタッフ4人が各持ち場に常駐」「コース上の周回と屋内の活動が同時に成立」を目視確認した。

- **Wave F-3b（自転車スプライトの作り直し・3姿勢化・完了）**：ユーザーの修正案
  「自転車に乗ってない状態の服装が訳分からん」「ハンドルの位置が低すぎる」
  「通常／ダンシング／スプリントの3姿勢が欲しい」への対応。
  **構造の整理（CLAUDE.md §5）**：`IsoRider`を`components/sprites/IsoRider.jsx`へ切り出した。
  `RaceView.jsx`が1448行と突出して大きく、かつ**拠点画面(BaseView)が「レース画面」から
  スプライトをimportする**という構造のねじれがあったため。RaceView.jsxからは互換のため
  再exportしており、呼び出し側の書き換えは不要（移設と同時に本ファイルは1385行へ）。
  `CAP_COLORS`も見た目に属するデータなので一緒に移した。
  **ハンドル位置**：旧実装はバーがb=4.9・サドルがb=7.4で、実車ではありえない落差だった。
  車輪半径2.9単位≒33cm換算で寸法を取り直し、バートップをb≒7.0（サドル7.6との落差＝実車相当の
  約8cm）へ引き上げた。フレームもチェーンステー／シートチューブ／ダウンチューブ／トップ
  チューブ／フォーク／シートステーを実車の比率で組み直し、ドロップは弧を描いて下りるパスにした。
  **3姿勢**：`posture`引数で`normal`（サドルに座り上ハンドル・上体はそれほど低くない）／
  `dancing`（腰をサドルから上げた立ち漕ぎ・上ハンドル・車体を左右に振る）／
  `sprint`（姿勢を低くして下ハンドルを握る）を切り替える。姿勢ごとに**腰・肩・頭・手の
  4点だけ**を定義し、膝と肘は**2関節の逆運動学**で解く（姿勢ごとに全部の線を手で置き直さなくて
  よい）。クランクは実際に回り、車輪にはスポークが入って転がる。
  **姿勢の出し分け**：レース画面はアタック中(`surging`)の選手が`sprint`、それ以外が`normal`
  ＝同じ集団の中に姿勢差が生まれ「誰が踏んでいるか」が絵で分かる（ユーザー選択②A）。
  拠点画面は`normal`を基本に、選手ごとに違う周期で断続的に`dancing`を見せる（決定論的）。
  **歩行時の服装**：`Person.jsx`の服が読み取れなかった原因は、短パンと胸を横切る帯の両方を
  個人識別色にしていたため「明るい帯が並ぶだけ」になっていたこと。ビブショーツを黒に固定し、
  脚を素肌＋白いソックス＋暗いシューズにして、個人識別色は帽子・襟・袖口・裾のラインだけに
  絞った。「サイクリングウェアを着た選手」だと一目で分かるようになった。
  **実装中に直したもの**：胴を1本の太い線で描いていたため肩と腰の区別がつかない
  「ソーセージ状の塊」に見えていた（6倍プレビューで判明）。腰側と肩側で幅の違う多角形
  （先細りの四角形）として描き直し、背中側に識別色のラインを1本通す方式に変更した。
  あわせてダンシングの腰の持ち上げが弱く通常姿勢と見分けにくかったため、腰を明確に
  サドル上面より高くし、車体の振り幅も大きくした。
  **検証**：既存の全スイート（Node 1802ケース＋Playwright 34項目）が全PASS。本番ビルドも成功。
  6倍プレビューで3姿勢×ペダル1回転4コマを並べて造形を確認し、実機スクリーンショットでも
  拠点画面の周回・屋内活動が従来どおり動作することを目視確認した。

- **DEVLOG.mdのスリム化（2026-07・完了）**：CLAUDE.md §4に従い、ユーザー承認を得て実施。
  §10（Step13第1〜4弾／Wave D／Wave D2）と§11前半（Wave E-1／E-2／E-2 redo）の本文を
  「件名＋要点1行＋`git show <hash>`での復元方法」の索引形式へ圧縮した。情報はgit履歴に
  残っているため実質的な損失はない。直近かつ現行実装に直結するWave F（F-1〜F-3b）は
  詳細を残した。**146KB→約102KB**（約44KB削減）。

**DEVLOG.mdのサイズについて**：本エントリ追加時点で約102KB。CLAUDE.md §4の目安
「十数万バイト」をまだ超えているため、次に大きな機能追加が一段落した節目で再度サイズを
確認すること。
