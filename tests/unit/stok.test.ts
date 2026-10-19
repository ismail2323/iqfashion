import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { malKabul, satisIade, satisIptal, satisYap, stokDuzelt, transferGonder, transferIptal, transferOlustur, transferTeslimAl, urunOlustur } from "@/lib/stok";
import { eanGecerli } from "@/lib/barkod";
import { kur, temizle } from "./yardimci";

let t: Awaited<ReturnType<typeof kur>>;
let varyantId: string;

const stok = async (subeId: string, vid = varyantId) => (await prisma.stok.findUnique({ where: { varyantId_subeId: { varyantId: vid, subeId } } }))?.miktar ?? 0;

async function urunHazirla(adet = 10) {
  const r = await urunOlustur(
    { ad: "Polo Tişört", markaAd: "Lacoste", kategoriAd: "Tişört", varyantlar: [{ renk: "Siyah", beden: "M", alisFiyati: 400, satisFiyati: 1000, adet, minStok: 2 }] },
    t.a.id,
    t.mudur,
  );
  varyantId = r.varyantlar[0].id;
}

beforeEach(async () => {
  await temizle();
  t = await kur();
  await urunHazirla();
});

describe("ürün oluşturma", () => {
  it("barkod yoksa geçerli dahili EAN-13 üretir, stok + alış belgesi + hareket yazar", async () => {
    const v = await prisma.varyant.findUniqueOrThrow({ where: { id: varyantId } });
    expect(eanGecerli(v.barkod)).toBe(true);
    expect(await stok(t.a.id)).toBe(10);
    const belge = await prisma.alisBelgesi.findFirstOrThrow({ include: { kalemler: true } });
    expect(Number(belge.toplam)).toBe(4000);
    expect(belge.kalemler).toHaveLength(1);
    expect(await prisma.stokHareketi.count({ where: { tip: "ALIS" } })).toBe(1);
  });
  it("aynı barkodu ikinci kez kabul etmez ve hiçbir şey yazmaz (rollback)", async () => {
    const mevcut = (await prisma.varyant.findUniqueOrThrow({ where: { id: varyantId } })).barkod;
    const urunSayisi = await prisma.urun.count();
    await expect(
      urunOlustur({ ad: "Başka", varyantlar: [{ renk: "Beyaz", beden: "L", barkod: mevcut, alisFiyati: 1, satisFiyati: 2, adet: 1 }] }, t.a.id, t.mudur),
    ).rejects.toThrow(/zaten kayıtlı/);
    expect(await prisma.urun.count()).toBe(urunSayisi);
  });
  it("aynı renk/beden iki kez girilemez", async () => {
    await expect(
      urunOlustur({ ad: "X", varyantlar: [{ renk: "Siyah", beden: "M", alisFiyati: 1, satisFiyati: 2, adet: 1 }, { renk: "siyah", beden: "m", alisFiyati: 1, satisFiyati: 2, adet: 1 }] }, t.a.id, t.mudur),
    ).rejects.toThrow(/iki kez/);
  });
});

