import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { malKabul, satisIade, satisIptal, satisYap, urunOlustur } from "@/lib/stok";
import { donemOzetleri, donemOzetleriHizli, gunlukSeri, kirilim, kritikStoklar, ozet, stokDegeri, subeKarsilastirma } from "@/lib/rapor";
import { fabrikaSifirla, istatistikGeriAl, istatistikSifirla, onayMetniDogru, ONAY_FABRIKA, sifirlamaNoktasi } from "@/lib/sifirlama";
import { donemAraligi } from "@/lib/tarih";
import { kur, temizle } from "./yardimci";

let t: Awaited<ReturnType<typeof kur>>;
let vid: string;
const BUGUN = () => donemAraligi("bugun");

beforeEach(async () => {
  await temizle();
  t = await kur();
  const r = await urunOlustur({ ad: "Kot", markaAd: "Hugo", kategoriAd: "Pantolon", varyantlar: [{ renk: "Mavi", beden: "32", alisFiyati: 500, satisFiyati: 1000, adet: 10, minStok: 3 }] }, t.a.id, t.mudur);
  vid = r.varyantlar[0].id;
});

describe("özet tanımları", () => {
  it("satış, alış, gelir, gider ve kasa doğru hesaplanır", async () => {
    await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId: vid, adet: 2 }] }, t.mudur); // 2000
    await satisYap({ subeId: t.a.id, odemeTipi: "KART", kalemler: [{ varyantId: vid, adet: 1 }], indirim: 100 }, t.mudur); // 900
    await prisma.kasaKaydi.create({ data: { tip: "GIDER", kategori: "Kira", tutar: "700.00" } });
    await prisma.kasaKaydi.create({ data: { tip: "GELIR", kategori: "Diğer", tutar: "300.00" } });
    const { bas, bit } = BUGUN();
    const o = await ozet(bas, bit);
    expect(o.satis).toBe(2900);
    expect(o.satisAdet).toBe(3);
    expect(o.satisSayisi).toBe(2);
    expect(o.maliyet).toBe(1500);
    expect(o.brutKar).toBe(1400);
    expect(o.alis).toBe(5000); // açılış stoğu 10 x 500
    expect(o.isletmeGideri).toBe(700);
    expect(o.digerGelir).toBe(300);
    expect(o.gelir).toBe(3200);
    expect(o.gider).toBe(5700);
    expect(o.kasa).toBe(-2500);
    expect(o.netKar).toBe(700); // 2900 - 1500 - 700
    expect(o.odeme).toMatchObject({ NAKIT: 2000, KART: 900 });
  });
  it("iade ciroyu ve maliyeti düşürür; iptal tamamen hariç tutulur", async () => {
    const s1 = await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId: vid, adet: 4 }], indirim: 400 }, t.mudur); // net 3600
    await satisIade(s1.id, [{ kalemId: s1.kalemler[0].id, adet: 1 }], t.mudur); // -900
    const s2 = await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId: vid, adet: 2 }] }, t.mudur);
    await satisIptal(s2.id, t.mudur);
    const { bas, bit } = BUGUN();
    const o = await ozet(bas, bit);
    expect(o.satis).toBe(2700);
    expect(o.satisAdet).toBe(3);
    expect(o.maliyet).toBe(1500);
    expect(o.satisSayisi).toBe(1);
  });
  it("şube kapsamı yalnızca o şubeyi sayar", async () => {
    await malKabul({ subeId: t.b.id, kalemler: [{ varyantId: vid, adet: 5, birimMaliyet: 500 }] }, t.admin);
    await satisYap({ subeId: t.b.id, odemeTipi: "NAKIT", kalemler: [{ varyantId: vid, adet: 1 }] }, t.admin);
    await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId: vid, adet: 2 }] }, t.mudur);
    const { bas, bit } = BUGUN();
    expect((await ozet(bas, bit, t.b.id)).satis).toBe(1000);
    expect((await ozet(bas, bit, t.a.id)).satis).toBe(2000);
    expect((await ozet(bas, bit)).satis).toBe(3000);
    const k = await subeKarsilastirma(bas, bit);
    expect(k.find((x) => x.subeId === t.a.id)?.satis).toBe(2000);
  });
  it("dönem sınırları: dünün kayıtları bugüne girmez", async () => {
    const s = await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId: vid, adet: 1 }] }, t.mudur);
    await prisma.satis.update({ where: { id: s.id }, data: { createdAt: new Date(Date.now() - 36 * 3600_000) } });
    const { bas, bit } = BUGUN();
    expect((await ozet(bas, bit)).satis).toBe(0);
    const ay = await donemOzetleri();
    expect(Object.keys(ay)).toEqual(["bugun", "hafta", "ay", "yil"]);
  });
  it("sıfırlama noktası öncesini saymaz", async () => {
    await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId: vid, adet: 1 }] }, t.mudur);
    const { bas, bit } = BUGUN();
    const nokta = new Date(Date.now() + 1000);
    expect((await ozet(bas, bit, undefined, nokta)).satis).toBe(0);
    expect((await ozet(bas, bit)).satis).toBe(1000);
  });
});

