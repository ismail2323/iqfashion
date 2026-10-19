import { prisma } from "@/lib/db";
import { sayfaBaglami } from "@/lib/sayfa";
import { aiHazirMi } from "@/lib/ai";
import { sifirlamaNoktasi } from "@/lib/sifirlama";
import { ROL_ADI } from "@/lib/rbac";
import { Baslik, Kart, Rozet } from "@/components/ui";
import { AyarlarIstemci } from "./AyarlarIstemci";

export const metadata = { title: "Ayarlar" };

export default async function AyarlarSayfasi() {
  const { kullanici } = await sayfaBaglami();
  const superAdmin = kullanici.rol === "SUPER_ADMIN";
  const [dukkan, nokta] = await Promise.all([prisma.ayar.findUnique({ where: { anahtar: "dukkanAdi" } }), superAdmin ? sifirlamaNoktasi() : Promise.resolve(null)]);
  const groq = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || "").split(",").filter(Boolean).length;
  return (
    <>
      <Baslik baslik="Ayarlar" aciklama="Hesabınız ve sistem ayarları" />
      <Kart className="mb-5 flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-12 place-items-center rounded-full bg-accent-soft font-display text-xl text-accent">{kullanici.ad.charAt(0).toLocaleUpperCase("tr-TR")}</span>
        <div className="min-w-0"><p className="font-medium">{kullanici.ad}</p><p className="truncate text-sm text-muted">{kullanici.email}</p></div>
        <Rozet ton="vurgu">{ROL_ADI[kullanici.rol]}</Rozet>
      </Kart>
      <AyarlarIstemci
        superAdmin={superAdmin} dukkanAdi={dukkan?.deger ?? "IQ Fashion"} sifirlamaNoktasi={nokta?.toISOString() ?? null}
        ai={{ hazir: aiHazirMi(), groqAnahtar: groq, gemini: !!process.env.GEMINI_API_KEY, model: process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b" }}
      />
    </>
  );
}
