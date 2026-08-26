# 第54弾（設計確定）: テンポの式を作り直し、逃げに直接の優位を与える

## 発端

第53弾のテンポは実測で成立しなかった（全表は`devlog/wave53.md`末尾）。
ユーザー判断（2026-08）：**案Z＝式を作り直す**＋**別の機構でもう一度挑戦する**。

⚠️これは「逃げを成立させる」3回目の挑戦である（第52弾＝定数調整・失敗／第53弾＝集団の
テンポ・失敗）。同じ轍を踏まないため、**この弾では実装前に予測を明示し、外れたら撤退する
基準を先に決めておく**（末尾「撤退基準」）。

## 第53弾がなぜ壊れたかの正確な理解（設計の出発点）

```js
paceMul = base + (1 - base) * (gapAhead / CHASE_FULL_GAP)   // gapAhead = leadPos - 自分の集団の先頭
```

この式は**集団ごとに別々の`gapAhead`**を使う。その結果：

| 集団 | `gapAhead` | `paceMul` |
|---|---|---|
| レースの先頭集団 | **0** | **0.94（最も遅い）** |
| 後方の集団 | 大きい | **1.0に近い（速い）** |

⚠️**レースを支配している集団だけが減速させられ、後続は全力で走れる**状態だった。
実測：prog=0.80時点のグループ数が**6.50→3.63**＝後続が追いついてフィールドが融合し、
本来プレイヤーの後ろでゴールするはずだった選手がゴールスプリントに参加した
（プレイヤーの前でゴールする人数 11.30→17.28）。

⚠️**教訓：集団間に系統的な速度差を作ってはいけない。** 作ると必ずフィールドが融合し、
それまでの選抜（誰が千切れたか）が無効化される。

## 確定仕様

### 1. `paceMul`を**レース全体で1つの値**にする（集団ごとに変えない）

集団ごとの`gapAhead`をやめ、**「逃げが本隊からどれだけ離れているか」というレース全体で
1つの値**から`paceMul`を決める。全ての対象者が同じ倍率で走るので、集団間の相対関係は
一切変わらない＝第53弾の融合が起きない。

```js
// tickループの先頭（グループ判定の直後・モード決定より前）で1回だけ計算する
// 本隊＝人数が最も多い集団（同数なら前方の集団）
const mainBunch = /* groupsの中で members.length が最大のもの。同数なら members[0].pos が大きい方 */;
const bunchPos = mainBunch ? mainBunch[0].pos : leadPos;
const gapToBunch = Math.max(0, leadPos - bunchPos);
const prog = bunchPos / course.length;

let racePaceMul = 1;
if (!noGroup && prog < TEMPO_END_PROG && course.segTypeAt(bunchPos).idx !== course.finalIdx) {
  racePaceMul = TEMPO_BASE + (1 - TEMPO_BASE) * Math.min(1, gapToBunch / CHASE_FULL_GAP);
}
const raceDrainMul = Math.pow(racePaceMul, TEMPO_DRAIN_EXP);
```

- 逃げが誰もいない（`gapToBunch = 0`）→ 全員`TEMPO_BASE`で巡航
- 逃げが`CHASE_FULL_GAP`まで離れた → 全員`1.0`（全力の追走）
- ⚠️終盤（`prog >= TEMPO_END_PROG`）と最終区間は常に`1.0`（第53弾から据え置き）

### 2. **逃げている選手だけ**が減速の対象外＝これが「直接の優位」

⚠️**第53弾との最大の違い。** 減速の対象を次のとおり厳密に分ける。

| 対象 | `paceMul` | 理由 |
|---|---|---|
| 集団にいる選手（`pull`・`draft`） | `racePaceMul` | 本隊はテンポで巡航する |
| **千切れた単独走者**（`solo`かつ`committedBreak`でない） | **`racePaceMul`** | ⚠️**ここが第53弾との差**。苦しんで千切れた選手も同じだけ減速させる。対象外にすると本隊より速くなって**戻ってきてしまう**（第53弾の融合の直接原因） |
| **逃げている選手**（`committedBreak`かつ`solo`/`attack`） | **1.0（対象外）** | 覚悟を決めて踏んでいる選手だけが、本隊が緩めている間に差を作れる |

