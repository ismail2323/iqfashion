import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Sağlık/ısınma ucu: veritabanını uyandırır. Gizli veri döndürmez. */
export async function GET(req: Request) {
  // ?hafif=1: yalnızca uygulamanın ayakta olduğunu söyler (veritabanını UYANDIRMAZ). Dış izleme bunu sık çağırır.
  if (new URL(req.url).searchParams.has("hafif")) return NextResponse.json({ ok: true, hafif: true });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}