// BaseView（敷地画面）のカメラ操作。Step13 Wave E-1。
// domain/season/camera.js の純粋計算に、ポインタ／ホイールのジェスチャ処理と
// React state を薄く接続するだけのフック（Step7で確立した controllers/hooks の分担を踏襲）。
//
// 対応操作：1本指ドラッグ＝パン／2本指ピンチ＝ズーム＋パン／ホイール＝カーソル位置基準のズーム。
// ドラッグ距離がしきい値未満のポインタ操作は「タップ」として onTap に通知する
// （Wave E-2で部屋タップ→対応メニューを開くのに使う）。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fitScale, coverScale, clampCam, cameraTransform, zoomAbout, viewToScene } from "../domain/season/camera.js";

const TAP_SLOP = 8;         // これ未満の移動はタップ扱い（px）
const MAX_ZOOM_MUL = 3;     // 下限(fit)に対する上限倍率の基準値
const COVER_HEADROOM = 1.3; // 上限(max)がcoverよりどれだけ大きい余地を持つか
// 22b: ズームボタン・リセットの補間時間（2026-08ユーザー合意：160ms・easeOutCubic・
// 連打は目標を積み上げ・手動操作（ドラッグ/ピンチ/ホイール）開始で即中断）。
// ホイール・ピンチは連続入力なので補間しない（挟むと遅延に感じる）。
const ZOOM_ANIM_MS = 160;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export function useIsoCamera({ bounds, viewW, viewH, onTap }) {
  const [cam, setCam] = useState(null);   // {x,y} scene座標のカメラ中心
  const [k, setK] = useState(null);       // 倍率
  const ptrs = useRef(new Map());         // pointerId -> {x,y}
  const pinch = useRef(null);             // {dist, cx, cy}
  const moved = useRef(0);                // 直近ジェスチャの累積移動量
  // 22b: アニメーション用。kRef/camRefはコールバック内から最新値を読むための鏡。
  const kRef = useRef(null); kRef.current = k;
  const camRef = useRef(null); camRef.current = cam;
  const animRef = useRef(null);           // { raf, toK } 実行中のズーム補間

  const limits = useMemo(() => {
    const min = fitScale(bounds, viewW, viewH);
    const cover = coverScale(bounds, viewW, viewH);
    // 上限は必ずcover以上（さらに少し寄れる余地＝COVER_HEADROOM）を確保する。
    const max = Math.max(min * MAX_ZOOM_MUL, cover * COVER_HEADROOM);
    // 初期表示はfit（＝全体が画面に収まる倍率）にする。Wave E-2 redoでクラブハウス＋
    // コースを横並びにしたところ、内容の縦横比(約1.95)がスマホ縦長画面(約0.52)と
    // 大きく異なり、cover（画面を隙間なく覆う倍率）を初期値にすると内容の横幅の大部分が
    // 画面外に押し出され、クラブハウスかコースのどちらかが最初は見えない状態になって
    // いた（実機のタップ検証で発覚：計算上のタップ座標がビューポート外に出ていた）。
    // 芝の下地はカメラの外側にあり倍率に関わらず必ず画面を埋めるため（Wave E-1）、
    // fitを初期値にしても黒い余白は出ない＝「最初から敷地全体を見せる」を安全に選べる。
    return { min, max, initial: min };
  }, [bounds, viewW, viewH]);

  // 画面サイズが決まったら初期化し、以後サイズが変わっても内容が画面外へ出ないよう再クランプする
  useEffect(() => {
    if (!viewW || !viewH) return;
    setK(prevK => {
      const nk = prevK == null ? limits.initial : Math.min(Math.max(prevK, limits.min), limits.max);
      setCam(prevCam => clampCam(prevCam || { x: bounds.cx, y: bounds.cy }, nk, bounds, viewW, viewH));
      return nk;
    });
  }, [bounds, viewW, viewH, limits]);

  const applyZoom = useCallback((nextKRaw, px, py) => {
    setK(curK => {
      if (curK == null) return curK;
      const nextK = Math.min(Math.max(nextKRaw, limits.min), limits.max);
      if (nextK === curK) return curK;
      setCam(curCam => clampCam(zoomAbout(curCam, curK, nextK, px, py, viewW, viewH), nextK, bounds, viewW, viewH));
      return nextK;
    });
  }, [bounds, viewW, viewH, limits]);

  // 22b: 実行中のズーム補間を中断する（手動操作の開始・アンマウント時）。
  const cancelAnim = useCallback(() => {
    if (animRef.current) { cancelAnimationFrame(animRef.current.raf); animRef.current = null; }
  }, []);
  useEffect(() => cancelAnim, [cancelAnim]);

  // 22b: 現在の倍率から目標倍率へ、画面中央アンカーで160ms補間する。
  // 毎フレーム「現在k→次フレームk」の中央アンカーzoomAboutを積むだけなので、
  // 既存のclampCam・限界値処理がそのまま効く（中央固定ズームの合成は中央固定のまま）。
  const startZoomAnim = useCallback((toK) => {
    cancelAnim();
    const fromK = kRef.current;
    if (fromK == null || Math.abs(toK - fromK) < 1e-6) return;
    const t0 = performance.now();
    const handle = { raf: 0, toK };
    animRef.current = handle;
    const step = (now) => {
      if (animRef.current !== handle) return;
      const p = Math.min(1, (now - t0) / ZOOM_ANIM_MS);
      const nk = fromK + (handle.toK - fromK) * easeOutCubic(p);
      setK(curK => {
        if (curK == null) return curK;
        setCam(curCam => clampCam(zoomAbout(curCam, curK, nk, viewW / 2, viewH / 2, viewW, viewH), nk, bounds, viewW, viewH));
        return nk;
      });
      if (p < 1) handle.raf = requestAnimationFrame(step);
      else animRef.current = null;
    };
    handle.raf = requestAnimationFrame(step);
  }, [bounds, viewW, viewH, cancelAnim]);

  // 22b: リセットは倍率と位置の両方を同じ160msで補間する。
  const startResetAnim = useCallback(() => {
    cancelAnim();
    const fromK = kRef.current, fromCam = camRef.current;
    if (fromK == null || !fromCam) return;
    const toK = limits.initial;
    const toCam = clampCam({ x: bounds.cx, y: bounds.cy }, toK, bounds, viewW, viewH);
    const t0 = performance.now();
    const handle = { raf: 0, toK };
    animRef.current = handle;
    const step = (now) => {
      if (animRef.current !== handle) return;
      const p = Math.min(1, (now - t0) / ZOOM_ANIM_MS);
      const e = easeOutCubic(p);
      const nk = fromK + (toK - fromK) * e;
      const nc = { x: fromCam.x + (toCam.x - fromCam.x) * e, y: fromCam.y + (toCam.y - fromCam.y) * e };
      setK(nk);
      setCam(clampCam(nc, nk, bounds, viewW, viewH));
      if (p < 1) handle.raf = requestAnimationFrame(step);
      else animRef.current = null;
    };
    handle.raf = requestAnimationFrame(step);
  }, [bounds, viewW, viewH, limits, cancelAnim]);

  const localPoint = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = useCallback((e) => {
    cancelAnim(); // 22b: 手動操作の開始で補間を即中断（ユーザーの手を最優先）
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, localPoint(e));
    if (ptrs.current.size === 1) moved.current = 0;
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  }, [cancelAnim]);

  const onPointerMove = useCallback((e) => {
    if (!ptrs.current.has(e.pointerId) || k == null) return;
    const prev = ptrs.current.get(e.pointerId);
    const cur = localPoint(e);
    ptrs.current.set(e.pointerId, cur);

    if (ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinch.current && pinch.current.dist > 0) applyZoom(k * (dist / pinch.current.dist), mid.x, mid.y);
      pinch.current = { dist };
      moved.current += TAP_SLOP + 1; // ピンチは常にタップ扱いしない
      return;
    }
    const dx = cur.x - prev.x, dy = cur.y - prev.y;
    moved.current += Math.hypot(dx, dy);
    setCam(c => (c ? clampCam({ x: c.x - dx / k, y: c.y - dy / k }, k, bounds, viewW, viewH) : c));
  }, [k, bounds, viewW, viewH, applyZoom]);

  const endPointer = useCallback((e) => {
    const was = ptrs.current.get(e.pointerId);
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (ptrs.current.size === 0 && was && moved.current < TAP_SLOP && onTap && k != null && cam) {
      onTap(viewToScene(was.x, was.y, cam, k, viewW, viewH));
    }
  }, [onTap, k, cam, viewW, viewH]);

  const onWheel = useCallback((e) => {
    if (k == null) return;
    e.preventDefault();
    cancelAnim(); // 22b: ホイールは即時ズーム（補間中なら中断して手動を優先）
    const p = localPoint(e);
    applyZoom(k * Math.pow(1.0015, -e.deltaY), p.x, p.y);
  }, [k, applyZoom, cancelAnim]);

  const ready = cam != null && k != null && !!viewW && !!viewH;
  return {
    ready,
    zoom: k,
    limits,
    transform: ready ? cameraTransform(cam, k, viewW, viewH) : "",
    // 22b: ボタンズームは160ms補間。連打はアニメーション中の目標倍率に積み上げて
    // 滑らかに再目標化する（1回ずつ完了を待たされない）。
    zoomBy: (mul) => {
      const base = animRef.current ? animRef.current.toK : (kRef.current || 1);
      startZoomAnim(Math.min(Math.max(base * mul, limits.min), limits.max));
    },
    reset: startResetAnim,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endPointer, onPointerCancel: endPointer, onWheel },
  };
}
