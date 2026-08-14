// mylife.jsx より分割（Step8）：引退・引き継ぎ以降（retire_advice/retired/teamroster/graph/ranking/lineage/factors/legends）
import React from "react";
import { legendBloodId, loadBloodlines, loadMlLegends, mlBloodlineTier, saveMlLegends } from "../../breeding/breeding.js";
import { PersonaLine } from "../../components/panels.jsx";
import { Btn, Eyebrow } from "../../components/ui.jsx";
import { LineageForestView, FactorCollectionView } from "../../components/dynasty.jsx";
import { overall } from "../../core/core.js";
import { ABILITIES, TYPES } from "../../data/abilities.js";
import { MONTHS } from "../../data/course.js";
import { C, FONT_D, FONT_M } from "../../data/theme.js";
import { mlFactorCollection, mlLineageForest, bloodIdToName, breedNickTableRows, buildBloodMap, clearMyLifeSave, mlAutobiographyOptions, mlEpilogueAway, mlEpilogueDirector, mlSetAutobiography, mlSetEpilogue, mlCareerTimeline, mlWorldBoard, protegeState, rivalHeatTier, worldRankTier } from "../../logic/support.js";
import { initMyLife, mlCareerArchetype, riderCareerSummary, riderNickname } from "../../state/state.js";

