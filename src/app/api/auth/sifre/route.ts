import { z } from "zod";
import { cookies } from "next/headers";
import { handler, IsHatasi } from "@/lib/api";
import { COOKIE, kullaniciOturumlariniSil } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sifreDogrula, sifreHashle, sifreKurali } from "@/lib/sifre";
import { denetle } from "@/lib/denetim";

const sema = z.object({ mevcut: z.string().max(128), yeni: z.string().max(128) });

export const POST = handler({ sema, sifreMuaf: true }, async ({ kullanici, govde }) => {
  const hata = sifreKurali(govde.yeni);
  if (hata) throw new IsHatasi(hata, 400);
  const k = await prisma.kullanici.findUniqueOrThrow({ where: { id: kullanici.id } });
  if (!(await sifreDogrula(govde.mevcut, k.sifreHash))) throw new IsHatasi("Mevcut şifre hatalı", 400);
  if (govde.yeni === govde.mevcut) throw new IsHatasi("Yeni şifre mevcut şifreden farklı olmalı", 400);
  await prisma.kullanici.update({ where: { id: k.id }, data: { sifreHash: await sifreHashle(govde.yeni), sifreDegistirmeli: false } });
  // Diger tum cihazlardaki oturumlari kapat, bu oturum kalsin
  await kullaniciOturumlariniSil(k.id, (await cookies()).get(COOKIE)?.value);
  await denetle(kullanici, "sifre-degistir", "kullanici", k.id);
  return { tamam: true };
});
