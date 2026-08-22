# 第14弾：simの精度の負債返済（36番＋37番）＋RaceView.jsxの分割

第13弾（デザインの作り直し）完結後、DEVLOG「実装順序」の筆頭である36番＋37番に着手する。
両方とも「今の挙動が設計意図と違う」明確な負債で、検証コスト（着順分布の実測）を共有できる。
7番（特殊配合）のバランス設計をこの土台の上に乗せるため、先に土台を正す。

## 着手時の実測

### 36番：最終区間の決着ジッターが乱数として機能していない

`sim/race.js`の4箇所（666・674・698・703行）で
`(riderHash01(en.id, tick + 4409) - 0.5) * K`（K = 0.02 / 0.02 / 0.035 / 0.05）を使っている。

`riderHash01(id, salt) = ((id * 2654435761 + salt * 40503) % 100000) / 100000` に
`salt = tick + 4409` を入れると：

- **同一選手の連続tickは +0.40503 の等間隔**（実測：0.89588 → 0.30091 → 0.70594 → 0.11097 …）
- **全選手が同じ歩幅で動く**ため、選手間のluck差が永久に固定される
  （実測：A-B=0.64239、A-C=0.80856 が全tickで不変）。独立なノイズではなく
  「固定オフセット＋全員共通の回転」になっている
- 累積は本物の乱数なら√Kで広がるはずが、K=1〜50で0.033〜0.097の範囲に頭打ち
  ＝**意図より分散が小さい**（低食い違い列の性質）
- `tick = fromTick`（新規レースは0）なので**tickはレースごとにリセット**される

**ただし実害は限定的**。調査中に`tickSpeedFactor`（274行）へ
`f *= 1 + (Math.random() - 0.5) * 0.06` ＝**毎tick・毎選手に本物の乱数±3%**が
既に入っていることが判明した。luckはその上に乗る補助項にすぎない。

実測（同能力5名・エースを5名で持ち回り・500レース・チーム内トップの分布）：

| id | 900 | 901 | 902 | 903 | 904 |
|---|---|---|---|---|---|
| 回数 | 124 | 104 | 83 | 85 | 104 |
| 比率 | 24.8% | 20.8% | 16.6% | 17.0% | 20.8% |

公平なら各20%。カイ二乗 p≈0.02 で**偏りは検出できるが着順を支配してはいない**。

> **測定上の注意（同じ失敗を繰り返さないため）**：最初に`simulateTicks`へ手組みの
> rider配列を渡して「配列先頭が100%勝つ」という結果を得たが、これは選手が完走せず
> `MAX_TICKS`(2500)到達時のフォールバック（762行）で全員が同一タイムになり、
> ソートの安定性で並んだだけだった。手組みriderは`segmentAbility`が要求する形を
> 満たせず1ミリも動かない。**計測は必ず`buildSim`／`buildMyLifeSim`経由で行うこと。**

### 37番：マイライフの個人TTが集団走行としてシミュレートされている

- `state/state.js:987`：`groupMode: "full"` をハードコード
- `state/state.js:1002`：`simulateTicks(course, riders, 0, sim.directive, false)`
  ＝ `noGroup` に **`false` をハードコード**
- 対してシーズン側（`sim/buildSim.js:137`）は
  `simulateTicks(course, riders, 0, sim.directive, groupMode === "solo")` と正しく渡している
- `data/course.js:64` の個人TTテンプレートには既に **`soloTT: true`** フラグがある
  （v46の#34で観戦廃止用に追加済み）ので、修正は分岐を1つ足すだけで書ける

**前後比較の実測**（マイライフ個人TT・PRO・年8・世界シード424242・能力別 各150レース）：

| 能力 | 現行 平均着順 | 現行 優勝率 | 修正後 平均着順 | 修正後 優勝率 |
|---|---|---|---|---|
| 70 | 8.97 | 0.0% | 9.00 | 0.0% |
| 80 | 8.49 | 0.0% | 6.07 | 0.0% |
| 88 | 5.15 | 7.3% | 2.99 | 0.0% |
| 93 | 7.22 | 0.7% | 1.00 | **100.0%** |
| 100 | 4.41 | 13.3% | 1.00 | **100.0%** |

