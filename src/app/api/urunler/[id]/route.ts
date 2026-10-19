import { z } from "zod";
import { handler, IsHatasi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { denetle } from "@/lib/denetim";

const sema = z.object({
  ad: z.string().trim().min(2).max(120).optional(),
  markaAd: z.string().trim().max(60).nullable().optional(),
  kategoriAd: z.string().trim().max(60).nullable().optional(),
  cinsiyet: z.enum(["KADIN", "ERKEK", "COCUK", "UNISEX"]).nullable().optional(),
  sezon: z.enum(["YAZLIK", "KISLIK", "IKI_SEZON"]).nullable().optional(),
  aciklama: z.string().trim().max(500).nullable().optional(),
  gorselUrl: z.string().max(300).regex(/^\/(api\/gorsel\/|urunler\/)[\w./-]+$/).nullable().optional(),
  aktif: z.boolean().optional(),
});

export const PATCH = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"], sema }, async ({ kullanici, govde, params }) => {
  const u = await prisma.urun.findUnique({ where: { id: params.id } });
  if (!u) throw new IsHatasi("Ürün bulunamadı", 404);
  // Ürünü pasife almak/aktif etmek katalogu tüm şubelerde etkiler: yalnızca süper admin
  if (govde.aktif !== undefined && kullanici.rol !== "SUPER_ADMIN") throw new IsHatasi("Ürünü pasife almak için süper admin yetkisi gerekir", 403);
  const marka = govde.markaAd === undefined ? undefined : govde.markaAd ? await prisma.marka.upsert({ where: { ad: govde.markaAd }, update: {}, create: { ad: govde.markaAd } }) : null;
  const kat = govde.kategoriAd === undefined ? undefined : govde.kategoriAd ? await prisma.kategori.upsert({ where: { ad: govde.kategoriAd }, update: {}, create: { ad: govde.kategoriAd } }) : null;
  await prisma.urun.update({
    where: { id: u.id },
    data: { ad: govde.ad, markaId: marka === undefined ? undefined : (marka?.id ?? null), kategoriId: kat === undefined ? undefined : (kat?.id ?? null), cinsiyet: govde.cinsiyet, sezon: govde.sezon, aciklama: govde.aciklama, gorselUrl: govde.gorselUrl, aktif: govde.aktif },
  });
  await denetle(kullanici, "urun-guncelle", "urun", u.id, govde);
  return { tamam: true };
});