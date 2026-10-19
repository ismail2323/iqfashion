import Link from "next/link";
import { AlertTriangle, ArrowDownRight, CheckCircle2, Circle, ArrowUpRight, Banknote, FileText, PackageOpen, RotateCcw, ShoppingCart, Store, TrendingUp, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { sayfaBaglami } from "@/lib/sayfa";
import { tarihFormat, type Donem } from "@/lib/tarih";
import { panelVerisi } from "@/lib/panelVerisi";
import { paraFormat, sayiFormat } from "@/lib/para";
import { sifirlamaNoktasi } from "@/lib/sifirlama";
import { Baslik, BosDurum, Kart, Rozet, StatKart } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CubukGrafik, PastaGrafik, TrendGrafik } from "@/components/GrafiklerLazy";

export const metadata = { title: "Panel" };

const DONEMLER: { anahtar: Donem; ad: string; pdf: string }[] = [
  { anahtar: "bugun", ad: "Günlük", pdf: "Günlük" },
  { anahtar: "hafta", ad: "Haftalık", pdf: "Haftalık" },
  { anahtar: "ay", ad: "Aylık", pdf: "Aylık" },
  { anahtar: "yil", ad: "Yıllık", pdf: "Yıllık" },
];

const GRAFIK_DONEMLERI: { anahtar: Donem; ad: string }[] = [
  { anahtar: "hafta", ad: "Bu hafta" },
  { anahtar: "ay", ad: "Bu ay" },
  { anahtar: "yil", ad: "Bu yıl" },
];

