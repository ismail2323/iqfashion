// Sube ve kullanici hesabi yonetimi (super admin). Istek baglamindan bagimsiz, testlenebilir.
import { prisma } from "./db";
import { IsHatasi } from "./hatalar";
import { rastgeleSifre, sifreHashle, sifreKurali } from "./sifre";
import type { Rol } from "@/generated/prisma/client";

/** Ana şube = en eski şube (Merkez). Silinemez ve pasife alınamaz. */
export async function anaSubeId(): Promise<string | null> {
  return (await prisma.sube.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ?? null;
}

export type HesapBilgisi = { email: string; ad: string; sifre: string };

/** "Merkez Mağaza" -> "MERKEZ", benzersiz değilse sayı eklenir */
export async function subeKoduUret(ad: string): Promise<string> {
  const taban =
    ad
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ı/g, "i")
      .replace(/İ/g, "I")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 6) || "SUBE";
  let kod = taban;
  for (let i = 2; await prisma.sube.findUnique({ where: { kod }, select: { id: true } }); i++) kod = `${taban}${i}`;
  return kod;
}

export async function kullaniciOlustur(g: { ad: string; email: string; rol: Rol; subeId?: string | null; sifre?: string }): Promise<HesapBilgisi & { id: string }> {
  const email = g.email.trim().toLowerCase();
  if (g.rol !== "SUPER_ADMIN" && !g.subeId) throw new IsHatasi("Şube müdürü ve kasiyer için şube seçmelisiniz");
  if (g.rol === "SUPER_ADMIN" && g.subeId) throw new IsHatasi("Süper admin bir şubeye bağlı olamaz");
  if (g.subeId) {
    const s = await prisma.sube.findUnique({ where: { id: g.subeId } });
    if (!s) throw new IsHatasi("Şube bulunamadı", 404);
    if (!s.aktif) throw new IsHatasi("Pasif şubeye kullanıcı eklenemez");
  }
  if (await prisma.kullanici.findUnique({ where: { email }, select: { id: true } })) throw new IsHatasi("Bu e-posta ile zaten bir hesap var", 409);
  const sifre = g.sifre?.trim() || rastgeleSifre();
  const hata = sifreKurali(sifre);
  if (hata) throw new IsHatasi(hata);
  const k = await prisma.kullanici.create({
    data: { ad: g.ad.trim(), email, rol: g.rol, subeId: g.subeId ?? null, sifreHash: await sifreHashle(sifre), sifreDegistirmeli: true },
  });
  return { id: k.id, email, ad: k.ad, sifre };
}

export async function subeOlustur(g: { ad: string; kod?: string; adres?: string | null; telefon?: string | null; mudur?: { ad: string; email: string; sifre?: string } }) {
  const kod = g.kod?.trim().toUpperCase() || (await subeKoduUret(g.ad));
  if (await prisma.sube.findUnique({ where: { kod }, select: { id: true } })) throw new IsHatasi(`"${kod}" şube kodu zaten kullanılıyor`, 409);
  const sube = await prisma.sube.create({ data: { ad: g.ad.trim(), kod, adres: g.adres || null, telefon: g.telefon || null } });
  let hesap: (HesapBilgisi & { id: string }) | null = null;
  if (g.mudur) {
    try {
      hesap = await kullaniciOlustur({ ad: g.mudur.ad, email: g.mudur.email, rol: "SUBE_MUDURU", subeId: sube.id, sifre: g.mudur.sifre });
    } catch (e) {
      await prisma.sube.delete({ where: { id: sube.id } }); // yarim kalan sube birakma
      throw e;
    }
  }
  return { sube, hesap };
}

/** Son aktif süper admini silmek/pasife almak/rolünü düşürmek engellenir. */
async function sonSuperAdminKorumasi(hedefId: string) {
  const kalan = await prisma.kullanici.count({ where: { rol: "SUPER_ADMIN", aktif: true, id: { not: hedefId } } });
  if (kalan === 0) throw new IsHatasi("Sistemde en az bir aktif süper admin kalmalı", 409);
}

