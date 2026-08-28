# 第66弾：画面遷移アニメーション（DEVLOG TODO #21）

**状態**：**Phase 1・Phase 2とも実装・検証完了**（2026-08）。

## 発端と、設計を1度作り直したこと

ユーザーが第63弾の時点で後続アクションとして明示した項目（TODO #21）。

⚠️**最初の設計は間違っていた。** 当初は「フェード／持ち上がり／横スライド／段階表示／ワイプ」の
5案から**1つを選んで全画面に一律で当てる**という出し方をした。ユーザーから参考記事
（gameanimation.info）の本文と実例GIF 5点を示された上で
**「アニメーションは一種類のみでなく、使い分けることが重要ではないですか？」**と指摘され、
前提そのものが誤りだったと判明した。

記事の要点のうち、本作に直接効くのは2つ：
- **「理解を助ける」**：リストが上から流れ込むことで「まだ下に続く」と分かる
- **「例外もある」**：読むことが目的の画面は**動かさない方が速くて良い**

⚠️**教訓：遷移アニメーションは「どれを選ぶか」ではなく「どこに何を割り当てるか」の設計である。**

### ⚠️GIFは静止画としてしか届かない（回避策あり）

添付されたGIFは**1コマ目の静止画としてしか見えず**、動きが判別できなかった。
そのため最初の設計は貼られた本文テキストだけを根拠にしており、実例を見ていなかった。

**回避策（確立済み・今後も使う）**：GIFを**base64データURIでHTMLに埋め込み**、
Playwrightで再生させて一定間隔でスクリーンショットを撮る
（`scratchpad/gifframes2.mjs`）。⚠️`file://`のサブリソースはChromiumにブロックされるため
`<img src="file://...">`では読み込まれない——**必ずbase64で埋め込むこと**。
GIFのコマ数・各コマの表示時間はヘッダを走査すれば取れる（LZW展開は不要・`gifframes.mjs`冒頭）。

この方法で5本を確認した結果、⚠️**設計に足りない観点が1つ見つかった**——
「押した要素がそのまま次の画面に育つ」遷移（下記⑤）。

## 実装点の調査結果

| 事実 | 意味 |
|---|---|
| 差し替え点は`chrome.jsx`の`makeWrap`／`makeMetaWrap`／`makeMlWrap`の`{children}`**1箇所ずつ** | ここに`key`付きラッパーを噛ませれば全画面に一度で行き渡る |
| ⚠️`makeMlWrap`ではヘッダーと`BottomTabs`が`{children}`の**外**にある | 本文だけが動きタブは静止する＝**正しい挙動が構造上タダで手に入る** |
| ⚠️`prefers-reduced-motion`は`src`全体で**0件** | 未対応。今回あわせて必ず入れる |
| ⚠️`mlAdvanceMonth`は通常`screen:"mylife_main"`で終わる（`month.js:479,531`） | **遷移前後とも同じ画面ID**。keyに年月を含めないと月送りが発火しない |
| タブ順は`BottomTabs.jsx`の`ML_TABS` | `mylife_main→rider→world→shop→archive`。index差で方向が出る |
| React 18.2.0／`startViewTransition`は利用可（Chrome 141で確認） | ⑤に使える |
| 既存の動きは`RaceView`・`BaseView`・`DecisionCard`・`useIsoCamera`のみ | いずれも画面**内部**の演出。遷移とは層が違うので衝突しない |

## Phase 1（今回実装）：6分類をCSSで割り当てる

⚠️**呼び出し側（画面遷移を起こす約100箇所）には一切触らない。**

### 新規ファイル `src/data/screenTransition.js`

静的な対応表＋自己完結の述語関数のみ（CLAUDE.md §5の`data/`層の条件を満たす。JSXを含まない）。

```
export const TRANSITION = { … }   // 画面ID → 分類
export function transitionKind(prev, next)  // → "slide-l" | "slide-r" | "flow" | "none" | "rise" | "month" | "sweep"
```

### 分類と割り当て（マイライフ35画面すべて）

