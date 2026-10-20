"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Camera, CheckCircle2, Images, Loader2, RefreshCw, Sparkles, Trash2, UploadCloud, XCircle } from "lucide-react";
import { Buton, Girdi, Kart, Rozet, cn } from "@/components/ui";
import { KameraCekici } from "@/components/KameraCekici";
import { useToast } from "@/components/Toast";
import { api, ApiHatasi } from "@/lib/istemci";
import { aiGorseliHazirla, urunGorseliHazirla } from "@/lib/resim";
import { gorselYukle } from "@/lib/yukle";
import { barkodIyilestir, yerelBarkodOku } from "@/lib/etiketBarkod";
import { paraFormat } from "@/lib/para";
import { BEDEN_GRUPLARI, normalBeden, type BedenGrubu } from "@/lib/giyim";

type Grup = "tek" | BedenGrubu;
type Durum = "sirada" | "analiz" | "hazir" | "hata" | "kaydedildi" | "kayit_hata";
type Satir = {
  id: string; durum: Durum; mesaj?: string; onizleme: string; gorsel?: Blob;
  ad: string; marka: string; kategori: string; renk: string; beden: string; barkod: string; adet: string; alis: string; satis: string;
  uyarilar: string[]; guven: number | null;
  grup: Grup; bedenAdet: Record<string, string>; // grup seçiliyse: beden → adet kutuları
  mevcut?: { varyantId: string; urunAdi: string; renk: string; beden: string; stok: number; satis: number; alis: number | null };
};
type Varsayilan = { kategori: string; tedarikci: string; alis: string; satis: string; adet: string; grup: Grup };
type EtiketSonucu = { marka: string | null; urunAdi: string | null; kategori: string | null; renk: string | null; beden: string | null; barkod: string | null; fiyat: number | null; guven: number | null; uyarilar: string[] };

const MAX_EZAMANLI = 3;
let sayac = 0;
const sayi = (s: string) => Number(s.replace(",", "."));

