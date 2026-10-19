import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { sayfaBaglami } from "@/lib/sayfa";
import { maliyetGorebilir } from "@/lib/rbac";
import { sayiFormat } from "@/lib/para";
import { Baslik, Kart } from "@/components/ui";
import { StokIstemci, type StokSatiri } from "./StokIstemci";

export const metadata = { title: "Stok" };
const SAYFA = 60;

const kacis = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

// Beden sıralaması: harfli bedenler küçükten büyüğe, sonra sayılar
const BEDEN_SIRASI = Prisma.sql`CASE v."beden" WHEN 'XXS' THEN 0 WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 WHEN 'L' THEN 4 WHEN 'XL' THEN 5 WHEN 'XXL' THEN 6 WHEN '3XL' THEN 7 WHEN '4XL' THEN 8 WHEN '5XL' THEN 9 ELSE 100 END`;

export default async function StokSayfasi({ searchParams }: { searchParams: Promise<{ q?: string; durum?: string; sayfa?: string }> }) {
  const { kullanici, kapsam } = await sayfaBaglami();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const sayfa = Math.max(1, Math.min(10_000, Number(sp.sayfa) || 1));
  const maliyet = maliyetGorebilir(kullanici);
  const subeler = await prisma.sube.findMany({ where: { aktif: true, ...(kapsam ? { id: kapsam } : {}) }, orderBy: { ad: "asc" }, select: { id: true, ad: true } });

  const stokKosulu = kapsam ? Prisma.sql`AND st."subeId" = ${kapsam}` : Prisma.empty;
  const aramaKosulu = q
    ? Prisma.sql`AND (v."barkod" LIKE ${`%${kacis(q)}%`} OR v."sku" ILIKE ${`%${kacis(q)}%`} OR v."renk" ILIKE ${`%${kacis(q)}%`} OR lower(v."beden") = lower(${q}) OR u."ad" ILIKE ${`%${kacis(q)}%`} OR m."ad" ILIKE ${`%${kacis(q)}%`})`
    : Prisma.empty;
  const durumKosulu = sp.durum === "dusuk" ? Prisma.sql`HAVING COALESCE(SUM(st."miktar"), 0) > 0 AND COALESCE(SUM(st."miktar"), 0) <= v."minStok"` : sp.durum === "tukendi" ? Prisma.sql`HAVING COALESCE(SUM(st."miktar"), 0) = 0` : Prisma.empty;
  const kaynak = Prisma.sql`
    FROM "Varyant" v JOIN "Urun" u ON u."id" = v."urunId" LEFT JOIN "Marka" m ON m."id" = u."markaId"
    LEFT JOIN "Stok" st ON st."varyantId" = v."id" ${stokKosulu}
    WHERE v."aktif" = true AND u."aktif" = true ${aramaKosulu}`;

  const [sayfaSatirlari, sayimlar, toplamSatir] = await Promise.all([
    prisma.$queryRaw<{ id: string; urunId: string; urun: string; marka: string | null; renk: string; beden: string; barkod: string; minStok: number; alis: unknown; satis: unknown; stok: unknown }[]>`
      SELECT v."id", v."urunId", u."ad" AS urun, m."ad" AS marka, v."renk", v."beden", v."barkod", v."minStok", v."alisFiyati" AS alis, v."satisFiyati" AS satis,
             COALESCE(SUM(st."miktar"), 0) AS stok
      ${kaynak} GROUP BY v."id", u."id", m."id" ${durumKosulu}
      ORDER BY u."ad", v."renk", ${BEDEN_SIRASI}, v."beden" LIMIT ${SAYFA} OFFSET ${(sayfa - 1) * SAYFA}`,
    // Sekme sayıları ve toplam adet: tek sorgu
    prisma.$queryRaw<{ tum: unknown; dusuk: unknown; tukendi: unknown; adet: unknown }[]>`
      SELECT COUNT(*) AS tum, COUNT(*) FILTER (WHERE t.s > 0 AND t.s <= t.min) AS dusuk, COUNT(*) FILTER (WHERE t.s = 0) AS tukendi, COALESCE(SUM(t.s), 0) AS adet
      FROM (SELECT v."id", v."minStok" AS min, COALESCE(SUM(st."miktar"), 0) AS s ${kaynak} GROUP BY v."id") t`,
    prisma.$queryRaw<{ n: unknown }[]>`SELECT COUNT(*) AS n FROM (SELECT v."id" ${kaynak} GROUP BY v."id", u."id", m."id" ${durumKosulu}) t`,
  ]);
  const ids = sayfaSatirlari.map((s) => s.id);
  const subeStoklari = !kapsam && subeler.length > 1 && ids.length ? await prisma.stok.findMany({ where: { varyantId: { in: ids } }, select: { varyantId: true, subeId: true, miktar: true } }) : [];

  const satirlar: StokSatiri[] = sayfaSatirlari.map((x) => ({
    id: x.id, urunId: x.urunId, urun: x.urun, marka: x.marka, renk: x.renk, beden: x.beden, barkod: x.barkod, stok: Number(x.stok), min: x.minStok,
    alis: maliyet ? Number(x.alis) : null, satis: Number(x.satis),
    subeStok: Object.fromEntries(subeler.map((s) => [s.id, subeStoklari.find((y) => y.varyantId === x.id && y.subeId === s.id)?.miktar ?? 0])),
  }));
  const sayim = { tum: Number(sayimlar[0]?.tum ?? 0), dusuk: Number(sayimlar[0]?.dusuk ?? 0), tukendi: Number(sayimlar[0]?.tukendi ?? 0), adet: Number(sayimlar[0]?.adet ?? 0) };
  const toplamSayfa = Math.max(1, Math.ceil(Number(toplamSatir[0]?.n ?? 0) / SAYFA));

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
      <Baslik baslik="Stok" aciklama={`${sayiFormat(sayim.adet)} adet · ${kapsam ? subeler[0]?.ad : "tüm şubeler"}`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {sekme("Tümü", undefined, sayim.tum)}
        {sekme("Düşük stok", "dusuk", sayim.dusuk)}
        {sekme("Tükenen", "tukendi", sayim.tukendi)}
      </div>
      <form action="/stok" className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Ürün, renk, beden, barkod…" aria-label="Ara" className="min-h-11 flex-1 rounded-xl border border-border bg-surface px-3.5 text-base focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)] md:text-sm" />
        {sp.durum && <input type="hidden" name="durum" value={sp.durum} />}
        <button className="min-h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background">Ara</button>
      </form>
      <Kart className="overflow-hidden">
        <StokIstemci satirlar={satirlar} subeler={subeler} duzenleyebilir={kullanici.rol !== "KASIYER" && !!kapsam} subeSecili={!!kapsam || subeler.length <= 1} />
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