| 分類 | 対象画面（全列挙） | 動き |
|---|---|---|
| **① タブ間** | `mylife_main` `mylife_rider` `mylife_world` `mylife_shop` `mylife_archive`（5） | 横スライド。`ML_TABS`のindex差で方向を決める。右へ＝右から入る（`translateX(24px)→0`）／左へ＝左から。**200ms** `cubic-bezier(.2,.7,.3,1)`＋フェード |
| **② 長い一覧** | `mylife_ranking` `mylife_worldstats` `mylife_riderstats` `mylife_teamroster` `mylife_legends` `mylife_newspaper`（6） | ⚠️**リスト全体が上から満ちる**。`clip-path: inset(0 0 100% 0)` → `inset(0 0 0 0)`。**300ms** `cubic-bezier(.25,.7,.3,1)`。⚠️行ごとのフェードインではない（ユーザー指定） |
| **③ 読むための画面** | `mylife_help` `mylife_abilityfile` `mylife_factors` `mylife_lineage` `mylife_records` `mylife_achievements` `mylife_graph`（7） | ⚠️**動かさない（0ms）**。記事の「例外もある」。読むのが目的なので最速で出す |
| **④ その他** | `mylife_event` `mylife_event_result` `mylife_protege_event` `mylife_offseason` `mylife_offseason_result` `mylife_crossroads` `mylife_crossroads_result` `mylife_contract` `mylife_retire_advice` `mylife_retired` `mylife_create` `mylife_scout` `mylife_badge_goals`（13） | 持ち上がり。`translateY(7px)→0`＋フェード。**180ms** `cubic-bezier(.2,.7,.3,1)` |
| **⑤ レースの流れ** | `mylife_startlist` `mylife_race` `mylife_result` `mylife_rival_scene`（4） | 横スイープ。`translateX(52px)→0`＋フェード。**300ms** `cubic-bezier(.16,.8,.25,1)`。⚠️①より**大きく・ゆっくり**して「場面が変わった」と分からせる |
| **⑥ 月が進む** | 画面IDではなく**年月の変化**で判定（`ml.year`/`ml.month`） | ヘッダーの年月が先に入れ替わり（`translateY(-4px)`＋`opacity .25→1`・**300ms**）、続いて本文が上から満ちる（②と同じ`clip-path`） |

**優先順位**：⑥（年月が変わった）＞ ②③⑤（行き先の分類）＞ ①（両方がタブ）＞ ④（既定）。

### key の組み立て（⚠️最重要）

```
key={`${ml.screen}:${ml.year}-${ml.month}`}
```
⚠️**画面IDだけでは月送りが発火しない**（前後とも`mylife_main`のため）。
⚠️レース中は`ml.result`が毎tick更新されるが`screen`も年月も変わらないので**keyは安定**＝
アニメが鳴りっぱなしにならない。

### 直前の画面を覚える

`main.jsx`（`makeMlWrap`を呼んでいるコンポーネント）に`useRef`を1つ置き、
`ml.screen`の変化を追って`prevScreen`を`makeMlWrap`へ渡す。
⚠️`useMyLifeGame.js`には触らない（返り値を増やすより呼び出し元1箇所で完結する方が薄い）。

### `prefers-reduced-motion`（⚠️必須・現状0件）

`@media (prefers-reduced-motion: reduce)`で**全アニメーションを`.01s`へ潰す**。
「アニメーションを消す」のではなく「一瞬で終わらせる」——`animation-fill-mode: both`の
終了状態が確実に適用されるため、どのプロパティをanimateしていても最終状態になる。

> ⚠️**訂正（Phase 2の事前検証で判明）**：設計時ここに
> 「`animation: none`にすると`clip-path`が初期値のまま残り**中身が消える**」と書いていたが、
> これは**誤り**。実測（`scratchpad/clip_probe.mjs`）では`animation: none`のとき
> `clip-path`は**`none`（＝クリップなし・中身は見える）**になった。
> `clip-path`の初期値は`inset(0 0 100% 0)`ではなく`none`である。
> `.01s`方式を採る理由は「全プロパティで確実に終了状態になるから」であって、
> `animation: none`が危険だからではない。⚠️**実装は正しく動いており修正不要**——
> 誤っていたのは理由の説明だけ。

### シーズンモードの扱い（判断）

