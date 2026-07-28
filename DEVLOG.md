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
    `(state, ...args) => newState` の形（setGへの薄い接続だけApp()に残す）のものを純関数として抽出。
    `season/transfer.js`(移籍・トレード：着手済み、他ドメインは未着手)
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
| `v41 第1候補③：移籍市場の駆け引き（引き抜き合戦）` | シーズンの駆け引き第三弾＝**引き抜き**を双方向で実装。**被引き抜き（受け身）**＝ライバルが自チームの主力（主将以外・健康・OVR66以上の最上位）を引き抜きに来る `poachOffer` モーダル（月送り時に16%＋条件で発火・移籍志願より優先）。**引き止める**（慰留費用≒移籍金×0.4を払い残留＋調子+1）か、**放出**（移籍金を受け取り主力を手放す＝相手の rivalAlumni に加わり以後ライバルとして自チームの前に出走）を選ぶ。**引き抜き（攻め）**＝ショップの `poachMarket` 画面で各ライバルの看板選手（baseline最上位）を移籍金で獲得。**1シーズン1回まで**（`poachDoneThisYear`・年度末リセット）。成立で相手の `rivalRosters` から外れ（世界に反映）自チームへ加入。移籍金は実効OVR×係数×移籍意欲（前向き0.8／標準1.0／看板1.45）で算定。**実装**＝`state.js` に `worldRiderToRosterRider`（baseline方式のワールド選手を実能力へ実体化）／`genPoachTargets`（年1更新・rivalRostersとid共有）／`makePoachOffer`、`poachTargets`・`poachDoneThisYear` を initGame／SAVE_FIELDS／resyncRid に追加。`main.jsx` に `poachRetain`／`poachAccept`／`poachSign` ＋advanceMonthへ被引き抜き挿入＋yearendで市場再生成。`season.jsx` にモーダル・市場画面・ショップ導線・ヘルプ。**検証**＝Nodeで19ケース単体テスト（実体化のidentity維持/決定論/OVRスケール・候補生成の主力選出/降順/意欲/null安全・オファーの対象選別＝主将/負傷/薄いロースター除外）全PASS。Playwrightで引き抜き市場（候補6名・移籍意欲表示）→落札でロースター6→7＆年1枠が使用済みに→被引き抜きモーダル（引き止め／放出の両分岐）→年度末ロールオーバーまで実エラー0 |
| `v40 第1候補②：シーズンに「中期目標」（複数レースにまたがるスポンサーの約束）` | ①監督指示カードに続く**シーズンの駆け引き**第二弾。単月の「指定レース」（見せ場ボーナス）や年間ノルマ（総pt）とは別枠で、**複数レースにまたがる中期目標**をスポンサーが契約時に1つ提示する。5種＝`wins`常勝軍団(通算4勝)／`climb`山岳の覇者(登坂系2勝)／`sprint`平坦の常勝(平坦系3表彰台)／`bigstage`大舞台の栄光(★★★で1表彰台)／`youth`新星の証明(25歳以下エースで1勝)。**期限月**（8〜10月＝MONTHS index）までに達成すれば臨時ボーナス（資金＋ノルマpt）、未達なら違約金。関数(match/desc)はセーブに載らないため id で引き直す（監督指示と同方式）。**実装**＝`support.js` に `SEASON_OBJECTIVES`／`genSeasonObjective`(classでスケール)／`raceObjectiveEvent`／`advanceObjective`(達成でその場報酬)／`expireObjective`(期限切れで違約金)／`objectiveStatusText`。`main.jsx` の finishRace／finishTeamTT／finishStage の3経路すべてで進捗判定、advanceMonth で期限切れ判定＋違約金を budget に計上、yearendに総括を追加。`season.jsx` はスポンサー選択画面（3提案を表示）・主画面パネル（常時進捗）・レース結果／GC FINAL／年度末サマリー・ヘルプに配線。**検証**＝Nodeで22ケース単体テスト（5種の進捗/達成/報酬・4着や脚質違いで非進捗・期限切れ違約金・達成済みは失効しない・クラススケール・null安全）全PASS。Playwrightで load→契約(3目標提示)→主画面(進捗パネル)→実レース(結果だけ見る経路=finishRace)→翌月(expireObjective)まで実エラー0 |
| `v39.20 sim本体に展開戦術を実装（トレイン/発射/前待ち/ピールオフ）＋観戦で可視化` | v39.19の「用語で見せる」からさらに踏み込み、**駆け引きそのものをsimの挙動として実装**。**トレイン**＝終盤(最終区間 or 進捗86%超)、同集団の自チームは脚が残る順に縦一列でエースの前に並び(slot=0..k)、エースは列車直後の風除けに入る。**前待ち**＝勝負所の手前(進捗72〜86%)でエースと第一アシストだけ集団前方へ位置取り（脚は使わない）。**発射(launch)**＝リードアウトが脚を使い切って役目を終えた瞬間にエースへ`launchLeft`を付与。**ピールオフ**＝力尽きた牽き手が後方へ下がる。これらは slot に反映されるため俯瞰マップの隊列としても目に見える。**バグ修正**＝エースが一時的に別集団になっただけでpeel/launchが誤発火していた（同集団にいるのに脚が尽きた場合に限定）。**可視化**＝`tagHist`に展開タグを記録し`tagAt()`で再生時刻から引いてバッジ表示（トレイン/リードアウト/発射！/前待ち/力尽き後退）。Node検証：現実的なコースで front 2592 / train 2402 / leadout 432 tick 発生、自分にも front→train→leadout が付与。Playwright実エラー0 |
| `v39.19 展開のリアリティ（逃げ/追走/ペロトン/牽引/リードアウトの明示）＋ゴール演出の導入カメラ` | 2点。**展開のリアリティ**＝simには既にグループ・牽引ローテ・リードアウトの実装があったが「今どういう構図か」が読めなかったため、ロードレースの用語で可視化。(1)**集団の役割ラベル**＝各グループを人数と前後関係から分類し「逃げ集団 N名／追走集団／ペロトン（最大の塊）／遅れた集団／独走」を集団の上に表示。(2)**役割バッジ**＝各選手に「牽引（先頭交代の当番）／次に牽引／リードアウト」を明示（自チーム・自分・牽引者のみ＝混雑回避）。**ゴール演出の導入カメラ**＝ユーザー提案を採用。開始1.5秒はカメラをゴール手前の路面に置き（先頭の6ユニット前方）、集団が画面奥から入ってくるのを見せてから先頭へフォーカスを移す＝「いきなり選手が現れる」違和感を解消。Playwrightで俯瞰マップに「逃げ集団5名／ペロトン21名／遅れた集団2名」＋牽引バッジが出ることを確認・実エラー0 |
| `v39.18 沿道を道のカーブに追従＋難易度で判断の効きを変える` | 2点。**沿道の柵が画面と平行で違和感**＝v39.17の柵は画面軸に沿った縦棒＋垂直オフセットだったため、カーブする道に対して並行に見えていた。道の局所方向を微小差分から求め、**法線方向に道幅ぶんオフセット＋道の傾きぶん回転**して配置＝道に沿って並ぶ自然な沿道に。**難易度で判断の成功率**＝`MOVE_EFF_BY_DIFF`（easy1.15/normal1.0/hard0.82/oni0.66）を導入し、resumeSimで一手の効き（アタック持続・追い込み量finaleSend・温存/粘りのtick）をスケール。simに`difficulty`を持たせ両モードのbuilderから渡す。Node検証（丘陵で「仕掛ける」の着順改善量）：easy -7.9pts / normal -12.2 / hard -4.2 / **oni 0.0**＝上位難易度ほど同じ一手が決まらず、仕掛けどころの見極めがシビアに。Playwrightで俯瞰(道に沿う沿道)を確認・実エラー0 |
| `v39.17 俯瞰マップにもスピード感／ゴール前の間合いを長く／ズーム往復のハンチング修正` | 3点。**俯瞰マップのスピード感**＝カメラが集団を追う＝選手は画面上ほぼ静止するので、速度は背景で見せる必要がある。道の両脇にコース全長0.4%間隔の並木/柵（交互色）を敷き、カメラの前進に応じて高速に流れるようにした。**ゴール前のやりとりを再現**＝ゴール演出の接近フェーズを延長（t1 2.9〜3.6→5.2〜6.2秒）し、同時に走行距離も延長（vtStart -15→-26）してスピード感を維持（時間だけ延ばすと遅く見えるため）＝差し・リードアウト・抜きつ抜かれつを見せる尺を確保。**ズーム往復で集団の挙動が不自然**＝集団の伸縮で目標spanが揺れ、非対称補間と枠寄せ補正が競合して倍率が振動（ハンチング）していた。目標との差が12%未満なら倍率据え置きのデッドバンドを導入＋枠寄せ補正の1フレーム変化量を制限。**スリム化**＝演出刷新で未使用になった定数（SPRINT_CINEMATIC_MS/SPRINT_MAX_SPREAD）を削除。Playwrightで俯瞰(沿道の並木)・ゴール演出を確認・実エラー0 |
| `v39.16 ゴール演出のスピード感を根本強化（走行距離4倍・沿道密度・常時ease-out）` | 「ゴールスプリント全体で速度感がない」への根本対応。**原因**＝接近フェーズの移動距離が3.6ユニットしかなく、カメラが先頭を追う構造上「地面がほとんど流れない」＝スピード感が出ようがなかった（背景が動かなければ速く見えない）。**対策**＝(1)開始地点を大きく手前へ（vtStart -3.6→-15）＝同じ時間で**約4倍の距離**を走り地面・沿道が高速に流れる、(2)沿道の柵を0.5ユニット間隔へ密度アップ＋交互色＝流れる速さが目で読み取れる参照物に、(3)イージングを常時ease-out化（序盤ほど高速→ラインに向けて減速。接戦はさらに強い減速で"ゴールの瞬間"を溜める）＝**速い→スロー＆ズーム**の落差でゴール前が引き立つ、(4)地面タイル範囲を拡張(16→20)して長距離移動でも欠けない。Playwrightで実走キャプチャ（開始時は集団がライン遥か手前、沿道の柵が密に流れる）・実エラー0 |
| `v39.15 ゴール演出のスピード感強化＋レース中のスロー/ズームを強めに` | 2点の体感調整。**スピード感**＝ゴール演出の通過後フェーズを短縮(t2 3.0→1.7秒)して一気に流れるようにし、接近時のスローとの落差で緩急を強調。あわせて高速フェーズ中は全選手に速度線を出す（簡易スプライトにも追加）＝スロー解除後の疾走感。**レース中のスロー/ズーム**＝ズーム連動スローを強化＋効き始めを早く（しきい値span 0.14→0.20、減速率0.62→0.76＝最大で約1/4速）、山場(beat)の減速も強めた（判断カード0.42→0.30／フラムルージュ0.5→0.38／アクションカム0.6→0.42）、持続も延長（+600ms前後）、山場のズーム倍率も強化(span×0.6→×0.44)。Playwrightで両ビュー・実エラー0 |
| `v39.14以前〜v33系（85件・要約リスト）` | 全文はgit履歴に保存済み。件名で `git log --oneline --grep="<キーワード>"` または `git log --oneline \| grep <キーワード>` すれば該当コミットが見つかり、`git show <hash>` で当時の詳細（実装箇所・検証結果込み）を復元できる。以下は件名のみの索引（新しい順）：<br>v39.14 残像の描画負荷対策＋マイライフ育成カーブの再設計（カンスト対策・難易度連動） ／ v39.13 残像対策＋最終スプリント判断＋ゴールスロー再調整＋縮尺バー ／ v39.12 俯瞰マップ大幅強化（6点：自転車アイコン/ギャップ可視化/KOM・残距離/アクションカム/隊列/沿道） ／ v39.11 ロードバイクのドット絵化／再生を遅く＆×0.5追加／俯瞰マップを地形着色＋勾配表示 ／ v39.10 ゴール演出：ドット絵化・密集緩和・ゴール固定カメラ／俯瞰の緩ズーム＆スロー連動＆右寄り修正 ／ v39.9 ゴール演出の修正：重なり解消・自転車スプライト・駆け引きを手前から ／ v39.8 ゴール演出をカイロソフト風アイソメ(2:1ディメトリック)に ／ v39.7 ゴールを斜め視点＋スプリントの駆け引き演出／俯瞰ズームを滑らかに ／ v39.6 ゴールスプリントを横視点(サイドビュー)＋高速スクロール背景に ／ v39.5 ゴール演出を放送カメラ風に（follow→ライン固定・左→右・接戦スロー） ／ v39.4 ゴールスプリント演出を横フロー化＋アシストのエース着順表示バグ修正 ／ v39.3 観戦演出の強化：スロー＋ズームの山場(beat)と実況拡充 ／ v39.2 最終直線シネマティックを集団スプリント対応（表示人数拡大） ／ v39.1 判断カードを脚質・特性・役割・地形と連動（種類拡充） ／ v39 A案:レース中の判断カード（観戦→"プレイ"へ）＋スリム化 ／ #9 A-4:選手→監督の転身ブリッジ＋世界暦の可視化（A案の連結完了） ／ #9 A-2/A-3:レジェンド招聘＋共有ワールド（1つの世界が両モードで年を取る） ／ #9 A-1:統合ダイナスティ・ハブ（両モード共通の系譜/因子）＋ヘルプ拡充 ／ #9 B案（配合・系統の深掘り）B-1〜B-4＋2修正 ／ フィードバック9項目バッチ（#1〜#8＋リードアウト・スタミナAI） ／ シーズン:相手チームを永続ロースター化（選手とチーム同期） ／ 両モード:チーム数拡張＋マイライフ所属/クラス実効化 ／ マイライフ:ワールド選手の年次成長・引退で世代交代 ／ マイライフ:永続ワールドロースター＋全チーム成績台帳 ／ 拡充:パーソナリティ3種＋異名を追加（会話/イベント完備） ／ 拡充:特殊能力をさらに7種追加（第2弾・良5/悪2） ／ 拡充:特殊能力を5種追加（既存simレバーに接続） ／ メタ:CPショップ（貯めたCPで恒久解禁を購入） ／ メタ:クリアポイント(CP)拡充 — マイライフでも獲得＆CP特典 ／ マイライフ:観戦マップに選手名ラベル＋選手成績台帳 ／ マイライフ:チームTTをチーム結果に＋全レースに順位表 ／ fd862f2 ／ a7678b4 ／ d407a7d ／ 1a15631 ／ 0abbcfd ／ d905587 ／ f9b1bc8 ／ fc29891 ／ ca54130 ／ 20dc260 ／ e98092f ／ DEVLOG ／ A-3 ／ C-2増分1 ／ C-2増分2 ／ UI下馬評 ／ バランス:シーズン順位実効化 ／ UI:マイライフ主画面導線 ／ UI:能力プレビュー ／ UI:レース後サマリー ／ UI:シーズン主画面導線 ／ UI:マイライフ・ショップ整理 ／ 修正:アシストの自滅・大敗 ／ C-2 新競技:チームTT ／ D演出:引退セレモニー＆殿堂の集大成 ／ B-2 逆メンター:弟子を育てる ／ マイライフ:アシストの不整合を修正 ／ シーズン深掘り:スタッフの個性化 ／ シーズン深掘り:育成の手応え ／ シーズン深掘り:ケミストリーの可視化＋絆の節目 ／ シーズン深掘り:ライバルチームの個性 ／ シーズン深掘り:タイトル争いの物語化 ／ UI:選手詳細にキャリアの軌跡 ／ UI:実況の充実（注目選手を名指し） ／ UI:セーブの安心感（続きから明細） ／ D物語:メディアナラティブ ／ D物語:因縁が育つライバル ／ バランス:配合小要素点検＋危険度を実効化 ／ バランス:配合点検＋二刀流を実効化 ／ バランス:難易度つまみを高クラスで実効化（鬼を強化） ／ バランス:エース早期発射を実効化（勝負の逃げ） ／ バランス:シーズン作戦の点検 ／ バランス:作戦説明の正直化 ／ バランス:地形別フィニッシュ決着 ／ 修正:アシストの観戦⇔リザルト同期ズレを根治 ／ 修正:アシスト大敗＆横一線ゴールの再修正 ／ 改善:ライバル会話ドラマを双方向イベント化 ／ 両モード:性格ベースのイベント ／ マイライフ:完全休養・取材/私生活を有意義に ／ マイライフ:新聞・雑誌イベント（大勝・連勝の号外） ／ マイライフ:性格ベースのライバル会話ドラマ（紙芝居/VN風） ／ マイライフ:リセマラ（素質診断＋引き直し）強化 ／ マイライフ:経歴（出自）ごとの固有メリット ／ マイライフ:弟子育成の深化（絆・鍛錬・指導イベント） ／ マイライフ:突然の強制引退→契約更改の選択制 |

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

