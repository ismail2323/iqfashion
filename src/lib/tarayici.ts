// Barkod çözme (tarayıcı): önce yerel BarcodeDetector, yoksa ZXing. Görselden okuma başarısızsa çağıran AI'a düşer.
import { barkodKabulEdilir, barkodTemizle } from "./barkod";

const FORMATLAR = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] as const;

type BarcodeDetectorLike = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };
type BDCtor = { new (o?: { formats: readonly string[] }): BarcodeDetectorLike; getSupportedFormats?: () => Promise<string[]> };

export async function yerelDedektor(): Promise<BarcodeDetectorLike | null> {
  const C = (globalThis as unknown as { BarcodeDetector?: BDCtor }).BarcodeDetector;
  if (!C) return null;
  try {
    const destek = (await C.getSupportedFormats?.()) ?? [...FORMATLAR];
    const f = FORMATLAR.filter((x) => destek.includes(x));
    return f.length ? new C({ formats: f }) : null;
  } catch {
    return null;
  }
}

function gecerli(ham: string | undefined | null): string | null {
  if (!ham) return null;
  const k = barkodTemizle(ham);
  return barkodKabulEdilir(k) ? k : null;
}

/** Fotoğraf/dosyadan barkod okur. Bulamazsa null (çağıran AI'ya geçebilir). */
export async function gorseldenBarkod(dosya: Blob): Promise<string | null> {
  const bmp = await createImageBitmap(dosya).catch(() => null);
  const url = URL.createObjectURL(dosya);
  try {
    const d = await yerelDedektor();
    if (d && bmp) {
      const sonuc = await d.detect(bmp).catch(() => []);
      for (const s of sonuc) {
        const k = gecerli(s.rawValue);
        if (k) return k;
      }
    }
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
    const ipuclari = new Map();
    ipuclari.set(DecodeHintType.TRY_HARDER, true);
    ipuclari.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.QR_CODE]);
    const okuyucu = new BrowserMultiFormatReader(ipuclari);
    const r = await okuyucu.decodeFromImageUrl(url).catch(() => null);
    return gecerli(r?.getText());
  } finally {
    bmp?.close();
    URL.revokeObjectURL(url);
  }
}

export type TarayiciKontrol = { durdur: () => void; fener?: (ac: boolean) => Promise<void>; fenerVar: boolean };

/** Canlı kamera taraması. Her okunan geçerli kod için `kodBulundu` çağrılır (aynı kod 1,5 sn içinde tekrarlanmaz). */
export async function kameraBaslat(video: HTMLVideoElement, kodBulundu: (kod: string) => void): Promise<TarayiciKontrol> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Bu tarayıcı kamera erişimini desteklemiyor (HTTPS gerekir).");
  const akim = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = akim;
  video.setAttribute("playsinline", "true");
  await video.play().catch(() => {});

  let durdu = false;
  let sonKod = "";
  let sonZaman = 0;
  const bildir = (ham: string | undefined) => {
    const k = gecerli(ham);
    if (!k) return;
    const simdi = Date.now();
    if (k === sonKod && simdi - sonZaman < 1500) return;
    sonKod = k;
    sonZaman = simdi;
    kodBulundu(k);
  };

  const yol = track(akim);
  const dedektor = await yerelDedektor();
  let zxingKontrol: { stop(): void } | null = null;

  if (dedektor) {
    const dongu = async () => {
      if (durdu) return;
      if (video.readyState >= 2) {
        const r = await dedektor.detect(video).catch(() => []);
        for (const s of r) bildir(s.rawValue);
      }
      setTimeout(dongu, 120);
    };
    void dongu();
  } else {
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const okuyucu = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 120 });
    zxingKontrol = await okuyucu.decodeFromVideoElement(video, (sonuc) => sonuc && bildir(sonuc.getText()));
  }

  return {
    fenerVar: yol.fenerVar,
    fener: yol.fener,
    durdur: () => {
      durdu = true;
      zxingKontrol?.stop();
      akim.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}

function track(akim: MediaStream) {
  const t = akim.getVideoTracks()[0];
  const yetenek = (t?.getCapabilities?.() ?? {}) as { torch?: boolean };
  return {
    fenerVar: !!yetenek.torch,
    fener: async (ac: boolean) => {
      await t.applyConstraints({ advanced: [{ torch: ac } as MediaTrackConstraintSet] });
    },
  };
}
