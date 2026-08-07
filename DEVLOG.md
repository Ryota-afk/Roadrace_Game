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
デザイン作り込み・選手モーション・自転車スプライトの3姿勢化）が続いた。すべて2026-07に
Playwright/Node検証・push済み。件名で `git log --oneline --grep="Wave F"` すれば該当コミットが
見つかり、`git show <hash>` で当時の詳細（実装箇所・診断過程・検証結果込み）を復元できる。
以下は件名のみの索引（古い順）：**

- **Wave F-1**：敷地境界を可視化（敷地外を海色に・陸地ポリゴンを新設）＋屋外装飾の購入枠
  （`equip.grounds`、池/生垣/屋外機器/入口アーチ/噴水の5種）を追加。`git show 10eaaf2`
- **Wave F-2**：クラブハウスを6部屋（3列×2行の均等グリッド）に間取り分割。
  `git show bc7da0d`
- **Wave F-2 redo**：均等グリッドはユーザーから「出入り口・廊下を考慮していない」と却下され、
  玄関→廊下→左右4部屋＋突き当りの空き部屋2、という現実的な間取りに作り直し。
  `git show bb80230`
- **Wave F-2 redo 追補**：各部屋がショールームのように見えると指摘を受け、小道具（予備部品・
  待合椅子・コルクボード等）を2〜3個ずつ追加。`git show e100599`
- **Wave F-2 redo 追補2**：小道具が宙に浮いて見えるバグを、全小道具を`isoBox`（箱＋影）に
  アンカーする方式へ作り直して解消。メディカル室の椅子が見出しバッジと重なるバグも修正。
  `git show e46921d`
- **Wave F-2 redo 追補3**：「形状が単純すぎる」との指摘を受け、車輪・ローラー台・作業台・
  椅子など主要什器のシルエットを複数要素で組む形に全面作り直し。`git show a3682ef`
- **Wave F-3a/F-3c**：`riderActivityAt()`（時刻だけから選手の位置/モード/ポーズを決める
  純関数）を新設し、選手が屋内外を往復するモーションと常駐スタッフを実装。**この行動状態
  機械はWave G-1改（ドット絵化）以降も現行コードの基盤として使われ続けている。**
  `git show 943cebd`
- **Wave F-3b**：自転車スプライト（ベクター版`IsoRider`）をnormal/dancing/sprintの3姿勢に
  対応。**このスプライト実装自体はWave G-1改（§12）で全面置き換え済み＝歴史的経緯としての
  み記録。** `git show 33c6618`
- **Wave E-3a**：什器（`BASE_VIEW_CLUTTER`→`BASE_VIEW_FIXTURES`に改称）に施設Lv連動の
  段階解禁（`minLevel`）を追加。9種の新規什器を、既存什器・見出しバッジとの距離を最大化する
  総当たり探索で配置。`git show bf6b6b3`
- **DEVLOG.mdのスリム化（2026-07・完了）**：CLAUDE.md §4に従いユーザー承認を得て実施。
  §10（Step13第1〜4弾／Wave D／Wave D2）と§11（Wave E-1／E-2／E-2 redo／F-1〜E-3a）の
  本文を「件名＋要点1行＋`git show <hash>`での復元方法」の索引形式へ圧縮。情報はgit履歴に
  残っているため実質的な損失はない。**146KB→約102KB**（2026-07時点）。


## 12. スプライト全面作り直し → Wave G（2026-07・完了）

ユーザーが8方向の人物ドット絵・自転車ドット絵の参考画像を提示し、現行のベクター
スプライト（`Person.jsx`/`IsoRider.jsx`）との比較診断で「顔がない・頭身がリアル寄り・
真横図のみ・自転車が真側面図で参考画像と乖離・フレームが細く存在感がない」という
5点のギャップが判明。AskUserQuestionでG-1(土台改善)→G-2(人物多方向化)→G-3(自転車3/4
ビュー化)という進め方の合意を得て着手した。すべてPlaywright/Node検証・push済み。
件名で `git log --oneline --grep="Wave G-1"` すれば該当コミットが見つかり、
`git show <hash>` で当時の詳細（実装箇所・診断過程・検証結果込み）を復元できる。

- **Wave G-1（造形の土台改善）**：方向は変えずPerson.jsx/IsoRider.jsxへ顔・体型
  （先細り四角形）・両腕・靴・自転車フレーム（太い縁取り付き）の改善を共通適用。
  `components/sprites/kit.jsx`を新設し色定数・描画ヘルパーを共有した。`git show 9053e44`
- **計画変更（G-2/G-3ベクター拡張 → ドット絵グリッド化）**：G-1完成品を見せたところ
  「安っぽさと違和感が拭えない」との評価で、ベクターのまま多方向化する当初計画を破棄し、
  **本物のドット絵グリッド**への作り直しを決定（以後「G-1改」として記録、G-2/G-3の
  番号は使わない）。画像バイナリを持たない単一HTML構成のため、各スプライトを固定解像度の
  ピクセル配列(JSデータ)として定義し`<rect>`で描画する方式に決定。
  最初は手描きで座標を積んだが「頭部の形が変」「腕が途中で切れる」等の指摘を受け、
  **「手で描く」から「参考ドット絵から実際のドットを機械的に抽出する」へ方針転換**
  （Pillowスクリプトでbbox検出→解像度推定→多数決による色分類→ノイズ除去のパイプラインを
  scratchpadに構築）。人物16×36・自転車も同じ粒度で参考画像を描き直してもらい
  3姿勢(normal/dancing/sprint)×2方向(SE/NE)を抽出。`BaseView.jsx`へ`PixelPerson`/
  `PixelBike`として統合し、旧`Person`/`IsoRider`を置換した。`RaceView.jsx`（横スクロール
  の真側面図）は意図的に対象外のまま。`git show 83ff5f7` `git show e0d7f80`

- **統合後の実機バグ・磨き込み（索引・完了）**：BaseView統合直後から dancing_NE の
  根本原因判明までに実施した一連の修正。すべてPlaywright/Node検証・push済み。
  件名で `git log --oneline --grep="Wave G-1改"` すれば該当コミットが見つかり、
  `git show <hash>` で当時の詳細（実装箇所・診断過程・検証結果込み）を復元できる。
  以下は件名のみの索引（古い順）：
  - 自転車ドット絵の縁のノイズ(灰色のハロ)を除去 `git show 0c80f23`
  - 自転車ドット絵の左右反転条件を方向ごとに修正（SE/NEは独立した2枚の絵で
    既定の左右handednessが違うと判明。原因調査の過程でユーザーから明確な反例
    提示を受け再調査した経緯あり）`git show 355cc41`
  - 選手のコース離脱バグ(approach/depart)を修正。`nearestLoopT()`で周回路沿いに
    ラック最寄り点まで進んでからラックへ入るよう2段階化 `git show 2e53f24`
  - 自転車ドット絵の頭部が上端で切れる問題を修正（真因は参考データでなく
    確認用プレビューのSVG viewBoxだった）`git show 50ea0e2`
  - 自転車にペダリングアニメーションを追加（クランク位相2コマ交互）`git show 4740692`
  - ペダリング切り替え速度を高速化（周期0.9秒→0.22秒）`git show c2df421`
  - BIKE_BのSE系フレームの左右反転バグを修正（BIKE_B抽出元でSEの3ポーズだけ
    左右反転して描かれていた）`git show b45ae46`
  - BIKE(A)/BIKE_BのnormalNEフレーム反転修正 → ユーザー指摘によりrevert
    （`abcceeb`→`b507ad4`。ユーザー確認前にBIKE_B側まで反転対象を広げた判断が
    早計だった、という教訓が残っている）
  - 周回中の向き判定がriderWanderの横ゆらぎと不整合だったバグを修正
    （`riderWander`をview層からsim層へ移設し向き判定・描画位置の両方で共有）
    `git show 5b2f0c4`
  - スタート/フィニッシュ帯と選手の周回スタート/フィニッシュ地点をラック最寄り点
    (`nearestLoopT`)に固定。後者の実装時にdepart区間末尾でワープするバグを
    作り込み即座に検出・修正（隣接フレーム間移動量の回帰チェックを新設）
    `git show d0f445c` `git show 344e740`
  - 「NEの反転が街灯の角でおかしい」「反転できているキャラとできないキャラが
    いる」「2周目以降にバグる気がする」という指摘が続いたが、`activityDir`/
    `activityFacesLeft`は全選手・全周回で一貫していることをNode実機シミュレーションで
    繰り返し確認し、コード側には原因を発見できなかった（この時点では未解決）。

