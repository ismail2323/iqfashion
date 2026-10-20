import { z } from "zod";
import { handler, IsHatasi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { subeTamSil } from "@/lib/hesaplar";
import { kritikIslemOnayi } from "@/lib/onay";
import { denetle } from "@/lib/denetim";

const sema = z.object({ anladim: z.literal(true), onay: z.string().max(80), sifre: z.string().min(1, "Şifrenizi girin").max(128) });

export const POST = handler({ roller: ["SUPER_ADMIN"], sema }, async ({ kullanici, govde, params }) => {
  const s = await prisma.sube.findUnique({ where: { id: params.id } });
  if (!s) throw new IsHatasi("Şube bulunamadı", 404);
  // Onay cümlesi şubenin adıdır; ardından hesap şifresi
  await kritikIslemOnayi(kullanici, govde.onay, s.ad, govde.sifre);
  await subeTamSil(params.id);
  await denetle(kullanici, "sube-tam-sil", "sube", params.id, { ad: s.ad, kod: s.kod });
  return { tamam: true };
});