// Para: veritabaninda Decimal(12,2). Hesaplar kurus (tam sayi) uzerinden yapilir, float hatasi olmaz.
export function kurusa(deger: number | string | { toString(): string }): number {
  const n = typeof deger === "number" ? deger : Number(deger.toString().replace(",", "."));
  if (!Number.isFinite(n)) throw new Error("Gecersiz tutar");
  return Math.round(n * 100);
}

export function liraya(kurus: number): number {
  return Math.round(kurus) / 100;
}

export function paraFormat(deger: number | string | { toString(): string } | null | undefined): string {
  if (deger === null || deger === undefined) return "-";
  const n = Number(deger.toString());
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n);
}

export function sayiFormat(n: number | null | undefined): string {
  return new Intl.NumberFormat("tr-TR").format(n ?? 0);
}
