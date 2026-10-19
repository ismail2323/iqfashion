"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, PackageCheck, Plus, Send, Trash2, Truck, XCircle } from "lucide-react";
import { Alan, BosDurum, Buton, Girdi, Kart, Modal, Rozet, Secim } from "@/components/ui";
import { UrunSecici, type SecilenUrun } from "@/components/UrunSecici";
import { OnayModal } from "@/components/OnayModal";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/istemci";
import { tarihFormat } from "@/lib/tarih";

type Sube = { id: string; ad: string };
type T = { id: string; no: string; durum: "BEKLEMEDE" | "YOLDA" | "TAMAMLANDI" | "IPTAL"; tarih: string; notlar: string | null; kaynak: Sube; hedef: Sube; kalemler: { id: string; urunAdi: string; renk: string; beden: string; miktar: number }[] };
const DURUM = { BEKLEMEDE: { ad: "Hazırlanıyor", ton: "uyari" }, YOLDA: { ad: "Yolda", ton: "bilgi" }, TAMAMLANDI: { ad: "Teslim alındı", ton: "ok" }, IPTAL: { ad: "İptal", ton: "tehlike" } } as const;

export function TransferIstemci({ transferler, subeler, kaynakId, superAdmin, benimSube }: { transferler: T[]; subeler: Sube[]; kaynakId: string | null; superAdmin: boolean; benimSube: string | null }) {
  const router = useRouter();
  const bildir = useToast();
  const [yeni, setYeni] = useState(false);
  const [iptal, setIptal] = useState<T | null>(null);

  async function islem(t: T, eylem: "gonder" | "teslim" | "iptal") {
    try {
      await api(`/api/transferler/${t.id}/${eylem}`, { method: "POST", govde: {} });
      bildir({ gonder: "Transfer gönderildi, stok şubeden düşüldü", teslim: "Teslim alındı, stok şubeye eklendi", iptal: "Transfer iptal edildi" }[eylem]);
      router.refresh();
    } catch (e) { bildir((e as Error).message, "hata"); throw e; }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Buton onClick={() => setYeni(true)}><Plus className="size-4" /> Yeni transfer</Buton></div>
      {transferler.length === 0 ? (
        <Kart><BosDurum ikon={<Truck className="size-6" />} baslik="Henüz transfer yok" aciklama="Bir şubeden diğerine ürün göndermek için “Yeni transfer”i kullanın." /></Kart>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {transferler.map((t) => {
            const kaynakBen = superAdmin || benimSube === t.kaynak.id;
            const hedefBen = superAdmin || benimSube === t.hedef.id;
            const adet = t.kalemler.reduce((s, k) => s + k.miktar, 0);
            return (
              <Kart key={t.id} className="anim-yukari p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{t.no}</p>
                  <Rozet ton={DURUM[t.durum].ton}>{DURUM[t.durum].ad}</Rozet>
                </div>
                <p className="mt-2 flex items-center gap-2 text-sm"><b>{t.kaynak.ad}</b><ArrowRight className="size-4 text-muted" /><b>{t.hedef.ad}</b></p>
                <p className="text-xs text-muted">{tarihFormat(t.tarih, true)} · {adet} adet{t.notlar && ` · ${t.notlar}`}</p>
                <ul className="mt-3 divide-y divide-border rounded-xl border border-border text-sm">
                  {t.kalemler.map((k) => <li key={k.id} className="flex justify-between gap-3 px-3 py-1.5"><span>{k.urunAdi} <span className="text-muted">{k.renk}/{k.beden}</span></span><span className="tabular font-medium">{k.miktar}</span></li>)}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.durum === "BEKLEMEDE" && kaynakBen && <Buton kucuk onClick={() => void islem(t, "gonder").catch(() => {})}><Send className="size-4" /> Gönder</Buton>}
                  {t.durum === "YOLDA" && hedefBen && <Buton kucuk onClick={() => void islem(t, "teslim").catch(() => {})}><PackageCheck className="size-4" /> Teslim al</Buton>}
                  {(t.durum === "BEKLEMEDE" || t.durum === "YOLDA") && (kaynakBen || hedefBen) && <Buton kucuk varyant="hayalet" onClick={() => setIptal(t)}><XCircle className="size-4" /> İptal</Buton>}
                </div>
              </Kart>
            );
          })}
        </div>
      )}
      <YeniTransfer acik={yeni} kapat={() => setYeni(false)} subeler={subeler} kaynakId={kaynakId} bitti={() => router.refresh()} />
      <OnayModal acik={!!iptal} kapat={() => setIptal(null)} baslik="Transferi iptal et" onayMetni="İptal et" tehlikeli
        mesaj={<>{iptal?.no} iptal edilecek.{iptal?.durum === "YOLDA" && " Ürünler gönderen şubenin stoğuna geri eklenir."}</>}
        calistir={async () => { if (iptal) await islem(iptal, "iptal"); }} />
    </div>
  );
}

