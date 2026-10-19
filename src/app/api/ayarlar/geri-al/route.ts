import { handler } from "@/lib/api";
import { istatistikGeriAl } from "@/lib/sifirlama";
import { denetle } from "@/lib/denetim";

export const POST = handler({ roller: ["SUPER_ADMIN"] }, async ({ kullanici }) => {
  await istatistikGeriAl();
  await denetle(kullanici, "istatistik-geri-al", "ayar");
  return { tamam: true };
});