"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Maximize2, Tv2, RefreshCw, MapPin, EyeOff, Eye, ShieldAlert } from "lucide-react";
import type { DeckSubmission } from "@/lib/types";
import Lightbox from "./Lightbox";
import Thumb from "./MediaThumb";
import ZoomableImage, { type ZoomHandle } from "./ZoomableImage";
import { useLocale, useT } from "@/i18n/client";
import { formatDate } from "@/i18n/config";

const wrap = (i: number, n: number) => (n === 0 ? 0 : ((i % n) + n) % n);

/** blurNew: cada review nueva empieza difuminada hasta que el streamer la descubre (ajuste del board) */
export default function StreamerDeck({ submissions, blurNew }: { submissions: DeckSubmission[]; blurNew: boolean }) {
  const t = useT();
  const d = t.deck;
  const locale = useLocale();
  const router = useRouter();
  const [subIdx, setSubIdx] = useState(0);
  const [mediaIdx, setMediaIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const zoom = useRef<ZoomHandle>(null);
  const [blurred, setBlurred] = useState(blurNew);

  const n = submissions.length;
  const s = wrap(subIdx, n);
  const sub = n > 0 ? submissions[s] : null;
  const m = sub?.media.length ?? 0;
  const mi = wrap(mediaIdx, m);
  const media = sub && m > 0 ? sub.media[mi] : null;

  // Al pasar a otra review, vuelve a empezar difuminada (si el board lo tiene activado)
  const changeSub = useCallback((d: number) => { setSubIdx((i) => i + d); setMediaIdx(0); setBlurred(blurNew); }, [blurNew]);
  const video = media?.kind === "video";
  const changeMedia = useCallback((d: number) => setMediaIdx((i) => i + d), []);

  // Las URLs firmadas caducan: refrescamos los datos cada 30 min
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 30 * 60 * 1000);
    return () => clearInterval(timer);
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
      else if (e.key.toLowerCase() === "f" && media && !video) setFullscreen(true);
      else if (e.key === "+" || e.key === "=") zoom.current?.zoomIn();
      else if (e.key === "-" || e.key === "_") zoom.current?.zoomOut();
      else if (e.key === "0") zoom.current?.reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, media, video, changeMedia, changeSub]);

  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">{d.title}</h1>
          <p className="mt-1 text-sm text-muted">{d.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => { setRefreshing(true); router.refresh(); }} aria-label={d.reload} title={d.reload}
            className="pressable flex size-10 items-center justify-center rounded-xl border border-line text-muted hover:border-line-strong hover:text-strong">
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <div className="flex h-10 items-center rounded-xl border border-line bg-well p-1">
            <button onClick={() => changeSub(-1)} disabled={n < 2} aria-label={d.prevSubmission}
              className="pressable flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold text-muted hover:bg-raised hover:text-strong disabled:opacity-40">
              <ChevronLeft className="size-4" /><span className="hidden sm:inline">{t.common.prev}</span>
            </button>
            <span className="min-w-[4.5rem] px-2 text-center text-[13px] font-semibold tabular-nums text-strong" aria-live="polite">
              {n ? s + 1 : 0} <span className="font-normal text-subtle">{t.common.of}</span> {n}
            </span>
            <button onClick={() => changeSub(1)} disabled={n < 2} aria-label={d.nextSubmission}
              className="pressable flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold text-muted hover:bg-raised hover:text-strong disabled:opacity-40">
              <span className="hidden sm:inline">{t.common.next}</span><ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-subtle">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-text" />
        <span>{blurNew ? d.reminderBlurred : d.reminder}</span>
      </p>

      {!sub || !media ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line px-6 py-24 text-center">
          <Tv2 className="mx-auto size-9 text-subtle" />
          <h3 className="mt-3 text-base font-semibold text-strong">{d.emptyTitle}</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{d.emptyText}</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col overflow-hidden rounded-3xl border border-line bg-black shadow-float lg:h-[calc(100dvh-15rem)] lg:min-h-[560px] lg:flex-row">
          <div className={`relative flex min-h-[55vh] flex-1 items-center justify-center bg-stage p-3 sm:p-5 lg:min-h-0 ${blurred ? "privacy-blur" : ""}`}>
            <span className="pointer-events-none absolute top-4 left-4 z-10 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur-md">
              {video ? d.video(mi + 1, m) : d.photo(mi + 1, m)}
            </span>

            {video ? (
              // Sin audio (se quita al enviar). key: al cambiar de vídeo empieza desde el principio
              <video key={media.id} src={media.url} controls playsInline muted preload="metadata" aria-label={d.alt(sub.username, mi + 1)}
                className="absolute inset-0 m-auto max-h-[calc(100%-5rem)] max-w-[calc(100%-2.5rem)] rounded-xl bg-black" />
            ) : (
              <ZoomableImage
                ref={zoom}
                src={media.url}
                alt={d.alt(sub.username, mi + 1)}
                className="absolute inset-0"
                imgClassName="max-h-[calc(100%-2.5rem)] max-w-[calc(100%-2.5rem)] rounded-xl object-contain"
                controlsClassName="bottom-4 left-4"
                allowPageScroll
              />
            )}

            {blurred && (
              // Cortina: un clic en cualquier parte de la foto la descubre
              <button onClick={() => setBlurred(false)}
                className="enter-fade absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 text-white">
                <span className="flex size-14 items-center justify-center rounded-full border border-white/20 bg-black/60 backdrop-blur-md">
                  <Eye className="size-6" />
                </span>
                <span className="rounded-lg bg-black/60 px-3 py-1.5 text-sm font-semibold backdrop-blur-md">{d.reveal}</span>
              </button>
            )}

            {m > 1 && (
              <>
                <button onClick={() => changeMedia(-1)} aria-label={d.prevPhoto}
                  className="pressable absolute top-1/2 left-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-black/70 text-white backdrop-blur-md hover:bg-accent hover:text-on-accent">
                  <ChevronLeft className="size-5" />
                </button>
                <button onClick={() => changeMedia(1)} aria-label={d.nextPhoto}
                  className="pressable absolute top-1/2 right-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-black/70 text-white backdrop-blur-md hover:bg-accent hover:text-on-accent">
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}

            {/* Un solo grupo: los botones se colocan uno junto a otro, sea cual sea la longitud del texto en cada idioma.
                En vídeo, arriba, para no tapar los controles del reproductor. */}
            <div className={`absolute right-4 z-10 flex items-center gap-2 ${video ? "top-4" : "bottom-4"}`}>
              <button onClick={() => setBlurred((v) => !v)} aria-pressed={blurred} title={blurred ? d.unblur : d.blur}
                className={`pressable flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold whitespace-nowrap backdrop-blur-md ${
                  blurred ? "border-warning/60 bg-warning text-black" : "border-white/10 bg-black/70 text-white hover:bg-white/15"}`}>
                {blurred ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                <span className="hidden sm:inline">{blurred ? d.unblur : d.blur}</span>
              </button>
              {!video && (
                <button onClick={() => setFullscreen(true)} title={d.fullscreen}
                  className="pressable flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-black/70 px-3 text-[13px] font-semibold whitespace-nowrap text-white backdrop-blur-md hover:bg-accent hover:text-on-accent">
                  <Maximize2 className="size-3.5" /> <span className="hidden sm:inline">{d.fullscreen}</span>
                </button>
              )}
            </div>
          </div>

          <aside className="flex w-full flex-col border-t border-line bg-panel lg:w-[380px] lg:border-t-0 lg:border-l 2xl:w-[440px]">
            <div className="border-b border-line p-6">
              <p className="text-sm tabular-nums text-subtle">#{s + 1}</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight [overflow-wrap:anywhere] text-strong 2xl:text-2xl">@{sub.username}</h2>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                <MapPin className="size-4 text-accent-text" /> {sub.country}
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
              <div>
                <h4 className="text-xs font-semibold text-subtle">{d.description}</h4>
                <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line break-words text-ink">{sub.description}</p>
              </div>
              {m > 1 && (
                <div>
                  <h4 className="text-xs font-semibold text-subtle">{d.photos}</h4>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {sub.media.map((item, i) => (
                      <button key={item.id} onClick={() => setMediaIdx(i)} aria-label={d.showPhoto(i + 1)} aria-current={i === mi}
                        className={`pressable relative size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-black ${
                          i === mi ? "border-highlight" : "border-transparent opacity-55 hover:opacity-100"} ${blurred ? "privacy-blur" : ""}`}>
                        <Thumb item={item} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-line px-6 py-4 text-xs text-subtle">
              <time className="whitespace-nowrap" dateTime={sub.submittedAt}>{d.sent(formatDate(locale, sub.submittedAt))}</time>
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
