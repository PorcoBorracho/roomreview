"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import Segmented from "./Segmented";
import { THEME_KEY, type ThemeMode } from "@/lib/theme";
import { useT } from "@/i18n/client";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Tema que se ve ahora: el elegido o, si no se ha elegido ninguno, el del dispositivo */
function currentTheme(): ThemeMode {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "light" || t === "dark") return t;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function apply(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch { /* modo privado o almacenamiento bloqueado: el tema se aplica igual, solo no se recuerda */ }
}

/** Claro / oscuro. Hasta que se elige uno, sigue al dispositivo (y cambia con él). */
export default function ThemeToggle() {
  const t = useT();
  const [mode, setMode] = useState<ThemeMode | null>(null);

  // Se lee tras montar (en el servidor no se sabe el tema): hasta entonces, un hueco del mismo tamaño
  useEffect(() => {
    setMode(currentTheme());
    const mq = window.matchMedia(DARK_QUERY);
    const follow = () => { if (!document.documentElement.hasAttribute("data-theme")) setMode(currentTheme()); };
    mq.addEventListener("change", follow);
    return () => mq.removeEventListener("change", follow);
  }, []);

  function change(next: string) {
    const m = next as ThemeMode;
    if (m === mode) return;
    setMode(m);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    // Un único fundido entre temas (View Transitions) donde el navegador lo admite
    if (doc.startViewTransition && !reduce) doc.startViewTransition(() => apply(m));
    else apply(m);
  }

  if (!mode) return <div aria-hidden className="h-10 w-[74px] rounded-xl border border-line bg-well" />;

  return (
    <Segmented
      ariaLabel={t.theme.label}
      iconOnly
      active={mode}
      onSelect={change}
      items={[
        { key: "light", label: t.theme.light, icon: Sun },
        { key: "dark", label: t.theme.dark, icon: Moon },
      ]}
    />
  );
}
