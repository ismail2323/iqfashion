import { z } from "zod";
import { handler } from "@/lib/api";
import { kullaniciGuncelle } from "@/lib/hesaplar";
import { denetle } from "@/lib/denetim";

const sema = z.object({
  ad: z.string().trim().min(2).max(80).optional(),
  rol: z.enum(["SUPER_ADMIN", "SUBE_MUDURU", "KASIYER"]).optional(),
  subeId: z.string().nullable().optional(),
  aktif: z.boolean().optional(),
});

export const PATCH = handler({ roller: ["SUPER_ADMIN"], sema }, async ({ kullanici, govde, params }) => {
  const k = await kullaniciGuncelle(params.id, kullanici.id, govde);
  await denetle(kullanici, "kullanici-guncelle", "kullanici", k.id, govde);
  return { tamam: true };
});