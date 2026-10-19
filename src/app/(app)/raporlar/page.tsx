import Link from "next/link";
import { FileText } from "lucide-react";
import { sayfaBaglami } from "@/lib/sayfa";
import { donemCoz, type DonemSP } from "@/lib/donemSecimi";
import { raporVerisiC } from "@/lib/raporSayfa";
import { sifirlamaNoktasi } from "@/lib/sifirlama";
import { paraFormat, sayiFormat } from "@/lib/para";
import type { KirilimSatiri } from "@/lib/rapor";
import { Baslik, BosDurum, Kart, Rozet } from "@/components/ui";
import { DonemSecici } from "@/components/DonemSecici";
import { TrendGrafik } from "@/components/GrafiklerLazy";
import { CsvIndir } from "./CsvIndir";

export const metadata = { title: "Raporlar" };

export default async function RaporlarSayfasi({ searchParams }: { searchParams: Promise<DonemSP> }) {
  const { kullanici, kapsam } = await sayfaBaglami("SUPER_ADMIN", "SUBE_MUDURU");
  const sp = await searchParams;
  const d = donemCoz(sp);
  const sinir = await sifirlamaNoktasi();
  const r = await raporVerisiC(d.bas.toISOString(), d.bit.toISOString(), kapsam ?? null, sinir ? sinir.toISOString() : null, kullanici.rol === "SUPER_ADMIN");
  const o = r.ozet;
  const yazdirUrl = `/raporlar/yazdir?donem=${d.donem}${d.donem === "ozel" ? `&bas=${sp.bas}&bit=${sp.bit}` : ""}`;

  return (
    <>
      <Baslik baslik="Raporlar" aciklama={`${d.etiket}${kapsam ? "" : " · tüm şubeler"}`}
        aksiyon={<Link href={yazdirUrl} target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-background"><FileText className="size-4" /> PDF / Yazdır</Link>} />
      <DonemSecici yol="/raporlar" donem={d.donem} bas={sp.bas} bit={sp.bit} />

      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {[
          ["Satış (net)", paraFormat(o.satis)], ["Satış adedi", sayiFormat(o.satisAdet)], ["Brüt kâr", paraFormat(o.brutKar)],
          ["Mal alışı", paraFormat(o.alis)], ["İşletme gideri", paraFormat(o.isletmeGideri)], ["Net kâr", paraFormat(o.netKar)],
        ].map(([e, v]) => <Kart key={e} className="p-4"><p className="text-xs uppercase tracking-wide text-muted">{e}</p><p className="tabular mt-1 text-xl font-semibold">{v}</p></Kart>)}
      </section>

      <Kart className="mb-5 p-4 sm:p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Günlük seyir</h2>
        {r.seri.length > 62 ? <p className="text-sm text-muted">Çok uzun aralık; seri grafiği için en fazla 62 gün seçin.</p> : <TrendGrafik veri={r.seri} />}
      </Kart>

      <div className="grid gap-5 xl:grid-cols-2">
        <Tablo baslik="Marka" veri={r.markalar} dosya="marka" />
        <Tablo baslik="Ürün türü" veri={r.kategoriler} dosya="tur" />
        <Tablo baslik="Ürün" veri={r.urunler} dosya="urun" />
        <Tablo baslik="Renk" veri={r.renkler} dosya="renk" />
        <Tablo baslik="Beden" veri={r.bedenler} dosya="beden" />
        <Kart className="overflow-hidden">
          <div className="border-b border-border px-5 py-3"><h2 className="font-display text-lg font-semibold">Satış yapan kullanıcı</h2></div>
          {r.kasiyerler.length === 0 ? <BosDurum baslik="Veri yok" /> : (
            <ul className="divide-y divide-border text-sm">{r.kasiyerler.map((k) => <li key={k.ad} className="flex justify-between px-5 py-2.5"><span>{k.ad} <span className="text-muted">· {k.satisSayisi} satış</span></span><b className="tabular">{paraFormat(k.toplam)}</b></li>)}</ul>
          )}
        </Kart>
      </div>

      {r.subeler.length > 0 && (
        <Kart className="mt-5 overflow-hidden">
          <div className="border-b border-border px-5 py-3"><h2 className="font-display text-lg font-semibold">Şube karşılaştırma</h2></div>
          <ul className="divide-y divide-border text-sm">{r.subeler.map((s) => <li key={s.subeId} className="flex flex-wrap justify-between gap-2 px-5 py-2.5"><span>{s.ad}</span><span className="tabular"><span className="text-muted">{s.adet} adet · kâr {paraFormat(s.kar)} · </span><b>{paraFormat(s.satis)}</b></span></li>)}</ul>
        </Kart>
      )}
    </>
  );
}

function Tablo({ baslik, veri, dosya }: { baslik: string; veri: KirilimSatiri[]; dosya: string }) {
  const toplam = veri.reduce((t, x) => t + x.ciro, 0);
  return (
    <Kart className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3"><h2 className="font-display text-lg font-semibold">{baslik} bazında</h2>{veri.length > 0 && <CsvIndir dosya={`rapor-${dosya}`} satirlar={[["Ad", "Adet", "Ciro", "Maliyet", "Kâr"], ...veri.map((x) => [x.ad, x.adet, x.ciro, x.maliyet, x.kar])]} />}</div>
      {veri.length === 0 ? <BosDurum baslik="Veri yok" /> : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wide text-muted"><tr><th className="px-5 py-2 text-left font-medium">{baslik}</th><th className="px-3 py-2 text-right font-medium">Adet</th><th className="px-3 py-2 text-right font-medium">Ciro</th><th className="px-3 py-2 text-right font-medium">Kâr</th><th className="px-5 py-2 text-right font-medium">Pay</th></tr></thead>
            <tbody className="divide-y divide-border">
              {veri.map((x) => (
                <tr key={x.ad}><td className="px-5 py-2">{x.ad}</td><td className="tabular px-3 py-2 text-right">{sayiFormat(x.adet)}</td><td className="tabular px-3 py-2 text-right">{paraFormat(x.ciro)}</td><td className="tabular px-3 py-2 text-right text-ok">{paraFormat(x.kar)}</td><td className="px-5 py-2 text-right"><Rozet>{toplam ? Math.round((x.ciro / toplam) * 100) : 0}%</Rozet></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Kart>
  );
}
