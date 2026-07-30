import { createRoot } from "react-dom/client";
import React from "react";

// ---- 静的データ（src/data/*）----
import { C, FONT_D, FONT_B, FONT_M } from "./data/theme.js";
import { TYPES } from "./data/abilities.js";
import { CLASSES } from "./data/progression.js";
import { MONTHS, UPKEEP_PER_RIDER } from "./data/course.js";
import { OB_COACH_SALARY } from "./data/economy.js";

// ---- コンポーネント（Phase 3）----
import { Btn, Eyebrow } from "./components/ui.jsx";

// ---- 純ロジック（メタ画面・生涯評価まわり）----
import { loadMlLegends } from "./breeding/breeding.js";
import { CP_SHOP, computePrestige, cpBalance, cpOwned, initGame, loadMeta, loadWorldMeta } from "./state/state.js";
import { cpUnlockRows, mlFactorCollection, mlLineageForest, mlLivingCost, seasonRank, staffSalaryTotal } from "./logic/support.js";

// ---- 画面ディスパッチ（Phase 4-2）----
import { renderMyLifeScreens } from "./screens/mylife.jsx";
import { renderSeasonScreens } from "./screens/season.jsx";

// ---- Step7第10弾：g/ml/shellの状態・ハンドラをフックへ集約 ----
import { useAppShell } from "./hooks/useAppShell.js";
import { useSeasonGame } from "./hooks/useSeasonGame.js";
import { useMyLifeGame } from "./hooks/useMyLifeGame.js";

