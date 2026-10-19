import Link from "next/link";
import { prisma } from "@/lib/db";
import type { HareketTipi, Prisma } from "@/generated/prisma/client";
import { sayfaBaglami } from "@/lib/sayfa";
import { paraFormat } from "@/lib/para";
import { donemAraligi, tarihFormat } from "@/lib/tarih";
import { sifirlamaNoktasi } from "@/lib/sifirlama";
import { Baslik, BosDurum, Kart, Rozet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SatisAksiyonlari } from "./SatisAksiyonlari";

export const metadata = { title: "Hareketler" };
const SAYFA = 30;
const TIP_AD: Record<string, string> = { ALIS: "Alış", SATIS: "Satış", IADE: "İade", TRANSFER_CIKIS: "Transfer çıkış", TRANSFER_GIRIS: "Transfer giriş", DUZELTME_ARTIS: "Düzeltme +", DUZELTME_AZALIS: "Düzeltme −", SAYIM: "Sayım" };
const ODEME_AD = { NAKIT: "Nakit", KART: "Kart", HAVALE: "Havale/EFT", KARISIK: "Karışık" } as const;
const ARTAN = new Set(["ALIS", "IADE", "TRANSFER_GIRIS", "DUZELTME_ARTIS"]);

type SP = { sekme?: string; bas?: string; bit?: string; tip?: string; q?: string; sayfa?: string };

