"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, Landmark, Minus, Plus, Printer, Search, Shuffle, ShoppingBag, Trash2 } from "lucide-react";
import { BosDurum, Buton, Girdi, Kart, Modal, Rozet, cn } from "@/components/ui";
import { BarkodGirisi, useBarkodDinleyici } from "@/components/Tarayici";
import { UrunGorseli } from "@/components/UrunGorseli";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/istemci";
import { bip } from "@/lib/ses";
import { paraFormat } from "@/lib/para";

type Urun = { id: string; urunAdi: string; marka: string | null; gorselUrl: string | null; renk: string; beden: string; barkod: string; satisFiyati: number; stok: number };
type Sepet = Urun & { adet: number; fiyat: number };
type Odeme = "NAKIT" | "KART" | "HAVALE" | "KARISIK";
type Fis = { no: string; toplam: number; indirim: number; odeme: Odeme; kalemler: Sepet[]; tarih: string };

const ODEME: { k: Odeme; ad: string; ikon: typeof Banknote }[] = [
  { k: "NAKIT", ad: "Nakit", ikon: Banknote }, { k: "KART", ad: "Kart", ikon: CreditCard }, { k: "HAVALE", ad: "Havale/EFT", ikon: Landmark }, { k: "KARISIK", ad: "Karışık", ikon: Shuffle },
];
const sayi = (s: string) => Number(s.replace(",", "."));

