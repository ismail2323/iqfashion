// Barkod yardimcilari: EAN-13/EAN-8/UPC-A sagalama toplami, dahili barkod uretimi.

export type BarkodTuru = "EAN13" | "EAN8" | "UPCA" | "CODE128" | "BILINMIYOR";

function sagalama(govde: string): number {
  // En sagdaki basamak (kontrol hariç) agirlik 3, sonra 1, 3, 1...
  let toplam = 0;
  for (let i = govde.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    toplam += Number(govde[i]) * w;
  }
  return (10 - (toplam % 10)) % 10;
}

export function kontrolBasamagi(govde: string): number {
  if (!/^\d+$/.test(govde)) throw new Error("Barkod sadece rakam icermeli");
  return sagalama(govde);
}

export function eanGecerli(kod: string): boolean {
  if (!/^\d+$/.test(kod)) return false;
  if (![8, 12, 13].includes(kod.length)) return false;
  return sagalama(kod.slice(0, -1)) === Number(kod[kod.length - 1]);
}

export function barkodTuru(kod: string): BarkodTuru {
  if (/^\d{13}$/.test(kod)) return eanGecerli(kod) ? "EAN13" : "BILINMIYOR";
  if (/^\d{8}$/.test(kod)) return eanGecerli(kod) ? "EAN8" : "BILINMIYOR";
  if (/^\d{12}$/.test(kod)) return eanGecerli(kod) ? "UPCA" : "BILINMIYOR";
  if (/^[\x20-\x7e]{3,40}$/.test(kod)) return "CODE128";
  return "BILINMIYOR";
}

/** Okunan ham degeri temizler: bosluk/satir sonu atar, UPC-A'yi 13 haneye tamamlamaz (oldugu gibi birakir). */
export function barkodTemizle(ham: string): string {
  return ham.replace(/[\s\u0000-\u001f]/g, "").trim();
}

/** Sayacin n. degerinden magazaya ozel (dahili) EAN-13 uretir: "20" oneki (GS1'de magaza ici kullanim araligi) + 10 hane sira + kontrol. */
export function dahiliBarkod(sira: number): string {
  if (!Number.isInteger(sira) || sira < 1 || sira > 9_999_999_999) throw new Error("Gecersiz sira");
  const govde = "20" + String(sira).padStart(10, "0");
  return govde + kontrolBasamagi(govde);
}

/** Taranan kodu kabul et: gecerli EAN/UPC ya da dahili/CODE128 formatli metin. */
export function barkodKabulEdilir(kod: string): boolean {
  const t = barkodTuru(kod);
  return t !== "BILINMIYOR";
}
