import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { prisma } from "./db";
import type { Oturumlu } from "./rbac";

export const COOKIE = "iq_oturum";
const KISA_OMUR_MS = 12 * 60 * 60 * 1000;
const UZUN_OMUR_MS = 30 * 24 * 60 * 60 * 1000;

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

export async function oturumAc(kullaniciId: string, benihatirla: boolean) {
  sirKontrol();
  const token = randomBytes(32).toString("base64url");
  const omur = benihatirla ? UZUN_OMUR_MS : KISA_OMUR_MS;
  const { ip, userAgent } = await istemciBilgisi();
  await prisma.oturum.create({
    data: { kullaniciId, tokenHash: hashle(token), expiresAt: new Date(Date.now() + omur), ip, userAgent },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(omur / 1000),
  });
}

export async function oturumKapat() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (token) await prisma.oturum.deleteMany({ where: { tokenHash: hashle(token) } });
  c.delete(COOKIE);
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
