"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Pencil, Trash2 } from "lucide-react";
import { BosDurum, Buton, Girdi, Modal, Rozet, MetinAlani } from "@/components/ui";
import { BarkodGirisi } from "@/components/Tarayici";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/istemci";
import { bip } from "@/lib/ses";
import { paraFormat } from "@/lib/para";

export type StokSatiri = { id: string; urunId: string; urun: string; marka: string | null; renk: string; beden: string; barkod: string; stok: number; min: number; alis: number | null; satis: number; subeStok: Record<string, number> };
type Sube = { id: string; ad: string };

export function StokIstemci({ satirlar, subeler, duzenleyebilir, subeSecili }: { satirlar: StokSatiri[]; subeler: Sube[]; duzenleyebilir: boolean; subeSecili: boolean }) {
  const router = useRouter();
  const bildir = useToast();
  const [duzelt, setDuzelt] = useState<StokSatiri | null>(null);
  const [yeni, setYeni] = useState("");
  const [not, setNot] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sayimAcik, setSayimAcik] = useState(false);
  const [sayim, setSayim] = useState<Record<string, { adet: number; ad: string; renk: string; beden: string; sistem: number }>>({});

  async function duzeltKaydet() {
    if (!duzelt) return;
    setYukleniyor(true);
    try {
      await api("/api/stok/duzelt", { govde: { varyantId: duzelt.id, yeniMiktar: Number(yeni), aciklama: not || undefined } });
      bildir("Stok güncellendi");
      setDuzelt(null);
      router.refresh();
    } catch (e) { bildir((e as Error).message, "hata"); } finally { setYukleniyor(false); }
  }

  async function sayimOkundu(kod: string) {
    try {
      const r = await api<{ bulundu: boolean; varyant?: { id: string; urunAdi: string; renk: string; beden: string; stok: number } }>(`/api/barkod/${encodeURIComponent(kod)}`);
      if (!r.bulundu || !r.varyant) { bip(false); return bildir(`Kayıtlı değil: ${kod}`, "hata"); }
      const v = r.varyant;
      bip(true);
      setSayim((s) => ({ ...s, [v.id]: { adet: (s[v.id]?.adet ?? 0) + 1, ad: v.urunAdi, renk: v.renk, beden: v.beden, sistem: v.stok } }));
    } catch (e) { bip(false); bildir((e as Error).message, "hata"); }
  }
  async function sayimUygula() {
    setYukleniyor(true);
    let ok = 0;
    try {
      for (const [id, { adet }] of Object.entries(sayim)) {
        await api("/api/stok/duzelt", { govde: { varyantId: id, yeniMiktar: adet, sayim: true } });
        ok++;
      }
      bildir(`${ok} ürünün sayımı uygulandı`);
      setSayim({});
      setSayimAcik(false);
      router.refresh();
    } catch (e) { bildir(`${ok} ürün uygulandı, sonra hata: ${(e as Error).message}`, "hata"); } finally { setYukleniyor(false); }
  }

  if (satirlar.length === 0) return <BosDurum baslik="Kayıt bulunamadı" aciklama="Filtreyi değiştirin veya yeni ürün ekleyin." />;
  const sayilanlar = Object.entries(sayim).map(([id, s]) => ({ id, v: { urun: s.ad, renk: s.renk, beden: s.beden, stok: s.sistem }, adet: s.adet }));

  return (
    <>
      {duzenleyebilir && (
        <div className="flex justify-end border-b border-border px-4 py-3">
          <Buton kucuk varyant="ikincil" onClick={() => setSayimAcik(true)}><ClipboardCheck className="size-4" /> Sayım modu</Buton>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Ürün</th><th className="px-3 py-2.5 text-left font-medium">Renk / Beden</th><th className="px-3 py-2.5 text-left font-medium">Barkod</th>
              {!subeSecili && subeler.map((s) => <th key={s.id} className="px-3 py-2.5 text-right font-medium">{s.ad}</th>)}
              <th className="px-3 py-2.5 text-right font-medium">Stok</th>
              {satirlar[0].alis !== null && <th className="px-3 py-2.5 text-right font-medium">Alış</th>}<th className="px-3 py-2.5 text-right font-medium">Satış</th>{duzenleyebilir && <th className="w-12" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {satirlar.map((s) => (
              <tr key={s.id} className="hover:bg-surface-2/60">
                <td className="px-4 py-2.5"><Link href={`/urunler/${s.urunId}`} className="font-medium hover:text-accent">{s.urun}</Link>{s.marka && <span className="block text-xs text-muted">{s.marka}</span>}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{s.renk} · {s.beden}</td>
                <td className="tabular px-3 py-2.5 text-xs text-muted">{s.barkod}</td>
                {!subeSecili && subeler.map((b) => <td key={b.id} className="tabular px-3 py-2.5 text-right text-muted">{s.subeStok[b.id]}</td>)}
                <td className="px-3 py-2.5 text-right"><Rozet ton={s.stok === 0 ? "tehlike" : s.stok <= s.min ? "uyari" : "ok"}>{s.stok === 0 ? "Tükendi" : s.stok}</Rozet></td>
                {s.alis !== null && <td className="tabular px-3 py-2.5 text-right text-muted">{paraFormat(s.alis)}</td>}
                <td className="tabular px-3 py-2.5 text-right">{paraFormat(s.satis)}</td>
                {duzenleyebilir && <td className="px-2"><button onClick={() => { setDuzelt(s); setYeni(String(s.stok)); setNot(""); }} aria-label={`${s.urun} stok düzelt`} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"><Pencil className="size-4" /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal acik={!!duzelt} kapat={() => setDuzelt(null)} baslik="Stok düzelt">
        {duzelt && (
          <div className="space-y-4">
            <p className="text-sm"><b>{duzelt.urun}</b> · {duzelt.renk} / {duzelt.beden}<br /><span className="text-muted">Sistemdeki stok: {duzelt.stok}</span></p>
            <label className="block text-sm font-medium">Sayılan / doğru adet<Girdi inputMode="numeric" value={yeni} onChange={(e) => setYeni(e.target.value.replace(/\D/g, ""))} className="mt-1.5" autoFocus /></label>
            <label className="block text-sm font-medium">Açıklama (isteğe bağlı)<MetinAlani value={not} onChange={(e) => setNot(e.target.value)} className="mt-1.5 min-h-16" placeholder="Örn: raf sayımında fark çıktı" /></label>
            {yeni !== "" && Number(yeni) !== duzelt.stok && <p className="text-sm">Fark: <b className={Number(yeni) > duzelt.stok ? "text-ok" : "text-danger"}>{Number(yeni) - duzelt.stok > 0 ? "+" : ""}{Number(yeni) - duzelt.stok}</b> adet — hareket kaydı olarak yazılır.</p>}
            <div className="flex justify-end gap-2"><Buton varyant="ikincil" onClick={() => setDuzelt(null)}>Vazgeç</Buton><Buton onClick={duzeltKaydet} yukleniyor={yukleniyor} disabled={yeni === ""}>Kaydet</Buton></div>
          </div>
        )}
      </Modal>

      <Modal acik={sayimAcik} kapat={() => setSayimAcik(false)} baslik="Sayım modu" genis>
        <div className="space-y-4">
          <p className="text-sm text-muted">Raftaki ürünlerin barkodunu tek tek okutun; her okutma sayıyı 1 artırır. Sonunda “Sayımı uygula” dediğinizde <b>yalnızca okuttuğunuz ürünlerin</b> stoğu sayılan adede eşitlenir (okutmadıklarınıza dokunulmaz).</p>
          <BarkodGirisi onKod={sayimOkundu} otomatikOdak />
          {sayilanlar.length === 0 ? <p className="rounded-xl bg-surface-2 p-4 text-center text-sm text-muted">Henüz barkod okutulmadı.</p> : (
            <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-2 text-xs text-muted"><tr><th className="px-3 py-2 text-left font-medium">Ürün</th><th className="px-3 py-2 text-right font-medium">Sistem</th><th className="px-3 py-2 text-right font-medium">Sayılan</th><th className="px-3 py-2 text-right font-medium">Fark</th><th className="w-10" /></tr></thead>
                <tbody className="divide-y divide-border">
                  {sayilanlar.map(({ id, v, adet }) => (
                    <tr key={id}>
                      <td className="px-3 py-2">{v.urun} <span className="text-muted">{v.renk}/{v.beden}</span></td>
                      <td className="tabular px-3 py-2 text-right text-muted">{v.stok}</td>
                      <td className="px-3 py-2 text-right"><input aria-label="Sayılan" inputMode="numeric" value={adet} onChange={(e) => setSayim((s) => ({ ...s, [id]: { ...s[id], adet: Number(e.target.value.replace(/\D/g, "")) } }))} className="tabular w-16 rounded-lg border border-border bg-surface px-2 py-1 text-right" /></td>
                      <td className={`tabular px-3 py-2 text-right font-medium ${adet === v.stok ? "text-muted" : adet > v.stok ? "text-ok" : "text-danger"}`}>{adet - v.stok > 0 ? "+" : ""}{adet - v.stok}</td>
                      <td><button onClick={() => setSayim((s) => { const y = { ...s }; delete y[id]; return y; })} aria-label="Kaldır" className="grid size-8 place-items-center text-muted hover:text-danger"><Trash2 className="size-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end gap-2"><Buton varyant="ikincil" onClick={() => setSayimAcik(false)}>Kapat</Buton><Buton onClick={sayimUygula} yukleniyor={yukleniyor} disabled={sayilanlar.length === 0}>Sayımı uygula ({sayilanlar.length})</Buton></div>
        </div>
      </Modal>
    </>
  );
}
