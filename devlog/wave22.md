# 第22弾：新4部屋（玄関ホール・食堂・ロッカー・トロフィー）の実データ連動の見た目成長

**背景**：第20弾で増築した4部屋はレベルゲートの見た目要素がゼロ（`buildingLevels(g)`に
部屋キーが無く、描画フィルタ`(f.minLevel ?? 0) <= (levels[f.room] ?? Infinity)`が常に真）。
ユーザー合意（2026-08・AskUserQuestion）：**案B「部屋ごとの実データ連動」**を採用。
解禁条件と同じデータで見た目も育つ＝「拠点を一目見てチーム状態が分かる」思想
（医務室ルーティング・第21弾の屋外行き先と同系）の踏襲。

## 1. 成長の軸（レベル導出・すべて読み取り専用の純導出）

`domain/season/baseViewLayout.js`の`buildingLevels(g)`へ4キーを**追加**する
（既存キーは不変更・呼び出し側は追加キーを知らなければ従来どおり動く）。

| 部屋 | レベルの意味 | 導出式（データ源） |
|---|---|---|
| hall | クラブのクラス | `g.classIdx \|\| 0`（0=B1 / 1=A / 2=PRO） |
| diner | スタッフ人数 | `Object.values(g.staff \|\| {}).filter(v => v > 0).length`（0〜4。`roomUnlocks`と同式） |
| locker | 所属選手数 | `(g.roster \|\| []).length`（解禁は8人〜。上限はクラス依存12/14/16） |
| trophy | タイトル獲得数 | `(g.careerHistory \|\| []).filter(h => h && h.champBest === 1).length + (g.champBest === 1 ? 1 : 0)`（年度末に`champBest`は履歴へ積まれ`null`リセットされるため二重計上なし・`controllers/season/month.js`実測） |

旧セーブ互換：すべて`|| 0`/`|| []`ガード済みの式のみ。`careerHistory`が無い時代の
セーブでも0に落ちるだけで壊れない。

## 2. 描画フィルタの変更（BaseView.jsx 1箇所）

現在（`components/base/BaseView.jsx` 295-298行付近）：

```js
...fixtureItems(PROJ, BASE_VIEW_FIXTURES.filter(f => {
  if (f.room === "diner" || f.room === "locker" || f.room === "trophy") return unlocks[f.room];
  return (f.minLevel ?? 0) <= (levels[f.room] ?? Infinity);
}))
```

変更後：奥3部屋は「解禁済み **かつ** minLevel到達」の二段判定にする。

```js
  if (f.room === "diner" || f.room === "locker" || f.room === "trophy")
    return unlocks[f.room] && (f.minLevel ?? 0) <= (levels[f.room] ?? 0);
  return (f.minLevel ?? 0) <= (levels[f.room] ?? Infinity);
```

- 既存の基本什器は全部`minLevel: 0`のままなので、この変更だけでは**見た目の回帰ゼロ**
  （解禁＝従来どおり基本什器が出る）。
- hallは既存分岐（`levels[f.room]`）に乗るだけ。`buildingLevels`にhallキーが増えるので
  `?? Infinity`が効かなくなるが、hallの既存5什器はすべて`minLevel: 0`のため回帰なし。

## 3. 追加する什器（全てdata/baseViewBuildings.jsのBASE_VIEW_FIXTURESへ追記・新規スプライト抽出なし）

既存46種のスプライトだけを使う（CLAUDE.md §6の抽出リスクを回避）。座標は仮置きで、
実装時に`tools/verify_baseview.mjs`（部屋内包含・什器間隔・歩行ルートとのクリアランス）で
機械検証して確定する（第21弾と同じ進め方。ズレたら座標だけ動かす）。

### 玄関ホール（hall・w:8〜11, l:-4.5〜-0.9・扉は手前辺中央）

既存: shoeRack(8.5,-4.1) / receptionCounter(10.6,-1.8) / corkboardStand(8.5,-1.6) /
magazineRack(10.6,-4.0) / deskClock(10.3,-1.3)。中央の縦帯（w≈9.5）は選手の歩行動線。

| minLevel | 意味 | kind | 仮座標 | 狙い |
|---|---|---|---|---|
| 1 | Aクラス昇格 | pottedPlant | (8.4, -3.0) | 玄関に緑が入り「格が上がった」印象 |
| 2 | PRO昇格 | bench | (10.5, -2.9)・flip | 来客用の待合ベンチ。第21弾ベンチの屋内転用 |

