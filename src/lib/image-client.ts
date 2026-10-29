"use client";

const MAX_DIMENSION = 2560;
const QUALITY = 0.88;
export const CLIENT_MAX_INPUT_BYTES = 40 * 1024 * 1024;

/**
 * Re-codifica la imagen en el navegador:
 *  - elimina TODOS los metadatos EXIF (incluida la ubicación GPS)
 *  - corrige la orientación
 *  - reduce a 2560 px como máximo (subidas más rápidas y caben en el plan gratis)
 */
export async function processImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
  if (file.size > CLIENT_MAX_INPUT_BYTES) throw new Error("Image is too large (max 40 MB before compression)");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`"${file.name}" can't be read. Use JPEG, PNG or WebP.`);
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", QUALITY));
  if (!blob) throw new Error("Could not process the image");
  return blob;
}
