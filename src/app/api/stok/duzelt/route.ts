import { z } from "zod";
import { handler } from "@/lib/api";
import { stokDuzelt } from "@/lib/stok";

const sema = z.object({
  varyantId: z.string().min(1),
  yeniMiktar: z.number().int().min(0).max(1_000_000),
  sayim: z.boolean().optional(),
  aciklama: z.string().trim().max(200).optional(),
});

export const POST = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"], sema }, async ({ kullanici, govde, islemSube }) => stokDuzelt({ ...govde, subeId: islemSube() }, kullanici));