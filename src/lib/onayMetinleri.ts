// Saf (sunucu/istemci ortak) onay metinleri.
export const ONAY_ISTATISTIK = "İSTATİSTİKLERİ SIFIRLA";
export const ONAY_FABRIKA = "FABRİKA AYARLARINA DÖN";

/** Türkçe büyük harf + boşluk normalizasyonu ile onay metnini karşılaştırır. */
export function onayMetniDogru(girilen: string, beklenen: string): boolean {
  const n = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
  return n(girilen) === n(beklenen);
}