- **真因判明：dancing_NEの参考画像自体が通常と逆向きだった（完了）**：ユーザーから
  「絵柄の問題では絶対にない、直線で起きている」「NE自体が左右逆じゃないか」という
  的確な指摘を受け、抽出元の参考画像そのものを再確認した。`39daf64b-IMG_2570.PNG`
  （クランク位相A）「3.通常」のNEはハンドルが右側なのに対し「4.ダンシング」のNEは
  ハンドルが左側で描かれており、**同じ「NE」ラベルなのに参考画像の段階で左右が
  逆**だった。`17e2ff28-IMG_0262.png`（位相B）のダンシングNEも同様だったため、
  `BIKE.dancing_NE`/`BIKE_B.dancing_NE`はこの不整合を機械抽出でそのまま継承していた。
  それまでの「コード上のdir/flip判定は一貫している」「絵柄が正面寄りで判別しにくい」
  という説明はいずれも的外れで、参考画像自体の不整合が唯一の原因だった。
  該当2配列を水平反転して通常(NE)と同じhandednessに揃えて解消。`git show 06f1735`
  **再発防止**：CLAUDE.mdに新設§6「ドット絵アセット抽出時の左右handedness整合性
  チェック」を追記（新ポーズ抽出時は確定済み別ポーズと同じ参考画像上でハンドル位置を
  目視突き合わせる、頭部/肌色ピクセル重心という数値ヒューリスティックは本プロジェクトで
  信頼できないと判明済み、等）。`git show 9e59b69`

## 13. 拠点の吹き出し → Wave H-1（2026-08・完了）

旧Wave E-4「人物・吹き出し」タスクの残件。着手前に調査したところ、「什器のそばで作業する
選手・スタッフ」の部分は既にWave F-3a（活動状態機械）・F-3c（スタッフ常駐）で実装済みと
判明し、**未実装なのは吹き出しのみ**だった（コード全文検索で吹き出し関連ゼロ件を確認）。

**設計合意（ユーザー判断①〜④）**：
- ①持ち場でのセリフは部屋（training/mechanic/medical/scout）ごとに分ける
- ②移動中（歩行・コース⇔ラック）は喋らせない
- ③同時表示は最大2人まで
- ④選手の状態（故障／疲労80以上／調子）をセリフに反映する（優先度：故障＞疲労＞調子）

**実装**（`riderActivity.js`と同じ「時刻の純関数」の流儀を踏襲。Reactのstate/timerを
一切使わず、経過秒＋選手IDだけから発話を決定論的に解く）：
- `data/baseViewChatter.js`：状況5種×性格10種×状態4種のセリフをフラット配列
  `{when, persona, state, text}`で定義（リテラルのみ）
- `domain/season/riderChatter.js`：`chatterFor`（1人が今何を喋っているか）・
  `pickChatters`（画面に出す最大2人を選ぶ）等の純関数。JSXなし＝Node単体テスト可能。
  発話は1人24秒周期・4秒表示（duty比1/6、選手ごとに位相をずらし常時1人程度が喋る
  状態を自然に作る）。上限超過時は「より新しく喋り始めた人」を優先して間引く
- `components/base/SpeechBubble.jsx`：角丸＋尻尾のSVG吹き出し。呼び出し側から
  カメラ倍率kの逆数(`1/k`)を`scale`として渡し、ズーム位置に関わらず画面上で常に
  同じ読めるサイズを保つ（fitスケール＝かなり引いた初期表示でも文字が潰れない）
- `BaseView.jsx`：カメラ変換`<g>`内の最終レイヤ（全人物より後）に吹き出しをまとめて
  描画し、什器や他の選手に隠れることを原理的に排除

**検証**：Node単体テスト34項目（データ整合性＝全whenにpersona/state:nullのフォールバック
行が存在／状況判定／状態優先度／性格・状態フィルタ／決定論性＝同一入力で同一出力／
duty比が理論値と一致／移動中は喋らない／同時表示上限を超えない、等）が全件パス。
Playwrightで実際にゲームを開始→拠点画面で吹き出しの実出現を確認、ズームイン後も
文字サイズが画面上で一定に保たれることをスクリーンショット比較で確認、メニュー開閉
（一時停止）後も吹き出しが消えないことを確認、コンソール／ページエラー0件。
`npm run build`成功。

## 14. 部屋のグレードアップ → Wave H-2（2026-08・完了）

拠点(BaseView)の4つの持ち場（トレーニング/メカニック/メディカル/スカウト）の内装を、
資金を払って0〜3の4段階でグレードアップできるようにした。

**設計合意（ユーザー判断⑤〜⑧）**：
- ⑤ 効果は無し（見た目のみ）＋実績連動（4部屋すべて最高グレードで実績解除）
- ⑥ コスト`[80, 150, 250]`（Lv1→2→3）。1部屋フル480万・4部屋全てで1920万
- ⑦ クラス昇格によるゲートは掛けない（B1のうちから購入できる）
- ⑧ BaseViewの部屋タップの行き先（ROOM_SECTION_MAP）は変更しない

**実装時に発覚し、当初案から変更した点**：設計段階では「壁を上質色へ塗り替える」を
グレードの一要素として想定していたが、実装直前にRoom.jsxの構造を精査したところ、
壁（クラブハウス外周2面＋部屋間の間仕切り）はクラブハウス全体で共有される要素であり、
特定の1部屋だけを塗り替えることができない（間仕切りがどの部屋の境界かを示すデータ自体を
持っていない）と判明した。加えてデフォルトズームでは1部屋が画面上わずか約40×30pxしか
なく、微妙な色調変化はどのみち視認できない（設計時に洗い出していた既知のリスク）。
そのため壁の塗り替えは見送り、効果を「輪郭のはっきりした付加物」＝ラグ・天井照明の
光溜まり・バッジの金枠に集約した（床の色相＝部屋の識別情報は変更しないという制約は維持）。

**実装**：
- `data/roomUpgrade.js`：コスト表・対象4部屋のキー・上限（リテラルのみ）
- `data/baseViewRoomGrade.js`：グレード別の見た目パラメータ（ラグ色は各部屋の持ち場
  アクセント色を再利用＝新しい配色を増やさない）
