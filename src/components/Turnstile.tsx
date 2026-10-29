"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

export default function Turnstile({ onToken, resetKey }: { onToken: (t: string) => void; resetKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (window.turnstile) setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !ref.current || !window.turnstile) return;
    if (widgetId.current) {
      window.turnstile.reset(widgetId.current);
      cb.current("");
      return;
    }
    widgetId.current = window.turnstile.render(ref.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      theme: "dark",
      callback: (t: string) => cb.current(t),
      "expired-callback": () => cb.current(""),
      "error-callback": () => cb.current(""),
    });
  }, [loaded, resetKey]);

  useEffect(() => () => {
    if (widgetId.current) window.turnstile?.remove(widgetId.current);
  }, []);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
      />
      <div ref={ref} className="flex justify-center min-h-[65px]" />
    </>
  );
}
