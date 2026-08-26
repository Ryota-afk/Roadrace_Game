# 第52弾（設計確定）: 判断カードの一手を設計どおりに効かせる

## 発端

第51弾の`tempo`の実測中に、**判断カードの一手すべてに効く既存バグ**が2つ見つかった
（発見の経緯・実測値は`devlog/wave51.md`末尾）。第51弾より前から存在する。

`resumeSim`は`RACE_MOVES[moveId](focus, riders)`を呼んでから`simulateTicks(...)`を呼ぶ。
ところが`simulateTicks`は`fromTick !== 0`のとき先頭で**`en.pos`/`en.energy`を履歴から復元する**。
この順序が原因で：

| | 症状 | 実測 |
|---|---|---|
| **①** | 一手のenergy消費が復元で上書きされて消える | 一手が引いた後`r.energy`=-114.0 → `simulateTicks`後の`energyHist[21]`は**96.0** |
| **②** | `RACE_MOVES`が読む`r.energy`が「前回の走り切りのゴール時energy」 | 画面は96.2（`legsLeft01`=**1.000**）／sim側は-100.0（**0.000**）。`tempoLeft`は常に下限の**40**（レンジ40〜110） |

⚠️①はv39.21が入れた「全開の一手には脚を使う代償を課す」が判断カード経由で一度も
働いていなかったことを意味する。②は`devlog/wave09.md`が`moveEdge`について明記した
**「simと同じ式（`legsLeft01`）を使うので表示と実挙動が食い違わない」という前提が
成立していない**ことを意味する。

ユーザー判断（2026-08）：**案B＝バグを直したうえで、影響を受ける全ての一手を測り直して
再較正する。**

## ⚠️ 進め方：Phase 1（修正）→ 実測 → Phase 2（再較正）

**Phase 1では再較正の目標値を決めない。** 理由：修正すると`attack`の持続10→30tick・
`send`の追い込み0.030→0.130（4.3倍）・全一手に消費が復活、と前提が丸ごと変わるため、
**直した後の姿を測る前に目標値を決めるのは「壊れた前提の上で測る」ことと同じ**
（第49弾で2回・第50弾で1回繰り返した失敗）。Phase 1は純粋なバグ修正に限定し、
バランスには一切触らない。測り直してからPhase 2を設計する。

---

# Phase 1（実装対象）: `resumeSim`の一手適用順序を直す

## 1. `simulateTicks`に省略可能なコールバック引数を足す

`src/sim/ticks.js`：

```js
export function simulateTicks(course, riders, fromTick, directive, noGroup, onResume) {
  if (fromTick === 0) {
    ...現状のまま（変更なし）...
  } else {
    riders.forEach(en => {
      ...現状の復元処理（pos/energy/各履歴のslice/finished解除/aceEarly）をそのまま...
    });
    // 第52弾: 判断カードの一手はここで適用する（復元の"後"）。
    // 以前はresumeSim側で復元より前に適用していたため、(1)一手が引いたenergyが
    // 上書きされて消え、(2)RACE_MOVESが読むr.energyが前回の走り切りのゴール時の値に
    // なりlegsLeft01が常に下限を返していた（devlog/wave51.md）。
    if (onResume) onResume(riders);
  }
  ...以降のtickループは変更なし...
}
```

⚠️**`onResume`を渡さない呼び出し（＝レース生成時の`fromTick===0`経路、および
既存の他の呼び出し）の挙動は1ビットも変わらないこと。** これがPhase 1の回帰条件。

## 2. `resumeSim`から一手の適用をコールバックへ移す

`src/sim/finish.js`：現状の

```js
const focus = riders.find(en => en.id === focusId);
if (focus && RACE_MOVES[moveId]) {
  RACE_MOVES[moveId](focus, riders);
  const eff = MOVE_EFF_BY_DIFF[sim.difficulty] ?? 1;
  if (eff !== 1) { ...難易度スケール... }
}
simulateTicks(sim.course, riders, fromTick, sim.directive || {...}, sim.groupMode === "solo");
```

を、**`RACE_MOVES`の呼び出しと難易度スケールのブロックを丸ごと`applyMove`へ包み、
`simulateTicks`の第6引数として渡す**形へ変える：