2つのことが同時に分かる：

1. **現行は非単調**。能力88（5.15位・7.3%）より強い93が7.22位・0.7%と悪化しており、
   能力と結果が対応していない＝集団走行が能力と無関係なノイズを持ち込んでいる
2. **修正すると単調になるが崖ができる**。能力差5（88→93）で「一度も勝てない」から
   「必ず勝つ」へ飛ぶ。単独走では集団のゆらぎが消え、TTは距離が長いため
   毎tickの±3%も平均化されて実質決定論になるため

**＝37番は1行直すだけでは成立しない。** ユーザー合意により、TT専用のゆらぎを併せて設計する。

なお、シーズン側の個人TTは`groupModeFor(1)="solo"`で**既に単独走**なので、
同じ崖を既に抱えている。よってTTのゆらぎは両モード共通の`sim`層へ入れるのが正しい。

## 確定仕様（ユーザー合意済み）

### A. 36番：luck項を本物の乱数へ

4箇所すべてで `riderHash01(en.id, tick + 4409)` → `Math.random()` に差し替える。
係数（0.02 / 0.02 / 0.035 / 0.05）は変更しない。

- 同じ関数内の274行が既に`Math.random()`を使っており、乱数源として一貫する
- `resumeSim`での再計算が再現しない点は274行で既にそうなっており、新たな問題は生じない
  （判断カードで結果が変わるのは仕様）
- 本物の乱数は√Kで累積するため、鋸波より**分散はむしろ増える**方向。
  実装後に着順分布の前後比較（下記「検証」）で確認する

### B. 37番：個人TTを単独走にする

- `state/state.js:987`：`groupMode: raceMeta.tmpl?.soloTT ? "solo" : "full"`
- `state/state.js:1002`：第5引数を `!!(raceMeta.tmpl && raceMeta.tmpl.soloTT)` へ

### C. TT専用の「ペース配分」ゆらぎ（新規・Bの崖を埋める）

**レース単位で1回だけ**引く。毎tickではなく1回にするのは、TTは距離が長く
毎tickのゆらぎが平均化されて効かないため（Bの実測が示したとおり）。

```
// simulateTicks の初期化時（fromTick===0 の枝）に1回だけ
en.ttPacing = 1 + (Math.random() - 0.5) * 2 * TT_PACING_SPREAD * steadyMul(en)
steadyMul(en) = Math.max(0.6, Math.min(1.3, 1 - ((en.stability ?? 50) - 50) / 200))
```

- `TT_PACING_SPREAD = 0.02`（±2%）を初期値とし、下記の目標曲線に合わせて実装時に較正する
- 適用先：`tickSpeedFactor` 内で `segType === "tt"` のときだけ `f *= en.ttPacing`
- **安定感(stability)を新規にsimへ接続する**。現在`stability`と`luck`は月次処理
  （調子の振れ幅・イベント抽選・成長上限）専用で**simには一切届いていない**ため、
  `effAbilities`の戻り値、または`buildSim`/`buildMyLifeSim`のentrant組み立てで
  `stability` を entrant へ渡す配線が要る
- **`luck`（運）は使わない**。イベント抽選という現在の意味を薄めないため。
  「安定感＝出来の振れ幅の小ささ」が意味的に正しい担当
- **`cond`（調子）は変更不要**。既に`effAbilities`の`condMul`で効いている
- stability未設定（AI・シーズン選手・旧セーブ）は`?? 50`で`steadyMul=1.0`＝既定の振れ幅

**較正の目標曲線**（マイライフ個人TT・PRO・年8・同条件での優勝率）：

| 能力 | 目標 優勝率 |
|---|---|
| 80 | 0〜5% |
| 88 | 10〜25% |
| 93 | 40〜60% |
| 100 | 75〜90% |

実力の勾配は残しつつ、能力差5で0%↔100%が入れ替わる崖を無くすのが狙い。
1回の較正で入らなければ`TT_PACING_SPREAD`を動かして再測定する。

