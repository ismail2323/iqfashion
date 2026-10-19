import { z } from "zod";
import { handler } from "@/lib/api";
import { urunOlustur } from "@/lib/stok";
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
  const r = await urunOlustur(
    { ...govde, varyantlar: govde.varyantlar.map((v) => ({ ...v, renk: normalRenk(v.renk), beden: normalBeden(v.beden), barkod: v.barkod || undefined })) },
    islemSube(),
    kullanici,
  );
  await denetle(kullanici, "urun-olustur", "urun", r.urun.id, { ad: r.urun.ad, varyant: r.varyantlar.length });
  return { urunId: r.urun.id, varyantlar: r.varyantlar.map((v) => ({ id: v.id, renk: v.renk, beden: v.beden, barkod: v.barkod })) };
});