import { z } from "zod";
import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { denetle } from "@/lib/denetim";

const sema = z.object({ dukkanAdi: z.string().trim().min(2, "Mağaza adı en az 2 karakter").max(60) });

export const PATCH = handler({ roller: ["SUPER_ADMIN"], sema }, async ({ kullanici, govde }) => {
  await prisma.ayar.upsert({ where: { anahtar: "dukkanAdi" }, update: { deger: govde.dukkanAdi }, create: { anahtar: "dukkanAdi", deger: govde.dukkanAdi } });
  await denetle(kullanici, "ayar-guncelle", "ayar", "dukkanAdi", { deger: govde.dukkanAdi });
  return { tamam: true };
});