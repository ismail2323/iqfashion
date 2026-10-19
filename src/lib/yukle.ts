import { urunGorseliHazirla } from "./resim";

/** Görseli küçültüp sunucuya yükler, kalıcı adresi döner (/api/gorsel/..). */
export async function gorselYukle(blob: Blob): Promise<string> {
  const f = new FormData();
  f.append("dosya", new File([blob], "urun.jpg", { type: blob.type || "image/jpeg" }));
  const r = await fetch("/api/yukle", { method: "POST", body: f });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.hata ?? "Görsel yüklenemedi");
  return d.url as string;
}

export async function dosyadanUrunGorseli(d: Blob): Promise<{ blob: Blob; onizleme: string }> {
  const k = await urunGorseliHazirla(d);
  return { blob: k.blob, onizleme: k.dataUrl };
}