export function SatisIstemci({ yonetici, subeAdi, kasiyerAdi }: { yonetici: boolean; subeAdi: string; kasiyerAdi: string }) {
  const bildir = useToast();
  const [sepet, setSepet] = useState<Sepet[]>([]);
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState<Urun[]>([]);
  const [araniyor, setAraniyor] = useState(false);
  const [odeme, setOdeme] = useState<Odeme>("NAKIT");
  const [indirim, setIndirim] = useState("");
  const [sepetAcik, setSepetAcik] = useState(false);
  const [gonderiyor, setGonderiyor] = useState(false);
  const [fis, setFis] = useState<Fis | null>(null);
  const sepetRef = useRef(sepet);
  sepetRef.current = sepet;

  // Ürün arama (yazarken gecikmeli)
  useEffect(() => {
    if (q.trim().length < 2) { setSonuc([]); return; }
    setAraniyor(true);
    const t = setTimeout(async () => {
      try {
        setSonuc((await api<{ sonuclar: Urun[] }>(`/api/pos/ara?q=${encodeURIComponent(q.trim())}`)).sonuclar);
      } catch (e) { bildir((e as Error).message, "hata"); } finally { setAraniyor(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, bildir]);

  const ekle = useCallback((u: Urun) => {
    if (u.stok <= 0) { bip(false); bildir(`Stokta yok: ${u.urunAdi} ${u.renk}/${u.beden}`, "hata"); return; }
    const mevcut = sepetRef.current.find((s) => s.id === u.id);
    if (mevcut && mevcut.adet >= u.stok) { bip(false); bildir(`En fazla ${u.stok} adet var`, "hata"); return; }
    bip(true);
    setSepet((l) => (mevcut ? l.map((s) => (s.id === u.id ? { ...s, adet: s.adet + 1 } : s)) : [...l, { ...u, adet: 1, fiyat: u.satisFiyati }]));
  }, [bildir]);

  const barkodOkundu = useCallback(async (kod: string) => {
    try {
      const r = await api<{ bulundu: boolean; varyant?: { id: string; urunAdi: string; marka: string | null; gorselUrl: string | null; renk: string; beden: string; barkod: string; satisFiyati: number; stok: number; aktif: boolean } }>(`/api/barkod/${encodeURIComponent(kod)}`);
      if (!r.bulundu || !r.varyant || !r.varyant.aktif) { bip(false); bildir(`Barkod kayıtlı değil: ${kod}`, "hata"); return; }
      ekle({ ...r.varyant, id: r.varyant.id });
    } catch (e) { bip(false); bildir((e as Error).message, "hata"); }
  }, [ekle, bildir]);

  useBarkodDinleyici(barkodOkundu, !fis);

  const ara = sepet.reduce((t, s) => t + s.fiyat * s.adet, 0);
  const ind = Math.min(Math.max(sayi(indirim) || 0, 0), ara);
  const toplam = ara - ind;
  const adetToplam = sepet.reduce((t, s) => t + s.adet, 0);

  const degistir = (id: string, d: Partial<Sepet>) => setSepet((l) => l.map((s) => (s.id === id ? { ...s, ...d } : s)));
  const adetDegistir = (s: Sepet, fark: number) => {
    const y = s.adet + fark;
    if (y < 1) return setSepet((l) => l.filter((x) => x.id !== s.id));
    if (y > s.stok) { bip(false); return bildir(`En fazla ${s.stok} adet var`, "hata"); }
    degistir(s.id, { adet: y });
  };

  async function tamamla() {
    setGonderiyor(true);
    try {
      const r = await api<{ satis: { no: string; toplam: number; indirim: number } }>("/api/satis", {
        govde: {
          odemeTipi: odeme, indirim: ind || undefined,
          kalemler: sepet.map((s) => ({ varyantId: s.id, adet: s.adet, ...(yonetici && s.fiyat !== s.satisFiyati ? { birimFiyat: s.fiyat } : {}) })),
        },
      });
      setFis({ no: r.satis.no, toplam: r.satis.toplam, indirim: r.satis.indirim, odeme, kalemler: sepet, tarih: new Date().toLocaleString("tr-TR") });
      setSepet([]); setIndirim(""); setSepetAcik(false); setQ(""); setSonuc([]);
      bip(true);
    } catch (e) { bip(false); bildir((e as Error).message, "hata"); } finally { setGonderiyor(false); }
  }

  const SepetPaneli = useMemo(() => (
    <div className="flex h-full flex-col">
      {sepet.length === 0 ? (
        <BosDurum ikon={<ShoppingBag className="size-6" />} baslik="Sepet boş" aciklama="Ürünün barkodunu okutun veya yukarıdan arayıp ürüne dokunun." />
      ) : (
        <ul className="divide-y divide-border">
          {sepet.map((s) => (
            <li key={s.id} className="flex gap-3 py-3">
              <UrunGorseli src={s.gorselUrl} ad={s.urunAdi} marka={s.marka} className="size-14 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.urunAdi}</p>
                <p className="text-xs text-muted">{s.marka && `${s.marka} · `}{s.renk} · {s.beden}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-border">
                    <button onClick={() => adetDegistir(s, -1)} aria-label="Azalt" className="grid size-9 place-items-center text-muted hover:text-foreground"><Minus className="size-4" /></button>
                    <span className="tabular w-8 text-center text-sm font-medium" aria-label="Adet">{s.adet}</span>
                    <button onClick={() => adetDegistir(s, 1)} aria-label="Artır" className="grid size-9 place-items-center text-muted hover:text-foreground"><Plus className="size-4" /></button>
                  </div>
                  {yonetici ? (
                    <Girdi inputMode="decimal" aria-label="Birim fiyat" value={String(s.fiyat)} onChange={(e) => degistir(s.id, { fiyat: Math.max(0, sayi(e.target.value) || 0) })} className="min-h-9 w-24 py-0 text-right text-sm" />
                  ) : <span className="tabular text-sm text-muted">{paraFormat(s.fiyat)}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end justify-between">
                <button onClick={() => setSepet((l) => l.filter((x) => x.id !== s.id))} aria-label="Kaldır" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                <span className="tabular text-sm font-semibold">{paraFormat(s.fiyat * s.adet)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [sepet, yonetici]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
      <div className="min-w-0 space-y-4">
        <Kart className="space-y-3 p-4">
          <BarkodGirisi onKod={barkodOkundu} otomatikOdak aiYedek />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
            <Girdi value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ürün ara: ad, marka, renk, beden…" className="pl-10" aria-label="Ürün ara" />
          </div>
          <p className="text-xs text-muted">USB/Bluetooth barkod okuyucu bağlıysa sayfada herhangi bir yerde okutmanız yeterli; ürün otomatik sepete eklenir.</p>
        </Kart>

        {q.trim().length >= 2 && (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {araniyor && sonuc.length === 0 && <p className="col-span-full text-sm text-muted">Aranıyor…</p>}
            {!araniyor && sonuc.length === 0 && <p className="col-span-full text-sm text-muted">Sonuç bulunamadı.</p>}
            {sonuc.map((u) => (
              <button key={u.id} onClick={() => ekle(u)} disabled={u.stok <= 0} className="anim-yukari flex gap-3 rounded-2xl border border-border bg-surface p-2.5 text-left transition hover:border-accent hover:shadow-md active:scale-[0.99] disabled:opacity-50">
                <UrunGorseli src={u.gorselUrl} ad={u.urunAdi} marka={u.marka} className="size-16 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.urunAdi}</span>
                  <span className="block truncate text-xs text-muted">{u.marka && `${u.marka} · `}{u.renk} · {u.beden}</span>
                  <span className="mt-1 flex items-center justify-between gap-2"><span className="tabular text-sm font-semibold">{paraFormat(u.satisFiyati)}</span><Rozet ton={u.stok <= 0 ? "tehlike" : u.stok <= 2 ? "uyari" : "ok"}>{u.stok <= 0 ? "Tükendi" : `${u.stok} adet`}</Rozet></span>
                </span>
              </button>
            ))}
          </div>
        )}

      </div>

      {/* Sepet: tek panel. Masaüstünde sağda yapışkan + ödeme alanı; mobilde arama altında, ödeme alt çubuktan açılır */}
      <aside aria-label="Sepet">
        <Kart className="flex flex-col overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)]">
          <div className="border-b border-border px-5 py-4"><h2 className="font-display text-lg font-semibold">Sepet {adetToplam > 0 && <span className="text-sm font-normal text-muted">({adetToplam} ürün)</span>}</h2></div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5">{SepetPaneli}</div>
          <div className="hidden lg:block">
            <Odeme odeme={odeme} setOdeme={setOdeme} ara={ara} ind={ind} toplam={toplam} indirim={indirim} setIndirim={setIndirim} yonetici={yonetici} bos={sepet.length === 0} gonderiyor={gonderiyor} tamamla={tamamla} />
          </div>
        </Kart>
      </aside>

      {/* Mobil alt çubuk */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <Buton className="w-full" disabled={sepet.length === 0} onClick={() => setSepetAcik(true)}><ShoppingBag className="size-4" /> Ödemeye geç · {adetToplam} ürün · {paraFormat(toplam)}</Buton>
      </div>
      <Modal acik={sepetAcik} kapat={() => setSepetAcik(false)} baslik="Ödeme">
        <Odeme odeme={odeme} setOdeme={setOdeme} ara={ara} ind={ind} toplam={toplam} indirim={indirim} setIndirim={setIndirim} yonetici={yonetici} bos={sepet.length === 0} gonderiyor={gonderiyor} tamamla={tamamla} icte />
      </Modal>

      <Modal acik={!!fis} kapat={() => setFis(null)} baslik="Satış tamamlandı">
        {fis && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-ok-soft p-4 text-ok"><CheckCircle2 className="size-8 shrink-0" /><div><p className="font-semibold">Satış kaydedildi</p><p className="text-sm">Fiş no: {fis.no}</p></div></div>
            <div className="yazdir mx-auto w-full max-w-xs rounded-xl border border-dashed border-border p-4 text-sm print:max-w-none print:border-0">
              <p className="text-center font-display text-lg font-semibold">IQ Fashion</p>
              <p className="text-center text-xs text-muted">{subeAdi}</p>
              <p className="mt-2 text-center text-xs">{fis.tarih} · Fiş {fis.no}</p>
              <hr className="my-2 border-border" />
              {fis.kalemler.map((k) => (
                <div key={k.id} className="flex justify-between gap-2 py-0.5"><span className="min-w-0 truncate">{k.adet}× {k.urunAdi} {k.renk}/{k.beden}</span><span className="tabular shrink-0">{paraFormat(k.fiyat * k.adet)}</span></div>
              ))}
              <hr className="my-2 border-border" />
              {fis.indirim > 0 && <div className="flex justify-between text-muted"><span>İndirim</span><span className="tabular">-{paraFormat(fis.indirim)}</span></div>}
              <div className="flex justify-between text-base font-semibold"><span>Toplam</span><span className="tabular">{paraFormat(fis.toplam)}</span></div>
              <p className="mt-1 text-xs text-muted">Ödeme: {ODEME.find((o) => o.k === fis.odeme)?.ad} · Kasiyer: {kasiyerAdi}</p>
              <p className="mt-3 text-center text-xs text-muted">Bizi tercih ettiğiniz için teşekkürler</p>
            </div>
            <div className="flex justify-end gap-2 print:hidden"><Buton varyant="ikincil" onClick={() => window.print()}><Printer className="size-4" /> Fişi yazdır</Buton><Buton onClick={() => setFis(null)}>Yeni satış</Buton></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Odeme({ odeme, setOdeme, ara, ind, toplam, indirim, setIndirim, yonetici, bos, gonderiyor, tamamla, icte }: {
  odeme: Odeme; setOdeme: (o: Odeme) => void; ara: number; ind: number; toplam: number; indirim: string; setIndirim: (s: string) => void; yonetici: boolean; bos: boolean; gonderiyor: boolean; tamamla: () => void; icte?: boolean;
}) {
  return (
    <div className={cn("space-y-4", icte ? "" : "border-t border-border p-5")}>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ödeme tipi">
        {ODEME.map((o) => (
          <button key={o.k} role="radio" aria-checked={odeme === o.k} onClick={() => setOdeme(o.k)} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition", odeme === o.k ? "border-foreground bg-foreground text-background" : "border-border hover:bg-surface-2")}>
            <o.ikon className="size-4" />{o.ad}
          </button>
        ))}
      </div>
      {yonetici && (
        <label className="flex items-center justify-between gap-3 text-sm">İndirim (₺)<Girdi inputMode="decimal" value={indirim} onChange={(e) => setIndirim(e.target.value)} placeholder="0" className="min-h-10 w-28 py-1 text-right" /></label>
      )}
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between text-muted"><dt>Ara toplam</dt><dd className="tabular">{paraFormat(ara)}</dd></div>
        {ind > 0 && <div className="flex justify-between text-muted"><dt>İndirim</dt><dd className="tabular">-{paraFormat(ind)}</dd></div>}
        <div className="flex items-baseline justify-between pt-1 text-lg font-semibold"><dt>Toplam</dt><dd className="tabular text-2xl">{paraFormat(toplam)}</dd></div>
      </dl>
      <Buton className="w-full" disabled={bos} yukleniyor={gonderiyor} onClick={tamamla}>Satışı tamamla</Buton>
    </div>
  );
}
