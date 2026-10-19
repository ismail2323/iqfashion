import Link from "next/link";
import { AlertTriangle, PackagePlus, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { sayfaBaglami } from "@/lib/sayfa";
import { maliyetGorebilir } from "@/lib/rbac";
import { paraFormat, sayiFormat } from "@/lib/para";
import { Baslik, BosDurum, Kart, Rozet } from "@/components/ui";
import { UrunGorseli } from "@/components/UrunGorseli";
import { cn } from "@/lib/cn";

export const metadata = { title: "Ürünler" };
const SAYFA = 24;

export default async function UrunlerSayfasi({ searchParams }: { searchParams: Promise<{ q?: string; marka?: string; kategori?: string; dusuk?: string; sayfa?: string }> }) {
  const { kullanici, kapsam } = await sayfaBaglami();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const sayfa = Math.max(1, Number(sp.sayfa) || 1);
  const yonetici = kullanici.rol !== "KASIYER";

  const [markalar, kategoriler, urunler] = await Promise.all([
    prisma.marka.findMany({ orderBy: { ad: "asc" } }),
    prisma.kategori.findMany({ orderBy: { ad: "asc" } }),
    prisma.urun.findMany({
      where: {
        aktif: true,
        ...(sp.marka ? { markaId: sp.marka } : {}),
        ...(sp.kategori ? { kategoriId: sp.kategori } : {}),
        ...(q ? { OR: [{ ad: { contains: q, mode: "insensitive" } }, { marka: { ad: { contains: q, mode: "insensitive" } } }, { varyantlar: { some: { OR: [{ barkod: { contains: q } }, { sku: { contains: q, mode: "insensitive" } }, { renk: { contains: q, mode: "insensitive" } }] } } }] } : {}),
      },
      include: { marka: true, kategori: true, varyantlar: { where: { aktif: true }, include: { stoklar: { where: kapsam ? { subeId: kapsam } : undefined } } } },
      orderBy: { createdAt: "desc" },
      take: 600,
    }),
  ]);

  const satirlar = urunler.map((u) => {
    const stok = u.varyantlar.reduce((t, v) => t + v.stoklar.reduce((a, s) => a + s.miktar, 0), 0);
    const dusuk = u.varyantlar.filter((v) => v.stoklar.reduce((a, s) => a + s.miktar, 0) <= v.minStok).length;
    const fiyatlar = u.varyantlar.map((v) => Number(v.satisFiyati));
    return { u, stok, dusuk, min: Math.min(...fiyatlar), max: Math.max(...fiyatlar) };
  }).filter((s) => (sp.dusuk ? s.dusuk > 0 : true));

  const toplamSayfa = Math.max(1, Math.ceil(satirlar.length / SAYFA));
  const gorunen = satirlar.slice((sayfa - 1) * SAYFA, sayfa * SAYFA);
  const link = (d: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q || undefined, marka: sp.marka, kategori: sp.kategori, dusuk: sp.dusuk, ...d })) if (v) p.set(k, v);
    return `/urunler${p.toString() ? `?${p}` : ""}`;
  };
  void maliyetGorebilir;

  return (
    <>
      <Baslik baslik="Ürünler" aciklama={`${sayiFormat(satirlar.length)} ürün${kapsam ? "" : " · tüm şubelerin toplam stoğu"}`}
        aksiyon={yonetici && <Link href="/urunler/yeni" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-background"><PackagePlus className="size-4" /> Ürün ekle</Link>} />

      <form className="mb-5 flex flex-wrap gap-2" action="/urunler">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Ürün, marka, renk, barkod ara…" aria-label="Ara" className="min-h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-base focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)] md:text-sm" />
        </div>
        <select name="marka" defaultValue={sp.marka ?? ""} aria-label="Marka" className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm"><option value="">Tüm markalar</option>{markalar.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}</select>
        <select name="kategori" defaultValue={sp.kategori ?? ""} aria-label="Tür" className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm"><option value="">Tüm türler</option>{kategoriler.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}</select>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm"><input type="checkbox" name="dusuk" value="1" defaultChecked={!!sp.dusuk} className="size-4 accent-[var(--accent)]" /> Düşük stok</label>
        <button className="min-h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background">Filtrele</button>
        {(q || sp.marka || sp.kategori || sp.dusuk) && <Link href="/urunler" className="inline-flex min-h-11 items-center px-2 text-sm text-muted underline">Temizle</Link>}
      </form>

      {gorunen.length === 0 ? (
        <Kart><BosDurum baslik="Ürün bulunamadı" aciklama={yonetici ? "Filtreleri temizleyin ya da yeni ürün ekleyin." : "Filtreleri temizleyip tekrar deneyin."} aksiyon={yonetici ? <Link href="/urunler/yeni" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-background"><PackagePlus className="size-4" /> Ürün ekle</Link> : undefined} /></Kart>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {gorunen.map(({ u, stok, dusuk, min, max }) => (
            <Link key={u.id} href={`/urunler/${u.id}`} className="anim-yukari group overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow)] transition hover:border-accent hover:shadow-lg">
              <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
                <UrunGorseli src={u.gorselUrl} ad={u.ad} marka={u.marka?.ad} className="size-full transition duration-500 group-hover:scale-105" />
                {dusuk > 0 && <span className="absolute left-2 top-2"><Rozet ton="uyari"><AlertTriangle className="size-3" /> {dusuk} varyant düşük</Rozet></span>}
              </div>
              <div className="p-3.5">
                <p className="text-xs text-muted">{u.marka?.ad ?? "Markasız"}{u.kategori && ` · ${u.kategori.ad}`}</p>
                <h3 className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug">{u.ad}</h3>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <p className="tabular text-base font-semibold">{min === max ? paraFormat(min) : `${paraFormat(min)} – ${paraFormat(max)}`}</p>
                  <Rozet ton={stok === 0 ? "tehlike" : dusuk > 0 ? "uyari" : "ok"}>{stok === 0 ? "Tükendi" : `${sayiFormat(stok)} adet`}</Rozet>
                </div>
                <p className="mt-1 text-xs text-muted">{u.varyantlar.length} varyant</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {toplamSayfa > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Sayfalar">
          {sayfa > 1 && <Link href={link({ sayfa: String(sayfa - 1) })} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">Önceki</Link>}
          <span className="text-sm text-muted">{sayfa} / {toplamSayfa}</span>
          {sayfa < toplamSayfa && <Link href={link({ sayfa: String(sayfa + 1) })} className={cn("rounded-xl border border-border bg-surface px-4 py-2 text-sm")}>Sonraki</Link>}
        </nav>
      )}
    </>
  );
}
