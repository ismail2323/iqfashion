"use client";
import dynamic from "next/dynamic";
import { Iskelet } from "@/components/ui";

// Recharts ağırdır; sayfa gövdesi çizildikten sonra ayrı paket olarak yüklenir (ilk boyama hızlanır).
const yer = (h: string) => function Yer() { return <Iskelet className={`${h} w-full rounded-xl`} />; };

export const TrendGrafik = dynamic(() => import("./Grafikler").then((m) => m.TrendGrafik), { ssr: false, loading: yer("h-72") });
export const PastaGrafik = dynamic(() => import("./Grafikler").then((m) => m.PastaGrafik), { ssr: false, loading: yer("h-48") });
export const CubukGrafik = dynamic(() => import("./Grafikler").then((m) => m.CubukGrafik), { ssr: false, loading: yer("h-48") });