"use client";

import { useRef, useState } from "react";
import { useT } from "@/i18n/client";

/**
 * Pulsar y mantener para confirmar (sin ventana de confirmación del navegador).
 * Lento mientras el usuario decide, rápido al soltar. Funciona con ratón, táctil y teclado (Enter/Espacio).
 */
export default function HoldButton({
  onConfirm, holdMs = 1000, disabled, label, holdingLabel, icon, className = "", fillClassName = "",
}: {
  onConfirm: () => void;
  holdMs?: number;
  disabled?: boolean;
  label: string;
  holdingLabel: string;
  icon?: React.ReactNode;
  className?: string;
  fillClassName?: string;
}) {
  const t = useT();
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function start() {
    if (disabled || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onConfirm();
    }, holdMs);
  }
  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }

  const content = (
    <>
      {icon}
      <span>{holding ? holdingLabel : label}</span>
    </>
  );

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label} (press and hold)`}
      title={t.common.pressAndHold}
      onPointerDown={(e) => { if (e.button === 0) start(); }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); start(); } }}
      onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") cancel(); }}
      onBlur={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={`pressable relative select-none overflow-hidden ${className}`}
      style={{ touchAction: "none" }}
    >
      <span className="relative z-0 flex items-center gap-1.5">{content}</span>
      <span aria-hidden data-holding={holding} style={{ ["--hold-ms" as string]: `${holdMs}ms` }}
        className={`hold-fill absolute inset-0 z-10 flex items-center justify-center gap-1.5 ${fillClassName}`}>
        {content}
      </span>
    </button>
  );
}
