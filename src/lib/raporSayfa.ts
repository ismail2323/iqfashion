import { prisma } from "./db";
import { gunlukSeri, kasiyerPerformansi, kirilim, ozet, stokDegeri, subeKarsilastirma } from "./rapor";

/** Raporlar ve yazdırılabilir PDF aynı veriyi kullanır. */
export async function raporVerisi(bas: Date, bit: Date, kapsam: string | undefined, sinir: Date | null, tamSubeKarsilastirma: boolean) {
  const [o, seri, markalar, kategoriler, urunler, renkler, bedenler, kasiyerler, stok, subeler, giderKayitlari] = await Promise.all([
    ozet(bas, bit, kapsam, sinir),
    gunlukSeri(bas, bit, kapsam, sinir),
    kirilim("marka", bas, bit, kapsam, 50, sinir),
    kirilim("kategori", bas, bit, kapsam, 50, sinir),
    kirilim("urun", bas, bit, kapsam, 50, sinir),
    kirilim("renk", bas, bit, kapsam, 50, sinir),
    kirilim("beden", bas, bit, kapsam, 50, sinir),
    kasiyerPerformansi(bas, bit, kapsam, sinir),
    stokDegeri(kapsam),
    tamSubeKarsilastirma && !kapsam ? subeKarsilastirma(bas, bit, sinir) : Promise.resolve([]),
    prisma.kasaKaydi.groupBy({ by: ["tip", "kategori"], where: { tarih: { gte: sinir && sinir > bas ? sinir : bas, lt: bit }, ...(kapsam ? { subeId: kapsam } : {}) }, _sum: { tutar: true }, orderBy: { _sum: { tutar: "desc" } } }),
  ]);
  return {
    ozet: o, seri, markalar, kategoriler, urunler, renkler, bedenler, kasiyerler, stok, subeler,
    giderler: giderKayitlari.filter((g) => g.tip === "GIDER").map((g) => ({ kategori: g.kategori, tutar: Number(g._sum.tutar ?? 0) })),
    gelirler: giderKayitlari.filter((g) => g.tip === "GELIR").map((g) => ({ kategori: g.kategori, tutar: Number(g._sum.tutar ?? 0) })),
  };
}