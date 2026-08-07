// hub.jsxより分割（Step13第1弾）：ヘルプセクション（旧helpタブ）。ゲーム状態(g)には依存しない
// 純粋な静的コンテンツ。中身は一切変更していない（byte-for-byte照合済み）。
import React from "react";
import { Eyebrow } from "../../../components/ui.jsx";
import { CHASE_MODES, ROLES } from "../../../data/course.js";
import { CLASSES } from "../../../data/progression.js";
import { C, FONT_D, FONT_M } from "../../../data/theme.js";

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
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <Eyebrow color={C.green}>役割の得意・弱点</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {roleRows.map(r => (
                <div key={r.key} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13.5 }}>{r.label}</div>
                  <div style={{ fontSize: 11.5, color: C.green, marginTop: 3 }}>◎ {ROLE_PROS_CONS[r.key].pro}</div>
                  <div style={{ fontSize: 11.5, color: C.red, marginTop: 2 }}>▲ {ROLE_PROS_CONS[r.key].con}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow color={C.blue}>作戦の得意・弱点（出走前に1つ選択）</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {Object.entries(CHASE_MODES).map(([k, v]) => (
                <div key={k} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13.5 }}>🚩 {v.label}</div>
                  <div style={{ fontSize: 11.5, color: C.green, marginTop: 3 }}>◎ {CHASE_PROS_CONS[k].pro}</div>
                  <div style={{ fontSize: 11.5, color: C.red, marginTop: 2 }}>▲ {CHASE_PROS_CONS[k].con}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow color={C.yellow}>能力値のクラス別ベンチマーク</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4, lineHeight: 1.7 }}>
              新人の能力値は「クラスの基準値±11」＋「専門種目+14」で決まり、22〜94の範囲でばらつきます。
              同じ能力値でも、所属クラスが上がるほど相対的な希少価値は下がります（PROの80は「まずまずの主力」、B1の80は「相当な逸材」）。
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {CLASSES.map((c, i) => {
                const lo = c.scout - 11 + 14, hi = Math.min(94, c.scout + 11 + 14);
                const pct = Math.max(0, Math.min(100, Math.round(((hi - benchAbility) / (hi - lo)) * 100)));
                return (
                  <div key={c.id} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 13 }}>{c.label}</span>
                    <span style={{ fontSize: 11.5, color: C.sub }}>専門種目の新人レンジ 約{Math.round(lo)}〜{Math.round(hi)}</span>
                    <span style={{ fontSize: 11.5, color: C.yellow }}>能力{benchAbility}は新人の上位約{pct}%相当</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <Eyebrow color={C.purple}>難易度・スコアリングの目安</Eyebrow>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                レースの★（グレード）は賞金・獲得ポイントの倍率です：★1=×1.0／★2=×1.5／★3=×2.0。
              </div>
              {CLASSES.map(c => {
                const perRace = (c.need / 11).toFixed(1);
                return (
                  <div key={c.id} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub }}>
                    <span style={{ color: C.text, fontFamily: FONT_D, fontWeight: 700 }}>{c.label}</span>：昇格に必要{c.need}pt ÷ シーズン11レース ＝ 平均<span style={{ color: C.yellow, fontFamily: FONT_M }}> {perRace}pt/レース</span>が目安（★1のレースなら概ね6〜7位以内の成績）
                  </div>
                );
              })}
            </div>
          </div>

          {/* v25: ヘルプを大幅拡充。基本の能力・成長システムから、細かな仕様まで一覧できるようにする */}
          <div>
            <Eyebrow color={C.green}>能力値と特殊能力の基本</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                能力値は<span style={{ color: C.text }}>平坦・登坂・スプリント・スタミナ・独走</span>の5種類（22〜135）。区間の種類ごとに使われる能力が決まり、丘陵は登坂55%＋平坦45%、山頂フィニッシュは登坂70%＋スプリント30%、TT区間は独走60%＋平坦40%というように複数の能力が混ざる区間もあります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                選手は<span style={{ color: C.text }}>特殊能力を0〜3個</span>保有します。地形適性・展開・役割・メンタル・フィジカル・成長の5カテゴリがあり、悪特性（バッドステータス）が混ざることもあります。一定の勝利数や役割出走数を満たすと保有能力が「金の特殊能力」に強化され、逆に条件を満たせば未保有の能力を後天的に習得することもあります。発見済みの能力は「記録」タブの特殊能力図鑑で内容を確認できます（未発見のものは？？？で伏せられます）。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.yellow}>成長・練習の仕組み</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                選手にはそれぞれ<span style={{ color: C.text }}>成長タイプ</span>（早熟・普通・晩成・超早熟・超晩成）があり、年齢によって「成長期（伸び最大）」「全盛期（伸び半減）」「衰え期（能力が少しずつ下がる）」が切り替わります。ピーク年齢は早熟21〜25歳・普通24〜29歳・晩成28〜33歳・超早熟18〜21歳・超晩成32〜38歳です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                さらに<span style={{ color: C.text }}>成長力（C/B/A/S）</span>が練習・出走経験の伸び方に倍率をかけます（C×0.7・B×1.0・A×1.3・S×1.6）。練習では指定した1能力に90%、残り4能力に14%の伸びが配分されます。出走した場合は、レースで使った区間の種目に応じた「出走経験」でも能力が伸び、レースのグレードが高いほど伸びが大きくなります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                能力には難易度ごとの<span style={{ color: C.text }}>ソフトキャップ</span>があります（イージー88・ノーマル94・ハード102・鬼112）。この値未満なら伸びは全開ですが、超えると急激に伸びが鈍化します。上限を超えた金色表示の能力は「限界突破」状態です。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.red}>疲労・コンディション・故障</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                出走すると疲労が+45（「鉄人」持ちは+32）増えます。<span style={{ color: C.red }}>3ヶ月連続で出走（3連闘）すると確定で故障</span>、疲労が90を超えると確率で故障が発生します（ドクターの雇用で確率・離脱期間ともに軽減）。「頑丈」は故障率半減、「ガラスの体」は故障率2倍・離脱+1ヶ月です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                調子は→（普通）／↗（好調）／↑↑（絶好調）／↘（やや不調）／↓↓（絶不調）の5段階で毎月ランダムに変動します（「ムラっ気」は変動幅が大きく、「精密機械」は小さい）。休養させると疲労が回復します（出走なしなら-50、故障中でも自然回復します）。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.blue}>チームケミストリー・キャプテン制度</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                ロースター平均在籍月数に応じて<span style={{ color: C.text }}>チームケミストリー</span>が「新体制／定着期／円熟したチーム／鉄壁の絆」の順に上がり、レース中のドラフト消耗が最大8%軽減されます。移籍・トレード・解雇が多いと在籍月数がリセットされるため、頻繁な入れ替えは足元のケミストリーを崩すコストがあります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                任命した<span style={{ color: C.text }}>キャプテン</span>より2歳以上若い選手は練習効果+10%になりますが、キャプテン自身の練習効果は-5%になります。若手を導く分、自分の伸びしろは少し犠牲になります。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={"#6fa8dc"}>天候</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                レースごとに晴れ・🌧雨・🥵猛暑のいずれかが決まります（カレンダー・出走前画面に表示）。<span style={{ color: C.text }}>雨</span>は出走選手全員の能力を一律で下げ（「悪天候巧者」持ちは軽減）、持たない選手には落車による負傷離脱のリスクも上乗せされます。<span style={{ color: C.text }}>猛暑</span>は出走後の疲労蓄積が増えます。横風区間の影響（「横風耐性」で軽減）とは別の、レース全体にかかる要素です。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.purple}>キャンプ・機材・スタッフ</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                <span style={{ color: C.text }}>トレーニングキャンプ券</span>を使うとその月の練習効果が×2になりますが、選手全員の疲労が+25されます。クールダウンはありませんが、連発すると疲労90超＝故障リスクゾーンに入りやすくなるため、使いどころの見極めが重要です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                恒常装備：<span style={{ color: C.text }}>エアロフレーム</span>（平坦+6%/Lv）・<span style={{ color: C.text }}>軽量ホイール</span>（登坂+6%/Lv）・<span style={{ color: C.text }}>トレーニング設備</span>（練習効果+15%/Lv）は買い切りで恒常的に効果が続きます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                スタッフは月給制：<span style={{ color: C.text }}>監督</span>（スポンサー契約が有利に）・<span style={{ color: C.text }}>トレーナー</span>（練習効果が恒常アップ）・<span style={{ color: C.text }}>ドクター</span>（故障率と離脱期間を軽減）。雇用できるレベル上限はクラスが上がるほど増えます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                <span style={{ color: C.purple }}>🎯 中期目標</span>：スポンサー契約時に、複数レースにまたがる約束（例「山岳系で通算2勝」「大レースで表彰台」）が1つ提示されます。年間ノルマ（総pt）や単月の指定レースとは別枠で、<span style={{ color: C.text }}>期限月までに達成すれば臨時ボーナス（資金＋ノルマpt）、未達なら違約金</span>。どのレースにエースを送り込むか、シーズンを通した計画性が問われます。進捗は主画面のパネルで常時確認できます。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={"#e8a13c"}>グランツール・副次タイトル</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                PROクラス限定で年3回（春・夏・秋）、3日間ステージレースの<span style={{ color: C.text }}>グランツール</span>が開催されます。グランファイナルへの出場には、その年の3戦すべてで総合優勝することが条件です。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                グランツールでは総合成績とは別に、🟢ポイント賞（各区間の着順ポイント合計）・🔴山岳賞（山岳区間の着順ポイント合計）・⚪新人賞（26歳未満限定）の<span style={{ color: C.text }}>副次タイトル</span>が争われ、自チームが獲得すると賞金ボーナスが入ります。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.green}>ディナスティ周回・ユース育成枠</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                グランファイナル制覇後、「新たなチームで最初から」ではなく<span style={{ color: C.text }}>この轍を継いでさらなる高みへ</span>を選ぶと、同じチームのまま周回を継続できます（ディナスティ周回）。周回を重ねるたびに他チームの地力が底上げされ、歯応えが保たれます。クリアポイントは周回のたびに再獲得できます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                「選手・練習」タブでは年1回だけ、契約金15万円で<span style={{ color: C.text }}>ユース選手（16〜17歳・成長力A以上確定）</span>を確保できます。現在の能力は低いですが、長期育成向けの原石です。使用枠は4月の年度替わりでリセットされます。
              </div>
            </div>
          </div>

          <div>
            <Eyebrow color={C.sub}>スカウト・移籍・トレード・実績</Eyebrow>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                毎年4月は新人スカウト月間。事前に選んだ方針（おまかせ／スプリント重視／登坂力重視／将来性重視／即戦力重視）に応じて候補5名の傾向が変わります。年間を通じてFA市場・他チームからのトレード提案・選手解雇（4月のみ）も利用できます。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                <span style={{ color: "#e8a13c" }}>🎯 引き抜き市場</span>：ショップの「引き抜き市場」から、ライバルチームの<span style={{ color: C.text }}>看板選手</span>を移籍金で獲得できます（<span style={{ color: C.text }}>1シーズンに1回まで</span>）。成立すると相手は主力を失い、その選手は以後あなたのチームで走ります。逆に、あなたの主力が強豪から狙われる<span style={{ color: "#e8a13c" }}>引き抜きオファー</span>が届くこともあります。引き止め費用を払って残すか、移籍金を受け取って放出するか——放出した選手はライバルの一員として自チームの前に立ちはだかります。移籍金は選手の実力と移籍意欲で決まります。
              </div>
              <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}`, fontSize: 11.5, color: C.sub, lineHeight: 1.8 }}>
                実績を達成すると報酬（賞金や恒常ボーナス）が入ります。詳細な一覧は「記録」タブで確認できます。解雇・引退した選手のうち、実績かお気に入り登録の条件を満たした選手だけが殿堂入りとして名鑑に残ります。
              </div>
            </div>
          </div>
        </div>
  );
}
