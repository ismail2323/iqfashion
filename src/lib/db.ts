import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function olustur(): PrismaClient {
  // Neon (ücretsiz) boştayken uyur; uyanma birkaç saniye sürebilir -> bağlantı zaman aşımı geniş tutulur.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 25_000, idleTimeoutMillis: 20_000, max: 6 });
  // Etkileşimli işlemler (satış, mal kabul, ürün girişi...) için bekleme süreleri: varsayılan 2 sn/5 sn, Neon uyanırken
  // ya da çok varyantlı ürün girişinde "transaction expired" hatasına yol açabiliyordu.
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 15_000, timeout: 60_000 } });
}

const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = g.prisma ?? olustur();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
