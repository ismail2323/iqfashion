import "server-only";
import { NextResponse } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import type { Rol } from "@/generated/prisma/client";
import { mevcutKullanici } from "./auth";
import { cookies } from "next/headers";
import { IsHatasi } from "./hatalar";
import { gecerliSube } from "./subeSecimi";
import { onbellekleriTazele, RAPOR, SUBELER } from "./onbellek";
import { YetkiHatasi, islemSubesi, subeKapsami, type Oturumlu } from "./rbac";

export const SUBE_COOKIE = "iq_sube";

export { IsHatasi };

type Ctx<S> = {
  kullanici: Oturumlu;
  /** Sorgu kapsami: super admin icin secili sube (yoksa hepsi), digerleri icin kendi subesi */
  kapsam: string | undefined;
  /** Yazma islemleri icin zorunlu sube */
  islemSube: () => string;
  govde: S;
  sorgu: URLSearchParams;
  params: Record<string, string>;
  req: Request;
};

type Secenek<S extends ZodType | undefined> = {
  roller?: Rol[];
  sema?: S;
  /** Giris yapmadan erisilebilir (login, kurulum). */
  acik?: boolean;
  /** Zorunlu şifre değişimi bekleyen hesap da çağırabilir (şifre değiştirme, çıkış, kimlik) */
  sifreMuaf?: boolean;
};

/** Mutasyonlarda Origin, Host ile eslesmeli (CSRF). */
function originTamam(req: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = req.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const json = (veri: unknown, durum = 200) => NextResponse.json(veri, { status: durum });

export function hataYaniti(e: unknown): NextResponse {
  if (e instanceof YetkiHatasi) return json({ hata: e.message }, e.durum);
  if (e instanceof IsHatasi) return json({ hata: e.message }, e.durum);
  if (e instanceof ZodError) {
    const i = e.issues[0];
    return json({ hata: `${i.path.join(".") || "girdi"}: ${i.message}` }, 400);
  }
  const kod = (e as { code?: string })?.code;
  if (kod === "P2002") return json({ hata: "Bu kayıt zaten mevcut (benzersiz alan çakışması)" }, 409);
  if (kod === "P2025") return json({ hata: "Kayıt bulunamadı" }, 404);
  console.error("[api]", e);
  return json({ hata: "Beklenmeyen bir hata oluştu" }, 500);
}

export function handler<S extends ZodType | undefined = undefined>(
  secenek: Secenek<S>,
  fn: (c: Ctx<S extends ZodType ? z.infer<S> : undefined>) => Promise<unknown>,
) {
  return async (req: Request, ctx?: { params?: Promise<Record<string, string>> }) => {
    try {
      if (!originTamam(req)) return json({ hata: "Geçersiz istek kaynağı" }, 403);
      let kullanici = null as Oturumlu | null;
      if (!secenek.acik) {
        kullanici = await mevcutKullanici();
        if (!kullanici) return json({ hata: "Oturum açmanız gerekiyor" }, 401);
        if (kullanici.sifreDegistirmeli && !secenek.sifreMuaf) return json({ hata: "Devam etmeden önce şifrenizi değiştirmelisiniz", sifreDegistir: true }, 403);
        if (secenek.roller && !secenek.roller.includes(kullanici.rol)) {
          return json({ hata: "Bu işlem için yetkiniz yok" }, 403);
        }
      }
      let govde = undefined as unknown;
      if (secenek.sema) {
        const ham = req.method === "GET" ? Object.fromEntries(new URL(req.url).searchParams) : await req.json().catch(() => null);
        govde = secenek.sema.parse(ham);
      }
      const params = ctx?.params ? await ctx.params : {};
      const hamSecili = (await cookies()).get(SUBE_COOKIE)?.value;
      const secili = kullanici?.rol === "SUPER_ADMIN" ? await gecerliSube(hamSecili) : hamSecili;
      const sonuc = await fn({
        kullanici: kullanici as Oturumlu,
        kapsam: kullanici ? subeKapsami(kullanici, secili) : undefined,
        islemSube: () => islemSubesi(kullanici as Oturumlu, secili),
        govde: govde as never,
        sorgu: new URL(req.url).searchParams,
        params,
        req,
      });
      // Veri değiştiren her başarılı istek panel/rapor ve şube önbelleğini düşürür (gösterge hep güncel kalır)
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) onbellekleriTazele(RAPOR, SUBELER);
      return sonuc instanceof Response ? sonuc : json(sonuc ?? { tamam: true });
    } catch (e) {
      return hataYaniti(e);
    }
  };
}


