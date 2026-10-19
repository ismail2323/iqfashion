import { z } from "zod";
import { handler } from "@/lib/api";
import { satisYap } from "@/lib/stok";

const sema = z.object({
  kalemler: z.array(z.object({ varyantId: z.string().min(1), adet: z.number().int().min(1).max(10_000), birimFiyat: z.number().min(0).max(10_000_000).optional() })).min(1, "Sepet boş").max(100),
  odemeTipi: z.enum(["NAKIT", "KART", "HAVALE", "KARISIK"]),
  indirim: z.number().min(0).max(10_000_000).optional(),
  notlar: z.string().trim().max(300).optional().nullable(),
});

export const POST = handler({ sema }, async ({ kullanici, govde, islemSube }) => {
  const s = await satisYap({ subeId: islemSube(), kalemler: govde.kalemler, odemeTipi: govde.odemeTipi, indirim: govde.indirim, notlar: govde.notlar }, kullanici);
  return { satis: { id: s.id, no: s.no, toplam: Number(s.toplam), indirim: Number(s.indirim), odemeTipi: s.odemeTipi, kalemSayisi: s.kalemler.length } };
});