describe("satış", () => {
  it("stoğu düşürür, maliyeti ve indirim payını kaydeder", async () => {
    const s = await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId, adet: 3 }], indirim: 100 }, t.mudur);
    expect(await stok(t.a.id)).toBe(7);
    expect(Number(s.toplam)).toBe(2900);
    expect(Number(s.maliyet)).toBe(1200);
    expect(Number(s.kalemler[0].indirimPayi)).toBe(100);
    expect(s.no).toMatch(/^MRK-\d{8}-0001$/);
  });
  it("yetersiz stokta reddeder ve sepetin hiçbir satırı işlenmez", async () => {
    const r2 = await urunOlustur({ ad: "Pantolon", varyantlar: [{ renk: "Mavi", beden: "32", alisFiyati: 100, satisFiyati: 300, adet: 1 }] }, t.a.id, t.mudur);
    const v2 = r2.varyantlar[0].id;
    await expect(satisYap({ subeId: t.a.id, odemeTipi: "KART", kalemler: [{ varyantId, adet: 2 }, { varyantId: v2, adet: 5 }] }, t.mudur)).rejects.toThrow(/Yetersiz stok/);
    expect(await stok(t.a.id)).toBe(10);
    expect(await prisma.satis.count()).toBe(0);
  });
  it("20 eşzamanlı satış 10 adetlik stoğu aşamaz (yarış koşulu)", async () => {
    const sonuc = await Promise.allSettled(
      Array.from({ length: 20 }, () => satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId, adet: 1 }] }, t.mudur)),
    );
    expect(sonuc.filter((s) => s.status === "fulfilled")).toHaveLength(10);
    expect(await stok(t.a.id)).toBe(0);
    expect(await prisma.satis.count()).toBe(10);
    const nolar = (await prisma.satis.findMany()).map((s) => s.no);
    expect(new Set(nolar).size).toBe(10); // fiş numaraları çakışmaz
  });
  it("kasiyer fiyat/indirim değiştiremez ama liste fiyatıyla satabilir", async () => {
    await expect(satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId, adet: 1, birimFiyat: 1 }] }, t.kasiyer)).rejects.toThrow(/yönetici/);
    await expect(satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId, adet: 1 }], indirim: 10 }, t.kasiyer)).rejects.toThrow(/yönetici/);
    const s = await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId, adet: 1 }] }, t.kasiyer);
    expect(Number(s.toplam)).toBe(1000);
  });
  it("indirim ara toplamı aşamaz, aynı varyant satırları birleşir", async () => {
    await expect(satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId, adet: 1 }], indirim: 5000 }, t.mudur)).rejects.toThrow(/İndirim/);
    const s = await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId, adet: 1 }, { varyantId, adet: 2 }] }, t.mudur);
    expect(s.kalemler).toHaveLength(1);
    expect(s.kalemler[0].miktar).toBe(3);
  });
  it("iptal stoğu geri verir; ikinci iptal reddedilir", async () => {
    const s = await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId, adet: 4 }] }, t.mudur);
    await expect(satisIptal(s.id, t.kasiyer)).rejects.toThrow(/yönetici/);
    await satisIptal(s.id, t.mudur);
    expect(await stok(t.a.id)).toBe(10);
    await expect(satisIptal(s.id, t.mudur)).rejects.toThrow(/zaten/);
  });
  it("kısmi iade stoğa döner, fazla iade reddedilir, iade sonrası iptal sadece kalanı geri alır", async () => {
    const s = await satisYap({ subeId: t.a.id, odemeTipi: "NAKIT", kalemler: [{ varyantId, adet: 4 }], indirim: 400 }, t.mudur);
    const kalemId = s.kalemler[0].id;
    const r = await satisIade(s.id, [{ kalemId, adet: 1 }], t.mudur);
    expect(r.iadeTutari).toBe(900); // (4000-400)/4
    expect(await stok(t.a.id)).toBe(7);
    await expect(satisIade(s.id, [{ kalemId, adet: 4 }], t.mudur)).rejects.toThrow(/aşıyor/);
    await satisIptal(s.id, t.mudur);
    expect(await stok(t.a.id)).toBe(10); // 7 + kalan 3
  });
});

describe("mal kabul", () => {
  it("maliyeti toplam stok üzerinden ağırlıklı ortalama günceller", async () => {
    // 10 adet @400 mevcut; 10 adet @600 gelir -> 500
    await malKabul({ subeId: t.a.id, kalemler: [{ varyantId, adet: 10, birimMaliyet: 600 }] }, t.mudur);
    const v = await prisma.varyant.findUniqueOrThrow({ where: { id: varyantId } });
    expect(Number(v.alisFiyati)).toBe(500);
    expect(await stok(t.a.id)).toBe(20);
    expect(await prisma.fiyatGecmisi.count({ where: { varyantId } })).toBe(2);
  });
  it("geçersiz adet tüm belgeyi geri alır", async () => {
    const belgeSayisi = await prisma.alisBelgesi.count();
    await expect(malKabul({ subeId: t.a.id, kalemler: [{ varyantId, adet: 5, birimMaliyet: 1 }, { varyantId, adet: 0, birimMaliyet: 1 }] }, t.mudur)).rejects.toThrow();
    expect(await prisma.alisBelgesi.count()).toBe(belgeSayisi);
    expect(await stok(t.a.id)).toBe(10);
  });
});

