"use client";

import { useEffect, useState } from "react";
import { Monitor, Sun, Moon } from "lucide-react";
import Segmented from "./Segmented";
import { THEME_KEY, type ThemeMode } from "@/lib/theme";
import { useT } from "@/i18n/client";

function apply(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  try {
    if (mode === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, mode);
  } catch { /* modo privado o almacenamiento bloqueado: el tema se aplica igual, solo no se recuerda */ }
}

export default function ThemeToggle() {
  const t = useT();
  const [mode, setMode] = useState<ThemeMode | null>(null);

  // Se lee tras montar (en el servidor no hay localStorage): hasta entonces, un hueco del mismo tamaño
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setMode(t === "light" || t === "dark" ? t : "system");
  }, []);

  function change(next: string) {
    const m = next as ThemeMode;
    setMode(m);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    // Un único fundido entre temas (View Transitions) donde el navegador lo admite
    if (doc.startViewTransition && !reduce) doc.startViewTransition(() => apply(m));
    else apply(m);
  }

  if (!mode) return <div aria-hidden className="h-10 w-[106px] rounded-xl border border-line bg-well" />;

  return (
    <Segmented
      ariaLabel={t.theme.label}
      iconOnly
      active={mode}
      onSelect={change}
      items={[
        { key: "system", label: t.theme.system, icon: Monitor },
        { key: "light", label: t.theme.light, icon: Sun },
        { key: "dark", label: t.theme.dark, icon: Moon },
      ]}
    />
  );
}
