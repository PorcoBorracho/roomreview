/**
 * ─────────────────────────────────────────────────────────────────────
 *  DATOS LEGALES: RELLÉNALOS ANTES DE PUBLICAR LA WEB
 * ─────────────────────────────────────────────────────────────────────
 *  El RGPD (art. 13) obliga a identificar al "responsable del
 *  tratamiento", es decir, quién decide qué se hace con los datos.
 *  Si eres una persona física, pon tu nombre real; si es una empresa,
 *  su razón social y NIF/CIF.
 *
 *  Cuando cambies el contenido de la política de privacidad, sube
 *  POLICY_VERSION: así cada entrega guarda qué versión aceptó.
 */
export const LEGAL = {
  controllerName: process.env.NEXT_PUBLIC_LEGAL_NAME || "[YOUR NAME OR COMPANY]",
  controllerTaxId: process.env.NEXT_PUBLIC_LEGAL_TAX_ID || "",
  controllerAddress: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "[CITY, COUNTRY]",
  contactEmail: process.env.NEXT_PUBLIC_LEGAL_EMAIL || "[privacy@yourdomain.com]",
  projectName: process.env.NEXT_PUBLIC_PROJECT_NAME || "Stream Reviews",
  databaseRegion: process.env.NEXT_PUBLIC_DB_REGION || "European Union (Frankfurt, Germany)",

  // Esto se queda en el código: no es personal y cambia junto con la política
  authorityName: "AEPD (Agencia Española de Protección de Datos)",
  authorityUrl: "https://www.aepd.es",
  minAge: 18,
  retentionDays: 90,
  policyVersion: "2026-10-29.5",
} as const;

/** true si aún quedan campos por rellenar: se muestra un aviso en la web. */
export const LEGAL_INCOMPLETE = [LEGAL.controllerName, LEGAL.controllerAddress, LEGAL.contactEmail].some((v) =>
  v.startsWith("["),
);
