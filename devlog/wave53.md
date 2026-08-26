# 第53弾（設計確定）: 集団に「テンポ」を導入し、逃げを成立させる

## 発端

第52弾 Phase 2の実測で、**逃げ（`attack`/`send`）が構造的に成立していない**ことが確定した
（全表は`devlog/wave52.md`）。

- どの発火点でも`attack`/`send`は`hold`より4〜6着悪く、1位率でも表彰台率でも劣る＝**上振れが無い**
- 消費を0にしても平均着順は**24.24で完全に同一**＝脚の代償は着順に効いていない
- 持続を10→30→60と振ると15.69→24.24→26.71と**単調に悪化**（独走割合21%→68%→96%と対応）
- 最良の`持続10`ですら`hold`（12.15）に3.5着負ける＝**定数をどう振っても直らない**

⚠️**構造的な理由**：集団にいる間は`dist = groupDist = puller.lastOwnDist`で、集団は
**「牽引できる中で最も強い選手が全力で牽いた速度」**で常に進む。一方`effortCost`は
ドラフト0.5〜0.85に対しsolo=1.3・attack=1.6。`attack`中は`tickSpeedFactor`で1.15倍の加速が
付くが、**1.6倍の消耗を埋め合わせられない**。つまり**集団の中にいることが速さでも消耗でも
常に有利**で、単独で出る動機が存在しない。

ユーザー判断（2026-08）：**案A＝集団にテンポを導入する。** 実の自転車レースでは、集団は
脅威が無い間はペースを落として巡航し（テンポ）、逃げが脅威になると追い始める。この仕組みを
入れると、①逃げが差を作れるようになり②既存の「逃げとメインのギャップ：約N秒」UIが
初めて意味を持ち③終盤の追走という展開が生まれる。

## 確定仕様

### 1. 集団のペース倍率 `groupPaceMul` を導入する

集団の進む距離を、牽引者の全力から**倍率で落とす**。倍率は「前に誰かいるか」「どれだけ
離れているか」「レースがどこまで進んだか」で決まる。

**計算式**（`src/sim/ticks.js`）：

```js
// 前を行く選手との差（この集団の先頭から見て）。前に誰もいなければ0。
const leadPos = Math.max(...active.map(e => e.pos));
const gapAhead = Math.max(0, leadPos - members[0].pos);
const prog = members[0].pos / course.length;

let paceMul = 1;
if (prog < TEMPO_END_PROG && segInfo.idx !== course.finalIdx) {
  const urgency = Math.min(1, gapAhead / CHASE_FULL_GAP);
  paceMul = TEMPO_BASE + (1 - TEMPO_BASE) * urgency;
}
```

- **前に誰もいない集団**（＝プロトン。`gapAhead = 0`）は`TEMPO_BASE`で巡航する。
- **誰かが出て差が開くほど**`urgency`が上がり、`CHASE_FULL_GAP`に達すると全力（1.0）へ戻る。
- ⚠️**終盤（`prog >= TEMPO_END_PROG`）と最終区間は常に1.0**＝誰も緩めない。
- ⚠️**単独走者（`members.length === 1`）はこの処理の対象外**。既存の早期returnの分岐に入り、
  自分の`tickDistance`で進む。これが「逃げが集団より速くなれる」ことの核心。

### 2. ペースを落とした分だけ消耗も軽くする

⚠️**これを入れないと逆効果になる。** 集団だけ遅くして消耗が同じだと、`keepThresh`の判定
（`ownCapable >= groupDist * keepThresh`）が緩くなって**千切れる選手が減り、集団ゴールが
増える**——第38弾が苦労して減らした「団子ゴール」が復活してしまう。

```js
const paceDrainMul = Math.pow(paceMul, TEMPO_DRAIN_EXP);
```

これを牽引者（`mode === "pull"`）とドラフト勢の両方の`energyDrain`に掛ける。
テンポで脚を温存できるため、終盤の全力区間が相対的に速くなる＝メリハリが付く。

### 3. 実装の位置と順序（⚠️既存の計算順に注意）

現行の流れは **①グループ判定 → ②モード決定 → ③pull/solo/attackの移動 → ④draftの移動**。
`puller.lastOwnDist`は③で確定するため、**②の時点で`paceMul`を各メンバーに配っておく**必要がある。

1. **②のグループループ（`ticks.js:305`の`Object.values(groups).forEach`）の末尾**で
   `paceMul`と`paceDrainMul`を計算し、`en.groupPaceMul` / `en.groupDrainMul`として
   **全メンバーに書く**（単独走者の分岐では両方1にする）。
2. **③の`active.forEach`（`ticks.js:354`）**で、`mode === "pull"`のとき
   `dist *= en.groupPaceMul`、`energyDrain(...)`に`* en.groupDrainMul`を掛ける。
   ⚠️`en.lastOwnDist = dist`は倍率を掛けた**後**の値にすること（④がこれを使うため）。
