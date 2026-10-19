"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Zap, ZapOff } from "lucide-react";
import { Buton, Modal } from "@/components/ui";

/**
 * Uygulama içi canlı kamera: deklanşöre art arda basarak çok sayıda fotoğraf çekilir (telefon/tablet).
 * (Tarayıcı `capture` özelliği çoklu çekimi desteklemediği için kendi kameramızı açıyoruz.)
 */
export function KameraCekici({ acik, kapat, onBitti, baslik = "Fotoğraf çek" }: { acik: boolean; kapat: () => void; onBitti: (dosyalar: File[]) => void; baslik?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const akimRef = useRef<MediaStream | null>(null);
  const [cekilen, setCekilen] = useState<{ dosya: File; url: string }[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [flas, setFlas] = useState(false);
  const [fener, setFener] = useState(false);
  const [fenerVar, setFenerVar] = useState(false);

  useEffect(() => {
    if (!acik) return;
    let iptal = false;
    setHata(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Bu tarayıcıda kamera kullanılamıyor (HTTPS gerekir). Galeriden seçmeyi deneyin.");
        const akim = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (iptal) return akim.getTracks().forEach((t) => t.stop());
        akimRef.current = akim;
        const yet = (akim.getVideoTracks()[0]?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setFenerVar(!!yet.torch);
        if (videoRef.current) {
          videoRef.current.srcObject = akim;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setHata((e as Error).name === "NotAllowedError" ? "Kamera izni verilmedi. Tarayıcı ayarlarından bu site için kamerayı açın." : (e as Error).message);
      }
    })();
    return () => {
      iptal = true;
      akimRef.current?.getTracks().forEach((t) => t.stop());
      akimRef.current = null;
    };
  }, [acik]);

  useEffect(() => () => cekilen.forEach((c) => URL.revokeObjectURL(c.url)), [cekilen]);

  async function cek() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return;
    const dosya = new File([blob], `cekim-${Date.now()}.jpg`, { type: "image/jpeg" });
    setCekilen((l) => [...l, { dosya, url: URL.createObjectURL(blob) }]);
    setFlas(true);
    setTimeout(() => setFlas(false), 120);
    if (typeof navigator.vibrate === "function") navigator.vibrate(30);
  }

  function bitir() {
    const d = cekilen.map((c) => c.dosya);
    setCekilen([]);
    kapat();
    if (d.length) onBitti(d);
  }

  return (
    <Modal acik={acik} kapat={() => { setCekilen([]); kapat(); }} baslik={baslik}>
      <div className="space-y-3">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} muted playsInline className="size-full object-cover" />
          {flas && <div className="absolute inset-0 bg-white/80" />}
          {fenerVar && (
            <button onClick={async () => { const y = !fener; try { await akimRef.current?.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: y } as MediaTrackConstraintSet] }); setFener(y); } catch {} }} aria-label="Fener" className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/50 text-white">
              {fener ? <Zap className="size-5" /> : <ZapOff className="size-5" />}
            </button>
          )}
        </div>
        {hata && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{hata}</p>}
        {cekilen.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Çekilen fotoğraflar">
            {cekilen.map((c, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={c.url} src={c.url} alt={`Çekim ${i + 1}`} className="size-14 shrink-0 rounded-lg border border-border object-cover" />
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{cekilen.length ? `${cekilen.length} fotoğraf çekildi` : "Etiketi net görünecek şekilde çekin"}</p>
          <div className="flex items-center gap-2">
            <button onClick={cek} disabled={!!hata} aria-label="Fotoğraf çek" className="grid size-16 place-items-center rounded-full border-4 border-border bg-foreground text-background transition active:scale-90 disabled:opacity-40"><Camera className="size-7" /></button>
            <Buton onClick={bitir} disabled={!cekilen.length}><Check className="size-4" /> Bitti</Buton>
          </div>
        </div>
      </div>
    </Modal>
  );
}