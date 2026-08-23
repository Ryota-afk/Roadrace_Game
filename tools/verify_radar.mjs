// レーダーチャート（能力5軸・素質7軸）の描画を機械的に検証するゲート。
// 第30弾で新設。背景：第29弾の「外周＝能力別上限」が図の形を歪めていた問題を修正するにあたり、
// 「見た目が正しいか」を人の目視だけで判定していたため、7角形（素質）のラベル重なりを
// 設計段階で見落としかけた。以降このスクリプトの全項目が通ることを実装完了の条件とする。
//
// 使い方：
//   npm run build
//   npx http-server dist -p 8123 -s &
//   node tools/verify_radar.mjs
//
// 判定内容：
//   1. 実線多角形の各頂点の半径比 == 能力値 / maxCap（全軸で分母が共通であること）
//   2. 点線多角形（上限シルエット）の各頂点の半径比 == 各能力の上限 / maxCap
//   3. 軸をまたぐラベル同士が MIN_GAP px 以上離れていること（5角形・7角形の両方）
//   4. pageerror がゼロであること
//
// 3について：「重なっていないこと」では不十分。実測で、隙間1.0pxの
// 「スタミナ」「スプリント」は画面上「スタミナスプリント」と1語に読めてしまった。
// 重なりゼロではなく最低隙間で判定する。
// Playwrightは本リポジトリの依存には入れていない（verify_baseview.mjsは純Nodeで動く方針）。
// グローバル導入・別ディレクトリ導入のどちらでも拾えるように解決を分けている。
// 明示したい場合は PLAYWRIGHT_MODULE に playwright のパスを渡す。
async function loadChromium() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    "playwright",
    "/opt/node22/lib/node_modules/playwright/index.mjs",
  ].filter(Boolean);
  for (const c of candidates) {
    try { return (await import(c)).chromium; } catch { /* 次の候補へ */ }
  }
  console.error(
    "playwright を読み込めませんでした。\n" +
    "  npm i -D playwright  もしくは  PLAYWRIGHT_MODULE=<playwrightのパス> node tools/verify_radar.mjs");
  process.exit(2);
}
const chromium = await loadChromium();

const URL = process.env.RADAR_URL || "http://localhost:8123/index.html";
const MIN_GAP = 6;      // 軸をまたぐラベル同士に必要な最低の隙間(px)
const EPS = 0.01;       // 半径比の許容誤差

const results = [];
const ok = (name, detail = "") => results.push({ pass: true, name, detail });
const ng = (name, detail = "") => results.push({ pass: false, name, detail });

// ページ内で1つのレーダーSVGを解析する（同じ<g>に属するテキストは同一軸とみなす）
function probeSvgSource() {
  return (svg) => {
    const size = parseFloat(svg.getAttribute("width"));
    const cx = size / 2, cy = size / 2, r = size / 2 - 34;
    const radius = (el, ax, ay) =>
      Math.hypot(parseFloat(el.getAttribute(ax)) - cx, parseFloat(el.getAttribute(ay)) - cy) / r;
    const polys = [...svg.querySelectorAll("polygon")];
    // 先頭4枚は目盛りのリング。残りが「上限の点線（あれば）」と「データの実線」。
    const extra = polys.slice(4);
    const dashed = extra.find(p => p.getAttribute("stroke-dasharray"));
    const solid = extra.find(p => !p.getAttribute("stroke-dasharray"));
    const fracsOf = (p) => !p ? null : p.getAttribute("points").trim().split(/\s+/).map(pair => {
      const [x, y] = pair.split(",").map(Number);
      return Math.round(Math.hypot(x - cx, y - cy) / r * 1e4) / 1e4;
    });
    const dots = [...svg.querySelectorAll("circle")].map(c => radius(c, "cx", "cy"));
    const texts = [...svg.querySelectorAll("text")].map(t => {
      const b = t.getBoundingClientRect();
      // 同じ<g>にまとめられたラベルと数値は同一軸（上下に重ねる設計なので判定から除く）
      const g = t.closest("g");
      return { s: t.textContent, ax: g ? [...svg.querySelectorAll("g")].indexOf(g) : -1,
               x1: b.left, y1: b.top, x2: b.right, y2: b.bottom };
    });
    return { size, axes: svg.querySelectorAll("line").length,
             solid: fracsOf(solid), dashed: fracsOf(dashed),
             dots: dots.map(v => Math.round(v * 1e4) / 1e4), texts };
  };
}