```js
const focus = riders.find(en => en.id === focusId);
const applyMove = () => {
  if (!focus || !RACE_MOVES[moveId]) return;
  RACE_MOVES[moveId](focus, riders);
  const eff = MOVE_EFF_BY_DIFF[sim.difficulty] ?? 1;
  if (eff !== 1) { ...現状と同じ内容＋下記のtempoLeft追加... }
};
simulateTicks(sim.course, riders, fromTick, sim.directive || {...}, sim.groupMode === "solo", applyMove);
```

- **前段の一括リセットループ（`attackLeft`/`tempoLeft`/`committedBreak`/`isLeadingOut`/
  `leadoutSurging`と、focus以外の`conserveLeft`/`finaleSend`/`holdOn`）は今の位置のまま**。
  `simulateTicks`はこれらを触らないのでリセットは生き残る。
- 適用順は「リセット → 復元 → 一手」になる。⚠️`directive.aceEarly`によるエース自動アタック
  （復元ループ内で`attackLeft`をセット）より一手が**後**に来るのは意図どおり
  （プレイヤーの明示的な判断が事前作戦を上書きする）。

## 3. 難易度スケールに`tempoLeft`を追加する（第51弾の取りこぼし）

`MOVE_EFF_BY_DIFF`のスケールは`attackLeft`/`finaleSend`/`conserveLeft`/`holdOn`に効くが、
第51弾で新設した`tempoLeft`が漏れている。同じ扱いに揃える：

```js
if (focus.tempoLeft > 0) focus.tempoLeft = Math.max(6, Math.round(focus.tempoLeft * eff));
```

## やらないこと（Phase 1のスコープ外・⚠️厳守）

- **バランス定数を1つも変更しない。** `SEND_*`／`KICK_*`／`KICKBIG_*`／`SPRINTWAIT_*`／
  `ATTACK_MIN_TICKS`／`CONSERVE_TICKS`／`HANGON_*`／`TEMPO_*`はすべて現状の値のまま。
  修正で強くなりすぎるのは**承知のうえ**で、まず素の姿を測る（Phase 2で再較正する）。
- `moveEdge.js`の分類・閾値も変更しない。
- 第51弾の判断カードの構成（枚数・地形ゲート）も変更しない。

## 検証項目（Phase 1）

**バグが直ったことの検証**（`scratchpad/w51_bug.mjs`の計測器＝`RACE_MOVES`のプロパティ
差し替えがそのまま流用できる）：

1. **消費が残ること**：同一シードで`hold`と各一手を比較し、発動tick直後（offset +0）の
   energy差が一手の消費量と一致すること——`tempo`で**-14**、`attack`で**-9**、`send`で**-17**、
   `hangOn`で**-3**。（現状はすべて**0.0**）
2. **`legsLeft01`が判断時点の値を読むこと**：`RACE_MOVES`が読む`r.energy`が
   `energyHist[fromTick-1]`と**一致**すること。（現状は前回のゴール時energy）
3. **表示と実挙動の一致**：UIが使う`moveEdge(move, decision.energy)`の`g`と、sim側が
   使った`legsLeft01(r)`が一致すること。⚠️これが`devlog/wave09.md`の前提そのもの。
4. **残脚満タンで上限に届くこと**：`energyHist[ft-1]`が95以上の発火点で
   `tempoLeft`=**110**・`attackLeft`=**30**・`send`の`finaleSend`=**0.130**になること。
   （現状は40／10／0.030の下限に張り付き）
5. **残脚が空なら下限になること**：「不発」表示が実際にも不発であること。
6. `teamShelter`／`teamChase`が僚友に与える消費（-7／-12）も残ること。
7. 難易度スケールが`tempoLeft`にも効くこと（`easy`1.15／`oni`0.66で値が動く）。

**回帰の検証**：

8. ⚠️**`onResume`を渡さない経路の挙動が完全に不変**であること。同一シードで
   `simulateTicks(..., fromTick=0, ...)`を回し、修正前後で全選手の`finishTime`が
   1桁まで一致することを機械検証する。
9. 第45〜51弾の既存検証スクリプト（`w45_verify1/2/3`・`w46_verify`・`w47_verify`・
   `w47_createchar`・`w48_verify`・`w50_verify`・`w51_verify`）が全て通ること。
   ⚠️`w51_verify`の検証6（tempoで千切れる人数）は、修正後は持続が40→110tickに伸びるため
   **今より千切れが増える方向**に動く。`tempo > hold`の関係が保たれていればよい
   （閾値を上げる必要があれば、その旨をコメントに残して調整する）。
