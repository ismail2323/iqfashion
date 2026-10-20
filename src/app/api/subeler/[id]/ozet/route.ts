import { handler } from "@/lib/api";
import { anaSubeId, subeOzeti } from "@/lib/hesaplar";

export const GET = handler({ roller: ["SUPER_ADMIN"] }, async ({ params }) => ({ ...(await subeOzeti(params.id)), ana: params.id === (await anaSubeId()) }));