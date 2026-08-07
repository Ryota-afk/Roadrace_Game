// UI密度計測ツール（次のアクション#15「導線・ユーザビリティ」の before/after 検証用）。
//
// 【背景】UIテキスト第2波(DEVLOG §23)の完了後、「本当にごちゃつきは無いか」を確かめるために
// 書いたもの。ソースの静的検査では「1文が長いか」しか見えないが、実際の"ごちゃつき"は
// 「断片がいくつ並んでいるか」で決まる。このスクリプトは実機のレンダリング結果から
// 末端テキストノードを走査し、フォントサイズ・文字数・縦位置を集計する。
//
// 【使い方】
//   npx vite --port 5190 &            # 開発サーバを起動しておく
//   node tools/ui_density.mjs
//
// 【2026-08 時点の実測値（マイライフ本編＝毎月見る画面）】
//   末端テキスト要素 109個／うち11px以下 69個(63%)／10px以下 23個／ページ高さ1830px
//   縦200pxごとの断片数: 11 / 23 / 16 / 7 / 9 / 17 / 7 / 11 / 8
//   ※10px以下23件のうち14件はレーダーの軸ラベルで、これは図の構成要素なので小さくて当然。
//     「小さい文字」自体ではなく「整理されない断片の多さ」を見る指標として使うこと。
//
import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 420, height: 1000 }, deviceScaleFactor: 1 });
page.on("dialog", async d => { await d.accept(); });
const click = async (re) => {
  const b = page.locator("button:not([disabled])").filter({ hasText: re }).first();
  if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(450); return true; }
  return false;
};
await page.goto("http://localhost:5190/", { waitUntil: "networkidle" });
await click(/マイライフ/);
await click(/スプリンター/); await click(/大学卒/);
await click(/この内容でデビュー/); await page.waitForTimeout(300);
await click(/この素質でデビュー/); await page.waitForTimeout(800);
const out = await page.evaluate(() => {
  const rows = [];
  document.querySelectorAll("body *").forEach(el => {
    if (el.children.length > 0) return;
    const t = (el.innerText || el.textContent || "").trim();
    if (!t) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    rows.push({ y: Math.round(r.top + window.scrollY), fs, t });
  });
  rows.sort((a, b) => a.y - b.y);
  // 縦位置でざっくり束ねて「1画面あたり何個の断片が並んでいるか」を見る
  const bands = {};
  rows.forEach(r => { const b = Math.floor(r.y / 200) * 200; (bands[b] = bands[b] || []).push(r); });
  return { total: rows.length, tiny: rows.filter(r => r.fs <= 10).map(r => `${r.fs}px  ${r.t.slice(0, 34)}`), bands: Object.entries(bands).map(([k, v]) => [k, v.length]) };
});
console.log("末端テキスト要素 合計:", out.total);
console.log("\n縦200pxごとの断片数（多いほど密）:");
out.bands.forEach(([y, n]) => console.log(`  y=${String(y).padStart(5)}〜  ${"█".repeat(Math.min(n, 40))} ${n}`));
console.log("\n極小(<=10px)の要素 全" + out.tiny.length + "件:");
out.tiny.forEach(t => console.log("  - " + t));
await browser.close();
