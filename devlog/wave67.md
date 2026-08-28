# 第67弾：シーズンモードの遷移アニメーション

**状態**：**設計確定（ユーザー合意済み・2026-08）→実装待ち（Sonnet）。**

## ⚠️まず訂正：依頼の前提（私が第66弾の締めで書いた残件）が間違っていた

第66弾の完了報告で残件を「**シーズン21画面への分類ごとの割り当て**」と書いたが、
⚠️**これは実態を取り違えていた**。実測した結果、次のことが分かった。

### ⚠️シーズンの主要なナビゲーションは`g.screen`を変えていない

`screens/season/hub.jsx`は`g.screen === "main"`ひとつの中で、
`seasonMenu.menuState.section`に応じて`content`を差し替えている（`hub.jsx:89-91`）。
つまり**選手一覧・施設・市場・記録などメニューで行き来する18セクションはすべて
`g.screen === "main"`のまま**で、第66弾Phase 1のkey（`g.screen`）は変化しない。

**実測**（`scratchpad/season_probe.mjs`）：拠点→選手一覧→通算成績と移動しても、
`ml-enter-*`が付いたDOMノードの identity が**1のまま変わらない**＝
⚠️**シーズンのメニュー移動は現在ひとつもアニメーションしていない**（中身だけが差し替わる）。

```
初期            : {"id":1,"cls":"ml-enter-rise","anim":"ml-fade-rise"}
選手一覧へ移動後 : {"id":1,"cls":"ml-enter-rise","anim":"ml-fade-rise"}  ← 同じノード
記録へ移動後     : {"id":1,"cls":"ml-enter-rise","anim":"ml-fade-rise"}  ← 同じノード
```

⚠️**したがって「21画面に分類を割り当てる」だけでは、プレイヤーが実際に行き来する
場所はひとつも変わらない。** シーズンで人が最も頻繁に移動するのはメニューの18セクション
であり、それらは21画面の中に含まれていない。

## シーズンの実際の遷移面

| 面 | 数 | 現状 |
|---|---|---|
| **`main`内のセクション**（メニューで移動） | **18**＋BaseView | ⚠️**アニメーションなし** |
| `g.screen`の画面（フロー系） | 20（`main`を除く） | 既定の`rise`のみ |

`SECTION_RENDERERS`（`hub.jsx:35-54`）の18件：
`riders_list` `riders_team` `riders_youth` / `facility_equip` `facility_staff` `facility_ob`
`facility_room` / `market_scout` `market_transfer` `market_shop` / `race_calendar` `race_status` /
`records_career` `records_hall` `records_archive` `records_standings` / `help` `misc_settings`
（`save`・`titleReturn`は画面遷移ではなく即時アクションなので対象外）

## ⚠️もう1つの発見：シーズンにも月送りのkey問題がある

`controllers/season/month.js:343`が`screen: "main"`で終わる。マイライフと同じく
**遷移前後とも同じ画面ID**なので、`key`に年月を含めないと月送りが発火しない。
第66弾Phase 1ではマイライフ側だけこれを直しており、⚠️**シーズン側は未対応**。

## 提案するスコープ

1. **`makeWrap`のkeyに「セクション」と「年月」を含める**
   （`${g.screen}:${section}:${g.year}-${g.month}`）。これで18セクションの移動と
   月送りの両方が発火するようになる。⚠️これが**効果の大半**を占める。
2. **セクションと画面を分類する**（第66弾で確立した語彙をそのまま使う）。
3. ⚠️**方向つき横スライドは使わない**（マイライフのタブ間とは違う扱いにする）。
   理由：マイライフの下部タブは**常に画面に見えていて横並び**なので左右の位置関係が
   頭に入るが、シーズンのメニューは「大ジャンル→小ジャンル」のドリルダウンで
   普段は畳まれており、セクション同士の左右関係がプレイヤーの頭に無い。

### 分類案（`main`内の18セクション＋BaseView）

