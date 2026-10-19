import "server-only";
import { prisma } from "./db";
import type { Oturumlu } from "./rbac";
import type { Prisma } from "@/generated/prisma/client";

export async function denetle(
  k: Oturumlu | null,
  eylem: string,
  nesne: string,
  nesneId?: string,
  detay?: Prisma.InputJsonValue,
  ip?: string,
) {
  try {
    await prisma.denetimKaydi.create({
      data: { kullaniciId: k?.id, kullaniciSnap: k ? `${k.ad} <${k.email}>` : null, eylem, nesne, nesneId, detay, ip },
    });
  } catch (e) {
    console.error("[denetim]", e);
  }
}
