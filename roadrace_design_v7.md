# ロードレース v7 詳細設計書

**実装済み**：`roadrace_v7.jsx` / `roadrace_v7.html`（Downloads）に本設計書の内容を実装済み。ブラウザで実際に動作確認し、コンソールエラーなしでスポンサー契約・スカウト・ショップ・編成（5役割UI）・標高グラフ・レース（結果のみ表示経路）・月送り・年度末までの一連の流れを確認した。GCステージレース画面（gc_stage1/gc_final）はコードレビューで検証済み（📻の古いクロージャ参照バグを実装中に発見・修正済み）だが、到達に11ヶ月分のプレイが必要なため実機での画面遷移は未確認。既知の要チューニング事項は本ファイル末尾に追記。


前提：v6プレイテストFB（16件）＋v7予定（昇格解禁ラダー）を踏まえ、以下の方針が確定した。

| 論点 | 決定 |
|---|---|
| シミュレーション解像度 | 本格サブティック方式（区間タイム配列を廃止し、距離・時間ベースの連続シミュレーションへ） |
| 結果/3D観戦の非同期バグ | 全体フリーズ（誰か1人でも最終区間突入で📻を全員分無効化） |
| スタミナ切れ「大失速」の適用範囲 | 全ての単独/少人数逃げに一般化 |
| 昇格解禁ラダーの着手範囲 | 段階分割（設計はF全体を確定するが、実装はA昇格＝ステージレース+GCから） |
| FA移籍市場 | 即決購入方式 |
| スタッフ | シンプルな数値ブースト枠 |
| ステージレースの編成 | 2日間固定 |
| 能力収束対策 | コア修正（growthAllocationTradeoff）のみ先行 |

---

## 1. コアエンジン刷新：ティックベース連続シミュレーション

区間タイム配列（`segTimes[j]`を一度に計算）を廃止し、**固定タイムステップで選手ごとの位置(pos)とエネルギー(energy)を毎ティック更新する**方式に置き換える。カップリング・千切れ・吸収・ローテーションは全て「位置の近さ」から自然発生させ、個別の特殊判定ロジックを極力持たない。

### 1.1 基本パラメータ
- `TICK_SEC = 5`（1ティック=5秒）
- `GROUP_GAP_SEC = 3`（この秒差以内の選手は同一グループとして扱う。グループは毎ティック再計算＝自然な吸収・分裂）
- `ROTATION_PERIOD_TICKS = 4`（20秒ごとに先頭交代）

### 1.2 選手の状態（毎ティック更新）
```
pos: number        // コース上の位置（0〜courseLength）
energy: number      // 0〜100。0以下でBLOWUP状態に入る（負値も許容し、深いほど重いペナルティ）
mode: "draft" | "pull" | "solo" | "attack"
groupId: number     // 毎ティック、位置の近さから再計算
```

### 1.3 グループ判定（吸収・千切れの自然発生）
毎ティック、全選手を位置順にソートし、隣接する選手同士の到達時間差が`GROUP_GAP_SEC`以内なら同一グループにマージ。これにより：
- 「逃げ集団がメイン集団に追いつかれる」→ 位置差が縮まって自然にグループが合流（専用のcatch判定コードが不要）
- 「山岳で千切れる」→ 山岳区間でペースについていけない選手の位置が相対的に遅れ、`GROUP_GAP_SEC`を超えた時点で自動的に別グループへ（専用のdropped状態が不要）

### 1.4 速度モデル
```
targetSpeed(rider, gradient) = BASE_SPEED(gradient)
  * (1 + (abilityFor(gradient, rider) - 70) / 260)
  * effortMultiplier(mode)
  * energyPenalty(energy)
  * draftDiscount(mode, gradient)
```
- `abilityFor`は既存関数を流用するが、区間タイプの離散値ではなく**勾配(gradient, %)から連続的に**登坂/平坦の混合比を決める（§3参照）
- `effortMultiplier`: pull=1.0 / draft=1.0（グループ平均ペースに乗る） / solo=1.0 / attack=1.15（速度上乗せ）
- `draftDiscount`は速度ではなく**エネルギー消費側**に効かせる（§1.5）
- `energyPenalty(energy)`: energy>20なら1.0。0〜20で線形に0.85まで低下。0以下（BLOWUP）で`max(0.35, 1 + energy/100*0.5)`（深く沈むほど重くなるが下限あり）

### 1.5 エネルギー消費（ドラフト・ローテーション・大失速の統合実装）
```
energyDrain(rider, mode, gradient) = TICK_SEC * (1 - stamina/150) * DRAIN_K
  * costMultiplier(mode)
  * terrainFactor(gradient)
```
- `costMultiplier`: pull=1.0 / draft=`draftDiscount(gradient)`（flat/tt=0.5, hill=0.7, climb/mtn=0.85：勾配がきついほどドラフト恩恵が薄い） / solo=1.3（FB⑥⑦の「単独は消耗が早い」を一般化） / attack=1.6（エース早期発射・AIカウンターアタック共通）
- これがそのままFB⑦「体力の消耗が早くなり、スタミナが持たないと大失速」の実装になる。ローテーション中のpull/draft切り替えもこの式一本で表現できる