⚠️**上記の分類はマイライフ35画面に対して作ったもの。シーズンの21画面には分類が無い。**
シーズン側（`makeWrap`）には**④の持ち上がりだけを既定として当てる**。
理由：片方のモードだけ動いて片方が静止していると不具合に見えるため。
⚠️シーズンの分類ごとの割り当ては今回のスコープ外（必要ならユーザーの指示で別弾）。

`makeMetaWrap`（モード選択・生涯評価・CP交換所）も同じく④を当てる。

## Phase 2（Phase 1完了後・実装待ち）：押した要素が育つ

**対象は`ホームのレース候補 → 出走表`の1経路のみ**（ユーザー合意）。

### ⚠️事前検証で確定したこと（`scratchpad/vt_probe2.mjs`）

設計時「Phase 1のCSSアニメーションと衝突する」と**推測**で書いていたので、実物で測った。
遷移中に実際に走るアニメーションを`document.getAnimations()`で数えた結果：

| 条件 | 同時に走るアニメーション |
|---|---|
| **A. 何も抑制しない** | ⚠️**11本**（`sweep`＋ルートのクロスフェード4本＋名前付き要素6本） |
| **B. ルートのクロスフェードだけ止める** | 7本（⚠️`sweep`がまだ残る） |
| **C. ルート＋enterアニメの両方を止める** | **6本**（View Transitionsの機構のみ＝これが正解） |

⚠️**推測は正しかったが、Bでは不十分**だった——ルートを止めても
Phase 1のenterアニメ（`ml-enter-sweep`）が残って名前付き要素の変形と喧嘩する。
**必ずCの組み合わせにすること。**

### 実装の具体

1. **ペアにする要素＝レース名**（`view-transition-name: ml-race-name`）
   - 出発側：`hub.jsx`の選択中レース。⚠️ホームは**2レイアウトある**——候補3件の月は
     候補行の`{c.name}`、看板レース月（候補1件）は単一カードの`{race.name}`。
     **選択中のものだけ**に付ける（同じ`view-transition-name`が同時に2つ存在すると
     View Transitionsは例外を投げる）。
   - 到着側：`race.jsx:81`の`{raceMeta.name}`（`T.size.title`の見出し）。
2. **抑制用クラス**：遷移開始前に`document.documentElement.classList.add("vt-active")`、
   `transition.finished`で外す。CSSは`transitions.css`へ：
   ```
   .vt-active::view-transition-old(root),
   .vt-active::view-transition-new(root) { animation: none; }
   .vt-active [class^="ml-enter-"] { animation: none; }
   ```
   ⚠️`animation: none`で問題ないことは実測済み（上記の訂正を参照）。
3. **React 18**：`document.startViewTransition(() => flushSync(() => mlStartRace()))`。
   `flushSync`は`react-dom`からimportする。
4. **フォールバック**：`document.startViewTransition`が無いブラウザでは
   そのまま`mlStartRace()`を呼ぶだけ（Phase 1の`sweep`が効く）＝実害なし。
5. ⚠️**この経路だけ呼び出し側に手が入る**（`hub.jsx`の出場ボタン）。他は無変更のまま。

### ⚠️Phase 2で注意すべき既知の罠

- ⚠️`prefers-reduced-motion`時はView Transitions自体を**使わない**
  （`matchMedia("(prefers-reduced-motion: reduce)").matches`で分岐）。
  `.01s`に潰す手はView Transitionsの擬似要素には効きにくく、
  変形の途中状態が一瞬見えるより最初から使わない方が確実。
- ⚠️`mlStartRace`は内部でレースsimを構築する（`buildMyLifeSim`）。`flushSync`の中で
  重い同期処理が走ると変形の開始が遅れる可能性がある。実機で引っかかりが出たら
  「先にsimを作ってから`startViewTransition`で画面だけ切り替える」順序に変える。

## やらないこと

- ⚠️simの計算・バランスには一切触れない
- `RaceView`・`BaseView`・`DecisionCard`の**画面内部の演出**には触らない（層が違う）
- シーズン21画面の分類ごとの割り当て（Phase 1では既定の④のみ）
- 遷移の呼び出し側（約100箇所）——⚠️Phase 2の1経路を除く

## 検証項目

