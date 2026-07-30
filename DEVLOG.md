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

- **Step7第5弾（B-3の再調査・退行の発見と修正・入力組み立ての抽出）**：Opusで設計、Sonnetで実装。
  「B-3には触らない」という前回までの方針を見直す前に、まず`startRace`/`startNextStage`/
  `mlStartRace`/`mlStartLastRace`（合計約89行）を精読した。
  **自分が作り込んだ退行の発見**：第3弾で`finishRace`をreducer化した際、`rankSim(sim)`が
  `setG`のupdater内（`controllers/season/result.js`側）へ紛れ込んでいた。`rankSim`は`sim`を
  破壊的に変更し、内部の`resolveFinishClusters`が`Math.random()`でジッターを掛けるため、
  updaterが複数回呼ばれると着順が変わり得る＝第3弾・第4弾で潰して回っていた「非冪等な処理を
  updaterに置かない」原則への違反を、その作業中に1つ新設していた。`rankSim(sim)`をApp()側の
  `finishRace`ラッパー（`setG`を呼ぶ前）へ戻して修正した。回帰防止のテストも追加
  （同一simを複数回渡しても結果が完全一致することを確認）。
  **B-3の実態**：4関数のうちテスト価値のある「純粋な入力組み立て」は合計約35行のみで、残りは
  `useRef`ロック・`setTimeout`・`setG`のupdater内での変数密輸（`simResult`/`raceRef`）・
  `buildSim`自体（`Date.now()`シードのRNGを内包）といったv12でstale closureバグを実際に踏んだ
  オーケストレーション。「確実な部分だけ抽出し、ロック/setTimeout/密輸/updater内buildSimには
  一切触れない」案で合意し着手。
  **分割**：`controllers/season/raceStart.js`（`prepareRaceInputs`＝ホームアドバンテージ適用・
  aceId解決・itemBoost/directive算出、`prepareNextStageSquad`＝ステージ中日の疲労回復・
  squad/aceId/roles解決）・`controllers/mylife/raceStart.js`（`resolveNationalRole`＝世界選手権/
  オリンピックでの代表役割判定、`buildLastRaceMeta`＝ラストレースの脚質別テンプレ選択とmeta構築）。
  **検証**：抽出4関数を直接呼ぶ24ケースの単体テストを新規作成（ホーム/アウェイ補正・出走1名時の
  aceId自動決定・複数出走時のsel優先・監督評価の境界値54/55でのnationalRole分岐・未知の脚質での
  フォールバック等を検証）し全PASS。既存Node191ケースと合わせ計215ケース全PASS。Playwrightで
  season側`startRace`（観戦あり→finishRace）、mylife側`mlStartLastRace`（ラストレース→
  `mlLastRaceFinish`→引退画面）を実機で最後まで通過確認、実行時エラー0。main.jsx 1257→1241行。

- **Step7第6弾（グランツール3日目が進行不能になる実バグの発見・修正・PROクラスセーブ注入による
  実機再現テストの新設）**：Opusで設計、Sonnetで実装。第5弾の直後、「B-3の残り（二相化）」の設計に
  入る前にまず現行フローを精読し直したところ、**第3弾で自分が作り込んだ2つ目の退行**を発見した
  （1つ目は第5弾で見つけた`rankSim`の休眠バグ）。今回は休眠ではなく**実際にプレイが止まる実バグ**：
  `stage2LockRef`（次ステージ連打防止ロック）の解除がApp側`finishStage`ラッパー内にのみ置かれていたが、
  スキップ経路（結果だけ見る）は`setTimeout→finishRace→setG(srFinishRace)→controller内部での
  finishStageへの委譲`という経路をたどるためこのラッパーを経由せず、解除漏れが起きていた。
  観戦経路（`raceFinishHandler`→App側`finishStage`）は元々ラッパーを経由するため無傷だった。
  症状：**3日間グランツールをスキップ経路のみで進めると3日目が永久に開始できない**
  （「3日目へ進む →」を押しても画面が無反応）。
  **実機再現**：この時点まで自動テストが存在しない領域だったため、PROクラスのセーブを
  localStorage経由で注入する手法（`classIdx:2`・`month:0`書き換え→リロード→「続きから」）で
  グランツールを強制的に出現させ、実際にブラウザ上でスキップ経路のみを辿って3日目が
  進行不能になることを確認してから着手した（口頭の推測ではなく実機で再現してから直す）。
  **修正**：解除ロジックを「"gc_stage"画面への遷移」を検知する新規`useEffect`へ一本化し、
  App側`finishStage`ラッパー内の解除は削除した。画面遷移そのものを合図にすることで、
  以後どちらの経路（観戦/スキップ）が増えても解除漏れが起きない構造にした（第3〜4弾で確立した
  「画面遷移をrefガード付きで検知するuseEffect」と同じイディオム）。
  **検証**：Playwrightで(A)スキップ経路のみで3日間、(B)観戦経路のみで3日間、の2パターンを実機で
  検証するスクリプトを新設。(A)は修正前に実際に失敗していた「3日目クリック後に画面が変化する」
  というアサーションを含め全項目PASS。(B)は最終的に総合結果画面(gc_final)へ正しく遷移することを
  確認、実行時エラー0（ライブ観戦アニメーションの実時間待ちにより一部の中間アサーションは
  タイミング調整が必要だったが、機能面は完走を確認済み）。既存Node215ケースも全PASS。
  **注記**：本プロジェクトにはテストフレームワーク（Jest/Vitest/Playwright Test等）が導入されて
  いないため、このPlaywrightスクリプトはNode単体テストと同じ「scratchpadに置き、都度実行する」
  慣習を踏襲したものであり、リポジトリにコミットされたCI用テストではない。再現手順自体は
  DEVLOGに残るため、今後B-3の残りに着手する際は同じ手法（PROセーブ注入→スキップ経路で
  グランツール3日間）を再現できる。