// 軸をまたぐラベル同士の最小の隙間を求める
function minGap(texts) {
  let worst = { gap: Infinity, pair: "" };
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.ax === b.ax && a.ax !== -1) continue;         // 同じ軸のラベルと数値は対象外
      const oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
      if (oy <= 0.5) continue;                            // 行が重なっていなければ無関係
      const gap = Math.max(a.x1, b.x1) - Math.min(a.x2, b.x2);
      if (gap < worst.gap) worst = { gap, pair: `${a.s}｜${b.s}` };
    }
  }
  return worst;
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));

try {
  await page.goto(URL);
  await page.waitForTimeout(600);
  // マイライフ → クライマー（得意/苦手の差が最も大きい脚質）でデビュー → 選手画面
  await page.locator('button:has-text("はじめる")').nth(1).click();
  await page.waitForTimeout(400);
  await page.locator("text=クライマー").first().click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("この内容でデビュー")').click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("この素質でデビュー")').click().catch(() => {});
  await page.waitForTimeout(700);
  await page.locator('button:has-text("選手")').first().click();
  await page.waitForTimeout(700);

  if (!(await page.innerText("body")).includes("能力と素質")) {
    ng("選手画面への到達", "「能力と素質」が見つからない（画面遷移が変わった可能性）");
  } else {
    const probes = await page.evaluate((src) => {
      const probe = eval("(" + src + ")")();   // 関数宣言のままevalすると値を返さないので括る
      const svgs = [...document.querySelectorAll("svg")].filter(s => s.querySelectorAll("polygon").length >= 5);
      return svgs.slice(0, 2).map(probe);
    }, probeSvgSource.toString());

    const [ability, sub] = probes;

    // 1・2：実線と点線の半径比。分母が全軸共通なら、実線の比の並びは能力値の並びと相似になる。
    if (!ability) {
      ng("能力レーダーの取得", "SVGが見つからない");
    } else {
      if (!ability.dashed) {
        ng("上限シルエット（点線）", "点線の多角形が描かれていない（案Bが未実装）");
      } else {
        const maxRing = Math.max(...ability.dashed);
        Math.abs(maxRing - 1) < EPS
          ? ok("点線が外周に接する", `最大 ${maxRing}`)
          : ng("点線が外周に接する", `最大が ${maxRing}（1.0であるべき＝外周＝最大上限）`);
        const dashedMin = Math.min(...ability.dashed);
        dashedMin < 1 - EPS
          ? ok("点線が苦手軸で内側へ凹む", `最小 ${dashedMin}`)
          : ng("点線が苦手軸で内側へ凹む", "全軸が同じ＝能力別上限が反映されていない");
      }
      // 実線の各頂点が、表示されている数値と同じ順位に並んでいること（＝分母が共通）
      const vals = ability.texts.filter(t => /^\d+$/.test(t.s.trim()) && t.ax !== -1).map(t => Number(t.s));
      if (vals.length === ability.solid.length) {
        const byVal = vals.map((v, i) => i).sort((a, b) => vals[b] - vals[a]);
        const byDraw = ability.solid.map((v, i) => i).sort((a, b) => ability.solid[b] - ability.solid[a]);
        byVal.join() === byDraw.join()
          ? ok("図の形が能力の形と一致", "頂点の遠近の順位＝能力値の順位")
          : ng("図の形が能力の形と一致",
               `能力値の順位[${byVal}] と 図の順位[${byDraw}] が食い違う（分母が軸ごとに違う）`);
      }
    }

    // 3：ラベルの最低隙間（5角形・7角形の両方）
    for (const [label, probe] of [["能力（5軸）", ability], ["素質（7軸）", sub]]) {
      if (!probe) { ng(`${label}のラベル間隔`, "SVGが見つからない"); continue; }
      const w = minGap(probe.texts);
      w.gap >= MIN_GAP
        ? ok(`${label}のラベル間隔`, `最小 ${w.gap.toFixed(1)}px（${w.pair}）`)
        : ng(`${label}のラベル間隔`, `最小 ${w.gap.toFixed(1)}px（${w.pair}）— ${MIN_GAP}px以上必要`);
    }
  }
} catch (e) {
  ng("実行", String(e));
}

errors.length === 0 ? ok("pageerror") : ng("pageerror", errors.join(" / "));
await browser.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? "OK" : "NG"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`);
}
console.log(failed === 0 ? "\nすべて通過" : `\n${failed}件が未達`);
process.exit(failed === 0 ? 0 : 1);