describe("tek geçişli dönem özeti", () => {
  it("4 dönem için eski (ayrı sorgulu) hesapla birebir aynı sonucu verir; sıfırlama noktasıyla da", async () => {
    // bugün, 3 gün önce, 20 gün önce, 200 gün önce satışlar + alış + gider + gelir
    for (const gunOnce of [0, 0, 3, 20, 200]) {
      const s = await satisYap({ subeId: t.a.id, odemeTipi: gunOnce % 2 ? "KART" : "NAKIT", kalemler: [{ varyantId: vid, adet: 1 }], indirim: gunOnce === 3 ? 50 : 0 }, t.mudur);
      const tarih = new Date(Date.now() - gunOnce * 86_400_000);
      await prisma.satis.update({ where: { id: s.id }, data: { createdAt: tarih } });
    }
    await prisma.alisBelgesi.updateMany({ data: { tarih: new Date(Date.now() - 2 * 86_400_000) } });
    await prisma.kasaKaydi.create({ data: { tip: "GIDER", kategori: "Kira", tutar: "300.00", tarih: new Date(Date.now() - 1 * 86_400_000) } });
    await prisma.kasaKaydi.create({ data: { tip: "GELIR", kategori: "Diğer", tutar: "120.50", tarih: new Date(Date.now() - 40 * 86_400_000) } });
    const cikar = (x: Record<string, unknown>) => Object.fromEntries(Object.entries(x).map(([d, v]) => [d, { ...(v as object), bas: undefined, bit: undefined }]));
    for (const sinir of [null, new Date(Date.now() - 10 * 86_400_000)]) {
      const eski = await donemOzetleri(undefined, sinir);
      const yeni = await donemOzetleriHizli(undefined, sinir);
      expect(cikar(yeni)).toEqual(cikar(eski));
      const subeli = await donemOzetleri(t.a.id, sinir);
      expect(cikar(await donemOzetleriHizli(t.a.id, sinir))).toEqual(cikar(subeli));
    }
  });
});

describe("seri ve kırılımlar", () => {
  it("günlük seri boş günleri sıfırla doldurur", async () => {
    await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId: vid, adet: 1 }] }, t.mudur);
    const { bas } = donemAraligi("hafta");
    const bit = donemAraligi("hafta").bit;
    const seri = await gunlukSeri(bas, bit);
    expect(seri).toHaveLength(7);
    expect(seri.reduce((s, x) => s + x.satis, 0)).toBe(1000);
  });
  it("marka/renk/beden kırılımı ve kar", async () => {
    await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId: vid, adet: 3 }] }, t.mudur);
    const { bas, bit } = BUGUN();
    expect(await kirilim("marka", bas, bit)).toEqual([{ ad: "Hugo", adet: 3, ciro: 3000, maliyet: 1500, kar: 1500 }]);
    expect((await kirilim("renk", bas, bit))[0].ad).toBe("Mavi");
    expect((await kirilim("beden", bas, bit))[0].ad).toBe("32");
  });
  it("stok değeri ve kritik stok", async () => {
    const d = await stokDegeri();
    expect(d).toMatchObject({ adet: 10, maliyetDegeri: 5000, satisDegeri: 10000, cesit: 1 });
    await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId: vid, adet: 7 }] }, t.mudur);
    const k = await kritikStoklar();
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({ miktar: 3, minStok: 3, renk: "Mavi" });
  });
});

describe("sıfırlama", () => {
  it("istatistik sıfırlama geri alınabilir ve hiçbir kayıt silmez", async () => {
    await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId: vid, adet: 1 }] }, t.mudur);
    expect(await sifirlamaNoktasi()).toBeNull();
    await istatistikSifirla();
    expect(await sifirlamaNoktasi()).toBeInstanceOf(Date);
    expect(await prisma.satis.count()).toBe(1);
    await istatistikGeriAl();
    expect(await sifirlamaNoktasi()).toBeNull();
  });
  it("onay metni Türkçe büyük/küçük harf ve boşluktan etkilenmez", () => {
    expect(onayMetniDogru("  fabrika ayarlarına   dön ", ONAY_FABRIKA)).toBe(true);
    expect(onayMetniDogru("fabrika ayarlarina don", ONAY_FABRIKA)).toBe(false);
    expect(onayMetniDogru("", ONAY_FABRIKA)).toBe(false);
  });
  it("fabrika ayarları her şeyi siler, yalnız işlemi yapan süper admini ve varsayılanları bırakır", async () => {
    await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId: vid, adet: 1 }] }, t.mudur);
    await prisma.kasaKaydi.create({ data: { tip: "GIDER", kategori: "Kira", tutar: "1.00" } });
    await expect(fabrikaSifirla(t.mudur.id)).rejects.toThrow(/süper admin/);
    await fabrikaSifirla(t.admin.id);
    expect(await prisma.satis.count()).toBe(0);
    expect(await prisma.urun.count()).toBe(0);
    expect(await prisma.stok.count()).toBe(0);
    expect(await prisma.stokHareketi.count()).toBe(0);
    // Ana (en eski) şube Merkez kalır ve sayacı sıfırlanır; diğer şubeler silinir
    const subeler = await prisma.sube.findMany();
    expect(subeler.map((s) => s.id)).toEqual([t.a.id]);
    expect(subeler[0].satisSayac).toBe(0);
    expect(await prisma.kasaKaydi.count()).toBe(0);
    const kullanicilar = await prisma.kullanici.findMany();
    expect(kullanicilar.map((k) => k.id)).toEqual([t.admin.id]);
    expect(await prisma.kategori.count()).toBeGreaterThan(5); // varsayılanlar geri yüklendi
    // sistem sıfırdan kullanılabilir
    const s = await prisma.sube.create({ data: { ad: "Yeni", kod: "YNI" } });
    const r = await urunOlustur({ ad: "Yeni Ürün", varyantlar: [{ renk: "Siyah", beden: "M", alisFiyati: 1, satisFiyati: 2, adet: 1 }] }, s.id, t.admin);
    expect(r.varyantlar[0].barkod).toMatch(/^20\d{11}$/);
    const ilk = await prisma.varyant.findFirstOrThrow();
    expect(ilk.barkod.slice(2, 12)).toBe("0000000001"); // sayaç sıfırlandı
  });
});
