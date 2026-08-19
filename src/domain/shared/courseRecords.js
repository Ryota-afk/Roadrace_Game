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
export function peekCourseRecord(kind, length, winnerTime, holder, isPlayer) {
  if (!kind || !winnerTime || winnerTime <= 0 || !length) return null;
  const speed = Math.round((length / winnerTime) * 100);
  const recs = loadCourseRecords();
  const prev = recs[kind] || null;
  const isNew = !prev || speed > prev.speed;
  return { kind, speed, isNew, prev, holder: holder || "—", isPlayer: !!isPlayer };
}

export function persistCourseRecord(courseRecord, year) {
  if (!courseRecord || !courseRecord.isNew) return;
  const recs = loadCourseRecords();
  recs[courseRecord.kind] = { speed: courseRecord.speed, holder: courseRecord.holder, isPlayer: courseRecord.isPlayer, year: year || 1 };
  saveCourseRecords(recs);
}
