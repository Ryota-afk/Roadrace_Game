# 第42弾（設計）: バッジ Phase 4 — 使用量を効果と退行へ接続する

2026-08 設計。第41弾（§72）でレース選択が入り、Phase 4の前提（プレイヤーが地形を選べる）が
整ったので着手する。

## 発見：既存バグ — マイライフでは`escape`/`rouleur`が経験で取得できない

`sim/buildMyLifeSim.js:231` は逃げ作戦（`ML_TACTICS.early`＝`playerBreakaway`）のとき
`playerRole = "breakaway"` を設定している。しかし `controllers/mylife/result.js:65` は
`raceLog` の `role` を**監督指示のキー**から作る：

```js
const role = assistChosen ? "support" : (directive ? directive.key : (me.isAce ? "ace" : "support"));
```

監督指示のキーは `ace` / `breakthrough` / `support` / `experience` の4つだけなので、
**`role`が`"breakaway"`になることが一度もない**。したがって
`escape`（逃げ役3回で解放）と`rouleur`（逃げ役5回で金）は、マイライフでは
**配合・ランダム取得でしか手に入らない**。

⚠️ これは第41弾で「プレイヤーが選べるのは役割だけ」と整理した、その数少ない経路の
2/3が実は死んでいたということ。`domestique`だけは監督指示の`support`/`experience`が
`ASSIST_ROLES`に含まれるため機能している。

**修正**（`assistChosen`が既にやっているのと同じ形にするだけ）：
```js
const breakawayChosen = !!(ML_TACTICS[s.tactic] && ML_TACTICS[s.tactic].playerBreakaway);
const role = assistChosen ? "support"
  : breakawayChosen ? "breakaway"
  : (directive ? directive.key : (me.isAce ? "ace" : "support"));
```

## 正規化：バッジごとの`base`/`target`で「0=無頓着 / 1=狙い続けた」に揃える

第41弾でレース選択が入ったので、**狙って選んだ場合の露出率**を実測できるようになった。
12年×3クラス、N=8の窓を全時点でサンプリングした平均：

| バッジ | 理論最大 | 狙う | 無頓着 | 分離幅（正規化後） |
|---|---|---|---|---|
| mount | 1.00 | 0.50 | 0.23 | 0.23 |
| puncheur | 0.60 | 0.37 | 0.24 | 0.24 |
| flatlander | 0.86 | 0.56 | 0.36 | 0.22 |
| sprinter_sp | 0.14 | 0.09 | 0.06 | 0.26 |
| soloist | 1.00 | 0.33 | 0.12 | 0.17 |
| allclimber | 1.00 | 0.71 | 0.47 | 0.22 |

⚠️ **理論最大での正規化は使えない**。分離幅は揃うが絶対値がズレたままで、
`soloist`は狙っても0.33止まり＝一律閾値0.4を置くとTT専門家が永久に届かない。

**採用する式**：
```
score = clamp01((raw - base) / (target - base))
```
`base`＝無頓着に選んだときの平均、`target`＝そのバッジを狙って選び続けたときの平均。
**これで全バッジが「0=無頓着 / 1=狙い続けた」の同じ尺度に揃い、単一の閾値0.5が機能する。**

```js
// domain/mylife/badge.js
// ⚠️TEMPLATESや候補数（mlGenRaceCandidates）を変えたらこの表を測り直すこと。
// ⚠️heavyは下記「heavyの除外」により意図的に含めない（GOLD_REQSに金条件が存在しないため）。
export const EXPOSURE_NORM = {
  mount:       { base: 0.234, target: 0.501 },
  puncheur:    { base: 0.236, target: 0.372 },
  flatlander:  { base: 0.358, target: 0.558 },
  sprinter_sp: { base: 0.057, target: 0.091 },
  soloist:     { base: 0.116, target: 0.327 },
  allclimber:  { base: 0.469, target: 0.710 },
  climbengine: { base: 0.234, target: 0.501 },
};
```

**役割系の定数も実測で確定した。** `mlGenDirective`の分布を12年×12月×3クラス×監督評価4段階
（計1,728通り）で数えたところ：

| 監督指示 | 割合 |
|---|---|
| `breakthrough` | 33.3% |
| `support` | 33.2% |
| `ace` | 17.8% |
| `experience` | 15.7% |

