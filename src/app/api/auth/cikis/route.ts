import { handler } from "@/lib/api";
import { oturumKapat } from "@/lib/auth";

export const POST = handler({ acik: true }, async () => {
  await oturumKapat();
  return { tamam: true };
});
