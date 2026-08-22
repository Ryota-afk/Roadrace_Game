# 第15弾：血脈レシピ（順序を含む隠し配合）＋`state.js`分割

7番（配合面の深掘り）に着手する。あわせてCLAUDE.md §5に沿って`state.js`（1,096行・現在最大）を分割する。

## 着手時の実測

### 7番の記述と現状のズレ

DEVLOGの7番は「血統表の可視化（家系図）、特殊配合の実装」と書かれているが、**両方とも一部は実装済み**だった。

| 7番の記述 | 実際の状態 |
|---|---|
| 血統表の可視化（家系図） | **実装済み**（第13弾3-D-3で`dynasty.jsx`の系譜ツリーを表形式へ再設計） |
| 特殊配合の実装 | **5件実装済み**（`ML_SPECIAL_MATINGS`・`data/breeding.js:39`） |
| 「4体を適切な順番で」 | **未着手**＝これが第15弾の実体 |

### 既存の特殊配合5件（`ML_SPECIAL_MATINGS`）

| key | 称号 | 条件（`test(ctx)`） | 報酬 |
|---|---|---|---|
| `absolute_king` | 絶対王者の系譜 | `world1`が2つ | 金特`big`・才能+4・成長+1 |
| `hero_emperor` | 覇道義侠録 | `emperor` かつ `hero`/`heroMulti` | 金特`big`・才能+3・成長+1 |
| `iron_blood` | 不屈の鉄血 | `ironman`＋`iron`特能で計2以上 | 金特`iron`・才能+2・追加`tough` |
| `all_rounder` | 万能王の血脈 | 登坂系×平坦系のspecialist交配 | 金特`engine`・才能+3・成長+1 |
| `pure_blood` | 純血の極み | 同一系統かつ両者`generation>=4` | 才能+4・成長+1・因子金特化 |

**判定軸は「親2体の属性の組み合わせ」のみ**（`mlSpecialMating(parentA, parentB)`が受け取るctxは
`{keys, abs, lineA, lineB, genA, genB}`で、世代の**順序**は見ていない）。
**報酬も数値の上乗せ**（`talent`/`growth`/`gold`）に留まり、「質的に別物の1体」にはなっていない。

### 配合の導線と周回コスト（設計の制約）

- 配合は**新キャリア作成時**に行う：`mlCreateChar(s, type, background, master, partner, cpMeta)`で
  殿堂から`master`（恩師）と`partner`（配合相手）の2体を選ぶ（`screens/mylife/create.jsx`）。
- **1キャリア＝殿堂1体**（引退時に`mlRecordLegend`で1件追加）。
- デビュー18〜25歳（高卒/大卒/実業団卒）、引退は自分で選択（v35で強制引退廃止）。
  `GROWTH`のpeakは`late:[28,33]`・`super_late:[32,38]`なので、**1周およそ10〜17年＝120〜200ターン**。
- ＝**「4体」を素直に要求すると4周（数百ターン）が前提**になる。深さ＝周回コストに直結する。

### 系譜データの保存状況（レシピ判定に使える材料）

`mlLegendSnapshot(s)`（`breeding/breeding.js:229`）が引退時に保存する系譜関連フィールド：

| フィールド | 内容 |
|---|---|
| `bloodId` | `"b:名前#retiredAt"`。個体の一意キー |
| `parents` | 両親の`bloodId`配列（`r.parentBloodIds`） |
| `ancestors` | 祖先の`bloodId`配列（**最大12件**） |
| `generation` | 世代数（`max(親A, 親B) + 1`） |
| `lineageName` | 系統名 |
| `plusValue` | 累代+値 |
| `careerArchetypeKey` | 生き様（`world1`/`emperor`/`hero`/`heroMulti`/`specialist_*`/`domestique`/`nearly`/`ironman`/`latebloom`） |
| **`specialMatingTitle`** | **前の代で成立した特殊配合の称号**（`r.specialMating`があれば） |
| `specialAbilities` / `growthPow` / `finalAbilities` / `finalSubStats` / `wins` / `podiums` | 能力・戦績 |

**`specialMatingTitle`が保存されている点が決定的**：「前の代で○○が成立していること」を次代の条件に
書けるため、**順序を含むレシピが既存データの延長で表現できる**。

