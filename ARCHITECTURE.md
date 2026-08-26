# ARCHITECTURE.md — 生きたアーキテクチャ参照

`DEVLOG.md`から分離した「§3 アーキテクチャ」の全文（2026-08・第38弾で分離）。
**DEVLOG.md内の「§3」「§3「〜」参照」という表記はすべてこのファイルを指す。**

分離した理由：DEVLOG.mdが67KB（約26,000トークン）に達し、実測のRead上限25,000トークンを
超えたため。超えると切り捨ては末尾から起きるので、真っ先に読めなくなるのが最も必要な
「次のアクション」だった。アーキテクチャは分量が大きく参照頻度も高いので独立させ、
DEVLOG.mdは索引とTODOに専念させる。

**性格**：ここは履歴ではなく**現行仕様の正本**。「いつ変わったか」はDEVLOGと`git log`が持つ。
ここに書くのは「今どうなっているか」と「触ると何が壊れるか」だけ。仕様を変えたら同時に直す。

---

## 3. アーキテクチャ（関数名で参照・随時更新する生きた参照）

### レースsim（両モード共通）
- `simulateTicks(course, riders, fromTick, directive, noGroup)` … **レース全体を先に計算**（finishTimeまで）。
  RaceView は `posHist/energyHist/modeHist/...` の**再生専用**。
- `buildMyLifeSim(raceMeta, player, myTeamName, classIdx, difficultyId, dayTag, directiveKey, rival, year, rival2, teammates, tactic)`
- `canPull(en, segType)`（誰が牽引できるか）, `assignAIRoles`, `effAbilities`, `overall`, `newRider`, `mulberry`(seeded RNG), `pickRiderName`
- 役割 role：`ace/lead/sub/mountain/flat/breakaway`。draftモードは省エネ、pullは全消費。
- **残脚ゲート（`legsLeft01()`）**：判断カードの一手の威力は残脚に比例する。
  **レンジは`LEGS_EMPTY=-45`〜`LEGS_FULL=95`**（判断カードが出る瞬間の残脚の実分布に実測較正済み）。
  ⚠️ 上限を下げると`legsLeft01`が常に1.00へ張り付き**ゲートが無効化される**（旧値-90〜40で発生）。
  比例するのは`send`(持続4〜18tick・追い込み0.03〜0.13)、`attack`(持続10〜30tick)、
  `kick`(0.03〜0.11)、`kickBig`(0.05〜0.17)、`sprintWait`(0.04〜0.13)。
  判断カードには「脚の残り」ゲージ（バー＋一語）で可視化。**RACE_MOVESは両モード共通定義**。
- ⭐**集団の速度構造（第51〜55弾で確定・逃げに触る前に必読）**：
  `const groupDist = puller.lastOwnDist;` ——**集団の速度は「牽引できる中の1人が全力で牽いた距離」
  だけで決まり、人数の項が存在しない**。実測で3人・6人・12人・24人の集団は500tick後に完全に
  同位置（126.6）で、違うのは残脚だけ（3人43.4／24人91.2）。⚠️**つまり逃げは時間差を作れず、
  「同じ位置のままより疲れてゴールする」ことしかできない**。
  さらにプレイヤーは**99.0〜99.1%のtickで集団内**（千切れ閾値までの余裕ratio中央値1.20）で、
  `ticks.js`の自発的アタック抽選から**明示的に除外**されている。
  ⚠️**集団にいる間は全員が`dist = groupDist`＝同速で、自分の能力が捨てられる**。
  → **数値でバッジ・能力の個性を出す道は構造的に塞がっている**（第49〜51弾の実測）。
- ⚠️**逃げの速度を触る案は4回失敗しており、軸そのものが行き止まり**（第52弾＝定数／第53弾＝集団
  ごとのテンポ→先頭集団が最も遅くなり融合／第54弾＝全体のテンポ→`hold`が3〜6着悪化／第55弾＝
  協調による速度→`hold`が5着悪化）。⭐**フィールドの一部だけを速く/遅くしても壊れ、全体を速く
  しても（レース時間が縮み選抜の累積が減るため）壊れる**。⚠️**速度案を再提案しないこと。**
  残る軸は**エネルギー経済**＝`energyDrain`の`brk`（`committedBreak`かつ`solo`/`attack`の時だけ
  掛かる消耗割引。現行`{mtn:0.4, climb:0.45, hill:0.55, flat:0.75, sprint:0.85, tt:0.75}`）。
  実測で**全地形一律`brk=0.22`にすると`hold`の平均着順が12.93→12.93と完全に同値のまま
  `attack−hold`が+12.25→+1.43**になる（集団に触らないので基準点が動かず、速度差を作らないので
  選抜も壊れないため）。⚠️`brk`は`solo`/`attack`専用＝**単独逃げにしか効かない**。
  ⚠️`brk≤0.18`は行き過ぎ（今度は「常に仕掛けるのが正解」になる）。
