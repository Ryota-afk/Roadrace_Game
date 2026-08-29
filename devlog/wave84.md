# 第84弾：チームTTのレース後処理の欠落を埋める（設計）

**状態**：⚠️**設計のみ。実装は未着手（Sonnetへ切り替えてから着手する）。**

第83弾の横断調査で見つけた「チームTTだけレース後処理がほぼ丸ごと欠けている」件。
ユーザー合意は**案①＝人気度・絆・成績台帳をチーム順位ベースで付与**（`careerWins`は
個人の勝利ではないので据え置き）。

## 前提の実測値（CLAUDE.md §10）

| 項目 | 実測 | 出典 |
|---|---|---|
| チームTTが候補に出る月 | 144ヶ月中**20ヶ月（14%）** | `w83_teamtt_freq.mjs` |
| そのグレード内訳 | G1×9・G2×3・G3×8 | 同上 |
| 1レースの参加チーム数 | **9チーム**（クラス0/1/2とも） | `w84_ttt_teams.mjs` |
| 1チームの人数 | 4〜7名 | 同上 |
| 現状の取りこぼし人気度 | 1位継続で**88.5**（上限100）／3位相当44.3 | `w84_ttt_gap.mjs` |

## ①-1 人気度（popularity・popMilestones・到達ボーナス金）

### 付与式

```js
// controllers/mylife/result.js  mlFinishTeamTT 内
const popGain = (teamRank === 1 ? 1.5 : teamRank <= 3 ? 0.8 : teamRank <= 5 ? 0.3 : 0.1)
  * GRADE_MUL[race.grade];
```

**通常レースの半分**（通常は 3／1.5／0.5／0.1）。根拠は2つ。

1. ⚠️**母集団が違う。** 通常レースは48〜60名中の順位、チームTTは**9チーム中**の順位。
   同じ「1位」でも希少性が5〜6倍違うので、同じ係数を当てると過大になる。
2. チームTTの勝利は**チームの勲章**であり、個人の名声（人気度）への寄与は割り引くのが
   自然。

**実測（見込み）**：20回すべて1位で `1.5 × (1.0×9 + 1.5×3 + 2.0×8) = 44.3`。
現状0 → 44.3。通常レース20勝ぶんの88.5とは明確に差が付く。

### 到達ボーナスの共通化（CLAUDE.md §5）

`POP_MILESTONES` の判定は現在 `mlFinishRace` にベタ書き（result.js:75-81）。
チームTT側へ**コピーせず**、新しい純関数へ切り出して両方から呼ぶ。

**新規ファイル `src/domain/mylife/popularity.js`**：

```js
import { POP_MILESTONES } from "../../data/economy.js";   // 定義元は economy.js:77
// 人気度の加算と、その結果新たに到達したマイルストーンの契約ボーナス金を返す純関数。
export function applyPopGain(player, popGain) {
  const done = player.popMilestones || [];
  const popularity = Math.max(0, Math.min(100, (player.popularity || 0) + popGain));
  let popBonus = 0; const newlyHit = [];
  POP_MILESTONES.forEach(m => {
    if (popularity >= m.th && !done.includes(m.th)) { popBonus += m.bonus; newlyHit.push(m.th); }
  });
  return { popularity, popMilestones: [...done, ...newlyHit], popBonus };
}
```

`mlFinishRace` 側も**この関数を呼ぶ形に置き換える**（挙動は完全に同一。同じ処理が
2箇所に増えるのを最初から防ぐ＝第83弾の教訓の適用）。

### アンビション達成判定も同時に入れる

⚠️人気度を更新するなら、**その場でアンビションの達成判定もしないと片手落ち**になる。
「人気の道」の段（`s_p40`〜`s_p95`）は `metric: "popularity"` なので、チームTTで
到達しても**次の通常レースまで達成報酬が出ない**。`mlFinishRace` と同じ形で
`mlCurrentAmbition` → `mlAmbitionCleared` → `applyAmbitionReward` を呼び、
`ambitionIdx`／`ambitionDone`／`ambMoney` を返す。

### money への反映

`money: s.money + prize + popBonus + ambMoney`

