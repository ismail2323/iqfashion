import { Store } from "lucide-react";
import { prisma } from "@/lib/db";
import { sayfaBaglami } from "@/lib/sayfa";
import { paraFormat } from "@/lib/para";
import { tarihFormat } from "@/lib/tarih";
import { Baslik, BosDurum, Kart } from "@/components/ui";
import { AlisIstemci } from "./AlisIstemci";

export const metadata = { title: "Mal Kabul" };

export default async function AlisSayfasi({ searchParams }: { searchParams: Promise<{ urun?: string }> }) {
  const { kapsam } = await sayfaBaglami("SUPER_ADMIN", "SUBE_MUDURU");
  const sp = await searchParams;
  if (!kapsam) {
    return (
      <>
        <Baslik baslik="Mal Kabul" />
        <Kart className="flex items-start gap-3 p-5 text-sm"><Store className="mt-0.5 size-5 shrink-0 text-warn" /><p>Mal kabul bir şubeye yapılır. Üstteki menüden şubeyi seçin.</p></Kart>
      </>
    );
  }
  const [sube, belgeler, baslangic] = await Promise.all([
    prisma.sube.findUnique({ where: { id: kapsam }, select: { ad: true } }),
    prisma.alisBelgesi.findMany({ where: { subeId: kapsam }, orderBy: { tarih: "desc" }, take: 15, include: { tedarikci: true, kalemler: true } }),
    sp.urun
      ? prisma.varyant.findMany({ where: { urunId: sp.urun, aktif: true }, include: { urun: { include: { marka: true } }, stoklar: { where: { subeId: kapsam } } }, orderBy: [{ renk: "asc" }, { beden: "asc" }] })
      : Promise.resolve([]),
  ]);
  return (
    <>
      <Baslik baslik="Mal Kabul" aciklama={`${sube?.ad} şubesine ürün girişi (tedarikçiden gelen mal)`} />
      <AlisIstemci baslangic={baslangic.map((v) => ({ id: v.id, urunAdi: v.urun.ad, marka: v.urun.marka?.ad ?? null, gorselUrl: v.urun.gorselUrl, renk: v.renk, beden: v.beden, barkod: v.barkod, satisFiyati: Number(v.satisFiyati), alisFiyati: Number(v.alisFiyati), stok: v.stoklar.reduce((t, s) => t + s.miktar, 0) }))} />
      <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Son mal kabuller</h2>
      {belgeler.length === 0 ? <Kart><BosDurum baslik="Henüz mal kabul yok" /></Kart> : (
        <div className="space-y-3">
          {belgeler.map((b) => (
            <Kart key={b.id} className="overflow-hidden">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-sm">
                  <span className="font-medium">{tarihFormat(b.tarih, true)} · {b.tedarikci?.ad ?? "Tedarikçi belirtilmedi"}{b.no && ` · ${b.no}`}</span>
                  <span className="tabular"><span className="text-muted">{b.kalemler.reduce((t, k) => t + k.miktar, 0)} adet · </span><b>{paraFormat(b.toplam.toString())}</b></span>
                </summary>
                <ul className="divide-y divide-border border-t border-border text-sm">
                  {b.kalemler.map((k) => <li key={k.id} className="flex justify-between gap-3 px-5 py-2"><span>{k.urunAdi} <span className="text-muted">{k.renk}/{k.beden}</span></span><span className="tabular text-muted">{k.miktar} × {paraFormat(k.birimMaliyet.toString())}</span></li>)}
                </ul>
              </details>
            </Kart>
          ))}
        </div>
      )}
    </>
  );
}
