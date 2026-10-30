import { Play } from "lucide-react";

/** Miniatura: la foto, o el primer fotograma del vídeo con un icono de reproducir */
export default function MediaThumb({ item }: { item: { url: string; kind: "image" | "video" } }) {
  if (item.kind === "video") {
    return (
      <>
        {/* #t=0.1: muestra el primer fotograma en lugar de un cuadro negro */}
        <video src={`${item.url}#t=0.1`} muted playsInline preload="metadata" tabIndex={-1} aria-hidden className="pointer-events-none size-full object-cover" />
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-7 items-center justify-center rounded-full bg-black/65 text-white"><Play className="size-3.5 fill-current" /></span>
        </span>
      </>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.url} alt="" loading="lazy" className="size-full object-cover" />;
}