export function renderMyLifeCareerScreens(ctx) {
  const { askConfirm, becomeManager, ml, mlRetireAdviceAccept, mlRetireAdviceContinue, mlRetireAdviceReduceRole, mlWrap, setMl, setSuperMode } = ctx;
    if (ml.screen === "mylife_retire_advice" && ml.player) {
      const r = ml.player;
      const info = ml.adviceInfo || { age: r.age, ovr: overall(r), joinOvr: r.joinOvr, declining: false, reducedRole: false };
      // v35: 衰え期なら「引退勧告」、まだ戦えるなら「契約更改」トーン。どちらでも現役続行/縮小/引退を選べる。
      const decl = info.declining;
      const accent = decl ? C.red : C.blue;
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${accent}`, textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>📋</div>
            <h2 style={{ fontFamily: FONT_D, color: accent, fontSize: 20, margin: "6px 0" }}>{decl ? "チームからの引退勧告" : `契約更改（${info.age}歳）`}</h2>
            <div style={{ fontSize: 12, color: C.sub }}>{decl ? `${info.age}歳・全盛期の力に陰りが見える` : `${info.age}歳・進退はあなたが決める`}</div>
          </div>
          <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.8, background: C.panel2, borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${accent}` }}>
            {decl
              ? `監督「${r.name}、今季もよく走ってくれた。だが正直、往年の走りには戻れていない（OVR ${info.ovr}／全盛期基準${info.joinOvr}）。そろそろ身の振り方を考える時期かもしれない。もう一年やるか、役割を落として続けるか、それとも——決めるのは君だ」`
              : `監督「${r.name}、来季の契約をどうする？（OVR ${info.ovr}）まだやれる脚だ。もう一年勝負するもよし、役割を落として長く続けるもよし。引き際もまた、君自身が決めることだ」`}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <Btn color={C.sub} outline onClick={mlRetireAdviceContinue}>💪 現役を続ける（今まで通り）</Btn>
            {!info.reducedRole && <Btn color={C.blue} outline onClick={mlRetireAdviceReduceRole}>🤝 役割を縮小して続ける（レース負荷-15%・延命）</Btn>}
            <Btn color={C.red} outline onClick={() => askConfirm(`${r.age}歳で引退しますか？この操作は取り消せません。`, mlRetireAdviceAccept)}>🏁 今季限りで引退する</Btn>
          </div>
        </div>
      );
    }
    if (ml.screen === "mylife_retired" && ml.player) {
      const r = ml.player;
      const wins = (r.raceLog || []).filter(e => e.rank === 1).length;
      const podiums = (r.raceLog || []).filter(e => e.rank <= 3).length;
      const arch = mlCareerArchetype(ml);
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 18, borderTop: `4px solid ${C.yellow}`, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🏁</div>
            <h2 style={{ fontFamily: FONT_D, color: C.yellow, fontSize: 22, margin: "8px 0" }}>{r.name} 引退</h2>
            {riderNickname(r) && <div style={{ fontSize: 13, color: C.purple, fontStyle: "italic" }}>「{riderNickname(r)}」</div>}
            {/* v31.4: キャリアの生き様（称号）。どんな伝説だったかを引退セレモニーで称える */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 10.5, color: C.sub }}>この選手の生き様</div>
              <div style={{ fontFamily: FONT_D, fontSize: 19, fontWeight: 700, color: arch.color, margin: "3px 0" }}>― {arch.title} ―</div>
              <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.6 }}>{arch.desc}</div>
            </div>
          </div>
          {/* v37: このキャリアで獲得した生涯クリアポイント（メタ進行＝次の新人が有利に） */}
          {ml.awardedCP && ml.awardedCP.total > 0 && (
            <div style={{ background: "linear-gradient(180deg, rgba(255,210,63,0.10), #201e26)", borderRadius: 10, border: `1px solid ${C.yellow}`, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 11, color: C.yellow, fontWeight: 700 }}>🎖 生涯クリアポイント獲得</span>
                <span style={{ fontFamily: FONT_M, fontSize: 18, color: C.yellow, fontWeight: 800 }}>+{ml.awardedCP.total}pt</span>
              </div>
              <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>
                {ml.awardedCP.parts.map((p, i) => `${p.label} +${p.cp}`).join("　")}
              </div>
              <div style={{ fontSize: 10, color: C.sub, marginTop: 3 }}>次にデビューする新人の強化に使われます。</div>
            </div>
          )}
          {/* v35(逆メンター): 弟子への継承。育てた若手が後を継ぐ物語の締めくくり */}
          {ml.protege && (() => {
            const pr = protegeState(ml.protege, ml.year);
            const t = TYPES[ml.protege.type];
            return (
              <div style={{ background: "linear-gradient(180deg, rgba(53,192,126,0.08), transparent)", borderRadius: 10, border: `1px solid ${C.green}`, padding: "12px 14px" }}>
                <Eyebrow color={C.green}>🎓 受け継がれる意志</Eyebrow>
                <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.7, marginTop: 4 }}>
                  あなたが指導した弟子 <b style={{ color: C.text }}>{ml.protege.name}</b>（{t.label}・{pr.age}歳）は、
                  いまや <span style={{ fontFamily: FONT_M, color: C.yellow }}>OVR {pr.ovr}</span> の
                  {pr.ovr >= 88 ? "堂々たるエース" : pr.ovr >= 78 ? "頼れる一線級" : "成長著しい若手"}へと育った。
                  {pr.ovr >= 82 ? "あなたの背中は、確かに次の世代へ受け継がれた。" : "その走りには、あなたの教えが宿っている。"}
                </div>
              </div>
            );
          })()}
          {ml.lastRaceResult && (
            <div style={{ background: "rgba(232,161,60,0.1)", borderRadius: 10, padding: "10px 12px", border: `1.5px solid #e8a13c` }}>
              <Eyebrow color={"#e8a13c"}>🏁 ラストレース — {ml.lastRaceResult.name}</Eyebrow>
              <div style={{ fontFamily: FONT_D, fontSize: 17, color: C.text, fontWeight: 700, margin: "4px 0" }}>{ml.lastRaceResult.rank}位 / {ml.lastRaceResult.total}人中</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{ml.lastRaceResult.flavor}</div>
            </div>
          )}
          <div style={{ fontSize: 11.5, color: C.text, padding: "8px 10px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.purple}`, lineHeight: 1.6 }}>
            {riderCareerSummary({ ...r, farewellYear: ml.year, farewellReason: "retired" })}
          </div>
          <div style={{ fontSize: 11.5, color: C.sub }}>通算{(r.raceLog || []).length}戦・{wins}勝・表彰台{podiums}回</div>
          {/* v35(演出強化): キャリアの名場面。勝利・モニュメント・大舞台を時系列で振り返る集大成 */}
          {(() => {
            const tl = mlCareerTimeline(ml).slice(0, 10);
            if (tl.length === 0) return null;
            return (
              <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
                <Eyebrow color={C.yellow}>🏅 キャリアの名場面</Eyebrow>
                <div style={{ display: "grid", gap: 0, marginTop: 5 }}>
                  {tl.map((e, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "4px 0", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                      <span style={{ fontSize: 10, color: C.sub, fontFamily: FONT_M, width: 46, flexShrink: 0 }}>{e.year}年目</span>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{e.icon}</span>
                      <span style={{ fontSize: 11.5, color: e.color, lineHeight: 1.4 }}>{e.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* v35(演出強化): 因縁の総括。育った因縁度（呼称）でライバルとの物語を締める */}
          {ml.rival && (() => {
            const ht = rivalHeatTier(ml.rivalRecord?.heat ?? ml.rivalRecord?.meetings ?? 0);
            const rec = ml.rivalRecord || {}; const m = rec.meetings || 0;
            const tail = m === 0 ? "ついに本気で相まみえる機会は訪れなかったが、その存在は常に道標だった。"
              : ht.key >= 3 ? "幾度となく死力を尽くして競り合った、生涯忘れえぬ宿命の相手だった。"
              : ht.key >= 2 ? "何度も牙を剥き合い、互いを限界まで高め合った宿敵だった。"
              : ht.key >= 1 ? "しのぎを削り合った、忘れがたきライバルだった。" : "良き好敵手として、互いの走りを認め合った。";
            return (
              <div style={{ fontSize: 11.5, color: C.text, padding: "9px 11px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${ht.color}`, lineHeight: 1.7 }}>
                🔥 <span style={{ color: ht.color, fontWeight: 700 }}>{ht.label}</span>・{ml.rival.name}（{ml.rival.team}）— 通算{m}戦 {rec.wins || 0}勝{rec.losses || 0}敗。{tail}
              </div>
            );
          })()}
          {ml.rival2 && (ml.rivalRecord2?.meetings || 0) > 0 && (() => {
            const ht2 = rivalHeatTier(ml.rivalRecord2?.heat ?? ml.rivalRecord2?.meetings ?? 0);
            const rec = ml.rivalRecord2 || {};
            return (
              <div style={{ fontSize: 11.5, color: C.text, padding: "9px 11px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${ht2.color}`, lineHeight: 1.7 }}>
                🔥 <span style={{ color: ht2.color, fontWeight: 700 }}>{ht2.label}</span>（好敵手）・{ml.rival2.name}（{ml.rival2.team}）— 通算{rec.meetings || 0}戦 {rec.wins || 0}勝{rec.losses || 0}敗。
              </div>
            );
          })()}
          {/* v26: 引退後キャリア（エピローグ）。監督転身／完全引退を選ぶと殿堂記録に後日談が加わる */}
          {ml.epilogueText ? (
            <div style={{ fontSize: 11.5, color: C.text, padding: "8px 10px", background: C.panel2, borderRadius: 6, borderLeft: `3px solid ${C.yellow}`, lineHeight: 1.7 }}>
              {ml.epilogueText}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 11.5, color: C.sub }}>引退後の道を選ぶと、殿堂の記録に後日談が加わります。</div>
              <Btn small outline color={C.yellow} onClick={() => { const t = mlEpilogueDirector(ml); mlSetEpilogue(t); setMl(s => ({ ...s, epilogueText: t })); }}>🎓 監督としてチームに残る</Btn>
              <Btn small outline color={C.sub} onClick={() => { const t = mlEpilogueAway(ml); mlSetEpilogue(t); setMl(s => ({ ...s, epilogueText: t })); }}>🚶 競技から静かに離れる</Btn>
            </div>
          )}
          {/* v28: 自伝・レジェンドインタビュー。座右の言葉を選んで出版すると殿堂記録に名言が残る */}
          {ml.autobiographyText ? (
            <div style={{ fontSize: 12, color: C.text, padding: "10px 12px", background: "rgba(201,139,240,0.1)", borderRadius: 8, border: `1px solid ${C.purple}`, lineHeight: 1.7 }}>
              📖 自伝を出版した。<span style={{ color: C.purple, fontStyle: "italic" }}>「{ml.autobiographyText}」</span>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <Eyebrow color={C.purple}>📖 自伝を出版する — 座右の言葉を残す</Eyebrow>
              {mlAutobiographyOptions(ml).map((o, i) => (
                <Btn key={i} small outline color={C.purple} onClick={() => { mlSetAutobiography(o.quote); setMl(s => ({ ...s, autobiographyText: o.quote })); }}>{o.title}</Btn>
              ))}
            </div>
          )}
          {/* v38(#9 A-4): 選手→監督の転身ブリッジ。引退した英雄を招聘して、同じ世界でチーム運営へ
              地続きに進む＝「選手として走る→引退→監督として率いる」が1本の物語になる。 */}
          <div style={{ background: "linear-gradient(180deg,#233026,#1d2a22)", borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.green}` }}>
            <Eyebrow color={C.green}>🏢 監督として、第二のキャリアへ</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, margin: "4px 0 8px", lineHeight: 1.6 }}>現役を退いた{ml.player.name}を創設メンバーに迎え、同じ世界でチームを率います。</div>
            <Btn small color={C.green} onClick={becomeManager}>🏢 監督として新チームを率いる（{ml.player.name}を招聘）</Btn>
          </div>
          <Btn onClick={() => { clearMyLifeSave(); setMl(initMyLife()); }}>新たな選手でキャリアを始める</Btn>
          <Btn outline color={C.purple} onClick={() => setMl(s => ({ ...s, screen: "mylife_legends" }))}>🏛 歴代選手の殿堂を見る</Btn>
          <Btn outline color={C.sub} onClick={() => setSuperMode(null)}>← モード選択に戻る</Btn>
        </div>
      );
    }

    // v32: チーム名鑑（固定チームメイトの確認画面）
    if (ml.screen === "mylife_teamroster" && ml.player) {
      const mates = ml.teammates || [];
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.green}` }}>
            <Eyebrow color={C.green}>👥 チーム名鑑 — {ml.team}</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>あなたと同じチームを走る固定メンバーです。移籍すると顔ぶれが変わります。</div>
          </div>
          <div style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.yellow}` }}>
            <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.yellow }}>★ {ml.player.name}（あなた）<span style={{ fontSize: 10.5, color: TYPES[ml.player.type]?.color, marginLeft: 6 }}>{TYPES[ml.player.type]?.label}</span><span style={{ fontFamily: FONT_M, fontSize: 11, color: C.sub, marginLeft: 8 }}>OVR {overall(ml.player)}</span></div>
          </div>
          {mates.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>チームメイトの記録がありません。</div>}
          {mates.map((tm, i) => (
            <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "9px 12px", border: `1px solid ${C.line}` }}>
              <div style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text }}>{tm.name}<span style={{ fontSize: 10.5, color: TYPES[tm.type]?.color, marginLeft: 6 }}>{TYPES[tm.type]?.label}</span></div>
              <PersonaLine p={tm.personality} />
              {tm.abilities && tm.abilities.length > 0 && <div style={{ fontSize: 10.5, color: C.purple, marginTop: 2 }}>{tm.abilities.map(id => ABILITIES[id] ? ABILITIES[id].label : id).join("・")}</div>}
              {(tm.winsForMe || 0) > 0 && <div style={{ fontSize: 10.5, color: C.green, marginTop: 2 }}>あなたのアシストとして {tm.winsForMe} 勝を支えた</div>}
            </div>
          ))}
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }
    // v32: キャリアグラフ（OVR・世界ランクの推移）
    if (ml.screen === "mylife_graph" && ml.player) {
      const hist = [...(ml.careerHistory || []), { year: ml.year, ovr: overall(ml.player), worldRank: ml.worldRank, wins: ml.careerWins || 0, podiums: ml.careerPodiums || 0 }];
      const W = 320, H = 160, padL = 24, padR = 24, padT = 14, padB = 22;
      const years = hist.map(h => h.year);
      const minY = Math.min(...years), maxY = Math.max(...years);
      const xAt = (yr) => maxY === minY ? W / 2 : padL + (yr - minY) / (maxY - minY) * (W - padL - padR);
      const ovrs = hist.map(h => h.ovr || 0);
      const ovrVMin = Math.min(...ovrs), ovrVMax = Math.max(...ovrs);
      const ovrMin = ovrVMin - 3, ovrMax = ovrVMax + 3;
      const yOvr = (v) => H - padB - ((v - ovrMin) / Math.max(1, ovrMax - ovrMin)) * (H - padT - padB);
      const rankPts = hist.filter(h => h.worldRank != null);
      const ranks = rankPts.map(h => h.worldRank);
      const rMin = ranks.length ? Math.min(...ranks) : 1, rMax = ranks.length ? Math.max(...ranks) : 100;
      const yRank = (v) => padT + ((v - rMin) / Math.max(1, rMax - rMin)) * (H - padT - padB);
      const ovrPath = hist.map((h, i) => `${i === 0 ? "M" : "L"}${xAt(h.year).toFixed(1)},${yOvr(h.ovr || 0).toFixed(1)}`).join(" ");
      const rankPath = rankPts.map((h, i) => `${i === 0 ? "M" : "L"}${xAt(h.year).toFixed(1)},${yRank(h.worldRank).toFixed(1)}`).join(" ");
      // v36: 折れ線に代表点の数値ラベル（初年・最新年・OVR最高年）と軸目盛りを追加
      const maxOvrIdx = ovrs.indexOf(ovrVMax);
      const labelIdxs = [...new Set([0, hist.length - 1, maxOvrIdx])];
      // OVRラベルは点の上・世界ランクラベルは点の下を既定にし、同じ年で両方表示されても
      // 重ならないようにする（キャリア序盤はOVR安値と世界ランク下位が同時に来やすく、
      // どちらも「近い側」を選ぶ素朴なロジックだと点の同じ側に重なっていた）
      const ovrLabelY = (py) => (py < padT + 10 ? py + 12 : py - 6);
      const rankLabelY = (py) => (py > H - padB - 10 ? py - 6 : py + 12);
      // 軸目盛りは、既に代表点ラベルで同じ数値が表示済みなら重複表示しない（初年が最安値、
      // 最高OVR年が必ずlabelIdxsに含まれる、等の理由で軸端の値と点ラベルが一致しやすいため）
      const ovrLabeledVals = new Set(labelIdxs.map(i => hist[i].ovr || 0));
      const rankLabeledVals = new Set(labelIdxs.filter(i => hist[i].worldRank != null).map(i => hist[i].worldRank));
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.blue}` }}>
            <Eyebrow color={C.blue}>📈 キャリアグラフ</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>年ごとのOVRと世界ランクの推移。</div>
          </div>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 6px", border: `1px solid ${C.line}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
              <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={C.line} />
              <path d={ovrPath} fill="none" stroke={C.yellow} strokeWidth="2" />
              {hist.map((h, i) => <circle key={i} cx={xAt(h.year)} cy={yOvr(h.ovr || 0)} r="2.5" fill={C.yellow} />)}
              {rankPath && <path d={rankPath} fill="none" stroke={C.green} strokeWidth="2" strokeDasharray="3,2" />}
              {rankPts.map((h, i) => <circle key={`r${i}`} cx={xAt(h.year)} cy={yRank(h.worldRank)} r="2.5" fill={C.green} />)}
              {hist.map((h, i) => <text key={`t${i}`} x={xAt(h.year)} y={H - 6} fontSize="8" fill={C.sub} textAnchor="middle">{h.year}</text>)}
              {labelIdxs.map(i => {
                const h = hist[i];
                const py = yOvr(h.ovr || 0);
                return <text key={`ovl${i}`} x={xAt(h.year)} y={ovrLabelY(py)} fontSize="8" fill={C.yellow} fontWeight="700" textAnchor="middle">{h.ovr || 0}</text>;
              })}
              {labelIdxs.map(i => {
                const h = hist[i];
                if (h.worldRank == null) return null;
                const py = yRank(h.worldRank);
                return <text key={`rkl${i}`} x={xAt(h.year)} y={rankLabelY(py)} fontSize="8" fill={C.green} fontWeight="700" textAnchor="middle">{h.worldRank}位</text>;
              })}
              {!ovrLabeledVals.has(ovrVMax) && <text x={2} y={yOvr(ovrVMax) + 3} fontSize="7" fill={C.sub}>{ovrVMax}</text>}
              {ovrVMax !== ovrVMin && !ovrLabeledVals.has(ovrVMin) && <text x={2} y={yOvr(ovrVMin) + 3} fontSize="7" fill={C.sub}>{ovrVMin}</text>}
              {ranks.length > 0 && !rankLabeledVals.has(rMin) && <text x={W - 2} y={yRank(rMin) + 3} fontSize="7" fill={C.sub} textAnchor="end">{rMin}位</text>}
              {ranks.length > 0 && rMax !== rMin && !rankLabeledVals.has(rMax) && <text x={W - 2} y={yRank(rMax) + 3} fontSize="7" fill={C.sub} textAnchor="end">{rMax}位</text>}
            </svg>
            <div style={{ fontSize: 10.5, color: C.sub, display: "flex", gap: 14, justifyContent: "center", marginTop: 2 }}>
              <span style={{ color: C.yellow }}>― OVR</span><span style={{ color: C.green }}>┈ 世界ランク（上ほど上位）</span>
            </div>
          </div>
          {hist.length <= 1 && <div style={{ fontSize: 11, color: C.sub }}>年度を進めるとグラフが伸びていきます。</div>}
          {/* v35(UI): キャリアの軌跡（年表）。raceLogから語る価値のある一戦を時系列で */}
          {(() => {
            const tl = mlCareerTimeline(ml);
            return (
              <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}` }}>
                <Eyebrow color={C.yellow}>🏅 キャリアの軌跡</Eyebrow>
                {tl.length === 0 ? (
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>まだ語るべき一戦はない。初勝利・初表彰台がここに刻まれていく。</div>
                ) : (
                  <div style={{ display: "grid", gap: 0, marginTop: 6 }}>
                    {tl.map((e, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "5px 0", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                        <span style={{ fontSize: 10, color: C.sub, fontFamily: FONT_M, width: 62, flexShrink: 0 }}>{e.year}年目{MONTHS[e.month] || ""}</span>
                        <span style={{ fontSize: 13, flexShrink: 0 }}>{e.icon}</span>
                        <span style={{ fontSize: 11.5, color: e.color, lineHeight: 1.4 }}>{e.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }
    // v31.5: 世界ランキング閲覧画面
    if (ml.screen === "mylife_ranking" && ml.player) {
      const board = mlWorldBoard(ml);
      const tier = worldRankTier(ml.worldRank);
      const Row = ({ e }) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6,
          background: e.isPlayer ? "rgba(255,210,63,0.14)" : e.isRival ? "rgba(224,80,80,0.1)" : e.isRival2 ? "rgba(79,143,232,0.1)" : "transparent",
          border: e.isPlayer ? `1px solid ${C.yellow}` : "1px solid transparent" }}>
          <span style={{ fontFamily: FONT_M, fontSize: 12, width: 34, textAlign: "right", color: e.rank <= 3 ? C.yellow : e.rank <= 10 ? C.green : C.sub, fontWeight: 700 }}>{e.rank}位</span>
          <span style={{ flex: 1, fontSize: 12, color: e.isPlayer ? C.yellow : C.text, fontWeight: e.isPlayer ? 700 : 400 }}>
            {e.name}{e.isPlayer ? " ●（あなた）" : e.isRival ? " 🔥ライバル" : e.isRival2 ? " 🔥好敵手" : ""}
            {e.star && <span style={{ fontSize: 10, color: C.sub }}>　通算{e.star.wins}勝</span>}
            {e.star && e.star.bloodOf && <span style={{ fontSize: 10, color: "#e8a13c", fontWeight: 700 }}>　🩸{e.star.bloodOf}</span>}
          </span>
          <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.sub }}>{e.pts}pt</span>
        </div>
      );
      const worldNews = ml.worldNews || [];
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "linear-gradient(180deg,#2a2740,#22202f)", borderRadius: 12, padding: 16, borderTop: `4px solid ${C.purple}` }}>
            <Eyebrow color={C.purple}>🌍 世界ランキング（{ml.year}年目）</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 20, color: tier.color, fontWeight: 700, margin: "6px 0 2px" }}>
              あなたは 世界{ml.worldRank == null ? "ランク外" : `${ml.worldRank}位`}
            </div>
            <div style={{ fontSize: 12, color: C.sub }}>{tier.label}／{Math.round(ml.worldPoints || 0)}pt{ml.worldRankBest != null ? `／自己最高 ${ml.worldRankBest}位` : ""}</div>
            <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4 }}>着順とグレードでポイントを獲得。基準点は年々上がります。</div>
          </div>
          {worldNews.length > 0 && (
            <div style={{ background: "linear-gradient(180deg,#20283a,#1b2230)", borderRadius: 10, padding: "8px 11px", border: `1px solid ${C.blue}` }}>
              <div style={{ fontSize: 11, color: C.blue, fontWeight: 700, marginBottom: 4 }}>📰 今年の世界の動き</div>
              <div style={{ display: "grid", gap: 3 }}>{worldNews.map((n, i) => <div key={i} style={{ fontSize: 11.5, color: C.text }}>{n}</div>)}</div>
            </div>
          )}
          <div style={{ background: C.panel, borderRadius: 10, padding: "8px 10px", border: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginBottom: 4 }}>🏆 世界トップ10</div>
            <div style={{ display: "grid", gap: 2 }}>{board.top.map((e, i) => <Row key={i} e={e} />)}</div>
          </div>
          {board.around.length > 0 && (
            <div style={{ background: C.panel, borderRadius: 10, padding: "8px 10px", border: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginBottom: 4 }}>📍 あなたの周辺</div>
              <div style={{ display: "grid", gap: 2 }}>{board.around.map((e, i) => <Row key={i} e={e} />)}</div>
            </div>
          )}
          {(board.rivalRank != null || board.rival2Rank != null) && (
            <div style={{ fontSize: 11, color: C.sub }}>
              {board.rivalRank != null && ml.rival && <div>🔥 ライバル {ml.rival.name}：世界{board.rivalRank}位</div>}
              {board.rival2Rank != null && ml.rival2 && <div>🔥 好敵手 {ml.rival2.name}：世界{board.rival2Rank}位</div>}
            </div>
          )}
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_main" }))}>← 選手画面に戻る</Btn>
        </div>
      );
    }

    if (ml.screen === "mylife_lineage") {
      const forest = mlLineageForest();
      const totalLeg = loadMlLegends().length;
      return mlWrap(
        <LineageForestView forest={forest} totalLeg={totalLeg} variant="mylife"
          footer={<Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_legends" }))}>← 殿堂に戻る</Btn>} />
      );
    }
    if (ml.screen === "mylife_factors") {
      const cats = mlFactorCollection();
      const totalLeg = loadMlLegends().length;
      return mlWrap(
        <FactorCollectionView cats={cats} totalLeg={totalLeg} variant="mylife"
          footer={<Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_legends" }))}>← 殿堂に戻る</Btn>} />
      );
    }
    if (ml.screen === "mylife_legends") {
      const allLegends = loadMlLegends();
      const legends = [...allLegends].reverse();
      const bloodMap = buildBloodMap(allLegends);
      return mlWrap(
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 16, borderTop: `4px solid ${C.purple}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Eyebrow color={C.purple}>🏛 マイライフ殿堂</Eyebrow>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn small outline color={"#e56cc8"} onClick={() => setMl(s => ({ ...s, screen: "mylife_lineage" }))}>🌳 系譜ツリー</Btn>
                <Btn small outline color={"#e56cc8"} onClick={() => setMl(s => ({ ...s, screen: "mylife_factors" }))}>🧬 因子図鑑</Btn>
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>これまでのプレイで引退した歴代選手の記録です（{legends.length}名）。1人を師匠に選べば教え子として、2人を親に選べば「配合」でその血を引く子として、次のキャリアに迎えられます。</div>
          </div>
          {/* v31.1: 配合相性表（ニック）。どの脚質同士が好相性か一覧できる */}
          <div style={{ background: "linear-gradient(180deg,#2e2436,#241d2c)", borderRadius: 12, padding: "12px 14px", border: `1px solid #e56cc8` }}>
            <button onClick={() => setMl(s => ({ ...s, showNicks: !s.showNicks }))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", textAlign: "left" }}>
              <Eyebrow color={"#e56cc8"}>🧬 配合相性表（ニック）　{ml.showNicks ? "▲" : "▼"}</Eyebrow>
            </button>
            {ml.showNicks && (
              <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                {breedNickTableRows().map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                    <span style={{ fontFamily: FONT_M, fontWeight: 700, width: 18, color: r.rank === "◎" ? C.yellow : r.rank === "○" ? C.green : C.sub }}>{r.rank}</span>
                    <span style={{ width: 96, color: C.text }}>{TYPES[r.pair[0]]?.label || r.pair[0]}×{TYPES[r.pair[1]]?.label || r.pair[1]}</span>
                    <span style={{ color: C.sub, flex: 1 }}>{r.label}{r.ability && ABILITIES[r.ability] ? `（${ABILITIES[r.ability].label}）` : ""}</span>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>表にない組み合わせは △（標準）。同じ祖先を持つ親同士なら「血の濃さ」でさらに強くなります。</div>
              </div>
            )}
          </div>
          {legends.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>まだ引退した選手はいません。</div>}
          <div style={{ display: "grid", gap: 8 }}>
            {legends.map((leg, i) => {
              const legId = legendBloodId(leg);
              const expanded = ml.expandedLegend === legId;
              const parents = leg.parents || [];
              return (
              <div key={i} style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.purple}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: FONT_D, fontWeight: 700, color: C.text, fontSize: 14.5 }}>
                    {leg.name}<span style={{ marginLeft: 6, fontSize: 10.5, color: TYPES[leg.type]?.color }}>{TYPES[leg.type]?.label}</span>
                    {(leg.generation || 0) > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: "#e56cc8" }}>🧬{leg.generation}代目{(leg.plusValue || 0) > 0 ? `+${leg.plusValue}` : ""}</span>}
                  </span>
                  <span style={{ fontFamily: FONT_M, fontSize: 11, color: C.sub }}>{leg.endYear}年目引退・{leg.age}歳</span>
                </div>
                {leg.nickname && <div style={{ fontSize: 11.5, color: C.purple, fontStyle: "italic", marginTop: 1 }}>「{leg.nickname}」</div>}
                {leg.careerTitle && <div style={{ fontSize: 11.5, color: "#e8a13c", fontWeight: 700, marginTop: 2 }} title={leg.careerTitleDesc || ""}>― {leg.careerTitle} ―</div>}
                <div style={{ fontSize: 11, color: C.text, marginTop: 4, lineHeight: 1.6 }}>{leg.summary}</div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>
                  {leg.team}／通算{leg.races}戦{leg.wins}勝・表彰台{leg.podiums}回／実績{leg.achievedCount}/{leg.achievedTotal}
                </div>
                {/* v35(演出強化): ライバルとの因縁を呼称付きで、育てた弟子の到達を殿堂に刻む */}
                {leg.rivalName && (() => { const ht = rivalHeatTier(leg.rivalRecord?.heat ?? leg.rivalRecord?.meetings ?? 0); return (
                  <div style={{ fontSize: 10.5, marginTop: 3 }}>
                    <span style={{ color: ht.color, fontWeight: 700 }}>🔥{ht.label}</span>
                    <span style={{ color: C.sub }}> {leg.rivalName}に{leg.rivalRecord?.wins || 0}勝{leg.rivalRecord?.losses || 0}敗
                    {leg.rival2Name && `／好敵手${leg.rival2Name}に${leg.rivalRecord2?.wins || 0}勝${leg.rivalRecord2?.losses || 0}敗`}</span>
                  </div>
                ); })()}
                {leg.protege && (() => { const pr = protegeState(leg.protege, leg.endYear); return (
                  <div style={{ fontSize: 10.5, color: C.green, marginTop: 3 }}>🎓 弟子 {leg.protege.name}（{TYPES[leg.protege.type]?.label}）をOVR{pr.ovr}まで育てた</div>
                ); })()}
                {leg.epilogue && <div style={{ fontSize: 10.5, color: C.yellow, marginTop: 5, lineHeight: 1.6, fontStyle: "italic" }}>{leg.epilogue}</div>}
                {leg.autobiography && <div style={{ fontSize: 11, color: C.purple, marginTop: 5, lineHeight: 1.6, fontStyle: "italic" }}>📖「{leg.autobiography}」</div>}
                {leg.master && <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>🎓 {leg.master}の教え子{leg.partner ? `・🧬${leg.partner}との配合` : ""}</div>}
                {leg.lineageName && <div style={{ fontSize: 10.5, color: "#c98bf0", marginTop: 2 }}>🩸 {leg.lineageName}
                  {(() => { const rec = loadBloodlines()[leg.lineageName]; const t = rec ? mlBloodlineTier(rec) : null; if (!t || t.tier <= 0) return null; return <span style={{ color: "#e8a13c", fontWeight: 700 }}>　🏛{t.label}（{rec.count}名・{rec.wins}勝）</span>; })()}
                </div>}
                {leg.specialMatingTitle && <div style={{ fontSize: 10.5, color: "#ffd24a", fontWeight: 700, marginTop: 1 }}>🌟 {leg.specialMatingTitle}</div>}
                {/* v31.2: 殿堂記録の削除。誤って残った記録や整理のために1件ずつ消せる */}
                <div style={{ marginTop: 6, textAlign: "right" }}>
                  <button onClick={() => askConfirm(`殿堂記録から「${leg.name}」を削除しますか？この操作は取り消せません（血統の親として選べなくなります）。`, () => {
                    const list = loadMlLegends(); const oi = allLegends.length - 1 - i; if (oi >= 0 && oi < list.length) { list.splice(oi, 1); saveMlLegends(list); setMl(s => ({ ...s })); }
                  })} style={{ background: "none", border: `1px solid ${C.red}`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 10.5, padding: "2px 8px" }}>🗑 この記録を削除</button>
                </div>
                {/* v31.1: 系譜ツリー（血統）。親・祖父母を辿って表示する */}
                {parents.length > 0 && (
                  <>
                    <button onClick={() => setMl(s => ({ ...s, expandedLegend: expanded ? null : legId }))}
                      style={{ marginTop: 6, background: "none", border: `1px solid ${C.line}`, borderRadius: 6, color: "#e56cc8", cursor: "pointer", fontSize: 10.5, padding: "3px 8px" }}>
                      {expanded ? "▲ 系譜を閉じる" : "🌳 系譜（血統）を見る"}
                    </button>
                    {expanded && (
                      <div style={{ marginTop: 6, background: C.panel2, borderRadius: 8, padding: "8px 10px", fontSize: 11.5, lineHeight: 1.8 }}>
                        <div style={{ color: C.text, fontWeight: 700 }}>{leg.name}</div>
                        <div style={{ color: C.sub, marginLeft: 8 }}>
                          ├ 父母：{parents.map(p => bloodIdToName(p, bloodMap)).join(" × ")}
                        </div>
                        {parents.map((pid, pj) => {
                          const pl = bloodMap[pid];
                          const gp = pl && pl.parents || [];
                          if (gp.length === 0) return null;
                          return (
                            <div key={pj} style={{ color: C.sub, marginLeft: 20, fontSize: 11 }}>
                              └ {bloodIdToName(pid, bloodMap)}の父母：{gp.map(g => bloodIdToName(g, bloodMap)).join(" × ")}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
              );
            })}
          </div>
          <Btn outline color={C.sub} onClick={() => setMl(s => ({ ...s, screen: "mylife_create" }))}>← 戻る</Btn>
        </div>
      );
    }

}