- `domain/season/baseViewLayout.js`に`roomGrade(g, roomKey)`追加：4持ち場は`g.roomLv`
  （旧セーブ互換のため`|| 0`ガード）、廊下・納戸は`g.classIdx`に連動（購入対象外）
- `controllers/season/shop.js`に`buyRoomUpgrade(s, k)`追加（`buyEquip`と同型・クラスゲート無し）
- `state/state.js`の`initGame()`に`roomLv`初期値を追加
- `components/base/Room.jsx`：`RoomGradeOverlay`で目地(G1)・ラグ(G2)・天井照明の
  光溜まり(G3)を描画（isoProjectが線形写像である性質を利用し、world座標上で
  格子点を先に求めてから投影＝screen座標の補間より正確）
- `components/base/Station.jsx`：G3で持ち場バッジに金枠を追加
- `screens/season/hub/facility/room.jsx`（新設）＋`data/seasonMenu.js`に
  `facility_room`「内装・改装」小分類を追加
- `logic/support.js`の`SEASON_ACHIEVEMENTS`に「拠点フル改装」を追加（判断⑤c）

**検証**：Node単体テスト64項目（`roomGrade`の境界値・旧セーブ互換・廊下/納戸のクラス連動、
`buyRoomUpgrade`の資金不足/上限ガード・総コスト・クラスゲート無し、実績判定、
`ROOM_GRADE_SHOWS_*`の閾値、`renderToStaticMarkup`によるG0〜G3のSVG出力の差分＝
目地/ラグ/光溜まり/金枠バッジがそれぞれ正しい段階からのみ出現し他の部屋に漏れない
こと）が全件パス。Playwrightで実際にゲームを開始→内装・改装セクションへ到達→
トレーニング室をLv0→Lv2まで購入→予算が正しく減ること・表示Lvが更新されることを確認→
拠点画面でラグが実際に描画されていることをスクリーンショットで確認。コンソール／
ページエラー0件。`npm run build`成功。G3（金枠バッジ＋天井照明）は開始予算では
届かないため実機タップでの視認は確認できていないが、G1/G2で使っているのと同じ
条件分岐パターンであり、`renderToStaticMarkup`のSVGレベルテストで正しい閾値から
出現することを機械的に確認済み。

## 15. トレーニング室の「ぼっ立ち」修正 → Wave H-3（2026-08・完了）

トレーニング室の選手が什器の脇にただ突っ立っているだけでトレーニングしているように
見えない、というユーザー指摘の修正（設計①）。原因は`domain/season/riderActivity.js`の
`workSpotFor()`が「椅子があれば座る／無ければ什器の手前に立つ」の二択しか持たず、
椅子はメディカル室・スカウト室にしか無いためトレーニング室は常に「立つ」一択だったこと。

**解決策**：新規ドット絵を一切描かずに解決した。トレーニング室の主要什器はローラー台
（室内トレーナー）なので、実際のロード選手と同じく**自転車ごとローラー台に乗せる**
＝既存の`PixelBike`（ペダリングアニメーション付き）をそのまま流用する。

**実装**：
- `workSpotFor()`：`roomKey === "training"`のとき`pose: "roller"`を返す（什器手前への
  -0.6オフセットは付けない＝自転車が什器に重なるのが正しい絵になるため）
- `BaseView.jsx`：屋内人物の描画で`act.pose === "roller"`のときだけ`PixelPerson`ではなく
  `PixelBike`を描画。立ち漕ぎ(dancing)判定の対象にも`"roller"`を追加（ユーザー判断②＝
  ローラー上でもダンシングさせる）。向き(dir)・左右反転(flip)は既存の
  `activityDir`/`activityFacesLeft`をそのまま流用（静止位置では自動的にSE・flipなしに
  収束するため追加のロジック不要）
- メカニック室の棒立ちは今回スコープ外（ユーザー判断①）。ドット絵化ウェーブでの
  作業ポーズ追加時にまとめて解消する予定（DEVLOG次のアクション参照）

**検証**：Node単体テスト10項目（`workSpotFor`の部屋別ポーズ分岐・座標・メカニック/
メディカル/スカウトが無変更であること、`riderActivityAt`のend-to-endでトレーニング室の
work中の選手が実際に`pose:"roller"`になること）が全件パス。Playwrightで実際にゲームを
開始し、拠点画面を約2分間隔でスクリーンショット観察したところ、トレーニング室のローラー台に
選手が自転車ごと乗っている様子を確認（他の時間帯では別の部屋へ移動中で空になっており、
これは正しい周期的な出入りの挙動）。コンソール／ページエラー0件。`npm run build`成功。

## 16. レース最終スプリントのドット絵化 → Wave H-4（2026-08・完了）

`FinalSprintCinematic`（レース最終直線の演出）を、旧`IsoRider`（ベクター）から
`PixelBike`（拠点画面と共通のドット絵）へ差し替えた。

**設計時に発覚した重大リスクと対策**：`PixelBike`は1体あたり塗りピクセル数≒900の
`<rect>`を持つ（BaseView1名描画分と同規模）。最大22名を毎フレーム素直に再構築すると
約2万ノードになり描画が破綻する（既存コードが「1人あたり十数ノードでも描画が追いつかず
残像化した」経緯からv39.14で30fps間引きを入れていた実績が根拠）。対策として
`<defs>+<use>`方式を新設：「色×姿勢(normal/sprint)×クランク位相(2)」の組み合わせだけ
`<symbol>`を1回だけ定義し（`<defs>`は非表示要素のため定義してもコスト無し）、
各選手は`<use>`1個（transform+href切替のみ）で参照する。

**設計合意（ユーザー判断③〜⑥）**：
- ③ `<defs>+<use>`方式で実装（承認）
- ④ ヘルメット色による個体識別の代替は、ユーザー提案の「順位表をリアルタイム連動」を
  採用（元の提案`b`＝`bikeLegend`へヘルメット色スロットを追加、は不要と判断）。
  色スウォッチ＋順位＋名前のリストを演出の下に表示し、毎フレーム現在の並び順で更新する
- ⑤ エースは1.14倍拡大（ドット絵では滲みの原因）ではなく頭上の★マーカーで表示
- ⑥ 設計①（ぼっ立ち修正）を先に実装してから着手（上記Wave H-3）

**実装**：
- `components/sprites/pixelBike.jsx`：`PixelBikeSymbolDefs`（combos配列から
  `<symbol>`群を生成）・`PixelBikeUse`（`<use>`で参照する側）・`bikeSymbolId`
  （色×姿勢×位相→ID）を追加。dir="SE"固定（最終スプリントはカメラが背後から追走する
  固定視点で全選手が常に同じ画面方向へ進むため、方向判定自体が不要）
- `components/RaceView.jsx`：`FinalSprintCinematic`内で`IsoRider`呼び出しを
  `PixelBikeUse`へ置換。色の集合を`useMemo`で1回だけ算出し`bikeCombos`として
  `PixelBikeSymbolDefs`へ渡す（contendersの顔ぶれはシネマティック中不変のため再計算不要）。
  `isAce`は★マーカー（`text`要素。黄色ジャージと被って視認しづらかったため頭上へ離し
  黒縁取りを追加＝実機確認で修正）、`isPlayer`は水色の楕円マーカーとして別途描画。
  `simple`（遠景の簡略化）と`cap`（ヘルメット色）は廃止（前者はdefs+useで不要に、
  後者は順位表に一本化）。リアルタイム順位表（判断④）を追加：`withW`を`w`降順で
  ソートし、上位6名＋自分の行（7位以下のときのみ）を色スウォッチ付きで表示
