import { z } from "zod";
import { handler } from "@/lib/api";
import { kritikIslemOnayi } from "@/lib/onay";
import { istatistikSifirla, ONAY_ISTATISTIK } from "@/lib/sifirlama";
import { denetle } from "@/lib/denetim";

const sema = z.object({ onay: z.string().max(60), sifre: z.string().min(1, "Şifrenizi girin").max(128) });

// Geri alınabilir: kayıtlar silinmez, raporlar bu andan itibaren saymaya başlar
export const POST = handler({ roller: ["SUPER_ADMIN"], sema }, async ({ kullanici, govde }) => {
  await kritikIslemOnayi(kullanici, govde.onay, ONAY_ISTATISTIK, govde.sifre);
  const t = await istatistikSifirla();
  await denetle(kullanici, "istatistik-sifirla", "ayar", undefined, { nokta: t.toISOString() });
  return { nokta: t.toISOString() };
});