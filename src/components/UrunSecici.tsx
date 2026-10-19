"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Girdi, Rozet } from "@/components/ui";
import { BarkodGirisi } from "@/components/Tarayici";
import { UrunGorseli } from "@/components/UrunGorseli";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/istemci";
import { bip } from "@/lib/ses";

export type SecilenUrun = { id: string; urunAdi: string; marka: string | null; gorselUrl: string | null; renk: string; beden: string; barkod: string; satisFiyati: number; alisFiyati: number | null; stok: number };

/** Barkod okut + ad/marka/renk ara; seçilen varyantı `onSec` ile döner. Stok, seçili şubeye göredir. */
export function UrunSecici({ onSec, placeholder = "Ürün ara: ad, marka, renk, beden…" }: { onSec: (u: SecilenUrun) => void; placeholder?: string }) {
  const bildir = useToast();
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState<SecilenUrun[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setSonuc([]); return; }
    setYukleniyor(true);
    const t = setTimeout(async () => {
      try { setSonuc((await api<{ sonuclar: SecilenUrun[] }>(`/api/pos/ara?q=${encodeURIComponent(q.trim())}`)).sonuclar); } catch (e) { bildir((e as Error).message, "hata"); } finally { setYukleniyor(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, bildir]);

  async function barkod(kod: string) {
    try {
      const r = await api<{ bulundu: boolean; varyant?: SecilenUrun & { aktif: boolean } }>(`/api/barkod/${encodeURIComponent(kod)}`);
      if (!r.bulundu || !r.varyant) { bip(false); return bildir(`Barkod kayıtlı değil: ${kod}`, "hata"); }
      bip(true);
      onSec(r.varyant);
    } catch (e) { bildir((e as Error).message, "hata"); }
  }

  return (
    <div className="space-y-2">
      <BarkodGirisi onKod={barkod} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
        <Girdi value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-10" aria-label="Ürün ara" />
      </div>
      {q.trim().length >= 2 && (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-surface">
          {yukleniyor && sonuc.length === 0 && <li className="px-4 py-3 text-sm text-muted">Aranıyor…</li>}
          {!yukleniyor && sonuc.length === 0 && <li className="px-4 py-3 text-sm text-muted">Sonuç yok</li>}
          {sonuc.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => { onSec(u); setQ(""); setSonuc([]); }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2">
                <UrunGorseli src={u.gorselUrl} ad={u.urunAdi} marka={u.marka} className="size-11 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{u.urunAdi}</span><span className="block truncate text-xs text-muted">{u.marka && `${u.marka} · `}{u.renk} · {u.beden}</span></span>
                <Rozet ton={u.stok <= 0 ? "tehlike" : "ok"}>{u.stok} adet</Rozet>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