- **決着へのバッジ合流（`finish.js`）**：`finishAbility`は素の`en.climb`等に加えて
  `badgeSegmentBonus(segType, e) * FINISH_BADGE_K`を足す（第50弾。これが無いと**僅差ゴール＝
  実測で約半分のレースでバッジが無かったことになる**）。⭐**`FINISH_BADGE_K = 2`が確定値で、
  K=3以上は1桁まで完全に同じ数値になる**（`resolveFinishClusters`は**同着集団の中でしか
  並べ替えない**ため「その集団で1位」に届いた時点で頭打ち。どの集団にいるかはtick側が決める）。
- **`conserve`の強さを動かす方法**：支配的なのは消費倍率(`conserveMul`)ではなく
  **「`conserveLeft>0`の間は牽引ローテの`eligible`プールから完全に除外される」効果**（他の手は
  ローテに参加し消費の大きい`pull`が回ってくるが`conserve`だけ免除される）。
  倍率をいくら緩めても効かない。**効かせたい／抑えたいときは`CONSERVE_TICKS`(現40)を動かす**。
- **集団内の位置取り（`slot`）**：`slot`は「牽引ローテ待ち順」ではなく
  **脚力(`ownCapable/groupDist`)・残脚・判断カードの意思で決まる前後位置**。前方ほど千切れにくい
  （`keepThresh`に`posShare * POSITION_TIGHT_SPAN(0.015)`を加算）。後方ほど`backRatio`経由で
  回復が大きいため、**「前は生き残るが回復しない／後ろは回復するが置いていかれる」**が成立する。
  UIの「次に牽引」表示は`slot`ではなく`nextPuller`（別フィールド）を見ること。
- **演出専用の乱数（`domain/shared/viewHash.js`・§36-Cで新設）**：`sim/race.js`の`riderHash01`は
  着順計算に使うため変更不可（`(id*2654435761+salt*40503)%100000`は`2654435761 mod 100000=35761`で
  線形写像に退化し、演出に使うと集団が規則的に動いて見える）。集団描画の揺らぎ等**演出専用の箇所は
  必ず`viewHash01`/`viewWander`（ビット混合する32bitハッシュ）を使うこと**。
- **チームドラフト**：同じ集団で前にいる**味方**の人数・牽引中かがドラフトの消耗と
  `keepThresh`へ連続的に効く（全チーム対称）。エースへの能力値書き換え（99キャップ付きの
  作り話）は**廃止済み**。`canPull()`から`isAssisting`除外を外し、アシストは供給側として牽く。
- **AI選手の能力の決定論**：`core/core.js`の`idYearSeed(id, year)`で自チームメイト・
  ライバル・対戦AIの能力を**年内固定・年をまたぐと変化**に統一。土台を固定した上で当日の
  当たり外れは`aiFormRoll(rng)`（±5%程度・プレイヤーのピーキング±17%より小さい）で与える。
- **相手能力の"査定値"（`domain/shared/scouting.js`）**：AI選手の能力値は永続化されておらず
  レースの文脈（★・クラス・難易度）から毎回生成される（同一選手が★1でOVR63・★3で71）。
  `aiPowerFor()`が基準文脈での査定値を計算し、スカウトLv（シーズン）／対戦経験
  `riderStats[id].races`（マイライフ）で**4段階に開示**する
  （未分析→総合力帯→適性グレード→数値。UIは`ScoutBadge`）。
- **TTペース配分ゆらぎ（`sim/race.js`）**：TTは単独走で距離が長く毎tickの±3%
  （`tickSpeedFactor`）が平均化されて実質決定論になるため、`simulateTicks`の`fromTick===0`枝で
  `en.ttPacing`をレース単位1回だけ抽選する（`TT_PACING_SPREAD=0.06`・実測較正済み）。
  `steadyMul(en)`で`stability`（安定感）が振れ幅を調整（高いほど小さい）。`stability`は
  `effAbilities()`が`e.stability = r.stability ?? 50;`で乗せるため両モードに自動配線される。

