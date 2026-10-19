"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";

type Tip = "ok" | "hata" | "bilgi";
type Bildirim = { id: number; tip: Tip; mesaj: string };
const Ctx = createContext<(mesaj: string, tip?: Tip) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastSaglayici({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<Bildirim[]>([]);
  const sayac = useRef(0);
  const bildir = useCallback((mesaj: string, tip: Tip = "ok") => {
    const id = ++sayac.current;
    setListe((l) => [...l.slice(-3), { id, tip, mesaj }]);
    setTimeout(() => setListe((l) => l.filter((x) => x.id !== id)), tip === "hata" ? 6000 : 3500);
  }, []);
  const Ikon = { ok: CheckCircle2, hata: XCircle, bilgi: Info };
  const Renk = { ok: "text-ok", hata: "text-danger", bilgi: "text-info" };
  return (
    <Ctx.Provider value={bildir}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {liste.map((b) => {
          const I = Ikon[b.tip];
          return (
            <div key={b.id} role={b.tip === "hata" ? "alert" : "status"} className="anim-yukari pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-xl">
              <I className={`mt-0.5 size-5 shrink-0 ${Renk[b.tip]}`} />
              <span>{b.mesaj}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}