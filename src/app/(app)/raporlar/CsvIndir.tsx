"use client";
import { Download } from "lucide-react";

/** Tabloyu Excel'in doğru açtığı CSV olarak indirir (UTF-8 BOM + noktalı virgül). */
export function CsvIndir({ dosya, satirlar }: { dosya: string; satirlar: (string | number)[][] }) {
  function indir() {
    const hucre = (v: string | number) => {
      const s = typeof v === "number" ? String(v).replace(".", ",") : v;
      // Formül enjeksiyonuna karşı: = + - @ ile başlayan metinleri ' ile başlat
      const guvenli = typeof v === "string" && /^[=+\-@]/.test(s) ? `'${s}` : s;
      return /[;"\n]/.test(guvenli) ? `"${guvenli.replace(/"/g, '""')}"` : guvenli;
    };
    const csv = "﻿" + satirlar.map((r) => r.map(hucre).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dosya}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return <button onClick={indir} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-foreground"><Download className="size-3.5" /> CSV</button>;
}