### マイライフ状態
- `initMyLife()` / `mlCreateChar(type, background, master, partner, cpMeta)` / `mlGenRace(year, month, classIdx)`
- 月次：`mlAdvanceMonth`, `mlApplyMonthEffect(player, mode, ctx)`
- **レース選択（第41弾）**：`mlGenRaceCandidates(year, month, classIdx)`（`domain/mylife/race.js`）が
  月ごとの候補配列を返す。看板レース6ヶ月（5/8/10月の古典・9月世界選手権・7月五輪年・3月年度末）
  は長さ1、残り6ヶ月は長さ3（地形重複なし・グレード/天候/ライバルは候補ごとに個別に振る）。
  生成は決定的（同一年月クラスは常に同一候補）。`mlGenRace`は`mlGenRaceCandidates(...)[0]`を返す
  薄いラッパとして残置（`worldRank.js`等の1本で足りる用途向け・無改変）。
  **`mlSelectedRace(ml)`が`ml.sel.raceId`（`initMyLife`に元から存在した未使用フィールド）を
  解決し、未設定/該当なしは`races[0]`へフォールバック**——`races[0]`を直接読んでいた6箇所は
  全てこのヘルパー経由に統一済み。`mlStartRace`は選択中の候補を`resolveNationalRole`で解決した
  結果を該当id位置へ書き戻し、`sel.raceId`をその id へ固定する。新しい月の候補生成時は必ず
  `sel:{raceId:null}`にリセットする（前月の選択を持ち越さない）。
- ⭐**出走計画（第43弾）**：`ml.raceFocus`（`climb`/`hill`/`sprint`/`solo`/`null`）を宣言すると、
  **通常月の候補3本のうち1本が必ずその適性のレースになる**（確率ではなく確定仕様）。
  ⚠️これが無いとプレイヤーは地形をほとんど選べない——コーステンプレは6種で山岳を含むのは
  2種、候補1本の月がクラス2以降で年6ヶ月あるため、狙っても年の半分は選択肢が無かった。
  効果は山岳が年3.4本→**8.1本**、独走が年1.2本→**7.0本**。⚠️**TT型は年1.2本しかTTを走れて
  おらず、ビルドが事実上成立していなかった**（`soloist`が狙っても0.33止まりだった原因）。
  ⚠️**これらの数字は開発用で画面には出さない**（ユーザー明示）。看板レース月は無変更。
  `focus=null`なら生成は第41弾と完全一致するため旧セーブは無移行で安全。
- **目標バッジ宣言（第41弾）**：`ml.badgeGoals`（最大3件・配列）。キャラ作成の素質確認後の
  `mylife_badge_goals`画面で、`ACQUIRE_REQS`から体質12種（`iron`等）を除きその脚質の`gate`を
  通るもの（常に10種）から選ぶ。**強制力・ボーナスは一切ない「しおり」**——効果には未接続。
  上限到達後にさらに選ぶと最も古い選択を外す（`mlToggleBadgeGoal`、確認は挟まない）。
- セーブ：`ML_SAVE_FIELDS`（配列）、`saveMyLife/loadMyLife`。**playerはまるごと保存**されるので player.* は保存フィールド追加不要。
- **成長キャップ**：
  `mlGrowthCap(year, player, ml) = min(140, 90 + timeComponent(年数-1、最大+8) + achievementBonus(rungs×4+majors×5+winsBonus上限16)×難易度係数(易1.3/普1.0/難0.75/鬼0.5) + player.talentCap)`。
  時間成分より実績成分（`mlAchievementBonus`）が主役という配分（時間成分を+20→+8へ縮小した経緯は§38）。
  `growthPow`（S/A/B/C）は**到達速度のみに影響**、最終天井には影響しない（意図的な設計・§28参照）。
  シーズン側は`DIFFICULTIES.growthCap`（88/94/102/112、難易度で固定・選手ごとの差なし）。
- **能力別の上限オフセット `ML_TYPE_CAP_OFFSET`（`data/abilities.js`）はプレイヤーとAIで共有する**。
  `cap`を全能力へ一律にかけると、脚質ごとに形を付けて生成した選手の**得意能力だけが切り落とされ
  苦手はそのまま残る**（＝クライマーが万能型に見える）。AI側は`newRider`の`opts.capOffset`経由
  （typeが内部で確定した後に能力別で引く方式。呼び出し側が脚質を知らないまま上限を渡す既存
  呼び出しに対応するため）。査定値`scoutedAbilities`にも同じオフセットを通すこと（実挙動との
  食い違い防止）。低クラスでは上限自体が効かないため序盤は無変化。
  `bumpGrowthPow`, `GROWTHPOW_ORDER=["C","B","A","S"]`, `POW`。マスク：`mlGrowthPowRevealed(ml)`（`ml.year>=3`まで`🔒???`）。
- ⭐**年齢による成長フェーズ `growthPhase`（`growth.js`・第38弾で再較正）**：係数は
  **`1.0/0.5/0.1` → `0.55/0.30/0.28`**、`abilities.js`の`GROWTH`各peak終端を**+4歳**。
  ⚠️旧値は**30歳で全盛期0.5→衰え期0.1と1/10に急落する崖**で、これがカンストの真因だった
  （成長上限ではない）。⚠️**効くのはマイライフ＝本人のみ／シーズン＝自チーム6名のみ**
  （相手は別経路生成で据え置き）なので、ここを触るときは**総量保存**を必須条件にすること。
  ⚠️「熱心なプレイなら3〜4年目にカンスト」という旧メモは**測定誤り**（`careerWins:0`固定で
  測っており`mlGrowthCap`が実績で動くことを反映していなかった）。実際は全シナリオ一律9〜10年目。
