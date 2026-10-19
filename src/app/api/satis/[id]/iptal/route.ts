import { handler } from "@/lib/api";
import { satisIptal } from "@/lib/stok";
import { denetle } from "@/lib/denetim";

export const POST = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"] }, async ({ kullanici, params }) => {
  const s = await satisIptal(params.id, kullanici);
  await denetle(kullanici, "satis-iptal", "satis", s.id, { no: s.no });
  return { tamam: true };
});