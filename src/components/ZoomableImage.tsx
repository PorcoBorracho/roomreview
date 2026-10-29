"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

export type ZoomHandle = { zoomIn: () => void; zoomOut: () => void; reset: () => void };

type Props = {
  src: string;
  alt: string;
  /** Clases del <img> en reposo (tamaño máximo, bordes…). */
  imgClassName?: string;
  className?: string;
  maxScale?: number;
  showControls?: boolean;
  controlsClassName?: string;
  /** Clic en el fondo (no en la foto) sin haber arrastrado. */
  onBackgroundClick?: () => void;
  onZoomChange?: (zoomed: boolean) => void;
  /** En móvil, deja desplazar la página en vertical mientras no haya zoom. */
  allowPageScroll?: boolean;
};

const MIN = 1;
const STEP = 1.5;
const DOUBLE_CLICK_SCALE = 2.5;

/**
 * Foto con zoom:
 *  - rueda del ratón / pellizco en trackpad → zoom hacia el cursor
 *  - pellizco con dos dedos en móvil
 *  - doble clic / doble toque → acercar ×2,5 o volver a ajustar
 *  - arrastrar para moverse cuando hay zoom
 */
const ZoomableImage = forwardRef<ZoomHandle, Props>(function ZoomableImage(
  { src, alt, imgClassName = "", className = "", maxScale = 6, showControls = true, controlsClassName = "", onBackgroundClick, onZoomChange, allowPageScroll = false },
  ref,
) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const [gesturing, setGesturing] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mx: number; my: number } | null>(null);
  const moved = useRef(false);

  const clamp = useCallback((s: number, x: number, y: number) => {
    const box = boxRef.current, img = imgRef.current;
    if (!box || !img || s <= MIN) return { s: MIN, x: 0, y: 0 };
    // offsetWidth/Height no incluyen el transform: es el tamaño "ajustado" de la foto
    const maxX = Math.max(0, (img.offsetWidth * s - box.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * s - box.clientHeight) / 2);
    return { s, x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }, []);

  /** Zoom manteniendo fijo el punto (clientX, clientY) bajo el cursor. */
  const zoomAt = useCallback((cx: number, cy: number, target: number) => {
    const box = boxRef.current;
    if (!box) return;
    const v = viewRef.current;
    const s = Math.min(maxScale, Math.max(MIN, target));
    const r = box.getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2);
    const dy = cy - (r.top + r.height / 2);
    const k = s / v.s;
    setView(clamp(s, dx - (dx - v.x) * k, dy - (dy - v.y) * k));
  }, [clamp, maxScale]);

  const zoomCenter = useCallback((target: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, target);
  }, [zoomAt]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => zoomCenter(viewRef.current.s * STEP),
    zoomOut: () => zoomCenter(viewRef.current.s / STEP),
    reset: () => setView({ s: 1, x: 0, y: 0 }),
  }), [zoomCenter]);

  // Volver a ajustar al cambiar de foto
  useEffect(() => { setView({ s: 1, x: 0, y: 0 }); }, [src]);

  const zoomed = view.s > 1.001;
  useEffect(() => { onZoomChange?.(zoomed); }, [zoomed, onZoomChange]);

  // La rueda necesita un listener no pasivo para poder bloquear el scroll de la página
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : 1;
      const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0018));
      zoomAt(e.clientX, e.clientY, viewRef.current.s * factor);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Reajustar límites si cambia el tamaño de la ventana
  useEffect(() => {
    const onResize = () => setView((v) => clamp(v.s, v.x, v.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
    setGesturing(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) > 2) moved.current = true;

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const p = pinch.current;
      // desplazar con el punto medio y escalar hacia él
      const v = viewRef.current;
      viewRef.current = clamp(v.s, v.x + (mx - p.mx), v.y + (my - p.my));
      zoomAt(mx, my, viewRef.current.s * (dist / p.dist));
      pinch.current = { dist, mx, my };
    } else if (pointers.current.size === 1 && viewRef.current.s > 1) {
      const v = viewRef.current;
      setView(clamp(v.s, v.x + (cur.x - prev.x), v.y + (cur.y - prev.y)));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) setGesturing(false);
  }

  function onDoubleClick(e: React.MouseEvent) {
    if (viewRef.current.s > 1.001) setView({ s: 1, x: 0, y: 0 });
    else zoomAt(e.clientX, e.clientY, DOUBLE_CLICK_SCALE);
  }

  function onClick(e: React.MouseEvent) {
    if (moved.current) return;
    if (e.target !== e.currentTarget || zoomed || !onBackgroundClick) return;
    // La foto no recibe eventos (pointer-events: none): comprobamos si el clic cae dentro de ella
    const r = imgRef.current?.getBoundingClientRect();
    const onPhoto = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!onPhoto) onBackgroundClick();
  }

  const pct = Math.round(view.s * 100);

  return (
    <div
      ref={boxRef}
      className={`flex select-none items-center justify-center overflow-hidden ${
        zoomed ? (gesturing ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"} ${className}`}
      style={{ touchAction: zoomed || !allowPageScroll ? "none" : "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        className={`zoom-img pointer-events-none ${imgClassName}`}
        data-gesturing={gesturing}
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})` }}
      />

      {showControls && (
        <div
          className={`absolute z-10 flex items-center rounded-xl border border-white/10 bg-black/70 p-1 text-white backdrop-blur-md ${controlsClassName}`}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => zoomCenter(view.s / STEP)} disabled={!zoomed} aria-label="Zoom out"
            className="pressable flex size-8 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-40">
            <Minus className="size-4" />
          </button>
          <button type="button" onClick={() => setView({ s: 1, x: 0, y: 0 })} aria-label="Reset zoom" title="Fit to screen"
            className="pressable h-8 min-w-14 rounded-lg px-1.5 text-xs font-semibold tabular-nums hover:bg-white/10">
            {pct}%
          </button>
          <button type="button" onClick={() => zoomCenter(view.s * STEP)} disabled={view.s >= maxScale} aria-label="Zoom in"
            className="pressable flex size-8 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-40">
            <Plus className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
});

export default ZoomableImage;