`ASSIST_ROLES`に該当するのは`support`+`experience`＝**48.9%**。したがって：

```js
  // 役割系。作戦で完全に選べる（early=逃げ／assist=アシスト）。
  // escape/rouleurは上記バグ修正が前提（修正前はroleがbreakawayにならず常に0）。
  escape:      { base: 0.000, target: 1.000 },
  rouleur:     { base: 0.000, target: 1.000 },
  // domestiqueは監督指示由来のsupport/experienceも数えるため無頓着でも0.489出る（実測）。
  domestique:  { base: 0.489, target: 1.000 },
```

⚠️ `domestique`の`base`が0.489と高いのは仕様どおり。正規化により
「作戦でアシストを選び続けた選手だけがscore 1.0に届く」形になる。

## 段階モデル：累積実績が天井、露出率が現在値

**`GOLD_CONDITIONS`（累積実績）は天井を決め、`exposureScore`は現在値を決める。**

| 累積実績 | `score >= 0.5` | 現在の段階 |
|---|---|---|
| 未達 | — | 銅 |
| 達成 | いいえ | 銅 |
| 達成 | はい | **金** |

- **天井（実績）は永久に落ちない。** 山岳で5勝した事実は消えない
- **走り方を変えると現在値が落ち、戻せばすぐ金に戻る**（2K24の「落ちた分は初回より早く
  取り戻せる」に対応。天井の再取得が要らないため自然にそうなる）
- ⚠️ **金になる条件が現行より厳しくなる**（実績だけでは足りず露出率も要る）＝
  **プレイヤーが弱くなる方向の変更**。したがって「AIにも段階を配る」（合意済み）は
  この弾では不要で、段階をC〜Sへ拡張して効果を伸ばすPhase 6とセットにするのが正しい。

## 体質12種の扱い（確定）

**段階制（露出率・退行）の対象外にするだけで、既存の取得経路・通常/金は据え置く。**
`iron`（出走15回で解放）・`sponge`（出走20回で金）はそのまま残す——
体質だからといって「走り込んで鉄人になる」経路まで奪う理由がない。
⚠️ この弾ではデータ上の分離のみ（`BADGE_KIND`のような区分を持たせる）。
**UIでの分離表示は§8のモック提示が要るため別弾**（下記「この弾でやらないこと」）。

## この弾の範囲

**やること**
1. `escape`/`rouleur`のバグ修正（`role`に`breakaway`を記録する）
2. `EXPOSURE_NORM`＋`badgeExposureScore(player, id, n)`（0..1）
3. 役割系の`base`を修正後に実測して埋める
4. 段階判定 `badgeTier(player, ml, id)` → `"金" | "銅"`
5. **効果への接続**：`hasGoldAbility`を段階判定ベースへ差し替え（体質12種は現行のまま）
6. **所持上限3個の撤廃**（歯止めが退行に置き換わるため。第39弾で「使用量・退行とセット」と合意済み）
7. 選手画面のバッジ一覧に現在の段階と露出率を表示

**やらないこと（後続）**
- 段階のC〜S拡張＋AIへの段階配布（Phase 6・効果を伸ばすときにセットで）
- 33種への解放経路拡張（Phase 5）
- 体質12種のUI分離（§8のモック提示が必要）

## 確定した方針（2026-08・ユーザー合意済み）

- ✅ **段階モデルは「累積実績＝天井／露出率＝現在値」**（金の条件が現行より厳しくなることを含めて了承）
- ✅ **ウィンドウは N=8**
- ✅ **所持上限3個の撤廃は次弾へ回す**——退行の効き具合を実プレイで見てから外す。
  この弾では上限3個を維持したまま退行だけを入れる

したがって**この弾の「やること」6番（所持上限の撤廃）は範囲外**に変更。

## UIの状態（全列挙）

第39弾で作った選手画面のバッジ一覧（右端＝段階欄）をそのまま使う。新しく増えるのは
**状態C（実績は満たしているが走り方が離れていて銅）**の1つだけ。