### 1.6 ローテーション（先頭交代の可視化）
グループごとに`ROTATION_PERIOD_TICKS`ごとに先頭（mode="pull"）を交代。優先順位：
1. 逃げ集団：ローテーション参加者（役割=逃げ要員）が均等に回る
2. メイン集団：役割別の活性化ウィンドウ（§4）に従って牽引役が交代（山岳アシストは山岳区間のみpull可、平坦アシストは平坦/丘陵のみ、等）
3. アシスト対象（エース or 第一アシスト）は基本的にdraft固定（エネルギー温存）

3D演出側は「今どの選手がpullか」を毎ティック参照して隊列の先頭に描画するだけでよく、v6の固定オフセット式トレインより自然にローテーションが見える。

### 1.7 アタック（エース早期発射・AIカウンター）
`mode="attack"`をNティック（例：3〜6ティック＝15〜30秒）だけ強制し、その間`effortMultiplier×1.15`・`costMultiplier×1.6`を適用。攻撃側の位置が一時的に伸びる→グループから離れる→energyが尽きればBLOWUPで失速し追いつかれる、という一連の流れが全て上記の式から自然に出る。「ありえない速さでゴール手前まで」というFB⑥の問題は、attackモードの持続時間を有限（Nティック）にし、その後は通常mode（energyが低ければdraftすらできず遅くなる）に戻すことで解消する。

### 1.8 📻中断（既存アーキテクチャを継続）
- スナップショット単位を「区間」から「ティック」に変更するだけで、v4以来の「現在地点から先だけ再計算」という設計方針はそのまま使える
- `regroup(sim, currentTick, newDirective)`：現在ティックの状態（pos/energy/mode/groupId）をスナップショットとして保持し、以降のティックだけ新しい指示（追走強化＝牽引役のrotation周期短縮・pull比率増／静観＝逆／エース早期発射＝ace.mode="attack"）で再計算
- **結果ロック**：いずれかの選手が最終区間（ラスト1kmに相当する位置しきい値）に入ったら、以降📻ボタンを全員分disabledにする（`finalSegmentLocked`）。これで「観戦映像と結果が食い違う」バグを構造的に防止

---

## 2. 役割の細分化（第一/第二アシスト・山岳/平坦アシスト）

```
roleTypes = ace | breakaway | leadDomestique | subDomestique | mountainDomestique | flatDomestique
```

| 役割 | pull可能な地形 | 支援対象 | 離脱条件 |
|---|---|---|---|
| leadDomestique（第一アシスト） | 全地形 | ace | エネルギー0で自動draft落ち（離脱はしない） |
| subDomestique（第二アシスト） | 全地形 | leadDomestique | エネルギー0で離脱（グループから自然に遅れて千切れる） |
| mountainDomestique（山岳アシスト） | climb/mtnのみ（それ以外は常にdraftでエネルギー温存＝costMultiplier=0.3の特別温存モード） | ace | 最初の山岳区間終了で自動離脱 |
| flatDomestique（平坦アシスト） | flat/hillのみ | ace | 最初のclimb/mtn区間進入で自動離脱（roleDropTrigger） |

`assistTarget[riderId]`で支援先を指定（第二アシストはace以外＝第一アシストを指定できる）。第一アシストのenergyが尽きてdraftに落ちた場合、第二アシストの支援先も自動的にaceへフォールバックする。

---

## 3. コース：勾配ベースの連続地形モデル

- `courseElevationProfile[]`：距離%ごとの標高サンプル（20〜30点、既存3D生成の`yAt()`と共通のデータソースにする）
- 勾配 `gradient(pos) = Δelevation / Δdistance × 100`（%）をprofileから随時算出
- `climbWeight(gradient) = clamp(gradient / 8, 0, 1)`：0%で平坦100%、8%以上で登坂100%、その間は線形補間 → `abilityFor`は離散区間タイプではなくこの連続値でblend
- `totalElevationGain` / `climbCount`（勾配が正から負に転じる回数） / `maxGradient`を`courseElevationProfile`から導出し、レース選択画面に折れ線グラフ（SVG polyline、ライブラリ不使用）として表示
- `raceDifficultyRating = f(totalElevationGain, maxGradient, distance)`：AIの`power`計算・賞金/pt倍率・「推奨登坂力」表示に使う

---

## 4. 脚質の意味づけ・パーツ細分化・OVR再計算（変更なし、A〜Lカタログのまま確定）