export default async function Panel({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { kullanici, kapsam } = await sayfaBaglami("SUPER_ADMIN", "SUBE_MUDURU");
  const sp = await searchParams;
  const gd = (GRAFIK_DONEMLERI.find((x) => x.anahtar === sp.d)?.anahtar ?? "ay") as Donem;
  const sinir = await sifirlamaNoktasi();
  const [panel, subeAdi] = await Promise.all([
    panelVerisi(kapsam ?? null, sinir ? sinir.toISOString() : null, gd, kullanici.rol === "SUPER_ADMIN"),
    kapsam ? prisma.sube.findUnique({ where: { id: kapsam }, select: { ad: true } }) : null,
  ]);
  const { donemler, seri, markalar, urunler, renkler, bedenler, stok, kritik, olu, subeler, sonSatislar } = panel;
  const baslangicSayilari = kullanici.rol === "SUPER_ADMIN" ? await Promise.all([prisma.sube.count(), prisma.kullanici.count({ where: { rol: { not: "SUPER_ADMIN" } } }), prisma.urun.count(), prisma.satis.count()]) : null;
  const baslangicAdimlari = baslangicSayilari ? [
    { ad: "Müdür / kasiyer hesabı açın", ok: baslangicSayilari[1] > 0, link: "/kullanicilar" },
    { ad: "İlk ürünleri ekleyin (fotoğraftan AI)", ok: baslangicSayilari[2] > 0, link: "/urunler/yeni" },
    { ad: "İlk satışı yapın", ok: baslangicSayilari[3] > 0, link: "/satis" },
  ] : [];
  return (
    <div className="space-y-6">
      <Baslik
        baslik={`Merhaba, ${kullanici.ad.split(" ")[0]}`}
        aciklama={`${subeAdi?.ad ?? "Tüm şubeler"} · ${tarihFormat(new Date())}`}
        aksiyon={
          <>
            {DONEMLER.slice(1).map((d) => (
              <Link key={d.anahtar} href={`/raporlar/yazdir?donem=${d.anahtar}`} target="_blank" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">
                <FileText className="size-4 text-accent" /> {d.pdf} PDF
              </Link>
            ))}
          </>
        }
      />

      {baslangicAdimlari.some((a) => !a.ok) && (
        <Kart className="border-accent/40 bg-accent-soft p-5">
          <h2 className="font-display text-lg font-semibold">Başlangıç adımları</h2>
          <p className="mb-3 text-sm text-muted">Sistemi kullanmaya başlamak için sırayla tamamlayın. Takıldığınızda <Link href="/yardim" className="font-medium underline">Yardım</Link> sayfasına bakın.</p>
          <ol className="grid gap-2 sm:grid-cols-3">
            {baslangicAdimlari.map((a, i) => (
              <li key={a.ad}><Link href={a.link} className={cn("flex min-h-12 items-center gap-3 rounded-xl bg-surface px-3 py-2 text-sm transition hover:shadow-md", a.ok && "opacity-60")}>{a.ok ? <CheckCircle2 className="size-5 shrink-0 text-ok" /> : <Circle className="size-5 shrink-0 text-muted" />}<span><b className="mr-1">{i + 1}.</b>{a.ad}</span></Link></li>
            ))}
          </ol>
        </Kart>
      )}

      {sinir && (
        <Kart className="flex flex-wrap items-center gap-3 border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
          <RotateCcw className="size-4 shrink-0" />
          <span>İstatistikler <b>{tarihFormat(sinir, true)}</b> tarihinden itibaren sayılıyor (sıfırlama noktası).</span>
          {kullanici.rol === "SUPER_ADMIN" && <Link href="/ayarlar#sifirlama" className="ml-auto font-medium underline">Ayarlar'dan geri al</Link>}
        </Kart>
      )}

      {/* Günlük / haftalık / aylık / yıllık: satış, alış, gelir, gider, kasa */}
      <section aria-label="Dönemsel özet" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {DONEMLER.map(({ anahtar, ad }) => {
          const o = donemler[anahtar];
          return (
            <Kart key={anahtar} className="anim-yukari overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-display text-lg font-semibold">{ad}</h2>
                <Rozet ton={o.kasa >= 0 ? "ok" : "tehlike"}>{o.kasa >= 0 ? "Kasa +" : "Kasa −"}</Rozet>
              </div>
              <div className="px-4 pb-1 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Kasa (net)</p>
                <p className={cn("tabular text-3xl font-semibold tracking-tight", o.kasa < 0 && "text-danger")}>{paraFormat(o.kasa)}</p>
              </div>
              <dl className="divide-y divide-border px-4 pb-3 pt-2 text-sm">
                <Satir et="Satış" de={o.satis} ikon={<ShoppingCart className="size-3.5" />} alt={`${sayiFormat(o.satisAdet)} adet`} />
                <Satir et="Alış" de={o.alis} ikon={<PackageOpen className="size-3.5" />} alt={`${sayiFormat(o.alisAdet)} adet`} />
                <Satir et="Gelir" de={o.gelir} ikon={<ArrowUpRight className="size-3.5 text-ok" />} />
                <Satir et="Gider" de={o.gider} ikon={<ArrowDownRight className="size-3.5 text-danger" />} />
                <Satir et="Net kâr" de={o.netKar} ikon={<TrendingUp className="size-3.5" />} vurgu />
              </dl>
            </Kart>
          );
        })}
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatKart etiket="Stok adedi" deger={sayiFormat(stok.adet)} alt={`${sayiFormat(stok.cesit)} çeşit`} ikon={<PackageOpen className="size-4" />} ton="bilgi" />
        <StatKart etiket="Stok maliyet değeri" deger={paraFormat(stok.maliyetDegeri)} alt="Alış fiyatıyla" ikon={<Banknote className="size-4" />} ton="vurgu" />
        <StatKart etiket="Stok satış değeri" deger={paraFormat(stok.satisDegeri)} alt={`Potansiyel kâr ${paraFormat(stok.satisDegeri - stok.maliyetDegeri)}`} ikon={<Wallet className="size-4" />} ton="ok" />
        <StatKart etiket="Bu ay ort. sepet" deger={paraFormat(donemler.ay.satisSayisi ? donemler.ay.satis / donemler.ay.satisSayisi : 0)} alt={`${sayiFormat(donemler.ay.satisSayisi)} satış`} ikon={<ShoppingCart className="size-4" />} />
      </section>

      <Kart className="p-4 sm:p-5">
        <h2 className="mb-1 font-display text-lg font-semibold">Son 30 gün</h2>
        <p className="mb-3 text-sm text-muted">Günlük satış, alış ve işletme gideri</p>
        <TrendGrafik veri={seri} />
      </Kart>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">Satış analizi</h2>
        <nav className="flex gap-1 rounded-xl border border-border bg-surface p-1" aria-label="Analiz dönemi">
          {GRAFIK_DONEMLERI.map((x) => (
            <Link key={x.anahtar} href={`/?d=${x.anahtar}`} scroll={false} aria-current={gd === x.anahtar ? "true" : undefined}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", gd === x.anahtar ? "bg-foreground text-background" : "text-muted hover:text-foreground")}>{x.ad}</Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Kart className="p-4 sm:p-5">
          <h3 className="mb-3 font-medium">Marka bazlı ciro</h3>
          <CubukGrafik veri={markalar.map((m) => ({ ad: m.ad, ciro: m.ciro }))} />
        </Kart>
        <Kart className="p-4 sm:p-5">
          <h3 className="mb-3 font-medium">En çok satan ürünler</h3>
          <CubukGrafik veri={urunler.map((m) => ({ ad: m.ad.length > 16 ? m.ad.slice(0, 15) + "…" : m.ad, adet: m.adet }))} anahtar="adet" ad="Adet" para={false} />
        </Kart>
        <Kart className="p-4 sm:p-5">
          <h3 className="mb-3 font-medium">Renk dağılımı (adet)</h3>
          <PastaGrafik veri={renkler.map((x) => ({ ad: x.ad, deger: x.adet }))} birim="adet" />
        </Kart>
        <Kart className="p-4 sm:p-5">
          <h3 className="mb-3 font-medium">Beden dağılımı (adet)</h3>
          <PastaGrafik veri={bedenler.map((x) => ({ ad: x.ad, deger: x.adet }))} birim="adet" />
        </Kart>
        {subeler.length > 0 && (
          <Kart className="p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 font-medium"><Store className="size-4 text-muted" /> Şube karşılaştırma</h3>
            <div className="space-y-3">
              {subeler.map((s) => (
                <div key={s.subeId}>
                  <div className="mb-1 flex justify-between text-sm"><span>{s.ad}</span><span className="tabular font-medium">{paraFormat(s.satis)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${subeler[0].satis ? (s.satis / subeler[0].satis) * 100 : 0}%` }} /></div>
                  <p className="mt-1 text-xs text-muted">Brüt kâr {paraFormat(s.kar)} · {sayiFormat(s.adet)} adet</p>
                </div>
              ))}
            </div>
          </Kart>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Kart className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3"><AlertTriangle className="size-4 text-warn" /><h3 className="font-medium">Kritik stok</h3></div>
          {kritik.length === 0 ? <BosDurum baslik="Kritik stok yok" aciklama="Tüm ürünler yeterli seviyede." /> : (
            <ul className="divide-y divide-border">
              {kritik.map((k) => (
                <li key={`${k.varyantId}${k.subeAd}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0"><p className="truncate font-medium">{k.ad}</p><p className="truncate text-xs text-muted">{k.renk} · {k.beden}{!kapsam && ` · ${k.subeAd}`}</p></div>
                  <Rozet ton={k.miktar === 0 ? "tehlike" : "uyari"}>{k.miktar === 0 ? "Tükendi" : `${k.miktar} adet`}</Rozet>
                </li>
              ))}
            </ul>
          )}
        </Kart>
        <Kart className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3"><PackageOpen className="size-4 text-info" /><h3 className="font-medium">Ölü stok <span className="text-xs font-normal text-muted">(45+ gün satılmayan)</span></h3></div>
          {olu.length === 0 ? <BosDurum baslik="Ölü stok yok" aciklama="Stoktaki her ürün son 45 günde satılmış." /> : (
            <ul className="divide-y divide-border">
              {olu.map((k, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0"><p className="truncate font-medium">{k.ad}</p><p className="truncate text-xs text-muted">{k.renk} · {k.beden} · {k.miktar} adet</p></div>
                  <span className="tabular text-xs text-muted">{paraFormat(k.deger)}</span>
                </li>
              ))}
            </ul>
          )}
        </Kart>
        <Kart className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><h3 className="font-medium">Son satışlar</h3><Link href="/hareketler" className="text-xs font-medium text-accent">Tümü</Link></div>
          {sonSatislar.length === 0 ? <BosDurum baslik="Henüz satış yok" /> : (
            <ul className="divide-y divide-border">
              {sonSatislar.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0"><p className="truncate font-medium">{s.ilkUrun}{s.kalemSayisi > 1 && ` +${s.kalemSayisi - 1}`}</p><p className="truncate text-xs text-muted">{tarihFormat(s.tarih, true)} · {s.subeAd}</p></div>
                  <div className="text-right"><p className="tabular font-medium">{paraFormat(s.toplam)}</p>{s.durum === "IPTAL" && <Rozet ton="tehlike">İptal</Rozet>}</div>
                </li>
              ))}
            </ul>
          )}
        </Kart>
      </div>
    </div>
  );
}

function Satir({ et, de, ikon, alt, vurgu }: { et: string; de: number; ikon: React.ReactNode; alt?: string; vurgu?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <dt className="flex items-center gap-2 text-muted">{ikon}{et}</dt>
      <dd className={cn("tabular text-right font-medium", vurgu && (de >= 0 ? "text-ok" : "text-danger"))}>
        {paraFormat(de)}
        {alt && <span className="block text-[11px] font-normal text-muted">{alt}</span>}
      </dd>
    </div>
  );
}
