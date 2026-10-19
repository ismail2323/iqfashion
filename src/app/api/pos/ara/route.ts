import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { maliyetGorebilir } from "@/lib/rbac";

/** POS / mal kabul / transfer için ürün araması: ad, marka, renk, beden, barkod, SKU. */
export const GET = handler({}, async ({ kullanici, kapsam, sorgu }) => {
  const q = (sorgu.get("q") ?? "").trim();
  if (q.length < 2) return { sonuclar: [] };
  const parcalar = q.split(/\s+/).slice(0, 4);
  const v = await prisma.varyant.findMany({
    where: {
      aktif: true,
      urun: { aktif: true },
      AND: parcalar.map((p) => ({
        OR: [
          { barkod: { contains: p } }, { sku: { contains: p, mode: "insensitive" as const } }, { renk: { contains: p, mode: "insensitive" as const } }, { beden: { equals: p, mode: "insensitive" as const } },
          { urun: { ad: { contains: p, mode: "insensitive" as const } } }, { urun: { marka: { ad: { contains: p, mode: "insensitive" as const } } } },
        ],
      })),
    },
    include: { urun: { include: { marka: true } }, stoklar: { where: kapsam ? { subeId: kapsam } : undefined } },
    take: 40,
    orderBy: [{ urun: { ad: "asc" } }, { renk: "asc" }, { beden: "asc" }],
  });
  return {
    sonuclar: v.map((x) => ({
      id: x.id, urunAdi: x.urun.ad, marka: x.urun.marka?.ad ?? null, gorselUrl: x.urun.gorselUrl, renk: x.renk, beden: x.beden, barkod: x.barkod,
      satisFiyati: Number(x.satisFiyati), alisFiyati: maliyetGorebilir(kullanici) ? Number(x.alisFiyati) : null, stok: x.stoklar.reduce((t, s) => t + s.miktar, 0),
    })).sort((a, b) => Number(b.stok > 0) - Number(a.stok > 0)),
  };
});