"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

/** Muestra el email con copia en un clic. "Open in email app" es opcional: sin app de correo configurada, mailto no hace nada útil. */
export default function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* se puede seleccionar a mano */ }
  }
  return (
    <div className="mt-3">
      <p className="text-lg font-semibold break-all text-strong select-all">{email}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={copy}
          className="pressable flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent shadow-raised hover:bg-accent-hover">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy email"}
        </button>
        <a href={`mailto:${email}`}
          className="pressable flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-muted hover:border-line-strong hover:text-strong">
          <ExternalLink className="size-4" /> Open in email app
        </a>
      </div>
    </div>
  );
}
