import { z } from "zod";
import { handler, IsHatasi } from "@/lib/api";
import { oturumAc } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sifreHashle, sifreKurali } from "@/lib/sifre";
import { denetle } from "@/lib/denetim";
import { varsayilanlariYaz } from "@/lib/varsayilanlar";

export const GET = handler({ acik: true }, async () => ({ kurulumGerekli: (await prisma.kullanici.count()) === 0 }));

const sema = z.object({
  ad: z.string().trim().min(2, "Ad en az 2 karakter").max(80),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin").max(200),
  sifre: z.string().max(128),
});

// Sadece hic kullanici yokken calisir: ilk Super Admin hesabini olusturur
export const POST = handler({ acik: true, sema }, async ({ govde }) => {
  const hata = sifreKurali(govde.sifre);
  if (hata) throw new IsHatasi(hata, 400);
  const k = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7101)`;
    if ((await tx.kullanici.count()) > 0) throw new IsHatasi("Kurulum zaten tamamlanmış", 409);
    await varsayilanlariYaz(tx);
    return tx.kullanici.create({
      data: { ad: govde.ad, email: govde.email, sifreHash: await sifreHashle(govde.sifre), rol: "SUPER_ADMIN" },
    });
  });
  await oturumAc(k.id, false);
  await denetle({ id: k.id, email: k.email, ad: k.ad, rol: k.rol, subeId: null }, "ilk-kurulum", "kullanici", k.id);
  return { tamam: true };
});
