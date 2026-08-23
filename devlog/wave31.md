# 第31弾: AIの成長上限を能力別にする（完了）

2026-08。DEVLOG §62の詳細記録。第29弾で「140の頭」を超えるようになった件について、ユーザーの
「周りの選手もついてくるなら問題ない」という条件提示から調査を開始した。

## 診断（実測）

### 1. 普通のAI選手はついてこない

`mlAiCapFor` は難易度ごとの**固定値**で、年数・実績・プレイヤーの上限のいずれにも連動しない。

| 難易度 | AI上限 | 12年目クライマーの登坂上限 | 差 |
|---|---|---|---|
| easy | 92 | — | — |
| normal | **96** | 150 | **+54** |
| hard | 102 | — | — |
| oni | **112** | 130.5 | **+18.5** |

normalは5年目で+28、12年目で+54。oniは1年目こそAIが上（−12）だが17年目には+29。
**この差は第29弾が作ったものではない**（以前から+44あり、第29弾が足したのは得意軸の+10のみ）。

### 2. 唯一ついてくる経路＝殿堂選手

伝説選手だけが`aiCap`を通らず`finalAbilities × 衰え係数`で登場する（`buildMyLifeSim.js:193`は
`newRider`の結果を上書きするため、クランプの後）。プレイヤーが強い選手を育てるほど世界が
強くなる設計になっている。

| 引退時の育ち方 | 再登場時 |
|---|---|
| そこそこ（平均96） | 78〜86 |
| 12年目まで育成（平均122） | 91〜125 |
| カンスト級（平均141） | 105〜123 |

ただし限界が3つ：**衰え係数の下限が0.82**（どれだけ育てても全盛期の82%止まり＝本人には
構造的に追いつけない）／出現は**1レースあたり期待値0.74人**（45%は0人）／自チーム・
ライバル以外のエース枠のみ。

### 3. 副産物として見つかった問題（本弾の主目的）

`newRider`は脚質ごとに能力の形を付けている（`core.js:219-223`、`bo=14`）。
**ところが`cap`が全能力へ一律にかかるため、上限が効く場面では得意能力だけが切り落とされ、
苦手能力はそのまま残る。**

| 脚質 | 素の平均（上限なし） | aiCap=96 適用後 |
|---|---|---|
| CLM | flat 95.9 / **climb 109.9** / sprint 87.2 | flat 95.9 / **climb 96** / sprint 87.2 |

結果、**AIのクライマーが万能型に見える**。判断③（第29弾）でプレイヤー側について直したのと
同じ病気が、AI側に残っていた。

## 決定（ユーザー合意）

**`aiCap`を能力別にする。** `ML_TYPE_CAP_OFFSET`（第29弾でプレイヤー用に定めた表）をAI側にも
適用し、`aiCap + オフセット`を能力ごとの上限とする。表は新設せず既存のものを共有する
（CLAUDE.md §5「写経して増やさない」）。

**却下した案**：
- aiCapをプレイヤーの上限に連動：歯応えは最も確実に残るが「周りを抜き去った」達成感を失い、
  難易度設定の意味も薄れる（ゴムひも感）。
- 殿堂の経路を強化（衰え係数の下限を緩める／出現率を上げる）：今回は見送り。
- 現状維持。

## 実測した効果

### 上限が効く場面（高クラス・高グレード）

`normal`（aiCap=96）で平均能力がどう変わるか（4,000体×5脚質）：

| 脚質 | 主武器 | 苦手 | 総合 |
|---|---|---|---|
| SPR | sprint 96→**105** | climb 87→83 | 94.8→99.5 |
| CLM | climb 96→**105** | sprint 87→83 | 94.8→99.5 |
| RUL | flat 96→**105** | climb 93→84 | 95.4→100.3 |
| PUN | climb/sprint 96→**100** | solo 93→84 | 95.4→98.8 |
| TT | solo 96→**105** | sprint 93→84 | 95.4→100.3 |

主武器+9・苦手−4〜−9・総合**+4.5**（全難易度で同じ+4.5）。

### 序盤には一切影響しない（重要）

`power = aiPowerFor(50, classIdx, grade, aiMul)`。低クラスでは`power`が小さく**上限そのものが
効いていない**ため、オフセットを足しても何も変わらない。

