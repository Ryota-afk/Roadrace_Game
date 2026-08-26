# 第57弾：勝負所のカードから「不発」を廃止する

**状態**：**完了**（設計・実装・検証とも完了・2026-08）。

実機を1レース通しで遊んで見つけた問題を直す弾。数値ではなく画面から出発している。

---

## 実機で見えたこと

勝負所のカードで、3択のうち2つが「不発」でグレーアウトし、実質「集団で勝負」の1択に
なっていた（スクリーンショットは`scratchpad/shots/14_decision_card.png`）。

## 実測1：勝負所は3回に1回以上、実質1択になっている

`scratchpad/w57_cards.mjs`（マイライフ・5テンプレート×n=40・主力power74）：

| カード | 選択肢 | 生きている数 | 不発率 | **実質1択の割合** | その時の脚 |
|---|---|---|---|---|---|
| mid（中盤） | 3.00 | 2.85 | 5.2% | **0.0%** | 0.523 |
| **finale（勝負所）** | 3.00 | **2.27** | **24.3%** | **36.5%** | **0.237** |

中盤は健全で、問題は勝負所に集中している。原因は構造的で、勝負所の3択は
`kick`／`send`／`hold`だが、**残脚スケール対象（`LEGS_SCALED_MOVES`）でないのは`hold`だけ**。
脚が減ると必ず`hold`だけが残る。

## 実測2：「不発」は事実に反している

`moveEdge.js`の冒頭コメントは**「sim本体と同じ`legsLeft01`を使い、表示と実際の挙動を
食い違わせない」**と宣言しているが、`不発`ラベルはまさに食い違わせていた。

| 一手 | 脚が空(g=0)でも | 不発の閾値(g=0.15)で |
|---|---|---|
| `kick`（差しにかける） | 最大の**27%** | **38%** |
| `kickBig`（会心の差し） | **29%** | **40%** |
| `sprintWait`（スプリント勝負） | **31%** | **41%** |
| `send`（早駆け・追い込み量） | **23%** | **35%** |

**「今は効かない」と表示しながら、実際は3〜4割効いている。** どの一手も効果に下限
（`KICK_MIN`等）があるため、**効果が0になる状態はそもそも存在しない**。

---

## 確定仕様（ユーザー合意済み）

### 1. `moveEdge.js`：`不発`を廃止する

```js
// 変更前
export function moveEdge(moveId, energy) {
  const g = legsLeft01({ energy });
  const base = moveTierBase(moveId);
  const dud = LEGS_SCALED_MOVES.has(moveId) && g < DUD_THRESHOLD;
  return { tier: dud ? "dud" : base, g };
}
// 変更後
export function moveEdge(moveId, energy) {
  const g = legsLeft01({ energy });
  return { tier: moveTierBase(moveId), g, legsScaled: LEGS_SCALED_MOVES.has(moveId) };
}
```

- `DUD_THRESHOLD`（0.15）は**削除**する。
- `LEGS_SCALED_MOVES`は**残す**（`legsScaled`の判定に使う）。
- 冒頭コメントのレア度一覧から`不発`の行を削除し、廃止の根拠（上の実測表）を書く。

### 2. `DecisionCard.jsx`：グレーアウトを撤去し、脚依存の一手にだけバーを出す

**撤去するもの**（`CardButton`）：
- `const dud = tier === "dud";`
- `opacity: ... (dud ? 0.45 : 1)` と `filter: dud ? "saturate(.3)" : "none"`
- ラベルの `color: dud ? T.color.sub : T.color.text`（常に`T.color.text`にする）
- `不発`バッジの`<span>`ブロックまるごと
- `CardGlow`の `if (tier === "dud") return null;`（`不発`が無くなるため、虹／金の発光は常に出る）

**足すもの**：`legsScaled`が真の選択肢にだけ、ラベルの下に細いバーを1本置く。

- 値は`g`（`legsLeft01`）。**脚バーと同じ量**なので**同じ色段階**を使う
  （これで「上の脚バーと同じ数字だ」と一目で繋がる）。
- 高さ**3px**（上の脚バーは6px＝主、こちらは従）。幅はボタン内側いっぱい。
- 背景は`T.color.surface`（ボタン地の`surfaceUp`より暗い＝残量が読める）。
- **脚に依存しない一手（`hold`/`conserve`/`hangOn`等）にはバーを出さない。**
  ユーザー確認済み：出さないほうが「この2つは脚次第／これは脚に関係ない」の差が読める。

⚠️色段階は`LegsBar`と**二重管理にしない**（CLAUDE.md §5）。`LegsBar`内のtier判定を
`legsTier(energy)`のような小さなヘルパーへ括り出し、バー側と共用する。

### 3. 文言：「売り切れ」をやめる

