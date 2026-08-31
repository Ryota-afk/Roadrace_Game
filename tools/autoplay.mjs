// マイライフを自動で通しプレイし、毎月の人気度・資金・年俸・クラスを記録するハーネス。
// バランスの実測（CLAUDE.md §10）はこれが無いと測れない——レース1本が実時間で約20分
// かかるため、1キャリア（約40年＝480ヶ月）を人力で通すのは現実的でない。
//
// 【使い方】
//   npm run dev            # 別のシェルで開発サーバを起動しておく
//   node tools/autoplay.mjs --port 5173 --out /tmp/autoplay
//   tail -f /tmp/autoplay/log.txt   # 実行中でも進捗が読める（月ごとに追記される）
//
// 【設計の要点：破壊的な操作を絶対に押さない】
// ⚠️旧版は「押してはいけないボタンを文言で列挙してブロック」していたため、
// 「ラストレースで引退」「出走する（その確認ボタン）」が漏れ、何歳でも引退できてしまった
// （第89弾。同じ漏れを3回繰り返した）。⚠️**文言は増えるたびに漏れるので、構造＝色で判定する**：
//   - 確認ダイアログの確定ボタン = background: T.color.bad
//   - 危険なメニュー項目         = color:      T.color.bad
//   - 確認ダイアログのキャンセル = 「やめる」（常にこれを押す＝破壊的操作は一切承認しない）
// 色で判別できない脱出系（タイトルに戻る等）だけを BLOCK_TEXT で塞ぐ。
//
// 【設計の要点：シンクを実際に使う】
// ⚠️第89弾の計測は主ボタンしか押さずショップへ一度も寄らなかったため、⚠️**資金について
// 逆の結論（「資金が余る」）を出した**。2ヶ月に一度ショップへ寄り、開始・追加投資・完成の
// ボタンを押す。⚠️押せる中で常に最大額を選ぶため、これは「使えるだけ使う」極端側の計測である。
//
// 【履歴】第89弾で作り直し／第90弾でシンク操作を追加／第92弾で tools/ へ移して引数化。
//   それ以前の w90_play.mjs・w91_play.mjs・w92_play.mjs はこのファイルに統合済み。
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const OUT = arg("--out", process.env.AUTOPLAY_OUT || path.join(os.tmpdir(), "roadrace-autoplay"));
const PORT = arg("--port", process.env.AUTOPLAY_PORT || "5173");
const MAX_STEPS = Number(arg("--steps", "4000"));
fs.mkdirSync(OUT, { recursive: true });

const ACTION = "rgb(167, 106, 220)";   // T.color.action（主ボタン・選択中）
const BAD    = "rgb(192, 85, 77)";     // T.color.bad（破壊的操作）
const BLOCK_TEXT = /タイトルに戻る|モード選択に戻る|監督として新チームを率いる|新たな選手でキャリアを始める/;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errors = [];
page.on("pageerror", e => errors.push(`[pageerror] ${e.message}`));
page.on("console", m => { const t = m.text(); if (m.type() === "error" && !/404|same key|createRoot/.test(t)) errors.push(`[console] ${t}`); });
await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(900);
await page.locator("button").nth(0).click(); await page.waitForTimeout(700);

const probe = () => page.evaluate(([A, B]) => {
  const btns = [...document.querySelectorAll("button")].map((b, i) => {
    const s = getComputedStyle(b), w = b.getBoundingClientRect().width;
    return { i, text: (b.innerText||"").trim().replace(/\s+/g," ").slice(0,40),
      primary: s.backgroundColor === A && w >= 300, wide: w >= 300,
      destructive: s.backgroundColor === B || s.color === B, disabled: b.disabled };
  });
  let sv = null; try { const r = localStorage.getItem("roadrace_v12_mylife_save"); if (r) sv = JSON.parse(r).state; } catch {}
  const body = (document.body.innerText||"").replace(/\s+/g," ");
  return { btns, screen: sv?.screen ?? null, year: sv?.year ?? null, month: sv?.month ?? null,
    age: sv?.player?.age ?? null, pop: sv?.player?.popularity ?? null, wr: sv?.worldRank ?? null,
    money: sv?.money ?? null, cls: sv?.classIdx ?? null, salary: sv?.salary ?? null,
    // 「あなたのチーム」はシーズンの既定チーム名＝マイライフには絶対に出ない
    isSeason: body.includes("あなたのチーム"), inShop: body.includes("所持金") && body.includes("消耗品"),
    head: body.slice(0,70) };
}, [ACTION, BAD]);

