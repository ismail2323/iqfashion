"use client";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const abone = (cb: () => void) => {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => o.disconnect();
};

export function TemaDegistirici({ className = "" }: { className?: string }) {
  const koyu = useSyncExternalStore(abone, () => document.documentElement.classList.contains("dark"), () => false);
  return (
    <button
      type="button"
      aria-label={koyu ? "Açık temaya geç" : "Koyu temaya geç"}
      onClick={() => {
        const yeni = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", yeni);
        try { localStorage.setItem("tema", yeni ? "dark" : "light"); } catch {}
      }}
      className={`grid size-10 place-items-center rounded-xl border border-border bg-surface text-foreground transition hover:bg-surface-2 ${className}`}
    >
      {koyu ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
