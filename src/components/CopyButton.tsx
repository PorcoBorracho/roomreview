"use client";

import { useState } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n/client";

/** Botón que copia un texto (o el resultado de una función asíncrona) y confirma con un check. */
export default function CopyButton({ getText, label, ariaLabel, icon: Icon, className = "", onError }: {
  getText: () => string | Promise<string | null>;
  label: string;
  /** Nombre completo para lectores de pantalla y tooltip, cuando el texto visible es corto */
  ariaLabel?: string;
  icon: LucideIcon;
  className?: string;
  onError?: (message: string) => void;
}) {
  const t = useT();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  async function run() {
    if (state === "busy") return;
    setState("busy");
    try {
      const text = await getText();
      if (!text) { setState("idle"); return; }
      await navigator.clipboard.writeText(text);
      setState("done");
      setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("idle");
      onError?.(t.common.copyFailed);
    }
  }
  return (
    <button type="button" onClick={run} disabled={state === "busy"} aria-label={ariaLabel} title={ariaLabel} className={`pressable ${className}`}>
      {state === "done" ? <Check className="size-4 shrink-0 text-success-text" /> : <Icon className="size-4 shrink-0" />}
      <span>{state === "done" ? t.common.copied : label}</span>
    </button>
  );
}
