import { z } from "zod";
import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { kullaniciOlustur } from "@/lib/hesaplar";
import { denetle } from "@/lib/denetim";

export const GET = handler({ roller: ["SUPER_ADMIN"] }, async () => {
  const k = await prisma.kullanici.findMany({
    orderBy: [{ aktif: "desc" }, { rol: "asc" }, { ad: "asc" }],
    select: { id: true, ad: true, email: true, rol: true, aktif: true, subeId: true, sonGiris: true, sifreDegistirmeli: true, createdAt: true, sube: { select: { ad: true } }, _count: { select: { oturumlar: true } } },
  });
  return { kullanicilar: k.map(({ _count, sube, ...x }) => ({ ...x, subeAd: sube?.ad ?? null, acikOturum: _count.oturumlar })) };
});

const sema = z.object({
  ad: z.string().trim().min(2, "Ad en az 2 karakter").max(80),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin").max(200),
  rol: z.enum(["SUPER_ADMIN", "SUBE_MUDURU", "KASIYER"]),
  subeId: z.string().optional().nullable(),
  sifre: z.string().max(128).optional(),
});

export const POST = handler({ roller: ["SUPER_ADMIN"], sema }, async ({ kullanici, govde }) => {
  const h = await kullaniciOlustur(govde);
  await denetle(kullanici, "kullanici-olustur", "kullanici", h.id, { email: h.email, rol: govde.rol, subeId: govde.subeId ?? null });
  return { hesap: h };
});