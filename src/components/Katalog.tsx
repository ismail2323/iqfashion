"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/istemci";

export type KatalogVeri = { markalar: string[]; kategoriler: string[]; tedarikciler: string[]; subeler: { id: string; ad: string }[] };

export function useKatalog(): KatalogVeri {
  const [v, setV] = useState<KatalogVeri>({ markalar: [], kategoriler: [], tedarikciler: [], subeler: [] });
  useEffect(() => {
    let iptal = false;
    api<KatalogVeri>("/api/katalog").then((d) => !iptal && setV(d)).catch(() => {});
    return () => { iptal = true; };
  }, []);
  return v;
}

/** <input list="..."> için öneri listeleri */
export function KatalogListeleri({ k }: { k: KatalogVeri }) {
  return (
    <>
      <datalist id="dl-markalar">{k.markalar.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="dl-kategoriler">{k.kategoriler.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="dl-tedarikciler">{k.tedarikciler.map((m) => <option key={m} value={m} />)}</datalist>
    </>
  );
}