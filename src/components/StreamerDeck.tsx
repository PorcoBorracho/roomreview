"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Maximize2, FileText, Shield, Tv2, RefreshCw } from "lucide-react";
import type { DeckSubmission } from "@/lib/types";
import Lightbox from "./Lightbox";

export default function StreamerDeck({ submissions }: { submissions: DeckSubmission[] }) {
  const router = useRouter();
  const [subIdx, setSubIdx] = useState(0);
  const [mediaIdx, setMediaIdx] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const n = submissions.length;
  const sub = n > 0 ? submissions[((subIdx % n) + n) % n] : null;
  const m = sub ? sub.media.length : 0;
  const media = sub ? sub.media[((mediaIdx % m) + m) % m] : null;
  const shownSub = n > 0 ? ((subIdx % n) + n) % n : 0;
  const shownMedia = m > 0 ? ((mediaIdx % m) + m) % m : 0;

  const changeSub = useCallback((d: number) => { setSubIdx((i) => i + d); setMediaIdx(0); }, []);
  const changeMedia = useCallback((d: number) => setMediaIdx((i) => i + d), []);

  // Las URLs firmadas caducan: refrescamos los datos cada 30 min
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [router]);

  // Atajos: ← → fotos, ↑ ↓ entregas, F pantalla completa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightbox || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") changeMedia(1);
      else if (e.key === "ArrowLeft") changeMedia(-1);
      else if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); changeSub(1); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); changeSub(-1); }
      else if (e.key.toLowerCase() === "f" && media) setLightbox(media.url);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, media, changeMedia, changeSub]);

  return (
    <section className="space-y-4">
      <div className="bg-twitch-card/90 border border-twitch-border p-4 rounded-2xl backdrop-blur flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="relative flex w-3 h-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
            <span className="relative inline-flex w-3 h-3 rounded-full bg-red-500" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider">STREAMER REVIEW DECK</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-gradient-to-r from-twitch-purple to-cyber-pink text-white border border-white/20 shadow-md">
                Submission {n ? shownSub + 1 : 0} of {n}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Viewing approved setups live.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => router.refresh()} title="Reload approved submissions"
            className="p-2.5 text-slate-300 hover:text-white bg-[#0e0e13] rounded-xl border border-twitch-border transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center bg-[#0e0e13] rounded-xl border border-twitch-border p-1">
            <button onClick={() => changeSub(-1)} disabled={n < 2}
              className="p-2 text-slate-300 hover:text-white hover:bg-twitch-card rounded-lg transition flex items-center gap-1 text-xs font-semibold disabled:opacity-40">
              <ChevronLeft className="w-5 h-5" /><span className="hidden sm:inline">Previous</span>
            </button>
            <div className="h-4 w-px bg-twitch-border mx-1" />
            <button onClick={() => changeSub(1)} disabled={n < 2}
              className="p-2 text-slate-300 hover:text-white hover:bg-twitch-card rounded-lg transition flex items-center gap-1 text-xs font-semibold disabled:opacity-40">
              <span className="hidden sm:inline">Next</span><ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {!sub || !media ? (
        <div className="text-center py-20 bg-twitch-card rounded-3xl border border-dashed border-twitch-border">
          <Tv2 className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-slate-300">No Approved Submissions</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Approve pending room submissions in the Admin Panel to display them here.</p>
        </div>
      ) : (
        <div className="relative bg-black rounded-3xl border border-twitch-border/80 overflow-hidden min-h-[70vh] flex flex-col lg:flex-row shadow-2xl">
          <div className="relative flex-grow bg-[#050508] flex items-center justify-center p-4 min-h-[450px] lg:min-h-[620px]">
            <div className="absolute top-4 left-4 z-10 bg-black/80 text-cyber-cyan border border-cyber-cyan/30 px-3 py-1 rounded-xl text-xs font-mono font-semibold backdrop-blur-md">
              Media {shownMedia + 1} of {m}
            </div>

            <div className="w-full h-full flex items-center justify-center max-h-[75vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={media.id} src={media.url} alt={`Room of @${sub.username}`}
                className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/10" />
            </div>

            {m > 1 && (
              <>
                <button onClick={() => changeMedia(-1)} aria-label="Previous photo"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/80 hover:bg-twitch-purple text-white p-3 rounded-2xl border border-white/20 transition shadow-2xl">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={() => changeMedia(1)} aria-label="Next photo"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/80 hover:bg-twitch-purple text-white p-3 rounded-2xl border border-white/20 transition shadow-2xl">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            <button onClick={() => setLightbox(media.url)}
              className="absolute bottom-4 right-4 bg-black/80 hover:bg-twitch-purple text-white px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono transition flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5" /><span>Fullscreen HD</span>
            </button>
          </div>

          <div className="w-full lg:w-96 bg-[#0c0c12] border-t lg:border-t-0 lg:border-l border-twitch-border p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div className="border-b border-twitch-border/80 pb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">{sub.country}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-twitch-purple/20 text-twitch-neon border border-twitch-purple/30">#{shownSub + 1}</span>
                </div>
                <h2 className="text-2xl font-black text-white font-mono tracking-tight break-all">@{sub.username}</h2>
              </div>

              <div className="bg-[#12121a] p-4 rounded-2xl border border-twitch-border/80 space-y-2">
                <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-twitch-neon" /> Room Description
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line break-words">{sub.description}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Media Gallery</h4>
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {sub.media.map((item, i) => (
                    <button key={item.id} onClick={() => setMediaIdx(i)}
                      className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 transition shrink-0 bg-black ${i === shownMedia ? "border-cyber-cyan ring-2 ring-cyber-cyan/50" : "border-twitch-border opacity-60 hover:opacity-100"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-twitch-border/60 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Submitted: {new Date(sub.submittedAt).toLocaleDateString()}</span>
              <span className="text-cyber-cyan flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Streamer Deck</span>
            </div>
          </div>
        </div>
      )}

      <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}
