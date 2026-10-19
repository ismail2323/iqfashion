import { prisma } from "@/lib/db";
import { sayfaBaglami } from "@/lib/sayfa";
import { DONEM_BASLIK, donemCoz, type DonemSP } from "@/lib/donemSecimi";
import { raporVerisiC } from "@/lib/raporSayfa";
import { sifirlamaNoktasi } from "@/lib/sifirlama";
import { paraFormat, sayiFormat } from "@/lib/para";
import { tarihFormat } from "@/lib/tarih";
import type { KirilimSatiri } from "@/lib/rapor";
import { YazdirDugmesi } from "./YazdirDugmesi";

export const metadata = { title: "Rapor" };

/** A4 yazdırma / "PDF olarak kaydet" için sade rapor. Menü ve butonlar yazdırmada gizlenir (.yazdir dışı). */
export default async function RaporYazdir({ searchParams }: { searchParams: Promise<DonemSP & { otomatik?: string }> }) {
  const { kullanici, kapsam } = await sayfaBaglami("SUPER_ADMIN", "SUBE_MUDURU");
  const sp = await searchParams;
  const d = donemCoz(sp);
  const sinir = await sifirlamaNoktasi();
  const [r, sube, dukkan] = await Promise.all([
    raporVerisiC(d.bas.toISOString(), d.bit.toISOString(), kapsam ?? null, sinir ? sinir.toISOString() : null, kullanici.rol === "SUPER_ADMIN"),
    kapsam ? prisma.sube.findUnique({ where: { id: kapsam }, select: { ad: true } }) : null,
    prisma.ayar.findUnique({ where: { anahtar: "dukkanAdi" } }),
  ]);
  const o = r.ozet;
  const marj = o.satis ? Math.round((o.brutKar / o.satis) * 100) : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted">Aşağıdaki rapor A4 sayfasına göre düzenlendi. <b>Yazdır</b>’a basıp hedef olarak <b>“PDF olarak kaydet”</b>i seçebilirsiniz.</p>
        <YazdirDugmesi otomatik={sp.otomatik === "1"} />
      </div>

      <article className="yazdir mx-auto max-w-[210mm] rounded-2xl border border-border bg-white p-8 text-[13px] leading-relaxed text-black shadow-[var(--shadow)] print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-black pb-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="IQ Fashion" className="h-14 w-auto" />
            <p className="mt-1 text-xs text-neutral-600">{dukkan?.deger ?? "IQ Fashion"} · {sube?.ad ?? "Tüm şubeler"}</p>
          </div>
          <div className="text-right">
            <h1 className="font-display text-2xl font-semibold">{DONEM_BASLIK[d.donem]} Rapor</h1>
            <p className="text-sm">{d.etiket}</p>
            <p className="text-xs text-neutral-600">Oluşturma: {tarihFormat(new Date(), true)} · {kullanici.ad}</p>
            {sinir && <p className="text-xs text-neutral-600">İstatistik başlangıcı: {tarihFormat(sinir, true)}</p>}
          </div>
        </header>

        <Baslik>Özet</Baslik>
        <table className="w-full border-collapse">
          <tbody>
            <Satir e="Satış (net, iadeler düşülmüş)" d={paraFormat(o.satis)} e2="Satılan ürün adedi" d2={sayiFormat(o.satisAdet)} />
            <Satir e="Satılan malın maliyeti" d={paraFormat(o.maliyet)} e2="Satış sayısı (fiş)" d2={sayiFormat(o.satisSayisi)} />
            <Satir e="Brüt kâr" d={`${paraFormat(o.brutKar)} (%${marj})`} e2="Mal alışı" d2={`${paraFormat(o.alis)} (${sayiFormat(o.alisAdet)} adet)`} />
            <Satir e="İşletme giderleri" d={paraFormat(o.isletmeGideri)} e2="Diğer gelirler" d2={paraFormat(o.digerGelir)} />
            <Satir e="Toplam gelir" d={paraFormat(o.gelir)} e2="Toplam gider (alış + işletme)" d2={paraFormat(o.gider)} />
            <Satir e="KASA (net)" d={paraFormat(o.kasa)} e2="NET KÂR" d2={paraFormat(o.netKar)} kalin />
          </tbody>
        </table>

        <Baslik>Ödeme yöntemleri (iade öncesi satış)</Baslik>
        <p>Nakit <b>{paraFormat(o.odeme.NAKIT)}</b> · Kart <b>{paraFormat(o.odeme.KART)}</b> · Havale/EFT <b>{paraFormat(o.odeme.HAVALE)}</b>{o.odeme.KARISIK > 0 && <> · Karışık <b>{paraFormat(o.odeme.KARISIK)}</b></>}</p>

        {r.seri.length > 1 && r.seri.length <= 40 && (
          <>
            <Baslik>Günlük döküm</Baslik>
            <table className="w-full border-collapse text-[12px]">
              <thead><tr className="border-b border-black"><th className="py-1 text-left">Gün</th><th className="py-1 text-right">Satış</th><th className="py-1 text-right">Alış</th><th className="py-1 text-right">Gider</th></tr></thead>
              <tbody>{r.seri.filter((x) => x.satis || x.alis || x.gider).map((x) => <tr key={x.gun} className="border-b border-neutral-200"><td className="py-0.5">{x.gun.split("-").reverse().join(".")}</td><td className="text-right tabular-nums">{paraFormat(x.satis)}</td><td className="text-right tabular-nums">{paraFormat(x.alis)}</td><td className="text-right tabular-nums">{paraFormat(x.gider)}</td></tr>)}</tbody>
            </table>
          </>
        )}

        <Kirilim baslik="Marka bazında satış" veri={r.markalar.slice(0, 12)} />
        <Kirilim baslik="Ürün türü bazında satış" veri={r.kategoriler.slice(0, 12)} />
        <Kirilim baslik="En çok satan ürünler" veri={r.urunler.slice(0, 12)} />
        <div className="grid grid-cols-2 gap-6 break-inside-avoid">
          <Kirilim baslik="Renk" veri={r.renkler.slice(0, 10)} sade />
          <Kirilim baslik="Beden" veri={r.bedenler.slice(0, 10)} sade />
        </div>

        {(r.giderler.length > 0 || r.gelirler.length > 0) && (
          <div className="break-inside-avoid">
            <Baslik>İşletme gelir / giderleri</Baslik>
            <table className="w-full border-collapse text-[12px]"><tbody>
              {r.giderler.map((g) => <tr key={"g" + g.kategori} className="border-b border-neutral-200"><td className="py-0.5">Gider · {g.kategori}</td><td className="text-right tabular-nums">−{paraFormat(g.tutar)}</td></tr>)}
              {r.gelirler.map((g) => <tr key={"r" + g.kategori} className="border-b border-neutral-200"><td className="py-0.5">Gelir · {g.kategori}</td><td className="text-right tabular-nums">+{paraFormat(g.tutar)}</td></tr>)}
            </tbody></table>
          </div>
        )}

        {r.subeler.length > 0 && (
          <div className="break-inside-avoid">
            <Baslik>Şube karşılaştırma</Baslik>
            <table className="w-full border-collapse text-[12px]"><tbody>{r.subeler.map((s) => <tr key={s.subeId} className="border-b border-neutral-200"><td className="py-0.5">{s.ad}</td><td className="text-right tabular-nums">{s.adet} adet</td><td className="text-right tabular-nums">Kâr {paraFormat(s.kar)}</td><td className="text-right font-semibold tabular-nums">{paraFormat(s.satis)}</td></tr>)}</tbody></table>
          </div>
        )}

        <Baslik>Stok durumu (rapor anı)</Baslik>
        <p>Toplam <b>{sayiFormat(r.stok.adet)}</b> adet ({sayiFormat(r.stok.cesit)} çeşit) · maliyet değeri <b>{paraFormat(r.stok.maliyetDegeri)}</b> · satış değeri <b>{paraFormat(r.stok.satisDegeri)}</b></p>

        <footer className="mt-10 flex justify-between border-t border-neutral-300 pt-3 text-xs text-neutral-500">
          <span>IQ Fashion Panel · otomatik oluşturulmuştur</span><span>Hazırlayan: ______________________</span>
        </footer>
      </article>
    </div>
  );
}