**ただし`ancestors`は`bloodId`の文字列配列でしかない**（祖先が「どんな選手だったか」は入っていない）。
`loadMlLegends()`から`bloodId`で引く手はあるが、殿堂は手動削除できる（`career.jsx:504`）ため
**殿堂の状態に依存する判定は壊れうる**。→ 下記Aで「血の印」を累積させる方式を採る。

### 既存の配合限定特能（伝説特能の強さの基準）

`data/abilities.js:103-105`（`breedOnly: true`＝スカウト・後天習得では絶対に出ない枠が既にある）：

| id | ラベル | 効果 |
|---|---|---|
| `sireline` | 系統の申し子 | 全能力+3 |
| `dynasty` | 覇道の血脈 | 全能力+2・スタミナ+3 |
| `hybrid` | 二刀流 | 登坂・スプリント+2、丘陵/山岳/スプリント区間で+5 |

### 衰えの実装箇所（「成長曲線が別物」を作る場所）

`growthPhase(r)`（`domain/shared/growth.js:65`）：

```
if (r.age < ps) return { gain: 1.0 * mul, dec: 0, tag: "成長期" };
if (r.age <= pe) return { gain: 0.5 * mul, dec: 0, tag: "全盛期" };
return { gain: 0.1 * mul, dec: Math.min(1.2, 0.25 * (r.age - pe)), tag: "衰え期" };
```

**この関数はseason/mylife共通**なので、触ると両モードに効く。

### 波及範囲の注意：配合はシーズンでも使われている

`mlBreedBonus`の呼び出し元は**マイライフだけではない**：

- `screens/mylife/create.jsx:100`（マイライフのキャラ作成＝本来の配合）
- `screens/season/hub/riders/youth.jsx:19`（シーズンの血統ユース）
- `controllers/season/roster.js:116`（同・実際の加入処理）

＝**`mlBreedBonus`に伝説特能を足すと、シーズンの血統ユースにも流入する**。設計で切り分けが要る（下記E）。

## 確定仕様（ユーザー合意済み）

1. **「質的に別物の1体」＝複合**：伝説特能＋成長曲線の変化＋専用称号・演出を全部入れる。
2. **深さ＝階層化（2代〜4代）**：軽いレシピ（2代＝2周）から最上位（4代＝4周）まで段階を作る。
3. **発見＝段階的なヒント**：未発見は伏せるが、条件の一部を満たすと「あと一歩」が見える。
   完全に隠すと1周120〜200ターンでは試行回数が稼げず誰も到達できないため。

## 詳細設計

### A. 判定基盤：「血の印（bloodMarks）」の累積

`ancestors`が`bloodId`の羅列でしかなく、殿堂の削除で壊れうる問題を回避するため、
**各代が「どんな血だったか」を印として累積し、選手自身に持たせる**。

```
player.bloodMarks = [ { gen: 1, mark: "nearly" }, { gen: 2, mark: "world1" }, ... ]
```

- **印の決め方**（1個体につき最大2印）：`careerArchetypeKey`（必ず1つ）＋
  その代で成立した`specialMating.key`があれば追加（`sm:absolute_king`の形）。
- **累積**：`mlCreateChar`の配合枝で、両親の`bloodMarks`をマージし、
  自分の世代番号`generation`を持つ印を後で（引退時に）足す。**上限24件**（`slice(0, 24)`。
  `ancestors`の12件と同じ発想で、無制限に膨らませない）。
- **保存**：`mlLegendSnapshot`の返り値に`bloodMarks`を追加する（1フィールド追加のみ）。
- **旧セーブ互換（必須）**：`bloodMarks`を持たない既存の殿堂選手は、
  `legendArchetypeKey(leg)`＋`leg.specialMatingTitle`から**その場で導出**する
  （`deriveBloodMarks(leg)`）。これが無いと、今遊んでいる人の殿堂が全部レシピ素材として
  無効になり、実質4周のやり直しを強いることになる。

新規ファイル**`src/breeding/recipes.js`**（`breeding.js`は既に447行。レシピ定義＋判定は
別ファイルへ分ける）。

### B. レシピ定義（実装済み・確定）

