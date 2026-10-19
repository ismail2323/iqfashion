import { NextResponse, type NextRequest } from "next/server";

// Hizli on-kontrol: oturum cerezi yoksa giris sayfasina. Gercek dogrulama sunucuda (DB oturumu) yapilir.
const ACIK = ["/giris", "/api/auth/giris", "/api/auth/kurulum", "/api/saglik", "/manifest.webmanifest", "/sw.js", "/logo", "/icon-"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (ACIK.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  if (req.cookies.has("iq_oturum")) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ hata: "Oturum açmanız gerekiyor" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/giris";
  url.search = pathname === "/" ? "" : `?devam=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
