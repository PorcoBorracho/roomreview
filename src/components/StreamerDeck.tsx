"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Maximize2, Tv2, RefreshCw, MapPin, EyeOff, Eye, ShieldAlert } from "lucide-react";
import type { DeckSubmission } from "@/lib/types";
import Lightbox from "./Lightbox";
import ZoomableImage, { type ZoomHandle } from "./ZoomableImage";

const wrap = (i: number, n: number) => (n === 0 ? 0 : ((i % n) + n) % n);

export default function StreamerDeck({ submissions }: { submissions: DeckSubmission[] }) {
  const router = useRouter();
  const [subIdx, setSubIdx] = useState(0);
  const [mediaIdx, setMediaIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const zoom = useRef<ZoomHandle>(null);
  const [blurred, setBlurred] = useState(false);

  const n = submissions.length;
  const s = wrap(subIdx, n);
  const sub = n > 0 ? submissions[s] : null;
  const m = sub?.media.length ?? 0;
  const mi = wrap(mediaIdx, m);
  const media = sub && m > 0 ? sub.media[mi] : null;

  const changeSub = useCallback((d: number) => { setSubIdx((i) => i + d); setMediaIdx(0); }, []);
  const changeMedia = useCallback((d: number) => setMediaIdx((i) => i + d), []);

  // Las URLs firmadas caducan: refrescamos los datos cada 30 min
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [router]);
  useEffect(() => setRefreshing(false), [submissions]);

  // Atajos: ← → fotos, ↑ ↓ entregas, F pantalla completa. Sin animación: se usan muchas veces.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // B funciona también a pantalla completa: es la tecla de emergencia de privacidad
      if (e.key.toLowerCase() === "b") { setBlurred((v) => !v); return; }
      if (fullscreen) return;
      if (e.key === "ArrowRight") changeMedia(1);
      else if (e.key === "ArrowLeft") changeMedia(-1);
      else if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); changeSub(1); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); changeSub(-1); }
      else if (e.key.toLowerCase() === "f" && media) setFullscreen(true);
      else if (e.key === "+" || e.key === "=") zoom.current?.zoomIn();
      else if (e.key === "-" || e.key === "_") zoom.current?.zoomOut();
      else if (e.key === "0") zoom.current?.reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, media, changeMedia, changeSub]);

  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Review deck</h2>
          <p className="mt-1 text-sm text-muted">Approved rooms, oldest first.</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => { setRefreshing(true); router.refresh(); }} aria-label="Reload approved submissions" title="Reload"
            className="pressable flex size-10 items-center justify-center rounded-xl border border-line text-muted hover:border-line-strong hover:text-white">
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <div className="flex h-10 items-center rounded-xl border border-line bg-well p-1">
            <button onClick={() => changeSub(-1)} disabled={n < 2} aria-label="Previous submission"
              className="pressable flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold text-muted hover:bg-raised hover:text-white disabled:opacity-40">
              <ChevronLeft className="size-4" /><span className="hidden sm:inline">Prev</span>
            </button>
            <span className="min-w-[4.5rem] px-2 text-center text-[13px] font-semibold tabular-nums text-white" aria-live="polite">
              {n ? s + 1 : 0} <span className="font-normal text-subtle">of</span> {n}
            </span>
            <button onClick={() => changeSub(1)} disabled={n < 2} aria-label="Next submission"
              className="pressable flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold text-muted hover:bg-raised hover:text-white disabled:opacity-40">
              <span className="hidden sm:inline">Next</span><ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-subtle">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-text" />
        Check each photo before showing it. If you spot a face, name, address, screen or anything personal, press <Kbd>B</Kbd> to blur it instantly and skip it.
      </p>

      {!sub || !media ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line px-6 py-24 text-center">
          <Tv2 className="mx-auto size-9 text-subtle" />
          <h3 className="mt-3 text-base font-semibold text-white">No approved rooms yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Rooms appear here once a moderator approves them. Use reload to check for new ones.</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col overflow-hidden rounded-3xl border border-line bg-black shadow-float lg:min-h-[72vh] lg:flex-row">
          <div className={`relative flex min-h-[55vh] flex-1 items-center justify-center bg-stage p-3 sm:p-5 ${blurred ? "privacy-blur" : ""}`}>
            <span className="pointer-events-none absolute top-4 left-4 z-10 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-semibold tabular-nums text-highlight backdrop-blur-md">
              Photo {mi + 1} / {m}
            </span>

            <ZoomableImage
              ref={zoom}
              src={media.url}
              alt={`Room of @${sub.username}, photo ${mi + 1}`}
              className="absolute inset-0"
              imgClassName="max-h-[calc(100%-2.5rem)] max-w-[calc(100%-2.5rem)] rounded-xl object-contain"
              controlsClassName="bottom-4 left-4"
              allowPageScroll
            />

            {m > 1 && (
              <>
                <button onClick={() => changeMedia(-1)} aria-label="Previous photo"
                  className="pressable absolute top-1/2 left-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-black/70 text-white backdrop-blur-md hover:bg-accent hover:text-on-accent">
                  <ChevronLeft className="size-5" />
                </button>
                <button onClick={() => changeMedia(1)} aria-label="Next photo"
                  className="pressable absolute top-1/2 right-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-black/70 text-white backdrop-blur-md hover:bg-accent hover:text-on-accent">
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}

            <button onClick={() => setBlurred((v) => !v)} aria-pressed={blurred}
              className={`pressable absolute right-36 bottom-4 z-10 flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold backdrop-blur-md ${
                blurred ? "border-warning/60 bg-warning text-black" : "border-white/10 bg-black/70 text-white hover:bg-white/15"}`}>
              {blurred ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />} {blurred ? "Unblur" : "Blur"}
            </button>
            <button onClick={() => setFullscreen(true)}
              className="pressable absolute right-4 bottom-4 flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-black/70 px-3 text-[13px] font-semibold text-white backdrop-blur-md hover:bg-accent hover:text-on-accent">
              <Maximize2 className="size-3.5" /> Fullscreen
            </button>
          </div>

          <aside className="flex w-full flex-col border-t border-line bg-panel lg:w-[380px] lg:border-t-0 lg:border-l">
            <div className="border-b border-line p-6">
              <p className="text-sm tabular-nums text-subtle">#{s + 1}</p>
              <h3 className="mt-1 font-mono text-2xl font-bold tracking-tight break-all text-white">@{sub.username}</h3>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                <MapPin className="size-4 text-accent-text" /> {sub.country}
              </p>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6 lg:max-h-[46vh]">
              <div>
                <h4 className="text-xs font-semibold text-subtle">About the room</h4>
                <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line break-words text-ink">{sub.description}</p>
              </div>
              {m > 1 && (
                <div>
                  <h4 className="text-xs font-semibold text-subtle">Photos</h4>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {sub.media.map((item, i) => (
                      <button key={item.id} onClick={() => setMediaIdx(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === mi}
                        className={`pressable size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-black ${
                          i === mi ? "border-highlight" : "border-transparent opacity-55 hover:opacity-100"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt="" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line px-6 py-4 text-xs text-subtle">
              <time className="whitespace-nowrap" dateTime={sub.submittedAt}>Sent {new Date(sub.submittedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</time>
              <span className="hidden items-center gap-1 lg:flex">
                <Kbd>←</Kbd><Kbd>→</Kbd> photos <Kbd>↑</Kbd><Kbd>↓</Kbd> rooms <Kbd>+</Kbd><Kbd>−</Kbd> zoom <Kbd>B</Kbd> blur <Kbd>F</Kbd>
              </span>
            </div>
          </aside>
        </div>
      )}

      <Lightbox
        blurred={blurred}
        url={fullscreen && media ? media.url : null}
        caption={sub ? `@${sub.username} · ${mi + 1} / ${m}` : undefined}
        onClose={() => setFullscreen(false)}
        onPrev={m > 1 ? () => changeMedia(-1) : undefined}
        onNext={m > 1 ? () => changeMedia(1) : undefined}
      />
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded-md border border-line bg-well px-1 py-0.5 font-sans text-[11px] text-muted">
      {children}
    </kbd>
  );
}
