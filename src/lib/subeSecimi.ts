import "server-only";
import { prisma } from "./db";

/** Çerezdeki şube kimliği gerçekten var ve aktif mi? Değilse "tüm şubeler" (undefined) say; sessizce boş veri gösterme. */
export async function gecerliSube(id: string | undefined | null): Promise<string | undefined> {
  if (!id) return undefined;
  const s = await prisma.sube.findFirst({ where: { id, aktif: true }, select: { id: true } });
  return s?.id;
}