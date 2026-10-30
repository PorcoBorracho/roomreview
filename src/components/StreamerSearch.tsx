"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { useT } from "@/i18n/client";

/** Buscador de streamers: actualiza ?q= mientras se escribe (con una pequeña espera) y funciona sin JavaScript (formulario GET). */
export default function StreamerSearch({ initial }: { initial: string }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initial);
  const [pending, setPending] = useState(false);
  const first = useRef(true);

  useEffect(() => setPending(false), [initial]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (q.trim() === initial) return;
    setPending(true);
    const timer = setTimeout(() => {
      const v = q.trim();
      router.replace(v ? `${pathname}?q=${encodeURIComponent(v)}` : pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <form role="search" action={pathname} method="get" onSubmit={(e) => e.preventDefault()} className="relative">
      <label htmlFor="streamer-q" className="sr-only">{t.home.searchLabel}</label>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-hint" />
      <input id="streamer-q" name="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={40}
        autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={t.home.searchPlaceholder}
        className="field h-14 rounded-2xl pr-12 pl-12 text-base shadow-raised [&::-webkit-search-cancel-button]:hidden" />
      <span className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center">
        {pending ? (
          <Loader2 aria-hidden className="size-4 animate-spin text-subtle" />
        ) : q ? (
          <button type="button" onClick={() => setQ("")} aria-label={t.home.clear}
            className="pressable flex size-8 items-center justify-center rounded-lg text-subtle hover:bg-raised hover:text-strong">
            <X className="size-4" />
          </button>
        ) : null}
      </span>
    </form>
  );
}