3. **④のドラフト勢**（`ticks.js:426`の`const groupDist = puller.lastOwnDist`）は
   **変更不要**（①で既に倍率が乗った値になっている）。ドラフト勢の`drain`にだけ
   `* en.groupDrainMul`を追加する。

### 4. 事前作戦（`directive.chaseMode`）とAIスタイルをテンポに接続する

現行の`chaseMode`（push/normal/hold）は**ローテーション周期`rotSpan`しか変えておらず**、
プレイヤーの事前作戦がレース展開にほとんど出ていない。テンポの基準値を動かすことで
初めて「積極的に追う／様子を見る」が展開として見えるようになる。

| 設定 | `TEMPO_BASE`への加算 |
|---|---|
| `chaseMode === "push"` / AIスタイル`aggressive` | **+0.03** |
| `normal` / `balanced` | ±0 |
| `chaseMode === "hold"` / AIスタイル`conservative` | **-0.03** |

自チームが関与する集団はプレイヤーの作戦、それ以外は多数派チームのAIスタイルに従う
（現行の`rotSpan`の判定と同じ分岐をそのまま使う）。

### 5. 定数の初期値（⚠️すべて仮置き。実装後にOpusが実測して確定する）

| 定数 | 仮置き | 根拠 |
|---|---|---|
| `TEMPO_BASE` | **0.94** | 6%落とすと、`attack`の1.15倍加速が集団を明確に上回る |
| `CHASE_FULL_GAP` | **1.2** | コース長300前後に対し、数十秒相当の差で全力追走に入る想定 |
| `TEMPO_END_PROG` | **0.80** | 残り20%は誰も緩めない（既存の`finaleTight`が効き始める帯と揃える） |
| `TEMPO_DRAIN_EXP` | **1.0** | まず線形（paceMul 0.94→drain 0.94）で測る。物理的には2〜3乗が近いが、まず素直な値で応答を見る |

## やらないこと（この弾のスコープ外）

- **`attack`/`send`の定数（`ATTACK_MIN_TICKS`/`SEND_*`）は変更しない。** テンポを入れた
  状態で測り直してから、必要なら次の弾で調整する。第52弾の実測どおり、これらを触っても
  構造が変わらない限り効かない。
- **`mid`カードの内容は変更しない**（ユーザー判断：逃げの修正後に測り直す）。midの主な
  能動的選択肢は`attack`なので、逃げが成立すればmidも自動的に成立する可能性が高い。
- **`course.selective`（モニュメント）でテンポを変えることはしない。** 調整の面を増やさず、
  まず素の応答を測る。
- `kick`系・`tempo`（ふるいにかける）は第52弾の実測で健全と分かっているため触らない。

## 検証項目

**効果の確認**

1. **`attack`が`hold`に勝てる場面が生まれること。** 第52弾Phase 2と同じ格子
   （`scratchpad/w52_grid.mjs`）を再測定し、`terrain`/`mid`での`attack`の平均着順が
   改善すること。⚠️`hold`を必ず上回る必要はない（そうなると今度は「常に仕掛けるのが正解」に
   なる）。**目標は「差が縮まり、地形や残脚によっては上回る場面が出る」こと。**
2. **逃げが実際に差を作ること。** `attack`発動後のギャップ推移を記録し、テンポ導入前は
   ほぼ開かなかった差が実際に広がってから縮まる（追走される）ことを確認する。

**⚠️ 壊していないことの確認（回帰リスクが高い順）**

3. ⚠️**ゴール時の集団サイズが増えすぎていないこと。** テンポで`keepThresh`が緩くなるため、
   千切れる選手が減って「団子ゴール」が復活する危険がある（第38弾が減らしたもの）。
   同着クラスタのサイズ分布を導入前後で比較する。
4. ⚠️**レースの所要時間（`finishTime`）が極端に伸びていないこと。** 集団が6%遅くなる分、
   全体のタイムが伸びる。コースレコードや既存の記録表示と整合が取れる範囲か確認する。
5. **第52弾Phase 2の格子で、`kick`系・`tempo`・`hold`の順序関係が壊れていないこと**
   （kickBig > sprintWait > kick > hold、tempo > hold）。
6. **個人TT・チームTTが無影響であること**（`noGroup`＝全員が単独グループなので
   テンポの分岐に入らないはず。実際に`finishTime`が同一シードで完全一致することを確認）。
7. **事前作戦（push/hold）で展開が実際に変わること**（同一シードで逃げの生存時間が変わる）。
8. 第45〜52弾の既存検証スクリプトが全て通ること・`npx vite build`成功・
   Playwright実機で`pageerror`ゼロ。

## Phase構成

- **Phase 1（この弾・実装対象）**：上記1〜4の実装＋検証。定数は仮置きのまま。
- **Phase 2（Opus）**：`TEMPO_BASE`・`CHASE_FULL_GAP`・`TEMPO_DRAIN_EXP`を振って実測し確定する。
  ⚠️測定は3点固定（`Math.random`/`Date.now`/`ridState.value`）＋`resumeSim`直前の副シード
  張り直し（`devlog/wave51.md`・`wave52.md`）。その後、`mid`カードと`attack`/`send`の
  定数を再評価する。

