// Etiket fotoğrafından barkodu EN GÜVENİLİR yoldan çıkarır (tarayıcı tarafı). Sıra:
//  1) Yerel çözücü (çizgileri okur, sağlama toplamı kesin): önce orijinal, olmazsa küçültülmüş görsel
//  2) AI'nın ilk okuması (etiket analizinin içinden) geçerliyse o
//  3) Yoksa AI'ya ODAKLI ikinci okuma: yüksek çözünürlükte yalnızca barkod rakamları (en çok 2 deneme)
// Hiçbiri geçerli sonuç vermezse okunan rakamlar uyarıda gösterilir; alana yanlış barkod yazılmaz.
import { api } from "./istemci";
import { resmiKucult } from "./resim";
import { gorseldenBarkod } from "./tarayici";

export async function yerelBarkodOku(dosya: Blob, kucuk?: Blob | null): Promise<string | null> {
  const k = await gorseldenBarkod(dosya).catch(() => null);
  if (k) return k;
  return kucuk ? gorseldenBarkod(kucuk).catch(() => null) : null;
}

type AiBarkod = { sonuc: { barkod: string | null; gecerli: boolean } };

export async function barkodIyilestir<T extends { barkod: string | null; uyarilar: string[] }>(sonuc: T, dosya: Blob, yerel: string | null): Promise<T> {
  const saglamaUyarisi = (u: string) => /sağlama toplamından/.test(u);
  if (yerel) {
    // Çizgilerden okunan kod, AI'nın rakam okumasından üstündür
    return { ...sonuc, barkod: yerel, uyarilar: sonuc.uyarilar.filter((u) => !saglamaUyarisi(u)) };
  }
  if (sonuc.barkod) return sonuc;
  let gorsel: string;
  try { gorsel = (await resmiKucult(dosya, 2600, 0.88)).dataUrl; } catch { return sonuc; }
  let okunan: string | null = null;
  for (let deneme = 0; deneme < 2; deneme++) {
    try {
      const r = (await api<AiBarkod>("/api/ai/barkod", { govde: { gorsel } })).sonuc;
      if (r.barkod && r.gecerli) return { ...sonuc, barkod: r.barkod, uyarilar: sonuc.uyarilar.filter((u) => !saglamaUyarisi(u)) };
      if (r.barkod) okunan = r.barkod;
    } catch { /* hız sınırı / geçici hata: eldeki sonuçla devam */ break; }
  }
  if (okunan) return { ...sonuc, uyarilar: [...sonuc.uyarilar.filter((u) => !saglamaUyarisi(u)), `Barkod rakamları "${okunan}" okundu ama sağlama toplamı tutmadı. Etikete bakıp barkodu elle yazın (boş bırakırsanız sistem barkod üretir).`] };
  return sonuc;
}
