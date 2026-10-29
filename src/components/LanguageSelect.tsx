"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages, ChevronDown } from "lucide-react";
import { setLocale } from "@/actions/locale";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";

/**
 * Selector nativo: accesible con teclado y lector de pantalla, y en el móvil abre el selector del sistema.
 * Muestra el código corto (EN, ES…) para no ocupar sitio en la cabecera.
 */
export default function LanguageSelect() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  function change(next: string) {
    start(async () => {
      await setLocale(next);
      document.documentElement.lang = next;
      router.refresh();
    });
  }

  return (
    <label className="relative flex h-10 items-center rounded-xl border border-line bg-well text-muted transition-colors focus-within:border-accent hover:text-strong">
      <span className="sr-only">{t.language.label}</span>
      <Languages aria-hidden className="pointer-events-none absolute left-2.5 size-4" />
      <span aria-hidden className="pointer-events-none pl-8 text-[13px] font-semibold uppercase tabular-nums">{locale}</span>
      <ChevronDown aria-hidden className="pointer-events-none mr-2 ml-1 size-3.5 opacity-70" />
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        title={t.language.label}
        className="absolute inset-0 cursor-pointer appearance-none rounded-xl bg-card text-ink opacity-0 disabled:cursor-progress"
      >
        {LOCALES.map((l: Locale) => (
          <option key={l} value={l} lang={l} className="bg-card text-ink">
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
