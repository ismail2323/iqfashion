import { z } from "zod";
import { handler, IsHatasi, json } from "@/lib/api";
import { girisDenemesiKaydet, girisKilitliMi, istemciBilgisi, oturumAc } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sifreDogrula } from "@/lib/sifre";
import { denetle } from "@/lib/denetim";

const sema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin").max(200),
  sifre: z.string().min(1, "Şifre gerekli").max(128),
  benihatirla: z.boolean().optional().default(true),
});

// Kullanici yokken de ayni sure harcansin (kullanici sayimi/zamanlama saldirisi)
const SAHTE_HASH = "00000000000000000000000000000000:" + "0".repeat(128);

export const POST = handler({ acik: true, sema }, async ({ govde }) => {
  const { ip } = await istemciBilgisi();
  const anahtarlar = [`e:${govde.email}`, `ip:${ip}`];
  // Hesap başına 5 hata; IP başına 30 (mağazadaki tüm çalışanlar aynı IP'yi paylaşabilir)
  for (const a of anahtarlar) {
    const dk = await girisKilitliMi(a, a.startsWith("ip:") ? 30 : 5);
    if (dk) throw new IsHatasi(`Çok fazla hatalı deneme. ${dk} dakika sonra tekrar deneyin.`, 429);
  }
  const k = await prisma.kullanici.findUnique({ where: { email: govde.email }, include: { sube: { select: { aktif: true } } } });
  const dogru = await sifreDogrula(govde.sifre, k?.sifreHash ?? SAHTE_HASH);
  const gecerli = !!k && dogru && k.aktif && (k.rol === "SUPER_ADMIN" || (!!k.subeId && !!k.sube?.aktif));
  if (!gecerli || !k) {
    for (const a of anahtarlar) await girisDenemesiKaydet(a, false);
    if (k && dogru) throw new IsHatasi("Hesabınız veya şubeniz pasif durumda. Yöneticiyle iletişime geçin.", 400);
    throw new IsHatasi("E-posta veya şifre hatalı", 400);
  }
  for (const a of anahtarlar) await girisDenemesiKaydet(a, true);
  await oturumAc(k.id, govde.benihatirla);
  await prisma.kullanici.update({ where: { id: k.id }, data: { sonGiris: new Date() } });
  await denetle({ id: k.id, email: k.email, ad: k.ad, rol: k.rol, subeId: k.subeId }, "giris", "oturum", k.id, undefined, ip);
  return json({ tamam: true, rol: k.rol });
});
