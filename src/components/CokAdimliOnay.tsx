"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Lock, ShieldAlert } from "lucide-react";
import { Buton, Girdi, Modal, cn } from "@/components/ui";
import { api } from "@/lib/istemci";

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");

/**
 * Yıkıcı işlemler için 3 adımlı onay:
 *  1) Ne olacağını oku ve "anlıyorum" kutusunu işaretle
 *  2) Onay cümlesini aynen yaz
 *  3) Hesap şifresini gir (sunucu da aynı üç şeyi ayrıca doğrular)
 */
export function CokAdimliOnay({ acik, kapat, baslik, bilgi, onayMetni, anladimMetni, butonMetni, uc, ekstra, bitti }: {
  acik: boolean; kapat: () => void; baslik: string; bilgi: React.ReactNode; onayMetni: string; anladimMetni: string; butonMetni: string; uc: string; ekstra?: Record<string, unknown>; bitti: () => void;
}) {
  const [adim, setAdim] = useState(1);
  const [anladim, setAnladim] = useState(false);
  const [yazi, setYazi] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => { if (acik) { setAdim(1); setAnladim(false); setYazi(""); setSifre(""); setHata(null); } }, [acik]);

  async function uygula() {
    setHata(null);
    setYukleniyor(true);
    try {
      await api(uc, { govde: { ...ekstra, anladim: true, onay: yazi, sifre } });
      kapat();
      bitti();
    } catch (e) { setHata((e as Error).message); } finally { setYukleniyor(false); }
  }

  const yaziDogru = norm(yazi) === norm(onayMetni);
  return (
    <Modal acik={acik} kapat={kapat} baslik={baslik}>
      <div className="space-y-4">
        <ol className="flex items-center gap-2" aria-label="Adımlar">
          {[1, 2, 3].map((n) => <li key={n} aria-current={adim === n ? "step" : undefined} className={cn("h-1.5 flex-1 rounded-full transition", n <= adim ? "bg-danger" : "bg-surface-2")} />)}
        </ol>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Adım {adim} / 3</p>

        {adim === 1 && (
          <>
            <div className="flex gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"><ShieldAlert className="mt-0.5 size-5 shrink-0" /><div className="space-y-2">{bilgi}</div></div>
            <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" checked={anladim} onChange={(e) => setAnladim(e.target.checked)} className="mt-0.5 size-4 accent-[var(--danger)]" />{anladimMetni}</label>
          </>
        )}
        {adim === 2 && (
          <>
            <p className="text-sm">Devam etmek için aşağıdaki cümleyi <b>aynen</b> yazın:</p>
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-center font-mono text-sm font-semibold tracking-wide select-none">{onayMetni}</p>
            <Girdi value={yazi} onChange={(e) => setYazi(e.target.value)} autoFocus autoComplete="off" spellCheck={false} aria-label="Onay cümlesi" placeholder="Cümleyi buraya yazın" />
            {yazi && !yaziDogru && <p className="text-xs text-muted">Henüz eşleşmiyor.</p>}
          </>
        )}
        {adim === 3 && (
          <>
            <p className="text-sm">Son adım: kimliğinizi doğrulamak için <b>hesap şifrenizi</b> girin.</p>
            <div className="relative"><Lock className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" /><Girdi type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} autoFocus autoComplete="current-password" className="pl-10" aria-label="Şifre" placeholder="Şifreniz" onKeyDown={(e) => { if (e.key === "Enter" && sifre) void uygula(); }} /></div>
          </>
        )}
        {hata && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{hata}</div>}

        <div className="flex justify-between gap-2">
          {adim > 1 ? <Buton varyant="ikincil" onClick={() => { setAdim(adim - 1); setHata(null); }}><ArrowLeft className="size-4" /> Geri</Buton> : <Buton varyant="ikincil" onClick={kapat}>Vazgeç</Buton>}
          {adim < 3 ? (
            <Buton onClick={() => setAdim(adim + 1)} disabled={adim === 1 ? !anladim : !yaziDogru}>İleri <ArrowRight className="size-4" /></Buton>
          ) : (
            <Buton varyant="tehlike" onClick={uygula} yukleniyor={yukleniyor} disabled={!sifre}>{butonMetni}</Buton>
          )}
        </div>
      </div>
    </Modal>
  );
}
