export function Pill({ tone, children }: { tone: "success" | "warning" | "muted" | "accent"; children: React.ReactNode }) {
  const cls = {
    success: "bg-success/15 text-success-text",
    warning: "bg-warning/15 text-warning-text",
    muted: "bg-raised text-muted",
    accent: "bg-accent/15 text-accent-text",
  }[tone];
  return <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}
