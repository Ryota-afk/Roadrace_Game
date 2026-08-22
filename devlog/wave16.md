# 第16弾：生きた世界の深掘り＋`sim/race.js`分割

**状態：完了（2026-08）**。§5の未着手候補「生きた世界の深掘り」（ライバルの成長/全盛期/引退・
世界ランキング変動のニュース化・世代交代の物語化）に着手し完結。あわせてCLAUDE.md §5に沿って
`sim/race.js`（1,089行・当時最大）を分割した（第15弾の`state.js`と同じ互換シム方式）。
実装結果・検証ログは末尾の「実装結果」節を参照。

## 着手時の実測

### 土台は既に生きている（worldRosters）

`state/worldRoster.js`の`ageWorldRosters`が年次で全てを動かしている：
- 全25チーム×12名＝300名が毎年+1歳。ピーク前は成長（growthPow別のstep）、ピーク後は加速的に衰え。
- 引退：38歳で強制、33歳以上は確率（0.18+(age-33)*0.06）。引退者は新人（20〜22歳）で1:1補充。
- 殿堂の血：`legendPool`を渡すと新人の15%が`bloodOf`（殿堂の系統名）を継ぐ。
- 戻り値`{worldRosters, retired, debuted}`——**retired/debutedという「実際に起きた出来事」が
  毎年生成されているのに、その出口（ニュース）が細いのが現状の問題**。

### 出口の実測（3つの問題）

| # | 問題 | 実測 |
|---|---|---|
| 1 | 世界ニュースが年3行だけ | `mlBuildWorldNews`（`view/news.js:30`）は首位1行＋引退1行＋新人1行が上限。月中の世界の動きはゼロ。表示は`career.jsx`の世界ランキング詳細画面「今年の世界の動き」セクションのみ |
| 2 | ライバルが不老不死 | `mlCreateRival`（`domain/season/rival.js:243`）は年齢20〜27歳で生成するが、**その後加齢する処理がどこにも無い**。強さも`buildMyLifeSim:139`で常に`power + 6`固定。世界の300名が世代交代する中、ライバルだけ永遠に同じ強さ |
| 3 | シーズンの「他チームの噂」が張りぼて | `rivalNews`（`view/news.js:17`）は`RIVAL_NEWS_TEMPLATES`8種のランダム文。実データと無関係（「エースの不振に苦しみ」と出た月にそのエースが勝っていても矛盾に気づけない）。表示は`hub/race/status.jsx:57` |

### 月次のフック位置（既にあるもの）

`controllers/mylife/month.js:378-385`で毎月、自分が出ていない2クラスを`mlWorldRaceLite`で
軽量決着させ台帳に積んでいる。**この決着結果（worldLite[0]＝優勝者）が既に手元にあるのに
捨てられている**——月次ニュースの素材はゼロコストで取れる。

年度末ブロックは`month.js:251-303`。`aged.retired`/`aged.debuted`/`decayedRiderStats`/
`leaderEntry`が全て揃っている場所で、拡充はここに足すだけ。

## 確定仕様（ユーザー合意済み・2026-08）

1. **ライバル＝引退あり＋後継登場**：世界の選手と同じルールで加齢・全盛期・衰え・引退。
   引退時は別れの演出＋若手から新ライバルが台頭する。
2. **ニュース＝年度末拡充＋月次も軽く**：年度末を物語化（王者交代・エース交代・節目の勝利数等）し、
   月次にも1行程度の世界の動き（他クラスの優勝者等・実データ）を出す。
3. **シーズンの噂＝実データ化**：`rivalRosters`の実データ（エースの衰え・若手の成長・引退間近等）から
   生成し、張りぼてテンプレを廃止する。

## 詳細設計

### A. ライバルのライフサイクル（加齢・衰え・引退・後継）

**A-1. 加齢**：年度末ブロック（`month.js`の`ageWorldRosters`呼び出し直後）で
`rival.age`/`rival2.age`を+1する。旧セーブでageが無い場合は26で初期化。

