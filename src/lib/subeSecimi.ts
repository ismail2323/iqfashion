import "server-only";
import { prisma } from "./db";
import { onbellekli, SUBELER } from "./onbellek";

/** Aktif şubeler (id + ad), en eski şube ilk sırada (= ana şube). 5 dk önbellek; şube değişince anında düşer. */
export const aktifSubeler = onbellekli(
  async () => prisma.sube.findMany({ where: { aktif: true }, select: { id: true, ad: true }, orderBy: { createdAt: "asc" } }),
  ["aktif-subeler"],
  SUBELER,
  300,
);

/** Çerezdeki özel değer: kullanıcı "Tüm şubeler"i bilerek seçti. */
export const TUM_SUBELER = "hepsi";

/**
 * Süper admin'in çalışma şubesi.
 *  - Çerez "hepsi" ise ve birden çok şube varsa: tüm şubeler (undefined).
 *  - Çerezdeki şube geçerli ve aktifse o.
 *  - Seçim yoksa/geçersizse: ANA ŞUBE (en eski aktif şube). Böylece "şube seçin" uyarısı çıkmaz.
 */
export function seciliHesapla(cerez: string | undefined | null, aktifIdler: string[]): string | undefined {
  if (cerez === TUM_SUBELER) return aktifIdler.length > 1 ? undefined : aktifIdler[0];
  if (cerez && aktifIdler.includes(cerez)) return cerez;
  return aktifIdler[0];
}

export async function gecerliSube(cerez: string | undefined | null): Promise<string | undefined> {
  return seciliHesapla(cerez, (await aktifSubeler()).map((s) => s.id));
}