### D. RaceView.jsx（1,554行）の分割

第13弾で全面的に触った直後で判断しやすいうちに、CLAUDE.md §5に沿って分ける。
現状は「判断カードのデータ組み立て」「simデータ読み取りヘルパー」「カメラ・隊列の定数群」
「FinalSprintCinematic」「RaceView本体」が1ファイルに同居している。

| 新ファイル | 移す中身 | 現在の行 | 概算 |
|---|---|---|---|
| `domain/shared/raceDecisions.js` | `buildDecisions` / `composeCard` | 16〜137 | 約122行 |
| `domain/shared/raceViewModel.js` | `interpFrac` / `modeAt` / `groupAt` / `tagAt` / `slotAt` / `nextPullerAt` / `modeStreakAt` / `topLateral` | 139〜211 | 約73行 |
| `components/race/raceViewConstants.js` | MAP_W・TOP_H・カメラ定数・隊列パラメータ群 | 213〜360 | 約148行 |
| `components/race/FinalSprintCinematic.jsx` | `RiderNameTag` / `FinalSprintCinematic` | 365〜660 | 約296行 |
| `components/RaceView.jsx`（残り） | `RaceView`本体・`RaceErrorBoundary` | 664〜 | 約900行 |

- 依存は下向き一方通行を保つ：`data → domain → components`
- `domain/`配下はJSXをimportしない（Node単体テストが可能な状態を維持）
- RaceView本体の約900行はこれ以上分けない。1つのReactコンポーネントと
  そのtickループが本体であり、割ると却って見通しが悪くなる
- 移動する関数は`RaceView.jsx`から`export`されている。呼び出し側の書き換えが
  広範囲に及ぶ場合は、CLAUDE.md §5の**互換シム**（移動元に`import`＋`export {}`）を置き、
  呼び出し側は無変更で動かす。移動は`git mv`ではなく新規作成＋削除になるため、
  コミットメッセージに移動元を明記する

## 実装対象（順序）

1. `sim/race.js`：36番のluck 4箇所を`Math.random()`へ
2. `state/state.js`：37番のgroupMode・noGroupを`soloTT`で分岐
3. `sim/race.js` ＋ entrant組み立て：TTペース配分（C）＋`stability`のsim配線
4. Cの較正（目標曲線に入るまで`TT_PACING_SPREAD`を調整して再測定）
5. RaceView.jsxの分割（D）

## 検証

- **36番**：同能力5名・エース持ち回り・500レースのチーム内トップ分布を前後比較。
  カイ二乗で偏りが有意でなくなる（p>0.05）ことを確認
- **37番＋C**：マイライフ個人TTの能力別（70/80/88/93/100）優勝率・平均着順を
  各150レースで測り、目標曲線に入ることを確認。あわせて**単調性**
  （能力が上がるほど平均着順が良い）を確認
- **回帰**：丘陵ロード等の通常レースで着順分布が大きく動いていないこと
  （36番の変更は全レースに効くため）
- **D**：ビルド成功＋Playwrightで編成〜観戦〜結果の実プレイ（第13弾3-Eと同じ経路）
- 計測は必ず`buildSim`／`buildMyLifeSim`経由で行う（上記「測定上の注意」参照）

## 実装結果（2026-08・完了）

### A・B：36番・37番

`sim/race.js`の4箇所を`Math.random()`へ、`state/state.js`の`groupMode`／`noGroup`を
`soloTT`で分岐。設計どおり、いずれも1〜2行の変更。

### C：TTペース配分ゆらぎ＋stability配線

- `effAbilities()`の戻り値に`e.stability = r.stability ?? 50;`を追加（`sim/race.js`）。
  season/mylife問わず`...e`スプレッドで既存のentrant組み立てにそのまま乗る＝追加の配線不要だった。
- `simulateTicks`の`fromTick===0`枝で`en.ttPacing`をレース単位1回だけ抽選、
  `tickSpeedFactor`の`segType==="tt"`分岐で`f *= en.ttPacing`。