**A-2. 強さの山**：`domain/season/rival.js`に純関数`rivalPowerBonus(rival)`を新設。
現行の固定`+6`を年齢フェーズで置き換える：

```
age <= 23        → +3   （若手：まだ粗い）
24 <= age <= 31  → +6   （全盛期：現行と同じ）
32 <= age <= 34  → +4   （陰り）
age >= 35        → +1   （最晩年：それでも並のAIよりは強い）
```

`buildMyLifeSim`の2箇所（`power + 6`）を`power + rivalPowerBonus(rival)`へ差し替える。
rival2も同式。**全盛期の+6は現行値そのまま**＝既存バランスの中心は動かさない。

**A-3. 引退判定**：年度末、`ageWorldRosters`と同じ式（38歳強制・33歳以上は
`0.18+(age-33)*0.06`の確率）で判定。乱数は年度末ブロックの既存`agerng`を使う。

**A-4. 引退時の処理**（rival/rival2それぞれ独立に）：
- ログへ別れの一文：`【N年目 世代交代】🏁 好敵手・{name}（{age}歳）が現役を退いた。
  通算対戦{meetings}回、{wins}勝{losses}敗の記憶とともに`（数値は`rivalRecord`から）。
- `ml.retiredRivals`（新設・配列）へ`{name, team, type, age, record: rivalRecord, heat, year}`を
  push（キャリア画面での回想表示に将来使える。今回は保存のみ）。
- **後継の指名**：`mlCreateRival(rng, player.name, team候補, [現存ライバル名], [現存ライバルチーム])`で
  新ライバルを生成し、`age`を20〜23に上書き。`rivalRecord`は`{meetings:0, wins:0, losses:0}`へ
  リセット（heatも消える＝因縁は一から）。
- 紹介の一文：`【N年目 世代交代】🌟 {新team}の{新name}（{age}歳）が、次代の好敵手として
  名乗りを上げた`。
- 世界ニュース（下記B）にも同内容を1行入れる。

**A-5. 波及確認**：`rival`オブジェクトの形（`{id,name,type,team,age,personality,abilities}`）は
不変なので、参照側（hub/レース/因縁演出）は無改修。`rivalRecord`リセットにより
`rivalHeatTier`は自然に初期呼称へ戻る。`mlWorldRaceLite:103`のライバル出走・
`mlWorldBoard`のライバル順位表示は、idが変わるだけでそのまま動く。
旧セーブ：`retiredRivals`が無ければ`[]`で初期化（`mylifeState.js`のmerge処理に1行）。

### B. 世界ニュースの拡充

**B-1. 年度末（`mlBuildWorldNews`の拡張）**。現行3種に加え、優先度順に最大7行へ：

| 優先 | 内容 | データ源 | 文例 |
|---|---|---|---|
| 1 | 王者交代 | `ml.worldLeaderId`（新設：前年首位のid・年度末に保存）と今年の`leaderEntry.id`の比較。旧セーブ（未保存）は交代判定をスキップし現行の首位1行のみ | `👑 世界の勢力図が動いた。{新}が{旧}を王座から引きずり下ろした` |
| 2 | 首位（交代なし年） | 現行どおり`leaderEntry` | `👑 {name}が世界ランキング首位（通算{wins}勝）` |
| 3 | ライバル引退・後継 | A-4から | `🏁 好敵手・{name}が現役引退。{新name}が次代の好敵手に` |
| 4 | 大物引退 | 現行どおり`retired`のwins最多1名 | `🏁 {name}が現役を退いた（通算{wins}勝）` |
| 5 | エース交代 | 加齢前`s.worldRosters`と加齢後`aged.worldRosters`で各チーム先頭（baseline最大）のidを比較。交代したチームから1件（自クラスのチーム優先） | `🔄 {team}のエースが交代。{新ace}（{age}歳）が{旧ace}からその座を奪った` |
| 6 | 節目の勝利数 | `riderStats`で`wins >= M && wins - byYear[year].wins < M`（M=50/25/10、大きい順に1件）＝今年その節目を跨いだ選手。新しい状態フィールド不要 | `🏆 {name}が通算{M}勝の金字塔` |
| 7 | 新星デビュー | 現行どおり`debuted`（bloodOf優先） | `🌟 新星 {name}（{age}歳）が台頭。{bloodOf}の血を継ぐ逸材だ` |

