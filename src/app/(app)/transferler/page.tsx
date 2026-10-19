import { prisma } from "@/lib/db";
import { sayfaBaglami } from "@/lib/sayfa";
import { Baslik } from "@/components/ui";
import { TransferIstemci } from "./TransferIstemci";

export const metadata = { title: "Transferler" };

export default async function TransferlerSayfasi() {
  const { kullanici, kapsam } = await sayfaBaglami("SUPER_ADMIN", "SUBE_MUDURU");
  const [transferler, subeler] = await Promise.all([
    prisma.transfer.findMany({
      where: kapsam ? { OR: [{ kaynakSubeId: kapsam }, { hedefSubeId: kapsam }] } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { kaynak: { select: { id: true, ad: true } }, hedef: { select: { id: true, ad: true } }, kalemler: true },
    }),
    prisma.sube.findMany({ where: { aktif: true }, orderBy: { ad: "asc" }, select: { id: true, ad: true } }),
  ]);
  return (
    <>
      <Baslik baslik="Transferler" aciklama="Şubeler arası ürün aktarımı: gönderen “Gönder”, alan “Teslim al” der." />
      <TransferIstemci
        subeler={subeler} kaynakId={kapsam ?? null} superAdmin={kullanici.rol === "SUPER_ADMIN"} benimSube={kullanici.subeId}
        transferler={transferler.map((t) => ({
          id: t.id, no: t.no, durum: t.durum, tarih: t.createdAt.toISOString(), notlar: t.notlar, kaynak: t.kaynak, hedef: t.hedef,
          kalemler: t.kalemler.map((k) => ({ id: k.id, urunAdi: k.urunAdi, renk: k.renk, beden: k.beden, miktar: k.miktar })),
        }))}
      />
    </>
  );
}
