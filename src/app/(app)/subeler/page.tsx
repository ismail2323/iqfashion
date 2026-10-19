import { sayfaBaglami } from "@/lib/sayfa";
import { Baslik } from "@/components/ui";
import { SubelerIstemci } from "./SubelerIstemci";

export const metadata = { title: "Şubeler" };

export default async function SubelerSayfasi() {
  await sayfaBaglami("SUPER_ADMIN");
  return (
    <>
      <Baslik baslik="Şubeler" aciklama="Yeni şube açın, her şube için müdür hesabı oluşturun ve şubelerin durumunu izleyin." />
      <SubelerIstemci />
    </>
  );
}