表示は現行と同じ`career.jsx`「今年の世界の動き」セクション（行が3→最大7になるだけ・
レイアウト変更なし）。空状態：該当なしの行は単に出ない（現行と同じ挙動）。

**B-2. 月次の1行（world ticker）**：
- `month.js:378-385`の既存ループで、`cls === s.classIdx`（自クラス。raceの月はスキップされて
  いるので前後クラス優先）以外の`worldLite[0]`（優勝者）から1行を生成し、新設フィールド
  `ml.worldTicker`（文字列1本・毎月上書き）に置く：
  `{name}（{team}）が{raceForClass.name}を制した`。
- 生成できない月（worldRosters空の旧セーブ等）は`worldTicker = null`＝表示しない。
- **表示位置**：`hub.jsx`の`mlMediaHeadline`（メディア見出し）ブロックの直下に
  caption（12px・`T.color.sub`）1行。自分の物語（メディア欄）と世界の動き（ticker）が
  同じ場所に並ぶ。※実装時に実画面を見て、ごちゃつくようなら位置を1回だけ調整して
  スクリーンショットで確認する（CLAUDE.md §7）。
  **【実装時訂正】** `mlMediaHeadline`は`hub.jsx`ではimportされているだけで未使用（呼び出しなし）
  だった。実際の（唯一の）呼び出し箇所は`screens/mylife/world.jsx`の「世界」タブ内、
  `{media && (<Section title="ロードレース・タイムズ">...)}`ブロック。設計時のgrep調査が
  不十分だったための誤り。実装は`world.jsx`側のこのSectionの直下に配置した（詳細は
  「実装結果」節）。

### C. シーズンの「他チームの噂」実データ化

`view/news.js`の`rivalNews(year, month)`を`seasonWorldNews(rosters, year, month)`へ置換：

- 入力は`g.rivalRosters`（シーズン側が保持する全25チームのロースター）。
- 月ごとに決定論的（現行と同じ`mulberry(year*137+month*31+911)`）に1チームを選び、
  そのチームの**実データから最も語れる事実**を優先度順に1つ文章化する：
  1. エース（先頭選手）が35歳以上 → `{team}のエース{name}（{age}歳）に引退の噂が流れ始めた`
  2. エースがピーク超過（`age > growthPeakAge(growthPow)`）→ `{team}の{name}に衰えの影。
     若手への切り替えが囁かれる`
  3. 今年加入の新人（`joinYear === year`）がいる → `{team}の新人{name}（{age}歳）が
     練習で好タイムを連発しているという`
  4. growthPow S/Aの若手（24歳以下）がいる → `{team}の{name}（{age}歳）は大器と評判だ`
  5. どれにも該当しない → `{team}は今季も安定した陣容で戦っている`（汎用1種のみ残す）
- `RIVAL_NEWS_TEMPLATES`（8種）は削除。旧セーブで`rivalRosters`が空の場合は
  優先度5の汎用文（チーム名は現行同様`RIVAL_TEAMS`から）へフォールバック。
- 表示位置・頻度は現行のまま（`hub/race/status.jsx`）。`growthPeakAge`は
  `state/worldRoster.js`の非公開関数なのでexportを追加する（データ層への逆依存なし）。

### D. `sim/race.js`の分割（CLAUDE.md §5・互換シム方式）

1,089行を役割で5分割。**第15弾のstate.jsと同じ手順**（抽出→diff照合→export表面の同一性検証→
`race.js`は再exportのみの互換シム化。呼び出し側19ファイルは無改修）：

