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
import { initMyLife, mlCareerArchetype, computeAchievements, ML_ACHIEVEMENTS } from "../../state/state.js";
import { Item, PrimaryBtn, Prose, QuietBtn, Screen, Section } from "../../components/kit.jsx";

export function renderMyLifeCareerScreens(ctx) {
  const { askConfirm, becomeManager, ml, mlRetireAdviceAccept, mlRetireAdviceContinue, mlRetireAdviceReduceRole, mlWrap, setMl, setSuperMode } = ctx;

  // ---- 引退勧告／契約更改 ----
  if (ml.screen === "mylife_retire_advice" && ml.player) {
    const r = ml.player;
    const info = ml.adviceInfo || { age: r.age, ovr: overall(r), joinOvr: r.joinOvr, declining: false, reducedRole: false };
    const decl = info.declining;
    return mlWrap(
      <Screen>
        <div style={{ marginBottom: T.space.lg }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{decl ? "チームからの引退勧告" : "契約更改"}</div>
          <div style={{ fontSize: T.size.title, marginTop: T.space.xs }}>{info.age}歳・{decl ? "進退を決める" : "進退はあなた次第"}</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>{decl ? "全盛期の力に陰りが見える" : "まだやれる脚だ"}</div>
        </div>
        <div style={{ background: T.color.surface, padding: T.space.md, marginBottom: T.space.md }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.xs }}>監督</div>
          <div style={{ fontSize: T.size.body, lineHeight: 1.8 }}>
            {decl
              ? `「${r.name}、今季もよく走ってくれた。だが正直、往年の走りには戻れていない。そろそろ身の振り方を考える時期かもしれない。もう一年やるか、役割を落として続けるか、それとも——決めるのは君だ」`
              : `「${r.name}、来季の契約をどうする？まだやれる脚だ。もう一年勝負するもよし、役割を落として長く続けるもよし。引き際もまた、君自身が決めることだ」`}
          </div>
        </div>
        <Section title="いまの力">
          <Item first label="総合力" value={info.ovr} />
          <Item label="全盛期" value={info.joinOvr} />
        </Section>
        <PrimaryBtn onClick={mlRetireAdviceContinue}>現役を続ける</PrimaryBtn>
        {!info.reducedRole && (
          <>
            <QuietBtn onClick={mlRetireAdviceReduceRole}>役割を縮小して続ける</QuietBtn>
            <div style={{ fontSize: T.size.caption, color: T.color.sub, margin: `-${T.space.xs}px 0 ${T.space.md}px` }}>レースの負荷が15%下がり、選手寿命が延びます</div>
          </>
        )}
        <QuietBtn color={T.color.bad} onClick={() => askConfirm(`${r.age}歳で引退しますか？この操作は取り消せません。`, mlRetireAdviceAccept, "引退する")}>今季限りで引退する</QuietBtn>
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

    return mlWrap(
      <Screen>
        <div style={{ background: T.color.surface, padding: T.space.lg, marginBottom: T.space.md, textAlign: "center" }}>
          <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{ml.year}年目・{r.age}歳で引退</div>
          <div style={{ fontSize: T.size.title, margin: `${T.space.sm}px 0 0` }}>{r.name}</div>
          <div style={{ marginTop: T.space.lg, paddingTop: T.space.md, borderTop: `1px solid ${T.color.rule}` }}>
            <div style={{ fontSize: T.size.caption, color: T.color.sub }}>この選手の生き様</div>
            <div style={{ fontSize: T.size.head, color: T.color.accent, marginTop: T.space.xs }}>{arch.title}</div>
            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm, lineHeight: 1.7 }}>{arch.desc}</div>
          </div>
        </div>

        {ml.lastRaceResult && (
          <>
            <Section title="ラストレース">
              <div style={{ padding: `${T.space.sm}px 0` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
                  <span>{ml.lastRaceResult.name}</span>
                  <span style={{ color: T.color.sub }}>{ml.lastRaceResult.rank}位 / {ml.lastRaceResult.total}人中</span>
                </div>
                <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs, lineHeight: 1.7 }}>{ml.lastRaceResult.flavor}</div>
              </div>
            </Section>
          </>
        )}

        <Section title="歩んだ道のり">
          <Item first label="到達クラス" value={`${CLASSES[0].label} → ${CLASSES[ml.classIdx]?.label || CLASSES[0].label}`} valueColor={T.color.accent} />
          <Item label="出走" value={`${races.length}戦`} />
          <Item label="優勝" value={`${wins}勝`} valueColor={T.color.accent} />
          <Item label="表彰台" value={`${podiums}回`} />
          {maxOvrEntry && <Item label="最高総合力" value={maxOvrEntry.ovr} detail={`${maxOvrEntry.year}年目に到達`} />}
          {bestRankEntry && <Item label="最高世界ランク" value={`${bestRankEntry.worldRank}位`} detail={`${bestRankEntry.year}年目に到達`} />}
        </Section>

        <Section title="成し遂げたこと" right={`${achieved.length} / ${ML_ACHIEVEMENTS.length}`}>
          {achieved.map((a, i) => <Item key={a.id} first={i === 0} label={a.label} value="" />)}
          {achieved.length === 0 && <Item first label="—" value="" detail="心に残る一勝は無かったが、走り続けた日々そのものが記録だ。" />}
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
          <Section title="自伝">
            <Prose>「{ml.autobiographyText}」</Prose>
          </Section>
        ) : (
          <>
            <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>自伝を出版する</div>
            <div style={{ fontSize: T.size.caption, color: T.color.sub, margin: `-${T.space.xs}px 0 ${T.space.sm}px` }}>座右の言葉が殿堂の記録に残ります</div>
            {mlAutobiographyOptions(ml).map((o, i) => (
              <QuietBtn key={i} onClick={() => { mlSetAutobiography(o.quote); setMl(s => ({ ...s, autobiographyText: o.quote })); }}>{o.title}</QuietBtn>
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
                <span>{p.label}</span><span>+{p.cp}</span>
              </div>
            ))}
          </Section>
        )}

        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>これから</div>
        <PrimaryBtn onClick={becomeManager}>監督として新チームを率いる</PrimaryBtn>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, margin: `-${T.space.xs}px 0 ${T.space.md}px` }}>{r.name}を創設メンバーに迎え、同じ世界でチームを率います</div>
        <QuietBtn onClick={() => { clearMyLifeSave(); setMl(initMyLife()); }}>新たな選手でキャリアを始める</QuietBtn>
        <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_legends" }))}>歴代選手の殿堂を見る</QuietBtn>
      </Screen>
    );
  }

  // ---- チーム名鑑 ----
  if (ml.screen === "mylife_teamroster" && ml.player) {
    const mates = ml.teammates || [];
    return mlWrap(
      <Screen>
        <div style={{ marginBottom: T.space.lg }}>
          <div style={{ fontSize: T.size.title }}>{ml.team}</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>移籍すると顔ぶれが変わります</div>
        </div>
        <Section title="あなた">
          <div style={{ padding: `${T.space.sm}px 0` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
              <span style={{ color: T.color.accent }}>{ml.player.name} <span style={{ fontSize: T.size.caption, color: T.color.sub }}>(あなた)</span></span>
              <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{TYPES[ml.player.type]?.label}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>
              <span>総合力</span><span style={{ fontSize: T.size.body, color: T.color.accent }}>{overall(ml.player)}</span>
            </div>
          </div>
        </Section>
        <Section title={`チームメイト ${mates.length}名`}>
          {mates.length === 0 && <Item first label="—" value="" detail="チームメイトの記録がありません。" />}
          {mates.map((tm, i) => {
            const per = PERSONALITIES[tm.personality];
            const abilLabels = (tm.abilities || []).map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・");
            return (
              <div key={i} style={{ padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
                  <span>{tm.name}</span>
                  <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{TYPES[tm.type]?.label}</span>
                </div>
                {per && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>性格 {per.label}（{per.desc}）</div>}
                {abilLabels && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: 2 }}>{abilLabels}</div>}
                {(tm.winsForMe || 0) > 0 && <div style={{ fontSize: T.size.caption, color: T.color.good, marginTop: 2 }}>あなたのアシストとして {tm.winsForMe} 勝を支えた</div>}
              </div>
            );
          })}
        </Section>
        <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_world" }))}>世界の画面に戻る</QuietBtn>
      </Screen>
    );
  }

  // ---- キャリアグラフ ----
  if (ml.screen === "mylife_graph" && ml.player) {
    const hist = [...(ml.careerHistory || []), { year: ml.year, ovr: overall(ml.player), worldRank: ml.worldRank }];
    const W = 340, H = 170, padL = 26, padR = 30, padT = 16, padB = 24;
    const years = hist.map(h => h.year);
    const minY = Math.min(...years), maxY = Math.max(...years);
    const xAt = (yr) => maxY === minY ? W / 2 : padL + (yr - minY) / (maxY - minY) * (W - padL - padR);
    const ovrs = hist.map(h => h.ovr || 0);
    const oMin = Math.min(...ovrs) - 3, oMax = Math.max(...ovrs) + 3;
    const yOvr = (v) => H - padB - ((v - oMin) / Math.max(1, oMax - oMin)) * (H - padT - padB);
    const rankPts = hist.filter(h => h.worldRank != null);
    const ranks = rankPts.map(h => h.worldRank);
    const rMin = ranks.length ? Math.min(...ranks) : 1, rMax = ranks.length ? Math.max(...ranks) : 100;
    const yRank = (v) => padT + ((v - rMin) / Math.max(1, rMax - rMin)) * (H - padT - padB);
    const ovrPath = hist.map((h, i) => `${i === 0 ? "M" : "L"}${xAt(h.year).toFixed(1)},${yOvr(h.ovr || 0).toFixed(1)}`).join(" ");
    const rankPath = rankPts.map((h, i) => `${i === 0 ? "M" : "L"}${xAt(h.year).toFixed(1)},${yRank(h.worldRank).toFixed(1)}`).join(" ");
    const maxOvrIdx = ovrs.indexOf(Math.max(...ovrs));
    const labelIdxs = [...new Set([0, hist.length - 1, maxOvrIdx])];

    const tl = mlCareerTimeline(ml);

    return mlWrap(
      <Screen>
        <div style={{ marginBottom: T.space.lg }}>
          <div style={{ fontSize: T.size.title }}>キャリアの推移</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>年ごとの総合力と世界ランクの移り変わり</div>
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
              return <text key={`ovl${i}`} x={xAt(h.year)} y={po - 6} fontSize="9" fill={T.color.accent} textAnchor="middle">{h.ovr || 0}</text>;
            })}
            {labelIdxs.map(i => {
              const h = hist[i];
              if (h.worldRank == null) return null;
              const po = yOvr(h.ovr || 0), pr = yRank(h.worldRank);
              const ly = Math.abs(pr - po) < 18 ? Math.max(pr, po) + 14 : pr + 13;
              return <text key={`rkl${i}`} x={xAt(h.year)} y={ly} fontSize="9" fill={T.color.sub} textAnchor="middle">{h.worldRank}位</text>;
            })}
          </svg>
          <div style={{ display: "flex", gap: T.space.lg, justifyContent: "center", fontSize: T.size.caption, marginTop: T.space.xs }}>
            <span style={{ color: T.color.accent }}>— 総合力</span>
            <span style={{ color: T.color.sub }}>┈ 世界ランク（上ほど上位）</span>
          </div>
        </div>
        {hist.length <= 1 && <div style={{ fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.md }}>年度を進めるとグラフが伸びていきます。</div>}
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
  if (ml.screen === "mylife_ranking" && ml.player) {
    const board = mlWorldBoard(ml);
    const tier = worldRankTier(ml.worldRank);
    const worldNews = ml.worldNews || [];
    const Row = (e) => {
      const tag = e.isPlayer ? "あなた" : e.isRival ? "ライバル" : e.isRival2 ? "好敵手" : null;
      return (
        <div key={e.rank} style={{ padding: `${T.space.sm}px 0`, borderTop: `1px solid ${T.color.rule}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: T.space.sm, fontSize: T.size.body }}>
            <span style={{ width: 22, flex: "none", textAlign: "right", color: e.isPlayer ? T.color.accent : T.color.sub }}>{e.rank}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: e.isPlayer ? T.color.accent : T.color.text }}>
              {e.name}{tag && <span style={{ fontSize: T.size.caption, color: T.color.sub }}> ({tag})</span>}
            </span>
            <span style={{ flex: "none", width: 64, textAlign: "right", fontSize: T.size.caption, color: T.color.sub }}>{e.star ? `通算${e.star.wins}勝` : ""}</span>
            <span style={{ flex: "none", width: 48, textAlign: "right", color: T.color.sub }}>{e.pts}</span>
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
  if (ml.screen === "mylife_lineage") {
    const forest = mlLineageForest();
    const totalLeg = loadMlLegends().length;
    return mlWrap(
      <LineageForestView forest={forest} totalLeg={totalLeg} variant="mylife"
        footer={<QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_legends" }))}>← 殿堂に戻る</QuietBtn>} />
    );
  }
  if (ml.screen === "mylife_factors") {
    const cats = mlFactorCollection();
    const totalLeg = loadMlLegends().length;
    return mlWrap(
      <FactorCollectionView cats={cats} totalLeg={totalLeg} variant="mylife"
        footer={<QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_legends" }))}>← 殿堂に戻る</QuietBtn>} />
    );
  }

  // ---- 殿堂 ----
  if (ml.screen === "mylife_legends") {
    const allLegends = loadMlLegends();
    const legends = [...allLegends].reverse();
    const bloodMap = buildBloodMap(allLegends);
    return mlWrap(
      <Screen>
        <div style={{ marginBottom: T.space.lg }}>
          <div style={{ fontSize: T.size.title }}>殿堂</div>
          <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs, lineHeight: 1.7 }}>
            これまでに引退した{legends.length}名の記録です。1人を師匠に選べば教え子として、2人を親に選べば「配合」でその血を引く子として、次のキャリアに迎えられます。
          </div>
        </div>

        <div style={{ display: "flex", gap: T.space.sm, marginBottom: T.space.md }}>
          <div style={{ flex: 1 }}><QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_lineage" }))}>系譜ツリー</QuietBtn></div>
          <div style={{ flex: 1 }}><QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_factors" }))}>因子図鑑</QuietBtn></div>
        </div>

        <div onClick={() => setMl(s => ({ ...s, showNicks: !s.showNicks }))}
          style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.caption, color: T.color.sub, marginBottom: T.space.sm }}>
          <span>配合の相性表</span><span style={{ color: T.color.accent }}>{ml.showNicks ? "閉じる ▴" : "開く ▾"}</span>
        </div>
        {ml.showNicks && (
          <Section title="配合の相性表">
            {breedNickTableRows().map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: T.space.sm, fontSize: T.size.caption, padding: `${T.space.sm}px 0`, borderTop: i === 0 ? "none" : `1px solid ${T.color.rule}` }}>
                <span style={{ width: 18, color: r.rank === "◎" ? T.color.accent : T.color.text }}>{r.rank}</span>
                <span style={{ width: 110, color: T.color.text }}>{TYPES[r.pair[0]]?.label || r.pair[0]}×{TYPES[r.pair[1]]?.label || r.pair[1]}</span>
                <span style={{ color: T.color.sub, flex: 1 }}>{r.label}{r.ability && ABILITIES[r.ability] ? `（${ABILITIES[r.ability].label}）` : ""}</span>
              </div>
            ))}
          </Section>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: T.size.body }}>
                <span>{leg.name} <span style={{ fontSize: T.size.caption, color: T.color.sub }}>{TYPES[leg.type]?.label}</span></span>
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
                      return <Item label="好敵手" value={`${ht.label} ${leg.rivalName}に${leg.rivalRecord?.wins || 0}勝${leg.rivalRecord?.losses || 0}敗`} />;
                    })()}
                    {leg.protege && (() => {
                      const pr = protegeState(leg.protege, leg.endYear);
                      return <Item label="弟子" value={`${leg.protege.name}（${TYPES[leg.protege.type]?.label}）を総合力${pr.ovr}まで育てた`} />;
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
        <QuietBtn onClick={() => setMl(s => ({ ...s, screen: "mylife_create" }))}>← 戻る</QuietBtn>
      </Screen>
    );
  }
}