- **Step7第7弾（`startNextStage`の二相化・`stage2LockRef`の廃止）**：Opusで設計、Sonnetで実装。
  第6弾末尾の申し送り通り、B-3の最後の危険地帯である`startNextStage`の作り直しに着手した。
  **設計**：Opusとの対話で不確定要素を洗い出した結果、対象は`startNextStage`のみに絞った
  （`startRace`／`mlStartRace`／`mlStartLastRace`は今回も触らない＝第5弾の「案A」を踏襲）。
  加えて2点を事前に確認：①`startRace`の`setTimeout(0)`は今回も外さない（触らない）、
  ②新設するフェーズ2の`useEffect`内で`buildSim`が例外を投げた場合はtry/catchで握り潰さず
  そのまま外へ伝播させる（`pendingStage`が残ったまま止まるが、中途半端な状態を握り潰して
  次の操作を誤動作させるより、壊れていることが画面上も分かる形で止まる方が安全という判断）。
  **旧実装の問題**：`startNextStage`は`useRef`ロック（`stage2LockRef`）で連打を防ぎつつ、
  `setG`のupdater内で`buildSim`を呼び、その結果（`simResult`/`raceRef`）をupdater外側の`let`
  変数へ代入する「密輸」でスキップ経路の`setTimeout`に渡していた。`useRef`はレンダーと無関係に
  生存するため解除のタイミングが本質的にズレやすく（第6弾で実際に解除漏れバグを踏んだ）、
  密輸パターンもupdaterが複数回呼ばれ得ることを前提にすると本質的に脆い構造だった。
  **新実装（二相化）**：フェーズ1＝`controllers/season/raceStart.js`に追加した`beginNextStage(s)`。
  `gc.pendingStage`（次のステージ番号）・`gc.pendingAceId`・`gc.pendingRoles`という「意図」だけを
  `setG`で確定する純関数で、`buildSim`は一切呼ばない。`gc.pendingStage`が既に立っていれば同一参照
  を返してno-op＝これが`stage2LockRef`の代替となる二重発火防止ガード（`useRef`という別チャンネルの
  状態を持つ必要がなくなった）。`gc.stage`自体はフェーズ1では変更しない（`gc_stage`/`gc_role_setup`
  画面が`gc.stage`から「STAGE N 完了」「N+1日目に向けて作戦変更」を表示するため、変更すると
  1フレームだけ表示がずれる）。フェーズ2＝main.jsxに新設した`gc.pendingStage`を監視する
  `useEffect`。`pendingStage`が立った直後にのみ発火し、常に最新の`g`（レンダー確定済みの値）から
  `buildSim`を呼ぶためstale closureの心配がない。ロスター疲労反映と`squad`算出は
  `prepareNextStageSquad`（第5弾で抽出済み）を再利用しつつ、aceId/rolesだけはフェーズ1で確定済みの
  `pendingAceId`/`pendingRoles`を使う（`prepareNextStageSquad`が返すaceId/rolesは捨てる）。
  `startNextStage`自体は`const startNextStage = () => setG(beginNextStage);`という1行の薄い
  ラッパーになった。`stage2LockRef`の宣言・第6弾で追加した解除用`useEffect`・`startRace`内の
  解除呼び出しはすべて削除した。
  **検証**：`beginNextStage`を直接呼ぶ11ケースの単体テストを新規作成（pendingStage/pendingAceId/
  pendingRolesの確定・出走1名時はgc.aceIdへのフォールバック・複数出走時はsel.ace/sel.rolesが
  優先されること・pendingStageが既に立っている状態での二重発火防止no-op・gc自体が無い場合のno-op
  を検証）し全PASS。既存Node215ケースと合わせ計226ケース全PASS。ビルド成功。
  Playwrightは第6弾の(A)(B)に加え、`beginNextStage`のもう一方の呼び出し元である
  `gc_role_setup`画面（出走複数名時の作戦変更ボタン）経由の3日間グランツールを(C)として新設。
  (A)出走1名・スキップ経路のみで3日間（第6弾バグの回帰確認）、(B)出走1名・観戦経路のみで
  3日間（`gc.watch=true`分岐＝フェーズ2の`screen:"race"`側の確認。ライブ観戦アニメーションは
  `PLAY_DUR=56`＝等速で実時間56秒かかる仕様のため、ゲーム内の「スキップ」ボタンで早送りしてから
  検証した）、(C)出走2名・`gc_role_setup`経由で3日間（2日目・3日目の両方でエース再指名→
  「N日目のレースへ →」ボタンをクリックし、都度画面が正しく変化し最終的にgc_finalへ遷移することを
  確認）。3シナリオ計38項目・実行時エラー0で全PASS。main.jsx 1254→1233行。

