import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { denetle } from "@/lib/denetim";

export const maxDuration = 60;

/** Tüm verinin JSON yedeği (şifre özetleri hariç). Sıfırlamadan önce indirilmesi önerilir. */
export const GET = handler({ roller: ["SUPER_ADMIN"] }, async ({ kullanici }) => {
  const [subeler, kullanicilar, markalar, kategoriler, tedarikciler, urunler, varyantlar, stoklar, satislar, alislar, transferler, kasa, hareketler] = await Promise.all([
    prisma.sube.findMany(),
    prisma.kullanici.findMany({ select: { id: true, email: true, ad: true, rol: true, subeId: true, aktif: true, createdAt: true } }),
    prisma.marka.findMany(), prisma.kategori.findMany(), prisma.tedarikci.findMany(), prisma.urun.findMany(), prisma.varyant.findMany(), prisma.stok.findMany(),
    prisma.satis.findMany({ include: { kalemler: true } }), prisma.alisBelgesi.findMany({ include: { kalemler: true } }), prisma.transfer.findMany({ include: { kalemler: true } }),
    prisma.kasaKaydi.findMany(), prisma.stokHareketi.findMany(),
  ]);
  await denetle(kullanici, "yedek-indir", "sistem", undefined, { satis: satislar.length, urun: urunler.length });
  const govde = JSON.stringify({ surum: 1, tarih: new Date().toISOString(), subeler, kullanicilar, markalar, kategoriler, tedarikciler, urunler, varyantlar, stoklar, satislar, alislar, transferler, kasa, hareketler });
  const gun = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  return new Response(govde, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="iqfashion-yedek-${gun}.json"`, "Cache-Control": "no-store" } });
});