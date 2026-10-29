"use client";

import { useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import ZoomableImage, { type ZoomHandle } from "./ZoomableImage";
import { useT } from "@/i18n/client";

type Props = {
  url: string | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  caption?: string;
  /** Difumina la foto (privacidad en directo) */
  blurred?: boolean;
};

export default function Lightbox({ url, onClose, onPrev, onNext, caption, blurred = false }: Props) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  const zoom = useRef<ZoomHandle>(null);
  const handlers = useRef({ onClose, onPrev, onNext });
  handlers.current = { onClose, onPrev, onNext };
  const isOpen = !!url;

  useEffect(() => {
    if (!isOpen) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      const h = handlers.current;
      if (e.key === "Escape") h.onClose();
      else if (e.key === "ArrowLeft" && h.onPrev) h.onPrev();
      else if (e.key === "ArrowRight" && h.onNext) h.onNext();
      else if (e.key === "+" || e.key === "=") zoom.current?.zoomIn();
      else if (e.key === "-" || e.key === "_") zoom.current?.zoomOut();
      else if (e.key === "0") zoom.current?.reset();
      else return;
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      prevFocus?.focus();
    };
  }, [isOpen]);

  if (!url) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={caption ?? t.lightbox.photo} className={`enter-fade fixed inset-0 z-50 bg-black/95 ${blurred ? "privacy-blur" : ""}`}>
      <ZoomableImage
        ref={zoom}
        src={url}
        alt={caption ?? ""}
        className="enter-zoom absolute inset-0"
        imgClassName="max-h-[92vh] max-w-[92vw] rounded-xl object-contain"
        controlsClassName="bottom-4 left-1/2 -translate-x-1/2"
        onBackgroundClick={onClose}
      />

      <button ref={closeRef} onClick={onClose} aria-label={t.common.close}
        className="pressable absolute top-4 right-4 z-10 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-black/60 text-white backdrop-blur-md hover:bg-white/10">
        <X className="size-5" />
      </button>
      {onPrev && (
        <button onClick={onPrev} aria-label={t.deck.prevPhoto}
          className="pressable absolute top-1/2 left-4 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-black/60 text-white backdrop-blur-md hover:bg-white/10">
          <ChevronLeft className="size-5" />
        </button>
      )}
      {onNext && (
        <button onClick={onNext} aria-label={t.deck.nextPhoto}
          className="pressable absolute top-1/2 right-4 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-black/60 text-white backdrop-blur-md hover:bg-white/10">
          <ChevronRight className="size-5" />
        </button>
      )}
      {caption && (
        <p className="pointer-events-none absolute top-5 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-black/60 px-3 py-1.5 text-sm font-medium tabular-nums text-white backdrop-blur-md">
          {caption}
        </p>
      )}
    </div>
  );
}