// ---------- メインアプリ ----------
function App() {
  const shell = useAppShell();
  const { superMode, setSuperMode, uiTick, buyCpItem, confirmDialog, setConfirmDialog, askConfirm, renameState, setRenameState, openRename } = shell;
  const season = useSeasonGame();
  const { g, setG, cls } = season;
  const mylife = useMyLifeGame({ superMode, askConfirm });
  const { ml } = mylife;

  // v38(#9 A-4): 選手→監督の転身ブリッジ。マイライフの殿堂選手を新チームの監督として招聘する
  // （生涯評価画面の「監督として新チームを率いる」から呼ばれる、season/mylifeを跨ぐ唯一の導線）
  const becomeManager = () => { setSuperMode("season"); setG({ ...initGame(), screen: "newgame_setup", legendRecruitIdx: 0 }); };

  // ---- 共通 ----
  const Header = () => (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Eyebrow>{cls.label} — {g.year}年目 {MONTHS[g.month]}{g.dynastyLevel > 0 ? ` ／ 🔁 ディナスティ${g.dynastyLevel}周目` : ""}</Eyebrow>
          <div style={{ fontFamily: FONT_D, fontSize: 18, fontWeight: 700, color: C.text }}>{g.teamName || "あなたのチーム"}</div>
          {g.sponsor && <div style={{ fontSize: 10.5, color: C.sub }}>SPONSOR: {g.sponsor.name}（月+{g.sponsor.monthly}万／ノルマ{g.sponsor.norma}pt／未達-{g.sponsor.penalty}万／指定レース{g.sponsor.mandatesMet}済{g.sponsor.mandatesMissed > 0 ? `・見送り${g.sponsor.mandatesMissed}` : ""}）</div>}
          <div style={{ fontSize: 10.5, color: C.sub }}>
            選手維持費 -{g.roster.length * UPKEEP_PER_RIDER}万/月（{g.roster.length}名）
            {staffSalaryTotal(g.staff) > 0 && <>／スタッフ月給 -{staffSalaryTotal(g.staff)}万/月</>}
            {g.obCoach && <>／OBコーチ -{OB_COACH_SALARY}万/月</>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: FONT_M, fontSize: 18, color: g.budget < 0 ? C.red : C.yellow }}>{g.budget}<span style={{ fontSize: 10 }}>万円{g.budget < 0 ? "（借金）" : ""}</span></div>
          <div style={{ fontFamily: FONT_M, fontSize: 12, color: C.green }}>{g.points}pt <span style={{ color: C.sub }}>/ 出場権{cls.need}pt</span></div>
          {(() => { const sr = seasonRank(g); return (
            <div style={{ fontFamily: FONT_M, fontSize: 11, color: sr.rank <= 3 ? "#e8a13c" : C.sub }}>
              🏆 順位 {sr.rank}/{sr.total}位{sr.rank <= 3 ? "（昇格ボーダー緩和圏）" : ""}
            </div>
          ); })()}
        </div>
      </div>
    </div>
  );
  const Nav = () => (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {[["home", "🏁 レース"], ["riders", "👥 選手・練習"], ["shop", "🛒 ショップ"], ["career", "📜 記録"], ["help", "📖 ヘルプ"]].map(([k, l]) => (
        <button key={k} onClick={() => setG(s => ({ ...s, tab: k }))}
          style={{
            flex: 1, padding: "9px 4px", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: FONT_D, cursor: "pointer",
            background: g.tab === k ? C.yellow : C.panel, color: g.tab === k ? "#14171d" : C.sub,
            border: `1px solid ${g.tab === k ? C.yellow : C.line}`,
          }}>{l}</button>
      ))}
    </div>
  );
  // v29: 選手名変更モーダル（wrap/mlWrap両方で表示する共用JSX）
  const commitRename = () => { const v = (renameState.value || "").trim(); if (v) renameState.onCommit(v); setRenameState(null); };
  const renameModal = renameState && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%", border: `1px solid ${C.line}` }}>
        <div style={{ color: C.text, fontSize: 14, marginBottom: 12 }}>{renameState.title}</div>
        <input type="text" autoFocus value={renameState.value} maxLength={12}
          onChange={e => setRenameState(s => ({ ...s, value: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter") commitRename(); }}
          style={{ width: "100%", boxSizing: "border-box", background: C.panel2, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FONT_B }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn small outline color={C.sub} onClick={() => setRenameState(null)}>キャンセル</Btn>
          <Btn small color={C.green} onClick={commitRename}>変更</Btn>
        </div>
      </div>
    </div>
  );
  const wrap = (children, withNav) => (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT_B }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "6px 14px 40px" }}>
        <Header />
        {withNav && <Nav />}
        {children}
      </div>
      {renameModal}
      {/* v12バグ修正: window.confirm()に頼らない、アプリ内完結の確認モーダル */}
      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%", border: `1px solid ${C.line}` }}>
            <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-wrap" }}>{confirmDialog.message}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn small outline color={C.sub} onClick={() => setConfirmDialog(null)}>キャンセル</Btn>
              <Btn small color={C.red} onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }}>OK</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ================= v14: モード選択（タイトル） =================
  const mlWrap = (children) => (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT_B }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "6px 14px 40px" }}>
        {ml.player && (
          <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 12 }}>
            <Eyebrow>MY LIFE — {CLASSES[ml.classIdx].label} {ml.year}年目 {MONTHS[ml.month]}</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 16, fontWeight: 700, color: C.text }}>{ml.player.name}（{ml.team}）</div>
            <div style={{ fontSize: 11, color: C.sub }}>{ml.points}pt / 昇格権{CLASSES[ml.classIdx].need}pt</div>
            <div style={{ fontSize: 11, color: C.sub }}>所持金{ml.money}万円・年俸{ml.salary}万円（生活費/税 -{mlLivingCost(ml)}万/月）</div>
          </div>
        )}
        {children}
      </div>
      {renameModal}
      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
          <div style={{ background: C.panel, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%", border: `1px solid ${C.line}` }}>
            <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-wrap" }}>{confirmDialog.message}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn small outline color={C.sub} onClick={() => setConfirmDialog(null)}>キャンセル</Btn>
              <Btn small color={C.red} onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }}>OK</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (superMode === null) return wrap(
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 18, border: `1px solid ${C.line}` }}>
        <Eyebrow>MODE SELECT — v14</Eyebrow>
        <h2 style={{ fontFamily: FONT_D, color: C.text, fontSize: 21, margin: "6px 0 10px" }}>プレイモードを選んでください</h2>
        <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.7, margin: 0 }}>
          シーズンモードは6名のロースターを率いるチーム運営、マイライフモードは選手1人のキャリアをB1から歩む新モードです。
        </p>
      </div>
      <Btn onClick={() => setSuperMode("season")}>🏢 シーズンモード（チーム運営）</Btn>
      <Btn outline onClick={() => setSuperMode("mylife")}>🚴 マイライフモード（選手キャリア）</Btn>
      <Btn outline color={"#e8a13c"} onClick={() => setSuperMode("prestige")}>🏆 生涯評価を見る</Btn>
    </div>
  );

  // v26: 生涯評価（プレステージスコア）。周回プレイをまたいで蓄積された記録を1画面に集約する
  if (superMode === "prestige") {
    const p = computePrestige();
    return wrap(
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ background: C.panel, borderRadius: 12, padding: 22, borderTop: `4px solid ${"#e8a13c"}`, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <h2 style={{ fontFamily: FONT_D, color: "#e8a13c", fontSize: 26, margin: "8px 0" }}>生涯評価スコア</h2>
          <div style={{ fontFamily: FONT_M, fontSize: 32, color: C.text, fontWeight: 700 }}>{p.score.toLocaleString()}</div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>シーズンモード・マイライフモード両方のプレイ履歴から算出されます</div>
        </div>
        <div>
          <Eyebrow color={"#e8a13c"}>通算タイトル</Eyebrow>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, marginTop: 8, fontSize: 12.5, color: C.text, lineHeight: 1.8 }}>
            主要タイトル獲得数：<span style={{ color: "#e8a13c", fontFamily: FONT_M }}>{p.titleCount}回</span>（グランツール・グランファイナル・世界選手権・オリンピック）
          </div>
        </div>
        <div>
          <Eyebrow color={C.blue}>シーズンモード（周回プレイ）</Eyebrow>
          <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, marginTop: 8, fontSize: 12.5, color: C.text, lineHeight: 1.8 }}>
            生涯獲得クリアポイント：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.totalEarnedCP}pt</span>
          </div>
        </div>
        <div>
          <Eyebrow color={C.red}>マイライフモード（歴代選手）</Eyebrow>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, fontSize: 12.5, color: C.text }}>
              引退した選手数：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.legendCount}名</span>
            </div>
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, fontSize: 12.5, color: C.text }}>
              通算勝利数：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.mlWins}勝</span>／通算表彰台：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.mlPodiums}回</span>
            </div>
            <div style={{ background: C.panel, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.line}`, fontSize: 12.5, color: C.text }}>
              通算実績達成数：<span style={{ color: C.yellow, fontFamily: FONT_M }}>{p.mlAchieved}</span>
            </div>
          </div>
        </div>
        {/* v37: 生涯CPで解禁される内容の一覧（コース／シーズン開幕特典／マイライフ特典） */}
        {(() => {
          const rows = cpUnlockRows(p.totalEarnedCP);
          const nextLocked = rows.find(r => !r.unlocked);
          const catColor = { "コース": C.green, "シーズン開幕": C.blue, "マイライフ": C.red };
          return (
            <div>
              <Eyebrow color={C.yellow}>🔓 クリアポイント解禁一覧</Eyebrow>
              {nextLocked && (
                <div style={{ background: C.panel2, borderRadius: 8, padding: "8px 12px", marginTop: 8, fontSize: 11.5, color: C.text }}>
                  次の解禁まであと <b style={{ color: C.yellow, fontFamily: FONT_M }}>{nextLocked.cp - p.totalEarnedCP}pt</b>：{nextLocked.label}
                </div>
              )}
              <div style={{ background: C.panel, borderRadius: 10, border: `1px solid ${C.line}`, marginTop: 8, maxHeight: 300, overflowY: "auto" }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: `1px solid ${C.bg}`, opacity: r.unlocked ? 1 : 0.55 }}>
                    <span style={{ width: 30, textAlign: "right", fontFamily: FONT_M, fontSize: 11, color: r.unlocked ? C.green : C.sub }}>{r.unlocked ? "✓" : `${r.cp}`}</span>
                    <span style={{ fontSize: 9.5, color: catColor[r.category] || C.sub, border: `1px solid ${catColor[r.category] || C.line}`, borderRadius: 5, padding: "0 5px", flexShrink: 0 }}>{r.category}</span>
                    <span style={{ flex: 1, fontSize: 11.5, color: r.unlocked ? C.text : C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        {/* v38(#9 A-1): 統合ダイナスティ・ハブ。殿堂・系統・因子・系譜は両モード＆周回をまたいで
            共有される「あなたの王朝」の背骨。生涯評価（両モード共通の画面）から辿れるようにする。 */}
        <div style={{ background: "linear-gradient(180deg,#233026,#1d2a22)", borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.green}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
            <Eyebrow color={C.green}>🌳 あなたのダイナスティ</Eyebrow>
            <span style={{ fontSize: 11, color: C.green, fontFamily: FONT_M }}>🌍 世界 {loadWorldMeta().year} 年目</span>
          </div>
          <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 8px", lineHeight: 1.6 }}>歴代の名選手・確立した系統・集めた因子、そして世界のペロトンは、シーズンとマイライフの両方＆全周回で受け継がれる<b style={{ color: C.green }}>1つの世界</b>の資産です。世界はあなたが年を進めるたびに歳を取り、世代交代していきます。</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn small outline color={C.green} onClick={() => setSuperMode("dynasty_lineage")}>🌳 系譜ツリー</Btn>
            <Btn small outline color={"#e56cc8"} onClick={() => setSuperMode("dynasty_factors")}>🧬 因子図鑑</Btn>
          </div>
        </div>
        <Btn color={C.yellow} onClick={() => setSuperMode("cpshop")}>🛒 CPショップで解禁を購入する</Btn>
        <Btn outline color={C.sub} onClick={() => setSuperMode(null)}>← モード選択に戻る</Btn>
      </div>
    );
  }

  // v38(#9 A-1): 統合ダイナスティ — 系譜ツリー（両モード共通・生涯評価から開く）
  if (superMode === "dynasty_lineage") {
    const forest = mlLineageForest();
    const totalLeg = loadMlLegends().length;
    const tierColor = ["#7c8aa5", "#6fbf73", "#4f8fe8", "#ffd23f"];
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: "linear-gradient(180deg,#233026,#1d2a22)", borderRadius: 12, padding: 16, borderTop: `4px solid ${C.green}` }}>
          <h2 style={{ fontFamily: FONT_D, color: C.green, fontSize: 20, margin: "0 0 4px" }}>🌳 系譜ツリー</h2>
          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>歴代選手（{totalLeg}名）を系統（血の流れ）ごとにまとめました。配合を重ねると世代（🧬N代目）が進み、系統が「確立→名門→大系統」へ育ちます。</div>
        </div>
        {totalLeg === 0 && <div style={{ fontSize: 12.5, color: C.sub, padding: 10 }}>まだ殿堂選手がいません。マイライフで選手を引退させると系譜が始まります。</div>}
        {forest.map(g => (
          <div key={g.lineageName} style={{ background: C.panel, borderRadius: 12, padding: "12px 14px", border: `1px solid ${tierColor[g.tier.tier]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontFamily: FONT_D, fontSize: 15, fontWeight: 700, color: C.text }}>{g.lineageName}</span>
              <span style={{ fontSize: 11, color: tierColor[g.tier.tier], fontWeight: 700 }}>{g.tier.label}{g.tier.tier > 0 ? `（因子+${g.tier.tier}）` : ""}・{g.size}名</span>
            </div>
            <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
              {g.members.map((m, i) => (
                <div key={i} style={{ paddingLeft: Math.min(4, m.generation) * 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12.5 }}>
                    <span style={{ color: C.sub, fontFamily: FONT_M, fontSize: 10 }}>{m.generation > 0 ? "└" : "●"}</span>
                    <span style={{ fontFamily: FONT_D, color: C.text, fontWeight: 700 }}>{m.name}</span>
                    <span style={{ fontSize: 10, color: TYPES[m.type]?.color }}>{TYPES[m.type]?.label}</span>
                    {m.generation > 0 && <span style={{ fontSize: 10, color: "#e56cc8" }}>🧬{m.generation}代目{m.plusValue > 0 ? `+${m.plusValue}` : ""}</span>}
                    <span style={{ fontSize: 10, color: C.sub }}>OVR{m.overall}</span>
                  </div>
                  {m.nickname && <div style={{ fontSize: 10, color: C.purple, fontStyle: "italic", paddingLeft: 16 }}>「{m.nickname}」</div>}
                  {m.parents.length > 0 && <div style={{ fontSize: 9.5, color: C.sub, paddingLeft: 16 }}>親：{m.parents.join(" × ")}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
        <Btn outline color={C.sub} onClick={() => setSuperMode("prestige")}>← 生涯評価に戻る</Btn>
      </div>
    );
  }

  // v38(#9 A-1): 統合ダイナスティ — 因子図鑑（両モード共通・生涯評価から開く）
  if (superMode === "dynasty_factors") {
    const cats = mlFactorCollection();
    const totalLeg = loadMlLegends().length;
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: "linear-gradient(180deg,#2e2436,#241d2c)", borderRadius: 12, padding: 16, borderTop: `4px solid #e56cc8` }}>
          <h2 style={{ fontFamily: FONT_D, color: "#e56cc8", fontSize: 20, margin: "0 0 4px" }}>🧬 因子図鑑</h2>
          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>歴代の殿堂選手（{totalLeg}名）が残した「因子」の集まりです。★＝その因子を持つ選手の数。周回を重ねるほど因子が貯まり、系統を通じて配合・弟子継承に受け継がれます。</div>
        </div>
        {totalLeg === 0 && <div style={{ fontSize: 12.5, color: C.sub, padding: 10 }}>まだ殿堂選手がいません。マイライフで選手を引退させると因子が集まり始めます。</div>}
        {cats.map(cat => (
          <div key={cat.category} style={{ background: C.panel, borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.line}` }}>
            <Eyebrow color={C.purple}>{cat.icon} {cat.category}</Eyebrow>
            {cat.items.length === 0 && <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>まだこの種類の因子はありません。</div>}
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {cat.items.map(it => (
                <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: C.bg, borderRadius: 8 }}>
                  <span style={{ fontFamily: FONT_D, fontSize: 13, color: it.color, fontWeight: 700, minWidth: 92 }}>{it.label}</span>
                  <span style={{ fontFamily: FONT_M, fontSize: 12, color: "#ffd23f", letterSpacing: -1 }}>{"★".repeat(Math.min(6, it.count))}{it.count > 6 ? ` ×${it.count}` : ""}</span>
                  <span style={{ flex: 1, fontSize: 10, color: C.sub, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.members.slice(0, 3).join("・")}{it.members.length > 3 ? "…" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Btn outline color={C.sub} onClick={() => setSuperMode("prestige")}>← 生涯評価に戻る</Btn>
      </div>
    );
  }

  // v37: CPショップ。貯めたCP残高で恒久解禁を購入する（自動ミルストーンとは別のプレミアム枠）。
  if (superMode === "cpshop") {
    const meta = loadMeta();
    const bal = cpBalance(meta);
    const catColor = { "シーズン": C.blue, "マイライフ": C.red, "特別": C.yellow };
    return wrap(
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: "linear-gradient(180deg, rgba(255,210,63,0.10), #201e26)", borderRadius: 12, padding: 16, borderTop: `4px solid ${C.yellow}`, textAlign: "center" }}>
          <div style={{ fontSize: 30 }}>🛒</div>
          <h2 style={{ fontFamily: FONT_D, color: C.yellow, fontSize: 20, margin: "4px 0" }}>CPショップ</h2>
          <div style={{ fontSize: 12, color: C.sub }}>使えるCP残高</div>
          <div style={{ fontFamily: FONT_M, fontSize: 26, color: C.yellow, fontWeight: 800 }}>{bal}<span style={{ fontSize: 13 }}>pt</span></div>
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>生涯獲得 {meta.totalEarnedCP}pt ／ 使用済み {meta.cpSpent || 0}pt。購入は恒久で、次のシーズン/新人に反映されます</div>
        </div>
        {CP_SHOP.map((it) => {
          const owned = cpOwned(meta, it.id);
          const affordable = bal >= it.cost;
          return (
            <div key={it.id} style={{ background: C.panel, borderRadius: 10, border: `1px solid ${owned ? C.green : C.line}`, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, opacity: owned ? 0.85 : 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9.5, color: catColor[it.category] || C.sub, border: `1px solid ${catColor[it.category] || C.line}`, borderRadius: 5, padding: "0 5px" }}>{it.category}</span>
                  <span style={{ fontFamily: FONT_D, fontSize: 13.5, color: C.text, fontWeight: 700 }}>{it.label}</span>
                </div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{it.desc}</div>
              </div>
              {owned
                ? <span style={{ fontSize: 12, color: C.green, fontWeight: 700, whiteSpace: "nowrap" }}>✓ 解禁済</span>
                : <Btn small color={affordable ? C.yellow : C.sub} outline={!affordable} onClick={() => affordable && buyCpItem(it.id)}>{it.cost}pt</Btn>}
            </div>
          );
        })}
        <Btn outline color={C.sub} onClick={() => setSuperMode("prestige")}>← 生涯評価に戻る</Btn>
      </div>
    );
  }

  // ================= v14: マイライフモード 画面群 =================
  // v41(§Step7第10弾): ctx（旧・88メンバーの手組みオブジェクト）を season/mylife に分割した。
  // season画面はmylifeハンドラを一切受け取らない（層の逆流を構造的に不可能にする）。
  // 両モード共有の3メンバー（askConfirm/openRename/setSuperMode）だけをshellから注入する。
  const shellForScreens = { askConfirm, openRename, setSuperMode };
  if (superMode === "mylife") return renderMyLifeScreens({ ...shellForScreens, ...mylife, mlWrap, becomeManager });

  // ================= 画面（シーズンモード） =================
  return renderSeasonScreens({ ...shellForScreens, ...season, wrap });
}


export default App;
createRoot(document.getElementById("root")).render(<App />);
