import Link from "next/link";
import { prisma } from "@/lib/db";
import { sayfaBaglami } from "@/lib/sayfa";
import { maliyetGorebilir } from "@/lib/rbac";
import { bedenSirasi } from "@/lib/giyim";
import { sayiFormat } from "@/lib/para";
import { Baslik, Kart } from "@/components/ui";
import { StokIstemci, type StokSatiri } from "./StokIstemci";

export const metadata = { title: "Stok" };
const SAYFA = 60;

export default async function StokSayfasi({ searchParams }: { searchParams: Promise<{ q?: string; durum?: string; sayfa?: string }> }) {
  const { kullanici, kapsam } = await sayfaBaglami();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const sayfa = Math.max(1, Number(sp.sayfa) || 1);
  const maliyet = maliyetGorebilir(kullanici);
  const subeler = await prisma.sube.findMany({ where: { aktif: true, ...(kapsam ? { id: kapsam } : {}) }, orderBy: { ad: "asc" }, select: { id: true, ad: true } });

  const v = await prisma.varyant.findMany({
    where: {
      aktif: true, urun: { aktif: true },
      ...(q ? { OR: [{ barkod: { contains: q } }, { sku: { contains: q, mode: "insensitive" } }, { renk: { contains: q, mode: "insensitive" } }, { beden: { equals: q, mode: "insensitive" } }, { urun: { ad: { contains: q, mode: "insensitive" } } }, { urun: { marka: { ad: { contains: q, mode: "insensitive" } } } }] } : {}),
    },
    include: { urun: { include: { marka: true } }, stoklar: { where: kapsam ? { subeId: kapsam } : undefined } },
    orderBy: [{ urun: { ad: "asc" } }, { renk: "asc" }],
    take: 1500,
  });

  const hepsi: StokSatiri[] = v
    .map((x) => {
      const stok = x.stoklar.reduce((t, s) => t + s.miktar, 0);
      return {
        id: x.id, urunId: x.urunId, urun: x.urun.ad, marka: x.urun.marka?.ad ?? null, renk: x.renk, beden: x.beden, barkod: x.barkod, stok, min: x.minStok,
        alis: maliyet ? Number(x.alisFiyati) : null, satis: Number(x.satisFiyati),
        subeStok: Object.fromEntries(subeler.map((s) => [s.id, x.stoklar.find((y) => y.subeId === s.id)?.miktar ?? 0])),
      };
    })
    .sort((a, b) => a.urun.localeCompare(b.urun, "tr") || a.renk.localeCompare(b.renk, "tr") || bedenSirasi(a.beden) - bedenSirasi(b.beden));

  const suzulen = hepsi.filter((s) => (sp.durum === "dusuk" ? s.stok > 0 && s.stok <= s.min : sp.durum === "tukendi" ? s.stok === 0 : true));
  const sayim = { tukendi: hepsi.filter((s) => s.stok === 0).length, dusuk: hepsi.filter((s) => s.stok > 0 && s.stok <= s.min).length, toplam: hepsi.reduce((t, s) => t + s.stok, 0) };
  const toplamSayfa = Math.max(1, Math.ceil(suzulen.length / SAYFA));
  const gorunen = suzulen.slice((sayfa - 1) * SAYFA, sayfa * SAYFA);
  const link = (d: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries({ q: q || undefined, durum: sp.durum, ...d })) if (val) p.set(k, val);
    return `/stok${p.toString() ? `?${p}` : ""}`;
  };
  const sekme = (ad: string, d: string | undefined, n: number) => (
    <Link href={link({ durum: d, sayfa: undefined })} className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition ${sp.durum === d || (!sp.durum && !d) ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:bg-surface-2"}`}>{ad} <span className="opacity-70">{sayiFormat(n)}</span></Link>
  );

  return (
    <>
      <Baslik baslik="Stok" aciklama={`${sayiFormat(sayim.toplam)} adet · ${kapsam ? subeler[0]?.ad : "tüm şubeler"}`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {sekme("Tümü", undefined, hepsi.length)}
        {sekme("Düşük stok", "dusuk", sayim.dusuk)}
        {sekme("Tükenen", "tukendi", sayim.tukendi)}
      </div>
      <form action="/stok" className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Ürün, renk, beden, barkod…" aria-label="Ara" className="min-h-11 flex-1 rounded-xl border border-border bg-surface px-3.5 text-base focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)] md:text-sm" />
        {sp.durum && <input type="hidden" name="durum" value={sp.durum} />}
        <button className="min-h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background">Ara</button>
      </form>
      <Kart className="overflow-hidden">
        <StokIstemci satirlar={gorunen} subeler={subeler} duzenleyebilir={kullanici.rol !== "KASIYER" && !!kapsam} subeSecili={!!kapsam} tumu={hepsi} />
      </Kart>
      {toplamSayfa > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-2" aria-label="Sayfalar">
          {sayfa > 1 && <Link href={link({ sayfa: String(sayfa - 1) })} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">Önceki</Link>}
          <span className="text-sm text-muted">{sayfa} / {toplamSayfa}</span>
          {sayfa < toplamSayfa && <Link href={link({ sayfa: String(sayfa + 1) })} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">Sonraki</Link>}
        </nav>
      )}
    </>
  );
}