## 9. モジュール細分化・整理（2026-07・Opus設計→Step1〜8実施）

**背景**：v41（移籍市場）完了時点で `main.jsx`(3041行)・`logic/support.js`(2574行) が肥大化し、
ロジックが単一Reactクロージャ(`App()`)と雑多な`support.js`に集約される構造リスクを検出。Opusが実測ベースで
「理想的なファイル・モジュールの細分化設計図」を作成し、リスクの低い Step 1〜4 を実施した（Step 5〜8＝
`domain/`・`controllers/`層への本格分離は未着手、下記参照）。

**設計原則（新規追加は必ずこれに従う）**：
1. 依存は下向き一方通行：`data → core/sim → domain/state/view → controllers → screens → app`
2. `data/`・`view/`は JSX を import しない（＝常にNodeで単体テスト可能に保つ）
3. データ（`export const`）とロジック（外部関数呼び出しを含む`apply`/`effects`）を混同しない。
   `check:`/`match:`のような**自己完結の小さな述語関数**（引数のみ参照）はデータとして扱ってよいが、
   `bumpRosterAbAll(s, 8)`のように**外部の状態変更関数を呼ぶクロージャ**は論理（domain）であり、
   `data/`へ移送しない（`CP_MILESTONES`・`ML_CROSSROADS`・`ML_OFFSEASON_CHOICES`・`SEASON_ACHIEVEMENTS`が該当し、
   `support.js`に意図して残している）

