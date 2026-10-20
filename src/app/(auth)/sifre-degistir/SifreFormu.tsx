"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Lock, LogOut, ShieldCheck } from "lucide-react";
import { Buton, Girdi, Logo, cn } from "@/components/ui";
import { TemaDegistirici } from "@/components/TemaDegistirici";
import { api } from "@/lib/istemci";

export function SifreFormu({ ad, hedef }: { ad: string; hedef: string }) {
  const router = useRouter();
  const [mevcut, setMevcut] = useState("");
  const [yeni, setYeni] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [goster, setGoster] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  const kurallar = [
    { ok: yeni.length >= 8, et: "En az 8 karakter" },
    { ok: /[a-zA-Z]/.test(yeni) && /\d/.test(yeni), et: "Harf ve rakam içersin" },
    { ok: yeni.length > 0 && yeni === tekrar, et: "İki şifre aynı olsun" },
    { ok: yeni.length > 0 && yeni !== mevcut, et: "Geçici şifreden farklı olsun" },
  ];
  const hazir = kurallar.every((k) => k.ok) && mevcut.length > 0;

  async function cikis() {
    // Zorunlu şifre ekranında KİLİTLİ KALINMASIN: geçici şifre bilinmiyorsa veya başka hesapla girilecekse çıkılabilir
    await fetch("/api/auth/cikis", { method: "POST" }).catch(() => {});
    router.replace("/giris");
    router.refresh();
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setYukleniyor(true);
    try {
      await api("/api/auth/sifre", { govde: { mevcut, yeni } });
      router.replace(hedef);
      router.refresh();
    } catch (er) {
      setHata((er as Error).message);
      setYukleniyor(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="absolute right-5 top-5"><TemaDegistirici /></div>
      <div className="anim-yukari w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo className="h-20" /></div>
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-8">
          <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent"><ShieldCheck className="size-6" /></span>
          <h1 className="font-display text-2xl font-semibold">Hoş geldiniz, {ad.split(" ")[0]}</h1>
          <p className="mt-2 text-sm text-muted">Hesabınız yönetici tarafından açıldı. Güvenliğiniz için size verilen geçici şifreyi şimdi kendi şifrenizle değiştirin.</p>
          <form onSubmit={gonder} className="mt-6 space-y-4" noValidate>
            <Alanİ etiket="Geçici şifre (size iletilen)"><Girdi type={goster ? "text" : "password"} value={mevcut} onChange={(e) => setMevcut(e.target.value)} autoComplete="current-password" required className="pl-10" /></Alanİ>
            <Alanİ etiket="Yeni şifre">
              <Girdi type={goster ? "text" : "password"} value={yeni} onChange={(e) => setYeni(e.target.value)} autoComplete="new-password" required className="px-10" />
              <button type="button" onClick={() => setGoster((g) => !g)} aria-label={goster ? "Gizle" : "Göster"} className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-foreground">{goster ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}</button>
            </Alanİ>
            <Alanİ etiket="Yeni şifre (tekrar)"><Girdi type={goster ? "text" : "password"} value={tekrar} onChange={(e) => setTekrar(e.target.value)} autoComplete="new-password" required className="pl-10" /></Alanİ>
            <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
              {kurallar.map((k) => (
                <li key={k.et} className={cn("flex items-center gap-1.5", k.ok ? "text-ok" : "text-muted")}><Check className={cn("size-3.5", !k.ok && "opacity-30")} />{k.et}</li>
              ))}
            </ul>
            {hata && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{hata}</div>}
            <Buton type="submit" yukleniyor={yukleniyor} disabled={!hazir} className="w-full">Şifremi kaydet ve devam et</Buton>
            {!hazir && !yukleniyor && (
              <p className="text-center text-xs text-muted">
                {mevcut.length === 0 ? "Size iletilen geçici şifreyi yazın. " : ""}{kurallar.filter((k) => !k.ok).map((k) => k.et).join(" · ")}
              </p>
            )}
          </form>
          <button type="button" onClick={cikis} className="mx-auto mt-4 flex min-h-11 items-center gap-2 text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
            <LogOut className="size-4" /> Çıkış yap / başka hesapla giriş yap
          </button>
          <p className="mt-1 text-center text-xs text-muted">Geçici şifreyi bilmiyorsanız yöneticinizden yeni şifre isteyin.</p>
        </div>
      </div>
    </main>
  );
}

function Alanİ({ etiket, children }: { etiket: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{etiket}</span>
      <span className="relative block"><Lock className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />{children}</span>
    </label>
  );
}
