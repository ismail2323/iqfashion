import { donemAraligi, tarihFormat, type Donem } from "./tarih";

export type DonemSP = { donem?: string; bas?: string; bit?: string };

export const DONEM_ADLARI: Record<Donem, string> = { bugun: "Bugün", hafta: "Bu hafta", ay: "Bu ay", yil: "Bu yıl", ozel: "Özel aralık" };
export const DONEM_BASLIK: Record<Donem, string> = { bugun: "Günlük", hafta: "Haftalık", ay: "Aylık", yil: "Yıllık", ozel: "Dönemsel" };

/** URL parametrelerinden güvenli dönem aralığı üretir (geçersiz değerde "bu ay"a düşer). */
export function donemCoz(sp: DonemSP, varsayilan: Donem = "ay") {
  let donem = (["bugun", "hafta", "ay", "yil", "ozel"].includes(sp.donem ?? "") ? sp.donem : varsayilan) as Donem;
  const tarihMi = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  let aralik;
  try {
    aralik = donemAraligi(donem, tarihMi(sp.bas) ? sp.bas : undefined, tarihMi(sp.bit) ? sp.bit : undefined);
  } catch {
    donem = varsayilan;
    aralik = donemAraligi(donem);
  }
  const sonGun = new Date(aralik.bit.getTime() - 1);
  return { donem, ...aralik, etiket: `${tarihFormat(aralik.bas)} – ${tarihFormat(sonGun)}`, bas_s: sp.bas, bit_s: sp.bit };
}
