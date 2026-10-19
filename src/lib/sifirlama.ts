// Iki tur sifirlama:
//  1) Istatistik sifirlama: GERI ALINABILIR. Raporlar yalnizca "sifirlama noktasi"ndan sonrasini sayar; hicbir kayit silinmez.
//  2) Fabrika ayarlari: KALICI. Tum veri (urun, stok, satis, sube, diger kullanicilar...) silinir; sadece islemi yapan super admin kalir.
import { prisma } from "./db";
import { IsHatasi } from "./hatalar";
import { varsayilanlariYaz } from "./varsayilanlar";

export const SIFIRLAMA_ANAHTARI = "istatistikSifirlamaNoktasi";
export { ONAY_FABRIKA, ONAY_ISTATISTIK, onayMetniDogru } from "./onayMetinleri";

export async function sifirlamaNoktasi(): Promise<Date | null> {
  const a = await prisma.ayar.findUnique({ where: { anahtar: SIFIRLAMA_ANAHTARI } });
  if (!a) return null;
  const d = new Date(a.deger);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function istatistikSifirla(): Promise<Date> {
  const simdi = new Date();
  await prisma.ayar.upsert({ where: { anahtar: SIFIRLAMA_ANAHTARI }, update: { deger: simdi.toISOString() }, create: { anahtar: SIFIRLAMA_ANAHTARI, deger: simdi.toISOString() } });
  return simdi;
}

export async function istatistikGeriAl() {
  await prisma.ayar.deleteMany({ where: { anahtar: SIFIRLAMA_ANAHTARI } });
}

/** Geri donulemez. Islemi yapan super admin hesabi ve oturumu korunur. */
export async function fabrikaSifirla(adminId: string) {
  const admin = await prisma.kullanici.findUnique({ where: { id: adminId } });
  if (!admin || admin.rol !== "SUPER_ADMIN") throw new IsHatasi("Yalnızca süper admin fabrika ayarlarına dönebilir", 403);
  await prisma.$transaction(
    async (tx) => {
      // Sube/Kullanici/Oturum haric tum veri tablolari TRUNCATE; Sube, Kullanici'ya bagli oldugu icin ayrica silinir.
      await tx.$executeRawUnsafe(
        `TRUNCATE "SatisKalemi","Satis","AlisKalemi","AlisBelgesi","TransferKalemi","Transfer","StokHareketi","Stok","FiyatGecmisi","Varyant","Urun","Marka","Kategori","Tedarikci","KasaKaydi","DenetimKaydi","AiKullanim","Gorsel","GirisDenemesi","Ayar","Sayac" RESTART IDENTITY`,
      );
      await tx.kullanici.deleteMany({ where: { id: { not: adminId } } });
      await tx.kullanici.update({ where: { id: adminId }, data: { subeId: null } });
      await tx.sube.deleteMany({});
      await varsayilanlariYaz(tx);
    },
    { timeout: 120_000 },
  );
}