10. `pageerror`ゼロ・`npx vite build`成功・Playwright実機でマイライフのレースを1本、
    判断カードを実際に選んで結果画面まで到達すること。

---

# Phase 2（Phase 1完了後にOpusが設計）: 全一手の再較正

Phase 1直後にOpusが以下を実測し、その結果を見てから再較正の設計を書く。

- **測定の格子**：一手（`hold`/`attack`/`send`/`kick`/`kickBig`/`sprintWait`/`conserve`/
  `hangOn`/`tempo`）×発火点（`mid`/`finale`/`sprint`/`terrain`）×残脚（満タン／消耗）。
- **見る指標**：1位率・表彰台率・**平均着順**。⚠️第51弾の実測で、n=178では1位率が
  誤差に埋もれ**平均着順だけが素直に反応する**と分かっている。1位率だけで判断しない。
- **主な懸念**：`send`の追い込みが0.030→0.130（4.3倍）になるため、**§35で潰した
  「早駆けが全脚質・全地形で常時最適解」が再発する可能性が高い**。ここが最優先の確認点。
- **合格条件の考え方**：どの一手も「全ての発火点で最強」にならず、それぞれが意図した
  局面で最上位になること。具体的な数値目標はPhase 1後の実測を見て決める。
- 測定は3点固定（`Math.random`／`Date.now`／`ridState.value`）に加え、**`resumeSim`直前に
  全アーム共通の副シードへ乱数ストリームを張り直す**こと（`buildMyLifeSim`が消費した分だけ
  ストリームが進んでいるため。`scratchpad/w51_tempo.mjs`参照）。
- `tempo`の3定数（`TEMPO_KEEP_TIGHTEN`／`TEMPO_ENERGY_COST`／`TEMPO_MIN/MAX_TICKS`）の
  確定もPhase 2で行う。

## Phase 1 実装結果（2026-08・Sonnet）

**`src/sim/ticks.js`**
- `simulateTicks(course, riders, fromTick, directive, noGroup, onResume)`に第6引数
  `onResume`を追加。`fromTick !== 0`の復元ブロック（pos/energy/各履歴のslice等）の直後、
  tickループに入る前に`if (onResume) onResume(riders);`を呼ぶ。`fromTick === 0`の経路
  （レース生成時）は無変更。

**`src/sim/finish.js`**
- `resumeSim`の`RACE_MOVES[moveId](focus, riders)`呼び出しと難易度スケール
  （`MOVE_EFF_BY_DIFF`）のブロックを`applyMove`という関数にまとめ、`simulateTicks`の
  第6引数として渡す形に変更。全選手一括リセット（`attackLeft`/`tempoLeft`/
  `committedBreak`等）は従来どおり`simulateTicks`呼び出しより前のまま。
- 難易度スケールに`focus.tempoLeft > 0`のケースを追加（第51弾で漏れていた分）。
- バランス定数は1つも変更していない（設計どおり）。

**検証**（Node・Playwright実機。`w52_verify.mjs`をscratchpadに作成）
1〜3. `tempo`/`attack`/`send`/`hangOn`の4種で、UIが表示する残脚（`energyHist[ft-1]`）と
   `RACE_MOVES`が実際に読んだ`r.energy`が一致し、消費（-14/-9/-17/-3）が復元後にも
   残っていることを確認（修正前はいずれも差0.0だった）。
4. 残脚満タンで`tempoLeft`=110・`attackLeft`=30・`send`の`finaleSend`=0.130と、各レンジの
   **上限**に届くことを確認（修正前は常に下限の40/10/0.030だった）。
5. 残脚僅少で`attackLeft`=10（下限）になり、UI側の`moveEdge`も「不発」表示と一致することを
   確認。
6. `teamShelter`/`teamChase`が僚友に与える消費（-7/-12）が変わらず機能することを確認。
7. 難易度スケール（`easy`×1.15／`oni`×0.66）が`tempoLeft`にも正しく効くことを確認。
8. ⚠️`onResume`を渡さない`fromTick===0`経路（レース生成時）は、同一シードで修正前後の
   全選手の`finishTime`が完全一致し、`onResume`が呼ばれないことを機械検証（回帰ゼロ）。
