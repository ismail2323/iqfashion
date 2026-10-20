import { z } from "zod";
import { handler } from "@/lib/api";
import { malKabul, urunOlustur } from "@/lib/stok";
import { prisma } from "@/lib/db";
import { denetle } from "@/lib/denetim";
import { normalBeden, normalRenk } from "@/lib/giyim";

const varyant = z.object({
  renk: z.string().trim().min(1, "Renk gerekli").max(40),
  beden: z.string().trim().min(1, "Beden gerekli").max(20),
  barkod: z.string().trim().max(40).optional().nullable(),
  alisFiyati: z.number().min(0, "Alış fiyatı negatif olamaz").max(10_000_000),
  satisFiyati: z.number().min(0, "Satış fiyatı negatif olamaz").max(10_000_000),
  adet: z.number().int().min(0).max(100_000),
  minStok: z.number().int().min(0).max(1000).optional(),
});

const sema = z.object({
  ad: z.string().trim().min(2, "Ürün adı en az 2 karakter").max(120),
  markaAd: z.string().trim().max(60).optional().nullable(),
  kategoriAd: z.string().trim().max(60).optional().nullable(),
  cinsiyet: z.enum(["KADIN", "ERKEK", "COCUK", "UNISEX"]).optional().nullable(),
  sezon: z.enum(["YAZLIK", "KISLIK", "IKI_SEZON"]).optional().nullable(),
  aciklama: z.string().trim().max(500).optional().nullable(),
  gorselUrl: z.string().max(300).regex(/^\/(api\/gorsel\/|urunler\/)[\w./-]+$/, "Geçersiz görsel adresi").optional().nullable(),
  tedarikciAd: z.string().trim().max(80).optional().nullable(),
  varyantlar: z.array(varyant).min(1, "En az bir renk/beden ekleyin").max(200),
});

export const POST = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"], sema }, async ({ kullanici, govde, islemSube }) => {
  const subeId = islemSube();
  const varyantlar = govde.varyantlar.map((v) => ({ ...v, renk: normalRenk(v.renk), beden: normalBeden(v.beden), barkod: v.barkod || undefined }));

  // BARKOD KURALI: barkod sistemde varsa o varyanta stok eklenir (hata verilmez); yoksa yeni varyant/ürün açılır.
  const kodlar = varyantlar.map((v) => v.barkod).filter((k): k is string => !!k);
  const kayitli = kodlar.length ? await prisma.varyant.findMany({ where: { barkod: { in: kodlar } }, include: { urun: true } }) : [];
  const kayitliHarita = new Map(kayitli.map((v) => [v.barkod, v]));
  // Yalnızca renk/beden de AYNIYSA aynı varyanttır. Barkod kayıtlı ama renk/beden farklıysa (aynı barkod birden çok
  // renge basılmış olabilir) veri birleştirilmez: ayrı varyant açılır ve sistem barkodu verilir.
  const uyumlu = (v: (typeof varyantlar)[number]) => {
    const k = v.barkod ? kayitliHarita.get(v.barkod) : undefined;
    return !!k && k.renk.toLowerCase() === v.renk.toLowerCase() && k.beden.toLowerCase() === v.beden.toLowerCase();
  };
  const mevcutlar = varyantlar.filter(uyumlu);
  const yeniler = varyantlar.filter((v) => !uyumlu(v)).map((v) => (v.barkod && kayitliHarita.has(v.barkod) ? { ...v, barkod: undefined } : v));
  const stokluMevcut = mevcutlar.filter((v) => v.adet > 0);
  if (stokluMevcut.length) {
    await malKabul({ subeId, tedarikciAd: govde.tedarikciAd, notlar: "Ürün girişi (mevcut barkod)", kalemler: stokluMevcut.map((v) => ({ varyantId: kayitliHarita.get(v.barkod!)!.id, adet: v.adet, birimMaliyet: v.alisFiyati })) }, kullanici);
  }

  if (!yeniler.length) {
    const ilk = kayitliHarita.get(mevcutlar[0].barkod!)!;
    await denetle(kullanici, "urun-stok-eklendi", "urun", ilk.urunId, { mevcutBarkod: mevcutlar.length });
    return { urunId: ilk.urunId, mevcutBarkod: mevcutlar.length, varyantlar: mevcutlar.map((v) => { const k = kayitliHarita.get(v.barkod!)!; return { id: k.id, renk: k.renk, beden: k.beden, barkod: k.barkod }; }) };
  }
  const r = await urunOlustur({ ...govde, varyantlar: yeniler }, subeId, kullanici);
  await denetle(kullanici, "urun-olustur", "urun", r.urun.id, { ad: r.urun.ad, varyant: r.varyantlar.length, mevcutBarkod: mevcutlar.length });
  return { urunId: r.urun.id, mevcutBarkod: mevcutlar.length, varyantlar: r.varyantlar.map((v) => ({ id: v.id, renk: v.renk, beden: v.beden, barkod: v.barkod })) };
});