- 能力成長の逓減カーブ：`growthFactor(v, cap, breakthrough)` / `softFactor(v, cap, breakthrough)`（`logic/support.js`）。
  上限を超えてどこまで伸ばせるかは`breakthrough`（突破力、生成時固定値・タイプ別base44〜58）の
  `breakthroughMul(breakthrough) = max(0.05, 1.0 + 0.08×(breakthrough-50))`で決まる。
  **season/mylife共通関数**のため、ここを触ると両モードに同時に効く。
- **家計（`mlLivingCost`）＝年俸税`salary/12*0.5`＋車`(carLv+1)*4`＋家`(houseLv+1)*4`＋コーチ月給。**
  **所持金はマイナスになる**（第36弾でクランプ除去。それ以前は不足分が黙って帳消しだった）。
  `ml.debtMonths`で3段階：1＝警告のみ／2〜3＝毎月`form -6`・`managerEval -1.5`／4以上＝さらに
  **維持費最大のものを毎月1つ強制売却**（同額なら車→コーチ→家。車家は定価50%返金しLv-1、
  コーチはLv-1・返金なし）。原因そのものを削るので自動収束する（デススパイラルにしない設計）。
- **専門コーチ（Lv制・`data/gear.js`）**：`ML_COACH_MUL=[1,1.25,1.33,1.40]`／
  `ML_COACH_SALARY=[0,6,10,15]`／`ML_COACH_SIGNING=100`（Lv0→1のみ）／`ML_COACH_MAX_BY_CLASS`・
  `ML_COACH_SLOTS_BY_CLASS`＝ともに`[1,2,3]`(B1/A/PRO)。
  実効Lvは必ず`Math.max(ml.gear[ML_AB_COACH_KEY[k]]?1:0, ml.coaches?.[k]||0)`で引く
  （旧セーブの買い切りをLv1相当で保護。`month.js`/`shop.js`/`events.jsx`の3箇所で同じ式。
  片方だけ生の`coaches`を見ると二重課金・解雇不能になる）。クラス降格で超過しても
  **強制解雇・降格はしない**（雇用と昇格が止まるだけ）。⚠️**倍率を上げる危険は天井ではなく均質化**
  ——focus以外は上限のはるか下で倍率が丸ごと効くため、全能力に高Lvを付けると万能型が再来する。
- 監督指示：`MANAGER_DIRECTIVES`（keyed, check-fn付き）, `mlGenDirective`。**復元時はキーで引き直す**（JSONで関数が消えるため）。
- 作戦：`ML_TACTICS`（balanced/wait/early/aggressive/assist）。
- **今月の行動レコメンド（§24）**：`domain/mylife/nextAction.js`の`mlNextAction()`が「今月何をすべきか」を
  1つだけ返す純関数。優先順位は4段：疲労85以上→休養（大舞台でも最優先）／大舞台レース＆疲労70未満→出走／
  通常レース＆疲労75未満→出走／それ以外→練習。
- **マスクされた値の扱い（§25で確立した原則・厳守）**：`growthPow`は3年目まで`🔒???`で伏せる仕様のため、
  **他の文言から等級を逆算できる形で出してはいけない**（デビュー特典「才能の片鱗」のノート文が
  `成長力C→B`と生の等級を書いており情報漏洩バグになっていた）。
  またマスク中は素質ランク・伸びしろヒントが単一ランクへ潰れるため、`mlTalentRank`・`potentialHint`は
  **`revealPow=false`専用のしきい値**を持つ（`mlTalentRank`＝`{B:0.5, A:2.1, S:3.8, SS:4.8}`／
  `potentialHint`＝`{中:2, 大:3}`。`revealPow=true`側は別のしきい値のまま）。
  伏せる値を増やす時は必ず「その値抜きで分布が潰れないか」を実測すること。

### 配合・血統
- `mlBreedBonus(parentA, parentB)` が全部返す：`nick/inbreed/plusValue/plusPer/abBonus/extraAbilities/subBonus/goldInherit/exclusive/archNotes/bakuhatsu/matingGrade/growthSteps/talentCap/danger/dangerLabel/healthMit/special`
  - **設計方針（厳守）**：爆発力・系統・特殊配合のボーナスは**初期能力に足さない**。伸びしろ（growthPow段数＋talentCap）＋称号＋金の特殊能力に還元する（序盤インフレ回避）。
  - `BREED_NICKS`（脚質相性）, `ARCH_BREED`（生き様の血）, `ML_SPECIAL_MATINGS`+`mlSpecialMating`（特殊配合）, `mlGradeColor`