### Phase 1
1. タブを右へ移動すると右から、左へ移動すると左から入る（`ML_TABS`の順）
2. 世界ランキング等の一覧が**上から下へ満ちる**（行ごとのフェードインになっていない）
3. 遊び方・図鑑・記録は**まったく動かない**（0ms）
4. ⚠️**練習／完全休養を押して月が進んだとき**、ヘッダーの年月が先に入れ替わり本文が満ちる
   （＝keyに年月が入っていることの確認。⚠️ここが動かなければkeyの組み立てが誤り）
5. ⚠️**レース中にアニメが再発火しない**（毎tickの更新でkeyが変わっていないこと）
6. レースの流れ（出走表→レース→リザルト）が①より大きくゆっくり動く
7. シーズン側・モード選択でも既定の④が効いている
8. ⚠️OSの「視差効果を減らす」をONにすると全て一瞬で終わり、**中身が消えない**
9. 既存回帰（w46〜52・w57〜60）全通過・`npx vite build`成功・`pageerror`ゼロ
10. ⚠️実プレイのスクリーンショットで確認

### Phase 2
11. ホームで選んだレースのカードが出走表へ育つ
12. ⚠️その経路でルートのクロスフェードが二重に走っていない
13. 他の遷移がPhase 1のまま壊れていない

## Phase 1 実装結果（Sonnet）

### 新規ファイル

- **`src/data/screenTransition.js`**：設計どおりの純データ＋述語関数。
  `ML_TABS_ORDER`・`LIST_SCREENS`・`READ_SCREENS`・`RACE_FLOW_SCREENS`の4つの静的集合と、
  `mlScreenCategory(screen)`・`mlTransitionKind({ prevScreen, nextScreen, monthChanged })`の
  2関数のみ。JSXなし。
- **`src/styles/transitions.css`**：6種のkeyframesと`.ml-enter-*`クラス、
  `prefers-reduced-motion`の`@media`ブロック。`main.jsx`から`fonts.css`と同じ形でimport。

### 変更ファイル

- **`src/components/chrome.jsx`**：
  - `makeWrap`（シーズン）・`makeMetaWrap`（モード選択等）は`opts`不要の既定
    `ml-enter-rise`のみ。`makeWrap`は`key={g.screen}`、`makeMetaWrap`は`key={String(superMode)}`
    （`superMode`の値そのものがrenderMetaScreensの分岐と一致するため画面識別子として使える）。
  - ⚠️`makeWrap`の`opts.fill`（拠点のアイソメ画面が使う縦フレックス）を壊さないよう、
    追加した遷移用`<div>`にも`opts.fill`時は`flex:1, minHeight:0`を伝播させた
    （素朴に挟むとBaseViewの残り高さ確保が崩れるところだった）。
  - `makeMlWrap`は`transitionInfo={ enterKey, kind }`を**そのまま受け取るだけ**にした
    （後述の理由でkind算出はmain.jsx側に移した）。ヘッダーの年月`<span>`にも
    `kind==="month"`のときだけ`ml-year-pulse`と`key={year-month}`を付けた。
- **`src/main.jsx`**：`mlTransitionKind`をimportし、`App()`内で`useRef`により
  「直前の画面・年月・確定済みenterKey・確定済みkind」を追跡。

### ⚠️実装中に見つけた設計時未検討のバグ（重要）

設計時点では「kindはchrome.jsx側で毎レンダー`mlTransitionKind()`を呼んで求める」
つもりだったが、実装して実プレイで確かめたところ、⚠️**月が進んだ直後、画面遷移を
伴わない無関係な操作（例：ホーム末尾のアコーディオン開閉）をしただけで本文がもう一度
再アニメする**バグを実測で発見した。

原因：`monthChanged`は「直前の年月」と「現在の年月」を比較して求めるが、比較に使う
「直前の年月」を保持するrefは**毎レンダー最新値に更新される**。そのため月送り成功直後の
「次のレンダー」では、直前の年月も現在の年月も既に更新後の同じ値になっており
`monthChanged`が`false`に戻る。結果、`kind`の算出結果が同じ`enterKey`のまま
`"month"`→`"rise"`に**ドリフト**し、`className`だけが変わることでCSSアニメーションが
再発火していた。