`src/breeding/recipes.js`に`ML_BLOOD_RECIPES`として実装済み（判定は`matchBloodRecipe`、段階的ヒント用の
進捗計算は`bloodRecipeProgress`）。設計案からの変更点を含め、以下が確定版。

| # | key | 称号 | 深さ | 条件（世代順） | 物語 |
|---|---|---|---|---|---|
| R1 | `revenge` | 雪辱の血脈 | 2代 | gen1に`nearly`（勝てなかった選手）→ gen2で`world1`または`emperor` | 勝てなかった父の無念を子が晴らす |
| R2 | `twin_edge` | 二刀の血統 | 2代 | gen1に`specialist_CLM`or`specialist_PUN` → gen2に`specialist_SPR`or`specialist_RUL` | 相反する才能（登坂↔平坦）が二代を経て一人に融合する |
| R3 | `three_gen` | 三代の悲願 | 3代 | gen1=`nearly` → gen2=`nearly` → gen3=`world1` | 二代続けて勝てず、三代目が頂点に立つ |
| R4 | `iron_peak` | 不落の山嶺 | 3代 | gen1=`ironman` → gen2=`specialist_CLM` → gen3=`specialist_CLM` | 鉄の肉体の上に三代にわたって山の血が積み重なる |
| R5 | `supremacy` | 覇道極まれり | 4代 | gen1=`emperor` → gen2=`hero`or`heroMulti` → gen3=`world1` → gen4は任意の特殊配合（`sm:`接頭辞） | 四代かけて覇道が極まる |

**設計案からの変更点（実装時に判明・R2/R4）**：`bloodMarks`が記録するのは
`careerArchetypeKey`と特殊配合keyだけで、脚質(`type`)や個別の特殊能力（二刀流="hybrid"・
山の申し子の金特="mount"等）は記録していない。R2の「2代目が`hybrid`保持」・R4の
「gen3が`mount`金特を保持」は記録されていないデータへの参照で実装不能だったため、
印の並びだけで判定できる条件へ差し替えた（R2は登坂系→平坦系のspecialist連鎖のみに、
R4はironman→specialist_CLMの連鎖を1代分伸ばして3代の登坂の血に変更）。

**達成可能性の分析（実測ではなく既存データに基づく確認）**：
レシピが参照する`careerArchetypeKey`はすべて`mlCareerArchetype()`（`breeding.js`、第13弾以前から
実装済み・生き様の称号として殿堂表示に既に使われている既存機能）が判定するキーであり、
本弾で新設したものではない。実際に何世代分もの新規プレイスルーを回して検証する代わりに、
判定条件（if/elseの優先順位を含む）をコードから直接確認し、狙って到達可能かを分析した：
- `nearly`（表彰台12回以上かつ勝利3回以下）：上位分岐（world1/heroMulti/hero/classicKing/
  classicHunter/emperor/specialist_X/domestique）のいずれにも該当しない、かつ表彰台を積む
  プレイが条件。「エースとして走るがタイトルを取らせない・勝たせすぎない」プレイで意図的に
  到達可能（勝利を抑えつつ表彰台を狙うのは難度は高いが再現性のある操作）。
- `world1`（世界ランキング1位経験）・`emperor`（通算勝利25以上）：既存の実績システム
  （`ML_ACHIEVEMENTS`）でも上位実績として扱われる到達点で、長期プレイで既に到達実績のある
  ライン。
- `hero`/`heroMulti`（タイトル1回/2回以上）：世界選手権・五輪という既存の大舞台システムに
  紐づく既存の到達点。
- `ironman`（在籍12年以上または引退年齢36歳以上）：意図的に選手寿命を伸ばすプレイ
  （早期引退させない）で到達可能。
- `specialist_CLM`（CLM型で通算勝利8〜24、かつタイトル0・クラシック3勝未満）：CLM型を選び
  勝利を積みつつ大舞台のタイトルを取らない、という狙って作れる条件。
- 特殊配合（`sm:`接頭辞）：既存の`ML_SPECIAL_MATINGS`（5種）が成立した配合で自動的に付与される。

いずれも「上位の希少な分岐を踏まずに、特定の条件だけを満たす」という操作でプレイヤーが
意図的に狙える設計になっている。1レシピ＝2〜4回の完走プレイスルーが必要な高コストな
やり込み要素である点は§設計制約で既に合意済み。

