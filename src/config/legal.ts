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
  /** Nombre o razón social del responsable */
  controllerName: "[TU NOMBRE O RAZÓN SOCIAL]",
  /** NIF / CIF / ID fiscal (opcional para particulares, obligatorio para empresas) */
  controllerTaxId: "",
  /** Dirección postal o, como mínimo, ciudad y país */
  controllerAddress: "[CIUDAD, PAÍS]",
  /** Email para ejercer derechos (acceso, borrado…). Debe estar operativo. */
  contactEmail: "[privacidad@tudominio.com]",
  /** Nombre público del canal/proyecto */
  projectName: "tokyogh0uul Room Review",
  /** Dónde se emite el directo */
  broadcastPlatform: "Twitch",

  /** Autoridad de control principal (España: AEPD) */
  authorityName: "Agencia Española de Protección de Datos (AEPD)",
  authorityUrl: "https://www.aepd.es",

  /** Región de Supabase elegida al crear el proyecto (recomendado: una región de la UE) */
  databaseRegion: "European Union (Frankfurt, Germany)",

  /** Edad mínima para enviar. 18 evita tratar datos de menores. */
  minAge: 18,
  /** Días tras el envío en que la entrega (datos y fotos) se borra automáticamente */
  retentionDays: 90,

  policyVersion: "2026-10-29",
  policyUpdated: "29 October 2026",
} as const;

/** true si aún quedan campos por rellenar: se muestra un aviso en la web. */
export const LEGAL_INCOMPLETE = [LEGAL.controllerName, LEGAL.controllerAddress, LEGAL.contactEmail].some((v) =>
  v.startsWith("["),
);