## ①-2 絆（bonds）＋ ⚠️結束が結果に効いていない配線漏れ

### (a) `mlCoRacedIds` がチームTTで落ちる

`domain/mylife/bonds.js:39` は `sim.ranked.filter(...)` を読むが、⚠️**チームTTの sim には
`ranked` が存在しない**（`computeTeamTT` は `sim.teamTT` を作って即 return する）。
そのまま呼ぶと `TypeError`。

**修正**：`(sim.ranked || sim.entrants)` にフォールバックする。チームTTでも
`sim.entrants` に自チームの僚友が `team === "PLAYER"` で入っており、`rosterIds`
（`s.teammates` の id 集合）で絞るので結果は同じになる。

### (b) 付与

```js
const bonds = mlBondsAfterRace(s.bonds, s, sim, { podium: teamRank <= 3, assist: false });
```

`assist` はチームTTに献身の概念が無いので常に `false`。

### (c) ⚠️結束（chemMul）がチームTTの結果に一切効いていない

`sim/buildMyLifeSim.js:246` が **`computeTeamTT(sim, 1)` とハードコード**している。
シーズン側（`sim/buildSim.js:141`）は `computeTeamTT(sim, chemTier.mul)` を渡しており、
⚠️**マイライフだけ結束が無視されている**。

`chemMul` は `raceTeams.forEach` の中（buildMyLifeSim.js:148）で計算され、ループ外の
246行目からは見えない。**ループ手前に `let playerChemMul = 1;` を宣言し、
`isMyTeam` のときに代入**して、246行目で渡す。

これを直して初めて「**絆が育つ → チームTTが速くなる → また絆が育つ**」が閉じる。
現状は入口（絆が育たない）と出口（結束が効かない）の両方が切れている。

⚠️**計測必須（§10）**：`chemMul` は `1 - avgBond/100 × 0.08` で最大 0.92。
`teamTTTime` の `chemBonus = 1 + (1 - chemMul)` なので power が最大 **+8%**、
タイムは `3060 - (power-75)*9` より **約54秒短縮**（power 75 → 81 で 54秒）。
9チームのタイム差は数分なので、⚠️**満絆で1〜2順位ぶん動く可能性がある**。
実装後に「絆0のとき／絆満のときのチーム順位分布」を n=200 で測り、この弾に記録すること。

## ①-3 成績台帳（riderStats）と ⚠️世界ランキングの片務性

### 見つかった不具合

`mlFinishTeamTT` は `worldPoints` に `wpGain` を足す一方、⚠️**`riderStats` を一切更新しない**。
さらに `controllers/mylife/month.js:497` の

```js
if (mode === "race" && cls === s.classIdx) continue;   // 自分が出たクラスは lite 決着を飛ばす
```

により、⚠️**チームTTを走った月は自分のクラスのAIに世界ptが1ptも入らない**
（通常レースなら `mlUpdateRiderStats(…, sim.ranked, …)` が全出走者に配るので釣り合う）。

`computeWorldRank` は「自分より wp が多い選手の数＋1」なので、これは**自分だけが
一方的に世界ランクを上げられる**状態を意味する。

**実測（`w84_wp.mjs`）**：チームTTの `wpGain` は最下位の9位でも G1=4／G3=17。
20回走ると、⚠️**最悪でも累計199pt、全勝なら774pt が誰にも追随されずに入る。**

### 修正方針

`mlUpdateRiderStats` に**「順位の質は積まない」モード**を足し、チームTTで呼ぶ。

```js
// domain/mylife/worldRank.js
export function mlUpdateRiderStats(prev, rankedEntrants, teammateIds, year, grade, classMul, opts = {}) {
  // opts.teamResult === true のとき：races と wp と byYear.races だけ積み、
  // wins / podiums / top10 / bestRank / byYear.wins / byYear.podiums は積まない。
```

**なぜ wins/podiums を積まないか**：チームTTは9チーム制で1チーム4〜7名なので、
1位チームの全員に `wins += 1` を与えると、⚠️**1レースで5〜6人の「優勝者」**が生まれ、
成績画面の通算勝利数がチームTTだけで水増しされる。一方 **wp は積まないと世界ランクが
片務になる**ので、wp だけは全員に配る。

