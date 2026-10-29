"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export default function Lightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url, onClose]);

  if (!url) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} aria-label="Close"
        className="absolute top-6 right-6 text-slate-300 hover:text-white p-2 rounded-xl bg-twitch-card border border-twitch-border z-10">
        <X className="w-6 h-6" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[85vw] object-contain rounded-2xl border border-white/20 shadow-2xl" />
    </div>
  );
}