### 実施内容
- **Step 1**：`main.jsx`の死コメント477行を削除（55〜506行目＝分割前の単一ファイル時代の見出しのみで実コード0行、
  ＋v11→v12変更履歴ヘッダ23行＝DEVLOGと重複）。3041行→2564行。
- **Step 2**：`roadrace_v5〜v11.*`(1.7MB)・`roadrace_design_v2〜v12.md`(120KB)を`archive/`へ`git mv`（履歴保存）。
  `.gitignore`にallowlist追加。DEVLOG §1のファイル構成記述も更新。
- **Step 3**：`support.js`の静的データ定数のうち、**外部関数呼び出しを含まない純データ**41ブロック(457行)を
  `data/economy.js`(経済・スタッフ・天候等)・`data/events.js`(選択肢イベント)・`data/directives.js`(監督指示・
  中期目標)・`data/gear.js`(マイライフ装備)・`data/progression.js`(種目/成長順/チーム関連の分類テーブル)へ移送。
  `support.js`は`import`＋`export {}`で再エクスポートする**互換シム**を追加し、main.jsx/screens/*.jsxの
  既存import文（100箇所超）は無変更のまま動作。2574行→2137行。
- **Step 4**：文字列生成の純関数群を`view/`へ新設。`view/flavor.js`（`riderFlavorText`＋FLAVOR_*表＋
  内部ヘルパー6個、選手の戦績から語り口を選ぶ）、`view/news.js`（`rivalNews`／`mlWorldNews`／`mlNewspaper`＋
  `RIVAL_NEWS_TEMPLATES`）。同じく互換シムで再エクスポート。2137行→1776行（**support.js合計 -31%**）。

**検証**（全Stepで実施・push前に必ず通す）：
- `npm run build` 毎ステップ後に実行（構文エラー・未解決import・重複識別子はesbuildが検出＝ビルド成功が強い証拠）
- 波括弧/角括弧の対応数を機械チェック（削除境界の欠落検出）
- 既存Node単体テスト（v40中期目標22ケース・v41移籍市場19ケース）を毎ステップ後に再実行→全PASS
- Playwrightで両モードの主要画面（シーズン：契約→主画面→選手→ショップ→引き抜き市場→記録→ヘルプ→レース実施→
  月送り、マイライフ：経歴選択画面）を実機で遷移確認→実エラー0

**Step 3で判明した重要な知見**：`CP_MILESTONES`・`ML_CROSSROADS`・`ML_OFFSEASON_CHOICES`・`SEASON_ACHIEVEMENTS`は
一見データテーブルだが、`apply`/`check`フィールドが`bumpRosterAbAll`等の外部domain関数や`hasAbility`等の
core関数を呼ぶクロージャを持つ（＝ロジックがデータの皮を被っている）。これらを`data/`へ移送すると
「data → domain」という逆依存が発生するため、**意図的に`support.js`に残した**。新規のデータテーブルを追加する際は、
「`match`/`check`が自分の引数だけを参照するか、外部関数を呼ぶか」で置き場所を判断すること。

- **Step 5**：純粋なドメインロジック（生成器・計算関数）を`domain/`へ集約。まず`data/teams.js`を新設し
  `RIVAL_TEAMS`／`MYLIFE_TEAMS`（純データ・関数を含まない）を`state.js`から移送——これが無いと
  `domain/season/*`が`RIVAL_TEAMS`を参照するのに`state.js`へ逆import、かつ`state.js`は`initGame()`用に
  生成器を呼び返す必要があり**循環importになる**ため、必須の前提整理だった。続けて5ファイルを新設：
  `domain/season/transfer.js`（`legendToSeasonRider`／`worldRiderToRosterRider`／`genPoachTargets`／
  `makePoachOffer`／`genFaPool`／`genTradeOffers`／`computePickupChance`）、`domain/season/roster.js`
  （`initRoster`／`genScouts`＋内部ヘルパー`scoutSpecs`）、`domain/season/sponsor.js`（`genSponsors`＋
  中期目標一式＝`genSeasonObjective`/`raceObjectiveEvent`/`advanceObjective`/`expireObjective`/
  `objectiveStatusText`）、`domain/season/standings.js`（`computeStandings`／`seasonRank`／
  `seasonTitleRace`／`standingsRankReward`／`champPromoteCut`）、`domain/shared/forecast.js`
  （`raceForecast`）。`state.js`/`support.js`は同じ互換シムで再エクスポート。未使用になった import
  （`CLASSES`/`MONTHS`/`overall`等）も併せて除去。state.js 1257→1071行、support.js 1776→1615行。
  **判明した知見（Step3の教訓を再確認）**：`unlockedTemplates`／`genMonthRaces`は`loadMeta()`
  （localStorage読み取り）に依存するため**domain抽出を見送り**state.js に残した。`SEASON_ACHIEVEMENTS`
  の`chemistry_max`判定が`teamChemistryTier`（support.js）を呼ぶため、`computeSeasonAchievements`も
  同様に**support.js に残した**（一度`domain/season/standings.js`へ移してビルドエラーで発覚→即座に差し戻し）。
  「データ/ロジックの区別」は一度で完璧に判定できるとは限らず、**ビルドエラーが出たら虚心に戻す**姿勢が安全。
  検証は同じ手順（build→brace確認→重複確認→Node41ケース→Playwright全画面）を各グループごとに実施、全PASS。

- **Step 6**：`state.js⇄breeding.js`の循環依存を解消。原因は`breeding.js`の`mlLegendSnapshot`（引退時の
  殿堂スナップショット生成）が`ML_ACHIEVEMENTS`／`computeAchievements`／`mlCareerArchetype`／
  `riderCareerSummary`／`riderNickname`の5つを`state.js`から借りていたこと。調べると、この5つは
  **`state.js`固有の依存を一切持たない完全に自己完結した純関数・純データ**で、`breeding.js`の
  `mlLegendSnapshot`だけが唯一の利用者だった（`state.js`内の他の場所からは一度も呼ばれていない）。
  そこで5つ（＋`riderNickname`の内部ヘルパー`hasEarnedNickname`）をまるごと`breeding.js`へ移し、
  `breeding.js`から`state.js`へのimportを完全に撤廃。残るのは`state.js`が`breeding.js`の`loadMlLegends`
  （殿堂リストの読み込み）を使う一方向だけになった。`state.js`側は同じ互換シムで5つを再エクスポートし、
  main.jsxの既存import文は無変更。state.js 931行、breeding.js 290→408行。
  **検証**：build→brace確認→重複確認に加え、`state.js`経由と`breeding.js`直接importで**同一関数参照
  （`===`で一致）**であることを確認するテストを追加（シムが正しく機能している証拠）。`mlLegendSnapshot`／
  `mlRecordLegend`（循環解消の核心となった関数）を直接呼び出す16ケースの単体テストを新規作成し全PASS
  （殿堂スナップショットの内容・実績判定・キャリア生き様・localStorageへの記録まで実地検証）。既存の
  Node41ケース・Playwright全画面回帰（シーズン：選手/トロフィー画面、マイライフ：起動）も実エラー0。

- **Step 7（着手・移籍ドメインのみ完了）**：`main.jsx`のApp()内ハンドラを`controllers/`へ分離する着手。
  Step1〜6が全て「純粋な関数・データの再配置」だったのに対し、Step7はApp()の生きたReact状態
  （`setG`/`setMl`のクロージャ、89メンバーの`ctx`）に触れるため質的にリスクが高い。**最初の一歩として
  最小の移籍ドメインだけを切り出した**（`retainRider`／`grantTransferRequest`／`poachRetain`／
  `poachAccept`／`poachSign`／`acceptTrade`／`declineTrade`の7ハンドラ）。
  **パターン**：これらは元々すべて`setG(s => {...新state...})`という形だった＝実質
  **`(state, ...args) => newState`という純粋なreducer関数**。`controllers/season/transfer.js`に
  その形のまま抽出し（JSX/React非依存）、`main.jsx`側は`const retainRider = () => setG(tfRetainRider);`
  のような**1行の薄いラッパー**に置き換えた。この「reducer関数を`controllers/`へ・`setG`接続はApp()に残す」
  パターンは、React特有の再レンダリング・クロージャの罠を避けつつcontroller抽出の恩恵（Node単体テスト化・
  App()の縮小）を得られる型として、以後のcontroller抽出でも踏襲する。main.jsx 2564→2474行。
  **検証**：抽出したreducer関数を直接呼ぶ25ケースの単体テストを新規作成（引き止め・移籍金授受・
  ロースター上限・年内1回制限・トレード成立/見送りの分岐を実地検証）し全PASS。既存Node57ケース
  （v40/v41/Step6）と合わせ計82ケース全PASS。Playwrightで引き抜き市場からの落札・トレードの見送り・
  月送りループを実機確認、実エラー0。

- **Step 8（着手・season.jsxのみ完了）**：`screens/season.jsx`（2038行・22種の`g.screen`分岐を1関数に
  収めたディスパッチャ）を、用途クラスタ単位で`screens/season/*.jsx`へ分割。ユーザーとの合意により
  「season.jsxのみ先行・mylife.jsxは次回以降」「画面ごとに全部バラす（22ファイル）のではなく中粒度
  （6ファイル程度）」の2点を確認してから着手。
  **分割**：`intro.jsx`(オンボーディング：intro/newgame_setup/scoutpolicy_initial/sponsor)・
  `hub.jsx`(mainのhome/riders/shop/career/help 5タブ・949行)・
  `transferEvents.jsx`(event/transferRequest/poachOffer/poachMarket/event_result)・
  `scheduleBoard.jsx`(program/standings/trophy)・`race.jsx`(startlist/lineup/race/result/gc系)・
  `yearend.jsx`(yearend/clear)。各ファイルは`ctx`のうちその画面群が実際に使うメンバーだけを
  destructureする（機械的に使用識別子を洗い出して決定・全メンバーを毎回丸ごと渡す方式は踏襲しない）。
  `screens/season.jsx`自体は`g.screen`の値を見てどのサブファイルへ委譲するかだけを決める27行の
  薄いdispatcherとして残す（`renderSeasonScreens(ctx)`という関数名・シグネチャは不変＝main.jsx側は
  無変更）。
  **手法・検証の質的な違い**：Step7は状態遷移の「純粋なreducer関数」の抽出だったのでNode単体テストで
  機械的に正しさを検証できたが、Step8はJSXレンダリング関数の「置き場所を移すだけ・中身は1文字も変えない」
  作業。そのため「元テキストの当該行範囲が新ファイルの内容にbyte-for-byte含まれているか」をPythonスクリプトで
  機械照合し、6ブロック全て完全一致を確認（コピペミスの混入をゼロにする一次検証）。その上でPlaywrightで
  season系の全主要画面（intro→newgame_setup→scoutpolicy→sponsor→main5タブ→引き抜き市場→順位表→
  トロフィールーム→lineup→レース結果）を実機で辿り、実行時エラー0を確認。ビルド成功、既存Node82ケース
  全PASS（機能面はStep7までと不変のため新規テストは追加せず）。season.jsx 2038→27行
  （分割後6ファイル合計2107行、import重複による若干増はあるが機能変更なし）。

- **Step 8（mylife.jsx側も完了・season.jsxと合わせてStep8完遂）**：`screens/mylife.jsx`
  （1980行・30種の`ml.screen`分岐を1関数`renderMyLifeScreens`に収めたディスパッチャ）を、season.jsxで
  確立した型（用途クラスタ単位・byte-for-byte照合・中粒度）をそのまま踏襲して分割。
  **分割**：`create.jsx`(mylife_create/mylife_scout)・`hub.jsx`(main/achievements/abilityfile/
  riderstats/worldstats/records・557行)・`help.jsx`(mylife_help)・`race.jsx`(startlist/race/result/
  rival_scene/newspaper)・`events.jsx`(shop/event/protege_event/offseason/crossroads/contract)・
  `career.jsx`(retire_advice/retired/teamroster/graph/ranking/lineage/factors/legends)。
  `screens/mylife.jsx`自体は27行の薄いdispatcherとして残す（`renderMyLifeScreens(ctx)`のシグネチャ不変）。
  **season.jsxとの違い・注意点**：`ctx`メンバーの使用箇所を機械的な識別子マッチだけで決めると、
  CSSの`flexWrap: "wrap"`/`whiteSpace: "pre-wrap"`という文字列リテラルが`wrap`という関数名に誤検出
  されたり、`.map(g => ...)`のようなローカル変数名`g`が、ctxの状態`g`（シーズン側の状態）と衝突して
  誤検出されたりする（実際にcareer.jsx分割時に両方発生し、`wrap`はどのグループにも実は不要
  （mylife側は全て`mlWrap`を使い`wrap`は使わない）、career.jsxの`g`は系譜フォレスト表示のローカル変数
  シャドーイングだと判明し、どちらも除外して正しい依存関係に修正した）。**ctxの使用識別子を機械抽出する
  際は、コード中の文字列リテラルやアロー関数のローカル変数名との衝突を必ず目視で確認すること**
  （特に`g`/`s`/`r`のような1文字変数名や、`wrap`のようなCSSプロパティ名と被る単語は要注意）。
  **検証**：6ブロック全てbyte-for-byte一致を機械照合。ビルド成功、既存Node82ケース全PASS。Playwrightで
  マイライフの主要画面（キャラ作成の脚質/経歴/難易度選択→デビュー→素質確認→main→ヘルプ→ショップ→
  出走表→ライブレース観戦→ゴールまで）を実機で辿り、実行時エラー0を確認。mylife.jsx 1980→27行。

**未着手（今後の候補）**：残る82メンバーのハンドラ（`advanceMonth`/`finishRace`/`buyPart`/`hireStaff`等の
季節ハンドラ、`mlXxx`のマイライフハンドラ）もまだApp()内（Step7参照）。`ctx`89メンバーの手組み自体の解消
（`useSeasonGame`/`useMyLifeGame`フック化）は、ハンドラの分離がある程度進んでからの方が土台が整う。
`hub.jsx`（season側949行・mylife側557行）は依然として大きく、タブ／画面単位でのさらなる細分化の余地は
あるが、現状は許容範囲（他の分割済みファイルと比べ突出はしていない）。新機能は必ず
「data / domain / controller / screen」の4箇所に配る（1機能が既存の巨大ファイルへ"にじむ"のを禁止）。
