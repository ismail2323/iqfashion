import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { topluUrunGirisi, type TopluSatir } from "@/lib/toplu";
import { kur, temizle } from "./yardimci";

let t: Awaited<ReturnType<typeof kur>>;
const satir = (id: string, o: Partial<TopluSatir> = {}): TopluSatir => ({ id, ad: "Slim Kot", markaAd: "Hugo", kategoriAd: "Pantolon", renk: "Açık Mavi", beden: "32", adet: 2, alisFiyati: 900, satisFiyati: 1790, ...o });
const stok = async (vid: string) => (await prisma.stok.findUnique({ where: { varyantId_subeId: { varyantId: vid, subeId: t.a.id } } }))?.miktar ?? 0;

beforeEach(async () => {
  await temizle();
  t = await kur();
});

describe("toplu ürün girişi", () => {
  it("aynı ürünün farklı beden/renk satırları TEK ürün kartında birleşir", async () => {
    const r = await topluUrunGirisi([satir("1", { beden: "30" }), satir("2", { beden: "32" }), satir("3", { renk: "light blue", beden: "34" })], t.a.id, t.mudur);
    expect(r.every((x) => x.durum === "yeni")).toBe(true);
    expect(await prisma.urun.count()).toBe(1);
    const v = await prisma.varyant.findMany();
    expect(v).toHaveLength(3);
    expect(v.every((x) => x.renk === "Açık Mavi")).toBe(true); // normalize edildi
    expect(await prisma.alisBelgesi.count()).toBe(1);
  });
  it("aynı renk/beden satırlarının adedi toplanır", async () => {
    await topluUrunGirisi([satir("1", { adet: 2 }), satir("2", { adet: 3 })], t.a.id, t.mudur);
    const v = await prisma.varyant.findFirstOrThrow();
    expect(await stok(v.id)).toBe(5);
  });
  it("sonraki toplu girişte aynı ürüne yeni beden eklenir, aynı bedene stok eklenir (kopya ürün oluşmaz)", async () => {
    await topluUrunGirisi([satir("1")], t.a.id, t.mudur);
    const r = await topluUrunGirisi([satir("2", { beden: "34", adet: 4 }), satir("3", { adet: 1 })], t.a.id, t.mudur);
    expect(r.map((x) => x.durum)).toEqual(["varyant_eklendi", "varyant_eklendi"]);
    expect(await prisma.urun.count()).toBe(1);
    expect(await prisma.varyant.count()).toBe(2);
    const v32 = await prisma.varyant.findFirstOrThrow({ where: { beden: "32" } });
    expect(await stok(v32.id)).toBe(3); // 2 + 1
  });
  it("kayıtlı barkoda (varyantId) stok ekler ve maliyeti ortalar", async () => {
    await topluUrunGirisi([satir("1", { adet: 10 })], t.a.id, t.mudur);
    const v = await prisma.varyant.findFirstOrThrow();
    const r = await topluUrunGirisi([satir("2", { varyantId: v.id, adet: 10, alisFiyati: 1100 })], t.a.id, t.mudur);
    expect(r[0].durum).toBe("stok_eklendi");
    expect(await stok(v.id)).toBe(20);
    expect(Number((await prisma.varyant.findUniqueOrThrow({ where: { id: v.id } })).alisFiyati)).toBe(1000);
  });
  it("hatalı satır diğerlerini engellemez ve mesaj döner", async () => {
    const r = await topluUrunGirisi([satir("1", { ad: "  " }), satir("2", { adet: 0 }), satir("3", { ad: "Sağlam Ürün" })], t.a.id, t.mudur);
    expect(r[0]).toMatchObject({ durum: "hata", mesaj: expect.stringMatching(/Ürün adı/) });
    expect(r[1]).toMatchObject({ durum: "hata", mesaj: expect.stringMatching(/Adet/) });
    expect(r[2].durum).toBe("yeni");
    expect(await prisma.urun.count()).toBe(1);
  });
  it("BARKOD KURALI: sistemde kayıtlı barkod (istemci işaretlemese bile) mevcut varyanta stok ekler, yeni ürün açmaz", async () => {
    await topluUrunGirisi([satir("1", { barkod: "4006381333931", adet: 2 })], t.a.id, t.mudur);
    const v = await prisma.varyant.findFirstOrThrow({ where: { barkod: "4006381333931" } });
    // farklı ad/renk/beden yazılmış olsa da aynı barkod = aynı varyant
    const r = await topluUrunGirisi([satir("2", { ad: "Tamamen Farklı Ad", beden: "XL", barkod: "4006381333931", adet: 3 }), satir("3", { ad: "Üçüncü" })], t.a.id, t.mudur);
    expect(r[0]).toMatchObject({ durum: "stok_eklendi" });
    expect(r[1].durum).toBe("yeni");
    expect(await stok(v.id)).toBe(5);
    expect(await prisma.urun.count()).toBe(2); // Slim Kot + Üçüncü; "Tamamen Farklı Ad" ürünü AÇILMADI
  });
  it("aynı YENİ barkod aynı yüklemede birden çok satırda: tek varyant, adetler toplanır (hata yok)", async () => {
    const r = await topluUrunGirisi([satir("1", { barkod: "5901234123457", adet: 2 }), satir("2", { barkod: "5901234123457", adet: 4 }), satir("3", { barkod: "5901234123457", adet: 1 })], t.a.id, t.mudur);
    expect(r.every((x) => x.durum !== "hata")).toBe(true);
    const v = await prisma.varyant.findMany();
    expect(v).toHaveLength(1);
    expect(await stok(v[0].id)).toBe(7);
    expect(await prisma.urun.count()).toBe(1);
  });
  it("barkod geçerli ama bilinmiyorsa yeni ürün açılır; barkodsuz satıra sistem barkod üretir", async () => {
    const r = await topluUrunGirisi([satir("1", { barkod: "4006381333948" }), satir("2", { ad: "Barkodsuz", barkod: "" })], t.a.id, t.mudur);
    expect(r.map((x) => x.durum)).toEqual(["yeni", "yeni"]);
    const kodlar = (await prisma.varyant.findMany()).map((x) => x.barkod);
    expect(kodlar).toContain("4006381333948");
    expect(kodlar.some((k) => /^20\d{11}$/.test(k))).toBe(true);
  });
});