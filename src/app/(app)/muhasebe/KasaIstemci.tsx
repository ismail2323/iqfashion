"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Alan, BosDurum, Buton, Girdi, Kart, Modal, Rozet, Secim } from "@/components/ui";
import { OnayModal } from "@/components/OnayModal";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/istemci";
import { paraFormat } from "@/lib/para";
import { KATEGORILER_GELIR, KATEGORILER_GIDER } from "@/lib/kasa";

type Kayit = { id: string; tip: "GELIR" | "GIDER"; kategori: string; tutar: number; aciklama: string | null; tarih: string; kim: string | null };

export function KasaIstemci({ kayitlar, subeSecili }: { kayitlar: Kayit[]; subeSecili: boolean }) {
  const router = useRouter();
  const bildir = useToast();
  const [acik, setAcik] = useState(false);
  const [sil, setSil] = useState<Kayit | null>(null);
  const [tip, setTip] = useState<"GELIR" | "GIDER">("GIDER");
  const [kategori, setKategori] = useState("");
  const [tutar, setTutar] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [tarih, setTarih] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const kategoriler = tip === "GIDER" ? KATEGORILER_GIDER : KATEGORILER_GELIR;

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setYukleniyor(true);
    try {
      await api("/api/kasa", { govde: { tip, kategori, tutar: Number(tutar.replace(",", ".")), aciklama: aciklama || null, tarih: tarih || undefined } });
      bildir(tip === "GIDER" ? "Gider kaydedildi" : "Gelir kaydedildi");
      setAcik(false); setTutar(""); setAciklama(""); setKategori(""); setTarih("");
      router.refresh();
    } catch (er) { setHata((er as Error).message); } finally { setYukleniyor(false); }
  }

  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">Gelir / gider kayıtları</h2>
        <Buton onClick={() => setAcik(true)}><Plus className="size-4" /> Kayıt ekle</Buton>
      </div>
      <p className="mb-3 text-sm text-muted">Satış ve mal alışı otomatik hesaplanır. Kira, maaş, fatura, kargo gibi <b>işletme giderlerini</b> ve diğer gelirleri buradan girin.{!subeSecili && " (Şube seçilmediğinde kayıt şubesiz/genel kaydedilir.)"}</p>
      <Kart className="overflow-hidden">
        {kayitlar.length === 0 ? <BosDurum baslik="Bu dönemde kayıt yok" aciklama="Gider veya gelir eklemek için “Kayıt ekle”ye basın." /> : (
          <ul className="divide-y divide-border">
            {kayitlar.map((k) => (
              <li key={k.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Rozet ton={k.tip === "GIDER" ? "tehlike" : "ok"}>{k.tip === "GIDER" ? "Gider" : "Gelir"}</Rozet>
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{k.kategori}{k.aciklama && <span className="font-normal text-muted"> · {k.aciklama}</span>}</p><p className="text-xs text-muted">{k.tarih}{k.kim && ` · ${k.kim}`}</p></div>
                <b className={`tabular ${k.tip === "GIDER" ? "text-danger" : "text-ok"}`}>{k.tip === "GIDER" ? "−" : "+"}{paraFormat(k.tutar)}</b>
                <button onClick={() => setSil(k)} aria-label="Sil" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </Kart>

      <Modal acik={acik} kapat={() => setAcik(false)} baslik="Gelir / gider kaydı">
        <form onSubmit={kaydet} className="space-y-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tür">
            {(["GIDER", "GELIR"] as const).map((t) => (
              <button type="button" key={t} role="radio" aria-checked={tip === t} onClick={() => { setTip(t); setKategori(""); }} className={`min-h-11 rounded-xl border text-sm font-medium ${tip === t ? "border-foreground bg-foreground text-background" : "border-border hover:bg-surface-2"}`}>{t === "GIDER" ? "Gider" : "Gelir"}</button>
            ))}
          </div>
          <Alan etiket="Kategori"><Secim value={kategori} onChange={(e) => setKategori(e.target.value)} required><option value="">Seçin…</option>{kategoriler.map((k) => <option key={k}>{k}</option>)}</Secim></Alan>
          <div className="grid gap-4 sm:grid-cols-2">
            <Alan etiket="Tutar (₺)"><Girdi inputMode="decimal" value={tutar} onChange={(e) => setTutar(e.target.value)} required placeholder="0,00" /></Alan>
            <Alan etiket="Tarih" ipucu="Boşsa bugün"><Girdi type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} /></Alan>
          </div>
          <Alan etiket="Açıklama (isteğe bağlı)"><Girdi value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Örn: Ekim kirası" /></Alan>
          {hata && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{hata}</div>}
          <div className="flex justify-end gap-2"><Buton type="button" varyant="ikincil" onClick={() => setAcik(false)}>Vazgeç</Buton><Buton type="submit" yukleniyor={yukleniyor}>Kaydet</Buton></div>
        </form>
      </Modal>
      <OnayModal acik={!!sil} kapat={() => setSil(null)} baslik="Kaydı sil" onayMetni="Sil" tehlikeli mesaj={<>“{sil?.kategori}” ({sil && paraFormat(sil.tutar)}) kaydı silinecek. Raporlar buna göre güncellenir.</>}
        calistir={async () => { try { await api(`/api/kasa/${sil!.id}`, { method: "DELETE" }); bildir("Kayıt silindi"); router.refresh(); } catch (e) { bildir((e as Error).message, "hata"); throw e; } }} />
    </div>
  );
}