- 系統レジストリ（プレイ跨ぎ／localStorage `roadrace_v12_bloodlines`）：`loadBloodlines/saveBloodlines`, `mlRegisterBloodline`(引退時), `mlBloodlineTier`（未確立→確立→名門→大系統）, `mlBloodlineFactor`, `mlBloodlineBonus`
- **血脈レシピ**：`breeding/recipes.js`に集約。`player.bloodMarks`（`{gen,mark}`配列。
  markは`careerArchetypeKey`または`"sm:"+specialMatingKey`）が世代ごとの「血の印」で、配合時に
  両親の`bloodMarks`を合流させる（`deriveBloodMarks`は旧セーブ互換の導出も担う）。
  `matchBloodRecipe(bloodMarks)`が`ML_BLOOD_RECIPES`（5件・2〜4代の順序パターン）と照合し、
  成立すると伝説特能5種（`data/abilities.js`・カテゴリ「血脈レシピ」）が
  `domain/mylife/createChar.js`内でのみ付与される。**`mlBreedBonus`自体には触れない**ため
  シーズンの血統ユースには影響しない。段階的ヒントUI用に`bloodRecipeProgress`/
  `bestBloodRecipeProgress`もここにある。

### 生きた世界
- **⚠️ `mlWorldStarsForYear`（24人の別世界）は§42 Phase 2-Dで完全退役済み**。もう存在しない。
  「毎回1年目から再シミュして世界を作り直す」方式は廃止し、**実際に走る300名の永続ロースター
  （`worldRosters`）と`riderStats`の実績だけ**で世界ランキング・ニュース・血統流入を組み立てる。
  過去のコードコメントに名前が残っているのは経緯の説明であって、呼び出しではない。
- ランキング：`computeWorldRank(riderStats, myWp)`（実順位）・`mlWorldBoard(ml)`（表示用の並び）・
  `worldPointsForFinish(rank, grade, classMul)`・`mlUpdateRiderStats(...)`・`decayRiderStatsWp(...)`
  （いずれも`domain/mylife/worldRank.js`）。
- ニュース：`mlBuildWorldNews({riderStatsById, leaderEntry, retired, debuted, year, prevWorldRosters,
  nextWorldRosters, prevLeaderId, rivalRetirements})`（`view/news.js`・第16弾B-1で5引数→1
  オプションオブジェクトへ変更、優先度順に最大7行）。実際に起きた出来事（王者交代・ライバル引退・
  大物引退・エース交代・節目の勝利数・新星デビュー）から組む。旧`mlWorldNews(seed, year, ...)`は無い。
- **ライバルのライフサイクル**：`domain/season/rival.js`の`ageRival(rival, record, rng,
  year, playerName, playerTeamName, bannedNames, bannedTeams)`が、世界ロースターと同じ引退式
  （38歳強制・33歳以上は`0.18+(age-33)*0.06`）でライバルを加齢・引退・後継者生成する
  （引退時は20〜23歳の新ライバルへ、`rivalRecord`は`{0,0,0}`にリセット）。年度末に
  `controllers/mylife/month.js`が呼ぶ。強さの年齢フェーズ`rivalPowerBonus(rival)`
  （23歳以下+3／24〜31歳+6／32〜34歳+4／35歳以上+1）は**`sim/buildMyLifeSim.js`内の私的関数**
  として意図的に複製してある（`domain/season/rival.js`は`state/state.js`をimportしsim層より
  上位のため、sim層から参照すると依存の一方向が崩れる）。
- **シーズンの他チーム動向**：`seasonWorldNews(rosters, year, month)`（`view/news.js`）が
  `g.rivalRosters`の実データ（エース年齢・成長ピーク超過・新人加入・若手大器）から優先度順に
  1文を生成する。旧`rivalNews`（張りぼてテンプレ8種）は完全削除済み。
- **殿堂の血が流入**：`legendPool = loadMlLegends()`を渡すと上位スターが殿堂選手の姓・脚質を継ぐ`bloodOf`付きになる。
- **殿堂の頭数と対戦相手への出現は無関係**（次のアクション調査済み）：`legendPool`は無制限に蓄積するが、1レースあたりの殿堂選手代打は`nLeg=0/1/2`（55%×35%分布）で固定上限。
- **永続ロースター**：`WORLD_ROSTER_SIZE = 12`（`data/teams.js`）。マイライフ世界人口は
  `MYLIFE_TEAMS`25チーム×12＝300名（世界ランキングの300位スケールに合わせた値。
  「1チームは12名のまま・チーム数を9→25に増やす」で到達。経緯は`devlog/wave11.md`）。
  `genWorldRosters(rng, count, teams)`で生成→`ageWorldRosters()`が年次で加齢/引退/新人補充＋定員補充、
  `topUpWorldRosters()`が定員割れを末尾に追記（既存メンバーの順序・identityには触れない）。
  **⚠️ 絶対にやってはいけないこと**：`genWorldRosters()`の`count`を直接変えること。
  同じseedでもcountを変えると生成列がずれ、**全チームの顔ぶれが総入れ替わりになる**
  （実測で確認済み。だから定員拡張は初期生成6名のまま別rngストリームでtopUpする形にしてある）。
  出走人数は「ロースター実在数＋alumni」までclampし、埋まらない枠を使い捨て選手で埋めない。

