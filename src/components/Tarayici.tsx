"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, ScanBarcode, Zap, ZapOff } from "lucide-react";
import { Buton, Girdi, Modal, cn } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { barkodKabulEdilir, barkodTemizle } from "@/lib/barkod";
import { aiGorseliHazirla } from "@/lib/resim";
import { gorseldenBarkod, kameraBaslat, type TarayiciKontrol } from "@/lib/tarayici";
import { api } from "@/lib/istemci";

/** USB / Bluetooth el terminali: klavye gibi çok hızlı yazar ve Enter ile bitirir. Sayfa genelinde dinler. */
export function useBarkodDinleyici(onKod: (kod: string) => void, aktif = true) {
  const tampon = useRef("");
  const son = useRef(0);
  const cb = useRef(onKod);
  cb.current = onKod;
  useEffect(() => {
    if (!aktif) return;
    const h = (e: KeyboardEvent) => {
      const hedef = e.target as HTMLElement | null;
      const yaziyor = hedef && (hedef.tagName === "INPUT" || hedef.tagName === "TEXTAREA" || hedef.tagName === "SELECT") && !hedef.dataset.barkod;
      if (yaziyor || e.ctrlKey || e.metaKey || e.altKey) return;
      const simdi = performance.now();
      if (e.key === "Enter") {
        const k = barkodTemizle(tampon.current);
        tampon.current = "";
        if (k.length >= 6 && barkodKabulEdilir(k)) {
          e.preventDefault();
          cb.current(k);
        }
        return;
      }
      if (e.key.length !== 1) return;
      if (simdi - son.current > 80) tampon.current = ""; // insan hızında yazı: tamponu at
      tampon.current += e.key;
      son.current = simdi;
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [aktif]);
}

export function KameraTarayici({ acik, kapat, onKod, surekli = false, baslik = "Barkod tara" }: { acik: boolean; kapat: () => void; onKod: (kod: string) => void; surekli?: boolean; baslik?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const kontrol = useRef<TarayiciKontrol | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [fener, setFener] = useState(false);
  const [fenerVar, setFenerVar] = useState(false);
  const [son, setSon] = useState<string | null>(null);
  const cb = useRef(onKod);
  cb.current = onKod;

  useEffect(() => {
    if (!acik) return;
    let iptal = false;
    setHata(null);
    setSon(null);
    setFener(false);
    const t = setTimeout(async () => {
      if (!videoRef.current) return;
      try {
        const k = await kameraBaslat(videoRef.current, (kod) => {
          if (typeof navigator.vibrate === "function") navigator.vibrate(60);
          setSon(kod);
          cb.current(kod);
          if (!surekli) kapat();
        });
        if (iptal) k.durdur();
        else {
          kontrol.current = k;
          setFenerVar(k.fenerVar);
        }
      } catch (e) {
        const m = (e as Error).name === "NotAllowedError" ? "Kamera izni verilmedi. Tarayıcı ayarlarından bu site için kamerayı açın." : (e as Error).name === "NotFoundError" ? "Kamera bulunamadı." : (e as Error).message;
        setHata(m);
      }
    }, 50);
    return () => {
      iptal = true;
      clearTimeout(t);
      kontrol.current?.durdur();
      kontrol.current = null;
    };
  }, [acik, surekli, kapat]);

  return (
    <Modal acik={acik} kapat={kapat} baslik={baslik}>
      <div className="space-y-3">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} muted playsInline className="size-full object-cover" />
          <div aria-hidden className="pointer-events-none absolute inset-x-[10%] top-1/2 h-[38%] -translate-y-1/2 rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-[12%] top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-red-500/80" />
          {fenerVar && (
            <button onClick={async () => { const y = !fener; try { await kontrol.current?.fener?.(y); setFener(y); } catch {} }} aria-label="Fener" className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/50 text-white">
              {fener ? <Zap className="size-5" /> : <ZapOff className="size-5" />}
            </button>
          )}
        </div>
        {hata ? <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{hata}</p> : <p className="text-center text-sm text-muted">Barkodu çerçevenin içine getirin. Otomatik okunur.</p>}
        {surekli && son && <p className="text-center text-sm">Son okunan: <b className="tabular">{son}</b></p>}
      </div>
    </Modal>
  );
}

/** Tek satırlık barkod girişi: yaz/okut + kamera + fotoğraftan oku. Yerel çözücü başarısızsa (izin verilirse) AI'ya düşer. */
export function BarkodGirisi({ onKod, aiYedek = false, otomatikOdak = false, className, placeholder = "Barkodu okutun veya yazın…" }: { onKod: (kod: string) => void; aiYedek?: boolean; otomatikOdak?: boolean; className?: string; placeholder?: string }) {
  const bildir = useToast();
  const [deger, setDeger] = useState("");
  const [kamera, setKamera] = useState(false);
  const [okuyor, setOkuyor] = useState(false);
  const dosya = useRef<HTMLInputElement>(null);
  const kapat = useCallback(() => setKamera(false), []);

  function gonder(kod: string) {
    const k = barkodTemizle(kod);
    if (!k) return;
    if (!barkodKabulEdilir(k)) return bildir("Geçersiz barkod (sağlama toplamı tutmuyor). Tekrar deneyin.", "hata");
    setDeger("");
    onKod(k);
  }

  async function fotoSecildi(f: File | undefined) {
    if (!f) return;
    setOkuyor(true);
    try {
      const yerel = await gorseldenBarkod(f).catch(() => null);
      if (yerel) return gonder(yerel);
      if (!aiYedek) return bildir("Barkod okunamadı. Daha net/yakın çekin ya da rakamları yazın.", "hata");
      const kucuk = await aiGorseliHazirla(f);
      const r = await api<{ sonuc: { barkod: string | null; gecerli: boolean } }>("/api/ai/barkod", { govde: { gorsel: kucuk.dataUrl } });
      if (r.sonuc.barkod && r.sonuc.gecerli) gonder(r.sonuc.barkod);
      else if (r.sonuc.barkod) { setDeger(r.sonuc.barkod); bildir("Okunan rakamlar doğrulanamadı; kontrol edip düzeltin.", "bilgi"); }
      else bildir("Barkod okunamadı. Rakamları elle yazın.", "hata");
    } catch (e) {
      bildir((e as Error).message, "hata");
    } finally {
      setOkuyor(false);
      if (dosya.current) dosya.current.value = "";
    }
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <div className="relative flex-1">
        <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
        <Girdi data-barkod="1" value={deger} onChange={(e) => setDeger(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); gonder(deger); } }}
          inputMode="numeric" autoFocus={otomatikOdak} placeholder={placeholder} aria-label="Barkod" className="pl-10" autoComplete="off" />
      </div>
      <Buton type="button" varyant="ikincil" onClick={() => setKamera(true)} aria-label="Kamerayla tara" className="px-3"><Camera className="size-5" /></Buton>
      <Buton type="button" varyant="ikincil" yukleniyor={okuyor} onClick={() => dosya.current?.click()} aria-label="Fotoğraftan oku" className="px-3"><ImagePlus className="size-5" /></Buton>
      <input ref={dosya} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void fotoSecildi(e.target.files?.[0])} />
      <KameraTarayici acik={kamera} kapat={kapat} onKod={gonder} />
    </div>
  );
}
