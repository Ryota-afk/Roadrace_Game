// mylife.jsx より分割（Step8）：ヘルプ（mylife_help）
// 第13弾Phase3-D-2: 新トークン(T/FONT_DOT)へ全面移行。絵文字を全廃し、装飾色を単一アクセント
// （T.color.accent）＋警告用のT.color.badへ集約した（CLAUDE.md §7/§8：多色の乱立の解消）。
// 第65弾(devlog/wave65.md・案B): 22節・5,676文字が縦一列に開きっぱなしで「壁」になって
// いたのを解体。①既に画面側に同じ説明が出ている5節（毎月の基本アクション・難易度・
// レース作戦・ライバル・実績）を削除 ②残る17節を「毎月の判断に効くこと／キャリアが
// 進むと出てくるもの／何周も遊ぶと関わるもの」の3層に分け ③各節を折りたたみ、開いた
// 瞬間に全体像（見出しだけ）が1画面に収まるようにした。節見出しの括弧書き（開発都合の
// 副題）も外した。
import React from "react";
import { QuietBtn, Screen } from "../../components/kit.jsx";
import { FONT_DOT, T } from "../../data/theme.js";

const HelpCard = ({ children, first }) => (
  <div style={{ padding: `${T.space.sm}px 0`, borderTop: first ? "none" : `1px solid ${T.color.rule}`, fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.8 }}>{children}</div>
);

const HelpGroup = ({ children }) => (
  <div style={{ fontSize: T.size.head, color: T.color.text, marginTop: T.space.lg, marginBottom: T.space.sm }}>{children}</div>
);

// 折りたたみ行。開閉状態は`ml.uiHelpOpen`（キー→bool）にセーブ状態として持たせる——
// hub.jsxの`uiOtherOpen`等と同じ「UIの開閉フラグはml側で持つ」既存の流儀に揃える
// （このファイル内はReactコンポーネントではなく毎回呼び直される描画関数のため、
// useStateではなくml側の状態に頼るのが本プロジェクトの一貫した作法）。
const HelpRow = ({ label, openKey, ml, setMl, children }) => {
  const open = !!(ml.uiHelpOpen && ml.uiHelpOpen[openKey]);
  return (
    <>
      <button onClick={() => setMl(s => ({ ...s, uiHelpOpen: { ...s.uiHelpOpen, [openKey]: !open } }))}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline", width: "100%",
          background: T.color.surfaceUp, border: 0, marginBottom: T.space.xs,
          color: T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body,
          padding: T.space.md, cursor: "pointer", textAlign: "left",
        }}>
        <span>{label}</span>
        <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{open ? "閉じる" : "開く"}</span>
      </button>
      {open && <div style={{ background: T.color.surface, padding: `0 ${T.space.md}px`, marginBottom: T.space.md }}>{children}</div>}
    </>
  );
};

