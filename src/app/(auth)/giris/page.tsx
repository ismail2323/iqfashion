import { redirect } from "next/navigation";
import { mevcutKullanici } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GirisFormu } from "./GirisFormu";

export const metadata = { title: "Giriş" };
export const dynamic = "force-dynamic";

export default async function GirisSayfasi({ searchParams }: { searchParams: Promise<{ devam?: string }> }) {
  if (await mevcutKullanici()) redirect("/");
  const kurulum = (await prisma.kullanici.count()) === 0;
  const { devam } = await searchParams;
  const guvenli = devam && devam.startsWith("/") && !devam.startsWith("//") ? devam : "/";
  return <GirisFormu kurulum={kurulum} devam={guvenli} />;
}