### アンビション／キャリア／モニュメント
- `ML_AMBITION_PATHS`（victory/bigstage/devotion/world）, `mlCurrentAmbition`, `mlFirstUnmetRung`, `mlAmbitionCleared`, `applyAmbitionReward`
- `mlCareerArchetype(s)` … 引退時の生き様（称号）。`careerWins/careerPodiums/careerBigWins/careerTitles/careerClassics`を参照。
- `ML_MONUMENTS` … ワンデー古典3種（石畳/丘陵/山岳）。`race.monument`フラグ、`careerClassics`を加算。

### 殿堂・その他
- 殿堂：localStorage `roadrace_v12_mylife_legends`。`ML_LEGENDS_KEY`, `mlLegendSnapshot(s)`, `mlRecordLegend(s)`, `protegeInherit`
- 特殊能力（バッジ）：`ABILITIES`（48種8カテゴリ）。取得条件は`ACQUIRE_REQS`
  （`domain/mylife/cp.js`）・強化(金)条件は`GOLD_REQS`（`core/core.js`）で、いずれも
  `{gate, cur(r), need, unit}`の構造化データ（第39弾で`r=>boolean`から移行・進捗の分子を
  取り出せる）。後方互換の`ACQUIRE_CONDITIONS`/`GOLD_CONDITIONS`（`{id: r=>boolean}`）は
  この構造から自動導出されるため、既存コード（`breeding.js`・`panels.jsx`の存在チェック等）
  は無改変で動く。**習得経路がモードで異なる（意図的）**：シーズンは`acquireNewAbility`が
  月15%抽選で自動習得（据え置き）、マイライフは`mlAcquireAbility`／`mlAcquireBadge`で
  プレイヤーが選手画面から選んで習得する（第39弾）。所持上限3個は両モード共通で維持中
  （撤廃は使用量・退行を入れる後続弾とセット）。`hasAbility/hasGoldAbility`は判定ヘルパー。
- ⭐**3分類（第47弾で実装済み・画面も3節に分かれている）**：
  - **バッジ24種**（`ACQUIRE_REQS`を持つ）＝**枠を消費・付け外し可能**。
  - **体質16種**（体質系10＋悪特性6）＝⚠️**付け外し不可・枠を消費しない**。生まれつきで
    選べないため、良い体質が枠を食うのも悪特性を踏み倒せるのも筋が通らないため。
  - **血脈8種**（`breedOnly`）＝**付け外し可能・枠を消費し、枠に入れた分だけ効果が出る**。
    外した血脈は`player.bloodAbilities`に残るので永久消失しない。
  ⚠️**`hasAbility`は`r.abilities`しか見ておらず、`maxSlots`は`sim/`のどこからも参照されて
  いない**＝**枠の数は効果の発動と無関係**。ここを踏まえずに「所持上限だけ設ける」形にすると
  枠を奪うだけで効果は据え置きになる。
- **枠と段階の表現（第44・45弾・生きた仕様）**：枠は`B1=3 / A=4 / PRO=5`
  （`ML_BADGE_SLOTS_BY_CLASS`）。降格しても減らさない（`ml.classIdxBest`を見る）。
  ⚠️操作の語は**「付ける」「はずす」**——「装備」「付け替え」はパーツで使用済みのため使えない。
  段階のマークは**菱形の輪郭/塗り/二重**。⚠️**色相で4段を作る道は塞がっている**
  （紅は`bad`と16°・銅は金と16°しか離れず見分けられない）。虹はアルカンシエル
  （世界選手権王者ジャージ）由来で`RAINBOW_STOPS`を流用。
- ⚠️**バッジの退行（使わないと段階が落ちる）は原理的に成立しない**（第42弾で実測・恒久確定・
  再検討しないこと）：一定戦略でも段階が振動し（`mount`は12年で30回往復）ヒステリシスでも
  直らない＝閾値の問題ではない。⭐**真因はN=8では「狙う/狙わない」を判別できないこと**で、
  N=32なら6/6分離できるが32戦＝キャリア5年分で応答性が消える＝**両立する窓幅が存在しない**。
