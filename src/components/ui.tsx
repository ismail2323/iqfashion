"use client";
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, X } from "lucide-react";

import { cn } from "@/lib/cn";
export { cn };

export function Logo({ className = "h-12", beyazKoyuda = true }: { className?: string; beyazKoyuda?: boolean }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="IQ Fashion" className={cn(className, "w-auto select-none", beyazKoyuda && "dark:hidden")} draggable={false} />
      {beyazKoyuda && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo-beyaz.png" alt="IQ Fashion" className={cn(className, "hidden w-auto select-none dark:block")} draggable={false} />
      )}
    </>
  );
}

export function Kart({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface shadow-[var(--shadow)]", className)} {...p}>
      {children}
    </div>
  );
}

export function Baslik({ baslik, aciklama, aksiyon }: { baslik: string; aciklama?: string; aksiyon?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{baslik}</h1>
        {aciklama && <p className="mt-1 text-sm text-muted">{aciklama}</p>}
      </div>
      {aksiyon && <div className="flex flex-wrap items-center gap-2">{aksiyon}</div>}
    </div>
  );
}

type BtnVar = "birincil" | "ikincil" | "tehlike" | "hayalet";
const BTN: Record<BtnVar, string> = {
  birincil: "bg-foreground text-background hover:opacity-90",
  ikincil: "border border-border bg-surface text-foreground hover:bg-surface-2",
  tehlike: "bg-danger text-white hover:opacity-90",
  hayalet: "text-foreground hover:bg-surface-2",
};

export const Buton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { varyant?: BtnVar; yukleniyor?: boolean; kucuk?: boolean }>(
  function Buton({ varyant = "birincil", yukleniyor, kucuk, className, children, disabled, ...p }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || yukleniyor}
        className={cn(
          "inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
          kucuk ? "min-h-9 px-3 text-sm" : "min-h-11 px-4 text-sm",
          BTN[varyant],
          className,
        )}
        {...p}
      >
        {yukleniyor && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);

const ALAN = "w-full min-h-11 rounded-xl border border-border bg-surface px-3.5 text-base md:text-sm text-foreground placeholder:text-muted/70 transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:opacity-60";

export const Girdi = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Girdi({ className, ...p }, ref) {
  return <input ref={ref} className={cn(ALAN, className)} {...p} />;
});

export const Secim = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Secim({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn(ALAN, "appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239b968c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>
      {children}
    </select>
  );
});

export const MetinAlani = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function MetinAlani({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(ALAN, "min-h-24 py-2.5", className)} {...p} />;
});

export function Alan({ etiket, hata, ipucu, children }: { etiket: string; hata?: string | null; ipucu?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{etiket}</span>
      {children}
      {ipucu && !hata && <span className="mt-1 block text-xs text-muted">{ipucu}</span>}
      {hata && <span role="alert" className="mt-1 block text-xs text-danger">{hata}</span>}
    </label>
  );
}

type Ton = "nötr" | "ok" | "uyari" | "tehlike" | "bilgi" | "vurgu";
const TON: Record<Ton, string> = {
  nötr: "bg-surface-2 text-muted",
  ok: "bg-ok-soft text-ok",
  uyari: "bg-warn-soft text-warn",
  tehlike: "bg-danger-soft text-danger",
  bilgi: "bg-info-soft text-info",
  vurgu: "bg-accent-soft text-accent",
};
export function Rozet({ ton = "nötr", children }: { ton?: Ton; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", TON[ton])}>{children}</span>;
}

export function BosDurum({ ikon, baslik, aciklama, aksiyon }: { ikon?: ReactNode; baslik: string; aciklama?: string; aksiyon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {ikon && <div className="mb-1 grid size-12 place-items-center rounded-full bg-surface-2 text-muted">{ikon}</div>}
      <p className="font-medium">{baslik}</p>
      {aciklama && <p className="max-w-sm text-sm text-muted">{aciklama}</p>}
      {aksiyon && <div className="mt-2">{aksiyon}</div>}
    </div>
  );
}

export function Modal({ acik, kapat, baslik, children, genis }: { acik: boolean; kapat: () => void; baslik: string; children: ReactNode; genis?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!acik) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && kapat();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [acik, kapat]);
  if (!acik) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && kapat()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={baslik}
        className={cn("anim-yukari flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-border bg-surface shadow-2xl outline-none sm:rounded-3xl", genis ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">{baslik}</h2>
          <button onClick={kapat} aria-label="Kapat" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2"><X className="size-5" /></button>
        </div>
        <div className="safe-b overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function StatKart({ etiket, deger, alt, ikon, ton = "nötr" }: { etiket: string; deger: string; alt?: ReactNode; ikon?: ReactNode; ton?: Ton }) {
  return (
    <Kart className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{etiket}</p>
        {ikon && <span className={cn("grid size-8 place-items-center rounded-lg", TON[ton])}>{ikon}</span>}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight">{deger}</p>
      {alt && <p className="mt-1 text-xs text-muted">{alt}</p>}
    </Kart>
  );
}

export function Iskelet({ className }: { className?: string }) {
  return <div className={cn("iskelet", className)} aria-hidden />;
}


