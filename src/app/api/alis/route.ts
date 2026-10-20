import { z } from "zod";
import { handler } from "@/lib/api";
import { malKabul } from "@/lib/stok";

const sema = z.object({
  tedarikciAd: z.string().trim().max(80).optional().nullable(),
  belgeNo: z.string().trim().max(40).optional().nullable(),
  notlar: z.string().trim().max(300).optional().nullable(),
  kalemler: z.array(z.object({ varyantId: z.string().min(1), adet: z.number().int().min(1).max(100_000), birimMaliyet: z.number().min(0).max(10_000_000), satisFiyati: z.number().min(0).max(10_000_000).optional() })).min(1, "En az bir kalem ekleyin").max(300),
});

export const POST = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"], sema }, async ({ kullanici, govde, islemSube }) => {
  const b = await malKabul({ subeId: islemSube(), ...govde }, kullanici);
  return { belge: { id: b.id, toplam: Number(b.toplam) } };
});