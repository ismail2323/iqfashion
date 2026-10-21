import { handler, IsHatasi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { barkodTemizle } from "@/lib/barkod";
import { maliyetGorebilir } from "@/lib/rbac";
import { bedenSirasi } from "@/lib/giyim";

/** Barkoddan varyant bul: POS, mal kabul, toplu giriş ve sayım bunu kullanır. Stok kapsamdaki şubeye göredir. */
export const GET = handler({}, async ({ kullanici, kapsam, params }) => {
  const kod = barkodTemizle(decodeURIComponent(params.kod));
  if (!kod) throw new IsHatasi("Barkod boş");
  const v = await prisma.varyant.findUnique({
    where: { barkod: kod },
    include: { urun: { include: { marka: true, kategori: true } }, stoklar: { where: kapsam ? { subeId: kapsam } : undefined } },
  });
  if (!v) return { bulundu: false, barkod: kod };
  const stok = v.stoklar.reduce((t, s) => t + s.miktar, 0);
  // Aynı ürünün aynı renkteki diğer bedenleri: satışta "hangi beden?" sorusu ve beden değiştirme için
  const kardesler = (await prisma.varyant.findMany({
    where: { urunId: v.urunId, renk: v.renk, aktif: true },
    include: { stoklar: { where: kapsam ? { subeId: kapsam } : undefined } },
  })).map((k) => ({ id: k.id, beden: k.beden, barkod: k.barkod, satisFiyati: Number(k.satisFiyati), stok: k.stoklar.reduce((t, s) => t + s.miktar, 0) }))
    .sort((a, b) => bedenSirasi(a.beden) - bedenSirasi(b.beden));
  return {
    kardesler,
    bulundu: true,
    barkod: kod,
    varyant: {
      id: v.id, urunId: v.urunId, urunAdi: v.urun.ad, marka: v.urun.marka?.ad ?? null, kategori: v.urun.kategori?.ad ?? null, gorselUrl: v.urun.gorselUrl,
      renk: v.renk, beden: v.beden, barkod: v.barkod, satisFiyati: Number(v.satisFiyati), alisFiyati: maliyetGorebilir(kullanici) ? Number(v.alisFiyati) : null,
      stok, minStok: v.minStok, aktif: v.aktif && v.urun.aktif,
    },
  };
});