- **Step7第8弾（B-3の残り全部を解消・`startRace`の実バグ発見/修正・`mlRaceLockRef`廃止）**：
  Opusで設計、Sonnetで実装。B-3最後の3関数（`startRace`／`mlStartRace`／`mlStartLastRace`）に
  着手する前に精読したところ、3関数は「同じ危険地帯」ではなく問題の性質がバラバラだと判明した：
  `buildSim`はどれも既にupdaterの外（第7弾以前から）で呼ばれており「updater内buildSim」問題は
  無かった。残っていたのは①`startRace`にはそもそも連打防止ガードが無かった、②`mlStartRace`／
  `mlStartLastRace`は`mlRaceLockRef`（useRefロック）で防御されてはいたが、そのrefが
  `screens/mylife/race.jsx`まで漏れている（層の逆流）、の2種類。
  **自分が見つけた実バグ**：`startRace`を高速2連打すると、コミット前（1レンダー分）に
  `setG(u1)`/`setG(u2)`が両方キューされ、`inv.wheel`/`suit`の二重消費に加えて
  `setTimeout`も2回スケジュールされ`finishRace`が2回走り、**賞金・ポイントが二重加算される**
  実バグがあった。着手前にPROセーブ不要の通常フローでbutton.click()を同一tick内で2回発火させる
  手法（真の連打の再現。Playwrightの`.click()`は1マウス操作ずつ直列処理するため代用にならない）
  で実機再現し、`careerStats.totalRaces`（finishRace1回につき必ず+1されるRNG非依存の不変量）が
  連打1回で2になることを確認してから着手した。
  **修正**：
  1. `startRace`：`setTimeout(0)`を廃止し、`setG`のupdaterに`s.screen !== "lineup"`のno-opガードを
     追加。結果確定（旧：setTimeoutからの直接`finishRace`呼び出し、および`startNextStage`
     フェーズ2からの直接呼び出しの計2箇所）を、`"result_pending"`画面への遷移を検知する
     新規`useEffect`1箇所へ統合した。
  2. `mlStartRace`／`mlStartLastRace`：`mlRaceLockRef`を廃止し、「ロックがtrueの間＝
     `screen ∈ {mylife_startlist, mylife_race}`」という不変条件（開始ボタンは両方とも
     `mylife_main`画面にしか無いため常に成立）に基づき、画面状態そのものをガードにする方式へ
     変更した。関数先頭の早期リターンは無駄なsim構築を避けるだけで、二重発火防止の本命は
     `setMl`のupdater内での再チェック（updaterは常に最新のsを受け取るため、連打の2発目は
     ここでno-opになる）。`mlStartRace`の`races`更新／`result`更新は`setMl`1回に統合した。
     `screens/mylife/race.jsx`のキャンセルボタンから`mlRaceLockRef.current = false`を削除。
  **設計時に発見した潜在バグ（着手前に設計段階で潰した）**：`"result_pending"`監視の新規
  `useEffect`を単純に「`g.gc`があればステージレース」という判定で書くと、**グランツール完走後も
  `g.gc`がクリアされず残留する**ため、その後に単発レースをスキップ経路で始めた場合に古い
  `gc.race`／`gc.stage`を誤って参照してしまう（旧`startRace`のsetTimeoutは呼び出し時に捕捉した
  `race`のローカル変数を使っていたためこの問題が無かった）。判定を`g.result.raceMeta.stageRace`
  （今まさに確定させようとしているレースそのものの性質・常に正しい）だけに絞り、`g.gc.stage`は
  「`raceMeta.stageRace`がtrueの場合に限り」参照する形にして回避した（この場合は`startRace`／
  `startNextStage`フェーズ2のどちらも必ず`gc.race === raceMeta`を保って更新するため安全）。
  **検証**：`startRace`の連打を高速2連打で再現するPlaywrightスクリプトを新設し、修正前ビルド
  （`git worktree`で第7弾コミットを別ディレクトリにチェックアウトして比較）では
  `careerStats.totalRaces`が2（バグ再現）、修正後ビルドでは1（修正確認）になることを実機で
  確認した。`mlStartRace`／`mlStartLastRace`は`ml.player.raceLog.length`（同じくRNG非依存の
  不変量）を自動セーブ経由でlocalStorageから直接読み、連打しても1のままであることを確認
  （13/13・7/7項目PASS）。mylife側の「出走を取りやめる→再出走」導線もロック解除漏れなく
  動作することを確認。第7弾のグランツール回帰スクリプト3本（(A)スキップ・(B)観戦・
  (C)`gc_role_setup`経由、計38項目）も再実行し全PASS（`startRace`／`startNextStage`フェーズ2の
  両方を触ったため必須の再検証）。さらに「グランツール完走直後に単発レースをスキップ経路で
  開始する」という上記の潜在バグのシナリオも新規Playwrightスクリプトで検証し、正しく
  `result`画面（`gc_stage`ではなく）へ到達することを確認した。既存Node226ケースも全PASS、
  ビルド成功。main.jsx 1233→1259行。
  **今回スコープ外として残した既知の類似パターン**：`raceFinishHandler`
  （`if (g.gc && g.gc.race.stageRace) finishStage(...) else finishRace(...)`）も同じ
  「`g.gc`の残留」による誤判定の可能性を理論上は持つ（観戦経路でグランツール完走後に単発レースを
  観戦した場合）。今回の設計・実装の対象外だったため意図的に手を付けていない。次にこの関数に
  触れる機会があれば、同じく`g.result.raceMeta.stageRace`を判定に使う形へ揃えることを検討する
  価値がある。

