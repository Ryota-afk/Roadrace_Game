// 第95弾 #31-A: 人間の通しプレイを計測するための開発者用テレメトリ。
// ⚠️既定はOFF。localStorageのフラグ（roadrace_telemetry_on）をtrueにした時だけ動く。
// 実プレイヤー・本番ビルドの挙動には一切影響しない（フラグを立てない限りlogEventは何もしない）。
// 使い方（ブラウザのdevtoolsコンソール）：
//   __telemetry.enable()   … 記録を開始（ページを開き直す必要はない）
//   （ゲームを普通に遊ぶ）
//   __telemetry.summary()  … 集計結果をコンソールに表示
//   __telemetry.exportText() … コピー用テキストを返す（コンソール上でコピーしてClaudeに渡す）
//   __telemetry.disable()  … 記録を止める（既存ログは残る）
//   __telemetry.clear()    … ログを消す

const FLAG_KEY = "roadrace_telemetry_on";
const LOG_KEY = "roadrace_telemetry_log_v1";
const MAX_EVENTS = 4000; // 古いものから間引く（長時間セッションでもlocalStorageを圧迫しない）

// 画面を大まかに分類する。#31-Aで見たいのは「実際にレースが動いている時間」対「それ以外」の比率。
const SCREEN_KIND = {
  mylife_race: "race", // レース観戦（判断カードもここで発火する）
  mylife_startlist: "race_prep",
  mylife_main: "hub", // 「今月、どうする？」の月次ハブ
  mylife_result: "reading",
  mylife_event_result: "reading",
  mylife_event: "reading",
  mylife_protege_event: "reading",
  mylife_rival_scene: "reading",
  mylife_offseason_result: "reading",
  mylife_offseason: "menu",
  mylife_newspaper: "reading",
  mylife_crossroads_result: "reading",
  mylife_crossroads: "menu",
  mylife_contract: "menu",
  mylife_badge_goals: "menu",
  mylife_retire_advice: "reading",
  mylife_retired: "reading",
  mylife_shop: "shop", // C群（経済ループ）の実測に必須の内訳
  mylife_create: "setup",
  mylife_scout: "setup",
  // 閲覧専用の画面（成績・図鑑・世界情報等）。プレイの主ループには入らないため一括りにする
  mylife_abilityfile: "menu", mylife_achievements: "menu", mylife_archive: "menu",
  mylife_factors: "menu", mylife_graph: "menu", mylife_help: "menu", mylife_legends: "menu",
  mylife_lineage: "menu", mylife_records: "menu", mylife_rider: "menu", mylife_riderstats: "menu",
  mylife_world: "menu", mylife_worldstats: "menu",
};

function isTelemetryOn() {
  try { return localStorage.getItem(FLAG_KEY) === "1"; } catch (e) { return false; }
}

function readLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function writeLog(events) {
  try {
    const trimmed = events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events;
    localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
  } catch (e) { /* 記録の失敗はゲームを止めない */ }
}

// type: "screen_enter" | "month_action" | "decision_shown" | "decision_choice"
export function logEvent(type, data) {
  if (!isTelemetryOn()) return;
  const events = readLog();
  events.push({ t: Date.now(), type, ...data });
  writeLog(events);
}

function enableTelemetry() {
  try { localStorage.setItem(FLAG_KEY, "1"); } catch (e) { /* noop */ }
  console.log("[telemetry] 記録を開始しました。普通に遊んでください。終わったら __telemetry.summary() を呼んでください。");
}
function disableTelemetry() {
  try { localStorage.removeItem(FLAG_KEY); } catch (e) { /* noop */ }
  console.log("[telemetry] 記録を止めました（既存ログは残っています）。");
}
function clearTelemetryLog() {
  try { localStorage.removeItem(LOG_KEY); } catch (e) { /* noop */ }
  console.log("[telemetry] ログを消しました。");
}
function dumpTelemetry() { return readLog(); }

