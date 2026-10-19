import Link from "next/link";
import { cn } from "@/lib/cn";
import { DONEM_ADLARI } from "@/lib/donemSecimi";
import type { Donem } from "@/lib/tarih";

/** Sunucuda çizilen dönem seçici (bugün / hafta / ay / yıl / özel). Sayfa adresine göre bağlantı üretir. */
export function DonemSecici({ yol, donem, bas, bit, ekstra = {} }: { yol: string; donem: Donem; bas?: string; bit?: string; ekstra?: Record<string, string | undefined> }) {
  const url = (d: Donem) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(ekstra)) if (v) p.set(k, v);
    p.set("donem", d);
    return `${yol}?${p}`;
  };
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1" aria-label="Dönem">
        {(["bugun", "hafta", "ay", "yil"] as Donem[]).map((d) => (
          <Link key={d} href={url(d)} aria-current={donem === d ? "true" : undefined} className={cn("rounded-lg px-3.5 py-2 text-sm font-medium transition", donem === d ? "bg-foreground text-background" : "text-muted hover:text-foreground")}>{DONEM_ADLARI[d]}</Link>
        ))}
      </nav>
      <form action={yol} className="flex flex-wrap items-end gap-2">
        {Object.entries(ekstra).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <input type="hidden" name="donem" value="ozel" />
        <label className="text-xs text-muted">Başlangıç<input type="date" name="bas" defaultValue={bas} required className="mt-1 block min-h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" /></label>
        <label className="text-xs text-muted">Bitiş<input type="date" name="bit" defaultValue={bit} required className="mt-1 block min-h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" /></label>
        <button className={cn("min-h-10 rounded-xl border px-4 text-sm font-medium", donem === "ozel" ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:bg-surface-2")}>Uygula</button>
      </form>
    </div>
  );
}
