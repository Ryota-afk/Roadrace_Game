// メタ画面（モード選択・生涯評価・系譜ツリー・因子図鑑・CPショップ）のディスパッチ。
// Step7第11弾でmain.jsxから分離。season/mylifeどちらにも属さない共通メタ層。
// ctx = { superMode, setSuperMode, buyCpItem, wrap }（season/mylifeのハンドラは一切受け取らない）。
import React from "react";
import { C, FONT_D, FONT_M } from "../data/theme.js";
import { Btn, Eyebrow } from "../components/ui.jsx";
import { LineageForestView, FactorCollectionView } from "../components/dynasty.jsx";
import { loadMlLegends } from "../breeding/breeding.js";
import { CP_SHOP, computePrestige, cpBalance, cpOwned, loadMeta, loadWorldMeta } from "../state/state.js";
import { cpUnlockRows, mlFactorCollection, mlLineageForest } from "../logic/support.js";

function renderModeSelect(ctx) {
  const { setSuperMode, wrap } = ctx;
  return wrap(
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
}

// v26: 生涯評価（プレステージスコア）。周回プレイをまたいで蓄積された記録を1画面に集約する
function renderPrestige(ctx) {
  const { setSuperMode, buyCpItem, wrap } = ctx;
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
function renderDynastyLineage(ctx) {
  const { setSuperMode, wrap } = ctx;
  const forest = mlLineageForest();
  const totalLeg = loadMlLegends().length;
  return wrap(
    <LineageForestView forest={forest} totalLeg={totalLeg} variant="dynasty"
      footer={<Btn outline color={C.sub} onClick={() => setSuperMode("prestige")}>← 生涯評価に戻る</Btn>} />
  );
}

// v38(#9 A-1): 統合ダイナスティ — 因子図鑑（両モード共通・生涯評価から開く）
function renderDynastyFactors(ctx) {
  const { setSuperMode, wrap } = ctx;
  const cats = mlFactorCollection();
  const totalLeg = loadMlLegends().length;
  return wrap(
    <FactorCollectionView cats={cats} totalLeg={totalLeg} variant="dynasty"
      footer={<Btn outline color={C.sub} onClick={() => setSuperMode("prestige")}>← 生涯評価に戻る</Btn>} />
  );
}

// v37: CPショップ。貯めたCP残高で恒久解禁を購入する（自動ミルストーンとは別のプレミアム枠）。
function renderCpShop(ctx) {
  const { setSuperMode, buyCpItem, wrap } = ctx;
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

export function renderMetaScreens(ctx) {
  const { superMode } = ctx;
  if (superMode === null) return renderModeSelect(ctx);
  if (superMode === "prestige") return renderPrestige(ctx);
  if (superMode === "dynasty_lineage") return renderDynastyLineage(ctx);
  if (superMode === "dynasty_factors") return renderDynastyFactors(ctx);
  if (superMode === "cpshop") return renderCpShop(ctx);
  return null;
}
