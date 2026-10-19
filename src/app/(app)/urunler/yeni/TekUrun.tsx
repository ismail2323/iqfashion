"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, ImagePlus, Plus, Printer, Sparkles, X } from "lucide-react";
import { Alan, Buton, Girdi, Kart, Rozet, Secim, cn } from "@/components/ui";
import { BarkodGirisi } from "@/components/Tarayici";
import { useToast } from "@/components/Toast";
import type { KatalogVeri } from "@/components/Katalog";
import { api } from "@/lib/istemci";
import { aiGorseliHazirla } from "@/lib/resim";
import { gorselYukle, dosyadanUrunGorseli } from "@/lib/yukle";
import { BEDEN_SETLERI, HIZLI_RENKLER, bedenSirasi, normalBeden, normalRenk, renkHex } from "@/lib/giyim";

type Etiket = { marka: string | null; urunAdi: string | null; kategori: string | null; renk: string | null; beden: string | null; barkod: string | null; fiyat: number | null; cinsiyet: string | null; sezon: string | null; uyarilar: string[] };
const sayi = (s: string) => Number(s.replace(",", "."));
const anahtar = (r: string, b: string) => `${r}|${b}`;

export function TekUrun({ aiHazir, katalog }: { aiHazir: boolean; katalog: KatalogVeri }) {
  const bildir = useToast();
  const [kategori, setKategori] = useState("");
  const [marka, setMarka] = useState("");
  const [ad, setAd] = useState("");
  const [cinsiyet, setCinsiyet] = useState("");
  const [sezon, setSezon] = useState("");
  const [tedarikci, setTedarikci] = useState("");
  const [renkler, setRenkler] = useState<string[]>([]);
  const [bedenler, setBedenler] = useState<string[]>([]);
  const [adetler, setAdetler] = useState<Record<string, string>>({});
  const [barkodlar, setBarkodlar] = useState<Record<string, string>>({});
  const [bekleyenBarkod, setBekleyenBarkod] = useState<string | null>(null);
  const [alis, setAlis] = useState("");
  const [satis, setSatis] = useState("");
  const [minStok, setMinStok] = useState("1");
  const [gorsel, setGorsel] = useState<{ blob: Blob; onizleme: string } | null>(null);
  const [ozelRenk, setOzelRenk] = useState("");
  const [ozelBeden, setOzelBeden] = useState("");
  const [mevcutBarkod, setMevcutBarkod] = useState<{ urunAdi: string; renk: string; beden: string; stok: number } | null>(null);
  const [uyarilar, setUyarilar] = useState<string[]>([]);
  const [aiYukleniyor, setAiYukleniyor] = useState(false);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<{ urunId: string; varyantlar: { id: string; renk: string; beden: string; barkod: string }[] } | null>(null);
  const aiDosya = useRef<HTMLInputElement>(null);
  const gorselDosya = useRef<HTMLInputElement>(null);
  const gorselKamera = useRef<HTMLInputElement>(null);

  const hucreler = useMemo(() => renkler.flatMap((r) => bedenler.map((b) => ({ r, b, k: anahtar(r, b) }))), [renkler, bedenler]);
  const toplamAdet = hucreler.reduce((t, h) => t + (Number(adetler[h.k]) || 0), 0);

  // Okunan barkodu ilk boş hücreye ata (hücre yoksa bekletir)
  useEffect(() => {
    if (!bekleyenBarkod || !hucreler.length) return;
    const bos = hucreler.find((h) => !barkodlar[h.k]);
    if (bos) {
      setBarkodlar((m) => ({ ...m, [bos.k]: bekleyenBarkod }));
      setBekleyenBarkod(null);
    }
  }, [bekleyenBarkod, hucreler, barkodlar]);

  const renkToggle = (r: string) => setRenkler((l) => (l.includes(r) ? l.filter((x) => x !== r) : [...l, r]));
  const bedenToggle = (b: string) => setBedenler((l) => (l.includes(b) ? l.filter((x) => x !== b) : [...l, b].sort((a, c) => bedenSirasi(a) - bedenSirasi(c))));
  const setAdet = (k: string, v: string) => setAdetler((m) => ({ ...m, [k]: v.replace(/\D/g, "") }));

  async function barkodGeldi(kod: string) {
    setMevcutBarkod(null);
    try {
      const r = await api<{ bulundu: boolean; varyant?: { urunAdi: string; renk: string; beden: string; stok: number } }>(`/api/barkod/${encodeURIComponent(kod)}`);
      if (r.bulundu && r.varyant) {
        setMevcutBarkod(r.varyant);
        return bildir("Bu barkod zaten kayıtlı", "bilgi");
      }
    } catch { /* sorgu başarısızsa yine de devam */ }
    setBekleyenBarkod(kod);
    bildir(`Barkod alındı: ${kod}`);
  }

  async function etiketten(f: File | undefined) {
    if (!f) return;
    setAiYukleniyor(true);
    setUyarilar([]);
    try {
      const k = await aiGorseliHazirla(f);
      const { sonuc: s } = await api<{ sonuc: Etiket }>("/api/ai/etiket", { govde: { gorsel: k.dataUrl } });
      if (s.marka) setMarka(s.marka);
      if (s.urunAdi) setAd(s.urunAdi);
      if (s.kategori) setKategori(s.kategori);
      if (s.fiyat) setSatis(String(s.fiyat));
      if (s.cinsiyet) setCinsiyet(s.cinsiyet);
      if (s.sezon) setSezon(s.sezon);
      if (s.renk) setRenkler((l) => (l.includes(s.renk!) ? l : [...l, s.renk!]));
      if (s.beden) setBedenler((l) => (l.includes(s.beden!) ? l : [...l, s.beden!].sort((a, c) => bedenSirasi(a) - bedenSirasi(c))));
      if (s.barkod) await barkodGeldi(s.barkod);
      setUyarilar(s.uyarilar);
      if (!gorsel) dosyadanUrunGorseli(f).then(setGorsel).catch(() => {});
      bildir("Etiket okundu, alanları kontrol edin");
    } catch (e) {
      bildir((e as Error).message, "hata");
    } finally {
      setAiYukleniyor(false);
      if (aiDosya.current) aiDosya.current.value = "";
    }
  }

  const eksik: string[] = [];
  if (ad.trim().length < 2) eksik.push("ürün adı");
  if (!renkler.length) eksik.push("en az bir renk");
  if (!bedenler.length) eksik.push("en az bir beden");
  if (!(sayi(satis) > 0)) eksik.push("satış fiyatı");
  if (alis.trim() === "" || !(sayi(alis) >= 0)) eksik.push("alış fiyatı");

  async function kaydet() {
    setHata(null);
    setKaydediyor(true);
    try {
      let gorselUrl: string | null = null;
      if (gorsel) gorselUrl = await gorselYukle(gorsel.blob).catch(() => null);
      const r = await api<{ urunId: string; varyantlar: { id: string; renk: string; beden: string; barkod: string }[] }>("/api/urunler", {
        govde: {
          ad, markaAd: marka || null, kategoriAd: kategori || null, cinsiyet: cinsiyet || null, sezon: sezon || null, tedarikciAd: tedarikci || null, gorselUrl,
          varyantlar: hucreler.map((h) => ({ renk: h.r, beden: h.b, barkod: barkodlar[h.k] || null, alisFiyati: sayi(alis), satisFiyati: sayi(satis), adet: Number(adetler[h.k]) || 0, minStok: Number(minStok) || 0 })),
        },
      });
      setSonuc(r);
      bildir("Ürün kaydedildi");
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setKaydediyor(false);
    }
  }

  function yeniden() {
    setKategori(""); setMarka(""); setAd(""); setCinsiyet(""); setSezon(""); setRenkler([]); setBedenler([]); setAdetler({}); setBarkodlar({}); setAlis(""); setSatis("");
    setGorsel(null); setMevcutBarkod(null); setUyarilar([]); setSonuc(null); setHata(null); setBekleyenBarkod(null);
  }

  if (sonuc) {
    return (
      <Kart className="space-y-4 p-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-ok-soft text-ok"><CheckCircle2 className="size-8" /></span>
        <h2 className="font-display text-2xl font-semibold">Ürün kaydedildi</h2>
        <p className="text-sm text-muted">{ad} · {sonuc.varyantlar.length} varyant oluşturuldu, {toplamAdet} adet stoğa girildi.</p>
        <div className="mx-auto max-w-lg overflow-hidden rounded-xl border border-border text-left text-sm">
          {sonuc.varyantlar.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 last:border-0"><span>{v.renk} · {v.beden}</span><code className="tabular text-xs text-muted">{v.barkod}</code></div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/etiketler?urun=${sonuc.urunId}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-background"><Printer className="size-4" /> Etiketleri yazdır</Link>
          <Link href={`/urunler/${sonuc.urunId}`} className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">Ürünü gör</Link>
          <Buton varyant="ikincil" onClick={yeniden}><Plus className="size-4" /> Yeni ürün ekle</Buton>
        </div>
      </Kart>
    );
  }

  const Bolum = ({ no, baslik, children }: { no: number; baslik: string; children: React.ReactNode }) => (
    <Kart className="p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-3 font-display text-lg font-semibold"><span className="grid size-7 place-items-center rounded-full bg-foreground text-sm text-background">{no}</span>{baslik}</h2>
      {children}
    </Kart>
  );

  return (
    <div className="space-y-4 pb-28">
      <Bolum no={1} baslik="Ürün türü">
        <div className="flex flex-wrap gap-2">
          {(katalog.kategoriler.length ? katalog.kategoriler : ["Pantolon", "Tişört", "Gömlek", "Ceket"]).map((k) => (
            <button key={k} onClick={() => setKategori(k)} aria-pressed={kategori === k} className={cn("min-h-10 rounded-full border px-4 text-sm transition", kategori === k ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:bg-surface-2")}>{k}</button>
          ))}
        </div>
      </Bolum>

      <Bolum no={2} baslik="Etiket / barkod (isteğe bağlı)">
        <div className="space-y-3">
          <BarkodGirisi onKod={barkodGeldi} aiYedek={aiHazir} />
          {aiHazir && (
            <div>
              <Buton varyant="ikincil" yukleniyor={aiYukleniyor} onClick={() => aiDosya.current?.click()}><Sparkles className="size-4 text-accent" /> Etiket fotoğrafından otomatik doldur</Buton>
              <input ref={aiDosya} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void etiketten(e.target.files?.[0])} />
              <p className="mt-1.5 text-xs text-muted">Marka, ürün adı, renk, beden, fiyat ve barkod okunup aşağıya yazılır. Siz kontrol edip düzeltirsiniz.</p>
            </div>
          )}
          {bekleyenBarkod && <p className="text-sm">Okunan barkod: <b className="tabular">{bekleyenBarkod}</b> <span className="text-muted">(renk ve beden seçince ilk varyanta atanır)</span></p>}
          {mevcutBarkod && (
            <div className="rounded-xl bg-info-soft px-4 py-3 text-sm text-info">
              Bu barkod zaten kayıtlı: <b>{mevcutBarkod.urunAdi}</b> {mevcutBarkod.renk}/{mevcutBarkod.beden} (stok {mevcutBarkod.stok}). Yeni ürün açmak yerine <Link href="/alis" className="font-medium underline">Mal Kabul</Link> ile stok ekleyin.
            </div>
          )}
          {uyarilar.map((u) => <p key={u} className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">{u}</p>)}
        </div>
      </Bolum>

      <Bolum no={3} baslik="Ürün bilgisi">
        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Ürün adı *"><Girdi value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Slim Fit Kot Pantolon" /></Alan>
          <Alan etiket="Marka"><Girdi list="dl-markalar" value={marka} onChange={(e) => setMarka(e.target.value)} placeholder="Hugo" /></Alan>
          <Alan etiket="Cinsiyet"><Secim value={cinsiyet} onChange={(e) => setCinsiyet(e.target.value)}><option value="">Seçin</option><option value="ERKEK">Erkek</option><option value="KADIN">Kadın</option><option value="COCUK">Çocuk</option><option value="UNISEX">Unisex</option></Secim></Alan>
          <Alan etiket="Sezon"><Secim value={sezon} onChange={(e) => setSezon(e.target.value)}><option value="">Seçin</option><option value="YAZLIK">Yazlık</option><option value="KISLIK">Kışlık</option><option value="IKI_SEZON">İki sezon</option></Secim></Alan>
          <Alan etiket="Ürün türü (diğer)"><Girdi list="dl-kategoriler" value={kategori} onChange={(e) => setKategori(e.target.value)} placeholder="Listede yoksa yazın" /></Alan>
          <Alan etiket="Tedarikçi"><Girdi list="dl-tedarikciler" value={tedarikci} onChange={(e) => setTedarikci(e.target.value)} /></Alan>
        </div>
      </Bolum>

      <Bolum no={4} baslik="Renk ve beden, kaç adet?">
        <p className="mb-2 text-sm font-medium">Renkler</p>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...HIZLI_RENKLER, ...renkler])].map((r) => (
            <button key={r} onClick={() => renkToggle(r)} aria-pressed={renkler.includes(r)} className={cn("inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm transition", renkler.includes(r) ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:bg-surface-2")}>
              <span className="size-4 rounded-full border border-black/20" style={{ background: renkHex(r) }} />{r}
            </button>
          ))}
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); const r = normalRenk(ozelRenk); if (r) { setRenkler((l) => (l.includes(r) ? l : [...l, r])); setOzelRenk(""); } }}>
            <Girdi value={ozelRenk} onChange={(e) => setOzelRenk(e.target.value)} placeholder="Başka renk" className="min-h-10 w-32 py-1" />
            <Buton type="submit" varyant="ikincil" kucuk aria-label="Rengi ekle"><Plus className="size-4" /></Buton>
          </form>
        </div>

        <p className="mb-2 mt-5 text-sm font-medium">Bedenler</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {Object.entries(BEDEN_SETLERI).map(([ad2, set]) => (
            <Buton key={ad2} kucuk varyant="ikincil" onClick={() => setBedenler([...set])}>{ad2}</Buton>
          ))}
          <Buton kucuk varyant="hayalet" onClick={() => setBedenler([])}>Temizle</Buton>
        </div>
        <div className="flex flex-wrap gap-2">
          {bedenler.map((b) => (
            <button key={b} onClick={() => bedenToggle(b)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-foreground bg-foreground px-3 text-sm text-background">{b}<X className="size-3.5" /></button>
          ))}
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); const b = normalBeden(ozelBeden); if (b && !bedenler.includes(b)) bedenToggle(b); setOzelBeden(""); }}>
            <Girdi value={ozelBeden} onChange={(e) => setOzelBeden(e.target.value)} placeholder="Beden ekle" className="min-h-9 w-28 py-1" />
            <Buton type="submit" varyant="ikincil" kucuk aria-label="Bedeni ekle"><Plus className="size-4" /></Buton>
          </form>
        </div>

        {hucreler.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr><th className="px-3 py-2 text-left font-medium">Renk \ Beden</th>{bedenler.map((b) => <th key={b} className="px-2 py-2 font-medium">{b}</th>)}</tr>
              </thead>
              <tbody>
                {renkler.map((r) => (
                  <tr key={r} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2"><span className="mr-2 inline-block size-3 rounded-full border border-black/20 align-middle" style={{ background: renkHex(r) }} />{r}</td>
                    {bedenler.map((b) => (
                      <td key={b} className="px-1.5 py-1.5"><Girdi inputMode="numeric" aria-label={`${r} ${b} adet`} value={adetler[anahtar(r, b)] ?? ""} placeholder="0" onChange={(e) => setAdet(anahtar(r, b), e.target.value)} className="min-h-10 w-16 px-2 py-1 text-center" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hucreler.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted">Varyant barkodları <span className="text-xs">(boş bırakılırsa sistem üretir)</span></summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {hucreler.map((h) => (
                <label key={h.k} className="flex items-center gap-2 text-xs text-muted"><span className="w-28 shrink-0 truncate">{h.r} {h.b}</span><Girdi inputMode="numeric" value={barkodlar[h.k] ?? ""} onChange={(e) => setBarkodlar((m) => ({ ...m, [h.k]: e.target.value.replace(/\s/g, "") }))} className="min-h-9 py-1 text-sm" placeholder="otomatik" /></label>
              ))}
            </div>
          </details>
        )}
      </Bolum>

      <Bolum no={5} baslik="Fiyat ve görsel">
        <div className="grid gap-4 sm:grid-cols-3">
          <Alan etiket="Alış fiyatı (₺) *"><Girdi inputMode="decimal" value={alis} onChange={(e) => setAlis(e.target.value)} /></Alan>
          <Alan etiket="Satış fiyatı (₺) *"><Girdi inputMode="decimal" value={satis} onChange={(e) => setSatis(e.target.value)} /></Alan>
          <Alan etiket="Minimum stok uyarısı" ipucu="Bu adede düşünce uyarı çıkar"><Girdi inputMode="numeric" value={minStok} onChange={(e) => setMinStok(e.target.value.replace(/\D/g, ""))} /></Alan>
        </div>
        {sayi(alis) > 0 && sayi(satis) > 0 && <p className="mt-2 text-sm text-muted">Kâr marjı: <b className={sayi(satis) > sayi(alis) ? "text-ok" : "text-danger"}>%{Math.round(((sayi(satis) - sayi(alis)) / sayi(satis)) * 100)}</b>{sayi(satis) <= sayi(alis) && " — satış fiyatı alıştan düşük!"}</p>}
        <div className="mt-4 flex items-center gap-4">
          {gorsel ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gorsel.onizleme} alt="Ürün görseli" className="size-24 rounded-xl border border-border object-cover" />
              <button onClick={() => setGorsel(null)} aria-label="Görseli kaldır" className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-danger text-white"><X className="size-3.5" /></button>
            </div>
          ) : <div className="grid size-24 place-items-center rounded-xl border border-dashed border-border text-muted"><ImagePlus className="size-6" /></div>}
          <div className="flex flex-wrap gap-2">
            <Buton varyant="ikincil" kucuk onClick={() => gorselKamera.current?.click()}><Camera className="size-4" /> Fotoğraf çek</Buton>
            <Buton varyant="ikincil" kucuk onClick={() => gorselDosya.current?.click()}><ImagePlus className="size-4" /> Galeriden seç</Buton>
          </div>
          <input ref={gorselKamera} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setGorsel(await dosyadanUrunGorseli(f).catch(() => null)); e.target.value = ""; }} />
          <input ref={gorselDosya} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setGorsel(await dosyadanUrunGorseli(f).catch(() => null)); e.target.value = ""; }} />
        </div>
      </Bolum>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-[88rem] flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {hucreler.length} varyant · <b>{toplamAdet}</b> adet
            {eksik.length > 0 && <span className="text-muted"> · eksik: {eksik.join(", ")}</span>}
            {hata && <Rozet ton="tehlike">{hata}</Rozet>}
          </p>
          <Buton onClick={kaydet} yukleniyor={kaydediyor} disabled={eksik.length > 0}>Ürünü kaydet</Buton>
        </div>
      </div>
    </div>
  );
}