### C. 生まれる個体（「質的に別物」の中身）

3つを同時に付与する。

**(1) 伝説特能**（`breedOnly: true`の最上位枠として`data/abilities.js`へ追加）

既存の`sireline`（全能力+3）・`dynasty`（全能力+2・スタミナ+3）の1〜2段上に置く。

| id | ラベル | 効果（案） | 対応レシピ |
|---|---|---|---|
| `revenant` | 雪辱の継承 | 全能力+4、最終区間の追い込み+0.04 | R1 |
| `twinsoul` | 万能の極致 | 全能力+3、全区間で+4（`hybrid`の上位互換） | R2 |
| `destiny` | 宿願成就 | 全能力+5、大舞台（grade>=3）でさらに+5% | R3 |
| `unfallen` | 不落 | 全能力+4、登坂・山岳で+6、消耗-10% | R4 |
| `sovereign` | 絶対王者の血 | 全能力+6、全区間で+5、消耗-8% | R5 |

**(2) 成長曲線の変化**：`growthPhase(r)`の衰え`dec`を抑制する。

```
// 案：伝説特能を持つ個体は衰えが緩やかになる
const decayMul = hasAbility(r, "sovereign") ? 0.0    // 衰えない
               : hasAbility(r, "destiny")  ? 0.5     // 半減
               : 1.0;
return { gain: 0.1 * mul, dec: Math.min(1.2, 0.25 * (r.age - pe)) * decayMul, tag: ... };
```

**注意**：`growthPhase`はseason/mylife共通関数。伝説特能はマイライフ限定で付与する設計（下記E）
なので実害は無いが、**関数自体は両モードから呼ばれる**ことを実装時に意識する。

**(3) 専用称号・演出**：`player.bloodRecipe = { key, title, note, color }`として保持し、
デビュー時の`initLog`に専用の一文を出す（既存の特殊配合`player.specialMating`と同じ扱い）。
`mlLegendSnapshot`にも`bloodRecipeTitle`として残し、次代のR5条件に使う。

**バランス上の論点**：既存の`talentCap`は上限8（`Math.min(8, ...)`）、`mlGrowthCap`は
`min(140, 90 + 時間成分 + 実績成分 + player.talentCap)`。伝説特能の能力+6と衰え無効を重ねると
**上限140に容易に届く**可能性がある。実装後に「4代到達個体が何年目に何点へ到達するか」を
実測し、必要なら係数を下げる（第14弾のTT較正と同じ手順）。

### D. 段階的ヒントのUI

**置き場所**：配合画面（`screens/mylife/create.jsx`。既に`master`/`partner`を選ぶUIがある）の
配下に「血脈レシピ」セクションを新設する。既存の「因子図鑑」（`dynasty.jsx`）とは別。

**3段階の開示**：

| 状態 | 判定 | 表示 |
|---|---|---|
| 未接触 | 保有する殿堂の`bloodMarks`がレシピの**第1条件すら**満たさない | `？？？`（存在だけ示す・条件は伏せる） |
| あと一歩 | **第1条件以降を満たしている**が最終条件が未達 | 称号名と**満たした分だけ**開示（例：「雪辱の血脈：1代目 ✓ 雪辱の血／2代目 世界の頂点へ」） |
| 達成済み | 過去に成立させた（メタ保存） | 全条件＋効果を開示 |

**達成済みの記録**：`loadMeta()`（`roadrace_v12_meta`）に`bloodRecipesFound: []`を追加し、
**プレイを跨いで**保持する（殿堂・系統レジストリと同じ扱い）。

**empty state**：殿堂が0件（＝初回プレイ）のときはセクション自体を出さない
（配合そのものができないため）。

**この画面の見た目はCLAUDE.md §8の対象**＝実装前にサンプル候補を複数提示して合意を取る。
本設計では「何を・どの段階で出すか」までを確定し、レイアウトは別途詰める。

### E. シーズン血統ユースへの波及の切り分け

`mlBreedBonus`はシーズンの血統ユース（`youth.jsx`・`roster.js`）からも呼ばれるため、
**血脈レシピの判定と伝説特能の付与は`mlBreedBonus`の中に入れない**。

