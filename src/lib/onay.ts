import "server-only";
import { prisma } from "./db";
import { girisDenemesiKaydet, girisKilitliMi } from "./auth";
import { IsHatasi } from "./hatalar";
import { onayMetniDogru } from "./sifirlama";
import { sifreDogrula } from "./sifre";
import type { Oturumlu } from "./rbac";

/**
 * Yıkıcı işlemler için son kapı: yazılı onay metni + hesabın şifresi.
 * Yanlış şifrede hız sınırı uygulanır (15 dk'da 5 hata -> kilit).
 */
export async function kritikIslemOnayi(k: Oturumlu, onayMetni: string, beklenen: string, sifre: string) {
  if (!onayMetniDogru(onayMetni, beklenen)) throw new IsHatasi(`Onay metni hatalı. "${beklenen}" yazmalısınız.`);
  const anahtar = `kritik:${k.id}`;
  const kilit = await girisKilitliMi(anahtar);
  if (kilit) throw new IsHatasi(`Çok fazla hatalı şifre denemesi. ${kilit} dakika sonra tekrar deneyin.`, 429);
  const hesap = await prisma.kullanici.findUnique({ where: { id: k.id } });
  if (!hesap || !(await sifreDogrula(sifre, hesap.sifreHash))) {
    await girisDenemesiKaydet(anahtar, false);
    throw new IsHatasi("Şifre hatalı");
  }
  await girisDenemesiKaydet(anahtar, true);
}