- `components/sprites/IsoRider.jsx`：`IsoRider`本体は以後未使用（`CAP_COLORS`のみ
  引き続き使用）。ファイル冒頭にアーカイブ候補である旨を明記し、次にこのファイルへ
  触れる際にCAP_COLORSをdata層へ移しIsoRider本体をarchive/へ退避することを検討事項として残した

**検証**：`npm run build`成功。Playwrightで実際にシーズンモードのレースを最後まで
（月間指示カード4種を`composeCard()`実装から収集したキーワードで機械的に選択しながら）
進行させ、最終スプリント演出（`viewBox="0 0 340 178"`のsvg）の実出現とDOMノード数を実測：
`<defs>`内（非表示・毎フレームのコストなし）7052ノード（色2種のケース、symbolCount=8＝
2色×2姿勢×2位相）に対し、`<defs>`の外（実際に毎フレーム描画される部分）はわずか233
ノード。旧実装なら22名分＝約2万ノードになっていたところが、選手の実描画は`<use>`
数個ぶんに収まることを実機で確認した。ドット絵の自転車・エース★マーカー（黒縁取り）・
自分を示す水色マーカー・色スウォッチ付き順位表がいずれも画面上で正しく機能することを
スクリーンショットで確認。コンソール／ページエラー0件。

## 17. マイライフの難易度調整 → Phase 1（2026-08・完了）

ユーザー指摘「配合なしでもステータスがカンストする／後半は超晩成・成長力S・機器を
揃えた状態でレースに勝ち続けるしかなくなる」を起点に、Node実装の再現シミュレーションで
`mlGrowthCap`が年数だけで自動上昇し難易度を問わず年9〜10でカンストすること、
`growthPhase().gain`に成長タイプ別の代償が無く晩成・超晩成が完全上位互換になっていること、
成長タイプ変更・成長力アップアイテムが安価・繰り返し購入可でビルドを一極集中させて
いることを裏付けたうえで設計。詳細な判断履歴は上記「次のアクション」8番に記録済み。

**実装内容（柱0〜柱1・新ステータス2種・マスク化・レーダーチャート）**：
- 柱0：`data/abilities.js`の`GROWTH`各エントリに`gainMul`（超早熟2.4/早熟1.7/普通1.25/
  晩成1.0/超晩成0.85）を追加し、`logic/support.js`の`growthPhase()`が`gain`に乗算する
  よう変更。season/mylife共通の関数のため両モードへ自動適用
- 柱0-b：`data/gear.js`の`ML_STOCK_ITEMS`から`growthPowUp`/`growthShift`を削除し、
  `ML_GROWTH_POW_UP_PRICE`（C→B 400万／B→A 1200万／A→S 3000万の累進）・
  `ML_GROWTH_SHIFT_PRICE`（900万・キャリア1回限り）を新設。在庫を貯めて後で安く
  使う抜け道を構造的に塞ぐため、`mlBuyCar`/`mlBuyHouse`と同型の「買った瞬間に
  即適用される買い切り」（`controllers/mylife/shop.js`の`mlBuyGrowthPowUp`/
  `mlBuyGrowthShift(s, dir)`）に変更。UIは`screens/mylife/events.jsx`の
  ショップ「恒久投資」タブに新設
- 柱1：`mlGrowthCap(year, player, ml)`を「時間経過は+10年分（+20）で頭打ち」＋
  「実績ボーナス（現在の大望の道でクリア済みのはしご数×3・大舞台タイトル×4・
  通算勝利5勝ごとに+1／この項だけで+10まで、`mlAchievementBonus()`が算出）×
  難易度係数（易1.3/普1.0/難0.75/鬼0.5）」の合算へ再設計。`state/state.js`の
  `mlFirstUnmetRung`（大望の道の進捗）を再利用。旧・月次アクション限定の
  `diffCapAdj`（easy+4/normal0/hard-5/oni-10の一律加減算、`controllers/mylife/month.js`）は
  廃止し、mlGrowthCap内部の実績連動係数へ統合——これによりhub.jsx表示の上限値と
  実際の練習キャップが常に一致するよう副次的に修正された（旧実装はdiffCapAdjが
  month.js経由のトレーニングにしか効かず、UI表示のキャップとズレていた）。
  呼び出し元9箇所すべてに`ml`（フルの状態オブジェクト、無ければ実績ボーナス0扱い）を
  追加で渡すよう変更（event.js/shop.js/month.js/support.js内ML_OFFSEASON_CHOICES/
  hub.jsx）。柱1はマイライフの`mlGrowthCap`専用（シーズンの固定`DIFFICULTIES.growthCap`は
  今回対象外）
- 新ステータス2種：`core/core.js`の`genSubStats()`に`breakthrough`（突破力・タイプ別base
  44〜58の緩い差）・`stability`（安定感・base44〜58）を追加（`build`と同じく脚質base+
  jitterの固定値・非成長）。`logic/support.js`の`growthFactor`/`softFactor`を
  `breakthrough`パラメータで拡張（`r.breakthrough ?? 50`で`(0.5+breakthrough/100)`倍、
  既定値50なら旧来と完全一致）し`addAb`/`growSub`から自動接続。安定感は
  `controllers/season/month.js`の`cond`変動幅と`controllers/mylife/month.js`の`form`
  変動幅（`stabilitySteady`係数、stability=50で倍率1＝旧仕様と一致）に接続。
  両関数とも season/mylife 共通のためユーザー指示通り両モードへ適用済み
- 成長力のマスク化：`mlGrowthPowRevealed(ml)`（`ml.year>=3`）を新設し、
  `screens/mylife/create.jsx`（素質診断画面）・`hub.jsx`（メイン画面）・
  `events.jsx`（才能開花プログラム欄）の3箇所で3年目まで`🔒???`表示に置換。
  素質診断ランク（`mlTalentRank`）と「伸びしろ」ヒント（`potentialHint`）は
  どちらも成長力を最大重み（他項目の2倍以上）で加点しており、リセマラで
  素質ランクや伸びしろ表示を目印にすれば成長力を実質的に読めてしまうため、
  両関数に`revealPow`引数を追加し非公開期間中は成長力由来の加点をゼロ化（Node単体
  テストで、非公開時に`growthPow`をS↔Cに変えてもスコア・表示が完全に一致することを確認）
- 可変軸レーダーチャート：`components/RadarChart.jsx`新設（`RadarChart`は任意軸数の
  SVGポリゴンレーダー、`RiderRadarChart`は選手オブジェクトから5軸
  ［加速力・体格・メンタル・突破力・安定感］を組み立てる薄いラッパー）。
  Phase 2/3でスピリット・運が増えてもaxes配列を7要素にするだけで呼び出し側は無改修。
  マイライフのメイン画面（`hub.jsx`）に常設。`SubStatLine`（`components/panels.jsx`、
  season/mylife両方の選手カードで共有）にも突破力・安定感の数値表示を追加

