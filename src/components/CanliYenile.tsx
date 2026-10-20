"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Başka bir cihazda (telefon/bilgisayar/tablet) yapılan satış, alış, transfer ve stok değişikliği bu cihazda da kendiliğinden görünsün.
// Sayfa verisi yalnızca şu koşullarda yenilenir (gereksiz yük ve Neon'un 7/24 uyanık kalmaması için):
//  - sekme görünürken, çevrimiçiyken, son 10 dk içinde kullanıcı etkileşimi varken,
//  - kullanıcı bir alana yazmıyorsa (yazarken ekran değişmesin).
// router.refresh() yalnızca sunucu verisini tazeler; sepet, açık pencere ve yazılan formlar korunur.
const ARALIK_MS = 15_000;
const BOSTA_SINIR_MS = 10 * 60_000;
const YOLLAR = ["/", "/stok", "/urunler", "/hareketler", "/transferler", "/raporlar", "/muhasebe"];

export function CanliYenile() {
  const router = useRouter();
  const yol = usePathname();
  const sonYenileme = useRef(Date.now());
  const sonEtkilesim = useRef(Date.now());

  useEffect(() => {
    const izinli = YOLLAR.includes(yol) || (yol.startsWith("/urunler/") && yol !== "/urunler/yeni");
    if (!izinli) return;
    const etkilesim = () => { sonEtkilesim.current = Date.now(); };
    const olaylar = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    olaylar.forEach((o) => window.addEventListener(o, etkilesim, { passive: true }));

    const yenile = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      if (Date.now() - sonEtkilesim.current > BOSTA_SINIR_MS) return;
      const a = document.activeElement?.tagName;
      if (a === "INPUT" || a === "TEXTAREA" || a === "SELECT") return;
      sonYenileme.current = Date.now();
      router.refresh();
    };
    const zamanlayici = setInterval(yenile, ARALIK_MS);
    // Sekmeye/uygulamaya dönünce hemen tazele (telefondan kilit açma, sekme değiştirme)
    const gorunur = () => { if (document.visibilityState === "visible" && Date.now() - sonYenileme.current > 4000) yenile(); };
    document.addEventListener("visibilitychange", gorunur);
    window.addEventListener("focus", gorunur);
    return () => {
      clearInterval(zamanlayici);
      olaylar.forEach((o) => window.removeEventListener(o, etkilesim));
      document.removeEventListener("visibilitychange", gorunur);
      window.removeEventListener("focus", gorunur);
    };
  }, [yol, router]);

  return null;
}