| 分類 | 対象 |
|---|---|
| **読むための画面（動かさない）** | `help`／`records_archive`（通算タイトル・コースレコード・特能図鑑） |
| **長い一覧（上から満ちる）** | `riders_list` `riders_team` `market_scout` `market_transfer` `market_shop` `facility_equip` `facility_staff` `facility_ob` `race_calendar` `records_career` `records_hall` `records_standings` |
| **その他（持ち上がり）** | `riders_youth` `facility_room` `race_status` `misc_settings` |
| **BaseView（ホームに戻る）** | ⚠️**判断が要る**（下記） |

⚠️**BaseViewの扱いは判断が分かれる**：拠点のアイソメ画面は`useIsoCamera`の
rAFアニメーションを内部に持ち、`wrap`の`fill`モードも使う唯一の画面。
持ち上がり（`rise`）を当てても壊れないはずだが、**動いている絵の上にさらに
遷移アニメを重ねる**ことになる。⚠️実装時に実機でカクつきを確認し、出たら`none`へ倒す。

### 分類案（`g.screen`の20画面）

| 分類 | 対象 |
|---|---|
| **レースの流れ（横スイープ）** | `startlist` `lineup` `race` `result_pending` `result` `gc_stage` `gc_role_setup` `gc_final`（8） |
| **長い一覧（上から満ちる）** | `program` `standings` `trophy` `rivals`（4） |
| **その他（持ち上がり）** | `intro` `newgame_setup` `scoutpolicy_initial` `sponsor` `event` `event_result` `yearend` `clear`（8） |

## やらないこと

- ⚠️simの計算・バランスには一切触れない
- `BaseView`・`RaceView`・`DecisionCard`の**画面内部の演出**には触らない
- View Transitions（第66弾Phase 2）のシーズンへの拡張——今回は対象外
- 方向つき横スライド（上記の理由）

---

## 確定した設計（ユーザー合意済み）

**BaseView（拠点）＝`rise`（持ち上がり）**でユーザー決定。⚠️実装時に実機でカクつきを
確認し、出るようなら`none`へ倒す判断はSonnet側に委ねる（出たら`devlog`に記録すること）。

### 1. `data/screenTransition.js`に追加するもの

マイライフ側（`mlScreenCategory`/`mlTransitionKind`）はそのまま。**シーズン用を別に足す**
（分類が別体系なので同じ表に混ぜない）。

```
// 読むための画面（動かさない）
const SEASON_READ_SECTIONS = new Set(["help", "records_archive"]);
// 長い一覧（上から満ちる）
const SEASON_LIST_SECTIONS = new Set([
  "riders_list", "riders_team", "market_scout", "market_transfer", "market_shop",
  "facility_equip", "facility_staff", "facility_ob", "race_calendar",
  "records_career", "records_hall", "records_standings",
]);
// 上記以外のセクション（riders_youth / facility_room / race_status / misc_settings）は既定のrise

const SEASON_RACE_SCREENS = new Set([
  "startlist", "lineup", "race", "result_pending", "result",
  "gc_stage", "gc_role_setup", "gc_final",
]);
const SEASON_LIST_SCREENS = new Set(["program", "standings", "trophy", "rivals"]);
// 上記以外の画面（intro/newgame_setup/scoutpolicy_initial/sponsor/event/event_result/
// yearend/clear）は既定のrise

export function seasonTransitionKind({ screen, section, monthChanged }) { … }
```

**判定の順序**（⚠️この順で書くこと）：
1. `monthChanged` → `"month"`
2. `screen !== "main"` → `SEASON_RACE_SCREENS`なら`"sweep"` ／ `SEASON_LIST_SCREENS`なら
   `"flow"` ／ それ以外は`"rise"`
3. `screen === "main"`：`section == null`（＝BaseView）→ `"rise"` ／
   `SEASON_READ_SECTIONS`なら`"none"` ／ `SEASON_LIST_SECTIONS`なら`"flow"` ／
   それ以外は`"rise"`

