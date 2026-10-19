import { z } from "zod";
import { handler } from "@/lib/api";
import { etiketOku, gorselCoz } from "@/lib/ai";

export const maxDuration = 60;

const sema = z.object({ gorsel: z.string().min(100).max(6_000_000) });

export const POST = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"], sema }, async ({ kullanici, govde }) => {
  return { sonuc: await etiketOku(gorselCoz(govde.gorsel), { kullaniciId: kullanici.id }) };
});