これにより、逃げは本隊に対して**`1/TEMPO_BASE - 1`＝約6.4%の優位**を、
本隊が追い始めるまでの間だけ得る。⚠️`send`は`committedBreak = false`なので対象外のまま
（早駆けは「逃げ」ではなくゴール前の全開、という既存の設計意図どおり）。

### 3. 事前作戦・AIスタイルによる`TEMPO_BASE`の加減は**撤去する**

第53弾で入れた`TEMPO_ADJUST_PUSH`/`TEMPO_ADJUST_HOLD`（±0.03）は、⚠️**実測で効果が
無いことが確認済み**（0にしても`hold`の平均着順が18.58→18.57で不変）。さらに
`paceMul`をレース全体で1つにする以上、集団ごとに加減すると§1の「集団間に速度差を
作らない」原則を破る。**定数ごと削除する。**

⚠️これにより`chaseMode`は再び`rotSpan`しか変えなくなる（第53弾で解こうとした
「事前作戦が展開に出ていない」問題は**未解決のまま残る**）。この弾では扱わない。

### 4. 定数（第53弾から据え置き・すべて仮置き）

`TEMPO_BASE`0.94／`CHASE_FULL_GAP`1.2／`TEMPO_END_PROG`0.80／`TEMPO_DRAIN_EXP`1.0。
⚠️実装後にOpusが実測して確定する。

## やらないこと

- `attack`/`send`の定数（`ATTACK_MIN_TICKS`等）は変更しない。
- `mid`カードの内容は変更しない（§82の課題として保留）。
- `chaseMode`を展開へ接続する件は扱わない（上記3）。

## ⚠️ 予測と撤退基準（実装前に明示する）

3回目の挑戦なので、**成功と失敗の線を先に引いておく**。実装後にOpusが
`scratchpad/w53_sweep_one.mjs`（`TEMPO_BASE = 1.0`が導入前と同一挙動＝基準点）で測る。

**この設計が正しければ、こうなるはず：**

| 指標 | 第53弾（失敗時） | 第54弾の予測 |
|---|---|---|
| `hold`の平均着順（terrain・`TEMPO_BASE=0.94`） | 21.65（基準12.97から**+8.7**） | ⭐**13前後（基準からの悪化1着以内）** |
| prog=0.80時点のグループ数 | 3.63（基準6.50から融合） | ⭐**6.5前後（基準と同水準＝融合しない）** |
| `attack` − `hold`（terrain） | +5.93（＝依然として損） | ⭐**+2以内、または地形によっては負の値** |

**⚠️撤退基準（1つでも該当したら、この方向を恒久的に断念する）：**

1. **`hold`の平均着順が基準（`TEMPO_BASE=1.0`）から1着を超えて悪化する。**
   ＝また基準点を犠牲にしている。第53弾と同じ失敗。
2. **prog=0.80時点のグループ数が基準から2割を超えて減る。**
   ＝またフィールドが融合している。
3. **`TEMPO_BASE`をどう振っても`attack` − `hold`が+3を下回らない。**
   ＝3回試して逃げが成立しない＝この題材は構造的に無理だと確定させる。

⚠️**撤退基準に触れた場合、第52弾で見送った案B（逃げを諦め、`attack`/`send`を
カードの選択肢から外す）へ切り替える。** 4回目は試さない。

## 検証項目

1. ⚠️**集団間に速度差が生じないこと**：同一tickで、全ての多人数グループの
   `groupPaceMul`が完全に同一の値であることを機械検証する（第53弾の失敗の再発防止）。
2. **千切れた単独走者も減速の対象になること**、**`committedBreak`の逃げだけが対象外**に
   なること（`groupPaceMul`をriderごとに読んで確認）。
3. **逃げが実際に差を作ること**：`committedBreak`の選手が本隊に対して毎tick前進すること。
4. **逃げが`CHASE_FULL_GAP`到達後は差を広げられなくなること**（全員1.0になるため）。
5. 個人TT・チームTT（`noGroup`）が無影響であること（同一シードで`finishTime`完全一致）。
6. 終盤（`prog >= TEMPO_END_PROG`）・最終区間で`paceMul = 1`になること。
7. `TEMPO_ADJUST_*`が完全に削除され、参照が残っていないこと。
8. 第45〜53弾の既存検証スクリプトが全て通ること・`npx vite build`成功・
   Playwright実機で`pageerror`ゼロ。

