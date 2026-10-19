"use client";
import { useState } from "react";
import { cn } from "@/components/ui";

/** Görsel yoksa ya da yüklenemezse markanın baş harfiyle şık bir yedek gösterir. */
export function UrunGorseli({ src, ad, marka, className }: { src?: string | null; ad: string; marka?: string | null; className?: string }) {
  const [hata, setHata] = useState(false);
  const harf = (marka || ad || "?").trim().charAt(0).toLocaleUpperCase("tr-TR");
  if (!src || hata) {
    return (
      <div className={cn("grid place-items-center bg-gradient-to-br from-surface-2 to-border font-display text-2xl text-muted", className)} aria-label={ad} role="img">
        {harf}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={ad} loading="lazy" onError={() => setHata(true)} className={cn("object-cover", className)} />;
}
