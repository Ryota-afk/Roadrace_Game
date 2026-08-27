// mylife.jsx より分割（Step8）：引退・引き継ぎ以降（retire_advice/retired/teamroster/graph/ranking/lineage/factors/legends）
// 第13弾Phase3-C: 新トークン(T/FONT_DOT)へ全面移行。dynasty.jsx（LineageForestView/FactorCollectionView）は
// meta.jsxと共有のため中身は据え置き（Phase3-D担当）。
import React from "react";
import { legendBloodId, loadBloodlines, loadMlLegends, mlBloodlineTier, saveMlLegends } from "../../breeding/breeding.js";
import { LineageForestView, FactorCollectionView } from "../../components/dynasty.jsx";
import { overall } from "../../core/core.js";
import { ABILITIES, PERSONALITIES, TYPES } from "../../data/abilities.js";
import { MONTHS } from "../../data/course.js";
import { CLASSES } from "../../data/progression.js";
import { FONT_DOT, T } from "../../data/theme.js";
import { mlFactorCollection, mlLineageForest, bloodIdToName, breedNickTableRows, buildBloodMap, clearMyLifeSave, mlAutobiographyOptions, mlSetAutobiography, mlCareerTimeline, mlWorldBoard, protegeState, rivalHeatTier, worldRankTier } from "../../logic/support.js";
import { avgBondFor, bondTier } from "../../domain/mylife/bonds.js";
import { initMyLife, mlCareerArchetype, computeAchievements, ML_ACHIEVEMENTS } from "../../state/state.js";
import { Item, Prose, QuietBtn, Screen, Section, Tag, TypeChip } from "../../components/kit.jsx";

// 第32弾（第2次UI改革）B-4第2バッチ: 進退・その後の決断を表す選択肢カード。
// 面（surfaceUp／主ボタンはaction）＋1行タイトル＋1行の帰結説明。「今この選択肢を
// 押すと何が起きるか」を浮いた注釈ではなくカード自身に持たせる。
// career.jsx内でのみ使用（画面1「引退勧告」と画面2「これから」の2箇所）。
const ChoiceCard = ({ title, note, onClick, primary, danger }) => (
  <button onClick={onClick} style={{
    display: "block", width: "100%", textAlign: "left", border: "none", cursor: "pointer",
    fontFamily: FONT_DOT, padding: T.space.md, marginBottom: T.space.sm,
    background: primary ? T.color.action : T.color.surfaceUp,
  }}>
    <div style={{ fontSize: T.size.head, color: primary ? T.color.ink : (danger ? T.color.bad : T.color.text) }}>{title}</div>
    <div style={{ fontSize: T.size.caption, color: primary ? T.color.ink : T.color.sub, marginTop: 2, opacity: primary ? 0.75 : 1 }}>{note}</div>
  </button>
);

