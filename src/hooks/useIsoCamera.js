// BaseView（敷地画面）のカメラ操作。Step13 Wave E-1。
// domain/season/camera.js の純粋計算に、ポインタ／ホイールのジェスチャ処理と
// React state を薄く接続するだけのフック（Step7で確立した controllers/hooks の分担を踏襲）。
//
// 対応操作：1本指ドラッグ＝パン／2本指ピンチ＝ズーム＋パン／ホイール＝カーソル位置基準のズーム。
// ドラッグ距離がしきい値未満のポインタ操作は「タップ」として onTap に通知する
// （Wave E-2で部屋タップ→対応メニューを開くのに使う）。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fitScale, coverScale, clampCam, cameraTransform, zoomAbout, viewToScene } from "../domain/season/camera.js";

const TAP_SLOP = 8;      // これ未満の移動はタップ扱い（px）
const MAX_ZOOM_MUL = 3;  // 下限(fit)に対する上限倍率

export function useIsoCamera({ bounds, viewW, viewH, onTap }) {
  const [cam, setCam] = useState(null);   // {x,y} scene座標のカメラ中心
  const [k, setK] = useState(null);       // 倍率
  const ptrs = useRef(new Map());         // pointerId -> {x,y}
  const pinch = useRef(null);             // {dist, cx, cy}
  const moved = useRef(0);                // 直近ジェスチャの累積移動量

  const limits = useMemo(() => {
    const min = fitScale(bounds, viewW, viewH);
    return { min, max: min * MAX_ZOOM_MUL, initial: Math.min(coverScale(bounds, viewW, viewH), min * MAX_ZOOM_MUL) };
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

  const localPoint = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, localPoint(e));
    if (ptrs.current.size === 1) moved.current = 0;
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  }, []);

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
    const p = localPoint(e);
    applyZoom(k * Math.pow(1.0015, -e.deltaY), p.x, p.y);
  }, [k, applyZoom]);

  const ready = cam != null && k != null && !!viewW && !!viewH;
  return {
    ready,
    zoom: k,
    limits,
    transform: ready ? cameraTransform(cam, k, viewW, viewH) : "",
    zoomBy: (mul) => applyZoom((k || 1) * mul, viewW / 2, viewH / 2),
    reset: () => { setK(limits.initial); setCam(clampCam({ x: bounds.cx, y: bounds.cy }, limits.initial, bounds, viewW, viewH)); },
    handlers: { onPointerDown, onPointerMove, onPointerUp: endPointer, onPointerCancel: endPointer, onWheel },
  };
}
