import { z } from "zod";
import { handler } from "@/lib/api";
import { topluUrunGirisi } from "@/lib/toplu";
import { denetle } from "@/lib/denetim";

export const maxDuration = 60;

const satir = z.object({
  id: z.string().min(1).max(60),
  varyantId: z.string().max(40).optional().nullable(),
  ad: z.string().trim().max(120),
  markaAd: z.string().trim().max(60).optional().nullable(),
  kategoriAd: z.string().trim().max(60).optional().nullable(),
  cinsiyet: z.enum(["KADIN", "ERKEK", "COCUK", "UNISEX"]).optional().nullable(),
  sezon: z.enum(["YAZLIK", "KISLIK", "IKI_SEZON"]).optional().nullable(),
  gorselUrl: z.string().max(300).regex(/^\/(api\/gorsel\/|urunler\/)[\w./-]+$/).optional().nullable(),
  tedarikciAd: z.string().trim().max(80).optional().nullable(),
  renk: z.string().trim().max(40),
  beden: z.string().trim().max(20),
  barkod: z.string().trim().max(40).optional().nullable(),
  adet: z.number().int().min(1).max(100_000),
  alisFiyati: z.number().min(0).max(10_000_000),
  satisFiyati: z.number().min(0).max(10_000_000),
});

const sema = z.object({ satirlar: z.array(satir).min(1, "Kaydedilecek satır yok").max(150, "Tek seferde en fazla 150 satır") });

export const POST = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"], sema }, async ({ kullanici, govde, islemSube }) => {
  const sonuclar = await topluUrunGirisi(govde.satirlar, islemSube(), kullanici);
  const basarili = sonuclar.filter((s) => s.durum !== "hata").length;
  await denetle(kullanici, "toplu-urun-girisi", "urun", undefined, { satir: sonuclar.length, basarili });
  return { sonuclar, basarili, hatali: sonuclar.length - basarili };
});