export function renderMyLifeCareerScreens(ctx) {
  const { askConfirm, becomeManager, ml, mlRetireAdviceAccept, mlRetireAdviceContinue, mlRetireAdviceReduceRole, mlWrap, setMl, setSuperMode } = ctx;

  // ---- 引退勧告／契約更改 ----
  // 第32弾（第2次UI改革）B-4第2バッチ案A: 見出し1行＋判断材料3列＋選択肢カード化。
  // 「全盛期」の実体はjoinOvr＝デビュー時の総合力で、いま全盛期の倍近く強いという
  // 誤表示だった（実測）。実際のピーク＝careerHistoryの最大値へ差し替える。
  if (ml.screen === "mylife_retire_advice" && ml.player) {
    const r = ml.player;
    const info = ml.adviceInfo || { age: r.age, ovr: overall(r), joinOvr: r.joinOvr, declining: false, reducedRole: false };
    const decl = info.declining;
    const peakOvr = Math.max(...(ml.careerHistory || []).map(h => h.ovr || 0), info.ovr);
    return mlWrap(
      <Screen>
        <div style={{ fontSize: T.size.title, marginBottom: T.space.md }}>{info.age}歳・進退を決める</div>
        <div style={{ display: "flex", gap: T.space.sm, marginBottom: T.space.md }}>
          <div style={{ flex: 1, background: T.color.surface, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: T.size.micro, color: T.color.sub }}>総合力</div>
            <div style={{ fontSize: T.size.title, color: T.color.accent, marginTop: 2 }}>{info.ovr}</div>
          </div>
          <div style={{ flex: 1, background: T.color.surface, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: T.size.micro, color: T.color.sub }}>ピーク</div>
            <div style={{ fontSize: T.size.title, marginTop: 2 }}>{peakOvr}</div>
          </div>
          <div style={{ flex: 1, background: T.color.surface, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: T.size.micro, color: T.color.sub }}>最高世界ランク</div>
            <div style={{ fontSize: T.size.title, marginTop: 2 }}>{ml.worldRankBest == null ? "—" : <>{ml.worldRankBest}<span style={{ fontSize: T.size.micro, color: T.color.sub }}>位</span></>}</div>
          </div>
        </div>
        <div style={{ background: T.color.surface, padding: T.space.md, marginBottom: T.space.md }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.xs }}>監督</div>
          <div style={{ fontSize: T.size.body, lineHeight: 1.8 }}>
            {decl
              ? `「${r.name}、今季もよく走ってくれた。だが正直、往年の走りには戻れていない。そろそろ身の振り方を考える時期かもしれない。もう一年やるか、役割を落として続けるか、それとも——決めるのは君だ」`
              : `「${r.name}、来季の契約をどうする？まだやれる脚だ。もう一年勝負するもよし、役割を落として長く続けるもよし。引き際もまた、君自身が決めることだ」`}
          </div>
        </div>
        <ChoiceCard primary title="現役を続ける" note="来季も同じように走ります" onClick={mlRetireAdviceContinue} />
        {!info.reducedRole && (
          <ChoiceCard title="役割を縮小して続ける" note="レースでの負担が減り、長く走れます" onClick={mlRetireAdviceReduceRole} />
        )}
        <ChoiceCard danger title="今季限りで引退する" note="キャリアを振り返る画面へ進みます"
          onClick={() => askConfirm(`${r.age}歳で引退しますか？この操作は取り消せません。`, mlRetireAdviceAccept, "引退する")} />
      </Screen>
    );
  }

  // ---- 引退セレモニー ----
  if (ml.screen === "mylife_retired" && ml.player) {
    const r = ml.player;
    const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
    const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
    const arch = mlCareerArchetype(ml);
    const races = r.raceLog || [];
    const hist = [...(ml.careerHistory || []), { year: ml.year, ovr: overall(r), worldRank: ml.worldRank }];
    const maxOvrEntry = hist.reduce((a, b) => (b.ovr || 0) > (a.ovr || 0) ? b : a, hist[0]);
    const rankPts = hist.filter(h => h.worldRank != null);
    const bestRankEntry = rankPts.length ? rankPts.reduce((a, b) => b.worldRank < a.worldRank ? b : a) : null;
    const achieved = computeAchievements(ml).filter(a => a.achieved);
    const missed = computeAchievements(ml).filter(a => !a.achieved);
    const tl = mlCareerTimeline(ml).slice(0, 10);

    // 第32弾（第2次UI改革）B-4第2バッチ案B: 生涯成績3列を名前直下へ・「歩んだ道のり」を
    // 3行へ縮小・「成し遂げたこと」を2列化。ラストレース名の先頭に自分の名前が
    // 焼き込まれている（controllers/mylife/raceStart.js:26）ため、直上のヒーローと
    // 重複しないよう既知の接頭辞だけを表示時に外す。
    const lastRaceName = ml.lastRaceResult && ml.lastRaceResult.name && ml.lastRaceResult.name.startsWith(r.name + " ")
      ? ml.lastRaceResult.name.slice(r.name.length + 1)
      : (ml.lastRaceResult && ml.lastRaceResult.name);

    return mlWrap(
      <Screen>
        <div style={{ background: T.color.surface, padding: T.space.lg, marginBottom: T.space.sm, textAlign: "center" }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{ml.year}年目・{r.age}歳で引退</div>
          <div style={{ fontSize: T.size.title, marginTop: T.space.sm }}>{r.name}</div>
          <div style={{ fontSize: T.size.head, color: T.color.accent, marginTop: T.space.md }}>{arch.title}</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs, lineHeight: 1.7 }}>{arch.desc}</div>
        </div>
        <div style={{ display: "flex", gap: T.space.sm, marginBottom: T.space.md }}>
          <div style={{ flex: 1, background: T.color.surface, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: T.size.micro, color: T.color.sub }}>出走</div>
            <div style={{ fontSize: T.size.title, marginTop: 2 }}>{races.length}</div>
          </div>
          <div style={{ flex: 1, background: T.color.surface, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: T.size.micro, color: T.color.sub }}>優勝</div>
            <div style={{ fontSize: T.size.title, color: T.color.accent, marginTop: 2 }}>{wins}</div>
          </div>
          <div style={{ flex: 1, background: T.color.surface, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: T.size.micro, color: T.color.sub }}>表彰台</div>
            <div style={{ fontSize: T.size.title, marginTop: 2 }}>{podiums}</div>
          </div>
        </div>

        {ml.lastRaceResult && (
          <Section title="ラストレース">
            <div style={{ padding: `${T.space.sm}px 0` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
                <span>{lastRaceName}</span>
                <span style={{ color: T.color.sub }}>{ml.lastRaceResult.rank}位 / {ml.lastRaceResult.total}人中</span>
              </div>
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs, lineHeight: 1.7 }}>{ml.lastRaceResult.flavor}</div>
            </div>
          </Section>
        )}

        <Section title="歩んだ道のり">
          <Item first label="到達クラス" value={`${CLASSES[0].label} → ${CLASSES[ml.classIdx]?.label || CLASSES[0].label}`} valueColor={T.color.accent} />
          {maxOvrEntry && <Item label="最高総合力" value={maxOvrEntry.ovr} detail={`${maxOvrEntry.year}年目に到達`} />}
          {bestRankEntry && <Item label="最高世界ランク" value={`${bestRankEntry.worldRank}位`} detail={`${bestRankEntry.year}年目に到達`} />}
        </Section>

        <Section title="成し遂げたこと" right={`${achieved.length} / ${ML_ACHIEVEMENTS.length}`}>
          {achieved.length === 0 ? (
            <Item first label="—" value="" detail="心に残る一勝は無かったが、走り続けた日々そのものが記録だ。" />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: `2px ${T.space.md}px` }}>
              {achieved.map(a => (
                <div key={a.id} style={{ fontSize: T.size.label, padding: "5px 0", borderTop: `1px solid ${T.color.rule}` }}>{a.label}</div>
              ))}
            </div>
          )}
        </Section>
        {missed.length > 0 && (
          <div onClick={() => setMl(s => ({ ...s, retiredMissedOpen: !s.retiredMissedOpen }))}
            style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>
            <span>まだ届かなかったもの {missed.length}件</span>
            <span style={{ color: T.color.accent }}>{ml.retiredMissedOpen ? "閉じる ▴" : "開く ▾"}</span>
          </div>
        )}
        {ml.retiredMissedOpen && (
          <div style={{ background: T.color.surface, padding: `0 ${T.space.md}px`, marginBottom: T.space.md }}>
            {missed.map((a, i) => <Item key={a.id} first={i === 0} label={a.label} value="" />)}
          </div>
        )}

        {tl.length > 0 && (
          <Section title="キャリアの名場面">
            {tl.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: T.space.sm, alignItems: "baseline", padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <span style={{ flex: "none", width: 80, fontSize: T.size.caption, color: T.color.sub }}>{e.year}年目{e.month != null ? MONTHS[e.month] : ""}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: T.size.body, lineHeight: 1.5, color: e.down ? T.color.sub : T.color.text }}>{e.text}</span>
              </div>
            ))}
          </Section>
        )}

        {ml.rival && (() => {
          const ht = rivalHeatTier(ml.rivalRecord?.heat ?? ml.rivalRecord?.meetings ?? 0);
          const rec = ml.rivalRecord || {}; const m = rec.meetings || 0;
          const tail = m === 0 ? "ついに本気で相まみえる機会は訪れなかったが、その存在は常に道標だった。"
            : ht.key >= 3 ? "幾度となく死力を尽くして競り合った、生涯忘れえぬ宿命の相手だった。"
            : ht.key >= 2 ? "何度も牙を剥き合い、互いを限界まで高め合った宿敵だった。"
            : ht.key >= 1 ? "しのぎを削り合った、忘れがたきライバルだった。" : "良き好敵手として、互いの走りを認め合った。";
          return (
            <Section title="好敵手">
              <div style={{ padding: `${T.space.sm}px 0` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
                  <span>{ml.rival.name} <span style={{ fontSize: T.size.caption, color: T.color.accent }}>{ht.label}</span></span>
                  <span style={{ color: T.color.sub, fontSize: T.size.caption }}>{m}戦 {rec.wins || 0}勝{rec.losses || 0}敗</span>
                </div>
                <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs, lineHeight: 1.7 }}>{tail}</div>
              </div>
              {ml.rival2 && (ml.rivalRecord2?.meetings || 0) > 0 && (() => {
                const ht2 = rivalHeatTier(ml.rivalRecord2?.heat ?? ml.rivalRecord2?.meetings ?? 0);
                const rec2 = ml.rivalRecord2 || {};
                return (
                  <div style={{ padding: `${T.space.sm}px 0`, borderTop: `1px solid ${T.color.rule}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
                      <span>{ml.rival2.name} <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{ht2.label}</span></span>
                      <span style={{ color: T.color.sub, fontSize: T.size.caption }}>{rec2.meetings || 0}戦 {rec2.wins || 0}勝{rec2.losses || 0}敗</span>
                    </div>
                  </div>
                );
              })()}
            </Section>
          );
        })()}

        {ml.protege && (() => {
          const pr = protegeState(ml.protege, ml.year);
          const t = TYPES[ml.protege.type];
          return (
            <>
              <Section title="受け継がれる意志">
                <Prose>
                  あなたが指導した弟子 {ml.protege.name}（{t.label}・{pr.age}歳）は、いまや総合力{pr.ovr}の
                  {pr.ovr >= 88 ? "堂々たるエース" : pr.ovr >= 78 ? "頼れる一線級" : "成長著しい若手"}へと育った。
                  {pr.ovr >= 82 ? "あなたの背中は、確かに次の世代へ受け継がれた。" : "その走りには、あなたの教えが宿っている。"}
                </Prose>
              </Section>
            </>
          );
        })()}

        {/* 第13弾Phase3-C: エピローグ選択制を廃止し自動生成（useMyLifeGame.jsのuseEffectで
            弟子の有無から一度だけ確定・保存される）。「監督としてチームに残る」という文章だけの
            選択肢と、実際にモード移行する下部ボタンが並んで紛らわしかったため（ユーザー指摘）。 */}
        {ml.epilogueText && (
          <Section title="その後">
            <Prose>{ml.epilogueText}</Prose>
          </Section>
        )}

        {ml.autobiographyText ? (
          <Section title="自伝に残す言葉">
            <Prose>「{ml.autobiographyText}」</Prose>
          </Section>
        ) : (
          <>
            <div style={{ fontSize: T.size.caption, color: T.color.accent, marginBottom: T.space.sm }}>自伝に残す言葉</div>
            {mlAutobiographyOptions(ml).map((o, i) => (
              <button key={i} onClick={() => { mlSetAutobiography(o.text); setMl(s => ({ ...s, autobiographyText: o.text })); }}
                style={{ display: "block", width: "100%", textAlign: "left", border: "none", cursor: "pointer", fontFamily: FONT_DOT,
                  background: T.color.surfaceUp, padding: T.space.md, marginBottom: T.space.sm,
                  fontSize: T.size.body, lineHeight: 1.7, color: T.color.text }}>
                「{o.text}」
              </button>
            ))}
          </>
        )}

        {ml.awardedCP && ml.awardedCP.total > 0 && (
          <Section title="生涯クリアポイント">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: `${T.space.sm}px 0` }}>
              <span style={{ fontSize: T.size.body, color: T.color.sub }}>獲得</span>
              <span style={{ fontSize: T.size.display, color: T.color.accent }}>{ml.awardedCP.total}<span style={{ fontSize: T.size.caption, color: T.color.sub }}>pt</span></span>
            </div>
            {ml.awardedCP.parts.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.caption, color: T.color.sub, padding: "3px 0", borderTop: i === 0 ? `1px solid ${T.color.rule}` : "none", paddingTop: i === 0 ? T.space.sm : 3 }}>
                <span>{p.label}</span><span>{p.cp >= 0 ? "+" : ""}{p.cp}</span>
              </div>
            ))}
          </Section>
        )}

        <div style={{ fontSize: T.size.caption, color: T.color.accent, marginBottom: T.space.sm }}>これから</div>
        <ChoiceCard primary title="監督として新チームを率いる" note={`${r.name}を創設メンバーに迎え、同じ世界で戦います`} onClick={becomeManager} />
        <ChoiceCard title="新たな選手でキャリアを始める" note="この選手の記録は殿堂に残ります"
          onClick={() => { clearMyLifeSave(); setMl(initMyLife()); }} />
        <div style={{ marginTop: T.space.md }}>
          <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_legends", careerBack: s.screen }))}>歴代選手の殿堂を見る</QuietBtn>
        </div>
      </Screen>
    );
  }

  // ---- チーム名鑑 ----
  // 第32弾（第2次UI改革）B-4案A: ヘッダを2行圧縮（結束はタグでヘッダへ）・あなたカードは
  // 面パネル2行・チームメイト行は脚質をTypeChip化し絆行は初期tierのときは出さない。
  if (ml.screen === "mylife_teamroster" && ml.player) {
    const mates = ml.teammates || [];
    // 第18弾: 結束＝チームメイトの絆の平均（弟子は指導で育つ別枠のため、この平均には含めない）
    const cohesionTier = bondTier(avgBondFor(ml.bonds, mates.map(tm => tm.id)));
    const pr = ml.protege ? protegeState(ml.protege, ml.year) : null;
    return mlWrap(
      <Screen>
        <div style={{ marginBottom: T.space.lg, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: T.size.title }}>{ml.team}</div>
          {mates.length > 0 && <Tag>結束 {cohesionTier}</Tag>}
        </div>
        <div style={{ background: T.color.surface, padding: T.space.md, marginBottom: T.space.md }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ display: "flex", alignItems: "center", gap: T.space.xs }}>
              <span style={{ fontSize: T.size.head, color: T.color.text }}>{ml.player.name}</span>
              <Tag>あなた</Tag>
            </span>
            <span>
              <span style={{ fontSize: T.size.title, color: T.color.accent }}>{overall(ml.player)}</span>
              <span style={{ fontSize: T.size.caption, color: T.color.sub, marginLeft: T.space.xs }}>総合力</span>
            </span>
          </div>
          <div style={{ marginTop: T.space.xs }}><TypeChip type={ml.player.type} /></div>
        </div>
        <Section title={`チームメイト ${mates.length}名`}>
          {mates.length === 0 && <Item first label="—" value="" detail="チームメイトの記録がありません。" />}
          {mates.map((tm, i) => {
            const per = PERSONALITIES[tm.personality];
            const abilLabels = (tm.abilities || []).map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・");
            const bondVal = (ml.bonds || {})[tm.id] || 0;
            const bond = bondTier(bondVal);
            const bondRaised = bondTier(0) !== bond;
            return (
              <div key={i} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
                  <span>{tm.name}{abilLabels && <span style={{ fontSize: T.size.caption, color: T.color.accent, marginLeft: T.space.xs }}>{abilLabels}</span>}</span>
                  <TypeChip type={tm.type} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
                  {per && <span style={{ fontSize: T.size.caption, color: T.color.sub }}>性格 {per.label}（{per.desc}）</span>}
                  {bondRaised && <Tag color={T.color.accent}>絆 {bond}</Tag>}
                </div>
                {(tm.winsForMe || 0) > 0 && <div style={{ fontSize: T.size.caption, color: T.color.good, marginTop: 2 }}>あなたのアシストとして {tm.winsForMe} 勝を支えた</div>}
              </div>
            );
          })}
        </Section>
        {ml.protege && pr && (
          <Section title="弟子">
            <div style={{ padding: `${T.space.sm}px 0` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
                <span>{ml.protege.name}</span>
                <TypeChip type={ml.protege.type} />
              </div>
              <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>{pr.age}歳・総合力{pr.ovr}</div>
              <div style={{ fontSize: T.size.caption, color: T.color.accent, marginTop: 2 }}>絆　{bondTier(ml.protege.bond || 0)}</div>
            </div>
          </Section>
        )}
        <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_world" }))}>世界の画面に戻る</QuietBtn>
      </Screen>
    );
  }

  // ---- キャリアグラフ ----
  // 第32弾（第2次UI改革）B-4案A: チャート主役化（H170→220）＋世界ランク軸を固定化。
  // 従来のmin-max正規化は本人の最高順位が常に上端に張り付くため、291位のような
  // 実際は低い順位でも「グラフの上の方＝好成績」に見える誤解を生んでいた
  // （devlog/wave32.md B-4実測で確認）。固定軸(1〜300位)で絶対水準がそのまま読めるようにする。
  if (ml.screen === "mylife_graph" && ml.player) {
    const hist = [...(ml.careerHistory || []), { year: ml.year, ovr: overall(ml.player), worldRank: ml.worldRank }];
    const W = 340, H = 220, padL = 26, padR = 30, padT = 18, padB = 26;
    const years = hist.map(h => h.year);
    const minY = Math.min(...years), maxY = Math.max(...years);
    const xAt = (yr) => maxY === minY ? W / 2 : padL + (yr - minY) / (maxY - minY) * (W - padL - padR);
    const ovrs = hist.map(h => h.ovr || 0);
    const oMin = Math.min(...ovrs) - 3, oMax = Math.max(...ovrs) + 3;
    const yOvr = (v) => H - padB - ((v - oMin) / Math.max(1, oMax - oMin)) * (H - padT - padB);
    const rankPts = hist.filter(h => h.worldRank != null);
    // 固定軸：1位=上端・300位=下端（世界ロースター定数=300）。min-maxではなく絶対値で描く。
    const WORLD_ROSTER_SIZE = 300;
    const yRank = (v) => padT + (v - 1) / (WORLD_ROSTER_SIZE - 1) * (H - padT - padB);
    const ovrPath = hist.map((h, i) => `${i === 0 ? "M" : "L"}${xAt(h.year).toFixed(1)},${yOvr(h.ovr || 0).toFixed(1)}`).join(" ");
    const rankPath = rankPts.map((h, i) => `${i === 0 ? "M" : "L"}${xAt(h.year).toFixed(1)},${yRank(h.worldRank).toFixed(1)}`).join(" ");
    const maxOvrIdx = ovrs.indexOf(Math.max(...ovrs));
    const labelIdxs = [...new Set([0, hist.length - 1, maxOvrIdx])];

    const tl = mlCareerTimeline(ml);

    return mlWrap(
      <Screen>
        <div style={{ marginBottom: T.space.lg }}>
          <div style={{ fontSize: T.size.title }}>キャリアの推移</div>
        </div>
        <div style={{ background: T.color.surface, padding: T.space.md, marginBottom: T.space.md }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
            <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={T.color.rule} />
            {rankPath && <path d={rankPath} fill="none" stroke={T.color.sub} strokeWidth="1.5" strokeDasharray="3,3" />}
            {rankPts.map((h, i) => <circle key={`r${i}`} cx={xAt(h.year)} cy={yRank(h.worldRank)} r="2" fill={T.color.sub} />)}
            <path d={ovrPath} fill="none" stroke={T.color.accent} strokeWidth="2" />
            {hist.map((h, i) => <circle key={i} cx={xAt(h.year)} cy={yOvr(h.ovr || 0)} r="2.5" fill={T.color.accent} />)}
            {hist.map((h, i) => <text key={`t${i}`} x={xAt(h.year)} y={H - 8} fontSize="8" fill={T.color.sub} textAnchor="middle">{h.year}</text>)}
            {labelIdxs.map(i => {
              const h = hist[i];
              const po = yOvr(h.ovr || 0);
              return <text key={`ovl${i}`} x={xAt(h.year)} y={po - 6} fontSize="10" fill={T.color.accent} textAnchor="middle">{h.ovr || 0}</text>;
            })}
            {labelIdxs.map(i => {
              const h = hist[i];
              if (h.worldRank == null) return null;
              const po = yOvr(h.ovr || 0), pr = yRank(h.worldRank);
              const ly = Math.abs(pr - po) < 18 ? Math.max(pr, po) + 14 : pr + 13;
              return <text key={`rkl${i}`} x={xAt(h.year)} y={ly} fontSize="10" fill={T.color.sub} textAnchor="middle">{h.worldRank}位</text>;
            })}
          </svg>
          <div style={{ display: "flex", gap: T.space.lg, justifyContent: "center", fontSize: T.size.caption, marginTop: T.space.xs }}>
            <span style={{ color: T.color.accent }}>— 総合力</span>
            <span style={{ color: T.color.sub }}>┈ 世界ランク</span>
          </div>
        </div>
        <Section title="キャリアの軌跡">
          {tl.length === 0 ? (
            <Item first label="—" value="" detail="まだ語るべき一戦はない。初勝利・初表彰台がここに刻まれていく。" />
          ) : tl.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: T.space.sm, alignItems: "baseline", padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
              <span style={{ flex: "none", width: 80, fontSize: T.size.caption, color: T.color.sub }}>{e.year}年目{e.month != null ? MONTHS[e.month] : ""}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: T.size.body, lineHeight: 1.5, color: e.down ? T.color.sub : T.color.text }}>{e.text}</span>
            </div>
          ))}
        </Section>
        <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_rider" }))}>選手の画面に戻る</QuietBtn>
      </Screen>
    );
  }

  // ---- 世界ランキング（詳細） ----
  // 第32弾（第2次UI改革）B-4案A: 行を「名前が主役」に。順位番号は右揃え固定幅の脇役、
  // 「あなた／ライバル／好敵手」は括弧書きの文章からTag化して名前の直後へ、通算勝利数は
  // 0勝なら非表示、右端ptsは強調（あなたはaccent）。
  if (ml.screen === "mylife_ranking" && ml.player) {
    const board = mlWorldBoard(ml);
    const tier = worldRankTier(ml.worldRank);
    const worldNews = ml.worldNews || [];
    const Row = (e) => {
      const tagLabel = e.isPlayer ? "あなた" : e.isRival ? "ライバル" : e.isRival2 ? "好敵手" : null;
      return (
        <div key={e.rank} style={{ padding: `${T.space.sm}px 0`, borderTop: `1px solid ${T.color.rule}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: T.space.sm }}>
            <span style={{ width: 22, flex: "none", textAlign: "right", fontSize: T.size.label, color: e.isPlayer ? T.color.accent : T.color.sub, fontVariantNumeric: "tabular-nums" }}>{e.rank}</span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: T.space.xs, overflow: "hidden" }}>
              <span style={{ fontSize: T.size.head, color: e.isPlayer ? T.color.accent : T.color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
              {tagLabel && <Tag color={e.isPlayer ? T.color.accent : undefined}>{tagLabel}</Tag>}
              {e.star && e.star.wins > 0 && <span style={{ fontSize: T.size.micro, color: T.color.sub, flex: "none" }}>通算{e.star.wins}勝</span>}
            </span>
            <span style={{ flex: "none", fontSize: T.size.label, color: e.isPlayer ? T.color.accent : T.color.sub, fontVariantNumeric: "tabular-nums" }}>{e.pts}</span>
          </div>
          {e.star?.bloodOf && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginLeft: 30 }}>{e.star.bloodOf}の血を継ぐ</div>}
        </div>
      );
    };
    return mlWrap(
      <Screen>
        <div style={{ background: T.color.surface, padding: T.space.lg, marginBottom: T.space.md, textAlign: "center" }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{ml.year}年目の世界ランキング</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: T.space.xs, marginTop: T.space.md }}>
            <span style={{ fontSize: T.size.display, color: T.color.accent }}>{ml.worldRank == null ? "—" : ml.worldRank}</span>
            <span style={{ fontSize: T.size.body, color: T.color.sub }}>位</span>
          </div>
          <div style={{ fontSize: T.size.head, marginTop: T.space.sm }}>{tier.label}</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm }}>
            {Math.round(ml.worldPoints || 0)}pt{ml.worldRankBest != null ? `・自己最高 ${ml.worldRankBest}位` : ""}
          </div>
        </div>
        {worldNews.length > 0 && (
          <Section title="今年の世界の動き">
            {worldNews.map((n, i) => (
              <div key={i} style={{ fontSize: T.size.body, lineHeight: 1.6, padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>{n}</div>
            ))}
          </Section>
        )}
        <Section title="世界トップ10">{board.top.map(Row)}</Section>
        {board.around.length > 0 && <Section title="あなたの周辺">{board.around.map(Row)}</Section>}
        {(board.rivalRank != null && ml.rival && !board.top.some(e => e.isRival) && !board.around.some(e => e.isRival)) && (
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>ライバル {ml.rival.name}：世界{board.rivalRank}位</div>
        )}
        {(board.rival2Rank != null && ml.rival2 && !board.top.some(e => e.isRival2) && !board.around.some(e => e.isRival2)) && (
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>好敵手 {ml.rival2.name}：世界{board.rival2Rank}位</div>
        )}
        <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_world" }))}>世界の画面に戻る</QuietBtn>
      </Screen>
    );
  }

  // ---- 系譜ツリー／因子図鑑（meta.jsxと共有・据え置き・Phase3-D担当） ----
  // 第33弾: 戻り先を開いた場所に追従させる（記録タブから直接開いた場合は記録へ。
  // 従来は殿堂固定→殿堂の戻るがタイトル側のキャリア作成へ飛ぶ二重の迷子だった）。
  const dexBackScreen = ml.dexBack || "mylife_legends";
  const dexBackLabel = dexBackScreen === "mylife_archive" ? "← 記録に戻る" : "← 殿堂に戻る";
  if (ml.screen === "mylife_lineage") {
    const forest = mlLineageForest();
    const totalLeg = loadMlLegends().length;
    return mlWrap(
      <LineageForestView forest={forest} totalLeg={totalLeg} variant="mylife"
        footer={<QuietBtn onClick={() => setMl(s => ({ ...s, screen: dexBackScreen }))}>{dexBackLabel}</QuietBtn>} />
    );
  }
  if (ml.screen === "mylife_factors") {
    const cats = mlFactorCollection();
    const totalLeg = loadMlLegends().length;
    return mlWrap(
      <FactorCollectionView cats={cats} totalLeg={totalLeg} variant="mylife"
        footer={<QuietBtn onClick={() => setMl(s => ({ ...s, screen: dexBackScreen }))}>{dexBackLabel}</QuietBtn>} />
    );
  }

  // ---- 殿堂 ----
  // 第32弾（第2次UI改革）B-4第2バッチ案A: 説明を1行に・件数は見出し右へ・配合の相性表を
  // トグルからボタン3つ並びへ（開いた時に見出しが二重に出ていたのを解消）・脚質をTypeChip化・
  // 展開部の好敵手／弟子はItemのvalueに文章を詰めていたため右揃えが破綻していた
  // （弟子は2行に折り返し）。名前をvalue・説明をdetailへ分ける。
  if (ml.screen === "mylife_legends") {
    const allLegends = loadMlLegends();
    const legends = [...allLegends].reverse();
    const bloodMap = buildBloodMap(allLegends);
    return mlWrap(
      <Screen>
        <div style={{ marginBottom: T.space.sm, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: T.size.title }}>殿堂</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{legends.length}名</div>
        </div>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.md }}>引退した選手は、次のキャリアで師匠や親に選べます。</div>

        <div style={{ display: "flex", gap: T.space.sm, marginBottom: T.space.md }}>
          <div style={{ flex: 1 }}><QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_lineage", dexBack: "mylife_legends" }))}>系譜ツリー</QuietBtn></div>
          <div style={{ flex: 1 }}><QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_factors", dexBack: "mylife_legends" }))}>因子図鑑</QuietBtn></div>
          <div style={{ flex: 1 }}><QuietBtn color={ml.showNicks ? T.color.action : undefined} onClick={() => setMl(s => ({ ...s, showNicks: !s.showNicks }))}>配合の相性表</QuietBtn></div>
        </div>

        {ml.showNicks && (
          <div style={{ background: T.color.surface, padding: `0 ${T.space.md}px`, marginBottom: T.space.md }}>
            {breedNickTableRows().map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: T.space.sm, fontSize: T.size.caption, padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <span style={{ width: 18, color: r.rank === "◎" ? T.color.accent : T.color.text }}>{r.rank}</span>
                <span style={{ width: 110, color: T.color.text }}>{TYPES[r.pair[0]]?.label || r.pair[0]}×{TYPES[r.pair[1]]?.label || r.pair[1]}</span>
                <span style={{ color: T.color.sub, flex: 1 }}>{r.label}{r.ability && ABILITIES[r.ability] ? `（${ABILITIES[r.ability].label}）` : ""}</span>
              </div>
            ))}
          </div>
        )}

        {legends.length === 0 && <div style={{ fontSize: T.size.body, color: T.color.sub, marginBottom: T.space.md }}>まだ引退した選手はいません。</div>}

        {legends.map((leg, i) => {
          const legId = legendBloodId(leg);
          const expanded = ml.expandedLegend === legId;
          const parents = leg.parents || [];
          const tierRec = leg.lineageName ? loadBloodlines()[leg.lineageName] : null;
          const tier = tierRec ? mlBloodlineTier(tierRec) : null;
          return (
            <div key={i} onClick={() => setMl(s => ({ ...s, expandedLegend: expanded ? null : legId }))}
              style={{ background: T.color.surface, padding: T.space.md, marginBottom: T.space.sm, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.head }}>
                <span style={{ display: "flex", alignItems: "center", gap: T.space.xs }}>{leg.name} <TypeChip type={leg.type} /></span>
                <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{leg.endYear}年目引退・{leg.age}歳</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: T.space.xs }}>
                <span style={{ fontSize: T.size.caption, color: T.color.accent }}>{leg.careerTitle}</span>
                <span style={{ fontSize: T.size.caption, color: T.color.sub }}>
                  {leg.races}戦{leg.wins}勝・表彰台{leg.podiums}回{!expanded && <span style={{ color: T.color.accent, marginLeft: T.space.sm }}>▾</span>}
                </span>
              </div>

              {expanded && (
                <div onClick={(ev) => ev.stopPropagation()}>
                  <div style={{ marginTop: T.space.md, paddingTop: T.space.md, borderTop: `1px solid ${T.color.rule}`, fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.8 }}>
                    {leg.careerTitleDesc}
                  </div>
                  <div style={{ marginTop: T.space.md }}>
                    <Item first label="チーム" value={leg.team} />
                    <Item label="実績" value={`${leg.achievedCount}/${leg.achievedTotal}`} />
                    {leg.rivalName && (() => {
                      const ht = rivalHeatTier(leg.rivalRecord?.heat ?? leg.rivalRecord?.meetings ?? 0);
                      return <Item label="好敵手" value={leg.rivalName} detail={`${ht.label}・${leg.rivalRecord?.wins || 0}勝${leg.rivalRecord?.losses || 0}敗`} />;
                    })()}
                    {leg.protege && (() => {
                      const pr = protegeState(leg.protege, leg.endYear);
                      return <Item label="弟子" value={leg.protege.name} detail={`${TYPES[leg.protege.type]?.label}・総合力${pr.ovr}まで育てた`} />;
                    })()}
                    {leg.specialMatingTitle && <Item label="特殊配合" value={leg.specialMatingTitle} valueColor={T.color.accent} />}
                    {leg.lineageName && (
                      <Item label="系統" value={leg.lineageName} detail={tier && tier.tier > 0 ? `${tier.label}（${tierRec.count}名・${tierRec.wins}勝）` : null} />
                    )}
                  </div>
                  {parents.length > 0 && (
                    <div style={{ marginTop: T.space.md, fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.8 }}>
                      <div>父母：{parents.map(p => bloodIdToName(p, bloodMap)).join(" × ")}</div>
                      {parents.map((pid, pj) => {
                        const pl = bloodMap[pid]; const gp = (pl && pl.parents) || [];
                        if (gp.length === 0) return null;
                        return <div key={pj} style={{ marginLeft: T.space.md }}>{bloodIdToName(pid, bloodMap)}の父母：{gp.map(g => bloodIdToName(g, bloodMap)).join(" × ")}</div>;
                      })}
                    </div>
                  )}
                  {leg.epilogue && <div style={{ fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.8, marginTop: T.space.md, paddingTop: T.space.md, borderTop: `1px solid ${T.color.rule}` }}>{leg.epilogue}</div>}
                  {leg.autobiography && <div style={{ fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.8, marginTop: T.space.sm }}>「{leg.autobiography}」</div>}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: T.space.md, paddingTop: T.space.sm, borderTop: `1px solid ${T.color.rule}` }}>
                    <span style={{ fontSize: T.size.caption, color: T.color.bad, cursor: "pointer" }}
                      onClick={() => askConfirm(`殿堂記録から「${leg.name}」を削除しますか？この操作は取り消せません（血統の親として選べなくなります）。`, () => {
                        const list = loadMlLegends(); const oi = allLegends.length - 1 - i; if (oi >= 0 && oi < list.length) { list.splice(oi, 1); saveMlLegends(list); setMl(s => ({ ...s })); }
                      }, "削除する")}>この記録を削除</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {/* 第33弾: 戻り先は開いた場所（記録タブ／キャリア作成／引退後）に追従する。 */}
        <QuietBtn onClick={() => setMl(s => ({ ...s, screen: s.careerBack || "mylife_create" }))}>← 戻る</QuietBtn>
      </Screen>
    );
  }
}