| クラス・グレード | power | 総合（現行→提案） |
|---|---|---|
| クラス0 G1 | 50 | 58.5 → 58.5 **変化なし** |
| クラス1 G3 | 67 | 75.5 → 75.5 **変化なし** |
| クラス2 G3 | 76 | 84.3 → 84.5 (+0.2) |
| クラス3 G3 | 85 | 91.4 → 93.1 (+1.7) |
| クラス4 G3 | 94 | 94.8 → 98.9 (+4.1) |

**この変更は自動的に終盤だけに効く**（プレイヤーが周りを抜き去る場面にだけ作用する）。
したがって`aiCap`の下方補正は不要と判断した（総合を現状維持したい場合は各難易度で
aiCapを6下げれば±0になることも実測済みだが、今回は採用しない）。

なお、これで埋まるのは差の一部だけである（normal 12年目で **+54 → +45**）。
「完全に追いつかせる」ものではない点は合意済み。

## 実装仕様

### 1. `ML_TYPE_CAP_OFFSET` を `src/data/abilities.js` へ移す

現在は`src/domain/mylife/growthCap.js`にあるが、AI側の利用者は`src/sim/buildMyLifeSim.js`
（sim層）と`src/domain/shared/scouting.js`（shared）。**sim→domain/mylife、shared→mylifeは
どちらも依存の向きが逆**でCLAUDE.md §5に反する。表は`TYPES`×`AB_KEYS`のリテラルのみで
自己完結しているため、両方が下位から参照できる`data/abilities.js`（`TYPES`・`AB_KEYS`の定義元）
へ移すのが正しい置き場所。

- `data/abilities.js`に`export const ML_TYPE_CAP_OFFSET = {...}`（値は現行のまま）
- `domain/mylife/growthCap.js`は定義を削除し`import`して**再エクスポートを維持**
  （`logic/support.js`が再エクスポートしており、呼び出し側を壊さないため）

### 2. `src/core/core.js` の `newRider` に `opts.capOffset` を追加

**`capFor`コールバック方式は使えない。** `buildMyLifeSim.js:137`の呼び出しは`type`を
指定せず`newRider`内部（`core.js:212`）でランダムに決まるため、呼び出し側は脚質を
知らないまま上限を組み立てられない。表を渡し、脚質確定後に内部で引く形にする。

```js
const cap = opts.cap ?? 94;
const capOff = opts.capOffset || null;          // { SPR:{flat:5,...}, ... }
const capOf = (k) => cap + (capOff ? ((capOff[type] || {})[k] || 0) : 0);
// 216行目の const clamp は廃止し、226行目を次に差し替える
AB_KEYS.forEach(k => r[k] = Math.max(22, Math.min(capOf(k), Math.round(r[k]))));
```
- `type`は`core.js:212`で確定済みなので`capOf`から参照できる。
- `opts.capOffset`未指定なら完全に従来どおり（**シーズン側は無変更**）。
- `clamp`が`core.js`内の他の場所でも使われていないか確認してから消すこと。

### 3. マイライフの全呼び出し側へ `capOffset` を渡す

`src/sim/buildMyLifeSim.js`（`ML_TYPE_CAP_OFFSET`をimport）：

| 行 | 対象 | 現在のcap | 対応 |
|---|---|---|---|
| 104 | 固定チームメイト | 未指定（既定94） | `capOffset`を渡す |
| 112 | 弟子 | `aiCap` | `capOffset`を渡す |
| 119 | 補充チームメイト | 未指定（既定94） | `capOffset`を渡す |
| 129 | ワールドロースター選手 | `aiCap` | `capOffset`を渡す |
| 137 | 補充AI選手 | `aiCap` | `capOffset`を渡す（**type指定なし＝2の方式が必須**） |
| 161 | ライバル | `aiCap` | `capOffset`を渡す |
| 173 | ライバル2 | `aiCap` | `capOffset`を渡す |
| 186 | 伝説選手 | `aiCap` | **渡さなくてよい**（193行で`finalAbilities`に上書きされる） |

