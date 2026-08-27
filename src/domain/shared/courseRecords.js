// コースレコードの保存・照合（localStorage I/O＋純判定）。第13弾Phase0でlogic/support.jsから分離。

export const COURSE_REC_KEY = "roadrace_v12_course_records";

export function loadCourseRecords() {
  try { const raw = localStorage.getItem(COURSE_REC_KEY); const o = raw ? JSON.parse(raw) : {}; return (o && typeof o === "object") ? o : {}; } catch (e) { return {}; }
}

export function saveCourseRecords(recs) {
  try { localStorage.setItem(COURSE_REC_KEY, JSON.stringify(recs)); } catch (e) { /* noop */ }
}

// v41(§Step7第4弾): recordCourseResultは「判定（読み取り）」と「更新（書き込み）」を1関数に
// 同居させていたため、setG/setMlのupdater内で呼ぶと非冪等（updaterが複数回呼ばれるとprevが
// 既に更新済みになりisNewの値が呼び出しごとに変わる）だった。判定はreducerがUI表示用に同期的に
// 必要とするためpeekCourseRecordとして残し、書き込みはApp()側のuseEffectへ分離した
// （persistCourseRecord・詳細はDEVLOG §9参照）。
// 第60弾(devlog/wave60.md): 比較キー(speed＝内部指標)と表示(timeSec＝タイム)を分離した。
// 「13」のような無意味な数がそのまま画面に出ていた（コース距離÷勝者タイム×100）ため、
// 表示は誰でも読めるタイムに変える。比較キーはspeedのまま＝旧セーブと互換（speedが
// 無い記録は存在しないため、prev.speedとの比較は従来どおり機能する）。
export function peekCourseRecord(kind, length, winnerTime, holder, isPlayer) {
  if (!kind || !winnerTime || winnerTime <= 0 || !length) return null;
  const speed = Math.round((length / winnerTime) * 100);
  const recs = loadCourseRecords();
  const prev = recs[kind] || null;
  const isNew = !prev || speed > prev.speed;
  return { kind, speed, timeSec: winnerTime, isNew, prev, holder: holder || "—", isPlayer: !!isPlayer };
}

export function persistCourseRecord(courseRecord, year) {
  if (!courseRecord || !courseRecord.isNew) return;
  const recs = loadCourseRecords();
  recs[courseRecord.kind] = { speed: courseRecord.speed, timeSec: courseRecord.timeSec, holder: courseRecord.holder, isPlayer: courseRecord.isPlayer, year: year || 1 };
  saveCourseRecords(recs);
}
