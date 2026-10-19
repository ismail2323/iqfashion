"use client";
import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer, Trash2 } from "lucide-react";
import { Buton, Girdi, Kart, Secim } from "@/components/ui";
import { UrunSecici, type SecilenUrun } from "@/components/UrunSecici";
import { barkodTuru } from "@/lib/barkod";
import { paraFormat } from "@/lib/para";

type Satir = SecilenUrun & { adet: string };
const BOYUTLAR = {
  "50x30": { ad: "50 × 30 mm (termal)", w: 50, h: 30, sutun: 1 },
  "40x25": { ad: "40 × 25 mm (küçük termal)", w: 40, h: 25, sutun: 1 },
  "a4": { ad: "A4 sayfa (3 × 8 = 24 etiket)", w: 63, h: 34, sutun: 3 },
} as const;
type Boyut = keyof typeof BOYUTLAR;

function BarkodSvg({ kod }: { kod: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const t = barkodTuru(kod);
    const format = t === "EAN13" ? "EAN13" : t === "EAN8" ? "EAN8" : t === "UPCA" ? "UPC" : "CODE128";
    try {
      JsBarcode(ref.current, kod, { format, width: 1.5, height: 34, margin: 0, fontSize: 11, textMargin: 1, displayValue: true });
    } catch {
      JsBarcode(ref.current, kod, { format: "CODE128", width: 1.3, height: 34, margin: 0, fontSize: 11, displayValue: true });
    }
    ref.current.setAttribute("width", "100%");
    ref.current.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }, [kod]);
  return <svg ref={ref} className="max-h-[55%] w-full" aria-label={`Barkod ${kod}`} />;
}

export function EtiketIstemci({ baslangic }: { baslangic: SecilenUrun[] }) {
  const [satirlar, setSatirlar] = useState<Satir[]>(() => baslangic.map((u) => ({ ...u, adet: String(Math.max(1, u.stok)) })));
  const [boyut, setBoyut] = useState<Boyut>("50x30");
  const [fiyat, setFiyat] = useState(true);
  const [marka, setMarka] = useState(true);
  const ekle = (u: SecilenUrun) => setSatirlar((l) => (l.some((x) => x.id === u.id) ? l : [...l, { ...u, adet: "1" }]));
  const b = BOYUTLAR[boyut];
  const etiketler = satirlar.flatMap((s) => Array.from({ length: Math.min(500, Number(s.adet) || 0) }, (_, i) => ({ s, k: `${s.id}-${i}` })));

  return (
    <div className="space-y-5">
      <style>{`@media print { @page { size: ${boyut === "a4" ? "A4" : `${b.w}mm ${b.h}mm`}; margin: ${boyut === "a4" ? "8mm" : "0"}; } }`}</style>
      <Kart className="space-y-4 p-4 sm:p-5 print:hidden">
        <UrunSecici onSec={ekle} placeholder="Etiketi basılacak ürünü ara / barkod okut…" />
        {satirlar.length > 0 && (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {satirlar.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{s.urunAdi}</p><p className="text-xs text-muted">{s.renk} · {s.beden} · <span className="tabular">{s.barkod}</span> · stok {s.stok}</p></div>
                <label className="text-[11px] text-muted">Adet<Girdi inputMode="numeric" value={s.adet} onChange={(e) => setSatirlar((l) => l.map((x) => (x.id === s.id ? { ...x, adet: e.target.value.replace(/\D/g, "") } : x)))} className="mt-0.5 min-h-10 w-20 py-1 text-center text-sm" /></label>
                <button onClick={() => setSatirlar((l) => l.filter((x) => x.id !== s.id))} aria-label="Kaldır" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">Etiket boyutu<Secim value={boyut} onChange={(e) => setBoyut(e.target.value as Boyut)} className="mt-1 w-64">{Object.entries(BOYUTLAR).map(([k, v]) => <option key={k} value={k}>{v.ad}</option>)}</Secim></label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={marka} onChange={(e) => setMarka(e.target.checked)} className="size-4 accent-[var(--accent)]" /> Marka</label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={fiyat} onChange={(e) => setFiyat(e.target.checked)} className="size-4 accent-[var(--accent)]" /> Fiyat</label>
          <Buton onClick={() => window.print()} disabled={etiketler.length === 0} className="ml-auto"><Printer className="size-4" /> {etiketler.length} etiketi yazdır</Buton>
        </div>
        <p className="text-xs text-muted">Yazdır penceresinde yazıcınızı seçin; kenar boşluğunu “Yok”, ölçeği “%100” yapın. Etiket yazıcı kullanmıyorsanız A4 seçip yapışkanlı etiket kâğıdına basabilirsiniz.</p>
      </Kart>

      {etiketler.length > 0 && (
        <div className="yazdir">
          <p className="mb-2 text-sm text-muted print:hidden">Önizleme</p>
          <div className="grid gap-2 print:gap-0" style={{ gridTemplateColumns: boyut === "a4" ? "repeat(3, 63mm)" : `${b.w}mm`, justifyContent: boyut === "a4" ? "start" : undefined }}>
            {etiketler.map(({ s, k }) => (
              <div key={k} className="flex flex-col items-center justify-between overflow-hidden border border-dashed border-neutral-300 bg-white p-[1.5mm] text-center text-black print:border-0" style={{ width: `${b.w}mm`, height: `${b.h}mm`, breakInside: "avoid", pageBreakAfter: boyut === "a4" ? "auto" : "always" }}>
                <div className="w-full leading-tight">
                  {marka && s.marka && <p className="truncate text-[7pt] font-semibold uppercase tracking-wide">{s.marka}</p>}
                  <p className="truncate text-[8pt] font-medium">{s.urunAdi}</p>
                  <p className="text-[7.5pt]">{s.renk} · {s.beden}</p>
                </div>
                <BarkodSvg kod={s.barkod} />
                {fiyat && <p className="text-[10pt] font-bold">{paraFormat(s.satisFiyati)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