9. 第45〜51弾の既存検証スクリプト（`w45_verify1/2/3`・`w46_verify`・`w47_verify`・
   `w48_verify`・`w50_verify`・`w51_verify`）を全て再実行し回帰なし。`npx vite build`成功。
   Playwright実機：マイライフのレースを1本、スキップを使わず観戦し、判断カードが3回
   （中盤・状況発火・勝負所）発火してそれぞれ選択→結果画面まで到達、`pageerror`ゼロ。

**わかったこと（Phase 2への申し送り）**：修正によって`tempo`の実際の持続は40→最大110tick
（2.75倍）に伸び、`send`の追い込みは0.030→最大0.130（4.3倍）になる。第51弾で実測した
数字（tempo効果が平均0.6人しか削れない等）はすべて「消費0・持続40tick固定」という
壊れた前提の上のものなので、Phase 2はゼロから測り直す。

**やらなかったこと（設計どおり）**：バランス定数の変更・`tempo`の3定数の確定・
他の一手（`kick`/`kickBig`/`sprintWait`/`conserve`）の再較正はすべてPhase 2へ持ち越し。

---

# Phase 2 実測（2026-08・Opus）→ ⚠️**再較正では直らない。Phase 2の前提が外れた**

測定条件：主力power74/A・山岳系レース・n=171〜192・3点固定＋`resumeSim`直前の副シード
張り直し。1シードにつき`buildMyLifeSim`は1回だけ走らせ、スナップショットから各アームを
復元して比較（`scratchpad/w52_grid.mjs`）。**平均着順の良い順**に並べてある
（第51弾の実測どおり、1位率はこのnでは誤差に埋もれ平均着順だけが素直に反応するため）。

## 測定1：一手 × 発火点の格子

| 発火点 | 順位 | 一手 | 1位率 | 表彰台 | 平均着順 | ゴール残脚 |
|---|---|---|---|---|---|---|
| **mid** | 1 | **hold** | 30.7% | 43.8% | **10.57** | -67.0 |
| | 2 | conserve | 26.0% | 41.1% | 10.74 | -67.2 |
| | 3 | hangOn | 24.5% | 40.6% | 11.55 | -70.8 |
| | 4 | attack | 14.6% | 28.6% | 14.80 | -80.4 |
| | 5 | send | 21.4% | 26.0% | **16.53** | -83.6 |
| **finale** | 1 | **kickBig** | 38.2% | 47.6% | **10.68** | -70.9 |
| | 2 | sprintWait | 34.6% | 47.6% | 10.97 | -71.0 |
| | 3 | conserve | 25.7% | 42.9% | 11.00 | -68.6 |
| | 4 | kick | 30.9% | 46.6% | 11.16 | -71.5 |
| | 5 | hold | 26.7% | 44.5% | 11.31 | -70.7 |
| | 6 | attack | 17.3% | 28.8% | 15.15 | -81.4 |
| | 7 | send | 17.8% | 23.0% | **17.76** | -86.3 |
| **terrain** | 1 | **tempo** | 25.8% | 41.6% | **10.13** | -69.7 |
| | 2 | hold | 22.5% | 37.1% | 12.15 | -72.3 |
| | 3 | attack | 6.2% | 11.2% | **24.24** | -92.9 |
| **sprint** | 1 | **kickBig** | 35.1% | 47.4% | **10.44** | -68.7 |
| | 2 | sprintWait | 33.3% | 46.2% | 10.64 | -68.4 |
| | 3 | kick | 29.8% | 46.8% | 10.71 | -68.5 |
| | 4 | hold | 27.5% | 42.7% | 11.01 | -67.3 |
| | 5 | send | 16.4% | 23.4% | **17.10** | -85.2 |

### ⚠️ 心配していたことは起きず、逆のことが起きていた

**`send`は常時最適解になるどころか、全ての発火点で最下位**（mid 16.53／finale 17.76／
sprint 17.10、いずれもholdより6着ほど悪い）。§35で潰した「早駆けが常時最適解」の再発を
最優先の確認点にしていたが、**杞憂だった**。

代わりに見つかったのは正反対の問題：

1. ⚠️**`attack`と`send`はどの発火点でも「絶対に選んではいけない手」になっている。**
   平均着順でholdより4〜6着悪く、1位率でも表彰台率でも劣る＝**上振れすら無い**。
   特に`terrain`の`attack`は平均24.24着（holdは12.15着）で、40人中の下位まで沈む。
