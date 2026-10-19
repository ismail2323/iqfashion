import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

// Önbellek stratejisi:
//  - "rapor": panel/rapor/muhasebe toplamları (pahalı toplulaştırmalar). Her veri değişikliğinde otomatik düşer + en geç SN sonra yenilenir.
//  - "subeler": aktif şube listesi (neredeyse hiç değişmez, ama her sayfada lazım).
export const RAPOR = "rapor";
export const SUBELER = "subeler";

/** Veri değiştiren her başarılı API çağrısından sonra çağrılır: ilgili önbellekler hemen geçersiz olur. */
export function onbellekleriTazele(...etiketler: string[]) {
  for (const e of etiketler.length ? etiketler : [RAPOR]) revalidateTag(e, { expire: 0 });
}

/** JSON'a çevrilebilir sonuç döndüren, argümanları anahtara dahil edilen önbellekli fonksiyon. */
export function onbellekli<A extends unknown[], R>(fn: (...a: A) => Promise<R>, anahtar: string[], etiket: string, saniye: number) {
  return unstable_cache(fn, anahtar, { tags: [etiket], revalidate: saniye });
}