export function renderMyLifeHelpScreens(ctx) {
  const { ml, mlWrap, setMl } = ctx;
    if (ml.screen === "mylife_help") {
      return mlWrap(
        <Screen>
          {/* 第64弾(devlog/wave64.md): 入口(hub.jsx「遊び方を見る」)と着地先の文言を同時に
              揃える（第62弾で見出しが画面ごとに食い違う事故を起こしたのと同じ轍を踏まない）。 */}
          <div style={{ fontSize: T.size.title, marginBottom: T.space.md }}>遊び方</div>

          <HelpGroup>毎月の判断に効くこと</HelpGroup>

          <HelpRow label="成長と練習" openKey="growth" ml={ml} setMl={setMl}>
            <HelpCard first>選手（自分）にも成長タイプ（早熟・普通・晩成・超早熟・超晩成）と成長期／全盛期／衰え期があり、成長力（C/B/A/S、×0.7〜×1.6）が伸び方に倍率をかけます。練習では指定能力に90%、残り4能力に14%が配分されます。</HelpCard>
            {/* 第85弾(devlog/wave85.md): 旧文は「1年ごとに+2、最大132」「上限自体が毎年じわじわ
                上がっていきます」と書いていたが、⚠️第7弾B-3が「練習だけしていても上限が勝手に
                伸びる」挙動を意図的に廃止しており、廃止前の設計を説明したままだった（＝プレイヤーに
                逆の育成方針を教えていた）。実際の式はdomain/mylife/growthCap.jsの
                min(140, 90 + min(8, year-1) + 実績ボーナス×難易度倍率 + 才能キャップ)。 */}
            <HelpCard>能力の伸びには「ソフトキャップ」があり、これを超えると伸びが急に鈍ります。<b style={{ color: T.color.text }}>練習を続けるだけでは、この天井は上がりません。</b>天井を押し上げるのは勝つこと——生き方の段を越える、大舞台のタイトルを獲る、勝ち星を重ねる。この3つです（年数による底上げは最初の8年で頭打ち。天井は90から最大140まで）。</HelpCard>
            <HelpCard>出走した場合は、レースで使った区間の種目に応じた「出走経験」でも能力が伸び、レースのグレードが高いほど伸びが大きくなります。またキャリアを重ねるほど対戦相手（AI選手）の地力も底上げされていくため、成長を怠るとだんだん勝てなくなっていきます。</HelpCard>
            <HelpCard><b style={{ color: T.color.text }}>活力（伸びしろの芯）</b>：疲労が「その月の重さ」なのに対し、活力は<b style={{ color: T.color.text }}>長期の鮮度・伸びしろの芯</b>です。走り込むほど（格上レースほど大きく）少しずつ減り、完全休養やオフシーズンで回復します。<b style={{ color: T.color.text }}>活力が高いほど練習・出走経験の伸びが満額に近く、低いと伸びが鈍ります</b>。走らせ過ぎず、休養を挟んで「芯」を保つのが強い選手を育てるコツです（選手カードの活力バーで確認）。</HelpCard>
            <HelpCard><b style={{ color: T.color.text }}>適性グレード（S〜G）</b>：選手カードの「コース適性」は、平坦／山岳／スプリント／独走TT／丘陵の5種目ごとの得意度を<b style={{ color: T.color.text }}>S〜Gの文字</b>で表します。自分の脚質・能力がどの地形で輝くかを一目で読めます。得意な地形（★＝今月のレースが有利とする種目）のレースを選ぶと上位を狙いやすくなります。</HelpCard>
            <HelpCard><b style={{ color: T.color.text }}>出走計画</b>：得意にしたい地形をあらかじめ宣言しておくと、毎月の3択にその地形のレースが必ず1本入ります（看板レースの月は対象外／変更は翌月の候補から効きます）。</HelpCard>
          </HelpRow>

          <HelpRow label="疲労とフォーム" openKey="fatigue" ml={ml} setMl={setMl}>
            <HelpCard first>出走のたびに疲労が大きく増えます（車のグレードや「鉄人」「回復力」等で軽減）。ホームの疲労の数字の色（緑→黄→赤）が、今どれくらい休むべきかの目安です。</HelpCard>
            <HelpCard>フォーム（好不調・0〜100）はレース当日の能力を最大±17%上下させる好不調の指標です。毎月ゆるやかに基準値へ戻りつつ波打ち、「ピーキング調整」で大きく上がります（狙ったレースに合わせて仕上げ、ピークは長く維持できません）。フォーム調整剤（ショップ）でも上げられます。「ムラっ気」は波が激しく、「精密機械」やメンタルが高い選手は安定します。予報アイコンで翌月の傾向がわかります。</HelpCard>
            <HelpCard>結婚・子供の有無・一戸建て以上の住居・メンター就任などのライフイベントは、毎月の疲労回復量にわずかな恒常ボーナスを与えます。</HelpCard>
          </HelpRow>

          <HelpRow label="監督の指示と評価" openKey="directive" ml={ml} setMl={setMl}>
            <HelpCard first>毎月、監督から「エースとして表彰台を狙え」「積極的な走りで上位進出せよ」「アシストとしてチームを支えよ」「経験を積むために出走せよ」のいずれかの指示が出ます。達成すると監督評価が上がり、未達成だと下がります。監督評価が高いほど「エース」指示が出やすくなります。</HelpCard>
            <HelpCard>監督評価は年俸交渉や移籍オファーの内容にも影響します。練習をこなす、住環境を整える等でも少しずつ上がります。</HelpCard>
          </HelpRow>

          <HelpRow label="天候" openKey="weather" ml={ml} setMl={setMl}>
            <HelpCard first>レースごとに晴れ・雨・猛暑のいずれかが決まります。雨は能力低下＋落車リスク（「悪天候巧者」で軽減）、猛暑は出走後の疲労蓄積増です。</HelpCard>
          </HelpRow>

          <HelpRow label="機材" openKey="gear" ml={ml} setMl={setMl}>
            <HelpCard first>フレーム・タイヤ・ホイール・補給食の4スロットにパーツを装着できます。多くのパーツは得意な地形が伸びる代わりに苦手な地形が落ちるトレードオフ持ちです（例：軽量ホイールは登坂が伸びるが平坦が落ちる）。雨天用タイヤ・石畳用タイヤ・冷感ボトルセットは該当する天候・コースでだけ効果を発揮する特化ギアです。今月のレースの近くに現在の装備と地形・天候への適合が表示され、そこから付け替えられます。</HelpCard>
          </HelpRow>

          <HelpGroup>キャリアが進むと出てくるもの</HelpGroup>

          <HelpRow label="世界ランキングと生き方" openKey="world" ml={ml} setMl={setMl}>
            <HelpCard first>レースの着順・グレードに応じて世界ランキングポイントが入り、世界ランクが上下します。上位を目指すのが長期の大目標です。</HelpCard>
            <HelpCard>世界のペロトンは<b style={{ color: T.color.text }}>生きています</b>。世界ランキングの選手たちは実在の名前を持ち、毎年 加齢・成長・衰え・引退を繰り返して世代交代します（名選手の血を継ぐ2世が台頭することも）。ランキング画面の「今年の世界の動き」で新王者・引退・新星をチェックできます。さらに<b style={{ color: T.color.text }}>あなたが殿堂に残した名選手・確立した系統の血は、次のキャリアの世界に血統として流入</b>し、世界の頂点を争います。</HelpCard>
            <HelpCard>世界ランキング上位のスターは<b style={{ color: T.color.text }}>実際のあなたのレースにも出走してきます</b>。格の高いレース（世界選手権・モニュメント等）ほど強豪が集います。世界の強豪と直接ぶつかり、打ち破ってのし上がっていきましょう。</HelpCard>
            <HelpCard>「生き方（アンビション）」は<b style={{ color: T.color.text }}>6つの道</b>から選べます：<b style={{ color: T.color.text }}>勝利の道</b>（勝利数）／<b style={{ color: T.color.text }}>大舞台の道</b>（★の高いレース）／<b style={{ color: T.color.text }}>献身の道</b>（アシスト戦数）／<b style={{ color: T.color.text }}>世界の道</b>（世界ランク）／<b style={{ color: T.color.text }}>鉄人の道</b>（現役年数・通算出走）／<b style={{ color: T.color.text }}>スターの道</b>（人気度）。道ごとに目標のはしごが異なり、達成報酬（資金・能力・成長力）が入ります。「生き方を変える」でいつでも切替できます。</HelpCard>
            <HelpCard>引退時のキャリア傾向から「生き様（称号）」が決まり、殿堂記録に残ります。これが次のプレイの配合（生き様の血）にも影響します。</HelpCard>
          </HelpRow>

          <HelpRow label="節目の大会" openKey="milestone" ml={ml} setMl={setMl}>
            {/* 第85弾(devlog/wave85.md): ⚠️オリンピックを「3月」と書いていたが実際は7月。
                domain/mylife/race.js:34の`month === 3`を月名として書いたもので、MONTHSは
                ["4月","5月",…]の0始まり＝MONTHS[3]は7月。内部インデックスがそのまま画面に
                出ていた（CLAUDE.md §7「開発上の語彙を見せない」の数値版）。
                あわせて第82弾で世界選手権がロード／個人TTの2択になった旨を追記。 */}
            <HelpCard first>世界選手権：クラスA以上なら毎年9月。<b style={{ color: T.color.text }}>ロードレースか個人タイムトライアルかを選んで出走します。</b>オリンピック：PROクラスかつ4年に一度だけ、7月。どちらもグレード4（通常の最高格付けの1.3倍相当）の一発勝負で、ライバルも代表入りしてきます。</HelpCard>
            <HelpCard><b style={{ color: T.color.text }}>チームタイムトライアル</b>：年に数回、個人ではなくチーム全員の合算タイムで順位を競う日があります。速い選手を並べるだけでなく、層の厚さと連携がものを言います。</HelpCard>
          </HelpRow>

          <HelpRow label="モニュメント" openKey="monument" ml={ml} setMl={setMl}>
            <HelpCard first>毎年決まった月に、格式高い一発勝負の古典レース「モニュメント」が開催されます：石畳の古典《春の地獄》（5月・ルーラー有利）／丘陵の古典《アルデンヌ》（8月・パンチャー有利）／山岳の古典《秋の女王》（10月・クライマー有利）。いずれも長く消耗の激しいコースで、脚質と地力が問われます。</HelpCard>
            <HelpCard>モニュメントを制覇するとキャリアに刻まれ、複数勝てば引退時に「クラシックの覇者」「石畳の古豪」といった生き様（称号）が付きます。</HelpCard>
            <HelpCard>各モニュメントには<b style={{ color: T.color.text }}>脚質別の古典適性</b>があります——石畳＝<b style={{ color: T.color.text }}>「石畳巧者」</b>／丘陵＝<b style={{ color: T.color.text }}>「アルデンヌの狼」</b>／山岳＝<b style={{ color: T.color.text }}>「秋の女王」</b>。その古典で表彰台に立つと開眼することがあり（対応する古典本番で全能力+5%）、優勝すると金の特殊能力に進化して+9%に強化されます。</HelpCard>
          </HelpRow>

          <HelpRow label="年俸と移籍" openKey="salary" ml={ml} setMl={setMl}>
            <HelpCard first>年俸は年度末にその年のポイント・勝利数・表彰台数に応じて改定されます。好成績を残すと複数チームから移籍オファー（年俸倍率・契約金・エース確約の有無つき）が届き、残留か移籍かを選べます。移籍先のクラス（B1/A/PRO）がそのまま翌年の所属クラスになります。</HelpCard>
          </HelpRow>

          <HelpRow label="スポンサーと人気" openKey="sponsor" ml={ml} setMl={setMl}>
            <HelpCard first>レースの着順が良いほど（グレードが高いレースほど）人気度（0〜100）が上がります。人気度10ごとに月+2万円の個人スポンサー収入（チーム年俸とは別枠）が入り、25/50/75/100到達時には契約一時金も入ります。</HelpCard>
            <HelpCard>人気度が20以上になると、毎月のアクションとしてスポンサーの仕事（CM出演・撮影など）を引き受けられるようになります。報酬（お金）と人気度が得られますが、その月は競技に集中できず疲労が残ります。報酬額は人気度が高いほど大きくなります。</HelpCard>
          </HelpRow>

          <HelpRow label="恩師と弟子" openKey="mentor" ml={ml} setMl={setMl}>
            <HelpCard first>キャリア開始時、チームの恩師が新人指導を買って出てくれます。3年目を迎えるまでは練習・出走経験の伸びに+15%のボーナスがかかり、3年目に「人生の岐路」として一区切りを迎えます（選択次第で餞別の能力ボーナスもあります）。</HelpCard>
            <HelpCard><b style={{ color: T.color.text }}>弟子（逆メンター）</b>：ベテランになるとメンター役を引き受け、有望な若手を1人「弟子」に取れます。弟子はあなたの地力に導かれ年々育ち、指導イベントで関わり方（絆・鍛錬）を選ぶと伸びが変わります。<b style={{ color: T.color.text }}>弟子はあなたと同じチームで実際のレースにも出走します</b>（育つほど強く走ります）。弟子の戦績は「選手成績」で確認できます。</HelpCard>
          </HelpRow>

          <HelpRow label="僚友と絆" openKey="bond" ml={ml} setMl={setMl}>
            <HelpCard first>選手には「スピリット」という素質があり（レーダーチャートで確認できます）、僚友との絆の育ちやすさに関わります。チームメイトと同じレースに出走し続けると絆が深まり（表彰台に入ったときや、アシストに徹したときはより深まります）、「チーム名鑑」で段階を確認できます。</HelpCard>
            <HelpCard>絆が深いチームメイトが多いほどチームの結束が高まり、レース中の消耗が軽くなります。また、絆の深い僚友は年々の伸びも良くなります。弟子の絆は師弟関係の指導で育つ絆と同じものです。</HelpCard>
          </HelpRow>

          <HelpRow label="人生の岐路とオフシーズン" openKey="crossroads" ml={ml} setMl={setMl}>
            <HelpCard first>年度末には必ず「オフシーズンの過ごし方」を3択（国内自主トレ・海外武者修行・休養）から選びます。海外武者修行はハイリスクハイリターン（伸び大・疲労も増加）です。</HelpCard>
            <HelpCard>それとは別に、結婚・大きな怪我・第一子誕生・新人時代の恩師との別れといった「人生の岐路」が、条件を満たすと年度末に低確率（恩師との別れのみ確定）で発生し、一度きりの選択とその後ずっと続く恒常効果をもたらします。</HelpCard>
          </HelpRow>

          <HelpRow label="特殊能力" openKey="abilities" ml={ml} setMl={setMl}>
            <HelpCard first>0〜3個の特殊能力を保有し、条件を満たすと保有能力が金の特殊能力に強化されたり、新しい能力を後天的に習得したりします。発見済みの能力は特殊能力図鑑で内容を確認できます。</HelpCard>
          </HelpRow>

          <HelpGroup>何周も遊ぶと関わるもの</HelpGroup>

          <HelpRow label="配合と血統" openKey="breeding" ml={ml} setMl={setMl}>
            <HelpCard first>キャラ作成時、殿堂の名選手を<b style={{ color: T.color.text }}>師匠（1人）＝教え子</b>、さらに<b style={{ color: T.color.text }}>配合相手（2人目）＝血を引く子</b>として選べます。両親の脚質相性（ニック）・血の濃さ・累代ボーナス・生き様の血などから恩恵が決まります。</HelpCard>
            <HelpCard><b style={{ color: T.color.text }}>爆発力＆配合評価（SS〜D）</b>：配合の質を1つの数値に集約した評価。ボーナスは初期能力ではなく<b style={{ color: T.color.text }}>伸びしろ（成長力・才能キャップ）</b>に還元されます＝生まれた瞬間は普通でも、育てると化けます。</HelpCard>
            <HelpCard><b style={{ color: T.color.bad }}>危険度</b>：共通の祖先を持つ濃い配合（インブリード）は爆発力が上がる一方、稀に「ガラスの体」を持って生まれるリスクがあります。両親の健康な血（鉄人・頑丈・高スタミナ）と血脈の多様性で軽減されます。ハイリスク・ハイリターンの駆け引きです。</HelpCard>
            <HelpCard><b style={{ color: T.color.text }}>系統確立＋因子</b>：同じ系統名の名選手を代々輩出すると、血統が「確立→名門→大系統」と成長します（プレイをまたいで蓄積）。確立した系統を継ぐ子孫は因子として伸びしろ＋系統特能を受け取り、大系統ではその因子が金の特殊能力として発現します。</HelpCard>
            <HelpCard><b style={{ color: T.color.text }}>特殊配合</b>：特定の血の組み合わせ（例：二人の世界王者＝絶対王者の系譜、登坂型×平地型＝万能王の血脈 など）は、唯一無二の名血（金枠の称号＋金の特殊能力）を確定で生みます。いろいろな組み合わせを試してみてください。</HelpCard>
            <HelpCard>これらの恩恵は金の特殊能力の継承・配合限定の特殊能力とあわせて配合プレビューに表示されます。シーズンモードでも「血統ユース」で同じ仕組みの原石を確保できます。</HelpCard>
            <HelpCard><b style={{ color: T.color.text }}>因子図鑑</b>（殿堂画面から）：歴代の殿堂選手が残した因子（脚質・特能・S/A適性）を横断集計して★（保有選手数）で一覧できます。周回を重ねるほど因子が貯まり、系統を通じて配合・弟子継承に受け継がれます。<b style={{ color: T.color.text }}>系譜ツリー</b>（殿堂画面から）：殿堂選手を系統（血の流れ）ごとにまとめ、世代（N代目＋累代ボーナス）と親子のつながりを一望できます。</HelpCard>
          </HelpRow>

          <HelpRow label="クリアポイント" openKey="cp" ml={ml} setMl={setMl}>
            <HelpCard first><b style={{ color: T.color.text }}>クリアポイント</b>は、キャリアをまたいで貯まる「周回の勲章」です。引退時に通算成績・タイトル・世界ランク・現役年数から算出され、難易度が高いほど多くもらえます（易×0.7〜鬼×2.2）。</HelpCard>
            <HelpCard>貯めたクリアポイントは、次にデビューする新人の支度金・人気・成長力抽選・当たり特能率を強化する自動ミルストーン（生涯評価画面で確認）と、選んで買うクリアポイント交換所の両方に使えます。高ポイント帯の解禁も用意されているので、周回するほど新人が有利になっていきます。</HelpCard>
          </HelpRow>

          <HelpRow label="使用フォント" openKey="font" ml={ml} setMl={setMl}>
            <HelpCard first>チェックポイント．（制作：マルセ／よく飛ばない鳥　https://yokutobanaitori.web.fc2.com/）</HelpCard>
          </HelpRow>

          <div style={{ marginTop: T.space.md }}>
            <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 戻る</QuietBtn>
          </div>
        </Screen>
      );
    }

    // v29: 出走表（マイライフ）。レース本番前に顔ぶれを確認できる

}
