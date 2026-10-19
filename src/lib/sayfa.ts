import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Rol } from "@/generated/prisma/client";
import { mevcutKullanici } from "./auth";
import { SUBE_COOKIE } from "./api";
import { acilisSayfasi } from "./menu";
import { islemSubesi, subeKapsami, type Oturumlu } from "./rbac";
import { gecerliSube } from "./subeSecimi";

/** Sayfa (server component) girisinde: oturum + rol kontrolu + sube kapsami */
export async function sayfaBaglami(...roller: Rol[]) {
  const k = await mevcutKullanici();
  if (!k) redirect("/giris");
  if (roller.length && !roller.includes(k.rol)) redirect(acilisSayfasi(k.rol));
  const ham = (await cookies()).get(SUBE_COOKIE)?.value;
  const secili = k.rol === "SUPER_ADMIN" ? await gecerliSube(ham) : ham;
  return {
    kullanici: k as Oturumlu,
    kapsam: subeKapsami(k, secili),
    islemSube: () => islemSubesi(k, secili),
  };
}
