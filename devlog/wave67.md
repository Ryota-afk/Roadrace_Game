# 第67弾：シーズンモードの遷移アニメーション

**状態**：**実測完了・スコープはユーザーの判断待ち。**

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
