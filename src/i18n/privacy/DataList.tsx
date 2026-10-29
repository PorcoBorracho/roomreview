import type { ReactNode } from "react";

export type DataItem = { id?: string; title: string; what: ReactNode; why: ReactNode; basis: ReactNode; kept: ReactNode };

/** Una ficha por tratamiento: qué datos, para qué, con qué base legal y cuánto tiempo. Evita repetir lo mismo en varias secciones. */
export default function DataList({ items, labels }: { items: DataItem[]; labels: { what: string; why: string; basis: string; kept: string } }) {
  return (
    <div className="legal-data">
      {items.map((it) => (
        <section key={it.title} id={it.id} className="scroll-mt-24">
          <h3>{it.title}</h3>
          <dl>
            <dt>{labels.what}</dt><dd>{it.what}</dd>
            <dt>{labels.why}</dt><dd>{it.why}</dd>
            <dt>{labels.basis}</dt><dd>{it.basis}</dd>
            <dt>{labels.kept}</dt><dd>{it.kept}</dd>
          </dl>
        </section>
      ))}
    </div>
  );
}