2. ⚠️**`mid`ではholdが最善**。conserve・hangOn・attack・sendのどれもholdに勝てない＝
   **「中盤の判断」カードは、何もしないのが正解の選択肢しか無い**＝判断になっていない。
3. **`finale`と`sprint`は健全**。kickBig > sprintWait > kick > hold と差し脚系がholdを
   上回り、順序も意図どおり。差は0.6着程度と小さいが方向は正しい。
4. **`tempo`は修正後に本来の効き方になった**。holdより**2.02着**良く、格子全体で最大の差。
   第51弾時点（持続40tick固定・消費0）の+0.7着から大きく改善している。

## 測定2：なぜ`attack`が沈むのか（消費と持続を分離）

`RACE_MOVES.attack`を差し替えて、Phase 1が同時に直した2つ（消費が効く／持続が伸びる）の
どちらが効いているかを分離した（`scratchpad/w52_why.mjs`・発火点=terrain・n≈178）。

| バリアント | 1位率 | 表彰台 | 平均着順 | ゴール残脚 | 発動後200tickの独走割合 | 200tick後の吸収率 |
|---|---|---|---|---|---|---|
| attack 持続30・消費9（現状） | 6.2% | 11.2% | 24.24 | -92.9 | 68.5% | 34.8% |
| attack 持続30・**消費0** | 6.7% | 10.7% | **24.24** | -93.2 | 68.5% | 34.8% |
| attack **持続10**・消費9 | 12.4% | 27.0% | 15.69 | -77.8 | 21.2% | 85.4% |
| attack 持続10・消費0（修正前相当） | 15.7% | 28.7% | 15.56 | -78.1 | 21.2% | 85.4% |
| attack **持続60**・消費9 | 3.4% | 5.1% | 26.71 | -97.9 | 96.0% | 7.9% |
| **hold** | 22.5% | 37.1% | **12.15** | -72.3 | 0.0% | 100.0% |

### ⚠️ 結論：これは較正の問題ではなく構造の問題

- **エネルギー消費は着順にまったく効いていない。** 消費9と消費0で平均着順が**24.24で完全に
  同じ**（持続10でも15.69対15.56とほぼ差なし）。Phase 1で復活させた「脚を使う代償」は、
  着順という結果に対しては依然として無意味である。
- **持続時間が長いほど単調に悪化する。** 10→15.69、30→24.24、60→26.71。
  独走していた割合（21%→68%→96%）と着順の悪化がきれいに対応している。
  ⚠️**単独走は純粋に損で、集団を出た瞬間から負け始める。時間が長いほど負ける。**
- **どの持続値でもholdに勝てない。** 最良の`持続10`（15.69）ですらhold（12.15）に3.5着負ける。
  ⚠️**定数をどう振っても`attack`をholdより良くすることはできない。**

**構造的な理由**：集団にいる間は`dist = groupDist = puller.lastOwnDist`で、集団は
**「牽引できる中で最も強い選手が全力で牽いた速度」**で進む。一方ドラフトの消耗は
`effortCost` 0.5〜0.85に対し、solo=1.3・attack=1.6。`attack`中は`tickSpeedFactor`で
1.15倍の加速が付くが、**1.6倍の消耗を埋め合わせられない**。しかも`attackLeft`が尽きると
solo（加速なし・消耗1.3倍）で独りきりになる。つまり**集団の中にいることが、速さでも
消耗でも常に有利**で、逃げが成立する余地が構造的に無い。

これは第48弾（第9弾）が`brk`係数の強化で対処しようとした問題と同じもので、
**まだ直っていない**（当時の実測「勝者との差が全区分でholdの2〜3倍」と整合する）。

## ⚠️ Phase 2の再設計が必要（ユーザー判断待ち）

Phase 2は「較正済み定数（`SEND_*`／`KICK_*`／`ATTACK_*`／`CONSERVE_TICKS`／`HANGON_*`）を
測り直して再較正する」という前提で設計したが、**実測がその前提を否定した**。
`kick`系（finale/sprint）は既に健全で触る必要が無く、`attack`/`send`は定数では直らない。
残る問題は次の2つで、いずれも**構造の変更かカード構成の変更**を要する。

- **問題A：逃げ（`attack`/`send`）が成立しない。** 集団にいる方が速くて安いため、
  単独で出る動機が一切無い。「決まれば独走」という文言も実態と食い違っている。
- **問題B：`mid`カードが判断になっていない。** holdが最善で、他の選択肢はすべて劣る。