**較正実測**（マイライフ個人TT・PRO・年8・`buildMyLifeSim`＋合成worldRosters［較正用に
能力96/94/90/86/82/78/74/70の8チームを`baseline`で構成、`mlAiCapFor("normal")=96`でクランプ］・
能力別各150レース）：

| TT_PACING_SPREAD | 80 | 88 | 93 | 100 |
|---|---|---|---|---|
| 目標 | 0〜5% | 10〜25% | 40〜60% | 75〜90% |
| 0.02 | 32.7% | 96.0% | 100.0% | 100.0% |
| 0.04 | — | — | 59.3% | 96.7% |
| **0.06（採用）** | **0.7〜1.3%** | **20.0〜24.7%** | **48.7〜56.0%** | **80.7〜86.7%** |

0.06で2回の独立測定とも全区分が目標帯に入り、平均着順（70:約7.1→100:約1.2）も単調性を維持。
`TT_PACING_SPREAD`を`0.06`で確定（`sim/race.js`のコメントに実測を記録済み）。

### D：RaceView.jsx分割

計画どおり5ファイルへ分割（1,554行→943行、概算どおりの配分）：

| ファイル | 内容 | 行数 |
|---|---|---|
| `domain/shared/raceDecisions.js` | `buildDecisions`/`composeCard` | 130 |
| `domain/shared/raceViewModel.js` | `interpFrac`等7ヘルパー | 77 |
| `components/race/raceViewConstants.js` | 定数群＋`mapX`/`buildTopPath`/`buildSidePath`等 | 123 |
| `components/race/FinalSprintCinematic.jsx` | `RiderNameTag`/`FinalSprintCinematic`等 | 290 |
| `components/RaceView.jsx`（残り） | `RaceView`本体・`RaceErrorBoundary` | 943 |

実装時に判明した設計からの差分：
- `mapTagKind`/`riderTagIcon`はRaceView本体（俯瞰マップの名前タグ）とFinalSprintCinematic.jsxの
  両方で使うため、後者からexportしてRaceView.jsx側がimportする形にした（表には現れない）。
- 呼び出し側がRaceView.jsx自身の外にいない（`screens/season/race.jsx`・`screens/mylife/race.jsx`が
  importするのは`RaceView`/`RaceErrorBoundary`の2つだけとgrepで確認済み）ため、
  CLAUDE.md §5の互換シムは不要だった。
- ついでに検出した既存バグ・死んだコードを分割と同時に処理（移動対象の行そのものだったため）：
  `RaceErrorBoundary`が未importの`Btn`を参照しておりレンダー時に例外になる状態だった
  （Wave13 3-Eの`Btn`撤去漏れ）→`PrimaryBtn`に修正。未使用の`riderWander`import・
  `CAP_COLORS`の空の再export（インポートしてそのままreexportするだけで誰も参照していなかった）・
  未使用定数`cycMod`/`SPRINT_SLOWDOWN`を削除。

## 検証結果

- **36番**：同能力5名（`accel`/`mental`/`build`/`stability`等の副ステータスも完全一致させて
  再測定）・エース持ち回り・500レースのチーム内トップ分布。カイ二乗 **2.660**（df=4、
  p=0.05の臨界値9.488を大きく下回り有意差なし）。初回測定でサブステータスを揃え忘れて
  カイ二乗12.640が出たが、これはid由来の副ステータス差という別の交絡要因によるもので
  36番の測定ではないと判明・再測定して解消（測定ミスの記録として残す）。
- **37番＋C**：上記較正表のとおり、目標帯・単調性とも達成。
- **回帰**：丘陵ロード相当のレース（能力95/85/75/65/55の混成チーム・200レース、git stashで
  前後比較）で平均着順分布に有意な変化なし（例：能力95の優勝率12.0%→13.0%、能力55の平均着順
  27.59→27.68）。
- **D**：`npm run build`成功。Playwrightでマイライフ新規デビュー→出走→観戦（判断カード発火・
  選択→最終スプリント演出→結果画面）を通し実行し、コンソールエラー0件・スクリーンショットで
  俯瞰マップ／判断カード／最終スプリント演出／結果画面の表示崩れなしを確認。
