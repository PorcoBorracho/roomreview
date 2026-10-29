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
  /** Nombre o razón social del responsable (se muestra en la web: escríbelo tal cual) */
  controllerName: "[YOUR NAME OR COMPANY]",
  /** NIF / CIF / ID fiscal (opcional para particulares, obligatorio para empresas) */
  controllerTaxId: "",
  /** Dirección postal o, como mínimo, ciudad y país */
  controllerAddress: "[CITY, COUNTRY]",
  /** Email para ejercer derechos (acceso, borrado…). Debe estar operativo. */
  contactEmail: "[privacy@yourdomain.com]",
  /** Nombre de la web (marca general). Cada board tiene además su propio streamer. */
  projectName: "Stream Reviews",

  /** Autoridad de control principal (España: AEPD) */
  authorityName: "Spanish Data Protection Agency (AEPD)",
  authorityUrl: "https://www.aepd.es",

  /** Región de Supabase elegida al crear el proyecto (recomendado: una región de la UE) */
  databaseRegion: "European Union (Frankfurt, Germany)",

  /** Edad mínima para enviar. 18 evita tratar datos de menores. */
  minAge: 18,
  /** Días tras el envío en que la entrega (datos y fotos) se borra automáticamente */
  retentionDays: 90,

  policyVersion: "2026-10-29.4",
  policyUpdated: "29 October 2026",
} as const;

/** true si aún quedan campos por rellenar: se muestra un aviso en la web. */
export const LEGAL_INCOMPLETE = [LEGAL.controllerName, LEGAL.controllerAddress, LEGAL.contactEmail].some((v) =>
  v.startsWith("["),
);