**B-3は今回で全て解消した**（`startRace`／`startNextStage`／`mlStartRace`／`mlStartLastRace`の
4関数すべてが二重発火に対して安全になり、`useRef`ロック[`stage2LockRef`・`mlRaceLockRef`]は
両方とも廃止された）。

- **Step7第9弾（`ctx`フック化に先立つ調査・mylifeハンドラ586行のcontroller/domain抽出）**：
  Opusで設計、Sonnetで実装。ユーザーから「`ctx`89メンバーの手組み解消の設計」を依頼されたが、
  着手前にmain.jsxの中身を機械的に棚卸ししたところ、**hook化を今すぐやると危険**なことが判明した。
  main.jsx 1259行のうち586行（`mlCreateChar`237行を筆頭に、キャラ作成・イベント・キャリア分岐の
  クラスタ）がStep7第2〜3弾の対象から漏れ、`function mlXxx()`のまま生で残っていた
  （Step8のscreens分割はJSXディスパッチのみが対象で、App()内のロジックには手を付けていなかった
  ため）。この586行を先にcontroller/domain抽出しないと、hookは「main.jsxをhooksファイルに
  改名しただけ」になってしまう。加えて、`superMode`分岐直下（モード選択／生涯評価／系譜／因子／
  CPショップの5画面・205行）もStep8の分割から漏れていることも判明したが、今回は対象外とした
  （下記「残っている候補」参照）。
  **調査で分かった好材料**：対象20ハンドラのうち18個が既に`setMl(s => ...)`1回・外側`ml`読み
  ゼロの純reducer形だった。`useRef`ロック・`setTimeout`・localStorage書き込みもこの領域には
  一切無く（`mlCreateChar`の`loadMeta()`読み取りのみ）、season/mylifeの画面分離も機械検証で
  ほぼ完璧と確認済み（mylife画面が使うseason系メンバーはわずか5つ、うち`setG`の使用は
  「選手→監督の転身ブリッジ」1箇所のみ）。B-3（第3・第5〜8弾）ほど危険な領域ではなかった。
  **分割**：`mlCreateChar`（237行のジェネレータ）は`mlGenRace`と同じ理由で`controllers/`ではなく
  **`domain/mylife/createChar.js`**へ。`loadMeta()`はApp側で呼びcpMetaとして引数で渡す方式に
  正規化した（呼び出し側だけがlocalStorageに触れる。第5弾のprepareRaceInputsと同型）。
  キャリア分岐（`mlChooseTeam`／`mlRetireAdvice`×3／`mlResolveOffseason`／`mlContinueAfterOffseason`／
  `mlResolveCrossroads`／`mlContinueAfterCrossroads`／`mlBecomeMentor`）は
  **`controllers/mylife/career.js`**へ。イベント系（`mlTriggerEvent`／`mlTriggerSponsorGig`／
  `mlResolveEvent`／`mlResolveProtegeEvent`／`mlResolveRivalScene`／`mlRivalSceneContinue`＋
  内部ヘルパー`mlApplyEventEffects`／`eventEffectSummary`）は**`controllers/mylife/event.js`**へ。
  正規化が必要だったのは2つのみ：①`mlRivalSceneContinue`（旧実装は外側の`ml`を読んで分岐し
  `setMl`を2回＋`mlAdvanceMonth`を呼ぶ3呼び出しだったのを、`mlAdvanceMonth`（既存controller）を
  そのまま合成する1つの純reducerへ統合）、②`mlUseStockConfirm`は`askConfirm`（UIダイアログ）に
  依存するためApp側に残した（第2弾で同じ判断をした前例あり）。`mlCreateArgsRef`（リセマラ用）・
  `mlRerollCandidate`／`mlConfirmCandidate`（refに依存）も同様にApp側据え置き。
  **検証**：抽出した関数を直接呼ぶ61ケースの単体テストを新規作成（`mlCreateChar`の師弟/配合
  デビュー・cpMeta特典反映・`mlBecomeMentor`の弟子生成とno-opガード・`mlChooseTeam`の昇格/降格と
  チームメイト再生成・`mlRetireAdvice`3分岐・`mlResolveOffseason`→`mlContinueAfterOffseason`の
  連鎖・`mlResolveCrossroads`→`mlContinueAfterCrossroads`の連鎖・イベント効果の反映と整形・
  `mlRivalSceneContinue`が号外の有無で`mlAdvanceMonth`合成と直接一致することを検証）し全PASS。
  既存Node226ケースと合わせ計287ケース全PASS。ビルド成功、dead import 33個も併せて削除。
  Playwrightは実UIでのキャラ作成→取材イベントの一気通貫に加え、引退勧告・オフシーズン・人生の
  岐路は「何年もプレイしないと到達しない画面」のため、season側PROセーブ注入と同じ手法の
  **mylife版**（`roadrace_v12_mylife_save`へ直接JSON注入し「続きから」で任意のキャリア局面を
  再現）を新設して検証した（メンター就任・弟子イベント・引退勧告3分岐・オフシーズン・人生の
  岐路(結婚)の計50項目、実行時エラー0）。**注記**：検証スクリプト作成中、`pendingOffseason`に
  `{player,year,flags}`だけの断片を注入してクラッシュさせてしまったが、これは
  `mlContinueAfterOffseason`が`{...po,...}`で新stateをまるごと採用する実装（`pendingOffseason`は
  実際には年度末処理が作る完全なstateスナップショット）を把握せずテスト側のモックを簡略化した
  ことが原因で、本体側のバグではないと確認した（テスト側を修正して解消）。Wave 8のmylife連打
  防止回帰（13/7項目）・season側グランツール回帰（26項目）も再実行し全PASS。main.jsx 1259→822行。

