import { sayfaBaglami } from "@/lib/sayfa";
import { prisma } from "@/lib/db";
import { aiHazirMi } from "@/lib/ai";
import { Baslik, Kart } from "@/components/ui";
import { Store } from "lucide-react";
import { UrunEkleIstemci } from "./UrunEkleIstemci";

export const metadata = { title: "Ürün Ekle" };

export default async function UrunEkleSayfasi() {
  const { kapsam } = await sayfaBaglami("SUPER_ADMIN", "SUBE_MUDURU");
  const sube = kapsam ? await prisma.sube.findUnique({ where: { id: kapsam }, select: { ad: true } }) : null;
  return (
    <>
      <Baslik baslik="Ürün Ekle" aciklama={sube ? `Stok ${sube.ad} şubesine girilecek.` : "Ürün girişi için bir şube seçin."} />
      {!kapsam ? (
        <Kart className="flex items-start gap-3 p-5 text-sm">
          <Store className="mt-0.5 size-5 shrink-0 text-warn" />
          <p>Stok bir şubeye girilir. Lütfen sayfanın üstündeki <b>“Tüm şubeler”</b> menüsünden ürünü ekleyeceğiniz şubeyi seçin.</p>
        </Kart>
      ) : (
        <UrunEkleIstemci aiHazir={aiHazirMi()} />
      )}
    </>
  );
}
