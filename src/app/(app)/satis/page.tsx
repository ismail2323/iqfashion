import { Store } from "lucide-react";
import { sayfaBaglami } from "@/lib/sayfa";
import { prisma } from "@/lib/db";
import { Baslik, Kart } from "@/components/ui";
import { SatisIstemci } from "./SatisIstemci";

export const metadata = { title: "Satış" };

export default async function SatisSayfasi() {
  const { kullanici, kapsam } = await sayfaBaglami();
  const sube = kapsam ? await prisma.sube.findUnique({ where: { id: kapsam }, select: { ad: true } }) : null;
  return (
    <>
      <Baslik baslik="Satış" aciklama={sube ? `${sube.ad} · barkod okutun ya da ürün arayın` : undefined} />
      {!kapsam ? (
        <Kart className="flex items-start gap-3 p-5 text-sm">
          <Store className="mt-0.5 size-5 shrink-0 text-warn" />
          <p>Satış bir şubede yapılır. Sayfanın üstündeki <b>“Tüm şubeler”</b> menüsünden şubeyi seçin.</p>
        </Kart>
      ) : (
        <SatisIstemci yonetici={kullanici.rol !== "KASIYER"} subeAdi={sube?.ad ?? ""} kasiyerAdi={kullanici.ad} />
      )}
    </>
  );
}
