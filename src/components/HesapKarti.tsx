"use client";
import { useState } from "react";
import { Check, Copy, Eye, EyeOff, MessageCircle, Printer } from "lucide-react";
import { Buton, Kart } from "@/components/ui";

async function kopyala(m: string) {
  try {
    await navigator.clipboard.writeText(m);
    return true;
  } catch {
    return false;
  }
}

/** Yeni/sıfırlanan hesabın giriş bilgisi. Şifre yalnızca burada bir kez gösterilir. */
export function HesapKarti({ ad, email, sifre, baslik = "Giriş bilgileri hazır" }: { ad: string; email: string; sifre: string; baslik?: string }) {
  const [goster, setGoster] = useState(true);
  const [kopya, setKopya] = useState<string | null>(null);
  const adres = typeof window !== "undefined" ? window.location.origin : "";
  const mesaj = `IQ Fashion panel giriş bilgileriniz\n\nAdres: ${adres}\nE-posta: ${email}\nGeçici şifre: ${sifre}\n\nİlk girişte kendi şifrenizi belirlemeniz istenecek.`;
  const k = async (anahtar: string, deger: string) => {
    if (await kopyala(deger)) {
      setKopya(anahtar);
      setTimeout(() => setKopya(null), 1800);
    }
  };
  return (
    <Kart className="yazdir border-accent/40 bg-accent-soft p-4">
      <p className="font-display text-lg font-semibold">{baslik}</p>
      <p className="mt-1 text-sm text-muted">Şifre güvenlik için <b>yalnızca şimdi</b> gösterilir. Kişiye iletin; ilk girişte değiştirmesi zorunlu olacak.</p>
      <dl className="mt-4 space-y-2 text-sm">
        <Satir et="Ad" de={ad} />
        <Satir et="E-posta" de={email} kopya={() => k("e", email)} kopyalandi={kopya === "e"} />
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
          <dt className="text-muted">Geçici şifre</dt>
          <dd className="flex items-center gap-1">
            <code className="tabular rounded-lg bg-surface-2 px-2 py-1 text-base font-semibold tracking-wider">{goster ? sifre : "••••••••••"}</code>
            <button onClick={() => setGoster((g) => !g)} aria-label={goster ? "Gizle" : "Göster"} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2">{goster ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
            <button onClick={() => k("s", sifre)} aria-label="Şifreyi kopyala" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2">{kopya === "s" ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}</button>
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <a href={`https://wa.me/?text=${encodeURIComponent(mesaj)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1f9d55] px-4 text-sm font-medium text-white hover:opacity-90"><MessageCircle className="size-4" /> WhatsApp ile gönder</a>
        <Buton varyant="ikincil" kucuk onClick={() => k("hepsi", mesaj)}>{kopya === "hepsi" ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />} Mesajı kopyala</Buton>
        <Buton varyant="ikincil" kucuk onClick={() => window.print()}><Printer className="size-4" /> Yazdır</Buton>
      </div>
    </Kart>
  );
}

function Satir({ et, de, kopya, kopyalandi }: { et: string; de: string; kopya?: () => void; kopyalandi?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
      <dt className="text-muted">{et}</dt>
      <dd className="flex min-w-0 items-center gap-1 font-medium">
        <span className="truncate">{de}</span>
        {kopya && <button onClick={kopya} aria-label={`${et} kopyala`} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2">{kopyalandi ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}</button>}
      </dd>
    </div>
  );
}