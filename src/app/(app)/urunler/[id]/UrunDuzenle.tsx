"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Alan, Buton, Girdi, Modal, Secim } from "@/components/ui";
import { OnayModal } from "@/components/OnayModal";
import { useToast } from "@/components/Toast";
import { KatalogListeleri, useKatalog } from "@/components/Katalog";
import { api } from "@/lib/istemci";

type U = { id: string; ad: string; marka: string; kategori: string; cinsiyet: string; sezon: string; aktif: boolean };

export function UrunDuzenle({ urun, superAdmin }: { urun: U; superAdmin: boolean }) {
  const router = useRouter();
  const bildir = useToast();
  const katalog = useKatalog();
  const [acik, setAcik] = useState(false);
  const [pasif, setPasif] = useState(false);
  const [silAcik, setSilAcik] = useState(false);
  const [ozet, setOzet] = useState<{ varyant: number; stokAdedi: number; satisKalemi: number; alisKalemi: number; transfer: number } | null>(null);
  useEffect(() => {
    if (!silAcik) return;
    setOzet(null);
    api<NonNullable<typeof ozet>>(`/api/urunler/${urun.id}`).then(setOzet).catch(() => {});
  }, [silAcik, urun.id]);
  const [f, setF] = useState(urun);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setYukleniyor(true);
    setHata(null);
    try {
      await api(`/api/urunler/${urun.id}`, { method: "PATCH", govde: { ad: f.ad, markaAd: f.marka || null, kategoriAd: f.kategori || null, cinsiyet: f.cinsiyet || null, sezon: f.sezon || null } });
      bildir("Ürün güncellendi");
      setAcik(false);
      router.refresh();
    } catch (er) { setHata((er as Error).message); } finally { setYukleniyor(false); }
  }

  return (
    <>
      <KatalogListeleri k={katalog} />
      <Buton kucuk varyant="ikincil" onClick={() => setAcik(true)}><Pencil className="size-4" /> Düzenle</Buton>
      <Modal acik={acik} kapat={() => setAcik(false)} baslik="Ürünü düzenle">
        <form onSubmit={kaydet} className="space-y-4">
          <Alan etiket="Ürün adı"><Girdi value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} required /></Alan>
          <div className="grid gap-4 sm:grid-cols-2">
            <Alan etiket="Marka"><Girdi list="dl-markalar" value={f.marka} onChange={(e) => setF({ ...f, marka: e.target.value })} /></Alan>
            <Alan etiket="Tür"><Girdi list="dl-kategoriler" value={f.kategori} onChange={(e) => setF({ ...f, kategori: e.target.value })} /></Alan>
            <Alan etiket="Cinsiyet"><Secim value={f.cinsiyet} onChange={(e) => setF({ ...f, cinsiyet: e.target.value })}><option value="">—</option><option value="ERKEK">Erkek</option><option value="KADIN">Kadın</option><option value="COCUK">Çocuk</option><option value="UNISEX">Unisex</option></Secim></Alan>
            <Alan etiket="Sezon"><Secim value={f.sezon} onChange={(e) => setF({ ...f, sezon: e.target.value })}><option value="">—</option><option value="YAZLIK">Yazlık</option><option value="KISLIK">Kışlık</option><option value="IKI_SEZON">İki sezon</option></Secim></Alan>
          </div>
          {!superAdmin && <p className="text-xs text-muted">Fiyat listesini ve ürünü pasife almayı yalnızca süper admin yapabilir.</p>}
          {hata && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{hata}</div>}
          <div className="flex flex-wrap justify-between gap-2">
            {superAdmin ? (
              <div className="flex flex-wrap gap-2">
                <Buton type="button" varyant="ikincil" kucuk onClick={() => setPasif(true)}>Ürünü pasife al</Buton>
                <Buton type="button" varyant="tehlike" kucuk onClick={() => setSilAcik(true)}><Trash2 className="size-4" /> Ürünü sil</Buton>
              </div>
            ) : <span />}
            <div className="flex gap-2"><Buton type="button" varyant="ikincil" onClick={() => setAcik(false)}>Vazgeç</Buton><Buton type="submit" yukleniyor={yukleniyor}>Kaydet</Buton></div>
          </div>
        </form>
      </Modal>
      <OnayModal acik={pasif} kapat={() => setPasif(false)} baslik="Ürünü pasife al" onayMetni="Pasife al" tehlikeli
        mesaj={<>“{urun.ad}” satış ve listelerden kalkar. Stok ve geçmiş kayıtları silinmez.</>}
        calistir={async () => { await api(`/api/urunler/${urun.id}`, { method: "PATCH", govde: { aktif: false } }); bildir("Ürün pasife alındı"); router.push("/urunler"); router.refresh(); }} />
      <OnayModal acik={silAcik} kapat={() => setSilAcik(false)} baslik="Ürünü kalıcı sil" onayMetni="Evet, kalıcı sil" tehlikeli
        mesaj={(
          <div className="space-y-2">
            <p>“{urun.ad}” <b className="text-foreground">geri alınamaz şekilde</b> silinecek: ürün kartı, tüm renk/beden varyantları, bütün şubelerdeki stoğu, fiyat geçmişi ve transfer kayıtları gider.</p>
            {ozet ? (
              <p className="rounded-xl bg-danger-soft px-3 py-2 text-danger"><b>{ozet.varyant}</b> varyant ve <b>{ozet.stokAdedi}</b> adet stok silinecek{ozet.transfer > 0 ? `, ${ozet.transfer} transfer kalemi kalkacak` : ""}.</p>
            ) : <p className="text-xs">Kapsam hesaplanıyor…</p>}
            <p className="text-xs">Geçmiş satış ve alış belgeleri muhasebe/raporlar bozulmasın diye kalır (ürün adı yazılı olarak). Geçici olarak kaldırmak istiyorsanız silmek yerine “Pasife al” kullanın.</p>
          </div>
        )}
        calistir={async () => { await api(`/api/urunler/${urun.id}`, { method: "DELETE" }); bildir("Ürün silindi"); router.push("/urunler"); router.refresh(); }} />
    </>
  );
}
