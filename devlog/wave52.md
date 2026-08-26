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