const MON = ["4月","5月","6月","7月","8月","9月","10月","11月","12月","1月","2月","3月"];
const log = [], hist = [];
// 実行が数十分に及ぶので、月が変わるたびにファイルへ流す（終了時まとめ書きだと途中経過が読めない）
const flush = () => fs.writeFileSync(`${OUT}/log.txt`, log.join("\n"));
let lastKey = null, lastSig = "", stuck = 0, step = 0, waitPolls = 0, sinkClicks = 0, lastShopKey = null;
for (; step < MAX_STEPS; step++) {
  const st = await probe();
  if (st.isSeason) {
    log.push(`!!! step${step} シーズンモードへ遷移。直前のクリック（新しい順）:`);
    hist.slice(-12).reverse().forEach((h,k)=>log.push(`   -${k+1} [${h.screen}] "${h.text}"`));
    await page.screenshot({path:`${OUT}/season_${step}.png`}); break;
  }
  if (st.inShop) {
    const b = (re) => st.btns.find(x => !x.disabled && !x.destructive && re.test(x.text));
    const act = b(/^完成させる$/) || b(/^結果を見る$/) || b(/^\+500万$/) || b(/^\+800万$/)
      || b(/万で始める$/) || b(/万で実施$/);
    if (act) { sinkClicks++; await page.locator("button").nth(act.i).click({timeout:3000}).catch(()=>{}); await page.waitForTimeout(200); continue; }
    const back = st.btns.find(x => !x.disabled && x.text === "← 戻る");
    if (back) { await page.locator("button").nth(back.i).click({timeout:3000}).catch(()=>{}); await page.waitForTimeout(200); continue; }
  }
  // 数ヶ月に一度ショップへ寄る（月の行動は消費しないので進行を妨げない）
  if (!st.inShop && st.screen === "mylife_main" && st.month != null && st.month % 2 === 0 && lastShopKey !== `${st.year}-${st.month}`) {
    const shop = st.btns.find(x => !x.disabled && x.text === "ショップ");
    if (shop) { lastShopKey = `${st.year}-${st.month}`; await page.locator("button").nth(shop.i).click({timeout:3000}).catch(()=>{}); await page.waitForTimeout(250);
      const tab = (await probe()).btns.find(x => /消耗品/.test(x.text));
      if (tab) { await page.locator("button").nth(tab.i).click({timeout:3000}).catch(()=>{}); await page.waitForTimeout(200); }
      continue; }
  }
  const key = `${st.year}-${st.month}`;
  if (st.year != null && key !== lastKey) {
    log.push(`${st.year}年目${MON[st.month]} ${st.age}歳 人気${(st.pop??0).toFixed(1)} 世界${st.wr??"-"}位 資金${st.money} 年俸${st.salary} クラス${st.cls} step${step}`);
    lastKey = key; flush();
  }
  if (st.screen === "mylife_retired") { log.push(`\n>>> 引退到達 step${step}`); break; }

  // 確認ダイアログが開いていたら必ず「やめる」＝破壊的操作は承認しない
  const cancel = st.btns.find(b => !b.disabled && b.text === "やめる");
  if (cancel) { await page.locator("button").nth(cancel.i).click({timeout:3000}).catch(()=>{}); await page.waitForTimeout(200); continue; }

  if (/中継|残り\d+%/.test(st.head)) {
    const sk = st.btns.find(b => !b.disabled && /^スキップ$/.test(b.text))
      || st.btns.find(b => !b.disabled && b.primary && !b.destructive);
    if (sk) { await page.locator("button").nth(sk.i).click({timeout:3000}).catch(()=>{}); await page.waitForTimeout(400); waitPolls=0; continue; }
    if (++waitPolls > 60) { log.push(`!!! step${step} レースが終わらない`); break; }
    await page.waitForTimeout(500); continue;
  }
  const cand = st.btns.filter(b => !b.disabled && b.text && !b.destructive && !BLOCK_TEXT.test(b.text));
  const target = cand.find(b => b.primary) || cand.find(b => b.wide) || cand[0];
  if (!target) { if (++waitPolls > 90) { log.push(`!!! step${step} 操作可能にならない [${st.screen}] ${st.head}`); break; } await page.waitForTimeout(1000); continue; }
  waitPolls = 0;

  const sig = `${st.screen}|${st.btns.map(b=>b.text).join("|")}`;
  stuck = (sig === lastSig) ? stuck+1 : 0; lastSig = sig;
  if (stuck > 20) { log.push(`!!! step${step} 進行停止 [${st.screen}] "${target.text}" | ${st.head}`); await page.screenshot({path:`${OUT}/loop_${step}.png`}); break; }

  hist.push({ screen: st.screen, text: target.text });
  await page.locator("button").nth(target.i).click({timeout:3000}).catch(()=>{});
  await page.waitForTimeout(/レース|挑む|始める|出場|トライアル/.test(target.text) ? 2000 : 170);
}
const st = await probe();
log.push(`シンク操作 ${sinkClicks}回`);
log.push(`\n=== step=${step} 到達=${st.year}年目 ${st.age}歳 資金${st.money} 年俸${st.salary} 人気${(st.pop??0).toFixed(1)} ===`);
// エラーもログへ残す（以前は標準出力にしか出しておらず、実行を見ていないと失われていた）
log.push(`\n=== エラー ${errors.length}件 ===`);
[...new Set(errors)].slice(0, 10).forEach(e => log.push(` - ${e}`));
flush();
console.log(log.join("\n"));
console.log(`\nログ: ${OUT}/log.txt`);
await browser.close();