**修正**：`kind`の算出と確定を**main.jsx側の同じrefで一括管理**し、
「`enterKey`が前回と同じ値である間は、前回確定した`kind`をそのまま使い続ける」よう
固定した（`chrome.jsx`側では一切算出しない・受け取るだけにした）。
`w66_verify.mjs`の「同一画面内のUI操作で再アニメしないこと」検証で、
このバグの再現と修正の両方を確認済み。

### 検証結果

Playwrightで実プレイ確認（`w66_verify.mjs`・`w66_verify2.mjs`・`w66_sweep.mjs`）：

1. タブ間：ホーム→選手＝`tabForward`、選手→ホーム＝`tabBack`（`ML_TABS_ORDER`のindex差どおり）
2. 長い一覧：世界→世界ランキング＝`flow`
3. 読むための画面：ホーム→遊び方＝`none`
4. ⚠️月が進む：`完全休養する`実行後、ヘッダーの年月に`ml-year-pulse`が付き
   本文は`ml-enter-month`（＝`flow`と同じclip-path）
5. ⚠️同一画面内のUI操作（アコーディオン開閉）でmlWrapの`<div>`のkey・classNameが
   変わらないこと（＝上記バグ修正後、再アニメしないこと）を確認
6. `prefers-reduced-motion: reduce`のコンテキストで`animation-duration`が`.01s`
7. レースの流れ：ホーム→出走表・出走表→レース中とも`sweep`
8. シーズン・モード選択：既定の`rise`のみが効いている
9. 既存回帰（w46〜52・w57〜60）全通過・`npx vite build`成功
10. 広く画面を巡回（タブ5・世界サブ2・記録サブ2・遊び方・月送り・出走表）して
    `pageerror`ゼロを確認（`w66_sweep.mjs`のスクリーンショット14枚）

## Phase 2 実装結果（Sonnet）

### 変更ファイル

- **`src/screens/mylife/hub.jsx`**：
  - 新規関数`mlWithRaceCardTransition(action)`。`prefers-reduced-motion`または
    `document.startViewTransition`非対応なら`action()`をそのまま呼ぶだけ。対応環境では
    `document.documentElement`に`vt-active`を付け、
    `document.startViewTransition(() => flushSync(action))`で包み、
    `transition.finished.finally()`で`vt-active`を外す。
  - 候補3件の月：選択中の候補行の`{c.name}`にだけ`viewTransitionName: "ml-race-name"`
    （`selected`のときのみ——非選択の候補行には付けない）。
  - 看板レース月（候補1件）：単一カードの`{race.name}`に常に`viewTransitionName`。
  - 主ボタンの`onClick`を`mlStartRace`から`() => mlWithRaceCardTransition(mlStartRace)`へ。
  - `import { flushSync } from "react-dom"`を追加。
- **`src/screens/mylife/race.jsx`**：出走表画面（`mylife_startlist`）の
  `{raceMeta.name}`見出しに同じ`viewTransitionName: "ml-race-name"`を追加。
- **`src/styles/transitions.css`**：`.vt-active`時にルートのクロスフェードと
  `ml-enter-*`の両方を`animation: none`にする2行を追加（事前検証で確定した組み合わせ）。

### 検証結果

Playwrightで実プレイ確認（`w66p2_verify.mjs`・`w66p2_verify_single.mjs`）：

1. 候補3件の月で遷移前に`ml-race-name`を持つ要素が1つだけ（選択中の候補のみ）
2. 遷移実行中は`document.documentElement`に`vt-active`が付き、完了後は外れる
3. 出走表へ正しく到達し、到着後も`ml-race-name`を持つ要素は1つ（重複していない）
4. ⚠️看板レース月（候補1件・単一カード）でも同様に動作し、例外が発生しない
   （2レイアウトのどちらでも`view-transition-name`の重複が起きないことを確認）
5. 既存回帰（w46〜52・w57〜60）全通過・`npx vite build`成功・`pageerror`ゼロ

事前検証（`vt_probe2.mjs`）で確定した「ルート＋enterアニメの両方を抑制」の組み合わせを
そのまま実装し、実機でも例外・pageerrorなく動作した。設計時の推測（衝突する）と
事前検証（何が足りないか）の両方が実装段階で裏切られることなく成立した。
