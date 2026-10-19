import { z } from "zod";
import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { denetle } from "@/lib/denetim";


const sema = z.object({
  tip: z.enum(["GELIR", "GIDER"]),
  kategori: z.string().trim().min(1, "Kategori seçin").max(60),
  tutar: z.number().positive("Tutar sıfırdan büyük olmalı").max(100_000_000),
  aciklama: z.string().trim().max(200).optional().nullable(),
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz").optional(),
});

export const POST = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"], sema }, async ({ kullanici, govde, kapsam }) => {
  const k = await prisma.kasaKaydi.create({
    data: {
      tip: govde.tip, kategori: govde.kategori, tutar: govde.tutar.toFixed(2), aciklama: govde.aciklama || null, subeId: kapsam ?? null,
      kullaniciId: kullanici.id, kullaniciSnap: `${kullanici.ad} <${kullanici.email}>`,
      tarih: govde.tarih ? new Date(`${govde.tarih}T12:00:00+03:00`) : new Date(),
    },
  });
  await denetle(kullanici, "kasa-kaydi", "kasa", k.id, { tip: k.tip, tutar: govde.tutar, kategori: k.kategori });
  return { id: k.id };
});