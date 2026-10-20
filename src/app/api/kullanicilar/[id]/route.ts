import { z } from "zod";
import { handler } from "@/lib/api";
import { kullaniciGuncelle, kullaniciSil } from "@/lib/hesaplar";
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
export const DELETE = handler({ roller: ["SUPER_ADMIN"] }, async ({ kullanici, params }) => {
  const k = await kullaniciSil(params.id, kullanici.id);
  await denetle(kullanici, "kullanici-sil", "kullanici", k.id, { email: k.email, ad: k.ad, rol: k.rol });
  return { tamam: true };
});