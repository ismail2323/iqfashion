"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, KeyRound, LogOut, Minus, Pencil, Plus, Power, Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Alan, BosDurum, Buton, Girdi, Iskelet, Kart, Modal, Rozet, Secim } from "@/components/ui";
import { HesapKarti } from "@/components/HesapKarti";
import { OnayModal } from "@/components/OnayModal";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/istemci";
import { ROL_ADI } from "@/lib/rbac";
import { tarihFormat } from "@/lib/tarih";

type Rol = "SUPER_ADMIN" | "SUBE_MUDURU" | "KASIYER";
type K = { id: string; ad: string; email: string; rol: Rol; aktif: boolean; subeId: string | null; subeAd: string | null; sonGiris: string | null; sifreDegistirmeli: boolean; acikOturum: number };
type Sube = { id: string; ad: string; aktif: boolean };
type Hesap = { ad: string; email: string; sifre: string };

const ROL_TON = { SUPER_ADMIN: "vurgu", SUBE_MUDURU: "bilgi", KASIYER: "nötr" } as const;

export function KullanicilarIstemci({ benimId }: { benimId: string }) {
  const bildir = useToast();
  const [liste, setListe] = useState<K[] | null>(null);
  const [subeler, setSubeler] = useState<Sube[]>([]);
  const [q, setQ] = useState("");
  const [rolF, setRolF] = useState("");
  const [yeni, setYeni] = useState(false);
  const [duzenle, setDuzenle] = useState<K | null>(null);
  const [sifirlanacak, setSifirlanacak] = useState<K | null>(null);
  const [hesap, setHesap] = useState<Hesap | null>(null);
  const [pasifle, setPasifle] = useState<K | null>(null);
  const [silinecek, setSilinecek] = useState<K | null>(null);

  const yukle = useCallback(async () => {
    try {
      const [k, s] = await Promise.all([api<{ kullanicilar: K[] }>("/api/kullanicilar"), api<{ subeler: Sube[] }>("/api/subeler")]);
      setListe(k.kullanicilar);
      setSubeler(s.subeler);
    } catch (e) {
      bildir((e as Error).message, "hata");
      setListe([]);
    }
  }, [bildir]);
  useEffect(() => { void yukle(); }, [yukle]);

  const gorunen = useMemo(() => {
    const t = q.trim().toLocaleLowerCase("tr-TR");
    return (liste ?? []).filter((k) => (!rolF || k.rol === rolF) && (!t || `${k.ad} ${k.email} ${k.subeAd ?? ""}`.toLocaleLowerCase("tr-TR").includes(t)));
  }, [liste, q, rolF]);

  async function durum(k: K, aktif: boolean) {
    try {
      await api(`/api/kullanicilar/${k.id}`, { method: "PATCH", govde: { aktif } });
      bildir(aktif ? "Hesap aktif edildi" : "Hesap pasife alındı");
      await yukle();
    } catch (e) { bildir((e as Error).message, "hata"); throw e; }
  }

  if (!liste) return <Iskelet className="h-96" />;

  return (
    <div className="space-y-5">
      <Kart className="flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Girdi value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad, e-posta veya şube ara…" className="pl-10" aria-label="Ara" />
        </div>
        <Secim value={rolF} onChange={(e) => setRolF(e.target.value)} className="w-44" aria-label="Rol filtresi">
          <option value="">Tüm roller</option>
          {(Object.keys(ROL_ADI) as Rol[]).map((r) => <option key={r} value={r}>{ROL_ADI[r]}</option>)}
        </Secim>
        <Buton onClick={() => setYeni(true)}><UserPlus className="size-4" /> Yeni kullanıcı</Buton>
      </Kart>

      {gorunen.length === 0 ? (
        <Kart><BosDurum ikon={<UserPlus className="size-6" />} baslik="Kullanıcı bulunamadı" aciklama="Filtreyi temizleyin ya da yeni bir hesap oluşturun." /></Kart>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {gorunen.map((k) => (
            <Kart key={k.id} className={`anim-yukari p-4 ${k.aktif ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{k.ad}{k.id === benimId && <span className="ml-1.5 text-xs text-muted">(siz)</span>}</p>
                  <p className="truncate text-sm text-muted">{k.email}</p>
                </div>
                <Rozet ton={ROL_TON[k.rol]}>{ROL_ADI[k.rol]}</Rozet>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{k.subeAd ?? "Tüm şubeler"}</span>
                <span>·</span>
                <span>{k.sonGiris ? `Son giriş ${tarihFormat(k.sonGiris, true)}` : "Henüz giriş yapmadı"}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {!k.aktif && <Rozet ton="tehlike">Pasif</Rozet>}
                {k.sifreDegistirmeli && <Rozet ton="uyari">İlk şifre bekleniyor</Rozet>}
                {k.acikOturum > 0 && <Rozet ton="ok">{k.acikOturum} açık oturum</Rozet>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Buton kucuk varyant="ikincil" onClick={() => setDuzenle(k)}><Pencil className="size-4" /> Düzenle</Buton>
                <Buton kucuk varyant="ikincil" onClick={() => setSifirlanacak(k)}><KeyRound className="size-4" /> Şifre sıfırla</Buton>
                {k.acikOturum > 0 && k.id !== benimId && (
                  <Buton kucuk varyant="hayalet" onClick={async () => { try { await api(`/api/kullanicilar/${k.id}/oturumlari-kapat`, { method: "POST", govde: {} }); bildir("Oturumlar kapatıldı"); await yukle(); } catch (e) { bildir((e as Error).message, "hata"); } }}><LogOut className="size-4" /> Oturumu kapat</Buton>
                )}
                {k.id !== benimId && (
                  <Buton kucuk varyant="hayalet" onClick={() => (k.aktif ? setPasifle(k) : void durum(k, true))}><Power className="size-4" /> {k.aktif ? "Pasife al" : "Aktif et"}</Buton>
                )}
                {k.id !== benimId && (
                  <Buton kucuk varyant="hayalet" className="text-danger" onClick={() => setSilinecek(k)} aria-label={`${k.ad} hesabını sil`}><Trash2 className="size-4" /> Sil</Buton>
                )}
              </div>
            </Kart>
          ))}
        </div>
      )}

      <YetkiTablosu />

      <YeniModal acik={yeni} kapat={() => setYeni(false)} subeler={subeler.filter((s) => s.aktif)} bitti={async (h) => { setHesap(h); await yukle(); }} />
      <DuzenleModal k={duzenle} kapat={() => setDuzenle(null)} subeler={subeler.filter((s) => s.aktif)} bitti={yukle} />
      <OnayModal acik={!!sifirlanacak} kapat={() => setSifirlanacak(null)} baslik="Şifreyi sıfırla" onayMetni="Yeni şifre üret"
        mesaj={<>“{sifirlanacak?.ad}” için yeni geçici şifre üretilecek. Eski şifre geçersiz olur ve tüm açık oturumları kapanır. Kullanıcı ilk girişte kendi şifresini belirler.</>}
        calistir={async () => {
          try {
            const r = await api<{ hesap: Hesap }>(`/api/kullanicilar/${sifirlanacak!.id}/sifre-sifirla`, { method: "POST", govde: {} });
            setHesap(r.hesap);
            await yukle();
          } catch (e) { bildir((e as Error).message, "hata"); throw e; }
        }} />
      <OnayModal acik={!!pasifle} kapat={() => setPasifle(null)} baslik="Hesabı pasife al" onayMetni="Pasife al" tehlikeli
        mesaj={<>“{pasifle?.ad}” artık giriş yapamaz ve açık oturumları hemen kapanır. Geçmiş kayıtları korunur; istediğiniz zaman tekrar aktif edebilirsiniz.</>}
        calistir={async () => { if (pasifle) await durum(pasifle, false); }} />
      <OnayModal acik={!!silinecek} kapat={() => setSilinecek(null)} baslik="Kullanıcıyı sil" onayMetni="Kalıcı sil" tehlikeli
        mesaj={<>“{silinecek?.ad}” ({silinecek?.email}) hesabı <b>kalıcı olarak silinecek</b> ve bir daha giriş yapamayacak. Geçmiş satış ve hareket kayıtlarında adı kalır. Geçici olarak engellemek istiyorsanız “Pasife al”ı kullanın.</>}
        calistir={async () => {
          try { await api(`/api/kullanicilar/${silinecek!.id}`, { method: "DELETE" }); bildir("Kullanıcı silindi"); await yukle(); } catch (e) { bildir((e as Error).message, "hata"); throw e; }
        }} />
      <Modal acik={!!hesap} kapat={() => setHesap(null)} baslik="Giriş bilgileri">
        {hesap && <div className="space-y-4"><HesapKarti ad={hesap.ad} email={hesap.email} sifre={hesap.sifre} /><div className="flex justify-end"><Buton onClick={() => setHesap(null)}>Tamam</Buton></div></div>}
      </Modal>
    </div>
  );
}

function YetkiTablosu() {
  const Evet = () => <Check className="mx-auto size-4 text-ok" aria-label="Evet" />;
  const Hayir = () => <Minus className="mx-auto size-4 text-muted/60" aria-label="Hayır" />;
  const satirlar: [string, boolean, boolean, boolean][] = [
    ["Satış yapma, barkodla sepet", true, true, true],
    ["Stok ve ürün görüntüleme", true, true, true],
    ["Alış fiyatı / kâr bilgisini görme", true, true, false],
    ["İndirim ve fiyat değiştirerek satış", true, true, false],
    ["Satış iptali ve iade", true, true, false],
    ["Mal kabul, ürün ekleme (AI), stok sayımı", true, true, false],
    ["Transfer gönderme / teslim alma", true, true, false],
    ["Gider-gelir kaydı, raporlar, PDF", true, true, false],
    ["Ürün fiyat listesini değiştirme", true, false, false],
    ["Tüm şubeleri görme ve karşılaştırma", true, false, false],
    ["Şube ve kullanıcı yönetimi", true, false, false],
    ["İstatistik / fabrika sıfırlama, denetim kaydı", true, false, false],
  ];
  return (
    <Kart className="overflow-hidden">
      <details>
        <summary className="flex cursor-pointer select-none items-center gap-2 px-5 py-4 font-display text-lg font-semibold"><ShieldCheck className="size-5 text-accent" /> Rol yetkileri</summary>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-5 py-2.5 text-left font-medium">Yetki</th><th className="px-3 py-2.5 font-medium">Süper Admin</th><th className="px-3 py-2.5 font-medium">Şube Müdürü</th><th className="px-3 py-2.5 font-medium">Kasiyer</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {satirlar.map(([ad, a, b, c]) => (
                <tr key={ad}><td className="px-5 py-2.5">{ad}</td><td className="px-3">{a ? <Evet /> : <Hayir />}</td><td className="px-3">{b ? <Evet /> : <Hayir />}</td><td className="px-3">{c ? <Evet /> : <Hayir />}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-muted">Şube müdürü ve kasiyer yalnızca kendi şubesinin verisini görür. Bu kural sunucuda zorlanır; ekranlar gizlense bile başka şubenin verisine erişilemez.</p>
      </details>
    </Kart>
  );
}

function YeniModal({ acik, kapat, subeler, bitti }: { acik: boolean; kapat: () => void; subeler: Sube[]; bitti: (h: Hesap) => void }) {
  const bildir = useToast();
  const [ad, setAd] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("KASIYER");
  const [subeId, setSubeId] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const subeli = rol !== "SUPER_ADMIN";
  return (
    <Modal acik={acik} kapat={kapat} baslik="Yeni kullanıcı">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setHata(null);
        setYukleniyor(true);
        try {
          const r = await api<{ hesap: Hesap }>("/api/kullanicilar", { govde: { ad, email, rol, subeId: subeli ? subeId || null : null } });
          bildir("Hesap oluşturuldu");
          setAd(""); setEmail("");
          kapat();
          bitti(r.hesap);
        } catch (er) { setHata((er as Error).message); } finally { setYukleniyor(false); }
      }}>
        <Alan etiket="Ad soyad"><Girdi value={ad} onChange={(e) => setAd(e.target.value)} required autoFocus /></Alan>
        <Alan etiket="E-posta (giriş adı)"><Girdi type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" /></Alan>
        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Rol">
            <Secim value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
              <option value="KASIYER">Kasiyer</option>
              <option value="SUBE_MUDURU">Şube Müdürü</option>
              <option value="SUPER_ADMIN">Süper Admin</option>
            </Secim>
          </Alan>
          {subeli && (
            <Alan etiket="Şube">
              <Secim value={subeId} onChange={(e) => setSubeId(e.target.value)} required>
                <option value="">Şube seçin…</option>
                {subeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
              </Secim>
            </Alan>
          )}
        </div>
        {rol === "SUPER_ADMIN" && <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">Süper admin tüm şubeleri ve ayarları yönetir. Yalnızca güvendiğiniz kişiye verin.</p>}
        <p className="text-xs text-muted">Güvenli bir geçici şifre otomatik üretilir ve bir sonraki adımda gösterilir.</p>
        {hata && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{hata}</div>}
        <div className="flex justify-end gap-2"><Buton type="button" varyant="ikincil" onClick={kapat}>Vazgeç</Buton><Buton type="submit" yukleniyor={yukleniyor}><Plus className="size-4" /> Hesabı oluştur</Buton></div>
      </form>
    </Modal>
  );
}

function DuzenleModal({ k, kapat, subeler, bitti }: { k: K | null; kapat: () => void; subeler: Sube[]; bitti: () => void }) {
  const bildir = useToast();
  const [ad, setAd] = useState("");
  const [rol, setRol] = useState<Rol>("KASIYER");
  const [subeId, setSubeId] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  useEffect(() => { if (k) { setAd(k.ad); setRol(k.rol); setSubeId(k.subeId ?? ""); setHata(null); } }, [k]);
  return (
    <Modal acik={!!k} kapat={kapat} baslik="Kullanıcıyı düzenle">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setYukleniyor(true);
        try {
          await api(`/api/kullanicilar/${k!.id}`, { method: "PATCH", govde: { ad, rol, subeId: rol === "SUPER_ADMIN" ? null : subeId } });
          bildir("Kullanıcı güncellendi");
          bitti();
          kapat();
        } catch (er) { setHata((er as Error).message); } finally { setYukleniyor(false); }
      }}>
        <Alan etiket="Ad soyad"><Girdi value={ad} onChange={(e) => setAd(e.target.value)} required /></Alan>
        <p className="text-sm text-muted">E-posta: <b className="text-foreground">{k?.email}</b></p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Rol"><Secim value={rol} onChange={(e) => setRol(e.target.value as Rol)}><option value="KASIYER">Kasiyer</option><option value="SUBE_MUDURU">Şube Müdürü</option><option value="SUPER_ADMIN">Süper Admin</option></Secim></Alan>
          {rol !== "SUPER_ADMIN" && (
            <Alan etiket="Şube"><Secim value={subeId} onChange={(e) => setSubeId(e.target.value)} required><option value="">Şube seçin…</option>{subeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}</Secim></Alan>
          )}
        </div>
        <p className="text-xs text-muted">Rol veya şube değişirse kullanıcının açık oturumları kapanır; yeni yetkiyle tekrar giriş yapar.</p>
        {hata && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{hata}</div>}
        <div className="flex justify-end gap-2"><Buton type="button" varyant="ikincil" onClick={kapat}>Vazgeç</Buton><Buton type="submit" yukleniyor={yukleniyor}>Kaydet</Buton></div>
      </form>
    </Modal>
  );
}
