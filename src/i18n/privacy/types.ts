import type { ReactNode } from "react";
import type { LEGAL } from "@/config/legal";

export type PrivacySection = { id: string; title: string; body: ReactNode };

/** Datos y enlaces que cada traducción inserta en el texto */
export type PrivacyCtx = {
  L: typeof LEGAL;
  /** Enlace al email de contacto */
  mail: ReactNode;
  /** Enlace a /delete con el texto indicado */
  del: (text: string) => ReactNode;
  /** Enlace a /report con el texto indicado */
  report: (text: string) => ReactNode;
  /** Responsable: nombre, NIF y dirección */
  controller: ReactNode;
  reportResolvedDays: number;
  reportMaxDays: number;
  auditDays: number;
};

export type PrivacyDoc = {
  title: string;
  onThisPage: string;
  version: (v: string, date: string) => string;
  contactLabel: string;
  sections: (c: PrivacyCtx) => PrivacySection[];
};
