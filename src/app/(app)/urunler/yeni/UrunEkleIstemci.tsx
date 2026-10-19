"use client";
import { useState } from "react";
import { AlertTriangle, Images, PackagePlus } from "lucide-react";
import { cn } from "@/components/ui";
import { KatalogListeleri, useKatalog } from "@/components/Katalog";
import { TekUrun } from "./TekUrun";
import { TopluGiris } from "./TopluGiris";

export function UrunEkleIstemci({ aiHazir }: { aiHazir: boolean }) {
  const [sekme, setSekme] = useState<"tek" | "toplu">("toplu");
  const katalog = useKatalog();
  const Sekme = ({ k, ad, ikon: I, alt }: { k: "tek" | "toplu"; ad: string; ikon: typeof Images; alt: string }) => (
    <button onClick={() => setSekme(k)} aria-pressed={sekme === k}
      className={cn("flex flex-1 items-center gap-3 rounded-2xl border p-3 text-left transition sm:p-4", sekme === k ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-2")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", sekme === k ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}><I className="size-5" /></span>
      <span><b className="block text-sm">{ad}</b><span className="text-xs text-muted">{alt}</span></span>
    </button>
  );
  return (
    <div className="space-y-5">
      <KatalogListeleri k={katalog} />
      {!aiHazir && (
        <div className="flex items-start gap-3 rounded-2xl border border-warn/40 bg-warn-soft p-4 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p>Yapay zeka şu an kapalı (API anahtarı tanımlı değil). Bilgileri elle girebilirsiniz; fotoğraftan otomatik doldurma çalışmaz.</p>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row" role="tablist" aria-label="Giriş yöntemi">
        <Sekme k="toplu" ad="Toplu fotoğraf (AI)" ikon={Images} alt="Çok sayıda etiketi çek/seç, yapay zeka okusun" />
        <Sekme k="tek" ad="Tek ürün (adım adım)" ikon={PackagePlus} alt="Renk ve beden tablosuyla elle ekle" />
      </div>
      {sekme === "toplu" ? <TopluGiris aiHazir={aiHazir} /> : <TekUrun aiHazir={aiHazir} katalog={katalog} />}
    </div>
  );
}
