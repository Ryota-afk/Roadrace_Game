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
  - `src/main.jsx` … 本体（移行直後は旧scriptを丸ごと保持。Phase 1以降でモジュールへ分割していく）
  - `src/index.html` … Viteの入口HTMLテンプレート（薄い雛形）
  - `src/data/` `src/sim/` `src/breeding/` `src/world/` `src/state/` `src/components/` … 分割後の配置（Phase 1〜3）
- **`index.html`（リポジトリ直下）** … `npm run build` が生成する**自己完結の単一HTML成果物**（デプロイ用）。React/JSXはビルド時に変換・バンドル済みで**CDNもBabelも不要**。手で編集しない
- `package.json` / `vite.config.js` / `package-lock.json` … ビルド定義
- `dist/`, `node_modules/` … gitignore（追跡しない）
- `roadrace_v5〜v11.*` … 過去バージョンのアーカイブ（触らない）
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
| `fd862f2` | 配合を数値化：爆発力＆配合評価SS〜D（→伸びしろへ還元） |
| `a7678b4` | 危険度（インブリードの代償→ガラスの体リスク、健康で軽減） |
| `d407a7d` | 系統確立＋因子（プレイ跨ぎレジストリ、確立→名門→大系統） |
| `1a15631` | 特殊配合（絶対王者/覇道義侠/不屈の鉄血/万能王/純血）＋ 監督指示 復元バグ修正 |
| `0abbcfd` | 検証用ハーネスを .gitignore |
| `d905587` | 献身の道を運ゲーから選択制へ（🤝アシスト作戦）＋ ヘルプ拡充（配合/作戦/世界） |
| `f9b1bc8` | 改名時に始祖系統名を追従（継承系統は維持） |
| `fc29891` | **B**：アシストが実際にエースを勝たせる（献身の走りパネル・報酬） |
| `ca54130` | **A-1**：世界ランキングを世代交代する永続ペロトンに |
| `20dc260` | **A-2**：殿堂の血が世界のペロトンへ🩸流入 |
| `e98092f` | **C-1**：モニュメント（ワンデー・クラシック）3種を追加 |
| (DEVLOG) | 引き継ぎ文書 DEVLOG.md 追加＋実装済み機能インベントリ |
| `A-3` | 世界ランキングのスターが実際のレースに出走（出走表に🌍◯位表示、グレードで人数増減。`buildMyLifeSim` に worldStars 注入、`worldStarTeams`） |
| `C-2増分1` | クラシック適性の配線：`monumentMul`＋`effAbilities`にmonument引数、raceLogにmonumentタグ |
| `C-2増分2` | 脚質別の古典適性3種（`pave_sp`石畳/`ardennes_sp`丘陵/`autumn_sp`山岳）。対応古典のみ全能力+5%（金特+9%） |
| `UI下馬評` | 出走表に予想印（◎本命/○対抗/▲注目）＋評価順位を表示。`raceForecast(entrants,favors)`(support.js)＝コース得意分野の地力で格付け。マイライフ＝プレイヤーの評価も表示。シーズン＝自チーム選手をeffAbilitiesで実効能力化して同じ予想を有効化（AIは元々能力保持） |
| `バランス:シーズン順位実効化` | 規定pt超過が形骸化（取ったら休む方が得）していた問題を修正。既存の飾りだった`computeStandings`のチーム順位表を実効化：年度末に順位で賞金ボーナス（`standingsRankReward`）＋昇格ボーダー緩和（`champPromoteCut`：1位→本番5位以内/2位→4位/他3位、PRO除く）。`seasonRank(g)`。他チームは毎月加点するので走り込むほど順位・報酬・昇格が有利＝走り続ける動機を常時付与。主画面ヘッダに順位表示、順位表画面と年度末画面を実効説明に更新 |
| `UI:マイライフ主画面導線` | 縦長だった主画面の状況パネル群（世界ランキング/監督指示/恩師/スポンサー/ライバル/好敵手）を1つの折りたたみ（既定=閉・`ml.uiStatusOpen`）に集約。閉時は1行サマリ（世界順位・監督評価・人気・ライバル・🔥同走警告）を表示し、毎月の行動（練習メニュー→今月のレース→アクション→出場）を選手カード直下まで引き上げた。情報は「▼詳しく」で全て展開可 |
| `UI:能力プレビュー` | `AbilityGrid`(両モード共用)に成長の伸びしろを可視化：現在値バー＋上限(cap)までの薄い帯＋上限マーカー、数値に「+残り」を併記。マイライフの選手カードに`DisciplineGrid`(種目別コース適性)を追加し、今月のレースが有利とする種目を★でハイライト（`FAVORS_TO_DISCIPLINE`）。育成・作戦の判断材料を強化 |
| `UI:レース後サマリー` | マイライフ結果画面の整理。`mlRaceFinish`の`resultInfo`に`finishTime`/`gapSec`/`forecast`(下馬評結果)を追加。ヘッダに「タイム 45:03／トップ +1:07」、下馬評の答え合わせ「📊下馬評 対抗(3番手予想)→実際4位 ⤵下回る/⤴上回る/→どおり」を表示（`raceForecast`をmlRaceFinishで再計算しme比較）。既存の獲得・対決カードはそのまま |
| `UI:シーズン主画面導線` | シーズンhomeタブのレースカレンダー直上に「🚴 今月のチーム状態」バー（出走可能N/M名・平均疲労・疲労高N名・🩹故障名(Nヶ月)・⛺キャンプ中）を追加。タブ切替なしで「出場か休養か」を判断できる。既存の`healthy`(ctx)を活用 |
| `UI:マイライフ・ショップ整理` | 6400px超の1枚スクロールだったマイライフのショップを3カテゴリのタブ化（🔧パーツ／🧪消耗品・合宿／⭐恒久投資[トレ用品・車・家]）。`ml.shopCat`で切替、各`<section>`を`{shopCat==="…" && (…)}`で条件表示。1タブあたりの縦長を大幅短縮 |
| `シーズン深掘り:育成の手応え` | 練習でOVRが伸びても実感が薄かった。(1) 選手カードに現在の**成長フェーズ**バッジ（☘成長期／⛰全盛期／🍂衰え期＝`growthPhase().tag`）を明示し、伸びしろ(potentialHint)と併せて「今この選手は伸びる時期か」が一目で分かるように。(2) `advanceMonth` で月送りの成長により**OVRの節目(70/80/90)を突破**した選手を検知し、TEAM LOG に「📈 ◯◯がOVR80の壁を突破！若き才能が確かに開花しつつある」と祝う（若手/ベテランで文面分岐）。地道な育成に達成感のフィードバックを与える。**検証**：Playwrightで選手カードにフェーズ（成長期/全盛期）描画・0エラー |
| `シーズン深掘り:ケミストリーの可視化＋絆の節目` | チームケミストリー（在籍で深まるドラフト消耗軽減）が1行の隠し数値に近く、育つ実感が無かった。選手・練習タブに**次のティアまでの進捗バー**＋「次の絆『◯◯』まで平均在籍あと◯ヶ月」を表示（`CHEMISTRY_TIERS`から次段を算出）。さらに`advanceMonth`で月送り時にティアが上がった瞬間を検知し、TEAM LOG に「🤝 長く共に走った絆が実り、チームは『◯◯』に到達」と節目を刻む。メンバーを固定して走り込む動機を可視化。**検証**：Playwrightで選手タブに進捗描画（「次の絆『定着期』まであと6.0ヶ月」）・0エラー |
| `シーズン深掘り:ライバルチームの個性` | RIVAL_TEAMS が名前と色だけで没個性だった。各チームに脚質傾向 `spec`（SPR/CLM/PUN/TT/RUL）＋二つ名 `trait`（スプリント軍団／山岳の名門／独走・逃げ派／オールラウンドの強豪 等）を付与。`buildSim` の相手選手生成で、エースは必ずそのspec脚質・他メンバーも過半数が寄るようにし（Node検証：各チームのエース脚質が40/40でspec一致）、地形別フィニッシュ決着と噛み合って「スプリント軍団は平坦で・山岳の名門は登りで脅威」という対戦の駆け引きが生まれる。`computeStandings`/`seasonTitleRace` に trait を通し、タイトル争いカードに「🎯追う相手：◯◯（二つ名）」、順位表に各チームの二つ名を表示。**検証**：Playwrightでタイトル争い/順位表に二つ名描画・0エラー |
| `シーズン深掘り:タイトル争いの物語化` | シーズンの順位表（`computeStandings`）が数値だけで、優勝争いの緊張感が伝わらなかった。順位表を物語化する `seasonTitleRace(g)`（純関数）を新設＝現在順位・すぐ上の相手＋pt差・すぐ下の相手・首位との差を読み、首位/表彰台圏/追う立場で言い回しを分岐（終盤は煽りを追加）。ホームタブに「🏆 タイトル争い」カードを常時表示し、「5位／5・一つ上のクレディ・ブルー（+3pt）を追う」のように"誰をどれだけ追う/引き離す"が一目で分かる。マイライフの因縁/メディアと同じく、既存の順位実効化（§4）を物語として体験させる深掘り。**検証**：Nodeで順位別の文面分岐、Playwrightでシーズン開幕→ホームに「タイトル争い 5位/5」描画・0エラー |
| `UI:選手詳細にキャリアの軌跡` | キャリアグラフ画面（OVR/世界ランク推移）に、raceLogから「語る価値のある一戦」を時系列抽出して並べる年表を追加。`mlCareerTimeline(ml)`（純関数）＝勝利／モニュメント制覇・表彰台／世界選手権・オリンピック等の大舞台／初勝利・初表彰台を拾い、新しい順に最大30件。アイコン・色で格を表現（🏛クラシック／🌍世界の頂点／✨初勝利／🎖初表彰台）。選手の歩みが一目で振り返れる詳細画面に。**検証**：Nodeで抽出（勝利/モニュメント/大舞台/初物）、Playwrightで新規作成→グラフ画面に「キャリアの軌跡」描画・0エラー |
| `UI:実況の充実（注目選手を名指し）` | レース実況が逃げ集団のギャップ変化しか拾わず、プレイヤーに無関心だった。注目選手（マイライフ＝本人／シーズン＝自チームのエース）の順位を約2.5秒ごとにサンプリングし、先頭浮上／前方へ急上昇／脱落を名指しで実況（`📻 ◯◯が先頭に立った！`等）。既存のギャップ実況と枠を共有し、物語性の高い注目選手の実況を優先（最終区間はラストスパート演出優先で対象外）。レースが「自分の物語」として盛り上がる。RaceView.jsx。**検証**：ビルド通過＋Playwright両モード0エラー（focusId無しは無効化・最終区間除外でガード） |
| `UI:セーブの安心感（続きから明細）` | 「💾 続きから」ボタンが文言だけで、何を再開するのか（誰の・どこまで・いつ保存）分からず不安だった。フルロードせず覗く軽量サマリ `saveGameInfo()`／`myLifeSaveInfo()`（state.js）＋相対時刻 `fmtRelTime()`（core.js）を追加し、両モードの続きからボタンにサブ行で明細を表示（シーズン＝チーム名・クラス・N年目／マイライフ＝選手名(年齢)・クラス・N年目、いずれも「◯前に保存」）。**検証**：Playwrightで新規作成→自動保存→リロード→「続きから 綾小路 走（22歳）・クラス B1・1年目 — たった今に保存」描画・0エラー |
| `D物語:メディアナラティブ` | 選手自身の物語を語るメディアが無かった（mlWorldNewsは世界の他スター、rivalNewsは汎用フレーバー）ため、実キャリア状態から「記事になる角度」を選び見出し＋短い記事を生成する`mlMediaHeadline(ml)`を新設（純関数）。優先度＝新人デビュー／破竹の連勝／世界王者／トップ10躍進／勝利／因縁の宿敵戦／連続表彰台／若手人気／スランプ正念場／ベテラン健在／通算勝ち／雌伏、を raceLog・worldRank(前年差)・rivalRecord.heat・popularity・age から判定。tone(good/bad/neutral)で色分け、seed(年×月)で文面に変化。マイライフ主画面の最上部に「📰 ロードレース・タイムズ」カードで常時表示。**検証**：Nodeで9状態の見出し出し分け、Playwrightで新規作成→「期待の新人、デビュー間近」描画・0エラー |
| `D物語:因縁が育つライバル` | **物語・ドラマ生成(D)の初手**。ライバルが単なる通算勝敗カウンタ＋固定文だった状態を、対戦を重ねるほど・特に接戦ほど燃え上がる「因縁度(heat)」に発展。`rivalHeatTier`＝好敵手→ライバル(4)→宿敵(11)→宿命の宿敵(22)、`rivalMeetingHeat`＝写真判定+3/僅差+2/通常+1、`rivalDrama`＝勝敗×接戦度で「決定的瞬間」の一文を生成（写真判定の死闘／僅差の刺し返し／完勝完敗）＋因縁昇格時の煽り。main.jsxのライバル戦績更新で自分とライバルのfinishTime差から因縁を加算しrivalRecord.heatに保存（旧セーブはmeetingsからフォールバック）、昇格はログにも記録。結果画面のライバル対決カードを固定文→動的な決定的瞬間＋呼称バッジ＋昇格煽りに、主画面のライバルカードも因縁度の呼称・色に。rival/rival2両対応。**検証**：Node（呼称段階/加算/一文/昇格分岐）＋Playwrightで新規キャラ作成→主画面に「🔥好敵手」描画・0エラー |
| `バランス:配合小要素点検＋危険度を実効化` | 配合の小要素（危険度・特殊配合）を点検。**特殊配合**（ML_SPECIAL_MATINGS 5種＝絶対王者/覇道義侠/不屈の鉄血/万能王/純血）はNodeで全5種の発火条件を確認＝正常、稀少で強力なご褒美として妥当につき変更なし。**危険度は重大な抜け穴を発見・是正**：インブリード（濃い血）の代償「ガラスの体(glass)」の効果（故障率2倍・離脱+1ヶ月）は**シーズンのロースター処理(main.jsx 632-702)にしか無く、マイライフには選手本人の故障システムが無いためglassが完全に無効**だった＝マイライフのインブリードが「ハイリスク・ハイリターン」の看板に反しノーリスクで爆発力を得られていた（UIは「健康管理が鍵」と表示するのに管理対象が無い）。故障システムを新設せず、glassをマイライフでは「疲労が溜まりやすく抜けにくい」形（出走疲労×1.35・休養/練習の回復×0.75〜0.78）で実装し、休養頻度に実コストを課した（`glassBody`）。危険度は健康な血（頑丈/鉄人/高スタミナ）で軽減可（Node確認：共通祖先1で危険度19%→片親頑丈で1%）。glass説明も両モード併記に更新。Playwright両モード0エラー |
| `バランス:配合点検＋二刀流を実効化` | **配合まわりの効き検証**（Node）。成長力growthPow倍率 S1.6/A1.3/B1.0/C0.7＝良配合(→S)は悪配合(C)の**2.3倍速で育つ**大きな見返り。配合限定特能の実測（PUN OVR78・B2/normal/y5・N200）＝無印から表彰台率がsireline系申子(+3全)で概ね3倍、dynasty覇道血脈(+2全+3スタ)も同等、いずれも健全。**唯一の弱点＝hybrid二刀流**：+5と数字は大きいが segmentAbility の丘/登/山/スプ区間限定で、決着（finishAbilityは素のclimb/sprint参照）や平坦に届かず、+3全能力のsirelineに見劣り（山岳台51%/クリテ台28%）。二本柱の登坂・スプリント素地を`effAbilities`で+2/+2し、フィニッシュにも効く二刀流へ是正（山岳台67%・クリテ台45%＝スプリント決着ではdynasty超え、脚質に沿う形に）。sireline＝万能最強／hybrid＝二刀流が刺さるコースで強い、の住み分けに。ability説明も更新。sim全体（他特能・決着バランス）は非hybrid選手に無影響。Playwright両モード0エラー |
| `バランス:難易度つまみを高クラスで実効化（鬼を強化）` | **難易度カーブ診断**（Node・進行トラック＝クラス×年数×自OVRを掃引）で判明した客観バグを是正。`newRider`がAI能力を一律94でクランプしていたため、PRO帯では`aiMul`（hard1.25/oni1.55）を掛けても地力が全部94で頭打ちになり、**ハードと鬼がPROで完全に同一の強さ**だった（実測PRO/y8：hard5.6位＝oni5.5位）。最小是正＝`DIFFICULTIES`に`abilCap`を追加、`newRider`に`opts.cap`（既定94）を通し、**鬼のAIだけ上限94→104**へ（easy/normal/hardは94据え置き＝手応え不変）。AI生成箇所（`buildMyLifeSim`のライバル/レジェンド/相手チーム、`buildSim`の相手チーム）に`cap:aiCap`を伝播。自チーム選手・世界スターは対象外。**検証**（N=600・3コース平均・PRO/y10）：自OVR86でhard4.5位[勝14%]→鬼18.3位[勝0%]で明確に分離、脱出口も健在（自OVR102で鬼38%勝・OVR112で36%勝＝極めれば鬼も勝てる）。Playwright両モード0エラー。※副次診断（DEVLOG §5参照）＝脚質が着順を大きく左右／hard/oniは序盤ほど厳しい逆カーブ傾向は別途要検討 |
| `バランス:エース早期発射を実効化（勝負の逃げ）` | シーズンの`ace_early`が全局面で着順を落とす一方通行の博打だった問題を、地形依存の「勝負を賭けた逃げ」に強化。原因＝単独で飛び出したエースが牽引・風除け無しで消耗し（solo effortCost1.3）エネルギー-100で吸収→後方へ（クリテのトレース：gap+1.8→やがて-13.8で失速）。修正＝`committedBreak`フラグ（aceEarly&&isAceで付与）を持つ選手が単独先頭（solo/attack）の間だけ、選抜地形で`energyDrain`を軽減（mtn0.55/climb0.6/hill0.78、平坦・スプリントは1.0＝無効）。登りでは集団が組織的に追えずドラフト優位も縮む現実に対応。集団に吸収されればsolo/attackを外れ自動無効。**検証**：ヒルクライムでace_early 2.29→**1.04（最善手・TOP3 99%）**、平坦クリテ/丘陵は従来どおり吸収されて罠（＝スプリント決着前に捕まる現実挙動）。回帰＝地形別フィニッシュ決着・マイライフ作戦とも不変（committedBreakはaceEarly時のみ発火。マイライフの「積極的に仕掛ける」＝aceEarlyにも同じ強化が一貫して波及）。`CHASE_MODES.ace_early` descを実効化に合わせ更新 |
| `バランス:シーズン作戦の点検` | **シーズン作戦（`CHASE_MODES`）の効き検証**（Node・エース着順比較・脚質×コース×競争度）。push=集団を保ちわずかに上位（集団ゴールに強いエース向き。SPR@クリテのTOP3 79%→85%、RUL@丘陵1.34→1.16）／hold=ほぼ中立〜やや不利の守り（1.34→1.61）／ace_early=**検証したどの局面でも着順を大きく落とす高リスク**で、被圧倒時ですら救いにならない（normal 6.6→早発射14.2、CLM@ヒルクライムでもTOP3 99%→36%）＝マイライフの逃げ（breakawayロールで一発の上振れあり）と違い上振れの逃げ切りが乗らない一方通行の博打。sim本体は妥当につき変更せず、`CHASE_MODES`のdescを実態（push=強エース向き/hold=守り/ace_early=大博打で多くは着順を落とす）へ正直化。※ace_earlyに明確な勝ち筋が無い点は要相談（sim側の逃げ支援＝別途） |
| `バランス:作戦説明の正直化` | **作戦の効き検証**（Node頭付き比較・脚質×コース×競争度）で「死に作戦」は無かったが、`ML_TACTICS`の説明が実測とズレて誤誘導していた問題を修正。実測＝末脚温存:平坦スプリントで堅実／早めに逃げる:多くは吸収され平均着順は落ちる博打だが集団ゴールで勝てない脚質の唯一の一発（起伏・山岳で逃げ切りやすい。競争的な場でbreaker@クリテのTOP3が0%→7%）／積極:非スプリント型が終盤に仕掛けて先着（スプリント型は末脚を消し不利）。各tacticに`tag`(一目でわかる向き・リスク)＋`tagColor`を追加し、descを実際の効き方へ書き換え。マイライフ作戦ピッカーに色付きtagチップを表示（`mylife.jsx`）。※重要な交絡＝プレイヤーが地力で圧倒/被圧倒だと作戦差は消える（作戦が効くのは競争的な時）。sim本体は挙動が妥当なため変更せず（直前の地形別決着を壊さない） |
| `バランス:地形別フィニッシュ決着` | **脚質（登坂型）が着順に反映されない問題**を修正。原因＝`resolveFinishClusters`が僅差ゴール集団を**地形を問わず常にスプリント力**で並べ替えていたため、山頂フィニッシュでも強スプリンターが強クライマーを差していた。フィニッシュ区間の地形に応じた決め手（`finishAbility(en,segType)`＝climb/mtn:登坂主体0.75+sprint0.25／hill:パンチ／tt:独走／flat・sprint:従来どおりスプリント）で決着させる。`rankSim`が`sim.course`の最終区間タイプを`resolveFinishClusters`へ渡す（course未設定は"sprint"にフォールバック＝後方互換）。**検証**：Nodeで強ビルド同士(OVR86)の頭付き対決を地形別に集計＝ヒルクライム(mtn決着)でクライマー勝率34%→83%・平均着順1.11、平坦/丘はスプリンター有利のまま（地形適正化を確認）。Playwright両モード0エラー |

---

## 5. 次の候補
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
  - **残**：新競技フォーマット（チームTT＝合算タイム／トラック等）。※シーズンモードにはモニュメントが無いため
    これら古典適性は現状マイライフ専用（season の raceMeta.monument は undefined＝無影響）。
- **バランス調整パス**（2026-07に集中実施・すべて§4に記録）：シーズン順位実効化／地形別フィニッシュ決着
  （脚質を着順へ・クライマー勝率34%→83%）／マイライフ作戦の説明正直化／シーズン作戦(CHASE_MODES)点検／
  エース早期発射を「勝負の逃げ」に実効化（committedBreak・地形依存）／難易度つまみの高クラス実効化（鬼のAI上限94→104）。
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
- **B-2 逆メンター**（未着手）：ベテラン化したら若手を指導（プロテジェの師匠側を遊ぶ）／チームメイトの絆・確執イベント
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
