# 第28弾：新ステータスの配合遺伝（判断⑰・8番）

**背景**：「次のアクション」8番の保留項目・判断⑰。新ステータス（突破力・安定感・
スピリット・運）は`genSubStats`で毎回「脚質ベース＋乱数」生成されるだけで、配合では
一切遺伝しなかった（殿堂記録`finalSubStats`がaccel/build/mentalの3つしか保存せず、
遺伝計算`mlBreedBonus`のキー集合`SUB_STAT_KEYS`にも含まれないため）。

**ユーザー合意（AskUserQuestion・2問）**：
1. 適用範囲＝**共通で効かせる**（mlBreedBonusは共通関数のため、マイライフの配合と
   シーズンの血統ユース`signBredYouth`の両方に自然に効く）。
2. 運の扱い＝**遺伝させない**（完全に生まれつきのランダムのまま）。

## 実装（3ファイル）

- **`breeding.js`**：
  - `INHERIT_SUB_KEYS = ["breakthrough","stability","spirit"]`を新設・export。
  - `mlLegendRecord`の`finalSubStats`へ3キーの最終値を追記（`?? 50`ガード）。
  - `mlBreedBonus`のsubBonus計算を`[...SUB_STAT_KEYS, ...INHERIT_SUB_KEYS]`へ拡張。
    式は既存と同一「両親の高い方の(値−50)×0.25」。
- **`createChar.js`（マイライフ配合）／`roster.js`（シーズン血統ユース）**：
  subBonus適用ループを`SUB_STAT_KEYS.forEach`→`Object.keys(breed.subBonus)`へ。
  キー集合の管理をmlBreedBonus側へ一元化（クランプ[20,95]は従来どおり）。
  roster.jsの未使用になったSUB_STAT_KEYS importを削除。
- UI・ログの追加は**なし**（§7引き算原則。素質診断のレーダーチャートには値として
  自動反映される）。師の教え（protegeInherit）のsubBonusは従来どおり3キーのまま無変更。

## 検証（Node実測）

| ケース | 結果 |
|---|---|
| 高い親（突破90/安定88/スピ74） | subBonus = +10/+10/+6（式と厳密一致） |
| 旧セーブ親（新キー無し） | 新ステ分すべて0（50フォールバック＝互換OK） |
| 低い親（両親とも50未満） | −2/−1/−2（既存式の挙動と一貫） |
| 運 | subBonusに含まれない（対象外の確認） |
| 子への適用 | 46/47/39 → 56/57/45（クランプ付き加算が機能） |

`npm run build`成功。シーズン血統ユースの挙動変化（新ステが遺伝で乗る）は
合意済みの仕様変更（過去の「血統ユース不変」回帰基準はこの点につき更新）。