- **Step7第10弾（`ctx`89メンバーの手組み解消・`useAppShell`/`useSeasonGame`/`useMyLifeGame`への
  フック化・OBコーチ選択時のライブクラッシュバグ発見/修正）**：Opusで設計、Sonnetで実装。
  第9弾完了直後にユーザーから直接依頼された作業。着手前にmain.jsx（822行）を棚卸ししたところ、
  season/mylifeの状態分離が既にほぼ完璧（useEffect14個のうちseason/mylife混在ゼロ、UI状態4組
  全てseason専用、season画面が使う`ml*`系メンバーはゼロ）と判明し、B-3や第9弾ほどの危険は
  無いと確認してから設計・実装した。両モードの本当の結合はmylifeの`career.jsx`にある
  「選手→監督の転身ブリッジ」（引退した殿堂選手を新チーム監督として招聘し、season側の
  `setG`/`initGame`を直接呼ぶ）1箇所のみだった。
  **設計判断（ユーザー選択）**：①ctxをseason/mylifeに分割し、season画面にmylifeハンドラを
  一切渡さない（層の逆流を構造的に不可能にする）。②`superMode`直下のメタ画面5つ
  （モード選択／生涯評価／系譜／因子／CPショップ・205行）は今回のフック化のスコープ外とし
  次のウェーブへ回す。
  **分割**：`hooks/useAppShell.js`（`superMode`／`confirmDialog`／`renameState`／`uiTick`＋
  `askConfirm`／`openRename`／`buyCpItem`。両モードから共有される3メンバーのみ）、
  `hooks/useSeasonGame.js`（`g`/`setG`＋season専用UI状態4組＋派生値＋season effect8個＋
  seasonハンドラ全部。外部依存なし）、`hooks/useMyLifeGame.js`（`ml`/`setMl`＋
  `mlCreateArgsRef`＋mylife effect6個＋mylifeハンドラ全部。引数は`{ superMode, askConfirm }`
  の2つのみ）。転身ブリッジは`career.jsx`内の直書き`setG`/`setSuperMode`呼び出しを、
  App()側で組み立てた`becomeManager()`コールバック1つに置き換えた（今回唯一の実質的な
  配線変更）。chrome（`Header`/`Nav`/`renameModal`/`wrap`/`mlWrap`）とメタ画面5つはApp()に
  残置。ctxは`{ ...shellForScreens, ...season, wrap }`（season向け）／
  `{ ...shellForScreens, ...mylife, mlWrap, becomeManager }`（mylife向け）の2種類に分割し、
  手組みの88行は消えた。
  **副次的に発見した実バグ（OBコーチ選択で全画面クラッシュ）**：main.jsxを精読中、Header内の
  `{g.obCoach && <>／OBコーチ -{OB_COACH_SALARY}万/月</>}`が`OB_COACH_SALARY`を一切
  importしていないことを発見した（過去waveのdead import削除で誤って巻き込まれたと推測される。
  この識別子は`m.overall`のようなプロパティアクセスと単語境界が一致するため、これまでの
  機械的なdead-import検出では見逃されていた）。`Header`は全画面で常時レンダリングされるため、
  **OBコーチを1人でも雇うと即座に白画面クラッシュする**、本番相当のライブバグだった。
  localStorage注入で`g.obCoach`を設定した状態を実機再現し（修正前：`ReferenceError:
  OB_COACH_SALARY is not defined`が3回連続で発生）、`data/economy.js`からの1行importを
  追加して修正・再現テストで解消を確認した。今回の主目的（hook化）とは独立した発見のため、
  DEVLOGでも別枠として明記する。
  **検証**：この作業特有のリスク（分割代入は欠けたキーを`undefined`にするだけでビルドエラーに
  ならず、そのボタンを押した瞬間に初めてクラッシュする）に対応するため、通常の検証に先立って
  **機械的な突合スクリプト**を作成・実行した——①全`screens/**/*.jsx`の`const {...} = ctx;`を
  パースして各画面が要求するctxメンバーを抽出、②season/mylifeそれぞれの実際の提供メンバーと
  突合し不足ゼロを確認、③season画面が`ml*`系を使っていないか／mylife画面が`g`/`setG`を
  使っていないかの層の逆流チェック。3つとも一発でPASS（season:要求51/提供54・mylife:要求
  41/提供43・逆流ゼロ）。その上で既存Node287ケース全PASS、ビルド成功。Playwrightは
  第7弾のグランツール回帰（(A)(B)(C)計38項目）・第8弾のmylife/season連打防止回帰
  （13/7/26項目）・第9弾のmylifeセーブ注入50項目を**全部再実行**（App()全体を作り替えたため
  必須）、さらに転身ブリッジ専用の新規シナリオ（引退画面→「監督として新チームを率いる」→
  newgame_setup遷移）を追加、合計114項目・実行時エラー0で全PASS。main.jsx 822→365行、
  `hooks/`3ファイル合計537行を新設。

