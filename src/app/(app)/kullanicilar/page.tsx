import { sayfaBaglami } from "@/lib/sayfa";
import { Baslik } from "@/components/ui";
import { KullanicilarIstemci } from "./KullanicilarIstemci";

export const metadata = { title: "Kullanıcılar" };

export default async function KullanicilarSayfasi() {
  const { kullanici } = await sayfaBaglami("SUPER_ADMIN");
  return (
    <>
      <Baslik baslik="Kullanıcılar" aciklama="Şube müdürü ve kasiyer hesapları açın, şifre sıfırlayın, erişimi yönetin." />
      <KullanicilarIstemci benimId={kullanici.id} />
    </>
  );
}