| 新ファイル | 内容（現`race.js`の行） |
|---|---|
| `data/parts.js` | `PART_SLOTS`・`PARTS`（7-30行）。純データなのでdata層へ |
| `sim/effects.js` | `rollWeather`/`rainMul`/`MONUMENT_ABILITY`/`monumentMul`/`effAbilities`/`typeAffinityBonus`/`segmentAbility`/`finishAbility` |
| `sim/course.js` | `generateCourse`/`climbWeightFor`/`terrainSpeedMul` |
| `sim/ticks.js` | `TICK_SEC`〜`simulateTicks`〜`resumeSim`（tickループ・エネルギー・役割・`RACE_MOVES`・`legsLeft01`・`capExcessiveGaps`・`riderHash01`等） |
| `sim/finish.js` | `resolveFinishClusters`/`teamTTPower`/`teamTTTime`/`computeTeamTT`/`rankSim` |

依存方向は`finish → ticks → effects/course → data`の一方通行に保つ（違反が出たら
定数の置き場を`data/`へ寄せて解消。第15弾の`ML_TACTICS`と同じ手筋）。

### E. 波及範囲の切り分け

- Aはマイライフ専用（`rival`/`rival2`はシーズンに存在しない）。
- B-1/B-2もマイライフ専用フィールド（`worldLeaderId`/`worldTicker`/`retiredRivals`）。
  `mylifeState.js`のserialize対象リストとmergeフォールバックへの追記を忘れない。
- Cはシーズン専用（`rivalNews`の呼び出しは`status.jsx`の1箇所のみ）。
- Dは両モード共通だが挙動不変（機械的な分割のみ）。

## 実装対象（順序）

1. **D**: `sim/race.js`分割（機械的・回帰リスク最小のものを最初に。ビルド+Playwright両モード）
2. **A**: ライバルのライフサイクル（加齢・rivalPowerBonus・引退・後継。Node実測で
   年齢フェーズごとの強さと引退分布を確認）
3. **B-1**: 年度末ニュース拡充（`mlBuildWorldNews` v2。Nodeで7種の発火条件を単体検証）
4. **B-2**: 月次ticker（フィールド追加+hub表示。Playwrightで表示確認）
5. **C**: シーズンの噂の実データ化（Nodeで5優先度の分岐検証+Playwright表示確認）
6. **最終検証**: ビルド+両モードPlaywright実プレイ+旧セーブ互換（rival.age無し/worldRosters空）
7. **完了処理**: DEVLOG §47追記・「次のアクション」整理・commit・push

## 検証

- 各ステップでNode単体テスト（scratchpad）＋ビルド。UI変更はPlaywrightのスクリーンショットで
  目視確認（CLAUDE.md §7の点検を含む）。
- Dは第15弾と同じ「抽出体のdiff照合＋export表面の自動比較」を必須とする。
- 旧セーブ互換：`rival.age`欠落（→26初期化）・`retiredRivals`/`worldLeaderId`/`worldTicker`
  未保存（→null/[]で開始）・`rivalRosters`空（→C汎用文フォールバック）の3系統を明示的にテスト。

## 実装結果

設計どおりD→A→B-1→B-2→C→最終検証の順で実装。すべてNode単体テスト＋ビルド＋Playwrightで
検証済み、コンソールエラー0件。

**D（`sim/race.js`分割）**：`data/parts.js`・`sim/effects.js`・`sim/course.js`・`sim/ticks.js`
（753行）・`sim/finish.js`の5ファイルへ分割、`race.js`は39シンボル全再exportの互換シムへ
（設計表からの変更点：`finishAbility`は`effects.js`ではなく唯一の呼び出し元`resolveFinishClusters`
と同じ`finish.js`に置いた＝クロスファイルimportを1本減らす軽微な最適化）。
抽出は`sed`範囲コピー→`diff`でオリジナルとバイト照合→39/39シンボルの自動比較で export面が
完全一致することを確認。**ビルドは通ったが`sim/ticks.js`に`terrainSpeedMul`のimportが1行
漏れており、Node側でクロスファイル実行するテストでのみ`ReferenceError`として顕在化した**
（静的ビルドだけでは検出できない典型例。CLAUDE.md的にも「ビルド成功だけを信用しない」を
再確認した回）。import追加で解消、以後全テスト成功。