function summarizeTelemetry() {
  const events = readLog();
  if (!events.length) { console.log("[telemetry] ログが空です。__telemetry.enable() してから遊んでください。"); return null; }
  const t0 = events[0].t, t1 = events[events.length - 1].t;
  const totalMs = t1 - t0;

  // 画面ごとの滞在時間: screen_enterイベントの連続する間隔を、直前の画面の滞在時間とみなす
  const screenEvents = events.filter(e => e.type === "screen_enter");
  const byScreen = {}; // screen -> {count, ms}
  const byKind = {}; // kind -> ms
  for (let i = 0; i < screenEvents.length; i++) {
    const cur = screenEvents[i];
    const next = screenEvents[i + 1];
    const dur = next ? next.t - cur.t : 0; // 最後の画面は終了時刻不明なので0扱い
    const s = byScreen[cur.screen] || { count: 0, ms: 0 };
    s.count++; s.ms += dur;
    byScreen[cur.screen] = s;
    const kind = SCREEN_KIND[cur.screen] || "other";
    byKind[kind] = (byKind[kind] || 0) + dur;
  }

  const monthActions = events.filter(e => e.type === "month_action");
  const actionCounts = {};
  monthActions.forEach(e => { actionCounts[e.action] = (actionCounts[e.action] || 0) + 1; });

  const shown = events.filter(e => e.type === "decision_shown");
  const chosen = events.filter(e => e.type === "decision_choice");
  const choiceCounts = {}; // "kind/move" -> count
  chosen.forEach(e => { const k = `${e.kind}/${e.move}`; choiceCounts[k] = (choiceCounts[k] || 0) + 1; });

  const raceMs = byKind.race || 0;
  const summary = {
    totalMs, totalMin: +(totalMs / 60000).toFixed(1),
    byScreen: Object.fromEntries(Object.entries(byScreen).map(([k, v]) => [k, { count: v.count, min: +(v.ms / 60000).toFixed(2) }])),
    byKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, +(v / 60000).toFixed(2)])),
    raceTimeShare: totalMs ? +(raceMs / totalMs * 100).toFixed(1) : 0,
    monthActionCounts: actionCounts,
    monthCount: monthActions.length,
    decisionShown: shown.length,
    decisionChosen: chosen.length,
    choiceCounts,
  };
  console.log("[telemetry] 集計結果:", summary);
  return summary;
}

function exportTelemetryText() {
  const s = summarizeTelemetry();
  const events = readLog();
  if (!s) return "";
  const lines = [];
  lines.push(`# テレメトリ（#31-A）— ${new Date(events[0].t).toISOString()} 〜 ${new Date(events[events.length - 1].t).toISOString()}`);
  lines.push(`合計プレイ時間: ${s.totalMin}分（${s.monthCount}か月ぶん）`);
  lines.push(`レース観戦の時間比率: ${s.raceTimeShare}%`);
  lines.push(`種別ごとの滞在時間(分): ${JSON.stringify(s.byKind)}`);
  lines.push(`画面ごとの訪問回数・滞在時間(分): ${JSON.stringify(s.byScreen)}`);
  lines.push(`月次アクションの内訳: ${JSON.stringify(s.monthActionCounts)}`);
  lines.push(`判断カード: 表示${s.decisionShown}回・選択${s.decisionChosen}回`);
  lines.push(`選んだ一手の内訳: ${JSON.stringify(s.choiceCounts)}`);
  lines.push("");
  lines.push("## 生ログ（JSON）");
  lines.push(JSON.stringify(events));
  const text = lines.join("\n");
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => console.log("[telemetry] クリップボードにコピーしました。貼り付けてください。"),
      () => console.log("[telemetry] クリップボードへのコピーに失敗しました。戻り値のテキストを使ってください。"),
    );
  }
  return text;
}

if (typeof window !== "undefined") {
  window.__telemetry = {
    enable: enableTelemetry,
    disable: disableTelemetry,
    clear: clearTelemetryLog,
    dump: dumpTelemetry,
    summary: summarizeTelemetry,
    exportText: exportTelemetryText,
  };
}
