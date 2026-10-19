import "server-only";
import { prisma } from "./db";
import { onbellekli, RAPOR } from "./onbellek";
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
/** Önbellekli sürümler (60 sn; veri değişince anında düşer). Tarihler ISO metni olarak verilir. */
export const raporVerisiC = onbellekli(
  async (basISO: string, bitISO: string, kapsam: string | null, sinirISO: string | null, tamSube: boolean) =>
    raporVerisi(new Date(basISO), new Date(bitISO), kapsam ?? undefined, sinirISO ? new Date(sinirISO) : null, tamSube),
  ["rapor-verisi-v1"], RAPOR, 60,
);
export const ozetC = onbellekli(
  async (basISO: string, bitISO: string, kapsam: string | null, sinirISO: string | null) => ozet(new Date(basISO), new Date(bitISO), kapsam ?? undefined, sinirISO ? new Date(sinirISO) : null),
  ["ozet-v1"], RAPOR, 60,
);