| 状態 | 条件 | 右端（段階欄） | 補足行 | バー |
|---|---|---|---|---|
| A | 実績未達 | `銅` | `効果　　金まで {cur}/{need}{unit}` | 金色（実績への進捗） |
| B | 実績達成 & score>=0.5 | `金` | `効果` | なし |
| **C（新）** | 実績達成 & score<0.5 | `銅` | ？（下記モックで決める） | ？ |
| D | 金条件を持たないバッジ | `銅` | `効果` | なし |
| E | 体質12種 | 現行のまま（段階制の対象外） | 現行のまま | 現行のまま |

⚠️ 状態Cで**生の露出率（0.42等）は出さない**——開発上の数値であってプレイヤーに伝わらない
（CLAUDE.md §7「開発上の語彙をユーザーに見せていないか」）。伝えるべきは
「実績は足りている／走り方が離れているので今は銅／戻せば金に戻る」の3点。

## 状態Cのモック提示とユーザーの指摘

案1（実績への進捗バーと同じ位置に「山から離れている」とaction色のバーで出す）・
案2（言葉だけ）・案3（段階欄のみ「金→銅」）の3案を提示。ユーザーの指摘：
「案1 山から離れているは何？」——**造語であり初見のプレイヤーに伝わらない**という、
CLAUDE.md §7への直接の指摘。

**確定した対応**：
- `src/data/course.js`の`SEG_LABEL`（既存の地形名語彙：山岳・丘陵・平坦・ゴールスプリント・
  山頂フィニッシュ・TT区間）をそのまま使う。新しい言葉を作らない。
- 文言は状態A「金まで {cur}/{need}{unit}」と同じ形に揃える：
  **「金に戻るまで {地形/役割名} あと{n}回」**
- 地形名は`TERRAIN_EXPOSURE[id]`のsegType配列からSEG_LABELを引いて機械的に導出する
  （山頂フィニッシュ(mtn)は山岳(climb)に畳んで表示。例：mount/climbengine→「山岳」、
  allclimber→「丘陵・山岳」）。役割系（escape/domestique/rouleur）は既存の作戦名の語彙に
  合わせ「逃げ」「アシスト」を手書きで対応させる。
- **色**：バーの色はCLAUDE.md §9により`action`（操作専用）を使わず、状態Aと同じ`accent`
  （データ強調）にした——このバーはクリックできない受動的な進捗表示であり、§9の
  「同じ色を両方の役割で兼任させない」の裏返しとして、action色を非操作要素へ流用しないため。
  モック案1のaction色指定はこの理由で採用しなかった。
- **「あと{n}回」の算出**：直近N=8件の窓の中身をそのまま使い、寄与が低い（＝その地形/役割に
  最も遠い）レースから順に「その地形/役割に100%該当する仮想レース」へ1件ずつ置き換える
  シミュレーションを行い、置き換えるたびにスコアを再計算、score>=0.5を初めて超えた時点の
  置き換え回数を返す。寄与の低い順に置き換えるのは、線形な合計しきい値に対して常に最少手数に
  なるため（貪欲法が最適）。1〜N=8の範囲に収まる（実装：`swapsToRestoreGold`）。

## heavyの除外（発見・確定）

`heavy`（bad特性、山岳区間で常に-4）は第40弾で`TERRAIN_EXPOSURE`（露出計測）に含めたが、
**`GOLD_REQS`に金条件そのものが存在しない**（`sim/effects.js`でも`hasGoldAbility`の分岐が
一切ない、常に固定-4）。「金に戻る」という状態Cの前提が成立しないため、
**`EXPOSURE_NORM`（段階制）には含めない**——`TERRAIN_EXPOSURE`での露出計測自体（将来利用の
可能性を残す）とは分離して扱う。UI・効果のどちらにも段階制としては接続しない。

## 実装結果（2026-08・Sonnet）

**やったこと（「この弾の範囲」1〜5・7を実施。6は前述のとおり範囲外）**

1. `src/controllers/mylife/result.js`: `breakawayChosen`を追加し、`role`の判定に
   `breakawayChosen ? "breakaway"`を割り込ませてバグ修正。
2. `src/domain/mylife/badge.js`: `EXPOSURE_NORM`（7種・heavy除外）、
   `badgeExposureScore(player, id, n=8)`（0/無頓着〜1/狙い続けたの正規化スコア）、
   `badgeTier(player, id, n=8)`（実績×スコアで"金"|"銅"を返す。EXPOSURE_NORM未定義の種は
   従来どおり実績のみ＝永続金）、`liveGoldAbilities(player)`（goldAbilitiesのうち今も
   金として発火してよいものだけへ絞る）、`badgeReturnLabel(id)`（SEG_LABEL由来の地形名／
   役割名）、`swapsToRestoreGold(player, id, n=8)`（状態Cの「あと{n}回」算出）を追加。
   `badgeExposure`のデフォルト窓を10→8へ変更。
