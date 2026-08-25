# 第50弾（設計確定）: バッジを決着ロジックへ合流させる

## 発端：倍率調整では直らないことが実測で判明した

第49弾で「4段階システムは機構としては動いているが体感できない」と分かり、ユーザーから
「倍率を調整する／バッジの組み合わせも考慮したい」との方針を受けた。しかし**倍率を上げても
効かない**ことが実測で判明したため、先に構造を直す。

同じ**+22**を与え方だけ変えて比較（主力power74/A・n=192・同一シード）：

| 与え方 | 1位率 | 3位以内 | 同着集団率 |
|---|---|---|---|
| ベース（バッジ無し） | 22.4% | 34.9% | 49% |
| **バッジ2個・虹（climb区間+22）** | **19.3%** | 33.3% | 49% |
| 素の`climb` +22 | 25.0% | 35.9% | 48% |
| 素の`climb`+`sprint` 各+22 | **37.5%** | 45.3% | 36% |

同じ+22でも**区間ボーナスとして与えると効かず、素の能力として与えると効く**。

## 原因：`finishAbility`が区間ボーナスを見ていない

`src/sim/finish.js`の`resolveFinishClusters()`は、僅差でゴールした集団（＝**実測で約半分の
レース**）の順位を`finishAbility()`で決め直す。ところが：

```js
export function finishAbility(en, segType) {
  const sp = en.sprint || 0, cl = en.climb || 0, fl = en.flat || 0, so = en.solo || 0;
  if (segType === "climb" || segType === "mtn") return cl * 0.75 + sp * 0.25;
  ...
```

**素の`en.climb`/`en.sprint`しか見ておらず、`segmentAbility()`が足したバッジのボーナスを
一切参照していない。** つまり集団ゴールになった瞬間、バッジは無かったことになる。

残り半分（tickで決まるレース）ではバッジは効くが、第49弾の実測では2,500秒のレースに対して
+3.4秒（0.13%）で着順を動かすには足りない。**両方の経路で弱いため、倍率だけを触っても
勝率は動かない**（`mount`を区間+50にしても同じ）。

## 確定仕様（案A：決着に合流）

### 1. バッジのボーナス分だけを取り出す関数を新設

`sim/effects.js`の`segmentAbility()`は「地形の基礎値＋脚質相性＋バッジ群」を一度に計算して
いる。このうち**バッジ群だけ**を返す関数を切り出す（`segmentAbility`はそれを呼ぶ形に直し、
計算は一箇所に保つ＝二重管理を作らない）。

```js
// 区間タイプに応じたバッジ由来のボーナス合計だけを返す（地形の基礎値・脚質相性は含まない）
export function badgeSegmentBonus(segType, e) { ... }
```

対象は現行`segmentAbility`内のバッジ群すべて：`mount`/`puncheur`/`flatlander`/`sprinter_sp`/
`soloist`/`closer`/`hybrid`/`twinsoul`/`unfallen`/`sovereign`/`allclimber`/`heavy`（悪特性の
マイナスも含める＝決着でも不利になるのが自然）。`steepness`は使っていないため引数に不要。

⚠️**血脈4種（`hybrid`/`twinsoul`/`unfallen`/`sovereign`）は`effAbilities`内で素の能力にも
加算済み**（`effects.js:87-93`）なので、既に`finishAbility`へ間接的に効いている。案Aを入れると
区間ボーナス分も上乗せされ、決着では二重に乗る形になる。これは**意図的に許容する**——
配合でしか手に入らない伝説特能が決着で強いのは筋が通るため。ただしKを決める実測では
血脈を持たない構成で測り、血脈持ちが過剰にならないかを別途確認する。

### 2. `finishAbility`にバッジ分を加える

```js
export function finishAbility(en, segType) {
  const base = /* 現行の cl*0.75 + sp*0.25 等 */;
  return base + badgeSegmentBonus(segType, en) * FINISH_BADGE_K;
}
```

⚠️`resolveFinishClusters`が受け取る`en`はエントラントであり、第48弾の修正で
`silverAbilities`/`rainbowAbilities`も載っているため、**段階が正しく読める**
（第48弾より前に案Aをやっても銀・虹は効かなかった）。

### 3. `FINISH_BADGE_K`（決着での重み）は実装後に実測して決める

⚠️**この値は設計段階では確定させない。** 理由：現状の測定はすべて「素の能力を上げた場合」の
代理でしかなく、決着スコアだけを動かした場合の応答は実装しないと測れないため。

