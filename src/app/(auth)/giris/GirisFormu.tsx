"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ScanBarcode, Store, TrendingUp, User } from "lucide-react";
import { Buton, Girdi, Logo, cn } from "@/components/ui";
import { TemaDegistirici } from "@/components/TemaDegistirici";

const OZELLIKLER = [
  { ikon: ScanBarcode, baslik: "Barkod ve yapay zeka ile hızlı ürün girişi" },
  { ikon: Store, baslik: "Tüm şubeler tek panelde, şube bazlı stok" },
  { ikon: TrendingUp, baslik: "Anlık satış, kâr ve stok istatistikleri" },
];

export function GirisFormu({ kurulum, devam }: { kurulum: boolean; devam: string }) {
  const router = useRouter();
  const [ad, setAd] = useState("");
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [goster, setGoster] = useState(false);
  const [hatirla, setHatirla] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    if (kurulum && sifre !== tekrar) return setHata("Şifreler eşleşmiyor");
    setYukleniyor(true);
    try {
      const r = await fetch(kurulum ? "/api/auth/kurulum" : "/api/auth/giris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kurulum ? { ad, email, sifre } : { email, sifre, benihatirla: hatirla }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setHata(d.hata ?? "Giriş yapılamadı");
        setYukleniyor(false);
        return;
      }
      router.replace(devam);
      router.refresh();
    } catch {
      setHata("Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.");
      setYukleniyor(false);
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Marka paneli */}
      <section className="relative hidden overflow-hidden bg-[#0b0b0c] text-[#f1eee8] lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(208,171,112,0.22),transparent)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-52 -left-32 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(208,171,112,0.12),transparent)]" />
        <div aria-hidden className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:56px_56px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-beyaz.png" alt="IQ Fashion" className="relative z-10 h-28 w-auto self-start" />
        <div className="relative z-10 max-w-lg anim-yukari">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.3em] text-[#d0ab70]">Yönetim Paneli</p>
          <h2 className="font-display text-5xl font-semibold leading-[1.1]">Marka dünyasına hoş geldiniz.</h2>
          <p className="mt-5 text-base leading-relaxed text-[#b5b0a5]">Stok, satış ve şubelerinizi tek yerden, mobilde de aynı rahatlıkla yönetin.</p>
          <ul className="mt-10 space-y-4">
            {OZELLIKLER.map(({ ikon: I, baslik }) => (
              <li key={baslik} className="flex items-center gap-4 text-sm text-[#d9d4c9]">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5"><I className="size-5 text-[#d0ab70]" /></span>
                {baslik}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-[#7d786e]">© {new Date().getFullYear()} IQ Fashion</p>
      </section>

      {/* Form */}
      <section className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex justify-end"><TemaDegistirici /></div>
        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-8 anim-yukari">
          <div className="mb-8 lg:hidden"><Logo className="h-20" /></div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{kurulum ? "İlk kurulum" : "Tekrar hoş geldiniz"}</h1>
          <p className="mt-2 text-sm text-muted">
            {kurulum ? "Süper admin hesabınızı oluşturarak sistemi başlatın." : "Devam etmek için hesabınızla giriş yapın."}
          </p>

          <form onSubmit={gonder} className="mt-8 space-y-4" noValidate>
            {kurulum && (
              <Kutu etiket="Ad Soyad" ikon={User}>
                <Girdi value={ad} onChange={(e) => setAd(e.target.value)} autoComplete="name" required className="pl-10" placeholder="Adınız Soyadınız" />
              </Kutu>
            )}
            <Kutu etiket="E-posta" ikon={Mail}>
              <Girdi type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus required className="pl-10" placeholder="ornek@iqfashion.com" />
            </Kutu>
            <Kutu etiket="Şifre" ikon={Lock}>
              <Girdi type={goster ? "text" : "password"} value={sifre} onChange={(e) => setSifre(e.target.value)} autoComplete={kurulum ? "new-password" : "current-password"} required className="px-10" placeholder="••••••••" />
              <button type="button" onClick={() => setGoster((g) => !g)} aria-label={goster ? "Şifreyi gizle" : "Şifreyi göster"} className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-foreground">
                {goster ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </Kutu>
            {kurulum && (
              <Kutu etiket="Şifre (tekrar)" ikon={Lock}>
                <Girdi type={goster ? "text" : "password"} value={tekrar} onChange={(e) => setTekrar(e.target.value)} autoComplete="new-password" required className="pl-10" placeholder="••••••••" />
              </Kutu>
            )}
            {kurulum && <p className="text-xs text-muted">En az 8 karakter, en az bir harf ve bir rakam içermeli.</p>}

            {!kurulum && (
              <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm">
                <input type="checkbox" checked={hatirla} onChange={(e) => setHatirla(e.target.checked)} className="size-4 accent-[var(--accent)]" />
                Beni hatırla (30 gün)
              </label>
            )}

            {hata && (
              <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{hata}</div>
            )}

            <Buton type="submit" yukleniyor={yukleniyor} className={cn("w-full")}>
              {kurulum ? "Hesabı oluştur" : "Giriş yap"}
              {!yukleniyor && <ArrowRight className="size-4" />}
            </Buton>
          </form>
        </div>
        <p className="text-center text-xs text-muted lg:hidden">© {new Date().getFullYear()} IQ Fashion</p>
      </section>
    </main>
  );
}

function Kutu({ etiket, ikon: I, children }: { etiket: string; ikon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{etiket}</span>
      <span className="relative block">
        <I className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
        {children}
      </span>
    </label>
  );
}