- `mlBreedBonus`は現状のまま（＝シーズンの血統ユースの挙動は一切変えない）。
- 血脈レシピは`mlCreateChar`（マイライフのキャラ作成）でのみ判定・付与する。
- 根拠：シーズンは6名ロースターのチーム運営で、1人が突出しても設計意図が違う。
  また伝説特能は「何周もかけて血を繋いだ証」であり、シーズンのユース枠に湧くと意味が壊れる。

### F. `state.js`の分割（CLAUDE.md §5）

現状1,096行に5つの関心事が同居している。

| 現在の行 | 内容 | 移動先 | 概算 |
|---|---|---|---|
| 27〜60 | `totalTitleCount`/`computePrestige`/`unlockedTemplates` | `state/prestige.js`（新規） | 約34行 |
| 62〜251 | `genWorldRosters`/`ageWorldRosters`/`topUpWorldRosters`/`sharedWorldRosters`/世界メタ | `state/worldRoster.js`（新規） | 約190行 |
| 253〜497 | `genMonthRaces`/`initGame`/シーズンのsave/load | `state/seasonState.js`（新規） | 約245行 |
| 499〜784 | アンビション定義・`initMyLife`/マイライフのsave/load・`mlGenTeammates`/`ML_TACTICS` | `state/mylifeState.js`（新規） | 約286行 |
| **785〜1016** | **`buildMyLifeSim`** | **`sim/buildMyLifeSim.js`（新規）** | **約231行** |
| 1018〜1096 | `loadMeta`/`CP_SHOP`/`cpBuy`/タイトル台帳 | `state/meta.js`（新規） | 約79行 |
| 残り | 再exportの互換シム | `state/state.js` | 約30行 |

**`buildMyLifeSim`の移動が最も重要**：シーズン側の対になる`buildSim`は`sim/buildSim.js`にあり、
**同じ役割の関数が別レイヤーに分かれている非対称**が第14弾37番のバグ（`noGroup`のハードコードが
マイライフ側だけに残っていた）の遠因だった。sim層へ揃える。

- **互換シム必須**：`state.js`からのimportは広範囲（`logic/support.js`が再exportしている・
  `screens/`各所）。CLAUDE.md §5に従い、移動元`state/state.js`に`import`＋`export {}`を置き、
  **呼び出し側は無変更で動かす**。
- 依存は下向き一方通行を保つ。`sim/buildMyLifeSim.js`が`state/state.js`を参照しないよう注意
  （現在`teamsForClass`を使っているが、これは`data/teams.js`由来なので直接importに切り替える）。

## 実装対象（順序）

1. **F：`state.js`分割**（先に土台を整える。配合はマイライフ状態に触るため）
2. A：`bloodMarks`の累積基盤＋旧セーブ互換の`deriveBloodMarks`
3. B：`ML_BLOOD_RECIPES`定義＋`breeding/recipes.js`の判定
4. C：伝説特能5種＋`growthPhase`の衰え抑制＋称号・演出
5. D：段階的ヒントUI（**見た目は§8に従い候補提示→合意してから**）
6. 較正：4代到達個体の到達能力を実測し、上限140に対して過剰なら係数を下げる

## 検証

- **F**：分割後に`npm run build`成功＋Playwrightで両モードの主要画面を通す（第14弾Dと同じ経路）。
  互換シム経由で既存importが壊れていないことを確認。
- **A/B**：`bloodMarks`の累積をNodeで単体検証（2代・3代・4代を合成して各レシピが正しく発火するか、
  誤発火しないか）。**旧セーブ互換**（`bloodMarks`なしの殿堂）でも判定できることを必ず確認。
- **B（達成可能性）**：条件に使う`careerArchetypeKey`が実際に狙って出せるかを実測。
  出せない条件があれば差し替える。
- **C（バランス）**：4代到達個体が何年目に能力何点へ達するかを実測し、`mlGrowthCap`の
  上限140に対して壊れていないか確認。壊れていれば係数を下げて再測定。
- **E**：シーズンの血統ユースの挙動が**一切変わっていない**ことを前後比較で確認
  （`mlBreedBonus`に触っていないことの実証）。
- 計測は必ず`mlCreateChar`／`mlBreedBonus`経由で行う（第14弾の「測定上の注意」と同じ原則：
  手組みのオブジェクトを渡すと必要フィールドが欠けて誤った結果が出る）。