**A（ライバルのライフサイクル）**：`domain/season/rival.js`に`ageRival(rival, record, rng, year,
playerName, playerTeamName, bannedNames, bannedTeams)`を新設。`ageWorldRosters()`と同じ引退式
（38歳強制・33歳以上は`0.18+(age-33)*0.06`）を踏襲し、引退時は`retiredInfo`（記録つき）を返しつつ
`mlCreateRival`で20〜23歳の後継者を生成、`rivalRecord`は`{0,0,0}`にリセット。
`rivalPowerBonus(rival)`は設計どおりの4段階だが、**`domain/season/rival.js`は`state/state.js`を
importしておりsim層より上位に位置するため**、sim層（`buildMyLifeSim.js`）からそこへ逆依存する
わけにいかず、`rivalPowerBonus`はsim層内に私的関数として複製した（層の一方向依存を優先した
設計時未検討の分岐）。Node実測（20,000試行）で年齢別引退率が理論値と±0.5%以内に一致することを
確認。

**B-1（年度末世界ニュース）**：`mlBuildWorldNews`を5引数→1オプションオブジェクトへ変更
（入力が5→9個に増えたため）。設計表どおり優先度7段を実装、唯一の呼び出し元
`controllers/mylife/month.js`を更新。`worldLeaderId`（前年首位id）を新設の永続フィールドとして
`mylifeState.js`へ追加。Node単体テストで7発火条件すべて確認。

**B-2（月次world ticker）**：既存の月次`mlWorldRaceLite`ループ（元々台帳用に毎月実行済み・
追加コストなし）から`worldTicker`（他クラス優勝者1行、非永続の一時フィールド＝`growthReport`と
同じ扱い）を生成。**表示位置は設計時の誤りを実装時に訂正し`world.jsx`の「ロードレース・タイムズ」
Section直下**（詳細は上記【実装時訂正】）。Playwrightで表示・0エラーを確認。

**C（シーズンの噂の実データ化）**：`rivalNews`と`RIVAL_NEWS_TEMPLATES`（8種）を完全削除し
`seasonWorldNews(rosters, year, month)`へ置換（呼び出し元は`status.jsx`1箇所のみのため
互換シムなしで削除＝CLAUDE.md「確実に不要なら消す」方針）。設計どおり5優先度。
`growthPeakAge`を`state/worldRoster.js`でexport化。Node単体テスト7件（5優先度＋空ロースター
フォールバック＋優先度順序）・Playwright表示確認とも成功。

**最終検証**：`npm run build`成功。両モードPlaywright実プレイ（シーズン：新規チーム作成→
「他チーム動向」実データ文言確認／マイライフ：新規デビュー→世界タブ表示確認）でコンソール
エラー0件。旧セーブ互換3系統（`rival.age`欠落→27歳として扱われ引退しない／`retiredRivals`
`worldLeaderId`未保存→`[]`/`null`へ補完・`worldTicker`は非永続なので存在しなくて正常／
`rivalRosters`空→汎用文フォールバック）をNode単体テスト7アサーションで確認。

**旧セーブ互換の実装箇所**：`state/mylifeState.js`の`ML_SAVE_FIELDS`に`retiredRivals`・
`worldLeaderId`を追加、`loadMyLifeGame()`で`retiredRivals`未保存時に`[]`へ補完
（`worldLeaderId`は`{...base, ...parsed.state}`の展開順だけで自然に`null`へ補完されるため
追加コード不要）。`worldTicker`はそもそも非永続（`ML_SAVE_FIELDS`に含めない）ため互換処理も不要。
