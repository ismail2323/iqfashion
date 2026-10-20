import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { prisma } from "./db";
import type { Oturumlu } from "./rbac";

export const COOKIE = "iq_oturum";
// Oturumlar KAYAN süreli: kullandıkça uzar. Aynı hesap telefon + bilgisayar + tablette aynı anda açık kalabilir (her giriş ayrı oturumdur).
export const OMUR_MS = 30 * 24 * 60 * 60 * 1000;
export const KALICI_COOKIE = "iq_kalici";

export function sirKontrol() {
  const s = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!s || s.length < 32)) {
    throw new Error("SESSION_SECRET production ortaminda en az 32 karakter olarak tanimlanmali");
  }
}

const hashle = (t: string) => createHash("sha256").update(t).digest("hex");

export async function istemciBilgisi() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "bilinmiyor";
  return { ip, userAgent: h.get("user-agent")?.slice(0, 250) ?? null };
}

export async function oturumAc(kullaniciId: string, kalici: boolean) {
  sirKontrol();
  const token = randomBytes(32).toString("base64url");
  const { ip, userAgent } = await istemciBilgisi();
  await prisma.oturum.create({ data: { kullaniciId, tokenHash: hashle(token), expiresAt: new Date(Date.now() + OMUR_MS), ip, userAgent } });
  // Bu kullanıcının süresi dolmuş eski oturumlarını temizle (tablo şişmesin)
  await prisma.oturum.deleteMany({ where: { kullaniciId, expiresAt: { lt: new Date() } } });
  const c = await cookies();
  const secenek = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
  // kalici=false: tarayıcı kapanınca çerez silinir (ortak bilgisayar). kalici=true: 30 gün, kullandıkça proxy yeniler.
  c.set(COOKIE, token, kalici ? { ...secenek, maxAge: Math.floor(OMUR_MS / 1000) } : secenek);
  if (kalici) c.set(KALICI_COOKIE, "1", { ...secenek, httpOnly: false, maxAge: Math.floor(OMUR_MS / 1000) });
  else c.delete(KALICI_COOKIE);
}
export async function oturumKapat() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (token) await prisma.oturum.deleteMany({ where: { tokenHash: hashle(token) } });
  c.delete(COOKIE);
  c.delete(KALICI_COOKIE);
}

/** Gecerli, aktif kullanici oturumu; yoksa null. Ayni istek icinde onbelleklenir. */
export const mevcutKullanici = cache(async (): Promise<Oturumlu | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const o = await prisma.oturum.findUnique({
    where: { tokenHash: hashle(token) },
    include: { kullanici: { include: { sube: { select: { aktif: true } } } } },
  });
  if (!o || o.expiresAt < new Date()) return null;
  // Kayan süre: en fazla günde bir kez yazılır (her istekte DB yazmayız)
  if (o.expiresAt.getTime() - Date.now() < OMUR_MS - 24 * 60 * 60 * 1000) {
    void prisma.oturum.update({ where: { id: o.id }, data: { expiresAt: new Date(Date.now() + OMUR_MS) } }).catch(() => {});
  }
  const k = o.kullanici;
  if (!k.aktif) return null;
  if (k.rol !== "SUPER_ADMIN" && (!k.subeId || !k.sube?.aktif)) return null;
  return { id: k.id, email: k.email, ad: k.ad, rol: k.rol, subeId: k.subeId, sifreDegistirmeli: k.sifreDegistirmeli };
});

export async function kullaniciOturumlariniSil(kullaniciId: string, haricToken?: string) {
  await prisma.oturum.deleteMany({
    where: { kullaniciId, ...(haricToken ? { NOT: { tokenHash: hashle(haricToken) } } : {}) },
  });
}

export async function suresiDolanlariTemizle() {
  await prisma.oturum.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.girisDenemesi.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
}

// --- Giris hiz siniri: 15 dk icinde 5 basarisiz deneme -> kilit ---
const PENCERE_MS = 15 * 60 * 1000;
const MAX_HATA = 5;

export async function girisKilitliMi(anahtar: string, esik = MAX_HATA): Promise<number> {
  const sayi = await prisma.girisDenemesi.count({
    where: { anahtar, basarili: false, createdAt: { gt: new Date(Date.now() - PENCERE_MS) } },
  });
  return sayi >= esik ? Math.ceil(PENCERE_MS / 60000) : 0;
}

export async function girisDenemesiKaydet(anahtar: string, basarili: boolean) {
  await prisma.girisDenemesi.create({ data: { anahtar, basarili } });
  if (basarili) await prisma.girisDenemesi.deleteMany({ where: { anahtar, basarili: false } });
}
