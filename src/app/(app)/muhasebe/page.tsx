import { prisma } from "@/lib/db";
import { sayfaBaglami } from "@/lib/sayfa";
import { donemCoz, type DonemSP } from "@/lib/donemSecimi";
import { ozet } from "@/lib/rapor";
import { sifirlamaNoktasi } from "@/lib/sifirlama";
import { paraFormat } from "@/lib/para";
import { tarihFormat } from "@/lib/tarih";
import { Baslik, Kart, StatKart } from "@/components/ui";
import { DonemSecici } from "@/components/DonemSecici";
import { PastaGrafik } from "@/components/Grafikler";
import { ArrowDownRight, ArrowUpRight, Banknote, Landmark, PackageOpen, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { KasaIstemci } from "./KasaIstemci";

export const metadata = { title: "Muhasebe" };

export default async function MuhasebeSayfasi({ searchParams }: { searchParams: Promise<DonemSP> }) {
  const { kapsam } = await sayfaBaglami("SUPER_ADMIN", "SUBE_MUDURU");
  const sp = await searchParams;
  const d = donemCoz(sp);
  const sinir = await sifirlamaNoktasi();
  const bas = sinir && sinir > d.bas ? sinir : d.bas;

  const [o, kayitlar, tedarikciAlis] = await Promise.all([
    ozet(d.bas, d.bit, kapsam, sinir),
    prisma.kasaKaydi.findMany({ where: { tarih: { gte: bas, lt: d.bit }, ...(kapsam ? { subeId: kapsam } : {}) }, orderBy: { tarih: "desc" }, take: 200 }),
    prisma.alisBelgesi.groupBy({ by: ["tedarikciId"], where: { tarih: { gte: bas, lt: d.bit }, ...(kapsam ? { subeId: kapsam } : {}) }, _sum: { toplam: true } }),
  ]);
  const tedarikciler = await prisma.tedarikci.findMany({ where: { id: { in: tedarikciAlis.map((t) => t.tedarikciId).filter((x): x is string => !!x) } } });
  const giderKategori = new Map<string, number>();
  for (const k of kayitlar.filter((x) => x.tip === "GIDER")) giderKategori.set(k.kategori, (giderKategori.get(k.kategori) ?? 0) + Number(k.tutar));
  if (o.alis > 0) giderKategori.set("Mal alımı", o.alis);
  const giderVeri = [...giderKategori].map(([ad, deger]) => ({ ad, deger })).sort((a, b) => b.deger - a.deger);

  return (
    <>
      <Baslik baslik="Muhasebe" aciklama={`${d.etiket}${kapsam ? "" : " · tüm şubeler"}`} />
      <DonemSecici yol="/muhasebe" donem={d.donem} bas={sp.bas} bit={sp.bit} />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatKart etiket="Satış (net)" deger={paraFormat(o.satis)} alt={`${o.satisAdet} adet · ${o.satisSayisi} satış`} ikon={<ShoppingCart className="size-4" />} ton="vurgu" />
        <StatKart etiket="Mal alışı" deger={paraFormat(o.alis)} alt={`${o.alisAdet} adet`} ikon={<PackageOpen className="size-4" />} ton="bilgi" />
        <StatKart etiket="Gelir" deger={paraFormat(o.gelir)} alt={`Satış + diğer ${paraFormat(o.digerGelir)}`} ikon={<ArrowUpRight className="size-4" />} ton="ok" />
        <StatKart etiket="Gider" deger={paraFormat(o.gider)} alt={`Alış + işletme ${paraFormat(o.isletmeGideri)}`} ikon={<ArrowDownRight className="size-4" />} ton="tehlike" />
        <StatKart etiket="Kasa (net)" deger={paraFormat(o.kasa)} alt="Gelir − gider" ikon={<Wallet className="size-4" />} ton={o.kasa >= 0 ? "ok" : "tehlike"} />
        <StatKart etiket="Satılan malın maliyeti" deger={paraFormat(o.maliyet)} ikon={<Banknote className="size-4" />} />
        <StatKart etiket="Brüt kâr" deger={paraFormat(o.brutKar)} alt={o.satis ? `Marj %${Math.round((o.brutKar / o.satis) * 100)}` : undefined} ikon={<TrendingUp className="size-4" />} ton="ok" />
        <StatKart etiket="Net kâr" deger={paraFormat(o.netKar)} alt="Brüt kâr − işletme gideri" ikon={<Landmark className="size-4" />} ton={o.netKar >= 0 ? "ok" : "tehlike"} />
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Kart className="p-5"><h2 className="mb-3 font-display text-lg font-semibold">Gider dağılımı</h2><PastaGrafik veri={giderVeri} /></Kart>
        <Kart className="p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Ödeme yöntemi (satış)</h2>
          <PastaGrafik veri={[{ ad: "Nakit", deger: o.odeme.NAKIT }, { ad: "Kart", deger: o.odeme.KART }, { ad: "Havale/EFT", deger: o.odeme.HAVALE }, { ad: "Karışık", deger: o.odeme.KARISIK }].filter((x) => x.deger > 0)} />
          <p className="mt-2 text-xs text-muted">Ödeme dağılımı iade öncesi satış tutarlarıdır.</p>
        </Kart>
      </div>

      {tedarikciAlis.length > 0 && (
        <Kart className="mt-5 overflow-hidden">
          <div className="border-b border-border px-5 py-3"><h2 className="font-display text-lg font-semibold">Tedarikçilere alım</h2></div>
          <ul className="divide-y divide-border text-sm">
            {tedarikciAlis.sort((a, b) => Number(b._sum.toplam) - Number(a._sum.toplam)).map((t) => (
              <li key={t.tedarikciId ?? "x"} className="flex justify-between px-5 py-2.5"><span>{tedarikciler.find((x) => x.id === t.tedarikciId)?.ad ?? "Tedarikçi belirtilmemiş"}</span><b className="tabular">{paraFormat(t._sum.toplam?.toString())}</b></li>
            ))}
          </ul>
        </Kart>
      )}

      <KasaIstemci
        subeSecili={!!kapsam}
        kayitlar={kayitlar.map((k) => ({ id: k.id, tip: k.tip, kategori: k.kategori, tutar: Number(k.tutar), aciklama: k.aciklama, tarih: tarihFormat(k.tarih), kim: k.kullaniciSnap?.split(" <")[0] ?? null }))}
      />
    </>
  );
}
