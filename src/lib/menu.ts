import { BarChart3, Boxes, ClipboardList, FileClock, LayoutDashboard, LifeBuoy, PackagePlus, Printer, Receipt, ScanLine, Settings, ShoppingBag, Store, Truck, Users, Wallet, type LucideIcon } from "lucide-react";
import type { Rol } from "@/generated/prisma/client";

export type MenuOgesi = { href: string; ad: string; ikon: LucideIcon; roller: Rol[]; mobil?: boolean };

const HEPSI: Rol[] = ["SUPER_ADMIN", "SUBE_MUDURU", "KASIYER"];
const YONETICI: Rol[] = ["SUPER_ADMIN", "SUBE_MUDURU"];
const ADMIN: Rol[] = ["SUPER_ADMIN"];

export const MENU: { baslik: string; ogeler: MenuOgesi[] }[] = [
  {
    baslik: "Genel",
    ogeler: [
      { href: "/", ad: "Panel", ikon: LayoutDashboard, roller: YONETICI, mobil: true },
      { href: "/satis", ad: "Satış", ikon: ShoppingBag, roller: HEPSI, mobil: true },
      { href: "/urunler", ad: "Ürünler", ikon: Boxes, roller: HEPSI, mobil: true },
      { href: "/stok", ad: "Stok", ikon: ClipboardList, roller: HEPSI, mobil: true },
    ],
  },
  {
    baslik: "Operasyon",
    ogeler: [
      { href: "/urunler/yeni", ad: "Ürün Ekle (AI)", ikon: PackagePlus, roller: YONETICI },
      { href: "/alis", ad: "Mal Kabul", ikon: Receipt, roller: YONETICI },
      { href: "/transferler", ad: "Transferler", ikon: Truck, roller: YONETICI },
      { href: "/etiketler", ad: "Etiket Yazdır", ikon: Printer, roller: YONETICI },
      { href: "/hareketler", ad: "Hareketler", ikon: ScanLine, roller: YONETICI },
    ],
  },
  {
    baslik: "Analiz",
    ogeler: [
      { href: "/raporlar", ad: "Raporlar", ikon: BarChart3, roller: YONETICI },
      { href: "/muhasebe", ad: "Muhasebe", ikon: Wallet, roller: YONETICI },
    ],
  },
  {
    baslik: "Yönetim",
    ogeler: [
      { href: "/subeler", ad: "Şubeler", ikon: Store, roller: ADMIN },
      { href: "/kullanicilar", ad: "Kullanıcılar", ikon: Users, roller: ADMIN },
      { href: "/denetim", ad: "Denetim Kaydı", ikon: FileClock, roller: ADMIN },
      { href: "/ayarlar", ad: "Ayarlar", ikon: Settings, roller: HEPSI },
      { href: "/yardim", ad: "Yardım", ikon: LifeBuoy, roller: HEPSI },
    ],
  },
];

/** Kullanici rolunun varsayilan acilis sayfasi (kasiyer panel goremez) */
export const acilisSayfasi = (rol: Rol) => (rol === "KASIYER" ? "/satis" : "/");

export function sayfaIzinli(yol: string, rol: Rol): boolean {
  const tum = MENU.flatMap((g) => g.ogeler).filter((o) => o.href !== "/");
  const eslesen = tum.filter((o) => yol === o.href || yol.startsWith(o.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
  if (yol === "/") return YONETICI.includes(rol);
  return eslesen ? eslesen.roller.includes(rol) : true;
}