export async function kullaniciGuncelle(id: string, aktorId: string, g: { ad?: string; rol?: Rol; subeId?: string | null; aktif?: boolean }) {
  const k = await prisma.kullanici.findUnique({ where: { id } });
  if (!k) throw new IsHatasi("Kullanıcı bulunamadı", 404);
  const yeniRol = g.rol ?? k.rol;
  const yeniSube = g.subeId !== undefined ? g.subeId : k.subeId;
  if (yeniRol !== "SUPER_ADMIN" && !yeniSube) throw new IsHatasi("Bu rol için şube seçmelisiniz");
  if (yeniRol === "SUPER_ADMIN" && yeniSube) throw new IsHatasi("Süper admin bir şubeye bağlı olamaz");
  if (id === aktorId && (g.aktif === false || (g.rol && g.rol !== "SUPER_ADMIN"))) throw new IsHatasi("Kendi hesabınızı pasife alamaz veya rolünüzü düşüremezsiniz", 409);
  if (k.rol === "SUPER_ADMIN" && (g.aktif === false || yeniRol !== "SUPER_ADMIN")) await sonSuperAdminKorumasi(id);
  const guncel = await prisma.kullanici.update({ where: { id }, data: { ad: g.ad?.trim(), rol: yeniRol, subeId: yeniSube, aktif: g.aktif } });
  // rol/sube/aktiflik degisince acik oturumlar kapatilir (yeni yetkiler hemen gecerli olsun)
  if (g.rol || g.subeId !== undefined || g.aktif === false) await prisma.oturum.deleteMany({ where: { kullaniciId: id } });
  return guncel;
}

export async function sifreSifirla(id: string): Promise<HesapBilgisi> {
  const k = await prisma.kullanici.findUnique({ where: { id } });
  if (!k) throw new IsHatasi("Kullanıcı bulunamadı", 404);
  const sifre = rastgeleSifre();
  await prisma.$transaction([
    prisma.kullanici.update({ where: { id }, data: { sifreHash: await sifreHashle(sifre), sifreDegistirmeli: true } }),
    prisma.oturum.deleteMany({ where: { kullaniciId: id } }),
    prisma.girisDenemesi.deleteMany({ where: { anahtar: `e:${k.email}` } }), // kilitliyse acilir
  ]);
  return { email: k.email, ad: k.ad, sifre };
}

export async function subeGuncelle(id: string, g: { ad?: string; adres?: string | null; telefon?: string | null; aktif?: boolean }) {
  const s = await prisma.sube.findUnique({ where: { id } });
  if (!s) throw new IsHatasi("Şube bulunamadı", 404);
  if (g.aktif === false && id === (await anaSubeId())) throw new IsHatasi("Ana (Merkez) şube pasife alınamaz", 409);
  if (g.aktif === false && s.aktif) {
    const aktifSayisi = await prisma.sube.count({ where: { aktif: true, id: { not: id } } });
    if (aktifSayisi === 0) throw new IsHatasi("En az bir aktif şube kalmalı", 409);
  }
  const guncel = await prisma.sube.update({ where: { id }, data: { ad: g.ad?.trim(), adres: g.adres, telefon: g.telefon, aktif: g.aktif } });
  if (g.aktif === false) await prisma.oturum.deleteMany({ where: { kullanici: { subeId: id } } }); // şube kullanıcıları anında düşer
  return guncel;
}

/** Hareketi/stoğu olan şube silinemez, pasife alınmalı. */
export async function subeSil(id: string) {
  if (id === (await anaSubeId())) throw new IsHatasi("Ana (Merkez) şube silinemez", 409);
  const [h, st, sat, k] = await Promise.all([
    prisma.stokHareketi.count({ where: { subeId: id } }),
    prisma.stok.count({ where: { subeId: id, miktar: { gt: 0 } } }),
    prisma.satis.count({ where: { subeId: id } }),
    prisma.kullanici.count({ where: { subeId: id } }),
  ]);
  if (h || st || sat) throw new IsHatasi("Bu şubenin stok/satış geçmişi var, silinemez. Bunun yerine pasife alın.", 409);
  if (k) throw new IsHatasi("Önce şubenin kullanıcılarını silin veya başka şubeye taşıyın", 409);
  await prisma.sube.delete({ where: { id } });
}
