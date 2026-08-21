// メタ画面（モード選択・生涯評価・系譜ツリー・因子図鑑・CPショップ）のディスパッチ。
// Step7第11弾でmain.jsxから分離。season/mylifeどちらにも属さない共通メタ層。
// ctx = { superMode, setSuperMode, buyCpItem, wrap }（season/mylifeのハンドラは一切受け取らない）。
// 第13弾Phase3-D-4-a2：kit.jsxのSection/Item/ShopRow/PrimaryBtn/QuietBtnへ全面移行。
// モード選択＝案C（タイトルらしく組む）、解禁一覧＝案A（未解禁だけ出す）。詳細はdevlog/wave13.md。
import React from "react";
import { FONT_DOT, T } from "../data/theme.js";
import { Item, PrimaryBtn, QuietBtn, Section, ShopRow } from "../components/kit.jsx";
import { LineageForestView, FactorCollectionView } from "../components/dynasty.jsx";
import { loadMlLegends } from "../breeding/breeding.js";
import { CP_SHOP, computePrestige, cpBalance, cpOwned, loadMeta, loadWorldMeta } from "../state/state.js";
import { cpUnlockRows, mlFactorCollection, mlLineageForest } from "../logic/support.js";

function renderModeSelect(ctx) {
  const { setSuperMode, wrap } = ctx;
  const meta = loadMeta();
  const legends = loadMlLegends();
  const showAux = meta.totalEarnedCP > 0 || legends.length > 0;
  const p = computePrestige();
  const bal = cpBalance(meta);
  return wrap(
    <div style={{ display: "grid", gap: T.space.lg }}>
      <div style={{ textAlign: "center", padding: `${T.space.lg}px 0` }}>
        <div style={{ fontSize: T.size.display, color: T.color.accent, lineHeight: 1.3 }}>ロードレース</div>
        <div style={{ fontSize: T.size.display, color: T.color.accent, lineHeight: 1.3 }}>シミュレーション</div>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.sm }}>チームを率い、世界の頂点へ</div>
      </div>
      <Section padded title="シーズンモード">
        <div style={{ fontSize: T.size.title, color: T.color.text }}>チーム運営</div>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.6, margin: `${T.space.xs}px 0 ${T.space.md}px` }}>
          6名のロースターを率い、B1からPROクラスの頂点へ昇格を目指します。
        </div>
        <PrimaryBtn onClick={() => setSuperMode("season")}>はじめる</PrimaryBtn>
      </Section>
      <Section padded title="マイライフモード">
        <div style={{ fontSize: T.size.title, color: T.color.text }}>選手キャリア</div>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.6, margin: `${T.space.xs}px 0 ${T.space.md}px` }}>
          選手1人のキャリアを、デビューから引退までひとつの人生として歩みます。
        </div>
        <QuietBtn color={T.color.action} onClick={() => setSuperMode("mylife")}>はじめる</QuietBtn>
      </Section>
      {showAux && (
        <div style={{ display: "flex", gap: T.space.sm }}>
          <button onClick={() => setSuperMode("prestige")} style={{ flex: 1, textAlign: "left", background: T.color.surface, border: "none", padding: T.space.md, fontFamily: FONT_DOT, cursor: "pointer" }}>
            <div style={{ fontSize: T.size.caption, color: T.color.sub }}>生涯評価</div>
            <div style={{ fontSize: T.size.title, color: T.color.accent, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{p.score.toLocaleString()}</div>
          </button>
          <button onClick={() => setSuperMode("cpshop")} style={{ flex: 1, textAlign: "left", background: T.color.surface, border: "none", padding: T.space.md, fontFamily: FONT_DOT, cursor: "pointer" }}>
            <div style={{ fontSize: T.size.caption, color: T.color.sub }}>使えるクリアポイント</div>
            <div style={{ fontSize: T.size.title, color: T.color.accent, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{bal}pt</div>
          </button>
        </div>
      )}
    </div>
  );
}

function renderPrestige(ctx) {
  const { setSuperMode, wrap } = ctx;
  const p = computePrestige();
  const rows = cpUnlockRows(p.totalEarnedCP);
  const lockedRows = rows.filter(r => !r.unlocked);
  const unlockedCount = rows.length - lockedRows.length;
  return wrap(
    <div style={{ display: "grid", gap: T.space.lg }}>
      <div style={{ textAlign: "center", padding: `${T.space.lg}px 0` }}>
        <div style={{ fontSize: T.size.caption, color: T.color.sub }}>生涯評価スコア</div>
        <div style={{ fontSize: T.size.display, color: T.color.accent, fontVariantNumeric: "tabular-nums" }}>{p.score.toLocaleString()}</div>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>両モードのプレイ履歴から算出されます</div>
      </div>
      <Section title="通算タイトル">
        <Item first label="主要タイトル" value={`${p.titleCount}回`} detail="グランツール・グランファイナル・世界選手権・オリンピック" />
      </Section>
      <Section title="シーズンモード（周回プレイ）">
        <Item first label="生涯獲得クリアポイント" value={`${p.totalEarnedCP}pt`} />
      </Section>
      <Section title="マイライフモード（歴代選手）">
        <Item first label="引退した選手数" value={`${p.legendCount}名`} />
        <Item label="通算勝利数" value={`${p.mlWins}勝`} />
        <Item label="通算表彰台" value={`${p.mlPodiums}回`} />
        <Item label="通算実績達成数" value={`${p.mlAchieved}`} />
      </Section>
      <Section title="クリアポイント解禁" right={`${unlockedCount} / ${rows.length} 解禁済み`}>
        {lockedRows.length === 0
          ? <div style={{ fontSize: T.size.body, color: T.color.sub, padding: `${T.space.sm}px 0` }}>すべて解禁済みです。</div>
          : lockedRows.map((r, i) => (
              <ShopRow key={i} first={i === 0} label={r.label} detail={r.category} locked={`あと${r.cp - p.totalEarnedCP}pt`} />
            ))}
      </Section>
      <Section title="ダイナスティ" right={`世界 ${loadWorldMeta().year} 年目`}>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, lineHeight: 1.6, marginBottom: T.space.md }}>
          歴代の名選手・系統・因子は1つの世界として、両モード・全周回で受け継がれます。
        </div>
        <QuietBtn onClick={() => setSuperMode("dynasty_lineage")}>系譜ツリーを見る</QuietBtn>
        <QuietBtn onClick={() => setSuperMode("dynasty_factors")}>因子図鑑を見る</QuietBtn>
      </Section>
      <PrimaryBtn onClick={() => setSuperMode("cpshop")}>クリアポイント交換所へ</PrimaryBtn>
      <QuietBtn onClick={() => setSuperMode(null)}>← モード選択に戻る</QuietBtn>
    </div>
  );
}

