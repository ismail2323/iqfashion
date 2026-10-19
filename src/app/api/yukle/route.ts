import { handler, IsHatasi, json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { gorselTuru, MAX_GORSEL_BAYT } from "@/lib/gorsel";

// Görsel istemcide küçültülür (~800px). Sunucu yine de boyut ve içerik türünü doğrular.
export const POST = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"] }, async ({ req }) => {
  const f = (await req.formData().catch(() => null))?.get("dosya");
  if (!(f instanceof File)) throw new IsHatasi("Görsel dosyası gerekli");
  if (f.size > MAX_GORSEL_BAYT) throw new IsHatasi("Görsel çok büyük (en fazla 1,5 MB)", 400);
  const bayt = new Uint8Array(await f.arrayBuffer());
  const tur = gorselTuru(bayt);
  if (!tur) throw new IsHatasi("Yalnızca JPEG, PNG veya WebP görsel yüklenebilir");
  const g = await prisma.gorsel.create({ data: { mime: tur, veri: bayt, boyut: bayt.length } });
  return json({ url: `/api/gorsel/${g.id}` });
});