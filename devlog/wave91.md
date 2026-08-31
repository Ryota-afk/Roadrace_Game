# 第91弾：第90弾（人気度逓減の全経路適用・移籍時上限）の実装と実測

**状態**：⚠️**実装・node単体確認は完了。実機の通しプレイでの実測は実行中。**

## 実装

`devlog/wave90.md`の設計どおり①③を実装した。

### ① 人気度の逓減を4経路へ

`domain/mylife/popularity.js`に純関数`popAdd(cur, delta)`を新設（増加時のみ逓減、
減少はそのまま）。`applyPopGain`の内部もこれを使う形へ統一し、素通りしていた
4箇所を書き換えた：

- `controllers/mylife/event.js:30`（`mlApplyEventEffects`のpopularityDelta）
- `controllers/mylife/event.js:159`（`mlResolveRivalScene`のpopularityDelta）
- `controllers/mylife/result.js:191`（アシスト成功のassistPop）
- `domain/mylife/ambition.js:31`（`applyAmbitionReward`のreward.pop）

### ③ 移籍時の年俸にクラス上限を再適用

`controllers/mylife/career.js`の`mlChooseTeam`で、`classIdx`を`salary`より先に
確定させる順序へ変更し、`Math.min(ML_SALARY_CAP[classIdx], ...)`でクランプした。
下限（`ML_SALARY_FLOOR`）は設計どおり掛けていない。

## node単体での確認（`scratchpad/w92_check.mjs`）

| 確認項目 | 結果 |
|---|---|
| `popAdd(90, +10)` | 91（逓減で+1、期待どおり） |
| `popAdd(90, -10)` | 80（逓減なしで-10、期待どおり） |
| アンビション報酬+25（人気度90時） | 92.5（+2.5に逓減、期待どおり） |
| 移籍salary×1.5=3300・クラス0(上限1200) | 1200にクランプ（期待どおり） |
| 移籍salary×1.5=3300・クラス2(上限8000) | 3300のまま（クランプ不要、期待どおり） |
| `applyPopGain`回帰確認（第84弾と同じ入力） | popularity24.7+gain3.0→26.959・
  popBonus80・milestone[25]（逓減式は第87弾から不変であることを確認） |

## 実機での実測

第90弾で使った`w91_play.mjs`（シンクを実際に使う自動プレイ）を流用し、
`w92_play.mjs`として再実行した。

（結果：実行中）
