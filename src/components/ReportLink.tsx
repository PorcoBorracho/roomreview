"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag } from "lucide-react";

/** Enlace a /report que recuerda desde qué página se abre, para que el reporte llegue con contexto. */
export default function ReportLink({ label }: { label: string }) {
  const path = usePathname() || "/";
  const from = path === "/report" ? "" : `?page=${encodeURIComponent(path)}`;
  return (
    <Link href={`/report${from}`} className="inline-flex items-center gap-1.5 hover:text-strong">
      <Flag aria-hidden className="size-3.5" />
      {label}
    </Link>
  );
}
