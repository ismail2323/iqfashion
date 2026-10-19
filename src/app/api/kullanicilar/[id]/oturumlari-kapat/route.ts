import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { denetle } from "@/lib/denetim";

export const POST = handler({ roller: ["SUPER_ADMIN"] }, async ({ kullanici, params }) => {
  const r = await prisma.oturum.deleteMany({ where: { kullaniciId: params.id } });
  await denetle(kullanici, "oturumlari-kapat", "kullanici", params.id, { adet: r.count });
  return { kapatilan: r.count };
});