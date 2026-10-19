import { z } from "zod";
import { handler } from "@/lib/api";
import { subeGuncelle, subeSil } from "@/lib/hesaplar";
import { denetle } from "@/lib/denetim";

const sema = z.object({
  ad: z.string().trim().min(2).max(80).optional(),
  adres: z.string().trim().max(200).nullable().optional(),
  telefon: z.string().trim().max(30).nullable().optional(),
  aktif: z.boolean().optional(),
});

export const PATCH = handler({ roller: ["SUPER_ADMIN"], sema }, async ({ kullanici, govde, params }) => {
  const s = await subeGuncelle(params.id, govde);
  await denetle(kullanici, govde.aktif === undefined ? "sube-guncelle" : govde.aktif ? "sube-aktif" : "sube-pasif", "sube", s.id, govde);
  return { sube: s };
});

export const DELETE = handler({ roller: ["SUPER_ADMIN"] }, async ({ kullanici, params }) => {
  await subeSil(params.id);
  await denetle(kullanici, "sube-sil", "sube", params.id);
  return { tamam: true };
});