function YeniTransfer({ acik, kapat, subeler, kaynakId, bitti }: { acik: boolean; kapat: () => void; subeler: Sube[]; kaynakId: string | null; bitti: () => void }) {
  const bildir = useToast();
  const [hedef, setHedef] = useState("");
  const [not, setNot] = useState("");
  const [satirlar, setSatirlar] = useState<(SecilenUrun & { adet: string })[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const kaynakSube = kaynakId ?? "";

  const ekle = (u: SecilenUrun) => {
    if (u.stok <= 0) return bildir(`Gönderen şubede stok yok: ${u.urunAdi} ${u.renk}/${u.beden}`, "hata");
    setSatirlar((l) => (l.some((x) => x.id === u.id) ? l : [...l, { ...u, adet: "1" }]));
  };

  async function gonder() {
    setHata(null);
    setYukleniyor(true);
    try {
      await api("/api/transferler", { govde: { hedefSubeId: hedef, kaynakSubeId: kaynakSube || undefined, notlar: not || null, kalemler: satirlar.map((s) => ({ varyantId: s.id, adet: Number(s.adet) })) } });
      bildir("Transfer oluşturuldu. Göndermek için “Gönder”e basın.");
      setSatirlar([]); setHedef(""); setNot("");
      kapat();
      bitti();
    } catch (e) { setHata((e as Error).message); } finally { setYukleniyor(false); }
  }

  return (
    <Modal acik={acik} kapat={kapat} baslik="Yeni transfer" genis>
      <div className="space-y-4">
        {!kaynakId ? (
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">Önce sayfanın üstündeki menüden <b>gönderen şubeyi</b> seçin (stok adetleri o şubeye göre gösterilir).</p>
        ) : (
          <p className="text-sm">Gönderen: <b>{subeler.find((s) => s.id === kaynakSube)?.ad}</b></p>
        )}
        <Alan etiket="Hedef şube"><Secim value={hedef} onChange={(e) => setHedef(e.target.value)}><option value="">Seçin…</option>{subeler.filter((s) => s.id !== kaynakSube).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}</Secim></Alan>
        {kaynakSube ? <UrunSecici onSec={ekle} placeholder="Gönderilecek ürünü ara / barkod okut…" /> : <p className="text-sm text-muted">Önce gönderen şubeyi seçin.</p>}
        {satirlar.length > 0 && (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {satirlar.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{s.urunAdi}</p><p className="text-xs text-muted">{s.renk} · {s.beden} · gönderen stoğu {s.stok}</p></div>
                <Girdi aria-label="Adet" inputMode="numeric" value={s.adet} onChange={(e) => setSatirlar((l) => l.map((x) => (x.id === s.id ? { ...x, adet: e.target.value.replace(/\D/g, "") } : x)))} className="min-h-10 w-20 py-1 text-center" />
                <button onClick={() => setSatirlar((l) => l.filter((x) => x.id !== s.id))} aria-label="Kaldır" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {satirlar.some((s) => Number(s.adet) > s.stok) && <p className="text-sm text-danger">Bazı adetler gönderen şubenin stoğunu aşıyor.</p>}
        <Alan etiket="Not (isteğe bağlı)"><Girdi value={not} onChange={(e) => setNot(e.target.value)} /></Alan>
        {hata && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{hata}</div>}
        <div className="flex justify-end gap-2">
          <Buton varyant="ikincil" onClick={kapat}>Vazgeç</Buton>
          <Buton onClick={gonder} yukleniyor={yukleniyor} disabled={!hedef || !satirlar.length || satirlar.some((s) => !(Number(s.adet) >= 1) || Number(s.adet) > s.stok)}>Transfer oluştur</Buton>
        </div>
      </div>
    </Modal>
  );
}
