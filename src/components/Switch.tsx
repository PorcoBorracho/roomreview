"use client";

/** Interruptor con deslizamiento suave del círculo (transform: barato y fluido). */
export default function Switch({ checked, onChange, disabled, label, id }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; id?: string;
}) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      data-checked={checked}
      className="switch relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border disabled:opacity-50">
      <span aria-hidden className="switch-thumb absolute left-[2px] size-[18px] rounded-full bg-white" />
    </button>
  );
}