const Baslik = ({ children }: { children: React.ReactNode }) => <h2 className="mb-1.5 mt-6 border-b border-neutral-300 pb-1 font-display text-base font-semibold break-after-avoid">{children}</h2>;

function Satir({ e, d, e2, d2, kalin }: { e: string; d: string; e2: string; d2: string; kalin?: boolean }) {
  const c = kalin ? "font-bold text-[14px]" : "";
  return <tr className="border-b border-neutral-200"><td className={`py-1 pr-2 ${c}`}>{e}</td><td className={`py-1 pr-4 text-right tabular-nums ${c}`}>{d}</td><td className={`py-1 pr-2 ${c}`}>{e2}</td><td className={`py-1 text-right tabular-nums ${c}`}>{d2}</td></tr>;
}

function Kirilim({ baslik, veri, sade }: { baslik: string; veri: KirilimSatiri[]; sade?: boolean }) {
  if (!veri.length) return null;
  return (
    <div className="break-inside-avoid">
      <Baslik>{baslik}</Baslik>
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="border-b border-black"><th className="py-1 text-left">Ad</th><th className="py-1 text-right">Adet</th><th className="py-1 text-right">Ciro</th>{!sade && <th className="py-1 text-right">Kâr</th>}</tr></thead>
        <tbody>{veri.map((x) => <tr key={x.ad} className="border-b border-neutral-200"><td className="py-0.5">{x.ad}</td><td className="text-right tabular-nums">{sayiFormat(x.adet)}</td><td className="text-right tabular-nums">{paraFormat(x.ciro)}</td>{!sade && <td className="text-right tabular-nums">{paraFormat(x.kar)}</td>}</tr>)}</tbody>
      </table>
    </div>
  );
}