**検証**：`npm run build`成功。Node単体テスト2本（`mlGrowthCap`/`mlAchievementBonus`の
境界値・難易度係数・talentCap合成・140上限、`mlGrowthPowRevealed`/`mlTalentRank`/
`potentialHint`のマスク時完全非依存性）が全項目パス。Playwrightでマイライフの
キャラクター作成→素質診断（`🔒???`表示を確認）→デビュー→ショップ恒久投資タブ
（才能開花プログラムのロック表示・成長タイプ変更の実購入）→月次アクションを
90ターン連続実行し7年目まで到達（コンソール／ページエラー0件、`NaN`/`undefined`の
表示漏れ0件、7年目到達時点で成長力`🔒???`が解除され実際のランクが表示されることを
確認）。シーズンモードでもキャラクター作成〜選手一覧画面まで進め、`SubStatLine`が
突破力・安定感を正しく表示しコンソールエラー0件であることを確認。

### 追補：選手カードのレーダー2枚化（2026-08・完了）

Phase 1完了直後、ユーザーから「元の能力（平坦・登坂等）も5角形にした方がいい？ もしくは
そっちを5角形にして新能力を棒グラフにするとか」というUI相談を受けた。

**分析**：単純な入れ替え（基礎能力＝レーダー／新ステ＝棒）は**推さないと回答**した。
`AbilityGrid`は現在値の棒に加えて「上限までの薄い帯＋上限マーカー」を描いており、これが
育成の核心情報（あと何伸びるか）だからレーダー化すると失われる。逆に新ステータスは固定値
なので棒にしても情報量は増えない。つまり「変動する値＝棒／固定値＝レーダー」という当初の
割り当て自体は理屈が通っていた。違和感の正体は割り当てではなく**主客**で、主役の基礎能力が
地味な棒／脇役の新ステが派手なレーダーという逆転と、5項目ブロックが4つ縦積み
（`AbilityGrid`／`SubStatLine`／レーダー／`DisciplineGrid`）でカードが長大化していたこと
だと切り分けた。AskUserQuestionで4案（レーダー2枚横並び／基礎能力のみ二重レーダー／
現状維持＋数値統合／レーダーを詳細画面へ移動）を提示し、**レーダー2枚横並び**が選ばれた。

**実装**：
- `RadarChart`に`showValues`（軸ラベル下へ現在値を併記。最大値到達時は`atMaxColor`で
  強調）を追加し、最外周リングを他より濃く描いて「天井」だと分かるようにした
- `AbilityRadarChart`を新設。**軸の最大値に成長上限(cap)を渡す**ことで「外周＝天井／
  外周との隙間＝伸びしろ」を表現し、`AbilityGrid`の薄い伸びしろ帯と同じ情報をレーダー側で
  担わせた（全能力でcapが共通なので外周＝capが破綻なく成立する）
- `screens/mylife/hub.jsx`：4ブロック縦積みを「能力レーダー（緑）｜素質レーダー（青）」の
  横並び＋折りたたみトグル1本に集約。折りたたみの中身は`AbilityGrid`／`SubStatLine`／
  `DisciplineGrid`をそのまま格納（数値・伸びしろ+n・パーツ補正・コース適性は詰めたい時
  だけ開く詳細へ）。開閉状態は既存の`ml.uiStatusOpen`と同じ流儀で`ml.uiAbilityDetailOpen`
  に保持
- **シーズンモードは現状維持**（6人ロースターが縦に並ぶため1人につきレーダー2枚だと縦が
  破綻する。新ステータスは`SubStatLine`の数値で読める）

**検証**：`npm run build`成功。Playwrightでマイライフを5年目まで進め、折りたたみ時／展開時の
両方をスクリーンショットで確認（コンソール／ページエラー0件・`NaN`表示0件）。実機では
cap98に対し登坂97が外周へ張り付き限界突破間近であること、体格26の凹みで軽量型だと
シルエットで読めることを目視確認した。

**残した検討事項として提示した2点のうちユーザー判断は「①は欲しい／②は問題ない」**
だったため、①のみ追加対応した（2026-08・完了）。②（capに応じて外周が伸縮する挙動）は
現状維持で確定。

- **区切り線の追加**：MyLife（`hub.jsx`）・後述のSeason側の両方で、2枚のレーダーの間に
  `width:1`の縦線（`background: C.line`）を追加して視覚的な分離を明確にした。
- **Seasonモードにも同じレーダー表示を追加**：「シーズンでもあると嬉しい」という要望を
  受け、6人ロースターでも導入した。ただし常時表示にはしなかった——既存の`AbilityGrid`/
  `SubStatLine`/`DisciplineGrid`はSeasonの選手カードでは（MyLifeと違い）元々常時展開
  済みの設計であり、そこへレーダー2枚（1人あたり140px級を2枚）まで常時追加すると6人分の
  縦がさらに伸びてしまう。既存の「▼戦績を見る」（`expandedRiderId`）と**独立した**新規
  トグル「▼レーダーで見る」（`radarRiderId`/`setRadarRiderId`、`hooks/useSeasonGame.js`に
  `useState(null)`で新設）を各選手カードに追加し、既定は非表示のまま選手ごとに個別開閉
  できるようにした（`screens/season/hub/riders/list.jsx`）。
  **検証**：`npm run build`成功。Playwrightで新規ゲーム開始→選手一覧まで進め、
  「▼レーダーで見る」トグルの存在・クリックでの展開・区切り線を含む表示を確認
  （コンソール／ページエラー0件、`NaN`表示0件）。MyLife側も区切り線込みで再確認。

## 18. マイライフの難易度調整 → Phase 2（2026-08・完了）

Phase 1（§17）で保留していた「イベントを能動発火から受動発火へ・件数拡充・新ステ「運」」
に着手。設計はユーザーとの対話で4つの分岐（手動ボタンの扱い／運の効かせ方／悪イベント新設
の要否／シーズンへの適用範囲）を先に確定させてから実装した（CLAUDE.md §1のメタ指示に従う）。
その後ユーザーから「イベントは最終的に数百種類にしたい。能力・新ステを変動させるもの、
ダイジョーブ博士系の賭けイベント、覚醒イベント、悪イベントも」という追加の方向性が示され、
さらに4分岐（賭けイベントの実装方式／覚醒・悪イベントの振れ幅上限／今回のバッチ規模／
新ステを例外的に動かしてよいか）を確定させた上でイベントスキーマを拡張した。

**確定した設計**：
- 新ステータス「運」：`core/core.js`の`genSubStats()`に追加。突破力・安定感と違い脚質差は
  つけない（base50±ジッターのみ）。運と脚質の間に論理的な関連が無いため。
- マイライフ「🎤取材・私生活イベント」ボタンを廃止し、弟子イベントと全く同じ場所・同じ型
  （`mlAdvanceMonth`末尾、月の効果が確定した`base`の後）で受動発火するよう統一（`month.js`）。
  弟子イベントと排他（弟子が先に判定、外れたら私生活イベントを判定）。追加の月消費は無い
  （月は既に`base`の時点で確定済み。これにより頻度を上げても負担にならない）。
  発火率`0.28 × (0.5 + luck/100)`（突破力/安定感と同じ揺らぎ式）。
- イベント抽選時の「良い/悪い」判定：`0.30 × (1 - (luck-50)/100)`を悪イベント(`bad:true`)の
  選出確率とし0.4〜1.6倍でクランプ。性格別イベントは悪イベントを持たないため、悪イベントの
  判定に外れた回だけ半々で差し込む（旧実装と同じ配分）。`logic/support.js`の
  `pickMlEvent()`/`weightedPick()`に集約し、`controllers/mylife/month.js`から呼ぶ
  （`controllers/`同士の循環import回避のため`support.js`に置いた）。
