import { handler } from "@/lib/api";
import { aiHazirMi } from "@/lib/ai";

export const GET = handler({}, async () => ({ hazir: aiHazirMi() }));
