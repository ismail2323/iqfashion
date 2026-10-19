import { handler } from "@/lib/api";
import { sifreSifirla } from "@/lib/hesaplar";
import { denetle } from "@/lib/denetim";

export const POST = handler({ roller: ["SUPER_ADMIN"] }, async ({ kullanici, params }) => {
  const hesap = await sifreSifirla(params.id);
  await denetle(kullanici, "sifre-sifirla", "kullanici", params.id, { email: hesap.email });
  return { hesap };
});