- 「📸スポンサーの仕事」は取材イベントとは別の意図的な経済アクションとして手動・月消費のまま
  据え置き（`mode==="event"`の月次効果分岐もこの経路のため残置）。
- イベントスキーマを拡張（`controllers/mylife/event.js`の`mlApplyEventEffects`）：
  `abKeyDelta:{key:±n}`（個別能力。正は既存`addAb`で伸びしろカーブ・成長上限に従い、負は
  直接減算）／`breakthroughDelta`/`stabilityDelta`/`luckDelta`（新ステ3種、範囲[5,100]で
  直接加減算。**Phase 1で「固定・非成長」とした新ステを、イベントという物語上の節目に限り
  例外的に動かせるようにした**判断による）／`growthPowBump`（`bumpGrowthPow`を1段階）／
  `talentCapDelta`（才能キャップ増減、配合相当の破格を実現）。
- ダイジョーブ博士系（賭け）：選択肢に`outcomes:[{weight,effects,result}]`を持たせる新形式を
  新設。`resolveChoiceOutcome()`が選んだ**その瞬間**に`weightedPick`で1つを確定させる
  （＝賭けた後にどちらに転ぶか分かる、という体験を実現）。`weight`は`item.weight`（既定1）の
  比率で加重抽選する汎用ヘルパー`weightedPick()`（`support.js`）で統一。
  覚醒級イベントも同じ`weight`機構を流用し、`weight:0.15〜0.2`で滅多に引かないよう調整。
- **イベント本文の拡充（第1弾・全46件へ）**：`data/events.js`のML_EVENTSに31件追加
  （個別能力ブースト8件・新ステ変動6件・賭け6件・覚醒級4件・悪イベント10件、内訳は目安）。
  ML_PERSONALITY_EVENTSに欠けていた`normal`（「普通」性格）用の1件も追加（これで性格10種
  すべてに専用イベントが揃った）。**「最終的に数百種類」は長期の継続タスクとして次の
  アクションにメモし、今回はその第1弾という位置づけ**（下記「次のアクション」8番参照）。
- シーズンモード：`data/economy.js`の`EVENT_CHANCE`（固定0.35）を、ロースター平均luckで
  `0.35 × (0.5 + avgLuck/100)`に補正（`controllers/season/month.js`）。マイライフと違い
  良/悪の質までは踏み込まず、頻度のみに軽く適用（Seasonの`EVENTS`に悪タグを新設するのは
  範囲が別物になるため見送り）。
- `components/RadarChart.jsx`の`RiderRadarChart`に運を追加し6角形化。Phase 1で見込んでいた
  「axesを増やすだけで対応できる」設計が実際にワンライナーの変更で済んだ。`SubStatLine`
  （`components/panels.jsx`、season/mylife共通）にも運の数値表示を追加。

**検証**：`npm run build`成功。Node単体テスト2本を新規作成——①`weightedPick`の加重比率
（10万倍の重み差で狙った比率通りに出ることを2000試行で確認）・`pickMlEvent`のbad抽選率が
luck=0/50/100でそれぞれ約45%/30%/15%と設計式通りに単調減少すること、②`mlApplyEventEffects`の
新規effects（abKeyDelta正負・新ステ3種のクランプ・growthPowBump・talentCapDelta）が仕様通り
動くこと・`eventEffectSummary`が新フィールドを正しく文言化すること・`resolveChoiceOutcome`が
outcomes無しでは従来通り、ありでは指定比率（0.3視聴で3000試行して30.3%）で分岐すること・
`ML_EVENTS`全46件が構造的に破損していない（choiceが`effects`か`outcomes`のいずれかを持ち
resultが欠けていない）ことを機械的に検査。Playwrightでは①手動ボタンが画面から消えている
ことを確認、②マイライフで150ターン連続実行し21回の受動イベント発火を実地で観測（性格別
イベント・賭けイベント・悪イベント・新ステ変動イベントがいずれも実際に出現し正しく解決
されることをタイトル一覧で確認、コンソール／ページエラー0件・`NaN`/`undefined`表示0件）、
③6角形レーダー（運軸を含む）がマイライフ・シーズン両方の画面で正しく描画されること、
④シーズンの選手一覧・NaN無し・エラー0件を確認。

## 次のアクション（ユーザーメモ・未着手）

以下はユーザーから明示的に指示された、今後着手すべき項目のメモ（実装はまだ着手して
いない）。優先度・着手順は未確定。

**★最優先：UIテキスト・ビジュアルの作り込み（2026-08指摘・恒常タスク）**
9. **ゲーム内の無駄なテキストを削り、「ゲームとして良いUI」に作り込む。** ユーザーから
   「これはあらゆる画面内で最優先的に改善すべき事象であり、かつ今後も定期的にブラッシュ
   アップすべき事象」と位置づけられた。**CLAUDE.md §7に常設ルールとして明文化済み**
   （新規UIを作るたびに従う。以下はその初回の具体的な指摘リスト）。
   指摘された問題は3種類：
   - **(a) 無駄な情報が多くごちゃつく**：レーダーチャート右側の「（生涯不変）」は不要。
     左側の「（外周=98）」も、そもそも別の見せ方があるはず（例：仕切り線の左下あたり
     ＝右側レーダー内の右下に「上限」として控えめに置く等）。
   - **(b) 開発上の用語をそのままユーザーに出している**：「外周」は初見のユーザーに
     伝わらない。実装側の語彙（外周・キャップ・フラグ名由来の語など）を画面に出さない。
   - **(c) 細かく小さい文字での長い説明はそもそも読まれない**：長々とした説明文や
     アイコンでの誤魔化しに逃げず、フォント・文字数・レイアウト・ビジュアルで伝える。
   **着手時の注意**：今回のレーダーチャート周りが最初の対象だが、これは「あらゆる画面」に
   対する指摘であり、1画面直して終わりにしない。既存の全画面を棚卸しして同じ観点で
   洗い直すこと。
10. **チュートリアル的な導入説明の追加＋スタート画面の整理。**
   - ゲームを開いた最初の画面と、モード選択後の最初の画面で、ある程度の説明をする
     （チュートリアル的な導入）。
   - **現在のスタート画面（起動一発目）の問題点**：画面上部に「クラス B1／あなたのチーム」
     等のシーズンモード自チーム情報が出ているが**不要**（まだモードを選んでいないのに
     片方のモードの状態が見えている）。
   - 「プレイモードを選んでください」の上にある `MODE SELECT — v14`（`screens/meta.jsx`）も
     **不要**（バージョン番号を含む開発用の見出し＝上記9(b)の典型例）。
   - 「プレイモードを選んでください」の下の説明文は**内容に間違いを含んでいる**うえ、
     視認性も低い。文言を正しく直したうえで、視認性・分かりやすさを上げる。

