import { z } from "zod";
import { handler, IsHatasi } from "@/lib/api";
import { kritikIslemOnayi } from "@/lib/onay";
import { fabrikaSifirla, ONAY_FABRIKA } from "@/lib/sifirlama";
import { denetle } from "@/lib/denetim";

const sema = z.object({ anladim: z.literal(true), onay: z.string().max(60), sifre: z.string().min(1, "Şifrenizi girin").max(128) });

export const maxDuration = 60;

// KALICI: tüm veri silinir. Sunucu da onay metnini ve şifreyi ayrıca doğrular (arayüz atlansa bile korunur).
export const POST = handler({ roller: ["SUPER_ADMIN"], sema }, async ({ kullanici, govde }) => {
  if (!govde.anladim) throw new IsHatasi("Onay kutusu işaretlenmeli");
  await kritikIslemOnayi(kullanici, govde.onay, ONAY_FABRIKA, govde.sifre);
  await fabrikaSifirla(kullanici.id);
  await denetle({ ...kullanici, subeId: null }, "fabrika-sifirla", "sistem");
  return { tamam: true };
});