### 食堂（diner・w:5〜8, l:3.5〜5.5・扉はl=3.5辺のw5.9〜7.1）

既存: cafeteriaTable(6.0,4.3) / cateringCounter(7.2,4.95) / corkboardLean(5.5,5.0)。

| minLevel | 意味 | kind | 仮座標 | 狙い |
|---|---|---|---|---|
| 3 | スタッフ3人 | waterTable | (7.6, 4.0) | 給水・ドリンクの置き台（トレ室と同スプライト） |
| 4 | スタッフ4人（全員） | cafeteriaTable | (5.6, 3.9) | 席が増える＝所帯が大きくなった感 |

### ロッカールーム（locker・w:8〜11, l:3.5〜5.5・扉はl=3.5辺のw8.9〜10.1）

既存: lockerRow(9.6,4.95) / coatRack(8.7,4.0)。

| minLevel | 意味 | kind | 仮座標 | 狙い |
|---|---|---|---|---|
| 10 | 選手10人 | lockerRow | (10.5, 4.95) | ロッカーの列が延びる |
| 12 | 選手12人 | bench | (9.5, 4.2) | 着替えベンチ |

### トロフィールーム（trophy・w:11〜14, l:3.5〜5.5・扉はl=3.5辺のw11.9〜13.1）

既存: trophyCase(12.4,4.95) / pottedPlant(13.5,4.3)。

| minLevel | 意味 | kind | 仮座標 | 狙い |
|---|---|---|---|---|
| 2 | タイトル2回 | trophyCase | (13.3, 4.95) | ケースが増える＝最も直接的な「実績の見える化」 |
| 3 | タイトル3回 | corkboardStand | (11.5, 4.2) | 優勝写真・記事の掲示板 |

## 4. empty state

| 状態 | 見え方 |
|---|---|
| 部屋が未解禁 | 従来どおり納戸（st_empty）。本弾での変更なし |
| 解禁直後（食堂=スタッフ2・ロッカー=8人・トロフィー=1回） | 既存の基本什器のみ＝現行と同じ見た目（回帰ゼロ） |
| 旧セーブ（careerHistory無し等） | 導出が0に落ち基本什器のみ。クラッシュしない |
| ロッカー解禁後に選手が移籍で8人未満へ減少 | `unlocks.locker`が偽へ戻り部屋ごと納戸へ（既存仕様のまま。本弾は追随するだけ） |

## 5. 変更しないもの

- UIテキスト：一切追加しない（部屋labelはタップ時のみの既存仕様のまま。§7準拠）
- `roomGrade()`（内装グレード＝床・壁の見た目）：既存のクラス連動のまま。本弾は什器の数のみ
- 下部施設ストリップ：4持ち場のみの現行表示のまま（新部屋のLvは表示しない。
  「スタッフ3人」等は該当画面で既に見える情報であり二重表示は§7に反する）
- 選手の行き先（riderActivity）：新部屋は行き先にしない（第21弾の範囲外・別弾）

## 6. 検証計画

1. `node tools/verify_baseview.mjs`：新8什器の部屋内包含・既存什器/壁/扉/歩行ルートとの
   クリアランス（既存の検査が`BASE_VIEW_FIXTURES`全件を自動で拾うことを確認し、
   拾わない場合は検査対象へ追加する）
2. Node純関数検算：`buildingLevels(g)`へ合成gを渡し、4キーの導出式（特にtrophyの
   二重計上なし＝年度末前後）を境界値で確認
3. Playwright実機：(a)フレッシュLv0＝納戸のまま／(b)解禁直後の最小状態＝現行と同一の
   見た目／(c)全成長状態（PRO・スタッフ4・選手12・タイトル3）＝8什器すべて出現、
   の3状態でpageerrorゼロ・スクリーンショット目視
4. `npm run build`

## 7. 実装順序

1. `buildingLevels(g)`へ4キー追加（純関数・Node検算）
2. `BASE_VIEW_FIXTURES`へ8什器追記
3. BaseView.jsxのフィルタ1行変更
4. 検証器実行→座標確定
5. Playwright 3状態確認→DEVLOG §53＋本ファイルへ実施記録→commit/push