## 実装結果（2026-08・Sonnet）

**`src/sim/ticks.js`**
- `groups`構築の直後に`racePaceMul`/`raceDrainMul`をレース全体で1回だけ計算する処理を新設。
  「本隊」＝`Object.values(groups)`のうち`members.length`が最大の集団（同数なら`members[0].pos`
  が大きい方）を選び、`leadPos - bunchPos`から`urgency`を求めて`TEMPO_BASE + (1-TEMPO_BASE)*urgency`
  とする。`noGroup`時・本隊が終盤/最終区間にいるときは1のまま。
- モード決定（`Object.values(groups).forEach`）の**後**に、`active.forEach`で全選手に
  一律`groupPaceMul`/`groupDrainMul`を設定する処理を追加：`committedBreak && (mode==="solo"||"attack")`
  の選手（＝逃げている選手）だけ1、それ以外（集団内の選手・千切れた非逃げの単独走者）は
  `racePaceMul`/`raceDrainMul`。旧`members.forEach`内での個別代入は撤去。
- 移動パス（`active.forEach`、`mode!=="draft"`）で`dist *= en.groupPaceMul`と
  `energyDrain(...) * en.groupDrainMul`を**pull/solo/attack全モードに一律**適用するよう変更
  （旧`pull`限定から拡張。「千切れた単独走者も減速させる」という第54弾の核心）。
- ドラフト勢の`drain`計算（`sheltered ? (en.groupDrainMul ?? 1) : 1`）は式自体は無変更
  （`groupDrainMul`の中身がレース全体で1つの値に変わっただけ）。
- `TEMPO_ADJUST_PUSH`/`TEMPO_ADJUST_HOLD`定数と、`rotSpan`分岐内の`tempoAdjust`代入を完全に削除。
  `chaseMode`/AIスタイルは`rotSpan`（ローテーション周期）にのみ効く形に戻った。

**検証**（Node・Playwright実機。`w54_verify.mjs`をscratchpadに作成）
1. 同一tickで、本隊・後方の追走集団（別グループ）の`groupPaceMul`が完全に同一の値になる
   ことを確認（第53弾の失敗——集団間に速度差が生じる——の再発防止）。
2. 千切れた単独走者（`committedBreak`なし）は本隊と同じ`groupPaceMul`、逃げている選手
   （`committedBreak`あり）は`groupPaceMul=1`になり、扱いが正しく分かれることを確認。
3. 逃げが本隊に対して実際に前進し続けること（tick1→tick10でギャップが拡大）を確認。
4. `gapToBunch = CHASE_FULL_GAP`ちょうどのとき、本隊も`groupPaceMul=1`（全力）に戻る
   ことを確認。⚠️`simulateTicks`は完走かMAX_TICKS到達まで丸ごと走るため、tick=1時点の
   値だけを見たい場合はコースを極端に短くして「全員が1tick目で完走する」状態を作る必要が
   あった（通常長のコースで最終状態を読むと、長距離走行による疲労等の別要因が混ざる）。
5. 個人TT・チームTT（`noGroup`）は`chaseMode`を変えても`finishTime`が完全一致——無影響。
6. 終盤（`prog >= TEMPO_END_PROG`）で`groupPaceMul = 1`になることを確認。
7. `TEMPO_ADJUST_*`の参照がソースに残っていないことを確認。
8. 第45〜52弾の既存検証スクリプト全て回帰なし。⚠️`w53_verify.mjs`の「事前作戦push/holdで
   groupPaceMulが変わる」検証2件は**期待どおり失敗する**——`TEMPO_ADJUST_*`を撤去した
   （確定仕様3）ことによる、設計どおりの変化であって回帰ではない（`w54_verify.mjs`が
   この機能を引き継いでいないのも同じ理由）。`npx vite build`成功。Playwright実機：
   マイライフのレースで「登りで抜け出す」を選択→観戦中に「逃げとメインのギャップ：
   約49秒」の実況表示を確認（大きなギャップが実際に形成された）、`pageerror`ゼロ。

**やらなかったこと（設計どおり）**：`attack`/`send`の定数・`mid`カードは無変更。
`chaseMode`を展開に接続する件は扱っていない（確定仕様3の帰結として未解決のまま）。
`TEMPO_BASE`等4定数の確定と、予測・撤退基準に基づく判定はOpusの実測待ち。