ユーザー指摘「脚が売り切れるという言い回しは変」。

| 箇所 | 現状 | 変更後 |
|---|---|---|
| `DecisionCard.jsx` 脚バー最下段 | 売り切れ | **限界** |
| `raceDecisions.js` `react`副題 | 脚が**売り切れかけている**——粘るか、立て直すか | 脚が**尽きかけている**——粘るか、立て直すか |

段階は `十分 → やや消耗 → 苦しい → 限界`（境界は現行のまま raw 40／0／−60）。

内部コメントの「売り切れ」も併せて直す（`ticks.js`の`LEGS_EMPTY`付近と`send`の説明、
`moveEdge.js`、`raceDecisions.js`の`buildDecisions`内）。⚠️特に`ticks.js`の
「売り切れた脚での早駆けは**不発に終わる**」は**事実として誤り**（実測23%）なので、
表現を実態（効果が下限まで落ちる）に合わせる。

---

## やらないこと

- ⚠️**simには一切触らない。** `RACE_MOVES`・`legsLeft01`・各moveの定数（`KICK_MIN`等）は
  すべて無変更。**`hold`の基準点もレースの形も動かない**（第53〜55弾で3回壊した領域）。
- カードの**選択肢の中身は変えない**。`composeCard`の分岐追加（脚が無いとき別の一手を出す）は
  この弾ではやらない——既存の`react`カード「苦しい局面／脚が尽きかけている」とほぼ同じ顔に
  なるため。効果を見てから別途判断する。
- **プレイヤーの`attack`が単独で飛び出す件**はこの弾では扱わない（→第58弾）。

---

## 検証項目

1. `moveEdge`が**どのmoveId・どのenergyでも`"dud"`を返さない**こと（全moveId×energy −100〜100）。
2. `legsScaled`が`LEGS_SCALED_MOVES`の内容と一致すること
   （`attack`/`send`/`kick`/`kickBig`/`sprintWait`/`tempo`が真、`hold`/`conserve`/`hangOn`等が偽）。
3. 脚バーの段階が **十分／やや消耗／苦しい／限界** になること（境界値 raw=40／0／−60／−61 で確認）。
4. `src/`にユーザー可視の「売り切れ」「不発」が**1件も残っていない**こと（`grep`で機械確認）。
5. 既存検証スクリプトの差し替え：`w51_verify.mjs`・`w52_verify.mjs`の`tier === "dud"`判定を
   `legsScaled`の検証へ置き換える（⚠️「脚が無くても`dud`にならない」ことを確かめる形にする）。
6. 第46〜52弾の既存検証スクリプトが全て通ること。
7. `npx vite build`成功・Playwrightで`pageerror`ゼロ。
8. ⚠️**実機でカードを表示し、スクリーンショットで確認する**：
   グレーアウトが消えて**3択すべて押せる**こと／バーが**脚依存の2つにだけ**出ていること／
   脚バーの語が「限界」になっていること。⚠️数値の検証だけで終わらせない。

## 実装結果（Sonnet・2026-08）

仕様どおり4ファイルを変更：`moveEdge.js`（`dud`/`DUD_THRESHOLD`を廃止し
`{tier, g, legsScaled}`を返す・`LEGS_SCALED_MOVES`をexport）、`DecisionCard.jsx`
（グレーアウト・彩度低下・不発バッジを撤去、`legsTier(energy)`を1箇所に括り出して
`LegsBar`と選択肢の残量バーで共用、脚依存の一手にだけ細いバーを追加）、
`raceDecisions.js`（`react`副題「脚が尽きかけている」）、`ticks.js`（「売り切れ」
「不発」を使った誤った説明3箇所をコメントとして訂正）。simの計算式・定数は無変更。

新規`w57_verify.mjs`で検証項目1〜4を機械確認（全moveId×energyでdud無し・
legsScaledの一致・legsTierの境界値・srcにユーザー可視の「売り切れ」「不発」が0件）、
既存の`w51_verify.mjs`検証7・`w52_verify.mjs`検証5を`legsScaled`ベースへ差し替えて
全通過（検証項目5）。第46〜52弾の既存検証・`npx vite build`も通過（検証項目6〜7）。

⚠️実機確認（検証項目8）：マイライフでヒルクライムを最後まで再生し、勝負所の
カード（`kick`/`send`/`hold`）が脚「苦しい」の状態でも**3択すべて押せる**こと、
`kick`と`send`にだけ細い残量バーが付き`hold`には付かないこと、`pageerror`ゼロで
結果画面まで到達することをスクリーンショットで確認した。

---

（この弾の着手時に保留した「仕掛けに仲間が乗る」は**第58弾**として起こした＝`devlog/wave58.md`）
