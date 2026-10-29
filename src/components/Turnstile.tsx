"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/client";

const TS_LANG: Record<string, string> = { en: "en", es: "es", pt: "pt-br", fr: "fr", ja: "ja" };

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

type Props = {
  /** Debe coincidir con la acción que comprueba el servidor (lib/turnstile.ts) */
  action?: "submit" | "login" | "report";
  onToken?: (t: string) => void;
  /** Cambiarlo genera un token nuevo (los tokens son de un solo uso) */
  resetKey?: number;
};

/**
 * Comprobación anti-bots de Cloudflare. Dentro de un <form> añade el campo oculto
 * "cf-turnstile-response", que es lo que leen las acciones del servidor.
 */
export default function Turnstile({ onToken, resetKey = 0, action = "submit" }: Props) {
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const cb = useRef(onToken ?? (() => {}));
  cb.current = onToken ?? (() => {});

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
      action,
      language: TS_LANG[locale] ?? "auto",
      // Sigue el tema de la página (claro u oscuro)
      theme: document.documentElement.getAttribute("data-theme") ?? "auto",
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
