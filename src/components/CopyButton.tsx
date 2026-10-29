"use client";

import { useState } from "react";
import { Check, type LucideIcon } from "lucide-react";

/** Botón que copia un texto (o el resultado de una función asíncrona) y confirma con un check. */
export default function CopyButton({ getText, label, icon: Icon, className = "", onError }: {
  getText: () => string | Promise<string | null>;
  label: string;
  icon: LucideIcon;
  className?: string;
  onError?: (message: string) => void;
}) {
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
      onError?.("Couldn't copy. Your browser blocked clipboard access.");
    }
  }
  return (
    <button type="button" onClick={run} disabled={state === "busy"} className={`pressable ${className}`}>
      {state === "done" ? <Check className="size-4 shrink-0 text-success-text" /> : <Icon className="size-4 shrink-0" />}
      <span>{state === "done" ? "Copied" : label}</span>
    </button>
  );
}