- `typeAffinityBonus(type, gradient/segType)`：SPRはスプリント地点、CLMは高勾配、PUNは中勾配（丘陵）、TTは独走全般に小ボーナス
- `typeRoleSuitability`：山岳アシストはCLM/PUN適性、平坦アシストはSPR/RUL適性。ミスマッチで`roleMismatchPenalty`
- パーツスロットを`frame/tire`から`wheels/nutrition/groupset/shoes`へ拡張（tier制は維持）
- `ovrWeightingModel`：単純平均から上位加重（最高値50%＋2位30%＋残り平均20%）へ変更し、特化型選手を正しく評価

---

## 5. 能力収束対策（コア修正のみ）

`growthAllocationTradeoff`：現行の「指定練習+100%、指定外+20%（無条件）」を廃止し、**指定外の伸びは指定練習の伸び幅から一部を融通する**形に変更：
```
指定能力の成長 = baseGain × 1.0（変更なし）
指定外能力の成長 = baseGain × 0.20 × persMul(k)  ← ここまでは同じ
ただし、指定能力自体の成長には ×0.9 のペナルティを掛ける（トレードオフ化）
```
これにより「全部伸ばせば全員似た終着点に収束する」構造を弱め、練習方針の一貫性（＝性格・脚質に沿った特化）にわずかだが明確なアドバンテージを持たせる。型差分・衰え差分（typeCapDifferential／offFocusDecay／veteranDeclineProfile）は今回見送り、この修正の効果をプレイテストしてから追加要否を判断する。

---

## 6. 昇格解禁ラダー：設計確定・実装はA昇格から

### 6.1 A昇格（今回実装）
- `stageCount = 2`、編成は2日間固定（出走メンバー・役割を1日目決定時に固定）
- `gcTime[riderId]`：各ステージの個人タイムを積算。ステージ間は`interStageFatigueRecovery`（休息日相当、疲労-20程度）を適用し、故障は`interStageInjuryCarry`でそのまま持ち越し（連闘ルールとの整合）
- 総合順位（GC）でチーム最高位を判定し、既存の昇格判定（3位以内）に接続

### 6.2 PRO昇格（設計のみ確定・実装は次フェーズ）
- `grandTourStageCount = 4`。GC集計の仕組みはA昇格のものをそのまま拡張
- `overseasRaceFrequency` / `overseasDifficultyMultiplier` / `overseasTravelFatiguePenalty`（遠征後1ヶ月は疲労回復量-10などの軽いペナルティ）

### 6.3 FA移籍市場（設計のみ確定・実装は次フェーズ）
- 即決購入方式：スカウト画面と同UXで、他チーム所属のベテラン〜完成品選手が`faMarketPoolSize`（例：5〜8名）だけ一覧表示され、`faPriceModel(rider)`（能力・年齢・成長力ベース）の価格で即契約
- `faMarketRefreshRate`：月1回程度の入れ替え

### 6.4 スタッフ（設計のみ確定・実装は次フェーズ）
- 個体キャラクターではなく、チーム機材（equip）と同様の**数値ブースト枠**として実装
- `staffRoles = {manager, trainer, doctor}`、各1〜数レベルのブーストのみ（例：manager=スポンサー交渉時の好条件率up、trainer=facility同等の練習効果up、doctor=故障率・離脱期間短縮）
- `staffSalaryModel`：月給制（equipの買い切りとは異なり、毎月budgetから引かれる固定費）
- クラス連動の枠数：A=1、PRO=3（`classUnlockFeatureMap`）

---

## 実装順（推奨）
1. ティックベース連続シミュレーション（§1）— 最大かつ全ての土台
2. 役割の細分化（§2）— §1に依存
3. コース勾配モデル・グラフ表示（§3）— §1の地形速度モデルと共有データ
4. 脚質・パーツ・OVR（§4）— 独立して着手可能
5. 収束対策コア修正（§5）— 独立して着手可能
6. A昇格：ステージレース+GC（§6.1）
（FA市場・スタッフ・グランツール・海外遠征は次フェーズ）

## 実装後の既知チューニング課題

- **千切れ組の遅れが過大**：実プレイでのテストレース（丘陵ロード）で、千切れた選手の一部が優勝者に対して+44分〜+67分という現実離れした差になった。原因は`MAX_TICKS`到達時の残り距離を`lastOwnDist`（直前の実移動量）で単純外挿している処理、またはエネルギーが深く負値に落ち込んだ選手の`energyPenaltyMul`が効きすぎている可能性が高い。次の調整候補：
  - `energyPenaltyMul`の下限（現状0.35）をもう少し高くする
  - 千切れ組専用の「あきらめペース」下限値を設ける（実質的な足切り）
  - `MAX_TICKS`外挿ロジックを、直近NティックのAVERAGE速度を使うように変更（単一ティックの外れ値に引きずられないように）