**ドット絵モデルの修正（2026-08指摘・ユーザーが参考画像を用意）**
11. **スプリント／ダンシングのモデルを描き直す**（`components/sprites/pixelBike.jsx`）。
   - 「スプリントにスプリントしている感がない」「ダンシング（立ち漕ぎ）も分かりづらい」。
   - **モデルの作り直しはAIに外注する**方針が決まったため、そのための一式を整備済み：
     - `tools/BIKE_SPRITE_SPEC.md` … AIへそのまま渡す発注仕様書（`tools/make_sprite_spec.py`
       が生成。現行normalコマを実データから自動で埋め込むため、差し替え後に再生成すれば
       常に最新を基準にできる）。出力形式は**画像ではなくASCIIのドット配列JSON**。
       抽出工程が不要になり、劣化も左右反転の混入も起きない。
     - `tools/bike_sprites.py` … 提出物の**機械検査**（validate）／**PNGプレビュー**
       （preview）／**JSX変換**（tojs）。仕様書の全ルールをコード化してあるので、
       目視をすり抜ける不整合を出荷前に落とせる。
   - **実測で問題を裏付け済み**：dancingの内容高さは48マスでnormalの47マスと**ほぼ同じ**
     （＋1マス）＝「立ち漕ぎ」が形として全く表現されていない。またA/Bで下余白が1↔2に
     揺れており、0.11秒ごとに車体が1px上下する意図しない振動が出ていた。
   - **仕様で担保した要点**：①シルエットの縦横比を姿勢ごとに数値で強制（dancingは内容高さ
     52マス以上＝normal比+5、sprintは高さ42以下かつ幅42以上）②`_SE`は前輪が左・`_NE`は
     前輪が右という向きの規約を明文化（CLAUDE.md §6の再発防止をAIへの指示にも反映）
     ③A/Bで前後輪とサドルを1マスも動かさない（車輪は接地しているため）④アンカー座標を
     AIに申告させ、絵と申告の一致まで機械検査する。
   - **バリデータは自己検証済み**：合格するはずの合成データで誤検出0件、12種の違反
     （向き逆・立ち漕ぎでない・接地ずれ・A/B不整合・不正文字等）を全て検出。現行スプライトを
     通すと「内容の高さ48が下限52未満（シルエットの描き分け不足）」を正しく指摘する。
12. **最終スプリント演出のマーカー位置を直す**（`components/RaceView.jsx`の
   `FinalSprintCinematic`）。エース★マーカーと自分を示す水色の丸が**選手の顔と被って
   非常に分かりづらい**。Wave H-4で★を頭上へ離し黒縁取りを付けた経緯があるが、
   まだ不十分。ドット絵化で選手の実サイズが変わったことが原因と思われるので、
   マーカーのオフセットをスプライトの実高さから算出する等の見直しが要る。

**UI/メニュー構造**
1. ✅ メニュー画面で「ホームに戻る」選択肢を、大分類として即選択できるようにする。（完了・下記参照）
2. ✅ 大分類の中の小分類を細分化する（完了・下記「Step13第7弾」参照）。

**拠点(BaseView)の部屋の見た目強化**
5. ✅ 部屋のグレードアップ（完了・下記「Wave H-2」参照）。
6. ✅ トレーニング室の「ぼっ立ち」修正（完了・下記「Wave H-3」参照）。**メカニック室は
   今回スコープ外のまま残っている**（作業台にかがむ等の新ポーズが必要で`PixelPerson`の
   スプライト追加を伴うため、下記4番のドット絵化ウェーブのA項①②と一緒に検討する）。

**ドット絵化の拡張**
3. ✅ レース最終区間のスプリント演出にドット絵を適用（完了・上記「Wave H-4」参照）。
4. 拠点(BaseView)のオブジェクト類（什器・プロップ・建物など）もドット絵化する。
   ユーザー提示の分類（対象一覧、A〜Fの計41項目）：
   - A. 人物共通モデル(Person.jsx)：①立ち/歩行 ②座り
   - B. 自転車に乗った選手(IsoRider.jsx、3姿勢)：③通常(上ハンドル) ④ダンシング
     ⑤スプリント(下ハンドル前傾)
   - C. 各部屋の主要什器・常時表示(Station.jsx)：⑥トレーニング室ローラー台
     ⑦メカニック室作業台 ⑧メディカル室診察ベッド ⑨スカウト室デスク
     ⑩空き部屋什器
   - D. 各部屋の二次什器・施設Lvで段階解禁(Fixtures.jsx、18種)：⑪ダンベル
     ⑫給水テーブル ⑬予備ローラー ⑭扇風機 ⑮モニター ⑯立てかけホイール
     ⑰工具箱/クレート ⑱パーツ棚 ⑲作業台2(ホイール掛け)
     ⑳ホイール組み立てスタンド ㉑キャビネット ㉒医療カート ㉓予備ベッド
     ㉔椅子(医療/スカウト共通) ㉕ホワイトボード ㉖書類フォルダ ㉗資料棚
     ㉘廊下の靴棚
   - E. 屋外プロップ・敷地内装飾(Props.jsx、10種)：㉙木 ㉚ベンチ ㉛外灯
     ㉜駐輪ラック ㉝チームカー ㉞池 ㉟生垣 ㊱屋外トレーニング機器
     ㊲入口アーチ ㊳噴水
   - F. 建物・地面・コース：㊴クラブハウス本体(床/壁/部屋割りカットアウト)
     ㊵コース(オーバル) ㊶地面・広場(芝/タイル)

**配合・育成の深掘り**
7. 配合面の深掘り。
   - 血統表の可視化（親・祖父母など血統を家系図のように辿れる画面）
   - 特殊配合の実装（ドラクエモンスターズのような、特定の親同士の組み合わせで
     専用の配合結果・特殊な子が生まれる仕組み）
8. ✅ マイライフの難易度調整。2026-08にPhase 1・Phase 2実装完了（上記「§17」「§18」参照。実測でユーザー指摘を
   裏付け：`mlGrowthCap`が年数だけで自動上昇し10年目前後で全員カンスト、難易度による
   カーブの違いがほぼ無い、晩成/超晩成が`growthPhase().gain`に代償なく上位互換、
   成長タイプ変更・成長力アップアイテムが安価かつ繰り返し購入可でビルドが一極集中）。
   合意した設計（Phase 1・実装対象）：
   - 柱0：`growthPhase()`のgainに成長タイプ別倍率（超早熟×2.4/早熟×1.7/普通×1.25/
     晩成×1.0/超晩成×0.85）を導入し成長総量の格差を8.75倍→3.1倍に圧縮
   - 柱0-b：晩成型トレーニング理論はキャリア1回限り・双方向・高額化。才能開花プログラムは
     累進価格でかなり高額に
   - 柱1：`mlGrowthCap`を「時間+1/年・累計+10まで」＋「実績由来ボーナス×難易度係数
     （易1.3/普1.0/難0.75/鬼0.5）」の合算へ再設計（鬼は理論上カンスト不可能に）
   - 成長力のマスク化：作成時は非表示、3年目に開示
   - 新ステータス2種（生まれつき固定・`build`と同じ流儀）：突破力（`growthFactor`の
     ソフトキャップ超過後の伸びやすさ）・安定感（調子の変動幅。マイライフform／
     シーズンcondの両方に効かせる）。初期値は脚質でゆるやかに差をつける
   - 可変軸レーダーチャート新設（Phase 1は5角形、Phase 2/3でスピリット・運が
     加わり7角形に育つ）
   - 突破力はgrowthFactorが季節/マイライフ共有のため自動的に両モードへ適用。
     柱1（成長上限の実績連動）はマイライフの`mlGrowthCap`専用（シーズンの
     `DIFFICULTIES.growthCap`は今回対象外・据え置き）
   **Phase 2（2026-08・完了。詳細は上記「§18」参照）**：イベントを能動発火（ボタン押下）
   から受動発火へ刷新し新ステータス「運」を追加。合わせてユーザーから「イベントは最終的に
   数百種類にしたい」との追加方針を受け、能力/新ステ変動・賭け（ダイジョーブ博士系）・
   覚醒・悪イベントの5分類のスキーマを新設し46件（新規31件）まで拡充した。
   **✅ イベント本文の継続拡充（次回以降・恒常タスク）**：「数百種類」は§18の第1弾では
   到達していない長期目標。今後セッションを跨いで、§18で確立した5分類のタグ付け方針
   （`bad:true`／`weight`（レア度）／`outcomes`（賭け分岐）／`abKeyDelta`／
   `breakthroughDelta`/`stabilityDelta`/`luckDelta`／`growthPowBump`/`talentCapDelta`）を
   そのまま踏襲し、`data/events.js`のML_EVENTSへ追記していく。新規カテゴリの発明より、
   既存5分類のバリエーション追加を優先する（統一感・保守性のため）。
   **Phase 3（次回以降・メモのみ）**：マイライフに自チームの僚友システムを新設し、
   新ステータス「スピリット」（チームメイトの育ちやすさ・チームケミストリー掘り下げ）を
   接続。現状マイライフには僚友もチームケミストリーも存在しないため新機能扱い。
   **保留（判断③）**：脚質ごとに能力別の成長上限差をつける案は今回見送り。レース
   バランス（`effAbilities`等）への波及が大きいため、育成上限の実績連動が定着してから
   改めて検討する。
   **保留（判断⑤）**：資金の使い道の拡充・野心ルートの上位段追加などのコンテンツ面は
   今回スコープ外。今回は育成カーブ・ビルド多様性の是正に絞る。
   **保留（判断⑰）**：新ステータス（突破力・安定感、将来的にスピリット・運も）を
   配合の遺伝要素にする案は、次アクション7番「配合面の深掘り」のフェーズで接続する
   （Phase 1では遺伝なし・初期値のみ）。

