import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";

export const GET = handler({ sifreMuaf: true }, async ({ kullanici }) => {
  const sube = kullanici.subeId
    ? await prisma.sube.findUnique({ where: { id: kullanici.subeId }, select: { id: true, ad: true, kod: true } })
    : null;
  return { kullanici, sube };
});
