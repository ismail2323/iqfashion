import { z } from "zod";
import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { subeOlustur } from "@/lib/hesaplar";
import { denetle } from "@/lib/denetim";
import { gunBasi, gunEkle } from "@/lib/tarih";

export const GET = handler({ roller: ["SUPER_ADMIN"] }, async () => {
  const bas = gunBasi();
  const subeler = await prisma.sube.findMany({
    orderBy: [{ aktif: "desc" }, { ad: "asc" }],
    include: { _count: { select: { kullanicilar: true } } },
  });
  const [stoklar, satislar] = await Promise.all([
    prisma.stok.groupBy({ by: ["subeId"], _sum: { miktar: true } }),
    prisma.satis.groupBy({ by: ["subeId"], where: { durum: "TAMAMLANDI", createdAt: { gte: bas, lt: gunEkle(bas, 1) } }, _sum: { toplam: true }, _count: true }),
  ]);
  return {
    subeler: subeler.map((s) => ({
      id: s.id, ad: s.ad, kod: s.kod, adres: s.adres, telefon: s.telefon, aktif: s.aktif, kullaniciSayisi: s._count.kullanicilar,
      stokAdedi: stoklar.find((x) => x.subeId === s.id)?._sum.miktar ?? 0,
      bugunSatis: Number(satislar.find((x) => x.subeId === s.id)?._sum.toplam ?? 0),
      bugunSatisSayisi: satislar.find((x) => x.subeId === s.id)?._count ?? 0,
    })),
  };
});

const sema = z.object({
  ad: z.string().trim().min(2, "Şube adı en az 2 karakter").max(80),
  kod: z.string().trim().max(12).regex(/^[A-Za-z0-9]*$/, "Kod yalnızca harf ve rakam içermeli").optional(),
  adres: z.string().trim().max(200).optional().nullable(),
  telefon: z.string().trim().max(30).optional().nullable(),
  mudur: z.object({ ad: z.string().trim().min(2, "Müdür adı gerekli").max(80), email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"), sifre: z.string().max(128).optional() }).optional(),
});

export const POST = handler({ roller: ["SUPER_ADMIN"], sema }, async ({ kullanici, govde }) => {
  const { sube, hesap } = await subeOlustur(govde);
  await denetle(kullanici, "sube-olustur", "sube", sube.id, { ad: sube.ad, kod: sube.kod, mudur: hesap?.email });
  return { sube, hesap };
});