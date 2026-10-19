import { prisma } from "@/lib/db";
import { sayfaBaglami } from "@/lib/sayfa";
import { Baslik } from "@/components/ui";
import { EtiketIstemci } from "./EtiketIstemci";

export const metadata = { title: "Etiket Yazdır" };

export default async function EtiketlerSayfasi({ searchParams }: { searchParams: Promise<{ urun?: string }> }) {
  const { kapsam } = await sayfaBaglami("SUPER_ADMIN", "SUBE_MUDURU");
  const sp = await searchParams;
  const v = sp.urun
    ? await prisma.varyant.findMany({ where: { urunId: sp.urun, aktif: true }, include: { urun: { include: { marka: true } }, stoklar: { where: kapsam ? { subeId: kapsam } : undefined } }, orderBy: [{ renk: "asc" }, { beden: "asc" }] })
    : [];
  return (
    <>
      <Baslik baslik="Etiket Yazdır" aciklama="Ürünlere barkodlu raf/ürün etiketi basın. Üreticinin barkodu yoksa sistemin ürettiği barkod yazılır." />
      <EtiketIstemci baslangic={v.map((x) => ({ id: x.id, urunAdi: x.urun.ad, marka: x.urun.marka?.ad ?? null, gorselUrl: x.urun.gorselUrl, renk: x.renk, beden: x.beden, barkod: x.barkod, satisFiyati: Number(x.satisFiyati), alisFiyati: null, stok: x.stoklar.reduce((t, s) => t + s.miktar, 0) }))} />
    </>
  );
}