- **Step7第11弾（`superMode`メタ画面5つの`screens/meta.jsx`分離・クローム
  （Header/Nav/モーダル/wrap/mlWrap）の`components/chrome.jsx`分離・系譜/因子ビューの
  season/mylife共通化）**：Opusで設計、Sonnetで実装。第10弾で意図的にスコープ外とした
  `superMode`直下のメタ画面5つ（モード選択／生涯評価／系譜ツリー／因子図鑑／CPショップ・
  203行）に着手。調査の結果、メタ画面がApp()外から必要とするメンバーはわずか4つ
  （`superMode`/`setSuperMode`/`buyCpItem`/`wrap`）で、依存の向きも
  `screens/meta.jsx → logic/state/breeding/components/data`の一方向のみと判明し、
  season/mylifeのフック分割（第10弾）よりも危険度の低い、単純な切り出しだった。
  併せて、`main.jsx`の`dynasty_lineage`/`dynasty_factors`と
  `screens/mylife/career.jsx`の`mylife_lineage`/`mylife_factors`が約9割同一のJSXを
  2箇所で保守していたこと（差分は見出し要素・空状態文言・`position:relative`の有無・
  戻るボタン先の5点のみ）も発覚。ユーザーはメタ画面分離とクローム分離を同時に行う案、
  および系譜/因子の共通化も今回まとめて行う案の両方を選択した。
  **分割**：`screens/meta.jsx`（メタ画面5つのディスパッチ＋各画面のレンダ関数）、
  `components/chrome.jsx`（`SeasonHeader`/`SeasonNav`/`RenameModal`/`ConfirmDialog`＋
  それらを束ねる`makeWrap`/`makeMlWrap`ファクトリ）、`components/dynasty.jsx`
  （`LineageForestView`/`FactorCollectionView`。差分は`variant`props＋呼び出し側が渡す
  `footer`で吸収）。`wrap`/`mlWrap`はファクトリ化した上で呼び出し側の形
  （`wrap(children, withNav)`）を変えていないため、`screens/season/*.jsx`・
  `screens/mylife/*.jsx`は無変更。副産物として、旧`wrap`/`mlWrap`内にバイト単位で
  完全一致する確認モーダルJSXが2箇所独立に存在していた（`main.jsx`旧105-115行目と
  134-144行目、`diff`で一致確認済み）ものを`ConfirmDialog`1つに統合した（出力DOM不変）。
  `main.jsx`は365→48行（合成ルートのみ）に、`career.jsx`は504→454行になった。
  **検証**：Header/Navをモジュールスコープの独立コンポーネントへ切り出すとReactの
  差分検出アルゴリズムが型で同一視するため、従来App()内で定義されていた頃（毎レンダ新しい
  関数式＝型が変わり続けアンマウント/リマウントされていた）と挙動が変わる可能性
  （特に`renameModal`内の非制御`<input autoFocus>`のフォーカス維持）を設計段階で洗い出し、
  重点的に検証した。前回のOB_COACH_SALARY事件（単語境界の正規表現マッチングがdead-import
  検出を欺いた）を踏まえ、今回は**静的チェックを主軸に据えず**、`Date.now`/`Math.random`を
  決定的なシード付き実装へ差し替えた上でリファクタ前後のDOM（`#root`配下の`innerHTML`、
  空欄markup属性値の正規化のみ）を**バイト単位で比較**する手法を主軸にした。メタ5画面×2
  フィクスチャ（未プレイ／殿堂・系統tier0〜3・世代・因子★超過・CP購入可否等を網羅した
  リッチフィクスチャ）＋season/mylifeの主要画面＋改名・確認モーダル展開状態、計23スナップ
  ショットが全てリファクタ前後でバイト完全一致した。加えてDOM比較では捕まらない
  「onClick内シンボル欠落」「フォーカス喪失」のクラスに対応するため、メタ画面の全遷移
  ボタン・Nav全タブ・CPショップの実購入（残高減少と「✓解禁済」表示を確認）・改名モーダルへの
  3文字連続入力（`document.activeElement`がinputのまま保たれ、値が正しく累積し、Enterで
  反映されることを確認）を実機で走査し22/22 PASS。既存Node287ケース全PASS、ビルド成功。
  Playwrightは第7弾グランツール回帰（26+12項目）・第8弾season/mylife連打防止回帰
  （13項目）・第9弾mylifeセーブ注入（50項目）・第10弾becomeManagerブリッジ（6項目）を
  全再実行し全PASS、OBコーチクラッシュ修正の再現テストも実行時エラー0を再確認した。

