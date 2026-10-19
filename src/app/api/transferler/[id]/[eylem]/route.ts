import { handler, IsHatasi } from "@/lib/api";
import { transferGonder, transferIptal, transferTeslimAl } from "@/lib/stok";
import { denetle } from "@/lib/denetim";

export const POST = handler({ roller: ["SUPER_ADMIN", "SUBE_MUDURU"] }, async ({ kullanici, params }) => {
  const fn = { gonder: transferGonder, teslim: transferTeslimAl, iptal: transferIptal }[params.eylem];
  if (!fn) throw new IsHatasi("Geçersiz işlem", 404);
  const t = await fn(params.id, kullanici);
  await denetle(kullanici, `transfer-${params.eylem}`, "transfer", t.id, { no: t.no, durum: t.durum });
  return { transfer: { id: t.id, durum: t.durum } };
});