// レース観戦の再生時刻(rt)からsimデータ（位置・展開モード・集団・タグ等）を読み取る純関数群
// （RaceView.jsxから分離。第14弾D）。JSXを持たない。
import { TICK_SEC } from "../../sim/race.js";

export function interpFrac(en, rt, course) {
  const idx = rt / TICK_SEC;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  const len = en.posHist.length;
  if (len === 0) return 0;
  let pos;
  if (en.finished && lo >= len - 1) {
    pos = course.length;
  } else if (!en.finished && lo >= len - 1) {
    // v46(#34修正): simがMAX_TICKSで打ち切られると、未完走者のposHistはそこで途切れるが
    // finishTimeは残り距離をlastOwnDistで割った外挿値になっている（sim/race.js末尾、
    // en.finishTime = MAX_TICKS*TICK_SEC + (remain/lastDist)*TICK_SEC）。従来はここで
    // a===b（両方とも最後のサンプルにクランプ）になり、rtがposHistの範囲を超えた瞬間から
    // 選手が完全に静止していた（倍速を上げても動かない・その場でぐるぐるする不具合の真因）。
    // 同じ外挿ペースでposを延長し、finishTimeの推定値にちょうど到達するようにする
    // （simを変更せず再生側だけで辻褄を合わせる）。posHistの長さ(len)はsimのMAX_TICKS定数と
    // 一致する（打ち切り時に配列がその長さまで埋まるため）ので、外挿の基準時刻はlenそのもの
    // （len-1ではない＝posHist[len-1]はtick=len-1時点の位置であり、finishTime計算はそこから
    // さらに1tick進んだ時点=lenを起点にしている）。ペースの下限もsim側の式(Math.max(0.2,…))と
    // 完全に一致させる（一致しないと外挿がfinishTimeちょうどでcourse.lengthに届かない）。
    const lastPos = en.posHist[len - 1];
    const pace = Math.max(0.2, en.lastOwnDist || 0.3);
    pos = Math.min(course.length, lastPos + (idx - len) * pace);
  } else {
    const a = en.posHist[Math.min(lo, len - 1)];
    const b = en.posHist[Math.min(hi, len - 1)];
    const t = idx - lo;
    pos = a + (b - a) * t;
  }
  return course.fracAtPos(pos);
}

export function modeAt(en, rt) {
  const idx = Math.min(en.modeHist.length - 1, Math.floor(rt / TICK_SEC));
  return idx >= 0 ? en.modeHist[idx] : "draft";
}

export function groupAt(en, rt) {
  const idx = Math.min(en.groupHist.length - 1, Math.floor(rt / TICK_SEC));
  return idx >= 0 ? en.groupHist[idx] : en.id;
}

// v39.20: 展開タグ（train/leadout/launch/front/peel）を再生時刻から引く
export function tagAt(en, rt) {
  const h = en.tagHist;
  if (!h || !h.length) return null;
  const idx = Math.min(h.length - 1, Math.floor(rt / TICK_SEC));
  return idx >= 0 ? h[idx] : null;
}

export function slotAt(en, rt) {
  const idx = Math.min((en.slotHist || []).length - 1, Math.floor(rt / TICK_SEC));
  return idx >= 0 ? (en.slotHist[idx] || 0) : 0;
}

// v47(第8弾A案): 「次に牽引」表示専用。slotが集団内の前後位置（能力・判断カード由来）を
// 表すようになったため、ローテ待ち順の情報はここへ分離した（詳細はDEVLOG §39参照）。
export function nextPullerAt(en, rt) {
  const idx = Math.min((en.nextPullerHist || []).length - 1, Math.floor(rt / TICK_SEC));
  return idx >= 0 ? !!en.nextPullerHist[idx] : false;
}

export function modeStreakAt(en, rt, mode, cap) {
  const idx = Math.min(en.modeHist.length - 1, Math.floor(rt / TICK_SEC));
  if (idx < 0 || en.modeHist[idx] !== mode) return 0;
  let n = 0;
  for (let i = idx; i >= 0 && i > idx - cap && en.modeHist[i] === mode; i--) n++;
  return n;
}

export function topLateral(course, frac) {
  return Math.sin(frac * Math.PI * course.f1 + course.ph1) * course.amp1 + Math.sin(frac * course.f2 + course.ph2) * course.amp2;
}
