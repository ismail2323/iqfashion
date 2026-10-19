// Tum gun sinirlari Europe/Istanbul'a gore (sunucu UTC olsa da dogru calisir). Turkiye'de DST yok: UTC+3 sabit.
export const TZ = "Europe/Istanbul";
const OFFSET_MS = 3 * 60 * 60 * 1000;

/** Verilen ani Istanbul takvim gununun baslangicina (UTC Date olarak) yuvarlar. */
export function gunBasi(d: Date = new Date()): Date {
  const ist = new Date(d.getTime() + OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - OFFSET_MS);
}

export function gunEkle(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Haftanin baslangici Pazartesi. */
export function haftaBasi(d: Date = new Date()): Date {
  const g = gunBasi(d);
  const ist = new Date(g.getTime() + OFFSET_MS);
  const gun = (ist.getUTCDay() + 6) % 7; // Pzt=0
  return gunEkle(g, -gun);
}

export function ayBasi(d: Date = new Date()): Date {
  const ist = new Date(d.getTime() + OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - OFFSET_MS);
}

export function yilBasi(d: Date = new Date()): Date {
  const ist = new Date(d.getTime() + OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), 0, 1) - OFFSET_MS);
}

/** YYYY-MM-DD (Istanbul gunu) */
export function gunAnahtari(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export type Donem = "bugun" | "hafta" | "ay" | "yil" | "ozel";

export function donemAraligi(donem: Donem, bas?: string, bit?: string, simdi = new Date()): { bas: Date; bit: Date } {
  switch (donem) {
    case "bugun":
      return { bas: gunBasi(simdi), bit: gunEkle(gunBasi(simdi), 1) };
    case "hafta":
      return { bas: haftaBasi(simdi), bit: gunEkle(haftaBasi(simdi), 7) };
    case "ay": {
      const b = ayBasi(simdi);
      const ist = new Date(b.getTime() + OFFSET_MS);
      const sonraki = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 1) - OFFSET_MS);
      return { bas: b, bit: sonraki };
    }
    case "yil": {
      const b = yilBasi(simdi);
      const ist = new Date(b.getTime() + OFFSET_MS);
      return { bas: b, bit: new Date(Date.UTC(ist.getUTCFullYear() + 1, 0, 1) - OFFSET_MS) };
    }
    case "ozel": {
      if (!bas || !bit) throw new Error("Ozel donem icin baslangic ve bitis gerekli");
      const b = gunBasi(new Date(`${bas}T12:00:00+03:00`));
      const e = gunEkle(gunBasi(new Date(`${bit}T12:00:00+03:00`)), 1);
      if (e <= b) throw new Error("Bitis tarihi baslangictan once olamaz");
      return { bas: b, bit: e };
    }
  }
}

export function tarihFormat(d: Date | string, saat = false): string {
  return new Date(d).toLocaleString("tr-TR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(saat ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
