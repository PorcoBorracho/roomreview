"use client";

import { AlertCircle } from "lucide-react";
import { useT } from "@/i18n/client";
import { errorText } from "@/i18n/dict";

/** Muestra un error devuelto por el servidor (una clave del diccionario) en el idioma del visitante */
export default function FormError({ code, id, className = "" }: { code?: string | null; id?: string; className?: string }) {
  const t = useT();
  if (!code) return null;
  return (
    <p id={id} role="alert" className={`flex items-start gap-1.5 text-sm text-danger-text ${className}`}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" /> <span>{errorText(t, code)}</span>
    </p>
  );
}
