import { z } from "zod";
import { handler, IsHatasi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { denetle } from "@/lib/denetim";
import { kurusa } from "@/lib/para";

const sema = z.object({
  alisFiyati: z.number().min(0).max(10_000_000).optional(),
  satisFiyati: z.number().min(0).max(10_000_000).optional(),
  minStok: z.number().int().min(0).max(10_000).optional(),
  aktif: z.boolean().optional(),
});

export const PATCH = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"], sema }, async ({ kullanici, govde, params }) => {
  const v = await prisma.varyant.findUnique({ where: { id: params.id } });
  if (!v) throw new IsHatasi("Varyant bulunamadı", 404);
  // Fiyat listesi tüm şubeler için ortaktır: yalnızca süper admin değiştirir
  if ((govde.alisFiyati !== undefined || govde.satisFiyati !== undefined || govde.aktif !== undefined) && kullanici.rol !== "SUPER_ADMIN") {
    throw new IsHatasi("Fiyat listesini yalnızca süper admin değiştirebilir", 403);
  }
  const alis = govde.alisFiyati !== undefined ? (kurusa(govde.alisFiyati) / 100).toFixed(2) : undefined;
  const satis = govde.satisFiyati !== undefined ? (kurusa(govde.satisFiyati) / 100).toFixed(2) : undefined;
  await prisma.$transaction(async (tx) => {
    const g = await tx.varyant.update({ where: { id: v.id }, data: { alisFiyati: alis, satisFiyati: satis, minStok: govde.minStok, aktif: govde.aktif } });
    if (alis !== undefined || satis !== undefined) await tx.fiyatGecmisi.create({ data: { varyantId: v.id, alis: g.alisFiyati, satis: g.satisFiyati, kullaniciId: kullanici.id } });
  });
  await denetle(kullanici, "varyant-guncelle", "varyant", v.id, { onceki: { alis: Number(v.alisFiyati), satis: Number(v.satisFiyati) }, yeni: govde });
  return { tamam: true };
});