⚠️**マイライフと違い`prevScreen`は要らない**（方向つき横スライドを使わないため）。

### 2. `main.jsx`

`seasonMenu`は既に`App()`内にあるので、そこから`section`を取れる。
⚠️**マイライフとまったく同じ「kindの凍結」を実装すること**——第66弾Phase 1で
`enterKey`が同じ間に`kind`が`"month"`→`"rise"`へドリフトして誤発火した実測バグがあり、
シーズンでも同じ構造なので同じ対策が要る。

```
const seasonSection = seasonMenu.menuState.section;   // null のときBaseView
const seasonRef = React.useRef({ year: g.year, month: g.month, enterKey: null, kind: "rise" });
const prev = seasonRef.current;
const monthChanged = prev.year !== g.year || prev.month !== g.month;
const candidateKind = seasonTransitionKind({ screen: g.screen, section: seasonSection, monthChanged });
const candidateKey = candidateKind === "none" ? "static"
  : `${g.screen}:${seasonSection || "base"}:${g.year}-${g.month}`;
const same = candidateKey === prev.enterKey;
const seasonTransitionInfo = { enterKey: candidateKey, kind: same ? prev.kind : candidateKind };
seasonRef.current = { year: g.year, month: g.month, ...seasonTransitionInfo };
const wrap = makeWrap({ g, setG, transitionInfo: seasonTransitionInfo, ...modal });
```

⚠️**`section`をkeyに含めるのが今回の本体**——これが無いとメニュー移動は今のまま
一切アニメーションしない。

### 3. `components/chrome.jsx`（`makeWrap`）

`makeMlWrap`と同じ形にする：`transitionInfo={ enterKey, kind }`を受け取り、
`<div key={enterKey} className={\`ml-enter-${kind}\`}>`で`{children}`を包む。
⚠️**既存の`opts.fill`の伝播（`flex:1, minHeight:0`）は必ず維持する**——
拠点のアイソメ画面が画面の残り高さを使えなくなる（第66弾Phase 1で踏んだ罠）。

`SeasonHeader`の年月にも、マイライフと同じく`kind === "month"`のとき
`ml-year-pulse`と`key={`${g.year}-${g.month}`}`を付ける。
⚠️`SeasonHeader`は`makeWrap`の外にある独立コンポーネントなので、
`kind`を`SeasonHeader`へ渡すか、`makeWrap`側でヘッダーを組み立てる形に寄せる。

### 4. クラス名は流用する

`transitions.css`の`.ml-enter-*`はマイライフ専用の名前に見えるが**実体は両モード共通**
（第66弾Phase 1で既にシーズン・メタ画面にも`ml-enter-rise`を当てている）。
⚠️**今回リネームはしない**——動いているものに触る変更を混ぜない。
必要なら別弾で`.app-enter-*`等へ一括改名する。

## 検証項目

1. ⚠️**メニューでセクションを移動するとアニメーションが発火する**（第66弾Phase 1では
   一度も発火していなかった）。DOMノードのidentityが変わることで確認する
2. `help`・`records_archive`は**動かない**（`none`）
3. `riders_list`等の長い一覧が**上から満ちる**（`flow`）
4. 拠点（BaseView）へ戻ると`rise`が効き、⚠️**アイソメ画面のカクつきが無い**
   （出たら`none`へ倒して記録する）
5. ⚠️**拠点で画面の残り高さが従来どおり使えている**（`opts.fill`が壊れていない）
6. ⚠️**月送りでヘッダーの年月がパルスし、本文が満ちる**（シーズン側は未対応だった）
7. ⚠️**同じセクションに留まったままのUI操作（購入・練習指定等）で再アニメしない**
   （第66弾Phase 1で踏んだkindドリフトのシーズン版が無いこと）
8. レース系（`startlist`→`race`→`result`）が`sweep`
9. 既存回帰（w46〜52・w57〜60）全通過・`npx vite build`成功・`pageerror`ゼロ
10. ⚠️実プレイのスクリーンショットで確認
