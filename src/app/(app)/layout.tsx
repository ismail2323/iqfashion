import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { mevcutKullanici } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SUBE_COOKIE } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { kritikSayisi } from "@/lib/rapor";
import { aktifSubeler, seciliHesapla } from "@/lib/subeSecimi";
import { ToastSaglayici } from "@/components/Toast";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const k = await mevcutKullanici();
  if (!k) redirect("/giris");
  if (k.sifreDegistirmeli) redirect("/sifre-degistir");
  const superAdmin = k.rol === "SUPER_ADMIN";
  // Bağımsız sorgular paralel (her biri bir veritabanı gidiş-dönüşü)
  const [subeler, kendi, cerezler] = await Promise.all([
    superAdmin ? aktifSubeler() : Promise.resolve([]),
    k.subeId ? prisma.sube.findUnique({ where: { id: k.subeId }, select: { ad: true } }) : Promise.resolve(null),
    cookies(),
  ]);
  const secili = superAdmin ? seciliHesapla(cerezler.get(SUBE_COOKIE)?.value, subeler.map((s) => s.id)) ?? "" : "";
  const kritik = k.rol === "KASIYER" ? 0 : await kritikSayisi(superAdmin ? secili || undefined : k.subeId ?? undefined);
  return (
    <ToastSaglayici>
      <AppShell kullanici={k} subeler={subeler} seciliSube={secili} subeAdi={kendi?.ad ?? subeler.find((s) => s.id === secili)?.ad ?? null} kritik={kritik}>
        {children}
      </AppShell>
    </ToastSaglayici>
  );
}