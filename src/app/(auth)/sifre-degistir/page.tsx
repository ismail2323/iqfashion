import { redirect } from "next/navigation";
import { mevcutKullanici } from "@/lib/auth";
import { acilisSayfasi } from "@/lib/menu";
import { SifreFormu } from "./SifreFormu";

export const metadata = { title: "Şifre belirleyin" };
export const dynamic = "force-dynamic";

export default async function SifreDegistirSayfasi() {
  const k = await mevcutKullanici();
  if (!k) redirect("/giris");
  if (!k.sifreDegistirmeli) redirect(acilisSayfasi(k.rol));
  return <SifreFormu ad={k.ad} hedef={acilisSayfasi(k.rol)} />;
}