export default async function HareketlerSayfasi({ searchParams }: { searchParams: Promise<SP> }) {
  const { kullanici, kapsam } = await sayfaBaglami("SUPER_ADMIN", "SUBE_MUDURU");
  const sp = await searchParams;
  const sekme = sp.sekme === "hareket" ? "hareket" : "satis";
  const sayfa = Math.max(1, Number(sp.sayfa) || 1);
  const gecerliTarih = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const bas = gecerliTarih(sp.bas);
  const bit = gecerliTarih(sp.bit);
  let aralik: { gte?: Date; lt?: Date } | undefined;
  try {
    if (bas && bit) { const r = donemAraligi("ozel", bas, bit); aralik = { gte: r.bas, lt: r.bit }; }
    else if (bas) aralik = { gte: donemAraligi("ozel", bas, bas).bas };
    else if (bit) aralik = { lt: donemAraligi("ozel", bit, bit).bit };
  } catch { aralik = undefined; }
  const sinir = await sifirlamaNoktasi();
  if (sinir) aralik = { ...aralik, gte: aralik?.gte && aralik.gte > sinir ? aralik.gte : sinir };

  const link = (d: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ sekme, bas, bit, tip: sp.tip, q: sp.q, ...d })) if (v) p.set(k, v);
    return `/hareketler?${p}`;
  };

  let govde: React.ReactNode;
  let toplam = 0;
  if (sekme === "satis") {
    const where: Prisma.SatisWhereInput = { ...(kapsam ? { subeId: kapsam } : {}), ...(aralik ? { createdAt: aralik } : {}), ...(sp.q ? { OR: [{ no: { contains: sp.q, mode: "insensitive" } }, { kalemler: { some: { urunAdi: { contains: sp.q, mode: "insensitive" } } } }] } : {}) };
    const [liste, n] = await Promise.all([
      prisma.satis.findMany({ where, orderBy: { createdAt: "desc" }, skip: (sayfa - 1) * SAYFA, take: SAYFA, include: { sube: { select: { ad: true } }, kalemler: true } }),
      prisma.satis.count({ where }),
    ]);
    toplam = n;
    govde = liste.length === 0 ? <Kart><BosDurum baslik="Satış bulunamadı" aciklama="Tarih aralığını veya aramayı değiştirin." /></Kart> : (
      <div className="space-y-3">
        {liste.map((s) => (
          <Kart key={s.id} className={cn("overflow-hidden", s.durum === "IPTAL" && "opacity-70")}>
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0"><b>{s.no}</b> <span className="text-muted">· {tarihFormat(s.createdAt, true)}{!kapsam && ` · ${s.sube.ad}`}</span></span>
                <span className="flex items-center gap-2">
                  {s.durum === "IPTAL" && <Rozet ton="tehlike">İptal</Rozet>}
                  <Rozet>{ODEME_AD[s.odemeTipi]}</Rozet>
                  <b className="tabular">{paraFormat(s.toplam.toString())}</b>
                </span>
              </summary>
              <div className="border-t border-border px-4 py-3">
                <ul className="divide-y divide-border text-sm">
                  {s.kalemler.map((k) => (
                    <li key={k.id} className="flex justify-between gap-3 py-1.5">
                      <span>{k.miktar}× {k.urunAdi} <span className="text-muted">{k.renk}/{k.beden}</span>{k.iadeAdet > 0 && <Rozet ton="uyari">{k.iadeAdet} iade</Rozet>}</span>
                      <span className="tabular text-muted">{paraFormat(k.birimFiyat.toString())}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">Kasiyer: {s.kullaniciSnap ?? "—"}{Number(s.indirim) > 0 && ` · indirim ${paraFormat(s.indirim.toString())}`}</p>
                {s.durum === "TAMAMLANDI" && <SatisAksiyonlari satisId={s.id} no={s.no} kalemler={s.kalemler.map((k) => ({ id: k.id, ad: `${k.urunAdi} ${k.renk}/${k.beden}`, miktar: k.miktar, iade: k.iadeAdet }))} />}
              </div>
            </details>
          </Kart>
        ))}
      </div>
    );
  } else {
    const where: Prisma.StokHareketiWhereInput = {
      ...(kapsam ? { subeId: kapsam } : {}), ...(aralik ? { createdAt: aralik } : {}),
      ...(sp.tip && sp.tip in TIP_AD ? { tip: sp.tip as HareketTipi } : {}),
      ...(sp.q ? { OR: [{ urunAdiSnap: { contains: sp.q, mode: "insensitive" } }, { barkodSnap: { contains: sp.q } }] } : {}),
    };
    const [liste, n] = await Promise.all([
      prisma.stokHareketi.findMany({ where, orderBy: { createdAt: "desc" }, skip: (sayfa - 1) * SAYFA, take: SAYFA, include: { sube: { select: { ad: true } } } }),
      prisma.stokHareketi.count({ where }),
    ]);
    toplam = n;
    govde = liste.length === 0 ? <Kart><BosDurum baslik="Hareket bulunamadı" /></Kart> : (
      <Kart className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-2.5 text-left font-medium">Tarih</th><th className="px-3 py-2.5 text-left font-medium">İşlem</th><th className="px-3 py-2.5 text-left font-medium">Ürün</th>{!kapsam && <th className="px-3 py-2.5 text-left font-medium">Şube</th>}<th className="px-3 py-2.5 text-right font-medium">Adet</th><th className="px-3 py-2.5 text-left font-medium">Kullanıcı</th></tr></thead>
            <tbody className="divide-y divide-border">
              {liste.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{tarihFormat(h.createdAt, true)}</td>
                  <td className="px-3 py-2.5"><Rozet ton={ARTAN.has(h.tip) ? "ok" : "tehlike"}>{TIP_AD[h.tip]}</Rozet></td>
                  <td className="px-3 py-2.5">{h.urunAdiSnap ?? "—"}{h.aciklama && <span className="block text-xs text-muted">{h.aciklama}</span>}</td>
                  {!kapsam && <td className="px-3 py-2.5 text-muted">{h.sube.ad}</td>}
                  <td className={cn("tabular px-3 py-2.5 text-right font-medium", ARTAN.has(h.tip) ? "text-ok" : "text-danger")}>{ARTAN.has(h.tip) ? "+" : "−"}{h.miktar}</td>
                  <td className="px-3 py-2.5 text-xs text-muted">{h.kullaniciSnap?.split(" <")[0] ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kart>
    );
  }
  const toplamSayfa = Math.max(1, Math.ceil(toplam / SAYFA));

  return (
    <>
      <Baslik baslik="Hareketler" aciklama={`${toplam.toLocaleString("tr-TR")} kayıt${kullanici.rol === "SUPER_ADMIN" && !kapsam ? " · tüm şubeler" : ""}`} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[["satis", "Satışlar"], ["hareket", "Stok hareketleri"]].map(([k, ad]) => (
          <Link key={k} href={link({ sekme: k, sayfa: undefined, tip: undefined })} className={cn("rounded-xl border px-4 py-2 text-sm font-medium", sekme === k ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:bg-surface-2")}>{ad}</Link>
        ))}
      </div>
      <form action="/hareketler" className="mb-5 flex flex-wrap items-end gap-2">
        <input type="hidden" name="sekme" value={sekme} />
        <label className="text-xs text-muted">Başlangıç<input type="date" name="bas" defaultValue={bas} className="mt-1 block min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" /></label>
        <label className="text-xs text-muted">Bitiş<input type="date" name="bit" defaultValue={bit} className="mt-1 block min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" /></label>
        {sekme === "hareket" && (
          <label className="text-xs text-muted">İşlem<select name="tip" defaultValue={sp.tip ?? ""} className="mt-1 block min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground"><option value="">Tümü</option>{Object.entries(TIP_AD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        )}
        <label className="min-w-40 flex-1 text-xs text-muted">Ara<input name="q" defaultValue={sp.q} placeholder={sekme === "satis" ? "Fiş no veya ürün" : "Ürün adı veya barkod"} className="mt-1 block min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground" /></label>
        <button className="min-h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background">Filtrele</button>
        {(bas || bit || sp.q || sp.tip) && <Link href={`/hareketler?sekme=${sekme}`} className="inline-flex min-h-11 items-center px-2 text-sm text-muted underline">Temizle</Link>}
      </form>
      {govde}
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
