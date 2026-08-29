// hub.jsxより分割（Step13第1弾）：ヘルプセクション（旧helpタブ）。ゲーム状態(g)には依存しない
// 純粋な静的コンテンツ。第13弾Phase3-D-4-b: Section/Itemへの機械的変換。旧・角丸カード27枚・
// 1px枠線27本・C.xx128箇所を撤去し、Sectionの面＋行の罫線に統一。絵文字12個を撤去
// （詳細はdevlog/wave13.md）。
import React from "react";
import { Item, Section } from "../../../components/kit.jsx";
import { CHASE_MODES, ROLES } from "../../../data/course.js";
import { CLASSES, seasonNeed } from "../../../data/progression.js";
import { T } from "../../../data/theme.js";

const TextRow = ({ children, first }) => (
  <div style={{ padding: `${T.space.sm}px 0`, borderTop: first ? "none" : `1px solid ${T.color.rule}`, fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.8 }}>{children}</div>
);

export function renderHelpSection() {
  const roleRows = Object.entries(ROLES).map(([k, v]) => ({ key: k, ...v }));
  const ROLE_PROS_CONS = {
    lead: { pro: "エースを最後まで牽引。最も信頼できる基本役割", con: "脚質が合わなくても最後まで牽引を続けるため、コースと合わないと非効率になりがち" },
    sub: { pro: "第一アシストを後方から支援し、序盤の消耗を分散できる", con: "脚がなくなると早期に離脱し、そこから先の牽引には貢献できない" },
    mountain: { pro: "山岳・山頂フィニッシュ区間で牽引力を発揮。平坦区間は温存できる", con: "平坦・丘陵中心のコースでは牽引せず、実質的に消耗するだけの手駒になる" },
    flat: { pro: "平坦・丘陵区間の牽引に強く、山岳の少ないコースで安定して働く", con: "山岳区間に入ると牽引せず自然に遅れていく（そこから先は温存扱い）" },
    breakaway: { pro: "序盤に飛び出して逃げ集団を形成。エースの脚を使わずに得点機会を作れる", con: "メイン集団に吸収されるとポイントに繋がらないリスクがある" },
  };
  const CHASE_PROS_CONS = {
    normal: { pro: "脚の消耗を抑えた標準ペース", con: "特別な加速はしない" },
    push: { pro: "ローテーション頻度を上げてペースアップできる", con: "牽引役の脚の消耗が早まる" },
    hold: { pro: "牽引役の脚を温存できる", con: "ギャップの拡大を許容することになる" },
    ace_early: { pro: "エースが単独アタックし、一気にタイム差を作れる可能性がある", con: "エネルギー切れで終盤に大失速するリスクがある（1レース1回限り）" },
  };
  const benchAbility = 80;
  return (
    <>
      <Section title="役割の得意・弱点">
        {roleRows.map((r, i) => (
          <div key={r.key} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
            <div style={{ fontSize: T.size.head, color: T.color.text }}>{r.label}</div>
            <div style={{ fontSize: T.size.caption, color: T.color.good, marginTop: 2 }}>強み：{ROLE_PROS_CONS[r.key].pro}</div>
            <div style={{ fontSize: T.size.caption, color: T.color.bad, marginTop: 2 }}>弱点：{ROLE_PROS_CONS[r.key].con}</div>
          </div>
        ))}
      </Section>

      <Section title="作戦の得意・弱点" right="出走前に1つ選択">
        {Object.entries(CHASE_MODES).map(([k, v], i) => (
          <div key={k} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
            <div style={{ fontSize: T.size.head, color: T.color.text }}>{v.label}</div>
            <div style={{ fontSize: T.size.caption, color: T.color.good, marginTop: 2 }}>強み：{CHASE_PROS_CONS[k].pro}</div>
            <div style={{ fontSize: T.size.caption, color: T.color.bad, marginTop: 2 }}>弱点：{CHASE_PROS_CONS[k].con}</div>
          </div>
        ))}
      </Section>

      <Section title="能力値のクラス別ベンチマーク">
        <TextRow first>
          新人の能力値は「クラスの基準値±11」＋「専門種目+14」で決まり、22〜94の範囲でばらつきます。
          同じ能力値でも、所属クラスが上がるほど相対的な希少価値は下がります（PROの80は「まずまずの主力」、B1の80は「相当な逸材」）。
        </TextRow>
        {CLASSES.map((c) => {
          const lo = c.scout - 11 + 14, hi = Math.min(94, c.scout + 11 + 14);
          const pct = Math.max(0, Math.min(100, Math.round(((hi - benchAbility) / (hi - lo)) * 100)));
          return <Item key={c.id} label={c.label} value={`約${Math.round(lo)}〜${Math.round(hi)}`} detail={`能力${benchAbility}は新人の上位約${pct}%相当`} />;
        })}
      </Section>

      <Section title="難易度・スコアリングの目安">
        <TextRow first>
          レースの★（グレード）は賞金・獲得ポイントの倍率です：★1=×1.0／★2=×1.5／★3=×2.0。
          獲得ポイントは出走選手のうち上位10位以内に入った全員の合算。層の厚いチームで送り込むほど伸びる。
        </TextRow>
        {CLASSES.map((c, i) => <Item key={c.id} label={c.label} value={`${seasonNeed(i)}pt`} detail="昇格に必要（シーズン合計）" />)}
      </Section>

      <Section title="能力値と特殊能力の基本">
        <TextRow first>
          能力値は平坦・登坂・スプリント・スタミナ・独走の5種類（22〜135）。区間の種類ごとに使われる能力が決まり、丘陵は登坂60%＋平坦40%、山頂フィニッシュは登坂70%＋スプリント30%、TT区間は独走60%＋平坦40%というように複数の能力が混ざる区間もあります。
        </TextRow>
        <TextRow>
          選手は特殊能力を0〜3個保有します。地形適性・展開・役割・メンタル・フィジカル・成長の5カテゴリがあり、悪特性（バッドステータス）が混ざることもあります。一定の勝利数や役割出走数を満たすと保有能力が「金の特殊能力」に強化され、逆に条件を満たせば未保有の能力を後天的に習得することもあります。発見済みの能力は「記録」タブの特殊能力図鑑で内容を確認できます（未発見のものは？？？で伏せられます）。
        </TextRow>
      </Section>

      <Section title="成長・練習の仕組み">
        <TextRow first>
          選手にはそれぞれ成長タイプ（早熟・普通・晩成・超早熟・超晩成）があり、年齢によって「成長期（伸び最大）」「全盛期（伸び半減）」「衰え期（能力が少しずつ下がる）」が切り替わります。ピーク年齢は早熟21〜29歳・普通24〜33歳・晩成28〜37歳・超早熟18〜25歳・超晩成32〜42歳です。
        </TextRow>
        <TextRow>
          さらに成長力（C/B/A/S）が練習・出走経験の伸び方に倍率をかけます（C×0.7・B×1.0・A×1.3・S×1.6）。練習では指定した1能力に90%、残り4能力に14%の伸びが配分されます。出走した場合は、レースで使った区間の種目に応じた「出走経験」でも能力が伸び、レースのグレードが高いほど伸びが大きくなります。
        </TextRow>
        <TextRow>
          能力には難易度ごとのソフトキャップがあります（イージー88・ノーマル94・ハード102・鬼112）。この値未満なら伸びは全開ですが、超えると急激に伸びが鈍化します。上限を超えた金色表示の能力は「限界突破」状態です。
        </TextRow>
      </Section>

      <Section title="疲労・コンディション・故障">
        <TextRow first>
          出走すると疲労が+45（「鉄人」持ちは+32）増えます。<span style={{ color: T.color.bad }}>3ヶ月連続で出走（3連闘）すると確定で故障</span>、疲労が90を超えると確率で故障が発生します（ドクターの雇用で確率・離脱期間ともに軽減）。「頑丈」は故障率半減、「ガラスの体」は故障率2倍・離脱+1ヶ月です。
        </TextRow>
        <TextRow>
          調子は→（普通）／↗（好調）／↑↑（絶好調）／↘（やや不調）／↓↓（絶不調）の5段階で毎月ランダムに変動します（「ムラっ気」は変動幅が大きく、「精密機械」は小さい）。休養させると疲労が回復します（出走なしなら-50、故障中でも自然回復します）。
        </TextRow>
      </Section>

      <Section title="チームケミストリー・キャプテン制度">
        <TextRow first>
          ロースター平均在籍月数に応じてチームケミストリーが「新体制／定着期／円熟したチーム／鉄壁の絆」の順に上がり、レース中のドラフト消耗が最大8%軽減されます。移籍・トレード・解雇が多いと在籍月数がリセットされるため、頻繁な入れ替えは足元のケミストリーを崩すコストがあります。
        </TextRow>
        <TextRow>
          任命したキャプテンより3歳以上若い選手は練習効果+10%になりますが、キャプテン自身の練習効果は-5%になります。若手を導く分、自分の伸びしろは少し犠牲になります。
        </TextRow>
      </Section>

      <Section title="天候">
        <TextRow first>
          レースごとに晴れ・雨・猛暑のいずれかが決まります（カレンダー・出走前画面に表示）。雨は出走選手全員の能力を一律で下げ（「悪天候巧者」持ちは軽減）、持たない選手には落車による負傷離脱のリスクも上乗せされます。猛暑は出走後の疲労蓄積が増えます。横風区間の影響（「横風耐性」で軽減）とは別の、レース全体にかかる要素です。
        </TextRow>
      </Section>

      <Section title="キャンプ・機材・スタッフ">
        <TextRow first>
          トレーニングキャンプ券を使うとその月の練習効果が×2になりますが、選手全員の疲労が+25されます。クールダウンはありませんが、連発すると疲労90超＝故障リスクゾーンに入りやすくなるため、使いどころの見極めが重要です。
        </TextRow>
        <TextRow>
          恒常装備：エアロフレーム（平坦+6%/Lv）・軽量ホイール（登坂+6%/Lv）・トレーニング設備（練習効果+15%/Lv）は買い切りで恒常的に効果が続きます。
        </TextRow>
        <TextRow>
          マシンパーツ：選手ごとにフレーム・タイヤ・ホイール・補給食を装着できます。多くのパーツは得意な地形が伸びる代わりに苦手な地形が落ちるトレードオフ持ちです。雨天用タイヤ・石畳用タイヤ・冷感ボトルセットは該当する天候・コースでだけ効果を発揮します。出走前には無料の「機材セットアップ」（標準／軽量仕様／エアロ仕様、天候次第で雨仕様・冷却仕様も）を出走メンバー全員に一律で選べます。
        </TextRow>
        <TextRow>
          スタッフは月給制：監督（スポンサー契約が有利に）・トレーナー（練習効果が恒常アップ）・ドクター（故障率と離脱期間を軽減）。雇用できるレベル上限はクラスが上がるほど増えます。
        </TextRow>
        <TextRow>
          中期目標：スポンサー契約時に、複数レースにまたがる約束（例「山岳系で通算2勝」「大レースで表彰台」）が1つ提示されます。年間ノルマ（総pt）や単月の指定レースとは別枠で、期限月までに達成すれば臨時ボーナス（資金＋ノルマpt）、未達なら違約金。どのレースにエースを送り込むか、シーズンを通した計画性が問われます。進捗は主画面のパネルで常時確認できます。
        </TextRow>
      </Section>

      <Section title="グランツール・副次タイトル">
        <TextRow first>
          PROクラス限定で年3回（春・夏・秋）、3日間ステージレースのグランツールが開催されます。グランファイナルへの出場には、その年の3戦すべてで総合優勝することが条件です。
        </TextRow>
        <TextRow>
          グランツールでは総合成績とは別に、ポイント賞（各区間の着順ポイント合計）・山岳賞（山岳区間の着順ポイント合計）・新人賞（26歳未満限定）の副次タイトルが争われ、自チームが獲得すると賞金ボーナスが入ります。
        </TextRow>
      </Section>

      <Section title="ダイナスティ周回・ユース育成枠">
        <TextRow first>
          グランファイナル制覇後、「新たなチームで最初から」ではなくこの轍を継いでさらなる高みへを選ぶと、同じチームのまま周回を継続できます（ダイナスティ周回）。周回を重ねるたびに他チームの地力が底上げされ、歯応えが保たれます。クリアポイントは周回のたびに再獲得できます。
        </TextRow>
        <TextRow>
          「選手・練習」タブでは年1回だけ、契約金15万円でユース選手（16〜17歳・成長力A以上確定）を確保できます。現在の能力は低いですが、長期育成向けの原石です。使用枠は4月の年度替わりでリセットされます。
        </TextRow>
      </Section>

      <Section title="スカウト・移籍・トレード・実績">
        <TextRow first>
          毎年4月は新人スカウト月間。事前に選んだ方針（おまかせ／スプリント重視／登坂力重視／将来性重視／即戦力重視）に応じて候補5名の傾向が変わります。年間を通じてFA市場・他チームからのトレード提案・選手解雇（4月のみ）も利用できます。
        </TextRow>
        <TextRow>
          引き抜き市場：ショップの「引き抜き市場」から、ライバルチームの看板選手を移籍金で獲得できます（1シーズンに1回まで）。成立すると相手は主力を失い、その選手は以後あなたのチームで走ります。逆に、あなたの主力が強豪から狙われる引き抜きオファーが届くこともあります。引き止め費用を払って残すか、移籍金を受け取って放出するか——放出した選手はライバルの一員として自チームの前に立ちはだかります。移籍金は選手の実力と移籍意欲で決まります。
        </TextRow>
        <TextRow>
          実績を達成すると報酬（賞金や恒常ボーナス）が入ります。詳細な一覧は「記録」タブで確認できます。解雇・引退した選手のうち、実績かお気に入り登録の条件を満たした選手だけが殿堂入りとして名鑑に残ります。
        </TextRow>
      </Section>

      <Section title="使用フォントについて">
        <TextRow first>チェックポイント．（制作：マルセ／よく飛ばない鳥　https://yokutobanaitori.web.fc2.com/）</TextRow>
      </Section>
    </>
  );
}