3. 役割系の`base`はresult.jsの修正を前提に実測済み（既に本ファイルに記載の値をそのまま採用）。
4. `badgeTier`が段階判定そのもの。
5. **効果への接続方法（設計時点の想定から変更）**：当初は`hasGoldAbility`の47箇所の
   呼び出し個々を書き換える想定だったが、実際にはマイライフの選手エンティティを組み立てる
   `src/sim/buildMyLifeSim.js`の1箇所（`riders.push({... goldAbilities: player.goldAbilities ...})`）
   だけが人間プレイヤーの`goldAbilities`をsimへ渡す唯一の経路だと判明した。そこを
   `liveGoldAbilities(player)`に差し替えるだけで、`sim/effects.js`・`sim/ticks.js`の
   47箇所の`hasGoldAbility`呼び出しは一切変更せずに済んだ（呼び出し側は変わらず
   `r.goldAbilities.includes(id)`を見ているだけなので、そこに渡す配列を絞ればよい）。
   AI・ライバル・レジェンドの`goldAbilities`はこの弾では触っていない（各自の生成箇所で
   従来どおり自分の`goldAbilities`を直接渡しており、Phase 6まで意図的に据え置き）。
   breeding.js・panels.jsx（図鑑）等、`hasGoldAbility`を実績の意味で参照する箇所も無変更。
7. `src/screens/mylife/rider.jsx`: 状態Cの行を追加。実績(`golds.has(id)`)は満たすが
   `badgeExposureScore>=0.5`でない場合、段階欄は「銅」のまま、補足行に
   「{効果}　　金に戻るまで {地形/役割名} あと{n}回」、バーは`accent`色で
   `min(100, score/0.5*100)%`（状態Aの「しきい値までの距離」と同じ考え方）。

**確定した文言・配色の変更点（設計から実装までの間の決定）**
- 状態Cの文言はモック案1の「山から離れている」ではなく、ユーザー指摘を受けて
  「金に戻るまで {地形/役割名} あと{n}回」に確定（本ファイル上記「状態Cのモック提示と
  ユーザーの指摘」参照）。
- 状態Cのバー色は案1のaction色ではなくaccent色に変更（CLAUDE.md §9のaction=操作専用ルールに
  抵触するため、実装時に自己修正。ユーザーへの再確認は行っていない——色相ルールの機械的な
  適用であり新しいデザイン判断ではないため）。

**検証**
- `npx vite build`：エラーなし。
- Node単体テスト（`badgeExposure`/`badgeExposureScore`/`badgeTier`/`swapsToRestoreGold`/
  `liveGoldAbilities`/`badgeReturnLabel`）：無頓着→銅・狙い続け→金・中間状態のswaps数・
  役割系の計算・未達成なら常に銅・heavyがEXPOSURE_NORM対象外・未分類種(closer等)は
  従来どおり実績のみで金、をいずれも期待どおりに確認。
- レガシーセーブ相当（`goldAbilities`欠落・`raceLog`に`segMix`が無い旧エントリ）でも
  クラッシュせず銅にフォールバックすることを確認（無移行で保護）。
- Playwrightで実際にマイライフを開始し、選手の`goldAbilities`と`raceLog`（平坦8戦・
  山岳露出0）を直接注入して選手画面を開き、実際のUIに
  「山岳・山頂フィニッシュ区間で能力+4　　金に戻るまで 山岳 あと3回」が表示され、
  ページエラーが出ないことを確認（単体テストで別途出した「swaps=3」と一致）。
- Playwrightで「早めに逃げる」作戦を実際に選んでレースを1本完走し、`raceLog`の
  最新エントリの`role`が`"breakaway"`になっていることを確認（バグ修正の実地検証）。

**やらなかったこと（設計どおり）**
- 所持上限3個の撤廃（次弾へ）。
- AIへの段階配布（Phase 6・効果拡張とセット）。
- 33種への解放経路拡張・体質12種のUI分離（後続弾）。
