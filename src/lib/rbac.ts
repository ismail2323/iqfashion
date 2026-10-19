import { Rol } from "@/generated/prisma/client";

export type Oturumlu = {
  id: string;
  email: string;
  ad: string;
  rol: Rol;
  subeId: string | null;
  sifreDegistirmeli?: boolean;
};

export class YetkiHatasi extends Error {
  constructor(
    public durum: 401 | 403 | 404,
    mesaj: string,
  ) {
    super(mesaj);
  }
}

export const ROL_ADI: Record<Rol, string> = {
  SUPER_ADMIN: "Süper Admin",
  SUBE_MUDURU: "Şube Müdürü",
  KASIYER: "Kasiyer",
};

export const superAdminMi = (k: Oturumlu) => k.rol === "SUPER_ADMIN";

/** Alis fiyati/maliyet/kar bilgisini gorebilir mi? Kasiyer goremez. */
export const maliyetGorebilir = (k: Oturumlu) => k.rol !== "KASIYER";

export function rolGerekli(k: Oturumlu, ...roller: Rol[]) {
  if (!roller.includes(k.rol)) throw new YetkiHatasi(403, "Bu işlem için yetkiniz yok");
}

/**
 * Sorgularda kullanilacak sube kapsami. Super admin istedigi subeyi secebilir (undefined = hepsi);
 * diger roller HER ZAMAN kendi subesine kilitlidir, istemciden gelen deger yok sayilir.
 */
export function subeKapsami(k: Oturumlu, istenen?: string | null): string | undefined {
  if (k.rol === "SUPER_ADMIN") return istenen || undefined;
  if (!k.subeId) throw new YetkiHatasi(403, "Hesabınıza şube atanmamış");
  return k.subeId;
}

/** Tek bir sube uzerinde islem yapilacaksa (satis, alis, sayim) mutlaka bir sube gerekir. */
export function islemSubesi(k: Oturumlu, istenen?: string | null): string {
  const s = subeKapsami(k, istenen);
  if (!s) throw new YetkiHatasi(403, "Bu işlem için bir şube seçmelisiniz");
  return s;
}
