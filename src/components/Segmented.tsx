"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export type SegmentItem = { key: string; label: string; icon?: LucideIcon; href?: string };

type Props = {
  items: SegmentItem[];
  active: string;
  onSelect?: (key: string) => void;
  /** accent: fondo de marca (navegación) · neutral: gris elevado (filtros) */
  tone?: "accent" | "neutral";
  ariaLabel: string;
  /** "tabs" para filtros, "nav" para enlaces de navegación */
  kind?: "tabs" | "nav";
  className?: string;
  /** Solo iconos (la etiqueta queda para lectores de pantalla y como tooltip) */
  iconOnly?: boolean;
};

// useLayoutEffect en el cliente, useEffect en el servidor (evita el aviso de SSR)
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Selector segmentado con indicador que se desliza a la opción elegida.
 * El indicador se mueve en cuanto se pulsa (no espera a que cargue la página siguiente).
 */
export default function Segmented({ items, active, onSelect, tone = "neutral", ariaLabel, kind = "tabs", className = "", iconOnly = false }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  const current = pending ?? active;

  // Cuando la ruta/estado real alcanza al optimista, lo soltamos
  useEffect(() => { setPending(null); }, [active]);

  useIsoLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[current];
      if (el) setBox({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [current, items.length]);

  // Primera colocación sin animación; a partir de ahí, se desliza
  useEffect(() => {
    if (!box || animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [box, animate]);

  const activeText = tone === "accent" ? "text-on-accent" : "text-strong";
  const indicator = tone === "accent" ? "bg-accent shadow-raised" : "bg-raised shadow-raised";

  return (
    <div ref={wrap} role={kind === "tabs" ? "tablist" : undefined} aria-label={kind === "tabs" ? ariaLabel : undefined}
      className={`relative isolate flex rounded-xl border border-line bg-well p-1 ${className}`}>
      <span aria-hidden
        className={`segmented-indicator absolute top-1 bottom-1 left-0 -z-10 rounded-lg ${indicator} ${animate ? "is-animated" : ""}`}
        style={box ? { width: box.w, transform: `translateX(${box.x}px)` } : { opacity: 0 }} />
      {items.map(({ key, label, icon: Icon, href }) => {
        const isActive = key === current;
        const cls = `pressable relative flex h-8 flex-1 items-center justify-center gap-2 rounded-lg ${iconOnly ? "w-8 px-0" : "px-3"} text-[13px] font-semibold whitespace-nowrap transition-colors duration-200 sm:flex-none ${
          isActive ? activeText : "text-muted hover:text-strong"}`;
        const content = <>{Icon && <Icon className="size-4 shrink-0" aria-hidden />}{iconOnly ? <span className="sr-only">{label}</span> : label}</>;
        const select = () => { if (key !== current) { setPending(key); onSelect?.(key); } };
        return href ? (
          <Link key={key} href={href} prefetch={false} ref={(el) => { refs.current[key] = el; }}
            aria-current={isActive ? "page" : undefined} onClick={select} className={cls}>
            {content}
          </Link>
        ) : (
          <button key={key} type="button" role="tab" aria-selected={isActive} ref={(el) => { refs.current[key] = el; }}
            title={iconOnly ? label : undefined}
            onClick={select} className={cls}>
            {content}
          </button>
        );
      })}
    </div>
  );
}
