import { z } from "zod";
import { handler } from "@/lib/api";
import { satisIade } from "@/lib/stok";
import { denetle } from "@/lib/denetim";

const sema = z.object({ kalemler: z.array(z.object({ kalemId: z.string().min(1), adet: z.number().int().min(1).max(10_000) })).min(1) });

export const POST = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"], sema }, async ({ kullanici, govde, params }) => {
  const r = await satisIade(params.id, govde.kalemler, kullanici);
  await denetle(kullanici, "satis-iade", "satis", params.id, { tutar: r.iadeTutari });
  return r;
});