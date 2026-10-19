import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";

export const GET = handler({}, async () => {
  const [markalar, kategoriler, tedarikciler, subeler] = await Promise.all([
    prisma.marka.findMany({ orderBy: { ad: "asc" }, select: { ad: true } }),
    prisma.kategori.findMany({ orderBy: { ad: "asc" }, select: { ad: true } }),
    prisma.tedarikci.findMany({ orderBy: { ad: "asc" }, select: { ad: true } }),
    prisma.sube.findMany({ where: { aktif: true }, orderBy: { ad: "asc" }, select: { id: true, ad: true } }),
  ]);
  return { markalar: markalar.map((m) => m.ad), kategoriler: kategoriler.map((k) => k.ad), tedarikciler: tedarikciler.map((t) => t.ad), subeler };
});