**呼び出し**（`mlFinishTeamTT` 内）：

```js
// 各選手の「順位」はその選手が所属したチームの順位。
const ttEntrants = teams.flatMap(t => t.riders.map(r => ({ ...r, rank: t.rank })));
const riderStats = mlUpdateRiderStats(s.riderStats, ttEntrants, teammateIdSet, s.year,
  race.grade, CLASSES[s.classIdx].prizeMul, { teamResult: true });
const worldRank = computeWorldRank(riderStats, worldPoints);
```

`teammateIdSet` は `mlFinishRace` と同じ
`new Set([...(s.teammates||[]).map(t=>t.id), ...(s.protege ? [s.protege.id] : [])])`。

⚠️**計測必須（§10）**：修正前後で「12年キャリア中、チームTTを毎回選んだ場合の最終世界ランク」
を比較し、この弾に記録する。

## ①-4 スコープ外（今回は入れない・DEVLOG「次のアクション」へ上げる）

合意した①は**人気度・絆・成績台帳**なので、以下は今回触らない。

- **`careerWins` / `careerBigWins` / `careerTitles` / `careerClassics`**
  ——チームTTの勝利は個人の勝利ではない、というユーザーの判断どおり据え置き。
- **`managerEval`（監督評価）**——通常レースは監督指示（`MANAGER_DIRECTIVES`）の達成/未達で
  ±する仕組みで、指示文はすべて個人順位を前提にした文言（「エースとして表彰台を狙え」等）。
  チームTTに当てるには**指示カード側の設計から要る**ので別件。
- **`log`（月間ログ）／`newspaper`（号外）**——号外は「大勝・連勝」の演出で個人成績が前提。

## UI：結果画面に1行だけ足す（CLAUDE.md §8）

追加するのは `screens/mylife/race.jsx` のチームTT結果ブロック（「この一戦の成果」）に
**人気度の1行のみ**。絆・成績台帳・世界ptは既存の見え方のまま（絆は別画面、世界ptは
既存の「世界ランキング」行の detail に出ている）。

**現状**

```
この一戦の成果
  獲得ポイント     +18pt
  賞金            +42万円
  世界ランキング    38位
                  52位から上昇——ランキングpt +9
```

**変更後**

```
この一戦の成果
  獲得ポイント     +18pt
  賞金            +42万円
  人気度          +1.2
  世界ランキング    38位
                  52位から上昇——ランキングpt +9
```

到達ボーナスが出た回のみ、通常レースと同じ detail が付く：

```
  人気度          +2.4
                  個人スポンサー契約ボーナス +150万円
```

**実装は通常レース側（race.jsx:181-183）と同一のJSXを使う**（`popGain > 0` のときだけ表示・
`valueColor` は `T.color.accent`）。位置は「賞金」の直後、「世界ランキング」の前
——通常レース側の並び（ポイント→賞金→…→人気度）ではなく**賞金の直後**に置くのは、
チームTT画面には間に挟まる項目（事前予想・監督指示・コースレコード）が無く、
金銭系（賞金）と名声系（人気度）を隣接させたほうが読み下しやすいため。

**空状態**：`popGain` は最低でも `0.1 × GRADE_MUL` で必ず正になるため、行が消える
ケースは無い。ただし通常レース側と同じ `popGain > 0` のガードは残す。

## 実装順（この順でないと計測が濁る）

1. `applyPopGain` 切り出し ＋ `mlFinishRace` を置き換え（**挙動不変**であることを確認）
2. `mlFinishTeamTT` に人気度・アンビション判定を追加
3. `bonds.js` の `sim.ranked || sim.entrants` フォールバック ＋ `mlFinishTeamTT` で絆更新
4. `buildMyLifeSim` の `playerChemMul` 巻き上げ → **絆0/満での順位分布を計測**
5. `mlUpdateRiderStats` の `teamResult` モード ＋ `mlFinishTeamTT` で台帳更新
   → **世界ランクのbefore/afterを計測**
6. UI 1行追加
7. 実機で1レース走らせて確認
