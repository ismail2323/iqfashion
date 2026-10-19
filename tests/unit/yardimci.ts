import { prisma } from "@/lib/db";
import type { Aktor } from "@/lib/stok";
import { sifreHashle } from "@/lib/sifre";

export async function temizle() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "SatisKalemi","Satis","AlisKalemi","AlisBelgesi","TransferKalemi","Transfer","StokHareketi","Stok","FiyatGecmisi","Varyant","Urun","Marka","Kategori","Tedarikci","Oturum","GirisDenemesi","Kullanici","Sube","DenetimKaydi","AiKullanim","Gorsel","Ayar","Sayac" RESTART IDENTITY CASCADE`,
  );
}

export async function kur() {
  const a = await prisma.sube.create({ data: { ad: "Merkez", kod: "MRK" } });
  const b = await prisma.sube.create({ data: { ad: "Şube 2", kod: "SB2" } });
  const hash = await sifreHashle("Test12345");
  const admin = await prisma.kullanici.create({ data: { email: "admin@t.com", ad: "Admin", rol: "SUPER_ADMIN", sifreHash: hash } });
  const mudur = await prisma.kullanici.create({ data: { email: "mudur@t.com", ad: "Müdür", rol: "SUBE_MUDURU", subeId: a.id, sifreHash: hash } });
  const kasiyer = await prisma.kullanici.create({ data: { email: "kasiyer@t.com", ad: "Kasiyer", rol: "KASIYER", subeId: a.id, sifreHash: hash } });
  const aktor = (k: typeof admin): Aktor => ({ id: k.id, ad: k.ad, email: k.email, rol: k.rol, subeId: k.subeId });
  return { a, b, admin: aktor(admin), mudur: aktor(mudur), kasiyer: aktor(kasiyer) };
}