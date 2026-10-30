"use client";

import { useState } from "react";
import type { StreamerRef } from "@/lib/types";

const SIZES = { sm: "size-6 text-[11px]", md: "size-11 text-base", lg: "size-16 text-2xl sm:size-20 sm:text-3xl" } as const;

/**
 * Imagen de perfil de Twitch (solo del CDN de Twitch, comprobado al guardarla).
 * Si no tiene o no carga, la inicial de su nombre.
 */
export default function StreamerAvatar({ streamer, size = "md" }: { streamer: Pick<StreamerRef, "displayName" | "avatarUrl">; size?: keyof typeof SIZES }) {
  const [failed, setFailed] = useState(false);
  const cls = `${SIZES[size]} shrink-0 rounded-full bg-raised`;
  if (streamer.avatarUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={streamer.avatarUrl} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)}
      className={`${cls} object-cover ring-1 ring-line`} />;
  }
  return (
    <span aria-hidden className={`${cls} flex items-center justify-center font-semibold text-muted uppercase`}>
      {streamer.displayName.slice(0, 1)}
    </span>
  );
}
