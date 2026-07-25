# v7設計変数カタログ（v6プレイテストFB反映）

v6の実プレイで得られた16件のフィードバックと、既存のv7予定（昇格解禁ラダー）を踏まえて洗い出した設計変数一覧。粒度・網羅性は確認済み（2026年時点）。実装はまだ行っていない。次のステップは、この中から設計判断が割れる箇所を一つずつ確認しながら詳細設計に入ること。

## A. 逃げ集団の実在感（FB①②③）
根本原因：`chaseIntensityDelta`(±6の能力換算値)に対して区間数が2〜4個しかなく、ギャップが育つ前に`peloCum >= breakCum`が成立してしまう。逃げ要員の初速ボーナスも区間0限定。AIの逃げ形成率も低い。

- `aiBreakawayFormationRate(type, raceGrade)` — AIが逃げ要員を送る確率（現状0.1〜0.35で低い）
- `minBreakawayAttempts` — 1レース最低保証される逃げ形成人数
- `breakLaunchGapSeconds` — 初速ジャンプを能力加算でなく実秒の頭出しギャップに再定義（区間0限定を廃止）
- `chaseIntensityDelta(push/hold)` — ±6→±15〜20、または区間タイムへの%乗算に変更
- `groupTickResolution` — 1区間を複数ティックに分割してギャップを段階的に描くための解像度
- `liveGapSeconds`（UI公開）— 逃げ−メインのギャップを常時表示

## B. ローテーション・駆け引きの可視化（FB④）
- `rotationOrder[]` / `rotationPeriodSeconds` — クラスタ内の牽引先頭を周期的に交代させるデータ
- `pullContributionWeight(rider)` — 牽引/後方時の個体差可視化
- `counterAttackProbability(segType)` — ライバルの仕掛け確率
- `radioReactionWindow` — 仕掛け発生時にプレイヤーの反応を促す時限イベント枠

## C. リザルトと3D観戦の非同期（FB⑤・バグ）
原因特定：最終スプリント中に📻を押すと最終区間が再抽選され、既に見せた映像と結果が食い違う。

- `finalSegmentLocked`（bool）— 誰かが最終区間に入ったら📻操作を無効化／対象を未突入の選手に限定
- `raceOutcomeFreezeThreshold` — フリーズ発動境界（区間開始時か先頭進入時か）

## D. エース早期発射のリアリズム（FB⑥⑦）
- `attackEnergyInitial(stamina)` — アタック専用スタミナ資源
- `attackEnergyDepletionRate` — ソロ走行時の消費速度
- `blowUpThreshold` / `blowUpPenaltyMultiplier` — 資源枯渇時の能力急落率
- `soloEffortPenalty` — 人数依存ボーナス関数の負側として一般化

## E. 静観／追走強化の実感不足（FB⑧）
Aと同根本原因。追加で：
- `visibleFuelBar`（UI）— 牽引役フューエル消費を画面表示
- `chaseModeFeedbackText` — 選択直後に効果を実況で明示

## F. クラス昇格の変化不足＋昇格解禁ラダー（FB⑨＋既存v7予定）
**A昇格**：2日間ステージレース＋FA移籍市場＋スタッフ1枠
- `stageCount`(=2)、`gcTime[riderId]`（総合タイム）
- `interStageFatigueRecovery` / `interStageInjuryCarry`
- `faMarketPoolSize` / `faMarketRefreshRate` / `faPriceModel(rider)`

**PRO昇格**：グランツール（4ステージ・総合）＋海外遠征＋スタッフ3枠
- `grandTourStageCount`(=4)
- `overseasRaceFrequency` / `overseasDifficultyMultiplier` / `overseasTravelFatiguePenalty`
- `staffRoles={manager,trainer,doctor}` と各`Effect`変数、`staffSalaryModel[role]`、`staffHireMarket`
- `classUnlockFeatureMap={A:[...], PRO:[...]}`

**昇格変化の底上げ（ラダー以外）**
- `segmentCountByClass`（クラスが上がるほどレースが長くなる）
- `classAiBehaviorProfile`（上位クラスほどAIの役割分担が高度化）

## G. 役割の細分化（FB⑩）
- `roleTypes`拡張：`ace / breakaway / leadDomestique(第一アシスト) / subDomestique(第二アシスト) / mountainDomestique(山岳アシスト) / flatDomestique(平坦アシスト)`
- `roleActivationWindow(role, segType|segIndex)` — 牽引／温存／離脱の区間マップ
- `roleDropTrigger(role)` — 自動離脱条件（例：平坦アシストは最初の山岳区間で自動離脱）
- `roleFuelConsumptionProfile(role)` — 役割ごとの消耗曲線
- `assistTarget[riderId]` — 支援先（エース以外＝第一アシストを支援、等）

## H. コース可視化・難易度（FB⑪⑫）
- `courseElevationProfile[]` — 距離%ごとの標高サンプル（プレビュー用に公開）
- `totalElevationGain` / `climbCount` / `descentCount`
- `seg.gradient`（%）/ `seg.elevationGain`（m）— 離散カテゴリから連続値へ
- `climbWeight(gradient)` — 斜度に応じた登坂比重関数
- `raceDifficultyRating` — 総合難易度指標（AI強度・賞金/pt倍率・推奨能力表示に利用）

## I. 脚質の形骸化（FB⑬）
- `typeAffinityBonus(type, segType)`
- `typeRoleSuitability(type, role)` ＋ `roleMismatchPenalty`
- `typeGrowthBias`
- `typeFatigueProfile`

## J. パーツ細分化（FB⑭）
- 新スロット候補：`wheels`（フレームと分離）／`nutrition`／`groupset`／`shoes`
- `partSlotCount`（2→4〜5）
- `partSetBonus`

## K. ステータス収束問題（FB⑮）
根本原因：指定外能力への無条件+20%成長にトレードオフがない。
- `growthAllocationTradeoff` — ゼロサム寄りの配分に変更
- `typeCapDifferential(type, ability)` — softFactorの閾値を脚質×能力で変える
- `offFocusDecay` — 性格と逆行する能力の緩やかな減衰
- `veteranDeclineProfile(type)` — 衰え期の減衰を非得意能力でより急に

## L. OVRと実力の不釣り合い（FB⑯）
- `ovrWeightingModel` — 単純平均→上位N加重（例：50/30/20）
- `contextualOvr(rider, tmpl)` — レーステンプレート区間構成に応じた加重OVR
