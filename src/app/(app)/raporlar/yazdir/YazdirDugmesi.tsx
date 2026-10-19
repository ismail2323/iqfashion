"use client";
import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Buton } from "@/components/ui";

export function YazdirDugmesi({ otomatik }: { otomatik: boolean }) {
  useEffect(() => {
    if (!otomatik) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [otomatik]);
  return <Buton onClick={() => window.print()}><Printer className="size-4" /> Yazdır / PDF olarak kaydet</Buton>;
}