- **使用量の計装（第40弾・`domain/mylife/badge.js`）**：`raceLog`の各エントリに`segMix`
  （区間タイプ別距離割合。`domain/shared/segMix.js`の`segMixOf`/`segMixOfRace`で算出、
  raceLog書き込み全8箇所に配線済み）。`badgeExposure(player, id, n)`が直近nレースの
  露出率(0〜1)を返す（地形8種は`segMix`から、展開3種`escape`/`domestique`/`rouleur`は
  `role`から算出）。**残り25種は未分類でnullを返す。この関数はまだ効果にもUIにも未接続**
  （計測専用）。実測ではウィンドウN=20だと転向の反映に1〜2年かかるためN=5〜8を推奨。
- 新ステータス（2026-08・Phase1/2）：`breakthrough`(突破力)/`stability`(安定感)/`luck`(運)。生成時固定値、`core/core.js`の`genSubStats()`。
  `RiderRadarChart`（`components/RadarChart.jsx`）で6角形表示。イベント経由のみ例外的に増減可（`*Delta`系effects）。
- シーズンモード：別state（`g`/`initGame`）。`TEMPLATES`(コース), `signBredYouth`（シーズンの血統ユース）。

### UIコンポーネント（能力表示、2026-08 §26で再編）
- `DisciplineGrid`（`components/panels.jsx`）… コース適性（S〜G評価の5項目バー）。マイライフ・シーズン共通の見出しは「コース適性」に統一済み。
- `AbilitySoshitsuRadarPair`（`components/RadarChart.jsx`）… 能力5項目レーダー＋素質6項目レーダーの横並び。マイライフ選手画面（`mylife/rider.jsx`）は常時表示、**シーズン選手一覧は第32弾Phase Aで「くわしく見る」の展開領域へ移動**（一覧の行では5能力を数値で直接見せる）。旧`AbilityGrid`棒グラフ・`SubStatLine`テキストは重複のため廃止済み。
- 他カード（デビュー画面・FA市場・トレード・引き抜き市場・レース当日選択）は`AbilityGrid`（棒グラフ）のみ、密なリスト用途のため据え置き。

### ドット絵スプライトの描画方式（§37で確立・生きたルール）
`PixelBike`/`PixelPerson`/`PixelBikeUse`は**canvasで1回ラスタライズし`<image>`1ノードで描く**
（`components/sprites/rasterize.js`の`spriteImageUrl()`。モジュールレベルのMapでキャッシュ）。
**`<rect>`を1ピクセルずつ積む旧方式・`<symbol>`+`<use>`方式のどちらも使わない**（実測で`<rect>`直描きは
出走22名×12色でSVG67,961ノード・2.3fps、`<image>`化で295ノード・60fpsへ改善済み。詳細は`git show bdd1eff`）。
**新しいドット絵キャラクターを追加する時も必ず`spriteImageUrl()`経由にすること。**

### 画面の外枠（wrap）の使い分け（2026-08 §29/§30で確立・生きたUIルール）
`components/chrome.jsx`に2種類ある。**新しい画面を追加する時はどちらに属するかを必ず判断すること。**
- `makeWrap`（season用）… `SeasonHeader`（クラス・チーム名・予算・ポイント）付き。
  **実在するチームが確定した後の画面だけ**に使う（`scoutpolicy_initial`以降）。
- `makeMetaWrap`… ヘッダー無し。モード選択・生涯評価・系譜ツリー・因子図鑑・CP交換所と、
  シーズンの`intro`・`newgame_setup`（＝まだチームが存在しない段階）に使う。
  過去2回、ここを取り違えて「起動直後の画面に架空のチーム情報が出る」バグを出している。

### ボタンとアフォーダンス（生きたUIルール）
配色の役割分担（`accent`＝データ強調専用／`action`＝操作専用／`good`・`bad`＝良し悪し専用）は
**CLAUDE.md §9が正本**。ここでは現行の部品と形だけ：
- 共通部品は`components/kit.jsx`：`PrimaryBtn`／`QuietBtn`／`PressRow`／`ChipRow`／`TypeChip`／
  `Tag`／`Section`／`Item`／`ShopRow`／`ShopBtn`。旧`components/ui.jsx`の`Btn`は削除済み。
- **押せる＝面**（`surfaceUp`塗り、主ボタンは`action`塗り）＋右端「›/▸」。静的パネルは`surface`のまま。
  枠線でボタンを表さない（面の明暗差が一次シグナル）。
- **級数の型（第35弾で確立・生きたルール）**：**1つのサイズ段には1つの仕事だけ**を割り当てる。
  主ボタンは`head`(16px)、一覧行の主役も`head`、補足・単位・チップは`caption`(10px)。
  ⚠️ 1つの段が複数の仕事を兼任すると階層が消える（`PrimaryBtn`が`body`(13px)だった頃、
  20/16/10の3段しか使われず13pxが0%＝主ボタンと本文が同じ重みになっていた）。