- **メニューの「ホームに戻る」を大分類の即時選択項目に格上げ（完了・上記1番）**：
  従来は☰→その他→🏠拠点に戻る、という2階層ドリルダウンでしかホーム(BaseView)へ
  戻れなかった。`data/seasonMenu.js`の`SEASON_MENU_CATEGORIES`に、`sections`を
  持たないリーフ項目`{key:"base", icon:"🏠", label:"ホームに戻る"}`を先頭へ追加し、
  「その他」内にあった重複エントリは削除。`components/menu/MenuShell.jsx`の
  大ジャンルボタンのonClickを`c.sections ? selectCategory(c.key) : selectSection(c.key)`
  に分岐し、sectionsを持たない項目はドリルダウンせず即座に選択・メニューを閉じるように
  した（`menuNav.js`の`selectSection`は元々1ステップでopen:false/section設定まで
  行う設計だったため、状態機械側の変更は不要だった）。
  **検証**：Playwrightで実際にゲームを開始→選手一覧画面まで遷移→☰→「ホームに戻る」を
  1タップしただけでBaseView（拠点画面）に戻ることを確認。「選手」等sectionsを持つ
  カテゴリは従来通り「← 戻る」付きの小ジャンル一覧へドリルダウンすることも確認。
  「その他」から重複項目が消え、ヘルプ/セーブ/タイトルに戻るの3項目のみになったことも
  確認。本番ビルド成功。

- **Step13第7弾：メニューの大分類を17小分類へ細分化**：それまで1大分類=1小分類だった
  riders/facility/market/race/recordsを、既存セクションのJSXを機械的に切り出す形で
  細分化した（`data/seasonMenu.js`の`SEASON_MENU_CATEGORIES`）：
  選手→選手一覧/チーム状況/ユース・血統配合（3）、施設・機材→施設状況・機材強化/
  スタッフ雇用/OBコーチ（3）、市場→新人スカウト・FA移籍/引き抜き・トレード/
  パーツ・消耗品（3）、レース→レースカレンダー/シーズン状況・目標（2）、
  記録→通算成績・実績・年度別記録/殿堂入り選手名鑑/通算タイトル・コースレコード・
  特能図鑑/年間プログラム・順位表・トロフィールーム（4・新設）。
  ユーザー判断による3件の移動も実施：施設末尾の「ゲームをリセット」ボタンと
  市場先頭の「チーム名」編集セクションは、状況表示・取引とは無関係な設定操作として
  新設の`hub/misc.jsx`（その他カテゴリの`misc_settings`）へ統合。旧home.jsx（現race）
  末尾の「年間プログラム／順位表／トロフィールーム」リンクは記録カテゴリの新設
  `records_standings`へ統合し、隣接していた「セーブ／タイトルに戻る」の重複ボタンは
  「その他」カテゴリと重複するため削除した。
  BaseViewの部屋タップ対応（`ROOM_SECTION_MAP`）も併せて変更：training→facility_equip・
  medical→facility_staffは「部屋の状態を表す施設状況画面」への導線のまま据え置き、
  mechanic→market_shop・scout→market_scoutは「その部屋でやりたいこと」＝実際に
  パーツを買う／選手を探す市場側へ直接飛ばす形に変更（ユーザー指示）。
  ファイル構成：`hub/riders.jsx`等5つのフラットファイルを`hub/riders/`
  `hub/facility/` `hub/market/` `hub/race/` `hub/records/`の5ディレクトリ・
  15ファイル＋`hub/misc.jsx`へ分割し、`git mv`ではなく新規作成→旧ファイル`git rm`の形で
  移行（JSXの中身はbyte-for-byte維持、importパスのみ`../../../../`に調整）。
  `hub.jsx`のセクション出し分けロジックは、セクション数が6→17に増えたため
  if/elseチェーンから`SECTION_RENDERERS`のオブジェクトルックアップ表へ置き換えた。
  **検証**：`npm run build`成功。Playwrightで新規ゲーム開始→シーズンモードへ入り、
  17小分類すべて＋セーブ／タイトルに戻る（確認ダイアログのキャンセルまで）を
  メニュー経由で開き、コンソール／ページエラーが皆無であることを確認。
  BaseView部屋タップについては、敷地画面のSVG上でスカウト部屋の当たり判定座標を
  特定して実タップ→`market_scout`セクションが正しく開くこと、クラブハウス部分への
  タップでメニュー全体が開くフォールバックが機能することを実機タップで確認。
  残り2部屋（training/mechanic/medical）はアイソメトリック投影の当たり判定座標の
  ピクセル特定が難航したため実タップでの網羅確認は行っていないが、`ROOM_SECTION_MAP`は
  4部屋とも同一パターンの単純なオブジェクトリテラルであり、コードレビューで妥当性を
  確認済み（scoutでの実地確認によりtap→section配線の仕組み自体は実証済み）。

**DEVLOG.mdのサイズについて**：CLAUDE.md §4に従いスリム化を2回実施済み。
2026-07（§11のWave F-3a/F-3b、§12のWave G-1改バグ修正群を索引形式へ圧縮）に続き、
2026-08にも実施：§11のWave F-1〜E-3a（詳細プローズ→件名＋要点1行＋`git show`索引）、
§12のWave G-1導入部・G-2/G-3からドット絵グリッド化への計画変更の経緯（詳細プローズ→
同索引形式）を圧縮。すでに索引化済みだった各Waveの実機バグ修正リストや、CLAUDE.md §6の
根拠になっているdancing_NE真因判明の節はそのまま残した。**142KB→約108KB**（約34KB削減）。
情報はいずれもgit履歴に残っているため実質的な損失はない。
