import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { mevcutKullanici } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SUBE_COOKIE } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { kritikSayisi } from "@/lib/rapor";
import { gecerliSube } from "@/lib/subeSecimi";
import { ToastSaglayici } from "@/components/Toast";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const k = await mevcutKullanici();
  if (!k) redirect("/giris");
  if (k.sifreDegistirmeli) redirect("/sifre-degistir");
  const superAdmin = k.rol === "SUPER_ADMIN";
  const subeler = superAdmin
    ? await prisma.sube.findMany({ where: { aktif: true }, select: { id: true, ad: true }, orderBy: { ad: "asc" } })
    : [];
  const kendi = k.subeId ? await prisma.sube.findUnique({ where: { id: k.subeId }, select: { ad: true } }) : null;
  const secili = superAdmin ? (await gecerliSube((await cookies()).get(SUBE_COOKIE)?.value)) ?? "" : "";
  const kritik = k.rol === "KASIYER" ? 0 : await kritikSayisi(superAdmin ? secili || undefined : k.subeId ?? undefined);
  return (
    <ToastSaglayici>
    <AppShell kullanici={k} subeler={subeler} seciliSube={secili} subeAdi={kendi?.ad ?? null} kritik={kritik}>
      {children}
    </AppShell>
    </ToastSaglayici>
  );
}
