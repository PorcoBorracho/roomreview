"use client";

// Debe ser menor que el límite del servidor y del bucket (6 MB)
const TARGET_BYTES = 5.5 * 1024 * 1024;
const ATTEMPTS: [number, number][] = [[2560, 0.88], [2560, 0.8], [2048, 0.8], [1600, 0.75]];
export const CLIENT_MAX_INPUT_BYTES = 40 * 1024 * 1024;

/** Error con un código traducible (diccionario: form.imageErrors) */
export class ImageError extends Error {
  constructor(public code: "notImage" | "tooLargeInput" | "unreadable" | "tooDetailed" | "noCanvas" | "failed", public fileName = "") {
    super(code);
  }
}

/**
 * Re-codifica la imagen en el navegador:
 *  - elimina TODOS los metadatos EXIF (incluida la ubicación GPS)
 *  - corrige la orientación
 *  - reduce a 2560 px como máximo (subidas más rápidas y caben en el plan gratis)
 */
export async function processImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new ImageError("notImage");
  if (file.size > CLIENT_MAX_INPUT_BYTES) throw new ImageError("tooLargeInput");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("unreadable", file.name);
  }

  try {
    // Si una foto muy detallada supera el límite, se prueba con menos calidad o menos resolución
    for (const [maxDim, quality] of ATTEMPTS) {
      const blob = await encode(bitmap, maxDim, quality);
      if (blob.size <= TARGET_BYTES) return blob;
    }
  } finally {
    bitmap.close();
  }
  throw new ImageError("tooDetailed", file.name);
}

async function encode(bitmap: ImageBitmap, maxDim: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("noCanvas");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new ImageError("failed");
  return blob;
}
