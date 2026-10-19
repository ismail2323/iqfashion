// Tarayıcıda görsel küçültme: yüklemeyi hızlandırır, mobil veri harcamaz, sunucu limitlerine takılmaz.
export type KucukResim = { blob: Blob; dataUrl: string; genislik: number; yukseklik: number };

async function bitmapAl(dosya: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(dosya, { imageOrientation: "from-image" });
    } catch {
      /* HEIC vb. -> img ile dene */
    }
  }
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(dosya);
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Görsel açılamadı. JPEG veya PNG deneyin.")); };
    img.src = url;
  });
}

export async function resmiKucult(dosya: Blob, maxKenar = 1600, kalite = 0.82, tur: "image/jpeg" | "image/webp" = "image/jpeg"): Promise<KucukResim> {
  const bmp = await bitmapAl(dosya);
  const w0 = "naturalWidth" in bmp ? bmp.naturalWidth : bmp.width;
  const h0 = "naturalHeight" in bmp ? bmp.naturalHeight : bmp.height;
  const oran = Math.min(1, maxKenar / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * oran));
  const h = Math.max(1, Math.round(h0 * oran));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Görsel işlenemedi");
  ctx.fillStyle = "#fff"; // saydam PNG -> beyaz zemin
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  if ("close" in bmp) bmp.close();
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Görsel sıkıştırılamadı"))), tur, kalite));
  const dataUrl: string = await new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.readAsDataURL(blob);
  });
  return { blob, dataUrl, genislik: w, yukseklik: h };
}

/** Ürün görseli: 900px, JPEG %80 (genelde 60-150 KB) */
export const urunGorseliHazirla = (d: Blob) => resmiKucult(d, 900, 0.8);
/** AI/barkod için: ince çubuklar bozulmasın diye daha yüksek çözünürlük */
export const aiGorseliHazirla = (d: Blob) => resmiKucult(d, 1800, 0.85);
