"use client";

import { useEffect, useState } from "react";

/**
 * La cabecera forma parte del contenido: sin borde ni franja en reposo,
 * y solo al desplazar aparece un fondo sutil para separar lo que pasa por debajo.
 */
export default function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header data-scrolled={scrolled} className="app-header sticky top-0 z-40">
      {children}
    </header>
  );
}