**方針：cap がかかる全ての生成に一律で適用する。** チームメイトだけ形が付かないという
新たな例外を作らないため（同じ病気は上限が効く限りどこでも起きる）。

### 4. 表示（査定値）を実挙動と一致させる — 最重要

`scoutedAbilities(rider, power, year, cap)`（`domain/shared/scouting.js`）は内部で
`newRider`を呼び、**レースと同じ式で査定値を出す**契約になっている。ここを揃えないと
「スカウトで見た能力」と「実際に走る能力」が食い違う。

- `scoutedAbilities`に第5引数`capOffset`を追加し、内部の`newRider`へ渡す。
- 呼び出し側`src/domain/mylife/worldRank.js:151`付近の`scoutInfoFor`は、相手チーム（`aiCap`）と
  自チームメイト（既定94）で**capを分けている既存の作り**をそのまま維持しつつ、
  両方に同じ`capOffset`を渡す。

### 5. 影響範囲の確認

- **シーズンモードは無変更**：`mlAiCapFor`はマイライフ専用（シーズンは`diffDef.abilCap`を
  `buildSim`で直接使う）。`newRider`は`capOffset`未指定なら従来どおり。
- 殿堂選手は`aiCap`を通らないので無関係。

## 検証項目

1. `npm run build` が通る。
2. **Node実測（回帰）**：`capOffset`未指定の`newRider`が変更前と完全に同一の出力を出すこと
   （同じseedで全能力一致）。シーズン側が動いていないことの機械的な保証。
3. **Node実測（効果）**：normal/oniで、クラス0〜2は総合が変化せず、クラス4で+4前後になること
   （上表の再現）。
4. **Node実測（形）**：CLMのclimbがaiCap+10まで、sprintがaiCap−12までになること。
5. **一致確認**：`scoutedAbilities`の出力と`buildMyLifeSim`で生成される選手の能力が、
   同じrider・power・year・capで一致すること（査定値と実挙動の食い違いが無いこと）。
6. Playwrightでマイライフを実プレイし、pageerrorゼロ。

## 実装結果（2026-08・Sonnetで実施）

仕様書どおりに実装。変更ファイルは`data/abilities.js`（`ML_TYPE_CAP_OFFSET`の実体を移設）・
`domain/mylife/growthCap.js`（定義を削除しimport＋再エクスポートへ）・`core/core.js`
（`newRider`に`opts.capOffset`対応、`clamp`を`type`確定後に能力別で引く形へ）・
`domain/shared/scouting.js`（`scoutedAbilities`に`capOffset`引数を追加）・
`sim/buildMyLifeSim.js`（伝説選手を除く7箇所の`newRider`呼び出しに`capOffset: ML_TYPE_CAP_OFFSET`
を追加）・`domain/mylife/worldRank.js`（`scoutInfoFor`に同じ表を渡す）の6ファイル。

**検証（全て合格）**：
- Node回帰確認：`capOffset`未指定は5脚質＋未指定typeの全パターンで変更前と完全一致
  （シーズン側の`buildSim.js`は`capOffset`を渡していないことも確認済み＝無影響）。
- Node効果測定：クラス0（G1）・クラス1（G3）は総合が完全に無変化（diff 0.0）、
  クラス4（G3）で総合+4.1（設計時の実測+4.1と一致）。
- Node形状確認：CLM選手の`climb`平均が`aiCap+10`（96→106.00）、`sprint`平均が
  `aiCap-12`（96→84.00）に一致。
- 査定値一致確認：`scoutedAbilities(rider, power, year, cap, ML_TYPE_CAP_OFFSET)`と
  `buildMyLifeSim`内の実際の生成式（同一rider・power・year・cap）が全能力・OVRで完全一致。
- Playwright実プレイ：マイライフでクライマーとしてデビューし、出走表（チームメイト・
  ワールドロースター由来のAI選手を含む）→レース開始→中継画面（先頭集団・俯瞰マップ・
  順位表）まで到達。pageerrorゼロ。`buildMyLifeSim`の主要経路（チームメイト・自チーム補充・
  ワールドロースター）が実際にcapOffset付きで生成され、シミュレーションが正常に完走することを確認。
- `npm run build`成功。

DEVLOG §62を完了に更新。
