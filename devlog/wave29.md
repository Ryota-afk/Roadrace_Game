# 第29弾: 脚質ごとの能力別成長上限差（判断③）

2026-08。DEVLOG §60の詳細記録。

## 背景と合意

8番（マイライフ難易度調整）の保留項目だった判断③。「極めると全員同じ万能型になる」
（成長上限が5能力共通のため、育て切った選手のシルエットが脚質によらず同じになる）の是正。
AskUserQuestionで以下を合意：

- **強度**：「強（得意+10／苦手−12）」を採用（弱＝±5案・中＝±8案は不採用）。
  準得意+5、パンチャーのみ双得意+7（climb/sprint両方が持ち味のため単得意+10の代わり）。
- **表示**：「外周を能力別上限に」を採用。レーダーチャートの外周が能力ごとの上限を表す
  （得意能力は外周が遠く＝伸ばせる、苦手は近い＝すぐ頭打ち）。右下隅の「上限」数字は
  基準値（オフセット前のmlGrowthCap）のまま。

## オフセット表（ML_TYPE_CAP_OFFSET）

| 脚質 | flat | climb | sprint | stamina | solo |
|---|---|---|---|---|---|
| SPR | +5 | −12 | +10 | 0 | 0 |
| CLM | 0 | +10 | −12 | +5 | 0 |
| RUL | +10 | −12 | 0 | +5 | 0 |
| PUN | 0 | +7 | +7 | 0 | −12 |
| TT | +5 | 0 | −12 | 0 | +10 |

`mlGrowthCapFor(year, player, ml, abKey) = max(70, mlGrowthCap(year, player, ml) + offset)`。
床70はどれだけ基準値が低くても苦手能力の上限が70を割らない安全弁。未知の脚質は
オフセット0（＝基準値のまま）。

## 設計上の要点

- **上限を下げても既存の能力値は下がらない**。`addAb`は超過分の伸びが急減衰する
  （growthFactorの指数減衰）だけでクランプはしないため、既存セーブへの影響は
  「苦手能力の今後の伸びが鈍る」のみ。
- **例外だった箇所を修正**：`controllers/mylife/event.js`の弟子指導イベント（mentor側の
  abBoost）だけが`Math.min(cap, current + boost)`の直接クランプで、上限超過中の能力を
  **削り得た**（実測：climb=120の選手にabBoost+1のイベントが発火すると78まで切り下げ）。
  `Math.max(current, Math.min(capFor(k), current + boost))`のガードを入れ「伸ばすことは
  あっても削らない」を保証。
- 配合の才能キャップ（talentCap）・実績ボーナス・難易度倍率は基準値`mlGrowthCap`側に
  そのまま効く（オフセットは最後に加算）。
- **マイライフ専用**。シーズンの育成上限（難易度別固定値・`mlAiCapFor`等）は別系統で対象外。
  シーズン選手一覧のレーダー（`screens/season/hub/riders/list.jsx`）はスカラー`cap`のまま
  （`capFor`省略時は従来挙動）。

## 変更ファイル

- `domain/mylife/growthCap.js`：`ML_TYPE_CAP_OFFSET`＋`mlGrowthCapFor()`新設
- `logic/support.js`：再エクスポート追加
- `controllers/mylife/month.js`：練習・レース経験・特訓・メンタル込み全6箇所のaddAbを`capFor(k)`へ
- `controllers/mylife/shop.js`：私設強化合宿を`capFor(k)`へ
- `controllers/mylife/event.js`：イベント効果（abBoost/abKeyDelta）＋弟子指導mentor側を
  `capFor(k)`へ＋削り防止ガード
- `domain/season/achievements.js`：オフシーズン選択（ML_OFFSEASON_CHOICES）2件のapplyを`capFor`へ
- `screens/mylife/hub.jsx`：伸びしろ計算`roomOf(k)`を能力別上限ベースへ（練習推奨・伸びしろ
  ラベルが能力別に変わる）
- `components/RadarChart.jsx`：`AbilityRadarChart`/`AbilitySoshitsuRadarPair`にオプション
  `capFor`（能力キー→上限）を追加。省略時は従来のスカラーcap（シーズン側の互換維持）
- `screens/mylife/rider.jsx`：選手画面のレーダーに`capFor`を配線

## 検証（実測）

Node機械検証：
- 5脚質全てで`mlGrowthCapFor − mlGrowthCap`がオフセット表と一致
- 未知脚質はオフセット0、床70が効く（oni・talentCap−30でも70）
- `mlApplyEventEffects` abBoost：上限超過中の能力（climb=120）が削られない（120→120.001）、
  通常能力は伸びる
- abKeyDelta：正はaddAb経由（capFor減衰）、負は直接減算（従来通り）
- `mlResolveProtegeEvent`：ガード導入後、climb=120がcapFor=78でも120のまま維持
  （旧実装なら78へ切り下げられていた）

Playwright（dist実プレイ・pageerrorゼロ）：
- SPR新規作成→選手画面：レーダー頂点半径比が value/能力別上限 と全軸一致
  （flat 45/95=0.474・climb 50/78=0.641・sprint 63/100=0.630・stamina 46/90=0.511・
  solo 39/90=0.433）。右下隅「上限 90」＝基準値のまま。
- CLM新規作成でも同様に一致（sprint 48/78=0.615・climb 54/100=0.540）。