## Phase 1 実装結果（2026-08・Sonnet）

**`src/sim/ticks.js`**
- `TEMPO_BASE`(0.94)・`CHASE_FULL_GAP`(1.2)・`TEMPO_END_PROG`(0.80)・`TEMPO_DRAIN_EXP`(1.0)を
  新設（すべて仮置き・`export const`）。事前作戦・AIスタイルの加減（±0.03）は
  `TEMPO_ADJUST_PUSH`/`TEMPO_ADJUST_HOLD`として定数化。
- モード決定の`Object.values(groups).forEach`ループの末尾で`paceMul`/`paceDrainMul`を計算し、
  `en.groupPaceMul`/`en.groupDrainMul`として全メンバーに書く。単独走者（`members.length===1`）
  の分岐では両方1に固定。`leadPos`（レース全体の現在の先頭位置）はこのループの直前で1回だけ計算。
  `chaseMode`/AIスタイルの判定を`rotSpan`と同じ分岐に相乗りさせ、`tempoAdjust`を同時に決める。
- 移動パス（`active.forEach`、`mode !== "draft"`）で、`mode === "pull"`のときのみ
  `dist *= en.groupPaceMul`（エースとのペース合わせより後）と`energyDrain(...) * en.groupDrainMul`
  を適用。`en.lastOwnDist`は倍率を掛けた後の値を保持するため、ドラフト勢の`groupDist`計算
  （`puller.lastOwnDist`を参照する既存コード）は無変更で倍率が伝播する。
- ドラフト勢の`drain`計算に`sheltered ? (en.groupDrainMul ?? 1) : 1`を追加
  （`sheltered = en.mode === "draft"`を流用。keepThresh判定でsoloに落ちた選手は対象外）。

**検証**（Node・Playwright実機。`w53_verify.mjs`をscratchpadに作成）
1. 個人TT（`noGroup=true`）は`chaseMode`を変えても`finishTime`が完全一致——テンポの対象外。
2. 事前作戦`push`/`hold`で1tickあたりの集団の進み方が実際に変わることを確認（脅威の有無
   両方のケースで）。
3. 実レース経由（n=32）でfinishTimeの最大値・先頭クラスタの平均人数が破綻していないこと
   （3.2名で第38弾以前の団子ゴール水準には戻っていない）。
4. 第45〜52弾の既存検証スクリプト全て回帰なし。`npx vite build`成功。Playwright実機で
   「登りで抜け出す」を選択して観戦を続行、`pageerror`ゼロ。

## ⚠️ 実測で判明した副作用：`hold`の平均着順が全発火点で大きく悪化した

Phase 2の格子測定（`scratchpad/w52_grid.mjs`）を再実行したところ、想定していなかった
大きな副作用が見つかった。**`git stash`で導入前のコードに戻して同一測定を取り直し、
数値の変化が実装によるものであることを確認済み**（測定スクリプトの誤りではない）。

| 発火点 | 導入前`hold`平均着順 | 導入後`hold`平均着順 | 悪化幅 |
|---|---|---|---|
| mid | 10.57 | 18.56 | **+7.99** |
| finale | 11.31 | 18.79 | **+7.48** |
| terrain | 12.15 | 21.24 | **+9.09** |
| sprint | 11.01 | 13.48 | **+2.47** |

一方で`attack`と`hold`の**差**は縮まった（terrain: hold比+12.10→+6.29、mid: +4.23→+1.83、
finale: +3.84→+2.88）。つまり**設計どおり逃げの相対的な価値は改善した**が、それ以上に
**全体の基準点（`hold`）そのものが沈んだ**。

⚠️**推定原因**：`TEMPO_BASE=0.94`で「前に脅威が無い集団」を6%減速させたことで、
`ticks.js`が元々持っているAI由来の逃げ（`role: "breakaway"`での開始時アタック、および
中盤の「大集団で非スプリンターが痺れを切らして飛び出す」自然発生ロジック）が、
**閾値`CHASE_FULL_GAP=1.2`に達するまで本気で追われなくなり**、以前より生き残りやすく
なった可能性が高い。プレイヤー（`hold`）を含むメイン集団全体が、AIの逃げに対して
相対的に不利になった＝**個々の一手の優劣ではなく、フィールド全体の基準点が動いた**。

これは設計時に想定した回帰リスク（団子ゴールの復活・レース時間の伸び）とは別種の、
より大きな副作用である。**Phase 2で`TEMPO_BASE`を測り直す際、`attack`対`hold`の差だけでなく
`hold`の絶対的な着順水準（導入前の10〜12着台）も一緒に見ること。** `TEMPO_BASE`を0.94より
1に近づける、`CHASE_FULL_GAP`を小さくする（＝より小さい差でも追い始める）のいずれかで
戻る可能性が高いが、実測せずに確定しない。

**やらなかったこと**：`TEMPO_BASE`等の値の変更はしていない（設計どおりPhase 1のスコープ外）。
上記の副作用はPhase 2の実測対象として引き継ぐ。
