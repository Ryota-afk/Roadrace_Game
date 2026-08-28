# 第66弾：画面遷移アニメーション（DEVLOG TODO #21）

**状態**：**設計確定（ユーザー合意済み・2026-08）→Phase 1の実装待ち（Sonnet）。**

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
⚠️「アニメーションを消す」のではなく「一瞬で終わらせる」——`animation-fill-mode: both`の
終了状態は必要なため、`animation: none`にすると`clip-path`が初期値のまま残り**中身が消える**。

### シーズンモードの扱い（判断）

⚠️**上記の分類はマイライフ35画面に対して作ったもの。シーズンの21画面には分類が無い。**
シーズン側（`makeWrap`）には**④の持ち上がりだけを既定として当てる**。
理由：片方のモードだけ動いて片方が静止していると不具合に見えるため。
⚠️シーズンの分類ごとの割り当ては今回のスコープ外（必要ならユーザーの指示で別弾）。

`makeMetaWrap`（モード選択・生涯評価・CP交換所）も同じく④を当てる。

## Phase 2（Phase 1の実機確認後）：押した要素が育つ

⚠️**Phase 1が実プレイで確認できてから着手する。**

- **対象は`ホームのレース候補 → 出走表`の1経路のみ**（ユーザー合意）。
- 仕組みは**View Transitions API**。対になる要素に同じ`view-transition-name`を付け、
  状態更新を`document.startViewTransition(() => flushSync(() => setMl(...)))`で包む。
- ⚠️**他の6分類と根本的に仕組みが違う**：
  - `startViewTransition`は**ページ全体の遷移を乗っ取る**。既定のルートのクロスフェードが
    Phase 1のCSSアニメーションと**衝突する**ため、この経路だけ
    `::view-transition-old(root)`/`::view-transition-new(root)`の既定演出を無効化する。
  - React 18では`flushSync`が要る（`startViewTransition`のコールバック内を同期にするため）。
  - ⚠️**この経路だけ呼び出し側に手が入る**（`hub.jsx`の出場ボタン）。
- 非対応ブラウザでは何も起きない（Phase 1の④/⑤にフォールバック）＝実害なし。

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