export function TopluGiris({ aiHazir }: { aiHazir: boolean }) {
  const bildir = useToast();
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [vars, setVars] = useState<Varsayilan>({ kategori: "", tedarikci: "", alis: "", satis: "", adet: "1", grup: "tek" });
  const [kamera, setKamera] = useState(false);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [surukle, setSurukle] = useState(false);
  const dosyaRef = useRef<HTMLInputElement>(null);
  const kuyruk = useRef<{ id: string; dosya: File }[]>([]);
  const aktif = useRef(0);
  const varsRef = useRef(vars);
  varsRef.current = vars;

  const guncelle = useCallback((id: string, d: Partial<Satir>) => setSatirlar((l) => l.map((s) => (s.id === id ? { ...s, ...d } : s))), []);

  const isle = useCallback(async (id: string, dosya: File) => {
    guncelle(id, { durum: "analiz", mesaj: undefined });
    try {
      const [kucuk, ai] = await Promise.all([urunGorseliHazirla(dosya), aiGorseliHazirla(dosya)]);
      const yerel = yerelBarkodOku(dosya, ai.blob); // AI analiziyle paralel: çizgilerden okuma
      guncelle(id, { onizleme: kucuk.dataUrl, gorsel: kucuk.blob });
      if (!aiHazir) { guncelle(id, { durum: "hata", mesaj: "Yapay zeka kapalı, bilgileri elle girin." }); return; }
      let sonuc: EtiketSonucu | null = null;
      // Çok fotoğrafta hız sınırı (429) ya da geçici AI/ağ hatası (502/0) olabilir: bekleyip tekrar dene (toplam 6 deneme)
      for (let deneme = 0; deneme < 6 && !sonuc; deneme++) {
        try {
          sonuc = (await api<{ sonuc: EtiketSonucu }>("/api/ai/etiket", { govde: { gorsel: ai.dataUrl } })).sonuc;
        } catch (e) {
          const gecici = e instanceof ApiHatasi && (e.durum === 429 || e.durum === 502 || e.durum === 0);
          if (gecici && deneme < 5) await new Promise((r) => setTimeout(r, e instanceof ApiHatasi && e.durum === 429 ? 8000 : 3000));
          else throw e;
        }
      }
      if (!sonuc) throw new Error("Analiz yapılamadı");
      sonuc = await barkodIyilestir(sonuc, dosya, await yerel);
      const v = varsRef.current;
      let mevcut: Satir["mevcut"];
      if (sonuc.barkod) {
        const b = await api<{ bulundu: boolean; varyant?: { id: string; urunAdi: string; renk: string; beden: string; stok: number; alisFiyati: number | null; satisFiyati: number } }>(`/api/barkod/${encodeURIComponent(sonuc.barkod)}`).catch(() => null);
        if (b?.bulundu && b.varyant) {
          const k = (x: string | null) => (x ?? "").trim().toLocaleLowerCase("tr-TR");
          const uyumlu = (!sonuc.renk || k(sonuc.renk) === k(b.varyant.renk)) && (!sonuc.beden || k(sonuc.beden) === k(b.varyant.beden));
          if (uyumlu) mevcut = { varyantId: b.varyant.id, urunAdi: b.varyant.urunAdi, renk: b.varyant.renk, beden: b.varyant.beden, stok: b.varyant.stok, satis: b.varyant.satisFiyati, alis: b.varyant.alisFiyati };
          else sonuc.uyarilar = [...sonuc.uyarilar, `Bu barkod başka varyantta kayıtlı (${b.varyant.renk}/${b.varyant.beden}). Etikette ${sonuc.renk ?? "?"}/${sonuc.beden ?? "?"} yazıyor; bu satır AYRI varyant olarak açılacak, sisteme yeni barkod verilir.`];
        }
      }
      guncelle(id, {
        durum: "hazir", guven: sonuc.guven, uyarilar: sonuc.uyarilar, mevcut,
        marka: sonuc.marka ?? "", ad: sonuc.urunAdi ?? "", kategori: sonuc.kategori ?? v.kategori, renk: sonuc.renk ?? "", beden: sonuc.beden ?? "",
        barkod: sonuc.barkod ?? "", adet: v.adet || "1", alis: v.alis || (mevcut?.alis != null ? String(mevcut.alis) : ""),
        satis: mevcut ? String(mevcut.satis) : sonuc.fiyat !== null ? String(sonuc.fiyat) : v.satis,
      });
    } catch (e) {
      guncelle(id, { durum: "hata", mesaj: (e as Error).message });
    }
  }, [aiHazir, guncelle]);

  const pompa = useCallback(() => {
    while (aktif.current < MAX_EZAMANLI && kuyruk.current.length) {
      const is = kuyruk.current.shift()!;
      aktif.current++;
      void isle(is.id, is.dosya).finally(() => { aktif.current--; pompa(); });
    }
  }, [isle]);

  const ekle = useCallback((dosyalar: File[]) => {
    const resimler = dosyalar.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (!resimler.length) return bildir("Görsel dosyası seçilmedi", "hata");
    const yeni: Satir[] = resimler.map((f) => ({
      id: `s${++sayac}`, durum: "sirada", onizleme: URL.createObjectURL(f), ad: "", marka: "", kategori: varsRef.current.kategori, renk: "", beden: "", barkod: "",
      adet: varsRef.current.adet || "1", alis: varsRef.current.alis, satis: varsRef.current.satis, uyarilar: [], guven: null, grup: varsRef.current.grup, bedenAdet: {},
    }));
    setSatirlar((l) => [...l, ...yeni]);
    yeni.forEach((s, i) => kuyruk.current.push({ id: s.id, dosya: resimler[i] }));
    pompa();
  }, [bildir, pompa]);

  useEffect(() => { /* sayfadan çıkarken beklemeyen blob url'leri bırak */ return () => { kuyruk.current = []; }; }, []);

  const eksikler = (s: Satir): string[] => {
    const e: string[] = [];
    if (!s.ad.trim()) e.push("ürün adı");
    if (s.grup !== "tek") {
      if (!s.renk.trim()) e.push("renk");
      if (!(sayi(s.satis) > 0)) e.push("satış fiyatı");
      if (bedenKalemleri(s).length === 0) e.push("en az bir bedene adet");
    } else {
      if (!s.mevcut) {
        if (!s.renk.trim()) e.push("renk");
        if (!s.beden.trim()) e.push("beden");
        if (!(sayi(s.satis) > 0)) e.push("satış fiyatı");
      }
      if (!(Number.isInteger(sayi(s.adet)) && sayi(s.adet) >= 1)) e.push("adet");
    }
    if (!(sayi(s.alis) >= 0) || s.alis.trim() === "") e.push("alış fiyatı");
    return e;
  };

  /** Beden grubunu değiştirir. Kayıtlı barkodla gelen satır gruba geçerken kilidi açılır (stok ekleme kararı sunucuda, renk+beden uyumuna göre). */
  const grupUygula = (s: Satir, g: Grup): Satir => ({
    ...s, grup: g,
    ...(g !== "tek" && s.mevcut ? { renk: s.renk || s.mevcut.renk, beden: s.beden || s.mevcut.beden, mevcut: undefined } : {}),
  });
  const grupSec = (id: string, g: Grup) => setSatirlar((l) => l.map((s) => (s.id === id ? grupUygula(s, g) : s)));
  const bedenAdetiYaz = (id: string, b: string, v: string) => setSatirlar((l) => l.map((s) => (s.id === id ? { ...s, bedenAdet: { ...s.bedenAdet, [b]: v.replace(/\D/g, "") } } : s)));

  const kaydedilebilir = satirlar.filter((s) => ["hazir", "hata", "kayit_hata"].includes(s.durum) && eksikler(s).length === 0);
  const bekleyen = satirlar.filter((s) => s.durum === "sirada" || s.durum === "analiz").length;

  /** hepsi=false: yalnızca boş alanlar; hepsi=true: dolu olanların üzerine de yazar (yalnızca ortak alanda değer girilmiş olanlar) */
  function varsayilanlariUygula(hepsi: boolean) {
    const ye = (s: string, v: string) => (v.trim() && (hepsi || !s.trim()) ? v : s);
    setSatirlar((l) => l.map((s) => {
      if (s.durum === "kaydedildi" || s.durum === "sirada" || s.durum === "analiz") return s;
      const g = {
        ...s,
        kategori: s.mevcut ? s.kategori : ye(s.kategori, vars.kategori),
        alis: ye(s.alis, vars.alis),
        satis: s.mevcut ? s.satis : ye(s.satis, vars.satis),
        adet: ye(s.adet, vars.adet),
      };
      return hepsi ? grupUygula(g, vars.grup) : g;
    }));
    bildir(hepsi ? "Tüm satırlara uygulandı" : "Boş alanlara uygulandı");
  }
  async function hepsiniKaydet() {
    setKaydediyor(true);
    try {
      const secili = kaydedilebilir;
      // Aynı ürünün (marka + ad) yalnızca ilk satırının görseli yüklenir
      const gorselUrl = new Map<string, string>();
      const gorselIds = new Map<string, string>();
      for (const s of secili) {
        const k = `${s.marka.trim().toLocaleLowerCase("tr-TR")}|${s.ad.trim().toLocaleLowerCase("tr-TR")}`;
        if (s.mevcut || gorselIds.has(k) || !s.gorsel) continue;
        gorselIds.set(k, s.id);
        try { gorselUrl.set(k, await gorselYukle(s.gorsel)); } catch { /* görselsiz devam */ }
      }
      const payload = secili.flatMap((s) => {
        const k = `${s.marka.trim().toLocaleLowerCase("tr-TR")}|${s.ad.trim().toLocaleLowerCase("tr-TR")}`;
        if (s.grup !== "tek") {
          // Grup satırı: adet girilen her beden ayrı varyant olur. Etiketteki barkod yalnızca okunan bedene verilir (diğerlerine sistem üretir).
          const okunan = normalBeden(s.beden);
          return bedenKalemleri(s).map(({ b, n }) => ({
            id: `${s.id}#${b}`, varyantId: null, ad: s.ad, markaAd: s.marka || null, kategoriAd: s.kategori || null, tedarikciAd: vars.tedarikci || null,
            gorselUrl: gorselUrl.get(k) ?? null, renk: s.renk, beden: b, barkod: b === okunan && s.barkod ? s.barkod : null,
            adet: n, alisFiyati: sayi(s.alis), satisFiyati: sayi(s.satis) || 0,
          }));
        }
        return [{
          id: s.id, varyantId: s.mevcut?.varyantId ?? null, ad: s.ad, markaAd: s.marka || null, kategoriAd: s.kategori || null, tedarikciAd: vars.tedarikci || null,
          gorselUrl: gorselUrl.get(k) ?? null, renk: s.mevcut ? s.mevcut.renk : s.renk, beden: s.mevcut ? s.mevcut.beden : s.beden, barkod: s.mevcut ? null : s.barkod || null,
          adet: Math.round(sayi(s.adet)), alisFiyati: sayi(s.alis), satisFiyati: sayi(s.satis) || 0,
        }];
      });
      // Sunucu tek istekte en fazla 150 satır alır; grup satırları çoğalttığı için parçalara bölünür
      const sonuclar: { id: string; durum: string; mesaj?: string }[] = [];
      for (let i = 0; i < payload.length; i += 100) {
        const r = await api<{ sonuclar: { id: string; durum: string; mesaj?: string }[] }>("/api/urunler/toplu", { govde: { satirlar: payload.slice(i, i + 100) } });
        sonuclar.push(...r.sonuclar);
      }
      const bul = (id: string) => sonuclar.filter((y) => y.id === id || y.id.startsWith(`${id}#`));
      let basarili = 0, hatali = 0;
      for (const s of secili) {
        const xs = bul(s.id);
        const h = xs.filter((x) => x.durum === "hata").length;
        basarili += xs.length - h; hatali += h;
      }
      setSatirlar((l) => l.map((s) => {
        const xs = bul(s.id);
        if (!xs.length) return s;
        const hatalilar = xs.filter((x) => x.durum === "hata");
        if (s.grup === "tek") {
          const x = xs[0];
          return x.durum === "hata" ? { ...s, durum: "kayit_hata", mesaj: x.mesaj } : { ...s, durum: "kaydedildi", mesaj: x.mesaj ?? (x.durum === "stok_eklendi" ? "Stok eklendi" : "Yeni ürün oluşturuldu") };
        }
        const adetToplam = xs.reduce((t, x) => t + (x.durum === "hata" ? 0 : Number(s.bedenAdet[x.id.split("#")[1]]) || 0), 0);
        const notlar = [...new Set(xs.filter((x) => x.durum !== "hata" && x.mesaj).map((x) => x.mesaj as string))].join(" · ");
        if (!hatalilar.length) return { ...s, durum: "kaydedildi", mesaj: `${xs.length} beden, ${adetToplam} adet kaydedildi${notlar ? ` · ${notlar}` : ""}` };
        // Kısmi hata: kaydedilen bedenlerin kutuları boşaltılır ki yeniden denemede stok ikinci kez eklenmesin
        const kalan = { ...s.bedenAdet };
        for (const x of xs) if (x.durum !== "hata") kalan[x.id.split("#")[1]] = "";
        return { ...s, durum: "kayit_hata", bedenAdet: kalan, mesaj: `${xs.length - hatalilar.length} beden kaydedildi. Hata: ${hatalilar.map((x) => `${x.id.split("#")[1]}: ${x.mesaj}`).join("; ")}` };
      }));
      if (hatali) bildir(`${basarili} satır kaydedildi, ${hatali} satırda hata var`, "hata");
      else bildir(`${basarili} satır kaydedildi`);
    } catch (e) {
      bildir((e as Error).message, "hata");
    } finally {
      setKaydediyor(false);
    }
  }

  const sil = (id: string) => setSatirlar((l) => l.filter((s) => s.id !== id));
  const kaydedilenSayisi = satirlar.filter((s) => s.durum === "kaydedildi").length;

  return (
    <div className="space-y-5 pb-24">
      {/* Ekleme alanı */}
      <Kart
        className={cn("border-2 border-dashed p-5 text-center transition", surukle && "border-accent bg-accent-soft")}
        onDragOver={(e) => { e.preventDefault(); setSurukle(true); }} onDragLeave={() => setSurukle(false)}
        onDrop={(e) => { e.preventDefault(); setSurukle(false); ekle(Array.from(e.dataTransfer.files)); }}
      >
        <span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent"><Sparkles className="size-7" /></span>
        <h2 className="font-display text-xl font-semibold">Etiket fotoğraflarını ekleyin</h2>
        <p className="mx-auto mt-1 max-w-xl text-sm text-muted">Her ürünün etiketini (barkod, beden, renk görünsün) çekin ya da galeriden birden fazla seçin. Yapay zeka hepsini okuyup aşağıya doldurur; siz kontrol edip tek tuşla kaydedersiniz.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Buton onClick={() => setKamera(true)}><Camera className="size-4" /> Kamerayla art arda çek</Buton>
          <Buton varyant="ikincil" onClick={() => dosyaRef.current?.click()}><Images className="size-4" /> Galeriden seç (çoklu)</Buton>
        </div>
        <p className="mt-3 hidden text-xs text-muted lg:block"><UploadCloud className="mr-1 inline size-3.5" />Dosyaları bu alana sürükleyip bırakabilirsiniz.</p>
        <input ref={dosyaRef} type="file" accept="image/*" multiple hidden onChange={(e) => { ekle(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </Kart>
      <KameraCekici acik={kamera} kapat={() => setKamera(false)} onBitti={ekle} baslik="Etiketleri çek" />

      {/* Ortak değerler */}
      {satirlar.length > 0 && (
        <Kart className="p-4">
          <details open={satirlar.length <= 3}>
            <summary className="cursor-pointer select-none text-sm font-medium">Ortak değerler <span className="font-normal text-muted">(boş alanlara tek seferde uygulanır)</span></summary>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
              <label className="text-xs text-muted">Ürün türü<Girdi list="dl-kategoriler" value={vars.kategori} onChange={(e) => setVars({ ...vars, kategori: e.target.value })} placeholder="Pantolon" className="mt-1" /></label>
              <label className="text-xs text-muted">Tedarikçi<Girdi list="dl-tedarikciler" value={vars.tedarikci} onChange={(e) => setVars({ ...vars, tedarikci: e.target.value })} className="mt-1" /></label>
              <label className="text-xs text-muted">Alış fiyatı (₺)<Girdi inputMode="decimal" value={vars.alis} onChange={(e) => setVars({ ...vars, alis: e.target.value })} className="mt-1" /></label>
              <label className="text-xs text-muted">Satış fiyatı (₺)<Girdi inputMode="decimal" value={vars.satis} onChange={(e) => setVars({ ...vars, satis: e.target.value })} className="mt-1" /></label>
              <label className="text-xs text-muted">Adet<Girdi inputMode="numeric" value={vars.adet} onChange={(e) => setVars({ ...vars, adet: e.target.value })} className="mt-1" /></label>
            </div>
            <div className="mt-3 text-xs text-muted">Beden girişi (yeni fotoğraflara ve "Tümüne uygula"ya geçer)<GrupSecici deger={vars.grup} sec={(g) => setVars({ ...vars, grup: g })} /></div>
            <div className="mt-3 flex flex-wrap gap-2"><Buton kucuk varyant="ikincil" onClick={() => varsayilanlariUygula(false)}>Boş alanlara uygula</Buton><Buton kucuk varyant="ikincil" onClick={() => varsayilanlariUygula(true)}>Tümüne uygula</Buton></div>
          </details>
        </Kart>
      )}

      {/* Satırlar */}
      <div className="space-y-3">
        {satirlar.map((s) => {
          const eksik = eksikler(s);
          const kilitli = s.durum === "kaydedildi";
          return (
            <Kart key={s.id} className={cn("anim-yukari p-3 sm:p-4", kilitli && "border-ok/40 bg-ok-soft/40")}>
              <div className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.onizleme} alt="Ürün fotoğrafı" className="size-20 shrink-0 rounded-xl border border-border object-cover sm:size-28" />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {s.durum === "sirada" && <Rozet>Sırada</Rozet>}
                    {s.durum === "analiz" && <Rozet ton="bilgi"><Loader2 className="size-3 animate-spin" /> Analiz ediliyor</Rozet>}
                    {s.durum === "hazir" && <Rozet ton={s.guven !== null && s.guven < 0.6 ? "uyari" : "ok"}><Sparkles className="size-3" /> AI okudu{s.guven !== null ? ` · %${Math.round(s.guven * 100)}` : ""}</Rozet>}
                    {s.durum === "hata" && <Rozet ton="uyari"><AlertTriangle className="size-3" /> Elle tamamlayın</Rozet>}
                    {s.durum === "kaydedildi" && <Rozet ton="ok"><CheckCircle2 className="size-3" /> Kaydedildi</Rozet>}
                    {s.durum === "kayit_hata" && <Rozet ton="tehlike"><XCircle className="size-3" /> Kaydedilemedi</Rozet>}
                    {s.mevcut && <Rozet ton="bilgi">Kayıtlı ürün · mevcut stok {s.mevcut.stok}</Rozet>}
                    <button onClick={() => sil(s.id)} aria-label="Satırı sil" className="ml-auto grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                  </div>
                  {s.mesaj && <p className={cn("mb-2 text-xs", s.durum === "kayit_hata" || s.durum === "hata" ? "text-danger" : "text-ok")}>{s.mesaj}</p>}
                  {s.mevcut && <p className="mb-2 text-xs text-info">Bu barkod zaten kayıtlı: <b>{s.mevcut.urunAdi}</b> {s.mevcut.renk}/{s.mevcut.beden}. Kaydedince adet bu ürünün stoğuna eklenir. Satış fiyatını değiştirirseniz ürünün fiyatı güncellenir.</p>}
                  {s.uyarilar.map((u) => <p key={u} className="mb-2 flex items-start gap-1.5 text-xs text-warn"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{u}</p>)}
                  {(s.durum !== "sirada" && s.durum !== "analiz" && !kilitli) && (
                    <div className="mb-2"><GrupSecici deger={s.grup} sec={(g) => grupSec(s.id, g)} /></div>
                  )}
                  {(s.durum !== "sirada" && s.durum !== "analiz") && (
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
                      <Alan e="Marka" d={s.marka} liste="dl-markalar" kilit={kilitli || !!s.mevcut} f={(v) => guncelle(s.id, { marka: v })} />
                      <Alan e="Ürün adı" d={s.ad} kilit={kilitli} yildiz f={(v) => guncelle(s.id, { ad: v })} gen />
                      <Alan e="Tür" d={s.kategori} liste="dl-kategoriler" kilit={kilitli || !!s.mevcut} f={(v) => guncelle(s.id, { kategori: v })} />
                      <Alan e="Renk" d={s.mevcut ? s.mevcut.renk : s.renk} kilit={kilitli || !!s.mevcut} yildiz f={(v) => guncelle(s.id, { renk: v })} />
                      {s.grup === "tek" && <Alan e="Beden" d={s.mevcut ? s.mevcut.beden : s.beden} kilit={kilitli || !!s.mevcut} yildiz f={(v) => guncelle(s.id, { beden: v })} />}
                      {s.grup === "tek" && <Alan e="Adet" d={s.adet} kilit={kilitli} yildiz mod="numeric" f={(v) => guncelle(s.id, { adet: v })} />}
                      <Alan e="Alış ₺" d={s.alis} kilit={kilitli} yildiz mod="decimal" f={(v) => guncelle(s.id, { alis: v })} />
                      <Alan e="Satış ₺" d={s.satis} kilit={kilitli} yildiz={!s.mevcut} mod="decimal" f={(v) => guncelle(s.id, { satis: v })} />
                      <Alan e="Barkod" d={s.barkod} kilit={kilitli || !!s.mevcut} ipucu="Boşsa sistem üretir" mod="numeric" f={(v) => guncelle(s.id, { barkod: v })} />
                    </div>
                  )}
                  {s.grup !== "tek" && s.durum !== "kaydedildi" && s.durum !== "sirada" && s.durum !== "analiz" && (
                    <BedenKutulari grup={s.grup} adetler={s.bedenAdet} okunan={normalBeden(s.beden)} yaz={(b, v) => bedenAdetiYaz(s.id, b, v)} />
                  )}
                  {s.durum !== "kaydedildi" && s.durum !== "sirada" && s.durum !== "analiz" && eksik.length > 0 && <p className="mt-2 text-xs text-muted">Eksik: {eksik.join(", ")}</p>}
                  {(s.durum === "hata" || s.durum === "hazir") && s.gorsel && aiHazir && (
                    <button onClick={() => { kuyruk.current.push({ id: s.id, dosya: new File([s.gorsel!], "t.jpg", { type: "image/jpeg" }) }); pompa(); }} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent"><RefreshCw className="size-3" /> Yeniden analiz et</button>
                  )}
                </div>
              </div>
            </Kart>
          );
        })}
      </div>

      {satirlar.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-64">
          <div className="mx-auto flex max-w-[88rem] flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <b>{kaydedilebilir.length}</b> satır kayda hazır
              {bekleyen > 0 && <span className="text-muted"> · {bekleyen} analiz sürüyor</span>}
              {kaydedilenSayisi > 0 && <span className="text-ok"> · {kaydedilenSayisi} kaydedildi</span>}
              {(() => { const t = kaydedilebilir.reduce((a, s) => a + (sayi(s.alis) || 0) * (sayi(s.adet) || 0), 0); return t > 0 ? <span className="text-muted"> · alış toplamı {paraFormat(t)}</span> : null; })()}
            </p>
            <div className="flex gap-2">
              {kaydedilenSayisi > 0 && <Buton varyant="ikincil" onClick={() => setSatirlar((l) => l.filter((s) => s.durum !== "kaydedildi"))}>Kaydedilenleri temizle</Buton>}
              {kaydedilenSayisi > 0 && <Link href="/etiketler" className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">Etiketleri yazdır</Link>}
              <Buton onClick={hepsiniKaydet} yukleniyor={kaydediyor} disabled={kaydedilebilir.length === 0 || bekleyen > 0}>Hepsini kaydet ({kaydedilebilir.length})</Buton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function bedenKalemleri(s: Satir): { b: string; n: number }[] {
  if (s.grup === "tek") return [];
  return BEDEN_GRUPLARI[s.grup].bedenler.map((b) => ({ b, n: Math.round(Number(s.bedenAdet[b]) || 0) })).filter((x) => x.n > 0);
}

// Modül düzeyinde kalmalı (render içinde tanımlanırsa her tuşta yeniden kurulur ve klavye kapanır)
function GrupSecici({ deger, sec }: { deger: Grup; sec: (g: Grup) => void }) {
  const secenekler: { g: Grup; ad: string }[] = [{ g: "tek", ad: "Tek beden" }, { g: "ust", ad: BEDEN_GRUPLARI.ust.ad }, { g: "alt", ad: BEDEN_GRUPLARI.alt.ad }];
  return (
    <div role="group" aria-label="Beden girişi" className="mt-1 flex flex-wrap gap-1.5">
      {secenekler.map((o) => (
        <button key={o.g} type="button" aria-pressed={deger === o.g} onClick={() => sec(o.g)}
          className={cn("min-h-9 rounded-full border px-3 text-xs font-medium transition", deger === o.g ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:bg-surface-2")}>{o.ad}</button>
      ))}
    </div>
  );
}

function BedenKutulari({ grup, adetler, okunan, yaz }: { grup: BedenGrubu; adetler: Record<string, string>; okunan: string; yaz: (b: string, v: string) => void }) {
  const bedenler = BEDEN_GRUPLARI[grup].bedenler;
  const toplam = bedenler.reduce((t, b) => t + (Number(adetler[b]) || 0), 0);
  return (
    <div className="mt-2 rounded-xl border border-border bg-surface-2/50 p-2.5">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {bedenler.map((b) => (
          <label key={b} className={cn("block rounded-lg text-center text-[11px] font-semibold", b === okunan ? "text-accent" : "text-muted")}>
            {b}{b === okunan && <span className="font-normal"> · etikette</span>}
            <Girdi inputMode="numeric" aria-label={`${b} adet`} value={adetler[b] ?? ""} placeholder="0" onChange={(e) => yaz(b, e.target.value)} className="mt-0.5 min-h-10 px-1 py-1 text-center text-sm" />
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">Toplam <b className="text-foreground">{toplam}</b> adet · Adet yazılmayan bedenler açılmaz.</p>
    </div>
  );
}

function Alan({ e, d, f, kilit, liste, yildiz, mod, gen, ipucu }: { e: string; d: string; f: (v: string) => void; kilit?: boolean; liste?: string; yildiz?: boolean; mod?: "numeric" | "decimal"; gen?: boolean; ipucu?: string }) {
  return (
    <label className={cn("block text-[11px] font-medium text-muted", gen && "col-span-2")}>
      {e}{yildiz && <span className="text-danger"> *</span>}
      <Girdi list={liste} value={d} disabled={kilit} inputMode={mod} placeholder={ipucu} onChange={(ev) => f(ev.target.value)} className="mt-0.5 min-h-10 py-1 text-sm" />
    </label>
  );
}
