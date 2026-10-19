import { handler, IsHatasi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { denetle } from "@/lib/denetim";

export const DELETE = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"] }, async ({ kullanici, params, kapsam }) => {
  const k = await prisma.kasaKaydi.findUnique({ where: { id: params.id } });
  if (!k || (kullanici.rol !== "SUPER_ADMIN" && k.subeId !== kapsam)) throw new IsHatasi("Kayıt bulunamadı", 404);
  await prisma.kasaKaydi.delete({ where: { id: k.id } });
  await denetle(kullanici, "kasa-sil", "kasa", k.id, { tip: k.tip, tutar: Number(k.tutar), kategori: k.kategori });
  return { tamam: true };
});