import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";

export const GET = handler({}, async ({ params }) => {
  const g = await prisma.gorsel.findUnique({ where: { id: params.id } });
  if (!g) return new Response("Bulunamadı", { status: 404 });
  return new Response(new Uint8Array(g.veri), {
    headers: { "Content-Type": g.mime, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
});