import { z } from "zod";
import { handler } from "@/lib/api";
import { transferOlustur } from "@/lib/stok";

const sema = z.object({
  hedefSubeId: z.string().min(1, "Hedef şubeyi seçin"),
  kaynakSubeId: z.string().optional(),
  notlar: z.string().trim().max(300).optional().nullable(),
  kalemler: z.array(z.object({ varyantId: z.string().min(1), adet: z.number().int().min(1).max(100_000) })).min(1, "En az bir ürün ekleyin").max(200),
});

// Kaynak şube: şube kullanıcısı için kendi şubesi; süper admin için seçili şube (ya da gövdedeki kaynakSubeId)
export const POST = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"], sema }, async ({ kullanici, govde, kapsam }) => {
  const kaynak = kullanici.rol === "SUPER_ADMIN" ? govde.kaynakSubeId || kapsam : kapsam;
  if (!kaynak) throw new (await import("@/lib/hatalar")).IsHatasi("Gönderen şubeyi seçin");
  const t = await transferOlustur({ kaynakSubeId: kaynak, hedefSubeId: govde.hedefSubeId, notlar: govde.notlar, kalemler: govde.kalemler }, kullanici);
  return { transfer: { id: t.id, no: t.no } };
});