function renderDynastyLineage(ctx) {
  const { setSuperMode, wrap } = ctx;
  const forest = mlLineageForest();
  const totalLeg = loadMlLegends().length;
  return wrap(
    <LineageForestView forest={forest} totalLeg={totalLeg} variant="dynasty"
      footer={<QuietBtn onClick={() => setSuperMode("prestige")}>← 生涯評価に戻る</QuietBtn>} />
  );
}

function renderDynastyFactors(ctx) {
  const { setSuperMode, wrap } = ctx;
  const cats = mlFactorCollection();
  const totalLeg = loadMlLegends().length;
  return wrap(
    <FactorCollectionView cats={cats} totalLeg={totalLeg} variant="dynasty"
      footer={<QuietBtn onClick={() => setSuperMode("prestige")}>← 生涯評価に戻る</QuietBtn>} />
  );
}

function renderCpShop(ctx) {
  const { setSuperMode, buyCpItem, resetCpProgress, askConfirm, wrap } = ctx;
  const meta = loadMeta();
  const bal = cpBalance(meta);
  return wrap(
    <div style={{ display: "grid", gap: T.space.lg }}>
      <div style={{ textAlign: "center", padding: `${T.space.lg}px 0` }}>
        <div style={{ fontSize: T.size.caption, color: T.color.sub }}>使えるクリアポイント</div>
        <div style={{ fontSize: T.size.display, color: T.color.accent, fontVariantNumeric: "tabular-nums" }}>{bal}<span style={{ fontSize: T.size.head }}>pt</span></div>
        <div style={{ fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>
          生涯獲得 {meta.totalEarnedCP}pt ／ 使用済み {meta.cpSpent || 0}pt。購入は恒久で、次のシーズン／新人に反映されます
        </div>
      </div>
      <Section title="交換できるアイテム">
        {CP_SHOP.map((it, i) => {
          const owned = cpOwned(meta, it.id);
          const affordable = bal >= it.cost;
          return (
            <ShopRow key={it.id} first={i === 0} label={it.label} badge={it.category} detail={it.desc}
              locked={owned ? "解禁済み" : undefined}
              buyLabel={owned ? undefined : `${it.cost}pt`}
              buyDisabled={!affordable}
              onBuy={() => buyCpItem(it.id)}
            />
          );
        })}
      </Section>
      <QuietBtn color={T.color.bad} onClick={() => {
        askConfirm(
          `累計クリアポイント（${meta.totalEarnedCP}pt）と、それに紐づく永続ボーナス・購入済みの交換所アイテムをすべて消去します。この操作は取り消せません。`,
          () => askConfirm(
            "本当によろしいですか？もう一度確認します。クリアポイントは元に戻せません。",
            () => resetCpProgress(),
            "消去する"
          )
        );
      }}>{`クリアポイントをリセット（累計${meta.totalEarnedCP}pt消去）`}</QuietBtn>
      <QuietBtn onClick={() => setSuperMode(null)}>← モード選択に戻る</QuietBtn>
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