describe("transfer", () => {
  it("BEKLEMEDE -> YOLDA (kaynaktan düşer) -> TAMAMLANDI (hedefe eklenir)", async () => {
    const tr = await transferOlustur({ kaynakSubeId: t.a.id, hedefSubeId: t.b.id, kalemler: [{ varyantId, adet: 4 }] }, t.mudur);
    expect(await stok(t.a.id)).toBe(10); // henüz düşmedi
    await transferGonder(tr.id, t.mudur);
    expect(await stok(t.a.id)).toBe(6);
    expect(await stok(t.b.id)).toBe(0);
    await expect(transferGonder(tr.id, t.mudur)).rejects.toThrow(/gönderilemez/);
    await transferTeslimAl(tr.id, t.admin);
    expect(await stok(t.b.id)).toBe(4);
    await expect(transferTeslimAl(tr.id, t.admin)).rejects.toThrow(/teslim alınamaz/);
  });
  it("yoldaki transfer iptal edilince kaynağa geri döner", async () => {
    const tr = await transferOlustur({ kaynakSubeId: t.a.id, hedefSubeId: t.b.id, kalemler: [{ varyantId, adet: 4 }] }, t.mudur);
    await transferGonder(tr.id, t.mudur);
    await transferIptal(tr.id, t.mudur);
    expect(await stok(t.a.id)).toBe(10);
    expect(await stok(t.b.id)).toBe(0);
  });
  it("kaynakta yetersiz stok gönderimi reddeder ve durum BEKLEMEDE kalır", async () => {
    const tr = await transferOlustur({ kaynakSubeId: t.a.id, hedefSubeId: t.b.id, kalemler: [{ varyantId, adet: 99 }] }, t.mudur);
    await expect(transferGonder(tr.id, t.mudur)).rejects.toThrow(/Yetersiz stok/);
    expect((await prisma.transfer.findUniqueOrThrow({ where: { id: tr.id } })).durum).toBe("BEKLEMEDE");
  });
  it("yalnız kaynak şube gönderir, yalnız hedef şube teslim alır; aynı şubeye transfer yok", async () => {
    await expect(transferOlustur({ kaynakSubeId: t.a.id, hedefSubeId: t.a.id, kalemler: [{ varyantId, adet: 1 }] }, t.mudur)).rejects.toThrow(/aynı/);
    const tr = await transferOlustur({ kaynakSubeId: t.a.id, hedefSubeId: t.b.id, kalemler: [{ varyantId, adet: 1 }] }, t.mudur);
    const b2 = { ...t.mudur, subeId: t.b.id };
    await expect(transferGonder(tr.id, b2)).rejects.toThrow(/kaynak/);
    await transferGonder(tr.id, t.mudur);
    await expect(transferTeslimAl(tr.id, t.mudur)).rejects.toThrow(/hedef/);
  });
});

describe("düzeltme / sayım", () => {
  it("farkı hareket olarak yazar; negatif reddedilir; eşitse hareket yazmaz", async () => {
    const r = await stokDuzelt({ varyantId, subeId: t.a.id, yeniMiktar: 7, sayim: true }, t.mudur);
    expect(r).toMatchObject({ fark: -3, eski: 10, yeni: 7 });
    expect(await prisma.stokHareketi.count({ where: { tip: "SAYIM" } })).toBe(1);
    await expect(stokDuzelt({ varyantId, subeId: t.a.id, yeniMiktar: -1 }, t.mudur)).rejects.toThrow();
    const n = await prisma.stokHareketi.count();
    await stokDuzelt({ varyantId, subeId: t.a.id, yeniMiktar: 7 }, t.mudur);
    expect(await prisma.stokHareketi.count()).toBe(n);
  });
  it("veritabanı stoğun negatife düşmesine izin vermez (CHECK)", async () => {
    await expect(prisma.stok.update({ where: { varyantId_subeId: { varyantId, subeId: t.a.id } }, data: { miktar: -1 } })).rejects.toThrow();
  });
});