- **Step7第12弾（`raceFinishHandler`の`g.gc`残留誤判定の修正・二重`rankSim`呼び出しの削除）**：
  Opusで設計、Sonnetで実装。第8弾で発見しスコープ外としていた`raceFinishHandler`
  （`if (g.gc && g.gc.race.stageRace) finishStage(...) else finishRace(...)`）の理論上の
  誤判定に着手。設計前の調査で、当初の想定と2点食い違うことが判明した。
  **調査結果1（到達可能性）**：`advanceMonth`の全5return経路（通常月／年度末通常／
  グランファイナル制覇／poachOffer／transferRequest／event）が例外なく`gc: null`を返すこと、
  `SAVE_FIELDS`に`"gc"`が含まれないためロードでも常に`gc: null`になること、`gc`設定中の
  5画面（race/result_pending/gc_stage/gc_role_setup/gc_final）から`main`へ戻る導線が
  1本も無いことを機械的に確認し、**現行UIからは到達不能**（潜在バグ）と確定した。ただし
  「コードに書かれていない暗黙の大域不変条件」に安全性が依存している状態のため、修正自体は
  引き続き価値がある（将来GT棄権等の導線が1本増えた瞬間にライブ化し、`recordTitle`の
  誤発火や`gtWins`偽装＝グランファイナル出場条件の不正成立に繋がる）。
  **調査結果2（副次的発見）**：`buildSim`が末尾で既に`rankSim`を1回呼んでいるにも関わらず、
  App側`finishRace`ラッパーがもう1回`rankSim`を呼んでおり、経路によって呼び出し回数が
  不揃い（観戦・ステージ経路のみ1回、残り3経路は2回）だった。実測（200試行）では
  全体着順が27%の頻度で変化するが優勝者・自チーム最高位は0%、自チームいずれかの選手の
  着順が変わるのは2%（賞金素点の変化は平均-1.5、範囲-6〜+6）と、ゲームバランスへの影響は
  極小。一方`RaceView`はレース中`sim.ranked`ではなく`finishTime`を直接描画するため、
  2回目の`rankSim`によって**観戦中に見た着順と結果画面の着順が最頻経路（観戦・単発）で
  ずれ得る**という実害が判明した。ユーザーはこの2点を踏まえ「今回まとめて揃える（観戦側の
  1回だけに統一する）」を選択した。
  **修正**：①`raceFinishHandler`の判定を`g.gc.race.stageRace`から`g.result.raceMeta.stageRace`
  へ変更（`buildSim`が`raceMeta`引数を参照ごとsimへ格納するため、到達可能な全状態で
  `g.result.raceMeta === g.gc.race`＝オブジェクト同一であり、分岐先・rankSim有無とも不変。
  `screens/season/race.jsx`のLIVEヘッダー表示も同じ判定に揃えた）。②App側`finishRace`
  ラッパーから`rankSim(sim)`呼び出しを削除し、全経路を`buildSim`の1回だけに統一した
  （`rankSim`のimportも削除）。
  **検証**：UIから到達不能な変更のため、通常のPlaywright回帰だけでは効果を証明できないと
  判断し、Node単体テストを主軸に据えた（新規20ケース）——(1)`advanceMonth`の全5経路が
  `gc: null`を返すことを固定するテスト（暗黙の不変条件を明示化）、(2)`serializeState`が
  `gc`キー自体を出力しないこと、(3)`initGame`/`loadGame`が`gc: null`を返すこと（`loadGame`は
  セーブに`gc`が紛れ込んでいても常に上書きすることも確認）、(4)潜在バグの直接再現——
  「古いGTの`gc`が残った状態で単発レースのsimが来た」状態を人為的に構成し、旧判定（`true`）を
  採用すると`finishStage`が古いGTのデータで`gc_final`へ誤って進むこと、新判定（`false`）を
  採用すると正しく`finishRace`で`result`へ進むことを実際のreducerで対比、(5)ソースの静的確認で
  `useSeasonGame.js`から`rankSim`のimport・呼び出しが完全に削除されたことを確認。
  既存Node287ケースと合わせ計307ケース全PASS、ビルド成功。Playwrightは第11弾の23点DOM
  バイト比較（メタ/クローム/系譜因子は無変更のため全一致）・第7弾グランツール回帰
  （26+12項目）・第8弾season/mylife連打防止回帰（13項目）・第9弾mylifeセーブ注入
  （50項目）・第10弾becomeManagerブリッジ（6項目）・OBコーチクラッシュ再現テストを
  全再実行し全PASS。なお第7弾グランツール回帰スクリプトは、ランダム生成される月間
  レースの中から3日間グランツールが出現する月を実プレイで探す作りのため元々フレーキー
  （固定シード無し）であることを、本弾着手前のHEAD時点で複数回実行して確認済み
  （26/26と18/19が入り混じる）。今回の変更後も同じ頻度・同じ失敗パターンで再現し、
  新規のPAGEERRORは一切発生しなかったため、無関係な既存の不安定性と判断した。

**残っている候補**：`hub.jsx`（season側949行・mylife側557行）は依然として大きく、
タブ／画面単位でのさらなる細分化の余地はあるが、現状は許容範囲（他の分割済みファイルと
比べ突出はしていない）。`main.jsx`は48行までスリム化され、当面のコード構造の肥大化
リスクは低い。第7弾グランツール回帰スクリプト（`gt_regress_wave7.mjs`）のGT出現待ちに
よるフレーキーさは、いずれ固定シード注入に置き換える価値があるが優先度は低い。新機能は
必ず「data / domain / controller / screen」の4箇所に配る（1機能が既存の巨大ファイルへ
"にじむ"のを禁止）。