代理測定からの見積もり：素の`climb`+22（＝決着スコア+16.5相当）で勝率+2.6ptだったので、
`K=1.0`・虹バッジ2枚（決着スコア+22）では**+3pt前後**にしかならない見込み。
体感できる差（銅→虹で+8〜10pt程度）を狙うなら**K=2〜3**が出発点になる。
実装後に`K = 1.0 / 2.0 / 3.0 / 4.0`を同一シードで実測し、そこから確定する。

**測定時の必須事項（第49弾で2回失敗した教訓）**：`Math.random`＋`Date.now`＋
`ridState.value`の3点を固定しないと数字はすべて無意味になる（`devlog/wave49.md`参照）。

### 4. 組み合わせについて

案Aを入れると**組み合わせが初めて意味を持つ**。山頂決着（`mtn`）では`mount`・`closer`・
`allclimber`が三つとも`badgeSegmentBonus`に乗るため、同じ地形に寄せたビルドほど決着が
強くなる。⚠️**専用の相乗テーブル（特定の2枚でボーナス等）はこの弾では作らない**——
まず素直な加算で組み合わせが効くようにし、その効き具合を実測してから、
追加の相乗が要るかを判断する（要らない可能性が高い）。

## やらないこと

- tick側（`segmentAbility`）の値は変更しない。決着に乗るようになった分の効きを先に測る。
- `sponge`の金1.35など個別の暫定値の見直しは、この構造変更の後に改めて。
- バッジ以外（脚質相性・体格補正等）は決着に乗せない。今回はバッジの断絶だけを直す。

## 検証項目

1. `badgeSegmentBonus`を切り出しても`segmentAbility`の戻り値が**1つも変わらない**こと
   （既存の全区間タイプ×全バッジで数値一致を機械検証）。
2. バッジ無しの選手で`finishAbility`の戻り値が現行と完全一致すること（回帰なし）。
3. 山頂決着で`mount`虹を持つ選手の`finishAbility`が、持たない選手より高いこと。
4. 悪特性（`heavy`）持ちは山頂決着で`finishAbility`が下がること。
5. `K = 1.0/2.0/3.0/4.0`での勝率を同一シードで実測し、銅→虹の差を表にする（Opus）。
6. `pageerror`ゼロ・ビルド成功・第45〜48弾の既存検証スクリプトが全て通ること。

## 実装結果（2026-08・Sonnet）

**`src/sim/effects.js`**
- `badgeSegmentBonus(segType, e)`を新設。`segmentAbility`内にあったバッジ群（`mount`〜`heavy`
  の12種）をそのまま移し、`segmentAbility`は`地形基礎+affinity+badgeSegmentBonus(...)`という
  形に変更（計算は1箇所のまま・数値は不変）。

**`src/sim/finish.js`**
- `effects.js`から`badgeSegmentBonus`をimport。`FINISH_BADGE_K = 1`（暫定値。実測して
  Opusが確定する前提で`export const`にした）を新設。`finishAbility`の戻り値へ
  `+ badgeSegmentBonus(segType, en) * FINISH_BADGE_K`を追加（バッジ無しの選手は`+0`＝無影響）。

**検証**（Node・Playwright実機）
1. 5種の異なる特能構成×全6区間タイプで「地形基礎+affinity+badgeSegmentBonus」を手計算し、
   `segmentAbility`の実際の戻り値と完全一致することを確認（切り出しによる回帰ゼロ）。
2. バッジ無しの選手で`finishAbility`（climb/hill/tt/sprintの4区間）が現行の計算式と
   完全一致することを確認。
3. `mount`虹持ち選手の山頂決着スコアが77.25、持たない選手が66.25で、期待どおり押し上げ。
4. `heavy`（悪特性）持ちの山頂決着スコアが62.25で、持たない選手（66.25）より低いことを確認。
5. 第45〜48弾の既存検証スクリプト（`w45_verify1/2/3`・`w46_verify`・`w47_verify`・
   `w47_createchar`・`w48_verify`）を全て再実行し、回帰が無いことを確認。
6. Playwright実機：マイライフのレースを1本、判断カード選択→スキップ機能で最後まで走らせ、
   スタートリスト（32名参加）→中継→結果画面（11位/32人中）まで到達。`pageerror`ゼロ
   （コンソールの404はfavicon等の無関係なリソースで実害なし）。`npx vite build`成功。

**やらなかったこと（設計どおり）**：`FINISH_BADGE_K`の確定値の実測はOpusの担当
（devlog/wave49.mdの3点固定＝`Math.random`/`Date.now`/`ridState.value`が必須）。
tick側（`segmentAbility`の値自体）は無変更。専用の相乗テーブルは作っていない。
