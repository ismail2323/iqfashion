"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Undo2 } from "lucide-react";
import { Buton, Girdi, Modal } from "@/components/ui";
import { OnayModal } from "@/components/OnayModal";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/istemci";
import { paraFormat } from "@/lib/para";

type K = { id: string; ad: string; miktar: number; iade: number };

export function SatisAksiyonlari({ satisId, no, kalemler }: { satisId: string; no: string; kalemler: K[] }) {
  const router = useRouter();
  const bildir = useToast();
  const [iptal, setIptal] = useState(false);
  const [iade, setIade] = useState(false);
  const [adetler, setAdetler] = useState<Record<string, string>>({});
  const [yukleniyor, setYukleniyor] = useState(false);
  const iadeEdilebilir = kalemler.some((k) => k.miktar - k.iade > 0);

  async function iadeYap() {
    setYukleniyor(true);
    try {
      const r = await api<{ iadeTutari: number }>(`/api/satis/${satisId}/iade`, { govde: { kalemler: Object.entries(adetler).filter(([, a]) => Number(a) > 0).map(([kalemId, a]) => ({ kalemId, adet: Number(a) })) } });
      bildir(`İade alındı. Müşteriye iade edilecek tutar: ${paraFormat(r.iadeTutari)}`);
      setIade(false); setAdetler({});
      router.refresh();
    } catch (e) { bildir((e as Error).message, "hata"); } finally { setYukleniyor(false); }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {iadeEdilebilir && <Buton kucuk varyant="ikincil" onClick={() => setIade(true)}><Undo2 className="size-4" /> İade al</Buton>}
      <Buton kucuk varyant="hayalet" className="text-danger" onClick={() => setIptal(true)}><Ban className="size-4" /> Satışı iptal et</Buton>

      <OnayModal acik={iptal} kapat={() => setIptal(false)} baslik="Satışı iptal et" onayMetni="Satışı iptal et" tehlikeli
        mesaj={<>{no} iptal edilecek; iade edilmemiş ürünler stoğa geri eklenir ve satış raporlardan düşer. Bu işlem geri alınamaz.</>}
        calistir={async () => {
          try { await api(`/api/satis/${satisId}/iptal`, { method: "POST", govde: {} }); bildir("Satış iptal edildi, stok geri eklendi"); router.refresh(); } catch (e) { bildir((e as Error).message, "hata"); throw e; }
        }} />

      <Modal acik={iade} kapat={() => setIade(false)} baslik={`İade al · ${no}`}>
        <div className="space-y-4">
          <p className="text-sm text-muted">İade edilen ürünler stoğa geri eklenir. İade edilecek adetleri girin.</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {kalemler.filter((k) => k.miktar - k.iade > 0).map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="min-w-0"><span className="block truncate">{k.ad}</span><span className="text-xs text-muted">İade edilebilir: {k.miktar - k.iade}</span></span>
                <Girdi aria-label={`${k.ad} iade adedi`} inputMode="numeric" value={adetler[k.id] ?? ""} placeholder="0" onChange={(e) => setAdetler((a) => ({ ...a, [k.id]: String(Math.min(Number(e.target.value.replace(/\D/g, "")) || 0, k.miktar - k.iade) || "") }))} className="min-h-10 w-20 py-1 text-center" />
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2"><Buton varyant="ikincil" onClick={() => setIade(false)}>Vazgeç</Buton><Buton onClick={iadeYap} yukleniyor={yukleniyor} disabled={!Object.values(adetler).some((a) => Number(a) > 0)}>İadeyi onayla</Buton></div>
        </div>
      </Modal>
    </div>
  );
}
