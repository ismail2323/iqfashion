"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LogOut, Menu, Store } from "lucide-react";
import type { Oturumlu } from "@/lib/rbac";
import { ROL_ADI } from "@/lib/rbac";
import { MENU, type MenuOgesi } from "@/lib/menu";
import { Logo, Modal, Secim, cn } from "@/components/ui";
import { TemaDegistirici } from "@/components/TemaDegistirici";

type Props = {
  kullanici: Oturumlu;
  subeler: { id: string; ad: string }[];
  seciliSube: string;
  subeAdi: string | null;
  kritik: number;
  children: React.ReactNode;
};

export function AppShell({ kullanici, subeler, seciliSube, subeAdi, kritik, children }: Props) {
  const yol = usePathname();
  const router = useRouter();
  const [menuAcik, setMenuAcik] = useState(false);

  const gruplar = useMemo(
    () => MENU.map((g) => ({ ...g, ogeler: g.ogeler.filter((o) => o.roller.includes(kullanici.rol)) })).filter((g) => g.ogeler.length),
    [kullanici.rol],
  );
  const tumOgeler = gruplar.flatMap((g) => g.ogeler);
  const aktif = (h: string) => {
    if (h === "/") return yol === "/";
    // en uzun eslesen href aktif sayilir (/urunler vs /urunler/yeni)
    const en = tumOgeler.filter((o) => yol === o.href || yol.startsWith(o.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
    return en?.href === h;
  };
  const mobilOgeler = tumOgeler.filter((o) => o.mobil).slice(0, 4);

  function subeDegistir(id: string) {
    document.cookie = `iq_sube=${id}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }
  async function cikis() {
    await fetch("/api/auth/cikis", { method: "POST" });
    router.replace("/giris");
    router.refresh();
  }

  const Nav = ({ o, mobil }: { o: MenuOgesi; mobil?: boolean }) => (
    <Link
      href={o.href}
      onClick={() => setMenuAcik(false)}
      aria-current={aktif(o.href) ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl text-sm font-medium transition",
        mobil ? "min-h-12 px-3" : "min-h-10 px-3",
        aktif(o.href) ? "bg-foreground text-background" : "text-muted hover:bg-surface-2 hover:text-foreground",
      )}
    >
      <o.ikon className="size-[18px] shrink-0" />
      {o.ad}
      {o.href === "/stok" && kritik > 0 && <span className="ml-auto rounded-full bg-danger px-2 py-0.5 text-[11px] font-semibold text-white" aria-label={` ürün kritik stokta`}>{kritik > 99 ? "99+" : kritik}</span>}
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Masaustu kenar cubugu */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
        <div className="border-b border-border px-5 py-5"><Logo className="h-12" /></div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Ana menü">
          {gruplar.map((g) => (
            <div key={g.baslik}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/80">{g.baslik}</p>
              <div className="space-y-0.5">{g.ogeler.map((o) => <Nav key={o.href} o={o} />)}</div>
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="mb-2 px-3">
            <p className="truncate text-sm font-medium">{kullanici.ad}</p>
            <p className="truncate text-xs text-muted">{ROL_ADI[kullanici.rol]}{subeAdi ? ` · ${subeAdi}` : ""}</p>
          </div>
          <button onClick={cikis} className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted transition hover:bg-danger-soft hover:text-danger">
            <LogOut className="size-[18px]" /> Çıkış yap
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Ust cubuk */}
        <header className="safe-t sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur lg:px-8">
          <div className="lg:hidden"><Logo className="h-9" /></div>
          <div className="ml-auto flex items-center gap-2">
            {kullanici.rol === "SUPER_ADMIN" && subeler.length > 1 ? (
              <label className="flex items-center gap-2">
                <Store className="hidden size-4 text-muted sm:block" aria-hidden />
                <span className="sr-only">Aktif şube</span>
                <Secim value={seciliSube || "hepsi"} onChange={(e) => subeDegistir(e.target.value)} className="min-h-10 w-44 py-0 sm:w-52" aria-label="Aktif şube">
                  <option value="hepsi">Tüm şubeler</option>
                  {subeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </Secim>
              </label>
            ) : (
              subeAdi && <span className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm sm:flex"><Store className="size-4 text-muted" />{subeAdi}</span>
            )}
            <TemaDegistirici />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[88rem] flex-1 px-4 pb-28 pt-6 lg:px-8 lg:pb-10">{children}</main>
      </div>

      {/* Mobil alt gezinme */}
      <nav aria-label="Hızlı gezinme" className="safe-b fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface/95 backdrop-blur lg:hidden">
        {mobilOgeler.map((o) => (
          <Link key={o.href} href={o.href} aria-current={aktif(o.href) ? "page" : undefined}
            className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", aktif(o.href) ? "text-foreground" : "text-muted")}>
            <span className="relative"><o.ikon className={cn("size-5", aktif(o.href) && "text-accent")} />{o.href === "/stok" && kritik > 0 && <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">{kritik > 99 ? "99+" : kritik}</span>}</span>
            {o.ad}
          </Link>
        ))}
        <button onClick={() => setMenuAcik(true)} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted">
          <Menu className="size-5" /> Menü
        </button>
      </nav>

      <Modal acik={menuAcik} kapat={() => setMenuAcik(false)} baslik="Menü">
        <div className="space-y-5">
          {gruplar.map((g) => (
            <div key={g.baslik}>
              <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/80">{g.baslik}</p>
              <div className="space-y-0.5">{g.ogeler.map((o) => <Nav key={o.href} o={o} mobil />)}</div>
            </div>
          ))}
          <div className="border-t border-border pt-3">
            <p className="px-1 text-sm font-medium">{kullanici.ad}</p>
            <p className="mb-2 px-1 text-xs text-muted">{ROL_ADI[kullanici.rol]}{subeAdi ? ` · ${subeAdi}` : ""}</p>
            <button onClick={cikis} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-danger hover:bg-danger-soft">
              <LogOut className="size-[18px]" /> Çıkış yap
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
