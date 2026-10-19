import "server-only";
import { prisma } from "./db";
import { onbellekli, RAPOR } from "./onbellek";
import { donemOzetleriHizli, gunlukSeri, kirilim, kritikStoklar, oluStok, stokDegeri, subeKarsilastirma } from "./rapor";
import { donemAraligi, gunBasi, gunEkle, type Donem } from "./tarih";

/**
 * Anasayfanın tüm ağır verisi tek yerde ve ÖNBELLEKLİ (30 sn; her satış/alış/iptal/gider anında düşürür).
 * Büyük veride bile panel açılışı önbellekten milisaniyelerde gelir.
 */
async function hesapla(kapsam: string | null, sinirISO: string | null, gd: Donem, tumSube: boolean) {
  const sinir = sinirISO ? new Date(sinirISO) : null;
  const k = kapsam ?? undefined;
  const { bas, bit } = donemAraligi(gd);
  const [donemler, seri, markalar, urunler, renkler, bedenler, stok, kritik, olu, subeler, sonSatislar] = await Promise.all([
    donemOzetleriHizli(k, sinir),
    gunlukSeri(gunEkle(gunBasi(), -29), gunEkle(gunBasi(), 1), k, sinir),
    kirilim("marka", bas, bit, k, 8, sinir),
    kirilim("urun", bas, bit, k, 6, sinir),
    kirilim("renk", bas, bit, k, 8, sinir),
    kirilim("beden", bas, bit, k, 8, sinir),
    stokDegeri(k),
    kritikStoklar(k, 8),
    oluStok(45, k, 6),
    tumSube && !k ? subeKarsilastirma(bas, bit, sinir) : Promise.resolve([]),
    prisma.satis.findMany({
      where: { ...(k ? { subeId: k } : {}), ...(sinir ? { createdAt: { gte: sinir } } : {}) },
      orderBy: { createdAt: "desc" }, take: 7,
      select: { id: true, toplam: true, durum: true, createdAt: true, sube: { select: { ad: true } }, kalemler: { select: { urunAdi: true } } },
    }),
  ]);
  return {
    donemler: Object.fromEntries(Object.entries(donemler).map(([d, v]) => [d, { ...v, bas: undefined, bit: undefined }])) as unknown as Record<Donem, Omit<(typeof donemler)[Donem], "bas" | "bit">>,
    seri, markalar, urunler, renkler, bedenler, stok, kritik, olu, subeler,
    sonSatislar: sonSatislar.map((s) => ({ id: s.id, toplam: Number(s.toplam), durum: s.durum, tarih: s.createdAt.toISOString(), subeAd: s.sube.ad, ilkUrun: s.kalemler[0]?.urunAdi ?? "", kalemSayisi: s.kalemler.length })),
  };
}

export const panelVerisi = onbellekli(hesapla, ["panel-verisi-v1"], RAPOR, 30);