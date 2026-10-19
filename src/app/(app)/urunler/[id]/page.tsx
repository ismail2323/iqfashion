import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer, Receipt } from "lucide-react";
import { prisma } from "@/lib/db";
import { sayfaBaglami } from "@/lib/sayfa";
import { maliyetGorebilir } from "@/lib/rbac";
import { bedenSirasi, renkHex } from "@/lib/giyim";
import { paraFormat, sayiFormat } from "@/lib/para";
import { tarihFormat } from "@/lib/tarih";
import { Baslik, Kart, Rozet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { UrunGorseli } from "@/components/UrunGorseli";
import { UrunDuzenle } from "./UrunDuzenle";

export const metadata = { title: "Ürün" };

export default async function UrunDetay({ params }: { params: Promise<{ id: string }> }) {
  const { kullanici, kapsam } = await sayfaBaglami();
  const { id } = await params;
  const u = await prisma.urun.findUnique({
    where: { id },
    include: { marka: true, kategori: true, tedarikci: true, varyantlar: { include: { stoklar: { include: { sube: { select: { id: true, ad: true } } } } } } },
  });
  if (!u) notFound();
  const yonetici = kullanici.rol !== "KASIYER";
  const superAdmin = kullanici.rol === "SUPER_ADMIN";
  const maliyet = maliyetGorebilir(kullanici);
  const subeler = await prisma.sube.findMany({ where: { aktif: true, ...(kapsam ? { id: kapsam } : {}) }, orderBy: { ad: "asc" }, select: { id: true, ad: true } });

  const stokOf = (v: (typeof u.varyantlar)[number], subeId?: string) => v.stoklar.filter((s) => !subeId || s.subeId === subeId).reduce((t, s) => t + s.miktar, 0);
  const kapsamStok = (v: (typeof u.varyantlar)[number]) => (kapsam ? stokOf(v, kapsam) : stokOf(v));
  const renkler = [...new Set(u.varyantlar.map((v) => v.renk))];
  const bedenler = [...new Set(u.varyantlar.map((v) => v.beden))].sort((a, b) => bedenSirasi(a) - bedenSirasi(b));
  const toplam = u.varyantlar.reduce((t, v) => t + kapsamStok(v), 0);
  const degerMaliyet = u.varyantlar.reduce((t, v) => t + kapsamStok(v) * Number(v.alisFiyati), 0);

  const [gecmis, hareketler] = await Promise.all([
    maliyet ? prisma.fiyatGecmisi.findMany({ where: { varyantId: { in: u.varyantlar.map((v) => v.id) } }, orderBy: { createdAt: "desc" }, take: 12, include: { varyant: { select: { renk: true, beden: true } } } }) : Promise.resolve([]),
    prisma.stokHareketi.findMany({ where: { varyantId: { in: u.varyantlar.map((v) => v.id) }, ...(kapsam ? { subeId: kapsam } : {}) }, orderBy: { createdAt: "desc" }, take: 10, include: { sube: { select: { ad: true } } } }),
  ]);
  const HAREKET_AD: Record<string, string> = { ALIS: "Alış", SATIS: "Satış", IADE: "İade", TRANSFER_CIKIS: "Transfer çıkış", TRANSFER_GIRIS: "Transfer giriş", DUZELTME_ARTIS: "Düzeltme +", DUZELTME_AZALIS: "Düzeltme −", SAYIM: "Sayım" };

  return (
    <div className="space-y-5">
      <Link href="/urunler" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" /> Ürünler</Link>
      <Baslik baslik={u.ad} aciklama={`${u.marka?.ad ?? "Markasız"}${u.kategori ? ` · ${u.kategori.ad}` : ""}${u.tedarikci ? ` · ${u.tedarikci.ad}` : ""}`}
        aksiyon={yonetici && (
          <>
            <Link href={`/etiketler?urun=${u.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2"><Printer className="size-4" /> Etiket</Link>
            <Link href={`/alis?urun=${u.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2"><Receipt className="size-4" /> Stok ekle</Link>
            <UrunDuzenle urun={{ id: u.id, ad: u.ad, marka: u.marka?.ad ?? "", kategori: u.kategori?.ad ?? "", cinsiyet: u.cinsiyet ?? "", sezon: u.sezon ?? "", aktif: u.aktif }} superAdmin={superAdmin} />
          </>
        )} />

      <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
        <Kart className="self-start overflow-hidden"><UrunGorseli src={u.gorselUrl} ad={u.ad} marka={u.marka?.ad} className="aspect-[4/5] w-full" /></Kart>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kart className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Toplam stok</p><p className="tabular mt-1 text-2xl font-semibold">{sayiFormat(toplam)}</p></Kart>
            <Kart className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Varyant</p><p className="tabular mt-1 text-2xl font-semibold">{u.varyantlar.length}</p></Kart>
            {maliyet && <Kart className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Stok maliyeti</p><p className="tabular mt-1 text-xl font-semibold">{paraFormat(degerMaliyet)}</p></Kart>}
            <Kart className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Sezon / cinsiyet</p><p className="mt-1 text-sm font-medium">{{ YAZLIK: "Yazlık", KISLIK: "Kışlık", IKI_SEZON: "İki sezon" }[u.sezon ?? "" as "YAZLIK"] ?? "—"} · {{ ERKEK: "Erkek", KADIN: "Kadın", COCUK: "Çocuk", UNISEX: "Unisex" }[u.cinsiyet ?? "" as "ERKEK"] ?? "—"}</p></Kart>
          </div>

          <Kart className="overflow-hidden">
            <div className="border-b border-border px-5 py-3"><h2 className="font-display text-lg font-semibold">Renk × beden stok matrisi</h2><p className="text-xs text-muted">{kapsam ? "Seçili şubenin stoğu" : "Tüm şubelerin toplamı"} · kırmızı: tükendi, sarı: kritik</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead className="bg-surface-2 text-xs text-muted"><tr><th className="px-4 py-2 text-left font-medium">Renk</th>{bedenler.map((b) => <th key={b} className="px-3 py-2 font-medium">{b}</th>)}<th className="px-3 py-2 font-medium">Toplam</th></tr></thead>
                <tbody>
                  {renkler.map((r) => {
                    const sat = u.varyantlar.filter((v) => v.renk === r);
                    return (
                      <tr key={r} className="border-t border-border">
                        <td className="whitespace-nowrap px-4 py-2.5"><span className="mr-2 inline-block size-3.5 rounded-full border border-black/20 align-middle" style={{ background: renkHex(r) }} />{r}</td>
                        {bedenler.map((b) => {
                          const v = sat.find((x) => x.beden === b);
                          if (!v) return <td key={b} className="px-3 py-2.5 text-center text-muted/40">·</td>;
                          const s = kapsamStok(v);
                          return <td key={b} className="px-2 py-1.5 text-center"><span className={cn("tabular inline-block min-w-9 rounded-lg px-2 py-1 font-medium", s === 0 ? "bg-danger-soft text-danger" : s <= v.minStok ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok")}>{s}</span></td>;
                        })}
                        <td className="tabular px-3 py-2.5 text-center font-semibold">{sat.reduce((t, v) => t + kapsamStok(v), 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Kart>
        </div>
      </div>

      <Kart className="overflow-hidden">
        <div className="border-b border-border px-5 py-3"><h2 className="font-display text-lg font-semibold">Varyantlar</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-2 text-left font-medium">Renk / Beden</th><th className="px-3 py-2 text-left font-medium">Barkod</th>{maliyet && <th className="px-3 py-2 text-right font-medium">Alış</th>}<th className="px-3 py-2 text-right font-medium">Satış</th>{subeler.map((s) => <th key={s.id} className="px-3 py-2 text-right font-medium">{s.ad}</th>)}<th className="px-3 py-2 text-right font-medium">Min</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {u.varyantlar.sort((a, b) => a.renk.localeCompare(b.renk, "tr") || bedenSirasi(a.beden) - bedenSirasi(b.beden)).map((v) => (
                <tr key={v.id} className={v.aktif ? "" : "opacity-50"}>
                  <td className="px-4 py-2.5 font-medium">{v.renk} · {v.beden}</td>
                  <td className="tabular px-3 py-2.5 text-xs text-muted">{v.barkod}</td>
                  {maliyet && <td className="tabular px-3 py-2.5 text-right">{paraFormat(v.alisFiyati.toString())}</td>}
                  <td className="tabular px-3 py-2.5 text-right font-medium">{paraFormat(v.satisFiyati.toString())}</td>
                  {subeler.map((s) => <td key={s.id} className="tabular px-3 py-2.5 text-right">{stokOf(v, s.id)}</td>)}
                  <td className="tabular px-3 py-2.5 text-right text-muted">{v.minStok}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kart>

      <div className="grid gap-5 lg:grid-cols-2">
        <Kart className="overflow-hidden">
          <div className="border-b border-border px-5 py-3"><h2 className="font-display text-lg font-semibold">Son hareketler</h2></div>
          {hareketler.length === 0 ? <p className="p-5 text-sm text-muted">Hareket yok.</p> : (
            <ul className="divide-y divide-border">
              {hareketler.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <div><p className="font-medium">{HAREKET_AD[h.tip]} · {h.miktar} adet</p><p className="text-xs text-muted">{tarihFormat(h.createdAt, true)} · {h.sube.ad}</p></div>
                  <Rozet ton={["SATIS", "TRANSFER_CIKIS", "DUZELTME_AZALIS"].includes(h.tip) ? "tehlike" : "ok"}>{["SATIS", "TRANSFER_CIKIS", "DUZELTME_AZALIS"].includes(h.tip) ? "−" : "+"}{h.miktar}</Rozet>
                </li>
              ))}
            </ul>
          )}
        </Kart>
        {maliyet && (
          <Kart className="overflow-hidden">
            <div className="border-b border-border px-5 py-3"><h2 className="font-display text-lg font-semibold">Fiyat geçmişi</h2></div>
            {gecmis.length === 0 ? <p className="p-5 text-sm text-muted">Kayıt yok.</p> : (
              <ul className="divide-y divide-border">
                {gecmis.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <div><p className="font-medium">{g.varyant.renk} · {g.varyant.beden}</p><p className="text-xs text-muted">{tarihFormat(g.createdAt, true)}</p></div>
                    <p className="tabular text-right text-xs"><span className="text-muted">Alış</span> {paraFormat(g.alis.toString())}<br /><span className="text-muted">Satış</span> {paraFormat(g.satis.toString())}</p>
                  </li>
                ))}
              </ul>
            )}
          </Kart>
        )}
      </div>
    </div>
  );
}