- **同じ情報を2箇所以上に出さない（第37弾）**：一覧と詳細、チップと明細のように同じ値を
  重ねて出すと、行数が増えるだけで判断は速くならない。値は「判断する瞬間」に1回だけ出す
  （例：昇格ボタンのラベルに次のLvの実額を入れ、別途の料金表は置かない）。
- 画面ローカルの部品：決断の選択肢は`career.jsx`の`ChoiceCard`（面＋1行タイトル＋1行の帰結説明）、
  選択肢の並びは`create.jsx`の`PickRow`＋`PickNote`（チップを横に並べ、説明は選択中の1件だけ）、
  段階購入は`events.jsx`の`TierPanel`（今の段階＋次の1段のみ）。
  いずれも**浮いた注釈でボタンを補足しない**形。

### 機械検証ゲート（`tools/`・生きたルール）
特定の領域に触る変更は、対応するゲートの通過を**完了条件**とする（実装後に必ず走らせる）。
- `tools/verify_radar.mjs`（§61で新設）… **レーダーに触る変更は必ず通す**。頂点順位一致・点線が
  外周に接し苦手軸で凹む・5角形/7角形ともラベル間隔・pageerrorゼロの全6項目。
  当初合意した案の破綻（素質7角形の3.9px重なり）をこのゲートが検出した実績がある。
- `tools/verify_baseview.mjs`（§51で新設）… **拠点マップの導線・レイアウト**を担保（実装中に
  3件の配置バグを検出）。
- `tools/ui_density.mjs`… 画面の文字数・フォントサイズ分布の実測（第32弾の診断で使用）。

### ⚠️ レースsimを実測するときの必須手順（第49・51・55弾で確立・生きたルール）

⚠️**`buildMyLifeSim`は同一入力でも毎回違う結果を返す**（同じレース・同じ選手で着順が
20/35/32/8/27）。原因は`ticks.js`・`finish.js`の`Math.random()`多用（tickジッター±3%・
**ゴール時±12秒**・アタック抽選）と`buildMyLifeSim.js`の`mulberry(Date.now() % 999983)`。

1. ⭐**3点固定が必須**——`Math.random`・`Date.now`・`ridState.value`をすべて固定する。
   ⚠️**固定しないと得られる数字はすべて無意味**（第49弾で2回踏んでから3回目で気付いた）。
2. ⭐**`resumeSim`でA/B比較するときは、各アームの`resumeSim`呼び出し直前に全アーム共通の
   副シードへ乱数ストリームを張り直す**（`mulberry(seed*31+7)`等）。`buildMyLifeSim`自体が
   乱数を消費するため、これをしないとアーム間で乱数列がずれる（`devlog/wave51.md`）。
3. ⚠️**逃げを`mode==="solo"||"attack"`で数えないこと**——2人以上で逃げる選手は自分たちで
   1グループを作るので`mode`は`pull`/`draft`になり、**集団逃げが一切カウントされない**。
   本隊＝最多人数のグループとの位置関係で判定する（`scratchpad/w55_breaktype.mjs`）。
   さらに⚠️**フィールドが砕けていると「本隊より前」が増えて誤って高く出る**ため、
   先に決着規模（+10秒以内の人数）が基準内であることを確認してから読むこと。
4. ⭐**第56弾で修正済み（`MAX_TICKS`は2500→7000・凍結バグも同時に修正）**。旧バグの記録：
   `MAX_TICKS`固定値なのにレース長は地形で2198〜3275秒と違い、超過分は
   `finishTime = MAX_TICKS + (remain / lastDist)`という**外挿**で埋まっていた（ヒルクライム
   未完走71%）。真因は別にもう1つあり、**牽引者が1人も居ない集団は完全に停止する**
   （`if (!puller) return;`で後段の集団ループが抜けるため）。エースだけの集団（`canPull`も
   非常時フォールバックもエースを除外）と、牽引者が`attackLeft>0`で`"attack"`に転じる場合の
   2経路があり、⚠️**全テンプレートの13〜43%のレースで発生していた**（平坦でも13%）。
   修正はモード配布直後に「牽引者が居なければドラフト勢で最も脚が残る選手を立てる」
   ガードを1つ足しただけ（`ticks.js`）。`hold`・コースレコードは実測で不変（`devlog/wave56.md`）。

### localStorage キー一覧
- `roadrace_v12_mylife_save` … マイライフ本体
- `roadrace_v12_mylife_legends` … 殿堂（プレイ跨ぎ）
- `roadrace_v12_bloodlines` … 系統レジストリ（プレイ跨ぎ）
- `roadrace_v12_save` … シーズン本体
- クリアポイント等は `loadMeta()`（`totalEarnedCP` でアンロック判定）
