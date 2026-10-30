"use client";

import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from "./limits";

/** Lado largo máximo del vídeo comprimido (720p) */
const MAX_SIDE = 1280;
/** Bitrates de vídeo que se prueban (bits/s): si el primero no cabe en el límite, el siguiente */
const BITRATES = [1_500_000, 900_000, 600_000];
/** Tamaño máximo del archivo original antes de comprimir */
export const CLIENT_MAX_VIDEO_INPUT = 1024 * 1024 * 1024;

/** Error con un código traducible (diccionario: form.videoErrors) */
export class VideoError extends Error {
  constructor(public code: "tooLargeInput" | "unreadable" | "unsupported" | "tooLarge" | "failed", public fileName = "") {
    super(code);
  }
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Comprime el vídeo en el navegador (WebCodecs, con mediabunny) antes de subirlo:
 *  - MP4 H.264 de 720p como máximo, ~1,5 Mbit/s y 30 fps
 *    (si el navegador no sabe codificar H.264, WebM con VP9 o VP8)
 *  - SIN audio (voces y conversaciones son datos personales; además ocupa menos)
 *  - sin metadatos (ubicación GPS, modelo del móvil…)
 *  - recortado a los primeros MAX_VIDEO_SECONDS segundos
 * Así un minuto ocupa unos 11 MB en lugar de cientos.
 */
export async function processVideo(file: File, onProgress?: (p: number) => void): Promise<{ blob: Blob; trimmed: boolean }> {
  if (file.size > CLIENT_MAX_VIDEO_INPUT) throw new VideoError("tooLargeInput", file.name);
  // Se carga solo cuando alguien elige un vídeo (no pesa en la página)
  const mb = await import("mediabunny");
  if (typeof VideoEncoder === "undefined") throw new VideoError("unsupported", file.name);

  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  let duration: number;
  let width: number;
  let height: number;
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("no video track");
    duration = await input.computeDuration();
    width = track.displayWidth;
    height = track.displayHeight;
  } catch {
    input.dispose?.();
    throw new VideoError("unreadable", file.name);
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const size = width >= height ? { width: even(width * scale) } : { height: even(height * scale) };
  const end = Math.min(duration, MAX_VIDEO_SECONDS);

  try {
    const quality = (bitrate: number) => new mb.Quality({ bitrate });
    const codec = await mb.getFirstEncodableVideoCodec(["avc", "vp9", "vp8"], { ...size, quality: quality(BITRATES[0]) });
    if (!codec) throw new VideoError("unsupported", file.name);
    const mp4 = codec === "avc";
    for (const bitrate of BITRATES) {
      const format = mp4 ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat();
      const output = new mb.Output({ format, target: new mb.BufferTarget() });
      const conversion = await mb.Conversion.init({
        input,
        output,
        video: { ...size, codec, quality: quality(bitrate), frameRate: 30, forceTranscode: true },
        audio: { discard: true },
        trim: { start: 0, end },
        tags: {},
        showWarnings: false,
      });
      if (!conversion.isValid) throw new VideoError("unsupported", file.name);
      conversion.onProgress = (p) => onProgress?.(p);
      await conversion.execute();
      const buffer = output.target.buffer;
      if (!buffer) throw new VideoError("failed", file.name);
      const blob = new Blob([buffer], { type: mp4 ? "video/mp4" : "video/webm" });
      if (blob.size <= MAX_VIDEO_BYTES) return { blob, trimmed: duration > MAX_VIDEO_SECONDS + 0.5 };
    }
  } catch (e) {
    if (e instanceof VideoError) throw e;
    console.warn("video conversion failed", e);
    throw new VideoError("failed", file.name);
  } finally {
    input.dispose?.();
  }
  throw new VideoError("tooLarge", file.name);
}
