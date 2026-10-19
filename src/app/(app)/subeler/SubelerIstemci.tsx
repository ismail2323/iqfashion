"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Boxes, ExternalLink, MapPin, Pencil, Phone, Plus, Power, Store, Trash2, Users } from "lucide-react";
import { Alan, BosDurum, Buton, Girdi, Iskelet, Kart, Modal, Rozet } from "@/components/ui";
import { HesapKarti } from "@/components/HesapKarti";
import { OnayModal } from "@/components/OnayModal";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/istemci";
import { paraFormat, sayiFormat } from "@/lib/para";

type Sube = { ana: boolean; id: string; ad: string; kod: string; adres: string | null; telefon: string | null; aktif: boolean; kullaniciSayisi: number; stokAdedi: number; bugunSatis: number; bugunSatisSayisi: number };
type Hesap = { ad: string; email: string; sifre: string };

export function SubelerIstemci() {
  const router = useRouter();
  const bildir = useToast();
  const [liste, setListe] = useState<Sube[] | null>(null);
  const [yeniAcik, setYeniAcik] = useState(false);
  const [duzenle, setDuzenle] = useState<Sube | null>(null);
  const [silinecek, setSilinecek] = useState<Sube | null>(null);
  const [pasifle, setPasifle] = useState<Sube | null>(null);

  const yukle = useCallback(async () => {
    try {
      setListe((await api<{ subeler: Sube[] }>("/api/subeler")).subeler);
    } catch (e) {
      bildir((e as Error).message, "hata");
      setListe([]);
    }
  }, [bildir]);
  useEffect(() => { void yukle(); }, [yukle]);

  function panelineGec(s: Sube) {
    document.cookie = `iq_sube=${s.id}; path=/; max-age=31536000; samesite=lax`;
    router.push("/");
    router.refresh();
  }

  if (!liste) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Iskelet key={i} className="h-56" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Buton onClick={() => setYeniAcik(true)}><Plus className="size-4" /> Yeni şube</Buton>
      </div>

      {liste.length === 0 ? (
        <Kart>
          <BosDurum ikon={<Store className="size-6" />} baslik="Henüz şube yok" aciklama="İlk şubenizi oluşturun. Şubeyle birlikte müdür hesabı da açabilirsiniz; müdür kendi paneline girip satış ve stok işlemlerini yapar." aksiyon={<Buton onClick={() => setYeniAcik(true)}><Plus className="size-4" /> İlk şubeyi oluştur</Buton>} />
        </Kart>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {liste.map((s) => (
            <Kart key={s.id} className={`anim-yukari flex flex-col p-5 ${s.aktif ? "" : "opacity-70"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-xl font-semibold">{s.ad}</h2>
                  <p className="text-xs text-muted">Kod: <b className="tabular">{s.kod}</b></p>
                </div>
                <span className="flex shrink-0 gap-1.5">{s.ana && <Rozet ton="vurgu">Ana şube</Rozet>}<Rozet ton={s.aktif ? "ok" : "nötr"}>{s.aktif ? "Aktif" : "Pasif"}</Rozet></span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-muted">
                {s.adres && <p className="flex items-center gap-2"><MapPin className="size-3.5 shrink-0" /> {s.adres}</p>}
                {s.telefon && <p className="flex items-center gap-2"><Phone className="size-3.5 shrink-0" /> {s.telefon}</p>}
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Mini et="Bugün" de={paraFormat(s.bugunSatis)} alt={`${s.bugunSatisSayisi} satış`} />
                <Mini et="Stok" de={sayiFormat(s.stokAdedi)} alt="adet" />
                <Mini et="Kullanıcı" de={String(s.kullaniciSayisi)} alt="hesap" />
              </dl>
              {s.kullaniciSayisi === 0 && s.aktif && (
                <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">Bu şubede hesap yok. <a href="/kullanicilar" className="font-medium underline">Kullanıcı ekleyin</a> ki giriş yapabilsinler.</p>
              )}
              {s.stokAdedi === 0 && s.aktif && (
                <p className="mt-2 rounded-xl bg-info-soft px-3 py-2 text-xs text-info">Stok boş. <a href="/transferler" className="font-medium underline">Transfer</a> ile ürün gönderin ya da şube müdürü <b>Mal Kabul</b> yapsın.</p>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {s.aktif && <Buton kucuk onClick={() => panelineGec(s)}><ExternalLink className="size-4" /> Paneline geç</Buton>}
                <Buton kucuk varyant="ikincil" onClick={() => setDuzenle(s)}><Pencil className="size-4" /> Düzenle</Buton>
                {!s.ana && <Buton kucuk varyant="hayalet" onClick={() => (s.aktif ? setPasifle(s) : void durumDegistir(s, true))} aria-label={s.aktif ? "Pasife al" : "Aktif et"}><Power className="size-4" /> {s.aktif ? "Pasife al" : "Aktif et"}</Buton>}
                {!s.ana && <Buton kucuk varyant="hayalet" className="text-danger" onClick={() => setSilinecek(s)} aria-label="Sil"><Trash2 className="size-4" /></Buton>}
              </div>
            </Kart>
          ))}
        </div>
      )}

      <Kart className="p-5">
        <h3 className="mb-3 font-display text-lg font-semibold">Şubeler nasıl çalışır?</h3>
        <ul className="grid gap-3 text-sm text-muted sm:grid-cols-2">
          <li className="flex gap-3"><Boxes className="mt-0.5 size-5 shrink-0 text-accent" /><span><b className="text-foreground">Ürün kataloğu ortak, stok şubeye özel.</b> Bir ürün kartı bir kez açılır; her şubenin kendi adedi tutulur.</span></li>
          <li className="flex gap-3"><Users className="mt-0.5 size-5 shrink-0 text-accent" /><span><b className="text-foreground">Müdür yalnızca kendi şubesini görür.</b> Başka şubenin satış, stok ve raporlarına erişemez.</span></li>
          <li className="flex gap-3"><ArrowRightLeft className="mt-0.5 size-5 shrink-0 text-accent" /><span><b className="text-foreground">Şubeler arası ürün aktarımı Transfer ile</b> yapılır: gönderen "Gönder", alan "Teslim al" der; stok iki tarafta da otomatik güncellenir.</span></li>
          <li className="flex gap-3"><Power className="mt-0.5 size-5 shrink-0 text-accent" /><span><b className="text-foreground">Pasife alınan şubenin hesapları anında kapanır.</b> Geçmiş kayıtlar silinmez, istediğiniz an tekrar açabilirsiniz.</span></li>
        </ul>
      </Kart>

      <YeniSubeModal acik={yeniAcik} kapat={() => setYeniAcik(false)} bitti={yukle} />
      <DuzenleModal sube={duzenle} kapat={() => setDuzenle(null)} bitti={yukle} />
      <OnayModal acik={!!pasifle} kapat={() => setPasifle(null)} baslik="Şubeyi pasife al" onayMetni="Pasife al" tehlikeli
        mesaj={<>“{pasifle?.ad}” pasife alınırsa bu şubenin tüm kullanıcılarının oturumu hemen kapanır ve giriş yapamazlar. Stok ve geçmiş korunur; istediğiniz zaman tekrar aktif edebilirsiniz.</>}
        calistir={async () => { if (pasifle) await durumDegistir(pasifle, false); }} />
      <OnayModal acik={!!silinecek} kapat={() => setSilinecek(null)} baslik="Şubeyi sil" onayMetni="Kalıcı sil" tehlikeli
        mesaj={<>“{silinecek?.ad}” kalıcı olarak silinecek. Stok veya satış geçmişi olan şubeler silinemez; onları pasife alın.</>}
        calistir={async () => {
          try {
            await api(`/api/subeler/${silinecek!.id}`, { method: "DELETE" });
            bildir("Şube silindi");
            await yukle();
          } catch (e) { bildir((e as Error).message, "hata"); throw e; }
        }} />
    </div>
  );

  async function durumDegistir(s: Sube, aktif: boolean) {
    try {
      await api(`/api/subeler/${s.id}`, { method: "PATCH", govde: { aktif } });
      bildir(aktif ? "Şube aktif edildi" : "Şube pasife alındı");
      await yukle();
    } catch (e) { bildir((e as Error).message, "hata"); throw e; }
  }
}

function Mini({ et, de, alt }: { et: string; de: string; alt: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{et}</dt>
      <dd className="tabular mt-0.5 truncate text-sm font-semibold">{de}</dd>
      <dd className="text-[11px] text-muted">{alt}</dd>
    </div>
  );
}

function YeniSubeModal({ acik, kapat, bitti }: { acik: boolean; kapat: () => void; bitti: () => void }) {
  const bildir = useToast();
  const [ad, setAd] = useState("");
  const [adres, setAdres] = useState("");
  const [telefon, setTelefon] = useState("");
  const [mudurIste, setMudurIste] = useState(true);
  const [mudurAd, setMudurAd] = useState("");
  const [mudurEmail, setMudurEmail] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [hesap, setHesap] = useState<Hesap | null>(null);

  function sifirla() {
    setAd(""); setAdres(""); setTelefon(""); setMudurIste(true); setMudurAd(""); setMudurEmail(""); setHata(null); setHesap(null);
  }
  function kapatTemiz() { kapat(); setTimeout(sifirla, 200); }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setYukleniyor(true);
    try {
      const r = await api<{ hesap: Hesap | null }>("/api/subeler", {
        govde: { ad, adres: adres || null, telefon: telefon || null, ...(mudurIste ? { mudur: { ad: mudurAd, email: mudurEmail } } : {}) },
      });
      bildir("Şube oluşturuldu");
      bitti();
      if (r.hesap) setHesap(r.hesap);
      else kapatTemiz();
    } catch (er) {
      setHata((er as Error).message);
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <Modal acik={acik} kapat={kapatTemiz} baslik={hesap ? "Şube hazır" : "Yeni şube"}>
      {hesap ? (
        <div className="space-y-4">
          <HesapKarti ad={hesap.ad} email={hesap.email} sifre={hesap.sifre} baslik="Müdür hesabı oluşturuldu" />
          <div className="rounded-xl bg-surface-2 p-4 text-sm text-muted">
            <p className="mb-1 font-medium text-foreground">Sıradaki adımlar</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Giriş bilgilerini şube müdürüne iletin (WhatsApp butonu hazır).</li>
              <li>Şubeye ürün göndermek için <b>Transferler</b>, doğrudan stok girmek için müdür <b>Mal Kabul</b> sayfasını kullanır.</li>
              <li>Kasiyer gerekiyorsa <b>Kullanıcılar</b> sayfasından ekleyin.</li>
            </ol>
          </div>
          <div className="flex justify-end"><Buton onClick={kapatTemiz}>Tamam</Buton></div>
        </div>
      ) : (
        <form onSubmit={gonder} className="space-y-4">
          <Alan etiket="Şube adı" hata={null}><Girdi value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Örn: Kadıköy Şubesi" required autoFocus /></Alan>
          <div className="grid gap-4 sm:grid-cols-2">
            <Alan etiket="Telefon"><Girdi value={telefon} onChange={(e) => setTelefon(e.target.value)} inputMode="tel" placeholder="0212 000 00 00" /></Alan>
            <Alan etiket="Adres"><Girdi value={adres} onChange={(e) => setAdres(e.target.value)} placeholder="Mahalle, ilçe" /></Alan>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
            <input type="checkbox" checked={mudurIste} onChange={(e) => setMudurIste(e.target.checked)} className="mt-1 size-4 accent-[var(--accent)]" />
            <span className="text-sm"><b>Şube müdürü hesabı da oluştur</b><span className="block text-muted">Şifre otomatik üretilir; müdür ilk girişte kendi şifresini belirler.</span></span>
          </label>
          {mudurIste && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Alan etiket="Müdür adı soyadı"><Girdi value={mudurAd} onChange={(e) => setMudurAd(e.target.value)} required autoComplete="off" /></Alan>
              <Alan etiket="Müdür e-posta (giriş adı)"><Girdi type="email" value={mudurEmail} onChange={(e) => setMudurEmail(e.target.value)} required autoComplete="off" placeholder="mudur@ornek.com" /></Alan>
            </div>
          )}
          {hata && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{hata}</div>}
          <div className="flex justify-end gap-2">
            <Buton type="button" varyant="ikincil" onClick={kapatTemiz}>Vazgeç</Buton>
            <Buton type="submit" yukleniyor={yukleniyor}>Şubeyi oluştur</Buton>
          </div>
        </form>
      )}
    </Modal>
  );
}

function DuzenleModal({ sube, kapat, bitti }: { sube: Sube | null; kapat: () => void; bitti: () => void }) {
  const bildir = useToast();
  const [ad, setAd] = useState("");
  const [adres, setAdres] = useState("");
  const [telefon, setTelefon] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  useEffect(() => {
    setAd(sube?.ad ?? ""); setAdres(sube?.adres ?? ""); setTelefon(sube?.telefon ?? ""); setHata(null);
  }, [sube]);
  return (
    <Modal acik={!!sube} kapat={kapat} baslik="Şubeyi düzenle">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setYukleniyor(true);
        try {
          await api(`/api/subeler/${sube!.id}`, { method: "PATCH", govde: { ad, adres: adres || null, telefon: telefon || null } });
          bildir("Şube güncellendi");
          bitti();
          kapat();
        } catch (er) { setHata((er as Error).message); } finally { setYukleniyor(false); }
      }}>
        <Alan etiket="Şube adı"><Girdi value={ad} onChange={(e) => setAd(e.target.value)} required /></Alan>
        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Telefon"><Girdi value={telefon} onChange={(e) => setTelefon(e.target.value)} inputMode="tel" /></Alan>
          <Alan etiket="Adres"><Girdi value={adres} onChange={(e) => setAdres(e.target.value)} /></Alan>
        </div>
        <p className="text-xs text-muted">Şube kodu ({sube?.kod}) satış fişi numaralarında kullanıldığı için değiştirilemez.</p>
        {hata && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{hata}</div>}
        <div className="flex justify-end gap-2">
          <Buton type="button" varyant="ikincil" onClick={kapat}>Vazgeç</Buton>
          <Buton type="submit" yukleniyor={yukleniyor}>Kaydet</Buton>
        </div>
      </form>
    </Modal>
  );
}
