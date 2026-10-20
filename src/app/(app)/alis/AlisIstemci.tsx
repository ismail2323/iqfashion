"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Trash2 } from "lucide-react";
import { Buton, Girdi, Kart } from "@/components/ui";
import { UrunSecici, type SecilenUrun } from "@/components/UrunSecici";
import { KatalogListeleri, useKatalog } from "@/components/Katalog";
import { UrunGorseli } from "@/components/UrunGorseli";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/istemci";
import { paraFormat } from "@/lib/para";

type Satir = SecilenUrun & { adet: string; maliyet: string; satis: string };
const sayi = (s: string) => Number(s.replace(",", "."));

export function AlisIstemci({ baslangic }: { baslangic: SecilenUrun[] }) {
  const router = useRouter();
  const bildir = useToast();
  const katalog = useKatalog();
  const [satirlar, setSatirlar] = useState<Satir[]>(() => baslangic.map((u) => ({ ...u, adet: "", maliyet: String(u.alisFiyati ?? 0), satis: String(u.satisFiyati) })));
  const [tedarikci, setTedarikci] = useState("");
  const [belgeNo, setBelgeNo] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  const ekle = (u: SecilenUrun) => setSatirlar((l) => (l.some((x) => x.id === u.id) ? l.map((x) => (x.id === u.id ? { ...x, adet: String((Number(x.adet) || 0) + 1) } : x)) : [...l, { ...u, adet: "1", maliyet: String(u.alisFiyati ?? 0), satis: String(u.satisFiyati) }]));
  const guncelle = (id: string, d: Partial<Satir>) => setSatirlar((l) => l.map((x) => (x.id === id ? { ...x, ...d } : x)));
  const gecerli = satirlar.filter((s) => Number(s.adet) >= 1 && sayi(s.maliyet) >= 0);
  const toplam = gecerli.reduce((t, s) => t + Number(s.adet) * sayi(s.maliyet), 0);
  const adetToplam = gecerli.reduce((t, s) => t + Number(s.adet), 0);

  async function kaydet() {
    setYukleniyor(true);
    try {
      await api("/api/alis", { govde: { tedarikciAd: tedarikci || null, belgeNo: belgeNo || null, kalemler: gecerli.map((s) => ({ varyantId: s.id, adet: Number(s.adet), birimMaliyet: sayi(s.maliyet), ...(sayi(s.satis) > 0 ? { satisFiyati: sayi(s.satis) } : {}) })) } });
      bildir(`Mal kabul kaydedildi: ${adetToplam} adet`);
      setSatirlar([]); setTedarikci(""); setBelgeNo("");
      router.refresh();
    } catch (e) { bildir((e as Error).message, "hata"); } finally { setYukleniyor(false); }
  }

  return (
    <Kart className="space-y-4 p-4 sm:p-5">
      <KatalogListeleri k={katalog} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Tedarikçi<Girdi list="dl-tedarikciler" value={tedarikci} onChange={(e) => setTedarikci(e.target.value)} className="mt-1.5" placeholder="İsteğe bağlı" /></label>
        <label className="text-sm font-medium">İrsaliye / fatura no<Girdi value={belgeNo} onChange={(e) => setBelgeNo(e.target.value)} className="mt-1.5" placeholder="İsteğe bağlı" /></label>
      </div>
      <UrunSecici onSec={ekle} placeholder="Gelen ürünü ara ya da barkodunu okutun…" />
      <p className="text-xs text-muted">Yeni (sistemde olmayan) bir ürün geldiyse <a href="/urunler/yeni" className="font-medium text-accent underline">Ürün Ekle</a> sayfasını kullanın.</p>

      {satirlar.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {satirlar.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
              <UrunGorseli src={s.gorselUrl} ad={s.urunAdi} marka={s.marka} className="size-12 shrink-0 rounded-lg" />
              <div className="min-w-40 flex-1"><p className="truncate text-sm font-medium">{s.urunAdi}</p><p className="text-xs text-muted">{s.renk} · {s.beden} · mevcut stok {s.stok}</p></div>
              <label className="text-[11px] text-muted">Adet<Girdi inputMode="numeric" value={s.adet} onChange={(e) => guncelle(s.id, { adet: e.target.value.replace(/\D/g, "") })} className="mt-0.5 min-h-10 w-20 py-1 text-center text-sm" /></label>
              <label className="text-[11px] text-muted">Birim maliyet ₺<Girdi inputMode="decimal" value={s.maliyet} onChange={(e) => guncelle(s.id, { maliyet: e.target.value })} className="mt-0.5 min-h-10 w-28 py-1 text-right text-sm" /></label>
              <label className="text-[11px] text-muted">Satış fiyatı ₺<Girdi inputMode="decimal" value={s.satis} onChange={(e) => guncelle(s.id, { satis: e.target.value })} className="mt-0.5 min-h-10 w-28 py-1 text-right text-sm" /></label>
              <button onClick={() => setSatirlar((l) => l.filter((x) => x.id !== s.id))} aria-label="Kaldır" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm"><b>{adetToplam}</b> adet · toplam <b className="tabular">{paraFormat(toplam)}</b><span className="block text-xs text-muted">Ortalama maliyet, mevcut stokla ağırlıklı olarak güncellenir. Satış fiyatını değiştirirseniz o ürünün fiyatı <b>tüm şubelerde</b> güncellenir.</span></p>
        <Buton onClick={kaydet} yukleniyor={yukleniyor} disabled={gecerli.length === 0}><PackageCheck className="size-4" /> Mal kabulü kaydet</Buton>
      </div>
    </Kart>
  );
}
